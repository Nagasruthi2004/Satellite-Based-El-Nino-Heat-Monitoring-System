"""
Weather module - connects to OpenWeather API
Fetches current weather data for specified city
"""

import os
import logging
import requests
from dotenv import load_dotenv

# Load .env relative to backend directory so it works regardless of current working directory
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(DOTENV_PATH):
    load_dotenv(dotenv_path=DOTENV_PATH)

# OpenWeather API endpoint
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

logger = logging.getLogger(__name__)


PLACEHOLDER_KEYS = {
    "your_openweather_api_key_here",
    "your_new_openweather_api_key",
    "your_api_key_here",
    "changeme",
    "none",
    "null",
}


def is_weather_api_configured() -> bool:
    """
    Check if OPENWEATHER_API_KEY is configured and not a placeholder.
    Returns True if valid key is set, False otherwise.
    Never prints or logs the actual key value.
    """
    if os.path.exists(DOTENV_PATH):
        load_dotenv(dotenv_path=DOTENV_PATH)
    api_key = (os.getenv("OPENWEATHER_API_KEY") or "").strip()
    if not api_key or api_key.lower() in PLACEHOLDER_KEYS:
        return False
    return True


KNOWN_CITY_COORDINATES = {
    "visakhapatnam": (17.6868, 83.2185),
    "vizag": (17.6868, 83.2185),
    "coimbatore": (11.0168, 76.9558),
    "chennai": (13.0827, 80.2707),
    "madurai": (9.9252, 78.1198),
    "trichy": (10.7905, 78.7047),
    "tiruchirappalli": (10.7905, 78.7047),
    "salem": (11.6643, 78.1460),
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "kolkata": (22.5726, 88.3639),
    "pune": (18.5204, 73.8567),
    "mysuru": (12.2958, 76.6394),
    "mysore": (12.2958, 76.6394),
    "tiruppur": (11.1085, 77.3411),
    "erode": (11.3410, 77.7172),
    "vellore": (12.9165, 79.1325),
    "ahmedabad": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462),
}


def fetch_weather(city=None, lat=None, lon=None, retries=3):
    """
    Fetch current weather data for a given city or (lat, lon) coordinates using OpenWeather API.
    Retries up to `retries` times on transient network errors.

    Args:
        city (str, optional): City/location name
        lat (float, optional): Latitude coordinate
        lon (float, optional): Longitude coordinate
        retries (int): Max retry attempts on transient failures (default: 3)

    Returns:
        dict: Weather data, or None if the location is invalid / API is unreachable / unconfigured.
    """
    if not is_weather_api_configured():
        logger.error("OPENWEATHER_API_KEY is missing, empty, or unconfigured in backend/.env")
        return None

    api_key = (os.getenv("OPENWEATHER_API_KEY") or "").strip()

    clean_city = str(city or "").strip()
    base_city = clean_city.split(",")[0].strip() if "," in clean_city else clean_city

    # Auto-resolve coordinates for known Indian cities only if coordinates were not explicitly provided
    resolved_lat = lat
    resolved_lon = lon
    if resolved_lat is None or resolved_lon is None:
        if base_city and base_city.lower() in KNOWN_CITY_COORDINATES:
            resolved_lat, resolved_lon = KNOWN_CITY_COORDINATES[base_city.lower()]

    if resolved_lat is not None and resolved_lon is not None:
        params = {"lat": float(resolved_lat), "lon": float(resolved_lon), "appid": api_key, "units": "metric"}
        logger.info("Requesting weather by coordinates | lat=%s | lon=%s | location=%s", resolved_lat, resolved_lon, base_city or "Global Coordinates")
    elif clean_city:
        params = {"q": clean_city, "appid": api_key, "units": "metric"}
        logger.info("Requesting weather by city | city=%s | url=%s", clean_city, BASE_URL)
    else:
        logger.warning("fetch_weather called without valid city or coordinates")
        return None

    url = BASE_URL
    last_error = None
    timeout_retried = False

    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, params=params, timeout=8)
            logger.info("OpenWeather response | params=%s | status=%d | attempt=%d",
                        params.get("q") or f"lat={resolved_lat},lon={resolved_lon}", response.status_code, attempt)

            if response.status_code == 401:
                logger.error("OpenWeather API Authentication Failed (401 Unauthorized): Check OPENWEATHER_API_KEY in backend/.env")
                return None

            if response.status_code == 404:
                # If queried by coordinates and failed, try city name fallback if available
                if "lat" in params and clean_city:
                    try:
                        fallback_resp = requests.get(url, params={"q": clean_city, "appid": api_key, "units": "metric"}, timeout=8)
                        if fallback_resp.status_code == 200:
                            data = fallback_resp.json()
                            temperature = data.get("main", {}).get("temp")
                            rain_data = data.get("rain")
                            rainfall = 0
                            if isinstance(rain_data, dict):
                                rainfall = rain_data.get("1h", rain_data.get("3h", 0))
                            return {
                                "city": data.get("name") or clean_city,
                                "country": data.get("sys", {}).get("country", ""),
                                "temperature": temperature,
                                "humidity": data.get("main", {}).get("humidity"),
                                "wind_speed": data.get("wind", {}).get("speed"),
                                "rainfall": rainfall,
                                "weather_description": (
                                    data.get("weather", [{}])[0].get("description")
                                    or data.get("weather", [{}])[0].get("main")
                                ),
                                "el_nino_status": "Monitoring",
                                "lat": data.get("coord", {}).get("lat", resolved_lat),
                                "lon": data.get("coord", {}).get("lon", resolved_lon),
                                "pressure": data.get("main", {}).get("pressure"),
                            }
                    except Exception:
                        pass
                logger.warning("Weather not found for: %s", clean_city)
                return None

            response.raise_for_status()
            data = response.json()

            temperature = data.get("main", {}).get("temp")
            rain_data = data.get("rain")
            rainfall = 0
            if isinstance(rain_data, dict):
                rainfall = rain_data.get("1h", rain_data.get("3h", 0))

            resolved_name = data.get("name") or clean_city or "Selected Location"
            country = data.get("sys", {}).get("country", "")
            return {
                "city": resolved_name,
                "country": country,
                "temperature": temperature,
                "humidity": data.get("main", {}).get("humidity"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "rainfall": rainfall,
                "weather_description": (
                    data.get("weather", [{}])[0].get("description")
                    or data.get("weather", [{}])[0].get("main")
                ),
                "el_nino_status": "Monitoring",
                "lat": data.get("coord", {}).get("lat", resolved_lat),
                "lon": data.get("coord", {}).get("lon", resolved_lon),
                "pressure": data.get("main", {}).get("pressure"),
            }

        except requests.exceptions.Timeout as error:
            last_error = error
            if timeout_retried:
                logger.warning("Timeout retry exhausted for city=%s", clean_city)
                break
            timeout_retried = True
            logger.warning("Temporary timeout; retrying once for city=%s", clean_city)
        except requests.exceptions.RequestException as error:
            last_error = error
            logger.warning("Attempt %d/%d failed for city=%s | error=%s",
                           attempt, retries, clean_city, error)

    logger.error("All %d attempts failed for city=%s | last_error=%s",
                 retries, clean_city, last_error)
    return None


def search_locations(query: str, limit: int = 6) -> list[dict]:
    """
    Search for locations worldwide by city, town, region, country, or coordinates.
    Returns a list of dicts with name, display_name, lat, lon, country, state.
    Uses OpenWeather Geocoding API if configured, with OpenStreetMap Nominatim fallback.
    """
    if not query or not query.strip():
        return []

    clean_query = query.strip()

    # 1. Check if query is direct coordinates (e.g., "13.0827, 80.2707" or "13.0827 80.2707")
    coord_parts = [p.strip() for p in clean_query.replace(",", " ").split() if p.strip()]
    if len(coord_parts) == 2:
        try:
            q_lat = float(coord_parts[0])
            q_lon = float(coord_parts[1])
            if -90 <= q_lat <= 90 and -180 <= q_lon <= 180:
                rev = reverse_geocode(q_lat, q_lon)
                return [{
                    "name": rev.get("name") or f"{q_lat:.4f}°, {q_lon:.4f}°",
                    "display_name": rev.get("display_name") or f"Coordinates ({q_lat:.4f}°, {q_lon:.4f}°)",
                    "lat": round(q_lat, 4),
                    "lon": round(q_lon, 4),
                    "country": rev.get("country", ""),
                    "state": rev.get("state", ""),
                }]
        except ValueError:
            pass

    results: list[dict] = []
    api_key = (os.getenv("OPENWEATHER_API_KEY") or "").strip()

    # 2. Try OpenWeather Geocoding API if configured
    if is_weather_api_configured():
        try:
            geo_url = "http://api.openweathermap.org/geo/1.0/direct"
            resp = requests.get(geo_url, params={"q": clean_query, "limit": limit, "appid": api_key}, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                for item in data:
                    name = item.get("name") or clean_query
                    state = item.get("state", "")
                    country = item.get("country", "")
                    parts = [name]
                    if state:
                        parts.append(state)
                    if country:
                        parts.append(country)
                    results.append({
                        "name": name,
                        "display_name": ", ".join(parts),
                        "lat": round(float(item["lat"]), 4),
                        "lon": round(float(item["lon"]), 4),
                        "country": country,
                        "state": state,
                    })
        except Exception as exc:
            logger.warning("OpenWeather geocoding failed for %s: %s", clean_query, exc)

    # 3. If no results yet, try OpenStreetMap Nominatim
    if not results:
        try:
            nom_url = "https://nominatim.openstreetmap.org/search"
            headers = {"User-Agent": "ElNinoHeatMonitoringSystem/1.0", "Accept-Language": "en"}
            resp = requests.get(nom_url, params={"q": clean_query, "format": "json", "limit": limit, "addressdetails": 1}, headers=headers, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                for item in data:
                    addr = item.get("address", {})
                    name = item.get("name") or addr.get("city") or addr.get("town") or addr.get("village") or clean_query
                    results.append({
                        "name": name,
                        "display_name": item.get("display_name", name),
                        "lat": round(float(item["lat"]), 4),
                        "lon": round(float(item["lon"]), 4),
                        "country": addr.get("country", ""),
                        "state": addr.get("state", ""),
                    })
        except Exception as exc:
            logger.warning("Nominatim geocoding failed for %s: %s", clean_query, exc)

    # 4. Fallback: Check KNOWN_CITY_COORDINATES
    if not results:
        q_lower = clean_query.lower()
        for k_city, (k_lat, k_lon) in KNOWN_CITY_COORDINATES.items():
            if q_lower in k_city or k_city in q_lower:
                results.append({
                    "name": k_city.title(),
                    "display_name": f"{k_city.title()}, India",
                    "lat": round(k_lat, 4),
                    "lon": round(k_lon, 4),
                    "country": "India",
                    "state": "",
                })
                if len(results) >= limit:
                    break

    # Deduplicate by approximate coordinates
    unique_results = []
    seen_coords = set()
    for r in results:
        key = (round(r["lat"], 2), round(r["lon"], 2))
        if key not in seen_coords:
            seen_coords.add(key)
            unique_results.append(r)

    return unique_results[:limit]


def reverse_geocode(lat: float, lon: float) -> dict:
    """
    Reverse geocode coordinates into a human-readable location name.
    """
    try:
        nom_url = "https://nominatim.openstreetmap.org/reverse"
        headers = {"User-Agent": "ElNinoHeatMonitoringSystem/1.0", "Accept-Language": "en"}
        resp = requests.get(nom_url, params={"lat": lat, "lon": lon, "format": "json"}, headers=headers, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address", {})
            name = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
                or addr.get("county")
                or data.get("name")
                or f"{lat:.4f}°, {lon:.4f}°"
            )
            return {
                "name": name,
                "display_name": data.get("display_name", name),
                "country": addr.get("country", ""),
                "state": addr.get("state", ""),
            }
    except Exception as exc:
        logger.warning("Reverse geocoding failed for %s, %s: %s", lat, lon, exc)

    return {
        "name": f"{lat:.4f}°, {lon:.4f}°",
        "display_name": f"Coordinates ({lat:.4f}°, {lon:.4f}°)",
        "country": "",
        "state": "",
    }


def display_weather(city="Coimbatore"):
    """
    Fetch and display weather data for a city in a formatted way

    Args:
        city (str): City name (default: "Coimbatore")
    """
    weather = fetch_weather(city)

    if weather:
        sep = "=" * 50
        print(f"\n{sep}")
        print(f"Weather Information for {weather['city']}")
        print(sep)
        print(f"{'Temperature':<12}: {weather['temperature']} \u00b0C")
        print(f"{'Humidity':<12}: {weather['humidity']} %")
        print(f"{'Wind Speed':<12}: {weather['wind_speed']} m/s")
        print(f"{'Rainfall':<12}: {weather['rainfall']} mm")
        print(f"{'Condition':<12}: {weather['weather_description']}")
        print(f"{'Heat Risk':<12}: {weather['heat_risk']}")
        print(f"{'El Ni\u00f1o':<12}: {weather['el_nino_status']}")
        print(f"{sep}\n")
    else:
        print("Failed to retrieve weather data")


# Main execution
if __name__ == "__main__":
    display_weather()
