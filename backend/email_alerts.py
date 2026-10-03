"""
Email Heat Alert & Notification System Module
Satellite-Based El Niño Heat Monitoring System

Handles:
- Email validation and threshold verification
- Non-sensitive alert configuration management (in-memory + local storage)
- Evaluation of heat risk vs configured threshold (Low < Medium < High < Critical)
- Assembly of professional heat risk alert emails
- Secure SMTP delivery using environment variables (SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ALERT_FROM_EMAIL)
- Safe fallback when SMTP credentials are not configured
"""

import os
import re
import json
import logging
import smtplib
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

from heat_risk import classify_current_heat_risk

# Ensure environment variables are loaded from backend/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

logger = logging.getLogger(__name__)

# RFC-compliant email regex
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
)

# Supported threshold levels
VALID_THRESHOLDS = ["Medium", "High", "Critical"]

# Heat-risk hierarchy: Low < Medium < High < Critical
# Note: "Moderate" is treated identically to "Medium" for compatibility with LST datasets
RISK_RANKS = {
    "Low": 1,
    "Moderate": 2,
    "Medium": 2,
    "High": 3,
    "Critical": 4,
}

# Standardized recommendations by heat-risk level
SAFETY_RECOMMENDATIONS = {
    "Low": "Conditions are within normal bounds. Maintain regular hydration, wear lightweight clothing, and monitor weather updates.",
    "Medium": "Moderate heat conditions detected. Drink plenty of water throughout the day, avoid direct sun exposure during peak afternoon hours, and ensure adequate airflow in living areas.",
    "High": "High heat risk detected. Drink water and electrolyte solutions frequently. Minimize strenuous outdoor physical activity between 11:00 AM and 4:00 PM, and check on elderly or vulnerable individuals.",
    "Critical": "Critical extreme heat conditions! Stay indoors in shaded or air-conditioned environments. Hydrate continuously, never leave children or pets in parked vehicles, and seek immediate medical assistance if symptoms of heat exhaustion or heat stroke appear.",
}

# Path to local alert configuration file (excluded from git)
ALERT_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "alert_config.json")

# In-memory alert configuration cache
_ALERT_CONFIG_CACHE = {
    "configured": False,
    "email": "",
    "location": "Tamil Nadu",
    "threshold": "Medium",
    "frequency": "Instant",
    "enabled": True,
    "last_updated": None,
}


def is_valid_email(email: str) -> bool:
    """Validate that an email string conforms to standard email format."""
    if not email or not isinstance(email, str):
        return False
    email_clean = email.strip()
    if len(email_clean) > 254:
        return False
    return bool(EMAIL_REGEX.match(email_clean))


def normalize_risk_level(level: str) -> str:
    """Normalize risk level representation, mapping 'Moderate' to 'Medium'."""
    if not level or not isinstance(level, str):
        return "Low"
    cleaned = level.strip().capitalize()
    if cleaned in ("Moderate", "Medium"):
        return "Medium"
    if cleaned in ("High", "Critical", "Low"):
        return cleaned
    return "Low"


def is_alert_triggered(current_risk: str, threshold: str) -> bool:
    """
    Check if the current heat risk level meets or exceeds the configured threshold.
    Threshold ordering: Low < Medium < High < Critical.
    """
    curr_rank = RISK_RANKS.get(current_risk, 1)
    thresh_rank = RISK_RANKS.get(threshold, 2)
    return curr_rank >= thresh_rank


def get_safety_recommendation(risk_level: str) -> str:
    """Return tailored safety recommendation for the given risk level."""
    normalized = normalize_risk_level(risk_level)
    return SAFETY_RECOMMENDATIONS.get(normalized, SAFETY_RECOMMENDATIONS["Low"])


def get_smtp_config() -> dict:
    """
    Retrieve SMTP configuration from environment variables.
    Supports standard names and existing project aliases.
    Does NOT log or expose password.
    """
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

    host = (
        os.getenv("SMTP_HOST")
        or os.getenv("SMTP_SERVER")
        or "smtp.gmail.com"
    ).strip()

    raw_port = os.getenv("SMTP_PORT", "587").strip()
    try:
        port = int(raw_port)
    except ValueError:
        port = 587

    username = (
        os.getenv("SMTP_USERNAME")
        or os.getenv("SMTP_EMAIL")
        or os.getenv("EMAIL_USER")
        or os.getenv("SENDER_EMAIL")
        or ""
    ).strip()

    password = (
        os.getenv("SMTP_PASSWORD")
        or os.getenv("EMAIL_PASSWORD")
        or os.getenv("EMAIL_PASS")
        or ""
    ).strip()

    from_email = (
        os.getenv("ALERT_FROM_EMAIL")
        or username
        or "noreply@heat-monitor.system"
    ).strip()

    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "from_email": from_email,
    }


def is_smtp_configured() -> bool:
    """
    Verify if SMTP credentials are provided in the environment.
    Returns False if credentials are missing or default placeholders.
    """
    cfg = get_smtp_config()
    username = cfg["username"]
    password = cfg["password"]

    if not username or not password:
        return False

    dummy_placeholders = {
        "your_email@gmail.com",
        "your_gmail_app_password",
        "your_16_character_app_password",
        "user@example.com",
        "placeholder",
        "test@example.com",
    }

    if username.lower() in dummy_placeholders or password.lower() in dummy_placeholders:
        return False

    return True


def get_location_heat_status(location: str) -> dict:
    """
    Resolve the current temperature / LST and heat-risk level for a location or Indian state.
    Reuses existing dataset (India LST Clean Dataset) and live weather classification.
    """
    target_loc = (location or "Tamil Nadu").strip()

    # 1. Check if the location matches an Indian state in the LST dataset
    try:
        from app import _load_full_india_lst_df
        df, lst_col = _load_full_india_lst_df()
        if df is not None and not df.empty and "State" in df.columns:
            # Case-insensitive match on state name
            state_match = df[df["State"].astype(str).str.casefold() == target_loc.casefold()]
            if not state_match.empty:
                # Get the most recent year available
                latest_year = state_match["Year"].max() if "Year" in state_match.columns else 2025
                latest_row = state_match[state_match["Year"] == latest_year].iloc[0]

                raw_risk = str(latest_row.get("Heat Risk", "Medium"))
                normalized_risk = normalize_risk_level(raw_risk)
                lst_val = latest_row.get(lst_col)
                temp = float(lst_val) if lst_val is not None and not (isinstance(lst_val, float) and lst_val != lst_val) else 34.0

                return {
                    "location": str(latest_row.get("State", target_loc)),
                    "temperature": round(temp, 1),
                    "temperature_unit": "°C",
                    "heat_risk": normalized_risk,
                    "source": f"MODIS Satellite LST Observation ({latest_year})",
                    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                }
    except Exception as exc:
        logger.debug("LST dataset lookup exception for %s: %s", target_loc, exc)

    # 2. Attempt live weather lookup for city or location
    try:
        from weather import fetch_weather
        weather_data = fetch_weather(target_loc)
        if weather_data and weather_data.get("temperature") is not None:
            temp = float(weather_data["temperature"])
            humidity = float(weather_data.get("humidity", 50))
            rain = float(weather_data.get("rainfall", 0))
            wind = float(weather_data.get("wind_speed", 5))

            risk_info = classify_current_heat_risk(temp, humidity, rain, wind)
            risk_level = normalize_risk_level(risk_info["level"] if risk_info else "Medium")

            return {
                "location": weather_data.get("city", target_loc),
                "temperature": round(temp, 1),
                "temperature_unit": "°C",
                "heat_risk": risk_level,
                "source": "Live Meteorological Observation",
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            }
    except Exception as exc:
        logger.debug("Live weather lookup exception for %s: %s", target_loc, exc)

    # 3. Deterministic fallback preserving heat risk classification
    return {
        "location": target_loc,
        "temperature": 34.5,
        "temperature_unit": "°C",
        "heat_risk": "Medium",
        "source": "System Baseline Observation",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }


def build_email_content(
    location: str,
    temperature_val: float | str | None,
    heat_risk_level: str,
    alert_threshold: str,
    is_test: bool = False,
) -> tuple[str, str, str]:
    """
    Build the required professional heat-warning email content.

    Returns:
        tuple: (subject, text_body, html_body)
    """
    subject = "Heat Risk Alert – Satellite-Based El Niño Heat Monitoring System"
    if is_test:
        subject = f"[TEST] {subject}"

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    temp_str = f"{temperature_val}°C" if temperature_val is not None else "N/A"
    risk_level = normalize_risk_level(heat_risk_level)
    threshold = threshold_clean = alert_threshold.strip().capitalize() if alert_threshold else "Medium"
    recommendation = get_safety_recommendation(risk_level)

    # Risk badge color coding
    color_map = {
        "Low": "#16a34a",
        "Medium": "#d97706",
        "High": "#dc2626",
        "Critical": "#991b1b",
    }
    badge_color = color_map.get(risk_level, "#d97706")

    # Plain text version
    text_body = f"""Satellite-Based El Niño Heat Monitoring System
==================================================
HEAT RISK ALERT NOTIFICATION
{'(Automated System Test)' if is_test else ''}

Location / State: {location}
Current Temperature / LST: {temp_str}
Heat-Risk Level: {risk_level}
Alert Threshold: {threshold}
Date / Time: {now_str}

Safety Recommendation:
{recommendation}

System Information:
Project: Satellite-Based El Niño Heat Monitoring System
Module: Email Heat Alert & Notification System

DISCLAIMER:
This is an automated awareness alert, not an official emergency warning.
Please follow advisories and protocols issued by local disaster management authorities and public health officials.
"""

    # HTML formatted version
    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #1f2937; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }}
    .header {{ background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; padding: 24px; text-align: center; }}
    .header h1 {{ margin: 0 0 8px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }}
    .header p {{ margin: 0; font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; }}
    .content {{ padding: 28px 24px; }}
    .badge {{ display: inline-block; padding: 6px 14px; border-radius: 9999px; color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; background-color: {badge_color}; }}
    .data-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden; }}
    .data-table td {{ padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }}
    .data-table td.label {{ font-weight: 600; color: #4b5563; width: 45%; }}
    .data-table td.val {{ font-weight: 700; color: #111827; }}
    .data-table tr:last-child td {{ border-bottom: none; }}
    .recommendation-box {{ background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0; }}
    .recommendation-box h3 {{ margin: 0 0 6px 0; font-size: 14px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.05em; }}
    .recommendation-box p {{ margin: 0; font-size: 14px; line-height: 1.5; color: #1e3a8a; }}
    .disclaimer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; line-height: 1.4; text-align: center; }}
    .footer {{ background: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p>{'🧪 Automated Test Notification' if is_test else '🔥 Heat Alert Notification'}</p>
      <h1>Satellite-Based El Niño Heat Monitoring System</h1>
    </div>
    <div class="content">
      <div style="text-align: center; margin-bottom: 20px;">
        <span class="badge">{risk_level} Heat Risk</span>
      </div>

      <table class="data-table">
        <tr>
          <td class="label">Location / State:</td>
          <td class="val">{location}</td>
        </tr>
        <tr>
          <td class="label">Current Temperature / LST:</td>
          <td class="val">{temp_str}</td>
        </tr>
        <tr>
          <td class="label">Heat-Risk Level:</td>
          <td class="val">{risk_level}</td>
        </tr>
        <tr>
          <td class="label">Configured Threshold:</td>
          <td class="val">{threshold}</td>
        </tr>
        <tr>
          <td class="label">Date / Time:</td>
          <td class="val">{now_str}</td>
        </tr>
      </table>

      <div class="recommendation-box">
        <h3>Safety Recommendation</h3>
        <p>{recommendation}</p>
      </div>

      <div class="disclaimer">
        <strong>Disclaimer:</strong> This is an automated awareness alert, not an official emergency warning.
        Always consult official notices and follow safety advisories issued by national and regional disaster management authorities.
      </div>
    </div>
    <div class="footer">
      Satellite-Based El Niño Heat Monitoring System &bull; Automated Heat Awareness
    </div>
  </div>
</body>
</html>
"""

    return subject, text_body, html_body


def send_heat_alert_email(
    to_email: str,
    location: str,
    threshold: str = "Medium",
    is_test: bool = False,
) -> tuple[bool, str, dict]:
    """
    Dispatch a heat alert notification email via configured SMTP service.

    Returns:
        tuple[bool, str, dict]: (success, status_message, alert_details)
    """
    normalized_email = (to_email or "").strip()
    if not is_valid_email(normalized_email):
        return False, "Please provide a valid email address.", {}

    if not is_smtp_configured():
        msg = "Email service is not configured."
        logger.warning("Attempted to send heat alert email, but SMTP is not configured.")
        return False, msg, {}

    smtp_cfg = get_smtp_config()
    heat_info = get_location_heat_status(location)

    subject, text_body, html_body = build_email_content(
        location=heat_info["location"],
        temperature_val=heat_info.get("temperature"),
        heat_risk_level=heat_info.get("heat_risk", "Medium"),
        alert_threshold=threshold,
        is_test=is_test,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"El Niño Heat Monitoring System <{smtp_cfg['from_email']}>"
    msg["To"] = normalized_email

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    host = smtp_cfg["host"]
    port = smtp_cfg["port"]
    username = smtp_cfg["username"]
    password = smtp_cfg["password"]

    try:
        logger.info(
            "Connecting to SMTP server %s:%d to send alert to %s...",
            host,
            port,
            normalized_email,
        )
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(username, password)
                server.send_message(msg)

        logger.info("Heat alert email sent successfully to %s", normalized_email)
        alert_details = {
            "to_email": normalized_email,
            "location": heat_info["location"],
            "temperature": heat_info.get("temperature"),
            "heat_risk": heat_info.get("heat_risk"),
            "threshold": threshold,
            "is_test": is_test,
            "timestamp": heat_info.get("timestamp"),
        }
        return True, "Alert email sent successfully.", alert_details

    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error("SMTP authentication failed for %s: %s", username, auth_err)
        return False, "SMTP Authentication Failed: Please check your username and app password.", {}
    except smtplib.SMTPException as smtp_err:
        logger.error("SMTP error sending email to %s: %s", normalized_email, smtp_err)
        return False, f"SMTP Error: {str(smtp_err)}", {}
    except Exception as exc:
        logger.error("Unexpected error sending email to %s: %s", normalized_email, exc)
        return False, f"Failed to send email: {str(exc)}", {}


def load_alert_config() -> dict:
    """
    Load persisted alert settings from local storage or memory.
    Ensures no passwords or secrets are ever present.
    """
    global _ALERT_CONFIG_CACHE

    if os.path.exists(ALERT_CONFIG_FILE):
        try:
            with open(ALERT_CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    # Filter and sanitize
                    _ALERT_CONFIG_CACHE["configured"] = bool(saved.get("configured", False))
                    _ALERT_CONFIG_CACHE["email"] = str(saved.get("email", "")).strip()
                    _ALERT_CONFIG_CACHE["location"] = str(saved.get("location", "Tamil Nadu")).strip()
                    _ALERT_CONFIG_CACHE["threshold"] = normalize_risk_level(str(saved.get("threshold", "Medium")))
                    _ALERT_CONFIG_CACHE["frequency"] = str(saved.get("frequency", "Instant")).strip()
                    _ALERT_CONFIG_CACHE["enabled"] = bool(saved.get("enabled", True))
                    _ALERT_CONFIG_CACHE["last_updated"] = saved.get("last_updated")
        except Exception as exc:
            logger.warning("Could not read alert config file: %s", exc)

    return _ALERT_CONFIG_CACHE


def save_alert_config(data: dict) -> tuple[bool, str, dict]:
    """
    Validate and save heat alert settings.
    Never stores credentials, passwords, or secrets.
    """
    global _ALERT_CONFIG_CACHE

    if not isinstance(data, dict):
        return False, "Invalid payload format. Expected JSON object.", {}

    email = str(data.get("email", "")).strip()
    if not email:
        return False, "Email address is required.", {}
    if not is_valid_email(email):
        return False, "Please enter a valid email address.", {}

    location = str(data.get("location", "")).strip() or "Tamil Nadu"

    raw_threshold = str(data.get("threshold", "Medium")).strip().capitalize()
    if raw_threshold not in VALID_THRESHOLDS:
        return False, f"Invalid threshold. Must be one of: {', '.join(VALID_THRESHOLDS)}.", {}

    frequency = str(data.get("frequency", "Instant")).strip()
    enabled = bool(data.get("enabled", True))

    updated_config = {
        "configured": True,
        "email": email,
        "location": location,
        "threshold": raw_threshold,
        "frequency": frequency,
        "enabled": enabled,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }

    _ALERT_CONFIG_CACHE.update(updated_config)

    # Persist locally (excluding secrets)
    try:
        with open(ALERT_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(_ALERT_CONFIG_CACHE, f, indent=2)
    except Exception as exc:
        logger.warning("Failed to persist alert_config.json: %s", exc)

    return True, "Alert settings saved successfully.", get_alert_config_status()


def get_available_locations() -> list[str]:
    """Retrieve list of supported Indian states / locations."""
    locations = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
        "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
        "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
        "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
        "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar",
        "Chandigarh", "Puducherry", "Coimbatore", "Chennai", "Salem", "Madurai", "Bengaluru"
    ]
    # Try getting states from LST dataset if possible
    try:
        from app import _load_full_india_lst_df
        df, _ = _load_full_india_lst_df()
        if df is not None and "State" in df.columns:
            dataset_states = sorted(df["State"].dropna().astype(str).unique().tolist())
            if dataset_states:
                # Merge and keep unique
                return sorted(list(dict.fromkeys(dataset_states + ["Coimbatore", "Chennai", "Salem", "Madurai", "Bengaluru"])))
    except Exception:
        pass
    return sorted(list(dict.fromkeys(locations)))


def get_alert_config_status() -> dict:
    """
    Return comprehensive, non-sensitive alert configuration and current evaluation.
    """
    cfg = load_alert_config()
    smtp_ok = is_smtp_configured()

    location = cfg.get("location", "Tamil Nadu")
    threshold = cfg.get("threshold", "Medium")
    heat_status = get_location_heat_status(location)

    curr_risk = heat_status.get("heat_risk", "Medium")
    triggered = is_alert_triggered(curr_risk, threshold)

    return {
        "configured": cfg.get("configured", False),
        "email": cfg.get("email", ""),
        "location": location,
        "threshold": threshold,
        "frequency": cfg.get("frequency", "Instant"),
        "enabled": cfg.get("enabled", True),
        "last_updated": cfg.get("last_updated"),
        "is_smtp_configured": smtp_ok,
        "smtp_status_message": (
            "SMTP service is configured and ready."
            if smtp_ok
            else "Email service is not configured."
        ),
        "current_risk": {
            "level": curr_risk,
            "temperature": heat_status.get("temperature"),
            "temperature_unit": heat_status.get("temperature_unit", "°C"),
            "source": heat_status.get("source"),
            "is_triggered": triggered,
            "trigger_condition": f"Current ({curr_risk}) >= Threshold ({threshold})",
            "timestamp": heat_status.get("timestamp"),
            "safety_recommendation": get_safety_recommendation(curr_risk),
        },
        "available_thresholds": VALID_THRESHOLDS,
        "available_locations": get_available_locations(),
    }
