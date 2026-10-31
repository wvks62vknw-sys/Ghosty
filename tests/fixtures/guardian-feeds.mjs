// Test only: the guardian's public sources in the preview brain (tests/preview-server.mjs), so no spec — and no hourly
// 'guard' job on CI's one shared preview — ever reads the live feeds. Quiet by default (nothing in force); the guardian
// spec switches a flood alert and a weather warning on and off (/__test/guardian?flood=1&weather=1), with times around
// now so they are in force whatever the day.
//   guardianFeeds(url) → a Response for a guardian source, else null.

export const guardMode = { flood: false, weather: false };

export function setGuardMode(params) {
  for (const k of ['flood', 'weather']) if (params.has(k)) guardMode[k] = params.get(k) === '1';
  return { ...guardMode };
}

const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
const parts = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(t).map((p) => [p.type, p.value]));
/** "2026-10-31T14:05:00" in UK time, as the Environment Agency writes it. */
const eaTime = (t) => {
  const p = parts(t);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
};
/** "1405 Sat 31 Oct" in UK time, as the Met Office writes it. */
const metTime = (t) => {
  const p = parts(t);
  const mon = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', month: 'short' }).format(t);
  return `${p.hour}${p.minute} ${p.weekday} ${Number(p.day)} ${mon}`;
};

function floods() {
  const items = guardMode.flood
    ? [{ '@id': 'http://environment.data.gov.uk/flood-monitoring/id/floods/034WAF412', description: 'River Cole at Kings Heath and Moseley', eaAreaName: 'West Midlands', floodArea: { county: 'Birmingham', notation: '034WAF412', riverOrSea: 'River Cole' }, floodAreaID: '034WAF412', isTidal: false, message: 'River levels are rising.', severity: 'Flood Alert', severityLevel: 3, timeMessageChanged: eaTime(Date.now() - 30 * 60_000), timeRaised: eaTime(Date.now() - 30 * 60_000), timeSeverityChanged: eaTime(Date.now() - 30 * 60_000) }]
    : [];
  return json({ meta: { publisher: 'Environment Agency' }, items });
}

function met() {
  const from = metTime(Date.now() - 60 * 60_000);
  const to = metTime(Date.now() + 8 * 60 * 60_000);
  const item = guardMode.weather
    ? `<item><title>Yellow warning of wind affecting West Midlands</title><link>https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings#?date=2026-10-31&amp;id=7a1c2b3d-1111-4c2e-9d0e-5f6a7b8c9d0e&amp;referrer=rss</link><description>Yellow warning of wind affecting West Midlands: Birmingham, Coventry, Dudley, Solihull valid from ${from} to ${to}</description><guid isPermaLink="false">7a1c2b3d-1111-4c2e-9d0e-5f6a7b8c9d0e</guid></item>`
    : '';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Met Office warnings for West Midlands</title>${item}</channel></rss>`, { headers: { 'content-type': 'application/rss+xml' } });
}

const month = (() => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 2);
  return d.toISOString().slice(0, 7);
})();
const crime = (category, street) => ({ category, month, location: { latitude: '52.443', longitude: '-1.892', street: { name: `On or near ${street}` } }, outcome_status: null });

export function guardianFeeds(u) {
  if (u.hostname === 'environment.data.gov.uk' && u.pathname.startsWith('/flood-monitoring/')) return floods();
  if (u.hostname === 'www.metoffice.gov.uk' && u.pathname.startsWith('/public/data/PWSCache/WarningsRSS/')) return met();
  if (u.hostname === 'api.postcodes.io' && u.pathname === '/postcodes' && u.searchParams.has('lat')) return json({ status: 200, result: [{ postcode: 'B13 8PX', country: 'England', region: 'West Midlands', admin_district: 'Birmingham', admin_county: null }] });
  if (u.hostname === 'data.police.uk' && u.pathname === '/api/crimes-street/all-crime' && u.searchParams.has('lat')) return json([crime('anti-social-behaviour', 'Alcester Road'), crime('anti-social-behaviour', 'Park Road'), crime('vehicle-crime', 'Oxford Road')]);
  return null;
}
