import React from "react";

function AlertRecommendationCard({ recommendation }) {
  return (
    <div className="weather-card alert-recommendation-card">
      <div className="card-icon">⚠️</div>
      <div className="card-content">
        <h3>Heat Alert</h3>
        <p className="card-value-text">{recommendation === "Loading..." ? "Loading..." : recommendation ?? "Monitor weather conditions"}</p>
      </div>
    </div>
  );
}

export default AlertRecommendationCard;
