#!/bin/sh
# Run from the repository root with an original generated master as the first argument.
set -eu
source_image=${1:?Supply the generated illustration master}
dest=public/spin-brand
mkdir -p "$dest"
magick "$source_image" -resize '1200x630^' -gravity center -extent 1200x630 \
  -colorspace sRGB -gravity northwest -font Arial-Bold -fill '#fff0d7' \
  -pointsize 23 -kerning 4 -annotate +65+151 'APP COMPOSER' \
  -pointsize 152 -kerning -7 -annotate +56+176 'Spin.' \
  -pointsize 33 -kerning -0.6 -annotate +65+375 'Settle it with a spin.' \
  -fill '#f4ad87' -pointsize 24 -kerning 0 -annotate +65+426 'spin.loftwah.com' \
  -strip -sampling-factor 4:4:4 -quality 89 "$dest/decision-wheel-20261127.jpg"

# Flat optical icon. Its pointer and three sectors are read independently of the illustrated master.
for size in 32 180 192 512; do
  magick -size 512x512 xc:'#211521' \
    -fill '#ff946b' -draw 'circle 256,272 413,272' \
    -fill '#4eb8aa' -draw "path 'M 256 272 L 413 272 A 157 157 0 0 1 173 405 Z'" \
    -fill '#ffe0a5' -draw "path 'M 256 272 L 173 405 A 157 157 0 0 1 168 142 Z'" \
    -fill '#211521' -draw 'circle 256,272 284,272' \
    -fill '#fff0d7' -stroke '#211521' -strokewidth 12 -draw 'polygon 214,83 298,83 256,163' \
    -resize "${size}x${size}" -strip "PNG24:$dest/icon-${size}.png"
done
