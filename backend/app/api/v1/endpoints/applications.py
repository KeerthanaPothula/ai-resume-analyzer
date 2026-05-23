from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.job import JobDescription, ATSScore, CandidateRanking, ApplicationStatus
from app.models.notification import Notification, NotificationType
from app.core.security import get_current_active_user
from app.services.ai.scoring_engine import calculate_ats_score, generate_interview_questions
from app.services.ai.skill_extractor import generate_skill_gap_analysis

router = APIRouter()


class ApplyRequest(BaseModel):
    job_id: int
    resume_id: int


@router.post("/apply")
def apply_to_job(
    body: ApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role.value not in ("candidate", "admin"):
        raise HTTPException(status_code=403, detail="Only candidates can apply to jobs")

    # Validate resume belongs to this user
    resume = db.query(Resume).filter(
        Resume.id == body.resume_id,
        Resume.user_id == current_user.id,
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Validate job exists
    job = db.query(JobDescription).filter(JobDescription.id == body.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Prevent duplicate applications
    existing = db.query(CandidateRanking).filter(
        CandidateRanking.resume_id == body.resume_id,
        CandidateRanking.job_id == body.job_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already applied to this job with this resume")

    # Calculate or fetch ATS score
    ats = db.query(ATSScore).filter(
        ATSScore.resume_id == body.resume_id,
        ATSScore.job_id == body.job_id,
    ).first()

    if not ats:
        scores = calculate_ats_score(
            resume_text=resume.raw_text or "",
            job_text=job.description,
            resume_skills=resume.extracted_skills or [],
            job_required_skills=job.required_skills or [],
            resume_experience=resume.experience_years or 0.0,
            job_experience_required=job.experience_required or 0.0,
            resume_education=resume.education_level or "Not Specified",
            job_education_required=job.education_required,
            resume_embedding=resume.embedding,
            job_embedding=job.embedding,
        )
        skill_gap = generate_skill_gap_analysis(scores["matched_skills"], scores["missing_skills"])
        questions = generate_interview_questions(
            job.title, job.required_skills or [], scores["missing_skills"], job.description
        )
        ats = ATSScore(
            resume_id=body.resume_id,
            job_id=body.job_id,
            overall_score=scores["overall_score"],
            skill_match_score=scores["skill_match_score"],
            experience_score=scores["experience_score"],
            education_score=scores["education_score"],
            semantic_similarity=scores["semantic_similarity"],
            matched_skills=scores["matched_skills"],
            missing_skills=scores["missing_skills"],
            skill_gap_analysis=skill_gap,
            interview_questions=questions,
        )
        db.add(ats)
        db.flush()

    # Determine rank (append at bottom)
    count = db.query(CandidateRanking).filter(CandidateRanking.job_id == body.job_id).count()

    ranking = CandidateRanking(
        job_id=body.job_id,
        resume_id=body.resume_id,
        rank=count + 1,
        score=ats.overall_score,
        application_status=ApplicationStatus.applied,
        shortlisted=False,
    )
    db.add(ranking)
    db.flush()

    # Notify the recruiter
    candidate_name = resume.candidate_name or current_user.full_name
    recruiter_notification = Notification(
        user_id=job.recruiter_id,
        title="New Application Received",
        message=f"{candidate_name} applied to \"{job.title}\"",
        type=NotificationType.application_received,
        action_url=f"/ranking/{job.id}",
        read=False,
    )
    db.add(recruiter_notification)

    db.commit()
    db.refresh(ranking)

    return {
        "ranking_id": ranking.id,
        "job_id": job.id,
        "job_title": job.title,
        "company": job.company,
        "resume_id": body.resume_id,
        "score": ranking.score,
        "application_status": ranking.application_status.value,
        "matched_skills": ats.matched_skills or [],
        "missing_skills": ats.missing_skills or [],
        "skill_match_score": ats.skill_match_score or 0,
        "semantic_similarity": ats.semantic_similarity or 0,
    }
