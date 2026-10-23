/**
 * SCHOOL's routes (owner-only, like /training: the Worker lets only the owner reach the brain's /api) and the
 * daily school report.
 *
 *   GET  /school                → the record, the ladder (passed / now / locked), the latest result in each subject
 *                                 of the current stage, weak spots and papers still waiting for marks (a few are
 *                                 marked again on every read)
 *   POST /school/sit            { stage, subject } → a paper to sit: questions, types, choices, marks and passages —
 *                                 NEVER the answers or the mark schemes. Any stage may be sat (a placement test).
 *                                 An unfinished paper of the same subject from the last day is handed back to carry on.
 *   POST /school/answers        { paperId, answers: [{ id, given }], final?, model? } → saved; unless `final` is
 *                                 false, marked, the result kept and the stage checked (passed, moved up)
 *   GET  /school/paper/<id>     → the paper with its answers and mark schemes, his answers, marks and the marker's
 *                                 notes: only once it has been sat (the owner's spot check)
 *   POST /school/settings       { nightly } → the nightly school report on or off
 */
import { scorePaper, stageById, STAGE_IDS, SUBJECT_LABEL, weakSpots, type PaperResult, type StageId } from '../../../../packages/shared/src/school';
import { durableDelete } from '../kv';
import { keepGiven, markPaper, retryPending, type Ask } from './mark';
import { hasPapers, makePaper, PAPER_SEED_FLOOR, PAPER_STAGES, stageName, type SchoolPaper } from './papers';
import { applyResult, ladder, latestFor, loadPaper, loadState, newsFor, nextUp, PAPER_PREFIX, reportLine, saveState, savePaper, type PaperRecord, type SchoolState, type Store } from './state';

export interface SchoolDeps extends Store {
  /** The marker (a stronger model, background lane, never waiting); absent: written answers wait as pending. */
  ask?: Ask;
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

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const bad = (error: string, status = 400) => json({ error }, status);

/** One change at a time to SCHOOL's record (a read that marks, a paper handed in and the daily report may overlap). */
const chains = new WeakMap<object, Promise<unknown>>();
function serial<T>(d: Store, fn: () => Promise<T>): Promise<T> {
  const run = (chains.get(d.storage) ?? Promise.resolve()).then(fn);
  chains.set(d.storage, run.catch(() => undefined));
  return run;
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
    rec.result = scorePaper(rec.paper, again.answers, { at: rec.result.at, where: rec.result.where, model: rec.result.model });
    await savePaper(d, rec);
    const changed = applyResult(st, rec.result, (d.now ?? Date.now)());
    if (!rec.result.marked.pending) newsFor(st, rec.result, changed, true);
  }
  return marked;
}

/** What GET /school (and the settings) answer with. */
function view(st: SchoolState) {
  const stage = stageById(st.stage)!;
  const latest = latestFor(st.results, st.stage);
  return {
    state: { stage: st.stage, passed: st.passed, results: st.results, nightly: st.nightly, open: st.open },
    stages: ladder(st),
    current: { stage: st.stage, label: stage.label, papers: hasPapers(st.stage), pass: stage.pass, subjects: stage.subjects.map((s) => ({ id: s, label: SUBJECT_LABEL[s] ?? s, latest: latest[s] ?? null, top: !!latest[s]?.top })) },
    latest,
    weak: weakSpots(st.results),
    pending: st.results.filter((r) => r.marked.pending > 0).map((r) => ({ paperId: r.paperId, title: r.title, items: r.marked.pending })),
    next: nextUp(st),
    papersFor: PAPER_STAGES,
  };
}

export async function handleSchool(req: Request, path: string, method: string, d: SchoolDeps): Promise<Response> {
  const now = (d.now ?? Date.now)();
  if (path === '/school' && method === 'GET') {
    const st = await serial(d, async () => {
      const st = await loadState(d);
      if (await retrySome(d, st, RETRY_ON_READ)) await saveState(d, st);
      return st;
    });
    return json(view(st));
  }

  const body = method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};

  if (path === '/school/sit' && method === 'POST') {
    const stage = String(body.stage ?? '') as StageId;
    const s = stageById(stage);
    if (!s || !STAGE_IDS.includes(stage)) return bad('No such stage.');
    const subject = String(body.subject ?? '');
    if (!s.subjects.includes(subject)) return bad(`${s.label} has no subject "${subject}".`);
    if (!hasPapers(stage)) return bad(`Papers for ${stageName(stage)} are not written yet.`);
    return serial(d, async () => {
      const st = await loadState(d);
      // An unfinished paper of the same subject from the last day: carry on with it (its answers so far are kept).
      const open = st.open.find((o) => o.stage === stage && o.subject === subject);
      if (open && now - open.at < RESUME_MS) {
        const rec = await loadPaper(d, open.id);
        if (rec && !rec.result) return json({ paper: forSitting(rec.paper), done: Object.keys(rec.given), resumed: true });
      }
      // An older unfinished one of that subject is let go (it never counts), and a new paper is set.
      for (const o of st.open.filter((x) => x.stage === stage && x.subject === subject)) await durableDelete(d.env, d.storage, PAPER_PREFIX + o.id).catch(() => undefined);
      const rnd = d.random ?? Math.random;
      let paper: SchoolPaper | null = null;
      for (let i = 0; i < 6 && !paper; i++) {
        const seed = PAPER_SEED_FLOOR + Math.floor(rnd() * 2_000_000_000);
        const p = makePaper(stage, subject, seed);
        if (!(await loadPaper(d, p.id))) paper = p;
      }
      if (!paper) return bad('A new paper could not be set just now. Try again.', 503);
      const rec: PaperRecord = { paper, from: 'written', issuedAt: now, given: {} };
      await savePaper(d, rec);
      st.open = [{ id: paper.id, stage, subject, at: now }, ...st.open.filter((x) => !(x.stage === stage && x.subject === subject))].slice(0, MAX_OPEN);
      await saveState(d, st);
      return json({ paper: forSitting(paper), done: [], resumed: false });
    });
  }

  if (path === '/school/answers' && method === 'POST') {
    const id = String(body.paperId ?? '');
    if (!/^[a-z0-9-]{1,80}$/.test(id)) return bad('Which paper?');
    return serial(d, async () => {
      const rec = await loadPaper(d, id);
      if (!rec) return bad('That paper is not known.', 404);
      if (rec.result) return json({ error: 'That paper was already handed in.', result: rec.result }, 409);
      const items = new Map(rec.paper.items.map((i) => [i.id, i]));
      for (const a of Array.isArray(body.answers) ? body.answers.slice(0, 60) : []) {
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
      const result: PaperResult = scorePaper(rec.paper, marks, { at: now, where: 'phone', model: rec.model ?? 'stock' });
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
    return json(view(st));
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
