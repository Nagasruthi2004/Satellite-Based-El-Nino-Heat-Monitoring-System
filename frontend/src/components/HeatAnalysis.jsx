import { useState, useEffect, useId, useCallback } from "react";
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
import YearSelector from "./YearSelector";
import "./HeatAnalysis.css";

const RISK_COLORS = {
  Low: "var(--success, #10b981)",
  Moderate: "var(--warning, #f59e0b)",
  High: "var(--danger, #ef4444)",
};

function formatCelsius(val) {
  if (val == null || Number.isNaN(Number(val))) return "N/A";
  return `${Number(val).toFixed(2)}°C`;
}

function CustomChartTooltip({ active, payload, label, unit = "°C" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ha-custom-tooltip">
      <p className="ha-tooltip-label">{label}</p>
      {payload.map((item, idx) => (
        <div key={`tip-${item.name || idx}`} className="ha-tooltip-row">
          <span
            className="ha-tooltip-dot"
            style={{ backgroundColor: item.color || item.fill || "var(--primary)" }}
          />
          <span className="ha-tooltip-name">{item.name}:</span>
          <strong className="ha-tooltip-value">
            {typeof item.value === "number" ? `${item.value}${unit}` : item.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function HeatAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [stateA, setStateA] = useState("Tamil Nadu");
  const [stateB, setStateB] = useState("Rajasthan");
  const [historicalState, setHistoricalState] = useState("Tamil Nadu");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const stateASelectId = useId();
  const stateBSelectId = useId();
  const historicalStateSelectId = useId();

  const handleRetry = useCallback(() => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const res = await fetch("http://127.0.0.1:5000/heat-analysis");
        if (!res.ok) {
          throw new Error(`Failed to load heat analysis data (HTTP ${res.status})`);
        }
        const json = await res.json();
        if (json.status !== "success") {
          throw new Error(json.error || "Failed to load heat analysis dataset");
        }
        if (isMounted) {
          setData(json);
          setError("");
          const availableStates = json.available_states || [];
          if (availableStates.length > 0) {
            if (!availableStates.includes("Tamil Nadu")) {
              setStateA(availableStates[0]);
              setHistoricalState(availableStates[0]);
            }
            if (!availableStates.includes("Rajasthan")) {
              setStateB(availableStates[1] || availableStates[0]);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "An unexpected error occurred while fetching analysis");
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

  if (loading) {
    return (
      <div className="ha-container" role="status" aria-live="polite">
        <div className="ha-loading-card">
          <div className="ha-spinner" aria-hidden="true" />
          <h2 className="ha-loading-title">Loading Heat Analysis...</h2>
          <p className="ha-loading-sub">
            Calculating 2020–2025 Land Surface Temperature statistics from the authentic dataset.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ha-container" role="alert">
        <div className="ha-error-card">
          <span className="ha-error-icon">⚠️</span>
          <h2>Unable to Load Heat Analysis</h2>
          <p>{error || "No data available"}</p>
          <button type="button" className="ha-retry-btn" onClick={handleRetry}>
            🔄 Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const {
    available_years = [2020, 2021, 2022, 2023, 2024, 2025],
    available_states = [],
    yearly_trend = [],
    by_year = {},
    risk_distribution_by_year = [],
    state_history = {},
    overall_insights = {},
    source_info = {},
  } = data;

  const currentYearData = by_year[selectedYear] || by_year[2025] || {
    top_10_hottest: [],
    bottom_5_lowest: [],
    risk_distribution: { Low: 0, Moderate: 0, High: 0, total: 0 },
    average_lst: 0,
  };

  const selectedYearDist = currentYearData.risk_distribution || {};

  // State Comparison Data
  const compHistoryA = state_history[stateA] || { yearly_data: [], average_lst: 0 };
  const compHistoryB = state_history[stateB] || { yearly_data: [], average_lst: 0 };

  const comparisonChartData = available_years.map((yr) => {
    const recA = compHistoryA.yearly_data.find((d) => d.year === yr);
    const recB = compHistoryB.yearly_data.find((d) => d.year === yr);
    return {
      year: yr,
      [stateA]: recA ? recA.lst_celsius : null,
      [stateB]: recB ? recB.lst_celsius : null,
    };
  });

  // State Historical Trend Data
  const selectedStateHistory = state_history[historicalState] || {
    yearly_data: [],
    average_lst: 0,
    highest_lst: { year: "-", lst_celsius: 0 },
    lowest_lst: { year: "-", lst_celsius: 0 },
    risk_counts: { Low: 0, Moderate: 0, High: 0 },
    years_by_risk: { Low: [], Moderate: [], High: [] },
  };

  const stateHistoricalChartData = selectedStateHistory.yearly_data.map((d) => ({
    year: d.year,
    lst: d.lst_celsius,
    risk: d.heat_risk,
  }));

  return (
    <div className="ha-container">
      {/* ── HEADER CARD WITH YEAR SELECTOR ── */}
      <header className="ha-header-card">
        <div className="ha-header-info">
          <span className="ha-eyebrow">
            <span>📊</span> Historical Analytics (2020–2025)
          </span>
          <h1 className="ha-page-title">India Land Surface Temperature Analysis</h1>
          <p className="ha-page-desc">
            Explore factual Land Surface Temperature (LST) patterns, multi-year trends, state
            comparisons, and official risk distribution metrics across India from 2020 to 2025.
          </p>
        </div>

        <div className="ha-year-selector-box">
          <span className="ha-selector-heading">Select Year for Analysis:</span>
          <YearSelector
            years={available_years}
            selectedYear={selectedYear}
            onChange={(yr) => setSelectedYear(yr)}
          />
        </div>
      </header>

      {/* ── SECTION 7: KEY INSIGHTS (FACTUAL FROM DATASET) ── */}
      <section className="ha-section" aria-labelledby="ha-insights-heading">
        <div className="ha-section-header">
          <h2 id="ha-insights-heading" className="ha-section-title">
            <span>💡</span> Key Factual Insights
          </h2>
          <span className="ha-badge-sub">Ground-Truth Dataset Metrics</span>
        </div>

        <div className="ha-insights-grid">
          <div className="ha-insight-card accent-primary">
            <div className="ha-insight-icon">🌡️</div>
            <div className="ha-insight-content">
              <span className="ha-insight-label">Overall 6-Year Average LST</span>
              <div className="ha-insight-val">{formatCelsius(overall_insights.overall_average_lst)}</div>
              <p className="ha-insight-note">
                Mean across all 34 states and union territories (2020–2025).
              </p>
            </div>
          </div>

          <div className="ha-insight-card accent-danger">
            <div className="ha-insight-icon">🔥</div>
            <div className="ha-insight-content">
              <span className="ha-insight-label">Highest Recorded LST</span>
              <div className="ha-insight-val">
                {formatCelsius(overall_insights.highest_record?.lst_celsius)}
              </div>
              <p className="ha-insight-note">
                <strong>{overall_insights.highest_record?.state}</strong> in{" "}
                <strong>{overall_insights.highest_record?.year}</strong>
              </p>
            </div>
          </div>

          <div className="ha-insight-card accent-info">
            <div className="ha-insight-icon">❄️</div>
            <div className="ha-insight-content">
              <span className="ha-insight-label">Lowest Recorded LST</span>
              <div className="ha-insight-val">
                {formatCelsius(overall_insights.lowest_record?.lst_celsius)}
              </div>
              <p className="ha-insight-note">
                <strong>{overall_insights.lowest_record?.state}</strong> in{" "}
                <strong>{overall_insights.lowest_record?.year}</strong>
              </p>
            </div>
          </div>

          <div className="ha-insight-card accent-warning">
            <div className="ha-insight-icon">⚠️</div>
            <div className="ha-insight-content">
              <span className="ha-insight-label">High-Risk States in {selectedYear}</span>
              <div className="ha-insight-val">{selectedYearDist.High ?? 0} states</div>
              <p className="ha-insight-note">
                {selectedYearDist.High === 0
                  ? `0 states reached the High risk threshold in ${selectedYear}.`
                  : `${selectedYearDist.High} of 34 states classified in High heat risk for ${selectedYear}.`}
              </p>
            </div>
          </div>

          <div className="ha-insight-card accent-warmest">
            <div className="ha-insight-icon">📈</div>
            <div className="ha-insight-content">
              <span className="ha-insight-label">Warmest Year Recorded</span>
              <div className="ha-insight-val">
                {overall_insights.warmest_year?.year} ({formatCelsius(overall_insights.warmest_year?.average_lst)})
              </div>
              <p className="ha-insight-note">
                Highest national average LST across all 6 recorded years.
              </p>
            </div>
          </div>

          <div className="ha-insight-card accent-coolest">
            <div className="ha-insight-icon">📉</div>
            <div className="ha-insight-content">
              <span className="ha-insight-label">Coolest Year Recorded</span>
              <div className="ha-insight-val">
                {overall_insights.coolest_year?.year} ({formatCelsius(overall_insights.coolest_year?.average_lst)})
              </div>
              <p className="ha-insight-note">
                Lowest national average LST across all 6 recorded years.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 1: YEAR-WISE LST TREND (2020–2025) ── */}
      <section className="ha-section" aria-labelledby="ha-trend-heading">
        <div className="ha-card ha-chart-card">
          <div className="ha-card-header">
            <div>
              <h2 id="ha-trend-heading" className="ha-card-title">
                <span>📈</span> National Year-Wise LST Trend (2020–2025)
              </h2>
              <p className="ha-card-subtitle">
                Annual mean Land Surface Temperature (°C) calculated across all 34 states and union territories.
              </p>
            </div>
            <div className="ha-pill-badge">Dataset Average</div>
          </div>

          <div className="ha-chart-wrap" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearly_trend} margin={{ top: 16, right: 24, left: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                <XAxis dataKey="year" tick={{ fill: "var(--text-muted, #64748b)", fontSize: 13 }} />
                <YAxis
                  domain={[24, 30]}
                  unit="°C"
                  tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      unit="°C"
                      label="Year"
                    />
                  }
                />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  name="National Average LST"
                  dataKey="average_lst"
                  stroke="var(--primary, #1d4f91)"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 5, fill: "var(--primary, #1d4f91)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Year Pill Bar */}
          <div className="ha-yearly-strip">
            {yearly_trend.map((yt) => {
              const isSelected = yt.year === selectedYear;
              return (
                <div
                  key={yt.year}
                  className={`ha-yearly-strip-item ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedYear(yt.year)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedYear(yt.year)}
                >
                  <span className="ha-strip-year">{yt.year}</span>
                  <strong className="ha-strip-temp">{formatCelsius(yt.average_lst)}</strong>
                  <span className="ha-strip-range">
                    {yt.min_lst}° – {yt.max_lst}°
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTIONS 2 & 3: HOTTEST 10 & LOWEST 5 STATES FOR SELECTED YEAR ── */}
      <div className="ha-two-col-grid">
        {/* SECTION 2: HOTTEST STATES (HORIZONTAL BAR CHART) */}
        <section className="ha-section" aria-labelledby="ha-hottest-heading">
          <div className="ha-card ha-chart-card">
            <div className="ha-card-header">
              <div>
                <h2 id="ha-hottest-heading" className="ha-card-title">
                  <span>🔥</span> Top 10 Hottest States ({selectedYear})
                </h2>
                <p className="ha-card-subtitle">
                  Highest Land Surface Temperatures recorded in {selectedYear}.
                </p>
              </div>
              <div className="ha-pill-badge danger">Top 10 Hottest</div>
            </div>

            <div className="ha-chart-wrap" style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={currentYearData.top_10_hottest || []}
                  margin={{ top: 8, right: 30, left: 40, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                  <XAxis
                    type="number"
                    domain={[20, 38]}
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
                      <CustomChartTooltip
                        unit="°C"
                        label="State"
                      />
                    }
                  />
                  <Bar
                    dataKey="lst_celsius"
                    name="LST (°C)"
                    radius={[0, 6, 6, 0]}
                  >
                    {(currentYearData.top_10_hottest || []).map((entry, index) => (
                      <Cell
                        key={`cell-${entry.state}-${index}`}
                        fill={RISK_COLORS[entry.heat_risk] || "var(--danger, #ef4444)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* SECTION 3: LOWEST 5 LST STATES */}
        <section className="ha-section" aria-labelledby="ha-lowest-heading">
          <div className="ha-card">
            <div className="ha-card-header">
              <div>
                <h2 id="ha-lowest-heading" className="ha-card-title">
                  <span>❄️</span> 5 States with Lowest LST ({selectedYear})
                </h2>
                <p className="ha-card-subtitle">
                  Coolest Land Surface Temperatures recorded in {selectedYear}.
                </p>
              </div>
              <div className="ha-pill-badge info">Bottom 5 Coolest</div>
            </div>

            <div className="ha-lowest-list">
              {(currentYearData.bottom_5_lowest || []).map((item, idx) => (
                <div key={item.state} className="ha-lowest-item">
                  <div className="ha-lowest-rank">#{idx + 1}</div>
                  <div className="ha-lowest-info">
                    <span className="ha-lowest-state">{item.state}</span>
                    <span className="ha-lowest-risk-label">Heat Risk: {item.heat_risk}</span>
                  </div>
                  <div className="ha-lowest-temp-box">
                    <span className="ha-lowest-temp">{formatCelsius(item.lst_celsius)}</span>
                    <span
                      className="ha-risk-badge"
                      style={{
                        backgroundColor: RISK_COLORS[item.heat_risk] ? `${RISK_COLORS[item.heat_risk]}22` : "#e2e8f0",
                        color: RISK_COLORS[item.heat_risk] || "inherit",
                        borderColor: RISK_COLORS[item.heat_risk] || "transparent",
                      }}
                    >
                      {item.heat_risk}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick summary box for selected year */}
            <div className="ha-year-summary-callout">
              <span className="ha-callout-icon">📌</span>
              <div>
                <strong>{selectedYear} Summary:</strong> Average LST was{" "}
                <strong>{formatCelsius(currentYearData.average_lst)}</strong> across 34 states,
                ranging from{" "}
                <strong>{formatCelsius(currentYearData.lowest_lst?.lst_celsius)}</strong> (
                {currentYearData.lowest_lst?.state}) to{" "}
                <strong>{formatCelsius(currentYearData.highest_lst?.lst_celsius)}</strong> (
                {currentYearData.highest_lst?.state}).
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── SECTION 4: HEAT-RISK DISTRIBUTION ACROSS YEARS ── */}
      <section className="ha-section" aria-labelledby="ha-dist-heading">
        <div className="ha-card ha-chart-card">
          <div className="ha-card-header">
            <div>
              <h2 id="ha-dist-heading" className="ha-card-title">
                <span>⚠️</span> Heat-Risk Distribution (2020–2025)
              </h2>
              <p className="ha-card-subtitle">
                Number of states and union territories in Low, Moderate, and High heat-risk categories across all years.
              </p>
            </div>
            <div className="ha-pill-badge warning">34 States per Year</div>
          </div>

          <div className="ha-dist-overview-row">
            <div className="ha-chart-wrap" style={{ height: 320, flex: "2 1 450px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={risk_distribution_by_year}
                  margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                  <XAxis dataKey="year" tick={{ fill: "var(--text-muted, #64748b)", fontSize: 13 }} />
                  <YAxis
                    domain={[0, 34]}
                    tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                    unit=" states"
                  />
                  <Tooltip
                    content={
                      <CustomChartTooltip
                        unit=" states"
                        label="Year"
                      />
                    }
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="Low" name="Low Risk" stackId="a" fill="var(--success, #10b981)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Moderate" name="Moderate Risk" stackId="a" fill="var(--warning, #f59e0b)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="High" name="High Risk" stackId="a" fill="var(--danger, #ef4444)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Selected Year Distribution Focus Box */}
            <div className="ha-dist-focus-box">
              <h3 className="ha-dist-focus-title">Distribution for {selectedYear}</h3>
              <p className="ha-dist-focus-sub">Categorized out of 34 total states/UTs:</p>

              <div className="ha-dist-bars">
                <div className="ha-dist-bar-item">
                  <div className="ha-dist-bar-label">
                    <span className="ha-dist-color-dot" style={{ backgroundColor: "var(--success, #10b981)" }} />
                    <span>Low Risk</span>
                    <strong>{selectedYearDist.Low ?? 0} states</strong>
                  </div>
                  <div className="ha-dist-progress-track">
                    <div
                      className="ha-dist-progress-fill success"
                      style={{ width: `${((selectedYearDist.Low ?? 0) / 34) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="ha-dist-bar-item">
                  <div className="ha-dist-bar-label">
                    <span className="ha-dist-color-dot" style={{ backgroundColor: "var(--warning, #f59e0b)" }} />
                    <span>Moderate Risk</span>
                    <strong>{selectedYearDist.Moderate ?? 0} states</strong>
                  </div>
                  <div className="ha-dist-progress-track">
                    <div
                      className="ha-dist-progress-fill warning"
                      style={{ width: `${((selectedYearDist.Moderate ?? 0) / 34) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="ha-dist-bar-item">
                  <div className="ha-dist-bar-label">
                    <span className="ha-dist-color-dot" style={{ backgroundColor: "var(--danger, #ef4444)" }} />
                    <span>High Risk</span>
                    <strong>{selectedYearDist.High ?? 0} states</strong>
                  </div>
                  <div className="ha-dist-progress-track">
                    <div
                      className="ha-dist-progress-fill danger"
                      style={{ width: `${((selectedYearDist.High ?? 0) / 34) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: STATE COMPARISON (SELECT ANY TWO STATES) ── */}
      <section className="ha-section" aria-labelledby="ha-compare-heading">
        <div className="ha-card ha-chart-card">
          <div className="ha-card-header">
            <div>
              <h2 id="ha-compare-heading" className="ha-card-title">
                <span>⚖️</span> State-to-State LST Comparison (2020–2025)
              </h2>
              <p className="ha-card-subtitle">
                Select any two states or union territories to compare their 6-year Land Surface Temperature trajectories.
              </p>
            </div>
            <div className="ha-pill-badge primary">Comparative Analysis</div>
          </div>

          {/* Selectors Bar */}
          <div className="ha-compare-selectors">
            <div className="ha-state-select-group">
              <label htmlFor={stateASelectId} className="ha-select-label">
                <span className="ha-state-legend-dot state-a" /> State A:
              </label>
              <select
                id={stateASelectId}
                className="ha-state-select"
                value={stateA}
                onChange={(e) => setStateA(e.target.value)}
              >
                {available_states.map((st) => (
                  <option key={`a-${st}`} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="ha-compare-vs" aria-hidden="true">
              VS
            </div>

            <div className="ha-state-select-group">
              <label htmlFor={stateBSelectId} className="ha-select-label">
                <span className="ha-state-legend-dot state-b" /> State B:
              </label>
              <select
                id={stateBSelectId}
                className="ha-state-select"
                value={stateB}
                onChange={(e) => setStateB(e.target.value)}
              >
                {available_states.map((st) => (
                  <option key={`b-${st}`} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Metrics Header */}
          <div className="ha-compare-metrics-row">
            <div className="ha-compare-metric-box state-a-box">
              <div className="ha-comp-state-name">{stateA}</div>
              <div className="ha-comp-stat-grid">
                <div>
                  <span className="ha-comp-stat-lbl">6-Year Avg:</span>
                  <strong>{formatCelsius(compHistoryA.average_lst)}</strong>
                </div>
                <div>
                  <span className="ha-comp-stat-lbl">Highest:</span>
                  <strong>
                    {formatCelsius(compHistoryA.highest_lst?.lst_celsius)} (
                    {compHistoryA.highest_lst?.year})
                  </strong>
                </div>
                <div>
                  <span className="ha-comp-stat-lbl">Lowest:</span>
                  <strong>
                    {formatCelsius(compHistoryA.lowest_lst?.lst_celsius)} (
                    {compHistoryA.lowest_lst?.year})
                  </strong>
                </div>
              </div>
            </div>

            <div className="ha-compare-metric-box state-b-box">
              <div className="ha-comp-state-name">{stateB}</div>
              <div className="ha-comp-stat-grid">
                <div>
                  <span className="ha-comp-stat-lbl">6-Year Avg:</span>
                  <strong>{formatCelsius(compHistoryB.average_lst)}</strong>
                </div>
                <div>
                  <span className="ha-comp-stat-lbl">Highest:</span>
                  <strong>
                    {formatCelsius(compHistoryB.highest_lst?.lst_celsius)} (
                    {compHistoryB.highest_lst?.year})
                  </strong>
                </div>
                <div>
                  <span className="ha-comp-stat-lbl">Lowest:</span>
                  <strong>
                    {formatCelsius(compHistoryB.lowest_lst?.lst_celsius)} (
                    {compHistoryB.lowest_lst?.year})
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Line Chart */}
          <div className="ha-chart-wrap" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonChartData} margin={{ top: 16, right: 24, left: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                <XAxis dataKey="year" tick={{ fill: "var(--text-muted, #64748b)", fontSize: 13 }} />
                <YAxis
                  unit="°C"
                  tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      unit="°C"
                      label="Year"
                    />
                  }
                />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  name={stateA}
                  dataKey={stateA}
                  stroke="#3b82f6"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 5, fill: "#3b82f6" }}
                />
                <Line
                  type="monotone"
                  name={stateB}
                  dataKey={stateB}
                  stroke="#f97316"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 5, fill: "#f97316" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: STATE HISTORICAL TREND (SINGLE STATE DETAIL) ── */}
      <section className="ha-section" aria-labelledby="ha-single-state-heading">
        <div className="ha-card ha-chart-card">
          <div className="ha-card-header">
            <div>
              <h2 id="ha-single-state-heading" className="ha-card-title">
                <span>📍</span> State Historical Trend & Risk Profile
              </h2>
              <p className="ha-card-subtitle">
                Select a state to inspect individual annual LST values, risk breakdown, and extremes from 2020 to 2025.
              </p>
            </div>
            <div className="ha-state-select-wrap">
              <label htmlFor={historicalStateSelectId} className="ha-select-label">
                Select State:
              </label>
              <select
                id={historicalStateSelectId}
                className="ha-state-select"
                value={historicalState}
                onChange={(e) => setHistoricalState(e.target.value)}
              >
                {available_states.map((st) => (
                  <option key={`single-${st}`} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Historical Stat Badges */}
          <div className="ha-state-stats-row">
            <div className="ha-state-stat-pill">
              <span className="ha-stat-pill-label">Average LST:</span>
              <strong className="ha-stat-pill-value">
                {formatCelsius(selectedStateHistory.average_lst)}
              </strong>
            </div>

            <div className="ha-state-stat-pill">
              <span className="ha-stat-pill-label">Highest Recorded LST:</span>
              <strong className="ha-stat-pill-value">
                {formatCelsius(selectedStateHistory.highest_lst?.lst_celsius)} (
                {selectedStateHistory.highest_lst?.year})
              </strong>
            </div>

            <div className="ha-state-stat-pill">
              <span className="ha-stat-pill-label">Lowest Recorded LST:</span>
              <strong className="ha-stat-pill-value">
                {formatCelsius(selectedStateHistory.lowest_lst?.lst_celsius)} (
                {selectedStateHistory.lowest_lst?.year})
              </strong>
            </div>
          </div>

          {/* Risk Years Categorization Tags */}
          <div className="ha-risk-years-row">
            <div className="ha-risk-year-group">
              <span className="ha-risk-badge-tag high">High Risk Years:</span>
              <span className="ha-risk-years-list">
                {selectedStateHistory.years_by_risk?.High?.length > 0
                  ? selectedStateHistory.years_by_risk.High.join(", ")
                  : "None recorded"}
              </span>
            </div>

            <div className="ha-risk-year-group">
              <span className="ha-risk-badge-tag moderate">Moderate Risk Years:</span>
              <span className="ha-risk-years-list">
                {selectedStateHistory.years_by_risk?.Moderate?.length > 0
                  ? selectedStateHistory.years_by_risk.Moderate.join(", ")
                  : "None recorded"}
              </span>
            </div>

            <div className="ha-risk-year-group">
              <span className="ha-risk-badge-tag low">Low Risk Years:</span>
              <span className="ha-risk-years-list">
                {selectedStateHistory.years_by_risk?.Low?.length > 0
                  ? selectedStateHistory.years_by_risk.Low.join(", ")
                  : "None recorded"}
              </span>
            </div>
          </div>

          {/* Single State Line Chart */}
          <div className="ha-chart-wrap" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={stateHistoricalChartData}
                margin={{ top: 16, right: 24, left: 10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                <XAxis dataKey="year" tick={{ fill: "var(--text-muted, #64748b)", fontSize: 13 }} />
                <YAxis
                  unit="°C"
                  tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      unit="°C"
                      label="Year"
                    />
                  }
                />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  name={`${historicalState} LST`}
                  dataKey="lst"
                  stroke="var(--primary, #1d4f91)"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 5, fill: "var(--primary, #1d4f91)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: DATA SOURCE & METHODOLOGY NOTE ── */}
      <footer className="ha-datasource-card">
        <div className="ha-datasource-icon">🛰️</div>
        <div className="ha-datasource-text">
          <h3 className="ha-datasource-title">Dataset Origin & Scientific Disclosure</h3>
          <p className="ha-datasource-line">
            <strong>Source:</strong> {source_info.dataset_name || "India LST dataset 2020–2025"}
          </p>
          <p className="ha-datasource-notice">
            <strong>Note:</strong>{" "}
            {source_info.note ||
              "Temperature represents Land Surface Temperature (LST), not standard air temperature."}
          </p>
          <p className="ha-datasource-subtext">
            All analytical figures, rankings, and statistical distributions are derived directly
            from the verified 2020–2025 India state observations. No values are simulated or extrapolated.
          </p>
        </div>
      </footer>
    </div>
  );
}
