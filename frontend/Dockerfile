# Multi-stage build. Select a stage with `--target dev|prod` (compose does this
# via `build.target`). `base` is shared; `prod` builds the SPA then serves it
# with Caddy.
FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# --- Development image: Vite dev server with hot reload ---
FROM base AS dev
CMD ["npm", "run", "dev"]

# --- Build the static bundle. VITE_ENABLE_DEV_LOGIN is unset here, so the
#     dev-login button is dead-code-eliminated out of the production bundle. ---
FROM base AS build
RUN npm run build

# --- Production image: Caddy serves the static build and proxies /api ---
FROM caddy:2-alpine AS prod
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
