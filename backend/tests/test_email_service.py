"""
Unit tests for email service and subscription endpoints.
"""
import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from email_service import is_valid_email, send_heat_alert_subscription_email
from app import app


class TestEmailService(unittest.TestCase):

    def test_is_valid_email(self):
        self.assertTrue(is_valid_email("user@example.com"))
        self.assertTrue(is_valid_email("test.user+tag@domain.co.in"))
        self.assertFalse(is_valid_email(""))
        self.assertFalse(is_valid_email("invalid-email"))
        self.assertFalse(is_valid_email("user@domain"))
        self.assertFalse(is_valid_email(None))

    @patch.dict(os.environ, {"SMTP_EMAIL": "sender@gmail.com", "SMTP_PASSWORD": "apppassword1234", "SMTP_PORT": "587"})
    @patch("smtplib.SMTP")
    def test_send_heat_alert_subscription_email_success(self, mock_smtp_cls):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        success, msg = send_heat_alert_subscription_email("test@example.com", "Coimbatore")
        self.assertTrue(success)
        self.assertEqual(msg, "Email Alert Registered Successfully")
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("sender@gmail.com", "apppassword1234")
        mock_server.send_message.assert_called_once()

    @patch.dict(os.environ, {"SMTP_EMAIL": "", "SMTP_PASSWORD": ""})
    def test_send_email_missing_credentials(self):
        success, msg = send_heat_alert_subscription_email("test@example.com", "Coimbatore")
        self.assertFalse(success)
        self.assertIn("SMTP email credentials are not configured", msg)


class TestSubscribeEndpoint(unittest.TestCase):

    def setUp(self):
        self.client = app.test_client()

    def test_subscribe_missing_email(self):
        response = self.client.post("/subscribe", json={"city": "Chennai"})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    def test_subscribe_invalid_email(self):
        response = self.client.post("/subscribe", json={"email": "bademail", "city": "Chennai"})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    @patch("app.send_heat_alert_subscription_email")
    def test_subscribe_success(self, mock_send):
        mock_send.return_value = (True, "Email Alert Registered Successfully")
        response = self.client.post("/subscribe", json={"email": "user@example.com", "city": "Salem"})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("message"), "Email Alert Registered Successfully")

    @patch("app.send_heat_alert_subscription_email")
    def test_subscribe_failure(self, mock_send):
        mock_send.return_value = (False, "SMTP authentication failed")
        response = self.client.post("/subscribe", json={"email": "user@example.com", "city": "Salem"})
        self.assertEqual(response.status_code, 500)
        data = response.get_json()
        self.assertIn("error", data)


if __name__ == "__main__":
    unittest.main()
