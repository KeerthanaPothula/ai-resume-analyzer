from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.job import JobDescription, ATSScore
from app.schemas.resume import ATSScoreResponse
from app.core.security import get_current_active_user
from app.services.ai.scoring_engine import (
    calculate_ats_score, generate_interview_questions, generate_ai_feedback
)
from app.services.ai.skill_extractor import generate_skill_gap_analysis

router = APIRouter()


@router.post("/score/{resume_id}/{job_id}", response_model=ATSScoreResponse)
def score_resume_against_job(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if score already exists
    existing = db.query(ATSScore).filter(
        ATSScore.resume_id == resume_id,
        ATSScore.job_id == job_id
    ).first()
    if existing:
        return existing

    # Calculate ATS score
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

    # Generate interview questions
    questions = generate_interview_questions(
        job_title=job.title,
        required_skills=job.required_skills or [],
        missing_skills=scores["missing_skills"],
        job_description=job.description,
    )

    # Skill gap analysis
    skill_gap = generate_skill_gap_analysis(
        matched=scores["matched_skills"],
        missing=scores["missing_skills"],
    )

    # Update resume ATS score
    resume.ats_score = scores["overall_score"]
    resume.ai_feedback = generate_ai_feedback(
        candidate_name=resume.candidate_name or "Candidate",
        overall_score=scores["overall_score"],
        matched_skills=scores["matched_skills"],
        missing_skills=scores["missing_skills"],
        experience_years=resume.experience_years or 0.0,
        education=resume.education_level or "Not Specified",
    )
    db.add(resume)

    ats_score = ATSScore(
        resume_id=resume_id,
        job_id=job_id,
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
    db.add(ats_score)
    db.commit()
    db.refresh(ats_score)
    return ats_score


@router.get("/scores/resume/{resume_id}", response_model=List[ATSScoreResponse])
def get_resume_scores(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return db.query(ATSScore).filter(ATSScore.resume_id == resume_id).all()


@router.get("/scores/job/{job_id}", response_model=List[ATSScoreResponse])
def get_job_scores(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return db.query(ATSScore).filter(ATSScore.job_id == job_id).all()
