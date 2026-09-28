"""
Email Service for Satellite-Based El Niño Heat Monitoring System
Handles SMTP email delivery for heat alert subscriptions.
"""
import os
import re
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Ensure .env is loaded from backend directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def is_valid_email(email: str) -> bool:
    """Validate email address format."""
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_REGEX.match(email.strip()))


def send_heat_alert_subscription_email(to_email: str, city: str = "Coimbatore") -> tuple[bool, str]:
    """
    Send heat alert subscription confirmation email via SMTP (e.g. Gmail SMTP).

    Subject:
    Heat Alert Subscription - [City]

    Body:
    Satellite-Based El Niño Heat Monitoring System

    Your email has been successfully registered for heat alerts.

    City: [selected city]

    You will receive heat-related alerts and preparedness information for your selected location.

    Please follow recommended preventive measures during high-heat conditions.

    Returns:
        tuple[bool, str]: (Success status, message or error description)
    """
    # Load .env if present
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

    normalized_email = (to_email or "").strip()
    if not is_valid_email(normalized_email):
        logger.warning("Invalid email provided: %s", normalized_email)
        return False, "Invalid email address format."

    target_city = (city or "Coimbatore").strip()

    # Load SMTP configuration from environment
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com").strip()
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587").strip())
    except ValueError:
        smtp_port = 587

    sender_email = (
        os.getenv("SMTP_EMAIL")
        or os.getenv("EMAIL_USER")
        or os.getenv("SENDER_EMAIL")
        or ""
    ).strip()

    sender_password = (
        os.getenv("SMTP_PASSWORD")
        or os.getenv("EMAIL_PASSWORD")
        or os.getenv("EMAIL_PASS")
        or ""
    ).strip()

    if not sender_email or sender_email == "your_email@gmail.com" or not sender_password or sender_password == "your_gmail_app_password":
        err_msg = (
            "SMTP email credentials are not configured in backend/.env. "
            "Please configure SMTP_EMAIL and a 16-character Google App Password in SMTP_PASSWORD."
        )
        logger.error(err_msg)
        return False, err_msg

    subject = f"Heat Alert Subscription - {target_city}"
    body = (
        f"Satellite-Based El Niño Heat Monitoring System\n\n"
        f"Your email has been successfully registered for heat alerts.\n\n"
        f"City: {target_city}\n\n"
        f"You will receive heat-related alerts and preparedness information for your selected location.\n\n"
        f"Please follow recommended preventive measures during high-heat conditions."
    )

    msg = MIMEMultipart()
    msg["From"] = f"El Niño Heat Monitoring System <{sender_email}>"
    msg["To"] = normalized_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        logger.info(
            "Connecting to SMTP server %s:%d to send email to %s...",
            smtp_server,
            smtp_port,
            normalized_email,
        )
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=15) as server:
                server.login(sender_email, sender_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_server, smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(sender_email, sender_password)
                server.send_message(msg)

        logger.info("Subscription email sent successfully to %s for city %s", normalized_email, target_city)
        return True, "Email Alert Registered Successfully"

    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error("SMTP authentication failed for %s: %s", sender_email, auth_err)
        return False, "SMTP Authentication Error: Invalid email or App Password."
    except smtplib.SMTPException as smtp_err:
        logger.error("SMTP error while sending email to %s: %s", normalized_email, smtp_err)
        return False, f"SMTP Error: {str(smtp_err)}"
    except Exception as err:
        logger.error("Unexpected error sending email to %s: %s", normalized_email, err)
        return False, f"Failed to send email: {str(err)}"
