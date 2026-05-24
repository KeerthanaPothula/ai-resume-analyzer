# RecruitAI — AI-Powered Recruitment & ATS Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Full-stack AI recruitment platform — ATS resume scoring, semantic candidate ranking, LLM-generated feedback, and a complete six-stage hiring pipeline. Built with FastAPI, React 18, and Google Gemini.

---

## Overview

RecruitAI covers the full hiring lifecycle in a single role-separated interface. Recruiters get an applicant tracking system with AI-powered candidate ranking and funnel analytics. Candidates get instant ATS scoring, skill gap analysis, semantic job matching, and LLM-generated resume feedback — with real-time notifications on every pipeline update.

---

## Screenshots

> _Demo screenshots / GIF coming soon._

| Candidate Dashboard | Recruiter Rankings | Job Match Analyzer |
|:---:|:---:|:---:|
| _(screenshot)_ | _(screenshot)_ | _(screenshot)_ |

---

## Key Features

**AI & Resume Intelligence**
- Multi-factor ATS scoring — skill match, experience, education, semantic similarity
- Sentence-transformer embeddings + cosine similarity for deep resume-to-job matching
- Google Gemini / OpenAI LLM feedback: gap analysis, strengths, interview prep questions
- 200+ technical and soft skills extracted from unstructured resume text
- Conversational AI career coach with live resume context

**Applicant Tracking System**
- Six-stage hiring pipeline: `Applied → Under Review → Shortlisted → Interview Scheduled → Accepted / Rejected`
- Real-time status sync between candidate and recruiter dashboards
- Interview scheduling — date/time, meeting link, custom instructions
- In-app notification system with unread badge and per-event icons

**Recruiter Tools**
- Job pipeline management with search, filter, edit, archive
- Candidate pool browser — ATS score-range filters, multi-column sort
- One-click bulk AI ranking that preserves existing pipeline decisions
- Hiring funnel KPIs and analytics dashboard (score distribution, skill demand trends)

**Platform**
- JWT auth with refresh token rotation and silent renewal
- Role-based access control: `candidate / recruiter / admin`
- Password reset via SMTP email (Gmail, Outlook, SendGrid)
- Dark / light mode, skeleton loaders, Framer Motion animations, mobile-responsive

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
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` |
| Auth | JWT, bcrypt, slowapi rate limiting |

---

## Local Setup

**Prerequisites:** Python 3.11+, Node.js 18+, and an optional Gemini or OpenAI API key.

```bash
# 1 — Backend
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements_local.txt
cp .env.example .env                           # add SECRET_KEY and AI key
uvicorn app.main:app --reload --port 8000

# 2 — Frontend (separate terminal)
cd frontend
npm install && npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |

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
