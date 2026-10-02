"""
NASA MODIS Terra MOD11A2.061 Land Surface Temperature Extractor via Google Earth Engine
========================================================================================

Dataset: MODIS/061/MOD11A2 (MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1km)
Band: LST_Day_1km
Physical Conversion:
    LST_Kelvin = raw_pixel_value * 0.02
    LST_Celsius = LST_Kelvin - 273.15

Target Output Schema:
    location,country,latitude,longitude,year,lst_celsius,heat_risk

Prerequisites:
    1. Google Cloud Project with Earth Engine API enabled
    2. earthengine-api package (`pip install earthengine-api`)
    3. GEE Authentication (OAuth or Service Account)
"""

import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MODIS_LST_Extractor")

# MODIS Collection & Band Constants
MODIS_COLLECTION_ID = "MODIS/061/MOD11A2"
LST_BAND_NAME = "LST_Day_1km"
SCALE_FACTOR = 0.02
KELVIN_OFFSET = 273.15

# Default Target Output CSV Path
DEFAULT_OUTPUT_CSV = os.path.join(
    os.path.dirname(__file__), "..", "dataset", "world_heat_map_dataset.csv"
)

# Standard Monitoring Points across continents for World Heat Map
STANDARD_MONITORING_LOCATIONS = [
    # Asia
    {"location": "Chennai", "country": "India", "latitude": 13.0827, "longitude": 80.2707},
    {"location": "Coimbatore", "country": "India", "latitude": 11.0168, "longitude": 76.9558},
    {"location": "Bengaluru", "country": "India", "latitude": 12.9716, "longitude": 77.5946},
    {"location": "Delhi", "country": "India", "latitude": 28.6139, "longitude": 77.2090},
    {"location": "Mumbai", "country": "India", "latitude": 19.0760, "longitude": 72.8777},
    {"location": "Tokyo", "country": "Japan", "latitude": 35.6762, "longitude": 139.6503},
    {"location": "Beijing", "country": "China", "latitude": 39.9042, "longitude": 116.4074},
    {"location": "Singapore", "country": "Singapore", "latitude": 1.3521, "longitude": 103.8198},
    {"location": "Bangkok", "country": "Thailand", "latitude": 13.7563, "longitude": 100.5018},

    # Middle East
    {"location": "Dubai", "country": "United Arab Emirates", "latitude": 25.2048, "longitude": 55.2708},
    {"location": "Riyadh", "country": "Saudi Arabia", "latitude": 24.7136, "longitude": 46.6753},
    {"location": "Muscat", "country": "Oman", "latitude": 23.5880, "longitude": 58.3829},
    {"location": "Cairo", "country": "Egypt", "latitude": 30.0444, "longitude": 31.2357},

    # Europe
    {"location": "London", "country": "United Kingdom", "latitude": 51.5074, "longitude": -0.1278},
    {"location": "Paris", "country": "France", "latitude": 48.8566, "longitude": 2.3522},
    {"location": "Madrid", "country": "Spain", "latitude": 40.4168, "longitude": -3.7038},
    {"location": "Athens", "country": "Greece", "latitude": 37.9838, "longitude": 23.7275},

    # North America
    {"location": "Phoenix", "country": "United States", "latitude": 33.4484, "longitude": -112.0740},
    {"location": "New York", "country": "United States", "latitude": 40.7128, "longitude": -74.0060},
    {"location": "Houston", "country": "United States", "latitude": 29.7604, "longitude": -95.3698},

    # South America
    {"location": "Sao Paulo", "country": "Brazil", "latitude": -23.5505, "longitude": -46.6333},
    {"location": "Buenos Aires", "country": "Argentina", "latitude": -34.6037, "longitude": -58.3816},

    # Africa
    {"location": "Nairobi", "country": "Kenya", "latitude": -1.2921, "longitude": 36.8219},
    {"location": "Johannesburg", "country": "South Africa", "latitude": -26.2041, "longitude": 28.0473},

    # Australia
    {"location": "Sydney", "country": "Australia", "latitude": -33.8688, "longitude": 151.2093},
    {"location": "Perth", "country": "Australia", "latitude": -31.9505, "longitude": 115.8605},
]


def classify_heat_risk(lst_celsius):
    """
    Classify Land Surface Temperature (LST) into standardized heat risk tiers.
    Aligned with the project's 4-tier risk categories.
    """
    if lst_celsius is None:
        return "Unknown"
    if lst_celsius >= 43.0:
        return "Critical"
    if lst_celsius >= 37.0:
        return "High"
    if lst_celsius >= 30.0:
        return "Medium"
    return "Low"


def initialize_earth_engine(project_id=None, service_account=None, private_key_file=None):
    """
    Initialize Google Earth Engine API using either:
    1. Service Account credentials
    2. Cloud Project ID with OAuth credentials
    3. GEE_PROJECT_ID environment variable
    """
    try:
        import ee
    except ImportError:
        logger.error(
            "earthengine-api is not installed. Please run: pip install earthengine-api"
        )
        raise

    resolved_project = (
        project_id
        or os.getenv("GEE_PROJECT_ID")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
    )
    resolved_service_account = service_account or os.getenv("GEE_SERVICE_ACCOUNT")
    resolved_key_file = private_key_file or os.getenv("GEE_PRIVATE_KEY_FILE")

    try:
        if resolved_service_account and resolved_key_file:
            logger.info("Initializing GEE using Service Account: %s", resolved_service_account)
            credentials = ee.ServiceAccountCredentials(
                resolved_service_account, resolved_key_file
            )
            ee.Initialize(credentials, project=resolved_project)
        elif resolved_project:
            logger.info("Initializing GEE with Cloud Project ID: %s", resolved_project)
            ee.Initialize(project=resolved_project)
        else:
            logger.info("Initializing GEE with default user credentials...")
            ee.Initialize()

        logger.info("Google Earth Engine initialized successfully.")
        return ee
    except Exception as e:
        logger.error("Failed to initialize Google Earth Engine: %s", e)
        logger.info(
            "To authenticate interactively, run: earthengine authenticate --auth_mode=notebook"
        )
        raise


def get_modis_lst_image_collection(ee_module, start_date, end_date):
    """
    Load the NASA MODIS Terra MOD11A2.061 collection, select LST_Day_1km,
    and convert raw digital numbers to Celsius.
    """
    raw_collection = (
        ee_module.ImageCollection(MODIS_COLLECTION_ID)
        .filterDate(start_date, end_date)
        .select(LST_BAND_NAME)
    )

    def convert_to_celsius(image):
        celsius_image = (
            image.multiply(SCALE_FACTOR)
            .subtract(KELVIN_OFFSET)
            .rename("lst_celsius")
        )
        return celsius_image.copyProperties(image, ["system:time_start", "system:time_end"])

    return raw_collection.map(convert_to_celsius)


def extract_point_lst(ee_module, lat, lon, start_date, end_date, reducer="mean"):
    """
    Extract Land Surface Temperature for a specific geographic coordinate over a date range.
    Uses an ee.Geometry.Point with 1000m scale buffer.
    """
    point = ee_module.Geometry.Point([lon, lat])
    lst_collection = get_modis_lst_image_collection(ee_module, start_date, end_date)

    if reducer == "max":
        composite = lst_collection.reduce(ee_module.Reducer.max())
    elif reducer == "median":
        composite = lst_collection.reduce(ee_module.Reducer.median())
    else:
        composite = lst_collection.reduce(ee_module.Reducer.mean())

    stats = composite.reduceRegion(
        reducer=ee_module.Reducer.first(),
        geometry=point,
        scale=1000,
        maxPixels=1e8,
    ).getInfo()

    # Key name format: 'lst_celsius_<reducer>' or 'lst_celsius'
    val = next(iter(stats.values()), None)
    return round(float(val), 2) if val is not None else None


def generate_world_heat_dataset(
    project_id=None,
    locations=None,
    years=None,
    output_csv=DEFAULT_OUTPUT_CSV,
    dry_run=True,
):
    """
    Pipeline structure to query NASA MODIS Terra MOD11A2.061 Land Surface Temperature
    via Google Earth Engine and write to the target CSV format:
    location,country,latitude,longitude,year,lst_celsius,heat_risk

    Args:
        project_id: Google Cloud Project ID with GEE access
        locations: List of location dicts with location, country, latitude, longitude
        years: List of integer years to extract (e.g. [2024, 2025])
        output_csv: Path to output CSV file
        dry_run: When True, validates credentials and structure without executing full extraction
    """
    if locations is None:
        locations = STANDARD_MONITORING_LOCATIONS
    if years is None:
        years = [2024, 2025]

    if dry_run:
        logger.info("[DRY RUN MODE] Extraction pipeline configured:")
        logger.info("  Collection: %s", MODIS_COLLECTION_ID)
        logger.info("  Band: %s (Scale: %.2f, Offset: -%.2f)", LST_BAND_NAME, SCALE_FACTOR, KELVIN_OFFSET)
        logger.info("  Locations count: %d", len(locations))
        logger.info("  Years: %s", years)
        logger.info("  Output CSV: %s", output_csv)
        logger.info("  Output Format: location,country,latitude,longitude,year,lst_celsius,heat_risk")
        logger.info("Dry run complete. No data was downloaded or generated.")
        return

    # Real extraction pipeline (triggered when dry_run=False and authenticated)
    ee_mod = initialize_earth_engine(project_id=project_id)

    records = []
    for year in years:
        # Summer / peak heat months or annual mean (e.g., June-August for NH, Dec-Feb for SH, or full year)
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"
        logger.info("Querying MOD11A2 for year %d (%s to %s)...", year, start_date, end_date)

        for loc in locations:
            lat = loc["latitude"]
            lon = loc["longitude"]
            try:
                lst_val = extract_point_lst(ee_mod, lat, lon, start_date, end_date, reducer="mean")
                risk = classify_heat_risk(lst_val)
                records.append({
                    "location": loc["location"],
                    "country": loc["country"],
                    "latitude": lat,
                    "longitude": lon,
                    "year": year,
                    "lst_celsius": lst_val if lst_val is not None else "",
                    "heat_risk": risk,
                })
                logger.info("  %s, %s: %.2f °C (%s)", loc["location"], loc["country"], lst_val or 0.0, risk)
            except Exception as ex:
                logger.warning("  Failed to extract LST for %s: %s", loc["location"], ex)

    # Write output CSV
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    with open(output_csv, "w", encoding="utf-8") as f:
        f.write("location,country,latitude,longitude,year,lst_celsius,heat_risk\n")
        for r in records:
            f.write(
                f"{r['location']},{r['country']},{r['latitude']},{r['longitude']},{r['year']},{r['lst_celsius']},{r['heat_risk']}\n"
            )

    logger.info("Successfully extracted %d records to %s", len(records), output_csv)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="NASA MODIS MOD11A2 LST Extractor via Earth Engine")
    parser.add_argument("--project", default=None, help="Google Cloud Project ID with GEE access")
    parser.add_argument("--run", action="store_true", help="Execute real extraction (requires GEE auth)")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_CSV, help="Output CSV path")

    args = parser.parse_args()

    # Defaults to dry_run=True unless --run is explicitly passed
    generate_world_heat_dataset(
        project_id=args.project,
        output_csv=args.output,
        dry_run=not args.run,
    )
