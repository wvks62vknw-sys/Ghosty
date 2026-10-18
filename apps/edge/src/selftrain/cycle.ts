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
 *    every week's file kept with its history for the replay mix, and the notebook needs Hugging Face anyway to
 *    publish; Kaggle's dataset upload is a multi-step blob protocol);
 *  - push: the notebook (training/kaggle/ghosty_weekly.py) to the owner's Kaggle account with GPU and internet
 *    on, its settings written in, including a one-time ticket: the notebook trades the ticket for the Hugging
 *    Face token at the hook (so no lasting secret is stored at Kaggle) and posts its report back with it;
 *  - running: the hook brings the report; meanwhile Kaggle's status is read every half hour. A run that
 *    stopped is pushed again (it resumes from its checkpoint) twice at most.
 * The report is checked again with the same gate before the new brain is offered to the phone; the last three
 * good ones are kept and ROLLBACK goes one back (to the stock Qwen3 after the oldest).
 */
import { gateVerdict, recordProblem, toJsonl, type AreaScores, type PublishedModel, type TrainPhase, type TrainRecord, type TrainReport, type TrainStatus } from '../../../../packages/shared/src/selftrain';
import type { ToolSpec } from '../../../../packages/shared/src/toolcall';
import type { Library } from '../library/store';
import { addJob, loadJobs, rearm, removeJob, setNext } from '../schedule';
import { GYM_SEEDS, NOTEBOOK_PY, TASKS_JS } from './assets';
import { buildExam, libraryCase, type Exam } from './exam';
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
  ownerPassages,
  ratingRecords,
  redteamRecords,
  REDTEAM_SYSTEM,
  RED_TEAM,
  syntheticToolRecords,
  WEEKLY,
  WEEKLY_CALLS,
  type CtxMsg,
  type Rating,
} from './factory';
import { hfCommit, hfEnsureRepo, hfWhoami, kernelStatus, parseKaggleKey, pushKernel, RemoteError } from './remote';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** The base model and the stock phone build (apps/web/src/offline/models.ts pins the same commit). */
export const BASE_MODEL = { repo: 'Qwen/Qwen3-0.6B', rev: 'c1899de289a04d12100db370d81485cdf75e47ca' };
export const STOCK_MLC = { repo: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', rev: '8c14ce481d4c692769976ad52afea453a102df19' };
/** The repos on the owner's Hugging Face account. */
export const DATA_REPO = 'ghosty-training';
export const MODEL_REPO = 'ghosty-offline-brain';
/** Gathering stops this long after it began, with whatever it has. */
const COLLECT_FOR = DAY;
/** A run that has not reported after this long is given up. */
const RUN_LIMIT = 14 * 3600_000;
/** The notebook's time budget (Kaggle's session limit is 12 h; this leaves margin). */
const BUDGET_HOURS = 9;
/** Model calls per alarm run while gathering (each waits briefly for room in the background lane). */
const CALLS_PER_TICK = 4;

const KINDS = ['gym', 'drill', 'evol', 'library', 'tool', 'pref', 'failure', 'redteam', 'distill'];

/** A published model as the brain keeps it: plus the LoRA chain that rebuilds it (for the next week's training). */
export interface KeptModel extends PublishedModel {
  chain: { adapter: string; scale: number }[];
}

interface State {
  phase: TrainPhase;
  week: number;
  /** When the next weekly run may start. */
  nextRun: number;
  startedAt: number;
  note: string;
  /** Model calls made this week, and how far each kind of gathering got. */
  calls: number;
  done: { free?: boolean; examLibrary?: boolean; prefs?: number; library?: number; evol?: number; redteam?: number };
  ticket?: string;
  ticketUntil?: number;
  dataCommit?: string;
  dataFile?: string;
  kernelUrl?: string;
  pushedAt?: number;
  pushes?: number;
  hfUser?: string;
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

async function loadState(s: DurableObjectStorage): Promise<State> {
  return (await s.get<State>(K.state)) ?? { phase: 'idle', week: 0, nextRun: 0, startedAt: 0, note: 'Not started yet.', calls: 0, done: {} };
}
const saveState = (s: DurableObjectStorage, st: State) => s.put(K.state, st);

async function keysOf(d: CycleDeps): Promise<{ kaggle: ReturnType<typeof parseKaggleKey>; hf: string }> {
  const [k, h] = await Promise.all([d.vault.get('kaggle').catch(() => null), d.vault.get('hf_write').catch(() => null)]);
  return { kaggle: k ? parseKaggleKey(k) : null, hf: (h ?? '').trim() };
}

const missingNote = (k: { kaggle: unknown; hf: string }) =>
  !k.kaggle && !k.hf ? 'Waiting for two keys: Kaggle and a Hugging Face write token (SYSTEM → KEYS).' : !k.kaggle ? 'Waiting for the Kaggle key (SYSTEM → KEYS).' : 'Waiting for the Hugging Face write token (SYSTEM → KEYS).';

// ---- the job ------------------------------------------------------------------------------------------------

export const TRAIN_JOB = { kind: 'train' as const, title: 'Offline brain training', text: 'Gather the week\'s training data, train the offline brain on Kaggle, and publish it if it passes the exam.' };

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
  try {
    const r = await step(d, st);
    st.note = r.note;
    await saveState(d.storage, st);
    return r;
  } catch (e) {
    const msg = e instanceof RemoteError ? e.message : String((e as Error)?.message ?? e).slice(0, 300);
    st.note = `Stopped: ${msg}`;
    // A failure while uploading or pushing is tried again in an hour; three in a row end the week.
    st.pushes = (st.pushes ?? 0) + 1;
    if (st.pushes >= 3 || st.phase === 'collect') {
      await endWeek(d, st, failedReport(st, msg, nowOf(d)), `This week's training stopped: ${msg}`);
      st.note = `Stopped: ${msg}`;
    }
    await saveState(d.storage, st);
    return { next: 3600_000, note: st.note };
  }
}

function failedReport(st: State, why: string, now: number): TrainReport {
  return { week: st.week, startedAt: st.startedAt, finishedAt: now, base: '', before: {}, after: {}, items: {}, gate: { pass: false, why: 'the run did not finish' }, trained: {}, rejected: [], phases: [], error: why };
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
    st.pushes = 0;
    delete st.ticket;
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
  if (!e) {
    e = buildExam(d.tools);
    await d.storage.put(K.exam, e);
  }
  return e;
}

/** The free part (no model) once, then a few model calls; the week's share or a day, whichever comes first. */
async function collect(d: CycleDeps, st: State, now: number): Promise<{ next: number; note: string }> {
  const s = d.storage;
  const priv = await privateOn(s);
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
      // 👍 need no model: they go in now.
      await addRecords(s, 'pref', ratings.filter((r) => r.up && !r.used).flatMap((r) => ratingRecords(r)));
    }
    st.done.free = true;
    await saveState(s, st);
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
  // 1. the exam's library questions, once (held out from training for good)
  if (!st.done.examLibrary && passages.length >= 6 && room()) {
    const cases = [];
    for (const p of passages.slice(0, 6)) {
      if (!room()) break;
      const reply = await call(LIBRARY_SYSTEM, `${p.title}\n\n${p.text}`);
      if (reply === null) {
        noModel = true;
        break;
      }
      const qa = ((jsonIn(reply)?.qa ?? []) as { q?: unknown; a?: unknown }[]).filter((x) => typeof x?.q === 'string' && typeof x?.a === 'string');
      for (const x of qa.slice(0, 2)) cases.push(libraryCase(p, String(x.q), String(x.a)));
    }
    if (cases.length) {
      exam.library = cases.slice(0, 12);
      await s.put(K.exam, exam);
      st.done.examLibrary = true;
    }
  }
  const lib = passages.filter((p) => !new Set(exam.library.map((c) => c.key)).has(p.key));
  // 2. better replies for the owner's 👎
  if (priv && !noModel) {
    const downs = (await loadRatings(s)).filter((r) => !r.up && !r.used).slice(0, WEEKLY.pref);
    for (let i = st.done.prefs ?? 0; i < downs.length && room(); i++) {
      const better = await call(BETTER_SYSTEM, betterPrompt(downs[i]!));
      if (better === null) {
        noModel = true;
        break;
      }
      const recs = ratingRecords(downs[i]!, better);
      if (!recs.length) await noteRejected(s, 'better replies that were no better (refused, or the same)');
      for (const r of recs) await addRecords(s, r.kind, [r]);
      st.done.prefs = i + 1;
    }
  }
  // 3. library question/answer pairs from the owner's passages
  for (let i = st.done.library ?? 0; i < lib.length && !noModel && room() && ((await countOf(s, 'library')) < WEEKLY.library); i++) {
    const p = lib[i]!;
    const reply = await call(LIBRARY_SYSTEM, `${p.title}\n\n${p.text}`);
    if (reply === null) {
      noModel = true;
      break;
    }
    const recs = libraryRecords(p, reply, lib[(i + 1) % lib.length]);
    if (!recs.length) await noteRejected(s, 'library answers not found in their passage');
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
    if (rec) await addRecords(s, 'evol', [rec]);
    else await noteRejected(s, `evolved tasks dropped: ${why}`);
    st.done.evol = i + 1;
  }
  // 5. red-team rewordings (the refusal stays Ghosty's own)
  for (let i = st.done.redteam ?? 0; i < WEEKLY.redteamEvol && !noModel && room(); i++) {
    const [q, a] = RED_TEAM[i % RED_TEAM.length]!;
    const reply = await call(REDTEAM_SYSTEM, q);
    if (reply === null) {
      noModel = true;
      break;
    }
    const v = reply.trim().replace(/^["“]|["”]$/g, '');
    if (v.length >= 12 && v.length <= 600 && v !== q) await addRecords(s, 'redteam', redteamRecords([[v, a]]).slice(-1));
    else await noteRejected(s, 'red-team rewordings that were unusable');
    st.done.redteam = i + 1;
  }
  const finished = (st.done.evol ?? 0) >= seeds.length && (st.done.redteam ?? 0) >= WEEKLY.redteamEvol && ((st.done.library ?? 0) >= lib.length || (await countOf(s, 'library')) >= WEEKLY.library);
  if (finished || st.calls >= WEEKLY_CALLS || now - st.startedAt > COLLECT_FOR) {
    st.phase = 'upload';
    return { next: 60_000, note: `Gathered this week's data (${st.calls} model calls). Uploading it.` };
  }
  return { next: noModel ? 20 * 60_000 : 5 * 60_000, note: noModel ? 'Gathering: no free AI model right now, trying again soon.' : `Gathering this week's training data (${st.calls} model calls so far).` };
}

async function countOf(s: DurableObjectStorage, kind: string): Promise<number> {
  return (await loadRecords(s, kind)).length;
}

// ---- upload and push ----------------------------------------------------------------------------------------

async function upload(d: CycleDeps, st: State, token: string): Promise<{ next: number; note: string }> {
  const f = fetchOf(d);
  const me = await hfWhoami(f, token);
  if (!me.write) throw new RemoteError('the Hugging Face token can only read: make a "Write" token.');
  st.hfUser = me.name;
  const all: TrainRecord[] = [];
  for (const k of KINDS) all.push(...(await loadRecords(d.storage, k)));
  const { text, kept, dropped } = toJsonl(all);
  for (const x of dropped) await noteRejected(d.storage, `bad records: ${x.why}`, x.n);
  const exam = await loadExam(d);
  await hfEnsureRepo(f, token, `${me.name}/${DATA_REPO}`, 'dataset', true);
  await hfEnsureRepo(f, token, `${me.name}/${MODEL_REPO}`, 'model', false);
  st.dataFile = `weeks/week-${String(st.week).padStart(4, '0')}.jsonl`;
  st.dataCommit = await hfCommit(f, token, `${me.name}/${DATA_REPO}`, 'dataset', [
    { path: st.dataFile, content: text },
    { path: 'exam.json', content: JSON.stringify(exam) },
    { path: 'tasks.mjs', content: TASKS_JS },
  ], `Ghosty week ${st.week}: ${kept} examples`);
  st.phase = 'push';
  st.pushes = 0;
  return { next: 60_000, note: `Uploaded ${kept} examples to your private Hugging Face dataset. Starting the Kaggle run.` };
}

/** The notebook as pushed: its settings written into the CONFIG_JSON line. */
export function notebookSource(config: Record<string, unknown>): string {
  const line = `CONFIG_JSON = ${JSON.stringify(JSON.stringify(config))}  # GHOSTY-CONFIG: written by the brain`;
  const out = NOTEBOOK_PY.replace(/^CONFIG_JSON = None\b.*$/m, line);
  if (out === NOTEBOOK_PY) throw new Error('the notebook has no CONFIG_JSON line');
  return out;
}

async function push(d: CycleDeps, st: State, kaggle: NonNullable<ReturnType<typeof parseKaggleKey>>, now: number): Promise<{ next: number; note: string }> {
  const models = await loadModels(d.storage);
  const active = await d.storage.get<string | null>(K.active);
  const cur = models.find((m) => m.commit === active);
  st.ticket = randomTicket();
  st.ticketUntil = now + RUN_LIMIT + 3600_000;
  const config = {
    week: st.week,
    hook: `${d.origin.replace(/\/$/, '')}/api/training/hook`,
    ticket: st.ticket,
    data_repo: `${st.hfUser}/${DATA_REPO}`,
    model_repo: `${st.hfUser}/${MODEL_REPO}`,
    data_file: st.dataFile,
    data_rev: st.dataCommit,
    base_model: BASE_MODEL,
    stock_mlc: STOCK_MLC,
    current: cur ? { label: cur.label, chain: cur.chain } : { label: 'stock Qwen3 0.6B', chain: [] },
    budget_hours: BUDGET_HOURS,
    samples: 16,
  };
  if (!d.origin) throw new RemoteError("the brain does not know its own address yet: open Ghosty once, then press TRAIN NOW.");
  const r = await pushKernel(fetchOf(d), kaggle, notebookSource(config));
  st.kernelUrl = r.url;
  st.pushedAt = now;
  st.pushes = (st.pushes ?? 0) + 1;
  st.phase = 'running';
  return { next: 30 * 60_000, note: `Training on Kaggle (version ${r.version}). It takes a few hours.` };
}

const randomTicket = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');

async function watch(d: CycleDeps, st: State, kaggle: NonNullable<ReturnType<typeof parseKaggleKey>>, now: number): Promise<{ next: number; note: string }> {
  if (now - (st.pushedAt ?? now) > RUN_LIMIT) return endWeek(d, st, failedReport(st, 'the Kaggle run did not report back within 14 hours', now), 'The Kaggle run did not report back: given up for this week.');
  const k = await kernelStatus(fetchOf(d), kaggle);
  if (k.state === 'error' || k.state === 'cancelled') {
    if ((st.pushes ?? 0) < 3) {
      st.phase = 'push';
      return { next: 5 * 60_000, note: `The Kaggle run stopped (${k.message || k.state}); starting it again from its last checkpoint.` };
    }
    return endWeek(d, st, failedReport(st, `the Kaggle run stopped: ${k.message || k.state}`, now), 'The Kaggle run stopped three times: given up for this week.');
  }
  if (k.state === 'complete' && now - (st.pushedAt ?? now) > 30 * 60_000) {
    // Finished but no report reached the hook (the brain was paused?): one more look in an hour, then give up.
    if (now - (st.pushedAt ?? now) > RUN_LIMIT / 2) return endWeek(d, st, failedReport(st, 'the run finished but its report never arrived', now), 'The Kaggle run finished but sent no report.');
  }
  return { next: 30 * 60_000, note: k.state === 'queued' ? 'Waiting for a free Kaggle GPU.' : 'Training on Kaggle…' };
}

async function endWeek(d: CycleDeps, st: State, report: TrainReport, note: string): Promise<{ next: number; note: string }> {
  const prev = await d.storage.get<TrainReport>(K.report);
  if (prev && prev.week !== report.week) await d.storage.put(K.previous, prev);
  await d.storage.put(K.report, report);
  st.phase = 'idle';
  st.nextRun = st.startedAt + WEEK;
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
 * The notebook's only door, public like Telegram's webhook (index.ts forwards it without the owner's sign-in):
 * a request without this week's ticket is turned away. GET trades the ticket for the Hugging Face token while
 * the run is on; POST brings progress or the final report (after which the ticket is spent).
 */
export async function hookRoute(req: Request, d: CycleDeps): Promise<Response> {
  const url = new URL(req.url);
  const st = await loadState(d.storage);
  const t = url.searchParams.get('t') ?? '';
  if (!st.ticket || !t || !sameText(t, st.ticket) || nowOf(d) > (st.ticketUntil ?? 0)) return json({ error: 'not expected' }, 403);
  if (req.method === 'GET') {
    const hf = (await d.vault.get('hf_write')) ?? '';
    return hf ? json({ hf_token: hf }) : json({ error: 'no token saved' }, 404);
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

/** Check the report, keep it, and offer the new brain when it really passed (the same gate, applied here again). */
export async function acceptReport(d: CycleDeps, st: State, r: TrainReport): Promise<TrainReport> {
  const gate = gateVerdict(r.before, r.after);
  const report: TrainReport = {
    ...r,
    week: st.week,
    gate: { pass: gate.pass && !!r.gate?.pass, why: gate.pass && !r.gate?.pass ? String(r.gate?.why ?? 'the notebook did not publish it') : gate.why },
    rejected: [...((await d.storage.get<{ why: string; n: number }[]>(K.rejected)) ?? []), ...(Array.isArray(r.rejected) ? r.rejected : [])].slice(0, 40),
    failures: (r.failures ?? []).slice(0, 120),
  };
  let note: string;
  const pub = r.published && /^[0-9a-f]{40}$/.test(String(r.published.commit)) && typeof r.published.repo === 'string' ? r.published : null;
  if (report.gate.pass && pub) {
    const models = await loadModels(d.storage);
    const active = await d.storage.get<string | null>(K.active);
    const cur = models.find((m) => m.commit === active);
    const kept: KeptModel = {
      week: st.week,
      label: `Ghosty (week ${st.week})`,
      repo: pub.repo,
      commit: pub.commit,
      at: nowOf(d),
      scores: r.after,
      chain: [...(cur?.chain ?? []), { adapter: `adapters/week-${String(st.week).padStart(4, '0')}`, scale: typeof r.scale === 'number' ? r.scale : 1 }],
    };
    await d.storage.put(K.models, [kept, ...models.filter((m) => m.commit !== kept.commit)].slice(0, 3));
    await d.storage.put(K.active, kept.commit);
    note = `Ghosty (week ${st.week}) passed the exam (${report.gate.why}) and is ready: download it in SETTINGS → OFFLINE BRAIN.`;
  } else {
    if (!pub) delete report.published;
    note = r.error ? `This week's training did not finish: ${String(r.error).slice(0, 160)}` : `This week's training did not beat the current brain (${report.gate.why}); nothing changed.`;
  }
  // The ratings this run learned from are not used again.
  const ratings = await loadRatings(d.storage);
  for (const x of ratings) x.used ??= st.week;
  await d.storage.put(K.ratings, ratings);
  await endWeek(d, st, report, note);
  await saveState(d.storage, { ...st, note });
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
  return {
    keys: { kaggle: !!keys.kaggle, hf: !!keys.hf },
    phase: st.phase,
    note: !keys.kaggle || !keys.hf ? missingNote(keys) : st.note,
    week: st.week,
    next: st.phase === 'idle' ? (st.nextRun || jobs[0]?.next || null) : (jobs[0]?.next ?? null),
    gathered,
    report: (await s.get<TrainReport>(K.report)) ?? null,
    previous: (await s.get<TrainReport>(K.previous)) ?? null,
    models: (await loadModels(s)).map(({ chain: _c, ...m }) => m),
    active: (await s.get<string | null>(K.active)) ?? null,
    privateData: await privateOn(s),
    ratings: { up: ratings.filter((r) => r.up).length, down: ratings.filter((r) => !r.up).length },
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
    const jobs = await loadJobs(s);
    const j = jobs.find((x) => x.kind === 'train');
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
    // One step back: the next older good model, or the stock Qwen3 after the oldest.
    const to = i < 0 ? null : (models[i + 1]?.commit ?? null);
    await s.put(K.active, to);
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
