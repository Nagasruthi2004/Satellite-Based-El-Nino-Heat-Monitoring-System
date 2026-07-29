import React from "react";

function WindSpeedCard({ windSpeed, errorMessage }) {
  const displayValue = errorMessage
    ? "Unable to fetch weather data"
    : windSpeed === "Loading..."
      ? "Loading..."
      : `${windSpeed ?? 14} km/h`;

  return (
    <div className="weather-card windspeed-card">
      <div className="card-icon">🌬️</div>
      <div className="card-content">
        <h3>Wind Speed</h3>
        <p className="card-value">{displayValue}</p>
      </div>
    </div>
  );
}

export default WindSpeedCard;
