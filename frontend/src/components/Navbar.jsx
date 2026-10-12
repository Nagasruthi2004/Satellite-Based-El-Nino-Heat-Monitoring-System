function Navbar({ theme, liveLocation, isLocating, onToggleTheme, onLocateMe }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🌍</span>
        <div className="brand-divider" />
        <div className="brand-text">
          <span className="brand-title">Smart El Niño Heat Monitoring System</span>
          <span className="navbar-subtitle">AI-Based Heat Risk Monitoring & Early Warning</span>
        </div>
      </div>
      <div className="navbar-right">
        <div
          className="navbar-badge live-location-badge"
          onClick={onLocateMe}
          title={onLocateMe ? "Your physical live location (Click to view)" : "Your physical live location"}
          role={onLocateMe ? "button" : undefined}
          tabIndex={onLocateMe ? 0 : undefined}
          style={{ cursor: onLocateMe ? "pointer" : "default" }}
          onKeyDown={(e) => {
            if (onLocateMe && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onLocateMe();
            }
          }}
        >
          <span className="live-dot" />
          <div>
            <span className="live-label">Live Location</span>
            <span className="live-location-value">
              {liveLocation || (isLocating ? "Detecting GPS..." : "Live Detected")}
            </span>
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
