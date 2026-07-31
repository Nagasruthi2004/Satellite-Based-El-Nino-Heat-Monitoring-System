import { useEffect } from "react";
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

function FlyToMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 10, { duration: 1.4 });
  }, [position, map]);
  return null;
}

function HeatMap({ weather }) {
  const hasLocation = weather?.lat != null && weather?.lon != null;
  const position    = hasLocation ? [weather.lat, weather.lon] : null;
  const icon        = position ? makeIcon(getRiskColor(weather.heat_risk)) : null;

  return (
    <div className="card">
      <h2>🗺️ Interactive Heat Map</h2>
      <div style={{ height: "450px", width: "100%", borderRadius: "10px", overflow: "hidden" }}>
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {position && (
            <>
              <FlyToMarker position={position} />
              <Marker position={position} icon={icon}>
                <Popup>
                  <strong>{weather.city}</strong><br />
                  🌡 Temperature: {weather.temperature}°C<br />
                  🔥 Heat Risk: {weather.heat_risk}
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default HeatMap;
