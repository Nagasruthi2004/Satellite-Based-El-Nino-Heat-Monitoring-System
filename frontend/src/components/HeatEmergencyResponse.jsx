import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./HeatEmergencyResponse.css";

const BACKEND_BASE = import.meta.env?.VITE_BACKEND_URL || "http://127.0.0.1:5000";

// Verified Cities in Ground Truth Municipal Catalog
const VERIFIED_CITIES = [
  { id: "coimbatore", name: "Coimbatore", lat: 11.0168, lon: 76.9558 },
  { id: "chennai", name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { id: "delhi", name: "Delhi", lat: 28.6139, lon: 77.2090 },
  { id: "bengaluru", name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { id: "mumbai", name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { id: "hyderabad", name: "Hyderabad", lat: 17.3850, lon: 78.4867 },
];

function createFacilityIcon(type) {
  let color = "#0284c7"; // Cooling center cyan
  let iconChar = "🧊";
  if (type === "hospital") {
    color = "#dc2626"; // Hospital red
    iconChar = "🏥";
  } else if (type === "water") {
    color = "#2563eb"; // Water blue
    iconChar = "💧";
  }

  const svgHtml = `
    <div style="
      background: ${color};
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      border: 2px solid white;
    ">
      <span style="transform: rotate(45deg); font-size: 15px;">${iconChar}</span>
    </div>
  `;
  return L.divIcon({
    html: svgHtml,
    className: "herc-marker-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });
}

export default function HeatEmergencyResponse({ initialCity = "Coimbatore", initialLat, initialLon }) {
  const [selectedCity, setSelectedCity] = useState(initialCity || "Coimbatore");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all", "cooling", "hospitals", "water", "protocols", "checklist"
  const [data, setData] = useState(null);
  
  // Checklist local states
  const [checklist, setChecklist] = useState({
    hydrationStock: true,
    vulnerableCheck: true,
    medicationCheck: false,
    coolRoomPrepared: false,
    emergencyNumbersSaved: true,
    firstAidORSReady: true,
  });

  const toggleCheck = (key) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const completedChecksCount = Object.values(checklist).filter(Boolean).length;
  const totalChecksCount = Object.keys(checklist).length;

  // Load facilities for location
  useEffect(() => {
    let isCancelled = false;
    async function fetchFacilities() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedCity) params.append("city", selectedCity);
        if (initialLat && initialLon && !selectedCity) {
          params.append("lat", initialLat);
          params.append("lon", initialLon);
        }

        const res = await fetch(`${BACKEND_BASE}/api/cooling-centers?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!isCancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to load emergency facilities:", err);
          setError("Failed to load official cooling directory. Please check network connection or verify local emergency contacts.");
          setLoading(false);
        }
      }
    }
    fetchFacilities();
    return () => {
      isCancelled = true;
    };
  }, [selectedCity, initialLat, initialLon]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSelectedCity(searchInput.trim());
    }
  };

  // Facilities list filtered by tab
  const allFacilities = useMemo(() => {
    if (!data) return [];
    const list = [];
    (data.cooling_centers || []).forEach((c) => list.push({ ...c, category: "cooling" }));
    (data.hospitals || []).forEach((h) => list.push({ ...h, category: "hospital" }));
    (data.water_points || []).forEach((w) => list.push({ ...w, category: "water" }));
    return list;
  }, [data]);

  const filteredFacilities = useMemo(() => {
    if (activeTab === "all") return allFacilities;
    if (activeTab === "cooling") return allFacilities.filter((f) => f.category === "cooling");
    if (activeTab === "hospitals") return allFacilities.filter((f) => f.category === "hospital");
    if (activeTab === "water") return allFacilities.filter((f) => f.category === "water");
    return [];
  }, [allFacilities, activeTab]);

  const centerCoords = useMemo(() => {
    if (data?.coordinates && typeof data.coordinates.lat === "number" && typeof data.coordinates.lon === "number") {
      return [data.coordinates.lat, data.coordinates.lon];
    }
    const match = VERIFIED_CITIES.find((c) => c.name.toLowerCase() === selectedCity.toLowerCase());
    return match ? [match.lat, match.lon] : [20.5937, 78.9629]; // Default India centroid
  }, [data, selectedCity]);

  const isVerifiedCoverage = data?.coverage_status === "verified";

  return (
    <div className="herc-container">
      {/* ── HEADER & MEDICAL DISCLAIMER ── */}
      <div className="herc-header">
        <div className="herc-header-top">
          <div className="herc-title-group">
            <h2>🏥 Heat Emergency Response Center</h2>
            <p className="herc-subtitle">
              Verified urban cooling shelters, tertiary medical centers with dedicated heat-stroke resuscitation units,
              drinking water kiosks, and emergency hotlines during extreme heat waves.
            </p>
          </div>
          <div className="herc-status-chip-wrapper">
            {loading ? (
              <span className="herc-status-chip">Checking Registry...</span>
            ) : isVerifiedCoverage ? (
              <span className="herc-status-chip verified">✓ Verified Municipal Registry ({data?.location_name})</span>
            ) : (
              <span className="herc-status-chip unavailable">⚠️ Registry Data Unavailable for Area</span>
            )}
          </div>
        </div>

        {/* Prominent Emergency Notice */}
        <div className="herc-disclaimer-banner">
          <span className="disclaimer-icon">🚨</span>
          <div className="herc-disclaimer-text">
            <strong>CRITICAL MEDICAL & CIVIC NOTICE:</strong> This directory provides public interest information for heat emergency preparedness.
            <strong> It DOES NOT replace 112 / 108 emergency response or medical advice.</strong> If you observe symptoms of acute heat stroke
            (confusion, hot red dry skin, body temp &gt; 40°C, seizure, unconsciousness), <strong>dial 112 / 108 immediately</strong> and move the victim to shade with active water cooling.
          </div>
        </div>
      </div>

      {/* ── EMERGENCY HOTLINES SPEED DIAL ── */}
      <div className="herc-hotlines-bar">
        <a href="tel:112" className="herc-hotline-card critical">
          <span className="herc-hotline-number">112</span>
          <div className="herc-hotline-info">
            <span className="herc-hotline-name">National Emergency Services</span>
            <span className="herc-hotline-sub">Police, Fire & Unified Dispatch (24/7 Toll-Free)</span>
          </div>
        </a>
        <a href="tel:108" className="herc-hotline-card critical">
          <span className="herc-hotline-number">108</span>
          <div className="herc-hotline-info">
            <span className="herc-hotline-name">Emergency Medical Ambulance</span>
            <span className="herc-hotline-sub">Heat Stroke Resuscitation Response (24/7)</span>
          </div>
        </a>
        <a href="tel:1078" className="herc-hotline-card">
          <span className="herc-hotline-number">1078</span>
          <div className="herc-hotline-info">
            <span className="herc-hotline-name">NDMA Disaster Helpline</span>
            <span className="herc-hotline-sub">National Disaster Management Authority</span>
          </div>
        </a>
        <a href="tel:104" className="herc-hotline-card">
          <span className="herc-hotline-number">104</span>
          <div className="herc-hotline-info">
            <span className="herc-hotline-name">Health Information Line</span>
            <span className="herc-hotline-sub">Tele-Triage & Heat Illness Guidance</span>
          </div>
        </a>
      </div>

      {/* ── LOCATION SELECTOR BAR ── */}
      <div className="herc-location-bar">
        <div className="herc-location-row">
          <div className="herc-city-selector-pills">
            <span className="herc-pill-label">Verified Municipal Registries:</span>
            {VERIFIED_CITIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`herc-city-pill ${selectedCity.toLowerCase() === c.name.toLowerCase() ? "active" : ""}`}
                onClick={() => {
                  setSelectedCity(c.name);
                  setSearchInput("");
                }}
              >
                {c.name}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="herc-search-box">
            <input
              type="text"
              className="herc-search-input"
              placeholder="Search city or district..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="herc-search-btn">
              Check Registry
            </button>
          </form>
        </div>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div className="herc-tabs">
        <button
          type="button"
          className={`herc-tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          🌐 All Verified Facilities
          {allFacilities.length > 0 && <span className="herc-tab-count">{allFacilities.length}</span>}
        </button>
        <button
          type="button"
          className={`herc-tab-btn ${activeTab === "cooling" ? "active" : ""}`}
          onClick={() => setActiveTab("cooling")}
        >
          🧊 Cooling Centers
          {data?.cooling_centers && <span className="herc-tab-count">{data.cooling_centers.length}</span>}
        </button>
        <button
          type="button"
          className={`herc-tab-btn ${activeTab === "hospitals" ? "active" : ""}`}
          onClick={() => setActiveTab("hospitals")}
        >
          🏥 Hospitals & Heat Units
          {data?.hospitals && <span className="herc-tab-count">{data.hospitals.length}</span>}
        </button>
        <button
          type="button"
          className={`herc-tab-btn ${activeTab === "water" ? "active" : ""}`}
          onClick={() => setActiveTab("water")}
        >
          💧 Water Kiosks
          {data?.water_points && <span className="herc-tab-count">{data.water_points.length}</span>}
        </button>
        <button
          type="button"
          className={`herc-tab-btn ${activeTab === "protocols" ? "active" : ""}`}
          onClick={() => setActiveTab("protocols")}
        >
          📋 Heat Action Protocols
        </button>
        <button
          type="button"
          className={`herc-tab-btn ${activeTab === "checklist" ? "active" : ""}`}
          onClick={() => setActiveTab("checklist")}
        >
          ✅ Safety Checklist ({completedChecksCount}/{totalChecksCount})
        </button>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      {loading ? (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔄</div>
          <p style={{ color: "var(--text)", fontWeight: "600" }}>Querying verified municipal registry for {selectedCity}...</p>
        </div>
      ) : error ? (
        <div className="prediction-error">{error}</div>
      ) : !isVerifiedCoverage ? (
        /* ── HONEST UNAVAILABLE STATE (No fake data) ── */
        <div className="herc-unavailable-card">
          <span className="herc-unavailable-icon">📍</span>
          <h3 className="herc-unavailable-title">
            No Verified Municipal Registry Cataloged for &ldquo;{data?.location_name || selectedCity}&rdquo;
          </h3>
          <p className="herc-unavailable-desc">
            To prevent dangerous misinformation during heat crises, this system displays <strong>only officially cataloged municipal cooling shelters and designated public health refuges</strong>.
            We strictly do not generate synthetic, estimated, or unverified shelter coordinates.
          </p>
          <div className="herc-emergency-fallback-box">
            <h4 style={{ color: "var(--text)", marginBottom: "8px" }}>Immediate Action Steps for Uncataloged Areas:</h4>
            <ul style={{ paddingLeft: "18px", fontSize: "13px", lineHeight: "1.6", color: "var(--text-muted)" }}>
              <li>Visit the nearest <strong>Government District Hospital or Primary Health Centre (PHC)</strong> for clinical heat exhaustion / dehydration support.</li>
              <li>Seek refuge in public transit hubs, air-conditioned libraries, civic buildings, or shaded public parks during peak heat hours (12:00 PM – 4:00 PM).</li>
              <li>For immediate life-threatening heatstroke, call <strong>112 (National Emergency)</strong> or <strong>108 (Ambulance)</strong>.</li>
            </ul>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Explore verified municipal registries in supported metro regions:
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            {VERIFIED_CITIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className="herc-city-pill"
                onClick={() => setSelectedCity(c.name)}
              >
                View {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── MAP VIEW (For verified locations) ── */}
          {activeTab !== "protocols" && activeTab !== "checklist" && (
            <div className="herc-map-card">
              <div className="herc-map-header">
                <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
                  🗺️ Verified Facility Map &mdash; {data?.location_name}
                </span>
                <div className="herc-map-legend">
                  <span><span className="legend-dot" style={{ background: "#0284c7" }}></span> Cooling Shelter</span>
                  <span><span className="legend-dot" style={{ background: "#dc2626" }}></span> Hospital / Heat Unit</span>
                  <span><span className="legend-dot" style={{ background: "#2563eb" }}></span> Potable Water Kiosk</span>
                </div>
              </div>
              <div className="herc-map-wrapper">
                <MapContainer
                  center={centerCoords}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {filteredFacilities.map((fac) => (
                    <Marker
                      key={fac.id}
                      position={[fac.lat, fac.lon]}
                      icon={createFacilityIcon(fac.category)}
                    >
                      <Popup>
                        <div style={{ maxWidth: "240px", fontSize: "13px" }}>
                          <strong style={{ fontSize: "14px", display: "block", marginBottom: "4px" }}>
                            {fac.name}
                          </strong>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            background: "#e0f2fe",
                            color: "#0369a1",
                            marginBottom: "6px"
                          }}>
                            {fac.type}
                          </span>
                          <p style={{ margin: "4px 0", color: "#475569" }}>{fac.address}</p>
                          {fac.hours && <p style={{ margin: "4px 0" }}><strong>Hours:</strong> {fac.hours}</p>}
                          {fac.emergency_phone && (
                            <p style={{ margin: "4px 0" }}>
                              <strong>Helpline:</strong>{" "}
                              <a href={`tel:${fac.emergency_phone.split("/")[0].trim()}`}>
                                {fac.emergency_phone}
                              </a>
                            </p>
                          )}
                          {fac.capacity && <p style={{ margin: "4px 0" }}><strong>Capacity:</strong> {fac.capacity} persons</p>}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          )}

          {/* ── FACILITY DIRECTORY CARDS ── */}
          {activeTab !== "protocols" && activeTab !== "checklist" && (
            <div className="herc-grid">
              {filteredFacilities.map((facility) => (
                <div key={facility.id} className="herc-card">
                  <div className="herc-card-top">
                    <div className="herc-card-header">
                      <h4 className="herc-card-title">{facility.name}</h4>
                      <span className="herc-card-type">{facility.type}</span>
                    </div>
                    <div className="herc-card-address">
                      <span>📍</span>
                      <span>{facility.address}</span>
                    </div>
                    {facility.features && facility.features.length > 0 && (
                      <div className="herc-features-list">
                        {facility.features.map((feat, i) => (
                          <span key={i} className="herc-feature-chip">{feat}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="herc-card-details">
                    {facility.hours && (
                      <div className="herc-detail-item">
                        <span>Operating Hours:</span>
                        <strong>{facility.hours}</strong>
                      </div>
                    )}
                    {facility.capacity && (
                      <div className="herc-detail-item">
                        <span>Safe Refuge Capacity:</span>
                        <strong>{facility.capacity} Persons</strong>
                      </div>
                    )}
                    {facility.dedicated_heat_stroke_ward && (
                      <div className="herc-detail-item">
                        <span>Heat Stroke Ward:</span>
                        <strong style={{ color: "var(--danger)" }}>✓ Dedicated Unit Active</strong>
                      </div>
                    )}
                    {facility.water_quality_tested && (
                      <div className="herc-detail-item">
                        <span>Potable Testing:</span>
                        <strong style={{ color: "var(--success)" }}>✓ Certified Potable (WHO Norms)</strong>
                      </div>
                    )}
                  </div>

                  <div className="herc-card-footer">
                    <span className="herc-auth-badge">
                      🏛️ {facility.authority || "Municipal Authority"}
                    </span>
                    {facility.emergency_phone ? (
                      <a href={`tel:${facility.emergency_phone.split("/")[0].trim()}`} className="herc-action-btn">
                        📞 Call Helpline
                      </a>
                    ) : (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${facility.name} ${facility.address}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="herc-action-btn"
                      >
                        🧭 Navigate
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTION PROTOCOLS TAB ── */}
          {activeTab === "protocols" && (
            <div className="herc-action-matrix">
              {(data?.heat_safety_actions || []).map((actionBlock, idx) => {
                const levelColor = actionBlock.level.toLowerCase();
                return (
                  <div key={idx} className={`herc-action-level-card ${levelColor}`}>
                    <div className="herc-level-header">
                      <span className="herc-level-title">
                        {actionBlock.level === "Red" && "🔴 Red Alert — Extreme Heat Crisis Protocol"}
                        {actionBlock.level === "Orange" && "🟠 Orange Alert — Severe Heat Warning Protocol"}
                        {actionBlock.level === "Yellow" && "🟡 Yellow Alert — Heat Watch & Hydration Protocol"}
                        {actionBlock.level === "Green" && "🟢 Normal Preparedness Protocol"}
                      </span>
                      <span className="herc-level-trigger">Trigger: {actionBlock.trigger}</span>
                    </div>
                    <ul className="herc-actions-list">
                      {actionBlock.actions.map((act, aIdx) => (
                        <li key={aIdx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CHECKLIST TAB ── */}
          {activeTab === "checklist" && (
            <div className="herc-checklist-grid">
              <div className="herc-checklist-box">
                <h4 className="herc-checklist-title">🏠 Household & Vulnerable Care Checklist</h4>
                <div className="herc-checklist-items">
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklist.hydrationStock}
                      onChange={() => toggleCheck("hydrationStock")}
                    />
                    <span>Adequate drinking water (minimum 4-5 liters/person/day) and ORS packets stocked</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklist.vulnerableCheck}
                      onChange={() => toggleCheck("vulnerableCheck")}
                    />
                    <span>Daily check-in schedule established for seniors (&gt;65), pregnant individuals, and infants</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklist.medicationCheck}
                      onChange={() => toggleCheck("medicationCheck")}
                    />
                    <span>Temperature-sensitive medications stored in cool conditions (&lt;25°C)</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklist.coolRoomPrepared}
                      onChange={() => toggleCheck("coolRoomPrepared")}
                    />
                    <span>Coolest room identified with sun-blocking curtains or wet screens installed</span>
                  </label>
                </div>
              </div>

              <div className="herc-checklist-box">
                <h4 className="herc-checklist-title">🚨 Emergency Medical Preparedness</h4>
                <div className="herc-checklist-items">
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklist.emergencyNumbersSaved}
                      onChange={() => toggleCheck("emergencyNumbersSaved")}
                    />
                    <span>Emergency contacts (112, 108, nearest hospital heat unit) saved on all family phones</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklist.firstAidORSReady}
                      onChange={() => toggleCheck("firstAidORSReady")}
                    />
                    <span>Instant cold packs, spray water bottle, and oral rehydration salts in home first aid kit</span>
                  </label>
                  <div style={{ marginTop: "16px", padding: "12px", background: "var(--secondary)", borderRadius: "8px", fontSize: "12px" }}>
                    <strong style={{ color: "var(--danger)" }}>Heat Stroke Warning Signs:</strong>
                    <p style={{ marginTop: "4px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      High body temperature (&gt;40°C), hot red dry skin, confusion, slurred speech, rapid pulse, or unconsciousness.
                      Begin immediate immersion/wet sponge cooling and call <strong>108</strong> without delay.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── FOOTER CITATION ── */}
      <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "8px" }}>
        Data Authority: National Disaster Management Authority (NDMA) Heat Action Plan & Municipal Corporation Guidelines.
        All emergency facilities are subject to municipal operational schedules.
      </div>
    </div>
  );
}
