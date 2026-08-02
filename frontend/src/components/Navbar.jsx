function Navbar({ theme, onToggleTheme }) {
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
