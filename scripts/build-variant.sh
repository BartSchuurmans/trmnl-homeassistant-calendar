#!/usr/bin/env sh
# Build a variant of the recipe (a folder in plugin/ next to src, e.g. trmnl-com) from the
# repo sources, so there is one copy of the markup to maintain (see plugin/README.md):
#
#   dist/<variant>/src/                         a trmnlp project: the variant's settings.yml,
#                                               shared.liquid = the variant's *.liquid (in
#                                               name order) + plugin/src/shared.liquid, and
#                                               plugin/src's views as-is
#   dist/rolling-month-calendar-<variant>.zip   the same files, for TRMNL's "Import" or
#                                               `trmnlp push` (.github/workflows/trmnl-com.yml)
#
#   sh scripts/build-variant.sh <variant>...    (no arguments: every variant)
#
# Reproducible like build-zip.sh: fixed order and modes, timestamps from the last commit
# touching plugin/.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)

if [ $# -eq 0 ]; then
    for dir in "$root"/plugin/*/; do
        name=$(basename "$dir")
        [ "$name" != src ] && [ -f "$dir/settings.yml" ] && set -- "$@" "$name"
    done
fi

epoch=${SOURCE_DATE_EPOCH:-$(git -C "$root" log -1 --format=%ct -- plugin 2>/dev/null || true)}
epoch=${epoch:-$(date +%s)}

for variant in "$@"; do
    dir="$root/plugin/$variant"
    [ -f "$dir/settings.yml" ] || { echo "no plugin/$variant/settings.yml" >&2; exit 1; }
    out="$root/dist/$variant/src"
    zip="$root/dist/rolling-month-calendar-$variant.zip"
    rm -rf "$out" "$zip"
    mkdir -p "$out"

    cp "$dir/settings.yml" "$out/settings.yml"
    # the variant's own Liquid (e.g. trmnl-com/merge.liquid) goes in front of the shared markup
    {
        find "$dir" -maxdepth 1 -name '*.liquid' | LC_ALL=C sort | while read -r file; do cat "$file"; done
        cat "$root/plugin/src/shared.liquid"
    } > "$out/shared.liquid"
    for view in full half_horizontal half_vertical quadrant; do
        cp "$root/plugin/src/$view.liquid" "$out/$view.liquid"
    done

    chmod 644 "$out"/*
    find "$out" -exec env TZ=UTC touch -d "@$epoch" {} +
    # flat, like trmnlp's own archives (TRMNL reads the files by name)
    (cd "$out" && LC_ALL=C ls | TZ=UTC zip -qX "$zip" -@)
    echo "wrote ${out#"$root"/} and ${zip#"$root"/}"
done
