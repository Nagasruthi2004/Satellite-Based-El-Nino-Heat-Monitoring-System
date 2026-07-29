function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🌍</span>
        <div className="brand-divider" />
        <div className="brand-text">
          <span className="brand-title">El Niño Heat Monitoring</span>
          <span className="navbar-subtitle">Satellite-Based AI Early Warning</span>
        </div>
      </div>
      <div className="navbar-right">
        <span className="navbar-badge">
          <span className="live-dot" />
          Live
        </span>
      </div>
    </nav>
  );
}

export default Navbar;
