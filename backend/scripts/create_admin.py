"""Create the first admin user without embedding a password in source.

Usage (from backend/, venv active):
    python -m scripts.create_admin --employee-code ADM001 --full-name "Admin"

Reset an existing user's password instead of creating one:
    python -m scripts.create_admin --employee-code ADM001 --reset-password

The password is read from the ADMIN_PASSWORD env var or prompted interactively.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from app.core.database import SessionLocal
from app.core.errors import AppError
from app.services import auth_service, seed


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the first admin user")
    parser.add_argument("--employee-code", required=True)
    parser.add_argument(
        "--full-name",
        help="Required when creating a user; optional with --reset-password",
    )
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="Reset the password of an existing user instead of creating one",
    )
    parser.add_argument(
        "--seed-ball-valve",
        action="store_true",
        help="Also create the BALL VALVE equipment master example",
    )
    args = parser.parse_args()

    if not args.reset_password and not args.full_name:
        parser.error("--full-name is required when creating a user")

    password = os.environ.get("ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Admin password: ")
        if password != getpass.getpass("Confirm password: "):
            print("Passwords do not match", file=sys.stderr)
            return 1
    if not password:
        print("ADMIN_PASSWORD is empty", file=sys.stderr)
        return 1
    if len(password) < 6:
        print("Password must be at least 6 characters", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        if args.reset_password:
            try:
                user = auth_service.reset_password(
                    db, args.employee_code, password, full_name=args.full_name
                )
            except AppError as exc:
                print(f"Error: {exc.message}", file=sys.stderr)
                return 1
            print(
                f"Password reset for {user.employee_code} "
                f"({user.role}); user id and role unchanged"
            )
        else:
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
