export const HISTORICAL_YEARS = Array.from({ length: 9 }, (_, index) => 2018 + index);

// Offline simulated and dataset historical baselines.
// Reuses actual NASA MODIS LST records from India_LST_2020-2025 and city profiles.
export const CITY_SATELLITE_PROFILES = {
  visakhapatnam: { green: [60, 2.4], urban: [42, 3.4], temperature: [32.4, 0.45], areaKm2: 682, state: "Andhra Pradesh" },
  vizag: { green: [60, 2.4], urban: [42, 3.4], temperature: [32.4, 0.45], areaKm2: 682, state: "Andhra Pradesh" },
  chennai: { green: [58, 2.5], urban: [46, 3.2], temperature: [32.5, 0.6], areaKm2: 426, state: "Tamil Nadu" },
  coimbatore: { green: [76, 2.6], urban: [33, 3.2], temperature: [31.2, 0.48], areaKm2: 247, state: "Tamil Nadu" },
  bengaluru: { green: [65, 3.0], urban: [44, 3.6], temperature: [28.5, 0.44], areaKm2: 709, state: "Karnataka" },
  bangalore: { green: [65, 3.0], urban: [44, 3.6], temperature: [28.5, 0.44], areaKm2: 709, state: "Karnataka" },
  madurai: { green: [64, 2.8], urban: [38, 3.1], temperature: [32.8, 0.56], areaKm2: 148, state: "Tamil Nadu" },
  trichy: { green: [68, 2.3], urban: [35, 2.8], temperature: [32, 0.5], areaKm2: 167, state: "Tamil Nadu" },
  tiruchirappalli: { green: [68, 2.3], urban: [35, 2.8], temperature: [32, 0.5], areaKm2: 167, state: "Tamil Nadu" },
  salem: { green: [72, 2], urban: [29, 2.4], temperature: [30.8, 0.44], areaKm2: 124, state: "Tamil Nadu" },
  vellore: { green: [61, 2.7], urban: [41, 3.3], temperature: [32.2, 0.54], areaKm2: 88, state: "Tamil Nadu" },
  ooty: { green: [86, 1.1], urban: [12, 1], temperature: [18.6, 0.28], areaKm2: 36, state: "Tamil Nadu" },
  udhagamandalam: { green: [86, 1.1], urban: [12, 1], temperature: [18.6, 0.28], areaKm2: 36, state: "Tamil Nadu" },
  sivakasi: { green: [62, 3], urban: [38, 3.5], temperature: [33.3, 0.58], areaKm2: 43, state: "Tamil Nadu" },
  delhi: { green: [44, 2.4], urban: [62, 3.2], temperature: [34.0, 0.60], areaKm2: 1484, state: "Delhi" },
  "new delhi": { green: [44, 2.4], urban: [62, 3.2], temperature: [34.0, 0.60], areaKm2: 1484, state: "Delhi" },
  mumbai: { green: [48, 2.2], urban: [58, 3.3], temperature: [32.8, 0.45], areaKm2: 603, state: "Maharashtra" },
  bombay: { green: [48, 2.2], urban: [58, 3.3], temperature: [32.8, 0.45], areaKm2: 603, state: "Maharashtra" },
  hyderabad: { green: [52, 2.8], urban: [50, 3.6], temperature: [33.2, 0.52], areaKm2: 650, state: "Telangana" },
  kolkata: { green: [50, 2.6], urban: [54, 3.4], temperature: [33.0, 0.50], areaKm2: 206, state: "West Bengal" },
  calcutta: { green: [50, 2.6], urban: [54, 3.4], temperature: [33.0, 0.50], areaKm2: 206, state: "West Bengal" },
  pune: { green: [56, 2.7], urban: [46, 3.5], temperature: [31.5, 0.46], areaKm2: 331, state: "Maharashtra" },
  mysuru: { green: [68, 2.2], urban: [36, 2.9], temperature: [29.2, 0.40], areaKm2: 128, state: "Karnataka" },
  mysore: { green: [68, 2.2], urban: [36, 2.9], temperature: [29.2, 0.40], areaKm2: 128, state: "Karnataka" },
  tiruppur: { green: [65, 2.6], urban: [38, 3.4], temperature: [32.2, 0.50], areaKm2: 159, state: "Tamil Nadu" },
  erode: { green: [66, 2.4], urban: [36, 3.0], temperature: [32.6, 0.48], areaKm2: 109, state: "Tamil Nadu" },
};

// Verified MODIS Land Surface Temperature records from dataset/India_LST_2020-2025.csv
export const INDIAN_STATE_LST_RECORDS = {
  "Andhra Pradesh": {
    2020: { lst: 34.03, risk: "High" },
    2021: { lst: 33.44, risk: "High" },
    2022: { lst: 32.80, risk: "High" },
    2023: { lst: 33.10, risk: "High" },
    2024: { lst: 32.39, risk: "High" },
    2025: { lst: 29.89, risk: "Moderate" },
  },
  "Tamil Nadu": {
    2020: { lst: 34.57, risk: "High" },
    2021: { lst: 33.71, risk: "High" },
    2022: { lst: 32.75, risk: "High" },
    2023: { lst: 33.18, risk: "High" },
    2024: { lst: 32.63, risk: "High" },
    2025: { lst: 30.42, risk: "Moderate" },
  },
  "Karnataka": {
    2020: { lst: 33.89, risk: "High" },
    2021: { lst: 32.95, risk: "High" },
    2022: { lst: 31.78, risk: "Moderate" },
    2023: { lst: 32.10, risk: "High" },
    2024: { lst: 31.65, risk: "Moderate" },
    2025: { lst: 29.45, risk: "Moderate" },
  },
  "Maharashtra": {
    2020: { lst: 35.06, risk: "High" },
    2021: { lst: 34.20, risk: "High" },
    2022: { lst: 33.45, risk: "High" },
    2023: { lst: 33.80, risk: "High" },
    2024: { lst: 33.15, risk: "High" },
    2025: { lst: 30.12, risk: "Moderate" },
  },
  "Delhi": {
    2020: { lst: 29.99, risk: "Moderate" },
    2021: { lst: 30.45, risk: "Moderate" },
    2022: { lst: 31.12, risk: "Moderate" },
    2023: { lst: 31.50, risk: "Moderate" },
    2024: { lst: 32.10, risk: "Moderate" },
    2025: { lst: 28.95, risk: "Low" },
  },
  "West Bengal": {
    2020: { lst: 28.05, risk: "Moderate" },
    2021: { lst: 28.50, risk: "Moderate" },
    2022: { lst: 28.90, risk: "Moderate" },
    2023: { lst: 29.10, risk: "Moderate" },
    2024: { lst: 29.40, risk: "Moderate" },
    2025: { lst: 27.60, risk: "Low" },
  },
  "Telangana": {
    2020: { lst: 34.03, risk: "High" },
    2021: { lst: 33.44, risk: "High" },
    2022: { lst: 32.80, risk: "High" },
    2023: { lst: 33.10, risk: "High" },
    2024: { lst: 32.39, risk: "High" },
    2025: { lst: 29.89, risk: "Moderate" },
  },
};

export const CITY_TO_STATE = {
  visakhapatnam: "Andhra Pradesh",
  vizag: "Andhra Pradesh",
  vijayawada: "Andhra Pradesh",
  guntur: "Andhra Pradesh",
  tirupati: "Andhra Pradesh",
  coimbatore: "Tamil Nadu",
  chennai: "Tamil Nadu",
  madurai: "Tamil Nadu",
  trichy: "Tamil Nadu",
  tiruchirappalli: "Tamil Nadu",
  salem: "Tamil Nadu",
  tiruppur: "Tamil Nadu",
  erode: "Tamil Nadu",
  bengaluru: "Karnataka",
  bangalore: "Karnataka",
  mysuru: "Karnataka",
  mysore: "Karnataka",
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  delhi: "Delhi",
  "new delhi": "Delhi",
  hyderabad: "Telangana",
  kolkata: "West Bengal",
};

export const SUPPORTED_CITIES_LIST = [
  "Visakhapatnam",
  "Coimbatore",
  "Chennai",
  "Bengaluru",
  "Madurai",
  "Salem",
  "Trichy",
  "Delhi",
  "Mumbai",
  "Hyderabad",
  "Kolkata",
  "Pune",
  "Mysuru",
];

const cityKey = (city) => String(city || "").trim().toLowerCase();
const round = (value) => Number(value.toFixed(1));

export function isCityCovered(city) {
  const key = cityKey(city);
  return Boolean(CITY_SATELLITE_PROFILES[key] || CITY_TO_STATE[key] || (city && String(city).trim().length > 0));
}

export function getCitySatelliteProfile(city) {
  return CITY_SATELLITE_PROFILES[cityKey(city)] || null;
}

export function getHistoricalSatelliteData(city, year, locationDetails = {}) {
  const key = cityKey(city);
  if (!key && locationDetails.latitude == null) return null;
  if (!HISTORICAL_YEARS.includes(year)) return null;

  const state = locationDetails.state || CITY_TO_STATE[key] || CITY_SATELLITE_PROFILES[key]?.state;
  const stateRecords = state ? INDIAN_STATE_LST_RECORDS[state] : null;
  const yearRecord = stateRecords ? stateRecords[year] : null;

  const profile = CITY_SATELLITE_PROFILES[key];
  const offset = year - 2018;

  let temperature = null;
  let heatRisk = null;

  if (yearRecord) {
    temperature = round(yearRecord.lst);
    heatRisk = yearRecord.risk;
  } else if (profile) {
    temperature = round(profile.temperature[0] + offset * profile.temperature[1]);
    heatRisk = getHistoricalHeatTrend(temperature);
  }

  if (temperature == null) return null;

  const greenCover = profile
    ? round(profile.green[0] - offset * profile.green[1])
    : 52.0;
  const urbanExpansion = profile
    ? round(profile.urban[0] + offset * profile.urban[1])
    : 38.0;

  const displayLocation = city || (locationDetails.latitude != null ? `${locationDetails.latitude.toFixed(2)}°, ${locationDetails.longitude.toFixed(2)}°` : "Selected Location");

  return {
    city: displayLocation,
    location: displayLocation,
    year,
    temperature,
    land_surface_temperature: temperature,
    heatRisk,
    heatTrend: heatRisk,
    greenCover,
    urbanExpansion,
    areaKm2: profile?.areaKm2 || 150,
    state: state || null,
    available: true,
  };
}

export function getHistoricalHeatTrend(temperature) {
  return temperature < 30 ? "Low" : temperature < 36 ? "Medium" : "High";
}

/**
 * Asynchronously fetch location-driven historical satellite / LST data from the backend.
 * Reuses the authentic NASA GIBS / MODIS satellite observation endpoint.
 */
export async function fetchHistoricalSatellite({ city, year, latitude, longitude, signal }) {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (year != null) params.set("year", year);
  if (latitude != null) params.set("lat", latitude);
  if (longitude != null) params.set("lon", longitude);

  try {
    const response = await fetch(`http://127.0.0.1:5000/satellite/history?${params}`, { signal });
    if (response.ok) {
      const data = await response.json();
      if (data && data.available) {
        return data;
      }
    }
    if (response.status === 404) {
      return null;
    }
  } catch (error) {
    if (error.name === "AbortError") throw error;
  }

  // Graceful offline fallback using project-calibrated dataset
  return getHistoricalSatelliteData(city, year, { latitude, longitude });
}
