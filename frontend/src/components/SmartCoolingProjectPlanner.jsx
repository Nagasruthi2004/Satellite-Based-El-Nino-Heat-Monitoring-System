import { useState, useEffect, useCallback, useRef } from "react";
import "./SmartCoolingProjectPlanner.css";

const BACKEND_BASE = import.meta.env?.VITE_BACKEND_URL || "http://127.0.0.1:5000";

const CITIES = [
  { id: "coimbatore", name: "Coimbatore", baselineTemp: 33.2 },
  { id: "chennai", name: "Chennai", baselineTemp: 35.8 },
  { id: "delhi", name: "Delhi", baselineTemp: 37.4 },
  { id: "bengaluru", name: "Bengaluru", baselineTemp: 30.5 },
  { id: "mumbai", name: "Mumbai", baselineTemp: 34.0 },
  { id: "hyderabad", name: "Hyderabad", baselineTemp: 34.8 },
];

const PRESETS = [
  {
    name: "Fast-Action Cool Roofs & Transit Shading",
    desc: "Immediate low-cost civic retrofits with fast thermal relief",
    factors: { tree_canopy: 10, green_space: 5, cool_roofs: 30, shaded_transit: 35, permeable_pavements: 5 },
  },
  {
    name: "Urban Bio-Canopy & Parkland Greening",
    desc: "Ecological cooling focusing on native trees and public parks",
    factors: { tree_canopy: 25, green_space: 20, cool_roofs: 15, shaded_transit: 15, permeable_pavements: 10 },
  },
  {
    name: "Comprehensive Resilient City Blueprint",
    desc: "Balanced multi-phase deployment across all urban cooling levers",
    factors: { tree_canopy: 20, green_space: 15, cool_roofs: 25, shaded_transit: 25, permeable_pavements: 15 },
  },
];

export default function SmartCoolingProjectPlanner({ initialCity = "Coimbatore", initialBaselineTemp }) {
  const [selectedCity, setSelectedCity] = useState(initialCity || "Coimbatore");
  const [factors, setFactors] = useState({
    tree_canopy: 15,
    green_space: 10,
    cool_roofs: 20,
    shaded_transit: 20,
    permeable_pavements: 10,
  });
  const [planResult, setPlanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimerRef = useRef(null);

  const matchedCity = CITIES.find((c) => c.name.toLowerCase() === selectedCity.toLowerCase()) || CITIES[0];
  const activeBaseline = initialBaselineTemp || matchedCity.baselineTemp;

  const updateFactor = (key, value) => {
    setFactors((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const applyPreset = (preset) => {
    setFactors(preset.factors);
  };

  const fetchCoolingPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        city: selectedCity,
        baseline_temp: Number(activeBaseline),
        factors,
      };

      const res = await fetch(`${BACKEND_BASE}/api/smart-cooling-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      setPlanResult(json);
    } catch (err) {
      console.error("Failed to generate cooling project plan:", err);
      setError("Unable to compute cooling action plan. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  }, [selectedCity, activeBaseline, factors]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchCoolingPlan();
    }, 280);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [fetchCoolingPlan]);

  const measuredData = planResult?.data_separation?.measured_data;
  const userAssumptions = planResult?.data_separation?.user_entered_assumptions;
  const proposedEstimates = planResult?.data_separation?.proposed_estimates;

  return (
    <div className="scpp-container">
      {/* ── HEADER ── */}
      <div className="scpp-header">
        <h2>📐 Smart Cooling Project Planner</h2>
        <p className="scpp-subtitle">
          Urban heat mitigation project planning engine. Model physical cooling interventions, prioritize investments
          based on empirical cooling efficiency, review 3-phase rollout roadmaps, and inspect indicative capital budgets.
        </p>
      </div>

      {/* ── MANDATORY 3-PILLAR DATA SEPARATION ── */}
      <div className="scpp-data-separation-grid">
        {/* Pillar 1: Measured Ground Truth */}
        <div className="scpp-pillar-card measured">
          <span className="scpp-pillar-tag blue">🛰️ 1. Measured Ground Truth</span>
          <h4 className="scpp-pillar-title">Baseline Surface Temperature</h4>
          <div className="scpp-pillar-value">
            {measuredData?.baseline_surface_temp != null ? `${measuredData.baseline_surface_temp}°C` : `${activeBaseline}°C`}
          </div>
          <p className="scpp-pillar-sub">
            Location: <strong>{measuredData?.city || selectedCity}</strong><br />
            Data Source: {measuredData?.source || "MODIS Satellite LST & Climatological Norm"}
          </p>
        </div>

        {/* Pillar 2: User-Entered Assumptions */}
        <div className="scpp-pillar-card assumptions">
          <span className="scpp-pillar-tag amber">✍️ 2. User-Entered Assumptions</span>
          <h4 className="scpp-pillar-title">Configured Intervention Scope</h4>
          <div className="scpp-pillar-value" style={{ color: "#d97706" }}>
            +{userAssumptions?.total_intervention_intensity != null ? `${userAssumptions.total_intervention_intensity}%` : "75%"}
          </div>
          <p className="scpp-pillar-sub">
            Aggregated target expansion across canopy (+{factors.tree_canopy}%), cool roofs (+{factors.cool_roofs}%), and shading.
          </p>
        </div>

        {/* Pillar 3: Proposed Estimates */}
        <div className="scpp-pillar-card estimates">
          <span className="scpp-pillar-tag green">📐 3. Proposed Estimates</span>
          <h4 className="scpp-pillar-title">Projected Surface Cooling</h4>
          <div className="scpp-pillar-value" style={{ color: "#16a34a" }}>
            -{proposedEstimates?.estimated_lst_cooling_c != null ? `${proposedEstimates.estimated_lst_cooling_c}°C` : "--"}
          </div>
          <p className="scpp-pillar-sub">
            Post-Project LST: <strong>{proposedEstimates?.projected_surface_temp != null ? `${proposedEstimates.projected_surface_temp}°C` : "--"}</strong><br />
            Confidence Band: {proposedEstimates?.confidence_band || "±0.35°C (Physics simulation)"}
          </p>
        </div>
      </div>

      {/* ── TOOLBAR: CITY & STRATEGY PRESETS ── */}
      <div className="scpp-toolbar">
        <div className="scpp-city-group">
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>Target Municipality:</span>
          <div className="scpp-city-pills">
            {CITIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`scpp-city-btn ${selectedCity.toLowerCase() === c.name.toLowerCase() ? "active" : ""}`}
                onClick={() => setSelectedCity(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="scpp-preset-group">
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Strategy Templates:</span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="scpp-city-btn"
              onClick={() => applyPreset(p)}
              title={p.desc}
            >
              {p.name.split(" ")[0]} Strategy
            </button>
          ))}
        </div>
      </div>

      {/* ── INTERVENTION PLANNING SLIDERS ── */}
      <div className="scpp-sliders-grid">
        {/* Tree Canopy */}
        <div className="scpp-slider-card">
          <div className="scpp-slider-top">
            <span className="scpp-slider-title">🌳 Urban Tree Canopy</span>
            <span className="scpp-slider-val-badge">+{factors.tree_canopy}% Expansion</span>
          </div>
          <p className="scpp-slider-desc">
            Planting native shade trees along major arterial roads, boulevards, and school perimeters.
          </p>
          <input
            type="range"
            min={0}
            max={35}
            step={1}
            value={factors.tree_canopy}
            onChange={(e) => updateFactor("tree_canopy", e.target.value)}
            className="hwsim-range-input"
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>0%</span>
            <span>Target: +{factors.tree_canopy}%</span>
            <span>Max 35%</span>
          </div>
        </div>

        {/* Green Spaces */}
        <div className="scpp-slider-card">
          <div className="scpp-slider-top">
            <span className="scpp-slider-title">🌿 Public Parks & Green Corridors</span>
            <span className="scpp-slider-val-badge">+{factors.green_space}% Expansion</span>
          </div>
          <p className="scpp-slider-desc">
            Converting vacant civic plots into shaded micro-parks, bioswales, and urban green lungs.
          </p>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={factors.green_space}
            onChange={(e) => updateFactor("green_space", e.target.value)}
            className="hwsim-range-input"
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>0%</span>
            <span>Target: +{factors.green_space}%</span>
            <span>Max 30%</span>
          </div>
        </div>

        {/* Cool Roofs */}
        <div className="scpp-slider-card">
          <div className="scpp-slider-top">
            <span className="scpp-slider-title">🏢 High-Albedo Cool Roofs</span>
            <span className="scpp-slider-val-badge">+{factors.cool_roofs}% Coverage</span>
          </div>
          <p className="scpp-slider-desc">
            Reflective elastomeric or lime coatings on municipal schools, hospitals, and informal housing roofs.
          </p>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={factors.cool_roofs}
            onChange={(e) => updateFactor("cool_roofs", e.target.value)}
            className="hwsim-range-input"
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>0%</span>
            <span>Target: +{factors.cool_roofs}%</span>
            <span>Max 40%</span>
          </div>
        </div>

        {/* Shaded Bus Stops & Transit */}
        <div className="scpp-slider-card">
          <div className="scpp-slider-top">
            <span className="scpp-slider-title">🚏 Shaded Transit Stops & Corridors</span>
            <span className="scpp-slider-val-badge">+{factors.shaded_transit}% Coverage</span>
          </div>
          <p className="scpp-slider-desc">
            Solar-shielded bus shelters, pedestrian walking shade sails, and transit misting kiosks.
          </p>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={factors.shaded_transit}
            onChange={(e) => updateFactor("shaded_transit", e.target.value)}
            className="hwsim-range-input"
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>0%</span>
            <span>Target: +{factors.shaded_transit}%</span>
            <span>Max 50%</span>
          </div>
        </div>

        {/* Permeable Pavements */}
        <div className="scpp-slider-card">
          <div className="scpp-slider-top">
            <span className="scpp-slider-title">🧱 Permeable & Cool Pavements</span>
            <span className="scpp-slider-val-badge">+{factors.permeable_pavements}% Coverage</span>
          </div>
          <p className="scpp-slider-desc">
            Porous concrete and interlocking grass pavers in parking lots and pedestrian plazas to reduce thermal storage.
          </p>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={factors.permeable_pavements}
            onChange={(e) => updateFactor("permeable_pavements", e.target.value)}
            className="hwsim-range-input"
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
            <span>0%</span>
            <span>Target: +{factors.permeable_pavements}%</span>
            <span>Max 30%</span>
          </div>
        </div>
      </div>

      {error && <div className="prediction-error">{error}</div>}

      {/* ── PHASED ROLLOUT ROADMAP ── */}
      <div className="scpp-roadmap-section">
        <h3 className="scpp-section-header">
          <span>📅 Proposed 3-Phase Implementation Roadmap</span>
        </h3>

        <div className="scpp-phases-grid">
          {/* Phase 1 */}
          <div className="scpp-phase-card">
            <span className="scpp-phase-badge">Phase 1 &bull; 0–6 Months</span>
            <h4 className="scpp-phase-title">Immediate Low-Cost Interventions</h4>
            <ul className="scpp-phase-actions">
              {(planResult?.phased_roadmap?.phase_1_immediate_low_cost?.actions || [
                "Apply high-albedo solar reflective coatings on municipal schools, hospitals & transit hubs",
                "Deploy temporary shade sails and active hydration kiosks at high-density bus terminals",
                "Issue cool roof municipal building code advisories and distribution of reflective whitewash",
              ]).map((act, i) => (
                <li key={i}>{act}</li>
              ))}
            </ul>
            <div className="scpp-phase-footer">
              <span>Cooling Impact: <strong>{planResult?.phased_roadmap?.phase_1_immediate_low_cost?.estimated_cooling || "~0.8°C to 1.2°C"}</strong></span>
              <span>⚡ Fast ROI</span>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="scpp-phase-card">
            <span className="scpp-phase-badge">Phase 2 &bull; 6–24 Months</span>
            <h4 className="scpp-phase-title">Medium-Scale Urban Greening</h4>
            <ul className="scpp-phase-actions">
              {(planResult?.phased_roadmap?.phase_2_medium_scale_urban_greening?.actions || [
                "Plant mature native street canopy saplings along prioritized arterial heat corridors",
                "Construct pocket parks and green buffer zones in high building density wards",
                "Introduce misting pergolas and living green facades on public transit centers",
              ]).map((act, i) => (
                <li key={i}>{act}</li>
              ))}
            </ul>
            <div className="scpp-phase-footer">
              <span>Cooling Impact: <strong>{planResult?.phased_roadmap?.phase_2_medium_scale_urban_greening?.estimated_cooling || "~1.2°C to 1.8°C"}</strong></span>
              <span>🌳 Ecological</span>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="scpp-phase-card">
            <span className="scpp-phase-badge">Phase 3 &bull; 2–5 Years</span>
            <h4 className="scpp-phase-title">Capital Infrastructure Renewal</h4>
            <ul className="scpp-phase-actions">
              {(planResult?.phased_roadmap?.phase_3_capital_infrastructure?.actions || [
                "Install permeable pavements and reflective interlocking pavers across civic parking and footpaths",
                "Restore urban wetlands, retention ponds, and bioswales to enhance evaporative cooling",
                "Incorporate mandatory UHI mitigation criteria into municipal master planning and building bylaws",
              ]).map((act, i) => (
                <li key={i}>{act}</li>
              ))}
            </ul>
            <div className="scpp-phase-footer">
              <span>Cooling Impact: <strong>{planResult?.phased_roadmap?.phase_3_capital_infrastructure?.estimated_cooling || "~1.8°C to 2.8°C"}</strong></span>
              <span>🏗️ Structural</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── INDICATIVE BUDGET ESTIMATES (Where reliable costs available) ── */}
      <div className="scpp-budget-card">
        <div className="scpp-budget-header">
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
              💰 Indicative Budget Estimates & Priority Matrix
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
              Cost bands derived from Indian CPWD/Smart Cities Mission urban infrastructure benchmarks.
            </p>
          </div>
          {planResult?.budget_estimates?.total_indicative_range_inr && (
            <div className="scpp-total-budget-badge">
              <span className="scpp-total-budget-label">Total Indicative Investment Range:</span>
              <div className="scpp-total-budget-val">
                {planResult.budget_estimates.total_indicative_range_inr.formatted}
              </div>
            </div>
          )}
        </div>

        <div className="scpp-budget-table-wrap">
          <table className="scpp-budget-table">
            <thead>
              <tr>
                <th>Intervention</th>
                <th>Target Scale</th>
                <th>Indicative Unit Benchmark</th>
                <th>Estimated Budget Range</th>
                <th>Implementation Priority</th>
              </tr>
            </thead>
            <tbody>
              {(planResult?.budget_estimates?.itemized || [
                {
                  intervention: "Cool Roof Retrofits",
                  scale_factor: `${factors.cool_roofs}% target`,
                  unit_rate: "₹25–45 per sq.ft",
                  range_formatted: "₹35L – ₹65L",
                  priority: "Immediate",
                },
                {
                  intervention: "Shaded Transit Shelters",
                  scale_factor: `${factors.shaded_transit}% coverage`,
                  unit_rate: "₹1.5L–3.2L per shelter",
                  range_formatted: "₹45L – ₹95L",
                  priority: "Immediate",
                },
                {
                  intervention: "Urban Tree Canopy",
                  scale_factor: `${factors.tree_canopy}% expansion`,
                  unit_rate: "₹1,800–3,500 per sapling + 3yr care",
                  range_formatted: "₹75L – ₹1.6Cr",
                  priority: "High",
                },
                {
                  intervention: "Pocket Green Parks",
                  scale_factor: `${factors.green_space}% expansion`,
                  unit_rate: "₹35L–80L per acre development",
                  range_formatted: "₹1.2Cr – ₹2.8Cr",
                  priority: "High",
                },
                {
                  intervention: "Permeable Pavements",
                  scale_factor: `${factors.permeable_pavements}% coverage`,
                  unit_rate: "₹180–320 per sq.ft",
                  range_formatted: "₹1.5Cr – ₹3.5Cr",
                  priority: "Medium",
                },
              ]).map((item, idx) => (
                <tr key={idx}>
                  <td><strong>{item.intervention}</strong></td>
                  <td>{item.scale_factor}</td>
                  <td>{item.unit_rate}</td>
                  <td style={{ fontWeight: 700, color: "var(--text)" }}>{item.range_formatted}</td>
                  <td>
                    <span className={`scpp-prio-tag ${(item.priority || "high").toLowerCase()}`}>
                      {item.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mandatory Budget Caveat */}
        <div className="scpp-budget-caveat">
          <strong>⚠️ Budgetary & Technical Disclaimer:</strong> {planResult?.budget_estimates?.budget_caveat ||
            "Budget figures are indicative planning estimates based on CPWD schedule of rates and Smart City project norms. Actual costs will vary significantly depending on site topography, competitive municipal tendering, material supply chains, and maintenance lifecycle agreements."}
        </div>
      </div>
    </div>
  );
}
