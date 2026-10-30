#!/bin/bash
# Runs a named command from the `commands:` block of services.yaml, from the repo
# root. CI calls its steps through this, so the command a developer reads in
# services.yaml is the command CI runs, not a copy that can drift from it.
#
#   scripts/run-command.sh <name> [args...]
#
# Any extra args are appended to the end of the command, e.g.
#   scripts/run-command.sh generate-migration "add pitch owner"
#
# The lookup is a line match, not a YAML parser: each command must stay a single
# unquoted line (`  name: command`). Anything else fails here instead of running
# something other than what the file says.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <command-name> [args...]" >&2
  exit 2
fi

cd "$(dirname "$0")/.."
name=$1
shift

command=$(awk -v name="$name" '
  /^[^[:space:]#]/ { in_commands = ($0 ~ /^commands:[[:space:]]*$/); next }
  in_commands && index($0, "  " name ":") == 1 {
    print substr($0, length(name) + 4)
    exit
  }
' services.yaml)
command=${command#"${command%%[![:space:]]*}"}

if [ -z "$command" ]; then
  echo "services.yaml has no single-line command named '$name'" >&2
  exit 2
fi
case $command in
  \"* | \'* | \|* | \>*)
    echo "services.yaml command '$name' is quoted or multi-line; keep it one plain line" >&2
    exit 2
    ;;
esac

echo "+ $command $*" >&2
exec bash -c "$command"' "$@"' "$name" "$@"
