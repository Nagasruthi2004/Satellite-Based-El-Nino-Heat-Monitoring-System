
import { jsPDF } from 'jspdf';

function DownloadReport({ weather }) {
  const handleDownload = () => {
    const doc = new jsPDF();
    const now = new Date();

    const city        = weather?.city              ?? 'N/A';
    const temperature = weather?.temperature       ?? 'N/A';
    const humidity    = weather?.humidity          ?? 'N/A';
    const rainfall    = weather?.rainfall          ?? 'N/A';
    const windSpeed   = weather?.wind_speed        ?? 'N/A';
    const heatRisk    = weather?.heat_risk         ?? 'N/A';
    const condition   = weather?.weather_description ?? 'N/A';

    doc.setFontSize(16);
    doc.text('Satellite-Based El Nino Heat Monitoring System', 14, 20);
    doc.setFontSize(12);
    doc.text(`City              : ${city}`,              14, 40);
    doc.text(`Temperature       : ${temperature} C`,     14, 50);
    doc.text(`Humidity          : ${humidity} %`,        14, 60);
    doc.text(`Rainfall          : ${rainfall} mm`,       14, 70);
    doc.text(`Wind Speed        : ${windSpeed} m/s`,     14, 80);
    doc.text(`Heat Risk Level   : ${heatRisk}`,          14, 90);
    doc.text(`Weather Condition : ${condition}`,         14, 100);
    doc.text(`Date and Time     : ${now.toLocaleString()}`, 14, 110);

    doc.save('weather-report.pdf');
  };

  return (
    <div className="card">
      <h2>📄 Download Report</h2>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Download the current weather and heat risk data as a PDF report.
      </p>
      <button className="download-btn" onClick={handleDownload}>
        ⬇️ Download Weather Report
      </button>
    </div>
  );
}

export default DownloadReport;
