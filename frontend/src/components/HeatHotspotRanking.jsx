import { formatTemperature, formatTemperatureDelta } from "../utils/temperature";

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

function getRecommendation(hotspot, city, runnerUp) {
  const risk = getRisk(hotspot.temperature);
  const location = city ? `${hotspot.name} in ${city}` : hotspot.name;
  const hotspotTemperature = formatTemperature(hotspot.temperature);
  const gap = runnerUp ? hotspot.temperature - runnerUp.temperature : null;
  const closeRunnerUp = gap !== null && gap <= 0.6;
  const comparison = closeRunnerUp
    ? ` ${runnerUp.name} (${runnerUp.rank}, ${formatTemperature(runnerUp.temperature)}) is only ${formatTemperatureDelta(-gap)} cooler, so coordinate both ranked zones.`
    : gap !== null
      ? ` The ${hotspot.rank} zone leads ${runnerUp.name} by ${formatTemperatureDelta(gap)}, so prioritize it before expanding measures to the next rank.`
      : "";
  const seed = [...`${city || "location"}:${hotspot.name}:${hotspot.temperature}:${gap ?? 0}:${hotspot.rank}`]
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const variation = seed % 4;

  if (risk === "High") {
    const recommendations = [
      `${location} is ${hotspot.rank} at ${hotspotTemperature}. Open cooling centres, expand shaded areas, and issue targeted heat alerts.${comparison}`,
      `Place ${location} on the urgent response list: its ${hotspotTemperature} reading calls for hydration points, shaded waiting areas, and heat-health monitoring.${comparison}`,
      `Direct immediate heat mitigation to ${location}, ranked ${hotspot.rank} at ${hotspotTemperature}, with cooling spaces, tree cover, and vulnerable-resident outreach.${comparison}`,
      `Use ${location}'s ${hotspotTemperature} hotspot reading to trigger rapid shade deployment, hydration support, and public heat warnings.${comparison}`,
    ];
    return recommendations[variation];
  }
  if (risk === "Medium") {
    const recommendations = [
      `${location} is ${hotspot.rank} at ${hotspotTemperature}. Prioritize tree planting and shade along its most exposed corridors.${comparison}`,
      `Focus proactive mitigation on ${location}, where ${hotspotTemperature} and its ${hotspot.rank} ranking justify reducing concrete exposure and improving cool public areas.${comparison}`,
      `Strengthen vegetation, reflective surfaces, and community heat preparedness around ${location} at ${hotspotTemperature}.${comparison}`,
      `Use the ${hotspotTemperature} reading from ${location} to target shade improvements and monitor whether the ${hotspot.rank} zone widens its lead.${comparison}`,
    ];
    return recommendations[variation];
  }
  const recommendations = hotspot.temperature < 28
    ? [
      `${location} remains relatively cool at ${hotspotTemperature}. Preserve existing vegetation and continue routine monitoring.${comparison}`,
      `Conditions at ${location} are stable at ${hotspotTemperature}. Protect shaded areas and retain current environmental monitoring.${comparison}`,
      `Maintain the green cover around ${location}, currently ${hotspotTemperature}, while checking for changes in local heat patterns.${comparison}`,
      `${location} is the ${hotspot.rank} ranked area at ${hotspotTemperature}. Keep preservation work in place and review the next-ranked zone for emerging heat.${comparison}`,
    ]
    : [
      `${location} is the warmest ranked zone at ${hotspotTemperature}. Maintain cooling infrastructure and expand tree cover before risk increases.${comparison}`,
      `Keep ${location} under observation at ${hotspotTemperature}, with continued shade maintenance and reduced hard-surface exposure.${comparison}`,
      `Use the ${hotspotTemperature} reading at ${location} to guide cooling maintenance, irrigation, and long-term tree-cover planning.${comparison}`,
      `Protect ${location}, the ${hotspot.rank} ranked zone at ${hotspotTemperature}, by combining shade upkeep with targeted vegetation expansion.${comparison}`,
    ];
  return recommendations[variation];
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
        <p className="status-hint">Search for a city to generate its AI heat hotspot ranking.</p>
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
                    <span>{formatTemperature(hotspot.temperature)}</span>
                  </div>
                  <span className={`hotspot-risk ${risk.toLowerCase()}`}>{risk}</span>
                </div>
              );
            })}
          </div>

          <div className="hotspot-recommendation">
            <h3>AI Recommendation</h3>
            <p>{getRecommendation(hottestArea, city, hotspots[1])}</p>
          </div>
        </>
      )}
    </div>
  );
}
