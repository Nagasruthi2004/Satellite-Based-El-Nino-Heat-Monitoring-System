import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app
import heat_emergency_and_planning as hep


class HeatEmergencyAndPlanningTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()



    def test_heatwave_impact_simulator_bounds_and_mitigation(self):
        """Test POST /api/heatwave-simulate validates input bounds and calculates strain reduction."""
        payload = {
            "temperature": 44.0,
            "humidity": 45.0,
            "duration_days": 4,
            "scenario": "outdoor_work",
            "protective_actions": ["shift_hours", "hydration_stations", "shaded_rest"]
        }
        res = self.client.post("/api/heatwave-simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")

        # Baseline strain should be higher than mitigated strain
        baseline = data["baseline_scenario"]
        mitigated = data["preparedness_scenario"]
        self.assertGreater(baseline["strain_index_score"], mitigated["strain_index_score"])
        self.assertGreater(mitigated["strain_reduction_pct"], 0.0)

        # Check non-clinical labeling
        self.assertFalse(data["is_validated_clinical_prediction"])
        self.assertIn("Illustrative", data["methodology_label"])
        self.assertIn("do NOT constitute a certified clinical health prognosis", data["assumptions_disclaimer"])

    def test_heatwave_impact_simulator_input_clamping(self):
        """Test simulator clamps extreme or invalid inputs to sensible physical bounds."""
        payload = {
            "temperature": 99.0,  # Clamped to 55.0
            "humidity": -20.0,    # Clamped to 5.0
            "duration_days": 100, # Clamped to 30
            "scenario": "invalid_scenario_id" # Defaults to outdoor_work
        }
        res = self.client.post("/api/heatwave-simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["inputs"]["temperature_celsius"], 55.0)
        self.assertEqual(data["inputs"]["humidity_pct"], 5.0)
        self.assertEqual(data["inputs"]["duration_days"], 30)
        self.assertEqual(data["inputs"]["scenario"], "outdoor_work")

    def test_heat_safety_challenge_data(self):
        """Test GET /api/heat-safety-quizzes returns evidence-based quizzes, myths/facts, and citations."""
        res = self.client.get("/api/heat-safety-quizzes")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")

        # Check both legacy and canonical frontend keys
        self.assertIn("quiz_questions", data)
        self.assertIn("myths_vs_facts", data)
        self.assertIn("scenario_challenges", data)
        self.assertIn("evidence_sources", data)

        self.assertGreaterEqual(len(data["quiz_questions"]), 5)
        self.assertGreaterEqual(len(data["myths_vs_facts"]), 5)
        self.assertGreaterEqual(len(data["scenario_challenges"]), 2)
        self.assertGreaterEqual(len(data["evidence_sources"]), 4)

        # Check authoritative sources are cited from WHO, NDMA, CDC
        source_names = [s["name"] for s in data["evidence_sources"]]
        self.assertTrue(any("WHO" in s or "World Health" in s for s in source_names))
        self.assertTrue(any("NDMA" in s for s in source_names))
        self.assertTrue(any("CDC" in s for s in source_names))

        # Check each quiz question structure, options, scoring integrity, and citations
        for q in data["quiz_questions"]:
            self.assertIn("id", q)
            self.assertIn("question", q)
            self.assertIn("options", q)
            self.assertGreaterEqual(len(q["options"]), 4)
            self.assertIn("correct_index", q)
            self.assertIsInstance(q["correct_index"], int)
            self.assertTrue(0 <= q["correct_index"] < len(q["options"]))
            self.assertIn("explanation", q)
            self.assertGreater(len(q["explanation"]), 20)
            self.assertIn("source", q)
            self.assertIn("source_citation", q)
            self.assertIn("category", q)

        # Check myth vs fact structure
        for m in data["myths_vs_facts"]:
            self.assertIn("id", m)
            self.assertIn("myth", m)
            self.assertIn("fact", m)
            self.assertIn("science_detail", m)
            self.assertIn("source", m)
            self.assertIn("authority", m)
            self.assertIn("icon", m)

        # Check scenario challenges structure with options and guidance
        for sc in data["scenario_challenges"]:
            self.assertIn("id", sc)
            self.assertIn("title", sc)
            self.assertIn("scenario", sc)
            self.assertIn("options", sc)
            self.assertGreaterEqual(len(sc["options"]), 2)
            self.assertIn("guidance", sc)
            # Exactly one option should be marked correct
            correct_opts = [opt for opt in sc["options"] if opt.get("is_correct") is True]
            self.assertEqual(len(correct_opts), 1)
            for opt in sc["options"]:
                self.assertIn("text", opt)
                self.assertIn("outcome", opt)
                self.assertIn("explanation", opt)

        # Check evidence sources structure
        for src in data["evidence_sources"]:
            self.assertIn("name", src)
            self.assertIn("organization", src)
            self.assertIn("publication", src)
            self.assertIn("year", src)
            self.assertIn("description", src)
            self.assertIn("url", src)
            self.assertTrue(src["url"].startswith("http://") or src["url"].startswith("https://"))

    def test_heat_safety_quizzes_endpoint_error_handling(self):
        """Test GET /api/heat-safety-quizzes handles unexpected backend failure gracefully with 500 status."""
        from unittest.mock import patch
        with patch("heat_emergency_and_planning.get_heat_safety_challenge_data", side_effect=RuntimeError("Data repository error")):
            res = self.client.get("/api/heat-safety-quizzes")
            self.assertEqual(res.status_code, 500)
            data = res.get_json()
            self.assertEqual(data["status"], "error")
            self.assertIn("Failed to retrieve", data["error"])


if __name__ == "__main__":
    unittest.main()
