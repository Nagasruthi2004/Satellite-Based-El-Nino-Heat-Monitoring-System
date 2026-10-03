"""
2026 India Land Surface Temperature (LST) Prediction Module
Uses historical 2020-2025 India state observations to build an explainable
Linear Regression model predicting state-wise 2026 LST and heat risk tiers.
"""

import os
import logging
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

logger = logging.getLogger(__name__)

DATASET_FILENAME = "India_LST_Clean_Dataset_2020_2025.xlsx"
AVAILABLE_YEARS = [2020, 2021, 2022, 2023, 2024, 2025]
PREDICTION_YEAR = 2026


def classify_predicted_risk(lst_celsius: float) -> str:
    """
    Classify predicted LST into standardized heat risk tiers:
    - Low: < 28.0°C
    - Moderate: 28.0°C to < 32.0°C
    - High: 32.0°C to < 40.0°C
    - Critical: >= 40.0°C
    """
    if lst_celsius is None or np.isnan(lst_celsius):
        return "Unknown"
    if lst_celsius >= 40.0:
        return "Critical"
    if lst_celsius >= 32.0:
        return "High"
    if lst_celsius >= 28.0:
        return "Moderate"
    return "Low"


def load_historical_dataset():
    """Load the 2020-2025 India LST dataset."""
    dataset_dir = os.path.join(os.path.dirname(__file__), "..", "dataset")
    xlsx_path = os.path.join(dataset_dir, DATASET_FILENAME)

    if os.path.exists(xlsx_path):
        df = pd.read_excel(xlsx_path)
    else:
        dfs = []
        for yr in AVAILABLE_YEARS:
            cpath = os.path.join(dataset_dir, f"India_LST_{yr}.csv")
            if os.path.exists(cpath):
                dfs.append(pd.read_csv(cpath))
        if not dfs:
            logger.error("No India LST dataset files found in %s", dataset_dir)
            return None, ""
        df = pd.concat(dfs, ignore_index=True)

    lst_col = next((c for c in df.columns if "LST" in c or "Average" in c), "Average LST (°C)")
    return df, lst_col


def compute_state_prediction(state_name: str, sub_df: pd.DataFrame, lst_col: str) -> dict:
    """
    Train an explainable Linear Regression model on 2020-2025 observations for one state
    and predict the 2026 LST.
    """
    sorted_sub = sub_df.sort_values("Year")
    X = sorted_sub[["Year"]].values
    y = sorted_sub[lst_col].values

    model = LinearRegression()
    model.fit(X, y)

    # Predict for 2026
    pred_raw = float(model.predict([[PREDICTION_YEAR]])[0])
    pred_2026 = round(pred_raw, 2)
    slope = round(float(model.coef_[0]), 3)
    intercept = round(float(model.intercept_), 2)
    r2 = round(max(0.0, float(model.score(X, y))), 3)

    val_2025 = round(float(sorted_sub[sorted_sub["Year"] == 2025][lst_col].values[0]), 2)
    change_from_2025 = round(pred_2026 - val_2025, 2)
    hist_avg = round(float(sorted_sub[lst_col].mean()), 2)
    hist_min = round(float(sorted_sub[lst_col].min()), 2)
    hist_max = round(float(sorted_sub[lst_col].max()), 2)

    risk_tier = classify_predicted_risk(pred_2026)

    # Historical records array
    historical_records = []
    for _, row in sorted_sub.iterrows():
        historical_records.append({
            "year": int(row["Year"]),
            "lst_celsius": round(float(row[lst_col]), 2),
            "heat_risk": str(row["Heat Risk"]).strip()
        })

    # Trend description
    if slope > 0.05:
        trend_label = f"Warming (+{slope}°C/yr)"
    elif slope < -0.05:
        trend_label = f"Cooling ({slope}°C/yr)"
    else:
        trend_label = f"Stable ({slope:+.3f}°C/yr)"

    sign = "+" if change_from_2025 >= 0 else ""
    explanation = (
        f"Fitted linear trend across 2020–2025 ({trend_label}, R² = {r2}). "
        f"Compared to the 2025 observed level of {val_2025}°C, the model estimates a {sign}{change_from_2025}°C "
        f"shift to {pred_2026}°C in 2026, falling under the {risk_tier} heat-risk category."
    )

    return {
        "state": state_name,
        "historical_records": historical_records,
        "historical_average_lst": hist_avg,
        "historical_min_lst": hist_min,
        "historical_max_lst": hist_max,
        "observed_2025_lst": val_2025,
        "predicted_2026_lst": pred_2026,
        "change_from_2025": change_from_2025,
        "predicted_2026_risk": risk_tier,
        "slope": slope,
        "intercept": intercept,
        "r2_score": r2,
        "trend_label": trend_label,
        "explanation": explanation
    }


def get_all_2026_predictions():
    """
    Calculate 2026 predictions for all 34 Indian states/UTs,
    along with national summary, top hotspots, and risk distribution.
    """
    df, lst_col = load_historical_dataset()
    if df is None or df.empty:
        raise ValueError("Historical India LST dataset is unavailable.")

    states = sorted(df["State"].dropna().astype(str).unique().tolist())
    predictions = []

    for state in states:
        sub_df = df[df["State"] == state]
        pred_obj = compute_state_prediction(state, sub_df, lst_col)
        predictions.append(pred_obj)

    # Sort descending by predicted 2026 LST
    predictions.sort(key=lambda x: x["predicted_2026_lst"], reverse=True)

    # Calculate national metrics
    pred_values = [p["predicted_2026_lst"] for p in predictions]
    national_avg = round(float(np.mean(pred_values)), 2)
    highest_pred = predictions[0]
    lowest_pred = predictions[-1]

    # Risk counts
    risk_dist = {"Low": 0, "Moderate": 0, "High": 0, "Critical": 0}
    for p in predictions:
        r = p["predicted_2026_risk"]
        if r in risk_dist:
            risk_dist[r] += 1

    high_or_critical_count = risk_dist["High"] + risk_dist["Critical"]

    top_10_hotspots = [
        {
            "rank": idx + 1,
            "state": p["state"],
            "predicted_2026_lst": p["predicted_2026_lst"],
            "observed_2025_lst": p["observed_2025_lst"],
            "change_from_2025": p["change_from_2025"],
            "predicted_2026_risk": p["predicted_2026_risk"]
        }
        for idx, p in enumerate(predictions[:10])
    ]

    return {
        "status": "success",
        "prediction_year": PREDICTION_YEAR,
        "total_states": len(predictions),
        "summary": {
            "predicted_national_average_lst": national_avg,
            "highest_predicted": {
                "state": highest_pred["state"],
                "predicted_2026_lst": highest_pred["predicted_2026_lst"],
                "predicted_2026_risk": highest_pred["predicted_2026_risk"]
            },
            "lowest_predicted": {
                "state": lowest_pred["state"],
                "predicted_2026_lst": lowest_pred["predicted_2026_lst"],
                "predicted_2026_risk": lowest_pred["predicted_2026_risk"]
            },
            "high_critical_count": high_or_critical_count,
            "risk_distribution": risk_dist
        },
        "top_10_hotspots": top_10_hotspots,
        "states": predictions,
        "model_info": {
            "model_name": "Explainable Ordinary Least Squares (OLS) Linear Regression",
            "training_period": "2020–2025 (6 annual observations per state)",
            "input_features": ["Year (annual progression index)"],
            "target_variable": "Land Surface Temperature (°C)",
            "classification_tiers": {
                "Low": "< 28.0°C",
                "Moderate": "28.0°C – 31.99°C",
                "High": "32.0°C – 39.99°C",
                "Critical": "≥ 40.0°C"
            },
            "disclosure": "Model: Regression-based prediction using 2020–2025 historical LST data. 2026 values are model estimates, not observed satellite measurements."
        },
        "limitations": [
            "Prediction is based solely on historical LST observations (2020–2025) available in the project dataset.",
            "Actual 2026 atmospheric weather and satellite observations may differ due to localized microclimates.",
            "Sub-seasonal drivers such as active El Niño/La Niña phases, sudden monsoon shifts, cloud cover, and wind anomalies are not simulated in this regression model.",
            "This prediction is an analytical model estimate and should not be interpreted as an official meteorological weather forecast."
        ]
    }
