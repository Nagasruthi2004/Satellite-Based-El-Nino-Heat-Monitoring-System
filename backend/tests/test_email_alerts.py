"""
Unit Tests for Email Heat Alerts Service & Endpoints
====================================================
Tests email validation, subscriber registration & persistence, duplicate prevention,
unsubscription, SMTP delivery, error handling (unconfigured provider, auth failure,
connect failure), heat-risk threshold evaluation (High 36°C vs Critical 40°C),
duplicate alert cooldown & escalation, and Flask API routes.
"""

import os
import sys
import unittest
import smtplib
import socket
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock

# Insert backend directory in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app, start_background_worker
import email_service


class EmailAlertsTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.temp_dir = tempfile.mkdtemp()
        self.pref_file = Path(self.temp_dir) / "test_prefs.json"
        self.subs_file = Path(self.temp_dir) / "test_subs.json"
        self.state_file = Path(self.temp_dir) / "test_state.json"

        # Patch manager files to isolated temp files
        email_service.background_monitor.stop()
        self.orig_pref_mgr = email_service.preferences_manager
        self.orig_subs_mgr = email_service.subscribers_manager
        self.orig_state_mgr = email_service.state_manager

        email_service.preferences_manager = email_service.AlertPreferencesManager(str(self.pref_file))
        email_service.subscribers_manager = email_service.SubscribersManager(str(self.subs_file))
        email_service.state_manager = email_service.AlertStateManager(str(self.state_file))

    def tearDown(self):
        email_service.background_monitor.stop()
        email_service.preferences_manager = self.orig_pref_mgr
        email_service.subscribers_manager = self.orig_subs_mgr
        email_service.state_manager = self.orig_state_mgr
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    # ── 1. EMAIL ADDRESS VALIDATION ──
    def test_validate_email_address_valid(self):
        """Test standard and international valid email formats."""
        valid_emails = [
            "alert.recipient@gmail.com",
            "climate_team@imd.gov.in",
            "researcher+heat@university.edu",
            "emergency-officer@coimbatore.gov.in",
            "user.123@domain.org",
        ]
        for email in valid_emails:
            is_valid, err = email_service.validate_email_address(email)
            self.assertTrue(is_valid, f"Expected '{email}' to be valid. Error: {err}")
            self.assertEqual(err, "")

    def test_validate_email_address_invalid(self):
        """Test rejection of malformed or invalid email strings."""
        invalid_emails = [
            "",
            None,
            "plainaddress",
            "@missingusername.com",
            "user@.com",
            "user@domain..com",
            "user@domain",
            "user@domain.",
            "spaces in@domain.com",
            "user@domain.c",
        ]
        for email in invalid_emails:
            is_valid, err = email_service.validate_email_address(email)
            self.assertFalse(is_valid, f"Expected '{email}' to be invalid.")
            self.assertGreater(len(err), 0)

    def test_dotenv_path_is_absolute_and_valid(self):
        """Verify that DOTENV_PATH is absolute and points to backend/.env."""
        self.assertTrue(os.path.isabs(email_service.DOTENV_PATH))
        self.assertTrue(email_service.DOTENV_PATH.endswith(".env"))
        self.assertEqual(Path(email_service.DOTENV_PATH).parent.name, "backend")

    # ── 2. CENTRAL SMTP CONFIGURATION CHECKS ──
    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_SERVER": "",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "testuser@gmail.com",
        "SMTP_EMAIL": "testuser@gmail.com",
        "SMTP_PASSWORD": "valid_app_password_16",
        "SMTP_FROM_EMAIL": "testuser@gmail.com",
    }, clear=False)
    def test_is_smtp_configured_success(self):
        """Test that fully specified environment variables mark SMTP as configured."""
        configured, missing = email_service.is_smtp_configured()
        self.assertTrue(configured)
        self.assertEqual(len(missing), 0)

    @patch.dict("os.environ", {
        "SMTP_HOST": "",
        "SMTP_SERVER": "",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "",
        "SMTP_EMAIL": "",
        "SMTP_PASSWORD": "",
        "SMTP_FROM_EMAIL": "",
    }, clear=False)
    def test_is_smtp_configured_missing_placeholders(self):
        """Test that placeholder values or empty fields mark SMTP as unconfigured."""
        configured, missing = email_service.is_smtp_configured()
        self.assertFalse(configured)
        self.assertGreater(len(missing), 0)

    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "your_actual_gmail@gmail.com",
        "SMTP_PASSWORD": "YOUR_16_CHARACTER_GMAIL_APP_PASSWORD",
        "SMTP_FROM_EMAIL": "your_actual_gmail@gmail.com",
    }, clear=False)
    def test_is_smtp_configured_detects_placeholder_strings(self):
        """Verify that known placeholder template strings are detected as unconfigured."""
        configured, missing = email_service.is_smtp_configured()
        self.assertFalse(configured)
        self.assertIn("SMTP_USERNAME", missing)
        self.assertIn("SMTP_PASSWORD", missing)

    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "testuser@gmail.com",
        "SMTP_PASSWORD": "supersecretpassword",
        "SMTP_FROM_EMAIL": "testuser@gmail.com",
    }, clear=False)
    def test_get_public_smtp_status_never_exposes_password(self):
        """Verify that get_public_smtp_status does not contain the password key."""
        status = email_service.get_public_smtp_status()
        self.assertIn("configured", status)
        self.assertIn("host", status)
        self.assertIn("port", status)
        self.assertIn("from_email", status)
        self.assertNotIn("password", status)

    @patch.dict("os.environ", {
        "SMTP_SERVER": "smtp.gmail.com",
        "SMTP_HOST": "",
        "SMTP_PORT": "587",
        "SMTP_EMAIL": "testalias@gmail.com",
        "SMTP_USERNAME": "",
        "SMTP_PASSWORD": "app_password_valid_16",
        "ALERT_FROM_EMAIL": "testalias@gmail.com",
        "SMTP_FROM_EMAIL": "",
    }, clear=False)
    def test_is_smtp_configured_aliases_support(self):
        """Verify alias environment variables (SMTP_SERVER, SMTP_EMAIL, ALERT_FROM_EMAIL) are respected."""
        cfg = email_service.get_smtp_config()
        self.assertEqual(cfg["host"], "smtp.gmail.com")
        self.assertEqual(cfg["username"], "testalias@gmail.com")
        self.assertEqual(cfg["from_email"], "testalias@gmail.com")
        configured, missing = email_service.is_smtp_configured()
        self.assertTrue(configured)
        self.assertEqual(len(missing), 0)

    # ── 3. SUBSCRIBER REGISTRATION & PERSISTENCE ──
    def test_subscriber_registration_and_persistence(self):
        """Test registering a new subscriber stores record persistently in subscribers.json."""
        mgr = email_service.subscribers_manager
        success, sub, msg, is_new = mgr.register_subscriber(
            email="citizen@coimbatore.in",
            city="Coimbatore",
            threshold="High",
            enabled=True,
        )
        self.assertTrue(success)
        self.assertTrue(is_new)
        self.assertEqual(sub["email"], "citizen@coimbatore.in")
        self.assertEqual(sub["city"], "Coimbatore")
        self.assertEqual(sub["threshold"], "High")
        self.assertTrue(sub["enabled"])

        # Verify lookup
        fetched = mgr.get_subscriber("citizen@coimbatore.in")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["city"], "Coimbatore")

    def test_subscriber_duplicate_prevention_updates_existing(self):
        """Test duplicate registration for same email updates existing record without creating duplicate entries."""
        mgr = email_service.subscribers_manager
        # Initial registration
        mgr.register_subscriber("user@example.com", "Chennai", "High", True)
        self.assertEqual(mgr.count_subscribers()["total"], 1)

        # Re-register with updated threshold and city
        success, updated_sub, msg, is_new = mgr.register_subscriber(
            "user@example.com",
            "Madurai",
            "Critical",
            True,
        )
        self.assertTrue(success)
        self.assertFalse(is_new)  # Not new, updated!
        self.assertEqual(mgr.count_subscribers()["total"], 1)  # Still exactly 1 subscriber
        self.assertEqual(updated_sub["city"], "Madurai")
        self.assertEqual(updated_sub["threshold"], "Critical")

    def test_subscriber_unsubscribe(self):
        """Test unsubscribing removes subscriber from persistence."""
        mgr = email_service.subscribers_manager
        mgr.register_subscriber("subscriber@domain.com", "Salem", "High", True)
        self.assertEqual(mgr.count_subscribers()["total"], 1)

        # Unsubscribe
        success, msg = mgr.unsubscribe_subscriber("subscriber@domain.com")
        self.assertTrue(success)
        self.assertIn("Successfully unsubscribed", msg)
        self.assertEqual(mgr.count_subscribers()["total"], 0)
        self.assertIsNone(mgr.get_subscriber("subscriber@domain.com"))

        # Unsubscribe non-existent email
        fail_success, fail_msg = mgr.unsubscribe_subscriber("unknown@domain.com")
        self.assertFalse(fail_success)
        self.assertIn("not currently registered", fail_msg)

    def test_subscriber_count_and_get_all(self):
        """Test counting active vs total subscribers."""
        mgr = email_service.subscribers_manager
        mgr.register_subscriber("user1@domain.com", "Chennai", "High", True)
        mgr.register_subscriber("user2@domain.com", "Madurai", "Critical", False)

        counts = mgr.count_subscribers()
        self.assertEqual(counts["total"], 2)
        self.assertEqual(counts["active"], 1)

        all_subs = mgr.get_all_subscribers(only_active=False)
        self.assertEqual(len(all_subs), 2)
        active_subs = mgr.get_all_subscribers(only_active=True)
        self.assertEqual(len(active_subs), 1)
        self.assertEqual(active_subs[0]["email"], "user1@domain.com")

    # ── 4. SMTP DELIVERY & ERROR TAXONOMY ──
    @patch.dict("os.environ", {
        "SMTP_HOST": "",
        "SMTP_USERNAME": "",
        "SMTP_PASSWORD": "",
    }, clear=False)
    def test_send_email_smtp_unconfigured_error(self):
        """Test sending email when SMTP is unconfigured returns configuration_missing error."""
        res = email_service.send_email_smtp(
            to_email="test@example.com",
            subject="Test Subject",
            plain_text="Test Body",
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["error_type"], "configuration_missing")
        self.assertIn("not configured yet", res["error"])

    def test_send_email_smtp_invalid_recipient(self):
        """Test sending email to an invalid address returns validation_error."""
        res = email_service.send_email_smtp(
            to_email="invalid_address",
            subject="Test",
            plain_text="Test",
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["error_type"], "validation_error")

    @patch("email_service.smtplib.SMTP")
    @patch("email_service.ssl.create_default_context")
    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "test@gmail.com",
        "SMTP_PASSWORD": "valid_app_password",
        "SMTP_FROM_EMAIL": "test@gmail.com",
        "SMTP_USE_TLS": "true",
        "SMTP_USE_SSL": "false",
    }, clear=False)
    def test_send_email_smtp_success_starttls_port_587(self, mock_ssl_ctx, mock_smtp_class):
        """Test port 587 STARTTLS workflow: connects via SMTP, calls starttls(), logs in, and sends."""
        mock_server = MagicMock()
        mock_smtp_class.return_value = mock_server

        res = email_service.send_email_smtp(
            to_email="recipient@gmail.com",
            subject="Test Starttls",
            plain_text="Test content",
        )
        self.assertTrue(res["success"])
        mock_smtp_class.assert_called_with("smtp.gmail.com", 587, timeout=15)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_with("test@gmail.com", "valid_app_password")
        mock_server.sendmail.assert_called_once()
        mock_server.quit.assert_called_once()

    @patch("email_service.smtplib.SMTP_SSL")
    @patch("email_service.ssl.create_default_context")
    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "465",
        "SMTP_USERNAME": "test@gmail.com",
        "SMTP_PASSWORD": "valid_app_password",
        "SMTP_FROM_EMAIL": "test@gmail.com",
        "SMTP_USE_TLS": "false",
        "SMTP_USE_SSL": "true",
    }, clear=False)
    def test_send_email_smtp_success_ssl_port_465(self, mock_ssl_ctx, mock_smtp_ssl_class):
        """Test port 465 SSL workflow: connects directly via SMTP_SSL, does NOT call starttls()."""
        mock_server = MagicMock()
        mock_smtp_ssl_class.return_value = mock_server

        res = email_service.send_email_smtp(
            to_email="recipient@gmail.com",
            subject="Test SSL 465",
            plain_text="Test content",
        )
        self.assertTrue(res["success"])
        mock_smtp_ssl_class.assert_called_once()
        self.assertFalse(hasattr(mock_server, "starttls") and mock_server.starttls.called)
        mock_server.login.assert_called_with("test@gmail.com", "valid_app_password")
        mock_server.sendmail.assert_called_once()

    @patch("email_service.smtplib.SMTP")
    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "test@gmail.com",
        "SMTP_PASSWORD": "wrong_password",
        "SMTP_FROM_EMAIL": "test@gmail.com",
    }, clear=False)
    def test_send_email_smtp_auth_error_handling(self, mock_smtp_class):
        """Test SMTP authentication error returns authentication_error type and helpful guidance."""
        mock_server = MagicMock()
        mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")
        mock_smtp_class.return_value = mock_server

        res = email_service.send_email_smtp(
            to_email="recipient@gmail.com",
            subject="Test Auth Error",
            plain_text="Test content",
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["error_type"], "authentication_error")
        self.assertIn("Google App Password", res["error"])

    # ── 5. HEAT RISK THRESHOLD CHECKING & COOLDOWN ──
    @patch("email_service.fetch_weather")
    def test_threshold_checking_below_threshold(self, mock_fetch):
        """Test temperature below threshold returns below_threshold status without sending email."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 28.0,
            "humidity": 60.0,
            "rainfall": 0.0,
            "wind_speed": 2.5,
            "weather_description": "Partly Cloudy",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="High",
        )
        self.assertFalse(res["triggered"])
        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "below_threshold")
        self.assertIn("below configured High threshold", res["reason"])

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_threshold_checking_high_triggers_high_and_critical(self, mock_fetch, mock_send):
        """Test High threshold (≥36°C) triggers on High risk temperature."""
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-10T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 37.5,
            "humidity": 50.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Sunny & Hot",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="High",
        )
        self.assertTrue(res["triggered"])
        self.assertTrue(res["sent"])
        self.assertEqual(res["status"], "success")
        self.assertEqual(mock_send.call_count, 1)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_threshold_checking_critical_only_triggers_on_critical(self, mock_fetch, mock_send):
        """Test Critical threshold (≥40°C) does not trigger on High risk (37°C), but triggers on Critical (41°C)."""
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-10T12:00:00Z"}

        # High risk (37.0°C) -> Should NOT trigger when threshold is Critical
        mock_fetch.return_value = {
            "city": "Madurai",
            "temperature": 37.0,
            "humidity": 45.0,
            "rainfall": 0.0,
            "wind_speed": 2.0,
            "weather_description": "Hot",
        }
        res_a = email_service.evaluate_and_send_heat_alert(
            city="Madurai",
            email="citizen@madurai.in",
            threshold="Critical",
        )
        self.assertFalse(res_a["triggered"])
        self.assertFalse(res_a["sent"])
        self.assertEqual(res_a["status"], "below_threshold")
        self.assertEqual(mock_send.call_count, 0)

        # Critical risk (41.5°C) -> Should trigger
        mock_fetch.return_value = {
            "city": "Madurai",
            "temperature": 41.5,
            "humidity": 35.0,
            "rainfall": 0.0,
            "wind_speed": 4.0,
            "weather_description": "Extreme Heatwave",
        }
        res_b = email_service.evaluate_and_send_heat_alert(
            city="Madurai",
            email="citizen@madurai.in",
            threshold="Critical",
        )
        self.assertTrue(res_b["triggered"])
        self.assertTrue(res_b["sent"])
        self.assertEqual(mock_send.call_count, 1)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_duplicate_alert_suppression_cooldown(self, mock_fetch, mock_send):
        """Test duplicate alert for same subscriber within cooldown window is suppressed."""
        mock_send.return_value = {"success": True, "message": "Delivered", "timestamp": "2026-10-10T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Hyderabad",
            "temperature": 38.0,
            "humidity": 40.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Hot",
        }

        # First alert sends
        res1 = email_service.evaluate_and_send_heat_alert(
            city="Hyderabad",
            email="officer@hyderabad.gov.in",
            threshold="High",
        )
        self.assertTrue(res1["sent"])
        self.assertEqual(mock_send.call_count, 1)

        # Second alert immediately after is suppressed by cooldown
        res2 = email_service.evaluate_and_send_heat_alert(
            city="Hyderabad",
            email="officer@hyderabad.gov.in",
            threshold="High",
        )
        self.assertTrue(res2["triggered"])
        self.assertFalse(res2["sent"])
        self.assertEqual(res2["status"], "cooldown_suppressed")
        self.assertIn("Cooldown active", res2["reason"])
        self.assertEqual(mock_send.call_count, 1)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_alert_escalation_bypasses_cooldown(self, mock_fetch, mock_send):
        """Test that risk escalation (High -> Critical) immediately dispatches a new alert."""
        mock_send.return_value = {"success": True, "message": "Delivered", "timestamp": "2026-10-10T12:00:00Z"}

        # First alert at High (38°C)
        mock_fetch.return_value = {
            "city": "Ahmedabad",
            "temperature": 38.0,
            "humidity": 45.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Hot",
        }
        res1 = email_service.evaluate_and_send_heat_alert(
            city="Ahmedabad",
            email="admin@ahmedabad.gov.in",
            threshold="High",
        )
        self.assertTrue(res1["sent"])
        self.assertEqual(res1["risk_level"], "High")

        # Second observation escalates to Critical (42°C) -> bypasses cooldown!
        mock_fetch.return_value = {
            "city": "Ahmedabad",
            "temperature": 42.0,
            "humidity": 35.0,
            "rainfall": 0.0,
            "wind_speed": 4.0,
            "weather_description": "Extreme Heat",
        }
        res2 = email_service.evaluate_and_send_heat_alert(
            city="Ahmedabad",
            email="admin@ahmedabad.gov.in",
            threshold="High",
        )
        self.assertTrue(res2["sent"])
        self.assertEqual(res2["risk_level"], "Critical")
        self.assertTrue(res2.get("escalated", False))
        self.assertEqual(mock_send.call_count, 2)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_all_active_subscribers(self, mock_fetch, mock_send):
        """Test evaluating all active subscribers across different cities."""
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-10T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 39.0,
            "humidity": 45.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Hot",
        }

        mgr = email_service.subscribers_manager
        mgr.register_subscriber("user1@domain.com", "Coimbatore", "High", True)
        mgr.register_subscriber("user2@domain.com", "Coimbatore", "High", True)
        mgr.register_subscriber("user3@domain.com", "Coimbatore", "High", False)  # Disabled

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 2)  # Only 2 active subscribers evaluated
        self.assertEqual(mock_send.call_count, 2)

    # ── 6. FLASK API ENDPOINTS ──
    def test_api_get_alerts_config_schema(self):
        """Test GET /api/alerts/config returns clean schema with subscribers_count and no passwords."""
        res = self.client.get("/api/alerts/config")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("configured", data)
        self.assertIn("email_delivery_configured", data)
        self.assertIn("subscribers_count", data)
        self.assertIn("last_delivery_message", data)
        self.assertNotIn("password", str(data).lower())

    @patch("email_service.is_smtp_configured")
    def test_api_get_alerts_config_unconfigured_message(self, mock_is_configured):
        """Test GET /api/alerts/config displays 'Email delivery is not configured yet' when unconfigured."""
        mock_is_configured.return_value = (False, ["SMTP_USERNAME", "SMTP_PASSWORD"])
        res = self.client.get("/api/alerts/config")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["configured"])
        self.assertFalse(data["email_delivery_configured"])
        self.assertIn("Email delivery is not configured yet", data["last_delivery_message"])

    def test_api_get_alerts_config_with_email_param(self):
        """Test GET /api/alerts/config?email=... retrieves specific subscriber info."""
        email_service.subscribers_manager.register_subscriber("resident@domain.in", "Salem", "Critical", True)
        res = self.client.get("/api/alerts/config?email=resident@domain.in")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNotNone(data.get("subscriber"))
        self.assertEqual(data["subscriber"]["city"], "Salem")
        self.assertEqual(data["subscriber"]["threshold"], "Critical")

    def test_api_post_alerts_register_success_and_duplicate_update(self):
        """Test POST /api/alerts/register registers new user and updates existing."""
        # 1. New registration
        res1 = self.client.post("/api/alerts/register", json={
            "email": "resident@coimbatore.in",
            "city": "Coimbatore",
            "threshold": "High",
            "enabled": True,
        })
        self.assertEqual(res1.status_code, 200)
        data1 = res1.get_json()
        self.assertEqual(data1["status"], "success")
        self.assertTrue(data1["is_new"])
        self.assertEqual(data1["subscriber"]["email"], "resident@coimbatore.in")

        # 2. Update existing registration (same email)
        res2 = self.client.post("/api/alerts/register", json={
            "email": "resident@coimbatore.in",
            "city": "Chennai",
            "threshold": "Critical",
            "enabled": True,
        })
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertEqual(data2["status"], "success")
        self.assertFalse(data2["is_new"])
        self.assertEqual(data2["subscriber"]["city"], "Chennai")
        self.assertEqual(data2["subscriber"]["threshold"], "Critical")

    def test_api_post_alerts_register_invalid_email(self):
        """Test POST /api/alerts/register returns 400 for invalid email."""
        res = self.client.post("/api/alerts/register", json={
            "email": "not-an-email",
            "city": "Chennai",
            "threshold": "High",
            "enabled": True,
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("Invalid email", data["error"])

    def test_api_post_alerts_unsubscribe_endpoint(self):
        """Test POST /api/alerts/unsubscribe removes subscriber or returns 404 if not found."""
        # Register first
        self.client.post("/api/alerts/register", json={
            "email": "remove.me@domain.org",
            "city": "Trichy",
            "threshold": "High",
            "enabled": True,
        })

        # Unsubscribe
        res = self.client.post("/api/alerts/unsubscribe", json={"email": "remove.me@domain.org"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("Successfully unsubscribed", data["message"])

        # Unsubscribe non-existent
        res_fail = self.client.post("/api/alerts/unsubscribe", json={"email": "nonexistent@domain.org"})
        self.assertEqual(res_fail.status_code, 404)
        self.assertIn("not currently registered", res_fail.get_json()["error"])

    @patch("email_service.is_smtp_configured")
    def test_api_post_test_email_unconfigured_503(self, mock_configured):
        """Test POST /api/alerts/test returns 503 when SMTP is not configured."""
        mock_configured.return_value = (False, ["SMTP_HOST", "SMTP_PASSWORD"])

        res = self.client.post("/api/alerts/test", json={"email": "verified.user@gmail.com"})
        self.assertEqual(res.status_code, 503)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertEqual(data["error_type"], "configuration_missing")
        self.assertIn("not configured yet", data["error"])

    @patch("email_service.send_email_smtp")
    @patch("email_service.is_smtp_configured")
    def test_api_post_test_email_success(self, mock_configured, mock_send):
        """Test POST /api/alerts/test returns 200 on successful delivery."""
        mock_configured.return_value = (True, [])
        mock_send.return_value = {
            "success": True,
            "message": "Email accepted for delivery",
            "timestamp": "2026-10-10T12:00:00Z",
        }

        res = self.client.post("/api/alerts/test", json={"email": "verified.user@gmail.com"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("Email accepted", data["message"])

    @patch("email_service.evaluate_and_send_heat_alert")
    def test_api_post_alerts_check_endpoint(self, mock_eval):
        """Test POST /api/alerts/check triggers evaluation and returns result."""
        mock_eval.return_value = {
            "triggered": True,
            "sent": True,
            "status": "success",
            "city": "Coimbatore",
            "risk_level": "High",
            "temperature": 38.2,
        }

        res = self.client.post("/api/alerts/check", json={"city": "Coimbatore", "force_send": True})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["triggered"])
        self.assertTrue(data["sent"])
        self.assertEqual(data["city"], "Coimbatore")

    # ── 7. REGRESSION TESTS (SUBSCRIPTION LIFECYCLE & TELEMETRY ISOLATION) ──
    def test_regression_zero_subscriptions(self):
        """Regression Test: Zero subscriptions state accurately returns 0 count and None subscriber."""
        counts = email_service.subscribers_manager.count_subscribers()
        self.assertEqual(counts["total"], 0)
        self.assertEqual(counts["active"], 0)
        self.assertEqual(email_service.subscribers_manager.get_all_subscribers(), [])

        # API config response
        res = self.client.get("/api/alerts/config")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["subscribers_count"], 0)
        self.assertEqual(data["active_subscribers_count"], 0)
        self.assertIsNone(data.get("subscriber"))

        # State has no false dispatch record
        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))
        self.assertIsNone(state.get("last_alert_city"))

    def test_regression_valid_saved_subscription_and_update(self):
        """Regression Test: Valid subscription persistence, query, and duplicate update."""
        # Register new subscriber
        res = self.client.post("/api/alerts/register", json={
            "email": "chennai.resident@gov.in",
            "city": "Chennai",
            "threshold": "Critical",
            "enabled": True,
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["is_new"])

        # Count increases
        counts = email_service.subscribers_manager.count_subscribers()
        self.assertEqual(counts["total"], 1)
        self.assertEqual(counts["active"], 1)

        # GET config with matching email retrieves subscriber
        res_matching = self.client.get("/api/alerts/config?email=chennai.resident@gov.in")
        self.assertEqual(res_matching.status_code, 200)
        matching_data = res_matching.get_json()
        self.assertEqual(matching_data["subscribers_count"], 1)
        self.assertIsNotNone(matching_data["subscriber"])
        self.assertEqual(matching_data["subscriber"]["email"], "chennai.resident@gov.in")
        self.assertEqual(matching_data["subscriber"]["city"], "Chennai")
        self.assertEqual(matching_data["subscriber"]["threshold"], "Critical")
        self.assertTrue(matching_data["subscriber"]["enabled"])

        # GET config with non-matching email returns count 1 but subscriber None
        res_unregistered = self.client.get("/api/alerts/config?email=stranger@unknown.org")
        self.assertEqual(res_unregistered.status_code, 200)
        unregistered_data = res_unregistered.get_json()
        self.assertEqual(unregistered_data["subscribers_count"], 1)
        self.assertIsNone(unregistered_data["subscriber"])

        # Update subscriber preferences (pause subscription)
        res_update = self.client.post("/api/alerts/register", json={
            "email": "chennai.resident@gov.in",
            "city": "Chennai",
            "threshold": "High",
            "enabled": False,
        })
        self.assertEqual(res_update.status_code, 200)
        self.assertFalse(res_update.get_json()["is_new"])

        counts_updated = email_service.subscribers_manager.count_subscribers()
        self.assertEqual(counts_updated["total"], 1)
        self.assertEqual(counts_updated["active"], 0)

    def test_regression_unsubscribe_lifecycle(self):
        """Regression Test: Unsubscribe successfully removes registration and updates counts."""
        # Register two users
        self.client.post("/api/alerts/register", json={
            "email": "user.one@domain.com",
            "city": "Madurai",
            "threshold": "High",
            "enabled": True,
        })
        self.client.post("/api/alerts/register", json={
            "email": "user.two@domain.com",
            "city": "Salem",
            "threshold": "Critical",
            "enabled": True,
        })

        counts_before = email_service.subscribers_manager.count_subscribers()
        self.assertEqual(counts_before["total"], 2)

        # Unsubscribe user.one
        res_unsub = self.client.post("/api/alerts/unsubscribe", json={"email": "user.one@domain.com"})
        self.assertEqual(res_unsub.status_code, 200)

        counts_after = email_service.subscribers_manager.count_subscribers()
        self.assertEqual(counts_after["total"], 1)

        # Config check for unsubscribed user returns subscriber None
        res_check = self.client.get("/api/alerts/config?email=user.one@domain.com")
        self.assertEqual(res_check.status_code, 200)
        self.assertIsNone(res_check.get_json()["subscriber"])
        self.assertEqual(res_check.get_json()["subscribers_count"], 1)

        # Unsubscribing again returns 404
        res_again = self.client.post("/api/alerts/unsubscribe", json={"email": "user.one@domain.com"})
        self.assertEqual(res_again.status_code, 404)

    @patch("email_service.is_smtp_configured")
    def test_regression_unconfigured_email_delivery(self, mock_is_configured):
        """Regression Test: Unconfigured email delivery allows registration but accurately reports unconfigured state."""
        mock_is_configured.return_value = (False, ["SMTP_USERNAME", "SMTP_PASSWORD"])

        # 1. Registration is still accepted
        res_reg = self.client.post("/api/alerts/register", json={
            "email": "offline.subscriber@domain.com",
            "city": "Coimbatore",
            "threshold": "High",
            "enabled": True,
        })
        self.assertEqual(res_reg.status_code, 200)

        # 2. Config endpoint reflects unconfigured state without fake claims
        res_cfg = self.client.get("/api/alerts/config?email=offline.subscriber@domain.com")
        self.assertEqual(res_cfg.status_code, 200)
        data = res_cfg.get_json()
        self.assertFalse(data["configured"])
        self.assertFalse(data["email_delivery_configured"])
        self.assertEqual(data["delivery_provider"], "Unconfigured")
        self.assertIn("Email delivery is not configured yet", data["last_delivery_message"])

        # 3. Test email rejects with 503 configuration_missing
        res_test = self.client.post("/api/alerts/test", json={"email": "offline.subscriber@domain.com"})
        self.assertEqual(res_test.status_code, 503)
        self.assertEqual(res_test.get_json()["error_type"], "configuration_missing")

    @patch("email_service.fetch_weather")
    def test_regression_non_dispatched_evaluation_telemetry_isolation(self, mock_fetch):
        """Regression Test: Below-threshold weather checks do NOT mutate last_alert_time or last_alert_city."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 28.0,  # Below threshold
            "humidity": 50.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Pleasant",
        }

        # Initial state has null alert dispatch telemetry
        initial_state = email_service.state_manager.load()
        self.assertIsNone(initial_state.get("last_alert_time"))
        self.assertIsNone(initial_state.get("last_alert_city"))

        # Run evaluation for Coimbatore
        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="observer@domain.in",
            threshold="High",
        )
        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "below_threshold")

        # Telemetry check: last_alert_time AND last_alert_city must remain None (no fake alert recorded!)
        post_state = email_service.state_manager.load()
        self.assertIsNone(post_state.get("last_alert_time"))
        self.assertIsNone(post_state.get("last_alert_city"))
        self.assertIsNone(post_state.get("last_alert_level"))
        self.assertEqual(post_state.get("last_alert_status"), "below_threshold")

    # ── 8. WEATHER LOOKUP & THRESHOLD EVALUATION TESTS ──
    @patch("email_service.fetch_weather")
    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": ""}, clear=True)
    def test_evaluate_heat_alert_weather_unconfigured_error(self, mock_fetch):
        """Test evaluate_and_send_heat_alert returns clear error when weather API is unconfigured."""
        mock_fetch.return_value = None

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="alert.user@domain.com",
            threshold="High",
        )
        self.assertFalse(res["triggered"])
        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "error")
        self.assertIn("Weather service is unconfigured", res["error"])
        # Ensure no synthetic temperature or risk values are returned
        self.assertNotIn("temperature", res)
        self.assertNotIn("risk_level", res)

        # Telemetry check: last_alert_time is NOT updated
        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))

    @patch("email_service.fetch_weather")
    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_key"})
    def test_evaluate_heat_alert_weather_provider_failure_error(self, mock_fetch):
        """Test evaluate_and_send_heat_alert returns clean error if weather provider fails."""
        mock_fetch.return_value = None

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="alert.user@domain.com",
            threshold="High",
        )
        self.assertFalse(res["triggered"])
        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "error")
        self.assertIn("Unable to fetch weather data for 'Coimbatore'", res["error"])
        self.assertNotIn("temperature", res)

        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_heat_alert_high_threshold_breached_and_sent(self, mock_fetch, mock_send):
        """Test that High threshold (≥36°C) triggers email send and updates last_alert_time upon success."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 37.5,  # High risk (36°C - 39.9°C)
            "humidity": 45.0,
            "wind_speed": 4.0,
            "rainfall": 0.0,
            "weather_description": "Clear sky",
        }
        mock_send.return_value = {
            "success": True,
            "message": "Queued for delivery",
            "timestamp": "2026-10-10T12:00:00Z",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="High",
        )
        self.assertTrue(res["triggered"])
        self.assertTrue(res["sent"])
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["risk_level"], "High")
        self.assertEqual(res["temperature"], 37.5)
        self.assertEqual(mock_send.call_count, 1)

        # Telemetry check: last_alert_time IS recorded after successful send
        state = email_service.state_manager.load()
        self.assertIsNotNone(state.get("last_alert_time"))
        self.assertEqual(state.get("last_alert_city"), "Coimbatore")
        self.assertEqual(state.get("last_alert_level"), "High")

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_heat_alert_critical_threshold_breached_and_sent(self, mock_fetch, mock_send):
        """Test that Critical threshold (≥40°C) triggers email send and updates telemetry."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 41.2,  # Critical risk (≥40°C)
            "humidity": 30.0,
            "wind_speed": 6.0,
            "rainfall": 0.0,
            "weather_description": "Extreme heat",
        }
        mock_send.return_value = {
            "success": True,
            "message": "Delivered",
            "timestamp": "2026-10-10T12:00:00Z",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="Critical",
        )
        self.assertTrue(res["triggered"])
        self.assertTrue(res["sent"])
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["risk_level"], "Critical")
        self.assertEqual(res["temperature"], 41.2)
        self.assertEqual(mock_send.call_count, 1)

        state = email_service.state_manager.load()
        self.assertIsNotNone(state.get("last_alert_time"))
        self.assertEqual(state.get("last_alert_city"), "Coimbatore")
        self.assertEqual(state.get("last_alert_level"), "Critical")

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_heat_alert_high_temp_with_critical_threshold_does_not_send(self, mock_fetch, mock_send):
        """Test that 37.5°C (High) does NOT trigger when user configured Critical threshold (≥40°C)."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 37.5,  # High, but below Critical (40°C)
            "humidity": 45.0,
            "wind_speed": 4.0,
            "rainfall": 0.0,
            "weather_description": "Sunny",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="Critical",
        )
        self.assertFalse(res["triggered"])
        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "below_threshold")
        self.assertEqual(mock_send.call_count, 0)

        # Telemetry: last_alert_time remains None
        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_heat_alert_smtp_failure_does_not_update_last_alert_time(self, mock_fetch, mock_send):
        """Test that if SMTP fails to send, last_alert_time is NOT updated."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 38.0,
            "humidity": 40.0,
            "wind_speed": 3.0,
            "rainfall": 0.0,
            "weather_description": "Hot",
        }
        mock_send.return_value = {
            "success": False,
            "error": "SMTP server connection timed out",
            "error_type": "timeout_error",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="High",
        )
        self.assertTrue(res["triggered"])
        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "error")
        self.assertIn("SMTP server connection timed out", res["error"])

        # Telemetry: last_alert_time must NOT be updated because email was NOT delivered
        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))
        self.assertEqual(state.get("last_alert_status"), "failed")

    @patch("email_service.fetch_weather")
    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": "valid_api_key"})
    def test_api_post_alerts_check_weather_provider_failure_returns_clean_error(self, mock_fetch):
        """Test POST /api/alerts/check endpoint returns clean error when weather provider fails."""
        mock_fetch.return_value = None

        res = self.client.post("/api/alerts/check", json={"city": "Coimbatore", "email": "user@test.org"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["triggered"])
        self.assertFalse(data["sent"])
        self.assertEqual(data["status"], "error")
        self.assertIn("Unable to fetch weather data for 'Coimbatore'", data["error"])

    @patch("email_service.fetch_weather")
    @patch.dict("os.environ", {"OPENWEATHER_API_KEY": ""}, clear=True)
    def test_api_post_alerts_check_weather_unconfigured_returns_clean_error(self, mock_fetch):
        """Test POST /api/alerts/check endpoint returns clear error when weather service is unconfigured."""
        mock_fetch.return_value = None

        res = self.client.post("/api/alerts/check", json={"city": "Coimbatore", "email": "user@test.org"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["triggered"])
        self.assertFalse(data["sent"])
        self.assertEqual(data["status"], "error")
        self.assertIn("Weather service is unconfigured", data["error"])

    # ── 9. BACKGROUND WORKER STARTUP, SUBSCRIBER EVALUATION & COOLDOWN VERIFICATION ──
    def test_background_worker_lifecycle_start_and_stop(self):
        """Test starting and stopping the HeatAlertBackgroundMonitor."""
        monitor = email_service.background_monitor
        self.assertFalse(monitor.is_running())

        monitor.start()
        self.assertTrue(monitor.is_running())
        status = monitor.get_status()
        self.assertTrue(status["is_running"])
        self.assertTrue(status["running"])
        self.assertIn("interval_minutes", status)
        self.assertIn("active_subscribers", status)

        # Idempotent start - should remain running without error or duplicate threads
        monitor.start()
        self.assertTrue(monitor.is_running())

        monitor.stop()
        self.assertFalse(monitor.is_running())
        status_stopped = monitor.get_status()
        self.assertFalse(status_stopped["is_running"])

    def test_start_background_worker_backend_helper(self):
        """Test start_background_worker helper starts worker automatically with the backend."""
        monitor = email_service.background_monitor
        self.assertFalse(monitor.is_running())

        started = start_background_worker()
        self.assertTrue(started)
        self.assertTrue(monitor.is_running())

        # Second call returns False since already running
        started_again = start_background_worker()
        self.assertFalse(started_again)
        self.assertTrue(monitor.is_running())

        monitor.stop()
        self.assertFalse(monitor.is_running())

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_background_worker_evaluates_each_subscribers_saved_city_and_threshold(self, mock_fetch, mock_send):
        """Confirm background worker uses each subscriber's saved city and threshold."""
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-10T12:00:00Z"}

        def side_effect_weather(city_name):
            if city_name.lower() == "chennai":
                return {
                    "city": "Chennai",
                    "temperature": 41.0,  # Critical risk (≥40°C)
                    "humidity": 40.0,
                    "rainfall": 0.0,
                    "wind_speed": 3.0,
                    "weather_description": "Extreme Heat",
                }
            elif city_name.lower() == "coimbatore":
                return {
                    "city": "Coimbatore",
                    "temperature": 37.0,  # High risk (36°C-39.9°C)
                    "humidity": 45.0,
                    "rainfall": 0.0,
                    "wind_speed": 4.0,
                    "weather_description": "Hot",
                }
            return None

        mock_fetch.side_effect = side_effect_weather

        # Register 3 active subscribers and 1 inactive:
        # Sub 1: Chennai, Critical threshold (41°C is Critical -> triggers)
        # Sub 2: Coimbatore, High threshold (37°C is High -> triggers)
        # Sub 3: Coimbatore, Critical threshold (37°C is below Critical -> suppressed)
        # Sub 4: Salem, High threshold, Disabled -> skipped
        mgr = email_service.subscribers_manager
        mgr.register_subscriber("sub1@chennai.in", "Chennai", "Critical", enabled=True)
        mgr.register_subscriber("sub2@cbe.in", "Coimbatore", "High", enabled=True)
        mgr.register_subscriber("sub3@cbe.in", "Coimbatore", "Critical", enabled=True)
        mgr.register_subscriber("sub4@salem.in", "Salem", "High", enabled=False)

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 3)

        res_map = {r["subscriber"]: r["result"] for r in results}

        # Sub 1 (Chennai, Critical) -> Triggered & Sent
        self.assertTrue(res_map["sub1@chennai.in"]["triggered"])
        self.assertTrue(res_map["sub1@chennai.in"]["sent"])
        self.assertEqual(res_map["sub1@chennai.in"]["city"], "Chennai")
        self.assertEqual(res_map["sub1@chennai.in"]["risk_level"], "Critical")

        # Sub 2 (Coimbatore, High) -> Triggered & Sent
        self.assertTrue(res_map["sub2@cbe.in"]["triggered"])
        self.assertTrue(res_map["sub2@cbe.in"]["sent"])
        self.assertEqual(res_map["sub2@cbe.in"]["city"], "Coimbatore")
        self.assertEqual(res_map["sub2@cbe.in"]["risk_level"], "High")

        # Sub 3 (Coimbatore, Critical) -> Below threshold (37°C < 40°C Critical)
        self.assertFalse(res_map["sub3@cbe.in"]["triggered"])
        self.assertFalse(res_map["sub3@cbe.in"]["sent"])
        self.assertEqual(res_map["sub3@cbe.in"]["status"], "below_threshold")

        # Exactly 2 emails dispatched
        self.assertEqual(mock_send.call_count, 2)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_background_worker_continuous_checking_survives_single_subscriber_error(self, mock_fetch, mock_send):
        """Test that an unhandled exception on one subscriber does not abort continuous loop evaluation."""
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-10T12:00:00Z"}

        def side_effect(city_name):
            if city_name.lower() == "glitchcity":
                raise RuntimeError("Temporary remote connection drop")
            return {
                "city": "Madurai",
                "temperature": 38.0,
                "humidity": 40.0,
                "rainfall": 0.0,
                "wind_speed": 3.0,
                "weather_description": "Hot",
            }

        mock_fetch.side_effect = side_effect

        mgr = email_service.subscribers_manager
        mgr.register_subscriber("error.user@test.org", "GlitchCity", "High", enabled=True)
        mgr.register_subscriber("valid.user@test.org", "Madurai", "High", enabled=True)

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 2)

        # First subscriber logged error without crashing
        self.assertIn("error", results[0])
        self.assertIn("Temporary remote connection drop", results[0]["error"])

        # Second subscriber was evaluated and received email
        self.assertIn("result", results[1])
        self.assertTrue(results[1]["result"]["sent"])
        self.assertEqual(mock_send.call_count, 1)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_duplicate_alert_cooldown_same_city_same_level_suppression(self, mock_fetch, mock_send):
        """Confirm duplicate alerts for the same subscriber and city at same risk level are prevented by cooldown."""
        mock_send.return_value = {"success": True, "message": "Delivered", "timestamp": "2026-10-10T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Tirunelveli",
            "temperature": 38.5,
            "humidity": 45.0,
            "rainfall": 0.0,
            "wind_speed": 4.0,
            "weather_description": "Hot and Sunny",
        }

        # First evaluation: alert sent successfully
        res1 = email_service.evaluate_and_send_heat_alert(
            city="Tirunelveli",
            email="citizen@tirunelveli.gov.in",
            threshold="High",
        )
        self.assertTrue(res1["triggered"])
        self.assertTrue(res1["sent"])
        self.assertEqual(mock_send.call_count, 1)

        # Immediate second evaluation: suppressed by cooldown
        res2 = email_service.evaluate_and_send_heat_alert(
            city="Tirunelveli",
            email="citizen@tirunelveli.gov.in",
            threshold="High",
        )
        self.assertTrue(res2["triggered"])
        self.assertFalse(res2["sent"])
        self.assertEqual(res2["status"], "cooldown_suppressed")
        self.assertGreater(res2["cooldown_remaining_minutes"], 0)
        self.assertEqual(mock_send.call_count, 1)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_duplicate_alert_cooldown_per_subscriber_isolation(self, mock_fetch, mock_send):
        """Confirm cooldown for User A does NOT suppress alerts for User B in the same city."""
        mock_send.return_value = {"success": True, "message": "Delivered", "timestamp": "2026-10-10T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 38.0,
            "humidity": 40.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Hot",
        }

        # User A alert sent
        res_a = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="user.a@coimbatore.org",
            threshold="High",
        )
        self.assertTrue(res_a["sent"])

        # User B in same city evaluates immediately after -> must NOT be suppressed by User A's cooldown
        res_b = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="user.b@coimbatore.org",
            threshold="High",
        )
        self.assertTrue(res_b["sent"])
        self.assertEqual(mock_send.call_count, 2)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_duplicate_alert_cooldown_different_city_not_suppressed(self, mock_fetch, mock_send):
        """Confirm that if a subscriber changes their monitored city, cooldown for old city does not suppress new city."""
        mock_send.return_value = {"success": True, "message": "Delivered", "timestamp": "2026-10-10T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 38.0,
            "humidity": 40.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Hot",
        }

        # Alert sent for Coimbatore
        res1 = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="traveler@state.gov.in",
            threshold="High",
        )
        self.assertTrue(res1["sent"])

        # Next check for Madurai (different city) -> not suppressed
        mock_fetch.return_value = {
            "city": "Madurai",
            "temperature": 39.0,
            "humidity": 42.0,
            "rainfall": 0.0,
            "wind_speed": 3.5,
            "weather_description": "Hot",
        }
        res2 = email_service.evaluate_and_send_heat_alert(
            city="Madurai",
            email="traveler@state.gov.in",
            threshold="High",
        )
        self.assertTrue(res2["sent"])
        self.assertEqual(mock_send.call_count, 2)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_duplicate_alert_cooldown_escalation_bypasses_cooldown(self, mock_fetch, mock_send):
        """Confirm that risk escalation from High to Critical bypasses cooldown to dispatch an urgent alert."""
        mock_send.return_value = {"success": True, "message": "Delivered", "timestamp": "2026-10-10T12:00:00Z"}

        # High risk (37.5°C) -> sent
        mock_fetch.return_value = {
            "city": "Vellore",
            "temperature": 37.5,
            "humidity": 40.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Hot",
        }
        res1 = email_service.evaluate_and_send_heat_alert(
            city="Vellore",
            email="admin@vellore.gov.in",
            threshold="High",
        )
        self.assertTrue(res1["sent"])
        self.assertEqual(res1["risk_level"], "High")

        # Temperature escalates to Critical (42.5°C) within cooldown -> bypasses cooldown
        mock_fetch.return_value = {
            "city": "Vellore",
            "temperature": 42.5,
            "humidity": 30.0,
            "rainfall": 0.0,
            "wind_speed": 4.5,
            "weather_description": "Scorching Extreme Heat",
        }
        res2 = email_service.evaluate_and_send_heat_alert(
            city="Vellore",
            email="admin@vellore.gov.in",
            threshold="High",
        )
        self.assertTrue(res2["sent"])
        self.assertEqual(res2["risk_level"], "Critical")
        self.assertTrue(res2.get("escalated", False))
        self.assertEqual(mock_send.call_count, 2)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_last_alert_dispatched_strictly_updates_only_after_real_successful_delivery(self, mock_fetch, mock_send):
        """
        Verify Requirement 4: 'Last Alert Dispatched' updates only after a successful real email delivery.
        Ensures below-threshold conditions, cooldown suppression, unconfigured SMTP, and network delivery
        failures NEVER update last_alert_time.
        """
        # Step 1: Initial state has last_alert_time == None
        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))

        # Step 2: Weather below threshold (30°C) -> last_alert_time MUST remain None
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 30.0,
            "humidity": 50.0,
            "rainfall": 0.0,
            "wind_speed": 2.0,
            "weather_description": "Pleasant",
        }
        res_below = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="test@domain.org",
            threshold="High",
        )
        self.assertFalse(res_below["sent"])
        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))

        # Step 3: Extreme heat (42°C), but SMTP delivery fails -> last_alert_time MUST remain None
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": 42.0,
            "humidity": 30.0,
            "rainfall": 0.0,
            "wind_speed": 4.0,
            "weather_description": "Severe Heatwave",
        }
        mock_send.return_value = {
            "success": False,
            "error": "SMTP server connection timed out after 15s",
            "error_type": "timeout_error",
        }
        res_fail = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="test@domain.org",
            threshold="High",
        )
        self.assertTrue(res_fail["triggered"])
        self.assertFalse(res_fail["sent"])
        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))
        self.assertEqual(state.get("last_alert_status"), "failed")

        # Step 4: Real successful email delivery -> last_alert_time IS updated!
        mock_send.return_value = {
            "success": True,
            "message": "Dispatched via SMTP to test@domain.org",
            "timestamp": "2026-10-11T10:00:00Z",
        }
        res_success = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="test@domain.org",
            threshold="High",
        )
        self.assertTrue(res_success["sent"])
        state = email_service.state_manager.load()
        self.assertIsNotNone(state.get("last_alert_time"))
        recorded_time = state.get("last_alert_time")
        self.assertEqual(state.get("last_alert_city"), "Coimbatore")
        self.assertEqual(state.get("last_alert_level"), "Critical")
        self.assertEqual(state.get("last_alert_status"), "sent")

        # Step 5: Duplicate check suppressed by cooldown -> last_alert_time must NOT be modified
        res_cooldown = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="test@domain.org",
            threshold="High",
        )
        self.assertFalse(res_cooldown["sent"])
        state = email_service.state_manager.load()
        self.assertEqual(state.get("last_alert_time"), recorded_time)

        # Step 6: Test verification email (/api/alerts/test) does NOT touch last_alert_time
        res_test_endpoint = self.client.post("/api/alerts/test", json={"email": "test@domain.org"})
        self.assertEqual(res_test_endpoint.status_code, 200)
        state_after_test = email_service.state_manager.load()
        self.assertEqual(state_after_test.get("last_alert_time"), recorded_time)
        self.assertIsNotNone(state_after_test.get("last_test_time"))

    def test_subscribers_manager_prevents_duplicate_entries(self):
        """Confirm subscribers_manager registers uniquely by normalized email, avoiding duplicate entries."""
        mgr = email_service.subscribers_manager
        success1, sub1, msg1, is_new1 = mgr.register_subscriber(
            email="Citizen.One@Domain.Org",
            city="Coimbatore",
            threshold="High",
            enabled=True,
        )
        self.assertTrue(success1)
        self.assertTrue(is_new1)
        self.assertEqual(mgr.count_subscribers()["total"], 1)

        # Re-registering same email with updated city and threshold updates in-place
        success2, sub2, msg2, is_new2 = mgr.register_subscriber(
            email="citizen.one@domain.org ",
            city="Madurai",
            threshold="Critical",
            enabled=True,
        )
        self.assertTrue(success2)
        self.assertFalse(is_new2)
        self.assertEqual(mgr.count_subscribers()["total"], 1)
        self.assertEqual(sub2["city"], "Madurai")
        self.assertEqual(sub2["threshold"], "Critical")

    # ── 8. DYNAMIC CITY HANDLING & MULTI-SUBSCRIBER INDEPENDENCE TESTS ──

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_all_supported_dropdown_cities_dynamic_handling(self, mock_fetch, mock_send):
        """
        Verify Requirement 1 & 6: Dynamic city handling works for EVERY supported dropdown city.
        Ensure none are hardcoded to Coimbatore or Madurai and each city receives proper evaluation.
        """
        supported_cities = [
            "Ahmedabad",
            "Bengaluru",
            "Chennai",
            "Coimbatore",
            "Delhi",
            "Erode",
            "Hyderabad",
            "Jaipur",
            "Kolkata",
            "Lucknow",
            "Madurai",
            "Mumbai",
            "Mysuru",
            "Pune",
            "Salem",
            "Tiruchirappalli",
            "Tiruppur",
            "Trichy",
            "Vellore",
            "Visakhapatnam",
        ]

        mock_send.return_value = {
            "success": True,
            "message": "Delivered",
            "timestamp": "2026-10-11T12:00:00Z",
        }

        for city_name in supported_cities:
            mock_fetch.return_value = {
                "city": city_name,
                "temperature": 39.5,
                "humidity": 40.0,
                "rainfall": 0.0,
                "wind_speed": 3.2,
                "weather_description": "Clear and Very Hot",
            }

            subscriber_email = f"citizen@{city_name.lower().replace(' ', '')}.gov.in"
            res = email_service.evaluate_and_send_heat_alert(
                city=city_name,
                email=subscriber_email,
                threshold="High",
                force_send=True,
                check_type="manual",
            )

            self.assertTrue(res["triggered"], f"City {city_name} should trigger alert at 39.5°C")
            self.assertTrue(res["sent"], f"City {city_name} alert should be sent")
            self.assertEqual(res["city"], city_name, f"City name should match {city_name}")
            self.assertEqual(res["check_type"], "manual")
            self.assertIn("[Manual Check]", res["message"])
            self.assertIn(city_name, res["message"])

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_multi_subscriber_independent_cities_and_thresholds(self, mock_fetch, mock_send):
        """
        Verify Requirement 2: Independent monitoring for every subscriber.
        Multiple subscribers in different cities with different thresholds evaluated independently.
        One subscriber's city or threshold must never affect another's outcome.
        """
        mock_send.return_value = {
            "success": True,
            "message": "Delivered successfully",
            "timestamp": "2026-10-11T12:00:00Z",
        }

        # Setup 4 distinct subscribers across different cities with different thresholds:
        # Sub 1: Delhi, 38°C (High threshold) -> Triggered & Sent
        # Sub 2: Mumbai, 38°C (Critical threshold) -> Below threshold (38°C < 40°C) -> Not Sent
        # Sub 3: Chennai, 41°C (High threshold) -> Triggered & Sent
        # Sub 4: Salem, 42°C (Critical threshold) -> Triggered & Sent
        mgr = email_service.subscribers_manager
        mgr.register_subscriber("delhi.user@delhi.in", "Delhi", "High", enabled=True)
        mgr.register_subscriber("mumbai.user@mumbai.in", "Mumbai", "Critical", enabled=True)
        mgr.register_subscriber("chennai.user@chennai.in", "Chennai", "High", enabled=True)
        mgr.register_subscriber("salem.user@salem.in", "Salem", "Critical", enabled=True)

        def mock_weather_by_city(city_arg, *args, **kwargs):
            c = (city_arg or "").lower()
            if "delhi" in c:
                return {"city": "Delhi", "temperature": 38.0, "humidity": 30.0, "rainfall": 0.0, "wind_speed": 3.0}
            elif "mumbai" in c:
                return {"city": "Mumbai", "temperature": 38.0, "humidity": 65.0, "rainfall": 0.0, "wind_speed": 4.0}
            elif "chennai" in c:
                return {"city": "Chennai", "temperature": 41.0, "humidity": 50.0, "rainfall": 0.0, "wind_speed": 2.5}
            elif "salem" in c:
                return {"city": "Salem", "temperature": 42.0, "humidity": 35.0, "rainfall": 0.0, "wind_speed": 3.0}
            return None

        mock_fetch.side_effect = mock_weather_by_city

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 4)

        res_by_email = {r["subscriber"]: r["result"] for r in results}

        # Delhi: 38°C, High -> Sent
        self.assertTrue(res_by_email["delhi.user@delhi.in"]["sent"])
        self.assertEqual(res_by_email["delhi.user@delhi.in"]["city"], "Delhi")
        self.assertEqual(res_by_email["delhi.user@delhi.in"]["risk_level"], "High")

        # Mumbai: 38°C, Critical -> Not sent (below threshold)
        self.assertFalse(res_by_email["mumbai.user@mumbai.in"]["sent"])
        self.assertEqual(res_by_email["mumbai.user@mumbai.in"]["city"], "Mumbai")
        self.assertEqual(res_by_email["mumbai.user@mumbai.in"]["status"], "below_threshold")

        # Chennai: 41°C, High -> Sent
        self.assertTrue(res_by_email["chennai.user@chennai.in"]["sent"])
        self.assertEqual(res_by_email["chennai.user@chennai.in"]["city"], "Chennai")
        self.assertEqual(res_by_email["chennai.user@chennai.in"]["risk_level"], "Critical")

        # Salem: 42°C, Critical -> Sent
        self.assertTrue(res_by_email["salem.user@salem.in"]["sent"])
        self.assertEqual(res_by_email["salem.user@salem.in"]["city"], "Salem")
        self.assertEqual(res_by_email["salem.user@salem.in"]["risk_level"], "Critical")

        # Total emails dispatched: exactly 3 (Delhi, Chennai, Salem)
        self.assertEqual(mock_send.call_count, 3)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_resilience_and_error_isolation_across_subscribers(self, mock_fetch, mock_send):
        """
        Verify Requirement 5: Handling invalid cities or API failure for one subscriber
        does not stop or crash monitoring for other subscribers.
        """
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-11T12:00:00Z"}

        mgr = email_service.subscribers_manager
        mgr.register_subscriber("valid1@bengaluru.in", "Bengaluru", "High", enabled=True)
        mgr.register_subscriber("invalid@broken.in", "NonExistentCityXYZ", "High", enabled=True)
        mgr.register_subscriber("valid2@jaipur.in", "Jaipur", "High", enabled=True)

        def mock_weather_selective(city_arg, *args, **kwargs):
            if city_arg == "Bengaluru":
                return {"city": "Bengaluru", "temperature": 37.0, "humidity": 45.0, "rainfall": 0.0, "wind_speed": 3.0}
            elif city_arg == "Jaipur":
                return {"city": "Jaipur", "temperature": 41.0, "humidity": 25.0, "rainfall": 0.0, "wind_speed": 4.0}
            return None  # Failure for NonExistentCityXYZ

        mock_fetch.side_effect = mock_weather_selective

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 3)

        res_map = {r["subscriber"]: r["result"] for r in results}

        # Valid 1: Bengaluru succeeded
        self.assertTrue(res_map["valid1@bengaluru.in"]["sent"])
        self.assertEqual(res_map["valid1@bengaluru.in"]["city"], "Bengaluru")

        # Invalid: NonExistentCityXYZ returned error status but did not crash process
        self.assertFalse(res_map["invalid@broken.in"]["sent"])
        self.assertEqual(res_map["invalid@broken.in"]["status"], "error")

        # Valid 2: Jaipur succeeded
        self.assertTrue(res_map["valid2@jaipur.in"]["sent"])
        self.assertEqual(res_map["valid2@jaipur.in"]["city"], "Jaipur")

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_dashboard_telemetry_isolation_and_distinct_check_types(self, mock_fetch, mock_send):
        """
        Verify Requirement 3: Service Delivery Log and telemetry show the subscriber's own city
        and clearly distinguish [Manual Check] from [Background Worker].
        """
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-11T12:00:00Z"}

        # 1. Background worker evaluates Sub A in Kolkata
        mock_fetch.return_value = {
            "city": "Kolkata",
            "temperature": 39.0,
            "humidity": 60.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
        }
        res_bg = email_service.evaluate_and_send_heat_alert(
            city="Kolkata",
            email="sub.kolkata@domain.org",
            threshold="High",
            check_type="background",
        )
        self.assertTrue(res_bg["sent"])
        self.assertIn("[Background Worker]", res_bg["message"])
        self.assertIn("Kolkata", res_bg["message"])

        # 2. Manual check evaluated for Sub B in Pune
        mock_fetch.return_value = {
            "city": "Pune",
            "temperature": 33.0,
            "humidity": 45.0,
            "rainfall": 0.0,
            "wind_speed": 2.5,
        }
        res_manual = self.client.post("/api/alerts/check", json={
            "city": "Pune",
            "email": "sub.pune@domain.org",
            "threshold": "High",
        })
        self.assertEqual(res_manual.status_code, 200)
        data_manual = res_manual.get_json()
        self.assertEqual(data_manual["check_type"], "manual")
        self.assertEqual(data_manual["status"], "below_threshold")
        self.assertIn("[Manual Check]", data_manual["reason"])
        self.assertIn("Pune", data_manual["reason"])

        # 3. Querying /api/alerts/config?email=sub.kolkata@domain.org returns Kolkata log
        cfg_kolkata = self.client.get("/api/alerts/config?email=sub.kolkata@domain.org")
        self.assertEqual(cfg_kolkata.status_code, 200)
        data_kolkata = cfg_kolkata.get_json()
        self.assertIn("Kolkata", data_kolkata["last_delivery_message"])
        self.assertIn("[Background Worker]", data_kolkata["last_delivery_message"])
        self.assertNotIn("Pune", data_kolkata["last_delivery_message"])

        # 4. Querying /api/alerts/config?email=sub.pune@domain.org returns Pune log
        cfg_pune = self.client.get("/api/alerts/config?email=sub.pune@domain.org")
        self.assertEqual(cfg_pune.status_code, 200)
        data_pune = cfg_pune.get_json()
        self.assertIn("Pune", data_pune["last_delivery_message"])
        self.assertIn("[Manual Check]", data_pune["last_delivery_message"])
        self.assertNotIn("Kolkata", data_pune["last_delivery_message"])

    def test_api_register_requires_city_non_blank(self):
        """Verify Requirement 1: Register endpoint rejects blank city instead of hardcoding to Coimbatore."""
        res = self.client.post("/api/alerts/register", json={
            "email": "nocities@domain.in",
            "city": "",
            "threshold": "High",
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("Monitored city cannot be blank", data["error"])

    def test_no_prefilled_personal_email_or_default_city(self):
        """Verify Requirement 1 & 2: Default preferences and config have no prefilled personal email or city."""
        pref_mgr = email_service.preferences_manager
        prefs = pref_mgr.load()
        self.assertEqual(prefs.get("email"), "")
        self.assertEqual(prefs.get("city"), "")
        self.assertNotIn("nagasruthi", str(prefs).lower())

        res = self.client.get("/api/alerts/config")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNone(data.get("subscriber"))
        self.assertEqual(data.get("preferences", {}).get("email"), "")
        self.assertEqual(data.get("preferences", {}).get("city"), "")
        self.assertNotIn("nagasruthi", str(data.get("preferences", {})).lower())

    def test_registration_validation_and_city_change(self):
        """Verify Requirement 4 & 5: Validates required fields, saves explicit city, and updates on change."""
        # Missing email
        res1 = self.client.post("/api/alerts/register", json={"email": "", "city": "Jaipur"})
        self.assertEqual(res1.status_code, 400)
        self.assertIn("Email address is required", res1.get_json()["error"])

        # Missing city
        res2 = self.client.post("/api/alerts/register", json={"email": "valid@gmail.com", "city": ""})
        self.assertEqual(res2.status_code, 400)
        self.assertIn("Monitored city cannot be blank", res2.get_json()["error"])

        # Successful registration with Jaipur
        res3 = self.client.post("/api/alerts/register", json={
            "email": "valid@gmail.com",
            "city": "Jaipur",
            "threshold": "Critical",
            "enabled": True,
        })
        self.assertEqual(res3.status_code, 200)
        sub = email_service.subscribers_manager.get_subscriber("valid@gmail.com")
        self.assertEqual(sub["city"], "Jaipur")
        self.assertEqual(sub["threshold"], "Critical")

        # Changing city to Lucknow updates details cleanly
        res4 = self.client.post("/api/alerts/register", json={
            "email": "valid@gmail.com",
            "city": "Lucknow",
            "threshold": "High",
            "enabled": True,
        })
        self.assertEqual(res4.status_code, 200)
        updated_sub = email_service.subscribers_manager.get_subscriber("valid@gmail.com")
        self.assertEqual(updated_sub["city"], "Lucknow")
        self.assertEqual(updated_sub["threshold"], "High")

    def test_empty_defaults_and_no_automatic_subscription(self):
        """Verify: Initial state has empty defaults, no subscriber pre-selected, and test emails never auto-subscribe."""
        # 1. Config call with empty/no email returns no subscriber
        res = self.client.get("/api/alerts/config")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNone(data.get("subscriber"))
        self.assertEqual(data.get("preferences", {}).get("email", ""), "")
        self.assertEqual(data.get("preferences", {}).get("city", ""), "")

        # 2. Sending a test email to a recipient must NOT register or auto-subscribe that user
        test_email = "testrecipient.unregistered@example.com"
        with patch.object(email_service, "is_smtp_configured", return_value=(True, [])):
            with patch.object(email_service, "send_email_smtp", return_value={
                "success": True,
                "message": "Dispatched",
                "timestamp": "2026-10-11T12:00:00Z",
            }):
                test_res = self.client.post("/api/alerts/test", json={"email": test_email})
                self.assertEqual(test_res.status_code, 200)

        # 3. Verify user is NOT in subscribers_manager
        self.assertIsNone(email_service.subscribers_manager.get_subscriber(test_email))
        
        # 4. Querying config for that test recipient still shows NOT registered (subscriber: null)
        config_after = self.client.get(f"/api/alerts/config?email={test_email}").get_json()
        self.assertIsNone(config_after.get("subscriber"))

    def test_unique_cities_and_explicit_city_selection_isolation(self):
        """Verify: Unique city dropdown options, explicit city selection, and no silent Coimbatore overrides."""
        # Check backend known city coordinates dictionary has clean keys
        try:
            from weather import KNOWN_CITY_COORDINATES
        except ImportError:
            from backend.weather import KNOWN_CITY_COORDINATES
        self.assertIn("madurai", KNOWN_CITY_COORDINATES)
        self.assertIn("chennai", KNOWN_CITY_COORDINATES)
        self.assertIn("jaipur", KNOWN_CITY_COORDINATES)

        # Register user A with Madurai
        res_a = self.client.post("/api/alerts/register", json={
            "email": "madurai.resident@test.org",
            "city": "Madurai",
            "threshold": "Critical",
        })
        self.assertEqual(res_a.status_code, 200)

        # Register user B with Chennai
        res_b = self.client.post("/api/alerts/register", json={
            "email": "chennai.resident@test.org",
            "city": "Chennai",
            "threshold": "High",
        })
        self.assertEqual(res_b.status_code, 200)

        # Confirm User A has Madurai and User B has Chennai (never overwritten with Coimbatore)
        sub_a = email_service.subscribers_manager.get_subscriber("madurai.resident@test.org")
        sub_b = email_service.subscribers_manager.get_subscriber("chennai.resident@test.org")
        self.assertEqual(sub_a["city"], "Madurai")
        self.assertEqual(sub_b["city"], "Chennai")
        self.assertNotEqual(sub_a["city"], "Coimbatore")
        self.assertNotEqual(sub_b["city"], "Coimbatore")

    # ── 11. WORLDWIDE LOCATION SELECTION & COORDINATE MONITORING ──
    def test_global_location_search_api(self):
        """Test GET /api/locations/search for worldwide location search & coordinates parsing."""
        # 1. Empty query returns empty results
        res_empty = self.client.get("/api/locations/search?q=")
        self.assertEqual(res_empty.status_code, 200)
        self.assertEqual(res_empty.get_json()["results"], [])

        # 2. Direct coordinates query returns parsed location
        res_coords = self.client.get("/api/locations/search?q=35.6762,139.6503")
        self.assertEqual(res_coords.status_code, 200)
        results = res_coords.get_json()["results"]
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]["lat"], 35.6762)
        self.assertEqual(results[0]["lon"], 139.6503)

    def test_global_location_reverse_api(self):
        """Test GET /api/locations/reverse for reverse geocoding coordinates."""
        # 1. Missing parameters return 400
        res_missing = self.client.get("/api/locations/reverse")
        self.assertEqual(res_missing.status_code, 400)

        # 2. Valid coordinates return location info
        with patch("app.reverse_geocode", return_value={"name": "Tokyo", "display_name": "Tokyo, Japan", "country": "Japan", "state": ""}):
            res = self.client.get("/api/locations/reverse?lat=35.6762&lon=139.6503")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data["lat"], 35.6762)
            self.assertEqual(data["lon"], 139.6503)
            self.assertEqual(data["name"], "Tokyo")

    def test_subscriber_registration_with_coordinates(self):
        """Test registering subscriber with worldwide coordinates and verifying persistence."""
        res = self.client.post("/api/alerts/register", json={
            "email": "global.user@tokyo.jp",
            "city": "Tokyo, Japan",
            "latitude": 35.6762,
            "longitude": 139.6503,
            "threshold": "Critical",
            "enabled": True,
        })
        self.assertEqual(res.status_code, 200)
        sub = email_service.subscribers_manager.get_subscriber("global.user@tokyo.jp")
        self.assertIsNotNone(sub)
        self.assertEqual(sub["city"], "Tokyo, Japan")
        self.assertEqual(sub["latitude"], 35.6762)
        self.assertEqual(sub["longitude"], 139.6503)
        self.assertEqual(sub["threshold"], "Critical")

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_heat_alert_with_coordinates(self, mock_fetch, mock_send):
        """Test evaluate_and_send_heat_alert uses explicit coordinates."""
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-11T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Sydney",
            "temperature": 41.5,
            "humidity": 30.0,
            "rainfall": 0.0,
            "wind_speed": 4.5,
            "weather_description": "Extreme Heat",
            "lat": -33.8688,
            "lon": 151.2093,
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Sydney",
            email="resident@sydney.au",
            threshold="Critical",
            lat=-33.8688,
            lon=151.2093,
            force_send=True,
            check_type="manual",
        )
        self.assertTrue(res["sent"])
        self.assertEqual(res["risk_level"], "Critical")
        mock_fetch.assert_called_with("Sydney", lat=-33.8688, lon=151.2093)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_all_active_subscribers_independent_coordinates(self, mock_fetch, mock_send):
        """Test background monitoring evaluates each subscriber with their own saved coordinates."""
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-11T12:00:00Z"}

        def side_effect_fetch(city=None, lat=None, lon=None):
            if city == "Tokyo" or (lat == 35.6762 and lon == 139.6503):
                return {
                    "city": "Tokyo",
                    "temperature": 41.0,
                    "humidity": 40.0,
                    "rainfall": 0.0,
                    "wind_speed": 3.0,
                    "weather_description": "Severe Heat",
                }
            elif city == "London" or (lat == 51.5074 and lon == -0.1278):
                return {
                    "city": "London",
                    "temperature": 22.0,
                    "humidity": 60.0,
                    "rainfall": 1.0,
                    "wind_speed": 4.0,
                    "weather_description": "Mild Rain",
                }
            return None

        mock_fetch.side_effect = side_effect_fetch

        mgr = email_service.subscribers_manager
        mgr.register_subscriber("user.tokyo@test.org", "Tokyo", "High", True, lat=35.6762, lon=139.6503)
        mgr.register_subscriber("user.london@test.org", "London", "High", True, lat=51.5074, lon=-0.1278)

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 2)

        tokyo_res = next(r for r in results if r["subscriber"] == "user.tokyo@test.org")
        london_res = next(r for r in results if r["subscriber"] == "user.london@test.org")

        self.assertEqual(tokyo_res["city"], "Tokyo")
        self.assertEqual(tokyo_res["latitude"], 35.6762)
        self.assertEqual(tokyo_res["result"]["risk_level"], "Critical")
        self.assertTrue(tokyo_res["result"]["sent"])

        self.assertEqual(london_res["city"], "London")
        self.assertEqual(london_res["latitude"], 51.5074)
        self.assertEqual(london_res["result"]["status"], "below_threshold")
        self.assertFalse(london_res["result"]["sent"])

    # ── 12. REAL HEAT ALERT EMAIL TEMPLATE & CONTENT VERIFICATION ──
    def test_build_heat_alert_email_coimbatore_example_content(self):
        """Verify dynamic subject and all required content for Coimbatore 37.2°C High Alert."""
        subject, plain_text, html_content = email_service.build_heat_alert_email(
            to_email="subscriber@coimbatore.in",
            city="Coimbatore",
            risk_level="High",
            risk_score=82.7,
            temperature=37.2,
            humidity=55.0,
            wind_speed=14.4,
            rainfall=0.0,
            weather_desc="Scattered clouds",
            threshold="High",
            country="India",
            observed_time="2026-10-11 14:00:00 UTC",
        )

        # 1. Subject format: [HIGH HEAT ALERT] Coimbatore — 37.2°C
        self.assertEqual(subject, "[HIGH HEAT ALERT] Coimbatore — 37.2°C")

        # 2. Location & Country
        self.assertIn("Coimbatore", plain_text)
        self.assertIn("India", plain_text)
        self.assertIn("Coimbatore", html_content)
        self.assertIn("India", html_content)

        # 3. Current Temperature
        self.assertIn("37.2°C", plain_text)
        self.assertIn("37.2°C", html_content)

        # 4. Heat Risk Level
        self.assertIn("High", plain_text)
        self.assertIn("High", html_content)

        # 5. Weather fields (humidity, wind speed, rainfall)
        self.assertIn("55%", plain_text)
        self.assertIn("14.4 km/h", plain_text)
        self.assertIn("0.0 mm", plain_text)

        # 6. Subscriber threshold & why alert was triggered
        self.assertIn("High", plain_text)
        self.assertIn("36°C", plain_text)
        self.assertIn("Why This Alert Was Triggered", plain_text)
        self.assertIn("meets or exceeds", plain_text)

        # 7. Timestamp
        self.assertIn("2026-10-11 14:00:00 UTC", plain_text)
        self.assertIn("2026-10-11 14:00:00 UTC", html_content)

        # 8. Practical heat-safety recommendations
        self.assertIn("fluid intake", plain_text.lower())
        self.assertIn("cotton clothing", plain_text.lower())

        # 9. Link to dashboard
        self.assertIn("http://localhost:5173", plain_text)
        self.assertIn("http://localhost:5173", html_content)

    def test_build_heat_alert_email_critical_madurai(self):
        """Verify dynamic subject and critical safety advice for Madurai 41.0°C Critical Alert."""
        subject, plain_text, html_content = email_service.build_heat_alert_email(
            to_email="resident@madurai.gov.in",
            city="Madurai",
            risk_level="Critical",
            risk_score=95.0,
            temperature=41.0,
            humidity=38.0,
            wind_speed=18.0,
            rainfall=None,  # Missing measurement
            threshold="Critical",
            country="India",
        )

        self.assertEqual(subject, "[CRITICAL HEAT ALERT] Madurai — 41.0°C")
        self.assertIn("CRITICAL HEAT", plain_text)
        self.assertIn("≥40°C", plain_text)
        self.assertIn("STAY INDOORS", plain_text)
        self.assertIn("heat stroke", plain_text.lower())
        # Rainfall was None so it should not appear as a recorded metric
        self.assertNotIn("Rainfall: None", plain_text)
        self.assertNotIn("Rainfall: 0", plain_text)

    def test_build_heat_alert_email_missing_measurements_omitted(self):
        """Confirm missing weather fields (humidity, wind, rain) are omitted without inventing values."""
        subject, plain_text, html_content = email_service.build_heat_alert_email(
            to_email="test@domain.com",
            city="Phoenix",
            risk_level="High",
            risk_score=85.0,
            temperature=38.5,
            humidity=None,
            wind_speed=None,
            rainfall=None,
            threshold="High",
        )

        self.assertEqual(subject, "[HIGH HEAT ALERT] Phoenix — 38.5°C")
        self.assertNotIn("Relative Humidity: None", plain_text)
        self.assertNotIn("Wind Speed: None", plain_text)
        self.assertNotIn("Rainfall: None", plain_text)

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_evaluate_and_send_heat_alert_dispatches_exact_subject(self, mock_fetch, mock_send):
        """Confirm evaluate_and_send_heat_alert generates dynamic subject and delivers email."""
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-11T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "country": "India",
            "temperature": 37.2,
            "humidity": 52.0,
            "wind_speed": 4.0,
            "rainfall": 0.0,
            "weather_description": "Clear Sky",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="High",
            force_send=True,
            check_type="manual",
        )

        self.assertTrue(res["sent"])
        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        self.assertEqual(call_kwargs["subject"], "[HIGH HEAT ALERT] Coimbatore — 37.2°C")
        self.assertIn("Coimbatore", call_kwargs["plain_text"])
        self.assertIn("37.2°C", call_kwargs["plain_text"])
        self.assertIn("Why This Alert Was Triggered", call_kwargs["plain_text"])

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_missing_temperature_does_not_send_alert(self, mock_fetch, mock_send):
        """Ensure that if temperature is missing from weather data, no alert is sent."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "temperature": None,
            "humidity": 60.0,
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="citizen@coimbatore.in",
            threshold="High",
            force_send=True,
        )

        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "error")
        self.assertEqual(mock_send.call_count, 0)

    def test_different_cities_worldwide_dynamic_email_generation(self):
        """Test dynamic subject, country, and safety content across multiple worldwide cities."""
        cities_test_cases = [
            {
                "city": "Seville",
                "country": "Spain",
                "temp": 39.4,
                "risk": "High",
                "score": 88.0,
                "expected_subj": "[HIGH HEAT ALERT] Seville — 39.4°C",
            },
            {
                "city": "Las Vegas",
                "country": "United States",
                "temp": 43.1,
                "risk": "Critical",
                "score": 98.0,
                "expected_subj": "[CRITICAL HEAT ALERT] Las Vegas — 43.1°C",
            },
            {
                "city": "New Delhi",
                "country": "India",
                "temp": 40.8,
                "risk": "Critical",
                "score": 94.0,
                "expected_subj": "[CRITICAL HEAT ALERT] New Delhi — 40.8°C",
            },
            {
                "city": "Tokyo",
                "country": "Japan",
                "temp": 36.5,
                "risk": "High",
                "score": 86.0,
                "expected_subj": "[HIGH HEAT ALERT] Tokyo — 36.5°C",
            },
        ]

        for case in cities_test_cases:
            subj, plain, html = email_service.build_heat_alert_email(
                to_email="subscriber@climate-watch.org",
                city=case["city"],
                risk_level=case["risk"],
                risk_score=case["score"],
                temperature=case["temp"],
                humidity=45.0,
                wind_speed=12.0,
                rainfall=0.0,
                threshold=case["risk"],
                country=case["country"],
            )

            self.assertEqual(subj, case["expected_subj"])
            self.assertIn(case["city"], plain)
            self.assertIn(case["country"], plain)
            self.assertIn(f"{case['temp']:.1f}°C", plain)
            self.assertIn(case["city"], html)
            self.assertIn(case["country"], html)
            self.assertIn("dashboard", plain.lower())

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_threshold_evaluation_combinations(self, mock_fetch, mock_send):
        """Test threshold logic: High (≥36°C) triggers for High and Critical; Critical-only triggers only for ≥40°C."""
        mock_send.return_value = {"success": True, "message": "Dispatched"}

        # Case 1: High threshold at 36.5°C -> Triggers High Alert
        mock_fetch.return_value = {"city": "Chennai", "country": "India", "temperature": 36.5, "humidity": 65.0}
        res1 = email_service.evaluate_and_send_heat_alert(
            city="Chennai", email="user1@chennai.in", threshold="High", force_send=True
        )
        self.assertTrue(res1["triggered"])
        self.assertTrue(res1["sent"])

        # Case 2: High threshold at 41.0°C -> Triggers Critical Alert (as High threshold includes Critical)
        mock_fetch.return_value = {"city": "Chennai", "country": "India", "temperature": 41.0, "humidity": 40.0}
        res2 = email_service.evaluate_and_send_heat_alert(
            city="Chennai", email="user2@chennai.in", threshold="High", force_send=True
        )
        self.assertTrue(res2["triggered"])
        self.assertTrue(res2["sent"])
        self.assertEqual(res2["risk_level"], "Critical")

        # Case 3: Critical-only threshold at 37.5°C -> Below threshold (Not triggered, Not sent)
        mock_send.reset_mock()
        mock_fetch.return_value = {"city": "Madurai", "country": "India", "temperature": 37.5, "humidity": 50.0}
        res3 = email_service.evaluate_and_send_heat_alert(
            city="Madurai", email="user3@madurai.in", threshold="Critical", force_send=True
        )
        self.assertFalse(res3["triggered"])
        self.assertFalse(res3["sent"])
        self.assertEqual(res3["status"], "below_threshold")
        mock_send.assert_not_called()

        # Case 4: Critical-only threshold at 42.0°C -> Triggers Critical Alert
        mock_fetch.return_value = {"city": "Madurai", "country": "India", "temperature": 42.0, "humidity": 35.0}
        res4 = email_service.evaluate_and_send_heat_alert(
            city="Madurai", email="user4@madurai.in", threshold="Critical", force_send=True
        )
        self.assertTrue(res4["triggered"])
        self.assertTrue(res4["sent"])
        self.assertEqual(res4["risk_level"], "Critical")
        mock_send.assert_called_once()

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_delivery_failure_does_not_update_last_alert_dispatched(self, mock_fetch, mock_send):
        """Verify that when SMTP delivery fails, Last Alert Dispatched is NOT updated."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "country": "India",
            "temperature": 38.0,
            "humidity": 50.0,
        }
        # Simulate SMTP failure
        mock_send.return_value = {
            "success": False,
            "error": "Connection timed out to SMTP host",
            "error_type": "timeout",
        }

        # Register a test subscriber
        email_service.subscribers_manager.register_subscriber("failtest@domain.com", "Coimbatore", "High")

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="failtest@domain.com",
            threshold="High",
            force_send=True,
        )

        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "error")

        # Global state should NOT have recorded last_alert_time
        global_state = email_service.state_manager.load()
        self.assertIsNone(global_state.get("last_alert_time"))

        # Subscriber history should NOT have last_alert_time
        sub_hist = email_service.state_manager.get_subscriber_history("failtest@domain.com")
        self.assertIsNone(sub_hist.get("last_alert_time"))

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_delivery_success_updates_last_alert_dispatched(self, mock_fetch, mock_send):
        """Verify that when SMTP delivery succeeds, Last Alert Dispatched IS updated."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "country": "India",
            "temperature": 38.0,
            "humidity": 50.0,
        }
        mock_send.return_value = {
            "success": True,
            "message": "Delivered successfully",
        }

        email_service.subscribers_manager.register_subscriber("successtest@domain.com", "Coimbatore", "High")

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="successtest@domain.com",
            threshold="High",
            force_send=True,
        )

        self.assertTrue(res["sent"])
        self.assertEqual(res["status"], "success")

        # Global state MUST record last_alert_time
        global_state = email_service.state_manager.load()
        self.assertIsNotNone(global_state.get("last_alert_time"))
        self.assertEqual(global_state.get("last_alert_city"), "Coimbatore")

        # Subscriber history MUST record last_alert_time
        sub_hist = email_service.state_manager.get_subscriber_history("successtest@domain.com")
        self.assertIsNotNone(sub_hist.get("last_alert_time"))
        self.assertEqual(sub_hist.get("last_alert_city"), "Coimbatore")

    @patch("email_service.fetch_weather")
    def test_weather_api_failure_does_not_send_email(self, mock_fetch):
        """Verify that when weather API fails or returns None, no alert is sent."""
        mock_fetch.return_value = None

        res = email_service.evaluate_and_send_heat_alert(
            city="Coimbatore",
            email="api_fail@domain.com",
            threshold="High",
            force_send=True,
        )

        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "error")

    @patch("email_service.send_email_smtp")
    def test_send_test_email_separate_from_real_heat_alert(self, mock_smtp):
        """Verify that send_test_email and send_heat_alert_email remain strictly separate with distinct templates."""
        mock_smtp.return_value = {"success": True, "message": "Dispatched"}

        # 1. Dispatch test verification email
        res_test = email_service.send_test_email("tester@example.com")
        self.assertTrue(res_test["success"])
        mock_smtp.assert_called_once()
        test_call = mock_smtp.call_args[1]
        self.assertEqual(test_call["subject"], "[Test Verification] Smart El Niño Heat Monitoring System Alert Service")
        self.assertIn("Test Email Verification", test_call["plain_text"])
        self.assertIn("central Email Heat Alert delivery pipeline is functioning correctly", test_call["plain_text"])
        self.assertNotIn("HIGH HEAT ALERT", test_call["plain_text"])
        self.assertNotIn("CRITICAL HEAT ALERT", test_call["plain_text"])

        # 2. Dispatch real heat alert email
        mock_smtp.reset_mock()
        res_alert = email_service.send_heat_alert_email(
            to_email="citizen@coimbatore.in",
            city="Coimbatore",
            risk_level="High",
            risk_score=87.5,
            temperature=37.2,
            humidity=55.0,
            wind_speed=14.4,
            rainfall=0.0,
            weather_desc="Scattered Clouds",
            threshold="High",
            country="India",
        )
        self.assertTrue(res_alert["success"])
        mock_smtp.assert_called_once()
        alert_call = mock_smtp.call_args[1]
        self.assertEqual(alert_call["subject"], "[HIGH HEAT ALERT] Coimbatore — 37.2°C")
        self.assertIn("Coimbatore", alert_call["plain_text"])
        self.assertIn("India", alert_call["plain_text"])
        self.assertIn("37.2°C", alert_call["plain_text"])
        self.assertIn("High", alert_call["plain_text"])
        self.assertIn("Why This Alert Was Triggered", alert_call["plain_text"])
        self.assertIn("Recommended Heat-Safety Recommendations", alert_call["plain_text"])
        self.assertNotIn("[Test Verification]", alert_call["subject"])
        self.assertNotIn("Test Email Verification", alert_call["plain_text"])

    @patch("email_service.send_test_email")
    @patch("email_service.send_heat_alert_email")
    @patch("email_service.fetch_weather")
    def test_background_worker_calls_send_heat_alert_email_not_send_test_email(
        self, mock_fetch, mock_send_alert, mock_send_test
    ):
        """Confirm that the background monitoring routine calls send_heat_alert_email and NEVER send_test_email."""
        mock_send_alert.return_value = {"success": True, "message": "Dispatched"}
        mock_fetch.return_value = {
            "city": "Madurai",
            "country": "India",
            "temperature": 41.5,
            "humidity": 35.0,
            "wind_speed": 3.5,
            "rainfall": 0.0,
            "weather_description": "Clear Sky",
        }

        # Register active subscriber with Critical threshold
        email_service.subscribers_manager.register_subscriber(
            email="subscriber@madurai.gov.in",
            city="Madurai",
            threshold="Critical",
            enabled=True,
        )

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 1)

        # Confirm send_heat_alert_email was called with the actual subscriber data
        mock_send_alert.assert_called_once()
        alert_kwargs = mock_send_alert.call_args[1]
        self.assertEqual(alert_kwargs["to_email"], "subscriber@madurai.gov.in")
        self.assertEqual(alert_kwargs["city"], "Madurai")
        self.assertEqual(alert_kwargs["temperature"], 41.5)
        self.assertEqual(alert_kwargs["risk_level"], "Critical")
        self.assertEqual(alert_kwargs["threshold"], "Critical")

        # Confirm send_test_email was NEVER called by the background worker
        mock_send_test.assert_not_called()

    @patch("email_service.send_test_email")
    @patch("email_service.send_heat_alert_email")
    @patch("email_service.fetch_weather")
    def test_background_worker_does_not_call_alert_when_below_threshold(
        self, mock_fetch, mock_send_alert, mock_send_test
    ):
        """Confirm that when weather is below threshold, no alert email is dispatched."""
        mock_fetch.return_value = {
            "city": "Coimbatore",
            "country": "India",
            "temperature": 32.0,  # Below High threshold (≥36°C)
            "humidity": 65.0,
        }

        email_service.subscribers_manager.register_subscriber(
            email="resident@coimbatore.in",
            city="Coimbatore",
            threshold="High",
            enabled=True,
        )

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 1)
        self.assertFalse(results[0]["result"]["sent"])
        self.assertEqual(results[0]["result"]["status"], "below_threshold")

        mock_send_alert.assert_not_called()
        mock_send_test.assert_not_called()

    @patch("email_service.send_test_email")
    @patch("email_service.send_heat_alert_email")
    @patch("email_service.fetch_weather")
    def test_background_worker_does_not_call_alert_when_weather_missing(
        self, mock_fetch, mock_send_alert, mock_send_test
    ):
        """Confirm that when weather data fails or is missing, no alert is sent."""
        mock_fetch.return_value = None

        email_service.subscribers_manager.register_subscriber(
            email="resident@coimbatore.in",
            city="Coimbatore",
            threshold="High",
            enabled=True,
        )

        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 1)
        self.assertFalse(results[0]["result"]["sent"])
        self.assertEqual(results[0]["result"]["status"], "error")

        mock_send_alert.assert_not_called()
        mock_send_test.assert_not_called()

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_real_heat_alert_execution_path_chennai_example(self, mock_fetch, mock_smtp):
        """
        Verify the complete execution path for a real heat alert (e.g. Chennai 37.2°C).
        Traces fetch_weather -> threshold evaluation -> send_heat_alert_email -> send_email_smtp.
        Keeps this test strictly from sending real emails by mocking SMTP delivery.
        """
        mock_smtp.return_value = {"success": True, "message": "Dispatched successfully", "timestamp": "2026-10-11T14:00:00Z"}
        mock_fetch.return_value = {
            "city": "Chennai",
            "country": "India",
            "temperature": 37.2,
            "humidity": 58.0,
            "wind_speed": 4.5,
            "rainfall": 0.0,
            "weather_description": "Partly Cloudy",
        }

        result = email_service.evaluate_and_send_heat_alert(
            city="Chennai",
            email="resident@chennai.gov.in",
            threshold="High",
            force_send=True,
            check_type="manual",
        )

        # 1. Assert evaluation outcome
        self.assertTrue(result["triggered"])
        self.assertTrue(result["sent"])
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["temperature"], 37.2)
        self.assertEqual(result["risk_level"], "High")

        # 2. Verify actual alert email dispatch
        mock_smtp.assert_called_once()
        smtp_args = mock_smtp.call_args[1]

        # 3. Dynamic subject line
        self.assertEqual(smtp_args["subject"], "[HIGH HEAT ALERT] Chennai — 37.2°C")

        # 4. Content verification
        plain = smtp_args["plain_text"]
        html = smtp_args["html_content"]

        self.assertIn("Chennai", plain)
        self.assertIn("India", plain)
        self.assertIn("37.2°C", plain)
        self.assertIn("High", plain)
        self.assertIn("≥36°C", plain)
        self.assertIn("Observation Timestamp:", plain)
        self.assertIn("Why This Alert Was Triggered:", plain)
        self.assertIn("fluid intake", plain.lower())
        self.assertIn("cotton clothing", plain.lower())
        self.assertIn("http://localhost:5173", plain)

        # 5. Confirm no test verification artifacts leak into the real heat alert
        self.assertNotIn("[Test Verification]", smtp_args["subject"])
        self.assertNotIn("Test Email Delivery Verified", plain)
        self.assertNotIn("Test Email Delivery Verified", html)

    @patch("email_service.send_email_smtp")
    def test_send_heat_alert_email_direct_mocked_smtp(self, mock_smtp):
        """
        Directly test send_heat_alert_email with mocked SMTP delivery.
        Verifies subject, body, and structure of the dedicated real heat-alert email function.
        """
        mock_smtp.return_value = {"success": True, "message": "Mock Sent", "timestamp": "2026-10-11T14:00:00Z"}

        res = email_service.send_heat_alert_email(
            to_email="citizen@chennai.gov.in",
            city="Chennai",
            risk_level="High",
            risk_score=88.0,
            temperature=37.2,
            humidity=60.0,
            wind_speed=15.0,
            rainfall=0.0,
            weather_desc="Sunny and Humid",
            threshold="High",
            country="India",
            observed_time="2026-10-11 14:00:00 UTC",
        )

        self.assertTrue(res["success"])
        mock_smtp.assert_called_once()
        call_kwargs = mock_smtp.call_args[1]

        self.assertEqual(call_kwargs["subject"], "[HIGH HEAT ALERT] Chennai — 37.2°C")
        self.assertIn("Chennai", call_kwargs["plain_text"])
        self.assertIn("India", call_kwargs["plain_text"])
        self.assertIn("37.2°C", call_kwargs["plain_text"])
        self.assertIn("Why This Alert Was Triggered", call_kwargs["plain_text"])
        self.assertIn("2026-10-11 14:00:00 UTC", call_kwargs["plain_text"])

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_low_risk_alert_delivery(self, mock_fetch, mock_send):
        """Test Low risk alert delivery when temperature is < 30°C and threshold is Low."""
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-11T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Tokyo",
            "temperature": 22.4,
            "humidity": 55.0,
            "rainfall": 0.0,
            "wind_speed": 3.2,
            "weather_description": "Clear",
            "country": "Japan",
        }
        res = email_service.evaluate_and_send_heat_alert(
            city="Tokyo",
            email="resident@tokyo.jp",
            threshold="Low",
        )
        self.assertTrue(res["triggered"])
        self.assertTrue(res["sent"])
        self.assertEqual(res["risk_level"], "Low")
        mock_send.assert_called_once()
        smtp_args = mock_send.call_args[1]
        self.assertIn("[LOW HEAT ALERT] Tokyo — 22.4°C", smtp_args["subject"])
        self.assertIn("Low", smtp_args["plain_text"])
        self.assertIn("hydration", smtp_args["plain_text"].lower())

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_medium_risk_alert_delivery(self, mock_fetch, mock_send):
        """Test Medium risk alert delivery when temperature is 33°C and threshold is Medium."""
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-11T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Bhiwapur",
            "temperature": 33.3,
            "humidity": 50.0,
            "rainfall": 0.0,
            "wind_speed": 2.5,
            "weather_description": "Sunny",
            "country": "India",
        }
        res = email_service.evaluate_and_send_heat_alert(
            city="Bhiwapur",
            email="resident@bhiwapur.in",
            threshold="Medium",
        )
        self.assertTrue(res["triggered"])
        self.assertTrue(res["sent"])
        self.assertEqual(res["risk_level"], "Medium")
        mock_send.assert_called_once()
        smtp_args = mock_send.call_args[1]
        self.assertIn("[MEDIUM HEAT ALERT] Bhiwapur — 33.3°C", smtp_args["subject"])
        self.assertIn("Medium", smtp_args["plain_text"])
        self.assertIn("shaded", smtp_args["plain_text"].lower())

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_all_four_risk_threshold_cutoffs(self, mock_fetch, mock_send):
        """Test threshold cutoffs: Low triggers on all, Medium rejects Low, High rejects Medium & Low, Critical rejects High, Medium, Low."""
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-11T12:00:00Z"}

        # 1. Low temp (25°C): triggers on Low, rejected by Medium, High, Critical
        mock_fetch.return_value = {"city": "CityX", "temperature": 25.0, "humidity": 50.0, "rainfall": 0.0, "wind_speed": 2.0}
        r_low = email_service.evaluate_and_send_heat_alert(city="CityX", email="u@x.org", threshold="Low")
        self.assertTrue(r_low["triggered"])
        self.assertTrue(r_low["sent"])

        r_med = email_service.evaluate_and_send_heat_alert(city="CityX", email="u2@x.org", threshold="Medium")
        self.assertFalse(r_med["sent"])
        self.assertEqual(r_med["status"], "below_threshold")

        r_high = email_service.evaluate_and_send_heat_alert(city="CityX", email="u3@x.org", threshold="High")
        self.assertFalse(r_high["sent"])
        self.assertEqual(r_high["status"], "below_threshold")

        r_crit = email_service.evaluate_and_send_heat_alert(city="CityX", email="u4@x.org", threshold="Critical")
        self.assertFalse(r_crit["sent"])
        self.assertEqual(r_crit["status"], "below_threshold")

        # 2. Medium temp (33°C): triggers on Low & Medium, rejected by High & Critical
        mock_fetch.return_value = {"city": "CityY", "temperature": 33.0, "humidity": 50.0, "rainfall": 0.0, "wind_speed": 2.0}
        r2_med = email_service.evaluate_and_send_heat_alert(city="CityY", email="u5@x.org", threshold="Medium")
        self.assertTrue(r2_med["sent"])

        r2_high = email_service.evaluate_and_send_heat_alert(city="CityY", email="u6@x.org", threshold="High")
        self.assertFalse(r2_high["sent"])
        self.assertEqual(r2_high["status"], "below_threshold")

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_risk_level_change_escalation_and_deescalation(self, mock_fetch, mock_send):
        """Test risk level change triggers alert and bypasses duplicate cooldown (both escalation and de-escalation)."""
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-11T12:00:00Z"}

        # 1. Initial alert at Medium (33°C)
        mock_fetch.return_value = {"city": "Pune", "temperature": 33.0, "humidity": 50.0, "rainfall": 0.0, "wind_speed": 2.0}
        r1 = email_service.evaluate_and_send_heat_alert(city="Pune", email="user@pune.org", threshold="Low")
        self.assertTrue(r1["sent"])
        self.assertEqual(r1["risk_level"], "Medium")

        # 2. Immediate second check at same level (33°C) -> suppressed by duplicate cooldown
        r2 = email_service.evaluate_and_send_heat_alert(city="Pune", email="user@pune.org", threshold="Low")
        self.assertFalse(r2["sent"])
        self.assertEqual(r2["status"], "cooldown_suppressed")

        # 3. Weather escalates to High (37°C) within cooldown -> bypasses cooldown!
        mock_fetch.return_value = {"city": "Pune", "temperature": 37.0, "humidity": 45.0, "rainfall": 0.0, "wind_speed": 3.0}
        r3 = email_service.evaluate_and_send_heat_alert(city="Pune", email="user@pune.org", threshold="Low")
        self.assertTrue(r3["sent"])
        self.assertEqual(r3["risk_level"], "High")
        self.assertTrue(r3.get("escalated"))
        self.assertTrue(r3.get("level_change"))

        # 4. Immediate second check at same level (37°C) -> suppressed by duplicate cooldown
        r4 = email_service.evaluate_and_send_heat_alert(city="Pune", email="user@pune.org", threshold="Low")
        self.assertFalse(r4["sent"])
        self.assertEqual(r4["status"], "cooldown_suppressed")

        # 5. Weather drops to Medium (32°C) within cooldown -> level changed (de-escalation) bypasses cooldown!
        mock_fetch.return_value = {"city": "Pune", "temperature": 32.0, "humidity": 50.0, "rainfall": 0.0, "wind_speed": 2.0}
        r5 = email_service.evaluate_and_send_heat_alert(city="Pune", email="user@pune.org", threshold="Low")
        self.assertTrue(r5["sent"])
        self.assertEqual(r5["risk_level"], "Medium")
        self.assertTrue(r5.get("deescalated"))
        self.assertTrue(r5.get("level_change"))

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_failed_smtp_does_not_update_last_alert_time_for_any_level(self, mock_fetch, mock_send):
        """Test that failed SMTP transmission does not record an alert timestamp."""
        mock_send.return_value = {"success": False, "error": "SMTP server disconnected"}
        mock_fetch.return_value = {"city": "Jaipur", "temperature": 34.0, "humidity": 40.0, "rainfall": 0.0, "wind_speed": 2.0}

        res = email_service.evaluate_and_send_heat_alert(city="Jaipur", email="user@jaipur.org", threshold="Medium")
        self.assertFalse(res["sent"])
        self.assertEqual(res["status"], "error")

        state = email_service.state_manager.load()
        self.assertIsNone(state.get("last_alert_time"))
        sub_hist = email_service.state_manager.get_subscriber_history("user@jaipur.org")
        self.assertTrue(sub_hist is None or sub_hist.get("last_alert_time") is None)

    # ── 15. DEDICATED FOUR RISK LEVELS EMAIL CONTENT & SUBJECT TESTS ──
    def test_all_four_heat_risk_levels_email_generation_and_delivery(self):
        """Verify dynamic subjects, colors, badges, and recommendations for Low, Medium, High, and Critical."""
        test_cases = [
            {
                "level": "Low",
                "city": "Reykjavik",
                "country": "Iceland",
                "temp": 18.5,
                "score": 15.0,
                "thresh": "Low",
                "expected_subject": "[LOW HEAT ALERT] Reykjavik — 18.5°C",
                "expected_badge": "LOW HEAT RISK",
                "expected_recom": "Comfortable ambient conditions",
            },
            {
                "level": "Medium",
                "city": "Madrid",
                "country": "Spain",
                "temp": 32.4,
                "score": 62.0,
                "thresh": "Medium",
                "expected_subject": "[MEDIUM HEAT ALERT] Madrid — 32.4°C",
                "expected_badge": "MEDIUM HEAT RISK",
                "expected_recom": "pace strenuous outdoor",
            },
            {
                "level": "High",
                "city": "Pune",
                "country": "India",
                "temp": 37.8,
                "score": 82.5,
                "thresh": "High",
                "expected_subject": "[HIGH HEAT ALERT] Pune — 37.8°C",
                "expected_badge": "HIGH HEAT RISK",
                "expected_recom": "Limit prolonged outdoor physical exertion",
            },
            {
                "level": "Critical",
                "city": "Riyadh",
                "country": "Saudi Arabia",
                "temp": 44.2,
                "score": 96.0,
                "thresh": "Critical",
                "expected_subject": "[CRITICAL HEAT ALERT] Riyadh — 44.2°C",
                "expected_badge": "CRITICAL HEAT RISK",
                "expected_recom": "DANGEROUS CRITICAL HEAT",
            },
        ]

        for tc in test_cases:
            subj, plain, html = email_service.build_heat_alert_email(
                to_email="alert.recipient@test.org",
                city=tc["city"],
                risk_level=tc["level"],
                risk_score=tc["score"],
                temperature=tc["temp"],
                humidity=42.0,
                wind_speed=14.5,
                rainfall=0.0,
                weather_desc="Clear Sky",
                threshold=tc["thresh"],
                country=tc["country"],
                observed_time="2026-10-11 14:00:00",
            )
            # Subject format verification
            self.assertEqual(subj, tc["expected_subject"])
            # Risk badge verification
            self.assertIn(tc["expected_badge"], html)
            # Location and country verification
            self.assertIn(tc["city"], plain)
            self.assertIn(tc["country"], plain)
            self.assertIn(f"{tc['temp']:.1f}°C", plain)
            # Severity score & threshold
            self.assertIn(f"{tc['score']:.1f}/100", plain)
            self.assertIn(tc["thresh"], plain)
            # Recommendations
            self.assertIn(tc["expected_recom"], plain)
            self.assertIn(tc["expected_recom"], html)
            # Observation timestamp
            self.assertIn("2026-10-11 14:00:00", plain)
            self.assertIn("2026-10-11 14:00:00", html)

    # ── 16. WORLDWIDE MULTI-CITY SUBSCRIBER INDEPENDENCE TESTS ──
    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_multi_city_multi_subscriber_worldwide_independence(self, mock_fetch, mock_send):
        """Test multiple subscribers across global cities: Tokyo, Cairo, London, Sydney, Pune."""
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-11T12:00:00Z"}

        # Define 5 worldwide subscribers
        email_service.subscribers_manager.register_subscriber(
            email="tokyo.user@japan.org",
            city="Tokyo",
            lat=35.6762,
            lon=139.6503,
            threshold="Low",
            enabled=True
        )
        email_service.subscribers_manager.register_subscriber(
            email="cairo.user@egypt.org",
            city="Cairo",
            lat=30.0444,
            lon=31.2357,
            threshold="Critical",
            enabled=True
        )
        email_service.subscribers_manager.register_subscriber(
            email="london.user@uk.org",
            city="London",
            lat=51.5074,
            lon=-0.1278,
            threshold="Medium",
            enabled=True
        )
        email_service.subscribers_manager.register_subscriber(
            email="sydney.user@aus.org",
            city="Sydney",
            lat=-33.8688,
            lon=151.2093,
            threshold="High",
            enabled=True
        )
        email_service.subscribers_manager.register_subscriber(
            email="pune.user@india.org",
            city="Pune",
            lat=18.5204,
            lon=73.8567,
            threshold="High",
            enabled=True
        )

        weather_db = {
            "Tokyo": {"city": "Tokyo", "country": "Japan", "temperature": 27.5, "humidity": 55.0, "rainfall": 0.0, "wind_speed": 3.0, "weather_description": "Scattered clouds"},
            "Cairo": {"city": "Cairo", "country": "Egypt", "temperature": 41.5, "humidity": 20.0, "rainfall": 0.0, "wind_speed": 4.5, "weather_description": "Clear sun"},
            "London": {"city": "London", "country": "United Kingdom", "temperature": 22.0, "humidity": 60.0, "rainfall": 0.0, "wind_speed": 2.5, "weather_description": "Overcast"},
            "Sydney": {"city": "Sydney", "country": "Australia", "temperature": 37.0, "humidity": 40.0, "rainfall": 0.0, "wind_speed": 5.0, "weather_description": "Hot breeze"},
            "Pune": {"city": "Pune", "country": "India", "temperature": 38.0, "humidity": 45.0, "rainfall": 0.0, "wind_speed": 3.5, "weather_description": "Sunny"},
        }

        def mock_fetch_impl(city_query, lat=None, lon=None):
            for name, w in weather_db.items():
                if city_query and name.lower() in city_query.lower():
                    return w
            # Check by lat/lon
            if lat is not None and lon is not None:
                if abs(lat - 35.6762) < 0.1: return weather_db["Tokyo"]
                if abs(lat - 30.0444) < 0.1: return weather_db["Cairo"]
                if abs(lat - 51.5074) < 0.1: return weather_db["London"]
                if abs(lat - (-33.8688)) < 0.1: return weather_db["Sydney"]
                if abs(lat - 18.5204) < 0.1: return weather_db["Pune"]
            return weather_db.get(city_query, {"city": city_query or "Unknown", "temperature": 25.0, "humidity": 50.0, "rainfall": 0.0, "wind_speed": 2.0})

        mock_fetch.side_effect = mock_fetch_impl

        # Run background evaluation of all active subscribers
        results = email_service.evaluate_all_active_subscribers()
        self.assertEqual(len(results), 5)

        # Check outcomes:
        # 1. Tokyo: 27.5°C -> Low Risk, subscriber threshold is Low -> Alert Sent!
        tokyo_res = next(r for r in results if r["subscriber"] == "tokyo.user@japan.org")
        self.assertTrue(tokyo_res["result"]["sent"])
        self.assertEqual(tokyo_res["result"]["risk_level"], "Low")
        self.assertEqual(tokyo_res["result"]["city"], "Tokyo")

        # 2. Cairo: 41.5°C -> Critical Risk, subscriber threshold is Critical -> Alert Sent!
        cairo_res = next(r for r in results if r["subscriber"] == "cairo.user@egypt.org")
        self.assertTrue(cairo_res["result"]["sent"])
        self.assertEqual(cairo_res["result"]["risk_level"], "Critical")
        self.assertEqual(cairo_res["result"]["city"], "Cairo")

        # 3. London: 22.0°C -> Low Risk, subscriber threshold is Medium -> Below threshold, Not Sent!
        london_res = next(r for r in results if r["subscriber"] == "london.user@uk.org")
        self.assertFalse(london_res["result"]["sent"])
        self.assertEqual(london_res["result"]["status"], "below_threshold")
        self.assertEqual(london_res["result"]["city"], "London")

        # 4. Sydney: 37.0°C -> High Risk, subscriber threshold is High -> Alert Sent!
        sydney_res = next(r for r in results if r["subscriber"] == "sydney.user@aus.org")
        self.assertTrue(sydney_res["result"]["sent"])
        self.assertEqual(sydney_res["result"]["risk_level"], "High")
        self.assertEqual(sydney_res["result"]["city"], "Sydney")

        # 5. Pune: 38.0°C -> High Risk, subscriber threshold is High -> Alert Sent!
        pune_res = next(r for r in results if r["subscriber"] == "pune.user@india.org")
        self.assertTrue(pune_res["result"]["sent"])
        self.assertEqual(pune_res["result"]["risk_level"], "High")
        self.assertEqual(pune_res["result"]["city"], "Pune")

        # Total emails sent must be exactly 4 (Tokyo, Cairo, Sydney, Pune; London was below threshold)
        self.assertEqual(mock_send.call_count, 4)

        # Verify each subscriber's email content received their own specific city and temperature
        sent_calls = mock_send.call_args_list
        recipients = [c[1]["to_email"] for c in sent_calls]
        subjects = {c[1]["to_email"]: c[1]["subject"] for c in sent_calls}

        self.assertIn("tokyo.user@japan.org", recipients)
        self.assertIn("[LOW HEAT ALERT] Tokyo — 27.5°C", subjects["tokyo.user@japan.org"])

        self.assertIn("cairo.user@egypt.org", recipients)
        self.assertIn("[CRITICAL HEAT ALERT] Cairo — 41.5°C", subjects["cairo.user@egypt.org"])

        self.assertIn("sydney.user@aus.org", recipients)
        self.assertIn("[HIGH HEAT ALERT] Sydney — 37.0°C", subjects["sydney.user@aus.org"])

        self.assertIn("pune.user@india.org", recipients)
        self.assertIn("[HIGH HEAT ALERT] Pune — 38.0°C", subjects["pune.user@india.org"])

        # Verify state history isolation: each subscriber has their own distinct history
        tokyo_hist = email_service.state_manager.get_subscriber_history("tokyo.user@japan.org")
        self.assertEqual(tokyo_hist["last_alert_city"], "Tokyo")
        self.assertEqual(tokyo_hist["last_alert_level"], "Low")

        cairo_hist = email_service.state_manager.get_subscriber_history("cairo.user@egypt.org")
        self.assertEqual(cairo_hist["last_alert_city"], "Cairo")
        self.assertEqual(cairo_hist["last_alert_level"], "Critical")

        pune_hist = email_service.state_manager.get_subscriber_history("pune.user@india.org")
        self.assertEqual(pune_hist["last_alert_city"], "Pune")
        self.assertEqual(pune_hist["last_alert_level"], "High")

    # ── 17. PRESERVATION OF PUNE HIGH HEAT ALERT ──
    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_preserve_pune_high_heat_alert_format_and_flow(self, mock_fetch, mock_send):
        """Verify Pune High Heat Alert continues to work with exact format, safety bullets, and metadata."""
        mock_send.return_value = {"success": True, "message": "Delivered", "timestamp": "2026-10-11T12:00:00Z"}
        mock_fetch.return_value = {
            "city": "Pune",
            "country": "India",
            "temperature": 38.2,
            "humidity": 44.0,
            "rainfall": 0.0,
            "wind_speed": 3.2,
            "weather_description": "Clear Sky",
        }

        res = email_service.evaluate_and_send_heat_alert(
            city="Pune",
            email="pune.admin@imd.gov.in",
            threshold="High",
            force_send=True,
            check_type="manual",
        )

        self.assertTrue(res["sent"])
        self.assertEqual(res["risk_level"], "High")
        self.assertEqual(res["temperature"], 38.2)

        mock_send.assert_called_once()
        smtp_kwargs = mock_send.call_args[1]
        self.assertEqual(smtp_kwargs["subject"], "[HIGH HEAT ALERT] Pune — 38.2°C")
        self.assertEqual(smtp_kwargs["to_email"], "pune.admin@imd.gov.in")
        self.assertIn("Pune", smtp_kwargs["plain_text"])
        self.assertIn("India", smtp_kwargs["plain_text"])
        self.assertIn("38.2°C", smtp_kwargs["plain_text"])
        self.assertIn("High", smtp_kwargs["plain_text"])
        self.assertIn("Limit prolonged outdoor physical exertion", smtp_kwargs["plain_text"])
        self.assertIn("HIGH HEAT RISK", smtp_kwargs["html_content"])

    # ── 18. VERIFICATION OF FOUR RISK LEVELS & TEST EMAIL ISOLATION ──
    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_all_four_risk_levels_trigger_real_alert_emails(self, mock_fetch, mock_send):
        """
        Prove that all four risk levels (Low, Medium, High, Critical) trigger their respective
        real alert emails with correct risk-specific subjects, templates, and safety guidance.
        """
        mock_send.return_value = {"success": True, "message": "Dispatched", "timestamp": "2026-10-11T12:00:00Z"}

        levels_data = [
            {
                "level": "Low",
                "city": "Reykjavik",
                "country": "Iceland",
                "weather": {"city": "Reykjavik", "country": "Iceland", "temperature": 21.5, "humidity": 50.0, "rainfall": 0.0, "wind_speed": 3.0, "weather_description": "Clear"},
                "threshold": "Low",
                "email": "user.low@test.org",
                "expected_subject": "[LOW HEAT ALERT] Reykjavik — 21.5°C",
                "expected_badge": "LOW HEAT RISK",
                "expected_tip": "hydration",
            },
            {
                "level": "Medium",
                "city": "Bhiwapur",
                "country": "India",
                "weather": {"city": "Bhiwapur", "country": "India", "temperature": 33.5, "humidity": 45.0, "rainfall": 0.0, "wind_speed": 2.5, "weather_description": "Warm & Sunny"},
                "threshold": "Medium",
                "email": "user.med@test.org",
                "expected_subject": "[MEDIUM HEAT ALERT] Bhiwapur — 33.5°C",
                "expected_badge": "MEDIUM HEAT RISK",
                "expected_tip": "shaded",
            },
            {
                "level": "High",
                "city": "Pune",
                "country": "India",
                "weather": {"city": "Pune", "country": "India", "temperature": 37.5, "humidity": 42.0, "rainfall": 0.0, "wind_speed": 3.5, "weather_description": "Hot & Dry"},
                "threshold": "High",
                "email": "user.high@test.org",
                "expected_subject": "[HIGH HEAT ALERT] Pune — 37.5°C",
                "expected_badge": "HIGH HEAT RISK",
                "expected_tip": "Limit prolonged outdoor physical exertion",
            },
            {
                "level": "Critical",
                "city": "Dubai",
                "country": "United Arab Emirates",
                "weather": {"city": "Dubai", "country": "United Arab Emirates", "temperature": 43.5, "humidity": 30.0, "rainfall": 0.0, "wind_speed": 4.0, "weather_description": "Extreme Heat"},
                "threshold": "Critical",
                "email": "user.crit@test.org",
                "expected_subject": "[CRITICAL HEAT ALERT] Dubai — 43.5°C",
                "expected_badge": "CRITICAL HEAT RISK",
                "expected_tip": "DANGEROUS CRITICAL HEAT",
            },
        ]

        for item in levels_data:
            mock_send.reset_mock()
            mock_fetch.return_value = item["weather"]

            res = email_service.evaluate_and_send_heat_alert(
                city=item["city"],
                email=item["email"],
                threshold=item["threshold"],
                force_send=True,
                check_type="manual",
            )

            self.assertTrue(res["triggered"], f"Alert failed to trigger for {item['level']}")
            self.assertTrue(res["sent"], f"Alert failed to send for {item['level']}")
            self.assertEqual(res["status"], "success")
            self.assertEqual(res["risk_level"], item["level"])
            self.assertEqual(res["city"], item["city"])

            mock_send.assert_called_once()
            call_kwargs = mock_send.call_args[1]
            self.assertEqual(call_kwargs["to_email"], item["email"])
            self.assertEqual(call_kwargs["subject"], item["expected_subject"])
            self.assertIn(item["city"], call_kwargs["plain_text"])
            self.assertIn(item["country"], call_kwargs["plain_text"])
            self.assertIn(f"{item['weather']['temperature']:.1f}°C", call_kwargs["plain_text"])
            self.assertIn(item["level"], call_kwargs["plain_text"])
            self.assertIn(item["expected_tip"].lower(), call_kwargs["plain_text"].lower())
            self.assertIn(item["expected_badge"], call_kwargs["html_content"])
            # Ensure test-verification string does NOT appear
            self.assertNotIn("[Test Verification]", call_kwargs["subject"])
            self.assertNotIn("Test Email Verification", call_kwargs["plain_text"])

    @patch("email_service.send_email_smtp")
    def test_test_email_never_counted_as_actual_heat_alert(self, mock_send):
        """
        Prove that test emails (via function or /api/alerts/test) send strictly verification emails
        and never update last_alert_time, last_alert_city, or subscriber alert history.
        """
        mock_send.return_value = {"success": True, "message": "Test sent", "timestamp": "2026-10-11T12:00:00Z"}

        # 1. State before test email
        state_before = email_service.state_manager.load()
        self.assertIsNone(state_before.get("last_alert_time"))
        self.assertIsNone(state_before.get("last_alert_city"))
        self.assertIsNone(state_before.get("last_alert_level"))

        # 2. Trigger test email function directly
        res_fn = email_service.send_test_email("verifier@domain.org")
        self.assertTrue(res_fn["success"])
        self.assertEqual(res_fn["subject"], "[Test Verification] Smart El Niño Heat Monitoring System Alert Service")
        self.assertIn("Test Email Verification", res_fn["plain_text"])

        # State must still have NO real alert recorded
        state_mid = email_service.state_manager.load()
        self.assertIsNone(state_mid.get("last_alert_time"))
        self.assertIsNone(state_mid.get("last_alert_city"))
        self.assertIsNone(state_mid.get("last_alert_level"))
        sub_hist = email_service.state_manager.get_subscriber_history("verifier@domain.org")
        self.assertTrue(sub_hist is None or sub_hist.get("last_alert_time") is None)

        # 3. Trigger test email via HTTP API endpoint
        mock_send.reset_mock()
        api_res = self.client.post("/api/alerts/test", json={"email": "verifier@domain.org"})
        self.assertEqual(api_res.status_code, 200)

        # State must record last_test_time, but last_alert_time must remain None
        state_after = email_service.state_manager.load()
        self.assertIsNotNone(state_after.get("last_test_time"))
        self.assertEqual(state_after.get("last_test_status"), "success")
        self.assertIsNone(state_after.get("last_alert_time"))
        self.assertIsNone(state_after.get("last_alert_city"))
        self.assertIsNone(state_after.get("last_alert_level"))

    @patch("email_service.send_email_smtp")
    @patch("email_service.fetch_weather")
    def test_subscriber_registered_threshold_preserved_when_not_passed_in_check(self, mock_fetch, mock_send):
        """
        Prove that when a subscriber is registered with Low or Medium threshold,
        passing threshold=None with city and coordinates correctly resolves their registered
        threshold rather than defaulting to High.
        """
        mock_send.return_value = {"success": True, "message": "Sent", "timestamp": "2026-10-11T12:00:00Z"}

        # Register a Low threshold subscriber
        email_service.subscribers_manager.register_subscriber(
            email="sub_low@test.org",
            city="Reykjavik",
            lat=64.14,
            lon=-21.94,
            threshold="Low",
            enabled=True,
        )

        mock_fetch.return_value = {
            "city": "Reykjavik",
            "country": "Iceland",
            "temperature": 22.0,
            "humidity": 50.0,
            "rainfall": 0.0,
            "wind_speed": 3.0,
            "weather_description": "Clear",
        }

        # Evaluate with threshold=None and city/lat/lon provided
        res = email_service.evaluate_and_send_heat_alert(
            city="Reykjavik",
            lat=64.14,
            lon=-21.94,
            email="sub_low@test.org",
            threshold=None,
        )

        self.assertTrue(res["triggered"])
        self.assertTrue(res["sent"])
        self.assertEqual(res["risk_level"], "Low")
        mock_send.assert_called_once()
        self.assertEqual(mock_send.call_args[1]["subject"], "[LOW HEAT ALERT] Reykjavik — 22.0°C")

    def test_distinguish_evaluated_risk_from_threshold_policy(self):
        """
        Prove that the explanation clearly distinguishes evaluated risk from configured policy,
        and does not label a Low threshold setting as the actual risk level.
        """
        # Scenario: Medium risk weather in Madrid (32.4°C), with Low threshold policy
        subj, plain, html = email_service.build_heat_alert_email(
            to_email="user@test.org",
            city="Madrid",
            risk_level="Medium",
            risk_score=62.0,
            temperature=32.4,
            threshold="Low",
        )

        # 1. Actual risk level is prominent in subject and heading
        self.assertEqual(subj, "[MEDIUM HEAT ALERT] Madrid — 32.4°C")
        self.assertIn("MEDIUM HEAT RISK", html)
        self.assertIn("Evaluated Risk: <strong>Medium</strong>", html)

        # 2. Clearly distinguishes evaluated risk from user's configured policy
        self.assertIn("Evaluated risk: Medium. Your Low threshold setting allows alerts for all risk levels.", plain)
        self.assertIn("Evaluated risk: Medium. Your Low threshold setting allows alerts for all risk levels.", html)

        # 3. Does NOT label the Low threshold as the actual risk level
        self.assertNotIn("Evaluated Heat Risk: Low", plain)
        self.assertNotIn("Evaluated Heat Risk Level: Low", plain)
        self.assertNotIn("LOW HEAT RISK", html)


if __name__ == "__main__":
    unittest.main()
