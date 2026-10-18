/**
 * The GYM's part in the offline brain's REPORT CARD and THINK HARDER (offline/think.ts): the fixed logic
 * puzzles (the gym's own generators at fixed seeds) and fact-book questions the report card asks, judged by
 * the gym's check() and the fact book; and, for a question typed in the chat, an exact check when it is one
 * the gym can judge (a Countdown "reach 24 from 5, 5, 9, 8" or a fact-book question like "What is the
 * capital of Japan?"). Runs in the GYM's worker (gym/worker.ts), so the page never bundles the engines.
 * Pure; tested by apps/edge/test/thinkharder.test.mjs.
 */
import { finalLine, type Problem, type Verdict } from './core';
import { evaluate as sumOf } from './countdown';
import { ENTITIES, factOf, type Value } from './facts';
import { gameById } from './index';
import { LOCAL_ITEMS } from '../offline/bench';

export type BenchCat = 'logic' | 'facts';

export interface BenchItem {
  id: string;
  cat: BenchCat;
  /** The question as the model reads it. */
  text: string;
  /** Goes in steps (THINK HARDER's tree search). */
  steps: boolean;
  /**
   * 'verifier': the check works the answer out without knowing it (a Countdown sum), so THINK HARDER may
   * use it on the report card · 'key': it compares with a known answer, so only the final score uses it.
   */
  check: 'verifier' | 'key';
}

/** The logic puzzles: two Countdown sums, a VALID/INVALID argument, a logic grid — level 1, fixed seeds. */
export const LOGIC_SET: { game: string; level: number; seed: number; check: 'verifier' | 'key' }[] = [
  { game: 'countdown', level: 1, seed: 1, check: 'verifier' },
  { game: 'countdown', level: 1, seed: 2, check: 'verifier' },
  { game: 'logic', level: 1, seed: 1, check: 'key' },
  { game: 'sudoku', level: 1, seed: 1, check: 'key' },
];

/** The fact-book questions: [thing, field]. */
export const FACT_SET: [string, string][] = [
  ['Japan', 'capital'],
  ['Silver', 'symbol'],
  ['Mars', 'moons'],
  ['Peru', 'continent'],
];

/** A question for one field of one thing in the book. */
export function factAsk(ent: string, field: string): string {
  const E = ent.charAt(0).toUpperCase() + ent.slice(1);
  switch (field) {
    case 'capital':
      return `What is the capital of ${ent}?`;
    case 'continent':
      return `What is the continent of ${ent}?`;
    case 'population':
      return `About how many million people live in ${ent}?`;
    case 'area':
      return `What is the area of ${ent}, in thousand km²?`;
    case 'length':
      return `How long is ${ent}, in km?`;
    case 'mouth':
      return `What sea or ocean does ${ent} flow into?`;
    case 'symbol':
      return `What is the chemical symbol of ${ent}?`;
    case 'number':
      return `What is the atomic number of ${ent}?`;
    case 'state':
      return `Is ${ent} a solid, a liquid or a gas at room temperature?`;
    case 'melting':
      return `At what temperature in °C does ${ent} melt?`;
    case 'order':
      return `Which planet from the Sun is ${E}: 1st, 2nd, 3rd…? Answer with the number.`;
    case 'diameter':
      return `About how many km across is ${ent}?`;
    case 'moons':
      return `What is the number of known moons of ${ent}?`;
    case 'rings':
      return `Does ${ent} have rings? Answer yes or no.`;
  }
  return `What is the ${field} of ${ent}?`;
}

const problemOf = (s: (typeof LOGIC_SET)[number]): Problem => gameById(s.game)!.generate(s.level, s.seed);

/** The report card's gym questions, always the same. */
export function benchItems(): BenchItem[] {
  return [
    ...LOGIC_SET.map((s) => ({ id: `${s.game}-${s.level}-${s.seed}`, cat: 'logic' as const, text: problemOf(s).text, steps: true, check: s.check })),
    ...FACT_SET.map(([ent, field]) => ({ id: `fact-${ent}-${field}`, cat: 'facts' as const, text: factAsk(ent, field), steps: false, check: 'key' as const })),
  ];
}

/** Judge a reply to one of the report card's gym questions (null: not one of them). */
/**
 * Every question the report card asks, word for word (the phone's own and the gym's): the weekly training
 * (Stage 2) leaves out any example that is a near copy of one, so the report card never measures what was
 * trained on. The gym's generators can make the same puzzle from other seeds, so the filter must go by text.
 */
export function reportCardTexts(): string[] {
  return [...LOCAL_ITEMS.map((x) => x.text), ...benchItems().map((x) => x.text)];
}

export function judgeItem(id: string, reply: string): Verdict | null {
  const s = LOGIC_SET.find((x) => `${x.game}-${x.level}-${x.seed}` === id);
  if (s) return gameById(s.game)!.check(problemOf(s), reply);
  const f = FACT_SET.find(([ent, field]) => `fact-${ent}-${field}` === id);
  if (f) return factVerdict({ ent: f[0], field: f[1], v: factOf(f[0], f[1])!.v }, reply);
  return null;
}

// ---- fact-book questions in the chat ------------------------------------------------------------------------

/** The words for each field in "What is the <field> of <thing>?" (yes/no fields — rings, state — have none). */
const FIELD_NAMES: Record<string, string[]> = {
  capital: ['capital', 'capital city'],
  continent: ['continent'],
  population: ['population'],
  area: ['area'],
  length: ['length'],
  mouth: ['mouth'],
  symbol: ['chemical symbol', 'symbol'],
  number: ['atomic number'],
  melting: ['melting point'],
  diameter: ['diameter'],
  moons: ['number of moons', 'number of known moons'],
};

/** "What is the capital of Japan?" → the fields asked, by their words. */
const ASKED = new Map<string, string>(Object.entries(FIELD_NAMES).flatMap(([field, ws]) => ws.map((w) => [w, field] as [string, string])));

/**
 * The thing and field a question asks about, when it is exactly "What is the <field> of <thing>?" and the
 * fact book records it. Anything else — before/after, "not", former, second, a yes/no question, two things —
 * has no check (null): the book would be answering a different question.
 */
export function factQuestion(q: string): { ent: string; field: string; v: Value } | null {
  const m = q.trim().toLowerCase().replace(/\s+/g, ' ').match(/^what(?: is|'s) the ([a-z ]+ of [a-z ]+?)\s*\??$/);
  if (!m) return null;
  // "number of known moons of mars": try each " of " as the place the field ends and the thing begins.
  const parts = m[1]!.split(' of ');
  for (let k = 1; k < parts.length; k++) {
    const field = ASKED.get(parts.slice(0, k).join(' of '));
    const thing = parts.slice(k).join(' of ').replace(/^the /, '');
    const e = ENTITIES.find((x) => x.name.toLowerCase().replace(/^the /, '') === thing);
    if (!field || !e || !(field in e.f)) continue;
    const v = e.f[field];
    return v == null ? null : { ent: e.name, field, v };
  }
  return null;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Does a reply's answer give the book's value? Numbers within 3 % (the book's are rounded); names as whole words. */
export function factVerdict(f: { ent: string; field: string; v: Value }, reply: string): Verdict {
  const line = finalLine(reply.replace(/^[\s\S]*\n\s*(?:final\s+)?answer\s*[:：]/i, 'Answer: '));
  const want = f.v;
  let ok = false;
  if (typeof want === 'number') {
    const nums = (line.replace(/[−–]/g, '-').replace(/(\d),(?=\d{3}\b)/g, '$1').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const n = nums.at(-1);
    ok = n !== undefined && (Number.isInteger(want) && Math.abs(want) < 200 ? n === want : Math.abs(n - want) <= Math.abs(want) * 0.03);
  } else if (typeof want === 'boolean') {
    const w = words(line);
    ok = want ? /\byes\b|\bit does\b|\bhas rings\b/.test(w) && !/\bno\b/.test(w) : /\bno\b|\bdoes not\b|\bdoesn t\b/.test(w);
  } else if (typeof want === 'string') {
    ok = f.field === 'symbol' ? new RegExp(`(^|[^A-Za-z])${want}([^a-z]|$)`).test(line) : ` ${words(line)} `.includes(` ${words(want)} `);
  }
  return ok ? { correct: true, score: 1, why: `The fact book says ${String(want)}.` } : { correct: false, score: 0, why: `The fact book says ${String(want)}.` };
}

// ---- Countdown sums in the chat --------------------------------------------------------------------------------

/** "Reach 24 from 5, 5, 9, 8 …" / "make 24 using 5 5 9 8": the target and numbers (every number once when it says so). */
export function sumPuzzle(q: string): { target: number; nums: number[]; exact: boolean } | null {
  // The whole question is the puzzle: it starts with it, and what follows the numbers is only the rules (no more numbers).
  const m = q.trim().match(/^(?:can you\s+)?(?:reach|make|get to)\s+(\d+)\s+(?:from|using|with|out of)\s+(?:the numbers\s+)?((?:\d+\s*(?:,|and|\s)\s*){1,7}\d+)([^\d]{0,120})$/i);
  if (!m) return null;
  const nums = (m[2]!.match(/\d+/g) ?? []).map(Number);
  if (nums.length < 2) return null;
  return { target: Number(m[1]), nums, exact: /\b(?:every|each|all(?: the)?) numbers?\b|\bexactly once\b/i.test(q) };
}

/** Check a sum against a puzzle (the expression on the answer line, every number used at most once). */
export function sumVerdict(p: { target: number; nums: number[]; exact: boolean }, reply: string): Verdict {
  const line = finalLine(reply.replace(/^[\s\S]*\n\s*(?:final\s+)?answer\s*[:：]/i, 'Answer: '));
  const e = sumOf(line.split('=')[0]!);
  if ('error' in e) return { correct: false, score: 0, why: `Not a valid sum: ${e.error}.` };
  const pool = p.nums.slice();
  for (const u of e.used) {
    const k = pool.indexOf(u);
    if (k < 0) return { correct: false, score: 0, why: `${u} is not one of the numbers left.` };
    pool.splice(k, 1);
  }
  if (p.exact && pool.length) return { correct: false, score: 0, why: 'Every number must be used.' };
  const off = Math.abs(e.value - p.target);
  return off === 0 ? { correct: true, score: 1, why: `${p.target} — right.` } : { correct: false, score: Math.max(0, (10 - off) / 10), why: `That makes ${e.value}, ${off} away.` };
}

/**
 * The exact check the gym has for a chat question, if any: what it checks with, whether it already
 * knows the answer, and the verdict on this reply. null: no check fits this question.
 */
export function gymCheck(question: string, reply: string): { label: string; kind: 'verifier' | 'key'; verdict: Verdict } | null {
  const sp = sumPuzzle(question);
  if (sp) return { label: "the gym's Countdown rules", kind: 'verifier', verdict: sumVerdict(sp, reply) };
  const f = factQuestion(question);
  if (f) return { label: 'the fact book', kind: 'key', verdict: factVerdict(f, reply) };
  return null;
}

/** Whether the gym can check a chat question at all (asked before any attempt). */
export function gymCheckable(question: string): { label: string; kind: 'verifier' | 'key' } | null {
  if (sumPuzzle(question)) return { label: "the gym's Countdown rules", kind: 'verifier' };
  if (factQuestion(question)) return { label: 'the fact book', kind: 'key' };
  return null;
}
