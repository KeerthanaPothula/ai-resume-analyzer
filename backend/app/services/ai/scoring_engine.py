import numpy as np
from typing import List, Dict, Optional, Tuple
from sklearn.metrics.pairwise import cosine_similarity

# Lazy-load heavy models
_embedding_model = None


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception:
            _embedding_model = None
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
