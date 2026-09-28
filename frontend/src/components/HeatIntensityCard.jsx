import React from "react";

function HeatIntensityCard({ heatIntensity }) {
  const getHeatIntensityClass = (intensity) => {
    if (!intensity) return "";
    const intensityLower = intensity.toLowerCase();
    if (intensityLower.includes("low")) return "low-risk";
    if (intensityLower.includes("medium")) return "medium-risk";
    if (intensityLower.includes("high")) return "high-risk";
    if (intensityLower.includes("critical") || intensityLower.includes("extreme")) return "critical-risk";
    return "";
  };

  return (
    <div className="weather-card heatintensity-card">
      <div className="card-icon">📊</div>
      <div className="card-content">
        <h3>Heat Intensity</h3>
        <p className={`card-value ${heatIntensity === "Loading..." ? "" : getHeatIntensityClass(heatIntensity)}`}>
          {heatIntensity === "Loading..." ? "Loading..." : heatIntensity || "Not available"}
        </p>
      </div>
    </div>
  );
}

export default HeatIntensityCard;
