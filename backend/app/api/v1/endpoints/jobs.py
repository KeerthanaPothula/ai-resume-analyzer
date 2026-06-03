from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.models.job import JobDescription, ATSScore, CandidateRanking
from app.schemas.resume import JobDescriptionCreate, JobDescriptionResponse
from app.core.security import get_current_active_user
from app.services.ai.skill_extractor import extract_skills_from_text
from app.services.ai.scoring_engine import generate_embedding

router = APIRouter()


@router.post("/", response_model=JobDescriptionResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    job_data: JobDescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role.value not in ("recruiter", "admin"):
        raise HTTPException(status_code=403, detail="Only recruiters can post jobs")

    # Extract skills from description if not provided
    required_skills = job_data.required_skills
    if not required_skills:
        required_skills = extract_skills_from_text(job_data.description)

    # Generate embedding
    embedding = generate_embedding(job_data.description)

    job = JobDescription(
        recruiter_id=current_user.id,
        title=job_data.title,
        company=job_data.company,
        location=job_data.location,
        description=job_data.description,
        required_skills=required_skills,
        preferred_skills=job_data.preferred_skills or [],
        experience_required=job_data.experience_required or 0.0,
        education_required=job_data.education_required,
        embedding=embedding,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/", response_model=List[JobDescriptionResponse])
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role.value == "recruiter":
        return (
            db.query(JobDescription)
            .filter(JobDescription.recruiter_id == current_user.id)
            .offset(skip).limit(limit).all()
        )
    return db.query(JobDescription).offset(skip).limit(limit).all()


@router.get("/{job_id}", response_model=JobDescriptionResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/{job_id}", response_model=JobDescriptionResponse)
def update_job(
    job_id: int,
    job_data: JobDescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    description_changed = job_data.description != job.description
    required_skills = job_data.required_skills
    if not required_skills and description_changed:
        required_skills = extract_skills_from_text(job_data.description)

    job.title = job_data.title
    job.company = job_data.company
    job.location = job_data.location
    job.description = job_data.description
    job.required_skills = required_skills or job.required_skills
    job.preferred_skills = job_data.preferred_skills or []
    job.experience_required = job_data.experience_required or 0.0
    job.education_required = job_data.education_required

    if description_changed:
        job.embedding = generate_embedding(job_data.description)

    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    # Cascade: remove ATS scores and rankings that reference this job
    db.query(ATSScore).filter(ATSScore.job_id == job_id).delete()
    db.query(CandidateRanking).filter(CandidateRanking.job_id == job_id).delete()
    db.delete(job)
    db.commit()
