/**
 * SCHOOL's question banks for Key Stage 3, GCSE, A-level and university: the stages whose papers Ghosty cannot
 * make from generators (papers.ts does nursery to Key Stage 2). Each stage and subject in `STAGES` gets a bank of
 * questions written ONCE by a stronger online model (the router's background lane, never waiting: with no model
 * free a slice simply waits for the next one), in the real exam style for that level (command words, marks per
 * question, mark schemes for written answers), and CHECKED TWICE:
 *  - an exact question (a number, a word, a multiple-choice letter) is kept only when a second model call, given
 *    the question alone, reaches the same answer (marked by the same `markExact` that marks his papers);
 *  - a written question is kept only when a second call judges its mark scheme sound.
 * Everything else is rejected and counted (wrong answer, unsound mark scheme, needs a picture, malformed, a
 * repeat), so the owner sees how many were thrown away.
 *
 * Slices: one `bankTick` makes at most `CALLS_PER_TICK` model calls (a write of `WRITE_BATCH` questions, then
 * checks of `CHECK_BATCH` at a time), saves, and stops; the next tick carries on from what was saved (resumable).
 * Ticks come from the phone while SCHOOL is open and from the daily school step (routes.ts).
 *
 * Kept in the brain's own storage only, under `school:bank:<stage>:<subject>` (the progress) and
 * `school:bank:<stage>:<subject>:<n>` (the questions, in chunks well under the 128 KB record limit): never in
 * the library, never exported, never trained on. A paper is drawn from a finished bank by seed with the stage's
 * real structure (`SHAPES`: GCSE maths 80 marks of 1–5-mark questions across the topics; A-level 100 marks …),
 * graded with `bandsFor` — so a new seed is a new paper of the same shape.
 */
import { bandsFor, markExact, normaliseText, parseNumber, SUBJECT_LABEL, type ItemType, type StageId } from '../../../../packages/shared/src/school';
import type { Ask } from './mark';
import type { SchoolItem, SchoolPaper } from './papers';

/** The stages whose papers come from a bank. */
export const BANK_STAGES: StageId[] = ['ks3', 'gcse', 'alevel', 'university'];
export const isBankStage = (s: StageId): boolean => BANK_STAGES.includes(s);

/** Model calls one slice may make (the brief: never more than a few per tick). */
export const CALLS_PER_TICK = 4;
/** Questions asked for in one write call, and checked in one check call. */
export const WRITE_BATCH = 8;
export const CHECK_BATCH = 6;
/** A reply that could not be read is asked again this many times before the questions in it are given up. */
const MAX_TRIES = 3;
/** One stored chunk of questions stays under this many characters (a record holds at most 128 KB). */
const CHUNK_CHARS = 90_000;

/** A paper's real structure at a stage, and how big its bank is. */
export interface Shape {
  /** Marks in one paper. */
  marks: number;
  /** Marks one question may carry (lowest, highest). */
  min: number;
  max: number;
  /** Questions the bank holds when it is finished. */
  target: number;
  /** The exam style, as the writer is told it. */
  style: string;
  topics: string[];
}

const T = (s: string) => s.split(';').map((x) => x.trim()).filter(Boolean);
const KS3 = 'the end-of-Key-Stage-3 (Year 9) style of the national curriculum in England: clear command words (State, Describe, Explain, Calculate), 1–6 marks a question, a mark scheme point per mark';
const GCSE = (board: string) => `the GCSE (9–1) Higher tier style of ${board}: their command words (Work out, Calculate, Explain, Evaluate, Compare), marks shown per question, mark schemes as the boards write them (marking points, levels for long answers)`;
const AL = 'the A-level style of AQA, Pearson Edexcel and OCR: their command words, multi-step questions, marks shown per question, mark schemes as the boards write them (method and accuracy marks, levels for essays)';
const UNI = 'a UK university first- and second-year module exam: short derivations and calculations, explain-and-justify questions, one longer essay-style answer per paper, marks shown per question, a model answer and marking points for each';

/** Each bank stage's subjects: the structure of one paper and the topics the bank covers. */
export const SHAPES: Record<string, Record<string, Shape>> = {
  ks3: {
    english: { marks: 50, min: 1, max: 10, target: 45, style: `${KS3}; reading questions quote a short extract written into the question; one piece of writing with a levelled mark scheme`, topics: T('retrieval from a short extract; inference; language analysis; structure; comparing viewpoints; grammar and punctuation; vocabulary in context; persuasive writing; descriptive writing; Shakespeare and poetry basics') },
    maths: { marks: 60, min: 1, max: 5, target: 70, style: KS3, topics: T('fractions, decimals and percentages; negative numbers and order of operations; powers, roots and standard form; algebraic expressions and equations; sequences; ratio and proportion; angles and polygons; area, perimeter and volume; probability; statistics and averages; coordinates and straight-line graphs; Pythagoras') },
    science: { marks: 60, min: 1, max: 6, target: 65, style: KS3, topics: T('cells and organisation; the skeletal and muscular systems; nutrition and digestion; respiration and photosynthesis; inheritance and evolution; particles and states of matter; atoms, elements and compounds; chemical reactions and acids; the periodic table; forces and motion; energy; waves, light and sound; electricity and magnetism; space') },
    history: { marks: 50, min: 1, max: 12, target: 40, style: `${KS3}; source questions describe the source in words`, topics: T('the Norman conquest; medieval England and the Church; the Tudors and the Reformation; the English Civil War; the British Empire; the transatlantic slave trade; the Industrial Revolution; the First World War; the Second World War and the Holocaust; the twentieth century and the world since 1945') },
    geography: { marks: 50, min: 1, max: 8, target: 45, style: KS3, topics: T('map skills, grid references and scale; weather and climate; rivers and flooding; coasts; glaciation; plate tectonics, earthquakes and volcanoes; population and urbanisation; development and globalisation; resources and sustainability; ecosystems and biomes') },
    computing: { marks: 50, min: 1, max: 6, target: 50, style: `${KS3}; code is written in Python inside the question`, topics: T('algorithms and flowcharts; Python: variables, selection and iteration; lists and searching; sorting algorithms; binary and denary; hexadecimal and data units; logic gates and truth tables; hardware and the CPU; networks and the internet; staying safe and the law') },
  },
  gcse: {
    'english-language': { marks: 80, min: 4, max: 24, target: 30, style: `${GCSE('AQA, Pearson Edexcel and OCR')}; each reading question quotes the short extract it is about; writing tasks have a levelled content and SPaG mark scheme`, topics: T('information retrieval; language analysis; structure analysis; evaluation of a text; comparing writers\' viewpoints; descriptive or narrative writing; writing to argue or persuade') },
    'english-literature': { marks: 64, min: 4, max: 34, target: 26, style: `${GCSE('AQA, Pearson Edexcel and OCR')}; essay questions on the set texts most schools study (Macbeth, Romeo and Juliet, A Christmas Carol, Jekyll and Hyde, An Inspector Calls, the power and conflict poems), each quoting the short extract it starts from, with a levelled mark scheme (AO1–AO4)`, topics: T('Shakespeare; the 19th-century novel; modern drama; poetry anthology; unseen poetry; context and themes') },
    maths: { marks: 80, min: 1, max: 5, target: 120, style: GCSE('AQA, Pearson Edexcel and OCR'), topics: T('number and indices; surds; fractions, decimals and percentages; algebraic manipulation; equations and inequalities; simultaneous equations; quadratics; sequences; functions and graphs; ratio, proportion and rates of change; geometry and angles; trigonometry; vectors; circle theorems; mensuration; probability; statistics') },
    biology: { marks: 100, min: 1, max: 6, target: 90, style: GCSE('AQA, Pearson Edexcel and OCR'), topics: T('cell biology; organisation; infection and response; bioenergetics; homeostasis and response; inheritance, variation and evolution; ecology; required practicals') },
    chemistry: { marks: 100, min: 1, max: 6, target: 90, style: GCSE('AQA, Pearson Edexcel and OCR'), topics: T('atomic structure and the periodic table; bonding and structure; quantitative chemistry; chemical changes; energy changes; rates and equilibrium; organic chemistry; chemical analysis; the atmosphere; using resources') },
    physics: { marks: 100, min: 1, max: 6, target: 90, style: `${GCSE('AQA, Pearson Edexcel and OCR')}; the equations he may need are given in the question where the board's equation sheet would give them`, topics: T('energy; electricity; particle model of matter; atomic structure and radioactivity; forces and motion; waves; magnetism and electromagnetism; space physics') },
    history: { marks: 84, min: 4, max: 16, target: 35, style: `${GCSE('AQA, Pearson Edexcel and OCR')}; source and interpretation questions describe or quote the source in the question; levelled mark schemes`, topics: T('Germany 1890–1945; conflict and tension 1918–1939; the First World War; health and the people; Elizabethan England; Norman England; America 1840–1895; the Cold War') },
    geography: { marks: 88, min: 1, max: 9, target: 60, style: GCSE('AQA, Pearson Edexcel and OCR'), topics: T('natural hazards; tectonic hazards; weather hazards and climate change; ecosystems and tropical rainforests; hot deserts or cold environments; coasts; rivers; urban issues and challenges; the changing economic world; resource management; geographical skills') },
    'computer-science': { marks: 80, min: 1, max: 8, target: 80, style: `${GCSE('AQA and OCR')}; code in the exam reference language or Python, written inside the question`, topics: T('algorithms and searching and sorting; programming fundamentals; data types and structures; Boolean logic; data representation; computer systems and the CPU; memory and storage; networks and protocols; cyber security; ethical, legal and environmental impacts') },
  },
  alevel: {
    maths: { marks: 100, min: 1, max: 10, target: 100, style: AL, topics: T('proof; algebra and functions; coordinate geometry; sequences and series; trigonometry; exponentials and logarithms; differentiation; integration; numerical methods; vectors; statistical distributions; hypothesis testing; kinematics; forces and Newton\'s laws; moments') },
    'further-maths': { marks: 100, min: 2, max: 12, target: 90, style: AL, topics: T('complex numbers; matrices; further algebra and functions; further calculus; polar coordinates; hyperbolic functions; differential equations; proof by induction; series and Maclaurin; vectors, lines and planes') },
    physics: { marks: 100, min: 1, max: 8, target: 100, style: `${AL}; the constants and equations he may need are given in the question where the data booklet would give them`, topics: T('measurements and errors; particles and radiation; waves; mechanics and materials; electricity; further mechanics and circular motion; thermal physics; gravitational and electric fields; capacitors; magnetic fields; nuclear physics') },
    chemistry: { marks: 100, min: 1, max: 8, target: 100, style: AL, topics: T('atomic structure; amount of substance; bonding; energetics; kinetics; equilibria and Kc; redox; the periodic table; thermodynamics; electrode potentials; acids, bases and pH; organic mechanisms; aromatic chemistry; polymers; organic synthesis; spectroscopy') },
    biology: { marks: 100, min: 1, max: 25, target: 90, style: `${AL}; one 25-mark essay per paper, marked by levels`, topics: T('biological molecules; cells; exchange and transport; genetic information and variation; energy transfers in and between organisms; responses to stimuli; genetics, populations, evolution and ecosystems; control of gene expression') },
    'computer-science': { marks: 100, min: 1, max: 12, target: 90, style: `${AL}; code in pseudo-code or Python, written inside the question`, topics: T('data structures; algorithms and complexity; theory of computation; data representation; computer systems and hardware; computer organisation and architecture; communication and networking; databases and SQL; big data and functional programming; consequences of computing') },
    economics: { marks: 80, min: 2, max: 25, target: 50, style: `${AL}; data-response questions describe the data in words; levelled essays`, topics: T('the economic problem; price determination; production, costs and revenue; market structures; market failure and government intervention; the labour market; the national economy; macroeconomic policy; the international economy; the financial sector') },
    'english-literature': { marks: 75, min: 10, max: 25, target: 30, style: `${AL}; essay questions on widely studied texts (King Lear, Othello, The Great Gatsby, Frankenstein, The Handmaid's Tale, A Streetcar Named Desire, the Romantic poets), each quoting a short extract or critical view to start from; levelled mark schemes (AO1–AO5)`, topics: T('Shakespearean tragedy; the Gothic; American literature; dystopia; poetry; modern drama; critical perspectives') },
    history: { marks: 80, min: 10, max: 25, target: 30, style: `${AL}; extract and source questions quote them in the question; levelled essays`, topics: T('Tsarist and Communist Russia; the Tudors; Britain 1851–1964; the American dream; the Cold War; democracy and Nazism in Germany; the British Empire') },
  },
  university: {
    'uni-maths': { marks: 100, min: 2, max: 20, target: 70, style: UNI, topics: T('real analysis; linear algebra; group theory; multivariable calculus; differential equations; probability theory; statistics; numerical analysis') },
    'uni-computing': { marks: 100, min: 2, max: 20, target: 70, style: UNI, topics: T('algorithms and complexity; data structures; operating systems; computer networks; databases; programming languages and types; computer architecture; machine learning basics') },
    'uni-physical': { marks: 100, min: 2, max: 20, target: 70, style: UNI, topics: T('classical mechanics; electromagnetism; quantum mechanics; thermodynamics and statistical physics; physical chemistry; organic chemistry; spectroscopy; waves and optics') },
    'uni-life': { marks: 100, min: 2, max: 20, target: 70, style: UNI, topics: T('molecular biology; genetics; cell biology; biochemistry and metabolism; physiology; ecology and evolution; immunology; microbiology') },
    'uni-humanities': { marks: 100, min: 5, max: 30, target: 45, style: UNI, topics: T('historiography; early modern Europe; modern British history; political philosophy; ethics; literary theory; the history of ideas') },
    'uni-economics': { marks: 100, min: 2, max: 25, target: 60, style: UNI, topics: T('microeconomic theory; macroeconomic theory; game theory; econometrics; corporate finance; financial markets; public economics; international trade') },
  },
};
export const shapeOf = (stage: StageId, subject: string): Shape | undefined => SHAPES[stage]?.[subject];

const STAGE_WORDS: Record<string, string> = { ks3: 'Key Stage 3', gcse: 'GCSE', alevel: 'A-level', university: 'university' };
/** "maths", "English literature" (lower case, but English keeps its capital). */
export const subjectWords = (subject: string) => (SUBJECT_LABEL[subject] ?? subject).toLowerCase().replace(/\benglish\b/g, 'English');
/** "the GCSE maths bank". */
export const bankName = (stage: StageId, subject: string): string => `the ${STAGE_WORDS[stage] ?? stage} ${subjectWords(subject)} bank`;

// ---- what is kept ------------------------------------------------------------------------------------------------

/** A question waiting for its second check. */
export interface Draft extends Omit<SchoolItem, 'id'> {
  id: string;
  tries?: number;
}

export interface Rejected {
  /** An exact answer the second call did not reach. */
  wrong: number;
  /** A written question whose mark scheme the second call did not judge sound. */
  unsound: number;
  /** Needs a diagram, picture or graph to answer. */
  picture: number;
  /** Not a usable question (missing parts, an answer that does not parse, marks out of range). */
  malformed: number;
  /** The same question as one already in the bank. */
  repeat: number;
}
const noneRejected = (): Rejected => ({ wrong: 0, unsound: 0, picture: 0, malformed: 0, repeat: 0 });
export const rejectedCount = (r: Rejected): number => r.wrong + r.unsound + r.picture + r.malformed + r.repeat;

/** A bank's progress record (`school:bank:<stage>:<subject>`). The questions are in its chunks. */
export interface BankMeta {
  stage: StageId;
  subject: string;
  target: number;
  /** Checked questions kept, and the chunks they are in. */
  kept: number;
  chunks: number;
  /** Questions written and waiting for their second check. */
  drafts: Draft[];
  rejected: Rejected;
  /** Model calls made in all, and write calls whose reply could not be read. */
  calls: number;
  unreadable: number;
  /** Next question number (ids are b1, b2, … in the order written). */
  next: number;
  /** The question stems already in the bank (normalised), so a repeat is thrown out. */
  seen: string[];
  startedAt: number;
  updatedAt: number;
  /** Plain words: what the last slice did ("waiting for a free model"). */
  note: string;
  done: boolean;
}

export const bankKey = (stage: StageId, subject: string): string => `school:bank:${stage}:${subject}`;
const chunkKey = (stage: StageId, subject: string, n: number) => `${bankKey(stage, subject)}:${n}`;

/** Where banks live (the brain's own storage; never KV, never the library). */
export interface BankStore {
  storage: DurableObjectStorage;
}

export async function loadBank(s: BankStore, stage: StageId, subject: string): Promise<BankMeta | undefined> {
  return (await s.storage.get<BankMeta>(bankKey(stage, subject))) ?? undefined;
}
/** Every question kept in a bank. */
export async function bankItems(s: BankStore, meta: Pick<BankMeta, 'stage' | 'subject' | 'chunks'>): Promise<SchoolItem[]> {
  const keys = Array.from({ length: meta.chunks }, (_, i) => chunkKey(meta.stage, meta.subject, i));
  if (!keys.length) return [];
  const got = await s.storage.get<{ items: SchoolItem[] }>(keys);
  return keys.flatMap((k) => got.get(k)?.items ?? []);
}
/** A bank is finished (papers can be drawn from it) once it holds its target of checked questions. */
export const bankReady = (m: BankMeta | undefined): boolean => !!m && m.done && m.kept > 0;

export function freshBank(stage: StageId, subject: string, now: number): BankMeta {
  const shape = shapeOf(stage, subject);
  if (!shape) throw new Error(`No bank for ${stage} ${subject}.`);
  return { stage, subject, target: shape.target, kept: 0, chunks: 0, drafts: [], rejected: noneRejected(), calls: 0, unreadable: 0, next: 1, seen: [], startedAt: now, updatedAt: now, note: 'starting', done: false };
}

/** The progress line the owner sees: "Writing the GCSE maths bank · 48 of 120 · 7 rejected". */
export function bankLine(m: BankMeta): string {
  const rej = rejectedCount(m.rejected);
  const name = bankName(m.stage, m.subject);
  if (m.done) return `${name[0]!.toUpperCase()}${name.slice(1)}: ${m.kept} checked questions${rej ? ` (${rej} rejected)` : ''}`;
  return `Writing ${name} · ${m.kept} of ${m.target}${rej ? ` · ${rej} rejected` : ''}${m.drafts.length ? ` · ${m.drafts.length} being checked` : ''}${m.note && m.note !== 'starting' ? ` · ${m.note}` : ''}`;
}

/** A bank as the SCHOOL tab lists it. */
export function bankRow(m: BankMeta) {
  return { stage: m.stage, subject: m.subject, kept: m.kept, target: m.target, checking: m.drafts.length, rejected: { ...m.rejected, all: rejectedCount(m.rejected) }, calls: m.calls, done: m.done, line: bankLine(m), updatedAt: m.updatedAt };
}

// ---- the writer's and the checkers' words --------------------------------------------------------------------------

export const WRITER_SYSTEM =
  'BANK WRITER. You write exam questions for a UK question bank, in the real exam style you are given. Every question must stand on its own: ' +
  'NO diagrams, pictures, graphs, tables or charts to look at (put anything needed into words), and any short text a question is about is quoted inside the question. ' +
  'Use exact answers wherever the answer is exact (type "number" for a single numeric answer, "exact" for a word or short expression, "mcq" with four options and the right letter), ' +
  'and written answers (type "short", or "extended" for long answers) with a full mark scheme where it is not. Every answer must be correct: work it out before you write it. ' +
  'Reply with ONLY a JSON array, each element: {"topic": "...", "type": "number|exact|mcq|short|extended", "marks": <whole number>, "q": "the question", ' +
  '"options": ["four choices, mcq only"], "answer": "the number, the exact answer, the right letter a-d, or a model answer", "also": ["other exact answers accepted"], ' +
  '"unit": "the unit of a number answer, if any", "tolerance": <how far off a number answer may be, if rounding is allowed>, "rubric": "short and extended only: the mark scheme as the board writes it, point by point"}';

export function writerPrompt(m: BankMeta, n: number): string {
  const shape = shapeOf(m.stage, m.subject)!;
  // The topics with the fewest questions so far come first, so the bank covers them all.
  const counts = new Map(shape.topics.map((t) => [t, 0]));
  for (const s of m.seen) {
    const t = s.split('|')[0]!;
    if (counts.has(t)) counts.set(t, counts.get(t)! + 1);
  }
  const topics = [...counts].sort((a, b) => a[1] - b[1]).slice(0, 4).map(([t]) => t);
  const recent = m.seen.slice(-24).map((s) => `- ${s.split('|')[1]}`).join('\n');
  return [
    `Bank: ${STAGE_WORDS[m.stage]} ${SUBJECT_LABEL[m.subject] ?? m.subject}.`,
    `Exam style: ${shape.style}.`,
    `Write ${n} NEW questions on these topics (use each topic name exactly as written for "topic"): ${topics.join('; ')}.`,
    `Marks: each question carries ${shape.min} to ${shape.max} marks, as a real paper would give it.`,
    recent ? `Already in the bank (never repeat these):\n${recent}` : '',
  ].filter(Boolean).join('\n');
}

export const CHECK_EXACT_SYSTEM =
  'EXAM CHECK. Answer each exam question below yourself, carefully, working it out. Reply with ONLY one line per question, in this form:\n' +
  'N: <your final answer>\nwhere N is the question number. For multiple choice give only the letter. For a number give only the number.';
export const CHECK_SCHEME_SYSTEM =
  'SCHEME CHECK. You are a senior examiner checking mark schemes before they are used. For each question below, is its mark scheme sound: ' +
  'is the model answer correct, does the scheme fit the question and its marks, and could a fair examiner mark with it? Reply with ONLY one line per question:\n' +
  'N: SOUND\nor\nN: UNSOUND - <the reason>';

/** The question as the checker sees it: never the answer. */
const askLine = (d: Pick<Draft, 'q' | 'options' | 'unit'>, i: number) =>
  `${i + 1}. ${d.q}${d.options ? `\n${d.options.map((o, k) => `${'ABCD'[k]}) ${o}`).join('\n')}` : ''}${d.unit ? ` (answer in ${d.unit})` : ''}`;
export const checkExactPrompt = (ds: Draft[]): string => ds.map(askLine).join('\n\n');
export const checkSchemePrompt = (ds: Draft[]): string =>
  ds.map((d, i) => `${askLine(d, i)}\n[${d.marks} mark${d.marks === 1 ? '' : 's'}]\nModel answer: ${d.answer}\nMark scheme: ${d.rubric}`).join('\n\n');

/** "N: answer" lines → answers by number (1-based). */
export function numberedLines(reply: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of reply.replace(/<think>[\s\S]*?<\/think>/g, '').split('\n')) {
    const m = line.match(/^\s*\**\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*\**\s*[:.)\-–]\s*(.+?)\s*$/i);
    if (m && !out.has(Number(m[1]))) out.set(Number(m[1]), m[2]!.replace(/^\**|\**$/g, '').trim());
  }
  return out;
}

/** A model's JSON array (inside a code fence or prose), or null. */
export function jsonArray(reply: string): unknown[] | null {
  const t = reply.replace(/<think>[\s\S]*?<\/think>/g, '');
  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  if (a < 0 || b <= a) return null;
  try {
    const v = JSON.parse(t.slice(a, b + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

const PICTURE = /\b(diagram|the (graph|figure|picture|image|photo|map|chart|table|grid) (below|above|shown|opposite)|shown (below|above|opposite)|(see|look at|use|study) (the |figure |fig\.? )?(diagram|figure|fig\.?|graph|picture|photo|image|map|chart|grid|table)\b|on the (grid|graph|diagram|map|axes)|in the (diagram|figure|picture|photo)|(complete|draw|sketch|plot|shade|label) (on )?(the|a|an|your) (diagram|graph|grid|table|chart|map|figure|axes|bar chart|pie chart|number line|net|line graph)|fig(ure)?\s*\d)/i;
/** Whether a question needs something to look at (a diagram, a graph to read or to draw on). */
export const needsPicture = (q: string): boolean => PICTURE.test(q);

const TYPES: ItemType[] = ['exact', 'number', 'mcq', 'short', 'extended'];
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '').replace(/\s+\n/g, '\n').trim().slice(0, max);

/**
 * One question from a model's reply, made safe and complete, or the reason it is not usable. Marks must be a
 * whole number within `min`–`max`; an exact answer must be there (and parse, for a number); multiple choice needs
 * four different options and a letter a–d; a written one needs its model answer and mark scheme.
 */
export function cleanDraft(raw: unknown, min: number, max: number): Omit<Draft, 'id'> | { reject: keyof Rejected } {
  if (!raw || typeof raw !== 'object') return { reject: 'malformed' };
  const r = raw as Record<string, unknown>;
  const type = String(r.type ?? '').toLowerCase() as ItemType;
  const q = str(r.q ?? r.question, 2400);
  const marks = Number(r.marks);
  const topic = str(r.topic, 80) || 'general';
  if (!TYPES.includes(type) || q.length < 8 || !Number.isInteger(marks) || marks < min || marks > max) return { reject: 'malformed' };
  if (needsPicture(q)) return { reject: 'picture' };
  const answer = str(r.answer, type === 'extended' || type === 'short' ? 3000 : 200);
  const d: Omit<Draft, 'id'> = { q, type, marks, topic, answer };
  if (type === 'mcq') {
    const opts = Array.isArray(r.options) ? r.options.map((o) => str(o, 300).replace(/^[A-Da-d][).:]\s*/, '')).filter(Boolean) : [];
    const letter = answer.trim().toLowerCase().replace(/^\(?([a-d])\)?(?:[.):\s].*)?$/, '$1');
    if (opts.length !== 4 || new Set(opts.map((o) => o.toLowerCase())).size !== 4 || !/^[a-d]$/.test(letter)) return { reject: 'malformed' };
    d.options = opts;
    d.answer = letter;
  } else if (type === 'number') {
    if (parseNumber(answer) == null) return { reject: 'malformed' };
    const unit = str(r.unit, 20);
    if (unit) d.unit = unit;
    const tol = Number(r.tolerance);
    if (Number.isFinite(tol) && tol > 0 && tol <= Math.max(1, Math.abs(parseNumber(answer)!)) * 0.05) d.tolerance = tol;
  } else if (type === 'exact') {
    if (!normaliseText(answer)) return { reject: 'malformed' };
    const also = Array.isArray(r.also) ? r.also.map((x) => str(x, 200)).filter((x) => normaliseText(x)).slice(0, 6) : [];
    if (also.length) d.also = also;
  } else {
    const rubric = str(r.rubric ?? r.markScheme ?? r.mark_scheme, 3000);
    if (!rubric || !answer) return { reject: 'malformed' };
    d.rubric = rubric;
  }
  return d;
}

const stem = (q: string) => normaliseText(q).slice(0, 140);

/**
 * The second check of a few drafts: exact ones answered by a second call that sees the question alone (kept when
 * `markExact` gives that answer full marks), written ones judged by a second call (kept when SOUND). Returns the
 * drafts kept, those rejected with why, and those the reply said nothing about (asked again next time).
 */
export async function checkDrafts(ds: Draft[], ask: Ask): Promise<{ kept: Draft[]; rejected: { d: Draft; why: 'wrong' | 'unsound' }[]; again: Draft[] }> {
  const exact = ds.every((d) => d.type !== 'short' && d.type !== 'extended');
  const reply = await ask(exact ? CHECK_EXACT_SYSTEM : CHECK_SCHEME_SYSTEM, exact ? checkExactPrompt(ds) : checkSchemePrompt(ds));
  const lines = numberedLines(reply);
  const out = { kept: [] as Draft[], rejected: [] as { d: Draft; why: 'wrong' | 'unsound' }[], again: [] as Draft[] };
  ds.forEach((d, i) => {
    const said = lines.get(i + 1);
    if (said == null) return void out.again.push(d);
    if (exact) {
      if (markExact(d as SchoolItem, `Answer: ${said}`) === d.marks) out.kept.push(d);
      else out.rejected.push({ d, why: 'wrong' });
    } else if (/^SOUND\b/i.test(said)) out.kept.push(d);
    else if (/^UNSOUND\b/i.test(said)) out.rejected.push({ d, why: 'unsound' });
    else out.again.push(d);
  });
  return out;
}

/** The next drafts to check together: exact ones together, written ones together (they need different checkers). */
export function nextBatch<T extends Pick<Draft, 'type'>>(ds: T[]): T[] {
  const exact = ds.filter((d) => d.type !== 'short' && d.type !== 'extended');
  return (exact.length ? exact : ds).slice(0, CHECK_BATCH);
}

// ---- one slice -------------------------------------------------------------------------------------------------

async function addKept(s: BankStore, m: BankMeta, ds: Draft[]): Promise<void> {
  if (!ds.length) return;
  let n = Math.max(0, m.chunks - 1);
  let chunk = m.chunks ? ((await s.storage.get<{ items: SchoolItem[] }>(chunkKey(m.stage, m.subject, n)))?.items ?? []) : [];
  for (const d of ds) {
    const { tries: _t, ...item } = d;
    // Already there (a slice that stopped after saving its questions but before its progress): not twice.
    if (chunk.some((x) => x.id === item.id)) continue;
    if (chunk.length && JSON.stringify(chunk).length + JSON.stringify(item).length > CHUNK_CHARS) {
      await s.storage.put(chunkKey(m.stage, m.subject, n), { items: chunk });
      n++;
      chunk = [];
    }
    chunk.push(item as SchoolItem);
    m.kept++;
  }
  await s.storage.put(chunkKey(m.stage, m.subject, n), { items: chunk });
  m.chunks = n + 1;
}

/**
 * One slice of writing a bank: at most `CALLS_PER_TICK` model calls — check what waits for its second check, then
 * write more while the bank is short — saved as it goes, so the next slice carries on. A busy model (the call
 * throws) ends the slice: nothing is lost, it is tried again next time. Returns the bank and the calls made.
 */
export async function bankTick(s: BankStore, stage: StageId, subject: string, write: Ask | undefined, now: number): Promise<{ meta: BankMeta; calls: number }> {
  const shape = shapeOf(stage, subject);
  if (!shape) throw new Error(`${stage} ${subject} has no bank.`);
  const m = (await loadBank(s, stage, subject)) ?? freshBank(stage, subject, now);
  let calls = 0;
  if (!write) m.note = 'waiting for a free model';
  while (write && !m.done && calls < CALLS_PER_TICK) {
    try {
      if (m.drafts.length) {
        const batch = nextBatch(m.drafts);
        calls++;
        m.calls++;
        const r = await checkDrafts(batch, write);
        const gone = new Set(batch.map((d) => d.id));
        const again = r.again.map((d) => ({ ...d, tries: (d.tries ?? 0) + 1 }));
        for (const d of again.filter((x) => x.tries >= MAX_TRIES)) (m.rejected.malformed++, gone.add(d.id));
        m.drafts = [...m.drafts.filter((d) => !gone.has(d.id)), ...again.filter((x) => x.tries < MAX_TRIES)];
        for (const x of r.rejected) m.rejected[x.why]++;
        await addKept(s, m, r.kept.slice(0, Math.max(0, m.target - m.kept)));
        m.note = '';
      } else if (m.kept < m.target) {
        calls++;
        m.calls++;
        const reply = await write(WRITER_SYSTEM, writerPrompt(m, Math.min(WRITE_BATCH, m.target - m.kept + 2)));
        const arr = jsonArray(reply);
        if (!arr) {
          m.unreadable++;
          m.note = 'the last batch could not be read; writing it again';
          continue;
        }
        const seen = new Set(m.seen.map((x) => x.split('|')[1]));
        for (const raw of arr.slice(0, WRITE_BATCH * 2)) {
          const d = cleanDraft(raw, shape.min, shape.max);
          if ('reject' in d) {
            m.rejected[d.reject]++;
            continue;
          }
          const key = stem(d.q);
          if (seen.has(key)) {
            m.rejected.repeat++;
            continue;
          }
          seen.add(key);
          m.seen.push(`${shape.topics.includes(d.topic) ? d.topic : shape.topics.find((t) => normaliseText(t) === normaliseText(d.topic)) ?? d.topic}|${key}`);
          m.drafts.push({ ...d, id: `b${m.next++}` });
        }
        m.note = '';
      }
      if (m.kept >= m.target) {
        m.done = true;
        m.drafts = [];
      }
    } catch {
      // No model free (or it failed): what is saved stays; the next slice carries on. (A call that failed is not counted.)
      calls--;
      m.calls--;
      m.note = 'waiting for a free model';
      break;
    }
  }
  m.updatedAt = now;
  await s.storage.put(bankKey(stage, subject), m);
  return { meta: m, calls };
}

// ---- a paper from a bank ------------------------------------------------------------------------------------------

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
/** The most questions one paper may have (a sitting stays a sitting). */
export const MAX_PAPER_ITEMS = 45;

/**
 * A paper drawn from a finished bank by seed, with the stage's real structure: questions taken in turn from each
 * topic (shuffled by the seed) while they fit the paper's marks, then the gap filled with the smallest that fit,
 * so the paper reaches the shape's marks when the bank allows. Ordered from fewest marks to most, as real papers
 * build up; graded with `bandsFor`. Deterministic: the same seed and bank give the same paper.
 */
export function bankPaper(stage: StageId, subject: string, items: SchoolItem[], seed: number, id: string): SchoolPaper {
  const shape = shapeOf(stage, subject);
  if (!shape) throw new Error(`${stage} ${subject} has no bank.`);
  const r = rng(seed ^ hash(`${stage}|${subject}`));
  const shuffle = <X>(a: X[]): X[] => {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  const byTopic = new Map<string, SchoolItem[]>();
  for (const it of shuffle(items)) byTopic.set(it.topic, [...(byTopic.get(it.topic) ?? []), it]);
  const topics = shuffle([...byTopic.keys()]);
  const chosen: SchoolItem[] = [];
  let total = 0;
  for (let round = 0, added = true; added && total < shape.marks && chosen.length < MAX_PAPER_ITEMS; round++) {
    added = false;
    for (const t of topics) {
      const it = byTopic.get(t)![round];
      if (!it || total + it.marks > shape.marks || chosen.length >= MAX_PAPER_ITEMS) continue;
      chosen.push(it);
      total += it.marks;
      added = true;
    }
  }
  // Close the gap with the smallest questions that still fit.
  const used = new Set(chosen);
  for (const it of [...items].filter((x) => !used.has(x)).sort((a, b) => a.marks - b.marks)) {
    if (total >= shape.marks || chosen.length >= MAX_PAPER_ITEMS) break;
    if (total + it.marks <= shape.marks) (chosen.push(it), (total += it.marks));
  }
  // Still short: swap one question for a bigger one that closes the gap exactly.
  const gap = shape.marks - total;
  if (gap > 0) {
    const pool = items.filter((x) => !chosen.includes(x));
    for (const [i, c] of chosen.entries()) {
      const u = pool.find((x) => x.marks === c.marks + gap && x.topic === c.topic) ?? pool.find((x) => x.marks === c.marks + gap);
      if (u) {
        chosen[i] = u;
        total += gap;
        break;
      }
    }
  }
  const ordered = chosen.map((it, i) => ({ it, i })).sort((a, b) => a.it.marks - b.it.marks || a.i - b.i).map((x) => x.it);
  const paperItems: SchoolItem[] = ordered.map((it, i) => ({ ...it, id: `q${i + 1}` }));
  const label = subjectWords(subject);
  return {
    id,
    stage,
    subject,
    title: `${STAGE_WORDS[stage]} ${label} · written by Ghosty from his checked question bank`,
    official: false,
    source: `Written by Ghosty: questions written by a stronger model in ${STAGE_WORDS[stage]} exam style and checked twice (exact answers re-worked by a second call, mark schemes judged sound)`,
    items: paperItems,
    maxMarks: total,
    bands: bandsFor(stage, total),
    seed,
    from: 'bank',
  };
}
