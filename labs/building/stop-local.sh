#!/bin/sh
# Stop only the local composition started by start-local.sh and remove its
# explicitly owned temporary root. Other Wrangler sessions are left alone.
set -eu
kill_tree() {
  pid=$1
  [ -n "$pid" ] || return 0
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
POINTER="$ROOT/output/build-199/local-root"
if [ -f "$POINTER" ]; then
  TMPROOT=$(cat "$POINTER")
else
  TMPROOT=${TMPROOT:-}
fi
if [ -z "${TMPROOT:-}" ] || [ ! -d "$TMPROOT" ]; then
  echo "No owned local run is registered. Nothing to stop."
  rm -f "$POINTER"
  exit 0
fi
for name in guestbook showcase; do
  pidfile="$TMPROOT/$name.pid"
  [ -f "$pidfile" ] || continue
  pid=$(cat "$pidfile")
  kill_tree "$pid"
  sleep 1
done
for port in 8787 8788; do
  for pid in $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
    if ps -p "$pid" -o command= 2>/dev/null | grep -Fq "$TMPROOT"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
done
rm -rf "$TMPROOT"
rm -f "$POINTER"
echo "Stopped the owned local composition and removed $TMPROOT."
