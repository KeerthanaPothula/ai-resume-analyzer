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
from collections import deque
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Set

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

# ── Categorical question pools (behavioral / situational / general-technical) ─
# Used by _pick_job_match_questions to guarantee a 2-technical + 2-behavioral +
# 1-situational mix in every generated set.  Kept distinct from
# _INTERVIEW_QUESTION_POOL so resume-feedback and job-match questions don't
# converge on the same five strings.

_BEHAVIORAL_POOL: List[str] = [
    "Tell me about a time you had to make a decision with incomplete information. What was your process?",
    "Describe a situation where you had to advocate for a technical approach your team initially resisted.",
    "Tell me about the most challenging feedback you have ever received and how you used it.",
    "Describe a time you identified a risk that others had overlooked. What did you do?",
    "Tell me about a time you worked on a cross-functional team where priorities conflicted.",
    "Describe a situation where you had to deliver bad news to a stakeholder. How did you handle it?",
    "Tell me about a time you had to quickly get up to speed in an unfamiliar domain.",
    "Describe a project where the requirements changed significantly mid-development. How did you adapt?",
    "Tell me about a time you helped resolve a conflict within your team.",
    "Describe a situation where you had to push back on a request from a senior leader.",
    "Tell me about a time you set a stretch goal for yourself. Did you achieve it? What did you learn?",
    "Describe a project that you would do completely differently with what you know now.",
    "Tell me about a time you had to build consensus across teams with different objectives.",
    "Describe a situation where your technical judgment turned out to be wrong. How did you recover?",
    "Tell me about a time you had to work on a system or codebase you inherited in poor shape.",
    "Describe a situation where you had to prioritize long-term quality over short-term velocity.",
    "Tell me about a time you went beyond your job description to deliver something impactful.",
    "Describe a moment when you had to make a tough tradeoff between two good options.",
    "Tell me about a time you brought an outside idea or perspective that improved your team's work.",
    "Describe a situation where close collaboration with a non-engineering function led to a better outcome.",
    "Tell me about a time you had to manage competing stakeholder expectations on a single project.",
    "Describe a situation where you had to work effectively under significant ambiguity or uncertainty.",
    "Tell me about a time you made a significant technical decision and later had to justify it under scrutiny.",
    "Describe a project where you took the lead unexpectedly. What was the outcome?",
    "Tell me about a time you improved team processes or practices that had a lasting impact.",
    "Describe a situation where you had to balance innovation with stability in a production system.",
    "Tell me about a time you had to earn the trust of a skeptical colleague or manager.",
    "Describe a project where scope creep became a real problem. How did you manage it?",
    "Tell me about a time you had to hold a high bar for quality when there was pressure to cut corners.",
    "Describe a situation where you used data to change someone's mind about an important decision.",
    "Tell me about a time you had to work on something that was technically outside your comfort zone.",
    "Describe a situation where you had to deliver on a commitment despite losing a key team member.",
    "Tell me about a time you proactively reached out to users or customers to understand their needs.",
    "Describe a moment when you realized mid-project that your initial approach was fundamentally flawed.",
    "Tell me about a time you led a technical interview or onboarding process. What worked well?",
    "Describe a situation where your curiosity or investigation uncovered an unexpected problem.",
    "Tell me about a time you turned a failing project around. What did you change?",
    "Describe a situation where you had to operate effectively without a clear manager or direction.",
    "Tell me about a time a project you worked on had a significant impact you did not anticipate.",
    "Describe how you have handled a high-severity production incident from detection to resolution.",
    "Tell me about a time you had to balance being thorough with being fast in a high-stakes situation.",
    "Describe a time when documentation or lack thereof caused a serious problem. What did you do about it?",
    "Tell me about a project where success depended on a partner team delivering on time. How did you manage that dependency?",  # noqa: E501
    "Describe a time when you had to re-prioritize work in the middle of a sprint or project cycle.",
    "Tell me about a time you received conflicting direction from two different leaders. How did you handle it?",
    "Describe a situation where you identified technical toil on your team and drove its elimination.",
    "Tell me about a time when you had to quickly assess and mitigate a security or compliance risk.",
    "Describe a project where the goal posts moved more than once. How did you maintain focus?",
    "Tell me about a time you had to convince a business stakeholder to invest in technical infrastructure.",
    "Describe how you have contributed to making your engineering team more inclusive or equitable.",
    "Tell me about a time you had to ship under extreme time pressure — what did you cut, and would you do it again?",
]

_SITUATIONAL_POOL: List[str] = [
    "Imagine you inherit a legacy codebase with no documentation and a critical bug in production. Walk me through your first 48 hours.",  # noqa: E501
    "You've just joined a team and notice the deploy pipeline breaks several times a week. What is your approach to fixing it?",  # noqa: E501
    "Your service's p99 latency tripled overnight and on-call just paged you. Walk me through your incident response.",
    "Imagine the database underlying a key feature is approaching capacity and queries are slowing down. What do you do?",  # noqa: E501
    "A stakeholder requests a feature that you believe will introduce significant technical debt. How do you respond?",
    "Your team is asked to deliver a large feature in half the estimated time. How do you approach the conversation and the work?",  # noqa: E501
    "Imagine you discover a serious security vulnerability in production that was introduced six months ago. What are your next steps?",  # noqa: E501
    "You are asked to migrate a high-traffic service to a new technology with no downtime window. How do you plan this?",  # noqa: E501
    "A junior engineer on your team is consistently delivering low-quality code under deadline pressure. How do you address this?",  # noqa: E501
    "Your team's code review process is creating a bottleneck where PRs wait three to five days. How do you solve this?",  # noqa: E501
    "Imagine you need to roll back a major deploy but the rollback procedure has never been tested. What do you do?",
    "You are tasked with making an architectural decision that will affect five teams. How do you approach alignment?",
    "A critical third-party API your service depends on has just announced end-of-life in 90 days. What is your plan?",
    "Your team is asked to build a feature with very unclear requirements from a non-technical product owner. How do you proceed?",  # noqa: E501
    "Imagine you have to onboard a new team member who will take over a system you built alone. How do you approach this?",  # noqa: E501
    "You receive a bug report but cannot reproduce it locally or in staging — only in production. What is your debugging strategy?",  # noqa: E501
    "Your service is hitting rate limits on an external API at peak load. What are your short-term and long-term solutions?",  # noqa: E501
    "Imagine you are the on-call engineer and two P1 incidents occur simultaneously. How do you triage and respond?",
    "You are asked to estimate a project but the requirements are still changing. How do you handle the estimation?",
    "Your CI/CD pipeline takes 45 minutes and developers are complaining it slows them down. How do you approach optimization?",  # noqa: E501
    "Imagine a data breach is suspected. What are your immediate steps before the full scope is known?",
    "Your team has accumulated significant technical debt in a core service. How do you make the case to address it?",
    "You are building a new feature and realize it conflicts with a decision another team already shipped. What do you do?",  # noqa: E501
    "Imagine you are asked to choose between a faster-to-build but hard-to-scale approach and a slower but architecturally sound one. How do you decide?",  # noqa: E501
    "Your team needs to hire a new engineer and you are designing the technical interview. How do you ensure it is fair and effective?",  # noqa: E501
]

_GENERAL_TECHNICAL_POOL: List[str] = [
    "Explain the trade-offs between monolithic and microservices architectures.",
    "Walk me through how you would design a system that needs to be both highly available and strongly consistent.",
    "How do you approach writing code that other engineers will need to maintain or extend?",
    "Describe your mental model for choosing between SQL and NoSQL for a new project.",
    "How do you think about security when designing a new feature from scratch?",
    "Walk me through how you would debug a non-deterministic bug that only appears under load.",
    "How do you approach performance optimization — what do you measure first?",
    "Describe your process for doing a thorough code review on an unfamiliar system.",
    "How do you decide how much test coverage is enough for a given piece of code?",
    "Walk me through how you would migrate a production database with millions of rows safely.",
    "How do you balance writing reusable abstractions vs. keeping code simple and direct?",
    "Describe how you would approach building a feature for an audience of 10x the current users.",
    "How do you evaluate whether to use an open-source library or build the functionality in-house?",
    "Walk me through a real architecture decision you made and why you chose what you did.",
    "How do you communicate technical complexity and risk to non-technical stakeholders?",
    "Describe your approach to incident response — from alert to post-mortem.",
    "How do you structure a service to make it easy to test, deploy, and observe?",
    "Walk me through how you set up observability for a new backend service.",
    "How do you approach capacity planning for a new service before it goes to production?",
    "Describe how you think about backward compatibility when evolving a public API.",
    "How do you approach technical documentation — what do you write and what do you skip?",
    "Walk me through how you would safely split a large monolith into smaller services.",
    "How do you ensure consistency in distributed transactions across multiple services?",
    "Describe your approach to dependency management — keeping libraries up-to-date and secure.",
    "How do you approach working with legacy systems — when to refactor, when to replace, when to leave alone?",
]

# ── Skill → role-pool hint map ────────────────────────────────────────────────
# When the job title alone doesn't match a role category, skill keywords can
# nudge the selection toward the right technical pool.

_SKILL_POOL_HINTS: Dict[str, str] = {
    "python": "backend",
    "fastapi": "backend",
    "django": "backend",
    "flask": "backend",
    "node": "backend",
    "java": "backend",
    "golang": "backend",
    "rust": "backend",
    "docker": "backend",
    "kubernetes": "backend",
    "aws": "backend",
    "gcp": "backend",
    "azure": "backend",
    "redis": "backend",
    "postgresql": "backend",
    "mysql": "backend",
    "tensorflow": "ai_ml",
    "pytorch": "ai_ml",
    "keras": "ai_ml",
    "scikit": "ai_ml",
    "huggingface": "ai_ml",
    "transformers": "ai_ml",
    "langchain": "ai_ml",
    "pandas": "data",
    "numpy": "data",
    "spark": "data",
    "sql": "data",
    "tableau": "data",
    "dbt": "data",
    "airflow": "data",
    "snowflake": "data",
}

# ── Per-user recent-question tracking ─────────────────────────────────────────
# In-memory only; resets on server restart (acceptable — requirement is
# short-term repetition prevention, not cross-session uniqueness).
# Maps user_id → deque of up to 20 recently returned question strings.

_USER_RECENT_QUESTIONS: Dict[int, deque] = {}
_RECENT_LIMIT = 50  # mirrors HISTORY_LIMIT in question_history.py


def _get_user_recent(user_id: int) -> Set[str]:
    return set(_USER_RECENT_QUESTIONS.get(user_id, []))


def _record_user_questions(user_id: int, questions: List[str]) -> None:
    """Update the in-memory deque.  Called only on code paths that have
    no DB-backed persistence (template fallback in except-blocks, tests)."""
    if user_id <= 0 or not questions:
        return
    if user_id not in _USER_RECENT_QUESTIONS:
        _USER_RECENT_QUESTIONS[user_id] = deque(maxlen=_RECENT_LIMIT)
    for q in questions:
        _USER_RECENT_QUESTIONS[user_id].append(q)


# ── Job-match role-specific question banks ────────────────────────────────────
# _pick_job_match_questions() blends the relevant pool with _INTERVIEW_QUESTION_POOL
# so every Analyze Match click returns a fresh, role-tailored set of 5 questions.

_JM_AI_ML_POOL: List[str] = [
    "Walk me through how you design and train a machine learning model end-to-end.",
    "Explain the bias-variance tradeoff and how you manage it in practice.",
    "How do you detect and handle data drift in a deployed model?",
    "Describe your approach to feature engineering for high-cardinality categorical variables.",
    "Walk me through debugging a model that performs well offline but poorly in production.",
    "How do you evaluate model performance beyond accuracy — precision, recall, F1, AUC?",
    "Describe how you have implemented a real-time inference pipeline.",
    "How do you handle imbalanced datasets in classification tasks?",
    "Explain transformer architecture and its key innovations over RNNs.",
    "How do you approach hyperparameter tuning at scale?",
    "Describe a time you reduced model inference latency for a production system.",
    "How do you ensure reproducibility in machine learning experiments?",
    "Walk me through your approach to model explainability and interpretability.",
    "Describe how you would build an A/B testing framework for model comparison.",
    "How do you handle missing data — what imputation strategies do you use and when?",
    "Explain the difference between L1 and L2 regularization and when to apply each.",
    "How would you design a recommendation system from scratch?",
    "Describe your MLOps experience — model versioning, CI/CD for models, monitoring.",
    "How do you deal with concept drift in an online learning setting?",
    "Walk me through deploying a model to production — the full pipeline.",
    "How do you approach cross-validation for time-series data?",
    "Explain how gradient boosting works and when you would choose it over a neural network.",
    "How do you monitor a deployed model for degradation and trigger retraining?",
    "Describe your experience with distributed training frameworks.",
    "Walk me through a project where you applied NLP — preprocessing, model choice, evaluation.",
    "How do you approach data labeling strategy — active learning, crowdsourcing, self-supervised?",
    "Describe how you have used embeddings in a production system.",
    "How do you debug a neural network that is not converging?",
    "Describe a situation where a simpler model outperformed a complex one — why?",
    "Explain batch normalization and when layer normalization is preferred.",
    "How do you build a data pipeline that handles terabytes of training data?",
    "How would you design a fraud detection system with highly imbalanced labels?",
    "What techniques do you use to prevent overfitting in deep learning models?",
    "How do you evaluate a generative model (LLM, GAN, VAE)?",
    "Describe how you have used transfer learning to overcome limited labeled data.",
    "What is your approach to prompt engineering for LLM-based applications?",
    "Describe how you set up a model serving infrastructure for high-traffic predictions.",
    "How do you handle multi-modal data (text + images + structured features)?",
    "Walk me through how you would implement a semantic search system.",
    "How do you prioritize which model improvements to invest in?",
    "Describe your experience building feature stores for ML training pipelines.",
    "How do you reason about causality vs. correlation in your model features?",
    "What metrics do you track for a live recommendation system beyond CTR?",
    "How do you approach model compression for deployment on edge or mobile devices?",
    "Describe how you collaborate with data engineers to get clean, reliable training data.",
    "How do you validate that your model is fair and unbiased across demographic groups?",
    "Walk me through how you would migrate a batch ML system to real-time inference.",
    "How do you manage multiple model versions simultaneously in production?",
    "Describe your approach to shadow deployment and canary releases for ML models.",
    "What is your strategy for the cold-start problem in a new personalization feature?",
]

_JM_DATA_POOL: List[str] = [
    "Walk me through your typical exploratory data analysis workflow for a new dataset.",
    "How do you communicate statistical findings to non-technical stakeholders?",
    "Describe how you design and analyze an A/B test end-to-end.",
    "Walk me through a time you discovered an insight from data that changed a product decision.",
    "How do you handle missing data, outliers, and data quality issues in large datasets?",
    "Explain the difference between correlation and causality with a real example.",
    "How do you choose between different statistical tests (t-test, chi-square, ANOVA)?",
    "Describe your experience building and maintaining data pipelines in production.",
    "Explain how you would detect and mitigate sampling bias in an experiment.",
    "Describe a project where your analysis directly drove a significant business decision.",
    "How do you validate the assumptions of a linear regression model?",
    "Walk me through how you build a forecasting model for a time-series problem.",
    "How do you ensure statistical significance when running multiple tests simultaneously?",
    "Describe your experience with SQL — what is the most complex query you have written?",
    "How do you structure an analysis to avoid confirmation bias?",
    "Walk me through how you would segment customers for targeted marketing.",
    "How do you quantify uncertainty in predictions and communicate it clearly?",
    "Describe how you have used Python (pandas, numpy, scipy) for large-scale analysis.",
    "Walk me through how you built a dashboard or visualization that drove real action.",
    "How do you evaluate the ROI of a data science initiative?",
    "How do you approach data storytelling — turning numbers into a compelling narrative?",
    "Walk me through your experience with data warehouses (Snowflake, BigQuery, Redshift).",
    "How do you detect seasonality and trend in time-series data?",
    "How do you balance speed of analysis vs. rigor when under deadline pressure?",
    "Walk me through how you would build a churn prediction model for a SaaS product.",
    "How do you approach root cause analysis using data when something breaks in production?",
    "Describe how you handle personal data and privacy requirements in your analyses.",
    "How do you collaborate with engineering to productionize a model or analysis?",
    "How do you reason about statistical power when designing an experiment?",
    "Describe your experience with Bayesian methods vs. frequentist approaches.",
    "Walk me through your approach to cohort analysis for a subscription business.",
    "How do you handle a stakeholder who wants a result you believe is statistically invalid?",
    "Walk me through how you built a data product that was self-serve for non-analysts.",
    "How do you quantify the impact of a feature launch using observational data?",
    "Describe your experience with real-time data processing (Kafka, Spark Streaming).",
    "Walk me through how you tackled a survival analysis or time-to-event problem.",
    "How do you approach natural language analysis (sentiment, topic modeling) at scale?",
    "Describe how you evaluated and mitigated bias in a predictive model.",
    "How do you prioritize data science projects by business impact?",
    "Walk me through how you use version control for notebooks and data pipelines.",
    "Describe a time the data contradicted a strongly held business assumption — what happened?",
    "How do you design a metric that captures the business outcome you actually care about?",
    "Walk me through how you approach dimensionality reduction for visualization or modeling.",
    "How do you handle multi-armed bandit experiments vs. traditional A/B tests?",
    "Describe your experience with graph analytics or network analysis on real data.",
    "How do you approach anomaly detection in a large, noisy time-series?",
    "Walk me through building an attribution model for marketing spend.",
    "How do you decide when 'good enough' analysis is sufficient vs. needing more rigor?",
    "Describe a time you had to redesign an experiment because of a flaw in the original design.",
    "How do you keep stakeholders aligned during a long multi-month analysis project?",
]

_JM_BACKEND_POOL: List[str] = [
    "Design a URL shortener — walk me through the data model, API, and scaling strategy.",
    "How do you design a RESTful API that is intuitive, versioned, and backward compatible?",
    "Walk me through optimizing a slow SQL query hitting a 100M-row table.",
    "Describe how you design a microservices architecture and how services communicate.",
    "How do you handle database transactions and prevent race conditions in concurrent systems?",
    "Explain the CAP theorem and how it affects your architectural choices.",
    "How do you design a caching strategy — what to cache, how to evict, how to invalidate?",
    "Walk me through implementing authentication and authorization for a multi-tenant API.",
    "Describe how you handle database migrations in production without downtime.",
    "How do you approach horizontal scaling of a stateful service?",
    "Walk me through designing a notification system for millions of users.",
    "How do you ensure API backward compatibility when evolving a public interface?",
    "Describe your approach to database connection pooling and managing limits.",
    "How do you design a rate-limiting system to protect an API under heavy load?",
    "Walk me through debugging a memory leak in a long-running backend service.",
    "How do you approach event-driven architecture and message queue design?",
    "Describe how you have implemented idempotency in a payment or order processing system.",
    "How do you monitor backend services — what metrics, thresholds, and alerts do you set?",
    "Walk me through implementing full-text search in a large database.",
    "How do you handle secrets management and environment configuration securely?",
    "Describe your approach to writing integration tests for a database-backed service.",
    "How do you implement distributed tracing across multiple microservices?",
    "Walk me through a case where you significantly reduced backend latency.",
    "How do you design a job queue and worker system for background processing?",
    "Describe how you handle partial failures in a distributed system gracefully.",
    "How do you approach data serialization — JSON, Protobuf, Avro, MessagePack — and why?",
    "Walk me through building a WebSocket server for real-time features.",
    "How do you implement retry logic with exponential back-off and jitter?",
    "Describe your experience with container orchestration (Kubernetes, ECS, Nomad).",
    "How do you ensure database performance under high write volume?",
    "Walk me through designing a multi-region or geo-distributed system.",
    "How do you approach API versioning — URL path, header, query param — and why?",
    "Describe how you implemented soft deletes, auditing, or data archival in a system.",
    "How do you handle long-running requests without blocking your server thread pool?",
    "Walk me through building a reliable webhook delivery system.",
    "How do you write API documentation that developers actually find useful?",
    "Describe debugging intermittent 5xx errors in a production API.",
    "How do you reason about index design for a complex query workload?",
    "Walk me through designing an access control system (RBAC or ABAC).",
    "How do you ensure your backend is resilient to third-party API failures?",
    "Describe how you handle schema evolution in an event-driven system.",
    "How do you approach load testing and capacity planning for a new service?",
    "Walk me through implementing a feature flag system from scratch.",
    "How do you handle large file uploads efficiently in a backend service?",
    "Describe a time you optimized a backend system under significant production load.",
    "How do you approach service discovery and load balancing in a microservices cluster?",
    "Walk me through implementing a distributed lock across multiple service instances.",
    "How do you approach logging strategy — what to log, at what level, and why?",
    "Describe how you manage API contracts between services owned by different teams.",
    "Walk me through building an audit log that is tamper-evident and queryable.",
]

_JOB_ROLE_KEYWORDS: Dict[str, List[str]] = {
    "ai_ml": [
        "machine learning", "ml engineer", "ai engineer", "deep learning",
        "nlp", "natural language", "computer vision", "llm", "generative ai",
        "artificial intelligence", "neural network", "mlops",
    ],
    "data": [
        "data scientist", "data analyst", "analytics engineer",
        "business intelligence", "research scientist", "data science",
        "quantitative analyst", "quant",
    ],
    "backend": [
        "backend", "back-end", "back end", "api engineer", "server-side",
        "platform engineer", "devops", "site reliability", "sre",
        "cloud engineer", "infrastructure engineer", "full stack", "fullstack",
        "software engineer", "software developer",
    ],
}


def _pick_job_match_questions(
    job_title: str,
    skills: List[str],
    count: int = 5,
    user_id: int = 0,
    exclude: Optional[Set[str]] = None,
) -> List[str]:
    """
    Sample `count` role-tailored interview questions with category diversity.

    Selection guarantee (when pools are large enough):
      2 technical  — role-specific pool or _GENERAL_TECHNICAL_POOL
      2 behavioral — _BEHAVIORAL_POOL
      1 situational — _SITUATIONAL_POOL

    `exclude` — set of question strings to avoid (caller-supplied, typically
    loaded from PostgreSQL via question_history.get_recent_set).  When None,
    falls back to the in-memory deque (non-DB code paths: except-block
    fallbacks, unit tests).  The in-memory deque is updated only on the
    fallback path so it remains useful for same-session callers without DB.
    """
    effective_exclude: Set[str]
    if exclude is not None:
        effective_exclude = exclude          # DB-backed: caller owns persistence
    else:
        effective_exclude = _get_user_recent(user_id)  # in-memory fallback
    title_lower = (job_title or "").lower()

    # Detect role category from title
    detected_category: Optional[str] = None
    for category, keywords in _JOB_ROLE_KEYWORDS.items():
        if any(kw in title_lower for kw in keywords):
            detected_category = category
            break

    # Fall back to skill-based hint when title is ambiguous
    if detected_category is None and skills:
        for raw_skill in (s.lower() for s in skills[:10]):
            for hint_kw, hint_cat in _SKILL_POOL_HINTS.items():
                if hint_kw in raw_skill:
                    detected_category = hint_cat
                    break
            if detected_category:
                break

    # Build the role-specific technical pool
    if detected_category == "ai_ml":
        tech_pool: List[str] = list(_JM_AI_ML_POOL)
    elif detected_category == "data":
        tech_pool = list(_JM_DATA_POOL)
    elif detected_category == "backend":
        tech_pool = list(_JM_BACKEND_POOL)
    else:
        tech_pool = list(_GENERAL_TECHNICAL_POOL)

    # Append personalised skill-template questions to the technical pool
    usable = [s for s in (skills or [])[:10] if s and len(s) < 40]
    if usable:
        for template in _SKILL_QUESTION_TEMPLATES:
            tech_pool.append(template.format(skill=random.choice(usable)))

    def _fresh(pool: List[str], min_needed: int) -> List[str]:
        """Return fresh (unseen) items; relax to full pool if too few."""
        fresh = [q for q in pool if q not in effective_exclude]
        return fresh if len(fresh) >= min_needed else pool

    tech = _fresh(tech_pool, 2)
    behav = _fresh(list(_BEHAVIORAL_POOL), 2)
    situ = _fresh(list(_SITUATIONAL_POOL), 1)

    # 2 technical + 2 behavioral + 1 situational
    selected: List[str] = (
        random.sample(tech, min(2, len(tech)))
        + random.sample(behav, min(2, len(behav)))
        + random.sample(situ, min(1, len(situ)))
    )

    # Fill any remaining slots from the blended pool
    remaining = count - len(selected)
    if remaining > 0:
        combined = tech_pool + list(_BEHAVIORAL_POOL) + list(_SITUATIONAL_POOL)
        selected_set = set(selected)
        leftover = [q for q in combined if q not in selected_set and q not in effective_exclude]
        if len(leftover) < remaining:
            leftover = [q for q in combined if q not in selected_set]
        if leftover:
            selected += random.sample(leftover, min(remaining, len(leftover)))

    random.shuffle(selected)
    questions = selected[:count]

    # Only update the in-memory cache on the fallback path (no DB exclude provided).
    # When exclude comes from the DB, the endpoint owns persistence via record_questions().
    if exclude is None:
        _record_user_questions(user_id, questions)

    return questions


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
  "interview_questions": ["Behavioral or technical question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]  # noqa: E501
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

For interview_questions: generate 5 UNIQUE and VARIED questions for THIS specific {job_title} role.
Mix technical, behavioral, and situational questions. Do NOT repeat the same questions across calls.
"""

_PING_PROMPT = '{"test": true}'

_QUICK_MATCH_PROMPT = """You are an expert ATS system and career coach. Analyze how well this resume matches the job description.  # noqa: E501

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

For interview_questions: generate 5 UNIQUE and VARIED questions tailored specifically to THIS {job_title} role.
Mix: 2 technical questions about the role's specific stack, 2 behavioral questions, 1 role-specific situational question.  # noqa: E501
Do NOT use generic filler questions. Questions must differ meaningfully across repeated calls for the same role.
"""

_CHAT_PROMPT = (
    "You are an expert AI career coach specializing in resume optimization, "
    "ATS systems, job searching, and interview preparation. "
    "You give concise, actionable, and encouraging advice.\n\n"
    "{context}\n\n"
    "User: {message}\n\n"
    "Respond in 2-4 paragraphs. Be specific and actionable. "
    "Use a warm, professional tone. "
    "Do NOT use excessive bullet points — prefer flowing, readable prose."
)


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
        user_id: int = 0,
        exclude: Optional[Set[str]] = None,
    ) -> JobMatchFeedback:
        if not self.is_available:
            return self._template_job_match(job_title, matched_skills, missing_skills, user_id, exclude)

        prompt = _JOB_MATCH_PROMPT.format(
            resume_text=raw_text[:2000],
            job_title=job_title,
            job_description=job_description[:1500],
            matched=", ".join(matched_skills[:10]) if matched_skills else "none",
            missing=", ".join(missing_skills[:10]) if missing_skills else "none",
        )
        recent_qs: Set[str] = exclude if exclude is not None else _get_user_recent(user_id)
        if recent_qs:
            recent_block = "\n".join(f"- {q}" for q in list(recent_qs)[:15])
            prompt += (
                "\n\nRECENTLY GENERATED QUESTIONS — do NOT repeat any of these:\n"
                + recent_block
                + "\nGenerate completely different questions for interview_questions."
            )

        data = await self._call_llm(prompt)
        if not data:
            return self._template_job_match(job_title, matched_skills, missing_skills, user_id, exclude)

        questions = list(data.get("interview_questions", []))
        if exclude is None:
            _record_user_questions(user_id, questions)

        return JobMatchFeedback(
            match_analysis=str(data.get("match_analysis", "")),
            missing_skills=list(data.get("missing_skills", missing_skills[:5])),
            interview_questions=questions,
            ats_tips=list(data.get("ats_tips", [])),
            recommendation=str(data.get("recommendation", "")),
        )

    async def quick_job_match(
        self,
        raw_text: str,
        job_title: str,
        job_description: str,
        skills: List[str] = None,
        user_id: int = 0,
        exclude: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        """Match a resume against a pasted job description without needing a saved job."""
        logger.info(
            "LLMService.quick_job_match: provider=%r available=%s raw_text_len=%d jd_len=%d",
            self.provider, self.is_available, len(raw_text), len(job_description),
        )

        if not self.is_available:
            logger.info("LLMService.quick_job_match: no LLM configured — returning template")
            return self._template_quick_match(job_title, skills or [], user_id, exclude)

        prompt = _QUICK_MATCH_PROMPT.format(
            resume_text=raw_text[:2500],
            job_title=job_title,
            job_description=job_description[:2000],
        )
        # Prefer caller-supplied DB exclude; fall back to in-memory cache.
        recent_qs: Set[str] = exclude if exclude is not None else _get_user_recent(user_id)
        if recent_qs:
            # Cap at 15 entries to keep prompt concise.
            recent_block = "\n".join(f"- {q}" for q in list(recent_qs)[:15])
            prompt += (
                "\n\nRECENTLY GENERATED QUESTIONS — do NOT repeat any of these:\n"
                + recent_block
                + "\nGenerate completely different questions for interview_questions."
            )

        logger.info("LLMService.quick_job_match: calling _call_llm (prompt_len=%d)", len(prompt))
        data = await self._call_llm(prompt)

        if not data:
            logger.info("LLMService.quick_job_match: LLM returned no data — using template")
            return self._template_quick_match(job_title, skills or [], user_id, exclude)

        logger.info("LLMService.quick_job_match: LLM returned data (%d keys)", len(data))

        questions = list(data.get("interview_questions", []))
        # Only update in-memory cache on the non-DB fallback path.
        if exclude is None:
            _record_user_questions(user_id, questions)

        return {
            "match_score": float(data.get("match_score", 0)),
            "match_analysis": str(data.get("match_analysis", "")),
            "matched_skills": list(data.get("matched_skills", [])),
            "missing_skills": list(data.get("missing_skills", [])),
            "strengths": list(data.get("strengths", [])),
            "growth_areas": list(data.get("growth_areas", [])),
            "interview_questions": questions,
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

        # Chat returns prose, not JSON — use _call_llm_text directly.
        reply = await self._call_llm_text(prompt)
        return reply or self._template_chat_reply(message)

    async def _call_llm_text(self, prompt: str) -> str:
        """Like _call_llm but returns the raw text instead of parsed JSON."""
        try:
            if self.provider == "gemini" and settings.GEMINI_API_KEY:
                return await self._call_gemini_text(prompt)
            if self.provider == "openai" and settings.OPENAI_API_KEY:
                return await self._call_openai_text(prompt)
        except Exception:
            logger.exception("_call_llm_text: LLM call failed")
        return ""

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
    def _template_quick_match(
        job_title: str,
        skills: List[str] = None,
        user_id: int = 0,
        exclude: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        return {
            "match_score": 55.0,
            "match_analysis": (
                f"Your resume shows relevant experience for a {job_title} role. "
                "Upload a more detailed resume and use the AI provider for a precise match score."
            ),
            "matched_skills": ["communication", "problem-solving", "teamwork"],
            "missing_skills": ["domain-specific certifications", "portfolio projects"],
            "strengths": ["Demonstrated experience", "Technical background", "Educational credentials"],
            "growth_areas": ["Add quantified achievements", "Include role-specific keywords"],
            "interview_questions": _pick_job_match_questions(
                job_title, skills or [], user_id=user_id, exclude=exclude
            ),
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
            "That's a great career question! Here's my guidance: "
            "focus on building concrete evidence of your "
            "skills through real projects, open-source contributions, or measurable work achievements.\n\n"
            "Your resume should tell a compelling story — not just what you did, but the impact you made. "
            "Use strong action verbs (architected, led, optimized, delivered) and quantify wherever possible.\n\n"
            "Networking is also underrated: 70-80% of jobs are filled through referrals. "
            "Connect with professionals in your target role on LinkedIn, "
            "attend meetups, and contribute to communities. "
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
            from google.genai import errors as genai_errors  # noqa: F401

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
            from google.genai import errors as genai_errors  # noqa: F401

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
            f"This resume has {len(skills)} detected skill(s) "
            "with academic and project-based experience. "
            if experience_years == 0
            else (
                f"This resume has {len(skills)} detected skill(s) "
                f"and {experience_years:.0f} year(s) of professional experience. "
            )
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
        user_id: int = 0,
        exclude: Optional[Set[str]] = None,
    ) -> JobMatchFeedback:
        total = len(matched_skills) + len(missing_skills)
        pct = round(len(matched_skills) / max(total, 1) * 100)
        matched_preview = ", ".join(matched_skills[:3]) or "your existing skills"
        closing = (
            "Addressing the skill gaps below will significantly strengthen your candidacy."
            if missing_skills
            else "This is an excellent match — apply with confidence."
        )

        return JobMatchFeedback(
            match_analysis=(
                f"Your resume matches approximately {pct}% of the required skills for this {job_title} role. "
                f"You demonstrate proficiency in {matched_preview}. {closing}"
            ),
            missing_skills=missing_skills[:5],
            interview_questions=_pick_job_match_questions(
                job_title, matched_skills, user_id=user_id, exclude=exclude
            ),
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
