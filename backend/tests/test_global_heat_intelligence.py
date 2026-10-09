import os
import sys
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app
import global_heat_intelligence as ghi


class GlobalHeatIntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_enso_global_intelligence_route_success(self):
        """Test GET /api/enso-global-intelligence returns official ENSO data and structure."""
        res = self.client.get("/api/enso-global-intelligence")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("advisory_status", data)
        self.assertIn("oni", data)
        self.assertIn("roni", data)
        self.assertIn("latest_season", data)
        self.assertIn("published_date", data)
        self.assertIn("official_sources", data)
        self.assertGreater(len(data["official_sources"]), 0)

        # Check official source URLs
        urls = [s["url"] for s in data["official_sources"]]
        self.assertTrue(any("noaa.gov" in u for u in urls))

    def test_enso_pacific_sst_regions(self):
        """Test Pacific SST anomaly regions include Niño 1+2, Niño 3, Niño 3.4, and Niño 4 with projection-safe bounds."""
        res = self.client.get("/api/enso-global-intelligence")
        data = res.get_json()
        sst_regions = data.get("pacific_sst_regions", [])
        self.assertEqual(len(sst_regions), 4)

        region_ids = [r["id"] for r in sst_regions]
        self.assertIn("nino12", region_ids)
        self.assertIn("nino3", region_ids)
        self.assertIn("nino34", region_ids)
        self.assertIn("nino4", region_ids)

        for r in sst_regions:
            self.assertIn("bounds", r)
            self.assertIn("bounds_segments", r)
            self.assertIn("center", r)
            self.assertIn("baseline_sst", r)
            self.assertIn("sst_anomaly", r)
            self.assertIn("mechanism", r)
            self.assertIn("color", r)
            self.assertIn("fill_color", r)

            # Ensure all segments are projection-safe: south <= north, west <= east
            # and no single segment spans > 180° longitude (prevents 310° band across globe)
            for seg in r["bounds_segments"]:
                self.assertEqual(len(seg), 2)
                south, west = seg[0]
                north, east = seg[1]
                self.assertLessEqual(south, north, f"South {south} must be <= North {north}")
                self.assertLessEqual(west, east, f"West {west} must be <= East {east}")
                lon_span = east - west
                self.assertLessEqual(lon_span, 180.0, f"Segment span {lon_span}° must be <= 180° to avoid worldwide banding")

        # Specific check: Niño 4 must cross the antimeridian and decompose into 2 segments
        nino4 = next(r for r in sst_regions if r["id"] == "nino4")
        self.assertTrue(nino4.get("crosses_antimeridian"))
        self.assertEqual(len(nino4["bounds_segments"]), 2)
        # Segment 1: 160E to 180
        self.assertEqual(nino4["bounds_segments"][0], [[-5.0, 160.0], [5.0, 180.0]])
        # Segment 2: -180 to -150W
        self.assertEqual(nino4["bounds_segments"][1], [[-5.0, -180.0], [5.0, -150.0]])

    def test_overlay_bounds_validation_utility(self):
        """Test validate_overlay_bounds validates coordinates and decomposes antimeridian-crossing bounds."""
        from global_heat_intelligence import validate_overlay_bounds

        # 1. Standard valid box (Niño 3)
        res3 = validate_overlay_bounds([[-5.0, -150.0], [5.0, -90.0]])
        self.assertTrue(res3["is_valid"])
        self.assertFalse(res3["crosses_antimeridian"])
        self.assertEqual(len(res3["safe_segments"]), 1)
        self.assertEqual(res3["safe_segments"][0], [[-5.0, -150.0], [5.0, -90.0]])

        # 2. Antimeridian crossing box (160E to 150W)
        res4 = validate_overlay_bounds([[-5.0, 160.0], [5.0, -150.0]])
        self.assertTrue(res4["is_valid"])
        self.assertTrue(res4["crosses_antimeridian"])
        self.assertEqual(len(res4["safe_segments"]), 2)
        self.assertEqual(res4["safe_segments"][0], [[-5.0, 160.0], [5.0, 180.0]])
        self.assertEqual(res4["safe_segments"][1], [[-5.0, -180.0], [5.0, -150.0]])

        # 3. Invalid latitudes (out of [-90, 90])
        res_bad_lat = validate_overlay_bounds([[-95.0, -120.0], [5.0, -90.0]])
        self.assertFalse(res_bad_lat["is_valid"])
        self.assertIn("Latitude out of bounds", res_bad_lat["error"])

        # 4. Invalid longitudes (out of [-180, 180])
        res_bad_lon = validate_overlay_bounds([[-5.0, -200.0], [5.0, -90.0]])
        self.assertFalse(res_bad_lon["is_valid"])
        self.assertIn("Longitude out of bounds", res_bad_lon["error"])

        # 5. Malformed inputs
        self.assertFalse(validate_overlay_bounds(None)["is_valid"])
        self.assertFalse(validate_overlay_bounds([])["is_valid"])
        self.assertFalse(validate_overlay_bounds(["bad", "data"])["is_valid"])

    def test_enso_global_teleconnection_regions(self):
        """Test global teleconnection regions provide climate impacts and indicators."""
        res = self.client.get("/api/enso-global-intelligence")
        data = res.get_json()
        tele_regions = data.get("teleconnection_regions", [])
        self.assertGreater(len(tele_regions), 5)

        country_names = [r["country"] for r in tele_regions]
        self.assertTrue(any("India" in c for c in country_names))
        self.assertTrue(any("Australia" in c for c in country_names))

        for r in tele_regions:
            self.assertIn("climate_impact", r)
            self.assertIn("heatwave_vulnerability", r)
            self.assertIn("primary_risk_season", r)
            self.assertIn("indicators", r)

    def test_enso_live_unreachable_state(self):
        """Test clear unavailable state (503) when live_only=true and source cannot be reached."""
        with patch("global_heat_intelligence.fetch_noaa_cpc_enso_status") as mock_fetch:
            mock_fetch.return_value = {
                "status": "unavailable",
                "is_live": False,
                "error": "Official NOAA CPC data source is currently unreachable from this network environment.",
                "official_sources": [
                    {"name": "NOAA CPC", "url": "https://www.cpc.ncep.noaa.gov"}
                ]
            }
            res = self.client.get("/api/enso-global-intelligence?live_only=true")
            self.assertEqual(res.status_code, 503)
            data = res.get_json()
            self.assertEqual(data["status"], "unavailable")
            self.assertIn("unreachable", data["error"])

    def test_historical_heat_comparison_events(self):
        """Test GET /api/historical-heat-comparison handles 2015-16, 2023-24, and current."""
        for event in ["2015-2016", "2023-2024", "current"]:
            res = self.client.get(f"/api/historical-heat-comparison?event={event}")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["selected_event"]["event_id"], event)
            self.assertIn("comparison_matrix", data)
            self.assertEqual(len(data["comparison_matrix"]), 3)

    def test_distinguish_observed_vs_model_estimated(self):
        """Test observed satellite measurements are distinguished from model-estimated values."""
        res = self.client.get("/api/historical-heat-comparison?event=2023-2024")
        data = res.get_json()
        stations = data.get("map_stations", [])
        self.assertGreater(len(stations), 10)

        observed = [s for s in stations if s["measurement_type"] == "observed_satellite"]
        model_est = [s for s in stations if s["measurement_type"] == "model_estimated"]
        no_data = [s for s in stations if s["measurement_type"] == "no_data"]

        self.assertGreater(len(observed), 0)
        self.assertGreater(len(model_est), 0)
        self.assertGreater(len(no_data), 0)

        # Check observed stations have real MODIS instrument attribution
        for obs in observed:
            self.assertTrue(obs["is_observed"])
            self.assertIn("MODIS", obs["source_instrument"])
            self.assertIsNotNone(obs["lst_celsius"])

        # Check model estimated stations are clearly labeled and not fabricated as direct satellite
        for est in model_est:
            self.assertFalse(est["is_observed"])
            self.assertIn("Reanalysis", est["source_instrument"])
            self.assertIn("Reanalysis", est["coverage_tier"])

        # Check no_data points do NOT fabricate numbers
        for nd in no_data:
            self.assertIsNone(nd["lst_celsius"])
            self.assertIn("Unavailable", nd["coverage_tier"])

    def test_heat_mitigation_cities_route(self):
        """Test GET /api/heat-mitigation-cities returns supported cities."""
        res = self.client.get("/api/heat-mitigation-cities")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertGreater(data["count"], 3)
        city_names = [c["name"] for c in data["cities"]]
        self.assertIn("Coimbatore", city_names)
        self.assertIn("Chennai", city_names)

    def test_heat_mitigation_simulation_route(self):
        """Test POST /api/heat-mitigation-simulate calculates cooling and states assumptions."""
        payload = {
            "baseline_temp": 35.5,
            "location_name": "Coimbatore",
            "factors": {
                "tree_cover": 55,
                "green_cover": 45,
                "water_bodies": 20,
                "building_density": 35,
                "roads_pavement": 30,
            }
        }
        res = self.client.post("/api/heat-mitigation-simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")

        # More trees/green/water and fewer buildings should reduce temperature
        self.assertLess(data["simulated"]["temperature_celsius"], data["baseline"]["temperature_celsius"])
        self.assertLess(data["simulated"]["temperature_delta_celsius"], 0)

        # Verify explicit assumptions note and lack of claimed formal scientific validation
        self.assertFalse(data["is_validated_scientific_model"])
        self.assertIn("Illustrative", data["methodology_label"])
        self.assertIn("assumptions_note", data)
        self.assertIn("energy balance", data["assumptions_note"].lower())

    def test_heat_mitigation_simulation_factor_bounds(self):
        """Test simulation bounds factor inputs and extreme temperatures safely."""
        payload = {
            "baseline_temp": 42.0,
            "factors": {
                "tree_cover": 200,  # Should clamp to 100
                "building_density": -50,  # Should clamp to 0
            }
        }
        res = self.client.post("/api/heat-mitigation-simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["factors_input"]["tree_cover"], 100.0)
        self.assertEqual(data["factors_input"]["building_density"], 0.0)
        self.assertGreater(data["simulated"]["temperature_celsius"], 25.0)

    def test_heat_vulnerability_data_endpoint(self):
        """Test GET /api/heat-vulnerability-data returns multi-dimensional indicators and disclaimers."""
        res = self.client.get("/api/heat-vulnerability-data")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertGreater(data["station_count"], 10)
        self.assertIn("health_vulnerability_disclaimer", data)
        # Verify explicit instruction: do not infer health vulnerability from temperature alone
        self.assertIn("CANNOT be inferred from temperature alone", data["health_vulnerability_disclaimer"])

        stations = data["stations"]
        delhi = next((s for s in stations if s["id"] == "delhi"), None)
        self.assertIsNotNone(delhi)
        self.assertEqual(delhi["measurement_types"]["lst_source"], "observed_satellite")
        self.assertIsNotNone(delhi["lst_celsius"])
        self.assertIsNotNone(delhi["ndvi_index"])
        self.assertIsNotNone(delhi["heat_index_celsius"])
        self.assertIn("MODIS", delhi["source_labels"]["lst"])

        # Check unavailable data handling
        polar = next((s for s in stations if s["id"] == "antarctica_plateau"), None)
        self.assertIsNotNone(polar)
        self.assertIsNone(polar["lst_celsius"])
        self.assertIsNone(polar["ndvi_index"])
        self.assertEqual(polar["measurement_types"]["lst_source"], "unavailable")

    def test_cooling_priority_zones_ranking(self):
        """Test GET /api/cooling-priority-zones ranks zones with transparent math and no invented data."""
        res = self.client.get("/api/cooling-priority-zones")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        zones = data["zones"]
        self.assertGreater(len(zones), 5)

        # Check ranks are sequential and sorted descending by priority_score
        scores = [z["priority_score"] for z in zones]
        self.assertEqual(scores, sorted(scores, reverse=True))

        for idx, z in enumerate(zones, start=1):
            self.assertEqual(z["rank"], idx)
            self.assertGreaterEqual(z["priority_score"], 0.0)
            self.assertLessEqual(z["priority_score"], 100.0)
            self.assertIn("contributing_factors", z)
            self.assertIn("primary_reason", z)
            self.assertIn(z["priority_tier"], ["Urgent Priority", "High Priority", "Moderate Priority", "Low Priority"])
            # Verify no invented population counts or health predictions
            self.assertIsNone(z["population_count"])
            self.assertIn("Not Available", z["population_indicator"])

        self.assertIn("Planning-Priority Estimate", data["methodology_label"])
        self.assertIn("planning_disclaimer", data)

    def test_heat_reduction_actions_endpoint(self):
        """Test GET /api/heat-reduction-actions returns mitigation options with empirical mechanisms."""
        res = self.client.get("/api/heat-reduction-actions")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        interventions = data["interventions"]
        self.assertGreaterEqual(len(interventions), 5)

        intervention_ids = [i["id"] for i in interventions]
        self.assertIn("tree_canopy", intervention_ids)
        self.assertIn("cool_roofs", intervention_ids)
        self.assertIn("green_spaces", intervention_ids)
        self.assertIn("cool_pavements", intervention_ids)
        self.assertIn("water_bodies", intervention_ids)

        for item in interventions:
            self.assertIn("mechanism", item)
            self.assertIn("estimated_lst_impact", item)
            self.assertIn("co_benefits", item)

        self.assertIn("assumptions_disclaimer", data)
        self.assertIn("illustrative", data["assumptions_disclaimer"].lower())


if __name__ == "__main__":
    unittest.main()

