import { useState, useEffect, useCallback, useRef } from "react";
import "./HeatwaveImpactSimulator.css";

const BACKEND_BASE = import.meta.env?.VITE_BACKEND_URL || "http://127.0.0.1:5000";

const SCENARIOS = [
  {
    id: "outdoor_work",
    name: "Outdoor Construction & Agriculture",
    icon: "🚧",
    desc: "Unshaded manual laborers exposed to direct solar radiation and metabolic heat accumulation.",
    vuln: "Highest vulnerability to acute exertional heat stroke and dehydration",
    defaultActions: ["frequent_hydration_rest", "shift_work_hours", "shaded_cooling_zones", "personal_electrolyte_replenishment"],
    actionsList: [
      { id: "shift_work_hours", label: "Shift heavy physical labor to 05:30–11:00 AM & evenings", eff: "+32% Strain Cut" },
      { id: "frequent_hydration_rest", label: "Mandatory 15-minute shaded rest per hour of labor", eff: "+30% Strain Cut" },
      { id: "shaded_cooling_zones", label: "Provide portable shaded rest pavilions with misting fans", eff: "+22% Strain Cut" },
      { id: "personal_electrolyte_replenishment", label: "Free chilled potable water and oral electrolyte packets", eff: "+18% Strain Cut" },
      { id: "buddy_system_monitoring", label: "Buddy system for immediate heat exhaustion detection", eff: "+15% Strain Cut" },
    ],
  },
  {
    id: "school",
    name: "School & Educational Institution",
    icon: "🏫",
    desc: "Children and adolescents with developing thermoregulatory capacity in non-AC classrooms.",
    vuln: "High risk of rapid core temperature elevation and cognitive fatigue",
    defaultActions: ["morning_shift_curfew", "hydration_breaks", "sports_restriction"],
    actionsList: [
      { id: "morning_shift_curfew", label: "Restrict all outdoor playground & assembly activities (<10 AM)", eff: "+25% Strain Cut" },
      { id: "sports_restriction", label: "Suspend high-intensity sports, marathons & physical drills", eff: "+22% Strain Cut" },
      { id: "hydration_breaks", label: "Hourly compulsory hydration bells and cool drinking water", eff: "+20% Strain Cut" },
      { id: "class_cooling_fans", label: "High-volume air circulators, wet curtains & shaded classrooms", eff: "+18% Strain Cut" },
      { id: "first_aid_ors_station", label: "Dedicated school health room with ORS and ice pack wraps", eff: "+15% Strain Cut" },
    ],
  },
  {
    id: "office",
    name: "Commercial Office & Indoor Workplace",
    icon: "🏢",
    desc: "Commercial workplace facilities with computer heat loads, transit commutes, and HVAC limits.",
    vuln: "Moderate thermal discomfort, grid brownout risk, and afternoon commute heat stress",
    defaultActions: ["flexible_remote_work", "optimized_ac_climate"],
    actionsList: [
      { id: "flexible_remote_work", label: "Work-from-home advisory during peak heatwave alert days", eff: "+28% Strain Cut" },
      { id: "optimized_ac_climate", label: "HVAC thermal comfort zoning maintained at 24°C–26°C", eff: "+22% Strain Cut" },
      { id: "commute_shift", label: "Staggered office hours to avoid peak 12–4 PM commute transit", eff: "+18% Strain Cut" },
      { id: "hydration_stations", label: "Chilled water coolers & mineral electrolyte dispensers", eff: "+15% Strain Cut" },
      { id: "dress_code_relaxation", label: "Relax formal attire to lightweight breathable cottons", eff: "+12% Strain Cut" },
    ],
  },
  {
    id: "elder_care",
    name: "Elder Care & Assisted Residential Facility",
    icon: "👵",
    desc: "Senior citizens (>65 years) with chronic cardiovascular conditions and blunted thirst response.",
    vuln: "Critical risk of non-exertional classical heat stroke and organ strain",
    defaultActions: ["active_air_conditioning", "proactive_hydration_monitoring", "vital_signs_tracking"],
    actionsList: [
      { id: "active_air_conditioning", label: "Air-conditioned communal refuge rooms (<26°C) 24/7", eff: "+35% Strain Cut" },
      { id: "proactive_hydration_monitoring", label: "Staff-assisted proactive hydration schedule every 45 mins", eff: "+25% Strain Cut" },
      { id: "emergency_cooling_packs", label: "Rapid cooling protocol with evaporative ice towel compresses", eff: "+22% Strain Cut" },
      { id: "vital_signs_tracking", label: "Twice-daily core temperature and blood pressure telemetry", eff: "+20% Strain Cut" },
      { id: "solar_shading_curtains", label: "External reflective thermal blinds on sunward facades", eff: "+16% Strain Cut" },
    ],
  },
];

const PRESETS = [
  { label: "Normal Summer (34°C, 45%)", temp: 34, rh: 45, days: 2 },
  { label: "Severe Heatwave (41°C, 35%)", temp: 41, rh: 35, days: 4 },
  { label: "Humid Monsoon Heat (38°C, 75%)", temp: 38, rh: 75, days: 3 },
  { label: "Extreme Red Alert (47°C, 25%)", temp: 47, rh: 25, days: 6 },
];

export default function HeatwaveImpactSimulator({ initialTemperature = 38 }) {
  const [selectedScenarioId, setSelectedScenarioId] = useState("outdoor_work");
  const [temperature, setTemperature] = useState(
    typeof initialTemperature === "number" && !isNaN(initialTemperature)
      ? Math.min(50, Math.max(28, Math.round(initialTemperature)))
      : 39
  );
  const [humidity, setHumidity] = useState(42);
  const [durationDays, setDurationDays] = useState(4);
  const [selectedActions, setSelectedActions] = useState(SCENARIOS[0].defaultActions);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimerRef = useRef(null);

  const currentScenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  const handleScenarioChange = (scenarioId) => {
    setSelectedScenarioId(scenarioId);
    const target = SCENARIOS.find((s) => s.id === scenarioId);
    if (target) {
      setSelectedActions(target.defaultActions);
    }
  };

  const toggleAction = (actionId) => {
    setSelectedActions((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  };

  const applyPreset = (preset) => {
    setTemperature(preset.temp);
    setHumidity(preset.rh);
    setDurationDays(preset.days);
  };

  // Run simulation query
  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        scenario: selectedScenarioId,
        temperature: Number(temperature),
        relative_humidity: Number(humidity),
        duration_days: Number(durationDays),
        protective_actions: selectedActions,
      };

      const res = await fetch(`${BACKEND_BASE}/api/heatwave-simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setSimResult(data);
    } catch (err) {
      console.error("Simulation request failed:", err);
      setError("Unable to connect to simulation engine. Please check backend server.");
    } finally {
      setLoading(false);
    }
  }, [selectedScenarioId, temperature, humidity, durationDays, selectedActions]);

  // Debounced auto-run when inputs change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      runSimulation();
    }, 250);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [runSimulation]);

  return (
    <div className="hwsim-container">
      {/* ── HEADER & DISCLAIMER ── */}
      <div className="hwsim-header">
        <h2>⚡ Heatwave Impact Simulator</h2>
        <p className="hwsim-subtitle">
          Configure thermal intensity, atmospheric humidity, and heatwave duration to model occupational and institutional
          heat strain. Compare unmitigated baseline impacts against proactive preparedness interventions.
        </p>

        {/* Mandatory Illustrative Disclaimer */}
        <div className="hwsim-disclaimer">
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div className="hwsim-disclaimer-text">
            <strong>ILLUSTRATIVE PLANNING MODEL ONLY:</strong> This simulator generates thermal strain approximations based on
            standard meteorological heat indices (NOAA Heat Index & ISO 7243 WBGT ergonomics).
            <strong> It is NOT a validated clinical medical prediction, individualized health diagnostic, or official weather forecast.</strong>{" "}
            Always adhere to official district meteorological bulletins and occupational safety directives.
          </div>
        </div>
      </div>

      {/* ── SCENARIO SELECTOR ── */}
      <div className="hwsim-scenarios-section">
        <span className="hwsim-section-label">1. Select Target Vulnerability Scenario:</span>
        <div className="hwsim-scenarios-grid">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className={`hwsim-scenario-card ${selectedScenarioId === sc.id ? "active" : ""}`}
              onClick={() => handleScenarioChange(sc.id)}
            >
              <span className="hwsim-card-icon">{sc.icon}</span>
              <span className="hwsim-card-title">{sc.name}</span>
              <span className="hwsim-card-desc">{sc.desc}</span>
              <span className="hwsim-card-vuln">{sc.vuln}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTROLS & ACTIONS ── */}
      <div className="hwsim-controls-grid">
        {/* Left: Meteorological Sliders */}
        <div className="hwsim-panel">
          <div className="hwsim-panel-title">
            <span>🌡️ Environmental Heat Intensity</span>
          </div>

          {/* Quick Presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Quick Presets:</span>
            <div className="hwsim-presets">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="hwsim-preset-btn"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature Slider */}
          <div className="hwsim-slider-group">
            <div className="hwsim-slider-header">
              <span className="hwsim-slider-label">Ambient Maximum Temperature</span>
              <span className="hwsim-slider-value">{temperature}°C ({(temperature * 1.8 + 32).toFixed(1)}°F)</span>
            </div>
            <input
              type="range"
              min={25}
              max={55}
              step={0.5}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="hwsim-range-input"
            />
            <div className="hwsim-slider-bounds">
              <span>25°C (Mild)</span>
              <span>40°C (Heatwave)</span>
              <span>55°C (Extreme)</span>
            </div>
          </div>

          {/* Humidity Slider */}
          <div className="hwsim-slider-group">
            <div className="hwsim-slider-header">
              <span className="hwsim-slider-label">Relative Humidity (RH)</span>
              <span className="hwsim-slider-value">{humidity}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={95}
              step={1}
              value={humidity}
              onChange={(e) => setHumidity(parseInt(e.target.value, 10))}
              className="hwsim-range-input"
            />
            <div className="hwsim-slider-bounds">
              <span>10% (Arid Desert)</span>
              <span>50% (Moderate)</span>
              <span>95% (Oppressive Coastal)</span>
            </div>
          </div>

          {/* Duration Slider */}
          <div className="hwsim-slider-group">
            <div className="hwsim-slider-header">
              <span className="hwsim-slider-label">Consecutive Heatwave Duration</span>
              <span className="hwsim-slider-value">{durationDays} Day{durationDays > 1 ? "s" : ""}</span>
            </div>
            <input
              type="range"
              min={1}
              max={14}
              step={1}
              value={durationDays}
              onChange={(e) => setDurationDays(parseInt(e.target.value, 10))}
              className="hwsim-range-input"
            />
            <div className="hwsim-slider-bounds">
              <span>1 Day (Spike)</span>
              <span>5 Days (Cumulative Strain)</span>
              <span>14 Days (Extended Crisis)</span>
            </div>
          </div>
        </div>

        {/* Right: Protective Interventions Checkboxes */}
        <div className="hwsim-panel">
          <div className="hwsim-panel-title">
            <span>🛡️ Active Protective Measures ({currentScenario.name})</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-8px" }}>
            Select institutional actions implemented on the ground to mitigate physical heat accumulation:
          </p>

          <div className="hwsim-actions-list">
            {currentScenario.actionsList.map((action) => {
              const isChecked = selectedActions.includes(action.id);
              return (
                <label
                  key={action.id}
                  className={`hwsim-action-item ${isChecked ? "checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleAction(action.id)}
                  />
                  <div className="hwsim-action-body">
                    <span className="hwsim-action-label">{action.label}</span>
                    <span className="hwsim-action-eff">{action.eff}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ERROR MESSAGE ── */}
      {error && <div className="prediction-error">{error}</div>}

      {/* ── SIDE-BY-SIDE SIMULATION COMPARISON ── */}
      {simResult && (
        <>
          {/* Transition Summary Bar */}
          <div className="hwsim-transition-banner">
            <div className="hwsim-transition-text">
              Simulation Transition:{" "}
              <span style={{ color: simResult.baseline?.risk_color || "var(--danger)" }}>
                {simResult.baseline?.risk_category}
              </span>{" "}
              ➔{" "}
              <span style={{ color: simResult.preparedness?.risk_color || "var(--success)" }}>
                {simResult.preparedness?.risk_category}
              </span>
            </div>
            {simResult.risk_transition?.net_strain_reduction_points > 0 && (
              <span className="hwsim-reduction-pill">
                ✓ Strain Reduced by {simResult.risk_transition.net_strain_reduction_points} Points (
                {simResult.preparedness?.protective_score}% Protection)
              </span>
            )}
          </div>

          <div className="hwsim-comparison-grid">
            {/* ── LEFT: BASELINE SCENARIO (Unmitigated) ── */}
            <div className="hwsim-comp-card baseline">
              <div className="hwsim-comp-header">
                <div>
                  <span className="hwsim-comp-tag base">Unmitigated Baseline</span>
                  <h3 className="hwsim-comp-title">Default Environmental Risk</h3>
                </div>
                <span
                  className="hwsim-risk-badge"
                  style={{ background: simResult.baseline?.risk_color || "#dc2626" }}
                >
                  {simResult.baseline?.risk_category} Risk
                </span>
              </div>

              {/* Strain Score Metric */}
              <div className="hwsim-metric-block">
                <span
                  className="hwsim-metric-val"
                  style={{ color: simResult.baseline?.risk_color || "var(--danger)" }}
                >
                  {simResult.baseline?.thermal_strain_score}
                </span>
                <span className="hwsim-metric-unit">/ 100 Thermal Strain Index</span>
              </div>

              {/* Strain Bar */}
              <div className="hwsim-strain-bar-track">
                <div
                  className="hwsim-strain-bar-fill"
                  style={{
                    width: `${Math.min(100, simResult.baseline?.thermal_strain_score)}%`,
                    background: simResult.baseline?.risk_color || "#dc2626",
                  }}
                />
              </div>

              {/* Secondary Indicators */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                <span>Apparent Heat Index: <strong>{simResult.baseline?.heat_index}°C</strong></span>
                <span>Estimated WBGT: <strong>{simResult.baseline?.wet_bulb_globe_temp_est}°C</strong></span>
              </div>

              {/* Unmitigated Hazards */}
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text)", display: "block", marginBottom: "8px" }}>
                  Expected Unmitigated Impacts & Vulnerabilities:
                </strong>
                <ul className="hwsim-impacts-list">
                  {(simResult.baseline?.impacts || []).map((imp, idx) => (
                    <li key={idx} className="negative">{imp}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── RIGHT: PREPAREDNESS SCENARIO (Mitigated) ── */}
            <div className="hwsim-comp-card preparedness">
              <div className="hwsim-comp-header">
                <div>
                  <span className="hwsim-comp-tag prep">Proactive Preparedness</span>
                  <h3 className="hwsim-comp-title">With Selected Interventions</h3>
                </div>
                <span
                  className="hwsim-risk-badge"
                  style={{ background: simResult.preparedness?.risk_color || "#16a34a" }}
                >
                  {simResult.preparedness?.risk_category} Risk
                </span>
              </div>

              {/* Mitigated Strain Score Metric */}
              <div className="hwsim-metric-block">
                <span
                  className="hwsim-metric-val"
                  style={{ color: simResult.preparedness?.risk_color || "var(--success)" }}
                >
                  {simResult.preparedness?.mitigated_strain_score}
                </span>
                <span className="hwsim-metric-unit">/ 100 Residual Strain Index</span>
              </div>

              {/* Strain Bar */}
              <div className="hwsim-strain-bar-track">
                <div
                  className="hwsim-strain-bar-fill"
                  style={{
                    width: `${Math.min(100, simResult.preparedness?.mitigated_strain_score)}%`,
                    background: simResult.preparedness?.risk_color || "#16a34a",
                  }}
                />
              </div>

              {/* Protection Score */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                <span>Protective Mitigation: <strong>{simResult.preparedness?.protective_score}%</strong></span>
                <span>Active Measures: <strong>{selectedActions.length} Applied</strong></span>
              </div>

              {/* Residual Impacts & Benefits */}
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text)", display: "block", marginBottom: "8px" }}>
                  Intervention Outcomes & Safety Posture:
                </strong>
                <ul className="hwsim-impacts-list">
                  {(simResult.preparedness?.residual_impacts || []).map((imp, idx) => (
                    <li key={idx} className="positive">{imp}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── FOOTER REFERENCE ── */}
      <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "4px" }}>
        Ergonomic Modeling Reference: US OSHA-NIOSH Heat Stress Matrix & ISO 7243 (Hot environments — Estimation of heat stress on working man).
      </div>
    </div>
  );
}
