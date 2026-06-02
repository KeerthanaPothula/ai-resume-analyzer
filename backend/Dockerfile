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

# ENABLE_EMBEDDINGS defaults to false (Render free tier / 512 MB RAM).
# Torch + sentence-transformers consume ~400 MB, which exceeds the free-tier cap.
# When embeddings are disabled, scoring falls back to keyword-overlap (no model needed).
# Set ENABLE_EMBEDDINGS=true in the Render dashboard to restore semantic ATS scoring
# on a paid plan — the model downloads lazily on first use via _load_model_sync().
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface

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
