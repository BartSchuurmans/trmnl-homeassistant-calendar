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

The plugin on TRMNL.com is set up as:

| Setting | Value |
|---|---|
| Strategy | Plugin Merge |
| Shared markup | `merge.liquid` followed by `../src/shared.liquid` |
| Full, half and quadrant markup | `../src/<view>.liquid` |
| Form fields | `custom_fields.yml` (without the comment header) |
| Framework CSS version | 3.3.1 |
| Remove bleed margin | Yes |

Keep `custom_fields.yml` in step with `../src/settings.yml` (same keys and defaults) when
settings change.
