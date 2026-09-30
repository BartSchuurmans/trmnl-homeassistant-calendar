// Local preview: renders plugin/src/{shared,full}.liquid the way LaraPaper does and
// screenshots it. Like LaraPaper, the browser window is the device's pixel size at 1x
// (1872x1404 for the TRMNL X) inside the same screen markup and framework version, so
// the framework applies the same scale, fonts and grey patterns.
//
//   node render.mjs                         sample events → out/preview.png
//   HA_URL=http://ha:8123 HA_TOKEN=... HA_CALENDARS=calendar.family,calendar.work node render.mjs
//   node render.mjs --set first_day=0 --set time_format=am/pm --device og
//   node render.mjs --device og --set dither_greys=yes      1-bit, dithered greys
//
// For CI: --dump-context <file> writes the Liquid render context as JSON, --body <file>
// screenshots markup rendered elsewhere (e.g. by LaraPaper's PHP Liquid, php/render.php),
// and --strict exits non-zero on JavaScript errors in the page. --now YYYY-MM-DD renders
// as if it were noon on that day (sample events and the recipe's "today"), so
// screenshots don't change from one day to the next.
//
// Like LaraPaper's image stage (bnussbau/epaper-pipeline-php), the screenshot is
// reduced to the device's grey levels: 4-bit is always Floyd–Steinberg dithered,
// 1-/2-bit only when the page contains <img class="image-dither">. --raw skips this.
//
// The TRMNL framework (CSS, JS, fonts) loads from trmnl.com, or from a local copy when
// FRAMEWORK_DIR points at a directory with css/<v>/, js/<v>/ and fonts/ (the public/
// folder of github.com/usetrmnl/trmnl-framework at that version's tag). FullCalendar
// is served from node_modules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import yaml from 'js-yaml';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'plugin', 'src');
const outDir = path.join(here, 'out');

// Screen classes and CSS variables as LaraPaper sets them for its seeded device models
// (DeviceModel css_name / color_depth / scale_level / css_variables).
const DEVICES = {
  x: { width: 1872, height: 1404, classes: 'screen--v2 screen--4bit screen--scale-xxlarge', depth: '4bit', vars: {} },
  og: { width: 800, height: 480, classes: 'screen--og_png screen--1bit', depth: '1bit', vars: { '--ui-scale': '1.0', '--gap-scale': '1.0' } },
  og2: { width: 800, height: 480, classes: 'screen--og_png screen--2bit', depth: '2bit', vars: { '--ui-scale': '1.0', '--gap-scale': '1.0' } },
};

const args = process.argv.slice(2);
const overrides = {};
let deviceName = 'x';
let raw = false;
let dataFile = null;
let dumpContext = null;
let bodyFile = null;
let strict = false;
let now = new Date();
let out = path.join(outDir, 'preview.png');
let timeZone = process.env.TZ_NAME || Intl.DateTimeFormat().resolvedOptions().timeZone;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set') { const [k, ...v] = args[++i].split('='); overrides[k] = v.join('='); }
  else if (args[i] === '--device') deviceName = args[++i];
  else if (args[i] === '--raw') raw = true;
  else if (args[i] === '--data') dataFile = args[++i];
  else if (args[i] === '--dump-context') dumpContext = args[++i];
  else if (args[i] === '--body') bodyFile = args[++i];
  else if (args[i] === '--strict') strict = true;
  else if (args[i] === '--out') out = path.resolve(args[++i]);
  else if (args[i] === '--tz') timeZone = args[++i];
  else if (args[i] === '--now') now = new Date(`${args[++i]}T12:00:00`);
}
const device = DEVICES[deviceName];
if (!device) throw new Error(`unknown device ${deviceName}`);

const settings = yaml.load(fs.readFileSync(path.join(src, 'settings.yml'), 'utf8'));
const customFields = {};
for (const f of settings.custom_fields) if (f.default !== undefined) customFields[f.keyname] = String(f.default);
if (process.env.HA_CALENDARS) customFields.calendars = process.env.HA_CALENDARS;
Object.assign(customFields, overrides);

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

async function liveData() {
  const base = process.env.HA_URL.replace(/\/$/, '');
  const today = new Date(now);
  const q = `start=${iso(addDays(today, -7))}&end=${iso(addDays(today, 43))}`;
  const cals = (customFields.calendars || '').split(',').map((c) => c.trim()).filter(Boolean);
  const results = await Promise.all(cals.map(async (cal) => {
    const res = await fetch(`${base}/api/calendars/${cal}?${q}`, {
      headers: { Authorization: `Bearer ${process.env.HA_TOKEN}`, Accept: 'application/json' },
    });
    if (!res.ok) { console.warn(`${cal}: HTTP ${res.status}`); return { error: 'Failed to fetch data' }; }
    return { data: await res.json() };
  }));
  // same shape LaraPaper stores: one URL unwrapped, several keyed IDX_n
  if (results.length === 1) return results[0];
  return Object.fromEntries(results.map((r, i) => [`IDX_${i}`, r]));
}

// Sample events relative to today, in HA's /api/calendars response format.
function sampleData() {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  // UTC offset of the preview time zone, as HA would send it
  const offset = (() => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, timeZoneName: 'longOffset' })
      .formatToParts(today).find((p) => p.type === 'timeZoneName').value;
    return name === 'GMT' ? '+00:00' : name.replace('GMT', '');
  })();
  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timed = (day, from, to, summary, extra = {}) => ({
    start: { dateTime: `${local(addDays(today, day))}T${from}:00${offset}` },
    end: { dateTime: `${local(addDays(today, day))}T${to}:00${offset}` },
    summary, description: null, location: null, uid: `${summary}-${day}`, recurrence_id: null, rrule: null, ...extra,
  });
  const allDay = (day, days, summary) => ({
    start: { date: local(addDays(today, day)) }, end: { date: local(addDays(today, day + days)) },
    summary, description: null, location: null, uid: `${summary}-${day}`, recurrence_id: null, rrule: null,
  });
  // first Saturday at least three days out, so the weekend is always Sat–Sun
  const saturday = 3 + ((6 - (today.getDay() + 3) % 7) + 7) % 7;
  // A family of two adults: a shared calendar plus one of their own each
  const family = [
    timed(-2, '18:30', '19:30', 'Swimming lessons'),
    timed(2, '19:00', '21:00', 'Dinner with Anna & Tom'),
    allDay(1, 1, 'Bin day'),
    allDay(saturday, 2, 'Weekend in Antwerp'),
    timed(5, '18:30', '19:30', 'Swimming lessons'),
    timed(7, '15:00', '16:00', 'Parent-teacher meeting'),
    allDay(10, 1, 'Birthday Oma'),
    timed(10, '16:00', '19:00', 'Birthday party'),
    timed(12, '18:30', '19:30', 'Swimming lessons'),
    allDay(15, 1, 'Bin day'),
    allDay(saturday + 14, 9, 'Autumn holiday'),
    timed(26, '18:30', '19:30', 'Swimming lessons'),
    timed(30, '20:00', '22:30', 'Concert'),
  ];
  const mark = [
    timed(-1, '07:00', '08:00', 'Gym'),
    timed(saturday, '09:00', '10:30', 'Football'),
    timed(1, '12:00', '13:00', 'Lunch', { summary: null }),
    timed(0, '11:00', '12:00', 'Dentist'),
    timed(6, '09:00', '17:00', 'Offsite'),
    timed(9, '07:00', '08:00', 'Gym'),
    timed(22, '09:00', '09:30', 'Car service'),
  ];
  const sara = [
    timed(-1, '13:00', '14:30', 'Quarterly planning'),
    timed(0, '09:30', '10:00', 'Standup'),
    timed(1, '18:00', '19:00', 'Yoga'),
    // shared with the family calendar → de-duplicated
    timed(7, '15:00', '16:00', 'Parent-teacher meeting'),
    timed(15, '18:00', '19:00', 'Yoga'),
    timed(13, '14:00', '15:00', 'Design review'),
    allDay(26, 2, 'Conference'),
  ];
  return { IDX_0: { data: family }, IDX_1: { data: mark }, IDX_2: { data: sara } };
}

const payload = dataFile ? JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  : process.env.HA_URL ? await liveData() : sampleData();
if (!dataFile && !process.env.HA_URL && !overrides.calendars) customFields.calendars = 'calendar.family,calendar.mark,calendar.sara';

// LaraPaper render context: `data` is the payload, then the payload keys are spread
// on top (so a single calendar's { data: [...] } turns `data` into the bare list).
const context = {
  size: 'full',
  data: payload,
  config: customFields,
  ...payload,
  trmnl: {
    system: { timestamp_utc: Math.floor(now.getTime() / 1000) },
    user: { locale: 'en', time_zone_iana: timeZone, utc_offset: '0', name: 'Preview' },
    device: { width: device.width, height: device.height },
    plugin_settings: { instance_name: settings.name, custom_fields_values: customFields },
  },
};

if (dumpContext) fs.writeFileSync(dumpContext, JSON.stringify(context, null, 1));

const engine = new Liquid();
// The view wrapper comes from the platform, as on TRMNL: LaraPaper adds it to full.liquid
// on import (PluginImportService::ensureLiquidViewWrapper) and prepends shared.liquid.
const markup = fs.readFileSync(path.join(src, 'shared.liquid'), 'utf8') + '\n<div class="view view--full">\n' + fs.readFileSync(path.join(src, 'full.liquid'), 'utf8') + '\n</div>';
const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : await engine.parseAndRender(markup, context);

// LaraPaper's resources/views/vendor/trmnl/components/screen.blade.php
const fw = settings.framework_version || '3.3.1';
const vars = { '--screen-w': `${device.width}px`, '--screen-h': `${device.height}px`, ...device.vars };
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://trmnl.com/css/${fw}/plugins.css">
<script src="https://trmnl.com/js/${fw}/plugins.js"></script>
<style>:root { ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ')} }</style>
</head><body class="environment trmnl"><div class="screen ${device.classes}">${body}</div></body></html>`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out.replace(/\.png$/, '.html'), html);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: device.width, height: device.height }, deviceScaleFactor: 1, timezoneId: 'UTC' });
const nm = path.join(here, 'node_modules');
await page.route('https://cdn.jsdelivr.net/npm/**', (route) => {
  const rel = new URL(route.request().url()).pathname.replace(/^\/npm\//, '').replace(/@[\d.]+/, '');
  const file = path.join(nm, rel);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.abort();
});
const frameworkDir = process.env.FRAMEWORK_DIR;
await page.route('https://trmnl.com/**', (route) => {
  if (!frameworkDir) return route.continue().catch(() => route.abort());
  const file = path.join(frameworkDir, new URL(route.request().url()).pathname);
  return fs.existsSync(file) ? route.fulfill({ path: file }) : route.abort();
});
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !m.text().includes('parser-blocking')) console.warn(`[browser] ${m.text()}`); });
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(e.message); console.error(`[browser] ${e.message}`); });
await page.setContent(html, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
await page.waitForSelector('.trmnl-calendar[data-initialized]', { timeout: 10000 });
if (strict && pageErrors.length) {
  await browser.close();
  throw new Error(`JavaScript errors in the page: ${pageErrors.join('; ')}`);
}
await page.waitForTimeout(300);
const shot = await page.screenshot();
if (raw) {
  fs.writeFileSync(out, shot);
} else {
  const bits = parseInt(device.depth, 10);
  const dither = bits > 2 || /<img\b[^>]*\bclass\s*=\s*(["'])(?:[^"']*\s)?image--?dither(?:\s[^"']*)?\1/i.test(html);
  const png = await page.evaluate(async ({ src, bits, dither }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const im = ctx.getImageData(0, 0, img.width, img.height);
    const d = im.data, w = img.width, h = img.height;
    const levels = (1 << bits) - 1;
    const grey = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) grey[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const v = Math.round(Math.min(255, Math.max(0, grey[i])) / 255 * levels) * 255 / levels;
        const err = grey[i] - v;
        grey[i] = v;
        if (!dither) continue;
        if (x + 1 < w) grey[i + 1] += err * 7 / 16;
        if (y + 1 < h) {
          if (x > 0) grey[i + w - 1] += err * 3 / 16;
          grey[i + w] += err * 5 / 16;
          if (x + 1 < w) grey[i + w + 1] += err * 1 / 16;
        }
      }
    }
    for (let i = 0; i < w * h; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = grey[i]; d[i * 4 + 3] = 255; }
    ctx.putImageData(im, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { src: `data:image/png;base64,${shot.toString('base64')}`, bits, dither });
  fs.writeFileSync(out, Buffer.from(png, 'base64'));
  console.log(`${device.depth}${dither ? ', dithered' : ''}`);
}
await browser.close();
console.log(`wrote ${path.relative(process.cwd(), out)}`);
