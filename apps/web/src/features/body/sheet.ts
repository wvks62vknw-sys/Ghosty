/**
 * THE BODY PACK on the phone (BRIEF-PACKS-1 item 2): the screens that need the phone's own camera, GPS and clock, each a
 * sheet over whatever is showing (the open_body command; the chat's "count my squats", "start a run", "breathe"…):
 *  - REPS: the pose model counts squats, push-ups or star jumps on the phone and says each one; nothing leaves it;
 *  - RUN: the phone's GPS while the screen is on, pace and distance said each kilometre; RUN SAVED sends my brain only the
 *    distance, the time and the splits, never a position;
 *  - BREATHE: box (4-4-4-4) or 4-7-8 breathing with the screen and a buzz; STRETCH: the set with a timer;
 *  - HEALTH: an Apple Health export read here, in code (steps and sleep for the week);
 *  - WATER, SLEEP, STEPS, WEIGHT and MOOD: the trackers, each a whole app kept on this phone only (./track.ts);
 *  - TABLETS: tablets and supplements with lock-screen reminders through my brain's push, ticks and a refill countdown (./meds.ts).
 * The state sits on window.__ghosty.body for the specs.
 */
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';

export type BodyWhat = 'reps' | 'run' | 'breathe' | 'stretch' | 'health' | 'water' | 'sleep' | 'steps' | 'weight' | 'mood' | 'meds' | 'week' | 'fast' | 'measure' | 'gym' | 'symptoms';
/** Each screen's name, as its sheet's title and as its panel on the BODY screen (features/body/index.ts). */
export const BODY_TITLES: Record<BodyWhat, string> = { reps: 'COUNT MY REPS', run: 'RUNNING COACH', breathe: 'BREATHE', stretch: 'STRETCH SET', health: 'MY HEALTH WEEK', water: 'WATER TODAY', sleep: 'SLEEP', steps: 'STEPS', weight: 'WEIGHT', mood: 'MOOD', meds: 'TABLETS', week: 'YOUR WEEK', fast: 'FASTING', measure: 'MEASUREMENTS', gym: 'GYM LOG', symptoms: 'SYMPTOM DIARY' };
const TITLES = BODY_TITLES;

/** What the screens are doing, for the specs (window.__ghosty.body). */
export const bodyState = {
  open: '' as '' | BodyWhat,
  exercise: '',
  reps: 0,
  engine: '' as '' | 'pose' | 'stand-in' | 'none',
  camera: '' as '' | 'on' | 'off' | 'refused',
  hint: '',
  run: { on: false, km: 0, secs: 0, splits: 0, saved: false },
  breath: { say: '', round: 0 },
  stretch: { i: -1, left: 0 },
  health: { read: 0, avgSteps: null as number | null, avgSleep: null as number | null },
  error: '',
};

/** One screen: its content and what stops it (the camera, the GPS, a timer) when the sheet closes. */
export interface Screen {
  el: HTMLElement;
  stop(): void;
}

let open: { close(): void } | null = null;
let stopNow: (() => void) | null = null;

/** One screen, made by its own file (the sheet's, and the BODY screen's panels: features/body/index.ts). */
export async function bodyScreen(w: BodyWhat, args: Record<string, unknown> = {}): Promise<Screen> {
  expose();
  return w === 'reps' ? (await import('./reps')).repsScreen(String(args.exercise ?? 'squats'))
    : w === 'run' ? (await import('./run')).runScreen()
    : w === 'breathe' ? (await import('./calm')).breatheScreen(args.pattern === '478' ? '478' : 'box')
    : w === 'stretch' ? (await import('./calm')).stretchScreen()
    : w === 'health' ? (await import('./health')).healthScreen()
    : w === 'meds' ? (await import('./meds')).medsScreen()
    : w === 'week' ? await (await import('./week')).weekScreen()
    : w === 'fast' ? (await import('./more')).fastScreen()
    : w === 'measure' ? (await import('./more')).measureScreen()
    : w === 'gym' ? (await import('./more')).gymScreen()
    : w === 'symptoms' ? (await import('./more')).symptomScreen()
    : (await import('./track')).trackScreen(w);
}

export async function openBody(what: string, args: Record<string, unknown> = {}): Promise<void> {
  const w = (Object.keys(TITLES) as BodyWhat[]).includes(what as BodyWhat) ? (what as BodyWhat) : 'reps';
  closeBody();
  let s: Screen;
  try {
    s = await bodyScreen(w, args);
  } catch (e) {
    toast(sayError(e, 'open that'), 'warn');
    return;
  }
  bodyState.open = w;
  stopNow = s.stop;
  open = modal(TITLES[w], h('div.pk', { dataset: { pack: 'body', screen: w } }, s.el), () => {
    stopNow?.();
    stopNow = null;
    open = null;
    bodyState.open = '';
  });
}

export function closeBody(): void {
  open?.close();
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.body = bodyState;
}
