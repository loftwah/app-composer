#!/usr/bin/env bash
# MIT. Authoring-only export for the v5 ink-line cel animation artwork family.
#
# Reads the reviewed masters in .artwork/masters (gitignored PNGs, produced by
# scripts/generate-app-art.mjs) and the deterministic 1200x630 cards in
# .artwork/masters/og (HTML composed in a browser), then writes the delivery
# derivatives into this repository and the five independent mini-app checkouts.
#
# Reproduce from the repository root:
#   bash .artwork/export-v5.sh
# Optional overrides: COMPOSER_ROOT, GUESTBOOK_ROOT, SHOWCASE_ROOT, LINKCHECK_ROOT,
# HELLO_ROOT, STATE_ROOT.
set -euo pipefail
ROOT="${COMPOSER_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
M="$ROOT/.artwork/masters"
OG="$M/og"
GB="${GUESTBOOK_ROOT:-$HOME/gits/app-composer-guestbook}"
SC="${SHOWCASE_ROOT:-$HOME/gits/app-composer-showcase}"
LC="${LINKCHECK_ROOT:-$HOME/gits/app-composer-linkcheck}"
HW="${HELLO_ROOT:-$HOME/gits/app-composer-hello}"
ST="${STATE_ROOT:-$HOME/gits/app-composer-state}"
cd "$ROOT"

tile() { # id master prefix outdir
  local id="$1" master="$2" prefix="$3" out="$4"
  magick "$M/$master.png" -resize 480x480 -strip -quality 82 "$out/$prefix-480.webp"
  magick "$M/$master.png" -resize 960x960 -strip -quality 82 "$out/$prefix-960.webp"
  magick "$M/$master.png" -resize 96x96 -strip -quality 85 "$out/apps/$id-small-v4.webp"
  magick "$M/$master.png" -resize 480x480 -strip -quality 82 "$ROOT/public/brand/apps/$id-v4.webp"
  magick "$M/$master.png" -resize 96x96 -strip -quality 85 "$ROOT/public/brand/apps/$id-small-v4.webp"
  cp "$M/$master.png" "$out/$prefix-master.png"
}

share() { # ogname prefix outdir
  local ogname="$1" prefix="$2" out="$3"
  magick "$OG/$ogname.png" -strip -quality 88 "$out/$prefix-share-v4.jpg"
  magick "$OG/$ogname.png" -strip -quality 82 "$out/$prefix-share-v4.webp"
  magick "$OG/$ogname.png" -resize 600x315 -strip -quality 82 "$out/$prefix-share-v4-600.webp"
  magick "$OG/$ogname.png" -strip -quality 88 "$ROOT/public/brand/apps/$prefix-share-v4.jpg"
  magick "$OG/$ogname.png" -strip -quality 82 "$ROOT/public/brand/apps/$prefix-share-v4.webp"
  magick "$OG/$ogname.png" -resize 600x315 -strip -quality 82 "$ROOT/public/brand/apps/$prefix-share-v4-600.webp"
}

# --- Here / there
tile herethere tile-herethere-v5 herethere-art-v4 "$GB/public/brand"
share herethere-share-v5 herethere "$GB/public/brand"

# --- Linkarooie (master chosen: tile-linkarooie-v5-1)
tile linkarooie tile-linkarooie-v5-1 linkarooie-art-v4 "$SC/public/brand"
share linkarooie-share-v5 linkarooie "$SC/public/brand"
# Loftwah's configured profile images keep their configured filenames so the live
# owner settings continue to resolve; only the bytes change.
magick "$M/banner-loftwah-v5-2.png" -resize 1500x500^ -gravity center -extent 1500x500 -strip -quality 85 "$SC/public/brand/creators/loftwah-banner-v1.jpg"
magick "$ROOT/.private/owner-references/loftwah-avatar.png" -resize 400x400 -strip -quality 88 "$SC/public/brand/creators/loftwah-avatar-v1.jpg"
magick "$OG/loftwah-share-v5.png" -strip -quality 88 "$SC/public/brand/creators/loftwah-share-v1.jpg"
# The standalone header mark used the retired kangaroo illustration; it becomes
# the app's own flat mark so header, favicon and install icon agree.
magick "$SC/public/brand/mark.svg" -background none -resize 192x192 "$SC/public/brand/creators/linkarooie-kangaroo-v1.png"

# --- Link Check
tile linkcheck tile-linkcheck-v5 linkcheck-art-v4 "$LC/public/brand"
share linkcheck-share-v5 linkcheck "$LC/public/brand"

# --- Hello World
tile hello tile-hello-v5 hello-art-v4 "$HW/public/brand"
share hello-share-v5 hello "$HW/public/brand"

# --- Carry / forward
tile carryforward tile-carryforward-v5 carry-forward-art-v4 "$ST/public/brand"
share carryforward-share-v5 carryforward "$ST/public/brand"

# --- App Composer product art
magick "$M/hero-composer-v5-2.png" -resize 1600x914 -strip -quality 82 "$ROOT/public/brand/hero-composer-v5-1600.webp"
magick "$M/hero-composer-v5-2.png" -resize 960x549 -strip -quality 82 "$ROOT/public/brand/hero-composer-v5-960.webp"
magick "$OG/composer-share-v5.png" -strip -quality 88 "$ROOT/public/brand/share-composer-20261017.jpg"
magick "$OG/composer-share-v5.png" -strip -quality 82 "$ROOT/public/brand/share-composer-20261017.webp"
magick "$OG/composer-share-v5.png" -resize 600x315 -strip -quality 82 "$ROOT/public/brand/share-composer-20261017-600.webp"

echo "exported v5 artwork family"
