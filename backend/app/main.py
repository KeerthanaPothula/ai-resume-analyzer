import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.endpoints import analysis, auth, dashboard, jobs, rankings, resumes, users
from app.core.config import settings
from app.core.limiter import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: ensure the DB schema exists.
      - SQLite  (local dev)  → create_all is safe; always idempotent.
      - PostgreSQL (production) → run `alembic upgrade head` as a pre-deploy step;
        do NOT call create_all here so Alembic stays the single source of truth.
    """
    from app.db.database import Base, engine

    if settings.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)

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
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file mount for uploaded resumes ────────────────────────────────────
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(users.router,     prefix="/api/v1/users",     tags=["Users"])
app.include_router(resumes.router,   prefix="/api/v1/resumes",   tags=["Resumes"])
app.include_router(jobs.router,      prefix="/api/v1/jobs",      tags=["Job Descriptions"])
app.include_router(analysis.router,  prefix="/api/v1/analysis",  tags=["AI Analysis"])
app.include_router(rankings.router,  prefix="/api/v1/rankings",  tags=["Rankings"])


@app.get("/")
def root():
    return {"message": settings.APP_NAME, "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}