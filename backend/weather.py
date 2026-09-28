"""
Weather module - connects to OpenWeather API
Fetches current weather data for specified city
"""

import os
import logging
import requests
from dotenv import load_dotenv

# Load .env relative to this file's directory so it works regardless of
# which directory Flask is launched from
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# OpenWeather API endpoint
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

logger = logging.getLogger(__name__)


def fetch_weather(city="Coimbatore", lat=None, lon=None, retries=3):
    """
    Fetch current weather data for a given city or (lat, lon) coordinates using OpenWeather API.
    Retries up to `retries` times on transient network errors.

    Args:
        city (str): City name (default: "Coimbatore")
        lat (float, optional): Latitude coordinate
        lon (float, optional): Longitude coordinate
        retries (int): Max retry attempts on transient failures (default: 3)

    Returns:
        dict: Weather data, or None if the city is invalid / API is unreachable.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if not api_key:
        logger.error("OPENWEATHER_API_KEY is missing or empty — check your .env file")
        return None

    if lat is not None and lon is not None:
        params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}
        logger.info("Requesting weather by coordinates | lat=%s | lon=%s | url=%s", lat, lon, BASE_URL)
    else:
        params = {"q": city, "appid": api_key, "units": "metric"}
        logger.info("Requesting weather by city | city=%s | url=%s", city, BASE_URL)

    url = BASE_URL

    last_error = None
    timeout_retried = False
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, params=params, timeout=10)
            logger.info("OpenWeather response | params=%s | status=%d | attempt=%d",
                        params.get("q") or f"lat={lat},lon={lon}", response.status_code, attempt)

            if response.status_code == 404:
                logger.warning("Weather not found for: %s", params.get("q") or f"{lat},{lon}")
                return None

            response.raise_for_status()

            data = response.json()

            temperature = data.get("main", {}).get("temp")
            rain_data = data.get("rain")
            rainfall = 0
            if isinstance(rain_data, dict):
                rainfall = rain_data.get("1h", rain_data.get("3h", 0))

            resolved_name = data.get("name") or city or "Selected Location"
            return {
                "city": resolved_name,
                "temperature": temperature,
                "humidity": data.get("main", {}).get("humidity"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "rainfall": rainfall,
                "weather_description": (
                    data.get("weather", [{}])[0].get("description")
                    or data.get("weather", [{}])[0].get("main")
                ),
                "el_nino_status": "Monitoring",
                "lat": data.get("coord", {}).get("lat", lat),
                "lon": data.get("coord", {}).get("lon", lon),
            }

        except requests.exceptions.Timeout as error:
            last_error = error
            if timeout_retried:
                logger.warning("Timeout retry exhausted for city=%s", city)
                break
            timeout_retried = True
            logger.warning("Temporary timeout; retrying once for city=%s", city)
        except requests.exceptions.RequestException as error:
            last_error = error
            logger.warning("Attempt %d/%d failed for city=%s | error=%s",
                           attempt, retries, city, error)

    logger.error("All %d attempts failed for city=%s | last_error=%s",
                 retries, city, last_error)
    return None

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
