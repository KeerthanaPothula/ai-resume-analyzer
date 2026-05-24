from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import List, Optional


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
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

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

    # SMTP (optional — if unset, reset URL is printed to console for dev)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    # Sender address — defaults to SMTP_USER when not set (required for Gmail)
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: str = "RecruitAI"

    @model_validator(mode="after")
    def _add_frontend_url_to_origins(self) -> "Settings":
        """Ensure FRONTEND_URL is always allowed by CORS, even when not listed explicitly."""
        if self.FRONTEND_URL and self.FRONTEND_URL not in self.ALLOWED_ORIGINS:
            self.ALLOWED_ORIGINS = list(self.ALLOWED_ORIGINS) + [self.FRONTEND_URL]
        return self


settings = Settings()