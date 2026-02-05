"""
NASA FIRMS (Fire Information for Resource Management System) Integration
Provides wildfire data via WFS proxy with caching and WMS tile layer support
"""

import os
import json
import requests
import time
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app

# Create blueprint
firms_bp = Blueprint('firms', __name__)

# NASA FIRMS API configuration (from env; no key = no fire data)
FIRMS_API_KEY = os.getenv('FIRMS_API_KEY')
FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api"

EMPTY_GEOJSON = {"type": "FeatureCollection", "features": []}

# Cache directory - single cache file for all FIRMS data
CACHE_DIR = "firms_cache"
CACHE_FILE = os.path.join(CACHE_DIR, "firms_data.json")

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

def fetch_firms_data(bbox, days=7):
    """
    Fetch FIRMS data from NASA API. Returns list of fire dicts or empty list on error/empty.
    bbox: [minLon, minLat, maxLon, maxLat] in EPSG:4326
    days: number of days to look back (max 31)
    """
    if not FIRMS_API_KEY:
        current_app.logger.info("FIRMS_API_KEY not set; returning no fire data")
        return []
    min_lon, min_lat, max_lon, max_lat = bbox
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    # Updated FIRMS API endpoint - using VIIRS_SNPP_NRT as the source
    url = f"{FIRMS_BASE_URL}/area/csv/{FIRMS_API_KEY}/VIIRS_SNPP_NRT/{min_lat},{min_lon},{max_lat},{max_lon}/{days}"
    params = {}
    try:
        current_app.logger.info(f"Fetching FIRMS data for bbox: {bbox}, days: {days}")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        csv_text = response.text
        lines = csv_text.strip().split('\n')
        if len(lines) <= 1:
            current_app.logger.info("No fire data in FIRMS response")
            return []
        headers = lines[0].split(',')
        fire_data = []
        for line in lines[1:]:
            if line.strip():
                values = line.split(',')
                fire_point = {}
                for i, header in enumerate(headers):
                    if i < len(values):
                        fire_point[header.strip()] = values[i].strip()
                fire_data.append(fire_point)
        current_app.logger.info(f"Retrieved {len(fire_data)} fire points from FIRMS")
        return fire_data
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"FIRMS API error: {e}")
        return []
    except Exception as e:
        current_app.logger.error(f"FIRMS parsing error: {e}")
        return []

def convert_to_geojson(firms_data):
    """Convert FIRMS data to GeoJSON format"""
    features = []
    
    for fire in firms_data:
        # Extract coordinates (FIRMS uses lat, lon)
        lat = fire.get('latitude')
        lon = fire.get('longitude')
        
        if lat is None or lon is None:
            continue
            
        # Create GeoJSON feature
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(lon), float(lat)]
            },
            "properties": {
                "confidence": fire.get('confidence', 'unknown'),
                "brightness": fire.get('brightness', 0),
                "bright_t31": fire.get('bright_t31', 0),
                "frp": fire.get('frp', 0),  # Fire Radiative Power
                "scan": fire.get('scan', 0),
                "track": fire.get('track', 0),
                "acq_date": fire.get('acq_date', ''),
                "acq_time": fire.get('acq_time', ''),
                "satellite": fire.get('satellite', ''),
                "instrument": fire.get('instrument', ''),
                "version": fire.get('version', ''),
                "bright_ti4": fire.get('bright_ti4', 0),
                "bright_ti5": fire.get('bright_ti5', 0),
                "daynight": fire.get('daynight', ''),
                "type": fire.get('type', '')
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

@firms_bp.route('/api/fires', methods=['GET'])
def get_fires():
    """
    Get wildfire data as GeoJSON
    Query params:
    - bbox: minLon,minLat,maxLon,maxLat (required)
    - days: number of days to look back (default: 7, max: 31)
    """
    try:
        # Get bounding box from query params
        bbox_str = request.args.get('bbox')
        if not bbox_str:
            return jsonify({"error": "bbox parameter required (minLon,minLat,maxLon,maxLat)"}), 400
        
        try:
            bbox = [float(x) for x in bbox_str.split(',')]
            if len(bbox) != 4:
                raise ValueError("bbox must have 4 values")
        except ValueError as e:
            return jsonify({"error": f"Invalid bbox format: {e}"}), 400
        
        # Get days parameter
        days = int(request.args.get('days', 7))
        days = min(days, 31)  # Cap at 31 days
        
        # Fetch fresh FIRMS data
        firms_data = fetch_firms_data(bbox, days)
        
        # Convert to GeoJSON (even if empty)
        if not firms_data:
            geojson_data = EMPTY_GEOJSON
        else:
            geojson_data = convert_to_geojson(firms_data)
        
        # Always overwrite the single cache file (even when empty)
        try:
            with open(CACHE_FILE, 'w') as f:
                json.dump(geojson_data, f)
            current_app.logger.info(f"Cached FIRMS data to {CACHE_FILE} ({len(geojson_data.get('features', []))} features)")
        except Exception as e:
            current_app.logger.warning(f"Failed to cache FIRMS data: {e}")
        
        return jsonify(geojson_data)
        
    except Exception as e:
        current_app.logger.error(f"FIRMS endpoint error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@firms_bp.route('/api/fires/wms', methods=['GET'])
def get_wms_info():
    """
    Get WMS tile layer information for FIRMS fires
    Returns the WMS URL template for frontend use
    """
    try:
        # Calculate date range for WMS TIME parameter
        end_date = datetime.now()
        start_date = end_date - timedelta(days=31)
        
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        
        # FIRMS WMS endpoint for VIIRS 375m
        wms_url = f"https://firms.modaps.eosdis.nasa.gov/wms/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=VIIRS_SNPP_NPP/MODIS_NRT&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={{bbox}}&TIME={start_str}/{end_str}"
        
        return jsonify({
            "wms_url": wms_url,
            "layer_name": "VIIRS_SNPP_NPP/MODIS_NRT",
            "time_range": f"{start_str}/{end_str}",
            "description": "NASA FIRMS Active Fires - VIIRS 375m"
        })
        
    except Exception as e:
        current_app.logger.error(f"WMS info error: {e}")
        return jsonify({"error": "Failed to get WMS information"}), 500
