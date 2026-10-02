"""
Generate the first real World Heat Map dataset sample from NASA MODIS Terra MOD11A2.061.
Reads the validated LST_Day_1km GeoTIFF from dataset/modis_test/ and extracts real
un-interpolated observations for the India test-area coverage (Tile h25v07).
"""

import os
import math
import csv
import numpy as np
from PIL import Image

def generate_dataset():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tif_path = os.path.join(
        base_dir, "dataset", "modis_test", "MOD11A2.A2026225.h25v07.061.2026234035622_LST_Day_1km.tif"
    )
    output_csv = os.path.join(base_dir, "dataset", "world_heat_map_dataset.csv")

    if not os.path.exists(tif_path):
        raise FileNotFoundError(f"Source MODIS raster not found: {tif_path}")

    print(f"Reading source raster: {tif_path}")
    img = Image.open(tif_path)
    arr = np.array(img)

    # MODIS Sinusoidal Projection Constants for Tile h25v07
    R = 6371007.181
    x_ul = 7783653.638366
    y_ul = 2223901.039533
    dx = 926.6254331383334
    dy = 926.6254331383333

    def latlon_to_pixel(lat, lon):
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)
        x = R * lon_rad * math.cos(lat_rad)
        y = R * lat_rad
        c = (x - x_ul) / dx - 0.5
        r = (y_ul - y) / dy - 0.5
        return int(round(r)), int(round(c))

    # Standardized 4-tier Heat Risk Classification
    # Aligned with project categories (Low, Medium, High, Critical)
    # Thresholds:
    #   < 30.0 °C  : Low (Normal / comfortable)
    #   30.0-34.9 °C: Medium (Moderate heat)
    #   35.0-39.9 °C: High (High heat stress)
    #   >= 40.0 °C : Critical (Severe / dangerous heat)
    def classify_heat_risk(celsius):
        if celsius >= 40.0:
            return "Critical"
        if celsius >= 35.0:
            return "High"
        if celsius >= 30.0:
            return "Medium"
        return "Low"

    # Real geographical locations across the tile area (Southern & Central India)
    locations = [
        # Tamil Nadu
        ("Usilampatti North", 10.0208, 77.8417),
        ("Nilakottai", 10.1667, 77.8667),
        ("Theni", 10.0104, 77.4768),
        ("Bodinayakanur", 10.0104, 77.3486),
        ("Periyakulam", 10.1186, 77.5458),
        ("Palani", 10.4509, 77.5203),
        ("Dindigul", 10.3673, 77.9803),
        ("Udumalaipettai", 10.5843, 77.2483),
        ("Pollachi", 10.6575, 77.0082),
        ("Dharapuram", 10.7300, 77.5300),
        ("Tiruchirappalli", 10.7905, 78.7047),
        ("Thanjavur", 10.7870, 79.1378),
        ("Karur", 10.9601, 78.0766),
        ("Kumbakonam", 10.9602, 79.3845),
        ("Kangeyam", 11.0051, 77.5614),
        ("Coimbatore", 11.0168, 76.9558),
        ("Tiruppur", 11.1085, 77.3411),
        ("Ariyalur", 11.1401, 79.0786),
        ("Namakkal", 11.2189, 78.1674),
        ("Perambalur", 11.2333, 78.8833),
        ("Erode", 11.3410, 77.7172),
        ("Coonoor", 11.3530, 76.7959),
        ("Tiruchengode", 11.3800, 77.8900),
        ("Kotagiri", 11.4217, 76.8667),
        ("Bhavani", 11.4478, 77.6833),
        ("Gobichettipalayam", 11.4542, 77.4378),
        ("Rasipuram", 11.4646, 78.1772),
        ("Sankari", 11.4833, 77.8667),
        ("Sathyamangalam", 11.5042, 77.2386),
        ("Attur", 11.5977, 78.5967),
        ("Salem", 11.6643, 78.1460),
        ("Ulundurpet", 11.6833, 79.2833),
        ("Kallakurichi", 11.7381, 78.9639),
        ("Cuddalore", 11.7480, 79.7714),
        ("Mettur", 11.7962, 77.8000),
        ("Tirukkoyilur", 11.9567, 79.2000),
        ("Harur", 12.0620, 78.4900),
        ("Dharmapuri", 12.1211, 78.1582),
        ("Pennagaram", 12.1333, 77.9000),
        ("Tiruvannamalai", 12.2253, 79.0747),
        ("Uthangarai", 12.2600, 78.5300),
        ("Pochampalli", 12.3300, 78.3700),
        ("Melmaruvathur", 12.4333, 79.8333),
        ("Tirupathur", 12.4958, 78.5678),
        ("Polur", 12.5083, 79.1278),
        ("Madurantakam", 12.5090, 79.8850),
        ("Arani", 12.6686, 79.2839),
        ("Cheyyar", 12.6583, 79.5417),
        ("Chengalpattu", 12.6841, 79.9836),
        ("Ranipet", 12.9272, 79.3330),
        ("Vellore", 12.9165, 79.1325),

        # Karnataka
        ("Kollegal", 12.1500, 77.1167),
        ("Chamarajanagar", 11.9261, 76.9437),
        ("Mysuru", 12.2958, 76.6394),
        ("Hunsur", 12.3167, 76.2833),
        ("Malavalli", 12.3833, 77.0500),
        ("Srirangapatna", 12.4167, 76.7000),
        ("Pandavapura", 12.5000, 76.6667),
        ("Mandya", 12.5244, 76.8958),
        ("Maddur", 12.5833, 77.0500),
        ("Holenarasipura", 12.7833, 76.2500),
        ("Channarayapatna", 12.9000, 76.3833),
        ("Magadi", 12.9567, 77.2272),
        ("Malur", 13.0000, 77.9333),
        ("Kunigal", 13.0233, 77.0253),
        ("Nelamangala", 13.0983, 77.3872),
        ("Kolar", 13.1367, 78.1292),
        ("Tiptur", 13.2600, 76.4800),
        ("Chikkamagaluru", 13.3153, 75.7754),
        ("Gubbi", 13.3100, 76.9400),
        ("Tumakuru", 13.3422, 77.1017),
        ("Sidlaghatta", 13.3833, 77.8667),
        ("Chikkaballapur", 13.4355, 77.7275),
        ("Bagepalli", 13.7833, 77.7833),
        ("Hosadurga", 13.8000, 76.2833),
        ("Hiriyur", 13.9500, 76.6167),
        ("Holalkere", 14.0333, 76.1833),
        ("Pavagada", 14.1000, 77.2833),
        ("Challakere", 14.3167, 76.6500),

        # Andhra Pradesh
        ("Kuppam", 12.7500, 78.3700),
        ("Palamaner", 13.2000, 78.7500),
        ("Nagari", 13.3300, 79.5800),
        ("Punganur", 13.3667, 78.5833),
        ("Puttur", 13.4500, 79.5500),
        ("Madanapalle", 13.5560, 78.5010),
        ("Vayalpad", 13.6500, 78.6300),
        ("Srikalahasti", 13.7500, 79.7000),
        ("Gorantla", 13.9833, 77.7667),
        ("Rayachoti", 14.0500, 78.7500),
        ("Penukonda", 14.0833, 77.6000),
        ("Kadiri", 14.1167, 78.1667),
        ("Rajampet", 14.1932, 79.1584),
        ("Pulivendula", 14.4167, 78.2333),
        ("Yerraguntla", 14.6333, 78.5333),
        ("Mydukur", 14.7000, 78.6000),
        ("Badvel", 14.7500, 79.0500),
        ("Jammalamadugu", 14.8500, 78.3833),

        # Maharashtra
        ("Nanded", 19.1383, 77.3210),
    ]

    records = []
    seen = set()

    for loc, lat, lon in locations:
        if loc in seen:
            continue
        seen.add(loc)

        r, c = latlon_to_pixel(lat, lon)
        if 0 <= r < 1200 and 0 <= c < 1200:
            val = int(arr[r, c])
            # Exclude DN=0 / NoData / Cloud pixels
            if 7500 <= val <= 65535:
                # Official formula: LST_Celsius = (DN * 0.02) - 273.15
                celsius = round((val * 0.02) - 273.15, 2)
                risk = classify_heat_risk(celsius)
                records.append({
                    "location": loc,
                    "country": "India",
                    "latitude": round(lat, 4),
                    "longitude": round(lon, 4),
                    "year": 2026,
                    "lst_celsius": celsius,
                    "heat_risk": risk,
                    "raw_dn": val
                })

    # Sort deterministically by state/latitude descending
    records.sort(key=lambda x: -x["latitude"])

    print(f"Total valid real records extracted: {len(records)}")

    # Write to target CSV: dataset/world_heat_map_dataset.csv
    fieldnames = ["location", "country", "latitude", "longitude", "year", "lst_celsius", "heat_risk"]
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rec in records:
            writer.writerow({
                "location": rec["location"],
                "country": rec["country"],
                "latitude": rec["latitude"],
                "longitude": rec["longitude"],
                "year": rec["year"],
                "lst_celsius": rec["lst_celsius"],
                "heat_risk": rec["heat_risk"]
            })

    print(f"Generated CSV file: {output_csv} ({os.path.getsize(output_csv):,} bytes)")

    # Compute breakdown and coverage
    lats = [r["latitude"] for r in records]
    lons = [r["longitude"] for r in records]
    temps = [r["lst_celsius"] for r in records]
    risks = {}
    for r in records:
        risks[r["heat_risk"]] = risks.get(r["heat_risk"], 0) + 1

    print("\n--- DATASET SUMMARY ---")
    print(f"Record Count: {len(records)}")
    print(f"Geographic Coverage: Latitudes {min(lats):.4f}°N to {max(lats):.4f}°N, Longitudes {min(lons):.4f}°E to {max(lons):.4f}°E")
    print(f"Temperature Range: {min(temps):.2f}°C to {max(temps):.2f}°C (Mean: {np.mean(temps):.2f}°C)")
    print(f"Risk Breakdown: {risks}")

if __name__ == "__main__":
    generate_dataset()
