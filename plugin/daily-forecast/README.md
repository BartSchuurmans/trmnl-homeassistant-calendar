# Daily Forecast

A companion recipe for the Rolling Month Calendar on TRMNL.com: it polls
[Open-Meteo](https://open-meteo.com)'s daily forecast (no account or key) for a latitude
and longitude, and the calendar's **Weather** dropdown picks it up through Plugin Merge
to show each day's weather next to its day number. On its own it shows the next week's
forecast (four days in a half view, three in a quadrant).

- `settings.yml`: the polling URL (16 days of `weather_code`, `temperature_2m_max` and
  `temperature_2m_min`, in the location's own time zone), refreshed hourly. TRMNL.com
  polls from shared servers, which share Open-Meteo's free limit per IP, and a daily
  forecast changes slowly.
- `shared.liquid`: the markup, captured as `daily_forecast` and printed by each view. It
  groups the WMO weather codes as `wmoCondition` in `../src/shared.liquid` does and uses
  the same icons.

Unlike the variants in this folder it doesn't share `../src`'s markup:
`scripts/build-variant.sh daily-forecast` copies these files as they are, and releases
upload it to TRMNL.com (`TRMNL_FORECAST_PLUGIN_ID`, see [the overview](../README.md)).
`node preview/render.mjs --recipe daily-forecast` renders it with a sample forecast.
