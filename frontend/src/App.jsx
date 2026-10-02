import SatelliteTimeMachine from "./components/SatelliteTimeMachine";
import ElNinoAnalyzer from "./components/ElNinoAnalyzer";
import SatelliteChangeDetector from "./components/SatelliteChangeDetector";
import EmailAlert from "./components/EmailAlert";
import FavouriteCities from "./components/FavouriteCities";
import HeatRecommendation from "./components/HeatRecommendation";
import ElNinoNewsMonitor from "./components/ElNinoNewsMonitor";
import WorldHeatMap from "./components/WorldHeatMap";
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
import SearchLocation from "./components/SearchLocation";
import AIClimateReport from "./components/AIClimateReport";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import FutureCitySimulator from "./components/FutureCitySimulator";
import HeatPreparednessScore from "./components/HeatPreparednessScore";
import HeatHotspotRanking from "./components/HeatHotspotRanking";
import AIChatbot from "./components/AIChatbot";
import Footer from "./components/Footer";
import DashboardNavigation from "./components/DashboardNavigation";
import { calculateElNinoImpact, getLatestOniData } from "./data/oniData";
import { getDeterministicSatelliteFallback } from "./data/satelliteData";
import { formatWindSpeedKmh } from "./utils/wind";
import { getHeatRiskExplanation } from "./utils/heatRisk";

const getSystemTheme = () => window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const getStoredTheme = () => localStorage.getItem("el-nino-theme");

const DASHBOARD_PAGES = [
  { id: "live", label: "Live Weather", icon: "📊" },
  { id: "world-heatmap", label: "World Heat Map", icon: "🌍" },
  { id: "analytics", label: "Analytics", icon: "📈" },
  { id: "simulator", label: "Future City Simulator", icon: "🏙️" },
  { id: "preparedness", label: "Preparedness Score", icon: "🛡️" },
  { id: "hotspots", label: "Heat Hotspot Ranking", icon: "🔥" },
  { id: "climate-report", label: "AI Climate Report", icon: "📄" },
  { id: "compare", label: "Compare Cities", icon: "⚖️" },
  { id: "assistant", label: "AI Assistant", icon: "🤖" },
  { id: "time-machine", label: "Satellite Time Machine", icon: "🛰️" },
  { id: "change-detector", label: "Satellite Change Detector", icon: "🪐" },
  { id: "elnino", label: "El Niño Analyzer", icon: "🌊" },
  { id: "elnino-news", label: "El Niño News Monitor", icon: "📰" },
  { id: "email-alerts", label: "Email Heat Alerts", icon: "📧" },
  { id: "favourites", label: "Favourite Cities", icon: "⭐" },
];

const getPageFromHash = () => {
  const page = window.location.hash.replace(/^#/, "");
  return DASHBOARD_PAGES.some((item) => item.id === page) ? page : "live";
};

function App() {
  const [theme, setTheme] = useState(() => getStoredTheme() || getSystemTheme());
  const [activePage, setActivePage] = useState(getPageFromHash);
  const pageContentRef = useRef(null);
  const [hasSelectedTheme, setHasSelectedTheme] = useState(() => Boolean(getStoredTheme()));
  const [weather, setWeather] = useState(null);
  const [satelliteCity, setSatelliteCity] = useState("");
  const [mapLocation, setMapLocation] = useState(null);
  const [detectedCity, setDetectedCity] = useState("");
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
  const [simulatorValues, setSimulatorValues] = useState({ treeCover: 50, waterBodies: 50 });
  const latestOniData = getLatestOniData();
  const elNinoImpact = calculateElNinoImpact(latestOniData.oni, weather, satellite);
  const currentHeatRisk = weather?.current_heat_risk || null;
  const displayedPredictionRisk = currentHeatRisk?.level || "Not available";
  const riskClass = displayedPredictionRisk?.toLowerCase() || "";

  const fetchWeatherForCity = useCallback(async (city = "", cityCandidates = [], locationDetails = {}) => {
    const normalizedCity = (city || "").trim();
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
        setDetectedCity(primaryCity);
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

  const handleMapCenterChange = handleHoverLocationChange;

  const recenterToUserLocation = useCallback(() => {
    setLiveLocation("Coimbatore, Tamil Nadu, India");
    setMapLocation({ lat: 11.0168, lon: 76.9558, label: "Coimbatore" });
    fetchWeatherForCity("Coimbatore").catch(() => {});
  }, [fetchWeatherForCity]);

  useEffect(() => {
    recenterToUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!weather?.city) {
      setSatellite(null);
      setSatelliteError("");
      return undefined;
    }

    const controller = new AbortController();
    const fetchSatelliteData = async () => {
      const fallback = getDeterministicSatelliteFallback(weather.city, weather);
      try {
        if (fallback) setSatellite(fallback);
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
        setSatellite(data);
        setSatelliteError("");
      } catch (error) {
        if (error.name === "AbortError") return;
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
    return () => controller.abort();
  }, [weather?.city]);

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
    const payload = getPredictionPayload(weather);
    setPredictionResult(null);
    setPredictionError("");

    if (!weather?.city) return undefined;

    setPredictionForm({
      temperature: String(payload?.temperature ?? ""),
      humidity: String(payload?.humidity ?? ""),
      rainfall: String(payload?.rainfall ?? ""),
      wind_speed: String(payload?.wind_speed ?? ""),
    });

    if (!payload) {
      setPredictionError("Heat risk prediction unavailable");
      return undefined;
    }

    const controller = new AbortController();
    const fetchPrediction = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data?.prediction?.heat_risk) throw new Error("Prediction unavailable");
        setPredictionResult(data);
      } catch (error) {
        if (error.name !== "AbortError") setPredictionError("Heat risk prediction unavailable");
      }
    };

    fetchPrediction();
    return () => controller.abort();
  }, [weather?.city, weather?.temperature, weather?.humidity, weather?.rainfall, weather?.wind_speed]);

  const handlePredict = async (event) => {
    event.preventDefault();
    setPredictionLoading(true);
    setPredictionError("");
    setPredictionResult(null);

    try {
      const payload = {
        temperature: Number(predictionForm.temperature),
        humidity: Number(predictionForm.humidity),
        rainfall: Number(predictionForm.rainfall),
        wind_speed: Number(predictionForm.wind_speed)
      };

      if ([payload.temperature, payload.humidity, payload.rainfall, payload.wind_speed].some((value) => !Number.isFinite(value))) {
        throw new Error("Heat risk prediction unavailable");
      }

      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data?.prediction?.heat_risk) throw new Error("Heat risk prediction unavailable");
      setPredictionResult(data);
    } catch (error) {
      setPredictionError(error.message || "Heat risk prediction unavailable");
    } finally {
      setPredictionLoading(false);
    }
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
        <DashboardNavigation activePage={activePage} onNavigate={navigateToPage} items={DASHBOARD_PAGES} />
        <main className="dashboard-page-content" ref={pageContentRef}>
      {activePage === "live" && <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-eyebrow">🛰️ Satellite-Powered Intelligence</span>
            <h1 className="hero-title">El Niño Heat Monitoring System</h1>
            <p className="hero-subtitle">
              Real-time urban heat tracking using satellite imagery, weather data,
              and AI-powered risk prediction.
            </p>
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
                    {weather?.lat != null && weather?.lon != null
                      ? `${weather.lat.toFixed(4)}°, ${weather.lon.toFixed(4)}°`
                      : "Center of map"}
                  </div>
                </div>
                <div className="search-result-item">
                  <div className="sr-label">Temperature</div>
                  <div className="sr-value">{weather?.temperature != null ? `${weather.temperature}°C` : (loading ? "Loading..." : "—")}</div>
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: "8px" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🖱️</span> Hover mouse cursor over any map location to detect coordinates and live weather
                </p>
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
            onHoverLocationChange={handleHoverLocationChange}
            loading={loading}
            title="🗺️ Interactive Live Weather Map"
            subtitle="Hover your mouse cursor over any location on the map. Coordinates are detected automatically to update live weather and temperature."
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
              thermalAnomaly={satellite?.thermal_anomaly}
            />
            <LSTCard lst={loading ? "Loading..." : satellite?.land_surface_temperature} />
            <HeatIntensityCard heatIntensity={loading ? "Loading..." : satellite?.heat_intensity_level} />
            <ThermalAnomalyCard thermalAnomaly={loading ? "Loading..." : satellite?.thermal_anomaly} />
          </div>
        </section>

        {/* ── HEAT RISK PREDICTION ── */}
        <section className="section">
          <h2 className="section-title">🤖 Heat Risk Prediction</h2>
          <div className="prediction-panel">
            <div className="prediction-panel-header">
              <div>
                <p className="eyebrow">Live forecasting</p>
                <h2>Predict Heat Risk</h2>
              </div>
              <div className="prediction-badge">Flask API • ML Model</div>
            </div>

            <form className="prediction-form" onSubmit={handlePredict}>
              <div className="input-grid">
                <label className="prediction-field">
                  <span>Temperature (°C)</span>
                  <input type="number" name="temperature" value={predictionForm.temperature} onChange={handleInputChange} min="-50" max="60" step="any" />
                </label>
                <label className="prediction-field">
                  <span>Humidity (%)</span>
                  <input type="number" name="humidity" value={predictionForm.humidity} onChange={handleInputChange} min="0" max="100" step="any" />
                </label>
                <label className="prediction-field">
                  <span>Rainfall (mm)</span>
                  <input type="number" name="rainfall" value={predictionForm.rainfall} onChange={handleInputChange} min="0" step="any" />
                </label>
                <label className="prediction-field">
                  <span>Wind Speed (km/h)</span>
                  <input type="number" name="wind_speed" value={predictionForm.wind_speed} onChange={handleInputChange} min="0" step="any" />
                </label>
              </div>

              <button className="predict-button" type="submit" disabled={predictionLoading}>
                {predictionLoading ? "Predicting..." : "Predict Heat Risk"}
              </button>
            </form>

            {predictionError ? <div className="prediction-error">{predictionError}</div> : null}

            {predictionResult ? (
              <div className={`prediction-result ${riskClass}`}>
                <div className="result-top">
                  <div>
                    <p className="result-label">Heat Risk</p>
                    <h3>{displayedPredictionRisk}</h3>
                  </div>
                  <div className="confidence-pill">{predictionResult?.prediction?.confidence ?? "Not available"}% confidence</div>
                </div>
                <p>{getHeatRiskExplanation(displayedPredictionRisk, predictionResult?.prediction?.confidence)}</p>
              </div>
            ) : null}
            {predictionResult ? (
  <HeatRecommendation risk={displayedPredictionRisk} />
) : null}
          </div>
        </section>
        </>}

        {/* ── WORLD HEAT MAP (NASA MODIS TERRA LST) ── */}
        {activePage === "world-heatmap" && (
          <section className="section">
            <WorldHeatMap />
          </section>
        )}

        {/* ── HEAT MAP + PREDICTION GRAPH side by side ── */}
        {activePage === "analytics" && <>
        <section className="section">
          <h2 className="section-title">📈 Analytics</h2>
          <div className="two-col">
            <HeatMap
              weather={weather}
              currentHeatRisk={currentHeatRisk}
              mapLocation={mapLocation}
              onCenterChange={handleMapCenterChange}
              loading={loading}
            />
          </div>
        </section>

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

        {activePage === "time-machine" && <section className="section">
          <h2 className="section-title">🛰 Satellite Time Machine</h2>
          <SatelliteTimeMachine city={satelliteCity || weather?.city} currentHeatRisk={currentHeatRisk} />
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

{/* ── EMAIL ALERT ── */}
{activePage === "email-alerts" && <section className="section">
  <h2 className="section-title">📧 Email Alerts</h2>

  <EmailAlert weather={weather} />
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
