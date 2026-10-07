import SatelliteTimeMachine from "./components/SatelliteTimeMachine";
import ElNinoAnalyzer from "./components/ElNinoAnalyzer";
import SatelliteChangeDetector from "./components/SatelliteChangeDetector";
import FavouriteCities from "./components/FavouriteCities";
import HeatRecommendation from "./components/HeatRecommendation";
import ElNinoNewsMonitor from "./components/ElNinoNewsMonitor";
import SatelliteImageHeatAnalysis from "./components/SatelliteImageHeatAnalysis";
import "./App.css";
import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "./components/Navbar";
import TemperatureCard from "./components/TemperatureCard";
import HumidityCard from "./components/HumidityCard";
import RainfallCard from "./components/RainfallCard";
import WindSpeedCard from "./components/WindSpeedCard";
import HeatRiskCard from "./components/HeatRiskCard";
import ElNinoCard from "./components/ElNinoCard";
import LSTCard from "./components/LSTCard";
import HeatIntensityCard from "./components/HeatIntensityCard";
import ThermalAnomalyCard from "./components/ThermalAnomalyCard";
import HeatMap from "./components/HeatMap";
import CompareCities from "./components/CompareCities";
import HeatAlert from "./components/HeatAlert";
import AIClimateReport from "./components/AIClimateReport";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import FutureCitySimulator from "./components/FutureCitySimulator";
import HeatPreparednessScore from "./components/HeatPreparednessScore";
import HeatHotspotRanking from "./components/HeatHotspotRanking";
import AIChatbot from "./components/AIChatbot";
import SmartAwareness from "./components/SmartAwareness";
import DisasterInformation from "./components/DisasterInformation";
import IndiaLSTMap from "./components/IndiaLSTMap";
import HeatAnalysis from "./components/HeatAnalysis";
import Heat2026Prediction from "./components/Heat2026Prediction";
import HomeDashboard from "./components/HomeDashboard";
import Footer from "./components/Footer";
import DashboardNavigation from "./components/DashboardNavigation";
import { calculateElNinoImpact, getLatestOniData } from "./data/oniData";
import { getDeterministicSatelliteFallback } from "./data/satelliteData";
import { formatWindSpeedKmh } from "./utils/wind";
import { formatTemperature } from "./utils/temperature";
import { getHeatRiskExplanation } from "./utils/heatRisk";

const getSystemTheme = () => window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const getStoredTheme = () => localStorage.getItem("el-nino-theme");

const NAVIGATION_GROUPS = [
  {
    title: "OVERVIEW",
    items: [
      { id: "home", label: "Home", icon: "🏠" },
      { id: "live", label: "Live Weather", icon: "📊" },
      { id: "india-lst", label: "India LST Heat Map", icon: "🗺️" },
    ],
  },
  {
    title: "ANALYSIS",
    items: [
      { id: "heat-analysis", label: "Heat Analysis", icon: "📈" },
      { id: "elnino", label: "Historical El Niño Cycle", icon: "🔄" },
      { id: "heat-2026", label: "2026 Heat Prediction", icon: "🔮" },
      { id: "elnino-news", label: "El Niño News Monitor", icon: "📰" },
    ],
  },
  {
    title: "AI & HEAT TOOLS",
    items: [
      { id: "analytics", label: "Heat Risk Prediction", icon: "🎯" },
      { id: "assistant", label: "AI Heatwave Assistant", icon: "🤖" },
      { id: "simulator", label: "Future City Simulator", icon: "🏙️" },
      { id: "preparedness", label: "Heat Preparedness Score", icon: "🛡️" },
      { id: "hotspots", label: "Heat Hotspot Ranking", icon: "🔥" },
      { id: "climate-report", label: "AI Climate Report", icon: "📄" },
      { id: "compare", label: "Compare Cities", icon: "⚖️" },
      { id: "favourites", label: "Favourite Cities", icon: "⭐" },
    ],
  },
  {
    title: "SAFETY",
    items: [
      { id: "smart-awareness", label: "Smart Awareness", icon: "💡" },
      { id: "disaster-info", label: "Disaster Information", icon: "🚨" },
    ],
  },
  {
    title: "SATELLITE",
    items: [
      { id: "satellite-monitor", label: "Satellite Monitoring", icon: "🛰️" },
      { id: "satellite-image-heat-analysis", label: "Satellite Image Heat Analysis", icon: "📡" },
      { id: "change-detector", label: "Satellite Change Detection", icon: "🪐" },
      { id: "time-machine", label: "Satellite Time Machine", icon: "⏱️" },
    ],
  },
];

const DASHBOARD_PAGES = NAVIGATION_GROUPS.flatMap((group) => group.items);

const getPageFromHash = () => {
  const page = window.location.hash.replace(/^#/, "");
  if (!page || page === "home") return "home";
  if (page === "satellite" || page === "satellite-monitor") return "satellite-monitor";
  if (page === "satellite-image-heat-analysis" || page === "satellite-image-analysis") return "satellite-image-heat-analysis";
  return DASHBOARD_PAGES.some((item) => item.id === page) ? page : "home";
};

function App() {
  const [theme, setTheme] = useState(() => getStoredTheme() || getSystemTheme());
  const [activePage, setActivePage] = useState(getPageFromHash);
  const pageContentRef = useRef(null);
  const [hasSelectedTheme, setHasSelectedTheme] = useState(() => Boolean(getStoredTheme()));
  const [weather, setWeather] = useState(null);
  const [satelliteCity, setSatelliteCity] = useState("");
  const [mapLocation, setMapLocation] = useState(null);
  const [liveMapSelection, setLiveMapSelection] = useState(null);
  const [liveLocation, setLiveLocation] = useState("Coimbatore, Tamil Nadu, India");
  const [satellite, setSatellite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [satelliteError, setSatelliteError] = useState("");
  const [predictionForm, setPredictionForm] = useState({
    temperature: "",
    humidity: "",
    rainfall: "",
    wind_speed: ""
  });
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");
  const [predictionLocation, setPredictionLocation] = useState(null);
  const [predictionWeather, setPredictionWeather] = useState(null);
  const [predictionWeatherLoading, setPredictionWeatherLoading] = useState(false);
  const [predictionWeatherError, setPredictionWeatherError] = useState("");
  const predictionLocationRequestIdRef = useRef(0);
  const predictionRequestIdRef = useRef(0);
  const [simulatorValues, setSimulatorValues] = useState({ treeCover: 50, waterBodies: 50 });
  const latestOniData = getLatestOniData();
  const elNinoImpact = calculateElNinoImpact(latestOniData.oni, weather, satellite);
  const currentHeatRisk = weather?.current_heat_risk || null;

  const fetchWeatherForCity = useCallback(async (city = "", cityCandidates = [], locationDetails = {}) => {
    const normalizedCity = (city || "").trim();
    if (normalizedCity) setLiveMapSelection(null);
    if (!normalizedCity && (locationDetails.latitude == null || locationDetails.longitude == null)) {
      return null;
    }

    try {
      setLoading(true);
      setWeather(null);
      setSatellite(null);
      setSatelliteError("");
      const params = new URLSearchParams();
      if (normalizedCity) {
        params.set("city", normalizedCity);
      }
      (cityCandidates || []).filter(Boolean).forEach((candidate) => params.append("city_candidates", candidate));
      if (locationDetails.latitude != null) params.set("latitude", locationDetails.latitude);
      if (locationDetails.longitude != null) params.set("longitude", locationDetails.longitude);
      if (locationDetails.detailedLocation) params.set("detailed_location", locationDetails.detailedLocation);
      const response = await fetch(`http://127.0.0.1:5000/weather?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to fetch weather data");
      setWeather(data);
      setWeatherError("");
      return data;
    } catch (error) {
      setWeather(null);
      setSatellite(null);
      setSatelliteError("");
      setWeatherError("Unable to fetch weather data for this location.");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const syncPageFromHash = () => setActivePage(getPageFromHash());
    window.addEventListener("hashchange", syncPageFromHash);
    return () => window.removeEventListener("hashchange", syncPageFromHash);
  }, []);

  useEffect(() => {
    pageContentRef.current?.scrollTo(0, 0);
  }, [activePage]);

  const navigateToPage = (page) => {
    if (window.location.hash === `#${page}`) {
      setActivePage(page);
      return;
    }
    window.location.hash = page;
  };

  useEffect(() => {
    if (hasSelectedTheme) localStorage.setItem("el-nino-theme", theme);
  }, [hasSelectedTheme, theme]);

  useEffect(() => {
    if (hasSelectedTheme) return undefined;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = (event) => setTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", syncTheme);
    return () => mediaQuery.removeEventListener("change", syncTheme);
  }, [hasSelectedTheme]);

  const reverseGeocodeLocation = useCallback(async (latitude, longitude) => {
    console.info("Reverse geocoding location", { latitude, longitude });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
      headers: { "Accept-Language": "en" },
    });
    if (!response.ok) throw new Error("Reverse geocoding failed");
    const data = await response.json();
    return data.address || {};
  }, []);

  const determineLocationLabel = useCallback((address) => {
    const locality = address.neighbourhood || address.suburb || address.locality || address.quarter || address.hamlet;
    const cityCandidates = [
      address.city,
      address.town,
      address.municipality,
      address.city_district,
      address.state_district,
      address.county,
      address.village,
    ].filter((name, index, names) => (
      name && !/^ward\b/i.test(name.trim()) && names.indexOf(name) === index
    ));
    const displayCity = cityCandidates[0] || "";
    const region = address.state || address.state_district || address.region;
    const country = address.country;
    const location = [...new Set([locality, displayCity, region, country].filter(Boolean))].join(", ");

    return {
      location,
      cityCandidates,
    };
  }, []);

  const weatherRequestIdRef = useRef(0);

  const handleHoverLocationChange = useCallback(async (latitude, longitude) => {
    const reqId = ++weatherRequestIdRef.current;
    setLiveMapSelection(null);
    try {
      setWeatherError("");
      let locationLabel = "";
      let cityCandidates = [];

      try {
        const address = await reverseGeocodeLocation(latitude, longitude);
        const resolved = determineLocationLabel(address);
        locationLabel = resolved.location;
        cityCandidates = resolved.cityCandidates;
      } catch (geoErr) {
        console.warn("Reverse geocoding failed or rate limited:", geoErr);
      }

      // Check if a newer hover event was already triggered
      if (reqId !== weatherRequestIdRef.current) return;

      const primaryCity = cityCandidates[0] || "";
      const displayLocation = locationLabel || (primaryCity ? `${primaryCity} (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)` : `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`);

      if (primaryCity) {
        setSatelliteCity(primaryCity);
      }

      const weatherData = await fetchWeatherForCity(primaryCity, cityCandidates, {
        latitude,
        longitude,
        detailedLocation: displayLocation,
      });

      // Discard stale responses if mouse moved again
      if (reqId !== weatherRequestIdRef.current) return;

      if (weatherData?.city) {
        setSatelliteCity(weatherData.city);
      }
    } catch (err) {
      console.error("Failed to fetch weather for hover location:", err);
    }
  }, [fetchWeatherForCity, reverseGeocodeLocation, determineLocationLabel]);

  const handleMapClickLocation = useCallback(async (latitude, longitude) => {
    const reqId = ++weatherRequestIdRef.current;
    const detailedLocation = `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
    setLiveMapSelection({ lat: latitude, lon: longitude });
    setWeatherError("");

    try {
      const weatherData = await fetchWeatherForCity("", [], {
        latitude,
        longitude,
        detailedLocation,
      });
      if (reqId !== weatherRequestIdRef.current) return;
      if (weatherData?.city) setSatelliteCity(weatherData.city);
    } catch (err) {
      if (reqId === weatherRequestIdRef.current) {
        console.error("Failed to fetch weather for clicked map location:", err);
      }
    }
  }, [fetchWeatherForCity]);

  const recenterToUserLocation = useCallback(() => {
    setLiveLocation("Coimbatore, Tamil Nadu, India");
    setMapLocation({ lat: 11.0168, lon: 76.9558, label: "Coimbatore" });
    fetchWeatherForCity("Coimbatore").catch(() => {});
  }, [fetchWeatherForCity]);

  useEffect(() => {
    let isMounted = true;
    const initLocation = async () => {
      await Promise.resolve();
      if (isMounted) {
        recenterToUserLocation();
      }
    };
    initLocation();
    return () => {
      isMounted = false;
    };
  }, [recenterToUserLocation]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchSatelliteData = async () => {
      await Promise.resolve();
      if (!isMounted) return;

      if (!weather?.city) {
        setSatellite(null);
        setSatelliteError("");
        return;
      }

      const fallback = getDeterministicSatelliteFallback(weather.city, weather);
      try {
        if (fallback && isMounted) setSatellite(fallback);
        const params = new URLSearchParams({
          city: weather.city,
          temperature: weather.temperature ?? "",
          humidity: weather.humidity ?? "",
          rainfall: weather.rainfall ?? "",
          wind_speed: weather.wind_speed ?? "",
          heat_risk: weather.heat_risk ?? "",
        });
        const response = await fetch(`http://127.0.0.1:5000/satellite?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to fetch satellite data");
        const data = await response.json();
        if (isMounted) {
          setSatellite(data);
          setSatelliteError("");
        }
      } catch (error) {
        if (error.name === "AbortError" || !isMounted) return;
        if (fallback) {
          setSatellite(fallback);
          setSatelliteError("");
          return;
        }
        setSatellite(null);
        setSatelliteError("Unable to fetch satellite data");
      }
    };

    fetchSatelliteData();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [weather]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setPredictionForm((current) => ({ ...current, [name]: value }));
  };

  const getPredictionPayload = (weatherData) => {
    const values = [
      weatherData?.temperature,
      weatherData?.humidity,
      weatherData?.rainfall,
      weatherData?.wind_speed,
    ];
    if (values.some((value) => value == null || value === "" || !Number.isFinite(Number(value)))) return null;

    return {
      temperature: Number(weatherData.temperature),
      humidity: Number(weatherData.humidity),
      rainfall: Number(weatherData.rainfall),
      wind_speed: Number(formatWindSpeedKmh(weatherData.wind_speed)),
    };
  };

  useEffect(() => {
    if (!weather) return;
    const payload = getPredictionPayload(weather);
    setPredictionResult(null);
    setPredictionError("");

    if (payload) {
      setPredictionForm({
        temperature: String(payload.temperature ?? ""),
        humidity: String(payload.humidity ?? ""),
        rainfall: String(payload.rainfall ?? ""),
        wind_speed: String(payload.wind_speed ?? ""),
      });
    }
  }, [weather]);

  const handlePredictionLocationClick = useCallback(async (latitude, longitude) => {
    const requestId = ++predictionLocationRequestIdRef.current;
    predictionRequestIdRef.current += 1;
    setPredictionLocation({ lat: latitude, lon: longitude });
    setPredictionWeather(null);
    setPredictionWeatherLoading(true);
    setPredictionWeatherError("");
    setPredictionForm({ temperature: "", humidity: "", rainfall: "", wind_speed: "" });
    setPredictionResult(null);
    setPredictionError("");
    setPredictionLoading(false);

    try {
      const locationWeather = await fetchWeatherForCity("", [], {
        latitude,
        longitude,
        detailedLocation: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
      });
      if (requestId !== predictionLocationRequestIdRef.current) return;
      const payload = getPredictionPayload(locationWeather);
      if (!payload) {
        throw new Error("Weather data is incomplete for the selected coordinates.");
      }
      setPredictionWeather(locationWeather);
      setPredictionForm({
        temperature: String(payload.temperature),
        humidity: String(payload.humidity),
        rainfall: String(payload.rainfall),
        wind_speed: String(payload.wind_speed),
      });
    } catch (error) {
      if (requestId === predictionLocationRequestIdRef.current) {
        setPredictionWeatherError(error.message || "Unable to fetch weather for the selected location.");
      }
    } finally {
      if (requestId === predictionLocationRequestIdRef.current) {
        setPredictionWeatherLoading(false);
      }
    }
  }, [fetchWeatherForCity]);

  const handlePredict = async (event) => {
    event.preventDefault();
    if (!predictionLocation || !predictionWeather || predictionWeatherLoading) return;
    const requestId = ++predictionRequestIdRef.current;
    setPredictionLoading(true);
    setPredictionError("");
    setPredictionResult(null);

    try {
      const tempNum = Number(predictionForm.temperature);
      const humidNum = Number(predictionForm.humidity);
      const rainNum = Number(predictionForm.rainfall);
      const windNum = Number(predictionForm.wind_speed);

      if (!Number.isFinite(tempNum) || !Number.isFinite(humidNum) || !Number.isFinite(rainNum) || !Number.isFinite(windNum)) {
        throw new Error("Please enter valid numeric values for all meteorological fields.");
      }

      if (humidNum < 0 || humidNum > 100) {
        throw new Error("Humidity must be between 0% and 100%.");
      }
      if (rainNum < 0) {
        throw new Error("Rainfall cannot be a negative value.");
      }
      if (windNum < 0) {
        throw new Error("Wind speed cannot be a negative value.");
      }

      const payload = {
        temperature: tempNum,
        humidity: humidNum,
        rainfall: rainNum,
        wind_speed: windNum,
      };

      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data?.prediction?.heat_risk) {
        throw new Error(data?.error || "Heat risk prediction unavailable from ML model.");
      }
      if (requestId === predictionRequestIdRef.current) setPredictionResult(data);
    } catch (error) {
      if (requestId === predictionRequestIdRef.current) {
        setPredictionError(error.message || "Heat risk prediction unavailable");
      }
    } finally {
      if (requestId === predictionRequestIdRef.current) setPredictionLoading(false);
    }
  };

  const renderPredictionSection = () => {
    if (!predictionLocation) return null;
    const predictedRisk = predictionResult?.prediction?.heat_risk || null;
    const predictedConfidence = predictionResult?.prediction?.confidence;
    const riskStyleClass = predictedRisk ? predictedRisk.toLowerCase() : "";

    return (
      <section className="section">
        <h2 className="section-title">🤖 Heat Risk Prediction</h2>
        <div className="prediction-panel">
          <div className="prediction-panel-header">
            <div>
              <p className="eyebrow">Machine Learning Live Forecasting</p>
              <h2>Predict Heat Risk</h2>
              <p className="status-hint">
                Selected location: {predictionWeather?.city || "Map location"} ({predictionLocation.lat.toFixed(4)}°, {predictionLocation.lon.toFixed(4)}°)
              </p>
            </div>
            <div className="prediction-badge">Flask API • ML Model</div>
          </div>

          {predictionWeatherLoading && <p className="status-hint">Loading weather for the selected coordinates…</p>}
          {predictionWeatherError && <div className="prediction-error" role="alert">{predictionWeatherError}</div>}

          <form className="prediction-form" onSubmit={handlePredict}>
            <div className="input-grid">
              <label className="prediction-field">
                <span>Location / City</span>
                <input
                  type="text"
                  name="city"
                  value={predictionWeather?.city || `${predictionLocation.lat.toFixed(4)}°, ${predictionLocation.lon.toFixed(4)}°`}
                  readOnly
                  title="Weather location resolved from the selected map coordinates"
                  style={{ background: "var(--surface-alt)", cursor: "default" }}
                />
              </label>

              <label className="prediction-field">
                <span>Temperature (°C)</span>
                <input
                  type="number"
                  name="temperature"
                  value={predictionForm.temperature}
                  onChange={handleInputChange}
                  min="-50"
                  max="60"
                  step="any"
                  placeholder="e.g. 34.2"
                  required
                />
              </label>

              <label className="prediction-field">
                <span>Humidity (%)</span>
                <input
                  type="number"
                  name="humidity"
                  value={predictionForm.humidity}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="any"
                  placeholder="e.g. 52"
                  required
                />
              </label>

              <label className="prediction-field">
                <span>Rainfall (mm)</span>
                <input
                  type="number"
                  name="rainfall"
                  value={predictionForm.rainfall}
                  onChange={handleInputChange}
                  min="0"
                  step="any"
                  placeholder="e.g. 0.0"
                  required
                />
              </label>

              <label className="prediction-field">
                <span>Wind Speed (km/h)</span>
                <input
                  type="number"
                  name="wind_speed"
                  value={predictionForm.wind_speed}
                  onChange={handleInputChange}
                  min="0"
                  step="any"
                  placeholder="e.g. 14.5"
                  required
                />
              </label>

              <label className="prediction-field">
                <span>El Niño / ENSO Status</span>
                <input
                  type="text"
                  value={`${latestOniData?.status || "Neutral"} (ONI: ${latestOniData?.oni != null && latestOniData.oni > 0 ? "+" : ""}${latestOniData?.oni ?? "+0.3"}°C)`}
                  readOnly
                  title="NOAA Oceanic Niño Index condition"
                  style={{ background: "var(--surface-alt)", cursor: "default" }}
                />
              </label>
            </div>

            <button className="predict-button" type="submit" disabled={predictionLoading || predictionWeatherLoading || !predictionWeather}>
              {predictionLoading ? "Predicting Heat Risk..." : predictionWeatherLoading ? "Loading Selected Location..." : "Predict Heat Risk"}
            </button>
          </form>

          {predictionError && (
            <div className="prediction-error" style={{ marginTop: "16px" }} role="alert">
              ⚠️ {predictionError}
            </div>
          )}

          {/* STEP 3: RESULT SECTION IS INITIALLY HIDDEN — ONLY SHOWN AFTER PREDICTION */}
          {predictionResult && (
            <div className="prediction-result-wrapper" style={{ marginTop: "24px" }}>
              <div className={`prediction-result ${riskStyleClass}`}>
                <div className="result-top">
                  <div>
                    <p className="result-label">Predicted Heat Risk</p>
                    <h3>{predictedRisk}</h3>
                  </div>
                  <div className="confidence-pill">
                    {predictedConfidence != null ? `${predictedConfidence}% confidence` : "ML Model Estimate"}
                  </div>
                </div>

                <div
                  className="prediction-details-strip"
                  style={{
                    display: "flex",
                    gap: "16px",
                    marginTop: "12px",
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                    flexWrap: "wrap",
                    fontSize: "12.5px",
                    color: "inherit",
                  }}
                >
                  <span>📍 <strong>Location:</strong> {predictionWeather?.city || `${predictionLocation.lat.toFixed(4)}°, ${predictionLocation.lon.toFixed(4)}°`}</span>
                  <span>🌡️ <strong>Temp:</strong> {formatTemperature(predictionResult.input_parameters?.temperature)}</span>
                  <span>💧 <strong>Humidity:</strong> {predictionResult.input_parameters?.humidity}%</span>
                  <span>🌧️ <strong>Rainfall:</strong> {predictionResult.input_parameters?.rainfall} mm</span>
                  <span>💨 <strong>Wind:</strong> {predictionResult.input_parameters?.wind_speed} km/h</span>
                </div>

                <p style={{ marginTop: "12px", lineHeight: "1.5" }}>
                  {predictionResult.prediction?.explanation || getHeatRiskExplanation(predictedRisk, predictedConfidence)}
                </p>
              </div>

              <div style={{ marginTop: "16px" }}>
                <HeatRecommendation risk={predictedRisk} />
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <>
      <Navbar
        theme={theme}
        liveLocation={liveLocation}
        onToggleTheme={() => {
          setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark");
          setHasSelectedTheme(true);
        }}
      />

      {/* ── HERO ── */}
      <div className="dashboard-shell">
        <DashboardNavigation activePage={activePage} onNavigate={navigateToPage} groups={NAVIGATION_GROUPS} items={DASHBOARD_PAGES} />
        <main className="dashboard-page-content" ref={pageContentRef}>
        {activePage === "home" && (
          <section className="section" style={{ marginTop: "0.5rem" }}>
            <HomeDashboard
              weather={weather}
              currentHeatRisk={currentHeatRisk}
              latestOniData={latestOniData}
              loading={loading}
              onNavigate={navigateToPage}
            />
          </section>
        )}
      {activePage === "live" && <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-eyebrow">🛰️ Satellite-Powered Intelligence</span>
            <h1 className="hero-title">El Niño Heat Monitoring System</h1>
          </div>
          <div className="hero-search">
            <div className="card" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h2 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎯</span> Live Selected Location
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="live-dot" style={{ display: "inline-block" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>Live Map</span>
                </div>
              </div>

              <div className="search-result" style={{ marginTop: 0 }}>
                <div className="search-result-item">
                  <div className="sr-label">Place / City</div>
                  <div className="sr-value">{weather?.city || "Detecting location..."}</div>
                </div>
                <div className="search-result-item">
                  <div className="sr-label">Coordinates</div>
                  <div className="sr-value" style={{ fontSize: "13px" }}>
                    {liveMapSelection
                      ? `${liveMapSelection.lat.toFixed(4)}°, ${liveMapSelection.lon.toFixed(4)}°`
                      : weather?.lat != null && weather?.lon != null
                      ? `${weather.lat.toFixed(4)}°, ${weather.lon.toFixed(4)}°`
                      : "Center of map"}
                  </div>
                </div>
                <div className="search-result-item">
                  <div className="sr-label">Temperature</div>
                  <div className="sr-value">{weather?.temperature != null ? formatTemperature(weather.temperature) : (loading ? "Loading..." : "—")}</div>
                </div>
                <div className="search-result-item">
                  <div className="sr-label">Heat Risk</div>
                  <div className="sr-value" style={{ color: currentHeatRisk?.level === "High" || currentHeatRisk?.level === "Critical" ? "var(--danger)" : "inherit" }}>
                    {currentHeatRisk?.level || "Calculating..."}
                  </div>
                </div>
                <div className="search-result-item">
                  <div className="sr-label">Condition</div>
                  <div className="sr-value">{weather?.weather_description || "—"}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: "8px" }}>
                <button
                  type="button"
                  onClick={recenterToUserLocation}
                  style={{
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    borderRadius: "20px",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600",
                    padding: "6px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  title="Recenter map to my GPS location"
                >
                  <span>📍</span> Locate Me
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>}

      <div className="App">
        {activePage === "live" && <>

        {/* ── LIVE MAP HOVER LOCATION DETECTOR ── */}
        <section className="section">
          <HeatMap
            weather={weather}
            currentHeatRisk={currentHeatRisk}
            mapLocation={mapLocation}
            selectedCoordinates={liveMapSelection}
            onHoverLocationChange={handleHoverLocationChange}
            onMapClick={handleMapClickLocation}
            loading={loading}
            title="🗺️ Interactive Live Weather Map"
          />
        </section>

        {/* ── DASHBOARD ── */}
        <section className="section">
          <h2 className="section-title">📊 Live Weather Dashboard</h2>
          {(weatherError || satelliteError) && (
            <div className="prediction-error" style={{ marginBottom: "16px" }}>
              {weatherError || satelliteError}
            </div>
          )}
          <div className="dashboard">
            <TemperatureCard
              temperature={loading ? "Loading..." : weather?.temperature}
              weatherDescription={weather?.weather_description || weather?.description}
              errorMessage={weatherError}
            />
            <ElNinoCard
              elNinoStatus={loading ? "Loading..." : latestOniData.status}
              oni={latestOniData.oni}
              strength={latestOniData.strength}
              influence={elNinoImpact.influence}
              impactScore={elNinoImpact.impactScore}
            />
            <HumidityCard humidity={loading ? "Loading..." : weather?.humidity} errorMessage={weatherError} />
            <RainfallCard rainfall={loading ? "Loading..." : weather?.rainfall} />
            <WindSpeedCard windSpeed={loading ? "Loading..." : weather?.wind_speed} errorMessage={weatherError} />
            <HeatRiskCard heatRisk={loading ? "Loading..." : currentHeatRisk} />
            <HeatAlert
              heatRisk={loading ? "Loading..." : currentHeatRisk}
              temperature={weather?.temperature}
              landSurfaceTemperature={satellite?.land_surface_temperature}
            />
            <LSTCard lst={loading ? "Loading..." : satellite?.land_surface_temperature} />
          </div>
        </section>

        </>}

        {/* ── SMART HEAT AWARENESS ── */}
        {activePage === "smart-awareness" && (
          <section className="section">
            <SmartAwareness
              weather={weather}
              currentHeatRisk={currentHeatRisk}
              predictionResult={predictionResult}
              loading={loading}
              onRefresh={() => fetchWeatherForCity(weather?.city || "Coimbatore")}
            />
          </section>
        )}

        {/* ── DISASTER INFORMATION ── */}
        {activePage === "disaster-info" && (
          <section className="section">
            <DisasterInformation
              currentHeatRisk={currentHeatRisk}
              weather={weather}
            />
          </section>
        )}

        {/* ── INDIA LST HEAT MAP & YEAR SELECTOR ── */}
        {activePage === "india-lst" && (
          <section className="section">
            <IndiaLSTMap />
          </section>
        )}

        {/* ── HEAT ANALYSIS MODULE ── */}
        {activePage === "heat-analysis" && (
          <section className="section">
            <HeatAnalysis />
          </section>
        )}

        {/* ── 2026 HEAT PREDICTION MODULE ── */}
        {activePage === "heat-2026" && (
          <section className="section">
            <Heat2026Prediction />
          </section>
        )}

        {/* ── SATELLITE IMAGE HEAT ANALYSIS ── */}
        {activePage === "satellite-image-heat-analysis" && (
          <section className="section">
            <SatelliteImageHeatAnalysis />
          </section>
        )}

        {/* ── HEAT RISK PREDICTION ── */}
        {activePage === "analytics" && <>
        <section className="section">
          <HeatMap
            weather={predictionWeather}
            currentHeatRisk={predictionWeather?.current_heat_risk}
            selectedCoordinates={predictionLocation}
            onMapClick={handlePredictionLocationClick}
            loading={predictionWeatherLoading}
            requireLocationSelection
            title="Select a Location for Heat Risk Prediction"
            subtitle="Click a point on the map to load its weather and enable prediction."
          />
        </section>
        {renderPredictionSection()}

        {/* ── ANALYTICS DASHBOARD ── */}
        <section className="section">
          <AnalyticsDashboard weather={weather} currentHeatRisk={currentHeatRisk} />
        </section>
        </>}

        {activePage === "simulator" && <section className="section">
          <FutureCitySimulator currentTemperature={weather?.temperature} onValuesChange={setSimulatorValues} />
        </section>}

        {activePage === "preparedness" && <section className="section">
          <HeatPreparednessScore heatRisk={currentHeatRisk} simulatorValues={simulatorValues} />
        </section>}

        {activePage === "hotspots" && <section className="section">
          <HeatHotspotRanking city={weather?.city} currentTemperature={weather?.temperature} />
        </section>}

        {/* ── SATELLITE MONITORING ── */}
        {activePage === "satellite-monitor" && (
          <section className="section">
            <div className="section-header-compact" style={{ marginBottom: "20px" }}>
              <h2 className="section-title">🛰️ Satellite Thermal & LST Telemetry</h2>
              <p className="section-subtitle" style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                Orbital Land Surface Temperature (LST), thermal anomaly detection, and heat intensity telemetry derived from satellite observations.
              </p>
            </div>
            {(weatherError || satelliteError) && (
              <div className="prediction-error" style={{ marginBottom: "16px" }}>
                {weatherError || satelliteError}
              </div>
            )}
            <div className="dashboard" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <LSTCard lst={loading ? "Loading..." : satellite?.land_surface_temperature} />
              <HeatIntensityCard heatIntensity={loading ? "Loading..." : satellite?.heat_intensity_level} />
              <ThermalAnomalyCard thermalAnomaly={loading ? "Loading..." : satellite?.thermal_anomaly} />
              <HeatAlert
                heatRisk={loading ? "Loading..." : currentHeatRisk}
                temperature={weather?.temperature}
                landSurfaceTemperature={satellite?.land_surface_temperature}
                thermalAnomaly={satellite?.thermal_anomaly}
              />
            </div>
            <div className="card" style={{ marginTop: "24px" }}>
              <h3 style={{ marginTop: 0 }}>🛰️ Scientific Data Telemetry</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6" }}>
                Thermal infrared channels observe radiative skin temperature (Land Surface Temperature).
                Note that LST represents surface skin temperature and differs systematically from 2-meter ambient air temperature.
              </p>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="predict-button"
                  style={{ width: "auto", padding: "8px 18px", fontSize: "14px" }}
                  onClick={() => navigateToPage("change-detector")}
                >
                  🪐 Satellite Change Detection
                </button>
                <button
                  type="button"
                  className="predict-button"
                  style={{ width: "auto", padding: "8px 18px", fontSize: "14px" }}
                  onClick={() => navigateToPage("time-machine")}
                >
                  ⏱️ Satellite Time Machine
                </button>
                <button
                  type="button"
                  className="predict-button"
                  style={{ width: "auto", padding: "8px 18px", fontSize: "14px" }}
                  onClick={() => navigateToPage("satellite-image-heat-analysis")}
                >
                  📡 Satellite Image Heat Analysis
                </button>
                <button
                  type="button"
                  className="predict-button"
                  style={{ width: "auto", padding: "8px 18px", fontSize: "14px" }}
                  onClick={() => navigateToPage("india-lst")}
                >
                  🗺️ India LST Heat Map (2020–2025)
                </button>
              </div>
            </div>
          </section>
        )}

        {activePage === "time-machine" && <section className="section">
          <h2 className="section-title">🛰 Satellite Time Machine</h2>
          <SatelliteTimeMachine
            city={satelliteCity || weather?.city}
            latitude={weather?.lat}
            longitude={weather?.lon}
            currentHeatRisk={currentHeatRisk}
          />
        </section>}

        {activePage === "change-detector" && <section className="section">
          <SatelliteChangeDetector city={satelliteCity || weather?.city} />
        </section>}

        {activePage === "elnino" && <section className="section">
          <ElNinoAnalyzer weather={weather} predictionResult={predictionResult} currentHeatRisk={currentHeatRisk} />
        </section>}

        {activePage === "climate-report" && <section className="section">
          <AIClimateReport
            weather={weather}
            currentHeatRisk={currentHeatRisk}
            elNinoData={{
              status: latestOniData.status,
              oni: latestOniData.oni,
              strength: latestOniData.strength,
              influence: elNinoImpact.influence,
              impactScore: elNinoImpact.impactScore,
            }}
            satellite={satellite}
            predictionResult={predictionResult}
            simulatorValues={simulatorValues}
          />
        </section>}

        {/* ── AI HEATWAVE ASSISTANT ── */}
        {activePage === "assistant" && <section className="section">
          <AIChatbot weather={weather} currentHeatRisk={currentHeatRisk} />
        </section>}

        {/* ── COMPARE CITIES ── */}
        {activePage === "compare" && <section className="section">
          <h2 className="section-title">🏙️ Compare Cities</h2>
          <CompareCities />
        </section>}

        {/* ── FAVOURITE CITIES ── */}
{activePage === "favourites" && <section className="section">
  <h2 className="section-title">⭐ Favourite Cities</h2>

  <FavouriteCities
    currentCity={weather?.city}
    onSelectCity={(city) => {
      alert(`Selected City: ${city}\n\nNext step we'll make this automatically load weather.`);
    }}
  />
</section>}

{/* ── EL NIÑO NEWS MONITOR ── */}
{activePage === "elnino-news" && <section className="section">
  <ElNinoNewsMonitor />
</section>}

      </div>
        <Footer />
        </main>
      </div>
    </>
  );
}

export default App;
