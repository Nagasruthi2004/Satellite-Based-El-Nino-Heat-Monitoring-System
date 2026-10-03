

function ElNinoCard({ elNinoStatus, oni, strength, influence, impactScore }) {
  return (
    <div className="weather-card elnino-card">
      <div className="card-icon">🌊</div>
      <div className="card-content">
        <h3>El Niño Status</h3>
        <p className="card-value">{elNinoStatus === "Loading..." ? "Loading..." : elNinoStatus || "Monitoring"}</p>
        {elNinoStatus !== "Loading..." && Number.isFinite(oni) && (
          <p className="card-value-text">
            ONI Index: {oni >= 0 ? "+" : ""}{oni.toFixed(1)}<br />
            Strength: {strength}<br />
            El Niño Heat Influence: {influence}<br />
            Impact Score: {Number.isFinite(impactScore) ? `${impactScore}/100` : "Not available"}
          </p>
        )}
      </div>
    </div>
  );
}

export default ElNinoCard;
