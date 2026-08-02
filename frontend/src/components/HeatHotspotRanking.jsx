const HOTSPOT_OFFSETS = [
  { name: "Central Zone", offset: 1.5, rank: "🥇" },
  { name: "North Zone", offset: 1.0, rank: "🥈" },
  { name: "East Zone", offset: 0.7, rank: "🥉" },
  { name: "West Zone", offset: 0.4, rank: "4️⃣" },
  { name: "South Zone", offset: 0.2, rank: "5️⃣" },
];

function getRisk(temperature) {
  if (temperature >= 36) return "High";
  if (temperature >= 31) return "Medium";
  return "Low";
}

export default function HeatHotspotRanking({ city, currentTemperature }) {
  const temperature = Number(currentTemperature);
  const hasTemperature = Number.isFinite(temperature);
  const hotspots = hasTemperature
    ? HOTSPOT_OFFSETS
        .map((hotspot) => ({ ...hotspot, temperature: temperature + hotspot.offset }))
        .sort((a, b) => b.temperature - a.temperature)
    : [];
  const hottestArea = hotspots[0];

  return (
    <div className="card heat-hotspot-ranking">
      <div className="hotspot-heading">
        <div>
          <p className="eyebrow">Simulated urban heat analysis</p>
          <h2 className="section-title">🔥 AI Heat Hotspot Ranking</h2>
        </div>
        {city && <span className="hotspot-city">{city}</span>}
      </div>

      {!hasTemperature ? (
        <p className="hospitals-hint">Search for a city to generate its AI heat hotspot ranking.</p>
      ) : (
        <>
          <div className="hotspot-list">
            {hotspots.map((hotspot) => {
              const risk = getRisk(hotspot.temperature);
              return (
                <div className="hotspot-row" key={hotspot.name}>
                  <span className="hotspot-rank" aria-label={`Rank ${hotspots.indexOf(hotspot) + 1}`}>{hotspot.rank}</span>
                  <div className="hotspot-area">
                    <strong>{hotspot.name}</strong>
                    <span>{hotspot.temperature.toFixed(1)}°C</span>
                  </div>
                  <span className={`hotspot-risk ${risk.toLowerCase()}`}>{risk}</span>
                </div>
              );
            })}
          </div>

          <div className="hotspot-recommendation">
            <h3>AI Recommendation</h3>
            <p>
              {hottestArea.name} requires {getRisk(hottestArea.temperature) === "High" ? "immediate" : "proactive"} heat mitigation measures.
              Increase tree plantation and reduce concrete exposure.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
