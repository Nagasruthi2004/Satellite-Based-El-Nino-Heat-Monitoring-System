"""
Earth Engine Authentication & Initialization Utility
===================================================

Provides initialization, credential checking, and authentication helpers
for Google Earth Engine in the Satellite-Based El Niño Heat Monitoring System.
"""

import os
import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("EarthEngineAuth")


def get_default_credentials_path() -> Path:
    """Return the standard path where Earth Engine stores user credentials."""
    if os.name == "nt":  # Windows
        home = Path(os.environ.get("USERPROFILE", Path.home()))
    else:
        home = Path.home()
    return home / ".config" / "earthengine" / "credentials"


def check_credentials_status() -> dict:
    """
    Check if Google Earth Engine credentials exist locally or in environment.
    Returns status dictionary.
    """
    cred_file = get_default_credentials_path()
    has_user_creds = cred_file.exists() and cred_file.stat().st_size > 0

    service_account = os.getenv("GEE_SERVICE_ACCOUNT")
    private_key_file = os.getenv("GEE_PRIVATE_KEY_FILE")
    has_sa_creds = bool(
        service_account
        and private_key_file
        and Path(private_key_file).exists()
    )

    project_id = (
        os.getenv("GEE_PROJECT_ID")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
    )

    user_info = None
    if has_user_creds:
        try:
            with open(cred_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Do not expose tokens, just check structure
                user_info = {
                    "has_refresh_token": bool(data.get("refresh_token")),
                    "client_id_present": bool(data.get("client_id")),
                    "project": data.get("project", project_id),
                }
                if data.get("project") and not project_id:
                    project_id = data.get("project")
        except Exception:
            user_info = {"status": "unreadable_credentials_file"}

    is_authenticated = has_user_creds or has_sa_creds

    return {
        "authenticated": is_authenticated,
        "auth_type": "service_account" if has_sa_creds else ("user_oauth" if has_user_creds else "none"),
        "credentials_file": str(cred_file),
        "credentials_exist": has_user_creds,
        "project_id": project_id,
        "service_account": service_account if has_sa_creds else None,
        "details": user_info,
    }


def authenticate_earth_engine(auth_mode: str = "notebook") -> bool:
    """
    Trigger the interactive Earth Engine authentication process.
    Supported auth modes: 'notebook', 'localhost', 'gcloud'.
    """
    try:
        import ee
        logger.info("Starting Earth Engine authentication (mode=%s)...", auth_mode)
        ee.Authenticate(auth_mode=auth_mode)
        logger.info("Authentication completed successfully.")
        return True
    except Exception as e:
        logger.error("Authentication failed or cancelled: %s", e)
        return False


def initialize_earth_engine(project: str = None) -> tuple[bool, str]:
    """
    Safely initialize the Google Earth Engine library.
    
    Args:
        project: Optional Google Cloud Project ID. If None, reads from
                 environment (GEE_PROJECT_ID) or cached user credentials.
                 
    Returns:
        tuple (success: bool, message: str)
    """
    try:
        import ee
    except ImportError:
        return False, "earthengine-api is not installed. Run: pip install earthengine-api"

    status = check_credentials_status()
    resolved_project = project or status.get("project_id")

    try:
        if status.get("auth_type") == "service_account":
            sa_email = status["service_account"]
            key_file = os.getenv("GEE_PRIVATE_KEY_FILE")
            credentials = ee.ServiceAccountCredentials(sa_email, key_file)
            ee.Initialize(credentials, project=resolved_project)
            msg = f"Initialized successfully using Service Account ({sa_email})"
        elif resolved_project:
            ee.Initialize(project=resolved_project)
            msg = f"Initialized successfully with Google Cloud Project '{resolved_project}'"
        else:
            ee.Initialize()
            msg = "Initialized successfully with default user credentials"

        logger.info(msg)
        return True, msg
    except Exception as e:
        err_msg = str(e)
        logger.warning("Earth Engine initialization notice: %s", err_msg)
        return False, err_msg


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Earth Engine Authentication & Initialization Utility")
    parser.add_argument("--status", action="store_true", help="Check current authentication status")
    parser.add_argument("--auth", action="store_true", help="Launch interactive authentication")
    parser.add_argument("--auth-mode", default="notebook", choices=["notebook", "localhost", "gcloud"],
                        help="Authentication mode (default: notebook)")
    parser.add_argument("--test", action="store_true", help="Test initialization with Earth Engine")
    parser.add_argument("--project", default=None, help="Google Cloud project ID to test with")

    args = parser.parse_args()

    if args.auth:
        authenticate_earth_engine(auth_mode=args.auth_mode)
    elif args.test:
        success, msg = initialize_earth_engine(project=args.project)
        print("\nTest Result:")
        print(f"  Success: {success}")
        print(f"  Message: {msg}\n")
    else:
        # Default action: display status
        st = check_credentials_status()
        print("\nGoogle Earth Engine Authentication Status:")
        print(f"  Authenticated:     {st['authenticated']}")
        print(f"  Auth Type:         {st['auth_type']}")
        print(f"  Credentials File:  {st['credentials_file']}")
        print(f"  File Exists:       {st['credentials_exist']}")
        print(f"  Project ID:        {st['project_id'] or 'Not configured (set GEE_PROJECT_ID in backend/.env)'}")
        if st.get("details"):
            print(f"  Details:           {st['details']}")
        print()
