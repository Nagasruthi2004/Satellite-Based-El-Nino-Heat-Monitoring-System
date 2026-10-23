import { useState, useEffect } from "react";
import {
  HISTORICAL_YEARS,
  fetchHistoricalSatellite,
  getHistoricalSatelliteData,
  getHistoricalHeatTrend,
} from "../data/satelliteHistory";

export default function SatelliteTimeMachine({
  city,
  latitude,
  longitude,
  currentHeatRisk,
}) {
  const initialYearIndex = HISTORICAL_YEARS.length - 2; // Default to 2024
  const [index, setIndex] = useState(initialYearIndex);
  const [selectedDate, setSelectedDate] = useState(() => `${HISTORICAL_YEARS[initialYearIndex]}-05-15`);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState("all"); // "all" (dual), "satellite", "thermal"
  const [loading, setLoading] = useState(false);
  const [satelliteData, setSatelliteData] = useState(() =>
    getHistoricalSatelliteData(city, HISTORICAL_YEARS[initialYearIndex], {
      latitude,
      longitude,
      date: `${HISTORICAL_YEARS[initialYearIndex]}-05-15`,
    })
  );

  const year = HISTORICAL_YEARS[index];
  const displayLocation =
    city ||
    (latitude != null && longitude != null
      ? `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
      : "Selected Location");

  // Keep date in sync when slider changes year
  const handleYearIndexChange = (newIdx) => {
    const clampedIdx = Math.max(0, Math.min(HISTORICAL_YEARS.length - 1, newIdx));
    setIndex(clampedIdx);
    const newYear = HISTORICAL_YEARS[clampedIdx];
    const monthDay = selectedDate && selectedDate.includes("-") ? selectedDate.slice(5) : "05-15";
    setSelectedDate(`${newYear}-${monthDay}`);
  };

  // Keep slider in sync when date picker changes
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    if (newDate && newDate.length >= 4) {
      const parsedYear = parseInt(newDate.slice(0, 4), 10);
      const foundIdx = HISTORICAL_YEARS.indexOf(parsedYear);
      if (foundIdx !== -1) {
        setIndex(foundIdx);
      }
    }
  };

  // Previous and Next year controls
  const handlePrevYear = () => {
    if (index > 0) {
      handleYearIndexChange(index - 1);
    }
  };

  const handleNextYear = () => {
    if (index < HISTORICAL_YEARS.length - 1) {
      handleYearIndexChange(index + 1);
    }
  };

  // Play / Pause auto timeline time-lapse
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev >= HISTORICAL_YEARS.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        const nextYear = HISTORICAL_YEARS[next];
        const monthDay = selectedDate && selectedDate.includes("-") ? selectedDate.slice(5) : "05-15";
        setSelectedDate(`${nextYear}-${monthDay}`);
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying, selectedDate]);

  // Fetch satellite telemetry and imagery
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);

      try {
        const result = await fetchHistoricalSatellite({
          city,
          year,
          date: selectedDate,
          latitude,
          longitude,
          signal: controller.signal,
        });

        if (isMounted) {
          setSatelliteData(result);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (isMounted) {
          const fallback = getHistoricalSatelliteData(city, year, {
            latitude,
            longitude,
            date: selectedDate,
          });
          setSatelliteData(fallback);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [city, year, selectedDate, latitude, longitude]);

  const isLatestYear = year === HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1];
  const heatTrend =
    isLatestYear && currentHeatRisk?.level
      ? currentHeatRisk.level
      : satelliteData?.heat_risk ||
        satelliteData?.heatRisk ||
        satelliteData?.heatTrend ||
        (satelliteData?.temperature != null
          ? getHistoricalHeatTrend(satelliteData.temperature)
          : null);

  const lstValue =
    satelliteData?.land_surface_temperature != null
      ? satelliteData.land_surface_temperature
      : satelliteData?.temperature;

  const hasAnyImages = Boolean(
    satelliteData?.satellite_image_url ||
    satelliteData?.thermal_image_url ||
    satelliteData?.thermal_overlay_url
  );

  return (
    <div className="card">
      <h2>🛰 Satellite Time Machine</h2>

      <p>
        Move the slider to visualize how the city changes over time.
      </p>

      {displayLocation && (
        <p style={{ margin: "4px 0 12px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          📍 Selected Location: <b style={{ color: "var(--text)" }}>{satelliteData?.location || displayLocation}</b>
          {satelliteData?.latitude != null && satelliteData?.longitude != null && (
            <span style={{ marginLeft: "8px", fontSize: "12px" }}>
              ({satelliteData.latitude.toFixed(2)}°, {satelliteData.longitude.toFixed(2)}°)
            </span>
          )}
        </p>
      )}

      {/* ── TIMELINE CONTROLS TOOLBAR ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "12px 0 8px 0",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handlePrevYear}
            disabled={index === 0 || loading}
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: index === 0 || loading ? "not-allowed" : "pointer",
              opacity: index === 0 ? 0.5 : 1,
            }}
            aria-label="Previous Year"
          >
            ◀ Previous Year
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: isPlaying ? "var(--primary)" : "var(--surface-alt)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: isPlaying ? "#fff" : "var(--text)",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
            title={isPlaying ? "Pause timeline time-lapse" : "Auto-play multi-year time-lapse"}
          >
            {isPlaying ? "⏸ Pause Time-Lapse" : "▶ Play Time-Lapse"}
          </button>
          <button
            type="button"
            onClick={handleNextYear}
            disabled={index === HISTORICAL_YEARS.length - 1 || loading}
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: index === HISTORICAL_YEARS.length - 1 || loading ? "not-allowed" : "pointer",
              opacity: index === HISTORICAL_YEARS.length - 1 ? 0.5 : 1,
            }}
            aria-label="Next Year"
          >
            Next Year ▶
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="stm-date-picker" style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>
            📅 Observation Date:
          </label>
          <input
            id="stm-date-picker"
            type="date"
            value={selectedDate}
            min="2018-01-01"
            max="2026-12-31"
            onChange={handleDateChange}
            disabled={loading}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "13px",
            }}
          />
        </div>
      </div>

      <input
        type="range"
        min="0"
        max={HISTORICAL_YEARS.length - 1}
        value={index}
        onChange={(e) => handleYearIndexChange(Number(e.target.value))}
        style={{ width: "100%", margin: "8px 0" }}
        aria-label="Satellite Time Machine Year Slider"
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: "6px 0" }}>{year}</h2>
        {loading && (
          <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: "600" }}>
            🔄 Loading satellite telemetry...
          </span>
        )}
      </div>

      {!satelliteData ? (
        <p className="status-hint">Historical satellite data is not available for this location.</p>
      ) : (
        <div className="satellite-time-machine-details" style={{ marginTop: "10px", lineHeight: "1.8" }}>
          <p style={{ margin: "4px 0" }}>
            📍 Location : <b>{satelliteData.location || displayLocation}</b>
          </p>

          <p style={{ margin: "4px 0" }}>
            📅 Observation : <b>{satelliteData.date || selectedDate || satelliteData.year || year}</b>
          </p>

          <p style={{ margin: "4px 0" }}>
            🌡 Average Temperature : <b>{lstValue != null ? `${lstValue}°C` : "N/A"}</b>
          </p>

          {satelliteData.greenCover != null && (
            <p style={{ margin: "4px 0" }}>
              🌳 Green Cover : <b>{satelliteData.greenCover}%</b>
            </p>
          )}

          {satelliteData.urbanExpansion != null && (
            <p style={{ margin: "4px 0" }}>
              🏙 Urban Expansion : <b> {satelliteData.urbanExpansion}%</b>
            </p>
          )}

          {heatTrend && (
            <p style={{ margin: "4px 0" }}>
              🔥 Heat Trend :{" "}
              <b
                className="satellite-heat-trend"
                style={{
                  color:
                    heatTrend === "High" || heatTrend === "Critical"
                      ? "var(--danger)"
                      : heatTrend === "Moderate"
                      ? "var(--warning)"
                      : "var(--success)",
                }}
              >
                {heatTrend}
              </b>
            </p>
          )}

          {satelliteData.satellite_source && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
              🛰 Source : <span>{satelliteData.satellite_source}</span>
              {satelliteData.is_simulated && (
                <span style={{ marginLeft: "6px", fontStyle: "italic" }}>
                  (Calibrated Climate Baseline Dataset)
                </span>
              )}
            </p>
          )}

          {hasAnyImages && (
            <div
              className="satellite-time-machine-visual"
              style={{
                marginTop: "16px",
                paddingTop: "14px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <h4 style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                  🛰️ Satellite Remote Sensing & Thermal Visualization ({year})
                </h4>

                {/* Satellite visualization modes */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setViewMode("all")}
                    style={{
                      background: viewMode === "all" ? "var(--primary)" : "var(--surface-alt)",
                      color: viewMode === "all" ? "#fff" : "var(--text)",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Dual View
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("satellite")}
                    style={{
                      background: viewMode === "satellite" ? "var(--primary)" : "var(--surface-alt)",
                      color: viewMode === "satellite" ? "#fff" : "var(--text)",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Natural Satellite
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("thermal")}
                    style={{
                      background: viewMode === "thermal" ? "var(--primary)" : "var(--surface-alt)",
                      color: viewMode === "thermal" ? "#fff" : "var(--text)",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Thermal Heat Map
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: viewMode === "all" ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
                  gap: "14px",
                }}
              >
                {(viewMode === "all" || viewMode === "satellite") &&
                  (satelliteData.satellite_image_url || satelliteData.thermal_overlay_url) && (
                    <div style={{ textAlign: "center" }}>
                      <img
                        key={`sat-${year}-${satelliteData.date || selectedDate}`}
                        src={satelliteData.satellite_image_url || satelliteData.thermal_overlay_url}
                        alt={`NASA MODIS satellite observation of ${satelliteData.location || displayLocation} in ${year}`}
                        style={{
                          width: "100%",
                          height: viewMode === "all" ? "200px" : "320px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          opacity: loading ? 0.75 : 1,
                          transition: "opacity 0.2s ease-in-out",
                        }}
                      />
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        NASA MODIS Terra / High-Res Satellite Basemap
                      </div>
                    </div>
                  )}

                {(viewMode === "all" || viewMode === "thermal") &&
                  (satelliteData.thermal_image_url || satelliteData.thermal_overlay_url) && (
                    <div style={{ textAlign: "center" }}>
                      <img
                        key={`thm-${year}-${satelliteData.date || selectedDate}`}
                        src={satelliteData.thermal_image_url || satelliteData.thermal_overlay_url}
                        alt={`Thermal LST radiometry heat map of ${satelliteData.location || displayLocation} in ${year}`}
                        style={{
                          width: "100%",
                          height: viewMode === "all" ? "200px" : "320px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          opacity: loading ? 0.75 : 1,
                          transition: "opacity 0.2s ease-in-out",
                        }}
                      />
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Satellite Thermal LST Radiometry Heat Map
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
