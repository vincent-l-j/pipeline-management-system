# Multi-stage build. Select a stage with `--target dev|prod` (compose does this
# via `build.target`). The `base` layer is shared by both.
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# --- Development image: hot reload, dev-only routes present ---
FROM base AS dev
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- Production image: dev-only code is physically removed ---
FROM base AS prod
RUN rm -f app/api/routes/dev.py
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
