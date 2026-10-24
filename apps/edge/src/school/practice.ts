/**
 * SCHOOL practice: how what he gets wrong at school feeds the weekly training (the owner's rule: everything he
 * practises feeds the weekly training; papers are never trained on).
 *
 *  - WEAK SPOTS → PRACTICE (`practiceTick`, a step of the weekly training's job: selftrain/cycle.ts): for each weak
 *    topic of his current stage (`weakSpots` over that stage's results), a stronger online model (the background
 *    lane, a few calls a step and a few dozen a day, resumable) writes practice items with worked solutions at that
 *    stage's level. An exact one (a number, a letter of four, a word) is kept only when a second call, given the
 *    question alone as the exam asks it, reaches the same answer (marked by `markExact`, as SCHOOL marks a paper); a
 *    written one is kept as distillation (the worked answer is what he learns). Anything as alike as a rewording of
 *    a question on a paper he has sat (or of an item in his stage's question banks or an official paper, which may
 *    yet be set) is dropped. Kept under `school:practice:<stage>:<topic>`, never in the library.
 *  - INTO THE WEEK (`practiceRecords`): the factory hands at most `WEEKLY_SCHOOL` of them to the week's data as
 *    `school` records (packages/shared/src/selftrain.ts), checked against the papers again with `tooClose`.
 * Nothing the online model wrote when it SAT a paper (school/remote.ts, the gap) is ever used here.
 */
import { examMessages, markExact, stageById, SUBJECT_LABEL, weakSpots, type ItemType, type PaperItem, type StageId } from '../../../../packages/shared/src/school';
import { recordProblem, type TrainRecord } from '../../../../packages/shared/src/selftrain';
import { jsonIn, tooClose, WEEKLY } from '../selftrain/factory';
import { stageName } from './papers';
import { loadState, PAPER_PREFIX } from './state';

/** One model call: a system prompt and a user message → the reply's text. Throws when no model has room. */
export type Ask = (system: string, user: string) => Promise<string>;

export const PRACTICE_PREFIX = 'school:practice:';
const PROGRESS_KEY = 'school:practice';
/** Checked items kept per weak topic, the most write calls a topic gets, items asked for per call. */
export const PER_TOPIC = 12;
const MAX_WRITES = 10;
const PER_CALL = 3;
/** Model calls a step may make, and a day (the background lane: only room above the owner's chat). */
export const CALLS_PER_STEP = 3;
export const CALLS_PER_DAY = 40;
/** At most this many school records go into one week's data. */
export const WEEKLY_SCHOOL = WEEKLY.school;

export interface PracticeItem {
  type: Exclude<ItemType, 'extended'>;
  q: string;
  options?: string[];
  /** The exact answer (the letter for multiple choice), or the model answer of a written one. */
  answer: string;
  /** The worked solution, ending with "Answer: …". */
  worked: string;
}

export interface PracticeTopic {
  stage: StageId;
  subject: string;
  topic: string;
  /** Checked: exact ones two calls agreed on, written ones kept as distillation. */
  items: PracticeItem[];
  /** Exact ones written and waiting for the second call (a step that ran out carries on with these). */
  checking: PracticeItem[];
  asked: number;
  rejected: { disagree: number; malformed: number; nearPaper: number };
  updatedAt: number;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'topic';
export const practiceKey = (stage: StageId, subject: string, topic: string) => `${PRACTICE_PREFIX}${stage}:${slug(subject)}:${slug(topic)}`;

export const PRACTICE_SYSTEM =
  'You write practice questions for a pupil in a UK school, at exactly the level and in the style of that stage\'s exams. Reply with JSON only: ' +
  '{"items": [{"type": "number|mcq|exact|written", "q": "...", "options": ["...", "...", "...", "..."], "answer": "...", "worked": "..."}]}. ' +
  'number: the answer is one number; mcq: four options and the answer is the letter A, B, C or D; exact: the answer is one or two words; ' +
  'written: a question needing a short explanation, and the answer is a model answer. Every "worked" is a short worked solution that ends with ' +
  "'Answer: <the answer>'. Each question must be self-contained, correct and new: never copy a past paper's question.";

export function practicePrompt(stage: StageId, subject: string, topic: string, n = PER_CALL): string {
  const s = stageById(stage);
  return `Stage: ${s?.label ?? stage} (${s?.years ?? ''}; ${s?.exams ?? ''})\nSubject: ${SUBJECT_LABEL[subject] ?? subject}\nTopic: ${topic}\nWrite ${n} questions on this topic: a mix of exact ones (number, mcq, exact) and one written one.`;
}

/** An item as a paper item, so `markExact` and `examMessages` treat it as SCHOOL treats an exam question. */
export const asPaperItem = (it: PracticeItem, topic = ''): PaperItem => ({ id: 'p', q: it.q, type: it.type, marks: it.type === 'short' ? 2 : 1, answer: it.answer, ...(it.options ? { options: it.options } : {}), topic });

const REFUSAL = /\b(i can(?:no|')t|i(?:'m| am) (?:not able|unable)|as an ai|i won't|cannot help|sorry, but)\b/i;

/** The items in a writer's reply, or why each was left out ('' = fine). */
export function readPractice(reply: string): { items: PracticeItem[]; malformed: number } {
  const list = jsonIn(reply)?.items;
  if (!Array.isArray(list)) return { items: [], malformed: 1 };
  const items: PracticeItem[] = [];
  let malformed = 0;
  for (const x of list.slice(0, 6) as Record<string, unknown>[]) {
    const kind = String(x?.type ?? '');
    const q = String(x?.q ?? '').trim();
    let answer = String(x?.answer ?? '').trim();
    const worked = String(x?.worked ?? '').trim();
    const options = Array.isArray(x?.options) ? (x.options as unknown[]).map((o) => String(o).trim()) : undefined;
    const type = kind === 'written' ? 'short' : kind;
    let ok = q.length >= 8 && q.length <= 900 && !!answer && worked.length >= 2 && worked.length <= 2500 && !REFUSAL.test(worked.slice(0, 200));
    if (type === 'mcq') {
      answer = answer.replace(/^\(?([a-d])\)?[.):]?\s*$/i, '$1').toLowerCase();
      ok &&= !!options && options.length === 4 && options.every(Boolean) && new Set(options.map((o) => o.toLowerCase())).size === 4 && /^[a-d]$/.test(answer);
    } else if (type === 'number') ok &&= /^-?[\d,]*\.?\d+(\s*\/\s*\d+)?\s*[a-z%£$€°]*$/i.test(answer.replace(/^[£$€]/, ''));
    else if (type === 'exact') ok &&= answer.length <= 40 && answer.split(/\s+/).length <= 3;
    else if (type !== 'short') ok = false;
    if (!ok) {
      malformed++;
      continue;
    }
    items.push({ type: type as PracticeItem['type'], q, ...(type === 'mcq' ? { options } : {}), answer, worked });
  }
  return { items, malformed };
}

/** Whether a second answer (the question alone, as the exam asks it) agrees with the item's own answer. */
export const agrees = (it: PracticeItem, reply: string): boolean => (markExact(asPaperItem(it), reply) ?? 0) > 0;

/**
 * Every question that is, or may yet be, on a paper: the papers he has sat (`school:paper:*`), and where they exist
 * the question banks of this stage and the official papers (SCHOOL part 2a's `school:bank:<stage>:*`,
 * `school:official:*`). Practice as alike as a rewording of any of them is never kept, and never trained on.
 */
export async function heldQuestions(storage: DurableObjectStorage, stage?: StageId): Promise<string[]> {
  const out = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== 'object' || depth > 3) return;
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    const o = v as Record<string, unknown>;
    if (typeof o.q === 'string' && (typeof o.type === 'string' || typeof o.marks === 'number')) out.add(o.q);
    for (const k of ['paper', 'items', 'chunk', 'bank']) if (k in o) walk(o[k], depth + 1);
  };
  const prefixes = [PAPER_PREFIX, 'school:official:', ...(stage ? [`school:bank:${stage}:`] : [])];
  for (const prefix of prefixes) {
    const got = await storage.list({ prefix }).catch(() => new Map<string, unknown>());
    for (const v of got.values()) walk(v, 0);
  }
  return [...out];
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * One step of practice for his weak spots: first the exact items waiting for their second call, then new items for
 * the weakest topics below `PER_TOPIC`; at most `CALLS_PER_STEP` model calls (and `CALLS_PER_DAY` a day). Every call's
 * result is saved at once, so a step cut short loses nothing. Never throws. `more`: there is still work to do.
 */
export async function practiceTick(d: { storage: DurableObjectStorage; ask?: Ask; now?: () => number }): Promise<{ calls: number; more: boolean; noModel: boolean; note: string }> {
  const now = (d.now ?? Date.now)();
  const s = d.storage;
  const st = await loadState({ storage: s });
  const weak = weakSpots(st.results.filter((r) => r.stage === st.stage), 5);
  if (!weak.length || !d.ask) return { calls: 0, more: false, noModel: false, note: weak.length ? 'no online model to write practice' : 'no weak spots at this stage' };
  const prog = (await s.get<{ day: string; calls: number }>(PROGRESS_KEY)) ?? { day: '', calls: 0 };
  if (prog.day !== dayOf(now)) Object.assign(prog, { day: dayOf(now), calls: 0 });
  let calls = 0;
  let noModel = false;
  let held: string[] | null = null;
  const room = () => !noModel && calls < CALLS_PER_STEP && prog.calls < CALLS_PER_DAY;
  const call = async (system: string, user: string): Promise<string | null> => {
    calls++;
    prog.calls++;
    await s.put(PROGRESS_KEY, prog);
    try {
      return await d.ask!(system, user);
    } catch {
      noModel = true;
      return null;
    }
  };
  let more = false;
  for (const w of weak) {
    const key = practiceKey(w.stage, w.subject, w.topic);
    const t: PracticeTopic = (await s.get<PracticeTopic>(key)) ?? { stage: w.stage, subject: w.subject, topic: w.topic, items: [], checking: [], asked: 0, rejected: { disagree: 0, malformed: 0, nearPaper: 0 }, updatedAt: now };
    // 1. the second call for exact items already written
    while (t.checking.length && room()) {
      const it = t.checking[0]!;
      const m = examMessages(asPaperItem(it));
      const reply = await call(m[0]!.content, m[1]!.content);
      if (reply === null) break;
      t.checking.shift();
      if (agrees(it, reply)) t.items.push(it);
      else t.rejected.disagree++;
      t.updatedAt = now;
      await s.put(key, t);
    }
    // 2. new items while the topic is short of them
    if (t.items.length + t.checking.length < PER_TOPIC && t.asked < MAX_WRITES && room()) {
      const reply = await call(PRACTICE_SYSTEM, practicePrompt(w.stage, w.subject, w.topic));
      if (reply !== null) {
        t.asked++;
        const got = readPractice(reply);
        t.rejected.malformed += got.malformed;
        held ??= await heldQuestions(s, w.stage);
        const seen = [...t.items, ...t.checking].map((x) => x.q);
        for (const it of got.items) {
          if (tooClose(it.q, held)) t.rejected.nearPaper++;
          else if (tooClose(it.q, seen, 0.9)) t.rejected.malformed++;
          else if (it.type === 'short') t.items.push(it);
          else t.checking.push(it);
          seen.push(it.q);
        }
        t.updatedAt = now;
        await s.put(key, t);
      }
    }
    if (t.checking.length || (t.items.length < PER_TOPIC && t.asked < MAX_WRITES)) more = true;
  }
  await s.put(PROGRESS_KEY, prog);
  return { calls, more: more && prog.calls < CALLS_PER_DAY, noModel, note: noModel ? 'practice: no online model free right now' : `practice: ${calls} questions to the online AIs` };
}

/** Every practice topic kept for a stage. */
export async function loadPractice(storage: DurableObjectStorage, stage: StageId): Promise<PracticeTopic[]> {
  const got = await storage.list<PracticeTopic>({ prefix: `${PRACTICE_PREFIX}${stage}:` }).catch(() => new Map<string, PracticeTopic>());
  return [...got.values()].filter((t) => t && Array.isArray(t.items));
}

/** A kept item as a training record: exact ones with their answer and how to check it, written ones with the worked answer. */
export function practiceRecord(t: Pick<PracticeTopic, 'stage' | 'subject' | 'topic'>, it: PracticeItem): TrainRecord {
  const from = `school practice: ${stageName(t.stage)} ${(SUBJECT_LABEL[t.subject] ?? t.subject).toLowerCase()} · ${t.topic}`.slice(0, 160);
  const messages = examMessages(asPaperItem(it, t.topic));
  if (it.type === 'short') return { kind: 'school', messages: [...messages, { role: 'assistant', content: it.worked }], from };
  return { kind: 'school', messages, answer: it.answer, check: { type: it.type, ...(it.options ? { options: it.options } : {}) }, from };
}

/**
 * The week's school records: taken a topic at a time in turn (so every weak spot is in), at most `max`, each checked
 * against every question that is or may be on a paper (`held`) once more, and by the record checker.
 */
export function practiceRecords(topics: PracticeTopic[], held: string[], max = WEEKLY_SCHOOL): { recs: TrainRecord[]; near: number } {
  const recs: TrainRecord[] = [];
  let near = 0;
  const queues = topics.map((t) => t.items.map((it) => [t, it] as const));
  for (let i = 0; recs.length < max && queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      if (recs.length >= max) break;
      const x = q[i];
      if (!x) continue;
      if (tooClose(x[1].q, held)) {
        near++;
        continue;
      }
      const r = practiceRecord(x[0], x[1]);
      if (!recordProblem(r)) recs.push(r);
    }
  }
  return { recs, near };
}

/** For the training status: how much practice waits at his stage ("school practice: 96"). */
export async function practiceSummary(storage: DurableObjectStorage): Promise<{ practice: number; note: string } | null> {
  const st = await loadState({ storage });
  const topics = await loadPractice(storage, st.stage);
  const n = topics.reduce((a, t) => a + t.items.length, 0);
  if (!topics.length) return null;
  const weak = topics.filter((t) => t.items.length).map((t) => t.topic).slice(0, 3);
  return { practice: Math.min(n, WEEKLY_SCHOOL), note: `school practice: ${Math.min(n, WEEKLY_SCHOOL)}${weak.length ? ` (${stageName(st.stage)}: ${weak.join(', ')})` : ''}` };
}

/**
 * For the SCHOOL tab's WEAK SPOTS: what is being practised at his stage ("practising: 3 weak spots · 24 items checked
 * this week"): the weak topics with practice kept or being checked, and the checked items of the topics worked on in
 * the last seven days. Null with nothing practised yet.
 */
export async function practiceView(storage: DurableObjectStorage, stage: StageId, now = Date.now()): Promise<{ spots: number; checked: number; line: string } | null> {
  const topics = (await loadPractice(storage, stage)).filter((t) => t.items.length || t.checking?.length);
  if (!topics.length) return null;
  const checked = topics.filter((t) => now - (t.updatedAt ?? 0) < 7 * 86_400_000).reduce((a, t) => a + t.items.length, 0);
  return { spots: topics.length, checked, line: `practising: ${topics.length} weak spot${topics.length === 1 ? '' : 's'} · ${checked} item${checked === 1 ? '' : 's'} checked this week` };
}
