# The Home Assistant recipe on TRMNL.com

**Rolling Month Calendar (Home Assistant)**: the markup of `plugin/src`, polling Home
Assistant's calendar API (`/api/calendars/<entity>`) as `plugin/src` does, but from
TRMNL's servers. So Home Assistant has to be reachable from the internet (Home Assistant
Cloud's remote URL, or an own domain), and every request carries a long-lived access
token (`Authorization: Bearer`).

What it leaves out of `plugin/src` (see `VARIANTS` in `preview/variants.mjs`):

- **ICS feeds**: TRMNL.com only polls JSON (an `.ics` URL fails as "Malformed JSON").
- **Weather**: Home Assistant gives forecasts only to `weather.get_forecasts`, a POST,
  and TRMNL.com polls with GET; the LaraPaper (local) app's proxy that turns one into
  the other isn't there.

The data arrives as on TRMNL for any polling recipe: one calendar's list under `data`,
several as `IDX_0`, `IDX_1`, ... at the top level, which `shared.liquid` already reads.
`preview/ci.sh` renders it through trmnlp (`trmnlp-ha-x`).

## Built from the repo

This folder holds only `settings.yml` (polling URL and header, framework 3.3.1, bleed
margin removed, its form fields, the recipe page's `recipe_overview`).
`scripts/build-variant.sh trmnl-com-ha` builds the plugin, and releases upload it to
TRMNL.com once the `TRMNL_PLUGIN_ID_HA` variable names its plugin; see [the variants
overview](../README.md). Don't edit the plugin on TRMNL.com itself.
