# Multi-stage build. `dev`/`test` are for local dev + CI; `build`+`prod` produce
# a static production image (nginx serving the SPA). Select a stage
# with `--target dev|test|prod` (docker-compose.yml uses `dev` via `build.target`).
#
# Note: the canonical production deploy is DigitalOcean App Platform, which builds
# the SPA itself via its Node buildpack (see `.do/app.yaml`). The `prod` stage
# below is the alternative for container-based deploys / local prod parity.
FROM node:24-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# --- Development image: Vite dev server with hot reload ---
FROM base AS dev
CMD ["npm", "run", "dev"]

# --- Test image: runs the suite at build time, so `docker build --target test`
#     (used by CI) fails on a red test. Not part of the prod image's lineage. ---
FROM base AS test
RUN npm test

# --- Build the static bundle. VITE_ENABLE_DEV_LOGIN is unset here, so the
#     dev-login button is dead-code-eliminated out of the production bundle. ---
FROM base AS build
RUN npm run build

# --- Production image: nginx serves the static build (SPA-fallback routing). ---
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
