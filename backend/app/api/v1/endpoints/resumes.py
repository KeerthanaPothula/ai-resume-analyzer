import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.schemas.resume import ResumeResponse
from app.core.security import get_current_active_user
from app.core.config import settings
from app.services.parsers.resume_parser import parse_resume_file
from app.services.ai.skill_extractor import extract_skills_from_text
from app.services.ai.scoring_engine import generate_embedding, generate_ai_feedback

router = APIRouter()

ALLOWED_TYPES = {"application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"}


@router.post("/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Validate file type
    content_type = file.content_type
    file_ext = None
    if content_type in ALLOWED_TYPES:
        file_ext = ALLOWED_TYPES[content_type]
    elif file.filename.endswith(".pdf"):
        file_ext = "pdf"
    elif file.filename.endswith(".docx"):
        file_ext = "docx"
    else:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    # Check file size
    contents = await file.read()
    if len(contents) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit")

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    try:
        # Parse resume
        parsed = parse_resume_file(file_path, file_ext)
        raw_text = parsed.get("raw_text", "")

        # Extract skills
        skills = extract_skills_from_text(raw_text)

        # Generate embedding
        embedding = generate_embedding(raw_text)

        # Compute general ATS score
        general_score = min(100.0, len(skills) * 5.0 + 20.0)

        # Generate feedback
        feedback = generate_ai_feedback(
            parsed.get("candidate_name") or current_user.full_name,
            general_score,
            skills[:10],
            [],
            parsed.get("experience_years", 0.0),
            parsed.get("education_level", "Not Specified"),
        )

        # Create resume record
        resume = Resume(
            user_id=current_user.id,
            filename=unique_filename,
            file_path=file_path,
            file_type=file_ext,
            original_name=file.filename,
            raw_text=raw_text,
            candidate_name=parsed.get("candidate_name"),
            candidate_email=parsed.get("candidate_email"),
            candidate_phone=parsed.get("candidate_phone"),
            candidate_location=parsed.get("candidate_location"),
            extracted_skills=skills,
            experience_years=parsed.get("experience_years", 0.0),
            education_level=parsed.get("education_level"),
            ats_score=general_score,
            embedding=embedding,
            ai_feedback=feedback,
            strengths=skills[:5],
            weaknesses=[],
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)
        return resume

    except Exception as e:
        # Clean up file on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process resume: {str(e)}")


@router.get("/", response_model=List[ResumeResponse])
def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role == "admin":
        return db.query(Resume).all()
    return db.query(Resume).filter(Resume.user_id == current_user.id).all()


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id and current_user.role not in ["admin", "recruiter"]:
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
    if resume.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    if os.path.exists(resume.file_path):
        os.remove(resume.file_path)
    db.delete(resume)
    db.commit()
