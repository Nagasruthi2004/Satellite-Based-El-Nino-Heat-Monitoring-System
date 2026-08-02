"""
Flask backend server for weather, satellite, and heat prediction data
Provides weather, satellite monitoring, and ML-based heat prediction endpoints
"""
from research_generator import generate_research
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from weather import fetch_weather
from satellite import get_satellite_data, get_satellite_alert
from heat_prediction import predict_heat_risk, get_prediction_explanation

# Configure logging so weather.py logger output is visible in the Flask console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

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
    city = request.args.get("city", "Coimbatore").strip()
    logger.info("/weather called | city=%s", city)
    weather_data = fetch_weather(city)

    if weather_data is None:
        logger.error("/weather failed | city=%s | fetch_weather returned None", city)
        return jsonify({"error": "Unable to fetch weather", "city": city}), 500

    # Replace rule-based heat_risk with ML prediction
    ml_result = predict_heat_risk(
        temperature=weather_data["temperature"],
        humidity=weather_data["humidity"],
        rainfall=weather_data["rainfall"],
        wind_speed=weather_data["wind_speed"]
    )
    explanation = get_prediction_explanation(ml_result)

    weather_data["heat_risk"]            = ml_result["predicted_risk"]
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
        satellite_data = get_satellite_data(location="Coimbatore")
        alert_data = get_satellite_alert(location="Coimbatore")
        
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


@app.route("/forecast", methods=["GET"])
def get_forecast():
    """
    Returns a 5-day daily average temperature forecast for a city.
    Calls the OpenWeather 5-day/3-hour forecast API and averages readings per day.
    Query parameter: city (default: Coimbatore)
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
        entries = resp.json().get("list", [])
    except requests.exceptions.RequestException as err:
        logger.error("Forecast fetch failed | city=%s | error=%s", city, err)
        return jsonify({"error": "Unable to fetch forecast"}), 500

    # Group 3-hour readings by date and average the temperature
    from collections import defaultdict
    daily = defaultdict(list)
    for entry in entries:
        date = entry["dt_txt"].split(" ")[0]   # "YYYY-MM-DD"
        daily[date].append(entry["main"]["temp"])

    forecast = [
        {"day": f"Day {i + 1}", "temperature": round(sum(temps) / len(temps), 1)}
        for i, (_, temps) in enumerate(sorted(daily.items())[:5])
    ]

    return jsonify({"city": city, "forecast": forecast}), 200


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
            "heat_risk":   ml["predicted_risk"],
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

    data = request.json

    result = generate_research(
        data["city"],
        data["temperature"],
        data["humidity"],
        data["rainfall"],
        data["wind_speed"],
        data["heat_risk"]
    )

    return jsonify({
        "research": result
    })

if __name__ == "__main__":
    # Run Flask server on localhost:5000
    app.run(debug=True, host="127.0.0.1", port=5000)
