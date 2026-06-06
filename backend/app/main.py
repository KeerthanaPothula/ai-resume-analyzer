import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
logger.info("app.main: module load started")

# Windows: use SelectorEventLoop so httpx/google-genai async calls work correctly.
# ProactorEventLoop (the Windows default) has known incompatibilities with httpx.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Inject the OS certificate store into Python's SSL so that
# httpx / google-genai can reach external APIs without cert errors.
# Catch ALL exceptions — on some Linux (Debian slim) configurations,
# inject_into_ssl() raises OSError/AttributeError, not ImportError.
# A bare ImportError catch would let those propagate and kill the process.
try:
    import truststore
    truststore.inject_into_ssl()
    logger.info("app.main: truststore SSL injection OK")
except Exception:
    pass  # Non-fatal — Python's default SSL works fine without it

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse, Response  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402

from app.api.v1.endpoints import (  # noqa: E402
    ai_feedback, analysis, applications, auth, candidates,
    dashboard, jobs, notifications, rankings, resumes, users,
)
from app.models import notification as _notification  # noqa: E402, F401
from app.core.config import settings  # noqa: E402
from app.core.limiter import limiter  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: ensure the DB schema exists.
      - SQLite  (local dev)  → create_all is safe; always idempotent.
      - PostgreSQL (production) → run `alembic upgrade head` as a pre-deploy step;
        do NOT call create_all here so Alembic stays the single source of truth.
    """
    from app.db.database import Base, engine

    # Log startup config — visible in Render's deploy log immediately
    logger.info("=== RecruitAI startup ===")
    logger.info("DATABASE_URL driver: %s", settings.DATABASE_URL.split("://")[0])
    logger.info("FRONTEND_URL: %s", settings.FRONTEND_URL)
    logger.info("LLM_PROVIDER: %s", settings.LLM_PROVIDER)
    logger.info("ENABLE_EMBEDDINGS: %s", settings.ENABLE_EMBEDDINGS)

    # ── Preload embedding model in background ─────────────────────────────────
    # Disabled by default: PyTorch alone consumes ~300 MB, which causes OOM on
    # Render free tier (512 MB cap) before the first request is served.
    # Set ENABLE_EMBEDDINGS=true to restore full semantic-similarity scoring.
    # When disabled, generate_embedding() returns None and calculate_ats_score()
    # automatically falls back to keyword-overlap for the semantic component.
    if settings.ENABLE_EMBEDDINGS:
        from app.services.ai.scoring_engine import preload_embedding_model
        preload_embedding_model()
    else:
        logger.info("Embeddings disabled (ENABLE_EMBEDDINGS=false) — ATS scoring uses keyword-overlap fallback")

    # ── Email transport diagnostic — always visible in Render logs ───────────
    if settings.RESEND_API_KEY:
        _key_masked = settings.RESEND_API_KEY[:8] + "***"
        _from = (
            settings.EMAIL_FROM
            or settings.RESEND_FROM_EMAIL
            or settings.EMAILS_FROM_EMAIL
            or "(not set — will use onboarding@resend.dev)"
        )
        logger.info("Email transport: Resend -- api_key=%s  from=%s", _key_masked, _from)
        if not (settings.EMAIL_FROM or settings.RESEND_FROM_EMAIL or settings.EMAILS_FROM_EMAIL):
            logger.warning(
                "Email WARNING: EMAIL_FROM not set -- using onboarding@resend.dev which only "
                "works in Resend sandbox mode (delivers to Resend account owner only). "
                "Set EMAIL_FROM=noreply@yourdomain.com in the Render dashboard after verifying "
                "your domain at https://resend.com/domains for unrestricted delivery."
            )
    else:
        logger.warning(
            "Email transport: NONE -- RESEND_API_KEY not set. "
            "Verify/reset URLs will be logged to the console only. "
            "To enable email: add RESEND_API_KEY and EMAIL_FROM in the Render dashboard."
        )

    if settings.EMAIL_FALLBACK_ENABLED:
        logger.info(
            "Email fallback: ENABLED (EMAIL_FALLBACK_ENABLED=true) -- "
            "verify/reset URLs returned in API responses when delivery fails"
        )
    elif settings.DEBUG:
        logger.info(
            "Email fallback: enabled via DEBUG=true -- "
            "verify/reset URLs returned in API responses when delivery fails"
        )
    else:
        logger.info(
            "Email fallback: disabled -- set EMAIL_FALLBACK_ENABLED=true in Render to expose "
            "verify/reset URLs in API responses when email delivery fails"
        )

    # ── CORS diagnostic — always visible in Render logs ──────────────────────
    logger.info("CORS allowed origins (%d):", len(settings.ALLOWED_ORIGINS))
    for origin in settings.ALLOWED_ORIGINS:
        logger.info("  · %s", origin)

    _frontend_placeholder = (
        "your-frontend" in settings.FRONTEND_URL
        or settings.FRONTEND_URL in ("http://localhost:5173", "http://localhost:5174")
    )
    if _frontend_placeholder:
        logger.warning(
            "⚠ CORS WARNING: FRONTEND_URL is '%s' — this is a placeholder or local dev value. "
            "Set FRONTEND_URL=https://ai-resume-analyzer-keerthanapothulas-projects.vercel.app "
            "in the Render dashboard, then redeploy. "
            "Until then, the Vercel domain is NOT in the CORS allow-list and preflight requests will fail.",
            settings.FRONTEND_URL,
        )
    else:
        logger.info("CORS: FRONTEND_URL '%s' — Vercel domain should pass preflight.", settings.FRONTEND_URL)

    logger.info("app.main: lifespan running — db driver: %s", settings.DATABASE_URL.split("://")[0])

    if settings.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)

        # Additive migrations: add new columns if they don't exist yet
        from sqlalchemy import text
        with engine.connect() as conn:
            for stmt in [
                "ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR",
                "ALTER TABLE users ADD COLUMN reset_token_expires DATETIME",
            ]:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    pass  # Column already exists — safe to ignore

            # Email verification columns — grandfather all pre-existing users as verified
            # so accounts created before this feature don't get locked out.
            try:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN email_verification_token_hash VARCHAR"
                ))
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN email_verification_token_expires DATETIME"
                ))
                conn.commit()
                conn.execute(text(
                    "UPDATE users SET email_verified = 1 WHERE email_verified = 0"
                ))
                conn.commit()
            except Exception:
                pass  # Columns already exist — migration already ran

            # Add is_applied column to track real applications vs recruiter-ranked entries.
            # On first run: delete ALL corrupt CandidateRanking rows that were created by
            # the "Rank All" button (which incorrectly ranked every resume in the system).
            # Going forward only POST /applications/apply creates valid ranking rows.
            try:
                conn.execute(text(
                    "ALTER TABLE candidate_rankings ADD COLUMN is_applied BOOLEAN NOT NULL DEFAULT 1"
                ))
                conn.commit()
                # Purge every existing ranking — they were all created by the buggy
                # "rank all resumes" flow, not by genuine candidate applications.
                conn.execute(text("DELETE FROM candidate_rankings"))
                conn.commit()
            except Exception:
                pass  # Column already exists — migration already ran, data is clean

            # Self-healing: remove resumes whose physical file is gone from disk.
            # Must run BEFORE orphan cleanup so the next steps catch the newly
            # deleted resume IDs in one pass.
            try:
                import os as _os
                rows = conn.execute(text("SELECT id, file_path FROM resumes")).fetchall()
                missing_ids = [r[0] for r in rows if not r[1] or not _os.path.exists(r[1])]
                if missing_ids:
                    id_list = ",".join(str(i) for i in missing_ids)
                    conn.execute(text(f"DELETE FROM ats_scores WHERE resume_id IN ({id_list})"))
                    conn.execute(text(f"DELETE FROM candidate_rankings WHERE resume_id IN ({id_list})"))
                    conn.execute(text(f"DELETE FROM resumes WHERE id IN ({id_list})"))
                    conn.commit()
            except Exception:
                pass

            # Orphan cleanup: remove ATS scores and rankings whose resume or job
            # no longer exists. Safe to run on every startup — only touches truly
            # broken rows; valid data is never affected.
            try:
                conn.execute(text(
                    "DELETE FROM ats_scores "
                    "WHERE resume_id NOT IN (SELECT id FROM resumes) "
                    "OR job_id NOT IN (SELECT id FROM job_descriptions)"
                ))
                conn.execute(text(
                    "DELETE FROM candidate_rankings "
                    "WHERE resume_id NOT IN (SELECT id FROM resumes) "
                    "OR job_id NOT IN (SELECT id FROM job_descriptions)"
                ))
                # Remove notifications for users that no longer exist
                conn.execute(text(
                    "DELETE FROM notifications "
                    "WHERE user_id NOT IN (SELECT id FROM users)"
                ))
                conn.commit()
            except Exception:
                pass

    logger.info("app.main: startup complete — uvicorn is now serving requests")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade AI-powered resume analysis and candidate ranking system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait a moment and try again."},
    )

app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    # Allow every Vercel preview URL for this project so new deployments
    # don't produce "Network Error" while waiting for EXTRA_CORS_ORIGINS to be updated.
    allow_origin_regex=r"https://ai-resume-analyzer[^.]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers ───────────────────────────────────────────────────────────
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Swagger UI and ReDoc load CSS/JS from cdn.jsdelivr.net — allow that for docs paths only.
    # All API endpoints keep the strict default-src 'none' policy.
    if request.url.path in ("/docs", "/redoc", "/openapi.json"):
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "script-src 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "font-src https://fonts.gstatic.com; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )
    else:
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response


# Ensure the upload directory exists at startup.
# Files are NOT served via a public static mount — use GET /api/v1/resumes/{id}/file
# which is authenticated and ownership-checked.
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router,         prefix="/api/v1/auth",         tags=["Authentication"])
app.include_router(dashboard.router,    prefix="/api/v1/dashboard",    tags=["Dashboard"])
app.include_router(users.router,        prefix="/api/v1/users",        tags=["Users"])
app.include_router(resumes.router,      prefix="/api/v1/resumes",      tags=["Resumes"])
app.include_router(candidates.router,   prefix="/api/v1/candidates",   tags=["Candidates"])
app.include_router(jobs.router,         prefix="/api/v1/jobs",         tags=["Job Descriptions"])
app.include_router(analysis.router,     prefix="/api/v1/analysis",     tags=["AI Analysis"])
app.include_router(rankings.router,     prefix="/api/v1/rankings",     tags=["Rankings"])
app.include_router(ai_feedback.router,  prefix="/api/v1/ai-feedback",  tags=["AI Feedback"])
app.include_router(applications.router, prefix="/api/v1/applications", tags=["Applications"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])

logger.info("app.main: %d routes registered — module load complete", len(app.routes))


@app.get("/")
def root():
    return {"message": settings.APP_NAME, "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    _from = (
        settings.EMAIL_FROM
        or settings.RESEND_FROM_EMAIL
        or settings.EMAILS_FROM_EMAIL
        or ("onboarding@resend.dev" if settings.RESEND_API_KEY else None)
    )
    return {
        "status": "healthy",
        "email": {
            "transport": settings.active_email_transport,
            "configured": settings.email_enabled,
            "from_address": _from,
            "resend_configured": bool(settings.RESEND_API_KEY),
            "fallback_enabled": settings.fallback_url_enabled,
        },
    }


# ── Public CORS diagnostic (no auth required) ──────────────────────────────────
@app.get("/api/v1/cors-check", tags=["Health"])
def cors_check():
    """
    Public endpoint — returns the CORS configuration so you can verify
    your Vercel domain is in the allow-list without needing a token.
    Open in browser or curl:
      curl -H "Origin: https://your-app.vercel.app" https://your-backend.onrender.com/api/v1/cors-check
    """
    return {
        "allowed_origins": settings.ALLOWED_ORIGINS,
        "frontend_url": settings.FRONTEND_URL,
        "cors_configured": any(
            "vercel.app" in o or "netlify.app" in o or ("localhost" not in o and "127.0.0.1" not in o)
            for o in settings.ALLOWED_ORIGINS
        ),
    }


# ── Debug endpoints (DEBUG=True only) ─────────────────────────────────────────
@app.get("/api/v1/debug/resend", tags=["Debug"])
def resend_debug():
    """
    Resend configuration check. Only available when DEBUG=True.

    To enable temporarily on Render:
      Render dashboard → your service → Environment → add DEBUG=True → Save → redeploy.
    Remove DEBUG=True after testing.
    """
    from fastapi import HTTPException as _HTTPException
    if not settings.DEBUG:
        raise _HTTPException(
            status_code=403,
            detail=(
                "Debug endpoints are disabled. "
                "Set DEBUG=True in Render Environment Variables and redeploy to enable. "
                "Remove it again after testing."
            ),
        )
    _configured = bool(settings.RESEND_API_KEY)
    _email = (
        settings.EMAIL_FROM
        or settings.RESEND_FROM_EMAIL
        or settings.EMAILS_FROM_EMAIL
        or "onboarding@resend.dev"
    )
    from_addr = f"{settings.EMAILS_FROM_NAME} <{_email}>"
    return {
        "resend_configured": _configured,
        "api_key_prefix": (settings.RESEND_API_KEY[:8] + "***") if settings.RESEND_API_KEY else "(not set)",
        "from_address": from_addr,
        "advice": (
            "Resend is configured. Use /debug/resend/send-test to verify delivery."
            if _configured
            else "Set RESEND_API_KEY in Render Environment Variables, then redeploy."
        ),
    }


@app.post("/api/v1/debug/email-status", tags=["Debug"])
def email_status_debug():
    """
    Email transport and fallback configuration status. No auth required.
    """
    return {
        "transport": settings.active_email_transport,
        "email_enabled": settings.email_enabled,
        "resend_configured": bool(settings.RESEND_API_KEY),
        "fallback_enabled": settings.fallback_url_enabled,
        "details": {
            "from_address": (
                settings.EMAIL_FROM
                or settings.RESEND_FROM_EMAIL
                or settings.EMAILS_FROM_EMAIL
                or "(not set — using onboarding@resend.dev)"
            ),
            "debug_mode": settings.DEBUG,
            "email_fallback_enabled_flag": settings.EMAIL_FALLBACK_ENABLED,
        },
    }


@app.post("/api/v1/debug/resend/send-test", tags=["Debug"])
async def resend_send_test(to: str):
    """
    Send a real test email via Resend to verify end-to-end delivery. Only available when DEBUG=True.

    Usage:
      POST /api/v1/debug/resend/send-test?to=you@example.com
    """
    from fastapi import HTTPException as _HTTPException
    if not settings.DEBUG:
        raise _HTTPException(
            status_code=403,
            detail="Debug endpoints are disabled. Set DEBUG=True in Render Environment Variables and redeploy.",
        )
    if not settings.RESEND_API_KEY:
        raise _HTTPException(
            status_code=400,
            detail="RESEND_API_KEY not set. Add it in Render Environment Variables, then redeploy.",
        )
    from app.services.email import send_reset_email
    test_url = f"{settings.FRONTEND_URL}/reset-password?token=TEST_TOKEN_DEBUG"
    try:
        await send_reset_email(to, test_url, settings.RESET_TOKEN_EXPIRE_MINUTES)
        return {
            "status": "sent",
            "to": to,
            "note": "Check your inbox and spam folder. If received, Resend is working correctly.",
        }
    except Exception as exc:
        raise _HTTPException(
            status_code=500,
            detail=f"Send failed: {type(exc).__name__}: {exc}",
        )
