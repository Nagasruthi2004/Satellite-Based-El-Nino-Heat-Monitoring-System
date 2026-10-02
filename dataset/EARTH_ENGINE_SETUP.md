# Google Earth Engine Setup Guide for NASA MODIS LST Extraction

This guide details how to obtain real Land Surface Temperature (LST) data from the **NASA MODIS Terra MOD11A2.061** dataset via Google Earth Engine (GEE) for the **World Heat Map** feature.

---

## 1. NASA Dataset Specifications

* **Collection ID:** `ee.ImageCollection("MODIS/061/MOD11A2")`
* **Dataset Name:** MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1km
* **Band Used:** `LST_Day_1km`
* **Scale Factor:** `0.02`
* **Physical Conversion Formula:**
  $$\text{LST}_{\text{Celsius}} = (\text{LST\_Day\_1km} \times 0.02) - 273.15$$

---

## 2. Target Output Schema

The extracted records are written to `dataset/world_heat_map_dataset.csv` with the following columns:

```csv
location,country,latitude,longitude,year,lst_celsius,heat_risk
```

* **`location`:** City or monitored area name (e.g., Chennai, Dubai, Tokyo, London, New York)
* **`country`:** Country name in English
* **`latitude`:** Geographic latitude (-90.0 to 90.0)
* **`longitude`:** Geographic longitude (-180.0 to 180.0)
* **`year`:** Observation year (e.g., 2024, 2025, 2026)
* **`lst_celsius`:** Land Surface Temperature in °C derived from MOD11A2
* **`heat_risk`:** Standardized 4-tier risk (`Low`, `Medium`, `High`, `Critical`)

---

## 3. Required Google Earth Engine Credentials & Access

To query Google Earth Engine, you need:

### Step 1: Register for Earth Engine Access
1. Visit [earthengine.google.com/signup](https://earthengine.google.com/signup/) with your Google Account.
2. Select your use case (Noncommercial / Research / Education is free).
3. Associate it with a Google Cloud Project (or create a new project, e.g., `ee-heat-monitor`).

### Step 2: Enable the Earth Engine API
In your [Google Cloud Console](https://console.cloud.google.com/):
1. Navigate to **APIs & Services > Library**.
2. Search for **Earth Engine API** (`earthengine.googleapis.com`).
3. Click **Enable**.

### Step 3: Install the Python Client Library
```bash
pip install earthengine-api
```

### Step 4: Authentication Options

#### Option A: Interactive User Authentication (Local Development)
Run in your terminal:
```bash
earthengine authenticate
```
Follow the browser prompt to log in and authorize access.

#### Option B: Service Account (Recommended for Server / Automated Pipelines)
1. In Cloud Console, go to **IAM & Admin > Service Accounts**.
2. Create a service account (e.g., `gee-service-account@your-project.iam.gserviceaccount.com`).
3. Assign the **Earth Engine Resource Viewer** (or User) role.
4. Generate a JSON private key and save it securely (e.g., `backend/gee-key.json`).
5. Add to `backend/.env`:
   ```env
   GEE_PROJECT_ID=your-cloud-project-id
   GEE_SERVICE_ACCOUNT=gee-service-account@your-project.iam.gserviceaccount.com
   GEE_PRIVATE_KEY_FILE=backend/gee-key.json
   ```

---

## 4. Running the Extractor

The extractor code is located in [`backend/modis_lst_extractor.py`](../backend/modis_lst_extractor.py).

### Dry Run (Verify Structure Without GEE Calls):
```bash
python backend/modis_lst_extractor.py
```

### Full Execution (Requires Authenticated GEE Access):
```bash
python backend/modis_lst_extractor.py --project your-cloud-project-id --run
```
