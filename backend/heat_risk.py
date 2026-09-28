"""Shared current heat-risk classification for live weather data."""

import math


def classify_current_heat_risk(temperature, humidity, rainfall, wind_speed):
    """Return the current risk level and score for one weather observation."""
    values = (temperature, humidity, rainfall, wind_speed)
    try:
        temperature, humidity, rainfall, wind_speed = (float(value) for value in values)
    except (TypeError, ValueError):
        return None

    if not all(math.isfinite(value) for value in (temperature, humidity, rainfall, wind_speed)):
        return None

    score = round(max(0.0, min(100.0, temperature / 45.0 * 100.0)), 1)
    if temperature < 30:
        level = "Low"
    elif temperature < 36:
        level = "Medium"
    else:
        level = "High"

    return {"level": level, "score": score}


def classify_forecast_heat_risk(forecast_data):
    """Classify one forecast record using that record's weather inputs."""
    return classify_current_heat_risk(
        temperature=forecast_data.get("temperature"),
        humidity=forecast_data.get("humidity"),
        rainfall=forecast_data.get("rainfall"),
        wind_speed=forecast_data.get("wind_speed"),
    )
