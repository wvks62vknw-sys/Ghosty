/**
 * The offline brain's weekly self-training, run by the brain on its own once the owner has saved two keys
 * (Kaggle and a Hugging Face write token). One standing job (kind `train`) steps through a week:
 *
 *   idle ──(the week is due, or TRAIN NOW)──▶ collect ──▶ upload ──▶ push ──▶ running ──(the report)──▶ idle
 *
 *  - collect: the data factory (factory.ts) — puzzle references, tool calls, chat distillation and red team at
 *    once (no model), then a few model calls at a time in the background lane (Evol-Instruct, library Q&A, better
 *    replies for 👎) every few minutes until the week's share is gathered or a day has passed;
 *  - upload: the week's JSONL, the exam and the GYM's task program to the owner's PRIVATE Hugging Face dataset
 *    repo, in one commit (why Hugging Face and not a Kaggle dataset: one documented commit call from a Worker,
 *    every week's file kept with its history for the replay mix, and the notebook needs Hugging Face anyway);
 *    both repos are checked to be private first (made private, or refused with the fix) — nothing of the owner's
 *    ever goes into a public repo;
 *  - push: the notebook (training/kaggle/ghosty_weekly.py) to the owner's Kaggle account with GPU and internet
 *    on, its settings written in, including a one-time ticket: the notebook trades it ONCE for the Hugging Face
 *    token at the hook (in a header, never in an address) and posts its report back with it;
 *  - running: the hook brings the report; meanwhile Kaggle's status is read every half hour (a failed status read
 *    is counted on its own: a few in a row do not end the week). A run that stopped is pushed again (it resumes
 *    from its checkpoint) twice at most.
 * The notebook uploads its candidate to the PRIVATE model repo (branch `candidates`); the brain checks the report
 * again with the same gate, that it is the expected repo, and only then promotes it (a tag, and the list the
 * phone's weight address serves: weights.ts). The last three good ones are kept; ROLLBACK drops the one in use and
 * goes back one (to the stock Qwen3 after the oldest).
 * With MY LIBRARY & CHATS off, a week's data has none of the owner's text, earlier private weeks are left out of
 * the replay, and the week trains on the newest kept brain whose whole chain had no private data (else stock).
 *
 * Every save made by a job step checks the state's generation first (`gen`): a step that started before the
 * report arrived cannot write its stale copy over it.
 */
import { gateVerdict, recordProblem, toJsonl, type AreaScores, type PublishedModel, type TrainPhase, type TrainRecord, type TrainReport, type TrainStatus } from '../../../../packages/shared/src/selftrain';
import type { ToolSpec } from '../../../../packages/shared/src/toolcall';
import type { Library } from '../library/store';
import { addJob, loadJobs, rearm, removeJob, setNext } from '../schedule';
import { GYM_SEEDS, NOTEBOOK_PY, TASKS_JS } from './assets';
import { buildExam, EXAM_VERSION, examTexts, libraryCase, type Exam } from './exam';
import {
  addRecords,
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
  libraryRecords,
  LIBRARY_SYSTEM,
  loadRecords,
  overlap,
  ownerPassages,
  ratingRecords,
  redteamRecords,
  REDTEAM_SYSTEM,
  RED_TEAM,
  syntheticToolRecords,
  tooClose,
  WEEKLY,
  WEEKLY_CALLS,
  type CtxMsg,
  type Rating,
} from './factory';
import { hfCommit, hfEnsurePrivateRepo, hfTag, hfWhoami, kernelStatus, parseKaggleKey, pushKernel, RemoteError } from './remote';
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

const KINDS = ['gym', 'drill', 'evol', 'library', 'tool', 'pref', 'failure', 'redteam', 'distill'];

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
  done: { free?: boolean; examLibrary?: boolean; examTarget?: number; examKeys?: string[]; prefIds?: number[]; library?: number; evol?: number; redteam?: number };
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
  /** Failed upload/push steps in a row, and failed status reads in a row (counted apart). */
  failures?: number;
  statusErrors?: number;
  hfUser?: string;
  /** The chain this week trains on (so the report adds to the right one). */
  base?: { label: string; chain: KeptModel['chain'] };
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

/** One step of the week. Never throws; returns when the job should run again (ms from now) and a line for the job list. */
export async function trainTick(d: CycleDeps): Promise<{ next: number; note: string }> {
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

/** The free part (no model) once, then a few model calls; the week's share or a day, whichever comes first. */
async function collect(d: CycleDeps, st: State, now: number): Promise<{ next: number; note: string }> {
  const s = d.storage;
  const priv = st.private !== false;
  const exam = await loadExam(d);
  const held = new Set(exam.library.map((c) => c.key));
  if (!st.done.free) {
    const levels = (await s.get<Record<string, number>>(K.gym)) ?? {};
    const games = [...new Set(GYM_SEEDS.map((g) => g.game))];
    await addRecords(s, 'gym', gymTasks(levels, games, st.week));
    await addRecords(s, 'drill', drillTasks(st.week));
    const syn = syntheticToolRecords(d.tools, st.week);
    await addRecords(s, 'tool', syn.recs);
    await noteRejected(s, 'synthetic tool calls that failed the schema check', syn.rejected);
    await addRecords(s, 'redteam', redteamRecords());
    await addRecords(s, 'failure', failureRecords((await s.get<TrainReport>(K.report)) ?? null));
    if (priv) {
      const ctx = (await s.get<CtxMsg[]>('ctx')) ?? []; // agent.ts CTX_KEY: the conversation the model reads
      await addRecords(s, 'tool', chatToolRecords(ctx, d.tools));
      const turns = (await s.get<{ role: 'user' | 'assistant'; text: string; model?: string }[]>('turns')) ?? []; // agent.ts TURNS_KEY
      const ratings = await loadRatings(s);
      const disliked = new Set(ratings.filter((r) => !r.up).map((r) => r.reply.trim()));
      await addRecords(s, 'distill', distillRecords(turns, disliked));
      // 👍 need no model: they go in now (and only these are marked used when the week ends).
      const ups = ratings.filter((r) => r.up && !r.used);
      await addRecords(s, 'pref', ups.flatMap((r) => ratingRecords(r)));
      st.ratingIds = [...(st.ratingIds ?? []), ...ups.map((r) => r.at)];
    }
    st.done.free = true;
    await stepSave(s, st);
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
  if (!st.done.examLibrary && st.done.examTarget >= 2) return { next: noModel ? 20 * 60_000 : 2 * 60_000, note: "Gathering: writing the exam's library questions first." };
  const lib = passages.filter((p) => !tried.has(p.key));
  const examQs = examTexts(exam, st.week);
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
      const near = tooClose(r.messages![r.messages!.length - 2]!.content, examQs);
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
    const near = rec ? tooClose(rec.messages![1]!.content, examQs) : '';
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
    if (v.length >= 12 && v.length <= 600 && v !== q && !tooClose(v, examQs)) await addRecords(s, 'redteam', redteamRecords([[v, a]]).slice(-1));
    else await noteRejected(s, 'red-team rewordings that were unusable or too close to an exam question');
    st.done.redteam = i + 1;
  }
  const finished = (st.done.evol ?? 0) >= seeds.length && (st.done.redteam ?? 0) >= WEEKLY.redteamEvol && ((st.done.library ?? 0) >= lib.length || (await countOf(s, 'library')) >= WEEKLY.library);
  if (finished || st.calls >= WEEKLY_CALLS || now - st.startedAt > COLLECT_FOR) {
    st.phase = 'upload';
    return { next: 60_000, note: `Gathered this week's lessons (${st.calls} questions to the online AIs). Uploading them to your private Hugging Face space.` };
  }
  return { next: noModel ? 20 * 60_000 : 5 * 60_000, note: noModel ? 'Gathering: no free online AI right now, trying again soon.' : `Gathering this week's lessons (${st.calls} questions to the online AIs so far).` };
}

async function countOf(s: DurableObjectStorage, kind: string): Promise<number> {
  return (await loadRecords(s, kind)).length;
}

// ---- upload and push ----------------------------------------------------------------------------------------

async function upload(d: CycleDeps, st: State, token: string): Promise<{ next: number; note: string }> {
  const f = fetchOf(d);
  const me = await hfWhoami(f, token);
  if (me.role === 'read') throw new RemoteError('the Hugging Face token can only read: make a write (or fine-grained) token as the steps say.');
  st.hfUser = me.name;
  // Both repos private before anything of the owner's is sent (made so, or refused with the fix).
  await hfEnsurePrivateRepo(f, me, token, `${me.name}/${DATA_REPO}`, 'dataset');
  await hfEnsurePrivateRepo(f, me, token, `${me.name}/${MODEL_REPO}`, 'model');
  const all: TrainRecord[] = [];
  for (const k of KINDS) all.push(...(await loadRecords(d.storage, k)));
  const { text, kept, dropped } = toJsonl(all);
  for (const x of dropped) await noteRejected(d.storage, `bad records: ${x.why}`, x.n);
  const exam = await loadExam(d);
  st.dataFile = `weeks/week-${wk(st.week)}.jsonl`;
  st.dataCommit = await hfCommit(f, token, `${me.name}/${DATA_REPO}`, 'dataset', [
    { path: st.dataFile, content: text },
    { path: 'exam.json', content: JSON.stringify(exam) },
    { path: 'tasks.mjs', content: TASKS_JS },
  ], `Ghosty week ${st.week}: ${kept} examples`);
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

async function push(d: CycleDeps, st: State, kaggle: NonNullable<ReturnType<typeof parseKaggleKey>>, now: number): Promise<{ next: number; note: string }> {
  if (!d.origin) throw new RemoteError('the brain does not know its own address yet: open Ghosty once, then press TRAIN NOW.');
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
  st.phase = 'running';
  return { next: 30 * 60_000, note: `Training on Kaggle (run ${r.version}). It takes a few hours.` };
}

const randomTicket = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');

async function watch(d: CycleDeps, st: State, kaggle: NonNullable<ReturnType<typeof parseKaggleKey>>, now: number): Promise<{ next: number; note: string }> {
  if (now - (st.pushedAt ?? now) > RUN_LIMIT) return endWeek(d, st, failedReport(st, 'the Kaggle run did not report back within 14 hours', now), 'The Kaggle run did not report back: given up for this week.');
  const k = await kernelStatus(fetchOf(d), kaggle);
  st.statusErrors = 0;
  if (k.state === 'error' || k.state === 'cancelled') {
    if ((st.pushes ?? 0) < 3) {
      st.phase = 'push';
      return { next: 5 * 60_000, note: `The Kaggle run stopped (${k.message || k.state}); starting it again from where it got to.` };
    }
    return endWeek(d, st, failedReport(st, `the Kaggle run stopped: ${k.message || k.state}`, now), 'The Kaggle run stopped three times: given up for this week.');
  }
  if (k.state === 'complete' && now - (st.pushedAt ?? now) > RUN_LIMIT / 2) return endWeek(d, st, failedReport(st, 'the run finished but its report never arrived', now), 'The Kaggle run finished but sent no report.');
  return { next: 30 * 60_000, note: k.state === 'queued' ? 'Waiting for a free Kaggle GPU.' : 'Training on Kaggle…' };
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
  const st = await loadState(d.storage);
  const t = req.headers.get('x-ghosty-ticket') ?? '';
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
  const report = await acceptReport(d, st, r);
  return json({ ok: true, published: !!report.published });
}

/** Check the report, keep it, and promote the new brain when it really passed (the same gate, applied here again). */
export async function acceptReport(d: CycleDeps, st: State, r: TrainReport): Promise<TrainReport> {
  const gate = gateVerdict(r.before, r.after, r.items ?? {});
  const report: TrainReport = {
    ...r,
    week: st.week,
    gate: { pass: gate.pass && !!r.gate?.pass, why: gate.pass && !r.gate?.pass ? String(r.gate?.why ?? 'the notebook did not keep it') : gate.why },
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
    if (pub) report.rejected.push({ why: `the new brain was uploaded (${pub.commit.slice(0, 7)}) but failed the exam check here: not offered to the phone`, n: 1 });
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
