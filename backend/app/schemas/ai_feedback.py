from pydantic import BaseModel
from typing import List


class ResumeFeedbackResponse(BaseModel):
    provider: str
    summary: str
    improvement_suggestions: List[str]
    missing_skills: List[str]
    ats_optimization_tips: List[str]
    overall_assessment: str


class JobMatchFeedbackResponse(BaseModel):
    provider: str
    match_analysis: str
    missing_skills: List[str]
    interview_questions: List[str]
    ats_tips: List[str]
    recommendation: str


class LLMStatusResponse(BaseModel):
    available: bool
    provider: str
