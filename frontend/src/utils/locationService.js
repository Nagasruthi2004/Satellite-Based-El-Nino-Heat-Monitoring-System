/**
 * locationService.js
 * 
 * Robust, mobile-data-optimized location detection, reverse geocoding,
 * location caching, and city search utility for Smart El Niño Heat Monitoring System.
 */

const BACKEND_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) || "http://127.0.0.1:5000";
const STORAGE_KEY = "el_nino_cached_location";

/**
 * Fetch wrapper with configurable AbortController timeout.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    return res;
  } catch (err) {
    if (err.name === "AbortError" || controller.signal.aborted) {
      const timeoutErr = new Error("Request timed out. Please check your connection.");
      timeoutErr.name = "TimeoutError";
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detect user's location via browser Geolocation API.
 * Uses mobile-friendly settings (enableHighAccuracy: false, 8s timeout, 5min cache)
 * and an outer safety timer to avoid hanging indefinitely on slow mobile networks.
 */
export function detectBrowserLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject({
        code: "NOT_SUPPORTED",
        message: "Geolocation is not supported by your browser. Please search your city manually below.",
      });
      return;
    }

    const geoOptions = {
      enableHighAccuracy: false, // Prevents 20-30s GPS hardware delay; resolves fast via cell towers/Wi-Fi
      timeout: 8000,             // 8 seconds maximum
      maximumAge: 300000,        // 5 minutes cache
      ...options,
    };

    let settled = false;

    // Outer safety timeout in case the browser hangs or drops the callback
    const safetyTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject({
          code: "TIMEOUT",
          message: "Location detection timed out on mobile data. Please search your city manually below.",
        });
      }
    }, geoOptions.timeout + 1000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        const { latitude, longitude, accuracy } = pos.coords;
        resolve({
          latitude,
          longitude,
          accuracy,
          timestamp: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);

        let friendlyMessage = "Unable to detect your location. Please search your city manually below.";
        let errCode = "UNKNOWN";

        if (err.code === 1 /* PERMISSION_DENIED */) {
          errCode = "PERMISSION_DENIED";
          friendlyMessage = "Location access was denied. You can search your city manually below.";
        } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
          errCode = "POSITION_UNAVAILABLE";
          friendlyMessage = "Location is unavailable on this network. Please search your city manually below.";
        } else if (err.code === 3 /* TIMEOUT */) {
          errCode = "TIMEOUT";
          friendlyMessage = "Location detection timed out. Please search your city manually below.";
        }

        reject({
          code: errCode,
          message: friendlyMessage,
          originalError: err,
        });
      },
      geoOptions
    );
  });
}

/**
 * Reverse geocode latitude and longitude to a human-readable city/region.
 * 1. Queries backend /api/locations/reverse first with a 6-second timeout.
 * 2. Falls back to OpenStreetMap Nominatim with timeout and User-Agent if backend is offline.
 * 3. Gracefully defaults to coordinates string so the app never crashes.
 */
export async function reverseGeocodeCoords(latitude, longitude, timeoutMs = 6000) {
  const roundedLat = Number(Number(latitude).toFixed(4));
  const roundedLon = Number(Number(longitude).toFixed(4));

  // 1. Backend proxy endpoint
  try {
    const res = await fetchWithTimeout(
      `${BACKEND_BASE}/api/locations/reverse?lat=${roundedLat}&lon=${roundedLon}`,
      { headers: { Accept: "application/json" } },
      timeoutMs
    );
    if (res.ok) {
      const data = await res.json();
      const name = data.name || data.display_name || "";
      const displayName = data.display_name || name;
      const city = data.city || data.name || "";
      if (name) {
        return {
          name,
          displayName,
          city,
          country: data.country || "",
          state: data.state || "",
          latitude: roundedLat,
          longitude: roundedLon,
        };
      }
    }
  } catch (err) {
    console.warn("Backend reverse geocode error, attempting fallback:", err);
  }

  // 2. Direct Nominatim fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${roundedLat}&lon=${roundedLon}&format=json`;
    const nomRes = await fetchWithTimeout(
      nomUrl,
      {
        headers: {
          "Accept-Language": "en",
        },
      },
      Math.min(timeoutMs, 5000)
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const addr = nomData.address || {};
      const locality = addr.neighbourhood || addr.suburb || addr.locality || addr.quarter;
      const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || "";
      const state = addr.state || addr.region || "";
      const country = addr.country || "";

      const parts = [locality, city, state, country].filter(Boolean);
      const uniqueParts = [...new Set(parts)];
      const displayName = uniqueParts.join(", ") || nomData.display_name || city;

      return {
        name: city || locality || nomData.name || `${roundedLat}°, ${roundedLon}°`,
        displayName,
        city: city || locality || "",
        country,
        state,
        latitude: roundedLat,
        longitude: roundedLon,
      };
    }
  } catch (nomErr) {
    console.warn("Nominatim fallback reverse geocode failed:", nomErr);
  }

  // 3. Fallback coordinates representation
  return {
    name: `${roundedLat}°, ${roundedLon}°`,
    displayName: `Coordinates (${roundedLat}°, ${roundedLon}°)`,
    city: "",
    country: "",
    state: "",
    latitude: roundedLat,
    longitude: roundedLon,
  };
}

/**
 * Search locations worldwide via backend endpoint /api/locations/search.
 */
export async function searchWorldwideLocations(query, limit = 6, timeoutMs = 6000) {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery) return [];

  try {
    const res = await fetchWithTimeout(
      `${BACKEND_BASE}/api/locations/search?q=${encodeURIComponent(cleanQuery)}&limit=${limit}`,
      { headers: { Accept: "application/json" } },
      timeoutMs
    );
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
  } catch (err) {
    console.warn("Location search error:", err);
  }

  // Fallback to basic coordinate parsing if user entered "lat, lon"
  const coordMatch = cleanQuery.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    return [
      {
        name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
        display_name: `Coordinates (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`,
        lat,
        lon,
        country: "",
        state: "",
      },
    ];
  }

  return [];
}

/**
 * Retrieve cached location from localStorage.
 * Only returns genuine GPS / detected locations, never manual searches.
 */
export function getCachedLocation() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Never restore manual searches or invalid entries
    if (parsed && parsed.source && parsed.source !== "gps" && parsed.source !== "detected") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed && (parsed.city || (parsed.lat != null && parsed.lon != null))) {
      return parsed;
    }
  } catch (e) {
    console.warn("Error reading cached location:", e);
  }
  return null;
}

/**
 * Store detected location in localStorage.
 * Only persists genuine GPS / detected locations, never manual searches.
 */
export function setCachedLocation(data) {
  if (typeof window === "undefined" || !data) return;
  // Never persist manual searches as cached location
  if (data.source && data.source !== "gps" && data.source !== "detected") {
    return;
  }
  try {
    const payload = {
      city: data.city || data.name || "",
      label: data.label || data.displayName || data.display_name || data.name || data.city || "",
      lat: data.lat != null ? Number(data.lat) : (data.latitude != null ? Number(data.latitude) : null),
      lon: data.lon != null ? Number(data.lon) : (data.longitude != null ? Number(data.longitude) : null),
      source: data.source || "gps",
      timestamp: data.timestamp || Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Error saving location cache:", e);
  }
}

/**
 * Clear any cached location from localStorage.
 */
export function clearCachedLocation() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Error clearing cached location:", e);
  }
}

/**
 * Format relative age of cached location timestamp.
 */
export function formatLocationAge(timestamp) {
  if (!timestamp) return "";
  const diffMs = Date.now() - Number(timestamp);
  if (diffMs < 0 || isNaN(diffMs)) return "recently";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}
