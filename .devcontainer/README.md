# Claude Code - Dev Container Setup

A secure, consistent environment for using Claude Code. Works on Windows and macOS.

---

## Prerequisites

Install these once on your machine.

**Required for everyone:**

| Tool                             | Download                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| VS Code                          | https://code.visualstudio.com                                                                                                             |
| VS Code Dev Containers extension | Search "Dev Containers" in VS Code Extensions, or: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers |

**Then choose one container runtime:**

### Option A — Docker Desktop

Download and install Docker Desktop: https://www.docker.com/products/docker-desktop

On **Windows**: make sure Docker Desktop is set to use WSL 2 (the default). You do not need to install WSL yourself.

### Option B — Rancher Desktop

Install Rancher Desktop: https://rancherdesktop.io

Two settings matter:

- **Container engine: `dockerd (moby)`**, not containerd. The Dev Containers extension drives the `docker` CLI and Compose, which the containerd/nerdctl backend does not provide.
- **Give the VM enough headroom.** This project runs five containers, and the image build installs the Python toolchain — the defaults are usually fine, but a build that dies without explanation is the first thing to check.

Rancher Desktop puts its CLI tools in `~/.rd/bin`. If VS Code reports that it cannot find Docker while `docker ps` works in your terminal, it is a PATH problem: VS Code launched from the Dock or Start menu does not inherit your shell's PATH. Either launch it with `code .` from a terminal, or point it at the binary directly in `settings.json` (`Ctrl+Shift+P` → "Open User Settings (JSON)"):

```json
"dev.containers.dockerPath": "docker"
```

The `NET_ADMIN`/`NET_RAW` capabilities the firewall needs are scoped to the container's own user and network namespace and grant no privilege on the host or the VM.

### Two host-side settings you have to apply yourself

Neither can be set from `devcontainer.json`, because both are host configuration. Do
them once per machine.

**1. Move git hooks out of the workspace.**

```bash
git config --global core.hooksPath ~/.githooks
```

`.git/hooks` lives inside the bind mount, so anything running in the container can
write an executable there — and it then runs on **your host**, with your privileges,
the next time you use git in that repo. You push from the host, so that next time is
soon. This is the sharpest boundary in the setup that the container genuinely cannot
close for you.

**2. Stop forwarding your SSH agent.**

Add to your VS Code user `settings.json`:

```json
"dev.containers.forwardSshAgent": false
```

VS Code forwards the host SSH agent into dev containers by default, which would give
the container your push credentials. The division of labour here is that the container
commits and you review and push, so it has no need for them. `devcontainer.json` also
clears `SSH_AUTH_SOCK` via `containerEnv`, which breaks the socket's consumers, but
only this setting stops the socket being mounted at all.

Git _identity_ is a different matter and is fine to share — it is not a credential.
VS Code copies `~/.gitconfig` in for you; `verify-deps.sh` warns if it didn't, because
otherwise the first thing you learn is that `git commit` refuses.

---

## Using the container

> **For each new folder you want to work in:** copy the `.devcontainer/` folder into it first.

1. Ensure your container runtime (Docker Desktop or Rancher Desktop) is running.
2. Open your working folder in VS Code (`File > Open Folder`).
3. Click **"Reopen in Container"** when prompted, or open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Dev Containers: Reopen in Container**.
   - The first build takes a few minutes; subsequent opens are fast.
4. Run `claude` in the terminal to start.

---

## Running the app

Opening the folder starts **five** services. `.devcontainer/compose.yaml` `include:`s
the repo-root `docker-compose.yml` verbatim and adds two services of its own:

| Service    | What it is                 | Internet          |
| ---------- | -------------------------- | ----------------- |
| `app`      | you and Claude Code        | allowlist only    |
| `backend`  | uvicorn, hot reload        | **none**          |
| `frontend` | Vite dev server, HMR       | **none**          |
| `db`       | Postgres 16                | **none**          |
| `dns`      | CoreDNS, allowlisted zones | upstream DNS only |

`db`, `backend` and `frontend` have exactly one definition, in the root
`docker-compose.yml`. There is no second copy here to drift out of sync. `app` and
`dns` exist only in the devcontainer and have no production counterpart.

You don't start the app — it is already running. Both dev servers hot-reload from the
bind mounts, so editing `backend/` or `frontend/` takes effect with no restart. Open
http://localhost:5173; VS Code forwards `frontend:5173` and `backend:8000` by service
name. Vite proxies `/api` to `backend:8000` over the compose network.

The backend reads its secrets from the repo-root `.env`. That file is gitignored, so
on a fresh clone copy `.env.example` to `.env` and fill it in **before** reopening —
otherwise `SECRET_KEY` is missing and uvicorn refuses to start.

Run migrations from `app`, which has Python and can reach `db`:

```bash
cd backend && alembic upgrade head
```

Python tooling (`pytest`, `ruff`, `alembic`, `uvicorn`) is baked into the `app` image
at build time and lands in `/home/vscode/.venv`, which is first on `PATH`. Ubuntu's
own interpreter is PEP 668 "externally managed", so a `pip install` outside that venv
is refused — if you see `error: externally-managed-environment`, your shell has lost
the venv rather than needing `--break-system-packages`. Check with `which pip`.

Node tooling (`eslint`, `tsc`, `prettier`, `vitest`) is **not** baked in, because npm
arrives via a devcontainer feature applied after the image is built. `postCreateCommand`
runs `npm ci` for the root and `frontend/` instead, which works because
`registry.npmjs.org` is allowlisted. Nothing to do by hand.

`node_modules` lives in the bind-mounted workspace, so it persists on your machine
between rebuilds — but `npm ci` deletes and repopulates it on every rebuild by design,
so a rebuild is not instant. postCreate finishes with
`.devcontainer/verify-deps.sh`, which fails loudly if anything is missing; don't ignore
a red postCreate. See **Adding a dependency** below.

### Restarting the stack without closing VS Code

Yes. `app` and the three app services are separate containers in one project, so you
can recycle the others and keep your editor session and Claude Code alive. From the
**host**:

```bash
P=$(docker compose ls --format json | grep -o '"Name":"[^"]*devcontainer[^"]*"' | head -1 | cut -d'"' -f4)

docker compose -p "$P" restart backend frontend db     # bounce them
docker compose -p "$P" up -d --build backend frontend  # rebuild after a dep change
```

Two things to know:

- **There is no Docker CLI inside `app`,** so this is host-side only. Claude cannot
  restart or rebuild the stack. That is deliberate — a Docker socket in `app` would
  be a container-escape primitive — and hot reload covers ordinary edits anyway.
- **Prefer `restart` / `up -d` over `down`.** `down` destroys the compose networks, so
  the stack can come back on a different subnet, and `app`'s firewall pins the allowed
  subnets at container start. The symptom is `db` going unreachable from `app` for no
  visible reason. Fix it from inside `app`:

  ```bash
  sudo /usr/local/bin/init-firewall.sh
  ```

### Adding a dependency

The **app containers** — `db`, `backend`, `frontend` — cannot reach a registry at all,
and never will: `appnet` is `internal: true`, so their dependencies are fixed at image
build time. `app` _can_, because pypi and the npm registry are on its allowlist.

The image is still the source of truth, so that the environment is reproducible and a
rebuild doesn't depend on a registry being up:

| For                            | Where it installs                        | How to refresh              |
| ------------------------------ | ---------------------------------------- | --------------------------- |
| `backend` / `frontend` runtime | image build (`Dockerfile`)               | `up -d --build` on the host |
| `app` Python tooling           | image build (`.devcontainer/Dockerfile`) | Rebuild the dev container   |
| `app` Node tooling             | `npm ci` in `postCreateCommand`          | Rebuild the dev container   |

So the durable path is: edit `backend/requirements*.txt` or `frontend/package.json`,
then rebuild. A `pip install` or `npm install` in an `app` terminal now works too — use
it to try a dependency out, then move it into the requirements file or manifest and
rebuild to make it stick. Anything installed only in a terminal is gone on the next
rebuild.

`npm ci` rather than `npm install` in postCreate, deliberately: it installs exactly the
lockfile and fails when the lockfile and `package.json` disagree, instead of quietly
resolving something neither of them pinned. It also runs package install hooks, which
is the concrete cost of allowlisting a registry — see **Known gaps**.

One piece of history worth keeping, because the mistake is easy to repeat: installs
used to live in `postCreateCommand` on the reasoning that it runs before
`postStartCommand` fires the firewall. That reasoning is wrong even now that the
registries are allowlisted, because egress here was never only iptables —
`compose.yaml`'s `dns:` key makes the allowlisting CoreDNS this container's resolver
from the moment it starts, which is before any lifecycle hook. Back when no registry
zone existed, a `pip install` in postCreate could not resolve `pypi.org` no matter how
early it ran, and it failed silently for two weeks because stale `node_modules` on the
bind mount made the workspace look provisioned. The lesson is about the Corefile, not
about hook ordering.

### Starting from an empty database

The Postgres data lives in a named volume and survives a rebuild. To start from an
empty database, run this on the host before reopening:

```bash
docker compose -p <folder>_devcontainer -f .devcontainer/compose.yaml down -v
```

`-p` matters: VS Code names the project after the folder you opened (`mission` →
`mission_devcontainer`), so without it Compose looks at a project that owns no
volumes and reports success while the old data survives. `docker compose ls` shows
the real name.

Wipe the volume whenever the `db` service's image major or its data-dir mount path
changes — Postgres refuses to start on a data directory another major initialised,
and the container exits 1 before the healthcheck ever runs.

---

## What is and isn't accessible inside the container

- **Only the folder you opened** is accessible inside the container. Claude cannot see other files on your machine.
- Organisation security settings are enforced via server-managed settings and cannot be changed.

### Network access

A firewall runs automatically on every container start and restricts `app`'s outbound
traffic to a fixed allowlist:

| Destination                                                | Purpose                     | Required? |
| ---------------------------------------------------------- | --------------------------- | --------- |
| `api.anthropic.com`, `platform.claude.com`                 | Claude Code                 | yes       |
| GitHub IP ranges                                           | Git operations              | yes       |
| `pypi.org`, `files.pythonhosted.org`, `registry.npmjs.org` | pip / npm                   | no        |
| the compose subnet                                         | `db`, `backend`, `frontend` | n/a       |
| the `dns` container, port 53 only                          | name resolution             | n/a       |

All other outbound access is rejected immediately (ICMP admin-prohibited).

The **Required?** column is load-bearing. `init-firewall.sh` pins A records at
container start, so a name that fails to resolve stops the script — and since it fails
closed (below), that would take the whole container with it. The registries are
CDN-hosted and their edge IPs rotate, so they are treated as optional: unresolvable
means a warning and no allowlist entry, not an abort. You lose installs until the
script is re-run; you don't lose the environment. The startup reachability probes for
them are warn-only for the same reason.

Registry access is a **deliberate relaxation, not a default**. pip and npm both execute
package-authored install hooks, so an agent that can reach a registry can fetch and run
arbitrary code, and together with the GitHub ranges that makes egress allowlisting a
speed bump against exfiltration rather than a boundary. What still holds: arbitrary
domains don't resolve, every query is logged, and the app stack has no route out at all.

If `init-firewall.sh` aborts for any reason it **fails closed**: a trap drops all
policies to `DROP`, leaving loopback only, and prints how to re-run it. Before that
trap existed an aborted run left the flushed, all-ACCEPT tables from its own first
step, and the self-checks that would have caught it sat past the abort point — so the
container had unrestricted raw-IP egress while looking contained to any test that went
through a hostname. Adding an unresolvable name to `allowed_domains` was enough to
trigger it.

Adding a destination therefore means **two** files: `required_domains` or
`optional_domains` in `init-firewall.sh`, and a zone in `coredns/Corefile`. The
allowlist is resolved through that resolver, so a name missing from the Corefile yields
no A records — which aborts the script if the name is required, and skips it with a
warning if it is optional. The warning case is the more confusing one: installs just
fail, with nothing pointing at DNS. Run `verify-egress.sh` afterwards.

#### Why the other containers have no internet either

A firewall inside `app` can only shape `app`'s own network namespace — it cannot
restrain a sibling container. And it doesn't need to be attacked over the network to
be bypassed: `backend` bind-mounts `./backend` and runs `uvicorn --reload`, so
anything that can write a file in this workspace can execute code in that container
and read the result back through the same mount. Filesystem in, filesystem out, no
packet ever crossing `app`'s firewall.

Rules can't close that. Topology can: `appnet` is declared `internal: true`, which
strips the default route from `db`, `backend` and `frontend`. The pivot still works
and gains nothing, because the container on the far end has nowhere to go. `app`
alone keeps a route out, on a network of its own, where the allowlist applies.

#### DNS is allowlisted too

An IP allowlist cannot filter DNS, because in DNS the payload _is_ the destination:
the query name is data going out and the answer is data coming back. Point queries at
a nameserver you control and you have a bidirectional tunnel that needs no
allowlisted host at all — `iodine` and `dnscat2` are ready-made implementations.

So there is a fifth container, `dns`, running CoreDNS as an allowlisting resolver
(`.devcontainer/coredns/Corefile`). Zones listed there are forwarded upstream;
everything else gets `REFUSED`. The firewall permits UDP/53 and TCP/53 to that
container and rejects port 53 to every other address, so it is the only resolver
`app` can reach — including the host gateway, which on Docker Desktop proxies DNS and
would otherwise be a way straight out.

Compose service names keep working: `app` still has Docker's embedded resolver at
`127.0.0.11` in `resolv.conf`, which answers `db`/`backend`/`frontend` itself and
forwards only what it can't resolve. The `dns:` key in `.devcontainer/compose.yaml`
sets that resolver's _upstream_, it doesn't replace it.

Every query, refusals included, is logged. That makes an exfil attempt visible:

```bash
docker compose -p "$P" logs dns
```

#### Confirming it all holds

Run this **on the host**:

```bash
.devcontainer/verify-egress.sh
```

It checks that `appnet` is internal, that only `app` and `dns` have an egress route
and that neither of the non-`app` ones mounts the workspace, that each app container
really cannot open a socket to the internet, that an allowlisted name resolves while
an arbitrary one does not, and that `app` can still reach Anthropic and `db`.
`init-firewall.sh` can verify the DNS behaviour and its own reachability, but nothing
about the sibling containers — it can only see its own namespace.

#### Known gaps

- **Allowlisted IPs are pinned at container start** by A record and never refreshed.
  A long-lived container can eventually lose access as CDN edges rotate. Re-run
  `init-firewall.sh` to fix. This bites the registries most, which is why they are
  optional rather than required. The proper fix is an allowlisting HTTP proxy that
  filters by hostname instead of ipset entries that go stale; see the plan doc.
- **Registry access is fetch-and-execute.** pip and npm run package-authored install
  hooks, so anything able to run a command in `app` can pull and execute arbitrary
  code from pypi or npm. Lockfiles (`npm ci`, pinned `requirements*.txt`) are the
  mitigation that actually works here. This is an accepted trade, not an oversight.
- **Anything reachable via GitHub** — Actions, Gists, raw content — is in scope, since
  the allowlist is GitHub's published IP ranges rather than specific repositories. The
  Corefile's `github.com` zone is similarly broad.
- **The `dns` container itself has unrestricted egress**, since it forwards upstream.
  It is not a pivot because there is no way to run code in it — no workspace mount,
  and the CoreDNS image ships no shell — but it is the one component where that
  argument is a design property rather than an enforced boundary.

### Persistent configuration

Claude's configuration and settings are stored in a named Docker volume (`devc-<folder>-config-<devcontainerId>`), not inside the container filesystem. Bash history gets its own volume (`devc-<folder>-bashhistory-<devcontainerId>`). Both survive container rebuilds and image updates.

### Auto-updates and telemetry

`DISABLE_AUTOUPDATER=1` and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` are set by default. Claude Code will not auto-update inside the container and non-essential network traffic (telemetry, update checks) is suppressed.

---

## For administrators

Organisation-level policy is enforced via server-managed settings in the Claude.ai admin console - these are fetched at login and cannot be overridden by users or project files.
