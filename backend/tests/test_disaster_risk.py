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

    @patch("disaster_risk.fetch_recent_earthquakes")
    @patch("disaster_risk.fetch_24h_rainfall_forecast")
    @patch("disaster_risk.fetch_weather")
    def test_early_heatwave_warning_payload_chennai(self, mock_fetch_weather, mock_forecast, mock_earthquakes):
        """Test early heatwave warning timeline, demographic assessment, and provenance."""
        mock_fetch_weather.return_value = {
            "city": "Chennai",
            "lat": 13.0827,
            "lon": 80.2707,
            "temperature": 37.5,
            "humidity": 68,
            "wind_speed": 4.2,
            "rainfall": 0.0,
            "weather_description": "haze",
            "pressure": 1012,
        }
        mock_forecast.return_value = (0.0, 0.0, 4.0, 1012)
        mock_earthquakes.return_value = []

        result = evaluate_disaster_risk("Chennai")
        self.assertTrue(result["success"])
        self.assertIn("early_heatwave_warning", result)

        warning = result["early_heatwave_warning"]
        self.assertEqual(warning["current_heat_risk_level"], "High")
        self.assertGreater(warning["current_heat_risk_score"], 60.0)

        # 1. Forecast timeline contains multi-day intervals
        self.assertIn("forecast_timeline", warning)
        self.assertGreaterEqual(len(warning["forecast_timeline"]), 3)
        day1 = warning["forecast_timeline"][0]
        self.assertIn("max_temperature", day1)
        self.assertIn("heat_risk_level", day1)
        self.assertIn("data_type", day1)

        # 2. Demographic impact assessment uses verified benchmarks
        impact = warning["impact_assessment"]
        self.assertTrue(impact["has_demographic_data"])
        self.assertEqual(impact["total_exposed_population"], 7100000)
        self.assertIn("Greater Chennai Corporation", impact["demographic_source"])
        self.assertGreaterEqual(len(impact["vulnerable_groups"]), 3)

        # 3. Recommended actions tailored to High risk
        actions = warning["recommended_actions"]
        self.assertGreaterEqual(len(actions), 3)

        # 4. Provenance and official guidance sources
        self.assertIn("data_provenance", warning)
        self.assertIn("official_sources", warning)
        agencies = [src["agency"] for src in warning["official_sources"]]
        self.assertTrue(any("IMD" in a or "Ministry of Earth Sciences" in a for a in agencies))
        self.assertTrue(any("NDMA" in a or "Govt. of India" in a for a in agencies))

        # 5. Scientific disclaimer integrity
        self.assertIn("scientific_disclaimer", warning)
        self.assertIn("Earthquakes", warning["scientific_disclaimer"])

    @patch("disaster_risk.fetch_recent_earthquakes")
    @patch("disaster_risk.fetch_24h_rainfall_forecast")
    @patch("disaster_risk.fetch_weather")
    def test_unmapped_city_demographics_not_fabricated(self, mock_fetch_weather, mock_forecast, mock_earthquakes):
        """Test that locations without census data return has_demographic_data=False and None population."""
        mock_fetch_weather.return_value = {
            "city": "Reykjavik",
            "lat": 64.1466,
            "lon": -21.9426,
            "temperature": 12.0,
            "humidity": 80,
            "wind_speed": 5.0,
            "rainfall": 0.0,
            "weather_description": "light rain",
            "pressure": 1005,
        }
        mock_forecast.return_value = (2.0, 1.0, 6.0, 1004)
        mock_earthquakes.return_value = []

        result = evaluate_disaster_risk("Reykjavik")
        warning = result["early_heatwave_warning"]
        impact = warning["impact_assessment"]

        # Ensure no fake population numbers are fabricated
        self.assertFalse(impact["has_demographic_data"])
        self.assertIsNone(impact["total_exposed_population"])
        self.assertIn("not indexed", impact["notice"].lower())


if __name__ == "__main__":
    unittest.main()
