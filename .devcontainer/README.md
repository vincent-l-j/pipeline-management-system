# Claude Code - Dev Container Setup

A secure, consistent environment for using Claude Code. Works on Windows and macOS.

---

## Prerequisites

Install these once on your machine.

**Required for everyone:**

| Tool | Download |
|------|----------|
| VS Code | https://code.visualstudio.com |
| VS Code Dev Containers extension | Search "Dev Containers" in VS Code Extensions, or: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers |

**Then choose one container runtime:**

### Option A — Docker Desktop

Download and install Docker Desktop: https://www.docker.com/products/docker-desktop

On **Windows**: make sure Docker Desktop is set to use WSL 2 (the default). You do not need to install WSL yourself.

### Option B — Podman

Install Podman via your package manager or Podman Desktop: https://podman.io

Then tell VS Code to use Podman instead of Docker. Add this to your VS Code `settings.json` (`Ctrl+Shift+P` → "Open User Settings (JSON)"):

```json
"dev.containers.dockerPath": "podman"
```

Alternatively, open VS Code Settings (`Ctrl+,` / `Cmd+,`) and set **Dev > Containers: Docker Path** to `podman`.

---

## Using the container

> **For each new folder you want to work in:** copy the `.devcontainer/` folder into it first.

1. Ensure your container runtime (Docker or Podman) is running.
2. Open your working folder in VS Code (`File > Open Folder`).
3. Click **"Reopen in Container"** when prompted, or open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Dev Containers: Reopen in Container**.
   - The first build takes a few minutes; subsequent opens are fast.
4. Run `claude` in the terminal to start.

---

## What is and isn't accessible inside the container

- **Only the folder you opened** is accessible inside the container. Claude cannot see other files on your machine.
- Organisation security settings are enforced via server-managed settings and cannot be changed.

### Network access

A firewall runs automatically on every container start and restricts outbound traffic to a fixed allowlist:

| Service | Purpose |
|---------|---------|
| `api.anthropic.com`, `platform.claude.com` | Claude Code |
| GitHub IP ranges | Git operations |
| `registry.npmjs.org` | npm installs |
| `pypi.org`, `files.pythonhosted.org` | pip installs |

All other outbound internet access is blocked. If a tool or script tries to reach an unlisted host it will be rejected immediately (ICMP admin-prohibited).

### Persistent configuration

Claude's configuration and settings are stored in a named Docker volume (`claude-code-config-<id>`), not inside the container filesystem. This means your Claude settings survive container rebuilds and image updates.

### Auto-updates and telemetry

`DISABLE_AUTOUPDATER=1` and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` are set by default. Claude Code will not auto-update inside the container and non-essential network traffic (telemetry, update checks) is suppressed.

---

## For administrators

Organisation-level policy is enforced via server-managed settings in the Claude.ai admin console - these are fetched at login and cannot be overridden by users or project files.
