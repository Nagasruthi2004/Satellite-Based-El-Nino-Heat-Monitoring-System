import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import YearSelector from "./YearSelector";
import "./IndiaLSTMap.css";

const BACKEND_URL = "http://127.0.0.1:5000/india-lst";
const INDIA_CENTER = [22.8, 82.0];
const INDIA_ZOOM = 4.8;
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

const RISK_COLORS = {
  high: "#dc2626",
  moderate: "#d97706",
  medium: "#d97706",
  low: "#16a34a",
};

function getRiskColor(risk) {
  return RISK_COLORS[(risk || "").toLowerCase()] || "#1565C0";
}

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

export default function IndiaLSTMap() {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    async function fetchYearData() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${BACKEND_URL}?year=${selectedYear}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Data unavailable for year ${selectedYear}`);
        }
        if (isMounted) {
          setApiData(json);
        }
      } catch (err) {
        console.error(`Failed to fetch India LST for year ${selectedYear}:`, err);
        if (isMounted) {
          setApiData(null);
          setError(err.message || "Data unavailable");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchYearData();
    return () => {
      isMounted = false;
    };
  }, [selectedYear]);

  const records = useMemo(() => apiData?.data || [], [apiData]);
  const count = apiData?.count ?? 0;
  const averageLst = apiData?.average_lst != null ? `${Number(apiData.average_lst).toFixed(2)}°C` : "—";
  const highestLst = apiData?.highest_lst;
  const lowestLst = apiData?.lowest_lst;
  const riskDist = apiData?.risk_distribution || {};

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const matchSearch = item.state.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchRisk =
        riskFilter === "all" ||
        item.heat_risk.toLowerCase() === riskFilter.toLowerCase();
      return matchSearch && matchRisk;
    });
  }, [records, searchQuery, riskFilter]);

  return (
    <div className="india-lst-container" id="india-lst-module">
      {/* ── HEADER WITH YEAR SELECTOR ── */}
      <header className="india-lst-header-card">
        <div className="india-lst-title-block">
          <div className="india-lst-eyebrow">
            <span>🗺️</span> India LST Annual Heat Map
          </div>
          <h2 className="india-lst-title">India Land Surface Temperature (2020–2025)</h2>
          <p className="india-lst-subtitle">
            Historical MODIS Land Surface Temperature (LST) observations across 34 Indian States & Union Territories.
            Select any year from 2020 to 2025 to visualize verified state-wise thermal distributions.
          </p>
        </div>

        {/* Reusable Year Selector */}
        <YearSelector
          years={YEARS}
          selectedYear={selectedYear}
          onChange={(yr) => setSelectedYear(yr)}
          disabled={loading}
        />
      </header>

      {/* ── ERROR / DATA UNAVAILABLE NOTICE ── */}
      {error && !loading && (
        <div className="india-data-empty-card" role="alert">
          <span>⚠️ {error}</span>
          <p style={{ marginTop: "6px", fontSize: "12px" }}>
            The selected year does not contain verified records in the local dataset.
          </p>
        </div>
      )}

      {/* ── SUMMARY METRICS CARDS ── */}
      <section className="india-lst-metrics-grid" aria-label="India LST Year Summary Metrics">
        {/* 1. Selected Year */}
        <div className="metric-card" id="metric-selected-year">
          <div className="metric-card-top">
            <span className="metric-label">Selected Year</span>
            <span className="metric-icon">📅</span>
          </div>
          <div className="metric-val">{selectedYear}</div>
          <div className="metric-sub">
            Dataset: <strong>{apiData?.source_file || `India_LST_${selectedYear}.csv`}</strong>
          </div>
        </div>

        {/* 2. Average LST */}
        <div className="metric-card" id="metric-avg-lst">
          <div className="metric-card-top">
            <span className="metric-label">Average LST</span>
            <span className="metric-icon">🌡️</span>
          </div>
          <div className="metric-val">{loading ? "..." : averageLst}</div>
          <div className="metric-sub">National annual mean across all states</div>
        </div>

        {/* 3. Highest LST */}
        <div className="metric-card" id="metric-highest-lst">
          <div className="metric-card-top">
            <span className="metric-label">Highest LST</span>
            <span className="metric-icon">🔥</span>
          </div>
          <div className="metric-val">
            {loading ? "..." : highestLst ? `${Number(highestLst.lst_celsius).toFixed(2)}°C` : "—"}
          </div>
          <div className="metric-sub">
            {highestLst ? (
              <>
                <strong>{highestLst.state}</strong> ({highestLst.heat_risk})
              </>
            ) : (
              "Data unavailable"
            )}
          </div>
        </div>

        {/* 4. Lowest LST */}
        <div className="metric-card" id="metric-lowest-lst">
          <div className="metric-card-top">
            <span className="metric-label">Lowest LST</span>
            <span className="metric-icon">❄️</span>
          </div>
          <div className="metric-val">
            {loading ? "..." : lowestLst ? `${Number(lowestLst.lst_celsius).toFixed(2)}°C` : "—"}
          </div>
          <div className="metric-sub">
            {lowestLst ? (
              <>
                <strong>{lowestLst.state}</strong> ({lowestLst.heat_risk})
              </>
            ) : (
              "Data unavailable"
            )}
          </div>
        </div>

        {/* 5. States Available */}
        <div className="metric-card" id="metric-states-count">
          <div className="metric-card-top">
            <span className="metric-label">Coverage</span>
            <span className="metric-icon">🏛️</span>
          </div>
          <div className="metric-val">{loading ? "..." : count}</div>
          <div className="metric-sub">States & Union Territories</div>
        </div>

        {/* 6. Heat Risk Distribution */}
        <div className="metric-card" id="metric-risk-dist">
          <div className="metric-card-top">
            <span className="metric-label">Risk Distribution</span>
            <span className="metric-icon">📊</span>
          </div>
          <div className="risk-pills-wrap">
            <span className="risk-pill-count low" title="Low risk states (<30°C)">
              Low: {loading ? "—" : riskDist.Low ?? 0}
            </span>
            <span className="risk-pill-count moderate" title="Moderate risk states (30-35°C)">
              Moderate: {loading ? "—" : (riskDist.Moderate ?? riskDist.Medium ?? 0)}
            </span>
            <span className="risk-pill-count high" title="High risk states (>=35°C)">
              High: {loading ? "—" : riskDist.High ?? 0}
            </span>
          </div>
          <div className="metric-sub">Classified by project thermal criteria</div>
        </div>
      </section>

      {/* ── INTERACTIVE INDIA HEAT MAP ── */}
      <section className="india-map-container-card" aria-label="Interactive India Heat Map">
        <div className="india-map-header-row">
          <h3>
            <span>🛰️</span>
            <span>India LST Geospatial Visualization ({selectedYear})</span>
          </h3>

          <div className="india-map-legend">
            <span className="legend-item">
              <span className="legend-dot low" />
              <span>Low (&lt; 30°C)</span>
            </span>
            <span className="legend-item">
              <span className="legend-dot moderate" />
              <span>Moderate (30°C – 35°C)</span>
            </span>
            <span className="legend-item">
              <span className="legend-dot high" />
              <span>High (&ge; 35°C)</span>
            </span>
          </div>
        </div>

        <div className="india-leaflet-map-wrapper">
          <MapContainer
            center={INDIA_CENTER}
            zoom={INDIA_ZOOM}
            scrollWheelZoom={false}
            className="india-leaflet-map"
          >
            <MapResizeHandler />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {records.map((rec) => {
              const color = getRiskColor(rec.heat_risk);
              const radius = Math.max(7, Math.min(18, (rec.lst_celsius - 8) * 0.5));

              return (
                <CircleMarker
                  key={`${rec.state}-${selectedYear}`}
                  center={[rec.latitude, rec.longitude]}
                  radius={radius}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.65,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                    <strong>{rec.state}</strong>: {rec.lst_celsius}°C ({rec.heat_risk})
                  </Tooltip>
                  <Popup>
                    <div style={{ fontSize: "13px", padding: "4px" }}>
                      <h4 style={{ margin: "0 0 4px 0", color: "var(--text, #172033)" }}>{rec.state}</h4>
                      <p style={{ margin: "0 0 2px 0" }}>
                        Year: <strong>{selectedYear}</strong>
                      </p>
                      <p style={{ margin: "0 0 4px 0" }}>
                        Average LST: <strong>{rec.lst_celsius}°C</strong>
                      </p>
                      <span
                        className={`heat-risk-tag ${rec.heat_risk.toLowerCase()}`}
                        style={{ display: "inline-block" }}
                      >
                        {rec.heat_risk} Risk
                      </span>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </section>

      {/* ── STATE-WISE DATASET TABLE ── */}
      <section className="india-table-card" aria-label="State-wise LST Dataset Table">
        <div className="india-table-header-controls">
          <div className="india-table-title-group">
            <h3>State-Wise LST Observations ({selectedYear})</h3>
            <p>
              Showing {filteredRecords.length} of {count} states & UTs from verified dataset
            </p>
          </div>

          <div className="india-table-tools">
            <input
              type="text"
              className="table-search-input"
              placeholder="Search state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search states"
            />

            <div className="table-filter-pills" role="group" aria-label="Filter by Heat Risk">
              {["all", "High", "Moderate", "Low"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`table-filter-btn ${riskFilter === lvl ? "active" : ""}`}
                  onClick={() => setRiskFilter(lvl)}
                >
                  {lvl === "all" ? "All Risks" : lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="india-data-empty-card">Loading {selectedYear} India LST dataset...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="india-data-empty-card">
            No states found matching &quot;{searchQuery}&quot; for year {selectedYear}.
          </div>
        ) : (
          <div className="india-table-wrap">
            <table className="india-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>State / Union Territory</th>
                  <th>Year</th>
                  <th>Average LST (°C)</th>
                  <th>Heat Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row, idx) => (
                  <tr key={row.state}>
                    <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                    <td className="state-cell">{row.state}</td>
                    <td>{row.year}</td>
                    <td className="temp-cell">{row.lst_celsius.toFixed(2)}°C</td>
                    <td>
                      <span className={`heat-risk-tag ${row.heat_risk.toLowerCase()}`}>
                        {row.heat_risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
