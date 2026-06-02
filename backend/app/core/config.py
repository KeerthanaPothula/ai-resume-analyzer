import logging

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import List, Optional

_cfg_logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "sqlite:///./resume.db"

    # JWT — SECRET_KEY has no default; the app will refuse to start if it is not set.
    # Local dev: add SECRET_KEY=<random 64-char hex> to backend/.env
    # Production (Render): the dashboard auto-generates this value.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Registration: roles users can self-assign (admin is never self-assignable)
    ALLOWED_REGISTRATION_ROLES: List[str] = ["candidate", "recruiter"]

    # App
    APP_NAME: str = "RecruitAI"
    DEBUG: bool = False
    ENABLE_EMBEDDINGS: bool = False
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    # CORS — localhost entries kept for dev; FRONTEND_URL is appended automatically.
    # Override entirely via env: ALLOWED_ORIGINS='["https://yourapp.vercel.app"]'
    # Add extra origins (comma-separated, no JSON needed):
    #   EXTRA_CORS_ORIGINS=https://yourapp.vercel.app,https://preview.vercel.app
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ]
    EXTRA_CORS_ORIGINS: str = ""

    # LLM / AI feedback — set LLM_PROVIDER to "openai" or "gemini" and supply the matching key
    LLM_PROVIDER: str = "none"       # "openai" | "gemini" | "none"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Password reset / Email verification
    FRONTEND_URL: str = "http://localhost:5173"
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24

    # ── Resend email transport (https://resend.com) ───────────────────────────
    # Requires a verified sending domain. Leave unset to fall back to SMTP below.
    RESEND_API_KEY: Optional[str] = None
    # Must match a verified domain in your Resend account (e.g. noreply@yourdomain.com).
    # Leave unset to use SMTP transport instead (recommended when no custom domain).
    RESEND_FROM_EMAIL: Optional[str] = None

    # ── SMTP email transport (Gmail / Outlook / any SMTP provider) ────────────
    # Works out of the box with Gmail App Passwords (no custom domain needed).
    # Gmail: enable 2FA → https://myaccount.google.com/apppasswords → generate 16-char password.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None          # Your email address
    SMTP_PASSWORD: Optional[str] = None      # App Password (NOT your login password)
    SMTP_TLS: bool = True                    # STARTTLS on port 587; set False only for SSL/465

    # Shared display settings used by both transports
    EMAILS_FROM_EMAIL: Optional[str] = None  # Overrides SMTP_USER / RESEND_FROM_EMAIL as display From
    EMAILS_FROM_NAME: str = "RecruitAI"

    @property
    def smtp_enabled(self) -> bool:
        """True when SMTP credentials are fully configured."""
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)

    @property
    def email_enabled(self) -> bool:
        """True when either Resend or SMTP is configured."""
        return bool(self.RESEND_API_KEY) or self.smtp_enabled

    @property
    def active_email_transport(self) -> str:
        """Which transport will be used: 'resend', 'smtp', or 'none'."""
        if self.RESEND_API_KEY:
            return "resend"
        if self.smtp_enabled:
            return "smtp"
        return "none"

    @model_validator(mode="after")
    def _add_frontend_url_to_origins(self) -> "Settings":
        """Ensure FRONTEND_URL and EXTRA_CORS_ORIGINS are always in the CORS allow-list.
        All URLs are normalized (trailing slash stripped) so https://app.vercel.app/
        and https://app.vercel.app match the same browser Origin header.
        """
        def _norm(url: str) -> str:
            return url.strip().rstrip("/")

        # Normalize the base list
        origins: list[str] = [_norm(o) for o in self.ALLOWED_ORIGINS if o.strip()]

        # Auto-add FRONTEND_URL
        if self.FRONTEND_URL:
            normed = _norm(self.FRONTEND_URL)
            if normed and normed not in origins:
                origins.append(normed)

        # Auto-add EXTRA_CORS_ORIGINS (comma-separated)
        for raw in self.EXTRA_CORS_ORIGINS.split(","):
            normed = _norm(raw)
            if normed and normed not in origins:
                origins.append(normed)

        self.ALLOWED_ORIGINS = origins

        return self


settings = Settings()
