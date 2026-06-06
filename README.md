# RecruitAI

<div align="center">

[![Backend CI](https://github.com/KeerthanaPothula/ai-resume-analyzer/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/KeerthanaPothula/ai-resume-analyzer/actions/workflows/backend-ci.yml)
[![codecov](https://codecov.io/gh/KeerthanaPothula/ai-resume-analyzer/branch/main/graph/badge.svg?style=flat-square)](https://codecov.io/gh/KeerthanaPothula/ai-resume-analyzer)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat-square&logo=postgresql)](https://neon.tech)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat-square&logo=docker)](https://docker.com)
[![Deployed on Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://render.com)
[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**AI-powered resume analysis, ATS optimization, and candidate ranking platform for job seekers and recruiters.**

[Live Demo](https://ai-resume-analyzer-nine-peach.vercel.app) · [API Docs](https://recruitai-backend-f6pi.onrender.com/docs) · [Report Bug](https://github.com/KeerthanaPothula/ai-resume-analyzer/issues)

</div>

---

RecruitAI is a production-grade full-stack web application that replaces spreadsheet-based hiring with AI-scored resumes, semantic candidate ranking, LLM-generated feedback, and a six-stage applicant tracking pipeline. It uses a multi-provider AI architecture — Google Gemini, OpenAI, and Groq — with automatic ordered failover so AI features remain available even when a provider hits quota limits or goes offline.

| Metric | Value |
|---|---|
| API Endpoints | 30+ |
| Database Migrations | 8 (Alembic) |
| Interview Question Bank | 120+ questions |
| Skills Extracted | 100+ keywords |
| Hiring Pipeline Stages | 6 |
| AI Providers | 3 (with automatic fallback) |
| Automated Tests | 89 (pytest) |

---

## Features

### For Candidates
- **Resume Upload & Auto-Parsing** — Upload PDF or DOCX; the backend extracts raw text, skills, experience years, education level, and contact information, then computes an ATS score automatically on upload.
- **ATS Score Analysis** — Multi-factor score combining skill keyword overlap (40%), experience years (20%), education level (15%), and optional semantic similarity via sentence-transformers embeddings (25%).
- **Skill Gap Analysis** — See exactly which required and preferred skills are matched or missing against any job description.
- **AI Resume Feedback** — LLM-generated strengths, weaknesses, ATS optimization tips, and improvement suggestions specific to your profile.
- **Job Match Analysis** — Detailed breakdown of fit against a saved job posting including matched/missing skills, experience and education fit, and AI-generated role-specific interview prep questions.
- **Quick Match** — Paste any job description text and get an instant AI analysis without saving the job first.
- **AI Career Coach** — Context-aware conversational assistant (OpenAI → Gemini → Groq) that answers career questions and references your actual resume profile only when relevant. Maintains full conversation history per session.
- **Application Tracking** — Apply to jobs and track your status through the full pipeline: Applied → Under Review → Shortlisted → Interview Scheduled → Accepted/Rejected.
- **Real-time Notifications** — Receive in-app notifications when a recruiter updates your status, schedules an interview, or sends you a message.

### For Recruiters
- **Job Posting Management** — Create, edit, and delete job descriptions with required and preferred skill fields, experience requirements, and education criteria.
- **Applicant-Only Rankings** — Rank all candidates who explicitly applied to a job using AI composite scoring. Non-applicants never appear in rankings regardless of resume uploads.
- **One-click Re-ranking** — Trigger AI re-scoring of all current applicants at any time to account for newly uploaded resumes.
- **Candidate Pipeline Management** — Shortlist candidates, add private recruiter notes, schedule interviews with video meeting links and custom instructions, and update application status.
- **Dashboard Analytics** — Overview of total jobs, total applicants, shortlisted count, and pending reviews.

### For Admins
- **Admin Dashboard** — Platform-wide visibility into all users, resumes, jobs, and system health status.
- **User Management** — View and manage all registered accounts across all roles.

### Platform-wide
- **Multi-Provider AI Fallback** — `ProviderRouter` automatically tries providers in task-specific order (Gemini → OpenAI → Groq for ATS/Job Match; OpenAI → Gemini → Groq for Career Chat). Quota errors, rate limits, and provider outages trigger transparent failover with structured logging.
- **Role-Based Access Control** — Three roles (candidate, recruiter, admin) enforced at the API level on every endpoint.
- **JWT Authentication** — Short-lived access tokens with refresh token rotation; plain tokens are never stored — only SHA-256 hashes.
- **Email Verification & Password Reset** — Transactional emails via Resend with a URL fallback mode for environments where SMTP is blocked (e.g. Render free tier).
- **Interview Question Deduplication** — Per-user question history table prevents the AI from asking the same interview question twice across sessions.
- **Rate Limiting** — Endpoint-level limits via slowapi: 5/min on registration, 3/min on password reset, 10/min on AI feedback, 20/min on chat.
- **Security Headers** — HSTS, X-Frame-Options, X-Content-Type-Options, CSP, and Referrer-Policy applied to all responses in production.
- **Authenticated File Access** — Resume files are never publicly accessible; downloads require a valid JWT with ownership or recruiter/admin role.

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.2 | UI component framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.1 | Build tool and dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| TanStack Query | 5.x | Server-state management, caching, cache invalidation |
| Zustand | 5.x | Client-state management |
| React Router DOM | 6.x | Client-side routing with lazy loading |
| Axios | latest | HTTP client with token-refresh interceptor |
| Recharts | 2.x | Analytics data visualization |
| Framer Motion | latest | Page and component animations |
| React Dropzone | 14.x | Drag-and-drop file upload |
| Lucide React | latest | Icon library |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.109 | Async REST API framework |
| Uvicorn | 0.27 | ASGI server |
| SQLAlchemy | 2.0 | ORM with async-safe session management |
| Alembic | 1.13 | Database schema migrations |
| Pydantic v2 | latest | Data validation and settings management |
| PyJWT | 2.x | JWT creation and verification |
| passlib + bcrypt | latest | Password hashing |
| slowapi | latest | IP-based rate limiting |
| PyMuPDF (fitz) | latest | PDF text extraction |
| python-docx | latest | DOCX text extraction |
| sentence-transformers | latest | Semantic similarity embeddings (optional) |
| scikit-learn | latest | Cosine similarity scoring |
| Resend | 2.x | Transactional email delivery |
| httpx / aiofiles | latest | Async HTTP and file I/O |

### AI Providers

| Provider | Default Model | Routing Priority |
|---|---|---|
| Google Gemini | `gemini-2.5-flash` | ATS Analysis: **1st** · Job Match: **1st** · Career Chat: **2nd** |
| OpenAI | `gpt-4o-mini` | ATS Analysis: **2nd** · Job Match: **2nd** · Career Chat: **1st** |
| Groq | `llama-3.3-70b-versatile` | Universal **3rd** (fallback) — free tier, no extra package |

Providers without a configured API key are skipped automatically. At least one key is required for AI features.

### Infrastructure

| Service | Role |
|---|---|
| Neon PostgreSQL | Serverless production database |
| Render | Backend hosting (Dockerized, free tier) |
| Vercel | Frontend hosting (CDN, automatic preview deployments) |
| Docker + Docker Compose | Containerization and local orchestration |
| GitHub Actions | CI pipeline (pytest + flake8 on every push) |

---

## System Architecture

```mermaid
graph TD
    Browser["User Browser"] --> Vercel["Frontend\n(React + Vite)\nVercel CDN"]
    Vercel -->|"HTTPS / Bearer JWT"| Render["Backend\n(FastAPI + Uvicorn)\nRender Docker"]

    Render --> Neon[("Neon PostgreSQL\n(Serverless)")]
    Render --> Disk["File Storage\n(Render Disk)\nuploads/"]
    Render --> Resend["Resend API\n(Email)"]

    subgraph "AI Provider Router"
        Render --> Router{"ProviderRouter"}
        Router -->|"ATS/Job Match — Primary"| Gemini["Google Gemini\ngemini-2.5-flash"]
        Router -->|"Chat — Primary\nATS — Fallback 1"| OpenAI["OpenAI\ngpt-4o-mini"]
        Router -->|"Universal Fallback 2"| Groq["Groq\nllama-3.3-70b-versatile"]
    end
```

### Request Flow

```
Browser
  └─ React SPA (Vercel CDN)
       └─ axios + TanStack Query → VITE_API_URL/api/v1/...
            └─ FastAPI (Render)
                 ├─ JWT validation + RBAC
                 ├─ SQLAlchemy → Neon PostgreSQL
                 │     └─ db.close() before LLM call  ← connection released early
                 └─ ProviderRouter
                      ├─ GeminiProvider  (google-genai, 25s timeout, JSON mode)
                      ├─ OpenAIProvider  (openai SDK, response_format: json_object)
                      └─ GroqProvider    (openai SDK, base_url=api.groq.com, 8000 token cap)
```

**On 401 from any API call:** The Axios interceptor silently refreshes the access token, queues all in-flight requests, and retries them — users never see an auth error during normal use.

---

## Installation

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (optional, for full-stack local run)

### Option A — Docker Compose (recommended)

```bash
# 1. Clone
git clone https://github.com/KeerthanaPothula/ai-resume-analyzer.git
cd ai-resume-analyzer

# 2. Configure environment
cp .env.example .env
# Edit .env — set SECRET_KEY and at least one AI provider key

# 3. Start all services (PostgreSQL + backend + frontend)
docker compose up --build

# Backend:  http://localhost:8000
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

### Option B — Manual (backend + frontend separately)

**Backend**

```bash
cd backend

python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — minimum: SECRET_KEY + one AI provider key
# Generate SECRET_KEY:
python -c "import secrets; print(secrets.token_hex(32))"

# Run migrations and start server
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend

npm install

# Point the frontend at the local backend
echo "VITE_API_URL=http://localhost:8000" > .env.local

npm run dev
# → http://localhost:5173
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| **Database** | | | |
| `DATABASE_URL` | Yes | `sqlite:///./resume.db` | PostgreSQL connection string. Use Neon for production. SQLite for local dev. |
| **Authentication** | | | |
| `SECRET_KEY` | **Yes** | — | 64-char hex secret for JWT signing. `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime |
| **Application** | | | |
| `DEBUG` | No | `false` | Enables debug-only endpoints (`/api/v1/debug/*`). `/docs` and `/redoc` are always available. |
| `UPLOAD_DIR` | No | `uploads` | Directory for uploaded resume files |
| `MAX_FILE_SIZE_MB` | No | `10` | Maximum resume upload size |
| `ENABLE_EMBEDDINGS` | No | `false` | Enable sentence-transformers semantic scoring. Requires ~500 MB RAM. |
| **CORS** | | | |
| `FRONTEND_URL` | No | `http://localhost:5173` | Vercel URL — added to CORS allow-list automatically |
| `EXTRA_CORS_ORIGINS` | No | `` | Comma-separated extra origins (e.g. Vercel preview URLs) |
| **AI — Gemini** | | | |
| `GEMINI_API_KEY` | Recommended | — | [Google AI Studio](https://aistudio.google.com) API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model ID |
| **AI — OpenAI** | | | |
| `OPENAI_API_KEY` | Optional | — | OpenAI platform API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model ID |
| **AI — Groq** | | | |
| `GROQ_API_KEY` | Optional | — | [Groq Console](https://console.groq.com) API key (free tier) |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model ID |
| **Email** | | | |
| `RESEND_API_KEY` | Optional | — | [Resend](https://resend.com) API key (free: 3,000 emails/month) |
| `EMAIL_FROM` | Optional | — | Sender address — must be on a verified Resend domain |
| `EMAILS_FROM_NAME` | No | `RecruitAI` | Display name for sent emails |
| `EMAIL_FALLBACK_ENABLED` | No | `false` | Return verify/reset URLs in API responses when email delivery fails |
| `RESET_TOKEN_EXPIRE_MINUTES` | No | `30` | Password reset token lifetime |
| `VERIFICATION_TOKEN_EXPIRE_HOURS` | No | `24` | Email verification token lifetime |

> **Minimum for local development:** `SECRET_KEY` + one of `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `GROQ_API_KEY`.
>
> `LLM_PROVIDER` is a legacy variable kept for backward compatibility. It is not used for routing — the `ProviderRouter` selects providers based on which keys are configured.

### Frontend (`.env.local` or Vercel dashboard)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | **Yes** | Backend base URL, e.g. `https://your-backend.onrender.com` |

---

## API Overview

Base path: `/api/v1` · Interactive docs: [`GET /docs`](https://recruitai-backend-f6pi.onrender.com/docs) (Swagger) · [`GET /redoc`](https://recruitai-backend-f6pi.onrender.com/redoc)

All endpoints require `Authorization: Bearer <token>` except public auth routes.

### Authentication — `/api/v1/auth`

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `POST` | `/register` | 5/min | Register a new account |
| `POST` | `/login` | 10/min | Obtain access + refresh tokens |
| `POST` | `/refresh` | 20/min | Rotate refresh token |
| `POST` | `/logout` | — | Revoke refresh token |
| `GET` | `/me` | — | Current user profile |
| `POST` | `/change-password` | 5/min | Change password |
| `POST` | `/forgot-password` | 3/min | Request password reset email |
| `POST` | `/reset-password` | 5/min | Reset password with token |
| `POST` | `/verify-email` | 10/min | Verify email address |
| `POST` | `/resend-verification` | 3/min | Resend verification email |

### Resumes — `/api/v1/resumes`

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload PDF or DOCX; triggers full AI parsing pipeline |
| `GET` | `/` | List resumes (candidates see own; admins/recruiters see all) |
| `GET` | `/{id}` | Resume detail |
| `GET` | `/{id}/file` | Download resume file (authenticated) |
| `DELETE` | `/{id}` | Delete resume and all related ATS scores and rankings |

### Jobs & ATS — `/api/v1/jobs`, `/api/v1/analysis`

| Method | Path | Description |
|---|---|---|
| `POST` | `/jobs/` | Create job posting (recruiter) |
| `GET` | `/jobs/` | List job postings |
| `PUT` | `/jobs/{id}` | Update job (recruiter/owner) |
| `DELETE` | `/jobs/{id}` | Delete job (recruiter/owner) |
| `POST` | `/analysis/score/{resume_id}/{job_id}` | Score a resume against a job description |
| `GET` | `/analysis/scores/resume/{resume_id}` | All ATS scores for a resume |
| `GET` | `/analysis/scores/job/{job_id}` | All ATS scores for a job |

### AI Feedback — `/api/v1/ai-feedback`

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `GET` | `/status` | — | LLM provider availability (no auth) |
| `GET` | `/test` | — | Smoke-test all configured providers |
| `POST` | `/resume/{id}` | 10/min | AI resume feedback (strengths, weaknesses, tips) |
| `POST` | `/resume/{id}/job/{job_id}` | 10/min | Job-match feedback + interview questions |
| `POST` | `/quick-match` | 10/min | Instant match against pasted job description text |
| `POST` | `/chat` | 20/min | Career coach chat with conversation history |

### Applications & Rankings — `/api/v1/applications`, `/api/v1/rankings`

| Method | Path | Description |
|---|---|---|
| `POST` | `/applications/apply` | Candidate applies to a job |
| `GET` | `/rankings/job/{job_id}` | Ranked applicants for a job (recruiter) |
| `POST` | `/rankings/rank/{job_id}` | Re-rank applicants by AI score (recruiter) |
| `PATCH` | `/rankings/{id}` | Update status, interview date, meeting link, notes |
| `GET` | `/rankings/my-applications` | Candidate's own application list |

### Dashboard & Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/candidate` | Candidate summary stats |
| `GET` | `/dashboard/recruiter` | Recruiter summary stats |
| `GET` | `/notifications/` | User notification feed |
| `GET` | `/notifications/unread-count` | Unread count badge |
| `POST` | `/notifications/{id}/read` | Mark notification read |
| `POST` | `/notifications/read-all` | Mark all notifications read |

---

## Database Schema

Schema is managed by 8 Alembic migrations covering: initial tables, application tracking, email verification, reset tokens, admin bootstrap, performance indexes, question history, and notifications.

```
┌──────────────────┐     ┌───────────────────┐
│      users       │     │  job_descriptions  │
│──────────────────│     │───────────────────│
│ id (PK)          │     │ id (PK)            │
│ email (UNIQUE)   │     │ recruiter_id (FK)  │
│ full_name        │     │ title              │
│ hashed_password  │     │ company            │
│ role (enum) ─────┼──── │ description        │
│ is_active        │     │ required_skills    │
│ email_verified   │     │ preferred_skills   │
│ refresh_token_hash     │ experience_required│
│ reset_token_hash │     │ education_required │
└────────┬─────────┘     └────────┬───────────┘
         │ 1:N                    │ 1:N
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│     resumes      │     │    ats_scores    │
│──────────────────│     │──────────────────│
│ id (PK)          │◄────┤ resume_id (FK)   │
│ user_id (FK)     │     │ job_id (FK)      │
│ filename         │     │ overall_score    │
│ raw_text         │     │ skill_match_score│
│ extracted_skills │     │ experience_score │
│ experience_years │     │ education_score  │
│ education_level  │     │ semantic_score   │
│ ats_score        │     │ matched_skills   │
│ strengths        │     │ missing_skills   │
│ weaknesses       │     │ interview_qs     │
│ embedding        │     └──────────────────┘
└────────┬─────────┘
         │ 1:N
         ▼
┌────────────────────────┐
│   candidate_rankings   │
│────────────────────────│
│ id (PK)                │
│ job_id (FK)            │
│ resume_id (FK)         │
│ rank                   │
│ score                  │
│ is_applied (Boolean)   │  ← guards against orphan rows
│ application_status     │  ← applied/under_review/shortlisted/
│ shortlisted            │     interview_scheduled/accepted/rejected
│ interview_date         │
│ meeting_link           │
│ interview_instructions │
│ recruiter_notes        │
└────────────────────────┘

┌──────────────────┐     ┌──────────────────────┐
│  notifications   │     │ user_question_history│
│──────────────────│     │──────────────────────│
│ id (PK)          │     │ id (PK)              │
│ user_id (FK)     │     │ user_id (FK)         │
│ title            │     │ question_text        │
│ message          │     │ generated_at         │
│ type (enum)      │     │ Index(user_id,       │
│ read (bool)      │     │       generated_at)  │
│ action_url       │     └──────────────────────┘
└──────────────────┘
```

---

## Deployment

### Frontend → Vercel

1. Push repository to GitHub.
2. Import project at [vercel.com/new](https://vercel.com/new):
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add environment variable: `VITE_API_URL = https://your-backend.onrender.com`
4. Vercel deploys automatically on every push to `main`.

### Backend → Render

The `render.yaml` at the repository root configures the Render service. Render detects it automatically when you connect the repository.

Set the following in the **Render dashboard → Environment**:

```
DATABASE_URL       = postgresql://user:pass@host.neon.tech/dbname?sslmode=require
SECRET_KEY         = <64-char hex>
GEMINI_API_KEY     = AIzaSy...
OPENAI_API_KEY     = sk-...            # optional
GROQ_API_KEY       = gsk_...           # optional — free at console.groq.com
RESEND_API_KEY     = re_...            # optional
EMAIL_FROM         = noreply@yourdomain.com
FRONTEND_URL       = https://your-app.vercel.app
EXTRA_CORS_ORIGINS = https://*.vercel.app
EMAIL_FALLBACK_ENABLED = true          # recommended on Render free tier
```

On first deploy, the Docker container runs `alembic upgrade head` automatically before Uvicorn starts serving traffic.

> **RAM note:** The Render free tier provides 512 MB RAM. `ENABLE_EMBEDDINGS=false` (default) keeps memory well within this limit. Enable embeddings only on paid plans with at least 1 GB RAM.

### Database → Neon PostgreSQL

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the connection string from **Connection Details → Connection string**.
3. Set it as `DATABASE_URL` in your Render environment.
4. No further configuration needed — Alembic creates all tables on startup.

> **Email on Render free tier:** Render blocks outbound SMTP. Set `EMAIL_FALLBACK_ENABLED=true` so the backend returns a direct verification/reset link in API responses when email delivery fails. Tokens are still hashed, expiring, and secure — only the delivery channel changes.

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

```
tests/test_auth.py          — register, login, JWT, refresh rotation, logout, email verify
tests/test_auth_flows.py    — extended auth edge cases
tests/test_permissions.py   — candidate / recruiter / admin RBAC boundary checks
tests/test_jobs.py          — job creation, update, delete, access control
tests/test_resumes.py       — upload, download, authenticated access control
tests/test_rankings.py      — applicant ranking, re-rank, status updates
tests/test_scoring.py       — ATS scoring, skill extraction, embedding-disabled path
tests/test_smtp_fail_scenario.py — email fallback behavior
```

Test infrastructure: isolated SQLite database per session, `get_db` dependency override for full session isolation, `unittest.mock.patch` to stub the PDF parsing pipeline, environment variables injected before Pydantic Settings instantiation.

---

## Challenges & Solutions

### Migration from Render PostgreSQL to Neon

**Problem:** The original Render-managed PostgreSQL needed replacing with Neon for a serverless, always-available connection. The `fromDatabase` directive in `render.yaml` was silently overriding a manually-set `DATABASE_URL` on every deploy.

**Solution:** Removed the `fromDatabase` binding and set `sync: false` on `DATABASE_URL` in `render.yaml`. The variable is now set directly in the Render dashboard to point at Neon, and Render no longer controls its value. Running `pg_dump` on the old Render PostgreSQL and restoring into Neon preserved the user data.

---

### Multi-Provider AI Fallback System

**Problem:** A single LLM provider meant any quota exhaustion, rate limit, or outage caused a complete AI feature failure with no recovery path.

**Solution:** Designed and implemented a `ProviderRouter` abstraction with a `BaseProvider` ABC, concrete provider classes for Gemini, OpenAI, and Groq, and a `ProviderError(is_recoverable, status_code)` exception type. Each router is configured with a task-specific provider order:

```
ATS / Job Match:  Gemini  →  OpenAI  →  Groq
Career Chat:      OpenAI  →  Gemini  →  Groq
```

Recoverable errors (HTTP 429, 503, timeouts, connection errors) trigger transparent fallback. Non-recoverable errors (HTTP 401 invalid key) propagate immediately. Every call emits structured log output:

```
INFO  provider_used=gemini task=resume_feedback fallback_triggered=False latency_ms=1243
WARN  provider=gemini task=quick_job_match failed status_code=429 recoverable=True
INFO  provider_used=openai task=quick_job_match fallback_triggered=True fallback_chain=gemini latency_ms=876
```

---

### Database Connection Pool Exhaustion

**Problem:** FastAPI's `Depends(get_db)` holds a SQLAlchemy connection open for the entire request lifecycle. LLM calls take 25–60 seconds. With `pool_size=1, max_overflow=2` (Render free tier), three concurrent AI requests held all three connections — causing admin dashboard queries and every other endpoint to time out at the 30-second pool timeout.

**Solution:** In each of the four AI endpoints, `db.close()` is called immediately after all database reads are complete and before the async LLM call. SQLAlchemy's session object remains valid after `close()` — any subsequent DB write (e.g., `question_history.record_questions`) transparently reacquires a connection from the now-free pool. No pool size changes were needed.

```python
# Pattern applied in all four AI endpoints:
exclude = qh.get_recent_set(db, current_user.id)   # last DB read
db.close()                                          # release connection back to pool
result, provider = await svc.quick_job_match(...)  # LLM call — no connection held
qh.record_questions(db, current_user.id, ...)      # reacquires connection transparently
```

---

### Applicant Integrity in Rankings

**Problem:** The recruiter rankings page displayed every user who had ever uploaded a resume (including people who never applied to the job), because the ranking pipeline ran against all resumes rather than actual applicants.

**Solution:** Added an `is_applied` boolean column to `CandidateRanking`. `POST /applications/apply` now sets `is_applied=True` explicitly. The `GET /rankings/job/{job_id}` endpoint and the AI re-rank `POST` both filter on `is_applied=True`. A startup migration cleared all orphan ranking rows created before the fix.

---

## Project Structure

```
ai-resume-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/        # Route handlers: auth, resumes, jobs,
│   │   │                            #   rankings, applications, ai_feedback,
│   │   │                            #   dashboard, notifications, users, candidates
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic Settings (all env vars)
│   │   │   ├── security.py          # JWT, bcrypt, RBAC dependencies
│   │   │   └── limiter.py           # slowapi rate limiter instance
│   │   ├── db/database.py           # SQLAlchemy engine, SessionLocal, get_db
│   │   ├── models/                  # ORM models: user, resume, job, notification,
│   │   │                            #   question_history
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   └── services/
│   │       ├── ai/
│   │       │   ├── providers/       # base.py, gemini.py, openai_provider.py,
│   │       │   │                    #   groq_provider.py, __init__.py
│   │       │   ├── llm_service.py   # ProviderRouter, LLMService, all prompts
│   │       │   └── skill_extractor.py
│   │       └── email.py             # Resend transactional email service
│   ├── alembic/
│   │   └── versions/                # 8 versioned migration scripts
│   ├── tests/                       # 89 pytest tests
│   ├── Dockerfile
│   ├── .dockerignore
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/                   # 18 lazy-loaded page components
│   │   ├── components/              # Layout, ChatAssistant, AIFeedbackPanel,
│   │   │                            #   ScoreRing, SkillBadge, StatsCard, etc.
│   │   └── lib/api.ts               # Axios instance + token-refresh interceptor
│   ├── Dockerfile                   # Multi-stage: Node builder → Nginx runner
│   └── nginx.conf
├── .github/workflows/
│   └── backend-ci.yml               # pytest + flake8 on every push to main
├── docker-compose.yml               # Local full-stack orchestration
├── render.yaml                      # Render deployment configuration
└── .env.example                     # Template for all environment variables
```

---

## Project Highlights

- **Multi-provider AI routing with automatic failover** — Built a `BaseProvider` ABC, three concrete provider implementations (Gemini, OpenAI, Groq), and a `ProviderRouter` that routes by task and fails over transparently on quota/rate-limit/outage. Structured logs include `provider_used`, `fallback_triggered`, `fallback_chain`, and `latency_ms` per call.

- **Production database session management** — Diagnosed and resolved a SQLAlchemy connection pool exhaustion bug specific to async LLM endpoints: DB connections are now explicitly released before long-running I/O via `db.close()`, allowing the pool to serve concurrent non-AI requests without increasing pool size.

- **Full-stack TypeScript + Python application** — React 18 + TypeScript frontend with Vite, TanStack Query v5, and Zustand; FastAPI async backend with SQLAlchemy 2.0 and Pydantic v2 for strict schema validation end-to-end. Transparent access token refresh via Axios interceptor with in-flight request queuing.

- **Multi-factor ATS scoring engine** — Weighted composite score combining skill keyword overlap, experience-year matching, education-level matching, and optional semantic similarity via sentence-transformers cosine similarity — with graceful degradation when embeddings are disabled (default on 512 MB free tier).

- **8-migration Alembic schema history** — Database schema evolved through 8 versioned Alembic migrations: initial tables, application tracking status, email verification tokens, refresh/reset token hashing, admin bootstrap, composite performance indexes, per-user question deduplication history, and real-time notifications.

- **Six-stage applicant tracking pipeline** — Complete recruitment workflow (apply → under_review → shortlisted → interview_scheduled → accepted/rejected) with `is_applied` integrity guard (prevents non-applicants from appearing in rankings), interview scheduling with meeting links and custom instructions, and in-app notifications on every status change.

- **Serverless-ready infrastructure** — Backend runs on Render Docker (free tier, 512 MB RAM); database migrated to Neon PostgreSQL serverless with `pool_pre_ping=True` for connection keep-alive; frontend on Vercel CDN with automatic preview deployments per branch.

- **Security by default** — JWT refresh token rotation with bcrypt-hashed storage (plain tokens never written to DB), HSTS and CSP response headers, IP-based rate limiting on all auth and AI endpoints, CORS allowlist with Vercel preview URL support, and `.dockerignore` preventing secrets from entering the Docker build context.

---

## Future Improvements

- **Resume Builder** — Generate a fully optimized resume from scratch given a target job description, using structured LLM output.
- **Bulk Resume Import** — Allow recruiters to upload a ZIP of resumes and auto-rank all against a job in one step.
- **pgvector Semantic Search** — Migrate embeddings from JSON columns to `pgvector` for O(log n) nearest-neighbor candidate search at scale.
- **LinkedIn OAuth** — One-click sign-in and profile import from LinkedIn.
- **Cover Letter Generator** — AI-drafted cover letters tailored to a specific job and candidate profile.
- **WebSocket Notifications** — Replace polling with real-time push notifications via WebSocket or Server-Sent Events.
- **Resume Version History** — Allow candidates to maintain multiple resume versions and compare ATS scores across them.
- **Interview Scheduler Integration** — Native Calendly or Google Calendar integration for one-click interview booking.

---

## Contributing

```bash
# Fork, then clone your fork
git clone https://github.com/your-username/ai-resume-analyzer.git
cd ai-resume-analyzer
git checkout -b feature/your-feature-name

# After making changes, run tests
cd backend && python -m pytest tests/ -v

# Commit and open a pull request
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
```

Please follow [Conventional Commits](https://www.conventionalcommits.org) for commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, etc.).

---

## License

MIT — free to use, modify, and distribute. See [LICENSE](LICENSE) for details.

---

<div align="center">
Built with FastAPI · React · Google Gemini · OpenAI · Groq · Neon PostgreSQL
</div>
