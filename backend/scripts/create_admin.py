"""Create the first admin user without embedding a password in source.

Usage (from backend/, venv active):
    python -m scripts.create_admin --employee-code ADM001 --full-name "Admin"
The password is read from the ADMIN_PASSWORD env var or prompted interactively.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from app.core.database import SessionLocal
from app.services import auth_service, seed


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the first admin user")
    parser.add_argument("--employee-code", required=True)
    parser.add_argument("--full-name", required=True)
    parser.add_argument(
        "--seed-ball-valve",
        action="store_true",
        help="Also create the BALL VALVE equipment master example",
    )
    args = parser.parse_args()

    password = os.environ.get("ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Admin password: ")
        if password != getpass.getpass("Confirm password: "):
            print("Passwords do not match", file=sys.stderr)
            return 1
    if len(password) < 6:
        print("Password must be at least 6 characters", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        user, created = auth_service.get_or_create_admin(
            db, args.employee_code, args.full_name, password
        )
        print(
            f"Admin {'created' if created else 'already existed'}: "
            f"{user.employee_code} ({user.role})"
        )
        if args.seed_ball_valve:
            template = seed.seed_ball_valve(db)
            print(f"Ball Valve template ready: {template.id}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
