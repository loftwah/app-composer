#!/bin/sh
# Shared loopback port selection for the building lab. The two ports are
# independent; the defaults are the original pair so older runs and the
# documented commands keep working unchanged.

BUILDING_GUESTBOOK_PORT_DEFAULT=8788
BUILDING_LINKAROOIE_PORT_DEFAULT=8787

port_is_valid() {
  case ${1:-} in
    '' | *[!0-9]*) return 1 ;;
  esac
  [ "${#1}" -le 5 ] || return 1
  case $1 in
    0*) return 1 ;;
  esac
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

select_building_ports() {
  guestbook_candidate=${GUESTBOOK_PORT:-$BUILDING_GUESTBOOK_PORT_DEFAULT}
  linkarooie_candidate=${LINKAROOIE_PORT:-$BUILDING_LINKAROOIE_PORT_DEFAULT}
  for pair in "GUESTBOOK_PORT:$guestbook_candidate" "LINKAROOIE_PORT:$linkarooie_candidate"; do
    name=${pair%%:*}
    value=${pair#*:}
    if ! port_is_valid "$value"; then
      echo "$name must be a whole number from 1 to 65535 (digits only, no leading zeros), not '$value'." >&2
      return 1
    fi
  done
  if [ "$guestbook_candidate" = "$linkarooie_candidate" ]; then
    echo "GUESTBOOK_PORT and LINKAROOIE_PORT must be different; both were '$guestbook_candidate'." >&2
    return 1
  fi
  GUESTBOOK_PORT=$guestbook_candidate
  LINKAROOIE_PORT=$linkarooie_candidate
}

owns_building_process() {
  case ${1:-} in
    '' | *[!0-9]*) return 1 ;;
  esac
  ps -ww -p "$1" -o command= 2>/dev/null | grep -Fq -- "$2/"
}

kill_building_tree() {
  for child in $(pgrep -P "$1" 2>/dev/null || true); do kill_building_tree "$child"; done
  kill "$1" 2>/dev/null || true
}

# Read the selected ports from an owned run.env. New runs record the ports;
# older default runs only recorded the exact localhost URLs. Anything that
# does not parse falls back to the original defaults rather than widening the
# cleanup boundary.
ports_from_run_env() {
  env_file=$1
  guestbook_port=
  linkarooie_port=
  if [ -f "$env_file" ]; then
    guestbook_port=$(sed -n 's/^GUESTBOOK_PORT=\([0-9][0-9]*\)$/\1/p' "$env_file" | tail -n 1)
    linkarooie_port=$(sed -n 's/^LINKAROOIE_PORT=\([0-9][0-9]*\)$/\1/p' "$env_file" | tail -n 1)
    if [ -z "$guestbook_port" ]; then
      guestbook_port=$(sed -n 's#^GUESTBOOK_URL=https://localhost:\([0-9][0-9]*\)$#\1#p' "$env_file" | tail -n 1)
    fi
    if [ -z "$linkarooie_port" ]; then
      linkarooie_port=$(sed -n 's#^LINKAROOIE_URL=https://localhost:\([0-9][0-9]*\)$#\1#p' "$env_file" | tail -n 1)
    fi
  fi
  if ! port_is_valid "${guestbook_port:-}"; then
    guestbook_port=$BUILDING_GUESTBOOK_PORT_DEFAULT
  fi
  if ! port_is_valid "${linkarooie_port:-}"; then
    linkarooie_port=$BUILDING_LINKAROOIE_PORT_DEFAULT
  fi
  if [ "$guestbook_port" = "$linkarooie_port" ]; then
    guestbook_port=$BUILDING_GUESTBOOK_PORT_DEFAULT
    linkarooie_port=$BUILDING_LINKAROOIE_PORT_DEFAULT
  fi
  printf '%s %s\n' "$guestbook_port" "$linkarooie_port"
}
