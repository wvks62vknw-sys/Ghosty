/**
 * NIGHT SCHOOL (BRIEF-NIGHT-SCHOOL part A): one switch and a time window on UK time. While it is on, the phone is open
 * on Ghosty, plugged in and inside the window, the phone works through one plan in order, each part with its own
 * stopping point:
 *   1. SCHOOL PRACTICE — his weak spots at his stage (practice the brain wrote and checked twice; what he gets wrong is
 *      put first in the next week's training), answered by the offline brain: stops when the night's questions
 *      (at most NIGHT_LIMITS.practice) are answered, or with none waiting, or without the offline brain;
 *   2. GYM — TRAIN ALL, the least mastered game first: stops after NIGHT_LIMITS.gymMs, with every game mastered, or
 *      when only NIGHT_LIMITS.studyMs of the window is left (that last stretch is the library's);
 *   3. STUDY — STUDY ALL, the library's queue (read by the brain; the phone asks for a session every few minutes):
 *      until the window ends or there is nothing left to read.
 * Then a morning report ("Last night: 40 practice questions (31 right), maze to level 4, 312 passages read").
 * Honest about the iPhone: nothing runs with the screen off; closing Ghosty or locking the phone pauses the plan.
 * Pure (no DOM, no storage): the phone runs it (apps/web/src/night), the brain keeps the switch and the window, runs its
 * own parts in the same window and files the report (apps/edge/src/school/night.ts). Tested in apps/edge/test/night.test.mjs.
 */

/** Night School keeps UK time, whatever zone the phone or the brain is in. */
export const NIGHT_TZ = 'Europe/London';

export interface NightSettings {
  on: boolean;
  /** "23:00": the window's start and end on UK time (a window past midnight wraps). */
  from: string;
  to: string;
}

export const NIGHT_DEFAULTS: NightSettings = { on: false, from: '23:00', to: '06:00' };

export const NIGHT_PARTS = ['school', 'gym', 'study'] as const;
export type NightPart = (typeof NIGHT_PARTS)[number];
export const PART_LABEL: Record<NightPart, string> = { school: 'school practice', gym: 'gym', study: 'study' };

/** The stopping points: questions a night, the gym's time, the stretch at the end of the window kept for study. */
export const NIGHT_LIMITS = { practice: 40, gymMs: 3 * 3600_000, studyMs: 3600_000 };

// ---- the clock (UK time, across the clock changes) ---------------------------------------------------------------

export interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
}

const fmts = new Map<string, Intl.DateTimeFormat>();
/** The wall clock in `tz` at `ms`. */
export function wall(ms: number, tz = NIGHT_TZ): Wall {
  let f = fmts.get(tz);
  if (!f) fmts.set(tz, (f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })));
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour! % 24, mi: +p.minute! };
}

const offsetAt = (ms: number, tz: string) => {
  const w = wall(ms, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) - Math.floor(ms / 60_000) * 60_000;
};

/** A wall-clock time in `tz` → UTC ms (fields roll over: day 32 is the next month's 1st). */
export function wallToUtc(y: number, m: number, d: number, h: number, mi: number, tz = NIGHT_TZ): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const o1 = offsetAt(guess, tz);
  const t = guess - o1;
  const o2 = offsetAt(t, tz);
  return o2 === o1 ? t : guess - o2;
}

/** "23:00" → minutes after midnight, or null when it is not a time. */
export function minutesOf(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Settings as given, checked: times that are not times (or a window of no length) fall back to the defaults. */
export function cleanSettings(x: Partial<NightSettings> | null | undefined): NightSettings {
  const from = minutesOf(x?.from ?? '') === null ? NIGHT_DEFAULTS.from : String(x!.from).trim();
  const to = minutesOf(x?.to ?? '') === null ? NIGHT_DEFAULTS.to : String(x!.to).trim();
  return from === to ? { ...NIGHT_DEFAULTS, on: !!x?.on } : { on: !!x?.on, from, to };
}

const ymd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

/**
 * The window `ms` is in (`inside`), or else the next one: its night (the UK date it starts on: the night of the 24th runs
 * 23:00 on the 24th to 06:00 on the 25th) and its start and end in UTC ms. Wall-clock times, so on the night the
 * clocks go back the window is an hour longer, and on the night they go forward an hour shorter.
 */
export function nightWindow(ms: number, s: Pick<NightSettings, 'from' | 'to'>): { night: string; start: number; end: number; inside: boolean } {
  const c = cleanSettings({ ...s, on: true });
  const from = minutesOf(c.from)!;
  const to = minutesOf(c.to)!;
  const w = wall(ms);
  const now = w.h * 60 + w.mi;
  const at = (dayShift: number, min: number) => wallToUtc(w.y, w.m, w.d + dayShift, Math.floor(min / 60), min % 60);
  const win = (startDay: number) => {
    const start = at(startDay, from);
    const end = at(from < to ? startDay : startDay + 1, to);
    return { night: ymd(w.y, w.m, w.d + startDay), start, end, inside: ms >= start && ms < end };
  };
  if (from < to) return now < to ? win(0) : win(1);
  // past midnight: before the end it is last night's window; after the start, tonight's
  return now < to ? win(-1) : win(0);
}

export const inWindow = (ms: number, s: Pick<NightSettings, 'from' | 'to'>): boolean => nightWindow(ms, s).inside;

/** "02:14" on UK time. */
export function clockText(ms: number): string {
  const w = wall(ms);
  return `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`;
}

// ---- the plan --------------------------------------------------------------------------------------------------

/** One night's run on the phone: where the plan is, and what each part did. */
export interface NightRun {
  night: string;
  startedAt: number;
  part: NightPart | 'done';
  /** Why each part ended or was passed over (a part that has ended stays ended). */
  ended: Partial<Record<NightPart, string>>;
  /** School practice: answered, handed out tonight (0 before they are asked for), right; the questions answered. */
  school: { n: number; of: number; right: number; asked: boolean; done: string[] };
  /** GYM: its training time tonight, each game's level when the gym part began and now, the games mastered tonight. */
  gym: { ms: number; from: Record<string, number>; to: Record<string, number>; mastered: string[] };
  /** STUDY: the library's passages read when the study part began (null before), and since. */
  study: { from: number | null; read: number };
  reported?: boolean;
}

export const newNight = (night: string, now: number): NightRun => ({
  night,
  startedAt: now,
  part: 'school',
  ended: {},
  school: { n: 0, of: 0, right: 0, asked: false, done: [] },
  gym: { ms: 0, from: {}, to: {}, mastered: [] },
  study: { from: null, read: 0 },
});

/** What the phone knows right now, for the stopping points. */
export interface NightCtx {
  now: number;
  /** When the window ends (UTC ms). */
  end: number;
  /** The offline brain is on this phone (school practice needs it). */
  offline: boolean;
  /** A game is not mastered yet. */
  gymLeft: boolean;
  /** Self-study is on and a field is still unread. */
  studyLeft: boolean;
}

/** Why `part` stops now (its stopping point), or '' while it goes on. */
export function stopWhy(run: NightRun, part: NightPart, c: NightCtx): string {
  if (c.now >= c.end) return 'the night is over';
  if (part === 'school') {
    if (!c.offline) return "the offline brain isn't on this phone";
    if (run.school.asked && !run.school.of) return 'no practice waiting';
    if (run.school.of && run.school.n >= run.school.of) return `${run.school.n} of ${run.school.of} answered`;
    return '';
  }
  if (part === 'gym') {
    if (!c.gymLeft) return 'every game mastered';
    if (run.gym.ms >= NIGHT_LIMITS.gymMs) return `${Math.round(NIGHT_LIMITS.gymMs / 3600_000)} hours of gym`;
    if (c.end - c.now <= NIGHT_LIMITS.studyMs) return 'the last hour is for study';
    return '';
  }
  return c.studyLeft ? '' : 'nothing left to read';
}

/** The plan moved on: the first part, in order, that has not reached its stopping point ('done' when none has). */
export function advance(run: NightRun, c: NightCtx): NightRun {
  const ended = { ...run.ended };
  let part: NightRun['part'] = 'done';
  for (const p of NIGHT_PARTS) {
    if (ended[p]) continue;
    const why = stopWhy(run, p, c);
    if (!why) {
      part = p;
      break;
    }
    ended[p] = why;
  }
  return { ...run, ended, part };
}

/** The part after `part` that has not ended, or null. */
const nextAfter = (run: NightRun, part: NightPart): NightPart | null => NIGHT_PARTS.slice(NIGHT_PARTS.indexOf(part) + 1).find((p) => !run.ended[p]) ?? null;

/**
 * The live line: "Night School · 02:14 · school practice 18 of 40 · gym next", "Night School · 01:05 · gym: maze level 4 ·
 * study next", "Night School · 04:40 · study: 120 passages read · until 06:00". `gym`: the game in training and its level.
 */
export function progressLine(run: NightRun, now: number, s: Pick<NightSettings, 'to'>, gym = ''): string {
  const head = `Night School · ${clockText(now)}`;
  if (run.part === 'done') return `${head} · done for tonight`;
  const next = nextAfter(run, run.part);
  const tail = next ? `${PART_LABEL[next]} next` : `until ${s.to}`;
  if (run.part === 'school') return `${head} · ${run.school.of ? `school practice ${run.school.n} of ${run.school.of}` : 'school practice: getting the questions'} · ${tail}`;
  if (run.part === 'gym') return `${head} · gym: ${gym || 'starting'} · ${tail}`;
  return `${head} · study: ${run.study.read} passage${run.study.read === 1 ? '' : 's'} read · ${tail}`;
}

/** "1 h 12 min", "40 min". */
const span = (ms: number) => {
  const min = Math.round(ms / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`;
};

/**
 * The morning report: "Last night: 40 practice questions (31 right), maze to level 4, 312 passages read". `names`: each
 * game's name as the owner sees it ("maze"). Only what happened is said; nothing at all says so.
 */
export function morningReport(run: NightRun, names: Record<string, string> = {}): string {
  const bits: string[] = [];
  if (run.school.n) bits.push(`${run.school.n} practice question${run.school.n === 1 ? '' : 's'} (${run.school.right} right)`);
  const name = (id: string) => names[id] ?? id;
  const ups = Object.entries(run.gym.to)
    .filter(([id, lv]) => run.gym.mastered.includes(id) || lv > (run.gym.from[id] ?? lv))
    .map(([id, lv]) => (run.gym.mastered.includes(id) ? `${name(id)} mastered` : `${name(id)} to level ${lv}`));
  if (ups.length) bits.push(...ups.slice(0, 3), ...(ups.length > 3 ? [`${ups.length - 3} more game${ups.length === 4 ? '' : 's'} up a level`] : []));
  else if (run.gym.ms >= 60_000) bits.push(`${span(run.gym.ms)} in the gym (no new level)`);
  if (run.study.read) bits.push(`${run.study.read} passage${run.study.read === 1 ? '' : 's'} read`);
  return bits.length ? `Last night: ${bits.join(', ')}` : 'Last night: nothing ran on the phone';
}

/** The brain's report when the phone sent none (it was not open on Ghosty): only its own part ran. */
export function brainReport(b: { practice: number; read: number }): string {
  const bits = [b.practice ? `${b.practice} practice question${b.practice === 1 ? '' : 's'} written and checked` : '', b.read ? `${b.read} passage${b.read === 1 ? '' : 's'} read` : ''].filter(Boolean);
  return `Last night: the phone was not open on Ghosty, so only the brain's part ran${bits.length ? `: ${bits.join(', ')}` : ' (nothing new)'}`;
}
