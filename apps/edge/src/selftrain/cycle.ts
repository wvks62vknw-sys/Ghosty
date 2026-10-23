/**
 * The offline brain's weekly self-training, run by the brain on its own once the owner has saved two keys
 * (Kaggle and a Hugging Face write token). One standing job (kind `train`) steps through a week:
 *
 *   idle ──(the week is due, or TRAIN NOW)──▶ collect ──▶ upload ──▶ push ──▶ running ──(the report)──▶ idle
 *
 *  - collect: the data factory (factory.ts) — puzzle references, tool calls, chat distillation and red team (no
 *    model; one piece per job step, so no step uses more than a few milliseconds of CPU), then a few model calls
 *    at a time in the background lane (Evol-Instruct, library Q&A, better replies for 👎) every few minutes until
 *    the week's share is gathered or a day has passed; beside them, with calls of their own (VOICE_CALLS), the
 *    voice: the style set and the rewrites of AI-sounding replies, each kept only when the detector and a blind
 *    judge both say it sounds like a person (voiceStep; its queue waiting for the judge is kept, so it resumes);
 *  - upload: the week's JSONL, the exam and the GYM's task program (only when it changed since the last upload)
 *    to the owner's PRIVATE Hugging Face dataset repo, in one commit (why Hugging Face and not a Kaggle dataset:
 *    one documented commit call from a Worker, every week's file kept with its history for the replay mix, and
 *    the notebook needs Hugging Face anyway);
 *    both repos are checked to be private first (made private, or refused with the fix) — nothing of the owner's
 *    ever goes into a public repo;
 *  - push: first Kaggle's GPU quota (no run without the free hours it needs, none at all with pay-to-scale on: it
 *    waits, saying why), then the notebook (training/kaggle/ghosty_weekly.py) to the owner's Kaggle account with
 *    GPU and internet on, its settings written in, including a one-time ticket: the notebook trades it ONCE for
 *    the Hugging Face token at the hook (in a header, never in an address) and posts its report back with it;
 *  - running: the hook brings the report; meanwhile Kaggle's status is read every half hour (a failed status read
 *    is counted on its own: a few in a row do not end the week). A run that stopped, or that reported an error
 *    before its exam, is pushed again (it resumes from its checkpoint) twice at most. A run Kaggle calls COMPLETE
 *    that sent no report within about 45 minutes ends the week, with the reason and the end of its log read
 *    from Kaggle's output.
 * The notebook uploads its candidate to the PRIVATE model repo (branch `candidates`); the brain checks the report
 * again with the same gate, that it is the expected repo, and only then promotes it (a tag, and the list the
 * phone's weight address serves: weights.ts). The last three good ones are kept; ROLLBACK drops the one in use and
 * goes back one (to the stock Qwen3 after the oldest).
 * SCHOOL (school/practice.ts, school/remote.ts) rides on the same job: a paper sat on Kaggle's free GPU by the same
 * weights (the notebook in exam mode under its own slug, `ghosty-exam`, one at a time, never while the week's run is
 * on Kaggle; its answers come back through the same hook with their own one-time ticket), the online model sitting
 * the same papers (the honest gap) and practice for his weak spots, a few model calls a step each; that practice goes
 * into the week's data as `school` records, and the GYM puzzles follow his school stage. None of it touches the gate.
 * With MY LIBRARY & CHATS off, a week's data has none of the owner's text, earlier private weeks are left out of
 * the replay, and the week trains on the newest kept brain whose whole chain had no private data (else stock).
 *
 * Every save made by a job step checks the state's generation first (`gen`): a step that started before the
 * report arrived cannot write its stale copy over it.
 */
import { gateVerdict, recordProblem, toJsonl, type AreaScores, type PublishedModel, type TrainPhase, type TrainRecord, type TrainReport, type TrainStatus } from '../../../../packages/shared/src/selftrain';
import { stageById } from '../../../../packages/shared/src/school';
import type { ToolSpec } from '../../../../packages/shared/src/toolcall';
import { heldQuestions, loadPractice, practiceRecords, practiceSummary, practiceTick } from '../school/practice';
import { acceptRemoteReport, EXAM_GPU_HOURS, EXAM_LIMIT, gapTick, loadRemote, paperLines, paperName, saveRemote, stepSaveRemote, type RemoteState } from '../school/remote';
import { loadPaper, loadState as loadSchool, STATE_KEY as SCHOOL_STATE } from '../school/state';
import type { Library } from '../library/store';
import { addJob, loadJobs, rearm, removeJob, setNext } from '../schedule';
import { GYM_SEEDS, NOTEBOOK_PY, REPORT_CARD_TEXTS, TASKS_FILE, TASKS_JS } from './assets';
import { buildExam, EXAM_VERSION, examTexts, libraryCase, type Exam } from './exam';
import {
  addRecords,
  askShapes,
  betterPrompt,
  BETTER_SYSTEM,
  chatToolRecords,
  clearRecords,
  distillRecords,
  drillTasks,
  evolPrompt,
  evolRecord,
  evolSeeds,
  EVOL_MOVES,
  EVOL_SYSTEM,
  failureRecords,
  gymTasks,
  jsonIn,
  judgePrompt,
  judgeVerdicts,
  libraryRecords,
  LIBRARY_SYSTEM,
  loadRecords,
  overlap,
  ownerPassages,
  ratingRecords,
  redteamRecords,
  REDTEAM_SYSTEM,
  RED_TEAM,
  REWRITE_SYSTEM,
  rewriteItems,
  rewritePrompt,
  rewriteProblem,
  rewriteRecord,
  rewritesIn,
  styleCandidates,
  styleRecord,
  syntheticToolRecords,
  tooClose,
  nearReportCard,
  VOICE_CALLS,
  VOICE_JUDGE_SYSTEM,
  VOICE_SYSTEM,
  voicePrompt,
  WEEKLY,
  WEEKLY_CALLS,
  type CtxMsg,
  type Rating,
  type RewriteItem,
} from './factory';
import { EXAM_SLUG, hfCommit, hfEnsurePrivateRepo, hfHasFile, hfTag, hfWhoami, kaggleQuota, kernelOutput, kernelStatus, parseKaggleKey, pushKernel, RemoteError, SESSION_TIMEOUT_S, type GpuQuota } from './remote';
import { revokeCap, weightsCap } from './weights';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** The base model and the stock phone build (apps/web/src/offline/models.ts pins the same commit). */
export const BASE_MODEL = { repo: 'Qwen/Qwen3-0.6B', rev: 'c1899de289a04d12100db370d81485cdf75e47ca' };
export const STOCK_MLC = { repo: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', rev: '8c14ce481d4c692769976ad52afea453a102df19' };
/** The repos on the owner's Hugging Face account (both private). */
export const DATA_REPO = 'ghosty-training';
export const MODEL_REPO = 'ghosty-offline-brain';
/** The model repo's branch the notebook uploads candidates to (served only once the brain promoted them). */
export const CANDIDATES = 'candidates';
/** Gathering stops this long after it began, with whatever it has. */
const COLLECT_FOR = DAY;
/** A run that has not reported after this long is given up. */
const RUN_LIMIT = 14 * 3600_000;
/** The notebook's time budget (Kaggle's session limit is 12 h; the push asks for 10 h; this leaves margin). */
const BUDGET_HOURS = 9;
/** Model calls per alarm run while gathering (each waits briefly for room in the background lane). */
const CALLS_PER_TICK = 4;
/** Failed status reads in a row (half an hour apart) before a running week is given up. */
const STATUS_ERRORS_MAX = 8;
/** A run Kaggle calls COMPLETE whose report has not come this long after is given up (the notebook posts it just before it ends). */
const REPORT_GRACE = 45 * 60_000;
/** GPU hours a run may take (the push asks Kaggle for this much): no push with fewer left this week. */
const RUN_GPU_HOURS = SESSION_TIMEOUT_S / 3600;

/** Where the week's records are kept, by kind (`voice`: the style set, `distill` records; `rewrite`: its `pref` pairs). */
const KINDS = ['gym', 'drill', 'evol', 'library', 'tool', 'pref', 'failure', 'redteam', 'distill', 'school', 'voice', 'rewrite'];
/** The voice's model calls per job step (its own, besides CALLS_PER_TICK), and how many go in one writer, rewriter or judge call. */
const VOICE_PER_TICK = 4;
const VOICE_BATCH = 8;
const REWRITE_BATCH = 4;
const JUDGE_BATCH = 8;

/** A kept model as the brain keeps it: plus the LoRA chain that rebuilds it (for the next week's training). */
export interface KeptModel extends PublishedModel {
  chain: { adapter: string; scale: number; private?: boolean }[];
}

export interface State {
  phase: TrainPhase;
  week: number;
  /** Bumped by every save: a step's save is refused when someone else saved since it read the state. */
  gen?: number;
  /** When the next weekly run may start. */
  nextRun: number;
  startedAt: number;
  note: string;
  /** Model calls made this week, and how far each kind of gathering got. */
  calls: number;
  done: { free?: boolean; freePart?: number; examLibrary?: boolean; examTarget?: number; examKeys?: string[]; prefIds?: number[]; library?: number; evol?: number; redteam?: number; voice?: VoiceDone };
  /** The ratings that went into this week's data (only these are marked used when it ends). */
  ratingIds?: number[];
  /** This week's data has the owner's library, chats or ratings in it. */
  private?: boolean;
  ticket?: string;
  ticketUntil?: number;
  /** The ticket was already traded for the token (once only). */
  tokenGiven?: boolean;
  dataCommit?: string;
  dataFile?: string;
  kernelUrl?: string;
  pushedAt?: number;
  pushes?: number;
  /** When Kaggle first said COMPLETE with no report in yet. */
  completeAt?: number;
  /** Kaggle's free GPU hours this week, as they were before the last push. */
  gpu?: { left: number; total: number };
  /** Failed upload/push steps in a row, and failed status reads in a row (counted apart). */
  failures?: number;
  statusErrors?: number;
  hfUser?: string;
  /** The chain this week trains on (so the report adds to the right one). */
  base?: { label: string; chain: KeptModel['chain'] };
}

/** A candidate waiting for the blind judge: a style-set exchange, or a rewrite (`item`: the reply it says again). */
type Queued = { ask: string; reply: string; item?: RewriteItem };

/** How far the voice got this week: its model calls, writer batches, the judge's queue, and the replies rewritten (ids). */
interface VoiceDone {
  calls: number;
  batches: number;
  queue: Queued[];
  ids: string[];
  finished?: boolean;
}

const K = {
  state: 'train:state',
  report: 'train:report',
  previous: 'train:previous',
  models: 'train:models',
  active: 'train:active',
  ratings: 'train:ratings',
  gym: 'train:gym',
  exam: 'train:exam',
  privateData: 'train:private',
  rejected: 'train:rejected',
  /** week → whether that week's data held private text (for the replay with MY LIBRARY & CHATS off). */
  weeks: 'train:weeks',
  /** The tasks.mjs last uploaded: which repo, and its SHA-256 (sent again only when either changed). */
  tasks: 'train:tasks',
};

export interface CycleDeps {
  storage: DurableObjectStorage;
  library: Library | null;
  vault: { get(name: string): Promise<string | null | undefined> };
  /** A free online model in the background lane; throws when none has room. */
  ask: (system: string, user: string) => Promise<string>;
  /** The offline brain's tools (factory.ts offlineToolSpecs). */
  tools: ToolSpec[];
  /** https://… where the brain is reached (the notebook's hook is under it). */
  origin: string;
  notify?: (title: string, text: string) => Promise<void>;
  fetch?: typeof fetch;
  now?: () => number;
}

const nowOf = (d: CycleDeps) => (d.now ?? Date.now)();
const fetchOf = (d: CycleDeps): typeof fetch => d.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
const wk = (n: number) => String(n).padStart(4, '0');

async function loadState(s: DurableObjectStorage): Promise<State> {
  return (await s.get<State>(K.state)) ?? { phase: 'idle', week: 0, gen: 0, nextRun: 0, startedAt: 0, note: 'Not started yet.', calls: 0, done: {} };
}
/** A save by someone who just read the state (a route, the hook): always lands. */
async function saveState(s: DurableObjectStorage, st: State): Promise<void> {
  const cur = await loadState(s);
  st.gen = Math.max(cur.gen ?? 0, st.gen ?? 0) + 1;
  await s.put(K.state, st);
}
/** A job step's save: refused (false) when the state changed since the step read it. */
async function stepSave(s: DurableObjectStorage, st: State): Promise<boolean> {
  const cur = await loadState(s);
  if ((cur.gen ?? 0) !== (st.gen ?? 0)) return false;
  st.gen = (st.gen ?? 0) + 1;
  await s.put(K.state, st);
  return true;
}

async function keysOf(d: CycleDeps): Promise<{ kaggle: ReturnType<typeof parseKaggleKey>; hf: string }> {
  const [k, h] = await Promise.all([d.vault.get('kaggle').catch(() => null), d.vault.get('hf_write').catch(() => null)]);
  return { kaggle: k ? parseKaggleKey(k) : null, hf: (h ?? '').trim() };
}

const missingNote = (k: { kaggle: unknown; hf: string }) =>
  !k.kaggle && !k.hf ? 'Waiting for two keys: Kaggle and a Hugging Face write token (SYSTEM → KEYS).' : !k.kaggle ? 'Waiting for the Kaggle key (SYSTEM → KEYS).' : 'Waiting for the Hugging Face write token (SYSTEM → KEYS).';

// ---- the job ------------------------------------------------------------------------------------------------

export const TRAIN_JOB = { kind: 'train' as const, title: 'Offline brain training', text: "Gather the week's training data, train the offline brain on Kaggle, and keep it if it passes the exam." };

/** Exactly one standing `train` job (it times itself; added on the first check). */
export async function ensureTrainJob(storage: DurableObjectStorage): Promise<void> {
  const jobs = (await loadJobs(storage)).filter((j) => j.kind === 'train');
  for (const j of jobs.slice(1)) await removeJob(storage, j.id);
  if (!jobs.length) {
    await addJob(storage, { ...TRAIN_JOB, next: Date.now() + 15 * 60_000, repeat: 'hourly', tz: 'UTC' });
    await rearm(storage);
  }
}

/** One step of the week, then SCHOOL's (schoolStep). Never throws; returns when the job should run again (ms from now) and a line for the job list. */
export async function trainTick(d: CycleDeps): Promise<{ next: number; note: string }> {
  const r = await weekTick(d);
  const more = await schoolStep(d);
  return more === null ? r : { next: Math.max(1000, Math.min(r.next, more)), note: r.note };
}

async function weekTick(d: CycleDeps): Promise<{ next: number; note: string }> {
  const st = await loadState(d.storage);
  const phase = st.phase;
  try {
    const r = await step(d, st);
    st.note = r.note;
    if (!(await stepSave(d.storage, st))) {
      // The hook (a report) or the owner changed the week meanwhile: theirs stands.
      const cur = await loadState(d.storage);
      return { next: 60_000, note: cur.note };
    }
    return r;
  } catch (e) {
    const msg = e instanceof RemoteError ? e.message : String((e as Error)?.message ?? e).slice(0, 300);
    st.note = `Stopped: ${msg}`;
    let next = 3600_000;
    if (phase === 'running') {
      // Reading Kaggle's status failed (a blip, an outage): a few of those never end a running week.
      st.statusErrors = (st.statusErrors ?? 0) + 1;
      st.note = `Could not ask Kaggle how the run is going (${msg}); asking again in half an hour.`;
      next = 30 * 60_000;
      if (st.statusErrors >= STATUS_ERRORS_MAX) await endWeek(d, st, failedReport(st, `Kaggle could not be asked about the run ${STATUS_ERRORS_MAX} times in a row: ${msg}`, nowOf(d)), 'Kaggle could not be reached about the run: given up for this week.');
    } else {
      // A failure while gathering, uploading or pushing is tried again in an hour; three in a row end the week.
      st.failures = (st.failures ?? 0) + 1;
      if (st.failures >= 3) await endWeek(d, st, failedReport(st, msg, nowOf(d)), `This week's training stopped: ${msg}`);
    }
    if (!(await stepSave(d.storage, st))) return { next: 60_000, note: (await loadState(d.storage)).note };
    return { next, note: st.note };
  }
}

function failedReport(st: State, why: string, now: number): TrainReport {
  return { week: st.week, startedAt: st.startedAt, finishedAt: now, base: st.base?.label ?? '', before: {}, after: {}, items: {}, gate: { pass: false, why: 'the run did not finish' }, trained: {}, rejected: [], phases: [], error: why };
}

async function step(d: CycleDeps, st: State): Promise<{ next: number; note: string }> {
  const now = nowOf(d);
  const keys = await keysOf(d);
  if (st.phase === 'idle') {
    if (!keys.kaggle || !keys.hf) return { next: DAY, note: missingNote(keys) };
    if (now < st.nextRun) return { next: Math.min(st.nextRun - now, 6 * 3600_000), note: `Next training ${new Date(st.nextRun).toISOString().slice(0, 16).replace('T', ' ')} UTC.` };
    st.week += 1;
    st.phase = 'collect';
    st.startedAt = now;
    st.calls = 0;
    st.done = {};
    st.ratingIds = [];
    st.pushes = 0;
    st.failures = 0;
    st.statusErrors = 0;
    st.private = await privateOn(d.storage);
    delete st.ticket;
    delete st.tokenGiven;
    await clearRecords(d.storage, KINDS);
    await d.storage.put(K.rejected, [] as { why: string; n: number }[]);
  }
  if (st.phase === 'collect') return collect(d, st, now);
  if (st.phase === 'upload') return upload(d, st, keys.hf);
  if (st.phase === 'push') return push(d, st, keys.kaggle!, now);
  if (st.phase === 'running') return watch(d, st, keys.kaggle!, now);
  st.phase = 'idle';
  return { next: 60_000, note: st.note };
}

// ---- collect ------------------------------------------------------------------------------------------------

async function noteRejected(s: DurableObjectStorage, why: string, n = 1): Promise<void> {
  if (n <= 0) return;
  const list = (await s.get<{ why: string; n: number }[]>(K.rejected)) ?? [];
  const at = list.find((x) => x.why === why);
  if (at) at.n += n;
  else list.push({ why, n });
  await s.put(K.rejected, list);
}

export async function privateOn(s: DurableObjectStorage): Promise<boolean> {
  return (await s.get<boolean>(K.privateData)) !== false;
}

async function loadExam(d: CycleDeps): Promise<Exam> {
  let e = await d.storage.get<Exam>(K.exam);
  if (!e || e.version !== EXAM_VERSION) {
    // A newer exam: the owner's library questions carry over (their passages stay held out).
    e = { ...buildExam(d.tools), library: e?.library ?? [] };
    await d.storage.put(K.exam, e);
  }
  return e;
}

type Far = (recs: TrainRecord[]) => TrainRecord[];

/**
 * The free part of gathering (no model), one piece per job step: each is a few milliseconds of CPU (a single step
 * that did it all took over 100 ms, most of it the near-copy checks, now quicker in factory.ts). Every record whose
 * question is a near copy of an exam question, or of one on the phone's REPORT CARD (it must measure what was never
 * trained on), is left out by `far` (counted), whatever made it.
 */
const FREE_PARTS: ((d: CycleDeps, st: State, far: Far) => Promise<void>)[] = [
  async (d, st) => {
    const levels = (await d.storage.get<Record<string, number>>(K.gym)) ?? {};
    const games = [...new Set(GYM_SEEDS.map((g) => g.game))];
    // While he is at school (SCHOOL has a record), the puzzles are at his stage's GYM levels: the GYM follows his schooling.
    const stage = (await d.storage.get(SCHOOL_STATE)) ? stageById((await loadSchool({ storage: d.storage })).stage)?.gym : undefined;
    await addRecords(d.storage, 'gym', gymTasks(levels, games, st.week, WEEKLY.gymPerLevel, stage));
    await addRecords(d.storage, 'drill', drillTasks(st.week));
  },
  // The synthetic tool calls (each with its tools' schemas: the biggest records) in two halves; the same every time for a week.
  ...[0, 1].map((half) => async (d: CycleDeps, st: State, far: Far) => {
    const syn = syntheticToolRecords(d.tools, st.week);
    const n = Math.ceil(syn.recs.length / 2);
    await addRecords(d.storage, 'tool', far(syn.recs.slice(half * n, (half + 1) * n)));
    if (!half) await noteRejected(d.storage, 'synthetic tool calls that failed the schema check', syn.rejected);
  }),
  async (d, _st, far) => {
    await addRecords(d.storage, 'redteam', far(redteamRecords()));
    await addRecords(d.storage, 'failure', far(failureRecords((await d.storage.get<TrainReport>(K.report)) ?? null)));
  },
  async (d, st, far) => {
    if (st.private === false) return;
    const ctx = (await d.storage.get<CtxMsg[]>('ctx')) ?? []; // agent.ts CTX_KEY: the conversation the model reads
    await addRecords(d.storage, 'tool', far(chatToolRecords(ctx, d.tools)));
  },
  async (d, st, far) => {
    if (st.private === false) return;
    const turns = (await d.storage.get<{ role: 'user' | 'assistant'; text: string; model?: string }[]>('turns')) ?? []; // agent.ts TURNS_KEY
    const disliked = new Set((await loadRatings(d.storage)).filter((r) => !r.up).map((r) => r.reply.trim()));
    await addRecords(d.storage, 'distill', far(distillRecords(turns, disliked)));
  },
  async (d, st, far) => {
    if (st.private === false) return;
    // 👍 need no model: they go in now (and only these are marked used when the week ends).
    const ups = (await loadRatings(d.storage)).filter((r) => r.up && !r.used);
    await addRecords(d.storage, 'pref', far(ups.flatMap((r) => ratingRecords(r))));
    st.ratingIds = [...(st.ratingIds ?? []), ...ups.map((r) => r.at)];
  },
  async (d, _st, far) => {
    // SCHOOL practice for his weak spots at his stage (school/practice.ts; no owner's text in it), at most WEEKLY.school,
    // each checked once more against every question that is or may be on a paper (never a paper's item).
    const stage = (await loadSchool({ storage: d.storage })).stage;
    const { recs, near } = practiceRecords(await loadPractice(d.storage, stage), await heldQuestions(d.storage, stage), WEEKLY.school);
    await noteRejected(d.storage, 'school practice too close to a question on a paper', near);
    await addRecords(d.storage, 'school', far(recs));
  },
];

/** The free part (no model) a piece per step, then a few model calls; the week's share or a day, whichever comes first. */
async function collect(d: CycleDeps, st: State, now: number): Promise<{ next: number; note: string }> {
  const s = d.storage;
  const priv = st.private !== false;
  const exam = await loadExam(d);
  const held = new Set(exam.library.map((c) => c.key));
  if (!st.done.free) {
    const freeQs = examTexts(exam, st.week);
    let n = 0;
    const far: Far = (recs) =>
      recs.filter((r) => {
        const q = r.messages?.filter((m) => m.role === 'user').at(-1)?.content ?? '';
        const bad = !!q && (!!tooClose(q, freeQs) || !!nearReportCard(q, REPORT_CARD_TEXTS));
        if (bad) n++;
        return !bad;
      });
    const part = st.done.freePart ?? 0;
    await FREE_PARTS[part]!(d, st, far);
    await noteRejected(s, 'records too close to an exam question', n);
    st.done.freePart = part + 1;
    st.done.free = st.done.freePart >= FREE_PARTS.length;
    return { next: 1000, note: "Gathering this week's lessons: puzzles, tool calls and chats first." };
  }
  let calls = 0;
  const deadline = now + 25_000;
  const room = () => calls < CALLS_PER_TICK && st.calls < WEEKLY_CALLS && nowOf(d) < deadline;
  const call = async (system: string, user: string): Promise<string | null> => {
    calls++;
    st.calls++;
    try {
      return await d.ask(system, user);
    } catch {
      return null;
    }
  };
  let noModel = false;
  const passages = priv ? ownerPassages(d.library, st.week, WEEKLY.library / 2 + 12, held) : [];
  // 1. the exam's library questions, once (held out from training for good): from at most half the passages
  // there are, six at most, a few model calls at a time like everything else here.
  st.done.examTarget ??= Math.min(6, Math.floor(passages.length / 2));
  const tried = new Set(st.done.examKeys ?? []);
  if (!st.done.examLibrary && st.done.examTarget >= 2) {
    for (const p of passages) {
      if (tried.size >= st.done.examTarget || !room()) break;
      if (tried.has(p.key)) continue;
      const reply = await call(LIBRARY_SYSTEM, `${p.title}\n\n${p.text}`);
      if (reply === null) {
        noModel = true;
        break;
      }
      tried.add(p.key);
      // the same check as training pairs: the answer's words must be in the passage
      const qa = ((jsonIn(reply)?.qa ?? []) as { q?: unknown; a?: unknown }[]).filter((x) => typeof x?.q === 'string' && typeof x?.a === 'string' && x.q.length >= 8 && overlap(x.a, p.text) >= 0.6);
      for (const x of qa.slice(0, 2)) if (exam.library.length < 12) exam.library.push(libraryCase(p, String(x.q), String(x.a)));
      await s.put(K.exam, exam);
    }
    st.done.examKeys = [...tried];
    if (tried.size >= st.done.examTarget) st.done.examLibrary = true;
  }
  if (!st.done.examLibrary && st.done.examTarget >= 2) {
    // Never stuck here: past the day of gathering, or with the week's model calls used up (failed ones count too),
    // the exam keeps the library questions it has and gathering goes on to its end.
    if (now - st.startedAt > COLLECT_FOR || st.calls >= WEEKLY_CALLS) st.done.examLibrary = true;
    else return { next: noModel ? 20 * 60_000 : 2 * 60_000, note: "Gathering: writing the exam's library questions first." };
  }
  const lib = passages.filter((p) => !tried.has(p.key));
  /** A near copy of an exam question or of one on the phone's REPORT CARD: never trained on. */
  const examQs = examTexts(exam, st.week);
  const leak = (t: string): string => tooClose(t, examQs) || nearReportCard(t, REPORT_CARD_TEXTS);
  // 2. better replies for the owner's 👎 (each rating once: known by its id, so new or changed ratings never shift the others)
  if (priv && !noModel) {
    const doneIds = new Set(st.done.prefIds ?? []);
    const downs = (await loadRatings(s)).filter((r) => !r.up && !r.used && !doneIds.has(r.at)).slice(0, WEEKLY.pref);
    for (const r of downs) {
      if (!room()) break;
      const better = await call(BETTER_SYSTEM, betterPrompt(r));
      if (better === null) {
        noModel = true;
        break;
      }
      const recs = ratingRecords(r, better);
      if (!recs.length) await noteRejected(s, 'better replies that were no better (refused, or the same)');
      for (const x of recs) await addRecords(s, x.kind, [x]);
      st.done.prefIds = [...(st.done.prefIds ?? []), r.at];
      st.ratingIds = [...(st.ratingIds ?? []), r.at];
    }
  }
  // 3. library question/answer pairs from the owner's passages
  for (let i = st.done.library ?? 0; i < lib.length && !noModel && room() && (await countOf(s, 'library')) < WEEKLY.library; i++) {
    const p = lib[i]!;
    const reply = await call(LIBRARY_SYSTEM, `${p.title}\n\n${p.text}`);
    if (reply === null) {
      noModel = true;
      break;
    }
    const recs = libraryRecords(p, reply, lib[(i + 1) % lib.length]).filter((r) => {
      const near = leak(r.messages![r.messages!.length - 2]!.content);
      return !near;
    });
    if (!recs.length) await noteRejected(s, 'library answers not found in their passage, or too close to an exam question');
    await addRecords(s, 'library', recs);
    st.done.library = i + 1;
  }
  // 4. Evol-Instruct
  const turns = priv ? ((await s.get<{ role: string; text: string }[]>('turns')) ?? []).filter((t) => t.role === 'user' && t.text.length >= 12 && t.text.length <= 400).map((t) => t.text).slice(-40) : [];
  const seeds = evolSeeds({ week: st.week, gymSeeds: GYM_SEEDS, levels: (await s.get<Record<string, number>>(K.gym)) ?? {}, questions: turns });
  for (let i = st.done.evol ?? 0; i < seeds.length && !noModel && room(); i++) {
    const sd = seeds[i]!;
    const reply = await call(EVOL_SYSTEM, evolPrompt(sd.seed, EVOL_MOVES[i % EVOL_MOVES.length]!));
    if (reply === null) {
      noModel = true;
      break;
    }
    const { rec, why } = evolRecord(sd.seed, sd.from, reply);
    // An evolution that came out as (a rewording of) an exam question would leak the exam into training.
    const near = rec ? leak(rec.messages![1]!.content) : '';
    if (rec && !near) await addRecords(s, 'evol', [rec]);
    else await noteRejected(s, `evolved tasks dropped: ${near ? 'too close to an exam question' : why}`);
    st.done.evol = i + 1;
  }
  // 5. red-team rewordings (the refusal stays Ghosty's own), never close to the exam's safety questions
  for (let i = st.done.redteam ?? 0; i < WEEKLY.redteamEvol && !noModel && room(); i++) {
    const [q, a] = RED_TEAM[i % RED_TEAM.length]!;
    const reply = await call(REDTEAM_SYSTEM, q);
    if (reply === null) {
      noModel = true;
      break;
    }
    const v = reply.trim().replace(/^["“]|["”]$/g, '');
    if (v.length >= 12 && v.length <= 600 && v !== q && !leak(v)) await addRecords(s, 'redteam', redteamRecords([[v, a]]).slice(-1));
    else await noteRejected(s, 'red-team rewordings that were unusable or too close to an exam question');
    st.done.redteam = i + 1;
  }
  // 6. the voice (its own calls): rewrites of AI-sounding replies and the style set, both through the blind judge
  if (!noModel) noModel = await voiceStep(d, st, priv, leak, deadline);
  const finished = (st.done.evol ?? 0) >= seeds.length && (st.done.redteam ?? 0) >= WEEKLY.redteamEvol && ((st.done.library ?? 0) >= lib.length || (await countOf(s, 'library')) >= WEEKLY.library);
  // (the voice is waited for too, unless the week's other calls ran out or the day is over: then it goes with what it has)
  if ((finished && st.done.voice?.finished) || st.calls >= WEEKLY_CALLS || now - st.startedAt > COLLECT_FOR) {
    await noteRejected(s, 'voice: left unjudged when gathering ended', st.done.voice?.queue.length ?? 0);
    st.phase = 'upload';
    return { next: 60_000, note: `Gathered this week's lessons (${st.calls} questions to the online AIs). Uploading them to your private Hugging Face space.` };
  }
  return { next: noModel ? 20 * 60_000 : 5 * 60_000, note: noModel ? 'Gathering: no free online AI right now, trying again soon.' : `Gathering this week's lessons (${st.calls} questions to the online AIs so far).` };
}

async function countOf(s: DurableObjectStorage, kind: string): Promise<number> {
  return (await loadRecords(s, kind)).length;
}

const askKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The voice's part of a gathering step (OWNER-ISSUES 12), with model calls of its own (VOICE_PER_TICK a step,
 * VOICE_CALLS a week): first the rewrites (the owner's 👎, then this week's replies the detector calls AI-sounding;
 * only with MY LIBRARY & CHATS on), then the style set (written for the shapes of this week's asks, never their
 * words), every candidate the detector passed queued for the blind judge, a batch at a time. A PERSON verdict keeps
 * it (at most WEEKLY.voice style examples and WEEKLY.voicePref pairs); anything else is counted as left out. The
 * queue, the batches and the replies already rewritten are in the state, so the next step carries on. Returns
 * true when no model answered.
 */
async function voiceStep(d: CycleDeps, st: State, priv: boolean, leak: (t: string) => string, deadline: number): Promise<boolean> {
  const s = d.storage;
  const v = (st.done.voice ??= { calls: 0, batches: 0, queue: [], ids: [] });
  if (v.finished) return false;
  let calls = 0;
  const room = () => calls < VOICE_PER_TICK && v.calls < VOICE_CALLS && nowOf(d) < deadline;
  const call = async (system: string, user: string): Promise<string | null> => {
    calls++;
    v.calls++;
    try {
      return await d.ask(system, user);
    } catch {
      return null;
    }
  };
  const kept = await loadRecords(s, 'voice');
  let style = kept.length;
  let prefs = await countOf(s, 'rewrite');
  const asks = new Set([...kept.map((r) => askKey(r.messages?.[1]?.content ?? '')), ...v.queue.map((q) => askKey(q.ask))]);
  const since = st.startedAt - WEEK;
  const turns = priv ? ((await s.get<{ role: 'user' | 'assistant'; text: string; at?: number; vehicle?: boolean }[]>('turns')) ?? []) : [];
  const todo = priv ? rewriteItems(await loadRatings(s), turns, since).filter((x) => !v.ids.includes(x.id)) : [];
  // Only the shapes of his asks this week (a few words each, and how many) reach the writer: never what he wrote.
  const shapes = askShapes(turns.filter((t) => t.role === 'user' && (t.at ?? 0) >= since).map((t) => t.text));
  let noModel = false;
  while (room()) {
    const wantPref = todo.length > 0 && prefs + v.queue.filter((q) => q.item).length < WEEKLY.voicePref;
    const wantStyle = style + v.queue.filter((q) => !q.item).length < WEEKLY.voice;
    const lastCall = VOICE_CALLS - v.calls <= 1;
    if (v.queue.length && (v.queue.length >= JUDGE_BATCH || lastCall || (!wantPref && !wantStyle))) {
      const batch = v.queue.slice(0, JUDGE_BATCH);
      const reply = await call(VOICE_JUDGE_SYSTEM, judgePrompt(batch.map((x) => ({ ask: x.ask, reply: x.reply }))));
      if (reply === null) {
        noModel = true;
        break;
      }
      const person = judgeVerdicts(reply, batch.length);
      v.queue = v.queue.slice(batch.length);
      let ai = 0;
      for (const [i, x] of batch.entries()) {
        if (!person[i]) ai++;
        else if (x.item && prefs < WEEKLY.voicePref) {
          prefs += await addRecords(s, 'rewrite', [rewriteRecord(x.item, x.reply)]);
          // a 👎 whose pair went into the week is used up when it ends, like one the better reply used
          if (x.item.rating !== undefined) st.ratingIds = [...(st.ratingIds ?? []), x.item.rating];
        } else if (!x.item && style < WEEKLY.voice) style += await addRecords(s, 'voice', [styleRecord(x)]);
      }
      await noteRejected(s, 'voice: replies the blind judge took for an AI', ai);
      continue;
    }
    if (wantPref && !lastCall) {
      const batch = todo.splice(0, REWRITE_BATCH);
      const reply = await call(REWRITE_SYSTEM, rewritePrompt(batch));
      if (reply === null) {
        noModel = true;
        break;
      }
      v.ids.push(...batch.map((x) => x.id));
      const got = rewritesIn(reply, batch.length);
      for (const [i, it] of batch.entries()) {
        const why = leak(it.question) ? 'too close to an exam question' : rewriteProblem(it, got[i]!);
        if (why) await noteRejected(s, `voice: rewrites left out (${why})`);
        else v.queue.push({ ask: it.question, reply: got[i]!, item: it });
      }
      continue;
    }
    if (wantStyle && !lastCall) {
      const reply = await call(VOICE_SYSTEM, voicePrompt(shapes, VOICE_BATCH, v.batches++));
      if (reply === null) {
        noModel = true;
        break;
      }
      const { ok, dropped } = styleCandidates(reply);
      let near = 0;
      for (const x of ok) {
        const k = askKey(x.ask);
        if (asks.has(k) || leak(x.ask)) near++;
        else {
          asks.add(k);
          v.queue.push(x);
        }
      }
      await noteRejected(s, 'voice: style examples that sounded like an AI', dropped);
      await noteRejected(s, 'voice: style examples repeated, or too close to an exam question', near);
      continue;
    }
    break;
  }
  if (v.calls >= VOICE_CALLS) {
    // The week's voice calls are used up: what still waits for the judge is left out.
    await noteRejected(s, "voice: left unjudged (the week's calls ran out)", v.queue.length);
    v.queue = [];
  }
  // Done: nothing waits for the judge, and the calls are used up (one left is no use with nothing to judge) or both are full.
  const spent = VOICE_CALLS - v.calls <= (v.queue.length ? 0 : 1);
  v.finished = !v.queue.length && (spent || ((!todo.length || prefs >= WEEKLY.voicePref) && style >= WEEKLY.voice));
  return noModel;
}

// ---- upload and push ----------------------------------------------------------------------------------------

async function upload(d: CycleDeps, st: State, token: string): Promise<{ next: number; note: string }> {
  const f = fetchOf(d);
  const me = await hfWhoami(f, token);
  if (me.role === 'read') throw new RemoteError('the Hugging Face token can only read: make a write (or fine-grained) token as the steps say.');
  st.hfUser = me.name;
  const repo = `${me.name}/${DATA_REPO}`;
  // Both repos private before anything of the owner's is sent (made so, or refused with the fix).
  await hfEnsurePrivateRepo(f, me, token, repo, 'dataset');
  await hfEnsurePrivateRepo(f, me, token, `${me.name}/${MODEL_REPO}`, 'model');
  const all: TrainRecord[] = [];
  for (const k of KINDS) all.push(...(await loadRecords(d.storage, k)));
  const { text, kept, dropped } = toJsonl(all);
  for (const x of dropped) await noteRejected(d.storage, `bad records: ${x.why}`, x.n);
  const exam = await loadExam(d);
  st.dataFile = `weeks/week-${wk(st.week)}.jsonl`;
  // tasks.mjs (535 KB) only when it changed since it was last sent, or is not in the repo any more: the commit
  // keeps the one already there. Its base64 and hash come from build.mjs (no CPU spent on them here).
  const last = await d.storage.get<{ repo: string; sha256: string }>(K.tasks);
  const sendTasks = !(last?.repo === repo && last.sha256 === TASKS_FILE.sha256 && (await hfHasFile(f, token, repo, 'dataset', 'tasks.mjs').catch(() => false)));
  st.dataCommit = await hfCommit(f, token, repo, 'dataset', [
    { path: st.dataFile, content: text },
    { path: 'exam.json', content: JSON.stringify(exam) },
    ...(sendTasks ? [{ path: 'tasks.mjs', content: TASKS_JS, pre: TASKS_FILE }] : []),
  ], `Ghosty week ${st.week}: ${kept} examples`);
  if (sendTasks) await d.storage.put(K.tasks, { repo, sha256: TASKS_FILE.sha256 });
  const weeks = (await d.storage.get<Record<string, boolean>>(K.weeks)) ?? {};
  weeks[String(st.week)] = st.private !== false;
  await d.storage.put(K.weeks, weeks);
  st.phase = 'push';
  st.pushes = 0;
  st.failures = 0;
  return { next: 60_000, note: `Uploaded ${kept} lessons to your private Hugging Face space. Starting the run on Kaggle.` };
}

/** The notebook as pushed: its settings written into the CONFIG_JSON line. */
export function notebookSource(config: Record<string, unknown>): string {
  const line = `CONFIG_JSON = ${JSON.stringify(JSON.stringify(config))}  # GHOSTY-CONFIG: written by the brain`;
  const out = NOTEBOOK_PY.replace(/^CONFIG_JSON = None\b.*$/m, line);
  if (out === NOTEBOOK_PY) throw new Error('the notebook has no CONFIG_JSON line');
  return out;
}

/** What this week trains on: the brain in use; with private data off, the newest kept brain with no private week in its chain (else stock). */
export async function trainingBase(s: DurableObjectStorage, privateData: boolean): Promise<{ label: string; chain: KeptModel['chain'] }> {
  const models = await loadModels(s);
  const active = await s.get<string | null>(K.active);
  const pick = privateData ? models.find((m) => m.commit === active) : models.find((m) => m.chain.every((c) => !c.private));
  return pick ? { label: pick.label, chain: pick.chain } : { label: 'stock Qwen3 0.6B', chain: [] };
}

const hours = (h: number) => String(Math.floor(h * 10) / 10);
const gpuNote = (g: State['gpu']) => (g ? `${hours(g.left)} of ${hours(g.total)} free GPU hours were left this week` : '');

/** Why Kaggle's GPU quota rules a run out now, in plain words ('' when it does not). */
export function quotaProblem(q: GpuQuota): string {
  if (q.payToScale) return "Kaggle's pay-to-scale is switched on for this account, so a run past the free hours could be charged: Ghosty will not start one. Turn it off on kaggle.com (Settings), then press TRAIN NOW.";
  if (q.total <= 0) return 'Kaggle gives this account no GPU time: verify your phone number on kaggle.com (Settings → Phone verification), then press TRAIN NOW.';
  if (q.left < RUN_GPU_HOURS)
    return `Only ${hours(q.left)} of Kaggle's ${hours(q.total)} free GPU hours are left this week (a run needs ${RUN_GPU_HOURS}): it starts when they come back${q.refreshAt ? `, ${new Date(q.refreshAt).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}.`;
  return '';
}

async function push(d: CycleDeps, st: State, kaggle: NonNullable<ReturnType<typeof parseKaggleKey>>, now: number): Promise<{ next: number; note: string }> {
  if (!d.origin) throw new RemoteError('the brain does not know its own address yet: open Ghosty once, then press TRAIN NOW.');
  // A SCHOOL paper being sat on Kaggle (a few minutes): the week's run goes after it, never beside it.
  const exam = await loadRemote(d.storage);
  if (exam.phase === 'running') return { next: 15 * 60_000, note: `Waiting: ${paperName(exam)} is being sat on the free GPU; the training starts after it.` };
  // Kaggle's GPU hours first: never a run that could be charged, or one without the hours to finish. It waits
  // (asking again later, or at TRAIN NOW) rather than failing; after a week of waiting that week is given up.
  const q = await kaggleQuota(fetchOf(d), kaggle);
  const no = quotaProblem(q);
  if (no) {
    if (now - st.startedAt > WEEK) return endWeek(d, st, failedReport(st, no, now), `This week's training did not start: ${no}`);
    const wait = !q.payToScale && q.total > 0 && q.refreshAt ? Math.min(DAY, Math.max(30 * 60_000, q.refreshAt - now + 10 * 60_000)) : 6 * 3600_000;
    return { next: wait, note: no };
  }
  st.gpu = { left: q.left, total: q.total };
  st.base = await trainingBase(d.storage, st.private !== false);
  const weeks = (await d.storage.get<Record<string, boolean>>(K.weeks)) ?? {};
  // Earlier weeks for the replay mix: all of them, or only those without private text when it is off.
  const replay = Object.entries(weeks).filter(([w, p]) => Number(w) < st.week && (st.private !== false || !p)).map(([w]) => Number(w)).sort((a, b) => a - b);
  st.ticket = randomTicket();
  st.ticketUntil = now + RUN_LIMIT + 3600_000;
  st.tokenGiven = false;
  const config = {
    week: st.week,
    hook: `${d.origin.replace(/\/$/, '')}/api/training/hook`,
    ticket: st.ticket,
    data_repo: `${st.hfUser}/${DATA_REPO}`,
    model_repo: `${st.hfUser}/${MODEL_REPO}`,
    candidate_branch: CANDIDATES,
    data_file: st.dataFile,
    data_rev: st.dataCommit,
    base_model: BASE_MODEL,
    stock_mlc: STOCK_MLC,
    current: st.base,
    replay_weeks: replay,
    private: st.private !== false,
    budget_hours: BUDGET_HOURS,
    samples: 16,
  };
  const r = await pushKernel(fetchOf(d), kaggle, notebookSource(config));
  st.kernelUrl = r.url;
  st.pushedAt = now;
  st.pushes = (st.pushes ?? 0) + 1;
  st.statusErrors = 0;
  delete st.completeAt;
  st.phase = 'running';
  return { next: 30 * 60_000, note: `Training on Kaggle (run ${r.version}). It takes a few hours; ${gpuNote(st.gpu)}.` };
}

const randomTicket = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');

async function watch(d: CycleDeps, st: State, kaggle: NonNullable<ReturnType<typeof parseKaggleKey>>, now: number): Promise<{ next: number; note: string }> {
  if (now - (st.pushedAt ?? now) > RUN_LIMIT) return endWeek(d, st, failedReport(st, 'the Kaggle run did not report back within 14 hours', now), 'The Kaggle run did not report back: given up for this week.');
  const k = await kernelStatus(fetchOf(d), kaggle);
  st.statusErrors = 0;
  if (k.state === 'error' || k.state === 'cancelled') {
    delete st.completeAt;
    if ((st.pushes ?? 0) < 3) {
      st.phase = 'push';
      return { next: 5 * 60_000, note: `The Kaggle run stopped (${k.message || k.state}); starting it again from where it got to.` };
    }
    const tail = (await kernelOutput(fetchOf(d), kaggle).catch(() => null))?.logTail;
    const log = tail ? ` The end of its log: ${tail}` : '';
    return endWeek(d, st, failedReport(st, `the Kaggle run stopped: ${k.message || k.state}.${log}`, now), `The Kaggle run stopped three times: given up for this week.${log}`);
  }
  if (k.state === 'complete') {
    // The notebook posts its report just before it ends: COMPLETE with no report for a while means it never got
    // through (no internet on Kaggle, the brain unreachable) or it failed before it could. Its saved output says which.
    st.completeAt ??= now;
    if (now - st.completeAt < REPORT_GRACE) return { next: 15 * 60_000, note: 'The Kaggle run has finished; waiting for its report.' };
    const out = await kernelOutput(fetchOf(d), kaggle).catch(() => null);
    const err = out?.report?.error ? String(out.report.error).replace(/hf_[A-Za-z0-9]{8,}/g, 'hf_…').slice(0, 300) : '';
    const why = err ? `the notebook stopped: ${err}` : 'its report never reached Ghosty (no internet on Kaggle, or Ghosty could not be reached)';
    const log = out?.logTail ? ` The end of its log: ${out.logTail}` : '';
    return endWeek(d, st, failedReport(st, `the Kaggle run finished without reporting back: ${why}.${log}`, now), `The Kaggle run finished without reporting back: ${why}.${log}`);
  }
  delete st.completeAt;
  const g = st.gpu ? ` (${gpuNote(st.gpu)} when it started.)` : '';
  return { next: 30 * 60_000, note: k.state === 'queued' ? `Waiting for a free Kaggle GPU.${g}` : `Training on Kaggle…${g}` };
}

async function endWeek(d: CycleDeps, st: State, report: TrainReport, note: string): Promise<{ next: number; note: string }> {
  const prev = await d.storage.get<TrainReport>(K.report);
  if (prev && prev.week !== report.week) await d.storage.put(K.previous, prev);
  await d.storage.put(K.report, report);
  st.phase = 'idle';
  st.nextRun = st.startedAt + WEEK;
  st.note = note;
  delete st.ticket;
  await d.notify?.('Offline brain training', note).catch(() => undefined);
  return { next: Math.max(60_000, st.nextRun - nowOf(d)), note };
}

// ---- SCHOOL: a paper on the free GPU, the honest gap, practice ------------------------------------------------

/** How long an exam run may wait for the week's run to leave Kaggle, and Kaggle's COMPLETE without its answers. */
const EXAM_WAIT_MAX = 16 * 3600_000;
const EXAM_GRACE = 20 * 60_000;
const EXAM_STATUS_ERRORS_MAX = 6;

/** Why Kaggle's GPU quota rules out sitting a paper there now, in plain words ('' when it does not). Refused, not waited for. */
export function examQuotaProblem(q: GpuQuota): string {
  if (q.payToScale) return "Kaggle's pay-to-scale is switched on for this account, so the free GPU could be charged: Ghosty will not use it. Turn it off on kaggle.com (Settings), or sit the paper on the phone.";
  if (q.total <= 0) return 'Kaggle gives this account no GPU time: verify your phone number on kaggle.com (Settings → Phone verification), or sit the paper on the phone.';
  if (q.left < EXAM_GPU_HOURS)
    return `Only ${hours(q.left)} of Kaggle's ${hours(q.total)} free GPU hours are left this week (a paper needs ${EXAM_GPU_HOURS}): sit it on the phone, or again when they come back${q.refreshAt ? `, ${new Date(q.refreshAt).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}.`;
  return '';
}

/**
 * SCHOOL's part of a job step, after the week's: the exam run (examStep), then the online model's sitting of a paper
 * (the gap) or practice for his weak spots, a few model calls each (none while the week is gathering: its own calls
 * come first). Never throws; returns when it wants the job back (ms), or null with nothing to do.
 */
async function schoolStep(d: CycleDeps): Promise<number | null> {
  let next: number | null = null;
  const want = (ms: number) => (next = next === null ? ms : Math.min(next, ms));
  try {
    const e = await examStep(d, nowOf(d));
    if (e !== null) want(e);
  } catch {
    /* examStep keeps its own errors */
  }
  if ((await loadState(d.storage)).phase === 'collect') return next;
  const sd = { storage: d.storage, ask: d.ask, now: d.now };
  try {
    const g = await gapTick(sd);
    if (g.more) want(g.noModel ? 20 * 60_000 : 5 * 60_000);
    if (g.calls || g.noModel) return next;
    const p = await practiceTick(sd);
    if (p.more) want(p.noModel ? 20 * 60_000 : 10 * 60_000);
  } catch {
    /* a model or storage blip: tried again at the next step */
  }
  return next;
}

/**
 * One step of a SCHOOL paper sat on Kaggle (asked for by POST /school/sit-remote, school/remote.ts):
 *   queued ──(keys, the week's run not on Kaggle, the GPU quota, the questions uploaded)──▶ running ──(the hook)──▶ idle
 * The quota is checked first and a run refused (not waited for) with fewer than EXAM_GPU_HOURS left or pay-to-scale on.
 * The paper's questions (never its answers) go to the PRIVATE dataset repo; the notebook is pushed in exam mode under
 * its own slug with a one-time ticket. A run that stops, or that Kaggle calls COMPLETE without its answers coming,
 * ends with the reason and the end of its log; nothing is pushed twice. Returns when to come back, or null.
 */
async function examStep(d: CycleDeps, now: number): Promise<number | null> {
  const s = d.storage;
  const r = await loadRemote(s);
  if (r.phase === 'idle') return null;
  const end = async (why: string): Promise<null> => {
    r.phase = 'idle';
    r.note = why;
    r.last = { paperId: r.paperId ?? '', title: r.title ?? '', at: now, error: why };
    delete r.ticket;
    delete r.completeAt;
    await stepSaveRemote(s, r);
    await d.notify?.('School', why).catch(() => undefined);
    return null;
  };
  const name = paperName(r);
  const keys = await keysOf(d);
  const f = fetchOf(d);
  if (r.phase === 'queued') {
    if (!keys.kaggle || !keys.hf) return end(`${name} could not be sat on the free GPU. ${missingNote(keys)}`);
    if (!d.origin) return end(`${name} could not be sat on the free GPU: the brain does not know its own address yet (open Ghosty once, then try again).`);
    const week = await loadState(s);
    if (week.phase === 'push' || week.phase === 'running') {
      if (now - (r.requestedAt ?? now) > EXAM_WAIT_MAX) return end(`${name} was not sat on the free GPU: the weekly training used it all this time. Sit it on the phone, or try again.`);
      r.note = `Waiting: the weekly training is on the free GPU; ${name} goes after it.`;
      await stepSaveRemote(s, r);
      return 30 * 60_000;
    }
    try {
      const no = examQuotaProblem(await kaggleQuota(f, keys.kaggle));
      if (no) return end(no);
      const rec = await loadPaper({ storage: s }, r.paperId ?? '');
      if (!rec) return end(`${name} could not be sat on the free GPU: the paper is not known any more.`);
      if (rec.result) return end(`${name} was handed in on the phone meanwhile; nothing was sat on the free GPU.`);
      const me = await hfWhoami(f, keys.hf);
      if (me.role === 'read') return end(`${name} could not be sat on the free GPU: the Hugging Face token can only read (make a write or fine-grained token as the steps in SYSTEM → KEYS say).`);
      const repo = `${me.name}/${DATA_REPO}`;
      await hfEnsurePrivateRepo(f, me, keys.hf, repo, 'dataset');
      // The questions only (school_paper.jsonl: id, q, type, options, marks, passage) — never the answers or mark schemes.
      const commit = await hfCommit(f, keys.hf, repo, 'dataset', [{ path: 'school_paper.jsonl', content: paperLines(rec.paper) }], `Ghosty: ${name} to sit (questions only)`);
      // The brain in use, as the phone has it: the stock Qwen3, or the trained week it was switched to.
      const base = await trainingBase(s, true);
      const active = await s.get<string | null>(K.active);
      r.model = `${base.label}${base.chain.length && active ? `@${active.slice(0, 7)}` : ''}`;
      r.ticket = randomTicket();
      r.ticketUntil = now + EXAM_LIMIT + 3600_000;
      r.tokenGiven = false;
      const config = {
        mode: 'exam',
        week: (await loadState(s)).week,
        hook: `${d.origin.replace(/\/$/, '')}/api/training/hook`,
        ticket: r.ticket,
        data_repo: repo,
        model_repo: `${me.name}/${MODEL_REPO}`,
        data_file: 'school_paper.jsonl',
        data_rev: commit,
        paper_id: r.paperId,
        model_label: r.model,
        base_model: BASE_MODEL,
        stock_mlc: STOCK_MLC,
        current: base,
        budget_hours: 1.5,
      };
      const k = await pushKernel(f, keys.kaggle, notebookSource(config), { slug: EXAM_SLUG, timeoutS: EXAM_GPU_HOURS * 3600 });
      r.phase = 'running';
      r.kernelUrl = k.url;
      r.pushedAt = now;
      r.statusErrors = 0;
      r.note = `Sitting ${name} on the free GPU`;
      await stepSaveRemote(s, r);
      return 5 * 60_000;
    } catch (e) {
      return end(`${name} could not be sat on the free GPU: ${e instanceof RemoteError ? e.message : String((e as Error)?.message ?? e).slice(0, 200)}`);
    }
  }
  // running
  if (now - (r.pushedAt ?? now) > EXAM_LIMIT) return end(`${name} on the free GPU did not send its answers back within ${EXAM_LIMIT / 3600_000} hours: given up.`);
  if (!keys.kaggle) return end(`${name} on the free GPU: the Kaggle key was taken away, so the run cannot be followed.`);
  try {
    const k = await kernelStatus(f, keys.kaggle, EXAM_SLUG);
    r.statusErrors = 0;
    if (k.state === 'error' || k.state === 'cancelled') {
      const tail = (await kernelOutput(f, keys.kaggle, EXAM_SLUG).catch(() => null))?.logTail;
      return end(`${name} on the free GPU stopped (${k.message || k.state}).${tail ? ` The end of its log: ${tail}` : ''}`);
    }
    if (k.state === 'complete') {
      r.completeAt ??= now;
      if (now - r.completeAt < EXAM_GRACE) {
        r.note = `Kaggle: ${name} is finished; waiting for its answers.`;
        await stepSaveRemote(s, r);
        return 5 * 60_000;
      }
      const out = await kernelOutput(f, keys.kaggle, EXAM_SLUG).catch(() => null);
      const err = out?.report?.error ? String(out.report.error).replace(/hf_[A-Za-z0-9]{8,}/g, 'hf_…').slice(0, 200) : '';
      return end(`${name} on the free GPU finished without sending its answers: ${err ? `the notebook stopped: ${err}` : 'they never reached Ghosty (no internet on Kaggle, or Ghosty could not be reached)'}.${out?.logTail ? ` The end of its log: ${out.logTail}` : ''}`);
    }
    delete r.completeAt;
    r.note = k.state === 'queued' ? `Waiting for a free Kaggle GPU for ${name}.` : `Sitting ${name} on the free GPU`;
    await stepSaveRemote(s, r);
    return 5 * 60_000;
  } catch (e) {
    r.statusErrors = (r.statusErrors ?? 0) + 1;
    if (r.statusErrors >= EXAM_STATUS_ERRORS_MAX) return end(`${name} on the free GPU: Kaggle could not be asked about the run ${EXAM_STATUS_ERRORS_MAX} times in a row (${e instanceof RemoteError ? e.message : 'no answer'}).`);
    await stepSaveRemote(s, r);
    return 10 * 60_000;
  }
}

// ---- the report comes back (the hook) ----------------------------------------------------------------------

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

const scoresOk = (s: unknown): s is AreaScores => !!s && typeof s === 'object' && Object.values(s as object).every((v) => typeof v === 'number' && v >= 0 && v <= 1);

/**
 * The notebook's only door, public like Telegram's webhook (index.ts forwards it without the owner's sign-in): a
 * request without this week's ticket in the `x-ghosty-ticket` header is turned away (a ticket in the address is
 * ignored: addresses end up in logs). GET trades the ticket for the Hugging Face token ONCE; POST brings progress
 * or the final report (after which the ticket is spent).
 */
export async function hookRoute(req: Request, d: CycleDeps): Promise<Response> {
  const t = req.headers.get('x-ghosty-ticket') ?? '';
  // A SCHOOL paper sat on Kaggle has its own one-time ticket (examHook); the week's is checked below as ever.
  const exam = await loadRemote(d.storage);
  if (exam.ticket && t && sameText(t, exam.ticket) && nowOf(d) <= (exam.ticketUntil ?? 0)) return examHook(req, d, exam);
  const st = await loadState(d.storage);
  if (!st.ticket || !t || !sameText(t, st.ticket) || nowOf(d) > (st.ticketUntil ?? 0)) return json({ error: 'not expected' }, 403);
  if (req.method === 'GET') {
    if (st.tokenGiven) return json({ error: 'already given' }, 403);
    const hf = (await d.vault.get('hf_write')) ?? '';
    if (!hf) return json({ error: 'no token saved' }, 404);
    st.tokenGiven = true;
    await saveState(d.storage, st);
    return json({ hf_token: hf });
  }
  if (req.method !== 'POST') return json({ error: 'not found' }, 404);
  const body = (await req.json().catch(() => null)) as { report?: TrainReport; progress?: { note?: string } } | null;
  if (body?.progress && !body.report) {
    st.note = `Training on Kaggle: ${String(body.progress.note ?? '').slice(0, 160)}`;
    await saveState(d.storage, st);
    return json({ ok: true });
  }
  const r = body?.report;
  if (!r || typeof r !== 'object' || !scoresOk(r.before) || !scoresOk(r.after)) return json({ error: 'not a report' }, 400);
  if (r.error && !Object.keys(r.after).length && (st.pushes ?? 0) < 3) {
    // It hit a problem before its exam (a Hugging Face 5xx, pip or node during set-up): pushed again by the next
    // job step, resuming from its checkpoint, like a run Kaggle stopped (three runs at most). Its ticket is spent.
    st.phase = 'push';
    delete st.ticket;
    delete st.completeAt;
    st.note = `The Kaggle run hit a problem (${String(r.error).slice(0, 160)}); starting it again from where it got to.`;
    await saveState(d.storage, st);
    return json({ ok: true, published: false });
  }
  const report = await acceptReport(d, st, r);
  return json({ ok: true, published: !!report.published });
}

/**
 * The exam run's side of the hook: GET trades its ticket for the Hugging Face token ONCE (to load the brain in use from
 * the private repos); POST brings progress, or the school report `{ kind: 'school', paperId, model, answers }`, which is
 * marked as a phone-sat paper is (school/remote.ts) and spends the ticket. Anything else is turned away.
 */
async function examHook(req: Request, d: CycleDeps, exam: RemoteState): Promise<Response> {
  if (req.method === 'GET') {
    if (exam.tokenGiven) return json({ error: 'already given' }, 403);
    const hf = (await d.vault.get('hf_write')) ?? '';
    if (!hf) return json({ error: 'no token saved' }, 404);
    exam.tokenGiven = true;
    await saveRemote(d.storage, exam);
    return json({ hf_token: hf });
  }
  if (req.method !== 'POST') return json({ error: 'not found' }, 404);
  const body = (await req.json().catch(() => null)) as { report?: { kind?: unknown; paperId?: unknown; answers?: unknown; error?: unknown }; progress?: { note?: string } } | null;
  if (body?.progress && !body.report) return json({ ok: true });
  const r = body?.report;
  if (!r || r.kind !== 'school') return json({ error: 'not a school report' }, 400);
  const got = await acceptRemoteReport({ storage: d.storage, ask: d.ask, now: d.now }, exam, r);
  return got.ok ? json({ ok: true }) : json({ error: got.error }, 400);
}

/** Check the report, keep it, and promote the new brain when it really passed (the same gate, applied here again). */
export async function acceptReport(d: CycleDeps, st: State, r: TrainReport): Promise<TrainReport> {
  const gate = gateVerdict(r.before, r.after, r.items ?? {});
  // A run that reported an error is never kept, whatever its exam said: its adapter (which every later week
  // rebuilds this brain from) may never have reached Hugging Face.
  const err = r.error ? String(r.error).slice(0, 300) : '';
  const report: TrainReport = {
    ...r,
    week: st.week,
    gate: {
      pass: gate.pass && !!r.gate?.pass && !err,
      why: gate.pass && !r.gate?.pass ? String(r.gate?.why ?? 'the notebook did not keep it') : gate.pass && err ? `the run reported a problem after its exam (${err.slice(0, 160)})` : gate.why,
    },
    rejected: [...((await d.storage.get<{ why: string; n: number }[]>(K.rejected)) ?? []), ...(Array.isArray(r.rejected) ? r.rejected : [])].slice(0, 40),
    failures: (r.failures ?? []).slice(0, 120),
  };
  let note: string;
  const expected = `${st.hfUser}/${MODEL_REPO}`;
  const claimed = r.published && /^[0-9a-f]{40}$/.test(String(r.published.commit)) && typeof r.published.repo === 'string' ? r.published : null;
  const pub = claimed && claimed.repo === expected ? claimed : null;
  if (claimed && !pub) report.rejected.push({ why: `the new brain was uploaded somewhere else (${String(claimed.repo).slice(0, 80)}), not to ${expected}: not used`, n: 1 });
  if (report.gate.pass && pub) {
    const models = await loadModels(d.storage);
    const base = st.base ?? { label: 'stock Qwen3 0.6B', chain: [] };
    const chain = [...base.chain, { adapter: `adapters/week-${wk(st.week)}`, scale: typeof r.scale === 'number' ? r.scale : 1, private: st.private !== false }];
    const kept: KeptModel = { week: st.week, label: `Ghosty (week ${st.week})`, repo: pub.repo, commit: pub.commit, at: nowOf(d), scores: r.after, private: chain.some((c) => c.private), chain };
    await d.storage.put(K.models, [kept, ...models.filter((m) => m.commit !== kept.commit)].slice(0, 3));
    await d.storage.put(K.active, kept.commit);
    // Promotion: a tag on the private model repo (the list above is what the phone's address serves; a failed tag changes nothing).
    const token = ((await d.vault.get('hf_write')) ?? '').trim();
    if (token) await hfTag(fetchOf(d), token, pub.repo, pub.commit, `week-${wk(st.week)}`).catch(() => undefined);
    note = `Ghosty (week ${st.week}) passed its exam and is ready: download it in SETTINGS → OFFLINE BRAIN.`;
  } else {
    // Not offered to the phone, whatever the notebook did.
    if (pub) report.rejected.push({ why: err ? `the new brain was uploaded (${pub.commit.slice(0, 7)}) but the run reported a problem: not offered to the phone` : `the new brain was uploaded (${pub.commit.slice(0, 7)}) but failed the exam check here: not offered to the phone`, n: 1 });
    delete report.published;
    note = r.error ? `This week's training did not finish: ${String(r.error).slice(0, 160)}` : `This week's training did not beat the current brain (${report.gate.why}); nothing changed.`;
  }
  // Only the ratings this week's data really held are used up; the others wait for the next week.
  const used = new Set(st.ratingIds ?? []);
  const ratings = await loadRatings(d.storage);
  for (const x of ratings) if (used.has(x.at)) x.used ??= st.week;
  await d.storage.put(K.ratings, ratings);
  await endWeek(d, st, report, note);
  await saveState(d.storage, st);
  return report;
}

// ---- the owner's side: status, ratings, GYM levels, TRAIN NOW, ROLLBACK ---------------------------------------

export async function loadModels(s: DurableObjectStorage): Promise<KeptModel[]> {
  return (await s.get<KeptModel[]>(K.models)) ?? [];
}
async function loadRatings(s: DurableObjectStorage): Promise<Rating[]> {
  return (await s.get<Rating[]>(K.ratings)) ?? [];
}

export async function trainStatus(d: CycleDeps): Promise<TrainStatus> {
  const s = d.storage;
  const st = await loadState(s);
  const keys = await keysOf(d);
  const gathered: Record<string, number> = {};
  if (st.phase === 'collect' || st.phase === 'upload') for (const k of KINDS) gathered[k] = await countOf(s, k);
  const jobs = (await loadJobs(s)).filter((j) => j.kind === 'train');
  const ratings = (await loadRatings(s)).filter((r) => !r.used);
  const models = await loadModels(s);
  const school = await practiceSummary(s).catch(() => null);
  return {
    keys: { kaggle: !!keys.kaggle, hf: !!keys.hf },
    phase: st.phase,
    note: !keys.kaggle || !keys.hf ? missingNote(keys) : st.note,
    week: st.week,
    next: st.phase === 'idle' ? st.nextRun || jobs[0]?.next || null : (jobs[0]?.next ?? null),
    gathered,
    report: (await s.get<TrainReport>(K.report)) ?? null,
    previous: (await s.get<TrainReport>(K.previous)) ?? null,
    models: models.map(({ chain: _c, ...m }) => m),
    active: (await s.get<string | null>(K.active)) ?? null,
    privateData: await privateOn(s),
    ratings: { up: ratings.filter((r) => r.up).length, down: ratings.filter((r) => !r.up).length },
    weights: models.length ? `/api/w/${await weightsCap(s)}/` : null,
    ...(school ? { school } : {}),
  };
}

/** Route `/training…` for the phone (owner only: behind the kernel's sign-in like every other route). */
export async function trainingRoute(req: Request, path: string, method: string, d: CycleDeps): Promise<Response> {
  const s = d.storage;
  if (path === '/training' && method === 'GET') return json(await trainStatus(d));
  const body = method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  if (path === '/training/feedback' && method === 'POST') {
    const at = Number(body.at);
    const question = String(body.question ?? '').slice(0, 2000);
    const reply = String(body.reply ?? '').slice(0, 3000);
    if (!Number.isFinite(at) || !reply.trim()) return json({ error: 'a rating needs the reply' }, 400);
    const list = (await loadRatings(s)).filter((r) => r.at !== at);
    if (body.up !== null && body.up !== undefined) list.push({ at, up: !!body.up, question, reply, ...(body.offline ? { offline: true } : {}) });
    await s.put(K.ratings, list.slice(-300));
    return json({ ok: true, ratings: list.length });
  }
  if (path === '/training/gym' && method === 'POST') {
    const levels: Record<string, number> = {};
    for (const [k, v] of Object.entries((body.levels ?? {}) as Record<string, unknown>)) if (/^[a-z0-9]{2,24}$/.test(k) && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10) levels[k] = v as number;
    await s.put(K.gym, levels);
    return json({ ok: true });
  }
  if (path === '/training/private' && method === 'POST') {
    await s.put(K.privateData, !!body.on);
    return json(await trainStatus(d));
  }
  if (path === '/training/revoke' && method === 'POST') {
    // Every weight address handed out before stops working; the phone gets the new one with this status.
    await revokeCap(s);
    return json(await trainStatus(d));
  }
  if (path === '/training/now' && method === 'POST') {
    const st = await loadState(s);
    const keys = await keysOf(d);
    if (!keys.kaggle || !keys.hf) return json({ error: missingNote(keys) }, 400);
    if (st.phase === 'idle') {
      st.nextRun = 0;
      st.note = 'Starting now.';
      await saveState(s, st);
    }
    await ensureTrainJob(s);
    const j = (await loadJobs(s)).find((x) => x.kind === 'train');
    if (j) {
      await setNext(s, j.id, Date.now() + 1000);
      await rearm(s);
    }
    return json(await trainStatus(d));
  }
  if (path === '/training/rollback' && method === 'POST') {
    const models = await loadModels(s);
    const active = await s.get<string | null>(K.active);
    const i = models.findIndex((m) => m.commit === active);
    if (i >= 0) {
      // The brain in use goes (it is never offered again); the next older good one, or the stock Qwen3 after the oldest.
      const rest = models.filter((_, k) => k !== i);
      await s.put(K.models, rest);
      await s.put(K.active, rest[i]?.commit ?? null);
    }
    return json(await trainStatus(d));
  }
  if (path === '/training/use' && method === 'POST') {
    const want = body.commit === null ? null : String(body.commit ?? '');
    if (want !== null && !(await loadModels(s)).some((m) => m.commit === want)) return json({ error: 'no such model' }, 404);
    await s.put(K.active, want);
    return json(await trainStatus(d));
  }
  return json({ error: 'not found' }, 404);
}

export { recordProblem };
