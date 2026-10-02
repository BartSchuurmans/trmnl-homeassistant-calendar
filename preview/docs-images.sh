#!/usr/bin/env sh
# Regenerates the README screenshots in docs/ from the sample calendars. Run it after
# any change that alters how the calendar looks, and commit the images with it. Same
# prerequisites as render.mjs (see ci.sh). The date is fixed, so "today" and the sample
# events (sample-data.mjs) stay put and only real changes show up in the images.
set -eu
cd "$(dirname "$0")"
docs=../docs
common="--strict --tz Europe/Amsterdam --now 2026-09-30 --set weather_entity=weather.forecast_home --set weather_temperatures=high_low \
    --set calendar_colors=gray-35,white,gray-60 --set calendar_labels=-,M:,S:"

# shellcheck disable=SC2086 # $common is a list of arguments
node render.mjs $common --set month_header=true --out "$docs/preview.png"
# shellcheck disable=SC2086
node render.mjs $common --device og --out "$docs/preview-1bit.png"
# shellcheck disable=SC2086
node render.mjs $common --device og2 --out "$docs/preview-2bit.png"
rm -f "$docs"/preview*.html
