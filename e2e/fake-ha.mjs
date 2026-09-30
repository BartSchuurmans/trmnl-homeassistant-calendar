// Fake Home Assistant for the end-to-end test: serves /api/calendars/<entity> like HA
// does (date-only start/end, bearer token, timed events with an offset) and records
// every request. The events are placed around today so they land in the rolling month.
import http from 'node:http';

export const TOKEN = 'e2e-token';
// what the app's calendar proxy adds (SUPERVISOR_TOKEN in app.yml)
export const SUPERVISOR_TOKEN = 'e2e-supervisor-token';

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function events(entity) {
  const list = [];
  if (entity === 'calendar.family') {
    // two timed events on every day of the window
    for (let d = -7; d < 43; d++) {
      list.push({ start: { dateTime: `${day(d)}T08:30:00+02:00` }, end: { dateTime: `${day(d)}T09:15:00+02:00` }, summary: 'School run' });
      list.push({ start: { dateTime: `${day(d)}T18:00:00+02:00` }, end: { dateTime: `${day(d)}T19:00:00+02:00` }, summary: 'Dinner with friends' });
    }
  } else if (entity === 'calendar.work') {
    // a multi-day all-day event every week
    for (let d = -7; d < 43; d += 7) {
      list.push({ start: { date: day(d) }, end: { date: day(d + 3) }, summary: 'Conference' });
    }
  } else if (entity !== 'calendar.empty') {
    return null;
  }
  return list.map((e, i) => ({ ...e, description: '', location: '', uid: `${entity}-${i}` }));
}

export function startFakeHa(port = 8123) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://ha');
    const match = url.pathname.match(/^\/api\/calendars\/([\w.]+)$/);
    const entity = match?.[1];
    requests.push({ entity, path: url.pathname, start: url.searchParams.get('start'),
      end: url.searchParams.get('end'), authorization: req.headers.authorization });
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (![TOKEN, SUPERVISOR_TOKEN].some((t) => req.headers.authorization === `Bearer ${t}`)) {
      return send(401, { message: 'Unauthorized' });
    }
    const list = entity && events(entity);
    if (!list) return send(404, { message: 'Entity not found' });
    send(200, list);
  });
  return new Promise((resolve) => server.listen(port, '0.0.0.0', () => resolve({ server, requests })));
}
