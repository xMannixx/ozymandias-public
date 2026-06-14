#!/usr/bin/env python
"""Ozymandias - JWT Token Generator for Local Login."""

import os
import sys

# Add backend directory to path so app modules can be imported
script_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(script_dir)
backend_path = os.path.join(repo_root, "backend")
sys.path.insert(0, backend_path)

try:
    import jwt
    from app.auth.jwt import create_access_token
    from app.config import get_settings
except ImportError as e:
    print(f"Error: Could not import required modules. {e}")
    print("Please install python dependencies first or run within the correct python environment.")
    sys.exit(1)


def main():
    settings = get_settings()
    print("Ozymandias Token Generator")
    print("==========================")
    
    secret_display = (
        f"{settings.jwt_secret[:4]}...{settings.jwt_secret[-4:]}"
        if len(settings.jwt_secret) > 8
        else "***"
    )
    print(f"JWT Secret loaded: {secret_display}")
    print(f"Token lifetime: {settings.jwt_expire_minutes} minutes")

    user_id = "dev-user"
    token = create_access_token(user_id)
    
    print("\nDein JWT Token für den Login:")
    print("--------------------------------------------------------------------------------")
    print(token)
    print("--------------------------------------------------------------------------------")
    print("Kopiere dieses Token und füge es in das 'JWT Token' Feld im Login-Bildschirm ein.")


if __name__ == "__main__":
    main()
