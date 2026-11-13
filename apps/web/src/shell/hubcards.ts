/**
 * The hub cards (BRIEF-IRON-BUILD step 2; OWNER-ISSUES 32, 41, 43): every tool on a hub is an instrument card —
 * a small kicker (its bare glyph, its name, the live dot and one status word: LIVE, READY, TRAINING or OFF), one line
 * on what it does for him, its instrument (ui/instruments.ts) and two readouts (the navigation sheet, mockups/nav). Tappable as a whole; never an app icon.
 *
 * Every readout is read from what this phone already holds (the same stores the deck's `now()` lines read: the feeds,
 * the GYM's records, the learn mirror, `lastSeen`, the agenda) or from the few light reads a hub makes when it is
 * opened (`load`: the library's counts, the school, the reverse reports, at most every few minutes). A reading the
 * phone has not got shows "Not yet" and the card says how to get it — never a sample.
 *
 * A tab can give its own card through TabDef.instrument / TabDef.readouts / TabDef.status (shell/tabs.ts); the
 * table below is the default for every tool, so the feature files stay as they are. [tabs] The fourteen screens the sheets
 * became (BRIEF-TABS 3) read the same state their pages show: a statement's month, the week's moves, the timers running,
 * the people, the to-do, where the car is, what is due at home, the streaks, the posts waiting for his APPROVE, the house.
 */
import { brain, headers, lastSeen, type ReverseJobInfo, type StudyInfo } from '../api/brain';
import type { Project } from '../../../../packages/shared/src/protocol';
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
import { machineState } from '../features/eye/machine';
import { schoolState } from '../features/school/index';
import { homePlan } from '../features/space/home';
import { SAMPLES } from '../features/studio/index';
import { lastPanel } from '../features/workbench/index';
import { PANELS as BENCH } from '../features/workbench/panels';
import { listKept } from '../features/studio/catalog';
import { benchInst, countdownInst, courseSegs, cubeInst, dayArcInst, dialInst, draftInst, globeInst, gymRingInst, layersInst, levelInst, mindInst, planInst, schoolRingInst, sparkInst, traceInst, viewfinderInst, voiceInst } from '../ui/instruments';
import { niceCase } from '../ui/components';
import { convertTally } from '../convert/tally';
import { convertInst, docsInst, editorsInst, photoInst, sheetsInst, slidesInst, workspaceInst } from '../convert/inst';
import { listDocs } from '../docs/store';
import { listBooks } from '../sheets/store';
import { listDecks } from '../slides/store';
import { loadWorkspace } from '../workspace/store';
import { isRow, live as livePages, titleOf as pageTitle } from '../workspace/model';
import { videoInst } from '../video/inst';
import { videoTally } from '../video/tally';
import { gameInst } from '../studio-game/inst';
import { comicInst } from '../features/comic/inst';
import { comicState } from '../features/comic/state';
import { info as studioInfo } from '../studio-game/hub';
import { fetched, keptAs, SHELF } from '../arcade/shelf';
import { isHere } from '../arcade/store';
import { allScores } from '../arcade/scores';
// [tabs] what the new screens' cards read (BRIEF-TABS 3)
import { ACCOUNTS } from '../../../../packages/shared/src/social';
import { mmss } from '../../../../packages/shared/src/kitchen';
import { bodyInst, coachInst, creativeInst, homeInst, houseInst, learningInst, linksInst, memoryInst, moneyInst, outsideInst, peopleInst, settingsInst, socialInst, systemInst, workInst } from '../ui/lifeinst';
import { checkStorage, storageState } from '../features/system/storage';
import { bodyState } from '../features/body/sheet';
import { CREATIVE_TITLES } from '../features/creative/sheet';
import { saved as creativeSaved } from '../features/creative/draw';
import { NEARS } from '../features/outside/sheet';
import { socialInfo, waiting } from '../features/social/queue';
import { dayOf, loadProgress, streak } from '../coach/progress';
import { houseNow, loadHouse } from '../house/api';
// [reader] the library card: the book he is reading (BRIEF-LIBRARY-READER 5)
import { hisBooks, lastRead, readingNow, shelfDocs } from '../features/library/reader';
import { reading, shortTitle } from '../library/listen';
import { syncPlaces } from '../library/place';
import { loadPair } from '../further/interpret';
import { keptRehearsals, ROUNDS } from '../further/rehearse';
import { langName } from '../../../../packages/shared/src/scan';

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
  status(): StatusWord;
  /** The instrument, drawn from real state (null: none). An element with `.ctr` overlay may wrap it. */
  instrument?(): Element | null;
  readouts(): Readout[];
  /** What to do when the card knows nothing yet (shown under the readouts then). */
  why?(): string;
  /** Light reads made when the hub opens (throttled inside). */
  load?(): Promise<unknown>;
  /** A status line of its own under the readouts, and where a tap on it goes (God's Eye: the Machine view, `eye?machine`). */
  line?(): string;
  lineTo?: string;
  /**
   * [tabs] Its reading as one line, as a person says it ("£1,240 out in October, most on groceries", "Recycling tomorrow"):
   * the top of its screen (ui/sheetpage.ts) and its live line in Every screen. '' while it has nothing read yet.
   */
  say?(): string;
  /** [tabs] What its screen says at the top when there is no reading to say (a card read on this phone only, nothing there yet). */
  idle?: string;
  /**
   * [tabs] IN THE WORKS: what on it is still a stand-in, a first estimate or a table written in (one plain line, on the card
   * under a small IN THE WORKS label), until it is the real thing.
   */
  works?: string;
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
  /** The arcade: how many of the shelf's games are ready on this phone (ours always are; a classic once it is fetched). */
  arcade: null as { here: number } | null,
  gym: null as Map<string, GymRecord> | null,
  study: null as StudyInfo | null,
  school: null as { stage: string; label: string; subjects: number; passed: number } | null | false,
  reverse: null as ReverseJobInfo[] | null,
  kept: null as number | null,
  /** The newest model kept in the 3-D studio (its name and when). */
  keptLast: null as { title: string; at: number } | null,
  /** The Workshop's projects that run for days (null until read). */
  projects: null as Project[] | null,
  // [tabs] the screens the sheets became (null until read; `false`: read, and none kept)
  /** MONEY: the last statement's month, money out, its categories biggest first. */
  money: null as { month: string; out: number; cats: { c: string; spent: number }[] } | null | false,
  /** BODY: this week since Monday, as the pack keeps it. */
  body: null as { days: number; reps: number; km: number } | null,
  people: null as { n: number; next: { name: string; on: string } | null } | null,
  work: null as { open: number; done: number } | null,
  /** OUTSIDE: where the car is (car null: none kept). */
  outside: null as { car: string | null } | null,
  /** HOME: what is due in the next 45 days, in date order. */
  home: null as { on: string; text: string }[] | null,
  learning: null as { streak: number; today: boolean; skills: number } | null,
  coach: null as { streak: number; today: boolean; passed: number } | null,
  social: null as { waiting: number; linked: boolean[] } | null,
  /** PHOTO (BRIEF-EDITOR-PHOTO): the photos kept on this phone, from its own database (null until read). */
  photos: null as { n: number; edited: number; last: string | null; at: number } | null,
};
const loadGym = every(3_000, async () => (hubFacts.gym = await gymStore.loadAll()));
const loadPhotos = every(3_000, async () => {
  const { listPhotos } = await import('../photo/store');
  const all = await listPhotos();
  hubFacts.photos = { n: all.length, edited: all.filter((p) => p.edited).length, last: all[0]?.name ?? null, at: all[0]?.at ?? 0 };
});
/** THE GAME STUDIO: his games kept on this phone, read from its own store into the tally the studio keeps (studio-game/hub.ts). */
const loadStudioGames = every(3_000, async () => {
  const { listGames } = await import('../studio-game/store');
  const all = await listGames();
  studioInfo.games = all.length;
  studioInfo.last = all[0]?.name ?? '';
  studioInfo.loaded = true;
});
const loadEditors = () => Promise.all([loadPhotos(), loadStudioGames()]);
const loadArcade = every(3_000, async () => {
  const ready = await Promise.all(SHELF.map((e) => (fetched(e) ? isHere({ id: keptAs(e), data: e.data }) : true)));
  hubFacts.arcade = { here: ready.filter(Boolean).length };
});
const loadLib = every(300_000, async () => {
  const [lib, st] = await Promise.all([brain.library().catch(() => null), brain.studyStatus().catch(() => null)]);
  if (st) hubFacts.study = st;
  // [reader] the shelf the card counts, and his places in it (the book he is reading, the last one)
  if (lib) shelfDocs.set({ docs: lib.docs, at: Date.now() });
  await syncPlaces();
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
const loadKept = every(30_000, async () => {
  const k = await listKept();
  hubFacts.kept = k.length;
  hubFacts.keptLast = k[0] ? { title: k[0].title, at: k[0].at } : null;
});
const loadProjects = every(120_000, async () => (hubFacts.projects = (await brain.projects()).projects));
const loadStatus = every(120_000, () => brain.status());
// [tabs] the Me hub's cards: the facts as the Memory screen reads them (kept on this phone as it does), this phone's storage
// as SYSTEM measures it (never asking to keep it)
const loadMemory = every(120_000, () => brain.memory());
const loadStorage = every(60_000, () => checkStorage(false));
/** [tabs] The brain's keys as it last told this phone (null: not heard yet), and whether one of them is set. */
const keysNow = () => lastSeen.get().status?.keys ?? null;
const keySet = (name: string) => keysNow()?.find((k) => k.name === name)?.set ?? null;
// [tabs] the reads the new screens' pages make when they open, made by their cards when the hub opens (each pack's own
// read actions, or what the page itself reads first; no model, nothing changed)
const loadMoney = every(300_000, async () => {
  const s = await brain.spending();
  hubFacts.money = s.kept && s.view ? { month: s.view.month, out: s.view.out, cats: s.view.categories.map((x) => ({ c: String(x.c), spent: x.spent })) } : false;
});
const loadBody = every(120_000, async () => {
  const d = (await brain.packDo('body', 'week', {})).data as { days?: number; reps?: number; km?: number } | undefined;
  if (d && typeof d.days === 'number') hubFacts.body = { days: d.days, reps: d.reps ?? 0, km: d.km ?? 0 };
});
const loadPeople = every(300_000, async () => {
  const ps = ((await brain.packDo('people', 'who', {})).data as { people?: { name: string; next?: string }[] } | undefined)?.people ?? [];
  const next = ps.filter((p) => p.next).sort((a, b) => a.next!.localeCompare(b.next!))[0];
  hubFacts.people = { n: ps.length, next: next ? { name: next.name, on: next.next! } : null };
});
const loadWork = every(120_000, async () => {
  const list = ((await brain.packDo('work', 'todo', { words: '' })).data as { list?: { done?: boolean }[] } | undefined)?.list ?? [];
  hubFacts.work = { open: list.filter((t) => !t.done).length, done: list.filter((t) => t.done).length };
});
const loadOutside = every(300_000, async () => {
  const r = await brain.packDo('outside', 'parked', { ask: true });
  hubFacts.outside = { car: (r.data as { parked?: { label?: string } } | undefined)?.parked?.label ?? null };
});
const loadHome = every(300_000, async () => {
  // (nothing due comes back as words alone: an answer with no lines is an empty list)
  hubFacts.home = ((await brain.packDo('homeadmin', 'due', { days: 45 })).data as { lines?: { on: string; text: string }[] } | undefined)?.lines ?? [];
});
const loadLearning = every(300_000, async () => {
  const d = (await brain.packDo('learning', 'progress', {})).data as { rows?: unknown[]; overall?: { current?: number; today?: boolean } } | undefined;
  if (d) hubFacts.learning = { streak: d.overall?.current ?? 0, today: !!d.overall?.today, skills: d.rows?.length ?? 0 };
});
/** The coach's practice is kept on this phone (coach/progress.ts): read again when the hub repaints its cards. */
const loadCoach = every(3_000, async () => {
  const p = loadProgress();
  const today = dayOf(Date.now());
  hubFacts.coach = { streak: streak(p.days, today), today: p.days.includes(today), passed: Object.keys(p.passed).length };
});
const loadSocial = every(60_000, async () => {
  const info = await socialInfo();
  if (info) hubFacts.social = { waiting: waiting(info).length, linked: ACCOUNTS.map((a) => !!info.accounts.find((x) => x.id === a.id)?.who) };
});
/** The kitchen's timers run on this phone (features/kitchen/timers.ts, started only where there are any): taken when the hub opens. */
let kitchenTimers: typeof import('../features/kitchen/timers') | null = null;
const loadKitchen = async () => void (kitchenTimers ??= await import('../features/kitchen/timers'));

/** [further] The reads WHAT CHANGED SINCE YESTERDAY needs (further/changed.ts): the room cards' own, throttled, nothing changed. */
export const loadChangedFacts = (): Promise<unknown[]> => Promise.all([loadSchool(), loadGym(), loadCoach(), loadMoney(), loadPeople(), loadWork(), loadProjects(), loadKept(), loadReverse()]);

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
    m.set(id, { ...(old ?? { id, start: -1, detail: '', history: [], seed: 0, saved: null, updated: Date.now() }), level: r.level, mastery: r.mastery, units: r.units, mastered: r.mastered });
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
/** [tabs] "Tomorrow", "Tue", "14 Mar" for a day (YYYY-MM-DD). */
function dayWords(day: string, now = Date.now()): string {
  const t = Date.parse(`${day}T12:00:00`);
  if (!Number.isFinite(t)) return day;
  const d = new Date(t);
  if (d.toDateString() === new Date(now).toDateString()) return 'Today';
  if (d.toDateString() === new Date(now + 86_400_000).toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', Math.abs(t - now) < 6 * 86_400_000 ? { weekday: 'short' } : { day: 'numeric', month: 'short' });
}
/** [tabs] "Oct" or "October" for a month (YYYY-MM). */
const monthOf = (ym: string, month: 'short' | 'long') => new Date(`${ym}-15T12:00:00`).toLocaleDateString('en-GB', { month });
/** [tabs] A day in a sentence: "today", "tomorrow", "on Tuesday", "on 14 March". */
function dayPhrase(day: string, now = Date.now()): string {
  const d = daysTo(day, now);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  const t = new Date(`${day}T12:00:00`);
  return `on ${t.toLocaleDateString('en-GB', d > 1 && d < 7 ? { weekday: 'long' } : { day: 'numeric', month: 'long' })}`;
}
/** Days from today to `day` (0: today). */
const daysTo = (day: string, now = Date.now()) => Math.round((Date.parse(`${day}T12:00:00`) - new Date(now).setHours(12, 0, 0, 0)) / 86_400_000);
/** The kitchen's timer that rings next (or is ringing). */
const nextTimer = () => (kitchenTimers?.timersNow() ?? []).sort((a, b) => (b.ringing ? 1 : 0) - (a.ringing ? 1 : 0) || a.left - b.left)[0] ?? null;
/** His house's lights and switches, and how many are on. */
const houseLit = () => {
  const v = houseNow.get().view;
  const all = v?.linked ? v.entities.filter((e) => e.domain === 'light' || e.domain === 'switch' || e.domain === 'fan') : [];
  return { of: all.length, on: all.filter((e) => e.state === 'on').length };
};

/** The instrument with a number in its middle (the GYM's and SCHOOL's rings). */
const centred = (svg: Element, big: string, of: string, word: string) =>
  h('span.insc', svg, h('span.ctr', h('span', h('b.tnum', big, h('span.of', of)), h('small', word))));

/* ------------------------------------------------------------------ the twenty tools */
/** What lives on this phone across the editors (documents, spreadsheets, decks, workspace pages, photos, videos, games), and the newest one's name. */
const editorsKept = (): { total: number; newest: string } => {
  const all: { at: number; title: string }[] = [
    ...listDocs().map((d) => ({ at: d.at, title: d.title })),
    ...listBooks().map((b) => ({ at: b.at, title: b.title })),
    ...listDecks().map((d) => ({ at: d.at, title: d.title })),
    ...workspacePages().map((p) => ({ at: p.at, title: pageTitle(p) })),
    // PHOTO's kept photos: counted from its own database (read by loadPhotos, which the card asks for)
    ...Array.from({ length: hubFacts.photos?.n ?? 0 }, (_, i) => ({ at: i ? 0 : hubFacts.photos!.at, title: hubFacts.photos!.last ?? 'a photo' })),
    // VIDEO's kept videos: counted from the tally its store keeps when a project is saved
    ...Array.from({ length: videoTally()?.n ?? 0 }, (_, i) => ({ at: i ? 0 : videoTally()!.at, title: videoTally()!.last })),
    // THE GAME STUDIO's kept games: counted from the tally the studio keeps (read from its store by loadEditors, which the card asks for)
    ...Array.from({ length: studioInfo.games }, (_, i) => ({ at: 0, title: i ? 'a game' : studioInfo.last || 'a game' })),
  ];
  all.sort((a, b) => b.at - a.at);
  return { total: all.length, newest: all[0]?.title ?? '' };
};

/** The pages of his workspace (not a database's rows), newest first. */
const workspacePages = () => {
  const w = loadWorkspace();
  return livePages(w).filter((p) => !isRow(w, p)).sort((a, b) => b.at - a.at);
};

export const CARDS: Record<string, HubCard> = {
  core: {
    title: 'Talk to me',
    status: () => (ui.get().connected == null ? 'READY' : ui.get().connected ? 'LIVE' : 'OFF'),
    instrument: () => traceInst(stopwatch.trips(12)),
    readouts: () => {
      const since = new Date().setHours(0, 0, 0, 0);
      const replies = chat.get().entries.filter((e) => e.kind === 'assistant' && e.at >= since).length;
      return [
        { label: 'Uplink', value: n(stopwatch.lastTrip()), unit: 'ms', live: !!ui.get().connected },
        { label: 'Today', value: String(replies), unit: replies === 1 ? 'reply' : 'replies' },
      ];
    },
    why: () => (ui.get().connected === false ? 'Offline: I answer on the phone until the signal is back' : ''),
  },
  brief: {
    title: () => `${city()} today`,
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
    why: () => (weather.data ? '' : 'The weather comes in when I can reach it'),
    load: () => weather.refresh(),
  },
  voice: {
    title: 'Say it out loud',
    status: () => (ui.get().voice === 'listening' || ui.get().voice === 'speaking' ? 'LIVE' : 'READY'),
    instrument: () => voiceInst(ui.get().voice === 'listening' || ui.get().voice === 'speaking'),
    readouts: () => {
      const sp = lastSeen.get().status?.speech;
      return [
        { label: 'I hear', value: sp ? (sp.stt ? 'Yes' : 'Phone') : null },
        { label: 'Own voice', value: sp ? (sp.tts ? 'Yes' : 'Phone') : null },
      ];
    },
    load: loadStatus,
  },
  eye: {
    title: 'The planet, live',
    status: () => (machineState.on || air.list.size || sats.list.length ? 'LIVE' : 'READY'),
    instrument: () => globeInst({ home: home(), planes: [...air.list.values()].map((a) => [a.lat, a.lon] as [number, number]), sats: sats.list.length }),
    // while the Machine view is on, its reading first ("WATCHING · 41 AIR · 188 TRANSIT": the quick switcher shows it too)
    readouts: () => [
      machineState.on ? { label: 'Machine', value: machineState.hub || 'WATCHING', live: true } : { label: 'Aircraft', value: air.list.size ? fmt.n(air.list.size) : null, live: air.list.size > 0 },
      { label: 'Quakes', value: n(quakesToday()), unit: 'in 24 h', live: quakesToday() != null },
    ],
    // the status line: a tap opens God's Eye in the Machine view
    line: () => (machineState.on ? machineState.hub || 'WATCHING' : 'MACHINE VIEW'),
    lineTo: 'eye?machine',
    why: () => (air.list.size ? '' : `Planes over ${city()} load when you open it`),
    load: () => quakes.refresh(),
  },
  lens: {
    title: 'Point it at anything',
    status: () => 'READY',
    instrument: () => h('span.lensvf', viewfinderInst(), h('span.vfcap', 'Camera off')),
    readouts: () => [
      { label: 'Names', value: '4,624' },
      // (BRIEF-LENS, 7 Nov: the one view is the Lens itself, not a mode; the modes are what sits under its MORE key)
      { label: 'Modes', value: String(LENS_MODES.filter((m) => m !== 'lens').length) },
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
    title: 'I edit my own code',
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
    title: 'See how apps work',
    status: () => (lastSeen.get().status?.repoReady === false ? 'OFF' : hubFacts.reverse?.some((j) => j.status === 'running' || j.status === 'queued') ? 'LIVE' : 'READY'),
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
    title: 'Rooms to scale',
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
  workbench: {
    title: 'Engineering estimates',
    status: () => 'READY',
    instrument: benchInst,
    readouts: () => [
      // every mode of every panel, and the wind tunnel
      { label: 'Solvers', value: String(BENCH.reduce((n, p) => n + p.modes.length, 0) + 1) },
      { label: 'Last', value: lastPanel(), none: 'None yet' },
    ],
  },
  // [reste] MAKE → CONVERT (convert/sheet.ts): a sheet, not a screen; the card opens it
  convert: {
    title: 'Convert any file',
    status: () => 'READY',
    instrument: convertInst,
    readouts: () => {
      const t = convertTally();
      return [
        { label: 'Done here', value: t ? String(t.n) : null, none: 'None yet' },
        { label: 'Last', value: t ? t.last : null, none: '—' },
      ];
    },
    why: () => (convertTally() ? '' : 'Choose a file, or drop one: nothing is uploaded'),
    say: () => {
      const t = convertTally();
      return t ? `${fmt.n(t.n)} done on this phone, the last ${t.last}` : '';
    },
    idle: 'Nothing converted yet: choose or drop a file below',
  },
  // [reste] MAKE → DOCUMENTS (docs/sheet.ts): read, write, edit and translate; kept on this phone
  docs: {
    title: 'Letters and files',
    status: () => 'READY',
    instrument: docsInst,
    readouts: () => {
      const all = listDocs();
      return [
        { label: 'Kept here', value: all.length ? String(all.length) : null, none: 'None yet' },
        { label: 'Last', value: all[0]?.title ?? null, none: '—' },
      ];
    },
    why: () => (listDocs().length ? '' : 'Write a letter, or open a PDF or Word file'),
    say: () => {
      const all = listDocs();
      return all.length ? `${all.length} ${all.length === 1 ? 'document' : 'documents'} on this phone, the newest “${all[0]!.title}”` : '';
    },
    idle: 'No documents yet: start a new one, or open a file',
  },
  // [editors] MAKE → SPREADSHEETS (sheets/sheet.ts): budgets and lists with formulas that follow; kept on this phone
  sheets: {
    title: 'Budgets and lists',
    status: () => 'READY',
    instrument: sheetsInst,
    readouts: () => {
      const all = listBooks();
      return [
        { label: 'Kept here', value: all.length ? String(all.length) : null, none: 'None yet' },
        { label: 'Last', value: all[0]?.title ?? null, none: '—' },
      ];
    },
    why: () => (listBooks().length ? '' : 'Start with a household budget, or open an Excel file'),
    say: () => {
      const all = listBooks();
      return all.length ? `${all.length} ${all.length === 1 ? 'spreadsheet' : 'spreadsheets'} on this phone, the newest “${all[0]!.title}”` : '';
    },
    idle: 'No spreadsheets yet: start a budget, or open a file',
  },
  // [editors] MAKE → PRESENTATIONS (slides/sheet.ts): decks from a report or from scratch, a talk with the notes in hand; kept on this phone
  slides: {
    title: 'Slides and talks',
    status: () => 'READY',
    instrument: slidesInst,
    readouts: () => {
      const all = listDecks();
      return [
        { label: 'Kept here', value: all.length ? String(all.length) : null, none: 'None yet' },
        { label: 'Last', value: all[0]?.title ?? null, none: '—' },
      ];
    },
    why: () => (listDecks().length ? '' : 'Make slides from a report, or open a PowerPoint file'),
    say: () => {
      const all = listDecks();
      return all.length ? `${all.length} ${all.length === 1 ? 'deck' : 'decks'} on this phone, the newest “${all[0]!.title}”` : '';
    },
    idle: 'No slides yet: start from a report, or start blank',
  },
  // [editors] MAKE → THE WORKSPACE (workspace/sheet.ts): pages in pages, databases as boards and calendars, projects the brain reads whole; kept on this phone
  workspace: {
    title: 'Pages and projects',
    status: () => 'READY',
    instrument: workspaceInst,
    readouts: () => {
      const all = workspacePages();
      return [
        { label: 'Kept here', value: all.length ? String(all.length) : null, none: 'None yet' },
        { label: 'Last', value: all[0] ? pageTitle(all[0]) : null, none: '—' },
      ];
    },
    why: () => (workspacePages().length ? '' : 'Start a project, or start with a blank page'),
    say: () => {
      const all = workspacePages();
      return all.length ? `${all.length} ${all.length === 1 ? 'page' : 'pages'} in my workspace, the newest “${pageTitle(all[0])}”` : '';
    },
    idle: 'No pages yet: start a project, or start blank',
  },
  // MAKE → PHOTO (features/photo): a non-destructive photo editor; the photos and their recipes are kept on this phone. Folded under the EDITORS card as a pill (shell/areadefs.ts), so MAKE draws no card of its own for it; the card stays in the one list like the other editors'
  photo: {
    title: 'Edit a photo',
    status: () => 'READY',
    instrument: photoInst,
    load: loadPhotos,
    readouts: () => {
      const p = hubFacts.photos;
      return [
        { label: 'Kept here', value: p && p.n ? String(p.n) : null, none: 'None yet' },
        { label: 'Last', value: p?.last ?? null, none: '—' },
      ];
    },
    why: () => (hubFacts.photos?.n ? '' : 'Open a photo from your camera roll: your original is never touched'),
    say: () => {
      const p = hubFacts.photos;
      return p && p.n ? `${p.n} ${p.n === 1 ? 'photo' : 'photos'} on this phone, ${p.edited} edited, the newest “${p.last}”` : '';
    },
    idle: 'No photos yet: open one from your camera roll',
  },
  // [editors] MAKE → EDITORS: the editors folded under one card past ten things in the room (shell/areadefs.ts); its pills open each, and its line counts what lives on this phone across them
  editors: {
    title: () => {
      const n = editorsKept().total;
      return n ? `${n.toLocaleString('en-GB')} ${n === 1 ? 'thing lives' : 'things live'} on this phone across them` : 'Write, calculate, present, plan: start any one';
    },
    status: () => 'READY',
    instrument: editorsInst,
    load: loadEditors,
    readouts: () => {
      const k = editorsKept();
      return [
        { label: 'Kept here', value: k.total ? String(k.total) : null, none: 'None yet' },
        { label: 'Newest', value: k.newest || null, none: '—' },
      ];
    },
    why: () => (editorsKept().total ? '' : 'Start with a letter, a budget, a deck or a project'),
    say: () => {
      const k = editorsKept();
      return k.total ? `${k.total.toLocaleString('en-GB')} ${k.total === 1 ? 'thing' : 'things'} on this phone across my editors, the newest “${k.newest}”` : '';
    },
    idle: 'Nothing in the editors yet: start a letter, a budget, a deck or a project',
  },
  // [video] MAKE → VIDEO (video/screen.ts): the seventh full editor; the card reads the tally kept when a project is saved
  video: {
    title: 'Edit a video',
    status: () => 'READY',
    instrument: videoInst,
    readouts: () => {
      const t = videoTally();
      return [
        { label: 'Kept here', value: t ? String(t.n) : null, none: 'None yet' },
        { label: 'Last', value: t ? t.last : null, none: '—' },
      ];
    },
    why: () => (videoTally() ? '' : 'Add a clip from your phone and I’ll start a video'),
    say: () => {
      const t = videoTally();
      return t ? `${t.n} ${t.n === 1 ? 'video' : 'videos'} on this phone, the newest “${t.last}”, ${t.len}` : '';
    },
    idle: 'No videos yet: add a clip and cut it here',
  },
  // [gamestudio] MAKE → THE GAME STUDIO (studio-game/): a 2-D game maker on the app's own engine; his games are kept on this phone
  gamestudio: {
    title: 'Make a game',
    status: () => 'READY',
    instrument: gameInst,
    readouts: () => [
      { label: 'Games', value: studioInfo.games ? String(studioInfo.games) : null, none: studioInfo.loaded ? 'None yet' : 'Not yet' },
      { label: 'Last', value: studioInfo.last || null, none: '—' },
    ],
    why: () => (studioInfo.games ? '' : 'Pick a template and make one in a minute'),
    load: async () => (await import('../studio-game/editor')).refreshInfo(),
    say: () => (studioInfo.games ? `${studioInfo.games} ${studioInfo.games === 1 ? 'game' : 'games'} on this phone, the newest “${studioInfo.last}”` : ''),
    idle: 'No games yet: pick a template, and make one in a minute',
  },
  // [comic] MAKE → COMIC (features/comic): his comics read, made, and fetched from the public domain; all kept on this phone
  comic: {
    title: 'Read and make comics',
    status: () => 'READY',
    instrument: comicInst,
    readouts: () => [
      { label: 'On the shelf', value: comicState.books ? String(comicState.books) : null, none: 'None yet' },
      { label: 'Made', value: comicState.made ? String(comicState.made) : null, none: '—' },
    ],
    why: () => (comicState.books ? '' : 'Import a comic, get a free one, or make your own from an idea'),
    load: async () => (await import('../features/comic/app')).countShelf(),
    say: () => (comicState.books ? `${comicState.books} ${comicState.books === 1 ? 'comic' : 'comics'} on this phone, ${comicState.made} made by you` : ''),
    idle: 'No comics yet: import one, get a free one, or make your own',
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
    title: 'I teach myself',
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
        { label: t ? 'Now' : 'Last', value: last ? `${niceCase(GAMES.find((g) => g.id === last.id)?.title ?? last.id)} ${last.mastered ? '✓' : `Lv ${last.level}`}` : t ? `${niceCase(GAMES.find((g) => g.id === t)?.title ?? t)} Lv 1` : null, none: 'None yet', live: !!t },
      ];
    },
    load: loadGym,
  },
  school: {
    title: 'I sit real papers',
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
        { label: 'Papers', value: schoolState.stage ? String(schoolState.results) : null, none: '—' },
      ];
    },
    why: () => (hubFacts.school === false ? 'Download his school in Settings' : ''),
    load: loadSchool,
  },
  // [reader] the Library as a library (BRIEF-LIBRARY-READER 5): the book he is reading and where, else his shelf and the last book
  library: {
    title: 'Your books, read to you',
    status: () => (reading.get().state === 'reading' ? 'LIVE' : 'READY'),
    instrument: () => {
      const r = readingNow();
      if (r) return mindInst({ frac: r.place.pct });
      const s = hubFacts.study?.summary;
      return mindInst({ frac: s && s.topics ? s.read / s.topics : null });
    },
    readouts: () => {
      const r = readingNow();
      if (r) {
        const paged = r.doc.pages > 1 && r.doc.kind !== 'book' && !!r.place.page;
        return [
          { label: 'Reading', value: shortTitle(r.doc.title), live: reading.get().state === 'reading' },
          paged ? { label: 'Page', value: `${r.place.page} of ${r.doc.pages}` } : { label: 'Read', value: `${Math.max(1, Math.floor(r.place.pct * 100))}%` },
        ];
      }
      const s = shelfDocs.get();
      const mine = hisBooks(s.docs);
      const last = lastRead();
      return [
        { label: 'Shelf', value: s.at ? fmt.n(mine.length) : null, unit: mine.length === 1 ? 'book' : 'books' },
        { label: 'Last book', value: last ? shortTitle(last.title) : null, none: 'None yet' },
      ];
    },
    why: () => (shelfDocs.get().at && !hisBooks(shelfDocs.get().docs).length ? 'Add a book in the Library and I’ll read it to you' : ''),
    load: loadLib,
  },
  // [arcade] the ARCADE's card on Learn (1 Nov; it had no card, so the owner could not find it): free classics and our own
  // games, played on this phone; LIVE while one is playing comes from the tab itself (features/arcade: arcadeTab.status)
  arcade: {
    title: 'Free classics',
    status: () => 'READY',
    instrument: () => levelInst(hubFacts.arcade?.here ?? null, SHELF.length),
    readouts: () => {
      const last = Object.entries(allScores()).filter(([k]) => !k.endsWith('/sitting')).sort((a, b) => b[1].when.localeCompare(a[1].when))[0];
      const title = last ? SHELF.find((g) => g.id === last[0])?.title ?? null : null;
      return [
        { label: 'Games', value: String(SHELF.length), unit: 'free' },
        { label: 'Last game', value: title, none: 'None yet' },
      ];
    },
    why: () => (hubFacts.arcade ? `${hubFacts.arcade.here} of ${SHELF.length} here; the rest on Wi-Fi, when you ask` : ''),
    load: loadArcade,
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
    title: 'World radio',
    status: () => (player.get().state === 'playing' ? 'LIVE' : player.get().state === 'paused' ? 'READY' : 'OFF'),
    instrument: () => dialInst(player.get().state === 'playing'),
    readouts: () => {
      const p = player.get();
      return [
        { label: 'On air', value: p.state === 'playing' && p.now ? p.now.name : null, none: p.state === 'paused' && p.now ? `${p.now.name} · paused` : 'Off air', live: p.state === 'playing' },
        { label: 'Saved', value: String(favourites.list().length) },
      ];
    },
  },
  // ---------------------------------------------------------------- [tabs] LIFE: the eight everyday packs (BRIEF-TABS 3)
  money: {
    title: 'Your spending',
    status: () => 'READY',
    instrument: () => moneyInst(hubFacts.money ? hubFacts.money.cats.map((x) => x.spent) : null),
    readouts: () => {
      const m = hubFacts.money;
      const none = m === false ? 'None yet' : 'Not yet';
      return [
        { label: 'Spent', value: m ? `£${fmt.n(Math.round(m.out))}` : null, unit: m ? monthOf(m.month, 'short') : '', none },
        { label: 'Most on', value: m && m.cats[0] ? niceCase(m.cats[0].c) : null, none },
      ];
    },
    why: () => (hubFacts.money === false ? 'Paste a statement: read by rules, no bank access' : ''),
    say: () => {
      const m = hubFacts.money;
      if (m == null) return '';
      if (m === false) return 'No statement yet: paste one below, or pick its CSV or PDF';
      return `£${fmt.n(Math.round(m.out))} out in ${monthOf(m.month, 'long')}${m.cats[0] ? `, most on ${m.cats[0].c}` : ''}`;
    },
    load: loadMoney,
  },
  body: {
    title: 'Move and breathe',
    status: () => (bodyState.run.on || bodyState.camera === 'on' ? 'LIVE' : 'READY'),
    instrument: () => bodyInst(hubFacts.body?.days ?? null),
    readouts: () => {
      const b = hubFacts.body;
      return [
        { label: 'Active', value: b ? String(b.days) : null, unit: b ? (b.days === 1 ? 'day' : 'days') : '' },
        { label: 'Reps', value: b ? fmt.n(b.reps) : null, unit: b && b.km ? `${b.km} km` : '' },
      ];
    },
    why: () => 'Count your squats, or start a run',
    say: () => {
      const b = hubFacts.body;
      if (!b) return '';
      if (!b.days) return 'Nothing logged this week: count some squats, or start a run';
      return `${b.days} active ${b.days === 1 ? 'day' : 'days'} this week, ${fmt.n(b.reps)} ${b.reps === 1 ? 'rep' : 'reps'}${b.km ? `, ${b.km} km run` : ''}`;
    },
    load: loadBody,
  },
  kitchen: {
    title: 'Timers and meals',
    status: () => (kitchenTimers?.timersNow().length ? 'LIVE' : 'READY'),
    // the soonest timer's last hour, filling as it comes up to ringing (as the diary's next thing does)
    instrument: () => {
      const t = nextTimer();
      return countdownInst(t ? (t.ringing ? 1 : t.left < 3600 ? 1 - t.left / 3600 : 0.01) : null);
    },
    readouts: () => {
      const n = kitchenTimers?.timersNow().length ?? 0;
      const t = nextTimer();
      return [
        { label: 'Timers', value: n ? String(n) : null, none: kitchenTimers ? 'None' : 'Not yet', live: n > 0 },
        { label: 'Next', value: t ? (t.ringing ? 'Ringing' : mmss(t.left)) : null, unit: t ? t.name : '', none: '—', live: !!t },
      ];
    },
    why: () => 'Set one, or say “timer 8 minutes for the pasta”',
    say: () => {
      if (!kitchenTimers) return '';
      const all = kitchenTimers.timersNow();
      const t = nextTimer();
      if (!t) return 'No timers running';
      if (t.ringing) return `The ${t.name} timer is ringing`;
      return all.length === 1 ? `The ${t.name} timer: ${mmss(t.left)} to go` : `${all.length} timers running, the ${t.name} next in ${mmss(t.left)}`;
    },
    load: loadKitchen,
  },
  people: {
    title: 'Birthdays and gifts',
    status: () => 'READY',
    instrument: () => peopleInst(hubFacts.people?.n ?? null),
    readouts: () => {
      const p = hubFacts.people;
      return [
        { label: 'People', value: p?.n ? String(p.n) : null, none: p ? 'None yet' : 'Not yet' },
        { label: 'Birthday', value: p?.next ? p.next.name : null, unit: p?.next ? dayWords(p.next.on) : '', none: p ? 'None yet' : 'Not yet' },
      ];
    },
    why: () => (hubFacts.people && !hubFacts.people.n ? 'Tell me about someone: “Sam is my cousin”' : ''),
    say: () => {
      const p = hubFacts.people;
      if (!p) return '';
      if (!p.n) return 'No one yet: tell me about someone and I keep it';
      return `${p.n} ${p.n === 1 ? 'person' : 'people'} you told me about${p.next ? `; ${p.next.name}’s birthday ${dayPhrase(p.next.on)}` : ''}`;
    },
    load: loadPeople,
  },
  work: {
    title: 'Your to-do list',
    status: () => 'READY',
    instrument: () => workInst(hubFacts.work?.done ?? null, hubFacts.work ? hubFacts.work.open + hubFacts.work.done : null),
    readouts: () => {
      const w = hubFacts.work;
      return [
        { label: 'To do', value: w?.open ? String(w.open) : null, none: w ? 'Nothing' : 'Not yet' },
        { label: 'Done', value: w ? String(w.done) : null },
      ];
    },
    why: () => 'Add a job, or practise an interview out loud',
    say: () => {
      const w = hubFacts.work;
      if (!w) return '';
      if (!w.open && !w.done) return 'Nothing on your list yet';
      if (!w.open) return `All done: ${w.done} ticked off`;
      return `${w.open} to do${w.done ? `, ${w.done} done` : ''}`;
    },
    load: loadWork,
  },
  creative: {
    title: 'Songs and posters',
    status: () => 'READY',
    instrument: () => creativeInst(!!creativeSaved.name),
    // the seven things the screen makes, and what was last saved from it on this visit
    readouts: () => [
      { label: 'Makes', value: String(Object.keys(CREATIVE_TITLES).length) },
      { label: 'Saved', value: creativeSaved.name || null },
    ],
    why: () => 'A song, a poster, a card or a beat, made here',
    say: () => (creativeSaved.name ? `Last saved: ${creativeSaved.name}` : ''),
    idle: 'Seven things to make here, saved to your phone only when you tap',
  },
  outside: {
    title: 'Find what’s near',
    status: () => 'READY',
    instrument: () => outsideInst(!!hubFacts.outside?.car),
    readouts: () => {
      const o = hubFacts.outside;
      return [
        { label: 'Car', value: o?.car ?? null, none: o ? 'None' : 'Not yet' },
        // the kinds of place NEARBY finds (car parks, toilets, cash, water, open now)
        { label: 'Nearby', value: String(NEARS.length), unit: 'kinds' },
      ];
    },
    why: () => 'Toilets, cash, parking and a safer walk',
    say: () => (hubFacts.outside?.car ? `Your car: ${hubFacts.outside.car}` : ''),
    idle: 'No car kept: when you park, tap My car and I keep the spot',
    load: loadOutside,
  },
  homeadmin: {
    title: 'Bins and bills',
    status: () => (hubFacts.home?.some((x) => daysTo(x.on) === 0) ? 'LIVE' : 'READY'),
    instrument: () => homeInst(hubFacts.home ? hubFacts.home.map((x) => daysTo(x.on)).filter((d) => d >= 0 && d < 14) : null),
    readouts: () => {
      const l = hubFacts.home;
      const next = l?.find((x) => daysTo(x.on) >= 0) ?? null;
      return [
        { label: 'Next', value: next ? next.text : null, unit: next ? dayWords(next.on) : '', none: l ? 'Nothing' : 'Not yet', live: !!next && daysTo(next.on) <= 1 },
        { label: 'Due soon', value: l ? String(l.filter((x) => daysTo(x.on) >= 0 && daysTo(x.on) < 14).length) : null },
      ];
    },
    why: () => (hubFacts.home && !hubFacts.home.length ? 'Tell me your bin days, or photograph a bill' : ''),
    say: () => {
      const l = hubFacts.home;
      if (!l) return '';
      const next = l.find((x) => daysTo(x.on) >= 0);
      if (!next) return 'Nothing due at home that I know of';
      const soon = l.filter((x) => daysTo(x.on) >= 0 && daysTo(x.on) < 14).length;
      return `${niceCase(next.text)} ${dayPhrase(next.on)}${soon > 1 ? `; ${soon} things due in the next fortnight` : ''}`;
    },
    load: loadHome,
  },
  // ---------------------------------------------------------------- [tabs] LEARN: the learning pack and the coach
  learning: {
    title: 'Words and maths',
    status: () => 'READY',
    instrument: () => learningInst(hubFacts.learning?.streak ?? null),
    readouts: () => {
      const l = hubFacts.learning;
      return [
        { label: 'Streak', value: l?.skills ? String(l.streak) : null, unit: l?.skills ? (l.streak === 1 ? 'day' : 'days') : '', none: l ? 'None yet' : 'Not yet', live: !!l?.today },
        { label: 'Skills', value: l ? String(l.skills) : null },
      ];
    },
    why: () => 'Ten words a day, typing, maths and first aid',
    say: () => {
      const l = hubFacts.learning;
      if (!l) return '';
      if (!l.skills) return 'Nothing practised yet: start with today’s ten words';
      return `${l.streak}-day streak${l.today ? ', practised today' : ''}; ${l.skills} ${l.skills === 1 ? 'skill' : 'skills'} logged`;
    },
    // (its words and its first-aid steps are tables written in, not from a live source: said on the screen too)
    works: 'Its words and first aid are typed in by hand',
    load: loadLearning,
  },
  coach: {
    title: 'Music and typing',
    works: 'Its words are a starter set, typed in by hand',
    status: () => 'READY',
    instrument: () => coachInst(!!hubFacts.coach?.today, hubFacts.coach?.streak ?? 0),
    readouts: () => {
      const c = hubFacts.coach;
      return [
        { label: 'Streak', value: c?.streak ? String(c.streak) : null, unit: c?.streak ? (c.streak === 1 ? 'day' : 'days') : '', none: c ? 'None yet' : 'Not yet', live: !!c?.today },
        { label: 'Passed', value: c ? String(c.passed) : null, unit: c?.passed === 1 ? 'lesson' : 'lessons' },
      ];
    },
    why: () => 'A tuner, and lessons that hear you play',
    say: () => {
      const c = hubFacts.coach;
      if (!c?.streak) return '';
      return `${c.streak}-day streak${c.today ? ', practised today' : ''}${c.passed ? `; ${c.passed} ${c.passed === 1 ? 'lesson' : 'lessons'} passed` : ''}`;
    },
    idle: 'Practise today and the streak starts; it all stays on this phone',
    load: loadCoach,
  },
  // ---------------------------------------------------------------- [further] the interpreter, the lab and REHEARSE (BRIEF-OCT-IDEAS-3)
  interpreter: {
    title: 'Two languages, face to face',
    status: () => 'READY',
    instrument: () => voiceInst(false),
    readouts: () => {
      const p = loadPair();
      return [
        { label: 'Pair', value: `${langName(p.a)} · ${langName(p.b)}` },
        { label: 'Kept', value: null, none: 'Nothing' },
      ];
    },
    why: () => 'Hold a key and speak; nothing is recorded',
  },
  rehearse: {
    title: 'Practise a hard talk',
    status: () => 'READY',
    instrument: () => levelInst(null, ROUNDS),
    readouts: () => {
      const k = keptRehearsals();
      return [
        { label: 'Rounds', value: String(ROUNDS) },
        { label: 'Kept', value: k ? String(k) : null, unit: k === 1 ? 'rehearsal' : 'rehearsals', none: 'None yet' },
      ];
    },
    why: () => 'I play the other side; notes after three rounds',
  },
  // ---------------------------------------------------------------- [tabs] MAKE: the house (the converter and the documents are above)
  house: {
    title: 'Your smart home',
    status: () => (houseNow.get().view?.linked === false ? 'OFF' : 'READY'),
    instrument: () => {
      const l = houseLit();
      return houseInst(l.of ? l.on : null, l.of || null);
    },
    readouts: () => {
      const v = houseNow.get().view;
      const l = houseLit();
      return [
        { label: 'Things', value: v?.linked ? String(v.entities.length) : null, none: v ? 'Not set up' : 'Not yet' },
        { label: 'Lights on', value: v?.linked ? String(l.on) : null, none: v ? '—' : 'Not yet' },
      ];
    },
    why: () => (houseNow.get().view?.linked === false ? 'Link Home Assistant in SYSTEM → KEYS' : ''),
    say: () => {
      const st = houseNow.get();
      const v = st.view;
      if (!v) return st.offline ? 'Offline: I can’t reach my brain, so I can’t reach your house' : '';
      if (!v.linked) return 'Not linked yet: the steps are below, and it needs nothing paid';
      const rooms = new Set(v.entities.map((e) => e.area || 'Elsewhere')).size;
      const l = houseLit();
      return `${v.entities.length} ${v.entities.length === 1 ? 'thing' : 'things'} in ${rooms} ${rooms === 1 ? 'room' : 'rooms'}${l.of ? `; ${l.on} ${l.on === 1 ? 'light' : 'lights'} on` : ''}`;
    },
    load: () => loadHouse(),
  },
  // ---------------------------------------------------------------- [tabs] ME: his social self
  social: {
    title: 'Approve your posts',
    status: () => 'READY',
    instrument: () => socialInst(hubFacts.social?.linked ?? null, hubFacts.social?.waiting ?? 0),
    readouts: () => {
      const s = hubFacts.social;
      return [
        { label: 'Waiting', value: s?.waiting ? String(s.waiting) : null, none: s ? 'Nothing' : 'Not yet', live: !!s?.waiting },
        { label: 'Linked', value: s ? String(s.linked.filter(Boolean).length) : null, unit: s ? `of ${s.linked.length}` : '' },
      ];
    },
    why: () => 'Nothing goes out without your APPROVE',
    say: () => {
      const s = hubFacts.social;
      if (!s) return '';
      const linked = s.linked.filter(Boolean).length;
      if (s.waiting) return `${s.waiting} ${s.waiting === 1 ? 'post waits' : 'posts wait'} for your APPROVE`;
      if (!linked) return 'No account linked yet: the steps are under Accounts';
      return `Nothing waiting; ${linked} of ${s.linked.length} accounts linked`;
    },
    load: loadSocial,
  },
  // ---------------------------------------------------------------- [tabs] ME: the Me sheet's screens, each a card of its own
  memory: {
    title: 'What I remember',
    status: () => 'READY',
    instrument: () => memoryInst(offline.get().memory?.length ?? null),
    readouts: () => {
      const m = offline.get().memory;
      const newest = m?.length ? Math.max(...m.map((f) => f.at)) : 0;
      return [
        { label: 'Facts', value: m?.length ? fmt.n(m.length) : null, none: m ? 'None yet' : 'Not yet' },
        { label: 'Newest', value: newest ? dayWords(new Date(newest).toLocaleDateString('en-CA')) : null, none: m ? 'None yet' : 'Not yet' },
      ];
    },
    why: () => 'Tell me something about you, and I keep it',
    load: loadMemory,
  },
  settings: {
    title: 'Voice and home',
    status: () => 'READY',
    instrument: () => settingsInst([settings.get().speak, !!settings.get().home, settings.get().sounds]),
    readouts: () => [
      { label: 'Voice', value: settings.get().speak ? 'On' : 'Off' },
      { label: 'Units', value: settings.get().units === 'imperial' ? 'Imperial' : 'Metric' },
    ],
  },
  system: {
    title: 'Keys and storage',
    status: () => 'READY',
    instrument: () => {
      const k = keysNow();
      return systemInst(k ? k.filter((x) => x.set).length : null, k?.length ?? null, lastSeen.get().status?.meter?.level ?? null);
    },
    readouts: () => {
      const k = keysNow();
      const used = storageState.get().usage;
      return [
        { label: 'Keys', value: k ? String(k.filter((x) => x.set).length) : null, unit: k ? `of ${k.length}` : '' },
        { label: 'On phone', value: used >= 0 ? fmt.n(used / 1_048_576, used < 10_485_760 ? 1 : 0) : null, unit: 'MB' },
      ];
    },
    why: () => 'Read from my brain when you open it',
    load: () => Promise.all([loadStatus(), loadStorage()]),
  },
  links: {
    title: 'Link your email',
    status: () => 'READY',
    instrument: () => linksInst(['email', 'telegram', 'github', 'tomtom', 'homeassistant'].map((n) => keySet(n))),
    readouts: () => {
      const said = (on: boolean | null) => (on ? 'Linked' : null);
      const none = (on: boolean | null) => (on === false ? 'Not set up' : 'Not yet');
      return [
        { label: 'Email', value: said(keySet('email')), none: none(keySet('email')) },
        { label: 'Telegram', value: said(keySet('telegram')), none: none(keySet('telegram')) },
      ];
    },
    why: () => 'Email, Spotify and Telegram, linked once',
    load: loadStatus,
  },
};

/* ------------------------------------------------------------------ the hubs' own words */
/**
 * The line under a hub's title, made his (the navigation sheet: "his city in the weather, his places by name, his
 * school stage, his rating: nothing generic"), in Ghosty's one voice ("I", never "he"). Built only from readings the
 * phone holds; '' when it holds none, and the hub shows its plain line (shell/areas.ts AREAS[].sub) — never a sample.
 */
export function hubWords(area: string): string {
  if (area === 'learn') {
    const s = hubFacts.school;
    const stage = s ? schoolStage(s.stage, s.label) : '';
    const best = [...gymRecs().values()].filter((r) => r.league?.versions.length).sort((a, b) => b.league!.rating - a.league!.rating)[0];
    const rated = best ? `rated ${best.league!.rating.toLocaleString('en-GB')} at ${niceCase(GAMES.find((g) => g.id === best.id)?.title ?? best.id)}` : '';
    if (stage && rated) return `${stage}, and ${rated}.`;
    if (stage) return `${stage}; the courses here are for you.`;
    if (rated) return `I’m ${rated}; the courses here are for you.`;
    return '';
  }
  if (area === 'plan') {
    const known = !!offline.get().agenda;
    const e = nextEvent();
    const next = e ? `Next: ${e.title} ${whenWords(e.start)}` : known ? 'Nothing booked' : '';
    const w = weather.data?.current;
    const sky = w ? `${temp(w.temperature_2m)}, ${WMO(w.weather_code).toLowerCase()} in ${weather.data!.place}` : '';
    return [next, sky].filter(Boolean).join('. ') + (next || sky ? '.' : '');
  }
  if (area === 'see') {
    const town = settings.get().home?.name;
    return town ? `The world live from ${town}, and a camera that understands it.` : '';
  }
  if (area === 'make') {
    type Made = { at: number; words: string };
    const made: Made[] = [];
    for (const p of hubFacts.projects ?? []) {
      if (p.status === 'cancelled') continue;
      made.push({ at: p.updated, words: p.status === 'active' ? `I’m building ${p.title} for you now.` : p.status === 'paused' ? `${p.title} is paused, waiting for you.` : `Last made: ${p.title}.` });
    }
    const k = hubFacts.keptLast;
    if (k) made.push({ at: k.at, words: `Last kept: ${k.title}, a 3-D model.` });
    for (const j of hubFacts.reverse ?? []) if (j.status === 'done' || j.status === 'running') made.push({ at: j.finishedAt ?? j.at, words: j.status === 'running' ? `I’m taking ${j.target} apart now.` : `Last taken apart: ${j.target}.` });
    return made.sort((a, b) => b.at - a.at)[0]?.words ?? '';
  }
  return '';
}

/** The reads a hub's words need (throttled; the cards make most of them already). */
export function loadHubWords(area: string): Promise<unknown> {
  if (area === 'learn') return Promise.all([loadSchool(), loadGym()]);
  if (area === 'plan') return weather.refresh().catch(() => undefined);
  if (area === 'make') return Promise.all([loadProjects(), loadKept(), loadReverse(), loadPhotos()]);
  return Promise.resolve();
}

/** His school stage as Ghosty would say it: "I’m in Nursery at school", "I’m doing my GCSEs". */
function schoolStage(id: string, label: string): string {
  const said: Record<string, string> = {
    nursery: 'I’m in Nursery at school', reception: 'I’m in Reception at school', ks1: 'I’m in Key Stage 1 at school', ks2: 'I’m in Key Stage 2 at school',
    ks3: 'I’m in Key Stage 3 at school', gcse: 'I’m doing my GCSEs', alevel: 'I’m doing my A-levels', university: 'I’m at university', library: 'I’m reading the whole library',
  };
  return said[id] ?? `I’m at the ${label} stage at school`;
}

/** When an event is, in a sentence: "in 25 min", "at 15:30", "tomorrow at 09:00", "on Mon at 09:00". */
function whenWords(ms: number): string {
  const u = until(ms);
  if (/min$|h$/.test(u)) return `in ${u}`;
  if (/^Tomorrow /.test(u)) return `tomorrow at ${u.slice(9)}`;
  if (/^\d\d:\d\d$/.test(u)) return `at ${u}`;
  const [d, t] = u.split(' ');
  return `on ${d} at ${t}`;
}
