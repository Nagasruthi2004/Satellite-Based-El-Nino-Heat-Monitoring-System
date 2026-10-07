import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./SatelliteImageHeatAnalysis.css";

const BACKEND_BASE = "http://127.0.0.1:5000";

// Standard quick-select locations for fast evaluation and testing
const DEMO_LOCATIONS = [
  { name: "Chennai", country: "India", lat: 13.0827, lon: 80.2707 },
  { name: "Coimbatore", country: "India", lat: 11.0168, lon: 76.9558 },
  { name: "Bengaluru", country: "India", lat: 12.9716, lon: 77.5946 },
  { name: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777 },
  { name: "Delhi", country: "India", lat: 28.6139, lon: 77.2090 },
  { name: "Hyderabad", country: "India", lat: 17.3850, lon: 78.4867 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "London", country: "UK", lat: 51.5074, lon: -0.1278 },
];

const PRESET_DATES = [
  { label: "May 2024 (Peak Heatwave)", date: "2024-05-15" },
  { label: "April 2024 (Pre-Monsoon)", date: "2024-04-15" },
  { label: "June 2024 (Late Summer)", date: "2024-06-10" },
  { label: "May 2023 (Historical Baseline)", date: "2023-05-15" },
];

// Leaflet custom marker pin
function createPinIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
      <defs>
        <radialGradient id="pinGrad" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#ef4444" />
          <stop offset="100%" stop-color="#991b1b" />
        </radialGradient>
      </defs>
      <path d="M15 2 C7.8 2 2 7.8 2 15 C2 24.5 15 36 15 36 C15 36 28 24.5 28 15 C28 7.8 22.2 2 15 2 Z"
            fill="url(#pinGrad)" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "siha-pin",
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -38],
  });
}

// Map Click Listener Component
function MapClickListener({ onSelectCoords }) {
  useMapEvents({
    click(e) {
      if (e.latlng) {
        onSelectCoords(
          Number(e.latlng.lat.toFixed(4)),
          Number(e.latlng.lng.toFixed(4))
        );
      }
    },
  });
  return null;
}

const WORLD_CENTER = [20, 0];
const WORLD_ZOOM = 2;
const DETAIL_ZOOM = 9;

// Force map resize check
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

// Recenter Map Handler
function MapRecenterController({ center, zoom }) {
  const map = useMap();
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      map.setView(WORLD_CENTER, WORLD_ZOOM, { animate: false });
      return;
    }
    if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function SatelliteImageHeatAnalysis() {
  // Current coordinates & location state - initial state is null to show full world map
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [mapCenter, setMapCenter] = useState(WORLD_CENTER);
  const [mapZoom, setMapZoom] = useState(WORLD_ZOOM);
  const [selectedDate, setSelectedDate] = useState("2024-05-15");
  const [compareDate, setCompareDate] = useState("");
  const [comparisonActive, setComparisonActive] = useState(false);

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Visualization mode: "composite" (Satellite + Thermal) | "satellite" (Pure Satellite) | "thermal" (Thermal Overlay)
  const [viewMode, setViewMode] = useState("composite");
  const [thermalOpacity, setThermalOpacity] = useState(0.48);

  // API data state
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [noDataError, setNoDataError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const pinIcon = useMemo(() => createPinIcon(), []);

  // Fetch authentic satellite heat analysis from backend
  const fetchSatelliteData = useCallback(async (lat, lon, date, compDate) => {
    setLoading(true);
    setNoDataError("");
    setGeneralError("");

    const targetDate = date || selectedDate;
    let url = `${BACKEND_BASE}/satellite-heat-analysis?lat=${lat}&lon=${lon}&date=${encodeURIComponent(targetDate)}`;
    if (compDate) {
      url += `&compare_date=${encodeURIComponent(compDate)}`;
    }

    try {
      const resp = await fetch(url);
      const data = await resp.json();

      if (resp.status === 404 || data.status === "no_data" || data.available === false) {
        setNoDataError(data.error || "Satellite thermal/LST data is unavailable for this location/date.");
        setAnalysisData(null);
        if (data.location) {
          setLocationName(data.location);
        }
      } else if (!resp.ok || data.status === "error") {
        setGeneralError(data.error || "Failed to retrieve satellite thermal telemetry.");
        setAnalysisData(null);
      } else {
        setAnalysisData(data);
        if (data.location) {
          setLocationName(data.country ? `${data.location}, ${data.country}` : data.location);
        }
      }
    } catch (err) {
      console.error("Satellite analysis connection error:", err);
      setGeneralError("Unable to connect to satellite telemetry server. Please verify backend is running.");
      setAnalysisData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Initial load: do NOT fetch on mount, allow user to explore complete world map
  useEffect(() => {
    // Initial mount displays complete world map
  }, []);

  // Handle map click
  const handleMapClick = useCallback((lat, lon) => {
    setSelectedCoords({ lat, lon });
    setMapCenter([lat, lon]);
    setMapZoom(DETAIL_ZOOM);
    setLocationName(`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
    setAnalysisData(null);
    setNoDataError("");
    setGeneralError("");
    fetchSatelliteData(lat, lon, selectedDate, compareDate);
  }, [fetchSatelliteData, selectedDate, compareDate]);

  // Handle quick select city click
  const handleQuickSelect = useCallback((item) => {
    setSelectedCoords({ lat: item.lat, lon: item.lon });
    setMapCenter([item.lat, item.lon]);
    setMapZoom(DETAIL_ZOOM);
    setLocationName(`${item.name}, ${item.country}`);
    setSearchQuery("");
    setSearchError("");
    setAnalysisData(null);
    setNoDataError("");
    setGeneralError("");
    fetchSatelliteData(item.lat, item.lon, selectedDate, compareDate);
  }, [fetchSatelliteData, selectedDate, compareDate]);

  // Search submission
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchError("");
    setIsSearching(true);
    setAnalysisData(null);

    // 1. Direct coordinate format (e.g. "13.0827, 80.2707")
    const coordMatch = query.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const fixedLat = Number(lat.toFixed(4));
        const fixedLon = Number(lon.toFixed(4));
        setSelectedCoords({ lat: fixedLat, lon: fixedLon });
        setMapCenter([fixedLat, fixedLon]);
        setMapZoom(DETAIL_ZOOM);
        setLocationName(`${fixedLat}°, ${fixedLon}°`);
        setIsSearching(false);
        fetchSatelliteData(fixedLat, fixedLon, selectedDate, compareDate);
        return;
      }
    }

    // 2. Predefined list
    const found = DEMO_LOCATIONS.find(
      (loc) => loc.name.toLowerCase() === query.toLowerCase()
    );
    if (found) {
      handleQuickSelect(found);
      setIsSearching(false);
      return;
    }

    // 3. OpenStreetMap geocoder
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(geoUrl, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = Number(parseFloat(item.lat).toFixed(4));
        const lon = Number(parseFloat(item.lon).toFixed(4));
        setSelectedCoords({ lat, lon });
        setMapCenter([lat, lon]);
        setMapZoom(DETAIL_ZOOM);
        setLocationName(item.display_name.split(",").slice(0, 2).join(", "));
        fetchSatelliteData(lat, lon, selectedDate, compareDate);
      } else {
        setSearchError(`Location "${query}" not found. Please click directly on the map.`);
      }
    } catch {
      setSearchError("Geocoder unavailable. Please select your location directly on the map.");
    } finally {
      setIsSearching(false);
    }
  };

  // Date selection
  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (selectedCoords) {
      fetchSatelliteData(selectedCoords.lat, selectedCoords.lon, date, compareDate);
    }
  };

  // Toggle side-by-side comparison mode
  const handleToggleComparison = () => {
    const nextState = !comparisonActive;
    setComparisonActive(nextState);
    const comp = nextState ? "2023-05-15" : "";
    setCompareDate(comp);
    if (selectedCoords) {
      fetchSatelliteData(selectedCoords.lat, selectedCoords.lon, selectedDate, comp);
    }
  };

  // Risk color class
  const getRiskClass = (risk) => {
    const r = String(risk || "").toUpperCase();
    if (r.includes("CRITICAL")) return "siha-risk-critical";
    if (r.includes("HIGH")) return "siha-risk-high";
    if (r.includes("MODERATE")) return "siha-risk-moderate";
    return "siha-risk-low";
  };

  return (
    <div className="siha-dashboard">
      {/* ── TOP BAR: TITLE & FLOW HEADER ── */}
      <header className="siha-top-card">
        <div className="siha-top-title-row">
          <div>
            <div className="siha-badge">🛰️ Remote-Sensing Satellite Heat Telemetry</div>
            <h1 className="siha-title">Satellite Image Heat Analysis</h1>
            <p className="siha-subtitle">
              Clear High-Resolution Satellite Remote Sensing with Semi-Transparent Radiative LST Thermal Overlay.
            </p>
          </div>
          <div className="siha-flow-banner">
            <span>Location Click</span> → <span>Satellite Imagery</span> → <span>LST Radiometry</span> → <span>Thermal Overlay</span> → <span>Risk Classification</span>
          </div>
        </div>
      </header>

      {/* ── LOCATION SELECTION & INTERACTIVE MAP ── */}
      <section className="siha-location-card">
        <div className="siha-controls-header">
          <div className="siha-controls-title-wrap">
            <h2 className="siha-section-heading">📍 Select Location on Map</h2>
            <p className="siha-section-sub">
              Click anywhere globally or search to retrieve high-resolution satellite remote sensing & thermal LST telemetry.
            </p>
          </div>
          <div className="siha-active-coord-tag">
            {selectedCoords ? (
              <>
                <span className="siha-coord-lbl">Target:</span>
                <span className="siha-coord-num">{selectedCoords.lat.toFixed(4)}° {selectedCoords.lat >= 0 ? "N" : "S"}, {selectedCoords.lon.toFixed(4)}° {selectedCoords.lon >= 0 ? "E" : "W"}</span>
              </>
            ) : (
              <>
                <span className="siha-coord-lbl">Status:</span>
                <span className="siha-coord-num">World Map View (Zoom &amp; Click Anywhere)</span>
              </>
            )}
          </div>
        </div>

        {/* Search bar & observation date row */}
        <div className="siha-input-strip">
          <form className="siha-search-bar" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              className="siha-search-field"
              placeholder="Search any city or coordinates (e.g. Mumbai, Singapore, 13.0827, 80.2707)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="siha-search-submit" disabled={isSearching}>
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="siha-date-picker-wrap">
            <label className="siha-picker-label">Observation Date:</label>
            <select
              className="siha-picker-select"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
            >
              {PRESET_DATES.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={`siha-comparison-toggle ${comparisonActive ? "active" : ""}`}
            onClick={handleToggleComparison}
          >
            {comparisonActive ? "✓ Comparison Active" : "⚖️ Compare Two Dates"}
          </button>
        </div>

        {searchError && <div className="siha-error-notice">{searchError}</div>}

        {/* Quick select pills */}
        <div className="siha-quick-bar">
          <span className="siha-quick-title">Quick Select:</span>
          <div className="siha-quick-items">
            {DEMO_LOCATIONS.map((loc) => {
              const isSelected =
                selectedCoords &&
                Math.abs(selectedCoords.lat - loc.lat) < 0.05 &&
                Math.abs(selectedCoords.lon - loc.lon) < 0.05;
              return (
                <button
                  key={loc.name}
                  type="button"
                  className={`siha-quick-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => handleQuickSelect(loc)}
                >
                  {loc.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Selection Map */}
        <div className="siha-map-box">
          <MapContainer
            center={WORLD_CENTER}
            zoom={WORLD_ZOOM}
            minZoom={2}
            maxBounds={[[-85, -180], [85, 180]]}
            worldCopyJump={true}
            scrollWheelZoom={true}
            className="siha-leaflet"
          >
            <MapResizeHandler />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickListener onSelectCoords={handleMapClick} />
            <MapRecenterController center={mapCenter} zoom={mapZoom} />
            {selectedCoords && (
              <Marker position={[selectedCoords.lat, selectedCoords.lon]} icon={pinIcon}>
                <Popup>
                  <div style={{ textAlign: "center", padding: "4px" }}>
                    <strong>{locationName}</strong>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                      {selectedCoords.lat.toFixed(4)}°, {selectedCoords.lon.toFixed(4)}°
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
          <div className="siha-map-instruction">
            <span>🖱️</span> Click any location directly on the world map or search a city above to inspect satellite thermal radiometry.
          </div>
        </div>

        {/* Selected Location readout strip */}
        <div className="siha-selection-readout-strip">
          <div className="siha-readout-col">
            <span className="siha-readout-lbl">Selected Location</span>
            <strong className="siha-readout-val">{locationName || "World Map View (Select or search any location)"}</strong>
          </div>
          <div className="siha-readout-sep" />
          <div className="siha-readout-col">
            <span className="siha-readout-lbl">Latitude</span>
            <strong className="siha-readout-val">
              {selectedCoords
                ? `${selectedCoords.lat.toFixed(4)}° ${selectedCoords.lat >= 0 ? "N" : "S"}`
                : "—"}
            </strong>
          </div>
          <div className="siha-readout-sep" />
          <div className="siha-readout-col">
            <span className="siha-readout-lbl">Longitude</span>
            <strong className="siha-readout-val">
              {selectedCoords
                ? `${selectedCoords.lon.toFixed(4)}° ${selectedCoords.lon >= 0 ? "E" : "W"}`
                : "—"}
            </strong>
          </div>
        </div>
      </section>

      {/* ── LOADING SPINNER ── */}
      {loading && (
        <div className="siha-loading-stage" role="status">
          <div className="siha-loading-ring" />
          <div className="siha-loading-msg">
            <h3>Retrieving Satellite Imagery & Thermal Radiometry...</h3>
            <p>
              Fetching high-resolution satellite imagery &amp; deriving Land Surface Temperature for <strong>{locationName}</strong> {selectedCoords ? `(${selectedCoords.lat.toFixed(4)}°, ${selectedCoords.lon.toFixed(4)}°)` : ""}.
            </p>
          </div>
        </div>
      )}

      {/* ── UNAVAILABLE DATA BANNER (NO FAKE DATA) ── */}
      {!loading && noDataError && (
        <div className="siha-unavailable-banner" role="alert">
          <div className="siha-unavail-icon">🛰️⚠️</div>
          <div className="siha-unavail-text">
            <h3>Satellite thermal/LST data is unavailable for this location/date.</h3>
            <p>
              No valid satellite observations or thermal telemetry were recorded for {selectedCoords ? (<strong>{selectedCoords.lat.toFixed(4)}°, {selectedCoords.lon.toFixed(4)}°</strong>) : "the selected area"} on <strong>{selectedDate}</strong> due to temporal coverage limits or cloud obscuration.
            </p>
            <button
              type="button"
              className="siha-unavail-action"
              onClick={() => handleDateChange("2024-05-15")}
            >
              Switch to Verified Observation Date (15-May-2024)
            </button>
          </div>
        </div>
      )}

      {/* ── GENERAL ERROR BANNER ── */}
      {!loading && generalError && (
        <div className="siha-error-card" role="alert">
          <span>⚠️</span> {generalError}
        </div>
      )}

      {/* ── INITIAL PROMPT BEFORE SELECTION ── */}
      {!loading && !analysisData && !noDataError && !generalError && !selectedCoords && (
        <div className="siha-initial-prompt-card">
          <div className="siha-prompt-icon">🌍🛰️</div>
          <h3>Global Satellite Thermal Heat Analysis</h3>
          <p>
            The interactive world map above shows all continents and oceans. Click anywhere on the globe, use the quick-select buttons, or search any city (e.g., <strong>Chennai</strong>, <strong>London</strong>, <strong>Singapore</strong>, <strong>Mumbai</strong>) to zoom into that location and generate its high-resolution satellite thermal/LST heat analysis.
          </p>
        </div>
      )}

      {/* ── MAIN HERO SATELLITE THERMAL / LST HEAT MAP (DOMINANT HERO) ── */}
      {!loading && analysisData && !comparisonActive && (
        <section className="siha-hero-visual-card" aria-label="Satellite Thermal Heat Map">
          <div className="siha-visual-topbar">
            <div>
              <div className="siha-feed-indicator">
                <span className="pulse-dot" /> HIGH-RESOLUTION SATELLITE TELEMETRY
              </div>
              <h2 className="siha-visual-title">CLEAR SATELLITE IMAGE + THERMAL LST OVERLAY</h2>
              <p className="siha-visual-subtitle">
                Sharp, recognizable satellite ground features (buildings, roads, fields, rivers) with semi-transparent radiative skin temperature overlay.
              </p>
            </div>

            {/* View Mode Toggle Controls (Section 8) */}
            <div className="siha-controls-cluster">
              <div className="siha-view-switcher">
                <button
                  type="button"
                  className={`siha-view-btn ${viewMode === "composite" ? "active" : ""}`}
                  onClick={() => setViewMode("composite")}
                  title="Clear satellite basemap with semi-transparent thermal LST overlay"
                >
                  🛰️+🌡️ Satellite + Thermal
                </button>
                <button
                  type="button"
                  className={`siha-view-btn ${viewMode === "satellite" ? "active" : ""}`}
                  onClick={() => setViewMode("satellite")}
                  title="Sharp, unblurred raw satellite image showing buildings and streets"
                >
                  📷 Satellite Image
                </button>
                <button
                  type="button"
                  className={`siha-view-btn ${viewMode === "thermal" ? "active" : ""}`}
                  onClick={() => setViewMode("thermal")}
                  title="Thermal/LST infrared radiation overlay"
                >
                  🌡️ Thermal/LST Overlay
                </button>
              </div>

              {/* Thermal Opacity Slider (When in Satellite + Thermal view) */}
              {viewMode === "composite" && (
                <div className="siha-opacity-control">
                  <span className="siha-opacity-lbl">Thermal Opacity:</span>
                  <input
                    type="range"
                    min="0.15"
                    max="0.85"
                    step="0.05"
                    value={thermalOpacity}
                    onChange={(e) => setThermalOpacity(parseFloat(e.target.value))}
                    className="siha-opacity-slider"
                    title="Adjust thermal layer transparency to see ground features beneath"
                  />
                  <span className="siha-opacity-val">{Math.round(thermalOpacity * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Central Hero Display Stage with Layered Satellite and Thermal Overlay */}
          <div className="siha-map-display-stage">
            {/* Layer 1: Base Crystal-Clear Satellite Image (NEVER blurred, 100% sharp ground features) */}
            <img
              src={analysisData.satellite_image_url}
              alt={`Clear satellite view of ${locationName}`}
              className={`siha-base-satellite-img ${viewMode === "thermal" ? "dimmed" : ""}`}
              crossOrigin="anonymous"
            />

            {/* Layer 2: Semi-Transparent Thermal / LST Heat Overlay */}
            {analysisData.thermal_overlay_url && viewMode !== "satellite" && (
              <img
                src={analysisData.thermal_overlay_url}
                alt={`Thermal LST overlay of ${locationName}`}
                className="siha-thermal-overlay-img"
                style={{ opacity: viewMode === "thermal" ? 1.0 : thermalOpacity }}
                crossOrigin="anonymous"
              />
            )}

            {/* Layer 3: Cartographic Graticule Frame */}
            <div className="siha-graticule-frame" />

            {/* In-Image HUD Telemetry Box */}
            <div className="siha-hud-overlay">
              <div className="siha-hud-header">
                <span className="siha-hud-loc">{locationName}</span>
                <span className={`siha-hud-risk ${getRiskClass(analysisData.heat_risk)}`}>
                  HEAT RISK: {analysisData.heat_risk}
                </span>
              </div>
              <div className="siha-hud-divider" />
              <div className="siha-hud-stats">
                <div className="siha-hud-stat">
                  <span className="siha-hud-lbl">LST_max:</span>
                  <span className="siha-hud-val danger">{analysisData.lst_max}°C</span>
                </div>
                <div className="siha-hud-stat">
                  <span className="siha-hud-lbl">LST_avg:</span>
                  <span className="siha-hud-val highlight">{analysisData.lst_avg}°C</span>
                </div>
                <div className="siha-hud-stat">
                  <span className="siha-hud-lbl">LST_min:</span>
                  <span className="siha-hud-val cool">{analysisData.lst_min}°C</span>
                </div>
              </div>
            </div>

            {/* Hotspot Markers Overlay */}
            {analysisData.hotspots && analysisData.hotspots.length > 0 && viewMode !== "satellite" && (
              <div className="siha-hotspot-pins-layer">
                {analysisData.hotspots.map((spot, i) => (
                  <div key={i} className="siha-thermal-hotspot-pin">
                    <span className="pin-pulse">🔥</span>
                    <span className="pin-label">{spot.region || spot.name}: {spot.lst || spot.max_lst}°C</span>
                  </div>
                ))}
              </div>
            )}

            {/* Continuous Colorbar Legend (Bottom of map) */}
            <div className="siha-colorbar-legend">
              <div className="siha-legend-label-row">
                <span className="legend-end-lbl cool">Cooler LST ({analysisData.lst_min}°C)</span>
                <span className="legend-center-lbl">Land Surface Temperature Thermal Scale</span>
                <span className="legend-end-lbl warm">Higher LST ({analysisData.lst_max}°C)</span>
              </div>
              <div className="siha-colorbar-gradient" />
              <div className="siha-legend-ticks">
                <span className="tick blue">Blue (Cool)</span>
                <span className="tick-sep">─</span>
                <span className="tick cyan">Cyan</span>
                <span className="tick-sep">─</span>
                <span className="tick green">Green (Canopy)</span>
                <span className="tick-sep">─</span>
                <span className="tick yellow">Yellow (Moderate)</span>
                <span className="tick-sep">─</span>
                <span className="tick orange">Orange (Warm)</span>
                <span className="tick-sep">─</span>
                <span className="tick red">Red (Hotspot)</span>
              </div>
            </div>

            {/* Telemetry Stamp */}
            <div className="siha-telemetry-stamp">
              {analysisData.satellite_source} • Date: {analysisData.observation_date}
            </div>
          </div>
        </section>
      )}

      {/* ── SIDE-BY-SIDE COMPARISON VIEW (WHEN ACTIVE) ── */}
      {!loading && analysisData && comparisonActive && analysisData.comparison && (
        <section className="siha-comparison-section" aria-label="Two-Date Side-by-Side Satellite Thermal Comparison">
          <div className="siha-comparison-header">
            <div>
              <h2 className="siha-visual-title">SIDE-BY-SIDE SATELLITE THERMAL COMPARISON</h2>
              <p className="siha-visual-subtitle">
                Multi-Temporal Land Surface Temperature (LST) Evolution Over {locationName}
              </p>
            </div>
            <div className="siha-change-pill">
              Thermal Shift: <strong>{analysisData.comparison.lst_change > 0 ? "+" : ""}{analysisData.comparison.lst_change}°C</strong>
            </div>
          </div>

          <div className="siha-comparison-grid">
            {/* Earlier Date Map */}
            <div className="siha-comp-card">
              <div className="siha-comp-card-header">
                <span className="siha-comp-label">EARLIER DATE</span>
                <span className="siha-comp-date">{analysisData.comparison.before_date}</span>
              </div>
              <div className="siha-comp-img-wrap">
                <img
                  src={analysisData.comparison.before_thermal_image_url}
                  alt={`Earlier thermal map on ${analysisData.comparison.before_date}`}
                  className="siha-comp-img"
                />
                <div className="siha-comp-stat-badge">
                  LST_avg: <strong>{analysisData.comparison.before_lst_avg}°C</strong> | LST_max: {analysisData.comparison.before_lst_max}°C
                </div>
              </div>
            </div>

            {/* Center Divider */}
            <div className="siha-comp-divider">
              <div className="siha-divider-line" />
              <span className="siha-divider-badge">VS</span>
              <div className="siha-divider-line" />
            </div>

            {/* Later Date Map */}
            <div className="siha-comp-card">
              <div className="siha-comp-card-header">
                <span className="siha-comp-label">LATER DATE</span>
                <span className="siha-comp-date">{analysisData.comparison.after_date}</span>
              </div>
              <div className="siha-comp-img-wrap">
                <img
                  src={analysisData.comparison.after_thermal_image_url}
                  alt={`Later thermal map on ${analysisData.comparison.after_date}`}
                  className="siha-comp-img"
                />
                <div className="siha-comp-stat-badge highlight">
                  LST_avg: <strong>{analysisData.comparison.after_lst_avg}°C</strong> | LST_max: {analysisData.comparison.after_lst_max}°C
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── LOCATION-SPECIFIC INFORMATION PANEL (SECTION 4 & 10) ── */}
      {!loading && analysisData && (
        <section className="siha-info-panel-grid" aria-label="Location and Satellite Information Panel">
          {/* Panel 1: SELECTED LOCATION */}
          <div className="siha-info-card">
            <div className="siha-info-card-header">
              <span className="siha-info-icon">📍</span>
              <h3 className="siha-info-heading">SELECTED LOCATION</h3>
            </div>
            <div className="siha-info-body">
              <div className="siha-loc-name">{locationName}</div>
              <div className="siha-loc-row">
                <span className="siha-label">Latitude</span>
                <span className="siha-val">{analysisData.latitude.toFixed(4)}° N</span>
              </div>
              <div className="siha-loc-row">
                <span className="siha-label">Longitude</span>
                <span className="siha-val">{analysisData.longitude.toFixed(4)}° E</span>
              </div>
            </div>
          </div>

          {/* Panel 2: SATELLITE INFORMATION */}
          <div className="siha-info-card">
            <div className="siha-info-card-header">
              <span className="siha-info-icon">🛰️</span>
              <h3 className="siha-info-heading">SATELLITE INFORMATION</h3>
            </div>
            <div className="siha-info-body">
              <div className="siha-loc-row">
                <span className="siha-label">Satellite</span>
                <span className="siha-val">{analysisData.satellite_source}</span>
              </div>
              <div className="siha-loc-row">
                <span className="siha-label">Product</span>
                <span className="siha-val">{analysisData.product_name || "MOD11A2 / LST Telemetry"}</span>
              </div>
              <div className="siha-loc-row">
                <span className="siha-label">Date</span>
                <span className="siha-val highlight">{analysisData.observation_date}</span>
              </div>
            </div>
          </div>

          {/* Panel 3: THERMAL ANALYSIS */}
          <div className="siha-info-card">
            <div className="siha-info-card-header">
              <span className="siha-info-icon">🌡️</span>
              <h3 className="siha-info-heading">THERMAL ANALYSIS</h3>
            </div>
            <div className="siha-info-body">
              <div className="siha-loc-row">
                <span className="siha-label">LST_min</span>
                <span className="siha-val cool">{analysisData.lst_min} °C</span>
              </div>
              <div className="siha-loc-row">
                <span className="siha-label">LST_avg</span>
                <span className="siha-val highlight">{analysisData.lst_avg} °C</span>
              </div>
              <div className="siha-loc-row">
                <span className="siha-label">LST_max</span>
                <span className="siha-val danger">{analysisData.lst_max} °C</span>
              </div>
              <div className="siha-scientific-note">
                *Land Surface Temperature (LST) measures radiative skin temperature, distinct from Air Temperature.
              </div>
            </div>
          </div>

          {/* Panel 4: HEAT RISK */}
          <div className="siha-info-card siha-risk-card-highlight">
            <div className="siha-info-card-header">
              <span className="siha-info-icon">⚠️</span>
              <h3 className="siha-info-heading">HEAT RISK</h3>
            </div>
            <div className="siha-info-body siha-risk-body">
              <div className={`siha-risk-big-badge ${getRiskClass(analysisData.heat_risk)}`}>
                {analysisData.heat_risk}
              </div>
              <div className="siha-risk-scale-tag">
                Standard 4-Tier Remote Sensing Risk Model
              </div>
              <div className="siha-risk-scale-tiers">
                <span className={`tier-pill ${analysisData.heat_risk === "LOW" ? "active low" : ""}`}>Low (&lt;30°C)</span>
                <span className={`tier-pill ${analysisData.heat_risk === "MODERATE" ? "active moderate" : ""}`}>Moderate (30–37°C)</span>
                <span className={`tier-pill ${analysisData.heat_risk === "HIGH" ? "active high" : ""}`}>High (37–42°C)</span>
                <span className={`tier-pill ${analysisData.heat_risk === "CRITICAL" ? "active critical" : ""}`}>Critical (≥42°C)</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── THREE-COLUMN ANALYTICS ROW: HOTSPOT AREAS | HEAT RISK SUMMARY | KEY INSIGHTS (SECTIONS 7, 8, 9, 10) ── */}
      {!loading && analysisData && (
        <section className="siha-analytics-three-col" aria-label="Hotspots, Risk Distribution, and Insights">
          {/* Column 1: Hotspot Areas */}
          <div className="siha-col-card">
            <div className="siha-col-header">
              <span className="siha-col-icon">🔥</span>
              <h3 className="siha-col-title">Hotspot Areas</h3>
            </div>
            <p className="siha-col-subtitle">Visually detected high-LST pixel clusters</p>

            <div className="siha-hotspot-clusters-list">
              {analysisData.hotspots && analysisData.hotspots.length > 0 ? (
                analysisData.hotspots.map((spot, idx) => (
                  <div key={idx} className="siha-hotspot-item">
                    <div className="siha-hotspot-item-top">
                      <span className="siha-hotspot-name">{spot.region || spot.name || `Thermal Hotspot ${idx + 1}`}</span>
                      <span className={`siha-hotspot-risk-tag ${getRiskClass(spot.risk || spot.intensity)}`}>
                        {spot.risk || spot.intensity}
                      </span>
                    </div>
                    <div className="siha-hotspot-cluster-lbl">{spot.cluster || spot.sector || "Pixel Cluster"}</div>
                    <div className="siha-hotspot-lst-row">
                      <span className="lbl">LST:</span>
                      <strong className="val">{spot.lst || spot.max_lst}°C</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="siha-empty-hotspots">No extreme thermal hotspots detected above threshold.</div>
              )}
            </div>
          </div>

          {/* Column 2: Heat Risk Summary */}
          <div className="siha-col-card">
            <div className="siha-col-header">
              <span className="siha-col-icon">📊</span>
              <h3 className="siha-col-title">Heat Risk Summary</h3>
            </div>
            <p className="siha-col-subtitle">Calculated directly from satellite pixel radiometry</p>

            {analysisData.risk_distribution ? (
              <div className="siha-risk-summary-list">
                <div className="siha-summary-bar-row">
                  <div className="siha-summary-lbl-row">
                    <span className="tier-name low">Low</span>
                    <span className="tier-pct">{analysisData.risk_distribution.low_pct}%</span>
                  </div>
                  <div className="siha-progress-track">
                    <div className="siha-progress-fill low" style={{ width: `${analysisData.risk_distribution.low_pct}%` }} />
                  </div>
                </div>

                <div className="siha-summary-bar-row">
                  <div className="siha-summary-lbl-row">
                    <span className="tier-name moderate">Moderate</span>
                    <span className="tier-pct">{analysisData.risk_distribution.moderate_pct}%</span>
                  </div>
                  <div className="siha-progress-track">
                    <div className="siha-progress-fill moderate" style={{ width: `${analysisData.risk_distribution.moderate_pct}%` }} />
                  </div>
                </div>

                <div className="siha-summary-bar-row">
                  <div className="siha-summary-lbl-row">
                    <span className="tier-name high">High</span>
                    <span className="tier-pct">{analysisData.risk_distribution.high_pct}%</span>
                  </div>
                  <div className="siha-progress-track">
                    <div className="siha-progress-fill high" style={{ width: `${analysisData.risk_distribution.high_pct}%` }} />
                  </div>
                </div>

                <div className="siha-summary-bar-row">
                  <div className="siha-summary-lbl-row">
                    <span className="tier-name critical">Critical</span>
                    <span className="tier-pct">{analysisData.risk_distribution.critical_pct}%</span>
                  </div>
                  <div className="siha-progress-track">
                    <div className="siha-progress-fill critical" style={{ width: `${analysisData.risk_distribution.critical_pct}%` }} />
                  </div>
                </div>

                {/* Temperature Areas Delineation (Section 6) */}
                {analysisData.temperature_areas && (
                  <div className="siha-temp-areas-box">
                    <div className="siha-temp-area-item">
                      <span className="siha-area-dot red" />
                      <span className="siha-area-lbl">Higher Temp (≥37°C):</span>
                      <strong className="siha-area-val">{analysisData.temperature_areas.higher_temp.coverage_pct}%</strong>
                    </div>
                    <div className="siha-temp-area-item">
                      <span className="siha-area-dot yellow" />
                      <span className="siha-area-lbl">Moderate Temp:</span>
                      <strong className="siha-area-val">{analysisData.temperature_areas.moderate_temp.coverage_pct}%</strong>
                    </div>
                    <div className="siha-temp-area-item">
                      <span className="siha-area-dot green" />
                      <span className="siha-area-lbl">Lower Temp (&lt;30°C):</span>
                      <strong className="siha-area-val">{analysisData.temperature_areas.lower_temp.coverage_pct}%</strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="siha-empty-hotspots">Risk distribution data not calculated for this layer.</div>
            )}
          </div>

          {/* Column 3: Key Insights */}
          <div className="siha-col-card">
            <div className="siha-col-header">
              <span className="siha-col-icon">💡</span>
              <h3 className="siha-col-title">Key Insights</h3>
            </div>
            <p className="siha-col-subtitle">Derived strictly from satellite remote sensing telemetry</p>

            <div className="siha-insights-list">
              {analysisData.key_insights && analysisData.key_insights.length > 0 ? (
                analysisData.key_insights.map((insight, idx) => (
                  <div key={idx} className="siha-insight-item">
                    <span className="siha-insight-check">✓</span>
                    <span className="siha-insight-text">{insight}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="siha-insight-item">
                    <span className="siha-insight-check">✓</span>
                    <span className="siha-insight-text">Highest LST detected: {analysisData.lst_max}°C</span>
                  </div>
                  <div className="siha-insight-item">
                    <span className="siha-insight-check">✓</span>
                    <span className="siha-insight-text">Lowest LST detected: {analysisData.lst_min}°C</span>
                  </div>
                  <div className="siha-insight-item">
                    <span className="siha-insight-check">✓</span>
                    <span className="siha-insight-text">Average LST: {analysisData.lst_avg}°C</span>
                  </div>
                  <div className="siha-insight-item">
                    <span className="siha-insight-check">✓</span>
                    <span className="siha-insight-text">Dominant heat-risk category: {analysisData.heat_risk}</span>
                  </div>
                </>
              )}

              <div className="siha-insight-verification">
                <span className="shield-icon">🛡️</span>
                <span>High-resolution satellite telemetry calibrated against sensor ground truth.</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
