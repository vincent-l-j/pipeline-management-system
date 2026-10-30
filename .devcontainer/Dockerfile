FROM mcr.microsoft.com/devcontainers/base:ubuntu26.04@sha256:b1e3b08610ae0b2599f57c3a492eebc93d1d26dbaefb4a0bad0caa7149e4ec95

# --- Install basic development tools and iptables/ipset ---
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  jq \
  git \
  gh \
  nano \
  vim \
  unzip \
  build-essential \
  # firewall networking
  ipset \
  iptables \
  dnsutils \
  aggregate \
  # Use the same fonts as in CI
  fonts-dejavu-core \
  fonts-dejavu-extra \
  fonts-dejavu-mono \
  fonts-lato \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# The base image has no Python; uv supplies the version the backend runs.
COPY --from=ghcr.io/astral-sh/uv:0.13.6@sha256:af22a52f5eafef3d78e551599d405c02df61919d18028f0cea8eda93bc9986d0 /uv /usr/local/bin/uv

ARG USERNAME=vscode

# Persist bash history and set ownership (combined for fewer layers)
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" && \
  mkdir -p /commandhistory /workspace /home/$USERNAME/.claude && \
  touch /commandhistory/.bash_history && \
  chown -R $USERNAME:$USERNAME /commandhistory /workspace /home/$USERNAME/.claude

WORKDIR /workspace

# Switch to non-root user for remaining setup
USER $USERNAME

# Set PATH early so claude and other user-installed binaries are available
ENV PATH="/home/$USERNAME/.local/bin:$PATH"

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# --- Claude Code CLI (installed as the claude user so it lands in ~/.local/bin) ---
# This layer is intentionally placed before the common system packages so that
# adding new packages does not invalidate this slow download step.
RUN curl -fsSL https://claude.ai/install.sh | bash

USER root
RUN cp /home/$USERNAME/.local/bin/claude /usr/local/bin/claude && \
  chmod +x /usr/local/bin/claude

RUN git config --global --add safe.directory '*'

# Copy and set up firewall script
COPY .devcontainer/init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "$USERNAME ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/$USERNAME-firewall && \
  chmod 0440 /etc/sudoers.d/$USERNAME-firewall && \
  rm -f /etc/sudoers.d/$USERNAME

# --- Node ----------------------------------------------------------------
# NODE_MAJOR must match frontend/Dockerfile and ci.yml; verify-deps.sh checks.
# `latest-vN.x`, not a fixed patch, which would 404 once superseded.
ARG NODE_MAJOR=24
RUN case "$(dpkg --print-architecture)" in \
  amd64) NODE_ARCH=x64 ;; \
  arm64) NODE_ARCH=arm64 ;; \
  *) echo "unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
  esac && \
  NODE_DIST="https://nodejs.org/dist/latest-v$NODE_MAJOR.x" && \
  cd /tmp && \
  curl -fsSL -O "$NODE_DIST/SHASUMS256.txt" && \
  NODE_TARBALL="$(grep -o "node-v[0-9.]*-linux-$NODE_ARCH\.tar\.xz" SHASUMS256.txt \
  | head -n 1)" && \
  curl -fsSL -O "$NODE_DIST/$NODE_TARBALL" && \
  grep " $NODE_TARBALL\$" SHASUMS256.txt | sha256sum -c - && \
  tar -xJf "$NODE_TARBALL" -C /usr/local --strip-components=1 \
  --exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md && \
  rm -f "$NODE_TARBALL" SHASUMS256.txt && \
  node --version && npm --version

USER $USERNAME

# --- Backend tooling venv (pytest, ruff, alembic, uvicorn) ---------------
# Baked in rather than installed by postCreate, which cannot reach a registry
# however early it runs: compose.yaml's `dns:` key makes the allowlisting
# resolver active before any lifecycle hook. The image build is host-side, on the
# ordinary network.
#
# The interpreter is uv's standalone CPython. PYTHON_VERSION
# must match backend/Dockerfile and ci.yml; verify-deps.sh checks. The venv is
# in $HOME because the bind mount would mask anything baked under /workspace,
# and is seeded with pip so a terminal `pip install` works as it always has.
#
# Only the requirements files are copied, so application edits do not invalidate
# this layer — and it is why the build context is the repo root.
ARG PYTHON_VERSION=3.12
COPY --chown=$USERNAME:$USERNAME backend/requirements.txt backend/requirements-dev.txt /tmp/requirements/
RUN uv venv --seed --python-preference only-managed --python "$PYTHON_VERSION" \
  /home/$USERNAME/.venv && \
  /home/$USERNAME/.venv/bin/pip install --no-cache-dir -r /tmp/requirements/requirements-dev.txt && \
  rm -rf /tmp/requirements

# --- Chromium for the frontend's real-browser test suite -----------------
# The Playwright version is read from frontend/package.json
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY frontend/package.json /tmp/frontend-package.json
RUN npx --yes \
  "playwright@$(jq -r .devDependencies.playwright /tmp/frontend-package.json)" \
  install --with-deps chromium && \
  rm -rf /tmp/frontend-package.json /root/.npm /var/lib/apt/lists/* && \
  chmod -R a+rX /ms-playwright
USER $USERNAME

ENV EDITOR=vim
