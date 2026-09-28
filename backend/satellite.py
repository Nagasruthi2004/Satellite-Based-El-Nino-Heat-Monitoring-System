"""
Satellite module - processes satellite-based heat data
Handles Land Surface Temperature (LST) and thermal imaging data
Ready for Landsat and MODIS API integration
"""

from datetime import datetime, timezone
import hashlib


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _severity_from_heat_risk(heat_risk):
    """Use the weather model's risk label as the single heat severity source."""
    risk = str(heat_risk or "").strip().lower()
    if "critical" in risk or "extreme" in risk:
        return "Extreme"
    if "high" in risk:
        return "High"
    if "medium" in risk:
        return "Medium"
    if "low" in risk:
        return "Low"
    return None


def _generate_simulated_satellite_metrics(location, temperature=None, humidity=None,
                                          rainfall=None, wind_speed=None, heat_risk=None):
    """Generate deterministic, environment-driven simulated surface metrics.

    This is not a real satellite observation. The same location and weather inputs
    always produce the same values, which keeps the simulation reproducible.
    """
    location_key = str(location).strip().lower() or "coimbatore"
    seed = hashlib.sha256(location_key.encode("utf-8")).hexdigest()

    latitude = round(11.0 + (int(seed[0:2], 16) / 255.0) * 0.03, 4)
    longitude = round(76.9 + (int(seed[2:4], 16) / 255.0) * 0.03, 4)
    air_temperature = _to_float(temperature)
    humidity_value = _to_float(humidity)
    rainfall_value = _to_float(rainfall)
    wind_value = _to_float(wind_speed)

    # Use deterministic location factors only as surface-characteristics inputs;
    # current weather supplies the temperature-dependent part of the model.
    surface_factor = (int(seed[4:6], 16) / 255.0) * 3.0
    baseline_surface = 26.0 + (int(seed[6:8], 16) / 255.0) * 5.0
    air_temperature = air_temperature if air_temperature is not None else baseline_surface
    humidity_value = humidity_value if humidity_value is not None else 50.0
    rainfall_value = rainfall_value if rainfall_value is not None else 0.0
    wind_value = wind_value if wind_value is not None else 3.0

    humidity_cooling = max(humidity_value - 50.0, 0.0) * 0.025
    rainfall_cooling = min(max(rainfall_value, 0.0) * 0.15, 3.0)
    wind_cooling = min(max(wind_value, 0.0) * 0.12, 2.0)
    raw_lst = air_temperature + 2.0 + surface_factor - humidity_cooling - rainfall_cooling - wind_cooling
    # Keep the simulated surface temperature within a plausible local-air range.
    lst = round(min(max(raw_lst, air_temperature - 3.0), air_temperature + 9.0), 2)
    ndvi = round(min(max(0.25 + (humidity_value / 100.0) * 0.45 - rainfall_value * 0.005, 0.15), 0.85), 2)

    heat_intensity_level = _severity_from_heat_risk(heat_risk) or calculate_heat_intensity(lst)
    anomaly_delta = lst - baseline_surface
    if anomaly_delta >= 8.0:
        thermal_anomaly = "Extreme Anomaly"
    elif anomaly_delta >= 5.0:
        thermal_anomaly = "High Anomaly"
    elif anomaly_delta >= 2.0:
        thermal_anomaly = "Moderate Anomaly"
    else:
        thermal_anomaly = "Normal"
    heat_zone = heat_intensity_level

    if ndvi >= 0.70:
        vegetation_status = "Dense"
    elif ndvi >= 0.45:
        vegetation_status = "Moderate"
    else:
        vegetation_status = "Sparse"

    return {
        "latitude": latitude,
        "longitude": longitude,
        "land_surface_temperature": lst,
        "heat_intensity_level": heat_intensity_level,
        "thermal_anomaly": thermal_anomaly,
        "ndvi_index": ndvi,
        "vegetation_status": vegetation_status,
        "heat_zone": heat_zone,
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }


def get_satellite_data(location="Coimbatore", temperature=None, humidity=None,
                       rainfall=None, wind_speed=None, heat_risk=None):
    """
    Fetch satellite-based heat information for a given location
    
    Args:
        location (str): Location name (default: "Coimbatore")
    
    Returns:
        dict: Satellite data containing LST, heat intensity, and location info
    """
    metrics = _generate_simulated_satellite_metrics(
        location, temperature, humidity, rainfall, wind_speed, heat_risk
    )

    satellite_info = {
        "location": location,
        "latitude": metrics["latitude"],
        "longitude": metrics["longitude"],
        "land_surface_temperature": metrics["land_surface_temperature"],
        "heat_intensity_level": metrics["heat_intensity_level"],
        "thermal_anomaly": metrics["thermal_anomaly"],
        "ndvi_index": metrics["ndvi_index"],
        "vegetation_status": metrics["vegetation_status"],
        "heat_zone": metrics["heat_zone"],
        "last_updated": metrics["last_updated"],
        "satellite_source": "Deterministic simulated environmental model (not satellite observation)"
    }
    
    return satellite_info


def get_regional_satellite_data(region_name="Tamil Nadu"):
    """
    Fetch satellite data for a larger region
    
    Args:
        region_name (str): Region name (default: "Tamil Nadu")
    
    Returns:
        dict: Regional satellite data with heat mapping
    """
    region_key = str(region_name).strip().lower() or "tamil nadu"
    seed = hashlib.sha256(f"{region_key}:{datetime.now(timezone.utc).strftime('%Y-%m-%d %H')}".encode("utf-8")).hexdigest()

    average_lst = round(38.0 + (int(seed[0:2], 16) / 255.0) * 7.0, 2)
    hotspot_count = 8 + (int(seed[2:4], 16) % 6)
    max_temperature = round(average_lst + 4.0 + (int(seed[4:6], 16) % 5), 2)
    min_temperature = round(max(average_lst - 6.0, 30.0), 2)
    thermal_trend = "Increasing" if average_lst > 40.0 else "Stable"
    data_quality = "Good" if hotspot_count < 15 else "Moderate"

    regional_data = {
        "region": region_name,
        "average_lst": average_lst,
        "hotspot_count": hotspot_count,
        "max_temperature": max_temperature,
        "min_temperature": min_temperature,
        "heat_affected_areas": ["Coimbatore", "Salem", "Erode"],
        "thermal_trend": thermal_trend,
        "data_quality": data_quality
    }
    
    return regional_data


def calculate_heat_intensity(lst_value):
    """
    Calculate heat intensity level based on LST value
    
    Args:
        lst_value (float): Land Surface Temperature in Celsius
    
    Returns:
        str: Heat intensity level (Low, Medium, High, Extreme)
    """
    if lst_value < 30:
        return "Low"
    elif 30 <= lst_value < 35:
        return "Medium"
    elif 35 <= lst_value < 42:
        return "High"
    else:
        return "Extreme"


def get_satellite_alert(location="Coimbatore", temperature=None, humidity=None,
                        rainfall=None, wind_speed=None, heat_risk=None):
    """
    Get satellite-based alert for excessive heat
    
    Args:
        location (str): Location name
    
    Returns:
        dict: Alert information with severity
    """
    satellite_data = get_satellite_data(
        location, temperature, humidity, rainfall, wind_speed, heat_risk
    )
    heat_level = satellite_data["heat_intensity_level"]
    
    alert_info = {
        "location": location,
        "lst": lst,
        "heat_level": heat_level,
        "alert_status": "Active" if heat_level in ["High", "Extreme"] else "Normal",
        "recommendation": get_heat_recommendation(heat_level)
    }
    
    return alert_info


def get_heat_recommendation(heat_level):
    """
    Get recommendations based on heat intensity level
    
    Args:
        heat_level (str): Heat intensity level
    
    Returns:
        str: Recommendation message
    """
    recommendations = {
        "Low": "No action needed. Monitor conditions.",
        "Medium": "Stay hydrated. Limit outdoor activities.",
        "High": "Heat Advisory. Avoid prolonged sun exposure. Drink plenty of water.",
        "Extreme": "Extreme Heat Warning. Stay indoors. Seek cool environment. Call emergency services if needed."
    }
    
    return recommendations.get(heat_level, "Monitor weather conditions closely.")


# Main execution for testing
if __name__ == "__main__":
    print("\n" + "="*60)
    print("SATELLITE HEAT MONITORING DATA")
    print("="*60)
    
    # Get location-based satellite data
    sat_data = get_satellite_data()
    print(f"\nLocation: {sat_data['location']}")
    print(f"Land Surface Temperature (LST): {sat_data['land_surface_temperature']}°C")
    print(f"Heat Intensity Level: {sat_data['heat_intensity_level']}")
    print(f"Thermal Anomaly Detected: {sat_data['thermal_anomaly']}")
    print(f"Last Updated: {sat_data['last_updated']}")
    
    # Get regional satellite data
    regional_data = get_regional_satellite_data()
    print(f"\n{'-'*60}")
    print(f"Region: {regional_data['region']}")
    print(f"Average LST: {regional_data['average_lst']}°C")
    print(f"Hotspots Detected: {regional_data['hotspot_count']}")
    print(f"Thermal Trend: {regional_data['thermal_trend']}")
    
    # Get alert information
    alert = get_satellite_alert()
    print(f"\n{'-'*60}")
    print(f"Heat Alert for {alert['location']}")
    print(f"Alert Status: {alert['alert_status']}")
    print(f"Recommendation: {alert['recommendation']}")
    print("="*60 + "\n")
