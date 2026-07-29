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
      <div className="preventive-grid">
        {measures.map((item, index) => (
          <div key={index} className="preventive-item">
            <span className="p-icon">{item.icon}</span>
            <span className="p-text">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PreventiveMeasures;
