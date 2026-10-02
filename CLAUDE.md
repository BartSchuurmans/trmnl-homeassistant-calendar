# CLAUDE.md

Rolling-month calendar recipe for a TRMNL X, rendered by LaraPaper (self-hosted TRMNL
server) from ICS feeds or Home Assistant calendar entities. Forked from the native TRMNL calendar
plugin; see README.md for setup and UPSTREAM.md for what differs from upstream.

## Layout

- `plugin/src/` — the recipe (trmnlp format): `settings.yml` (polling URL, custom
  fields), `shared.liquid` (CSS + JS + the markup, captured as `rolling_calendar`;
  prepended to every view by TRMNL and LaraPaper), and the views `full.liquid`,
  `half_horizontal.liquid`, `half_vertical.liquid`, `quadrant.liquid`, which only print
  it. Narrow views (under 600 CSS px: left/right half, quadrant) get
  `.trmnl-calendar--narrow`.
- `preview/` — local renderer (`render.mjs`), CI render suite (`ci.sh`), random data
  (`random-data.mjs`), PHP Liquid check (`php/render.php`), sample calendars
  (`sample-data.mjs`: a six-week cycle, also written to `docs/sample-ics/*.ics` with
  `node preview/sample-data.mjs write`; TRMNL.com's marketplace preview polls those feeds
  from main, and `ci.sh` checks they're in step).
- `larapaper/` + `repository.yaml` — Home Assistant app: official LaraPaper image plus
  bundled TRMNL framework, fonts and FullCalendar (`assets.txt`, pinned by SHA-256).
- `e2e/` — end-to-end test against the app container: fake Home Assistant, driver,
  in-container helper.
- `plugin/<variant>/` (now `trmnl-com/`, see `plugin/README.md`) — the recipe for another
  channel: its own `settings.yml` and `*.liquid` put in front of `src/shared.liquid`.
  `trmnl-com/`: TRMNL.com, Plugin Merge strategy, `merge.liquid`. Never edit the markup
  on TRMNL.com; releases upload it.
- `scripts/build-zip.sh` — builds `dist/rolling-month-calendar.zip` for LaraPaper's recipe import;
  `scripts/build-variant.sh` builds the variants (`dist/<variant>/src`, ZIP each).
- `LICENSE` (MIT, own code) and `THIRD_PARTY_NOTICES.md` (upstream plugin, bundled
  assets) — keep the notices table in step with `assets.txt`.

## Checks

- `sh preview/ci.sh` — renders sample and random calendars (TRMNL X, OG 1-/2-bit) and
  once each through LaraPaper's PHP Liquid engine and trmnlp (TRMNL's Ruby Liquid, via
  Docker, `preview/trmnlp.mjs`); fails on template/JS errors, renders
  that don't finish, or `trmnlp lint` findings (`node preview/trmnlp.mjs --lint`; findings
  that don't apply are listed in `LINT_ALLOWED` there, with why). Renders run in parallel (`JOBS`, default one per CPU); each
  one's output is printed as it finishes. Needs `npm ci` in `preview/`, `composer install` in
  `preview/php/`, and `FRAMEWORK_DIR` set up as in `.github/workflows/render.yml`.
  Screenshots land in `preview/out/ci/` — look at them after visual changes.
- `node preview/render.mjs --device x|og|og2 --set key=value ...` for one-off renders;
  `--size half_horizontal|half_vertical|quadrant` renders that view inside a mashup.
- `node preview/variants.mjs check` (in `ci.sh`) — each variant's `settings.yml` in step
  with `plugin/src/settings.yml`. A new setting goes in every variant, or in that variant's
  `leftOut` in `VARIANTS` there.
- `sh preview/docs-images.sh` regenerates the README screenshots in `docs/`.
- `node e2e/run.mjs` — end-to-end: imports `dist/rolling-month-calendar.zip` into a running app
  container (`app`, started as in `app.yml` with `--add-host
  homeassistant:host-gateway`), polls the fake HA in `e2e/fake-ha.mjs`, fetches the
  TRMNL X screen via `/api/display` and checks payloads and pixels; screens in
  `e2e/out/`. `e2e/larapaper.php` runs inside the container through LaraPaper's own
  services. `--local <larapaper checkout>` runs it without Docker.
- CI: `.github/workflows/render.yml` (recipe), `trmnl-com.yml` (uploads the TRMNL.com
  variants on a release, compares TRMNL.com with the latest release weekly) and `app.yml` (builds and smoke-tests
  the Home Assistant app, then runs the end-to-end test; on main it publishes the image).

## Things that are easy to get wrong

**Rendering environment.** LaraPaper renders recipes with Browsershot (headless
Chromium) inside TRMNL framework 3.3.1 (`framework_version` in settings.yml). On the
TRMNL X it uses a 1872×1404 window at 1×, classes `screen--v2 screen--4bit
screen--scale-xxlarge`. The framework lays that out at 1040×780 and applies
`transform: scale(1.8)` to `.screen`, plus `--ui-scale: 1.5`. `render.mjs` reproduces
this; previews without the framework loaded are misleading (no fonts → Times New
Roman, wrong sizes). TRMNL.com renders the X at the scale its owner picked (regular,
`--ui-scale: 1`, by default; `render.mjs --scale regular`), so the calendar's text size
doesn't follow `--ui-scale` (see the `--font-small-font-size` override in `shared.liquid`).

**FullCalendar under the transform.** FullCalendar measures with
`getBoundingClientRect()`, which includes the transform, so `shared.liquid` patches it
inside `.trmnl-calendar` to return untransformed CSS pixels, with sizes from
`offsetWidth/offsetHeight`. Transformed rect sizes flip by a pixel with sub-pixel
position and FullCalendar's event layout then loops forever (the page hangs). The random
renders in `ci.sh` exist to catch that; keep them passing after layout changes.

**Browsershot content filter.** `setHtml` rejects any page containing `file:`,
`view-source`, `//localhost`, `//127.` etc. So assets can't be inlined (FullCalendar's
bundle contains `file:`) and can't point at localhost. Screens render from a temporary
`file://` page, so root-relative paths (`/fonts/...`, `/rolling-month-calendar/...`) resolve to the
filesystem there and to nginx in the browser preview — that is how the app serves
assets locally.

**LaraPaper Liquid context.** Custom field values are under
`trmnl.plugin_settings.custom_fields_values` (not top level). The polled payload is
`data`, but its keys are also spread on top, so one calendar's `{data: [...]}` makes
`data` the bare list; several calendars are `{IDX_0: ..., IDX_1: ...}`. One calendar
with no events is stored as a bare `[]` (LaraPaper's list check fails on empty arrays). The JS
normalises all shapes. TRMNL and trmnlp have no `data` for several URLs, only top-level
`IDX_n`, so `shared.liquid` rebuilds that object (`ci.sh` checks it through trmnlp).
LaraPaper uses keepsuit/liquid (PHP) with its own filters
(`json` etc.) and regex preprocessing of `date:` filters — test with `php/render.php`,
liquidjs alone is not proof.

**Polling URL.** Resolved by PHP Liquid with only the custom fields as variables. The
dates use timestamp maths from local midnight (`"now" | date: "%Y-%m-%d" | date: "%s" |
minus: 561600 | date: "%Y-%m-%d"`), which PHP and Ruby Liquid (TRMNL, Terminus) agree on;
the extra half day keeps DST days (23 or 25 h) from shifting the date, as counting whole
days from "now" did in the hour after midnight; PHP-only wording like `"today -7 days"`
comes out as text in Ruby. Don't use `T` in date formats there (PHP treats it as a
timezone). HA accepts date-only `start`/`end`. LaraPaper's importer turns every `=` in
`polling_headers` into `:`, so the header's Liquid can't use `=`, `==` or `assign`.

**ICS feeds.** Set `ics_urls` and they replace the HA entities (URL, no token). LaraPaper
parses a feed into `{ical: [{DTSTART, DTEND, SUMMARY, ...}]}` (`IcalResponseParser`):
recurrences expanded, only events from 7 days back to 30 days ahead, all-day events as
midnight-to-midnight timestamps (no all-day flag). `fromIcal` in `shared.liquid` maps that
to HA's shape, and the grid stops at the last week the feed covers. `render.mjs --ics`
fakes that shape; `e2e/fake-ha.mjs` serves real feeds.

**TRMNL calendar plugins.** Only on TRMNL.com (`plugin/trmnl-com/`, Plugin Merge):
"Calendar" dropdowns store the merged data's name (`caldav_<id>`), which `merge.liquid`
looks up with `{{ [name] }}`; the data is `{events: [...]}` with
`start_full`/`end_full`/`all_day` (`fromNative` in `shared.liquid`). keepsuit can't parse
that lookup, so it stays out of `shared.liquid`; `render.mjs --merge` covers it. The
LaraPaper recipe dropped its Plugin Data API source (plugin IDs + API key): ICS feeds
cover those calendars there.

**Home Assistant access.** In the app, the recipe's default URL `http://127.0.0.1:8124`
is an nginx proxy written by `larapaper/rootfs/etc/entrypoint.d/10-ha-calendar.sh`: it
forwards only GET `/api/calendars/` to `http://supervisor/core/api` with the app's
`SUPERVISOR_TOKEN` (`homeassistant_api: true`), so no user token is needed. It listens
on loopback only; don't publish it or widen its paths. Docker Compose setups still use a
URL and long-lived token. CI and the e2e test point it at the fake HA via `HA_API_URL`.

**FullCalendar 7 and the Mono theme.** v7 has no semantic `.fc-*` classes (they are
hashed); everything is styled through class hooks (`dayCellClass`, `listItemEventClass`,
`rowEventInnerClass`, ...). `window.trmnlMonoTheme` in `shared.liquid` is a theme plugin
naming the parts `mono-*`; the TRMNL adapter adds framework classes through the same
hooks (FullCalendar joins class hooks from plugins and options). The framework's CSS is in
cascade layers (`tn--*`), so unlayered CSS beats `bg--*`/`text--*` whatever its
specificity: the theme's colours go in `@layer tn--base.mono`, and colours a framework
class must be able to override never go unlayered. Event colours are event properties
(`color`, `contrastColor` → `--fc-event-color`). v7 lays out events from ResizeObservers
after `render()` returns, so week fitting measures two animation frames later. A one-week
grid has no day numbers (FullCalendar shows them from two weeks on).

**Greys and fonts.** Use framework classes (`text--small`, `bg--gray-*`,
`text--muted`) on FullCalendar elements via its class hooks, so each bit depth gets its
own rendering (solid on 4-bit, dither patterns on 1-/2-bit, pixel fonts on low-density
screens). The "Dither" setting paints raw palette vars (`var(--gray-70)`) through the
theme's variables and event colours instead, and emits LaraPaper's
`<img class="image-dither">` switch.

**Time zones.** HA sends timed events with offsets; they are converted to wall-clock
time in the configured zone and given to FullCalendar with `timeZone: 'UTC'`. Read
dates with `getUTC*`.

## Releasing

- Recipe: tag `vX.Y.Z` on main and push the tag. `release.yml` reruns the render suite
  and publishes a GitHub release with `rolling-month-calendar.zip` (+ `.sha256`). The ZIP is
  reproducible (`build-zip.sh` dates it by the last `plugin/src` commit). Every render
  run also uploads the ZIP as an artifact.
  The release also attaches each variant's ZIP and uploads the TRMNL.com variants there
  (`trmnl-com.yml`, needs the `TRMNL_API_KEY` secret and plugin ID variables); TRMNL.com
  changes only on a release.
- Home Assistant app: bump `version` in `larapaper/config.yaml` (`<LaraPaper
  version>-N`) with any change to the image; `app.yml` fails PRs that change app files
  other than DOCS.md/translations without a bump. Add an entry to
  `larapaper/CHANGELOG.md` (shown in HA's update dialog). HA offers the update once
  it's on main; `app.yml` then publishes the image (amd64 + aarch64, `image:` in
  config.yaml) to GHCR, skipping versions that already exist. HA pulls that image, it
  doesn't build locally, so a version on main without a published image can't install.

## Conventions

- Keep upstream's behaviour and comments where the code is forked (see UPSTREAM.md) and
  update UPSTREAM.md when diverging.
- Sizes in CSS scale with `--mono-u` (`--ui-scale`); colours use framework palette vars.
- After a change that alters how the calendar looks, regenerate the README screenshots
  in `docs/` with `sh preview/docs-images.sh` and commit them in the same PR.
- After changing `plugin/src/`, rebuild with `scripts/build-zip.sh`; re-importing the
  ZIP updates the recipe in LaraPaper in place (same `id`).
- Bumping LaraPaper: `BUILD_FROM` in `larapaper/Dockerfile` + `version` in `config.yaml`. Bumping the
  framework or FullCalendar: update `assets.txt` hashes (a tarball member is pinned by
  the tarball's hash) and the license texts listed there, and the paths in the
  Dockerfile, `shared.liquid` and `settings.yml`.
- Dependabot (`.github/dependabot.yml`) only bumps GitHub Actions and `preview/` npm
  packages, monthly. FullCalendar is ignored there; it and the versions above are bumped by
  hand across all their files. `upstream.yml` (weekly, `scripts/check-upstream.sh`) opens an
  issue when LaraPaper, the framework, FullCalendar or trmnlp has a newer release; closing
  one skips that version.
