# The recipe and its variants

The markup is maintained once, in `src/`: the recipe in trmnlp format, as LaraPaper runs
it (recipe catalog, Home Assistant app, ZIP import) and as trmnlp previews it.

Every other folder here is a **variant**: the same markup with another data source, for
another place to publish it. A variant has only what differs:

- `settings.yml` — its whole trmnlp settings: strategy, form fields, framework.
- optional `*.liquid` — put in front of `src/shared.liquid` (in name order), for data
  handling `src/` can't hold. `trmnl-com/merge.liquid` is one: LaraPaper's Liquid can't
  parse its lookup.

| Variant | Where | Data |
|---|---|---|
| `src/` | LaraPaper | ICS feeds, Home Assistant (polling) |
| [`trmnl-com/`](trmnl-com/README.md) | TRMNL.com | TRMNL calendar and weather plugins (Plugin Merge) |

A folder with views of its own (`full.liquid`) is a **companion recipe** instead: a
separate recipe that feeds a variant, built from its own files only and not compared with
`src/`. [`daily-forecast/`](daily-forecast/README.md) is one: Open-Meteo's daily forecast,
for `trmnl-com/`'s Weather dropdown.

`scripts/build-variant.sh [variant...]` builds each variant (and companion recipe) into `dist/<variant>/src` (a
trmnlp project) and `dist/rolling-month-calendar-<variant>.zip`. Lint (`trmnlp lint`)
runs on those builds, and every release attaches the ZIPs.

**Keeping them in step.** `preview/variants.mjs check` (run by `preview/ci.sh`) compares
each variant's form fields with `src/settings.yml`: the settings both have must match in
type, name, options, default and order, and a setting of `src/` that a variant leaves out
must be listed for that variant in `VARIANTS` there, with why. So a new setting fails CI
until each variant has it or says why not. The About text is each variant's own.

**Publishing to TRMNL.com.** TRMNL.com changes only on a release: `release.yml` runs
`.github/workflows/trmnl-com.yml`, which uploads each TRMNL.com variant with `trmnlp push`
and checks that TRMNL.com then matches the build. Weekly (and on demand from the Actions
tab) the same workflow only compares TRMNL.com with the latest release, so an edit made on
TRMNL.com itself shows up as a failed run with the differences in its summary. It needs
the `TRMNL_API_KEY` secret and, per variant, the plugin ID variable named in the
workflow's matrix (`TRMNL_PLUGIN_ID` for `trmnl-com`, `TRMNL_FORECAST_PLUGIN_ID` for
`daily-forecast`). Don't edit the markup on TRMNL.com,
in its editor or through the TRMNL MCP connector: change it here and release.

**Adding a variant** (say a TRMNL.com recipe polling Home Assistant):

1. `plugin/<name>/settings.yml` with its strategy and fields (here: polling URL and
   headers as in `src/settings.yml`, only the HA fields).
2. An entry in `VARIANTS` in `preview/variants.mjs`: the `src/` settings it leaves out,
   and a pattern for the fields only it has.
3. A matrix entry in `.github/workflows/trmnl-com.yml` with the variable holding its
   plugin ID, if it goes to TRMNL.com.
4. If its data arrives in a new shape: handle it in `src/shared.liquid`'s JS if every
   variant can share that, else in a `*.liquid` in the variant's folder; and a
   `render.mjs` option plus a `ci.sh` render for it.
