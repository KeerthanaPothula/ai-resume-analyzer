import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
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
    Return one record per unique candidate user using their latest uploaded resume.
    Only includes candidates whose resume file still exists on disk.
    """
    if current_user.role.value not in ("recruiter", "admin"):
        raise HTTPException(status_code=403, detail="Only recruiters can view the candidate pool")

    # Subquery: latest resume ID per user (IDs are monotonically increasing)
    latest_sq = (
        db.query(func.max(Resume.id).label("latest_id"))
        .group_by(Resume.user_id)
        .subquery()
    )

    rows = (
        db.query(Resume, User)
        .join(User, User.id == Resume.user_id)
        .join(latest_sq, latest_sq.c.latest_id == Resume.id)
        .filter(User.role == UserRole.candidate)
        .filter(User.is_active == True)  # noqa: E712
        .order_by(Resume.created_at.desc())
        .all()
    )

    candidates = []
    for resume, user in rows:
        # Skip if the uploaded file no longer exists on disk (stale/deleted)
        if not os.path.exists(resume.file_path):
            continue
        candidates.append({
            "user_id": user.id,
            "resume_id": resume.id,
            "candidate_name": resume.candidate_name or user.full_name,
            "candidate_email": resume.candidate_email or user.email,
            "ats_score": resume.ats_score or 0,
            "extracted_skills": resume.extracted_skills or [],
            "experience_years": resume.experience_years,
            "education_level": resume.education_level,
            "original_name": resume.original_name,
            "created_at": resume.created_at.isoformat(),
        })

    return candidates
