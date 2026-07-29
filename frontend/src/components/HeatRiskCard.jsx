import React from "react";

function HeatRiskCard({ heatRisk }) {
  const getHeatRiskClass = (risk) => {
    if (!risk) return "high-risk";
    const riskLower = risk.toLowerCase();
    if (riskLower.includes("low")) return "low-risk";
    if (riskLower.includes("medium")) return "medium-risk";
    if (riskLower.includes("high")) return "high-risk";
    return "high-risk";
  };

  return (
    <div className="weather-card heatrisk-card">
      <div className="card-icon">🔥</div>
      <div className="card-content">
        <h3>Heat Risk Level</h3>
        <p className={`card-value ${heatRisk === "Loading..." ? "" : getHeatRiskClass(heatRisk)}`}>
          {heatRisk === "Loading..." ? "Loading..." : heatRisk ?? "High"}
        </p>
      </div>
    </div>
  );
}

export default HeatRiskCard;
