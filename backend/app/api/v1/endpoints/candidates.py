import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.job import CandidateRanking, JobDescription
from app.models.user import User, UserRole
from app.models.resume import Resume
from app.core.security import get_current_active_user

router = APIRouter()


@router.get("/")
def list_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Return one record per application made to jobs posted by this recruiter.
    A candidate who applied to two of the recruiter's jobs appears twice.
    ATS score is the job-specific match score set at application time.
    """
    if current_user.role.value not in ("recruiter", "admin"):
        raise HTTPException(status_code=403, detail="Only recruiters can view the candidate pool")

    # Fetch the recruiter's jobs (id + title needed for the response)
    job_rows = (
        db.query(JobDescription.id, JobDescription.title)
        .filter(JobDescription.recruiter_id == current_user.id)
        .all()
    )
    if not job_rows:
        return []

    job_map = {j.id: j.title for j in job_rows}
    job_ids = list(job_map.keys())

    # One row per (ranking, resume, user) — i.e. one row per application
    rows = (
        db.query(CandidateRanking, Resume, User)
        .join(Resume, Resume.id == CandidateRanking.resume_id)
        .join(User, User.id == Resume.user_id)
        .filter(
            CandidateRanking.job_id.in_(job_ids),
            CandidateRanking.is_applied == True,  # noqa: E712
            User.role == UserRole.candidate,
            User.is_active == True,  # noqa: E712
        )
        .order_by(CandidateRanking.score.desc())
        .all()
    )

    candidates = []
    for ranking, resume, user in rows:
        if not os.path.exists(resume.file_path):
            continue
        candidates.append({
            "user_id": user.id,
            "resume_id": resume.id,
            "candidate_name": resume.candidate_name or user.full_name,
            "candidate_email": resume.candidate_email or user.email,
            # Use job-specific match score; fall back to general resume score
            "ats_score": ranking.score or resume.ats_score or 0,
            "applied_job_id": ranking.job_id,
            "applied_job_title": job_map.get(ranking.job_id, "Unknown Job"),
            "application_status": (
                ranking.application_status.value if ranking.application_status else "applied"
            ),
            "extracted_skills": resume.extracted_skills or [],
            "experience_years": resume.experience_years,
            "education_level": resume.education_level,
            "original_name": resume.original_name,
            "created_at": resume.created_at.isoformat(),
        })

    return candidates
