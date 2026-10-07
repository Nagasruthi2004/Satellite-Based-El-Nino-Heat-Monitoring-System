import { useState, useEffect, useId, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import "./Heat2026Prediction.css";

const RISK_BADGE_COLORS = {
  Low: { bg: "rgba(16, 185, 129, 0.15)", text: "#059669", border: "#10b981" },
  Moderate: { bg: "rgba(245, 158, 11, 0.15)", text: "#d97706", border: "#f59e0b" },
  High: { bg: "rgba(239, 68, 68, 0.15)", text: "#dc2626", border: "#ef4444" },
  Critical: { bg: "rgba(168, 85, 247, 0.15)", text: "#7e22ce", border: "#a855f7" },
};

function formatCelsius(val) {
  if (val == null || Number.isNaN(Number(val))) return "N/A";
  return `${Number(val).toFixed(2)}°C`;
}

function CustomPredictionTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="hp-custom-tooltip">
      <p className="hp-tooltip-label">{label}</p>
      {payload.map((item, idx) => {
        if (item.value == null) return null;
        return (
          <div key={`tip-${item.name || idx}`} className="hp-tooltip-row">
            <span
              className="hp-tooltip-dot"
              style={{ backgroundColor: item.color || item.fill || "#8b5cf6" }}
            />
            <span className="hp-tooltip-name">{item.name}:</span>
            <strong className="hp-tooltip-value">{item.value}°C</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function Heat2026Prediction() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStateName, setSelectedStateName] = useState("Tamil Nadu");
  const [inspectedStateName, setInspectedStateName] = useState(null);
  const [inspectedStateData, setInspectedStateData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const stateSelectId = useId();
  const searchInputId = useId();

  const handleRetry = useCallback(() => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const res = await fetch("http://127.0.0.1:5000/heat-2026-prediction");
        if (!res.ok) {
          throw new Error(`Failed to load 2026 predictions (HTTP ${res.status})`);
        }
        const json = await res.json();
        if (json.status !== "success") {
          throw new Error(json.error || "Failed to load 2026 predictions");
        }
        if (isMounted) {
          setData(json);
          setError("");
          if (json.states && json.states.length > 0) {
            const hasTN = json.states.some((s) => s.state === "Tamil Nadu");
            if (!hasTN) {
              setSelectedStateName(json.states[0].state);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "An unexpected error occurred while fetching 2026 predictions");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const states = useMemo(() => data?.states || [], [data]);
  const top10 = useMemo(() => data?.top_10_hotspots || [], [data]);
  const modelInfo = useMemo(() => data?.model_info || {}, [data]);

  const handleInspectState = useCallback(async (stateName) => {
    if (!stateName) return;
    setInspectedStateName(stateName);
    setSelectedStateName(stateName);
    setInspectError("");
    setInspectLoading(true);

    const localMatch = states.find(
      (s) => s.state.toLowerCase() === stateName.toLowerCase()
    );
    if (localMatch) {
      setInspectedStateData(localMatch);
    } else {
      setInspectedStateData(null);
    }

    try {
      const res = await fetch(
        `http://127.0.0.1:5000/heat-2026-prediction?state=${encodeURIComponent(stateName)}`
      );
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Details unavailable: State "${stateName}" not found in prediction dataset.`);
        }
        throw new Error(`Failed to load details for ${stateName} (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.status !== "success" || !json.state) {
        throw new Error(json.error || `Details unavailable for ${stateName}.`);
      }
      setInspectedStateData(json.state);
    } catch (err) {
      if (!localMatch) {
        setInspectError(err.message || "Details unavailable for this state.");
      }
    } finally {
      setInspectLoading(false);
    }
  }, [states]);

  useEffect(() => {
    if (!inspectedStateName) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setInspectedStateName(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectedStateName]);

  const inspectedChartData = useMemo(() => {
    if (!inspectedStateData) return [];
    const historical = inspectedStateData.historical_records || [];
    const points = historical.map((h) => ({
      yearLabel: String(h.year),
      observed: h.lst_celsius,
      predicted: null,
    }));

    const val2025 = inspectedStateData.observed_2025_lst;
    if (points.length > 0) {
      points[points.length - 1].predicted = val2025;
    }

    points.push({
      yearLabel: "2026 (Est.)",
      observed: null,
      predicted: inspectedStateData.predicted_2026_lst,
    });

    return points;
  }, [inspectedStateData]);

  const selectedState = useMemo(() => {
    return states.find((s) => s.state === selectedStateName) || states[0] || null;
  }, [states, selectedStateName]);

  // Filter table by search
  const filteredStates = useMemo(() => {
    if (!tableSearch.trim()) return states;
    const term = tableSearch.toLowerCase().trim();
    return states.filter(
      (s) =>
        s.state.toLowerCase().includes(term) ||
        s.predicted_2026_risk.toLowerCase().includes(term)
    );
  }, [states, tableSearch]);

  // Historical vs Predicted chart dataset
  const historicalVsPredictedData = useMemo(() => {
    if (!selectedState) return [];
    const historical = selectedState.historical_records || [];
    const points = historical.map((h) => ({
      yearLabel: String(h.year),
      observed: h.lst_celsius,
      predicted: null,
    }));

    // Bridge point at 2025 to connect the dashed prediction line seamlessly
    const val2025 = selectedState.observed_2025_lst;
    if (points.length > 0) {
      points[points.length - 1].predicted = val2025;
    }

    // 2026 predicted point
    points.push({
      yearLabel: "2026 (Est.)",
      observed: null,
      predicted: selectedState.predicted_2026_lst,
    });

    return points;
  }, [selectedState]);

  if (loading) {
    return (
      <div className="hp-container" role="status" aria-live="polite">
        <div className="hp-loading-card">
          <div className="hp-spinner" aria-hidden="true" />
          <h2 className="hp-loading-title">Generating 2026 Heat Predictions...</h2>
          <p className="hp-loading-sub">
            Training state-wise regression models across 2020–2025 India LST observations.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="hp-container" role="alert">
        <div className="hp-error-card">
          <span className="hp-error-icon">⚠️</span>
          <h2>Unable to Load 2026 Heat Prediction</h2>
          <p>{error || "No prediction data available"}</p>
          <button type="button" className="hp-retry-btn" onClick={handleRetry}>
            🔄 Retry Prediction Engine
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hp-container">
      {/* ── 1. HEADER ── */}
      <header className="hp-header-card">
        <div className="hp-header-content">
          <span className="hp-eyebrow">
            <span>🔮</span> Machine Learning Projection
          </span>
          <h1 className="hp-page-title">2026 Heat Prediction</h1>
        </div>
      </header>

      {/* ── 4. TOP HOTSPOTS & 5. HISTORICAL VS PREDICTED CHART ── */}
      <div className="hp-two-col-layout">
        {/* TOP 10 HOTSPOTS */}
        <section className="hp-section" aria-labelledby="hp-hotspots-heading">
          <div className="hp-card">
            <div className="hp-card-header">
              <div>
                <h2 id="hp-hotspots-heading" className="hp-card-title">
                  <span>🔥</span> Top 10 Predicted Hotspots (2026)
                </h2>
                <p className="hp-card-subtitle">
                  Highest predicted Land Surface Temperatures across India.
                </p>
              </div>
              <span className="hp-badge-hotspot">Top 10 Hotspots</span>
            </div>

            <div className="hp-chart-wrapper" style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={top10}
                  margin={{ top: 8, right: 30, left: 40, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                  <XAxis
                    type="number"
                    domain={[24, 34]}
                    unit="°C"
                    tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="state"
                    width={130}
                    tick={{ fill: "var(--text, #1e293b)", fontSize: 12, fontWeight: 500 }}
                  />
                  <Tooltip
                    content={
                      <CustomPredictionTooltip />
                    }
                  />
                  <Bar
                    dataKey="predicted_2026_lst"
                    name="Predicted 2026 LST"
                    radius={[0, 6, 6, 0]}
                  >
                    {top10.map((entry, index) => {
                      const colors = RISK_BADGE_COLORS[entry.predicted_2026_risk];
                      return (
                        <Cell
                          key={`cell-${entry.state}-${index}`}
                          fill={colors?.border || "var(--warning, #f59e0b)"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* 5. HISTORICAL VS PREDICTED CHART */}
        <section className="hp-section" aria-labelledby="hp-trend-heading">
          <div className="hp-card">
            <div className="hp-card-header">
              <div>
                <h2 id="hp-trend-heading" className="hp-card-title">
                  <span>📈</span> Historical vs 2026 Prediction
                </h2>
                <p className="hp-card-subtitle">
                  2020–2025 observed LST compared against 2026 model estimate.
                </p>
              </div>

              {/* State Selector */}
              <div className="hp-state-selector-wrap">
                <label htmlFor={stateSelectId} className="hp-selector-label">
                  Select State:
                </label>
                <select
                  id={stateSelectId}
                  className="hp-state-dropdown"
                  value={selectedStateName}
                  onChange={(e) => setSelectedStateName(e.target.value)}
                >
                  {states.map((st) => (
                    <option key={st.state} value={st.state}>
                      {st.state}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chart */}
            <div className="hp-chart-wrapper" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={historicalVsPredictedData}
                  margin={{ top: 16, right: 24, left: 10, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                  <XAxis
                    dataKey="yearLabel"
                    tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                  />
                  <YAxis
                    unit="°C"
                    tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                  />
                  <Tooltip content={<CustomPredictionTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  <Line
                    type="monotone"
                    name="Observed LST (2020–2025)"
                    dataKey="observed"
                    stroke="var(--primary, #1d4f91)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "var(--primary, #1d4f91)" }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    name="2026 Prediction (Model)"
                    dataKey="predicted"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ r: 6, fill: "#8b5cf6" }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Visual distinction hint */}
            <div className="hp-chart-legend-hint">
              <span className="hp-hint-pill observed">
                <span className="hp-legend-line solid" /> Solid Blue: Verified Historical Observations (2020–2025)
              </span>
              <span className="hp-hint-pill predicted">
                <span className="hp-legend-line dashed" /> Dashed Purple: 2026 Model Regression Estimate
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* ── 7. STATE DETAILS CARD ── */}
      {selectedState && (
        <section className="hp-section" aria-labelledby="hp-details-heading">
          <div className="hp-card hp-details-card">
            <div className="hp-card-header">
              <div>
                <h2 id="hp-details-heading" className="hp-card-title">
                  <span>📍</span> State Forecast Profile: {selectedState.state}
                </h2>
                <p className="hp-card-subtitle">
                  In-depth analytical breakdown for {selectedState.state} based on 6 years of regression modeling.
                </p>
              </div>

              {/* Risk Badge */}
              <div
                className="hp-state-risk-badge"
                style={{
                  backgroundColor: RISK_BADGE_COLORS[selectedState.predicted_2026_risk]?.bg,
                  color: RISK_BADGE_COLORS[selectedState.predicted_2026_risk]?.text,
                  borderColor: RISK_BADGE_COLORS[selectedState.predicted_2026_risk]?.border,
                }}
              >
                Predicted Risk: {selectedState.predicted_2026_risk}
              </div>
            </div>

            {/* Metric Pills */}
            <div className="hp-details-metrics-grid">
              <div className="hp-detail-metric-box">
                <span className="hp-metric-label">2025 Observed LST</span>
                <strong className="hp-metric-val">
                  {formatCelsius(selectedState.observed_2025_lst)}
                </strong>
                <span className="hp-metric-note">Actual historical record</span>
              </div>

              <div className="hp-detail-metric-box highlight">
                <span className="hp-metric-label">Predicted 2026 LST</span>
                <strong className="hp-metric-val purple">
                  {formatCelsius(selectedState.predicted_2026_lst)}
                </strong>
                <span className="hp-metric-note">Regression model estimate</span>
              </div>

              <div className="hp-detail-metric-box">
                <span className="hp-metric-label">Change from 2025</span>
                <strong
                  className={`hp-metric-val ${selectedState.change_from_2025 >= 0 ? "warming" : "cooling"}`}
                >
                  {selectedState.change_from_2025 >= 0 ? "+" : ""}
                  {selectedState.change_from_2025.toFixed(2)}°C
                </strong>
                <span className="hp-metric-note">{selectedState.trend_label}</span>
              </div>

              <div className="hp-detail-metric-box">
                <span className="hp-metric-label">Historical 6-Yr Average</span>
                <strong className="hp-metric-val">
                  {formatCelsius(selectedState.historical_average_lst)}
                </strong>
                <span className="hp-metric-note">
                  Range: {selectedState.historical_min_lst}° – {selectedState.historical_max_lst}°C
                </span>
              </div>
            </div>

            {/* Model & Trend Summary Grid */}
            <div className="hp-inspect-stats-grid">
              <div className="hp-stat-pill">
                <span className="hp-stat-pill-label">Trend Rate (Slope):</span>
                <strong className="hp-stat-pill-val">
                  {selectedState.slope != null
                    ? `${selectedState.slope > 0 ? "+" : ""}${selectedState.slope.toFixed(3)}°C / year`
                    : "N/A"}
                </strong>
              </div>
              <div className="hp-stat-pill">
                <span className="hp-stat-pill-label">Model Fit (R²):</span>
                <strong className="hp-stat-pill-val">
                  {selectedState.r2_score != null ? selectedState.r2_score.toFixed(3) : "N/A"}
                </strong>
              </div>
              <div className="hp-stat-pill">
                <span className="hp-stat-pill-label">Linear Intercept:</span>
                <strong className="hp-stat-pill-val">
                  {selectedState.intercept != null ? selectedState.intercept.toFixed(2) : "N/A"}
                </strong>
              </div>
              <div className="hp-stat-pill">
                <span className="hp-stat-pill-label">Regression Model:</span>
                <strong className="hp-stat-pill-val">
                  {modelInfo.model_name || "Linear Regression (OLS)"}
                </strong>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ── 3. STATE-WISE PREDICTION TABLE ── */}
      <section className="hp-section" aria-labelledby="hp-table-heading">
        <div className="hp-card">
          <div className="hp-card-header">
            <div>
              <h2 id="hp-table-heading" className="hp-card-title">
                <span>📋</span> State-Wise 2026 Predictions Table
              </h2>
              <p className="hp-card-subtitle">
                Complete ranking of all 34 states and union territories sorted by predicted 2026 LST.
              </p>
            </div>

            {/* Table Search */}
            <div className="hp-search-wrap">
              <label htmlFor={searchInputId} className="visually-hidden">
                Search state or risk
              </label>
              <input
                id={searchInputId}
                type="text"
                className="hp-search-input"
                placeholder="Search state or risk level..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="hp-table-container">
            <table className="hp-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">State / UT</th>
                  <th scope="col">2025 LST</th>
                  <th scope="col">Predicted 2026 LST</th>
                  <th scope="col">Change</th>
                  <th scope="col">Predicted Risk</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStates.map((st, idx) => {
                  const isSelected = st.state === selectedStateName;
                  const riskStyle = RISK_BADGE_COLORS[st.predicted_2026_risk];
                  return (
                    <tr
                      key={st.state}
                      className={isSelected ? "selected-row" : ""}
                      onClick={() => handleInspectState(st.state)}
                    >
                      <td className="hp-rank-col">#{idx + 1}</td>
                      <td className="hp-state-col">
                        <strong>{st.state}</strong>
                      </td>
                      <td className="hp-obs-col">{formatCelsius(st.observed_2025_lst)}</td>
                      <td className="hp-pred-col">
                        <strong className="hp-pred-val">
                          {formatCelsius(st.predicted_2026_lst)}
                        </strong>
                      </td>
                      <td
                        className={`hp-change-col ${st.change_from_2025 >= 0 ? "positive" : "negative"}`}
                      >
                        {st.change_from_2025 >= 0 ? "+" : ""}
                        {st.change_from_2025.toFixed(2)}°C
                      </td>
                      <td className="hp-risk-col">
                        <span
                          className="hp-table-risk-pill"
                          style={{
                            backgroundColor: riskStyle?.bg,
                            color: riskStyle?.text,
                            borderColor: riskStyle?.border,
                          }}
                        >
                          {st.predicted_2026_risk}
                        </span>
                      </td>
                      <td className="hp-action-col">
                        <button
                          type="button"
                          className="hp-inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectState(st.state);
                          }}
                          id={`inspect-btn-${st.state.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                          title={`Inspect ${st.state} 2026 prediction details`}
                        >
                          Inspect 📈
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── INSPECT STATE DETAIL MODAL ── */}
      {inspectedStateName && (
        <div
          className="hp-modal-backdrop"
          onClick={() => setInspectedStateName(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hp-inspect-modal-title"
        >
          <div
            className="hp-inspect-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="hp-modal-header">
              <div className="hp-modal-title-group">
                <span className="hp-modal-icon">📍</span>
                <div>
                  <h2 id="hp-inspect-modal-title" className="hp-modal-title">
                    {inspectedStateName} — 2026 Heat Risk Profile
                  </h2>
                  <span className="hp-modal-subtitle">
                    State-Level Regression Analysis & 2026 Projection
                  </span>
                </div>
              </div>

              <div className="hp-modal-actions">
                {inspectedStateData && (
                  <span
                    className="hp-state-risk-badge"
                    style={{
                      backgroundColor: RISK_BADGE_COLORS[inspectedStateData.predicted_2026_risk]?.bg,
                      color: RISK_BADGE_COLORS[inspectedStateData.predicted_2026_risk]?.text,
                      borderColor: RISK_BADGE_COLORS[inspectedStateData.predicted_2026_risk]?.border,
                    }}
                  >
                    Predicted Risk: {inspectedStateData.predicted_2026_risk}
                  </span>
                )}
                <button
                  type="button"
                  className="hp-modal-close-btn"
                  onClick={() => setInspectedStateName(null)}
                  aria-label="Close state details"
                  id="close-inspect-modal-btn"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="hp-modal-body">
              {inspectLoading && !inspectedStateData ? (
                <div className="hp-inspect-loading">
                  <div className="hp-spinner" aria-hidden="true" />
                  <p>Loading {inspectedStateName} prediction details...</p>
                </div>
              ) : inspectError && !inspectedStateData ? (
                <div className="hp-inspect-error-box">
                  <span className="hp-error-icon">⚠️</span>
                  <h3>Details Unavailable</h3>
                  <p>{inspectError}</p>
                  <button
                    type="button"
                    className="hp-modal-back-btn"
                    onClick={() => setInspectedStateName(null)}
                  >
                    ← Back to Table
                  </button>
                </div>
              ) : inspectedStateData ? (
                <>
                  {/* Primary Metrics Grid */}
                  <div className="hp-details-metrics-grid">
                    <div className="hp-detail-metric-box">
                      <span className="hp-metric-label">2025 Observed LST</span>
                      <strong className="hp-metric-val">
                        {formatCelsius(inspectedStateData.observed_2025_lst)}
                      </strong>
                      <span className="hp-metric-note">Actual historical record</span>
                    </div>

                    <div className="hp-detail-metric-box highlight">
                      <span className="hp-metric-label">Predicted 2026 LST</span>
                      <strong className="hp-metric-val purple">
                        {formatCelsius(inspectedStateData.predicted_2026_lst)}
                      </strong>
                      <span className="hp-metric-note">Regression model estimate</span>
                    </div>

                    <div className="hp-detail-metric-box">
                      <span className="hp-metric-label">Change from 2025</span>
                      <strong
                        className={`hp-metric-val ${inspectedStateData.change_from_2025 >= 0 ? "warming" : "cooling"}`}
                      >
                        {inspectedStateData.change_from_2025 >= 0 ? "+" : ""}
                        {inspectedStateData.change_from_2025?.toFixed(2)}°C
                      </strong>
                      <span className="hp-metric-note">{inspectedStateData.trend_label}</span>
                    </div>

                  </div>

                  {/* Model & Trend Stats Row */}
                  <div className="hp-inspect-stats-grid">
                    <div className="hp-stat-pill">
                      <span className="hp-stat-pill-label">Trend Rate (Slope):</span>
                      <strong className="hp-stat-pill-val">
                        {inspectedStateData.slope != null
                          ? `${inspectedStateData.slope > 0 ? "+" : ""}${inspectedStateData.slope.toFixed(3)}°C / year`
                          : "N/A"}
                      </strong>
                    </div>
                    <div className="hp-stat-pill">
                      <span className="hp-stat-pill-label">Model Fit (R²):</span>
                      <strong className="hp-stat-pill-val">
                        {inspectedStateData.r2_score != null
                          ? inspectedStateData.r2_score.toFixed(3)
                          : "N/A"}
                      </strong>
                    </div>
                    <div className="hp-stat-pill">
                      <span className="hp-stat-pill-label">Linear Intercept:</span>
                      <strong className="hp-stat-pill-val">
                        {inspectedStateData.intercept != null
                          ? inspectedStateData.intercept.toFixed(2)
                          : "N/A"}
                      </strong>
                    </div>
                    <div className="hp-stat-pill">
                      <span className="hp-stat-pill-label">Historical Average:</span>
                      <strong className="hp-stat-pill-val">
                        {formatCelsius(inspectedStateData.historical_average_lst)}
                      </strong>
                    </div>
                  </div>

                  {/* Trend Line Chart */}
                  {inspectedChartData.length > 0 && (
                    <div className="hp-modal-chart-section">
                      <h4 className="hp-modal-chart-title">
                        📈 {inspectedStateName} Historical vs 2026 Projected Trajectory
                      </h4>
                      <div className="hp-chart-wrapper" style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={inspectedChartData}
                            margin={{ top: 12, right: 24, left: 10, bottom: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                            <XAxis dataKey="yearLabel" tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }} />
                            <YAxis unit="°C" tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }} domain={["dataMin - 1", "dataMax + 1"]} />
                            <Tooltip content={<CustomPredictionTooltip />} />
                            <Legend verticalAlign="top" height={32} />
                            <Line
                              type="monotone"
                              name="Observed LST (2020–2025)"
                              dataKey="observed"
                              stroke="var(--primary, #1d4f91)"
                              strokeWidth={3}
                              dot={{ r: 5, fill: "var(--primary, #1d4f91)" }}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              name="2026 Prediction (Model)"
                              dataKey="predicted"
                              stroke="#8b5cf6"
                              strokeWidth={3}
                              strokeDasharray="5 5"
                              dot={{ r: 6, fill: "#8b5cf6" }}
                              activeDot={{ r: 8 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                </>
              ) : null}
            </div>

            {/* Modal Footer with Back Button */}
            <div className="hp-modal-footer">
              <button
                type="button"
                className="hp-modal-back-btn"
                onClick={() => setInspectedStateName(null)}
                id="back-to-table-btn"
              >
                ← Back to State-Wise Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
