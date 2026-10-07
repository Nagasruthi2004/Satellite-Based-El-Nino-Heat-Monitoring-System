import sys
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app


class SatelliteChangeDetectionTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_missing_parameters(self):
        response = self.client.get("/satellite-change-detection/image")
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("Missing required parameters", data["error"])

    def test_invalid_coordinates(self):
        response = self.client.get("/satellite-change-detection/image?lat=abc&lon=def&date=2024-04-10")
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("Invalid coordinates", data["error"])

    def test_out_of_bounds_coordinates(self):
        response = self.client.get("/satellite-change-detection/image?lat=120&lon=80&date=2024-04-10")
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("Coordinates out of bounds", data["error"])

    def test_invalid_date_format(self):
        response = self.client.get("/satellite-change-detection/image?lat=13.0827&lon=80.2707&date=15-04-2024")
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("Invalid date format", data["error"])

    @patch("requests.get")
    def test_unavailable_imagery_404(self, mock_get):
        # Mock empty or XML response indicating no satellite data
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "text/xml"}
        mock_resp.content = b"<?xml version='1.0'?><ServiceExceptionReport>No data</ServiceExceptionReport>"
        mock_get.return_value = mock_resp

        response = self.client.get("/satellite-change-detection/image?lat=13.0827&lon=80.2707&date=1990-01-01")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertEqual(data["error"], "Satellite imagery is not available for this location/date range.")

    @patch("requests.get")
    def test_empty_black_tile_detected_as_no_data(self, mock_get):
        # NASA GIBS empty tile is < 2000 bytes (e.g. 1820 bytes of zeros)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "image/jpeg"}
        mock_resp.content = b"\xff\xd8" + (b"\x00" * 1800) + b"\xff\xd9"
        mock_get.return_value = mock_resp

        response = self.client.get("/satellite-change-detection/image?lat=13.0827&lon=80.2707&date=2024-04-15")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertEqual(data["error"], "Satellite imagery is not available for this location/date range.")

    @patch("requests.get")
    def test_valid_satellite_imagery_success(self, mock_get):
        fake_jpeg = b"\xff\xd8\xff\xe0" + (b"\xaa" * 15000) + b"\xff\xd9"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "image/jpeg"}
        mock_resp.content = fake_jpeg
        mock_get.return_value = mock_resp

        response = self.client.get("/satellite-change-detection/image?lat=13.0827&lon=80.2707&date=2024-04-10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "image/jpeg")
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), "*")
        self.assertEqual(response.data, fake_jpeg)


if __name__ == "__main__":
    unittest.main()
