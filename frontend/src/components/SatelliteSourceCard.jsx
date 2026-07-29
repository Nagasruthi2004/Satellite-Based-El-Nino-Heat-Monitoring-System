import React from "react";

function SatelliteSourceCard({ satelliteSource }) {
  return (
    <div className="weather-card satellitesource-card">
      <div className="card-icon">📡</div>
      <div className="card-content">
        <h3>Satellite Data</h3>
        <p className="card-value">{satelliteSource === "Loading..." ? "Loading..." : satelliteSource ?? "MODIS"}</p>
      </div>
    </div>
  );
}

export default SatelliteSourceCard;
