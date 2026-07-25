import React from 'react';

function HeatMap() {
  return (
    <div className="card">
      <h2>🌡️ Heat Map</h2>
      <div
        style={{
          marginTop: '12px',
          height: '180px',
          borderRadius: '8px',
          background: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#374151',
          fontSize: '1rem',
          fontWeight: '600',
          border: '1px dashed #9ca3af',
        }}
      >
        Heat Map Placeholder
      </div>
      <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <span>🟢 Low</span>
        <span>🟡 Moderate</span>
        <span>🟠 High</span>
        <span>🔴 Extreme</span>
      </div>
    </div>
  );
}

export default HeatMap;
