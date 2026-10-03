"""
Flask backend server for weather, satellite, and heat prediction data
Provides weather, satellite monitoring, and ML-based heat prediction endpoints
"""
try:
    from research_generator import generate_research
except ImportError:
    generate_research = None

import os
import logging
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from weather import fetch_weather
from satellite import get_satellite_data, get_satellite_alert
from heat_prediction import predict_heat_risk, get_prediction_explanation
from heat_risk import classify_current_heat_risk, classify_forecast_heat_risk
from email_service import send_heat_alert_subscription_email, is_valid_email
from email_alerts import (
    is_valid_email as is_valid_alert_email,
    is_smtp_configured,
    send_heat_alert_email,
    save_alert_config,
    get_alert_config_status,
    VALID_THRESHOLDS,
)
from emergency_location import get_emergency_info
from elnino_news import fetch_elnino_news

# Configure logging so weather.py logger output is visible in the Flask console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

REGION_ONLY_SEARCHES = {
    "india", "tamil nadu", "andhra pradesh", "karnataka", "kerala",
    "telangana", "maharashtra", "punjab", "rajasthan",
    "united states", "united kingdom", "australia", "canada",
}

# Create Flask application
app = Flask(__name__)

# Enable CORS for the Vite and local frontend origins
CORS(
    app,
    resources={r"/*": {"origins": [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://localhost:3000",
    ]}},
    supports_credentials=True,
)


@app.route("/weather", methods=["GET"])
def get_weather():
    """
    Endpoint to fetch weather data for a given city.
    Query parameter: city (default: Coimbatore)
    Returns: JSON response with live weather + ML heat risk prediction.
    """
    requested_city = request.args.get("city", "").strip()
    if requested_city and requested_city.casefold() in REGION_ONLY_SEARCHES:
        return jsonify({"error": "Please enter a city name."}), 400

    raw_candidates = request.args.getlist("city_candidates")
    if requested_city:
        raw_candidates = [requested_city] + raw_candidates
    elif not raw_candidates and (request.args.get("latitude") is None or request.args.get("longitude") is None):
        raw_candidates = ["Coimbatore"]

    invalid_names = {"unavailable", "null", "undefined"}
    candidates = list(dict.fromkeys(
        candidate.strip()
        for candidate in raw_candidates
        if candidate
        and candidate.strip()
        and candidate.strip().lower() not in invalid_names
        and not candidate.strip().lower().startswith("ward ")
    ))
    logger.info(
        "/weather called | latitude=%s | longitude=%s | detailed_location=%s | candidates=%s",
        request.args.get("latitude"),
        request.args.get("longitude"),
        request.args.get("detailed_location"),
        candidates,
    )
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")

    if not candidates and (latitude is None or longitude is None):
        return jsonify({"error": "A valid city or town is required"}), 400

    city = candidates[0] if candidates else "Selected Location"
    weather_data = None
    for candidate in candidates:
        weather_data = fetch_weather(candidate)
        if weather_data is not None:
            city = candidate
            logger.info("Resolved weather city used | city=%s", city)
            break

    if weather_data is None and latitude is not None and longitude is not None:
        try:
            weather_data = fetch_weather(lat=float(latitude), lon=float(longitude))
            if weather_data is not None:
                city = weather_data.get("city") or city
                logger.info("Resolved weather coordinate used | lat=%s | lon=%s | city=%s", latitude, longitude, city)
        except (ValueError, TypeError) as coord_err:
            logger.warning("Coordinate weather fallback failed: %s", coord_err)

    if weather_data is None:
        logger.error("/weather failed | city=%s | fetch_weather returned None", city)
        return jsonify({"error": "Unable to fetch weather", "city": city}), 500

    current_heat_risk = classify_current_heat_risk(
        temperature=weather_data.get("temperature"),
        humidity=weather_data.get("humidity"),
        rainfall=weather_data.get("rainfall"),
        wind_speed=weather_data.get("wind_speed"),
    )
    if current_heat_risk is None:
        return jsonify({"error": "Current heat risk unavailable"}), 503

    ml_result = predict_heat_risk(
        temperature=weather_data["temperature"],
        humidity=weather_data["humidity"],
        rainfall=weather_data["rainfall"],
        wind_speed=weather_data["wind_speed"] * 3.6
    )
    explanation = get_prediction_explanation({
        "predicted_risk": current_heat_risk["level"],
        "confidence": ml_result["confidence"],
    })

    weather_data["heat_risk"]            = current_heat_risk["level"]
    weather_data["heat_risk_score"]      = current_heat_risk["score"]
    weather_data["current_heat_risk"]    = current_heat_risk
    weather_data["heat_risk_confidence"] = round(ml_result["confidence"], 2)
    weather_data["heat_risk_explanation"] = explanation

    response = jsonify(weather_data)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response, 200


@app.route("/satellite", methods=["GET"])
def get_satellite():
    """
    Endpoint to fetch satellite-based heat monitoring data
    Returns: JSON response with LST, heat intensity, thermal anomalies, etc.
    """
    try:
        city = request.args.get("city", "Coimbatore").strip() or "Coimbatore"
        environment = {
            "temperature": request.args.get("temperature"),
            "humidity": request.args.get("humidity"),
            "rainfall": request.args.get("rainfall"),
            "wind_speed": request.args.get("wind_speed"),
            "heat_risk": request.args.get("heat_risk"),
        }
        satellite_data = get_satellite_data(location=city, **environment)
        alert_data = get_satellite_alert(location=city, **environment)
        
        return jsonify({
            "location": satellite_data["location"],
            "latitude": satellite_data["latitude"],
            "longitude": satellite_data["longitude"],
            "land_surface_temperature": satellite_data["land_surface_temperature"],
            "heat_intensity_level": satellite_data["heat_intensity_level"],
            "thermal_anomaly": satellite_data["thermal_anomaly"],
            "alert_status": alert_data["alert_status"],
            "recommendation": alert_data["recommendation"],
            "last_updated": satellite_data["last_updated"],
            "satellite_source": satellite_data["satellite_source"]
        }), 200
    except Exception as error:
        return jsonify({
            "error": f"Failed to fetch satellite data: {str(error)}"
        }), 500


@app.route("/heatforecast", methods=["GET"])
def get_heat_forecast():
    """
    Returns a 7-day AI heat risk forecast for a city.
    Days 1-5 use real OpenWeather forecast temps; days 6-7 are extrapolated.
    Each day's heat risk is predicted by the ML model.
    """
    import os, requests
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

    city = request.args.get("city", "Coimbatore").strip()
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if not api_key:
        return jsonify({"error": "OPENWEATHER_API_KEY not configured"}), 500

    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=10,
        )
        if resp.status_code == 404:
            return jsonify({"error": "City not found"}), 404
        resp.raise_for_status()
        raw = resp.json()
    except requests.exceptions.RequestException as err:
        logger.error("HeatForecast fetch failed | city=%s | error=%s", city, err)
        return jsonify({"error": "Unable to fetch forecast"}), 500

    from collections import defaultdict
    from datetime import datetime, timedelta

    # Group all 3-hour slots by date
    slots = defaultdict(list)
    for entry in raw.get("list", []):
        date = entry["dt_txt"].split(" ")[0]
        slots[date].append(entry)

    def avg(lst): return sum(lst) / len(lst) if lst else 0

    def pick_slot(entries):
        """Return the noon slot, or the one closest to 12:00."""
        for e in entries:
            if "12:00:00" in e["dt_txt"]:
                return e
        return min(entries, key=lambda e: abs(int(e["dt_txt"][11:13]) - 12))

    sorted_dates = sorted(slots.keys())[:5]
    days_data = []
    for d in sorted_dates:
        rep = pick_slot(slots[d])
        days_data.append({
            "date":      d,
            "temp":      round(rep["main"]["temp"], 1),
            "humidity":  round(avg([e["main"]["humidity"] for e in slots[d]]), 1),
            "wind":      round(avg([e["wind"]["speed"] * 3.6 for e in slots[d]]), 1),
            "rainfall":  round(avg([e.get("rain", {}).get("3h", 0) for e in slots[d]]), 1),
            "condition": rep["weather"][0]["main"],
        })

    # Linear trend over all 5 days for extrapolation
    n = len(days_data)
    if n >= 2:
        xs = list(range(n))
        ys = [d["temp"] for d in days_data]
        x_mean = sum(xs) / n
        y_mean = sum(ys) / n
        slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys)) / \
                sum((x - x_mean) ** 2 for x in xs)
    else:
        slope = 0

    last_date = datetime.strptime(days_data[-1]["date"], "%Y-%m-%d") if days_data else datetime.today()
    for i in range(1, 3):
        extra_temp = round(days_data[-1]["temp"] + slope * i, 1)
        extra_hum  = max(0, min(100, round(days_data[-1]["humidity"] + (days_data[-1]["humidity"] - days_data[0]["humidity"]) / max(n - 1, 1) * i, 1)))
        extra_wind = round(max(0, days_data[-1]["wind"] + (days_data[-1]["wind"] - days_data[0]["wind"]) / max(n - 1, 1) * i), 1)
        if extra_temp >= 35:
            cond = "Clear"
        elif extra_temp >= 25:
            cond = "Partly Cloudy"
        else:
            cond = "Cloudy"
        days_data.append({
            "date":      (last_date + timedelta(days=i)).strftime("%Y-%m-%d"),
            "temp":      extra_temp,
            "humidity":  extra_hum,
            "wind":      extra_wind,
            "rainfall":  0,
            "condition": cond,
            "predicted": True,
        })

    forecast = []
    for i, d in enumerate(days_data[:7]):
        forecast_inputs = {
            "temperature": d["temp"],
            "humidity": d["humidity"],
            "rainfall": d["rainfall"],
            "wind_speed": d["wind"],
        }
        forecast_risk = classify_forecast_heat_risk(forecast_inputs)
        ml = predict_heat_risk(
            temperature=d["temp"],
            humidity=d["humidity"],
            rainfall=d["rainfall"],
            wind_speed=d["wind"],
        )
        forecast.append({
            "day":         f"Day {i + 1}",
            "date":        d["date"],
            "temperature": d["temp"],
            "humidity":    d["humidity"],
            "wind_speed":  d["wind"],
            "rainfall":    d["rainfall"],
            "condition":   d["condition"],
            "predicted":   d.get("predicted", False),
            "heat_risk":   forecast_risk["level"] if forecast_risk else None,
            "heat_risk_score": forecast_risk["score"] if forecast_risk else None,
            "confidence":  round(ml["confidence"], 1),
        })

    return jsonify({"city": city, "forecast": forecast}), 200


@app.route("/predict", methods=["GET", "POST"])
def predict():
    """
    Endpoint for ML-based heat risk prediction
    Accepts query parameters or JSON body with weather data
    Returns: Predicted heat risk, confidence score, and recommendation
    
    Query Parameters (GET):
        - temperature: Temperature in Celsius
        - humidity: Humidity percentage (0-100)
        - rainfall: Rainfall in mm
        - wind_speed: Wind speed in km/h
    
    JSON Body (POST):
        {
            "temperature": float,
            "humidity": float,
            "rainfall": float,
            "wind_speed": float
        }
    """
    try:
        # Get parameters from request (supports both GET and POST)
        if request.method == "POST":
            data = request.get_json(silent=True) or {}
            temperature = data.get("temperature")
            humidity = data.get("humidity")
            rainfall = data.get("rainfall")
            wind_speed = data.get("wind_speed")
        else:
            temperature = request.args.get("temperature", type=float)
            humidity = request.args.get("humidity", type=float)
            rainfall = request.args.get("rainfall", type=float)
            wind_speed = request.args.get("wind_speed", type=float)

        try:
            temperature = float(temperature)
            humidity = float(humidity)
            rainfall = float(rainfall)
            wind_speed = float(wind_speed)
        except (TypeError, ValueError):
            return jsonify({"error": "Heat risk prediction unavailable"}), 400

        import math
        if not all(math.isfinite(value) for value in (temperature, humidity, rainfall, wind_speed)):
            return jsonify({"error": "Heat risk prediction unavailable"}), 400
        
        # Validate input parameters
        if temperature is None or humidity is None or rainfall is None or wind_speed is None:
            return jsonify({
                "error": "Missing required parameters",
                "required": ["temperature", "humidity", "rainfall", "wind_speed"]
            }), 400
        
        # Validate parameter ranges
        if not (0 <= humidity <= 100):
            return jsonify({
                "error": "Humidity must be between 0 and 100"
            }), 400
        
        if rainfall < 0 or wind_speed < 0:
            return jsonify({
                "error": "Rainfall and wind speed cannot be negative"
            }), 400
        
        # Get prediction from ML model
        prediction_result = predict_heat_risk(
            temperature=temperature,
            humidity=humidity,
            rainfall=rainfall,
            wind_speed=wind_speed
        )
        
        # Get explanation
        explanation = get_prediction_explanation(prediction_result)
        
        return jsonify({
            "input_parameters": {
                "temperature": temperature,
                "humidity": humidity,
                "rainfall": rainfall,
                "wind_speed": wind_speed
            },
            "prediction": {
                "heat_risk": prediction_result["predicted_risk"],
                "confidence": round(prediction_result["confidence"], 2),
                "explanation": explanation
            }
        }), 200
    
    except Exception as error:
        return jsonify({
            "error": f"Prediction failed: {str(error)}"
        }), 500


@app.route("/", methods=["GET"])
def home():
    """
    Home endpoint - API information
    """
    return jsonify({
        "message": "Satellite-Based El Niño Heat Monitoring System API",
        "endpoints": {
            "/weather": "GET - Returns current weather data",
            "/satellite": "GET - Returns satellite heat monitoring data",
            "/predict": "GET/POST - ML-based heat risk prediction",
            "/elnino-news": "GET - Returns real-world El Niño and ENSO news with category filter",
            "/smart-awareness": "GET - Returns smart heat awareness guidance and recommendations",
            "/india-lst": "GET - Returns historical India Land Surface Temperature (LST) dataset (2020-2025)",
            "/email-alert/config": "GET/POST - Retrieve or save heat alert notification configuration",
            "/email-alert/test": "POST - Send a test heat risk alert notification email",
            "/emergency-info": "GET - Returns verified emergency contacts, location heat status, and safety guidance"
        }
    }), 200

@app.route("/research", methods=["POST"])
def research():
    if generate_research is None:
        return jsonify({"error": "AI Research generator service is unavailable."}), 503
    data = request.json or {}
    result = generate_research(
        data.get("city", "Coimbatore"),
        data.get("temperature", 0),
        data.get("humidity", 0),
        data.get("rainfall", 0),
        data.get("wind_speed", 0),
        data.get("heat_risk", "Low")
    )
    return jsonify({"research": result})


@app.route("/subscribe", methods=["POST"])
@app.route("/subscribe-alert", methods=["POST"])
def subscribe_alert():
    """
    Endpoint to register an email address for heat alerts.
    Sends a real confirmation email using SMTP (Gmail).
    Accepts JSON body:
        {
            "email": "user@example.com",
            "city": "Coimbatore"
        }
    """
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip()
        city = (data.get("city") or "Coimbatore").strip() or "Coimbatore"

        if not email:
            return jsonify({"error": "Email address is required."}), 400

        if not is_valid_email(email):
            return jsonify({"error": "Please enter a valid email address."}), 400

        logger.info("Processing heat alert subscription | email=%s | city=%s", email, city)
        success, message = send_heat_alert_subscription_email(to_email=email, city=city)

        if not success:
            logger.error("Failed to send subscription email to %s: %s", email, message)
            return jsonify({
                "error": "Unable to send email. Please try again.",
                "details": message
            }), 500

        return jsonify({
            "status": "success",
            "message": "Email Alert Registered Successfully",
            "email": email,
            "city": city
        }), 200

    except Exception as exc:
        logger.error("Unexpected error in /subscribe: %s", exc)
        return jsonify({"error": "Unable to send email. Please try again."}), 500


@app.route("/elnino-news", methods=["GET"])
def get_elnino_news():
    """
    Endpoint to fetch real, recent El Niño and ENSO news.
    Query parameters:
        category: 'all' | 'india' | 'global' | 'climate' | 'impacts' (default: 'all')
        refresh: 'true' | 'false' (forces fresh fetch, bypassing cache)
    """
    try:
        category = request.args.get("category", "all").strip().lower()
        refresh_arg = request.args.get("refresh", "").strip().lower()
        force_refresh = refresh_arg in ("true", "1", "yes")

        logger.info("Fetching El Niño news | category=%s | force_refresh=%s", category, force_refresh)
        news_data = fetch_elnino_news(category=category, force_refresh=force_refresh)
        return jsonify(news_data), 200
    except Exception as exc:
        logger.error("Failed to fetch El Niño news: %s", exc)
        return jsonify({
            "status": "error",
            "error": "Unable to fetch latest El Niño news. Please try again later.",
            "details": str(exc),
            "articles": []
        }), 500


@app.route("/world-heatmap", methods=["GET"])
def get_world_heatmap():
    """
    Endpoint to retrieve real World Heat Map Land Surface Temperature (LST) data
    derived from validated NASA MODIS Terra MOD11A2.061 satellite observations.
    Returns: JSON containing location, country, latitude, longitude, year, lst_celsius, heat_risk.
    """
    try:
        csv_path = os.path.join(
            os.path.dirname(__file__), "..", "dataset", "world_heat_map_dataset.csv"
        )
        if not os.path.exists(csv_path):
            logger.error("World heatmap dataset file not found at: %s", csv_path)
            return jsonify({
                "status": "error",
                "error": "World Heat Map dataset file not found",
                "data": []
            }), 404

        df = pd.read_csv(csv_path)
        records = df.to_dict(orient="records")
        logger.info("Serving %d real World Heat Map records from %s", len(records), csv_path)

        return jsonify({
            "status": "success",
            "count": len(records),
            "source": "NASA MODIS Terra MOD11A2.061",
            "data": records
        }), 200

    except Exception as exc:
        logger.error("Failed to load world heatmap dataset: %s", exc)
        return jsonify({
            "status": "error",
            "error": "Failed to load world heatmap dataset",
            "details": str(exc),
            "data": []
        }), 500


@app.route("/smart-awareness", methods=["GET"])
def get_smart_awareness():
    """
    Endpoint providing smart heat awareness messages, recommended actions,
    and alert context based on live weather heat-risk level or specified level.
    """
    awareness_catalog = {
        "Low": {
            "headline": "Heat conditions are currently low.",
            "guidance": "Continue normal hydration and stay aware of weather changes.",
            "severity": "Low Risk",
            "temperature_threshold": "< 30°C",
            "recommended_actions": [
                {
                    "title": "Hydration Routine",
                    "category": "Hydration",
                    "icon": "💧",
                    "desc": "Maintain regular daily hydration with 2 to 2.5 litres of clean drinking water."
                },
                {
                    "title": "Outdoor Activities",
                    "category": "Activity",
                    "icon": "🏃",
                    "desc": "Normal outdoor work, recreation, and athletic activities are completely safe."
                },
                {
                    "title": "Weather Awareness",
                    "category": "Awareness",
                    "icon": "🌤️",
                    "desc": "Stay aware of local weather updates and sudden temperature variations."
                },
                {
                    "title": "Sun Protection",
                    "category": "Protection",
                    "icon": "🧢",
                    "desc": "Wear lightweight comfortable clothing and hats when under direct midday sun."
                }
            ],
            "why_this_alert": [
                "Ambient temperature is within comfortable baseline limits (< 30°C).",
                "Thermal comfort index indicates negligible stress on cardiovascular systems.",
                "Atmospheric heat retention is low with favorable ventilation."
            ]
        },
        "Medium": {
            "headline": "Moderate heat conditions detected.",
            "guidance": "Stay hydrated and avoid unnecessary exposure to strong afternoon heat.",
            "severity": "Moderate Risk",
            "temperature_threshold": "30°C – 35.9°C",
            "recommended_actions": [
                {
                    "title": "Proactive Hydration",
                    "category": "Hydration",
                    "icon": "🥤",
                    "desc": "Drink plenty of water at regular intervals, even before experiencing thirst."
                },
                {
                    "title": "Afternoon Heat Caution",
                    "category": "Activity",
                    "icon": "⛱️",
                    "desc": "Avoid unnecessary exposure to strong afternoon heat between 12:00 PM and 3:00 PM."
                },
                {
                    "title": "Comfortable Attire",
                    "category": "Protection",
                    "icon": "👕",
                    "desc": "Wear loose, light-colored cotton garments and use sunglasses or umbrellas outdoors."
                },
                {
                    "title": "Vulnerable Care",
                    "category": "Health",
                    "icon": "🩺",
                    "desc": "Check on children, elderly family members, and outdoor workers during midday hours."
                }
            ],
            "why_this_alert": [
                "Elevated temperatures (30°C–36°C) increase physiological thermal load.",
                "Moderate humidity slows evaporative cooling through perspiration.",
                "Solar radiation intensity peaks in early afternoon, elevating heat stress."
            ]
        },
        "High": {
            "headline": "High heat conditions detected.",
            "guidance": "Drink plenty of water, reduce outdoor activity during peak afternoon hours, and stay in cool areas.",
            "severity": "High Risk",
            "temperature_threshold": "36°C – 39.9°C",
            "recommended_actions": [
                {
                    "title": "Intensive Hydration",
                    "category": "Hydration",
                    "icon": "🚰",
                    "desc": "Drink 3 to 4 litres of water throughout the day; include electrolyte or lemon water."
                },
                {
                    "title": "Peak Hour Restriction",
                    "category": "Activity",
                    "icon": "🚫",
                    "desc": "Reduce outdoor activity during peak afternoon hours (11:30 AM to 4:00 PM)."
                },
                {
                    "title": "Cool Environments",
                    "category": "Environment",
                    "icon": "❄️",
                    "desc": "Stay in cool, shaded, or air-conditioned areas and keep indoor living spaces ventilated."
                },
                {
                    "title": "Heat Exhaustion Watch",
                    "category": "Health",
                    "icon": "⚠️",
                    "desc": "Watch for early symptoms of heat exhaustion: dizziness, profuse sweating, and fatigue."
                }
            ],
            "why_this_alert": [
                "Sustained high temperatures (36°C–40°C) exceed comfortable thermal regulation.",
                "Combined heat index places significant strain on vulnerable populations.",
                "Urban heat island effect amplifies localized surface and air temperatures."
            ]
        },
        "Critical": {
            "headline": "Critical heat conditions detected.",
            "guidance": "Avoid unnecessary outdoor exposure, stay hydrated, remain in a cool place, and seek medical help if heat-related symptoms occur.",
            "severity": "Critical Risk",
            "temperature_threshold": "≥ 40°C",
            "recommended_actions": [
                {
                    "title": "Avoid Outdoor Exposure",
                    "category": "Urgent",
                    "icon": "🏠",
                    "desc": "Avoid all unnecessary outdoor exposure; stay indoors in the coolest available room."
                },
                {
                    "title": "Continuous Hydration",
                    "category": "Hydration",
                    "icon": "🧊",
                    "desc": "Stay constantly hydrated with ORS, coconut water, or water; avoid caffeine and alcohol."
                },
                {
                    "title": "Active Indoor Cooling",
                    "category": "Environment",
                    "icon": "💨",
                    "desc": "Use fans, AC, cold compresses, or damp towels; draw dark curtains against direct sunlight."
                },
                {
                    "title": "Seek Medical Help",
                    "category": "Emergency",
                    "icon": "🚑",
                    "desc": "Seek emergency medical help immediately if confusion, fainting, or high body fever occurs."
                }
            ],
            "why_this_alert": [
                "Extreme temperatures (≥ 40°C) pose dangerous risk of acute heatstroke and hyperthermia.",
                "Body cooling mechanisms can fail under prolonged exposure to critical thermal limits.",
                "Satellite LST and atmospheric conditions indicate hazardous heatwave intensity."
            ]
        }
    }

    requested_level = request.args.get("level", "").strip().capitalize()
    if requested_level in awareness_catalog:
        selected_data = awareness_catalog[requested_level]
        return jsonify({
            "status": "success",
            "level": requested_level,
            "headline": selected_data["headline"],
            "guidance": selected_data["guidance"],
            "severity": selected_data["severity"],
            "temperature_threshold": selected_data["temperature_threshold"],
            "recommended_actions": selected_data["recommended_actions"],
            "why_this_alert": selected_data["why_this_alert"],
            "all_levels": list(awareness_catalog.keys())
        }), 200

    city = request.args.get("city", "Coimbatore").strip() or "Coimbatore"
    weather_data = fetch_weather(city)
    if weather_data is not None:
        risk_obj = classify_current_heat_risk(
            temperature=weather_data.get("temperature"),
            humidity=weather_data.get("humidity"),
            rainfall=weather_data.get("rainfall"),
            wind_speed=weather_data.get("wind_speed")
        )
        resolved_level = risk_obj["level"] if risk_obj else "Medium"
        selected_data = awareness_catalog.get(resolved_level, awareness_catalog["Medium"])
        return jsonify({
            "status": "success",
            "city": weather_data.get("city", city),
            "temperature": weather_data.get("temperature"),
            "humidity": weather_data.get("humidity"),
            "wind_speed": weather_data.get("wind_speed"),
            "rainfall": weather_data.get("rainfall"),
            "level": resolved_level,
            "score": risk_obj.get("score") if risk_obj else None,
            "headline": selected_data["headline"],
            "guidance": selected_data["guidance"],
            "severity": selected_data["severity"],
            "temperature_threshold": selected_data["temperature_threshold"],
            "recommended_actions": selected_data["recommended_actions"],
            "why_this_alert": selected_data["why_this_alert"],
            "all_levels": list(awareness_catalog.keys())
        }), 200

    default_level = "Medium"
    selected_data = awareness_catalog[default_level]
    return jsonify({
        "status": "success",
        "city": city,
        "level": default_level,
        "headline": selected_data["headline"],
        "guidance": selected_data["guidance"],
        "severity": selected_data["severity"],
        "temperature_threshold": selected_data["temperature_threshold"],
        "recommended_actions": selected_data["recommended_actions"],
        "why_this_alert": selected_data["why_this_alert"],
        "all_levels": list(awareness_catalog.keys())
    }), 200


INDIA_STATE_COORDINATES = {
    "Andaman and Nicobar": (11.6670, 92.7359),
    "Andhra Pradesh": (15.9129, 79.7400),
    "Arunachal Pradesh": (28.2180, 94.7278),
    "Assam": (26.2006, 92.9376),
    "Bihar": (25.0961, 85.3131),
    "Chandigarh": (30.7333, 76.7794),
    "Chhattisgarh": (21.2787, 81.8661),
    "Dadra and Nagar Haveli": (20.1809, 73.0169),
    "Daman and Diu": (20.4283, 72.8397),
    "Delhi": (28.7041, 77.1025),
    "Goa": (15.2993, 74.1240),
    "Gujarat": (22.2587, 71.1924),
    "Haryana": (29.0588, 76.0856),
    "Himachal Pradesh": (31.1048, 77.1734),
    "Jharkhand": (23.6102, 85.2799),
    "Karnataka": (15.3173, 75.7139),
    "Kerala": (10.8505, 76.2711),
    "Lakshadweep": (10.5667, 72.6417),
    "Madhya Pradesh": (22.9734, 78.6569),
    "Maharashtra": (19.7515, 75.7139),
    "Manipur": (24.6637, 93.9063),
    "Meghalaya": (25.4670, 91.3662),
    "Mizoram": (23.1645, 92.9376),
    "Nagaland": (26.1584, 94.5624),
    "Orissa": (20.9517, 85.0985),
    "Puducherry": (11.9416, 79.8083),
    "Punjab": (31.1471, 75.3412),
    "Rajasthan": (27.0238, 74.2179),
    "Sikkim": (27.5330, 88.5122),
    "Tamil Nadu": (11.1271, 78.6569),
    "Tripura": (23.9408, 91.9882),
    "Uttar Pradesh": (26.8467, 80.9462),
    "Uttarakhand": (30.0668, 79.0193),
    "West Bengal": (22.9868, 87.8550)
}

AVAILABLE_INDIA_LST_YEARS = [2020, 2021, 2022, 2023, 2024, 2025]


@app.route("/india-lst", methods=["GET"])
def get_india_lst():
    """
    Endpoint to retrieve India Land Surface Temperature (LST) data for a given year.
    Supports years 2020 through 2025.
    Returns: JSON containing selected year, count, average_lst, highest_lst, lowest_lst,
             heat_risk distribution, and state-wise records from actual dataset.
    """
    try:
        year_str = request.args.get("year", "2025").strip()
        try:
            year_int = int(year_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "error": "Invalid year format",
                "available_years": AVAILABLE_INDIA_LST_YEARS,
                "data": []
            }), 400

        if year_int not in AVAILABLE_INDIA_LST_YEARS:
            return jsonify({
                "status": "error",
                "error": f"Data unavailable for year {year_int}",
                "available_years": AVAILABLE_INDIA_LST_YEARS,
                "data": []
            }), 404

        dataset_dir = os.path.join(os.path.dirname(__file__), "..", "dataset")
        csv_path = os.path.join(dataset_dir, f"India_LST_{year_int}.csv")
        xlsx_path = os.path.join(dataset_dir, "India_LST_Clean_Dataset_2020_2025.xlsx")

        df = None
        source_name = ""
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            source_name = f"India_LST_{year_int}.csv"
        elif os.path.exists(xlsx_path):
            full_df = pd.read_excel(xlsx_path)
            df = full_df[full_df["Year"] == year_int].copy()
            source_name = "India_LST_Clean_Dataset_2020_2025.xlsx"

        if df is None or df.empty:
            logger.warning("India LST dataset file missing or empty for year %d", year_int)
            return jsonify({
                "status": "error",
                "error": f"Data unavailable for year {year_int}",
                "available_years": AVAILABLE_INDIA_LST_YEARS,
                "data": []
            }), 404

        lst_col = next((c for c in df.columns if "LST" in c or "Average" in c), "Average LST (°C)")

        records = []
        for _, row in df.iterrows():
            state_name = str(row["State"]).strip()
            lst_val = round(float(row[lst_col]), 2)
            risk_val = str(row["Heat Risk"]).strip()
            coords = INDIA_STATE_COORDINATES.get(state_name, (20.5937, 78.9629))
            records.append({
                "state": state_name,
                "year": year_int,
                "lst_celsius": lst_val,
                "heat_risk": risk_val,
                "latitude": coords[0],
                "longitude": coords[1]
            })

        avg_lst = round(float(df[lst_col].mean()), 2)
        highest_record = max(records, key=lambda x: x["lst_celsius"])
        lowest_record = min(records, key=lambda x: x["lst_celsius"])

        raw_dist = df["Heat Risk"].value_counts().to_dict()
        risk_dist = {str(k): int(v) for k, v in raw_dist.items()}

        logger.info("Serving India LST data for year %d (%d records)", year_int, len(records))

        return jsonify({
            "status": "success",
            "year": year_int,
            "available_years": AVAILABLE_INDIA_LST_YEARS,
            "source_file": source_name,
            "count": len(records),
            "average_lst": avg_lst,
            "highest_lst": highest_record,
            "lowest_lst": lowest_record,
            "risk_distribution": risk_dist,
            "data": records
        }), 200

    except Exception as exc:
        logger.error("Failed to load India LST dataset: %s", exc)
        return jsonify({
            "status": "error",
            "error": "Failed to load India LST dataset",
            "details": str(exc),
            "data": []
        }), 500


def _load_full_india_lst_df():
    """Helper to load all 2020-2025 India LST dataset records."""
    dataset_dir = os.path.join(os.path.dirname(__file__), "..", "dataset")
    xlsx_path = os.path.join(dataset_dir, "India_LST_Clean_Dataset_2020_2025.xlsx")

    if os.path.exists(xlsx_path):
        df = pd.read_excel(xlsx_path)
    else:
        dfs = []
        for y in AVAILABLE_INDIA_LST_YEARS:
            cpath = os.path.join(dataset_dir, f"India_LST_{y}.csv")
            if os.path.exists(cpath):
                dfs.append(pd.read_csv(cpath))
        if not dfs:
            return None, ""
        df = pd.concat(dfs, ignore_index=True)

    lst_col = next((c for c in df.columns if "LST" in c or "Average" in c), "Average LST (°C)")
    return df, lst_col


@app.route("/heat-analysis", methods=["GET"])
def get_heat_analysis():
    """
    Endpoint to retrieve comprehensive India LST Heat Analysis statistics (2020-2025).
    Optional query parameters:
      - year: int (2020-2025, default 2025)
      - state_a: str (optional, state for comparison)
      - state_b: str (optional, state for comparison)
      - state: str (optional, single state for historical trend)
    Returns: JSON containing yearly trend, hottest/lowest states, risk distribution,
             state historical data, key insights, and comparison data.
    """
    try:
        df, lst_col = _load_full_india_lst_df()
        if df is None or df.empty:
            logger.warning("India LST dataset file missing or empty for heat analysis")
            return jsonify({
                "status": "error",
                "error": "India LST dataset unavailable",
                "available_years": AVAILABLE_INDIA_LST_YEARS
            }), 404

        years = sorted(df["Year"].dropna().unique().astype(int).tolist())
        states = sorted(df["State"].dropna().astype(str).unique().tolist())

        year_param = request.args.get("year", "2025").strip()
        try:
            selected_year = int(year_param)
        except ValueError:
            return jsonify({
                "status": "error",
                "error": "Invalid year format",
                "available_years": AVAILABLE_INDIA_LST_YEARS
            }), 400

        if selected_year not in AVAILABLE_INDIA_LST_YEARS:
            return jsonify({
                "status": "error",
                "error": f"Data unavailable for year {selected_year}",
                "available_years": AVAILABLE_INDIA_LST_YEARS
            }), 404

        yearly_trend = []
        risk_distribution_by_year = []
        by_year = {}

        for y in years:
            sub = df[df["Year"] == y].copy()
            avg_lst = round(float(sub[lst_col].mean()), 2)
            min_lst = round(float(sub[lst_col].min()), 2)
            max_lst = round(float(sub[lst_col].max()), 2)
            yearly_trend.append({
                "year": y,
                "average_lst": avg_lst,
                "min_lst": min_lst,
                "max_lst": max_lst,
                "state_count": len(sub)
            })

            rc = sub["Heat Risk"].value_counts().to_dict()
            dist_obj = {
                "year": y,
                "Low": int(rc.get("Low", 0)),
                "Moderate": int(rc.get("Moderate", 0)),
                "High": int(rc.get("High", 0)),
                "total": len(sub)
            }
            risk_distribution_by_year.append(dist_obj)

            sub_sorted = sub.sort_values(lst_col, ascending=False)
            top10 = []
            for _, r in sub_sorted.head(10).iterrows():
                top10.append({
                    "state": str(r["State"]).strip(),
                    "lst_celsius": round(float(r[lst_col]), 2),
                    "heat_risk": str(r["Heat Risk"]).strip()
                })
            bottom5 = []
            for _, r in sub.sort_values(lst_col, ascending=True).head(5).iterrows():
                bottom5.append({
                    "state": str(r["State"]).strip(),
                    "lst_celsius": round(float(r[lst_col]), 2),
                    "heat_risk": str(r["Heat Risk"]).strip()
                })

            by_year[y] = {
                "year": y,
                "top_10_hottest": top10,
                "bottom_5_lowest": bottom5,
                "risk_distribution": dist_obj,
                "average_lst": avg_lst,
                "highest_lst": top10[0] if top10 else None,
                "lowest_lst": bottom5[0] if bottom5 else None,
            }

        state_history = {}
        for st in states:
            sub_st = df[df["State"] == st].sort_values("Year")
            records = []
            rc_st = {"Low": 0, "Moderate": 0, "High": 0}
            years_by_risk = {"Low": [], "Moderate": [], "High": []}
            for _, r in sub_st.iterrows():
                yr = int(r["Year"])
                val = round(float(r[lst_col]), 2)
                risk = str(r["Heat Risk"]).strip()
                rc_st[risk] = rc_st.get(risk, 0) + 1
                if risk in years_by_risk:
                    years_by_risk[risk].append(yr)
                records.append({
                    "year": yr,
                    "lst_celsius": val,
                    "heat_risk": risk
                })

            avg_st = round(float(sub_st[lst_col].mean()), 2)
            id_max = sub_st[lst_col].idxmax()
            id_min = sub_st[lst_col].idxmin()

            state_history[st] = {
                "state": st,
                "average_lst": avg_st,
                "highest_lst": {
                    "year": int(sub_st.loc[id_max, "Year"]),
                    "lst_celsius": round(float(sub_st.loc[id_max, lst_col]), 2)
                },
                "lowest_lst": {
                    "year": int(sub_st.loc[id_min, "Year"]),
                    "lst_celsius": round(float(sub_st.loc[id_min, lst_col]), 2)
                },
                "risk_counts": rc_st,
                "years_by_risk": years_by_risk,
                "yearly_data": records
            }

        idx_all_max = df[lst_col].idxmax()
        idx_all_min = df[lst_col].idxmin()
        warmest_yr = max(yearly_trend, key=lambda x: x["average_lst"])
        coolest_yr = min(yearly_trend, key=lambda x: x["average_lst"])
        overall_avg = round(float(df[lst_col].mean()), 2)

        overall_insights = {
            "overall_average_lst": overall_avg,
            "highest_record": {
                "state": str(df.loc[idx_all_max, "State"]).strip(),
                "year": int(df.loc[idx_all_max, "Year"]),
                "lst_celsius": round(float(df.loc[idx_all_max, lst_col]), 2)
            },
            "lowest_record": {
                "state": str(df.loc[idx_all_min, "State"]).strip(),
                "year": int(df.loc[idx_all_min, "Year"]),
                "lst_celsius": round(float(df.loc[idx_all_min, lst_col]), 2)
            },
            "warmest_year": warmest_yr,
            "coolest_year": coolest_yr,
            "total_records": len(df),
            "total_states": len(states)
        }

        comparison = None
        state_a_param = request.args.get("state_a")
        state_b_param = request.args.get("state_b")
        if state_a_param or state_b_param:
            sa = (state_a_param or "Tamil Nadu").strip()
            sb = (state_b_param or "Rajasthan").strip()
            if sa not in state_history:
                return jsonify({
                    "status": "error",
                    "error": f"State '{sa}' not found in dataset",
                    "available_states": states
                }), 400
            if sb not in state_history:
                return jsonify({
                    "status": "error",
                    "error": f"State '{sb}' not found in dataset",
                    "available_states": states
                }), 400

            comp_chart = []
            for y in years:
                val_a = next((d["lst_celsius"] for d in state_history[sa]["yearly_data"] if d["year"] == y), None)
                val_b = next((d["lst_celsius"] for d in state_history[sb]["yearly_data"] if d["year"] == y), None)
                comp_chart.append({
                    "year": y,
                    sa: val_a,
                    sb: val_b
                })
            comparison = {
                "state_a": state_history[sa],
                "state_b": state_history[sb],
                "chart_data": comp_chart
            }

        single_state_analysis = None
        state_param = request.args.get("state")
        if state_param:
            st_clean = state_param.strip()
            if st_clean not in state_history:
                return jsonify({
                    "status": "error",
                    "error": f"State '{st_clean}' not found in dataset",
                    "available_states": states
                }), 400
            single_state_analysis = state_history[st_clean]

        return jsonify({
            "status": "success",
            "selected_year": selected_year,
            "available_years": AVAILABLE_INDIA_LST_YEARS,
            "available_states": states,
            "yearly_trend": yearly_trend,
            "by_year": by_year,
            "risk_distribution_by_year": risk_distribution_by_year,
            "state_history": state_history,
            "overall_insights": overall_insights,
            "selected_year_analysis": by_year[selected_year],
            "comparison": comparison,
            "single_state_analysis": single_state_analysis,
            "source_info": {
                "dataset_name": "India LST dataset 2020–2025",
                "temperature_type": "Land Surface Temperature (LST)",
                "note": "Temperature represents Land Surface Temperature (LST), not standard air temperature."
            }
        }), 200

    except Exception as exc:
        logger.error("Failed to generate heat analysis: %s", exc)
        return jsonify({
            "status": "error",
            "error": "Failed to generate heat analysis",
            "details": str(exc)
        }), 500


@app.route("/heat-2026-prediction", methods=["GET"])
def get_heat_2026_prediction():
    """
    Endpoint for 2026 India Land Surface Temperature (LST) predictions.
    Uses historical 2020-2025 observations and Linear Regression modeling.
    Optional query parameter:
      - state: str (filter by specific state/UT)
    Returns:
      JSON response with state-wise 2026 estimates, predicted risk tiers,
      national summary, top hotspots, model metadata, and limitation disclosures.
    """
    try:
        from heat_2026_prediction import get_all_2026_predictions
        data = get_all_2026_predictions()
        requested_state = request.args.get("state")

        if requested_state:
            query = requested_state.strip()
            matched = next(
                (p for p in data["states"] if p["state"].casefold() == query.casefold()),
                None
            )
            if not matched:
                available_state_names = [p["state"] for p in data["states"]]
                return jsonify({
                    "status": "error",
                    "error": f"State '{requested_state}' not found in 2026 predictions dataset.",
                    "available_states": available_state_names
                }), 404

            return jsonify({
                "status": "success",
                "prediction_year": data["prediction_year"],
                "state": matched,
                "summary": data["summary"],
                "model_info": data["model_info"],
                "limitations": data["limitations"]
            }), 200

        return jsonify(data), 200

    except Exception as exc:
        logger.error("Failed to generate 2026 heat predictions: %s", exc)
        return jsonify({
            "status": "error",
            "error": "Failed to generate 2026 heat predictions",
            "details": str(exc)
        }), 500


@app.route("/enso-analysis", methods=["GET"])
def get_enso_analysis():
    """
    Endpoint for ENSO / Oceanic Niño Index (ONI) Analysis & Integration.
    Combines authentic NOAA CPC ONI data with 2020-2025 India LST observations.
    Optional query parameter:
      - year: int (2020-2025, highlight specific annual comparison)
    Returns:
      JSON response with latest ENSO status, ONI trend time-series,
      ENSO vs India LST comparison table, phase aggregates, correlation,
      and scientific disclosures.
    """
    try:
        from enso_analysis import get_full_enso_analysis
        data = get_full_enso_analysis()
        year_param = request.args.get("year")

        if year_param:
            try:
                yr_int = int(year_param.strip())
            except ValueError:
                return jsonify({
                    "status": "error",
                    "error": "Invalid year parameter format",
                    "available_years": [r["year"] for r in data["comparison_table"]]
                }), 400

            matched_row = next(
                (r for r in data["comparison_table"] if r["year"] == yr_int),
                None
            )
            if not matched_row:
                return jsonify({
                    "status": "error",
                    "error": f"Year {yr_int} not found in comparison dataset",
                    "available_years": [r["year"] for r in data["comparison_table"]]
                }), 404

            return jsonify({
                "status": "success",
                "selected_year": yr_int,
                "yearly_record": matched_row,
                "latest_status": data["latest_status"],
                "phase_comparison": data["phase_comparison"],
                "correlation": data["correlation"],
                "insights": data["insights"],
                "limitations": data["limitations"],
                "source_info": data["source_info"]
            }), 200

        return jsonify(data), 200

    except Exception as exc:
        logger.error("Failed to generate ENSO analysis: %s", exc)
        return jsonify({
            "status": "error",
            "error": "Failed to generate ENSO analysis",
            "details": str(exc)
        }), 500



@app.route("/email-alert/test", methods=["POST"])
def email_alert_test():
    """
    POST /email-alert/test
    Accepts: { "email": str, "location": str, "threshold": str (optional) }
    Validates email format, checks SMTP configuration, sends a test heat alert.
    Returns: success/failure status and alert details.
    """
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip()
        location = (data.get("location") or data.get("state") or "Tamil Nadu").strip() or "Tamil Nadu"
        raw_thresh = data.get("threshold") or "Medium"
        threshold = str(raw_thresh).strip().capitalize()
        if threshold not in VALID_THRESHOLDS:
            threshold = "Medium"

        if not email:
            return jsonify({"success": False, "error": "Email address is required."}), 400

        if not is_valid_alert_email(email):
            return jsonify({"success": False, "error": "Please enter a valid email address."}), 400

        if not is_smtp_configured():
            logger.info("Test alert requested without SMTP configuration.")
            return jsonify({
                "success": False,
                "error": "Email service is not configured.",
                "message": "Email service is not configured.",
                "is_smtp_configured": False
            }), 503

        success, message, alert_details = send_heat_alert_email(
            to_email=email,
            location=location,
            threshold=threshold,
            is_test=True
        )

        if not success:
            return jsonify({"success": False, "error": message}), 500

        return jsonify({
            "success": True,
            "message": f"Test alert email sent successfully to {email}.",
            "alert_details": alert_details
        }), 200

    except Exception as exc:
        logger.error("Error in /email-alert/test: %s", exc)
        return jsonify({"success": False, "error": "Failed to send test alert email.", "details": str(exc)}), 500


@app.route("/email-alert/config", methods=["GET", "POST"])
def email_alert_config():
    """
    GET /email-alert/config - Returns current non-sensitive configuration
    POST /email-alert/config - Saves/validates alert configuration without storing passwords/secrets
    """
    if request.method == "POST":
        try:
            data = request.get_json(silent=True) or {}
            success, message, updated_config = save_alert_config(data)
            if not success:
                return jsonify({"success": False, "error": message}), 400
            return jsonify({
                "success": True,
                "message": message,
                "config": updated_config
            }), 200
        except Exception as exc:
            logger.error("Error in POST /email-alert/config: %s", exc)
            return jsonify({"success": False, "error": "Failed to save alert configuration.", "details": str(exc)}), 500

    # GET method
    try:
        config_status = get_alert_config_status()
        return jsonify({
            "success": True,
            "configured": config_status.get("configured", False),
            "config": config_status,
            "is_smtp_configured": config_status.get("is_smtp_configured", False),
            "smtp_status_message": config_status.get("smtp_status_message", "Email service is not configured.")
        }), 200
    except Exception as exc:
        logger.error("Error in GET /email-alert/config: %s", exc)
        return jsonify({"success": False, "error": "Failed to load alert configuration.", "details": str(exc)}), 500


@app.route("/emergency-info", methods=["GET"])
def emergency_info():
    """
    GET /emergency-info
    Returns verified official emergency contacts, location-based heat risk status,
    and disaster safety guidance without storing or tracking private user location.
    Optional query parameters:
      - location / city / state: str
      - lat: float
      - lon: float
    """
    try:
        location_param = request.args.get("location") or request.args.get("city") or request.args.get("state")
        lat_param = request.args.get("lat")
        lon_param = request.args.get("lon")

        data = get_emergency_info(
            location_query=location_param,
            lat=lat_param,
            lon=lon_param
        )
        return jsonify(data), 200
    except Exception as exc:
        logger.error("Error in /emergency-info: %s", exc)
        return jsonify({
            "status": "error",
            "error": "Failed to retrieve emergency information",
            "details": str(exc)
        }), 500


if __name__ == "__main__":
    # Run Flask server on localhost:5000
    app.run(debug=True, host="127.0.0.1", port=5000)
