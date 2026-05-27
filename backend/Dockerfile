# ── Stage 1: Build ───────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY backend/pyproject.toml ./

# Install dependencies into a virtual environment
RUN uv venv /app/.venv && \
    uv pip install --python /app/.venv/bin/python -r pyproject.toml

# ── Stage 2: Runtime ─────────────────────────────────────────────────────
FROM python:3.12-slim

# WeasyPrint system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Persist SQLite DB under /app/data (mount this directory as a volume)
RUN mkdir -p /app/data
ENV DATABASE_URL=sqlite:////app/data/schulbuch.db

# Copy application code (build context = project root)
COPY backend/app/ ./app/
COPY frontend/ ./frontend/

# Default port (Railway/Fly.io set PORT env var)
ENV PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/api/health')"

# Run the application
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
