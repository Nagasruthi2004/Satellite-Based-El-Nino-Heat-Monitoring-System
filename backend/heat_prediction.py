"""
Heat Risk Prediction module - Machine Learning model for heat risk classification
Uses Random Forest algorithm to predict heat risk levels
Training data loaded from dataset/heat_risk_dataset.csv
"""

import os
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

FEATURES   = ["temperature", "humidity", "rainfall", "wind_speed"]
TARGET     = "heat_risk"
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "heat_risk_dataset.csv")
MODEL_PATH   = os.path.join(os.path.dirname(__file__), "..", "models", "heat_risk_model.pkl")


class HeatRiskPredictor:
    """Machine Learning model for predicting heat risk levels"""

    
    def __init__(self):
        """Initialize the model and label encoder"""
        self.model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
        self.label_encoder = LabelEncoder()
        self.is_trained = False

    def load_model(self):
        """Load trained model from models/heat_risk_model.pkl."""
        bundle = joblib.load(MODEL_PATH)
        self.model = bundle["model"]
        self.label_encoder = bundle["label_encoder"]
        self.is_trained = True
        print("✅ Model loaded from", os.path.normpath(MODEL_PATH))

    def save_model(self):
        """Save trained model to models/heat_risk_model.pkl."""
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump({"model": self.model, "label_encoder": self.label_encoder}, MODEL_PATH)
        print("💾 Model saved to", os.path.normpath(MODEL_PATH))
        
    def load_dataset(self):
        """Load features and target from dataset/heat_risk_dataset.csv."""
        df = pd.read_csv(DATASET_PATH)
        X = df[FEATURES].values.astype(np.float32)
        y = df[TARGET].values
        return X, y

    def train(self):
        """
        Train the Random Forest model using dataset/heat_risk_dataset.csv
        """
        print("📊 Training Heat Risk Prediction Model...")

        # Load dataset from CSV
        X_train, y_train = self.load_dataset()

        # Encode labels (Critical=0, High=1, Low=2, Medium=3)
        y_encoded = self.label_encoder.fit_transform(y_train)

        # Train the model
        self.model.fit(X_train, y_encoded)
        self.is_trained = True

        # Display training metrics
        y_pred = self.model.predict(X_train)
        accuracy = accuracy_score(y_encoded, y_pred)
        print(f"✅ Model Trained! Accuracy: {accuracy:.2%}")

        return accuracy
    
    def predict_heat_risk(self, temperature, humidity, rainfall, wind_speed):
        """
        Predict heat risk level for given weather parameters
        
        Args:
            temperature (float): Temperature in Celsius
            humidity (float): Humidity percentage (0-100)
            rainfall (float): Rainfall in mm
            wind_speed (float): Wind speed in km/h
        
        Returns:
            str: Predicted heat risk level (Low, Medium, High, Critical)
        """
        if not self.is_trained:
            print("⚠️ Model not ready. Initializing...")
            initialize_model()
        
        # Prepare features for prediction
        features = np.array([[temperature, humidity, rainfall, wind_speed]])
        
        # Make prediction
        prediction_encoded = self.model.predict(features)[0]
        prediction = self.label_encoder.inverse_transform([prediction_encoded])[0]
        
        # Get prediction probability
        probabilities = self.model.predict_proba(features)[0]
        confidence = np.max(probabilities) * 100
        
        return {
            "predicted_risk": prediction,
            "confidence": confidence,
            "input_params": {
                "temperature": temperature,
                "humidity": humidity,
                "rainfall": rainfall,
                "wind_speed": wind_speed
            }
        }
    
    def predict_batch(self, weather_data_list):
        """
        Predict heat risk for multiple weather records
        
        Args:
            weather_data_list (list): List of dicts with weather parameters
        
        Returns:
            list: List of predictions
        """
        predictions = []
        for weather_data in weather_data_list:
            pred = self.predict_heat_risk(
                temperature=weather_data.get("temperature"),
                humidity=weather_data.get("humidity"),
                rainfall=weather_data.get("rainfall"),
                wind_speed=weather_data.get("wind_speed")
            )
            predictions.append(pred)
        
        return predictions
    
    def get_model_info(self):
        """Get information about the trained model"""
        if not self.is_trained:
            return {"status": "Model not trained yet"}
        
        return {
            "algorithm": "Random Forest",
            "n_estimators": self.model.n_estimators,
            "max_depth": self.model.max_depth,
            "is_trained": self.is_trained,
            "classes": list(self.label_encoder.classes_),
            "feature_names": ["Temperature (°C)", "Humidity (%)", "Rainfall (mm)", "Wind Speed (km/h)"]
        }


# Global predictor instance
heat_predictor = HeatRiskPredictor()


def initialize_model():
    """Load model from disk if available, otherwise train and save it."""
    global heat_predictor
    if not heat_predictor.is_trained:
        if os.path.exists(MODEL_PATH):
            heat_predictor.load_model()
        else:
            print("⚠️ Model file not found. Training a new model...")
            heat_predictor.train()
            heat_predictor.save_model()


def predict_heat_risk(temperature, humidity, rainfall, wind_speed):
    """
    Predict heat risk for given parameters
    
    Args:
        temperature (float): Temperature in Celsius
        humidity (float): Humidity percentage
        rainfall (float): Rainfall in mm
        wind_speed (float): Wind speed in km/h
    
    Returns:
        dict: Prediction result with risk level and confidence
    """
    initialize_model()
    return heat_predictor.predict_heat_risk(temperature, humidity, rainfall, wind_speed)


def get_prediction_explanation(prediction_result):
    """
    Get human-readable explanation of prediction
    
    Args:
        prediction_result (dict): Result from predict_heat_risk()
    
    Returns:
        str: Explanation text
    """
    risk_level = prediction_result["predicted_risk"]
    confidence = prediction_result["confidence"]
    
    explanations = {
        "Low": f"Low heat risk predicted with {confidence:.1f}% confidence. Conditions are favorable.",
        "Medium": f"Medium heat risk predicted with {confidence:.1f}% confidence. Monitor conditions.",
        "High": f"High heat risk predicted with {confidence:.1f}% confidence. Take precautions.",
        "Critical": f"Critical heat risk predicted with {confidence:.1f}% confidence. Immediate action required."
    }
    
    return explanations.get(risk_level, "Unknown prediction result")


# Main execution for testing
if __name__ == "__main__":
    print("\n" + "="*70)
    print("HEAT RISK PREDICTION MODEL")
    print("="*70)
    
    # Initialize predictor
    predictor = HeatRiskPredictor()
    
    # Train model
    print("\n1️⃣ Training Model:")
    accuracy = predictor.train()
    
    # Display model info
    print("\n2️⃣ Model Information:")
    model_info = predictor.get_model_info()
    print(f"   Algorithm: {model_info['algorithm']}")
    print(f"   Estimators: {model_info['n_estimators']}")
    print(f"   Classes: {model_info['classes']}")
    
    # Test predictions
    print("\n3️⃣ Sample Predictions:")
    
    test_cases = [
        {"temp": 25, "humidity": 70, "rainfall": 50, "wind": 15, "desc": "Cool with rain"},
        {"temp": 32, "humidity": 50, "rainfall": 15, "wind": 8, "desc": "Moderate heat"},
        {"temp": 40, "humidity": 35, "rainfall": 2, "wind": 3, "desc": "High heat (dry)"},
        {"temp": 45, "humidity": 30, "rainfall": 0, "wind": 1, "desc": "Extreme heat (critical)"},
    ]
    
    for case in test_cases:
        result = predictor.predict_heat_risk(
            temperature=case["temp"],
            humidity=case["humidity"],
            rainfall=case["rainfall"],
            wind_speed=case["wind"]
        )
        explanation = get_prediction_explanation(result)
        print(f"\n   📍 {case['desc']}")
        print(f"      Prediction: {result['predicted_risk']} ({result['confidence']:.1f}% confidence)")
        print(f"      {explanation}")
    
    print("\n" + "="*70 + "\n")
