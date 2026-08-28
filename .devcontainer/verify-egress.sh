#!/usr/bin/env bash
# Verify that the app stack has no route to the internet.
#
# RUN THIS ON YOUR HOST, not inside the dev container — it needs the Docker CLI,
# which `app` deliberately does not have.
#
#     .devcontainer/verify-egress.sh
#
# init-firewall.sh sees only `app`'s own namespace, but the siblings are the
# interesting surface: `backend` mounts the workspace and runs uvicorn --reload,
# so if it had egress the firewall would be decorative. appnet's internal:true is
# what prevents that, and this proves it still holds.
#
# Exit 0 = contained. Non-zero = a path out exists; read the output.
set -euo pipefail
IFS=$'\n\t'

fail=0
note() { printf '%s\n' "$*"; }
pass() { printf '  PASS  %s\n' "$*"; }
bad()  { printf '  FAIL  %s\n' "$*"; fail=1; }

# VS Code names the project after the opened folder plus `_devcontainer`, so it
# is not the repo directory name and cannot be assumed.
PROJECT="${COMPOSE_PROJECT_NAME:-}"
if [ -z "$PROJECT" ]; then
    PROJECT=$(docker compose ls --format json 2>/dev/null \
        | grep -o '"Name":"[^"]*devcontainer[^"]*"' \
        | head -1 | cut -d'"' -f4 || true)
fi
if [ -z "$PROJECT" ]; then
    note "Could not find a running *_devcontainer compose project."
    note "Open the folder in the dev container first, or set COMPOSE_PROJECT_NAME."
    note "\`docker compose ls\` shows what is running."
    exit 2
fi
note "Compose project: $PROJECT"
note ""

# --- 1. appnet must be internal ----------------------------------------
# The structural check. `internal: true` is what strips the default route.
NET="${PROJECT}_appnet"
if ! docker network inspect "$NET" >/dev/null 2>&1; then
    bad "network $NET does not exist (did the include: of docker-compose.yml resolve?)"
else
    internal=$(docker network inspect "$NET" --format '{{.Internal}}')
    if [ "$internal" = "true" ]; then
        pass "$NET is internal"
    else
        bad "$NET is NOT internal - db/backend/frontend can reach the internet"
    fi
fi

# --- 2. only app and dns may sit on the egress network ------------------
# Members of `egress` sit on the /24 that init-firewall.sh accepts wholesale, so
# each one is reachable from `app` on every port and is a candidate pivot. `dns`
# is tolerated because it offers no way to run code: no workspace mount, and no
# shell in the coredns image. Anything else appearing here is a finding.
EGRESS="${PROJECT}_egress"
if docker network inspect "$EGRESS" >/dev/null 2>&1; then
    members=$(docker network inspect "$EGRESS" \
        --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' | sed '/^$/d')
    unexpected=$(printf '%s\n' "$members" | grep -vE -- '-(app|dns)-[0-9]+$' || true)
    if [ -z "$unexpected" ]; then
        pass "egress members are app + dns only"
    else
        bad "unexpected containers on the egress network: $(echo "$unexpected" | tr '\n' ' ')"
    fi
    # A workspace mount on an egress container turns it into a code-execution
    # target reachable by anything that can write a file — the exact pivot that
    # internal:true exists to prevent for the app stack.
    for c in $members; do
        case "$c" in
        *-app-*) continue ;;
        esac
        if docker inspect "$c" --format '{{range .Mounts}}{{.Destination}} {{end}}' 2>/dev/null |
            grep -q /workspace; then
            bad "$c is on egress AND mounts the workspace - that is a pivot"
        else
            pass "$c has no workspace mount"
        fi
    done
else
    bad "network $EGRESS does not exist"
fi

# --- 2b. DNS is an allowlist, not a tunnel ------------------------------
# Behavioural, rather than diffing the Corefile against init-firewall.sh's lists.
# Compose service names are checked too: breaking those is the likeliest error.
appid_dns=$(docker compose -p "$PROJECT" ps -q app 2>/dev/null || true)
if [ -z "$appid_dns" ]; then
    note "  SKIP  app is not running, cannot test DNS"
else
    if docker exec "$appid_dns" getent hosts api.github.com >/dev/null 2>&1; then
        pass "app resolves an allowlisted name"
    else
        bad "app cannot resolve api.github.com - resolver down or Corefile wrong"
    fi
    if docker exec "$appid_dns" getent hosts dns-tunnel-probe.example.net >/dev/null 2>&1; then
        bad "app resolved an arbitrary name - DNS TUNNEL IS OPEN"
    else
        pass "app cannot resolve arbitrary names"
    fi
    if docker exec "$appid_dns" getent hosts db >/dev/null 2>&1; then
        pass "app still resolves compose service names"
    else
        bad "app cannot resolve db - embedded resolver broken by the dns: override"
    fi
fi

# --- 3. live check: siblings cannot actually get out --------------------
# Belt and braces over the structural check above. Connect by IP, not hostname,
# so a DNS failure cannot masquerade as containment. 1.1.1.1:443 needs no
# credentials and no allowlist entry anywhere.
#
# A negative assertion needs a positive control, or a broken probe reads as
# containment. This section once used `sh -c ': < /dev/tcp/...'` — /dev/tcp is a
# bash builtin and /bin/sh is dash in all three images, so it failed every time
# and db and frontend reported PASS without sending a packet. Each probe is
# therefore aimed at db:5432 first; if that control fails the result is reported
# as untrustworthy rather than as a pass.

# Echo a TCP-connect mechanism that actually exists in container $1, or nothing.
probe_kind() {
    if docker exec "$1" sh -c 'command -v python3' >/dev/null 2>&1; then
        echo python
    elif docker exec "$1" sh -c 'command -v bash' >/dev/null 2>&1; then
        echo bash
    fi
}

# Connect to $2:$3 from container $1 using mechanism $4. 0 = connected.
tcp_connect() {
    local cid="$1" host="$2" port="$3" kind="$4"
    case "$kind" in
        python)
            docker exec "$cid" timeout 8 python3 -c \
                "import socket; socket.create_connection(('$host', $port), timeout=5).close()" \
                >/dev/null 2>&1
            ;;
        bash)
            docker exec "$cid" timeout 8 bash -c ": < /dev/tcp/$host/$port" \
                >/dev/null 2>&1
            ;;
        *)
            return 1
            ;;
    esac
}

for svc in backend db frontend; do
    cid=$(docker compose -p "$PROJECT" ps -q "$svc" 2>/dev/null || true)
    if [ -z "$cid" ]; then
        note "  SKIP  $svc is not running"
        continue
    fi

    kind=$(probe_kind "$cid")
    if [ -z "$kind" ]; then
        bad "$svc has neither python3 nor bash - cannot verify containment"
        continue
    fi

    # Positive control first. Without it a broken probe reads as containment.
    if ! tcp_connect "$cid" db 5432 "$kind"; then
        bad "$svc: probe control failed ($kind cannot reach db:5432 on appnet) - the containment result for $svc is NOT trustworthy"
        continue
    fi

    if tcp_connect "$cid" 1.1.1.1 443 "$kind"; then
        bad "$svc REACHED the internet"
    else
        pass "$svc cannot reach 1.1.1.1:443 ($kind probe, control passed)"
    fi
done

# --- 4. app must still work ---------------------------------------------
# Containment that also breaks the allowlist is a misconfiguration, not a win.
appid=$(docker compose -p "$PROJECT" ps -q app 2>/dev/null || true)
if [ -z "$appid" ]; then
    note "  SKIP  app is not running"
else
    # Any HTTP status means the TCP+TLS path worked, which is what is being
    # tested. Don't use `curl -f` here: api.anthropic.com answers an
    # unauthenticated GET with 401, and -f would report that as failure.
    code=$(docker exec "$appid" timeout 8 curl -s -o /dev/null \
        -w '%{http_code}' https://api.anthropic.com 2>/dev/null || echo 000)
    if [ "$code" != "000" ]; then
        pass "app can still reach api.anthropic.com (HTTP $code)"
    else
        bad "app CANNOT reach api.anthropic.com - firewall too tight or stale ipset"
    fi
    app_kind=$(probe_kind "$appid")

    # By IP, not hostname: a name outside the Corefile fails at DNS so the
    # assertion passes without sending a packet, and a name inside it is in the
    # ipset by design. The anthropic check above is the positive control.
    if [ -z "$app_kind" ]; then
        bad "app has neither python3 nor bash - cannot check the IP allowlist"
    elif tcp_connect "$appid" 1.1.1.1 443 "$app_kind"; then
        bad "app REACHED 1.1.1.1:443 - the destination-IP allowlist is not in effect"
    else
        pass "app cannot reach 1.1.1.1:443 ($app_kind probe)"
    fi

    # Same dash/bash bug as section 3, opposite polarity: it reported a FAIL on a
    # perfectly reachable database.
    if [ -z "$app_kind" ]; then
        bad "app has neither python3 nor bash - cannot check db reachability"
    elif tcp_connect "$appid" db 5432 "$app_kind"; then
        pass "app can reach db:5432"
    else
        bad "app CANNOT reach db:5432 - stale ipset? re-run init-firewall.sh in app"
    fi
fi

note ""
if [ "$fail" -eq 0 ]; then
    note "OK - app stack is contained, app keeps its allowlist."
else
    note "PROBLEMS FOUND - see FAIL lines above."
fi
exit "$fail"
