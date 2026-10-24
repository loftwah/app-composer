#!/bin/sh
# Optional one-shot local delivery runner.
#
# Use it from an existing terminal job, Jenkins/GitLab/Buildkite-style agent
# wrapper, or a manual release session. It adds no scheduler, daemon, hosted CI
# or GitHub Actions. The inner journey still requires an explicit --release.
set -eu
umask 077

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

if [ "${1:-}" = "--help" ]; then
  cat <<'EOF'
Usage: examples/local-delivery-runner.sh [--local|--candidate|--release|--verify] [--json]

  --local      Default. Read-only identity inspection and required local checks.
  --candidate  Check, then build and inspect a local preview candidate. No upload.
  --release    Explicitly build the candidate, run the guarded deploy and verify live.
  --verify     Independently re-read the live root and mounted pins.

A receipt is written to output/delivery/<mode>.json unless --receipt PATH is supplied.
Check-only and candidate modes require installed pinned dependencies.
EOF
  exit 0
fi

mode=local
has_receipt=0
for argument in "$@"; do
  case "$argument" in
    --local|--candidate|--release|--verify) mode=${argument#--} ;;
    --receipt) has_receipt=1 ;;
  esac
done

case "$mode" in
  local|candidate|release)
    if [ ! -d node_modules ]; then
      echo "Pinned dependencies are not installed in $repo_root." >&2
      echo "Run: pnpm install --frozen-lockfile" >&2
      exit 2
    fi
    ;;
esac

if [ "$has_receipt" -eq 0 ]; then
  receipt="output/delivery/${mode}.json"
  exec node scripts/delivery-journey.mjs "$@" --receipt "$receipt"
fi
exec node scripts/delivery-journey.mjs "$@"
