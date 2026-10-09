import { useState, useEffect, useCallback, useMemo } from "react";

const BACKEND_BASE = "http://127.0.0.1:5000";

const DEFAULT_INTERVENTIONS = [
  {
    id: "tree_canopy",
    title: "Urban Tree Canopy Expansion",
    icon: "🌳",
    category: "Nature-Based Solution",
    factor_key: "tree_cover",
    delta_pct: 15,
    description: "Strategic planting of high-transpiration indigenous shade trees along roadways, pedestrian verges, and parking zones.",
    mechanism: "Evapotranspirative latent heat dissipation combined with solar canopy interception protects pavement from solar radiation.",
    co_benefits: ["Air particulate filtration", "Stormwater retention", "Urban biodiversity"],
    feasibility: "High",
  },
  {
    id: "cool_roofs",
    title: "Cool Roofs & High-Albedo Retrofits",
    icon: "🏠",
    category: "Surface Albedo Modification",
    factor_key: "building_density",
    delta_pct: -15,
    description: "Application of solar reflective coatings (Solar Reflectance Index SRI >= 78) across commercial and residential rooftops.",
    mechanism: "High reflectance prevents daytime rooftop heat absorption and reduces diurnal thermal mass re-radiation.",
    co_benefits: ["10–25% indoor cooling energy savings", "Reduced HVAC peak load", "Extended roof lifespan"],
    feasibility: "Very High",
  },
  {
    id: "green_spaces",
    title: "Urban Green Corridors & Micro-Parks",
    icon: "🌿",
    category: "Nature-Based Solution",
    factor_key: "green_cover",
    delta_pct: 12,
    description: "Conversion of vacant easements, road medians, and parking borders into permeable vegetative pocket parks.",
    mechanism: "Creates localized cool air buffers and encourages convective microclimatic air circulation across dense urban canyons.",
    co_benefits: ["Neighborhood recreational space", "Groundwater recharge", "Acoustic dampening"],
    feasibility: "Moderate",
  },
  {
    id: "cool_pavements",
    title: "Cool & Permeable Pavements",
    icon: "🛣️",
    category: "Infrastructure Material",
    factor_key: "roads_pavement",
    delta_pct: -12,
    description: "Deployment of light-colored permeable concrete pavers and reflective sealants on low-traffic streets and walkways.",
    mechanism: "Decreases asphalt thermal heat capacity and enables evaporative cooling through soil moisture permeability.",
    co_benefits: ["Reduced stormwater runoff", "Lower night-time ambient heat release"],
    feasibility: "Moderate",
  },
  {
    id: "water_bodies",
    title: "Urban Water Bodies & Bioswales",
    icon: "💧",
    category: "Blue Infrastructure",
    factor_key: "water_bodies",
    delta_pct: 6,
    description: "Restoration of urban retention ponds, daylighting buried drainage streams, and integrating public water misting hubs.",
    mechanism: "High specific heat capacity buffers daytime thermal spikes and enhances microclimatic humidity balancing.",
    co_benefits: ["Flood resilience", "Urban aesthetic and recreation", "Microclimate humidity balancing"],
    feasibility: "High",
  },
];

export default function HeatReductionActionPlanner({
  selectedCity,
  onSelectCity,
  supportedCities = [],
  customCoords,
  customLocationName,
  onSwitchToSimulator,
}) {
  const [interventions, setInterventions] = useState(DEFAULT_INTERVENTIONS);
  const [activeActions, setActiveActions] = useState({
    tree_canopy: true,
    cool_roofs: true,
    green_spaces: false,
    cool_pavements: false,
    water_bodies: false,
  });

  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Fetch interventions from backend if available
  useEffect(() => {
    fetch(`${BACKEND_BASE}/api/heat-reduction-actions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.interventions?.length) {
          setInterventions(data.interventions);
        }
      })
      .catch(() => {});
  }, []);

  // Compute active factors based on baseline factors and active actions
  const effectiveFactors = useMemo(() => {
    const base = selectedCity?.baseline_factors || {
      tree_cover: 25,
      green_cover: 20,
      water_bodies: 8,
      building_density: 65,
      roads_pavement: 45,
    };

    const next = { ...base };

    if (activeActions.tree_canopy) next.tree_cover = Math.min(100, next.tree_cover + 15);
    if (activeActions.cool_roofs) next.building_density = Math.max(0, next.building_density - 15);
    if (activeActions.green_spaces) next.green_cover = Math.min(100, next.green_cover + 12);
    if (activeActions.cool_pavements) next.roads_pavement = Math.max(0, next.roads_pavement - 12);
    if (activeActions.water_bodies) next.water_bodies = Math.min(100, next.water_bodies + 6);

    return next;
  }, [selectedCity, activeActions]);

  // Run simulation via backend API
  const runSimulation = useCallback(async () => {
    setSimulating(true);
    const baselineTemp = selectedCity?.baseline_temp || 34.0;
    const locName = selectedCity?.name || customLocationName || "Selected Region";

    try {
      const res = await fetch(`${BACKEND_BASE}/api/heat-mitigation-simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseline_temp: baselineTemp,
          factors: effectiveFactors,
          location_name: locName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
      }
    } catch (err) {
      // Deterministic client fallback if offline
      const tDelta = (effectiveFactors.tree_cover - 25) * 0.038 +
        (effectiveFactors.green_cover - 20) * 0.024 +
        (effectiveFactors.water_bodies - 10) * 0.028;
      const bDelta = (effectiveFactors.building_density - 50) * 0.032;
      const rDelta = (effectiveFactors.roads_pavement - 35) * 0.026;
      const netDelta = Math.max(-6.0, Math.min(5.0, Number(((bDelta + rDelta) - tDelta).toFixed(2))));
      const simTemp = Number((baselineTemp + netDelta).toFixed(2));

      setSimulationResult({
        baseline: {
          temperature_celsius: baselineTemp,
          heat_risk: baselineTemp >= 38 ? "Critical" : baselineTemp >= 34 ? "High" : "Moderate",
          risk_score: Math.min(100, Math.max(0, Math.round((baselineTemp - 24) * 6.5))),
          preparedness_score: Math.max(20, Math.min(95, Math.round(100 - (baselineTemp - 24) * 6.5))),
        },
        simulated: {
          temperature_celsius: simTemp,
          temperature_delta_celsius: netDelta,
          heat_risk: simTemp >= 38 ? "Critical" : simTemp >= 34 ? "High" : "Moderate",
          risk_score: Math.min(100, Math.max(0, Math.round((simTemp - 24) * 6.5))),
          risk_score_delta: Number((simTemp - baselineTemp).toFixed(1)),
          preparedness_score: Math.max(20, Math.min(95, Math.round(100 - (simTemp - 24) * 6.5))),
          preparedness_delta: Math.round((baselineTemp - simTemp) * 5),
        },
        methodology_label: "Illustrative Scenario Estimates (Urban Surface Energy Balance Model)",
        assumptions_note: "Empirical planning estimate. Not formally validated microscale prediction.",
      });
    } finally {
      setSimulating(false);
    }
  }, [selectedCity, customLocationName, effectiveFactors]);

  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  const toggleAction = (actionId) => {
    setActiveActions((prev) => ({
      ...prev,
      [actionId]: !prev[actionId],
    }));
  };

  const activeCount = Object.values(activeActions).filter(Boolean).length;

  return (
    <div className="siha-action-planner-container">
      {/* ── MANDATORY SCIENTIFIC TRANSPARENCY DISCLAIMER ── */}
      <div className="siha-disclaimer-card" role="note">
        <div className="siha-disclaimer-icon">📐</div>
        <div className="siha-disclaimer-body">
          <h4>Illustrative Scenario Estimates Notice</h4>
          <p>
            Projected temperature reductions are illustrative scenario estimates derived from empirical urban surface energy balance models.
            They provide comparative sensitivity analysis for municipal planning and do NOT represent formal microclimatic forecasts or guarantees of exact temperature reductions.
          </p>
        </div>
      </div>

      {/* ── CITY SELECTOR BAR ── */}
      <div className="siha-planner-city-strip">
        <div className="siha-pcity-info">
          <span className="siha-pcity-tag">Target Urban Region:</span>
          <h3 className="siha-pcity-name">
            {selectedCity?.name || customLocationName || "Select Region"} ({selectedCity?.country || "Global"})
          </h3>
          <span className="siha-pcity-baseline">
            Baseline LST: <strong>{selectedCity?.baseline_temp || 34.0}°C</strong> | {selectedCity?.description || "Urban Heat Island Corridor"}
          </span>
        </div>

        {/* Quick select pills */}
        {supportedCities.length > 0 && (
          <div className="siha-pcity-pills">
            <span className="siha-pcity-pill-lbl">Switch City:</span>
            {supportedCities.slice(0, 6).map((c) => {
              const isSelected = selectedCity?.name === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  className={`siha-pcity-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectCity?.(c)}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TOP KPI COMPARISON BAR (BASELINE VS SIMULATED) ── */}
      <div className="siha-planner-kpi-bar">
        <div className="siha-pkpi-card">
          <span className="siha-pkpi-lbl">Baseline Surface Temp</span>
          <strong className="siha-pkpi-val">{simulationResult?.baseline?.temperature_celsius ?? "—"}°C</strong>
          <span className="siha-pkpi-risk">{simulationResult?.baseline?.heat_risk} Risk</span>
        </div>

        <div className="siha-pkpi-card highlight">
          <span className="siha-pkpi-lbl">Simulated Cooling Delta</span>
          <strong className="siha-pkpi-val cool">
            {simulationResult?.simulated?.temperature_delta_celsius !== undefined
              ? `${simulationResult.simulated.temperature_delta_celsius > 0 ? "+" : ""}${simulationResult.simulated.temperature_delta_celsius}°C`
              : "—"}
          </strong>
          <small className="siha-pkpi-sub">
            {activeCount} Action{activeCount !== 1 ? "s" : ""} Deployed
          </small>
        </div>

        <div className="siha-pkpi-card">
          <span className="siha-pkpi-lbl">Projected Outcome LST</span>
          <strong className="siha-pkpi-val">
            {simulationResult?.simulated?.temperature_celsius ?? "—"}°C
          </strong>
          <span className="siha-pkpi-risk cool">{simulationResult?.simulated?.heat_risk} Risk</span>
        </div>

        <div className="siha-pkpi-card">
          <span className="siha-pkpi-lbl">Preparedness Index</span>
          <strong className="siha-pkpi-val">
            {simulationResult?.simulated?.preparedness_score ?? "—"} / 100
          </strong>
          <span className="siha-pkpi-change">
            +{simulationResult?.simulated?.preparedness_delta ?? 0} pts Improvement
          </span>
        </div>
      </div>

      {/* ── MAIN INTERVENTIONS CATALOG & IMPACT MATRIX ── */}
      <div className="siha-planner-main-grid">
        {/* Left: Interventions Selection */}
        <div className="siha-interventions-panel">
          <div className="siha-ipanel-header">
            <h4>Heat Reduction Action Catalog</h4>
            <span className="siha-active-badge">{activeCount} of {interventions.length} Activated</span>
          </div>

          <div className="siha-interventions-list">
            {interventions.map((action) => {
              const isActive = Boolean(activeActions[action.id]);
              return (
                <div
                  key={action.id}
                  className={`siha-action-card ${isActive ? "active" : ""}`}
                >
                  <div className="siha-action-card-header">
                    <div className="siha-action-icon-title">
                      <span className="siha-action-icon">{action.icon}</span>
                      <div>
                        <strong className="siha-action-title">{action.title}</strong>
                        <span className="siha-action-category">{action.category}</span>
                      </div>
                    </div>
                    <label className="siha-switch">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleAction(action.id)}
                      />
                      <span className="siha-slider round" />
                    </label>
                  </div>

                  <p className="siha-action-desc">{action.description}</p>

                  <div className="siha-action-mechanism">
                    <strong>Physical Mechanism:</strong> {action.mechanism}
                  </div>

                  <div className="siha-action-footer">
                    <div className="siha-action-impact">
                      <span>Projected LST Delta:</span>
                      <strong>{action.estimated_lst_impact || `~0.3°C to 0.6°C`}</strong>
                    </div>
                    <div className="siha-action-cobenefits">
                      {action.co_benefits?.slice(0, 2).map((cb, idx) => (
                        <span key={idx} className="siha-cobenefit-pill">
                          ✓ {cb}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Planning Summary & Cross-Link to What-If Simulator */}
        <div className="siha-planner-summary-panel">
          <div className="siha-psummary-card">
            <h4>Active Scenario Action Package</h4>
            <p className="siha-psummary-desc">
              Summary of urban physical interventions currently modeled for {selectedCity?.name || "Selected Region"}:
            </p>

            <ul className="siha-action-summary-list">
              {interventions.map((action) => {
                const isActive = Boolean(activeActions[action.id]);
                return (
                  <li key={action.id} className={isActive ? "active" : "inactive"}>
                    <span className="siha-asum-icon">{action.icon}</span>
                    <span className="siha-asum-title">{action.title}</span>
                    <span className="siha-asum-status">
                      {isActive ? "Enabled" : "Disabled"}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Seamless Transition to What-If Simulator */}
            <div className="siha-link-to-simulator-box">
              <h5>Fine-Tune with Interactive Microclimate Sliders</h5>
              <p>
                Want to customize exact canopy percentages, road reflectivity, and building densities individually?
                Seamlessly transfer these action settings into the What-If Simulator.
              </p>
              <button
                type="button"
                className="siha-btn-goto-simulator"
                onClick={() => onSwitchToSimulator?.(effectiveFactors)}
              >
                🎛️ Open in What-If Simulator &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
