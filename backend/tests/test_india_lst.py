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
        self.assertEqual(data["highest_lst"]["lst_celsius"], 31.57)
        self.assertEqual(data["risk_distribution"]["Low"], 22)
        self.assertEqual(data["risk_distribution"]["Moderate"], 12)

    def test_india_lst_all_years(self):
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

    def test_india_lst_invalid_year(self):
        response = self.client.get("/india-lst?year=1999")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("Data unavailable", data["error"])


if __name__ == "__main__":
    unittest.main()
