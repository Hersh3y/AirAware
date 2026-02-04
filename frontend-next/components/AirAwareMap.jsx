'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getApiBase, searchCity } from '@/lib/api';

const REFRESH_INTERVAL_MS = 10_800_000; // 3 hours

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || 13);
  }, [center, zoom, map]);
  return null;
}

function createPollutantHeatMap(lat, lon, pollutantData, activeLayer) {
  if (!pollutantData) return null;
  const overlays = [];
  const baseValue = pollutantData[activeLayer] || 0;
  const colors = { pm25: '#ff6b6b', pm10: '#ffa726', no2: '#42a5f5', o3: '#66bb6a', so2: '#ab47bc', co: '#8d6e63' };
  const baseColor = colors[activeLayer] || '#778da9';
  const baseRadius = 0.05;
  overlays.push(L.circle([lat, lon], { radius: baseRadius * 111000, color: baseColor, fillColor: baseColor, fillOpacity: 0.3, weight: 2, className: `pollutant-base-${activeLayer}` }));
  const thresholds = { pm25: { low: 12, medium: 35, high: 55 }, no2: { low: 40, medium: 80, high: 180 }, o3: { low: 100, medium: 160, high: 240 }, so2: { low: 20, medium: 80, high: 250 }, co: { low: 4, medium: 9, high: 15 } };
  const threshold = thresholds[activeLayer] || thresholds.pm25;
  const spotSeed = Math.floor(lat * 1000) + Math.floor(lon * 1000) + activeLayer.charCodeAt(0);
  const seededRandom = (i) => { const x = Math.sin(spotSeed + i) * 10000; return x - Math.floor(x); };
  let numSpots = baseValue <= threshold.low ? Math.floor(seededRandom(0) * 3) : baseValue <= threshold.medium ? 3 + Math.floor(seededRandom(1) * 4) : baseValue <= threshold.high ? 6 + Math.floor(seededRandom(2) * 4) : 8 + Math.floor(seededRandom(3) * 5);
  for (let i = 0; i < numSpots; i++) {
    const angle = seededRandom(i) * 2 * Math.PI;
    const distance = seededRandom(i + 100) * baseRadius * 0.8;
    const spotLat = lat + Math.cos(angle) * distance;
    const spotLon = lon + Math.sin(angle) * distance;
    const spotRadius = (0.002 + seededRandom(i + 200) * 0.008) * 111000;
    const intensity = Math.min(1, baseValue / threshold.high);
    overlays.push(L.circle([spotLat, spotLon], { radius: spotRadius, color: baseColor, fillColor: baseColor, fillOpacity: 0.4 + intensity * 0.5, weight: 1, className: `pollutant-spot-${activeLayer}` }));
  }
  overlays.push(L.circleMarker([lat, lon], { radius: 8, color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.9, weight: 2, className: `pollutant-center-${activeLayer}` }));
  return overlays;
}

function PollutantOverlay({ userLocation, pollutantData, activeLayer }) {
  const map = useMap();
  useEffect(() => {
    if (!userLocation || !pollutantData) return;
    map.eachLayer((layer) => {
      if (layer.options.className && (layer.options.className.includes('pollutant-base') || layer.options.className.includes('pollutant-spot') || layer.options.className.includes('pollutant-center'))) map.removeLayer(layer);
    });
    const overlays = createPollutantHeatMap(userLocation.lat, userLocation.lng, pollutantData, activeLayer);
    if (overlays) overlays.forEach((o) => map.addLayer(o));
    return () => {
      map.eachLayer((layer) => {
        if (layer.options.className && (layer.options.className.includes('pollutant-base') || layer.options.className.includes('pollutant-spot') || layer.options.className.includes('pollutant-center'))) map.removeLayer(layer);
      });
    };
  }, [userLocation, pollutantData, activeLayer, map]);
  return null;
}

export default function AirAwareMap() {
  const [userLocation, setUserLocation] = useState(null);
  const [airQualityData, setAirQualityData] = useState(null);
  const [pollutantData, setPollutantData] = useState(null);
  const [activeLayer, setActiveLayer] = useState('aqi');
  const [dataAvailability, setDataAvailability] = useState({});
  const [clickedLocation, setClickedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [fireData, setFireData] = useState(null);
  const [showFires, setShowFires] = useState(false);
  const [fireLoading, setFireLoading] = useState(false);
  const [showPollutantInfo, setShowPollutantInfo] = useState(false);
  const [showLayersContent, setShowLayersContent] = useState(true);
  const [showWildfireContent, setShowWildfireContent] = useState(true);
  const [showLegendContent, setShowLegendContent] = useState(true);
  const refreshIntervalRef = useRef(null);
  const searchBoxRef = useRef(null);
  const infoHoverTimeoutRef = useRef(null);
  const locationRef = useRef(null);
  locationRef.current = userLocation;

  const getColoredIcon = (category) => {
    let color = '#808080';
    if (category) {
      if (category.includes('Good')) color = '#00e400';
      else if (category.includes('Moderate')) color = '#ffff00';
      else if (category.includes('Unhealthy for')) color = '#ff7e00';
      else if (category.includes('Very Unhealthy')) color = '#ff0000';
      else if (category.includes('Unhealthy')) color = '#ff7e00';
      else if (category.includes('Hazardous')) color = '#7e0023';
    }
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<span style="background-color:${color};width:2.5rem;height:2.5rem;display:block;left:-1.25rem;top:-1.25rem;position:relative;border-radius:2.5rem 2.5rem 0;transform:rotate(45deg);box-shadow:0 3px 6px rgba(0,0,0,0.3);" />`,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });
  };

  const fetchAirQualityData = async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const base = getApiBase();
      const response = await fetch(`${base}/api/airquality?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setAirQualityData(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Could not fetch air quality data. Ensure the backend is running and NEXT_PUBLIC_API_BASE_URL is set.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPollutantData = async (lat, lon) => {
    try {
      const base = getApiBase();
      const response = await fetch(`${base}/api/pollutants?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setDataAvailability({
        pm25: !!data.pm25 && data.pm25 > 0,
        pm10: !!data.pm10 && data.pm10 > 0,
        no2: !!data.no2 && data.no2 > 0,
        o3: !!data.o3 && data.o3 > 0,
        so2: !!data.so2 && data.so2 > 0,
        co: !!data.co && data.co > 0,
        aqi: !!data.aqi && data.aqi > 0,
      });
      setPollutantData(data);
      return data;
    } catch (err) {
      setError(`Failed to load pollutant data: ${err.message}`);
      return null;
    }
  };

  const fetchFireData = async (mapBounds) => {
    if (!showFires || !mapBounds) return;
    try {
      setFireLoading(true);
      const base = getApiBase();
      const bbox = `${mapBounds.getWest()},${mapBounds.getSouth()},${mapBounds.getEast()},${mapBounds.getNorth()}`;
      const response = await fetch(`${base}/api/fires?bbox=${bbox}&days=7`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setFireData(data);
    } catch (err) {
      setError(`Failed to load wildfire data: ${err.message}`);
    } finally {
      setFireLoading(false);
    }
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support geolocation');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(coords);
        fetchAirQualityData(coords.lat, coords.lng);
        fetchPollutantData(coords.lat, coords.lng);
      },
      () => {
        setError('Could not get your location. Please enable location services.');
        const defaultCoords = { lat: 33.749, lng: -84.388 };
        setUserLocation(defaultCoords);
        fetchAirQualityData(defaultCoords.lat, defaultCoords.lng);
        fetchPollutantData(defaultCoords.lat, defaultCoords.lng);
      }
    );
  };

  useEffect(() => {
    getUserLocation();
    refreshIntervalRef.current = setInterval(() => {
      const loc = locationRef.current;
      if (loc) {
        fetchAirQualityData(loc.lat, loc.lng);
        fetchPollutantData(loc.lat, loc.lng);
      }
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (showFires && userLocation) {
      const bounds = {
        getWest: () => userLocation.lng - 0.1,
        getEast: () => userLocation.lng + 0.1,
        getSouth: () => userLocation.lat - 0.1,
        getNorth: () => userLocation.lat + 0.1,
      };
      fetchFireData(bounds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchFireData is stable
  }, [showFires, userLocation]);

  const handleManualRefresh = () => {
    if (userLocation) {
      fetchAirQualityData(userLocation.lat, userLocation.lng);
      fetchPollutantData(userLocation.lat, userLocation.lng);
    }
  };

  const handleCitySearch = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchCity(query);
      setSearchResults(results);
      setShowResults(true);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCitySelect = (result) => {
    const coords = { lat: result.lat, lng: result.lon };
    setUserLocation(coords);
    fetchAirQualityData(coords.lat, coords.lng);
    fetchPollutantData(coords.lat, coords.lng);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery) handleCitySearch(searchQuery); }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const headerStyle = {
    background: 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%)',
    color: '#e0e1dd',
    padding: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    position: 'relative',
    zIndex: 3000,
  };

  const panelStyle = {
    background: '#1b263b',
    color: '#e0e1dd',
    padding: '10px',
    borderRadius: '8px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    zIndex: 1000,
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div id="app-header" style={headerStyle}>
        <h1 id="app-title" style={{ margin: 0, fontSize: '1.5rem' }}>AirAware</h1>
        <div id="search-container" style={{ position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', maxWidth: '500px', width: '100%' }} ref={searchBoxRef}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a city..."
              style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '0.5rem', border: 'none', fontSize: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', outline: 'none', color: '#374151', backgroundColor: 'white' }}
            />
            {isSearching && <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem' }}>...</div>}
            {showResults && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1b263b', color: '#e0e1dd', borderRadius: '0.5rem', marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '300px', overflowY: 'auto', zIndex: 4000 }}>
                {searchResults.map((result, index) => (
                  <div key={index} onClick={() => handleCitySelect(result)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: index < searchResults.length - 1 ? '1px solid #415a77' : 'none', color: '#e0e1dd' }} onMouseEnter={(e) => { e.target.style.background = '#415a77'; }} onMouseLeave={(e) => { e.target.style.background = '#1b263b'; }}>
                    <div style={{ fontWeight: '500' }}>{result.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>{result.lat.toFixed(4)}, {result.lon.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            )}
            {showResults && searchResults.length === 0 && searchQuery.length >= 3 && !isSearching && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1b263b', borderRadius: '0.5rem', marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '1rem', color: '#778da9', textAlign: 'center', zIndex: 4000 }}>No cities found. Try a different search.</div>
            )}
          </div>
        </div>
        <div id="status-controls" style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>{loading && <span>Loading...</span>}{!loading && lastUpdate && <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>}</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={getUserLocation} disabled={loading} style={{ padding: '0.5rem 1rem', background: '#415a77', color: '#e0e1dd', border: 'none', borderRadius: '0.25rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: '500' }}>My Location</button>
            <button onClick={handleManualRefresh} disabled={loading || !userLocation} style={{ padding: '0.5rem 1rem', background: '#778da9', color: '#0d1b2a', border: 'none', borderRadius: '0.25rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: '500' }}>Refresh</button>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8, width: '100%', textAlign: 'left' }}>Auto-refreshes every 3 hours</div>
        {error && <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '0.25rem' }}>{error}</div>}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {userLocation ? (
          <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={13} style={{ height: '100%', width: '100%' }} attributionControl={false} eventHandlers={{ click: (e) => { const { lat, lng } = e.latlng; setClickedLocation({ lat, lng }); fetchAirQualityData(lat, lng); fetchPollutantData(lat, lng); } }}>
            <MapUpdater center={[userLocation.lat, userLocation.lng]} zoom={13} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap' />
            {pollutantData && activeLayer !== 'aqi' && <PollutantOverlay userLocation={userLocation} pollutantData={pollutantData} activeLayer={activeLayer} />}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={getColoredIcon(airQualityData?.category)}>
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#e0e1dd' }}>{!airQualityData ? 'Loading...' : (airQualityData.city || 'N/A')}</h3>
                  {airQualityData ? (
                    <>
                      <div style={{ marginBottom: '10px' }}><strong>Air Quality</strong><div style={{ fontSize: '0.9rem' }}><div>AQI: <strong>{airQualityData.aqi ?? 'N/A'}</strong> ({airQualityData.category ?? 'N/A'})</div><div>PM2.5: {airQualityData.pm25 ?? 'N/A'} μg/m³</div></div></div>
                      {pollutantData && <div style={{ marginBottom: '10px' }}><strong>Pollutants</strong><div style={{ fontSize: '0.8rem' }}><div>PM2.5: <strong>{pollutantData.pm25 ?? 'N/A'}</strong> μg/m³</div><div>PM10: <strong>{pollutantData.pm10 ?? 'N/A'}</strong> μg/m³</div><div>NO₂: <strong>{pollutantData.no2 ?? 'N/A'}</strong> μg/m³</div><div>O₃: <strong>{pollutantData.o3 ?? 'N/A'}</strong> μg/m³</div><div>SO₂: <strong>{pollutantData.so2 ?? 'N/A'}</strong> μg/m³</div><div>CO: <strong>{pollutantData.co ?? 'N/A'}</strong> mg/m³</div></div></div>}
                      <div><strong>Weather</strong><div style={{ fontSize: '0.9rem' }}><div>Temp: {airQualityData.temperature ?? 'N/A'}°C</div><div>Humidity: {airQualityData.humidity ?? 'N/A'}%</div></div></div>
                    </>
                  ) : <div>Loading data...</div>}
                </div>
              </Popup>
            </Marker>
            {clickedLocation && (
              <Marker position={[clickedLocation.lat, clickedLocation.lng]} icon={L.divIcon({ html: '<div style="width:20px;height:20px;background:#ff6b6b;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(255,107,107,0.5);"></div>', className: 'custom-clicked-marker', iconSize: [20, 20], iconAnchor: [10, 10] })}>
                <Popup><div style={{ minWidth: '200px' }}><h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#e0e1dd' }}>Clicked Location</h3><p style={{ margin: '5px 0', fontSize: '0.9rem' }}><strong>Coordinates:</strong> {clickedLocation.lat.toFixed(4)}, {clickedLocation.lng.toFixed(4)}</p></div></Popup>
              </Marker>
            )}
            {showFires && fireData?.features?.map((fire, index) => {
              const [lon, lat] = fire.geometry.coordinates;
              const props = fire.properties;
              const getFireIcon = (confidence) => {
                let color = '#ff4444', size = 12;
                if (confidence === 'high') { color = '#ff0000'; size = 16; } else if (confidence === 'medium') { color = '#ff6666'; size = 14; } else if (confidence === 'low') { color = '#ff9999'; size = 10; }
                return L.divIcon({ html: `<div style="background-color:${color};width:${size}px;height:${size}px;border-radius:50%;box-shadow:0 0 8px rgba(255,68,68,0.8);"></div>`, className: 'fire-marker', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
              };
              return (
                <Marker key={`fire-${index}`} position={[lat, lon]} icon={getFireIcon(props.confidence)}>
                  <Popup>
                    <div style={{ minWidth: '200px' }}><h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#e0e1dd' }}>Active Fire</h3><div style={{ fontSize: '0.9rem' }}><div><strong>Confidence:</strong> {props.confidence ?? 'N/A'}</div><div><strong>Brightness:</strong> {props.brightness || 'N/A'} K</div><div><strong>FRP:</strong> {props.frp || 'N/A'} MW</div><div><strong>Date:</strong> {props.acq_date || 'N/A'}</div></div></div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><div>Getting your location...</div></div>
        )}
      </div>

      <div style={{ ...panelStyle, position: 'absolute', bottom: '20px', left: '20px', minWidth: '200px' }} className="pollutant-layers">
        <div style={{ position: 'relative' }} onMouseEnter={() => { if (infoHoverTimeoutRef.current) clearTimeout(infoHoverTimeoutRef.current); infoHoverTimeoutRef.current = setTimeout(() => setShowPollutantInfo(true), 600); }} onMouseLeave={() => { if (infoHoverTimeoutRef.current) clearTimeout(infoHoverTimeoutRef.current); setShowPollutantInfo(false); }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <strong>Pollutant Layers</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button aria-label="Collapse" onClick={(e) => { e.stopPropagation(); setShowLayersContent(!showLayersContent); }} style={{ background: 'transparent', border: '1px solid #415a77', color: '#e0e1dd', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>{showLayersContent ? '▾' : '▸'}</button>
              <button aria-label="Info" onClick={(e) => { e.stopPropagation(); setShowPollutantInfo(!showPollutantInfo); }} style={{ background: 'transparent', border: '1px solid #415a77', color: '#e0e1dd', width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', fontWeight: 700 }}>i</button>
            </div>
          </div>
          {showPollutantInfo && (
            <div style={{ position: 'absolute', top: 0, left: '100%', transform: 'translate(20px, -200px)', background: '#0d1b2a', color: '#e0e1dd', borderRadius: 8, padding: 12, boxShadow: '0 6px 14px rgba(0,0,0,0.35)', width: 280, zIndex: 2000, border: '1px solid #415a77' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>About pollutants</div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}><div style={{ marginBottom: 6 }}><strong>PM2.5</strong>: Fine particles; linked to heart and lung disease.</div><div style={{ marginBottom: 6 }}><strong>PM10</strong>: Coarse particles; worsen asthma.</div><div style={{ marginBottom: 6 }}><strong>NO₂</strong>: From traffic; inflames airways.</div><div style={{ marginBottom: 6 }}><strong>O₃</strong>: Ground-level ozone; reduces lung capacity.</div><div style={{ marginBottom: 6 }}><strong>SO₂</strong>: Irritates respiratory system.</div><div><strong>CO</strong>: Reduces oxygen delivery; dangerous at high levels.</div></div>
            </div>
          )}
        </div>
        {showLayersContent && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[{ key: 'pm25', label: 'PM2.5 (μg/m³)', color: '#ff6b6b' }, { key: 'pm10', label: 'PM10 (μg/m³)', color: '#ffa726' }, { key: 'no2', label: 'NO₂ (μg/m³)', color: '#42a5f5' }, { key: 'o3', label: 'O₃ (μg/m³)', color: '#66bb6a' }, { key: 'so2', label: 'SO₂ (μg/m³)', color: '#ab47bc' }, { key: 'co', label: 'CO (mg/m³)', color: '#8d6e63' }].map((p) => (
              <button key={p.key} onClick={() => setActiveLayer(p.key)} style={{ background: activeLayer === p.key ? '#415a77' : 'transparent', color: '#e0e1dd', border: `1px solid ${p.color}`, borderRadius: 4, padding: '6px 8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, backgroundColor: p.color, borderRadius: '50%' }} />{p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, position: 'absolute', bottom: 170, right: 20, minWidth: 150, textAlign: 'center' }} className="wildfire-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong>Wildfire Data</strong><button aria-label="Collapse" onClick={() => setShowWildfireContent(!showWildfireContent)} style={{ background: 'transparent', border: '1px solid #415a77', color: '#e0e1dd', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>{showWildfireContent ? '▾' : '▸'}</button></div>
        {showWildfireContent && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setShowFires(!showFires)} style={{ background: showFires ? '#ff4444' : 'transparent', color: '#e0e1dd', border: '1px solid #ff4444', borderRadius: 4, padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center' }}>{showFires ? 'Hide Fires' : 'Show Fires'}{fireLoading && <span style={{ fontSize: '0.7rem' }}> (Loading...)</span>}</button>
          </div>
        )}
      </div>

      {!dataAvailability[activeLayer] && pollutantData && activeLayer !== 'aqi' && (
        <div style={{ position: 'absolute', bottom: 20, right: 20, background: '#ff6b6b', color: '#fff', padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 1000, maxWidth: 200 }}>⚠️ {activeLayer.toUpperCase()} data not available for this location</div>
      )}

      <div style={{ ...panelStyle, position: 'absolute', bottom: 20, right: 20 }} className="aqi-legend">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong>AQI Scale</strong><button aria-label="Collapse" onClick={() => setShowLegendContent(!showLegendContent)} style={{ background: 'transparent', border: '1px solid #415a77', color: '#e0e1dd', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>{showLegendContent ? '▾' : '▸'}</button></div>
        {showLegendContent && (
          <div style={{ fontSize: '0.8rem', marginTop: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><div style={{ width: 12, height: 12, backgroundColor: '#00e400', borderRadius: '50%', marginRight: 8 }} />Good (0-50)</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><div style={{ width: 12, height: 12, backgroundColor: '#ffff00', borderRadius: '50%', marginRight: 8 }} />Moderate (51-100)</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><div style={{ width: 12, height: 12, backgroundColor: '#ff7e00', borderRadius: '50%', marginRight: 8 }} />Unhealthy for Sensitive (101-150)</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><div style={{ width: 12, height: 12, backgroundColor: '#ff0000', borderRadius: '50%', marginRight: 8 }} />Unhealthy (151-200)</div>
          </div>
        )}
      </div>
    </div>
  );
}
