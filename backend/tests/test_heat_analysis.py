import unittest
import json
from app import app


class HeatAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_heat_analysis_default(self):
        """Test GET /heat-analysis returns 200 with default year 2025 and all expected keys."""
        response = self.client.get("/heat-analysis")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(data["status"], "success")
        self.assertEqual(data["selected_year"], 2025)
        self.assertEqual(data["available_years"], [2020, 2021, 2022, 2023, 2024, 2025])
        self.assertIn("yearly_trend", data)
        self.assertIn("by_year", data)
        self.assertIn("risk_distribution_by_year", data)
        self.assertIn("state_history", data)
        self.assertIn("overall_insights", data)
        self.assertIn("selected_year_analysis", data)
        self.assertIn("source_info", data)

        # 6 years in trend
        self.assertEqual(len(data["yearly_trend"]), 6)
        # 34 states in state history
        self.assertEqual(len(data["available_states"]), 34)

    def test_heat_analysis_factual_dataset_values(self):
        """Verify calculations match the real dataset values precisely."""
        response = self.client.get("/heat-analysis")
        data = json.loads(response.data)

        trend_dict = {t["year"]: t for t in data["yearly_trend"]}
        self.assertEqual(trend_dict[2020]["average_lst"], 28.36)
        self.assertEqual(trend_dict[2021]["average_lst"], 28.51)
        self.assertEqual(trend_dict[2022]["average_lst"], 28.17)
        self.assertEqual(trend_dict[2023]["average_lst"], 28.20)
        self.assertEqual(trend_dict[2024]["average_lst"], 27.59)
        self.assertEqual(trend_dict[2025]["average_lst"], 25.89)

        insights = data["overall_insights"]
        self.assertEqual(insights["overall_average_lst"], 27.78)
        self.assertEqual(insights["highest_record"]["state"], "Rajasthan")
        self.assertEqual(insights["highest_record"]["year"], 2020)
        self.assertEqual(insights["highest_record"]["lst_celsius"], 36.49)
        self.assertEqual(insights["lowest_record"]["state"], "Sikkim")
        self.assertEqual(insights["lowest_record"]["year"], 2020)
        self.assertEqual(insights["lowest_record"]["lst_celsius"], 9.38)

    def test_heat_analysis_selected_year(self):
        """Test GET /heat-analysis?year=2021 reflects 2021 data."""
        response = self.client.get("/heat-analysis?year=2021")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["selected_year"], 2021)
        self.assertEqual(data["selected_year_analysis"]["year"], 2021)
        self.assertEqual(len(data["selected_year_analysis"]["top_10_hottest"]), 10)
        self.assertEqual(len(data["selected_year_analysis"]["bottom_5_lowest"]), 5)

    def test_heat_analysis_invalid_year(self):
        """Test invalid year values return 400 or 404."""
        # Out-of-range year
        resp_404 = self.client.get("/heat-analysis?year=1999")
        self.assertEqual(resp_404.status_code, 404)

        # Non-integer year
        resp_400 = self.client.get("/heat-analysis?year=xyz")
        self.assertEqual(resp_400.status_code, 400)

    def test_heat_analysis_state_comparison(self):
        """Test state comparison query parameters."""
        response = self.client.get("/heat-analysis?state_a=Tamil%20Nadu&state_b=Rajasthan")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsNotNone(data["comparison"])
        comp = data["comparison"]
        self.assertEqual(comp["state_a"]["state"], "Tamil Nadu")
        self.assertEqual(comp["state_b"]["state"], "Rajasthan")
        self.assertEqual(len(comp["chart_data"]), 6)

        # Check invalid state comparison returns 400
        invalid_resp = self.client.get("/heat-analysis?state_a=Atlantis&state_b=Rajasthan")
        self.assertEqual(invalid_resp.status_code, 400)

    def test_heat_analysis_single_state(self):
        """Test single state historical trend parameter."""
        response = self.client.get("/heat-analysis?state=Kerala")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsNotNone(data["single_state_analysis"])
        st = data["single_state_analysis"]
        self.assertEqual(st["state"], "Kerala")
        self.assertEqual(len(st["yearly_data"]), 6)


if __name__ == "__main__":
    unittest.main()
