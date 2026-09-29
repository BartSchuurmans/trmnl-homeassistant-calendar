# CLAUDE.md

Rolling-month calendar recipe for a TRMNL X, rendered by LaraPaper (self-hosted TRMNL
server) from Home Assistant calendar entities. Forked from the native TRMNL calendar
plugin; see README.md for setup and UPSTREAM.md for what differs from upstream.

## Layout

- `plugin/src/` — the recipe (trmnlp format): `settings.yml` (polling URL, custom
  fields), `full.liquid` (markup), `shared.liquid` (CSS + JS, prepended by LaraPaper).
- `preview/` — local renderer (`render.mjs`), CI render suite (`ci.sh`), random data
  (`random-data.mjs`), PHP Liquid check (`php/render.php`).
- `larapaper/` + `repository.yaml` — Home Assistant app: official LaraPaper image plus
  bundled TRMNL framework, fonts and FullCalendar (`assets.txt`, pinned by SHA-256).
- `e2e/` — end-to-end test against the app container: fake Home Assistant, driver,
  in-container helper.
- `scripts/build-zip.sh` — builds `dist/ha-calendar.zip` for LaraPaper's recipe import.

## Checks

- `sh preview/ci.sh` — renders sample and random calendars (TRMNL X, OG 1-/2-bit) and
  once through LaraPaper's PHP Liquid engine; fails on template/JS errors or renders
  that don't finish. Needs `npm ci` in `preview/`, `composer install` in
  `preview/php/`, and `FRAMEWORK_DIR` set up as in `.github/workflows/render.yml`.
  Screenshots land in `preview/out/ci/` — look at them after visual changes.
- `node preview/render.mjs --device x|og|og2 --set key=value ...` for one-off renders.
- `node e2e/run.mjs` — end-to-end: imports `dist/ha-calendar.zip` into a running app
  container (`app`, started as in `app.yml` with `--add-host
  homeassistant:host-gateway`), polls the fake HA in `e2e/fake-ha.mjs`, fetches the
  TRMNL X screen via `/api/display` and checks payloads and pixels; screens in
  `e2e/out/`. `e2e/larapaper.php` runs inside the container through LaraPaper's own
  services. `--local <larapaper checkout>` runs it without Docker.
- CI: `.github/workflows/render.yml` (recipe) and `app.yml` (builds and smoke-tests
  the Home Assistant app, then runs the end-to-end test).

## Things that are easy to get wrong

**Rendering environment.** LaraPaper renders recipes with Browsershot (headless
Chromium) inside TRMNL framework 3.3.1 (`framework_version` in settings.yml). On the
TRMNL X it uses a 1872×1404 window at 1×, classes `screen--v2 screen--4bit
screen--scale-xxlarge`. The framework lays that out at 1040×780 and applies
`transform: scale(1.8)` to `.screen`, plus `--ui-scale: 1.5`. `render.mjs` reproduces
this; previews without the framework loaded are misleading (no fonts → Times New
Roman, wrong sizes).

**FullCalendar under the transform.** FullCalendar measures with
`getBoundingClientRect()`, which includes the transform, so `shared.liquid` patches it
inside `.trmnl-calendar` to return untransformed CSS pixels, with sizes from
`offsetWidth/offsetHeight`. Transformed rect sizes flip by a pixel with sub-pixel
position and FullCalendar's event layout then loops forever (the page hangs). The random
renders in `ci.sh` exist to catch that; keep them passing after layout changes.

**Browsershot content filter.** `setHtml` rejects any page containing `file:`,
`view-source`, `//localhost`, `//127.` etc. So assets can't be inlined (FullCalendar's
bundle contains `file:`) and can't point at localhost. Screens render from a temporary
`file://` page, so root-relative paths (`/fonts/...`, `/ha-calendar/...`) resolve to the
filesystem there and to nginx in the browser preview — that is how the app serves
assets locally.

**LaraPaper Liquid context.** Custom field values are under
`trmnl.plugin_settings.custom_fields_values` (not top level). The polled payload is
`data`, but its keys are also spread on top, so one calendar's `{data: [...]}` makes
`data` the bare list; several calendars are `{IDX_0: ..., IDX_1: ...}`. One calendar
with no events is stored as a bare `[]` (LaraPaper's list check fails on empty arrays). The JS
normalises all shapes. LaraPaper uses keepsuit/liquid (PHP) with its own filters
(`json` etc.) and regex preprocessing of `date:` filters — test with `php/render.php`,
liquidjs alone is not proof.

**Polling URL.** Resolved by PHP Liquid with only the custom fields as variables; the
dates rely on PHP `DateTime` wording (`"today -7 days" | date: "%Y-%m-%d"`). Don't use
`T` in date formats there (PHP treats it as a timezone). HA accepts date-only
`start`/`end`.

**Greys and fonts.** Use framework classes (`text--small`, `bg--gray-*`,
`text--muted`) on FullCalendar elements via its `*ClassNames` hooks / `eventDidMount`,
so each bit depth gets its own rendering (solid on 4-bit, dither patterns on 1-/2-bit,
pixel fonts on low-density screens). FullCalendar's own event background wins over
`bg--*` in the cascade, which is why fills go on `.fc-event-main`. The "Dither" setting
paints raw palette vars (`var(--gray-70)`) instead and emits LaraPaper's
`<img class="image-dither">` switch.

**Time zones.** HA sends timed events with offsets; they are converted to wall-clock
time in the configured zone and given to FullCalendar with `timeZone: 'UTC'`. Read
dates with `getUTC*`.

## Releasing

- Recipe: tag `vX.Y.Z` on main and push the tag. `release.yml` reruns the render suite
  and publishes a GitHub release with `ha-calendar.zip` (+ `.sha256`). The ZIP is
  reproducible (`build-zip.sh` dates it by the last `plugin/src` commit). Every render
  run also uploads the ZIP as an artifact.
- Home Assistant app: bump `version` in `larapaper/config.yaml` (`<LaraPaper
  version>-N`) with any change to the image; `app.yml` fails PRs that change app files
  other than DOCS.md/translations without a bump. Add an entry to
  `larapaper/CHANGELOG.md` (shown in HA's update dialog). HA offers the update once
  it's on main.

## Conventions

- Keep upstream's behaviour and comments where the code is forked (see UPSTREAM.md) and
  update UPSTREAM.md when diverging.
- Sizes in CSS scale with `--cal-u` (`--ui-scale`); colours use framework palette vars.
- After changing `plugin/src/`, rebuild with `scripts/build-zip.sh`; re-importing the
  ZIP updates the recipe in LaraPaper in place (same `id`).
- Bumping LaraPaper: `larapaper/build.yaml` + `version` in `config.yaml`. Bumping the
  framework or FullCalendar: update `assets.txt` hashes and the paths in the
  Dockerfile, `shared.liquid` and `settings.yml`.
