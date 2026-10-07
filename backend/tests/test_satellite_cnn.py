"""
backend/tests/test_satellite_cnn.py
-----------------------------------
Unit tests for Module 5: ML / CNN Satellite Image Analysis.
Tests:
  - ML input validation (schema, NaN/Inf, coordinates)
  - Missing model handling ("CNN model not trained — inference unavailable.")
  - Missing dataset handling (refuses to train without verified ground-truth labels)
  - Inference unavailable state
  - Valid model loading behavior
  - Genuine thermal feature extraction integrity
"""

import os
import tempfile
import unittest
import numpy as np
import joblib

from ml.cnn_model import SatelliteCNNArchitecture, CNN_CLASSES, FEATURE_CHANNELS
from ml.train_cnn import SatelliteCNNTrainer, DatasetUnavailableError
from ml.inference import (
    SatelliteCNNInference,
    validate_ml_input,
    extract_features_from_thermal_grid,
    InvalidInputError,
)


class TestSatelliteCNN(unittest.TestCase):
    """Test suite covering scientific integrity and ML safety for Satellite CNN."""

    def setUp(self):
        self.non_existent_model = os.path.join(tempfile.gettempdir(), "non_existent_cnn_model.pkl")
        if os.path.exists(self.non_existent_model):
            os.remove(self.non_existent_model)
        self.inference_engine = SatelliteCNNInference(model_path=self.non_existent_model)

    def test_ml_input_validation_valid_grid(self):
        """Valid 2D temperature grid passes input validation."""
        valid_payload = {
            "temperature_grid": [
                [22.5, 23.1, 24.0],
                [25.0, 36.2, 43.1],
                [21.8, 22.9, 23.5],
            ]
        }
        is_valid, err = validate_ml_input(valid_payload)
        self.assertTrue(is_valid)
        self.assertIsNone(err)

    def test_ml_input_validation_valid_features(self):
        """Valid feature vector list passes input validation."""
        valid_payload = {
            "features": [
                {"lst": 38.5, "norm_x": 0.25, "norm_y": 0.5},
                {"lst": 44.1, "norm_x": 0.8, "norm_y": 0.9},
            ]
        }
        is_valid, err = validate_ml_input(valid_payload)
        self.assertTrue(is_valid)
        self.assertIsNone(err)

    def test_ml_input_validation_invalid_types_and_empty(self):
        """Non-dictionary or empty inputs are rejected."""
        self.assertFalse(validate_ml_input(None)[0])
        self.assertFalse(validate_ml_input("not-a-dict")[0])
        self.assertFalse(validate_ml_input({})[0])
        self.assertFalse(validate_ml_input({"temperature_grid": []})[0])
        self.assertFalse(validate_ml_input({"features": []})[0])

    def test_ml_input_validation_nan_and_inf(self):
        """NaN and Inf values are safely caught and rejected."""
        nan_payload = {
            "temperature_grid": [
                [25.0, float("nan")],
                [30.0, 35.0],
            ]
        }
        is_valid, err = validate_ml_input(nan_payload)
        self.assertFalse(is_valid)
        self.assertIn("NaN", err)

        inf_payload = {
            "features": [
                {"lst": float("inf"), "norm_x": 0.5, "norm_y": 0.5}
            ]
        }
        is_valid, err = validate_ml_input(inf_payload)
        self.assertFalse(is_valid)

    def test_ml_input_validation_coordinate_bounds(self):
        """Spatial normalized coordinates must strictly be in [0.0, 1.0]."""
        out_of_bounds_x = {
            "features": [
                {"lst": 30.0, "norm_x": 1.2, "norm_y": 0.5}
            ]
        }
        is_valid, err = validate_ml_input(out_of_bounds_x)
        self.assertFalse(is_valid)
        self.assertIn("normalized", err)

        out_of_bounds_y = {
            "features": [
                {"lst": 30.0, "norm_x": 0.5, "norm_y": -0.1}
            ]
        }
        is_valid, err = validate_ml_input(out_of_bounds_y)
        self.assertFalse(is_valid)

    def test_missing_model_handling(self):
        """Missing model cleanly returns 'CNN model not trained — inference unavailable'."""
        self.assertFalse(self.inference_engine.is_model_loaded)
        status = self.inference_engine.get_status(valid_thermal_pixels=1024, detected_hotspots_count=3)
        self.assertEqual(status["model_status"], "Not Trained")
        self.assertEqual(status["inference_status"], "Unavailable")
        self.assertEqual(status["message"], "CNN model not trained — inference unavailable.")
        self.assertEqual(
            status["evaluation_status"],
            "Evaluation unavailable — no validated trained model is currently available.",
        )
        self.assertEqual(status["valid_thermal_pixels"], 1024)
        self.assertEqual(status["detected_hotspots_count"], 3)

    def test_missing_dataset_handling(self):
        """Trainer strictly refuses to train when authentic labeled dataset is missing."""
        non_existent_dataset_dir = os.path.join(tempfile.gettempdir(), "non_existent_satellite_data")
        trainer = SatelliteCNNTrainer(dataset_dir=non_existent_dataset_dir)
        status = trainer.check_dataset_status()
        self.assertFalse(status["available"])

        # Attempting train() must raise DatasetUnavailableError and never invent synthetic labels
        with self.assertRaises(DatasetUnavailableError) as context:
            trainer.train()
        self.assertIn("Training unavailable", str(context.exception))

    def test_inference_unavailable_state(self):
        """Calling predict() when model is not trained returns safe unavailable state."""
        valid_payload = {
            "temperature_grid": [
                [25.0, 30.0],
                [35.0, 42.0],
            ]
        }
        response = self.inference_engine.predict(valid_payload)
        self.assertFalse(response["success"])
        self.assertEqual(response["status"], "unavailable")
        self.assertEqual(response["message"], "CNN model not trained — inference unavailable.")
        self.assertIsNone(response["predictions"])

    def test_valid_model_loading(self):
        """Demonstrates safe model loading when a valid model bundle exists."""
        temp_dir = tempfile.mkdtemp()
        dummy_model_file = os.path.join(temp_dir, "test_satellite_cnn.pkl")

        # Save a minimal valid bundle
        dummy_bundle = {
            "model": "MockCNNModelObject",
            "model_name": SatelliteCNNArchitecture.NAME,
            "classes": CNN_CLASSES,
        }
        joblib.dump(dummy_bundle, dummy_model_file)

        engine = SatelliteCNNInference(model_path=dummy_model_file)
        self.assertTrue(engine.is_model_loaded)
        status = engine.get_status()
        self.assertEqual(status["model_status"], "Trained")
        self.assertEqual(status["inference_status"], "Available")

        # Cleanup
        if os.path.exists(dummy_model_file):
            os.remove(dummy_model_file)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)

    def test_thermal_feature_extraction_integrity(self):
        """Verifies genuine 7-dimensional thermal feature extraction from calibrated 2D grid."""
        grid = [
            [20.0, 22.0, 24.0, 26.0],
            [25.0, 30.0, 36.0, 38.0],
            [27.0, 35.0, 43.0, 44.0],
            [22.0, 28.0, 34.0, 35.0],
        ]
        thresholds = {"lowMax": 25.0, "modMax": 35.0, "highMax": 42.0}
        extracted = extract_features_from_thermal_grid(grid, thresholds=thresholds, max_samples=100)

        self.assertGreater(extracted["sample_count"], 0)
        self.assertEqual(extracted["total_pixels"], 16)
        self.assertEqual(extracted["scene_stats"]["min_lst"], 20.0)
        self.assertEqual(extracted["scene_stats"]["max_lst"], 44.0)

        # Inspect first sample
        f0 = extracted["features"][0]
        self.assertIn("lst", f0)
        self.assertIn("local_mean_lst", f0)
        self.assertIn("local_std_lst", f0)
        self.assertIn("thermal_intensity", f0)
        self.assertIn("norm_x", f0)
        self.assertIn("norm_y", f0)
        self.assertIn("hotspot_class_index", f0)
        self.assertIn("rule_based_class", f0)

        # Verify coordinates normalized in [0, 1]
        self.assertGreaterEqual(f0["norm_x"], 0.0)
        self.assertLessEqual(f0["norm_x"], 1.0)
        self.assertGreaterEqual(f0["norm_y"], 0.0)
        self.assertLessEqual(f0["norm_y"], 1.0)

        # Verify critical pixel classification
        crit_samples = [f for f in extracted["features"] if f["lst"] >= 43.0]
        for cs in crit_samples:
            self.assertEqual(cs["rule_based_class"], "Critical")
            self.assertEqual(cs["hotspot_class_index"], 3)

    def test_flask_ml_status_route(self):
        """Tests the GET /api/satellite/ml-status endpoint."""
        from app import app
        client = app.test_client()
        resp = client.get("/api/satellite/ml-status?valid_pixels=500&hotspots_count=2")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("model_status", data)
        self.assertEqual(data["model_status"], "Not Trained")
        self.assertIn("CNN model not trained", data["message"])
        self.assertEqual(data["valid_thermal_pixels"], 500)
        self.assertEqual(data["detected_hotspots_count"], 2)

    def test_flask_ml_inference_route_unavailable(self):
        """Tests the POST /api/satellite/ml-inference endpoint returns unavailable when not trained."""
        from app import app
        client = app.test_client()
        resp = client.post(
            "/api/satellite/ml-inference",
            json={"features": [{"lst": 38.0, "norm_x": 0.5, "norm_y": 0.5}]},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertFalse(data["success"])
        self.assertEqual(data["status"], "unavailable")
        self.assertIn("CNN model not trained — inference unavailable.", data["message"])


if __name__ == "__main__":
    unittest.main()
