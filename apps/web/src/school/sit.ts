/**
 * Sitting a SCHOOL paper on the phone: the offline brain (the small model on this phone) answers one question at a
 * time, exactly as the REPORT CARD asks its questions (offline/harder.ts, offline/bench.ts): one job on the model at
 * a time (offline/lock.ts `withModel`), the model loaded first, a short exam prompt, a token budget per question.
 * The brain sets the paper (POST /api/school/sit: questions only, never the answers) and marks it
 * (POST /api/school/answers): his answers go to it after every question, so a STOP or a closed app loses nothing
 * answered, and the paper is handed in when he is done. STOP hands in what is answered. Never a cloud model: this is
 * his own exam.
 * A paper is long work for a phone (OWNER-ISSUES 57c: sitting one closed Ghosty on the owner's iPhone): it is sat in
 * heavy mode (core/heavy.ts: the GYM pauses, Mind draws still frames), on the smallest brain on this phone unless he
 * chose the bigger one for school (sitBrain; a bigger brain writes shorter: writingCap), and under a crash record: a
 * sitting that closed Ghosty, or whose brain failed mid-paper, is offered again at the question it reached (CARRY ON),
 * on the smallest brain, never retried by itself.
 * The chain (1 Nov: "press SIT and it works"): the 0.6B, the Qwen2.5 0.5B, the floor (SmolLM2 360M); a paper goes to
 * the largest of them here that has not closed Ghosty, and after a close with none here, SIT and CARRY ON are ONE
 * button that GETs the next one down (his tap, on Wi-Fi, its size on the button) and sits; when the floor closed too,
 * the words say no brain runs here yet. Never a cloud model.
 */
import type { PaperResult, StageId } from '../../../../packages/shared/src/school';
import { headers } from '../api/brain';
import { heavy } from '../core/heavy';
import { createStore } from '../core/store';
import { brainsHere, currentModel, getBrain, loadOffline, mayUse, offlineBrain, offlineModels, offlineReady, offlineReply, onMobileData, sitOn, unloadOffline, withModel, type OfflineMsg } from '../offline/brain';
import { modelKey } from '../offline/harder';
import { CHAIN, chainPick, isBigger, MODELS, NO_BRAIN, rungOf, sitBudget, sitMessages, sitOffer, sitOfferWhy, type ModelDef } from '../offline/models';

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

/** No connection to the brain: his words, never the browser's "Failed to fetch". */
export const NO_LINK = "I can't reach my brain right now (no connection?): try again in a moment.";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' }).catch(() => {
    throw new Error(NO_LINK);
  });
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

/** Tokens a piece of writing may take on this brain: a bigger brain writes no longer than an ordinary answer (57c). */
export const writingCap = (m: Pick<ModelDef, 'brain' | 'alone' | 'id'>): number => (isBigger(m) ? TOKENS.item : TOKENS.writing);

/**
 * The brain a paper is sat on: the one in use when it is one of the small ones, or when he chose it for school
 * (`chosen`); otherwise the smallest brain on this phone (`here`), so a long paper is not what closes Ghosty.
 */
export function sitBrain(cur: ModelDef, here: ModelDef[], chosen: string | null): ModelDef {
  if (!isBigger(cur) || chosen === cur.id) return cur;
  const least = [...here].sort((a, b) => a.vram - b.vram)[0];
  return least && least.vram < cur.vram ? least : cur;
}

/** Where the chain leaves a paper: the brain it is sat on (null: none here may sit), the next one down to GET in one tap, the one that closed Ghosty above it, and whether none is left. */
interface Seat {
  brain: ModelDef | null;
  get: ModelDef | null;
  after: ModelDef | null;
  none: boolean;
}
/**
 * The brain a paper or CARRY ON goes to (1 Nov, the chain: the 0.6B, the Qwen2.5 0.5B, the floor; models.ts chainPick).
 * The brain in use when it is a small one, on this phone (`curHere`) and has not closed Ghosty here: a week trained from
 * the 0.6B, or the stand-in he chose, stays his. Otherwise the largest brain of the chain that is here and has not closed
 * Ghosty (31 Oct: never one that did, the 0.6B on its first answer). None here, after a close: nothing is sat on, and the
 * next brain down is offered in one tap (`get`), or the truth is said when the floor closed too (`none`). Nothing closed:
 * `sitBrain`, as before (a new phone; a bigger brain alone on it).
 */
function pickBrain(cur: ModelDef, here: ModelDef[], curHere: boolean): Seat {
  const chain = chainPick(curHere ? [...here, cur] : here, mayUse);
  const keep = { get: null, after: chain.after, none: false };
  if (rungOf(cur) >= 0 && curHere && mayUse(cur)) return { brain: cur, ...keep };
  if (chain.sit) return { brain: chain.sit, ...keep };
  if (chain.get || chain.none) return { brain: null, get: chain.get, after: chain.after, none: chain.none };
  const usable = here.filter(mayUse);
  return { brain: sitBrain(cur, usable.length ? usable : here, null), ...keep };
}

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
 * Sit the questions of a paper that are not done yet, one at a time, saving after every answer (`save`). Returns the
 * answers not saved yet (no connection), and whether it stopped early. When the model itself fails (sitGen marks it
 * `gone`), what is answered is saved and the failure is thrown with the question reached (`n`): never a blank answer
 * for every question left. `writing`: the tokens a piece of writing may take (writingCap); `budget`: a small brain's
 * prompt budget (models.ts sitBudget: the short prompt, sitMessages), else the shared exam prompt. Pure apart from what it is
 * given (the model and the brain).
 */
export async function runPaper(paper: SitPaper, d: { gen: Gen; save: (answers: { id: string; given: string }[]) => Promise<unknown>; done: Set<string>; signal: AbortSignal; onProgress: (n: number, of: number) => void; writing?: number; budget?: number }): Promise<{ rest: { id: string; given: string }[]; stopped: boolean }> {
  let rest: { id: string; given: string }[] = [];
  for (const [i, it] of paper.items.entries()) {
    if (d.done.has(it.id)) continue;
    if (d.signal.aborted) break;
    d.onProgress(i + 1, paper.items.length);
    let given = '';
    try {
      // (a small brain gets the question and the instruction only, within its budget: models.ts sitMessages; the marking is the same)
      const asked = d.budget ? sitMessages(it, it.passage ? paper.passages.find((x) => x.id === it.passage) : undefined, d.budget) : examPrompt(it, paper.passages);
      given = await d.gen(asked, { max: it.type === 'extended' ? (d.writing ?? TOKENS.writing) : TOKENS.item, temperature: 0.3, signal: d.signal });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || d.signal.aborted) break;
      if ((e as { gone?: boolean })?.gone) {
        if (rest.length) await d.save(rest).catch(() => undefined);
        throw Object.assign(e as Error, { n: i + 1, of: paper.items.length });
      }
      given = '';
    }
    if (d.signal.aborted) break;
    rest.push({ id: it.id, given });
    d.done.add(it.id);
    // Kept by the brain at once: a stop, a failed brain or the app closing loses nothing answered.
    const batch = rest;
    rest = [];
    await d.save(batch).catch(() => (rest = [...batch, ...rest]));
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
  /** Which brain is sitting it, in one plain line (brainLine). */
  brain: '',
  /** A sitting that closed Ghosty, or whose brain failed mid-paper: CARRY ON offers it again where it stopped. */
  resume: null as Resume | null,
});

/** Where a sitting has got to, kept on this phone as it goes: what CARRY ON picks up. */
interface SitMark {
  stage: string;
  /** The subject being sat, then the ones still to sit in this go. */
  subjects: string[];
  title: string;
  /** The question being answered (every one before it is with the brain). */
  n: number;
  of: number;
  /** The brain sitting it. */
  brain: string;
  at: number;
}
export interface Resume extends SitMark {
  why: 'closed' | 'gone';
  line: string;
  /** CARRY ON waits: the only brain here closed Ghosty while answering, and the line says what to do. */
  blocked?: boolean;
  /** The next brain down, when none here may carry on (1 Nov): CARRY ON is the one tap that GETs it and sits. */
  get?: string;
}

/**
 * The crash record (the closed-Ghosty mark of offline/brain.ts's bigger-brain load): written synchronously at the
 * start and at every question, gone when the sitting ends in any way. Still there when Ghosty opens: it closed mid-paper.
 */
const SIT_KEY = 'ghosty.school.sitting';
function writeMark(m: SitMark | null): void {
  try {
    if (m) localStorage.setItem(SIT_KEY, JSON.stringify(m));
    else localStorage.removeItem(SIT_KEY);
  } catch {
    /* blocked storage: the sitting still runs */
  }
}
function readMark(): SitMark | null {
  try {
    const v = JSON.parse(localStorage.getItem(SIT_KEY) ?? 'null') as SitMark | null;
    return v && typeof v.stage === 'string' && Array.isArray(v.subjects) && v.subjects.length ? { ...v, n: Number(v.n) || 0, of: Number(v.of) || 0, title: String(v.title ?? '') } : null;
  } catch {
    return null;
  }
}

/** The bigger brain he chose to sit papers on ('' = the smallest on this phone), kept on this phone. */
export const sitPrefs = createStore({ brain: '' }, { persist: 'ghosty.school.brain', keys: ['brain'] });

/**
 * The next paper's plan: the brain it is sat on (`small`: the chain's, whatever he chose; null: none here may sit), the
 * brain in use, whether he chose that one for school, the smaller one he could have instead of a bigger one in use,
 * whether the brain in use closed Ghosty here, whether the brain is on this phone (`here`), and, when none here may sit
 * after a close, the next brain down to GET in one tap (`get`, below `after`) or the truth (`none`).
 */
export interface SitPlan {
  brain: ModelDef | null;
  cur: ModelDef;
  chosen: boolean;
  least: ModelDef | null;
  closed: boolean;
  here: boolean;
  curHere: boolean;
  get: ModelDef | null;
  after: ModelDef | null;
  none: boolean;
  /** The brain is the smallest on this phone (brainLine says so only then). */
  smallest: boolean;
}
export async function sitPlan(small = false): Promise<SitPlan> {
  const cur = currentModel();
  const ids = new Set(await brainsHere().catch(() => [] as string[]));
  const list = offlineModels().filter((m) => ids.has(m.id));
  const curHere = list.some((m) => m.id === cur.id) || (await offlineReady().catch(() => false));
  const all = curHere && !list.some((m) => m.id === cur.id) ? [...list, cur] : list;
  // the brain in use closed Ghosty on this phone: it is not sat on by itself (USE in SETTINGS is his yes)
  const closed = !mayUse(cur);
  const chosen = !small && !closed && isBigger(cur) && sitPrefs.get().brain === cur.id;
  const pick = pickBrain(cur, list, curHere);
  const brain = chosen ? cur : pick.brain;
  return {
    brain,
    cur,
    chosen,
    least: pick.brain && pick.brain.id !== cur.id && isBigger(cur) && !closed ? pick.brain : null,
    closed,
    here: !!brain && (brain.id === cur.id ? curHere : all.some((m) => m.id === brain.id)),
    curHere,
    get: chosen ? null : pick.get,
    after: pick.after,
    none: !chosen && pick.none,
    smallest: !!brain && !all.some((m) => m.vram < brain.vram),
  };
}

/** Which brain sits it, in one plain line (`now`: while it is being sat). */
export function brainLine(p: { brain: ModelDef; cur: ModelDef; chosen: boolean; closed?: boolean; curHere?: boolean; smallest?: boolean }, now: boolean): string {
  const lead = `${now ? "I'm sitting it" : 'I sit papers'} on ${p.brain.label}`;
  if (p.brain.id !== p.cur.id) {
    if (p.closed) return `${lead}: ${p.cur.label} closed Ghosty on this phone.`;
    if (p.curHere === false) return `${lead}, the brain on this phone.`;
    return `${lead}, ${p.smallest === false ? 'a smaller brain' : 'the smallest brain'} on this phone: a paper is long work.`;
  }
  if (!isBigger(p.brain)) return `${lead}.`;
  return `${lead}${p.chosen ? ', as you chose' : ''}: my written answers are kept shorter on it.`;
}

/**
 * The offer to carry on, in one line: what stopped it, the question it reached, and the brain CARRY ON uses (the chain's).
 * None here may carry on after a close: the next brain down, one tap away (`get`), or the truth when the floor closed too.
 */
function offer(why: Resume['why'], m: SitMark): Resume {
  const have = new Set(offlineBrain.get().have ?? []);
  const cur = currentModel();
  const pick = pickBrain(cur, offlineModels().filter((x) => have.has(x.id)), have.has(cur.id) || offlineBrain.get().downloaded);
  const base: Resume = { stage: m.stage, subjects: m.subjects, title: m.title, n: m.n, of: m.of, brain: m.brain, at: m.at, why, line: '' };
  const what = m.title.split(' · ')[0] || 'a paper';
  const head = why === 'closed' ? `Ghosty closed while I sat ${what}` : `My brain on this phone gave out while I sat ${what}`;
  const at = m.n && m.of ? `, at question ${m.n} of ${m.of}` : '';
  const kept = m.n > 1 ? '. My answers before it are kept' : '';
  const next = pick.brain;
  // (1 Nov) no brain here may carry on: the next one down is one tap away, or no brain runs here yet and the words say so
  if (!next) return pick.get ? { ...base, blocked: true, get: pick.get.id, line: `${head}${at}${kept}. ${sitOfferWhy(pick.after, pick.get)}` } : { ...base, blocked: true, line: `${head}${at}${kept}. ${NO_BRAIN}` };
  // The brain that was answering closed Ghosty and nothing it may use is here (31 Oct, the 0.6B): no blind retry of the
  // same brain; the way on is said (GET a smaller one, or USE as his yes).
  if (!mayUse(next)) {
    const smaller = CHAIN.find((x) => mayUse(x) && !have.has(x.id)) ?? MODELS[1]!;
    return { ...base, blocked: true, line: `${head}${at}${kept}. ${next.label} closed Ghosty while answering, so CARRY ON waits for a brain this phone can hold: in Settings → Offline brain, GET the smaller ${smaller.label} or press USE to try ${next.label} again.` };
  }
  const was = offlineModels().find((x) => x.id === m.brain);
  const on = next.id === m.brain ? next.label : was && !mayUse(was) ? `${next.label}: ${was.label} closed Ghosty on this phone` : `${next.label}, the smallest brain on this phone`;
  return { ...base, line: `${head}${at}${why === 'gone' ? ' (most likely the phone ran short of memory)' : ''}${kept}. CARRY ON ${m.n ? 'picks up there' : 'starts it again'}, on ${on}.` };
}

/** The offer to carry on, said again from what this phone holds now (a brain got or used since): SCHOOL asks on every look. */
export function resumeNow(): void {
  const r = sitting.get().resume;
  if (r && !sitting.get().busy) sitting.set({ resume: offer(r.why, r) });
}

/**
 * The one tap after a close (1 Nov: "press SIT and it works"): GET the next brain down, the one SIT and CARRY ON offer
 * (his tap is the yes; the button said its size), then SCHOOL sits on it (sitSubjects). Only a brain of the chain that
 * has not closed Ghosty here, so never the one that did; only on Wi-Fi: on mobile data nothing is fetched, and the error
 * (`wait`) says so in its line while the button stays.
 */
export async function getForSit(id: string, onProgress?: (frac: number, text: string) => void): Promise<ModelDef> {
  const m = CHAIN.find((x) => x.id === id);
  if (!m || !mayUse(m)) throw new Error('That brain closed Ghosty on this phone: it is not got again by itself (SETTINGS → OFFLINE BRAIN → USE is your say).');
  const o = sitOffer(m, onMobileData());
  if (!o.go) throw Object.assign(new Error(o.line), { wait: true });
  return getBrain(m.id, onProgress);
}

/** What he is told at once when the brain gives out mid-paper (wherever he is); the offer itself waits on SCHOOL. */
export const GAVE_OUT = 'My brain on this phone gave out mid-paper (most likely short of memory). My answers are kept: CARRY ON in SCHOOL picks up where it stopped.';

let ctl: AbortController | null = null;
/** STOP: the question being answered is dropped, the answers so far are handed in. */
export function stopSitting(): void {
  ctl?.abort();
}

export const notDownloaded = "The offline brain isn't on this phone yet, so he can't sit an exam: download it in Settings → Offline brain (on Wi-Fi).";

/** The model itself failed (WebGPU lost its device, its memory ran out, its worker ended), not one question. */
const GONE = /device|lost|memory|OOM|allocat|not loaded|dispos|destroy|stopped|terminat/i;

/**
 * One question to the phone's model. When the model itself failed, it leaves memory (the next load is a fresh one,
 * never the broken one again) and the error is marked `gone`: runPaper stops there instead of a blank for every question.
 */
export const sitGen: Gen = async (messages, o) => {
  try {
    return (await offlineReply(messages, () => undefined, o.signal, { temperature: o.temperature, max: o.max })).text;
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if ((e as Error)?.name === 'AbortError' || o.signal.aborted || !GONE.test(msg)) throw e;
    unloadOffline();
    // (in his words for whoever shows it, e.g. the reading check's toast; the browser's own words stay in `cause`)
    throw Object.assign(new Error('My brain on this phone gave out (most likely short of memory). The answers so far are kept: sit it again to carry on from there.'), { gone: true, cause: msg });
  }
};

/**
 * Sit the papers of these subjects at this stage, one after another, on the offline brain. Refuses at once when
 * the model is busy (THINK HARDER, the report card) or not downloaded. Each finished paper's result lands in
 * `sitting.results`; STOP ends the go after handing in the paper being sat. `small`: on the smallest brain here
 * whatever he chose (CARRY ON after a close or a failed brain).
 */
export async function sitSubjects(stage: string, subjects: string[], o: { small?: boolean } = {}): Promise<PaperResult[]> {
  // The brain it is sat on, on this phone (1 Nov: the chain), or the words for why not: none left, the one tap, or GET it.
  const plan = await sitPlan(o.small);
  const brain = plan.brain;
  if (!brain || !plan.here) throw new Error(plan.none ? NO_BRAIN : plan.get ? sitOfferWhy(plan.after, plan.get) : notDownloaded);
  const mine = new AbortController();
  // The report card's turn on the model: an exam is the same kind of job (one question after another, timed).
  return withModel(
    'bench',
    async () => {
      ctl = mine;
      const mark: SitMark = { stage, subjects, title: '', n: 0, of: 0, brain: brain.id, at: Date.now() };
      sitting.set({ busy: true, stage, subject: subjects[0] ?? '', title: '', n: 0, of: 0, left: subjects.slice(1), line: 'getting ready (loading the model)…', results: [], stopped: false, brain: brainLine({ ...plan, brain }, true), resume: null });
      // Heavy mode first (the GYM pauses, Mind goes still), then the crash record, then the brain it sits on.
      heavy.set({ on: true, why: 'sitting a paper' });
      writeMark(mark);
      sitOn(brain.id === plan.cur.id ? null : brain.id);
      const out: PaperResult[] = [];
      try {
        await loadOffline().catch((e) => {
          const notHere = /isn't on this phone/.test(String((e as Error)?.message));
          // (a brain that closed Ghosty before is refused in its own words: they say what to do)
          const refused = !!(e as { refuse?: boolean })?.refuse;
          throw notHere || refused ? e : new Error(`I couldn't load ${brain.label} to sit the paper (the phone may be short of memory): close other apps, then press SIT again.`);
        });
        for (const [k, subject] of subjects.entries()) {
          if (mine.signal.aborted) break;
          sitting.set({ subject, left: subjects.slice(k + 1), line: 'getting the paper…', n: 0, of: 0 });
          const { paper, done } = await school.sit(stage, subject);
          sitting.set({ title: paper.title, of: paper.items.length, n: done.length, line: done.length ? `carrying on from question ${done.length + 1}` : '' });
          const at: SitMark = { ...mark, subjects: subjects.slice(k), title: paper.title, of: paper.items.length };
          writeMark({ ...at, n: Math.min(done.length + 1, paper.items.length) });
          const { rest } = await runPaper(paper, {
            gen: sitGen,
            save: (a) => school.answers(paper.id, a, false),
            done: new Set(done),
            signal: mine.signal,
            writing: writingCap(brain),
            budget: sitBudget(brain),
            onProgress: (n, of) => {
              writeMark({ ...at, n });
              sitting.set({ n, of, line: `Question ${n} of ${of}` });
            },
          });
          sitting.set({ line: 'handing it in for marking…' });
          const r = await school.answers(paper.id, rest, true);
          if (r.result) {
            out.push(r.result);
            sitting.set((s) => ({ last: r.result!, results: [...s.results, r.result!] }));
          }
        }
      } catch (e) {
        const lost = e as Error & { gone?: boolean; n?: number; of?: number };
        if (!lost.gone) throw e;
        // The brain on this phone failed mid-paper: what is answered is with the brain; CARRY ON offers the rest.
        const s = sitting.get();
        sitting.set({ resume: offer('gone', { ...mark, subjects: [s.subject, ...s.left], title: s.title, n: lost.n ?? s.n, of: lost.of ?? s.of }) });
        throw new Error(GAVE_OUT);
      } finally {
        writeMark(null);
        sitOn(null);
        heavy.set({ on: false, why: '' });
        if (ctl === mine) ctl = null;
        sitting.set({ busy: false, line: '', left: [], stopped: mine.signal.aborted });
      }
      return out;
    },
    { wait: false },
  );
}

/**
 * On opening: a sitting still recorded means Ghosty closed during it (iOS ends a page that holds too much). SCHOOL opens
 * on it (unless a link or a notification opened another screen) with the one line and CARRY ON; nothing restarts by itself.
 */
function recoverSit(): void {
  const m = readMark();
  if (!m) return;
  writeMark(null);
  sitting.set({ resume: offer('closed', m) });
  try {
    const hash = location.hash.slice(1);
    if (!hash || hash === 'core') history.replaceState(null, '', '#school');
  } catch {
    /* no address here */
  }
}
recoverSit();
