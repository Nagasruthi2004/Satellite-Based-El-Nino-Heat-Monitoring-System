function EmergencyDashboard() {
  return (
    <div className="card">
      <h2>🚑 Emergency Heat Safety</h2>

      <div className="emergency-grid">

        <div className="emergency-item">
          <span>🏥</span>
          <div>
            <h4>Hospital</h4>
            <p>Nearest Government Hospital</p>
          </div>
        </div>

        <div className="emergency-item">
          <span>🚑</span>
          <div>
            <h4>Ambulance</h4>
            <p>108</p>
          </div>
        </div>

        <div className="emergency-item">
          <span>👮</span>
          <div>
            <h4>Police</h4>
            <p>100</p>
          </div>
        </div>

        <div className="emergency-item">
          <span>🔥</span>
          <div>
            <h4>Fire & Rescue</h4>
            <p>101</p>
          </div>
        </div>

        <div className="emergency-item">
          <span>🌡️</span>
          <div>
            <h4>Heatwave Helpline</h4>
            <p>National Disaster Management</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default EmergencyDashboard;