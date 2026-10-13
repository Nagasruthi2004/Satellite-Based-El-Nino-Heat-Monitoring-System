import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from weather import (
    fetch_weather,
    is_weather_api_configured,
    fetch_live_rainfall_open_meteo,
    extract_observed_rainfall,
)


class WeatherTests(unittest.TestCase):
    def test_extract_observed_rainfall_rain_1h(self):
        """Test extract_observed_rainfall when rain.1h > 0."""
        text, val = extract_observed_rainfall({"rain": {"1h": 1.2}, "weather": [{"main": "Rain"}]})
        self.assertEqual(text, "1.2 mm - Raining now 🌧️")
        self.assertEqual(val, 1.2)

    def test_extract_observed_rainfall_rain_3h(self):
        """Test extract_observed_rainfall when only rain.3h is present."""
        text, val = extract_observed_rainfall({"rain": {"3h": 3.6}, "weather": [{"main": "Rain"}]})
        self.assertEqual(text, "1.2 mm - Raining now 🌧️")
        self.assertEqual(val, 1.2)

    def test_extract_observed_rainfall_weather_main_rain(self):
        """Test extract_observed_rainfall when weather[0].main == 'Rain' but no 1h/3h rain."""
        text, val = extract_observed_rainfall({"weather": [{"main": "Rain", "description": "light rain"}]})
        self.assertEqual(text, "0.5 mm - Light rain 🌧️")
        self.assertEqual(val, 0.5)

    def test_extract_observed_rainfall_no_rain(self):
        """Test extract_observed_rainfall when no rain is present."""
        text, val = extract_observed_rainfall({"weather": [{"main": "Clouds", "description": "overcast clouds"}]})
        self.assertEqual(text, "0 mm - No live rain")
        self.assertEqual(val, 0.0)

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_mock_api_key"})
    @patch("weather.requests.get")
    def test_fetch_live_rainfall_open_meteo_raining(self, mock_get):
        """Test fetch_live_rainfall_open_meteo helper when precipitation > 0 via OpenWeatherMap."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "name": "Boston",
            "main": {"temp": 12.0, "humidity": 80},
            "rain": {"1h": 2.5},
            "weather": [{"main": "Rain", "description": "moderate rain"}],
            "coord": {"lat": 42.36, "lon": -71.06},
        }
        mock_get.return_value = mock_response

        res = fetch_live_rainfall_open_meteo(42.36, -71.06)
        self.assertIsNotNone(res)
        self.assertEqual(res["text"], "2.5 mm - Raining now 🌧️")
        self.assertEqual(res["current"], 2.5)
        self.assertEqual(res["value"], 2.5)
        self.assertNotIn("today", res)

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_mock_api_key"})
    @patch("weather.requests.get")
    def test_fetch_live_rainfall_open_meteo_not_raining(self, mock_get):
        """Test fetch_live_rainfall_open_meteo helper when precipitation is 0 via OpenWeatherMap."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "name": "Cherrapunji",
            "main": {"temp": 24.0, "humidity": 60},
            "weather": [{"main": "Clear", "description": "clear sky"}],
            "coord": {"lat": 25.30, "lon": 91.70},
        }
        mock_get.return_value = mock_response

        res = fetch_live_rainfall_open_meteo(25.30, 91.70)
        self.assertIsNotNone(res)
        self.assertEqual(res["text"], "0 mm - No live rain")
        self.assertEqual(res["current"], 0.0)
        self.assertEqual(res["value"], 0.0)
        self.assertNotIn("today", res)

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_mock_api_key"})
    def test_is_weather_api_configured_true(self):
        """Test is_weather_api_configured returns True when valid key is set."""
        self.assertTrue(is_weather_api_configured())

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": ""}, clear=True)
    def test_is_weather_api_configured_false_when_empty(self):
        """Test is_weather_api_configured returns False when key is empty."""
        self.assertFalse(is_weather_api_configured())

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "your_openweather_api_key_here"})
    def test_is_weather_api_configured_false_when_placeholder(self):
        """Test is_weather_api_configured returns False when key is a placeholder."""
        self.assertFalse(is_weather_api_configured())

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_mock_api_key"})
    @patch("weather.requests.get")
    def test_fetch_weather_returns_expected_fields(self, mock_get):
        """Test successful weather fetch with valid API key and parsed fields."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "name": "Coimbatore",
            "main": {"temp": 31.2, "humidity": 65, "pressure": 1012},
            "wind": {"speed": 5.4},
            "rain": {"1h": 0.5},
            "weather": [{"description": "broken clouds"}],
            "coord": {"lat": 11.0168, "lon": 76.9558},
        }
        mock_get.return_value = mock_response

        result = fetch_weather("Coimbatore")

        self.assertIsNotNone(result)
        self.assertEqual(result["city"], "Coimbatore")
        self.assertEqual(result["temperature"], 31.2)
        self.assertEqual(result["humidity"], 65)
        self.assertEqual(result["wind_speed"], 5.4)
        self.assertEqual(result["rainfall"], "0.5 mm - Raining now 🌧️")
        self.assertEqual(result["rainfall_numeric"], 0.5)
        self.assertEqual(result["weather_description"], "broken clouds")
        self.assertEqual(result["lat"], 11.0168)
        self.assertEqual(result["lon"], 76.9558)

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": ""}, clear=True)
    def test_fetch_weather_unconfigured_api_key(self):
        """Test that missing or unconfigured OPENWEATHER_API_KEY returns None immediately."""
        result = fetch_weather("Coimbatore")
        self.assertIsNone(result)

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "YOUR_NEW_OPENWEATHER_API_KEY"})
    def test_fetch_weather_placeholder_api_key(self):
        """Test that placeholder OPENWEATHER_API_KEY returns None without failing network calls."""
        result = fetch_weather("Coimbatore")
        self.assertIsNone(result)

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_mock_api_key"})
    @patch("weather.requests.get")
    def test_fetch_weather_provider_401_unauthorized(self, mock_get):
        """Test that HTTP 401 Unauthorized returns None cleanly without retrying endlessly."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_get.return_value = mock_response

        result = fetch_weather("Coimbatore")
        self.assertIsNone(result)
        self.assertEqual(mock_get.call_count, 1)  # No wasteful retry on 401

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_mock_api_key"})
    @patch("weather.requests.get")
    def test_fetch_weather_provider_404_not_found(self, mock_get):
        """Test that HTTP 404 returns None when location cannot be resolved."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        result = fetch_weather("NonexistentCity12345")
        self.assertIsNone(result)

    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_mock_api_key"})
    @patch("weather.requests.get")
    def test_fetch_weather_provider_network_failure(self, mock_get):
        """Test that network exceptions gracefully exhaust retries and return None."""
        import requests
        mock_get.side_effect = requests.exceptions.ConnectionError("DNS failure")

        result = fetch_weather("Coimbatore", retries=2)
        self.assertIsNone(result)
        self.assertEqual(mock_get.call_count, 2)


if __name__ == "__main__":
    unittest.main()
