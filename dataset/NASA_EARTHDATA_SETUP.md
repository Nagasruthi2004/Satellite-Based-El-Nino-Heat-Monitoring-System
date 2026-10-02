# Direct NASA Earthdata Setup Guide for MODIS Terra MOD11A2.061 LST

This guide details how to access real Land Surface Temperature (LST) data directly from **NASA's official Earthdata & LP DAAC servers** without Google Cloud or Google Earth Engine.

---

## 1. NASA Dataset Information

* **Dataset ID:** `MOD11A2.061` (MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1km)
* **Layer/Band:** `LST_Day_1km`
* **Scale Factor:** `0.02`
* **Physical Units:** Kelvin
* **Conversion Formula:**
  $$\text{LST}_{\text{Celsius}} = (\text{LST\_Day\_1km} \times 0.02) - 273.15$$

---

## 2. NASA Credentials Required

Access to NASA Earth Science data is **100% free and open to everyone worldwide**, but requires a standard **NASA Earthdata Login (EDL)** account.

### Step 1: Create a Free NASA Earthdata Account
1. Go to the registration page: [https://urs.earthdata.nasa.gov/users/new](https://urs.earthdata.nasa.gov/users/new)
2. Fill out the form (Username, Password, Email, Affiliation) and submit.
3. Check your email to verify and activate your account.

### Step 2: Authorize Applications in Your Earthdata Profile
1. Log in to [https://urs.earthdata.nasa.gov/profile](https://urs.earthdata.nasa.gov/profile).
2. Go to **Applications > Authorized Apps**.
3. Ensure **"LP DAAC AppEEARS"** (or "NASA GESDISC DATA ARCHIVE" / "LP DAAC") is authorized (if not already listed, clicking "Approve More Applications" and searching for `AppEEARS` allows you to authorize it with one click).

### Step 3: Add Your Credentials to `backend/.env`
Open `backend/.env` and add:

```env
# NASA Earthdata Login Credentials
EARTHDATA_USERNAME=your_nasa_username
EARTHDATA_PASSWORD=your_nasa_password
```

*(Alternatively, you can generate a personal token from Earthdata Profile > Generate Token and set `EARTHDATA_TOKEN=your_token`)*

---

## 3. Verifying Your Setup

Once you have added your credentials to `backend/.env`, you can test authentication directly in PowerShell:

### Check Status (No Login Required):
```powershell
python backend/nasa_modis_downloader.py --status
```

### Test Authentication Against NASA's Server:
```powershell
python backend/nasa_modis_downloader.py --test-auth
```

---

## 4. Target Output Format

When extraction is triggered, data writes to `dataset/world_heat_map_dataset.csv`:
```csv
location,country,latitude,longitude,year,lst_celsius,heat_risk
```
