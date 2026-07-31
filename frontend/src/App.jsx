import HeatRecommendation from "./components/HeatRecommendation";
import "./App.css";
import { useState, useEffect } from "react";
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
import SatelliteSourceCard from "./components/SatelliteSourceCard";
import AlertRecommendationCard from "./components/AlertRecommendationCard";
import SatellitePanel from "./components/SatellitePanel";
import HeatMap from "./components/HeatMap";
import CompareCities from "./components/CompareCities";
import PredictionGraph from "./components/PredictionGraph";
import HeatAlert from "./components/HeatAlert";
import PreventiveMeasures from "./components/PreventiveMeasures";
import SearchLocation from "./components/SearchLocation";
import DownloadReport from "./components/DownloadReport";
import EmergencyContacts from "./components/EmergencyContacts";
import Footer from "./components/Footer";

function App() {
  const [weather, setWeather] = useState(null);
  const [satellite, setSatellite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [satelliteError, setSatelliteError] = useState("");
  const [predictionForm, setPredictionForm] = useState({
    temperature: "38",
    humidity: "40",
    rainfall: "5",
    wind_speed: "12"
  });
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/weather");
        if (!response.ok) throw new Error("Failed to fetch weather data");
        const data = await response.json();
        setWeather(data);
        setWeatherError("");
      } catch (error) {
        setWeather(null);
        setWeatherError("Unable to fetch weather data");
      } finally {
        setLoading(false);
      }
    };

    const fetchSatelliteData = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/satellite");
        if (!response.ok) throw new Error("Failed to fetch satellite data");
        const data = await response.json();
        setSatellite(data);
        setSatelliteError("");
      } catch (error) {
        setSatellite(null);
        setSatelliteError("Unable to fetch satellite data");
      }
    };

    fetchWeatherData();
    fetchSatelliteData();
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setPredictionForm((current) => ({ ...current, [name]: value }));
  };

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

      if ([payload.temperature, payload.humidity, payload.rainfall, payload.wind_speed].some((value) => Number.isNaN(value))) {
        throw new Error("Please enter valid numeric values.");
      }

      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to get a prediction from the backend.");
      setPredictionResult(data);
    } catch (error) {
      setPredictionError(error.message || "The backend is unavailable. Start the Flask server and try again.");
    } finally {
      setPredictionLoading(false);
    }
  };

  const riskClass = predictionResult?.prediction?.heat_risk?.toLowerCase() || "";

  return (
    <>
      <Navbar />

      {/* ── HERO ── */}
      <section className="hero">
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
            <SearchLocation
              onCityWeather={setWeather}
              onCityError={setWeatherError}
              onFillForm={setPredictionForm}
            />
          </div>
        </div>
      </section>

      <div className="App">

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
            <ElNinoCard elNinoStatus={loading ? "Loading..." : weather?.el_nino_status} />
            <HumidityCard humidity={loading ? "Loading..." : weather?.humidity} errorMessage={weatherError} />
            <RainfallCard rainfall={loading ? "Loading..." : weather?.rainfall} />
            <WindSpeedCard windSpeed={loading ? "Loading..." : weather?.wind_speed} errorMessage={weatherError} />
            <HeatRiskCard heatRisk={loading ? "Loading..." : weather?.heat_risk} />
            <HeatAlert />
            <LSTCard lst={loading ? "Loading..." : satellite?.land_surface_temperature} />
            <HeatIntensityCard heatIntensity={loading ? "Loading..." : satellite?.heat_intensity_level} />
            <ThermalAnomalyCard thermalAnomaly={loading ? "Loading..." : satellite?.thermal_anomaly} />
            <SatelliteSourceCard satelliteSource={loading ? "Loading..." : satellite?.satellite_source} />
            <AlertRecommendationCard recommendation={loading ? "Loading..." : satellite?.recommendation} />
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
                  <input type="number" name="temperature" value={predictionForm.temperature} onChange={handleInputChange} min="-50" max="60" step="0.1" />
                </label>
                <label className="prediction-field">
                  <span>Humidity (%)</span>
                  <input type="number" name="humidity" value={predictionForm.humidity} onChange={handleInputChange} min="0" max="100" step="0.1" />
                </label>
                <label className="prediction-field">
                  <span>Rainfall (mm)</span>
                  <input type="number" name="rainfall" value={predictionForm.rainfall} onChange={handleInputChange} min="0" step="0.1" />
                </label>
                <label className="prediction-field">
                  <span>Wind Speed (km/h)</span>
                  <input type="number" name="wind_speed" value={predictionForm.wind_speed} onChange={handleInputChange} min="0" step="0.1" />
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
                    <h3>{predictionResult.prediction.heat_risk}</h3>
                  </div>
                  <div className="confidence-pill">{predictionResult.prediction.confidence}% confidence</div>
                </div>
                <p>{predictionResult.prediction.explanation}</p>
              </div>
            ) : null}
            {predictionResult ? (
  <HeatRecommendation risk={predictionResult.prediction.heat_risk} />
) : null}
          </div>
        </section>

        {/* ── SATELLITE MONITORING ── */}
        <section className="section">
          <h2 className="section-title">🛰️ Satellite Monitoring</h2>
          <SatellitePanel />
        </section>

        {/* ── HEAT MAP + PREDICTION GRAPH side by side ── */}
        <section className="section">
          <h2 className="section-title">📈 Analytics</h2>
          <div className="two-col">
            <HeatMap weather={weather} />
            <PredictionGraph weather={weather} />
          </div>
        </section>

        {/* ── COMPARE CITIES ── */}
        <section className="section">
          <h2 className="section-title">🏙️ Compare Cities</h2>
          <CompareCities />
        </section>

        {/* ── PREVENTIVE MEASURES + EMERGENCY CONTACTS side by side ── */}
        <section className="section">
          <h2 className="section-title">🛡️ Safety & Emergency</h2>
          <div className="two-col">
            <PreventiveMeasures />
            <EmergencyContacts />
          </div>
        </section>

        {/* ── DOWNLOAD REPORT ── */}
        <section className="section">
          <DownloadReport weather={weather} />
        </section>

      </div>

      <Footer />
    </>
  );
}

export default App;
