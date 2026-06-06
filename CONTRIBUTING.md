# Contributing to RecruitAI

Thank you for your interest in contributing.

## Getting Started

```bash
# Fork, then clone your fork
git clone https://github.com/your-username/ai-resume-analyzer.git
cd ai-resume-analyzer

# Create a feature branch
git checkout -b feature/your-feature-name
```

## Development Setup

See [README.md](README.md) — Option B (Manual) for backend and frontend setup instructions.

Minimum environment: `SECRET_KEY` + one of `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `GROQ_API_KEY`.

## Before Submitting a Pull Request

**Backend:**
```bash
cd backend
python -m pytest tests/ -v --cov=app --cov-fail-under=60
flake8 app/ tests/
```

**Frontend:**
```bash
cd frontend
npm run lint
npm run build
```

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add bulk resume import
fix: scope candidate pool to recruiter's jobs
docs: update deployment instructions
refactor: extract ProviderRouter into separate module
test: add RBAC boundary tests for admin endpoints
```

## Pull Request Guidelines

- One feature or fix per PR — keep diffs focused
- Update relevant documentation if your change affects behavior
- All CI checks must pass before merge

## Reporting Bugs

Open an issue at [github.com/KeerthanaPothula/ai-resume-analyzer/issues](https://github.com/KeerthanaPothula/ai-resume-analyzer/issues).

Include: what you did, what you expected, what happened, and your environment (OS, Python version, Node version).
