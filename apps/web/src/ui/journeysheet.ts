/**
 * Journeys on the phone, in two pieces. The GO panel: plan a public-transport journey (FROM,
 * TO, leave now / leave at / arrive by, PLAN) and tap one of the options. The JOURNEY sheet,
 * under the flat map: the chosen option drawn leg by leg in its line's colour with its stops,
 * tabs for the other options, and the steps, each tappable to look there. The brain does the
 * planning (/api/journey: Transitous and the open timetables operators publish); its
 * plan_journey tool arrives here as the show_journey command with the same answer.
 */
import { brain } from '../api/brain';
import { clear, h, icon } from '../core/dom';
import { changesText, delayOf, hhmm, legColor, metres, mins, modeWord, ridesOf, standWord, stopsText, textOn, type Journey, type JourneyAnswer, type JourneyLeg, type JourneyMode } from '../data/journey';
import { home } from '../state/app';
import { button, modal } from './components';
import type { FlatMap } from './flatmap';
import { openMapSheet } from './mapsheet';

/** An icon per kind of leg: inline SVG paths of our own (Material Design icons, Apache 2.0), 24×24. */
const ICONS: Record<JourneyMode, string> = {
  walk: '<path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>',
  bus: '<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>',
  tram: '<path d="M19 16.94V8.5c0-2.79-2.61-3.4-6.01-3.49l.76-1.51H17V2H7v1.5h4.75l-.76 1.52C7.86 5.11 5 5.73 5 8.5v8.44c0 1.45 1.19 2.66 2.59 2.97L6 21.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 20h-.08c1.69 0 2.58-1.37 2.58-3.06zm-7 1.56c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5-4.5H7V9h10v5z"/>',
  rail: '<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z"/>',
  subway: '<path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>',
  ferry: '<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>',
  other: '<circle cx="12" cy="12" r="5"/>',
};

/** The last journeys planned, so PLAN AGAIN and the palette come back to them. */
let last: { answer: JourneyAnswer; pick: number } | null = null;
let planner: { close(): void } | null = null;

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const finite = (p: { lat: number; lon: number } | undefined | null): boolean => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon);

/** The answer with anything unusable left out: the brain is trusted, but a half-filled command must not stop the screen. */
function tidy(a: JourneyAnswer): JourneyAnswer {
  const itineraries = (Array.isArray(a.itineraries) ? a.itineraries : [])
    .filter((j) => !!j && Array.isArray(j.legs))
    .map((j) => ({
      ...j,
      legs: j.legs.filter((l) => !!l && finite(l.from) && finite(l.to)).map((l) => ({ ...l, stops: Array.isArray(l.stops) ? l.stops.filter(finite) : [], points: typeof l.points === 'string' ? l.points : '' })),
    }))
    .filter((j) => j.legs.length > 0);
  return { ...a, from: a.from ?? { name: '', lat: 0, lon: 0 }, to: a.to ?? { name: '', lat: 0, lon: 0 }, tz: typeof a.tz === 'string' ? a.tz : '', itineraries };
}

/** One step of the journey: icon, line badge, the words, the times; tap to look there on the map. */
function step(leg: JourneyLeg, i: number, j: Journey, tz: string, look: (l: JourneyLeg) => void): HTMLElement {
  const color = legColor(leg);
  const walk = leg.mode === 'walk';
  const lastLeg = i === j.legs.length - 1;
  const next = j.legs[i + 1];
  const d = delayOf(leg);
  const title = walk ? `Walk ${mins(leg.duration)}${leg.distance ? ` · ${metres(leg.distance)}` : ''}` : `${cap(modeWord(leg))} ${leg.line || leg.agency}${leg.headsign ? ` towards ${leg.headsign}` : ''}`;
  const detail = walk ? `to ${leg.to.name}${!lastLeg && next?.track ? ` · ${standWord(next)} ${next.track}` : ''}` : `from ${leg.from.name}${leg.track ? ` (${standWord(leg)} ${leg.track})` : ''} · ${stopsText(leg)} · get off at ${leg.to.name}`;
  const note = leg.cancelled ? h('em.jcancel', 'cancelled') : d.text ? h(`em.jlive${d.s >= 60 ? '.late' : ''}` as 'em', `live · ${d.text}`) : leg.realTime ? h('em.jlive', 'live') : null;
  const row = h(
    'div.jstep',
    { role: 'button', tabIndex: 0, title: 'Look here on the map' },
    h('span.jic', { style: { color } }, icon(ICONS[leg.mode], 'ic')),
    walk ? null : h('span.jbadge', { style: { background: color, color: textOn(color) } }, leg.line || modeWord(leg)),
    h('div.jtext', h('b', title), h('span', detail), note),
    h('span.jtime', hhmm(leg.start, tz), h('small', hhmm(leg.end, tz))),
  );
  const go = () => {
    for (const r of row.parentElement?.children ?? []) r.classList.toggle('on', r === row);
    look(leg);
  };
  row.addEventListener('click', go);
  row.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  return row;
}

/** Open the map on a journey: the picked option drawn, the JOURNEY sheet under it. */
export function showJourney(raw: JourneyAnswer, pick = 0): void {
  const answer = tidy(raw);
  const its = answer.itineraries;
  if (!its.length) return;
  planner?.close();
  pick = Math.max(0, Math.min(its.length - 1, Math.round(pick) || 0));
  last = { answer, pick };
  const tz = answer.tz;
  const tabs = h('div.jtabs');
  const steps = h('div.jsteps');
  let flat: FlatMap | null = null;
  const sheet = h(
    'div.jsheet',
    h('div.jhead', h('b', `${answer.from.name} → ${answer.to.name}`), h('span.jwhen', `${answer.arriveBy ? 'arrive by' : 'leave'} ${hhmm(answer.time, tz)}`)),
    tabs,
    steps,
    h(
      'div.jacts',
      button('PLAN AGAIN', () => openJourneyPlanner()),
      button('CLEAR', () => {
        flat?.showJourney(null);
        sheet.hidden = true;
      }),
    ),
    h('div.jcredit', 'Transitous and open timetables · times are live where the operator publishes them'),
  );
  const draw = (i: number) => {
    if (last) last.pick = i;
    [...tabs.children].forEach((b, k) => b.classList.toggle('on', k === i));
    const j = its[i]!;
    clear(steps, ...j.legs.map((leg, n) => step(leg, n, j, tz, (l) => flat?.panTo(l.from.lat, l.from.lon, l.mode === 'walk' ? 16 : 15))));
    flat?.showJourney(j);
  };
  its.forEach((j, i) => tabs.append(button(h('span', h('b', String(i + 1)), h('small', `${hhmm(j.start, tz)} → ${hhmm(j.end, tz)}`), h('small', `${mins(j.duration)} · ${changesText(j)}`)), () => draw(i), 'jtab')));
  const at = its[pick]!.legs[0]!.from;
  flat = openMapSheet('map', { lat: at.lat, lon: at.lon, name: `JOURNEY · ${answer.to.name}` }, { below: sheet }).flat();
  draw(pick);
}

export interface PlannerPrefill {
  from?: string;
  /** A place name, or "lat,lon" (then `toName` says what it is). */
  to?: string;
  toName?: string;
}

const HERE = /^(here|my location|where i am|home)$/i;

/** This phone's position (a few seconds at most), else the owner's home. */
const whereAmI = (): Promise<{ lat: number; lon: number }> =>
  new Promise((ok) => {
    let done = false;
    const finish = (p: { lat: number; lon: number } | null) => {
      if (done) return;
      done = true;
      const H = home();
      ok(p ?? { lat: H.lat, lon: H.lon });
    };
    if (!navigator.geolocation) return finish(null);
    navigator.geolocation.getCurrentPosition((p) => finish({ lat: p.coords.latitude, lon: p.coords.longitude }), () => finish(null), { timeout: 6000, maximumAge: 120_000 });
    setTimeout(() => finish(null), 7000);
  });

/** The owner's words for a place as the brain takes them: "Here" (or nothing) becomes this phone's position. */
async function placeArg(text: string): Promise<{ q: string; here: boolean }> {
  const t = text.trim();
  if (t && !HERE.test(t)) return { q: t, here: false };
  const p = await whereAmI();
  return { q: `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`, here: true };
}

/** "2026-10-17T09:30" in the phone's zone, for a datetime-local input. */
const localIso = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const plainError = (e: unknown): string => {
  if (e instanceof TypeError) return "I can't reach my brain right now: check the connection and try again.";
  const m = String((e as Error)?.message ?? e);
  return /^HTTP \d+/.test(m) ? "The journey planner didn't answer; try again in a minute." : m;
};

/** The GO panel. */
export function openJourneyPlanner(prefill: PlannerPrefill = {}): void {
  planner?.close();
  const from = h('input.jin', { placeholder: 'Here', value: prefill.from ?? 'Here', 'aria-label': 'From', autocomplete: 'off' });
  const to = h('input.jin', { placeholder: 'A stop, station, address or place', value: prefill.to ?? '', 'aria-label': 'To', autocomplete: 'off' });
  const time = h('input.jin', { type: 'datetime-local', 'aria-label': 'Time', value: localIso(Date.now() + 10 * 60_000) });
  time.hidden = true;
  let mode: 'now' | 'leave' | 'arrive' = 'now';
  const chips = h('div.jchips');
  const pickMode = (m: typeof mode) => {
    mode = m;
    time.hidden = m === 'now';
    for (const b of chips.children) b.classList.toggle('on', (b as HTMLElement).dataset.mode === m);
  };
  for (const [m, label] of [['now', 'LEAVE NOW'], ['leave', 'LEAVE AT'], ['arrive', 'ARRIVE BY']] as const) {
    const b = button(label, () => pickMode(m));
    b.dataset.mode = m;
    chips.append(b);
  }
  pickMode('now');
  const err = h('div.jerr');
  err.hidden = true;
  const results = h('div.jres');
  const planBtn = button('PLAN', () => void run(), 'warn');
  const hint = prefill.toName
    ? `TO is ${prefill.toName}; type a place to change it. "Here" is this phone's position, or your home in Settings.`
    : 'Buses, trams, trains, metro and ferries with the walks between, anywhere: free, no key (Transitous and the open timetables operators publish). "Here" is this phone\'s position, or your home in Settings.';
  const paint = (answer: JourneyAnswer, caption = '') => {
    clear(results);
    if (caption) results.append(h('div.lab', caption));
    if (!answer.itineraries.length) return void results.append(h('div.jnone', answer.note || 'No journeys found at that time: try another time.'));
    answer.itineraries.forEach((j, i) => {
      const badges = ridesOf(j)
        .slice(0, 5)
        .map((l) => h('i.jbadge', { style: { background: legColor(l), color: textOn(legColor(l)) } }, l.line || modeWord(l)));
      const r = h(
        'div.jopt',
        { role: 'button', tabIndex: 0 },
        h('b', `${hhmm(j.start, answer.tz)} → ${hhmm(j.end, answer.tz)}`),
        h('span', `${mins(j.duration)} · ${changesText(j)}`),
        h('span.jlines', ...badges, j.direct ? h('i.jwalk', `walk ${metres(j.legs.reduce((s, l) => s + l.distance, 0))}`) : null),
      );
      const open = () => showJourney(answer, i);
      r.addEventListener('click', open);
      r.addEventListener('keydown', (e) => e.key === 'Enter' && open());
      results.append(r);
    });
  };
  const run = async () => {
    if (!to.value.trim()) {
      err.textContent = 'Say where to go.';
      err.hidden = false;
      to.focus();
      return;
    }
    planBtn.disabled = true;
    planBtn.textContent = 'PLANNING…';
    err.hidden = true;
    clear(results);
    try {
      if (mode !== 'now' && !time.value) throw new Error('Pick a time.');
      const [a, b] = await Promise.all([placeArg(from.value), placeArg(to.value)]);
      const answer = await brain.journey({ from: a.q, to: b.q, ...(mode !== 'now' ? { time: time.value } : {}), arriveBy: mode === 'arrive' });
      // The owner said "Here" (the brain saw a coordinate): the sheet says what they said.
      if (a.here) answer.from = { ...answer.from, name: 'Here' };
      if (b.here) answer.to = { ...answer.to, name: 'Here' };
      else if (prefill.toName && b.q === prefill.to) answer.to = { ...answer.to, name: cap(prefill.toName) };
      last = { answer, pick: 0 };
      paint(answer);
    } catch (e) {
      err.textContent = plainError(e);
      err.hidden = false;
    } finally {
      planBtn.disabled = false;
      planBtn.textContent = 'PLAN';
    }
  };
  for (const inp of [from, to]) inp.addEventListener('keydown', (e) => e.key === 'Enter' && void run());
  const form = h('div.jform', h('div.lab', 'FROM'), from, h('div.lab', 'TO'), to, h('div.lab', 'WHEN'), chips, time, h('div.jhint', hint), planBtn, err, results);
  if (last && !prefill.to) paint(last.answer, `LAST PLANNED · ${last.answer.from.name} → ${last.answer.to.name}`);
  planner = modal('JOURNEY PLANNER', form, () => {
    planner = null;
  });
}
