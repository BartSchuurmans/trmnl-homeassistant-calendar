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

# Home Assistant API without a user token: with homeassistant_api in config.yaml the
# Supervisor gives the app its own token (SUPERVISOR_TOKEN). The recipe can't read
# environment variables, so nginx serves Home Assistant's calendar endpoint on
# 127.0.0.1:8124 and adds the token there. Only calendar reads and daily weather
# forecasts get through, and only from inside this container. HA_API_URL is for the
# end-to-end test's fake HA.
HA_PROXY_CONF=/etc/nginx/conf.d/ha-calendar-api.conf
HA_API_URL="${HA_API_URL:-http://supervisor/core/api}"
# nginx won't start if the upstream name doesn't resolve
# shellcheck disable=SC2016 # PHP code, not shell expansions
ha_api_host="$(php -r '$h = parse_url($argv[1], PHP_URL_HOST);
                       echo gethostbyname($h) === $h ? "" : $h;' "$HA_API_URL")"
# Forecasts are a service call (POST weather.get_forecasts), but the recipe can only
# poll with GET: the weather location turns a GET for one entity into that one call.
# proxy_pass can't take a path there (the URI is rewritten), so split the URL.
# shellcheck disable=SC2016 # PHP code, not shell expansions
ha_api_origin="$(php -r '$u = parse_url($argv[1]);
                         echo $u["scheme"] . "://" . $u["host"] . (isset($u["port"]) ? ":" . $u["port"] : "");' "$HA_API_URL")"
# shellcheck disable=SC2016
ha_api_path="$(php -r 'echo rtrim(parse_url($argv[1], PHP_URL_PATH) ?? "", "/");' "$HA_API_URL")"
rm -f "$HA_PROXY_CONF"
if [ -z "$SUPERVISOR_TOKEN" ]; then
    log "no SUPERVISOR_TOKEN: calendar proxy off, the recipe needs an access token"
elif [ -z "$ha_api_host" ]; then
    log "can't resolve $HA_API_URL: calendar proxy off, the recipe needs an access token"
else
    cat > "$HA_PROXY_CONF" <<CONF
# /api/weather/<weather entity> → the entity id, or empty for anything else
map \$uri \$ha_weather_entity {
    "~^/api/weather/(?<entity>weather\\.[a-z0-9_]+)\$" \$entity;
    default "";
}

server {
    listen 127.0.0.1:8124;
    access_log off;

    location /api/calendars/ {
        limit_except GET { deny all; }
        proxy_pass ${HA_API_URL}/calendars/;
        proxy_set_header Authorization "Bearer ${SUPERVISOR_TOKEN}";
    }

    location /api/weather/ {
        limit_except GET { deny all; }
        if (\$ha_weather_entity = "") { return 404; }
        # (the trailing ? drops the request's own query string)
        rewrite ^ ${ha_api_path}/services/weather/get_forecasts?return_response? break;
        proxy_method POST;
        proxy_set_header Content-Type application/json;
        proxy_set_body '{"entity_id": "\$ha_weather_entity", "type": "daily"}';
        proxy_pass ${ha_api_origin};
        proxy_set_header Authorization "Bearer ${SUPERVISOR_TOKEN}";
    }

    location / {
        return 404;
    }
}
CONF
    chmod 600 "$HA_PROXY_CONF"
    log "calendar and weather proxy on http://127.0.0.1:8124 → $HA_API_URL"
fi
