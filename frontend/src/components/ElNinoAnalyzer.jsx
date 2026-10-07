import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { classifyOniCondition, classifyOniStrength } from "../data/oniData";
import noaaOniDataset from "../../../dataset/noaa_cpc_oni_dataset.csv?raw";
import { formatTemperature } from "../utils/temperature";

const YEARS = Array.from({ length: 27 }, (_, index) => 2000 + index);
const ONI_ROWS = noaaOniDataset.trim().split(/\r?\n/).slice(1).map((row) => {
  const [season, yearValue, , oniValue] = row.split(",");
  const year = Number(yearValue);
  const oni = Number(oniValue);
  return { season, year, oni, phase: classifyOniCondition(oni) };
}).filter((row) => row.year >= 2000 && row.year <= 2026 && Number.isFinite(row.oni));

function preparednessScore(risk) {
  if (String(risk).toLowerCase() === "high") return 55;
  if (String(risk).toLowerCase() === "medium") return 72;
  return 88;
}

export default function ElNinoAnalyzer({ weather, currentHeatRisk }) {
  const [selectedYear, setSelectedYear] = useState(2026);
  const data = useMemo(() => ONI_ROWS.filter((row) => row.year === selectedYear), [selectedYear]);
  const summary = useMemo(() => {
    if (!data.length) return null;
    const values = data.map(({ oni }) => oni);
    const maximum = Math.max(...values);
    const minimum = Math.min(...values);
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    const strongest = data.reduce((strongestRow, row) => Math.abs(row.oni) > Math.abs(strongestRow.oni) ? row : strongestRow);
    return {
      maximum,
      minimum,
      average,
      highest: data.find(({ oni }) => oni === maximum),
      lowest: data.find(({ oni }) => oni === minimum),
      strongest,
      latest: data[data.length - 1],
    };
  }, [data]);
  const heatRisk = currentHeatRisk?.level || "Not available";
  const temperature = Number(weather?.temperature);
  const hasTemperature = Number.isFinite(temperature);

  return <div className="card elnino-analyzer">
    <div className="elnino-analyzer-heading">
      <div><p className="eyebrow">NOAA CPC historical seasonal ONI</p><h2 className="section-title">🌊 Historical El Niño Cycle Analyzer</h2><p className="elnino-analyzer-subtitle">Explore observed Oceanic Niño Index seasons from 2000 through 2026.</p></div>
      <label className="elnino-year-select"><span>Select Year</span><select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>{YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
    </div>
    <div className="elnino-chart-panel">
      <h3>Seasonal Oceanic Niño Index</h3>
      <p className="elnino-data-note">
        {summary
          ? `NOAA CPC data available through ${summary.latest.season} ${selectedYear}; phase: ${summary.latest.phase}.`
          : `NOAA CPC ONI data is unavailable for ${selectedYear}.`}
      </p>
      <div className="elnino-chart">
        {summary && <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" /><XAxis dataKey="season" tick={{ fontSize: 12, fill: "var(--chart-label)" }} /><YAxis label={{ value: "Oceanic Niño Index", angle: -90, position: "insideLeft", fill: "var(--chart-label)", fontSize: 12 }} tick={{ fontSize: 12, fill: "var(--chart-label)" }} width={58} domain={[-2.5, 3]} /><Tooltip formatter={(value) => [Number(value).toFixed(2), "ONI"]} labelFormatter={(season) => `${season} ${selectedYear}`} contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }} /><ReferenceLine y={0} stroke="var(--chart-label)" /><ReferenceLine y={0.5} stroke="var(--primary)" strokeDasharray="4 4" /><ReferenceLine y={-0.5} stroke="var(--primary)" strokeDasharray="4 4" /><Line type="monotone" dataKey="oni" name="ONI" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>}
      </div>
    </div>
    <div className="elnino-metric-grid"><div><span>Selected Year</span><strong>{selectedYear}</strong></div><div><span>Maximum ONI</span><strong>{summary ? summary.maximum.toFixed(2) : "—"}</strong></div><div><span>Average ONI</span><strong>{summary ? summary.average.toFixed(2) : "—"}</strong></div><div><span>Strongest Phase Strength</span><strong className="elnino-strength">{summary ? classifyOniStrength(summary.strongest.oni) : "Unavailable"}</strong></div></div>
    <div className="elnino-detail-grid"><section className="elnino-detail-panel"><h3>Current Heat Comparison</h3><div className="elnino-comparison-row"><span>Current Heat Risk</span><strong>{heatRisk}</strong></div><div className="elnino-comparison-row"><span>Current Temperature</span><strong>{hasTemperature ? formatTemperature(temperature) : "Not available"}</strong></div><div className="elnino-comparison-row"><span>Preparedness Score</span><strong>{preparednessScore(heatRisk)}/100</strong></div></section></div>
    <section className="elnino-summary"><h3>Cycle Summary</h3><div className="elnino-summary-grid"><div><span>Highest ONI Season</span><strong>{summary ? `${summary.highest.season} (${summary.maximum.toFixed(2)})` : "Unavailable"}</strong></div><div><span>Lowest ONI Season</span><strong>{summary ? `${summary.lowest.season} (${summary.minimum.toFixed(2)})` : "Unavailable"}</strong></div><div><span>Mean Seasonal ONI</span><strong>{summary ? summary.average.toFixed(2) : "Unavailable"}</strong></div><div><span>Latest NOAA Phase</span><strong>{summary ? `${summary.latest.phase} (${summary.latest.season})` : "Unavailable"}</strong></div></div></section>
  </div>;
}
