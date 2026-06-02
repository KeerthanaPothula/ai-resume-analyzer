"""
LLM service — Google Gemini (google-genai SDK v2) + OpenAI + template fallback.

Configure via backend/.env:
  LLM_PROVIDER=gemini
  GEMINI_API_KEY=<your key from https://aistudio.google.com/app/apikey>
  GEMINI_MODEL=gemini-2.0-flash          # optional, this is the default

  LLM_PROVIDER=openai
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-4o-mini               # optional, this is the default

  LLM_PROVIDER=none                      # deterministic templates, no API cost
"""

import asyncio
import json
import logging
import random
import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

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
    interview_questions: List[str]

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


# ── Interview question bank (template fallback) ───────────────────────────────
# 50 base questions + 10 skill-specific templates.
# _pick_random_questions() samples 5 without replacement so every Regenerate
# click returns a different set.

_INTERVIEW_QUESTION_POOL: List[str] = [
    # Behavioral — adversity & collaboration
    "Tell me about yourself and the most impactful project you have delivered.",
    "Describe a time you faced a significant technical challenge and how you overcame it.",
    "Tell me about a time you had to learn a new technology quickly under a tight deadline.",
    "Describe a situation where you disagreed with a technical decision. What did you do?",
    "Tell me about the project you are most proud of and why.",
    "Describe a time you had to collaborate with a difficult team member or stakeholder.",
    "Tell me about a time you missed a deadline. What happened and what did you learn?",
    "Describe a situation where you had to juggle multiple urgent priorities simultaneously.",
    "Tell me about a time you identified and fixed a critical bug in a production system.",
    "Describe a time you mentored or helped a colleague grow their technical skills.",
    "Tell me about your biggest professional failure and the lesson you took from it.",
    "Describe a time you had to explain a complex technical concept to a non-technical audience.",
    "Tell me about a time you proactively improved a process or workflow on your team.",
    "Describe a situation where you had to deliver with ambiguous or incomplete requirements.",
    "Tell me about a time you had to influence a decision without direct authority.",
    "Describe a moment when you had to adapt quickly to a significant change at work.",
    "Tell me about a time when close attention to detail prevented a serious problem.",
    "Describe how you received and acted on a piece of difficult critical feedback.",
    "Tell me about a project where you had to balance quality against a very tight deadline.",
    "Describe a time you took ownership of a problem that was not strictly your responsibility.",
    # Technical — practices & systems
    "Walk me through how you would approach debugging a production outage under time pressure.",
    "How do you ensure code quality and long-term maintainability in your projects?",
    "Describe your approach to designing a service that needs to scale to millions of users.",
    "How do you manage technical debt while still meeting delivery commitments?",
    "Explain how you would diagnose and optimize a slow database query in production.",
    "Describe your code-review process — both as the author and the reviewer.",
    "How do you approach testing — unit, integration, and end-to-end coverage?",
    "Describe how you have implemented security best practices in a past project.",
    "Walk me through your CI/CD pipeline and deployment process from your last role.",
    "How do you monitor application performance and respond to degradation proactively?",
    "Describe your experience with version control workflows and branching strategies.",
    "How do you design APIs to be intuitive, versioned, and well-documented?",
    "What is your strategy for handling errors, retries, and graceful service degradation?",
    "How do you refactor legacy code safely without disrupting live systems?",
    "Describe your experience with containerization and infrastructure-as-code.",
    "How do you make architectural decisions when there are multiple valid trade-offs?",
    "Describe your approach to data modeling when designing a new product feature.",
    "How do you make your systems observable — logging, metrics, distributed tracing?",
    "What is your strategy for managing third-party dependencies safely over time?",
    "How do you evaluate whether a new framework or library is worth adopting in production?",
    # Career & motivation
    "What aspect of software engineering excites you most right now?",
    "Where do you see your technical career heading over the next three to five years?",
    "How do you balance deepening expertise versus broadening your skill set?",
    "What kind of engineering team culture brings out your best work?",
    "What is the most interesting technical problem you have worked on in the past year?",
    "How do you approach continuous learning — books, courses, side projects, communities?",
    "What does 'good engineering' mean to you beyond simply working code?",
    "Describe your ideal working relationship with product management and design.",
    "How do you contribute to team culture beyond your individual technical deliverables?",
    "What does an effective, constructive code review comment look like to you?",
]

_SKILL_QUESTION_TEMPLATES: List[str] = [
    "Describe a project where {skill} was central to your solution and the outcome it produced.",
    "What are the main trade-offs of using {skill} compared to the alternatives you considered?",
    "Walk me through how you optimized performance in a system that relied heavily on {skill}.",
    "What are the most common pitfalls when working with {skill} and how do you avoid them?",
    "How has your understanding of best practices around {skill} evolved over your career?",
    "Describe the most complex problem you have solved using {skill}.",
    "How would you onboard a junior developer who is completely new to {skill}?",
    "What aspects of {skill} do you think are underutilized or often misunderstood?",
    "Describe how you have used {skill} to improve system reliability or team productivity.",
    "How do you keep your {skill} knowledge current as the ecosystem evolves?",
]


def _pick_random_questions(skills: List[str], count: int = 5) -> List[str]:
    """
    Sample `count` unique interview questions from the base pool, augmented with
    skill-specific variants drawn from the candidate's detected skills.
    Each call uses random.sample so every Regenerate click returns a fresh set.
    """
    pool: List[str] = list(_INTERVIEW_QUESTION_POOL)
    usable = [s for s in (skills or [])[:10] if s and len(s) < 40]
    if usable:
        for template in _SKILL_QUESTION_TEMPLATES:
            pool.append(template.format(skill=random.choice(usable)))
    return random.sample(pool, min(count, len(pool)))


# ── Prompts ───────────────────────────────────────────────────────────────────

_RESUME_PROMPT = """Analyze this resume and provide structured feedback.

Resume Text (truncated):
{resume_text}

Detected Skills: {skills}
Experience: {experience} years
Education: {education}
ATS Score: {ats_score}/100
Key Strengths: {strengths}
Known Weaknesses: {weaknesses}

Return ONLY a JSON object with exactly these keys:
{{
  "summary": "2-3 sentence professional summary of this candidate",
  "improvement_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"],
  "missing_skills": ["skill1", "skill2", "skill3"],
  "ats_optimization_tips": ["tip 1", "tip 2", "tip 3", "tip 4"],
  "overall_assessment": "1-2 sentence assessment explaining the ATS score",
  "interview_questions": ["Behavioral or technical question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]
}}

For interview_questions: generate 5 VARIED and SPECIFIC questions this hiring manager would ask.
Each question must be unique, tailored to this candidate's actual skills and ATS score, and must NOT be generic.
Do not repeat questions that a simple generic template would produce.
Vary between behavioral, technical, and role-specific questions."""

_JOB_MATCH_PROMPT = """Analyze how well this resume matches the job description.

Resume Text (truncated):
{resume_text}

Job Title: {job_title}
Job Description (truncated):
{job_description}

Already Matched Skills: {matched}
Missing Skills: {missing}

Return ONLY a JSON object with exactly these keys:
{{
  "match_analysis": "2-3 sentence analysis of fit quality",
  "missing_skills": ["critical_skill1", "critical_skill2", "critical_skill3"],
  "interview_questions": ["question 1?", "question 2?", "question 3?", "question 4?", "question 5?"],
  "ats_tips": ["job-specific tip 1", "job-specific tip 2", "job-specific tip 3"],
  "recommendation": "Strong match - apply now"
}}

For recommendation pick exactly one of:
  "Strong match - apply now" | "Good match - minor gaps" |
  "Moderate match - upskill first" | "Weak match - significant preparation needed"
"""

_PING_PROMPT = '{"test": true}'

_QUICK_MATCH_PROMPT = """You are an expert ATS system and career coach. Analyze how well this resume matches the job description.

Resume (truncated to 2500 chars):
{resume_text}

Job Title: {job_title}
Job Description (truncated to 2000 chars):
{job_description}

Return ONLY a JSON object with exactly these keys:
{{
  "match_score": <integer 0-100 representing overall fit percentage>,
  "match_analysis": "2-3 sentence recruiter-style analysis of the fit",
  "matched_skills": ["skill1", "skill2", "skill3"],
  "missing_skills": ["critical_missing1", "critical_missing2", "critical_missing3"],
  "strengths": ["specific strength from resume relevant to this role", "strength 2", "strength 3"],
  "growth_areas": ["area to develop for this role", "area 2"],
  "interview_questions": ["Tailored question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"],
  "ats_tips": ["Job-specific ATS tip 1", "tip 2", "tip 3"],
  "recommendation": "Strong match - apply now"
}}

For recommendation pick exactly one of:
  "Strong match - apply now" | "Good match - minor gaps" |
  "Moderate match - upskill first" | "Weak match - significant preparation needed"
"""

_CHAT_PROMPT = """You are an expert AI career coach specializing in resume optimization, ATS systems, job searching, and interview preparation. You give concise, actionable, and encouraging advice.

{context}

User: {message}

Respond in 2-4 paragraphs. Be specific and actionable. Use a warm, professional tone. Do NOT use excessive bullet points — prefer flowing, readable prose."""


# ── LLM Service ───────────────────────────────────────────────────────────────

class LLMService:
    """
    Unified interface for Gemini (google-genai v2), OpenAI, and template fallback.
    Clients are lazy-loaded on first use — startup is never blocked.
    """

    def __init__(self) -> None:
        self._gemini_client = None   # google.genai.Client
        self._openai_client = None   # openai.AsyncOpenAI

    # ── Public properties ─────────────────────────────────────────────────────

    @property
    def provider(self) -> str:
        return settings.LLM_PROVIDER.lower()

    @property
    def model_name(self) -> str:
        if self.provider == "gemini":
            return settings.GEMINI_MODEL
        if self.provider == "openai":
            return settings.OPENAI_MODEL
        return "none"

    @property
    def is_available(self) -> bool:
        if self.provider == "gemini":
            return bool(settings.GEMINI_API_KEY)
        if self.provider == "openai":
            return bool(settings.OPENAI_API_KEY)
        return False

    # ── High-level feedback methods ───────────────────────────────────────────

    async def generate_resume_feedback(
        self,
        raw_text: str,
        skills: List[str],
        experience_years: float,
        education_level: str,
        weaknesses: List[str],
        ats_score: float = 0.0,
        strengths: Optional[List[str]] = None,
    ) -> ResumeFeedback:
        if not self.is_available:
            return self._template_resume_feedback(skills, experience_years, education_level, weaknesses)

        prompt = _RESUME_PROMPT.format(
            resume_text=raw_text[:3000],
            skills=", ".join(skills[:20]) if skills else "none detected",
            experience=f"{experience_years:.1f}",
            education=education_level,
            ats_score=f"{ats_score:.0f}",
            strengths=", ".join((strengths or [])[:5]) if strengths else "not yet analyzed",
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
            interview_questions=list(data.get("interview_questions", [])),
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

    async def quick_job_match(
        self,
        raw_text: str,
        job_title: str,
        job_description: str,
    ) -> Dict[str, Any]:
        """Match a resume against a pasted job description without needing a saved job."""
        logger.info(
            "LLMService.quick_job_match: provider=%r available=%s raw_text_len=%d jd_len=%d",
            self.provider, self.is_available, len(raw_text), len(job_description),
        )

        if not self.is_available:
            logger.info("LLMService.quick_job_match: no LLM configured — returning template")
            return self._template_quick_match(job_title)

        prompt = _QUICK_MATCH_PROMPT.format(
            resume_text=raw_text[:2500],
            job_title=job_title,
            job_description=job_description[:2000],
        )

        logger.info("LLMService.quick_job_match: calling _call_llm (prompt_len=%d)", len(prompt))
        data = await self._call_llm(prompt)

        if not data:
            logger.info("LLMService.quick_job_match: LLM returned no data — using template")
            return self._template_quick_match(job_title)

        logger.info("LLMService.quick_job_match: LLM returned data (%d keys)", len(data))

        return {
            "match_score": float(data.get("match_score", 0)),
            "match_analysis": str(data.get("match_analysis", "")),
            "matched_skills": list(data.get("matched_skills", [])),
            "missing_skills": list(data.get("missing_skills", [])),
            "strengths": list(data.get("strengths", [])),
            "growth_areas": list(data.get("growth_areas", [])),
            "interview_questions": list(data.get("interview_questions", [])),
            "ats_tips": list(data.get("ats_tips", [])),
            "recommendation": str(data.get("recommendation", "Moderate match - upskill first")),
        }

    async def career_chat(
        self,
        message: str,
        resume_context: str = "",
    ) -> str:
        """Single-turn career coaching chat."""
        context = f"Resume context:\n{resume_context[:1500]}\n" if resume_context else ""
        prompt = _CHAT_PROMPT.format(context=context, message=message)

        if not self.is_available:
            return self._template_chat_reply(message)

        data = await self._call_llm(prompt)
        if data is None:
            return self._template_chat_reply(message)

        # Chat prompt returns prose, not JSON — _call_llm would fail to parse it.
        # So we call raw and handle separately.
        return await self._call_llm_text(prompt)

    async def _call_llm_text(self, prompt: str) -> str:
        """Like _call_llm but returns the raw text instead of parsed JSON."""
        try:
            if self.provider == "gemini" and settings.GEMINI_API_KEY:
                return await self._call_gemini_text(prompt)
            if self.provider == "openai" and settings.OPENAI_API_KEY:
                return await self._call_openai_text(prompt)
        except Exception:
            pass
        return self._template_chat_reply(prompt)

    async def _call_gemini_text(self, prompt: str) -> str:
        from google import genai
        from google.genai import types as genai_types

        if self._gemini_client is None:
            self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)

        cfg = genai_types.GenerateContentConfig(
            temperature=0.6,
            max_output_tokens=1024,
        )

        loop = asyncio.get_running_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: self._gemini_client.models.generate_content(
                    model=settings.GEMINI_MODEL, contents=prompt, config=cfg
                ),
            ),
            timeout=25.0,
        )
        return (response.text or "").strip()

    async def _call_openai_text(self, prompt: str) -> str:
        from openai import AsyncOpenAI

        if self._openai_client is None:
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await self._openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert AI career coach."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
            max_tokens=1024,
        )
        return response.choices[0].message.content or ""

    @staticmethod
    def _template_quick_match(job_title: str) -> Dict[str, Any]:
        return {
            "match_score": 55.0,
            "match_analysis": f"Your resume shows relevant experience for a {job_title} role. Upload a more detailed resume and use the AI provider for a precise match score.",
            "matched_skills": ["communication", "problem-solving", "teamwork"],
            "missing_skills": ["domain-specific certifications", "portfolio projects"],
            "strengths": ["Demonstrated experience", "Technical background", "Educational credentials"],
            "growth_areas": ["Add quantified achievements", "Include role-specific keywords"],
            "interview_questions": [
                "Tell me about your most relevant project for this role.",
                "How have you handled tight deadlines?",
                "Describe your experience working in a team.",
                "What motivates you to apply for this position?",
                "Where do you see yourself in 3 years?",
            ],
            "ats_tips": [
                "Mirror the job title in your resume headline",
                "Add keywords from the job description verbatim",
                "Quantify achievements with numbers and percentages",
            ],
            "recommendation": "Moderate match - upskill first",
        }

    @staticmethod
    def _template_chat_reply(message: str) -> str:
        message_lower = message.lower()
        if any(w in message_lower for w in ["interview", "question", "prepare"]):
            return (
                "Great question about interview preparation! Start by deeply researching the company — "
                "understand their product, mission, and recent news. Then practice the STAR method "
                "(Situation, Task, Action, Result) for behavioral questions, which make up 60% of most interviews.\n\n"
                "Prepare 3-5 strong stories from your experience that demonstrate leadership, problem-solving, "
                "and collaboration. Technical roles will also have coding/system-design rounds — "
                "practice on platforms like LeetCode or HackerRank.\n\n"
                "Finally, prepare thoughtful questions to ask the interviewer. This shows genuine interest "
                "and helps you evaluate if the role is a good fit."
            )
        if any(w in message_lower for w in ["ats", "score", "resume", "cv"]):
            return (
                "ATS optimization is crucial in today's hiring landscape. Most companies use ATS software "
                "to filter resumes before a human ever sees them. The key is keyword alignment — your resume "
                "must contain the exact terms from the job description.\n\n"
                "Use a clean, single-column format with standard section headers (Experience, Education, Skills). "
                "Avoid tables, graphics, and custom fonts. Save as PDF unless the application specifically "
                "requests DOCX format.\n\n"
                "Quantify every achievement you can: 'Improved load time by 40%' beats 'Improved performance'. "
                "Tailor your skills section to each application — this alone can dramatically improve your match score."
            )
        return (
            "That's a great career question! Here's my guidance: focus on building concrete evidence of your "
            "skills through real projects, open-source contributions, or measurable work achievements.\n\n"
            "Your resume should tell a compelling story — not just what you did, but the impact you made. "
            "Use strong action verbs (architected, led, optimized, delivered) and quantify wherever possible.\n\n"
            "Networking is also underrated: 70-80% of jobs are filled through referrals. "
            "Connect with professionals in your target role on LinkedIn, attend meetups, and contribute to communities. "
            "Let me know if you have a more specific question!"
        )

    async def ping(self) -> Dict[str, Any]:
        """Smoke-test the configured provider with a minimal API call."""
        if not self.is_available:
            return {
                "ok": False,
                "provider": self.provider,
                "model": None,
                "error": (
                    f"No API key configured for provider '{self.provider}'. "
                    f"Open backend/.env and set "
                    f"{'GEMINI_API_KEY' if self.provider == 'gemini' else 'OPENAI_API_KEY'}."
                ),
            }

        prompt = (
            'Return exactly this JSON and nothing else: '
            '{"ok": true, "message": "connection successful"}'
        )
        result = await self._call_llm(prompt)
        return {
            "ok": result is not None,
            "provider": self.provider,
            "model": self.model_name,
            "response": result,
        }

    # ── LLM call dispatch ─────────────────────────────────────────────────────

    async def _call_llm(self, prompt: str) -> Optional[Dict[str, Any]]:
        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            return await self._call_gemini(prompt)
        if self.provider == "openai" and settings.OPENAI_API_KEY:
            return await self._call_openai(prompt)
        return None

    # ── Gemini (google-genai v2 SDK) ──────────────────────────────────────────

    async def _call_gemini(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Call Gemini with a hard 25-second timeout.

        The google-genai SDK retries 503s internally (via tenacity) with up to 60 s
        of back-off, which causes the browser to hit ECONNRESET before the server
        responds.  The asyncio.wait_for() wrapper cuts that off early and lets the
        endpoint fall back to the template response instead of dropping the connection.
        """
        try:
            from google import genai
            from google.genai import types as genai_types
            from google.genai import errors as genai_errors

            if self._gemini_client is None:
                self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)

            cfg = genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
                max_output_tokens=2048,
            )

            # Hard time-box the whole call (including any SDK-internal retries).
            response = await asyncio.wait_for(
                self._gemini_client.aio.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=cfg,
                ),
                timeout=25.0,
            )

            raw = (response.text or "").strip()
            return self._extract_json(raw)

        except asyncio.TimeoutError:
            logger.error(
                "Gemini call timed out after 25 s (model may be overloaded). "
                "Falling back to template response."
            )
            return None

        except asyncio.CancelledError:
            # Client disconnected — propagate so asyncio can clean up the task.
            raise

        except Exception as exc:
            self._handle_gemini_error(exc)
            return None

    @staticmethod
    def _extract_json(raw: str) -> Optional[Dict[str, Any]]:
        """
        Robustly extract a JSON object from a Gemini response string.

        Handles:
         - Pure JSON  {"key": ...}
         - Markdown fences  ```json\\n{...}\\n```
         - Preamble text  "Here is the JSON:\\n{...}"
        """
        if not raw:
            return None

        # 1. Try parsing the whole string first (happy path when mime-type is honoured)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # 2. Strip markdown code fences
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                candidate = part.lstrip("json").strip()
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue

        # 3. Pull the first {...} block out of surrounding prose
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        logger.error("Could not extract JSON from Gemini response: %.200s", raw)
        return None

    def _handle_gemini_error(self, exc: Exception) -> None:
        """Log a Gemini error with a human-readable hint."""
        msg = str(exc)
        try:
            from google.genai import errors as genai_errors

            if isinstance(exc, genai_errors.ClientError):
                code = getattr(exc, "status_code", 0) or 0
                if code == 401 or "API_KEY" in msg.upper() or "invalid" in msg.lower():
                    logger.error(
                        "Gemini: invalid API key (401). "
                        "Open backend/.env and paste a valid key at GEMINI_API_KEY=<key>"
                    )
                elif code == 429 or "quota" in msg.lower() or "RATE_LIMIT" in msg.upper():
                    logger.error(
                        "Gemini: rate limit / free-tier quota exceeded (429). "
                        "Wait a moment or upgrade your Google AI Studio plan."
                    )
                elif code == 400:
                    logger.error("Gemini: bad request (400) — check prompt length/content: %s", msg)
                else:
                    logger.error("Gemini client error (%s): %s", code, msg)

            elif isinstance(exc, genai_errors.ServerError):
                # Transient — reset so the next call re-creates the client
                self._gemini_client = None
                logger.error("Gemini server error (5xx) — will auto-retry next call: %s", msg)

            else:
                logger.error("Gemini unexpected error (%s): %s", type(exc).__name__, msg)

        except ImportError:
            logger.error("Gemini call failed: %s", msg)

    # ── OpenAI ────────────────────────────────────────────────────────────────

    async def _call_openai(self, prompt: str) -> Optional[Dict[str, Any]]:
        try:
            from openai import AsyncOpenAI  # lazy import

            if self._openai_client is None:
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
                temperature=0.7,
                max_tokens=1500,
            )
            content = response.choices[0].message.content or "{}"
            return json.loads(content)

        except Exception as exc:
            logger.error("OpenAI call failed (%s): %s", type(exc).__name__, exc)
            return None

    # ── Template fallbacks (deterministic, no API cost) ───────────────────────

    @staticmethod
    def _template_resume_feedback(
        skills: List[str],
        experience_years: float,
        education_level: str,
        weaknesses: List[str],
    ) -> ResumeFeedback:
        skill_str = ", ".join(skills[:5]) if skills else "various technologies"
        edu_note = (
            f"Holds a {education_level} degree. "
            if education_level not in ("Not Specified", "")
            else ""
        )

        exp_intro = (
            "Aspiring professional with strong academic foundations"
            if experience_years == 0
            else f"A professional with {experience_years:.0f} year{'s' if experience_years != 1 else ''} of experience"
        )
        exp_assessment = (
            f"This resume has {len(skills)} detected skill(s) with academic and project-based experience. "
            if experience_years == 0
            else f"This resume has {len(skills)} detected skill(s) and {experience_years:.0f} year(s) of professional experience. "
        )
        return ResumeFeedback(
            summary=(
                f"{exp_intro} demonstrating "
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
                exp_assessment
                + "Apply the suggestions above to maximize ATS compatibility and recruiter impact."
            ),
            interview_questions=_pick_random_questions(skills),
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
                (
                    f"Highlight: {', '.join(matched_skills[:3])} — these already align with the role"
                    if matched_skills
                    else "Expand your skills section with technologies mentioned in the job description"
                ),
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
