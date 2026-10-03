import unittest
import json
from app import app


class Heat2026PredictionTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_endpoint_returns_200_and_all_states(self):
        """Test GET /heat-2026-prediction returns HTTP 200 and all 34 states."""
        response = self.client.get("/heat-2026-prediction")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(data["status"], "success")
        self.assertEqual(data["prediction_year"], 2026)
        self.assertEqual(data["total_states"], 34)
        self.assertEqual(len(data["states"]), 34)
        self.assertIn("summary", data)
        self.assertIn("top_10_hotspots", data)
        self.assertIn("model_info", data)
        self.assertIn("limitations", data)

    def test_each_state_has_predicted_lst_and_valid_risk(self):
        """Test each state has a valid predicted 2026 LST and standardized risk tier."""
        response = self.client.get("/heat-2026-prediction")
        data = json.loads(response.data)
        valid_tiers = {"Low", "Moderate", "High", "Critical"}

        for state_obj in data["states"]:
            self.assertIn("state", state_obj)
            self.assertIn("predicted_2026_lst", state_obj)
            self.assertIsInstance(state_obj["predicted_2026_lst"], (int, float))
            # Temperature check (reasonable LST between 5°C and 60°C)
            self.assertGreater(state_obj["predicted_2026_lst"], 5.0)
            self.assertLess(state_obj["predicted_2026_lst"], 60.0)

            self.assertIn("predicted_2026_risk", state_obj)
            self.assertIn(state_obj["predicted_2026_risk"], valid_tiers)
            self.assertIn("observed_2025_lst", state_obj)
            self.assertIn("change_from_2025", state_obj)
            self.assertIn("historical_records", state_obj)
            self.assertEqual(len(state_obj["historical_records"]), 6)

    def test_state_specific_query_success(self):
        """Test GET /heat-2026-prediction?state=Tamil%20Nadu returns single state prediction."""
        response = self.client.get("/heat-2026-prediction?state=Tamil%20Nadu")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(data["status"], "success")
        self.assertIn("state", data)
        self.assertEqual(data["state"]["state"], "Tamil Nadu")
        self.assertIn("predicted_2026_lst", data["state"])
        self.assertIn("predicted_2026_risk", data["state"])
        self.assertIn("explanation", data["state"])

    def test_invalid_state_returns_404(self):
        """Test GET /heat-2026-prediction?state=NonExistentState returns HTTP 404."""
        response = self.client.get("/heat-2026-prediction?state=NonExistentState")
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)

        self.assertEqual(data["status"], "error")
        self.assertIn("not found", data["error"].lower())
        self.assertIn("available_states", data)
        self.assertEqual(len(data["available_states"]), 34)

    def test_top_10_hotspots_and_summary_consistency(self):
        """Verify summary values match top states and valid counts."""
        response = self.client.get("/heat-2026-prediction")
        data = json.loads(response.data)

        summary = data["summary"]
        self.assertIn("predicted_national_average_lst", summary)
        self.assertIn("highest_predicted", summary)
        self.assertIn("lowest_predicted", summary)
        self.assertIn("risk_distribution", summary)

        # 10 hotspots returned
        self.assertEqual(len(data["top_10_hotspots"]), 10)
        # Top hotspot matches highest_predicted state
        self.assertEqual(data["top_10_hotspots"][0]["state"], summary["highest_predicted"]["state"])


if __name__ == "__main__":
    unittest.main()
