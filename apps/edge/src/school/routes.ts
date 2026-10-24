/**
 * SCHOOL's routes (owner-only, like /training: the Worker lets only the owner reach the brain's /api) and the
 * daily school report.
 *
 *   GET  /school                → the record, the ladder (passed / now / locked), the latest result in each subject
 *                                 of the current stage, weak spots and papers still waiting for marks (a few are
 *                                 marked again on every read); and, so the tab needs no second call on open, the
 *                                 paper on the free GPU (`remote`: a finished one is filed first), the honest gap
 *                                 per subject (`gap`) and what is being practised (`practice`)
 *   POST /school/sit            { stage, subject } → a paper to sit: questions, types, choices, marks and passages —
 *                                 NEVER the answers or the mark schemes. Any stage may be sat (a placement test).
 *                                 An unfinished paper of the same subject from the last day is handed back to carry on.
 *   POST /school/answers        { paperId, answers: [{ id, given }], final?, model? } → saved; unless `final` is
 *                                 false, marked, the result kept and the stage checked (passed, moved up)
 *   GET  /school/paper/<id>     → the paper with its answers and mark schemes, his answers, marks and the marker's
 *                                 notes: only once it has been sat (the owner's spot check)
 *   POST /school/settings       { nightly } → the nightly school report on or off
 *
 * Part 2 (question banks and official papers):
 *   POST /school/bank/write     { stage, subject? } → that stage's banks (or one) queued for writing; one slice runs
 *   POST /school/work           → one slice of whatever is being written or read (a bank, or an official paper);
 *                                 the phone calls it while SCHOOL is open, the daily step a few times a day
 *   GET  /school/official       → the curated official papers: source, licence, what is fetched, what is available
 *   GET  /school/official/file?id=&part= → one part's PDF, fetched by the brain from its listed address only
 *   POST /school/official/text  { id, part, pages } → that part's text, read on the phone; when every part is in,
 *                                 the paper is queued for reading
 * Which paper a subject gets (`sourcesFor`): an official paper that is fetched and not yet handed out, else the
 * generators (nursery to Key Stage 2), else its finished question bank; none of these: it cannot be sat.
 */
import { boundaryLine, scorePaper, stageById, STAGE_IDS, SUBJECT_LABEL, weakSpots, type ItemResult, type PaperResult, type StageId } from '../../../../packages/shared/src/school';
import { durableDelete } from '../kv';
import { BANK_STAGES, bankItems, bankKey, bankName, bankPaper, bankReady, bankRow, bankTick, isBankStage, loadBank, shapeOf, type BankMeta } from './banks';
import { keepGiven, markPaper, retryPending, type Ask } from './mark';
import { practiceView } from './practice';
import { fileRemote, gapBySubject, loadRemote, remoteStatus, remoteView, sitRemote } from './remote';
import { fileResponse, loadAllOfficial, loadOfficial, officialById, officialKey, officialName, officialRow, officialTick, OFFICIAL, OFFICIAL_HOSTS, saveText, type OfficialRecord } from './official';
import { hasPapers, makePaper, paperId, PAPER_SEED_FLOOR, PAPER_STAGES, stageName, type SchoolPaper } from './papers';
import { addNews, applyResult, ladder, latestFor, loadPaper, loadState, newsFor, nextUp, PAPER_PREFIX, reportLine, saveState, savePaper, type PaperRecord, type SchoolState, type Store } from './state';

export interface SchoolDeps extends Store {
  /** The marker (a stronger model, background lane, never waiting); absent: written answers wait as pending. */
  ask?: Ask;
  /** The writer and checker of banks and the reader of official papers (the best model, background lane, never waiting). */
  write?: Ask;
  /** How the brain fetches an official paper's file (tests pass a stand-in). */
  fetcher?: typeof fetch;
  /** One phone notification (the owner's devices); returns how many got it. */
  push?: (msg: { title: string; body: string; tag?: string }) => Promise<number>;
  now?: () => number;
  random?: () => number;
}

/** Pending items marked again on a SCHOOL read, and by the daily report. */
const RETRY_ON_READ = 3;
const RETRY_DAILY = 8;
/** An unfinished paper is handed back to carry on within this long; after it a new one is set. */
const RESUME_MS = 24 * 3600_000;
const MAX_OPEN = 20;
/** Answers taken in one hand-in (the longest official paper, Key Stage 2 maths, has about 75 questions). */
const MAX_ANSWERS = 200;
/** Slices of writing and reading the daily step runs (each at most a few model calls). */
const DAILY_SLICES = 6;

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const bad = (error: string, status = 400) => json({ error }, status);

/** One change at a time to SCHOOL's record (a read that marks, a paper handed in and the daily report may overlap). */
const chains = new WeakMap<object, Promise<unknown>>();
function serial<T>(d: Store, fn: () => Promise<T>): Promise<T> {
  const run = (chains.get(d.storage) ?? Promise.resolve()).then(fn);
  chains.set(d.storage, run.catch(() => undefined));
  return run;
}

/** A paper's result, with the boundary he reached in words. */
function score(paper: SchoolPaper, answers: ItemResult[], meta: Pick<PaperResult, 'at' | 'where' | 'model'>): PaperResult {
  const r = scorePaper(paper, answers, meta);
  return { ...r, boundary: boundaryLine(paper, r.raw) };
}

// ---- where each subject's paper comes from --------------------------------------------------------------------

export type Source = 'official' | 'written' | 'bank';
export interface SourceInfo {
  source: Source | null;
  /** Plain words: "official: 2024 SATs (Standards and Testing Agency)", "written by Ghosty", "no paper yet: …". */
  line: string;
  official?: { id: string; year: number; board: string };
  bank?: ReturnType<typeof bankRow>;
}

const bankKeys = () => BANK_STAGES.flatMap((st) => (stageById(st)?.subjects ?? []).map((sub) => [st, sub] as const));

/** Every bank's progress record there is (one read). */
async function allBanks(d: Store): Promise<Map<string, BankMeta>> {
  const keys = bankKeys().map(([st, sub]) => bankKey(st, sub));
  const got = await d.storage.get<BankMeta>(keys);
  return new Map([...got].filter(([, v]) => !!v));
}
/** Read without failing the whole page: while the database is paused, SCHOOL still shows his record (from KV). */
const orEmpty = <T>(p: Promise<Map<string, T>>): Promise<Map<string, T>> => p.catch(() => new Map<string, T>());

/** The official paper to hand out next for a subject: fetched, read, not yet handed out (newest year first). */
function nextOfficial(stage: StageId, subject: string, recs: Map<string, OfficialRecord>, used: string[]): OfficialRecord | undefined {
  return OFFICIAL.filter((e) => e.stage === stage && e.subject === subject && recs.get(e.id)?.status === 'ready' && !used.includes(e.id))
    .sort((a, b) => b.year - a.year)
    .map((e) => recs.get(e.id)!)[0];
}

/** Where every stage's subjects get their papers now. */
export async function sourcesFor(d: Store, st: SchoolState): Promise<Record<string, Record<string, SourceInfo>>> {
  const [banks, recs] = await Promise.all([orEmpty(allBanks(d)), orEmpty(loadAllOfficial(d))]);
  const out: Record<string, Record<string, SourceInfo>> = {};
  for (const id of STAGE_IDS) {
    const row: Record<string, SourceInfo> = {};
    for (const sub of stageById(id)!.subjects) {
      const off = nextOfficial(id, sub, recs, st.officialUsed);
      const bank = isBankStage(id) && shapeOf(id, sub) ? banks.get(bankKey(id, sub)) : undefined;
      if (off?.paper) row[sub] = { source: 'official', line: `official: ${off.paper.board === 'Standards and Testing Agency' ? `${off.paper.year} SATs (Standards and Testing Agency)` : `${off.paper.board}, ${off.paper.year}`}`, official: { id: off.id, year: off.paper.year ?? 0, board: off.paper.board ?? '' } };
      else if (hasPapers(id)) row[sub] = { source: 'written', line: 'written by Ghosty' };
      else if (bankReady(bank)) row[sub] = { source: 'bank', line: `written by Ghosty from his checked bank (${bank!.kept} questions kept, ${bankRow(bank!).rejected.all} rejected)`, bank: bankRow(bank!) };
      else if (bank) row[sub] = { source: null, line: bankRow(bank).line, bank: bankRow(bank) };
      else row[sub] = { source: null, line: isBankStage(id) && shapeOf(id, sub) ? 'no paper yet: WRITE THE PAPERS writes its question bank' : 'no paper yet' };
    }
    out[id] = row;
  }
  return out;
}
const sittable = (src: Record<string, Record<string, SourceInfo>>) => (id: StageId) => Object.values(src[id] ?? {}).every((x) => x.source);

// ---- writing and reading, a slice at a time -------------------------------------------------------------------

const WORK_KEY = 'school:work';
interface Work {
  /** Banks queued for writing ("gcse:maths"), and official papers queued for reading (entry ids). */
  banks: string[];
  official: string[];
  turn: number;
}
const loadWork = async (d: Store): Promise<Work> => {
  const w = await d.storage.get<Work>(WORK_KEY).catch(() => undefined);
  return { banks: Array.isArray(w?.banks) ? w!.banks : [], official: Array.isArray(w?.official) ? w!.official : [], turn: Number(w?.turn) || 0 };
};
/** One slice at a time (they are long: a few model calls); separate from the record's own queue so reads stay quick. */
const workChains = new WeakMap<object, Promise<unknown>>();
function oneAtATime<T>(d: Store, fn: () => Promise<T>): Promise<T> {
  const run = (workChains.get(d.storage) ?? Promise.resolve()).then(fn);
  workChains.set(d.storage, run.catch(() => undefined));
  return run;
}

/** What is being written or read, as the SCHOOL tab shows it. */
async function workView(d: Store, w: Work) {
  const banks = await Promise.all(w.banks.map(async (k) => {
    const [st, sub] = k.split(':') as [StageId, string];
    const m = await loadBank(d, st, sub);
    return m ? bankRow(m) : { stage: st, subject: sub, kept: 0, target: shapeOf(st, sub)?.target ?? 0, checking: 0, rejected: { wrong: 0, unsound: 0, picture: 0, malformed: 0, repeat: 0, all: 0 }, calls: 0, done: false, line: `Writing ${bankName(st, sub)} · 0 of ${shapeOf(st, sub)?.target ?? 0} · starting`, updatedAt: 0 };
  }));
  const st = await loadState(d);
  const official = await Promise.all(w.official.map(async (id) => officialRow(officialById(id)!, await loadOfficial(d, id), st.officialUsed.includes(id))));
  return { busy: w.banks.length + w.official.length > 0, banks, official };
}

/**
 * One slice of work: the next bank in the queue, or the next official paper (they take turns), at most a few model
 * calls. A finished bank or paper leaves the queue and is news for the school report.
 */
export function workTick(d: SchoolDeps): Promise<Awaited<ReturnType<typeof workView>> & { calls: number }> {
  return oneAtATime(d, async () => {
    const now = (d.now ?? Date.now)();
    const w = await loadWork(d);
    let calls = 0;
    const news: string[] = [];
    const bankTurn = w.banks.length && (!w.official.length || w.turn % 2 === 0);
    if (bankTurn) {
      const k = w.banks[0]!;
      const [st, sub] = k.split(':') as [StageId, string];
      const r = await bankTick(d, st, sub, d.write, now).catch(() => null);
      calls = r?.calls ?? 0;
      if (!r || r.meta.done) {
        w.banks = w.banks.filter((x) => x !== k);
        if (r?.meta.done) news.push(`wrote ${bankName(st, sub)} (${r.meta.kept} checked questions)`);
      } else if (r.calls) w.banks = [...w.banks.slice(1), k];
    } else if (w.official.length) {
      const id = w.official[0]!;
      const r = await officialTick(d, id, d.write, now).catch(() => null);
      calls = r?.calls ?? 0;
      if (!r || r.record.status !== 'reading') {
        w.official = w.official.filter((x) => x !== id);
        const e = officialById(id);
        if (e && r?.record.status === 'ready') news.push(`read ${officialName(e)} (official, kept private)`);
      } else if (r.calls) w.official = [...w.official.slice(1), id];
    }
    w.turn++;
    await d.storage.put(WORK_KEY, w);
    if (news.length) {
      await serial(d, async () => {
        const st = await loadState(d);
        for (const n of news) addNews(st, n);
        await saveState(d, st);
      });
    }
    return { ...(await workView(d, w)), calls };
  });
}

/** A paper as the phone gets it to sit: the questions only, never the answers, other answers or mark schemes. */
export function forSitting(p: SchoolPaper) {
  return {
    id: p.id,
    stage: p.stage,
    subject: p.subject,
    title: p.title,
    official: p.official,
    maxMarks: p.maxMarks,
    items: p.items.map((it) => ({ id: it.id, q: it.q, type: it.type, marks: it.marks, ...(it.options ? { options: [...it.options] } : {}), ...(it.unit ? { unit: it.unit } : {}), ...(it.passage ? { passage: it.passage } : {}) })),
    passages: (p.passages ?? []).map((x) => ({ id: x.id, title: x.title, text: x.text, source: x.source })),
  };
}

/**
 * Papers whose written answers wait for a marker, asked again (at most `limit` items in all, newest papers first).
 * A paper whose last pending mark comes in is scored again, kept, and checked against its stage like a new one.
 */
async function retrySome(d: SchoolDeps, st: SchoolState, limit: number): Promise<number> {
  let left = limit;
  let marked = 0;
  for (const r of st.results.filter((x) => x.marked.pending > 0)) {
    if (left <= 0 || !d.ask) break;
    const rec = await loadPaper(d, r.paperId);
    if (!rec?.result) continue;
    const before = rec.result.answers.filter((a) => a.how === 'pending').length;
    const again = await retryPending(rec.paper, rec.result.answers, stageName(rec.paper.stage), d.ask, left);
    left -= before;
    if (!again.marked) continue;
    marked += again.marked;
    rec.result = score(rec.paper, again.answers, { at: rec.result.at, where: rec.result.where, model: rec.result.model });
    await savePaper(d, rec);
    const changed = applyResult(st, rec.result, (d.now ?? Date.now)());
    if (!rec.result.marked.pending) newsFor(st, rec.result, changed, true);
  }
  return marked;
}

/** What GET /school (and the settings) answer with. */
async function view(d: SchoolDeps, st: SchoolState) {
  const stage = stageById(st.stage)!;
  const latest = latestFor(st.results, st.stage);
  const src = await sourcesFor(d, st);
  const can = sittable(src);
  const w = await loadWork(d);
  const now = (d.now ?? Date.now)();
  // The free GPU's run and the practice live in the database only: while it is paused, SCHOOL still shows his record.
  const [remote, practice] = await Promise.all([loadRemote(d.storage).then((r) => remoteView(r, now)).catch(() => null), practiceView(d.storage, st.stage, now).catch(() => null)]);
  return {
    state: { stage: st.stage, passed: st.passed, results: st.results, nightly: st.nightly, open: st.open },
    stages: ladder(st, can),
    current: { stage: st.stage, label: stage.label, papers: can(st.stage), bank: isBankStage(st.stage), pass: stage.pass, subjects: stage.subjects.map((s) => ({ id: s, label: SUBJECT_LABEL[s] ?? s, latest: latest[s] ?? null, top: !!latest[s]?.top, source: src[st.stage]![s]!.source, from: src[st.stage]![s]!.line })) },
    sources: src,
    work: { busy: w.banks.length + w.official.length > 0, banks: w.banks, official: w.official },
    bankStages: BANK_STAGES,
    latest,
    weak: weakSpots(st.results),
    pending: st.results.filter((r) => r.marked.pending > 0).map((r) => ({ paperId: r.paperId, title: r.title, items: r.marked.pending })),
    next: nextUp(st),
    papersFor: PAPER_STAGES,
    remote,
    gap: gapBySubject(st),
    practice,
  };
}

export async function handleSchool(req: Request, path: string, method: string, d: SchoolDeps): Promise<Response> {
  const now = (d.now ?? Date.now)();
  if (path === '/school' && method === 'GET') {
    // A paper sat on the free GPU (or the online model's marks) waiting to be filed: into the record first.
    await fileRemote(d, (fn) => serial(d, fn)).catch(() => 0);
    const st = await serial(d, async () => {
      const st = await loadState(d);
      if (await retrySome(d, st, RETRY_ON_READ)) await saveState(d, st);
      return st;
    });
    return json(await view(d, st));
  }

  // ---- part 2: banks and official papers ----
  if (path === '/school/official' && method === 'GET') {
    const [recs, st] = await Promise.all([loadAllOfficial(d), loadState(d)]);
    return json({ papers: OFFICIAL.map((e) => officialRow(e, recs.get(e.id), st.officialUsed.includes(e.id))), hosts: OFFICIAL_HOSTS });
  }
  if (path === '/school/official/file' && method === 'GET') {
    const q = new URL(req.url).searchParams;
    return fileResponse(q.get('id') ?? '', Number(q.get('part') ?? -1), d.fetcher);
  }

  const body = method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};

  if (path === '/school/sit' && method === 'POST') {
    const stage = String(body.stage ?? '') as StageId;
    const s = stageById(stage);
    if (!s || !STAGE_IDS.includes(stage)) return bad('No such stage.');
    const subject = String(body.subject ?? '');
    if (!s.subjects.includes(subject)) return bad(`${s.label} has no subject "${subject}".`);
    return serial(d, async () => {
      const st = await loadState(d);
      // An unfinished paper of the same subject from the last day: carry on with it (its answers so far are kept).
      const open = st.open.find((o) => o.stage === stage && o.subject === subject);
      if (open && now - open.at < RESUME_MS) {
        const rec = await loadPaper(d, open.id);
        if (rec && !rec.result) return json({ paper: forSitting(rec.paper), done: Object.keys(rec.given), resumed: true, from: rec.from });
      }
      const src = (await sourcesFor(d, st))[stage]![subject]!;
      if (!src.source) return bad(`Papers for ${stageName(stage)} ${(SUBJECT_LABEL[subject] ?? subject).toLowerCase()} are not written yet${isBankStage(stage) ? ': WRITE THE PAPERS writes its question bank first' : ''}.`);
      // An older unfinished one of that subject is let go (it never counts), and a new paper is set.
      for (const o of st.open.filter((x) => x.stage === stage && x.subject === subject)) await durableDelete(d.env, d.storage, PAPER_PREFIX + o.id).catch(() => undefined);
      const rnd = d.random ?? Math.random;
      let paper: SchoolPaper | null = null;
      if (src.source === 'official') {
        const rec = await loadOfficial(d, src.official!.id);
        if (rec?.paper) paper = { ...structuredClone(rec.paper), id: `off-${src.official!.id}-${Math.floor(rnd() * 1e9)}` };
        st.officialUsed = [...st.officialUsed.filter((x) => x !== src.official!.id), src.official!.id];
      } else {
        const items = src.source === 'bank' ? await bankItems(d, (await loadBank(d, stage, subject))!) : [];
        for (let i = 0; i < 6 && !paper; i++) {
          const seed = PAPER_SEED_FLOOR + Math.floor(rnd() * 2_000_000_000);
          const p = src.source === 'bank' ? bankPaper(stage, subject, items, seed, paperId(stage, subject, seed)) : makePaper(stage, subject, seed);
          if (!(await loadPaper(d, p.id))) paper = p;
        }
      }
      if (!paper) return bad('A new paper could not be set just now. Try again.', 503);
      const rec: PaperRecord = { paper, from: src.source, issuedAt: now, given: {} };
      await savePaper(d, rec);
      st.open = [{ id: paper.id, stage, subject, at: now }, ...st.open.filter((x) => !(x.stage === stage && x.subject === subject))].slice(0, MAX_OPEN);
      await saveState(d, st);
      return json({ paper: forSitting(paper), done: [], resumed: false, from: src.source });
    });
  }

  if (path === '/school/bank/write' && method === 'POST') {
    const stage = String(body.stage ?? '') as StageId;
    if (!isBankStage(stage)) return bad(`${stageById(stage)?.label ?? 'That stage'} does not need a question bank.`);
    const subjects = body.subject ? [String(body.subject)] : stageById(stage)!.subjects;
    if (subjects.some((x) => !shapeOf(stage, x))) return bad(`${stageById(stage)!.label} has no subject "${body.subject}".`);
    await oneAtATime(d, async () => {
      const w = await loadWork(d);
      for (const sub of subjects) {
        const m = await loadBank(d, stage, sub);
        if (!bankReady(m) && !w.banks.includes(`${stage}:${sub}`)) w.banks.push(`${stage}:${sub}`);
      }
      await d.storage.put(WORK_KEY, w);
    });
    return json(await workTick(d));
  }

  if (path === '/school/work' && method === 'POST') return json(await workTick(d));

  if (path === '/school/official/text' && method === 'POST') {
    const id = String(body.id ?? '');
    try {
      const r = await oneAtATime(d, async () => {
        const r = await saveText(d, id, Number(body.part), body.pages, now);
        if (r.status === 'reading') {
          const w = await loadWork(d);
          if (!w.official.includes(id)) w.official.push(id);
          await d.storage.put(WORK_KEY, w);
        }
        return r;
      });
      const st = await loadState(d);
      return json({ paper: officialRow(officialById(id)!, r, st.officialUsed.includes(id)) });
    } catch (e) {
      return bad(String((e as Error)?.message ?? e).slice(0, 200));
    }
  }

  if (path === '/school/answers' && method === 'POST') {
    const id = String(body.paperId ?? '');
    if (!/^[a-z0-9-]{1,80}$/.test(id)) return bad('Which paper?');
    return serial(d, async () => {
      const rec = await loadPaper(d, id);
      if (!rec) return bad('That paper is not known.', 404);
      if (rec.result) return json({ error: 'That paper was already handed in.', result: rec.result }, 409);
      const items = new Map(rec.paper.items.map((i) => [i.id, i]));
      for (const a of Array.isArray(body.answers) ? body.answers.slice(0, MAX_ANSWERS) : []) {
        const it = items.get(String((a as { id?: unknown })?.id ?? ''));
        const given = (a as { given?: unknown })?.given;
        if (it && typeof given === 'string') rec.given[it.id] = keepGiven(it, given);
      }
      if (typeof body.model === 'string' && body.model.trim()) rec.model = body.model.trim().slice(0, 80);
      if (body.final === false) {
        await savePaper(d, rec);
        return json({ saved: Object.keys(rec.given).length, of: rec.paper.items.length });
      }
      const marks = await markPaper(rec.paper, rec.given, stageName(rec.paper.stage), d.ask);
      const result: PaperResult = score(rec.paper, marks, { at: now, where: 'phone', model: rec.model ?? 'stock' });
      rec.result = result;
      await savePaper(d, rec);
      const st = await loadState(d);
      const changed = applyResult(st, result, now);
      newsFor(st, result, changed);
      await saveState(d, st);
      return json({ result, changed, stage: st.stage, next: nextUp(st) });
    });
  }

  const pm = path.match(/^\/school\/paper\/([a-z0-9-]{1,80})$/);
  if (pm && method === 'GET') {
    const rec = await loadPaper(d, pm[1]!);
    if (!rec) return bad('That paper is not known.', 404);
    if (!rec.result) return bad('Not sat yet: a paper and its answers are shown only after he has sat it.', 404);
    return json({ paper: rec.paper, from: rec.from, given: rec.given, result: rec.result });
  }

  if (path === '/school/settings' && method === 'POST') {
    if (typeof body.nightly !== 'boolean') return bad('nightly: true or false');
    const st = await serial(d, async () => {
      const st = await loadState(d);
      st.nightly = body.nightly as boolean;
      await saveState(d, st);
      return st;
    });
    return json(await view(d, st));
  }

  // [school 2b] A paper sat on Kaggle's free GPU by the same weights (school/remote.ts; selftrain/cycle.ts runs it): set
  // through POST /school/sit above, so it is the paper the phone would get; then its status, and the gap per subject.
  if (path === '/school/sit-remote' && method === 'POST') return sitRemote(d, body, (stage, subject) => handleSchool(new Request(req.url, { method: 'POST', body: JSON.stringify({ stage, subject }) }), '/school/sit', 'POST', d), (fn) => serial(d, fn));
  if (path === '/school/remote' && method === 'GET') return remoteStatus(d, (fn) => serial(d, fn));

  // ---- NIGHT SCHOOL (school/night.ts): the switch and window, tonight's practice and its marks, the morning report ----
  if (path === '/school/night' || path.startsWith('/school/night/')) return (await import('./night')).nightRoute(path, method, body, d, serial);

  // ---- part 3: the reading library (school/reading.ts): the shelves, READ, the reading check and BORROW ----
  if (path === '/school/reading' || path.startsWith('/school/reading/')) {
    const r = await (await import('./reading')).readingRoute(path, method, body, d);
    if (r) return r;
  }

  return bad('not found', 404);
}

/** The owner's day (UK), for "once a day". */
const ukDay = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

/**
 * The daily school step: written answers still waiting are marked again (a few), then — with the NIGHTLY REPORT on
 * and something new since the last one (a paper sat, a stage passed, marks in) — one push in plain words, at most
 * once a day. Nothing new: nothing is sent. Never throws.
 */
export async function dailyReport(d: SchoolDeps): Promise<{ sent: boolean; text: string; retried: number }> {
  // A few slices of the banks and official papers being written and read (each at most a few model calls).
  for (let i = 0; i < DAILY_SLICES; i++) {
    const w = await workTick(d).catch(() => null);
    if (!w?.busy || !w.calls) break;
  }
  // NIGHT SCHOOL: when the phone sent no morning report for a night that is over, the brain files its own part's.
  await (await import('./night')).nightMorning(d, serial).catch(() => null);
  return serial(d, async () => {
    const now = (d.now ?? Date.now)();
    const st = await loadState(d);
    const retried = await retrySome(d, st, RETRY_DAILY);
    let dirty = retried > 0;
    let sent = false;
    let text = '';
    if (!st.nightly) {
      // Switched off: nothing piles up for a report he did not ask for.
      if (st.news.length) (st.news = []), (dirty = true);
    } else if (st.news.length && st.reportedDay !== ukDay(now)) {
      text = reportLine(st);
      try {
        await d.push?.({ title: 'School report', body: text, tag: 'school' });
        st.news = [];
        st.reportedDay = ukDay(now);
        sent = true;
        dirty = true;
      } catch {
        // Not delivered (the database is paused, a push service failed): tried again tomorrow.
      }
    }
    if (dirty) await saveState(d, st);
    return { sent, text, retried };
  }).catch(() => ({ sent: false, text: '', retried: 0 }));
}
