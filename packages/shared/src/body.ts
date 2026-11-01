/**
 * THE BODY PACK, the pure parts (BRIEF-PACKS-1 item 2): reps counted from the phone's pose model (squats, push-ups, star
 * jumps), a run's distance, pace and kilometre splits from the phone's own GPS (the positions never leave the phone: only
 * the summary does, after RUN SAVED), steps and sleep from an Apple Health export read on the phone, water, weight's trend,
 * a rest day, the hourly stand-up, box breathing and a stretch set. Facts only from what he gives; never a diagnosis —
 * "not medical advice" goes with any number that could be read as one. No storage, no network here.
 */
import { card, type Card } from './cards';
import { addDays, daysBetween, kmBetween, prettyDay } from './packs';

export const NOT_ADVICE = 'Not medical advice.';

// ---------------------------------------------------------------- reps by camera

/** One landmark of MediaPipe's pose model: x and y from 0 to 1 across the picture, how sure it is it can see it. */
export interface Mark {
  x: number;
  y: number;
  visibility?: number;
}
export type Exercise = 'squats' | 'pushups' | 'jacks';
export const EXERCISES: { id: Exercise; label: string; say: string }[] = [
  { id: 'squats', label: 'Squats', say: 'squats' },
  { id: 'pushups', label: 'Push-ups', say: 'push-ups' },
  { id: 'jacks', label: 'Star jumps', say: 'star jumps' },
];
/** Which exercise his words mean ("count my push ups", "star jumps", "jumping jacks"); squats by default. */
export const exerciseOf = (words: string): Exercise => (/push[ -]?ups?|press[ -]?ups?/i.test(words) ? 'pushups' : /star ?jumps?|jumping ?jacks?|jacks/i.test(words) ? 'jacks' : 'squats');

// MediaPipe's 33 points: the ones that count
const L = { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 };
const R = { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28 };
const SEEN = 0.5;

/** The angle at `b` (degrees) between a–b–c, x stretched by the picture's shape so a right angle is a right angle. */
export function angleAt(a: Mark, b: Mark, c: Mark, aspect = 1): number {
  const v1 = { x: (a.x - b.x) * aspect, y: a.y - b.y };
  const v2 = { x: (c.x - b.x) * aspect, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}
const seen = (m: Mark | undefined): m is Mark => !!m && (m.visibility ?? 1) >= SEEN;

/** The joint angle for an exercise, from whichever side the camera sees best (null: not enough of him in view). */
function jointAngle(ex: Exercise, p: Mark[], aspect: number): number | null {
  const sides = [L, R].map((s) => (ex === 'squats' ? [p[s.hip], p[s.kn], p[s.an]] : [p[s.sh], p[s.el], p[s.wr]]));
  const ok = sides.filter((t) => t.every(seen)) as Mark[][];
  if (!ok.length) return null;
  return ok.map((t) => angleAt(t[0]!, t[1]!, t[2]!, aspect)).reduce((a, b) => a + b, 0) / ok.length;
}

/** Star jumps: open (hands above shoulders, feet wide) or closed (hands down, feet together); null in between or unseen. */
function jackPose(p: Mark[], aspect: number): 'open' | 'closed' | null {
  const need = [L.sh, R.sh, L.wr, R.wr, L.hip, R.hip, L.an, R.an].map((i) => p[i]);
  if (!need.every(seen)) return null;
  const [ls, rs, lw, rw, lh, rh, la, ra] = need as Mark[];
  const hips = Math.abs(lh!.x - rh!.x) * aspect || 0.01;
  const feet = Math.abs(la!.x - ra!.x) * aspect;
  const up = lw!.y < ls!.y && rw!.y < rs!.y;
  const down = lw!.y > ls!.y && rw!.y > rs!.y;
  if (up && feet > hips * 1.6) return 'open';
  if (down && feet < hips * 1.3) return 'closed';
  return null;
}

export interface RepState {
  ex: Exercise;
  n: number;
  /** Where he is in the movement: up (start), down (the bottom of a squat or push-up; open for a star jump). */
  phase: 'up' | 'down';
  last: number;
  /** Frames in a row he was out of view. */
  lost: number;
}
export const repStart = (ex: Exercise): RepState => ({ ex, n: 0, phase: 'up', last: -1e9, lost: 0 });

/** The thresholds (degrees): down below the first, back up above the second; a rep needs both, and 0.4 s since the last. */
export const REP_ANGLES: Record<Exercise, [number, number]> = { squats: [100, 160], pushups: [95, 155], jacks: [0, 0] };
const MIN_GAP_MS = 400;

/**
 * One frame of the pose model: the state moves on, and `rep` is true on the frame a repetition completes (back at the top).
 * `hint` is what to say when he is out of view for a second (30 frames).
 */
export function repStep(s: RepState, p: Mark[] | null, t: number, aspect = 1): { s: RepState; rep: boolean; hint?: string } {
  if (!p || p.length < 29) return lostFrame(s);
  if (s.ex === 'jacks') {
    const pose = jackPose(p, aspect);
    if (!pose) return lostFrame(s);
    if (pose === 'open' && s.phase === 'up') return { s: { ...s, phase: 'down', lost: 0 }, rep: false };
    if (pose === 'closed' && s.phase === 'down' && t - s.last >= MIN_GAP_MS) return { s: { ...s, phase: 'up', n: s.n + 1, last: t, lost: 0 }, rep: true };
    return { s: { ...s, lost: 0 }, rep: false };
  }
  const a = jointAngle(s.ex, p, aspect);
  if (a === null) return lostFrame(s);
  const [down, up] = REP_ANGLES[s.ex];
  if (s.phase === 'up' && a < down) return { s: { ...s, phase: 'down', lost: 0 }, rep: false };
  if (s.phase === 'down' && a > up && t - s.last >= MIN_GAP_MS) return { s: { ...s, phase: 'up', n: s.n + 1, last: t, lost: 0 }, rep: true };
  return { s: { ...s, lost: 0 }, rep: false };
}
function lostFrame(s: RepState): { s: RepState; rep: boolean; hint?: string } {
  const lost = s.lost + 1;
  return { s: { ...s, lost }, rep: false, ...(lost === 30 ? { hint: s.ex === 'pushups' ? 'Side on to the camera, so it sees your arms.' : 'Step back so the camera sees all of you.' } : {}) };
}

export function repsCard(ex: Exercise, n: number, secs: number, at = Date.now()): Card {
  const name = EXERCISES.find((e) => e.id === ex)!.label;
  return card({ id: `body:reps:${ex}:${at}`, kind: 'progress', at, title: `${n} ${name.toLowerCase()}`, line: `Counted by the camera on your phone in ${clock(secs)}; nothing left it`, progress: { frac: Math.min(1, n / 20) }, acts: [{ label: 'AGAIN', run: { name: 'open_body', args: { what: 'reps', exercise: ex } } }] });
}

// ---------------------------------------------------------------- the running coach

export interface Fix {
  lat: number;
  lon: number;
  t: number;
  /** Metres, as the phone says. */
  acc?: number;
}
export interface RunState {
  km: number;
  secs: number;
  last: Fix | null;
  /** The seconds at each whole kilometre. */
  splits: number[];
  start: number;
  /** The last 30 seconds, for the pace now. */
  recent: { km: number; t: number }[];
}
export const runStart = (t: number): RunState => ({ km: 0, secs: 0, last: null, splits: [], start: t, recent: [] });

/**
 * One GPS fix: a poor one (over 30 m) or a jump no runner makes (over 12 m a second) is left out; the distance moves on in a
 * straight line from the last good fix. `split` is set on the fix that passes a whole kilometre: which, and its time.
 */
export function runStep(s: RunState, f: Fix): { s: RunState; split?: { n: number; secs: number } } {
  if ((f.acc ?? 0) > 30) return { s };
  if (!s.last) return { s: { ...s, last: f } };
  const dkm = kmBetween(s.last, f);
  const dt = (f.t - s.last.t) / 1000;
  if (dt <= 0 || (dkm * 1000) / dt > 12) return { s };
  const km = s.km + dkm;
  const secs = (f.t - s.start) / 1000;
  const recent = [...s.recent, { km, t: f.t }].filter((r) => f.t - r.t <= 30_000);
  const next: RunState = { ...s, km, secs, last: f, recent };
  if (Math.floor(km) > s.splits.length) {
    // the moment the kilometre was passed, between the two fixes
    const n = Math.floor(km);
    const at = (s.last.t - s.start) / 1000 + (dt * (n - s.km)) / (dkm || 1);
    const prev = s.splits.length ? s.splits[s.splits.length - 1]! : 0;
    next.splits = [...s.splits, Math.round(at)];
    return { s: next, split: { n, secs: Math.round(at - prev) } };
  }
  return { s: next };
}
/** Seconds a kilometre, now (the last 30 seconds) and on average; null before there is enough. */
export function paces(s: RunState): { now: number | null; avg: number | null } {
  const r = s.recent;
  const now = r.length >= 2 && r[r.length - 1]!.km - r[0]!.km > 0.02 ? (r[r.length - 1]!.t - r[0]!.t) / 1000 / (r[r.length - 1]!.km - r[0]!.km) : null;
  return { now, avg: s.km > 0.05 ? s.secs / s.km : null };
}
/** "5:32" from seconds; "1:02:10" past the hour. */
export function clock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
/** What he hears each kilometre: "2 kilometres in 11 minutes 4. That one took 5 minutes 32." */
export function splitWords(n: number, total: number, split: number): string {
  const mins = (x: number) => `${Math.floor(x / 60)} minute${Math.floor(x / 60) === 1 ? '' : 's'}${x % 60 ? ` ${Math.round(x % 60)}` : ''}`;
  return `${n} kilometre${n === 1 ? '' : 's'} in ${mins(Math.round(total))}. That one took ${mins(Math.round(split))}.`;
}
/** What the brain keeps of a run after RUN SAVED: the distance, the time, the splits. Never a position. */
export interface RunSummary {
  km: number;
  secs: number;
  splits: number[];
}
export const runSummary = (s: RunState): RunSummary => ({ km: Math.round(s.km * 100) / 100, secs: Math.round(s.secs), splits: s.splits.map((x, i) => x - (i ? s.splits[i - 1]! : 0)) });
export function runCard(r: RunSummary, at = Date.now()): Card {
  const pace = r.km > 0 ? r.secs / r.km : 0;
  return card({ id: `body:run:${at}`, kind: 'progress', at, title: `Run ${r.km.toFixed(2)} km`, line: `${clock(r.secs)} · ${pace ? `${clock(pace)} a km` : 'no pace yet'}${r.splits.length ? ` · fastest km ${clock(Math.min(...r.splits))}` : ''}`, progress: { frac: Math.min(1, r.km / 5) }, acts: [{ label: 'RUN AGAIN', run: { name: 'open_body', args: { what: 'run' } } }] });
}

// ---------------------------------------------------------------- steps and sleep from an Apple Health export

export interface HealthAcc {
  from: string;
  to: string;
  /** Steps by day, then by the device that counted them (iPhone and Watch both count: the larger is used). */
  steps: Record<string, Record<string, number>>;
  /** Asleep spans (ms) by the day he woke. */
  sleep: Record<string, [number, number][]>;
  records: number;
}
export const healthStart = (today: string, days = 7): HealthAcc => ({ from: addDays(today, -(days - 1)), to: today, steps: {}, sleep: {}, records: 0 });

const ATTR = (el: string, name: string): string => new RegExp(`\\b${name}="([^"]*)"`).exec(el)?.[1] ?? '';
/** "2026-10-25 08:00:00 +0100" → ms. */
const healthTime = (s: string): number => Date.parse(s.replace(' ', 'T').replace(' ', ''));
const ASLEEP = /HKCategoryValueSleepAnalysisAsleep/;

/** One `<Record …>` element of export.xml (any other line is passed over): steps and asleep spans in his week. */
export function feedHealth(acc: HealthAcc, el: string): void {
  if (!el.includes('<Record ')) return;
  const type = ATTR(el, 'type');
  if (type !== 'HKQuantityTypeIdentifierStepCount' && type !== 'HKCategoryTypeIdentifierSleepAnalysis') return;
  const end = ATTR(el, 'endDate');
  const day = end.slice(0, 10);
  if (day < acc.from || day > acc.to) return;
  acc.records++;
  if (type === 'HKQuantityTypeIdentifierStepCount') {
    const start = ATTR(el, 'startDate').slice(0, 10);
    const n = Number(ATTR(el, 'value'));
    if (!Number.isFinite(n) || start !== day) return;
    const src = ATTR(el, 'sourceName') || 'phone';
    const d = (acc.steps[day] ??= {});
    d[src] = (d[src] ?? 0) + n;
  } else if (ASLEEP.test(ATTR(el, 'value'))) {
    const a = healthTime(ATTR(el, 'startDate'));
    const b = healthTime(end);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a && b - a < 16 * 3_600_000) (acc.sleep[day] ??= []).push([a, b]);
  }
}
/** Spans merged where they overlap (the Watch and the phone both write sleep): the minutes asleep. */
export function asleepMinutes(spans: [number, number][]): number {
  const s = [...spans].sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const sp of s) {
    if (cur && sp[0] <= cur[1]) cur[1] = Math.max(cur[1], sp[1]);
    else {
      if (cur) total += cur[1] - cur[0];
      cur = [sp[0], sp[1]];
    }
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total / 60_000);
}
export interface HealthWeek {
  from: string;
  to: string;
  days: { d: string; steps: number | null; sleep: number | null }[];
  avgSteps: number | null;
  avgSleep: number | null;
}
/** The last day of the export with steps or sleep in it (the export may be days old): the week ends there. */
export const latestDay = (acc: HealthAcc): string => [...Object.keys(acc.steps), ...Object.keys(acc.sleep)].sort().pop() ?? acc.to;
/** The seven days that end on `to` (by default the export's last day with anything in it). */
export function healthWeek(acc: HealthAcc, to = latestDay(acc)): HealthWeek {
  const days: HealthWeek['days'] = [];
  const from = addDays(to, -6) > acc.from ? addDays(to, -6) : acc.from;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const st = acc.steps[d];
    const sl = acc.sleep[d];
    days.push({ d, steps: st ? Math.round(Math.max(...Object.values(st))) : null, sleep: sl?.length ? asleepMinutes(sl) : null });
  }
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return { from, to, days, avgSteps: avg(days.map((x) => x.steps)), avgSleep: avg(days.map((x) => x.sleep)) };
}
export const hoursText = (min: number): string => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
export function stepsWords(w: HealthWeek): string {
  if (w.avgSteps === null) return `No steps in your Health export for ${prettyDay(w.from)} to ${prettyDay(w.to)}.`;
  const best = [...w.days].filter((x) => x.steps !== null).sort((a, b) => b.steps! - a.steps!)[0]!;
  return `Steps, ${prettyDay(w.from)} to ${prettyDay(w.to)}: ${w.avgSteps.toLocaleString('en-GB')} a day on average; most on ${prettyDay(best.d)} (${best.steps!.toLocaleString('en-GB')}). From your Health export (the larger of your iPhone’s and your Watch’s count each day). ${NOT_ADVICE}`;
}
export function sleepWords(w: HealthWeek): string {
  if (w.avgSleep === null) return `No sleep in your Health export for ${prettyDay(w.from)} to ${prettyDay(w.to)} (it needs a Watch, or Sleep set up in Health).`;
  const nights = w.days.filter((x) => x.sleep !== null);
  const short = [...nights].sort((a, b) => a.sleep! - b.sleep!)[0]!;
  return `Sleep, ${nights.length} night${nights.length === 1 ? '' : 's'} to ${prettyDay(w.to)}: ${hoursText(w.avgSleep)} a night on average; shortest the night before ${prettyDay(short.d)} (${hoursText(short.sleep!)}). Asleep time as Health recorded it, overlaps counted once. ${NOT_ADVICE}`;
}
export function healthCard(w: HealthWeek, at = Date.now()): Card {
  return card({ id: `body:health:${w.to}`, kind: 'brief', at, title: 'Your week in Health', line: `${w.avgSteps !== null ? `${w.avgSteps.toLocaleString('en-GB')} steps a day` : 'no steps'} · ${w.avgSleep !== null ? `${hoursText(w.avgSleep)} sleep a night` : 'no sleep data'}`, brief: { icon: 'morning' }, acts: [{ label: 'OPEN', run: { name: 'open_body', args: { what: 'health' } } }] });
}

// ---------------------------------------------------------------- water, weight, rest, stand-up

/** Glasses in his words ("a glass", "2 glasses", "500ml", "a pint"): a glass is 250 ml. */
export function glassesIn(words: string): number {
  const w = words.toLowerCase();
  const ml = /(\d+(?:\.\d+)?)\s?(ml|l|litres?|liters?)\b/.exec(w);
  if (ml) return Math.max(1, Math.round((Number(ml[1]) * (ml[2] === 'ml' ? 1 : 1000)) / 250));
  if (/\bpint\b/.test(w)) return 2;
  const n = /(\d+|two|three|four|five)\s+(?:glass|glasses|cups?|bottles?)/.exec(w)?.[1];
  if (n) return Number(n) || ['two', 'three', 'four', 'five'].indexOf(n) + 2;
  return 1;
}
export const WATER_GOAL = 8;
export const waterLine = (n: number, goal: number): string => `Water: ${n} of ${goal} glass${goal === 1 ? '' : 'es'} today`;

/** Kilograms in his words: "82.5 kg", "13 stone 4", "13st 4lb", "182 lb". null when there is no weight. */
export function kgIn(words: string): number | null {
  const w = words.toLowerCase();
  const st = /(\d+(?:\.\d+)?)\s*(?:stones?|st)\b\s*(?:(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)?)?/.exec(w);
  if (st) return Math.round((Number(st[1]) * 6.35029 + Number(st[2] ?? 0) * 0.453592) * 10) / 10;
  const lb = /(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/.exec(w);
  if (lb) return Math.round(Number(lb[1]) * 0.453592 * 10) / 10;
  const kg = /(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b/.exec(w) ?? /\bweigh(?:t|s|ed)?\b\D*(\d{2,3}(?:\.\d)?)\b/.exec(w);
  if (kg) return Number(kg[1]);
  return null;
}
/** Weight's trend: the last week's average against the week two weeks before; the change said gently, never judged. */
export function weightTrend(list: { d: string; kg: number }[], today: string): { now: number | null; before: number | null; line: string } {
  const avg = (from: string, to: string) => {
    const v = list.filter((x) => x.d >= from && x.d <= to).map((x) => x.kg);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const now = avg(addDays(today, -6), today);
  const before = avg(addDays(today, -20), addDays(today, -14));
  if (now === null) return { now, before, line: 'No weight in the last week. Tell me it any time ("I weigh 82.5 kg") and I keep the trend.' };
  if (before === null) return { now, before, line: `This week: ${now} kg on average. Tell me again over the next weeks and I show the trend. ${NOT_ADVICE}` };
  const d = Math.round((now - before) * 10) / 10;
  return { now, before, line: `This week ${now} kg on average, ${Math.abs(d) < 0.2 ? 'about the same as' : `${Math.abs(d)} kg ${d < 0 ? 'less' : 'more'} than`} two weeks before (${before} kg). Day to day a kilo either way is normal (water, food). ${NOT_ADVICE}` };
}

export interface Workout {
  d: string;
  kind: 'reps' | 'run' | 'stretch' | 'other';
  what: string;
  n?: number;
  km?: number;
  secs?: number;
}
/** "did 30 push-ups", "ran 5k in 28 minutes", "stretched", "went to the gym" → a workout. */
export function workoutIn(words: string, today: string): Workout | null {
  const w = words.toLowerCase();
  const d = /\byesterday\b/.test(w) ? addDays(today, -1) : today;
  const ran = /\bran\s+(\d+(?:\.\d+)?)\s*(k|km|kilomet(?:re|er)s?|miles?)\b(?:.*?\bin\s+(\d+)\s*(?:min|minutes))?/.exec(w);
  if (ran) return { d, kind: 'run', what: 'a run', km: Number(ran[1]) * (/mile/.test(ran[2]!) ? 1.609344 : 1), ...(ran[3] ? { secs: Number(ran[3]) * 60 } : {}) };
  const reps = /\b(\d+)\s+(squats?|push[ -]?ups?|press[ -]?ups?|star jumps?|jumping jacks?|sit[ -]?ups?|burpees?|lunges?|pull[ -]?ups?)\b/.exec(w);
  if (reps) return { d, kind: 'reps', what: reps[2]!.replace(/s?$/, 's'), n: Number(reps[1]) };
  if (/\bstretch(?:ed|es|ing)?\b|\byoga\b/.test(w)) return { d, kind: 'stretch', what: 'stretching' };
  if (/\b(gym|workout|trained|training|swim|swam|football|cycled|bike ride|walked|hike)\b/.test(w)) return { d, kind: 'other', what: (/\b(gym|workout|swim|swam|football|cycled|bike ride|walked|hike)\b/.exec(w)?.[1] ?? 'a workout') };
  return null;
}
/** The rest-day line: days in a row he trained up to today (or yesterday), and when the last rest was. */
export function restLine(log: Workout[], today: string): string {
  const days = new Set(log.map((x) => x.d));
  let run = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    run++;
    d = addDays(d, -1);
  }
  if (!log.length) return 'Nothing logged yet: tell me what you did ("did 30 push-ups") or count them with the camera.';
  if (run >= 4) return `You’ve trained ${run} days in a row: a rest day helps the body come back stronger. A walk or the stretch set still counts as rest.`;
  if (run === 0) {
    const lastDay = [...days].sort().pop()!;
    const gap = daysBetween(lastDay, today);
    return gap <= 2 ? 'You rested yesterday: good to go today.' : `Your last workout I know of was ${gap} days ago (${prettyDay(lastDay)}).`;
  }
  return `${run} day${run === 1 ? '' : 's'} in a row so far: fine to train today; think about a rest day after ${4 - run} more.`;
}

export interface StandSet {
  on: boolean;
  from: number;
  to: number;
}
export const STAND_DEFAULT: StandSet = { on: false, from: 9, to: 17 };
/** Is this hour (on his clock) one for a stand-up nudge: on, a weekday, inside his hours, on the hour's first half. */
export const standDue = (s: StandSet, hour: number, weekday: number): boolean => s.on && weekday >= 1 && weekday <= 5 && hour >= s.from && hour < s.to;

// ---------------------------------------------------------------- breathing and stretching

export const BREATHS: Record<'box' | '478', { label: string; phases: { say: string; secs: number }[] }> = {
  box: { label: 'Box 4-4-4-4', phases: [{ say: 'Breathe in', secs: 4 }, { say: 'Hold', secs: 4 }, { say: 'Breathe out', secs: 4 }, { say: 'Hold', secs: 4 }] },
  '478': { label: '4-7-8', phases: [{ say: 'Breathe in', secs: 4 }, { say: 'Hold', secs: 7 }, { say: 'Breathe out', secs: 8 }] },
};
/** Where a breathing pattern is `ms` in: the phase, its seconds left, the round (from 1), and its share done. */
export function breathAt(kind: 'box' | '478', ms: number): { say: string; left: number; round: number; i: number; frac: number } {
  const p = BREATHS[kind].phases;
  const cycle = p.reduce((a, x) => a + x.secs, 0) * 1000;
  const round = Math.floor(ms / cycle) + 1;
  let t = ms % cycle;
  for (let i = 0; i < p.length; i++) {
    const len = p[i]!.secs * 1000;
    if (t < len) return { say: p[i]!.say, left: Math.ceil((len - t) / 1000), round, i, frac: t / len };
    t -= len;
  }
  return { say: p[0]!.say, left: p[0]!.secs, round, i: 0, frac: 0 };
}

export const STRETCHES: { name: string; cue: string; secs: number }[] = [
  { name: 'Neck rolls', cue: 'Slow half circles, ear to shoulder, chin to chest. Never right round the back.', secs: 30 },
  { name: 'Shoulder rolls', cue: 'Big circles backwards, then forwards.', secs: 30 },
  { name: 'Chest opener', cue: 'Hands clasped behind you, squeeze the shoulder blades, lift the chest.', secs: 30 },
  { name: 'Quad stretch, left', cue: 'Hold your left ankle behind you, knees together. Hold a wall if you need.', secs: 30 },
  { name: 'Quad stretch, right', cue: 'Hold your right ankle behind you, knees together.', secs: 30 },
  { name: 'Hamstring reach', cue: 'One heel forward, leg straight, hinge at the hips. Swap halfway.', secs: 40 },
  { name: 'Calf stretch', cue: 'Hands on a wall, one leg back, heel down. Swap halfway.', secs: 40 },
  { name: 'Hip flexor lunge', cue: 'Low lunge, back knee down, tuck the hips under. Swap halfway.', secs: 40 },
];
/** Where the stretch set is after `secs`: which stretch, its seconds left; done after the last. */
export function stretchAt(secs: number): { i: number; left: number; done: boolean } {
  let t = secs;
  for (let i = 0; i < STRETCHES.length; i++) {
    if (t < STRETCHES[i]!.secs) return { i, left: Math.ceil(STRETCHES[i]!.secs - t), done: false };
    t -= STRETCHES[i]!.secs;
  }
  return { i: STRETCHES.length - 1, left: 0, done: true };
}
export const STRETCH_SECS = STRETCHES.reduce((a, s) => a + s.secs, 0);

// ---------------------------------------------------------------- what the chat opens on the phone, with no model

export type BodyAsk = { what: 'reps'; exercise: Exercise } | { what: 'run' } | { what: 'breathe'; pattern: 'box' | '478' } | { what: 'stretch' } | { what: 'water'; glasses: number };
const ASK_REPS = /^(?:count|watch|track) (?:my |me doing |me do |the )?(reps|squats?|push[ -]?ups?|press[ -]?ups?|star jumps?|jumping jacks?)[.!]?$/i;
const ASK_RUN = /^(?:start (?:a|my) run|running coach|start running|track my run|coach my run|i'?m going (?:for )?a run|go for a run)[.!]?$/i;
const ASK_BREATHE = /^(?:breathe|breathing|box breathing|4[ -]?7[ -]?8(?: breathing)?|help me breathe|breathe with me|calm me down|i need to calm down)[.!]?$/i;
const ASK_STRETCH = /^(?:stretch|stretches|stretch set|stretch with me|let'?s stretch|start (?:the|a) stretch(?:ing)? set)[.!]?$/i;
const ASK_WATER = /^(?:i )?(?:just )?(?:drank|had|drunk) (?:a|another|one|\d+|two|three) (?:glass|glasses|cups?|bottles?|pint)(?: of water)?[.!]?$|^(?:a |another )?glass of water[.!]?$/i;
/** "count my squats", "start a run", "breathe", "stretch with me", "had a glass of water": the phone does it, no model. */
export function bodyAsked(text: string): BodyAsk | null {
  const t = text.trim();
  let m = ASK_REPS.exec(t);
  if (m) return { what: 'reps', exercise: exerciseOf(m[1]!) };
  if (ASK_RUN.test(t)) return { what: 'run' };
  if (ASK_BREATHE.test(t)) return { what: 'breathe', pattern: /4[ -]?7[ -]?8/.test(t) ? '478' : 'box' };
  if (ASK_STRETCH.test(t)) return { what: 'stretch' };
  m = ASK_WATER.exec(t);
  if (m) return { what: 'water', glasses: glassesIn(t) };
  return null;
}
