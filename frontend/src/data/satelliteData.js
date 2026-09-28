import tamilNaduImage from "../assets/satellite/latest_satellite.jpg";
import chennaiImage from "../assets/satellite/chennai_satellite.jpg";
import coimbatoreImage from "../assets/satellite/coimbatore_satellite.jpg";
import maduraiImage from "../assets/satellite/madurai_satellite.jpg";
import trichyImage from "../assets/satellite/trichy_satellite.jpg";
import salemImage from "../assets/satellite/salem_satellite.jpg";

const sharedDetails = {
  satelliteName: "Landsat 8",
  observationDate: "24 July 2026",
  source: "USGS Earth Explorer",
};

export const tamilNaduSatelliteObservation = {
  ...sharedDetails,
  region: "Tamil Nadu",
  image: tamilNaduImage,
  surfaceTemperature: "36.8°C",
  ndvi: "0.52",
  cloudCoverage: "12%",
  status: "🟠 Moderate Surface Heating",
  observation: "The latest satellite observation indicates moderate land surface heating over the selected region. Vegetation remains stable while cloud coverage remains low. Current conditions suggest moderate urban heat accumulation.",
};

const satelliteData = {
  chennai: {
    ...sharedDetails,
    region: "Chennai",
    image: chennaiImage,
    surfaceTemperature: "38.4°C",
    ndvi: "0.38",
    cloudCoverage: "9%",
    status: "🟠 Moderate Surface Heating",
    observation: "Chennai shows moderate coastal urban heating in the latest observation. Vegetation is lower across dense built-up areas, while low cloud cover allows land surfaces to retain daytime heat.",
  },
  coimbatore: {
    ...sharedDetails,
    region: "Coimbatore",
    image: coimbatoreImage,
    surfaceTemperature: "34.6°C",
    ndvi: "0.61",
    cloudCoverage: "18%",
    status: "🟠 Moderate Surface Heating",
    observation: "Coimbatore retains comparatively stable vegetation cover in the latest observation. Moderate surface heating is concentrated around urban corridors, with partial cloud cover limiting peak exposure.",
  },
  madurai: {
    ...sharedDetails,
    region: "Madurai",
    image: maduraiImage,
    surfaceTemperature: "37.9°C",
    ndvi: "0.44",
    cloudCoverage: "7%",
    status: "🟠 Moderate Surface Heating",
    observation: "Madurai shows dry surface conditions and moderate urban heat accumulation. Sparse cloud coverage and reduced vegetation in surrounding areas support higher daytime land-surface temperatures.",
  },
  trichy: {
    ...sharedDetails,
    region: "Trichy",
    image: trichyImage,
    surfaceTemperature: "36.7°C",
    ndvi: "0.49",
    cloudCoverage: "11%",
    status: "🟠 Moderate Surface Heating",
    observation: "Trichy indicates moderate heating across developed land, while vegetation near river corridors remains stable. Low cloud coverage suggests continued daytime thermal exposure.",
  },
  salem: {
    ...sharedDetails,
    region: "Salem",
    image: salemImage,
    surfaceTemperature: "35.8°C",
    ndvi: "0.56",
    cloudCoverage: "15%",
    status: "🟠 Moderate Surface Heating",
    observation: "Salem shows moderate surface heating with healthy vegetation across nearby upland areas. Cloud cover remains limited, though the observed thermal pattern is less intense than the hotter inland cities.",
  },
};

export function getSatelliteData(city) {
  return satelliteData[String(city || "").trim().toLowerCase()] || tamilNaduSatelliteObservation;
}

function stableLocationFactor(location, offset) {
  const key = String(location || "").trim().toLowerCase();
  const hash = [...key].reduce((value, character) => ((value * 31) + character.charCodeAt(0) + offset) >>> 0, 0);
  return (hash % 1000) / 1000;
}

export function getDeterministicSatelliteFallback(location, weather = {}) {
  const temperature = Number(weather?.temperature);
  if (!Number.isFinite(temperature)) return null;

  const humidity = Number.isFinite(Number(weather?.humidity)) ? Number(weather.humidity) : 50;
  const rainfall = Number.isFinite(Number(weather?.rainfall)) ? Number(weather.rainfall) : 0;
  const windSpeed = Number.isFinite(Number(weather?.wind_speed)) ? Number(weather.wind_speed) : 3;
  const risk = String(weather?.heat_risk || "").toLowerCase();
  const surfaceFactor = stableLocationFactor(location, 17) * 3;
  const baselineSurface = 26 + stableLocationFactor(location, 53) * 5;
  const lst = Math.min(Math.max(
    temperature + 2 + surfaceFactor - Math.max(humidity - 50, 0) * 0.025 - Math.min(rainfall * 0.15, 3) - Math.min(windSpeed * 0.12, 2),
    temperature - 3,
  ), temperature + 9);
  const anomalyDelta = lst - baselineSurface;
  const thermalAnomaly = anomalyDelta >= 8 ? "Extreme Anomaly" : anomalyDelta >= 5 ? "High Anomaly" : anomalyDelta >= 2 ? "Moderate Anomaly" : "Normal";
  const heatIntensity = risk.includes("critical") || risk.includes("extreme") ? "Extreme" : risk.includes("high") ? "High" : risk.includes("medium") ? "Medium" : risk.includes("low") ? "Low" : "Not available";

  return {
    location,
    land_surface_temperature: Number(lst.toFixed(2)),
    heat_intensity_level: heatIntensity,
    thermal_anomaly: thermalAnomaly,
    satellite_source: "Deterministic simulated environmental fallback (not satellite observation)",
  };
}

export default satelliteData;
