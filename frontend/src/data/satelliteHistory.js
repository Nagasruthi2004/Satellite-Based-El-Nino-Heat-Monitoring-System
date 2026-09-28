export const HISTORICAL_YEARS = Array.from({ length: 9 }, (_, index) => 2018 + index);

// Offline simulated historical baselines and annual change rates. They are
// deterministic and shared by satellite modules; they are not live satellite
// observations.
const CITY_SATELLITE_PROFILES = {
  chennai: { green: [58, 2.5], urban: [46, 3.2], temperature: [32.5, 0.6] },
  coimbatore: { green: [76, 2.6], urban: [33, 3.2], temperature: [31.2, 0.48] },
  madurai: { green: [64, 2.8], urban: [38, 3.1], temperature: [32.8, 0.56] },
  trichy: { green: [68, 2.3], urban: [35, 2.8], temperature: [32, 0.5] },
  tiruchirappalli: { green: [68, 2.3], urban: [35, 2.8], temperature: [32, 0.5] },
  salem: { green: [72, 2], urban: [29, 2.4], temperature: [30.8, 0.44] },
  vellore: { green: [61, 2.7], urban: [41, 3.3], temperature: [32.2, 0.54] },
  ooty: { green: [86, 1.1], urban: [12, 1], temperature: [18.6, 0.28] },
  udhagamandalam: { green: [86, 1.1], urban: [12, 1], temperature: [18.6, 0.28] },
  sivakasi: { green: [62, 3], urban: [38, 3.5], temperature: [33.3, 0.58] },
};

const cityKey = (city) => String(city || "").trim().toLowerCase();
const round = (value) => Number(value.toFixed(1));

export function getHistoricalSatelliteData(city, year) {
  const profile = CITY_SATELLITE_PROFILES[cityKey(city)];
  if (!profile || !HISTORICAL_YEARS.includes(year)) return null;

  const offset = year - 2018;
  return {
    city,
    year,
    greenCover: round(profile.green[0] - offset * profile.green[1]),
    urbanExpansion: round(profile.urban[0] + offset * profile.urban[1]),
    temperature: round(profile.temperature[0] + offset * profile.temperature[1]),
  };
}

export function getHistoricalHeatTrend(temperature) {
  // Matches backend/heat_risk.py::classify_current_heat_risk for a simulated
  // historical temperature. The latest year uses the actual backend result.
  return temperature < 30 ? "Low" : temperature < 36 ? "Medium" : "High";
}
