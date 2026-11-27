#!/bin/sh
# Run from the repository root with the original generated wheel artwork as the argument.
set -eu
source_image=${1:?Supply the generated illustration master}
dest=public/spin-brand
mkdir -p "$dest"
work=$(mktemp -d)
trap 'find "$work" -type f -delete && rmdir "$work"' EXIT

python3 - "$work/SpaceGrotesk-Bold.ttf" <<'PY'
from sys import argv
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont('public/resources/v1/fonts/SpaceGrotesk.ttf')
if 'fvar' in font:
    font = instantiateVariableFont(font, {'wght': 700})
font.save(argv[1])
PY

font="$work/SpaceGrotesk-Bold.ttf"
composer=public/brand/composer-icon-20261022b-512.png

for theme in dark light; do
  ink='#fff0d7'
  if [ "$theme" = light ]; then ink='#211521'; fi
  magick -size 620x235 xc:none \
    '(' "$composer" -resize 190x190 ')' -gravity northwest -geometry +20+37 -composite \
    -font "$font" -fill "$ink" -pointsize 43 -kerning 2.8 -annotate +239+47 'APP COMPOSER' \
    -pointsize 152 -kerning -5 -annotate +231+76 'Spin' \
    -fill '#fc5b05' -draw 'circle 547,177 562,177' \
    -trim +repage -bordercolor none -border 12 -gravity west -extent 620x235 \
    -strip "PNG32:$dest/composer-spin-lockup-$theme-20261127.png"
done

magick "$source_image" -resize '1200x630^' -gravity center -extent 1200x630 \
  -colorspace sRGB '(' "$composer" -resize 33x33 ')' -gravity northwest -geometry +65+137 -composite \
  -font "$font" -fill '#fff0d7' -pointsize 23 -kerning 3.5 -annotate +108+139 'APP COMPOSER' \
  -pointsize 156 -kerning -5 -annotate +57+170 'Spin' \
  -fill '#fc5b05' -draw 'circle 390,269 403,269' \
  -fill '#fff0d7' -pointsize 34 -kerning -0.9 -annotate +65+370 'Settle it with a spin.' \
  -fill '#f4ad87' -pointsize 25 -kerning 0 -annotate +65+419 'spin.loftwah.com' \
  -strip -sampling-factor 4:4:4 -quality 89 "$dest/decision-wheel-20261127b.jpg"
