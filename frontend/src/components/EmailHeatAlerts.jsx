import { useState, useEffect, useCallback, useRef } from "react";
import HeatMap from "./HeatMap";
import "./EmailHeatAlerts.css";

const BACKEND_BASE = import.meta.env?.VITE_BACKEND_URL || "http://127.0.0.1:5000";

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export default function EmailHeatAlerts() {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  // Search input & suggestion dropdown
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const searchDebounceRef = useRef(null);
  const searchWrapperRef = useRef(null);

  // Validation & status
  const [emailError, setEmailError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success' | 'error', message: '' }

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Validate email helper
  const validateEmail = useCallback((val) => {
    if (!val || !val.trim()) {
      setEmailError("Email address is required.");
      return false;
    }
    const trimmed = val.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError("Please enter a valid email address (e.g., example@gmail.com).");
      return false;
    }
    setEmailError("");
    return true;
  }, []);

  // Handle location search with debouncing
  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`${BACKEND_BASE}/api/locations/search?q=${encodeURIComponent(trimmed)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.warn("Location search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // User selects a suggestion from dropdown
  const handleSelectSuggestion = (item) => {
    const locName = item.name || item.display_name;
    setCity(locName);
    setSearchQuery(item.display_name || locName);
    setLatitude(item.lat);
    setLongitude(item.lon);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // User clicks on map to pick worldwide coordinates
  const handleMapClick = useCallback(async (lat, lon) => {
    const roundedLat = Number(lat.toFixed(4));
    const roundedLon = Number(lon.toFixed(4));
    setLatitude(roundedLat);
    setLongitude(roundedLon);
    setShowSuggestions(false);

    let resolvedName = `${roundedLat}°, ${roundedLon}°`;
    try {
      const res = await fetch(`${BACKEND_BASE}/api/locations/reverse?lat=${roundedLat}&lon=${roundedLon}`);
      if (res.ok) {
        const data = await res.json();
        resolvedName = data.name || data.display_name || resolvedName;
      }
    } catch (err) {
      console.warn("Reverse geocode failed:", err);
    }

    setCity(resolvedName);
    setSearchQuery(resolvedName);
  }, []);

  // Clear chosen location
  const handleClearLocation = () => {
    setCity("");
    setLatitude(null);
    setLongitude(null);
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Check Heat Risk & Send Email
  const handleCheckAndSendAlert = async (e) => {
    if (e) e.preventDefault();
    const trimmedEmail = (email || "").trim();
    if (!validateEmail(trimmedEmail)) {
      setResult({
        type: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }

    const trimmedCity = (city || searchQuery || "").trim();
    if (!trimmedCity && (latitude == null || longitude == null)) {
      setResult({
        type: "error",
        message: "Please search and select a location or pick one on the map.",
      });
      return;
    }

    try {
      setIsSending(true);
      setResult(null);

      const res = await fetch(`${BACKEND_BASE}/api/alerts/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          city: trimmedCity || `Coordinates (${latitude}, ${longitude})`,
          latitude: latitude,
          longitude: longitude,
          force_send: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.status === "error" || data.error) {
        throw new Error(data.error || "Failed to evaluate heat risk or deliver email.");
      }

      if (data.sent) {
        const displayCity = data.city || trimmedCity;
        const tempStr = data.temperature != null ? `${Number(data.temperature).toFixed(1)}°C` : "";
        const riskLevel = data.risk_level || "Evaluated";
        const scoreStr = data.risk_score != null ? ` (Severity: ${Number(data.risk_score).toFixed(1)}/100)` : "";

        setResult({
          type: "success",
          message: `Real heat alert email successfully dispatched to ${trimmedEmail} for ${displayCity} — ${tempStr} [${riskLevel} Risk${scoreStr}].`,
        });
      } else {
        setResult({
          type: "error",
          message: data.reason || data.message || "Weather was evaluated but alert email could not be dispatched.",
        });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err.message || "An unexpected error occurred while checking heat risk.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="email-alerts-container eha-simplified-container">
      {/* ── HEADER ── */}
      <div className="eha-header-card">
        <div className="eha-title-group">
          <h2>🌍 Heat Alerts</h2>
          <p className="eha-subtitle">
            Enter your email and search any location worldwide to evaluate current heat risk and receive a real-time risk alert bulletin.
          </p>
        </div>
      </div>

      {/* ── MAIN COMPACT CARD ── */}
      <div className="eha-panel eha-simplified-panel">
        {/* Simple Result Message */}
        {result && (
          <div className={`eha-banner banner-${result.type}`} role="alert">
            <span className="eha-banner-icon">
              {result.type === "success" ? "✅" : "❌"}
            </span>
            <div className="eha-banner-body">
              <div>{result.message}</div>
            </div>
            <button
              type="button"
              className="eha-banner-close"
              onClick={() => setResult(null)}
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleCheckAndSendAlert} className="eha-form-group" style={{ gap: "20px" }}>
          {/* 1. Email Address */}
          <div className="eha-form-group">
            <label htmlFor="alert-recipient-email" className="eha-form-label">
              <span>Email Address <span style={{ color: "#ef4444" }}>*</span></span>
            </label>
            <div className="eha-input-wrapper">
              <span className="eha-input-icon">✉️</span>
              <input
                id="alert-recipient-email"
                type="email"
                className={`eha-input ${emailError ? "input-error" : ""}`}
                placeholder="recipient@gmail.com"
                value={email}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmail(val);
                  if (emailError) validateEmail(val);
                }}
                required
              />
            </div>
            {emailError && <div className="eha-error-msg">⚠️ {emailError}</div>}
          </div>

          {/* 2. Search Location */}
          <div className="eha-form-group" ref={searchWrapperRef}>
            <div className="eha-form-label">
              <span>Search Location (Worldwide) <span style={{ color: "#ef4444" }}>*</span></span>
              <button
                type="button"
                className="eha-map-toggle-btn"
                onClick={() => setShowMap(!showMap)}
                title="Toggle interactive map to pick location"
              >
                {showMap ? "Hide Map ▲" : "🗺️ Pick on Map ▼"}
              </button>
            </div>

            <div className="eha-location-search-box">
              <div className="eha-input-wrapper">
                <span className="eha-input-icon">🔍</span>
                <input
                  id="alert-monitored-city"
                  type="text"
                  className="eha-input"
                  placeholder="Search any city, country, or region worldwide..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  autoComplete="off"
                />
                {(searchQuery || city) && (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="eha-clear-btn"
                    title="Clear location"
                  >
                    ✕
                  </button>
                )}
                {isSearching && (
                  <span className="eha-spinner" style={{ marginRight: "10px" }} />
                )}
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="eha-suggestions-dropdown">
                  {suggestions.map((item, idx) => (
                    <div
                      key={`${item.name}-${item.lat}-${item.lon}-${idx}`}
                      className="eha-suggestion-row"
                      onClick={() => handleSelectSuggestion(item)}
                    >
                      <div className="eha-suggestion-main">
                        <span className="eha-suggestion-name">{item.name}</span>
                        <span className="eha-suggestion-sub">
                          {item.display_name || `${item.state ? item.state + ", " : ""}${item.country || ""}`}
                        </span>
                      </div>
                      <span className="eha-coord-pill">
                        {Number(item.lat).toFixed(2)}°, {Number(item.lon).toFixed(2)}°
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optional Map Picker */}
            {showMap && (
              <div className="eha-map-picker-container" style={{ marginTop: "12px" }}>
                <div className="eha-map-picker-banner">
                  <span>🗺️ Click any location worldwide on the map to select it</span>
                </div>
                <HeatMap
                  selectedCoordinates={latitude != null && longitude != null ? { lat: latitude, lon: longitude } : null}
                  onMapClick={handleMapClick}
                  title="Interactive Global Location Selector"
                />
              </div>
            )}
          </div>

          {/* 3. Selected Location */}
          <div className="eha-form-group">
            <label className="eha-form-label">
              <span>Selected Location</span>
            </label>
            <div className="eha-selected-location-hud">
              <div className="eha-selected-location-info">
                <span>📍</span>
                <span style={{ fontWeight: 600 }}>
                  {city ? city : "No location selected yet. Type a city above or pick on map."}
                </span>
              </div>
              {latitude != null && longitude != null && (
                <span className="eha-selected-coords">
                  Lat: {Number(latitude).toFixed(4)}°, Lon: {Number(longitude).toFixed(4)}°
                </span>
              )}
            </div>
          </div>

          {/* 4. Check Heat Risk & Send Email Button */}
          <div className="eha-btn-group" style={{ marginTop: "8px" }}>
            <button
              type="submit"
              className="eha-btn eha-btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: "15px" }}
              disabled={isSending || !email || !city}
              id="btn-check-and-send-alert"
            >
              {isSending ? (
                <>
                  <span className="eha-spinner" />
                  <span>Evaluating Weather &amp; Sending Email...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Check Heat Risk &amp; Send Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
