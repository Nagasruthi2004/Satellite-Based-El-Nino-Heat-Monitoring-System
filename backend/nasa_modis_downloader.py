"""
NASA MODIS Terra MOD11A2.061 Direct LST Data Extraction Module
==============================================================

Directly interfaces with NASA's official Earthdata & AppEEARS API
without Google Cloud or Google Earth Engine.

Dataset: NASA MODIS Terra MOD11A2.061 (8-day composite, 1km resolution)
Layer: LST_Day_1km
Scale Factor: 0.02
Units: Kelvin -> Celsius ((raw * 0.02) - 273.15)

Target Output Schema:
    location,country,latitude,longitude,year,lst_celsius,heat_risk

Authentication:
    Free NASA Earthdata Login (EDL): https://urs.earthdata.nasa.gov/
"""

import os
import sys
import json
import logging
from datetime import datetime
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("NASA_MODIS_LST")

# NASA Endpoints
APPEEARS_API_BASE = "https://appeears.earthdatacloud.nasa.gov/api"
CMR_SEARCH_API = "https://cmr.earthdata.nasa.gov/search/granules.json"
MODIS_PRODUCT = "MOD11A2.061"
MODIS_LAYER = "LST_Day_1km"
SCALE_FACTOR = 0.02
KELVIN_OFFSET = 273.15

# Default Target CSV Path
DEFAULT_OUTPUT_CSV = os.path.join(
    os.path.dirname(__file__), "..", "dataset", "world_heat_map_dataset.csv"
)

# Standard World Monitoring Locations
STANDARD_LOCATIONS = [
    # India
    {"location": "Chennai", "country": "India", "latitude": 13.0827, "longitude": 80.2707},
    {"location": "Coimbatore", "country": "India", "latitude": 11.0168, "longitude": 76.9558},
    {"location": "Bengaluru", "country": "India", "latitude": 12.9716, "longitude": 77.5946},
    {"location": "Delhi", "country": "India", "latitude": 28.6139, "longitude": 77.2090},
    {"location": "Mumbai", "country": "India", "latitude": 19.0760, "longitude": 72.8777},

    # Asia & Middle East
    {"location": "Dubai", "country": "United Arab Emirates", "latitude": 25.2048, "longitude": 55.2708},
    {"location": "Riyadh", "country": "Saudi Arabia", "latitude": 24.7136, "longitude": 46.6753},
    {"location": "Muscat", "country": "Oman", "latitude": 23.5880, "longitude": 58.3829},
    {"location": "Cairo", "country": "Egypt", "latitude": 30.0444, "longitude": 31.2357},
    {"location": "Tokyo", "country": "Japan", "latitude": 35.6762, "longitude": 139.6503},
    {"location": "Singapore", "country": "Singapore", "latitude": 1.3521, "longitude": 103.8198},

    # Europe & Americas
    {"location": "London", "country": "United Kingdom", "latitude": 51.5074, "longitude": -0.1278},
    {"location": "Paris", "country": "France", "latitude": 48.8566, "longitude": 2.3522},
    {"location": "Madrid", "country": "Spain", "latitude": 40.4168, "longitude": -3.7038},
    {"location": "New York", "country": "United States", "latitude": 40.7128, "longitude": -74.0060},
    {"location": "Phoenix", "country": "United States", "latitude": 33.4484, "longitude": -112.0740},
    {"location": "Sao Paulo", "country": "Brazil", "latitude": -23.5505, "longitude": -46.6333},
    {"location": "Sydney", "country": "Australia", "latitude": -33.8688, "longitude": 151.2093},
    {"location": "Nairobi", "country": "Kenya", "latitude": -1.2921, "longitude": 36.8219},
]


def classify_heat_risk(lst_celsius):
    """Classify LST into standardized heat risk tiers."""
    if lst_celsius is None:
        return "Unknown"
    if lst_celsius >= 43.0:
        return "Critical"
    if lst_celsius >= 37.0:
        return "High"
    if lst_celsius >= 30.0:
        return "Medium"
    return "Low"


def get_nasa_credentials():
    """Read NASA Earthdata credentials from environment variables."""
    username = os.getenv("EARTHDATA_USERNAME")
    password = os.getenv("EARTHDATA_PASSWORD")
    token = os.getenv("EARTHDATA_TOKEN")
    return {
        "username": username,
        "password": password,
        "token": token,
        "has_credentials": bool(token or (username and password)),
    }


def authenticate_nasa_appeears(username=None, password=None, token=None):
    """
    Authenticate against NASA AppEEARS API using Earthdata credentials.
    Returns: (success: bool, token_or_msg: str)
    """
    creds = get_nasa_credentials()
    user = username or creds["username"]
    pwd = password or creds["password"]
    direct_token = token or creds["token"]

    if direct_token:
        # Verify direct token
        headers = {"Authorization": f"Bearer {direct_token}"}
        try:
            resp = requests.get(f"{APPEEARS_API_BASE}/user", headers=headers, timeout=10)
            if resp.status_code == 200:
                logger.info("NASA Earthdata token verified successfully.")
                return True, direct_token
            return False, f"Direct token verification failed (HTTP {resp.status_code})"
        except Exception as e:
            return False, f"Connection error: {e}"

    if not user or not pwd:
        return False, (
            "NASA Earthdata credentials missing. Set EARTHDATA_USERNAME and "
            "EARTHDATA_PASSWORD in backend/.env"
        )

    login_url = f"{APPEEARS_API_BASE}/login"
    try:
        resp = requests.post(login_url, auth=(user, pwd), timeout=15)
        if resp.status_code == 200:
            token_val = resp.json().get("token")
            logger.info("Successfully authenticated with NASA Earthdata.")
            return True, token_val
        elif resp.status_code in (401, 403):
            return False, "Authentication failed: invalid Earthdata username or password."
        else:
            return False, f"NASA login returned HTTP {resp.status_code}: {resp.text}"
    except Exception as e:
        return False, f"Could not reach NASA Earthdata: {e}"


def check_nasa_api_status():
    """Verify connectivity to NASA's public product metadata endpoint (no login required)."""
    try:
        url = f"{APPEEARS_API_BASE}/product/{MODIS_PRODUCT}"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            layers = resp.json()
            lst_info = layers.get(MODIS_LAYER, {})
            return {
                "accessible": True,
                "product": MODIS_PRODUCT,
                "layer": MODIS_LAYER,
                "scale_factor": lst_info.get("ScaleFactor", SCALE_FACTOR),
                "units": lst_info.get("Units", "Kelvin"),
                "description": lst_info.get("Description", "Day Land Surface Temperature"),
            }
        return {"accessible": False, "status_code": resp.status_code}
    except Exception as e:
        return {"accessible": False, "error": str(e)}


def submit_appeears_point_sample(token, locations, start_date, end_date, task_name="world_lst_sample"):
    """
    Submit a point extraction task to NASA AppEEARS for exact MOD11A2.061 LST pixels.
    NASA processes the request server-side and outputs analysis-ready values.
    """
    coordinates = [
        {"id": f"{loc['location']}_{loc['country']}", "latitude": loc["latitude"], "longitude": loc["longitude"]}
        for loc in locations
    ]

    payload = {
        "task_type": "point",
        "task_name": task_name,
        "params": {
            "dates": [{"startDate": start_date, "endDate": end_date}],
            "layers": [{"product": MODIS_PRODUCT, "layer": MODIS_LAYER}],
            "coordinates": coordinates,
        },
    }

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    resp = requests.post(f"{APPEEARS_API_BASE}/task", headers=headers, json=payload, timeout=20)
    if resp.status_code in (200, 202):
        task_id = resp.json().get("task_id")
        logger.info("NASA extraction task submitted successfully. Task ID: %s", task_id)
        return {"success": True, "task_id": task_id}
    else:
        logger.error("Failed to submit NASA task: %s", resp.text)
        return {"success": False, "error": resp.text}


def prepare_setup_summary():
    """Print configuration and authentication status without downloading data."""
    creds = get_nasa_credentials()
    api_check = check_nasa_api_status()

    print("\n" + "=" * 65)
    print("NASA MODIS Terra MOD11A2.061 Direct LST Setup Status")
    print("=" * 65)
    print(f"  Target Dataset:       {MODIS_PRODUCT}")
    print(f"  Target Layer:         {MODIS_LAYER}")
    print(f"  NASA API Status:      {'Online & Verified' if api_check.get('accessible') else 'Unreachable'}")
    if api_check.get("accessible"):
        print(f"  Product Description:  {api_check.get('description')}")
        print(f"  Scale Factor:         {api_check.get('scale_factor')}")
        print(f"  Physical Units:       {api_check.get('units')}")
        print(f"  Conversion Formula:   LST_Celsius = (LST_Day_1km * 0.02) - 273.15")

    print("-" * 65)
    print("NASA Earthdata Credentials in Environment (.env):")
    print(f"  EARTHDATA_USERNAME:   {creds['username'] or 'Not set'}")
    print(f"  EARTHDATA_PASSWORD:   {'[Configured]' if creds['password'] else 'Not set'}")
    print(f"  EARTHDATA_TOKEN:      {'[Configured]' if creds['token'] else 'Not set'}")
    print(f"  Credentials Ready:    {creds['has_credentials']}")

    print("-" * 65)
    print("Target Output Schema:")
    print("  location,country,latitude,longitude,year,lst_celsius,heat_risk")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="NASA MODIS MOD11A2 LST Direct Downloader Setup")
    parser.add_argument("--status", action="store_true", help="Check NASA API and credential status")
    parser.add_argument("--test-auth", action="store_true", help="Test NASA Earthdata login authentication")

    args = parser.parse_args()

    if args.test_auth:
        ok, msg = authenticate_nasa_appeears()
        print(f"\nNASA Authentication Test Result: {'SUCCESS' if ok else 'FAILED'}")
        print(f"Details: {msg}\n")
    else:
        prepare_setup_summary()
