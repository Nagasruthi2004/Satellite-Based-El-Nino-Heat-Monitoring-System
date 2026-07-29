from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

try:
    from weather import fetch_weather
except ImportError:  # pragma: no cover - supports package-style imports
    from .weather import fetch_weather

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to Satellite-Based El Niño Heat Monitoring System Backend!"
    }


@app.get("/weather")
def weather():
    weather_data = fetch_weather("Coimbatore")

    if weather_data:
        return weather_data

    raise HTTPException(status_code=503, detail="Unable to fetch weather data")