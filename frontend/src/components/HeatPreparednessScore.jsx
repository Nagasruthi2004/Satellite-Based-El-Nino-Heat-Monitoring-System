const RISK_DEDUCTIONS = { low: 5, medium: 15, high: 30 };

const clamp = (value) => Math.max(0, Math.min(100, value));

function coverPoints(value) {
  if (value > 60) return 20;
  if (value > 30) return 10;
  return 0;
}

function getStatus(score) {
  if (score >= 80) return { label: "Well Prepared", icon: "🟢", tone: "well" };
  if (score >= 50) return { label: "Moderate Preparedness", icon: "🟡", tone: "moderate" };
  return { label: "Poor Preparedness", icon: "🔴", tone: "poor" };
}

export default function HeatPreparednessScore({
  heatRisk,
  hospitalsAvailable = false,
  simulatorValues = {},
  forecast = [],
}) {
  const treeCover = Number(simulatorValues.treeCover) || 0;
  const waterBodies = Number(simulatorValues.waterBodies) || 0;
  const normalizedRisk = String(heatRisk || "Low").toLowerCase();
  const riskDeduction = RISK_DEDUCTIONS[normalizedRisk] ?? 0;
  const hospitalPoints = hospitalsAvailable ? 10 : -15;
  const treePoints = coverPoints(treeCover);
  const waterPoints = coverPoints(waterBodies);
  const score = clamp(100 - riskDeduction + hospitalPoints + treePoints + waterPoints);
  const status = getStatus(score);
  const highForecastDays = forecast.filter((day) => String(day.heat_risk).toLowerCase() === "high").length;

  const recommendations = [];
  if (treeCover <= 30) recommendations.push("Increase tree cover to create more shade and reduce urban heat.");
  if (waterBodies <= 30) recommendations.push("Improve water availability through water bodies and cooling infrastructure.");
  if (!hospitalsAvailable) recommendations.push("Improve access to nearby hospitals and emergency heat-response services.");
  if (highForecastDays > 0 || normalizedRisk === "high") recommendations.push("Monitor future heatwave trends and activate heat alerts for vulnerable residents.");
  if (recommendations.length === 0) recommendations.push("Maintain current cooling measures and continue monitoring future heatwave trends.");

  const breakdown = [
    { label: "Starting score", value: "+100", tone: "positive" },
    { label: `Current heat risk: ${heatRisk || "Low"}`, value: `-${riskDeduction}`, tone: "negative" },
    { label: `Nearby hospitals: ${hospitalsAvailable ? "Available" : "Unavailable"}`, value: `${hospitalPoints >= 0 ? "+" : ""}${hospitalPoints}`, tone: hospitalPoints >= 0 ? "positive" : "negative" },
    { label: `Tree cover: ${treeCover}%`, value: `+${treePoints}`, tone: "positive" },
    { label: `Water bodies: ${waterBodies}%`, value: `+${waterPoints}`, tone: "positive" },
  ];

  return (
    <div className="card preparedness-score">
      <div className="preparedness-heading">
        <div>
          <p className="eyebrow">AI-powered resilience assessment</p>
          <h2 className="section-title">AI Heatwave Preparedness Score</h2>
        </div>
        <span className={`preparedness-badge ${status.tone}`}>{status.icon} {status.label}</span>
      </div>

      <div className="preparedness-summary">
        <div>
          <p className="preparedness-label">Overall Score</p>
          <p className="preparedness-value">{score}<span>/100</span></p>
        </div>
        <div className="preparedness-progress" aria-label={`Preparedness score: ${score} out of 100`}>
          <div className={`preparedness-progress-fill ${status.tone}`} style={{ width: `${score}%` }} />
        </div>
      </div>

      <div className="preparedness-grid">
        <div className="preparedness-panel">
          <h3>Score Breakdown</h3>
          {breakdown.map((item) => (
            <div className="preparedness-breakdown-row" key={item.label}>
              <span>{item.label}</span>
              <strong className={item.tone}>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="preparedness-panel recommendation-panel">
          <h3>AI Recommendation</h3>
          <ul>
            {recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
          </ul>
          {forecast.length > 0 && <p className="preparedness-forecast-note">7-day forecast: {highForecastDays} high-risk day{highForecastDays === 1 ? "" : "s"} detected.</p>}
        </div>
      </div>
    </div>
  );
}
