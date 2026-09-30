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
render colors-x --set calendar_colors=black,-,gray-65 --set calendar_labels=-,M:,S: --set month_header=yes
render colors-og-dither --device og --set calendar_colors=black,-,gray-50 --set calendar_labels=-,M:,S: --set dither_greys=yes
render options-x --set locale=nl --set first_day=0 --set show_week_numbers=yes --set time_format=am/pm \
    --set display_event_end=no --set rolling_advancement=day --set include_past_events=no

# The sample as ICS feeds, as LaraPaper hands them over (30 days ahead: fewer weeks)
render ics-x --ics
render ics-og --device og --ics --set calendar_colors=black,-,gray-50 --set calendar_labels=-,M:,S:
render ics-options-x --ics --set rolling_advancement=day --set first_day=0 --set week_overflow=more

# The sample as TRMNL calendar plugins' data (Plugin Data API)
render native-x --native --expect-events

# The half and quadrant views, as part of a mashup
render half-horizontal-x --size half_horizontal --expect-events
render half-vertical-x --size half_vertical --expect-events
render half-vertical-og --device og --size half_vertical --expect-events
render quadrant-x --size quadrant --expect-events
render quadrant-og --device og --size quadrant --expect-events

# Same input through LaraPaper's Liquid engine (keepsuit/liquid, PHP)
render liquidjs-x --set calendar_colors=black,-,gray-65 --set dither_greys=yes --dump-context "$out/context.json"
php php/render.php "$out/context.json" > "$out/php-body.html"
render php-x --body "$out/php-body.html"
render liquidjs-ics-x --ics --dump-context "$out/context-ics.json"
php php/render.php "$out/context-ics.json" > "$out/php-ics-body.html"
render php-ics-x --body "$out/php-ics-body.html"

# Same input through trmnlp (Ruby Liquid, as on TRMNL), which passes several calendars as
# IDX_0, IDX_1, ... without `data`; needs Docker, which CI has
if command -v docker > /dev/null || [ -n "${CI:-}" ]; then
    node trmnlp.mjs "$out/context.json" "$out/trmnlp-body.html"
    render trmnlp-x --body "$out/trmnlp-body.html" --expect-events
    node trmnlp.mjs "$out/context-ics.json" "$out/trmnlp-ics-body.html"
    render trmnlp-ics-x --body "$out/trmnlp-ics-body.html" --expect-events
    node trmnlp.mjs "$out/context.json" "$out/trmnlp-half-vertical-body.html" half_vertical
    render trmnlp-half-vertical-x --body "$out/trmnlp-half-vertical-body.html" --expect-events
    node trmnlp.mjs "$out/context.json" "$out/trmnlp-quadrant-body.html" quadrant
    render trmnlp-quadrant-x --body "$out/trmnlp-quadrant-body.html" --expect-events
else
    echo "== trmnlp skipped (no Docker)"
fi

# Random calendars (1-4, sparse to dense) catch layouts that don't settle
for seed in 1 2 3 4 5 6 7 8 9 10 11 12; do
    device=x
    [ $((seed % 3)) -eq 0 ] && device=og
    settings="$(node random-data.mjs "$seed" "$out/random-$seed.json")"
    IFS='
'
    # shellcheck disable=SC2086 # split on newlines: one --set or value per line
    render "random-$seed-$device" --device "$device" --data "$out/random-$seed.json" $settings
    # every fourth one again as ICS feeds
    [ $((seed % 4)) -eq 0 ] && render "random-$seed-$device-ics" --device "$device" --data "$out/random-$seed.json" --ics $settings
    unset IFS
done

# Busy weeks capped with "+N more" instead of showing fewer weeks
IFS='
'
# shellcheck disable=SC2086 # split on newlines, as above
render random-8-more-x --data "$out/random-8.json" $(node random-data.mjs 8 /dev/null) --set week_overflow=more
unset IFS
