from pydantic import BaseModel
from typing import List, Optional


class ResumeFeedbackResponse(BaseModel):
    provider: str
    summary: str
    improvement_suggestions: List[str]
    missing_skills: List[str]
    ats_optimization_tips: List[str]
    overall_assessment: str
    interview_questions: List[str]


class JobMatchFeedbackResponse(BaseModel):
    provider: str
    match_analysis: str
    missing_skills: List[str]
    interview_questions: List[str]
    ats_tips: List[str]
    recommendation: str


class QuickMatchRequest(BaseModel):
    resume_id: int
    job_title: str
    job_description: str


class QuickMatchResponse(BaseModel):
    provider: str
    match_score: float
    match_analysis: str
    matched_skills: List[str]
    missing_skills: List[str]
    strengths: List[str]
    growth_areas: List[str]
    interview_questions: List[str]
    ats_tips: List[str]
    recommendation: str


class ChatRequest(BaseModel):
    message: str
    resume_id: Optional[int] = None
    history: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    reply: str
    provider: str


class LLMStatusResponse(BaseModel):
    available: bool
    provider: str
