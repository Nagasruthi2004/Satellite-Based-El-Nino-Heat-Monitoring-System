import React from "react";

function HumidityCard({ humidity, errorMessage }) {
  const displayValue = errorMessage
    ? "Unable to fetch weather data"
    : humidity === "Loading..."
      ? "Loading..."
      : `${humidity ?? 58}%`;

  return (
    <div className="weather-card humidity-card">
      <div className="card-icon">💧</div>
      <div className="card-content">
        <h3>Humidity</h3>
        <p className="card-value">{displayValue}</p>
      </div>
    </div>
  );
}

export default HumidityCard;
