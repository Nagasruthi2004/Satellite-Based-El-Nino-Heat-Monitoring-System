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

# ── 1. HEATWAVE IMPACT SIMULATOR ──

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


def simulate_heatwave_impact(temperature, humidity, duration_days=3, scenario="outdoor_work", active_actions=None, green_cover_pct=None, population_affected=None):
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

    try:
        green_cover = max(5.0, min(80.0, float(green_cover_pct))) if green_cover_pct is not None else 20.0
    except (TypeError, ValueError):
        green_cover = 20.0

    try:
        pop_total = max(500, min(2000000, int(population_affected))) if population_affected is not None else 50000
    except (TypeError, ValueError):
        pop_total = 50000

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

    # Green cover microclimate cooling offset
    green_cooling_celsius = round((green_cover / 100.0) * 3.6, 1)
    green_strain_reduction = min(0.35, (green_cover / 100.0) * 0.45)
    effective_heat_index_c = round(max(20.0, heat_index_c - green_cooling_celsius), 1)

    if green_cover_pct is not None:
        total_reduction_ratio += green_strain_reduction

    # Bound maximum reduction achievable through administrative & engineering controls (max 75%)
    capped_reduction_ratio = min(0.75, total_reduction_ratio)
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

    # Population analysis
    baseline_affected_ratio = min(0.85, (baseline_strain_score / 100.0) * 0.55)
    mitigated_affected_ratio = min(0.85, (mitigated_strain_score / 100.0) * 0.55)
    baseline_affected_count = int(pop_total * baseline_affected_ratio)
    mitigated_affected_count = int(pop_total * mitigated_affected_ratio)
    population_protected = max(0, baseline_affected_count - mitigated_affected_count)

    impact_level = "Critical" if mitigated_strain_score >= 80.0 else ("High" if mitigated_strain_score >= 60.0 else ("Moderate" if mitigated_strain_score >= 38.0 else "Low"))

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
            "green_cover_pct": green_cover,
            "population_affected": pop_total,
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
        "population_impact": {
            "total_population": pop_total,
            "baseline_affected": baseline_affected_count,
            "mitigated_affected": mitigated_affected_count,
            "population_protected": population_protected,
            "mitigated_affected_pct": round(mitigated_affected_ratio * 100, 1),
        },
        "green_cover_metrics": {
            "green_cover_pct": green_cover,
            "cooling_offset_celsius": green_cooling_celsius,
            "effective_heat_index_celsius": effective_heat_index_c,
        },
        "overall_impact_level": impact_level,
        "recommendation": (
            "Enforce mandatory 15-min shaded rest per hour, distribute electrolytes, and restrict outdoor exposure between 11 AM and 4 PM."
            if mitigated_strain_score >= 60.0 else
            "Maintain proactive hydration stations, monitor vulnerable groups, and utilize available tree canopy and shaded corridors."
            if mitigated_strain_score >= 38.0 else
            "Conditions are manageable with routine hydration and standard heat safety awareness."
        ),
        "is_validated_clinical_prediction": False,
        "methodology_label": "Illustrative Scenario Estimate (Occupational & Environmental Thermal Strain Model)",
        "assumptions_disclaimer": (
            "SCENARIO PROJECTION NOTICE: Calculations illustrate relative occupational and community sensitivity "
            "to ambient heat and protective measures. Results are planning estimates and do NOT constitute a certified "
            "clinical health prognosis, official meteorological forecast, or guarantee of individual medical outcomes."
        )
    }


# ── 4. HEAT SAFETY CHALLENGE & AWARENESS CENTER ──

HEAT_SAFETY_QUIZ_QUESTIONS = [
    {
        "id": "q1",
        "question": "What is the single most critical symptom that distinguishes life-threatening Heat Stroke from Heat Exhaustion?",
        "options": [
            "Excessive sweating and muscle cramps",
            "Central nervous system dysfunction (confusion, delirium, seizures) and body temperature exceeding 40°C (104°F)",
            "Pale, cold skin with mild thirst after jogging",
            "Temporary fatigue and headache relieved by 5 minutes of rest"
        ],
        "correct_index": 1,
        "explanation": (
            "Heat Stroke is a life-threatening medical emergency defined by core body temperature > 40°C (104°F) "
            "accompanied by central nervous system abnormalities (confusion, ataxia, delirium, seizures, or coma). "
            "In heat exhaustion, mental status remains intact. Immediate emergency medical response (dial 108/112) is mandatory."
        ),
        "source": "WHO Guidelines on Heat and Health & NDMA Heat Action Plan",
        "source_citation": "WHO Public Health Advice on Preventing Health Effects of Heat & NDMA Heatwave Guidelines",
        "category": "Clinical Triage"
    },
    {
        "id": "q2",
        "question": "When ambient indoor temperature exceeds 35°C (95°F), how does using a standard electric fan without moisture affect the human body?",
        "options": [
            "It cools the body down safely regardless of surrounding temperature",
            "It blows air hotter than skin temperature across the body, accelerating convective heat gain and dehydration",
            "It replaces the metabolic need for drinking water",
            "It reduces relative humidity and purifies indoor carbon dioxide"
        ],
        "correct_index": 1,
        "explanation": (
            "According to the US CDC and WHO, when ambient air is hotter than human skin surface temperature (~35°C), "
            "fans act like convection ovens, blowing hot air onto the body, accelerating physiological heat stress and evaporating "
            "sweat without cooling. Fans should be paired with skin misting, wet cloths, or moving to air-conditioned cooling centers."
        ),
        "source": "US CDC Extreme Heat Protocols & GHHIN Fan Guidance",
        "source_citation": "CDC Natural Disasters & Severe Weather: Heat Stress; WHO Technical Guidance",
        "category": "Indoor Safety"
    },
    {
        "id": "q3",
        "question": "Why does the National Disaster Management Authority (NDMA) caution against outdoor workers drinking massive amounts of plain water alone during intense sweating?",
        "options": [
            "Plain water takes too long to absorb in hot weather",
            "Heavy sweating depletes sodium and chloride; excessive plain water dilutes serum sodium, triggering exercise-associated hyponatremia",
            "Plain water increases core body temperature through metabolic thermogenesis",
            "Plain water is medically prohibited during summer afternoons"
        ],
        "correct_index": 1,
        "explanation": (
            "Sweat contains vital electrolytes (principally sodium and chloride). Consuming vast quantities of pure water "
            "without electrolytes dilutes blood sodium concentration, precipitating exercise-associated hyponatremia (water intoxication), "
            "severe muscle cramps, cerebral edema, and seizures. NDMA recommends alternating water with ORS, buttermilk, or tender coconut water."
        ),
        "source": "NDMA National Heat Wave Guidelines & American College of Sports Medicine",
        "source_citation": "NDMA Standard Operating Procedures for Heatwave Management (2024)",
        "category": "Hydration & Electrolytes"
    },
    {
        "id": "q4",
        "question": "On a sunny day with an ambient temperature of 32°C (90°F), how quickly can the interior temperature of a parked vehicle reach lethal levels (>50°C / 122°F)?",
        "options": [
            "Within 10 to 20 minutes, even with windows cracked open",
            "Only after 4 to 5 hours in direct sunlight",
            "Vehicles never exceed ambient outdoor air temperature",
            "Only if the vehicle's engine was running beforehand"
        ],
        "correct_index": 0,
        "explanation": (
            "Solar radiation penetrates glass windows and is trapped inside via the vehicular greenhouse effect. Approximately 80% "
            "of the total temperature increase occurs within the first 10 minutes. Cracking windows open provides almost no temperature reduction. "
            "Children, vulnerable individuals, and pets must never be left unattended in parked vehicles."
        ),
        "source": "National Highway Traffic Safety Administration (NHTSA) & AAP",
        "source_citation": "US NHTSA Vehicular Heatstroke Research & CDC Child Heat Safety",
        "category": "Vehicular Safety"
    },
    {
        "id": "q5",
        "question": "What is the phenomenon called when urban surfaces retain solar heat during the day and prevent nighttime cooling?",
        "options": [
            "Thermodynamic inversion layer",
            "Urban Heat Island (UHI) nocturnal thermal dome",
            "Coriolis thermal oscillation",
            "Radiative tropospheric expansion"
        ],
        "correct_index": 1,
        "explanation": (
            "The Urban Heat Island (UHI) effect occurs when concrete, asphalt, and dark roofing absorb daytime solar energy and "
            "re-radiate it slowly throughout the night. This lack of nocturnal cooling prevents human cardiovascular recovery and "
            "exponentially compounds heat-related mortality and morbidity."
        ),
        "source": "WMO / UNEP Urban Heat Island Assessment & Lancet Planetary Health",
        "source_citation": "World Meteorological Organization (WMO) Heat Health Guide & UNEP Urban Cooling",
        "category": "Urban Microclimate"
    },
    {
        "id": "q6",
        "question": "What is the primary first-aid principle when responding to suspected Heat Stroke before and while waiting for emergency EMS?",
        "options": [
            "Force the patient to swallow antipyretic tablets like aspirin or paracetamol",
            "'Cool First, Transport Second': Rapidly lower core temperature using cold water immersion, wet sheets, and ice packs to neck, armpits, and groin",
            "Wrap the patient in heavy blankets to induce extra sweating",
            "Have the patient stand and walk vigorously to stimulate blood flow"
        ],
        "correct_index": 1,
        "explanation": (
            "Every minute of extreme core hyperthermia causes cellular necrosis. Antipyretics (paracetamol/aspirin) are contraindicated "
            "because the hypothalamic setpoint is normal; liver and kidneys may also be damaged. The primary evidence-based protocol "
            "is rapid active cooling ('Cool First, Transport Second') using cold water immersion or cold wet sheets with aggressive fanning."
        ),
        "source": "US CDC / NIOSH Heat Stress First Aid & NDMA Protocols",
        "source_citation": "CDC/NIOSH Criteria for a Recommended Standard: Occupational Exposure to Heat (2023)",
        "category": "Emergency First Aid"
    }
]

MYTH_VS_FACT_CARDS = [
    {
        "id": "myth-1",
        "myth": "Drinking ice-cold water during severe heat exhaustion is the best immediate remedy.",
        "fact": "Very cold water can trigger stomach cramps, esophageal spasms, or stimulate the vagus nerve. Cool or room-temperature water with electrolytes is absorbed much faster and safer by the gastrointestinal tract.",
        "science_detail": "The stomach must warm extremely cold liquids before optimal gastric emptying occurs. Cool (15°C–20°C) water paired with WHO-standard oral rehydration salts ensures maximum intestinal uptake without cramping.",
        "source": "World Health Organization (WHO) & Mayo Clinic Clinical Guidelines",
        "authority": "World Health Organization (WHO)",
        "icon": "🧊"
    },
    {
        "id": "myth-2",
        "myth": "Taking concentrated salt tablets before working in extreme heat prevents heat cramps and exhaustion.",
        "fact": "Salt tablets can cause severe stomach mucosal irritation, vomiting, and hazardous hypernatremia. Balanced electrolyte fluids or normal salted food with water are far safer.",
        "science_detail": "NIOSH and CDC explicitly warn against salt tablets. Concentrated sodium pulls water osmotically into the gut, worsening systemic hypovolemia and dehydration.",
        "source": "CDC National Institute for Occupational Safety and Health (NIOSH)",
        "authority": "US CDC / NIOSH",
        "icon": "🧂"
    },
    {
        "id": "myth-3",
        "myth": "If you are sweating profusely, you cannot possibly be suffering from heat stroke.",
        "fact": "In exertional heat stroke (common in athletes and outdoor laborers), patients often sweat profusely even while core temperature surges past 40.5°C.",
        "science_detail": "Classical (non-exertional) heat stroke frequently presents with dry anhidrotic skin, but exertional heat stroke victims often exhibit active sweating until severe hemodynamic collapse. Relying solely on the presence of sweat delays life-saving care.",
        "source": "American College of Sports Medicine (ACSM) & NDMA Guidelines",
        "authority": "NDMA & ACSM",
        "icon": "💦"
    },
    {
        "id": "myth-4",
        "myth": "Beer or cold alcoholic drinks are effective for rehydration on hot summer afternoons.",
        "fact": "Alcohol inhibits pituitary antidiuretic hormone (ADH), inducing rapid diuresis, escalating fluid loss, and impairing central thermoregulation.",
        "science_detail": "Ethanol promotes peripheral vasodilation without heat loss efficiency and depresses cognitive awareness of heat symptoms, significantly multiplying heat stroke susceptibility.",
        "source": "World Health Organization Public Health Guidance",
        "authority": "World Health Organization (WHO)",
        "icon": "🍺"
    },
    {
        "id": "myth-5",
        "myth": "Only the elderly and young infants face severe health risks from extreme heatwaves.",
        "fact": "Young, fit workers and athletes face equal or greater risk because high physical exertion generates enormous internal metabolic heat.",
        "science_detail": "Heavy physical exertion can increase internal metabolic heat production by 8 to 12 times resting levels. When high ambient humidity prevents evaporative sweat cooling, fit adults can develop exertional heat stroke rapidly.",
        "source": "India Meteorological Department & NDMA Guidelines",
        "authority": "NDMA & Lancet Countdown",
        "icon": "🏃"
    },
    {
        "id": "myth-6",
        "myth": "Living in a warm climate means your body is automatically acclimated to sudden unseasonal heat spikes.",
        "fact": "Physiological heat acclimatization takes 7 to 14 days of progressive, gradual exposure and decays within days of inactivity.",
        "science_detail": "Acclimatization requires progressive vascular and endocrine adaptations: plasma volume expansion, decreased sweat sodium content, and earlier onset of perspiration. Sudden unseasonal spring heat spikes hit unacclimated bodies with full force.",
        "source": "CDC / NIOSH Heat Stress Acclimatization Guidance",
        "authority": "US CDC / NIOSH",
        "icon": "⏳"
    }
]

SCENARIO_CHALLENGES = [
    {
        "id": "scenario-1",
        "title": "On-Site Construction Worker Collapse",
        "scenario": "It is 2:00 PM on a 42°C afternoon. An outdoor construction worker complains of intense headache, suddenly stops sweating, stumbles, and appears confused and disoriented.",
        "options": [
            {
                "text": "Give them 2 paracetamol tablets with a chilled energy drink and tell them to rest on an unshaded bench.",
                "is_correct": False,
                "outcome": "Dangerous Intervention: Ineffective Medication & Delay",
                "explanation": "Paracetamol is ineffective for environmental hyperthermia and strains the liver. Leaving a disoriented patient in unshaded heat risks rapid coma and death."
            },
            {
                "text": "Immediately dial 108 / 112 emergency EMS, move the worker into dense shade/air conditioning, loosen clothing, and aggressively cool them with cold wet towels and ice packs to neck, armpits, and groin.",
                "is_correct": True,
                "outcome": "Life-Saving Medical Action: Rapid Cooling & Emergency Dispatch",
                "explanation": "Confusion and hot skin during extreme heat indicate Heat Stroke. Rapid core cooling ('Cool First, Transport Second') before cellular damage occurs is the gold standard protocol of WHO and NDMA."
            },
            {
                "text": "Force them to drink 1 liter of ice water immediately while having coworkers massage their calves.",
                "is_correct": False,
                "outcome": "High Risk of Choking / Aspiration",
                "explanation": "Never force fluids into a disoriented or semi-conscious individual; fluid can enter the lungs (aspiration). Active external cooling is the urgent priority."
            }
        ],
        "guidance": "NDMA / WHO Heat Stroke Protocol: Dial 108/112 immediately. Active external cooling must begin within minutes to prevent multiorgan dysfunction syndrome.",
        "steps": [
            {"step": "Step 1", "action": "Immediately dial 108 / 112 for emergency ambulance dispatch — this is suspected Heat Stroke."},
            {"step": "Step 2", "action": "Move the patient into an air-conditioned room or dense shade immediately; loosen and remove heavy work clothing."},
            {"step": "Step 3", "action": "Apply cold, wet towels or ice packs to high-blood-flow zones: armpits, groin, and neck. Do NOT force-feed water to a disoriented patient."}
        ],
        "key_takeaway": "Heat stroke requires immediate aggressive cooling and hospital transfer. Never wait for symptoms to resolve on their own."
    },
    {
        "id": "scenario-2",
        "title": "School Classroom Heat Spike During Orange Alert",
        "scenario": "During a midday heat alert, students in an un-airconditioned top-floor classroom complain of dizziness, extreme fatigue, nausea, and calf cramps.",
        "options": [
            {
                "text": "Immediately move students to ground-floor shaded verandas or air-cooled rooms, provide cool potable water with WHO ORS packets in small sips, and cancel outdoor afternoon activities.",
                "is_correct": True,
                "outcome": "Correct Mitigation: Relocation, Gentle Hydration, and Rest",
                "explanation": "Top-floor classrooms under uninsulated roofs can reach dangerous temperatures. Relocating students, replenishing electrolytes, and halting physical exertion directly addresses heat exhaustion."
            },
            {
                "text": "Turn on high-speed ceiling fans with windows sealed shut and continue outdoor physical education drills.",
                "is_correct": False,
                "outcome": "Severe Risk: Convection Heating & Acute Exertional Heat Illness",
                "explanation": "Sealing windows traps hot air, while high-speed fans in >35°C air circulate hot convection currents. Continuing physical education drills can trigger heat stroke in children."
            },
            {
                "text": "Distribute ice popsicles and encourage students to run laps to build summer endurance.",
                "is_correct": False,
                "outcome": "Dangerous Misconception: Severe Exertional Strain",
                "explanation": "Strenuous exercise during heatwaves directly triggers exertional heat illness. Pediatric thermoregulation is less mature than adults, with lower sweating capacity."
            }
        ],
        "guidance": "NDMA School Heat Action Plan: Mandate rescheduling school hours, relocating top-floor classes, maintaining ORS supplies, and suspending outdoor drills during Orange/Red alerts.",
        "steps": [
            {"step": "Step 1", "action": "Immediately move students to ground-floor shaded verandas or the air-cooled administrative auditorium."},
            {"step": "Step 2", "action": "Distribute cool potable water with ORS packets and encourage small sips every 5 minutes."},
            {"step": "Step 3", "action": "Suspend all outdoor sports and physical training for the remainder of the heatwave duration."}
        ],
        "key_takeaway": "Schools must enact heat action plans that mandate classroom relocation and hydration schedules on Orange/Red alert days."
    },
    {
        "id": "scenario-3",
        "title": "Elderly Resident Living Alone During Urban Power Outage",
        "scenario": "A summer grid outage knocks out residential air conditioning during a 42°C heatwave. A 75-year-old neighbor with hypertension lives alone in a top-floor flat. You check on them and find them lethargic and mildly confused.",
        "options": [
            {
                "text": "Place a jug of water by their bedside, draw curtains closed, and plan to return the following afternoon.",
                "is_correct": False,
                "outcome": "Extreme Mortality Risk: Delayed Medical Care for Vulnerable Senior",
                "explanation": "Lethargy and confusion in high ambient heat are warning signs of progressing heat stroke. Seniors have impaired thirst sensation and cannot regulate temperature effectively; overnight delay is perilous."
            },
            {
                "text": "Assist the senior to a cool, ground-floor community shelter or shaded area, apply cool wet towels to neck and wrists, monitor breathing, and call for medical evaluation.",
                "is_correct": True,
                "outcome": "Life-Saving Neighbor Intervention: Relocation & Active Cooling",
                "explanation": "CDC and NDMA emphasize community welfare checks during heatwaves. Relocating vulnerable seniors out of overheated top-floor rooms and initiating active cooling prevents fatal decompensation."
            },
            {
                "text": "Give them high-dose aspirin and urge them to take a hot shower to sweat out the heat.",
                "is_correct": False,
                "outcome": "Hazardous Intervention: Hot Water & Ineffective Antipyretics",
                "explanation": "Hot showers worsen hyperthermia, and aspirin provides zero benefit for heat-induced body temperature elevation while aggravating gastrointestinal bleeding risk."
            }
        ],
        "guidance": "CDC Heat and Older Adults Protocol: High ambient heat impairs cardiovascular and renal reserves. Check on isolated seniors twice daily; confusion demands urgent medical intervention.",
        "steps": [
            {"step": "Step 1", "action": "Check on isolated elderly neighbors twice daily during heatwave advisories."},
            {"step": "Step 2", "action": "Assist seniors to air-conditioned community cooling centers or lower-floor shaded areas."},
            {"step": "Step 3", "action": "Provide small sips of cool water and seek immediate medical attention if cognitive confusion or extreme lethargy appears."}
        ],
        "key_takeaway": "Community resilience depends on proactive checks for isolated seniors; confusion during extreme heat warrants urgent medical response."
    }
]

AUTHORITATIVE_SOURCES = [
    {
        "name": "World Health Organization (WHO) Heat-Health Guidelines",
        "organization": "World Health Organization (WHO)",
        "publication": "Public Health Advice on Preventing Health Effects of Extreme Heat",
        "year": "2024",
        "description": "Evidence-based guidelines on recognizing heat-related illnesses, physiological vulnerability thresholds, and public health warning systems.",
        "url": "https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health"
    },
    {
        "name": "National Disaster Management Authority (NDMA) Heat Action Plan 2024",
        "organization": "National Disaster Management Authority (NDMA)",
        "publication": "National Guidelines for Preparation of Action Plan - Prevention and Management of Heat Wave",
        "year": "2024",
        "description": "Official standard operating procedures for Indian states and municipalities, color-coded alert criteria, cooling centers, and labor shift regulations.",
        "url": "https://ndma.gov.in/Governance/Guidelines"
    },
    {
        "name": "Centers for Disease Control & Prevention (CDC) Extreme Heat Protocols",
        "organization": "US CDC & NIOSH",
        "publication": "Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments",
        "year": "2023",
        "description": "Occupational heat stress limits, work/rest regimens, clinical identification of heat stroke vs exhaustion, and cold-water immersion first aid.",
        "url": "https://www.cdc.gov/niosh/topics/heatstress/default.html"
    },
    {
        "name": "India Meteorological Department (IMD) Heatwave Warnings",
        "organization": "India Meteorological Department (IMD)",
        "publication": "Heat Wave Warning Criteria and Climatological Norms",
        "year": "2024",
        "description": "Meteorological definitions and observational criteria for heatwaves and severe heatwaves across coastal, plains, and hill stations.",
        "url": "https://mausam.imd.gov.in/"
    },
    {
        "name": "Global Heat Health Information Network (GHHIN - WMO/WHO)",
        "organization": "Global Heat Health Information Network (GHHIN)",
        "publication": "Personal Heat Protection and Electric Fan Use Above 35°C",
        "year": "2023",
        "description": "Global clinical consensus on personal protection measures, fan limitations during extreme dry heat, and wet-bulb temperature survivability thresholds.",
        "url": "https://ghhin.org/"
    }
]


def get_heat_safety_challenge_data():
    """
    Returns curated, evidence-based heat safety quiz questions, myth-vs-fact cards,
    scenario challenges, and authoritative source citations.
    Supports both legacy test keys and standard frontend keys.
    """
    return {
        "status": "success",
        # Legacy / test keys
        "quizzes": HEAT_SAFETY_QUIZ_QUESTIONS,
        "myths_and_facts": MYTH_VS_FACT_CARDS,
        "scenario_challenges": SCENARIO_CHALLENGES,
        "authoritative_sources": AUTHORITATIVE_SOURCES,
        # Frontend canonical keys
        "quiz_questions": HEAT_SAFETY_QUIZ_QUESTIONS,
        "myths_vs_facts": MYTH_VS_FACT_CARDS,
        "evidence_sources": AUTHORITATIVE_SOURCES,
        "disclaimer": (
            "EVIDENCE-BASED SAFETY NOTICE: Educational materials and quiz modules are compiled from official public health "
            "protocols (WHO, CDC, NDMA). They are intended for public disaster awareness and do NOT constitute certified clinical "
            "medical training or individualized medical diagnoses."
        )
    }

