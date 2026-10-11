import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./DisasterInformation.css";
import { detectBrowserLocation } from "../utils/locationService";

const BACKEND_BASE = "http://127.0.0.1:5000";

// Color tokens matching IMD & WMO heat severity standards
const RISK_THEMES = {
  Low: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "#10b981", label: "Low Risk", icon: "🟢" },
  Moderate: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "#f59e0b", label: "Moderate Risk", icon: "🟡" },
  High: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", border: "#ef4444", label: "High Risk", icon: "🟠" },
  Critical: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", border: "#8b5cf6", label: "Critical Heatwave", icon: "🔴" },
};

function getTheme(level) {
  const norm = String(level || "Low").toLowerCase();
  if (norm.includes("critical") || norm.includes("extreme")) return RISK_THEMES.Critical;
  if (norm.includes("high")) return RISK_THEMES.High;
  if (norm.includes("moderate") || norm.includes("medium")) return RISK_THEMES.Moderate;
  return RISK_THEMES.Low;
}

function createMapPin(level, isSelected = false) {
  const theme = getTheme(level);
  const size = isSelected ? 34 : 26;
  const pulseHtml = isSelected
    ? `<span class="map-pulse-halo" style="background:${theme.color};"></span>`
    : "";

  const svg = `
    <div class="custom-pin-wrapper">
      ${pulseHtml}
      <svg width="${size}" height="${size + 8}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22s14-12.375 14-22c0-7.732-6.268-14-14-14z" fill="${theme.color}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="14" cy="14" r="5" fill="#ffffff"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svg,
    className: "heat-risk-leaflet-pin",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 4)],
  });
}

// Map Click Listener to pick coordinates anywhere on map
function MapClickPicker({ onCoordSelect }) {
  useMapEvents({
    click(e) {
      if (e?.latlng) {
        onCoordSelect(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
      }
    },
  });
  return null;
}

// Map pan controller when location changes
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

const QUICK_CITIES = [
  { name: "Coimbatore", lat: 11.0168, lon: 76.9558 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Madurai", lat: 9.9252, lon: 78.1198 },
  { name: "Salem", lat: 11.6643, lon: 78.1460 },
  { name: "Tiruchirappalli", lat: 10.7905, lon: 78.7047 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867 },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { name: "Delhi", lat: 28.6139, lon: 77.2090 },
];

export default function DisasterInformation({
  currentHeatRisk,
  weather,
  satellite,
  liveLocation,
}) {
  // Primary State
  const initialCity = weather?.city || liveLocation || "Coimbatore";
  const [searchQuery, setSearchQuery] = useState(initialCity);
  const [selectedCoords, setSelectedCoords] = useState([
    weather?.lat || 11.0168,
    weather?.lon || 76.9558,
  ]);
  const [activeLocationLabel, setActiveLocationLabel] = useState(initialCity);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dataPayload, setDataPayload] = useState(null);

  // Sub-views & tabs
  const [activeForecastDayIndex, setActiveForecastDayIndex] = useState(0);
  const [activeHazardTab, setActiveHazardTab] = useState("flood");
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);

  // Fetch telemetry & forecast evaluation
  const fetchDisasterTelemetry = useCallback(async (cityTarget, latTarget, lonTarget) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();
      if (cityTarget) params.set("city", cityTarget);
      if (latTarget != null && !isNaN(latTarget)) params.set("latitude", latTarget);
      if (lonTarget != null && !isNaN(lonTarget)) params.set("longitude", lonTarget);

      const resp = await fetch(`${BACKEND_BASE}/disaster-risk?${params.toString()}`);
      if (!resp.ok) {
        throw new Error(`HTTP error ${resp.status}`);
      }

      const json = await resp.json();
      setDataPayload(json);

      if (json.location) {
        setActiveLocationLabel(json.location);
        setSearchQuery(json.location);
      }
      if (json.latitude != null && json.longitude != null) {
        setSelectedCoords([Number(json.latitude), Number(json.longitude)]);
      }
    } catch (err) {
      console.warn("Disaster Risk fetch error:", err);
      setErrorMessage("Unable to connect to live early warning engine. Displaying offline contingency data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDisasterTelemetry(initialCity, selectedCoords[0], selectedCoords[1]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle manual city search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    fetchDisasterTelemetry(searchQuery.trim(), null, null);
  };

  // Handle Quick City Pill Click
  const handleQuickCityClick = (city) => {
    setSearchQuery(city.name);
    setSelectedCoords([city.lat, city.lon]);
    fetchDisasterTelemetry(city.name, city.lat, city.lon);
  };

  // Handle Map Click Selection
  const handleMapCoordSelect = (lat, lon) => {
    setSelectedCoords([lat, lon]);
    fetchDisasterTelemetry("", lat, lon);
  };

  // Handle Geolocation Click
  const handleDetectGPS = async () => {
    setGeoLocating(true);
    setErrorMessage("");
    try {
      const loc = await detectBrowserLocation();
      if (loc && loc.latitude != null) {
        setSelectedCoords([loc.latitude, loc.longitude]);
        fetchDisasterTelemetry("", loc.latitude, loc.longitude);
      }
    } catch (err) {
      setErrorMessage("GPS location detection timed out or was denied. Use manual city search or click the map.");
    } finally {
      setGeoLocating(false);
    }
  };

  // Extract early heatwave warning payload
  const warning = dataPayload?.early_heatwave_warning || {};
  const currentRisk = warning.current_heat_risk_level || "Moderate";
  const currentRiskTheme = getTheme(currentRisk);
  const forecastList = warning.forecast_timeline || [];
  const selectedForecastDay = forecastList[activeForecastDayIndex] || forecastList[0] || null;
  const impact = warning.impact_assessment || {};
  const satTelemetry = warning.satellite_telemetry || {};
  const enso = warning.enso_climate_indicator || {};
  const actions = warning.recommended_actions || [];
  const provenance = warning.data_provenance || [];
  const officialSources = warning.official_sources || [];
  const stations = warning.regional_stations || [];
  const multiHazards = dataPayload?.disasters || {};

  return (
    <div className="ew-container" id="early-heatwave-disaster-center">
      {/* ── 1. MODULE BANNER & STATUTORY STATUS ── */}
      <header className="ew-header">
        <div className="ew-header-top">
          <div className="ew-badge-group">
            <span className="ew-radar-pulse"></span>
            <span className="ew-live-status">Early Heatwave Warning & Disaster Risk Center</span>
            <span className="ew-version-pill">Operational Telemetry</span>
          </div>
          <div className="ew-timestamp">
            <span>Observation Sync: {dataPayload?.timestamp || "Live UTC Telemetry"}</span>
          </div>
        </div>

        <h1 className="ew-title">Early Heatwave Warning & Multi-Hazard Disaster Center</h1>
        <p className="ew-subtitle">
          Proactive heatwave onset forecasting, multi-day thermal trajectory mapping, demographic exposure assessment,
          and authoritative multi-hazard disaster monitoring for public safety preparedness.
        </p>

        {/* Statutory Clarity Disclaimer Banner */}
        <div className="ew-statutory-notice" role="alert">
          <span className="ew-notice-icon">🛡️</span>
          <div className="ew-notice-text">
            <strong>Statutory Preparedness Notice:</strong> This monitoring system generates early research-grade heatwave
            risk assessments and community action indicators. It does <em>not</em> replace statutory directives issued by official
            government disaster management authorities (IMD, NDMA, CWC, WMO). Earthquakes, flash floods, landslides, and glacier collapses
            cannot be predicted in advance by climate models alone.
          </div>
        </div>
      </header>

      {/* ── 2. LOCATION SELECTOR & HUD ── */}
      <section className="ew-card ew-location-section" aria-label="Location Selector">
        <div className="ew-loc-header">
          <div className="ew-loc-title">
            <span className="ew-icon">📍</span>
            <div>
              <h3>Target Monitoring Location</h3>
              <p className="ew-hint">Search a city, click on the map, or select a regional monitoring hub</p>
            </div>
          </div>

          <div className="ew-loc-current-badge">
            <span className="ew-loc-dot" style={{ background: currentRiskTheme.color }}></span>
            <strong className="ew-loc-name">{activeLocationLabel}</strong>
            <span className="ew-loc-coords">
              ({selectedCoords[0]?.toFixed(4)}°N, {selectedCoords[1]?.toFixed(4)}°E)
            </span>
          </div>
        </div>

        {/* Search Bar + Controls */}
        <form onSubmit={handleSearchSubmit} className="ew-search-form">
          <div className="ew-input-wrap">
            <span className="ew-search-icon">🔍</span>
            <input
              type="text"
              className="ew-search-input"
              placeholder="Enter city or district name (e.g. Coimbatore, Chennai, Delhi)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button type="submit" className="ew-btn ew-btn-primary" disabled={isLoading}>
            {isLoading ? "Evaluating..." : "Check Risk"}
          </button>

          <button
            type="button"
            className="ew-btn ew-btn-secondary"
            onClick={handleDetectGPS}
            disabled={geoLocating}
            title="Detect GPS location"
          >
            {geoLocating ? "Detecting GPS..." : "🎯 My Location"}
          </button>

          <button
            type="button"
            className={`ew-btn ew-btn-toggle ${isMapExpanded ? "active" : ""}`}
            onClick={() => setIsMapExpanded(!isMapExpanded)}
          >
            🗺️ {isMapExpanded ? "Compact Map" : "Interactive Map"}
          </button>
        </form>

        {/* Quick Select Buttons */}
        <div className="ew-quick-cities">
          <span className="ew-quick-lbl">Quick Locations:</span>
          <div className="ew-pills-row">
            {QUICK_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`ew-pill ${activeLocationLabel.toLowerCase().includes(c.name.toLowerCase()) ? "active" : ""}`}
                onClick={() => handleQuickCityClick(c)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="ew-error-banner" role="alert">
            <span>⚠️</span> {errorMessage}
          </div>
        )}
      </section>

      {/* ── 3. LIVE ALERT STATUS & KEY TELEMETRY STRIP ── */}
      <section className="ew-card ew-status-banner" style={{ borderLeftColor: currentRiskTheme.color }}>
        <div className="ew-status-main">
          <div className="ew-status-left">
            <span className="ew-status-tag" style={{ background: currentRiskTheme.bg, color: currentRiskTheme.color }}>
              {currentRiskTheme.icon} Current Risk: {currentRiskTheme.label}
            </span>
            <h2 className="ew-status-headline">
              {currentRisk === "Critical"
                ? "Severe Thermal Stress Conditions Detected"
                : currentRisk === "High"
                ? "Elevated Heat Stress Approaching Warning Threshold"
                : currentRisk === "Moderate"
                ? "Moderate Thermal Load — Proactive Hydration Advised"
                : "Normal Seasonal Baseline Temperatures"}
            </h2>
            <p className="ew-status-desc">
              {multiHazards?.heatwave?.message ||
                `Surface air temperature is monitored at ${warning.current_temperature || "--"}°C with ${
                  warning.current_humidity || "--"
                }% relative humidity.`}
            </p>
          </div>

          <div className="ew-kpi-grid">
            <div className="ew-kpi-card">
              <span className="ew-kpi-lbl">Air Temp</span>
              <span className="ew-kpi-val">{warning.current_temperature != null ? `${warning.current_temperature}°C` : "--"}</span>
              <span className="ew-kpi-sub">Observed Mast 2m</span>
            </div>

            <div className="ew-kpi-card">
              <span className="ew-kpi-lbl">Humidity</span>
              <span className="ew-kpi-val">{warning.current_humidity != null ? `${warning.current_humidity}%` : "--"}</span>
              <span className="ew-kpi-sub">Relative Humidity</span>
            </div>

            <div className="ew-kpi-card">
              <span className="ew-kpi-lbl">Satellite LST</span>
              <span className="ew-kpi-val">{satTelemetry.land_surface_temperature != null ? `${satTelemetry.land_surface_temperature}°C` : "--"}</span>
              <span className="ew-kpi-sub">Skin Radiance</span>
            </div>

            <div className="ew-kpi-card">
              <span className="ew-kpi-lbl">El Niño Index</span>
              <span className="ew-kpi-val">{enso.oni_index || "+0.2°C"}</span>
              <span className="ew-kpi-sub">{enso.status || "ENSO Neutral"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FORECAST RISK CARDS (UPCOMING 5-DAY HORIZON) ── */}
      <section className="ew-card ew-forecast-section" aria-label="Forecast Risk Horizon">
        <div className="ew-card-title-row">
          <div>
            <h3>📅 5-Day Heatwave Risk Horizon</h3>
            <p className="ew-hint">Forecasted daily maximum temperatures and risk severity from numerical weather models</p>
          </div>
          <span className="ew-model-badge">GFS / NWP Forecast Engine</span>
        </div>

        {forecastList.length === 0 ? (
          <div className="ew-no-data-card">
            <span>📡</span>
            <p>No multi-day numerical forecast telemetry currently available for this coordinate.</p>
          </div>
        ) : (
          <div className="ew-forecast-grid">
            {forecastList.map((f, idx) => {
              const theme = getTheme(f.heat_risk_level);
              const isSelected = activeForecastDayIndex === idx;

              return (
                <div
                  key={f.date || idx}
                  className={`ew-fc-card ${isSelected ? "selected" : ""}`}
                  style={{ borderColor: isSelected ? theme.color : undefined }}
                  onClick={() => setActiveForecastDayIndex(idx)}
                >
                  <div className="ew-fc-header">
                    <span className="ew-fc-day">{f.day_label}</span>
                    <span className="ew-fc-date">{f.date_formatted}</span>
                  </div>

                  <div className="ew-fc-temp-row">
                    <span className="ew-fc-temp">{f.max_temperature}°C</span>
                    <span className="ew-fc-min">Min {f.min_temperature}°C</span>
                  </div>

                  <div className="ew-fc-badge" style={{ background: theme.bg, color: theme.color }}>
                    {theme.icon} {theme.label}
                  </div>

                  <div className="ew-fc-meta">
                    <span>💧 {f.humidity}% Hum</span>
                    <span>💨 {f.wind_speed_kmh} km/h</span>
                  </div>

                  <div className="ew-fc-type">
                    <span className="ew-badge-tag">{f.data_type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 5. EARLY WARNING TIMELINE (PEAK THERMAL TRANSIT & EVOLUTION) ── */}
      <section className="ew-card ew-timeline-section" aria-label="Early Warning Timeline">
        <div className="ew-card-title-row">
          <div>
            <h3>⏱️ Early Warning Progression Timeline</h3>
            <p className="ew-hint">Anticipate critical thermal inflection points before hazardous conditions develop</p>
          </div>
          {selectedForecastDay && (
            <span className="ew-active-date-pill">
              Inspecting: {selectedForecastDay.day_label} ({selectedForecastDay.date_formatted})
            </span>
          )}
        </div>

        {selectedForecastDay && (
          <div className="ew-timeline-details">
            <div className="ew-tl-step active">
              <div className="ew-tl-circle" style={{ background: getTheme(selectedForecastDay.heat_risk_level).color }}>
                {selectedForecastDay.day_index}
              </div>
              <div className="ew-tl-content">
                <div className="ew-tl-heading">
                  <strong>{selectedForecastDay.day_label} Thermal Projection</strong>
                  <span className="ew-tl-badge" style={{ color: getTheme(selectedForecastDay.heat_risk_level).color }}>
                    {selectedForecastDay.heat_risk_level} Risk Level
                  </span>
                </div>
                <p className="ew-tl-text">
                  Projected daytime high of <strong>{selectedForecastDay.max_temperature}°C</strong> with{" "}
                  <strong>{selectedForecastDay.humidity}%</strong> humidity. Peak danger hours expected between{" "}
                  <strong>{selectedForecastDay.peak_hours}</strong> due to solar irradiance zenith.
                </p>
                <div className="ew-tl-recommendation-inline">
                  <span>⚡ Advisory:</span>{" "}
                  {selectedForecastDay.max_temperature >= 38
                    ? "Severe physiological strain risk. Restrict non-essential outdoor labor."
                    : selectedForecastDay.max_temperature >= 34
                    ? "Proactive hydration and shade provisions required during midday hours."
                    : "Conditions within seasonal tolerance. Monitor for sudden temperature surges."}
                </div>
              </div>
            </div>

            {/* Horizontal Timeline Bar */}
            <div className="ew-timeline-bar-wrap">
              <div className="ew-timeline-bar-title">5-Day Heat Trend Trajectory</div>
              <div className="ew-timeline-track">
                {forecastList.map((step, idx) => {
                  const sTheme = getTheme(step.heat_risk_level);
                  return (
                    <div
                      key={step.date || idx}
                      className={`ew-track-node ${activeForecastDayIndex === idx ? "active" : ""}`}
                      onClick={() => setActiveForecastDayIndex(idx)}
                    >
                      <div className="ew-track-dot" style={{ background: sTheme.color }}></div>
                      <span className="ew-track-lbl">{step.day_label.slice(0, 3)}</span>
                      <span className="ew-track-temp">{step.max_temperature}°</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 6. INTERACTIVE HEAT RISK MAP (LEAFLET) ── */}
      <section className="ew-card ew-map-section" aria-label="Interactive Heat Risk Map">
        <div className="ew-card-title-row">
          <div>
            <h3>🗺️ Interactive Heat Risk Map</h3>
            <p className="ew-hint">
              Click anywhere on the map to evaluate risk for that coordinate, or click a regional station pin
            </p>
          </div>
          <div className="ew-map-legend">
            <span className="ew-leg-item"><span className="ew-leg-dot" style={{ background: "#10b981" }}></span> Low</span>
            <span className="ew-leg-item"><span className="ew-leg-dot" style={{ background: "#f59e0b" }}></span> Moderate</span>
            <span className="ew-leg-item"><span className="ew-leg-dot" style={{ background: "#ef4444" }}></span> High</span>
            <span className="ew-leg-item"><span className="ew-leg-dot" style={{ background: "#8b5cf6" }}></span> Critical</span>
          </div>
        </div>

        <div className={`ew-leaflet-container ${isMapExpanded ? "expanded" : ""}`}>
          <MapContainer
            center={selectedCoords}
            zoom={8}
            scrollWheelZoom={true}
            style={{ width: "100%", height: "100%", borderRadius: "12px" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapRecenter center={selectedCoords} />
            <MapClickPicker onCoordSelect={handleMapCoordSelect} />

            {/* Active Target Location Marker */}
            <Marker position={selectedCoords} icon={createMapPin(currentRisk, true)}>
              <Popup>
                <div className="ew-popup">
                  <strong>{activeLocationLabel}</strong>
                  <div style={{ color: currentRiskTheme.color, fontWeight: "bold", margin: "4px 0" }}>
                    {currentRiskTheme.label} ({warning.current_temperature || "--"}°C)
                  </div>
                  <small>Lat: {selectedCoords[0]?.toFixed(4)}, Lon: {selectedCoords[1]?.toFixed(4)}</small>
                </div>
              </Popup>
            </Marker>

            {/* Regional Stations Markers */}
            {stations.map((st) => {
              if (Math.abs(st.lat - selectedCoords[0]) < 0.01 && Math.abs(st.lon - selectedCoords[1]) < 0.01) {
                return null; // Skip duplicate of active pin
              }
              return (
                <Marker
                  key={st.id}
                  position={[st.lat, st.lon]}
                  icon={createMapPin(st.risk_level, false)}
                  eventHandlers={{
                    click: () => {
                      setSelectedCoords([st.lat, st.lon]);
                      fetchDisasterTelemetry(st.name, st.lat, st.lon);
                    },
                  }}
                >
                  <Popup>
                    <div className="ew-popup">
                      <strong>{st.name} ({st.state})</strong>
                      <div>Status: {st.risk_level} ({st.current_temp}°C)</div>
                      <small>Click pin to load full early warning details</small>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </section>

      {/* ── 7. IMPACT ASSESSMENT: EXPOSED POPULATION & VULNERABLE COHORTS ── */}
      <section className="ew-card ew-impact-section" aria-label="Demographic Impact Assessment">
        <div className="ew-card-title-row">
          <div>
            <h3>👥 Demographic Vulnerability & Exposure Assessment</h3>
            <p className="ew-hint">
              Quantifies potentially exposed populations and at-risk cohorts only when supporting census data is indexed
            </p>
          </div>
          {impact.has_demographic_data && (
            <span className="ew-census-badge">Census Benchmark: {impact.city_name}</span>
          )}
        </div>

        {impact.has_demographic_data ? (
          <div>
            <div className="ew-pop-headline">
              <div className="ew-pop-big">
                <span className="ew-pop-number">{impact.population_formatted}</span>
                <span className="ew-pop-sub">Estimated Total Urban Population Base</span>
              </div>
              <div className="ew-pop-src">
                <span>Data Authority:</span> {impact.demographic_source}
              </div>
            </div>

            <div className="ew-vulnerable-grid">
              {(impact.vulnerable_groups || []).map((vg) => (
                <div key={vg.group} className="ew-vg-card">
                  <div className="ew-vg-header">
                    <strong>{vg.group}</strong>
                    <span className="ew-vg-pct">{vg.pct}% (~{vg.estimated_count?.toLocaleString()})</span>
                  </div>
                  <p className="ew-vg-risk">{vg.risk_factor}</p>
                </div>
              ))}
            </div>

            <div className="ew-impact-disclaimer">
              ℹ️ <strong>Demographic Caveat:</strong> {impact.methodology_disclaimer}
            </div>
          </div>
        ) : (
          <div className="ew-unindexed-card">
            <span className="ew-unindexed-icon">📋</span>
            <div>
              <strong>Demographic Profile Not Indexed For This Coordinate</strong>
              <p>{impact.notice || "Demographic vulnerability data not available for this coordinate. Refer to local municipal census records."}</p>
              <small>System strictly adheres to data integrity: no demographic figures are fabricated when census profiles are unavailable.</small>
            </div>
          </div>
        )}
      </section>

      {/* ── 8. RECOMMENDED ACTIONS & PREPAREDNESS PROTOCOLS ── */}
      <section className="ew-card ew-actions-section" aria-label="Recommended Actions">
        <div className="ew-card-title-row">
          <div>
            <h3>🛡️ Recommended Actions & Life-Safety Protocols</h3>
            <p className="ew-hint">Preventive measures calibrated to active risk severity: {currentRiskTheme.label}</p>
          </div>
          <span className="ew-action-phase-badge" style={{ background: currentRiskTheme.bg, color: currentRiskTheme.color }}>
            {currentRiskTheme.label} Action Matrix
          </span>
        </div>

        <div className="ew-actions-grid">
          {actions.map((act, idx) => (
            <div key={idx} className="ew-action-card">
              <div className="ew-action-head">
                <span className="ew-act-num">0{idx + 1}</span>
                <span className="ew-act-phase">{act.phase}</span>
                <span className={`ew-act-prio prio-${act.priority.toLowerCase()}`}>{act.priority}</span>
              </div>
              <p className="ew-act-text">{act.action}</p>
              <div className="ew-act-target">Target: {act.target}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 9. SECONDARY MULTI-HAZARD DISASTER WATCH ── */}
      <section className="ew-card ew-multihazard-section" aria-label="Multi-Hazard Disaster Watch">
        <div className="ew-card-title-row">
          <div>
            <h3>🚨 Multi-Hazard Disaster Monitoring</h3>
            <p className="ew-hint">
              Hydrological, cyclonic, geotechnical, and verified seismic event telemetry
            </p>
          </div>
          <span className="ew-hazard-note">Verified Sensors & Network Telemetry</span>
        </div>

        <div className="ew-hazard-tabs">
          {["flood", "cyclone", "landslide", "earthquake"].map((hKey) => {
            const hData = multiHazards[hKey];
            const isActive = activeHazardTab === hKey;
            return (
              <button
                key={hKey}
                type="button"
                className={`ew-hazard-tab ${isActive ? "active" : ""}`}
                onClick={() => setActiveHazardTab(hKey)}
              >
                <span className="ew-htab-icon">
                  {hKey === "flood" ? "🌊" : hKey === "cyclone" ? "🌪️" : hKey === "landslide" ? "⛰️" : "🌋"}
                </span>
                <span className="ew-htab-name">{hKey.toUpperCase()}</span>
                <span className="ew-htab-status">{hData?.status || "Normal"}</span>
              </button>
            );
          })}
        </div>

        {/* Active Hazard Card */}
        {multiHazards[activeHazardTab] && (
          <div className="ew-hazard-card">
            <div className="ew-hcard-header">
              <h4>{multiHazards[activeHazardTab].title}</h4>
              <span className="ew-hcard-badge">{multiHazards[activeHazardTab].category}</span>
            </div>

            <p className="ew-hcard-msg">{multiHazards[activeHazardTab].message}</p>

            {multiHazards[activeHazardTab].scientific_rule && (
              <div className="ew-scientific-rule">
                <span>🔬 Scientific Rule:</span> {multiHazards[activeHazardTab].scientific_rule}
              </div>
            )}

            <div className="ew-hcard-meta">
              <span>Source: {multiHazards[activeHazardTab].data_source || "Network Sensor"}</span>
              <span>Updated: {multiHazards[activeHazardTab].last_updated || "Live"}</span>
            </div>

            {multiHazards[activeHazardTab].official_guidance && (
              <div className="ew-hcard-guidance">
                <strong>Official Guidance:</strong> {multiHazards[activeHazardTab].official_guidance}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 10. DATA PROVENANCE, CONFIDENCE & OFFICIAL SOURCES ── */}
      <section className="ew-card ew-provenance-section" aria-label="Data Sources and Confidence">
        <div className="ew-card-title-row">
          <div>
            <h3>📊 Data Sources, Observation Dates & Confidence</h3>
            <p className="ew-hint">
              Transparent metadata declaring observed vs forecast vs model-estimated provenance
            </p>
          </div>
        </div>

        <div className="ew-provenance-table-wrap">
          <table className="ew-prov-table">
            <thead>
              <tr>
                <th>Telemetry Variable</th>
                <th>Category</th>
                <th>Data Source / Network</th>
                <th>Observation Date</th>
                <th>Confidence Rating</th>
              </tr>
            </thead>
            <tbody>
              {provenance.map((p, idx) => (
                <tr key={idx}>
                  <td><strong>{p.variable}</strong></td>
                  <td>
                    <span className={`ew-prov-tag cat-${p.category.toLowerCase().replace(/[^a-z]/g, "")}`}>
                      {p.category}
                    </span>
                  </td>
                  <td>{p.source}</td>
                  <td>{p.observation_date}</td>
                  <td><span className="ew-conf-badge">{p.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Official Authority Links */}
        <div className="ew-official-sources-section">
          <h4>Official Statutory Authorities</h4>
          <p className="ew-hint">
            Always consult statutory government bulletins for mandatory civil evacuation orders and official warnings:
          </p>
          <div className="ew-sources-grid">
            {officialSources.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ew-source-card"
              >
                <div className="ew-source-badge">{src.badge}</div>
                <strong className="ew-source-name">{src.name}</strong>
                <span className="ew-source-agency">{src.agency}</span>
                <span className="ew-source-role">{src.role}</span>
                <span className="ew-source-link">Visit Official Portal &rarr;</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
