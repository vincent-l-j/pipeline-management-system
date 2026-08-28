#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Unresolvable here means abort, which the trap below turns into a fail-closed
# container. Right for these: a failure means the resolver or Corefile is broken,
# not that a CDN moved.
required_domains=(
    "api.anthropic.com"
    "platform.claude.com"
)

# Unresolvable here means warn and carry on, because these are CDN-hosted and
# this script pins A records at start — a transient edge-IP hiccup must not fail
# the container closed. Losing installs is the right failure; losing the
# container is not.
#
# NOTE ON PACKAGE REGISTRIES: a priced-in relaxation. pip and npm run
# package-authored install hooks, so this is a fetch-and-execute channel, and
# with the GitHub ranges below it makes egress allowlisting a speed bump against
# exfiltration rather than a boundary. Still holding: arbitrary names do not
# resolve, every query is logged, and the app stack has no route out at all.
optional_domains=(
    "pypi.org"
    "files.pythonhosted.org"
    "registry.npmjs.org"
)

# Every `exit 1` below lands after the flush and before the DROP policies, so
# without this an abort leaves all-ACCEPT tables and full raw-IP egress — and the
# self-checks that would catch it are past the abort point too. The policies
# cannot just move to the top: this script needs egress of its own mid-run,
# before the ipset that would permit it exists.
#
# Loopback only. Restoring the subnet rules would also restore the route to the
# egress gateway, which proxies DNS on Docker Desktop. Losing `db` until the
# error is fixed is the intended cost.
lockdown_on_failure() {
    local rc=$?
    [ "$rc" -eq 0 ] && return 0
    echo "ERROR: init-firewall.sh aborted (exit $rc) - failing CLOSED" >&2
    iptables -F 2>/dev/null || true
    iptables -A INPUT  -i lo -j ACCEPT 2>/dev/null || true
    iptables -A OUTPUT -o lo -j ACCEPT 2>/dev/null || true
    iptables -P INPUT DROP   2>/dev/null || true
    iptables -P FORWARD DROP 2>/dev/null || true
    iptables -P OUTPUT DROP  2>/dev/null || true
    if command -v ip6tables >/dev/null 2>&1; then
        ip6tables -F 2>/dev/null || true
        ip6tables -P INPUT DROP   2>/dev/null || true
        ip6tables -P FORWARD DROP 2>/dev/null || true
        ip6tables -P OUTPUT DROP  2>/dev/null || true
    fi
    echo "This container now has no network beyond loopback. Fix the error" >&2
    echo "above, then re-run: sudo /usr/local/bin/init-firewall.sh" >&2
}
trap lockdown_on_failure EXIT

# 1. Extract Docker DNS info BEFORE any flushing
# This is what makes `db` resolve. If it is lost, the app cannot find
# Postgres and the failure looks like a database problem, not a firewall one.
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# The policy reset only matters on a RE-RUN, which is the documented remedy for a
# stale ipset. `iptables -F` does not reset chain policies, so a re-run would
# inherit OUTPUT DROP while `ipset destroy` removes what made it survivable,
# starving the GitHub fetch below — which populates the ipset and so cannot be
# allowlisted ahead of itself. The trap above covers the open window.
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# --- DNS ----------------------------------------------------------------
# An IP allowlist cannot filter DNS — the query name is the destination — so any
# reachable nameserver is a tunnel. These rules make coredns the only one.
#
# ORDER IS LOAD-BEARING: the HOST_NETWORK and ipset accepts further down both
# cover the gateway, which proxies DNS on Docker Desktop, so `dig @<gateway>`
# would reopen the tunnel. The REJECT must sit above them — hence this block
# here rather than beside the other destination rules.
DNS_ALLOWLIST_SERVER="${DNS_ALLOWLIST_SERVER:-}"
if [ -z "$DNS_ALLOWLIST_SERVER" ]; then
    # Fall back to resolving the service name. Works before any restriction
    # because Docker's embedded resolver answers compose names locally.
    DNS_ALLOWLIST_SERVER=$(getent hosts dns | awk '{print $1; exit}' || true)
fi
if [ -z "$DNS_ALLOWLIST_SERVER" ]; then
    echo "ERROR: no DNS_ALLOWLIST_SERVER and the 'dns' service does not resolve."
    echo "       Is the dns service running? Without it, locking DNS down would"
    echo "       leave this container with no resolver at all."
    exit 1
fi
echo "Allowlisting resolver: $DNS_ALLOWLIST_SERVER"

# Wait for it to actually answer. The coredns image has no shell, so compose
# cannot healthcheck it, and a query issued before it is listening would fail
# the GitHub fetch below with a misleading error.
for _ in $(seq 1 30); do
    getent hosts api.github.com >/dev/null 2>&1 && break
    sleep 1
done

# The embedded resolver forwards what it cannot answer, and that forward leaves
# this namespace as ordinary OUTPUT traffic — so this rule, not the loopback one,
# is what keeps external resolution working.
iptables -A OUTPUT -d 127.0.0.11 -j ACCEPT

iptables -A OUTPUT -p udp --dport 53 -d "$DNS_ALLOWLIST_SERVER" -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -d "$DNS_ALLOWLIST_SERVER" -j ACCEPT
# Everything else claiming to be DNS, to any other address, dies here.
iptables -A OUTPUT -p udp --dport 53 -j REJECT --reject-with icmp-admin-prohibited
iptables -A OUTPUT -p tcp --dport 53 -j REJECT --reject-with icmp-admin-prohibited
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Do NOT add a blanket port 22 accept here: it would sit above the REJECT below
# and permit `ssh -D` to any host. Git over SSH still works via the GitHub CIDRs
# in the ipset, which match by destination rather than port.
#
# Loopback no longer covers the dev servers — they are siblings on appnet.
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset with CIDR support
ipset create allowed-domains hash:net

# Read from the routing table, not hardcoded: 172.16.0.0/12 is only Docker's
# default pool and any network with an explicit `subnet:` can fall outside it.
#
# Pinned at container start, so `docker compose down` and back up can land the
# stack on a different subnet and silently make db unreachable. Re-run to fix.
#
# No FORWARD rule on purpose: inside a container's own namespace nothing
# transits, so that chain never matches.
while read -r subnet; do
    [ -n "$subnet" ] || continue
    echo "Allowing attached network $subnet"
    ipset add --exist allowed-domains "$subnet"
    iptables -A INPUT -s "$subnet" -j ACCEPT
done < <(ip -4 route show scope link | awk '{print $1}')

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# A name in either list MUST also be a zone in coredns/Corefile: this lookup goes
# through that resolver, so one it does not serve comes back REFUSED and yields
# no A records. Add it in both places, then run verify-egress.sh.
#
# `set -e` note: calling this from `if !` suppresses errexit for the whole body,
# so every failure path is an explicit `return 1`, the ipset call included.
add_domain() {
    local domain="$1" requirement="$2" ips ip
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')

    if [ -z "$ips" ]; then
        if [ "$requirement" = required ]; then
            echo "ERROR: Failed to resolve $domain"
            return 1
        fi
        echo "WARNING: $domain did not resolve - skipping it."
        echo "         Installs from it will fail until this script is re-run."
        echo "         If that is unexpected, check it has a zone in"
        echo "         coredns/Corefile; REFUSED looks identical to a CDN blip"
        echo "         from here."
        return 0
    fi

    # Fatal for both lists: unlike an empty answer this means the resolver is
    # wrong or the reply was tampered with, not that a CDN moved.
    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "ERROR: Invalid IP from DNS for $domain: $ip"
            return 1
        fi
        echo "Adding $ip for $domain"
        ipset add --exist allowed-domains "$ip" || return 1
    done < <(echo "$ips")
}

for domain in "${required_domains[@]}"; do
    if ! add_domain "$domain" required; then
        echo "ERROR: required domain $domain could not be allowlisted"
        exit 1
    fi
done

for domain in "${optional_domains[@]}"; do
    if ! add_domain "$domain" optional; then
        echo "ERROR: bad DNS answer for $domain"
        exit 1
    fi
done

# Get host IP from default route
# `ip route | grep default` can return several lines once a container is on
# more than one network; the multiline value then silently passes the -z
# guard and corrupts the iptables call below. Take the first only.
HOST_IP=$(ip -4 route show default | awk '{print $3; exit}')
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

# Set up remaining iptables rules
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Set default policies to DROP first
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# First allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Then allow only specific outbound traffic to allowed domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# --- IPv6 ---------------------------------------------------------------
# Everything above is IPv4 only. If IPv6 is enabled on this container, all
# of it is bypassable over v6. Close that, keeping loopback usable.
if command -v ip6tables >/dev/null 2>&1; then
    ip6tables -F 2>/dev/null || true
    ip6tables -A INPUT  -i lo -j ACCEPT 2>/dev/null || true
    ip6tables -A OUTPUT -o lo -j ACCEPT 2>/dev/null || true
    ip6tables -P INPUT DROP   2>/dev/null || true
    ip6tables -P FORWARD DROP 2>/dev/null || true
    ip6tables -P OUTPUT DROP  2>/dev/null || true
    echo "IPv6 locked down"
fi

echo "Firewall configuration complete"
echo "Verifying firewall rules..."

# Before the HTTP probes, so a DNS failure does not surface as a confusing
# connectivity error below.
if getent hosts api.github.com >/dev/null 2>&1; then
    echo "DNS verification passed - allowlisted name resolves"
else
    echo "ERROR: api.github.com does not resolve - is the dns service running?"
    exit 1
fi

# If an arbitrary name resolves, either the Corefile's catch-all is wrong or
# something reached a resolver other than $DNS_ALLOWLIST_SERVER.
if getent hosts dns-tunnel-probe.example.net >/dev/null 2>&1; then
    echo "ERROR: DNS verification failed - an arbitrary name resolved."
    echo "       The DNS tunnel is open. Check coredns/Corefile's '.' block."
    exit 1
else
    echo "DNS verification passed - arbitrary names refused"
fi
# Before the negative test below, as its positive control: egress broken for an
# unrelated reason would otherwise look like the firewall working.
if ! curl --connect-timeout 5 --max-time 15 -s -o /dev/null https://api.github.com/zen; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi

# --- The IP allowlist, tested BY IP -------------------------------------
# A raw address, because NO hostname can test this. There are two layers, and a
# hostname always short-circuits on the first: a name outside the Corefile is
# REFUSED so curl dies at resolution and the test "passes" without sending a
# packet, and a name inside it is in the ipset by design. example.com and
# google.com are both the former.
#
# A bare TCP connect, not HTTPS: a raw-IP TLS handshake fails on certificate
# name mismatch, which would read as "blocked" whatever the firewall did.
BLOCKED_PROBE_IP="${BLOCKED_PROBE_IP:-1.1.1.1}"
if timeout 5 bash -c ": < /dev/tcp/$BLOCKED_PROBE_IP/443" 2>/dev/null; then
    echo "ERROR: Firewall verification failed - opened a socket to $BLOCKED_PROBE_IP:443"
    echo "       The destination-IP allowlist is not in effect."
    exit 1
else
    echo "Firewall verification passed - $BLOCKED_PROBE_IP:443 unreachable as expected"
fi

# --- Package registries (WARN ONLY) -------------------------------------
# Not fatal, for the same reason optional_domains exists: a rotated CDN edge IP
# must not gain the power to fail the container closed.
#
# No `-f`: any HTTP response proves the TCP+TLS path, so a 404 from an index root
# is a pass and curl fails only on DNS, connect or timeout.
#
# `-I` and `--max-time` because a GET of https://pypi.org/simple/ downloads the
# full index of every project on PyPI — it never fails, it just never finishes,
# and reports a reachable registry as unreachable.
for registry_url in \
    "https://pypi.org/simple/" \
    "https://files.pythonhosted.org/" \
    "https://registry.npmjs.org/"; do
    if curl --connect-timeout 5 --max-time 10 -sI -o /dev/null "$registry_url"; then
        echo "Registry check passed - $registry_url reachable"
    else
        echo "WARNING: $registry_url is NOT reachable - installs from it will fail."
        echo "         Most likely a rotated CDN edge IP, since the ipset is"
        echo "         pinned at container start. Re-run this script:"
        echo "           sudo /usr/local/bin/init-firewall.sh"
    fi
done

# Without this, a broken DNS restore or missing subnet rule surfaces later as a
# confusing app-level error.
DB_HOST="${DB_HOST:-db}"
if getent hosts "$DB_HOST" >/dev/null 2>&1; then
    if timeout 5 bash -c ": < /dev/tcp/$DB_HOST/5432" 2>/dev/null; then
        echo "Database verification passed - $DB_HOST:5432 reachable"
    else
        echo "ERROR: $DB_HOST resolves but port 5432 is not reachable"
        exit 1
    fi
else
    echo "WARNING: $DB_HOST does not resolve - check Docker DNS rule restoration"
fi

# Everything above covers THIS namespace only. Whether the siblings can reach the
# internet, and whether `dns` is alone on the egress network, are visible only
# from the host — run verify-egress.sh there after any network change.
echo
echo "NOTE: sibling egress is not checked here - run .devcontainer/verify-egress.sh on the host"
