/**
 * THE BODY PACK on the phone (BRIEF-PACKS-1 item 2): the screens that need the phone's own camera, GPS and clock, each a
 * sheet over whatever is showing (the open_body command; the chat's "count my squats", "start a run", "breathe"…):
 *  - REPS: the pose model counts squats, push-ups or star jumps on the phone and says each one; nothing leaves it;
 *  - RUN: the phone's GPS while the screen is on, pace and distance said each kilometre; RUN SAVED sends my brain only the
 *    distance, the time and the splits, never a position;
 *  - BREATHE: box (4-4-4-4) or 4-7-8 breathing with the screen and a buzz; STRETCH: the set with a timer;
 *  - HEALTH: an Apple Health export read here, in code (steps and sleep for the week); WATER: a glass a tap.
 * The state sits on window.__ghosty.body for the specs.
 */
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { brain } from '../../api/brain';

export type BodyWhat = 'reps' | 'run' | 'breathe' | 'stretch' | 'health' | 'water';
const TITLES: Record<BodyWhat, string> = { reps: 'COUNT MY REPS', run: 'RUNNING COACH', breathe: 'BREATHE', stretch: 'STRETCH SET', health: 'MY HEALTH WEEK', water: 'WATER TODAY' };

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
  water: { n: 0, goal: 8 },
  error: '',
};

/** One screen: its content and what stops it (the camera, the GPS, a timer) when the sheet closes. */
export interface Screen {
  el: HTMLElement;
  stop(): void;
}

let open: { close(): void } | null = null;
let stopNow: (() => void) | null = null;

export async function openBody(what: string, args: Record<string, unknown> = {}): Promise<void> {
  const w = (Object.keys(TITLES) as BodyWhat[]).includes(what as BodyWhat) ? (what as BodyWhat) : 'reps';
  closeBody();
  expose();
  let s: Screen;
  try {
    s =
      w === 'reps' ? (await import('./reps')).repsScreen(String(args.exercise ?? 'squats'))
      : w === 'run' ? (await import('./run')).runScreen()
      : w === 'breathe' ? (await import('./calm')).breatheScreen(args.pattern === '478' ? '478' : 'box')
      : w === 'stretch' ? (await import('./calm')).stretchScreen()
      : w === 'health' ? (await import('./health')).healthScreen()
      : waterScreen();
  } catch (e) {
    toast(`That screen didn’t open: ${(e as Error).message}`, 'warn');
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

/** WATER: a glass a tap, kept in my brain (it nudges only when you asked, under the speak-first dial). */
function waterScreen(): Screen {
  const count = h('b.pkbig', { 'aria-live': 'polite' }, '…');
  const note = h('p.pknote', 'A glass is 250 ml. Kept in my brain; I nudge you only if you ask me to.');
  const paint = (text: string) => {
    const m = /(\d+) of (\d+)/.exec(text);
    if (m) {
      bodyState.water = { n: +m[1]!, goal: +m[2]! };
      count.textContent = `${m[1]} of ${m[2]}`;
    }
  };
  const act = async (words: string) => {
    try {
      paint((await brain.packDo('body', 'water', { words })).text);
    } catch (e) {
      toast(`My brain didn’t answer: ${(e as Error).message}`, 'warn');
    }
  };
  void act('');
  const el = h(
    'div.pkcol',
    h('div.pkhero', count, h('span.pklab', 'glasses today')),
    h('div.pkrow', button('+1 glass', () => void act('a glass'), 'on'), button('Undo', () => void act('undo'))),
    h('div.pkrow', button('Nudge me', () => void act('remind me')), button('No nudges', () => void act('stop reminding me'))),
    note,
  );
  return { el, stop: () => undefined };
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.body = bodyState;
}
