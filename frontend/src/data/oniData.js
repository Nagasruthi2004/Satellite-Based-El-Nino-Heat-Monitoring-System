const oniData = {
  1998: [
    { month: "Jan", oni: 2.2 }, { month: "Feb", oni: 2.1 }, { month: "Mar", oni: 1.9 },
    { month: "Apr", oni: 1.6 }, { month: "May", oni: 1.3 }, { month: "Jun", oni: 1.0 },
    { month: "Jul", oni: 0.7 }, { month: "Aug", oni: 0.4 }, { month: "Sep", oni: 0.1 },
    { month: "Oct", oni: -0.2 }, { month: "Nov", oni: -0.5 }, { month: "Dec", oni: -0.7 },
  ],
  2015: [
    { month: "Jan", oni: 0.5 }, { month: "Feb", oni: 0.6 }, { month: "Mar", oni: 0.8 },
    { month: "Apr", oni: 1.0 }, { month: "May", oni: 1.2 }, { month: "Jun", oni: 1.4 },
    { month: "Jul", oni: 1.6 }, { month: "Aug", oni: 1.9 }, { month: "Sep", oni: 2.1 },
    { month: "Oct", oni: 2.3 }, { month: "Nov", oni: 2.5 }, { month: "Dec", oni: 2.6 },
  ],
  2024: [
    { month: "Jan", oni: 1.9 }, { month: "Feb", oni: 1.8 }, { month: "Mar", oni: 1.6 },
    { month: "Apr", oni: 1.3 }, { month: "May", oni: 1.0 }, { month: "Jun", oni: 0.7 },
    { month: "Jul", oni: 0.4 }, { month: "Aug", oni: 0.2 }, { month: "Sep", oni: 0.0 },
    { month: "Oct", oni: -0.2 }, { month: "Nov", oni: -0.4 }, { month: "Dec", oni: -0.5 },
  ],
  2026: [
    { month: "Jan", oni: 0.7 }, { month: "Feb", oni: 0.8 }, { month: "Mar", oni: 0.9 },
    { month: "Apr", oni: 1.0 }, { month: "May", oni: 1.1 }, { month: "Jun", oni: 1.2 },
    { month: "Jul", oni: 1.3 }, { month: "Aug", oni: 1.4 }, { month: "Sep", oni: 1.5 },
    { month: "Oct", oni: 1.5 }, { month: "Nov", oni: 1.4 }, { month: "Dec", oni: 1.3 },
  ],
};

export function classifyOniCondition(oni) {
  if (!Number.isFinite(oni)) return "Monitoring";
  if (oni >= 0.5) return "El Niño";
  if (oni <= -0.5) return "La Niña";
  return "Neutral";
}

export function classifyOniStrength(oni) {
  const magnitude = Math.abs(oni);
  if (!Number.isFinite(magnitude) || magnitude < 0.5) return "Neutral";
  if (magnitude >= 1.5) return "Very Strong";
  if (magnitude >= 1.0) return "Strong";
  return "Moderate";
}

export function getLatestOniData() {
  const latestYear = Object.keys(oniData)
    .map(Number)
    .filter(Number.isFinite)
    .sort((first, second) => second - first)[0];
  const oni = oniData[latestYear]?.at(-1)?.oni;

  return {
    oni: Number.isFinite(oni) ? oni : null,
    status: classifyOniCondition(oni),
    strength: classifyOniStrength(oni),
  };
}

export function calculateElNinoImpact(oni, weather = {}, satellite = {}) {
  if (!weather) {
    return {
      oni,
      status: "Monitoring",
      influence: "Unknown",
      impactScore: 0,
    };
  }

  const temperature = Number(weather?.temperature ?? 0);
  const humidity = Number(weather?.humidity ?? 0);
  const rainfall = Number(weather?.rainfall ?? 0);
  const windSpeed = Number(weather?.wind_speed ?? 0);
  const landSurfaceTemperature = Number(satellite?.land_surface_temperature ?? 0);
  const heatRisk = String(weather?.heat_risk || "").toLowerCase();
  const anomalyStatus = String(satellite?.thermal_anomaly || "").toLowerCase();
  const anomalyScore = satellite?.thermal_anomaly === true || anomalyStatus.includes("extreme")
    ? 8
    : anomalyStatus.includes("high")
      ? 6
      : anomalyStatus.includes("moderate")
        ? 3
        : 0;
  const thermalAnomaly = anomalyScore > 0;
  const hasLocalData = [
    weather?.temperature,
    weather?.humidity,
    weather?.rainfall,
    weather?.wind_speed,
    satellite?.land_surface_temperature,
  ].some((value) => value !== null && value !== undefined && Number.isFinite(Number(value))) || Boolean(heatRisk) || thermalAnomaly;

  if (!Number.isFinite(oni) || !hasLocalData) {
    return { oni, status: classifyOniCondition(oni), influence: "Monitoring", impactScore: 0 };
  }

  const oniScore = Math.min(Math.abs(oni) * 25, 35);
  const temperatureScore = Number.isFinite(temperature) ? Math.min(Math.max((temperature - 25) * 1.5, 0), 20) : 0;
  const humidityScore = Number.isFinite(humidity) ? Math.min(Math.max((humidity - 40) * 0.2, 0), 8) : 0;
  const rainfallScore = Number.isFinite(rainfall) ? Math.min(Math.max((20 - rainfall) * 0.2, 0), 4) : 0;
  const windScore = Number.isFinite(windSpeed) ? Math.min(Math.max((8 - windSpeed) * 0.5, 0), 4) : 0;
  const lstScore = Number.isFinite(landSurfaceTemperature) ? Math.min(Math.max((landSurfaceTemperature - 30) * 1.2, 0), 18) : 0;
  const heatRiskScore = heatRisk.includes("high") ? 5 : heatRisk.includes("medium") ? 3 : heatRisk.includes("low") ? 1 : 0;
  const impactScore = Math.round(Math.min(
    oniScore + temperatureScore + humidityScore + rainfallScore + windScore + lstScore + anomalyScore + heatRiskScore,
    100,
  ));

  return {
    oni,
    status: classifyOniCondition(oni),
    influence: impactScore >= 65 ? "High" : impactScore >= 35 ? "Medium" : "Low",
    impactScore,
  };
}

export function getLatestOniCondition() {
  return getLatestOniData().status;
}

export default oniData;
