#!/bin/sh
# Render the approved App Composer product card and the PHP2Shell campaign suite.
# The supplied 1730×909 PHP2Shell master remains the source for the landscape
# export; the square and vertical cards are deliberate reflows of the same copy.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="$ROOT/public/brand/campaign"
mkdir -p "$OUT"
render() {
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=1 --run-all-compositor-stages-before-draw \
    --virtual-time-budget=2500 --screenshot="$OUT/$2" --window-size="$3" \
    "file://$ROOT/.artwork/campaign/$1" >/dev/null 2>&1
}
render product-og.html product-og-20261022b.png 1200,630
render php2shell-square.html php2shell-australia-20261022b-1080x1080.png 1080,1080
render php2shell-vertical.html php2shell-australia-20261022b-1080x1920.png 1080,1920
