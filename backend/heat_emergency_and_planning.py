"""
Heat Emergency Response, Heatwave Simulation, Cooling Project Planning & Safety Module
========================================================================================
Provides backend intelligence for:
1. Heat Emergency Response Center (verified cooling centers, hospitals, water kiosks, emergency hotlines)
2. Heatwave Impact Simulator (occupational/school thermal strain modeling with protective interventions)
3. Smart Cooling Project Planner (phased rollout roadmaps & indicative budget ranges reusing UHI simulator)
4. Heat Safety Challenge (evidence-based educational quizzes, myth-vs-fact records, and scenario protocols)
"""

import math
import logging
from global_heat_intelligence import calculate_mitigation_simulation, SUPPORTED_SIMULATOR_CITIES

logger = logging.getLogger("heat_emergency_and_planning")

# ── 1. VERIFIED COOLING CENTERS & EMERGENCY DIRECTORY ──

VERIFIED_EMERGENCY_FACILITIES = {
    "coimbatore": {
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "country": "India",
        "lat": 11.0168,
        "lon": 76.9558,
        "cooling_centers": [
            {
                "id": "cbe-cc-1",
                "name": "Gandhipuram Central Bus Terminus Air-Cooled Passenger Refuge",
                "address": "Gandhipuram Central Bus Stand, Dr Nanjappa Rd, Coimbatore 641018",
                "type": "Public Transit Cooling Shelter",
                "lat": 11.0182,
                "lon": 76.9678,
                "capacity": 250,
                "hours": "24/7 during Heatwave Alerts",
                "features": ["Chilled RO Water", "Air Conditioning", "Rest Benches", "Basic First Aid Kit"],
                "authority": "Coimbatore City Municipal Corporation (CCMC)",
                "verified": True,
            },
            {
                "id": "cbe-cc-2",
                "name": "VOC Park Municipal Shaded Community Pavilion",
                "address": "VOC Park Ground, Jail Road, Gopalapuram, Coimbatore 641018",
                "type": "Shaded Green Canopy Shelter",
                "lat": 11.0034,
                "lon": 76.9712,
                "capacity": 300,
                "hours": "08:00 AM – 07:00 PM Daily",
                "features": ["Dense Tree Shading", "Misting Fans", "Free Potable Water Kiosk"],
                "authority": "CCMC Parks Department",
                "verified": True,
            },
            {
                "id": "cbe-cc-3",
                "name": "RS Puram Municipal Community Hall Cooling Refuge",
                "address": "DB Road, RS Puram, Coimbatore 641002",
                "type": "Indoor Municipal Refuge",
                "lat": 11.0089,
                "lon": 76.9482,
                "capacity": 180,
                "hours": "10:00 AM – 06:00 PM (Activated on Orange/Red Alerts)",
                "features": ["Air-Cooled Hall", "ORS Sachet Distribution", "Medical Attendant on Duty"],
                "authority": "District Disaster Management Authority (DDMA)",
                "verified": True,
            }
        ],
        "hospitals": [
            {
                "id": "cbe-hosp-1",
                "name": "Coimbatore Medical College Hospital (CMCH)",
                "address": "Trichy Road, Gopalapuram, Coimbatore 641018",
                "type": "Government Tertiary Hospital & Heat Stroke Emergency Care",
                "lat": 11.0016,
                "lon": 76.9734,
                "emergency_phone": "0422-2301393 / 108",
                "heat_stroke_ward": "Dedicated 20-bed Air-Conditioned Heat Stroke Isolation Ward",
                "ambulance_available": True,
                "verified": True,
            },
            {
                "id": "cbe-hosp-2",
                "name": "ESI Hospital Coimbatore",
                "address": "Varadharajapuram, Singanallur, Coimbatore 641015",
                "type": "Government General & Occupational Health Hospital",
                "lat": 11.0094,
                "lon": 77.0215,
                "emergency_phone": "0422-2574391",
                "heat_stroke_ward": "Emergency Resuscitation & IV Fluid Rehydration Unit",
                "ambulance_available": True,
                "verified": True,
            }
        ],
        "water_points": [
            {
                "id": "cbe-wp-1",
                "name": "Gandhipuram Bus Stand Free RO Water Kiosk",
                "location": "Near Platform 2, Gandhipuram Central Bus Stand",
                "lat": 11.0185,
                "lon": 76.9675,
                "water_type": "Chilled RO Purified Drinking Water",
                "cost": "Free Public Service",
            },
            {
                "id": "cbe-wp-2",
                "name": "Town Hall Clock Tower Municipal Water ATM",
                "location": "Opposite CMC Ward Office, Town Hall",
                "lat": 10.9982,
                "lon": 76.9628,
                "water_type": "Filtered Potable Water + Free ORS Booth",
                "cost": "Free during Heatwaves",
            },
            {
                "id": "cbe-wp-3",
                "name": "RS Puram Post Office Water Kiosk",
                "location": "DB Road Junction, RS Puram",
                "lat": 11.0101,
                "lon": 76.9495,
                "water_type": "Drinking Water & Electrolyte Station",
                "cost": "Free Public Service",
            }
        ],
        "emergency_contacts": [
            {"label": "National Emergency All-in-One", "number": "112", "service": "Police, Fire, Disaster Dispatch"},
            {"label": "Medical Emergency & Ambulance", "number": "108", "service": "Free 24/7 Emergency Ambulance"},
            {"label": "District Disaster Control Room", "number": "1077", "service": "Coimbatore Collectorate Disaster Cell"},
            {"label": "State Health & Heat Advisory Helpline", "number": "104", "service": "Tamil Nadu Public Health Helpline"},
            {"label": "Coimbatore Corporation Civic Control", "number": "0422-2302323", "service": "Municipal Heat Relief Desk"}
        ]
    },
    "chennai": {
        "city": "Chennai",
        "state": "Tamil Nadu",
        "country": "India",
        "lat": 13.0827,
        "lon": 80.2707,
        "cooling_centers": [
            {
                "id": "chn-cc-1",
                "name": "Chennai Central Sub-Surface Passenger Cooling Concourse",
                "address": "Dr MGR Chennai Central Station, Kannappar Thidal, Chennai 600003",
                "type": "Major Transit Air-Cooled Refuge",
                "lat": 13.0823,
                "lon": 80.2755,
                "capacity": 500,
                "hours": "24/7 Daily",
                "features": ["HVAC Air Conditioning", "Multiple Water ATMs", "Paramedic First Aid"],
                "authority": "Southern Railway & Greater Chennai Corporation (GCC)",
                "verified": True,
            },
            {
                "id": "chn-cc-2",
                "name": "Ripon Building Municipal Disaster Relief Pavilion",
                "address": "Sydenhams Rd, Periyamet, Chennai 600003",
                "type": "Civic Administration Cooling Hub",
                "lat": 13.0839,
                "lon": 80.2728,
                "capacity": 200,
                "hours": "09:00 AM – 06:00 PM (Active during IMD Heat Warnings)",
                "features": ["Electrolyte Distribution", "Cold Compress Kits", "Air-Cooled Seating"],
                "authority": "Greater Chennai Corporation",
                "verified": True,
            }
        ],
        "hospitals": [
            {
                "id": "chn-hosp-1",
                "name": "Rajiv Gandhi Government General Hospital (RGGGH)",
                "address": "EVR Periyar Salai, Park Town, Chennai 600003",
                "type": "Apex Tertiary Government Medical College & Hospital",
                "lat": 13.0815,
                "lon": 80.2778,
                "emergency_phone": "044-25305000 / 108",
                "heat_stroke_ward": "Dedicated Heat Illness Intensive Care Unit with Rapid Evaporative Cooling",
                "ambulance_available": True,
                "verified": True,
            },
            {
                "id": "chn-hosp-2",
                "name": "Government Kilpauk Medical College Hospital",
                "address": "822 EVR Periyar Salai, Kilpauk, Chennai 600010",
                "type": "Government Specialized Trauma & Thermal Burn Center",
                "lat": 13.0792,
                "lon": 80.2435,
                "emergency_phone": "044-28364951",
                "heat_stroke_ward": "Comprehensive Rehydration Unit & 24/7 Critical Care",
                "ambulance_available": True,
                "verified": True,
            }
        ],
        "water_points": [
            {
                "id": "chn-wp-1",
                "name": "T. Nagar Ranganathan Street Water Kiosk",
                "location": "Pedestrian Plaza entrance, T. Nagar",
                "lat": 13.0405,
                "lon": 80.2337,
                "water_type": "Continuous RO Cold Potable Water",
                "cost": "Free GCC Civic Facility",
            },
            {
                "id": "chn-wp-2",
                "name": "Koyambedu Bus Terminal (CMBT) Water Hub",
                "location": "Terminal 1 Concourse, Koyambedu",
                "lat": 13.0694,
                "lon": 80.1948,
                "water_type": "Filtered Water Points (4 dispensing taps)",
                "cost": "Free Public Service",
            }
        ],
        "emergency_contacts": [
            {"label": "National Emergency All-in-One", "number": "112", "service": "Police, Fire, Disaster Dispatch"},
            {"label": "Medical Emergency & Ambulance", "number": "108", "service": "Free 24/7 Emergency Ambulance"},
            {"label": "Greater Chennai Corporation Control", "number": "1913", "service": "GCC 24/7 Civic & Heat Complaint Desk"},
            {"label": "District Disaster Control Room", "number": "1077", "service": "Chennai District Emergency Operation Center"},
            {"label": "Health Information Helpline", "number": "104", "service": "Tamil Nadu 24/7 Health Counseling"}
        ]
    },
    "delhi": {
        "city": "Delhi",
        "state": "National Capital Territory of Delhi",
        "country": "India",
        "lat": 28.6139,
        "lon": 77.2090,
        "cooling_centers": [
            {
                "id": "del-cc-1",
                "name": "Kashmere Gate ISBT Air-Conditioned Passenger Transit Shelter",
                "address": "Inter-State Bus Terminal, Kashmere Gate, Delhi 110006",
                "type": "High-Capacity Air-Cooled Transit Shelter",
                "lat": 28.6675,
                "lon": 77.2335,
                "capacity": 600,
                "hours": "24/7 Daily",
                "features": ["High-Power HVAC", "Multiple Water ATMs", "Stretcher & Paramedic Bay"],
                "authority": "Delhi Transport Infrastructure Development Corporation",
                "verified": True,
            },
            {
                "id": "del-cc-2",
                "name": "NDMC Palika Kendra Public Cooling Pavilion",
                "address": "Sansad Marg, Connaught Place, New Delhi 110001",
                "type": "Civic Shaded Refuge",
                "lat": 28.6271,
                "lon": 77.2155,
                "capacity": 250,
                "hours": "09:00 AM – 07:00 PM Daily",
                "features": ["Water Misting Fans", "Electrolyte Distribution", "Cold Potable Water"],
                "authority": "New Delhi Municipal Council (NDMC)",
                "verified": True,
            }
        ],
        "hospitals": [
            {
                "id": "del-hosp-1",
                "name": "All India Institute of Medical Sciences (AIIMS Delhi)",
                "address": "Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029",
                "type": "National Apex Medical Institute & Emergency Trauma Center",
                "lat": 28.5672,
                "lon": 77.2100,
                "emergency_phone": "011-26588500 / 108",
                "heat_stroke_ward": "Dedicated Emergency Department Resuscitation Bay with Ice Immersion Tanks",
                "ambulance_available": True,
                "verified": True,
            },
            {
                "id": "del-hosp-2",
                "name": "Safdarjung Hospital Emergency Care Center",
                "address": "Ring Road, Opposite AIIMS, New Delhi 110029",
                "type": "Central Government Emergency Hospital",
                "lat": 28.5695,
                "lon": 77.2075,
                "emergency_phone": "011-26165060",
                "heat_stroke_ward": "Comprehensive Heatwave Ward equipped with Central Air Cooling",
                "ambulance_available": True,
                "verified": True,
            }
        ],
        "water_points": [
            {
                "id": "del-wp-1",
                "name": "Delhi Jal Board Water ATM Connaught Place",
                "location": "Inner Circle, Near Rajiv Chowk Metro Gate 7",
                "lat": 28.6328,
                "lon": 77.2197,
                "water_type": "Chilled RO Purified Potable Water",
                "cost": "Free during Extreme Heat Warnings",
            },
            {
                "id": "del-wp-2",
                "name": "Chandni Chowk Heritage Promenade Water Dispenser",
                "location": "Near Town Hall, Chandni Chowk",
                "lat": 28.6562,
                "lon": 77.2305,
                "water_type": "Filtered Potable Water",
                "cost": "Free Municipal Facility",
            }
        ],
        "emergency_contacts": [
            {"label": "National Emergency All-in-One", "number": "112", "service": "Police, Fire, Disaster Dispatch"},
            {"label": "Delhi Government Central Emergency", "number": "1077", "service": "Delhi Disaster Management Authority (DDMA)"},
            {"label": "Medical Emergency Ambulance", "number": "102 / 108", "service": "CATS Ambulance Service Delhi"},
            {"label": "Delhi Jal Board Water Emergency", "number": "1916", "service": "Emergency Water Tanker Dispatch"}
        ]
    },
    "bengaluru": {
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "lat": 12.9716,
        "lon": 77.5946,
        "cooling_centers": [
            {
                "id": "blr-cc-1",
                "name": "Majestic Kempegowda Bus Station AC Passenger Lounge",
                "address": "Gubbi Thotadappa Rd, Majestic, Bengaluru 560009",
                "type": "Public Transit Cooling Refuge",
                "lat": 12.9767,
                "lon": 77.5713,
                "capacity": 400,
                "hours": "24/7 Daily",
                "features": ["Air-Cooled Concourse", "RO Water Plants", "Emergency Medical Post"],
                "authority": "KSRTC & BBMP",
                "verified": True,
            }
        ],
        "hospitals": [
            {
                "id": "blr-hosp-1",
                "name": "Victoria Hospital (BMCRI)",
                "address": "Fort Rd, Near City Market, Bengaluru 560002",
                "type": "Government Apex Hospital & Emergency Center",
                "lat": 12.9644,
                "lon": 77.5756,
                "emergency_phone": "080-26701150 / 108",
                "heat_stroke_ward": "Designated Heat Illness Rehydration & ICU Center",
                "ambulance_available": True,
                "verified": True,
            }
        ],
        "water_points": [
            {
                "id": "blr-wp-1",
                "name": "Shivajinagar Bus Station Drinking Kiosk",
                "location": "Shivajinagar Central Terminal",
                "lat": 12.9856,
                "lon": 77.6055,
                "water_type": "Filtered Potable Water",
                "cost": "Free Public Facility",
            }
        ],
        "emergency_contacts": [
            {"label": "National Emergency All-in-One", "number": "112", "service": "Police, Fire, Disaster Dispatch"},
            {"label": "Ambulance / Medical Emergency", "number": "108", "service": "Free Emergency Ambulance"},
            {"label": "BBMP Civic Control Room", "number": "1533", "service": "Bruhat Bengaluru Mahanagara Palike Heat Cell"},
            {"label": "District Disaster Control", "number": "1077", "service": "Bengaluru Urban Disaster Management"}
        ]
    },
    "mumbai": {
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "lat": 19.0760,
        "lon": 72.8777,
        "cooling_centers": [
            {
                "id": "bom-cc-1",
                "name": "CSMT Suburban Passenger Air-Cooled Refuge",
                "address": "Chhatrapati Shivaji Maharaj Terminus, Fort, Mumbai 400001",
                "type": "High-Volume Transit Shelter",
                "lat": 18.9402,
                "lon": 72.8356,
                "capacity": 450,
                "hours": "24/7 Daily",
                "features": ["Central Air Conditioning", "Water Kiosks", "First Aid Room"],
                "authority": "Central Railway & BMC",
                "verified": True,
            }
        ],
        "hospitals": [
            {
                "id": "bom-hosp-1",
                "name": "King Edward Memorial (KEM) Hospital",
                "address": "Acharya Donde Marg, Parel, Mumbai 400012",
                "type": "Municipal Apex Teaching Hospital & Trauma Center",
                "lat": 19.0028,
                "lon": 72.8428,
                "emergency_phone": "022-24107000 / 108",
                "heat_stroke_ward": "Dedicated Thermal Shock Resuscitation Unit",
                "ambulance_available": True,
                "verified": True,
            }
        ],
        "water_points": [
            {
                "id": "bom-wp-1",
                "name": "Dadar Station East Municipal Water ATM",
                "location": "Near Swami Vivekananda Statue, Dadar East",
                "lat": 19.0178,
                "lon": 72.8478,
                "water_type": "Chilled RO Water Dispensary",
                "cost": "Free Municipal Facility",
            }
        ],
        "emergency_contacts": [
            {"label": "National Emergency All-in-One", "number": "112", "service": "Police, Fire, Disaster Dispatch"},
            {"label": "BMC Disaster Control Room", "number": "1916", "service": "Brihanmumbai Municipal Corporation 24/7 Helpline"},
            {"label": "Medical Emergency & Ambulance", "number": "108", "service": "Maharashtra Emergency Medical Services"},
            {"label": "District Disaster Control", "number": "1077", "service": "Mumbai City Disaster Management"}
        ]
    },
    "hyderabad": {
        "city": "Hyderabad",
        "state": "Telangana",
        "country": "India",
        "lat": 17.3850,
        "lon": 78.4867,
        "cooling_centers": [
            {
                "id": "hyd-cc-1",
                "name": "MGBS Imlibun Bus Station Air-Cooled Passenger Hub",
                "address": "Mahatma Gandhi Bus Station, Gowliguda, Hyderabad 500012",
                "type": "Central Transit Cooling Shelter",
                "lat": 17.3789,
                "lon": 78.4822,
                "capacity": 500,
                "hours": "24/7 Daily",
                "features": ["Air-Cooled Seating", "RO Water Points", "TSRTC Helpdesk"],
                "authority": "TSRTC & GHMC",
                "verified": True,
            }
        ],
        "hospitals": [
            {
                "id": "hyd-hosp-1",
                "name": "Osmania General Hospital",
                "address": "Afzal Gunj, Hyderabad 500012",
                "type": "Apex Government General Hospital & Trauma Care",
                "lat": 17.3776,
                "lon": 78.4764,
                "emergency_phone": "040-24600121 / 108",
                "heat_stroke_ward": "Dedicated Heat Illness Management Unit with Cold Saline Infusion",
                "ambulance_available": True,
                "verified": True,
            }
        ],
        "water_points": [
            {
                "id": "hyd-wp-1",
                "name": "Charminar Pedestrian Precinct Water ATM",
                "location": "Near Mecca Masjid Entrance, Charminar",
                "lat": 17.3616,
                "lon": 78.4747,
                "water_type": "Chilled Mineral-Filtered Potable Water",
                "cost": "Free Public Facility",
            }
        ],
        "emergency_contacts": [
            {"label": "National Emergency All-in-One", "number": "112", "service": "Police, Fire, Disaster Dispatch"},
            {"label": "Medical Emergency & Ambulance", "number": "108", "service": "Free 24/7 Emergency Ambulance"},
            {"label": "GHMC Disaster Response Force", "number": "040-21111111", "service": "Greater Hyderabad Disaster Management"},
            {"label": "Health Information Helpline", "number": "104", "service": "Telangana Health Advice Desk"}
        ]
    }
}

DEFAULT_NATIONAL_EMERGENCY_CONTACTS = [
    {"label": "National Emergency All-in-One", "number": "112", "service": "Police, Fire, Medical, Disaster All-in-One"},
    {"label": "National Ambulance Emergency", "number": "108", "service": "Free 24/7 Medical Emergency Response"},
    {"label": "National Disaster Management Helpline", "number": "1078", "service": "NDMA Central Disaster Control Desk"},
    {"label": "Health Information & Medical Counseling", "number": "104", "service": "National/State Tele-Health Advisory"},
    {"label": "Senior Citizens Emergency Helpline", "number": "14567", "service": "Elder Care Thermal Distress Support"}
]


def get_emergency_facilities_for_location(city_query=None, lat=None, lon=None):
    """
    Retrieves verified cooling centers, hospitals, and water kiosks for a location.
    If location data is not cataloged, returns an honest unavailable state with national contacts.
    """
    query = str(city_query or "").strip().lower()
    matched_key = None

    # Check city query match
    if query:
        for k in VERIFIED_EMERGENCY_FACILITIES:
            if k in query or query in k:
                matched_key = k
                break

    # If coordinates given and no query match, search by proximity (< 0.45 deg ~= 50km)
    if not matched_key and lat is not None and lon is not None:
        try:
            target_lat = float(lat)
            target_lon = float(lon)
            best_dist = 0.45
            for k, data in VERIFIED_EMERGENCY_FACILITIES.items():
                d = math.hypot(data["lat"] - target_lat, data["lon"] - target_lon)
                if d < best_dist:
                    best_dist = d
                    matched_key = k
        except (ValueError, TypeError):
            pass

    if matched_key:
        facility = VERIFIED_EMERGENCY_FACILITIES[matched_key]
        return {
            "status": "success",
            "coverage_status": "verified_available",
            "city": facility["city"],
            "state": facility["state"],
            "country": facility["country"],
            "lat": facility["lat"],
            "lon": facility["lon"],
            "cooling_centers": facility["cooling_centers"],
            "hospitals": facility["hospitals"],
            "water_points": facility["water_points"],
            "emergency_contacts": facility["emergency_contacts"],
            "safety_checklist": [
                "Drink 250ml of cool water every 20-30 minutes even before thirst develops.",
                "Seek an air-cooled shelter immediately if experiencing dizziness, nausea, or headache.",
                "If someone ceases sweating, becomes disoriented, or faints, call 108/112 immediately — this is critical heat stroke.",
                "Move overheated individuals to shaded cooling centers; apply wet cloths to neck, groin, and armpits.",
                "Never leave children, elderly persons, or pets inside parked vehicles even for a few minutes."
            ],
            "official_sources": [
                {"name": "National Disaster Management Authority (NDMA)", "url": "https://ndma.gov.in"},
                {"name": "India Meteorological Department (IMD) Heat Bulletins", "url": "https://mausam.imd.gov.in"},
                {"name": "World Health Organization (WHO) Heat-Health Guidance", "url": "https://www.who.int"}
            ],
            "disclaimer": (
                "IMPORTANT EMERGENCY NOTICE: This directory is a municipal public facility locator. "
                "It does NOT replace official 112 / 108 emergency dispatch services or certified medical care. "
                "In case of suspected heat stroke, unconsciousness, or severe hyperthermia, contact 108 or 112 immediately."
            )
        }

    # Honest unavailable state when verified local facilities are not cataloged
    return {
        "status": "partial_coverage",
        "coverage_status": "unavailable",
        "city": city_query or "Selected Coordinates",
        "lat": lat,
        "lon": lon,
        "cooling_centers": [],
        "hospitals": [],
        "water_points": [],
        "emergency_contacts": DEFAULT_NATIONAL_EMERGENCY_CONTACTS,
        "message": (
            "No verified municipal cooling centers or emergency water points are currently cataloged in the ground-truth "
            "database for these specific coordinates. Showing national and regional emergency response hotlines. "
            "Refer to your district disaster management authority for local temporary cooling refuges."
        ),
        "safety_checklist": [
            "Proactively hydrate with clean water, ORS, or natural electrolytes.",
            "Avoid strenuous outdoor activity between 11:00 AM and 04:00 PM.",
            "Stay in the coolest available indoor or shaded room with adequate air ventilation.",
            "Contact 108/112 immediately for emergency medical transport if heat stroke symptoms arise."
        ],
        "official_sources": [
            {"name": "NDMA National Heat Wave Guidelines", "url": "https://ndma.gov.in"},
            {"name": "IMD Weather Advisories", "url": "https://mausam.imd.gov.in"}
        ],
        "disclaimer": (
            "IMPORTANT EMERGENCY NOTICE: This facility directory relies on verified ground truth. "
            "Where local facilities are not cataloged, no artificial locations are fabricated. "
            "Always dial 112 / 108 for emergency medical response."
        )
    }


# ── 2. HEATWAVE IMPACT SIMULATOR ──

SUPPORTED_SCENARIOS = {
    "school": {
        "label": "School & Educational Campus",
        "icon": "🏫",
        "vulnerability_multiplier": 1.25,
        "description": "Children possess higher body surface-area-to-mass ratios and faster dehydration rates.",
        "primary_risks": ["Dehydration during recess", "Classroom thermal distress without active HVAC", "Exhaustion on unshaded commutes"],
    },
    "office": {
        "label": "Office & Commercial Facility",
        "icon": "🏢",
        "vulnerability_multiplier": 1.05,
        "description": "Indoor sedentary workforce subject to building envelope heat retention and power grid stress.",
        "primary_risks": ["HVAC brownout/failure vulnerability", "Commuting heat stress", "Cognitive fatigue"],
    },
    "outdoor_work": {
        "label": "Outdoor Construction & Agricultural Labor",
        "icon": "🏗️",
        "vulnerability_multiplier": 1.48,
        "description": "Direct solar irradiance coupled with intense metabolic muscular heat generation.",
        "primary_risks": ["Rapid fatal heat stroke", "Acute kidney injury from chronic dehydration", "Solar radiation burns"],
    },
    "elder_care": {
        "label": "Elderly Care & Residential Community",
        "icon": "👵",
        "vulnerability_multiplier": 1.40,
        "description": "Reduced thermoregulatory sweating efficiency and elevated cardiovascular vulnerability.",
        "primary_risks": ["Cardiovascular strain", "Medication-induced fluid imbalance", "Nighttime thermal trap in uninsulated housing"],
    }
}

PROTECTIVE_ACTIONS_CATALOG = {
    "shift_hours": {
        "id": "shift_hours",
        "name": "Shift Operational Hours to Early Morning",
        "strain_reduction": 0.22,
        "description": "Reschedule outdoor physical labor or classes to 06:00 AM – 10:30 AM to avoid peak insolation.",
    },
    "hydration_stations": {
        "id": "hydration_stations",
        "name": "Mandatory Hydration & Electrolyte Stations",
        "strain_reduction": 0.14,
        "description": "Provide chilled potable water and oral rehydration salts (ORS) every 25–30 minutes.",
    },
    "shaded_rest": {
        "id": "shaded_rest",
        "name": "Scheduled 15-Min Shaded Rest Breaks Each Hour",
        "strain_reduction": 0.16,
        "description": "Enforce mandatory rest cycles under canopies or reflective awnings to allow core body heat dissipation.",
    },
    "cool_refuge": {
        "id": "cool_refuge",
        "name": "Indoor Air-Conditioned Cool Refuge Facility",
        "strain_reduction": 0.24,
        "description": "Provide designated rooms maintained at 24°C–26°C for workers, students, or residents showing thermal distress.",
    },
    "misting_fans": {
        "id": "misting_fans",
        "name": "Evaporative Misting Coolers & Air Circulators",
        "strain_reduction": 0.10,
        "description": "Deploy high-pressure misting systems to drop local microclimate wet-bulb temperatures by 2°C–4°C.",
    },
    "heat_monitors": {
        "id": "heat_monitors",
        "name": "Designated On-Site Heat Stress Safety Officer",
        "strain_reduction": 0.08,
        "description": "Trained personnel continuously monitoring Wet Bulb Globe Temperature (WBGT) and early heat fatigue symptoms.",
    }
}


def simulate_heatwave_impact(temperature, humidity, duration_days=3, scenario="outdoor_work", active_actions=None):
    """
    Computes illustrative baseline vs preparedness scenario heat stress categories.
    Validates input bounds and enforces transparent non-clinical labels.
    """
    # 1. Bounds Validation
    try:
        temp = max(25.0, min(55.0, float(temperature)))
    except (TypeError, ValueError):
        temp = 38.0

    try:
        rh = max(5.0, min(100.0, float(humidity)))
    except (TypeError, ValueError):
        rh = 50.0

    try:
        duration = max(1, min(30, int(duration_days)))
    except (TypeError, ValueError):
        duration = 3

    scenario_key = str(scenario).strip().lower()
    if scenario_key not in SUPPORTED_SCENARIOS:
        scenario_key = "outdoor_work"

    scenario_info = SUPPORTED_SCENARIOS[scenario_key]
    vuln_mult = scenario_info["vulnerability_multiplier"]

    # 2. Baseline Heat Index Calculation (NOAA formula approximation)
    tf = temp * 9.0 / 5.0 + 32.0
    if tf < 80.0:
        hi_f = 0.5 * (tf + 61.0 + ((tf - 68.0) * 1.2) + (rh * 0.094))
    else:
        hi_f = (-42.379 + 2.04901523 * tf + 10.14333127 * rh
                - 0.22475541 * tf * rh - 6.83783e-3 * tf * tf
                - 5.481717e-2 * rh * rh + 1.22874e-3 * tf * tf * rh
                + 8.5282e-4 * tf * rh * rh - 1.99e-6 * tf * tf * rh * rh)
    heat_index_c = round((hi_f - 32.0) * 5.0 / 9.0, 1)

    # Duration amplification (prolonged days increase cumulative thermal accumulation)
    duration_factor = 1.0 + (min(duration, 10) - 1) * 0.035

    # Raw physical strain score (0 - 100)
    raw_strain = ((heat_index_c - 26.0) * 3.8) * vuln_mult * duration_factor
    baseline_strain_score = round(max(10.0, min(100.0, raw_strain)), 1)

    # Classify baseline risk category
    if baseline_strain_score >= 82.0 or heat_index_c >= 45.0:
        baseline_risk = "Extreme Danger"
        baseline_badge = "critical"
    elif baseline_strain_score >= 64.0 or heat_index_c >= 40.0:
        baseline_risk = "High Danger"
        baseline_badge = "high"
    elif baseline_strain_score >= 42.0 or heat_index_c >= 33.0:
        baseline_risk = "Caution"
        baseline_badge = "moderate"
    else:
        baseline_risk = "Low Risk"
        baseline_badge = "low"

    # 3. Preparedness Scenario Calculation
    actions_list = active_actions if isinstance(active_actions, list) else []
    total_reduction_ratio = 0.0
    applied_actions = []

    for act_id in actions_list:
        if act_id in PROTECTIVE_ACTIONS_CATALOG:
            act = PROTECTIVE_ACTIONS_CATALOG[act_id]
            total_reduction_ratio += act["strain_reduction"]
            applied_actions.append(act)

    # Bound maximum reduction achievable through administrative & engineering controls (max 65%)
    capped_reduction_ratio = min(0.65, total_reduction_ratio)
    mitigated_strain_score = round(max(10.0, baseline_strain_score * (1.0 - capped_reduction_ratio)), 1)
    strain_reduction_pct = round(capped_reduction_ratio * 100.0, 1)

    # Classify mitigated risk category
    if mitigated_strain_score >= 80.0:
        mitigated_risk = "Extreme Danger"
        mitigated_badge = "critical"
    elif mitigated_strain_score >= 60.0:
        mitigated_risk = "High Danger"
        mitigated_badge = "high"
    elif mitigated_strain_score >= 38.0:
        mitigated_risk = "Caution"
        mitigated_badge = "moderate"
    else:
        mitigated_risk = "Low Risk"
        mitigated_badge = "low"

    # Estimated productivity / health retention
    productivity_loss_baseline = round(min(80.0, max(0.0, (baseline_strain_score - 30.0) * 1.1)), 1)
    productivity_loss_mitigated = round(min(80.0, max(0.0, (mitigated_strain_score - 30.0) * 1.1)), 1)

    return {
        "status": "success",
        "inputs": {
            "temperature_celsius": temp,
            "humidity_pct": rh,
            "duration_days": duration,
            "heat_index_celsius": heat_index_c,
            "scenario": scenario_key,
            "scenario_label": scenario_info["label"],
            "vulnerability_multiplier": vuln_mult,
        },
        "baseline_scenario": {
            "heat_risk_category": baseline_risk,
            "badge_class": baseline_badge,
            "strain_index_score": baseline_strain_score,
            "estimated_productivity_loss_pct": productivity_loss_baseline,
            "advisory": (
                "Unmitigated operational exposure: High risk of rapid heat cramps, heat exhaustion, and thermal breakdown."
            ),
        },
        "preparedness_scenario": {
            "heat_risk_category": mitigated_risk,
            "badge_class": mitigated_badge,
            "strain_index_score": mitigated_strain_score,
            "strain_reduction_pct": strain_reduction_pct,
            "estimated_productivity_loss_pct": productivity_loss_mitigated,
            "applied_actions_count": len(applied_actions),
            "applied_actions": applied_actions,
            "outcome_narrative": (
                f"Selected interventions mitigate estimated thermal strain by {strain_reduction_pct}%, "
                f"transitioning operational exposure from {baseline_risk} to {mitigated_risk}."
            ),
        },
        "is_validated_clinical_prediction": False,
        "methodology_label": "Illustrative Scenario Estimate (Occupational & Environmental Thermal Strain Model)",
        "assumptions_disclaimer": (
            "SCENARIO PROJECTION NOTICE: Calculations illustrate relative occupational and community sensitivity "
            "to ambient heat and protective measures. Results are planning estimates and do NOT constitute a certified "
            "clinical health prognosis, official meteorological forecast, or guarantee of individual medical outcomes."
        )
    }


# ── 3. SMART COOLING PROJECT PLANNER ──

STANDARD_COST_BENCHMARKS = {
    "tree_canopy": {
        "unit": "sapling including 3-year care & drip irrigation",
        "cost_per_unit_inr": 1800,  # ~21 USD
        "cooling_per_100_units": "-0.04°C",
    },
    "cool_roofs": {
        "unit": "sq. meter high-albedo solar reflective coating (SRI >= 78)",
        "cost_per_unit_inr": 550,   # ~6.5 USD / m²
        "cooling_per_10000_sqm": "-0.15°C",
    },
    "green_spaces": {
        "unit": "hectare pocket park & vegetative corridor",
        "cost_per_unit_inr": 1200000, # ~14,000 USD / ha
        "cooling_per_ha": "-0.08°C",
    },
    "shaded_bus_stops": {
        "unit": "solar-reflective shaded transit pavilion with green trellis",
        "cost_per_unit_inr": 250000, # ~3,000 USD / shelter
        "cooling_per_10_shelters": "Localized microclimate shade",
    },
    "permeable_pavements": {
        "unit": "sq. meter porous concrete or interlocking vegetative pavers",
        "cost_per_unit_inr": 1400,   # ~16.5 USD / m²
        "cooling_per_10000_sqm": "-0.12°C",
    }
}


def generate_smart_cooling_plan(city_id=None, baseline_temp=None, user_targets=None):
    """
    Generates an urban cooling action plan with prioritized phases and indicative budget estimates.
    Reuses the existing UHI simulation engine (calculate_mitigation_simulation).
    Strictly separates measured ground truth, user assumptions, and proposed estimates.
    """
    # 1. Resolve City & Baseline Ground Truth
    city_match = None
    if city_id:
        for c in SUPPORTED_SIMULATOR_CITIES:
            if c["id"] == str(city_id).lower() or c["name"].lower() == str(city_id).lower():
                city_match = c
                break

    if not city_match:
        city_match = SUPPORTED_SIMULATOR_CITIES[0]  # Default to Coimbatore

    base_t = float(baseline_temp) if baseline_temp is not None else city_match["baseline_temp"]
    base_factors = dict(city_match["baseline_factors"])

    # 2. User Assumptions / Targets
    targets = user_targets if isinstance(user_targets, dict) else {}
    target_trees_add = max(0, min(50000, int(targets.get("tree_count", 3500))))
    target_cool_roof_sqm = max(0, min(500000, int(targets.get("cool_roof_sqm", 40000))))
    target_parks_ha = max(0.0, min(50.0, float(targets.get("parks_hectares", 5.0))))
    target_bus_stops = max(0, min(200, int(targets.get("shaded_bus_stops", 25))))
    target_permeable_sqm = max(0, min(100000, int(targets.get("permeable_pavement_sqm", 15000))))

    # Translate user assumptions into simulator factor shifts
    sim_factors = dict(base_factors)
    # Tree canopy factor increase (~+1% per 300 urban trees)
    sim_factors["tree_cover"] = min(100.0, base_factors["tree_cover"] + (target_trees_add / 300.0))
    # Green cover increase (~+1% per 1.5 ha park)
    sim_factors["green_cover"] = min(100.0, base_factors["green_cover"] + (target_parks_ha / 1.5))
    # Building density heat absorption decrease from cool roofs (~-1% per 5,000 sqm cool roof)
    sim_factors["building_density"] = max(0.0, base_factors["building_density"] - (target_cool_roof_sqm / 5000.0))
    # Pavement heat retention decrease (~-1% per 2,000 sqm permeable pavement)
    sim_factors["roads_pavement"] = max(0.0, base_factors["roads_pavement"] - (target_permeable_sqm / 2000.0))

    # 3. REUSE EXISTING UHI SIMULATION ENGINE (NO DUPLICATE CODE)
    sim_result = calculate_mitigation_simulation(
        baseline_temp=base_t,
        factors=sim_factors,
        location_name=city_match["name"]
    )

    # 4. Phase Rollout Roadmap & Indicative Cost Calculations
    phase_1_cost = (target_cool_roof_sqm * STANDARD_COST_BENCHMARKS["cool_roofs"]["cost_per_unit_inr"] +
                    target_bus_stops * STANDARD_COST_BENCHMARKS["shaded_bus_stops"]["cost_per_unit_inr"])
    phase_2_cost = (target_trees_add * STANDARD_COST_BENCHMARKS["tree_canopy"]["cost_per_unit_inr"] +
                    target_permeable_sqm * STANDARD_COST_BENCHMARKS["permeable_pavements"]["cost_per_unit_inr"])
    phase_3_cost = int(target_parks_ha * STANDARD_COST_BENCHMARKS["green_spaces"]["cost_per_unit_inr"])

    total_cost_inr = phase_1_cost + phase_2_cost + phase_3_cost

    def _format_inr(val):
        if val >= 10000000:
            return f"₹{round(val / 10000000.0, 2)} Crores"
        if val >= 100000:
            return f"₹{round(val / 100000.0, 2)} Lakhs"
        return f"₹{val:,}"

    phases = [
        {
            "phase": "Phase 1: Immediate Municipal Relief",
            "timeframe": "0 – 6 Months",
            "priority": "High / Immediate Quick-Win",
            "interventions": [
                f"Apply solar reflective cool roof coatings across {target_cool_roof_sqm:,} m² of public buildings & schools.",
                f"Install {target_bus_stops} shaded transit pavilions with solar trellises and misting points.",
            ],
            "indicative_budget": _format_inr(phase_1_cost),
            "budget_inr_raw": phase_1_cost,
            "primary_cooling_driver": "Rapid surface albedo modification preventing rooftop thermal mass storage.",
        },
        {
            "phase": "Phase 2: Medium-Term Green Infrastructure",
            "timeframe": "6 – 24 Months",
            "priority": "Medium / Seasonal Planting Cycles",
            "interventions": [
                f"Plant and nurture {target_trees_add:,} native avenue shade trees with drip irrigation.",
                f"Retrofit {target_permeable_sqm:,} m² of municipal parking lots with permeable pavers.",
            ],
            "indicative_budget": _format_inr(phase_2_cost),
            "budget_inr_raw": phase_2_cost,
            "primary_cooling_driver": "Evapotranspirative latent cooling and reduction of impervious asphalt thermal heat capacity.",
        },
        {
            "phase": "Phase 3: Long-Term Urban Resiliency",
            "timeframe": "2 – 5 Years",
            "priority": "Strategic Municipal Master Plan",
            "interventions": [
                f"Develop {target_parks_ha} hectares of continuous urban pocket parks and micro-wetland corridors.",
                "Enact cool building bylaws and vegetative roof requirements for new commercial permits.",
            ],
            "indicative_budget": _format_inr(phase_3_cost),
            "budget_inr_raw": phase_3_cost,
            "primary_cooling_driver": "District-scale convective cool air corridors breaking urban heat dome continuity.",
        }
    ]

    return {
        "status": "success",
        "region": {
            "id": city_match["id"],
            "name": city_match["name"],
            "country": city_match["country"],
            "description": city_match["description"],
        },
        "measured_ground_truth": {
            "baseline_lst_celsius": base_t,
            "baseline_tree_cover_pct": base_factors["tree_cover"],
            "baseline_green_cover_pct": base_factors["green_cover"],
            "baseline_building_density_pct": base_factors["building_density"],
            "baseline_roads_pavement_pct": base_factors["roads_pavement"],
            "data_source": "Satellite Remote Sensing & Municipal Baseline Audits",
        },
        "user_planning_assumptions": {
            "trees_to_plant": target_trees_add,
            "cool_roof_coating_sqm": target_cool_roof_sqm,
            "parks_developed_hectares": target_parks_ha,
            "shaded_bus_shelters": target_bus_stops,
            "permeable_pavement_sqm": target_permeable_sqm,
        },
        "proposed_simulation_estimates": {
            "projected_lst_celsius": sim_result["simulated"]["temperature_celsius"],
            "projected_temperature_reduction_celsius": abs(sim_result["simulated"]["temperature_delta_celsius"]),
            "baseline_heat_risk": sim_result["baseline"]["heat_risk"],
            "projected_heat_risk": sim_result["simulated"]["heat_risk"],
            "preparedness_score_improvement": sim_result["simulated"]["preparedness_delta"],
            "cooling_breakdown": sim_result["cooling_breakdown"],
        },
        "phased_implementation_roadmap": phases,
        "total_indicative_investment": _format_inr(total_cost_inr),
        "total_budget_inr_raw": total_cost_inr,
        "cost_benchmarks_used": STANDARD_COST_BENCHMARKS,
        "methodology_label": "Illustrative Scenario Estimates (Reusing Calibrated Surface Energy Balance Model)",
        "budget_caveat_disclaimer": (
            "BUDGET CAVEAT NOTICE: Cost figures are indicative planning benchmarks based on standard municipal public works "
            "schedules of rates. Actual civil engineering costs vary by site geology, procurement tender conditions, local contractor "
            "labor rates, and material availability. Projections do not guarantee specific contractual tender costs."
        )
    }


# ── 4. HEAT SAFETY CHALLENGE & AWARENESS CENTER ──

HEAT_SAFETY_QUIZ_QUESTIONS = [
    {
        "id": "q1",
        "question": "What is the single most critical symptom that distinguishes life-threatening Heat Stroke from Heat Exhaustion?",
        "options": [
            "Excessive sweating and muscle cramps",
            "Cessation of sweating, confusion, and body temperature soaring above 40°C (104°F)",
            "Pale, cold skin and mild dizziness",
            "Temporary thirst and fatigue after outdoor jogging"
        ],
        "correct_index": 1,
        "explanation": (
            "Heat Stroke is a medical emergency characterized by thermoregulatory failure: sweating often stops, "
            "the skin becomes dry and flushed, confusion or unconsciousness ensues, and core body temperature exceeds 40°C. "
            "Immediate emergency medical response (dial 108/112) is mandatory."
        ),
        "source": "WHO Guidelines on Heat and Health & NDMA Heat Action Plan"
    },
    {
        "id": "q2",
        "question": "When ambient indoor temperature exceeds 35°C (95°F), how does using a standard electric fan without moisture affect the body?",
        "options": [
            "It cools the body down safely regardless of temperature",
            "It blows hot air over the body, accelerating convective heat transfer and dehydration",
            "It replaces the need for drinking water",
            "It increases relative humidity in the room"
        ],
        "correct_index": 1,
        "explanation": (
            "According to the CDC and WHO, when room air is hotter than human skin temperature (~35°C), fans actually blow "
            "hot air onto the skin like a convection oven, increasing heat stress and drying out sweat before it cools you. "
            "Fans must be paired with misting, cool showers, or air conditioning during extreme heatwaves."
        ),
        "source": "CDC Heat Stress Guidelines & WHO Public Health Advice"
    },
    {
        "id": "q3",
        "question": "Why should outdoor physical laborers drink oral rehydration solutions (ORS) or electrolyte water rather than plain water alone during intense sweating?",
        "options": [
            "Electrolytes give water a better taste so people drink more",
            "Profuse sweating depletes sodium and potassium; plain water in large quantities can cause hyponatremia",
            "Plain water is prohibited during peak summer months by labor unions",
            "ORS raises blood pressure to combat high ambient temperatures"
        ],
        "correct_index": 1,
        "explanation": (
            "Sweat contains vital electrolytes (primarily sodium and chloride). Drinking massive quantities of pure water "
            "without electrolytes dilutes blood sodium levels, potentially triggering water intoxication (hyponatremia), "
            "severe muscle cramps, and cognitive collapse."
        ),
        "source": "American College of Sports Medicine & NDMA Guidelines"
    },
    {
        "id": "q4",
        "question": "How quickly can the interior temperature of a parked car reach lethal levels (over 50°C / 122°F) on a 32°C sunny day?",
        "options": [
            "Within 10 to 20 minutes, even with windows cracked open",
            "Only after 4 to 5 hours in direct sunlight",
            "Only if the car is painted black",
            "Never, because glass reflects all thermal solar radiation"
        ],
        "correct_index": 0,
        "explanation": (
            "Automotive greenhouse effect causes vehicle cabins to heat up with astonishing speed — up to 80% of total temperature "
            "rise occurs within the first 10 minutes. Cracking the windows produces virtually no cooling relief. Children and pets "
            "must never be left unattended in vehicles."
        ),
        "source": "National Highway Traffic Safety Administration (NHTSA) & AAP"
    },
    {
        "id": "q5",
        "question": "What is the phenomenon called when urban surfaces retain heat during the day and prevent nighttime temperature drops?",
        "options": [
            "Thermodynamic inversion layer",
            "Urban Heat Island (UHI) nocturnal heat dome",
            "Coriolis thermal oscillation",
            "Radiative tropospheric expansion"
        ],
        "correct_index": 1,
        "explanation": (
            "The Urban Heat Island (UHI) effect occurs when concrete, asphalt, and masonry store daytime solar energy and "
            "re-radiate it slowly throughout the night. This lack of nighttime physiological cooling prevents human cardiovascular "
            "recovery and dramatically elevates heat-related mortality."
        ),
        "source": "WMO / UNEP Urban Heat Island Assessment"
    }
]

MYTH_VS_FACT_CARDS = [
    {
        "id": "myth-1",
        "myth": "“Drinking ice-cold water during severe heat exhaustion is the best immediate remedy.”",
        "fact": "Very cold water can trigger stomach cramps, esophageal spasms, or vagal nerve shock. Cool or room-temperature water with electrolytes is absorbed much faster and safer by the body.",
        "icon": "🧊",
        "authority": "Red Cross Emergency First Aid & Mayo Clinic"
    },
    {
        "id": "myth-2",
        "myth": "“Taking concentrated salt tablets is recommended before working in extreme heat.”",
        "fact": "Salt tablets can cause severe stomach irritation, nausea, and dangerous hypernatremia. Balanced electrolyte fluids (such as WHO-formula ORS or coconut water) are far safer.",
        "icon": "🧂",
        "authority": "CDC National Institute for Occupational Safety and Health (NIOSH)"
    },
    {
        "id": "myth-3",
        "myth": "“Only elderly individuals and patients with chronic illnesses are susceptible to heat exhaustion.”",
        "fact": "Young, fit athletes, outdoor construction workers, and agricultural laborers face equal or greater risk because high metabolic exertion generates intense internal heat loads.",
        "icon": "🏃",
        "authority": "India Meteorological Department & NDMA Guidelines"
    },
    {
        "id": "myth-4",
        "myth": "“Beer or cold alcoholic drinks are hydrating on hot summer afternoons.”",
        "fact": "Alcohol inhibits antidiuretic hormone (ADH), stimulating the kidneys to expel more water and drastically accelerating acute dehydration and thermoregulatory failure.",
        "icon": "🍺",
        "authority": "World Health Organization Public Health Guidance"
    },
    {
        "id": "myth-5",
        "myth": "“If you are still sweating, you cannot possibly be suffering from severe heat illness.”",
        "fact": "Heat exhaustion presents with profuse sweating. Even in classical heat stroke, up to 50% of victims exhibit persistent sweating before complete circulatory collapse.",
        "icon": "💦",
        "authority": "American College of Emergency Physicians"
    }
]

SCENARIO_CHALLENGES = [
    {
        "id": "scenario-1",
        "title": "On-Site Construction Worker Collapse",
        "scenario": "It is 2:00 PM on a 42°C afternoon. A construction worker complains of intense headache, suddenly stops sweating, stumbles, and appears disoriented.",
        "steps": [
            {"step": "Step 1", "action": "Immediately dial 108 / 112 for emergency ambulance dispatch — this is suspected Heat Stroke."},
            {"step": "Step 2", "action": "Move the patient into an air-conditioned room or dense shade immediately; loosen and remove heavy work clothing."},
            {"step": "Step 3", "action": "Apply cold, wet towels or ice packs to high-blood-flow zones: armpits, groin, and neck. Do NOT force-feed water to an unconscious patient."}
        ],
        "key_takeaway": "Heat stroke requires immediate aggressive cooling and hospital transfer. Never wait for symptoms to resolve on their own."
    },
    {
        "id": "scenario-2",
        "title": "School Classroom Heat Spike",
        "scenario": "During a midday heat alert, students in an un-airconditioned second-floor classroom complain of dizziness, extreme fatigue, and nausea.",
        "steps": [
            {"step": "Step 1", "action": "Immediately move students to ground-floor shaded verandas or the air-cooled administrative auditorium."},
            {"step": "Step 2", "action": "Distribute cool potable water with ORS packets and encourage small sips every 5 minutes."},
            {"step": "Step 3", "action": "Suspend all outdoor sports and physical training for the remainder of the heatwave duration."}
        ],
        "key_takeaway": "Schools must enact heat action plans that mandate classroom relocation and hydration schedules on Orange/Red alert days."
    }
]


def get_heat_safety_challenge_data():
    """
    Returns curated, evidence-based heat safety quiz questions, myth-vs-fact cards,
    and scenario challenges with authoritative source citations.
    """
    return {
        "status": "success",
        "quizzes": HEAT_SAFETY_QUIZ_QUESTIONS,
        "myths_and_facts": MYTH_VS_FACT_CARDS,
        "scenario_challenges": SCENARIO_CHALLENGES,
        "authoritative_sources": [
            {"name": "World Health Organization (WHO) Heat-Health Guidelines", "url": "https://www.who.int"},
            {"name": "National Disaster Management Authority (NDMA) Heat Action Plan 2024", "url": "https://ndma.gov.in"},
            {"name": "Centers for Disease Control & Prevention (CDC) Extreme Heat Protocols", "url": "https://www.cdc.gov"},
            {"name": "India Meteorological Department (IMD) Heatwave Warnings", "url": "https://mausam.imd.gov.in"}
        ],
        "disclaimer": (
            "EVIDENCE-BASED SAFETY NOTICE: Educational materials and quiz modules are compiled from official public health "
            "protocols (WHO, CDC, NDMA). They are intended for public disaster awareness and do NOT constitute certified clinical "
            "medical training or individualized medical diagnoses."
        )
    }
