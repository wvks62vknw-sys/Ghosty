/**
 * The offline brain's weekly self-training (apps/edge/src/selftrain on the brain, the notebook in
 * training/kaggle on Kaggle's free GPUs, the report card in SYSTEM on the phone): the shapes all three
 * share, the dataset's record format with its checker, and the exam gate. Pure.
 *
 * The gate is the one rule that decides whether a newly trained model replaces the current one. The
 * notebook applies it before publishing (its Python copy is checked against the same cases,
 * training/kaggle/gate_cases.json) and the brain applies it again to the report before the model is
 * offered to the phone.
 */
import type { ToolSpec } from './toolcall';

/** What the exam measures. `general` = drills (maths, facts, computing) with exact checkers. */
export const EXAM_AREAS = ['gym', 'general', 'library', 'tools', 'safety'] as const;
export type ExamArea = (typeof EXAM_AREAS)[number];
/** Each area's score, 0–1 (the share of its exam items passed, partial credit where the checker gives it). */
export type AreaScores = Partial<Record<ExamArea, number>>;

export const AREA_LABEL: Record<ExamArea, string> = { gym: 'GYM PUZZLES', general: 'GENERAL', library: 'YOUR LIBRARY', tools: 'TOOLS', safety: 'SAFETY' };

/** A new model must beat the current one by this much on average… */
export const GATE_MIN_GAIN = 0.01;
/** …and may not lose more than this in any one area. */
export const GATE_MAX_DROP = 0.03;

/** The plain mean over the areas that were measured (0 when none). */
export function examMean(s: AreaScores): number {
  const v = EXAM_AREAS.map((a) => s[a]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export interface GateVerdict {
  pass: boolean;
  /** One plain sentence. */
  why: string;
  /** before − after for every area that fell. */
  drops: { area: ExamArea; by: number }[];
}

/**
 * Publish only a model that beats the current one on the same exam: its mean over the areas both were
 * measured on is at least GATE_MIN_GAIN higher, and no area dropped by more than GATE_MAX_DROP.
 */
export function gateVerdict(before: AreaScores, after: AreaScores): GateVerdict {
  const areas = EXAM_AREAS.filter((a) => typeof before[a] === 'number' && typeof after[a] === 'number');
  if (!areas.length) return { pass: false, why: 'no exam area was measured on both models', drops: [] };
  const pick = (s: AreaScores) => Object.fromEntries(areas.map((a) => [a, s[a]])) as AreaScores;
  const gain = examMean(pick(after)) - examMean(pick(before));
  const drops = areas.map((a) => ({ area: a, by: before[a]! - after[a]! })).filter((d) => d.by > 1e-9);
  const worst = drops.reduce<{ area: ExamArea; by: number } | null>((w, d) => (!w || d.by > w.by ? d : w), null);
  const pts = (x: number) => `${Math.round(x * 1000) / 10} points`;
  if (worst && worst.by > GATE_MAX_DROP + 1e-9) return { pass: false, why: `${AREA_LABEL[worst.area].toLowerCase()} fell by ${pts(worst.by)} (at most ${pts(GATE_MAX_DROP)} allowed)`, drops };
  if (gain < GATE_MIN_GAIN - 1e-9) return { pass: false, why: gain <= 0 ? `not better than the current brain (${gain === 0 ? 'the same score' : `${pts(-gain)} worse`})` : `only ${pts(gain)} better (needs ${pts(GATE_MIN_GAIN)})`, drops };
  return { pass: true, why: `${pts(gain)} better on average, no area down more than ${pts(GATE_MAX_DROP)}`, drops };
}

// ---- the dataset -----------------------------------------------------------------------------------------

/**
 * Exam seeds start here: a training record may never use a seed at or above it, so the exam's gym
 * puzzles and drills are never seen in training (validRecord refuses them).
 */
export const EXAM_SEED_FLOOR = 900_000;

export type TrainKind = 'gym' | 'drill' | 'evol' | 'library' | 'tool' | 'pref' | 'failure' | 'redteam' | 'distill';
export const TRAIN_KINDS: TrainKind[] = ['gym', 'drill', 'evol', 'library', 'tool', 'pref', 'failure', 'redteam', 'distill'];

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

/** A puzzle the notebook makes and checks itself with the GYM's code (tasks.mjs): a game at a level from a seed, or a drill. */
export type TaskRef = { game: string; level: number; seed: number } | { drill: number; seed: number };

/**
 * One line of the week's JSONL. By kind:
 * - gym / drill: `task` only (the notebook makes the puzzle, samples answers and keeps the ones the checker passes);
 * - evol / distill / library / redteam / tool: `messages` ending with the assistant turn to learn
 *   (`source` names the library passage for library; `tools` the specs offered for tool);
 * - pref: `messages` without the answer, then `chosen` and (if known) `rejected` — the owner's 👍/👎;
 * - failure: something he got wrong, replayed: a `task`, or `messages` + the right `answer`.
 */
export interface TrainRecord {
  kind: TrainKind;
  messages?: ChatMsg[];
  task?: TaskRef;
  chosen?: string;
  rejected?: string;
  answer?: string;
  source?: string;
  tools?: ToolSpec[];
  /** Where it came from, in a few words ("evolved from drill 12", "chat 2026-10-12"). */
  from?: string;
}

const isMsgs = (m: unknown): m is ChatMsg[] =>
  Array.isArray(m) && m.length > 0 && m.every((x) => x && typeof x === 'object' && ['system', 'user', 'assistant'].includes((x as ChatMsg).role) && typeof (x as ChatMsg).content === 'string' && (x as ChatMsg).content.length <= 12_000);

const seedOk = (t: TaskRef) => Number.isInteger(t.seed) && t.seed >= 0 && t.seed < EXAM_SEED_FLOOR;
const taskOk = (t: unknown): t is TaskRef => {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  if ('game' in o) return typeof o.game === 'string' && Number.isInteger(o.level) && (o.level as number) >= 1 && (o.level as number) <= 10 && seedOk(o as TaskRef);
  return Number.isInteger(o.drill) && (o.drill as number) >= 0 && seedOk(o as TaskRef);
};

/** What is wrong with a record ('' when it is fine). */
export function recordProblem(r: unknown): string {
  if (!r || typeof r !== 'object') return 'not an object';
  const o = r as TrainRecord;
  if (!TRAIN_KINDS.includes(o.kind)) return `unknown kind ${String(o.kind)}`;
  const last = o.messages?.[o.messages.length - 1];
  switch (o.kind) {
    case 'gym':
    case 'drill':
      if (!taskOk(o.task)) return 'bad task (or an exam seed)';
      if ((o.kind === 'gym') !== 'game' in o.task!) return 'task does not match its kind';
      return '';
    case 'pref':
      if (!isMsgs(o.messages) || last!.role !== 'user') return 'a preference needs the messages up to the question';
      if (typeof o.chosen !== 'string' || !o.chosen.trim()) return 'a preference needs a chosen reply';
      if (o.rejected !== undefined && (typeof o.rejected !== 'string' || o.rejected.trim() === o.chosen.trim())) return 'rejected must differ from chosen';
      return '';
    case 'failure':
      if (o.task !== undefined) return taskOk(o.task) ? '' : 'bad task (or an exam seed)';
      if (!isMsgs(o.messages) || last!.role !== 'user' || typeof o.answer !== 'string' || !o.answer.trim()) return 'a failure needs a task, or the question and the right answer';
      return '';
    default:
      if (!isMsgs(o.messages) || last!.role !== 'assistant' || !last!.content.trim()) return 'needs messages ending with the answer to learn';
      if (o.kind === 'library' && !(typeof o.source === 'string' && o.source)) return 'a library answer must name its passage';
      if (o.kind === 'tool' && !(Array.isArray(o.tools) && o.tools.length)) return 'a tool example must list its tools';
      return '';
  }
}

/** The records as JSONL, bad ones left out and counted. */
export function toJsonl(records: TrainRecord[]): { text: string; kept: number; dropped: { why: string; n: number }[] } {
  const why = new Map<string, number>();
  const lines: string[] = [];
  for (const r of records) {
    const p = recordProblem(r);
    if (p) why.set(p, (why.get(p) ?? 0) + 1);
    else lines.push(JSON.stringify(r));
  }
  return { text: lines.join('\n') + (lines.length ? '\n' : ''), kept: lines.length, dropped: [...why].map(([w, n]) => ({ why: w, n })) };
}

// ---- what the notebook reports, and what the phone is shown ------------------------------------------------

export interface TrainReport {
  week: number;
  startedAt: number;
  finishedAt: number;
  /** The model it started from: 'stock' or a published week. */
  base: string;
  before: AreaScores;
  after: AreaScores;
  /** How many exam items each area had. */
  items: Partial<Record<ExamArea, number>>;
  gate: { pass: boolean; why: string };
  /** Training examples used, by kind (plus 'star', 'critique', 'replay', 'general'). */
  trained: Record<string, number>;
  /** What was thrown away, and why (STaR samples the checker failed, bad rows, the gate…). */
  rejected: { why: string; n: number }[];
  /** How long each part took (minutes); a skipped one says why. */
  phases: { name: string; minutes: number; skipped?: string }[];
  /** Set when the new model was published: the Hugging Face repo and commit. */
  published?: { repo: string; commit: string };
  /** 1 = the new LoRA as trained; 0.5 = halfway between it and the old model (the merge that scored better). */
  scale?: number;
  /** Exam and STaR items he still gets wrong (replayed next week). */
  failures?: { prompt: string; answer?: string; task?: TaskRef; why: string }[];
  error?: string;
}

export interface PublishedModel {
  week: number;
  label: string;
  repo: string;
  commit: string;
  at: number;
  scores: AreaScores;
}

export type TrainPhase = 'idle' | 'collect' | 'upload' | 'push' | 'running' | 'failed';

export interface TrainStatus {
  /** Which of the two keys are saved. */
  keys: { kaggle: boolean; hf: boolean };
  phase: TrainPhase;
  /** One plain line: what is happening now. */
  note: string;
  week: number;
  /** When the next weekly run starts (or the next step of this one). */
  next: number | null;
  /** Examples gathered so far this week, by kind. */
  gathered: Record<string, number>;
  report: TrainReport | null;
  /** Last week's report, to compare with. */
  previous: TrainReport | null;
  /** The last good models, newest first (at most 3). */
  models: PublishedModel[];
  /** The model the phone should use: a commit from `models`, or null for the stock Qwen3. */
  active: string | null;
  /** Private data in training (library passages, chats, 👍/👎): on unless the owner turned it off. */
  privateData: boolean;
  /** Ratings waiting for this week's run. */
  ratings: { up: number; down: number };
}

/** The two keys, in the owner's words (the KEYS panel has the full steps). */
export const TRAIN_KEYS = [
  { name: 'kaggle', label: 'Kaggle (free GPUs)', where: 'kaggle.com → your picture → Settings → API → "Create New Token"' },
  { name: 'hf_write', label: 'Hugging Face write token', where: 'huggingface.co → Settings → Access Tokens → "Create new token" → Write' },
] as const;
