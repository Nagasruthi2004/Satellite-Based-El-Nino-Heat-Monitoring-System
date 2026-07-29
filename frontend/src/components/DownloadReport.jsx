import { jsPDF } from 'jspdf';

function DownloadReport() {
  const handleDownload = () => {
    const doc = new jsPDF();
    const now = new Date();

    doc.setFontSize(16);
    doc.text('Satellite-Based El Niño Heat Monitoring System', 14, 20);
    doc.setFontSize(12);
    doc.text(`City Name: Chennai`, 14, 40);
    doc.text(`Temperature: 38°C`, 14, 50);
    doc.text(`Humidity: 60%`, 14, 60);
    doc.text(`Rainfall: 10 mm`, 14, 70);
    doc.text(`Wind Speed: 15 km/h`, 14, 80);
    doc.text(`Heat Risk Level: High`, 14, 90);
    doc.text(`El Niño Status: Strong El Niño`, 14, 100);
    doc.text(`Date and Time: ${now.toLocaleString()}`, 14, 110);

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
