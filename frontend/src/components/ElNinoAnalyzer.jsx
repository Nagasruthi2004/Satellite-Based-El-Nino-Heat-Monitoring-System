import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import oniData from "../data/oniData";

const YEARS = [1998, 2015, 2024, 2026];

function classification(oni) {
  if (oni >= 1.5) return "Very Strong";
  if (oni >= 1.0) return "Strong";
  if (oni >= 0.5) return "Moderate";
  return "Neutral";
}

function preparednessScore(risk) {
  if (String(risk).toLowerCase() === "high") return 55;
  if (String(risk).toLowerCase() === "medium") return 72;
  return 88;
}

export default function ElNinoAnalyzer({ weather, predictionResult, currentHeatRisk }) {
  const [selectedYear, setSelectedYear] = useState(2024);
  const data = useMemo(() => oniData[selectedYear] || [], [selectedYear]);
  const summary = useMemo(() => {
    const values = data.map(({ oni }) => oni);
    const maximum = Math.max(...values);
    const minimum = Math.min(...values);
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    return { maximum, minimum, average, highest: data.find(({ oni }) => oni === maximum), lowest: data.find(({ oni }) => oni === minimum) };
  }, [data]);
  const heatRisk = currentHeatRisk?.level || "Not available";
  const temperature = Number(weather?.temperature);
  const hasTemperature = Number.isFinite(temperature);
  const referencePeak = 2.2;
  const observations = [
    referencePeak > summary.maximum ? `1998 recorded a stronger El Niño peak (${referencePeak.toFixed(1)}) than ${selectedYear}.` : `${selectedYear} recorded an El Niño peak comparable to the 1998 reference event.`,
    hasTemperature ? `Current predicted temperature of ${temperature.toFixed(1)}°C is ${temperature >= 30 && summary.average >= 0.5 ? "consistent with elevated El Niño heat conditions" : "being monitored alongside local heat conditions"}.` : "Search for a city to compare current local temperature with this historical cycle.",
    summary.average >= 0.5 ? "Historical warming trends indicate increased thermal stress during this cycle." : "The selected cycle remained near neutral for much of the year, reducing ocean-driven heat pressure.",
  ];

  return <div className="card elnino-analyzer">
    <div className="elnino-analyzer-heading">
      <div><p className="eyebrow">Offline historical climate dataset</p><h2 className="section-title">🌊 Historical El Niño Cycle Analyzer</h2><p className="elnino-analyzer-subtitle">Explore historical El Niño cycles and compare them with current thermal conditions.</p></div>
      <label className="elnino-year-select"><span>Select Year</span><select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>{YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
    </div>
    <div className="elnino-chart-panel"><h3>Monthly Oceanic Niño Index</h3><div className="elnino-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--chart-label)" }} /><YAxis label={{ value: "Oceanic Niño Index", angle: -90, position: "insideLeft", fill: "var(--chart-label)", fontSize: 12 }} tick={{ fontSize: 12, fill: "var(--chart-label)" }} width={58} domain={[-1, 3]} /><Tooltip formatter={(value) => [Number(value).toFixed(1), "ONI"]} contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }} /><ReferenceLine y={0} stroke="var(--chart-label)" /><ReferenceLine y={0.5} stroke="var(--primary)" strokeDasharray="4 4" /><Line type="monotone" dataKey="oni" name="ONI" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div></div>
    <div className="elnino-metric-grid"><div><span>Selected Year</span><strong>{selectedYear}</strong></div><div><span>Maximum ONI</span><strong>{summary.maximum.toFixed(1)}</strong></div><div><span>Average ONI</span><strong>{summary.average.toFixed(1)}</strong></div><div><span>El Niño Strength</span><strong className="elnino-strength">{classification(summary.maximum)}</strong></div></div>
    <div className="elnino-detail-grid"><section className="elnino-detail-panel"><h3>Current Heat Comparison</h3><div className="elnino-comparison-row"><span>Current Heat Risk</span><strong>{heatRisk}</strong></div><div className="elnino-comparison-row"><span>Current Temperature</span><strong>{hasTemperature ? `${temperature.toFixed(1)}°C` : "Not available"}</strong></div><div className="elnino-comparison-row"><span>Preparedness Score</span><strong>{preparednessScore(heatRisk)}/100</strong></div></section><section className="elnino-detail-panel"><h3>Observations</h3><ul className="elnino-observations">{observations.map((item) => <li key={item}>{item}</li>)}</ul></section></div>
    <section className="elnino-summary"><h3>Cycle Summary</h3><div className="elnino-summary-grid"><div><span>Highest ONI Month</span><strong>{summary.highest.month} ({summary.maximum.toFixed(1)})</strong></div><div><span>Lowest ONI Month</span><strong>{summary.lowest.month} ({summary.minimum.toFixed(1)})</strong></div><div><span>Average Annual ONI</span><strong>{summary.average.toFixed(1)}</strong></div><div><span>Historical Classification</span><strong>{classification(summary.maximum)}</strong></div></div></section>
  </div>;
}
