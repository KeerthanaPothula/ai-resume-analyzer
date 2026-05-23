from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.job import JobDescription, ATSScore, CandidateRanking
from app.core.security import get_current_active_user
from app.services.ai.scoring_engine import calculate_ats_score, generate_interview_questions
from app.services.ai.skill_extractor import generate_skill_gap_analysis

router = APIRouter()


class RankingUpdate(BaseModel):
    shortlisted: Optional[bool] = None
    notes: Optional[str] = None


@router.post("/rank/{job_id}")
def rank_candidates_for_job(
    job_id: int,
    resume_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Rank a list of resumes against a job description."""
    if current_user.role not in ["recruiter", "admin"]:
        raise HTTPException(status_code=403, detail="Only recruiters can rank candidates")

    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    results = []
    for resume_id in resume_ids:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            continue

        # Get or create ATS score
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

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    # Delete old rankings for this job
    db.query(CandidateRanking).filter(CandidateRanking.job_id == job_id).delete()

    # Save rankings
    rankings = []
    for rank_idx, result in enumerate(results, start=1):
        ranking = CandidateRanking(
            job_id=job_id,
            resume_id=result["resume"].id,
            rank=rank_idx,
            score=result["score"],
        )
        db.add(ranking)
        rankings.append({
            "rank": rank_idx,
            "score": result["score"],
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
    import json
    results = []
    for r in rankings:
        resume = db.query(Resume).filter(Resume.id == r.resume_id).first()
        ats = db.query(ATSScore).filter(
            ATSScore.resume_id == r.resume_id, ATSScore.job_id == job_id
        ).first()
        try:
            meta = json.loads(r.notes or "{}")
        except Exception:
            meta = {}
        results.append({
            "ranking_id": r.id,
            "rank": r.rank,
            "score": r.score,
            "shortlisted": meta.get("shortlisted", False),
            "notes": meta.get("notes", ""),
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
        })
    return results


@router.patch("/{ranking_id}")
def update_ranking_entry(
    ranking_id: int,
    data: RankingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update shortlist status or notes for a ranking entry."""
    if current_user.role not in ["recruiter", "admin"]:
        raise HTTPException(status_code=403, detail="Only recruiters can update rankings")

    ranking = db.query(CandidateRanking).filter(CandidateRanking.id == ranking_id).first()
    if not ranking:
        raise HTTPException(status_code=404, detail="Ranking not found")

    import json
    try:
        meta = json.loads(ranking.notes or "{}")
    except Exception:
        meta = {}

    if data.shortlisted is not None:
        meta["shortlisted"] = data.shortlisted
    if data.notes is not None:
        meta["notes"] = data.notes

    ranking.notes = json.dumps(meta)
    db.commit()
    db.refresh(ranking)
    return {"id": ranking.id, "shortlisted": meta.get("shortlisted", False), "notes": meta.get("notes", "")}
