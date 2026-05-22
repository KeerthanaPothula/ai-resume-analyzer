from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # pdf or docx
    original_name = Column(String, nullable=False)

    # Parsed content
    raw_text = Column(Text)
    candidate_name = Column(String)
    candidate_email = Column(String)
    candidate_phone = Column(String)
    candidate_location = Column(String)

    # AI analysis
    extracted_skills = Column(JSON, default=list)
    experience_years = Column(Float, default=0.0)
    education_level = Column(String)
    ats_score = Column(Float, default=0.0)
    embedding = Column(JSON)  # stored as list

    # Summary
    summary = Column(Text)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)
    ai_feedback = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="resumes")
    ats_scores = relationship("ATSScore", back_populates="resume", cascade="all, delete-orphan")
    rankings = relationship("CandidateRanking", back_populates="resume", cascade="all, delete-orphan")
