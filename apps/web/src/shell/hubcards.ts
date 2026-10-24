/**
 * The hub cards (BRIEF-IRON-BUILD step 2; OWNER-ISSUES 32, 41, 43): every tool on a hub is an instrument card —
 * a small kicker (its bare glyph, its name, the live dot and one status word: LIVE, READY, TRAINING or OFF), what it
 * does for him, its instrument (ui/instruments.ts) and two or four readouts. Tappable as a whole; never an app icon.
 *
 * Every readout is read from what this phone already holds (the same stores the deck's `now()` lines read: the feeds,
 * the GYM's records, the learn mirror, `lastSeen`, the agenda) or from the few light reads a hub makes when it is
 * opened (`load`: the library's counts, the school, the reverse reports, at most every few minutes). A reading the
 * phone has not got shows "Not yet" and the card says how to get it — never a sample.
 *
 * A tab can give its own card through TabDef.instrument / TabDef.readouts / TabDef.status (shell/tabs.ts); the
 * table below is the default for the twenty tools, so the feature files stay as they are.
 */
import { brain, headers, lastSeen, type ReverseJobInfo, type StudyInfo } from '../api/brain';
import { offline } from '../api/offline';
import { favourites, player } from '../assistant/media';
import { chat } from '../assistant/session';
import { fmt, h } from '../core/dom';
import { stopwatch } from '../core/stopwatch';
import { quakes, events, signals, threatLevel } from '../data/hazards';
import { coins, CURRENCY_SYMBOL } from '../data/markets';
import { temp, weather, WMO } from '../data/weather';
import { air } from '../engine/layers/air';
import { sats } from '../engine/layers/sats';
import { META as GAMES } from '../gym/meta';
import { weekChange } from '../gym/rating';
import type { GymRecord } from '../gym/session';
import { areaIn } from '../space/homeplan';
import { home, settings, ui } from '../state/app';
import { gymControl, gymState } from '../features/gym/index';
import * as gymStore from '../features/gym/store';
import { dueCards, learn } from '../features/learn/store';
import { LENS_MODES } from '../features/lens/index';
import { schoolState } from '../features/school/index';
import { homePlan } from '../features/space/home';
import { SAMPLES } from '../features/studio/index';
import { listKept } from '../features/studio/catalog';
import { countdownInst, courseSegs, cubeInst, dayArcInst, draftInst, globeInst, gymRingInst, layersInst, levelInst, mindInst, planInst, schoolRingInst, sparkInst, traceInst, viewfinderInst } from '../ui/instruments';
import { niceCase } from '../ui/components';

export type StatusWord = 'LIVE' | 'READY' | 'TRAINING' | 'OFF';
/** One reading on a card: its label, the value (null: not known yet → "Not yet" or `none`), a small unit. */
export interface Readout {
  label: string;
  value: string | null;
  unit?: string;
  /** A live value glows (it is changing now). */
  live?: boolean;
  /** What to say instead of a value the phone has not got ("Off air", "None yet"); "Not yet" by default. */
  none?: string;
}
export interface HubCard {
  /** What it does for him, in a few words (purpose first, OWNER-ISSUES 33); worked out when drawn (his city). */
  title: string | (() => string);
  /** One more line, on a wide card only. */
  sub?: string;
  status(): StatusWord;
  /** The instrument, drawn from real state (null: none). An element with `.ctr` overlay may wrap it. */
  instrument?(): Element | null;
  readouts(): Readout[];
  /** What to do when the card knows nothing yet (shown under the readouts then). */
  why?(): string;
  /** Light reads made when the hub opens (throttled inside). */
  load?(): Promise<unknown>;
}

/* ------------------------------------------------------------------ the few reads a hub makes */
const every = (ms: number, fn: () => Promise<unknown>) => {
  let at = 0;
  let busy: Promise<unknown> | null = null;
  return () => {
    if (busy) return busy;
    if (Date.now() - at < ms) return Promise.resolve();
    at = Date.now();
    busy = fn().catch(() => undefined).finally(() => (busy = null));
    return busy;
  };
};
/** What the hubs read for themselves (null until read; `false` when the read failed). */
export const hubFacts = {
  gym: null as Map<string, GymRecord> | null,
  study: null as StudyInfo | null,
  school: null as { stage: string; label: string; subjects: number; passed: number } | null | false,
  reverse: null as ReverseJobInfo[] | null,
  kept: null as number | null,
};
const loadGym = every(3_000, async () => (hubFacts.gym = await gymStore.loadAll()));
const loadLib = every(300_000, async () => {
  const [, st] = await Promise.all([brain.library().catch(() => null), brain.studyStatus().catch(() => null)]);
  if (st) hubFacts.study = st;
});
const loadSchool = every(600_000, async () => {
  const j = (await fetch('/api/school', { headers: headers() }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Record<string, unknown> | null;
  const st = j?.state as { stage?: string } | undefined;
  if (!j || !st?.stage) return void (hubFacts.school = false);
  const cur = j.current as { label?: string; subjects?: { top?: boolean }[] } | undefined;
  const stages = Array.isArray(j.stages) ? (j.stages as { id?: string; label?: string }[]) : [];
  const subjects = Array.isArray(cur?.subjects) ? cur!.subjects! : [];
  hubFacts.school = { stage: st.stage, label: cur?.label ?? stages.find((x) => x.id === st.stage)?.label ?? niceCase(st.stage.replace(/[-_]/g, ' ')), subjects: subjects.length, passed: subjects.filter((x) => x.top).length };
});
const loadReverse = every(120_000, async () => (hubFacts.reverse = (await brain.reverseJobs()).jobs));
const loadKept = every(30_000, async () => (hubFacts.kept = (await listKept()).length));
const loadStatus = every(120_000, () => brain.status());

/* ------------------------------------------------------------------ helpers */
const n = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? null : fmt.n(x));
const city = () => home().name || 'home';
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** "25 min", "3 h", "Tomorrow 09:00", "Mon 09:00". */
function until(ms: number, now = Date.now()): string {
  const m = Math.round((ms - now) / 60_000);
  if (m < 60) return `${Math.max(0, m)} min`;
  const day = (t: number) => new Date(t).toDateString();
  if (m < 12 * 60 && day(ms) === day(now)) return `${Math.round(m / 60)} h`;
  if (day(ms) === day(now)) return clock(ms);
  if (day(ms) === day(now + 86_400_000)) return `Tomorrow ${clock(ms)}`;
  return `${new Date(ms).toLocaleDateString('en-GB', { weekday: 'short' })} ${clock(ms)}`;
}
const gymRecs = (): Map<string, GymRecord> => {
  const m = new Map(hubFacts.gym ?? []);
  // the GYM's page, when built, has newer numbers than the store
  for (const [id, r] of Object.entries(gymState.recs)) {
    const old = m.get(id);
    if (old) m.set(id, { ...old, level: r.level, mastery: r.mastery, units: r.units, mastered: r.mastered });
  }
  return m;
};
const gymTraining = () => gymState.training || (gymControl?.allOn() ? gymState.all.current : '');
const nextEvent = () => {
  const t = Date.now();
  return offline.get().agenda?.events.filter((e) => !e.allDay && e.start > t).sort((a, b) => a.start - b.start)[0] ?? null;
};
const btc = () => coins.data?.find((c) => c.sym === 'BTC') ?? null;
const quakesToday = () => (quakes.data ? quakes.data.filter((q) => Date.now() - q.t < 86_400_000).length : null);
/** The instrument with a number in its middle (the GYM's and SCHOOL's rings). */
const centred = (svg: Element, big: string, of: string, word: string) =>
  h('span.insc', svg, h('span.ctr', h('span', h('b.tnum', big, h('span.of', of)), h('small', word))));

/* ------------------------------------------------------------------ the twenty tools */
export const CARDS: Record<string, HubCard> = {
  core: {
    title: 'Talk to him',
    sub: 'Ask anything: he looks it up, does it, and checks his sources',
    status: () => (ui.get().connected == null ? 'READY' : ui.get().connected ? 'LIVE' : 'OFF'),
    instrument: () => traceInst(stopwatch.trips(12)),
    readouts: () => {
      const since = new Date().setHours(0, 0, 0, 0);
      const replies = chat.get().entries.filter((e) => e.kind === 'assistant' && e.at >= since).length;
      return [
        { label: 'Uplink', value: n(stopwatch.lastTrip()), unit: 'ms', live: !!ui.get().connected },
        { label: 'Replies today', value: String(replies) },
      ];
    },
    why: () => (ui.get().connected === false ? 'Offline: he answers on the phone until the signal is back' : ''),
  },
  brief: {
    title: () => `Your day in ${city()}`,
    status: () => (weather.data ? 'LIVE' : weather.status === 'NO FEED' ? 'OFF' : 'READY'),
    instrument: () => {
      const d = weather.data?.daily;
      return dayArcInst(d?.sunrise[0] ? Date.parse(d.sunrise[0]) : null, d?.sunset[0] ? Date.parse(d.sunset[0]) : null);
    },
    readouts: () => {
      const w = weather.data?.current;
      return [
        { label: 'Now', value: w ? temp(w.temperature_2m) : null, live: !!w },
        { label: 'Sky', value: w ? niceCase(WMO(w.weather_code)) : null },
      ];
    },
    why: () => (weather.data ? '' : 'The weather comes in when he can reach it'),
    load: () => weather.refresh(),
  },
  voice: {
    title: 'Say it out loud',
    status: () => 'READY',
    readouts: () => {
      const sp = lastSeen.get().status?.speech;
      return [
        { label: 'He hears', value: sp ? (sp.stt ? 'Yes' : 'Phone') : null },
        { label: 'Own voice', value: sp ? (sp.tts ? 'Yes' : 'Phone') : null },
      ];
    },
    load: loadStatus,
  },
  eye: {
    title: 'The planet, live',
    sub: 'Every plane, ship and satellite, and the cameras',
    status: () => (air.list.size || sats.list.length ? 'LIVE' : 'READY'),
    instrument: () => globeInst({ home: home(), planes: [...air.list.values()].map((a) => [a.lat, a.lon] as [number, number]), sats: sats.list.length }),
    readouts: () => [
      { label: 'Aircraft', value: air.list.size ? fmt.n(air.list.size) : null, live: air.list.size > 0 },
      { label: 'Satellites', value: sats.list.length ? fmt.n(sats.list.length) : null, live: sats.list.length > 0 },
      { label: 'Quakes · 24 h', value: n(quakesToday()), live: quakesToday() != null },
      { label: 'You', value: city() },
    ],
    why: () => (air.list.size ? '' : 'Planes and satellites load when you open it'),
    load: () => quakes.refresh(),
  },
  lens: {
    title: 'Point it at anything',
    sub: 'and he tells you what it is, reads it or measures it',
    status: () => 'READY',
    instrument: () => h('span.lensvf', viewfinderInst(), h('span.vfcap', 'Camera off')),
    readouts: () => [
      { label: 'Names', value: '4,624', unit: 'on phone' },
      { label: 'Ways to look', value: String(LENS_MODES.length) },
    ],
  },
  studio: {
    title: 'Make 3-D models',
    status: () => 'READY',
    instrument: cubeInst,
    readouts: () => [
      { label: 'Kept', value: n(hubFacts.kept) },
      { label: 'Built in', value: String(SAMPLES.length) },
    ],
    load: loadKept,
  },
  workshop: {
    title: 'He edits his own code',
    status: () => (lastSeen.get().status ? (lastSeen.get().status!.repoReady ? 'READY' : 'OFF') : 'READY'),
    instrument: draftInst,
    readouts: () => {
      const st = lastSeen.get().status;
      return [
        { label: 'Self-edit', value: st ? (st.repoReady ? 'On' : 'Off') : null },
        { label: 'Repo', value: st ? (st.repo ? st.repo.split('/').pop()! : null) : null, none: st ? 'None' : 'Not yet' },
      ];
    },
    load: loadStatus,
  },
  reverse: {
    title: 'See how any app works',
    status: () => (hubFacts.reverse?.some((j) => j.status === 'running' || j.status === 'queued') ? 'LIVE' : 'READY'),
    instrument: layersInst,
    readouts: () => {
      const j = hubFacts.reverse;
      return [
        { label: 'Reports', value: j ? String(j.filter((x) => x.status === 'done').length) : null },
        { label: 'Running', value: j ? String(j.filter((x) => x.status === 'running' || x.status === 'queued').length) : null, live: !!j?.some((x) => x.status === 'running') },
      ];
    },
    load: loadReverse,
  },
  space: {
    title: 'Plan a room to scale',
    status: () => 'READY',
    instrument: planInst,
    readouts: () => {
      const k = homePlan.get().home;
      return [
        { label: 'Your home', value: k ? `${k.rooms}` : null, unit: k ? (k.rooms === 1 ? 'room' : 'rooms') : '', none: 'None yet' },
        { label: 'Floor', value: k ? areaIn(k.m2, settings.get().units) : null, none: '—' },
      ];
    },
  },
  learn: {
    title: 'Learn anything',
    status: () => 'READY',
    instrument: () => {
      const c = [...learn.get().courses].sort((a, b) => (b.done < b.lessons ? 1 : 0) - (a.done < a.lessons ? 1 : 0))[0];
      if (!c) return h('span.coursemap', h('span.cmk', 'Your course'), h('span.cm', 'None yet'), courseSegs({ lessons: 6, done: 0 }));
      return h('span.coursemap', h('span.cmk', `Part ${Math.min(c.lessons, c.done + 1)} of ${c.lessons}`), h('span.cm', { dataset: { case: 'keep' } }, c.title), courseSegs({ lessons: c.lessons, done: c.done }));
    },
    readouts: () => {
      const c = learn.get().courses.find((x) => x.next > 0) ?? null;
      const any = learn.get().courses.length > 0;
      return [
        { label: 'Next', value: c ? `Lesson ${c.next}` : any ? 'All done' : null, none: 'Start one' },
        { label: 'Cards due', value: String(dueCards().length) },
      ];
    },
  },
  gym: {
    title: 'He teaches himself',
    status: () => (gymTraining() ? 'TRAINING' : 'READY'),
    instrument: () => {
      const recs = gymRecs();
      const mastered = GAMES.filter((g) => recs.get(g.id)?.mastered).length;
      const t = gymTraining();
      return centred(gymRingInst({ games: GAMES.length, mastered, live: t ? Math.min(GAMES.length - 1, mastered) : -1 }), String(mastered), `/${GAMES.length}`, 'mastered');
    },
    readouts: () => {
      const recs = [...gymRecs().values()];
      const rated = recs.filter((r) => r.league?.versions.length).sort((a, b) => b.league!.rating - a.league!.rating)[0];
      const t = gymTraining();
      const last = t ? recs.find((r) => r.id === t) : recs.filter((r) => r.units).sort((a, b) => b.updated - a.updated)[0];
      const d = rated ? weekChange(rated.league, Date.now()) : 0;
      return [
        rated
          ? { label: 'Rating', value: rated.league!.rating.toLocaleString('en-GB'), unit: d ? `${d > 0 ? '↑' : '↓'}${Math.abs(d)}` : '', live: !!t }
          : { label: 'Levels', value: hubFacts.gym || Object.keys(gymState.recs).length ? String(recs.reduce((s, r) => s + (r.mastered ? 10 : r.level - 1), 0)) : null },
        { label: t ? 'Now' : 'Last', value: last ? `${niceCase(GAMES.find((g) => g.id === last.id)?.title ?? last.id)} ${last.mastered ? '✓' : `Lv ${last.level}`}` : null, none: 'None yet', live: !!t },
      ];
    },
    load: loadGym,
  },
  school: {
    title: 'He sits real papers',
    status: () => (schoolState.sitting ? 'LIVE' : hubFacts.school === false ? 'OFF' : 'READY'),
    instrument: () => {
      const s = hubFacts.school;
      if (!s) return schoolRingInst({ subjects: 4, passed: 0, live: -1 });
      return centred(schoolRingInst({ subjects: s.subjects || 1, passed: s.passed, live: schoolState.sitting ? s.passed : -1 }), String(s.passed), `/${s.subjects}`, 'passed');
    },
    readouts: () => {
      const s = hubFacts.school;
      return [
        { label: 'Stage', value: s ? s.label : null, none: s === false ? 'Not set up' : 'Not yet' },
        { label: 'Papers sat', value: schoolState.stage ? String(schoolState.results) : null, none: '—' },
      ];
    },
    why: () => (hubFacts.school === false ? 'Download his school in Settings' : ''),
    load: loadSchool,
  },
  library: {
    title: 'All he has read',
    status: () => 'READY',
    instrument: () => {
      const s = hubFacts.study?.summary;
      return mindInst({ frac: s && s.topics ? s.read / s.topics : null });
    },
    readouts: () => [
      { label: 'Passages', value: n(lastSeen.get().passages) },
      { label: 'Studied', value: n(hubFacts.study?.summary.read), unit: hubFacts.study ? 'topics' : '' },
    ],
    load: loadLib,
  },
  agenda: {
    title: 'Your days',
    status: () => {
      const e = nextEvent();
      return e && e.start - Date.now() < 3_600_000 ? 'LIVE' : 'READY';
    },
    instrument: () => {
      const e = nextEvent();
      return countdownInst(e && e.start - Date.now() < 3_600_000 ? 1 - (e.start - Date.now()) / 3_600_000 : null);
    },
    readouts: () => {
      const e = nextEvent();
      const soon = !!e && e.start - Date.now() < 3_600_000;
      return [
        { label: 'Next', value: e ? e.title : null, none: offline.get().agenda ? 'Nothing' : 'Not yet' },
        { label: 'In', value: e ? until(e.start) : null, none: '—', live: soon },
      ];
    },
  },
  markets: {
    title: 'Markets, live',
    status: () => (coins.data ? 'LIVE' : coins.status === 'NO FEED' ? 'OFF' : 'READY'),
    instrument: () => {
      const b = btc();
      return sparkInst(b?.spark ?? [], (b?.change ?? 0) >= 0);
    },
    readouts: () => {
      const b = btc();
      const sym = CURRENCY_SYMBOL[settings.get().currency] ?? '';
      return [
        { label: 'Bitcoin', value: b ? `${sym}${fmt.n(b.price)}` : null, live: !!b },
        { label: '24 h', value: b ? `${b.change >= 0 ? '+' : '−'}${Math.abs(b.change).toFixed(2)}%` : null },
      ];
    },
    why: () => (coins.data ? '' : coins.status === 'NO FEED' ? 'The prices can’t be reached right now' : ''),
    load: () => coins.refresh(),
  },
  threats: {
    title: 'The world’s alerts',
    status: () => (quakes.data || events.data ? 'LIVE' : 'READY'),
    instrument: () => {
      const known = !!(quakes.data || events.data);
      return levelInst(known ? threatLevel(signals()).n : null, 3);
    },
    readouts: () => {
      const known = !!(quakes.data || events.data);
      const list = known ? signals() : [];
      const lvl = known ? threatLevel(list).label : '';
      return [
        { label: 'Level', value: known ? `${lvl.charAt(0)}${lvl.slice(1).toLowerCase()}` : null, live: known },
        { label: 'Signals', value: known ? fmt.n(list.length) : null },
      ];
    },
    load: () => Promise.all([quakes.refresh(), events.refresh()]),
  },
  radio: {
    title: 'Radio from everywhere',
    status: () => (player.get().state === 'playing' ? 'LIVE' : 'OFF'),
    readouts: () => {
      const p = player.get();
      return [
        { label: 'On air', value: p.state === 'playing' && p.now ? p.now.name : null, none: 'Off air', live: p.state === 'playing' },
        { label: 'Favourites', value: String(favourites.list().length) },
      ];
    },
  },
};
