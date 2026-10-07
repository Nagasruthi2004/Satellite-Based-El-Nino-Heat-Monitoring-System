import io
import sys
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app
from satellite_heat_analysis import analyze_satellite_heat, classify_heat_risk


def _create_mock_jpeg():
    """Helper to generate dummy valid JPEG bytes with distinct colors and realistic size."""
    import numpy as np
    arr = (np.random.RandomState(42).rand(256, 256, 3) * 255).astype("uint8")
    img = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


class SatelliteHeatAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_missing_parameters(self):
        res = self.client.get("/satellite-heat-analysis")
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Missing required parameters", data["error"])

    def test_invalid_coordinates(self):
        res = self.client.get("/satellite-heat-analysis?lat=invalid&lon=77.0")
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Invalid coordinates", data["error"])

    def test_out_of_bounds_coordinates(self):
        res = self.client.get("/satellite-heat-analysis?lat=95.0&lon=200.0")
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Coordinates out of bounds", data["error"])

    def test_classify_heat_risk(self):
        self.assertEqual(classify_heat_risk(43.5), "CRITICAL")
        self.assertEqual(classify_heat_risk(38.2), "HIGH")
        self.assertEqual(classify_heat_risk(32.0), "MODERATE")
        self.assertEqual(classify_heat_risk(24.5), "LOW")

    @patch("requests.get")
    def test_unavailable_satellite_data(self, mock_get):
        # Mock empty or XML response indicating no satellite data
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "text/xml"}
        mock_resp.content = b"<?xml version='1.0'?><ServiceException>No data</ServiceException>"
        mock_get.return_value = mock_resp

        res = self.client.get("/satellite-heat-analysis?lat=13.0827&lon=80.2707&date=1990-01-01")
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertEqual(data["status"], "no_data")
        self.assertIn("unavailable", data["error"].lower())

    @patch("satellite_heat_analysis.requests.get")
    def test_successful_satellite_heat_analysis(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "image/jpeg"}
        mock_resp.content = _create_mock_jpeg()
        mock_get.return_value = mock_resp

        res = self.client.get("/satellite-heat-analysis?lat=13.0827&lon=80.2707&date=2024-05-15")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertTrue(data["available"])
        self.assertIn("land_surface_temperature", data)
        self.assertIn("thermal_analysis", data)
        self.assertIn("min_lst", data["thermal_analysis"])
        self.assertIn("average_lst", data["thermal_analysis"])
        self.assertIn("max_lst", data["thermal_analysis"])
        self.assertIn("heat_risk", data)
        self.assertIn(data["heat_risk"], ["LOW", "MODERATE", "HIGH", "CRITICAL"])
        self.assertIn("hotspot_detection", data)
        self.assertIn("satellite_image_url", data)
        self.assertIn("thermal_overlay_url", data)
        self.assertIn("thermal_image_url", data)
        self.assertIn("risk_distribution", data)
        self.assertIn("low_pct", data["risk_distribution"])
        self.assertIn("high_pct", data["risk_distribution"])
        self.assertIn("key_insights", data)
        self.assertTrue(len(data["key_insights"]) >= 3)
        self.assertIn("temperature_areas", data)
        self.assertIn("hotspots", data)
        self.assertIn("product_name", data)


if __name__ == "__main__":
    unittest.main()
