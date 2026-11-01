/**
 * THE BODY PACK (BRIEF-PACKS-1 item 2): ONE tool, `body`, its abilities an `action` enum — described in full only when his
 * words turn the group on, named "body pack" otherwise (tools/index.ts). The camera and the GPS are the phone's
 * (apps/web/src/features/body): reps are counted there, a run's route stays there, a Health export is read there; this
 * brain keeps only what he gives it — a workout, a run's distance and time after RUN SAVED, the week's steps and sleep,
 * glasses of water, his weight — and brings water and the stand-up up under the cadence (speak.ts). Facts only from what
 * he gives; never a diagnosis. The pure parts: packages/shared/src/body.ts.
 */
import { card } from '../../../../packages/shared/src/cards';
import {
  BREATHS,
  exerciseOf,
  EXERCISES,
  glassesIn,
  healthCard,
  hoursText,
  kgIn,
  NOT_ADVICE,
  restLine,
  runCard,
  sleepWords,
  STAND_DEFAULT,
  standDue,
  stepsWords,
  STRETCHES,
  STRETCH_SECS,
  WATER_GOAL,
  waterLine,
  weightTrend,
  workoutIn,
  type HealthWeek,
  type RunSummary,
  type StandSet,
  type Workout,
} from '../../../../packages/shared/src/body';
import { localHour } from '../../../../packages/shared/src/cadence';
import { mondayOf, weekdayOf } from '../../../../packages/shared/src/packs';
import { load, packTool, save, todayOf, wordsOf, type ActionFn, type PackDeps } from '../packs/base';
import type { Tool } from './types';

export const BODY_KEYS = { log: 'body:log', water: 'body:water', weight: 'body:weight', health: 'body:health', stand: 'body:stand' } as const;
const MAX_LOG = 400;

export const BODY_WHEN =
  /\b(reps?|squats?|push[ -]?ups?|press[ -]?ups?|star jumps?|jumping jacks?|work ?out|exercise|run|running|ran|jog|jogging|pace|steps|step count|sleep|slept|health (?:app|data|export)|apple health|water|hydrat\w*|glass(?:es)? of|drank|breathe|breathing|breath|calm down|stretch\w*|weigh|weight|kg|stone|rest day|stand up|standing|sitting too long)\b/i;
export const BODY_ABOUT =
  "You can keep his body pack (body: reps, run, log, steps, sleep, water, breathe, stretch, weight, rest, stand, week, health): camera and GPS are the phone's; never a diagnosis.";

interface Water {
  d: string;
  n: number;
  goal: number;
  /** Nudges on (under the cadence). */
  on: boolean;
}

// ---------------------------------------------------------------- the phone's screens

const reps: ActionFn = async (a) => {
  const ex = exerciseOf(wordsOf(a));
  const name = EXERCISES.find((e) => e.id === ex)!.say;
  return { text: `On your phone: the camera counts your ${name} and says each one; prop the phone up so it sees all of you. Nothing leaves the phone; the count comes here as a card when you finish.`, open: { name: 'open_body', args: { what: 'reps', exercise: ex } } };
};
const run: ActionFn = async () => ({
  text: 'On your phone: the running coach. It uses the phone’s GPS while the screen is on, says your pace and distance each kilometre, and RUN SAVED keeps the run. Your route stays on the phone: I only get the distance, time and splits.',
  open: { name: 'open_body', args: { what: 'run' } },
});
const breathe: ActionFn = async (a) => {
  const kind = /4[ -]?7[ -]?8/.test(wordsOf(a)) ? '478' : 'box';
  return { text: `On your phone: ${BREATHS[kind].label} breathing, the screen and a buzz guiding each breath. Four rounds take about ${kind === 'box' ? 'a minute' : 'a minute and a quarter'}.`, open: { name: 'open_body', args: { what: 'breathe', pattern: kind } } };
};
const stretch: ActionFn = async () => ({
  text: `On your phone: a ${STRETCHES.length}-stretch set with a timer (${Math.round(STRETCH_SECS / 60)} minutes): ${STRETCHES.map((s) => s.name.toLowerCase()).join(', ')}. Gently: never into pain.`,
  open: { name: 'open_body', args: { what: 'stretch' } },
});

// ---------------------------------------------------------------- what he gives

const log: ActionFn = async (a, d) => {
  const today = todayOf(d);
  const list = await load<Workout[]>(d, BODY_KEYS.log, []);
  // from the phone: a run after RUN SAVED (distance, time, splits — never a position), or the camera's reps
  const r = a.run as Partial<RunSummary> | undefined;
  if (r && Number.isFinite(r.km) && Number.isFinite(r.secs)) {
    const sum: RunSummary = { km: Math.round(Number(r.km) * 100) / 100, secs: Math.round(Number(r.secs)), splits: (Array.isArray(r.splits) ? r.splits : []).map(Number).filter(Number.isFinite).slice(0, 100) };
    list.push({ d: today, kind: 'run', what: 'a run', km: sum.km, secs: sum.secs });
    await save(d, BODY_KEYS.log, list.slice(-MAX_LOG));
    return { text: `Run kept: ${sum.km.toFixed(2)} km in ${Math.round(sum.secs / 60)} minutes. ${restLine(list, today)}`, cards: [runCard(sum, d.now())] };
  }
  const counted = Number(a.n);
  const w: Workout | null = Number.isFinite(counted) && counted > 0 && typeof a.exercise === 'string' ? { d: today, kind: 'reps', what: EXERCISES.find((e) => e.id === a.exercise)?.say ?? 'reps', n: counted } : workoutIn(wordsOf(a), today);
  if (!w) return { text: 'Say what you did, like "did 30 push-ups" or "ran 5k in 28 minutes".' };
  list.push(w);
  await save(d, BODY_KEYS.log, list.slice(-MAX_LOG));
  const what = w.kind === 'run' ? `a ${w.km!.toFixed(1)} km run${w.secs ? ` in ${Math.round(w.secs / 60)} minutes` : ''}` : w.n ? `${w.n} ${w.what}` : w.what;
  return { text: `Kept: ${what}${w.d !== today ? ' (yesterday)' : ''}. ${restLine(list, today)}` };
};

const health: ActionFn = async (a, d) => {
  const w = a.week as HealthWeek | undefined;
  if (w && Array.isArray(w.days) && typeof w.to === 'string') {
    const keep: HealthWeek = { from: String(w.from), to: String(w.to), avgSteps: num(w.avgSteps), avgSleep: num(w.avgSleep), days: w.days.slice(0, 31).map((x) => ({ d: String(x.d), steps: num(x.steps), sleep: num(x.sleep) })) };
    await save(d, BODY_KEYS.health, keep);
    return { text: `Kept your Health week (${keep.from} to ${keep.to}): ask me about your steps or sleep any time.`, cards: [healthCard(keep, d.now())] };
  }
  return { text: 'Your Health export is read on your phone: Health → your picture → Export All Health Data → Save to Files, then pick it in the body pack’s HEALTH. Nothing leaves the phone but the week’s numbers.', open: { name: 'open_body', args: { what: 'health' } } };
};
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const needHealth = 'No Health week yet: export it from the Health app and pick it on your phone (body pack → HEALTH); it is read there, in code.';
const steps: ActionFn = async (_a, d) => {
  const w = await load<HealthWeek | null>(d, BODY_KEYS.health, null);
  return w ? { text: stepsWords(w) } : { text: needHealth, open: { name: 'open_body', args: { what: 'health' } } };
};
const sleep: ActionFn = async (_a, d) => {
  const w = await load<HealthWeek | null>(d, BODY_KEYS.health, null);
  return w ? { text: sleepWords(w) } : { text: needHealth, open: { name: 'open_body', args: { what: 'health' } } };
};

const water: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const was = await load<Water>(d, BODY_KEYS.water, { d: today, n: 0, goal: WATER_GOAL, on: false });
  const w: Water = was.d === today ? was : { ...was, d: today, n: 0 };
  let said = '';
  const goal = /\bgoal\b.*?(\d+)|(\d+)\s+(?:glasses )?a day/i.exec(words);
  if (goal) {
    w.goal = Math.max(1, Math.min(20, Number(goal[1] ?? goal[2])));
    said = `Goal: ${w.goal} glasses a day. `;
  } else if (/\b(?:remind|nudge)\b/i.test(words) && !/\b(?:stop|don'?t|no more|off)\b/i.test(words)) {
    w.on = true;
    said = 'I’ll nudge you if you’re behind, under your speak-first dial (never at night). ';
  } else if (/\b(?:stop|don'?t|no more|off)\b.*\b(?:remind|nudg)/i.test(words)) {
    w.on = false;
    said = 'No more water nudges. ';
  } else if (/\b(?:undo|take (?:that|one) back|minus one|one less)\b/i.test(words)) {
    w.n = Math.max(0, w.n - 1);
    said = 'One taken off. ';
  } else if (words && !/\bhow (?:much|many)\b/i.test(words)) {
    w.n += glassesIn(words);
    said = 'Kept. ';
  }
  await save(d, BODY_KEYS.water, w);
  return {
    text: `${said}${waterLine(w.n, w.goal)} (a glass is 250 ml).`,
    cards: [card({ id: `body:water:${today}`, kind: 'progress', at: d.now(), title: `Water ${w.n} of ${w.goal}`, line: w.n >= w.goal ? 'That’s today’s glasses' : `${w.goal - w.n} more glass${w.goal - w.n === 1 ? '' : 'es'} to go today`, progress: { frac: Math.min(1, w.n / w.goal) }, acts: [{ label: '+1 GLASS', run: { name: 'packs_do', args: { pack: 'body', action: 'water', args: { words: 'a glass' } } } }, { label: 'UNDO', run: { name: 'packs_do', args: { pack: 'body', action: 'water', args: { words: 'undo' } } } }] })],
  };
};

const weight: ActionFn = async (a, d) => {
  const today = todayOf(d);
  const list = await load<{ d: string; kg: number }[]>(d, BODY_KEYS.weight, []);
  const kg = kgIn(wordsOf(a));
  if (kg !== null) {
    if (kg < 25 || kg > 350) return { text: 'That doesn’t look like a weight I can keep: say it like "82.5 kg" or "13 stone 4".' };
    list.push({ d: today, kg });
    await save(d, BODY_KEYS.weight, list.filter((x, i, all) => !all.slice(i + 1).some((y) => y.d === x.d)).slice(-400));
  }
  const t = weightTrend(list, today);
  return { text: `${kg !== null ? `Kept: ${kg} kg today. ` : ''}${t.line}` };
};

const rest: ActionFn = async (_a, d) => ({ text: restLine(await load<Workout[]>(d, BODY_KEYS.log, []), todayOf(d)) });

const stand: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const s = await load<StandSet>(d, BODY_KEYS.stand, STAND_DEFAULT);
  if (/\b(?:stop|off|no more|don'?t)\b/i.test(words)) s.on = false;
  else {
    s.on = true;
    const hrs = /(\d{1,2})\s*(?:am)?\s*(?:to|-|until|till)\s*(\d{1,2})\s*(pm)?/i.exec(words);
    if (hrs) {
      s.from = Number(hrs[1]);
      s.to = Number(hrs[2]) + (hrs[3] || Number(hrs[2]) < s.from ? 12 : 0);
    }
  }
  await save(d, BODY_KEYS.stand, s);
  return { text: s.on ? `Stand-up nudges on: each hour from ${s.from}:00 to ${s.to}:00 on weekdays, under your speak-first dial (it caps how many I say a day).` : 'Stand-up nudges off.' };
};

const week: ActionFn = async (_a, d) => {
  const today = todayOf(d);
  const from = mondayOf(today);
  const log = (await load<Workout[]>(d, BODY_KEYS.log, [])).filter((x) => x.d >= from);
  const km = log.reduce((a, x) => a + (x.km ?? 0), 0);
  const repsN = log.reduce((a, x) => a + (x.kind === 'reps' ? (x.n ?? 0) : 0), 0);
  const days = new Set(log.map((x) => x.d)).size;
  const t = weightTrend(await load(d, BODY_KEYS.weight, []), today);
  const h = await load<HealthWeek | null>(d, BODY_KEYS.health, null);
  const line = `${days} active day${days === 1 ? '' : 's'} · ${repsN} reps · ${km.toFixed(1)} km run`;
  return {
    text: `This week since Monday: ${line}.${t.now !== null ? ` Weight ${t.now} kg on average.` : ''}${h?.avgSleep ? ` Sleep (your last Health export): ${hoursText(h.avgSleep)} a night.` : ''} From what you told me and what the phone counted. ${NOT_ADVICE}`,
    cards: [card({ id: `body:week:${from}`, kind: 'progress', at: d.now(), title: 'Your body this week', line, progress: { frac: Math.min(1, days / 5) } })],
  };
};

export const BODY: Record<string, ActionFn> = { reps, run, log, steps, sleep, water, breathe, stretch, weight, rest, stand, week, health };
export const BODY_ACTIONS = Object.keys(BODY);

export const bodyTools: Tool[] = [
  packTool({
    name: 'body',
    description:
      "His body pack; facts only from him, never a diagnosis. reps: the phone's camera counts squats, push-ups or star jumps (words). run: the phone's running coach (its GPS; the route stays on the phone). log: keep what he did (words: \"did 30 push-ups\", \"ran 5k in 28 minutes\"). steps, sleep: from his Apple Health export, read on the phone. water: a glass (words), his goal, nudges on or off. breathe: box or 4-7-8 on the phone. stretch: the stretch set. weight: keep it (words) or its trend. rest: a rest-day word. stand: hourly stand-up nudges on/off (hours). week: his week. health: open the Health import.",
    actions: BODY,
    properties: { words: { type: 'string', description: 'his words for it, as he said them' } },
    reads: ['reps', 'run', 'steps', 'sleep', 'breathe', 'stretch', 'rest', 'week', 'health'],
  }),
];

// ---------------------------------------------------------------- the Brief and the cadence

/** The Brief's body lines (packs/index.ts): water so far, a rest day after four in a row. */
export async function bodyLines(d: PackDeps): Promise<string[]> {
  const today = todayOf(d);
  const out: string[] = [];
  const w = await load<Water | null>(d, BODY_KEYS.water, null);
  if (w && (w.on || (w.d === today && w.n))) out.push(waterLine(w.d === today ? w.n : 0, w.goal));
  const r = restLine(await load<Workout[]>(d, BODY_KEYS.log, []), today);
  if (/in a row: a rest day/.test(r)) out.push(r.split(':')[0]!);
  return out;
}

/**
 * The body's pieces for speaking first, each with why: a water nudge at 11, 14 and 17 o'clock when he is behind (on when he
 * asked), and the stand-up on the hour within his hours on weekdays (on when he asked). The cadence decides if they go.
 */
export async function bodyPieces(d: PackDeps, said: (id: string) => boolean): Promise<{ card: ReturnType<typeof card>; why: string }[]> {
  const today = todayOf(d);
  const h = localHour(d.now(), d.tz);
  const out: { card: ReturnType<typeof card>; why: string }[] = [];
  const w = await load<Water | null>(d, BODY_KEYS.water, null);
  if (w?.on) {
    const n = w.d === today ? w.n : 0;
    for (const at of [11, 14, 17]) {
      const id = `body:water:nudge:${today}:${at}`;
      const expected = Math.round((w.goal * (at - 8)) / 14);
      if (h >= at && h < at + 1 && n < expected && !said(id)) {
        out.push({ card: card({ id, kind: 'progress', at: d.now(), title: 'A glass of water?', line: `${n} of ${w.goal} so far today`, progress: { frac: Math.min(1, n / w.goal) }, acts: [{ label: '+1 GLASS', run: { name: 'packs_do', args: { pack: 'body', action: 'water', args: { words: 'a glass' } } } }] }), why: 'you asked me to nudge you about water, and you were behind for the time of day' });
      }
    }
  }
  const s = await load<StandSet | null>(d, BODY_KEYS.stand, null);
  const hour = Math.floor(h);
  const id = `body:stand:${today}:${hour}`;
  if (s && standDue(s, hour, weekdayOf(today)) && h - hour < 0.5 && !said(id)) {
    out.push({ card: card({ id, kind: 'brief', at: d.now(), title: 'Stand up a minute', line: 'A stretch and a walk round: your hourly stand-up', brief: { icon: 'reminder' }, acts: [{ label: 'STRETCH SET', run: { name: 'open_body', args: { what: 'stretch' } } }] }), why: 'your hourly stand-up, which you turned on' });
  }
  return out;
}
