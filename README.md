# trmnl-homeassistant-calendar

A rolling-month calendar for a **TRMNL X**, served by a local BYOS server
([LaraPaper](https://github.com/usetrmnl/larapaper)) and fed by **Home Assistant**
calendar entities.

The plugin is a fork of the native TRMNL calendar plugin
([usetrmnl/plugins `lib/calendars`](https://github.com/usetrmnl/plugins/tree/master/lib/calendars)),
`rolling_month` layout, ported from ERB to a Liquid recipe. See [UPSTREAM.md](UPSTREAM.md)
for what was carried over and what changed.

![preview](docs/preview.png)

<sub>1-bit, adapted styles vs dithered:</sub><br>
<img src="docs/preview-1bit-adapt.png" width="49%"> <img src="docs/preview-1bit-dither.png" width="49%">

```
Home Assistant ──/api/calendars/<entity>──▶ LaraPaper (polls every 15 min)
                                               │ renders plugin/src/*.liquid
                                               ▼ in headless Chromium
                                            TRMNL X (1872×1404, 16 grays)
```

## Layout

| Path | What |
|---|---|
| `plugin/src/settings.yml` | Recipe settings: polling URL, auth header, custom fields |
| `plugin/src/full.liquid` | Markup (fork of `_full_month.html.erb`) |
| `plugin/src/shared.liquid` | CSS + JS (fork of `_common.html.erb` + the HA event mapping) |
| `preview/` | Local renderer: sample or live HA data → PNG at TRMNL X resolution |
| `scripts/build-zip.sh` | Packages `plugin/src` for import into LaraPaper |
| `docker-compose.yml` | LaraPaper |

## Setup

### 1. Run LaraPaper

```sh
cat > .env <<EOF
APP_KEY=base64:$(openssl rand -base64 32)
APP_URL=http://<server-ip>:4567
EOF
docker compose up -d
```

Open `http://<server-ip>:4567` and register. Set your time zone in your user
settings; the calendar uses it unless you set one on the plugin.

### 2. Point the TRMNL X at it

Firmware 1.4.6 or newer: hold the button on the back for 5 s to open the setup portal,
enter Wi-Fi, choose **Custom Server** and enter `http://<server-ip>:4567`. With
**Permit Auto-Join** switched on in LaraPaper's header, the device shows up by itself.
Check that its device model is **TRMNL X**.

### 3. Create a Home Assistant token

HA → your profile → **Security** → **Long-lived access tokens** → Create. Find your
calendar entity IDs under Settings → Devices & services → Entities (filter on
`calendar.`). Any calendar integration works (Local Calendar, Google, CalDAV, iCloud…).

Check it from the LaraPaper host:

```sh
curl -H "Authorization: Bearer $TOKEN" \
  "http://homeassistant.local:8123/api/calendars/calendar.family?start=2026-09-21&end=2026-11-10"
```

### 4. Import the plugin

```sh
./scripts/build-zip.sh        # → dist/ha-calendar.zip
```

LaraPaper → **Plugins** → add menu → **Import Recipe Archive** → upload `dist/ha-calendar.zip`. Then
open the recipe's settings and fill in:

- **Home Assistant URL**, e.g. `http://homeassistant.local:8123` (must be reachable
  from the LaraPaper container)
- **Access token**
- **Calendar entities**, e.g. `calendar.family`, `calendar.work`

Add the recipe to the device's playlist (**Add to Playlist** on the recipe page).

**Updating:** after changing anything under `plugin/src`, rebuild and import the ZIP
again. The recipe keeps the same `id` (`settings.yml`), so LaraPaper updates it in
place and keeps your settings.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Calendar labels | – | Optional short label per calendar, shown as `Label: Title` |
| Time zone | LaraPaper user time zone | Events are converted to this zone before rendering |
| Week starts on | Monday | |
| Advance | Weekly | `Daily` starts the grid at today instead of the start of the week |
| Time format | 24 hour | |
| Show event times / end times | yes / yes | End times take up most of a cell, turn them off for longer titles |
| Show past events | yes | Earlier days of the current week |
| Highlight today, Shade weekends | yes | |
| Show month title, week numbers | no | |
| Greys on 1-bit / 2-bit screens | Adapt styles | `Adapt` swaps greys for a pixel pattern and solid black text. `Dither` keeps the greys and has LaraPaper Floyd–Steinberg dither the whole screen. The TRMNL X (4-bit) is always dithered, so this only matters for 1-bit and 2-bit devices |
| Locale | `en` | Day/month names, e.g. `nl`, `de` |
| Ignore events containing / titled exactly | – | Same filters as upstream |

The grid shows as many whole weeks (4–6) as fit, like upstream: busy weeks make
rows taller, so fewer fit.

## Local preview

```sh
cd preview && npm install
node render.mjs                                   # sample events → out/preview.png
node render.mjs --set display_event_end=no --set locale=nl
node render.mjs --device og --set dither_greys=yes    # 1-bit, dithered greys
HA_URL=http://homeassistant.local:8123 HA_TOKEN=... \
  HA_CALENDARS=calendar.family,calendar.work node render.mjs   # your real calendars
```

Options: `--set key=value` (any custom field), `--tz Europe/Amsterdam`,
`--device og` / `og2` (800×480, 1-bit / 2-bit), `--raw` (skip the grey-level reduction), `--data payload.json`, `--out file.png`. It needs a Chromium;
set `CHROMIUM_PATH` if Playwright can't find one. The preview renders with
[liquidjs](https://liquidjs.com) and without the TRMNL framework CSS when trmnl.com
isn't reachable, so small differences from LaraPaper's output are possible.

## Notes

- The polling URL uses Liquid that relies on PHP's `DateTime` (`"today -7 days" | date`),
  which LaraPaper's Liquid engine supports. It fetches 7 days back to 43 days ahead,
  enough for the current week plus 6 weeks.
- FullCalendar and (for non-English locales) its locale bundle load from jsDelivr
  when the screen renders, so the LaraPaper container needs internet access. It
  also loads the TRMNL framework CSS from trmnl.com.
- Like LaraPaper, the preview reduces the screenshot to the device's grey levels. 4-bit
  is always dithered. 1-bit and 2-bit are dithered only when the page contains
  `<img class="image-dither">`, which is what the `Dither` setting adds.
- The token only goes into the request header. It is not written into the rendered page.
