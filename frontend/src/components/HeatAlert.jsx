import React from 'react';

function HeatAlert() {
  return (
    <div
      className="card"
      style={{
        background: '#fee2e2',
        border: '1px solid #f87171',
        color: '#991b1b',
      }}
    >
      <h2>⚠️ Heat Alert</h2>
      <p style={{ marginTop: '8px', fontWeight: '700' }}>Alert Level: HIGH</p>
      <p style={{ marginTop: '8px' }}>
        Extreme heat is expected in the next 24 hours. Avoid outdoor activities between 11 AM and 3 PM.
      </p>
    </div>
  );
}

export default HeatAlert;
