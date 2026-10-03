import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app


class SmartAwarenessTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_smart_awareness_endpoint_low(self):
        response = self.client.get("/smart-awareness?level=low")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["level"], "Low")
        self.assertEqual(data["headline"], "Heat conditions are currently low.")
        self.assertEqual(data["guidance"], "Continue normal hydration and stay aware of weather changes.")
        self.assertGreaterEqual(len(data["recommended_actions"]), 3)
        self.assertGreaterEqual(len(data["why_this_alert"]), 1)

    def test_smart_awareness_endpoint_medium(self):
        response = self.client.get("/smart-awareness?level=medium")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["level"], "Medium")
        self.assertEqual(data["headline"], "Moderate heat conditions detected.")
        self.assertEqual(data["guidance"], "Stay hydrated and avoid unnecessary exposure to strong afternoon heat.")

    def test_smart_awareness_endpoint_high(self):
        response = self.client.get("/smart-awareness?level=high")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["level"], "High")
        self.assertEqual(data["headline"], "High heat conditions detected.")
        self.assertEqual(data["guidance"], "Drink plenty of water, reduce outdoor activity during peak afternoon hours, and stay in cool areas.")

    def test_smart_awareness_endpoint_critical(self):
        response = self.client.get("/smart-awareness?level=critical")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["level"], "Critical")
        self.assertEqual(data["headline"], "Critical heat conditions detected.")
        self.assertEqual(data["guidance"], "Avoid unnecessary outdoor exposure, stay hydrated, remain in a cool place, and seek medical help if heat-related symptoms occur.")


if __name__ == "__main__":
    unittest.main()
