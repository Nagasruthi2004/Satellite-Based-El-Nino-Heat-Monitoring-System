import { useState } from "react";

export default function CoolingPriorityZones({
  priorityData,
  loading,
  error,
  selectedZone,
  onSelectZone,
  onSwitchToActionPlanner,
  onRetry,
}) {
  const [filterTier, setFilterTier] = useState("all"); // "all" | "urgent" | "high" | "moderate"

  const zones = priorityData?.zones || [];

  const filteredZones = filterTier === "all"
    ? zones
    : zones.filter((z) => z.badge_class === filterTier);

  if (loading && !priorityData) {
    return (
      <div className="siha-loading-stage" role="status">
        <div className="siha-loading-ring" />
        <div className="siha-loading-msg">
          <h3>Computing Transparent Urban Cooling Priority Rankings...</h3>
          <p>Evaluating surface thermal intensity (LST 45%), canopy deficit (35%), and ambient heat index (20%).</p>
        </div>
      </div>
    );
  }

  if (error && !priorityData) {
    return (
      <div className="siha-unavailable-banner" role="alert">
        <div className="siha-unavail-icon">⚠️</div>
        <div className="siha-unavail-text">
          <h3>Cooling Priority Telemetry Currently Unavailable</h3>
          <p>{error || "Unable to rank urban cooling priority zones."}</p>
          <button type="button" className="siha-retry-btn" onClick={onRetry}>
            🔄 Retry Calculation
          </button>
        </div>
      </div>
    );
  }

  const activeZone = selectedZone || zones[0];

  return (
    <div className="siha-priority-container">
      {/* ── MANDATORY PLANNING DISCLAIMER BANNER ── */}
      <div className="siha-disclaimer-card" role="note">
        <div className="siha-disclaimer-icon">📋</div>
        <div className="siha-disclaimer-body">
          <h4>{priorityData?.methodology_label || "Urban Heat Planning-Priority Estimate"}</h4>
          <p>
            {priorityData?.planning_disclaimer ||
              "This scoring represents an urban planning indicator based on environmental surface heat (LST) and vegetative canopy deficits. It is NOT a clinical health-risk or mortality prediction. Population counts are not invented and are explicitly omitted where reliable census ground-truth is unavailable."}
          </p>
        </div>
      </div>

      {/* ── PRIORITY METRIC TIERS SUMMARY ── */}
      <div className="siha-priority-metrics-bar">
        <div className="siha-pstat-card">
          <span className="siha-pstat-lbl">Ranked Regional Zones</span>
          <strong className="siha-pstat-val">{zones.length} Evaluated</strong>
          <small className="siha-pstat-sub">Strictly verified data inputs</small>
        </div>
        <div className="siha-pstat-card">
          <span className="siha-pstat-lbl">Tier 1: Urgent Priority</span>
          <strong className="siha-pstat-val urgent">
            {zones.filter((z) => z.badge_class === "urgent").length} Areas
          </strong>
          <small className="siha-pstat-sub">Priority Score &ge; 75 / 100</small>
        </div>
        <div className="siha-pstat-card">
          <span className="siha-pstat-lbl">Tier 2: High Priority</span>
          <strong className="siha-pstat-val high">
            {zones.filter((z) => z.badge_class === "high").length} Areas
          </strong>
          <small className="siha-pstat-sub">Priority Score 60 – 74</small>
        </div>
        <div className="siha-pstat-card">
          <span className="siha-pstat-lbl">Scoring Formula</span>
          <strong className="siha-pstat-formula">45% LST + 35% Canopy + 20% Ambient</strong>
          <small className="siha-pstat-sub">Transparent mathematical weighting</small>
        </div>
      </div>

      {/* ── MAIN SPLIT: SELECTED ZONE TELEMETRY + RANKED LEADERBOARD ── */}
      <div className="siha-priority-main-grid">
        {/* Selected Zone Analysis Card */}
        <div className="siha-priority-detail-panel">
          <div className="siha-pdetail-header">
            <div>
              <div className="siha-rank-badge-wrap">
                <span className="siha-rank-number">Rank #{activeZone?.rank || 1}</span>
                <span className={`siha-priority-tier-badge ${activeZone?.badge_class || "urgent"}`}>
                  {activeZone?.priority_tier || "Priority"}
                </span>
              </div>
              <h3 className="siha-pdetail-title">
                {activeZone?.location || "Select Zone"}, {activeZone?.country}
              </h3>
              <span className="siha-pdetail-coords">
                {activeZone?.lat !== undefined && activeZone?.lon !== undefined
                  ? `${activeZone.lat.toFixed(4)}°, ${activeZone.lon.toFixed(4)}°`
                  : "Coordinates Unavailable"}
              </span>
            </div>

            <div className="siha-score-orb">
              <span className="siha-score-orb-val">{activeZone?.priority_score ?? "—"}</span>
              <span className="siha-score-orb-lbl">Priority Score / 100</span>
            </div>
          </div>

          {/* Rationale Callout */}
          <div className="siha-reason-box">
            <span className="siha-reason-title">Primary Priority Rationale:</span>
            <p className="siha-reason-text">{activeZone?.primary_reason}</p>
          </div>

          {/* Transparent Contributing Factors Breakdown */}
          <div className="siha-factors-breakdown">
            <h4 className="siha-breakdown-heading">Contributing Factor Weights:</h4>

            {/* Factor 1: LST */}
            <div className="siha-factor-item">
              <div className="siha-factor-labels">
                <span>🛰️ Surface Temperature Component (45% weight)</span>
                <strong>{activeZone?.contributing_factors?.lst_contribution ?? 0} pts (LST: {activeZone?.metrics?.lst_celsius}°C)</strong>
              </div>
              <div className="siha-factor-bar-track">
                <div
                  className="siha-factor-bar-fill lst"
                  style={{ width: `${Math.min(100, ((activeZone?.contributing_factors?.lst_contribution || 0) / 45) * 100)}%` }}
                />
              </div>
            </div>

            {/* Factor 2: Canopy Deficit */}
            <div className="siha-factor-item">
              <div className="siha-factor-labels">
                <span>🌿 Vegetation &amp; Canopy Deficit (35% weight)</span>
                <strong>
                  {activeZone?.contributing_factors?.vegetation_deficit_contribution ?? 0} pts (Canopy: {activeZone?.metrics?.canopy_cover_pct}%)
                </strong>
              </div>
              <div className="siha-factor-bar-track">
                <div
                  className="siha-factor-bar-fill canopy"
                  style={{ width: `${Math.min(100, ((activeZone?.contributing_factors?.vegetation_deficit_contribution || 0) / 35) * 100)}%` }}
                />
              </div>
            </div>

            {/* Factor 3: Ambient Heat */}
            <div className="siha-factor-item">
              <div className="siha-factor-labels">
                <span>🌡️ Ambient Heat Index Component (20% weight)</span>
                <strong>
                  {activeZone?.contributing_factors?.ambient_heat_contribution ?? 0} pts (Heat Index: {activeZone?.metrics?.heat_index_celsius}°C)
                </strong>
              </div>
              <div className="siha-factor-bar-track">
                <div
                  className="siha-factor-bar-fill ambient"
                  style={{ width: `${Math.min(100, ((activeZone?.contributing_factors?.ambient_heat_contribution || 0) / 20) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Demographic & Population Data Transparency */}
          <div className="siha-pop-transparency-card">
            <span className="siha-pop-lbl">Population &amp; Demographic Vulnerability Indicator:</span>
            <p className="siha-pop-val">
              {activeZone?.population_indicator ||
                "Not Available in Verified Source Dataset (Omitted to prevent unverified assumptions)"}
            </p>
            <small>
              Per technical specification, population counts are not fabricated or guessed. Only validated physical indicators are used in scoring.
            </small>
          </div>

          {/* Action Trigger Button */}
          <div className="siha-paction-bar">
            <button
              type="button"
              className="siha-action-plan-btn"
              onClick={() => onSwitchToActionPlanner?.(activeZone)}
            >
              🛠️ Open Heat Reduction Action Planner for {activeZone?.location} &rarr;
            </button>
          </div>
        </div>

        {/* Priority Leaderboard Table / Cards */}
        <div className="siha-priority-leaderboard-panel">
          <div className="siha-lboard-header">
            <h4>Cooling Priority Leaderboard</h4>
            <div className="siha-tier-filter-pills">
              <button
                type="button"
                className={`siha-tfilter-btn ${filterTier === "all" ? "active" : ""}`}
                onClick={() => setFilterTier("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`siha-tfilter-btn ${filterTier === "urgent" ? "active" : ""}`}
                onClick={() => setFilterTier("urgent")}
              >
                Urgent
              </button>
              <button
                type="button"
                className={`siha-tfilter-btn ${filterTier === "high" ? "active" : ""}`}
                onClick={() => setFilterTier("high")}
              >
                High
              </button>
              <button
                type="button"
                className={`siha-tfilter-btn ${filterTier === "moderate" ? "active" : ""}`}
                onClick={() => setFilterTier("moderate")}
              >
                Moderate
              </button>
            </div>
          </div>

          <div className="siha-lboard-list">
            {filteredZones.map((zone) => {
              const isSelected = activeZone?.id === zone.id;
              return (
                <div
                  key={zone.id}
                  className={`siha-lboard-card ${isSelected ? "selected" : ""} ${zone.badge_class}`}
                  onClick={() => onSelectZone?.(zone)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="siha-lboard-left">
                    <span className="siha-lboard-rank">#{zone.rank}</span>
                    <div>
                      <strong className="siha-lboard-name">{zone.location}</strong>
                      <span className="siha-lboard-country">{zone.country}</span>
                    </div>
                  </div>

                  <div className="siha-lboard-mid">
                    <span className={`siha-lboard-pill ${zone.badge_class}`}>
                      {zone.priority_tier}
                    </span>
                    <span className="siha-lboard-lst">
                      LST: {zone.metrics?.lst_celsius}°C | Canopy: {zone.metrics?.canopy_cover_pct}%
                    </span>
                  </div>

                  <div className="siha-lboard-right">
                    <strong className="siha-lboard-score">{zone.priority_score}</strong>
                    <span className="siha-lboard-score-lbl">Score</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
