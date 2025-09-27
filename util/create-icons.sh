#!/usr/bin/env bash
set -eu

ROOT=$(dirname -- "$0")/..
cd "$ROOT/images"

create_logo() {
    original=$1
    size=$2
    filename=$3

    convert -background none "$original" -resize "${size}x${size}" "$filename"
    optipng "$filename"
}

SIZES="16 32 48 128"
for svgFile in *.svg; do
    name="${svgFile%.svg}"
    for s in $SIZES; do
        create_logo "$svgFile" "$s" "${name}-${s}.png"
    done
done
