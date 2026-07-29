"""
models/train_model.py
---------------------
Trains a Random Forest heat risk classifier and saves it to:
    models/heat_risk_model.pkl

Features : [temperature (C), humidity (%), rainfall (mm), wind_speed (km/h)]
Labels   : Low | Medium | High | Critical

Run from the models/ folder:
    python train_model.py

Or from the project root:
    python models/train_model.py
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

def build_dataset():
    """
    200-sample synthetic dataset.
    Mirrors the label boundaries used in backend/heat_prediction.py.
    """
    rng = np.random.default_rng(42)
    rows, labels = [], []

    # Low risk (50 samples): cool, humid, rainy
    for _ in range(50):
        rows.append([
            rng.uniform(20, 29.9),
            rng.uniform(55, 85),
            rng.uniform(20, 80),
            rng.uniform(8, 20),
        ])
        labels.append("Low")

    # Medium risk (60 samples): warm, moderate humidity
    for _ in range(60):
        rows.append([
            rng.uniform(30, 35.9),
            rng.uniform(40, 60),
            rng.uniform(5, 25),
            rng.uniform(4, 12),
        ])
        labels.append("Medium")

    # High risk (50 samples): hot, low humidity, little rain
    for _ in range(50):
        rows.append([
            rng.uniform(36, 40.9),
            rng.uniform(25, 45),
            rng.uniform(0, 8),
            rng.uniform(1, 6),
        ])
        labels.append("High")

    # Critical risk (40 samples): extreme heat, very dry
    for _ in range(40):
        rows.append([
            rng.uniform(41, 48),
            rng.uniform(10, 34),
            rng.uniform(0, 4),
            rng.uniform(0, 3),
        ])
        labels.append("Critical")

    return np.array(rows, dtype=np.float32), np.array(labels)


# ---------------------------------------------------------------------------
# Train and save
# ---------------------------------------------------------------------------

def train():
    print("=" * 60)
    print("  Heat Risk Prediction — Model Training")
    print("=" * 60)

    X, y = build_dataset()
    print(f"\n  Dataset  : {X.shape[0]} samples, {X.shape[1]} features")
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

    # Save — resolve path relative to this file so it works from any cwd
    output_path = os.path.join(os.path.dirname(__file__), "heat_risk_model.pkl")
    joblib.dump({"model": model, "label_encoder": le}, output_path)
    print(f"  Saved -> {output_path}")
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
