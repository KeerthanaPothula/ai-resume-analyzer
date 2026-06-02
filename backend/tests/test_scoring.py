"""
ATS scoring engine unit tests — no HTTP, no DB, pure function calls.
"""

import pytest
from app.services.ai.scoring_engine import calculate_ats_score, generate_embedding
from app.services.ai.skill_extractor import (
    extract_skills_from_text,
    compute_skill_match,
    generate_skill_gap_analysis,
)


# ── calculate_ats_score ────────────────────────────────────────────────────────

def test_ats_score_is_within_valid_range():
    scores = calculate_ats_score(
        resume_text="Python developer with 3 years experience",
        job_text="Looking for Python developer",
        resume_skills=["Python", "FastAPI"],
        job_required_skills=["Python"],
        resume_experience=3.0,
        job_experience_required=2.0,
        resume_education="Bachelor's",
        job_education_required="Bachelor's",
        resume_embedding=None,
        job_embedding=None,
    )
    assert 0 <= scores["overall_score"] <= 100


def test_ats_perfect_skill_match_scores_100_on_skill_component():
    scores = calculate_ats_score(
        resume_text="Python developer",
        job_text="Need Python developer",
        resume_skills=["Python", "FastAPI", "SQL"],
        job_required_skills=["Python"],  # candidate has all required skills
        resume_experience=5.0,
        job_experience_required=3.0,
        resume_education="Master's",
        job_education_required="Bachelor's",
        resume_embedding=None,
        job_embedding=None,
    )
    assert scores["skill_match_score"] == 100.0


def test_ats_zero_required_experience_gives_full_experience_score():
    scores = calculate_ats_score(
        resume_text="",
        job_text="",
        resume_skills=[],
        job_required_skills=[],
        resume_experience=0.0,
        job_experience_required=0.0,
        resume_education="Not Specified",
        job_education_required=None,
        resume_embedding=None,
        job_embedding=None,
    )
    assert scores["experience_score"] == 100.0


def test_ats_missing_all_skills_gives_zero_skill_score():
    scores = calculate_ats_score(
        resume_text="",
        job_text="",
        resume_skills=[],
        job_required_skills=["Python", "React", "SQL"],
        resume_experience=0.0,
        job_experience_required=5.0,
        resume_education="Not Specified",
        job_education_required="PhD",
        resume_embedding=None,
        job_embedding=None,
    )
    assert scores["skill_match_score"] == 0.0


def test_ats_insufficient_experience_reduces_score():
    scores = calculate_ats_score(
        resume_text="",
        job_text="",
        resume_skills=["Python"],
        job_required_skills=["Python"],
        resume_experience=1.0,
        job_experience_required=5.0,
        resume_education="Bachelor's",
        job_education_required="Bachelor's",
        resume_embedding=None,
        job_embedding=None,
    )
    assert scores["experience_score"] < 100.0
    assert scores["experience_score"] == pytest.approx(20.0, abs=1.0)


def test_ats_returns_matched_and_missing_skills():
    scores = calculate_ats_score(
        resume_text="Python developer",
        job_text="Need Python and React developer",
        resume_skills=["Python"],
        job_required_skills=["Python", "React"],
        resume_experience=3.0,
        job_experience_required=3.0,
        resume_education="Bachelor's",
        job_education_required="Bachelor's",
        resume_embedding=None,
        job_embedding=None,
    )
    # Skills are normalized to lowercase internally
    matched_lower = [s.lower() for s in scores["matched_skills"]]
    missing_lower = [s.lower() for s in scores["missing_skills"]]
    assert "python" in matched_lower
    assert "react" in missing_lower


# ── Skill extraction ───────────────────────────────────────────────────────────

def test_skill_extractor_finds_known_technologies():
    text = "I have 3 years of experience with Python, React, and PostgreSQL."
    skills = extract_skills_from_text(text)
    # Extractor normalizes to lowercase
    assert "python" in skills
    assert "react" in skills
    assert "postgresql" in skills


def test_skill_extractor_returns_list():
    skills = extract_skills_from_text("")
    assert isinstance(skills, list)


# ── compute_skill_match ────────────────────────────────────────────────────────

def test_compute_skill_match_partial():
    # Positional args: (resume_skills, job_skills)
    result = compute_skill_match(
        ["Python", "SQL"],
        ["Python", "SQL", "React"],
    )
    assert result["match_score"] == pytest.approx(66.67, abs=1.0)
    assert "react" in result["missing_skills"]
    assert "python" in result["matched_skills"]


def test_compute_skill_match_empty_job_skills():
    # When no skills are required, matched = empty ∩ empty = 0,
    # so score = 0 / max(0,1) * 100 = 0. No requirements → no penalty elsewhere.
    result = compute_skill_match(["Python"], [])
    assert result["match_score"] == 0.0
    assert result["missing_skills"] == []


# ── generate_skill_gap_analysis ────────────────────────────────────────────────

def test_skill_gap_analysis_has_expected_keys():
    # Positional args: (matched, missing)
    result = generate_skill_gap_analysis(["Python"], ["React", "SQL"])
    for key in ("gap_percentage", "critical_missing", "recommendations", "overall_assessment"):
        assert key in result


# ── Embedding ──────────────────────────────────────────────────────────────────

def test_generate_embedding_returns_none_when_model_disabled():
    # ENABLE_EMBEDDINGS=false in test env — model is not loaded
    result = generate_embedding("Some text about Python development")
    assert result is None
