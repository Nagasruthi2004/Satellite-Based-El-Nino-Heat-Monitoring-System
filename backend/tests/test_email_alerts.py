"""
Unit tests for Email Heat Alert & Notification System
Tests email validation, configuration persistence, threshold logic,
and test-alert delivery without sending real emails.
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from email_alerts import (
    is_valid_email,
    is_alert_triggered,
    normalize_risk_level,
    get_safety_recommendation,
    build_email_content,
    is_smtp_configured,
    get_smtp_config,
    save_alert_config,
    load_alert_config,
    get_alert_config_status,
)


class TestEmailAlertsModule(unittest.TestCase):
    """Test suite for Email Heat Alert functions and API endpoints."""

    def setUp(self):
        self.client = app.test_client()

    # 1. Valid email validation
    def test_valid_email_validation(self):
        valid_emails = [
            "researcher@university.edu",
            "citizen.alert@domain.co.in",
            "heat-monitor+test@agency.org",
            "climate_user123@sub.domain.com",
            "user@gmail.com",
        ]
        for email in valid_emails:
            self.assertTrue(is_valid_email(email), f"Expected '{email}' to be valid.")

    # 2. Invalid email handling
    def test_invalid_email_handling(self):
        invalid_emails = [
            "",
            "   ",
            None,
            12345,
            "plainaddress",
            "@missinguser.com",
            "user@.com",
            "user@domain",
            "user space@domain.com",
        ]
        for email in invalid_emails:
            self.assertFalse(is_valid_email(email), f"Expected '{email}' to be invalid.")

        # Test POST /email-alert/test with invalid email
        res_test = self.client.post(
            "/email-alert/test",
            json={"email": "not-an-email", "location": "Tamil Nadu"},
        )
        self.assertEqual(res_test.status_code, 400)
        data_test = res_test.get_json()
        self.assertFalse(data_test.get("success"))
        self.assertIn("valid email", data_test.get("error", "").lower())

        # Test POST /email-alert/config with missing email
        res_cfg = self.client.post(
            "/email-alert/config",
            json={"email": "", "location": "Tamil Nadu", "threshold": "High"},
        )
        self.assertEqual(res_cfg.status_code, 400)
        data_cfg = res_cfg.get_json()
        self.assertFalse(data_cfg.get("success"))

    # 3. Configuration endpoint (save & get)
    def test_configuration_endpoint(self):
        # Save valid configuration
        payload = {
            "email": "analyst@heat-monitor.org",
            "location": "Tamil Nadu",
            "threshold": "High",
            "frequency": "Instant",
            "enabled": True,
        }
        res_post = self.client.post("/email-alert/config", json=payload)
        self.assertEqual(res_post.status_code, 200)
        post_data = res_post.get_json()
        self.assertTrue(post_data.get("success"))
        self.assertEqual(post_data["config"]["email"], "analyst@heat-monitor.org")
        self.assertEqual(post_data["config"]["threshold"], "High")
        self.assertEqual(post_data["config"]["location"], "Tamil Nadu")

        # Retrieve configuration via GET
        res_get = self.client.get("/email-alert/config")
        self.assertEqual(res_get.status_code, 200)
        get_data = res_get.get_json()
        self.assertTrue(get_data.get("success"))
        self.assertIn("config", get_data)
        self.assertEqual(get_data["config"]["email"], "analyst@heat-monitor.org")
        self.assertEqual(get_data["config"]["threshold"], "High")
        self.assertIn("available_locations", get_data["config"])
        self.assertIn("available_thresholds", get_data["config"])
        self.assertIn("current_risk", get_data["config"])

    # 4. Test-alert endpoint without SMTP configuration
    @patch.dict(os.environ, {"SMTP_USERNAME": "", "SMTP_PASSWORD": "", "SMTP_EMAIL": ""}, clear=True)
    def test_test_alert_endpoint_without_smtp_configuration(self):
        res = self.client.post(
            "/email-alert/test",
            json={"email": "alert-test@example.com", "location": "Tamil Nadu"},
        )
        # Should cleanly return 503 / failure and NOT crash
        self.assertIn(res.status_code, [400, 503])
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("Email service is not configured", data.get("error", ""))

    # 5. Threshold validation
    def test_threshold_validation(self):
        valid_thresholds = ["Medium", "High", "Critical"]
        for thresh in valid_thresholds:
            res = self.client.post(
                "/email-alert/config",
                json={
                    "email": "test@example.com",
                    "location": "Tamil Nadu",
                    "threshold": thresh,
                },
            )
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data["config"]["threshold"], thresh)

        # Invalid thresholds
        invalid_thresholds = ["Extreme", "SuperCritical", "Invalid", "123"]
        for bad_thresh in invalid_thresholds:
            res = self.client.post(
                "/email-alert/config",
                json={
                    "email": "test@example.com",
                    "location": "Tamil Nadu",
                    "threshold": bad_thresh,
                },
            )
            self.assertEqual(res.status_code, 400)
            data = res.get_json()
            self.assertFalse(data.get("success"))
            self.assertIn("Invalid threshold", data.get("error", ""))

    # 6. No secrets returned in API responses
    def test_no_secrets_returned_in_api_responses(self):
        sensitive_terms = [
            "password",
            "smtp_password",
            "secret",
            "api_key",
            "app_password",
            "token",
        ]

        # Check GET /email-alert/config
        get_res = self.client.get("/email-alert/config")
        get_text = get_res.get_data(as_text=True).lower()
        for term in sensitive_terms:
            self.assertNotIn(f'"{term}"', get_text)

        # Check POST /email-alert/config
        post_res = self.client.post(
            "/email-alert/config",
            json={
                "email": "safe@example.com",
                "location": "Tamil Nadu",
                "threshold": "Medium",
            },
        )
        post_text = post_res.get_data(as_text=True).lower()
        for term in sensitive_terms:
            self.assertNotIn(f'"{term}"', post_text)

    # 7. Alert threshold trigger logic (Low < Medium < High < Critical)
    def test_alert_threshold_trigger_logic(self):
        # Critical meets all thresholds
        self.assertTrue(is_alert_triggered("Critical", "Critical"))
        self.assertTrue(is_alert_triggered("Critical", "High"))
        self.assertTrue(is_alert_triggered("Critical", "Medium"))

        # High meets High & Medium, but not Critical
        self.assertFalse(is_alert_triggered("High", "Critical"))
        self.assertTrue(is_alert_triggered("High", "High"))
        self.assertTrue(is_alert_triggered("High", "Medium"))

        # Medium meets Medium, but not High or Critical
        self.assertFalse(is_alert_triggered("Medium", "Critical"))
        self.assertFalse(is_alert_triggered("Medium", "High"))
        self.assertTrue(is_alert_triggered("Medium", "Medium"))

        # Moderate is normalized to Medium
        self.assertTrue(is_alert_triggered("Moderate", "Medium"))
        self.assertFalse(is_alert_triggered("Moderate", "High"))

        # Low does not meet Medium, High, or Critical
        self.assertFalse(is_alert_triggered("Low", "Medium"))
        self.assertFalse(is_alert_triggered("Low", "High"))
        self.assertFalse(is_alert_triggered("Low", "Critical"))

    # 8. Email content assembly and professional formatting
    def test_email_content_structure(self):
        subject, text_body, html_body = build_email_content(
            location="Tamil Nadu",
            temperature_val=38.4,
            heat_risk_level="High",
            alert_threshold="Medium",
            is_test=False,
        )

        # Required Subject
        self.assertEqual(
            subject, "Heat Risk Alert – Satellite-Based El Niño Heat Monitoring System"
        )

        # Required body components
        for body in (text_body, html_body):
            self.assertIn("Tamil Nadu", body)
            self.assertIn("38.4", body)
            self.assertIn("High", body)
            self.assertIn("Medium", body)
            self.assertIn("Satellite-Based El Niño Heat Monitoring System", body)
            self.assertIn("automated awareness alert", body.lower())
            self.assertIn("emergency warning", body.lower())

    # 9. Test-alert sending with mocked SMTP (must not send real email)
    @patch.dict(os.environ, {
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "test_sender@example.com",
        "SMTP_PASSWORD": "mock_app_password_1234",
        "ALERT_FROM_EMAIL": "test_sender@example.com",
    })
    @patch("smtplib.SMTP")
    def test_mocked_test_alert_delivery(self, mock_smtp_cls):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        res = self.client.post(
            "/email-alert/test",
            json={"email": "operator@heat-monitor.org", "location": "Tamil Nadu", "threshold": "High"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("operator@heat-monitor.org", data.get("message", ""))
        self.assertEqual(data["alert_details"]["location"], "Tamil Nadu")

        # Confirm smtplib mock was called and real email was never dispatched to the internet
        mock_server.starttls.assert_called_once()
        mock_server.send_message.assert_called_once()


if __name__ == "__main__":
    unittest.main()
