import { formatTemperature } from "../utils/temperature";

function HeatAlert({ heatRisk, temperature, landSurfaceTemperature, thermalAnomaly }) {
  const riskLevel = typeof heatRisk === "object" ? heatRisk?.level : heatRisk;

  if (riskLevel === "Loading...") {
    return (
      <div className="weather-card heat-alert-card">
        <div className="card-icon">⚠️</div>
        <div className="card-content">
          <h3>Heat Alert</h3>
          <p className="card-value">Loading...</p>
        </div>
      </div>
    );
  }

  const normalizedRisk = String(riskLevel || "").toLowerCase();
  const alert = normalizedRisk.includes("critical") || normalizedRisk.includes("extreme")
    ? { level: "EXTREME", className: "critical-risk", message: "Extreme heat risk. Avoid outdoor activity during peak hours and take necessary precautions." }
    : normalizedRisk.includes("high")
      ? { level: "HIGH", className: "high-risk", message: "High heat risk. Avoid prolonged outdoor exposure during peak hours." }
      : normalizedRisk.includes("medium")
        ? { level: "MEDIUM", className: "medium-risk", message: "Moderate heat risk. Stay hydrated and avoid prolonged exposure during peak hours." }
        : normalizedRisk.includes("low")
          ? { level: "LOW", className: "low-risk", message: "Low heat risk. Normal outdoor activity is expected." }
          : { level: "MONITORING", className: "", message: "Heat risk data is not available yet." };

  const environmentalDetails = [];
  if (Number.isFinite(Number(temperature))) environmentalDetails.push(`${formatTemperature(temperature)} air temperature`);
  if (Number.isFinite(Number(landSurfaceTemperature))) environmentalDetails.push(`${Number(landSurfaceTemperature).toFixed(1)}°C LST`);
  if (typeof thermalAnomaly === "boolean") environmentalDetails.push(thermalAnomaly ? "thermal anomaly detected" : "no thermal anomaly");

  return (
    <div className="weather-card heat-alert-card">
      <div className="card-icon">⚠️</div>
      <div className="card-content">
        <h3>Heat Alert</h3>
        <p className={`card-value ${alert.className}`}>{alert.level}</p>
        <p className="card-value-text">
          {alert.message}
          {environmentalDetails.length > 0 && <><br />{environmentalDetails.join(" • ")}</>}
        </p>
      </div>
    </div>
  );
}

export default HeatAlert;
