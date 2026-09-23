#!/usr/bin/env bash
# Verify the dev container's tooling is actually installed. Runs as
# postCreateCommand, i.e. on first open and again on every rebuild.
#
# The failure this catches is invisible: a half-provisioned workspace looks fine
# because node_modules survives on the bind mount, and the first symptom is
# `pytest` silently resolving to an unrelated interpreter. A red postCreate is
# the point.
set -uo pipefail

fail=0
pass() { printf '  OK    %s\n' "$*"; }
bad()  { printf '  FAIL  %s\n' "$*"; fail=1; }

VENV="${VENV:-/home/vscode/.venv}"

echo "Verifying dev container tooling..."

# Import a real dependency rather than checking the directory exists — a venv
# containing only pip is exactly what the old bug produced.
if [ -x "$VENV/bin/python" ] && "$VENV/bin/python" -c 'import fastapi, pytest' 2>/dev/null; then
    pass "python venv at $VENV has backend + test deps"
else
    bad "python venv at $VENV is missing or incomplete"
    echo "        The venv is built at image build time. Rebuild the dev"
    echo "        container (Dev Containers: Rebuild Container) rather than"
    echo "        pip installing into it by hand — pypi is reachable now, but"
    echo "        a hand-patched venv is gone on the next rebuild."
fi

# Must resolve INTO the venv: the base image's interpreter is also on PATH, and
# if remoteEnv's ordering breaks, every command runs against the wrong one and
# still appears to work.
resolved=$(command -v pytest || true)
if [ "$resolved" = "$VENV/bin/pytest" ]; then
    pass "pytest resolves to the venv"
else
    bad "pytest resolves to '${resolved:-nothing}', not $VENV/bin/pytest"
    echo "        Check remoteEnv PATH in devcontainer.json."
fi

# Three files pin this major independently; nothing else makes them agree.
node_major=$(node --version 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/')
frontend_major=$(sed -n 's/^FROM node:\([0-9]*\).*/\1/p' /workspace/frontend/Dockerfile | head -n 1)
if [ -n "$node_major" ] && [ "$node_major" = "$frontend_major" ]; then
    pass "node $(node --version) matches frontend/Dockerfile (node:$frontend_major)"
else
    bad "node is '${node_major:-missing}', frontend/Dockerfile expects '${frontend_major:-?}'"
    echo "        Node is baked into the image, not installed by a feature."
    echo "        Update NODE_MAJOR in .devcontainer/Dockerfile (and node-version"
    echo "        in .github/workflows/ci.yml), then rebuild the dev container."
fi

# In postCreate, not the image: /workspace is a bind mount and masks anything
# baked under it. Reaching here missing means postCreate's `&&` failed to stop.
for dir in /workspace/node_modules /workspace/frontend/node_modules; do
    if [ -d "$dir" ]; then
        pass "$dir present"
    else
        bad "$dir missing"
        echo "        postCreateCommand should have run 'npm ci' for this. Check"
        echo "        the postCreate log, and that registry.npmjs.org resolves:"
        echo "          getent hosts registry.npmjs.org"
    fi
done

# Identity is not a credential, but without it every commit fails at the point of
# committing with nothing having warned you. A warning rather than a failure: a
# container that cannot commit is still fine to read code in.
git_email=$(git -C /workspace config --get user.email 2>/dev/null || true)
if [ -n "$git_email" ]; then
    pass "git identity set ($git_email)"
else
    printf '  WARN  %s\n' "no git user.email - commits will fail until it is set"
    echo "        git config --global user.email you@example.com"
    echo "        git config --global user.name 'Your Name'"
fi

echo
if [ "$fail" -ne 0 ]; then
    echo "Dev container tooling is INCOMPLETE - see above."
    exit 1
fi
echo "Dev container tooling verified."
