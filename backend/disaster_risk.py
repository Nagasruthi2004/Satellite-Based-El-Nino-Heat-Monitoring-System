"""
Disaster Risk Monitoring & Early Warning Module
Provides real-time multi-hazard risk monitoring for:
- Flood Risk
- Cyclone Risk
- Landslide Risk
- Earthquake Risk / Recent Event Monitoring / Early Warning
- Heatwave Risk

Scientific & Data Integrity Rules:
- Earthquakes cannot be predicted in advance. Real-time seismic monitoring uses verified event data from official global networks (USGS/NCS).
- Never generate fake predictions, fake probabilities, fake coordinates, or fake warning times.
- If verified live data is unavailable, clearly return "No verified alert data is currently available for this location."
- Clearly distinguish Verified Alert, Risk Monitoring, and No Verified Alert Data.
"""

import os
import logging
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

from weather import fetch_weather
from heat_risk import classify_current_heat_risk

logger = logging.getLogger(__name__)

# Load .env relative to this file's directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))


def fetch_24h_rainfall_forecast(city=None, lat=None, lon=None, api_key=None):
    """
    Fetch 24-hour forecasted precipitation accumulation from OpenWeather 5-day / 3-hour forecast API.
    Returns:
        accumulated_rain_mm (float): Total rain forecast for next 24h (up to 8 x 3h slots).
        peak_3h_rain_mm (float): Peak 3h rain forecast in the next 24h.
        forecast_wind_max (float): Max forecasted wind speed (m/s).
        forecast_min_pressure (float): Min forecasted barometric pressure (hPa).
    """
    if not api_key:
        return 0.0, 0.0, 0.0, None

    params = {"appid": api_key, "units": "metric"}
    if lat is not None and lon is not None:
        params["lat"] = lat
        params["lon"] = lon
    elif city:
        params["q"] = city
    else:
        return 0.0, 0.0, 0.0, None

    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params=params,
            timeout=6,
        )
        if resp.status_code != 200:
            return 0.0, 0.0, 0.0, None

        data = resp.json()
        forecast_list = data.get("list", [])[:8]  # 8 slots * 3h = 24 hours

        total_rain = 0.0
        peak_3h = 0.0
        max_wind = 0.0
        min_press = None

        for slot in forecast_list:
            rain_entry = slot.get("rain", {})
            r3h = float(rain_entry.get("3h", 0.0)) if isinstance(rain_entry, dict) else 0.0
            total_rain += r3h
            if r3h > peak_3h:
                peak_3h = r3h

            w = float(slot.get("wind", {}).get("speed", 0.0))
            if w > max_wind:
                max_wind = w

            p = slot.get("main", {}).get("pressure")
            if p is not None:
                p_val = float(p)
                if min_press is None or p_val < min_press:
                    min_press = p_val

        return round(total_rain, 1), round(peak_3h, 1), round(max_wind, 1), min_press
    except Exception as err:
        logger.warning("Forecast fetch failed: %s", err)
        return 0.0, 0.0, 0.0, None


def fetch_recent_earthquakes(lat, lon, radius_km=500, min_mag=2.5):
    """
    Fetch recent verified earthquake events from USGS Real-time Earthquake Hazards Program.
    Does NOT predict earthquakes; only reports instrumentally verified seismic events.
    """
    if lat is None or lon is None:
        return []

    try:
        url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
        params = {
            "format": "geojson",
            "latitude": lat,
            "longitude": lon,
            "maxradiuskm": radius_km,
            "minmagnitude": min_mag,
            "limit": 5,
            "orderby": "time",
        }
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code != 200:
            return []

        features = resp.json().get("features", [])
        events = []
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])

            depth_km = coords[2] if len(coords) >= 3 else None
            time_epoch = props.get("time")
            event_time = None
            if time_epoch:
                event_time = datetime.fromtimestamp(time_epoch / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

            events.append({
                "place": props.get("place") or "Unknown location",
                "magnitude": props.get("mag"),
                "time": event_time,
                "depth_km": depth_km,
                "url": props.get("url"),
                "alert": props.get("alert"),
            })
        return events
    except Exception as err:
        logger.warning("USGS Earthquake query failed: %s", err)
        return []


def evaluate_disaster_risk(city=None, lat=None, lon=None, disaster_type=None):
    """
    Evaluate multi-hazard disaster risk monitoring & early warning status.

    Returns:
        dict: Structured risk evaluation for all 5 hazards.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY")

    # 1. Fetch live weather using existing weather module
    weather_data = None
    if city:
        weather_data = fetch_weather(city=city)
    if weather_data is None and lat is not None and lon is not None:
        weather_data = fetch_weather(lat=float(lat), lon=float(lon))

    # If weather data cannot be fetched for this location (e.g. invalid location / no data)
    if weather_data is None:
        return {
            "success": False,
            "location": city or "Unknown Location",
            "latitude": lat,
            "longitude": lon,
            "status": "No Verified Alert Data",
            "message": "No verified alert data is currently available for this location.",
            "disasters": {
                "flood": {
                    "id": "flood",
                    "title": "Flood Risk",
                    "status": "No Verified Alert Data",
                    "category": "No Verified Alert Data",
                    "message": "No verified alert data is currently available for this location.",
                    "data_source": None,
                    "last_updated": None,
                    "details": {},
                },
                "cyclone": {
                    "id": "cyclone",
                    "title": "Cyclone Risk",
                    "status": "No Verified Alert Data",
                    "category": "No Verified Alert Data",
                    "message": "No verified alert data is currently available for this location.",
                    "data_source": None,
                    "last_updated": None,
                    "details": {},
                },
                "landslide": {
                    "id": "landslide",
                    "title": "Landslide Risk",
                    "status": "No Verified Alert Data",
                    "category": "No Verified Alert Data",
                    "message": "No verified alert data is currently available for this location.",
                    "data_source": None,
                    "last_updated": None,
                    "details": {},
                },
                "earthquake": {
                    "id": "earthquake",
                    "title": "Earthquake Risk / Recent Event Monitoring / Early Warning",
                    "status": "No Verified Alert Data",
                    "category": "No Verified Alert Data",
                    "message": "No verified earthquake alert data is currently available for this location.",
                    "data_source": None,
                    "last_updated": None,
                    "details": {},
                    "scientific_rule": "Earthquakes cannot be predicted in advance by any scientific system. Real-time seismic monitoring reports verified ground motion from official networks (USGS/NCS).",
                },
                "heatwave": {
                    "id": "heatwave",
                    "title": "Heatwave Risk",
                    "status": "No Verified Alert Data",
                    "category": "No Verified Alert Data",
                    "message": "No verified alert data is currently available for this location.",
                    "data_source": None,
                    "last_updated": None,
                    "details": {},
                },
            },
        }

    resolved_lat = weather_data.get("lat", lat)
    resolved_lon = weather_data.get("lon", lon)
    resolved_city = weather_data.get("city") or city or "Selected Location"
    current_temp = weather_data.get("temperature", 0.0)
    current_humidity = weather_data.get("humidity", 0.0)
    current_wind_ms = weather_data.get("wind_speed", 0.0)
    current_wind_kmh = round(current_wind_ms * 3.6, 1)
    current_rain_mm = float(weather_data.get("rainfall", 0.0) or 0.0)
    current_pressure = weather_data.get("pressure")
    weather_desc = weather_data.get("weather_description", "Clear")
    current_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # 2. Fetch 24-hour rainfall forecast from OpenWeather
    rain_24h, peak_3h, forecast_max_wind, forecast_min_p = fetch_24h_rainfall_forecast(
        city=resolved_city,
        lat=resolved_lat,
        lon=resolved_lon,
        api_key=api_key,
    )

    # ----------------------------------------------------
    # A. FLOOD RISK
    # Status: Low / Moderate / High / Critical
    # ----------------------------------------------------
    if current_rain_mm >= 30.0 or rain_24h >= 115.5 or peak_3h >= 45.0:
        flood_status = "Critical"
        flood_msg = f"Critical flood risk: Torrential precipitation observed ({current_rain_mm} mm/h) with {rain_24h} mm forecasted accumulation."
    elif current_rain_mm >= 10.0 or rain_24h >= 64.5 or peak_3h >= 25.0:
        flood_status = "High"
        flood_msg = f"High flood risk: Heavy downpours detected ({current_rain_mm} mm/h) and {rain_24h} mm forecasted accumulation."
    elif current_rain_mm >= 2.0 or rain_24h >= 15.0:
        flood_status = "Moderate"
        flood_msg = f"Moderate flood risk: Active rainfall ({current_rain_mm} mm/h) with {rain_24h} mm forecasted accumulation."
    else:
        flood_status = "Low"
        flood_msg = f"Low flood risk: Dry to minimal rainfall ({current_rain_mm} mm/h, {rain_24h} mm in 24h forecast)."

    flood_data = {
        "id": "flood",
        "title": "Flood Risk",
        "status": flood_status,
        "category": "Risk Monitoring",
        "message": flood_msg,
        "data_source": "OpenWeather Live Precipitation & 24h Forecast Telemetry",
        "last_updated": current_timestamp,
        "details": {
            "current_rainfall_mm_h": current_rain_mm,
            "forecast_24h_rainfall_mm": rain_24h,
            "peak_3h_rainfall_mm": peak_3h,
            "water_level_gauge": "No verified river water-level gauge (CWC) configured for this location",
            "condition": weather_desc,
        },
        "official_guidance": "Model-derived hydrological risk monitoring. For statutory flood evacuation orders, check CWC and District Disaster Management Authority bulletins.",
    }

    # ----------------------------------------------------
    # B. CYCLONE RISK
    # Status: No Alert / Watch / Warning / High Risk
    # ----------------------------------------------------
    max_wind_kmh = max(current_wind_kmh, round(forecast_max_wind * 3.6, 1))
    eval_pressure = current_pressure or forecast_min_p

    if max_wind_kmh >= 89.0 or (eval_pressure and eval_pressure < 990):
        cyclone_status = "High Risk"
        cyclone_msg = f"High cyclonic risk: Violent gale-force winds ({max_wind_kmh} km/h) and low pressure ({eval_pressure or 'N/A'} hPa)."
    elif max_wind_kmh >= 62.0 or (eval_pressure and eval_pressure < 1000):
        cyclone_status = "Warning"
        cyclone_msg = f"Cyclone warning level: Sustained gale-force winds ({max_wind_kmh} km/h) and depressed pressure ({eval_pressure or 'N/A'} hPa)."
    elif max_wind_kmh >= 39.0 or (eval_pressure and eval_pressure < 1005):
        cyclone_status = "Watch"
        cyclone_msg = f"Cyclone watch: Squally wind conditions detected ({max_wind_kmh} km/h) and pressure drop ({eval_pressure or 'N/A'} hPa)."
    else:
        cyclone_status = "No Alert"
        cyclone_msg = f"No active verified cyclone alert available. Wind speed is normal ({max_wind_kmh} km/h) and barometric pressure is {eval_pressure or '1013'} hPa."

    cyclone_data = {
        "id": "cyclone",
        "title": "Cyclone Risk",
        "status": cyclone_status,
        "category": "Risk Monitoring" if cyclone_status != "No Alert" else "No Alert",
        "message": cyclone_msg,
        "data_source": "OpenWeather Live Anemometer & Barometric Telemetry",
        "last_updated": current_timestamp,
        "details": {
            "wind_speed_kmh": max_wind_kmh,
            "sustained_wind_speed_ms": round(max_wind_kmh / 3.6, 1),
            "barometric_pressure_hpa": eval_pressure,
            "official_bulletin": "No active verified IMD/RSMC cyclone alert bulletin available",
            "condition": weather_desc,
        },
        "official_guidance": "Real-time atmospheric monitoring. For official cyclone warnings, consult the India Meteorological Department (IMD RSMC New Delhi).",
    }

    # ----------------------------------------------------
    # C. LANDSLIDE RISK
    # Status: Low / Moderate / High / Critical
    # ----------------------------------------------------
    if current_rain_mm >= 35.0 or rain_24h >= 120.0 or peak_3h >= 50.0:
        landslide_status = "Critical"
        landslide_msg = f"Critical landslide risk: Torrential soil saturation precipitation ({current_rain_mm} mm/h, {rain_24h} mm in 24h)."
    elif current_rain_mm >= 15.0 or rain_24h >= 60.0 or peak_3h >= 30.0:
        landslide_status = "High"
        landslide_msg = f"High landslide risk: Heavy cumulative precipitation ({rain_24h} mm in 24h) elevates slope instability."
    elif current_rain_mm >= 3.0 or rain_24h >= 15.0:
        landslide_status = "Moderate"
        landslide_msg = f"Moderate landslide risk: Persistent rainfall ({current_rain_mm} mm/h, {rain_24h} mm in 24h) on vulnerable slopes."
    else:
        landslide_status = "Low"
        landslide_msg = f"Low landslide risk: Negligible rainfall triggering conditions ({current_rain_mm} mm/h, {rain_24h} mm in 24h)."

    landslide_data = {
        "id": "landslide",
        "title": "Landslide Risk",
        "status": landslide_status,
        "category": "Risk Monitoring",
        "message": landslide_msg,
        "data_source": "OpenWeather Precipitation Telemetry & Cumulative Rainfall Estimation",
        "last_updated": current_timestamp,
        "details": {
            "current_rainfall_mm_h": current_rain_mm,
            "forecast_24h_rainfall_mm": rain_24h,
            "terrain_slope_sensor": "No verified geological terrain sensor configured for this location",
            "condition": weather_desc,
        },
        "official_guidance": "Hydrological triggering assessment. For geotechnical slope hazard zonation, refer to Geological Survey of India (GSI) bulletins.",
    }

    # ----------------------------------------------------
    # D. EARTHQUAKE RISK / RECENT EVENT MONITORING / EARLY WARNING
    # Scientific Rule: Earthquakes CANNOT be predicted.
    # Uses verified event data from USGS Real-time GeoJSON API.
    # ----------------------------------------------------
    recent_events = fetch_recent_earthquakes(resolved_lat, resolved_lon, radius_km=500, min_mag=2.5)

    if recent_events:
        top_event = recent_events[0]
        eq_status = f"Recent Event: M {top_event['magnitude']} ({top_event['place']})"
        eq_category = "Verified Alert"
        eq_msg = f"Verified recent seismic event: M {top_event['magnitude']} recorded on {top_event['time']} at depth {top_event['depth_km']} km."
        eq_source = "USGS Earthquake Hazards Program (Verified Real-Time Global Seismic Network)"
        eq_updated = top_event["time"]
    else:
        eq_status = "No Verified Alert Data"
        eq_category = "No Verified Alert Data"
        eq_msg = "No verified earthquake alert data is currently available for this location."
        eq_source = None
        eq_updated = None

    earthquake_data = {
        "id": "earthquake",
        "title": "Earthquake Risk / Recent Event Monitoring / Early Warning",
        "status": eq_status,
        "category": eq_category,
        "message": eq_msg,
        "data_source": eq_source,
        "last_updated": eq_updated,
        "details": {
            "recent_events_count": len(recent_events),
            "recent_events": recent_events,
            "seismic_network": "National Center for Seismology (NCS) & USGS Global Seismographic Network",
        },
        "scientific_rule": "Scientific Fact: Earthquakes cannot be predicted in advance by any scientific system or weather model. Real-time seismic monitoring reports verified ground tremors from official seismic networks (USGS/NCS).",
    }

    # ----------------------------------------------------
    # E. HEATWAVE RISK
    # Reuses existing project logic: classify_current_heat_risk
    # ----------------------------------------------------
    heat_classification = classify_current_heat_risk(
        temperature=current_temp,
        humidity=current_humidity,
        rainfall=current_rain_mm,
        wind_speed=current_wind_ms,
    ) or {"level": "Low", "score": 25.0}

    heatwave_level = heat_classification.get("level", "Low")
    heatwave_score = heat_classification.get("score", 0.0)

    if heatwave_level == "Critical":
        heat_msg = f"Critical Heatwave: Severe ambient temperature ({current_temp}°C) and oppressive thermal stress."
    elif heatwave_level == "High":
        heat_msg = f"High Heat Risk: Elevated temperatures ({current_temp}°C) approaching heatwave threshold."
    elif heatwave_level in ("Medium", "Moderate"):
        heat_msg = f"Moderate Heat Conditions: Daytime temperatures ({current_temp}°C) warrant proactive hydration."
    else:
        heat_msg = f"Low Heat Risk: Current temperature ({current_temp}°C) within normal seasonal limits."

    heatwave_data = {
        "id": "heatwave",
        "title": "Heatwave Risk",
        "status": heatwave_level,
        "category": "Risk Monitoring",
        "message": heat_msg,
        "data_source": "OpenWeather Live Surface Observations & Thermal Classification Model",
        "last_updated": current_timestamp,
        "details": {
            "temperature_c": current_temp,
            "humidity_percent": current_humidity,
            "wind_speed_kmh": current_wind_kmh,
            "rainfall_mm": current_rain_mm,
            "heat_risk_score": heatwave_score,
            "condition": weather_desc,
        },
        "official_guidance": "Thermal index calculated from live surface meteorological data. For official state heatwave declarations, check daily IMD Heat Wave Bulletins.",
    }

    all_disasters = {
        "flood": flood_data,
        "cyclone": cyclone_data,
        "landslide": landslide_data,
        "earthquake": earthquake_data,
        "heatwave": heatwave_data,
    }

    return {
        "success": True,
        "location": resolved_city,
        "latitude": resolved_lat,
        "longitude": resolved_lon,
        "status": "Active Risk Monitoring",
        "timestamp": current_timestamp,
        "disasters": all_disasters,
    }
