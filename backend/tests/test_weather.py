import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from weather import fetch_weather, is_weather_api_configured


class WeatherTests(unittest.TestCase):
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
        self.assertEqual(result["rainfall"], 0.5)
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
