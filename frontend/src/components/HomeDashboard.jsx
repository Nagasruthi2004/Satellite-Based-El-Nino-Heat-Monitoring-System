import { useMemo } from "react";
import "./HomeDashboard.css";

export default function HomeDashboard({
  weather,
  currentHeatRisk,
  latestOniData,
  onNavigate,
}) {
  const currentRiskLevel = currentHeatRisk?.level || "Medium";

  const riskBadgeClass = useMemo(() => {
    const r = String(currentRiskLevel).toLowerCase();
    if (r.includes("critical")) return "risk-critical";
    if (r.includes("high")) return "risk-high";
    if (r.includes("medium") || r.includes("moderate")) return "risk-medium";
    return "risk-low";
  }, [currentRiskLevel]);

  return (
    <div className="home-dashboard-container">
      {/* ── HERO BANNER ── */}
      <section className="home-hero-card">
        <div className="home-hero-content">
          <span className="home-hero-badge">
            <span>🛰️</span>
            <span>Planetary Climate & Thermal Intelligence Platform</span>
          </span>
          <h1 className="home-hero-title">
            Satellite-Based El Niño Heat Monitoring System
          </h1>
          <p className="home-hero-subtitle">
            An end-to-end meteorological and satellite observation platform integrating NASA MODIS Terra Land Surface Temperature (LST), NOAA Oceanic Niño Index (ONI) records, machine learning heat-risk forecasting, and automated civil safety alerts.
          </p>
        </div>

        <div className="home-hero-actions">
          <button
            type="button"
            className="btn-hero-primary"
            onClick={() => onNavigate("live")}
          >
            <span>📊</span>
            <span>Open Live Weather Map</span>
          </button>
          <button
            type="button"
            className="btn-hero-secondary"
            onClick={() => onNavigate("emergency-location")}
          >
            <span>🆘</span>
            <span>Emergency Assistance</span>
          </button>
        </div>
      </section>

      {/* ── QUICK ACTION EMERGENCY & DISASTER BAR ── */}
      <section className="home-quick-actions-bar">
        <div className="quick-bar-left">
          <span className="quick-bar-icon">🚨</span>
          <div className="quick-bar-text">
            <strong>Emergency & Disaster Rapid Assistance</strong>
            <p>Direct access to verified national emergency lines (112, 108) and official natural hazard safety protocols.</p>
          </div>
        </div>
        <div className="quick-bar-buttons">
          <button
            type="button"
            className="btn-quick-danger"
            onClick={() => onNavigate("emergency-location")}
          >
            <span>📞</span>
            <span>Nearby Help (112 / 108)</span>
          </button>
          <button
            type="button"
            className="btn-quick-warning"
            onClick={() => onNavigate("disaster-info")}
          >
            <span>📖</span>
            <span>Disaster Information</span>
          </button>
        </div>
      </section>

      {/* ── EXECUTIVE SUMMARY CARDS GRID ── */}
      <div className="home-summary-grid">
        {/* Card 1: Live Heat & Temperature */}
        <article className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-title-area">
              <span className="summary-card-icon">🌡️</span>
              <h2 className="summary-card-title">Live Heat & Weather</h2>
            </div>
            <span className={`summary-badge ${riskBadgeClass}`}>
              {currentRiskLevel} Risk
            </span>
          </div>

          <div>
            <div className="summary-main-val">
              <span className="summary-number">
                {weather?.temperature != null ? `${Number(weather.temperature).toFixed(1)}` : "34.2"}
              </span>
              <span className="summary-unit">°C ambient</span>
            </div>
            <p className="summary-desc">
              Monitoring <strong>{weather?.city || "Coimbatore"}</strong>: {weather?.weather_description || "Normal conditions"}. Humidity at {weather?.humidity || 52}%.
            </p>
            <p className="summary-meta-note">Source: OpenWeatherMap meteorological observations</p>
          </div>

          <button
            type="button"
            className="btn-card-nav"
            onClick={() => onNavigate("live")}
          >
            <span>Inspect Live Weather Map</span>
            <span>→</span>
          </button>
        </article>

        {/* Card 2: India Heat Map Preview (LST) */}
        <article className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-title-area">
              <span className="summary-card-icon">🗺️</span>
              <h2 className="summary-card-title">India Heat Map (LST)</h2>
            </div>
            <span className="summary-badge neutral">34 States & UTs</span>
          </div>

          <div>
            <div className="summary-main-val">
              <span className="summary-number">34.8</span>
              <span className="summary-unit">°C Nat&apos;l Avg (2025)</span>
            </div>
            <p className="summary-desc">
              State-wise multi-year Land Surface Temperature tracking across 2020–2025. Explore thermal variations and regional hot-spots.
            </p>
            <p className="summary-meta-note">Source: Prepared historical LST dataset, 2020–2025</p>
          </div>

          <button
            type="button"
            className="btn-card-nav"
            onClick={() => onNavigate("india-lst")}
          >
            <span>Explore India LST Map</span>
            <span>→</span>
          </button>
        </article>

        {/* Card 3: Oceanic Niño Index (ENSO) Status */}
        <article className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-title-area">
              <span className="summary-card-icon">🌊</span>
              <h2 className="summary-card-title">El Niño & ENSO Status</h2>
            </div>
            <span className="summary-badge neutral">
              {latestOniData?.status || "Neutral"}
            </span>
          </div>

          <div>
            <div className="summary-main-val">
              <span className="summary-number">
                {latestOniData?.oni != null ? `${latestOniData.oni > 0 ? "+" : ""}${latestOniData.oni}` : "+0.3"}
              </span>
              <span className="summary-unit">°C ONI anomaly</span>
            </div>
            <p className="summary-desc">
              Pacific SST equatorial anomaly. ENSO serves as a planetary thermal driver influencing Indian monsoon and seasonal heat patterns.
            </p>
            <p className="summary-meta-note">Source: NOAA Climate Prediction Center — ONI</p>
          </div>

          <button
            type="button"
            className="btn-card-nav"
            onClick={() => onNavigate("enso-analysis")}
          >
            <span>Open El Niño & ENSO Analysis</span>
            <span>→</span>
          </button>
        </article>

        {/* Card 4: 2026 Heat Prediction Summary */}
        <article className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-title-area">
              <span className="summary-card-icon">🔮</span>
              <h2 className="summary-card-title">2026 Heat Prediction</h2>
            </div>
            <span className="summary-badge model">Model Estimate</span>
          </div>

          <div>
            <div className="summary-main-val">
              <span className="summary-number">35.08</span>
              <span className="summary-unit">°C Projected Avg</span>
            </div>
            <p className="summary-desc">
              State-wise Linear Regression estimates trained on verified 2020–2025 historical data. Identifies emerging thermal hotspot trajectories.
            </p>
            <p className="summary-meta-note">Disclosure: Model estimate based on historical 2020–2025 data (not observed)</p>
          </div>

          <button
            type="button"
            className="btn-card-nav"
            onClick={() => onNavigate("heat-2026")}
          >
            <span>View 2026 Projections</span>
            <span>→</span>
          </button>
        </article>

        {/* Card 5: Smart Awareness Guidance */}
        <article className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-title-area">
              <span className="summary-card-icon">💡</span>
              <h2 className="summary-card-title">Smart Heat Awareness</h2>
            </div>
            <span className="summary-badge verified">Public Safety</span>
          </div>

          <div>
            <div className="summary-main-val">
              <span className="summary-number" style={{ fontSize: "20px" }}>
                {currentRiskLevel === "Critical"
                  ? "Extreme Heat Protocol"
                  : currentRiskLevel === "High"
                  ? "Hydration Alert"
                  : "Normal Guidelines"}
              </span>
            </div>
            <p className="summary-desc">
              Actionable behavioral recommendations: maintain continuous electrolyte hydration, restrict outdoor exertion during 12 PM - 3 PM, and monitor at-risk relatives.
            </p>
            <p className="summary-meta-note">Standard: NDMA & IMD National Guidelines</p>
          </div>

          <button
            type="button"
            className="btn-card-nav"
            onClick={() => onNavigate("smart-awareness")}
          >
            <span>Read Awareness Guidance</span>
            <span>→</span>
          </button>
        </article>

        {/* Card 6: NASA MODIS Planetary Thermal Map */}
        <article className="summary-card">
          <div className="summary-card-header">
            <div className="summary-card-title-area">
              <span className="summary-card-icon">🌍</span>
              <h2 className="summary-card-title">World Heat Map</h2>
            </div>
            <span className="summary-badge neutral">Global Satellite</span>
          </div>

          <div>
            <div className="summary-main-val">
              <span className="summary-number">1 km</span>
              <span className="summary-unit">Spatial Resolution</span>
            </div>
            <p className="summary-desc">
              Global Land Surface Temperature observations from NASA Terra MOD11A2 satellite sensor, illustrating worldwide heat belts and thermal anomalies.
            </p>
            <p className="summary-meta-note">Source: NASA MODIS Terra MOD11A2 LST observations</p>
          </div>

          <button
            type="button"
            className="btn-card-nav"
            onClick={() => onNavigate("world-heatmap")}
          >
            <span>Launch World Heat Map</span>
            <span>→</span>
          </button>
        </article>
      </div>
    </div>
  );
}
