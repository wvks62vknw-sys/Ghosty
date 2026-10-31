// THE MACHINE VIEW on the owner's phone (440 × 956; OWNER-ISSUES 61c), a mode of God's Eye, every feed stood in (never the
// internet: aircraft through the proxy, buses and trams, ships, motorway incidents; the guardian's flood alert from the
// preview's stand-in):
//  1. from the bar's MACHINE VIEW (first in the bar): the camera frames his saved home (within 2 km, about 14 km out, 50°),
//     the mode's own layers are on and the clutter off, ghosty.eye.layers is untouched; HOME in its box, the three aircraft
//     nearest home tagged ("BAW101 · 2,400 FT · A320"), the nearest bus in cyan ("LINE 50 · TOWARDS DRUIDS HEATH");
//  2. the count line's numbers are the fixture's within 25 km (the far ones left out), satellites above 10° as the sky has
//     them, "No ships feed here." (no AIS key), and the hub card's reading "WATCHING · N AIR · M TRANSIT" (the quick
//     switcher shows it while the mode is on);
//  3. the view is never still: the heading drifts; a touch pauses it; a ZOOM from the target card stops it;
//  4. a flood alert near home: HOME · FLOOD ALERT with the amber ring, and the line says it;
//  5. LEAVE puts back exactly the layers and the camera he had;
//  6. from the chat with no model: "machine view" opens it with the line as the answer; "what are you watching?" answers
//     with the line; neither goes to /api/chat; #eye?machine lands in the mode, as a notification would; the SEE hub's God's
//     Eye card has the status line MACHINE VIEW, whose tap opens it;
//  7. with no saved home: the phone's home, said honestly on the view;
//  then everything is put back for the specs after it on the same brain.
//   BASE=http://localhost:8788 node tests/machine.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

// his home: B13 8PX, Moseley (as the guardian spec saves it)
const HOME = { lat: 52.443186, lon: -1.892525 };
const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
// aircraft: four within 25 km of home, two well outside (slow, so nothing crosses the line between two looks)
const ac = (hex, flight, lat, lon, alt, t = 'A320') => ({ hex, flight: `${flight} `, r: `G-${hex.slice(0, 4).toUpperCase()}`, t, lat, lon, alt_baro: alt, gs: 60, track: 90, seen_pos: 0 });
const AIRCRAFT = [ac('400a01', 'BAW101', 52.45, -1.88, 2400), ac('400a02', 'EZY202', 52.43, -1.91, 3100, 'A319'), ac('400a03', 'RYR303', 52.47, -1.87, 5200, 'B738'), ac('400a04', 'TOM404', 52.36, -1.75, 9800, 'B788'), ac('400a05', 'KLM505', 52.85, -1.40, 21000, 'E190'), ac('400a06', 'DLH606', 52.10, -2.50, 30000)];
const now = Date.now();
const VEHICLES = {
  vehicles: [
    { id: 'b50', kind: 'bus', line: '50', dest: 'Druids Heath', operator: 'NXWM', lat: 52.4455, lon: -1.8905, bearing: 180, speedMs: 0, t: now, delayS: 0, src: 'bustimes.org' },
    { id: 'b11', kind: 'bus', line: '11A', dest: 'Outer Circle', operator: 'NXWM', lat: 52.481, lon: -1.902, bearing: 90, speedMs: 0, t: now, delayS: 0, src: 'bustimes.org' },
    { id: 't1', kind: 'tram', line: 'MM1', dest: 'Wolverhampton', operator: 'WM Metro', lat: 52.4835, lon: -1.9005, bearing: 300, speedMs: 0, t: now, delayS: 0, src: 'bustimes.org' },
    { id: 'far', kind: 'bus', line: '1', dest: 'Stafford', operator: 'Chaserider', lat: 52.806, lon: -2.117, bearing: 0, speedMs: 0, t: now, delayS: 0, src: 'bustimes.org' },
  ],
  src: 'bustimes.org', credit: 'bustimes.org', note: '', at: now,
};
const EVENTS = { events: [
  { id: 'e1', road: 'M6', direction: 'S', title: 'M6 southbound between J6 and J5', reason: 'Congestion', delayS: 600, lanesClosed: '0|0|0', lat: 52.509, lon: -1.838, normalBy: '' },
  { id: 'e2', road: 'M54', direction: 'W', title: 'M54 westbound between J3 and J4', reason: 'Broken down vehicle', delayS: 120, lanesClosed: '1|0', lat: 52.66, lon: -2.28, normalBy: '' },
], at: now, credit: 'National Highways' };
const want = {
  air: AIRCRAFT.filter((a) => km(HOME, a) <= 25).length,
  transit: VEHICLES.vehicles.filter((v) => km(HOME, v) <= 25).length,
  incidents: EVENTS.events.filter((e) => km(HOME, e) <= 25).length,
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block' });
const json = (route, body) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
await ctx.route('**/api/proxy?**', (route) => {
  const target = new URL(route.request().url()).searchParams.get('url') ?? '';
  if (/api\.adsb\.lol\/v2\/point\//.test(target)) return json(route, { ac: AIRCRAFT, now: Date.now() });
  return route.fulfill({ status: 404, body: '' }); // every other feed: nothing (never the real internet)
});
await ctx.route('**/api/transit?**', (route) => json(route, VEHICLES));
await ctx.route('**/api/ships?**', (route) => json(route, { ships: [], note: 'Add a free AISstream key in the System tab to see ships everywhere (Baltic ships work without one).' }));
await ctx.route('**/api/highways/events?**', (route) => json(route, EVENTS));
await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
const chats = [];
await ctx.route('**/api/chat', (route) => {
  if (route.request().method() === 'POST') chats.push(route.request().postData() ?? '');
  return route.continue();
});

const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
const api = (path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const M = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.machine ?? null)));
const cam = () => page.evaluate(() => { const c = window.__ghosty.globe.cam; return { lat: c.lat, lon: c.lon, range: c.range, hd: c.hd, tilt: c.tilt, fly: !!c.fly }; });
const vis = () => page.evaluate(() => ({ ...window.__ghosty.globe.vis }));
const kept = () => page.evaluate(() => localStorage.getItem('ghosty.eye.layers'));
const target = () => page.evaluate(() => ({ ...window.__ghosty.globe.cam.target }));
// Software WebGL in the test browser draws a frame every few seconds: a flight the spec is not about is finished at once
// (its end is set; the next frame lands it exactly where it was going).
const land = async () => {
  await page.evaluate(() => { const f = window.__ghosty.globe.cam.fly; if (f) f.t = 1; });
  await until(() => !window.__ghosty.globe.cam.fly, null, 60000, 'a flight never landed');
};
const frames = 20000;

// his home, as Memory → ME → PLACES keeps it; the guardian quiet; nothing told yet
const had = (await api('/profile/places')).places ?? [];
await api('/profile/places', { method: 'POST', body: JSON.stringify({ found: { id: 'home', label: 'Home', query: 'B13 8PX', address: 'B13 8PX, Moseley, Birmingham', lat: HOME.lat, lon: HOME.lon } }) });
await fetch(`${base}/__test/guardian?flood=0&weather=0&reset=1`);
await api('/guardian/check', { method: 'POST', body: '{}' });

// God's Eye as he left it: over London from high up (no automatic tilt there), buoys on and quakes off, cameras and radar on as
// they are by default (what LEAVE must give back)
await page.evaluate(() => (location.hash = 'eye'));
await page.waitForSelector('#pg-eye .eyebot .btns .machinebtn', { timeout: 15000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const c = window.__ghosty.globe.cam;
  c.fly = null;
  c.follow = null;
  Object.assign(c, { lat: 51.5, lon: -0.12, range: 4000, tilt: 0, hd: 10 });
  c.target = { lat: 51.5, lon: -0.12, range: 4000, tilt: 0, hd: 10 };
});
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'buoys', on: true }));
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'quakes', on: false }));
// (his choices are kept by the globe's once-a-second loop: wait for it to have kept these)
await page.waitForFunction(() => /"buoys":true/.test(localStorage.getItem('ghosty.eye.layers') ?? '') && /"quakes":false/.test(localStorage.getItem('ghosty.eye.layers') ?? ''), null, { timeout: 30000 }).catch(() => problems.push('the layers he chose were never kept'));
const beforeVis = await vis();
const beforeKept = await kept();
const beforeCam = await cam();

// ---- 1. MACHINE VIEW from the bar: first in the bar, his home framed, the mode's layers
const first = await page.$eval('#pg-eye .eyebot .btns', (b) => b.firstElementChild?.textContent?.trim() ?? '');
check(first === 'MACHINE VIEW', `the first thing in the bar is "${first}"`);
const t0 = Date.now();
await page.click('#pg-eye .eyebot .btns .machinebtn');
await until(() => window.__ghosty.machine?.on && window.__ghosty.machine.ready, null, 10000, 'the Machine view did not come on');
console.log(`the Machine view's first line came ${Date.now() - t0} ms after MACHINE VIEW`);
// where the camera is going (set the moment the mode starts): his home, about 14 km out, 50°
const goal = await target();
check(km(HOME, goal) < 2 && Math.abs(goal.range - 14) < 2 && Math.abs(goal.tilt - 50) < 1, `the camera is not going to his home: ${JSON.stringify(goal)}`);
await land();
let c = await cam();
check(km(HOME, c) < 2, `the camera did not land on his home: ${JSON.stringify(c)}`);
await page.waitForFunction(() => document.querySelectorAll('#pg-eye .mchboxes .mchbox:not([hidden])').length >= 3, null, { timeout: frames }).catch(() => undefined);
const v = await vis();
const ON = ['air', 'transit', 'ships', 'sats', 'incidents', 'me', 'spot', 'cities', 'coast', 'borders'];
const OFF = ['cams', 'crime', 'enforce', 'radar', 'imagery', 'orbits'];
check(ON.every((k) => v[k]) && OFF.every((k) => !v[k]), `the mode's layers: on ${ON.filter((k) => !v[k]).join(',') || 'all'} missing; off ${OFF.filter((k) => v[k]).join(',') || 'all'} still on`);
await page.waitForTimeout(2600);
check((await kept()) === beforeKept, `ghosty.eye.layers changed in the mode: ${await kept()}`);
let m = await M();
check(m.centre?.saved === true && m.centre.label === 'Home', `the centre: ${JSON.stringify(m.centre)}`);
check(m.places.some((p) => p.tag === 'HOME'), `HOME is not in a box: ${JSON.stringify(m.places)}`);
check(m.aircraft.length === 3 && m.aircraft[0] === 'BAW101 · 2,400 FT · A320' && m.aircraft.includes('EZY202 · 3,100 FT · A319') && m.aircraft.includes('RYR303 · 5,200 FT · B738'), `the tagged aircraft: ${JSON.stringify(m.aircraft)}`);
check(m.transit === 'LINE 50 · TOWARDS DRUIDS HEATH', `the tagged bus: ${m.transit}`);
const boxes = await page.$$eval('#pg-eye .mchboxes .mchbox:not([hidden])', (bs) => bs.map((b) => ({ kind: b.dataset.kind, tag: b.querySelector('.mchlab')?.textContent, border: getComputedStyle(b).borderTopColor, w: getComputedStyle(b).borderTopWidth, radius: getComputedStyle(b).borderTopLeftRadius, font: getComputedStyle(b.querySelector('.mchlab')).fontSize })));
const homeBox = boxes.find((b) => b.tag === 'HOME');
// (a 1.5 px line: on the test's 1× screen the browser draws it as 1 px)
check(!!homeBox && homeBox.border === 'rgb(255, 255, 255)' && ['1px', '1.5px'].includes(homeBox.w) && homeBox.radius === '0px' && homeBox.font === '11px', `the HOME box: ${JSON.stringify(homeBox)}`);
check(boxes.some((b) => b.kind === 'air' && b.tag === 'BAW101 · 2,400 FT · A320'), `no aircraft box on screen: ${JSON.stringify(boxes)}`);
const bus = boxes.find((b) => b.kind === 'transit');
check(bus?.border === 'rgb(92, 225, 255)', `the bus box is not cyan: ${JSON.stringify(bus)}`);
await page.screenshot({ path: `${out}/machine-home.png` });

// ---- 2. the count line: the fixture's numbers within 25 km, the sky's satellites, no ships feed; the hub's reading
m = await M();
const sky = await page.evaluate(([lat, lon]) => {
  // the sky over the frame's centre, worked out here on its own: satellites above 10°
  const layer = window.__ghosty.globe.layers.find((l) => l.id === 'sats');
  const r = Math.PI / 180;
  const up = [Math.cos(lat * r) * Math.cos(lon * r), Math.cos(lat * r) * Math.sin(lon * r), Math.sin(lat * r)];
  return layer.list.filter((s) => {
    const d = [s.w[0] - up[0] * 6371, s.w[1] - up[1] * 6371, s.w[2] - up[2] * 6371];
    return (Math.asin((d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / Math.hypot(...d)) * 180) / Math.PI > 10;
  }).length;
}, [c.lat, c.lon]);
check(m.counts.air === want.air && m.counts.transit === want.transit && m.counts.incidents === want.incidents && m.counts.ships === null, `the counts: ${JSON.stringify(m.counts)} (want ${JSON.stringify(want)}, no ships feed)`);
check(Math.abs(m.counts.sats - sky) <= 2, `satellites overhead: ${m.counts.sats}, the sky has ${sky}`);
const line = await page.textContent('#pg-eye .mchview .mchline');
const wantLine = new RegExp(`^Watching Birmingham\\. ${want.air} aircraft, ${want.transit} buses and trams, \\d+ satellites? overhead; ${want.incidents} road incidents?\\. Nothing active near Home\\. No ships feed here\\.`);
check(wantLine.test(line ?? ''), `the line: "${line}"`);
check(line === m.line, 'the line on screen is not the one in the state');
check((await page.getAttribute('#pg-eye .mchview .mchline', 'aria-live')) === 'polite', 'the line is not read out politely as it changes');
check(m.hub === `WATCHING · ${want.air} AIR · ${want.transit} TRANSIT`, `the hub's reading: ${m.hub}`);

// ---- 3. never still: the heading drifts (a touch pauses it and a flight he asks for stops it, below)
const h0 = (await target()).hd;
const drifted = await page.waitForFunction((h) => window.__ghosty.globe.cam.target.hd > h + 1, h0, { timeout: 40000 }).then(() => true, () => false);
check(drifted && (await M()).drift === 'on', `the view did not drift (heading ${h0.toFixed(1)} → ${(await target()).hd.toFixed(1)}, ${(await M()).drift})`);

// the quick switcher (a long press on SEE, the mode still on) shows the Eye card's reading
const see = await page.locator('#dock .tabcap button[data-area="see"]').boundingBox();
await page.mouse.move(see.x + see.width / 2, see.y + see.height / 2);
await page.mouse.down();
await until(() => document.getElementById('switcher')?.classList.contains('in'), null, 10000, 'a long press on SEE did not open the switcher');
const reading = await page.$eval('#switcher .switem[data-id="eye"] .swrd', (e) => e.textContent).catch(() => '');
check(reading === m.hub, `the switcher's God's Eye reads "${reading}" (want "${m.hub}")`);
await page.mouse.move(220, 300, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(500);
check((await page.evaluate(() => document.body.dataset.tab)) === 'eye' && (await M()).on, 'the long press took him out of the Machine view');

// a touch pauses the drift; a tap opens the target card; ZOOM (or FOLLOW, on an aircraft) stops it until LEAVE
const spot = await page.evaluate(() => ({ x: 70, y: Math.round((document.querySelector('#pg-eye .eyetop').getBoundingClientRect().bottom + document.querySelector('#pg-eye .eyebot').getBoundingClientRect().top) / 2) }));
await page.mouse.click(spot.x, spot.y);
await until(() => window.__ghosty.machine.drift === 'paused', null, frames, 'a touch did not pause the drift');
const card = await page.waitForSelector('#pg-eye .eyeinfo:not([hidden])', { timeout: 5000 }).then(() => true, () => false);
check(card, 'a tap did not open the target card');
const go = page.locator('#pg-eye .eyeinfo button', { hasText: /^(ZOOM|FOLLOW)$/ }).first();
if (await go.count()) {
  await go.click();
  await until(() => window.__ghosty.machine.drift === 'stopped', null, frames, 'ZOOM did not stop the drift');
} else problems.push(`the tapped card has no ZOOM: ${await page.textContent('#pg-eye .eyeinfo').catch(() => '')}`);
await land();
const hz = (await target()).hd;
await page.waitForTimeout(6000);
check(Math.abs((await target()).hd - hz) < 0.01 && (await M()).on, 'after ZOOM the view still drifts, or the mode ended');

// ---- 4. a flood alert near home: HOME · FLOOD ALERT with its amber ring; the line says it
await fetch(`${base}/__test/guardian?flood=1`);
await api('/guardian/check', { method: 'POST', body: '{}' });
await page.evaluate(() => window.__ghosty.guardian?.load?.());
await until(() => (window.__ghosty.machine.places ?? []).some((p) => p.tag === 'HOME · FLOOD ALERT'), null, frames, `no warning on HOME: ${JSON.stringify((await M()).places)}`);
m = await M();
check(/A flood alert is active near Home \(Environment Agency, since \d\d:\d\d\)\./.test(m.line) && !/Nothing active near Home/.test(m.line), `the line with the warning: ${m.line}`);
await page.evaluate(() => {
  const c = window.__ghosty.globe.cam;
  c.fly = null;
  c.target = { ...c.target, lat: 52.443186, lon: -1.892525, range: 14, tilt: 50 };
});
await page.waitForFunction(() => [...document.querySelectorAll('#pg-eye .mchboxes .mchbox.warn:not([hidden])')].length > 0, null, { timeout: frames }).catch(() => undefined);
const ring = await page.$$eval('#pg-eye .mchboxes .mchbox.warn:not([hidden])', (bs) => bs.map((b) => ({ tag: b.querySelector('.mchlab')?.textContent, ring: getComputedStyle(b.querySelector('.mchring')).borderTopColor, anim: getComputedStyle(b.querySelector('.mchring')).animationDuration })));
check(ring.some((r) => r.tag === 'HOME · FLOOD ALERT' && r.ring === 'rgb(255, 179, 64)' && r.anim === '1s'), `the amber ring: ${JSON.stringify(ring)}`);
await page.screenshot({ path: `${out}/machine-flood.png` });
await fetch(`${base}/__test/guardian?flood=0`);
await api('/guardian/check', { method: 'POST', body: '{}' });

// ---- 5. LEAVE: exactly the layers and the camera he had
await page.click('#pg-eye .eyebot .btns .machinebtn');
const back = await target();
check(Math.abs(back.lat - beforeCam.lat) < 1e-6 && Math.abs(back.lon - beforeCam.lon) < 1e-6 && Math.abs(back.range - beforeCam.range) < 1e-6 && Math.abs(back.tilt - beforeCam.tilt) < 1e-6, `LEAVE is not going back to where he was: ${JSON.stringify(back)}`);
await land();
const afterVis = await vis();
const changed = Object.keys(beforeVis).filter((k) => beforeVis[k] !== afterVis[k]);
check(!changed.length, `LEAVE did not put the layers back: ${changed.join(', ')}`);
c = await cam();
const turn = (((c.hd - beforeCam.hd) % 360) + 540) % 360 - 180;
check(Math.abs(c.lat - beforeCam.lat) < 1e-6 && Math.abs(c.lon - beforeCam.lon) < 1e-6 && Math.abs(c.range - beforeCam.range) < 1e-6 && Math.abs(c.tilt - beforeCam.tilt) < 1e-6 && Math.abs(turn) < 1e-6, `LEAVE did not put the camera back: ${JSON.stringify(c)} (was ${JSON.stringify(beforeCam)})`);
check((await kept()) === beforeKept, 'his layer choices changed');
check(!(await M()).on && (await page.$eval('#pg-eye .mchview', (e) => e.hidden)), 'the mode is still showing');

// ---- 6. from the chat, no model: "machine view", then "what are you watching?"; and the address a notification uses
const before = chats.length;
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
await page.fill('#cin', 'machine view');
await page.keyboard.press('Enter');
await until(() => document.body.dataset.tab === 'eye' && window.__ghosty.machine?.on && window.__ghosty.machine.ready, null, 15000, '"machine view" did not open the Machine view');
const replies = () => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((x) => x.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((x) => /Watching Birmingham\./.test(x.textContent ?? '')), null, 8000, `"machine view" was not answered with the line: ${JSON.stringify((await replies()).slice(-2))}`);
await page.evaluate(() => window.__ghosty.send('what are you watching?'));
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].filter((x) => /Watching Birmingham\./.test(x.textContent ?? '')).length >= 2, null, 8000, `"what are you watching?" was not answered with the line: ${JSON.stringify((await replies()).slice(-2))}`);
await page.waitForTimeout(400);
check(chats.length === before, `the Machine view's words went to the brain's chat ${chats.length - before} time(s)`);
await page.screenshot({ path: `${out}/machine-chat.png` });
await page.evaluate(() => (location.hash = 'core'));
await until(() => !window.__ghosty.machine.on, null, 5000, 'leaving God\'s Eye did not end the mode');
await page.evaluate(() => (location.hash = 'eye?machine'));
await until(() => document.body.dataset.tab === 'eye' && window.__ghosty.machine?.on, null, 10000, '#eye?machine did not land in the Machine view');
await page.click('#pg-eye .eyebot .btns .machinebtn');
await land();
// the SEE hub: God's Eye's card has the status line MACHINE VIEW; a tap on it opens the mode (a tap elsewhere opens the globe)
await page.evaluate(() => (location.hash = 'area-see'));
const hline = '#pg-area-see .hubtile[data-id="eye"] .hline';
await page.waitForSelector(hline, { state: 'visible', timeout: 10000 }).catch(() => problems.push('the Eye card has no status line'));
const hl = await page.$eval(hline, (e) => ({ t: e.textContent, h: e.getBoundingClientRect().height })).catch(() => null);
check(hl?.t === 'MACHINE VIEW' && hl.h >= 44, `the Eye card's status line: ${JSON.stringify(hl)}`);
await page.click(hline);
await until(() => document.body.dataset.tab === 'eye' && window.__ghosty.machine?.on, null, 10000, 'the status line did not open the Machine view');
await page.click('#pg-eye .eyebot .btns .machinebtn');
await land();

// ---- 7. no saved home: the phone's home, said honestly
if (!had.some((p) => p.id === 'home')) {
  await api('/profile/places?id=home', { method: 'DELETE' });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(300);
  await page.evaluate(() => (location.hash = 'eye'));
  await page.waitForTimeout(1500);
  await page.click('#pg-eye .eyebot .btns .machinebtn');
  await until(() => window.__ghosty.machine?.on && window.__ghosty.machine.ready, null, 10000, 'the Machine view did not come on without a saved home');
  m = await M();
  check(m.centre?.saved === false, `with no saved home the centre is ${JSON.stringify(m.centre)}`);
  const note = await page.textContent('#pg-eye .mchview .mchnote');
  check(note === "Save home in Memory → ME → PLACES and I'll watch your city; for now this is the phone's home.", `the honest line: "${note}"`);
  await page.screenshot({ path: `${out}/machine-nohome.png` });
  await page.click('#pg-eye .eyebot .btns .machinebtn');
  await land();
}
for (const r of await page.evaluate(() => [...document.querySelectorAll('#pg-eye :is(button, .mchview)')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().right))) if (r > PHONE.width + 1) problems.push(`something sticks out sideways (${Math.round(r)} px)`);

// ---- put back what this spec changed, for the specs after it on the same brain
await page.evaluate((v) => (v === null ? localStorage.removeItem('ghosty.eye.layers') : localStorage.setItem('ghosty.eye.layers', v)), beforeKept);
await fetch(`${base}/__test/guardian?flood=0&weather=0&reset=1`);
if (had.some((p) => p.id === 'home')) await api('/profile/places', { method: 'POST', body: JSON.stringify({ found: had.find((p) => p.id === 'home') }) });
else await api('/profile/places?id=home', { method: 'DELETE' });
await api('/inbox/read', { method: 'POST', body: JSON.stringify({ ids: 'all' }) });

await browser.close();
if (problems.length) {
  console.error(`FAIL machine:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: THE MACHINE VIEW — MACHINE VIEW first in the bar; his home framed at 14 km and 50°, the mode's layers on and his own kept apart; HOME boxed white, the three nearest aircraft tagged, the nearest bus in cyan; the line's numbers the fixture's within 25 km (${want.air} aircraft, ${want.transit} buses and trams, ${want.incidents} road incident), the sky's satellites, no ships feed said; the switcher's reading WATCHING; the drift, paused by a touch, stopped by ZOOM; HOME · FLOOD ALERT with its amber ring and the line saying it; LEAVE gave back the layers and the camera exactly; "machine view" and "what are you watching?" answered with the line and no model; #eye?machine lands in it; no saved home said honestly.`);
