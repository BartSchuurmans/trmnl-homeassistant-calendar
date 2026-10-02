// Renders plugin/src with trmnlp, TRMNL's own preview tool (Ruby Liquid, as on TRMNL and
// Terminus), and writes the markup of one view (full by default, or a half inside trmnlp's
// mashup, or the quadrant) for render.mjs --body to screenshot.
//
//   node trmnlp.mjs <context.json> <body.html> [full|half_horizontal|half_vertical|quadrant]
//                                                   (context from render.mjs --dump-context)
//   TRMNLP_VARIANT=trmnl-com node trmnlp.mjs ...    a variant or companion recipe in
//                                                   plugin/ instead, put together as
//                                                   scripts/build-variant.sh does
//   node trmnlp.mjs --pull                          only fetches the image, if missing
//   node trmnlp.mjs --lint                          runs `trmnlp lint` (see lint() below)
//
// Needs Docker (the trmnl/trmnlp image). The context's custom fields and payload go into
// .trmnlp.yml, so trmnlp hands the payload over the TRMNL way: its keys at the top level,
// several calendars as IDX_0, IDX_1, ... and no `data`. trmnlp's own polling can't reach
// the sample URLs and is left to fail (it only warns). Its PNGs need trmnl.com, so the
// screenshot is left to render.mjs, which serves the framework locally.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const IMAGE = 'trmnl/trmnlp:v0.13.0';
// `trmnlp lint` findings that don't apply to this recipe
const LINT_ALLOWED = [
  // Counts words like padding, margin and font-size anywhere in the markup, stylesheet
  // included. Ours are all in shared.liquid's stylesheet for FullCalendar's generated
  // elements, which framework classes mostly can't reach (where they can, the recipe adds
  // them through FullCalendar's class hooks).
  'Markup uses too many inline styles, add more native Framework classes.',
];

const here = path.dirname(fileURLToPath(import.meta.url));
const [contextFile, bodyFile, size = 'full'] = process.argv.slice(2);
if (contextFile === '--pull') {
  try {
    execFileSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' });
  } catch {
    execFileSync('docker', ['pull', '--quiet', IMAGE], { stdio: 'inherit' });
  }
  process.exit(0);
}
if (contextFile === '--lint') process.exit(lint() ? 0 : 1);
if (!contextFile || !bodyFile) throw new Error('usage: node trmnlp.mjs <context.json> <body.html> [size]');

const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
// Plugin Merge (render.mjs --merge) has no polled `data`: the chosen plugins' data is at the top level
const { size: _size, config: _config, trmnl: _trmnl, ...merged } = context;
const payload = 'data' in context ? context.data : merged;
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'trmnlp-'));
const plugin = path.join(here, '..', 'plugin');
const variant = process.env.TRMNLP_VARIANT;
fs.cpSync(path.join(plugin, variant && fs.existsSync(path.join(plugin, variant, 'full.liquid')) ? variant : 'src'),
  path.join(project, 'src'), { recursive: true });
if (variant && !fs.existsSync(path.join(plugin, variant, 'full.liquid'))) {
  // a variant: its settings, and its own Liquid in front of the shared markup
  const own = fs.readdirSync(path.join(plugin, variant)).filter((f) => f.endsWith('.liquid')).sort();
  fs.copyFileSync(path.join(plugin, variant, 'settings.yml'), path.join(project, 'src', 'settings.yml'));
  fs.writeFileSync(path.join(project, 'src', 'shared.liquid'),
    own.map((f) => fs.readFileSync(path.join(plugin, variant, f), 'utf8')).join('')
    + fs.readFileSync(path.join(plugin, 'src', 'shared.liquid'), 'utf8'));
}
fs.writeFileSync(path.join(project, '.trmnlp.yml'), yaml.dump({
  watch: false,
  time_zone: context.trmnl.user.time_zone_iana,
  custom_fields: context.config,
  variables: Array.isArray(payload) ? { data: payload } : payload,
}));

execFileSync('docker', ['run', '--rm', '--user', `${process.getuid()}:${process.getgid()}`,
  '--volume', `${project}:/plugin`, IMAGE, 'build'], { stdio: 'inherit' });

// The view as trmnlp renders it: everything inside <div class="screen">
const html = fs.readFileSync(path.join(project, '_build', `${size}.html`), 'utf8');
// (screen--no-bleed and the like with no_screen_padding, as on TRMNL.com)
const open = html.match(/<div class="screen(?: [^"]*)?">/);
const start = open ? open.index + open[0].length : -1;
const end = html.lastIndexOf('</div>', html.lastIndexOf('</body>'));
if (start < 0 || end < start) throw new Error('unexpected trmnlp output');
fs.writeFileSync(bodyFile, html.slice(start, end));
fs.rmSync(project, { recursive: true, force: true });

// `trmnlp lint` (TRMNL's best-practice checks) on plugin/src (LaraPaper, polling) and on
// every variant as scripts/build-variant.sh builds it (e.g. TRMNL.com: merge.liquid in front
// of the shared markup, its own settings). Every custom field gets a value, so the
// unused-field check covers them all. Fails on any finding not in LINT_ALLOWED.
function lint() {
  const repo = path.join(here, '..');
  const built = execFileSync('sh', [path.join(repo, 'scripts', 'build-variant.sh')], { encoding: 'utf8' });
  const projects = { larapaper: path.join(repo, 'plugin', 'src') };
  for (const [, name] of built.matchAll(/^wrote dist\/([^/]+)\/src /gm)) projects[name] = path.join(repo, 'dist', name, 'src');
  let ok = true;
  for (const [name, src] of Object.entries(projects)) {
    const fields = yaml.load(fs.readFileSync(path.join(src, 'settings.yml'), 'utf8')).custom_fields;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trmnlp-lint-'));
    fs.cpSync(src, path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.trmnlp.yml'), yaml.dump({
      watch: false,
      custom_fields: Object.fromEntries(fields.filter((field) => field.field_type !== 'author_bio')
        .map((field) => [field.keyname, String(field.default ?? 'x')])),
    }));
    const run = spawnSync('docker', ['run', '--rm', '--user', `${process.getuid()}:${process.getgid()}`,
      '--volume', `${dir}:/plugin`, IMAGE, 'lint'], { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '').trim();
    const findings = [...output.matchAll(/^ {2}\d+\. (.+)$/gm)].map((match) => match[1].trim());
    const unexpected = findings.filter((finding) => !LINT_ALLOWED.includes(finding));
    // A failed run without findings is trmnlp itself failing (settings, Docker, ...)
    if (unexpected.length || (run.status !== 0 && !findings.length)) {
      ok = false;
      console.log(`${name}: FAILED\n${output || run.error}`);
    } else {
      console.log(`${name}: ok${findings.length ? ` (allowed: ${findings.join(' ')})` : ''}`);
    }
  }
  return ok;
}
