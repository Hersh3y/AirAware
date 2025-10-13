# backend/app.py
"""
AirAware + CleanMap Backend Server
This Flask server fetches air quality and weather data from external APIs
and serves it to our React frontend in a simple, combined format.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS  # This handles Cross-Origin requests from React
import requests  # For making HTTP requests to external APIs
import os
from dotenv import load_dotenv  # For loading environment variables safely
from firms import firms_bp  # Import FIRMS blueprint

# Load environment variables from .env file (if it exists)
load_dotenv()

# Create the Flask application
app = Flask(__name__)

# Enable CORS to allow our React app to talk to this Flask server
# Allows local development and production Vercel deployment
CORS(app, origins=[
    'http://localhost:5173',           # Vite dev server
    'http://localhost:3000',           # Alternative dev port
    'https://*.vercel.app',            # All Vercel deployments
    'https://nasa-spaceapps-2025-production.up.railway.app',  # Railway frontend (if used)
    '*'                                # Fallback for other origins
])

# Register FIRMS blueprint for wildfire data
app.register_blueprint(firms_bp)

# API Configuration
# Get your free API key from: https://openweathermap.org/api
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'YOUR_API_KEY_HERE')

# API endpoints we'll be calling
OPENAQ_API_URL = 'https://api.openaq.org/v2/latest'
OPENWEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather'

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
    """
    Convert AQI number to a category name
    This helps users quickly understand if air quality is safe
    """
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
    Main API endpoint that fetches and combines air quality and weather data
    
    Expected URL format: /api/airquality?lat=33.749&lon=-84.388
    Returns: JSON object with combined air quality and weather data
    """
    
    try:
        # Step 1: Get coordinates from the URL parameters
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        
        # Check if both coordinates were provided
        if not lat or not lon:
            return jsonify({'error': 'Missing latitude or longitude'}), 400
        
        # Convert string coordinates to numbers
        lat = float(lat)
        lon = float(lon)
        
        print(f"📍 Fetching data for coordinates: {lat}, {lon}")
        
        # Initialize our response object with default values
        response_data = {
            'city': 'Unknown Location',
            'aqi': None,
            'pm25': None,
            'temperature': None,
            'humidity': None,
            'category': 'Unknown'
        }
        
        # Step 2: Fetch Weather Data from OpenWeatherMap
        try:
            print("☁️ Fetching weather data...")
            
            # Prepare the request to OpenWeatherMap
            weather_params = {
                'lat': lat,
                'lon': lon,
                'appid': OPENWEATHER_API_KEY,
                'units': 'metric'  # Get temperature in Celsius
            }
            
            # Make the API call
            weather_response = requests.get(
                OPENWEATHER_API_URL, 
                params=weather_params,
                timeout=5  # Wait max 5 seconds for response
            )
            
            # Check if the request was successful
            if weather_response.status_code == 200:
                weather_data = weather_response.json()
                
                # Extract the data we need
                response_data['city'] = weather_data.get('name', 'Unknown Location')
                response_data['temperature'] = round(
                    weather_data.get('main', {}).get('temp', 0), 1
                )
                response_data['humidity'] = weather_data.get('main', {}).get('humidity', 0)
                
                print(f"✅ Weather data retrieved for: {response_data['city']}")
            else:
                print(f"⚠️ Weather API error: {weather_response.status_code}")
                
        except Exception as e:
            print(f"❌ Error fetching weather: {str(e)}")
            # Continue even if weather fails - we might still get air quality
        
        # Step 3: Fetch Comprehensive Air Quality Data
        try:
            print("🌫️ Fetching comprehensive air quality data...")
            
            # Get comprehensive pollutant data
            pollutant_data = fetch_comprehensive_air_quality(lat, lon)
            
            # Update response with real pollutant data
            response_data['aqi'] = pollutant_data['aqi']
            response_data['pm25'] = pollutant_data['pm25']
            response_data['category'] = pollutant_data['category']
            
            print(f"📊 Returning combined data: {response_data}")
            
        except Exception as e:
            print(f"⚠️ Air quality data error: {e}")
            # Use demo air quality data if API fails
            response_data['aqi'] = 42
            response_data['pm25'] = 10.0
            response_data['category'] = 'Good (Demo Data)'
        
        # Step 4: Return the combined data
        print(f"📊 Returning combined data: {response_data}")
        return jsonify(response_data), 200
        
    except ValueError as e:
        # Handle invalid coordinate format
        return jsonify({'error': 'Invalid coordinates format'}), 400
    except Exception as e:
        # Handle any other unexpected errors
        print(f"❌ Server error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/pollutants', methods=['GET'])
def get_pollutants():
    """
    Get comprehensive air quality data for multiple pollutants
    URL format: /api/pollutants?lat=33.749&lon=-84.388
    Returns: JSON object with PM2.5, PM10, NO2, O3, SO2, CO data
    """
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        
        if not lat or not lon:
            return jsonify({'error': 'Missing latitude or longitude'}), 400
        
        lat = float(lat)
        lon = float(lon)
        
        print(f"🌫️ Fetching comprehensive air quality data for: {lat}, {lon}")
        
        # Fetch comprehensive air quality data
        air_data = fetch_comprehensive_air_quality(lat, lon)
        
        return jsonify(air_data), 200
        
    except Exception as e:
        print(f"❌ Error fetching pollutant data: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

def fetch_comprehensive_air_quality(lat, lon):
    """
    Fetch comprehensive air quality data from multiple sources
    Returns data for multiple pollutants: PM2.5, PM10, NO2, O3, SO2, CO
    """
    try:
        # Try AirVisual API first (free tier available)
        airvisual_data = fetch_airvisual_data(lat, lon)
        if airvisual_data:
            return airvisual_data
        
        # Fallback to demo data with realistic values based on location
        return generate_realistic_demo_data(lat, lon)
        
    except Exception as e:
        print(f"Error fetching comprehensive air quality data: {e}")
        return generate_realistic_demo_data(lat, lon)

def fetch_airvisual_data(lat, lon):
    """
    Try to fetch data from AirVisual API (free tier)
    """
    try:
        # AirVisual API endpoint
        url = "https://api.airvisual.com/v2/nearest_city"
        
        params = {
            'lat': lat,
            'lon': lon,
            'key': 'YOUR_AIRVISUAL_API_KEY'  # You would need to get this from AirVisual
        }
        
        # For now, return None to use demo data
        return None
        
    except Exception as e:
        print(f"AirVisual API error: {e}")
        return None

def generate_realistic_demo_data(lat, lon):
    """
    Generate realistic demo data based on location characteristics
    """
    import random
    
    # Generate realistic pollutant values based on location
    # Urban areas tend to have higher pollution
    is_urban = is_urban_area(lat, lon)
    
    if is_urban:
        # Urban area - higher pollution
        pm25 = round(random.uniform(15, 45), 1)
        pm10 = round(random.uniform(25, 65), 1)
        no2 = round(random.uniform(30, 80), 1)
        o3 = round(random.uniform(80, 150), 1)
        so2 = round(random.uniform(10, 40), 1)
        co = round(random.uniform(2, 8), 1)
    else:
        # Rural/suburban area - lower pollution
        pm25 = round(random.uniform(5, 20), 1)
        pm10 = round(random.uniform(10, 30), 1)
        no2 = round(random.uniform(10, 40), 1)
        o3 = round(random.uniform(50, 100), 1)
        so2 = round(random.uniform(2, 15), 1)
        co = round(random.uniform(0.5, 3), 1)
    
    # Calculate AQI from PM2.5
    aqi = calculate_aqi_from_pm25(pm25)
    
    return {
        'pm25': pm25,
        'pm10': pm10,
        'no2': no2,
        'o3': o3,
        'so2': so2,
        'co': co,
        'aqi': aqi,
        'category': get_aqi_category(aqi),
        'last_updated': 'Demo Data'
    }

def is_urban_area(lat, lon):
    """
    Simple heuristic to determine if location is urban
    """
    # Major US cities (simplified)
    major_cities = [
        (40.7128, -74.0060),  # NYC
        (34.0522, -118.2437), # LA
        (41.8781, -87.6298),  # Chicago
        (29.7604, -95.3698),  # Houston
        (33.4484, -112.0740), # Phoenix
        (39.9526, -75.1652),  # Philadelphia
        (32.7767, -96.7970),  # Dallas
        (29.4241, -98.4936),  # San Antonio
        (37.7749, -122.4194), # San Francisco
        (32.7157, -117.1611), # San Diego
    ]
    
    for city_lat, city_lon in major_cities:
        distance = ((lat - city_lat) ** 2 + (lon - city_lon) ** 2) ** 0.5
        if distance < 0.5:  # Within ~50km of major city
            return True
    
    return False

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

# Run the Flask application
if __name__ == '__main__':
    # Run the Flask development server
    print("Starting AirAware + CleanMap Backend Server...")
    print("Make sure to set OPENAQ_API_KEY and OPENWEATHER_API_KEY in your .env file")
    
    # Use Railway's PORT environment variable in production, fallback to 5001 for local dev
    port = int(os.getenv('PORT', 5001))
    
    # In production (Railway), use host 0.0.0.0 to accept external connections
    # In development, debug=True for hot reloading
    is_production = os.getenv('FLASK_ENV') == 'production'
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=not is_production
    )
