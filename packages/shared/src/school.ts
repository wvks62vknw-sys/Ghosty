/**
 * Ghosty's school journey: the offline brain (the model on the owner's phone) grows up through the stages of
 * a UK education, strictly in order, and moves up only by passing that stage's exams with top grades.
 * The owner's rules (docs/build-plan/HANDOFF.md "Raising Ghosty"): only nursery is open at the start; every later
 * stage is locked until the one below is passed; the self-study curriculum, the reading library and the weekly
 * training only use what his stage has unlocked (the owner's own books and the chat are never locked); exams
 * are real papers (official ones where they exist, kept private; self-written ones in the same format) that he
 * has never trained on, marked exactly where the answer is exact and by a stronger model against the mark scheme
 * where it is not, against real grade boundaries. Pure: types, the stage table and the marking helpers that both
 * halves share (brain: apps/edge/src/school/*; phone: apps/web/src/features/school, apps/web/src/school/*).
 */

export const STAGE_IDS = ['nursery', 'reception', 'ks1', 'ks2', 'ks3', 'gcse', 'alevel', 'university', 'library'] as const;
export type StageId = (typeof STAGE_IDS)[number];

export interface Stage {
  id: StageId;
  /** As the owner knows it. */
  label: string;
  /** The school years (ages) it covers. */
  years: string;
  /** The subjects he must pass to move up (ids; `SUBJECT_LABEL` has the words). */
  subjects: string[];
  /** The exams that stand for this stage, in a few words, and whether official papers exist for it. */
  exams: string;
  official: boolean;
  /** What "top grades" means here (the pass rule, in plain words); `passBand` is the rule in code. */
  pass: string;
  /** GYM levels that match this stage's difficulty (training and the GYM's own card use them). */
  gym: [number, number];
  /** The self-study curriculum levels (1 basics, 2 intermediate, 3 advanced) this stage unlocks. */
  curriculum: (1 | 2 | 3)[];
}

export const SUBJECT_LABEL: Record<string, string> = {
  talk: 'Talking and listening', letters: 'Letters and sounds', numbers: 'Numbers', world: 'The world around us',
  phonics: 'Phonics', reading: 'Reading', writing: 'Writing', maths: 'Maths', gps: 'Grammar, punctuation and spelling',
  science: 'Science', english: 'English', history: 'History', geography: 'Geography', computing: 'Computing',
  'english-language': 'English language', 'english-literature': 'English literature', biology: 'Biology',
  chemistry: 'Chemistry', physics: 'Physics', 'computer-science': 'Computer science', 'further-maths': 'Further maths',
  economics: 'Economics', 'uni-maths': 'Mathematics', 'uni-computing': 'Computing', 'uni-physical': 'Physical sciences',
  'uni-life': 'Life sciences', 'uni-humanities': 'Humanities', 'uni-economics': 'Economics and finance', everything: 'Everything in the library',
};

export const STAGES: Stage[] = [
  { id: 'nursery', label: 'Nursery', years: 'ages 3–4', subjects: ['talk', 'letters', 'numbers', 'world'], exams: 'short checks: counting, letters, simple words, listening to a story', official: false, pass: 'at least 85% in every subject', gym: [1, 1], curriculum: [] },
  { id: 'reception', label: 'Reception', years: 'ages 4–5', subjects: ['phonics', 'reading', 'writing', 'maths'], exams: 'early-years checks: phonics, numbers to 20, shapes, a first story', official: false, pass: 'at least 85% in every subject', gym: [1, 2], curriculum: [] },
  { id: 'ks1', label: 'Key Stage 1', years: 'Years 1–2, ages 5–7', subjects: ['reading', 'gps', 'writing', 'maths', 'science'], exams: 'the phonics check and Key Stage 1 style papers', official: true, pass: 'the top band (85%+) in every subject', gym: [2, 3], curriculum: [] },
  { id: 'ks2', label: 'Key Stage 2 (SATs)', years: 'Years 3–6, ages 7–11', subjects: ['reading', 'gps', 'writing', 'maths', 'science'], exams: 'the official Year 6 SATs papers: reading; grammar, punctuation and spelling; maths', official: true, pass: 'the higher standard (a scaled score of 110+) in reading, grammar and maths, and the top band in the rest', gym: [3, 4], curriculum: [] },
  { id: 'ks3', label: 'Key Stage 3', years: 'Years 7–9, ages 11–14', subjects: ['english', 'maths', 'science', 'history', 'geography', 'computing'], exams: 'end-of-Key-Stage-3 papers written in the national-curriculum style (there are no national tests)', official: false, pass: 'the top band (85%+) in every subject', gym: [5, 6], curriculum: [] },
  { id: 'gcse', label: 'GCSE', years: 'Years 10–11, ages 14–16', subjects: ['english-language', 'english-literature', 'maths', 'biology', 'chemistry', 'physics', 'history', 'geography', 'computer-science'], exams: 'official past papers from the exam boards', official: true, pass: 'grade 8 or 9 in every subject', gym: [6, 7], curriculum: [1] },
  { id: 'alevel', label: 'A-level', years: 'Years 12–13, ages 16–18', subjects: ['maths', 'further-maths', 'physics', 'chemistry', 'biology', 'computer-science', 'economics', 'english-literature', 'history'], exams: 'official past papers from the exam boards', official: true, pass: 'an A or A* in every subject', gym: [7, 8], curriculum: [1, 2] },
  { id: 'university', label: 'University', years: 'degree level', subjects: ['uni-maths', 'uni-computing', 'uni-physical', 'uni-life', 'uni-humanities', 'uni-economics'], exams: 'module exams from open university courses, and papers written to match', official: true, pass: 'a first (70%+) in every module', gym: [8, 9], curriculum: [1, 2, 3] },
  { id: 'library', label: 'The whole library', years: 'and beyond', subjects: ['everything'], exams: 'questions set from every book in the library', official: false, pass: 'always open once university is passed', gym: [9, 10], curriculum: [1, 2, 3] },
];

export const stageById = (id: string): Stage | undefined => STAGES.find((s) => s.id === id);
export const stageIndex = (id: StageId): number => STAGE_IDS.indexOf(id);
export const nextStage = (id: StageId): StageId | null => STAGE_IDS[stageIndex(id) + 1] ?? null;
/** A stage is open when it is the current one or below it. */
export const stageOpen = (current: StageId, id: StageId): boolean => stageIndex(id) <= stageIndex(current);
/** Whether self-study may read a curriculum topic of this level at the current stage (the owner's own books are never locked). */
export const topicUnlocked = (current: StageId, level: 1 | 2 | 3): boolean => (stageById(current)?.curriculum ?? []).includes(level);
/** Reading ahead: at most two stages above the current one, and never the library itself. */
export const BORROW_AHEAD = 2;
export const canBorrowFrom = (current: StageId, from: StageId): boolean => {
  const d = stageIndex(from) - stageIndex(current);
  return d >= 1 && d <= BORROW_AHEAD && from !== 'library';
};

// ---- papers and marks ---------------------------------------------------------------------------------------

/**
 * How an item is marked: exact and number by the code here (full marks or none); mcq by its letter or text; short
 * and extended by a stronger model against the mark scheme (`rubric`), which may give part marks.
 */
export type ItemType = 'exact' | 'number' | 'mcq' | 'short' | 'extended';

export interface PaperItem {
  id: string;
  q: string;
  type: ItemType;
  marks: number;
  /** The answer (exact, number, the right option's letter for mcq, the model answer for short/extended). */
  answer?: string;
  /** Other acceptable exact answers. */
  also?: string[];
  options?: string[];
  /** For numbers: how far off still counts (absolute), and a unit the brain may write or leave out. */
  tolerance?: number;
  unit?: string;
  /** The mark scheme for short/extended answers, as the marker reads it. */
  rubric?: string;
  /** The topic the item tests (weak spots are counted by topic). */
  topic: string;
}

export interface GradeBand {
  /** The lowest raw mark (inclusive) that earns this grade. */
  from: number;
  grade: string;
  /** This band counts as "top grades" for moving up. */
  top?: boolean;
}

export interface Paper {
  id: string;
  stage: StageId;
  subject: string;
  title: string;
  /** An official paper (kept private, source and licence noted) or one Ghosty wrote in the same format. */
  official: boolean;
  source?: string;
  licence?: string;
  items: PaperItem[];
  maxMarks: number;
  /** Highest `from` first is not required: `gradeFor` sorts. For SATs the grade is the scaled score ("110"). */
  bands: GradeBand[];
  /** Self-written papers: the seed they were made from (a new seed is a new paper). */
  seed?: number;
}

export interface ItemResult {
  id: string;
  given: string;
  got: number;
  max: number;
  how: 'exact' | 'model' | 'pending' | 'unanswered';
  /** The marker's one-line reason (model marking), so the owner can spot-check. */
  note?: string;
}

export interface PaperResult {
  paperId: string;
  stage: StageId;
  subject: string;
  title: string;
  official: boolean;
  at: number;
  /** Where the paper was sat: this phone, or the free GPU with the same weights. */
  where: 'phone' | 'kaggle';
  /** The model that sat it ('stock' or a trained week's label). */
  model: string;
  raw: number;
  max: number;
  grade: string;
  top: boolean;
  /** Marks by topic, for weak spots. */
  topics: Record<string, { got: number; max: number }>;
  marked: { exact: number; model: number; pending: number };
  answers: ItemResult[];
  /**
   * The honest gap: the strongest free online model sat the same items once, marked the same way (asked by the
   * brain afterwards, cached per paper; never the exam gate, never trained on). Absent until it has.
   */
  online?: OnlineMark;
}

/** How the online model did on the same paper. */
export interface OnlineMark {
  raw: number;
  grade: string;
  /** Which model sat it, as the brain knows it. */
  model: string;
  at: number;
}

/** The default bands for a self-written paper: a plain percentage scale where the top band starts at 85%. */
export const percentBands = (maxMarks: number): GradeBand[] => [
  { from: Math.ceil(maxMarks * 0.85), grade: 'Top band', top: true },
  { from: Math.ceil(maxMarks * 0.7), grade: 'Secure' },
  { from: Math.ceil(maxMarks * 0.5), grade: 'Expected' },
  { from: 0, grade: 'Working towards' },
];

/** GCSE 9–1 from a percentage, for a self-written paper (official papers carry their board's own boundaries). */
export const gcseBands = (maxMarks: number): GradeBand[] =>
  [[0.85, '9', true], [0.75, '8', true], [0.65, '7'], [0.55, '6'], [0.45, '5'], [0.35, '4'], [0.25, '3'], [0.15, '2'], [0.05, '1'], [0, 'U']].map(([p, g, top]) => ({ from: Math.ceil(maxMarks * (p as number)), grade: g as string, ...(top ? { top: true } : {}) }));

/** A-level A*–E from a percentage, for a self-written paper. */
export const alevelBands = (maxMarks: number): GradeBand[] =>
  [[0.85, 'A*', true], [0.75, 'A', true], [0.65, 'B'], [0.55, 'C'], [0.45, 'D'], [0.35, 'E'], [0, 'U']].map(([p, g, top]) => ({ from: Math.ceil(maxMarks * (p as number)), grade: g as string, ...(top ? { top: true } : {}) }));

/** Degree classes from a percentage. */
export const degreeBands = (maxMarks: number): GradeBand[] =>
  [[0.7, 'First', true], [0.6, '2:1'], [0.5, '2:2'], [0.4, 'Third'], [0, 'Fail']].map(([p, g, top]) => ({ from: Math.ceil(maxMarks * (p as number)), grade: g as string, ...(top ? { top: true } : {}) }));

/** The bands a self-written paper at this stage uses. */
export function bandsFor(stage: StageId, maxMarks: number): GradeBand[] {
  if (stage === 'gcse') return gcseBands(maxMarks);
  if (stage === 'alevel') return alevelBands(maxMarks);
  if (stage === 'university' || stage === 'library') return degreeBands(maxMarks);
  return percentBands(maxMarks);
}

/** The grade a raw mark earns on a paper, and whether it counts as top grades. */
export function gradeFor(paper: Pick<Paper, 'bands'>, raw: number): { grade: string; top: boolean } {
  const bands = [...paper.bands].sort((a, b) => b.from - a.from);
  const b = bands.find((x) => raw >= x.from) ?? bands.at(-1);
  return { grade: b?.grade ?? '—', top: !!b?.top };
}

/** A stage is passed when the latest result in every one of its subjects is top grades. */
export function stagePassed(stage: Stage, latest: Record<string, PaperResult | undefined>): { passed: boolean; missing: string[] } {
  const missing = stage.subjects.filter((s) => !latest[s]?.top);
  return { passed: missing.length === 0, missing };
}

// ---- exact marking ------------------------------------------------------------------------------------------

/** The answer a reply gives: the last "Answer:" / "Final answer:" line when there is one, else the whole reply. */
export function answerLine(reply: string): string {
  const lines = reply.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i]!.match(/^\**\s*(?:final\s+)?answer\s*[:=]\s*\**\s*(.+?)\s*\**$/i);
    if (m) return m[1]!;
  }
  return lines.at(-1) ?? reply.trim();
}

/** Lower case, no punctuation, no leading article, single spaces. */
export function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"'’`]/g, '')
    .replace(/[^\p{L}\p{N}\s./-]/gu, ' ')
    .replace(/^\s*(the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first number in a text, allowing commas, fractions ("3/4", "1 1/2"), percentages and a leading minus. */
export function parseNumber(s: string): number | null {
  const t = s.replace(/,/g, '').replace(/[£$€]/g, '');
  const mixed = t.match(/(-?\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const w = Number(mixed[1]);
    return w + (Math.sign(w) || 1) * (Number(mixed[2]) / Number(mixed[3]));
  }
  const frac = t.match(/(-?\d+)\s*\/\s*(\d+)/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Marks an exact, number or mcq item (full marks or none). Short and extended items return null: they are for
 * the model marker. The given text is the brain's whole reply: the answer line is read out of it first.
 */
export function markExact(item: PaperItem, given: string): number | null {
  if (item.type === 'short' || item.type === 'extended') return null;
  const a = answerLine(given);
  if (item.type === 'number') {
    const want = parseNumber(item.answer ?? '');
    const got = parseNumber(item.unit ? a.replace(new RegExp(item.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '') : a);
    if (want == null || got == null) return 0;
    return Math.abs(got - want) <= (item.tolerance ?? 1e-9) ? item.marks : 0;
  }
  if (item.type === 'mcq') {
    const letter = a.match(/^\(?([a-h])\)?(?:[.):\s]|$)/i)?.[1]?.toLowerCase();
    const want = (item.answer ?? '').trim().toLowerCase();
    if (letter) return letter === want ? item.marks : 0;
    const idx = 'abcdefgh'.indexOf(want);
    const text = item.options?.[idx];
    return text && normaliseText(a) === normaliseText(text) ? item.marks : 0;
  }
  const ok = [item.answer ?? '', ...(item.also ?? [])].map(normaliseText).filter(Boolean);
  return ok.includes(normaliseText(a)) ? item.marks : 0;
}

/** The result of a paper from its items' results (the grade from the paper's bands; topics summed). */
export function scorePaper(paper: Paper, answers: ItemResult[], meta: Pick<PaperResult, 'at' | 'where' | 'model'>): PaperResult {
  const byId = new Map(answers.map((a) => [a.id, a]));
  const topics: Record<string, { got: number; max: number }> = {};
  const marked = { exact: 0, model: 0, pending: 0 };
  let raw = 0;
  for (const it of paper.items) {
    const r = byId.get(it.id);
    const got = r?.how === 'pending' ? 0 : (r?.got ?? 0);
    raw += got;
    const t = (topics[it.topic] ??= { got: 0, max: 0 });
    t.got += got;
    t.max += it.marks;
    if (r?.how === 'exact') marked.exact++;
    else if (r?.how === 'model') marked.model++;
    else if (r?.how === 'pending') marked.pending++;
  }
  const g = gradeFor(paper, raw);
  return { paperId: paper.id, stage: paper.stage, subject: paper.subject, title: paper.title, official: paper.official, ...meta, raw, max: paper.maxMarks, grade: g.grade, top: g.top && marked.pending === 0, topics, marked, answers };
}

/** The topics he did worst in across recent results (share of marks lost), worst first. */
export function weakSpots(results: PaperResult[], max = 5): { topic: string; stage: StageId; subject: string; lost: number; of: number }[] {
  const acc = new Map<string, { topic: string; stage: StageId; subject: string; lost: number; of: number }>();
  for (const r of results) {
    for (const [topic, t] of Object.entries(r.topics)) {
      const k = `${r.stage}|${r.subject}|${topic}`;
      const a = acc.get(k) ?? { topic, stage: r.stage, subject: r.subject, lost: 0, of: 0 };
      a.lost += t.max - t.got;
      a.of += t.max;
      acc.set(k, a);
    }
  }
  return [...acc.values()].filter((a) => a.of > 0 && a.lost > 0).sort((a, b) => b.lost / b.of - a.lost / a.of || b.lost - a.lost).slice(0, max);
}

// ---- the exam prompt, and the gap ------------------------------------------------------------------------------

/**
 * The exam prompt the phone sits a paper with (apps/web/src/school/sit.ts `examPrompt` gives these same messages),
 * so a paper sat on Kaggle's free GPU by the same weights, and the online model's sitting of it, are asked exactly
 * the same way. The notebook's Python copy (`exam_prompt`) is held to it on shared cases (training/kaggle/fixtures.json).
 */
export const EXAM_SYSTEM = "You are sitting an exam. Answer the question. Finish with 'Answer: <your answer>'";
/** Tokens a question may take: about 200, a piece of writing about 350. */
export const EXAM_TOKENS = { item: 200, writing: 350 } as const;

export function examMessages(item: Pick<PaperItem, 'q' | 'type' | 'marks' | 'options'>, passage?: { title: string; text: string }): { role: 'system' | 'user'; content: string }[] {
  const parts: string[] = [];
  if (passage) parts.push(`Read this: "${passage.title}"\n\n${passage.text}`);
  parts.push(item.q);
  if (item.type === 'mcq' && item.options) parts.push(`${item.options.map((o, i) => `${'ABCD'[i]}) ${o}`).join('\n')}\nAnswer with the letter.`);
  if (item.type === 'short') parts.push(`(${item.marks} mark${item.marks === 1 ? '' : 's'}: explain briefly.)`);
  if (item.type === 'extended') parts.push(`(${item.marks} marks: write it out in full.)`);
  const system = item.type === 'extended' ? `${EXAM_SYSTEM}. For a piece of writing, write the whole piece, then finish with 'Answer: done'.` : EXAM_SYSTEM;
  return [
    { role: 'system', content: system },
    { role: 'user', content: parts.join('\n\n') },
  ];
}

/** The gap on one paper in plain words: "offline 14/40 · online 36/40" (null until the online model has sat it). */
export function gapLine(r: Pick<PaperResult, 'raw' | 'max' | 'online'>): string | null {
  return r.online ? `offline ${r.raw}/${r.max} · online ${r.online.raw}/${r.max}` : null;
}
