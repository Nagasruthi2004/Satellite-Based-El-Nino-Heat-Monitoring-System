import { useMemo } from "react";
import { formatTemperature, formatTemperatureDelta } from "../utils/temperature";
import "./HeatwaveEscapeRoute.css";

const COOLING_REFUGES = [
  {
    id: "urban-park",
    type: "Dense Green Canopy",
    name: "Urban Forests & Botanical Parks",
    icon: "🌳",
    diff: -3.5,
    desc: "Tree canopy creates significant vegetative shading and evapotranspiration, reducing localized surface and air temperatures compared to asphalt roads.",
    accessTime: "10–20 min",
    bestHours: "Early morning or late afternoon",
  },
  {
    id: "water-body",
    type: "Riparian & Lakefront",
    name: "Lakeside & Wetland Promenades",
    icon: "🌊",
    diff: -2.8,
    desc: "Open water bodies absorb sensible heat and produce convective breezes, creating a thermal buffer zone against oppressive surrounding concrete heat islands.",
    accessTime: "15–30 min",
    bestHours: "Morning & post-sunset",
  },
  {
    id: "civic-centre",
    type: "Public Cooling Refuge",
    name: "Air-Conditioned Public Libraries & Civic Hubs",
    icon: "🏛️",
    diff: -8.0,
    desc: "Air-conditioned civic infrastructure provides immediate physiologic relief for elderly citizens and outdoor workers during severe afternoon thermal stress.",
    accessTime: "5–15 min",
    bestHours: "Peak heat hours (12 PM – 4 PM)",
  },
  {
    id: "elevated-zone",
    type: "Elevated Hill Terrain",
    name: "Foothills & Highland Retreats",
    icon: "⛰️",
    diff: -5.2,
    desc: "Environmental lapse rate yields ~6.5°C / 11.7°F drop per 1,000m elevation gain, offering regional thermal relief from intense inland plain heatwaves.",
    accessTime: "45–90 min",
    bestHours: "Daytime and overnight recovery",
  },
];

export default function HeatwaveEscapeRoute({ weather, currentHeatRisk }) {
  const cityName = weather?.city || "Coimbatore";
  const currentTemp = weather?.temperature != null ? Number(weather.temperature) : 34.0;
  const currentRisk = currentHeatRisk?.level || "Medium";

  const estimatedRefuges = useMemo(() => {
    return COOLING_REFUGES.map((refuge) => {
      const diffNum = refuge.diff;
      const estTemp = Math.max(18, currentTemp + diffNum).toFixed(1);
      return {
        ...refuge,
        estimatedTemp: formatTemperature(estTemp),
      };
    });
  }, [currentTemp]);

  return (
    <div className="escape-route-container">
      {/* ── HEADER ── */}
      <header className="escape-header">
        <div className="escape-title-area">
          <div className="escape-eyebrow">
            <span>🧭</span>
            <span>Thermal Gradient & Refuge Planning</span>
          </div>
          <h1 className="escape-title">Heatwave Escape Route & Cool Refuges</h1>
          <p className="escape-subtitle">
            Identify microclimate cooling buffers, urban shaded parks, and civic cooling centres to minimize acute heat stress in <strong>{cityName}</strong>.
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Current Ambient Base
          </span>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>
            {formatTemperature(currentTemp)}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: currentRisk === "High" || currentRisk === "Critical" ? "#dc2626" : "#d97706" }}>
            {currentRisk} Heat Risk
          </span>
        </div>
      </header>

      {/* ── SUMMARY STATS BANNER ── */}
      <section className="escape-stats-banner">
        <div className="escape-stat-item">
          <span className="escape-stat-label">Urban Heat Island (UHI) Penalty</span>
          <span className="escape-stat-val">+3.0°C / +5.4°F to +5.5°C / +9.9°F</span>
        </div>
        <div className="escape-stat-item">
          <span className="escape-stat-label">Canopy Cooling Differential</span>
          <span className="escape-stat-val">-2.5°C / -4.5°F to -4.0°C / -7.2°F</span>
        </div>
        <div className="escape-stat-item">
          <span className="escape-stat-label">Peak Sun Avoidance Window</span>
          <span className="escape-stat-val">12:00 PM – 3:30 PM</span>
        </div>
      </section>

      {/* ── COOLING REFUGES GRID ── */}
      <div className="escape-refuges-grid">
        {estimatedRefuges.map((item) => (
          <article key={item.id} className="refuge-card">
            <div className="refuge-card-header">
              <span className="refuge-type-badge">{item.type}</span>
              <span className="refuge-diff-badge">{formatTemperatureDelta(item.diff)} Shaded Relief</span>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <h2 className="refuge-name">{item.name}</h2>
              </div>
              <p className="refuge-desc">{item.desc}</p>
            </div>

            <div className="refuge-meta-row">
              <span>Est. Microclimate: <strong>{item.estimatedTemp}</strong></span>
              <span>Optimal: <strong>{item.bestHours}</strong></span>
            </div>
          </article>
        ))}
      </div>

      {/* ── SCIENTIFIC HONESTY & DISCLOSURE ── */}
      <div className="escape-science-note" role="note">
        <strong>Scientific Methodological Disclosure:</strong> Microclimate differentials are estimated based on peer-reviewed urban heat island (UHI) surface temperature models and adiabatic lapse rates. Actual ground-level temperatures vary with canopy density, local wind ventilation, relative humidity, and sun angle. These recommendations serve as awareness guidance, not navigation guarantees.
      </div>
    </div>
  );
}
