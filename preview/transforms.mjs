// Checks the TRMNL.com variants' serverless functions (plugin/<variant>/transform.js)
// against the fake Home Assistant of the end-to-end test (e2e/fake-ha.mjs), run the way
// TRMNL.com and trmnlp run them: a Node process with the payload on stdin, the file's
// code, then run(input), awaited.
//
//   node transforms.mjs [out.json]    out.json: the weather case's output, for
//                                     render.mjs --data (ci.sh renders it)
//
// The payload is what TRMNL.com hands over after polling: several calendars as IDX_0,
// IDX_1, ... (each a list wrapped as { data: [...] }, seen on TRMNL.com 2026-10-03), one
// as `data`, and `trmnl` with the custom fields.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startFakeHa, TOKEN, FORECAST_DAYS } from '../e2e/fake-ha.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, '..', 'plugin', 'trmnl-com-polling', 'transform.js'), 'utf8');
const [outFile] = process.argv.slice(2);

// as trmnlp's Node wrapper (lib/trmnlp/transform_backend/wrapper.rb) and TRMNL.com do it
// (async: the fake Home Assistant answers from this process)
function runTransform(input) {
  const script = `const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));\n${code}\n`
    + 'Promise.resolve(run(input)).then((o) => process.stdout.write(JSON.stringify(o)));\n';
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { timeout: 10000 });
    let stdout = '', stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (status) => (status === 0 ? resolve({ output: JSON.parse(stdout), ms: Date.now() - started })
      : reject(new Error(`transform.js failed: ${stderr}`))));
    child.stdin.end(JSON.stringify(input));
  });
}

const failures = [];
const expect = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failures.push(name);
};

const { server, requests } = await startFakeHa(0);
const haUrl = `http://127.0.0.1:${server.address().port}`;
try {
  const poll = async (entity) => (await fetch(`${haUrl}/api/calendars/${entity}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const familyList = await poll('calendar.family');
  const family = { data: familyList };
  const work = { data: await poll('calendar.work') };
  const trmnl = (fields) => ({ plugin_settings: { custom_fields_values: { ha_url: `${haUrl}/`, ha_token: TOKEN, calendars: 'calendar.family,calendar.work', ...fields } } });

  // no weather entity: the payload as it came
  const plain = { IDX_0: family, IDX_1: work, trmnl: trmnl({}) };
  const { trmnl: _, ...plainData } = plain;
  expect('without a weather entity, only trmnl goes', JSON.stringify((await runTransform(plain)).output) === JSON.stringify(plainData), 'payload changed');
  expect('without a weather entity, no request', !requests.some((r) => r.weather), JSON.stringify(requests));

  // two calendars and the forecast, last
  const { output, ms } = await runTransform({ IDX_0: family, IDX_1: work, trmnl: trmnl({ weather_entity: ' weather.forecast_home ' }) });
  const forecast = output.IDX_2?.service_response?.['weather.forecast_home']?.forecast;
  expect('forecast goes last', Array.isArray(forecast) && forecast.length === FORECAST_DAYS, JSON.stringify(output.IDX_2));
  expect('calendars stay where they were', JSON.stringify([output.IDX_0, output.IDX_1]) === JSON.stringify([family, work]), 'calendars changed');
  // TRMNL.com adds trmnl back; returned, the token would show in the Debug Logs
  expect('trmnl (and the token) left out', !('trmnl' in output), 'trmnl returned');
  const call = requests.find((r) => r.weather);
  expect('the call is weather.get_forecasts, daily, with the token', call && call.method === 'POST' && call.query === '?return_response'
    && call.type === 'daily' && call.authorization === `Bearer ${TOKEN}`, JSON.stringify(call));
  expect('well within 5 s', ms < 2000, `${ms} ms`);
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(output));

  // one calendar arrives as `data`; with the forecast they become IDX_0 and IDX_1
  const one = (await runTransform({ data: familyList, trmnl: trmnl({ weather_entity: 'weather.forecast_home' }) })).output;
  expect('one calendar becomes IDX_0, the forecast IDX_1', JSON.stringify(one.IDX_0) === JSON.stringify(familyList)
    && one.IDX_1?.service_response && !('data' in one), JSON.stringify(Object.keys(one)));

  // Home Assistant's error, or none at all: the calendars stay, the error goes last
  const unknown = (await runTransform({ IDX_0: family, IDX_1: work, trmnl: trmnl({ weather_entity: 'weather.nowhere' }) })).output;
  expect('a failed call goes last as { message }', typeof unknown.IDX_2?.message === 'string' && unknown.IDX_0, JSON.stringify(unknown.IDX_2));
  const down = (await runTransform({ IDX_0: family, trmnl: { plugin_settings: { custom_fields_values: { ha_url: 'http://127.0.0.1:9', ha_token: TOKEN, weather_entity: 'weather.forecast_home' } } } })).output;
  expect('an unreachable Home Assistant goes last as { message }', typeof down.IDX_1?.message === 'string', JSON.stringify(down.IDX_1));
} finally {
  server.close();
}

if (failures.length) process.exit(1);
