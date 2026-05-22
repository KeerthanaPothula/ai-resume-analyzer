from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict

from app.db.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.job import JobDescription, ATSScore
from app.schemas.ai_feedback import (
    LLMStatusResponse,
    ResumeFeedbackResponse,
    JobMatchFeedbackResponse,
)
from app.core.security import get_current_active_user
from app.services.ai.llm_service import get_llm_service

router = APIRouter()


@router.get("/status", response_model=LLMStatusResponse)
def llm_status():
    """Return the configured LLM provider and whether it has a valid API key."""
    svc = get_llm_service()
    return LLMStatusResponse(
        available=svc.is_available,
        provider=svc.provider if svc.is_available else "none",
    )


@router.get("/test")
async def test_llm_connection(
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Smoke-test the configured LLM provider with a minimal API call.
    Returns {ok, provider, model, response} on success or {ok, error} on failure.
    Requires authentication — call from Swagger /docs or the frontend after login.
    """
    svc = get_llm_service()
    return await svc.ping()


@router.post("/resume/{resume_id}", response_model=ResumeFeedbackResponse)
async def generate_resume_feedback(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate AI-powered feedback for a resume.
    Uses the configured LLM provider; falls back to deterministic templates
    when no API key is set.
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id and current_user.role.value not in ("admin", "recruiter"):
        raise HTTPException(status_code=403, detail="Not authorized")

    svc = get_llm_service()
    feedback = await svc.generate_resume_feedback(
        raw_text=resume.raw_text or "",
        skills=resume.extracted_skills or [],
        experience_years=resume.experience_years or 0.0,
        education_level=resume.education_level or "Not Specified",
        weaknesses=resume.weaknesses or [],
    )

    return ResumeFeedbackResponse(
        provider=svc.provider if svc.is_available else "template",
        **feedback.dict(),
    )


@router.post("/resume/{resume_id}/job/{job_id}", response_model=JobMatchFeedbackResponse)
async def generate_job_match_feedback(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate AI-powered job-match feedback including interview questions
    and ATS optimization tips specific to the job description.
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Reuse matched/missing skill lists from any prior ATS scoring run
    ats = (
        db.query(ATSScore)
        .filter(ATSScore.resume_id == resume_id, ATSScore.job_id == job_id)
        .first()
    )

    svc = get_llm_service()
    feedback = await svc.generate_job_match_feedback(
        raw_text=resume.raw_text or "",
        job_title=job.title,
        job_description=job.description,
        matched_skills=ats.matched_skills if ats else [],
        missing_skills=ats.missing_skills if ats else [],
    )

    return JobMatchFeedbackResponse(
        provider=svc.provider if svc.is_available else "template",
        **feedback.dict(),
    )
