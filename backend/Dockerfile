FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download sentence-transformers model so cold starts are fast.
# The model is cached inside the image (~90 MB); no runtime download needed.
# The `|| true` fallback means the build succeeds even if HuggingFace is temporarily
# unreachable — the model will be downloaded lazily on the first scoring request instead.
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" || \
    echo "WARNING: model pre-download skipped (HuggingFace unreachable) — will download on first use"

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 8000

# Run Alembic migrations then start uvicorn.
# PORT is injected by Render; falls back to 8000 for local/Docker Compose use.
# `exec` replaces the sh process with uvicorn so it becomes PID 1 and receives
# SIGTERM directly from Render — without exec, sh may not forward the signal
# and the port scanner sees the process die unexpectedly.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
