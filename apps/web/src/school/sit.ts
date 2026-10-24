/**
 * Sitting a SCHOOL paper on the phone: the offline brain (the small model on this phone) answers one question at a
 * time, exactly as the REPORT CARD asks its questions (offline/harder.ts, offline/bench.ts): one job on the model at
 * a time (offline/lock.ts `withModel`), the model loaded first, a short exam prompt, a token budget per question.
 * The brain sets the paper (POST /api/school/sit: questions only, never the answers) and marks it
 * (POST /api/school/answers): his answers go to it every 5 questions, so a STOP or a closed app loses little, and
 * all of them when he is done. STOP hands in what is answered. Never a cloud model: this is his own exam.
 */
import type { PaperResult, StageId } from '../../../../packages/shared/src/school';
import { headers } from '../api/brain';
import { createStore } from '../core/store';
import { loadOffline, offlineReady, offlineReply, withModel, type OfflineMsg } from '../offline/brain';
import { modelKey } from '../offline/harder';

export type { PaperResult, StageId };

/** What GET /api/school answers (apps/edge/src/school/routes.ts). */
export interface PassedStage {
  at: number;
  grades: Record<string, string>;
  placement?: StageId;
}
export interface StageRow {
  id: StageId;
  label: string;
  years: string;
  subjects: string[];
  status: 'passed' | 'now' | 'locked';
  passedAt?: number;
  placement?: StageId;
  papers: boolean;
  pass: string;
}
/** Where a subject's next paper comes from (part 2): an official paper, the generators, a checked bank, or none yet. */
export type Source = 'official' | 'written' | 'bank' | null;
export interface SourceInfo {
  source: Source;
  line: string;
  official?: { id: string; year: number; board: string };
  bank?: { kept: number; target: number; done: boolean; line: string };
}
export interface StageView {
  state: { stage: StageId; passed: Partial<Record<StageId, PassedStage>>; results: PaperResult[]; nightly: boolean; open: { id: string; stage: StageId; subject: string; at: number }[] };
  stages: StageRow[];
  current: { stage: StageId; label: string; papers: boolean; bank: boolean; pass: string; subjects: { id: string; label: string; latest: PaperResult | null; top: boolean; source: Source; from: string }[] };
  /** Every stage's subjects: where their papers come from. */
  sources: Record<string, Record<string, SourceInfo>>;
  work: { busy: boolean; banks: string[]; official: string[] };
  bankStages: StageId[];
  weak: { topic: string; stage: StageId; subject: string; lost: number; of: number }[];
  pending: { paperId: string; title: string; items: number }[];
  next: string | null;
  papersFor: StageId[];
}

/** A question as the brain hands it out: no answer, no mark scheme. */
export interface SitItem {
  id: string;
  q: string;
  type: 'exact' | 'number' | 'mcq' | 'short' | 'extended';
  marks: number;
  options?: string[];
  passage?: string;
  unit?: string;
}
export interface SitPaper {
  id: string;
  stage: string;
  subject: string;
  title: string;
  official: boolean;
  maxMarks: number;
  items: SitItem[];
  passages: { id: string; title: string; text: string; source: string }[];
}

// ---------------------------------------------------------------------------------------
// The brain's SCHOOL routes
// ---------------------------------------------------------------------------------------

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw Object.assign(new Error(j?.error ?? (r.status === 401 ? 'Not signed in.' : `Ghosty could not be reached (${r.status}).`)), { status: r.status });
  return j as T;
}

export const school = {
  view: () => call<StageView>('GET', '/school'),
  sit: (stage: string, subject: string) => call<{ paper: SitPaper; done: string[]; resumed: boolean; from?: Source }>('POST', '/school/sit', { stage, subject }),
  answers: (paperId: string, answers: { id: string; given: string }[], final: boolean) => call<{ result?: PaperResult; changed?: { passed: string[]; stage: string | null }; stage?: string; next?: string | null; saved?: number }>('POST', '/school/answers', { paperId, answers, final, model: modelKey() }),
  paper: (id: string) => call<{ paper: { items: (SitItem & { answer?: string; rubric?: string; also?: string[] })[]; passages?: SitPaper['passages']; title: string; official: boolean; source?: string; licence?: string; boundaries?: string; leftOut?: { what: string; marks: number; why: string }[]; from?: 'bank' | 'official' }; from?: 'written' | 'official' | 'bank'; result: PaperResult; given: Record<string, string> }>('GET', `/school/paper/${encodeURIComponent(id)}`),
  settings: (nightly: boolean) => call<StageView>('POST', '/school/settings', { nightly }),
};

// ---------------------------------------------------------------------------------------
// One question to the model
// ---------------------------------------------------------------------------------------

export const EXAM_SYSTEM = "You are sitting an exam. Answer the question. Finish with 'Answer: <your answer>'";
/** Tokens a question may take: about 200, a piece of writing about 350. */
export const TOKENS = { item: 200, writing: 350 } as const;
const LETTERS = 'ABCD';

/** The messages for one question: the passage first when it has one, the choices A–D for multiple choice. */
export function examPrompt(item: SitItem, passages: SitPaper['passages']): OfflineMsg[] {
  const p = item.passage ? passages.find((x) => x.id === item.passage) : undefined;
  const parts: string[] = [];
  if (p) parts.push(`Read this: "${p.title}"\n\n${p.text}`);
  parts.push(item.q);
  if (item.type === 'mcq' && item.options) parts.push(`${item.options.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n')}\nAnswer with the letter.`);
  if (item.type === 'short') parts.push(`(${item.marks} mark${item.marks === 1 ? '' : 's'}: explain briefly.)`);
  if (item.type === 'extended') parts.push(`(${item.marks} marks: write it out in full.)`);
  const system = item.type === 'extended' ? `${EXAM_SYSTEM}. For a piece of writing, write the whole piece, then finish with 'Answer: done'.` : EXAM_SYSTEM;
  return [
    { role: 'system', content: system },
    { role: 'user', content: parts.join('\n\n') },
  ];
}

export type Gen = (messages: OfflineMsg[], o: { max: number; temperature: number; signal: AbortSignal }) => Promise<string>;

/**
 * Sit the questions of a paper that are not done yet, one at a time, saving every 5 (`save`). Returns the answers
 * not saved yet, and whether it stopped early. Pure apart from what it is given (the model and the brain).
 */
export async function runPaper(paper: SitPaper, d: { gen: Gen; save: (answers: { id: string; given: string }[]) => Promise<unknown>; done: Set<string>; signal: AbortSignal; onProgress: (n: number, of: number) => void }): Promise<{ rest: { id: string; given: string }[]; stopped: boolean }> {
  let rest: { id: string; given: string }[] = [];
  for (const [i, it] of paper.items.entries()) {
    if (d.done.has(it.id)) continue;
    if (d.signal.aborted) break;
    d.onProgress(i + 1, paper.items.length);
    let given = '';
    try {
      given = await d.gen(examPrompt(it, paper.passages), { max: it.type === 'extended' ? TOKENS.writing : TOKENS.item, temperature: 0.3, signal: d.signal });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || d.signal.aborted) break;
      given = '';
    }
    if (d.signal.aborted) break;
    rest.push({ id: it.id, given });
    d.done.add(it.id);
    if (rest.length >= 5) {
      // Kept by the brain now: a stop, or the app closing, loses at most the last few.
      const batch = rest;
      rest = [];
      await d.save(batch).catch(() => (rest = [...batch, ...rest]));
    }
  }
  return { rest, stopped: d.signal.aborted };
}

// ---------------------------------------------------------------------------------------
// Sitting, on the phone's model
// ---------------------------------------------------------------------------------------

/** What is being sat now, for the SCHOOL tab (and a spec at window.__ghosty.school). */
export const sitting = createStore({
  busy: false,
  stage: '',
  subject: '',
  title: '',
  n: 0,
  of: 0,
  /** Subjects still to sit in this go (SIT THE EXAM sits every subject in turn). */
  left: [] as string[],
  line: '',
  last: null as PaperResult | null,
  results: [] as PaperResult[],
  stopped: false,
});

let ctl: AbortController | null = null;
/** STOP: the question being answered is dropped, the answers so far are handed in. */
export function stopSitting(): void {
  ctl?.abort();
}

export const notDownloaded = "The offline brain isn't on this phone yet, so he can't sit an exam: download it in Settings → Offline brain (on Wi-Fi).";

const gen: Gen = async (messages, o) => (await offlineReply(messages, () => undefined, o.signal, { temperature: o.temperature, max: o.max })).text;

/**
 * Sit the papers of these subjects at this stage, one after another, on the offline brain. Refuses at once when
 * the model is busy (THINK HARDER, the report card) or not downloaded. Each finished paper's result lands in
 * `sitting.results`; STOP ends the go after handing in the paper being sat.
 */
export async function sitSubjects(stage: string, subjects: string[]): Promise<PaperResult[]> {
  if (!(await offlineReady().catch(() => false))) throw new Error(notDownloaded);
  const mine = new AbortController();
  // The report card's turn on the model: an exam is the same kind of job (one question after another, timed).
  return withModel(
    'bench',
    async () => {
      ctl = mine;
      sitting.set({ busy: true, stage, subject: subjects[0] ?? '', title: '', n: 0, of: 0, left: subjects.slice(1), line: 'getting ready (loading the model)…', results: [], stopped: false });
      const out: PaperResult[] = [];
      try {
        await loadOffline();
        for (const [k, subject] of subjects.entries()) {
          if (mine.signal.aborted) break;
          sitting.set({ subject, left: subjects.slice(k + 1), line: 'getting the paper…', n: 0, of: 0 });
          const { paper, done } = await school.sit(stage, subject);
          sitting.set({ title: paper.title, of: paper.items.length, n: done.length, line: done.length ? `carrying on from question ${done.length + 1}` : '' });
          const { rest } = await runPaper(paper, {
            gen,
            save: (a) => school.answers(paper.id, a, false),
            done: new Set(done),
            signal: mine.signal,
            onProgress: (n, of) => sitting.set({ n, of, line: `Question ${n} of ${of}` }),
          });
          sitting.set({ line: 'handing it in for marking…' });
          const r = await school.answers(paper.id, rest, true);
          if (r.result) {
            out.push(r.result);
            sitting.set((s) => ({ last: r.result!, results: [...s.results, r.result!] }));
          }
        }
      } finally {
        if (ctl === mine) ctl = null;
        sitting.set({ busy: false, line: '', left: [], stopped: mine.signal.aborted });
      }
      return out;
    },
    { wait: false },
  );
}
