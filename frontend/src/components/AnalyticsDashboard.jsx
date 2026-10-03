import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const RISK_COLORS = {
  Low:      "var(--success)",
  Medium:   "var(--warning)",
  High:     "var(--danger)",
  Critical: "var(--risk-critical)",
};

function normalizeRisk(risk) {
  const normalized = String(risk ?? "").trim().toLowerCase();
  if (normalized === "critical" || normalized === "extreme") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return null;
}

function round1(n) { return Math.round(n * 10) / 10; }
function avg(arr)  { return arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }

export default function AnalyticsDashboard({ weather, currentHeatRisk }) {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadForecast = async () => {
      await Promise.resolve();
      if (!active) return;

      const city = weather?.city?.trim();
      setForecast([]);
      setError("");
      if (!city) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const r = await fetch(`http://127.0.0.1:5000/heatforecast?city=${encodeURIComponent(city)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        if (active) {
          setForecast(data.forecast || []);
        }
      } catch (e) {
        if (active && e.name !== "AbortError") setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadForecast();

    return () => {
      active = false;
      controller.abort();
    };
  }, [weather?.city]);

  if (!weather?.city) {
    return (
      <div className="card">
        <h2 className="section-title">📊 Analytics Dashboard</h2>
        <p className="status-hint">Search for a city to see analytics.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="card">
      <h2 className="section-title">📊 Analytics Dashboard</h2>
      <p className="status-hint">Loading analytics…</p>
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
  const currentRisk = normalizeRisk(currentHeatRisk?.level);
  if (currentRisk) riskCount[currentRisk] = 1;
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis domain={[tempMin, tempMax]} tick={{ fontSize: 11 }} unit="°C" />
              <Tooltip formatter={(v) => [`${v}°C`, "Temp"]} />
              <Line type="monotone" dataKey="temp" stroke="var(--chart-temperature)" strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--chart-temperature)" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Humidity Trend */}
        <div className="analytics-chart-box">
          <p className="analytics-chart-title">💧 Humidity Trend (7 Days)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, "Humidity"]} />
              <Bar dataKey="humidity" fill="var(--chart-humidity)" radius={[4, 4, 0, 0]} />
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
                  <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "var(--chart-label)"} />
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
