# Multi-stage build. Select a stage with `--target dev|test|prod`. The `base`
# layer is shared. docker-compose.yml builds `dev` via `build.target`; CI builds
# `test`. In production, DigitalOcean App Platform builds the final stage
# (`prod`) and overrides its CMD via `run_command` in `.do/app.yaml`.
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# --- Development image: runtime + test tooling, hot reload, dev routes present ---
FROM base AS dev
RUN pip install --no-cache-dir -r requirements-dev.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- Test image: runs the suite at build time, so `docker build --target test`
#     (used by CI) fails on a red test. Not part of the prod image's lineage. ---
FROM dev AS test
RUN pytest

# --- Production image: runtime deps only (no test tooling), dev-only code removed ---
FROM base AS prod
RUN rm -f app/api/routes/dev.py
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
