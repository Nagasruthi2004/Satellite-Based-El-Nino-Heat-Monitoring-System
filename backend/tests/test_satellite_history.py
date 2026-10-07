"""
Unit tests for Satellite Time Machine historical satellite and LST endpoint.
Verifies location-driven historical lookups for Visakhapatnam, Coimbatore, Chennai,
coordinate parameters (lat, lon), and error handling for unavailable locations.
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app


class SatelliteHistoryTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_visakhapatnam_historical_by_city(self):
        """Verify Visakhapatnam historical satellite/LST lookup by city name."""
        response = self.client.get("/satellite/history?city=Visakhapatnam&year=2024")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("available"))
        self.assertEqual(data.get("location"), "Visakhapatnam")
        self.assertNotEqual(data.get("location"), "Coimbatore")
        self.assertIsNotNone(data.get("land_surface_temperature"))
        self.assertIsNotNone(data.get("heat_risk"))
        self.assertEqual(data.get("year"), 2024)

    def test_visakhapatnam_historical_by_coordinates(self):
        """Verify Visakhapatnam lookup using latitude and longitude."""
        response = self.client.get("/satellite/history?city=Visakhapatnam&lat=17.6868&lon=83.2185&year=2020")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("available"))
        self.assertEqual(data.get("location"), "Visakhapatnam")
        self.assertAlmostEqual(data.get("latitude"), 17.6868, places=2)
        self.assertAlmostEqual(data.get("longitude"), 83.2185, places=2)
        self.assertEqual(data.get("year"), 2020)
        self.assertIsNotNone(data.get("land_surface_temperature"))

    def test_coimbatore_historical(self):
        """Verify Coimbatore historical satellite/LST lookup."""
        response = self.client.get("/satellite/history?city=Coimbatore&lat=11.0168&lon=76.9558&year=2024")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("available"))
        self.assertEqual(data.get("location"), "Coimbatore")
        self.assertIsNotNone(data.get("land_surface_temperature"))
        self.assertIsNotNone(data.get("heat_risk"))

    def test_chennai_historical(self):
        """Verify Chennai historical satellite/LST lookup."""
        response = self.client.get("/satellite/history?city=Chennai&lat=13.0827&lon=80.2707&year=2024")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("available"))
        self.assertEqual(data.get("location"), "Chennai")
        self.assertIsNotNone(data.get("land_surface_temperature"))
        self.assertIsNotNone(data.get("heat_risk"))

    def test_selected_location_not_replaced_by_default(self):
        """Verify selected city is preserved and not silently replaced by Coimbatore."""
        cities = ["Visakhapatnam", "Chennai", "Madurai"]
        for c in cities:
            res = self.client.get(f"/satellite/history?city={c}&year=2024")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data.get("location"), c)

    def test_unavailable_historical_location(self):
        """Verify clear unavailable message for invalid/unavailable coordinates."""
        response = self.client.get("/satellite/history?lat=-89.0&lon=-179.0&year=1850")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertFalse(data.get("available"))
        self.assertEqual(data.get("error"), "Historical satellite data is not available for this location.")

    def test_satellite_endpoint_with_coordinates_and_year(self):
        """Verify /satellite route accepts latitude, longitude, and year."""
        response = self.client.get("/satellite?city=Visakhapatnam&lat=17.6868&lon=83.2185&year=2024")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("location"), "Visakhapatnam")
        self.assertIsNotNone(data.get("land_surface_temperature"))


if __name__ == "__main__":
    unittest.main()
