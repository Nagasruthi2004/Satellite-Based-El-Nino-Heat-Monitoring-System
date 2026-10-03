import { useState } from "react";
import "./SmartAwareness.css";

const AWARENESS_CONFIG = {
  LOW: {
    level: "Low",
    headline: "Heat conditions are currently low.",
    guidance: "Continue normal hydration and stay aware of weather changes.",
    severity: "Minimal Risk",
    icon: "🟢",
    tierClass: "tier-low",
    badgeClass: "badge-low",
    levelCardClass: "level-low",
    tempRange: "< 30°C",
    recommendations: [
      {
        title: "Daily Hydration Routine",
        category: "Hydration",
        icon: "💧",
        desc: "Maintain regular daily hydration with 2 to 2.5 litres of clean drinking water."
      },
      {
        title: "Normal Outdoor Activities",
        category: "Activity",
        icon: "🏃",
        desc: "Normal outdoor work, recreation, and athletic activities are completely safe."
      },
      {
        title: "Weather Vigilance",
        category: "Awareness",
        icon: "🌤️",
        desc: "Stay aware of local weather updates and sudden temperature variations."
      },
      {
        title: "Basic Sun Protection",
        category: "Protection",
        icon: "🧢",
        desc: "Wear lightweight comfortable clothing and caps when under direct midday sun."
      }
    ],
    whyFactors: [
      "Ambient temperature is within comfortable baseline limits (< 30°C).",
      "Thermal comfort index indicates negligible stress on cardiovascular systems.",
      "Atmospheric heat retention is low with favorable ventilation."
    ]
  },
  MEDIUM: {
    level: "Medium",
    headline: "Moderate heat conditions detected.",
    guidance: "Stay hydrated and avoid unnecessary exposure to strong afternoon heat.",
    severity: "Moderate Risk",
    icon: "🟡",
    tierClass: "tier-medium",
    badgeClass: "badge-medium",
    levelCardClass: "level-medium",
    tempRange: "30°C – 35.9°C",
    recommendations: [
      {
        title: "Proactive Hydration",
        category: "Hydration",
        icon: "🥤",
        desc: "Drink plenty of water at regular intervals, even before experiencing thirst."
      },
      {
        title: "Afternoon Heat Caution",
        category: "Activity",
        icon: "⛱️",
        desc: "Avoid unnecessary exposure to strong afternoon heat between 12:00 PM and 3:00 PM."
      },
      {
        title: "Comfortable Attire",
        category: "Protection",
        icon: "👕",
        desc: "Wear loose, light-colored cotton garments and use sunglasses or umbrellas outdoors."
      },
      {
        title: "Vulnerable Resident Care",
        category: "Health",
        icon: "🩺",
        desc: "Check on children, elderly family members, and outdoor workers during midday hours."
      }
    ],
    whyFactors: [
      "Elevated temperatures (30°C–36°C) increase physiological thermal load.",
      "Moderate humidity slows evaporative cooling through natural perspiration.",
      "Solar radiation intensity peaks in early afternoon, elevating heat stress."
    ]
  },
  HIGH: {
    level: "High",
    headline: "High heat conditions detected.",
    guidance: "Drink plenty of water, reduce outdoor activity during peak afternoon hours, and stay in cool areas.",
    severity: "High Risk",
    icon: "🟠",
    tierClass: "tier-high",
    badgeClass: "badge-high",
    levelCardClass: "level-high",
    tempRange: "36°C – 39.9°C",
    recommendations: [
      {
        title: "Intensive Hydration",
        category: "Hydration",
        icon: "🚰",
        desc: "Drink 3 to 4 litres of water throughout the day; include electrolyte or lemon water."
      },
      {
        title: "Peak Hour Restriction",
        category: "Activity",
        icon: "🚫",
        desc: "Reduce outdoor activity during peak afternoon hours (11:30 AM to 4:00 PM)."
      },
      {
        title: "Cool Environments",
        category: "Environment",
        icon: "❄️",
        desc: "Stay in cool, shaded, or air-conditioned areas and keep indoor living spaces ventilated."
      },
      {
        title: "Heat Exhaustion Watch",
        category: "Health",
        icon: "⚠️",
        desc: "Watch for early symptoms of heat exhaustion: dizziness, profuse sweating, and fatigue."
      }
    ],
    whyFactors: [
      "Sustained high temperatures (36°C–40°C) exceed comfortable thermal regulation.",
      "Combined heat index places significant strain on vulnerable populations.",
      "Urban heat island effect amplifies localized surface and air temperatures."
    ]
  },
  CRITICAL: {
    level: "Critical",
    headline: "Critical heat conditions detected.",
    guidance: "Avoid unnecessary outdoor exposure, stay hydrated, remain in a cool place, and seek medical help if heat-related symptoms occur.",
    severity: "Critical Risk",
    icon: "🔴",
    tierClass: "tier-critical",
    badgeClass: "badge-critical",
    levelCardClass: "level-critical",
    tempRange: "≥ 40°C",
    recommendations: [
      {
        title: "Avoid Outdoor Exposure",
        category: "Urgent",
        icon: "🏠",
        desc: "Avoid all unnecessary outdoor exposure; stay indoors in the coolest available room."
      },
      {
        title: "Continuous Hydration",
        category: "Hydration",
        icon: "🧊",
        desc: "Stay constantly hydrated with ORS, coconut water, or water; avoid caffeine and alcohol."
      },
      {
        title: "Active Indoor Cooling",
        category: "Environment",
        icon: "💨",
        desc: "Use fans, AC, cold compresses, or damp towels; draw dark curtains against direct sunlight."
      },
      {
        title: "Seek Medical Help",
        category: "Emergency",
        icon: "🚑",
        desc: "Seek emergency medical help immediately if confusion, fainting, or high body fever occurs."
      }
    ],
    whyFactors: [
      "Extreme temperatures (≥ 40°C) pose dangerous risk of acute heatstroke and hyperthermia.",
      "Body cooling mechanisms can fail under prolonged exposure to critical thermal limits.",
      "Satellite LST and atmospheric conditions indicate hazardous heatwave intensity."
    ]
  }
};

function resolveRiskKey(heatRisk, weather, predictionResult) {
  const candidate =
    (typeof heatRisk === "object" ? heatRisk?.level : heatRisk) ||
    weather?.heat_risk ||
    predictionResult?.prediction?.heat_risk;

  if (candidate) {
    const norm = String(candidate).trim().toUpperCase();
    if (norm.includes("CRIT") || norm.includes("EXTREM")) return "CRITICAL";
    if (norm.includes("HIGH")) return "HIGH";
    if (norm.includes("MED")) return "MEDIUM";
    if (norm.includes("LOW")) return "LOW";
  }

  const temp = Number(weather?.temperature);
  if (Number.isFinite(temp)) {
    if (temp < 30) return "LOW";
    if (temp < 36) return "MEDIUM";
    if (temp < 40) return "HIGH";
    return "CRITICAL";
  }

  return "MEDIUM";
}

export default function SmartAwareness({
  weather,
  currentHeatRisk,
  predictionResult,
  loading = false,
  onRefresh,
}) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const liveRiskKey = resolveRiskKey(currentHeatRisk, weather, predictionResult);
  const activeKey = selectedLevel || liveRiskKey;
  const config = AWARENESS_CONFIG[activeKey] || AWARENESS_CONFIG.MEDIUM;
  const isViewingLive = selectedLevel === null || selectedLevel === liveRiskKey;

  const handleRefresh = async () => {
    if (typeof onRefresh === "function") {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const cityName = weather?.city || "Selected Location";
  const tempDisplay =
    weather?.temperature != null
      ? `${Number(weather.temperature).toFixed(1)}°C`
      : loading
      ? "Loading..."
      : "—";
  const humidityDisplay =
    weather?.humidity != null ? `${weather.humidity}%` : "—";
  const windDisplay =
    weather?.wind_speed != null
      ? `${Number(weather.wind_speed).toFixed(1)} km/h`
      : "—";
  const rainfallDisplay =
    weather?.rainfall != null
      ? `${Number(weather.rainfall).toFixed(1)} mm`
      : "0.0 mm";
  const scoreDisplay =
    weather?.heat_risk_score != null
      ? `${weather.heat_risk_score}/100`
      : currentHeatRisk?.score != null
      ? `${currentHeatRisk.score}/100`
      : "—";

  return (
    <div className="smart-awareness-container" id="smart-heat-awareness-module">
      {/* ── HEADER ── */}
      <header className="smart-awareness-header">
        <div className="smart-awareness-title-area">
          <div className="smart-awareness-eyebrow">
            <span>💡</span> Smart Heat Advisory
          </div>
          <h2 className="smart-awareness-title">Smart Heat Awareness</h2>
          <p className="smart-awareness-subtitle">
            Dynamic urban heat advisory and actionable safety measures based on
            real-time atmospheric conditions and satellite thermal monitoring.
          </p>
        </div>

        <div className="smart-awareness-controls">
          <div className="smart-location-chip" title="Active monitored location">
            <span>📍</span>
            <span>{cityName}</span>
          </div>

          <button
            type="button"
            className={`smart-refresh-btn ${isRefreshing || loading ? "spinning" : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            aria-label="Refresh heat awareness data"
            id="smart-awareness-refresh-btn"
          >
            <span className="refresh-icon" aria-hidden="true">🔄</span>
            <span>{isRefreshing || loading ? "Updating..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* ── 4-LEVEL VISUAL INDICATORS & EXPLORER ── */}
      <section aria-label="Heat risk level barometer">
        <div className="smart-level-barometer">
          {Object.entries(AWARENESS_CONFIG).map(([key, item]) => {
            const isLive = key === liveRiskKey;
            const isSelected = key === activeKey;

            return (
              <button
                key={key}
                type="button"
                className={`barometer-tier-card ${item.tierClass} ${isSelected ? "active" : ""}`}
                onClick={() => setSelectedLevel(key === liveRiskKey ? null : key)}
                aria-pressed={isSelected}
                id={`barometer-tier-${key.toLowerCase()}`}
              >
                {isLive && (
                  <div className="live-indicator-pill">
                    <span className="live-pulse-dot" />
                    <span>Live</span>
                  </div>
                )}
                <div className="tier-header">
                  <span className="tier-name">
                    <span>{item.icon}</span>
                    <span>{item.level}</span>
                  </span>
                  <span className="tier-temp">{item.tempRange}</span>
                </div>
                <div className="tier-desc">{item.severity}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── PREVIEW NOTIFICATION (IF USER SELECTS A LEVEL OTHER THAN LIVE) ── */}
      {!isViewingLive && (
        <div className="smart-inspect-banner" role="status">
          <div>
            <span>Viewing guidance for </span>
            <strong>{config.level} Risk</strong>
            <span> (Live location is currently {AWARENESS_CONFIG[liveRiskKey]?.level} Risk)</span>
          </div>
          <button
            type="button"
            className="return-live-btn"
            onClick={() => setSelectedLevel(null)}
          >
            Return to Live ({AWARENESS_CONFIG[liveRiskKey]?.level})
          </button>
        </div>
      )}

      {/* ── PROMINENT CURRENT HEAT-RISK LEVEL & DYNAMIC AWARENESS MESSAGE ── */}
      <section
        className={`smart-hero-alert-card ${config.levelCardClass}`}
        aria-live="polite"
        id="smart-awareness-hero-card"
      >
        <div className="hero-alert-badge-row">
          <span className={`risk-level-badge ${config.badgeClass}`}>
            <span>{config.icon}</span>
            <span>{config.level} Heat Risk</span>
          </span>

          <span className="hero-alert-meta">
            {isViewingLive ? (
              <>Location: <strong>{cityName}</strong> • Real-time Data</>
            ) : (
              <>Level Reference Preview • Threshold {config.tempRange}</>
            )}
          </span>
        </div>

        {/* Dynamic primary awareness headline */}
        <h3 className="hero-awareness-headline" id="awareness-headline-text">
          {config.headline}
        </h3>

        {/* Dynamic secondary guidance message */}
        <div className="hero-awareness-guidance-box">
          <span className="guidance-icon" aria-hidden="true">📢</span>
          <p className="hero-awareness-guidance-text" id="awareness-guidance-text">
            {config.guidance}
          </p>
        </div>
      </section>

      {/* ── "WHY THIS ALERT?" SECTION ── */}
      <section className="smart-why-section" id="smart-why-this-alert-section">
        <div className="smart-section-heading">
          <h3>
            <span>🔍</span>
            <span>Why this alert?</span>
          </h3>
          <span className="hero-alert-meta">
            Classification: <strong>{config.level} ({config.tempRange})</strong>
          </span>
        </div>
        <p className="smart-section-sub">
          Environmental parameters and physiological heat-stress indicators driving
          the {config.level.toLowerCase()} heat risk alert.
        </p>

        {/* Telemetry data chips from real weather */}
        <div className="why-telemetry-grid">
          <div className="telemetry-chip">
            <span className="telemetry-label">Air Temperature</span>
            <span className="telemetry-value">{tempDisplay}</span>
          </div>
          <div className="telemetry-chip">
            <span className="telemetry-label">Humidity</span>
            <span className="telemetry-value">{humidityDisplay}</span>
          </div>
          <div className="telemetry-chip">
            <span className="telemetry-label">Wind Speed</span>
            <span className="telemetry-value">{windDisplay}</span>
          </div>
          <div className="telemetry-chip">
            <span className="telemetry-label">Rainfall</span>
            <span className="telemetry-value">{rainfallDisplay}</span>
          </div>
          <div className="telemetry-chip">
            <span className="telemetry-label">Risk Score</span>
            <span className="telemetry-value">{scoreDisplay}</span>
          </div>
        </div>

        {/* Bullet points explaining alert reasons */}
        <ul className="why-factors-list">
          {config.whyFactors.map((factor, index) => (
            <li key={index}>
              <span className="bullet-dot" aria-hidden="true" />
              <span>{factor}</span>
            </li>
          ))}
          {isViewingLive && weather?.heat_risk_explanation && (
            <li>
              <span className="bullet-dot" aria-hidden="true" />
              <span>{weather.heat_risk_explanation}</span>
            </li>
          )}
        </ul>
      </section>

      {/* ── "RECOMMENDED ACTIONS" SECTION (SEPARATE CARDS) ── */}
      <section className="smart-actions-section" id="smart-recommended-actions-section">
        <div className="smart-section-heading">
          <h3>
            <span>🛡️</span>
            <span>Recommended Actions</span>
          </h3>
          <span className="hero-alert-meta">
            Action plan for <strong>{config.level} Risk</strong>
          </span>
        </div>

        <div className="smart-actions-grid">
          {config.recommendations.map((action, index) => (
            <div
              key={index}
              className={`action-card ${config.tierClass}`}
              id={`action-card-${index}`}
            >
              <div className="action-card-header">
                <span className="action-card-icon" aria-hidden="true">{action.icon}</span>
                <span className="action-card-badge">{action.category}</span>
              </div>
              <h4 className="action-card-title">{action.title}</h4>
              <p className="action-card-desc">{action.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── EMERGENCY & HEALTH REFERENCE STRIP ── */}
      <footer className="smart-emergency-strip">
        <div className="emergency-info">
          <span>🩺</span>
          <span>
            <strong>Health Advisory:</strong> In case of severe heat exhaustion, dizziness, nausea, or fever above 40°C, seek medical assistance promptly.
          </span>
        </div>
        <div className="emergency-badge">
          <span>🚨</span> Emergency Heat Care: 108 / 112
        </div>
      </footer>
    </div>
  );
}
