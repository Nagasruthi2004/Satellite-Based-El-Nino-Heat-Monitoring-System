function HeatAlert() {
  return (
    <div className="weather-card heat-alert-card">
      <div className="card-icon">⚠️</div>
      <div className="card-content">
        <h3>Heat Alert</h3>
        <p className="card-value high-risk">HIGH</p>
        <p className="card-value-text">
          Extreme heat expected. Avoid outdoors 11 AM – 3 PM.
        </p>
      </div>
    </div>
  );
}

export default HeatAlert;
