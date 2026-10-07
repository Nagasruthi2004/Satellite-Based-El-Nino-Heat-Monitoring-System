/**
 * AI Heatwave Assistant Engine
 * Dynamic question-understanding, entity extraction, context tracking,
 * and contextual natural-language response generation.
 */

import { formatWindSpeedKmh } from "../utils/wind.js";
import { formatTemperature } from "../utils/temperature.js";

// Comprehensive lexicon of Indian cities and states
export const KNOWN_LOCATIONS = [
  // Tamil Nadu
  "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Trichy", "Salem",
  "Tiruppur", "Erode", "Tirunelveli", "Vellore", "Thanjavur", "Dindigul",
  "Kanchipuram", "Cuddalore", "Karur", "Nagercoil", "Kumbakonam", "Hosur",
  // Major Indian Metros and Cities
  "Mumbai", "Delhi", "New Delhi", "Bengaluru", "Bangalore", "Hyderabad",
  "Kolkata", "Calcutta", "Ahmedabad", "Pune", "Jaipur", "Surat", "Lucknow",
  "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Vizag",
  "Patna", "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Ranchi",
  "Faridabad", "Meerut", "Rajkot", "Varanasi", "Srinagar", "Aurangabad",
  "Dhanbad", "Amritsar", "Navi Mumbai", "Allahabad", "Prayagraj", "Howrah",
  "Gwalior", "Jabalpur", "Vijayawada", "Jodhpur", "Raipur", "Kota", "Guwahati",
  "Chandigarh", "Shimla", "Dehradun",
  // Indian States & Union Territories
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Jammu and Kashmir", "Ladakh",
  "Puducherry", "Delhi NCR"
];

// In-memory weather cache to prevent redundant network calls
const weatherCache = new Map();

/**
 * Fetch real-time weather & heat risk telemetry from backend API
 */
export async function fetchCityTelemetry(cityName) {
  if (!cityName) return null;
  const key = cityName.toLowerCase().trim();
  if (weatherCache.has(key)) {
    const cached = weatherCache.get(key);
    if (Date.now() - cached.ts < 180000) return cached.data; // 3 min cache
  }

  try {
    const res = await fetch(`http://127.0.0.1:5000/weather?city=${encodeURIComponent(cityName)}`);
    if (!res.ok) return null;
    const data = await res.json();
    weatherCache.set(key, { ts: Date.now(), data });
    return data;
  } catch {
    // Network or server unreachable
    return null;
  }
}

/**
 * Normalize and extract entities from natural language query
 */
export function extractEntities(query, currentContext = {}) {
  const normalized = query.trim();
  const lower = normalized.toLowerCase();

  // 1. Extract Locations
  const foundLocations = [];

  // Match known cities/states
  for (const loc of KNOWN_LOCATIONS) {
    const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(normalized)) {
      // Avoid duplicate substring matches (e.g. Bangalore vs Bengaluru)
      if (!foundLocations.some((existing) => existing.toLowerCase() === loc.toLowerCase())) {
        foundLocations.push(loc);
      }
    }
  }

  // Handle generic patterns like "in <City>", "for <City>"
  const locMatch = normalized.match(/\b(?:in|for|at|around|near|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (locMatch && !foundLocations.includes(locMatch[1])) {
    const candidate = locMatch[1].trim();
    if (!["Heat", "Weather", "India", "Risk", "Today", "Now", "LST", "ENSO"].includes(candidate)) {
      foundLocations.push(candidate);
    }
  }

  // Check comparison trigger
  const isComparison =
    foundLocations.length >= 2 ||
    /\b(compare|which (has|city has|is)|higher|lower|difference between|versus|\bvs\b|more heat|hotter)\b/i.test(normalized);

  // 2. Extract Years
  const yearMatch = normalized.match(/\b(202[0-6])\b/);
  const year = yearMatch ? yearMatch[1] : null;

  // 3. Extract Weather/Climate Parameters
  let parameter = null;
  if (/\b(temp|temperature|degrees?|how hot|heat level)\b/i.test(lower)) parameter = "temperature";
  else if (/\b(humid|humidity|moisture)\b/i.test(lower)) parameter = "humidity";
  else if (/\b(rain|rainfall|precipitation|showers?)\b/i.test(lower)) parameter = "rainfall";
  else if (/\b(wind|wind speed|breeze|airflow)\b/i.test(lower)) parameter = "wind";
  else if (/\b(lst|land surface temp|surface temp)\b/i.test(lower)) parameter = "lst";
  else if (/\b(heat risk|risk level|risk tier|danger level)\b/i.test(lower)) parameter = "heat_risk";

  // 4. Extract Risk Tier Mentioned
  let riskTier = null;
  if (/\b(critical|extreme)\b/i.test(lower)) riskTier = "Critical";
  else if (/\bhigh\b/i.test(lower)) riskTier = "High";
  else if (/\b(moderate|medium)\b/i.test(lower)) riskTier = "Moderate";
  else if (/\blow\b/i.test(lower)) riskTier = "Low";

  return {
    locations: foundLocations,
    isComparison,
    year,
    parameter,
    riskTier,
    activeLocation: foundLocations[0] || currentContext.lastLocation || null,
  };
}

/**
 * Coreference resolution: Resolves pronouns and elliptical questions
 * using conversation context without losing past topics.
 */
export function resolveCoreference(rawInput, context = {}) {
  let query = rawInput.trim();
  const lower = query.toLowerCase();

  // "What about here?" or "How hot is it here?"
  if (/\bhere\b/i.test(lower)) {
    const currentLoc = context.currentCity || (context.weather && context.weather.city) || "the current location";
    query = query.replace(/\bhere\b/gi, currentLoc);
  }

  // Handle "What about <Location>?" follow-ups
  const whatAboutMatch = query.match(/^what\s+about\s+([a-zA-Z\s]+)\??$/i);
  if (whatAboutMatch) {
    const target = whatAboutMatch[1].trim();
    const isKnownLoc = KNOWN_LOCATIONS.some((l) => l.toLowerCase() === target.toLowerCase());

    if (isKnownLoc) {
      if (context.lastTopic === "heat_risk") {
        return { resolvedQuery: `What is the heat risk in ${target}?`, inferredTopic: "heat_risk", targetLocation: target };
      }
      if (context.lastTopic === "weather" || context.lastTopic === "temperature") {
        return { resolvedQuery: `What is the temperature and weather in ${target}?`, inferredTopic: "weather", targetLocation: target };
      }
      if (context.lastTopic === "lst") {
        return { resolvedQuery: `What is the Land Surface Temperature in ${target}?`, inferredTopic: "lst", targetLocation: target };
      }
      return { resolvedQuery: `What is the heat risk and weather status in ${target}?`, inferredTopic: "heat_risk", targetLocation: target };
    }

    if (/\b(heat\s*risk|risk)\b/i.test(target)) {
      if (context.lastEntity) {
        return { resolvedQuery: `How does ${context.lastEntity} relate to heat risk?`, inferredTopic: "heat_risk" };
      }
      if (context.lastLocation) {
        return { resolvedQuery: `What is the heat risk in ${context.lastLocation}?`, inferredTopic: "heat_risk", targetLocation: context.lastLocation };
      }
    }

    if (/\b(india|south asia)\b/i.test(target)) {
      if (context.lastEntity) {
        return { resolvedQuery: `How does ${context.lastEntity} affect ${target}?`, inferredTopic: "impact" };
      }
    }
  }

  // Handle pronouns: "it", "its", or specific follow-up patterns
  if (/\b(it|its)\b/i.test(lower) && context.lastEntity) {
    query = query.replace(/\b(it|its)\b/gi, context.lastEntity);
  } else if (/^(what about (this|that)|how does (this|that) affect)\b/i.test(lower) && context.lastEntity) {
    query = query.replace(/\b(this|that)\b/gi, context.lastEntity);
  }

  return { resolvedQuery: query, inferredTopic: null, targetLocation: null };
}

/**
 * Classify question intent dynamically across all domains
 */
export function classifyIntent(query, entities) {
  const q = query.toLowerCase();

  // 1. Comparison Intent
  if (entities.isComparison && entities.locations.length >= 2) {
    return { topic: "comparison", subIntent: "city_comparison" };
  }

  // 2. LST & Satellite
  if (/\b(lst|land surface temperature|skin temperature)\b/i.test(q)) {
    if (/\b(air|ambient|difference|vs|differ|different)\b/i.test(q)) {
      return { topic: "lst", subIntent: "lst_vs_air" };
    }
    if (/\b(map|purpose|india lst|state-wise)\b/i.test(q)) {
      return { topic: "project_lst_map", subIntent: "lst_map_purpose" };
    }
    return { topic: "lst", subIntent: "definition" };
  }

  if (/\b(satellite|remote sensing|modis|gibs|radiometer|hotspot|hotspots|thermal imagery)\b/i.test(q)) {
    if (/\b(hotspot|hotspots)\b/i.test(q)) {
      return { topic: "satellite", subIntent: "hotspots" };
    }
    return { topic: "satellite", subIntent: "detection" };
  }

  // 3. El Niño & ENSO & ONI
  if (/\b(el ni[ñn]o|la ni[ñn]a|enso|oni|oceanic ni[ñn]o index)\b/i.test(q)) {
    if (/\b(affect|cause|increase|impact|influence|matter|lead to|correlat|role|relat|heat|temperature|risk)\b/i.test(q)) {
      return { topic: "enso", subIntent: "impact_heat" };
    }
    return { topic: "enso", subIntent: "definition" };
  }

  // 4. Project Methodology & 2026 Predictions
  if (/\b(2026|future heat|predict 2026|prediction model|how was.*predicted)\b/i.test(q)) {
    return { topic: "project_prediction", subIntent: "prediction_2026" };
  }

  if (/\b(dataset|datasets|sources|training data|data used)\b/i.test(q)) {
    return { topic: "project_methodology", subIntent: "datasets" };
  }

  if (/\b(system predict|algorithm|random forest|machine learning|model predict|methodology)\b/i.test(q)) {
    return { topic: "project_methodology", subIntent: "ml_model" };
  }

  // 5. Atmospheric Parameters (Humidity, Wind, Rainfall)
  if (/\b(humid|humidity)\b/i.test(q) && /\b(why|important|effect|affect|matter|sweat|evaporat)\b/i.test(q)) {
    return { topic: "atmospheric_physics", subIntent: "humidity_importance" };
  }
  if (/\b(wind|wind speed)\b/i.test(q) && /\b(why|important|effect|affect|cooling)\b/i.test(q)) {
    return { topic: "atmospheric_physics", subIntent: "wind_effect" };
  }
  if (/\b(rain|rainfall)\b/i.test(q) && /\b(why|relief|cooling|affect)\b/i.test(q)) {
    return { topic: "atmospheric_physics", subIntent: "rainfall_effect" };
  }

  // 6. Location-Specific Weather or Heat Risk
  if (entities.locations.length > 0 || /\b(here|current city)\b/i.test(q)) {
    if (/\b(why is|why are)\b/i.test(q) && /\b(hot|heat|warm)\b/i.test(q)) {
      return { topic: "location_weather", subIntent: "why_hot" };
    }
    if (/\b(high risk|heat risk|risk today|risk level|safe outside|go out)\b/i.test(q)) {
      return { topic: "location_weather", subIntent: "heat_risk_status" };
    }
    if (/\b(status|temperature|temp|weather|current)\b/i.test(q)) {
      return { topic: "location_weather", subIntent: "weather_status" };
    }
  }

  // 7. Heat Risk Concept
  if (/\b(heat risk|risk tier|risk level)\b/i.test(q)) {
    if (entities.riskTier) {
      return { topic: "heat_risk_concept", subIntent: "tier_explanation", tier: entities.riskTier };
    }
    if (/\b(why is.*high|why high|why critical)\b/i.test(q)) {
      return { topic: "heat_risk_concept", subIntent: "why_high_risk" };
    }
    return { topic: "heat_risk_concept", subIntent: "definition" };
  }

  // 8. Heat Safety & Outdoor Precautions
  if (/\b(precaution|protect|what should i do|what to do|safety|safe outside|go outside|go out|outdoor|remedies)\b/i.test(q)) {
    return { topic: "safety", subIntent: "general_safety" };
  }

  // 9. Hydration & Dehydration
  if (/\b(dehydrat|lack of water)\b/i.test(q) && /\b(sign|signs|symptom|symptoms)\b/i.test(q)) {
    return { topic: "hydration", subIntent: "dehydration_signs" };
  }
  if (/\b(water|drink|hydrat|liters?)\b/i.test(q)) {
    return { topic: "hydration", subIntent: "water_intake" };
  }

  // 10. Heatstroke & Heat Exhaustion Symptoms
  if (/\b(heat stroke|heat exhaustion|heat cramp|sunstroke|faint|dizzy|nausea)\b/i.test(q)) {
    return { topic: "safety", subIntent: "heatstroke_symptoms" };
  }

  // 11. Heatwave Definition
  if (/\b(heat\s*waves?)\b/i.test(q)) {
    return { topic: "heatwave", subIntent: "definition" };
  }

  // 12. Greetings
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|howdy)\b/i.test(q)) {
    return { topic: "greeting", subIntent: "greeting" };
  }

  // 13. Unrelated / Out-of-domain
  return { topic: "unrelated", subIntent: "unrelated" };
}

/**
 * Dynamically synthesize natural language answers tailored specifically
 * to the question, extracted entities, and fetched real-time telemetry.
 */
export async function synthesizeResponse(intent, entities, query, currentProps = {}) {
  const currentCity = currentProps.weather?.city || "your city";
  const currentTemp = currentProps.weather?.temperature;
  const currentRisk = currentProps.currentHeatRisk?.level || currentProps.weather?.heat_risk || "Moderate";

  // 1. COMPARISON INTENT
  if (intent.topic === "comparison" && entities.locations.length >= 2) {
    const [city1, city2] = entities.locations;

    // Retrieve live telemetry for both cities
    let data1 = city1.toLowerCase() === currentCity.toLowerCase() ? currentProps.weather : null;
    let data2 = city2.toLowerCase() === currentCity.toLowerCase() ? currentProps.weather : null;

    if (!data1) data1 = await fetchCityTelemetry(city1);
    if (!data2) data2 = await fetchCityTelemetry(city2);

    if (!data1 && !data2) {
      return {
        answer: `Data is not currently available for ${city1} and ${city2}. Please ensure the city names are correct or search for them in the main navigation.`,
        suggestion: "You can also ask about the currently monitored city or general heatwave safety precautions.",
        updatedTopic: "comparison",
        updatedEntity: `${city1} vs ${city2}`,
      };
    }

    if (!data1 || !data2) {
      const avail = data1 ? city1 : city2;
      const unavail = data1 ? city2 : city1;
      const d = data1 || data2;
      return {
        answer: `I was able to retrieve current data for ${avail} (${formatTemperature(d.temperature)}, ${d.heat_risk} heat risk), but data is not currently available for ${unavail}.`,
        suggestion: `You can also ask what precautions to take in ${avail} under ${d.heat_risk} heat risk.`,
        updatedTopic: "heat_risk",
        updatedEntity: avail,
        updatedLocation: avail,
      };
    }

    const t1 = Number(data1.temperature);
    const t2 = Number(data2.temperature);
    const r1 = data1.heat_risk || "Moderate";
    const r2 = data2.heat_risk || "Moderate";

    const riskRank = { Low: 1, Moderate: 2, Medium: 2, High: 3, Critical: 4 };
    const rank1 = riskRank[r1] || 2;
    const rank2 = riskRank[r2] || 2;

    let comparisonVerdict;
    if (rank1 > rank2) {
      comparisonVerdict = `${city1} currently has a higher heat risk (${r1}) than ${city2} (${r2}).`;
    } else if (rank2 > rank1) {
      comparisonVerdict = `${city2} currently has a higher heat risk (${r2}) than ${city1} (${r1}).`;
    } else if (t1 > t2) {
      comparisonVerdict = `Both ${city1} and ${city2} share a ${r1} heat risk level, though ${city1} is slightly warmer at ${formatTemperature(t1)} compared to ${city2}'s ${formatTemperature(t2)}.`;
    } else if (t2 > t1) {
      comparisonVerdict = `Both ${city1} and ${city2} share a ${r1} heat risk level, though ${city2} is warmer at ${formatTemperature(t2)} compared to ${city1}'s ${formatTemperature(t1)}.`;
    } else {
      comparisonVerdict = `${city1} and ${city2} currently exhibit equivalent thermal conditions (${formatTemperature(t1)}, ${r1} heat risk).`;
    }

    const answer =
      `${comparisonVerdict}\n\n` +
      `Live Telemetry Comparison:\n` +
      `• **${city1}**: ${formatTemperature(t1)} | Humidity: ${data1.humidity != null ? `${data1.humidity}%` : "N/A"} | Risk: ${r1}\n` +
      `• **${city2}**: ${formatTemperature(t2)} | Humidity: ${data2.humidity != null ? `${data2.humidity}%` : "N/A"} | Risk: ${r2}\n\n` +
      `The variance in risk is driven by differences in ambient air temperature and relative humidity, which directly govern your body's evaporative cooling capacity.`;

    const higherCity = rank1 >= rank2 ? city1 : city2;
    return {
      answer,
      suggestion: `You can also ask what precautions to take under ${higherCity}'s risk level, or why humidity affects the heat index.`,
      updatedTopic: "heat_risk",
      updatedEntity: higherCity,
      updatedLocation: higherCity,
    };
  }

  // 2. LOCATION-SPECIFIC QUERIES
  if (intent.topic === "location_weather") {
    const targetLoc = entities.activeLocation || currentCity;
    let locData = targetLoc.toLowerCase() === currentCity.toLowerCase() ? currentProps.weather : null;
    if (!locData) locData = await fetchCityTelemetry(targetLoc);

    if (!locData) {
      return {
        answer: `Data is not currently available for "${targetLoc}". Please check the spelling or search for the city in the top navigation bar.`,
        suggestion: "You can also ask about general heatwave safety precautions or LST satellite monitoring.",
        updatedTopic: "weather",
        updatedEntity: targetLoc,
      };
    }

    const temp = formatTemperature(locData.temperature);
    const hum = locData.humidity;
    const wind = formatWindSpeedKmh(locData.wind_speed);
    const risk = locData.current_heat_risk?.level || locData.heat_risk || null;

    // Why is [City] hot?
    if (intent.subIntent === "why_hot") {
      let driver = "elevated daytime solar insolation combined with low convective wind";
      if (Number(hum) > 65) {
        driver = `high relative humidity (${hum}%) combined with warm ambient temperatures (${temp}). The heavy atmospheric moisture slows down sweat evaporation, trapping body heat and significantly raising the apparent heat index`;
      } else if (Number(wind) < 10) {
        driver = `calm or stagnant airflow (${wind} km/h) alongside ${temp} temperatures, preventing natural convective cooling`;
      }

      const answer =
        `${targetLoc} is hot primarily due to ${driver}. ` +
        `Current atmospheric telemetry indicates ${temp} with ${hum != null ? `${hum}%` : "N/A"} humidity and ${wind != null ? `${wind} km/h` : "N/A"} wind speed, resulting in a **${risk} Heat Risk** classification.`;

      return {
        answer,
        suggestion: `You can also ask if it is safe to go outside in ${targetLoc}, or what precautions to take under this risk level.`,
        updatedTopic: "heat_risk",
        updatedEntity: targetLoc,
        updatedLocation: targetLoc,
      };
    }

    // Is [City] at high heat risk today? / Heat risk status
    if (intent.subIntent === "heat_risk_status") {
      const hasTemperature = locData.temperature != null && Number.isFinite(Number(locData.temperature));
      const temperature = hasTemperature ? formatTemperature(locData.temperature) : "Unavailable";
      const riskLabel = risk || "Unavailable";
      const isHigh = riskLabel.toLowerCase() === "high" || riskLabel.toLowerCase() === "critical";
      const isYesNoQuestion = /^(?:is|are|am|do|does|did|can|could|will|would|should|has|have)\b/i.test(query.trim());
      const directAnswer = !risk
        ? `Current heat-risk data is unavailable for ${targetLoc}.`
        : isYesNoQuestion
          ? isHigh
            ? `Yes, ${targetLoc} is currently at **${riskLabel} Heat Risk**.`
            : `No, ${targetLoc} is currently at **${riskLabel} Heat Risk** (not High or Critical).`
          : `${targetLoc} is currently at **${riskLabel} Heat Risk**.`;
      const thresholds = {
        Low: "below 30°C / 86°F",
        Medium: "from 30°C / 86°F to below 36°C / 96.8°F",
        High: "from 36°C / 96.8°F to below 40°C / 104°F",
        Critical: "40°C / 104°F or above",
      };
      const explanation = !risk
        ? `The project's heat-risk classification is unavailable for these conditions.`
        : hasTemperature && thresholds[risk]
          ? `The project's classifier places temperatures ${thresholds[risk]} in ${risk} risk; the current temperature of ${temperature} falls in that range.`
          : `The current temperature or classification threshold is unavailable, so the reason for this category cannot be confirmed from the displayed data.`;
      const rainfall = locData.rainfall != null ? `${locData.rainfall} mm` : "Unavailable";
      const humidity = hum != null ? `${hum}%` : "Unavailable";
      const windSpeed = locData.wind_speed != null ? `${wind} km/h` : "Unavailable";

      const answer =
        `${directAnswer}\n` +
        `Temperature: ${temperature}\n` +
        `Humidity: ${humidity}\n` +
        `Wind Speed: ${windSpeed}\n` +
        `Rainfall: ${rainfall}\n\n` +
        explanation;

      return {
        answer,
        suggestion: `You can also ask what precautions to take under ${risk} risk, or how much water to drink today.`,
        updatedTopic: "heat_risk",
        updatedEntity: targetLoc,
        updatedLocation: targetLoc,
      };
    }

    // General weather status
    const answer =
      `Current conditions in ${targetLoc}:\n` +
      `• Temperature: ${temp}\n` +
      `• Heat Risk: **${risk}**\n` +
      `• Relative Humidity: ${hum != null ? `${hum}%` : "N/A"}\n` +
      `• Wind Speed: ${wind != null ? `${wind} km/h` : "N/A"}\n` +
      `• Rainfall: ${locData.rainfall ?? 0} mm`;

    return {
      answer,
      suggestion: `You can also ask if it is safe to go outside in ${targetLoc}, or compare ${targetLoc} with another city.`,
      updatedTopic: "weather",
      updatedEntity: targetLoc,
      updatedLocation: targetLoc,
    };
  }

  // 3. LST & SATELLITE
  if (intent.topic === "lst") {
    if (intent.subIntent === "lst_vs_air") {
      const answer =
        `Land Surface Temperature (LST) and 2-meter air temperature measure fundamentally different physical properties:\n\n` +
        `1. **LST (Radiative Skin Temperature)**: Measures the actual warmth of the Earth's physical surface — including asphalt, concrete roofs, bare soil, and vegetation canopy — as detected by satellite thermal radiometers (like NASA's MODIS). Because ground materials directly absorb intense solar radiation, daytime LST in urban areas can be 10–20°C (18–36°F) hotter than the air.\n\n` +
        `2. **Air Temperature**: Measures the kinetic temperature of the atmosphere 1.5 to 2 meters above the ground inside a shaded, ventilated meteorological shelter (Stevenson screen).\n\n` +
        `Monitoring LST via satellites provides a continuous spatial picture of urban heat islands and ground-level heat accumulation that point weather stations cannot capture.`;

      return {
        answer,
        suggestion: "You can also ask how satellite data is used to monitor LST, or what the purpose of the India LST Heat Map is.",
        updatedTopic: "lst",
        updatedEntity: "LST",
      };
    }

    const answer =
      `Land Surface Temperature (LST) is the radiative skin temperature of the Earth's outermost surface. It represents how hot ground surfaces — such as urban concrete, asphalt, soil, and vegetation — feel to the touch.\n\n` +
      `Unlike ambient air temperature measured in shaded weather stations, LST is retrieved globally using thermal infrared radiometers aboard Earth-observation satellites (such as NASA's MODIS on Terra & Aqua). LST is crucial for mapping urban heat islands, agricultural thermal stress, and spatial heatwave boundaries.`;

    return {
      answer,
      suggestion: "You can also ask why LST is different from air temperature, or how satellite imagery helps detect heat.",
      updatedTopic: "lst",
      updatedEntity: "LST",
    };
  }

  if (intent.topic === "satellite") {
    if (intent.subIntent === "hotspots") {
      const answer =
        `Thermal hotspots are detected when satellite-measured Land Surface Temperature (LST) significantly exceeds historical regional baselines or safety thresholds.\n\n` +
        `By evaluating thermal infrared radiometric bands, satellite algorithms isolate high-temperature clusters — such as dense urban city centers, industrial districts, and deforested terrain. These identified hotspots enable municipal disaster authorities to target cooling centers, greening projects, and emergency water distributions.`;

      return {
        answer,
        suggestion: "You can also ask how satellite imagery helps detect heat, or what is LST.",
        updatedTopic: "satellite",
        updatedEntity: "Satellite Hotspots",
      };
    }

    const answer =
      `Satellite imagery detects surface heat using thermal infrared radiometers — such as NASA's MODIS (Moderate Resolution Imaging Spectroradiometer) on the Terra and Aqua satellites.\n\n` +
      `These spaceborne instruments detect electromagnetic radiance emitted in thermal infrared wavelengths (10.5–12.5 µm). Mathematical Planck radiation equations and atmospheric correction models then convert this radiance into continuous spatial maps of Land Surface Temperature (LST) day and night, allowing heatwave monitoring across millions of square kilometers without relying solely on ground stations.`;

    return {
      answer,
      suggestion: "You can also ask how the India LST Heat Map is generated, or what datasets are used in this project.",
      updatedTopic: "satellite",
      updatedEntity: "Satellite Heat Monitoring",
    };
  }

  // 4. EL NIÑO & ENSO
  if (intent.topic === "enso") {
    if (intent.subIntent === "impact_heat") {
      const answer =
        `El Niño releases vast quantities of ocean thermal energy into the atmosphere, altering global circulation cells and frequently elevating average worldwide surface temperatures.\n\n` +
        `In South Asia and India, El Niño conditions are historically correlated with:\n` +
        `• Weakened or delayed summer southwest monsoons\n` +
        `• Prolonged pre-monsoon dry spells and reduced cloud cover\n` +
        `• Increased frequency, duration, and geographic footprint of severe heatwaves\n\n` +
        `While El Niño provides the large-scale atmospheric setup that promotes hotter conditions, localized heatwaves depend on synoptic weather systems and surface moisture deficits rather than a single isolated cause.`;

      return {
        answer,
        suggestion: "You can also ask how El Niño may influence heat patterns in India, or why El Niño matters for this project.",
        updatedTopic: "enso",
        updatedEntity: "El Niño",
      };
    }

    const answer =
      `The El Niño–Southern Oscillation (ENSO) is a coupled ocean-atmosphere climate cycle centered in the equatorial Pacific Ocean. It shifts between three phases:\n\n` +
      `1. **El Niño (Warm Phase)**: Easterly trade winds weaken, allowing warm ocean waters to pool eastward. This alters global jet streams and storm tracks, often driving hotter, drier conditions across South Asia.\n` +
      `2. **La Niña (Cool Phase)**: Trade winds strengthen, concentrating cooler waters in the eastern Pacific, generally favoring active Indian monsoons.\n` +
      `3. **Neutral Phase**: Ocean temperatures remain close to historical climatological averages.\n\n` +
      `ENSO activity is monitored internationally using the Oceanic Niño Index (ONI), tracking Sea Surface Temperature (SST) anomalies in the central Pacific Niño 3.4 region.`;

    return {
      answer,
      suggestion: "You can also ask how El Niño affects heat, or how does it affect India.",
      updatedTopic: "enso",
      updatedEntity: "ENSO",
    };
  }

  // 5. ATMOSPHERIC PHYSICS
  if (intent.topic === "atmospheric_physics") {
    if (intent.subIntent === "humidity_importance") {
      const answer =
        `Humidity is critically important during extreme heat because of how human thermoregulation works.\n\n` +
        `The primary biological mechanism for cooling down the body is the **latent heat of vaporization** through sweat evaporation. When relative humidity is high, the surrounding air is already saturated with water vapor, drastically slowing down the rate at which sweat can evaporate from your skin.\n\n` +
        `As a result, metabolic heat remains trapped inside your body, causing the apparent temperature (heat index) to feel significantly hotter than the dry-bulb thermometer reading and substantially increasing the risk of heat exhaustion and heatstroke.`;

      return {
        answer,
        suggestion: "You can also ask what the signs of dehydration are, or what precautions to take under high heat.",
        updatedTopic: "atmospheric_physics",
        updatedEntity: "Humidity",
      };
    }

    if (intent.subIntent === "wind_effect") {
      const answer =
        `Wind speed directly influences human comfort through convective heat loss. As breeze moves across your skin, it sweeps away the thin, warm, humid boundary layer of air, accelerating sweat evaporation.\n\n` +
        `Calm or stagnant air traps this humid layer near the body, causing thermal stress to escalate rapidly even at moderate temperatures.`;

      return {
        answer,
        suggestion: "You can also ask why humidity is important during extreme heat, or how heat risk is calculated.",
        updatedTopic: "atmospheric_physics",
        updatedEntity: "Wind Speed",
      };
    }

    if (intent.subIntent === "rainfall_effect") {
      const answer =
        `Rainfall provides immediate natural relief from heatwaves through evaporative cooling (rain evaporating absorbs sensible heat from the air) and by increasing soil moisture. Wet soil dissipates subsequent solar radiation through latent heat flux rather than heating the air.`;

      return {
        answer,
        suggestion: "You can also ask what is a heatwave, or how this system predicts heat risk.",
        updatedTopic: "atmospheric_physics",
        updatedEntity: "Rainfall",
      };
    }
  }

  // 6. PROJECT METHODOLOGY & PREDICTIONS
  if (intent.topic === "project_prediction") {
    const answer =
      `The 2026 India Land Surface Temperature prediction module models multi-year historical trajectories using satellite observations from 2020 through 2025 across all 34 Indian states and Union Territories.\n\n` +
      `Key Methodology:\n` +
      `• Historical MODIS LST records (2020–2025) are analyzed for each state.\n` +
      `• Linear regression trend modeling and rate-of-change momentum are applied to project the 2026 state-wise average LST.\n` +
      `• Each projected 2026 LST is dynamically categorized into standardized Celsius-based heat-risk tiers (<30°C / <86°F Low, 30–<36°C / 86–<96.8°F Moderate, 36–<40°C / 96.8–<104°F High, ≥40°C / ≥104°F Critical) to support proactive heatwave preparedness.`;

    return {
      answer,
      suggestion: "You can also ask what datasets are used in this project, or how this system predicts heat risk.",
      updatedTopic: "project_prediction",
      updatedEntity: "2026 Prediction",
    };
  }

  if (intent.topic === "project_methodology") {
    if (intent.subIntent === "datasets") {
      const answer =
        `This system integrates four verified real-world data sources:\n\n` +
        `1. **Live Weather API**: Real-time ambient temperature, relative humidity, wind speed, and precipitation for monitored cities.\n` +
        `2. **NASA MODIS Satellite Observations**: Multi-year Land Surface Temperature (LST) datasets from Terra & Aqua satellites covering Indian states (2020–2025).\n` +
        `3. **Climate Indices (NOAA ONI)**: Oceanic Niño Index tracking Sea Surface Temperature (SST) anomalies across the Niño 3.4 Pacific region.\n` +
        `4. **Supervised ML Dataset**: Validated meteorological records used to train the Random Forest classification model.`;

      return {
        answer,
        suggestion: "You can also ask how this system predicts heat risk, or how the 2026 prediction was generated.",
        updatedTopic: "project_methodology",
        updatedEntity: "Project Datasets",
      };
    }

    const answer =
      `This system predicts heat risk using a Machine Learning pipeline powered by a Random Forest Classifier trained on meteorological and environmental heat factors.\n\n` +
      `The model evaluates four real-time inputs:\n` +
      `1. Ambient Temperature (°C / °F)\n` +
      `2. Relative Humidity (%)\n` +
      `3. Precipitation / Rainfall (mm)\n` +
      `4. Wind Speed (km/h)\n\n` +
      `It categorizes Celsius-based thermal conditions into the same Fahrenheit-equivalent risk tiers: Low (<30°C / <86°F), Moderate (30–<36°C / 86–<96.8°F), High (36–<40°C / 96.8–<104°F), and Critical (≥40°C / ≥104°F).`;

    return {
      answer,
      suggestion: "You can also ask what datasets are used in this project, or how the 2026 prediction was generated.",
      updatedTopic: "project_methodology",
      updatedEntity: "Random Forest Model",
    };
  }

  if (intent.topic === "project_lst_map") {
    const answer =
      `The India LST Heat Map provides an interactive spatial visualization of state-wise Land Surface Temperature across all 34 Indian states and Union Territories from 2020 through 2025.\n\n` +
      `Its purpose is to:\n` +
      `• Track longitudinal surface heating patterns and identify persistent thermal hotspots across India.\n` +
      `• Apply consistent Celsius-based risk thresholds (<30°C / <86°F Low, 30–<36°C / 86–<96.8°F Moderate, 36–<40°C / 96.8–<104°F High, ≥40°C / ≥104°F Critical) across all historical years.\n` +
      `• Provide regional vulnerability comparisons to inform public health advisories and urban heat mitigation.`;

    return {
      answer,
      suggestion: "You can also ask what is LST, or how the 2026 prediction was generated.",
      updatedTopic: "project_lst_map",
      updatedEntity: "India LST Map",
    };
  }

  // 7. HEAT RISK CONCEPT
  if (intent.topic === "heat_risk_concept") {
    if (intent.subIntent === "why_high_risk") {
      let contextNote = "";
      if (currentCity && currentTemp != null) {
        contextNote = ` Currently in ${currentCity}, conditions are ${formatTemperature(currentTemp)} with ${currentRisk} heat risk.`;
      }
      const answer =
        `Heat risk reaches High or Critical levels when elevated ambient temperatures combine with high relative humidity, low wind speed, or intense solar radiation.\n\n` +
        `High humidity prevents sweat from evaporating effectively, trapping body heat internally and driving the apparent temperature (heat index) much higher than the thermometer reading.${contextNote}`;

      return {
        answer,
        suggestion: "You can also ask what precautions to take under this risk level, or why humidity is important during extreme heat.",
        updatedTopic: "heat_risk",
        updatedEntity: "Heat Risk Drivers",
      };
    }

    if (intent.subIntent === "tier_explanation" && intent.tier) {
      const descriptions = {
        Low: "Low Heat Risk signifies mild thermal conditions that are safe for normal daily outdoor activities, requiring only basic routine hydration.",
        Moderate: "Moderate Heat Risk indicates elevated temperatures where extended outdoor exposure can cause discomfort and mild heat stress. Sensitive groups (elderly, young children, outdoor laborers) should take shaded breaks and drink water regularly.",
        High: "High Heat Risk indicates hazardous thermal conditions where prolonged outdoor exposure significantly increases the danger of heat cramps, exhaustion, and heatstroke. Limit outdoor activity between 11:00 AM and 4:00 PM and stay in shaded or air-conditioned environments.",
        Critical: "Critical Heat Risk represents an emergency level of life-threatening heat. The body's thermoregulation can rapidly fail even during minimal exertion. All non-essential outdoor travel should be suspended, and individuals must remain in cooled indoor spaces with immediate access to fluids.",
      };

      const answer =
        `**${intent.tier} Heat Risk**:\n` +
        `${descriptions[intent.tier] || descriptions.Moderate}`;

      return {
        answer,
        suggestion: `You can also ask what precautions to take under ${intent.tier} risk, or how much water to drink.`,
        updatedTopic: "heat_risk",
        updatedEntity: `${intent.tier} Heat Risk`,
      };
    }

    const answer =
      `Heat risk is a comprehensive assessment of the danger that current thermal conditions pose to human health.\n\n` +
      `Rather than looking solely at air temperature, heat risk integrates ambient temperature, relative humidity, wind speed, and precipitation to determine how effectively the human body can dissipate heat. This system classifies conditions into four standardized tiers: Low, Moderate, High, and Critical.`;

    return {
      answer,
      suggestion: "You can also ask what High Heat Risk means, or what precautions to take during a heatwave.",
      updatedTopic: "heat_risk",
      updatedEntity: "Heat Risk",
    };
  }

  // 8. HEAT SAFETY & OUTDOOR ACTIVITIES
  if (intent.topic === "safety") {
    if (intent.subIntent === "heatstroke_symptoms") {
      const answer =
        `Heat exhaustion and heatstroke are serious medical conditions:\n\n` +
        `• **Heat Exhaustion**: Heavy sweating, pale clammy skin, fast weak pulse, nausea, dizziness, headache, and muscle cramps. Move to a cooler shaded space, loosen clothing, and sip water.\n\n` +
        `• **Heatstroke (Medical Emergency)**: Core body temperature above 40°C / 104°F, hot dry skin or heavy sweating, confusion, slurred speech, rapid pulse, or fainting. Heatstroke can be fatal without immediate cooling.\n\n` +
        `*Immediate action: Move the person into shade or air conditioning, apply cool damp cloths or ice to neck and armpits, and contact emergency medical services right away.*`;

      return {
        answer,
        suggestion: "You can also ask what are the signs of dehydration, or what precautions to take during a heatwave.",
        updatedTopic: "safety",
        updatedEntity: "Heatstroke",
      };
    }

    let cityContext = "";
    if (currentCity && currentTemp != null) {
      cityContext = `For current conditions in ${currentCity} (${formatTemperature(currentTemp)}, ${currentRisk} heat risk):\n`;
    }

    const answer =
      `${cityContext}` +
      `During periods of extreme heat and heatwaves, follow these practical safety guidelines:\n` +
      `• **Limit Peak Sun Exposure**: Avoid strenuous outdoor activity between 11:00 AM and 4:00 PM when solar radiation is highest.\n` +
      `• **Hydrate Continuously**: Drink water or electrolyte-rich fluids at regular intervals; do not wait until thirst sets in.\n` +
      `• **Protective Attire**: Wear lightweight, loose-fitting, light-colored cotton clothing, UV-blocking sunglasses, and a wide-brimmed hat.\n` +
      `• **Cool Living Spaces**: Draw blinds during peak sun hours and use cross-ventilation, fans, or air conditioning.\n` +
      `• **Vehicle Safety**: Never leave children, elderly adults, or pets unattended in parked vehicles.\n` +
      `• **Vulnerable Care**: Check on elderly neighbors, outdoor workers, and young children.`;

    return {
      answer,
      suggestion: "You can also ask how much water to drink, or what the signs of dehydration are.",
      updatedTopic: "safety",
      updatedEntity: "Heat Safety",
    };
  }

  // 9. HYDRATION & DEHYDRATION
  if (intent.topic === "hydration") {
    if (intent.subIntent === "dehydration_signs") {
      const answer =
        `Warning signs of dehydration include:\n\n` +
        `• **Mild to Moderate**: Dry or sticky mouth, dark yellow or amber urine, headache, dizziness, fatigue, and sluggishness.\n` +
        `• **Severe (Requires Immediate Medical Care)**: Extreme thirst, lack of sweating, rapid heartbeat, sunken eyes, confusion, and fainting.\n\n` +
        `*General guidance: Rehydrate promptly with water and oral rehydration salts (ORS). If severe symptoms or confusion appear, seek professional medical care immediately. This guidance is for awareness and does not replace clinical diagnosis.*`;

      return {
        answer,
        suggestion: "You can also ask how much water to drink during a heatwave, or what precautions to take.",
        updatedTopic: "hydration",
        updatedEntity: "Dehydration",
      };
    }

    let cityHydrationNote = "";
    if (currentCity && currentTemp != null) {
      cityHydrationNote = ` In ${currentCity} (${formatTemperature(currentTemp)}, ${currentRisk} risk), aiming for at least 3–4 liters today is recommended.`;
    }

    const answer =
      `During periods of elevated heat, health authorities generally advise drinking between 3 and 5 liters of fluids daily, depending on physical activity and sun exposure.${cityHydrationNote}\n\n` +
      `Key hydration guidelines:\n` +
      `• Sip fluids continuously throughout the day rather than drinking large amounts occasionally.\n` +
      `• Replenish lost minerals with electrolyte-rich drinks like coconut water, lemon water with a pinch of salt, or buttermilk.\n` +
      `• Limit alcohol, excessive caffeine, and heavily sweetened drinks as they can promote fluid loss.\n\n` +
      `*Note: Individuals with specific medical conditions (such as kidney or heart conditions requiring fluid restriction) should consult their physician.*`;

    return {
      answer,
      suggestion: "You can also ask what are the signs of dehydration, or what precautions to take during a heatwave.",
      updatedTopic: "hydration",
      updatedEntity: "Hydration",
    };
  }

  // 10. HEATWAVE DEFINITION
  if (intent.topic === "heatwave") {
    let locNote = "";
    if (currentCity && currentTemp != null) {
      locNote = `\n\nCurrent location context:\n${currentCity} — ${formatTemperature(currentTemp)}, ${currentRisk} risk.`;
    }

    const answer =
      `A heatwave is a period of unusually high temperatures that lasts for several consecutive days or weeks compared with the normal climatological temperature of a particular area.\n\n` +
      `Heatwaves occur when static high-pressure atmospheric systems trap warm air near the ground. They significantly increase the risk of dehydration, heat exhaustion, and heatstroke, especially for children, older adults, and outdoor laborers.${locNote}`;

    return {
      answer,
      suggestion: "You can also ask what precautions to take during a heatwave, or what High Heat Risk means.",
      updatedTopic: "heatwave",
      updatedEntity: "Heatwave",
    };
  }

  // 11. GREETING
  if (intent.topic === "greeting") {
    let greetingLoc = "";
    if (currentCity && currentTemp != null) {
      greetingLoc = ` Current conditions in ${currentCity}: ${formatTemperature(currentTemp)}, ${currentRisk} heat risk.`;
    }
    const answer =
      `Hello! I am your AI Heatwave Assistant.${greetingLoc} ` +
      `You can ask me about heatwave risks, satellite Land Surface Temperature (LST), El Niño climate patterns, weather conditions in any city, or safety and hydration guidelines.`;

    return {
      answer,
      suggestion: "You can also ask what is a heatwave, or what is the heat risk in Chennai.",
      updatedTopic: "greeting",
      updatedEntity: "AI Assistant",
    };
  }

  // 12. UNRELATED / GENERAL QUERIES
  const answer =
    `I am an environmental heat and climate assistant specialized in heatwaves, Land Surface Temperature (LST), satellite observations, and El Niño patterns.\n\n` +
    `While I cannot answer questions outside of environmental heat and climate, I can help analyze heat risk, current weather parameters, or satellite data for any city.`;

  return {
    answer,
    suggestion: "You can also ask what is a heatwave, what is LST, or what is the current heat risk in Chennai.",
    updatedTopic: "general",
    updatedEntity: null,
  };
}

/**
 * Main process pipeline:
 * Coreference resolution -> Entity extraction -> Intent classification -> Dynamic synthesis
 */
export async function processUserQuery(rawInput, { weather, currentHeatRisk, context = {}, setContext }) {
  // Step 1: Coreference resolution
  const { resolvedQuery } = resolveCoreference(rawInput, context);

  // Step 2: Extract Entities
  const entities = extractEntities(resolvedQuery, context);

  // Step 3: Classify Intent
  const intent = classifyIntent(resolvedQuery, entities);

  // Step 4: Synthesize Contextual Answer
  const currentProps = { weather, currentHeatRisk };
  const result = await synthesizeResponse(intent, entities, resolvedQuery, currentProps);

  // Step 5: Update Conversational Context State
  if (setContext) {
    setContext((prev) => ({
      ...prev,
      lastTopic: result.updatedTopic || prev.lastTopic || intent.topic,
      lastEntity: result.updatedEntity || prev.lastEntity,
      lastLocation: result.updatedLocation || entities.activeLocation || prev.lastLocation,
      currentCity: weather?.city || prev.currentCity,
    }));
  }

  // Format full message: Answer + Dynamic Suggestion (if available)
  const fullText = result.suggestion
    ? `${result.answer}\n\n${result.suggestion}`
    : result.answer;

  return fullText;
}
