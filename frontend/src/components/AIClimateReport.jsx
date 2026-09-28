import { useState } from "react";
import { jsPDF } from "jspdf";
import { formatWindSpeedKmh } from "../utils/wind";

const BLUE = [21, 101, 192];
const TEXT = [31, 41, 55];
const MUTED = [100, 116, 139];

const recommendationsByRisk = {
  Critical: ["Stay in cool indoor spaces during the hottest hours.", "Check on children, older adults, and people with health conditions.", "Seek medical help if heat illness symptoms appear."],
  High: ["Limit strenuous outdoor activity during the afternoon.", "Drink water regularly and wear light, breathable clothing.", "Use shade, fans, or air conditioning to stay cool."],
  Medium: ["Plan outdoor activity for cooler parts of the day.", "Carry water and take regular cooling breaks."],
  Low: ["Continue normal heat-safety habits.", "Stay hydrated when spending time outdoors."],
};

const value = (item, fallback = "Not available") => item === undefined || item === null || item === "" ? fallback : item;

function addHeader(doc, pageWidth, city) {
  doc.setFillColor(...BLUE);
  doc.roundedRect(12, 10, pageWidth - 24, 24, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("AI Climate Report", 18, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Satellite-Based El Niño Heat Monitoring System • ${city}`, 18, 28);
  doc.setTextColor(...TEXT);
}

function addSection(doc, title, text, y, pageWidth, pageHeight, city) {
  const ensureSpace = (height) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    addHeader(doc, pageWidth, city);
    y = 43;
  };
  const lines = doc.splitTextToSize(text, pageWidth - 38);
  ensureSpace(lines.length * 5 + 18);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, y, pageWidth - 28, 8, 2, 2, "F");
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(title, 18, y + 5.5);
  y += 14;
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(lines, 18, y);
  return y + lines.length * 5 + 7;
}

export default function AIClimateReport({ weather, currentHeatRisk, elNinoData, satellite, predictionResult, simulatorValues }) {
  const [readyToDownload, setReadyToDownload] = useState(false);
  const city = weather?.city || "";

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const reportDate = new Date();
    const heatRisk = currentHeatRisk?.level || "Not available";
    const confidence = predictionResult?.prediction?.confidence ?? weather?.heat_risk_confidence;
    const treeCover = Number(simulatorValues?.treeCover) || 0;
    const waterBodies = Number(simulatorValues?.waterBodies) || 0;
    let y = 43;

    addHeader(doc, pageWidth, city);
    y = addSection(doc, "Report Title", "AI Climate Report", y, pageWidth, pageHeight, city);
    y = addSection(doc, "Report Date", reportDate.toLocaleString(), y, pageWidth, pageHeight, city);
    y = addSection(doc, "Selected Location", city, y, pageWidth, pageHeight, city);
    y = addSection(doc, "Current Weather Summary", `Temperature: ${value(weather?.temperature)}°C • Humidity: ${value(weather?.humidity)}% • Rainfall: ${value(weather?.rainfall)} mm • Wind speed: ${formatWindSpeedKmh(weather?.wind_speed)} km/h. Current conditions: ${value(weather?.weather_description || weather?.description)}.`, y, pageWidth, pageHeight, city);
    y = addSection(doc, "Heat Risk Analysis", `The current heat risk is ${heatRisk}${confidence !== undefined && confidence !== null ? `, with ${confidence}% confidence` : ""}. ${value(predictionResult?.prediction?.explanation || weather?.heat_risk_explanation, "Continue monitoring local conditions and follow heat-safety guidance.")}`, y, pageWidth, pageHeight, city);
    y = addSection(doc, "Satellite Observation Summary", `Land surface temperature: ${value(satellite?.land_surface_temperature)}. Heat intensity: ${value(satellite?.heat_intensity_level)}. Thermal anomaly: ${value(satellite?.thermal_anomaly)}. Data source: ${value(satellite?.satellite_source)}. ${value(satellite?.recommendation, "Satellite observations help identify areas that may need closer heat monitoring.")}`, y, pageWidth, pageHeight, city);
    y = addSection(doc, "El Niño Analysis", `Status: ${value(elNinoData?.status)}. ONI Index: ${Number.isFinite(elNinoData?.oni) ? `${elNinoData.oni >= 0 ? "+" : ""}${elNinoData.oni.toFixed(1)}` : "Not available"}. Strength: ${value(elNinoData?.strength)}. Heat Influence: ${value(elNinoData?.influence)}. Impact Score: ${Number.isFinite(elNinoData?.impactScore) ? `${elNinoData.impactScore}/100` : "Not available"}. This climate signal is included alongside local weather and satellite observations to support heat-risk awareness for ${city}.`, y, pageWidth, pageHeight, city);
    y = addSection(doc, "Climate Insights", `Future City Simulator inputs show ${treeCover}% tree cover and ${waterBodies}% water-body coverage. These local cooling factors can help reduce heat exposure.`, y, pageWidth, pageHeight, city);
    y = addSection(doc, "Safety Recommendations", (recommendationsByRisk[heatRisk] || recommendationsByRisk.Low).map((item) => `• ${item}`).join("\n"), y, pageWidth, pageHeight, city);
    addSection(doc, "Conclusion", `This AI Climate Report combines current weather, heat-risk information, satellite observations, and climate signals for ${city}. Review it regularly as conditions change and use the safety recommendations to reduce heat exposure.`, y, pageWidth, pageHeight, city);

    const pages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);
      doc.setTextColor(...MUTED);
      doc.setFontSize(7.5);
      doc.text("Satellite-Based El Niño Heat Monitoring System", 14, pageHeight - 8);
      doc.text(`Page ${page} of ${pages}`, pageWidth - 14, pageHeight - 8, { align: "right" });
    }
    doc.save(`ai-climate-report-${city.toLowerCase().replace(/\s+/g, "-")}-${reportDate.toISOString().slice(0, 10)}.pdf`);
  };

  return <div className="card ai-climate-report">
    <h2 className="section-title">📄 AI Climate Report</h2>
    <p>Create a clear climate summary from the selected location’s current weather, heat risk, satellite observations, and climate signals.</p>
    <div className="ai-climate-report-actions">
      <button className="ai-climate-report-button" type="button" onClick={() => setReadyToDownload(true)} disabled={!city}>Generate AI Climate Report</button>
      <button className="ai-climate-report-button secondary" type="button" onClick={downloadPdf} disabled={!readyToDownload || !city}>Download PDF</button>
    </div>
    {!city && <p className="ai-climate-report-hint">Search for a city first to create an AI Climate Report.</p>}
    {readyToDownload && city && <p className="ai-climate-report-status">Your AI Climate Report is ready to download.</p>}
  </div>;
}
