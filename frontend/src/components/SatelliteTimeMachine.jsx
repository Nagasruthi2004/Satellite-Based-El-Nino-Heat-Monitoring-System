import { useState } from "react";

const years = [
  { year: 2018, temp: 30.1, green: 82 },
  { year: 2019, temp: 30.6, green: 79 },
  { year: 2020, temp: 31.2, green: 75 },
  { year: 2021, temp: 32.0, green: 71 },
  { year: 2022, temp: 33.0, green: 67 },
  { year: 2023, temp: 34.1, green: 62 },
  { year: 2024, temp: 35.0, green: 58 },
  { year: 2025, temp: 36.2, green: 54 },
  { year: 2026, temp: 37.1, green: 50 },
];

export default function SatelliteTimeMachine() {
  const [index, setIndex] = useState(8);

  const data = years[index];

  return (
    <div className="card">
      <h2>🛰 Satellite Time Machine</h2>

      <p>
        Move the slider to visualize how the city changes over time.
      </p>

      <input
        type="range"
        min="0"
        max={years.length - 1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <h2>{data.year}</h2>

      <div className="satellite-time-machine-details">
        <p>🌡 Average Temperature : <b>{data.temp}°C</b></p>

        <p>🌳 Green Cover : <b>{data.green}%</b></p>

        <p>
          🏙 Urban Expansion :
          <b> {100 - data.green}%</b>
        </p>

        <p>
          🔥 Heat Trend :
          <b className="satellite-heat-trend">
            {" "}
            {data.temp > 34 ? "High" : data.temp > 32 ? "Medium" : "Low"}
          </b>
        </p>
      </div>
    </div>
  );
}
