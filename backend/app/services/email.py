"""
Email service — supports two transports:
  1. Resend HTTP API (https://resend.com) — requires a verified sending domain.
     Set RESEND_API_KEY (+ optionally RESEND_FROM_EMAIL) in the Render dashboard.
  2. SMTP — works with Gmail App Passwords and any standard SMTP provider.
     Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD (+ optionally SMTP_PORT, SMTP_TLS).

Transport priority: Resend wins if RESEND_API_KEY is set; SMTP is the fallback.
When neither is configured, verify/reset URLs are logged to the console only (dev mode).
"""

import asyncio
import logging
import smtplib
import socket
import ssl
import traceback

try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── HTML templates ─────────────────────────────────────────────────────────────

_RESET_EMAIL_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your RecruitAI password</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#0f172a;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0"
               style="background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">

          <!-- Header -->
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
                RecruitAI
              </h1>
              <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
                AI Recruitment &amp; ATS Platform
              </p>
            </td>
          </tr>

          <!-- Body -->
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

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                &copy; 2026 RecruitAI &nbsp;&middot;&nbsp;
                This email was sent because a password reset was requested for
                <span style="color:#64748b;">{{to_email}}</span>.<br/>
                <a href="{{frontend_url}}" style="color:#38bdf8;text-decoration:none;">
                  Visit RecruitAI
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

_VERIFY_EMAIL_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your RecruitAI email</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#0f172a;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0"
               style="background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">

          <!-- Header -->
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
                RecruitAI
              </h1>
              <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
                AI Recruitment &amp; ATS Platform
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <!-- Welcome icon -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#0c4a6e;border:1px solid #075985;border-radius:50%;
                              width:60px;height:60px;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:60px;">&#9993;</span>
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 12px;color:#f1f5f9;font-size:22px;font-weight:700;">
                Welcome, {{full_name}}!
              </h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
                Thanks for signing up for RecruitAI. Click the button below to verify
                <span style="color:#e2e8f0;">{{to_email}}</span> and activate your account.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#0ea5e9 0%,#7c3aed 100%);">
                    <a href="{{verify_url}}"
                       style="display:inline-block;padding:15px 36px;color:#ffffff;
                              text-decoration:none;font-size:15px;font-weight:600;
                              letter-spacing:0.01em;border-radius:10px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;
                          padding:12px 16px;margin:0 0 32px;word-break:break-all;">
                <a href="{{verify_url}}"
                   style="color:#38bdf8;font-size:12px;text-decoration:none;font-family:monospace;">
                  {{verify_url}}
                </a>
              </div>

              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background:#431407;border:1px solid #7c2d12;border-radius:10px;
                              padding:14px 18px;">
                    <p style="margin:0;color:#fdba74;font-size:13px;line-height:1.6;">
                      &#9888;&nbsp; This link expires in <strong>24 hours</strong>.
                      If you didn't create a RecruitAI account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                &copy; 2026 RecruitAI &nbsp;&middot;&nbsp;
                This email was sent to
                <span style="color:#64748b;">{{to_email}}</span>
                because a new account was created with this address.<br/>
                <a href="{{frontend_url}}" style="color:#38bdf8;text-decoration:none;">
                  Visit RecruitAI
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


# ── Resend transport ──────────────────────────────────────────────────────────

def _resend_from() -> str:
    """Return the From address for Resend ('Name <email>')."""
    from_email = settings.RESEND_FROM_EMAIL or settings.EMAILS_FROM_EMAIL or "onboarding@resend.dev"
    from_name = settings.EMAILS_FROM_NAME or "RecruitAI"
    return f"{from_name} <{from_email}>"


def _dispatch_resend(to_email: str, subject: str, html: str, text: str) -> None:
    """Send email via the Resend HTTP API. Run in a thread via asyncio.to_thread."""
    import resend as _resend

    if not settings.RESEND_API_KEY:
        raise ValueError(
            "RESEND_API_KEY is not set — cannot send email. "
            "Set it in the Render dashboard under Environment Variables."
        )

    _resend.api_key = settings.RESEND_API_KEY
    from_addr = _resend_from()
    api_key_prefix = settings.RESEND_API_KEY[:8] + "***"

    # Warn when using the Resend sandbox sender — only delivers to the account owner's email
    from_email = settings.RESEND_FROM_EMAIL or settings.EMAILS_FROM_EMAIL or ""
    if not from_email or "onboarding@resend.dev" in from_addr:
        logger.warning(
            "Resend: using onboarding@resend.dev as sender — this only works for the Resend account "
            "owner's email in sandbox mode. Set RESEND_FROM_EMAIL to a verified domain address "
            "(e.g. noreply@yourdomain.com) in the Render dashboard."
        )

    logger.info(
        "Resend dispatch — to=%s  subject=%r  from=%s  api_key=%s",
        to_email, subject, from_addr, api_key_prefix,
    )
    try:
        result = _resend.Emails.send({
            "from": from_addr,
            "to": [to_email],
            "subject": subject,
            "html": html,
            "text": text,
        })
        email_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", "?")
        logger.info("Resend SUCCESS — id=%s  to=%s", email_id, to_email)
    except Exception as exc:
        logger.error(
            "Resend FAILED — to=%s  from=%s  api_key=%s  error=%s: %s\n%s",
            to_email, from_addr, api_key_prefix, type(exc).__name__, exc,
            traceback.format_exc(),
        )
        raise


# ── SMTP transport ─────────────────────────────────────────────────────────────

# Connection timeout for all SMTP attempts.
# Without this, a firewall DROP rule (no ICMP reply) causes an indefinite hang.
_SMTP_TIMEOUT = 30  # seconds

# socket._GLOBAL_DEFAULT_TIMEOUT is the sentinel meaning "inherit system default".
# We compare against it in _get_socket overrides to decide whether to call settimeout().
_SOCK_DEFAULT_TIMEOUT = socket._GLOBAL_DEFAULT_TIMEOUT


def _smtp_dns_log(host: str, port: int) -> tuple[list[str], list[str]]:
    """Resolve host, log every address+family, return (ipv4_list, ipv6_list)."""
    try:
        infos = socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        logger.error("SMTP DNS FAILED -- host=%s  error=%s", host, exc)
        raise

    ipv4: list[str] = []
    ipv6: list[str] = []
    for (family, _, _, _, sockaddr) in infos:
        if family == socket.AF_INET:
            ipv4.append(sockaddr[0])
        elif family == socket.AF_INET6:
            ipv6.append(sockaddr[0])

    logger.info(
        "SMTP DNS resolved -- host=%s:%s  IPv4=%s  IPv6=%s",
        host, port,
        ipv4 if ipv4 else "none",
        ipv6 if ipv6 else "none",
    )
    return ipv4, ipv6


class _IPv4SMTP(smtplib.SMTP):
    """Plain SMTP (for STARTTLS) that connects via IPv4 only.

    On Render and other cloud hosts, getaddrinfo returns IPv6 addresses first.
    When IPv6 has no route (errno 101 ENETUNREACH), Python retries with IPv4 —
    but some firewall setups also return ENETUNREACH for IPv4 on blocked SMTP
    ports.  By restricting to AF_INET we at least confirm which family is used
    and eliminate IPv6 as the variable.
    """

    def _get_socket(self, host: str, port: int, timeout):
        try:
            infos = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        except socket.gaierror:
            infos = []

        if not infos:
            # No IPv4 result — fall back to default resolution (may try IPv6)
            logger.warning("SMTP: no IPv4 address for %s, falling back to default resolution", host)
            return super()._get_socket(host, port, timeout)

        _, _, _, _, addr = infos[0]
        logger.info("SMTP CONNECT IPv4 -- target=%s:%s", addr[0], addr[1])
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if timeout is not _SOCK_DEFAULT_TIMEOUT:
            sock.settimeout(timeout)
        try:
            sock.connect(addr)
        except Exception:
            sock.close()
            raise
        return sock


class _IPv4SMTPSSL(smtplib.SMTP_SSL):
    """SMTP_SSL (port 465 implicit SSL) that connects via IPv4 only.

    Overrides _get_socket to:
    1. Resolve host to IPv4 explicitly (avoids ENETUNREACH on unrouted IPv6).
    2. Pass the *original hostname* (not the IP) as SNI server_hostname so
       that certificate verification against 'smtp.gmail.com' still passes.
       Without this, wrapping with server_hostname=IP would fail cert check.
    """

    def _get_socket(self, host: str, port: int, timeout):
        try:
            infos = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        except socket.gaierror:
            infos = []

        if not infos:
            logger.warning("SMTP SSL: no IPv4 address for %s, falling back to default resolution", host)
            return super()._get_socket(host, port, timeout)

        _, _, _, _, addr = infos[0]
        logger.info("SMTP SSL CONNECT IPv4 -- target=%s:%s  SNI=%s", addr[0], addr[1], self._host)
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if timeout is not _SOCK_DEFAULT_TIMEOUT:
            sock.settimeout(timeout)
        try:
            sock.connect(addr)
        except Exception:
            sock.close()
            raise
        # self._host = original hostname passed to SMTP_SSL(host, ...) — used for SNI.
        # If we passed the IP as server_hostname, cert verification would fail because
        # Gmail's cert is issued for smtp.gmail.com, not the IP.
        return self.context.wrap_socket(sock, server_hostname=self._host)


def _dispatch_smtp(to_email: str, subject: str, html: str, text: str) -> None:
    """Send email via SMTP (Gmail, Outlook, etc.). Run in a thread via asyncio.to_thread."""
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    from_email = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER or ""
    from_name = settings.EMAILS_FROM_NAME or "RecruitAI"
    from_addr = f"{from_name} <{from_email}>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    use_ssl = smtp_port == 465
    mode_label = "SSL (465)" if use_ssl else "STARTTLS (587)"

    # ── DNS diagnostic: resolve before connecting so we know what IPs were tried ─
    ipv4_addrs, ipv6_addrs = _smtp_dns_log(smtp_host, smtp_port)
    connect_ip = ipv4_addrs[0] if ipv4_addrs else (ipv6_addrs[0] if ipv6_addrs else smtp_host)

    logger.info(
        "SMTP %s dispatch -- to=%s  subject=%r  from=%s  host=%s:%s  "
        "connect_ip=%s  family=%s  timeout=%ss",
        mode_label, to_email, subject, from_addr,
        smtp_host, smtp_port,
        connect_ip,
        "IPv4" if ipv4_addrs else ("IPv6" if ipv6_addrs else "unknown"),
        _SMTP_TIMEOUT,
    )

    ssl_ctx = ssl.create_default_context()
    try:
        if use_ssl:
            # Port 465: implicit SSL from connection start.
            # _IPv4SMTPSSL resolves smtp_host to IPv4 inside _get_socket and
            # wraps with server_hostname=smtp_host (not IP) for SNI.
            with _IPv4SMTPSSL(smtp_host, smtp_port, context=ssl_ctx, timeout=_SMTP_TIMEOUT) as server:
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            # Port 587: plain connection upgraded via STARTTLS.
            with _IPv4SMTP(smtp_host, smtp_port, timeout=_SMTP_TIMEOUT) as server:
                server.ehlo()
                if settings.SMTP_TLS:
                    server.starttls(context=ssl_ctx)
                    server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        logger.info(
            "SMTP SUCCESS -- to=%s  mode=%s  connect_ip=%s",
            to_email, mode_label, connect_ip,
        )
    except Exception as exc:
        logger.error(
            "SMTP FAILED -- to=%s  host=%s:%s  mode=%s  connect_ip=%s  "
            "family=%s  user=%s  error=%s: %s\n%s",
            to_email, smtp_host, smtp_port, mode_label, connect_ip,
            "IPv4" if ipv4_addrs else ("IPv6" if ipv6_addrs else "unknown"),
            settings.SMTP_USER, type(exc).__name__, exc, traceback.format_exc(),
        )
        raise


# ── Public API ────────────────────────────────────────────────────────────────

def _get_dispatch():
    """Return the correct sync dispatch function for the configured transport.
    SMTP is preferred; Resend is only used when SMTP is not configured."""
    if settings.smtp_enabled:
        return _dispatch_smtp
    if settings.RESEND_API_KEY:
        return _dispatch_resend
    raise RuntimeError(
        "No email transport configured. "
        "Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD or RESEND_API_KEY."
    )


async def send_reset_email(to_email: str, reset_url: str, expire_minutes: int) -> None:
    """Send a password-reset email via the configured transport."""
    subject = "Reset your RecruitAI password"
    html = (
        _RESET_EMAIL_HTML
        .replace("{{to_email}}", to_email)
        .replace("{{reset_url}}", reset_url)
        .replace("{{expire_minutes}}", str(expire_minutes))
        .replace("{{frontend_url}}", settings.FRONTEND_URL)
    )
    text = (
        f"Reset your RecruitAI password\n\n"
        f"Open this link to choose a new password (expires in {expire_minutes} minutes):\n"
        f"{reset_url}\n\nIf you didn't request this, ignore this email.\n"
    )
    await asyncio.to_thread(_get_dispatch(), to_email, subject, html, text)


async def send_verification_email(to_email: str, full_name: str, verify_url: str) -> None:
    """Send an email verification link via the configured transport."""
    subject = "Verify your RecruitAI email address"
    html = (
        _VERIFY_EMAIL_HTML
        .replace("{{to_email}}", to_email)
        .replace("{{full_name}}", full_name)
        .replace("{{verify_url}}", verify_url)
        .replace("{{frontend_url}}", settings.FRONTEND_URL)
    )
    text = (
        f"Welcome to RecruitAI, {full_name}!\n\n"
        f"Click the link below to verify your email address (expires in 24 hours):\n"
        f"{verify_url}\n\nIf you didn't create a RecruitAI account, you can safely ignore this email.\n"
    )
    await asyncio.to_thread(_get_dispatch(), to_email, subject, html, text)
