import logging
import re
import threading
import numpy as np
from typing import List, Dict, Optional, Tuple
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

_embedding_model = None
_model_loading = False
_model_load_done = False


def preload_embedding_model() -> None:
    """Start loading the SentenceTransformer model in a background thread.
    Call once at startup so the model is ready before the first upload request.
    """
    global _model_loading
    if _model_loading:
        return
    _model_loading = True
    t = threading.Thread(target=_load_model_sync, daemon=True)
    t.start()
    logger.info("SentenceTransformer: background load started")


def _load_model_sync() -> None:
    global _embedding_model, _model_load_done
    try:
        import os
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        logger.info("SentenceTransformer: loading all-MiniLM-L6-v2 ...")
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("SentenceTransformer: ready")
    except Exception as exc:
        logger.warning("SentenceTransformer: failed to load — %s", exc)
    finally:
        _model_load_done = True


def get_embedding_model():
    """Return the loaded model, or None if not yet ready. Never blocks."""
    return _embedding_model


def generate_embedding(text: str) -> Optional[List[float]]:
    """Generate sentence embedding for text."""
    model = get_embedding_model()
    if model is None:
        return None
    try:
        # Truncate to avoid token limit
        text = text[:5000]
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except Exception:
        return None


def compute_semantic_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """Compute cosine similarity between two embeddings."""
    if not embedding1 or not embedding2:
        return 0.0
    try:
        e1 = np.array(embedding1).reshape(1, -1)
        e2 = np.array(embedding2).reshape(1, -1)
        similarity = cosine_similarity(e1, e2)[0][0]
        return round(float(similarity) * 100, 2)
    except Exception:
        return 0.0


def calculate_ats_score(
    resume_text: str,
    job_text: str,
    resume_skills: List[str],
    job_required_skills: List[str],
    resume_experience: float,
    job_experience_required: float,
    resume_education: str,
    job_education_required: Optional[str],
    resume_embedding: Optional[List[float]],
    job_embedding: Optional[List[float]],
) -> Dict:
    """Calculate comprehensive ATS score."""

    # 1. Skill match score (40% weight)
    from app.services.ai.skill_extractor import compute_skill_match
    skill_data = compute_skill_match(resume_skills, job_required_skills)
    skill_score = skill_data["match_score"]

    # 2. Experience score (20% weight)
    if job_experience_required <= 0:
        experience_score = 100.0
    elif resume_experience >= job_experience_required:
        experience_score = 100.0
    else:
        experience_score = (resume_experience / job_experience_required) * 100
    experience_score = min(100.0, round(experience_score, 2))

    # 3. Education score (15% weight)
    education_levels = {
        "High School": 1, "Associate/Diploma": 2, "Bachelor's": 3,
        "Master's": 4, "PhD": 5, "Not Specified": 0
    }
    resume_edu_level = education_levels.get(resume_education, 0)
    job_edu_level = education_levels.get(job_education_required or "Not Specified", 0)

    if job_edu_level == 0 or resume_edu_level >= job_edu_level:
        education_score = 100.0
    else:
        education_score = (resume_edu_level / max(job_edu_level, 1)) * 100
    education_score = round(education_score, 2)

    # 4. Semantic similarity (25% weight)
    semantic_score = 0.0
    if resume_embedding and job_embedding:
        semantic_score = compute_semantic_similarity(resume_embedding, job_embedding)
    else:
        # Fallback: keyword overlap on full text
        resume_words = set(resume_text.lower().split())
        job_words = set(job_text.lower().split())
        overlap = len(resume_words & job_words)
        semantic_score = min(100.0, (overlap / max(len(job_words), 1)) * 200)

    # Overall weighted score
    overall_score = (
        skill_score * 0.40 +
        experience_score * 0.20 +
        education_score * 0.15 +
        semantic_score * 0.25
    )
    overall_score = round(min(100.0, overall_score), 2)

    return {
        "overall_score": overall_score,
        "skill_match_score": skill_score,
        "experience_score": experience_score,
        "education_score": education_score,
        "semantic_similarity": semantic_score,
        "matched_skills": skill_data["matched_skills"],
        "missing_skills": skill_data["missing_skills"],
    }


def generate_interview_questions(
    job_title: str,
    required_skills: List[str],
    missing_skills: List[str],
    job_description: str
) -> List[str]:
    """Generate role-relevant interview questions."""
    questions = [
        f"Tell me about your experience with {required_skills[0] if required_skills else 'your primary technology stack'}.",
        f"What is your approach to debugging complex issues in a production environment?",
        f"Describe a challenging project you worked on as a {job_title} and how you overcame obstacles.",
        f"How do you stay current with the latest trends and best practices in {job_title} role?",
        f"Explain your experience with version control and collaborative development workflows.",
    ]

    # Add skill-specific questions
    for skill in (required_skills[:3] if required_skills else []):
        questions.append(f"Can you walk me through a project where you used {skill} extensively?")

    # Add gap-related questions
    for skill in (missing_skills[:2] if missing_skills else []):
        questions.append(f"We use {skill} extensively. What's your familiarity with it, and how quickly could you get up to speed?")

    return questions[:10]


def extract_resume_summary(text: str) -> str:
    """Pull a professional summary from resume text."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Look for an explicit summary/profile/objective section
    section_kws = {"summary", "profile", "objective", "about", "overview", "introduction"}
    for i, line in enumerate(lines):
        if line.lower().rstrip(":") in section_kws or any(
            line.lower().startswith(kw) for kw in section_kws
        ):
            chunk = []
            for j in range(i + 1, min(i + 8, len(lines))):
                seg = lines[j]
                # Stop at next section header (short all-caps or title-case single line)
                if len(seg) < 50 and (seg.isupper() or seg.istitle()):
                    break
                if len(seg) > 20:
                    chunk.append(seg)
                if len(chunk) >= 3:
                    break
            if chunk:
                summary = " ".join(chunk)
                return summary[:400] + ("…" if len(summary) > 400 else "")

    # Fallback: first long line that looks like prose (not contact info)
    skip_kws = {"@", "linkedin", "github", "phone", "tel:", "http", "www"}
    for line in lines:
        if len(line) > 100 and not any(kw in line.lower() for kw in skip_kws):
            return line[:400] + ("…" if len(line) > 400 else "")

    return ""


_EDU_SCORES = {
    "PhD": 100.0,
    "Master's": 85.0,
    "Bachelor's": 70.0,
    "Associate/Diploma": 50.0,
    "High School": 30.0,
    "Not Specified": 45.0,
}


def calculate_general_ats_score(
    skills: List[str],
    experience_years: float,
    education_level: str,
    candidate_name: Optional[str],
    candidate_email: Optional[str],
    candidate_phone: Optional[str],
    candidate_location: Optional[str],
    raw_text: str,
) -> Dict:
    """
    Score a resume on its own merits (no job description).
    Returns overall score + per-dimension scores + strengths + weaknesses.
    """
    text_lower = raw_text.lower()

    # ── 1. Skills breadth (35%) ─────────────────────────────────────────────
    # Full score at 18+ detected skills; proportional below
    skill_score = round(min(100.0, len(skills) / 18.0 * 100), 1)

    # ── 2. Experience (25%) ─────────────────────────────────────────────────
    # Full score at 8+ years
    exp_score = round(min(100.0, experience_years / 8.0 * 100), 1)

    # ── 3. Education (15%) ──────────────────────────────────────────────────
    edu_score = _EDU_SCORES.get(education_level, 45.0)

    # ── 4. Completeness (25%) ───────────────────────────────────────────────
    completeness = 0.0
    completeness += 25.0 if candidate_name else 0.0
    completeness += 25.0 if candidate_email else 0.0
    completeness += 15.0 if candidate_phone else 0.0
    completeness += 10.0 if candidate_location else 0.0
    # Common resume sections
    has_exp_section = any(kw in text_lower for kw in ("experience", "employment", "work history"))
    has_edu_section = any(kw in text_lower for kw in ("education", "university", "degree", "college"))
    completeness += 15.0 if has_exp_section else 0.0
    completeness += 10.0 if has_edu_section else 0.0
    completeness = round(min(100.0, completeness), 1)

    # ── Overall ─────────────────────────────────────────────────────────────
    overall = round(
        skill_score * 0.35
        + exp_score * 0.25
        + edu_score * 0.15
        + completeness * 0.25,
        1,
    )
    overall = min(100.0, overall)

    # ── Strengths ───────────────────────────────────────────────────────────
    strengths: List[str] = []
    if len(skills) >= 12:
        strengths.append(f"Strong technical breadth — {len(skills)} skills detected")
    elif len(skills) >= 6:
        strengths.append(f"{len(skills)} technical skills identified")
    if experience_years >= 5:
        strengths.append(f"{experience_years:.0f}+ years of professional experience")
    elif experience_years >= 2:
        strengths.append(f"{experience_years:.0f} years of experience")
    if education_level in ("Master's", "PhD"):
        strengths.append(f"{education_level} degree — strong academic foundation")
    if candidate_email and candidate_phone:
        strengths.append("Complete contact information provided")
    if has_exp_section and has_edu_section:
        strengths.append("Resume includes all standard sections")
    if skills:
        top = ", ".join(skills[:4])
        strengths.append(f"Key skills: {top}")

    # ── Weaknesses ──────────────────────────────────────────────────────────
    weaknesses: List[str] = []
    if not candidate_name:
        weaknesses.append("Candidate name not detected — place your full name at the top")
    if not candidate_email:
        weaknesses.append("No email address found — add contact email")
    if not candidate_phone:
        weaknesses.append("No phone number found — add a contact number")
    if len(skills) < 5:
        weaknesses.append(
            "Few technical skills detected — list specific tools, languages, and frameworks"
        )
    if experience_years < 1 and "experience" not in text_lower:
        weaknesses.append("Work experience not detected — add employment history with dates")
    if education_level == "Not Specified":
        weaknesses.append("Education not detected — add your degree and institution")
    if len(raw_text) < 400:
        weaknesses.append("Resume content is brief — expand with achievements and responsibilities")
    # Suggest summary if not detected
    summary_kws = ("summary", "profile", "objective", "about")
    if not any(kw in text_lower for kw in summary_kws):
        weaknesses.append("Add a 2–3 sentence professional summary at the top of your resume")

    return {
        "overall": overall,
        "skill_score": skill_score,
        "exp_score": exp_score,
        "edu_score": edu_score,
        "completeness": completeness,
        "strengths": strengths,
        "weaknesses": weaknesses,
    }


def generate_ai_feedback(
    candidate_name: str,
    overall_score: float,
    matched_skills: List[str],
    missing_skills: List[str],
    experience_years: float,
    education: str,
) -> str:
    """Generate AI feedback text for a candidate."""
    score_label = (
        "Excellent" if overall_score >= 80 else
        "Good" if overall_score >= 60 else
        "Fair" if overall_score >= 40 else "Needs Improvement"
    )

    feedback = f"""## Resume Analysis Feedback

**Overall Assessment: {score_label} ({overall_score:.1f}/100)**

### Strengths
Your resume demonstrates proficiency in {', '.join(matched_skills[:5]) if matched_skills else 'general skills'}. """

    if experience_years > 0:
        feedback += f"With {experience_years:.0f} years of experience, you bring substantial practical knowledge to the table. "

    if education != "Not Specified":
        feedback += f"Your {education} degree provides a solid academic foundation. "

    feedback += "\n\n### Areas for Improvement\n"

    if missing_skills:
        feedback += f"To strengthen your profile for this role, consider developing expertise in: {', '.join(missing_skills[:5])}. "

    if overall_score < 60:
        feedback += "\nFocus on tailoring your resume more specifically to the job description keywords and requirements. "

    feedback += "\n\n### Recommendations\n"
    feedback += "1. Quantify your achievements with specific metrics and outcomes.\n"
    feedback += "2. Use action verbs to describe your responsibilities and accomplishments.\n"
    feedback += "3. Ensure your resume is ATS-friendly with relevant keywords.\n"
    feedback += "4. Keep formatting clean and consistent throughout.\n"

    return feedback
