#!/usr/bin/env sh
# Regenerates the README screenshots in docs/ from the sample calendars. Run it after
# any change that alters how the calendar looks, and commit the images with it. Same
# prerequisites as render.mjs (see ci.sh). The date is fixed, so the sample events
# (placed relative to "today") stay put and only real changes show up in the images.
set -eu
cd "$(dirname "$0")"
docs=../docs
common="--strict --tz Europe/Amsterdam --now 2026-09-28 --set calendar_colors=-,black --set calendar_labels=-,W:"

# shellcheck disable=SC2086 # $common is a list of arguments
node render.mjs $common --set month_header=yes --out "$docs/preview.png"
# shellcheck disable=SC2086
node render.mjs $common --device og --out "$docs/preview-1bit-adapt.png"
# shellcheck disable=SC2086
node render.mjs $common --device og --set dither_greys=yes --out "$docs/preview-1bit-dither.png"
rm -f "$docs"/preview*.html
