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
  Critical: "#7f1d1d",
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
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [stateA, setStateA] = useState("Tamil Nadu");
  const [stateB, setStateB] = useState("Rajasthan");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const stateASelectId = useId();
  const stateBSelectId = useId();

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

        let modelEstimates = null;
        try {
          const predictionResponse = await fetch("http://127.0.0.1:5000/heat-2026-prediction");
          const predictionJson = await predictionResponse.json();
          if (!predictionResponse.ok || predictionJson.status !== "success" || !Array.isArray(predictionJson.states)) {
            throw new Error(predictionJson.error || "2026 model estimates are unavailable.");
          }
          modelEstimates = predictionJson;
        } catch (predictionError) {
          console.error("Failed to load 2026 model-estimated LST:", predictionError);
        }

        if (isMounted) {
          setData(json);
          setPredictionData(modelEstimates);
          setError("");
          const availableStates = json.available_states || [];
          if (availableStates.length > 0) {
            if (!availableStates.includes("Tamil Nadu")) {
              setStateA(availableStates[0]);
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
            Loading historical LST analysis and available 2026 model estimates.
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
  } = data;

  const yearOptions = [...new Set([...available_years, 2026])].sort((a, b) => a - b);
  const predictedRecords = (predictionData?.states || []).map((item) => {
    const rawLst = item.predicted_2026_lst;
    if (rawLst == null || rawLst === "" || !Number.isFinite(Number(rawLst))) return null;
    return {
      state: item.state,
      year: 2026,
      lst_celsius: Number(rawLst),
      heat_risk: item.predicted_2026_risk,
      is_estimated: true,
    };
  }).filter(Boolean);
  const predictedByState = new Map(predictedRecords.map((item) => [item.state, item]));
  const predictedAverageValue = predictionData?.summary?.predicted_national_average_lst;
  const predictedAverage = predictedAverageValue != null && Number.isFinite(Number(predictedAverageValue))
    ? Number(predictedAverageValue)
    : predictedRecords.length
      ? Number((predictedRecords.reduce((sum, item) => sum + item.lst_celsius, 0) / predictedRecords.length).toFixed(2))
      : null;
  const predictedRiskDistribution = predictedRecords.reduce((distribution, item) => {
    if (Object.hasOwn(distribution, item.heat_risk)) distribution[item.heat_risk] += 1;
    return distribution;
  }, { year: 2026, Low: 0, Moderate: 0, High: 0, Critical: 0, total: predictedRecords.length });
  const predictedSorted = [...predictedRecords].sort((a, b) => b.lst_celsius - a.lst_celsius);
  const predictedYearData = {
    year: 2026,
    top_10_hottest: predictedSorted.slice(0, 10),
    risk_distribution: predictedRiskDistribution,
    average_lst: predictedAverage,
    highest_lst: predictedSorted[0] || null,
    lowest_lst: predictedSorted[predictedSorted.length - 1] || null,
  };
  const predictionAvailable = predictedRecords.length > 0;
  const yearlyTrendData = predictionAvailable
    ? [...yearly_trend, {
        year: 2026,
        average_lst: predictedAverage,
        min_lst: predictedSorted[predictedSorted.length - 1]?.lst_celsius,
        max_lst: predictedSorted[0]?.lst_celsius,
        state_count: predictedRecords.length,
        is_estimated: true,
      }]
    : yearly_trend;
  const riskTrendData = predictionAvailable
    ? [...risk_distribution_by_year, predictedRiskDistribution]
    : risk_distribution_by_year;

  const currentYearData = selectedYear === 2026
    ? predictionAvailable ? predictedYearData : {
        top_10_hottest: [],
        risk_distribution: {},
        average_lst: null,
        highest_lst: null,
        lowest_lst: null,
      }
    : by_year[selectedYear] || by_year[2025] || {
    top_10_hottest: [],
    risk_distribution: { Low: 0, Moderate: 0, High: 0, total: 0 },
    average_lst: 0,
  };

  const selectedYearDist = currentYearData.risk_distribution || {};

  // State Comparison Data
  const compHistoryA = state_history[stateA] || { yearly_data: [], average_lst: 0 };
  const compHistoryB = state_history[stateB] || { yearly_data: [], average_lst: 0 };

  const comparisonChartData = yearOptions.map((yr) => {
    const recA = yr === 2026
      ? predictedByState.get(stateA)
      : compHistoryA.yearly_data.find((d) => d.year === yr);
    const recB = yr === 2026
      ? predictedByState.get(stateB)
      : compHistoryB.yearly_data.find((d) => d.year === yr);
    return {
      year: yr,
      [stateA]: recA ? recA.lst_celsius : null,
      [stateB]: recB ? recB.lst_celsius : null,
    };
  });



  return (
    <div className="ha-container">
      {/* ── HEADER CARD WITH YEAR SELECTOR ── */}
      <header className="ha-header-card">
        <div className="ha-header-info">
          <span className="ha-eyebrow">
            <span>📊</span> Historical Analytics (2020–2026)
          </span>
          <h1 className="ha-page-title">India Land Surface Temperature Analysis</h1>
          <p className="ha-page-desc">
            Explore observed 2020–2025 LST patterns and the existing model-estimated 2026 projection across India.
          </p>
        </div>

        <div className="ha-year-selector-box">
          <span className="ha-selector-heading">Select Year for Analysis:</span>
          <YearSelector
            years={yearOptions}
            selectedYear={selectedYear}
            onChange={(yr) => setSelectedYear(yr)}
          />
        </div>
      </header>

      <div className={`ha-estimate-notice ${predictionAvailable ? "" : "unavailable"}`} role="status">
        <strong>2026:</strong>{" "}
        {predictionAvailable
          ? "Model Estimated from the existing regression model; these are predictions, not observed satellite measurements."
          : "Model-estimated LST data is unavailable. No 2026 values are shown."}
      </div>

      {/* ── SECTION 1: YEAR-WISE LST TREND ── */}
      <section className="ha-section" aria-labelledby="ha-trend-heading">
        <div className="ha-card ha-chart-card">
          <div className="ha-card-header">
            <div>
              <h2 id="ha-trend-heading" className="ha-card-title">
                <span>📈</span> National Year-Wise LST Trend (2020–2026)
              </h2>
              <p className="ha-card-subtitle">
                Observed annual means through 2025; the 2026 value is model-estimated.
              </p>
            </div>
            <div className="ha-pill-badge">
              {predictionAvailable ? "2026 Model Estimated" : "2026 Estimate Unavailable"}
            </div>
          </div>

          <div className="ha-chart-wrap" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyTrendData} margin={{ top: 16, right: 24, left: 10, bottom: 8 }}>
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
        </div>
      </section>

      {/* ── TOP 10 HOTTEST STATES FOR SELECTED YEAR ── */}
      <section className="ha-section" aria-labelledby="ha-hottest-heading">
          <div className="ha-card ha-chart-card">
            <div className="ha-card-header">
              <div>
                <h2 id="ha-hottest-heading" className="ha-card-title">
                  <span>🔥</span> Top 10 Hottest States ({selectedYear}{selectedYear === 2026 ? " Model Estimated" : ""})
                </h2>
                <p className="ha-card-subtitle">
                  {selectedYear === 2026
                    ? "Highest state LST values predicted by the existing regression model."
                    : `Highest Land Surface Temperatures recorded in ${selectedYear}.`}
                </p>
              </div>
              <div className={`ha-pill-badge ${selectedYear === 2026 ? "warning" : "danger"}`}>
                {selectedYear === 2026 ? "Model Estimated" : "Top 10 Hottest"}
              </div>
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

            {(selectedYear !== 2026 || predictionAvailable) && (
              <div className="ha-year-summary-callout">
                <span className="ha-callout-icon">📌</span>
                <div>
                  <strong>{selectedYear} Summary:</strong> Average LST was{" "}
                  <strong>{formatCelsius(currentYearData.average_lst)}</strong> across{" "}
                  <strong>{currentYearData.risk_distribution?.total ?? 34} states</strong>, ranging from{" "}
                  <strong>{formatCelsius(currentYearData.lowest_lst?.lst_celsius)}</strong> (
                  {currentYearData.lowest_lst?.state}) to{" "}
                  <strong>{formatCelsius(currentYearData.highest_lst?.lst_celsius)}</strong> (
                  {currentYearData.highest_lst?.state}).
                </div>
              </div>
            )}
          </div>
      </section>

      {/* ── SECTION 4: HEAT-RISK DISTRIBUTION ACROSS YEARS ── */}
      <section className="ha-section" aria-labelledby="ha-dist-heading">
        <div className="ha-card ha-chart-card">
          <div className="ha-card-header">
            <div>
              <h2 id="ha-dist-heading" className="ha-card-title">
                <span>⚠️</span> Heat-Risk Distribution (2020–2026)
              </h2>
              <p className="ha-card-subtitle">
                Observed distributions through 2025 and existing model-estimated risk categories for 2026.
              </p>
            </div>
            <div className="ha-pill-badge warning">34 States per Year</div>
          </div>

          <div className="ha-dist-overview-row">
            <div className="ha-chart-wrap" style={{ height: 320, flex: "2 1 450px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={riskTrendData}
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
                  <Bar dataKey="Critical" name="Critical Risk" stackId="a" fill="#7f1d1d" radius={[4, 4, 0, 0]} />
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

                <div className="ha-dist-bar-item">
                  <div className="ha-dist-bar-label">
                    <span className="ha-dist-color-dot" style={{ backgroundColor: "#7f1d1d" }} />
                    <span>Critical Risk</span>
                    <strong>{selectedYearDist.Critical ?? 0} states</strong>
                  </div>
                  <div className="ha-dist-progress-track">
                    <div
                      className="ha-dist-progress-fill danger"
                      style={{ width: `${((selectedYearDist.Critical ?? 0) / 34) * 100}%`, backgroundColor: "#7f1d1d" }}
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
                <span>⚖️</span> State-to-State LST Comparison (2020–2026)
              </h2>
              <p className="ha-card-subtitle">
                Compare observed 2020–2025 trajectories with the existing model-estimated 2026 values.
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

    </div>
  );
}
