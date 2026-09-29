#!/usr/bin/env sh
# Package plugin/src as a recipe ZIP for LaraPaper (Plugins → Recipes → Import ZIP).
# Re-importing a ZIP with the same `id` (settings.yml) updates the existing recipe
# in place and keeps its configuration.
#
# The ZIP is reproducible: files in a fixed order and mode, no extra attributes, and
# every timestamp set to SOURCE_DATE_EPOCH (default: the last commit touching
# plugin/src), so a release asset can be checked against a local build.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$root/dist"
out="$root/dist/ha-calendar.zip"
rm -f "$out"

epoch=${SOURCE_DATE_EPOCH:-$(git -C "$root" log -1 --format=%ct -- plugin/src 2>/dev/null || true)}
epoch=${epoch:-$(date +%s)}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -R "$root/plugin/src" "$tmp/src"
# modes follow the checkout's umask; zip stores local time, so pin that to UTC
find "$tmp/src" -type d -exec chmod 755 {} +
find "$tmp/src" -type f -exec chmod 644 {} +
find "$tmp/src" -exec env TZ=UTC touch -d "@$epoch" {} +
cd "$tmp"
find src | LC_ALL=C sort | TZ=UTC zip -qX "$out" -@
echo "wrote ${out#"$root"/}"
