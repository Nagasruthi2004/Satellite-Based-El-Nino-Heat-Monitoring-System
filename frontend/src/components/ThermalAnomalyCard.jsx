import React from "react";

function ThermalAnomalyCard({ thermalAnomaly }) {
  const getAnomalyStatus = (anomaly) => {
    if (anomaly === "Loading...") return "Loading...";
    if (typeof anomaly === "boolean") {
      return anomaly ? "🚨 Detected" : "✅ Normal";
    }
    return anomaly || "Not available";
  };

  return (
    <div className="weather-card thermalAnomaly-card">
      <div className="card-icon">🌡️</div>
      <div className="card-content">
        <h3>Thermal Anomaly</h3>
        <p className="card-value">{getAnomalyStatus(thermalAnomaly)}</p>
      </div>
    </div>
  );
}

export default ThermalAnomalyCard;
