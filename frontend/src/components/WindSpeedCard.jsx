
import { formatWindSpeedKmh } from "../utils/wind";

function WindSpeedCard({ windSpeed, errorMessage }) {
  const displayValue = errorMessage
    ? "Unable to fetch weather data for this location."
    : windSpeed === "Loading..."
      ? "Loading..."
      : windSpeed == null
        ? "—"
        : `${formatWindSpeedKmh(windSpeed)} km/h`;

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
