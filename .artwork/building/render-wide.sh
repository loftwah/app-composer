#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1600,640 --screenshot="$ROOT/public/brand/building/building-hero-wide-20261022.png" "file://$ROOT/.artwork/building/hero-wide.html"
magick "$ROOT/public/brand/building/building-hero-wide-20261022.png" -strip -quality 86 "$ROOT/public/brand/building/building-hero-wide-20261022.webp"
echo "Rendered 1600 × 640 article hero."
