import "./App.css";
import Navbar from "./components/Navbar";
import TemperatureCard from "./components/TemperatureCard";
import SatellitePanel from "./components/SatellitePanel";
import HeatMap from "./components/HeatMap";
import PredictionGraph from "./components/PredictionGraph";
import HeatAlert from "./components/HeatAlert";
import PreventiveMeasures from "./components/PreventiveMeasures";
import SearchLocation from "./components/SearchLocation";
import DownloadReport from "./components/DownloadReport";
import EmergencyContacts from "./components/EmergencyContacts";
import Footer from "./components/Footer";

function App() {
  return (
    <>
      <Navbar />

      <div className="App">
        <h1>Satellite-Based El Niño Heat Monitoring System</h1>
        <h3>AI-Powered Heat Prediction and Early Warning System</h3>

        <div className="dashboard">

          <TemperatureCard />

          <div className="card">
            <h2>🌊 El Niño Status</h2>
            <p>Strong El Niño (ONI: +1.4)</p>
          </div>

          <div className="card">
            <h2>💧 Humidity</h2>
            <p>58%</p>
          </div>

          <div className="card">
            <h2>🌧️ Rainfall</h2>
            <p>12 mm</p>
          </div>

          <div className="card">
            <h2>🌬️ Wind Speed</h2>
            <p>14 km/h</p>
          </div>

          <div className="card">
            <h2>🔥 Heat Risk Level</h2>
            <p className="high-risk">High</p>
          </div>

        </div>

        <SatellitePanel />
        <HeatMap />
        <PredictionGraph />
        <HeatAlert />
        <PreventiveMeasures />
        <SearchLocation />
        <DownloadReport />
        <EmergencyContacts />
      </div>

      <Footer />
    </>
  );
}

export default App;