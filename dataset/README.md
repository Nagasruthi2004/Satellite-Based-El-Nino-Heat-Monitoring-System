# Heat Risk Dataset

## Dataset Name
`heat_risk_dataset.csv`

## Number of Records
200 weather records

## Features

| Column | Type | Unit | Description |
|---|---|---|---|
| `temperature` | float | °C | Ambient air temperature |
| `humidity` | float | % | Relative humidity (0–100) |
| `rainfall` | float | mm | Rainfall amount |
| `wind_speed` | float | km/h | Wind speed |

## Target Column

| Column | Type | Values |
|---|---|---|
| `heat_risk` | string | `Low`, `Medium`, `High`, `Critical` |

### Label Distribution

| Label | Records | Temperature Range | Description |
|---|---|---|---|
| Low | 50 | 20.1 – 29.7°C | Cool conditions, high humidity, significant rainfall |
| Medium | 60 | 30.1 – 35.9°C | Warm conditions, moderate humidity, light rainfall |
| High | 50 | 36.0 – 40.8°C | Hot conditions, low humidity, minimal rainfall |
| Critical | 40 | 41.3 – 46.6°C | Extreme heat, very low humidity, near-zero rainfall |

## Purpose

This dataset is used to train and evaluate the Random Forest machine learning model in `models/train_model.py`.

The model learns the relationship between weather conditions (temperature, humidity, rainfall, wind speed) and heat risk level, and is saved as `models/heat_risk_model.pkl`.

The trained model powers the `/predict` API endpoint in `backend/app.py`, which the frontend uses to provide real-time heat risk predictions for the Satellite-Based El Niño Heat Monitoring System.
