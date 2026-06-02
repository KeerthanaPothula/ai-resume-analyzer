"""
Pytest configuration and shared fixtures.

Environment variables MUST be set before any app module is imported so that
pydantic-settings reads the test values when Settings() is first instantiated.
"""

import os
import shutil

# ── Test environment — set BEFORE any app.* import ────────────────────────────
os.environ["SECRET_KEY"] = "test-only-secret-key-not-for-production-use-32ch"
os.environ["DATABASE_URL"] = "sqlite:///./test_recruitai.db"
os.environ["LLM_PROVIDER"] = "none"
os.environ["ENABLE_EMBEDDINGS"] = "false"
os.environ["UPLOAD_DIR"] = "./test_uploads"
# Disable email so dev_verify_url / dev_reset_url appear in responses
os.environ["RESEND_API_KEY"] = ""

# ── Now safe to import app modules ─────────────────────────────────────────────
import pytest  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402, F401
from sqlalchemy.orm import sessionmaker  # noqa: E402, F401
from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402, F401 — populate SQLAlchemy mapper registry

from app.main import app  # noqa: E402
from app.db.database import Base, engine as _app_engine, get_db, SessionLocal  # noqa: E402
from app.core.security import get_password_hash, create_access_token  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.resume import Resume  # noqa: E402
from app.models.job import JobDescription  # noqa: E402


# ── Session-scoped: create all tables once ────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create tables before the test session; drop and delete DB file after."""
    Base.metadata.create_all(bind=_app_engine)
    yield
    Base.metadata.drop_all(bind=_app_engine)
    # Dispose engine connections BEFORE deleting the file — required on Windows
    # where open file handles prevent deletion.
    _app_engine.dispose()
    try:
        os.remove("./test_recruitai.db")
    except (FileNotFoundError, PermissionError):
        pass  # non-fatal: CI or next run will clean up
    if os.path.isdir("./test_uploads"):
        shutil.rmtree("./test_uploads", ignore_errors=True)


# ── Function-scoped: clean DB state between tests ────────────────────────────

@pytest.fixture(scope="function")
def db():
    """Yield a fresh DB session; wipe all rows after the test."""
    session = SessionLocal()
    yield session
    session.close()
    # Delete all rows in reverse FK order
    with _app_engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys = OFF"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.commit()


@pytest.fixture(scope="function")
def client(db):
    """TestClient that creates its own DB sessions (independent of the test db fixture)."""
    def _override_get_db():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── User fixtures ──────────────────────────────────────────────────────────────

def _make_user(db, email: str, role: UserRole, verified: bool = True) -> User:
    user = User(
        email=email,
        full_name=f"Test {role.value.title()}",
        hashed_password=get_password_hash("Password123!"),
        role=role,
        is_active=True,
        email_verified=verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def candidate_user(db):
    return _make_user(db, "candidate@test.com", UserRole.candidate)


@pytest.fixture
def candidate_user_unverified(db):
    return _make_user(db, "unverified@test.com", UserRole.candidate, verified=False)


@pytest.fixture
def candidate_user2(db):
    return _make_user(db, "candidate2@test.com", UserRole.candidate)


@pytest.fixture
def recruiter_user(db):
    return _make_user(db, "recruiter@test.com", UserRole.recruiter)


@pytest.fixture
def recruiter_user2(db):
    return _make_user(db, "recruiter2@test.com", UserRole.recruiter)


@pytest.fixture
def admin_user(db):
    return _make_user(db, "admin@test.com", UserRole.admin)


# ── Auth header fixtures ───────────────────────────────────────────────────────

def _headers(user: User) -> dict:
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def candidate_headers(candidate_user):
    return _headers(candidate_user)


@pytest.fixture
def candidate2_headers(candidate_user2):
    return _headers(candidate_user2)


@pytest.fixture
def recruiter_headers(recruiter_user):
    return _headers(recruiter_user)


@pytest.fixture
def recruiter2_headers(recruiter_user2):
    return _headers(recruiter_user2)


@pytest.fixture
def admin_headers(admin_user):
    return _headers(admin_user)


# ── Shared fake resume analysis result (used to mock the CPU-bound pipeline) ──

FAKE_ANALYSIS = {
    "raw_text": "Software Engineer John Doe john@example.com Python FastAPI SQLAlchemy",
    "candidate_name": "John Doe",
    "candidate_email": "john@example.com",
    "candidate_phone": "555-123-4567",
    "candidate_location": "New York, NY",
    "experience_years": 3.0,
    "education_level": "Bachelor's",
    "skills": ["Python", "FastAPI", "SQLAlchemy"],
    "embedding": None,
    "general": {
        "overall": 75.0,
        "strengths": ["Python", "FastAPI"],
        "weaknesses": ["Leadership", "Public Speaking"],
    },
    "summary": "Experienced software engineer with 3 years of Python development.",
    "feedback": "Strong technical foundation. Consider adding cloud certifications.",
}
