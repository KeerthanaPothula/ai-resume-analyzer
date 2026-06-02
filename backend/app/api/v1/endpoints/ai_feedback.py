import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.core.security import get_current_active_user
from app.db.database import get_db
from app.models.job import JobDescription, ATSScore
from app.models.resume import Resume
from app.models.user import User
from app.schemas.ai_feedback import (
    LLMStatusResponse,
    ResumeFeedbackResponse,
    JobMatchFeedbackResponse,
    QuickMatchRequest,
    QuickMatchResponse,
    ChatRequest,
    ChatResponse,
)
from app.services import question_history as qh
from app.services.ai.llm_service import LLMService, get_llm_service

logger = logging.getLogger(__name__)

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
@limiter.limit("10/minute")
async def generate_resume_feedback(
    request: Request,
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
    try:
        feedback = await svc.generate_resume_feedback(
            raw_text=resume.raw_text or "",
            skills=resume.extracted_skills or [],
            experience_years=resume.experience_years or 0.0,
            education_level=resume.education_level or "Not Specified",
            weaknesses=resume.weaknesses or [],
            ats_score=resume.ats_score or 0.0,
            strengths=resume.strengths or [],
        )
        provider = svc.provider if svc.is_available else "template"
    except Exception:
        logger.exception("Unhandled error in generate_resume_feedback; using template")
        feedback = LLMService._template_resume_feedback(
            resume.extracted_skills or [],
            resume.experience_years or 0.0,
            resume.education_level or "Not Specified",
            resume.weaknesses or [],
        )
        provider = "template"

    return ResumeFeedbackResponse(provider=provider, **feedback.dict())


@router.post("/resume/{resume_id}/job/{job_id}", response_model=JobMatchFeedbackResponse)
@limiter.limit("10/minute")
async def generate_job_match_feedback(
    request: Request,
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
    exclude = qh.get_recent_set(db, current_user.id)
    try:
        feedback = await svc.generate_job_match_feedback(
            raw_text=resume.raw_text or "",
            job_title=job.title,
            job_description=job.description,
            matched_skills=ats.matched_skills if ats else [],
            missing_skills=ats.missing_skills if ats else [],
            user_id=current_user.id,
            exclude=exclude,
        )
        provider = svc.provider if svc.is_available else "template"
    except Exception:
        logger.exception("Unhandled error in generate_job_match_feedback; using template")
        feedback = LLMService._template_job_match(
            job.title,
            ats.matched_skills if ats else [],
            ats.missing_skills if ats else [],
            user_id=current_user.id,
            exclude=exclude,
        )
        provider = "template"

    qh.record_questions(db, current_user.id, feedback.interview_questions)
    return JobMatchFeedbackResponse(provider=provider, **feedback.dict())


@router.post("/quick-match", response_model=QuickMatchResponse)
@limiter.limit("10/minute")
async def quick_job_match(
    request: Request,
    body: QuickMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Match a resume against a pasted job description without needing a saved job.
    Candidates can paste any JD text and get an instant AI analysis.
    """
    logger.info(
        "quick-match: entry — user_id=%d resume_id=%d job_title=%r jd_len=%d",
        current_user.id, body.resume_id, body.job_title, len(body.job_description),
    )
    try:
        resume = db.query(Resume).filter(Resume.id == body.resume_id).first()
        if not resume:
            logger.warning(
                "quick-match: resume_id=%d not found — user_id=%d",
                body.resume_id, current_user.id,
            )
            raise HTTPException(status_code=404, detail="Resume not found")
        if resume.user_id != current_user.id and current_user.role.value not in ("admin", "recruiter"):
            logger.warning(
                "quick-match: user_id=%d not authorized for resume_id=%d",
                current_user.id, body.resume_id,
            )
            raise HTTPException(status_code=403, detail="Not authorized")

        logger.info(
            "quick-match: resume found — id=%d raw_text_len=%d skills=%d",
            resume.id, len(resume.raw_text or ""), len(resume.extracted_skills or []),
        )

        svc = get_llm_service()
        logger.info(
            "quick-match: LLM provider=%r available=%s",
            svc.provider, svc.is_available,
        )

        exclude = qh.get_recent_set(db, current_user.id)
        try:
            result = await svc.quick_job_match(
                raw_text=resume.raw_text or "",
                job_title=body.job_title,
                job_description=body.job_description,
                skills=resume.extracted_skills or [],
                user_id=current_user.id,
                exclude=exclude,
            )
            provider = svc.provider if svc.is_available else "template"
            logger.info(
                "quick-match: svc returned OK — provider=%r match_score=%s",
                provider, result.get("match_score"),
            )
        except Exception:
            logger.exception(
                "quick-match: svc.quick_job_match raised — falling back to template"
            )
            result = LLMService._template_quick_match(
                body.job_title, user_id=current_user.id, exclude=exclude
            )
            provider = "template"

        qh.record_questions(db, current_user.id, result.get("interview_questions", []))
        response_obj = QuickMatchResponse(provider=provider, **result)
        logger.info(
            "quick-match: response built OK — score=%.1f provider=%r",
            response_obj.match_score, provider,
        )
        return response_obj

    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "quick-match: unhandled top-level exception — user_id=%d resume_id=%d",
            current_user.id, body.resume_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error during match analysis",
        )


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def career_chat(
    request: Request,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    AI career coaching chat. Optionally pass resume_id for context-aware advice.
    """
    resume_context = ""
    if body.resume_id:
        resume = db.query(Resume).filter(Resume.id == body.resume_id).first()
        if resume and (resume.user_id == current_user.id or current_user.role.value in ("admin", "recruiter")):
            parts = []
            if resume.candidate_name:
                parts.append(f"Candidate: {resume.candidate_name}")
            if resume.experience_years:
                parts.append(f"Experience: {resume.experience_years:.0f} years")
            if resume.education_level:
                parts.append(f"Education: {resume.education_level}")
            if resume.extracted_skills:
                parts.append(f"Skills: {', '.join(resume.extracted_skills[:20])}")
            if resume.ats_score:
                parts.append(f"ATS Score: {resume.ats_score:.0f}/100")
            resume_context = "\n".join(parts)

    svc = get_llm_service()
    try:
        reply = await svc.career_chat(
            message=body.message,
            resume_context=resume_context,
        )
        provider = svc.provider if svc.is_available else "template"
    except Exception:
        logger.exception("Unhandled error in career_chat; using template")
        reply = LLMService._template_chat_reply(body.message)
        provider = "template"

    return ChatResponse(reply=reply, provider=provider)
