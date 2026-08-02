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

export default satelliteData;
