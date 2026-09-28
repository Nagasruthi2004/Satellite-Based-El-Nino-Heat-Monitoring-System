export function getHeatRiskExplanation(risk, confidence) {
  const confidenceText = Number.isFinite(Number(confidence))
    ? ` with ${Number(confidence).toFixed(1)}% model confidence`
    : "";
  const explanations = {
    Low: `Low heat risk based on current weather conditions${confidenceText}. Conditions are favorable.`,
    Medium: `Medium heat risk based on current weather conditions${confidenceText}. Monitor conditions.`,
    High: `High heat risk based on current weather conditions${confidenceText}. Take precautions.`,
  };
  return explanations[risk] || "Heat risk prediction unavailable";
}
