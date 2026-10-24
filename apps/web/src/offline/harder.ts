/**
 * THINK HARDER and the REPORT CARD on the phone: offline/think.ts's search and offline/bench.ts's test,
 * wired to the small model (offline/brain.ts offlineReply, a temperature and length per call) and to the
 * exact checks — a calculator and the examples in a coding question run in the sandbox (training/runner.ts)
 * here; Countdown sums and the fact book in the GYM's worker (gym/bench.ts), so the page never bundles the
 * gym's engines. One at a time: the model answers one thing at once.
 *
 * Only the phone's own model is used: THINK HARDER never asks a cloud model (ASK THE BIG BRAIN is a
 * separate button in the chat). The time it may take is set in SETTINGS → OFFLINE BRAIN (default 55 s).
 */
import { createStore } from '../core/store';
import type { GymOut } from '../gym/worker';
import { addRun, CATS, LOCAL_ITEMS, runBench, type BenchItem, type Run } from './bench';
import { currentModel, loadOffline, offlineBrain, offlinePrompt, offlineReady, offlineReply, withModel } from './brain';
import { asksForCode, codeOf, codeTests, sumCheck } from './exact';
import { starFromThink } from './star';
import { addStar } from './starbox';
import { PHONE_BUDGET, stepStructured, thinkHarder, type Checker, type Generate, type ThinkProgress, type ThinkResult } from './think';

type Reply = Extract<GymOut, { gym: 'reply' }>;

// ---------------------------------------------------------------------------------------
// The GYM's worker (its checks), started when first needed and ended when idle
// ---------------------------------------------------------------------------------------

let gw: Worker | null = null;
let gseq = 0;
let gidle: ReturnType<typeof setTimeout> | undefined;
const gwait = new Map<number, (m: Reply) => void>();

function gym(m: Record<string, unknown>): Promise<Reply> {
  clearTimeout(gidle);
  if (!gw) {
    gw = new Worker('/textures.worker.js');
    gw.onmessage = (e: MessageEvent) => {
      const r = e.data as GymOut;
      if (r.gym !== 'reply') return;
      gwait.get(r.req)?.(r);
      gwait.delete(r.req);
    };
    gw.onerror = (e) => {
      e.preventDefault();
      for (const f of gwait.values()) f({ gym: 'reply', req: 0, error: e.message || 'the gym worker stopped' });
      gwait.clear();
      gw?.terminate();
      gw = null;
    };
  }
  const req = ++gseq;
  return new Promise((resolve) => {
    gwait.set(req, (r) => {
      clearTimeout(gidle);
      gidle = setTimeout(() => {
        if (gwait.size) return;
        gw?.terminate();
        gw = null;
      }, 30_000);
      resolve(r);
    });
    gw!.postMessage({ ...m, req });
  });
}

// ---------------------------------------------------------------------------------------
// The model, one call at a time
// ---------------------------------------------------------------------------------------

/** offlineReply as THINK HARDER's model: the whole reply at the temperature and length asked, with the tokens it really wrote. */
const gen: Generate = async (messages, o) => {
  const r = await offlineReply(messages, () => undefined, o.signal, { temperature: o.temperature, max: o.max });
  return { text: r.text, tokens: r.tokens };
};

/** What is using the model now ('' = nothing). */
export const thinking = createStore({ busy: '' as '' | 'think' | 'bench' });

/** Whether the offline brain is on this phone, so the chat offers THINK HARDER only where it can work. */
export const canThink = createStore({ ready: false });
/** Look again (after a download or delete, or when the chat opens). */
export function recheckThink(): void {
  void offlineReady()
    .then((r) => {
      if (canThink.get().ready !== r) canThink.set({ ready: r });
    })
    .catch(() => undefined);
}
offlineBrain.subscribe((st, prev) => {
  if (st.downloaded !== prev.downloaded || st.model !== prev.model) recheckThink();
  // The phone switched model — a new trained week from the weekly self-training (its sync, a ROLLBACK, or the
  // owner's choice in SETTINGS): the report card offers a re-check (NEW MODEL). Defined below; called later.
  if (st.model !== prev.model) onNewModel();
});

/** The exact check for a chat question, if there is one: a sum, code with examples, a Countdown sum or a fact-book question. */
export async function exactFor(question: string): Promise<Checker | null> {
  const s = sumCheck(question);
  if (s) return s;
  const tests = asksForCode(question) ? codeTests(question) : null;
  if (tests)
    return {
      label: 'running the code on your examples',
      kind: 'verifier',
      check: async (reply) => {
        const code = codeOf(reply);
        if (!code) return { correct: false, score: 0, why: 'no code' };
        const { runTests } = await import('../training/runner');
        const r = await runTests(code, tests.entry, tests.tests, 3000);
        if ('error' in r) return { correct: false, score: 0, why: r.error };
        const ok = r.results.filter((x) => x.ok).length;
        return { correct: ok === tests.tests.length, score: ok / tests.tests.length, why: `${ok} of ${tests.tests.length} examples pass` };
      },
    };
  const g = await gym({ gym: 'exact', question }).catch(() => null);
  if (!g?.exact) return null;
  const { label, kind } = g.exact;
  return {
    label,
    kind,
    check: async (reply) => (await gym({ gym: 'exact', question, reply }).catch(() => null))?.verdict ?? null,
  };
}

let ctl: AbortController | null = null;

/** Stop THINK HARDER or the report card (the owner said "stop", or pressed STOP): the best so far is kept. */
export function stopThinking(): void {
  ctl?.abort();
}

const notReady = () => new Error("THINK HARDER uses the offline brain on this phone, and it isn't downloaded yet: Settings → Offline brain → DOWNLOAD (on Wi-Fi).");

/** THINK HARDER's share of the prompt for what the phone knows (memory, agenda, library, recent turns): it is asked many times. */
const CONTEXT_BUDGET = 700;

/**
 * THINK HARDER on one question, with the phone's model only, knowing what an ordinary offline answer knows
 * (`recent`: the conversation before it). The model is loaded first, so the time budget is all thinking.
 */
export async function thinkHere(question: string, recent: { role: 'user' | 'assistant'; text: string }[], onProgress: (p: ThinkProgress) => void): Promise<ThinkResult> {
  if (!(await offlineReady().catch(() => false))) throw notReady();
  const mine = new AbortController();
  return withModel(
    'think',
    async () => {
      ctl = mine;
      thinking.set({ busy: 'think' });
      try {
        onProgress({ phase: 'trying', attempts: 0, planned: PHONE_BUDGET.attempts, agree: 0, line: 'getting ready (loading the model, looking for a check)…', elapsed: 0 });
        const [checker, msgs] = await Promise.all([exactFor(question).catch(() => null), offlinePrompt(question, recent, CONTEXT_BUDGET), loadOffline()]);
        if (mine.signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
        const secs = Math.max(10, Math.min(300, offlineBrain.get().thinkSecs || 55));
        const result = await thinkHarder(question, {
          gen,
          checker,
          steps: stepStructured(question),
          budget: { ...PHONE_BUDGET, ms: secs * 1000, tokens: Math.round((PHONE_BUDGET.tokens * secs) / 55) },
          onProgress,
          signal: mine.signal,
          context: { system: msgs[0]?.content, recent: msgs.slice(1, -1) },
        });
        // The search teaches the brain: an answer an exact check passed becomes a lesson for next week's brain
        // (offline/star.ts: never an unchecked or voted one; at most a few a day).
        addStar(starFromThink(question, result));
        return result;
      } finally {
        if (ctl === mine) ctl = null;
        thinking.set({ busy: '' });
      }
    },
    { wait: false },
  );
}

// ---------------------------------------------------------------------------------------
// The report card
// ---------------------------------------------------------------------------------------

/** The model and the commit its files come from: a new one (Stage 2's weekly model) means a new check. */
export const modelKey = (): string => {
  // The model and the commit its files come from: a trained week's own (offline/models.ts trainedModels) or a stock pin.
  const m = currentModel();
  return `${m.id}@${m.rev.slice(0, 7)}`;
};

/** The report card's history on this phone, and whether the model changed since it was last checked. */
export const reportCard = createStore(
  { history: [] as Run[], checked: '', live: null as Run | null, line: '', done: 0, total: 0 },
  { persist: 'ghosty.reportcard', keys: ['history', 'checked'] },
);

/** A new model is on the phone since the last check (the hook for Stage 2's weekly model). */
export const needsCheck = (): boolean => reportCard.get().checked !== modelKey();

/**
 * Stage 2 calls this when it has put a new model on the phone: the report card says so, and runs
 * by itself when `run` is true (only on a phone that is idle — it takes minutes and warms the phone).
 */
export function onNewModel(run = false): void {
  // The key names the model and its commit, so a new one already reads as unchecked: repaint, and maybe run.
  reportCard.set({});
  if (run && needsCheck() && !thinking.get().busy) void runReportCard(true).catch(() => undefined);
}

/** The questions, in the order of the kinds (sums, logic, facts, instructions, tools). */
async function benchItems(): Promise<BenchItem[]> {
  const r = await gym({ gym: 'bench' });
  if (r.error || !r.items) throw new Error(`The gym's questions could not be made: ${r.error ?? 'no answer'}`);
  const all: BenchItem[] = [...LOCAL_ITEMS.map(({ id, cat, text, steps, check }) => ({ id, cat, text, steps, check })), ...r.items];
  return CATS.flatMap((c) => all.filter((x) => x.cat === c.id));
}

/** Run the report card now (with THINK HARDER as well, or the quick check without). */
export async function runReportCard(withThink: boolean): Promise<Run> {
  if (!(await offlineReady().catch(() => false))) throw notReady();
  return withModel('bench', () => benchNow(withThink), { wait: false });
}

async function benchNow(withThink: boolean): Promise<Run> {
  const mine = new AbortController();
  ctl = mine;
  thinking.set({ busy: 'bench' });
  reportCard.set({ live: null, line: 'getting the questions ready…', done: 0, total: 0 });
  try {
    // Loaded first: the first question's time is the model's answer, not the loading.
    const [items] = await Promise.all([benchItems(), loadOffline()]);
    const run = await runBench({
      gen,
      judge: async (id, reply) => !!(await gym({ gym: 'judge', id, reply })).verdict?.correct,
      items,
      withThink,
      model: modelKey(),
      signal: mine.signal,
      onProgress: (done, total, line, partial) => reportCard.set({ live: { ...partial, items: [...partial.items] }, line, done, total }),
    });
    // A stopped run is kept (marked partial) so its numbers aren't lost; only a whole run counts as checked.
    reportCard.set((s) => ({ history: addRun(s.history, run), live: null, line: '', ...(run.complete ? { checked: run.model } : {}) }));
    return run;
  } finally {
    if (ctl === mine) ctl = null;
    thinking.set({ busy: '' });
    if (reportCard.get().live) reportCard.set({ live: null, line: '' });
  }
}
