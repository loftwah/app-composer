#!/bin/sh
# From the repository root, pass the wide, square, portrait and story ImageGen masters.
set -eu
wide=${1:?Supply the wide ImageGen master}
square=${2:?Supply the square ImageGen master}
portrait=${3:?Supply the portrait ImageGen master}
story=${4:?Supply the story ImageGen master}
brand=public/spin-brand
campaign=public/campaign/spin
stamp=20261127e
mark="$brand/spin-mark-$stamp.svg"
work=$(mktemp -d)
trap 'find "$work" -type f -delete && rmdir "$work"' EXIT

python3 - "$work/Space.ttf" <<'PY'
from sys import argv
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont('public/resources/v1/fonts/SpaceGrotesk.ttf')
if 'fvar' in font:
    font = instantiateVariableFont(font, {'wght': 700})
font.save(argv[1])
PY
font="$work/Space.ttf"
magick -density 768 -background none "$mark" -resize 512x512 "$work/mark.png"
for size in 16 32 48 180 192 512; do
  magick "$work/mark.png" -resize "${size}x${size}" -strip "PNG32:$brand/spin-icon-$size-$stamp.png"
done
magick -size 512x512 xc:'#17181b' '(' "$work/mark.png" -resize 384x384 ')' -gravity center -composite \
  -strip "PNG24:$brand/spin-icon-maskable-$stamp.png"
for theme in dark light; do
  ink='#17181b'
  if [ "$theme" = dark ]; then ink='#faf9f7'; fi
  magick -size 600x162 xc:none -gravity northwest \
    '(' "$work/mark.png" -resize 132x132 ')' -geometry +0+15 -composite \
    -font "$font" -fill "$ink" -pointsize 93 -kerning -3 -annotate +154+0 'Spin' \
    -pointsize 29 -kerning 0 -annotate +158+106 'by App Composer' \
    -trim +repage -bordercolor none -border 8 -strip "PNG32:$brand/spin-lockup-$theme-$stamp.png"
done

render_card() {
  name=$1
  master=$2
  size=$3
  jpeg="$campaign/spin-$name-$stamp.jpg"
  magick "$master" -resize "${size}^" -gravity center -extent "$size" \
    -strip -sampling-factor 4:4:4 -quality 88 "$jpeg"
  magick "$jpeg" -resize '600x460>' -strip -quality 83 "$campaign/spin-$name-thumb-$stamp.webp"
}
render_card wide "$wide" 1200x630
render_card square "$square" 1080x1080
render_card portrait "$portrait" 1080x1350
# Reposition the story master to clear the typical story account header.
magick "$story" -resize 1080x1920^ -gravity center -extent 1080x1920 "$work/story-base.png"
magick "$work/story-base.png" -crop 1080x1+0+0 +repage -scale '1080x108!' "$work/story-paper.png"
magick "$work/story-paper.png" "$work/story-base.png" -append -crop 1080x1920+0+0 +repage "$work/story.png"
render_card story "$work/story.png" 1080x1920

magick -size 1200x1600 xc:'#faf9f7' -gravity north \
  '(' "$campaign/spin-wide-$stamp.jpg" -resize 1050x ')' -geometry +0+78 -composite \
  '(' "$campaign/spin-qr-20261127d.png" ')' -geometry +0+660 -composite \
  -font "$font" -fill '#17181b' -pointsize 46 -annotate +0+1275 'Scan to spin' \
  -pointsize 34 -annotate +0+1351 'spin.loftwah.com' -strip "$campaign/spin-print-qr-$stamp.png"

# Keep the original eight generated food photographs and remove their blue cast.
mkdir -p "$brand/taste-20261127e"
for photo in "$brand"/taste/*.webp; do
  magick "$photo" -fx 'u.b > u.r*1.12 && u.b > u.g*1.08 ? u.r*.4 + u.g*.5 + u.b*.1 : u' \
    -strip -quality 83 "$brand/taste-20261127e/${photo##*/}"
done
