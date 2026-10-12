

function RainfallCard({ rainfall }) {
  let displayValue = "Not available";

  if (rainfall === "Loading...") {
    displayValue = "Loading...";
  } else if (typeof rainfall === "string" && rainfall) {
    displayValue = rainfall;
  } else if (rainfall != null && !isNaN(Number(rainfall))) {
    const num = Number(rainfall);
    displayValue = num === 0 ? "0 mm - No rain today" : `${num} mm`;
  }

  const isLong = typeof displayValue === "string" && displayValue.length > 8;

  return (
    <div className="weather-card rainfall-card">
      <div className="card-icon">🌧️</div>
      <div className="card-content">
        <h3>Rainfall</h3>
        <p
          className="card-value"
          style={isLong ? { fontSize: "14.5px", lineHeight: "1.35", textAlign: "center" } : undefined}
          title={displayValue}
        >
          {displayValue}
        </p>
      </div>
    </div>
  );
}

export default RainfallCard;
