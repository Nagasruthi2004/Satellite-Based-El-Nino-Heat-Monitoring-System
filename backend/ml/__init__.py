"""
backend/ml/__init__.py
----------------------
Machine Learning and Deep Learning module for Satellite Image Thermal Analysis.
Contains CNN architecture specifications, training pipeline templates,
feature extractors, and safe inference interfaces.
"""

from .cnn_model import SatelliteCNNArchitecture, CNN_CLASSES, FEATURE_CHANNELS
from .train_cnn import SatelliteCNNTrainer, DatasetUnavailableError
from .inference import SatelliteCNNInference, extract_features_from_thermal_grid

__all__ = [
    "SatelliteCNNArchitecture",
    "CNN_CLASSES",
    "FEATURE_CHANNELS",
    "SatelliteCNNTrainer",
    "DatasetUnavailableError",
    "SatelliteCNNInference",
    "extract_features_from_thermal_grid",
]
