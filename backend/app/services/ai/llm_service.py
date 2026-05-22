"""
LLM service with OpenAI, Google Gemini, and template-based fallback.

Configure via environment variables:
  LLM_PROVIDER=openai   OPENAI_API_KEY=sk-...   OPENAI_MODEL=gpt-4o-mini
  LLM_PROVIDER=gemini   GEMINI_API_KEY=...       GEMINI_MODEL=gemini-1.5-flash
  LLM_PROVIDER=none     (uses deterministic templates — no API call)
"""

import json
import logging
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Response dataclasses ──────────────────────────────────────────────────────

@dataclass
class ResumeFeedback:
    summary: str
    improvement_suggestions: List[str]
    missing_skills: List[str]
    ats_optimization_tips: List[str]
    overall_assessment: str

    def dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class JobMatchFeedback:
    match_analysis: str
    missing_skills: List[str]
    interview_questions: List[str]
    ats_tips: List[str]
    recommendation: str

    def dict(self) -> Dict[str, Any]:
        return asdict(self)


# ── Prompts ───────────────────────────────────────────────────────────────────

_RESUME_PROMPT = """Analyze this resume and provide structured feedback.

Resume Text (truncated):
{resume_text}

Detected Skills: {skills}
Experience: {experience} years
Education: {education}
Known Weaknesses: {weaknesses}

Respond with ONLY this JSON object (no markdown, no extra text):
{{
  "summary": "2-3 sentence professional summary of this candidate",
  "improvement_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"],
  "missing_skills": ["skill1", "skill2", "skill3"],
  "ats_optimization_tips": ["tip 1", "tip 2", "tip 3", "tip 4"],
  "overall_assessment": "1-2 sentence assessment explaining the score"
}}"""

_JOB_MATCH_PROMPT = """Analyze how well this resume matches the job description.

Resume Text (truncated):
{resume_text}

Job Title: {job_title}
Job Description (truncated):
{job_description}

Already Matched Skills: {matched}
Missing Skills: {missing}

Respond with ONLY this JSON object (no markdown, no extra text):
{{
  "match_analysis": "2-3 sentence analysis of fit quality",
  "missing_skills": ["critical_skill1", "critical_skill2", "critical_skill3"],
  "interview_questions": ["question 1?", "question 2?", "question 3?", "question 4?", "question 5?"],
  "ats_tips": ["job-specific tip 1", "job-specific tip 2", "job-specific tip 3"],
  "recommendation": "Strong match - apply now"
}}

For recommendation, choose exactly one of:
  "Strong match - apply now" | "Good match - minor gaps" | "Moderate match - upskill first" | "Weak match - significant preparation needed"
"""


# ── LLM Service ───────────────────────────────────────────────────────────────

class LLMService:
    """Unified interface for OpenAI, Gemini, and template fallback."""

    def __init__(self) -> None:
        self._openai_client = None
        self._gemini_model = None

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def provider(self) -> str:
        return settings.LLM_PROVIDER.lower()

    @property
    def is_available(self) -> bool:
        if self.provider == "openai":
            return bool(settings.OPENAI_API_KEY)
        if self.provider == "gemini":
            return bool(settings.GEMINI_API_KEY)
        return False

    async def generate_resume_feedback(
        self,
        raw_text: str,
        skills: List[str],
        experience_years: float,
        education_level: str,
        weaknesses: List[str],
    ) -> ResumeFeedback:
        if not self.is_available:
            return self._template_resume_feedback(skills, experience_years, education_level, weaknesses)

        prompt = _RESUME_PROMPT.format(
            resume_text=raw_text[:3000],
            skills=", ".join(skills[:20]) if skills else "none detected",
            experience=f"{experience_years:.1f}",
            education=education_level,
            weaknesses=", ".join(weaknesses[:5]) if weaknesses else "none",
        )

        data = await self._call_llm(prompt)
        if not data:
            return self._template_resume_feedback(skills, experience_years, education_level, weaknesses)

        return ResumeFeedback(
            summary=str(data.get("summary", "")),
            improvement_suggestions=list(data.get("improvement_suggestions", [])),
            missing_skills=list(data.get("missing_skills", [])),
            ats_optimization_tips=list(data.get("ats_optimization_tips", [])),
            overall_assessment=str(data.get("overall_assessment", "")),
        )

    async def generate_job_match_feedback(
        self,
        raw_text: str,
        job_title: str,
        job_description: str,
        matched_skills: List[str],
        missing_skills: List[str],
    ) -> JobMatchFeedback:
        if not self.is_available:
            return self._template_job_match(job_title, matched_skills, missing_skills)

        prompt = _JOB_MATCH_PROMPT.format(
            resume_text=raw_text[:2000],
            job_title=job_title,
            job_description=job_description[:1500],
            matched=", ".join(matched_skills[:10]) if matched_skills else "none",
            missing=", ".join(missing_skills[:10]) if missing_skills else "none",
        )

        data = await self._call_llm(prompt)
        if not data:
            return self._template_job_match(job_title, matched_skills, missing_skills)

        return JobMatchFeedback(
            match_analysis=str(data.get("match_analysis", "")),
            missing_skills=list(data.get("missing_skills", missing_skills[:5])),
            interview_questions=list(data.get("interview_questions", [])),
            ats_tips=list(data.get("ats_tips", [])),
            recommendation=str(data.get("recommendation", "")),
        )

    # ── LLM call dispatch ─────────────────────────────────────────────────────

    async def _call_llm(self, prompt: str) -> Optional[Dict[str, Any]]:
        if self.provider == "openai" and settings.OPENAI_API_KEY:
            return await self._call_openai(prompt)
        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            return await self._call_gemini(prompt)
        return None

    async def _call_openai(self, prompt: str) -> Optional[Dict[str, Any]]:
        try:
            if self._openai_client is None:
                from openai import AsyncOpenAI  # lazy import
                self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

            response = await self._openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert resume coach and ATS specialist. Respond only with valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=1500,
            )
            content = response.choices[0].message.content or "{}"
            return json.loads(content)
        except Exception as exc:
            logger.error("OpenAI call failed: %s", exc)
            return None

    async def _call_gemini(self, prompt: str) -> Optional[Dict[str, Any]]:
        try:
            if self._gemini_model is None:
                import google.generativeai as genai  # lazy import
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)

            full_prompt = "Respond with valid JSON only — no markdown fences, no explanation.\n\n" + prompt
            response = await self._gemini_model.generate_content_async(full_prompt)
            raw = (response.text or "{}").strip()

            # Strip ```json ... ``` fences if present
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1].lstrip("json").strip() if len(parts) >= 2 else "{}"

            return json.loads(raw)
        except Exception as exc:
            logger.error("Gemini call failed: %s", exc)
            return None

    # ── Template fallbacks (offline, deterministic) ───────────────────────────

    @staticmethod
    def _template_resume_feedback(
        skills: List[str],
        experience_years: float,
        education_level: str,
        weaknesses: List[str],
    ) -> ResumeFeedback:
        skill_str = ", ".join(skills[:5]) if skills else "various technologies"
        edu_note = f"Holds a {education_level} degree. " if education_level not in ("Not Specified", "") else ""

        return ResumeFeedback(
            summary=(
                f"A professional with {experience_years:.0f} year(s) of experience demonstrating "
                f"proficiency in {skill_str}. {edu_note}"
                "Shows a solid technical foundation relevant to modern software roles."
            ),
            improvement_suggestions=[
                "Quantify achievements with specific metrics (e.g., 'reduced load time by 40%')",
                "Add a 2–3 sentence professional summary at the very top of the resume",
                "Use strong action verbs: 'architected', 'optimized', 'delivered', 'reduced'",
                "List relevant certifications and coursework to boost credibility",
                "Tailor the skills section to mirror keywords in each target job description",
                "Include links to GitHub, portfolio, or LinkedIn to strengthen your profile",
            ],
            missing_skills=[w for w in weaknesses if len(w) < 50][:5],
            ats_optimization_tips=[
                "Use a clean single-column layout — ATS engines often fail on tables and graphics",
                "Mirror exact keywords from the job description verbatim in your resume",
                "Save as PDF unless the posting specifically requests DOCX",
                "Spell out abbreviations on first use (e.g., 'Application Programming Interface (API)')",
                "Place your most important skills and achievements above the fold (first half of page 1)",
            ],
            overall_assessment=(
                f"This resume has {len(skills)} detected skill(s) and {experience_years:.0f} year(s) of experience. "
                "Apply the suggestions above to maximize ATS compatibility and recruiter impact."
            ),
        )

    @staticmethod
    def _template_job_match(
        job_title: str,
        matched_skills: List[str],
        missing_skills: List[str],
    ) -> JobMatchFeedback:
        total = len(matched_skills) + len(missing_skills)
        pct = round(len(matched_skills) / max(total, 1) * 100)
        matched_preview = ", ".join(matched_skills[:3]) or "your existing skills"

        return JobMatchFeedback(
            match_analysis=(
                f"Your resume matches approximately {pct}% of the required skills for this {job_title} role. "
                f"You demonstrate proficiency in {matched_preview}. "
                f"{'Addressing the skill gaps below will significantly strengthen your candidacy.' if missing_skills else 'This is an excellent match — apply with confidence.'}"
            ),
            missing_skills=missing_skills[:5],
            interview_questions=[
                f"Describe your most impactful project involving {matched_skills[0] if matched_skills else 'your primary technology'}.",
                f"How have you collaborated cross-functionally in a {job_title} role?",
                "Walk me through how you approach debugging a production issue under time pressure.",
                "How do you stay current with evolving tools and best practices in your field?",
                "Describe a time you had to balance competing priorities — how did you decide what to tackle first?",
            ],
            ats_tips=[
                f"Add the exact phrase '{job_title}' to your resume headline or summary section",
                "Mirror specific keywords from the job description verbatim — ATS does exact matching",
                f"Highlight: {', '.join(matched_skills[:3])} — these already align with the role" if matched_skills else "Expand your skills section with technologies mentioned in the job description",
            ],
            recommendation=(
                "Strong match - apply now" if pct >= 80 else
                "Good match - minor gaps" if pct >= 60 else
                "Moderate match - upskill first" if pct >= 40 else
                "Weak match - significant preparation needed"
            ),
        )


# ── Singleton ─────────────────────────────────────────────────────────────────

_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    global _service
    if _service is None:
        _service = LLMService()
    return _service
