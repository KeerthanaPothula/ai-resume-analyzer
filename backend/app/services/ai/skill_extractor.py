import re
from typing import List, Set

# Comprehensive tech skill keywords
TECH_SKILLS = {
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby",
    "php", "swift", "kotlin", "scala", "r", "matlab", "perl", "bash", "shell",
    # Web Frontend
    "react", "vue", "angular", "nextjs", "nuxt", "svelte", "html", "css", "sass",
    "tailwind", "bootstrap", "jquery", "webpack", "vite", "redux", "mobx",
    # Web Backend
    "fastapi", "django", "flask", "express", "nestjs", "spring", "laravel", "rails",
    "node.js", "nodejs", "graphql", "rest", "api", "microservices",
    # Databases
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite", "oracle",
    "dynamodb", "cassandra", "neo4j", "firebase", "supabase",
    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
    "jenkins", "github actions", "circleci", "gitlab ci", "helm", "argocd",
    # AI/ML
    "machine learning", "deep learning", "nlp", "computer vision", "tensorflow",
    "pytorch", "keras", "scikit-learn", "pandas", "numpy", "opencv", "huggingface",
    "langchain", "openai", "bert", "transformers", "llm", "rag",
    # Data
    "spark", "hadoop", "kafka", "airflow", "dbt", "snowflake", "bigquery",
    "tableau", "power bi", "data warehouse", "etl", "data engineering",
    # Tools
    "git", "linux", "agile", "scrum", "jira", "confluence", "figma", "postman",
    "swagger", "ci/cd", "tdd", "bdd",
    # Soft skills
    "leadership", "communication", "problem solving", "teamwork", "project management",
    "analytical", "critical thinking",
}


def extract_skills_from_text(text: str) -> List[str]:
    """Extract skills from resume text using keyword matching."""
    text_lower = text.lower()
    found_skills: Set[str] = set()

    for skill in TECH_SKILLS:
        # Use word boundary matching
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            found_skills.add(skill)

    # Also extract capitalized tech terms (like AWS, SQL, API)
    cap_pattern = r'\b([A-Z]{2,}(?:\.[A-Z]+)*)\b'
    caps = re.findall(cap_pattern, text)
    for cap in caps:
        if cap.lower() in TECH_SKILLS:
            found_skills.add(cap.lower())

    return sorted(list(found_skills))


def compute_skill_match(resume_skills: List[str], job_skills: List[str]) -> dict:
    """Compute skill matching between resume and job."""
    resume_set = set(s.lower() for s in resume_skills)
    job_set = set(s.lower() for s in job_skills)

    matched = list(resume_set.intersection(job_set))
    missing = list(job_set - resume_set)
    extra = list(resume_set - job_set)

    match_score = len(matched) / max(len(job_set), 1) * 100

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "extra_skills": extra,
        "match_score": round(match_score, 2),
        "match_count": len(matched),
        "required_count": len(job_set),
    }


def generate_skill_gap_analysis(matched: List[str], missing: List[str]) -> dict:
    """Generate skill gap analysis with recommendations."""
    recommendations = []
    for skill in missing[:5]:  # Top 5 missing skills
        recommendations.append({
            "skill": skill,
            "priority": "High" if len(missing) <= 3 else "Medium",
            "recommendation": f"Consider learning {skill} through online courses or projects",
        })

    return {
        "gap_percentage": round(len(missing) / max(len(missing) + len(matched), 1) * 100, 1),
        "critical_missing": missing[:3],
        "recommendations": recommendations,
        "overall_assessment": (
            "Strong match" if len(missing) == 0 else
            "Good match with minor gaps" if len(missing) <= 2 else
            "Moderate match - upskilling recommended" if len(missing) <= 5 else
            "Significant skill gaps identified"
        )
    }
