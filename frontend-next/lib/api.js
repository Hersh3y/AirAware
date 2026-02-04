/**
 * API base URL from env. Used by client components.
 */
export function getApiBase() {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';
}

export const getAQICategory = (aqi = 100) => {
  if (aqi <= 50) return { level: 'Good', color: 'green' };
  if (aqi <= 100) return { level: 'Moderate', color: 'yellow' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: 'orange' };
  if (aqi <= 200) return { level: 'Unhealthy', color: 'red' };
  if (aqi <= 300) return { level: 'Very Unhealthy', color: 'purple' };
  return { level: 'Hazardous', color: 'maroon' };
};

export const getRecommendation = (aqi = 100) => {
  if (aqi <= 50) return "Air quality is excellent! Perfect for outdoor activities.";
  if (aqi <= 100) return "Air quality is acceptable for most people.";
  if (aqi <= 150) return "Sensitive groups should limit outdoor activity.";
  if (aqi <= 200) return "Everyone should limit prolonged outdoor exertion.";
  if (aqi <= 300) return "Everyone should avoid outdoor activity.";
  return "Health alert! Stay indoors and keep windows closed.";
};

export async function searchCity(cityName) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=5`
  );
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  return data.map((result) => ({
    name: result.display_name,
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    type: result.type,
    importance: result.importance,
  }));
}
