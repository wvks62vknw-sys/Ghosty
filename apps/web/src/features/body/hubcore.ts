/**
 * HEALTH HUB, the pure parts (APPS ROUND, BODY lane): no page, so it can be checked on its own.
 *  - every Health type worth showing, read from an Apple Health export line by line (steps, distance, active energy, exercise and
 *    stand minutes, heart rate, resting heart rate, HRV, VO2 max, weight, blood pressure, breathing rate, sleep and its stages,
 *    workouts), each day kept once (steps and distance from the source that counted most, never the iPhone and Watch added);
 *  - the day's totals from the ready-made Shortcut, as text ("steps=8421, rhr=58, sleep=7.2 …"), never a route or a position;
 *  - activity rings, ranges from a week to all time, a smoothed weight trend;
 *  - plain highlights from his own history, said as what happened ("resting heart rate averaged 56 this month, 3 lower than the
 *    month before"), never advice and never a forecast. Not medical advice.
 */

export type HubKey = 'steps' | 'km' | 'kcal' | 'exercise' | 'stand' | 'hr' | 'rhr' | 'hrv' | 'vo2' | 'weight' | 'sys' | 'dia' | 'resp' | 'sleep' | 'deep' | 'rem' | 'core' | 'awake';
export interface HubMetric {
  key: HubKey;
  label: string;
  unit: string;
  /** How a day's records join: added up (steps), averaged (heart rate), or the day's lowest (resting heart rate) or last (weight). */
  join: 'sum' | 'avg' | 'last' | 'min';
  /** Decimal places shown. */
  dp: number;
  /** The smallest gap between months worth saying as a highlight. */
  notice: number;
}
export const HUB_METRICS: HubMetric[] = [
  { key: 'steps', label: 'Steps', unit: 'steps', join: 'sum', dp: 0, notice: 800 },
  { key: 'km', label: 'Walking and running', unit: 'km', join: 'sum', dp: 1, notice: 0.6 },
  { key: 'kcal', label: 'Active energy', unit: 'kcal', join: 'sum', dp: 0, notice: 60 },
  { key: 'exercise', label: 'Exercise', unit: 'min', join: 'sum', dp: 0, notice: 6 },
  { key: 'stand', label: 'Stand', unit: 'hours', join: 'sum', dp: 0, notice: 1 },
  { key: 'rhr', label: 'Resting heart rate', unit: 'bpm', join: 'min', dp: 0, notice: 2 },
  { key: 'hrv', label: 'Heart rate variability', unit: 'ms', join: 'avg', dp: 0, notice: 4 },
  { key: 'hr', label: 'Heart rate', unit: 'bpm', join: 'avg', dp: 0, notice: 3 },
  { key: 'vo2', label: 'Cardio fitness (VO2 max)', unit: 'ml/kg/min', join: 'last', dp: 1, notice: 0.8 },
  { key: 'resp', label: 'Breathing rate', unit: 'breaths/min', join: 'avg', dp: 1, notice: 0.8 },
  { key: 'sleep', label: 'Sleep', unit: 'hours', join: 'sum', dp: 1, notice: 0.3 },
  { key: 'weight', label: 'Weight', unit: 'kg', join: 'last', dp: 1, notice: 0.8 },
  { key: 'sys', label: 'Blood pressure', unit: 'mmHg', join: 'avg', dp: 0, notice: 4 },
];
export const metricOf = (k: HubKey): HubMetric => HUB_METRICS.find((m) => m.key === k) ?? { key: k, label: k, unit: '', join: 'sum', dp: 1, notice: 1 };
export const NOT_ADVICE_HUB = 'From your iPhone and Watch, read on this phone. What happened, never advice or a forecast, and not medical advice.';

export type HubDay = Partial<Record<HubKey, number>>;
export interface Workout {
  d: string;
  kind: string;
  min: number;
  km: number | null;
  kcal: number | null;
}
export interface HubData {
  v: 1;
  days: Record<string, HubDay>;
  workouts: Workout[];
  /** The last day an export was read to (only newer days are read next time). */
  through: string;
  /** Sample data shown on the first run, until his own arrives. */
  sample: boolean;
  /** When the Shortcut last sent the day (ms), and the export last read (ms). */
  lastShortcut: number;
  lastExport: number;
  goals: { move: number; exercise: number; stand: number };
}
export const emptyHub = (): HubData => ({ v: 1, days: {}, workouts: [], through: '', sample: false, lastShortcut: 0, lastExport: 0, goals: { move: 500, exercise: 30, stand: 12 } });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Reads what the phone kept, mending anything of the wrong shape. */
export function mendHub(raw: unknown): HubData {
  const out = emptyHub();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<HubData>;
  const keys = new Set<string>([...HUB_METRICS.map((m) => m.key), 'deep', 'rem', 'core', 'awake', 'dia']);
  for (const [d, v] of Object.entries(r.days ?? {})) {
    if (!DAY.test(d) || !v || typeof v !== 'object') continue;
    const day: HubDay = {};
    for (const [k, x] of Object.entries(v)) if (keys.has(k) && typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 1e6) day[k as HubKey] = x;
    out.days[d] = day;
  }
  out.workouts = (Array.isArray(r.workouts) ? r.workouts : []).filter((w) => w && DAY.test(String(w.d)) && typeof w.kind === 'string' && Number.isFinite(w.min)).slice(-500);
  out.through = DAY.test(String(r.through)) ? String(r.through) : '';
  out.sample = r.sample === true;
  out.lastShortcut = Number(r.lastShortcut) || 0;
  out.lastExport = Number(r.lastExport) || 0;
  const g = (r.goals ?? {}) as Partial<HubData['goals']>;
  out.goals = { move: g.move && g.move >= 100 && g.move <= 3000 ? g.move : 500, exercise: g.exercise && g.exercise >= 5 && g.exercise <= 300 ? g.exercise : 30, stand: g.stand && g.stand >= 1 && g.stand <= 24 ? g.stand : 12 };
  return out;
}

// ---------------------------------------------------------------- days

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d + n, 12).getTime());
}

// ---------------------------------------------------------------- the Shortcut's totals

const ALIAS: Record<string, HubKey> = {
  steps: 'steps', step: 'steps', km: 'km', distance: 'km', kcal: 'kcal', energy: 'kcal', active: 'kcal', move: 'kcal', ex: 'exercise', exercise: 'exercise', stand: 'stand',
  hr: 'hr', heart: 'hr', rhr: 'rhr', resting: 'rhr', hrv: 'hrv', vo2: 'vo2', vo2max: 'vo2', weight: 'weight', kg: 'weight', sys: 'sys', systolic: 'sys', dia: 'dia', diastolic: 'dia',
  resp: 'resp', breathing: 'resp', sleep: 'sleep', asleep: 'sleep', deep: 'deep', rem: 'rem', core: 'core', light: 'core', awake: 'awake',
};
/**
 * The Shortcut's text (what its automation sends in the link, or copies for one paste): "d=2026-11-14, steps=8421, rhr=58 …",
 * lines of "Steps: 8421", or JSON. Only these totals are read: anything else (a route, a place) is left out.
 */
export function parseTotals(text: string, today: string): { day: string; values: HubDay } | null {
  const t = text.trim();
  if (!t || t.length > 4000) return null;
  let pairs: [string, string][] = [];
  if (t.startsWith('{')) {
    try {
      pairs = Object.entries(JSON.parse(t) as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
    } catch {
      return null;
    }
  } else pairs = t.split(/[,;&\n]+/).map((p) => p.split(/[:=]/)).filter((p) => p.length >= 2).map((p) => [p[0]!, p.slice(1).join(':')]);
  let day = today;
  const values: HubDay = {};
  for (const [k0, v0] of pairs) {
    const k = k0.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const v = v0.trim();
    if ((k === 'd' || k === 'day' || k === 'date') && DAY.test(v.slice(0, 10))) {
      day = v.slice(0, 10);
      continue;
    }
    const key = ALIAS[k];
    const n = Number(v.replace(/[^\d.\-]/g, ''));
    if (key && v && Number.isFinite(n) && n >= 0 && n < 1e6) values[key] = n;
  }
  return Object.keys(values).length ? { day, values } : null;
}

// ---------------------------------------------------------------- the export, every type

const TYPE: Record<string, HubKey> = {
  HKQuantityTypeIdentifierStepCount: 'steps',
  HKQuantityTypeIdentifierDistanceWalkingRunning: 'km',
  HKQuantityTypeIdentifierActiveEnergyBurned: 'kcal',
  HKQuantityTypeIdentifierAppleExerciseTime: 'exercise',
  HKQuantityTypeIdentifierAppleStandTime: 'stand',
  HKQuantityTypeIdentifierHeartRate: 'hr',
  HKQuantityTypeIdentifierRestingHeartRate: 'rhr',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'hrv',
  HKQuantityTypeIdentifierVO2Max: 'vo2',
  HKQuantityTypeIdentifierBodyMass: 'weight',
  HKQuantityTypeIdentifierBloodPressureSystolic: 'sys',
  HKQuantityTypeIdentifierBloodPressureDiastolic: 'dia',
  HKQuantityTypeIdentifierRespiratoryRate: 'resp',
};
/** The words in an export line that are worth weighing (a quick test before the attributes are read). */
export const HUB_LINE = /<Record type="HK(?:Quantity|Category)TypeIdentifier(?:StepCount|DistanceWalkingRunning|ActiveEnergyBurned|AppleExerciseTime|AppleStandTime|HeartRate|RestingHeartRate|HeartRateVariabilitySDNN|VO2Max|BodyMass|BloodPressure(?:Systolic|Diastolic)|RespiratoryRate|SleepAnalysis)"|<Workout /;
const ATTR = (el: string, name: string): string => new RegExp(`\\b${name}="([^"]*)"`).exec(el)?.[1] ?? '';
const when = (s: string): number => Date.parse(s.replace(' ', 'T').replace(' ', ''));

export interface HubAcc {
  from: string;
  records: number;
  /** Sums by source, per day (steps, km, kcal, exercise, stand): the source that counted most wins. */
  bySource: Record<string, Partial<Record<HubKey, Record<string, number>>>>;
  /** Averages: total and count. */
  avg: Record<string, Partial<Record<HubKey, [number, number]>>>;
  /** Last values (and when): weight, VO2 max; lowest: resting heart rate. */
  last: Record<string, Partial<Record<HubKey, [number, number]>>>;
  /** Sleep stage spans per night (the day he woke), by stage. */
  sleep: Record<string, Record<'deep' | 'rem' | 'core' | 'awake' | 'asleep', [number, number][]>>;
  workouts: Workout[];
}
export const hubStart = (from: string): HubAcc => ({ from, records: 0, bySource: {}, avg: {}, last: {}, sleep: {}, workouts: [] });

/** One line of the export, weighed. Days before `from` are skipped (only new days are read). */
export function feedHub(acc: HubAcc, el: string): void {
  if (el.includes('<Workout ')) {
    const end = ATTR(el, 'endDate');
    const d = end.slice(0, 10);
    if (!DAY.test(d) || d < acc.from) return;
    const min = Number(ATTR(el, 'duration'));
    const unit = ATTR(el, 'durationUnit');
    const dist = Number(ATTR(el, 'totalDistance'));
    const du = ATTR(el, 'totalDistanceUnit');
    const kcal = Number(ATTR(el, 'totalEnergyBurned'));
    const kind = ATTR(el, 'workoutActivityType').replace(/^HKWorkoutActivityType/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'Workout';
    if (!Number.isFinite(min)) return;
    acc.workouts.push({ d, kind, min: Math.round(unit === 'hr' ? min * 60 : unit === 's' ? min / 60 : min), km: Number.isFinite(dist) && dist > 0 ? Math.round((du === 'mi' ? dist * 1.609 : du === 'm' ? dist / 1000 : dist) * 100) / 100 : null, kcal: Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : null });
    acc.records++;
    return;
  }
  if (!el.includes('<Record ')) return;
  const type = ATTR(el, 'type');
  const end = ATTR(el, 'endDate');
  const d = end.slice(0, 10);
  if (!DAY.test(d) || d < acc.from) return;
  if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
    const v = ATTR(el, 'value');
    const stage = /Deep/.test(v) ? 'deep' : /REM/.test(v) ? 'rem' : /Core/.test(v) ? 'core' : /Awake/.test(v) ? 'awake' : /Asleep/.test(v) ? 'asleep' : '';
    if (!stage) return;
    const a = when(ATTR(el, 'startDate'));
    const b = when(end);
    if (!(b > a) || b - a > 16 * 3_600_000) return;
    const night = (acc.sleep[d] ??= { deep: [], rem: [], core: [], awake: [], asleep: [] });
    night[stage].push([a, b]);
    acc.records++;
    return;
  }
  const key = TYPE[type];
  if (!key) return;
  let n = Number(ATTR(el, 'value'));
  if (!Number.isFinite(n)) return;
  const unit = ATTR(el, 'unit');
  if (key === 'km' && unit === 'mi') n *= 1.609;
  if (key === 'km' && unit === 'm') n /= 1000;
  if (key === 'kcal' && unit === 'kJ') n /= 4.184;
  if (key === 'weight' && unit === 'lb') n *= 0.4536;
  if (key === 'hrv' || key === 'hr' || key === 'resp' || key === 'sys' || key === 'dia') {
    const a = ((acc.avg[d] ??= {})[key] ??= [0, 0]);
    a[0] += n;
    a[1]++;
  } else if (key === 'rhr' || key === 'weight' || key === 'vo2') {
    const t = when(end);
    const cur = (acc.last[d] ??= {})[key];
    if (!cur || (key === 'rhr' ? n < cur[0] : t >= cur[1])) acc.last[d]![key] = [n, t];
  } else {
    const src = ATTR(el, 'sourceName') || 'phone';
    const by = ((acc.bySource[d] ??= {})[key] ??= {});
    by[src] = (by[src] ?? 0) + n;
  }
  acc.records++;
}

/** Spans merged where they overlap: hours. */
function hoursOf(spans: [number, number][]): number {
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
  return total / 3_600_000;
}
const r1 = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
/** The export's days, each metric joined as it should be. */
export function hubDays(acc: HubAcc): Record<string, HubDay> {
  const out: Record<string, HubDay> = {};
  const day = (d: string) => (out[d] ??= {});
  for (const [d, keys] of Object.entries(acc.bySource)) for (const [k, by] of Object.entries(keys)) day(d)[k as HubKey] = r1(Math.max(...Object.values(by!)), k === 'km' ? 2 : 0);
  for (const [d, keys] of Object.entries(acc.avg)) for (const [k, [s, n]] of Object.entries(keys) as [HubKey, [number, number]][]) day(d)[k] = r1(s / n, 1);
  for (const [d, keys] of Object.entries(acc.last)) for (const [k, [v]] of Object.entries(keys) as [HubKey, [number, number]][]) day(d)[k] = r1(v, 1);
  for (const [d, n] of Object.entries(acc.sleep)) {
    const staged = n.deep.length + n.rem.length + n.core.length > 0;
    const deep = hoursOf(n.deep);
    const rem = hoursOf(n.rem);
    const core = hoursOf(n.core);
    const total = staged ? deep + rem + core : hoursOf(n.asleep);
    if (total < 0.5) continue;
    Object.assign(day(d), { sleep: r1(total, 2), ...(staged ? { deep: r1(deep, 2), rem: r1(rem, 2), core: r1(core, 2), awake: r1(hoursOf(n.awake), 2) } : {}) });
  }
  return out;
}

// ---------------------------------------------------------------- views

export const RANGES = [
  { id: 'D', label: 'Day', days: 1 },
  { id: 'W', label: 'Week', days: 7 },
  { id: 'M', label: 'Month', days: 30 },
  { id: '6M', label: '6 months', days: 182 },
  { id: 'Y', label: 'Year', days: 365 },
  { id: 'A', label: 'All', days: 0 },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];

/** The points to draw for a metric over a range: a point a day up to a month, a week's average beyond, a month's for all time. */
export function seriesOf(data: HubData, key: HubKey, today: string, range: RangeId): { label: string; v: number | null }[] {
  const all = Object.keys(data.days).sort();
  const first = all[0] ?? today;
  const span = range === 'A' ? Math.max(1, Math.round((Date.parse(today) - Date.parse(first)) / 864e5) + 1) : RANGES.find((r) => r.id === range)!.days;
  const days = Array.from({ length: Math.max(1, span) }, (_, i) => addDays(today, i - span + 1));
  const val = (d: string) => data.days[d]?.[key] ?? null;
  const bucket = span <= 31 ? 1 : span <= 400 ? 7 : 30;
  const out: { label: string; v: number | null }[] = [];
  for (let i = 0; i < days.length; i += bucket) {
    const chunk = days.slice(i, i + bucket);
    const vs = chunk.map(val).filter((x): x is number => x != null);
    out.push({ label: chunk[0]!, v: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null });
  }
  return out;
}

/** The average of a metric over the `n` days ending `end` (null: nothing kept). */
export function avgOver(data: HubData, key: HubKey, end: string, n: number): { v: number | null; days: number } {
  const vs: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = data.days[addDays(end, -i)]?.[key];
    if (v != null) vs.push(v);
  }
  return { v: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null, days: vs.length };
}

export const fmt = (key: HubKey, v: number): string => {
  const m = metricOf(key);
  if (key === 'sleep' || key === 'deep' || key === 'rem' || key === 'core' || key === 'awake') {
    const mins = Math.round(v * 60);
    return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
  }
  return `${v.toLocaleString('en-GB', { maximumFractionDigits: m.dp, minimumFractionDigits: 0 })}${m.unit === 'steps' ? '' : ` ${m.unit}`}`;
};

/**
 * Plain highlights from his own history: the last 30 days against the 30 before, for each metric with at least 7 days on each
 * side and a gap worth saying. Past tense, his numbers, no judgement ("lower", never "better"), never a forecast.
 */
export function highlights(data: HubData, today: string): { key: HubKey; words: string }[] {
  const out: { key: HubKey; words: string }[] = [];
  for (const m of HUB_METRICS) {
    const now = avgOver(data, m.key, today, 30);
    const before = avgOver(data, m.key, addDays(today, -30), 30);
    if (now.v == null || before.v == null || now.days < 7 || before.days < 7) continue;
    const gap = now.v - before.v;
    if (Math.abs(gap) < m.notice) continue;
    const g = m.key === 'sleep' ? `${Math.round(Math.abs(gap) * 60)} min` : `${Math.abs(gap).toLocaleString('en-GB', { maximumFractionDigits: m.dp })}${m.unit === 'steps' ? ' steps' : ` ${m.unit}`}`;
    out.push({ key: m.key, words: `${m.label} averaged ${fmt(m.key, now.v)}${m.join === 'sum' && m.key !== 'sleep' ? ' a day' : m.key === 'sleep' ? ' a night' : ''} over the last 30 days, ${g} ${gap < 0 ? 'lower' : 'higher'} than the 30 days before.` });
  }
  return out;
}

/** Today's activity rings: move (active energy), exercise and stand, each a share of his goal (may pass 1). */
export function ringsOf(data: HubData, day: string): { move: number; exercise: number; stand: number } {
  const d = data.days[day] ?? {};
  return { move: (d.kcal ?? 0) / data.goals.move, exercise: (d.exercise ?? 0) / data.goals.exercise, stand: (d.stand ?? 0) / data.goals.stand };
}

/** A smoothed weight trend (an exponential average, as the weight apps draw it): one value a day where weight was kept. */
export function smoothed(points: { label: string; v: number | null }[], alpha = 0.25): (number | null)[] {
  let cur: number | null = null;
  return points.map((p) => {
    if (p.v == null) return cur;
    cur = cur == null ? p.v : cur + alpha * (p.v - cur);
    return Math.round(cur * 10) / 10;
  });
}

/** The first-run sample: 120 believable days (a fixed pseudo-random walk, the same every time), marked as a sample. */
export function sampleHub(today: string): HubData {
  const d = emptyHub();
  d.sample = true;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let w = 83.4;
  for (let i = 119; i >= 0; i--) {
    const day = addDays(today, -i);
    const weekend = [0, 6].includes(new Date(`${day}T12:00:00`).getDay());
    const trend = (119 - i) / 119;
    // (the last month a little different from the one before, so the first run shows what highlights look like)
    const lately = i < 30 ? 1 : 0;
    w += (rnd() - 0.55) * 0.18;
    const deep = 0.8 + rnd() * 0.6;
    const rem = 1.3 + rnd() * 0.6;
    const core = 3.6 + rnd() * 1.2;
    d.days[day] = {
      steps: Math.round((weekend ? 9500 : 7200) + rnd() * 3500 + trend * 900 + lately * 1300),
      km: Math.round((5 + rnd() * 3) * 10) / 10,
      kcal: Math.round(380 + rnd() * 260 + trend * 40),
      exercise: Math.round(18 + rnd() * 30),
      stand: Math.round(8 + rnd() * 5),
      rhr: Math.round(61 - trend * 2 - lately * 3 + rnd() * 3),
      hrv: Math.round(38 + trend * 4 + lately * 5 + rnd() * 10),
      hr: Math.round(72 + rnd() * 8),
      vo2: Math.round((40.2 + trend * 1.4 + rnd() * 0.4) * 10) / 10,
      resp: Math.round((14 + rnd()) * 10) / 10,
      sleep: Math.round((deep + rem + core) * 100) / 100,
      deep: Math.round(deep * 100) / 100,
      rem: Math.round(rem * 100) / 100,
      core: Math.round(core * 100) / 100,
      awake: Math.round((0.2 + rnd() * 0.4) * 100) / 100,
      ...(i % 3 === 0 ? { weight: Math.round(w * 10) / 10 } : {}),
      ...(i % 14 === 0 ? { sys: Math.round(118 + rnd() * 8), dia: Math.round(76 + rnd() * 6) } : {}),
    };
    if (i % 4 === 1) d.workouts.push({ d: day, kind: rnd() > 0.5 ? 'Running' : 'Walking', min: Math.round(25 + rnd() * 25), km: Math.round((3 + rnd() * 4) * 100) / 100, kcal: Math.round(200 + rnd() * 200) });
  }
  return d;
}
