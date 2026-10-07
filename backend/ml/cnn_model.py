"""
backend/ml/cnn_model.py
-----------------------
CNN Architecture definition and metadata specification for Satellite Thermal Analysis.
Defines the multi-channel spatial CNN pipeline for land surface heat classification:

    Satellite Image (Optical / GeoTIFF)
           ↓
    Image Preprocessing (Radiometric Calibration & Planck Inversion)
           ↓
    Thermal / Feature Extraction (LST, Local Mean, Local Std, Intensity, Coords)
           ↓
    CNN Feature Extraction (Conv2D -> BatchNorm -> ReLU -> MaxPool)
           ↓
    Heat Classification (Dense -> Softmax over 4 classes)
           ↓
    Hotspot Prediction (Spatial anomaly localization)
"""

import json
from typing import Dict, Any, List

CNN_CLASSES = ["Low", "Moderate", "High", "Critical"]

FEATURE_CHANNELS = [
    {
        "index": 0,
        "name": "lst",
        "description": "Calibrated Land Surface Temperature (Planck inversion in °C)",
        "unit": "°C",
        "expected_range": [-50.0, 70.0],
    },
    {
        "index": 1,
        "name": "local_mean_lst",
        "description": "3x3 spatial neighborhood moving window mean temperature",
        "unit": "°C",
        "expected_range": [-50.0, 70.0],
    },
    {
        "index": 2,
        "name": "local_std_lst",
        "description": "3x3 spatial neighborhood temperature standard deviation / gradient",
        "unit": "°C",
        "expected_range": [0.0, 40.0],
    },
    {
        "index": 3,
        "name": "thermal_intensity",
        "description": "Relative thermal radiance / normalized intensity in scene",
        "unit": "normalized [0, 1]",
        "expected_range": [0.0, 1.0],
    },
    {
        "index": 4,
        "name": "norm_x",
        "description": "Normalized horizontal raster coordinate (X / Width)",
        "unit": "normalized [0, 1]",
        "expected_range": [0.0, 1.0],
    },
    {
        "index": 5,
        "name": "norm_y",
        "description": "Normalized vertical raster coordinate (Y / Height)",
        "unit": "normalized [0, 1]",
        "expected_range": [0.0, 1.0],
    },
    {
        "index": 6,
        "name": "hotspot_class_index",
        "description": "Rule-based threshold category index (0=Low, 1=Mod, 2=High, 3=Crit)",
        "unit": "categorical [0, 3]",
        "expected_range": [0.0, 3.0],
    },
]


class SatelliteCNNArchitecture:
    """
    Blueprint and specification for the 2D Spatial Convolutional Neural Network
    designed for high-resolution satellite thermal raster analysis.
    """

    NAME = "SatelliteThermalCNN-v1"
    INPUT_CHANNELS = len(FEATURE_CHANNELS)  # 7 channels
    NUM_CLASSES = len(CNN_CLASSES)          # 4 classes

    @classmethod
    def get_architecture_summary(cls) -> Dict[str, Any]:
        """Returns the formal architectural layer topology and hyperparameters."""
        return {
            "model_name": cls.NAME,
            "pipeline": [
                "Satellite Image",
                "Image Preprocessing",
                "Thermal / Feature Extraction",
                "CNN Feature Extraction",
                "Heat Classification",
                "Hotspot Prediction",
            ],
            "input_spec": {
                "tensor_format": "BCHW or BxFeatures",
                "channels": cls.INPUT_CHANNELS,
                "feature_channels": FEATURE_CHANNELS,
                "receptive_field_patch": "32x32 pixels",
            },
            "layers": [
                {
                    "layer": 1,
                    "type": "Conv2D",
                    "in_channels": cls.INPUT_CHANNELS,
                    "out_channels": 32,
                    "kernel_size": "3x3",
                    "padding": "same",
                    "activation": "ReLU",
                    "batch_norm": True,
                },
                {
                    "layer": 2,
                    "type": "MaxPool2D",
                    "pool_size": "2x2",
                    "stride": 2,
                },
                {
                    "layer": 3,
                    "type": "Conv2D",
                    "in_channels": 32,
                    "out_channels": 64,
                    "kernel_size": "3x3",
                    "padding": "same",
                    "activation": "ReLU",
                    "batch_norm": True,
                },
                {
                    "layer": 4,
                    "type": "GlobalAveragePooling2D",
                    "description": "Spatial dimension collapse to 64-dim feature vector",
                },
                {
                    "layer": 5,
                    "type": "Dense",
                    "units": 32,
                    "activation": "ReLU",
                    "dropout": 0.25,
                },
                {
                    "layer": 6,
                    "type": "Dense",
                    "units": cls.NUM_CLASSES,
                    "activation": "Softmax",
                    "output_classes": CNN_CLASSES,
                },
            ],
            "hyperparameters": {
                "optimizer": "Adam",
                "learning_rate": 0.0001,
                "loss_function": "CategoricalCrossEntropy",
                "batch_size": 32,
                "weight_decay": 1e-5,
            },
            "output_spec": {
                "classes": CNN_CLASSES,
                "output_shape": f"(batch_size, {cls.NUM_CLASSES})",
                "interpretation": "Class probability distribution over Low, Moderate, High, Critical",
            },
        }

    @classmethod
    def validate_weights_manifest(cls, manifest: Dict[str, Any]) -> bool:
        """Validates that a weights file contains required architecture metadata."""
        if not isinstance(manifest, dict):
            return False
        required_keys = ["model_name", "weights", "num_classes", "input_channels"]
        return all(key in manifest for key in required_keys)
