from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class ResumeResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    original_name: str
    file_type: str
    candidate_name: Optional[str]
    candidate_email: Optional[str]
    candidate_phone: Optional[str]
    candidate_location: Optional[str]
    extracted_skills: Optional[List[str]]
    experience_years: Optional[float]
    education_level: Optional[str]
    ats_score: Optional[float]
    summary: Optional[str]
    strengths: Optional[List[str]]
    weaknesses: Optional[List[str]]
    ai_feedback: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class JobDescriptionCreate(BaseModel):
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    description: str
    required_skills: Optional[List[str]] = []
    preferred_skills: Optional[List[str]] = []
    experience_required: Optional[float] = 0.0
    education_required: Optional[str] = None


class JobDescriptionResponse(BaseModel):
    id: int
    recruiter_id: int
    title: str
    company: Optional[str]
    location: Optional[str]
    description: str
    required_skills: Optional[List[str]]
    preferred_skills: Optional[List[str]]
    experience_required: Optional[float]
    education_required: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ATSScoreResponse(BaseModel):
    id: int
    resume_id: int
    job_id: int
    overall_score: float
    skill_match_score: float
    experience_score: float
    education_score: float
    semantic_similarity: float
    matched_skills: List[str]
    missing_skills: List[str]
    skill_gap_analysis: Dict[str, Any]
    interview_questions: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateRankingResponse(BaseModel):
    rank: int
    score: float
    resume: ResumeResponse
    ats_score: Optional[ATSScoreResponse]

    class Config:
        from_attributes = True
