import React from 'react';

const measures = [
  { icon: '💧', text: 'Drink plenty of water' },
  { icon: '🧢', text: 'Wear a cap or hat' },
  { icon: '🌳', text: 'Stay in shaded areas' },
  { icon: '🧴', text: 'Apply sunscreen' },
  { icon: '🚫', text: 'Avoid outdoor activities from 11 AM to 3 PM' },
  { icon: '🚑', text: 'Call emergency services if heat stroke symptoms occur' },
];

function PreventiveMeasures() {
  return (
    <div className="card">
      <h2>🛡️ Preventive Measures</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginTop: '12px',
        }}
      >
        {measures.map((item, index) => (
          <div
            key={index}
            style={{
              background: '#f8fafc',
              border: '1px solid #dbeafe',
              borderRadius: '8px',
              padding: '12px',
              minHeight: '80px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.95rem',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PreventiveMeasures;
