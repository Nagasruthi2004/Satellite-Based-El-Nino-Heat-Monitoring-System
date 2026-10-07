import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import YearSelector from "./YearSelector";
import "./IndiaLSTMap.css";

const BACKEND_URL = "http://127.0.0.1:5000/india-lst";
const INDIA_CENTER = [22.8, 82.0];
const INDIA_ZOOM = 4.8;
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

const RISK_COLORS = {
  critical: "#991b1b",
  high: "#dc2626",
  moderate: "#d97706",
  medium: "#d97706",
  low: "#16a34a",
};

function getIndiaHeatRisk(lst) {
  const val = Number(lst);
  if (!Number.isFinite(val)) return "Low";
  if (val < 30) return "Low";
  if (val < 36) return "Moderate";
  if (val < 40) return "High";
  return "Critical";
}

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
        let json;
        if (selectedYear === 2026) {
          const [predictionResponse, locationResponse] = await Promise.all([
            fetch("http://127.0.0.1:5000/heat-2026-prediction"),
            fetch(`${BACKEND_URL}?year=2025`),
          ]);
          const [predictionData, locationData] = await Promise.all([
            predictionResponse.json(),
            locationResponse.json(),
          ]);
          if (!predictionResponse.ok || predictionData.status !== "success") {
            throw new Error(predictionData.error || "2026 model estimates are unavailable.");
          }
          if (!locationResponse.ok) {
            throw new Error("State locations required for the 2026 map are unavailable.");
          }

          const locationsByState = new Map(
            (locationData.data || []).map((record) => [record.state, record])
          );
          const predictedRecords = (predictionData.states || []).map((prediction) => {
            const location = locationsByState.get(prediction.state);
            const rawLst = prediction.predicted_2026_lst;
            if (!location || rawLst == null || rawLst === "" || !Number.isFinite(Number(rawLst))) return null;
            return {
              state: prediction.state,
              year: 2026,
              lst_celsius: Number(rawLst),
              latitude: location.latitude,
              longitude: location.longitude,
            };
          }).filter(Boolean);

          if (!predictedRecords.length) {
            throw new Error("2026 model estimates are unavailable for the state map.");
          }

          json = {
            status: "success",
            year: 2026,
            count: predictedRecords.length,
            average_lst: predictionData.summary?.predicted_national_average_lst ?? Number((
              predictedRecords.reduce((total, record) => total + record.lst_celsius, 0) / predictedRecords.length
            ).toFixed(2)),
            source_file: "Model-estimated 2026 LST (not observed)",
            data: predictedRecords,
          };
        } else {
          const res = await fetch(`${BACKEND_URL}?year=${selectedYear}`);
          json = await res.json();
          if (!res.ok) {
            throw new Error(json.error || `Data unavailable for year ${selectedYear}`);
          }
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

  const records = useMemo(() => {
    const raw = apiData?.data || [];
    return raw.map((item) => ({
      ...item,
      heat_risk: getIndiaHeatRisk(item.lst_celsius),
    }));
  }, [apiData]);

  const count = apiData?.count ?? records.length;
  const averageLst = apiData?.average_lst != null ? `${Number(apiData.average_lst).toFixed(2)}°C` : "—";

  const highestLst = useMemo(() => {
    if (!records.length) return null;
    return records.reduce((max, cur) => (cur.lst_celsius > max.lst_celsius ? cur : max), records[0]);
  }, [records]);

  const lowestLst = useMemo(() => {
    if (!records.length) return null;
    return records.reduce((min, cur) => (cur.lst_celsius < min.lst_celsius ? cur : min), records[0]);
  }, [records]);

  const riskDist = useMemo(() => {
    const dist = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    for (const r of records) {
      if (dist[r.heat_risk] !== undefined) {
        dist[r.heat_risk] += 1;
      }
    }
    return dist;
  }, [records]);

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
          <h2 className="india-lst-title">India Land Surface Temperature (2020–2026)</h2>
          <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
            <span style={{ background: "var(--surface-alt)", padding: "3px 10px", borderRadius: "12px", border: "1px solid var(--border)" }}>
              📊 <strong>Data Source:</strong> Historical observations (2020–2025) and model-estimated 2026 (not observed)
            </span>
            <span style={{ background: "var(--surface-alt)", padding: "3px 10px", borderRadius: "12px", border: "1px solid var(--border)" }}>
              🔬 <strong>Scientific Note:</strong> Land Surface Temperature (LST) measures radiative skin temperature and differs from ambient 2m air temperature.
            </span>
          </div>
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
            {selectedYear === 2026
              ? "2026 model-estimated LST data is unavailable; no observed 2026 dataset is available."
              : "The selected year does not contain verified records in the local dataset."}
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
            <span className="risk-pill-count moderate" title="Moderate risk states (30°C – 36°C)">
              Moderate: {loading ? "—" : riskDist.Moderate ?? 0}
            </span>
            <span className="risk-pill-count high" title="High risk states (36°C – 40°C)">
              High: {loading ? "—" : riskDist.High ?? 0}
            </span>
            <span className="risk-pill-count critical" title="Critical risk states (>=40°C)">
              Critical: {loading ? "—" : riskDist.Critical ?? 0}
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
              <span>Moderate (30°C – 36°C)</span>
            </span>
            <span className="legend-item">
              <span className="legend-dot high" />
              <span>High (36°C – 40°C)</span>
            </span>
            <span className="legend-item">
              <span className="legend-dot critical" />
              <span>Critical (&ge; 40°C)</span>
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
            <h3>State-Wise LST {selectedYear === 2026 ? "Estimates" : "Observations"} ({selectedYear})</h3>
            <p>
              Showing {filteredRecords.length} of {count} states &amp; UTs {selectedYear === 2026 ? "from the existing 2026 regression model" : "from the verified dataset"}
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
              {["all", "Critical", "High", "Moderate", "Low"].map((lvl) => (
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
