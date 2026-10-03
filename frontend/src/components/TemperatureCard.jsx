

function TemperatureCard({ temperature, weatherDescription, errorMessage }) {
  const displayValue = errorMessage
    ? "Unable to fetch weather data for this location."
    : temperature === "Loading..."
      ? "Loading..."
      : `${temperature ?? 39}°C`;

  return (
    <div className="weather-card temperature-card">
      <div className="card-icon">🌡️</div>
      <div className="card-content">
        <h3>Temperature</h3>
        <p className="card-value">{displayValue}</p>
        {weatherDescription && !errorMessage ? (
          <p style={{ marginTop: "0.35rem", opacity: 0.8 }}>{weatherDescription}</p>
        ) : null}
      </div>
    </div>
  );
}

export default TemperatureCard;