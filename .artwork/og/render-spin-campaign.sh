#!/bin/sh
# Run from the repository root with the original ImageGen masters.
set -eu
wide=${1:?Wide master required}
square=${2:?Square master required}
portrait=${3:?Portrait master required}
story=${4:?Story master required}
tastes=${5:?Food contact sheet required}
brand=public/spin-brand
campaign=public/campaign/spin
stamp=20261127d
mkdir -p "$brand/taste" "$campaign"

render_format() {
  name=$1
  source=$2
  size=$3
  jpeg="$campaign/spin-$name-$stamp.jpg"
  magick "$source" -resize "${size}^" -gravity center -extent "$size" -strip -sampling-factor 4:4:4 -quality 87 "$jpeg"
  magick "$jpeg" -resize '600x460>' -strip -quality 83 "$campaign/spin-$name-thumb-$stamp.webp"
}

render_format wide "$wide" 1200x630
render_format square "$square" 1080x1080
render_format portrait "$portrait" 1080x1350
render_format story "$story" 1080x1920

for photo in burgers:5:5 chicken:448:5 pizza:892:5 fish:1335:5 kebabs:5:448 noodles:448:448 veggie:892:448 sweet:1335:448; do
  name=${photo%%:*}
  offset=${photo#*:}
  magick "$tastes" -crop "433x433+${offset%:*}+${offset#*:}" +repage -resize 144x144 -strip -quality 82 "$brand/taste/$name.webp"
done

for size in 32 180 192 512; do
  magick -size 512x512 xc:none \
    -fill '#102137' -draw 'roundrectangle 0,0 511,511 108,108' \
    -fill '#d2dfed' -draw 'circle 256,273 436,273' \
    -fill '#fff3df' -draw 'circle 256,273 409,273' \
    -fill '#fc5b05' -draw "path 'M 256 273 L 256 426 A 153 153 0 0 1 123.5 196.5 Z'" \
    -fill '#587d9d' -draw "path 'M 256 273 L 388.5 196.5 A 153 153 0 0 1 256 426 Z'" \
    -fill '#102137' -draw 'circle 256,273 296,273' \
    -fill '#fc5b05' -stroke '#102137' -strokewidth 13 -draw 'polygon 210,56 302,56 256,149' \
    -resize "${size}x${size}" -strip "PNG32:$brand/spin-icon-$size-$stamp.png"
done
