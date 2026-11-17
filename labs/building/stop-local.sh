#!/bin/sh
# Stop only the local composition started by start-local.sh and remove its
# explicitly owned temporary root. Other Wrangler sessions are left alone.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/local-ports.sh"
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
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
# New runs record both ports. Older default runs only recorded the exact
# localhost URLs; the shared parser falls back to those, then to 8788/8787.
set -- $(ports_from_run_env "$TMPROOT/run.env")
GUESTBOOK_PORT=$1
LINKAROOIE_PORT=$2
for name in guestbook showcase; do
  pidfile="$TMPROOT/$name.pid"
  [ -f "$pidfile" ] || continue
  pid=$(cat "$pidfile")
  if owns_building_process "$pid" "$TMPROOT"; then kill_building_tree "$pid"; fi
  sleep 1
done
for port in "$GUESTBOOK_PORT" "$LINKAROOIE_PORT"; do
  for pid in $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
    if ps -p "$pid" -o command= 2>/dev/null | grep -Fq "$TMPROOT"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
done
rm -rf "$TMPROOT"
rm -f "$POINTER"
echo "Stopped the owned local composition on ports $GUESTBOOK_PORT and $LINKAROOIE_PORT and removed $TMPROOT."
