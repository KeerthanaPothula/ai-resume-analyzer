"""
SMTP email service — uses Python stdlib only (smtplib + email.mime).
Supports Gmail (port 587 STARTTLS or 465 SSL) and any compatible SMTP provider.
"""

import asyncio
import smtplib
import ssl
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Windows: inject the OS certificate store so ssl can verify Google's cert.
# Harmless on Linux/macOS where truststore is not installed.
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

from app.core.config import settings

# ── HTML template ──────────────────────────────────────────────────────────────

_RESET_EMAIL_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Resume AI password</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#0f172a;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="560" cellpadding="0" cellspacing="0" border="0"
               style="background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">

          <!-- ── Header ── -->
          <tr>
            <td align="center" style="padding:36px 40px 28px;border-bottom:1px solid #334155;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#0ea5e9 0%,#7c3aed 100%);
                              border-radius:14px;padding:12px;line-height:0;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                         stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                         xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                    </svg>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;color:#f1f5f9;font-size:20px;font-weight:700;letter-spacing:-0.01em;">
                Resume AI
              </h1>
              <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
                AI Resume Intelligence Platform
              </p>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 12px;color:#f1f5f9;font-size:22px;font-weight:700;">
                Reset your password
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
                We received a request to reset the password for your account
                (<span style="color:#e2e8f0;">{{to_email}}</span>).
                Click the button below to choose a new password.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#0ea5e9 0%,#7c3aed 100%);">
                    <a href="{{reset_url}}"
                       style="display:inline-block;padding:15px 36px;color:#ffffff;
                              text-decoration:none;font-size:15px;font-weight:600;
                              letter-spacing:0.01em;border-radius:10px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;
                          padding:12px 16px;margin:0 0 32px;word-break:break-all;">
                <a href="{{reset_url}}"
                   style="color:#38bdf8;font-size:12px;text-decoration:none;font-family:monospace;">
                  {{reset_url}}
                </a>
              </div>

              <!-- Expiry warning -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background:#431407;border:1px solid #7c2d12;border-radius:10px;
                              padding:14px 18px;">
                    <p style="margin:0;color:#fdba74;font-size:13px;line-height:1.6;">
                      &#9888;&nbsp; This link expires in
                      <strong>{{expire_minutes}} minutes</strong>.
                      If you didn't request a password reset, you can safely ignore this email —
                      your password will remain unchanged.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                &copy; 2026 Resume AI &nbsp;&middot;&nbsp;
                This email was sent because a password reset was requested for
                <span style="color:#64748b;">{{to_email}}</span>.<br/>
                <a href="{{frontend_url}}" style="color:#38bdf8;text-decoration:none;">
                  Visit Resume AI
                </a>
                &nbsp;&middot;&nbsp;
                If you have questions, reply to this email.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_html(to_email: str, reset_url: str, expire_minutes: int) -> str:
    return (
        _RESET_EMAIL_HTML
        .replace("{{to_email}}", to_email)
        .replace("{{reset_url}}", reset_url)
        .replace("{{expire_minutes}}", str(expire_minutes))
        .replace("{{frontend_url}}", settings.FRONTEND_URL)
    )


def _mask(value: str | None, show: int = 3) -> str:
    """Return first `show` chars + asterisks — safe for logging."""
    if not value:
        return "(not set)"
    return value[:show] + "*" * max(0, len(value) - show)


def _send_sync(to_email: str, reset_url: str, expire_minutes: int) -> None:
    """
    Blocking SMTP send — wrapped in asyncio.to_thread by the async caller.
    Prints step-by-step progress so failures are easy to diagnose in uvicorn logs.
    """
    host = settings.SMTP_HOST or ""
    port = settings.SMTP_PORT
    user = settings.SMTP_USER or ""
    password = settings.SMTP_PASSWORD or ""
    from_email = settings.EMAILS_FROM_EMAIL or user
    from_display = f"{settings.EMAILS_FROM_NAME} <{from_email}>"

    print(f"\n[SMTP] -- Starting email send ------------------------------")
    print(f"[SMTP]  to:       {to_email}")
    print(f"[SMTP]  from:     {from_display}")
    print(f"[SMTP]  host:     {host}:{port}")
    print(f"[SMTP]  user:     {_mask(user)}")
    print(f"[SMTP]  password: {_mask(password)}")

    # Build message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your Resume AI password"
    msg["From"] = from_display
    msg["To"] = to_email

    html_body = _build_html(to_email, reset_url, expire_minutes)
    text_body = (
        f"Reset your Resume AI password\n\n"
        f"Open this link to choose a new password (expires in {expire_minutes} minutes):\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, ignore this email.\n"
    )
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    context = ssl.create_default_context()

    try:
        if port == 465:
            print(f"[SMTP]  method: SSL (port 465)")
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                print(f"[SMTP]  connected")
                server.login(user, password)
                print(f"[SMTP]  authenticated")
                server.sendmail(from_email, [to_email], msg.as_string())
                print(f"[SMTP]  sent OK")
        else:
            print(f"[SMTP]  method: STARTTLS (port {port})")
            with smtplib.SMTP(host, port, timeout=15) as server:
                print(f"[SMTP]  connected")
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                print(f"[SMTP]  TLS established")
                server.login(user, password)
                print(f"[SMTP]  authenticated")
                server.sendmail(from_email, [to_email], msg.as_string())
                print(f"[SMTP]  sent OK")

        print(f"[SMTP] -- Email delivered successfully ----------------------\n")

    except smtplib.SMTPAuthenticationError as exc:
        print(f"[SMTP] AUTH FAILED: {exc}")
        print(f"[SMTP]   For Gmail: use an App Password (not your account password).")
        print(f"[SMTP]   Enable 2-Step Verification, then visit:")
        print(f"[SMTP]   https://myaccount.google.com/apppasswords")
        raise

    except smtplib.SMTPConnectError as exc:
        print(f"[SMTP] CONNECTION FAILED: {exc}")
        print(f"[SMTP]   Check SMTP_HOST ({host}) and SMTP_PORT ({port}).")
        print(f"[SMTP]   Firewall / ISP may be blocking port {port}.")
        raise

    except smtplib.SMTPRecipientsRefused as exc:
        print(f"[SMTP] RECIPIENT REFUSED: {exc}")
        raise

    except smtplib.SMTPSenderRefused as exc:
        print(f"[SMTP] SENDER REFUSED: {exc}")
        print(f"[SMTP]   For Gmail, EMAILS_FROM_EMAIL must match SMTP_USER.")
        raise

    except smtplib.SMTPException as exc:
        print(f"[SMTP] SMTP ERROR ({type(exc).__name__}): {exc}")
        print(traceback.format_exc())
        raise

    except OSError as exc:
        print(f"[SMTP] NETWORK ERROR: {exc}")
        print(f"[SMTP]   Cannot reach {host}:{port}. Check internet / DNS / firewall.")
        print(traceback.format_exc())
        raise

    except Exception as exc:
        print(f"[SMTP] UNEXPECTED ERROR ({type(exc).__name__}): {exc}")
        print(traceback.format_exc())
        raise


# ── Public API ────────────────────────────────────────────────────────────────

async def send_reset_email(to_email: str, reset_url: str, expire_minutes: int) -> None:
    """Send a password-reset email via the configured SMTP server (non-blocking)."""
    await asyncio.to_thread(_send_sync, to_email, reset_url, expire_minutes)


def smtp_connection_test() -> dict:
    """
    Synchronous SMTP connection test — returns a status dict.
    Used by the /debug/smtp endpoint and test_smtp.py script.
    """
    host = settings.SMTP_HOST or ""
    port = settings.SMTP_PORT
    user = settings.SMTP_USER or ""
    password = settings.SMTP_PASSWORD or ""

    result: dict = {
        "smtp_host": host or "(not configured)",
        "smtp_port": port,
        "smtp_user": _mask(user) if user else "(not configured)",
        "emails_from": settings.EMAILS_FROM_EMAIL or user or "(not configured)",
        "emails_from_name": settings.EMAILS_FROM_NAME,
        "configured": bool(host and user and password),
        "connection": None,
        "auth": None,
        "error": None,
    }

    if not result["configured"]:
        result["error"] = "SMTP_HOST / SMTP_USER / SMTP_PASSWORD not all set in .env"
        return result

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
                result["connection"] = "ok"
                server.login(user, password)
                result["auth"] = "ok"
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                result["connection"] = "ok"
                server.login(user, password)
                result["auth"] = "ok"
    except smtplib.SMTPAuthenticationError as exc:
        result["connection"] = "ok"
        result["auth"] = f"FAILED: {exc}"
        result["error"] = "Authentication failed — for Gmail use an App Password, not your account password"
    except smtplib.SMTPConnectError as exc:
        result["connection"] = f"FAILED: {exc}"
        result["error"] = f"Cannot connect to {host}:{port}"
    except OSError as exc:
        result["connection"] = f"FAILED: {exc}"
        result["error"] = f"Network error reaching {host}:{port}"
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"

    return result
