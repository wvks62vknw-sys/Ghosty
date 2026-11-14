/**
 * His routine words in the chat (NEXT-ROUND consistency.s2; the routines themselves: assistant/routines.ts). Said or typed, on the
 * phone and with no model: the reply says what it will do in order, with a key for each step, then each step runs in turn (a
 * screen opens, a command of the app runs, his words go to Ghosty as his own message, where APPROVE stops anything that would
 * send). "make a routine" / "my routines" opens Settings → ROUTINES.
 */
import { answer } from './local';
import { loadRoutines, routineFor, ROUTINES_ASKED, runLine, type Routine, type RoutineAct } from './routines';

interface Opts {
  voice?: boolean;
  private?: boolean;
}

/** The pause between two screens, so he sees each one arrive; words to Ghosty wait for the reply before them instead. */
const BETWEEN_MS = 900;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The routine running now, if any (a second word while one runs starts after it, never on top of it). */
let running: Promise<void> | null = null;
/** For the spec: the last routine run and how far it got. */
export const routineState = { word: '', done: 0, of: 0 };

/** True while a step's words are being sent: a routine's words never start a routine (no loops). */
let inStep = false;

async function step(a: RoutineAct): Promise<void> {
  if ('ask' in a) {
    const s = await import('./session');
    inStep = true;
    try {
      await s.send(a.ask);
    } finally {
      inStep = false;
    }
    return;
  }
  const l = await import('../shell/launcher');
  l.perform(a);
  await wait(BETWEEN_MS);
}

export async function runRoutine(r: Routine): Promise<void> {
  const go = async () => {
    Object.assign(routineState, { word: r.word, done: 0, of: r.steps.length });
    for (const s of r.steps) {
      await step(s.act).catch(() => undefined);
      routineState.done++;
    }
  };
  running = (running ?? Promise.resolve()).then(go, go);
  return running;
}

export async function routineTurn(text: string, opts: Opts = {}): Promise<boolean> {
  if (inStep) return false;
  if (ROUTINES_ASKED.test(text.trim())) {
    const n = loadRoutines().length;
    answer(text, n ? `Your routines are in Settings → ROUTINES: ${n === 1 ? 'one' : n} so far. Say a routine's word and I run it.` : 'Routines are made in Settings → ROUTINES: one word of yours that runs a few things in turn, like “morning”.', { kind: 'routine', go: [{ id: 'routines', ask: -1, label: 'OPEN ROUTINES', open: 'settings', panel: 'ROUTINES' }] }, opts);
    return true;
  }
  const r = routineFor(text, loadRoutines());
  if (!r) return false;
  answer(text, runLine(r), {
    kind: 'routine',
    go: r.steps.filter((s) => !('ask' in s.act)).slice(0, 4).map((s, i) => ({ id: `routine:${i}`, ask: -1, label: s.label.split(':')[0]!.toUpperCase(), ...('open' in s.act ? { open: s.act.open, ...(s.act.panel ? { panel: s.act.panel } : {}) } : 'run' in s.act ? { run: s.act.run, args: s.act.args ?? {} } : {}) })),
  }, opts);
  void runRoutine(r);
  return true;
}
