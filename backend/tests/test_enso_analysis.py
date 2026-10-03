import unittest
import json
from app import app
from enso_analysis import classify_enso_phase, classify_enso_strength


class EnsoAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_endpoint_returns_200_and_required_keys(self):
        """Test GET /enso-analysis returns HTTP 200 with all structured payload sections."""
        response = self.client.get("/enso-analysis")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(data["status"], "success")
        self.assertIn("latest_status", data)
        self.assertIn("trend_series", data)
        self.assertIn("comparison_table", data)
        self.assertIn("phase_comparison", data)
        self.assertIn("correlation", data)
        self.assertIn("insights", data)
        self.assertIn("limitations", data)
        self.assertIn("source_info", data)

    def test_latest_enso_status_structure(self):
        """Test latest ENSO status contains valid phase and numeric ONI."""
        response = self.client.get("/enso-analysis")
        data = json.loads(response.data)

        latest = data["latest_status"]
        self.assertIn("oni", latest)
        self.assertIsInstance(latest["oni"], (int, float))
        self.assertIn("phase", latest)
        self.assertIn(latest["phase"], {"El Niño", "Neutral", "La Niña"})
        self.assertIn("strength", latest)
        self.assertIn("period", latest)

    def test_phase_and_strength_classification_helpers(self):
        """Test standard ENSO classification thresholds."""
        # Phase test
        self.assertEqual(classify_enso_phase(1.2), "El Niño")
        self.assertEqual(classify_enso_phase(0.5), "El Niño")
        self.assertEqual(classify_enso_phase(0.1), "Neutral")
        self.assertEqual(classify_enso_phase(-0.3), "Neutral")
        self.assertEqual(classify_enso_phase(-0.5), "La Niña")
        self.assertEqual(classify_enso_phase(-1.8), "La Niña")

        # Strength test
        self.assertEqual(classify_enso_strength(0.2), "Neutral")
        self.assertEqual(classify_enso_strength(0.7), "Weak")
        self.assertEqual(classify_enso_strength(1.2), "Moderate")
        self.assertEqual(classify_enso_strength(1.7), "Strong")
        self.assertEqual(classify_enso_strength(2.3), "Very Strong")

    def test_comparison_table_with_india_lst(self):
        """Test ENSO vs India LST comparison table covers 2020-2025."""
        response = self.client.get("/enso-analysis")
        data = json.loads(response.data)

        comp = data["comparison_table"]
        self.assertEqual(len(comp), 6)
        years = [r["year"] for r in comp]
        self.assertEqual(years, [2020, 2021, 2022, 2023, 2024, 2025])

        for row in comp:
            self.assertIn("annual_avg_oni", row)
            self.assertIn("predominant_phase", row)
            self.assertIn("india_avg_lst", row)
            self.assertIsInstance(row["india_avg_lst"], (int, float))

    def test_valid_year_query(self):
        """Test GET /enso-analysis?year=2023 returns single year record."""
        response = self.client.get("/enso-analysis?year=2023")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(data["status"], "success")
        self.assertEqual(data["selected_year"], 2023)
        self.assertIn("yearly_record", data)
        self.assertEqual(data["yearly_record"]["year"], 2023)
        self.assertEqual(data["yearly_record"]["predominant_phase"], "El Niño")

    def test_invalid_year_query(self):
        """Test 404 for out-of-range year and 400 for malformed year."""
        # 404 for unknown year
        resp_404 = self.client.get("/enso-analysis?year=1900")
        self.assertEqual(resp_404.status_code, 404)
        data_404 = json.loads(resp_404.data)
        self.assertEqual(data_404["status"], "error")

        # 400 for non-integer
        resp_400 = self.client.get("/enso-analysis?year=invalid")
        self.assertEqual(resp_400.status_code, 400)


if __name__ == "__main__":
    unittest.main()
