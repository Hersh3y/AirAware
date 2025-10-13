// Use environment variable for API base URL, fallback to /api for local development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const getAQICategory = (aqi = 100) => {
  if (aqi <= 50) return { level: 'Good', color: 'green', textColor: 'text-green-800', bgColor: 'bg-green-100' };
  if (aqi <= 100) return { level: 'Moderate', color: 'yellow', textColor: 'text-yellow-800', bgColor: 'bg-yellow-100' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: 'orange', textColor: 'text-orange-800', bgColor: 'bg-orange-100' };
  if (aqi <= 200) return { level: 'Unhealthy', color: 'red', textColor: 'text-red-800', bgColor: 'bg-red-100' };
  if (aqi <= 300) return { level: 'Very Unhealthy', color: 'purple', textColor: 'text-purple-800', bgColor: 'bg-purple-100' };
  return { level: 'Hazardous', color: 'maroon', textColor: 'text-red-900', bgColor: 'bg-red-200' };
};

export const getRecommendation = (aqi = 100) => {
  if (aqi <= 50) return "Air quality is excellent! Perfect for outdoor activities.";
  if (aqi <= 100) return "Air quality is acceptable for most people.";
  if (aqi <= 150) return "Sensitive groups should limit outdoor activity.";
  if (aqi <= 200) return "Everyone should limit prolonged outdoor exertion.";
  if (aqi <= 300) return "Everyone should avoid outdoor activity.";
  return "Health alert! Stay indoors and keep windows closed.";
};

export const fetchAirQualityData = async (lat, lon) => {
  try {
    const response = await fetch(`${API_BASE_URL}/airquality?lat=${lat}&lon=${lon}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    console.error('Error fetching air quality data:', error);
    throw error;
  }
};

export const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude
      }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
};

// Geocoding function to search for cities
export const searchCity = async (cityName) => {
  try {
    // Using Nominatim (OpenStreetMap) geocoding API - free and no API key needed
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=5`
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    // Transform the results to a more user-friendly format
    return data.map(result => ({
      name: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      type: result.type,
      importance: result.importance
    }));
  } catch (error) {
    console.error('Error searching for city:', error);
    throw error;
  }
};

// Mock forecast data generator (replace with real API later)
export const generateMockForecast = (currentAQI) => {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push({
      hour: `${i}:00`,
      aqi: Math.max(0, currentAQI + Math.floor(Math.random() * 30 - 15))
    });
  }
  return hours;
};