import { useState, useEffect, useId, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./EmergencyLocation.css";

const API_BASE = "http://127.0.0.1:5000";

const QUICK_CITIES = [
  { name: "Coimbatore", lat: 11.0168, lon: 76.9558 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Delhi", lat: 28.6139, lon: 77.2090 },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
  { name: "Jaipur", lat: 26.9124, lon: 75.7873 },
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867 },
];

function createLocationPin(riskLevel) {
  const colorMap = {
    Low: "#16a34a",
    Medium: "#f59e0b",
    Moderate: "#f59e0b",
    High: "#dc2626",
    Critical: "#991b1b",
  };
  const pinColor = colorMap[riskLevel] || "#2563eb";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25c0-8.284-6.716-15-15-15z"
            fill="${pinColor}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="15" r="6" fill="#ffffff"/>
      <circle cx="15" cy="15" r="3" fill="${pinColor}"/>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: "emergency-map-pin",
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, Math.max(map.getZoom(), 10), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function EmergencyLocation() {
  const [selectedLocation, setSelectedLocation] = useState("Coimbatore");
  const [coords, setCoords] = useState([11.0168, 76.9558]);
  const [searchInput, setSearchInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null); // { type: 'info' | 'error', text: '' }

  const [emergencyData, setEmergencyData] = useState(null);
  const [selectedDisasterId, setSelectedDisasterId] = useState("heatwave");

  const searchInputId = useId();

  // Load emergency data on mount or when location changes
  useEffect(() => {
    let isMounted = true;

    async function fetchEmergencyInfo() {
      try {
        const query = encodeURIComponent(selectedLocation);
        const res = await fetch(`${API_BASE}/emergency-info?location=${query}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (isMounted && json.status === "success") {
          setEmergencyData(json);
          if (json.location_heat_status?.lat && json.location_heat_status?.lon) {
            setCoords([json.location_heat_status.lat, json.location_heat_status.lon]);
          }
        }
      } catch {
        // Fallback without crash if backend offline
        if (isMounted) {
          setEmergencyData((prev) => prev || {
            location_heat_status: {
              location: selectedLocation,
              temperature: 34.0,
              heat_risk: "Medium",
              safety_guidance: "Moderate heat conditions. Proactively hydrate and seek shade during afternoon hours.",
            },
            verified_contacts: [
              { id: "112", name: "All-in-One National Emergency", number: "112", authority: "Ministry of Home Affairs", verification_status: "Official Government Helpline", toll_free: true },
              { id: "108", name: "Medical Emergency & Ambulance", number: "108", authority: "National Health Mission", verification_status: "Official Government Helpline", toll_free: true },
              { id: "101", name: "Fire & Rescue Service", number: "101", authority: "Directorate General of Fire Services", verification_status: "Official Government Helpline", toll_free: true },
              { id: "100", name: "Police Helpline", number: "100", authority: "State Police Forces", verification_status: "Official Government Helpline", toll_free: true },
            ],
            nearby_places_service: {
              enabled: false,
              message: "Nearby live facility search API is not configured. For immediate medical emergencies or rescue, contact emergency dispatch at 112 or 108 directly.",
            },
            disaster_safety_links: [
              { id: "heatwave", name: "Heatwave Safety", icon: "🔥", summary: "Drink plenty of water and electrolytes. Stay in air-conditioned or shaded areas.", critical_action: "In case of heat stroke symptoms, call 108 / 112 immediately." }
            ]
          });
        }
      }
    }

    fetchEmergencyInfo();
    return () => {
      isMounted = false;
    };
  }, [selectedLocation]);

  // Geolocation handler - ONLY invoked on explicit user button click
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus({
        type: "error",
        text: "Geolocation is not supported by your browser. Please select or search your city manually.",
      });
      return;
    }

    setIsLocating(true);
    setLocationStatus({
      type: "info",
      text: "Acquiring your location securely from browser...",
    });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setCoords([latitude, longitude]);

        try {
          const res = await fetch(`${API_BASE}/emergency-info?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === "success") {
              setEmergencyData(data);
              const detectedCity = data.location_heat_status?.location || "Detected Location";
              setSelectedLocation(detectedCity);
              setLocationStatus({
                type: "info",
                text: `Location detected: ${detectedCity} (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E). Showing localized emergency information.`,
              });
              return;
            }
          }
        } catch {
          // ignore network error
        }

        setSelectedLocation(`Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
        setLocationStatus({
          type: "info",
          text: `Coordinates acquired: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E. Showing emergency contacts for your region.`,
        });
      },
      (err) => {
        setIsLocating(false);
        let errorMsg = "Could not retrieve your location. Please pick or search your city manually.";
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = "Location permission was denied. You can manually enter or select your city or state below.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMsg = "Location information is unavailable. Please check your device location settings or enter your city manually.";
        } else if (err.code === err.TIMEOUT) {
          errorMsg = "Location request timed out. Please try again or select your city manually.";
        }
        setLocationStatus({
          type: "error",
          text: errorMsg,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    const clean = searchInput.trim();
    if (!clean) return;
    setSelectedLocation(clean);
    setLocationStatus({
      type: "info",
      text: `Selected location updated to: ${clean}. Fetching localized weather and emergency status...`,
    });
  };

  const currentHeatInfo = emergencyData?.location_heat_status;
  const heatRisk = currentHeatInfo?.heat_risk || "Medium";

  const mapIcon = useMemo(() => createLocationPin(heatRisk), [heatRisk]);

  const activeDisaster = useMemo(() => {
    const list = emergencyData?.disaster_safety_links || [];
    return list.find((d) => d.id === selectedDisasterId) || list[0];
  }, [emergencyData, selectedDisasterId]);

  return (
    <div className="emergency-container">
      {/* ── HEADER ── */}
      <header className="emergency-header">
        <div className="emergency-title-area">
          <div className="emergency-eyebrow">
            <span>🚨</span>
            <span>Immediate Safety & Rescue Network</span>
          </div>
          <h1 className="emergency-title">Emergency Location & Nearby Help</h1>
          <p className="emergency-subtitle">
            Find official emergency helplines, localized heat-risk warnings, and disaster response guidelines tailored to your current or selected location.
          </p>
        </div>

        <a href="tel:112" className="national-112-callout" title="Instant call to Unified Emergency Dispatch">
          <span>📞</span>
          <span>Emergency: Dial 112</span>
        </a>
      </header>

      {/* ── MANDATORY PRIVACY NOTICE ── */}
      <div className="privacy-notice-banner" role="note">
        <div className="privacy-notice-icon">🛡️</div>
        <div>
          <strong>Location Privacy Protection:</strong> Your location is requested only when you choose to use location-based help. The application does not continuously track your location.
        </div>
      </div>

      {/* ── LOCATION CONTROLS & MANUAL SEARCH ── */}
      <section className="location-controls-card">
        <div className="controls-row">
          <button
            type="button"
            className="btn-locate-me"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            title="Request current device coordinates via browser Geolocation API"
          >
            <span>📍</span>
            <span>{isLocating ? "Detecting Location..." : "Use My Location"}</span>
          </button>

          <form className="search-input-wrapper" onSubmit={handleManualSearch}>
            <label htmlFor={searchInputId} className="sr-only" style={{ display: "none" }}>Search city or state</label>
            <input
              id={searchInputId}
              type="text"
              className="search-input"
              placeholder="Enter city or state (e.g. Coimbatore, Madurai, Jaipur)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="btn-search">
              Search Location
            </button>
          </form>
        </div>

        {/* Quick Location Pills */}
        <div className="quick-cities-row">
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Quick Select:</span>
          {QUICK_CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`quick-city-chip ${selectedLocation === c.name ? "active" : ""}`}
              onClick={() => {
                setSelectedLocation(c.name);
                setCoords([c.lat, c.lon]);
                setLocationStatus(null);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Location Status Alert Banner */}
        {locationStatus && (
          <div className={`location-status-banner ${locationStatus.type}`} role="status">
            <span>{locationStatus.type === "error" ? "⚠️" : "ℹ️"}</span>
            <span>{locationStatus.text}</span>
          </div>
        )}
      </section>

      {/* ── TWO-COLUMN WORKSPACE ── */}
      <div className="emergency-grid">
        {/* LEFT COLUMN: OFFICIAL HELPLINES & DISASTER SAFETY */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Emergency Contacts Section */}
          <section className="em-card">
            <div className="em-card-header">
              <h2 className="em-card-title">
                <span>📞</span>
                <span>Verified Official Emergency Contacts</span>
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>India Standard Helplines</span>
            </div>

            <div className="contacts-grid">
              {(emergencyData?.verified_contacts || []).map((contact) => (
                <div key={contact.id || contact.number} className="contact-card">
                  <div className="contact-card-top">
                    <span className="contact-cat">{contact.category || "Emergency Line"}</span>
                    <span className="contact-name">{contact.name}</span>
                    <p className="contact-desc">{contact.description}</p>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      Source: {contact.authority}
                    </span>
                  </div>

                  <div className="contact-dial-row">
                    <span className="verified-badge">✓ {contact.verification_status || "Verified Official"}</span>
                    <a
                      href={`tel:${contact.number}`}
                      className="btn-dial"
                      title={`Call ${contact.name} at ${contact.number}`}
                    >
                      <span>📞</span>
                      <span>{contact.number}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Disaster Safety Integration */}
          <section className="em-card">
            <div className="em-card-header">
              <h2 className="em-card-title">
                <span>🚨</span>
                <span>Disaster Safety Guidance & Immediate Actions</span>
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Integrated with Disaster Information</span>
            </div>

            <div className="disaster-shortcuts-grid">
              {(emergencyData?.disaster_safety_links || []).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`disaster-shortcut-btn ${selectedDisasterId === d.id ? "active" : ""}`}
                  onClick={() => setSelectedDisasterId(d.id)}
                >
                  <span className="ds-icon">{d.icon}</span>
                  <span className="ds-name">{d.name}</span>
                </button>
              ))}
            </div>

            {activeDisaster && (
              <div className="disaster-detail-panel">
                <div>
                  <strong>{activeDisaster.name} Protocol:</strong>
                  <p>{activeDisaster.summary}</p>
                </div>
                {activeDisaster.critical_action && (
                  <div>
                    <strong style={{ color: "#dc2626" }}>Critical Action:</strong>
                    <p>{activeDisaster.critical_action}</p>
                  </div>
                )}
                <a
                  href="#disaster-info"
                  className="btn-open-disaster-module"
                  onClick={() => {
                    window.location.hash = "disaster-info";
                  }}
                >
                  <span>📖</span>
                  <span>Open Full Disaster Information Module</span>
                </a>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: MAP & LOCAL HEAT-RISK STATUS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Local Heat-Risk Status */}
          <section className="em-card">
            <div className="em-card-header">
              <h2 className="em-card-title">
                <span>🌡️</span>
                <span>Heat-Risk Status for {selectedLocation}</span>
              </h2>
            </div>

            <div className={`heat-status-box risk-${heatRisk.toLowerCase()}`}>
              <div className="heat-stats-row">
                <div className="stat-cell">
                  <span className="stat-cell-label">Current Heat Risk</span>
                  <span
                    className="stat-cell-val"
                    style={{
                      color:
                        heatRisk === "Critical"
                          ? "#7f1d1d"
                          : heatRisk === "High"
                          ? "#dc2626"
                          : heatRisk === "Medium"
                          ? "#d97706"
                          : "#16a34a",
                    }}
                  >
                    {heatRisk}
                  </span>
                </div>
                <div className="stat-cell">
                  <span className="stat-cell-label">Temperature / LST</span>
                  <span className="stat-cell-val">
                    {currentHeatInfo?.temperature != null ? `${currentHeatInfo.temperature}°C` : "34.0°C"}
                  </span>
                </div>
              </div>

              <div className="heat-guidance-text">
                <strong>Safety Guidance: </strong>
                {currentHeatInfo?.safety_guidance ||
                  "Drink water frequently, limit direct sun exposure during peak afternoon hours, and check on vulnerable individuals."}
              </div>
            </div>
          </section>

          {/* Interactive Geographic Map */}
          <section className="em-card">
            <div className="em-card-header">
              <h2 className="em-card-title">
                <span>🗺️</span>
                <span>Geographic Location Map</span>
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {coords[0].toFixed(3)}°N, {coords[1].toFixed(3)}°E
              </span>
            </div>

            <div className="map-wrapper">
              <MapContainer
                center={coords}
                zoom={11}
                scrollWheelZoom={false}
                style={{ width: "100%", height: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapRecenter center={coords} />
                <Marker position={coords} icon={mapIcon}>
                  <Popup>
                    <div style={{ textAlign: "center", padding: "4px" }}>
                      <strong style={{ fontSize: "14px", display: "block" }}>{selectedLocation}</strong>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        Heat Risk: <strong>{heatRisk}</strong> ({currentHeatInfo?.temperature || 34}°C)
                      </span>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>

            {/* Legitimate Place Search Notice */}
            <div className="nearby-place-notice" role="note">
              <span>ℹ️</span>
              <div>
                <strong>Nearby Facility Live Search:</strong>{" "}
                {emergencyData?.nearby_places_service?.message ||
                  "Live local facility search API is not configured. For immediate medical emergencies or rescue, contact emergency dispatch at 112 or 108 directly."}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
