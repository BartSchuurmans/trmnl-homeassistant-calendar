// Random Home Assistant calendar payloads for stress-testing the layout.
//
//   node random-data.mjs <seed> <payload.json>
//
// Writes a payload in the shape LaraPaper stores (one calendar unwrapped, several as
// IDX_n) with 1–4 calendars and sparse to dense events around today, and prints
// matching settings as render.mjs arguments, one per line.
import fs from 'node:fs';

const [seedArg, out] = process.argv.slice(2);
if (!seedArg || !out) throw new Error('usage: node random-data.mjs <seed> <payload.json>');

let seed = Number(seedArg);
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (list) => list[Math.floor(rnd() * list.length)];

const titles = ['Standup', 'Dentist', 'Swimming lessons', 'Dinner with friends', 'Bin day', 'Offsite',
  'Concert', 'Parent-teacher meeting', 'Yoga', 'Very long event title that never seems to end'];
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

const calendarCount = 1 + Math.floor(rnd() * 4);
const density = pick([0.3, 1, 2.5]);
const calendars = [];
for (let c = 0; c < calendarCount; c++) {
  const events = [];
  for (let d = -7; d < 43; d++) {
    for (let k = Math.floor(rnd() * density * 2); k > 0; k--) {
      if (rnd() < 0.25) {
        const days = 1 + Math.floor(rnd() * 4);
        events.push({ start: { date: day(d) }, end: { date: day(d + days) }, summary: pick(titles) });
      } else {
        const hour = 7 + Math.floor(rnd() * 13);
        const minute = pick(['00', '15', '30', '45']);
        events.push({
          start: { dateTime: `${day(d)}T${pad(hour)}:${minute}:00+02:00` },
          end: { dateTime: `${day(d)}T${pad(hour + 1)}:${minute}:00+02:00` },
          summary: pick(titles),
        });
      }
    }
  }
  calendars.push({ data: events });
}

const payload = calendarCount === 1 ? calendars[0] : Object.fromEntries(calendars.map((c, i) => [`IDX_${i}`, c]));
fs.writeFileSync(out, JSON.stringify(payload));

const colors = Array.from({ length: calendarCount }, () => pick(['-', 'black', 'gray-40', 'gray-65', 'gray-75', 'blue-40', '#cc3333', 'white']));
const settings = {
  calendars: Array.from({ length: calendarCount }, (_, i) => `calendar.c${i}`).join(','),
  calendar_colors: colors.join(','),
  display_event_end: pick(['yes', 'no']),
  show_week_numbers: pick(['yes', 'no']),
  month_header: pick(['yes', 'no']),
  rolling_advancement: pick(['week', 'day']),
};
for (const [key, value] of Object.entries(settings)) console.log(`--set\n${key}=${value}`);
