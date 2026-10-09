import { useState, useEffect, useMemo } from "react";

const BACKEND_BASE = "http://127.0.0.1:5000";

const DEFAULT_CITIES = [
  {
    id: "coimbatore",
    name: "Coimbatore",
    country: "India",
    lat: 11.0168,
    lon: 76.9558,
    baseline_temp: 33.2,
    baseline_factors: { tree_cover: 28, green_cover: 22, water_bodies: 6, building_density: 58, roads_pavement: 42 },
  },
  {
    id: "chennai",
    name: "Chennai",
    country: "India",
    lat: 13.0827,
    lon: 80.2707,
    baseline_temp: 35.8,
    baseline_factors: { tree_cover: 18, green_cover: 14, water_bodies: 8, building_density: 72, roads_pavement: 54 },
  },
  {
    id: "bengaluru",
    name: "Bengaluru",
    country: "India",
    lat: 12.9716,
    lon: 77.5946,
    baseline_temp: 30.5,
    baseline_factors: { tree_cover: 32, green_cover: 26, water_bodies: 7, building_density: 64, roads_pavement: 46 },
  },
  {
    id: "delhi",
    name: "Delhi",
    country: "India",
    lat: 28.6139,
    lon: 77.2090,
    baseline_temp: 39.4,
    baseline_factors: { tree_cover: 20, green_cover: 18, water_bodies: 4, building_density: 78, roads_pavement: 56 },
  },
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    lat: 19.0760,
    lon: 72.8777,
    baseline_temp: 34.6,
    baseline_factors: { tree_cover: 19, green_cover: 15, water_bodies: 12, building_density: 82, roads_pavement: 52 },
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    country: "India",
    lat: 17.3850,
    lon: 78.4867,
    baseline_temp: 36.2,
    baseline_factors: { tree_cover: 22, green_cover: 17, water_bodies: 9, building_density: 68, roads_pavement: 48 },
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    lat: 1.3521,
    lon: 103.8198,
    baseline_temp: 32.1,
    baseline_factors: { tree_cover: 42, green_cover: 38, water_bodies: 14, building_density: 62, roads_pavement: 38 },
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    lat: 51.5074,
    lon: -0.1278,
    baseline_temp: 28.2,
    baseline_factors: { tree_cover: 35, green_cover: 32, water_bodies: 10, building_density: 58, roads_pavement: 44 },
  },
];

export default function HeatMitigationSimulator({
  selectedCity,
  onSelectCity,
  customCoords,
  customLocationName,
}) {
  const [cities, setCities] = useState(DEFAULT_CITIES);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITIES[0]);

  // 5 Adjustable Factors
  const [factors, setFactors] = useState({
    tree_cover: 35,
    green_cover: 28,
    water_bodies: 12,
    building_density: 55,
    roads_pavement: 40,
  });

  // Fetch supported cities from backend if available
  useEffect(() => {
    fetch(`${BACKEND_BASE}/api/heat-mitigation-cities`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.cities && data.cities.length > 0) {
          setCities(data.cities);
        }
      })
      .catch(() => {
        // Fall back to DEFAULT_CITIES silently
      });
  }, []);

  // Update when selectedCity changes from parent
  useEffect(() => {
    if (selectedCity) {
      setActiveCity(selectedCity);
      if (selectedCity.baseline_factors) {
        setFactors(selectedCity.baseline_factors);
      }
    }
  }, [selectedCity]);

  // Synchronize when custom map click occurs
  useEffect(() => {
    if (customCoords && !selectedCity) {
      // Create ad-hoc location profile
      const customProfile = {
        id: "custom",
        name: customLocationName || `${customCoords.lat.toFixed(4)}°, ${customCoords.lon.toFixed(4)}°`,
        country: "World Map Selection",
        lat: customCoords.lat,
        lon: customCoords.lon,
        baseline_temp: 34.0,
        baseline_factors: { tree_cover: 25, green_cover: 20, water_bodies: 10, building_density: 55, roads_pavement: 45 },
      };
      setActiveCity(customProfile);
      setFactors(customProfile.baseline_factors);
    }
  }, [customCoords, customLocationName, selectedCity]);

  const handleCitySelect = (city) => {
    setActiveCity(city);
    if (city.baseline_factors) {
      setFactors(city.baseline_factors);
    }
    onSelectCity?.(city);
  };

  const handleSliderChange = (factorKey, value) => {
    setFactors((prev) => ({
      ...prev,
      [factorKey]: Number(value),
    }));
  };

  const handleResetToBaseline = () => {
    if (activeCity?.baseline_factors) {
      setFactors(activeCity.baseline_factors);
    } else {
      setFactors({ tree_cover: 25, green_cover: 20, water_bodies: 10, building_density: 55, roads_pavement: 45 });
    }
  };

  // Empirical Urban Heat Island (UHI) Energy Balance calculation
  const simulationResult = useMemo(() => {
    const baseTemp = activeCity?.baseline_temp ?? 33.0;

    // Cooling coefficients
    const treeDelta = (factors.tree_cover - 25.0) * 0.038;
    const greenDelta = (factors.green_cover - 20.0) * 0.024;
    const waterDelta = (factors.water_bodies - 10.0) * 0.028;

    // Warming coefficients
    const buildingDelta = (factors.building_density - 50.0) * 0.032;
    const roadDelta = (factors.roads_pavement - 35.0) * 0.026;

    let netDelta = (buildingDelta + roadDelta) - (treeDelta + greenDelta + waterDelta);
    netDelta = Math.max(-6.0, Math.min(5.0, netDelta));
    const simTemp = Number((baseTemp + netDelta).toFixed(2));

    const classifyRisk = (t) => {
      if (t >= 38.0) return "Critical";
      if (t >= 34.0) return "High";
      if (t >= 30.0) return "Moderate";
      return "Low";
    };

    const baseRisk = classifyRisk(baseTemp);
    const simRisk = classifyRisk(simTemp);

    const baseRiskScore = Math.min(100, Math.max(0, Math.round((baseTemp - 24.0) * 6.5)));
    const simRiskScore = Math.min(100, Math.max(0, Math.round((simTemp - 24.0) * 6.5)));
    const riskScoreDelta = simRiskScore - baseRiskScore;

    const basePrep = Math.max(20, Math.min(95, 100 - baseRiskScore));
    const simPrep = Math.max(20, Math.min(95, 100 - simRiskScore));
    const prepDelta = simPrep - basePrep;

    // Infrastructure targets
    const simulatedTrees = Math.round(1200 + (factors.tree_cover / 100.0) * 8500);
    const treesDeficit = Math.max(0, Math.round((50.0 - factors.tree_cover) * 120));
    const waterSurfaceHa = (5.0 + (factors.water_bodies / 100.0) * 45.0).toFixed(1);
    const permeablePavementHa = Math.max(0, (factors.roads_pavement - 25.0) * 0.8).toFixed(1);

    return {
      baseTemp,
      simTemp,
      netDelta: Number(netDelta.toFixed(2)),
      baseRisk,
      simRisk,
      baseRiskScore,
      simRiskScore,
      riskScoreDelta,
      basePrep,
      simPrep,
      prepDelta,
      coolingBreakdown: {
        treeCooling: Number(treeDelta.toFixed(2)),
        greenCooling: Number(greenDelta.toFixed(2)),
        waterCooling: Number(waterDelta.toFixed(2)),
        buildingWarming: Number(buildingDelta.toFixed(2)),
        roadWarming: Number(roadDelta.toFixed(2)),
      },
      infrastructure: {
        simulatedTrees,
        treesDeficit,
        waterSurfaceHa,
        permeablePavementHa,
      },
    };
  }, [activeCity, factors]);

  return (
    <div className="siha-simulator-container">
      {/* ── 1. CITY SELECTOR & HEADER ── */}
      <section className="siha-simulator-header-card">
        <div className="siha-sim-header-row">
          <div>
            <span className="siha-badge">Urban Microclimate Simulation Engine</span>
            <h2 className="siha-sim-title">Global Heat Mitigation What-If Simulator</h2>
            <p className="siha-sim-sub">
              Adjust urban vegetation, canopy shading, blue infrastructure, and built surface density to simulate cooling scenarios on the World Map.
            </p>
          </div>

          <button
            type="button"
            className="siha-reset-baseline-btn"
            onClick={handleResetToBaseline}
            title="Reset all factors to calibrated city baseline"
          >
            ↺ Reset to City Baseline
          </button>
        </div>

        {/* Supported City Quick-Pills */}
        <div className="siha-sim-city-bar">
          <span className="sim-city-title">Select Supported City on Map:</span>
          <div className="sim-city-items">
            {cities.map((c) => {
              const isSelected = activeCity?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`siha-sim-city-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => handleCitySelect(c)}
                >
                  <span className="dot" />
                  <strong>{c.name}</strong>
                  <small>({c.baseline_temp}°C)</small>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 2. TWO-COLUMN WORKBENCH: CONTROLS vs COMPARISON METRICS ── */}
      <div className="siha-sim-workbench-grid">
        {/* Left Column: 5 Adjustable Sliders */}
        <section className="siha-sim-controls-card">
          <div className="controls-card-title-row">
            <div>
              <span className="siha-badge">Urban Landscape Inputs</span>
              <h3 className="controls-heading">Adjustable Mitigation Factors</h3>
            </div>
            <span className="active-city-tag">
              Target: <strong>{activeCity?.name || "Selected Location"}</strong> ({activeCity?.country})
            </span>
          </div>

          <div className="siha-sliders-stack">
            {/* Factor 1: Trees Cover */}
            <div className="siha-slider-item">
              <div className="slider-label-row">
                <span className="slider-name">
                  <span className="icon">🌳</span> Tree Canopy Cover
                </span>
                <span className="slider-value trees">{factors.tree_cover}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={factors.tree_cover}
                onChange={(e) => handleSliderChange("tree_cover", e.target.value)}
                className="siha-range-slider trees"
              />
              <div className="slider-caption">Provides direct solar shading and active transpiration cooling</div>
            </div>

            {/* Factor 2: Green Cover */}
            <div className="siha-slider-item">
              <div className="slider-label-row">
                <span className="slider-name">
                  <span className="icon">🌿</span> Vegetated Green Cover &amp; Parks
                </span>
                <span className="slider-value green">{factors.green_cover}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={factors.green_cover}
                onChange={(e) => handleSliderChange("green_cover", e.target.value)}
                className="siha-range-slider green"
              />
              <div className="slider-caption">Increases latent heat flux and buffers urban soil moisture</div>
            </div>

            {/* Factor 3: Water Bodies */}
            <div className="siha-slider-item">
              <div className="slider-label-row">
                <span className="slider-name">
                  <span className="icon">💧</span> Water Bodies &amp; Cooling Reservoirs
                </span>
                <span className="slider-value water">{factors.water_bodies}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={factors.water_bodies}
                onChange={(e) => handleSliderChange("water_bodies", e.target.value)}
                className="siha-range-slider water"
              />
              <div className="slider-caption">High specific heat capacity creates local evaporative microclimates</div>
            </div>

            {/* Factor 4: Building Density */}
            <div className="siha-slider-item">
              <div className="slider-label-row">
                <span className="slider-name">
                  <span className="icon">🏢</span> Building Density &amp; Built-up Mass
                </span>
                <span className="slider-value building">{factors.building_density}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={factors.building_density}
                onChange={(e) => handleSliderChange("building_density", e.target.value)}
                className="siha-range-slider building"
              />
              <div className="slider-caption">Traps longwave thermal radiation within urban street canyons</div>
            </div>

            {/* Factor 5: Roads & Pavements */}
            <div className="siha-slider-item">
              <div className="slider-label-row">
                <span className="slider-name">
                  <span className="icon">🛣️</span> Roads &amp; Impervious Pavements
                </span>
                <span className="slider-value roads">{factors.roads_pavement}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={factors.roads_pavement}
                onChange={(e) => handleSliderChange("roads_pavement", e.target.value)}
                className="siha-range-slider roads"
              />
              <div className="slider-caption">Low albedo asphalt re-radiates sensible solar heat back to ground level</div>
            </div>
          </div>
        </section>

        {/* Right Column: Comparative Results */}
        <section className="siha-sim-results-card">
          <div className="results-card-title-row">
            <span className="siha-badge">Baseline vs Simulated Comparison</span>
            <h3 className="results-heading">Scenario Microclimate Projection</h3>
          </div>

          {/* Hero Comparison Matrix */}
          <div className="siha-sim-hero-metrics">
            <div className="sim-metric-box baseline">
              <span className="metric-tag">BASELINE</span>
              <strong className="metric-temp">{simulationResult.baseTemp.toFixed(1)}°C</strong>
              <span className={`metric-risk ${simulationResult.baseRisk.toLowerCase()}`}>
                {simulationResult.baseRisk} Heat Risk
              </span>
              <small className="metric-score">Risk Score: {simulationResult.baseRiskScore}/100</small>
            </div>

            <div className="sim-metric-delta-box">
              <span className="delta-lbl">PROJECTED DELTA</span>
              <strong className={`delta-val ${simulationResult.netDelta <= 0 ? "cooling" : "warming"}`}>
                {simulationResult.netDelta > 0 ? `+${simulationResult.netDelta}` : simulationResult.netDelta}°C
              </strong>
              <small className="delta-status">
                {simulationResult.netDelta < 0
                  ? "✓ Urban Cooling Achieved"
                  : simulationResult.netDelta === 0
                  ? "Neutral Thermal Balance"
                  : "⚠️ Heat Island Intensification"}
              </small>
            </div>

            <div className="sim-metric-box simulated">
              <span className="metric-tag">SIMULATED</span>
              <strong className="metric-temp simulated">{simulationResult.simTemp.toFixed(1)}°C</strong>
              <span className={`metric-risk ${simulationResult.simRisk.toLowerCase()}`}>
                {simulationResult.simRisk} Heat Risk
              </span>
              <small className="metric-score">Risk Score: {simulationResult.simRiskScore}/100</small>
            </div>
          </div>

          {/* Preparedness Score Shift */}
          <div className="siha-prep-shift-card">
            <div className="prep-shift-header">
              <span className="prep-lbl">Heat Preparedness &amp; Resilience Score:</span>
              <span className="prep-change">
                {simulationResult.basePrep} → <strong>{simulationResult.simPrep}/100</strong>
                <span className={`prep-pill ${simulationResult.prepDelta >= 0 ? "pos" : "neg"}`}>
                  {simulationResult.prepDelta >= 0 ? `+${simulationResult.prepDelta}` : simulationResult.prepDelta} pts
                </span>
              </span>
            </div>
            <div className="prep-progress-track">
              <div
                className="prep-progress-fill"
                style={{ width: `${simulationResult.simPrep}%` }}
              />
            </div>
          </div>

          {/* Cooling & Warming Contributions Breakdown */}
          <div className="siha-contributions-card">
            <h4 className="contrib-title">Thermal Energy Balance Contributions:</h4>
            <div className="contrib-bars">
              <div className="contrib-item">
                <span className="contrib-name">🌳 Tree Canopy Cooling:</span>
                <strong className="contrib-val cooling">
                  {simulationResult.coolingBreakdown.treeCooling >= 0
                    ? `-${simulationResult.coolingBreakdown.treeCooling}°C`
                    : `+${Math.abs(simulationResult.coolingBreakdown.treeCooling)}°C`}
                </strong>
              </div>
              <div className="contrib-item">
                <span className="contrib-name">🌿 Green Space Latent Flux:</span>
                <strong className="contrib-val cooling">
                  {simulationResult.coolingBreakdown.greenCooling >= 0
                    ? `-${simulationResult.coolingBreakdown.greenCooling}°C`
                    : `+${Math.abs(simulationResult.coolingBreakdown.greenCooling)}°C`}
                </strong>
              </div>
              <div className="contrib-item">
                <span className="contrib-name">💧 Water Surface Buffering:</span>
                <strong className="contrib-val cooling">
                  {simulationResult.coolingBreakdown.waterCooling >= 0
                    ? `-${simulationResult.coolingBreakdown.waterCooling}°C`
                    : `+${Math.abs(simulationResult.coolingBreakdown.waterCooling)}°C`}
                </strong>
              </div>
              <div className="contrib-item">
                <span className="contrib-name">🏢 Building Thermal Trapping:</span>
                <strong className="contrib-val warming">
                  +{simulationResult.coolingBreakdown.buildingWarming}°C
                </strong>
              </div>
              <div className="contrib-item">
                <span className="contrib-name">🛣️ Pavement Heat Re-radiation:</span>
                <strong className="contrib-val warming">
                  +{simulationResult.coolingBreakdown.roadWarming}°C
                </strong>
              </div>
            </div>
          </div>

          {/* Targeted Infrastructure Interventions */}
          <div className="siha-infra-targets-grid">
            <div className="infra-target-item">
              <span className="infra-icon">🌲</span>
              <span className="infra-lbl">Target Tree Canopy:</span>
              <strong className="infra-val">{simulationResult.infrastructure.simulatedTrees.toLocaleString()} trees</strong>
              <small className="infra-sub">+{simulationResult.infrastructure.treesDeficit} to reach 50% target</small>
            </div>

            <div className="infra-target-item">
              <span className="infra-icon">🏞️</span>
              <span className="infra-lbl">Water Body Surface:</span>
              <strong className="infra-val">{simulationResult.infrastructure.waterSurfaceHa} ha</strong>
              <small className="infra-sub">Cooling retention ponds</small>
            </div>

            <div className="infra-target-item">
              <span className="infra-icon">🛡️</span>
              <span className="infra-lbl">Permeable Surface:</span>
              <strong className="infra-val">{simulationResult.infrastructure.permeablePavementHa} ha</strong>
              <small className="infra-sub">Cool pavement conversion</small>
            </div>
          </div>
        </section>
      </div>

      {/* ── 3. MANDATORY ASSUMPTIONS & ILLUSTRATIVE ESTIMATES DISCLAIMER ── */}
      <section className="siha-simulator-disclaimer-card" role="note">
        <div className="disclaimer-icon">⚠️</div>
        <div className="disclaimer-content">
          <h4>Scientific Notice &amp; Scenario Modeling Assumptions</h4>
          <p>
            <strong>Illustrative Scenario Estimates:</strong> This simulation calculates comparative microclimate sensitivity using empirical Urban Heat Island (UHI) surface energy balance factors (sensible heat flux, latent cooling, and impervious surface re-radiation).
          </p>
          <p>
            Results represent hypothetical urban planning scenario sensitivity projections and <strong>do not claim precise empirical temperature reductions or formal physical model validation</strong>. Real-world microclimates depend on regional synoptic wind patterns, seasonal humidity, boundary layer heights, and diurnal solar elevation.
          </p>
        </div>
      </section>
    </div>
  );
}
