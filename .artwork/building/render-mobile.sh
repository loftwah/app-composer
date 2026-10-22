#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=900,900 --screenshot="$ROOT/public/brand/building/building-hero-mobile-20261022.png" "file://$ROOT/.artwork/building/hero-mobile.html"
magick "$ROOT/public/brand/building/building-hero-mobile-20261022.png" -strip -quality 86 "$ROOT/public/brand/building/building-hero-mobile-20261022.webp"
echo "Rendered 900 × 900 phone hero."
