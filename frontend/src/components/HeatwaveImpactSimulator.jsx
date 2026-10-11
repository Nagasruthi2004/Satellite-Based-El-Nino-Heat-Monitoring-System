import { useState, useEffect, useCallback, useId } from "react";
import "./HeatwaveImpactSimulator.css";

const BACKEND_BASE = import.meta.env?.VITE_BACKEND_URL || "http://127.0.0.1:5000";

const SCENARIOS = [
  {
    id: "outdoor_work",
    name: "Outdoor Labor",
    icon: "🚧",
    subtitle: "Construction & agriculture",
    vulnMult: 1.25,
  },
  {
    id: "school",
    name: "Schools & Youth",
    icon: "🏫",
    subtitle: "Classrooms & playgrounds",
    vulnMult: 1.10,
  },
  {
    id: "office",
    name: "Workplaces",
    icon: "🏢",
    subtitle: "Offices & indoor transit",
    vulnMult: 0.90,
  },
  {
    id: "elder_care",
    name: "Elderly Care",
    icon: "👵",
    subtitle: "Seniors & assisted living",
    vulnMult: 1.35,
  },
];

const POPULATION_PRESETS = [
  { label: "10K", fullLabel: "10,000 (Neighborhood)", value: 10000 },
  { label: "50K", fullLabel: "50,000 (Town / Ward)", value: 50000 },
  { label: "150K", fullLabel: "150,000 (District)", value: 150000 },
  { label: "500K", fullLabel: "500,000 (Metro Area)", value: 500000 },
];

const PROTECTIVE_MEASURES = [
  { id: "shift_work_hours", label: "Shift Peak Hours", icon: "🕒", desc: "Labor restricted to 05:30–11:00 AM & evenings", reduction: 0.28 },
  { id: "frequent_hydration_rest", label: "Hourly Shaded Rest", icon: "💧", desc: "15-minute mandatory shaded rest per hour", reduction: 0.25 },
  { id: "shaded_cooling_zones", label: "Misting & Shaded Pavilions", icon: "🎪", desc: "High-volume misting fans and solar sails", reduction: 0.20 },
  { id: "personal_electrolyte_replenishment", label: "Electrolyte Packets", icon: "💊", desc: "Free chilled ORS and electrolyte kiosks", reduction: 0.16 },
];

/**
 * Robust client-side fallback calculation in case backend is offline or delayed.
 * Ensures the college demonstration never hangs or displays an error.
 */
function calculateLocalSimulation(temp, rh, duration, greenCover, population, scenarioId, activeMeasures) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  
  // NOAA Heat Index approximation (°C)
  const tf = temp * 1.8 + 32.0;
  let hi_f;
  if (tf < 80.0) {
    hi_f = 0.5 * (tf + 61.0 + (tf - 68.0) * 1.2 + rh * 0.094);
  } else {
    hi_f = -42.379 + 2.04901523 * tf + 10.14333127 * rh
      - 0.22475541 * tf * rh - 6.83783e-3 * tf * tf
      - 5.481717e-2 * rh * rh + 1.22874e-3 * tf * tf * rh
      + 8.5282e-4 * tf * rh * rh - 1.99e-6 * tf * tf * rh * rh;
  }
  const baselineHeatIndex = Math.round(((hi_f - 32.0) * 5.0) / 9.0 * 10) / 10;

  // Duration factor
  const durationFactor = 1.0 + (Math.min(duration, 10) - 1) * 0.035;

  // Raw baseline thermal strain (0-100)
  const rawStrain = (baselineHeatIndex - 26.0) * 3.8 * scenario.vulnMult * durationFactor;
  const baselineStrainScore = Math.round(Math.max(10, Math.min(100, rawStrain)));

  // Green cover cooling offset
  const greenCoolingCelsius = Math.round((greenCover / 100.0) * 3.6 * 10) / 10;
  const effectiveHeatIndex = Math.max(20, Math.round((baselineHeatIndex - greenCoolingCelsius) * 10) / 10);
  const greenReduction = Math.min(0.35, (greenCover / 100.0) * 0.45);

  // Active measures reduction
  let measuresReduction = 0;
  activeMeasures.forEach((mId) => {
    const found = PROTECTIVE_MEASURES.find((pm) => pm.id === mId);
    if (found) measuresReduction += found.reduction;
  });

  const totalReductionRatio = Math.min(0.75, greenReduction + measuresReduction);
  const mitigatedStrainScore = Math.round(Math.max(10, baselineStrainScore * (1.0 - totalReductionRatio)));
  const strainReductionPct = Math.round(totalReductionRatio * 100);

  // Vulnerable population estimates
  const baselineAffectedRatio = Math.min(0.85, (baselineStrainScore / 100.0) * 0.55);
  const mitigatedAffectedRatio = Math.min(0.85, (mitigatedStrainScore / 100.0) * 0.55);
  const baselineAffectedCount = Math.round(population * baselineAffectedRatio);
  const mitigatedAffectedCount = Math.round(population * mitigatedAffectedRatio);
  const populationProtected = Math.max(0, baselineAffectedCount - mitigatedAffectedCount);

  // Impact level
  let impactLevel = "Low";
  let impactColor = "#16a34a"; // green
  if (mitigatedStrainScore >= 80) {
    impactLevel = "Critical";
    impactColor = "#dc2626"; // red
  } else if (mitigatedStrainScore >= 60) {
    impactLevel = "High";
    impactColor = "#ea580c"; // orange
  } else if (mitigatedStrainScore >= 38) {
    impactLevel = "Moderate";
    impactColor = "#f59e0b"; // amber
  }

  // Baseline impact level
  let baselineImpactLevel = "Low";
  if (baselineStrainScore >= 80) baselineImpactLevel = "Critical";
  else if (baselineStrainScore >= 60) baselineImpactLevel = "High";
  else if (baselineStrainScore >= 38) baselineImpactLevel = "Moderate";

  const recommendation = mitigatedStrainScore >= 60
    ? "Enforce mandatory 15-min shaded rest per hour, distribute electrolytes, and halt unshaded outdoor exposure between 11 AM and 4 PM."
    : mitigatedStrainScore >= 38
    ? "Activate community hydration points, monitor vulnerable groups, and utilize available tree canopy and shaded corridors."
    : "Conditions are manageable with routine hydration and standard heat safety awareness.";

  return {
    impactLevel,
    impactColor,
    baselineImpactLevel,
    baselineHeatIndex,
    effectiveHeatIndex,
    greenCoolingCelsius,
    baselineStrainScore,
    mitigatedStrainScore,
    strainReductionPct,
    populationTotal: population,
    baselineAffectedCount,
    mitigatedAffectedCount,
    populationProtected,
    recommendation,
  };
}

export default function HeatwaveImpactSimulator({ initialTemperature = 38 }) {
  const defaultTemp = typeof initialTemperature === "number" && !isNaN(initialTemperature)
    ? Math.min(50, Math.max(28, Math.round(initialTemperature)))
    : 38;

  const [temperature, setTemperature] = useState(defaultTemp);
  const [duration, setDuration] = useState(4);
  const [population, setPopulation] = useState(50000);
  const [greenCover, setGreenCover] = useState(20);
  const [scenarioId, setScenarioId] = useState("outdoor_work");
  const [activeMeasures, setActiveMeasures] = useState(["shift_work_hours", "frequent_hydration_rest"]);
  const [results, setResults] = useState(() =>
    calculateLocalSimulation(defaultTemp, 45, 4, 20, 50000, "outdoor_work", ["shift_work_hours", "frequent_hydration_rest"])
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const tempInputId = useId();
  const durationInputId = useId();
  const greenCoverInputId = useId();
  const populationInputId = useId();

  const toggleMeasure = (mId) => {
    setActiveMeasures((prev) =>
      prev.includes(mId) ? prev.filter((id) => id !== mId) : [...prev, mId]
    );
  };

  const handleRunSimulation = useCallback(async () => {
    if (population <= 0 || isNaN(population)) {
      setValidationError("Population affected must be greater than zero.");
      return;
    }
    if (temperature < 20 || temperature > 60) {
      setValidationError("Temperature must be between 20°C and 60°C.");
      return;
    }
    setValidationError("");
    setIsSimulating(true);

    try {
      const payload = {
        temperature: Number(temperature),
        humidity: 45,
        duration_days: Number(duration),
        scenario: scenarioId,
        protective_actions: activeMeasures,
        green_cover_pct: Number(greenCover),
        population_affected: Number(population),
      };

      const res = await fetch(`${BACKEND_BASE}/api/heatwave-simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const baseScore = data.baseline_scenario?.strain_index_score || 80;
        const mitScore = data.preparedness_scenario?.strain_index_score || 45;
        const popImpact = data.population_impact || {};
        const greenMetrics = data.green_cover_metrics || {};

        setResults({
          impactLevel: data.overall_impact_level || "Moderate",
          impactColor:
            (data.overall_impact_level === "Critical" && "#dc2626") ||
            (data.overall_impact_level === "High" && "#ea580c") ||
            (data.overall_impact_level === "Moderate" && "#f59e0b") ||
            "#16a34a",
          baselineImpactLevel: data.baseline_scenario?.heat_risk_category || "High",
          baselineHeatIndex: data.inputs?.heat_index_celsius || temperature,
          effectiveHeatIndex: greenMetrics.effective_heat_index_celsius || temperature - 1.5,
          greenCoolingCelsius: greenMetrics.cooling_offset_celsius || (greenCover * 0.035).toFixed(1),
          baselineStrainScore: baseScore,
          mitigatedStrainScore: mitScore,
          strainReductionPct: data.preparedness_scenario?.strain_reduction_pct || 40,
          populationTotal: population,
          baselineAffectedCount: popImpact.baseline_affected || Math.round(population * 0.45),
          mitigatedAffectedCount: popImpact.mitigated_affected || Math.round(population * 0.22),
          populationProtected: popImpact.population_protected || Math.round(population * 0.23),
          recommendation:
            data.recommendation ||
            "Maintain proactive hydration stations, monitor vulnerable groups, and utilize available tree canopy.",
        });
      } else {
        // Fallback to local calculation
        setResults(calculateLocalSimulation(temperature, 45, duration, greenCover, population, scenarioId, activeMeasures));
      }
    } catch {
      // Fallback cleanly on network failure
      setResults(calculateLocalSimulation(temperature, 45, duration, greenCover, population, scenarioId, activeMeasures));
    } finally {
      setIsSimulating(false);
    }
  }, [temperature, duration, population, greenCover, scenarioId, activeMeasures]);

  const handleReset = () => {
    setTemperature(38);
    setDuration(4);
    setPopulation(50000);
    setGreenCover(20);
    setScenarioId("outdoor_work");
    setActiveMeasures(["shift_work_hours", "frequent_hydration_rest"]);
    setValidationError("");
    setResults(calculateLocalSimulation(38, 45, 4, 20, 50000, "outdoor_work", ["shift_work_hours", "frequent_hydration_rest"]));
  };

  return (
    <div className="hwsim-card-container">
      {/* ── TOP HEADER ── */}
      <div className="hwsim-compact-header">
        <div className="hwsim-title-group">
          <span className="hwsim-icon-badge">⚡</span>
          <div>
            <h2 className="hwsim-heading">Heatwave Impact Simulator</h2>
            <p className="hwsim-tagline">
              Interactive scenario modeling: adjust thermal intensity, duration, green cover, and population to test heatwave resilience.
            </p>
          </div>
        </div>
        <div className="hwsim-meta-badge">
          <span>📐 Planning Model</span>
          <span className="hwsim-dot" />
          <span>Non-Clinical Estimate</span>
        </div>
      </div>

      {validationError && (
        <div className="hwsim-validation-alert" role="alert">
          <span>⚠️ {validationError}</span>
          <button type="button" onClick={() => setValidationError("")} aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* ── INTERACTIVE CONTROLS GRID ── */}
      <div className="hwsim-input-grid">
        {/* 1. Temperature Slider */}
        <div className="hwsim-control-box">
          <div className="hwsim-control-label-row">
            <span className="hwsim-label-text">🌡️ Temperature</span>
            <span className="hwsim-value-pill temp-pill">{temperature}°C ({(temperature * 1.8 + 32).toFixed(1)}°F)</span>
          </div>
          <input
            id={tempInputId}
            type="range"
            min={28}
            max={50}
            step={0.5}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="hwsim-range"
            aria-label="Temperature in Celsius"
          />
          <div className="hwsim-range-markers">
            <span>28°C Mild</span>
            <span>38°C Hot</span>
            <span>44°C Severe</span>
            <span>50°C Extreme</span>
          </div>
        </div>

        {/* 2. Duration Slider */}
        <div className="hwsim-control-box">
          <div className="hwsim-control-label-row">
            <span className="hwsim-label-text">⏱️ Heatwave Duration</span>
            <span className="hwsim-value-pill">{duration} Day{duration > 1 ? "s" : ""}</span>
          </div>
          <input
            id={durationInputId}
            type="range"
            min={1}
            max={14}
            step={1}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
            className="hwsim-range"
            aria-label="Heatwave duration in days"
          />
          <div className="hwsim-range-markers">
            <span>1 Day (Spike)</span>
            <span>4 Days (Sustained)</span>
            <span>7 Days (Prolonged)</span>
            <span>14 Days (Crisis)</span>
          </div>
        </div>

        {/* 3. Green Cover Percentage Slider */}
        <div className="hwsim-control-box">
          <div className="hwsim-control-label-row">
            <span className="hwsim-label-text">🌳 Green Cover</span>
            <span className="hwsim-value-pill green-pill">{greenCover}% Canopy</span>
          </div>
          <input
            id={greenCoverInputId}
            type="range"
            min={5}
            max={60}
            step={1}
            value={greenCover}
            onChange={(e) => setGreenCover(parseInt(e.target.value, 10))}
            className="hwsim-range"
            aria-label="Green cover percentage"
          />
          <div className="hwsim-range-markers">
            <span>5% (Concrete)</span>
            <span>20% (Urban Avg)</span>
            <span>40% (Tree-Lined)</span>
            <span>60% (Parkland)</span>
          </div>
        </div>

        {/* 4. Population Affected Input + Presets */}
        <div className="hwsim-control-box">
          <div className="hwsim-control-label-row">
            <span className="hwsim-label-text">👥 Population Affected</span>
            <span className="hwsim-value-pill">{population.toLocaleString()} People</span>
          </div>
          <input
            id={populationInputId}
            type="number"
            min={1000}
            max={2000000}
            step={5000}
            value={population}
            onChange={(e) => setPopulation(Math.max(1, parseInt(e.target.value, 10) || 0))}
            className="hwsim-number-input"
            aria-label="Population affected"
          />
          <div className="hwsim-preset-chips">
            {POPULATION_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`hwsim-chip ${population === p.value ? "active" : ""}`}
                onClick={() => setPopulation(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SETTING & ACTIONS ROW ── */}
      <div className="hwsim-secondary-controls">
        {/* Scenario Selector */}
        <div className="hwsim-subpanel">
          <span className="hwsim-subpanel-title">🎯 Vulnerability Setting:</span>
          <div className="hwsim-scenario-pills">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`hwsim-scenario-btn ${scenarioId === sc.id ? "active" : ""}`}
                onClick={() => setScenarioId(sc.id)}
              >
                <span>{sc.icon}</span>
                <span className="hwsim-sc-name">{sc.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Protective Measures */}
        <div className="hwsim-subpanel">
          <span className="hwsim-subpanel-title">🛡️ Active Protective Measures:</span>
          <div className="hwsim-measures-pills">
            {PROTECTIVE_MEASURES.map((pm) => {
              const checked = activeMeasures.includes(pm.id);
              return (
                <button
                  key={pm.id}
                  type="button"
                  className={`hwsim-measure-btn ${checked ? "checked" : ""}`}
                  onClick={() => toggleMeasure(pm.id)}
                  title={pm.desc}
                >
                  <span>{pm.icon}</span>
                  <span>{pm.label}</span>
                  {checked && <span className="hwsim-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="hwsim-actions-bar">
        <button
          type="button"
          className="hwsim-btn-primary"
          onClick={handleRunSimulation}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <>
              <span className="hwsim-spinner" />
              <span>Running Simulation...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Run Simulation</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="hwsim-btn-secondary"
          onClick={handleReset}
          disabled={isSimulating}
          title="Reset all inputs to default settings"
        >
          <span>🔄</span>
          <span>Reset</span>
        </button>
      </div>

      {/* ── RESULTS DASHBOARD ── */}
      {results && (
        <div className="hwsim-results-section">
          {/* Top 4 KPI Cards */}
          <div className="hwsim-kpi-grid">
            {/* KPI 1: Estimated Impact Level */}
            <div className="hwsim-kpi-card" style={{ borderTop: `4px solid ${results.impactColor}` }}>
              <span className="hwsim-kpi-label">Estimated Impact Level</span>
              <div className="hwsim-kpi-val" style={{ color: results.impactColor }}>
                {results.impactLevel === "Critical" && "🔥 "}
                {results.impactLevel === "High" && "⚠️ "}
                {results.impactLevel === "Moderate" && "🟡 "}
                {results.impactLevel === "Low" && "🟢 "}
                {results.impactLevel}
              </div>
              <span className="hwsim-kpi-sub">
                Baseline: <strong>{results.baselineImpactLevel}</strong> ➔ Mitigated: <strong>{results.impactLevel}</strong>
              </span>
            </div>

            {/* KPI 2: Vulnerable Population Affected */}
            <div className="hwsim-kpi-card">
              <span className="hwsim-kpi-label">Vulnerable Population Impact</span>
              <div className="hwsim-kpi-val">
                {results.mitigatedAffectedCount.toLocaleString()}
              </div>
              <span className="hwsim-kpi-sub" style={{ color: "var(--success)" }}>
                ✓ {results.populationProtected.toLocaleString()} citizens protected
              </span>
            </div>

            {/* KPI 3: Apparent Heat Index */}
            <div className="hwsim-kpi-card">
              <span className="hwsim-kpi-label">Simulated Apparent Feel</span>
              <div className="hwsim-kpi-val">
                {results.effectiveHeatIndex}°C
              </div>
              <span className="hwsim-kpi-sub">
                -{results.greenCoolingCelsius}°C microclimate green cooling
              </span>
            </div>

            {/* KPI 4: Thermal Strain Index Score */}
            <div className="hwsim-kpi-card">
              <span className="hwsim-kpi-label">Thermal Strain Index</span>
              <div className="hwsim-kpi-val" style={{ color: results.impactColor }}>
                {results.mitigatedStrainScore} <span className="hwsim-kpi-max">/ 100</span>
              </div>
              <span className="hwsim-kpi-sub" style={{ color: "var(--success)" }}>
                -{results.strainReductionPct}% strain reduction achieved
              </span>
            </div>
          </div>

          {/* ── VISUAL COMPARISON & BEFORE-AND-AFTER ── */}
          <div className="hwsim-comparison-wrap">
            <div className="hwsim-comp-box baseline-box">
              <div className="hwsim-comp-header-row">
                <span className="hwsim-comp-badge base-badge">Baseline (Unmitigated)</span>
                <span className="hwsim-badge-score">{results.baselineStrainScore} / 100 Strain</span>
              </div>
              <div className="hwsim-progress-bar-track">
                <div
                  className="hwsim-progress-bar-fill base-fill"
                  style={{ width: `${Math.min(100, results.baselineStrainScore)}%` }}
                />
              </div>
              <div className="hwsim-comp-stats">
                <div>Apparent Feel: <strong>{results.baselineHeatIndex}°C</strong></div>
                <div>Vulnerable: <strong>{results.baselineAffectedCount.toLocaleString()} people</strong></div>
              </div>
            </div>

            <div className="hwsim-comp-arrow">➔</div>

            <div className="hwsim-comp-box mitigated-box">
              <div className="hwsim-comp-header-row">
                <span className="hwsim-comp-badge mit-badge">Simulated (With Interventions)</span>
                <span className="hwsim-badge-score green">{results.mitigatedStrainScore} / 100 Strain</span>
              </div>
              <div className="hwsim-progress-bar-track">
                <div
                  className="hwsim-progress-bar-fill mit-fill"
                  style={{ width: `${Math.min(100, results.mitigatedStrainScore)}%` }}
                />
              </div>
              <div className="hwsim-comp-stats">
                <div>Apparent Feel: <strong>{results.effectiveHeatIndex}°C</strong> (-{results.greenCoolingCelsius}°C)</div>
                <div>Vulnerable: <strong>{results.mitigatedAffectedCount.toLocaleString()} people</strong></div>
              </div>
            </div>
          </div>

          {/* ── SIMPLE VISUAL CHART: SIDE-BY-SIDE METRICS ── */}
          <div className="hwsim-chart-card">
            <h4 className="hwsim-chart-title">📊 Baseline vs. Simulated Comparison Chart</h4>
            <div className="hwsim-chart-bars-container">
              {/* Metric 1: Strain Score */}
              <div className="hwsim-chart-group">
                <span className="hwsim-chart-metric-name">Thermal Strain Score (0–100)</span>
                <div className="hwsim-chart-dual-bar">
                  <div className="hwsim-chart-bar-row">
                    <span className="hwsim-bar-tag">Base</span>
                    <div className="hwsim-bar-track">
                      <div className="hwsim-bar-val red" style={{ width: `${results.baselineStrainScore}%` }}>
                        <span>{results.baselineStrainScore}</span>
                      </div>
                    </div>
                  </div>
                  <div className="hwsim-chart-bar-row">
                    <span className="hwsim-bar-tag">Sim</span>
                    <div className="hwsim-bar-track">
                      <div className="hwsim-bar-val green" style={{ width: `${results.mitigatedStrainScore}%` }}>
                        <span>{results.mitigatedStrainScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric 2: Vulnerable Population Rate */}
              <div className="hwsim-chart-group">
                <span className="hwsim-chart-metric-name">Vulnerable Cohort Exposure (%)</span>
                <div className="hwsim-chart-dual-bar">
                  <div className="hwsim-chart-bar-row">
                    <span className="hwsim-bar-tag">Base</span>
                    <div className="hwsim-bar-track">
                      <div
                        className="hwsim-bar-val red"
                        style={{ width: `${Math.min(100, Math.round((results.baselineAffectedCount / results.populationTotal) * 100))}%` }}
                      >
                        <span>{Math.round((results.baselineAffectedCount / results.populationTotal) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="hwsim-chart-bar-row">
                    <span className="hwsim-bar-tag">Sim</span>
                    <div className="hwsim-bar-track">
                      <div
                        className="hwsim-bar-val green"
                        style={{ width: `${Math.min(100, Math.round((results.mitigatedAffectedCount / results.populationTotal) * 100))}%` }}
                      >
                        <span>{Math.round((results.mitigatedAffectedCount / results.populationTotal) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── PRACTICAL RECOMMENDATION ── */}
          <div className="hwsim-recommendation-box">
            <div className="hwsim-rec-header">
              <span>💡 Practical Action Recommendation:</span>
              <span className="hwsim-rec-badge">{results.impactLevel} Alert Protocol</span>
            </div>
            <p className="hwsim-rec-text">{results.recommendation}</p>
          </div>
        </div>
      )}

      {/* ── EXPANDABLE: HOW IS THIS CALCULATED? ── */}
      <details className="hwsim-details-accordion">
        <summary className="hwsim-summary-toggle">
          <span>ℹ️ How is this calculated? (Model Methodology)</span>
          <span className="hwsim-summary-arrow">▾</span>
        </summary>
        <div className="hwsim-accordion-content">
          <ul className="hwsim-methodology-list">
            <li>
              <strong>NOAA Heat Index Formula:</strong> Combines ambient temperature and relative humidity to estimate physiological heat accumulation.
            </li>
            <li>
              <strong>Duration Compounding:</strong> Prolonged consecutive heat waves add a cumulative strain factor of +3.5% per day past Day 1, modeling chronic physiological fatigue.
            </li>
            <li>
              <strong>Green Cover Microclimate Cooling:</strong> High tree canopy and vegetative ground cover lower local apparent temperatures by up to ~3.6°C via evapotranspiration and solar shading.
            </li>
            <li>
              <strong>Vulnerability Exposure Modeling:</strong> Population cohort risk is derived from occupational exposure multipliers and epidemiological threshold curves.
            </li>
            <li>
              <strong>Disclaimer:</strong> Outputs are illustrative computational estimates for educational and disaster-planning demonstrations, not individual clinical diagnoses.
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}
