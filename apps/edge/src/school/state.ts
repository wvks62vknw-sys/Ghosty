/**
 * SCHOOL's record: which stage the offline brain is at, the stages he has passed (with the grades and the day),
 * his recent results and whether the owner wants the nightly school report. Kept in the Durable Object's storage
 * under `school:state` and mirrored to KV with `durablePut` (kv.ts), so it survives the database pause like a
 * project does. The papers he sat are kept one each under `school:paper:<id>` with his answers; never in the
 * library, so self-study and the weekly training never see them.
 *
 * The rules (the owner's, docs/build-plan/HANDOFF.md "Raising Ghosty"): only nursery is open at the start; a stage
 * is passed when the latest result in every one of its subjects is top grades; then the next stage opens. Any
 * stage may be sat at any time (a placement test): top grades in every subject of a higher stage pass it and every
 * stage below it at once. A paper whose written answers still wait for a marker has no final grade, so it never
 * passes anything until its marks are in.
 */
import { nextStage, stageById, stageIndex, stagePassed, STAGE_IDS, SUBJECT_LABEL, type PaperResult, type StageId } from '../../../../packages/shared/src/school';
import type { Env } from '../env';
import { durableGet, durablePut } from '../kv';
import { hasPapers, stageName, type SchoolPaper } from './papers';

export const STATE_KEY = 'school:state';
export const PAPER_PREFIX = 'school:paper:';
/** Results kept in the record (newest first). */
export const MAX_RESULTS = 60;
/** News lines kept for the next report. */
const MAX_NEWS = 20;

export interface PassedStage {
  at: number;
  grades: Record<string, string>;
  /** Passed by a placement test of this (higher) stage, not by its own papers. */
  placement?: StageId;
}

/** A paper handed out and not finished yet (its answers are saved as he goes, so a stop loses little). */
export interface OpenPaper {
  id: string;
  stage: StageId;
  subject: string;
  at: number;
}

export interface SchoolState {
  stage: StageId;
  passed: Partial<Record<StageId, PassedStage>>;
  /** Newest first, at most `MAX_RESULTS`; kept without the answers (those are in the paper's own record). */
  results: PaperResult[];
  nightly: boolean;
  open: OpenPaper[];
  /** What happened since the last school report (plain words), and the day that report went. */
  news: string[];
  reportedDay?: string;
}

/** A paper as kept: the paper itself (written by Ghosty, or an official one in part 2), his answers and the result. */
export interface PaperRecord {
  paper: SchoolPaper;
  from: 'written' | 'official';
  issuedAt: number;
  /** His replies by item id (as the phone sent them). */
  given: Record<string, string>;
  /** The model that sat it ('stock', or a trained week's key). */
  model?: string;
  result?: PaperResult;
}

/** Where SCHOOL keeps things: the database and KV (KV may be absent, as in tests). */
export interface Store {
  storage: DurableObjectStorage;
  env?: Pick<Env, 'SITES'>;
}

export const freshState = (): SchoolState => ({ stage: 'nursery', passed: {}, results: [], nightly: true, open: [], news: [] });

export async function loadState(s: Store): Promise<SchoolState> {
  const v = await durableGet<Partial<SchoolState>>(s.env, s.storage, STATE_KEY);
  const base = freshState();
  if (!v || typeof v !== 'object') return base;
  return {
    stage: STAGE_IDS.includes(v.stage as StageId) ? (v.stage as StageId) : base.stage,
    passed: v.passed && typeof v.passed === 'object' ? v.passed : {},
    results: Array.isArray(v.results) ? v.results.slice(0, MAX_RESULTS) : [],
    nightly: typeof v.nightly === 'boolean' ? v.nightly : base.nightly,
    open: Array.isArray(v.open) ? v.open : [],
    news: Array.isArray(v.news) ? v.news.slice(-MAX_NEWS) : [],
    ...(typeof v.reportedDay === 'string' ? { reportedDay: v.reportedDay } : {}),
  };
}
export const saveState = (s: Store, st: SchoolState): Promise<void> => durablePut(s.env, s.storage, STATE_KEY, { ...st, results: st.results.slice(0, MAX_RESULTS).map(lightResult), news: st.news.slice(-MAX_NEWS) });
export const loadPaper = (s: Store, id: string): Promise<PaperRecord | undefined> => durableGet<PaperRecord>(s.env, s.storage, PAPER_PREFIX + id);
export const savePaper = (s: Store, r: PaperRecord): Promise<void> => durablePut(s.env, s.storage, PAPER_PREFIX + r.paper.id, r);

/** A result without its answers, for the record (a database record holds at most 128 KB; the paper has them). */
export const lightResult = (r: PaperResult): PaperResult => ({ ...r, answers: [] });

/** The newest result in each subject of a stage. */
export function latestFor(results: PaperResult[], stage: StageId): Record<string, PaperResult | undefined> {
  const out: Record<string, PaperResult | undefined> = {};
  for (const r of results) if (r.stage === stage && !out[r.subject]) out[r.subject] = r;
  return out;
}

/** Each stage as the ladder shows it. */
export interface StageRow {
  id: StageId;
  label: string;
  years: string;
  subjects: string[];
  status: 'passed' | 'now' | 'locked';
  passedAt?: number;
  placement?: StageId;
  /** Ghosty can set papers for it yet (part 1: nursery to Key Stage 2). */
  papers: boolean;
  pass: string;
}
export function ladder(st: SchoolState): StageRow[] {
  return STAGE_IDS.map((id) => {
    const s = stageById(id)!;
    const p = st.passed[id];
    // The library is "always open once university is passed": it never shows a tick of its own.
    const status: StageRow['status'] = p ? 'passed' : id === st.stage ? 'now' : stageIndex(id) < stageIndex(st.stage) ? 'passed' : 'locked';
    return { id, label: s.label, years: s.years, subjects: s.subjects, status, ...(p ? { passedAt: p.at } : {}), ...(p?.placement ? { placement: p.placement } : {}), papers: hasPapers(id), pass: s.pass };
  });
}

const subjectWords = (subject: string) => (SUBJECT_LABEL[subject] ?? subject).toLowerCase();
/** "Reception maths (Top band, 17/18)". */
export const resultWords = (r: Pick<PaperResult, 'stage' | 'subject' | 'grade' | 'raw' | 'max'>): string => `${stageName(r.stage)} ${subjectWords(r.subject)} (${r.grade}, ${r.raw}/${r.max})`;

/**
 * A result goes into the record (replacing an earlier version of the same paper, e.g. once its pending marks are
 * in) and the stage it was for is checked: with top grades in every subject it is passed — with every stage below
 * it, for a placement — and the current stage moves to the one after it. Pure: returns what changed.
 */
export function applyResult(st: SchoolState, r: PaperResult, now: number): { passed: StageId[]; stage: StageId | null } {
  st.results = [lightResult(r), ...st.results.filter((x) => x.paperId !== r.paperId)].sort((a, b) => b.at - a.at).slice(0, MAX_RESULTS);
  st.open = st.open.filter((o) => o.id !== r.paperId);
  const stage = stageById(r.stage);
  if (!stage || st.passed[r.stage]) return { passed: [], stage: null };
  const latest = latestFor(st.results, r.stage);
  if (!stagePassed(stage, latest).passed) return { passed: [], stage: null };
  const grades = Object.fromEntries(stage.subjects.map((s) => [s, latest[s]!.grade]));
  const passed: StageId[] = [];
  // A stage above the current one passed with top grades: a placement — it, and everything below it, is done.
  for (const id of STAGE_IDS.slice(0, stageIndex(r.stage) + 1)) {
    if (st.passed[id]) continue;
    st.passed[id] = id === r.stage ? { at: now, grades } : { at: now, grades: {}, placement: r.stage };
    passed.push(id);
  }
  let moved: StageId | null = null;
  if (stageIndex(r.stage) >= stageIndex(st.stage)) {
    moved = nextStage(r.stage) ?? r.stage;
    st.stage = moved;
  }
  return { passed, stage: moved };
}

/** Add a line to what the next school report says. */
export function addNews(st: SchoolState, line: string): void {
  st.news = [...st.news, line].slice(-MAX_NEWS);
}

/** The news for a finished or newly marked paper, and for any stage it passed. */
export function newsFor(st: SchoolState, r: PaperResult, changed: { passed: StageId[]; stage: StageId | null }, late = false): void {
  if (r.marked.pending) addNews(st, `sat ${stageName(r.stage)} ${subjectWords(r.subject)} (marks still coming for the written answers)`);
  else addNews(st, `${late ? 'marks came in: ' : ''}${r.top ? 'passed' : 'sat'} ${resultWords(r)}`);
  if (changed.passed.includes(r.stage)) {
    const below = changed.passed.filter((s) => s !== r.stage);
    addNews(st, `${stageName(r.stage)} is done${below.length ? ` (a placement test: ${below.map(stageName).join(', ')} too)` : ''}`);
  }
}

/** What to sit next at the current stage: the first subject without top grades ("Reading"), or null. */
export function nextUp(st: SchoolState): string | null {
  const s = stageById(st.stage);
  if (!s) return null;
  const latest = latestFor(st.results, st.stage);
  const sub = s.subjects.find((x) => !latest[x]?.top);
  return sub ? (SUBJECT_LABEL[sub] ?? sub) : null;
}

/** The school report in one line: "School: passed Reception maths (Top band, 17/18). Reading next." */
export function reportLine(st: SchoolState): string {
  const news = st.news.slice(0, 6);
  const more = st.news.length - news.length;
  const next = nextUp(st);
  const tail = next ? ` ${next} next.` : hasPapers(st.stage) ? '' : ` On to ${stageName(st.stage)}: its papers are not written yet.`;
  const body = `School: ${news.join('; ')}${more > 0 ? `; and ${more} more` : ''}.${tail}`;
  return body.length > 300 ? `${body.slice(0, 297)}…` : body;
}
