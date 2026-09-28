import { useState } from "react";
import { getHistoricalHeatTrend, getHistoricalSatelliteData, HISTORICAL_YEARS } from "../data/satelliteHistory";

export default function SatelliteTimeMachine({ city, currentHeatRisk }) {
  const [index, setIndex] = useState(8);
  const year = HISTORICAL_YEARS[index];
  const data = getHistoricalSatelliteData(city, year);
  const isLatestYear = year === HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1];
  const heatTrend = isLatestYear && currentHeatRisk?.level
    ? currentHeatRisk.level
    : data ? getHistoricalHeatTrend(data.temperature) : null;

  return (
    <div className="card">
      <h2>🛰 Satellite Time Machine</h2>

      <p>
        Move the slider to visualize how the city changes over time.
      </p>

      <input
        type="range"
        min="0"
        max={HISTORICAL_YEARS.length - 1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <h2>{year}</h2>

      {!data ? <p className="status-hint">Simulated historical data is not available for {city || "the selected location"}.</p> : <div className="satellite-time-machine-details">
        <p>🌡 Average Temperature : <b>{data.temperature}°C</b></p>

        <p>🌳 Green Cover : <b>{data.greenCover}%</b></p>

        <p>
          🏙 Urban Expansion :
          <b> {data.urbanExpansion}%</b>
        </p>

        <p>
          🔥 Heat Trend :
          <b className="satellite-heat-trend">
            {" "}
            {heatTrend}
          </b>
        </p>
      </div>}
    </div>
  );
}
