#!/usr/bin/env python3
"""
Standalone SMTP diagnostic script.

Run from the backend/ directory with your virtual environment active:
    python test_smtp.py
    python test_smtp.py --send-to you@example.com

What it checks:
  1. .env file loaded correctly
  2. All required SMTP vars present
  3. DNS resolution of SMTP host
  4. TCP connection to SMTP_HOST:SMTP_PORT
  5. TLS handshake
  6. SMTP authentication
  7. (Optional) Send a real test email
"""

import argparse
import smtplib
import socket
import ssl
import sys
from pathlib import Path

# Windows: inject OS cert store so ssl can verify Google/Outlook certs
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass


def load_env() -> dict:
    """Parse .env file from the same directory as this script."""
    env: dict = {}
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        print(f"  ✗ .env file not found at: {env_path}")
        return env
    print(f"  ✓ .env found at: {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def mask(value: str, show: int = 3) -> str:
    if not value:
        return "(empty)"
    return value[:show] + "*" * max(0, len(value) - show)


def header(title: str):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


def check_dns(host: str) -> bool:
    try:
        ip = socket.gethostbyname(host)
        print(f"  ✓ DNS resolved: {host} → {ip}")
        return True
    except socket.gaierror as e:
        print(f"  ✗ DNS failed for '{host}': {e}")
        return False


def check_tcp(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=10) as s:
            print(f"  ✓ TCP connected to {host}:{port}")
            return True
    except (OSError, socket.timeout) as e:
        print(f"  ✗ TCP connection to {host}:{port} failed: {e}")
        return False


def check_smtp(host: str, port: int, user: str, password: str) -> bool:
    context = ssl.create_default_context()
    try:
        if port == 465:
            print(f"  → Using SSL (port 465)...")
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                print(f"  ✓ SSL connected")
                server.login(user, password)
                print(f"  ✓ Authenticated as {mask(user)}")
                return True
        else:
            print(f"  → Using STARTTLS (port {port})...")
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                print(f"  ✓ STARTTLS established")
                server.login(user, password)
                print(f"  ✓ Authenticated as {mask(user)}")
                return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"  ✗ Authentication FAILED: {e}")
        print()
        print("  Common causes for Gmail:")
        print("   • You used your regular Google password instead of an App Password")
        print("   • 2-Step Verification is not enabled on your Google account")
        print("   • The App Password has been revoked")
        print()
        print("  How to create a Gmail App Password:")
        print("   1. Go to https://myaccount.google.com/security")
        print("   2. Enable 2-Step Verification (if not already enabled)")
        print("   3. Search for 'App passwords' in the search bar")
        print("   4. Select app: Mail | Select device: Other (custom name)")
        print("   5. Copy the 16-character code and paste it as SMTP_PASSWORD in .env")
        return False

    except smtplib.SMTPConnectError as e:
        print(f"  ✗ SMTP connect error: {e}")
        return False

    except smtplib.SMTPException as e:
        print(f"  ✗ SMTP error ({type(e).__name__}): {e}")
        return False

    except OSError as e:
        print(f"  ✗ Network error: {e}")
        return False


def send_test_email(host: str, port: int, user: str, password: str,
                    from_email: str, from_name: str, to_email: str) -> bool:
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    context = ssl.create_default_context()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[Resume AI] SMTP test email"
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    body = (
        "This is a test email from Resume AI.\n\n"
        "If you received this, your SMTP configuration is working correctly!\n\n"
        "You can now use the Forgot Password feature and emails will be delivered."
    )
    msg.attach(MIMEText(body, "plain"))

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                server.login(user, password)
                server.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(user, password)
                server.sendmail(from_email, [to_email], msg.as_string())
        print(f"  ✓ Test email sent to {to_email}")
        print(f"    Check your inbox (and spam folder) for '[Resume AI] SMTP test email'")
        return True
    except Exception as e:
        print(f"  ✗ Send failed: {type(e).__name__}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="SMTP diagnostic for Resume AI backend")
    parser.add_argument("--send-to", metavar="EMAIL",
                        help="Send a real test email to this address")
    args = parser.parse_args()

    print("\n" + "═" * 55)
    print("  Resume AI — SMTP Diagnostic")
    print("═" * 55)

    # ── Step 1: Load .env ───────────────────────────────────────
    header("Step 1 · Loading .env")
    env = load_env()

    smtp_host = env.get("SMTP_HOST", "")
    smtp_port = int(env.get("SMTP_PORT", "587"))
    smtp_user = env.get("SMTP_USER", "")
    smtp_password = env.get("SMTP_PASSWORD", "")
    from_email = env.get("EMAILS_FROM_EMAIL", smtp_user)
    from_name = env.get("EMAILS_FROM_NAME", "Resume AI")

    # ── Step 2: Verify config presence ─────────────────────────
    header("Step 2 · SMTP Configuration")
    all_present = True
    for var, val in [("SMTP_HOST", smtp_host), ("SMTP_PORT", str(smtp_port)),
                     ("SMTP_USER", smtp_user), ("SMTP_PASSWORD", smtp_password)]:
        if val:
            display = val if var in ("SMTP_HOST", "SMTP_PORT") else mask(val)
            print(f"  ✓ {var} = {display}")
        else:
            print(f"  ✗ {var} is MISSING — add it to .env")
            all_present = False

    print(f"  ✓ EMAILS_FROM_EMAIL = {from_email or smtp_user or '(will use SMTP_USER)'}")
    print(f"  ✓ EMAILS_FROM_NAME  = {from_name}")

    if not all_present:
        print("\n  ⚠ Fix the missing variables above, then re-run this script.")
        print("\n  Quick setup for Gmail:")
        print("    SMTP_HOST=smtp.gmail.com")
        print("    SMTP_PORT=587")
        print("    SMTP_USER=your.email@gmail.com")
        print("    SMTP_PASSWORD=xxxx xxxx xxxx xxxx   # 16-char App Password")
        print("    EMAILS_FROM_EMAIL=your.email@gmail.com")
        print("    EMAILS_FROM_NAME=Resume AI")
        sys.exit(1)

    # ── Step 3: DNS resolution ──────────────────────────────────
    header("Step 3 · DNS Resolution")
    if not check_dns(smtp_host):
        print("\n  ⚠ Cannot resolve hostname. Check SMTP_HOST spelling.")
        sys.exit(1)

    # ── Step 4: TCP connection ──────────────────────────────────
    header("Step 4 · TCP Connection")
    if not check_tcp(smtp_host, smtp_port):
        print("\n  ⚠ Cannot reach SMTP server. Possible causes:")
        print("    • Firewall blocking outbound port", smtp_port)
        print("    • ISP blocking SMTP (try port 465 if using 587, or vice versa)")
        print("    • Wrong SMTP_HOST")
        sys.exit(1)

    # ── Step 5: Full SMTP auth ──────────────────────────────────
    header("Step 5 · SMTP Authentication")
    if not check_smtp(smtp_host, smtp_port, smtp_user, smtp_password):
        sys.exit(1)

    # ── Step 6: Send test email ─────────────────────────────────
    if args.send_to:
        header(f"Step 6 · Sending Test Email → {args.send_to}")
        if not send_test_email(smtp_host, smtp_port, smtp_user, smtp_password,
                               from_email or smtp_user, from_name, args.send_to):
            sys.exit(1)

    print()
    print("═" * 55)
    print("  ✓ All checks passed! SMTP is correctly configured.")
    if not args.send_to:
        print("  Run with --send-to your@email.com to send a real test email.")
    print("═" * 55 + "\n")


if __name__ == "__main__":
    main()
