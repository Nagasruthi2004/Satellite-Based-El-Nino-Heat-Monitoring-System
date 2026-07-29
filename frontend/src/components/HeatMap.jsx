function HeatMap() {
  return (
    <div className="card">
      <h2>🗺️ Heat Map</h2>
      <div className="heat-map-placeholder">
        <span className="map-icon">🌡️</span>
        <span>Interactive Heat Map — Coming Soon</span>
      </div>
      <div className="heat-map-legend">
        <div className="legend-item"><span className="legend-dot low"></span>Low</div>
        <div className="legend-item"><span className="legend-dot moderate"></span>Moderate</div>
        <div className="legend-item"><span className="legend-dot high"></span>High</div>
        <div className="legend-item"><span className="legend-dot extreme"></span>Extreme</div>
      </div>
    </div>
  );
}

export default HeatMap;
