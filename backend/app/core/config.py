import logging

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import List, Optional

_cfg_logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "sqlite:///./resume.db"

    # JWT
    SECRET_KEY: str = "supersecretkey123456789abcdef_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Registration: roles users can self-assign (admin is never self-assignable)
    ALLOWED_REGISTRATION_ROLES: List[str] = ["candidate", "recruiter"]

    # App
    APP_NAME: str = "RecruitAI"
    DEBUG: bool = False
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

    # Resend (preferred email transport — uses HTTPS, works on Render free tier)
    # Sign up at https://resend.com, get an API key, verify a sending domain.
    RESEND_API_KEY: Optional[str] = None
    # From address for Resend — must match a verified domain in your Resend account.
    # Example: "noreply@yourdomain.com". Leave unset to use "onboarding@resend.dev" (test only).
    RESEND_FROM_EMAIL: Optional[str] = None

    # SMTP (legacy fallback — keep for local dev; Resend takes priority when both are set)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    # Sender address — defaults to SMTP_USER when not set (required for Gmail)
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: str = "RecruitAI"

    @property
    def email_enabled(self) -> bool:
        """True when at least one email transport (Resend or SMTP) is configured."""
        return bool(self.RESEND_API_KEY or self.SMTP_HOST)

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

        # ── SMTP normalization & startup warnings ──────────────────────────────
        # Gmail App Passwords are 16 lowercase letters; they may be pasted with
        # spaces from the Google dashboard ("xxxx xxxx xxxx xxxx"). Strip them so
        # the raw value that reaches smtplib is always without spaces.
        if self.SMTP_PASSWORD:
            self.SMTP_PASSWORD = self.SMTP_PASSWORD.replace(" ", "")

        # Warn at startup if SMTP_USER and EMAILS_FROM_EMAIL differ on Gmail —
        # Gmail rejects the MAIL FROM if it doesn't match the authenticated user.
        if (
            self.SMTP_HOST == "smtp.gmail.com"
            and self.SMTP_USER
            and self.EMAILS_FROM_EMAIL
            and self.SMTP_USER.lower() != self.EMAILS_FROM_EMAIL.lower()
        ):
            _cfg_logger.warning(
                "Gmail SMTP warning: SMTP_USER (%s) and EMAILS_FROM_EMAIL (%s) differ. "
                "Gmail requires these to match — set EMAILS_FROM_EMAIL to the same address "
                "as SMTP_USER or leave EMAILS_FROM_EMAIL unset.",
                self.SMTP_USER, self.EMAILS_FROM_EMAIL,
            )

        return self


settings = Settings()