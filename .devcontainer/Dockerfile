FROM mcr.microsoft.com/devcontainers/base:ubuntu24.04@sha256:4bcb1b466771b1ba1ea110e2a27daea2f6093f9527fb75ee59703ec89b5561cb

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
  # for the venv below; the base image's python3 is the 3.12 the backend runs,
  # and python3-venv is a separate package from python3 on Ubuntu
  python3-venv \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

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
# Not the node feature: its default is not a pin, and features are layered on
# after this Dockerfile, so no build step could use the node they provide.
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
# A venv because Ubuntu's interpreter is PEP 668 externally-managed; in $HOME
# because the bind mount would mask anything baked under /workspace.
#
# Only the requirements files are copied, so application edits do not invalidate
# this layer — and it is why the build context is the repo root.
COPY --chown=$USERNAME:$USERNAME backend/requirements.txt backend/requirements-dev.txt /tmp/requirements/
RUN python3 -m venv /home/$USERNAME/.venv && \
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
