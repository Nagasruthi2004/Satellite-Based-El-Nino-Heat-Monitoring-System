"""
models/train_model.py
---------------------
Trains a Random Forest heat risk classifier and saves it to:
    models/heat_risk_model.pkl

Features : temperature, humidity, rainfall, wind_speed
Target   : heat_risk  (Low | Medium | High | Critical)
Dataset  : dataset/heat_risk_dataset.csv

Run from the project root:
    python models/train_model.py
"""

import os
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report


FEATURES = ["temperature", "humidity", "rainfall", "wind_speed"]
TARGET   = "heat_risk"

# Resolve dataset path relative to this file (models/../dataset/...)
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "heat_risk_dataset.csv")


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

def load_dataset():
    """Load features and target from dataset/heat_risk_dataset.csv."""
    df = pd.read_csv(DATASET_PATH)
    X = df[FEATURES].values.astype(np.float32)
    y = df[TARGET].values
    return X, y


# ---------------------------------------------------------------------------
# Train and save
# ---------------------------------------------------------------------------

def train():
    print("=" * 60)
    print("  Heat Risk Prediction — Model Training")
    print("=" * 60)

    X, y = load_dataset()
    print(f"\n  Dataset  : {X.shape[0]} samples, {X.shape[1]} features")
    print(f"  Source   : {os.path.normpath(DATASET_PATH)}")
    print(f"  Classes  : {np.unique(y).tolist()}")

    # Encode labels
    le = LabelEncoder()
    y_enc = le.fit_transform(y)
    print(f"  Encoding : {list(le.classes_)}")

    # Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    # Same hyperparameters as backend/heat_prediction.py
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Metrics
    train_acc = accuracy_score(y_train, model.predict(X_train))
    test_acc  = accuracy_score(y_test,  model.predict(X_test))
    print(f"\n  Train accuracy : {train_acc:.2%}")
    print(f"  Test  accuracy : {test_acc:.2%}")
    print("\n  Classification report (test set):")
    print(classification_report(
        y_test, model.predict(X_test), target_names=le.classes_
    ))

    # Save
    output_path = os.path.join(os.path.dirname(__file__), "heat_risk_model.pkl")
    joblib.dump({"model": model, "label_encoder": le}, output_path)
    print(f"  Saved -> {os.path.normpath(output_path)}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

def smoke_test():
    """Load the saved model and verify four representative predictions."""
    path = os.path.join(os.path.dirname(__file__), "heat_risk_model.pkl")
    bundle = joblib.load(path)
    model, le = bundle["model"], bundle["label_encoder"]

    cases = [
        ([25.0, 70.0, 50.0, 15.0], "Low"),
        ([33.0, 50.0, 12.0,  8.0], "Medium"),
        ([39.0, 35.0,  3.0,  3.0], "High"),
        ([44.0, 25.0,  0.0,  1.0], "Critical"),
    ]

    print("\n  Smoke test:")
    all_pass = True
    for features, expected in cases:
        pred = le.inverse_transform(model.predict([features]))[0]
        conf = round(float(np.max(model.predict_proba([features]))) * 100, 1)
        ok   = pred == expected
        if not ok:
            all_pass = False
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}]  {features}  ->  {pred} ({conf}%)  [expected {expected}]")

    print(f"\n  {'All tests passed.' if all_pass else 'Some tests failed.'}")


if __name__ == "__main__":
    train()
    smoke_test()
