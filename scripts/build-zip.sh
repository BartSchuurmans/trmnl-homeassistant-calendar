#!/usr/bin/env sh
# Package plugin/src as a recipe ZIP for LaraPaper (Plugins → Recipes → Import ZIP).
# Re-importing a ZIP with the same `id` (settings.yml) updates the existing recipe
# in place and keeps its configuration.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$root/dist"
out="$root/dist/ha-calendar.zip"
rm -f "$out"
cd "$root/plugin"
zip -qr "$out" src
echo "wrote ${out#"$root"/}"
