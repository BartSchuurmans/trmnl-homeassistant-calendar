// Keeps the recipe's variants in step (see plugin/trmnl-com/README.md).
//
//   node variants.mjs check        plugin/trmnl-com/settings.yml against plugin/src/settings.yml:
//                                  the settings both have must match (type, options, default,
//                                  order), and every setting of plugin/src must be on TRMNL.com
//                                  too, unless LARAPAPER_ONLY says why not. Run by ci.sh.
//   node variants.mjs diff <dir>   a trmnlp project pulled from TRMNL.com (`trmnlp pull`)
//                                  against dist/trmnl-com/src (scripts/build-trmnl-com.sh):
//                                  markup, form fields and the settings we set. Run by
//                                  .github/workflows/trmnl-com.yml.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// Settings TRMNL.com leaves out: its data comes from Plugin Merge dropdowns instead
const LARAPAPER_ONLY = {
  ics_urls: 'TRMNL.com polls JSON only; an .ics feed fails as "Malformed JSON"',
  trmnl_plugins: 'replaced by the calendar_N dropdowns',
  trmnl_api_key: 'replaced by the calendar_N dropdowns',
  ha_url: 'Home Assistant would have to be reachable from the internet',
  ha_token: 'Home Assistant would have to be reachable from the internet',
  calendars: 'Home Assistant entities; replaced by the calendar_N dropdowns',
  dither_greys: 'LaraPaper\'s own dithering (the image-dither switch)',
};
// Settings only TRMNL.com has
const TRMNL_COM_ONLY = /^calendar_\d+$/;
// Differ on purpose: each About describes its own data sources
const OWN_TEXT = ['about'];
// Top-level settings both run with
const SHARED_SETTINGS = ['name', 'refresh_interval', 'framework_version'];

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => yaml.load(fs.readFileSync(file, 'utf8'));
const errors = [];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const [command, dir] = process.argv.slice(2);
if (command === 'check') check();
else if (command === 'diff' && dir) diff(dir);
else throw new Error('usage: node variants.mjs check | diff <pulled trmnlp project>');

if (errors.length) {
  console.log(errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}

function check() {
  const src = load(path.join(root, 'plugin/src/settings.yml'));
  const com = load(path.join(root, 'plugin/trmnl-com/settings.yml'));
  for (const key of SHARED_SETTINGS) {
    if (!same(src[key], com[key])) errors.push(`${key}: ${src[key]} in plugin/src, ${com[key]} in plugin/trmnl-com`);
  }
  const srcFields = new Map(src.custom_fields.map((f) => [f.keyname, f]));
  const comFields = new Map(com.custom_fields.map((f) => [f.keyname, f]));
  for (const key of srcFields.keys()) {
    if (!comFields.has(key) && !LARAPAPER_ONLY[key]) {
      errors.push(`${key}: in plugin/src/settings.yml but not plugin/trmnl-com/settings.yml (add it there, or to LARAPAPER_ONLY in preview/variants.mjs)`);
    }
  }
  for (const [key, field] of comFields) {
    const other = srcFields.get(key);
    if (!other) {
      if (!TRMNL_COM_ONLY.test(key)) errors.push(`${key}: only in plugin/trmnl-com/settings.yml`);
      continue;
    }
    if (LARAPAPER_ONLY[key]) errors.push(`${key}: on TRMNL.com, but LARAPAPER_ONLY says ${LARAPAPER_ONLY[key]}`);
    const props = OWN_TEXT.includes(key) ? ['field_type'] : ['field_type', 'name', 'options', 'default', 'optional'];
    for (const prop of props) {
      if (!same(field[prop], other[prop])) {
        errors.push(`${key}.${prop}: ${JSON.stringify(other[prop])} in plugin/src, ${JSON.stringify(field[prop])} in plugin/trmnl-com`);
      }
    }
  }
  const order = (fields) => fields.map((f) => f.keyname).filter((k) => srcFields.has(k) && comFields.has(k));
  if (!same(order(src.custom_fields), order(com.custom_fields))) {
    errors.push(`form fields are in a different order: ${order(src.custom_fields)} vs ${order(com.custom_fields)}`);
  }
  console.log(errors.length ? 'variants: FAILED' : 'variants: ok');
}

function diff(pulled) {
  const built = path.join(root, 'dist/trmnl-com/src');
  for (const file of fs.readdirSync(built).filter((f) => f.endsWith('.liquid'))) {
    const ours = fs.readFileSync(path.join(built, file), 'utf8');
    const theirs = path.join(pulled, file);
    // TRMNL stores markup with CRLF line ends when it was edited in the browser
    const live = fs.existsSync(theirs) ? fs.readFileSync(theirs, 'utf8').replace(/\r\n/g, '\n') : null;
    if (live === null) errors.push(`${file}: missing on TRMNL.com`);
    else if (live.trimEnd() !== ours.trimEnd()) errors.push(`${file}: differs (${firstDifference(live, ours)})`);
  }
  const ours = load(path.join(built, 'settings.yml'));
  const live = load(path.join(pulled, 'settings.yml')) || {};
  for (const key of Object.keys(ours).filter((k) => k !== 'custom_fields')) {
    if (String(ours[key] ?? '') !== String(live[key] ?? '')) errors.push(`settings ${key}: ${JSON.stringify(live[key])} on TRMNL.com, ${JSON.stringify(ours[key])} here`);
  }
  if (!same(live.custom_fields, ours.custom_fields)) {
    const liveFields = new Map((live.custom_fields || []).map((f) => [f.keyname, f]));
    const changed = ours.custom_fields.filter((f) => !same(f, liveFields.get(f.keyname))).map((f) => f.keyname);
    const extra = [...liveFields.keys()].filter((k) => !ours.custom_fields.some((f) => f.keyname === k));
    errors.push(`form fields differ: ${[...changed, ...extra.map((k) => `${k} (only on TRMNL.com)`)].join(', ') || 'order'}`);
  }
  console.log(errors.length ? 'TRMNL.com differs from the repo:' : 'TRMNL.com matches the repo');
}

function firstDifference(a, b) {
  const la = a.split('\n'), lb = b.split('\n');
  const i = la.findIndex((line, n) => line !== lb[n]);
  const n = i < 0 ? Math.min(la.length, lb.length) : i;
  return `from line ${n + 1}: TRMNL.com ${JSON.stringify((la[n] ?? '').trim().slice(0, 80))}, repo ${JSON.stringify((lb[n] ?? '').trim().slice(0, 80))}`;
}
