function SatellitePanel() {
  return (
    <div className="card">
      <h2>🛰️ Latest Satellite Image</h2>
      <div className="satellite-image-placeholder">
        <span className="sat-icon">🛰️</span>
        <span>Satellite Image Feed — Coming Soon</span>
      </div>
      <div className="satellite-meta">
        <div className="satellite-meta-item">
          <div className="meta-label">Date</div>
          <div className="meta-value">24 July 2026</div>
        </div>
        <div className="satellite-meta-item">
          <div className="meta-label">Location</div>
          <div className="meta-value">Tamil Nadu</div>
        </div>
        <div className="satellite-meta-item">
          <div className="meta-label">Satellite</div>
          <div className="meta-value">Landsat 8</div>
        </div>
      </div>
    </div>
  );
}

export default SatellitePanel;
