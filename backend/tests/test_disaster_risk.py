import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from disaster_risk import evaluate_disaster_risk


class DisasterRiskTests(unittest.TestCase):
    @patch("disaster_risk.fetch_weather")
    def test_invalid_location_returns_unavailable_data(self, mock_fetch_weather):
        mock_fetch_weather.return_value = None

        result = evaluate_disaster_risk("NonExistentCity12345")

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "No Verified Alert Data")
        self.assertEqual(result["message"], "No verified alert data is currently available for this location.")
        self.assertIn("disasters", result)
        self.assertEqual(len(result["disasters"]), 5)

        for d_id, d_data in result["disasters"].items():
            self.assertEqual(d_data["category"], "No Verified Alert Data")
            self.assertIn("No verified", d_data["message"])

    @patch("disaster_risk.fetch_recent_earthquakes")
    @patch("disaster_risk.fetch_24h_rainfall_forecast")
    @patch("disaster_risk.fetch_weather")
    def test_chennai_risk_evaluation(self, mock_fetch_weather, mock_forecast, mock_earthquakes):
        mock_fetch_weather.return_value = {
            "city": "Chennai",
            "lat": 13.0827,
            "lon": 80.2707,
            "temperature": 32.5,
            "humidity": 75,
            "wind_speed": 4.5,
            "rainfall": 0.0,
            "weather_description": "scattered clouds",
            "pressure": 1014,
        }
        mock_forecast.return_value = (5.0, 2.0, 5.0, 1013)
        mock_earthquakes.return_value = []

        result = evaluate_disaster_risk("Chennai")

        self.assertTrue(result["success"])
        self.assertEqual(result["location"], "Chennai")
        disasters = result["disasters"]

        # 1. Flood
        self.assertIn("flood", disasters)
        self.assertIn(disasters["flood"]["status"], ["Low", "Moderate", "High", "Critical"])

        # 2. Cyclone
        self.assertIn("cyclone", disasters)
        self.assertIn(disasters["cyclone"]["status"], ["No Alert", "Watch", "Warning", "High Risk"])
        self.assertEqual(disasters["cyclone"]["status"], "No Alert")

        # 3. Landslide
        self.assertIn("landslide", disasters)
        self.assertIn(disasters["landslide"]["status"], ["Low", "Moderate", "High", "Critical"])

        # 4. Earthquake
        self.assertIn("earthquake", disasters)
        self.assertEqual(disasters["earthquake"]["title"], "Earthquake Risk / Recent Event Monitoring / Early Warning")
        self.assertEqual(disasters["earthquake"]["status"], "No Verified Alert Data")
        self.assertEqual(disasters["earthquake"]["message"], "No verified earthquake alert data is currently available for this location.")

        # 5. Heatwave
        self.assertIn("heatwave", disasters)
        self.assertIn(disasters["heatwave"]["status"], ["Low", "Medium", "High", "Critical"])

    @patch("disaster_risk.fetch_recent_earthquakes")
    @patch("disaster_risk.fetch_24h_rainfall_forecast")
    @patch("disaster_risk.fetch_weather")
    def test_earthquake_verified_alert_when_recent_event_exists(self, mock_fetch_weather, mock_forecast, mock_earthquakes):
        mock_fetch_weather.return_value = {
            "city": "Tokyo",
            "lat": 35.6762,
            "lon": 139.6503,
            "temperature": 18.0,
            "humidity": 50,
            "wind_speed": 3.0,
            "rainfall": 0.0,
            "weather_description": "clear sky",
            "pressure": 1016,
        }
        mock_forecast.return_value = (0.0, 0.0, 3.0, 1016)
        mock_earthquakes.return_value = [{
            "place": "Off the coast of Honshu, Japan",
            "magnitude": 4.8,
            "time": "2026-10-07 12:00 UTC",
            "depth_km": 35.0,
            "url": "https://earthquake.usgs.gov/earthquakes/eventpage/test",
            "alert": "green",
        }]

        result = evaluate_disaster_risk("Tokyo")
        eq = result["disasters"]["earthquake"]

        self.assertEqual(eq["category"], "Verified Alert")
        self.assertIn("M 4.8", eq["status"])
        self.assertIn("USGS Earthquake Hazards Program", eq["data_source"])


if __name__ == "__main__":
    unittest.main()
