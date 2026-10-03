"""
Unit tests for Emergency Location & Nearby Help module
Tests /emergency-info endpoint, response structure, parameter validation,
privacy protection, and heat risk integration.
"""

import os
import sys
import unittest

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from emergency_location import (
    VERIFIED_EMERGENCY_CONTACTS,
    DISASTER_SAFETY_SHORTCUTS,
    get_emergency_info,
    resolve_heat_risk_for_location,
)


class TestEmergencyLocationModule(unittest.TestCase):
    """Test suite for Emergency Location module and API."""

    def setUp(self):
        self.client = app.test_client()

    # 1. Emergency information endpoint
    def test_emergency_info_endpoint(self):
        res = self.client.get("/emergency-info")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("verified_contacts", data)
        self.assertIn("location_heat_status", data)
        self.assertIn("privacy_notice", data)
        self.assertIn("nearby_places_service", data)
        self.assertIn("disaster_safety_links", data)

    # 2. Valid response structure & verified emergency numbers
    def test_valid_response_structure(self):
        res = self.client.get("/emergency-info")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        contacts = data["verified_contacts"]
        self.assertIsInstance(contacts, list)
        self.assertGreaterEqual(len(contacts), 4)

        # Check required emergency numbers are present
        numbers = [c["number"] for c in contacts]
        self.assertIn("112", numbers)  # Unified Emergency
        self.assertIn("108", numbers)  # Ambulance / Medical
        self.assertIn("101", numbers)  # Fire
        self.assertIn("100", numbers)  # Police

        # Verify contact object fields
        for c in contacts:
            self.assertIn("id", c)
            self.assertIn("name", c)
            self.assertIn("number", c)
            self.assertIn("authority", c)
            self.assertIn("verification_status", c)
            self.assertTrue(c.get("toll_free"))

        # Verify disaster safety shortcuts
        disasters = data["disaster_safety_links"]
        disaster_ids = [d["id"] for d in disasters]
        for expected in ["heatwave", "flood", "cyclone", "landslide", "earthquake"]:
            self.assertIn(expected, disaster_ids)

    # 3. Location parameters handling
    def test_location_parameters_query(self):
        # By city name
        res_city = self.client.get("/emergency-info?location=Chennai")
        self.assertEqual(res_city.status_code, 200)
        data_city = res_city.get_json()
        self.assertEqual(data_city["status"], "success")
        self.assertIn("location_heat_status", data_city)

        # By coordinates
        res_coords = self.client.get("/emergency-info?lat=13.0827&lon=80.2707")
        self.assertEqual(res_coords.status_code, 200)
        data_coords = res_coords.get_json()
        self.assertEqual(data_coords["status"], "success")

    # 4. Missing and invalid parameters handling
    def test_missing_and_invalid_parameters(self):
        # Non-numeric lat/lon should not crash
        res_invalid = self.client.get("/emergency-info?lat=invalid_lat&lon=not_a_number")
        self.assertEqual(res_invalid.status_code, 200)
        data = res_invalid.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("location_heat_status", data)

        # Empty parameters
        res_empty = self.client.get("/emergency-info?location=")
        self.assertEqual(res_empty.status_code, 200)
        data_empty = res_empty.get_json()
        self.assertEqual(data_empty["status"], "success")

    # 5. No fake or private data
    def test_no_fake_private_data(self):
        res = self.client.get("/emergency-info")
        data = res.get_json()

        # Place service should explicitly state unconfigured, not fabricate fake clinics/hospitals
        place_service = data["nearby_places_service"]
        self.assertFalse(place_service.get("enabled"))
        self.assertIn("not configured", place_service.get("message", "").lower())

        # Check privacy notice
        privacy = data.get("privacy_notice", "")
        self.assertIn("does not continuously track", privacy)
        self.assertIn("only when you choose", privacy)

    # 6. Existing heat-risk integration
    def test_heat_risk_integration(self):
        res = self.client.get("/emergency-info?location=Coimbatore")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        heat_info = data["location_heat_status"]
        self.assertIn("heat_risk", heat_info)
        self.assertIn(heat_info["heat_risk"], ["Low", "Medium", "High", "Critical"])
        self.assertIn("temperature", heat_info)
        self.assertIn("safety_guidance", heat_info)


if __name__ == "__main__":
    unittest.main()
