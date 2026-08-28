FROM mcr.microsoft.com/devcontainers/base:ubuntu24.04@sha256:4bcb1b466771b1ba1ea110e2a27daea2f6093f9527fb75ee59703ec89b5561cb

# --- Install basic development tools and iptables/ipset ---
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  jq \
  git \
  nano \
  vim \
  unzip \
  build-essential \
  # firewall networking
  ipset \
  iptables \
  dnsutils \
  aggregate \
  # for the venv below; the python feature runs after this Dockerfile, and
  # python3-venv is a separate package from python3 on Ubuntu
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

ENV EDITOR=vim
