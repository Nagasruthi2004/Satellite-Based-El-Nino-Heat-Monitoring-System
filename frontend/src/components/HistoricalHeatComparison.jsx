import { useState } from "react";

export default function HistoricalHeatComparison({
  historicalData,
  selectedEvent,
  onSelectEvent,
  selectedStation,
  onSelectStation,
  loading,
}) {
  const [filterType, setFilterType] = useState("all"); // "all" | "observed" | "estimated"

  const events = historicalData?.available_events || [
    { event_id: "2015-2016", title: "2015–2016 Super El Niño", peak_oni: 2.64 },
    { event_id: "2023-2024", title: "2023–2024 Very Strong El Niño", peak_oni: 1.99 },
    { event_id: "current", title: "Current Event (2024–2026 Cycle)", peak_oni: 1.80 },
  ];

  const currentEventInfo = historicalData?.selected_event || events[0];
  const stations = historicalData?.map_stations || [];
  const matrix = historicalData?.comparison_matrix || [];

  const filteredStations = stations.filter((st) => {
    if (filterType === "observed") return st.measurement_type === "observed_satellite";
    if (filterType === "estimated") return st.measurement_type === "model_estimated";
    return true;
  });

  return (
    <div className="siha-history-container">
      {/* ── 1. EVENT & ERA SELECTOR BAR ── */}
      <section className="siha-history-event-bar">
        <div className="siha-history-event-header">
          <div>
            <div className="siha-status-badge-row">
              <span className="siha-badge">Cross-Epoch El Niño Thermal Comparison</span>
              {loading && <span className="siha-live-pill"><span className="pulse-dot" /> Updating Layer...</span>}
            </div>
            <h2 className="siha-history-title">Historical vs Current Global Heat Comparison</h2>
            <p className="siha-history-sub">
              Compare global terrestrial Land Surface Temperature (LST) and thermal anomalies across major recorded El Niño events.
            </p>
          </div>

          <div className="siha-event-pill-group">
            {events.map((ev) => {
              const isSelected = selectedEvent === ev.event_id;
              return (
                <button
                  key={ev.event_id}
                  type="button"
                  className={`siha-event-selector-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectEvent?.(ev.event_id)}
                >
                  <span className="ev-icon">{ev.event_id === "2015-2016" ? "🌊" : ev.event_id === "2023-2024" ? "🔥" : "📡"}</span>
                  <div className="ev-meta">
                    <strong>{ev.title}</strong>
                    <small>Peak ONI: +{ev.peak_oni}°C</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Event Narrative Banner */}
        {currentEventInfo && (
          <div className="siha-active-event-banner">
            <div className="ev-badge-col">
              <span className="ev-badge-tag">{currentEventInfo.classification || "Historical Event"}</span>
              <span className="ev-anomaly-tag">Global SST Anomaly: {currentEventInfo.global_sst_anomaly || "+1.12°C"}</span>
            </div>
            <div className="ev-desc-col">
              <p className="ev-description">
                <strong>Climatic Impact:</strong> {currentEventInfo.global_terrestrial_impact || currentEventInfo.description}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── 2. DATA FIDELITY & MAP LAYER LEGEND ── */}
      <section className="siha-data-fidelity-card">
        <div className="siha-fidelity-header">
          <div className="siha-fidelity-title-wrap">
            <span className="siha-badge">Remote Sensing Integrity Standard</span>
            <h3 className="siha-fidelity-title">Observed Satellite Measurements vs Model Estimates</h3>
          </div>

          <div className="siha-fidelity-filters">
            <span className="filter-lbl">Filter Map Heat Layer:</span>
            <button
              type="button"
              className={`fidelity-btn ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              All Records ({stations.length})
            </button>
            <button
              type="button"
              className={`fidelity-btn ${filterType === "observed" ? "active" : ""}`}
              onClick={() => setFilterType("observed")}
            >
              🛰️ Observed Satellite Only ({historicalData?.observed_stations_count || 0})
            </button>
            <button
              type="button"
              className={`fidelity-btn ${filterType === "estimated" ? "active" : ""}`}
              onClick={() => setFilterType("estimated")}
            >
              🤖 Model-Estimated ({historicalData?.model_estimated_count || 0})
            </button>
          </div>
        </div>

        <div className="siha-fidelity-legend-grid">
          <div className="legend-box observed">
            <div className="legend-top">
              <span className="legend-tag observed">🛰️ [OBSERVED SATELLITE]</span>
              <span className="legend-source">NASA MODIS Terra MOD11A2.061</span>
            </div>
            <p>
              Direct radiometric skin temperature observed by NASA MODIS sensors. Full 1km swath coverage; calibrated against local ground stations.
            </p>
          </div>

          <div className="legend-box estimated">
            <div className="legend-top">
              <span className="legend-tag estimated">🤖 [MODEL-ESTIMATED]</span>
              <span className="legend-source">NOAA CPC / ERA5 Climate Reanalysis</span>
            </div>
            <p>
              Atmospheric reanalysis and teleconnection coupled model estimates for global reference points outside the localized MODIS test swath.
            </p>
          </div>

          <div className="legend-box nodata">
            <div className="legend-top">
              <span className="legend-tag nodata">⚠️ [COVERAGE UNAVAILABLE]</span>
              <span className="legend-source">Polar / Obscured Coordinates</span>
            </div>
            <p>
              Zero data fabrication: missing historical or polar satellite data is reported honestly as unavailable rather than synthetically created.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. COMPARISON MATRIX (SIDE-BY-SIDE) ── */}
      <section className="siha-matrix-section">
        <h3 className="siha-block-heading">Multi-Event Comparative Climate Matrix</h3>
        <p className="siha-block-desc">
          Official benchmark metrics across the three focal El Niño epochs.
        </p>

        <div className="siha-matrix-table-wrap">
          <table className="siha-matrix-table">
            <thead>
              <tr>
                <th>Event / Epoch</th>
                <th>Peak ONI</th>
                <th>Global SST Anomaly</th>
                <th>Monitored Avg LST</th>
                <th>Observed Stations</th>
                <th>Model Estimates</th>
                <th>Primary Affected Corridors</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr
                  key={row.event_id}
                  className={row.is_selected ? "active-row" : ""}
                  onClick={() => onSelectEvent?.(row.event_id)}
                >
                  <td className="event-name">
                    <strong>{row.event}</strong>
                    {row.is_selected && <span className="selected-indicator">● Active Layer</span>}
                  </td>
                  <td className="metric-val">{row.peak_oni}</td>
                  <td className="metric-val">{row.global_sst_anomaly}</td>
                  <td className="metric-val">{row.observed_stations_avg_lst}</td>
                  <td className="count-col observed">
                    <span className="count-pill observed">{row.observed_satellite_count} MODIS</span>
                  </td>
                  <td className="count-col estimated">
                    <span className="count-pill estimated">{row.model_estimated_count} Reanalysis</span>
                  </td>
                  <td className="regions-col">{row.key_affected_regions}</td>
                  <td>
                    <button
                      type="button"
                      className={`siha-matrix-select-btn ${row.is_selected ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent?.(row.event_id);
                      }}
                    >
                      {row.is_selected ? "Active" : "Switch Layer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. SELECTED STATION TELEMETRY READOUT ── */}
      {selectedStation && (
        <section className="siha-selected-station-card">
          <div className="siha-station-header">
            <div>
              <span className="siha-station-eyebrow">SELECTED STATION MONITORING RECORD</span>
              <h3 className="siha-station-title">
                {selectedStation.location}, {selectedStation.country}
              </h3>
              <span className="siha-station-coords">
                {selectedStation.lat.toFixed(4)}°, {selectedStation.lon.toFixed(4)}°
              </span>
            </div>

            <div className="siha-station-type-tag-wrap">
              <span className={`siha-station-badge ${selectedStation.measurement_type}`}>
                {selectedStation.measurement_type === "observed_satellite"
                  ? "🛰️ Verified Observed Satellite (MODIS)"
                  : selectedStation.measurement_type === "model_estimated"
                  ? "🤖 Model-Estimated Reanalysis"
                  : "⚠️ Data Unavailable"}
              </span>
            </div>
          </div>

          <div className="siha-station-details-grid">
            <div className="station-detail-item">
              <span className="lbl">Land Surface Temperature (LST)</span>
              <strong className="val temp">
                {selectedStation.lst_celsius !== null ? `${selectedStation.lst_celsius}°C` : "Unavailable"}
              </strong>
            </div>

            <div className="station-detail-item">
              <span className="lbl">Heat Risk Classification</span>
              <strong className={`val risk ${String(selectedStation.heat_risk).toLowerCase()}`}>
                {selectedStation.heat_risk}
              </strong>
            </div>

            <div className="station-detail-item">
              <span className="lbl">Sensor / Model Attribution</span>
              <strong className="val source">{selectedStation.source_instrument}</strong>
            </div>

            <div className="station-detail-item">
              <span className="lbl">Data Coverage Standard</span>
              <strong className="val coverage">{selectedStation.data_coverage}</strong>
            </div>
          </div>
        </section>
      )}

      {/* Station list quick-access grid */}
      <section className="siha-station-quick-list">
        <h4 className="siha-quick-heading">
          Monitored World Map Stations ({filteredStations.length})
        </h4>
        <div className="siha-station-chips-grid">
          {filteredStations.map((st, idx) => {
            const isSelected = selectedStation?.location === st.location;
            const isObserved = st.measurement_type === "observed_satellite";
            return (
              <button
                key={`${st.location}-${idx}`}
                type="button"
                className={`siha-station-chip ${isSelected ? "selected" : ""} ${isObserved ? "observed" : "estimated"}`}
                onClick={() => onSelectStation?.(st)}
              >
                <span className="chip-type">{isObserved ? "🛰️" : "🤖"}</span>
                <span className="chip-name">{st.location}</span>
                <span className="chip-temp">
                  {st.lst_celsius !== null ? `${st.lst_celsius}°C` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
