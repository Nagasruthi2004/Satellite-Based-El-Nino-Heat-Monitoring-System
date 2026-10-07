import { useState } from "react";
import "./DisasterInformation.css";

const DISASTERS_DATA = [
  {
    id: "heatwave",
    name: "Heatwave",
    icon: "🔥",
    classSuffix: "cat-heatwave",
    categoryTag: "Thermal Extreme",
    authority: "IMD & NDMA Guidelines",
    whatIsIt:
      "A heatwave is an extended period of abnormally high ambient temperatures, often coupled with oppressive humidity. In India, the India Meteorological Department (IMD) declares a heatwave when the maximum temperature reaches at least 40°C / 104°F in plains or 30°C / 86°F in hilly regions, with departures from normal of 4.5°C / 8.1°F to 6.4°C / 11.5°F (or severe heatwave when departure exceeds 6.4°C / 11.5°F, or absolute temperatures exceed 45°C / 113°F).",
    warningSigns: [
      "Consecutive days of extreme temperatures soaring above normal seasonal baselines",
      "Persistent dry, hot afternoon winds (Loo) blowing across inland plains",
      "Elevated Land Surface Temperature (LST) and very high UV index ratings",
      "Abnormal lack of nighttime cooling, preventing physiological thermal recovery",
      "Rapid wilting of vegetation and rapid drop in surface water reservoirs"
    ],
    precautions: [
      "Keep track of official IMD daily heatwave bulletins and local district weather alerts.",
      "Stay indoors during peak radiation hours (12:00 PM to 3:00 PM).",
      "Wear loose, lightweight, light-colored cotton clothing to facilitate natural air circulation.",
      "Shield head and eyes with umbrellas, wide-brimmed hats, or damp cotton cloths when outdoors.",
      "Keep curtains or blinds closed on sun-facing windows during daytime."
    ],
    during: [
      "Hydrate proactively: drink water at frequent intervals even without feeling thirsty.",
      "Take oral rehydration solutions (ORS), coconut water, lemon water, or buttermilk.",
      "Rest in cool, shaded, or air-conditioned environments whenever possible.",
      "Apply cool, damp towels to forehead, neck, and armpits if feeling overheated.",
      "Check on high-risk individuals: senior citizens, young infants, and outdoor workers."
    ],
    avoid: [
      "Never leave children, elderly individuals, or pets unattended in parked vehicles.",
      "Avoid strenuous outdoor physical labor and intense athletic exercises during midday.",
      "Avoid dehydrating beverages: alcohol, carbonated soft drinks, and heavy caffeine.",
      "Avoid heavy, high-protein, or stale food that increases metabolic heat production.",
      "Avoid sudden transition from extreme outdoor heat into freezing cold water."
    ],
    preparednessTips: [
      "Prepare a summer emergency kit: ORS packets, cooling gel packs, and electrolyte sachets.",
      "Identify nearby public cooling centres, shaded community shelters, and primary health clinics.",
      "Install reflective roof coatings or green shading to lower indoor room temperatures.",
      "Know how to distinguish heat exhaustion (heavy sweating, paleness) from critical heatstroke (confusion, cessation of sweating, fever > 40°C / 104°F)."
    ],
    officialSources: [
      {
        name: "IMD Heatwave Bulletins",
        agency: "India Meteorological Department",
        url: "https://mausam.imd.gov.in/"
      },
      {
        name: "NDMA Heat Wave Action Plan",
        agency: "National Disaster Management Authority",
        url: "https://ndma.gov.in/Natural-Hazards/Heat-Wave"
      }
    ]
  },
  {
    id: "flood",
    name: "Flood",
    icon: "🌊",
    classSuffix: "cat-flood",
    categoryTag: "Hydrological Hazard",
    authority: "CWC & NDMA India",
    whatIsIt:
      "A flood is an overflow of an expanse of water that submerges land typically dry. Floods in India are commonly caused by intense monsoonal downpours, cloudburst events, cyclonic storm surges, riverbank overflow, breached embankments, or inadequate municipal storm drainage systems in rapidly urbanized areas.",
    warningSigns: [
      "Continuous torrential rainfall forecasts and Red/Orange rainfall warnings from IMD",
      "Rapid elevation of local river water gauge levels crossing danger markers (CWC bulletins)",
      "Sudden muddiness or rapid velocity increase in local streams and canals",
      "Street stormwater backflows through sewer manholes and storm drains",
      "Dam/reservoir water discharge notifications issued by irrigation authorities"
    ],
    precautions: [
      "Monitor Central Water Commission (CWC) real-time river basin flood advisories.",
      "Identify higher ground elevation points and safe community evacuation routes.",
      "Keep important identity documents, property deeds, and medicines in waterproof pouches.",
      "Elevate electrical appliances and wiring above anticipated flood water levels.",
      "Maintain emergency flood bags ready for rapid evacuation."
    ],
    during: [
      "Evacuate immediately when advised by district disaster management authorities or NDRF.",
      "Move family members and livestock to designated high-ground relief centres.",
      "Switch off main electrical circuit breakers and domestic gas cylinders before leaving.",
      "Drink only boiled, chlorinated, or sealed bottled water to avoid waterborne pathogens.",
      "Use a sturdy walking stick to check ground firmness and water depth when walking."
    ],
    avoid: [
      "Never attempt to walk, swim, or drive through flowing floodwaters (15 cm knocks down an adult; 30-60 cm sweeps away cars).",
      "Do not touch fallen power lines, submerged electrical cables, or metal utility poles.",
      "Never consume food items or unsealed water that has come into contact with floodwater.",
      "Avoid standing on bridges, culverts, or river embankments during high-velocity surges.",
      "Do not return to submerged homes until civil engineers certify structural safety."
    ],
    preparednessTips: [
      "Pack a survival Go-Bag: waterproof torch, emergency whistle, water purification tablets, 3-day dry rations, power bank, and first-aid supplies.",
      "Save contact numbers of local district flood control rooms, SDRF, and NDRF battalions.",
      "Anchor outdoor fuel tanks or remove hazardous chemicals from ground level."
    ],
    officialSources: [
      {
        name: "CWC Flood Forecasting",
        agency: "Central Water Commission India",
        url: "https://ffs.india-water.gov.in/"
      },
      {
        name: "NDMA Flood Guidelines",
        agency: "National Disaster Management Authority",
        url: "https://ndma.gov.in/Natural-Hazards/Floods"
      },
      {
        name: "NDRF Response Operations",
        agency: "National Disaster Response Force",
        url: "https://www.ndrf.gov.in/"
      }
    ]
  },
  {
    id: "cyclone",
    name: "Cyclone",
    icon: "🌪️",
    classSuffix: "cat-cyclone",
    categoryTag: "Atmospheric Storm",
    authority: "IMD RSMC & NDMA",
    whatIsIt:
      "A tropical cyclone is an intense circular storm system originating over warm tropical oceans (Bay of Bengal and Arabian Sea in the Indian sub-continent). Characterized by central low atmospheric pressure, rotating squall bands, destructive sustained winds ranging from 62 to over 220 km/h, catastrophic coastal storm surges, and localized torrential rainfall.",
    warningSigns: [
      "IMD 4-Stage Cyclone Warning Bulletins: Pre-Cyclone Watch, Alert (Yellow), Warning (Orange), and Post-Landfall Outlook (Red)",
      "Steep barometric pressure drops recorded at coastal meteorological observatories",
      "Turbulent sea swell, anomalous high-tide surges, and ocean foam on beaches",
      "Dramatic shifts in wind velocity and persistent dark anvil-shaped cloud ceilings",
      "Sudden aggressive squalls with wind gusts rattling glass panes"
    ],
    precautions: [
      "Inspect home roofs, tin sheds, and signboards; secure or dismantle loose outdoor objects.",
      "Trim dead or overhanging tree limbs close to power lines and roofs.",
      "Cover glass windows with protective shutters or cross-tape them to prevent flying shards.",
      "Stockpile 3 to 7 days of non-perishable food, potable drinking water, and batteries.",
      "Keep battery-operated transceivers or AM radios tuned to official IMD broadcast updates."
    ],
    during: [
      "Remain indoors within the strongest, windowless central room or proceed to a Pucca Cyclone Shelter.",
      "Keep radio tuned for official updates; stay calm and reassure children and elderly.",
      "Disconnect all non-essential electrical appliances and shut off main gas cylinders.",
      "If coastal evacuation is announced, move promptly without delaying for heavy baggage.",
      "Beware of the cyclone 'Eye': temporary calm does NOT mean the storm is over; violent reverse winds will strike suddenly."
    ],
    avoid: [
      "Never venture outside during the temporary calm of the storm's eye.",
      "Do not go near beaches, harbors, or coastal seawalls to watch storm waves.",
      "Avoid sheltering under tall trees, electrical pylons, or advertising hoardings.",
      "Never spread or believe unverified rumours on social media; rely solely on IMD and district collectors.",
      "Avoid driving through fallen trees or flooded underpasses."
    ],
    preparednessTips: [
      "Maintain a waterproof emergency bag with identity papers, land records, cash, power banks, and flashlights.",
      "Identify the nearest designated Cyclone Shelter and safest inland route.",
      "Coastal fishermen must strictly obey IMD advisories and moor boats safely in designated creeks."
    ],
    officialSources: [
      {
        name: "IMD Cyclone Warning Division",
        agency: "RSMC New Delhi / IMD",
        url: "https://rsmcnewdelhi.imd.gov.in/"
      },
      {
        name: "NDMA Cyclone Safety Manual",
        agency: "National Disaster Management Authority",
        url: "https://ndma.gov.in/Natural-Hazards/Cyclones"
      }
    ]
  },
  {
    id: "landslide",
    name: "Landslide",
    icon: "🪨",
    classSuffix: "cat-landslide",
    categoryTag: "Geological Mass Movement",
    authority: "GSI & NDMA India",
    whatIsIt:
      "A landslide is the downward and outward movement of a mass of rock, earth, debris, or mud under the direct influence of gravity. In mountainous terrains like the Himalayas and Western Ghats, landslides are triggered by prolonged monsoonal rainfall, cloudbursts, earthquakes, slope deforestation, and unscientific slope excavation.",
    warningSigns: [
      "Appearance of new cracks in hill slopes, foundations, pavements, or retaining walls",
      "Sudden emergence of water springs or wet saturated ground on previously dry hillsides",
      "Tilting of trees, utility poles, fences, or retaining walls out of vertical alignment",
      "Sudden muddiness or volume drop in mountain streams (indicating an upstream blockage/dam)",
      "Low rumbling, cracking, or grinding sounds echoing from the mountain slope"
    ],
    precautions: [
      "Consult Geological Survey of India (GSI) Landslide Hazard Zonation maps for your region.",
      "Avoid building homes close to steep mountain slopes, valley floors, or natural drainage ravines.",
      "Ensure proper drainage pipes and channels are clear around retaining walls and hillside properties.",
      "Stay vigilant during persistent torrential rainfall in hilly Ghat sections.",
      "Plan alternative hillside evacuation routes with local village/town disaster committees."
    ],
    during: [
      "Evacuate quickly away from the path of the slide toward stable, high-elevation bedrock terrain.",
      "If caught inside a structure and unable to escape, take cover under heavy sturdy furniture and curl into a tight ball protecting head and neck.",
      "Alert immediate neighbors and phone local district disaster control rooms.",
      "Listen for unusual sounds like trees snapping or rocks knocking together."
    ],
    avoid: [
      "Never attempt to cross or drive over an active mudslide or rockfall zone.",
      "Do not stay in low-lying valley bottoms, steep road embankments, or natural drainage gorges during heavy rain.",
      "Do not return to slide-hit zones until certified geotechnical clearance is granted by authorities.",
      "Avoid clearing slope debris yourself during ongoing heavy rainfall."
    ],
    preparednessTips: [
      "Keep an emergency survival kit accessible: whistle, battery torch, first-aid kit, and sturdy trekking shoes.",
      "Participate in community mock drills conducted by district disaster management authorities.",
      "Report newly observed slope cracks or tilting utility lines immediately to local revenue or PWD officials."
    ],
    officialSources: [
      {
        name: "GSI Landslide Hazard Portal",
        agency: "Geological Survey of India",
        url: "https://www.gsi.gov.in/"
      },
      {
        name: "NDMA Landslide Guidelines",
        agency: "National Disaster Management Authority",
        url: "https://ndma.gov.in/Natural-Hazards/Landslides"
      }
    ]
  },
  {
    id: "earthquake",
    name: "Earthquake",
    icon: "🌍",
    classSuffix: "cat-earthquake",
    categoryTag: "Tectonic Seismic Event",
    authority: "NCS India & USGS",
    whatIsIt:
      "An earthquake is a sudden, violent shaking of the Earth's surface caused by the rapid release of accumulated strain energy along geologic fault lines in the tectonic crust. Note: Earthquakes cannot be predicted in advance by any scientific system or weather model; immediate safety actions and seismic-resistant building standards are essential.",
    warningSigns: [
      "Sudden ground vibration, sharp jolt, or rolling lateral tremors",
      "Rattling of windows, doors, chinaware, and suspended light fixtures",
      "Sub-surface rumbling, roaring sound just before or accompanying shaking",
      "Rapid swaying of tall structures, lampposts, and overhead transmission lines",
      "(No advance scientific short-term prediction exists; response must be spontaneous)"
    ],
    precautions: [
      "Anchor tall bookcases, heavy wardrobes, and water heaters firmly to wall studs.",
      "Do not hang heavy mirrors, picture frames, or glass shelves directly above beds or couches.",
      "Identify safe spots in every room: under sturdy desks, interior corners away from windows.",
      "Know how to shut off main domestic gas valves and electrical circuit breakers.",
      "Conduct regular family 'Drop, Cover, and Hold On' drills."
    ],
    during: [
      "IF INDOORS: DROP to your hands and knees, take COVER under a sturdy desk or table, and HOLD ON until tremors stop. If no desk is nearby, crouch against an interior wall covering head and neck.",
      "IF OUTDOORS: Move to an open clearing away from buildings, glass facades, chimneys, trees, and overhead power cables.",
      "IF IN A MOVING VEHICLE: Pull over safely away from flyovers, bridges, and overhead wires; stay inside until shaking stops.",
      "Protect your head and vital organs with cushions, pillows, or arms."
    ],
    avoid: [
      "DO NOT use elevators or lifts during or immediately after an earthquake.",
      "Do not rush frantically toward crowded staircases or exit doors while tremors continue.",
      "Avoid standing near exterior walls, glass windows, heavy mirrors, or hanging chandeliers.",
      "Do not light matches, candles, or lighters until gas lines are confirmed completely safe."
    ],
    preparednessTips: [
      "Keep an emergency grab-bag near exit: whistle, flashlight, dust mask, first-aid, sturdy shoes, and 3-day drinking water.",
      "Establish an out-of-state/out-of-city family contact person to coordinate check-ins if local mobile networks congest.",
      "Follow National Building Code (NBC) seismic design standards when constructing homes."
    ],
    officialSources: [
      {
        name: "National Center for Seismology",
        agency: "Ministry of Earth Sciences India",
        url: "https://seismo.gov.in/"
      },
      {
        name: "USGS Earthquake Hazards",
        agency: "United States Geological Survey",
        url: "https://www.usgs.gov/programs/earthquake-hazards"
      },
      {
        name: "NDMA Earthquake Guidelines",
        agency: "National Disaster Management Authority",
        url: "https://ndma.gov.in/Natural-Hazards/Earthquakes"
      }
    ]
  }
];

const EMERGENCY_SUPPLIES = [
  {
    icon: "💧",
    title: "Potable Water",
    desc: "At least 3-4 litres per person per day for drinking and basic sanitation for minimum 72 hours."
  },
  {
    icon: "🥫",
    title: "Non-Perishable Food",
    desc: "3-day supply of canned goods, dry fruits, energy bars, and ready-to-eat meals requiring no cooking."
  },
  {
    icon: "🩹",
    title: "Comprehensive First-Aid",
    desc: "Bandages, sterile gauze, antiseptic ointments, scissors, ORS sachets, and 7-day prescription medicines."
  },
  {
    icon: "🔦",
    title: "Light & Power",
    desc: "LED torches/flashlights, extra alkaline batteries, solar lanterns, and high-capacity portable power banks."
  },
  {
    icon: "📻",
    title: "Emergency Communications",
    desc: "Battery-powered or hand-crank AM/FM radio, loud emergency whistles, and spare phone charging cables."
  },
  {
    icon: "📂",
    title: "Crucial Documents & Cash",
    desc: "Aadhaar, passport, property records, and emergency cash sealed safely in double waterproof pouches."
  }
];

const OFFICIAL_DIRECTORIES = [
  {
    name: "India Meteorological Department (IMD)",
    role: "Weather, Cyclones, Heatwaves & Monsoon Bulletins",
    url: "https://mausam.imd.gov.in/",
    badge: "Official Weather"
  },
  {
    name: "National Disaster Management Authority (NDMA)",
    role: "Apex Disaster Preparedness, Guidelines & Policy",
    url: "https://ndma.gov.in/",
    badge: "Apex Disaster Body"
  },
  {
    name: "National Disaster Response Force (NDRF)",
    role: "Specialized Emergency Search, Rescue & Relief Operations",
    url: "https://www.ndrf.gov.in/",
    badge: "Rescue & Relief"
  },
  {
    name: "Central Water Commission (CWC)",
    role: "National River Water Gauges & Flood Forecasting",
    url: "https://ffs.india-water.gov.in/",
    badge: "Flood Warning"
  },
  {
    name: "Geological Survey of India (GSI)",
    role: "Landslide Hazard Zonation & Early Warning Systems",
    url: "https://www.gsi.gov.in/",
    badge: "Geological Hazard"
  },
  {
    name: "National Center for Seismology (NCS)",
    role: "Government Earthquake Monitoring & Seismic Network",
    url: "https://seismo.gov.in/",
    badge: "Seismic Monitoring"
  },
  {
    name: "United States Geological Survey (USGS)",
    role: "Global Earthquake Hazards & Seismic Data",
    url: "https://www.usgs.gov/programs/earthquake-hazards",
    badge: "Global Seismic"
  }
];

export default function DisasterInformation({ currentHeatRisk, weather }) {
  const [selectedDisaster, setSelectedDisaster] = useState(null);

  const selectedDisasterData = selectedDisaster
    ? DISASTERS_DATA.find((d) => d.id === selectedDisaster) || null
    : null;

  const activeHeatRiskLevel =
    typeof currentHeatRisk === "object"
      ? currentHeatRisk?.level
      : currentHeatRisk || weather?.heat_risk;

  return (
    <div className="disaster-info-container" id="disaster-information-module">
      {/* ── MODULE HEADER ── */}
      <header className="disaster-info-header">
        <div className="disaster-eyebrow">
          <span>🚨</span> Official Disaster Awareness & Safety Protocols
        </div>
        <h2 className="disaster-title">Disaster Information</h2>
        <p className="disaster-subtitle">
          Comprehensive, authoritative awareness guidelines, safety precautions,
          and emergency preparedness protocols compiled from official national
          and global disaster management authorities.
        </p>

        {/* Official Clarity Disclaimer */}
        <div className="disaster-disclaimer-banner" role="note">
          <span className="disclaimer-icon" aria-hidden="true">ℹ️</span>
          <div>
            <strong>Safety & Preparedness Disclaimer:</strong> This module is
            dedicated exclusively to public awareness, life-safety guidance,
            and official reference links. This application does not predict
            earthquakes, floods, cyclones, or landslides. For real-time disaster
            warnings and evacuation directives, always monitor official government
            updates from IMD, NDMA, CWC, GSI, and local district authorities.
          </div>
        </div>
      </header>

      {/* ── 5 DISASTER SELECTION CARDS (Initial Selection View) ── */}
      {!selectedDisasterData ? (
        <section className="disaster-selection-section" aria-label="Disaster selection">
          <div className="selection-intro">
            <h3 className="selection-heading">Select a Natural Hazard to View Official Protocols</h3>
            <p className="selection-subheading">
              Choose any of the 5 disaster categories below to access life-safety guidelines, early warning indicators, emergency actions, and verified official advisories.
            </p>
          </div>

          <div className="disaster-selection-grid">
            {DISASTERS_DATA.map((disaster) => (
              <div
                key={disaster.id}
                role="button"
                tabIndex={0}
                className={`disaster-select-card ${disaster.classSuffix}`}
                onClick={() => setSelectedDisaster(disaster.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDisaster(disaster.id);
                  }
                }}
                id={`select-disaster-${disaster.id}`}
                aria-label={`View ${disaster.name} safety guidelines and information`}
              >
                <div className="select-card-top">
                  <div className="disaster-icon-box" aria-hidden="true">
                    {disaster.icon}
                  </div>
                  <span className="disaster-card-category-tag">{disaster.categoryTag}</span>
                </div>

                <div className="select-card-body">
                  <h3 className="select-card-name">{disaster.name}</h3>
                  <p className="select-card-desc">
                    {disaster.whatIsIt.length > 130
                      ? `${disaster.whatIsIt.slice(0, 127)}...`
                      : disaster.whatIsIt}
                  </p>
                </div>

                <div className="select-card-footer">
                  <div className="disaster-card-authority-badge">
                    <span>🛡️</span>
                    <span>{disaster.authority}</span>
                    {disaster.id === "heatwave" && activeHeatRiskLevel && (
                      <span style={{ marginLeft: "6px", fontWeight: "700" }}>
                        • {activeHeatRiskLevel}
                      </span>
                    )}
                  </div>
                  <span className="select-card-action">
                    View Safety Guidelines <span>→</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* ── SELECTED DISASTER DETAIL VIEW ── */
        <section className="disaster-detail-view" aria-label={`${selectedDisasterData.name} details`}>
          <div className="disaster-detail-toolbar">
            <button
              type="button"
              className="disaster-back-btn"
              onClick={() => setSelectedDisaster(null)}
              id="back-to-disasters-btn"
            >
              <span>←</span>
              <span>Back to Disasters</span>
            </button>

            {/* Quick Switcher */}
            <div className="disaster-quick-switch" aria-label="Switch disaster">
              {DISASTERS_DATA.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`disaster-quick-pill ${selectedDisaster === d.id ? "active" : ""}`}
                  onClick={() => setSelectedDisaster(d.id)}
                  id={`quick-switch-${d.id}`}
                >
                  <span>{d.icon}</span>
                  <span>{d.name}</span>
                </button>
              ))}
            </div>
          </div>

          <article
            className={`disaster-card ${selectedDisasterData.classSuffix}`}
            id={`disaster-card-${selectedDisasterData.id}`}
          >
            {/* Card Header */}
            <div className="disaster-card-header">
              <div className="disaster-card-title-group">
                <div className="disaster-icon-box" aria-hidden="true">
                  {selectedDisasterData.icon}
                </div>
                <div>
                  <div className="disaster-card-category-tag">{selectedDisasterData.categoryTag}</div>
                  <h3 className="disaster-card-name">{selectedDisasterData.name}</h3>
                </div>
              </div>

              <div className="disaster-card-authority-badge">
                <span>🛡️</span>
                <span>{selectedDisasterData.authority}</span>
                {selectedDisasterData.id === "heatwave" && activeHeatRiskLevel && (
                  <span style={{ marginLeft: "6px", fontWeight: "700" }}>
                    • Monitored: {activeHeatRiskLevel}
                  </span>
                )}
              </div>
            </div>

            {/* Card Body */}
            <div className="disaster-card-body">
              {/* 1. What is it? */}
              <div className="disaster-overview-section">
                <div className="section-label">1. What is it?</div>
                <p className="disaster-description">{selectedDisasterData.whatIsIt}</p>
              </div>

              {/* 2. Common Warning Signs */}
              <div className="disaster-warning-box">
                <h4>
                  <span>⚠️</span>
                  <span>2. Common Warning Signs & Conditions</span>
                </h4>
                <ul className="disaster-warning-list">
                  {selectedDisasterData.warningSigns.map((sign, idx) => (
                    <li key={idx}>
                      <span>•</span>
                      <span>{sign}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Protocols Grid: Precautions, During, What to Avoid, Preparedness */}
              <div className="disaster-protocol-grid">
                {/* 3. Safety Precautions */}
                <div className="protocol-box precautions">
                  <h4>
                    <span>🛡️</span>
                    <span>3. Safety Precautions</span>
                  </h4>
                  <ul className="protocol-list">
                    {selectedDisasterData.precautions.map((item, idx) => (
                      <li key={idx}>
                        <span className="protocol-bullet">✔</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 4. What to Do During */}
                <div className="protocol-box during">
                  <h4>
                    <span>⚡</span>
                    <span>4. What to Do During</span>
                  </h4>
                  <ul className="protocol-list">
                    {selectedDisasterData.during.map((item, idx) => (
                      <li key={idx}>
                        <span className="protocol-bullet">✔</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 5. What to Avoid */}
                <div className="protocol-box avoid">
                  <h4>
                    <span>🚫</span>
                    <span>5. What to Avoid</span>
                  </h4>
                  <ul className="protocol-list">
                    {selectedDisasterData.avoid.map((item, idx) => (
                      <li key={idx}>
                        <span className="protocol-bullet">✖</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 6. Emergency Preparedness Tips */}
                <div className="protocol-box preparedness">
                  <h4>
                    <span>🎒</span>
                    <span>6. Preparedness Tips</span>
                  </h4>
                  <ul className="protocol-list">
                    {selectedDisasterData.preparednessTips.map((item, idx) => (
                      <li key={idx}>
                        <span className="protocol-bullet">★</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 7. Official Information Source */}
            <div className="disaster-card-footer">
              <div className="official-sources-row">
                <span className="official-source-label">7. Official Sources:</span>
                {selectedDisasterData.officialSources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="official-source-link"
                    title={`Open ${source.name} in a new tab`}
                  >
                    <span>🔗</span>
                    <span>{source.name}</span>
                    <span style={{ fontSize: "11px", opacity: 0.8 }}>↗</span>
                  </a>
                ))}
              </div>

              <button
                type="button"
                className="disaster-back-bottom-btn"
                onClick={() => {
                  setSelectedDisaster(null);
                  const el = document.getElementById("disaster-information-module");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span>←</span>
                <span>Back to Disasters</span>
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ── EMERGENCY PREPAREDNESS SECTION ── */}
      <section className="emergency-preparedness-section" id="emergency-preparedness-section">
        <div className="section-header-block">
          <h3>
            <span>🎒</span>
            <span>Universal Emergency Disaster Supply Kit</span>
          </h3>
          <p>
            Standard 72-hour survival essentials recommended by NDMA and international
            civil protection agencies for immediate home readiness and evacuation.
          </p>
        </div>

        <div className="kit-grid">
          {EMERGENCY_SUPPLIES.map((supply, idx) => (
            <div key={idx} className="kit-card">
              <div className="kit-card-icon" aria-hidden="true">{supply.icon}</div>
              <h4 className="kit-card-title">{supply.title}</h4>
              <p className="kit-card-items">{supply.desc}</p>
            </div>
          ))}
        </div>

        {/* Emergency Helplines */}
        <div style={{ marginTop: "12px" }}>
          <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)", marginBottom: "8px" }}>
            📞 National Emergency Helplines (India)
          </h4>
          <div className="helpline-grid">
            <div className="helpline-card">
              <span className="helpline-label">National Emergency</span>
              <span className="helpline-number">112</span>
            </div>
            <div className="helpline-card">
              <span className="helpline-label">Disaster Services (NDMA)</span>
              <span className="helpline-number">1078</span>
            </div>
            <div className="helpline-card">
              <span className="helpline-label">Fire Rescue</span>
              <span className="helpline-number">101</span>
            </div>
            <div className="helpline-card">
              <span className="helpline-label">Ambulance</span>
              <span className="helpline-number">102 / 108</span>
            </div>
            <div className="helpline-card">
              <span className="helpline-label">NDRF Control Room</span>
              <span className="helpline-number">011-24363260</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── OFFICIAL SOURCES DIRECTORY ── */}
      <section className="official-sources-directory" id="official-sources-directory">
        <div className="section-header-block">
          <h3>
            <span>🏛️</span>
            <span>Official Disaster Management Sources & Portals</span>
          </h3>
          <p>
            Direct links to authoritative national and international governmental
            agencies responsible for official advisories, early warnings, and rescue operations.
          </p>
        </div>

        <div className="sources-directory-grid">
          {OFFICIAL_DIRECTORIES.map((dir, idx) => (
            <div key={idx} className="directory-card">
              <div className="directory-card-top">
                <div className="directory-card-title">
                  <span>{dir.name}</span>
                  <span className="directory-badge">{dir.badge}</span>
                </div>
                <p className="directory-card-desc">{dir.role}</p>
              </div>

              <a
                href={dir.url}
                target="_blank"
                rel="noopener noreferrer"
                className="directory-visit-btn"
                title={`Visit official website: ${dir.name}`}
              >
                <span>Visit Official Portal</span>
                <span>↗</span>
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
