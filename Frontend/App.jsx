import { useState, useEffect, useRef } from 'react';
import { Button, TextField, Chip, Typography, Box, Switch, FormControlLabel, IconButton} from "@mui/material";
import { VolumeOff } from '@mui/icons-material';
import LocationOnIcon from "@mui/icons-material/LocationOn";
import MicIcon from "@mui/icons-material/Mic";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { getLocation } from "./gps";
import { isNearLocation } from "./geo_trigger";
import { startSpeechRecognition, speak } from "./speech";
import locations from "./locations.json";
import { Tooltip } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#e3f2fd',
      dark: '#1565c0'
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      textTransform: 'none'
    }
  }
});

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AUTO_CHECK_INTERVAL = 5 * 60 * 1000;

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyPlace, setNearbyPlace] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);
  const [useLocationContext, setUseLocationContext] = useState(true);
  const intervalRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const mapStyle = {
    height: '300px',
    width: '100%',
    marginTop: '16px',
    borderRadius: '4px',
  };
  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const speak = (text) => {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name.includes('Natural')) || voices[0];

    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // Ensure voices are loaded (especially important for Chrome)
    if (window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Voices are now loaded
      };
    }
  }, []);

  const handleSpeechInput = async () => {
    setIsListening(true);
    try {
      const transcript = await startSpeechRecognition();
      console.log("Transcript:", transcript);
      
      if (!transcript) {
        throw new Error("No speech detected.");
      }
  
      // Auto-submit (even if input isn't updated visually)
      await handleSend(transcript); 
  

    } catch (error) {
      setError("Speech recognition failed: " + error.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsListening(false);
    }
  };

  const checkProximity = (coords) => {
    for (const place of locations) {
      if (isNearLocation(coords.lat, coords.lon, place.lat, place.lon, place.radius)) {
        setNearbyPlace(place.name);
        return place.name;
      }
    }
    setNearbyPlace(null);
    return null;
  };

  const fetchLocation = async () => {
    setError(null);
    try {
      const coords = await getLocation();
      setUserLocation(coords);
      return checkProximity(coords);
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  useEffect(() => {
    fetchLocation();
    intervalRef.current = setInterval(fetchLocation, AUTO_CHECK_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleManualRefresh = async () => {
    await fetchLocation();
  };

  const handleSend = async (inputText = null) => {
    const question = inputText || input;
    if (!question.trim()) return;
    
    try {
      const currentInput = input; // Save the current input
      setInput(""); // Clear the input field immediately

      const res = await fetch("http://localhost:8000/ask-zephyr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: question,
          nearby_place: useLocationContext ? nearbyPlace : null
        })
      });
      
      if (!res.ok){
        throw new Error("API request failed");
      }
      const data = await res.json();
      setResponse(data.response);

      if (autoSpeak && data.response) {
        speak(data.response);
      }

    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: 'auto', background: 'linear-gradient(to bottom, #f5f7fa 0%, #e4e8eb 100%)', borderRadius: 4,  boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minHeight: '100vh'}}>

      <Box sx={{
        background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)',
        color: 'white',
        p: 2,
        mb: 3,
        borderRadius: 2,
        boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
        textAlign: 'center',
        display: 'flex', // Add flex container
        flexDirection: 'column', // Stack children vertically
        alignItems: 'center'
      }}>
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            justifyContent: 'center'
          }}
        >
          <LocationOnIcon fontSize="large" />
          GeoAssistant
        </Typography>
        <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
          Location aware tour guide at your service!
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, mb: 2, borderRadius: 2, bgcolor: 'background.paper', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
        <Button 
          startIcon={<LocationOnIcon color="primary" />}
          onClick={handleManualRefresh}
          variant="outlined"
          color="primary"
          sx={{ 
            textTransform: 'none',
            fontWeight: 'bold'
          }}
        >
          Refresh Location
        </Button>
        
        {userLocation && (
          <Chip label={`📍 ${userLocation.lat}, ${userLocation.lon}`} 
          color="primary"
          variant="outlined"
          />
        )}
      </Box>

      <Tooltip title={isListening ? "Listening..." : "Voice input (auto-submits)"}>
        <span>
          <IconButton 
            onClick={handleSpeechInput} 
            color={isListening ? "secondary" : "default"}
            disabled={isListening}
            aria-label={isListening ? "Listening..." : "Start voice input"}
            sx={{
              bgcolor: isListening ? 'rgba(244, 67, 54, 0.1)' : 'rgba(25, 118, 210, 0.1)',
              '&:hover': {
                bgcolor: isListening ? 'rgba(244, 67, 54, 0.2)' : 'rgba(25, 118, 210, 0.2)'
              }
            }}
          >
            <MicIcon />
          </IconButton>
        </span>
      </Tooltip>

      {isSpeaking && (
        <Tooltip title="Stop speaking">
          <IconButton
            onClick={stopSpeaking}
            color="error"
            aria-label="Stop speaking"
            sx={{
              bgcolor: 'rgba(244, 67, 54, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(244, 67, 54, 0.2)'
              }
            }}
          >
            <VolumeOff/>
          </IconButton>
        </Tooltip>
      )}

      {isSpeaking && (
        <Typography variant="caption" sx={{ ml: 1 }}>
          Speaking...
        </Typography>
      )}

      {nearbyPlace && (
        <Box sx={{
          p: 2,
          mt:2,
          mb: 2,
          borderRadius: 2,
          bgcolor: 'primary.light',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <LocationOnIcon />
          <Typography variant="subtitle1">
            Auto-detected: <strong>{nearbyPlace}</strong>
          </Typography>
        </Box>
      )}

      {userLocation && (
        <Box sx={{
          height: '250px',
          width: '100%',
          mt: 2,
          mb: 2,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative',
          '& .leaflet-container': {
            height: '100%',
            width: '100%'
          }
        }}>
          <MapContainer 
            center={[userLocation.lat, userLocation.lon]} 
            zoom={15} 
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[userLocation.lat, userLocation.lon]}>
              <Popup>Your current location</Popup>
            </Marker>
          </MapContainer>
        </Box>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={autoSpeak}
            onChange={() => setAutoSpeak(!autoSpeak)}
            color="primary"
          />
        }
        label="Auto-speak responses"
      />

      <FormControlLabel
        control={
          <Switch
            checked={useLocationContext}
            onChange={() => setUseLocationContext(!useLocationContext)}
            color="primary"
          />
        }
        label="Use location context"
      />

      <TextField
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={isListening ? "Listening... Speak now" : "Type or speak your question..."}
        onFocus={() => setInput("")} // Clear when user clicks/focuses
        fullWidth
        multiline
        rows={4}
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1
          }
        }}
        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
      />
      
      <Button 
        onClick={() => handleSend()} 
        variant="contained" 
        disabled={!input.trim()}
        sx={{ 
          minWidth: 120,
          fontWeight: 'bold',
          textTransform: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }
        }}
      >
        Send
      </Button>

      {response && (
        <Box sx={{ 
          mt: 2,
          p: 3,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          whiteSpace: 'pre-wrap'
        }}>
          <Typography variant="body1" component="div">{response}</Typography>
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mt: 1 }}>
          ⚠️ {error}
        </Typography>
      )}
    </Box>
  );
}

export default App;