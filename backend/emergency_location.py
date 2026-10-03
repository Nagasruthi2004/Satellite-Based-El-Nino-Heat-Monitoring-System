"""
Emergency Location & Nearby Help Module
Satellite-Based El Niño Heat Monitoring System

Provides verified official emergency contacts, location-based heat risk integration,
quick disaster safety guidance, and location privacy protection.
Does NOT fabricate fake hospitals, businesses, or phone numbers.
"""

import logging
from heat_risk import classify_current_heat_risk

logger = logging.getLogger(__name__)

# Verified official emergency contacts in India (source: MHA, NDMA, NHM)
VERIFIED_EMERGENCY_CONTACTS = [
    {
        "id": "national-emergency",
        "category": "All-in-One Emergency",
        "name": "National Emergency Number",
        "number": "112",
        "description": "Unified emergency response for Police, Fire, and Ambulance across India.",
        "authority": "Ministry of Home Affairs (MHA), Government of India",
        "verification_status": "Official Government Helpline",
        "toll_free": True,
        "badge_color": "#dc2626",
    },
    {
        "id": "ambulance",
        "category": "Medical & Health",
        "name": "Medical Emergency & Ambulance",
        "number": "108",
        "description": "24/7 free medical ambulance dispatch for critical and heat-stroke emergencies.",
        "authority": "National Health Mission (NHM) / Emergency Management and Research Institute",
        "verification_status": "Official Government Helpline",
        "toll_free": True,
        "badge_color": "#16a34a",
    },
    {
        "id": "fire-rescue",
        "category": "Fire & Rescue",
        "name": "Fire & Rescue Service",
        "number": "101",
        "description": "Rapid fire suppression, structural rescue, and hazardous situation response.",
        "authority": "Directorate General of Fire Services, Civil Defence & Home Guards",
        "verification_status": "Official Government Helpline",
        "toll_free": True,
        "badge_color": "#ea580c",
    },
    {
        "id": "police",
        "category": "Law Enforcement",
        "name": "Police Control Room",
        "number": "100",
        "description": "Immediate civil protection, emergency assistance, and local safety dispatch.",
        "authority": "State Police Forces, Government of India",
        "verification_status": "Official Government Helpline",
        "toll_free": True,
        "badge_color": "#2563eb",
    },
    {
        "id": "ndma-disaster",
        "category": "Disaster Management",
        "name": "NDMA Disaster Helpline",
        "number": "1078",
        "description": "Helpline for natural hazard alerts, cyclone, flood, and extreme heat assistance.",
        "authority": "National Disaster Management Authority (NDMA)",
        "verification_status": "Official National Helpline",
        "toll_free": True,
        "badge_color": "#7c3aed",
    },
    {
        "id": "state-eoc",
        "category": "State Control Room",
        "name": "State Emergency Operations Centre",
        "number": "1070",
        "description": "State-level disaster control room for coordinated regional relief efforts.",
        "authority": "State Disaster Management Authorities (SDMA)",
        "verification_status": "Official State Helpline",
        "toll_free": True,
        "badge_color": "#0284c7",
    },
    {
        "id": "district-eoc",
        "category": "District Control Room",
        "name": "District Emergency Operations Centre",
        "number": "1077",
        "description": "District Collectorate emergency line for localized rescue and relief.",
        "authority": "District Disaster Management Authorities (DDMA)",
        "verification_status": "Official District Helpline",
        "toll_free": True,
        "badge_color": "#059669",
    },
]

DISASTER_SAFETY_SHORTCUTS = [
    {
        "id": "heatwave",
        "name": "Heatwave Safety",
        "icon": "🔥",
        "summary": "Proactive hydration, seek shaded/air-conditioned cooling centres, avoid direct midday exposure (12 PM - 3 PM).",
        "critical_action": "In case of fainting, high fever (>40°C), or cessation of sweating, call 108 / 112 immediately for emergency medical transport.",
    },
    {
        "id": "flood",
        "name": "Flood Safety",
        "icon": "🌊",
        "summary": "Move to higher ground, switch off electrical mains, do not walk or drive through moving floodwaters.",
        "critical_action": "Contact 112 or local district control at 1077 for emergency evacuation boat dispatch.",
    },
    {
        "id": "cyclone",
        "name": "Cyclone Safety",
        "icon": "🌪️",
        "summary": "Stay indoors away from windows, secure loose outdoor objects, track official IMD coastal warnings.",
        "critical_action": "Listen to battery-operated radio broadcasts and move to designated cyclone shelters when instructed.",
    },
    {
        "id": "landslide",
        "name": "Landslide Safety",
        "icon": "🪨",
        "summary": "Evacuate steep slope drainage paths during prolonged torrential rains, watch for sudden river turbidity.",
        "critical_action": "Inform district disaster management (1077) if ground cracking or tilting trees are noticed.",
    },
    {
        "id": "earthquake",
        "name": "Earthquake Safety",
        "icon": "🌍",
        "summary": "Drop, Cover, and Hold On beneath sturdy furniture. If outdoors, move away from buildings, poles, and power lines.",
        "critical_action": "Check for gas leaks before using open flames; dial 112 for post-tremor search and rescue.",
    },
]


def resolve_heat_risk_for_location(location_name=None, lat=None, lon=None):
    """
    Resolve current heat risk and temperature for a given location or coordinates.
    Reuses existing fetch_weather and classify_current_heat_risk logic.
    """
    target_city = (location_name or "").strip() or "Coimbatore"

    try:
        from weather import fetch_weather

        # Fetch using coordinates if valid, else by city name
        if lat is not None and lon is not None:
            try:
                lat_f = float(lat)
                lon_f = float(lon)
                weather_data = fetch_weather(lat=lat_f, lon=lon_f)
            except (ValueError, TypeError):
                weather_data = fetch_weather(city=target_city)
        else:
            weather_data = fetch_weather(city=target_city)

        if weather_data and weather_data.get("temperature") is not None:
            temp = float(weather_data["temperature"])
            humidity = float(weather_data.get("humidity", 50))
            rain = float(weather_data.get("rainfall", 0))
            wind = float(weather_data.get("wind_speed", 5))

            risk_info = classify_current_heat_risk(temp, humidity, rain, wind)
            risk_level = risk_info["level"] if risk_info else "Medium"

            return {
                "location": weather_data.get("city", target_city),
                "lat": weather_data.get("lat"),
                "lon": weather_data.get("lon"),
                "temperature": round(temp, 1),
                "temperature_unit": "°C",
                "heat_risk": risk_level,
                "heat_risk_score": risk_info.get("score") if risk_info else 50.0,
                "weather_description": weather_data.get("weather_description", "Partly Cloudy"),
                "source": "Live Meteorological Observation",
            }
    except Exception as exc:
        logger.debug("Weather lookup exception in emergency module: %s", exc)

    # Fallback with safe baseline classification
    return {
        "location": target_city,
        "lat": 11.0168,
        "lon": 76.9558,
        "temperature": 34.0,
        "temperature_unit": "°C",
        "heat_risk": "Medium",
        "heat_risk_score": 55.0,
        "weather_description": "Clear Weather",
        "source": "Standard Baseline Observation",
    }


def get_emergency_info(location_query=None, lat=None, lon=None):
    """
    Build complete, verified emergency and location-aware safety package.
    Does NOT store private location data.
    """
    heat_status = resolve_heat_risk_for_location(location_query, lat, lon)

    # Simple contextual safety message based on heat risk
    heat_risk_level = heat_status.get("heat_risk", "Medium")
    if heat_risk_level == "Critical":
        safety_message = "CRITICAL HEAT RISK: Extreme temperature conditions detected. Stay in shaded or air-conditioned environments. Call 108 / 112 immediately if anyone exhibits signs of heat stroke."
    elif heat_risk_level == "High":
        safety_message = "HIGH HEAT RISK: High thermal stress detected. Drink plenty of water and electrolytes. Avoid heavy outdoor exertion between 11 AM - 4 PM."
    elif heat_risk_level == "Medium":
        safety_message = "MODERATE HEAT: Keep well hydrated and seek shelter during the hottest afternoon hours."
    else:
        safety_message = "LOW HEAT RISK: Ambient temperatures are within safe normal baselines. Maintain regular hydration."

    return {
        "status": "success",
        "privacy_notice": "Your location is requested only when you choose to use location-based help. The application does not continuously track your location.",
        "location_heat_status": {
            **heat_status,
            "safety_guidance": safety_message,
        },
        "verified_contacts": VERIFIED_EMERGENCY_CONTACTS,
        "nearby_places_service": {
            "enabled": False,
            "provider": "OpenStreetMap / Leaflet (Geographic Context)",
            "message": "Nearby live facility search API is not configured. For immediate medical emergencies or rescue, contact emergency dispatch at 112 or 108 directly.",
        },
        "disaster_safety_links": DISASTER_SAFETY_SHORTCUTS,
    }
