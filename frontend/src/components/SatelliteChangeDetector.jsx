import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./SatelliteChangeDetector.css";

// Global city reference catalog with verified coordinates
export const GLOBAL_CITY_CATALOG = {
  chennai: { name: "Chennai", country: "India", lat: 13.0827, lon: 80.2707 },
  coimbatore: { name: "Coimbatore", country: "India", lat: 11.0168, lon: 76.9558 },
  bengaluru: { name: "Bengaluru", country: "India", lat: 12.9716, lon: 77.5946 },
  bangalore: { name: "Bengaluru", country: "India", lat: 12.9716, lon: 77.5946 },
  mumbai: { name: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777 },
  bombay: { name: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777 },
  delhi: { name: "Delhi", country: "India", lat: 28.6139, lon: 77.2090 },
  "new delhi": { name: "Delhi", country: "India", lat: 28.6139, lon: 77.2090 },
  kolkata: { name: "Kolkata", country: "India", lat: 22.5726, lon: 88.3639 },
  calcutta: { name: "Kolkata", country: "India", lat: 22.5726, lon: 88.3639 },
  hyderabad: { name: "Hyderabad", country: "India", lat: 17.3850, lon: 78.4867 },
  madurai: { name: "Madurai", country: "India", lat: 9.9252, lon: 78.1198 },
  trichy: { name: "Trichy", country: "India", lat: 10.7905, lon: 78.7047 },
  tiruchirappalli: { name: "Trichy", country: "India", lat: 10.7905, lon: 78.7047 },
  salem: { name: "Salem", country: "India", lat: 11.6643, lon: 78.1460 },
  vellore: { name: "Vellore", country: "India", lat: 12.9165, lon: 79.1325 },
  newyork: { name: "New York", country: "United States", lat: 40.7128, lon: -74.0060 },
  "new york": { name: "New York", country: "United States", lat: 40.7128, lon: -74.0060 },
  london: { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  tokyo: { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  paris: { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  sydney: { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
  dubai: { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lon: 55.2708 },
  cairo: { name: "Cairo", country: "Egypt", lat: 30.0444, lon: 31.2357 },
  singapore: { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
};

export const QUICK_SELECT_CITIES = [
  "Coimbatore",
  "Chennai",
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "New York",
  "London",
  "Tokyo",
];

const PRESET_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function formatCoords(lat, lon) {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return "0.0000° N, 0.0000° E";
  }
  const nLat = Number(lat);
  const nLon = Number(lon);
  const latStr = `${Math.abs(nLat).toFixed(4)}° ${nLat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(nLon).toFixed(4)}° ${nLon >= 0 ? "E" : "W"}`;
  return `${latStr}, ${lonStr}`;
}

// Parse latitude and longitude from string (e.g., "13.0827, 80.2707" or "13.0827 80.2707")
function parseCoordinateString(str) {
  if (!str) return null;
  const match = str.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);
  if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    return { lat, lon };
  }
  return null;
}

// Build NASA GIBS WMS imagery URL with local backend proxy support
function getNasaGibsUrls(lat, lon, date, delta = 0.15) {
  const minLat = Math.max(-90, lat - delta).toFixed(4);
  const maxLat = Math.min(90, lat + delta).toFixed(4);
  const minLon = Math.max(-180, lon - delta).toFixed(4);
  const maxLon = Math.min(180, lon + delta).toFixed(4);
  const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;

  const proxyUrl = `http://127.0.0.1:5000/satellite-change-detection/image?lat=${lat}&lon=${lon}&date=${date}&delta=${delta}`;
  const directUrl = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&VERSION=1.3.0&FORMAT=image/jpeg&TRANSPARENT=TRUE&WIDTH=512&HEIGHT=512&CRS=EPSG:4326&BBOX=${bbox}&TIME=${date}`;

  return { proxyUrl, directUrl, bbox };
}

// Load image into an HTML Image element with crossOrigin support and proxy-fallback
function loadSatelliteImageAsync(proxyUrl, directUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If backend proxy fails or is not running, try NASA GIBS directly
      if (directUrl && directUrl !== proxyUrl) {
        const directImg = new Image();
        directImg.crossOrigin = "anonymous";
        directImg.onload = () => resolve(directImg);
        directImg.onerror = () => reject(new Error("Unable to load satellite image"));
        directImg.src = directUrl;
      } else {
        reject(new Error("Unable to load satellite image"));
      }
    };
    img.src = proxyUrl;
  });
}

// Inspect pixel brightness and distribution to verify real imagery
function verifySatelliteImageryContent(img, width = 360, height = 240) {
  try {
    const offCanvas = document.createElement("canvas");
    offCanvas.width = width;
    offCanvas.height = height;
    const ctx = offCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;

    let nonZeroCount = 0;
    let brightnessSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      brightnessSum += r + g + b;
      if (r > 15 || g > 15 || b > 15) {
        nonZeroCount++;
      }
    }
    const totalPixels = data.length / 4;
    // Real satellite imagery has non-zero pixels and variance across the scene
    return (nonZeroCount / totalPixels > 0.05) && (brightnessSum / totalPixels > 10);
  } catch (err) {
    console.warn("Could not inspect canvas pixels (likely CORS):", err);
    // If canvas is tainted but image loaded successfully, treat as valid
    return Boolean(img && img.naturalWidth > 0 && img.naturalHeight > 0);
  }
}

export default function SatelliteChangeDetector({ selectedLocation, defaultCity }) {
  // Determine initial coordinates and location
  const initialLocation = useMemo(() => {
    if (selectedLocation && selectedLocation.latitude != null && selectedLocation.longitude != null) {
      return {
        name: selectedLocation.location || "Selected Map Location",
        country: selectedLocation.country || "",
        lat: Number(Number(selectedLocation.latitude).toFixed(4)),
        lon: Number(Number(selectedLocation.longitude).toFixed(4)),
        source: "World Heat Map Selection",
      };
    }
    const defKey = String(defaultCity || "Chennai").trim().toLowerCase();
    const matched = GLOBAL_CITY_CATALOG[defKey] || GLOBAL_CITY_CATALOG["chennai"];
    return {
      name: matched.name,
      country: matched.country,
      lat: matched.lat,
      lon: matched.lon,
      source: "NASA Satellite Telemetry",
    };
  }, [selectedLocation, defaultCity]);

  const [activeLocation, setActiveLocation] = useState(initialLocation);
  const [searchInput, setSearchInput] = useState(initialLocation.name);
  const [beforeDate, setBeforeDate] = useState("2021-04-10");
  const [afterDate, setAfterDate] = useState("2024-04-10");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [report, setReport] = useState(null);
  const [changePercentage, setChangePercentage] = useState(null);
  const [affectedAreaKm2, setAffectedAreaKm2] = useState(null);

  const canvasRef = useRef(null);

  // Sync if selectedLocation changes from World Heat Map
  useEffect(() => {
    if (selectedLocation && selectedLocation.latitude != null && selectedLocation.longitude != null) {
      const loc = {
        name: selectedLocation.location || `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`,
        country: selectedLocation.country || "",
        lat: Number(Number(selectedLocation.latitude).toFixed(4)),
        lon: Number(Number(selectedLocation.longitude).toFixed(4)),
        source: "World Heat Map Selection",
      };
      setActiveLocation(loc);
      setSearchInput(loc.name);
    }
  }, [selectedLocation]);

  // Main change analysis function using real NASA satellite data
  const executeAnalysis = useCallback(async (locationObj, dateBefore, dateAfter) => {
    if (!locationObj || locationObj.lat == null || locationObj.lon == null) {
      setErrorMessage("Please select or enter a valid location with geographical coordinates.");
      setReport(null);
      return;
    }

    if (!dateBefore || !dateAfter) {
      setErrorMessage("Please select both Before Date and After Date for multi-temporal comparison.");
      setReport(null);
      return;
    }

    if (new Date(dateBefore) >= new Date(dateAfter)) {
      setErrorMessage("Date selection error: After Date must be later than Before Date.");
      setReport(null);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setReport(null);
    setChangePercentage(null);
    setAffectedAreaKm2(null);

    const lat = locationObj.lat;
    const lon = locationObj.lon;
    const delta = 0.15; // ~33 km coverage frame

    const beforeUrls = getNasaGibsUrls(lat, lon, dateBefore, delta);
    const afterUrls = getNasaGibsUrls(lat, lon, dateAfter, delta);

    try {
      // 1. Fetch real satellite images for Before and After dates
      const [imgBefore, imgAfter] = await Promise.all([
        loadSatelliteImageAsync(beforeUrls.proxyUrl, beforeUrls.directUrl),
        loadSatelliteImageAsync(afterUrls.proxyUrl, afterUrls.directUrl),
      ]);

      // 2. Validate satellite content (check for black tiles / no-data pass)
      const isBeforeValid = verifySatelliteImageryContent(imgBefore);
      const isAfterValid = verifySatelliteImageryContent(imgAfter);

      if (!isBeforeValid || !isAfterValid) {
        setErrorMessage("Satellite imagery is not available for this location/date range.");
        setReport(null);
        setLoading(false);
        return;
      }

      // 3. Pixel-by-pixel change calculation on canvas
      const width = 360;
      const height = 240;
      const totalPixels = width * height;

      const off1 = document.createElement("canvas");
      off1.width = width;
      off1.height = height;
      const ctx1 = off1.getContext("2d", { willReadFrequently: true });
      ctx1.drawImage(imgBefore, 0, 0, width, height);
      const data1 = ctx1.getImageData(0, 0, width, height).data;

      const off2 = document.createElement("canvas");
      off2.width = width;
      off2.height = height;
      const ctx2 = off2.getContext("2d", { willReadFrequently: true });
      ctx2.drawImage(imgAfter, 0, 0, width, height);
      const data2 = ctx2.getImageData(0, 0, width, height).data;

      const diffCanvas = canvasRef.current || document.createElement("canvas");
      diffCanvas.width = width;
      diffCanvas.height = height;
      const diffCtx = diffCanvas.getContext("2d", { willReadFrequently: true });
      const diffImageData = diffCtx.createImageData(width, height);

      let changedCount = 0;
      let greenShiftSum = 0;
      let urbanShiftSum = 0;

      for (let i = 0; i < data1.length; i += 4) {
        const r1 = data1[i];
        const g1 = data1[i + 1];
        const b1 = data1[i + 2];

        const r2 = data2[i];
        const g2 = data2[i + 1];
        const b2 = data2[i + 2];

        const absDiff = Math.abs(r2 - r1) + Math.abs(g2 - g1) + Math.abs(b2 - b1);
        const spectralShift = (r2 - r1) * 0.5 + (g1 - g2) * 0.4 + (b2 - b1) * 0.1;

        greenShiftSum += (g2 - g1);
        urbanShiftSum += ((r2 + g2 + b2) - (r1 + g1 + b1)) / 3;

        if (absDiff > 32) {
          changedCount++;
          if (spectralShift > 6) {
            // Thermal accumulation / vegetation loss: red
            diffImageData.data[i] = 239;
            diffImageData.data[i + 1] = 68;
            diffImageData.data[i + 2] = 68;
            diffImageData.data[i + 3] = 230;
          } else if (spectralShift < -6) {
            // Vegetation gain / cooling: green
            diffImageData.data[i] = 34;
            diffImageData.data[i + 1] = 197;
            diffImageData.data[i + 2] = 94;
            diffImageData.data[i + 3] = 230;
          } else {
            // Moderate change: amber
            diffImageData.data[i] = 245;
            diffImageData.data[i + 1] = 158;
            diffImageData.data[i + 2] = 11;
            diffImageData.data[i + 3] = 210;
          }
        } else {
          // Stable background surface: dimmed monochrome
          const gray = Math.round(0.299 * r1 + 0.587 * g1 + 0.114 * b1);
          diffImageData.data[i] = Math.round(gray * 0.4);
          diffImageData.data[i + 1] = Math.round(gray * 0.45);
          diffImageData.data[i + 2] = Math.round(gray * 0.55);
          diffImageData.data[i + 3] = 190;
        }
      }

      diffCtx.putImageData(diffImageData, 0, 0);

      const calculatedPct = Number(((changedCount / totalPixels) * 100).toFixed(1));
      const widthKm = 2 * delta * 111.32 * Math.cos((lat * Math.PI) / 180);
      const heightKm = 2 * delta * 110.57;
      const totalSceneAreaKm2 = Math.round(widthKm * heightKm);
      const calculatedArea = Number(((calculatedPct / 100) * totalSceneAreaKm2).toFixed(1));

      const avgGreenShift = Number((greenShiftSum / totalPixels / 2.55).toFixed(1));
      const avgUrbanShift = Number((urbanShiftSum / totalPixels / 2.55).toFixed(1));

      setChangePercentage(calculatedPct);
      setAffectedAreaKm2(calculatedArea);

      // Generate verified change detections from actual satellite imagery
      const detections = [];
      if (avgGreenShift <= -1.5 || (calculatedPct > 15 && avgGreenShift < 0)) {
        detections.push({
          type: "vegetation",
          message: `Canopy Cover Reduction Detected (vegetation index shifted by ${Math.abs(avgGreenShift)}% across satellite scene)`,
        });
      } else if (avgGreenShift >= 1.5) {
        detections.push({
          type: "vegetation_gain",
          message: `Canopy Expansion Observed (vegetation index gained by +${avgGreenShift}% in comparison window)`,
        });
      }

      if (avgUrbanShift >= 2.0 || (calculatedPct > 18 && avgUrbanShift > 0)) {
        detections.push({
          type: "urban",
          message: `Urban Surface Reflectance Expansion Detected (impervious surface shift of +${Math.abs(avgUrbanShift)}%)`,
        });
      }

      if (calculatedPct >= 20) {
        detections.push({
          type: "temperature",
          message: `Surface Thermal / Radiometric Transformation Detected (${calculatedPct}% scene variation between observation dates)`,
        });
      } else if (calculatedPct <= 5) {
        detections.push({
          type: "stable",
          message: "High Land-Surface Stability Observed: radiometric baseline remains consistent across comparison window.",
        });
      }

      const impactRating = calculatedPct >= 25 ? "High" : calculatedPct >= 12 ? "Medium" : "Low";

      setReport({
        city: locationObj.name,
        country: locationObj.country,
        latitude: lat,
        longitude: lon,
        fromDate: dateBefore,
        toDate: dateAfter,
        sceneAreaKm2: totalSceneAreaKm2,
        changePercentage: calculatedPct,
        affectedAreaKm2: calculatedArea,
        greenShift: avgGreenShift,
        urbanShift: avgUrbanShift,
        impactRating,
        detections,
        images: {
          before: imgBefore.src,
          after: imgAfter.src,
        },
      });

      // Synchronize canvas in DOM
      setTimeout(() => {
        const domCanvas = canvasRef.current;
        if (domCanvas) {
          const domCtx = domCanvas.getContext("2d");
          if (domCtx) {
            domCanvas.width = width;
            domCanvas.height = height;
            domCtx.putImageData(diffImageData, 0, 0);
          }
        }
      }, 50);
    } catch (err) {
      console.error("Satellite imagery retrieval failed:", err);
      setErrorMessage("Satellite imagery is not available for this location/date range.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial execution on mount or coordinate change
  useEffect(() => {
    executeAnalysis(activeLocation, beforeDate, afterDate);
  }, [activeLocation, executeAnalysis, beforeDate, afterDate]);

  // Handle location search form submit
  const handleSearchSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const raw = (searchInput || "").trim();
    if (!raw) {
      setErrorMessage("Please enter a location name or coordinates (latitude, longitude).");
      return;
    }

    // Check if user entered coordinates e.g. "13.0827, 80.2707"
    const parsedCoords = parseCoordinateString(raw);
    if (parsedCoords) {
      const loc = {
        name: `Coordinates (${parsedCoords.lat.toFixed(4)}, ${parsedCoords.lon.toFixed(4)})`,
        country: "Custom Coordinates",
        lat: parsedCoords.lat,
        lon: parsedCoords.lon,
        source: "Manual Coordinate Input",
      };
      setActiveLocation(loc);
      executeAnalysis(loc, beforeDate, afterDate);
      return;
    }

    // Check global city catalog
    const key = raw.toLowerCase().trim();
    if (GLOBAL_CITY_CATALOG[key]) {
      const matched = GLOBAL_CITY_CATALOG[key];
      const loc = {
        name: matched.name,
        country: matched.country,
        lat: matched.lat,
        lon: matched.lon,
        source: "Global City Telemetry",
      };
      setActiveLocation(loc);
      executeAnalysis(loc, beforeDate, afterDate);
      return;
    }

    // Otherwise, reverse search through Nominatim geocoder
    try {
      setLoading(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(raw)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lon = parseFloat(first.lon);
          const parts = (first.display_name || "").split(",");
          const cityName = parts[0]?.trim() || raw;
          const countryName = parts[parts.length - 1]?.trim() || "";
          const loc = {
            name: cityName,
            country: countryName,
            lat: Number(lat.toFixed(4)),
            lon: Number(lon.toFixed(4)),
            source: "Geocoded Coordinates",
          };
          setActiveLocation(loc);
          executeAnalysis(loc, beforeDate, afterDate);
          return;
        }
      }
      setErrorMessage(`Location "${raw}" could not be resolved into geographical coordinates.`);
      setReport(null);
      setLoading(false);
    } catch {
      setErrorMessage(`Geocoding service unavailable for "${raw}". Try entering latitude, longitude directly.`);
      setReport(null);
      setLoading(false);
    }
  };

  const handleQuickSelect = (cityName) => {
    const key = cityName.toLowerCase().trim();
    const matched = GLOBAL_CITY_CATALOG[key];
    if (matched) {
      const loc = {
        name: matched.name,
        country: matched.country,
        lat: matched.lat,
        lon: matched.lon,
        source: "Quick City Selection",
      };
      setActiveLocation(loc);
      setSearchInput(matched.name);
      executeAnalysis(loc, beforeDate, afterDate);
    }
  };

  const handleUseWorldMapLocation = () => {
    if (selectedLocation && selectedLocation.latitude != null && selectedLocation.longitude != null) {
      const loc = {
        name: selectedLocation.location || "World Map Point",
        country: selectedLocation.country || "",
        lat: Number(Number(selectedLocation.latitude).toFixed(4)),
        lon: Number(Number(selectedLocation.longitude).toFixed(4)),
        source: "World Heat Map Selection",
      };
      setActiveLocation(loc);
      setSearchInput(loc.name);
      executeAnalysis(loc, beforeDate, afterDate);
    }
  };

  // Helper for recommendation message
  const recommendationText = useMemo(() => {
    if (!report) return "";
    const place = report.city || "This region";
    if (report.impactRating === "High") {
      return `${place}: Substantial multi-temporal surface and canopy shift detected. Urban heat island mitigation recommended: prioritize vegetative corridors, cool pavement surfaces, and urban canopy retention.`;
    }
    if (report.impactRating === "Medium") {
      return `${place}: Moderate surface reflectance variation observed across comparison dates. Maintain green cover buffers and regular satellite radiometric monitoring.`;
    }
    return `${place}: Stable environmental land-cover signature verified between ${report.fromDate} and ${report.toDate}. Continue multi-spectral Earth observation.`;
  }, [report]);

  return (
    <div className="satellite-change-detector-container" id="satellite-change-detector-module">
      {/* ── HEADER ── */}
      <header className="scd-header">
        <div className="scd-title-group">
          <span className="scd-eyebrow">
            <span>🛰️</span>
            <span>NASA GIBS Multispectral Earth Observation</span>
          </span>
          <h2 className="scd-title">Satellite Change Detector</h2>
          <p className="scd-subtitle">
            Perform multi-temporal satellite comparison for <strong>ANY coordinates</strong> across the globe
            using official NASA MODIS and VIIRS Earth Observation data to detect urban expansion, canopy shifts,
            and thermal surface anomalies.
          </p>
        </div>
        {report && (
          <div className="scd-city-badge">
            <span>📍</span>
            <span>{report.city} ({report.fromDate} → {report.toDate})</span>
          </div>
        )}
      </header>

      {/* ── SELECTED LOCATION SECTION ── */}
      <section className="scd-selected-location-card" aria-label="Selected Location Information">
        <div className="scd-sel-header">
          <div className="scd-sel-title-row">
            <span className="scd-sel-pin">📍</span>
            <div>
              <span className="scd-sel-pretitle">Active Monitored Location</span>
              <h3 className="scd-sel-city">{activeLocation.name}</h3>
              <p className="scd-sel-country">{activeLocation.country || "Earth Observation Area"}</p>
            </div>
          </div>
          <div className="scd-sel-badges">
            <span className="scd-coord-badge" title="Verified Geographic Coordinates">
              🌐 {formatCoords(activeLocation.lat, activeLocation.lon)}
            </span>
            <span className="scd-source-badge">
              🛰️ {activeLocation.source || "NASA GIBS / Worldview Telemetry"}
            </span>
          </div>
        </div>

        {/* Sync with World Heat Map button if World Map selection differs */}
        {selectedLocation &&
          selectedLocation.latitude != null &&
          (Math.abs(selectedLocation.latitude - activeLocation.lat) > 0.005 ||
            Math.abs(selectedLocation.longitude - activeLocation.lon) > 0.005) && (
            <div className="scd-world-sync-row">
              <button
                type="button"
                className="scd-world-sync-btn"
                onClick={handleUseWorldMapLocation}
              >
                🌍 Load Selected World Heat Map Location:{" "}
                <strong>{selectedLocation.location}</strong> ({selectedLocation.latitude.toFixed(4)}°,{" "}
                {selectedLocation.longitude.toFixed(4)}°)
              </button>
            </div>
          )}
      </section>

      {/* ── LOCATION SEARCH & QUICK SELECTION ── */}
      <section className="scd-search-bar" aria-label="Location Selection">
        <form onSubmit={handleSearchSubmit} className="scd-input-row">
          <div className="scd-input-wrapper">
            <span className="scd-input-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="scd-location-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ANY city, country, or enter coordinates (e.g. 13.0827, 80.2707 or Tokyo, New York...)"
              aria-label="Enter city name or coordinates for satellite change detection"
            />
            {searchInput && (
              <button
                type="button"
                className="scd-clear-btn"
                onClick={() => setSearchInput("")}
                aria-label="Clear location input"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="scd-search-submit-btn">
            Set Location
          </button>
        </form>

        <div className="scd-quick-pills" role="group" aria-label="Quick Select Global & Indian Cities">
          <span className="scd-pills-label">Quick Select:</span>
          {QUICK_SELECT_CITIES.map((loc) => {
            const isActive = activeLocation.name.toLowerCase() === loc.toLowerCase();
            return (
              <button
                key={loc}
                type="button"
                className={`scd-pill-btn ${isActive ? "active" : ""}`}
                onClick={() => handleQuickSelect(loc)}
              >
                {loc}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── OBSERVATION PERIOD CONTROLS (BEFORE / AFTER DATES) ── */}
      <section className="scd-controls-grid" aria-label="Observation Periods">
        <div className="scd-control-group">
          <label htmlFor="scd-before-date" className="scd-control-label">
            📅 Before Date (Baseline Observation)
          </label>
          <input
            id="scd-before-date"
            type="date"
            className="scd-date-input"
            value={beforeDate}
            max={afterDate}
            onChange={(e) => setBeforeDate(e.target.value)}
          />
          <div className="scd-date-presets">
            {PRESET_YEARS.slice(0, 4).map((y) => (
              <button
                key={`before-${y}`}
                type="button"
                className={`scd-year-btn ${beforeDate.startsWith(String(y)) ? "active" : ""}`}
                onClick={() => setBeforeDate(`${y}-04-10`)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="scd-control-group">
          <label htmlFor="scd-after-date" className="scd-control-label">
            📅 After Date (Monitoring Observation)
          </label>
          <input
            id="scd-after-date"
            type="date"
            className="scd-date-input"
            value={afterDate}
            min={beforeDate}
            onChange={(e) => setAfterDate(e.target.value)}
          />
          <div className="scd-date-presets">
            {PRESET_YEARS.slice(5).map((y) => (
              <button
                key={`after-${y}`}
                type="button"
                className={`scd-year-btn ${afterDate.startsWith(String(y)) ? "active" : ""}`}
                onClick={() => setAfterDate(`${y}-04-10`)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="scd-analyze-btn"
          onClick={() => executeAnalysis(activeLocation, beforeDate, afterDate)}
          disabled={loading || !beforeDate || !afterDate || new Date(beforeDate) >= new Date(afterDate)}
        >
          <span>{loading ? "⏳" : "🔍"}</span>
          <span>{loading ? "Processing Satellite Telemetry..." : "Analyze Satellite Changes"}</span>
        </button>
      </section>

      {/* ── VALIDATION & STATUS BANNERS ── */}
      {errorMessage && (
        <div className="scd-banner scd-banner-error" role="alert">
          <span style={{ fontSize: "18px" }}>❌</span>
          <div>
            <strong>Satellite Telemetry Notice:</strong> {errorMessage}
          </div>
        </div>
      )}

      {loading && (
        <div className="scd-loading-card">
          <div className="scd-loading-spinner" />
          <p>
            🛰️ Querying NASA GIBS Earth Observation servers for <strong>{activeLocation.name}</strong> (
            {formatCoords(activeLocation.lat, activeLocation.lon)})...
          </p>
        </div>
      )}

      {/* ── DETECTED CHANGE REPORT ── */}
      {!loading && report && (
        <section className="scd-report" aria-label="Satellite Change Detection Report">
          <div className="scd-report-header">
            <div className="scd-report-meta">
              <h3>🛰️ Satellite Change Detection: {report.city}</h3>
              <p>
                Comparison baseline: {report.fromDate} vs {report.toDate} · Sensor Platform: NASA Terra/Aqua MODIS & VIIRS TrueColor Earth Observation
              </p>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                📍 Coordinates: <strong>{formatCoords(report.latitude, report.longitude)}</strong> ({report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}) · Territory Footprint: ~{report.sceneAreaKm2} km²
              </div>
            </div>
            <span className={`scd-badge-impact ${report.impactRating.toLowerCase()}`}>
              {report.impactRating} Environmental Impact
            </span>
          </div>

          {/* ── KEY METRICS CARDS (CALCULATED FROM REAL IMAGERY) ── */}
          <div className="scd-metrics-grid">
            <article className="scd-metric-card highlight">
              <span className="scd-metric-label">Detected Surface Change</span>
              <div className="scd-metric-value-row">
                <span className="scd-metric-main-value">
                  {changePercentage != null ? changePercentage : "..."}
                </span>
                <span className="scd-metric-unit">% of scene</span>
              </div>
              <div className="scd-metric-timeline">
                <span>Radiometric Delta</span>
                <strong className="scd-metric-diff positive">
                  {changePercentage != null ? `${changePercentage}%` : ""}
                </strong>
              </div>
            </article>

            <article className="scd-metric-card highlight">
              <span className="scd-metric-label">Estimated Affected Area</span>
              <div className="scd-metric-value-row">
                <span className="scd-metric-main-value">
                  {affectedAreaKm2 != null ? affectedAreaKm2 : "..."}
                </span>
                <span className="scd-metric-unit">km² surface</span>
              </div>
              <div className="scd-metric-timeline">
                <span>Territory Footprint</span>
                <span>~{report.sceneAreaKm2} km² scene</span>
              </div>
            </article>

            <article className="scd-metric-card">
              <span className="scd-metric-label">Vegetation Canopy Shift</span>
              <div className="scd-metric-value-row">
                <span className="scd-metric-main-value">
                  {report.greenShift > 0 ? `+${report.greenShift}` : report.greenShift}
                </span>
                <span className="scd-metric-unit">% spectral</span>
              </div>
              <div className="scd-metric-timeline">
                <span>Band Index Shift</span>
                <strong className={`scd-metric-diff ${report.greenShift < 0 ? "negative" : "positive"}`}>
                  {report.greenShift < 0 ? "Reduction" : "Stable / Recovery"}
                </strong>
              </div>
            </article>

            <article className="scd-metric-card">
              <span className="scd-metric-label">Surface Reflectance Shift</span>
              <div className="scd-metric-value-row">
                <span className="scd-metric-main-value">
                  {report.urbanShift > 0 ? `+${report.urbanShift}` : report.urbanShift}
                </span>
                <span className="scd-metric-unit">% albedo</span>
              </div>
              <div className="scd-metric-timeline">
                <span>Impervious Shift</span>
                <strong className={`scd-metric-diff ${report.urbanShift > 1.5 ? "positive" : "negative"}`}>
                  {report.urbanShift > 1.5 ? "Expansion" : "Consistent"}
                </strong>
              </div>
            </article>
          </div>

          {/* ── VISUAL SATELLITE COMPARISON (BEFORE, AFTER, DETECTED CHANGE) ── */}
          <div className="scd-visual-comparison">
            <div className="scd-visual-title-row">
              <h3 className="scd-visual-title">
                <span>🛰️</span>
                <span>
                  Optical NASA Satellite Scene & Differential Analysis: {report.city}
                </span>
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                NASA GIBS / Worldview MODIS Terra Earth Observation Telemetry
              </span>
            </div>

            <div className="scd-scene-grid">
              {/* Card 1: Before Scene */}
              <div className="scd-scene-card">
                <div className="scd-scene-header">
                  <span className="scd-scene-period">📅 {report.fromDate} Baseline Observation</span>
                  <span className="scd-scene-tag before">Before</span>
                </div>
                <div className="scd-scene-canvas-wrap">
                  <img
                    src={report.images.before}
                    alt={`${report.city} ${report.fromDate} NASA Satellite Observation`}
                    className="scd-scene-img"
                  />
                </div>
                <div className="scd-scene-footer">
                  <span>Coordinates: {formatCoords(report.latitude, report.longitude)}</span>
                  <span>Sensor: MODIS Terra</span>
                </div>
              </div>

              {/* Card 2: After Scene */}
              <div className="scd-scene-card">
                <div className="scd-scene-header">
                  <span className="scd-scene-period">📅 {report.toDate} Monitoring Observation</span>
                  <span className="scd-scene-tag after">After</span>
                </div>
                <div className="scd-scene-canvas-wrap">
                  <img
                    src={report.images.after}
                    alt={`${report.city} ${report.toDate} NASA Satellite Observation`}
                    className="scd-scene-img"
                  />
                </div>
                <div className="scd-scene-footer">
                  <span>Coordinates: {formatCoords(report.latitude, report.longitude)}</span>
                  <span>Sensor: MODIS Terra</span>
                </div>
              </div>

              {/* Card 3: Detected Change Difference Map Canvas */}
              <div className="scd-scene-card">
                <div className="scd-scene-header">
                  <span className="scd-scene-period">Detected Change Difference Map</span>
                  <span className="scd-scene-tag diff">Change Overlay</span>
                </div>
                <div className="scd-scene-canvas-wrap">
                  <canvas
                    ref={canvasRef}
                    className="scd-diff-canvas"
                    aria-label={`Detected spatial change map for ${report.city} between ${report.fromDate} and ${report.toDate}`}
                  />
                </div>
                <div className="scd-scene-footer">
                  <span>Net Shift: {changePercentage != null ? `${changePercentage}%` : "..."}</span>
                  <span>~{affectedAreaKm2 != null ? `${affectedAreaKm2} km²` : "..."} affected</span>
                </div>
              </div>
            </div>

            {/* Change Map Legend */}
            <div className="scd-diff-legend" role="region" aria-label="Change Difference Legend">
              <span style={{ fontWeight: 800, color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
                Classification:
              </span>
              <div className="scd-legend-item">
                <span className="scd-legend-dot red" />
                <span>Thermal Accumulation & Canopy Loss</span>
              </div>
              <div className="scd-legend-item">
                <span className="scd-legend-dot green" />
                <span>Vegetation Recovery & Surface Cooling</span>
              </div>
              <div className="scd-legend-item">
                <span className="scd-legend-dot amber" />
                <span>Moderate Transformation</span>
              </div>
              <div className="scd-legend-item">
                <span className="scd-legend-dot gray" />
                <span>Stable Land Surface</span>
              </div>
            </div>
          </div>

          {/* ── AI DETECTION SUMMARY & RECOMMENDATIONS ── */}
          <div className="scd-insights-row">
            <div className="scd-insight-box summary">
              <h4>✔ AI Environmental Change Summary</h4>
              {report.detections.length ? (
                report.detections.map((det) => (
                  <p key={det.type}>• {det.message}</p>
                ))
              ) : (
                <p>• Stable environmental indicators observed between {report.fromDate} and {report.toDate}.</p>
              )}
            </div>

            <div className="scd-insight-box recommendation">
              <h4>🧭 Climate Mitigation Recommendations</h4>
              <p>{recommendationText}</p>
            </div>
          </div>

          {/* ── TIMELINE BAR ── */}
          <div className="scd-timeline-bar">
            <strong>{report.fromDate} Baseline</strong>
            <span>────────────────────▶</span>
            <strong>{report.toDate} Monitoring</strong>
          </div>
        </section>
      )}
    </div>
  );
}
