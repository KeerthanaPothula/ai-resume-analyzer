# RecruitAI — AI-Powered Recruitment & Applicant Tracking Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A production-grade, full-stack AI recruitment platform with ATS resume scoring, semantic candidate ranking, LLM-generated feedback, and a six-stage applicant tracking pipeline — built with FastAPI, React 18, and Google Gemini.

---

## Highlights

- **AI-powered ATS scoring** using multi-factor analysis: skill match, experience, education, and semantic similarity
- **Semantic resume-to-job matching** with sentence-transformer embeddings and cosine similarity
- **LLM feedback engine** — Google Gemini / OpenAI generates gap analysis, strengths, and interview prep questions per candidate
- **Full applicant tracking system** with a six-stage hiring pipeline, real-time status sync, and interview scheduling
- **Role-separated dashboards** — independent, tailored interfaces for candidates and recruiters
- **Secure authentication** — JWT with refresh token rotation, RBAC, rate limiting, and SMTP password reset

---

## Overview

RecruitAI is a SaaS-style hiring platform built for the full recruitment lifecycle. Candidates upload resumes and get instant AI-scored feedback, semantic job matching, and live pipeline visibility. Recruiters post jobs, trigger one-click AI ranking across the entire applicant pool, and manage candidates through a structured pipeline — from initial review through interview scheduling to final decision — with KPI analytics at every step.

---

## Features

### AI & Resume Intelligence
- Multi-factor ATS score: skill match (40%), experience (25%), education (20%), semantic similarity (15%)
- Sentence-transformer embeddings (`all-MiniLM-L6-v2`) for deep resume-to-job compatibility scoring
- Google Gemini 2.5 Flash / OpenAI GPT-4o-mini for narrative feedback, skill gap analysis, and interview prep
- 200+ technical and soft skills extracted from unstructured PDF and DOCX resume text
- AI career coach — conversational assistant with live resume context

### Applicant Tracking System
- Six-stage pipeline: `Applied → Under Review → Shortlisted → Interview Scheduled → Accepted / Rejected`
- Recruiter status changes sync to the candidate dashboard in real time
- Structured interview scheduling — date/time, meeting link, and custom instructions per candidate
- In-app notification system with per-event type icons and unread count badge

### Recruiter Tools
- Job management — create, search, filter, edit, archive job postings
- Candidate pool browser with ATS score-range filters and multi-column sort
- One-click bulk AI ranking across all applicants, preserving existing pipeline decisions
- Hiring funnel analytics — shortlisted, interviewing, accepted, and rejected KPIs per job

### Platform
- JWT access + refresh token rotation with silent renewal via Axios interceptor
- Role-based access control: `candidate / recruiter / admin`
- SMTP password reset — time-limited single-use tokens, Gmail / Outlook / SendGrid compatible
- Dark / light mode, skeleton loaders, Framer Motion animations, mobile-responsive layout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State / Data | TanStack Query v5, Zustand |
| UI / Motion | Framer Motion, Lucide React, Recharts |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2 |
| Database | SQLite (dev) · PostgreSQL (prod) |
| AI / LLM | Google Gemini 2.5 Flash · OpenAI GPT-4o-mini |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`) |
| Auth | JWT (PyJWT), bcrypt, slowapi rate limiting |

---

## Local Setup

**Requires:** Python 3.11+, Node.js 18+. A Gemini or OpenAI API key is optional — the platform runs with template-based fallback without one.

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements_local.txt
cp .env.example .env        # set SECRET_KEY; optionally add GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000

# Frontend  (new terminal)
cd frontend
npm install && npm run dev
```

| | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## What's Next

- [ ] Email notifications on pipeline status changes
- [ ] Multi-round interview stages
- [ ] Bulk CSV export of ranked candidates
- [ ] LinkedIn OAuth login
- [ ] AI-generated job description drafting
- [ ] Webhook integration (Workday / Greenhouse)

---

## License

MIT — free to use, modify, and distribute.
