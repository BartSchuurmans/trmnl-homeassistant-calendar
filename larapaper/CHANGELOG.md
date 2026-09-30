# Changelog

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
