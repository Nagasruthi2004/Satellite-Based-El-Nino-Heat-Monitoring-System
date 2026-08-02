import { useState } from "react";

const FROM_YEARS = Array.from({ length: 8 }, (_, index) => 2018 + index);
const TO_YEARS = Array.from({ length: 8 }, (_, index) => 2019 + index);

const getRisk = (temperature) => (temperature >= 36 ? "High" : temperature >= 31 ? "Medium" : "Low");
const signed = (value, unit, decimals = 0) => `${value > 0 ? "+" : ""}${value.toFixed(decimals)}${unit}`;

function buildReport(fromYear, toYear) {
  const span = toYear - fromYear;
  const yearsSince2018 = fromYear - 2018;
  const greenFrom = 78 - yearsSince2018 * 3.625;
  const urbanFrom = 31 + yearsSince2018 * 3.875;
  const temperatureFrom = 31.4 + yearsSince2018 * 0.675;

  return {
    fromYear,
    toYear,
    green: { from: greenFrom, to: greenFrom - span * 3.625, difference: -span * 3.625 },
    urban: { from: urbanFrom, to: urbanFrom + span * 3.875, difference: span * 3.875 },
    temperature: { from: temperatureFrom, to: temperatureFrom + span * 0.675, difference: span * 0.675 },
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
  const invalidPeriod = fromYear >= toYear;
  const risk = report ? getRisk(report.temperature.to) : null;

  return (
    <div className="card satellite-change-detector">
      <div className="change-detector-heading"><div><p className="eyebrow">Simulated satellite intelligence</p><h2 className="section-title">Satellite Change Detector</h2></div>{city && <span className="change-city">{city}</span>}</div>
      <div className="change-controls">
        <label><span>From Year</span><select value={fromYear} onChange={(event) => setFromYear(Number(event.target.value))}>{FROM_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>To Year</span><select value={toYear} onChange={(event) => setToYear(Number(event.target.value))}>{TO_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <button className="search-btn change-analyze-button" type="button" onClick={() => !invalidPeriod && setReport(buildReport(fromYear, toYear))} disabled={invalidPeriod}>🔍 Analyze Satellite Changes</button>
      </div>
      {invalidPeriod && <p className="change-validation">Choose a To Year later than the From Year.</p>}
      {!report ? <p className="hospitals-hint">{city ? "Select two years and analyze the simulated land changes." : "Search for a city, then analyze its simulated satellite changes."}</p> : (
        <div className="change-report">
          <div className="change-report-title"><div><h3>🛰 Satellite Change Report</h3><p>Compared Years: {report.fromYear} — {report.toYear}</p></div><span className={`change-risk ${risk.toLowerCase()}`}>{risk} Risk</span></div>
          <div className="change-metrics"><ChangeMetric title="Green Cover" unit="%" values={report.green} /><ChangeMetric title="Urban Area" unit="%" values={report.urban} /><ChangeMetric title="Average Temperature" unit="°C" values={report.temperature} /></div>
          <div className="change-summary"><h3>AI Detection Summary</h3><p>✔ Vegetation Loss Detected</p><p>✔ Urban Expansion Detected</p><p>✔ Heat Island Increased</p></div>
          <div className="change-recommendation"><h3>AI Recommendation</h3><p>Increase vegetation in newly developed areas. Reduce concrete exposure. Protect remaining green spaces.</p></div>
          <div className="satellite-timeline"><strong>{report.fromYear}</strong><span>──────────────▶</span><strong>{report.toYear}</strong></div>
        </div>
      )}
    </div>
  );
}
