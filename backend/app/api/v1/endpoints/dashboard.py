from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.job import JobDescription
from app.core.security import get_current_active_user, require_role

router = APIRouter()


@router.get("/candidate")
def candidate_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    resumes = db.query(Resume).filter(Resume.user_id == current_user.id).all()

    total = len(resumes)
    avg_score = round(sum(r.ats_score or 0 for r in resumes) / total, 1) if total else 0
    best_score = round(max((r.ats_score or 0 for r in resumes), default=0), 1)
    all_skills = list({s for r in resumes for s in (r.extracted_skills or [])})
    latest = max(resumes, key=lambda r: r.created_at, default=None)

    suggestions = []
    if total == 0:
        suggestions.append("Upload your first resume to get an ATS score and AI feedback.")
    if avg_score < 50:
        suggestions.append("Your average ATS score is below 50 — add more relevant keywords from job postings.")
    if avg_score < 70 and avg_score >= 50:
        suggestions.append("Quantify achievements with numbers and percentages to improve your score.")
    if len(all_skills) < 10:
        suggestions.append("Broaden your skill set — aim to showcase at least 10 relevant technical skills.")
    if not suggestions:
        suggestions.append("Strong profile! Tailor each resume to specific job descriptions for higher scores.")

    return {
        "total_resumes": total,
        "avg_ats_score": avg_score,
        "best_ats_score": best_score,
        "total_skills": len(all_skills),
        "top_skills": all_skills[:12],
        "latest_resume_date": latest.created_at.isoformat() if latest else None,
        "suggestions": suggestions,
        "resumes": [
            {
                "id": r.id,
                "original_name": r.original_name,
                "ats_score": round(r.ats_score or 0, 1),
                "extracted_skills": (r.extracted_skills or [])[:6],
                "candidate_name": r.candidate_name,
                "experience_years": r.experience_years,
                "education_level": r.education_level,
                "created_at": r.created_at.isoformat(),
                "ai_feedback": r.ai_feedback,
                "strengths": r.strengths or [],
                "weaknesses": r.weaknesses or [],
            }
            for r in sorted(resumes, key=lambda r: r.created_at, reverse=True)
        ],
    }


@router.get("/recruiter")
def recruiter_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter", "admin")),
):
    jobs = (
        db.query(JobDescription)
        .filter(JobDescription.recruiter_id == current_user.id)
        .all()
    )

    total_candidates = db.query(func.count(Resume.id)).scalar() or 0
    now = datetime.now(timezone.utc)
    this_month_jobs = [
        j for j in jobs
        if j.created_at.month == now.month and j.created_at.year == now.year
    ]

    return {
        "total_jobs": len(jobs),
        "total_candidates": total_candidates,
        "jobs_this_month": len(this_month_jobs),
        "jobs": [
            {
                "id": j.id,
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "required_skills": j.required_skills or [],
                "experience_required": j.experience_required,
                "created_at": j.created_at.isoformat(),
                "description": j.description[:200] + "…" if j.description and len(j.description) > 200 else j.description,
            }
            for j in sorted(jobs, key=lambda j: j.created_at, reverse=True)
        ],
    }
