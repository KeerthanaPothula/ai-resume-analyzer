import asyncio
import logging
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.job import ATSScore, CandidateRanking
from app.schemas.resume import ResumeResponse
from app.core.security import get_current_active_user
from app.core.config import settings
from app.services.parsers.resume_parser import parse_resume_file
from app.services.ai.skill_extractor import extract_skills_from_text
from app.services.ai.scoring_engine import (
    generate_embedding,
    generate_ai_feedback,
    calculate_general_ats_score,
    extract_resume_summary,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _analyse_resume(file_path: str, file_ext: str, user_full_name: str) -> dict:
    """CPU-bound resume pipeline — runs in a thread pool via asyncio.to_thread."""
    logger.info("upload: parsing %s (%s)", file_path, file_ext)
    parsed = parse_resume_file(file_path, file_ext)
    raw_text: str = parsed.get("raw_text", "")
    logger.info("upload: text extracted (%d chars)", len(raw_text))

    skills = extract_skills_from_text(raw_text)
    logger.info("upload: %d skills extracted", len(skills))

    embedding = generate_embedding(raw_text)
    logger.info("upload: embedding %s", "generated" if embedding else "skipped (model loading)")

    general = calculate_general_ats_score(
        skills=skills,
        experience_years=parsed.get("experience_years", 0.0),
        education_level=parsed.get("education_level", "Not Specified"),
        candidate_name=parsed.get("candidate_name"),
        candidate_email=parsed.get("candidate_email"),
        candidate_phone=parsed.get("candidate_phone"),
        candidate_location=parsed.get("candidate_location"),
        raw_text=raw_text,
    )
    logger.info("upload: ATS score %.1f", general["overall"])

    summary = extract_resume_summary(raw_text)

    feedback = generate_ai_feedback(
        candidate_name=parsed.get("candidate_name") or user_full_name,
        overall_score=general["overall"],
        matched_skills=skills[:10],
        missing_skills=[w for w in general["weaknesses"] if len(w) < 60][:3],
        experience_years=parsed.get("experience_years", 0.0),
        education=parsed.get("education_level", "Not Specified"),
    )

    return {
        **parsed,
        "skills": skills,
        "embedding": embedding,
        "general": general,
        "summary": summary,
        "feedback": feedback,
    }


ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


@router.post("/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    logger.info("upload: user_id=%d", current_user.id)
    # ── Validate file type ────────────────────────────────────────────────────
    file_ext = ALLOWED_TYPES.get(file.content_type or "")
    if not file_ext:
        if file.filename and file.filename.lower().endswith(".pdf"):
            file_ext = "pdf"
        elif file.filename and file.filename.lower().endswith(".docx"):
            file_ext = "docx"
        else:
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    # ── Check file size ───────────────────────────────────────────────────────
    contents = await file.read()
    if len(contents) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB} MB limit",
        )

    # ── Save file ─────────────────────────────────────────────────────────────
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_name = (file.filename or "resume").replace(" ", "_")
    unique_filename = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    try:
        logger.info(
            "upload: starting analysis for user_id=%d file=%s",
            current_user.id, unique_filename,
        )
        db.close()  # release connection before CPU-bound analysis (same pattern as ai_feedback.py)
        result = await asyncio.to_thread(
            _analyse_resume, file_path, file_ext, current_user.full_name
        )
        logger.info("upload: analysis complete, persisting to DB")

        resume = Resume(
            user_id=current_user.id,
            filename=unique_filename,
            file_path=file_path,
            file_type=file_ext,
            original_name=file.filename or safe_name,
            raw_text=result["raw_text"],
            candidate_name=result.get("candidate_name"),
            candidate_email=result.get("candidate_email"),
            candidate_phone=result.get("candidate_phone"),
            candidate_location=result.get("candidate_location"),
            extracted_skills=result["skills"],
            experience_years=result.get("experience_years", 0.0),
            education_level=result.get("education_level"),
            ats_score=result["general"]["overall"],
            embedding=result["embedding"],
            summary=result["summary"],
            ai_feedback=result["feedback"],
            strengths=result["general"]["strengths"],
            weaknesses=result["general"]["weaknesses"],
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)
        logger.info("upload: resume id=%d saved OK", resume.id)
        return resume

    except Exception as e:
        logger.error("upload: failed — %s: %s", type(e).__name__, e)
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process resume: {str(e)}")


@router.get("/", response_model=List[ResumeResponse])
def list_resumes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role.value in ("admin", "recruiter"):
        return db.query(Resume).offset(skip).limit(limit).all()
    return db.query(Resume).filter(Resume.user_id == current_user.id).offset(skip).limit(limit).all()


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id and current_user.role.value not in ("admin", "recruiter"):
        raise HTTPException(status_code=403, detail="Not authorized")
    return resume


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    if os.path.exists(resume.file_path):
        os.remove(resume.file_path)
    # Cascade: remove ATS scores and rankings that reference this resume
    db.query(ATSScore).filter(ATSScore.resume_id == resume_id).delete()
    db.query(CandidateRanking).filter(CandidateRanking.resume_id == resume_id).delete()
    db.delete(resume)
    db.commit()


@router.get("/{resume_id}/file")
def download_resume_file(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Download the original resume file.

    Accessible only by the resume owner, recruiters, or admins.
    Replaces the former unauthenticated /uploads/<filename> static mount.
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id and current_user.role.value not in ("admin", "recruiter"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not os.path.exists(resume.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    media_type = "application/pdf" if resume.file_type == "pdf" else (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return FileResponse(
        path=resume.file_path,
        media_type=media_type,
        filename=resume.original_name,
    )
