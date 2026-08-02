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


def fetch_weather(city="Coimbatore", retries=3):
    """
    Fetch current weather data for a given city using OpenWeather API.
    Retries up to `retries` times on transient network errors.

    Args:
        city (str): City name (default: "Coimbatore")
        retries (int): Max retry attempts on transient failures (default: 3)

    Returns:
        dict: Weather data, or None if the city is invalid / API is unreachable.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if not api_key:
        logger.error("OPENWEATHER_API_KEY is missing or empty — check your .env file")
        return None

    params = {"q": city, "appid": api_key, "units": "metric"}
    url = BASE_URL
    logger.info("Requesting weather | city=%s | url=%s", city, url)

    last_error = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, params=params, timeout=10)
            logger.info("OpenWeather response | city=%s | status=%d | attempt=%d",
                        city, response.status_code, attempt)

            if response.status_code == 404:
                logger.warning("City not found: %s", city)
                return None

            response.raise_for_status()

            data = response.json()

            temperature = data.get("main", {}).get("temp") or 0
            rain_data = data.get("rain")
            rainfall = 0
            if isinstance(rain_data, dict):
                rainfall = rain_data.get("1h", rain_data.get("3h", 0))

            if temperature < 30:
                heat_risk = "Low"
            elif temperature < 36:
                heat_risk = "Medium"
            else:
                heat_risk = "High"

            return {
                "city": data.get("name", city),
                "temperature": temperature,
                "humidity": data.get("main", {}).get("humidity"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "rainfall": rainfall,
                "weather_description": (
                    data.get("weather", [{}])[0].get("description")
                    or data.get("weather", [{}])[0].get("main")
                ),
                "heat_risk": heat_risk,
                "el_nino_status": "Monitoring",
                "lat": data.get("coord", {}).get("lat"),
                "lon": data.get("coord", {}).get("lon"),
            }

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
