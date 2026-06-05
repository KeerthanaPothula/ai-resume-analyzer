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

    # LLM / AI feedback
    # Routing is automatic: configure any subset of the keys below.
    # ATS / Job-match  → Gemini → OpenAI → Groq
    # Career chat      → OpenAI → Gemini → Groq
    # LLM_PROVIDER is kept for backwards compatibility and status reporting only.
    LLM_PROVIDER: str = "none"       # legacy — ignored for routing; set any key below
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Password reset / Email verification
    FRONTEND_URL: str = "http://localhost:5173"
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24

    # ── Resend email transport (https://resend.com) ───────────────────────────
    # Sign up at https://resend.com — free tier: 3 000 emails/month.
    # Set RESEND_API_KEY in the Render dashboard.
    RESEND_API_KEY: Optional[str] = None
    # Sender address — must be on a verified Resend domain (e.g. noreply@yourdomain.com).
    # Without a verified domain, onboarding@resend.dev is used (sandbox — delivers to
    # the Resend account owner only).
    # Preferred env var: EMAIL_FROM. RESEND_FROM_EMAIL accepted for backwards compat.
    EMAIL_FROM: Optional[str] = None
    RESEND_FROM_EMAIL: Optional[str] = None  # backwards compat alias — prefer EMAIL_FROM

    # Shared display settings
    EMAILS_FROM_EMAIL: Optional[str] = None  # legacy alias — prefer EMAIL_FROM
    EMAILS_FROM_NAME: str = "RecruitAI"

    # Email fallback — when True, verify/reset URLs are returned in API responses on delivery failure.
    # Safe to set in production when SMTP/Resend is broken and you need users to self-verify.
    EMAIL_FALLBACK_ENABLED: bool = False

    @property
    def email_enabled(self) -> bool:
        """True when Resend is configured."""
        return bool(self.RESEND_API_KEY)

    @property
    def fallback_url_enabled(self) -> bool:
        """True when verify/reset URLs should be included in API responses on delivery failure."""
        return self.DEBUG or self.EMAIL_FALLBACK_ENABLED

    @property
    def active_email_transport(self) -> str:
        """Which transport will be used: 'resend' or 'none'."""
        return "resend" if self.RESEND_API_KEY else "none"

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
