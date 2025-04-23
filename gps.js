export const getLocation = (timeout = 10000) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
  
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6),
        }),
        (err) => reject(err),
        { timeout, enableHighAccuracy: true }
      );
    });
  };