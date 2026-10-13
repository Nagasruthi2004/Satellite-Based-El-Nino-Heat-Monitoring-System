"""
Email Heat Alerts Service Module
================================
Provides enterprise-grade SMTP email delivery, alert preferences persistence,
heat-risk threshold evaluation, duplicate alert prevention (cooldown & escalation tracking),
and background monitoring for the Smart El Niño Heat Monitoring System.
"""

import os
import re
import json
import time
import socket
import ssl
import logging
import smtplib
import threading
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from dotenv import load_dotenv

# Ensure backend .env is loaded from absolute path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(DOTENV_PATH):
    load_dotenv(dotenv_path=DOTENV_PATH)

logger = logging.getLogger("email_service")

# Import weather and heat risk utilities
try:
    from weather import fetch_weather, is_weather_api_configured
except ImportError:
    fetch_weather = None
    is_weather_api_configured = lambda: False

try:
    from heat_risk import classify_current_heat_risk
except ImportError:
    classify_current_heat_risk = None

# Default paths for persistence
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PREFERENCES_FILE = os.path.join(DATA_DIR, "alert_preferences.json")
SUBSCRIBERS_FILE = os.path.join(DATA_DIR, "subscribers.json")
STATE_FILE = os.path.join(DATA_DIR, "alert_state.json")

# RFC 5322 compliant simplified email regex
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)

# Known placeholder values that indicate unconfigured SMTP
PLACEHOLDER_STRINGS = {
    "your_openweather_api_key_here",
    "your_new_openweather_api_key",
    "your_gemini_api_key_here",
    "your_new_gemini_api_key",
    "your_email@gmail.com",
    "your_actual_gmail@gmail.com",
    "your_actual_email@gmail.com",
    "your_16_character_app_password",
    "your_16_character_gmail_app_password",
    "your_gmail_app_password",
    "your_password_here",
    "smtp.example.com",
    "example.com",
    "changeme",
    "none",
    "null",
}


def validate_email_address(email: str) -> tuple[bool, str]:
    """
    Validate an email address syntax according to standard format rules.
    Returns (is_valid, error_message).
    """
    if not email or not isinstance(email, str):
        return False, "Email address is required."

    email = email.strip()
    if len(email) < 5 or len(email) > 254:
        return False, "Email length must be between 5 and 254 characters."

    if not EMAIL_REGEX.match(email):
        return False, "Please enter a valid email address (e.g., user@example.com)."

    domain = email.split("@")[-1]
    if "." not in domain or domain.startswith(".") or domain.endswith("."):
        return False, "Invalid email domain."

    tld = domain.split(".")[-1]
    if len(tld) < 2 or not tld.isalpha():
        return False, "Invalid top-level domain in email address."

    return True, ""


def normalize_threshold(threshold_str: str | None) -> str:
    """
    Robustly normalize threshold string to one of: 'Low', 'Medium', 'High', 'Critical'.
    Handles case-insensitivity and variations like 'Low Risk', 'Critical Only', 'all levels', etc.
    Defaults to 'High' if unparseable or None.
    """
    if not threshold_str:
        return "High"
    raw = str(threshold_str).strip().lower()
    if "crit" in raw:
        return "Critical"
    if "high" in raw:
        return "High"
    if "med" in raw:
        return "Medium"
    if "low" in raw or "all" in raw:
        return "Low"
    return "High"


def get_smtp_config() -> dict:
    """
    Retrieve and sanitize SMTP configuration from environment variables.
    """
    if os.path.exists(DOTENV_PATH):
        load_dotenv(dotenv_path=DOTENV_PATH)

    host = (os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or "").strip()
    port_raw = (os.getenv("SMTP_PORT") or "587").strip()
    username = (os.getenv("SMTP_USERNAME") or os.getenv("SMTP_EMAIL") or "").strip()
    password = (os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or os.getenv("SMTP_APP_PASSWORD") or "").strip()

    # Normalize 16-character Google App Password format (e.g. "bfhn egpu kbru jmtg" -> "bfhnegpukbrujmtg")
    if len(password) == 19 and password.count(" ") == 3 and not (password.startswith('"') or password.startswith("'")):
        password = password.replace(" ", "")

    from_email = (
        os.getenv("SMTP_FROM_EMAIL")
        or os.getenv("ALERT_FROM_EMAIL")
        or os.getenv("SMTP_EMAIL")
        or username
    )
    from_email = (from_email or "").strip()
    from_name = (os.getenv("SMTP_FROM_NAME") or "Smart El Niño Heat Monitoring System").strip()

    try:
        port = int(port_raw)
    except (ValueError, TypeError):
        port = 587

    # TLS / SSL configuration resolution
    use_ssl_env = os.getenv("SMTP_USE_SSL")
    if use_ssl_env is not None and use_ssl_env.strip() != "":
        use_ssl = use_ssl_env.strip().lower() in ("true", "1", "yes")
    else:
        use_ssl = (port == 465)

    use_tls_env = os.getenv("SMTP_USE_TLS")
    if use_tls_env is not None and use_tls_env.strip() != "":
        use_tls = use_tls_env.strip().lower() in ("true", "1", "yes")
    else:
        use_tls = (port == 587) and not use_ssl

    # Ensure no conflicting settings: if SSL is active, STARTTLS is not used
    if use_ssl:
        use_tls = False

    try:
        cooldown = int(os.getenv("ALERT_COOLDOWN_MINUTES", "60"))
    except (ValueError, TypeError):
        cooldown = 60

    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "from_email": from_email,
        "from_name": from_name,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
        "cooldown_minutes": max(5, cooldown),
    }


def is_smtp_configured() -> tuple[bool, list[str]]:
    """
    Check if central SMTP credentials are fully and authentically configured.
    Returns (is_configured, list_of_missing_fields_or_reasons).
    """
    cfg = get_smtp_config()
    missing = []

    if not cfg["host"] or cfg["host"].lower() in PLACEHOLDER_STRINGS:
        missing.append("SMTP_HOST")
    if not cfg["username"] or cfg["username"].lower() in PLACEHOLDER_STRINGS:
        missing.append("SMTP_USERNAME")
    if not cfg["password"] or cfg["password"].lower() in PLACEHOLDER_STRINGS:
        missing.append("SMTP_PASSWORD")
    if not cfg["from_email"] or cfg["from_email"].lower() in PLACEHOLDER_STRINGS:
        missing.append("SMTP_FROM_EMAIL (or ALERT_FROM_EMAIL)")

    if missing:
        return False, missing

    # Validate from_email format
    valid_from, err = validate_email_address(cfg["from_email"])
    if not valid_from:
        return False, [f"Invalid sender address ({cfg['from_email']}): {err}"]

    return True, []


def get_public_smtp_status() -> dict:
    """
    Return a safe, non-sensitive summary of the SMTP configuration.
    Never exposes passwords or sensitive auth tokens.
    """
    cfg = get_smtp_config()
    configured, missing = is_smtp_configured()

    return {
        "configured": configured,
        "host": cfg["host"] if cfg["host"] and cfg["host"].lower() not in PLACEHOLDER_STRINGS else "",
        "port": cfg["port"],
        "from_email": cfg["from_email"] if cfg["from_email"] and cfg["from_email"].lower() not in PLACEHOLDER_STRINGS else "",
        "from_name": cfg["from_name"],
        "use_tls": cfg["use_tls"],
        "use_ssl": cfg["use_ssl"],
        "cooldown_minutes": cfg["cooldown_minutes"],
        "missing_fields": missing,
    }


def send_email_smtp(
    to_email: str,
    subject: str,
    plain_text: str,
    html_content: str | None = None,
    timeout: int = 15,
) -> dict:
    """
    Send an email via configured central SMTP server with detailed error handling and validation.

    Returns:
        dict: {"success": bool, "message": str, "error": str|None, "timestamp": str}
    """
    # 1. Validate recipient email
    is_valid, err_msg = validate_email_address(to_email)
    if not is_valid:
        logger.warning("Email send rejected: invalid recipient email '%s': %s", to_email, err_msg)
        return {
            "success": False,
            "error": f"Invalid recipient email: {err_msg}",
            "error_type": "validation_error",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # 2. Validate central SMTP configuration
    configured, missing = is_smtp_configured()
    if not configured:
        msg = f"Email delivery is not configured yet. Missing or invalid settings: {', '.join(missing)} in backend/.env"
        logger.error(msg)
        return {
            "success": False,
            "error": msg,
            "error_type": "configuration_missing",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    cfg = get_smtp_config()
    timestamp_iso = datetime.now(timezone.utc).isoformat()

    # 3. Construct MIME Message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
    msg["To"] = to_email.strip()
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=cfg["host"] if "." in cfg["host"] else "elnino.heatmonitoring.org")
    msg["X-Priority"] = "1" if "CRITICAL" in subject.upper() else "3"

    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    if html_content:
        msg.attach(MIMEText(html_content, "html", "utf-8"))

    # 4. Connect and deliver via SMTP
    server = None
    try:
        ssl_context = ssl.create_default_context()

        if cfg["use_ssl"]:
            logger.info(
                "Connecting via smtplib.SMTP_SSL to %s:%d (SSL=True, timeout=%ds) for recipient %s...",
                cfg["host"], cfg["port"], timeout, to_email
            )
            server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=timeout, context=ssl_context)
            server.ehlo()
        else:
            logger.info(
                "Connecting via smtplib.SMTP to %s:%d (STARTTLS=%s, timeout=%ds) for recipient %s...",
                cfg["host"], cfg["port"], cfg["use_tls"], timeout, to_email
            )
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=timeout)
            server.ehlo()

            if cfg["use_tls"]:
                server.starttls(context=ssl_context)
                server.ehlo()

        server.login(cfg["username"], cfg["password"])
        server.sendmail(cfg["from_email"], [to_email.strip()], msg.as_string())
        server.quit()
        server = None

        logger.info("Successfully dispatched email to %s (Subject: '%s')", to_email, subject)
        return {
            "success": True,
            "message": f"Email successfully accepted by mail server and dispatched to {to_email}.",
            "timestamp": timestamp_iso,
        }

    except smtplib.SMTPAuthenticationError as exc:
        err = f"SMTP Authentication Failed ({exc.smtp_code}: {exc.smtp_error.decode('utf-8', errors='ignore') if isinstance(exc.smtp_error, bytes) else exc.smtp_error}). For Gmail, ensure you are using a 16-character Google App Password with 2-Step Verification enabled."
        logger.error("SMTP Auth Error: %s", err)
        return {
            "success": False,
            "error": err,
            "error_type": "authentication_error",
            "timestamp": timestamp_iso,
        }

    except (smtplib.SMTPConnectError, socket.gaierror, ConnectionRefusedError, ConnectionResetError) as exc:
        err = f"Failed to connect to SMTP host '{cfg['host']}' on port {cfg['port']}: {exc}. Please verify network connection and ensure outbound SMTP traffic is permitted by your firewall or ISP."
        logger.error("SMTP Connection Error: %s", err)
        return {
            "success": False,
            "error": err,
            "error_type": "connection_error",
            "timestamp": timestamp_iso,
        }

    except (socket.timeout, TimeoutError) as exc:
        err = f"Connection to SMTP server '{cfg['host']}:{cfg['port']}' timed out ({timeout}s limit reached)."
        logger.error("SMTP Timeout Error: %s", err)
        return {
            "success": False,
            "error": err,
            "error_type": "timeout_error",
            "timestamp": timestamp_iso,
        }

    except smtplib.SMTPRecipientsRefused as exc:
        err = f"Recipient address rejected by mail server: {exc}"
        logger.error("SMTP Recipient Error: %s", err)
        return {
            "success": False,
            "error": err,
            "error_type": "recipient_refused",
            "timestamp": timestamp_iso,
        }

    except smtplib.SMTPServerDisconnected as exc:
        err = f"SMTP server unexpectedly disconnected: {exc}. Please check your TLS/SSL settings and port (587 for STARTTLS, 465 for SSL)."
        logger.error("SMTP Disconnect Error: %s", err)
        return {
            "success": False,
            "error": err,
            "error_type": "server_disconnected",
            "timestamp": timestamp_iso,
        }

    except smtplib.SMTPException as exc:
        err = f"SMTP protocol error: {exc}"
        logger.error("SMTP Protocol Error: %s", err)
        return {
            "success": False,
            "error": err,
            "error_type": "smtp_protocol_error",
            "timestamp": timestamp_iso,
        }

    except Exception as exc:
        err = f"Unexpected error during email delivery: {exc}"
        logger.error("Unexpected Email Error: %s", err, exc_info=True)
        return {
            "success": False,
            "error": err,
            "error_type": "system_error",
            "timestamp": timestamp_iso,
        }

    finally:
        if server is not None:
            try:
                server.close()
            except Exception:
                pass


# ── TEMPLATE BUILDERS ──

def build_test_email(to_email: str) -> tuple[str, str, str]:
    """
    Generate subject, plain text, and styled HTML for a verification/test email.
    """
    cfg = get_smtp_config()
    timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    subject = "[Test Verification] Smart El Niño Heat Monitoring System Alert Service"

    plain_text = f"""
Smart El Niño Heat Monitoring System - Test Email Verification
=============================================================

Hello,

This is a test notification verifying that the central Email Heat Alert delivery pipeline is functioning correctly.

Delivery Details:
- Recipient: {to_email}
- Sender Host: {cfg['host']} (Port {cfg['port']})
- Time Dispatched: {timestamp_str}
- System Status: Operational & Ready for Heat Risk Monitoring

You will receive automated warning alerts whenever extreme surface temperatures or high heat risks are detected for your subscribed location.

Stay safe and hydrated!
Smart El Niño Climate & Heat Intelligence Team
    """.strip()

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email Verification</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f1f5f9; }}
  .container {{ max-width: 600px; margin: 30px auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
  .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 28px 24px; text-align: center; }}
  .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; }}
  .header p {{ margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe; opacity: 0.9; }}
  .badge {{ display: inline-block; background-color: #10b981; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }}
  .body {{ padding: 28px 24px; }}
  .card {{ background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 18px; margin: 20px 0; }}
  .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }}
  .detail-row:last-child {{ border-bottom: none; }}
  .detail-label {{ color: #94a3b8; font-weight: 500; }}
  .detail-value {{ color: #f8fafc; font-weight: 600; }}
  .footer {{ background-color: #0f172a; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Verification Success</div>
      <h1>Smart El Niño Heat Alert System</h1>
      <p>Satellite, Meteorological &amp; Climate Intelligence</p>
    </div>
    <div class="body">
      <h2 style="font-size: 18px; color: #38bdf8; margin-top: 0;">Test Email Delivery Verified</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
        Your email address has been successfully registered. The Smart El Niño Heat Monitoring System backend is ready to transmit early heat alerts when surface temperatures exceed your selected safety thresholds.
      </p>
      <div class="card">
        <div class="detail-row">
          <span class="detail-label">Recipient:</span>
          <span class="detail-value">{to_email}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">SMTP Gateway:</span>
          <span class="detail-value">{cfg['host']}:{cfg['port']}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Dispatch Time:</span>
          <span class="detail-value">{timestamp_str}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pipeline Status:</span>
          <span class="detail-value" style="color: #34d399;">● Operational</span>
        </div>
      </div>
      <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">
        You can configure your monitored city and risk threshold anytime in the application dashboard.
      </p>
    </div>
    <div class="footer">
      Automated dispatch from Smart El Niño Heat Monitoring System.<br>
      Protecting communities from extreme climate events.
    </div>
  </div>
</body>
</html>
    """.strip()

    return subject, plain_text, html_content


def send_test_email(to_email: str) -> dict:
    """
    Send a separate SMTP verification test email.
    Explicitly decoupled from real heat alerts.
    """
    logger.info("[SMTP Test] Sending SMTP verification test email to %s (Subject: '[Test Verification] Smart El Niño Heat Monitoring System Alert Service')", to_email)
    subject, plain_text, html_content = build_test_email(to_email)
    res = send_email_smtp(
        to_email=to_email,
        subject=subject,
        plain_text=plain_text,
        html_content=html_content,
    )
    res["subject"] = subject
    res["plain_text"] = plain_text
    res["html_content"] = html_content
    return res




def build_heat_alert_email(
    to_email: str,
    city: str,
    risk_level: str,
    risk_score: float,
    temperature: float,
    humidity: float | None = None,
    wind_speed: float | None = None,
    rainfall: float | None = None,
    weather_desc: str | None = None,
    threshold: str = "High",
    confidence: float = 85.0,
    country: str | None = None,
    dashboard_url: str | None = None,
    observed_time: str | None = None,
) -> tuple[str, str, str]:
    """
    Generate subject, plain text, and styled HTML for a real heat risk alert.
    Dynamically generates subject: [{RISK_LEVEL} HEAT ALERT] {city} — {temperature:.1f}°C
    Supports all four risk levels: Low, Medium, High, and Critical.
    Only displays available weather measurements without inventing missing fields.
    """
    timestamp_str = observed_time or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    norm_risk = (risk_level or "Low").strip().capitalize()
    risk_lower = norm_risk.lower()
    risk_upper = norm_risk.upper()

    dash_url = dashboard_url or os.getenv("DASHBOARD_URL") or os.getenv("FRONTEND_URL") or "http://localhost:5173"

    # Subject line dynamically generated per requirement: [{RISK_LEVEL} HEAT ALERT] {city} — {temperature:.1f}°C
    subject = f"[{risk_upper} HEAT ALERT] {city} — {temperature:.1f}°C"

    # Resolve country
    country_str = (country or "").strip()
    if not country_str and "," in city:
        parts = [p.strip() for p in city.split(",") if p.strip()]
        if len(parts) > 1:
            country_str = parts[-1]

    norm_thresh = str(threshold or "High").strip().capitalize()
    if norm_thresh == "Critical":
        threshold_desc = "Critical (≥40°C)"
        threshold_cutoff_str = "≥40°C"
        policy_desc = "Your Critical threshold setting allows alerts exclusively for extreme heat emergencies (≥40°C)."
    elif norm_thresh == "High":
        threshold_desc = "High (≥36°C)"
        threshold_cutoff_str = "≥36°C"
        policy_desc = "Your High threshold setting allows alerts for High and Critical heat conditions (≥36°C)."
    elif norm_thresh == "Medium":
        threshold_desc = "Medium (≥30°C)"
        threshold_cutoff_str = "≥30°C"
        policy_desc = "Your Medium threshold setting allows alerts for Medium, High, and Critical risk levels (≥30°C)."
    else:
        norm_thresh = "Low"
        threshold_desc = "Low (All Risk Levels: Low, Medium, High, Critical)"
        threshold_cutoff_str = "All Levels"
        policy_desc = "Your Low threshold setting allows alerts for all risk levels."

    why_triggered = (
        f"Evaluated risk: {norm_risk}. {policy_desc} "
        f"Current observed temperature in {city} is {temperature:.1f}°C (Severity score: {risk_score:.1f}/100), "
        f"which meets or exceeds your configured alert policy."
    )

    # Actionable safety recommendations tailored to each of the four risk levels
    if risk_lower == "critical":
        action_bullets = [
            "DANGEROUS CRITICAL HEAT: STAY INDOORS during peak afternoon hours (11:00 AM – 4:00 PM).",
            "Hydrate constantly — drink cool water and ORS/electrolytes even before feeling thirsty.",
            "NEVER leave children, vulnerable individuals, or pets in closed vehicles or unventilated rooms.",
            "Utilize shaded municipal cooling centers, fans, or air-conditioning to keep core body temperature safe.",
            "Watch for heat stroke warning signs: hot/red dry skin, rapid pulse, confusion, vomiting, or loss of consciousness. Call emergency services (112 / 108) immediately if symptoms appear.",
        ]
        header_color = "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)"
        badge_bg = "#b91c1c"
        badge_text = "CRITICAL HEAT RISK"
        highlight_color = "#f87171"
        alert_bg = "#450a0a"
        alert_border = "#ef4444"
        alert_title_color = "#fca5a5"
    elif risk_lower == "high":
        action_bullets = [
            "Limit prolonged outdoor physical exertion during afternoon peak heat hours (11:00 AM – 4:00 PM).",
            "Increase daily fluid intake and wear light, loose-fitting cotton clothing.",
            "Stay in well-ventilated or air-conditioned indoor spaces whenever possible.",
            "Check frequently on vulnerable neighbors, seniors, young children, and outdoor workers.",
            "Watch for heat exhaustion symptoms: heavy sweating, fatigue, weakness, headache, or dizziness.",
        ]
        header_color = "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)"
        badge_bg = "#9a3412"
        badge_text = "HIGH HEAT RISK"
        highlight_color = "#fb923c"
        alert_bg = "#431407"
        alert_border = "#ea580c"
        alert_title_color = "#fdba74"
    elif risk_lower == "medium":
        action_bullets = [
            "Moderately warm conditions: pace strenuous outdoor physical activities and sports.",
            "Drink water regularly throughout the day; avoid excessive caffeine or high-sugar drinks.",
            "Wear lightweight, loose-fitting, light-colored clothing and broad-brimmed sun protection.",
            "Take scheduled rest breaks in shaded or ventilated areas during outdoor work.",
            "Ensure children, seniors, and pets have access to ample cool drinking water and shade.",
        ]
        header_color = "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
        badge_bg = "#92400e"
        badge_text = "MEDIUM HEAT RISK"
        highlight_color = "#fbbf24"
        alert_bg = "#451a03"
        alert_border = "#d97706"
        alert_title_color = "#fde68a"
    else:  # Low
        action_bullets = [
            "Comfortable ambient conditions: safe for normal outdoor work and recreational activities.",
            "Maintain baseline daily hydration (at least 2 litres of drinking water).",
            "Use UV sunglasses or light headwear during midday hours if exposed to direct sunlight.",
            "Stay informed on local weather updates for upcoming temperature increases or heat shifts.",
        ]
        header_color = "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
        badge_bg = "#075985"
        badge_text = "LOW HEAT RISK"
        highlight_color = "#38bdf8"
        alert_bg = "#082f49"
        alert_border = "#0284c7"
        alert_title_color = "#7dd3fc"

    # Live weather lines (only include available fields, do not invent missing measurements)
    weather_bullets_text = []
    if humidity is not None:
        weather_bullets_text.append(f"• Relative Humidity: {humidity:.0f}%" if float(humidity).is_integer() else f"• Relative Humidity: {humidity}%")
    if wind_speed is not None:
        weather_bullets_text.append(f"• Wind Speed: {wind_speed:.1f} km/h")
    if rainfall is not None:
        weather_bullets_text.append(f"• Rainfall: {rainfall:.1f} mm" if isinstance(rainfall, float) else f"• Rainfall: {rainfall} mm")
    if weather_desc:
        weather_bullets_text.append(f"• Observed Condition: {weather_desc}")

    if not weather_bullets_text:
        weather_bullets_text.append("• Additional atmospheric parameters: Not reported in this observation")

    # Plain text construction
    location_line = f"Location: {city}"
    if country_str:
        location_line += f"\nCountry: {country_str}"

    plain_text = f"""
[{risk_upper} HEAT ALERT] {city} — {temperature:.1f}°C
=============================================================
{location_line}
Current Temperature: {temperature:.1f}°C
Evaluated Heat Risk Level: {norm_risk} (Severity Score: {risk_score:.1f}/100)
Configured Alert Policy: {norm_thresh} Threshold ({threshold_cutoff_str})

Why This Alert Was Triggered:
{why_triggered}

Observation Timestamp: {timestamp_str}

Live Weather Conditions:
{"\n".join(weather_bullets_text)}

Recommended Heat-Safety Recommendations:
{"\n".join(f"• {b}" if not b.startswith("•") else b for b in action_bullets)}

Live Heat Monitoring Dashboard:
Access real-time monitoring and update preferences at: {dash_url}

Automated advisory dispatched by the Smart El Niño Heat Monitoring System.
To manage thresholds or unsubscribe, visit the Heat Alerts section in the dashboard.
""".strip()

    # HTML metric cards: only include available measurements
    metric_cards_html = f"""
        <div class="metric-card">
          <span class="metric-label">Current Temperature</span>
          <span class="metric-value highlight">{temperature:.1f}°C</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Evaluated Risk Level</span>
          <span class="metric-value highlight">{norm_risk}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Severity Score</span>
          <span class="metric-value">{risk_score:.1f} / 100</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Configured Policy</span>
          <span class="metric-value">{norm_thresh} ({threshold_cutoff_str})</span>
        </div>
    """
    if humidity is not None:
        metric_cards_html += f"""
        <div class="metric-card">
          <span class="metric-label">Relative Humidity</span>
          <span class="metric-value">{humidity:.0f}%</span>
        </div>
        """
    if wind_speed is not None:
        metric_cards_html += f"""
        <div class="metric-card">
          <span class="metric-label">Wind Speed</span>
          <span class="metric-value">{wind_speed:.1f} km/h</span>
        </div>
        """
    if rainfall is not None:
        metric_cards_html += f"""
        <div class="metric-card">
          <span class="metric-label">Rainfall</span>
          <span class="metric-value">{rainfall} mm</span>
        </div>
        """

    country_subhead = f"<p style='margin: 4px 0 0 0; font-size: 14px; opacity: 0.95;'>Country / Region: <strong>{country_str}</strong></p>" if country_str else ""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[{risk_upper} HEAT ALERT] {city} — {temperature:.1f}°C</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f1f5f9; }}
  .container {{ max-width: 620px; margin: 24px auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 12px 30px rgba(0,0,0,0.6); }}
  .header {{ background: {header_color}; padding: 26px 24px; text-align: center; color: #ffffff; }}
  .badge {{ display: inline-block; background-color: {badge_bg}; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.3); }}
  .header h1 {{ margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; }}
  .header p {{ margin: 6px 0 0 0; font-size: 14px; color: #fef2f2; opacity: 0.95; }}
  .body {{ padding: 24px; }}
  .why-box {{ background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; line-height: 1.5; color: #cbd5e1; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }}
  .metric-card {{ background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; text-align: center; }}
  .metric-label {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }}
  .metric-value {{ font-size: 20px; font-weight: 700; color: #f8fafc; }}
  .metric-value.highlight {{ color: {highlight_color}; }}
  .alert-box {{ background-color: {alert_bg}; border-left: 4px solid {alert_border}; padding: 16px; border-radius: 4px; margin: 20px 0; }}
  .alert-title {{ font-size: 15px; font-weight: 700; color: {alert_title_color}; margin-top: 0; margin-bottom: 8px; }}
  .alert-box ul {{ margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #e2e8f0; }}
  .btn-wrapper {{ text-align: center; margin: 26px 0 16px 0; }}
  .dashboard-btn {{ display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; padding: 12px 26px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(37,99,235,0.4); }}
  .footer {{ background-color: #0f172a; padding: 18px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">{badge_text}</div>
      <h1>{city} — {temperature:.1f}°C</h1>
      {country_subhead}
      <p>Evaluated Risk: <strong>{norm_risk}</strong> &bull; Alert Policy: {norm_thresh} Threshold ({threshold_cutoff_str})</p>
    </div>
    <div class="body">
      <div class="why-box">
        <strong style="color: #93c5fd;">Why this alert was triggered:</strong> {why_triggered}
      </div>

      <div class="grid">
        {metric_cards_html}
      </div>

      <div class="alert-box">
        <h3 class="alert-title">Recommended Heat-Safety Recommendations</h3>
        <ul>
          {"".join(f"<li>{b}</li>" for b in action_bullets)}
        </ul>
      </div>

      <div class="btn-wrapper">
        <a href="{dash_url}" class="dashboard-btn">Open Live Heat Monitoring Dashboard &rarr;</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; margin-top: 20px; margin-bottom: 0;">
        Observed condition: <strong>{weather_desc}</strong> &bull; Observation Timestamp: <strong>{timestamp_str}</strong>
      </p>
    </div>
    <div class="footer">
      Automated climate advisory from the Smart El Ni&ntilde;o Heat Monitoring System.<br>
      To modify alert thresholds or manage subscriptions, visit the Heat Alerts section in your dashboard.
    </div>
  </div>
</body>
</html>
""".strip()

    return subject, plain_text, html_content


def send_heat_alert_email(
    to_email: str,
    city: str,
    risk_level: str,
    risk_score: float,
    temperature: float,
    humidity: float | None = None,
    wind_speed: float | None = None,
    rainfall: float | None = None,
    weather_desc: str | None = None,
    threshold: str = "High",
    confidence: float = 85.0,
    country: str | None = None,
    dashboard_url: str | None = None,
    observed_time: str | None = None,
) -> dict:
    """
    Send an actual heat-alert email using the dedicated heat-alert email template.
    Uses the real monitored city, country, temperature in °C, risk level, threshold,
    observation timestamp, and practical safety advice.
    Strictly separate from SMTP verification test emails.
    """
    subject, plain_text, html_content = build_heat_alert_email(
        to_email=to_email,
        city=city,
        risk_level=risk_level,
        risk_score=risk_score,
        temperature=temperature,
        humidity=humidity,
        wind_speed=wind_speed,
        rainfall=rainfall,
        weather_desc=weather_desc,
        threshold=threshold,
        confidence=confidence,
        country=country,
        dashboard_url=dashboard_url,
        observed_time=observed_time,
    )
    logger.info(
        "[Heat Alert Email] Dispatching REAL heat alert email to %s for city='%s' (temp=%.1f°C, risk=%s, threshold=%s)",
        to_email, city, temperature, risk_level, threshold
    )
    res = send_email_smtp(
        to_email=to_email,
        subject=subject,
        plain_text=plain_text,
        html_content=html_content,
    )
    res["subject"] = subject
    res["plain_text"] = plain_text
    res["html_content"] = html_content
    return res




# ── SUBSCRIBERS & STATE MANAGERS ──

class SubscribersManager:
    """
    Thread-safe manager for user alert registrations / subscribers.
    Stores registrations persistently in backend/data/subscribers.json.
    Prevents duplicate entries by indexing by normalized email address.
    """
    def __init__(self, filepath: str = SUBSCRIBERS_FILE):
        self.filepath = filepath
        self._lock = threading.RLock()
        self._ensure_dir()

    def _ensure_dir(self):
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)

    def load(self) -> dict:
        with self._lock:
            if not os.path.exists(self.filepath):
                return {}
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data if isinstance(data, dict) else {}
            except Exception as exc:
                logger.error("Failed to load subscribers file: %s", exc)
                return {}

    def get_subscriber(self, email: str) -> dict | None:
        if not email:
            return None
        with self._lock:
            data = self.load()
            return data.get(email.strip().lower())

    def get_all_subscribers(self, only_active: bool = False) -> list[dict]:
        with self._lock:
            data = self.load()
            subscribers = list(data.values())
            if only_active:
                return [s for s in subscribers if s.get("enabled", False)]
            return subscribers

    def count_subscribers(self) -> dict:
        with self._lock:
            data = self.load()
            total = len(data)
            active = sum(1 for s in data.values() if s.get("enabled", False))
            return {"total": total, "active": active}

    def register_subscriber(
        self,
        email: str,
        city: str,
        threshold: str = "High",
        enabled: bool = True,
        lat: float | None = None,
        lon: float | None = None,
    ) -> tuple[bool, dict, str, bool]:
        """
        Register a new subscriber or update an existing registration (preventing duplicate entries).
        Returns: (success, subscriber_dict, message, is_new)
        """
        valid, err = validate_email_address(email)
        if not valid:
            return False, {}, err, False

        norm_email = email.strip().lower()
        norm_city = (city or "").strip()
        if not norm_city:
            return False, {}, "City/region is required.", False

        norm_lat = None
        norm_lon = None
        if lat is not None:
            try:
                norm_lat = round(float(lat), 4)
            except (ValueError, TypeError):
                norm_lat = None
        if lon is not None:
            try:
                norm_lon = round(float(lon), 4)
            except (ValueError, TypeError):
                norm_lon = None

        norm_threshold = normalize_threshold(threshold)
        clean_thresh = norm_threshold
        now_iso = datetime.now(timezone.utc).isoformat()

        with self._lock:
            data = self.load()
            is_new = norm_email not in data
            registered_at = data[norm_email].get("registered_at", now_iso) if not is_new else now_iso

            subscriber = {
                "email": norm_email,
                "city": norm_city,
                "latitude": norm_lat,
                "longitude": norm_lon,
                "threshold": norm_threshold,
                "enabled": bool(enabled),
                "registered_at": registered_at,
                "last_updated": now_iso,
            }
            data[norm_email] = subscriber

            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
            except Exception as exc:
                logger.error("Failed to write subscribers file: %s", exc)
                return False, {}, f"Database write error: {exc}", False

            # Keep legacy single preferences manager in sync for backwards compatibility
            try:
                preferences_manager.save({
                    "email": norm_email,
                    "city": norm_city,
                    "latitude": norm_lat,
                    "longitude": norm_lon,
                    "threshold": norm_threshold,
                    "enabled": bool(enabled),
                })
            except Exception:
                pass

            msg = (
                f"Successfully registered {norm_email} for {norm_city} heat alerts ({norm_threshold} threshold)."
                if is_new
                else f"Updated alert registration preferences for {norm_email}."
            )
            return True, subscriber, msg, is_new

    def unsubscribe_subscriber(self, email: str) -> tuple[bool, str]:
        """
        Unsubscribe a user by removing their registration.
        Returns: (success, message)
        """
        valid, err = validate_email_address(email)
        if not valid:
            return False, err

        norm_email = email.strip().lower()
        with self._lock:
            data = self.load()
            if norm_email not in data:
                return False, f"Email '{norm_email}' is not currently registered for heat alerts."

            del data[norm_email]
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
            except Exception as exc:
                logger.error("Failed to write subscribers file during unsubscribe: %s", exc)
                return False, f"Database write error: {exc}"

            # Also disable in legacy single preferences manager if matching
            try:
                curr_pref = preferences_manager.load()
                if (curr_pref.get("email") or "").lower() == norm_email:
                    preferences_manager.save({"enabled": False})
            except Exception:
                pass

            return True, f"Successfully unsubscribed '{norm_email}' from heat risk alerts."


class AlertPreferencesManager:
    """Thread-safe manager for legacy alert preferences persistence."""
    def __init__(self, filepath: str = PREFERENCES_FILE):
        self.filepath = filepath
        self._lock = threading.RLock()
        self._ensure_dir()

    def _ensure_dir(self):
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)

    def load(self) -> dict:
        with self._lock:
            if not os.path.exists(self.filepath):
                return {
                    "email": "",
                    "city": "",
                    "threshold": "High",
                    "enabled": False,
                    "check_interval_minutes": 15,
                    "last_updated": None,
                }
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return {
                        "email": data.get("email", ""),
                        "city": data.get("city", ""),
                        "threshold": data.get("threshold", "High"),
                        "enabled": bool(data.get("enabled", False)),
                        "check_interval_minutes": int(data.get("check_interval_minutes", 15)),
                        "last_updated": data.get("last_updated"),
                    }
            except Exception as exc:
                logger.error("Failed to load preferences file: %s", exc)
                return {
                    "email": "",
                    "city": "",
                    "threshold": "High",
                    "enabled": False,
                    "check_interval_minutes": 15,
                    "last_updated": None,
                }

    def save(self, preferences: dict) -> dict:
        with self._lock:
            current = self.load()
            current.update({
                "email": preferences.get("email", current["email"]).strip(),
                "city": preferences.get("city", current["city"]).strip(),
                "threshold": normalize_threshold(preferences.get("threshold", current["threshold"])),
                "enabled": bool(preferences.get("enabled", current["enabled"])),
                "check_interval_minutes": max(5, int(preferences.get("check_interval_minutes", current.get("check_interval_minutes", 15)))),
                "last_updated": datetime.now(timezone.utc).isoformat(),
            })
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(current, f, indent=2)
            except Exception as exc:
                logger.error("Failed to write preferences file: %s", exc)
            return current


class AlertStateManager:
    """Thread-safe manager for tracking alert dispatch telemetry & duplicate cooldown state."""
    def __init__(self, filepath: str = STATE_FILE):
        self.filepath = filepath
        self._lock = threading.RLock()
        self._ensure_dir()

    def _ensure_dir(self):
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)

    def load(self) -> dict:
        with self._lock:
            if not os.path.exists(self.filepath):
                return {
                    "last_checked_time": None,
                    "last_alert_time": None,
                    "last_alert_level": None,
                    "last_alert_city": None,
                    "last_alert_temp": None,
                    "last_alert_status": "idle",
                    "last_alert_message": "No alerts have been dispatched yet.",
                    "last_test_time": None,
                    "last_test_status": None,
                    "last_test_error": None,
                    "subscriber_history": {},
                }
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if not isinstance(data.get("subscriber_history"), dict):
                        data["subscriber_history"] = {}
                    return data
            except Exception as exc:
                logger.error("Failed to load alert state file: %s", exc)
                return {
                    "last_checked_time": None,
                    "last_alert_time": None,
                    "last_alert_level": None,
                    "last_alert_city": None,
                    "last_alert_temp": None,
                    "last_alert_status": "idle",
                    "last_alert_message": "No alerts have been dispatched yet.",
                    "last_test_time": None,
                    "last_test_status": None,
                    "last_test_error": None,
                    "subscriber_history": {},
                }

    def update(self, updates: dict) -> dict:
        with self._lock:
            state = self.load()
            state.update(updates)
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(state, f, indent=2)
            except Exception as exc:
                logger.error("Failed to write alert state file: %s", exc)
            return state

    def get_subscriber_history(self, email: str) -> dict | None:
        if not email:
            return None
        with self._lock:
            state = self.load()
            history = state.get("subscriber_history", {})
            return history.get(email.strip().lower())

    def record_subscriber_check(
        self,
        email: str,
        city: str,
        temp: float | None,
        level: str | None,
        score: float | None,
        threshold: str,
        status: str,
        message: str,
        check_type: str = "background",
        timestamp_iso: str | None = None,
    ):
        if not email:
            return
        with self._lock:
            state = self.load()
            if not isinstance(state.get("subscriber_history"), dict):
                state["subscriber_history"] = {}
            norm_email = email.strip().lower()
            current_entry = dict(state["subscriber_history"].get(norm_email) or {})
            current_entry.update({
                "last_check_time": timestamp_iso or datetime.now(timezone.utc).isoformat(),
                "last_check_city": city,
                "last_check_temp": temp,
                "last_check_level": level,
                "last_check_score": score,
                "last_check_threshold": threshold,
                "last_check_status": status,
                "last_check_message": message,
                "last_check_type": check_type,
            })
            state["subscriber_history"][norm_email] = current_entry
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(state, f, indent=2)
            except Exception as exc:
                logger.error("Failed to record subscriber check history: %s", exc)

    def record_subscriber_alert(self, email: str, city: str, level: str, temp: float, timestamp_iso: str):
        if not email:
            return
        with self._lock:
            state = self.load()
            if not isinstance(state.get("subscriber_history"), dict):
                state["subscriber_history"] = {}
            norm_email = email.strip().lower()
            current_entry = dict(state["subscriber_history"].get(norm_email) or {})
            current_entry.update({
                "last_alert_time": timestamp_iso,
                "last_alert_city": city,
                "last_alert_level": level,
                "last_alert_temp": temp,
            })
            state["subscriber_history"][norm_email] = current_entry
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(state, f, indent=2)
            except Exception as exc:
                logger.error("Failed to record subscriber alert history: %s", exc)


# Global instances
subscribers_manager = SubscribersManager()
preferences_manager = AlertPreferencesManager()
state_manager = AlertStateManager()


# ── HEAT RISK EVALUATION & ALERT DISPATCH ──

def evaluate_and_send_heat_alert(
    city: str | None = None,
    email: str | None = None,
    threshold: str | None = None,
    force_send: bool = False,
    check_type: str = "background",
    lat: float | None = None,
    lon: float | None = None,
) -> dict:
    """
    Evaluate real live weather for a city or coordinates against configured threshold,
    apply duplicate alert cooldown and escalation rules, and dispatch alert email if needed.
    Clearly distinguishes manual on-demand checks from background-monitoring evaluations.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    now_dt = datetime.now(timezone.utc)
    timestamp_fmt = now_dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    type_tag = "[Manual Check]" if check_type == "manual" else "[Background Worker]"

    # 1. Resolve parameters from stored subscriber or preferences
    target_email = (email or "").strip()
    target_city = (city or "").strip()
    target_threshold = threshold
    target_lat = lat
    target_lon = lon

    # Always check subscriber registry or preferences if email is provided
    if target_email:
        sub = subscribers_manager.get_subscriber(target_email)
        if sub:
            if not target_city:
                target_city = (sub.get("city") or "").strip()
            if target_threshold is None or str(target_threshold).strip() == "":
                target_threshold = sub.get("threshold", "High")
            if target_lat is None:
                target_lat = sub.get("latitude") if sub.get("latitude") is not None else sub.get("lat")
            if target_lon is None:
                target_lon = sub.get("longitude") if sub.get("longitude") is not None else sub.get("lon")
        else:
            prefs = preferences_manager.load()
            if (prefs.get("email") or "").strip().lower() == target_email.lower():
                if not target_city:
                    target_city = (prefs.get("city") or "").strip()
                if target_threshold is None or str(target_threshold).strip() == "":
                    target_threshold = prefs.get("threshold", "High")
                if target_lat is None:
                    target_lat = prefs.get("latitude")
                if target_lon is None:
                    target_lon = prefs.get("longitude")

    clean_thresh = normalize_threshold(target_threshold)
    target_threshold = clean_thresh

    target_city = target_city.strip()
    target_email = target_email.strip()

    logger.info(
        "%s Stage 1 - Subscriber loaded: email=%s | city='%s' | threshold='%s' | coords=(%s, %s)",
        type_tag, target_email, target_city, target_threshold, target_lat, target_lon
    )

    if not target_city and (target_lat is None or target_lon is None):
        msg = f"{type_tag} {timestamp_fmt} | Alert evaluation failed: Monitored city/region or coordinates are required."
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_status": "error",
            "last_alert_message": msg,
        })
        return {
            "triggered": False,
            "sent": False,
            "status": "error",
            "error": msg,
            "timestamp": now_iso,
            "check_type": check_type,
        }

    # 2. Validate recipient email
    if not target_email:
        prefs = preferences_manager.load()
        target_email = (prefs.get("email") or "").strip()

    valid_email, err_email = validate_email_address(target_email)
    if not valid_email:
        loc_label = target_city or f"Coordinates ({target_lat}, {target_lon})"
        msg = f"{type_tag} {timestamp_fmt} | Alert evaluation failed for {loc_label}: {err_email}"
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_status": "error",
            "last_alert_message": msg,
        })
        return {
            "triggered": False,
            "sent": False,
            "status": "error",
            "error": msg,
            "city": target_city,
            "timestamp": now_iso,
            "check_type": check_type,
        }

    # 3. Fetch real live weather for the specified city or coordinates
    if fetch_weather is None or classify_current_heat_risk is None:
        msg = f"{type_tag} {timestamp_fmt} | Weather or heat risk computation modules are unavailable."
        logger.error(msg)
        return {
            "triggered": False,
            "sent": False,
            "status": "error",
            "error": msg,
            "city": target_city,
            "timestamp": now_iso,
            "check_type": check_type,
        }

    logger.info(
        "%s Stage 2 - City checked: Querying live weather conditions for city='%s' (lat=%s, lon=%s)",
        type_tag, target_city, target_lat, target_lon
    )

    if target_lat is not None and target_lon is not None:
        weather = fetch_weather(target_city or None, lat=target_lat, lon=target_lon)
    else:
        weather = fetch_weather(target_city)
    if weather is None:
        loc_label = target_city or f"coordinates ({target_lat}, {target_lon})"
        if not is_weather_api_configured():
            msg = f"{type_tag} {timestamp_fmt} | Weather service is unconfigured. Please set a valid OPENWEATHER_API_KEY in backend/.env to evaluate live conditions for '{loc_label}'."
        else:
            msg = f"{type_tag} {timestamp_fmt} | Unable to fetch weather data for '{loc_label}'. Please check the location name or weather provider status."
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_status": "error",
            "last_alert_message": msg,
        })
        state_manager.record_subscriber_check(
            email=target_email,
            city=target_city,
            temp=None,
            level=None,
            score=None,
            threshold=target_threshold,
            status="error",
            message=msg,
            check_type=check_type,
            timestamp_iso=now_iso,
        )
        return {
            "triggered": False,
            "sent": False,
            "status": "error",
            "error": msg,
            "city": target_city,
            "timestamp": now_iso,
            "check_type": check_type,
        }

    raw_temp = weather.get("temperature")
    if raw_temp is None:
        msg = f"{type_tag} {timestamp_fmt} | Weather data for '{target_city}' is missing temperature observation."
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_status": "error",
            "last_alert_message": msg,
        })
        state_manager.record_subscriber_check(
            email=target_email,
            city=target_city,
            temp=None,
            level=None,
            score=None,
            threshold=target_threshold,
            status="error",
            message=msg,
            check_type=check_type,
            timestamp_iso=now_iso,
        )
        return {
            "triggered": False,
            "sent": False,
            "status": "error",
            "error": msg,
            "city": target_city,
            "timestamp": now_iso,
            "check_type": check_type,
        }

    try:
        temp = float(raw_temp)
    except (ValueError, TypeError):
        msg = f"{type_tag} {timestamp_fmt} | Invalid temperature measurement for '{target_city}': {raw_temp}"
        return {
            "triggered": False,
            "sent": False,
            "status": "error",
            "error": msg,
            "city": target_city,
            "timestamp": now_iso,
            "check_type": check_type,
        }

    raw_humidity = weather.get("humidity")
    humidity = float(raw_humidity) if raw_humidity is not None else None

    raw_rainfall = weather.get("rainfall_numeric")
    if raw_rainfall is None:
        raw_rainfall = weather.get("rainfall")
    try:
        rainfall = float(raw_rainfall) if raw_rainfall is not None else None
    except (ValueError, TypeError):
        try:
            import re
            m = re.search(r"[-+]?\d*\.?\d+", str(raw_rainfall))
            rainfall = float(m.group(0)) if m else None
        except Exception:
            rainfall = None

    raw_wind = weather.get("wind_speed")
    wind_speed_ms = float(raw_wind) if raw_wind is not None else None
    wind_speed_kmh = round(wind_speed_ms * 3.6, 1) if wind_speed_ms is not None else None

    weather_desc = weather.get("weather_description") or "Clear"
    country = weather.get("country") or None
    if not target_city and weather.get("city"):
        target_city = weather.get("city")
    if not country and "," in target_city:
        parts = [p.strip() for p in target_city.split(",") if p.strip()]
        if len(parts) > 1:
            country = parts[-1]

    logger.info(
        "%s Stage 3 - Temperature fetched: city='%s' | temperature=%.1f°C | humidity=%s | wind_speed=%s | condition='%s'",
        type_tag, target_city, temp,
        f"{humidity:.0f}%" if humidity is not None else "None",
        f"{wind_speed_kmh:.1f}km/h" if wind_speed_kmh is not None else "None",
        weather_desc
    )

    risk_info = classify_current_heat_risk(
        temperature=temp,
        humidity=humidity if humidity is not None else 0.0,
        rainfall=rainfall if rainfall is not None else 0.0,
        wind_speed=wind_speed_ms if wind_speed_ms is not None else 0.0,
    )
    if not risk_info:
        msg = f"{type_tag} {timestamp_fmt} | Failed to compute heat risk for '{target_city}'."
        return {
            "triggered": False,
            "sent": False,
            "status": "error",
            "error": msg,
            "city": target_city,
            "timestamp": now_iso,
            "check_type": check_type,
        }

    risk_level = risk_info.get("level", "Low")
    risk_score = risk_info.get("score", 0.0)

    # 4. Check if threshold is breached
    # Supported thresholds:
    # - "Low": triggers on Low, Medium, High, and Critical (all risk levels)
    # - "Medium": triggers on Medium (≥30°C), High (≥36°C), and Critical (≥40°C)
    # - "High": triggers on High (≥36°C) and Critical (≥40°C)
    # - "Critical": triggers ONLY on Critical (≥40°C)
    RISK_LEVEL_RANKS = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    THRESHOLD_MIN_RANKS = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    THRESHOLD_MIN_TEMPS = {"low": 0.0, "medium": 30.0, "high": 36.0, "critical": 40.0}

    norm_risk = risk_level.lower()
    clean_thresh = normalize_threshold(target_threshold)
    thresh_key = clean_thresh.lower()

    curr_rank = RISK_LEVEL_RANKS.get(norm_risk, 1)
    min_rank = THRESHOLD_MIN_RANKS.get(thresh_key, 3)
    condition_met = curr_rank >= min_rank

    threshold_val = THRESHOLD_MIN_TEMPS.get(thresh_key, 36.0)
    logger.info(
        "%s Stage 4 - Threshold evaluated: city='%s' | observed_temp=%.1f°C (risk_level='%s', score=%.1f) vs threshold='%s' (cutoff: ≥%.0f°C) -> threshold_breached=%s",
        type_tag, target_city, temp, risk_level, risk_score, clean_thresh, threshold_val, condition_met
    )

    if not condition_met:
        logger.info(
            "%s Stage 5 - Alert NOT triggered: city='%s' observed temp=%.1f°C is below configured '%s' threshold (requires ≥%.0f°C). No email dispatched to %s.",
            type_tag, target_city, temp, clean_thresh, threshold_val, target_email
        )
        msg = f"{type_tag} {timestamp_fmt} | {target_city}: {temp:.1f}°C ({risk_level} Risk) | below configured {clean_thresh} threshold. No alert dispatched."
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_status": "below_threshold",
            "last_alert_message": msg,
        })
        state_manager.record_subscriber_check(
            email=target_email,
            city=target_city,
            temp=temp,
            level=risk_level,
            score=risk_score,
            threshold=clean_thresh,
            status="below_threshold",
            message=msg,
            check_type=check_type,
            timestamp_iso=now_iso,
        )
        return {
            "triggered": False,
            "sent": False,
            "status": "below_threshold",
            "reason": msg,
            "city": target_city,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "temperature": temp,
            "humidity": humidity,
            "wind_speed": wind_speed_ms,
            "rainfall": rainfall,
            "weather_description": weather_desc,
            "threshold": clean_thresh,
            "check_type": check_type,
            "timestamp": now_iso,
        }

    # 5. Condition IS met. Check duplicate suppression / cooldown
    logger.info(
        "%s Stage 5 - Alert TRIGGERED: city='%s' observed temp=%.1f°C meets or exceeds '%s' threshold (≥%.0f°C) with risk_level='%s'.",
        type_tag, target_city, temp, clean_thresh, threshold_val, risk_level
    )

    cfg = get_smtp_config()
    cooldown_minutes = cfg["cooldown_minutes"]

    # Check per-subscriber history
    if target_email:
        sub_hist = state_manager.get_subscriber_history(target_email)
        if sub_hist:
            last_time_str = sub_hist.get("last_alert_time")
            last_level = sub_hist.get("last_alert_level")
            last_city = sub_hist.get("last_alert_city", "")
        else:
            last_time_str = None
            last_level = None
            last_city = ""
    else:
        current_state = state_manager.load()
        last_time_str = current_state.get("last_alert_time")
        last_level = current_state.get("last_alert_level")
        last_city = current_state.get("last_alert_city", "")

    cooldown_active = False
    cooldown_remaining = 0
    is_level_change = False
    is_escalation = False
    is_deescalation = False

    if last_time_str and not force_send:
        try:
            last_dt = datetime.fromisoformat(last_time_str.replace("Z", "+00:00"))
            elapsed_minutes = (now_dt - last_dt).total_seconds() / 60.0

            if elapsed_minutes < cooldown_minutes and (last_city or "").lower() == target_city.lower():
                last_norm = (last_level or "").strip().lower()
                last_rank = RISK_LEVEL_RANKS.get(last_norm, 0)

                # Check if risk level changed (escalated or dropped)
                if last_norm and last_norm != norm_risk:
                    is_level_change = True
                    if curr_rank > last_rank:
                        is_escalation = True
                        logger.info(
                            "Alert risk level escalated from %s to %s for %s (%s). Bypassing duplicate cooldown to dispatch immediate update.",
                            last_level, risk_level, target_city, target_email
                        )
                    else:
                        is_deescalation = True
                        logger.info(
                            "Alert risk level changed (dropped) from %s to %s for %s (%s). Bypassing duplicate cooldown to dispatch status update.",
                            last_level, risk_level, target_city, target_email
                        )
                else:
                    # Same risk level within cooldown window: suppress duplicate alert
                    cooldown_active = True
                    cooldown_remaining = max(1, int(cooldown_minutes - elapsed_minutes))
        except Exception as exc:
            logger.warning("Error parsing last alert time: %s", exc)

    if cooldown_active and not force_send:
        msg = f"{type_tag} {timestamp_fmt} | {target_city}: {temp:.1f}°C ({risk_level} Risk) | Cooldown active ({cooldown_remaining}m remaining). Duplicate alert suppressed."
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_status": "cooldown",
            "last_alert_message": msg,
        })
        state_manager.record_subscriber_check(
            email=target_email,
            city=target_city,
            temp=temp,
            level=risk_level,
            score=risk_score,
            threshold=clean_thresh,
            status="cooldown_suppressed",
            message=msg,
            check_type=check_type,
            timestamp_iso=now_iso,
        )
        return {
            "triggered": True,
            "sent": False,
            "status": "cooldown_suppressed",
            "reason": msg,
            "city": target_city,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "temperature": temp,
            "humidity": humidity,
            "wind_speed": wind_speed_ms,
            "rainfall": rainfall,
            "weather_description": weather_desc,
            "threshold": clean_thresh,
            "cooldown_remaining_minutes": cooldown_remaining,
            "check_type": check_type,
            "timestamp": now_iso,
        }

    # 6. Send Alert Email using dedicated heat-alert function
    country = weather.get("country") if isinstance(weather, dict) else None
    logger.info(
        "%s Calling actual heat-alert email function send_heat_alert_email for recipient %s (city='%s', temp=%.1f°C, risk=%s, threshold=%s)...",
        type_tag, target_email, target_city, temp, risk_level, clean_thresh
    )
    send_result = send_heat_alert_email(
        to_email=target_email,
        city=target_city,
        risk_level=risk_level,
        risk_score=risk_score,
        temperature=temp,
        humidity=humidity,
        wind_speed=wind_speed_kmh,
        rainfall=rainfall,
        weather_desc=weather_desc,
        threshold=clean_thresh,
        country=country,
        observed_time=timestamp_fmt,
    )

    if send_result["success"]:
        logger.info(
            "%s Stage 6 - Email delivery result: SUCCESS | Real heat alert email successfully dispatched to %s for city='%s' (Subject: '%s')",
            type_tag, target_email, target_city, send_result.get("subject") or f"[{risk_level.upper()} HEAT ALERT] {target_city} — {temp:.1f}°C"
        )
        msg = f"{type_tag} {timestamp_fmt} | {target_city}: {temp:.1f}°C ({risk_level} Risk) | Alert email delivered to {target_email}."
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_time": now_iso,
            "last_alert_level": risk_level,
            "last_alert_city": target_city,
            "last_alert_temp": temp,
            "last_alert_status": "sent",
            "last_alert_message": msg,
        })
        state_manager.record_subscriber_alert(
            email=target_email,
            city=target_city,
            level=risk_level,
            temp=temp,
            timestamp_iso=now_iso,
        )
        state_manager.record_subscriber_check(
            email=target_email,
            city=target_city,
            temp=temp,
            level=risk_level,
            score=risk_score,
            threshold=clean_thresh,
            status="sent",
            message=msg,
            check_type=check_type,
            timestamp_iso=now_iso,
        )
        return {
            "triggered": True,
            "sent": True,
            "status": "success",
            "message": msg,
            "city": target_city,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "temperature": temp,
            "humidity": humidity,
            "wind_speed": wind_speed_ms,
            "rainfall": rainfall,
            "weather_description": weather_desc,
            "threshold": clean_thresh,
            "escalated": is_escalation,
            "deescalated": is_deescalation,
            "level_change": is_level_change,
            "check_type": check_type,
            "timestamp": now_iso,
        }
    else:
        logger.error(
            "%s Stage 6 - Email delivery result: FAILED | Real heat alert email failed to deliver to %s for city='%s': %s",
            type_tag, target_email, target_city, send_result.get("error")
        )
        msg = f"{type_tag} {timestamp_fmt} | {target_city}: {temp:.1f}°C ({risk_level} Risk) | Delivery failed: {send_result.get('error')}"
        state_manager.update({
            "last_checked_time": now_iso,
            "last_alert_status": "failed",
            "last_alert_message": msg,
        })
        state_manager.record_subscriber_check(
            email=target_email,
            city=target_city,
            temp=temp,
            level=risk_level,
            score=risk_score,
            threshold=clean_thresh,
            status="failed",
            message=msg,
            check_type=check_type,
            timestamp_iso=now_iso,
        )
        return {
            "triggered": True,
            "sent": False,
            "status": "error",
            "error": send_result.get("error"),
            "city": target_city,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "temperature": temp,
            "humidity": humidity,
            "wind_speed": wind_speed_ms,
            "rainfall": rainfall,
            "weather_description": weather_desc,
            "threshold": clean_thresh,
            "check_type": check_type,
            "timestamp": now_iso,
        }


def evaluate_all_active_subscribers() -> list[dict]:
    """
    Evaluate real heat risk and dispatch alerts for all active registered subscribers.
    Each subscriber's own saved city, coordinates, and threshold are evaluated completely independently.
    """
    active_subs = subscribers_manager.get_all_subscribers(only_active=True)
    if not active_subs:
        prefs = preferences_manager.load()
        if prefs.get("email") and prefs.get("city") and prefs.get("enabled"):
            subscribers_manager.register_subscriber(
                email=prefs["email"],
                city=prefs["city"],
                threshold=normalize_threshold(prefs.get("threshold")),
                enabled=True,
                lat=prefs.get("latitude"),
                lon=prefs.get("longitude"),
            )
            active_subs = subscribers_manager.get_all_subscribers(only_active=True)
    logger.info("[Background Worker] Stage 1 - Loaded %d active subscriber(s) from persistent registry.", len(active_subs))
    results = []
    for sub in active_subs:
        sub_email = sub.get("email")
        sub_city = sub.get("city")
        sub_thresh = sub.get("threshold", "High")
        sub_lat = sub.get("latitude") if sub.get("latitude") is not None else sub.get("lat")
        sub_lon = sub.get("longitude") if sub.get("longitude") is not None else sub.get("lon")
        logger.info(
            "[Background Worker] Stage 1 - Subscriber loaded: email=%s | city=%s | threshold=%s | coords=(%s, %s)",
            sub_email, sub_city, sub_thresh, sub_lat, sub_lon
        )
        try:
            res = evaluate_and_send_heat_alert(
                city=sub_city,
                email=sub_email,
                threshold=sub_thresh,
                force_send=False,
                check_type="background",
                lat=sub_lat,
                lon=sub_lon,
            )
            results.append({
                "subscriber": sub_email,
                "city": sub_city,
                "latitude": sub_lat,
                "longitude": sub_lon,
                "threshold": sub_thresh,
                "result": res,
            })
        except Exception as exc:
            logger.error("Error evaluating subscriber %s for city %s: %s", sub_email, sub_city, exc)
            results.append({
                "subscriber": sub_email,
                "city": sub_city,
                "latitude": sub_lat,
                "longitude": sub_lon,
                "threshold": sub_thresh,
                "error": str(exc),
            })
    return results


# ── BACKGROUND SCHEDULER / WORKER ──

class HeatAlertBackgroundMonitor:
    """
    Background worker thread that periodically evaluates heat risk and triggers alerts
    for all active registered subscribers when configured.
    """
    def __init__(self):
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._last_run_time: str | None = None
        self._next_run_time: str | None = None

    def is_running(self) -> bool:
        with self._lock:
            return self._thread is not None and self._thread.is_alive()

    def get_status(self) -> dict:
        counts = subscribers_manager.count_subscribers()
        try:
            interval_mins = int(os.getenv("ALERT_CHECK_INTERVAL_MINUTES", "15"))
        except (ValueError, TypeError):
            interval_mins = 15
        interval_mins = max(1, interval_mins)
        with self._lock:
            running = self._thread is not None and self._thread.is_alive()
            return {
                "is_running": running,
                "running": running,
                "active_subscribers": counts["active"],
                "total_subscribers": counts["total"],
                "interval_minutes": interval_mins,
                "last_run_time": self._last_run_time,
                "next_run_time": self._next_run_time,
            }

    def start(self):
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return  # already running

            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run_loop, name="HeatAlertMonitorWorker", daemon=True)
            self._thread.start()
            logger.info("HeatAlertBackgroundMonitor started.")

    def stop(self):
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                self._stop_event.set()
                self._thread.join(timeout=2.0)
                self._thread = None
                self._next_run_time = None
                logger.info("HeatAlertBackgroundMonitor stopped.")

    def restart(self):
        self.stop()
        self.start()

    def _run_loop(self):
        logger.info("HeatAlertBackgroundMonitor loop initiated.")
        while not self._stop_event.is_set():
            active_subs = subscribers_manager.get_all_subscribers(only_active=True)
            # Also check legacy preferences
            prefs = preferences_manager.load()
            has_active = len(active_subs) > 0 or (prefs.get("enabled", False) and prefs.get("email"))

            if not has_active:
                for _ in range(10):
                    if self._stop_event.is_set():
                        break
                    time.sleep(0.5)
                continue

            # Run evaluation
            try:
                try:
                    interval_mins = int(os.getenv("ALERT_CHECK_INTERVAL_MINUTES", "15"))
                except (ValueError, TypeError):
                    interval_mins = 15
                interval_mins = max(1, interval_mins)

                self._last_run_time = datetime.now(timezone.utc).isoformat()
                next_dt = datetime.now(timezone.utc) + timedelta(minutes=interval_mins)
                self._next_run_time = next_dt.isoformat()

                logger.info("Running scheduled background heat alert checks for %d active subscribers...", len(active_subs) or 1)
                if active_subs:
                    evaluate_all_active_subscribers()
                else:
                    evaluate_and_send_heat_alert()
            except Exception as exc:
                logger.error("Error during scheduled heat alert check: %s", exc, exc_info=True)

            # Sleep for interval or until stopped
            sleep_seconds = interval_mins * 60
            for _ in range(sleep_seconds):
                if self._stop_event.is_set():
                    break
                time.sleep(1)


# Global background monitor instance
background_monitor = HeatAlertBackgroundMonitor()
