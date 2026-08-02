import { useState } from "react";
import { findCoolingZone } from "../data/coolingZones";

export default function HeatwaveEscapeRoute({ city }) {
  const [showRoute, setShowRoute] = useState(false);
  const route = findCoolingZone(city);
  const locationName = city || "Selected city";
  if (!route) {
    return (
      <article className="card escape-route-card">
        <div className="escape-route-heading">
          <div><p className="eyebrow">Offline local heat safety guide</p><h2 className="section-title">🧭 Heatwave Escape Route</h2></div>
        </div>
        <p className="hospitals-hint">No offline cooling zone data available for this city.</p>
      </article>
    );
  }
  const details = [
    ["Current Location", `${route.city}, ${route.country}`],
    ["Recommended Cooling Zone", route.coolingZone],
    ["Distance", route.distance],
    ["Estimated Travel Time", route.travelTime],
    ["Cooling Difference", route.coolingDifference],
    ["Best Transport", route.transport],
  ];

  return (
    <article className="card escape-route-card">
      <div className="escape-route-heading">
        <div>
          <p className="eyebrow">Offline local heat safety guide</p>
          <h2 className="section-title">🧭 Heatwave Escape Route</h2>
        </div>
        <span className="escape-route-status safe">
          🟢 Safe Route Available
        </span>
      </div>

      <div className="escape-route-grid">
        {details.map(([label, value]) => (
          <div className="escape-route-detail" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <button className="search-btn escape-route-button" type="button" onClick={() => setShowRoute((visible) => !visible)}>
        {showRoute ? "Hide Route" : "Show Route"}
      </button>

      {showRoute && (
        <section className="offline-route-diagram" aria-label={`Offline route to ${route.coolingZone}`}>
          <h3>Offline Route Guide</h3>
          <div className="route-step"><span>📍</span><strong>{locationName}</strong></div>
          <div className="route-connector">↓<span>Road</span></div>
          <div className="route-step"><span>🚦</span><strong>Traffic Signal</strong></div>
          <div className="route-connector">↓<span>{route.distance}</span></div>
          <div className="route-step cooling"><span>❄️</span><strong>{route.coolingZone}</strong></div>
        </section>
      )}
    </article>
  );
}
