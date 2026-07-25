import React from 'react';

function SatellitePanel() {
  return (
    <div className="card">
      <h2>🛰️ Latest Satellite Image</h2>
      <div
        style={{
          marginTop: '12px',
          height: '180px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '1.1rem',
          fontWeight: '600',
        }}
      >
        Placeholder Satellite Image
      </div>
      <p style={{ marginTop: '12px' }}>
        <strong>Date:</strong> 24 July 2026<br />
        <strong>Location:</strong> Tamil Nadu<br />
        <strong>Satellite:</strong> Landsat 8
      </p>
    </div>
  );
}

export default SatellitePanel;
