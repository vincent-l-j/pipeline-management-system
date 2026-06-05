#!/usr/bin/env bash
# Pull the latest code and (re)deploy the production stack.
# Run this on the server after pushing changes to the Git remote.
set -euo pipefail
cd "$(dirname "$0")"

git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f

echo "Deployed. Follow logs with:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
