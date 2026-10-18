/**
 * THINK HARDER: the small model on the phone spends more effort on one question to get a better answer
 * (test-time search). It is the offline brain's own effort: no cloud model is asked.
 *
 * 1. Several attempts, each a different way in (answer directly, short numbered steps, solve then check
 *    a second way, say what is asked first) at different temperatures, so they don't all make the same slip.
 * 2. When the problem goes in steps (a sum, a word problem, a logic puzzle, a gym problem), the rest of the
 *    attempts come from a small Monte Carlo tree search over reasoning steps: a path of steps is grown one
 *    line at a time, each new step is finished off (a rollout) and scored, the score is backed up the path,
 *    and the next step is grown under the path that has done best so far (UCT), so effort goes where answers
 *    come good.
 * 3. Each attempt is scored by an exact check when there is one (the gym's own check(), a calculator, the
 *    fact book, running the code against the question's examples), otherwise by agreement: attempts that
 *    give the same answer vote for it, and the leading answers are put back to the model to check (YES/NO).
 * 4. The answer comes back with an honest confidence ("checked exactly", "4 of 6 attempts agree", "none
 *    passed the check"), and the search stops early once an attempt passes the exact check or enough agree.
 *
 * Bounded by a budget (time, attempts, words written) suited to an iPhone 13, cancellable at any point
 * (the best answer so far is kept), and it waits between model calls so the page never freezes (the
 * model itself runs in its worker). Pure apart from timers: the model and the checks are passed in, so
 * apps/edge/test/thinkharder.test.mjs drives it with a fake model.
 */
import { answerOf, normAnswer } from './exact';
import type { OfflineMsg } from './prompt';

export interface GenOpts {
  temperature: number;
  /** Most tokens this call may write. */
  max: number;
  signal: AbortSignal;
}
/** The model: messages in, the whole reply out. */
export type Generate = (messages: OfflineMsg[], opts: GenOpts) => Promise<string>;

export interface Check {
  correct: boolean;
  /** 0–1: how close (1 = right). */
  score: number;
  why: string;
}

export interface Checker {
  /** What it checks with, in words: "the gym's rules", "a calculator", "the fact book", "running the code". */
  label: string;
  /**
   * 'verifier': it checks an answer without knowing it beforehand (a Countdown sum is worked out, code is
   * run against examples) · 'key': it compares with an answer it already holds (the fact book, a sum's value).
   * The report card uses only verifiers, so its THINK HARDER score is the model's own.
   */
  kind: 'verifier' | 'key';
  /** null: this check can't judge that reply. */
  check(reply: string, answer: string): Promise<Check | null> | Check | null;
}

export interface Budget {
  /** Wall time in ms. */
  ms: number;
  /** Most complete attempts. */
  attempts: number;
  /** Most tokens the model may write in all (estimated from the text). */
  tokens: number;
  /** Stop early once this many attempts agree (and no other answer has half as many). */
  agree: number;
  /** Most tokens one attempt may write. */
  answerTokens: number;
}

/** About a minute on an iPhone 13 (Qwen3-0.6B writes roughly 10–20 tokens a second there — not yet measured on one). */
export const PHONE_BUDGET: Budget = { ms: 55_000, attempts: 6, tokens: 1800, agree: 3, answerTokens: 260 };

export interface Attempt {
  /** The whole reply. */
  text: string;
  /** Its answer line. */
  answer: string;
  /** The answer in one form (exact.ts normAnswer), for counting agreement. */
  key: string;
  /** Which way in: 'direct' | 'steps' | 'check' | 'restate' | 'tree'. */
  how: string;
  temperature: number;
  tokens: number;
  check?: Check | null;
  /** The model's own YES/NO when asked to check this answer. */
  verified?: boolean | null;
}

export interface ThinkProgress {
  phase: 'trying' | 'tree' | 'checking' | 'done';
  attempts: number;
  planned: number;
  /** Attempts that agree with the leading answer. */
  agree: number;
  /** Plain words for the owner: "trying 6 approaches… 3 done · 2 agree". */
  line: string;
  elapsed: number;
}

export interface ThinkResult {
  answer: string;
  /** The chosen attempt's whole reply (its working). */
  text: string;
  /** checked: passed an exact check · agree: most attempts agree · split: no clear winner · failed-check: none passed the exact check · none: no answer at all. */
  confidence: 'checked' | 'agree' | 'split' | 'failed-check' | 'none';
  /** The honest line: "checked exactly (a calculator)", "4 of 6 attempts agree", … */
  line: string;
  attempts: Attempt[];
  agree: number;
  ms: number;
  tokens: number;
  stoppedEarly: boolean;
  /** The owner stopped it: this is the best so far. */
  stopped: boolean;
  outOfTime: boolean;
  checkedBy?: string;
}

export interface ThinkDeps {
  gen: Generate;
  checker?: Checker | null;
  budget?: Partial<Budget>;
  onProgress?: (p: ThinkProgress) => void;
  signal?: AbortSignal;
  /** Treat the question as one that goes in steps (tree search); otherwise guessed from its words. */
  steps?: boolean;
  /** The clock (ms); tests pass a fake one. */
  now?: () => number;
  /** A name for the system line ("Ghosty"). */
  name?: string;
}

/** The ways in, in the order they are tried (each also at its own temperature). */
export const APPROACHES: { how: string; t: number; say: string }[] = [
  { how: 'direct', t: 0.3, say: 'Answer the question carefully and briefly.' },
  { how: 'steps', t: 0.7, say: 'Work it out in short numbered steps, one line each.' },
  { how: 'check', t: 0.8, say: 'Solve it, then check the result a different way; if the check disagrees, fix it.' },
  { how: 'restate', t: 0.9, say: 'First say in one line what is asked and what is given, then solve it step by step.' },
  { how: 'steps', t: 1.0, say: 'Think about it step by step, one short line a step.' },
  { how: 'direct', t: 0.7, say: 'Answer the question carefully and briefly.' },
];
const END = 'End with one last line: ANSWER: <the answer only>.';

/** A question that goes in steps: a sum with two or more operations, a word problem with numbers, a logic puzzle. */
export function stepStructured(q: string): boolean {
  if ((q.match(/\d\s*[-+*/×÷^x]\s*(?=[\d(])/g) ?? []).length >= 2) return true;
  if ((q.match(/\d+/g) ?? []).length >= 2 && /\b(?:each|total|how many|how much|left|per|more than|less than|times as|altogether|average|reach)\b/i.test(q)) return true;
  return /\b(?:premises?|valid|invalid|clues?|whoever|logic|puzzle|deduce|therefore|if and only if)\b/i.test(q);
}

/** A careful guess at tokens (as offline/prompt.ts estimates them). */
const tokensIn = (s: string) => Math.ceil(s.length / 3.5);
const pause = () => new Promise<void>((r) => setTimeout(r, 0));
const aborted = () => Object.assign(new Error('stopped'), { name: 'AbortError' });
const clean = (s: string) => s.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<\|im_end\|>|<\|endoftext\|>/g, '').trim();

interface Node {
  steps: string[];
  parent: Node | null;
  kids: Node[];
  n: number;
  w: number;
  /** The path ended with an answer (or got too long): no more steps under it. */
  done: boolean;
}
const WIDTH = 2;
const DEPTH = 6;
const UCT_C = 1.2;

/** Group attempts by answer: [key, attempts] with the most first (ties: the earlier answer first). */
export function tally(attempts: Attempt[]): [string, Attempt[]][] {
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) if (a.key) groups.set(a.key, [...(groups.get(a.key) ?? []), a]);
  const weight = (as: Attempt[]) => as.length + as.reduce((s, a) => s + (a.verified === true ? 0.5 : a.verified === false ? -0.5 : 0), 0);
  return [...groups.entries()].sort((x, y) => weight(y[1]) - weight(x[1]));
}

/** Search for the best answer to one question within the budget. */
export async function thinkHarder(question: string, deps: ThinkDeps): Promise<ThinkResult> {
  const B: Budget = { ...PHONE_BUDGET, ...deps.budget };
  const now = deps.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const t0 = now();
  const owner = deps.signal;
  const checker = deps.checker ?? null;
  const stepwise = deps.steps ?? stepStructured(question);
  const sys = (say: string) => `You are ${deps.name ?? 'Ghosty'}, a careful assistant on a phone, offline. ${say} ${END}`;
  const attempts: Attempt[] = [];
  let tokens = 0;
  let outOfTime = false;
  let stoppedEarly = false;
  let phase: ThinkProgress['phase'] = 'trying';

  // The deadline stops a reply being written, not just the next one.
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), Math.max(0, B.ms));
  const onOwner = () => deadline.abort();
  owner?.addEventListener('abort', onOwner, { once: true });

  const agreeing = () => tally(attempts)[0]?.[1].length ?? 0;
  const report = (line?: string) => {
    const agree = agreeing();
    const n = attempts.length;
    const words =
      line ??
      (phase === 'tree'
        ? `going step by step… ${n} of ${B.attempts} tries${agree >= 2 ? ` · ${agree} agree` : ''}`
        : `trying ${B.attempts} approaches… ${n} done${agree >= 2 ? ` · ${agree} agree` : ''}`);
    deps.onProgress?.({ phase, attempts: n, planned: B.attempts, agree, line: words, elapsed: now() - t0 });
  };
  /** Room for another model call of about this many tokens: false once the owner stopped it or the budget is spent. */
  const room = (want = 1): boolean => {
    if (owner?.aborted) return false;
    if (deadline.signal.aborted || now() - t0 >= B.ms) {
      outOfTime = true;
      return false;
    }
    return B.tokens - tokens >= Math.min(want, 24);
  };
  const ask = async (messages: OfflineMsg[], temperature: number, max: number): Promise<string | null> => {
    const cap = Math.max(8, Math.min(max, B.tokens - tokens));
    try {
      const out = await deps.gen(messages, { temperature, max: cap, signal: deadline.signal });
      if (deadline.signal.aborted) throw aborted();
      const t = clean(out);
      tokens += Math.min(cap, tokensIn(t));
      return t;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || deadline.signal.aborted) {
        if (!owner?.aborted) outOfTime = true;
        return null;
      }
      throw e;
    } finally {
      await pause();
    }
  };
  const judge = async (a: Attempt): Promise<void> => {
    if (!checker) return;
    try {
      a.check = await checker.check(a.text, a.answer);
    } catch {
      a.check = null;
    }
  };
  /** Settled already: an attempt passed the exact check, or enough agree and nothing else comes close. */
  const settled = (): boolean => {
    if (attempts.some((a) => a.check?.correct)) return true;
    const t = tally(attempts);
    const top = t[0]?.[1].length ?? 0;
    const next = t[1]?.[1].length ?? 0;
    // With an exact check that has failed them all, agreement on a wrong answer is no reason to stop.
    if (checker && attempts.some((a) => a.check) && !attempts.some((a) => a.check?.correct)) return false;
    return top >= B.agree && next * 2 < top;
  };
  const add = async (text: string, how: string, temperature: number): Promise<Attempt> => {
    const answer = answerOf(text);
    const a: Attempt = { text, answer, key: normAnswer(answer), how, temperature, tokens: tokensIn(text) };
    attempts.push(a);
    await judge(a);
    return a;
  };

  try {
    // ---- 1. different ways in -----------------------------------------------------------------------
    report();
    const first = stepwise ? Math.min(3, B.attempts) : B.attempts;
    for (let i = 0; i < first && attempts.length < B.attempts; i++) {
      if (!room(B.answerTokens / 2)) break;
      const ap = APPROACHES[i % APPROACHES.length]!;
      const text = await ask([{ role: 'system', content: sys(ap.say) }, { role: 'user', content: question }], ap.t, B.answerTokens);
      if (text === null) break;
      await add(text, ap.how, ap.t);
      report();
      if (settled()) {
        stoppedEarly = attempts.length < B.attempts;
        break;
      }
    }

    // ---- 2. tree search over reasoning steps ----------------------------------------------------------
    if (stepwise && !settled() && attempts.length < B.attempts && room(B.answerTokens / 2)) {
      phase = 'tree';
      report();
      const root: Node = { steps: [], parent: null, kids: [], n: 0, w: 0, done: false };
      const stepSys = sys('Solve it one short step at a time.');
      const listed = (steps: string[]) => (steps.length ? `\nSteps so far:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '');
      /** How good an attempt looks: the exact check's score, else how many other attempts agree with it. */
      const value = (a: Attempt): number => {
        if (a.check) return a.check.correct ? 1 : a.check.score * 0.8;
        if (!a.key) return 0;
        const same = attempts.filter((x) => x.key === a.key).length - 1;
        return Math.min(1, same / Math.max(1, attempts.length - 1));
      };
      let guard = 0;
      while (attempts.length < B.attempts && !settled() && guard++ < B.attempts * 4) {
        // Select: down the tree by UCT to a path that can still grow.
        let node = root;
        while (node.kids.length >= WIDTH) {
          const open = node.kids.filter((k) => !k.done);
          // Every path under it has ended: grow one more beside them (a wider tree).
          if (!open.length) break;
          const parentN = Math.max(1, node.n);
          node = open.reduce((best, k) => {
            const u = (x: Node) => (x.n ? x.w / x.n : 0.5) + UCT_C * Math.sqrt(Math.log(parentN + 1) / (x.n + 1));
            return u(k) > u(best) ? k : best;
          });
        }
        if (node.done) break;
        // Expand: one more step under it.
        if (!room(48)) break;
        const stepText = await ask(
          [{ role: 'system', content: stepSys }, { role: 'user', content: `${question}${listed(node.steps)}\nWrite only the next step, one line. If the answer is clear now, write the line ANSWER: <the answer only> instead.` }],
          0.9,
          48,
        );
        if (stepText === null) break;
        const line = stepText.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
        const finished = /^\W*(?:final\s+)?answer\s*[:：]/i.test(line) || node.steps.length + 1 >= DEPTH;
        const child: Node = { steps: line ? [...node.steps, line.replace(/^\d+[.)]\s*/, '')] : node.steps, parent: node, kids: [], n: 0, w: 0, done: finished || !line };
        node.kids.push(child);
        // Evaluate: an answer already, or finish the path off (rollout) and score that.
        let text: string | null;
        if (/answer\s*[:：]/i.test(line)) text = child.steps.join('\n');
        else {
          if (!room(B.answerTokens / 2)) break;
          const rest = await ask(
            [{ role: 'system', content: stepSys }, { role: 'user', content: `${question}${listed(child.steps)}\nContinue from these steps to the answer. ${END}` }],
            0.6,
            B.answerTokens,
          );
          if (rest === null) break;
          text = `${child.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n${rest}`;
        }
        const a = await add(text, 'tree', 0.9);
        const v = value(a);
        // Back the score up the path.
        for (let x: Node | null = child; x; x = x.parent) {
          x.n++;
          x.w += v;
        }
        report();
      }
      if (settled() && attempts.length < B.attempts) stoppedEarly = true;
    }

    // ---- 3. no exact check: the model checks its leading answers --------------------------------------
    const t = tally(attempts);
    const exact = attempts.some((a) => a.check);
    if (!exact && t.length && !settled() && !owner?.aborted) {
      phase = 'checking';
      report('checking its own answers…');
      for (const [, group] of t.slice(0, 2)) {
        if (!room(6)) break;
        const a = group[0]!;
        const said = await ask(
          [
            { role: 'system', content: 'You check answers. Reply with one word: YES or NO.' },
            { role: 'user', content: `Question: ${question}\nProposed answer: ${a.answer}\nIs the proposed answer correct?` },
          ],
          0.1,
          6,
        );
        if (said === null) break;
        const v = /\byes\b/i.test(said) && !/\bno\b/i.test(said) ? true : /\bno\b/i.test(said) ? false : null;
        for (const x of group) x.verified = v;
      }
    }
  } finally {
    clearTimeout(timer);
    owner?.removeEventListener('abort', onOwner);
  }

  if (!attempts.length && owner?.aborted) throw aborted();
  const result = pickBest(attempts, checker, { ms: now() - t0, tokens, stoppedEarly, stopped: !!owner?.aborted, outOfTime: outOfTime && !owner?.aborted });
  phase = 'done';
  report(result.line);
  return result;
}

/** The best attempt and the honest words for how sure it is. */
export function pickBest(attempts: Attempt[], checker: Checker | null, run: { ms: number; tokens: number; stoppedEarly: boolean; stopped: boolean; outOfTime: boolean }): ThinkResult {
  const base = { attempts, ...run };
  const n = attempts.length;
  const tries = (k: number) => `${k} ${k === 1 ? 'attempt' : 'attempts'}`;
  const tail = run.stopped ? ' (stopped early by you: best so far)' : run.outOfTime ? ' (out of time)' : '';
  if (!n) return { ...base, answer: '', text: '', confidence: 'none', line: `no answer${tail || ' (the model wrote nothing)'}`, agree: 0 };
  const passed = attempts.filter((a) => a.check?.correct);
  const t = tally(attempts);
  if (passed.length) {
    // The calmest attempt that passed (lowest temperature), its group's size as agreement.
    const a = [...passed].sort((x, y) => x.temperature - y.temperature)[0]!;
    const agree = t.find(([k]) => k === a.key)?.[1].length ?? 1;
    return { ...base, answer: a.answer, text: a.text, confidence: 'checked', line: `checked exactly (${checker?.label ?? 'an exact check'}) · ${passed.length} of ${tries(n)} passed${tail}`, agree, checkedBy: checker?.label };
  }
  if (checker && attempts.some((a) => a.check)) {
    // An exact check judged them and none passed: the closest, said plainly.
    const a = [...attempts].sort((x, y) => (y.check?.score ?? -1) - (x.check?.score ?? -1))[0]!;
    const agree = t.find(([k]) => k === a.key)?.[1].length ?? 1;
    return { ...base, answer: a.answer, text: a.text, confidence: 'failed-check', line: `none of ${tries(n)} passed the check (${checker.label}): best guess, don't trust it${tail}`, agree, checkedBy: checker.label };
  }
  if (!t.length) {
    const a = attempts[0]!;
    return { ...base, answer: a.answer, text: a.text, confidence: 'none', line: `no clear answer in ${tries(n)}${tail}`, agree: 0 };
  }
  const [, group] = t[0]!;
  const second = t[1]?.[1].length ?? 0;
  const a = [...group].sort((x, y) => x.temperature - y.temperature)[0]!;
  const agree = group.length;
  const own = group[0]!.verified === true ? ' · it checked the answer and says yes' : group[0]!.verified === false ? ' · when asked, it doubted this answer' : '';
  const clear = agree >= 2 && agree > second;
  return {
    ...base,
    answer: a.answer,
    text: a.text,
    confidence: clear ? 'agree' : 'split',
    line: `${agree} of ${tries(n)} agree${clear ? '' : ': no clear winner'}${own}${tail}`,
    agree,
  };
}

/** "think harder" in a message: the question that follows it, '' for "think harder" alone (the last question), null if not asked. */
export function thinkAsk(text: string): string | null {
  const m = text.trim().match(/^(?:please\s+)?(?:think\s+harder|think\s+hard(?:\s+about(?:\s+this)?)?|try\s+harder)\b[\s:,.!-]*(?:about|on)?\s*(?:this|that|it)?[\s:,.?!-]*(.*)$/is);
  if (m) return m[1]!.trim();
  const end = text.trim().match(/^(.+?)[\s,.;-]+(?:and\s+)?think\s+harder[.!]?$/is);
  return end ? end[1]!.trim() : null;
}
