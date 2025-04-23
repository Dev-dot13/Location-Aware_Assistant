export const isNearLocation = (userLat, userLon, locationLat, locationLon, radius) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = userLat * Math.PI / 180;
  const φ2 = locationLat * Math.PI / 180;
  const Δφ = (locationLat - userLat) * Math.PI / 180;
  const Δλ = (locationLon - userLon) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= radius;
};