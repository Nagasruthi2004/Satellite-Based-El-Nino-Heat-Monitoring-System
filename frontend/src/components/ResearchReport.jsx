import { jsPDF } from "jspdf";

const BLUE = [21, 101, 192];
const TEXT = [31, 41, 55];
const MUTED = [107, 114, 128];

const riskRecommendations = {
  High: ["Avoid outdoor exposure.", "Drink sufficient water.", "Visit cooling centres.", "Wear light cotton clothing."],
  Medium: ["Limit outdoor work.", "Stay hydrated."],
  Low: ["Normal precautions are recommended."],
};

const number = (value, fallback = "N/A") => Number.isFinite(Number(value)) ? Number(value) : fallback;
const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

function preparednessDetails(heatRisk, hospitalsAvailable, simulatorValues) {
  const riskPenalty = { low: 5, medium: 15, high: 30 }[String(heatRisk || "low").toLowerCase()] || 0;
  const tree = Number(simulatorValues?.treeCover) || 0;
  const water = Number(simulatorValues?.waterBodies) || 0;
  const coverPoints = (value) => value > 60 ? 20 : value > 30 ? 10 : 0;
  const score = Math.max(0, Math.min(100, 100 - riskPenalty + (hospitalsAvailable ? 10 : -15) + coverPoints(tree) + coverPoints(water)));
  const category = score >= 80 ? "Well Prepared" : score >= 50 ? "Moderate Preparedness" : "Poor Preparedness";
  return { score, category };
}

function addHeader(doc, pageW, city, timestamp) {
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageW, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Satellite-Based El Niño Heat Monitoring System", pageW / 2, 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("IEEE Research Summary Report", pageW / 2, 19, { align: "center" });
  doc.setTextColor(219, 234, 254);
  doc.setFontSize(8.5);
  doc.text(`City: ${city}  |  ${timestamp}`, pageW / 2, 27, { align: "center" });
  doc.setTextColor(...TEXT);
}

function sectionTitle(doc, pageW, label, y) {
  doc.setFillColor(...BLUE);
  doc.rect(14, y, pageW - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(label, 18, y + 4.8);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "normal");
  return y + 12;
}

function borderedTable(doc, headers, rows, widths, y, pageW) {
  const x = 14;
  const rowHeight = 7;
  doc.setFillColor(226, 232, 240);
  doc.rect(x, y, pageW - 28, rowHeight, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(x, y, pageW - 28, rowHeight, "S");
  let cursor = x;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  headers.forEach((header, index) => { doc.text(header, cursor + 2, y + 4.8); cursor += widths[index]; });
  y += rowHeight;
  doc.setFont("helvetica", "normal");
  rows.forEach((row, rowIndex) => {
    if (rowIndex % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(x, y, pageW - 28, rowHeight, "F"); }
    doc.rect(x, y, pageW - 28, rowHeight, "S");
    cursor = x;
    row.forEach((cell, index) => { doc.text(String(cell), cursor + 2, y + 4.8); cursor += widths[index]; });
    y += rowHeight;
  });
  return y + 5;
}

export default function ResearchReport({ weather, predictionResult, forecast, hospitalsAvailable, simulatorValues }) {
  const generateReport = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const city = weather?.city || "Selected City";
    const temperature = number(weather?.temperature);
    const humidity = number(weather?.humidity);
    const rainfall = number(weather?.rainfall);
    const windSpeed = number(weather?.wind_speed);
    const heatRisk = predictionResult?.prediction?.heat_risk || weather?.heat_risk || "Low";
    const confidence = predictionResult?.prediction?.confidence ?? weather?.heat_risk_confidence ?? "N/A";
    const condition = weather?.weather_description || weather?.description || "N/A";
    const preparedness = preparednessDetails(heatRisk, hospitalsAvailable, simulatorValues);
    const safeForecast = Array.isArray(forecast) ? forecast : [];
    const temps = safeForecast.map((item) => Number(item.temperature)).filter(Number.isFinite);
    const humidities = safeForecast.map((item) => Number(item.humidity)).filter(Number.isFinite);
    const winds = safeForecast.map((item) => Number(item.wind_speed)).filter(Number.isFinite);
    const now = new Date();
    const timestamp = now.toLocaleString();
    let y = 42;

    addHeader(doc, pageW, city, timestamp);
    const ensureSpace = (needed) => { if (y + needed > pageH - 18) { doc.addPage(); addHeader(doc, pageW, city, timestamp); y = 42; } };
    const paragraph = (text) => { doc.setFontSize(9.5); const lines = doc.splitTextToSize(text, pageW - 28); doc.text(lines, 14, y); y += lines.length * 4.8 + 5; };

    y = sectionTitle(doc, pageW, "1. ABSTRACT", y);
    paragraph(`This report analyses the thermal conditions of ${city}. The observed temperature is ${temperature}°C with a predicted ${heatRisk} heat risk. Weather observations and AI-based prediction indicate possible thermal anomalies. The generated report summarizes the present environmental condition and provides recommendations for heat mitigation.`);

    ensureSpace(30); y = sectionTitle(doc, pageW, "2. OBJECTIVES", y);
    paragraph("To assess current city-scale heat conditions, summarise weather observations and AI-based heat-risk prediction, analyse short-term thermal trends, and recommend practical heat-mitigation measures.");

    ensureSpace(80); y = sectionTitle(doc, pageW, "3. CURRENT CLIMATE PARAMETERS", y);
    y = borderedTable(doc, ["Parameter", "Value"], [
      ["Temperature", `${temperature}°C`], ["Humidity", `${humidity}%`], ["Rainfall", `${rainfall} mm`], ["Wind Speed", `${windSpeed} km/h`],
      ["Weather Condition", condition], ["Heat Risk", heatRisk], ["Confidence", `${confidence}%`], ["Preparedness Score", `${preparedness.score}/100`],
    ], [90, pageW - 118], y, pageW);

    ensureSpace(45); y = sectionTitle(doc, pageW, "4. MATHEMATICAL ANALYSIS", y);
    ["Heat Index: HI = f(T,H)", "Land Surface Temperature: LST = Surface Temperature", "Thermal Anomaly: ΔT = Current Temperature − Historical Average", "Urban Heat Index: UHI = LST − Air Temperature"].forEach((equation) => { doc.setFontSize(9.5); doc.text(equation, 18, y); y += 6; });

    ensureSpace(45); y = sectionTitle(doc, pageW, "5. ANALYTICS SUMMARY", y);
    const analyticsRows = temps.length ? [["Highest Temperature", `${Math.max(...temps).toFixed(1)}°C`], ["Lowest Temperature", `${Math.min(...temps).toFixed(1)}°C`], ["Average Temperature", `${average(temps).toFixed(1)}°C`], ["Average Humidity", `${average(humidities).toFixed(1)}%`], ["Average Wind Speed", `${average(winds).toFixed(1)} km/h`]] : [["Analytics Status", "7-day forecast data is unavailable"]];
    y = borderedTable(doc, ["Metric", "Value"], analyticsRows, [90, pageW - 118], y, pageW);

    ensureSpace(75); y = sectionTitle(doc, pageW, "6. 7-DAY FORECAST", y);
    if (safeForecast.length) {
      y = borderedTable(doc, ["Day", "Date", "Temp", "Condition", "Heat Risk", "Confidence"], safeForecast.map((row) => [row.day, row.date, `${row.temperature}°C`, row.predicted ? "AI Prediction" : (row.condition || "N/A"), row.heat_risk, `${row.confidence}%`]), [18, 28, 18, 45, 28, 31], y, pageW);
    } else {
      paragraph("No 7-day forecast has been loaded for the selected city.");
    }

    ensureSpace(40); y = sectionTitle(doc, pageW, "7. PREPAREDNESS ANALYSIS", y);
    paragraph(`Preparedness Score: ${preparedness.score}/100 (${preparedness.category}). This score combines the current heat risk, nearby hospital availability, tree cover, and water-body coverage from the Future City Simulator.`);

    ensureSpace(50); y = sectionTitle(doc, pageW, "8. RECOMMENDATIONS", y);
    (riskRecommendations[heatRisk] || riskRecommendations.Low).forEach((recommendation) => { doc.setFontSize(9.5); doc.text(`• ${recommendation}`, 18, y); y += 6; });

    ensureSpace(40); y = sectionTitle(doc, pageW, "9. CONCLUSION", y);
    paragraph(`The current assessment for ${city} records ${temperature}°C and a ${heatRisk} heat-risk classification. Continued monitoring of weather observations, forecast trends, and urban cooling measures is recommended to reduce heat exposure and strengthen city preparedness.`);

    const pages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setFillColor(241, 245, 249); doc.rect(0, pageH - 13, pageW, 13, "F");
      doc.setTextColor(...MUTED); doc.setFontSize(7.5);
      doc.text("Generated by Satellite-Based El Niño Heat Monitoring System", 14, pageH - 8);
      doc.text("This report is generated automatically using weather observations and AI-based heat prediction.", 14, pageH - 4);
      doc.text(`Page ${page} of ${pages}`, pageW - 14, pageH - 6, { align: "right" });
    }
    doc.save(`ieee-research-report-${city.toLowerCase().replace(/\s+/g, "-")}-${now.toISOString().slice(0, 10)}.pdf`);
  };

  return <div className="card research-report"><h2 className="section-title">📄 IEEE Research Report Generator</h2><p>Generate a professional IEEE-style research report using the current prediction results.</p><button className="research-report-button" type="button" onClick={generateReport} disabled={!weather?.city}>Generate IEEE Report</button>{!weather?.city && <p className="research-report-hint">Search for a city first to generate the report.</p>}</div>;
}
