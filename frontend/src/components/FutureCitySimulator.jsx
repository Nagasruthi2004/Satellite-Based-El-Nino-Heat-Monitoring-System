import { useEffect, useState } from "react";
import { formatTemperature, formatTemperatureDelta } from "../utils/temperature";

const SIMULATION_FACTORS = [
  { id: "treeCover", label: "🌳 Tree Cover (%)" },
  { id: "buildingDensity", label: "🏢 Building Density (%)" },
  { id: "waterBodies", label: "💧 Water Bodies (%)" },
];

export default function FutureCitySimulator({ currentTemperature, onValuesChange }) {
  const [factors, setFactors] = useState({
    treeCover: 50,
    buildingDensity: 50,
    waterBodies: 50,
  });

  const [result, setResult] = useState(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    onValuesChange?.({ ...factors, result });
  }, [factors, result, onValuesChange]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFactors((current) => ({
      ...current,
      [name]: Number(value),
    }));
  };

  const runSimulation = () => {
    const baseTemperature = Number(currentTemperature);

    if (!Number.isFinite(baseTemperature)) {
      setResult(null);
      setSuccess("");
      return;
    }

    const treeReduction = (factors.treeCover / 10) * 0.4;
    const buildingIncrease = (factors.buildingDensity / 10) * 0.5;
    const waterReduction = (factors.waterBodies / 10) * 0.3;

    const predictedTemperature =
      baseTemperature -
      treeReduction +
      buildingIncrease -
      waterReduction;

    let heatRisk = "Low";

    if (predictedTemperature > 35) {
      heatRisk = "High";
    } else if (predictedTemperature >= 30) {
      heatRisk = "Medium";
    }

    // Calculate sector-level simulated infrastructure and environmental counts
    // Based on the simulator's tree cover, building density, and water bodies factors
    const treeCover = factors.treeCover;
    const buildingDensity = factors.buildingDensity;
    const waterBodies = factors.waterBodies;

    // 1. Trees: simulated sector tree population
    const currentTrees = Math.round(40 + (treeCover / 100) * 2400);
    const targetTreeCover = heatRisk === "High" ? 75 : heatRisk === "Medium" ? 65 : 55;
    const treeDeficit = Math.max(0, targetTreeCover - treeCover);
    const recommendedTrees = treeDeficit > 0 ? Math.round((treeDeficit / 100) * 2333) : 0;

    // 2. Water Bodies: ponds, retention lakes, cooling reservoirs
    const currentWaterBodies = Math.round((waterBodies / 100) * 16);
    const targetWaterBodies = heatRisk === "High" ? 70 : heatRisk === "Medium" ? 65 : 50;
    const waterDeficit = Math.max(0, targetWaterBodies - waterBodies);
    const recommendedWaterBodies = waterDeficit > 0 ? Math.max(1, Math.round((waterDeficit / 100) * 20)) : 0;

    // 3. Buildings: structural built-up count
    const currentBuildings = Math.round(350 + (buildingDensity / 100) * 5000);

    // 4. Roads: road network segments
    const currentRoads = Math.round(120 + (buildingDensity / 100) * 600);

    // 5. Green Spaces: public parks, open vegetated zones
    const currentGreenSpaces = Math.round(10 + (treeCover / 100) * 50);
    const greenSpaceDeficit = Math.max(0, targetTreeCover - treeCover);
    const recommendedGreenSpaces = greenSpaceDeficit > 0 ? Math.round((greenSpaceDeficit / 100) * 66.6) : 0;

    const infrastructure = [
      {
        id: "trees",
        label: "Trees",
        icon: "🌳",
        current: currentTrees,
        recommended: recommendedTrees,
      },
      {
        id: "waterBodies",
        label: "Water Bodies",
        icon: "💧",
        current: currentWaterBodies,
        recommended: recommendedWaterBodies,
      },
      {
        id: "buildings",
        label: "Buildings",
        icon: "🏢",
        current: currentBuildings,
        recommended: null,
      },
      {
        id: "roads",
        label: "Roads",
        icon: "🛣️",
        current: currentRoads,
        recommended: null,
      },
      {
        id: "greenSpaces",
        label: "Green Spaces",
        icon: "🌿",
        current: currentGreenSpaces,
        recommended: recommendedGreenSpaces,
      },
    ];

    setResult({
      baseTemperature,
      predictedTemperature,
      heatRisk,
      treeReduction,
      buildingIncrease,
      waterReduction,
      infrastructure,
    });

    setSuccess("✅ Simulation completed successfully.");
  };

  return (
    <div className="card future-city-simulator">
      <h2 className="section-title">
        🏙️ Future City Heat Simulator
      </h2>

      <p className="future-city-intro">
        Adjust the future city conditions to prepare a heat simulation.
      </p>

      <div className="future-city-controls">
        {SIMULATION_FACTORS.map(({ id, label }) => (
          <label className="future-city-field" key={id}>
            <span className="future-city-label">
              {label}
              <strong>{factors[id]}%</strong>
            </span>

            <input
              type="range"
              name={id}
              min="0"
              max="100"
              value={factors[id]}
              onChange={handleChange}
            />
          </label>
        ))}
      </div>

      <button
        className="search-btn"
        style={{ marginTop: "20px" }}
        onClick={runSimulation}
      >
        🔄 Run Simulation
      </button>

      {success && (
        <p className="future-city-success">
          {success}
        </p>
      )}

      <div className="future-city-results">
        <h3>Results</h3>

        {!result ? (
          <p>
            <strong>Explanation:</strong> Waiting for simulation...
          </p>
        ) : (
          <>
            <p>
              <strong>Current Temperature:</strong>{" "}
              {formatTemperature(result.baseTemperature)}
            </p>

            <h4>Simulation Impact</h4>

            <p>
              🌳 Tree Cover :
              <strong> {formatTemperatureDelta(-result.treeReduction)}</strong>
            </p>

            <p>
              🏢 Building Density :
              <strong> {formatTemperatureDelta(result.buildingIncrease)}</strong>
            </p>

            <p>
              💧 Water Bodies :
              <strong> {formatTemperatureDelta(-result.waterReduction)}</strong>
            </p>

            <hr />

            <p>
              <strong>Final Predicted Temperature:</strong>{" "}
              {formatTemperature(result.predictedTemperature)}
            </p>

            <p>
              <strong>Predicted Heat Risk:</strong>{" "}
              <span className={`future-city-risk ${result.heatRisk.toLowerCase()}`}>
                {result.heatRisk}
              </span>
            </p>

            <hr />

            <div className="future-city-infra-section">
              <div className="future-city-infra-header">
                <h4>Future City Infrastructure & Green Cover</h4>
                <span className="simulated-count-badge">Simulated Count</span>
              </div>

              <div className="future-city-infra-grid">
                {result.infrastructure.map((item) => (
                  <div key={item.id} className="future-city-infra-card">
                    <div className="future-city-infra-title">
                      <span className="future-city-infra-icon">{item.icon}</span>
                      <strong>{item.label}</strong>
                    </div>

                    <div className="future-city-infra-details">
                      <div className="future-city-infra-line">
                        <span className="infra-label">Current:</span>
                        <strong className="infra-val">{item.current.toLocaleString()}</strong>
                      </div>

                      {item.recommended !== null && (
                        <div className="future-city-infra-line recommended">
                          <span className="infra-label">Recommended:</span>
                          <strong className="infra-val recommended-val">
                            +{item.recommended.toLocaleString()}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
