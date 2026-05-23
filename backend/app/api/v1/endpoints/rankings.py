from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
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


# ── Schemas ───────────────────────────────────────────────────────────────────

class RankingUpdate(BaseModel):
    shortlisted: Optional[bool] = None
    notes: Optional[str] = None
    application_status: Optional[str] = None
    interview_date: Optional[str] = None   # ISO 8601 string or null
    meeting_link: Optional[str] = None
    interview_instructions: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ranking_to_dict(r: CandidateRanking, resume: Resume, ats: Optional[ATSScore]) -> dict:
    return {
        "ranking_id": r.id,
        "rank": r.rank,
        "score": r.score,
        "application_status": r.application_status.value if r.application_status else "applied",
        "shortlisted": r.shortlisted or False,
        "recruiter_notes": r.recruiter_notes or "",
        "interview_date": r.interview_date.isoformat() if r.interview_date else None,
        "meeting_link": r.meeting_link or "",
        "interview_instructions": r.interview_instructions or "",
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        "resume_id": resume.id if resume else None,
        "candidate_name": resume.candidate_name if resume else None,
        "candidate_email": resume.candidate_email if resume else None,
        "skills": resume.extracted_skills or [] if resume else [],
        "experience_years": resume.experience_years if resume else 0,
        "education_level": resume.education_level if resume else None,
        "matched_skills": ats.matched_skills or [] if ats else [],
        "missing_skills": ats.missing_skills or [] if ats else [],
        "skill_match_score": ats.skill_match_score or 0 if ats else 0,
        "semantic_similarity": ats.semantic_similarity or 0 if ats else 0,
        "interview_questions": ats.interview_questions or [] if ats else [],
    }


# ── POST /rank/{job_id} ────────────────────────────────────────────────────────

@router.post("/rank/{job_id}")
def rank_candidates_for_job(
    job_id: int,
    resume_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role.value not in ("recruiter", "admin"):
        raise HTTPException(status_code=403, detail="Only recruiters can rank candidates")

    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    results = []
    for resume_id in resume_ids:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            continue

        ats = db.query(ATSScore).filter(
            ATSScore.resume_id == resume_id,
            ATSScore.job_id == job_id
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
            skill_gap = generate_skill_gap_analysis(
                scores["matched_skills"], scores["missing_skills"]
            )
            questions = generate_interview_questions(
                job.title, job.required_skills or [], scores["missing_skills"], job.description
            )
            ats = ATSScore(
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
            db.add(ats)
            db.commit()
            db.refresh(ats)

        results.append({"resume": resume, "ats": ats, "score": ats.overall_score})

    results.sort(key=lambda x: x["score"], reverse=True)

    # Preserve existing ranking metadata (status, notes, etc.) when re-ranking
    existing_meta: dict[int, CandidateRanking] = {
        r.resume_id: r
        for r in db.query(CandidateRanking).filter(CandidateRanking.job_id == job_id).all()
    }

    db.query(CandidateRanking).filter(CandidateRanking.job_id == job_id).delete()

    rankings = []
    for rank_idx, result in enumerate(results, start=1):
        prev = existing_meta.get(result["resume"].id)
        ranking = CandidateRanking(
            job_id=job_id,
            resume_id=result["resume"].id,
            rank=rank_idx,
            score=result["score"],
            # Preserve recruiter decisions across re-ranks
            application_status=prev.application_status if prev else ApplicationStatus.applied,
            shortlisted=prev.shortlisted if prev else False,
            recruiter_notes=prev.recruiter_notes if prev else None,
            interview_date=prev.interview_date if prev else None,
            meeting_link=prev.meeting_link if prev else None,
            interview_instructions=prev.interview_instructions if prev else None,
        )
        db.add(ranking)
        rankings.append({
            "rank": rank_idx,
            "score": result["score"],
            "application_status": ranking.application_status.value,
            "shortlisted": ranking.shortlisted,
            "resume_id": result["resume"].id,
            "candidate_name": result["resume"].candidate_name,
            "candidate_email": result["resume"].candidate_email,
            "skills": result["resume"].extracted_skills or [],
            "experience_years": result["resume"].experience_years,
            "education_level": result["resume"].education_level,
            "matched_skills": result["ats"].matched_skills,
            "missing_skills": result["ats"].missing_skills,
            "skill_match_score": result["ats"].skill_match_score,
            "semantic_similarity": result["ats"].semantic_similarity,
        })

    db.commit()
    return {"job_id": job_id, "total_candidates": len(rankings), "rankings": rankings}


# ── GET /job/{job_id} ──────────────────────────────────────────────────────────

@router.get("/job/{job_id}")
def get_rankings_for_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rankings = (
        db.query(CandidateRanking)
        .filter(CandidateRanking.job_id == job_id)
        .order_by(CandidateRanking.rank)
        .all()
    )
    results = []
    for r in rankings:
        resume = db.query(Resume).filter(Resume.id == r.resume_id).first()
        ats = db.query(ATSScore).filter(
            ATSScore.resume_id == r.resume_id, ATSScore.job_id == job_id
        ).first()
        results.append(_ranking_to_dict(r, resume, ats))
    return results


# ── GET /my-applications — candidate sees their own application statuses ───────

@router.get("/my-applications")
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return all ranking entries for the current user's resumes (candidate view)."""
    resumes = db.query(Resume).filter(Resume.user_id == current_user.id).all()
    resume_ids = [r.id for r in resumes]
    resume_map = {r.id: r for r in resumes}

    if not resume_ids:
        return []

    rankings = (
        db.query(CandidateRanking)
        .filter(CandidateRanking.resume_id.in_(resume_ids))
        .order_by(CandidateRanking.updated_at.desc().nullslast(), CandidateRanking.created_at.desc())
        .all()
    )

    results = []
    for r in rankings:
        job = db.query(JobDescription).filter(JobDescription.id == r.job_id).first()
        resume = resume_map.get(r.resume_id)
        results.append({
            "ranking_id": r.id,
            "job_id": r.job_id,
            "job_title": job.title if job else "Unknown",
            "company": job.company if job else None,
            "location": job.location if job else None,
            "resume_id": r.resume_id,
            "resume_name": resume.original_name if resume else None,
            "rank": r.rank,
            "score": r.score,
            "application_status": r.application_status.value if r.application_status else "applied",
            "shortlisted": r.shortlisted or False,
            "recruiter_notes": r.recruiter_notes or "",
            "interview_date": r.interview_date.isoformat() if r.interview_date else None,
            "meeting_link": r.meeting_link or "",
            "interview_instructions": r.interview_instructions or "",
            "applied_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return results


# ── PATCH /{ranking_id} ────────────────────────────────────────────────────────

@router.patch("/{ranking_id}")
def update_ranking_entry(
    ranking_id: int,
    data: RankingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role.value not in ("recruiter", "admin"):
        raise HTTPException(status_code=403, detail="Only recruiters can update rankings")

    ranking = db.query(CandidateRanking).filter(CandidateRanking.id == ranking_id).first()
    if not ranking:
        raise HTTPException(status_code=404, detail="Ranking not found")

    if data.shortlisted is not None:
        ranking.shortlisted = data.shortlisted
        # Auto-sync status with shortlist toggle
        if data.shortlisted and ranking.application_status == ApplicationStatus.applied:
            ranking.application_status = ApplicationStatus.shortlisted

    if data.notes is not None:
        ranking.recruiter_notes = data.notes

    if data.application_status is not None:
        try:
            ranking.application_status = ApplicationStatus(data.application_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {data.application_status}")
        # Keep shortlisted in sync
        if ranking.application_status == ApplicationStatus.shortlisted:
            ranking.shortlisted = True
        elif ranking.application_status in (ApplicationStatus.rejected,):
            ranking.shortlisted = False

    if data.interview_date is not None:
        if data.interview_date == "":
            ranking.interview_date = None
        else:
            try:
                ranking.interview_date = datetime.fromisoformat(data.interview_date.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid interview_date format; use ISO 8601")

    if data.meeting_link is not None:
        ranking.meeting_link = data.meeting_link or None

    if data.interview_instructions is not None:
        ranking.interview_instructions = data.interview_instructions or None

    # Notify the candidate when status changes
    resume = db.query(Resume).filter(Resume.id == ranking.resume_id).first()
    job = db.query(JobDescription).filter(JobDescription.id == ranking.job_id).first()
    if resume and job and data.application_status is not None:
        status_val = ranking.application_status.value
        status_messages = {
            ApplicationStatus.shortlisted.value: (
                "You've been shortlisted!",
                f"Great news! You've been shortlisted for \"{job.title}\" at {job.company or 'the company'}.",
                NotificationType.shortlisted,
            ),
            ApplicationStatus.interview_scheduled.value: (
                "Interview Scheduled",
                f"Your interview for \"{job.title}\" at {job.company or 'the company'} has been scheduled.",
                NotificationType.interview_scheduled,
            ),
            ApplicationStatus.rejected.value: (
                "Application Update",
                f"Thank you for applying to \"{job.title}\" at {job.company or 'the company'}. The position has been filled.",
                NotificationType.rejected,
            ),
            ApplicationStatus.accepted.value: (
                "Congratulations!",
                f"Your application for \"{job.title}\" at {job.company or 'the company'} has been accepted!",
                NotificationType.accepted,
            ),
            ApplicationStatus.under_review.value: (
                "Application Under Review",
                f"Your application for \"{job.title}\" at {job.company or 'the company'} is now under review.",
                NotificationType.status_updated,
            ),
        }
        if status_val in status_messages:
            title, message, ntype = status_messages[status_val]
            candidate_user_id = resume.user_id
            notification = Notification(
                user_id=candidate_user_id,
                title=title,
                message=message,
                type=ntype,
                action_url="/candidate",
                read=False,
            )
            db.add(notification)

    db.commit()
    db.refresh(ranking)

    return {
        "id": ranking.id,
        "application_status": ranking.application_status.value,
        "shortlisted": ranking.shortlisted,
        "recruiter_notes": ranking.recruiter_notes or "",
        "interview_date": ranking.interview_date.isoformat() if ranking.interview_date else None,
        "meeting_link": ranking.meeting_link or "",
        "interview_instructions": ranking.interview_instructions or "",
    }
