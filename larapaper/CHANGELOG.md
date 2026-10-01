# Changelog

## 0.43.1-1

- LaraPaper 0.43.1, with a newer ICS parser (om/icalparser 4.1.4).

## 0.43.0-6

- The project is now called Rolling Month Calendar
  (`github.com/BartSchuurmans/trmnl-rolling-month-calendar`), because the calendar
  recipe also reads ICS feeds now. The app serves FullCalendar under
  `/rolling-month-calendar/` instead of `/ha-calendar/`, and the recipe ZIP is now
  `rolling-month-calendar.zip`. Import that ZIP from the latest release: it installs as
  a new recipe, so set it up again and remove the old one.

## 0.43.0-5

- The app is now installed from a prebuilt image (`ghcr.io/bartschuurmans/larapaper-local`)
  instead of being built on your Home Assistant, so installs and updates are faster
  and no longer download the framework, fonts and FullCalendar on your system.

## 0.43.0-4

- The calendar recipe no longer needs a long-lived access token. The app reads your
  calendars with its own Home Assistant access, through `http://127.0.0.1:8124`, the
  recipe's new default Home Assistant URL. A recipe you already set up keeps its URL and
  token: change the URL to `http://127.0.0.1:8124` and clear the token to switch.

## 0.43.0-3

- Include the license texts of the bundled TRMNL framework, fonts and FullCalendar
  next to them in the image.

## 0.43.0-2

- Enable PHP OPcache, as LaraPaper's own docker-compose setup does, so pages and
  renders need less CPU.

## 0.43.0-1

- First release: LaraPaper 0.43.0 with the TRMNL framework 3.3.1, its fonts and
  FullCalendar 6.1.21 built into the image, so rendering a screen needs no internet.
- The database, generated screens and app key are kept in `/data`.
