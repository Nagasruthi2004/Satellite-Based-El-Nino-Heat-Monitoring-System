import { useState } from "react";
import { getHistoricalSatelliteData } from "../data/satelliteHistory";

const FROM_YEARS = Array.from({ length: 8 }, (_, index) => 2018 + index);
const TO_YEARS = Array.from({ length: 8 }, (_, index) => 2019 + index);

// This is deliberately separate from the Live Weather Dashboard's current Heat
// Risk. It scores the accumulated land and temperature changes between the two
// selected years, without changing any of the underlying metric values.
function getEnvironmentalChange({ green, urban, temperature }) {
  const impacts = getDetections({ green, urban, temperature }).length;

  return impacts === 3 ? "High" : impacts === 2 ? "Medium" : "Low";
}

function getDetections({ green, urban, temperature }) {
  return [
    green.difference <= -20 && { type: "vegetation", message: `Vegetation Loss Detected (green cover decreased by ${Math.abs(green.difference).toFixed(0)}%)` },
    urban.difference >= 20 && { type: "urban", message: `Urban Expansion Detected (urban area increased by ${urban.difference.toFixed(0)}%)` },
    temperature.difference >= 3 && { type: "temperature", message: `Heat Island Increased (average temperature rose by ${temperature.difference.toFixed(1)}°C)` },
  ].filter(Boolean);
}

function getRecommendation(report, city) {
  const detectedTypes = getDetections(report).map(({ type }) => type).join(",");
  const place = city || "This area";
  const evidence = `Green cover ${report.green.difference < 0 ? "decreased" : "increased"} by ${Math.abs(report.green.difference).toFixed(0)}%, while urban area ${report.urban.difference < 0 ? "decreased" : "increased"} by ${Math.abs(report.urban.difference).toFixed(0)}% and average temperature ${report.temperature.difference < 0 ? "fell" : "rose"} by ${Math.abs(report.temperature.difference).toFixed(1)}°C.`;
  const recommendations = {
    vegetation: "Prioritize tree plantation and restoration of lost green spaces.",
    urban: "Increase shaded areas and reduce heat-absorbing concrete surfaces in newly developed zones.",
    temperature: "Strengthen heat monitoring and introduce cooling measures in areas showing the strongest warming.",
    "vegetation,urban": "Expand green spaces and tree cover in newly developed areas while reducing exposed concrete surfaces.",
    "urban,temperature": "Prioritize cooling measures in rapidly developed zones and reduce heat-absorbing surfaces.",
    "vegetation,temperature": "Restore vegetation and increase tree cover to reduce rising surface temperatures.",
    "vegetation,urban,temperature": "Prioritize tree plantation, protect remaining green spaces, increase shaded areas, and reduce concrete exposure in rapidly developing zones.",
  };

  return `${place}: ${evidence} ${recommendations[detectedTypes] || "No major environmental change was detected for this period; continue monitoring land-cover and temperature trends."}`;
}
const signed = (value, unit, decimals = 0) => `${value > 0 ? "+" : ""}${value.toFixed(decimals)}${unit}`;

function buildReport(city, fromYear, toYear) {
  const from = getHistoricalSatelliteData(city, fromYear);
  const to = getHistoricalSatelliteData(city, toYear);
  if (!from || !to) return null;

  return {
    city: city || "This area",
    fromYear,
    toYear,
    green: { from: from.greenCover, to: to.greenCover, difference: to.greenCover - from.greenCover },
    urban: { from: from.urbanExpansion, to: to.urbanExpansion, difference: to.urbanExpansion - from.urbanExpansion },
    temperature: { from: from.temperature, to: to.temperature, difference: to.temperature - from.temperature },
  };
}

function ChangeMetric({ title, unit, values }) {
  const decimals = unit === "°C" ? 1 : 0;
  return (
    <div className="change-metric">
      <h3>{title}</h3>
      <div className="change-values"><span>{values.from.toFixed(decimals)}{unit}</span><span>{values.to.toFixed(decimals)}{unit}</span></div>
      <div className="change-difference"><span>Difference</span><strong className={values.difference < 0 ? "negative" : "positive"}>{signed(values.difference, unit, decimals)}</strong></div>
    </div>
  );
}

export default function SatelliteChangeDetector({ city }) {
  const [fromYear, setFromYear] = useState(2018);
  const [toYear, setToYear] = useState(2026);
  const [report, setReport] = useState(null);
  const [profileError, setProfileError] = useState("");
  const invalidPeriod = fromYear >= toYear;
  const environmentalChange = report ? getEnvironmentalChange(report) : null;
  const detections = report ? getDetections(report) : [];
  const analyzeChanges = () => {
    if (invalidPeriod) return;
    const nextReport = buildReport(city, fromYear, toYear);
    if (!nextReport) {
      setReport(null);
      setProfileError(`Simulated historical data is not available for ${city || "the selected location"}.`);
      return;
    }
    setProfileError("");
    setReport(nextReport);
  };

  return (
    <div className="card satellite-change-detector">
      <div className="change-detector-heading"><div><p className="eyebrow">Simulated satellite intelligence</p><h2 className="section-title">Satellite Change Detector</h2></div>{city && <span className="change-city">{city}</span>}</div>
      <div className="change-controls">
        <label><span>From Year</span><select value={fromYear} onChange={(event) => setFromYear(Number(event.target.value))}>{FROM_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>To Year</span><select value={toYear} onChange={(event) => setToYear(Number(event.target.value))}>{TO_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <button className="search-btn change-analyze-button" type="button" onClick={analyzeChanges} disabled={invalidPeriod}>🔍 Analyze Satellite Changes</button>
      </div>
      {invalidPeriod && <p className="change-validation">Choose a To Year later than the From Year.</p>}
      {profileError && <p className="change-validation">{profileError}</p>}
      {!report ? <p className="status-hint">{city ? "Select two years and analyze the simulated land changes." : "Search for a city, then analyze its simulated satellite changes."}</p> : (
        <div className="change-report">
          <div className="change-report-title"><div><h3>🛰 Satellite Change Report</h3><p>Compared Years: {report.fromYear} — {report.toYear}</p><p>Environmental Change Impact over the selected period. Current Heat Risk is shown on the Live Weather Dashboard.</p></div><span className={`change-risk ${environmentalChange.toLowerCase()}`}>{environmentalChange} Environmental Change</span></div>
          <div className="change-metrics"><ChangeMetric title="Green Cover" unit="%" values={report.green} /><ChangeMetric title="Urban Area" unit="%" values={report.urban} /><ChangeMetric title="Average Temperature" unit="°C" values={report.temperature} /></div>
          <div className="change-summary"><h3>AI Detection Summary</h3>{detections.length ? detections.map((detection) => <p key={detection.type}>✔ {detection.message}</p>) : <p>No major environmental changes detected for the selected period.</p>}</div>
          <div className="change-recommendation"><h3>AI Recommendation</h3><p>{getRecommendation(report, report.city)}</p></div>
          <div className="satellite-timeline"><strong>{report.fromYear}</strong><span>──────────────▶</span><strong>{report.toYear}</strong></div>
        </div>
      )}
    </div>
  );
}
