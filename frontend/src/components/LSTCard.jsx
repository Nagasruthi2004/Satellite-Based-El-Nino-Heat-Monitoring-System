import React from "react";

function LSTCard({ lst }) {
  return (
    <div className="weather-card lst-card">
      <div className="card-icon">🛰️</div>
      <div className="card-content">
        <h3>Land Surface Temperature</h3>
        <p className="card-value">{lst === "Loading..." ? "Loading..." : Number.isFinite(Number(lst)) ? `${Number(lst).toFixed(1)}°C` : "Not available"}</p>
      </div>
    </div>
  );
}

export default LSTCard;
