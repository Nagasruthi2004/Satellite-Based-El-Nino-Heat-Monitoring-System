function Navbar({ theme, liveLocation, onToggleTheme }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🌍</span>
        <div className="brand-divider" />
        <div className="brand-text">
          <span className="brand-title">Smart El Niño Heat Monitoring System</span>
          <span className="navbar-subtitle">Satellite-Based AI Early Warning</span>
        </div>
      </div>
      <div className="navbar-right">
        <div className="navbar-badge live-location-badge">
          <span className="live-dot" />
          <div>
            <span className="live-label">Live Location</span>
            <span className="live-location-value">{liveLocation || "Live"}</span>
          </div>
        </div>
        <button
          className="theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
