import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./WorldHeatMap.css";

const BACKEND_URL = "http://127.0.0.1:5000/world-heatmap";

// Full World View: centered on tropical / equatorial latitude, prime meridian
const WORLD_CENTER = [20.0, 10.0];
const WORLD_ZOOM = 2;

// Standardized Risk Colors
const RISK_COLORS = {
  critical: "#dc2626", // Red (>= 40°C)
  high:     "#ea580c", // Orange-Red (35-40°C)
  medium:   "#d97706", // Amber / Warm Orange (30-35°C)
  low:      "#16a34a", // Green (< 30°C)
};

function getRiskColor(heatRisk) {
  return RISK_COLORS[(heatRisk || "").toLowerCase()] || "#1565C0";
}

// Controller to smoothly center/zoom when targetCoords change
function MapRecenter({ targetCoords }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords && targetCoords.length >= 2) {
      const zoom = targetCoords[2] || Math.max(map.getZoom(), 8);
      map.setView([targetCoords[0], targetCoords[1]], zoom, { animate: true });
    }
  }, [targetCoords, map]);
  return null;
}

// Ensures Leaflet recalculates tile dimensions when component mounts or resizes
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);
  return null;
}

export default function WorldHeatMap() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [filterRisk, setFilterRisk] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [targetCoords, setTargetCoords] = useState(null);

  // Fetch real dataset from backend GET /world-heatmap
  useEffect(() => {
    let isMounted = true;
    async function fetchWorldHeatmap() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(BACKEND_URL);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: Failed to load World Heat Map`);
        }
        const json = await res.json();
        const records = Array.isArray(json) ? json : (json.data || json.records || []);
        if (isMounted) {
          setData(records);
          if (records.length > 0) {
            // Select highest temp record for details display without changing map center away from world view
            const highestTempRecord = [...records].sort((a, b) => b.lst_celsius - a.lst_celsius)[0];
            setSelectedLocation(highestTempRecord || records[0]);
          }
        }
      } catch (err) {
        console.error("Error fetching /world-heatmap:", err);
        if (isMounted) {
          setError(err.message || "Failed to connect to backend World Heat Map endpoint.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchWorldHeatmap();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesRisk =
        filterRisk === "all" ||
        item.heat_risk.toLowerCase() === filterRisk.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.country.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRisk && matchesSearch;
    });
  }, [data, filterRisk, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    if (!data.length) return null;
    const temps = data.map((d) => d.lst_celsius);
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    data.forEach((d) => {
      const k = (d.heat_risk || "").toLowerCase();
      if (counts[k] !== undefined) counts[k]++;
    });
    return {
      total: data.length,
      min: Math.min(...temps),
      max: Math.max(...temps),
      mean: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      counts,
    };
  }, [data]);

  // Select location and pan/zoom to it
  const handleSelectLocation = (loc) => {
    setSelectedLocation(loc);
    setTargetCoords([loc.latitude, loc.longitude, 8]);
  };

  // Reset back to whole world view
  const handleResetWorldView = () => {
    setTargetCoords([WORLD_CENTER[0], WORLD_CENTER[1], WORLD_ZOOM]);
  };

  return (
    <div className="world-heatmap-container">
      {/* ── COMPACT HEADER & STATS ── */}
      <div className="world-heatmap-header">
        <div className="world-heatmap-title-row">
          <div>
            <h2>🌍 World Heat Map</h2>
            <p className="world-heatmap-subtitle">
              Global Land Surface Temperature (LST) monitoring based on official{" "}
              <strong>NASA MODIS Terra MOD11A2.061</strong> satellite observations (8-day composite, 1km spatial resolution).
            </p>
          </div>
          <div className="world-heatmap-badges">
            <span className="world-badge brand">🛰️ MODIS Terra MOD11A2.061</span>
            <span className="world-badge">🌡️ LST_Day_1km</span>
            <span className="world-badge">📍 Tile h25v07 (South & Central India)</span>
            <span className="world-badge">🔬 65 Real Ground Records</span>
          </div>
        </div>

        {/* ── STATS ROW ── */}
        {stats && (
          <div className="world-heatmap-stats-grid">
            <div className="world-stat-card">
              <span className="stat-label">Total Observations</span>
              <span className="stat-value">{stats.total} Points</span>
              <span className="stat-sub">Physical MODIS Ground Samples</span>
            </div>
            <div className="world-stat-card">
              <span className="stat-label">Maximum LST</span>
              <span className="stat-value" style={{ color: "#dc2626" }}>
                {stats.max}°C
              </span>
              <span className="stat-sub">Usilampatti North (Critical)</span>
            </div>
            <div className="world-stat-card">
              <span className="stat-label">Average LST</span>
              <span className="stat-value" style={{ color: "#d97706" }}>
                {stats.mean}°C
              </span>
              <span className="stat-sub">Across All Valid Pixels</span>
            </div>
            <div className="world-stat-card">
              <span className="stat-label">Minimum LST</span>
              <span className="stat-value" style={{ color: "#16a34a" }}>
                {stats.min}°C
              </span>
              <span className="stat-sub">Coonoor (Nilgiris Hill Station)</span>
            </div>
          </div>
        )}
      </div>

      {/* ── CONTROLS & FILTERS BAR ── */}
      <div className="world-controls-bar">
        <div className="world-filter-group">
          <span className="filter-group-label">Filter:</span>
          <button
            type="button"
            className={`filter-chip ${filterRisk === "all" ? "active" : ""}`}
            onClick={() => setFilterRisk("all")}
          >
            All ({data.length})
          </button>
          <button
            type="button"
            className={`filter-chip critical ${filterRisk === "critical" ? "active" : ""}`}
            onClick={() => setFilterRisk("critical")}
          >
            Critical ({stats?.counts.critical || 0})
          </button>
          <button
            type="button"
            className={`filter-chip high ${filterRisk === "high" ? "active" : ""}`}
            onClick={() => setFilterRisk("high")}
          >
            High ({stats?.counts.high || 0})
          </button>
          <button
            type="button"
            className={`filter-chip medium ${filterRisk === "medium" ? "active" : ""}`}
            onClick={() => setFilterRisk("medium")}
          >
            Medium ({stats?.counts.medium || 0})
          </button>
          <button
            type="button"
            className={`filter-chip low ${filterRisk === "low" ? "active" : ""}`}
            onClick={() => setFilterRisk("low")}
          >
            Low ({stats?.counts.low || 0})
          </button>
        </div>

        <div className="world-controls-right">
          <button
            type="button"
            className="world-view-btn"
            onClick={handleResetWorldView}
            title="Reset map view to show the entire world"
          >
            🌍 Reset to World View
          </button>
          <input
            type="text"
            className="world-search-input"
            placeholder="🔍 Search location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── MAIN CONTENT: MAP + SIDE INSPECTOR ── */}
      {loading ? (
        <div className="world-location-card" style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ fontSize: "15px", color: "var(--text-muted)" }}>
            ⏳ Loading real NASA MODIS Terra LST data from Flask backend (/world-heatmap)...
          </p>
        </div>
      ) : error ? (
        <div className="world-location-card" style={{ borderLeft: "4px solid #dc2626" }}>
          <h3 style={{ color: "#dc2626", margin: "0 0 8px 0" }}>⚠️ Backend Connection Error</h3>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>{error}</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "13px" }}>
            Make sure the Flask server is running on <code>http://127.0.0.1:5000</code>.
          </p>
        </div>
      ) : (
        <div className="world-main-grid">
          {/* ── LEFT COLUMN: FULL WORLD MAP VIEWPORT ── */}
          <div className="world-map-wrapper">
            <MapContainer
              center={WORLD_CENTER}
              zoom={WORLD_ZOOM}
              minZoom={2}
              maxZoom={16}
              zoomControl={true}
              dragging={true}
              scrollWheelZoom={true}
              doubleClickZoom={true}
              touchZoom={true}
              boxZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <MapResizeHandler />
              <MapRecenter targetCoords={targetCoords} />

              {/* Standard Esri World Street Map with English Global Labels */}
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; NASA LP DAAC MODIS MOD11A2.061"
                url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                minZoom={2}
                maxZoom={16}
              />

              {/* Plot all 65 Real Observations */}
              {filteredData.map((item) => {
                const isSelected = selectedLocation?.location === item.location;
                const riskColor = getRiskColor(item.heat_risk);

                return (
                  <CircleMarker
                    key={item.location}
                    center={[item.latitude, item.longitude]}
                    radius={isSelected ? 13 : 8}
                    pathOptions={{
                      fillColor: riskColor,
                      color: isSelected ? "#ffffff" : "#ffffff",
                      weight: isSelected ? 3 : 1.5,
                      opacity: 1,
                      fillOpacity: isSelected ? 0.95 : 0.85,
                    }}
                    eventHandlers={{
                      click: () => handleSelectLocation(item),
                    }}
                  >
                    {/* Hover Requirement: Location, LST in °C, Heat Risk */}
                    <Tooltip
                      direction="top"
                      offset={[0, -10]}
                      opacity={0.96}
                      className="world-tooltip"
                    >
                      <div style={{ textAlign: "center", lineHeight: "1.4" }}>
                        <div style={{ fontWeight: "700", fontSize: "13px" }}>
                          📍 {item.location}
                        </div>
                        <div style={{ color: "#fef08a", fontWeight: "700", fontSize: "14px" }}>
                          🌡️ {item.lst_celsius}°C
                        </div>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          🔥 Heat Risk: <strong>{item.heat_risk}</strong>
                        </div>
                      </div>
                    </Tooltip>

                    {/* Click Requirement: Location Details Popup */}
                    <Popup>
                      <div style={{ padding: "4px", minWidth: "160px" }}>
                        <h4 style={{ margin: "0 0 4px 0", fontSize: "15px" }}>
                          {item.location}, {item.country}
                        </h4>
                        <div style={{ fontSize: "13px", margin: "4px 0" }}>
                          <strong>LST:</strong> {item.lst_celsius}°C ({(item.lst_celsius + 273.15).toFixed(2)} K)
                        </div>
                        <div style={{ fontSize: "13px", margin: "4px 0" }}>
                          <strong>Heat Risk:</strong>{" "}
                          <span style={{ color: riskColor, fontWeight: "700" }}>
                            {item.heat_risk}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                          Coordinates: {item.latitude}°, {item.longitude}°
                        </div>
                        <div style={{ fontSize: "11px", color: "#666" }}>
                          Source: NASA Terra MOD11A2.061 ({item.year})
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Floating Top-Right View Reset Button */}
            <button
              type="button"
              className="world-map-floating-btn"
              onClick={handleResetWorldView}
              title="Show entire world"
            >
              🌍 World View
            </button>

            {/* Map Legend */}
            <div className="world-map-legend">
              <span className="legend-title">LST Heat Risk</span>
              <div className="legend-item">
                <span className="legend-color-dot" style={{ background: "#dc2626" }} />
                <span>Critical (&ge; 40.0°C)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color-dot" style={{ background: "#ea580c" }} />
                <span>High (35.0 - 39.9°C)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color-dot" style={{ background: "#d97706" }} />
                <span>Medium (30.0 - 34.9°C)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color-dot" style={{ background: "#16a34a" }} />
                <span>Low (&lt; 30.0°C)</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: SIDE INSPECTION PANEL & EXPLORER ── */}
          <div className="world-side-panel">
            {/* Selected Location Card */}
            {selectedLocation && (
              <div className="world-location-card">
                <div className="location-card-header">
                  <div>
                    <h3 className="location-name">{selectedLocation.location}</h3>
                    <p className="location-country">{selectedLocation.country}</p>
                  </div>
                  <span className={`risk-tag ${(selectedLocation.heat_risk || "").toLowerCase()}`}>
                    {selectedLocation.heat_risk} Risk
                  </span>
                </div>

                <div className="location-temp-box">
                  <span className="temp-primary">{selectedLocation.lst_celsius}°C</span>
                  <span className="temp-secondary">
                    {(selectedLocation.lst_celsius + 273.15).toFixed(2)} K • Land Surface Temp
                  </span>
                </div>

                <div className="location-meta-grid">
                  <div className="meta-item">
                    <div className="meta-item-label">Latitude</div>
                    <div className="meta-item-value">{selectedLocation.latitude}° N</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-item-label">Longitude</div>
                    <div className="meta-item-value">{selectedLocation.longitude}° E</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-item-label">Observation Year</div>
                    <div className="meta-item-value">{selectedLocation.year} (Day 225)</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-item-label">Satellite Sensor</div>
                    <div className="meta-item-value">MODIS Terra</div>
                  </div>
                </div>

                {/* Risk Advice Box */}
                <div className={`location-advice-box ${(selectedLocation.heat_risk || "").toLowerCase()}`}>
                  {selectedLocation.heat_risk === "Critical" && (
                    <>
                      <strong>⚠️ Severe Heat Hazard (&ge;40°C):</strong> Extreme land surface temperature
                      recorded. High risk of heatstroke, severe urban heat island effect, and thermal stress.
                      Avoid outdoor exposure during peak sun hours.
                    </>
                  )}
                  {selectedLocation.heat_risk === "High" && (
                    <>
                      <strong>🔥 High Heat Warning (35-40°C):</strong> Elevated thermal conditions. Ensure
                      adequate hydration, shade availability, and caution for vulnerable populations.
                    </>
                  )}
                  {selectedLocation.heat_risk === "Medium" && (
                    <>
                      <strong>🟡 Moderate Thermal Conditions (30-35°C):</strong> Typical warm monsoon/summer
                      temperatures. Moderate heat stress during afternoon hours.
                    </>
                  )}
                  {selectedLocation.heat_risk === "Low" && (
                    <>
                      <strong>🟢 Low Thermal Risk (&lt;30°C):</strong> Comfortable or cooler hill terrain.
                      Minimal heat stress.
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Location Explorer List */}
            <div className="world-explorer-card">
              <div className="explorer-header">
                <span>📍 Location Explorer</span>
                <span className="explorer-count">
                  {filteredData.length} locations
                </span>
              </div>

              <div className="explorer-scroll-list">
                {filteredData.map((item) => {
                  const isSelected = selectedLocation?.location === item.location;
                  const color = getRiskColor(item.heat_risk);
                  return (
                    <div
                      key={item.location}
                      className={`explorer-row ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectLocation(item)}
                    >
                      <span className="explorer-row-name">{item.location}</span>
                      <span className="explorer-row-temp" style={{ color }}>
                        {item.lst_celsius}°C
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: color,
                            display: "inline-block",
                          }}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
