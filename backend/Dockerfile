# Multi-stage build. Select a stage with `--target dev|prod`. The `base` layer is
# shared. docker-compose.yml builds `dev` via `build.target`; CI builds `dev` to
# prove the image still builds and runs the suite in a job of its own, because
# the suite needs a Postgres a build stage cannot reach. In production,
# DigitalOcean App Platform builds the final stage (`prod`) and overrides its CMD
# via `run_command` in `.do/app.yaml`.
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# --- Development image: runtime + test tooling, hot reload, dev routes present ---
FROM base AS dev
RUN pip install --no-cache-dir -r requirements-dev.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# There is deliberately no `test` stage. It used to be `FROM dev` + `RUN pytest`,
# which worked only while the suite ran on in-memory SQLite: a build stage has no
# route to a service container, so it cannot reach the Postgres the suite now
# needs. `dev` already carries requirements-dev.txt, so it is the image the CI job
# runs pytest in.

# --- Production image: runtime deps only (no test tooling), dev-only code removed ---
FROM base AS prod
RUN rm -f app/api/routes/dev.py
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
