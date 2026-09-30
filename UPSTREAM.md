# Upstream

Forked from [usetrmnl/plugins](https://github.com/usetrmnl/plugins), `lib/calendars` and
`lib/google_calendar`, as of 2026-09-28. That repository has no license file; TRMNL
treats its native plugins as source-available and is fine with them being remixed. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

| Upstream | Here |
|---|---|
| `lib/calendars/_full_month.html.erb` (`event_layout == 'rolling_month'`) | `plugin/src/full.liquid` and the `cfg` object in `shared.liquid` |
| `lib/calendars/_common.html.erb` (`trmnlInitCalendars`) | `plugin/src/shared.liquid` |
| `lib/google_calendar/google_calendar.rb` (`prepare_events`, filters, `time_min`/`time_max`) | `trmnlHaCalendar` in `shared.liquid`, `polling_url` in `settings.yml` |

## Kept as upstream

- FullCalendar `rollingMonth` view: `dayGridMonth` with a week duration,
  `fixedWeekCount: false`, `dateAlignment: 'day'` for daily advancement.
- Rendering 6 weeks, then re-rendering with only the weeks that fit on screen (see
  Changed for how many at least).
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
- **FullCalendar**: the open-source 6.1 build instead of the private build at
  trmnl.com, loaded from `/ha-calendar/...` (served by the LaraPaper (local) app) with
  jsDelivr as fallback. No `schedulerLicenseKey`, since dayGrid doesn't need one.
- **Styles**: upstream links `plugins/calendars` and `plugins/calendars_full_month`
  stylesheets that aren't published. Here fonts, text sizes and greys come from TRMNL
  framework classes put on FullCalendar's elements through its `*ClassNames` hooks. The
  grid CSS in `shared.liquid` is written from scratch and sized with `--ui-scale`.
- **Transform fix**: `getBoundingClientRect()` is corrected inside the calendar, so
  FullCalendar sizes correctly under the framework's `transform: scale(--pixel-ratio)`.
- **Event look**: matched to upstream's month-layout preview. Timed events use
  FullCalendar's dot, restyled as a grey bar on the left, with a bold title
  and the time in grey below it. Multi-day events get a light grey fill (`bg--gray-70`)
  with a bold title; events from a coloured calendar have bold titles too. Single-day all-day events differ from upstream (which fills them
  too): they are drawn like timed events, with the bar and no time.
  Titles differ too: every title, of any kind of event, wraps over at most two lines and
  then ends in an ellipsis, where upstream wraps timed titles in full.
  Grid lines are thin grey (dotted on 1-/2-bit), headers are centred and bold with the
  weekend shaded, and day numbers are small.
- **Busy weeks**: upstream keeps at least 4 weeks, so a very busy month is cut off at
  the bottom. Here the `week_overflow` setting either shows only the weeks that fit
  (down to 1, the default) or keeps at least 3 and caps days with FullCalendar's
  `dayMaxEvents` ("+N more").
- **Day headers and today**: weekday names are small, uppercase and letter-spaced
  instead of `text--base`; month labels use the short month name ("Sep") instead of the
  long one, which got cut off. A past day's month label is muted like its number, and
  only the 1st of a month gets a bold number (FullCalendar also bolds the grid's first day). Today's weekday is also inverted in the header row,
  on top of upstream's pill around the number (now bold). Events that are over are faded
  (`fade_past_events`, greyscale screens and `Dither` only).
- **1-/2-bit screens** (`Adapt styles`): weekend shading only in the header row, and
  event times in solid black instead of `text--muted`, since grey patterns break up
  the pixel fonts.
- **Title bar**: the framework's `title_bar` with the visible date range replaces
  FullCalendar's `headerToolbar` (`month_header`).
- **Removed**: time-grid helpers (`trmnlAllDaySlotAuto`, `trmnlSlotBoundsAuto`, the
  week-view now indicator, `dayHeaders`), the Google colour options (`colorize_events`,
  `palette_colors`), replaced by per-calendar colours, and the
  RSVP filter (`ignore_based_on_acceptance?`), because HA doesn't expose attendees.
- **Colors**: upstream colours events from Google's calendar/event colours
  (`colorize_events`). HA has none, so each calendar gets a configured colour. Framework
  colour names go through `bg--*` classes; on 1-/2-bit screens the text gets
  `text-stroke`, like upstream's `adaptiveEventStroke`.
- **Added**: optional per-calendar prefixes, a line above the grid naming any
  calendar that failed to load, and the 1-/2-bit grey handling setting (adapted
  styles, or LaraPaper's `image-dither` switch for Floyd–Steinberg dithering).
- **Settings**: exposed as custom fields (`settings.yml`) and read from
  `trmnl.plugin_settings.custom_fields_values`.
