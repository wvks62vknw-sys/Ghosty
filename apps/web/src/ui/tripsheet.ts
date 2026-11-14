/**
 * TRIP MODE (NEXT ROUND, see.c1): an appointment to the whole journey, in one tap. From an event in AGENDA (GETTING THERE), or by
 * words ("how do I get to my next appointment?", "trip mode"), one sheet says:
 *   - when to leave: a public transport journey that arrives in time (the journey planner, arriving five minutes early);
 *   - the weather there when he arrives (Open-Meteo, free and keyless, asked about the destination, never about him);
 *   - road reports along the route (National Highways, the West Midlands motorways) and the public cameras along it, each with a
 *     fresh still, a tap opening it live on God's Eye.
 * Where he starts from is the journey planner's own rule: "Here" goes as the square kilometre around him, never the point, so the
 * brain never gets live GPS. With no signal it says so, and offers the journey kept on this phone.
 */
import { brain } from '../api/brain';
import { fetchImage, fetchJson } from '../api/feed';
import { h } from '../core/dom';
import { cams, loadCameras, nearestCameras, type Camera } from '../data/cameras';
import { incidents, severity, delayWords, INCIDENT_CREDIT, type Incident } from '../data/incidents';
import { changesText, hhmm, legPath, mins, type JourneyAnswer } from '../data/journey';
import { temp, WMO } from '../data/weather';
import type { AgendaEventInfo } from '../../../../packages/shared/src/protocol';
import { button, modal } from './components';
import { sayError } from './hisWords';
import { keptJourney, openJourneyPlanner, placeArg, showJourney } from './journeysheet';
import * as W from './tripwords';

export type TripEvent = Pick<AgendaEventInfo, 'title' | 'start'> & { location?: string; end?: number };

/** What the sheet found, for the specs (window.__ghosty.trip) and the chat's answer. */
export const tripState = { open: false, state: '' as '' | 'loading' | 'ready' | 'none' | 'offline' | 'noplace', leave: '', weather: '', roads: '', cams: 0, title: '' };

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const localIso = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const hm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371;
};
const inWestMidlands = (p: { lat: number; lon: number }) => p.lat > 52.2 && p.lat < 52.8 && p.lon > -2.5 && p.lon < -1.2;
/** Points along the route about every kilometre (a long path is thinned; a short one keeps its ends). */
function along(path: { lat: number; lon: number }[]): { lat: number; lon: number }[] {
  const out: { lat: number; lon: number }[] = [];
  for (const p of path) if (!out.length || km(out[out.length - 1]!, p) >= 1) out.push(p);
  const end = path[path.length - 1];
  if (end && out[out.length - 1] !== end) out.push(end);
  return out.slice(0, 400);
}

/** The next appointment with a place in it (AGENDA's next two weeks), or null. */
export async function nextTripEvent(): Promise<TripEvent | null> {
  const a = await brain.agenda(14);
  const now = Date.now();
  return a.events.filter((e) => !e.allDay && e.start > now && !!e.location?.trim()).sort((x, y) => x.start - y.start)[0] ?? null;
}

let sheet: { close(): void } | null = null;

/** Open TRIP MODE on an appointment. */
export function openTrip(e: TripEvent): void {
  sheet?.close();
  Object.assign(tripState, { open: true, state: 'loading', leave: '', weather: '', roads: '', cams: 0, title: e.title });
  // (what the sheet found, for the specs: window.__ghosty.trip, as the Lens and the Machine view give theirs)
  const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (g) g.trip = tripState;
  const head = h('div.triphead', h('b', e.title), h('span', `${new Date(e.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${hm(e.start)} · ${W.tripIn(e.start - Date.now())}`), e.location ? h('span.tripwhere', e.location) : null);
  const leave = h('div.tripsec', { dataset: { sec: 'leave' } }, h('div.lab', 'WHEN TO LEAVE'), h('p.note', { dataset: { state: 'loading', case: 'keep' } }, W.TRIP_PLANNING));
  const sky = h('div.tripsec', { dataset: { sec: 'weather' } }, h('div.lab', 'WEATHER WHEN YOU ARRIVE'));
  const roads = h('div.tripsec', { dataset: { sec: 'roads' } }, h('div.lab', 'ROAD REPORTS ALONG THE WAY'));
  const camsSec = h('div.tripsec', { dataset: { sec: 'cams' } }, h('div.lab', 'CAMERAS ALONG THE WAY'));
  const acts = h('div.row.wrap.tripacts');
  const body = h('div.trip', { dataset: { case: 'keep' } }, head, leave, sky, roads, camsSec, acts);
  sheet = modal('GETTING THERE', body, () => {
    sheet = null;
    tripState.open = false;
    stopStills();
  });
  const say = (sec: HTMLElement, words: string, state = '') => {
    for (const n of [...sec.children].slice(1)) n.remove();
    sec.append(h('p.note', { dataset: { case: 'keep', ...(state ? { state } : {}) } }, words));
  };
  const planner = button('JOURNEY PLANNER', () => {
    sheet?.close();
    openJourneyPlanner(e.location ? { to: e.location } : {});
  });
  if (!e.location?.trim()) {
    tripState.state = 'noplace';
    for (const s of [sky, roads, camsSec]) s.hidden = true;
    say(leave, W.TRIP_NO_PLACE, 'empty');
    acts.append(planner);
    return;
  }
  if (offline()) {
    tripState.state = 'offline';
    for (const s of [sky, roads, camsSec]) s.hidden = true;
    say(leave, W.TRIP_OFFLINE, 'offline');
    const k = keptJourney();
    if (k) acts.append(button('LAST JOURNEY', () => (sheet?.close(), showJourney(k.answer, k.pick, { keptAt: k.at }))));
    acts.append(planner);
    return;
  }
  void plan(e, { leave, sky, roads, camsSec, acts, say, planner });
}

const stills: string[] = [];
const stopStills = () => {
  for (const u of stills.splice(0)) URL.revokeObjectURL(u);
};

async function plan(
  e: TripEvent,
  ui: { leave: HTMLElement; sky: HTMLElement; roads: HTMLElement; camsSec: HTMLElement; acts: HTMLElement; say: (s: HTMLElement, w: string, st?: string) => void; planner: HTMLButtonElement },
): Promise<void> {
  const { leave, sky, roads, camsSec, acts, say, planner } = ui;
  let answer: JourneyAnswer;
  try {
    const from = await placeArg('Here');
    // arriving five minutes before it starts
    answer = await brain.journey({ from: from.q, to: e.location!, time: localIso(e.start - 5 * 60_000), arriveBy: true });
    if (from.here) answer.from = { ...answer.from, name: 'Here' };
    answer.to = { ...answer.to, name: e.location! };
  } catch (err) {
    tripState.state = 'none';
    say(leave, sayError(err, 'plan getting there'), 'error');
    for (const s of [sky, roads, camsSec]) s.hidden = true;
    acts.append(planner);
    return;
  }
  const its = answer.itineraries ?? [];
  // the latest option that still arrives in time
  const fits = its.filter((j) => Date.parse(j.end) <= e.start).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  const j = fits[0] ?? its[0];
  if (!j) {
    tripState.state = 'none';
    say(leave, answer.note || W.TRIP_NO_ROUTE, 'empty');
    for (const s of [sky, roads, camsSec]) s.hidden = true;
    acts.append(planner);
    return;
  }
  tripState.leave = W.leaveLine(hhmm(j.start, answer.tz), hhmm(j.end, answer.tz), mins(j.duration), changesText(j));
  say(leave, tripState.leave);
  if (!fits.length) leave.append(h('p.note', { dataset: { state: 'error', case: 'keep' } }, 'None of the journeys found gets there before it starts; this is the closest.'));
  const pick = its.indexOf(j);
  acts.append(
    button('SHOW ON THE MAP', () => showJourney(answer, pick)),
    button('GOD’S EYE', () => {
      void import('../commands/registry').then((r) => r.run('fly_to', { lat: answer.to.lat, lon: answer.to.lon, range_km: 3 }));
    }),
    planner,
  );
  tripState.state = 'ready';
  const path = j.legs.flatMap((l) => legPath(l).map(([lat, lon]) => ({ lat, lon })));
  const pts = along(path.length ? path : [answer.from, answer.to]);
  await Promise.all([weatherThere(answer.to, Date.parse(j.end), sky, say), roadsAlong(pts, roads, say), camerasAlong(pts, camsSec, say)]);
}

async function weatherThere(at: { lat: number; lon: number }, arrive: number, sec: HTMLElement, say: (s: HTMLElement, w: string, st?: string) => void): Promise<void> {
  /* state: trip.weather loading */
  say(sec, 'Checking the weather there…', 'loading');
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${at.lat.toFixed(3)}&longitude=${at.lon.toFixed(3)}&hourly=temperature_2m,precipitation_probability,weather_code&forecast_days=16&timezone=GMT&timeformat=unixtime`;
    const w = await fetchJson<{ hourly: { time: number[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[] } }>(u, 900);
    const t = w.hourly.time;
    let best = 0;
    for (let i = 0; i < t.length; i++) if (Math.abs(t[i]! * 1000 - arrive) < Math.abs(t[best]! * 1000 - arrive)) best = i;
    if (!t.length || Math.abs(t[best]! * 1000 - arrive) > 3 * 3600_000) throw new Error('no hour');
    tripState.weather = W.weatherLine(WMO(w.hourly.weather_code[best]!), temp(w.hourly.temperature_2m[best]!), w.hourly.precipitation_probability[best] ?? null, hm(arrive));
    say(sec, tripState.weather);
  } catch {
    say(sec, W.TRIP_WEATHER_DOWN, 'error');
  }
}

async function roadsAlong(pts: { lat: number; lon: number }[], sec: HTMLElement, say: (s: HTMLElement, w: string, st?: string) => void): Promise<void> {
  if (!pts.some(inWestMidlands)) {
    tripState.roads = W.TRIP_ROADS_FAR;
    return say(sec, W.TRIP_ROADS_FAR, 'offline');
  }
  /* state: trip.roads loading */
  say(sec, 'Checking the roads along the way…', 'loading');
  await incidents.refresh('West Midlands').catch(() => undefined);
  const near: Incident[] = [...incidents.list.values()].filter((i) => pts.some((p) => km(p, i) < 1.5)).sort((a, b) => severity(b) - severity(a)).slice(0, 5);
  if (!near.length) {
    tripState.roads = W.TRIP_ROADS_NONE;
    return say(sec, W.TRIP_ROADS_NONE, 'empty');
  }
  tripState.roads = `${near.length} along the way`;
  for (const n of [...sec.children].slice(1)) n.remove();
  for (const i of near) sec.append(h('p.note.tripinc', { dataset: { sev: String(severity(i)), case: 'keep' } }, `${i.road} ${i.direction}: ${i.reason || 'incident'}${i.delayS ? `, ${delayWords(i.delayS)} delay` : ''}`));
  sec.append(h('small.dim', INCIDENT_CREDIT));
}

async function camerasAlong(pts: { lat: number; lon: number }[], sec: HTMLElement, say: (s: HTMLElement, w: string, st?: string) => void): Promise<void> {
  /* state: trip.cams loading */
  say(sec, 'Finding the public cameras along the way…', 'loading');
  loadCameras();
  // the camera lists arrive in the background: a few seconds at most
  for (let i = 0; i < 40 && cams.status === 'SYNC' && !cams.list.length; i++) await new Promise((r) => setTimeout(r, 250));
  const seen = new Set<string>();
  const found: Camera[] = [];
  for (const p of pts) {
    for (const c of nearestCameras(p.lat, p.lon, 2, 0.5)) if (!seen.has(c.id)) (seen.add(c.id), found.push(c));
    if (found.length >= 4) break;
  }
  tripState.cams = found.length;
  if (!found.length) return say(sec, W.TRIP_CAMS_NONE, 'empty');
  for (const n of [...sec.children].slice(1)) n.remove();
  const grid = h('div.tripcams');
  sec.append(grid);
  for (const c of found.slice(0, 4)) {
    const img = h('img', { alt: `A fresh picture: ${c.name}` });
    const tile = h('button.tripcam', { type: 'button', 'aria-label': `Watch ${c.name} live on God’s Eye` }, img, h('span', c.name));
    tile.addEventListener('click', () => {
      sheet?.close();
      void import('../commands/registry').then((r) => r.run('show_cameras', { lat: c.lat, lon: c.lon, place: c.name }));
    });
    grid.append(tile);
    void fetchImage(c.image, 30)
      .then((u) => {
        stills.push(u);
        img.src = u;
      })
      .catch(() => tile.classList.add('dead'));
  }
}

/** "How do I get to my next appointment?": the sheet on the next one with a place, or one line saying there is none. Returns what was said. */
export async function openNextTrip(): Promise<string> {
  try {
    const e = await nextTripEvent();
    if (!e) return W.TRIP_NOTHING_NEXT;
    openTrip(e);
    return `Getting there: ${e.title}, ${W.tripIn(e.start - Date.now())}, at ${e.location}.`;
  } catch (err) {
    return offline() ? W.TRIP_OFFLINE : sayError(err, 'read your diary');
  }
}

/** (exported for the agenda's own card: the event card's key) */
export const tripKey = (e: TripEvent): HTMLButtonElement => {
  const b = button('GETTING THERE', () => openTrip(e), 'on');
  b.dataset.act = 'trip';
  return b;
};
