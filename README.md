# AI Resume Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A production-grade, full-stack AI recruitment platform that automates resume analysis, ATS scoring, candidate ranking, and end-to-end application tracking — powered by Google Gemini / OpenAI.

---

## Overview

The AI Resume Intelligence Platform is a modern SaaS-quality hiring tool that bridges candidates and recruiters with AI. It combines ATS scoring, semantic job matching, LLM-powered feedback, and a complete application status workflow — making it comparable to Lever, Greenhouse, and LinkedIn Recruiter.

**Candidate** — Upload resumes, get instant AI analysis, match against jobs, and track every application status from a single dashboard.

**Recruiter** — Post jobs, rank the entire candidate pool in one click, move candidates through a hiring pipeline with interview scheduling, and view real analytics.

---

## Features

### AI & Intelligence
- **ATS Scoring** — Multi-factor score: skill match (40%), experience (25%), education (20%), semantic similarity (15%)
- **Semantic Job Matching** — TF-IDF embeddings + cosine similarity for deep resume-to-job compatibility
- **LLM Feedback** — Google Gemini 2.5 Flash or OpenAI GPT-4o-mini for narrative feedback, gap analysis, and interview prep questions
- **Skill Extraction** — 200+ technical and soft skills from resume text
- **Career Chat** — AI coaching assistant with live resume context

### Application Tracking System
- Six-stage pipeline: `Applied → Under Review → Shortlisted → Interview Scheduled → Accepted/Rejected`
- Recruiter status changes are instantly reflected on the candidate's dashboard
- Interview scheduling with date/time picker, meeting link, and custom instructions
- Notification badge for new status updates
- Recruiter notes surfaced to candidates post-shortlisting

### Recruiter Tools
- Job pipeline management with search, edit, delete
- Candidate pool browser with score-range filters and multi-sort
- Bulk AI ranking that preserves existing pipeline decisions on re-rank
- Hiring funnel KPIs: shortlisted, interviewing, accepted, rejected counts
- Analytics: score distributions, job posting trends, most in-demand skills

### Security
- JWT access + refresh token rotation (SHA-256 hash stored server-side)
- Silent token refresh via Axios interceptor
- Rate limiting on auth endpoints (slowapi)
- Role-based access control: `candidate / recruiter / admin`
- Password change with current-password verification
- Forgot / Reset password with time-limited tokens (SHA-256 hashed, single-use)
- SMTP email delivery with branded HTML template; dev fallback prints link to terminal

### UI/UX
- Dark / light mode with persistent preference
- Skeleton loaders on every data-heavy view
- Framer Motion animations and tab transitions
- Mobile-responsive sidebar with animated drawer
- Optimistic UI updates on pipeline status changes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State / Data | TanStack Query v5, Zustand |
| UI / Motion | Framer Motion, Lucide React, Recharts |
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| Database | SQLite (dev) / PostgreSQL (prod) |
| AI | Google Gemini 2.5 Flash / OpenAI GPT-4o-mini |
| Auth | JWT (PyJWT), bcrypt, slowapi |
| Deploy | Vercel (frontend) + Render/Railway (backend) |

---

## Project Structure

```
ai-resume-platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   ├── auth.py          # Register, login, refresh, logout, change-password
│   │   │   ├── resumes.py       # Upload, list, get, delete
│   │   │   ├── jobs.py          # CRUD for job descriptions
│   │   │   ├── analysis.py      # ATS scoring
│   │   │   ├── rankings.py      # Rank, get, my-applications, PATCH status
│   │   │   ├── ai_feedback.py   # LLM feedback, quick-match, career chat
│   │   │   ├── dashboard.py     # Candidate + recruiter summaries
│   │   │   └── users.py         # User management (admin)
│   │   ├── models/
│   │   │   ├── user.py          # User, UserRole
│   │   │   └── job.py           # JobDescription, ATSScore, CandidateRanking, ApplicationStatus
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── scoring_engine.py   # ATS scoring, embeddings
│   │   │   │   ├── skill_extractor.py  # Skill extraction, gap analysis
│   │   │   │   └── llm_service.py      # Gemini/OpenAI adapter + template fallback
│   │   │   └── parsers/resume_parser.py
│   │   └── core/
│   │       ├── config.py        # Pydantic settings
│   │       ├── security.py      # JWT, bcrypt, role guards
│   │       └── limiter.py       # Rate limiter
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/               # Route-level components
    │   ├── components/          # Shared UI (Layout, StatsCard, ScoreRing, …)
    │   ├── hooks/useAuth.tsx    # Auth context + token management
    │   ├── lib/api.ts           # Axios instance + all API functions
    │   ├── stores/themeStore.ts # Zustand dark/light theme
    │   └── types/index.ts       # TypeScript types
    └── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Google Gemini or OpenAI API key

### 1. Clone

```bash
git clone https://github.com/your-username/ai-resume-platform.git
cd ai-resume-platform
```

### 2. Backend

```bash
cd backend

python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env (see Environment Variables section)

uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000`  
Swagger docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=sqlite:///./resume.db
# PostgreSQL (production):
# DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security — change SECRET_KEY in production!
SECRET_KEY=change-this-to-a-random-32-char-string
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# AI provider — leave "none" for template-based fallback (no API key needed)
LLM_PROVIDER=gemini          # "gemini" | "openai" | "none"
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash

# OPENAI_API_KEY=your-key-here
# OPENAI_MODEL=gpt-4o-mini

# File uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10

# Password reset
FRONTEND_URL=http://localhost:5173   # Change to your production URL
RESET_TOKEN_EXPIRE_MINUTES=30

# SMTP email (optional — omit for dev mode where the link is shown on-screen)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=you@gmail.com
# SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx   # Gmail App Password
# EMAILS_FROM_EMAIL=you@gmail.com
# EMAILS_FROM_NAME=Resume AI
```

### Frontend (`frontend/.env`)

```env
# Leave blank for local dev (Vite proxy handles /api/* → localhost:8000)
# VITE_API_URL=https://your-backend.render.com
```

---

## Configuring Email (SMTP)

The forgot-password flow sends a branded HTML email with a time-limited reset link.

### Dev mode (no SMTP configured)

When `SMTP_HOST` is not set, the backend:
1. Prints the reset URL to the terminal (visible in `uvicorn` output)
2. Returns `dev_reset_url` in the API response, which the frontend displays in an amber panel

No configuration needed — this works out of the box for local development.

### Production: Gmail

Gmail requires an **App Password** (not your regular account password).

**Steps:**
1. Go to your [Google Account](https://myaccount.google.com) → **Security**
2. Enable **2-Step Verification** (required)
3. Search for **"App passwords"** → create one → copy the 16-character code
4. Add to `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
EMAILS_FROM_EMAIL=your.email@gmail.com
EMAILS_FROM_NAME=Resume AI
```

> Note: `EMAILS_FROM_EMAIL` must match `SMTP_USER` for Gmail.

### Production: Outlook / Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your.email@outlook.com
SMTP_PASSWORD=your-outlook-password
EMAILS_FROM_EMAIL=your.email@outlook.com
EMAILS_FROM_NAME=Resume AI
```

### Production: SendGrid (recommended for scale)

SendGrid's free tier allows 100 emails/day. No domain verification needed for the SMTP relay.

1. Create a [SendGrid](https://sendgrid.com) account → **Settings → API Keys → Create API Key**
2. Grant **Mail Send** permission
3. Add to `backend/.env`:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-api-key-here
EMAILS_FROM_EMAIL=noreply@yourdomain.com
EMAILS_FROM_NAME=Resume AI
```

### API routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/forgot-password` | Generate reset token, send email (rate limited: 3/min) |
| POST | `/api/v1/auth/reset-password` | Validate token, update password, revoke sessions |

### Security properties

- Reset tokens are `secrets.token_urlsafe(32)` — 256 bits of entropy
- Only the SHA-256 hash is stored in the database
- Tokens expire after `RESET_TOKEN_EXPIRE_MINUTES` (default: 30)
- Tokens are single-use — consumed on successful reset
- All active sessions (refresh tokens) are revoked after a reset
- The endpoint returns the same generic message whether or not the email exists (prevents enumeration)
- The reset URL is **never included in the production response** when SMTP is configured

---

## Deployment

### Frontend — Vercel

1. Push repo to GitHub
2. Import into Vercel → set **Root Directory**: `frontend`
3. Build command: `npm run build` | Output dir: `dist`
4. Environment variable: `VITE_API_URL=https://your-backend-url`
5. Deploy

### Backend — Render

1. New **Web Service** → connect repo → set **Root Directory**: `backend`
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add all `.env` variables in the Render dashboard
5. Create a **PostgreSQL** database and copy the `DATABASE_URL`
6. Deploy

### Backend — Railway

```bash
railway login && railway init
railway variables set SECRET_KEY=... GEMINI_API_KEY=... DATABASE_URL=...
railway up
```

---

## Candidate Workflow

```
Register → Login
  → Upload Resume (PDF/DOCX)
  → AI parses: skills, experience, education, ATS score
  → View Analysis: feedback, radar chart, strengths/weaknesses
  → Job Match: paste any job → instant AI compatibility score + gap analysis
  → Career Chat: ask the AI coach anything about your profile
  → My Applications: see status for every job a recruiter ranked you for
  → Interview Scheduled → view date, join meeting link, read instructions
```

## Recruiter Workflow

```
Register (recruiter) → Login
  → Post Job: title, company, description, required skills
  → Browse Candidate Pool: filter by score, sort by name/date
  → Rank Candidates: one-click AI scoring against the job
  → Review Rankings: matched skills, missing skills, interview questions
  → Update Status: Applied → Shortlisted → Interview Scheduled
  → Schedule Interview: date, meeting link, custom instructions (visible to candidate)
  → Accept / Reject
  → Analytics: hiring funnel KPIs, score distributions, skill demand
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Login (returns token pair) |
| POST | `/api/v1/auth/refresh` | Rotate tokens |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| POST | `/api/v1/auth/change-password` | Change password |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/forgot-password` | Request password reset email |
| POST | `/api/v1/auth/reset-password` | Reset password with token |
| POST | `/api/v1/resumes/upload` | Upload PDF/DOCX |
| GET | `/api/v1/resumes/` | List resumes |
| DELETE | `/api/v1/resumes/{id}` | Delete resume |
| POST | `/api/v1/jobs/` | Create job |
| GET/PUT/DELETE | `/api/v1/jobs/{id}` | Manage job |
| POST | `/api/v1/analysis/score/{resume_id}/{job_id}` | Score resume vs job |
| POST | `/api/v1/rankings/rank/{job_id}` | Rank all candidates |
| GET | `/api/v1/rankings/job/{job_id}` | Get rankings |
| GET | `/api/v1/rankings/my-applications` | Candidate: own application statuses |
| PATCH | `/api/v1/rankings/{id}` | Update status, notes, interview details |
| GET | `/api/v1/dashboard/candidate` | Candidate dashboard summary |
| GET | `/api/v1/dashboard/recruiter` | Recruiter dashboard + hiring funnel |
| POST | `/api/v1/ai-feedback/resume/{id}` | LLM resume feedback |
| POST | `/api/v1/ai-feedback/quick-match` | Instant job match |
| POST | `/api/v1/ai-feedback/chat` | Career coaching chat |

---

## Application Status Pipeline

```
Applied → Under Review → Shortlisted → Interview Scheduled → Accepted
                                                           ↘ Rejected
```

Every transition is timestamped and shown on the candidate dashboard with recruiter notes and interview details.

---

## Future Roadmap

- [x] Email delivery for password reset (SMTP — Gmail, Outlook, SendGrid)
- [ ] Email notifications on application status changes
- [ ] Multi-round interview stages
- [ ] Bulk CSV export of candidate rankings
- [ ] LinkedIn OAuth login
- [ ] Multi-recruiter organization support
- [ ] AI job description generator
- [ ] Resume version diff view
- [ ] Webhook integration for Workday / Greenhouse

---

## License

MIT — free to use, modify, and distribute.
