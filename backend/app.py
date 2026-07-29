"""
Flask backend server for weather, satellite, and heat prediction data
Provides weather, satellite monitoring, and ML-based heat prediction endpoints
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from weather import fetch_weather
from satellite import get_satellite_data, get_satellite_alert
from heat_prediction import predict_heat_risk, get_prediction_explanation

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
    Endpoint to fetch weather data for Coimbatore
    Returns: JSON response with temperature, humidity, etc.
    """
    weather_data = fetch_weather(city="Coimbatore")
    
    if weather_data:
        return jsonify(weather_data), 200
    else:
        return jsonify({
            "error": "Failed to fetch weather data"
        }), 500


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


if __name__ == "__main__":
    # Run Flask server on localhost:5000
    app.run(debug=True, host="127.0.0.1", port=5000)
