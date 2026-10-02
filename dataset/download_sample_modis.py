"""
Download and verify ONE small real sample from NASA MODIS Terra MOD11A2.061.
Stores raw data in dataset/modis_test/ and verifies LST conversion to Celsius.
"""

import os
import json
import requests
import numpy as np
from PIL import Image

def download_sample():
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset", "modis_test")
    os.makedirs(output_dir, exist_ok=True)
    print(f"Output directory: {output_dir}")

    # Official NASA MODIS Terra MOD11A2.061 Granule Metadata
    granule_id = "MOD11A2.A2026225.h25v07.061.2026234035622"
    date_range = {
        "start": "2026-08-13T00:00:00Z",
        "end": "2026-08-20T23:59:59Z",
        "composite": "8-day composite (Day of Year 225-232)"
    }
    geographic_area = {
        "modis_tile": "h25v07",
        "region_description": "Southern and Central India (Tamil Nadu, Karnataka, Andhra Pradesh, Telangana, Maharashtra)",
        "bounding_box_wgs84": {
            "min_longitude": 71.08,
            "min_latitude": 10.0,
            "max_longitude": 85.13,
            "max_latitude": 20.0
        }
    }

    # URLs
    base_blob_url = "https://modiseuwest.blob.core.windows.net/modis-061-cogs/MOD11A2/25/07/2026225/MOD11A2.A2026225.h25v07.061.2026234035622_LST_Day_1km.tif"
    hdf_blob_url = "https://modiseuwest.blob.core.windows.net/modis-061/MOD11A2/25/07/2026225/MOD11A2.A2026225.h25v07.061.2026234035622.hdf"

    # Sign URLs via Planetary Computer SAS endpoint
    print("Signing asset URLs...")
    sign_api = "https://planetarycomputer.microsoft.com/api/sas/v1/sign?href="
    
    # 1. Download LST_Day_1km GeoTIFF
    tif_filename = f"{granule_id}_LST_Day_1km.tif"
    tif_dest = os.path.join(output_dir, tif_filename)
    
    if not os.path.exists(tif_dest) or os.path.getsize(tif_dest) == 0:
        print(f"Downloading raw LST band raster: {tif_filename}...")
        signed_tif_url = requests.get(sign_api + base_blob_url).json()["href"]
        r = requests.get(signed_tif_url, stream=True)
        r.raise_for_status()
        with open(tif_dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)
        print(f"Saved: {tif_dest} ({os.path.getsize(tif_dest):,} bytes)")
    else:
        print(f"Already exists: {tif_dest} ({os.path.getsize(tif_dest):,} bytes)")

    # 2. Verify and extract real LST values
    print("Reading raster data and applying physical LST conversion...")
    img = Image.open(tif_dest)
    arr = np.array(img)
    
    # According to NASA MOD11A2.061 specification:
    # Scale factor = 0.02
    # Units = Kelvin
    # Valid range = 7500 to 65535 (150.0 K to 1310.7 K)
    # 0 = Fill value (unobserved, cloud covered, or water)
    valid_mask = (arr >= 7500) & (arr <= 65535)
    valid_count = int(np.sum(valid_mask))
    total_pixels = int(arr.size)

    raw_min = int(np.min(arr[valid_mask]))
    raw_max = int(np.max(arr[valid_mask]))
    raw_mean = float(np.mean(arr[valid_mask]))

    # Convert to Kelvin and Celsius
    kelvin_min = raw_min * 0.02
    kelvin_max = raw_max * 0.02
    kelvin_mean = raw_mean * 0.02

    celsius_min = kelvin_min - 273.15
    celsius_max = kelvin_max - 273.15
    celsius_mean = kelvin_mean - 273.15

    # Sample specific location pixels (e.g. coordinates in Tamil Nadu / Karnataka / Andhra Pradesh)
    # Sinusoidal grid 1200 x 1200
    sample_pixels = []
    # Pick a few sample valid pixels across the grid
    rows, cols = np.where(valid_mask)
    step = len(rows) // 5 if len(rows) > 5 else 1
    for i in range(0, min(len(rows), step * 5), step):
        r_idx = int(rows[i])
        c_idx = int(cols[i])
        raw_val = int(arr[r_idx, c_idx])
        k_val = raw_val * 0.02
        c_val = k_val - 273.15
        
        # Risk classification
        if c_val >= 40:
            risk = "Critical"
        elif c_val >= 35:
            risk = "High"
        elif c_val >= 30:
            risk = "Medium"
        else:
            risk = "Low"
            
        sample_pixels.append({
            "pixel_grid_row": r_idx,
            "pixel_grid_col": c_idx,
            "raw_dn": raw_val,
            "lst_kelvin": round(k_val, 2),
            "lst_celsius": round(c_val, 2),
            "heat_risk": risk
        })

    # Save metadata summary inside dataset/modis_test/
    summary = {
        "dataset": "MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1km SIN Grid V061",
        "product_short_name": "MOD11A2",
        "version": "061",
        "platform": "Terra",
        "instrument": "MODIS",
        "granule_id": granule_id,
        "date_range": date_range,
        "geographic_area": geographic_area,
        "source_urls": {
            "source_geotiff_cog": base_blob_url,
            "source_hdf": hdf_blob_url,
            "planetary_computer_stac": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/modis-11A2-061",
            "nasa_cmr": "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MOD11A2&version=061"
        },
        "downloaded_files": [
            {
                "file_name": tif_filename,
                "file_path": tif_dest,
                "file_size_bytes": os.path.getsize(tif_dest),
                "format": "Cloud-Optimized GeoTIFF (16-bit Grayscale uint16)",
                "band": "LST_Day_1km",
                "dimensions": [int(arr.shape[0]), int(arr.shape[1])]
            }
        ],
        "lst_conversion": {
            "raw_band": "LST_Day_1km",
            "scale_factor": 0.02,
            "formula_kelvin": "LST_Kelvin = raw_dn * 0.02",
            "formula_celsius": "LST_Celsius = (raw_dn * 0.02) - 273.15",
            "valid_raw_range": "7500 to 65535",
            "fill_value": 0
        },
        "granule_statistics": {
            "total_pixels": total_pixels,
            "valid_observed_pixels": valid_count,
            "raw_dn_min": raw_min,
            "raw_dn_max": raw_max,
            "raw_dn_mean": round(raw_mean, 2),
            "lst_celsius_min": round(celsius_min, 2),
            "lst_celsius_max": round(celsius_max, 2),
            "lst_celsius_mean": round(celsius_mean, 2)
        },
        "sample_extracted_observations": sample_pixels
    }

    summary_file = os.path.join(output_dir, "sample_metadata.json")
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved metadata summary: {summary_file}")

    print("\n--- SAMPLE TEST COMPLETE ---")
    print(f"File Name: {tif_filename}")
    print(f"Date Range: {date_range['start']} to {date_range['end']}")
    print(f"Area: Tile {geographic_area['modis_tile']} ({geographic_area['region_description']})")
    print(f"Valid Pixels: {valid_count:,} / {total_pixels:,}")
    print(f"LST Celsius Range: {celsius_min:.2f} deg C to {celsius_max:.2f} deg C (Mean: {celsius_mean:.2f} deg C)")
    print(f"Sample Converted Pixels: {sample_pixels}")

if __name__ == "__main__":
    download_sample()
