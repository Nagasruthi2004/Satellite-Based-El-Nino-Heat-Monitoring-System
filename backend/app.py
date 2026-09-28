"""
Flask backend server for weather, satellite, and heat prediction data
Provides weather, satellite monitoring, and ML-based heat prediction endpoints
"""
try:
    from research_generator import generate_research
except ImportError:
    generate_research = None

import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from weather import fetch_weather
from satellite import get_satellite_data, get_satellite_alert
from heat_prediction import predict_heat_risk, get_prediction_explanation
from heat_risk import classify_current_heat_risk, classify_forecast_heat_risk
from email_service import send_heat_alert_subscription_email, is_valid_email

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
    resources={r"/*": {"origins": ["http://127.0.0.1:5173", "http://localhost:5173", "http://localhost:3000"]}},
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
            "/predict": "GET/POST - ML-based heat risk prediction"
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


if __name__ == "__main__":
    # Run Flask server on localhost:5000
    app.run(debug=True, host="127.0.0.1", port=5000)
