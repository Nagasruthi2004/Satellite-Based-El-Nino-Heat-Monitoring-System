import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const RISK_COLORS = {
  high:     "#dc2626",
  medium:   "#f97316",
  low:      "#16a34a",
};

function getRiskColor(heatRisk) {
  return RISK_COLORS[(heatRisk || "").toLowerCase()] || "#1565C0";
}

function makeIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.27 21.73 0 14 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

/**
 * MapHoverTracker:
 * - Detects geographic coordinates (lat, lng) when user moves/hovers the mouse cursor.
 * - Detects clicks immediately to show location and weather details.
 * - Enables zoom controls, wheel zoom, double-click zoom, and panning so user can zoom in to inspect places.
 * - Enforces no automatic map movement (no flyTo / panTo) and no drag-selection.
 * - Debounces the hover weather fetch (default 700ms) so requests happen only after mouse pauses briefly.
 * - Avoids duplicate requests if coordinates are nearly identical (< ~5km).
 */
function MapHoverTracker({
  onHoverMove,
  onHoverSettle,
  debounceMs = 700,
  minDistance = 0.05,
}) {
  const map = useMap();
  const debounceTimerRef = useRef(null);
  const lastSettledCoordsRef = useRef(null);

  useEffect(() => {
    // 1. Enable manual user zooming and panning to allow inspecting individual places
    if (map.dragging && !map.dragging.enabled()) {
      map.dragging.enable();
    }
    if (map.scrollWheelZoom && !map.scrollWheelZoom.enabled()) {
      map.scrollWheelZoom.enable();
    }
    if (map.doubleClickZoom && !map.doubleClickZoom.enabled()) {
      map.doubleClickZoom.enable();
    }
    if (map.touchZoom && !map.touchZoom.enabled()) {
      map.touchZoom.enable();
    }
    if (map.keyboard && !map.keyboard.enabled()) {
      map.keyboard.enable();
    }
    // Keep boxZoom disabled to prevent drag-selection (Requirement 8)
    if (map.boxZoom && map.boxZoom.enabled()) {
      map.boxZoom.disable();
    }

    const container = map.getContainer();
    if (container) {
      container.style.cursor = "default";
      container.classList.remove("leaflet-grab", "leaflet-touch-drag");
    }

    // 2. Listen to mousemove event on Leaflet map instance for real-time hover detection
    const handleMouseMove = (e) => {
      if (!e || !e.latlng) return;
      // Do not trigger hover settle while user is holding mouse button down (e.g. panning)
      if (e.originalEvent && e.originalEvent.buttons !== 0) return;

      const { lat, lng } = e.latlng;

      // Real-time hover coordinate update for UI HUD badge
      onHoverMove?.(lat, lng);

      // Debounce the weather API request
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        // Avoid repeated requests for nearly identical coordinates
        if (lastSettledCoordsRef.current) {
          const dist = Math.hypot(
            lat - lastSettledCoordsRef.current.lat,
            lng - lastSettledCoordsRef.current.lng
          );
          if (dist < minDistance) {
            return;
          }
        }

        lastSettledCoordsRef.current = { lat, lng };
        onHoverSettle?.(lat, lng);
      }, debounceMs);
    };

    // 3. Listen to click event for instant location/weather details on click
    const handleClick = (e) => {
      if (!e || !e.latlng) return;
      const { lat, lng } = e.latlng;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      onHoverMove?.(lat, lng);
      lastSettledCoordsRef.current = { lat, lng };
      onHoverSettle?.(lat, lng);
    };

    const handleMouseOut = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };

    map.on("mousemove", handleMouseMove);
    map.on("click", handleClick);
    map.on("mouseout", handleMouseOut);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("click", handleClick);
      map.off("mouseout", handleMouseOut);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [map, onHoverMove, onHoverSettle, debounceMs, minDistance]);

  return null;
}

/**
 * MapResizeHandler:
 * Solves the Leaflet container sizing root cause where Leaflet measures its
 * internal pixel bounds before the parent CSS Grid (.dashboard-shell) and
 * responsive layout finish settling. Without invalidateSize(), Leaflet caches
 * the initial partial dimensions and only renders tiles for that partial area.
 *
 * Uses ResizeObserver on the container and staggered invalidateSize() calls
 * to ensure the map dynamically fills 100% of the container at all times.
 */
function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Immediate size invalidation
    map.invalidateSize({ animate: false });

    // Staggered invalidations for layout passes, fonts, and async parent card sizing
    const frameId = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });

    const timers = [
      setTimeout(() => map.invalidateSize({ animate: false }), 50),
      setTimeout(() => map.invalidateSize({ animate: false }), 150),
      setTimeout(() => map.invalidateSize({ animate: false }), 300),
      setTimeout(() => map.invalidateSize({ animate: false }), 600),
      setTimeout(() => map.invalidateSize({ animate: false }), 1000),
    ];

    const container = map.getContainer();
    let resizeObserver = null;
    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      resizeObserver.observe(container);
    }

    const handleWindowResize = () => {
      map.invalidateSize({ animate: false });
    };
    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("orientationchange", handleWindowResize);

    return () => {
      cancelAnimationFrame(frameId);
      timers.forEach(clearTimeout);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("orientationchange", handleWindowResize);
    };
  }, [map]);

  return null;
}

// Default geographic center covering all of India & South India
const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

function HeatMap({
  weather,
  currentHeatRisk,
  mapLocation,
  onHoverLocationChange,
  onCenterChange,
  loading = false,
  title = "🗺️ Interactive Live Weather Map",
  subtitle = "Hover mouse cursor over any location on the map. Coordinates are detected automatically to update live weather and temperature.",
}) {
  const triggerLocationChange = onHoverLocationChange || onCenterChange;

  const hasWeatherLocation = weather?.lat != null && weather?.lon != null;
  const initialLat = hasWeatherLocation ? weather.lat : (mapLocation?.lat ?? 13.0827);
  const initialLon = hasWeatherLocation ? weather.lon : (mapLocation?.lon ?? 80.2707);

  const [hoverCoords, setHoverCoords] = useState({ lat: initialLat, lon: initialLon });
  const [isHovering, setIsHovering] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Sync coords when external weather updates if not actively hovering
  useEffect(() => {
    let isMounted = true;
    const syncCoords = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      if (weather?.lat != null && weather?.lon != null && !isHovering && !isDebouncing) {
        setHoverCoords({ lat: weather.lat, lon: weather.lon });
      }
    };
    syncCoords();
    return () => {
      isMounted = false;
    };
  }, [weather?.lat, weather?.lon, isHovering, isDebouncing]);

  const handleHoverMove = useCallback((lat, lon) => {
    setIsHovering(true);
    setIsDebouncing(true);
    setHoverCoords({ lat, lon });
  }, []);

  const handleHoverSettle = useCallback((lat, lon) => {
    setIsHovering(false);
    setIsDebouncing(false);
    setHoverCoords({ lat, lon });
    if (triggerLocationChange) {
      triggerLocationChange(lat, lon);
    }
  }, [triggerLocationChange]);

  const position = hasWeatherLocation
    ? [weather.lat, weather.lon]
    : mapLocation
      ? [mapLocation.lat, mapLocation.lon]
      : null;
  const icon = position ? makeIcon(getRiskColor(currentHeatRisk?.level)) : null;
  const markerLabel = weather?.city || mapLocation?.label || "Selected Location";

  return (
    <div className="card heat-map-card">
      <style>{`
        .heat-map-card {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .heat-map-container-wrapper {
          position: relative !important;
          width: 100% !important;
          height: 500px !important;
          min-height: 440px !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          display: block !important;
          box-sizing: border-box !important;
        }

        .heat-map-container-wrapper .leaflet-container {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          max-width: 100% !important;
          display: block !important;
          overflow: hidden !important;
          cursor: default !important;
          background-color: var(--surface-alt, #f1f5f9) !important;
        }

        .heat-map-container-wrapper,
        .heat-map-container-wrapper .leaflet-container,
        .heat-map-container-wrapper .leaflet-pane,
        .heat-map-container-wrapper .leaflet-tile-pane,
        .heat-map-container-wrapper .leaflet-tile,
        .heat-map-container-wrapper .leaflet-marker-pane,
        .heat-map-container-wrapper .leaflet-grab,
        .heat-map-container-wrapper .leaflet-touch-drag {
          cursor: default !important;
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {weather?.city && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            <span>📍</span>
            <span>{weather.city}</span>
            {weather.temperature != null && (
              <span style={{ color: "var(--primary)", fontWeight: "700" }}>{weather.temperature}°C</span>
            )}
          </div>
        )}
      </div>

      <div
        className="heat-map-container-wrapper"
        style={{
          position: "relative",
          height: "500px",
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "inset 0 0 10px rgba(0,0,0,0.08)",
          cursor: "default",
        }}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={2}
          maxZoom={18}
          zoomSnap={0.5}
          zoomControl={true}
          dragging={true}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          touchZoom={true}
          boxZoom={false}
          keyboard={true}
          style={{ height: "100%", width: "100%", cursor: "default" }}
        >
          <MapResizeHandler />

          <TileLayer
            attribution="Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom"
            url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            minZoom={2}
            maxZoom={18}
          />

          <MapHoverTracker
            onHoverMove={handleHoverMove}
            onHoverSettle={handleHoverSettle}
            debounceMs={700}
            minDistance={0.05}
          />

          {position && (
            <Marker
              position={position}
              icon={icon}
              draggable={false}
              interactive={true}
              eventHandlers={{
                click: (e) => {
                  if (e?.latlng) {
                    handleHoverSettle(e.latlng.lat, e.latlng.lng);
                  }
                },
              }}
            >
              <Popup>
                <strong>{markerLabel}</strong>
                {weather ? (
                  <>
                    <br />
                    🌡 Temperature: {weather.temperature}°C<br />
                    💧 Humidity: {weather.humidity}%<br />
                    🔥 Heat Risk: {currentHeatRisk?.level || "Not available"}
                  </>
                ) : null}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* ── FLOATING HOVER HUD BADGE ── */}
        <div
          className="map-hover-hud-badge"
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            pointerEvents: "none",
            background: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(8px)",
            color: "#ffffff",
            padding: "8px 18px",
            borderRadius: "30px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: "600",
            border: "1px solid rgba(255,255,255,0.18)",
            maxWidth: "92%",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              background: isHovering || isDebouncing || loading ? "#f59e0b" : "#22c55e",
              boxShadow: isHovering || isDebouncing || loading
                ? "0 0 10px #f59e0b"
                : "0 0 8px #22c55e",
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {isHovering
              ? `Cursor: ${hoverCoords.lat.toFixed(4)}°, ${hoverCoords.lon.toFixed(4)}°`
              : isDebouncing || loading
              ? `Detecting weather (${hoverCoords.lat.toFixed(4)}°, ${hoverCoords.lon.toFixed(4)}°)...`
              : `${weather?.city || markerLabel}: ${hoverCoords.lat.toFixed(4)}°, ${hoverCoords.lon.toFixed(4)}°`}
          </span>
          {weather?.temperature != null && !isHovering && !isDebouncing && !loading && (
            <span
              style={{
                background: "rgba(255,255,255,0.18)",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: "700",
              }}
            >
              {weather.temperature}°C
            </span>
          )}
        </div>

        {/* ── BOTTOM HELPER INSTRUCTION ── */}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            pointerEvents: "none",
            background: "rgba(15, 23, 42, 0.78)",
            backdropFilter: "blur(6px)",
            color: "#e2e8f0",
            padding: "5px 16px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: "500",
            border: "1px solid rgba(255,255,255,0.12)",
            letterSpacing: "0.2px",
          }}
        >
          🖱️ Hover mouse cursor over any map location to detect coordinates and live weather
        </div>
      </div>
    </div>
  );
}

export default HeatMap;
