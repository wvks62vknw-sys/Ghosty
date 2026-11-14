/**
 * THE BODY TRACKERS, the pure parts (FINAL ROUND, BODY lane): water, sleep, steps, weight and mood, each kept on this phone
 * only (features/body/track.ts holds the storage and the screens). Here is what can be tested without a page:
 *  - the day's key in his own time, and each tracker's day value (water and steps add up; sleep, weight and mood keep the last);
 *  - WATER's goal worked out from his body and the day's weather, always said as a first estimate, never medical advice;
 *  - a streak (days in a row the goal was met, today counted once it is met) and the week's and month's series for the chart;
 *  - when a water nudge is due: inside his own nudge hours, outside his quiet hours, behind the day's pace, never once he is on track;
 *  - his words: "I drank a pint", "log a glass of water", "how much have I drunk?", "I slept 7 and a half hours", "I weigh 82 kg",
 *    "walked 6,000 steps", "I feel good", "how did I sleep this week?" — answered on the phone with no model.
 */

export type Metric = 'water' | 'sleep' | 'steps' | 'weight' | 'mood';
export const METRICS: Metric[] = ['water', 'sleep', 'steps', 'weight', 'mood'];

export interface Entry {
  /** The day in his time, YYYY-MM-DD. */
  d: string;
  /** When it was logged (ms). */
  t: number;
  /** ml of water, hours of sleep, steps, kg, or a mood from 1 to 5. */
  v: number;
  /** Where it came from: his tap, his words, or the Health export. */
  from?: 'tap' | 'words' | 'health';
  /** A word with it (the drink's name, a mood's note). */
  note?: string;
}

export interface Cup {
  name: string;
  ml: number;
}
export const CUPS: Cup[] = [
  { name: 'Glass', ml: 250 },
  { name: 'Mug', ml: 350 },
  { name: 'Bottle', ml: 500 },
  { name: 'Pint', ml: 568 },
];

export interface TrackSettings {
  /** His own water goal (ml), when he set one: it wins over the estimate. */
  waterGoal: number | null;
  /** His own cup sizes, beside the four. */
  cups: Cup[];
  /** Water nudges: on or off, the hours they may come in, how often at most, his quiet hours (none inside them). */
  remind: { on: boolean; from: number; to: number; every: number; quietFrom: number; quietTo: number; lock: boolean; jobs: string[] };
  sleepGoal: number;
  stepsGoal: number;
  /** His height (cm), for BMI's first estimate; and the weight he aims for. */
  heightCm: number | null;
  weightGoal: number | null;
  /** When he said he went to bed (ms), until he says he is up. */
  bedAt: number | null;
}
export const DEFAULTS: TrackSettings = {
  waterGoal: null,
  cups: [],
  remind: { on: false, from: 9, to: 21, every: 90, quietFrom: 22, quietTo: 8, lock: true, jobs: [] },
  sleepGoal: 8,
  stepsGoal: 8000,
  heightCm: null,
  weightGoal: null,
  bedAt: null,
};

export interface TrackData {
  v: 1;
  log: Record<Metric, Entry[]>;
  set: TrackSettings;
  /** The last water nudge (ms). */
  nudged: number;
}
export const empty = (): TrackData => ({ v: 1, log: { water: [], sleep: [], steps: [], weight: [], mood: [] }, set: { ...DEFAULTS, remind: { ...DEFAULTS.remind, jobs: [] }, cups: [] }, nudged: 0 });

/** Reads what the phone kept, mending anything missing or of the wrong shape, so a broken record never breaks the screen. */
export function mend(raw: unknown): TrackData {
  const out = empty();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<TrackData>;
  for (const m of METRICS) {
    const list = (r.log as Record<string, unknown> | undefined)?.[m];
    if (Array.isArray(list)) out.log[m] = list.filter((e): e is Entry => !!e && typeof e === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String((e as Entry).d)) && Number.isFinite((e as Entry).v) && Number.isFinite((e as Entry).t)).slice(-3000);
  }
  const s = (r.set ?? {}) as Partial<TrackSettings>;
  const num = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : d);
  out.set.waterGoal = s.waterGoal == null ? null : num(s.waterGoal, 500, 6000, 0) || null;
  out.set.cups = Array.isArray(s.cups) ? s.cups.filter((c) => c && typeof c.name === 'string' && c.name.trim() && Number.isFinite(c.ml) && c.ml >= 30 && c.ml <= 3000).slice(0, 6).map((c) => ({ name: c.name.trim().slice(0, 24), ml: Math.round(c.ml) })) : [];
  const rm = (s.remind ?? {}) as Partial<TrackSettings['remind']>;
  out.set.remind = { on: rm.on === true, from: num(rm.from, 0, 23, 9), to: num(rm.to, 1, 24, 21), every: num(rm.every, 30, 240, 90), quietFrom: num(rm.quietFrom, 0, 23, 22), quietTo: num(rm.quietTo, 0, 23, 8), lock: rm.lock !== false, jobs: Array.isArray(rm.jobs) ? rm.jobs.filter((x): x is string => typeof x === 'string').slice(0, 12) : [] };
  out.set.sleepGoal = num(s.sleepGoal, 4, 12, 8);
  out.set.stepsGoal = num(s.stepsGoal, 1000, 40000, 8000);
  out.set.heightCm = s.heightCm == null ? null : num(s.heightCm, 100, 250, 0) || null;
  out.set.weightGoal = s.weightGoal == null ? null : num(s.weightGoal, 25, 350, 0) || null;
  out.set.bedAt = typeof s.bedAt === 'number' && Number.isFinite(s.bedAt) ? s.bedAt : null;
  out.nudged = num(r.nudged, 0, 1e15, 0);
  return out;
}

// ---------------------------------------------------------------- days

const pad = (n: number) => String(n).padStart(2, '0');
/** The day in the phone's own time, YYYY-MM-DD. */
export const dayOf = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** A day moved by n days (noon-safe across the clocks changing). */
export function shift(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return dayOf(new Date(y, m - 1, d + n, 12).getTime());
}
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekdayOf = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return WEEKDAY[new Date(y, m - 1, d, 12).getDay()]!;
};

/** Water and steps add up through the day; sleep, weight and mood keep the day's last word. */
const SUMS: Record<Metric, boolean> = { water: true, steps: true, sleep: false, weight: false, mood: false };
export function dayValue(data: TrackData, m: Metric, day: string): number | null {
  const list = data.log[m].filter((e) => e.d === day);
  if (!list.length) return null;
  if (SUMS[m]) return list.reduce((a, e) => a + e.v, 0);
  return list.reduce((a, e) => (e.t >= a.t ? e : a)).v;
}
/** The last n days, oldest first, each with its value (null: nothing kept). */
export function series(data: TrackData, m: Metric, today: string, n: number): { d: string; v: number | null }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = shift(today, i - n + 1);
    return { d, v: dayValue(data, m, d) };
  });
}

// ---------------------------------------------------------------- goals

export interface Goal {
  /** The goal in the tracker's unit. */
  v: number;
  /** How it was reached, a line at a time, for the screen. */
  why: string[];
  /** His own (true) or the first estimate (false). */
  own: boolean;
}
export const FIRST_ESTIMATE = 'A first estimate from what the phone knows, not medical advice.';

/**
 * WATER's goal: about 33 ml for each kilo he weighs (2,000 ml when the phone has no weight), more on a warm day (from the
 * day's highest temperature, when the weather has been read), more on a day he moved a lot (steps), kept between 1,500 and
 * 4,000 ml and rounded to 50. His own goal, once set, wins.
 */
export function waterGoal(data: TrackData, today: string, maxC: number | null): Goal {
  if (data.set.waterGoal) return { v: data.set.waterGoal, own: true, why: [`Your own goal: ${ml(data.set.waterGoal)}.`] };
  const kg = latest(data, 'weight');
  const why: string[] = [];
  let v = 2000;
  if (kg) {
    v = kg * 33;
    why.push(`${Math.round(kg)} kg × 33 ml = ${ml(Math.round(v / 50) * 50)}.`);
  } else why.push('2,000 ml to start; tell me your weight and I work it out from you.');
  if (maxC != null) {
    const add = maxC >= 30 ? 750 : maxC >= 25 ? 500 : maxC >= 20 ? 250 : 0;
    if (add) {
      v += add;
      why.push(`+${ml(add)}: up to ${Math.round(maxC)}°C today.`);
    } else why.push(`Up to ${Math.round(maxC)}°C today, so nothing added for heat.`);
  } else why.push('No weather read today, so nothing added for heat.');
  const steps = dayValue(data, 'steps', today) ?? 0;
  if (steps >= 10000) {
    v += 350;
    why.push(`+350 ml: ${steps.toLocaleString('en-GB')} steps today.`);
  }
  v = Math.max(1500, Math.min(4000, Math.round(v / 50) * 50));
  return { v, own: false, why };
}
export const sleepGoal = (data: TrackData): Goal => ({ v: data.set.sleepGoal, own: data.set.sleepGoal !== DEFAULTS.sleepGoal, why: data.set.sleepGoal !== DEFAULTS.sleepGoal ? [`Your own goal: ${hours(data.set.sleepGoal)} a night.`] : ['8 hours a night to start: most adults need 7 to 9.'] });
export const stepsGoal = (data: TrackData): Goal => ({ v: data.set.stepsGoal, own: data.set.stepsGoal !== DEFAULTS.stepsGoal, why: data.set.stepsGoal !== DEFAULTS.stepsGoal ? [`Your own goal: ${data.set.stepsGoal.toLocaleString('en-GB')} steps a day.`] : ['8,000 steps a day to start: change it to suit you.'] });

/** The last value kept of a tracker, any day. */
export function latest(data: TrackData, m: Metric): number | null {
  const l = data.log[m];
  if (!l.length) return null;
  return l.reduce((a, e) => (e.t >= a.t ? e : a)).v;
}

/** A goal met on a day: water, steps and sleep reach the goal; mood and weight count a day kept. */
export function met(data: TrackData, m: Metric, day: string, goal: number): boolean {
  const v = dayValue(data, m, day);
  if (v == null) return false;
  return m === 'weight' || m === 'mood' ? true : v >= goal;
}

/** Days in a row the goal was met: today counts once it is met, and an unmet today does not break yesterday's run. */
export function streak(data: TrackData, m: Metric, today: string, goal: number): { now: number; best: number } {
  let now = 0;
  let d = met(data, m, today, goal) ? today : shift(today, -1);
  while (met(data, m, d, goal) && now < 3660) {
    now++;
    d = shift(d, -1);
  }
  const days = [...new Set(data.log[m].map((e) => e.d))].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const x of days) {
    if (!met(data, m, x, goal)) {
      run = 0;
      prev = x;
      continue;
    }
    run = prev && shift(prev, 1) === x && run ? run + 1 : 1;
    best = Math.max(best, run);
    prev = x;
  }
  return { now, best: Math.max(best, now) };
}

/** The average of the days with a value, over the last n days (null: none kept). */
export function average(data: TrackData, m: Metric, today: string, n: number): number | null {
  const v = series(data, m, today, n).map((x) => x.v).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// ---------------------------------------------------------------- water nudges

/**
 * Is a water nudge due now? Only with nudges on; only inside his nudge hours and never inside his quiet hours; never once
 * the day's goal is met or he is on pace (what he has drunk is at least the share of the goal the day so far asks); and not
 * sooner than his "every" since the last one, or since his last drink. The reason comes back for the specs and the screen.
 */
export function nudgeDue(data: TrackData, now: number, goal: number): { due: boolean; why: string } {
  const r = data.set.remind;
  if (!r.on) return { due: false, why: 'off' };
  const t = new Date(now);
  const hr = t.getHours() + t.getMinutes() / 60;
  if (inQuiet(hr, r.quietFrom, r.quietTo)) return { due: false, why: 'quiet' };
  if (hr < r.from || hr >= r.to) return { due: false, why: 'outside' };
  const today = dayOf(now);
  const drunk = dayValue(data, 'water', today) ?? 0;
  if (drunk >= goal) return { due: false, why: 'met' };
  const pace = (goal * (hr - r.from)) / Math.max(1, r.to - r.from);
  if (drunk >= pace) return { due: false, why: 'on track' };
  const lastDrink = Math.max(0, ...data.log.water.filter((e) => e.d === today).map((e) => e.t));
  const since = Math.max(data.nudged, lastDrink);
  if (now - since < r.every * 60_000) return { due: false, why: 'soon' };
  return { due: true, why: 'behind' };
}
/**
 * The rest of today's nudge times if he drinks nothing more (body.u1): each one a nudge would be due at, at most every
 * `every` minutes, inside his hours, never in his quiet hours, none once the day's window closes. A drink logged changes them,
 * so the phone sends these again each time. Only these times ever go to my brain, never an amount.
 */
export function nudgeTimes(data: TrackData, now: number, goal: number, max = 6): number[] {
  const out: number[] = [];
  if (!data.set.remind.on) return out;
  const sim: TrackData = { ...data, nudged: data.nudged };
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  for (let t = now + 60_000; t < end.getTime() && out.length < max; t += 5 * 60_000) {
    if (nudgeDue(sim, t, goal).due) {
      out.push(t);
      sim.nudged = t;
    }
  }
  return out;
}
/** Inside the quiet hours (which may run past midnight: 22 to 8). */
export function inQuiet(hr: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hr >= from && hr < to : hr >= from || hr < to;
}

// ---------------------------------------------------------------- words

/** A volume as he says it: "750 ml", "1 litre", "2.4 litres", "1.85 litres". */
export function ml(v: number): string {
  const r = Math.round(v);
  if (r < 1000) return `${r} ml`;
  const l = (r / 1000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${l} litre${l === '1' ? '' : 's'}`;
}
export function hours(h: number): string {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  if (min === 60) return `${whole + 1} h`;
  if (!whole) return `${min} min`;
  return min ? `${whole} h ${min} min` : `${whole} h`;
}
export const MOODS = ['Awful', 'Low', 'Okay', 'Good', 'Great'];
export const moodWord = (v: number): string => MOODS[Math.max(1, Math.min(5, Math.round(v))) - 1]!;
export const stone = (kg: number): string => {
  const lb = Math.round(kg / 0.453592);
  return `${Math.floor(lb / 14)} st ${lb % 14} lb`;
};
/** BMI as a first estimate, with its band in plain words. */
export function bmi(kg: number, cm: number): { v: number; band: string } {
  const v = Math.round((kg / (cm / 100) ** 2) * 10) / 10;
  return { v, band: v < 18.5 ? 'under the healthy range' : v < 25 ? 'in the healthy range' : v < 30 ? 'over the healthy range' : 'well over the healthy range' };
}

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, another: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, couple: 2 };
const n = (s: string | undefined): number => (s == null ? NaN : s in NUM ? NUM[s]! : Number(s.replace(/,/g, '')));

/** Millilitres in his words: "a pint", "2 glasses", "500 ml", "1.5 litres", "a mug", "a bottle", his own cup's name. */
export function mlIn(words: string, cups: Cup[] = []): number | null {
  const w = words.toLowerCase().replace(/’/g, "'");
  const litre = /(\d+(?:\.\d+)?)\s*(ml|millilit(?:re|er)s?|l|lit(?:re|er)s?)\b/.exec(w);
  if (litre) return Math.round(Number(litre[1]) * (/^m/.test(litre[2]!) ? 1 : 1000));
  const half = /\bhalf (?:a |an )?(pint|glass|mug|bottle|cup)\b/.exec(w);
  for (const c of [...cups, ...CUPS, { name: 'cup', ml: 250 }, { name: 'can', ml: 330 }]) {
    const name = c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (half && half[1] === name) return Math.round(c.ml / 2);
    const m = new RegExp(`(?:^|\\s)(\\d+|a|an|one|another|two|three|four|five|six|couple of)?\\s*(?:big |small |large |full )?${name}(?:e?s)?\\b`).exec(w);
    if (m) return Math.round(c.ml * (n(m[1]?.replace(/ of$/, '')) || 1));
  }
  if (/\bwater\b/.test(w)) return 250;
  return null;
}

/** What his words ask of the trackers (null: not theirs). */
export type TrackAsk =
  | { kind: 'log'; m: Metric; v: number; note?: string }
  | { kind: 'ask'; m: Metric; span: 'today' | 'week' | 'month' }
  | { kind: 'open'; m: Metric }
  | { kind: 'undo'; m: Metric }
  | { kind: 'remind'; on: boolean }
  | { kind: 'bed' }
  | { kind: 'up' };

const DRINK = /\b(?:drank|drunk|had|log|logged|add|added|record|put down|track)\b/;
const WATERY = /\b(?:water|glass(?:es)?|pints?|mugs?|bottles?|litres?|liters?|ml|cups?)\b/;
const NOT_WATER = /\b(?:beer|lager|ale|wine|cider|coffee|tea|juice|cola|coke|vodka|whisky|whiskey|gin|rum|milk|bills?|plants?|the garden|shopping|list|basket|order|buy|fridge|freezer|cupboard|pantry)\b/;

/** His words, read for the trackers with no model. */
export function trackAsked(text: string, cups: Cup[] = []): TrackAsk | null {
  const t = text.trim().toLowerCase().replace(/’/g, "'").replace(/[.!?]+$/, '');
  if (!t || t.length > 120) return null;
  // (a reminder with a time is the agenda's: "remind me to drink water at 5")
  if (/^remind me\b/.test(t) && /\b(?:at|in|on|by|tomorrow|tonight|every)\b/.test(t)) return null;
  // nudges
  if (/^(?:remind me to drink|nudge me to drink|water (?:nudges|reminders) on|turn on water (?:nudges|reminders)|remind me to drink (?:more )?water)/.test(t)) return { kind: 'remind', on: true };
  if (/^(?:stop (?:reminding|nudging) me (?:to drink|about water)|water (?:nudges|reminders) off|turn off water (?:nudges|reminders)|no more water (?:nudges|reminders))/.test(t)) return { kind: 'remind', on: false };
  // undo
  if (/^(?:undo|take back|remove) (?:that|the last|my last) (?:glass|drink|water)|^undo (?:the )?water$/.test(t)) return { kind: 'undo', m: 'water' };
  // questions
  const span = (s: string): 'today' | 'week' | 'month' => (/\bmonth\b/.test(s) ? 'month' : /\bweek\b|\blately\b|\brecently\b/.test(s) ? 'week' : 'today');
  if (/^(?:how much (?:water )?(?:have i|did i|i've) (?:drunk|drank|had)|how much water(?: (?:today|this week|this month|so far|have i had|did i have))?$|how am i doing (?:on|with) water|am i (?:drinking enough|hydrated|on track with water)|what'?s my water)/.test(t)) return { kind: 'ask', m: 'water', span: span(t) };
  if (/^(?:how (?:did|have) i (?:sleep|slept)|how much (?:did i sleep|sleep)|how'?s my sleep|what'?s my sleep)/.test(t)) return { kind: 'ask', m: 'sleep', span: /last night|today/.test(t) ? 'today' : span(t) === 'today' ? 'week' : span(t) };
  if (/^(?:how many steps|how far have i walked|what'?s my step|my steps today|steps today)/.test(t)) return { kind: 'ask', m: 'steps', span: span(t) };
  if (/^(?:what do i weigh|how much do i weigh|what'?s my weight|my weight trend|how'?s my weight)/.test(t)) return { kind: 'ask', m: 'weight', span: 'month' };
  if (/^(?:how (?:has|is|was) my mood|what'?s my mood|my mood (?:this|lately))/.test(t)) return { kind: 'ask', m: 'mood', span: span(t) === 'today' ? 'week' : span(t) };
  // open
  const open = /^(?:open|show(?: me)?|go to) (?:my |the )?(water|hydration|sleep|steps?|weight|mood)(?: tracker| log| screen| tab)?$/.exec(t) ?? /^(water|sleep|steps|weight|mood) (?:tracker|log)$/.exec(t);
  if (open) {
    const w = open[1]!;
    return { kind: 'open', m: w === 'hydration' ? 'water' : w.startsWith('step') ? 'steps' : (w as Metric) };
  }
  // bed and up
  if (/^(?:i'?m |i am )?(?:going to bed|off to bed|going to sleep now)$/.test(t)) return { kind: 'bed' };
  if (/^(?:i'?m |i am |just )?(?:up|up now|awake now|woke up|just woke up)$/.test(t) && t !== 'up') return { kind: 'up' };
  // sleep
  const sl = /^(?:i )?(?:slept|got|had|log|logged) (?:about |around )?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)( and a half| and a quarter|\.5)? ?(?:hours?|hrs?|h)\b(?: (\d+) ?(?:minutes?|mins?|m))?(?: (?:of )?sleep)?(?: last night)?$/.exec(t) ?? /^(?:log )?(\d+(?:\.\d+)?)( and a half)? ?(?:hours?|hrs?|h) (?:of )?sleep(?: last night)?$/.exec(t);
  if (sl) {
    let h = n(sl[1]) + (sl[2] ? (/quarter/.test(sl[2]) ? 0.25 : 0.5) : 0) + (sl[3] ? Number(sl[3]) / 60 : 0);
    if (sl[2] === '.5') h = n(sl[1]) + 0.5;
    if (h > 0 && h <= 16) return { kind: 'log', m: 'sleep', v: Math.round(h * 100) / 100 };
  }
  // steps
  const st = /^(?:i )?(?:walked|did|done|log|logged|add|had)? ?(\d[\d,]*(?:\.\d+)?)(k)? steps(?: today)?$/.exec(t);
  if (st) {
    const v = Math.round(Number(st[1]!.replace(/,/g, '')) * (st[2] ? 1000 : 1));
    if (v > 0 && v < 200000) return { kind: 'log', m: 'steps', v };
  }
  // weight
  if (/^(?:i(?: weigh| weighed| am|'m)|my weight is|weight|log (?:my )?weight|i'?m now)\b/.test(t)) {
    // (a bare number after "I am" is an age, never a weight: "I am 30"; a unit, or the word weigh, makes it a weight)
    const kg = /^i(?: am|'m)\b/.test(t) && !/\b(?:kg|kgs|kilos?|kilograms?|st|stones?|lbs?|pounds?)\b/.test(t) ? null : kgOf(t);
    if (kg != null && kg >= 25 && kg <= 350) return { kind: 'log', m: 'weight', v: kg };
  }
  // mood
  // (only the words that log a mood: "I feel low" on its own stays a conversation with my brain, never a number)
  const md = /^(?:my mood(?: is| today is)?|mood(?: today)?:?|log (?:my )?mood(?: as)?|rate (?:my|the) day|today'?s mood:?) (?:really |very |pretty |quite |a bit |so )?(awful|terrible|rubbish|bad|sad|low|down|meh|okay|ok|fine|alright|good|happy|great|brilliant|amazing|fantastic|[1-5](?: out of 5)?)$/.exec(t);
  if (md) {
    const w = md[1]!;
    const v = /^[1-5]/.test(w) ? Number(w[0]) : /awful|terrible|rubbish/.test(w) ? 1 : /bad|sad|low|down/.test(w) ? 2 : /meh|okay|ok|fine|alright/.test(w) ? 3 : /good|happy/.test(w) ? 4 : 5;
    return { kind: 'log', m: 'mood', v };
  }
  // water
  if (NOT_WATER.test(t)) return null;
  if (/^(?:a |another |\d+ |two |three |four )?(?:glass|glasses|pints?|mugs?|bottles?|cups?) of water$/.test(t) || (DRINK.test(t) && WATERY.test(t)) || /^(?:\+|plus )?\d+ ?ml$/.test(t) || cups.some((c) => t.includes(c.name.toLowerCase()) && DRINK.test(t))) {
    const v = mlIn(t, cups);
    if (v != null && v > 0 && v <= 3000) return { kind: 'log', m: 'water', v };
  }
  return null;
}

/** Kilos in his words: "82.5 kg", "13 stone 4", "13st 4lb", "182 lb"; a bare 40 to 250 after "weigh" is kilos. */
export function kgOf(words: string): number | null {
  const w = words.toLowerCase();
  const st = /(\d+(?:\.\d+)?)\s*(?:stones?|st)\b\s*(?:(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)?)?/.exec(w);
  if (st) return Math.round((Number(st[1]) * 6.35029 + Number(st[2] ?? 0) * 0.453592) * 10) / 10;
  const lb = /(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/.exec(w);
  if (lb) return Math.round(Number(lb[1]) * 0.453592 * 10) / 10;
  const kg = /(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)\b/.exec(w) ?? /\b(?:weigh|weighed|weight is|weight|am|'m|now)\b\D*(\d{2,3}(?:\.\d)?)$/.exec(w);
  return kg ? Number(kg[1]) : null;
}
