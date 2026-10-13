

function RainfallCard({ rainfall, data }) {
  let displayValue = "Not available";

  const source = data?.rainfall ?? (data || rainfall);

  if (source === "Loading...") {
    displayValue = "Loading...";
  } else if (typeof source === "string" && source) {
    if (!isNaN(Number(source))) {
      const num = Number(source);
      displayValue = num > 0 ? `${num} mm - Raining now 🌧️` : `0 mm - No live rain`;
    } else if (source.includes("Today total") || source.includes("No rain today")) {
      displayValue = `0 mm - No live rain`;
    } else {
      displayValue = source;
    }
  } else if (typeof source === "number") {
    displayValue = source > 0 ? `${source} mm - Raining now 🌧️` : `0 mm - No live rain`;
  } else if (typeof source === "object" && source !== null) {
    if (source.rainfall) {
      displayValue = source.rainfall;
    } else {
      displayValue = "0 mm - No live rain";
    }
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
