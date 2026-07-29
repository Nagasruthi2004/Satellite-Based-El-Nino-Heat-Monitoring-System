import React from "react";

function RainfallCard({ rainfall }) {
  return (
    <div className="weather-card rainfall-card">
      <div className="card-icon">🌧️</div>
      <div className="card-content">
        <h3>Rainfall</h3>
        <p className="card-value">{rainfall === "Loading..." ? "Loading..." : `${rainfall ?? 12} mm`}</p>
      </div>
    </div>
  );
}

export default RainfallCard;
