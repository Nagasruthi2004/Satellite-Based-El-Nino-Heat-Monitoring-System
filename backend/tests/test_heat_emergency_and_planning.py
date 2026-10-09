import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app
import heat_emergency_and_planning as hep


class HeatEmergencyAndPlanningTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_cooling_centers_verified_location(self):
        """Test GET /api/cooling-centers returns verified facilities and contacts for cataloged cities."""
        for city in ["Coimbatore", "Chennai", "Delhi"]:
            res = self.client.get(f"/api/cooling-centers?city={city}")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["coverage_status"], "verified_available")
            self.assertGreater(len(data["cooling_centers"]), 0)
            self.assertGreater(len(data["hospitals"]), 0)
            self.assertGreater(len(data["water_points"]), 0)
            self.assertGreater(len(data["emergency_contacts"]), 0)

            # Check 112 and 108 are present in emergency contacts
            numbers = [c["number"] for c in data["emergency_contacts"]]
            self.assertTrue(any("112" in n for n in numbers))
            self.assertTrue(any("108" in n for n in numbers))

            # Verify mandatory disclaimer
            self.assertIn("disclaimer", data)
            self.assertIn("does NOT replace official 112 / 108", data["disclaimer"])

    def test_cooling_centers_uncataloged_location_honest_unavailable(self):
        """Test GET /api/cooling-centers returns honest unavailable state with zero fabricated data."""
        res = self.client.get("/api/cooling-centers?city=NonExistentRemoteOutpost&lat=55.123&lon=44.123")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["coverage_status"], "unavailable")
        # Cooling centers and water points must be empty rather than fabricated
        self.assertEqual(len(data["cooling_centers"]), 0)
        self.assertEqual(len(data["water_points"]), 0)
        # National emergency helplines must still be provided
        self.assertGreater(len(data["emergency_contacts"]), 0)
        self.assertIn("No verified municipal cooling centers", data["message"])

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

    def test_smart_cooling_project_plan(self):
        """Test POST /api/smart-cooling-plan computes phased roadmap and separates data categories."""
        payload = {
            "city_id": "coimbatore",
            "baseline_temp": 33.2,
            "targets": {
                "tree_count": 4000,
                "cool_roof_sqm": 50000,
                "parks_hectares": 6.0,
                "shaded_bus_stops": 30,
                "permeable_pavement_sqm": 20000
            }
        }
        res = self.client.post("/api/smart-cooling-plan", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")

        # Verify strict separation between measured data, user assumptions, and proposed estimates
        self.assertIn("measured_ground_truth", data)
        self.assertIn("user_planning_assumptions", data)
        self.assertIn("proposed_simulation_estimates", data)

        # Verify 3 phased rollout phases
        phases = data["phased_implementation_roadmap"]
        self.assertEqual(len(phases), 3)
        self.assertIn("Phase 1", phases[0]["phase"])
        self.assertIn("Phase 2", phases[1]["phase"])
        self.assertIn("Phase 3", phases[2]["phase"])

        # Check budget values and caveat disclaimer
        self.assertGreater(data["total_budget_inr_raw"], 0)
        self.assertIn("₹", data["total_indicative_investment"])
        self.assertIn("BUDGET CAVEAT NOTICE", data["budget_caveat_disclaimer"])

    def test_heat_safety_challenge_data(self):
        """Test GET /api/heat-safety-quizzes returns evidence-based quizzes, myths/facts, and citations."""
        res = self.client.get("/api/heat-safety-quizzes")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")

        self.assertGreaterEqual(len(data["quizzes"]), 5)
        self.assertGreaterEqual(len(data["myths_and_facts"]), 5)
        self.assertGreaterEqual(len(data["scenario_challenges"]), 2)

        # Check authoritative sources are cited
        source_names = [s["name"] for s in data["authoritative_sources"]]
        self.assertTrue(any("WHO" in s or "World Health" in s for s in source_names))
        self.assertTrue(any("NDMA" in s for s in source_names))
        self.assertTrue(any("CDC" in s for s in source_names))

        # Check each quiz has a valid correct_index and explanation
        for q in data["quizzes"]:
            self.assertIn("question", q)
            self.assertIn("options", q)
            self.assertIn("correct_index", q)
            self.assertIn("explanation", q)
            self.assertIn("source", q)


if __name__ == "__main__":
    unittest.main()
