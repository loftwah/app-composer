#!/bin/sh
# Run from the repository root. Uses the bundled Composer typeface and exact approved tile.
set -eu
work=$(mktemp -d)
trap 'find "$work" -type f -delete && rmdir "$work"' EXIT
python3 - "$work/SpinSpace.ttf" <<'PY'
from sys import argv
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont('public/resources/v1/fonts/SpaceGrotesk.ttf')
if 'fvar' in font:
    font = instantiateVariableFont(font, {'wght': 700})
font.save(argv[1])
PY

composer='public/brand/composer-icon-20261022b-512.png'
font="$work/SpinSpace.ttf"
destination='public/spin-brand'

for theme in dark light; do
  ink='#fff5e8'
  rule='#827269'
  if [ "$theme" = light ]; then ink='#201a16'; rule='#a58d7a'; fi
  magick -size 635x144 xc:none -background none -alpha on \
    '(' -background none "$composer" -resize 98x98 ')' -gravity northwest -geometry +8+23 -composite \
    -font "$font" -fill "$ink" -pointsize 92 -kerning -2 -annotate +124+19 'Spin' \
    -stroke "$rule" -strokewidth 3 -draw 'line 326,45 326,101' +stroke \
    -fill "$ink" -pointsize 35 -kerning 0 -annotate +350+54 'App Composer' \
    -strip "PNG32:$destination/spin-lockup-$theme-20261127c.png"
done

for size in 32 180 192 512; do
  magick -size 512x512 xc:none \
    -fill '#fc5b05' -draw 'roundrectangle 0,0 511,511 96,96' \
    -fill '#211a17' -draw 'circle 256,272 428,272' \
    -fill '#fff0d8' -draw 'circle 256,272 394,272' \
    -fill '#f8bf54' -draw "path 'M 256 272 L 256 410 A 138 138 0 0 1 136.5 203 Z'" \
    -fill '#ff874f' -draw "path 'M 256 272 L 375.5 203 A 138 138 0 0 1 256 410 Z'" \
    -fill '#211a17' -draw 'circle 256,272 302,272' \
    -fill '#fff0d8' -stroke '#211a17' -strokewidth 14 -draw 'polygon 210,62 302,62 256,155' \
    -resize "${size}x${size}" -strip "PNG32:$destination/spin-icon-$size-20261127c.png"
done
