# backend/app.py
"""
AirAware Backend: real air quality (Open-Meteo), weather (OpenWeatherMap),
optional wildfires (NASA FIRMS). Missing data returned as null or "N/A".
"""

import time
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
from firms import firms_bp

# Load environment variables from .env file (if it exists)
load_dotenv()

# Create the Flask application
app = Flask(__name__)

# Set SECRET_KEY from environment variable (required for sessions/cookies)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-please-change-in-production')

CORS(app, origins=['http://localhost:5173', 'http://localhost:3000', '*'])

# Register FIRMS blueprint for wildfire data
app.register_blueprint(firms_bp)

# API keys from env only
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
OPENWEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather'
OPEN_METEO_AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

# 3-hour cache for combined air quality + weather
CACHE_TTL_SECONDS = 10_800
_combined_cache = {}

def calculate_aqi_from_pm25(pm25):
    """
    Convert PM2.5 concentration (μg/m³) to AQI value
    Using simplified US EPA formula
    
    PM2.5 is one of the main pollutants measured
    AQI makes it easier for people to understand air quality
    """
    if pm25 <= 12.0:
        # Good air quality
        return round((50/12.0) * pm25)
    elif pm25 <= 35.4:
        # Moderate air quality
        return round(((100-51)/(35.4-12.1)) * (pm25-12.1) + 51)
    elif pm25 <= 55.4:
        # Unhealthy for sensitive groups
        return round(((150-101)/(55.4-35.5)) * (pm25-35.5) + 101)
    elif pm25 <= 150.4:
        # Unhealthy
        return round(((200-151)/(150.4-55.5)) * (pm25-55.5) + 151)
    else:
        # Very unhealthy or hazardous
        return round(((300-201)/(250.4-150.5)) * (pm25-150.5) + 201)

def get_aqi_category(aqi):
    """Convert AQI number to a category name."""
    if aqi is None:
        return "N/A"
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        return "Unhealthy"
    elif aqi <= 300:
        return "Very Unhealthy"
    else:
        return "Hazardous"


def _cache_key(lat, lon):
    """Round coords for cache key (approx 100m)."""
    return (round(lat, 4), round(lon, 4))


def _get_cached(key):
    """Return cached payload if present and not expired."""
    entry = _combined_cache.get(key)
    if not entry:
        return None
    payload, expiry = entry
    if time.time() > expiry:
        del _combined_cache[key]
        return None
    return payload


def _set_cached(key, payload):
    """Store payload with 3h TTL."""
    _combined_cache[key] = (payload, time.time() + CACHE_TTL_SECONDS)


# Root endpoint for basic health check
@app.route('/', methods=['GET'])
def home():
    """
    Root endpoint - confirms server is running
    """
    return jsonify({
        'status': 'online',
        'message': 'AirAware + CleanMap API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/health',
            'air_quality': '/api/airquality?lat=LAT&lon=LON',
            'wildfire': '/api/wildfire?lat=LAT&lon=LON'
        }
    }), 200

@app.route('/api/airquality', methods=['GET'])
def get_air_quality():
    """
    Combined air quality and weather. Cached 3 hours per (lat, lon).
    URL: /api/airquality?lat=LAT&lon=LON
    """
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        if not lat or not lon:
            return jsonify({'error': 'Missing latitude or longitude'}), 400
        lat = float(lat)
        lon = float(lon)
        key = _cache_key(lat, lon)
        cached = _get_cached(key)
        if cached is not None:
            return jsonify(cached), 200

        response_data = {
            'city': 'N/A',
            'aqi': None,
            'pm25': None,
            'temperature': None,
            'humidity': None,
            'category': 'N/A'
        }

        # Weather from OpenWeatherMap (require key)
        if OPENWEATHER_API_KEY:
            try:
                weather_response = requests.get(
                    OPENWEATHER_API_URL,
                    params={'lat': lat, 'lon': lon, 'appid': OPENWEATHER_API_KEY, 'units': 'metric'},
                    timeout=5
                )
                if weather_response.status_code == 200:
                    w = weather_response.json()
                    name = w.get('name')
                    response_data['city'] = name if name else 'N/A'
                    main = w.get('main') or {}
                    temp, hum = main.get('temp'), main.get('humidity')
                    response_data['temperature'] = round(temp, 1) if temp is not None else None
                    response_data['humidity'] = hum if hum is not None else None
            except Exception as e:
                print(f"Error fetching weather: {e}")
        else:
            print("OPENWEATHER_API_KEY not set; skipping weather")

        # Air quality from Open-Meteo (no key)
        try:
            aq_data = fetch_open_meteo_air_quality(lat, lon)
            if aq_data:
                response_data['aqi'] = aq_data.get('aqi')
                response_data['pm25'] = aq_data.get('pm25')
                cat = aq_data.get('category')
                response_data['category'] = cat if cat and cat not in ('Unknown', 'Unavailable') else 'N/A'
            else:
                response_data['category'] = 'N/A'
        except Exception as e:
            print(f"Air quality error: {e}")
            response_data['category'] = 'N/A'

        _set_cached(key, response_data)
        return jsonify(response_data), 200

    except ValueError:
        return jsonify({'error': 'Invalid coordinates format'}), 400
    except Exception as e:
        print(f"Server error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/pollutants', methods=['GET'])
def get_pollutants():
    """
    Comprehensive air quality (PM2.5, PM10, NO2, O3, SO2, CO) from Open-Meteo.
    URL: /api/pollutants?lat=LAT&lon=LON
    """
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        if not lat or not lon:
            return jsonify({'error': 'Missing latitude or longitude'}), 400
        lat = float(lat)
        lon = float(lon)
        air_data = fetch_open_meteo_air_quality(lat, lon)
        if air_data is None:
            return jsonify({
                'pm25': None, 'pm10': None, 'no2': None, 'o3': None, 'so2': None, 'co': None,
                'aqi': None, 'category': 'N/A', 'last_updated': None
            }), 200
        return jsonify(air_data), 200
    except Exception as e:
        print(f"Error fetching pollutant data: {e}")
        return jsonify({'error': 'Internal server error'}), 500


def fetch_open_meteo_air_quality(lat, lon):
    """
    Fetch air quality from Open-Meteo (no API key). Returns dict matching existing
    shape (pm25, pm10, no2, o3, so2, co, aqi, category) or None on failure.
    """
    try:
        params = {
            'latitude': lat,
            'longitude': lon,
            'current': 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide'
        }
        r = requests.get(OPEN_METEO_AQ_URL, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        current = data.get('current') or {}
        pm25 = current.get('pm2_5')
        pm10 = current.get('pm10')
        no2 = current.get('nitrogen_dioxide')
        o3 = current.get('ozone')
        so2 = current.get('sulphur_dioxide')
        co = current.get('carbon_monoxide')
        us_aqi = current.get('us_aqi')
        if us_aqi is not None:
            aqi = int(us_aqi)
        elif pm25 is not None:
            aqi = calculate_aqi_from_pm25(float(pm25))
        else:
            aqi = None
        category = get_aqi_category(aqi) if aqi is not None else 'N/A'
        return {
            'pm25': round(pm25, 1) if pm25 is not None else None,
            'pm10': round(pm10, 1) if pm10 is not None else None,
            'no2': round(no2, 1) if no2 is not None else None,
            'o3': round(o3, 1) if o3 is not None else None,
            'so2': round(so2, 1) if so2 is not None else None,
            'co': round(co, 1) if co is not None else None,
            'aqi': aqi,
            'category': category,
            'last_updated': 'Open-Meteo'
        }
    except Exception as e:
        print(f"Open-Meteo AQ error: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """
    Simple endpoint to check if the server is running
    Visit http://localhost:5001/health to test
    """
    return jsonify({
        'status': 'healthy',
        'message': 'AirAware backend is running!'
    }), 200

if __name__ == '__main__':
    print("Starting AirAware Backend...")
    print("Set OPENWEATHER_API_KEY in .env for weather. Air quality uses Open-Meteo (no key).")
    print("WARNING: For production deployment, use Gunicorn instead of Flask dev server")
    port = int(os.getenv('PORT', 5001))
    # Only run in debug mode if explicitly set to 'development'
    is_dev = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=is_dev)
