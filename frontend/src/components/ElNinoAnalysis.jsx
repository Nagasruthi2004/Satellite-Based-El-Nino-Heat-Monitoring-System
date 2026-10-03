import { useState, useEffect, useMemo, useCallback } from "react";
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
  ReferenceLine,
  Cell,
} from "recharts";
import "./ElNinoAnalysis.css";

const PHASE_COLORS = {
  "El Niño": "#ef4444",
  Neutral: "#64748b",
  "La Niña": "#0ea5e9",
};

function formatCelsius(val) {
  if (val == null || Number.isNaN(Number(val))) return "N/A";
  return `${Number(val).toFixed(2)}°C`;
}

function CustomOniTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ea-custom-tooltip">
      <p className="ea-tooltip-label">{label}</p>
      {payload.map((item, idx) => {
        if (item.value == null) return null;
        return (
          <div key={`tip-${item.name || idx}`} className="ea-tooltip-row">
            <span
              className="ea-tooltip-dot"
              style={{ backgroundColor: item.color || item.fill || "var(--primary)" }}
            />
            <span className="ea-tooltip-name">{item.name}:</span>
            <strong className="ea-tooltip-value">
              {item.unit ? `${item.value}${item.unit}` : item.value}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

export default function ElNinoAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("all");

  const handleRetry = useCallback(() => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const res = await fetch("http://127.0.0.1:5000/enso-analysis");
        if (!res.ok) {
          throw new Error(`Failed to load ENSO analysis data (HTTP ${res.status})`);
        }
        const json = await res.json();
        if (json.status !== "success") {
          throw new Error(json.error || "Failed to load ENSO dataset");
        }
        if (isMounted) {
          setData(json);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "An unexpected error occurred while fetching ENSO data");
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

  const latestStatus = useMemo(() => data?.latest_status || {}, [data]);
  const trendSeries = useMemo(() => data?.trend_series || [], [data]);
  const comparisonTable = useMemo(() => data?.comparison_table || [], [data]);
  const phaseComparison = useMemo(() => data?.phase_comparison || [], [data]);
  const correlation = useMemo(() => data?.correlation || {}, [data]);
  const insights = useMemo(() => data?.insights || {}, [data]);
  const limitations = useMemo(() => data?.limitations || [], [data]);
  const sourceInfo = useMemo(() => data?.source_info || {}, [data]);

  // Filtered ONI series for chart view (2020-2025 or full recent)
  const filteredTrendSeries = useMemo(() => {
    if (activeTab === "lst-period") {
      return trendSeries.filter((d) => d.year >= 2020 && d.year <= 2025);
    }
    return trendSeries;
  }, [trendSeries, activeTab]);

  // Combined ENSO vs India LST dataset for chart
  const combinedChartData = useMemo(() => {
    return comparisonTable.map((row) => ({
      year: String(row.year),
      india_avg_lst: row.india_avg_lst,
      annual_avg_oni: row.annual_avg_oni,
      phase: row.predominant_phase,
    }));
  }, [comparisonTable]);

  if (loading) {
    return (
      <div className="ea-container" role="status" aria-live="polite">
        <div className="ea-loading-card">
          <div className="ea-spinner" aria-hidden="true" />
          <h2 className="ea-loading-title">Loading ENSO / El Niño Analysis...</h2>
          <p className="ea-loading-sub">
            Retrieving authentic NOAA Climate Prediction Center ONI index and integrating with India LST observations.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ea-container" role="alert">
        <div className="ea-error-card">
          <span className="ea-error-icon">⚠️</span>
          <h2>Unable to Load ENSO Analysis</h2>
          <p>{error || "No ENSO data available"}</p>
          <button type="button" className="ea-retry-btn" onClick={handleRetry}>
            🔄 Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const latestPhase = latestStatus.phase || "Neutral";
  const latestColor = PHASE_COLORS[latestPhase] || "#64748b";

  return (
    <div className="ea-container">
      {/* ── 1. HEADER CARD ── */}
      <header className="ea-header-card">
        <div className="ea-header-content">
          <span className="ea-eyebrow">
            <span>🌊</span> Macro-Climate Integration
          </span>
          <h1 className="ea-page-title">El Niño & ENSO Climate Analysis</h1>
          <p className="ea-page-desc">
            Study of the Oceanic Niño Index (ONI) alongside Indian Land Surface Temperature (LST) observations.
            Explore authentic NOAA CPC oceanic records and investigate correlations with regional thermal patterns.
          </p>
        </div>
        <div className="ea-source-badge-box">
          <span className="ea-badge-pill">NOAA CPC ERSST.v5 Data</span>
          <span className="ea-badge-sub">Niño 3.4 Region (5°N–5°S, 120°–170°W)</span>
        </div>
      </header>

      {/* ── 2. ENSO STATUS CARDS ── */}
      <section className="ea-section" aria-labelledby="ea-status-heading">
        <div className="ea-section-header">
          <h2 id="ea-status-heading" className="ea-section-title">
            <span>🌐</span> Current ENSO Phase & Teleconnection Status
          </h2>
          <span className="ea-status-tag" style={{ borderColor: latestColor, color: latestColor }}>
            ● Active Monitored Cycle: {latestStatus.period}
          </span>
        </div>

        <div className="ea-status-grid">
          {/* Main Status Hero Card */}
          <div className="ea-status-card hero-status" style={{ borderLeftColor: latestColor }}>
            <div className="ea-status-icon-wrap" style={{ backgroundColor: `${latestColor}18` }}>
              <span className="ea-status-icon">{latestPhase === "El Niño" ? "🔥" : latestPhase === "La Niña" ? "❄️" : "⚖️"}</span>
            </div>
            <div className="ea-status-body">
              <span className="ea-status-label">Current Observed ENSO Phase</span>
              <div className="ea-status-phase" style={{ color: latestColor }}>
                {latestPhase} ({latestStatus.strength || "Neutral"})
              </div>
              <p className="ea-status-desc">{latestStatus.headline}</p>
            </div>
            <div className="ea-status-oni-box">
              <span className="ea-oni-box-label">Oceanic Niño Index</span>
              <span className="ea-oni-box-val" style={{ color: latestColor }}>
                {latestStatus.oni > 0 ? `+${latestStatus.oni.toFixed(2)}` : `${latestStatus.oni.toFixed(2)}`}°C
              </span>
              <span className="ea-oni-box-period">{latestStatus.period}</span>
            </div>
          </div>

          {/* Quick Indicator 1: Threshold Context */}
          <div className="ea-status-card">
            <span className="ea-indicator-label">Operational Thresholds</span>
            <div className="ea-threshold-strip">
              <div className="ea-threshold-item el-nino">
                <span className="ea-th-name">El Niño</span>
                <strong>≥ +0.5°C</strong>
              </div>
              <div className="ea-threshold-item neutral">
                <span className="ea-th-name">Neutral</span>
                <strong>-0.5° to +0.5°C</strong>
              </div>
              <div className="ea-threshold-item la-nina">
                <span className="ea-th-name">La Niña</span>
                <strong>≤ -0.5°C</strong>
              </div>
            </div>
            <p className="ea-indicator-sub">
              Defined by NOAA as 5 consecutive overlapping 3-month seasons meeting threshold.
            </p>
          </div>

          {/* Quick Indicator 2: Correlation with India LST */}
          <div className="ea-status-card">
            <span className="ea-indicator-label">Observed LST Correlation (2020–2025)</span>
            <div className="ea-corr-highlight">
              <strong className="ea-corr-val">r = {correlation.pearson_r ?? "-0.035"}</strong>
              <span className="ea-corr-badge">{correlation.relationship_label || "Weak / Associative"}</span>
            </div>
            <p className="ea-indicator-sub">
              Empirical Pearson r between annual NOAA ONI and India average LST over 6 years.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. ENSO PHASE TIMELINE (2020–2025) ── */}
      <section className="ea-section" aria-labelledby="ea-timeline-heading">
        <div className="ea-card">
          <div className="ea-card-header">
            <div>
              <h2 id="ea-timeline-heading" className="ea-card-title">
                <span>🗓️</span> ENSO Phase Timeline & Progression (2020–2025)
              </h2>
              <p className="ea-card-subtitle">
                Predominant macro-climatic state of the equatorial Pacific Ocean aligned with India LST observation years.
              </p>
            </div>
            <span className="ea-pill-badge">Historical Alignment</span>
          </div>

          <div className="ea-timeline-grid">
            {comparisonTable.map((item) => {
              const phaseColor = PHASE_COLORS[item.predominant_phase] || "#64748b";
              return (
                <div key={item.year} className="ea-timeline-item" style={{ borderTopColor: phaseColor }}>
                  <span className="ea-tl-year">{item.year}</span>
                  <span
                    className="ea-tl-phase-badge"
                    style={{ backgroundColor: `${phaseColor}20`, color: phaseColor, borderColor: phaseColor }}
                  >
                    {item.predominant_phase}
                  </span>
                  <div className="ea-tl-oni">
                    <span>Avg ONI:</span>
                    <strong>{item.annual_avg_oni > 0 ? `+${item.annual_avg_oni}` : item.annual_avg_oni}°C</strong>
                  </div>
                  <div className="ea-tl-lst">
                    <span>India LST:</span>
                    <strong>{formatCelsius(item.india_avg_lst)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. ONI TREND CHART ── */}
      <section className="ea-section" aria-labelledby="ea-trend-heading">
        <div className="ea-card">
          <div className="ea-card-header">
            <div>
              <h2 id="ea-trend-heading" className="ea-card-title">
                <span>📈</span> Oceanic Niño Index (ONI) Multi-Year Trend
              </h2>
              <p className="ea-card-subtitle">
                Three-month running mean sea surface temperature anomalies in the Niño 3.4 region (°C).
              </p>
            </div>

            {/* Time Filter Tabs */}
            <div className="ea-filter-tabs" role="tablist">
              <button
                type="button"
                className={`ea-tab-btn ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                Recent Cycles (2018–Present)
              </button>
              <button
                type="button"
                className={`ea-tab-btn ${activeTab === "lst-period" ? "active" : ""}`}
                onClick={() => setActiveTab("lst-period")}
              >
                India LST Period (2020–2025)
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="ea-chart-wrapper" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filteredTrendSeries}
                margin={{ top: 16, right: 24, left: 10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                <XAxis
                  dataKey="period"
                  tick={{ fill: "var(--text-muted, #64748b)", fontSize: 11 }}
                  interval={Math.ceil(filteredTrendSeries.length / 12)}
                />
                <YAxis
                  domain={[-2.0, 2.5]}
                  unit="°C"
                  tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                />
                <Tooltip
                  content={
                    <CustomOniTooltip />
                  }
                />
                <Legend verticalAlign="top" height={36} />
                {/* Threshold Reference Lines */}
                <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "+0.5°C El Niño", fill: "#ef4444", fontSize: 11, position: "right" }} />
                <ReferenceLine y={0.0} stroke="#94a3b8" strokeDasharray="2 2" />
                <ReferenceLine y={-0.5} stroke="#0ea5e9" strokeDasharray="4 4" label={{ value: "-0.5°C La Niña", fill: "#0ea5e9", fontSize: 11, position: "right" }} />
                <Line
                  type="monotone"
                  name="Oceanic Niño Index (ONI)"
                  dataKey="oni"
                  stroke="var(--primary, #1d4f91)"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 3, fill: "var(--primary, #1d4f91)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── 5. EL NIÑO VS INDIA HEAT COMPARISON ── */}
      <div className="ea-two-col-layout">
        {/* Comparative Trend Chart */}
        <section className="ea-section" aria-labelledby="ea-comp-heading">
          <div className="ea-card">
            <div className="ea-card-header">
              <div>
                <h2 id="ea-comp-heading" className="ea-card-title">
                  <span>⚖️</span> ENSO vs India Average LST (2020–2025)
                </h2>
                <p className="ea-card-subtitle">
                  Comparing annual Oceanic Niño Index with verified Indian Land Surface Temperature.
                </p>
              </div>
              <span className="ea-pill-badge primary">Association Study</span>
            </div>

            <div className="ea-chart-wrapper" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={combinedChartData}
                  margin={{ top: 16, right: 24, left: 10, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                  <XAxis dataKey="year" tick={{ fill: "var(--text-muted, #64748b)", fontSize: 13 }} />
                  <YAxis
                    domain={[24, 32]}
                    unit="°C"
                    tick={{ fill: "var(--text-muted, #64748b)", fontSize: 12 }}
                  />
                  <Tooltip
                    content={
                      <CustomOniTooltip />
                    }
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar
                    dataKey="india_avg_lst"
                    name="India Average LST (°C)"
                    radius={[6, 6, 0, 0]}
                  >
                    {combinedChartData.map((entry, index) => {
                      const col = PHASE_COLORS[entry.phase] || "var(--primary)";
                      return <Cell key={`cell-${index}`} fill={col} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ea-chart-hint">
              Bar colors represent the predominant annual ENSO phase:{" "}
              <strong style={{ color: "#ef4444" }}>Red (El Niño)</strong>,{" "}
              <strong style={{ color: "#0ea5e9" }}>Blue (La Niña)</strong>,{" "}
              <strong style={{ color: "#64748b" }}>Slate (Neutral)</strong>.
            </div>
          </div>
        </section>

        {/* Phase-wise Aggregates */}
        <section className="ea-section" aria-labelledby="ea-phase-comp-heading">
          <div className="ea-card">
            <div className="ea-card-header">
              <div>
                <h2 id="ea-phase-comp-heading" className="ea-card-title">
                  <span>📊</span> Phase-Wise LST Comparison
                </h2>
                <p className="ea-card-subtitle">
                  Average India Land Surface Temperature grouped by predominant ENSO phase.
                </p>
              </div>
            </div>

            <div className="ea-phase-cards-grid">
              {phaseComparison.map((p) => {
                const color = PHASE_COLORS[p.phase] || "#64748b";
                return (
                  <div key={p.phase} className="ea-phase-card" style={{ borderLeftColor: color }}>
                    <div className="ea-phase-card-top">
                      <span className="ea-phase-card-title" style={{ color }}>{p.phase}</span>
                      <span className="ea-phase-count-tag">{p.years_count} year(s)</span>
                    </div>
                    <div className="ea-phase-temp">
                      {formatCelsius(p.average_india_lst)}
                    </div>
                    <p className="ea-phase-desc">{p.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="ea-association-notice">
              <span className="ea-notice-icon">ℹ️</span>
              <div>
                <strong>Scientific Association Notice:</strong> Observed average LST across all 3 phases
                falls within a narrow range (27.28°C to 28.34°C). The data demonstrates that continental heat
                in India is modulated by multi-factor meteorological forces, not ocean anomalies alone.
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── ANNUAL COMPARISON TABLE ── */}
      <section className="ea-section" aria-labelledby="ea-table-heading">
        <div className="ea-card">
          <div className="ea-card-header">
            <div>
              <h2 id="ea-table-heading" className="ea-card-title">
                <span>📋</span> Annual ENSO & India LST Integrated Dataset (2020–2025)
              </h2>
              <p className="ea-card-subtitle">
                Direct cross-comparison of NOAA ONI metrics with verified 34-state Indian LST summaries.
              </p>
            </div>
          </div>

          <div className="ea-table-container">
            <table className="ea-table">
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col">Annual Mean ONI</th>
                  <th scope="col">ONI Range</th>
                  <th scope="col">Predominant Phase</th>
                  <th scope="col">India Mean LST</th>
                  <th scope="col">State LST Range</th>
                  <th scope="col">High-Risk States</th>
                </tr>
              </thead>
              <tbody>
                {comparisonTable.map((row) => {
                  const phaseCol = PHASE_COLORS[row.predominant_phase] || "#64748b";
                  return (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>
                        <strong style={{ color: phaseCol }}>
                          {row.annual_avg_oni > 0 ? `+${row.annual_avg_oni}` : row.annual_avg_oni}°C
                        </strong>
                      </td>
                      <td className="ea-range-col">{row.oni_range}</td>
                      <td>
                        <span
                          className="ea-phase-badge"
                          style={{ backgroundColor: `${phaseCol}18`, color: phaseCol, borderColor: phaseCol }}
                        >
                          {row.predominant_phase}
                        </span>
                      </td>
                      <td><strong>{formatCelsius(row.india_avg_lst)}</strong></td>
                      <td className="ea-range-col">
                        {row.india_min_lst}° – {row.india_max_lst}°C
                      </td>
                      <td>
                        <span className={`ea-high-risk-badge ${row.high_risk_states > 0 ? "has-high" : "none"}`}>
                          {row.high_risk_states} states
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 6. KEY SCIENTIFIC INSIGHTS ── */}
      <section className="ea-section" aria-labelledby="ea-insights-heading">
        <div className="ea-card ea-insights-card">
          <div className="ea-card-header">
            <div>
              <h2 id="ea-insights-heading" className="ea-card-title">
                <span>💡</span> El Niño & Heat Teleconnection Insights
              </h2>
              <p className="ea-card-subtitle">
                Scientific context explaining atmospheric mechanisms, empirical findings, and operational interpretations.
              </p>
            </div>
            <span className="ea-pill-badge primary">Educational Knowledge</span>
          </div>

          <div className="ea-insights-body">
            <div className="ea-insight-block">
              <h3>1. What is El Niño?</h3>
              <p>{insights.what_is_el_nino}</p>
            </div>

            <div className="ea-insight-block">
              <h3>2. What does the Oceanic Niño Index (ONI) Represent?</h3>
              <p>{insights.what_is_oni}</p>
            </div>

            <div className="ea-insight-block">
              <h3>3. How Can ENSO be Studied Alongside Indian Heat Data?</h3>
              <p>{insights.how_enso_relates_to_india_heat}</p>
            </div>

            <div className="ea-insight-block highlight">
              <h3>4. Observed Relationship in this Project's Dataset</h3>
              <p>{insights.observed_relationship_in_dataset}</p>
            </div>

            <div className="ea-insight-block warning">
              <h3>5. Correlation vs. Causation Disclaimer</h3>
              <p>{insights.scientific_disclaimer}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. DATA SOURCE & 8. LIMITATIONS ── */}
      <div className="ea-two-col-layout">
        {/* DATA SOURCE */}
        <section className="ea-section" aria-labelledby="ea-source-heading">
          <div className="ea-card ea-source-card">
            <div className="ea-source-header">
              <span className="ea-source-icon">🛰️</span>
              <div>
                <h3 id="ea-source-heading" className="ea-source-title">Authentic Data Source Disclosure</h3>
                <span className="ea-source-sub">Official Meteorological Repositories</span>
              </div>
            </div>

            <div className="ea-source-body">
              <ul className="ea-source-list">
                <li>
                  <strong>ENSO Index:</strong> {sourceInfo.index_name}
                </li>
                <li>
                  <strong>Authority:</strong> {sourceInfo.primary_source}
                </li>
                <li>
                  <strong>Official URL:</strong>{" "}
                  <a href={sourceInfo.data_url} target="_blank" rel="noopener noreferrer" className="ea-link">
                    {sourceInfo.data_url}
                  </a>
                </li>
                <li>
                  <strong>India Heat Dataset:</strong> {sourceInfo.india_data_source}
                </li>
                <li>
                  <strong>Update Schedule:</strong> {sourceInfo.update_frequency}
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* LIMITATIONS */}
        <section className="ea-section" aria-labelledby="ea-limitations-heading">
          <div className="ea-card ea-source-card limits">
            <div className="ea-source-header">
              <span className="ea-source-icon">⚠️</span>
              <div>
                <h3 id="ea-limitations-heading" className="ea-source-title">Scientific Analysis Limitations</h3>
                <span className="ea-source-sub">Important Methodological Boundaries</span>
              </div>
            </div>

            <div className="ea-source-body">
              <ul className="ea-limits-list">
                {limitations.map((limit, idx) => (
                  <li key={`lim-${idx}`}>{limit}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
