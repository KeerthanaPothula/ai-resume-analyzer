#!/usr/bin/env python3
"""
Admin bootstrap utility.

Promotes an existing user account to the 'admin' role via a direct
database update.  Intended for first-time setup and disaster recovery —
there is no API endpoint that can do this, by design.

Usage (run from the backend/ directory):
    python scripts/make_admin.py user@example.com

Exit codes:
    0 — role updated successfully
    1 — bad arguments or user not found
    2 — user is already admin (no-op, not an error)
    3 — database error
"""

import os
import sys

# ── Path bootstrap ─────────────────────────────────────────────────────────
# Add backend/ to sys.path so that `app.*` imports resolve correctly when
# this script is invoked as `python scripts/make_admin.py` from backend/.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# ── Imports (after path bootstrap) ────────────────────────────────────────
import app.models  # noqa: F401 — registers all ORM mappers before SessionLocal is used
from app.db.database import SessionLocal
from app.models.user import User, UserRole

_VALID_ROLES = {r.value for r in UserRole}


def _promote(email_raw: str) -> int:
    email = email_raw.strip()
    if not email or "@" not in email or "." not in email.split("@", 1)[1]:
        print(f"[ERROR] '{email_raw}' is not a valid email address.", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        # Case-insensitive lookup — handles mixed-case addresses stored at
        # registration time.
        user: User | None = (
            db.query(User)
            .filter(User.email.ilike(email))
            .first()
        )

        if user is None:
            print(
                f"[ERROR] No account found for: {email}\n"
                "        Verify the address or check the database directly.",
                file=sys.stderr,
            )
            return 1

        if user.role == UserRole.admin:
            print(
                f"[INFO]  {user.email} is already 'admin' — no change made.\n"
                f"        (user_id={user.id}, name={user.full_name!r})"
            )
            return 2

        previous_role = user.role.value
        user.role = UserRole.admin
        db.commit()
        db.refresh(user)

        print(
            f"[OK]    Admin role granted successfully.\n"
            f"        user_id  : {user.id}\n"
            f"        email    : {user.email}\n"
            f"        name     : {user.full_name}\n"
            f"        role     : '{previous_role}' -> 'admin'"
        )
        print(
            "\n[NOTE]  The user must log out and log back in.\n"
            "        Their current JWT still carries the old role until it expires."
        )
        return 0

    except Exception as exc:
        db.rollback()
        print(f"[ERROR] Database error: {exc}", file=sys.stderr)
        return 3
    finally:
        db.close()


def _usage() -> None:
    print(
        "Usage:   python scripts/make_admin.py <email>\n"
        "Example: python scripts/make_admin.py alice@example.com\n"
        "\n"
        "Run from the backend/ directory so that backend/.env is loaded.\n"
        "\n"
        f"Valid roles in this system: {', '.join(sorted(_VALID_ROLES))}"
    )


def main() -> None:
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help"):
        _usage()
        sys.exit(0)

    if len(args) != 1:
        print("[ERROR] Expected exactly one argument: the user's email.", file=sys.stderr)
        _usage()
        sys.exit(1)

    sys.exit(_promote(args[0]))


if __name__ == "__main__":
    main()
