# LaraPaper (local): the official LaraPaper image plus everything a screen render
# would otherwise fetch from the internet.
# The official LaraPaper image is multi-arch (linux/amd64 + linux/arm64). To update
# LaraPaper, bump this tag and the version in config.yaml.
ARG BUILD_FROM=ghcr.io/usetrmnl/larapaper:0.43.0
FROM ${BUILD_FROM}

LABEL org.opencontainers.image.title="LaraPaper (local)" \
      org.opencontainers.image.source="https://github.com/BartSchuurmans/trmnl-homeassistant-calendar"

# Root so the entrypoint hook can take ownership of the Supervisor-mounted /data;
# PHP-FPM workers still run as www-data (serversideup-php images support this).
USER root

# TRMNL framework 3.3.1 (LaraPaper's default version) with its fonts, and FullCalendar.
# Each file is pinned by SHA-256 in assets.txt.
COPY assets.txt fetch-assets.sh /tmp/ha-calendar/
RUN sh /tmp/ha-calendar/fetch-assets.sh /tmp/ha-calendar/assets.txt /opt/ha-calendar-assets \
    && rm -rf /tmp/ha-calendar

# Serve them at root-relative paths. Screens render from a temporary file:// page, so
# "/fonts/x" resolves to the filesystem there, and to nginx (public/) in the browser
# preview. The framework CSS refers to its fonts as "/fonts/...".
RUN for dir in trmnl-framework fonts ha-calendar; do \
        ln -sfn "/opt/ha-calendar-assets/$dir" "/$dir"; \
        ln -sfn "/opt/ha-calendar-assets/$dir" "/var/www/html/public/$dir"; \
    done

# Point LaraPaper at the bundled framework instead of trmnl.com, and drop the Inter
# stylesheet from fonts.bunny.net (the framework ships Inter itself). OPcache on, as in
# LaraPaper's own docker-compose.
ENV TRMNL_BLADE_FRAMEWORK_CSS_URL=/trmnl-framework/3.3.1/plugins.min.css \
    TRMNL_BLADE_FRAMEWORK_JS_URL=/trmnl-framework/3.3.1/plugins.min.js \
    PHP_OPCACHE_ENABLE=1
RUN view=/var/www/html/resources/views/vendor/trmnl/components/screen.blade.php \
    && sed -i '/fonts\.bunny\.net/d' "$view" \
    && ! grep -q 'fonts\.bunny\.net' "$view"

# Also drop a recipe's cached screen when its settings change, not only its markup
# (see the comment in the patch).
COPY patches/plugin-settings-cache.php /tmp/ha-calendar-patches/
RUN model=/var/www/html/app/Models/Plugin.php \
    && grep -c 'static::updating(function ($model): void {' "$model" | grep -qx 1 \
    && sed -i '/static::updating(function ($model): void {/r /tmp/ha-calendar-patches/plugin-settings-cache.php' "$model" \
    && grep -q 'ha-calendar patch' "$model" \
    && php -l "$model" \
    && rm -rf /tmp/ha-calendar-patches

COPY rootfs /
RUN chmod +x /etc/entrypoint.d/10-ha-calendar.sh
