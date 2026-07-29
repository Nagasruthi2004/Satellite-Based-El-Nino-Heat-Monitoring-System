import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from weather import fetch_weather


class WeatherTests(unittest.TestCase):
    @patch("weather.requests.get")
    def test_fetch_weather_returns_expected_fields(self, mock_get):
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "name": "Coimbatore",
            "main": {"temp": 31.2, "humidity": 65},
            "wind": {"speed": 5.4},
            "weather": [{"description": "broken clouds"}],
        }
        mock_get.return_value = mock_response

        result = fetch_weather("Coimbatore")

        self.assertEqual(result["city"], "Coimbatore")
        self.assertEqual(result["temperature"], 31.2)
        self.assertEqual(result["humidity"], 65)
        self.assertEqual(result["wind_speed"], 5.4)
        self.assertEqual(result["weather_description"], "broken clouds")


if __name__ == "__main__":
    unittest.main()
