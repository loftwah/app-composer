#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --screenshot="$ROOT/public/brand/building/building-hero-20261022.png" "file://$ROOT/.artwork/building/hero.html"
magick "$ROOT/public/brand/building/building-hero-20261022.png" -strip -quality 88 "$ROOT/public/brand/building/building-hero-20261022.jpg"
magick "$ROOT/public/brand/building/building-hero-20261022.png" -strip -quality 86 "$ROOT/public/brand/building/building-hero-20261022.webp"
echo "Rendered 1200 × 630 hero and share card."
