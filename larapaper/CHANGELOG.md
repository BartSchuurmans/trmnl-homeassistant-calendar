# Changelog

## 0.43.0-4

- The app is now installed from a prebuilt image (`ghcr.io/bartschuurmans/larapaper-local`)
  instead of being built on your Home Assistant, so installs and updates are faster
  and no longer download the framework, fonts and FullCalendar on your system.

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
