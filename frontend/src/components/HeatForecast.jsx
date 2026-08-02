import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const CONDITION_EMOJI = {
  Clear:          "☀️",
  Clouds:         "☁️",
  Rain:           "🌧",
  Drizzle:        "🌦",
  Thunderstorm:   "⛈",
  Snow:           "❄️",
  Mist:           "🌫",
  Fog:            "🌫",
  Haze:           "🌫",
  "Partly Cloudy": "⛅",
  Cloudy:         "☁️",
};

const RISK_STYLE = {
  High:     { bg: "var(--danger-surface)", color: "var(--danger)" },
  Medium:   { bg: "var(--warning-surface)", color: "var(--warning)" },
  Low:      { bg: "var(--success-surface)", color: "var(--success)" },
  Critical: { bg: "var(--danger-surface)", color: "var(--risk-critical)" },
};

export default function HeatForecast({ weather, onForecastChange }) {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!weather?.city) {
      onForecastChange?.([]);
      return;
    }
    setLoading(true);
    setError("");
    fetch(`http://127.0.0.1:5000/heatforecast?city=${encodeURIComponent(weather.city)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const nextForecast = data.forecast || [];
        setForecast(nextForecast);
        onForecastChange?.(nextForecast);
      })
      .catch((e) => {
        setError(e.message);
        onForecastChange?.([]);
      })
      .finally(() => setLoading(false));
  }, [weather?.city]);

  const temps = forecast.map((d) => ({ day: d.day, temp: d.temperature }));
  const allTemps = forecast.map((d) => d.temperature);
  const yMin = allTemps.length ? Math.floor(Math.min(...allTemps)) - 2 : "auto";
  const yMax = allTemps.length ? Math.ceil(Math.max(...allTemps))  + 2 : "auto";

  return (
    <div className="card">
      <h2 className="section-title">🤖 AI 7-Day Heat Forecast</h2>

      {loading && <p className="hospitals-hint">Loading forecast…</p>}
      {error   && <p className="prediction-error">{error}</p>}

      {!loading && !error && forecast.length > 0 && (
        <>
          <div className="heatforecast-table-wrapper">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Date</th>
                  <th>Temp (°C)</th>
                  <th>Condition</th>
                  <th>Heat Risk</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((row) => {
                  const style = RISK_STYLE[row.heat_risk] || RISK_STYLE.Low;
                  return (
                    <tr key={row.day}>
                      <td className="compare-metric">{row.day}</td>
                      <td>{row.date}</td>
                      <td><strong>{row.temperature}°C</strong></td>
                      <td>
                        {row.predicted
                          ? "🤖 AI Prediction"
                          : `${CONDITION_EMOJI[row.condition] ?? "🌡️"} ${row.condition}`}
                      </td>
                      <td>
                        <span
                          className="risk-badge"
                          style={{ background: style.bg, color: style.color }}
                        >
                          {row.heat_risk}
                        </span>
                      </td>
                      <td>{row.confidence}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="news-notice" style={{ marginTop: "16px" }}>
            📡 Days 1–5 use live OpenWeather forecast. Days 6–7 are generated using the machine learning prediction model.
          </p>

          <div className="graph-container" style={{ marginTop: "24px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={temps} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 12 }} unit="°C" />
                <Tooltip formatter={(v) => [`${v}°C`, "Temp"]} />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="var(--chart-temperature)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--chart-temperature)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="graph-legend">
            <span className="graph-legend-dot" />
            Predicted temperature trend (7 days)
          </div>
        </>
      )}

      {!loading && !error && forecast.length === 0 && weather?.city && (
        <p className="hospitals-hint">No forecast data available.</p>
      )}
      {!weather?.city && (
        <p className="hospitals-hint">Search for a city to see the AI heat forecast.</p>
      )}
    </div>
  );
}
