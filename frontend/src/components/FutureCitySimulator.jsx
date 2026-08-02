import { useEffect, useState } from "react";

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

    setResult({
      baseTemperature,
      predictedTemperature,
      heatRisk,
      treeReduction,
      buildingIncrease,
      waterReduction,
      plantationZones: [
  { zone: "North Zone", cooling: "2.3°C" },
  { zone: "East Zone", cooling: "1.8°C" },
  { zone: "South Zone", cooling: "2.0°C" },
],
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
              {result.baseTemperature.toFixed(1)}°C
            </p>

            <h4>Simulation Impact</h4>

            <p>
              🌳 Tree Cover :
              <strong> -{result.treeReduction.toFixed(1)}°C</strong>
            </p>

            <p>
              🏢 Building Density :
              <strong> +{result.buildingIncrease.toFixed(1)}°C</strong>
            </p>

            <p>
              💧 Water Bodies :
              <strong> -{result.waterReduction.toFixed(1)}°C</strong>
            </p>

            <hr />

            <p>
              <strong>Final Predicted Temperature:</strong>{" "}
              {result.predictedTemperature.toFixed(1)}°C
            </p>

            <p>
              <strong>Predicted Heat Risk:</strong>{" "}
              <span className={`future-city-risk ${result.heatRisk.toLowerCase()}`}>
                {result.heatRisk}
              </span>
            </p>

            <hr />

<h4>🌳 AI Best Tree Plantation Zones</h4>

{result.plantationZones.map((item, index) => (
  <div key={index} className="plantation-zone">
    <strong>{item.zone}</strong>
    <br />
    🌡 Expected Cooling:
    <strong> {item.cooling}</strong>
  </div>
))}

          </>
        )}
      </div>
    </div>
  );
}
