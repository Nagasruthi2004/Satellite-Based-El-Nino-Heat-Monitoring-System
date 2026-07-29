import React from "react";

function ElNinoCard({ elNinoStatus }) {
  return (
    <div className="weather-card elnino-card">
      <div className="card-icon">🌊</div>
      <div className="card-content">
        <h3>El Niño Status</h3>
        <p className="card-value">{elNinoStatus === "Loading..." ? "Loading..." : elNinoStatus ?? "Strong El Niño (ONI: +1.4)"}</p>
      </div>
    </div>
  );
}

export default ElNinoCard;
