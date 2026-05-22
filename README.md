# AI Resume Intelligence Platform

A production-ready, full-stack AI-powered resume analysis and candidate ranking platform built with **FastAPI**, **React**, **PostgreSQL**, and state-of-the-art NLP models.

---

## Features

### Candidate
- Upload PDF / DOCX resumes
- AI-powered resume parsing (name, email, phone, location)
- Automatic skill extraction (500+ tech keywords)
- ATS score calculation
- AI feedback and improvement suggestions
- Analytics dashboard with charts

### Recruiter
- Post job descriptions
- Automatic skill extraction from JD
- Rank candidates semantically against job requirements
- Skill gap analysis
- Interview question generation
- Side-by-side candidate comparison

### Admin
- User management
- Platform-wide analytics
- System health monitoring

### AI / ML Engine
- `sentence-transformers/all-MiniLM-L6-v2` for semantic embeddings
- Cosine similarity for semantic matching
- Multi-factor ATS scoring (skills 40% + experience 20% + education 15% + semantic 25%)
- spaCy NLP pipeline
- FAISS-ready vector store

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts |
| Backend | FastAPI, Python 3.11, SQLAlchemy, Alembic, JWT |
| Database | PostgreSQL 15 |
| AI/ML | sentence-transformers, spaCy, scikit-learn, PyMuPDF |
| DevOps | Docker, Docker Compose, Nginx |

---

## Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose installed

### 1. Clone / Extract Project

```bash
cd ai-resume-platform
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your secrets if needed
```

### 3. Start the Platform

```bash
docker-compose up --build
```

### 4. Access the App

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/api/docs |
| ReDoc | http://localhost:8000/api/redoc |

---

## Local Development (Without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Set your DB URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/resumedb"
export SECRET_KEY="your-secret-key"

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

---

## Project Structure

```
ai-resume-platform/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Sidebar, Layout
│   │   │   └── ui/             # ScoreRing, SkillBadge, StatsCard
│   │   ├── pages/              # All page components
│   │   ├── hooks/              # useAuth context
│   │   ├── lib/                # Axios API client
│   │   └── types/              # TypeScript types
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # auth, resumes, jobs, analysis, rankings
│   │   ├── core/               # config, security/JWT
│   │   ├── db/                 # SQLAlchemy engine
│   │   ├── models/             # User, Resume, JobDescription, ATSScore
│   │   ├── schemas/            # Pydantic models
│   │   └── services/
│   │       ├── ai/             # scoring_engine, skill_extractor
│   │       └── parsers/        # resume_parser (PDF/DOCX)
│   ├── alembic/                # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login (returns JWT) |
| GET | `/api/v1/auth/me` | Get current user |

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/resumes/upload` | Upload + parse resume |
| GET | `/api/v1/resumes/` | List resumes |
| GET | `/api/v1/resumes/{id}` | Get resume detail |
| DELETE | `/api/v1/resumes/{id}` | Delete resume |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/jobs/` | Create job description |
| GET | `/api/v1/jobs/` | List jobs |
| GET | `/api/v1/jobs/{id}` | Get job |
| DELETE | `/api/v1/jobs/{id}` | Delete job |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/analysis/score/{resume_id}/{job_id}` | Score resume vs job |
| GET | `/api/v1/analysis/scores/resume/{id}` | All scores for resume |
| GET | `/api/v1/analysis/scores/job/{id}` | All scores for job |

### Rankings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/rankings/rank/{job_id}` | Rank candidates |
| GET | `/api/v1/rankings/job/{job_id}` | Get rankings |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `SECRET_KEY` | `supersecretkey...` | JWT signing key (change in production!) |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token expiry |
| `VITE_API_URL` | `http://localhost:8000` | Frontend API URL |

---

## Default Demo Accounts

After starting, register your own accounts via the UI, or seed manually via the API:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"candidate@demo.com","full_name":"Demo Candidate","password":"demo123","role":"candidate"}'

curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"recruiter@demo.com","full_name":"Demo Recruiter","password":"demo123","role":"recruiter"}'
```

---

## Screenshots

```
Landing Page   → /
Login          → /login
Register       → /register
Candidate      → /candidate    (after login as candidate)
Recruiter      → /recruiter    (after login as recruiter)
Upload Resume  → /upload
Analysis       → /analysis/:id
Rankings       → /ranking/:id
Admin          → /admin        (after login as admin)
```

---

## License

MIT — Free to use and modify.
