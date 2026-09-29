# LaraPaper (local)

[LaraPaper](https://github.com/usetrmnl/larapaper), the self-hosted TRMNL server, set
up so that rendering a screen needs no internet access. It is the official LaraPaper
image with these additions:

- **TRMNL framework 3.3.1** (CSS, JS and fonts) and **FullCalendar 6.1.21** are built
  into the image. LaraPaper normally loads the framework from trmnl.com, and the
  calendar recipe loads FullCalendar from jsDelivr, every time a screen renders.
- The Inter stylesheet from fonts.bunny.net is removed. The framework ships Inter itself.
- The database, generated screens and app key are kept in `/data`, so they survive
  updates and are part of Home Assistant backups.

The image is built on your Home Assistant when you install the app. That step does need
internet: it downloads the LaraPaper image and the files listed in `assets.txt`, each
checked against a pinned SHA-256.

## Setup

1. Set **App URL** to the address your TRMNL uses to reach this app, e.g.
   `http://192.168.1.10:4567`. The device downloads its screen image from there, so use
   an IP address or a name the device can resolve (`.local` names usually don't work).
2. Start the app and open the web UI. Register your account, then turn off
   **Allow registration**.
3. Point the TRMNL at the server. On firmware 1.4.6 or newer, hold the button on the
   back for 5 seconds, enter Wi-Fi, choose **Custom Server** and enter the App URL.
   With **Permit Auto-Join** switched on in LaraPaper's header, the device appears by
   itself.
4. Import the calendar recipe: `ha-calendar.zip` from the latest release
   (<https://github.com/BartSchuurmans/trmnl-homeassistant-calendar/releases/latest/download/ha-calendar.zip>),
   see the repository README. For **Home Assistant URL**, use
   `http://homeassistant:8123`: that is how apps reach Home Assistant.

## What still goes online

Rendering screens doesn't. LaraPaper's own background jobs still try to reach the
internet: a daily firmware check, a weekly device-model list update and an update
check in the web UI. They fail harmlessly when there's no connection. Recipes that load
their own scripts or images from the internet still need it too.

## Updating

LaraPaper updates come through updates of this app, which pin an exact LaraPaper
version (`build.yaml`).
