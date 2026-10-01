#!/usr/bin/env sh
# Build the recipe as it runs on TRMNL.com from the repo sources, so there is one copy of
# the markup to maintain (see plugin/trmnl-com/README.md):
#
#   dist/trmnl-com/src/                    a trmnlp project: settings.yml from
#                                          plugin/trmnl-com, shared.liquid = merge.liquid
#                                          + plugin/src/shared.liquid, the views as-is
#   dist/rolling-month-calendar-trmnl-com.zip  the same files, for TRMNL's "Import" or
#                                          `trmnlp push` (.github/workflows/trmnl-com.yml)
#
# Reproducible like build-zip.sh: fixed order and modes, timestamps from the last commit
# touching plugin/.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/dist/trmnl-com/src"
zip="$root/dist/rolling-month-calendar-trmnl-com.zip"
rm -rf "$out" "$zip"
mkdir -p "$out"

epoch=${SOURCE_DATE_EPOCH:-$(git -C "$root" log -1 --format=%ct -- plugin 2>/dev/null || true)}
epoch=${epoch:-$(date +%s)}

cp "$root/plugin/trmnl-com/settings.yml" "$out/settings.yml"
cat "$root/plugin/trmnl-com/merge.liquid" "$root/plugin/src/shared.liquid" > "$out/shared.liquid"
for view in full half_horizontal half_vertical quadrant; do
    cp "$root/plugin/src/$view.liquid" "$out/$view.liquid"
done

chmod 644 "$out"/*
find "$out" -exec env TZ=UTC touch -d "@$epoch" {} +
# flat, like trmnlp's own archives (TRMNL reads the files by name)
cd "$out"
LC_ALL=C ls | TZ=UTC zip -qX "$zip" -@
echo "wrote ${out#"$root"/} and ${zip#"$root"/}"
