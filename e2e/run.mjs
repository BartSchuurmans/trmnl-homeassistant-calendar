// End-to-end test: recipe ZIP → LaraPaper → fake Home Assistant → device screen.
//
//   node e2e/run.mjs [--container app] [--url http://localhost:4567] [--zip dist/ha-calendar.zip]
//
// Needs a running app container (see .github/workflows/app.yml) that reaches this
// machine as http://homeassistant:8123 (docker run --add-host homeassistant:host-gateway),
// with its calendar proxy pointed there (-e SUPERVISOR_TOKEN=e2e-supervisor-token
// -e HA_API_URL=http://homeassistant:8123/api).
// Imports the recipe ZIP into LaraPaper, points it at the fake HA (entities and ICS
// feeds), then fetches the
// screen the way a TRMNL X does (GET /api/display) and checks what was polled and
// rendered. Screens land in e2e/out/.
//
// --local <larapaper dir> runs the helper with the host's PHP against a LaraPaper
// checkout instead of docker exec (for working on this script).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FEEDS, startFakeHa, SUPERVISOR_TOKEN, TOKEN } from './fake-ha.mjs';

const dir = path.dirname(new URL(import.meta.url).pathname);
const opt = { container: 'app', url: 'http://localhost:4567', zip: path.join(dir, '../dist/ha-calendar.zip'),
  local: null, ha: 'http://homeassistant:8123', tz: 'Europe/Amsterdam' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];

const outDir = path.join(dir, 'out');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures++;
};

// Runs larapaper.php in the app, returns its JSON output
let helper, zip;
if (opt.local) {
  helper = (...args) => execFileSync('php', [path.join(dir, 'larapaper.php'), ...args],
    { env: { ...process.env, LARAPAPER_DIR: opt.local }, encoding: 'utf8' });
  zip = path.resolve(opt.zip);
} else {
  execFileSync('docker', ['exec', opt.container, 'mkdir', '-p', '/tmp/e2e']);
  execFileSync('docker', ['cp', path.join(dir, 'larapaper.php'), `${opt.container}:/tmp/e2e/larapaper.php`]);
  execFileSync('docker', ['cp', opt.zip, `${opt.container}:/tmp/e2e/ha-calendar.zip`]);
  execFileSync('docker', ['exec', opt.container, 'chmod', '-R', 'a+rX', '/tmp/e2e']);
  helper = (...args) => execFileSync('docker', ['exec', '-u', 'www-data', '-w', '/var/www/html', opt.container,
    'php', '/tmp/e2e/larapaper.php', ...args], { encoding: 'utf8' });
  zip = '/tmp/e2e/ha-calendar.zip';
}
const php = (...args) => JSON.parse(helper(...args));

// YYYY-MM-DD of today + n days in the app's time zone (what PHP's "today" means there)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: opt.tz }).format(new Date());
const dayOffset = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

function pngSize(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const { server, requests } = await startFakeHa(8123);
try {
  const setup = php('setup', zip, opt.ha, TOKEN);
  console.log(`imported "${setup.name}" (framework ${setup.framework_version}) for a ${setup.device_model}`);
  check(setup.framework_version === '3.3.1', 'recipe framework_version is imported');

  const scenarios = [
    { name: 'two-calendars', config: { calendars: 'calendar.family,calendar.work', calendar_colors: '-,black' },
      keys: ['IDX_0', 'IDX_1'], events: { IDX_0: 100, IDX_1: 8 } },
    // one calendar: LaraPaper stores it unwrapped, so the template sees another shape
    { name: 'one-calendar', config: { calendars: 'calendar.work', calendar_colors: '' },
      keys: ['data'], events: { IDX_0: 8 } },
    // one calendar without events: LaraPaper stores a bare [] (its list check fails on [])
    { name: 'no-events', config: { calendars: 'calendar.empty', calendar_colors: '' },
      keys: [], events: {} },
    // ICS feeds instead of entities: parsed by LaraPaper, no token sent; ics_urls is
    // cleared again right after, since configure merges into the settings
    { name: 'ics-feeds', feeds: ['family', 'work'],
      config: { ics_urls: `${opt.ha}/feeds/family.ics, ${opt.ha}/feeds/work.ics`, calendar_colors: '-,black' },
      keys: ['IDX_0', 'IDX_1'] },
    // the app's calendar proxy (the recipe's default URL) instead of a user token;
    // last, since configure merges into the settings
    ...(opt.local ? [] : [{ name: 'app-proxy', token: SUPERVISOR_TOKEN,
      config: { ha_url: 'http://127.0.0.1:8124', ha_token: '', calendars: 'calendar.family,calendar.work', calendar_colors: '-,black' },
      keys: ['IDX_0', 'IDX_1'], events: { IDX_0: 100, IDX_1: 8 } }]),
  ];
  const results = {};
  for (const s of scenarios) {
    console.log(`\n== ${s.name}`);
    php('configure', JSON.stringify(s.config));
    const before = requests.length;

    const res = await fetch(`${opt.url}/api/display`, {
      headers: { 'access-token': setup.api_key, id: 'E2:E2:E2:E2:E2:E2', 'fw-version': '1.6.0' } });
    const body = await res.text();
    let display = {};
    try { display = JSON.parse(body); } catch { console.log(body.slice(0, 2000)); }
    check(res.ok && display.status === 0 && !!display.image_url, `/api/display returns a screen (${res.status} ${display.image_url})`);

    const polled = requests.slice(before);
    const state = php('check');
    console.log(JSON.stringify(state.calendars), JSON.stringify(state.image));
    check(JSON.stringify(state.payload_keys) === JSON.stringify(s.keys), `payload shape ${JSON.stringify(state.payload_keys)}`);
    if (s.feeds) {
      check(polled.length === s.feeds.length && s.feeds.every((f) => polled.some((r) => r.feed === f)),
        `fetched feeds ${s.feeds.join(', ')} (${polled.map((r) => r.feed ?? r.entity).join(', ')})`);
      check(polled.every((r) => !r.authorization), 'sent no access token to the feeds');
      // what LaraPaper's IcalResponseParser keeps: events overlapping 7 days back to 30
      // days ahead, recurrences expanded (±1 for an occurrence right on the edge)
      const from = Date.now() - 7 * 86400000, to = Date.now() + 30 * 86400000;
      s.feeds.forEach((f, i) => {
        const want = FEEDS[f].occurrences().filter((o) => (o.start >= from && o.start < to)
          || (o.end > from && o.end <= to) || (from >= o.start && to <= o.end)).length;
        const got = state.calendars[`IDX_${i}`]?.ical;
        check(Math.abs(got - want) <= 1, `${f} feed parsed into ${got} events (expected ${want})`);
      });
      php('configure', JSON.stringify({ ics_urls: '' }));
    } else {
      const entities = s.config.calendars.split(',');
      const token = s.token ?? TOKEN;
      check(polled.length === entities.length && entities.every((e) => polled.some((r) => r.entity === e)),
        `polled ${entities.join(', ')} (${polled.map((r) => r.entity).join(', ')})`);
      check(polled.every((r) => r.authorization === `Bearer ${token}`), `sent the ${s.token ? 'app' : 'user'} access token`);
      check(polled.every((r) => r.start === dayOffset(-7) && r.end === dayOffset(43)),
        `window ${dayOffset(-7)} .. ${dayOffset(43)} (${[...new Set(polled.map((r) => `${r.start} .. ${r.end}`))].join(', ')})`);
      check(JSON.stringify(state.calendars) === JSON.stringify(Object.fromEntries(
        Object.entries(s.events).map(([k, n]) => [k, { events: n }]))), 'payload holds the fake events');
    }
    // A render error leaves the plugin without an image and shows LaraPaper's error screen
    check(!!state.plugin_image && state.plugin_image === state.device_image, 'device shows the rendered recipe, not an error screen');
    check(state.image?.width === 1872 && state.image?.height === 1404, 'stored screen is 1872×1404');

    if (display.image_url) {
      const img = Buffer.from(await (await fetch(display.image_url)).arrayBuffer());
      const size = pngSize(img);
      check(size?.width === 1872 && size?.height === 1404, `served PNG is 1872×1404 (${JSON.stringify(size)})`);
      fs.writeFileSync(path.join(outDir, `${s.name}.png`), img);
    }
    results[s.name] = state.image;
  }

  console.log('\n== compare');
  const full = results['two-calendars']?.dark_ratio ?? 0;
  const empty = results['no-events']?.dark_ratio ?? 0;
  // The empty month still has day numbers and grid lines; the events add far more.
  check(empty > 0.005, `empty month has a grid and day numbers (dark ${empty})`);
  check(full > empty * 2 && full - empty > 0.02, `events are drawn (dark ${full} vs ${empty} without events)`);
  const ics = results['ics-feeds']?.dark_ratio ?? 0;
  check(ics > empty * 2 && ics - empty > 0.02, `ICS events are drawn (dark ${ics} vs ${empty} without events)`);

  const unauthorized = await fetch(`http://localhost:8123/api/calendars/calendar.family?start=${today}&end=${today}`);
  check(unauthorized.status === 401, 'fake HA rejects requests without the token');
} finally {
  server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
