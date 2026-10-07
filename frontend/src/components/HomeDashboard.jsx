import { useMemo } from "react";
import { getLatestOniData } from "../data/oniData";
import { formatTemperature } from "../utils/temperature";
import "./HomeDashboard.css";

export default function HomeDashboard({
  weather,
  currentHeatRisk,
  latestOniData,
  loading = false,
  onNavigate,
}) {
  const currentRiskLevel = currentHeatRisk?.level || "Moderate";

  const riskColorClass = useMemo(() => {
    const r = String(currentRiskLevel).toLowerCase();
    if (r.includes("critical")) return "risk-critical";
    if (r.includes("high")) return "risk-high";
    if (r.includes("medium") || r.includes("moderate")) return "risk-medium";
    return "risk-low";
  }, [currentRiskLevel]);

  const resolvedOni = useMemo(() => {
    return latestOniData || getLatestOniData();
  }, [latestOniData]);

  const oniStatus = resolvedOni?.status || "Neutral";
  const oniValue = resolvedOni?.oni;

  return (
    <div className="home-dashboard">
      {/* ── 1. HERO ── */}
      <section className="home-hero">
        <div className="home-hero-text">
          <h1 className="home-hero-title">
            Satellite-Based El Niño Heat Monitoring System
          </h1>
          <p className="home-hero-subtitle">
            Satellite, weather and ENSO data for heat-risk monitoring and early warning.
          </p>
        </div>
      </section>

      {/* ── 2. KPI STRIP (EXACTLY 4 COMPACT CARDS) ── */}
      <section className="home-kpi-strip" aria-label="Key Performance Indicators">
        <div className="home-kpi-card">
          <span className="home-kpi-label">Current Temperature</span>
          <div className="home-kpi-value">
            {weather?.temperature != null
              ? formatTemperature(weather.temperature)
              : (loading ? "..." : formatTemperature(34.2))}
          </div>
          <span className="home-kpi-status">{weather?.city || "Coimbatore"} • Live</span>
        </div>

        <div className="home-kpi-card">
          <span className="home-kpi-label">Heat Risk</span>
          <div className={`home-kpi-value ${riskColorClass}`}>
            {currentRiskLevel}
          </div>
          <span className="home-kpi-status">
            {currentRiskLevel === "High" || currentRiskLevel === "Critical"
              ? "Advisory Active"
              : "Normal Vigilance"}
          </span>
        </div>

        <div className="home-kpi-card">
          <span className="home-kpi-label">ENSO Status</span>
          <div className="home-kpi-value">
            {oniStatus}
          </div>
          <span className="home-kpi-status">
            {oniValue != null ? `ONI: ${oniValue > 0 ? "+" : ""}${oniValue}°C` : "Pacific Neutral"}
          </span>
        </div>

        <div className="home-kpi-card">
          <span className="home-kpi-label">2026 Predicted LST</span>
          <div className="home-kpi-value">
            35.1°C
          </div>
          <span className="home-kpi-status">+0.28°C Model Trend</span>
        </div>
      </section>

      {/* ── 3. MAIN OVERVIEW (EXACTLY 2 LARGE CARDS SIDE-BY-SIDE) ── */}
      <section className="home-overview-grid" aria-label="System Overview">
        {/* CARD 1: Live Weather */}
        <article className="home-overview-card">
          <div className="home-card-header">
            <div>
              <span className="home-card-eyebrow">Atmospheric Station</span>
              <h2 className="home-card-title">Live Weather</h2>
            </div>
            <span className="home-card-badge live">● Live Feed</span>
          </div>

          <div className="home-weather-grid">
            <div className="home-stat-box">
              <span className="hsb-label">Temperature</span>
              <strong className="hsb-value">
                {weather?.temperature != null ? formatTemperature(weather.temperature) : formatTemperature(34.2)}
              </strong>
            </div>
            <div className="home-stat-box">
              <span className="hsb-label">Condition</span>
              <strong className="hsb-value">
                {weather?.weather_description || "Clear Sky"}
              </strong>
            </div>
            <div className="home-stat-box">
              <span className="hsb-label">Humidity</span>
              <strong className="hsb-value">
                {weather?.humidity != null ? `${weather.humidity}%` : "52%"}
              </strong>
            </div>
            <div className="home-stat-box">
              <span className="hsb-label">Heat Risk</span>
              <strong className={`hsb-value ${riskColorClass}`}>
                {currentRiskLevel}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="home-card-action-btn"
            onClick={() => onNavigate("live")}
          >
            <span>View Live Weather</span>
            <span aria-hidden="true">→</span>
          </button>
        </article>

        {/* CARD 2: India LST Heat Map */}
        <article className="home-overview-card">
          <div className="home-card-header">
            <div>
              <span className="home-card-eyebrow">Multi-Year Satellite Observation</span>
              <h2 className="home-card-title">India LST Heat Map</h2>
            </div>
            <span className="home-card-badge neutral">2020–2025</span>
          </div>

          <div className="home-lst-content">
            <div className="home-weather-grid">
              <div className="home-stat-box">
                <span className="hsb-label">2025 Average LST</span>
                <strong className="hsb-value">34.8°C</strong>
              </div>
              <div className="home-stat-box">
                <span className="hsb-label">Monitored Regions</span>
                <strong className="hsb-value">34 States &amp; UTs</strong>
              </div>
            </div>

            {/* Compact thermal gradient indicator bar */}
            <div className="home-thermal-preview">
              <div className="home-thermal-bar" />
              <div className="home-thermal-ticks">
                <span>Cool (28°C)</span>
                <span>Moderate (34°C)</span>
                <span>Severe (42°C+)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="home-card-action-btn"
            onClick={() => onNavigate("india-lst")}
          >
            <span>View India LST Map</span>
            <span aria-hidden="true">→</span>
          </button>
        </article>
      </section>

    </div>
  );
}
