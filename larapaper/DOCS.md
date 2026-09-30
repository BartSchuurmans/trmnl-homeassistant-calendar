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
- The calendar recipe reads Home Assistant through `http://127.0.0.1:8124`, which
  forwards calendar requests (and nothing else) to Home Assistant with the app's own
  access. It is only reachable from inside the app.

Installing or updating the app downloads a prebuilt image
(`ghcr.io/bartschuurmans/larapaper-local`, amd64 and aarch64), which needs internet.
The image is built by this repository's CI from the LaraPaper image and the files
listed in `assets.txt`, each checked against a pinned SHA-256.

## Setup

1. Set **App URL** to the address your TRMNL uses to reach this app, e.g.
   `http://192.168.1.10:4567`. The device downloads its screen image from there, so use
   an IP address or a name the device can resolve (`.local` names usually don't work).
2. Start the app and open the web UI. Register your account, then turn off
   **Allow registration**.
3. Point the TRMNL at the server. A new device starts in Wi-Fi pairing mode; to get
   back to it, hold the left and right ends of the touch bar until the screen flashes
   (TRMNL X) or hold the button on the back for 6 to 8 seconds (TRMNL OG). Connect to
   the **TRMNL** Wi-Fi network, tap **Advanced** → **Custom Server** → **Yes** and enter
   the App URL without a trailing slash, then go **Back to Wi-Fi**, pick your network
   and **Connect**. With the **Auto-Join** toggle in LaraPaper's header switched on, the
   device appears by itself. The "Please visit trmnl.com/start" screen it then shows
   comes from the firmware and can be ignored; the device picks up its playlist at the
   next refresh. A TRMNL OG on firmware older than 1.4.6 has no
   **Custom Server** option and needs a firmware update first.
4. Import the calendar recipe: `ha-calendar.zip` from the latest release
   (<https://github.com/BartSchuurmans/trmnl-homeassistant-calendar/releases/latest/download/ha-calendar.zip>),
   see the repository README. Fill in your calendar entities and leave **Home
   Assistant URL** at `http://127.0.0.1:8124` and the access token empty: the app
   reads your calendars with its own Home Assistant access, so you don't need to create
   a token. A recipe you set up before keeps its URL and token when you update; change
   the URL to `http://127.0.0.1:8124` and clear the token to switch.

## What still goes online

Rendering screens doesn't. LaraPaper's own background jobs still try to reach the
internet: a daily firmware check, a weekly device-model list update and an update
check in the web UI. They fail harmlessly when there's no connection. Recipes that load
their own scripts or images from the internet still need it too.

## Updating

LaraPaper updates come through updates of this app, which pin an exact LaraPaper
version (`FROM` in the `Dockerfile`).
