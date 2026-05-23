import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    company = Column(String)
    location = Column(String)
    description = Column(Text, nullable=False)
    required_skills = Column(JSON, default=list)
    preferred_skills = Column(JSON, default=list)
    experience_required = Column(Float, default=0.0)
    education_required = Column(String)
    embedding = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    recruiter = relationship("User", back_populates="job_descriptions")
    ats_scores = relationship("ATSScore", back_populates="job", cascade="all, delete-orphan")
    rankings = relationship("CandidateRanking", back_populates="job", cascade="all, delete-orphan")


class ATSScore(Base):
    __tablename__ = "ats_scores"

    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)

    overall_score = Column(Float, default=0.0)
    skill_match_score = Column(Float, default=0.0)
    experience_score = Column(Float, default=0.0)
    education_score = Column(Float, default=0.0)
    semantic_similarity = Column(Float, default=0.0)

    matched_skills = Column(JSON, default=list)
    missing_skills = Column(JSON, default=list)
    skill_gap_analysis = Column(JSON, default=dict)
    interview_questions = Column(JSON, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resume = relationship("Resume", back_populates="ats_scores")
    job = relationship("JobDescription", back_populates="ats_scores")


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    under_review = "under_review"
    shortlisted = "shortlisted"
    interview_scheduled = "interview_scheduled"
    rejected = "rejected"
    accepted = "accepted"


class CandidateRanking(Base):
    __tablename__ = "candidate_rankings"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    rank = Column(Integer)
    score = Column(Float, default=0.0)

    # Application tracking — proper columns replacing the JSON-blob hack
    application_status = Column(
        SAEnum(ApplicationStatus, name="applicationstatus"),
        default=ApplicationStatus.applied,
        nullable=False,
        server_default=ApplicationStatus.applied.value,
    )
    shortlisted = Column(Boolean, default=False, nullable=False, server_default="0")
    recruiter_notes = Column(Text, nullable=True)
    interview_date = Column(DateTime(timezone=True), nullable=True)
    meeting_link = Column(String, nullable=True)
    interview_instructions = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    job = relationship("JobDescription", back_populates="rankings")
    resume = relationship("Resume", back_populates="rankings")
