import { useState } from "react";

export default function DetectLocation({ onCityWeather, onCitySelected, onCityError, onFillForm }) {
  const [loading, setLoading] = useState(false);

  const detect = () => {
    if (!navigator.geolocation) {
      onCityError("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    onCityError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;

          // Reverse geocode using Nominatim
          const geoResp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const geoData = await geoResp.json();
          const addr    = geoData.address || {};
          const city    = addr.city || addr.town || addr.village || addr.county;

          if (!city) throw new Error("Could not determine city from location.");

          // Fetch weather for detected city
          const wxResp = await fetch(
            `http://127.0.0.1:5000/weather?city=${encodeURIComponent(city)}`
          );
          const wxData = await wxResp.json();
          if (!wxResp.ok) throw new Error(wxData.error || "Unable to fetch weather.");

          onCityWeather(wxData);
          onCitySelected?.(wxData.city || "");
          onFillForm({
            temperature: String(wxData.temperature ?? ""),
            humidity:    String(wxData.humidity    ?? ""),
            rainfall:    String(wxData.rainfall    ?? ""),
            wind_speed:  String(wxData.wind_speed  ?? ""),
          });
          onCityError("");
        } catch (err) {
          onCityError(err.message || "Unable to detect location.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          onCityError("Location access denied.");
        } else {
          onCityError("Unable to detect location.");
        }
      },
      { timeout: 10000 }
    );
  };

  return (
    <button className="detect-location-btn" onClick={detect} disabled={loading}>
      {loading ? "⏳ Detecting…" : "📍 Detect My Location"}
    </button>
  );
}
