"""Shared current heat-risk classification for live weather data."""

import math


def classify_current_heat_risk(temperature, humidity, rainfall, wind_speed):
    """Return the current risk level and score for one weather observation."""
    values = (temperature, humidity, rainfall, wind_speed)
    parsed_values = []
    for val in values:
        if isinstance(val, (int, float)):
            parsed_values.append(float(val))
        elif isinstance(val, str):
            import re
            m = re.search(r"[-+]?\d*\.?\d+", val)
            if m:
                parsed_values.append(float(m.group(0)))
            else:
                return None
        else:
            return None

    temperature, humidity, rainfall, wind_speed = parsed_values

    if not all(math.isfinite(value) for value in (temperature, humidity, rainfall, wind_speed)):
        return None

    score = round(max(0.0, min(100.0, temperature / 45.0 * 100.0)), 1)
    # Requirement: If rainfall > 5mm, reduce heat risk score slightly, because rain reduces heat.
    if rainfall > 5.0:
        reduction = min(15.0, 5.0 + (rainfall - 5.0) * 0.5)
        score = round(max(0.0, score - reduction), 1)

    if score < 45 or temperature < 30:
        level = "Low"
    elif score < 65 or temperature < 36:
        level = "Medium"
    elif score < 85 or temperature < 40:
        level = "High"
    else:
        level = "Critical"

    return {"level": level, "score": score}


def classify_forecast_heat_risk(forecast_data):
    """Classify one forecast record using that record's weather inputs."""
    return classify_current_heat_risk(
        temperature=forecast_data.get("temperature"),
        humidity=forecast_data.get("humidity"),
        rainfall=forecast_data.get("rainfall"),
        wind_speed=forecast_data.get("wind_speed"),
    )
