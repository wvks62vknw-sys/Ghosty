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

/**
 * What the exam measures. `general` = drills (maths, facts, computing) with exact checkers; `voice` = the share of
 * the GENERAL and LIBRARY replies that sound like a person, not an AI (voice.ts `human`, exact, no model).
 */
export const EXAM_AREAS = ['gym', 'general', 'library', 'tools', 'safety', 'voice'] as const;
export type ExamArea = (typeof EXAM_AREAS)[number];
/** Each area's score, 0–1 (the share of its exam items passed, partial credit where the checker gives it). */
export type AreaScores = Partial<Record<ExamArea, number>>;

export const AREA_LABEL: Record<ExamArea, string> = { gym: 'GYM PUZZLES', general: 'GENERAL', library: 'YOUR LIBRARY', tools: 'TOOLS', safety: 'SAFETY', voice: 'SOUNDS LIKE A PERSON' };

/** A new model must beat the current one by this much on average… */
export const GATE_MIN_GAIN = 0.01;
/** …and may not lose more than this in any one area (or one question's worth, in an area with few questions). */
export const GATE_MAX_DROP = 0.03;
/** An area counts in the average by its number of questions, up to this many (ten safety questions do not weigh like fifty puzzles). */
export const GATE_AREA_CAP = 40;

/** The plain mean over the areas that were measured (0 when none). */
export function examMean(s: AreaScores): number {
  const v = EXAM_AREAS.map((a) => s[a]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/** The mean with each area weighted by its questions (capped at GATE_AREA_CAP; an unknown count weighs the cap). */
export function weightedMean(s: AreaScores, items: Partial<Record<ExamArea, number>> = {}): number {
  let sum = 0;
  let w = 0;
  for (const a of EXAM_AREAS) {
    const x = s[a];
    if (typeof x !== 'number' || !Number.isFinite(x)) continue;
    const k = Math.min(GATE_AREA_CAP, Math.max(1, items[a] ?? GATE_AREA_CAP));
    sum += x * k;
    w += k;
  }
  return w ? sum / w : 0;
}

/** How far one area may fall: 3 points, or one question's worth when it has fewer than 34 questions (one flipped answer never decides alone). */
export const allowedDrop = (n?: number): number => Math.max(GATE_MAX_DROP, n && n > 0 ? 1 / n : 0);

export interface GateVerdict {
  pass: boolean;
  /** One plain sentence. */
  why: string;
  /** before − after for every area that fell. */
  drops: { area: ExamArea; by: number }[];
}

/**
 * Publish only a model that beats the current one on the same exam (both as they ship: quantised): its average
 * over the areas both were measured on, each weighted by its questions (`items`, capped at GATE_AREA_CAP), is at
 * least GATE_MIN_GAIN higher, and no area fell by more than `allowedDrop` (3 points, or one question in a small area).
 */
export function gateVerdict(before: AreaScores, after: AreaScores, items: Partial<Record<ExamArea, number>> = {}): GateVerdict {
  const areas = EXAM_AREAS.filter((a) => typeof before[a] === 'number' && typeof after[a] === 'number');
  if (!areas.length) return { pass: false, why: 'no exam area was measured on both models', drops: [] };
  const pick = (s: AreaScores) => Object.fromEntries(areas.map((a) => [a, s[a]])) as AreaScores;
  const gain = weightedMean(pick(after), items) - weightedMean(pick(before), items);
  const drops = areas.map((a) => ({ area: a, by: before[a]! - after[a]! })).filter((d) => d.by > 1e-9);
  const pts = (x: number) => `${Math.round(x * 1000) / 10} points`;
  const over = drops.filter((d) => d.by > allowedDrop(items[d.area]) + 1e-9).sort((x, y) => y.by - x.by)[0];
  if (over) return { pass: false, why: `${AREA_LABEL[over.area].toLowerCase()} fell by ${pts(over.by)} (at most ${pts(allowedDrop(items[over.area]))} allowed)`, drops };
  if (gain < GATE_MIN_GAIN - 1e-9) return { pass: false, why: gain <= 0 ? `not better than the current brain (${Math.abs(gain) < 1e-12 ? 'the same score' : `${pts(-gain)} worse`})` : `only ${pts(gain)} better (needs ${pts(GATE_MIN_GAIN)})`, drops };
  return { pass: true, why: `${pts(gain)} better on average, and no area fell further than it may`, drops };
}

// ---- the brain's base model --------------------------------------------------------------------------------

/** The base models the offline brain can be (SETTINGS → OFFLINE BRAIN chooses; the weekly training follows it). */
export type BaseId = 'qwen3-0.6b' | 'qwen3.5-2b' | 'qwen3.5-4b';

export interface BrainBase {
  id: BaseId;
  label: string;
  /** How the notebook reads, trains and writes it: Qwen3 (attention only), or Qwen3.5 (linear attention in three layers of four). */
  family: 'qwen3' | 'qwen3_5';
  /** The original weights the weekly LoRA trains on (Hugging Face, one commit). */
  hf: { repo: string; rev: string };
  /** mlc-ai's phone build of the same model, whose files' layout the notebook writes a trained week into. */
  mlc: { repo: string; rev: string; quant: 'q4f16_1' };
  /** The context window the phone gives it (tokens): the exam's prompts are cut to fit it (examBudgets). */
  context: number;
  /**
   * Whether Kaggle's free GPU (one T4, 15 GB) can train it: the notebook trains in full precision (fp32: no bf16 on a
   * T4, no fp16 for Qwen's activations), so the text weights alone take 4 bytes a parameter. `why` when it cannot.
   */
  trainable: boolean;
  why?: string;
}

/**
 * Each pinned to one commit, checked on 24 Oct 2026: the mlc-ai builds are the ones WebLLM 0.2.85's own list names
 * (the runtime vendored on the phone), the originals are the Qwen repos they were converted from (Apache-2.0).
 * Qwen3.5-2B: 1.88 billion text parameters = 7.5 GB in fp32; Qwen3.5-4B: 4.21 billion = 16.8 GB, more than the T4 has.
 */
export const BRAIN_BASES: BrainBase[] = [
  { id: 'qwen3-0.6b', label: 'Qwen3 0.6B', family: 'qwen3', hf: { repo: 'Qwen/Qwen3-0.6B', rev: 'c1899de289a04d12100db370d81485cdf75e47ca' }, mlc: { repo: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', rev: '8c14ce481d4c692769976ad52afea453a102df19', quant: 'q4f16_1' }, context: 2048, trainable: true },
  { id: 'qwen3.5-2b', label: 'Qwen3.5 2B', family: 'qwen3_5', hf: { repo: 'Qwen/Qwen3.5-2B', rev: '15852e8c16360a2fea060d615a32b45270f8a8fc' }, mlc: { repo: 'mlc-ai/Qwen3.5-2B-q4f16_1-MLC', rev: 'dd74e9c8a20c4546df85c844103bff87b6dcacad', quant: 'q4f16_1' }, context: 4096, trainable: true },
  {
    id: 'qwen3.5-4b',
    label: 'Qwen3.5 4B',
    family: 'qwen3_5',
    hf: { repo: 'Qwen/Qwen3.5-4B', rev: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a' },
    mlc: { repo: 'mlc-ai/Qwen3.5-4B-q4f16_1-MLC', rev: '44b42469f9e192814bfd90440e3b377d89ba7a13', quant: 'q4f16_1' },
    context: 4096,
    trainable: false,
    why: "it is too big to train on Kaggle's free GPU (about 17 GB in full precision; the free card has 15 GB)",
  },
];

/** The brain the phone had before there was a choice (and a kept week with no base named was trained on). */
export const DEFAULT_BASE: BaseId = 'qwen3-0.6b';

/** A base by its id; an unknown or missing one is the default (older records name none). */
export const baseById = (id: unknown): BrainBase => BRAIN_BASES.find((b) => b.id === id) ?? BRAIN_BASES[0]!;

/**
 * The exam's token budgets for a base, as the notebook uses them: a prompt keeps at most `prompt` tokens (the base's
 * context on the phone: 2,048 for Qwen3 0.6B, 4,096 for Qwen3.5), and a generation batch holds rows up to `gen`
 * tokens in all (prompt + answer), scaled with the context so the longest prompts still go eight at a time.
 */
export function examBudgets(b: BrainBase): { prompt: number; gen: number } {
  return { prompt: b.context, gen: Math.round((20_000 * b.context) / 2048) };
}

// ---- the dataset -----------------------------------------------------------------------------------------

/**
 * Exam seeds start here: a training record may never use a seed at or above it, so the exam's gym
 * puzzles and drills are never seen in training (validRecord refuses them).
 */
export const EXAM_SEED_FLOOR = 900_000;

export type TrainKind = 'gym' | 'drill' | 'evol' | 'library' | 'tool' | 'pref' | 'failure' | 'redteam' | 'distill' | 'school';
export const TRAIN_KINDS: TrainKind[] = ['gym', 'drill', 'evol', 'library', 'tool', 'pref', 'failure', 'redteam', 'distill', 'school'];

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

/** A puzzle the notebook makes and checks itself with the GYM's code (tasks.mjs): a game at a level from a seed, or a drill. */
export type TaskRef = { game: string; level: number; seed: number } | { drill: number; seed: number };

/**
 * One line of the week's JSONL. By kind:
 * - gym / drill: `task` only (the notebook makes the puzzle, samples answers and keeps the ones the checker passes);
 * - evol / distill / library / redteam / tool: `messages` ending with the assistant turn to learn
 *   (`source` names the library passage for library; `tools` the specs offered for tool);
 * - pref: `messages` without the answer, then `chosen` and (if known) `rejected` — the owner's 👍/👎;
 * - failure: something he got wrong, replayed: a `task`, or `messages` + the right `answer`;
 * - school: SCHOOL practice for his weak spots (apps/edge/src/school/practice.ts; never a paper's item): an exact
 *   one is `messages` (the question, asked as the exam asks it) + the exact `answer` + `check` (how the notebook
 *   checks an attempt: it samples several and keeps the ones that pass, like STaR); a written one is `messages`
 *   ending with the stronger model's worked answer (distillation).
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
  /** school (exact): how an attempt is marked, as SCHOOL marks a paper (school.ts markExact; the notebook's mark_exact). */
  check?: SchoolCheck;
}

export interface SchoolCheck {
  type: 'exact' | 'number' | 'mcq';
  also?: string[];
  tolerance?: number;
  unit?: string;
  options?: string[];
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
    case 'school':
      if (o.answer === undefined) {
        if (!isMsgs(o.messages) || last!.role !== 'assistant' || !last!.content.trim()) return 'a school item needs its exact answer, or a worked answer to learn';
        return '';
      }
      if (!isMsgs(o.messages) || last!.role !== 'user' || typeof o.answer !== 'string' || !o.answer.trim()) return 'a school question needs the question and its exact answer';
      if (!o.check || !['exact', 'number', 'mcq'].includes(o.check.type)) return 'a school question needs how its answer is checked';
      if (o.check.type === 'mcq' && !/^[a-d]$/i.test(o.answer.trim())) return 'a multiple-choice answer must be a letter A–D';
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
  /** The base model it trained on (BRAIN_BASES), as the notebook read it from its settings. */
  baseId?: BaseId;
  /** The exam, as the brains ship (both quantised to q4f16_1): the current one, and the new one. */
  before: AreaScores;
  after: AreaScores;
  /** The fixed core of the exam alone (the same questions every week, for week-to-week comparison). */
  core?: { before: AreaScores; after: AreaScores };
  /** The separate dev questions the LoRA scale was chosen on (never the exam). */
  dev?: Record<string, number>;
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
  /** It learned from the owner's library, chats or ratings (this week or an earlier week in its chain). */
  private?: boolean;
  /** The base it was trained on (absent: Qwen3 0.6B, the only one there was). */
  base?: BaseId;
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
  /** The model the phone should use: a commit from `models`, or null for the stock build of `base`. */
  active: string | null;
  /**
   * The base the weekly training follows (chosen in SETTINGS → OFFLINE BRAIN), and the base it followed before the last
   * switch: a switch starts a fresh chain from the new base's stock build, the old chain is kept (ROLLBACK goes back to it).
   */
  base?: BaseId;
  switchedFrom?: BaseId;
  /** Private data in training (library passages, chats, 👍/👎): on unless the owner turned it off. */
  privateData: boolean;
  /** Ratings waiting for this week's run. */
  ratings: { up: number; down: number };
  /**
   * Where this phone fetches a trained brain's files: `/api/w/<capability>/` on Ghosty's own site (the model repo
   * is private; the brain fetches it with the owner's token: apps/edge/src/selftrain/weights.ts). Null with no models.
   */
  weights: string | null;
  /** SCHOOL practice for his weak spots waiting for the next week ("school practice: 96"); absent before there is any. */
  school?: { practice: number; note: string };
}

/** The address of a trained week's files for WebLLM: `<origin>/api/w/<cap>/resolve/<commit>/` (pure; the phone adds its origin). */
export const weightsBase = (origin: string, weights: string, commit: string): string => `${origin.replace(/\/$/, '')}${weights}resolve/${commit}/`;
