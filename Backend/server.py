from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch
import os
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import logging
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

os.environ["HF_HOME"] = "D:/huggingface_models/huggingface"

# Quantization config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str
    nearby_place: Optional[str] = None
    max_tokens: Optional[int] = 150
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.8  # Add top-p sampling parameter
    top_k: Optional[int] = 50

# Load model
try:
    logger.info("Loading model...")
    tokenizer = AutoTokenizer.from_pretrained(
        "HuggingFaceH4/zephyr-7b-alpha",
        padding_side="left",
        truncation_side="left"
    )
    tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        "HuggingFaceH4/zephyr-7b-alpha",
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.float16,
        low_cpu_mem_usage=True
    )

    # Compile model for faster inference if supported
    torch._dynamo.config.suppress_errors = True
    model = torch.compile(model, mode="reduce-overhead")  # Faster execution

    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Model loading failed: {str(e)}")
    raise RuntimeError("Failed to load model") from e

def is_location_related(prompt: str, nearby_place: Optional[str]) -> bool:
    """Check if the prompt is about the current location."""
    if not nearby_place:
        return False
    prompt_lower = prompt.lower()
    place_lower = nearby_place.lower()
    return (
        re.search(r"\b(here|this place|nearby|current location)\b", prompt_lower) 
        or place_lower in prompt_lower
    )

@app.post("/ask-zephyr")
async def ask_zephyr(request: PromptRequest):
    try:
        # Conditionally add location context
        if request.nearby_place and is_location_related(request.prompt, request.nearby_place):
            messages = [
                {"role": "system", "content": f"User is near {request.nearby_place}. Anser the questions concisely"},
                {"role": "user", "content": request.prompt}
            ]
        else:
            messages = [{"role": "user", "content": request.prompt}]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                top_k=request.top_k,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
                return_dict_in_generate=True,  # Ensure dictionary output
                output_scores=True,
                use_cache=True,  # Enable KV cache
                repetition_penalty=1.1,  # Slightly reduce repetition
                num_beams=1,  # Disable beam search for faster generation
            )
        
        new_tokens = outputs.sequences[0, inputs.input_ids.shape[1]:]
        response = tokenizer.decode(new_tokens, skip_special_tokens=True)
        
        return {
            "response": response.strip(),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)