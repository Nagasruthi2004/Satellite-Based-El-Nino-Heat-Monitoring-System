import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  detectBrowserLocation,
  reverseGeocodeCoords,
  searchWorldwideLocations,
  getCachedLocation,
  setCachedLocation,
  clearCachedLocation,
  formatLocationAge,
  fetchWithTimeout,
} from "./locationService.js";

// Mock localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe("Location Service Optimization Tests", () => {
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalLocalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  function setNavigator(mockNav) {
    Object.defineProperty(globalThis, "navigator", {
      value: mockNav,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    globalThis.window = {};
    globalThis.localStorage = new MockLocalStorage();
  });

  afterEach(() => {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDesc);
    }
    globalThis.localStorage = originalLocalStorage;
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  });

  describe("1. Browser Geolocation Tests", () => {
    test("detectBrowserLocation succeeds with real/mock coordinates and passes appropriate options", async () => {
      let passedOptions = null;
      setNavigator({
        geolocation: {
          getCurrentPosition: (success, error, options) => {
            passedOptions = options;
            setTimeout(() => {
              success({
                coords: {
                  latitude: 18.5204,
                  longitude: 73.8567,
                  accuracy: 25,
                },
                timestamp: Date.now(),
              });
            }, 10);
          },
        },
      });

      const result = await detectBrowserLocation();
      assert.equal(result.latitude, 18.5204);
      assert.equal(result.longitude, 73.8567);
      assert.equal(result.accuracy, 25);
      assert.equal(passedOptions.enableHighAccuracy, false, "enableHighAccuracy should be false for fast mobile lock");
      assert.equal(passedOptions.timeout, 8000, "timeout should be configured (8000ms)");
      assert.equal(passedOptions.maximumAge, 300000, "maximumAge should be 5min to reuse cache");
    });

    test("detectBrowserLocation handles PERMISSION_DENIED (code 1) gracefully", async () => {
      setNavigator({
        geolocation: {
          getCurrentPosition: (success, error) => {
            setTimeout(() => {
              error({ code: 1, message: "User denied Geolocation" });
            }, 10);
          },
        },
      });

      await assert.rejects(
        async () => {
          await detectBrowserLocation();
        },
        (err) => {
          assert.equal(err.code, "PERMISSION_DENIED");
          assert.match(err.message, /denied/i);
          assert.match(err.message, /search your city manually/i);
          return true;
        }
      );
    });

    test("detectBrowserLocation handles TIMEOUT (code 3) gracefully without waiting indefinitely", async () => {
      setNavigator({
        geolocation: {
          getCurrentPosition: (success, error) => {
            setTimeout(() => {
              error({ code: 3, message: "Timeout expired" });
            }, 10);
          },
        },
      });

      await assert.rejects(
        async () => {
          await detectBrowserLocation();
        },
        (err) => {
          assert.equal(err.code, "TIMEOUT");
          assert.match(err.message, /timed out/i);
          assert.match(err.message, /search your city manually/i);
          return true;
        }
      );
    });

    test("detectBrowserLocation triggers safety timeout when browser hangs indefinitely", async () => {
      // Simulate buggy browser where getCurrentPosition never calls success or error
      setNavigator({
        geolocation: {
          getCurrentPosition: () => {
            // never calls back
          },
        },
      });

      await assert.rejects(
        async () => {
          // Use small timeout for test speed
          await detectBrowserLocation({ timeout: 50 });
        },
        (err) => {
          assert.equal(err.code, "TIMEOUT");
          assert.match(err.message, /timed out/i);
          return true;
        }
      );
    });

    test("detectBrowserLocation rejects cleanly when geolocation is unsupported", async () => {
      setNavigator({});

      await assert.rejects(
        async () => {
          await detectBrowserLocation();
        },
        (err) => {
          assert.equal(err.code, "NOT_SUPPORTED");
          assert.match(err.message, /not supported/i);
          return true;
        }
      );
    });
  });

  describe("2. Reverse Geocoding & Fallback Tests", () => {
    test("reverseGeocodeCoords resolves city from backend proxy", async () => {
      globalThis.fetch = async (url) => {
        if (url.includes("/api/locations/reverse")) {
          return {
            ok: true,
            json: async () => ({
              name: "Pune",
              display_name: "Pune, Maharashtra, India",
              country: "India",
              state: "Maharashtra",
            }),
          };
        }
        throw new Error("Unexpected URL: " + url);
      };

      const result = await reverseGeocodeCoords(18.5204, 73.8567);
      assert.equal(result.city, "Pune");
      assert.equal(result.name, "Pune");
      assert.equal(result.displayName, "Pune, Maharashtra, India");
      assert.equal(result.country, "India");
    });

    test("reverseGeocodeCoords falls back to Nominatim if backend fails", async () => {
      globalThis.fetch = async (url) => {
        if (url.includes("/api/locations/reverse")) {
          return { ok: false, status: 500 };
        }
        if (url.includes("nominatim.openstreetmap.org")) {
          return {
            ok: true,
            json: async () => ({
              address: {
                city: "Nagpur",
                state: "Maharashtra",
                country: "India",
              },
              display_name: "Nagpur, Maharashtra, India",
            }),
          };
        }
        throw new Error("Unexpected URL: " + url);
      };

      const result = await reverseGeocodeCoords(21.1458, 79.0882);
      assert.equal(result.city, "Nagpur");
      assert.match(result.displayName, /Nagpur/);
    });

    test("reverseGeocodeCoords gracefully returns coordinates if all network requests fail", async () => {
      globalThis.fetch = async () => {
        throw new Error("Network offline");
      };

      const result = await reverseGeocodeCoords(13.0827, 80.2707);
      assert.ok(result);
      assert.match(result.name, /13\.0827/);
      assert.match(result.displayName, /Coordinates/);
    });
  });

  describe("3. Location Caching & Reuse Tests", () => {
    test("getCachedLocation returns null when cache is empty", () => {
      assert.equal(getCachedLocation(), null);
    });

    test("setCachedLocation stores location and getCachedLocation retrieves it", () => {
      const locationData = {
        city: "Hyderabad",
        label: "Hyderabad, Telangana, India",
        lat: 17.385,
        lon: 78.4867,
        source: "gps",
      };

      setCachedLocation(locationData);
      const cached = getCachedLocation();

      assert.ok(cached);
      assert.equal(cached.city, "Hyderabad");
      assert.equal(cached.lat, 17.385);
      assert.equal(cached.lon, 78.4867);
      assert.equal(cached.source, "gps");
      assert.ok(cached.timestamp);
    });

    test("setCachedLocation does not persist manual city searches", () => {
      const manualData = {
        city: "Pune",
        label: "Pune, Maharashtra, India",
        lat: 18.5204,
        lon: 73.8567,
        source: "manual",
      };

      setCachedLocation(manualData);
      assert.equal(getCachedLocation(), null, "manual searches should not be stored in location cache");
    });

    test("getCachedLocation purges and ignores any legacy manual search entry in storage", () => {
      globalThis.localStorage.setItem(
        "el_nino_cached_location",
        JSON.stringify({ city: "Delhi", source: "manual", timestamp: Date.now() })
      );
      assert.equal(getCachedLocation(), null);
      assert.equal(globalThis.localStorage.getItem("el_nino_cached_location"), null);
    });

    test("clearCachedLocation removes cached location from localStorage", () => {
      setCachedLocation({
        city: "Chennai",
        lat: 13.0827,
        lon: 80.2707,
        source: "gps",
      });
      assert.ok(getCachedLocation());
      clearCachedLocation();
      assert.equal(getCachedLocation(), null);
    });

    test("formatLocationAge returns human-readable relative duration", () => {
      const now = Date.now();
      assert.equal(formatLocationAge(now - 10000), "just now");
      assert.equal(formatLocationAge(now - 5 * 60 * 1000), "5m ago");
      assert.equal(formatLocationAge(now - 3 * 3600 * 1000), "3h ago");
      assert.equal(formatLocationAge(now - 25 * 3600 * 1000), "yesterday");
    });
  });

  describe("4. Worldwide Location Search Tests", () => {
    test("searchWorldwideLocations calls backend and returns suggestions", async () => {
      globalThis.fetch = async (url) => {
        if (url.includes("/api/locations/search")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                { name: "Bengaluru", display_name: "Bengaluru, Karnataka, India", lat: 12.9716, lon: 77.5946 },
              ],
            }),
          };
        }
        return { ok: false };
      };

      const results = await searchWorldwideLocations("Bengaluru", 5);
      assert.equal(results.length, 1);
      assert.equal(results[0].name, "Bengaluru");
      assert.equal(results[0].lat, 12.9716);
    });

    test("searchWorldwideLocations handles direct coordinate input without backend error", async () => {
      globalThis.fetch = async () => {
        throw new Error("Offline");
      };

      const results = await searchWorldwideLocations("13.0827, 80.2707");
      assert.equal(results.length, 1);
      assert.equal(results[0].lat, 13.0827);
      assert.equal(results[0].lon, 80.2707);
    });
  });

  describe("5. Sensible API Timeouts & Network Abort Tests", () => {
    test("fetchWithTimeout aborts and throws TimeoutError when request exceeds timeout", async () => {
      globalThis.fetch = (url, options) => {
        return new Promise((resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      };

      await assert.rejects(
        async () => {
          await fetchWithTimeout("http://127.0.0.1:5000/weather?city=Test", {}, 50);
        },
        (err) => {
          assert.equal(err.name, "TimeoutError");
          assert.match(err.message, /timed out/i);
          return true;
        }
      );
    });
  });
});
