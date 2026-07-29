"""
Weather module - connects to OpenWeather API
Fetches current weather data for specified city
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variable
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# OpenWeather API endpoint
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"


def fetch_weather(city="Coimbatore"):
    """
    Fetch current weather data for a given city using OpenWeather API
    
    Args:
        city (str): City name (default: "Coimbatore")
    
    Returns:
        dict: Weather data containing temperature, humidity, description, etc.
              Returns None if API call fails
    """
    if not OPENWEATHER_API_KEY:
        print("Error: OPENWEATHER_API_KEY not found in .env file")
        return None
    
    try:
        # Prepare API request parameters
        params = {
            "q": city,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric"  # Get temperature in Celsius
        }
        
        # Make API request
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()  # Raise exception for bad status codes
        
        # Parse JSON response
        data = response.json()

        temperature = data.get("main", {}).get("temp")
        rainfall = 0
        rain_data = data.get("rain")
        if isinstance(rain_data, dict):
            rainfall = rain_data.get("1h", rain_data.get("3h", 0))

        if temperature is None:
            temperature = 0

        if temperature < 30:
            heat_risk = "Low"
        elif temperature < 36:
            heat_risk = "Medium"
        else:
            heat_risk = "High"
        
        # Extract relevant weather information
        weather_info = {
            "city": data.get("name", city),
            "temperature": temperature,
            "humidity": data.get("main", {}).get("humidity"),
            "wind_speed": data.get("wind", {}).get("speed"),
            "rainfall": rainfall,
            "weather_description": data.get("weather", [{}])[0].get("description") or data.get("weather", [{}])[0].get("main"),
            "heat_risk": heat_risk,
            "el_nino_status": "Monitoring"
        }
        
        return weather_info
    
    except requests.exceptions.RequestException as error:
        print(f"Error fetching weather data: {error}")
        return None

def display_weather(city="Coimbatore"):
    """
    Fetch and display weather data for a city in a formatted way
    
    Args:
        city (str): City name (default: "Coimbatore")
    """
    weather = fetch_weather(city)
    
    if weather:
        print(f"\n{'='*50}")
        print(f"Weather Information for {weather['city']}")
        print(f"{'='*50}")
        print(f"Temperature: {weather['temperature']}°C")
        print(f"Humidity: {weather['humidity']}%")
        print(f"Condition: {weather['description']}")
        print(f"{'='*50}\n")
    else:
        print("Failed to retrieve weather data")


# Main execution
if __name__ == "__main__":
    display_weather()
