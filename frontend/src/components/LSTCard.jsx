import React from "react";

function LSTCard({ lst }) {
  return (
    <div className="weather-card lst-card">
      <div className="card-icon">🛰️</div>
      <div className="card-content">
        <h3>Land Surface Temperature</h3>
        <p className="card-value">{lst === "Loading..." ? "Loading..." : `${lst ?? 42.5}°C`}</p>
      </div>
    </div>
  );
}

export default LSTCard;
