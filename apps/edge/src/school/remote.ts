/**
 * SCHOOL on the free GPU, and the honest gap.
 *
 *  - A PAPER SAT ON KAGGLE: the same weights as the phone (the brain in use: stock Qwen3, or the trained week the
 *    phone has) sit a paper on Kaggle's free GPU, so a whole paper takes minutes, not an evening on the phone.
 *    POST /school/sit-remote { stage, subject } sets the paper through the very route the phone sits with (POST
 *    /school/sit: Ghosty's own papers, a checked bank or an official paper, whichever that route picks) and asks for
 *    a run; the weekly training's job does the rest (selftrain/cycle.ts: Kaggle's GPU hours first, the paper's
 *    questions — never its answers — to the PRIVATE dataset repo, the notebook in exam mode under its own slug
 *    `ghosty-exam`, one at a time, then watching it). The notebook posts his answers to the training hook with the
 *    run's one-time ticket (`acceptRemoteReport`); they are marked there as a phone-sat paper is (school/mark.ts) and
 *    kept with `where: 'kaggle'`. GET /school/remote says how it is going ("Sitting GCSE maths on the free GPU ·
 *    started 2 min ago · about 10 minutes").
 *  - THE HONEST GAP (`gapTick`, a step of the same job): once a paper has been sat, the strongest free online model
 *    sits the same items once, asked the same way (`examMessages`), marked the same way, a few calls a step (cached
 *    per paper, resumable); the result goes on the paper's result as `online` ("offline 14/40 · online 36/40"). It is
 *    SCHOOL's own measure: never the exam gate, and nothing the online model wrote is ever trained on (it is kept
 *    only under `school:online:<paper>`, which practice and the weekly data never read).
 *
 * Why two halves: the school record is mirrored to KV (state.ts `durablePut`) so it survives the database pause, and
 * only SCHOOL's own routes are handed KV. The training's job and its hook write here, in the database only
 * (`school:remote`, `school:online:*`); a result is FILED into the school record (and KV) by `fileRemote`, which the
 * two routes below run first, under SCHOOL's one-change-at-a-time lock.
 */
import { boundaryLine, examMessages, scorePaper, SUBJECT_LABEL, type OnlineMark, type PaperResult, type StageId } from '../../../../packages/shared/src/school';
import { loadJobs, rearm, setNext } from '../schedule';
import { keepGiven, markPaper, retryPending, type Ask } from './mark';
import { stageName, type SchoolPaper } from './papers';
import { applyResult, loadPaper, loadState, newsFor, savePaper, saveState, type Store } from './state';

export const REMOTE_KEY = 'school:remote';
export const ONLINE_PREFIX = 'school:online:';
/** Free GPU hours an exam run needs left (the push asks Kaggle for this much; a paper takes minutes). */
export const EXAM_GPU_HOURS = 2;
/** A run that has not reported after this long is given up. */
export const EXAM_LIMIT = 3 * 3600_000;
/** Set-up on Kaggle (packages, the model) and the time a question takes there, for "about N minutes". */
const SETUP_MIN = 8;
const MIN_PER_ITEM = 0.15;
/** How long one marking call in the hook may take (the notebook waits for the answer); slower ones wait as pending. */
const MARK_WAIT_MS = 20_000;
/** The gap: model calls a step and a day, and how old a result may be to be compared. */
export const GAP_PER_STEP = 4;
export const GAP_PER_DAY = 60;
const GAP_MAX_AGE = 60 * 86_400_000;
/** Who sat the paper for the gap (the brain asks the background lane's strongest tier; it is not told which one answered). */
export const ONLINE_LABEL = 'the strongest free online model';

export type RemotePhase = 'idle' | 'queued' | 'running';

export interface RemoteState {
  phase: RemotePhase;
  /** Bumped by every save: a job step's save is refused when the hook or a route saved since it read this. */
  gen?: number;
  note: string;
  paperId?: string;
  stage?: StageId;
  subject?: string;
  title?: string;
  items?: number;
  requestedAt?: number;
  pushedAt?: number;
  completeAt?: number;
  statusErrors?: number;
  ticket?: string;
  ticketUntil?: number;
  tokenGiven?: boolean;
  /** The brain that sat it ('Ghosty (week 3)@abc1234', 'stock Qwen3 0.6B'). */
  model?: string;
  kernelUrl?: string;
  /** A marked result waiting to be filed into the school record (fileRemote). */
  unfiled?: { result: PaperResult; given: Record<string, string>; model: string };
  /** The last run, in a line. */
  last?: { paperId: string; title: string; at: number; raw?: number; max?: number; grade?: string; error?: string };
}

export async function loadRemote(s: DurableObjectStorage): Promise<RemoteState> {
  return (await s.get<RemoteState>(REMOTE_KEY)) ?? { phase: 'idle', gen: 0, note: 'Not used yet.' };
}
/** A save by the hook or a route: always lands. */
export async function saveRemote(s: DurableObjectStorage, r: RemoteState): Promise<void> {
  const cur = await loadRemote(s);
  r.gen = Math.max(cur.gen ?? 0, r.gen ?? 0) + 1;
  await s.put(REMOTE_KEY, r);
}
/** A job step's save: refused (false) when someone else saved since the step read it. */
export async function stepSaveRemote(s: DurableObjectStorage, r: RemoteState): Promise<boolean> {
  const cur = await loadRemote(s);
  if ((cur.gen ?? 0) !== (r.gen ?? 0)) return false;
  r.gen = (r.gen ?? 0) + 1;
  await s.put(REMOTE_KEY, r);
  return true;
}

const subjectWords = (subject: string) => (SUBJECT_LABEL[subject] ?? subject).toLowerCase();
export const paperName = (r: Pick<RemoteState, 'stage' | 'subject'>) => (r.stage ? `${stageName(r.stage)} ${subjectWords(r.subject ?? '')}` : 'a paper');
const minutes = (ms: number) => Math.max(0, Math.round(ms / 60_000));
const ago = (ms: number) => (minutes(ms) < 1 ? 'just now' : `${minutes(ms)} min ago`);
/** About how long a run takes, all in (set-up, then the questions). */
export const aboutMinutes = (items: number) => Math.ceil(SETUP_MIN + items * MIN_PER_ITEM);

/** The status as the phone shows it (the note of a run in progress worked out now, so "started N min ago" is current). */
export function remoteView(r: RemoteState, now: number) {
  const note =
    r.phase === 'running' && r.pushedAt && !r.completeAt && !/^Waiting|^Kaggle/.test(r.note)
      ? `Sitting ${paperName(r)} on the free GPU · started ${ago(now - r.pushedAt)} · about ${aboutMinutes(r.items ?? 20)} minutes`
      : r.note;
  return { phase: r.phase, note, paperId: r.paperId ?? null, stage: r.stage ?? null, subject: r.subject ?? null, title: r.title ?? null, startedAt: r.pushedAt ?? null, last: r.last ?? null };
}

// ---- the school side: asking for a run, filing results (SCHOOL's routes, with KV) --------------------------------

type Lock = <T>(fn: () => Promise<T>) => Promise<T>;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** A paper sat on Kaggle and marked, and the online model's marks: into the school record (and its KV mirror). */
export async function fileRemote(d: Store & { now?: () => number }, lock: Lock): Promise<number> {
  const now = (d.now ?? Date.now)();
  const r = await loadRemote(d.storage);
  const gaps = [...(await d.storage.list<GapProgress>({ prefix: ONLINE_PREFIX }).catch(() => new Map<string, GapProgress>())).values()].filter((g) => g?.online && !g.filed);
  if (!r.unfiled && !gaps.length) return 0;
  const had = !!r.unfiled;
  let filed = 0;
  await lock(async () => {
    const st = await loadState(d);
    if (r.unfiled) {
      const u = r.unfiled;
      const rec = await loadPaper(d, u.result.paperId);
      // Handed in on the phone meanwhile (the same paper, carried on there): the phone's stands.
      if (rec && !rec.result) {
        rec.given = u.given;
        rec.model = u.model;
        rec.result = u.result;
        await savePaper(d, rec);
        const changed = applyResult(st, u.result, now);
        newsFor(st, u.result, changed);
        filed++;
      }
    }
    for (const g of gaps) {
      const at = st.results.find((x) => x.paperId === g.paperId);
      if (at) at.online = g.online!;
      const rec = await loadPaper(d, g.paperId);
      if (rec?.result) {
        rec.result.online = g.online!;
        await savePaper(d, rec);
      }
      filed++;
    }
    await saveState(d, st);
  });
  if (had) {
    // Read again: a report may have come in while this one was filed (only the filed one is cleared).
    const cur = await loadRemote(d.storage);
    if (cur.unfiled?.result.paperId === r.unfiled?.result.paperId) {
      delete cur.unfiled;
      await saveRemote(d.storage, cur);
    }
  }
  if (filed) {
    // The online model's answers are not needed once its marks are filed: only the marks stay (the cache).
    for (const g of gaps) await d.storage.put(ONLINE_PREFIX + g.paperId, { paperId: g.paperId, online: g.online, filed: true, given: {}, marks: [] } satisfies GapProgress);
  }
  return filed;
}

/** Wake the weekly training's job now (it runs exam runs too); with none yet, it starts within the hour. */
async function wakeTrainJob(s: DurableObjectStorage, now: number): Promise<void> {
  const j = (await loadJobs(s)).find((x) => x.kind === 'train');
  if (!j) return;
  await setNext(s, j.id, now + 1000);
  await rearm(s);
}

/**
 * POST /school/sit-remote { stage, subject }: a paper set by the phone's own route (`setPaper` = POST /school/sit),
 * then a run asked for. One at a time: while one is waiting or running, another is refused with its status.
 */
export async function sitRemote(d: Store & { now?: () => number }, body: Record<string, unknown>, setPaper: (stage: string, subject: string) => Promise<Response>, lock: Lock): Promise<Response> {
  const now = (d.now ?? Date.now)();
  await fileRemote(d, lock);
  const r = await loadRemote(d.storage);
  if (r.phase !== 'idle') return json({ error: `Already sitting ${paperName(r)} on the free GPU: one paper at a time.`, remote: remoteView(r, now) }, 409);
  const set = await setPaper(String(body.stage ?? ''), String(body.subject ?? ''));
  const got = (await set.json().catch(() => ({}))) as { paper?: { id?: string; items?: unknown[]; title?: string; stage?: StageId; subject?: string }; error?: string };
  if (!set.ok || !got.paper?.id) return json({ error: got.error ?? 'A paper could not be set just now.' }, set.ok ? 503 : set.status);
  const p = got.paper;
  const next: RemoteState = {
    phase: 'queued',
    gen: r.gen,
    note: `Starting ${paperName({ stage: p.stage, subject: p.subject })} on the free GPU…`,
    paperId: p.id,
    stage: p.stage,
    subject: p.subject,
    title: p.title ?? '',
    items: Array.isArray(p.items) ? p.items.length : 0,
    requestedAt: now,
    ...(r.last ? { last: r.last } : {}),
  };
  await saveRemote(d.storage, next);
  await wakeTrainJob(d.storage, now);
  return json({ remote: remoteView(next, now) });
}

/** GET /school/remote: the run, the gap per subject (newest paper with the online model's marks) and every gap there is. */
export async function remoteStatus(d: Store & { now?: () => number }, lock: Lock): Promise<Response> {
  const now = (d.now ?? Date.now)();
  await fileRemote(d, lock);
  const r = await loadRemote(d.storage);
  const st = await loadState(d);
  const gaps = st.results.filter((x) => x.online);
  return json({ remote: remoteView(r, now), gap: gapBySubject(st), gaps: gaps.slice(0, 20).map((x) => ({ paperId: x.paperId, title: x.title, stage: x.stage, subject: x.subject, at: x.at, where: x.where, line: gapOf(x) })) });
}
/** The gap per subject of his current stage: the newest paper the online model has sat too (GET /school and /school/remote). */
export function gapBySubject(st: { stage: StageId; results: PaperResult[] }): Record<string, { stage: StageId; subject: string; line: string; paperId: string; at: number }> {
  const out: Record<string, { stage: StageId; subject: string; line: string; paperId: string; at: number }> = {};
  for (const x of st.results) if (x.online && x.stage === st.stage && !out[x.subject]) out[x.subject] = { stage: x.stage, subject: x.subject, line: gapOf(x), paperId: x.paperId, at: x.at };
  return out;
}
const gapOf = (x: PaperResult) => `offline ${x.raw}/${x.max} · online ${x.online!.raw}/${x.max}`;

// ---- the training side: the hook's report (database only) ----------------------------------------------------

/** The paper as the notebook gets it (school_paper.jsonl): the questions, never the answers or mark schemes. */
export function paperLines(p: SchoolPaper): string {
  const passage = (id?: string) => {
    const x = id ? p.passages?.find((y) => y.id === id) : undefined;
    return x ? { passage: { title: x.title, text: x.text } } : {};
  };
  return p.items.map((it) => JSON.stringify({ id: it.id, q: it.q, type: it.type, marks: it.marks, ...(it.options ? { options: it.options } : {}), ...passage(it.passage) })).join('\n') + '\n';
}

const timed = (ask: Ask | undefined, ms: number): Ask | undefined =>
  ask && ((system, user) => Promise.race([ask(system, user), new Promise<string>((_, no) => setTimeout(() => no(new Error('the marker took too long')), ms))]));

/**
 * The notebook's report of a paper sat on Kaggle: `{ kind: 'school', paperId, model, answers: [{ id, given }] }`.
 * Marked as a phone-sat paper is (exact by the code, written answers by the marker; one that is slow or not free
 * waits as pending and SCHOOL marks it again later), scored with `where: 'kaggle'`, and left for `fileRemote`.
 */
export async function acceptRemoteReport(d: { storage: DurableObjectStorage; ask?: Ask; now?: () => number }, r: RemoteState, report: { paperId?: unknown; answers?: unknown; error?: unknown }): Promise<{ ok: boolean; error?: string }> {
  const now = (d.now ?? Date.now)();
  if (String(report.paperId ?? '') !== r.paperId) return { ok: false, error: 'not this run\'s paper' };
  const rec = await loadPaper({ storage: d.storage }, r.paperId!);
  const name = paperName(r);
  const end = (note: string, last: RemoteState['last']) => {
    r.phase = 'idle';
    r.note = note;
    r.last = last;
    delete r.ticket;
    delete r.completeAt;
  };
  if (report.error || !Array.isArray(report.answers) || !rec) {
    const why = String(report.error ?? (rec ? 'it sent no answers' : 'the paper is not known any more')).replace(/hf_[A-Za-z0-9]{8,}/g, 'hf_…').slice(0, 200);
    end(`${name} on the free GPU did not finish: ${why}`, { paperId: r.paperId!, title: r.title ?? '', at: now, error: why });
    await saveRemote(d.storage, r);
    return { ok: true };
  }
  const items = new Map(rec.paper.items.map((i) => [i.id, i]));
  const given: Record<string, string> = {};
  for (const a of report.answers.slice(0, 400) as { id?: unknown; given?: unknown }[]) {
    const it = items.get(String(a?.id ?? ''));
    if (it && typeof a?.given === 'string') given[it.id] = keepGiven(it, a.given);
  }
  const marks = await markPaper(rec.paper, given, stageName(rec.paper.stage), timed(d.ask, MARK_WAIT_MS));
  const model = r.model ?? 'stock';
  const scored = scorePaper(rec.paper, marks, { at: now, where: 'kaggle', model });
  const result: PaperResult = { ...scored, boundary: boundaryLine(rec.paper, scored.raw) };
  r.unfiled = { result, given, model };
  end(
    `Sat ${name} on the free GPU: ${result.raw}/${result.max} (${result.grade})${result.marked.pending ? ', written answers still to be marked' : ''}.`,
    { paperId: result.paperId, title: result.title, at: now, raw: result.raw, max: result.max, grade: result.grade },
  );
  await saveRemote(d.storage, r);
  return { ok: true };
}

// ---- the honest gap ------------------------------------------------------------------------------------------

export interface GapProgress {
  paperId: string;
  /** The online model's replies by item id (kept only until its marks are filed). */
  given: Record<string, string>;
  marks?: import('../../../../packages/shared/src/school').ItemResult[];
  online?: OnlineMark;
  filed?: boolean;
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const GAP_DAY = 'school:gap-day';

/**
 * One step of the gap: the newest sat paper the online model has not sat yet gets a few of its questions asked
 * (as the exam asks them), then marked the same way; done, its marks wait to be filed (`fileRemote`). At most
 * `GAP_PER_STEP` calls a step and `GAP_PER_DAY` a day; each answer saved at once (a cut-off step loses nothing),
 * and a paper is asked once only. Never throws. `more`: a paper is still to be compared.
 */
export async function gapTick(d: { storage: DurableObjectStorage; ask?: Ask; now?: () => number }): Promise<{ calls: number; more: boolean; noModel: boolean }> {
  const s = d.storage;
  const now = (d.now ?? Date.now)();
  if (!d.ask) return { calls: 0, more: false, noModel: false };
  const st = await loadState({ storage: s });
  const todo = st.results.filter((x) => !x.online && !x.marked.pending && now - x.at < GAP_MAX_AGE);
  const day = (await s.get<{ day: string; calls: number }>(GAP_DAY)) ?? { day: '', calls: 0 };
  if (day.day !== dayOf(now)) Object.assign(day, { day: dayOf(now), calls: 0 });
  let calls = 0;
  let noModel = false;
  const room = () => !noModel && calls < GAP_PER_STEP && day.calls < GAP_PER_DAY;
  const counted: Ask = async (system, user) => {
    calls++;
    day.calls++;
    await s.put(GAP_DAY, day);
    try {
      return await d.ask!(system, user);
    } catch (e) {
      noModel = true;
      throw e;
    }
  };
  let more = false;
  for (const res of todo) {
    const key = ONLINE_PREFIX + res.paperId;
    const g: GapProgress = (await s.get<GapProgress>(key)) ?? { paperId: res.paperId, given: {} };
    if (g.online) continue; // done: waiting to be filed
    const rec = await loadPaper({ storage: s }, res.paperId);
    if (!rec) continue;
    more = true;
    if (!room()) break;
    for (const it of rec.paper.items) {
      if (it.id in g.given) continue;
      if (!room()) break;
      const p = it.passage ? rec.paper.passages?.find((x) => x.id === it.passage) : undefined;
      const m = examMessages(it, p);
      const reply = await counted(m[0]!.content, m[1]!.content).catch(() => null);
      if (reply === null) break;
      g.given[it.id] = keepGiven(it, reply);
      await s.put(key, g);
    }
    if (rec.paper.items.some((it) => !(it.id in g.given))) break;
    // Every question answered: marked the same way (written answers by the marker, a few at a time).
    const stage = stageName(rec.paper.stage);
    g.marks ??= await markPaper(rec.paper, g.given, stage, undefined);
    if (room()) g.marks = (await retryPending(rec.paper, g.marks, stage, counted, GAP_PER_STEP - calls)).answers;
    if (!g.marks.some((a) => a.how === 'pending')) {
      const r = scorePaper(rec.paper, g.marks, { at: now, where: res.where, model: ONLINE_LABEL });
      g.online = { raw: r.raw, grade: r.grade, model: ONLINE_LABEL, at: now };
    }
    await s.put(key, g);
    break;
  }
  await s.put(GAP_DAY, day);
  return { calls, more: more && day.calls < GAP_PER_DAY, noModel };
}
