#!/usr/bin/env bash
#
# db.sh — thin, project-agnostic wrapper for the containerised DB/Alembic commands
# used by the db-bootstrap.md / db-change.md SOPs. It does NOT replace the SOP's
# judgement: it only removes copy-paste error on the long
# `docker compose run … DATABASE_URL=…` invocations, always echoes the target DB,
# and refuses/prompts on writes.
#
# Nothing app-specific is baked in. All connection details are derived from the
# app's own DATABASE_URL (taken from the environment, else sourced from ./.env);
# only the *database name* is swapped to point at a scratch DB. The protected
# database defaults to whatever real DB that DATABASE_URL names.
#
# Config (all optional overrides; sensible defaults shown):
#   DATABASE_URL      the app URL; if unset, read from ./.env (required somewhere)
#   DB_SERVICE        compose service running Postgres      (default: URL host)
#   APP_SERVICE       compose service with alembic/pg_dump  (default: backend)
#   DB_PORT           Postgres port                         (default: URL port or 5432)
#   PROTECTED_DBS     extra space-separated DB names to refuse writes against
#   DB_CONFIRM_YES=1  skip the retype-to-confirm prompt (for scripted use)
#
# Guardrails it enforces (see db-bootstrap.md §0):
#   • Every command prints "TARGET DB: <url>" before doing anything.
#   • `upgrade` / `downgrade` / `stamp` and `throwaway drop` against a PROTECTED
#     database (the app's real DB, plus postgres/template*) are refused outright.
#   • Any other write prompts you to retype the DB name (DB_CONFIRM_YES=1 skips).
#   • It never removes create_all(), never edits .do/app.yaml, never chains cutover.
#
# Usage (run from anywhere inside the repo):
#   db.sh throwaway create <db>        # DROP IF EXISTS + CREATE — a fresh, empty scratch DB
#   db.sh throwaway drop   <db>        # DROP IF EXISTS (prompts)
#   db.sh psql <db> [psql args…]       # e.g. db.sh psql scratch -c '\dt'
#   db.sh alembic <db> <args…>         # e.g. db.sh alembic scratch revision --autogenerate -m "genesis schema"
#   db.sh dump <db>                    # schema-only pg_dump to stdout (Phase C parity diff)
#
set -euo pipefail

PROG="$(basename "$0")"

# --- locate the repo root (the directory containing docker-compose.yml) ----------
find_root() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    [ -f "$d/docker-compose.yml" ] && { printf '%s\n' "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}
ROOT="$(find_root)" || { echo "$PROG: no docker-compose.yml found above $PWD" >&2; exit 1; }
cd "$ROOT"

usage() { awk 'NR>1 && /^#/{sub(/^# ?/,""); print; next} NR>1{exit}' "$0"; exit "${1:-0}"; }

# Parse the command first so `--help` (and arg errors) work without Docker or .env.
[ $# -ge 1 ] || usage 1
case "$1" in -h|--help|help) usage 0;; esac
cmd="$1"; shift

# --- docker compose v2 (`docker compose`) or v1 (`docker-compose`) ----------------
if docker compose version >/dev/null 2>&1; then DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then DC=(docker-compose)
else echo "$PROG: neither 'docker compose' nor 'docker-compose' is available" >&2; exit 1; fi

# --- resolve DATABASE_URL: environment first, else ./.env -------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "$PROG: created .env from .env.example." >&2
  fi
  if [ -f .env ]; then
    # shellcheck disable=SC1091
    set -a; . ./.env; set +a
  fi
fi
[ -n "${DATABASE_URL:-}" ] || {
  echo "$PROG: DATABASE_URL is not set and ./.env did not provide it. Set DATABASE_URL or create .env." >&2
  exit 1
}

# --- derive connection parts from DATABASE_URL (scheme://[user[:pass]@]host[:port]/db) ---
_scheme="${DATABASE_URL%%://*}"
_rest="${DATABASE_URL#*://}"
if [ "$_rest" != "${_rest#*@}" ]; then       # credentials present
  _creds="${_rest%%@*}"; _hostpart="${_rest#*@}"
else
  _creds=""; _hostpart="$_rest"
fi
if [ "$_creds" != "${_creds#*:}" ]; then      # user:pass
  DB_USER="${_creds%%:*}"; DB_PASS="${_creds#*:}"
else
  DB_USER="$_creds"; DB_PASS=""
fi
_hostport="${_hostpart%%/*}"                  # host[:port]
_dbpart="${_hostpart#*/}"; PRIMARY_DB="${_dbpart%%\?*}"   # real DB name (strip ?params)
_URL_HOST="${_hostport%%:*}"
if [ "$_hostport" != "${_hostport#*:}" ]; then _URL_PORT="${_hostport#*:}"; else _URL_PORT=""; fi

DB_SERVICE="${DB_SERVICE:-$_URL_HOST}"        # compose service == URL host by convention
APP_SERVICE="${APP_SERVICE:-backend}"
DB_HOST="$DB_SERVICE"                         # in-network hostname == service name
DB_PORT="${DB_PORT:-${_URL_PORT:-5432}}"

# Protected = the app's real DB plus the Postgres maintenance/template DBs, plus any extra.
PROTECTED=" ${PRIMARY_DB} postgres template0 template1 ${PROTECTED_DBS:-} "

db_url()      { printf '%s://%s:%s@%s:%s/%s' "$_scheme" "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" "$1"; }
is_protected(){ case "$PROTECTED" in *" $1 "*) return 0;; esac; return 1; }

confirm() {   # confirm <db> <action-description>
  local db="$1" action="$2"
  printf '%s: about to %s\n     TARGET DB: %s\n' "$PROG" "$action" "$(db_url "$db")" >&2
  if [ "${DB_CONFIRM_YES:-}" = "1" ]; then echo "     (DB_CONFIRM_YES=1 — proceeding without prompt)" >&2; return 0; fi
  printf '     retype the database name (%s) to proceed: ' "$db" >&2
  local ans; read -r ans
  [ "$ans" = "$db" ] || { echo "$PROG: aborted." >&2; exit 1; }
}

case "$cmd" in
  throwaway)
    action="${1:-}"; db="${2:-}"
    [ -n "$action" ] && [ -n "$db" ] || { echo "usage: $PROG throwaway create|drop <db>" >&2; exit 1; }
    is_protected "$db" && { echo "$PROG: refusing to $action protected DB '$db'." >&2; exit 1; }
    case "$action" in
      create)
        # Fresh + empty: DROP IF EXISTS then CREATE. Separate -c: DATABASE DDL can't run in a txn.
        confirm "$db" "recreate (DROP IF EXISTS + CREATE) scratch database"
        "${DC[@]}" exec -T "$DB_SERVICE" psql -U "$DB_USER" -d postgres \
          -c "DROP DATABASE IF EXISTS \"$db\";" \
          -c "CREATE DATABASE \"$db\";"
        ;;
      drop)
        confirm "$db" "DROP scratch database"
        "${DC[@]}" exec -T "$DB_SERVICE" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$db\";"
        ;;
      *) echo "usage: $PROG throwaway create|drop <db>" >&2; exit 1;;
    esac
    ;;

  psql)
    db="${1:-}"; [ -n "$db" ] || { echo "usage: $PROG psql <db> [psql args…]" >&2; exit 1; }
    shift
    echo "$PROG: TARGET DB: $(db_url "$db")" >&2
    "${DC[@]}" exec "$DB_SERVICE" psql -U "$DB_USER" -d "$db" "$@"
    ;;

  alembic)
    db="${1:-}"; [ -n "$db" ] || { echo "usage: $PROG alembic <db> <args…>" >&2; exit 1; }
    url="$(db_url "$db")"
    is_write=""
    for a in "$@"; do
      case "$a" in upgrade|downgrade|stamp) is_write=1;; esac
    done
    if [ -n "$is_write" ]; then
      is_protected "$db" && { echo "$PROG: refusing an Alembic write ($*) against protected DB '$db'. Production migrations run via the deploy's PRE_DEPLOY job, never by hand." >&2; exit 1; }
      confirm "$db" "run Alembic write: alembic $*"
    fi
    # `sh -c '… "$@"' _ "$@"` preserves args containing spaces (e.g. -m "genesis schema").
    "${DC[@]}" run --rm -e DATABASE_URL="$url" "$APP_SERVICE" \
      sh -c 'echo "TARGET DB: $DATABASE_URL" >&2; exec alembic "$@"' "$PROG" "$@"
    ;;

  dump)
    db="${1:-}"; [ -n "$db" ] || { echo "usage: $PROG dump <db>" >&2; exit 1; }
    url="$(db_url "$db")"
    echo "$PROG: dumping schema of TARGET DB: $url" >&2
    # -T so only pg_dump output reaches stdout (safe to redirect / diff).
    "${DC[@]}" run --rm -T "$APP_SERVICE" pg_dump --schema-only --no-owner --no-privileges "$url"
    ;;

  *) echo "$PROG: unknown command '$cmd'" >&2; usage 1;;
esac
