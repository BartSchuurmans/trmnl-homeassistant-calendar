#!/usr/bin/env sh
# Render checks run by .github/workflows/render.yml (and locally, same prerequisites as
# render.mjs plus PHP with composer's vendor/ in preview/php). Screenshots land in
# preview/out/ci. Any render that errors or doesn't finish fails the run.
set -eu
cd "$(dirname "$0")"
out=out/ci
rm -rf "$out"
mkdir -p "$out"

render() {
    name="$1"
    shift
    echo "== $name"
    timeout 90 node render.mjs --strict --tz Europe/Amsterdam --out "$out/$name.png" "$@"
}

# Sample calendars with different settings, on the TRMNL X and a 1-bit OG
render sample-x
render sample-og --device og
render sample-og-2bit --device og2
render colors-x --set calendar_colors=gray-65,black --set calendar_labels=-,W: --set month_header=yes
render colors-og-dither --device og --set calendar_colors=-,black --set calendar_labels=-,W: --set dither_greys=yes
render options-x --set locale=nl --set first_day=0 --set show_week_numbers=yes --set time_format=am/pm \
    --set display_event_end=no --set rolling_advancement=day --set include_past_events=no

# Same input through LaraPaper's Liquid engine (keepsuit/liquid, PHP)
render liquidjs-x --set calendar_colors=gray-65,black --set dither_greys=yes --dump-context "$out/context.json"
php php/render.php "$out/context.json" > "$out/php-body.html"
render php-x --body "$out/php-body.html"

# Random calendars (1-4, sparse to dense) catch layouts that don't settle
for seed in 1 2 3 4 5 6 7 8 9 10 11 12; do
    device=x
    [ $((seed % 3)) -eq 0 ] && device=og
    settings="$(node random-data.mjs "$seed" "$out/random-$seed.json")"
    IFS='
'
    # shellcheck disable=SC2086 # split on newlines: one --set or value per line
    render "random-$seed-$device" --device "$device" --data "$out/random-$seed.json" $settings
    unset IFS
done
