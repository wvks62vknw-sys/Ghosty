/**
 * The offline brain's REPORT CARD (SYSTEM → OFFLINE BRAIN REPORT CARD): a small fixed test the phone
 * runs on demand, so what the small model can do is measured, not claimed. Five kinds of question —
 * sums, logic puzzles (the gym's own generators at fixed seeds), short fact-book questions, following an
 * exact instruction, and writing a tool call in the right format — each asked once as in chat and once
 * with THINK HARDER (offline/think.ts), scored strictly, timed, summed up in plain words, and kept so
 * the weeks show as a graph.
 *
 * The logic and fact questions come from the GYM's worker (gym/bench.ts) and are judged there; the rest
 * are here with their own scorers. On the report card THINK HARDER may use only checks that do not
 * already know the answer (a Countdown sum is worked out; a fact or a VALID/INVALID verdict is not used
 * to pick), so its score is the model's own. Each plain answer is also read by the AI-sounding detector
 * (packages/shared/src/voice.ts): the run keeps whether it sounds like a person, for the panel's "sounds like a
 * person: 13 of 16" (tool calls are not talk, so they are not counted). Pure: the model and the judge are passed in
 * (apps/edge/test/thinkharder.test.mjs drives it with a fake model).
 */
import { readToolCalls } from '../../../../packages/shared/src/toolcall';
import { human } from '../../../../packages/shared/src/voice';
import { answerOf, calcExact, numberMatches } from './exact';
import type { OfflineMsg } from './prompt';
import { thinkHarder, type Budget, type Checker, type Generate } from './think';

export type Cat = 'arithmetic' | 'logic' | 'facts' | 'instructions' | 'tools';

export const CATS: { id: Cat; label: string; words: string }[] = [
  { id: 'arithmetic', label: 'SUMS', words: 'sums' },
  { id: 'logic', label: 'LOGIC PUZZLES', words: 'logic puzzles' },
  { id: 'facts', label: 'FACTS', words: 'facts it was not given (capitals, elements, planets)' },
  { id: 'instructions', label: 'INSTRUCTIONS', words: 'following exact instructions' },
  { id: 'tools', label: 'TOOL CALLS', words: 'writing a tool call in the right format' },
];

export interface BenchItem {
  id: string;
  cat: Cat;
  text: string;
  /** Goes in steps (THINK HARDER's tree search). */
  steps: boolean;
  /** 'verifier': THINK HARDER may check with it on the report card; 'key': only the final score uses it. */
  check: 'verifier' | 'key';
}

/** Items scored here: the text a reply gives → right or not. */
interface LocalItem extends BenchItem {
  right(answer: string): boolean;
}

const words = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
const sum = (id: string, expr: string): LocalItem => {
  const v = calcExact(expr)!;
  return { id, cat: 'arithmetic', text: `What is ${expr}?`, steps: /[-+×÷*/].*[-+×÷*/]/.test(expr), check: 'key', right: (a) => numberMatches(answerOf(a), v) };
};

/** Every {…} in a text that parses as a JSON object, in order (strings with braces in them understood). */
export function jsonObjects(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let s = text.indexOf('{'); s >= 0; s = text.indexOf('{', s + 1)) {
    let depth = 0;
    let inStr = false;
    for (let i = s; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          const v = JSON.parse(text.slice(s, i + 1)) as unknown;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            out.push(v as Record<string, unknown>);
            s = i; // the next object starts after this one
          }
        } catch {
          /* not JSON from here */
        }
        break;
      }
    }
  }
  return out;
}

/** The first {…} in a reply, read as JSON (null if none parses). */
export function jsonIn(text: string): Record<string, unknown> | null {
  return jsonObjects(text)[0] ?? null;
}

/** A tool call: which tool, with what. */
export interface Call {
  name: string;
  args: Record<string, unknown>;
}

/** One object as a call: Qwen's {"name", "arguments"} (arguments may be a JSON string) or the plain {"tool", "args"}. */
function asCall(o: Record<string, unknown>): Call | null {
  const name = typeof o.name === 'string' ? o.name : typeof o.tool === 'string' ? o.tool : '';
  let args: unknown = o.arguments ?? o.args ?? {};
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args) as unknown;
    } catch {
      return null;
    }
  }
  return name && args && typeof args === 'object' && !Array.isArray(args) ? { name, args: args as Record<string, unknown> } : null;
}

/**
 * The tool call a reply makes, read the way the weekly training teaches it (Qwen's own format, by Stage 2's
 * packages/shared/src/toolcall.ts readToolCalls): `<tool_call>{"name": …, "arguments": {…}}</tool_call>`, over several
 * lines if need be; also a call in a ```json block or bare JSON, and the older {"tool", "args"} shape. The
 * last call in the reply counts (THINK HARDER's working comes before its answer).
 */
export function toolCallIn(text: string): Call | null {
  // Qwen's own format, read exactly as the weekly training's exam reads it (Stage 2's readToolCalls).
  const qwen = readToolCalls(text);
  if (qwen.length) return { name: qwen.at(-1)!.name, args: qwen.at(-1)!.arguments };
  // Otherwise a call inside the tags that is not quite one JSON object, in a ```json block or bare, or the older shape.
  const tagged = [...text.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g)].flatMap((m) => jsonObjects(m[1]!).slice(0, 1));
  const objects = tagged.length ? tagged : jsonObjects(text.replace(/```(?:json)?/gi, ' '));
  const calls = objects.map(asCall).filter((c): c is Call => !!c);
  return calls.at(-1) ?? null;
}

/** The tools on offer, as Qwen3's chat template lists them (its "hermes" format, which Stage 2 trains on). */
const TOOL_SPECS = [
  { name: 'set_timer', description: 'Start a countdown timer.', parameters: { type: 'object', properties: { minutes: { type: 'number' } }, required: ['minutes'] } },
  { name: 'weather', description: 'The weather forecast for a place.', parameters: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] } },
  { name: 'remember', description: 'Keep a fact about the owner.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'add_event', description: 'Put an event in the agenda.', parameters: { type: 'object', properties: { title: { type: 'string' }, day: { type: 'string' }, time: { type: 'string' } }, required: ['title', 'day'] } },
];
const TOOLS =
  `You may call one function to help with the request. Function signatures are within <tools></tools>:\n<tools>\n${TOOL_SPECS.map((t) => JSON.stringify({ type: 'function', function: t })).join('\n')}\n</tools>\n` +
  'Reply only with the call, a JSON object with the function name and arguments within <tool_call></tool_call> tags:\n<tool_call>\n{"name": <function-name>, "arguments": <args-json-object>}\n</tool_call>';
const tool = (id: string, ask: string, ok: (call: Call) => boolean): LocalItem => ({
  id,
  cat: 'tools',
  text: `${TOOLS}\nRequest: ${ask}`,
  steps: false,
  check: 'key',
  right: (a) => {
    const c = toolCallIn(a);
    return !!c && ok(c);
  },
});
const str = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');

/** The questions scored here (the gym's come from gym/bench.ts). Never change them: the graph compares weeks. */
export const LOCAL_ITEMS: LocalItem[] = [
  sum('sum-1', '17 × 23'),
  sum('sum-2', '(18 + 7) × 4'),
  sum('sum-3', '903 − 476'),
  sum('sum-4', '144 ÷ 12 + 7'),
  {
    id: 'ins-1',
    cat: 'instructions',
    text: 'Reply with exactly three words, all in capital letters, and nothing else.',
    steps: false,
    check: 'key',
    right: (a) => {
      const w = words(a).split(/\s+/).filter(Boolean);
      return w.length === 3 && w.every((x) => /^[A-Z][A-Z'-]*[.!]?$/.test(x));
    },
  },
  { id: 'ins-2', cat: 'instructions', text: 'Is 7 an odd number? Answer with only the word YES or NO.', steps: false, check: 'key', right: (a) => /^yes[.!]?$/i.test(words(a)) },
  {
    id: 'ins-3',
    cat: 'instructions',
    text: 'Name three fruits, separated by commas, with nothing else.',
    steps: false,
    check: 'key',
    right: (a) => {
      const t = words(a);
      const parts = t.split(',').map((x) => x.trim().replace(/[.!]$/, ''));
      return !t.includes('\n') && parts.length === 3 && parts.every((p) => /^[A-Za-z][A-Za-z -]{1,24}$/.test(p) && p.split(' ').length <= 2);
    },
  },
  {
    id: 'ins-4',
    cat: 'instructions',
    text: 'Write the words "the cat sat down" in reverse order, and nothing else.',
    steps: false,
    check: 'key',
    right: (a) => words(a).toLowerCase().replace(/["'.!]/g, '').replace(/\s+/g, ' ').trim() === 'down sat cat the',
  },
  tool('tool-1', 'Set a timer for 5 minutes.', (c) => c.name === 'set_timer' && Number(c.args.minutes) === 5),
  tool('tool-2', "What's the weather in Leeds?", (c) => c.name === 'weather' && str(c.args.place).includes('leeds')),
  tool('tool-3', 'Remember that my sister is called Amy.', (c) => c.name === 'remember' && str(c.args.text).includes('amy')),
  tool('tool-4', 'Put lunch with Sam on Friday at 1pm in my agenda.', (c) => c.name === 'add_event' && /lunch|sam/.test(str(c.args.title)) && str(c.args.day).includes('fri') && /\b1\b|1\s*pm|13/.test(str(c.args.time))),
];

/** Score a reply to a local item (null: not one of them). */
export function scoreLocal(id: string, reply: string): boolean | null {
  const it = LOCAL_ITEMS.find((x) => x.id === id);
  return it ? it.right(reply) : null;
}

export interface ItemResult {
  id: string;
  cat: Cat;
  plain: boolean;
  plainMs: number;
  /** null: not asked with THINK HARDER this run. */
  think: boolean | null;
  thinkMs: number;
  /** Its plain answer sounds like a person, not an AI (packages/shared/src/voice.ts); absent when it gave none (or a tool call). */
  human?: boolean;
}

export interface Run {
  at: number;
  /** The model and its pinned revision ("Qwen3-0.6B-q4f16_1-MLC@8c14ce4"). */
  model: string;
  ms: number;
  withThink: boolean;
  /** False when stopped before the end (kept, but not in the graph). */
  complete: boolean;
  items: ItemResult[];
}

/** The plain prompt: as the chat asks the model on the phone, without the owner's memory or library. */
const PLAIN = 'You are Ghosty, a careful assistant on a phone, offline. Answer briefly.';
/** THINK HARDER on the report card: a little less than in chat (20 questions in a sitting). */
export const BENCH_BUDGET: Partial<Budget> = { ms: 25_000, attempts: 4, tokens: 1000, agree: 3, answerTokens: 220 };

export interface BenchDeps {
  gen: Generate;
  /** Judge a reply to a gym item (gym/bench.ts judgeItem in the worker). */
  judge(id: string, reply: string): Promise<boolean>;
  items: BenchItem[];
  withThink: boolean;
  model: string;
  budget?: Partial<Budget>;
  onProgress?(done: number, total: number, line: string, partial: Run): void;
  signal?: AbortSignal;
  now?: () => number;
}

/** Run the report card's questions (plain, then with THINK HARDER), one after another. */
export async function runBench(d: BenchDeps): Promise<Run> {
  const now = d.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const t0 = now();
  const run: Run = { at: Date.now(), model: d.model, ms: 0, withThink: d.withThink, complete: false, items: [] };
  const score = async (it: BenchItem, reply: string) => {
    const local = scoreLocal(it.id, reply);
    return local ?? (await d.judge(it.id, reply).catch(() => false));
  };
  const total = d.items.length * (d.withThink ? 2 : 1);
  let done = 0;
  const tell = (line: string) => d.onProgress?.(done, total, line, run);
  const label = (it: BenchItem) => CATS.find((c) => c.id === it.cat)!.words.split(' (')[0];
  for (const it of d.items) {
    if (d.signal?.aborted) break;
    tell(`asking: ${label(it)} (${run.items.length + 1} of ${d.items.length})`);
    const a = now();
    let reply = '';
    try {
      const out = await d.gen(
        [
          { role: 'system', content: PLAIN },
          { role: 'user', content: it.text },
        ] satisfies OfflineMsg[],
        { temperature: 0.7, max: 220, signal: d.signal ?? new AbortController().signal },
      );
      reply = typeof out === 'string' ? out : out.text;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || d.signal?.aborted) break;
      reply = '';
    }
    const r: ItemResult = { id: it.id, cat: it.cat, plain: await score(it, reply), plainMs: now() - a, think: null, thinkMs: 0 };
    const sounds = voiceOf(it, reply);
    if (sounds !== null) r.human = sounds;
    run.items.push(r);
    done++;
    if (d.withThink && !d.signal?.aborted) {
      const b = now();
      const checker: Checker | null =
        it.check === 'verifier'
          ? { label: "the gym's rules", kind: 'verifier', check: async (text) => ((await d.judge(it.id, text).catch(() => false)) ? { correct: true, score: 1, why: '' } : { correct: false, score: 0, why: '' }) }
          : null;
      try {
        const res = await thinkHarder(it.text, {
          gen: d.gen,
          checker,
          budget: { ...BENCH_BUDGET, ...d.budget },
          steps: it.steps,
          signal: d.signal,
          now,
          onProgress: (p) => tell(`THINK HARDER on ${label(it)}: ${p.line}`),
        });
        // Instructions are judged on the answer alone (the working would break "nothing else"); a tool call on the
        // whole chosen reply, so a call written over several lines or in a ```json block still counts.
        const judged = it.cat === 'instructions' ? res.answer : res.text;
        r.think = res.stopped ? null : await score(it, judged);
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') r.think = false;
      }
      r.thinkMs = now() - b;
      done++;
    }
  }
  run.ms = now() - t0;
  run.complete = !d.signal?.aborted && run.items.length === d.items.length && (!d.withThink || run.items.every((x) => x.think !== null));
  tell(run.complete ? 'done' : 'stopped');
  return run;
}

export interface CatScore {
  cat: Cat;
  plain: [number, number];
  think: [number, number];
  plainMs: number;
  thinkMs: number;
}

/** Right / asked per kind of question, with and without THINK HARDER, and the time each took. */
export function catScores(run: Run): CatScore[] {
  return CATS.map(({ id }) => {
    const xs = run.items.filter((x) => x.cat === id);
    const th = xs.filter((x) => x.think !== null);
    return {
      cat: id,
      plain: [xs.filter((x) => x.plain).length, xs.length],
      think: [th.filter((x) => x.think).length, th.length],
      plainMs: xs.reduce((s, x) => s + x.plainMs, 0),
      thinkMs: th.reduce((s, x) => s + x.thinkMs, 0),
    };
  });
}

const frac = ([a, b]: [number, number]) => (b ? a / b : 0);

/** The plain-English verdict: "Good at sums. Weak at logic puzzles. Don't trust it for facts… THINK HARDER helped with…". */
export function summarise(run: Run): string {
  const cs = catScores(run).filter((c) => c.plain[1] > 0);
  if (!cs.length) return 'No questions were answered: run the check again.';
  const best = (c: CatScore) => Math.max(frac(c.plain), c.think[1] ? frac(c.think) : 0);
  const name = (c: CatScore) => CATS.find((x) => x.id === c.cat)!.words;
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  const good = cs.filter((c) => best(c) >= 0.75).map(name);
  const middling = cs.filter((c) => best(c) >= 0.5 && best(c) < 0.75).map(name);
  const weak = cs.filter((c) => best(c) < 0.5);
  const out: string[] = [];
  if (good.length) out.push(`Good at ${list(good)}.`);
  if (middling.length) out.push(`So-so at ${list(middling)}.`);
  const risky = weak.filter((c) => c.cat === 'facts' || c.cat === 'arithmetic' || c.cat === 'logic').map(name);
  const clumsy = weak.filter((c) => !(c.cat === 'facts' || c.cat === 'arithmetic' || c.cat === 'logic')).map(name);
  if (clumsy.length) out.push(`Weak at ${list(clumsy)}.`);
  if (risky.length) out.push(`Don't trust it for ${list(risky)}: check those, or ask the big brain.`);
  const helped = cs.filter((c) => c.think[1] && frac(c.think) > frac(c.plain)).map((c) => `${name(c).split(' (')[0]} (${c.plain[0]} → ${c.think[0]} of ${c.think[1]})`);
  const hurt = cs.filter((c) => c.think[1] && frac(c.think) < frac(c.plain)).map((c) => name(c).split(' (')[0]!);
  if (helped.length) out.push(`THINK HARDER helped with ${list(helped)}.`);
  else if (run.withThink && cs.some((c) => c.think[1])) out.push('THINK HARDER did not improve any score this time.');
  if (hurt.length) out.push(`It did worse with THINK HARDER on ${list(hurt)}.`);
  if (!run.complete) out.push('(Stopped before the end: these are partial.)');
  return out.join(' ');
}

/** Whether a plain answer sounds like a person (null: nothing to judge: no answer, or a tool call, which is not talk). */
export function voiceOf(it: BenchItem, reply: string): boolean | null {
  const said = words(reply);
  if (!/[a-z0-9]/i.test(said) || it.cat === 'tools') return null;
  return human(said, it.text);
}

/** How many of the run's own answers sound like a person: [human, judged] ([0, 0] for a run from before it was measured). */
export function voiceCount(run: Run): [number, number] {
  const judged = run.items.filter((x) => typeof x.human === 'boolean');
  return [judged.filter((x) => x.human).length, judged.length];
}

/** The line for the panel: "sounds like a person: 17 of 20" ('' when none were judged). */
export function voiceLine(run: Run): string {
  const [n, of] = voiceCount(run);
  return of ? `sounds like a person: ${n} of ${of}` : '';
}

/** Right answers as a share of those asked: [plain, think or null]. */
export function overall(run: Run): [number, number | null] {
  const n = run.items.length;
  const th = run.items.filter((x) => x.think !== null);
  return [n ? run.items.filter((x) => x.plain).length / n : 0, th.length ? th.filter((x) => x.think).length / th.length : null];
}

/** Keep a run in the history (newest last, at most `keep`). */
export function addRun(history: Run[], run: Run, keep = 30): Run[] {
  return [...history, run].slice(-keep);
}

/** The graph's points: complete runs only, oldest first. */
export function trend(history: Run[]): { at: number; plain: number; think: number | null; model: string }[] {
  return history.filter((r) => r.complete).map((r) => {
    const [plain, think] = overall(r);
    return { at: r.at, plain, think, model: r.model };
  });
}
