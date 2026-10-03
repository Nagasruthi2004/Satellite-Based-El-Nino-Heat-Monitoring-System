

function HeatRiskCard({ heatRisk }) {
  const riskLevel = typeof heatRisk === "object" ? heatRisk?.level : heatRisk;
  const getHeatRiskClass = (risk) => {
    if (!risk || risk === "Not available") return "";
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
        <p className={`card-value ${riskLevel === "Loading..." ? "" : getHeatRiskClass(riskLevel)}`}>
          {riskLevel === "Loading..." ? "Loading..." : riskLevel ?? "Not available"}
        </p>
      </div>
    </div>
  );
}

export default HeatRiskCard;
