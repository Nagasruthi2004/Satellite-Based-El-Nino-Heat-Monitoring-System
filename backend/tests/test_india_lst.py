import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app


class IndiaLSTTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_india_lst_endpoint_default_2025(self):
        response = self.client.get("/india-lst")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["year"], 2025)
        self.assertEqual(data["count"], 34)
        self.assertEqual(data["average_lst"], 25.89)
        self.assertEqual(data["lowest_lst"]["lst_celsius"], 10.05)
        self.assertEqual(data["lowest_lst"]["heat_risk"], "Low")
        self.assertEqual(data["highest_lst"]["lst_celsius"], 31.57)
        self.assertEqual(data["highest_lst"]["heat_risk"], "Moderate")
        self.assertEqual(data["risk_distribution"]["Low"], 28)
        self.assertEqual(data["risk_distribution"]["Moderate"], 6)
        self.assertEqual(data["risk_distribution"].get("High", 0), 0)
        self.assertEqual(data["risk_distribution"].get("Critical", 0), 0)

    def test_heat_risk_boundary_conditions(self):
        from app import classify_lst_heat_risk
        self.assertEqual(classify_lst_heat_risk(29.99), "Low")
        self.assertEqual(classify_lst_heat_risk(30.00), "Moderate")
        self.assertEqual(classify_lst_heat_risk(35.99), "Moderate")
        self.assertEqual(classify_lst_heat_risk(36.00), "High")
        self.assertEqual(classify_lst_heat_risk(39.99), "High")
        self.assertEqual(classify_lst_heat_risk(40.00), "Critical")

    def test_gujarat_2024_moderate_risk(self):
        """Gujarat 2024 with Average LST 33.32°C must classify as Moderate Risk, not High Risk."""
        response = self.client.get("/india-lst?year=2024")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        gujarat = next((item for item in data["data"] if item["state"] == "Gujarat"), None)
        self.assertIsNotNone(gujarat)
        self.assertEqual(gujarat["lst_celsius"], 33.32)
        self.assertEqual(gujarat["heat_risk"], "Moderate")

    def test_india_lst_all_years(self):
        from app import classify_lst_heat_risk
        expected_stats = {
            2020: {"count": 34, "avg": 28.36, "min": 9.38, "max": 36.49},
            2021: {"count": 34, "avg": 28.51, "min": 10.38, "max": 36.17},
            2022: {"count": 34, "avg": 28.17, "min": 10.19, "max": 36.19},
            2023: {"count": 34, "avg": 28.2, "min": 11.14, "max": 34.43},
            2024: {"count": 34, "avg": 27.59, "min": 10.43, "max": 34.6},
            2025: {"count": 34, "avg": 25.89, "min": 10.05, "max": 31.57}
        }
        for year, exp in expected_stats.items():
            response = self.client.get(f"/india-lst?year={year}")
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertEqual(data["year"], year)
            self.assertEqual(data["count"], exp["count"])
            self.assertEqual(data["average_lst"], exp["avg"])
            self.assertEqual(data["lowest_lst"]["lst_celsius"], exp["min"])
            self.assertEqual(data["highest_lst"]["lst_celsius"], exp["max"])
            self.assertEqual(len(data["data"]), 34)

            # Ensure every single state record uses dynamic classification
            for rec in data["data"]:
                expected_risk = classify_lst_heat_risk(rec["lst_celsius"])
                self.assertEqual(
                    rec["heat_risk"],
                    expected_risk,
                    f"State {rec['state']} in year {year} with LST {rec['lst_celsius']} had risk {rec['heat_risk']}, expected {expected_risk}"
                )

    def test_india_lst_invalid_year(self):
        response = self.client.get("/india-lst?year=1999")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("Data unavailable", data["error"])


if __name__ == "__main__":
    unittest.main()
