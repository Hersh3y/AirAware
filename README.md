# AirAware

Real-time air quality and weather monitoring. Map view with AQI, pollutants, and optional wildfire layer.

## Features

- Interactive map with user location and city search
- Air quality (AQI, PM2.5, PM10, NO2, O3, SO2, CO) from Open-Meteo
- Weather (temperature, humidity, city name) from OpenWeatherMap
- Color-coded AQI markers and pollutant layer overlays
- Optional NASA FIRMS wildfire layer
- Data refreshed every 3 hours (backend cache); manual refresh and “My Location” available
- Mobile-friendly layout

## Run locally

### Prerequisites

- Node.js (v18+)
- Python 3.8+
- API keys in env (see below)

### Backend (Flask)

1. Go to the backend folder and create env from example:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Edit `backend/.env`: set `OPENWEATHER_API_KEY` (required for weather). Optionally set `FIRMS_API_KEY` for wildfire data. Air quality uses Open-Meteo (no key).
3. Install and run:
   ```bash
   pip install -r requirements.txt
   python app.py
   ```
   Backend runs at `http://localhost:5001` by default.

### Frontend (Next.js)

1. Go to the Next.js app and create env from example:
   ```bash
   cd frontend-next
   cp .env.local.example .env.local
   ```
2. Ensure `NEXT_PUBLIC_API_BASE_URL=http://localhost:5001` in `frontend-next/.env.local` (or your backend URL).
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `OPENWEATHER_API_KEY` | backend `.env` | Weather (city, temp, humidity) |
| `FIRMS_API_KEY` | backend `.env` | Wildfire layer (optional) |
| `NEXT_PUBLIC_API_BASE_URL` | frontend-next `.env.local` | Backend API URL (e.g. `http://localhost:5001`) |

See `backend/.env.example` and `frontend-next/.env.local.example` for templates.

## Project structure

- **backend/** – Flask API: `/api/airquality`, `/api/pollutants`, `/api/fires`. Uses Open-Meteo for air quality, OpenWeatherMap for weather, NASA FIRMS for fires. All data is from these APIs; missing values are returned as null or `"N/A"`. Responses cached 3 hours.
- **frontend-next/** – Next.js 14 (App Router) map UI; Leaflet map loaded with `ssr: false`. Displays "N/A" for any missing data.
