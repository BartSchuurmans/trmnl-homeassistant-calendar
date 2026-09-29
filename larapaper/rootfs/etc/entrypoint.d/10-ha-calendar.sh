#!/bin/sh
# Home Assistant glue for LaraPaper. serversideup-php runs /etc/entrypoint.d/* in
# order on every start, before 50-laravel-automations.sh (migrations, config cache),
# so what this writes to .env is live on each boot.
set -e

APP_DIR="${APP_DIR:-/var/www/html}"
DATA_DIR="${DATA_DIR:-/data}"

log() { echo "[larapaper-local] $1"; }

# Keep the database and generated screens in /data, which survives app updates and
# is included in Home Assistant backups (same paths as upstream docker-compose).
persist() {
    image_path="$APP_DIR/$1"
    data_path="$DATA_DIR/$2"
    mkdir -p "$data_path"
    if [ ! -L "$image_path" ]; then
        if [ -d "$image_path" ]; then
            cp -a "$image_path/." "$data_path/" 2>/dev/null || true
            rm -rf "$image_path"
        fi
        mkdir -p "$(dirname "$image_path")"
        ln -s "$data_path" "$image_path"
    fi
}
persist database/storage database
persist storage/app/public/images/generated generated
[ -f "$DATA_DIR/database/database.sqlite" ] || touch "$DATA_DIR/database/database.sqlite"
chown -R www-data:www-data "$DATA_DIR/database" "$DATA_DIR/generated" 2>/dev/null || true

# APP_KEY is generated once: rotating it would invalidate encrypted settings.
if [ ! -s "$DATA_DIR/app_key" ]; then
    echo "base64:$(head -c 32 /dev/urandom | base64 | tr -d '\n')" > "$DATA_DIR/app_key"
    log "generated APP_KEY"
fi

# App options (/data/options.json); PHP is in the image, jq/bashio are not.
opt() {
    # shellcheck disable=SC2016 # PHP code, not shell expansions
    php -r '$o = json_decode(@file_get_contents($argv[1]), true) ?: [];
            $v = $o[$argv[2]] ?? "";
            echo is_bool($v) ? ($v ? "1" : "0") : $v;' "$DATA_DIR/options.json" "$1"
}

set_env() {
    tmp="$APP_DIR/.env.tmp"
    grep -v "^$1=" "$APP_DIR/.env" > "$tmp" || true
    printf '%s=%s\n' "$1" "$2" >> "$tmp"
    cat "$tmp" > "$APP_DIR/.env"
    rm -f "$tmp"
}

APP_URL="$(opt app_url)"
APP_URL="${APP_URL%/}"
REGISTRATION_ENABLED="$(opt registration_enabled)"

set_env APP_KEY "$(cat "$DATA_DIR/app_key")"
set_env APP_ENV production
set_env APP_DEBUG false
set_env DB_DATABASE database/storage/database.sqlite
set_env APP_TIMEZONE "${TZ:-UTC}"
set_env REGISTRATION_ENABLED "${REGISTRATION_ENABLED:-1}"
[ -n "$APP_URL" ] && set_env APP_URL "$APP_URL"

log "APP_URL=${APP_URL:-<unset>} TZ=${TZ:-UTC} registration=${REGISTRATION_ENABLED:-1}"
