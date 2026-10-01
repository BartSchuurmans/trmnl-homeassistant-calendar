# The recipe on TRMNL.com

TRMNL.com runs the same markup as `plugin/src`, with a different data source: the
[Plugin Merge](https://help.trmnl.com/) strategy instead of polling. Installers pick
their TRMNL calendar plugins (Google, Outlook, Apple, CalDAV, ...) in "Calendar"
dropdowns (`plugin_instance_select` without a `plugin_keyname`, so every plugin type is
listed); no plugin IDs or API key to look up.

How the data arrives: each dropdown stores the name TRMNL gives the chosen plugin's data
(for example `caldav_12345`), and the data sits at the top level under that name, in the
same shape as the Plugin Data API (`{events: [...], tz, ...}`). `merge.liquid` looks
each one up (`{{ [name] }}`) and passes them to `shared.liquid` as
`{IDX_0: ..., IDX_1: ...}`. It is a separate file because LaraPaper's Liquid (keepsuit)
can't parse that lookup; `render.mjs --merge` renders with it.

## One source, built for TRMNL.com

The markup is maintained once, in `../src`. `scripts/build-trmnl-com.sh` builds the
TRMNL.com recipe from it into `dist/trmnl-com/src` (a trmnlp project) and
`dist/rolling-month-calendar-trmnl-com.zip`:

| File | From |
|---|---|
| `settings.yml` | `settings.yml` in this folder: Plugin Merge, framework 3.3.1, bleed margin removed, the form fields |
| `shared.liquid` | `merge.liquid` followed by `../src/shared.liquid` |
| `full.liquid`, `half_*.liquid`, `quadrant.liquid` | `../src/<view>.liquid` |

So don't edit the plugin on TRMNL.com (in its editor or through the TRMNL MCP
connector): make the change here and upload the build. The form fields are the one part
kept by hand, because TRMNL.com has its own sources. `preview/variants.mjs check` (run by
`preview/ci.sh`) fails when a setting in `../src/settings.yml` is missing here or differs
in type, name, options, default or order; settings that can't work on TRMNL.com are
listed in `LARAPAPER_ONLY` there, with why.

Getting a change onto TRMNL.com:

- **Workflow:** run the "TRMNL.com" workflow (`.github/workflows/trmnl-com.yml`) with
  **Upload** ticked. It runs `trmnlp push` with the `TRMNL_API_KEY` secret to the plugin
  in the `TRMNL_PLUGIN_ID` variable. Without Upload, and after every change on main and
  weekly, it pulls the plugin and compares it with the build, so a TRMNL.com that is
  behind, or was edited there, shows up as a warning with the differences.
- **By hand:** `sh scripts/build-trmnl-com.sh`, then `trmnlp push --id <plugin id>` in
  `dist/trmnl-com` (with a `.trmnlp.yml`), or paste the files into the plugin's editor.

Uploading replaces the markup and form fields. The plugin's own field values (the chosen
calendars, prefixes, ...) should stay, but check them after the first upload.
