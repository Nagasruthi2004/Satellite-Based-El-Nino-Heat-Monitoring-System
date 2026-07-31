import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const RISK_COLORS = {
  Low:      "#16a34a",
  Medium:   "#d97706",
  High:     "#dc2626",
  Critical: "#7f1d1d",
};

function round1(n) { return Math.round(n * 10) / 10; }
function avg(arr)  { return arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }

export default function AnalyticsDashboard({ weather }) {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!weather?.city) return;
    setLoading(true);
    setError("");
    fetch(`http://127.0.0.1:5000/heatforecast?city=${encodeURIComponent(weather.city)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setForecast(data.forecast || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [weather?.city]);

  if (!weather?.city) {
    return (
      <div className="card">
        <h2 className="section-title">📊 Analytics Dashboard</h2>
        <p className="hospitals-hint">Search for a city to see analytics.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="card">
      <h2 className="section-title">📊 Analytics Dashboard</h2>
      <p className="hospitals-hint">Loading analytics…</p>
    </div>
  );

  if (error) return (
    <div className="card">
      <h2 className="section-title">📊 Analytics Dashboard</h2>
      <p className="prediction-error">{error}</p>
    </div>
  );

  const temps    = forecast.map((d) => d.temperature);
  const humids   = forecast.map((d) => d.humidity   ?? 0);
  const winds    = forecast.map((d) => d.wind_speed  ?? 0);
  const rains    = forecast.map((d) => d.rainfall    ?? 0);

  const stats = [
    { label: "Highest Temp",    value: `${Math.max(...temps)}°C`,  icon: "🌡️",  accent: "#ef4444" },
    { label: "Lowest Temp",     value: `${Math.min(...temps)}°C`,  icon: "❄️",  accent: "#0ea5e9" },
    { label: "Avg Temperature", value: `${avg(temps)}°C`,          icon: "📊",  accent: "#f97316" },
    { label: "Avg Humidity",    value: `${avg(humids)}%`,          icon: "💧",  accent: "#06b6d4" },
    { label: "Avg Wind Speed",  value: `${avg(winds)} km/h`,       icon: "💨",  accent: "#10b981" },
    { label: "Avg Rainfall",    value: `${avg(rains)} mm`,         icon: "🌧️", accent: "#3b82f6" },
  ];

  // Pie chart: count heat risk occurrences
  const riskCount = {};
  forecast.forEach((d) => { riskCount[d.heat_risk] = (riskCount[d.heat_risk] || 0) + 1; });
  const pieData = Object.entries(riskCount).map(([name, value]) => ({ name, value }));

  const chartData = forecast.map((d) => ({
    day:      d.day,
    temp:     d.temperature,
    humidity: d.humidity   ?? 0,
  }));

  const tempMin = Math.floor(Math.min(...temps)) - 2;
  const tempMax = Math.ceil(Math.max(...temps))  + 2;

  return (
    <div className="card">
      <h2 className="section-title">📊 Analytics Dashboard</h2>

      {/* ── STAT CARDS ── */}
      <div className="analytics-stats">
        {stats.map((s) => (
          <div className="analytics-stat-card" key={s.label} style={{ borderTopColor: s.accent }}>
            <span className="analytics-stat-icon">{s.icon}</span>
            <span className="analytics-stat-value">{s.value}</span>
            <span className="analytics-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── CHARTS ── */}
      <div className="analytics-charts">

        {/* Temperature Trend */}
        <div className="analytics-chart-box">
          <p className="analytics-chart-title">🌡️ Temperature Trend (7 Days)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis domain={[tempMin, tempMax]} tick={{ fontSize: 11 }} unit="°C" />
              <Tooltip formatter={(v) => [`${v}°C`, "Temp"]} />
              <Line type="monotone" dataKey="temp" stroke="#ef4444" strokeWidth={2.5}
                dot={{ r: 4, fill: "#ef4444" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Humidity Trend */}
        <div className="analytics-chart-box">
          <p className="analytics-chart-title">💧 Humidity Trend (7 Days)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, "Humidity"]} />
              <Bar dataKey="humidity" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Heat Risk Distribution */}
        <div className="analytics-chart-box">
          <p className="analytics-chart-title">⚠️ Heat Risk Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
