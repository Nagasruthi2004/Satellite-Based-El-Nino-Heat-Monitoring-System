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
  const [index, setIndex] = useState(HISTORICAL_YEARS.length - 2);
  const [satelliteData, setSatelliteData] = useState(() =>
    getHistoricalSatelliteData(city, HISTORICAL_YEARS[HISTORICAL_YEARS.length - 2], { latitude, longitude })
  );

  const year = HISTORICAL_YEARS[index];
  const displayLocation = city || (latitude != null && longitude != null ? `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°` : "");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadData() {
      if (!displayLocation) {
        setSatelliteData(null);
        return;
      }

      try {
        const result = await fetchHistoricalSatellite({
          city,
          year,
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
          const fallback = getHistoricalSatelliteData(city, year, { latitude, longitude });
          setSatelliteData(fallback);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [city, year, latitude, longitude, displayLocation]);

  const isLatestYear = year === HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1];
  const heatTrend = isLatestYear && currentHeatRisk?.level
    ? currentHeatRisk.level
    : satelliteData?.heat_risk || satelliteData?.heatRisk || satelliteData?.heatTrend
    || (satelliteData?.temperature != null ? getHistoricalHeatTrend(satelliteData.temperature) : null);

  const lstValue = satelliteData?.land_surface_temperature != null
    ? satelliteData.land_surface_temperature
    : satelliteData?.temperature;

  return (
    <div className="card">
      <h2>🛰 Satellite Time Machine</h2>

      <p>
        Move the slider to visualize how the city changes over time.
      </p>

      {displayLocation && (
        <p style={{ margin: "4px 0 12px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          📍 Selected Location: <b style={{ color: "var(--text)" }}>{satelliteData?.location || displayLocation}</b>
        </p>
      )}

      <input
        type="range"
        min="0"
        max={HISTORICAL_YEARS.length - 1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="Satellite Time Machine Year Slider"
      />

      <h2>{year}</h2>

      {!satelliteData ? (
        <p className="status-hint">Historical satellite data is not available for this location.</p>
      ) : (
        <div className="satellite-time-machine-details">
          <p>📍 Location : <b>{satelliteData.location || displayLocation}</b></p>

          <p>📅 Observation : <b>{satelliteData.date || satelliteData.year || year}</b></p>

          <p>🌡 Average Temperature : <b>{lstValue != null ? `${lstValue}°C` : "N/A"}</b></p>

          {satelliteData.greenCover != null && (
            <p>🌳 Green Cover : <b>{satelliteData.greenCover}%</b></p>
          )}

          {satelliteData.urbanExpansion != null && (
            <p>
              🏙 Urban Expansion :
              <b> {satelliteData.urbanExpansion}%</b>
            </p>
          )}

          {heatTrend && (
            <p>
              🔥 Heat Trend :
              <b className="satellite-heat-trend">
                {" "}
                {heatTrend}
              </b>
            </p>
          )}

          {satelliteData.satellite_source && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
              🛰 Source : <span>{satelliteData.satellite_source}</span>
            </p>
          )}

          {(satelliteData.satellite_image_url || satelliteData.thermal_image_url) && (
            <div
              className="satellite-time-machine-visual"
              style={{
                marginTop: "16px",
                paddingTop: "14px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "var(--text-muted)" }}>
                🛰️ Satellite Remote Sensing & Thermal Visualization ({year})
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px",
                }}
              >
                {satelliteData.satellite_image_url && (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={satelliteData.satellite_image_url}
                      alt={`NASA MODIS satellite observation of ${satelliteData.location || displayLocation} in ${year}`}
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                      NASA MODIS Terra / High-Res Satellite Basemap
                    </div>
                  </div>
                )}
                {satelliteData.thermal_image_url && (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={satelliteData.thermal_image_url}
                      alt={`Thermal LST radiometry heat map of ${satelliteData.location || displayLocation} in ${year}`}
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
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
