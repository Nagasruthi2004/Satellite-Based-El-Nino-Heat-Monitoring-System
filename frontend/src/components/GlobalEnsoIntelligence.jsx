import { useState, useEffect } from "react";

export default function GlobalEnsoIntelligence({
  ensoData,
  loading,
  error,
  selectedRegion,
  onSelectRegion,
  onFocusPacific,
  onRetry,
}) {
  const [activeRegionTab, setActiveRegionTab] = useState(null);

  // Synchronize active region tab with selected region from map
  useEffect(() => {
    if (selectedRegion) {
      setActiveRegionTab(selectedRegion.id);
    }
  }, [selectedRegion]);

  const handleRegionClick = (reg) => {
    setActiveRegionTab(reg.id);
    onSelectRegion?.(reg);
  };

  // If loading and no data yet
  if (loading && !ensoData) {
    return (
      <div className="siha-loading-stage" role="status">
        <div className="siha-loading-ring" />
        <div className="siha-loading-msg">
          <h3>Connecting to Official NOAA Climate Prediction Center Feed...</h3>
          <p>Retrieving authentic ENSO Diagnostic Discussion telemetry, ONI records, and Pacific SST indices.</p>
        </div>
      </div>
    );
  }

  // If source cannot be reached and no data available
  if (error && !ensoData) {
    return (
      <div className="siha-unavailable-banner" role="alert">
        <div className="siha-unavail-icon">🌐⚠️</div>
        <div className="siha-unavail-text">
          <h3>Official NOAA CPC ENSO Source Currently Unavailable</h3>
          <p>
            {error || "Unable to retrieve live ENSO telemetry from NOAA Climate Prediction Center servers."}
          </p>
          <div className="siha-unavail-links">
            <span className="siha-link-lbl">Official Source References:</span>
            <a
              href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml"
              target="_blank"
              rel="noopener noreferrer"
              className="siha-external-link-btn"
            >
              NOAA CPC ENSO Discussion ↗
            </a>
            <a
              href="https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="siha-external-link-btn"
            >
              NOAA ONI ASCII Records ↗
            </a>
          </div>
          <button type="button" className="siha-unavail-action" onClick={onRetry}>
            🔄 Retry NOAA Telemetry Connection
          </button>
        </div>
      </div>
    );
  }

  const sstRegions = ensoData?.pacific_sst_regions || [];
  const teleRegions = ensoData?.teleconnection_regions || [];
  const activeRegion = teleRegions.find((r) => r.id === activeRegionTab) || teleRegions[0];

  return (
    <div className="siha-enso-container">
      {/* ── 1. NOAA CPC OFFICIAL ADVISORY HERO STATUS ── */}
      <section className="siha-enso-status-card">
        <div className="siha-enso-status-header">
          <div className="siha-enso-status-left">
            <div className="siha-status-badge-row">
              <span className="siha-badge">Official Meteorological Intelligence</span>
              <span className={`siha-live-pill ${ensoData?.is_live ? "live" : "archive"}`}>
                <span className="pulse-dot" />
                {ensoData?.is_live ? "Official NOAA CPC Live Telemetry" : "Verified NOAA CPC Archive Dataset"}
              </span>
            </div>
            <h2 className="siha-enso-status-title">
              {ensoData?.advisory_status || "El Niño Advisory"}
            </h2>
            <p className="siha-enso-status-sub">
              National Oceanic and Atmospheric Administration (NOAA) / Climate Prediction Center (CPC)
            </p>
          </div>

          <div className="siha-enso-status-metrics">
            <div className="siha-metric-chip">
              <span className="chip-lbl">Oceanic Niño Index (ONI)</span>
              <strong className="chip-val oni">
                {ensoData?.oni !== undefined ? `${ensoData.oni >= 0 ? "+" : ""}${ensoData.oni.toFixed(2)}°C` : "—"}
              </strong>
              <small className="chip-sub">Niño 3.4 3-Month Running Mean</small>
            </div>

            <div className="siha-metric-chip">
              <span className="chip-lbl">Relative ONI (RONI)</span>
              <strong className="chip-val roni">
                {ensoData?.roni !== undefined ? `${ensoData.roni >= 0 ? "+" : ""}${ensoData.roni.toFixed(2)}°C` : "—"}
              </strong>
              <small className="chip-sub">Tropical Mean SST Adjusted</small>
            </div>

            <div className="siha-metric-chip">
              <span className="chip-lbl">Phase Trend</span>
              <strong className="chip-val trend">{ensoData?.oni_trend || "Active Phase"}</strong>
              <small className="chip-sub">{ensoData?.latest_season || "Monitored Cycle"}</small>
            </div>

            <div className="siha-metric-chip">
              <span className="chip-lbl">Official Release</span>
              <strong className="chip-val date">{ensoData?.published_date || "Current"}</strong>
              <small className="chip-sub">NOAA / NCEP Consensus</small>
            </div>
          </div>
        </div>

        {/* Source links & disclaimer strip */}
        <div className="siha-enso-sources-strip">
          <span className="sources-title">Verified Official NOAA CPC Source Records:</span>
          <div className="sources-links">
            {ensoData?.official_sources?.map((s, idx) => (
              <a
                key={idx}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-tag"
                title={s.description || s.name}
              >
                <span>🏛️</span> {s.name} <span className="arrow">↗</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. PACIFIC SEA-SURFACE TEMPERATURE ANOMALY REGIONS ── */}
      <section className="siha-pacific-sst-section">
        <div className="siha-section-header-row">
          <div>
            <span className="siha-badge">Equatorial Pacific Ocean Radiative Telemetry</span>
            <h3 className="siha-block-heading">Pacific Sea-Surface Temperature (SST) Anomaly Zones</h3>
            <p className="siha-block-desc">
              Coupled ocean-atmosphere observation zones rendered directly on the world map. Click any region to inspect or center the map.
            </p>
          </div>
          <button
            type="button"
            className="siha-focus-pacific-btn"
            onClick={onFocusPacific}
            title="Recenter World Map on the Equatorial Pacific Ocean"
          >
            🌊 Center Map on Pacific SST Basin
          </button>
        </div>

        <div className="siha-sst-grid">
          {sstRegions.map((reg) => (
            <div
              key={reg.id}
              className={`siha-sst-card ${reg.id === "nino34" ? "primary-nino" : ""}`}
              onClick={() => onFocusPacific?.(reg.center)}
            >
              <div className="siha-sst-card-top">
                <span className="siha-sst-id">{reg.id.toUpperCase()}</span>
                <span className="siha-sst-anomaly-pill">
                  +{reg.sst_anomaly}°C
                </span>
              </div>
              <h4 className="siha-sst-name">{reg.name}</h4>
              <div className="siha-sst-data-row">
                <span className="lbl">Baseline SST:</span>
                <strong className="val">{reg.baseline_sst}°C</strong>
              </div>
              <div className="siha-sst-data-row">
                <span className="lbl">Observed SST:</span>
                <strong className="val">{(reg.baseline_sst + reg.sst_anomaly).toFixed(1)}°C</strong>
              </div>
              <div className="siha-sst-data-row">
                <span className="lbl">Status:</span>
                <strong className="val status">{reg.status}</strong>
              </div>
              <p className="siha-sst-mechanism">{reg.mechanism}</p>
              <div className="siha-sst-action-hint">
                <span>🔍 Click to inspect zone on World Map</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. GLOBAL TELECONNECTION INDICATOR INSPECTOR ── */}
      <section className="siha-teleconnections-section">
        <div className="siha-section-header-row">
          <div>
            <span className="siha-badge">Global Teleconnection Climate Coupling</span>
            <h3 className="siha-block-heading">Country &amp; Regional Climate Heat Indicators</h3>
            <p className="siha-block-desc">
              Select any monitored continent or region below or click the glowing markers on the World Map to evaluate ENSO-coupled heatwave risks.
            </p>
          </div>
        </div>

        {/* Region selector tabs */}
        <div className="siha-region-pills-bar">
          {teleRegions.map((reg) => {
            const isSelected = activeRegion?.id === reg.id;
            return (
              <button
                key={reg.id}
                type="button"
                className={`siha-region-pill ${isSelected ? "selected" : ""}`}
                onClick={() => handleRegionClick(reg)}
              >
                <span className={`vuln-dot ${reg.heatwave_vulnerability.toLowerCase()}`} />
                <span className="name">{reg.country}</span>
              </button>
            );
          })}
        </div>

        {/* Selected region indicator deep-dive card */}
        {activeRegion && (
          <div className="siha-teleconnection-detail-card">
            <div className="siha-tele-header">
              <div>
                <span className="siha-tele-eyebrow">MONITORED TELECONNECTION CORRIDOR</span>
                <h3 className="siha-tele-title">{activeRegion.region_name}</h3>
                <p className="siha-tele-impact">{activeRegion.climate_impact}</p>
              </div>

              <div className="siha-tele-badges">
                <div className="siha-tele-badge-group">
                  <span className="lbl">Heatwave Vulnerability</span>
                  <span className={`badge-pill ${activeRegion.heatwave_vulnerability.toLowerCase()}`}>
                    {activeRegion.heatwave_vulnerability} Risk
                  </span>
                </div>
                <div className="siha-tele-badge-group">
                  <span className="lbl">Typical SST Coupling</span>
                  <span className="badge-pill coupling">{activeRegion.typical_sst_coupling}</span>
                </div>
                <div className="siha-tele-badge-group">
                  <span className="lbl">Primary Risk Season</span>
                  <span className="badge-pill season">{activeRegion.primary_risk_season}</span>
                </div>
              </div>
            </div>

            <div className="siha-tele-indicators-grid">
              {Object.entries(activeRegion.indicators || {}).map(([key, val], idx) => (
                <div key={idx} className="siha-tele-indicator-item">
                  <span className="indicator-key">{key.replace(/_/g, " ").toUpperCase()}</span>
                  <strong className="indicator-val">{val}</strong>
                </div>
              ))}
            </div>

            <div className="siha-tele-mechanism-box">
              <span className="mech-icon">🔬</span>
              <div className="mech-text">
                <strong>Atmospheric Teleconnection Mechanism:</strong>
                <p>{activeRegion.teleconnection_mechanism}</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
