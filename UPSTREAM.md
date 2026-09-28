# Upstream

Forked from [usetrmnl/plugins](https://github.com/usetrmnl/plugins), `lib/calendars` and
`lib/google_calendar`, as of 2026-09-28.

| Upstream | Here |
|---|---|
| `lib/calendars/_full_month.html.erb` (`event_layout == 'rolling_month'`) | `plugin/src/full.liquid` and the `cfg` object in `shared.liquid` |
| `lib/calendars/_common.html.erb` (`trmnlInitCalendars`) | `plugin/src/shared.liquid` |
| `lib/google_calendar/google_calendar.rb` (`prepare_events`, filters, `time_min`/`time_max`) | `trmnlHaCalendar` in `shared.liquid`, `polling_url` in `settings.yml` |

## Kept as upstream

- FullCalendar `rollingMonth` view: `dayGridMonth` with a week duration,
  `fixedWeekCount: false`, `dateAlignment: 'day'` for daily advancement.
- Rendering 6 weeks, then re-rendering with only the 4–6 weeks that fit on screen.
- Day cells show only the number; the 1st of a month gets a month-name label.
- The ResizeObserver reflow fix for multi-day events (usetrmnl/core#2951).
- `displayEventEnd: true`, ISO week numbers, `eventTimeFormat`, the `now` / `initialDate`
  settings, and the `highlight-today` / `no-weekend-shading` classes.
- Event handling: `Busy` for events without a summary, ignored phrases (contains and
  exact match, on title and description), de-duplication across calendars, sorting by start.

## Changed

- **Data source**: Home Assistant's `/api/calendars/<entity>` REST endpoint, polled by
  LaraPaper, instead of the Google Calendar API. HA's JSON is turned into FullCalendar
  events in the browser; upstream does that server-side in `Calendar::Helper`, which is
  not public.
- **Time zones**: timed events are converted to the configured zone's wall-clock time and
  given to FullCalendar with `timeZone: 'UTC'`, so the result doesn't depend on the
  renderer's system zone. Day numbers and month labels read UTC dates to match.
- **FullCalendar**: the open-source 6.1 build from jsDelivr instead of the private
  build at trmnl.com. No `schedulerLicenseKey`, since dayGrid doesn't need one.
- **Styles**: upstream links `plugins/calendars` and `plugins/calendars_full_month`
  stylesheets that aren't published. The CSS in `shared.liquid` is written from scratch
  for grayscale e-ink.
- **Removed**: time-grid helpers (`trmnlAllDaySlotAuto`, `trmnlSlotBoundsAuto`, the
  week-view now indicator, `dayHeaders`), the colour options (`colorize_events`,
  `palette_colors`, `adaptiveEventStroke`), because HA calendars have no colours, and the
  RSVP filter (`ignore_based_on_acceptance?`), because HA doesn't expose attendees.
- **Added**: optional per-calendar labels, and a line above the grid naming any
  calendar that failed to load.
- **Settings**: exposed as custom fields (`settings.yml`) and read from
  `trmnl.plugin_settings.custom_fields_values`.
