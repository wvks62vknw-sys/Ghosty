/**
 * Self-study: Ghosty keeps learning on its own, around the clock, within the free plan.
 *
 * ONE FIELD AT A TIME. The job works through a queue of fields (domains of curriculum/): the
 * owner's focus first, then the curriculum's own order (foundations first). It reads every
 * piece of the field at the head of the queue before it starts the next — never a mix — and a
 * field read to the end is marked finished and not read again unless the owner asks (puts it
 * first again). With nothing queued and STUDY ALL on (the default), it queues the next
 * unfinished field itself. Each field grows once a week from its Wikipedia outline
 * (curriculum/outlines.ts, `growField`): the articles it links that the curriculum lacks.
 *
 * Every session (a background job, a "tick"; a bounded handful of page reads and model calls):
 *   1. READ — the next pieces of the field being read (the questions the library couldn't
 *      answer before anything), each fetched from a free source (Wikipedia, Wikibooks,
 *      Wikiversity, MDN, arXiv, the Swift book) and filed, without any AI, in that field's reading
 *      notebook (one document per field, one heading per piece). OpenStax pages are link-only now
 *      (its licence forbids ingestion into AI models): passed over, never counted as failures, the
 *      reason logged once and the number skipped in the status line (`OPENSTAX_REASON`).
 *   2. DIGEST — with a model (the cheap tier: keyless or small), a study note on what it just
 *      read: summary, key facts, a worked example or pitfall, self-test questions. Filed in
 *      the domain's digest notebook — the part that also goes to the owner's phone.
 *   3. DRILL — a question it sets itself (drills.ts: maths, computing, logic, facts; endless,
 *      checked without AI), answered by the model and graded. Right and wrong go in the quiz
 *      log with the correct answer; the per-skill scores show where it is reliable.
 * Cadence: while there is reading to do and room, the next session comes almost at once
 * (QUICK_TICK), up to QUICK_TICKS a day — every alarm writes the day's meter to KV, whose free
 * plan allows 1,000 writes a day — then every quarter of an hour; hourly with nothing to do.
 * Caps per session and per day keep the brain's database allowance (meter.ts) and the free
 * model allowances safe; above 70% of the day's database allowance it waits for the reset.
 * Never throws: a failed source is logged and the next session carries on.
 */
import { chunkText } from '../../../../packages/shared/src/chunk';
import { mentionsPlate } from '../../../../packages/shared/src/plates';
import { gutenbergText, gutenbergTextUrl } from './importers';
import { htmlToText } from '../tools/web';
import { DOMAINS, TOPIC_COUNT, domainById, parseTopics, type SourceKind, type Topic } from './curriculum';
import { OUTLINES } from './curriculum/outlines';
import { grade, makeDrill, SKILLS, type Drill } from './drills';
import type { Library } from './store';
import { loadJobs, setNext } from '../schedule';
import { topicUnlocked } from '../../../../packages/shared/src/school';
import { lockOpen, studyLock, type StudyLock } from '../school/reading';

export interface StudyState {
  on: boolean;
  /** Topics read in all (also the legacy curriculum cursor from before domains). */
  i: number;
  /** Questions the library couldn't answer, newest last. */
  gaps: string[];
  last?: { at: number; topic: string; title?: string; passages?: number; error?: string; kind?: 'read' | 'digest' | 'drill' };
  sessions: number;
  /** Per domain: the next topic to read. */
  cursor: Record<string, number>;
  /** Per domain: what has been done. */
  domains: Record<string, { read: number; digested: number; failed: number }>;
  /** The UTC day the counts below are for. */
  day: string;
  /** Today: pieces read, notes written, drills, model calls, fields finished, quick sessions used (QUICK_TICKS). */
  today: { reads: number; digests: number; drills: number; ai: number; finished: number; quick: number };
  /** The fields to read, in order: the first is the one being read now (one at a time, every piece of it first). */
  queue: string[];
  /** Fields read to the end, and when: not read again unless the owner puts them first again. */
  finished: Record<string, number>;
  /** STUDY ALL: with nothing queued, queue the next unfinished field on its own. */
  all: boolean;
  /** The focus the queue was last planned from (a field newly put first that was finished is read again). */
  asked: string[];
  /** Per field: the topics its Wikipedia outline added (n), the week it was last looked at, the last look's numbers. */
  grown: Record<string, { n: number; wk: string; added: number; found: number; at: number; fail?: number }>;
  /** The measured pace: [when, pieces read] for the latest sessions that read something. */
  pace: [number, number][];
  /** When the last drill was set (drills stay about a quarter of an hour apart while reading runs fast). */
  drilledAt?: number;
  /** Per drill skill: asked, right, the current run of right answers. */
  skills: Record<string, { n: number; right: number; streak: number }>;
  /** Drills asked in all (also the seed of the next one). */
  drills: number;
  right: number;
  /** Domains the owner asked to put first. */
  focus: string[];
  /** Topics read but not yet digested (no model was reachable): [docId, domainId, topic]. */
  pending: [string, string, string][];
  /** Per unanswered question: how many sessions it failed in (given up after three). */
  gapFails: Record<string, number>;
  /**
   * [school] The library's locks (school/reading.ts `studyLock`, read once a session): the school stage he is at;
   * absent until SCHOOL is first opened. A topic above his stage is passed over and kept in `held` ([index, level])
   * — read first once its level opens, never lost; a field with only held topics left waits, unfinished.
   */
  lock?: StudyLock | null;
  held?: Record<string, [number, 1 | 2 | 3][]>;
  /** Per field: topics passed over because their source's licence forbids feeding it to an AI (OpenStax); when the reason was logged. */
  licence?: { skipped: Record<string, number>; notedAt?: number };
}
/** Why OpenStax pages are not read any more (logged once in the study log; the LEARN tab links them instead). */
export const OPENSTAX_REASON = 'OpenStax: licence allows reading, not ingestion; linked in LEARN';
const MAX_GAP_FAILS = 3;
/** Link-only topics passed over in one session without using up its reads (a field's whole run of them, at most). */
const MAX_SKIPS = 400;

export const STUDY_KEY = 'study:state';
const UA = 'Ghosty/2.0 (personal assistant; https://github.com/wvks62vknw-sys/Ghosty)';
/** Characters of a source kept per topic (the gist, not the whole book). */
const MAX_READ = 30_000;
const MAX_BYTES = 600_000;
/** Readings waiting for a model (no cheap model free): digested later, oldest first. */
const MAX_PENDING = 240;
/** The next session while there is reading to do and room: almost at once. */
export const QUICK_TICK = 10_000;
/** Quick sessions a day: each alarm writes the day's meter to KV (1,000 free writes a day, shared). */
export const QUICK_TICKS = 200;
/** Topics a field's Wikipedia outline may add in a week, and in all (its stored list stays small). */
export const WEEKLY_GROWTH = 200;
export const MAX_GROWN = 1500;
/** The STUDY ALL switch, as FOCUS words (the route takes only on, now and focus): see matchDomains. */
export const ALL_ON = 'study-all-on';
export const ALL_OFF = 'study-all-off';
const moreKey = (domain: string) => `study:more:${domain}`;

/** The first domain's topics as [title, kind] pairs (the shape older code and tests know). */
export const CURRICULUM: [string, SourceKind][] = (DOMAINS[0]?.topics ?? []).map((t) => [t.t, t.k]);
export { DOMAINS, TOPIC_COUNT };

export interface StudyOptions {
  /** Ask a model (the cheap tier) and get its reply; absent or failing: reading only. */
  ai?: (system: string, user: string) => Promise<string>;
  /** Room left in the day's database allowance (meter.spare()); false: nothing is written this session. */
  spare?: boolean;
  /** Caps for this session and for the day (a field's weekly outline look adds at most three page reads to its session). */
  reads?: number;
  aiCalls?: number;
  dailyReads?: number;
  dailyAi?: number;
  now?: number;
}
export interface StudyReport {
  state: StudyState;
  did: { reads: number; digests: number; drills: number };
  /** When the next session should run, ms from now. */
  next: number;
}

const QUARTER = 15 * 60_000;
const HOUR = 3600_000;
const WEEK = 7 * 86_400_000;
const weekOf = (now: number) => String(Math.floor(now / WEEK));
const todayUtc = (now: number) => new Date(now).toISOString().slice(0, 10);
const untilMidnight = (now: number) => Math.floor(now / 86_400_000) * 86_400_000 + 86_400_000 - now;

const looksLikeQuestion = (t: string) => /\?\s*$/.test(t) || /^(what|how|why|who|when|where|which|explain|tell me about|define|describe)\b/i.test(t.trim());

/** Remember a question the library couldn't answer, to study it later. */
export async function noteGap(storage: DurableObjectStorage, question: string): Promise<void> {
  const q = question.replace(/\s+/g, ' ').trim();
  if (q.length < 8 || q.length > 200 || !looksLikeQuestion(q)) return;
  // A question about a number plate is about one car, looked up once: never kept for study.
  if (mentionsPlate(q)) return;
  const st = await loadStudy(storage);
  if (!st.on || st.gaps.some((g) => g.toLowerCase() === q.toLowerCase())) return;
  st.gaps = [...st.gaps, q].slice(-20);
  await storage.put(STUDY_KEY, st);
}

export async function loadStudy(storage: DurableObjectStorage): Promise<StudyState> {
  const raw = (await storage.get<Partial<StudyState>>(STUDY_KEY)) ?? {};
  const base: StudyState = {
    on: true, i: 0, gaps: [], sessions: 0, cursor: {}, domains: {}, day: '', today: { reads: 0, digests: 0, drills: 0, ai: 0, finished: 0, quick: 0 }, skills: {}, drills: 0, right: 0, focus: [], pending: [], gapFails: {},
    queue: [], finished: {}, all: true, asked: [], grown: {}, pace: [],
  };
  const st: StudyState = { ...base, ...raw } as StudyState;
  st.today = { ...base.today, ...(raw.today ?? {}) };
  // The STUDY ALL switch arrives as FOCUS words (matchDomains): it is a setting, not a field.
  for (const f of st.focus) if (f === ALL_ON || f === ALL_OFF) st.all = f === ALL_ON;
  st.focus = st.focus.filter((f) => f !== ALL_ON && f !== ALL_OFF);
  planQueue(st);
  return st;
}

/**
 * The queue, from the owner's focus and STUDY ALL: the focus fields first (a finished one newly put
 * first is read again from its start — the owner asked), then the fields already queued, in order;
 * with nothing queued and STUDY ALL on, the next unfinished field of the curriculum. Finished fields
 * never stay queued. Pure and repeatable, so every reader of the state sees the same queue.
 */
function planQueue(st: StudyState): void {
  const open = (id: string) => !!domainById(id) && !st.finished[id] && !waits(st, id);
  for (const id of st.focus) {
    if (domainById(id) && !st.asked.includes(id) && st.finished[id]) {
      delete st.finished[id];
      st.cursor[id] = 0;
      if (st.licence?.skipped[id]) delete st.licence.skipped[id]; // passed over again as it is read again
    }
  }
  st.asked = st.focus.filter((id) => !!domainById(id));
  st.queue = [...new Set([...st.focus.filter(open), ...st.queue.filter(open)])];
  if (!st.queue.length && st.all && st.on) {
    const next = DOMAINS.find((d) => open(d.id));
    if (next) st.queue = [next.id];
  }
}

/** [school] A field that has only topics above his school stage left (held): it waits for his stage, unfinished. */
function waits(st: StudyState, id: string): boolean {
  const held = st.held?.[id];
  if (!st.lock || !held?.length || st.focus.includes(id)) return false;
  const total = (domainById(id)?.topics.length ?? 0) + (st.grown[id]?.n ?? 0);
  return (st.cursor[id] ?? 0) >= total && !held.some(([, l]) => topicUnlocked(st.lock!.stage, l));
}

/** The topics a field's Wikipedia outline added (growField), in the order they are read. */
export async function grownTopics(storage: DurableObjectStorage, domain: string): Promise<Topic[]> {
  const text = await storage.get<string>(moreKey(domain)).catch(() => undefined);
  return typeof text === 'string' ? parseTopics(text) : [];
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  return (await r.json()) as T;
}

const WIKI_HOSTS: Record<string, string> = { wiki: 'en.wikipedia.org', wikibooks: 'en.wikibooks.org', wikiversity: 'en.wikiversity.org' };
/** The Swift book's page addresses are the title in lower case with the spaces removed — except a few chapters whose page is named differently. */
const SWIFT_SLUGS: Record<string, string> = { 'a swift tour': 'guidedtour', 'structures and classes': 'classesandstructures', 'opaque and boxed protocol types': 'opaquetypes', 'the basics': 'thebasics', 'about swift': 'aboutswift' };
const swiftSlug = (t: string) => SWIFT_SLUGS[t.toLowerCase().trim()] ?? t.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Find one good source for a topic: a URL (or an arXiv id) that readSource can read. */
export async function findSource(topic: string, kind: SourceKind): Promise<string | null> {
  if (kind === 'mdn') {
    const j = await getJson<{ documents?: { mdn_url: string }[] }>(`https://developer.mozilla.org/api/v1/search?locale=en-US&size=1&q=${encodeURIComponent(topic)}`);
    const u = j.documents?.[0]?.mdn_url;
    if (u) return `https://developer.mozilla.org${u}`;
  }
  if (kind === 'arxiv') {
    const r = await fetch(`https://export.arxiv.org/api/query?max_results=1&sortBy=relevance&search_query=${encodeURIComponent(`all:${topic}`)}`, { headers: { 'User-Agent': UA } });
    const id = r.ok ? (await r.text()).match(/<id>https?:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?<\/id>/)?.[1] : undefined;
    if (id) return id;
  }
  if (kind === 'swift') return `https://docs.swift.org/swift-book/documentation/the-swift-programming-language/${swiftSlug(topic)}/`;
  // a classic text: "2680 Meditations" — the number is the book's Project Gutenberg id
  if (kind === 'gutenberg') return /^\d{1,6}\b/.test(topic.trim()) ? gutenbergTextUrl(Number(topic.trim().match(/^\d{1,6}/)![0])) : null;
  // OpenStax's licence now forbids ingestion into AI models: link-only (studySession passes these over, OPENSTAX_REASON).
  if (kind === 'openstax') return null;
  // an exact article title (from a field's outline): read straight away, no search needed
  if (kind === 'wikipage') return `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(topic.replace(/ /g, '_'))}`;
  const host = WIKI_HOSTS[kind] ?? 'en.wikipedia.org';
  const j = await getJson<{ query?: { search?: { title: string }[] } }>(`https://${host}/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(topic)}`);
  const t = j.query?.search?.[0]?.title;
  return t ? `https://${host}/api/rest_v1/page/html/${encodeURIComponent(t.replace(/ /g, '_'))}` : null;
}

async function readCapped(r: Response, max = MAX_BYTES): Promise<string> {
  if (!r.body) return '';
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(size, max));
  let o = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.max(0, all.length - o));
    all.set(part, o);
    o += part.length;
  }
  return new TextDecoder().decode(all);
}

/** Fetch a source and turn it into plain text: a web page, or an arXiv paper (abstract + HTML full text). */
export async function readSource(source: string): Promise<{ title: string; text: string; url: string }> {
  // new-style ids (2301.00001) and the pre-2007 archive/NNNNNNN form (quant-ph/9508027)
  const arxiv = source.match(/^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/);
  if (arxiv) {
    const id = arxiv[1]!;
    const abs = await fetch(`https://arxiv.org/abs/${id}`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!abs.ok) throw new Error(`arxiv.org answered ${abs.status}`);
    const absHtml = await readCapped(abs);
    const title = (absHtml.match(/<meta name="citation_title" content="([^"]+)"/)?.[1] ?? htmlToText(absHtml).title).replace(/^\[[^\]]+\]\s*/, '').trim();
    const abstract = htmlToText(absHtml.match(/<blockquote class="abstract[^"]*">([\s\S]*?)<\/blockquote>/)?.[1] ?? '').text.replace(/^Abstract:\s*/i, '');
    let full = '';
    try {
      const r = await fetch(`https://arxiv.org/html/${id}`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
      if (r.ok) full = htmlToText((await readCapped(r, 1_500_000)).replace(/<math[\s\S]*?<\/math>/g, ' [formula] ')).text;
    } catch {
      /* the abstract alone is still worth keeping */
    }
    return { title: title || `arXiv ${id}`, text: `${title}\n\nAbstract: ${abstract}\n\n${full}`, url: `https://arxiv.org/abs/${id}` };
  }
  const r = await fetch(source, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${new URL(source).hostname} answered ${r.status}`);
  const raw = await readCapped(r);
  if (/^https:\/\/www\.gutenberg\.org\/cache\/epub\/\d+\/pg\d+\.txt$/.test(source)) {
    // a Gutenberg book: the licence header and footer off, the chapters in order (a session reads its first part)
    const book = gutenbergText(raw);
    const title = `${book.title || source}${book.author ? ` — ${book.author}` : ''}`;
    return { title, text: `${title}\n\n${book.chapters.map((c) => `${c.heading}\n\n${c.text}`).join('\n\n')}`, url: `https://www.gutenberg.org/ebooks/${source.match(/pg(\d+)\.txt$/)![1]}` };
  }
  const type = r.headers.get('content-type') ?? '';
  const { title, text } = /html|xml/.test(type) || /^\s*</.test(raw) ? htmlToText(raw) : { title: '', text: raw };
  return { title: title || new URL(source).pathname.split('/').filter(Boolean).pop() || source, text, url: source };
}

const readDoc = (domain: string) => `read_${domain}`;

export type Level = 'beginner' | 'intermediate' | 'advanced';
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
/**
 * A topic's level from where it sits in its field's list: the first third beginner, the middle
 * third intermediate, the last third advanced. The lists are written basics first and the
 * cursor reads each field in that order, so a field is studied beginner → intermediate →
 * advanced, and the round-robin across fields (least-read fraction first) fills every field's
 * beginner third before any intermediate one.
 */
export function topicLevel(index: number, count: number): Level {
  if (count <= 0 || index < 0) return 'beginner';
  const frac = index / count;
  return frac < 1 / 3 ? 'beginner' : frac < 2 / 3 ? 'intermediate' : 'advanced';
}

/**
 * The same source listed in two fields (Big O notation in algorithms and in discrete maths, say) is
 * read once: the second field copies the first field's section instead of fetching it again — one
 * fetch fewer, the same text, and the field still gets its own digest. Found from the cursors, so
 * nothing extra is stored.
 */
export function readElsewhere(st: StudyState, domain: string, topic: Topic): { domain: string; heading: string } | null {
  const key = `${topic.k}|${topic.t.trim().toLowerCase()}`;
  for (const d of DOMAINS) {
    if (d.id === domain) continue;
    const read = Math.min(d.topics.length, st.cursor[d.id] ?? 0);
    for (let i = 0; i < read; i++) {
      const t = d.topics[i]!;
      if (`${t.k}|${t.t.trim().toLowerCase()}` === key) return { domain: d.id, heading: t.t.slice(0, 180) };
    }
  }
  return null;
}
const digestDoc = (domain: string) => `digest_${domain}`;
export const QUIZ_DOC = 'study_quiz';
export const LOG_DOC = 'notes_study';

/** Is a field's weekly look at its Wikipedia outline due? (A failed look is tried again after six hours.) */
function growDue(st: StudyState, domain: string, now: number): boolean {
  const g = st.grown[domain];
  if (!OUTLINES[domain]?.length || (g && (g.wk === weekOf(now) || g.n >= MAX_GROWN))) return false;
  return !(g?.fail && now - g.fail < 6 * HOUR);
}

/**
 * The next piece to read: the field at the head of the queue, from where its cursor stands (its own
 * curriculum first, then what its outline added). A field read to the end is finished and the next
 * one starts — unless its weekly outline look is due, which comes first (`null`: the next session).
 */
async function nextPiece(storage: DurableObjectStorage, st: StudyState, now: number, more: Map<string, Topic[]>): Promise<{ domain: string; topic: Topic; index: number; held?: boolean } | null> {
  while (st.queue.length) {
    const id = st.queue[0]!;
    const d = domainById(id);
    if (!d) {
      st.queue.shift();
      continue;
    }
    if (!more.has(id)) more.set(id, await grownTopics(storage, id));
    const extra = more.get(id)!;
    const i = st.cursor[id] ?? 0;
    // [school] The library's locks: only the levels his school stage has unlocked (and the books on his open
    // shelves); a FOCUS the owner typed is read whole. Topics passed over are held, read once their level opens.
    const at = (k: number) => (k < d.topics.length ? d.topics[k]! : extra[k - d.topics.length]!);
    const total = d.topics.length + extra.length;
    const free = (k: number) => !st.lock || st.focus.includes(id) || lockOpen(st.lock, at(k));
    const held = st.held?.[id] ?? [];
    const back = held.find(([k]) => k < total && free(k));
    if (back) return { domain: id, topic: at(back[0]), index: back[0], held: true };
    if (st.lock && !st.focus.includes(id)) {
      if (![1, 2, 3].some((l) => topicUnlocked(st.lock!.stage, l as 1 | 2 | 3)) && !(i < total && free(i))) return null; // nothing open at his stage: the queue waits
      let j = i;
      for (; j < total && !free(j); j++) held.push([j, at(j).l]);
      if (j > i) ((st.held ??= {})[id] = held), (st.cursor[id] = j);
      if (j < total) return { domain: id, topic: at(j), index: j };
      if (held.length) {
        st.queue.shift();
        planQueue(st);
        continue;
      }
    }
    if (i < total) return { domain: id, topic: at(i), index: i };
    if (growDue(st, id, now)) return null;
    st.finished[id] = now;
    st.today.finished++;
    st.queue.shift();
    planQueue(st);
  }
  return null;
}

/** What every outline opens with ("physics is an academic discipline, a science…"): not study material. */
const GENERIC = new Set(['academic discipline', 'science', 'natural science', 'physical science', 'biological science', 'social science', 'formal science', 'applied science', 'branch of science', 'field of study', 'discipline (academia)', 'knowledge', 'humanities']);

/** Outline sections about people, places and bodies rather than ideas ("Influential physicists", "Chemistry organizations"). */
const NOISE = /\b(people|persons|personalities|scientists|physicists|chemists|mathematicians|biologists|economists|philosophers|engineers|figures|pioneers|organi[sz]ations|institutions|institutes|societies|associations|journals|publications|awards|prizes|universities|colleges|companies|museums)\b/i;

/**
 * The articles an outline page links, with a rough level from where each sits: the first link of
 * every list item (the item's subject; the links in its description are left alone), its depth the
 * section's (h2 1, h3 2, h4 3) plus how deep the list is nested — 1 basic, 2 intermediate, 3 or more
 * advanced. Navigation boxes, sidebars, notes and the See also / References / External links
 * sections are skipped, and so are other lists, outlines and indexes. Works on Wikipedia's rendered
 * HTML (links "/wiki/X", "./X" or "https://en.wikipedia.org/wiki/X"); no DOM needed.
 */
export function outlineLinks(html: string, self = ''): { t: string; l: 1 | 2 | 3 }[] {
  const out: { t: string; l: 1 | 2 | 3 }[] = [];
  const seen = new Set<string>([self.toLowerCase()]);
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '');
  const tags = /<(\/?)(h[2-6]|ul|ol|li|a|table|div)\b([^>]*)>/gi;
  let skip: { tag: string; depth: number } | null = null;
  let heading = 2;
  /** The heading level of a section being left out (notes, links, people and institutions), 0 when none. */
  let muted = 0;
  let lists = 0;
  const items: boolean[] = [];
  for (let m = tags.exec(clean); m; m = tags.exec(clean)) {
    const close = m[1] === '/';
    const tag = m[2]!.toLowerCase();
    const attrs = m[3] ?? '';
    if (skip) {
      if (tag === skip.tag) skip.depth += close ? -1 : 1;
      if (skip.depth <= 0) skip = null;
      continue;
    }
    if (!close && (tag === 'table' || tag === 'div') && /class="[^"]*\b(navbox|sidebar|infobox|hatnote|reflist|refbegin|references|metadata|ambox|portal|toc|noprint|thumb|side-box)/i.test(attrs)) {
      skip = { tag, depth: 1 };
      continue;
    }
    if (tag[0] === 'h') {
      if (close) continue;
      heading = Number(tag[1]);
      const end = clean.indexOf('</h', tags.lastIndex);
      const text = clean.slice(tags.lastIndex, end < 0 ? tags.lastIndex : end).replace(/<[^>]*>/g, '').trim();
      if (muted && heading <= muted) muted = 0;
      if (!muted && (/^(see also|references|notes|external links|further reading|bibliography|sources|citations|footnotes|notes and references|works cited)$/i.test(text) || NOISE.test(text))) muted = heading;
      continue;
    }
    if (tag === 'ul' || tag === 'ol') lists = Math.max(0, lists + (close ? -1 : 1));
    else if (tag === 'li') {
      if (close) items.pop();
      else items.push(false);
    } else if (tag === 'a' && !close) {
      if (muted || !lists || !items.length || items[items.length - 1]) continue;
      const href = attrs.match(/href="([^"]*)"/)?.[1] ?? '';
      const path = href.match(/^(?:\.\/|\/wiki\/|(?:https?:)?\/\/en\.wikipedia\.org\/wiki\/)([^#?]+)/)?.[1];
      if (!path) continue;
      items[items.length - 1] = true;
      let t = path;
      try {
        t = decodeURIComponent(path);
      } catch {
        /* a stray % in a title: keep it as written */
      }
      t = t.replace(/_/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
      if (!t || t.length > 120 || /^(File|Image|Category|Wikipedia|Help|Portal|Template|Template talk|Special|Talk|User|Module|Draft|MediaWiki|Wiktionary|wikt|Book|TimedText):/i.test(t)) continue;
      if (/^(Outline|Index|Lists?|Glossary|Bibliography|Timeline) of\b/i.test(t) || /\(data page\)$/i.test(t) || GENERIC.has(t.toLowerCase())) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const depth = heading - 1 + Math.max(0, lists - 1);
      out.push({ t, l: depth <= 1 ? 1 : depth === 2 ? 2 : 3 });
    }
  }
  return out;
}

/**
 * A field's curriculum grows: its Wikipedia outline pages (outlines.ts) are read and the articles
 * they link that the curriculum does not have yet (in any field, or already added) are added to
 * the end of the field, basics first — at most WEEKLY_GROWTH a week and MAX_GROWN in all; the rest
 * wait for next week's look. At most three page reads, once a week per field. Never throws.
 */
export async function growField(storage: DurableObjectStorage, st: StudyState, domain: string, now = Date.now(), lib?: Library): Promise<{ added: number; found: number; fetched: number }> {
  const titles = OUTLINES[domain] ?? [];
  const d = domainById(domain);
  if (!d || !titles.length) return { added: 0, found: 0, fetched: 0 };
  const have = new Set<string>();
  for (const x of DOMAINS) for (const t of x.topics) have.add(t.t.trim().toLowerCase());
  const old = await grownTopics(storage, domain);
  for (const t of old) have.add(t.t.toLowerCase());
  const fresh: { t: string; l: 1 | 2 | 3 }[] = [];
  let fetched = 0;
  let failed = 0;
  for (const title of titles.slice(0, 3)) {
    fetched++;
    try {
      const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&action=render`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
      if (!r.ok) throw new Error(`en.wikipedia.org answered ${r.status}`);
      for (const x of outlineLinks(await readCapped(r), title)) {
        const key = x.t.toLowerCase();
        if (have.has(key)) continue;
        have.add(key);
        fresh.push(x);
      }
    } catch {
      failed++;
    }
  }
  const g = (st.grown[domain] ??= { n: old.length, wk: '', added: 0, found: 0, at: 0 });
  if (failed === fetched) {
    g.fail = now; // Wikipedia unreachable: another look in a few hours
    return { added: 0, found: 0, fetched };
  }
  const room = Math.max(0, Math.min(WEEKLY_GROWTH, MAX_GROWN - old.length));
  const take = fresh.map((x, i) => ({ ...x, i })).sort((a, b) => a.l - b.l || a.i - b.i).slice(0, room);
  if (take.length) {
    const lines = take.map((x) => `${x.l}|wikipage|${x.t.replace(/\n/g, ' ')}`).join('\n');
    const text = await storage.get<string>(moreKey(domain)).catch(() => undefined);
    await storage.put(moreKey(domain), typeof text === 'string' && text ? `${text}\n${lines}` : lines);
  }
  Object.assign(g, { n: old.length + take.length, wk: weekOf(now), added: take.length, found: fresh.length, at: now });
  delete g.fail;
  if (lib && take.length) await lib.note(LOG_DOC, "Ghosty's study log", 'notes', { heading: `More to read: ${d.name}`.slice(0, 180), text: `${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} — Wikipedia's outline added ${take.length} new topics to ${d.name}${fresh.length > take.length ? ` (${fresh.length - take.length} more wait for next week)` : ''}.` }).catch(() => undefined);
  return { added: take.length, found: fresh.length, fetched };
}

function bump(st: StudyState, domain: string, field: 'read' | 'digested' | 'failed'): void {
  st.domains[domain] ??= { read: 0, digested: 0, failed: 0 };
  st.domains[domain][field]++;
}

const DIGEST_SYSTEM =
  'You are Ghosty, studying a text to remember it well. Write a study note in plain text, at most 450 words, with exactly these headed sections: SUMMARY (3–6 sentences, the essentials); KEY FACTS (5 one-line facts, with numbers, names and dates where the text gives them); WORKED EXAMPLE OR PITFALL (one concrete example of using this, or a common mistake and how to avoid it); SELF-TEST (3 short questions, each followed by its answer on the next line, "Q:" and "A:"). Use only what the text says; if the text is thin, say so in SUMMARY and keep the note short. No preamble, no markdown symbols.';
const DRILL_SYSTEM = 'Answer the question. Work it out briefly if needed, then end with one line of the form "Answer: …" giving just the result (a number, a word, a list, or the letter for a multiple-choice question).';

/** Pick a skill to drill: the shakiest first, with some variety. */
function pickSkill(st: StudyState): number {
  let best = 0;
  let bestScore = Infinity;
  for (let i = 0; i < SKILLS.length; i++) {
    const s = st.skills[SKILLS[i]![0]];
    const acc = s && s.n ? s.right / s.n : 0.5;
    const seen = s?.n ?? 0;
    // low accuracy and few askings come first; a little rotation so the same one does not repeat
    const score = acc * 2 + Math.min(seen, 10) / 10 + ((st.drills + i) % SKILLS.length) / SKILLS.length;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** One study session. Never throws. */
export async function studySession(storage: DurableObjectStorage, lib: Library, opts: StudyOptions = {}): Promise<StudyReport> {
  const now = opts.now ?? Date.now();
  const st = await loadStudy(storage);
  const did = { reads: 0, digests: 0, drills: 0 };
  if (!st.on || !lib.available) return { state: st, did, next: HOUR };
  if (st.day !== todayUtc(now)) {
    st.day = todayUtc(now);
    st.today = { reads: 0, digests: 0, drills: 0, ai: 0, finished: 0, quick: 0 };
  }
  const spare = opts.spare !== false;
  // A tick is a handful of page reads and model calls (the Worker's CPU time per run is small); the day's caps are ceilings — the meter decides first.
  const caps = { reads: opts.reads ?? 5, ai: opts.aiCalls ?? 6, dailyReads: opts.dailyReads ?? 1000, dailyAi: opts.dailyAi ?? 600 };
  if (!spare) {
    // The day's database allowance is nearly used up: nothing is written until the reset.
    st.last = { at: now, topic: 'waiting', error: "most of today's database allowance is used; studying again after midnight UTC", kind: 'read' };
    await storage.put(STUDY_KEY, st).catch(() => undefined);
    return { state: st, did, next: Math.max(HOUR, untilMidnight(now) + 5 * 60_000) };
  }
  st.sessions++;
  // [school] His school stage, once a session: what the curriculum may read now (null: SCHOOL never opened).
  st.lock = await studyLock(storage).catch(() => st.lock ?? null);
  planQueue(st);
  let aiLeft = caps.ai;
  const useAi = async (system: string, user: string): Promise<string | null> => {
    if (!opts.ai || aiLeft <= 0 || st.today.ai >= caps.dailyAi) return null;
    aiLeft--;
    st.today.ai++;
    try {
      return await opts.ai(system, user);
    } catch {
      aiLeft = 0; // no model reachable right now: the rest waits for the next session
      return null;
    }
  };

  // ---------- 0. QUEUE and GROW ----------
  // Everything read and STUDY ALL on: a finished field whose weekly outline look is due is opened
  // again for what its outline adds (its cursor stays: nothing is read twice).
  if (!st.queue.length && st.all) {
    const again = DOMAINS.find((d) => st.finished[d.id] && growDue(st, d.id, now));
    if (again) {
      delete st.finished[again.id];
      st.queue = [again.id];
    }
  }
  // The field being read looks at its outline once a week (at most three page reads, besides the session's reads).
  let grew = 0;
  const head = st.queue[0];
  if (head && growDue(st, head, now) && st.today.reads < caps.dailyReads) {
    try {
      grew = (await growField(storage, st, head, now, lib)).added;
    } catch {
      (st.grown[head] ??= { n: 0, wk: '', added: 0, found: 0, at: 0 }).fail = now; // its list could not be saved: another look later
    }
  }

  // ---------- 1. READ ----------
  // A question whose source fails is held aside until the session ends (tried once a session, so
  // the curriculum still moves), and given up after a few sessions.
  const retry: string[] = [];
  const more = new Map<string, Topic[]>();
  let skips = 0;
  for (let n = 0; n < caps.reads && st.today.reads < caps.dailyReads; n++) {
    const gap = st.gaps.shift();
    const pickd = gap ? null : await nextPiece(storage, st, now, more);
    if (!gap && !pickd) break; // nothing queued (or an outline look comes first): digests and drills carry on
    const topic = gap ?? pickd!.topic.t;
    const kind: SourceKind = gap ? (/\b(js|javascript|css|html|dom|browser|web api|canvas|webgl)\b/i.test(gap) ? 'mdn' : 'wiki') : pickd!.topic.k;
    const domain = gap ? 'questions' : pickd!.domain;
    if (pickd?.held) st.held![pickd.domain] = st.held![pickd.domain]!.filter(([k]) => k !== pickd.index);
    else if (pickd) st.cursor[pickd.domain] = pickd.index + 1;
    if (pickd && kind === 'openstax') {
      // Link-only (its licence forbids ingestion): passed over like a piece already read, never a failure, and it
      // does not use up one of the session's reads. The reason goes in the study log once.
      const lic = (st.licence ??= { skipped: {} });
      lic.skipped[pickd.domain] = (lic.skipped[pickd.domain] ?? 0) + 1;
      if (!lic.notedAt) {
        lic.notedAt = now;
        await lib.note(LOG_DOC, "Ghosty's study log", 'notes', { heading: 'Skipped for licence: OpenStax', text: `${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} — ${OPENSTAX_REASON}. Its pages in the curriculum are passed over.` }).catch(() => undefined);
      }
      if (skips++ < MAX_SKIPS) n--;
      continue;
    }
    try {
      let title = topic;
      let url = '';
      let body = '';
      let copiedFrom = '';
      const prior = pickd ? readElsewhere(st, pickd.domain, pickd.topic) : null;
      const kept0 = prior ? lib.sectionText(readDoc(prior.domain), prior.heading, MAX_READ + 400) : '';
      if (prior && kept0.trim().length >= 200) {
        // "<title>\nSource: <url>\n\n<text>" is how a section is filed below
        const m = kept0.match(/^([^\n]*)\nSource: (\S+)\n\n([\s\S]*)$/);
        title = m?.[1]?.trim() || topic;
        url = m?.[2] ?? '';
        body = (m?.[3] ?? kept0).slice(0, MAX_READ);
        copiedFrom = domainById(prior.domain)?.name ?? prior.domain;
      } else {
        const source = await findSource(topic, kind);
        if (!source) throw new Error('no source found');
        const got = await readSource(source);
        title = got.title;
        url = got.url;
        body = got.text.length > MAX_READ ? got.text.slice(0, MAX_READ) : got.text;
      }
      if (body.trim().length < 200) throw new Error('the source had almost no text');
      const docId = readDoc(domain);
      const heading = topic.slice(0, 180);
      const dname = domainById(domain)?.name ?? (domain === 'questions' ? 'Your questions' : domain);
      if (!lib.doc(docId)) lib.createDoc({ id: docId, title: `Reading: ${dname}`, source: 'self-study', kind: 'study' });
      // Re-reading a topic replaces its old text rather than adding a second copy.
      lib.removeSection(docId, heading);
      const passages = chunkText(`${title}\nSource: ${url}\n\n${body}`, { heading });
      let kept = 0;
      for (let i = 0; i < passages.length; i += 40) kept += await lib.addPassages(docId, passages.slice(i, i + 40));
      lib.finish(docId);
      st.today.reads++;
      st.i++;
      did.reads++;
      bump(st, domain, 'read');
      st.last = { at: now, topic, title, passages: kept, kind: 'read' };
      if (gap) delete st.gapFails[gap];
      await lib.note(LOG_DOC, "Ghosty's study log", 'notes', { heading: `Studied: ${topic}`, text: `${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} — ${copiedFrom ? `copied "${topic}" (${dname}) from the ${copiedFrom} notebook, already read` : `read "${topic}" (${dname}) from ${url}`}: "${title}", ${kept} passages.` });
      // ---------- 2. DIGEST (right away while the text is in hand) ----------
      const note = await useAi(DIGEST_SYSTEM, `TOPIC: ${topic}\nDOMAIN: ${dname}\n\nTEXT:\n${body.slice(0, 7000)}`);
      if (note) {
        await fileDigest(lib, domain, dname, topic, url, note);
        st.today.digests++;
        did.digests++;
        bump(st, domain, 'digested');
      } else if (opts.ai) {
        const entry: [string, string, string] = [docId, domain, topic];
        st.pending = [...st.pending, entry].slice(-MAX_PENDING);
      }
    } catch (e) {
      bump(st, domain, 'failed');
      const error = String((e as Error)?.message ?? e).slice(0, 200);
      st.last = { at: now, topic, error, kind: 'read' };
      if (gap) {
        // Only a definite miss counts against the question (no source, or a page with nothing in it);
        // a rate limit, an outage or a timeout is tried again next session without counting.
        const definite = /no source found|almost no text/.test(error);
        const fails = definite ? (st.gapFails[gap] = (st.gapFails[gap] ?? 0) + 1) : (st.gapFails[gap] ?? 0);
        if (fails < MAX_GAP_FAILS) retry.push(gap); // another session, another try
        else {
          delete st.gapFails[gap];
          await lib.note(LOG_DOC, "Ghosty's study log", 'notes', { heading: `Gave up: ${topic.slice(0, 160)}`, text: `${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} — could not find a source for "${topic}" after ${fails} tries (${error}).` }).catch(() => undefined);
        }
      }
    }
  }
  st.gaps = [...st.gaps, ...retry].slice(-20);

  // ---------- 2b. DIGEST what was read earlier without a model ----------
  while (st.pending.length && aiLeft > 0 && st.today.ai < caps.dailyAi) {
    const [docId, domain, topic] = st.pending[0]!;
    const text = lib.sectionText(docId, topic.slice(0, 180), 7000);
    if (!text) {
      st.pending.shift();
      continue;
    }
    const dname = domainById(domain)?.name ?? domain;
    const note = await useAi(DIGEST_SYSTEM, `TOPIC: ${topic}\nDOMAIN: ${dname}\n\nTEXT:\n${text}`);
    if (!note) break;
    st.pending.shift();
    await fileDigest(lib, domain, dname, topic, '', note);
    st.today.digests++;
    did.digests++;
    bump(st, domain, 'digested');
    st.last = { at: now, topic, title: 'digested', kind: 'digest' };
  }

  // ---------- 3. DRILL ----------
  // One a session — about a quarter of an hour apart while reading runs fast, so the model allowance goes on the notes.
  if (opts.ai && aiLeft > 0 && st.today.ai < caps.dailyAi && (!did.reads || now - (st.drilledAt ?? 0) >= QUARTER)) {
    st.drilledAt = now;
    const drill: Drill = makeDrill(pickSkill(st), st.drills + 1);
    const reply = await useAi(DRILL_SYSTEM, drill.q);
    if (reply !== null) {
      const ok = grade(drill, reply);
      st.drills++;
      st.today.drills++;
      did.drills++;
      if (ok) st.right++;
      const s = (st.skills[drill.skill] ??= { n: 0, right: 0, streak: 0 });
      s.n++;
      if (ok) {
        s.right++;
        s.streak++;
      } else s.streak = 0;
      const dname = domainById(drill.domain)?.name ?? drill.domain;
      await lib.note(QUIZ_DOC, "Ghosty's drills", 'study', {
        heading: `${drill.skill} · ${ok ? 'right' : 'wrong'}`,
        text: `#${st.drills} ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} · ${dname} · ${drill.skill}\nQ: ${drill.q.replace(/\s+/g, ' ')}\nGhosty: ${reply.replace(/\s+/g, ' ').slice(0, 600)}\nResult: ${ok ? 'RIGHT' : `WRONG — correct answer: ${drill.answer}`}`,
      });
      st.last = { at: now, topic: `${drill.skill} drill`, title: ok ? 'right' : `wrong (correct: ${drill.answer})`, kind: 'drill' };
    }
  }

  if (did.reads) st.pace = [...st.pace, [now, did.reads] as [number, number]].slice(-12);
  // Cadence: almost at once while there is reading to do and room (QUICK_TICKS a day), then a quarter
  // of an hour while there is work; otherwise an hour; the day's caps reached: the reset.
  const reading = st.queue.length > 0 || st.gaps.length > 0;
  const workLeft = reading || st.pending.length > 0 || !!opts.ai;
  const capped = st.today.reads >= caps.dailyReads && (!opts.ai || st.today.ai >= caps.dailyAi);
  let next = HOUR;
  if (capped) next = Math.max(HOUR, untilMidnight(now) + 5 * 60_000);
  else if (reading && (did.reads || grew) && st.today.reads < caps.dailyReads && st.today.quick < QUICK_TICKS) {
    st.today.quick++;
    next = QUICK_TICK;
  } else if (workLeft && (did.reads || did.digests || did.drills || grew)) next = QUARTER;
  await storage.put(STUDY_KEY, st).catch(() => undefined);
  await hurryJob(storage, next);
  return { state: st, did, next };
}

/**
 * Bring the study job forward when this session wants the next one sooner than it is due (STUDY
 * pressed in the Library tab runs a session outside the alarm: the rest of the field follows at once,
 * not at the job's old time). From the alarm the job is already due, so this changes nothing there.
 */
async function hurryJob(storage: DurableObjectStorage, next: number): Promise<void> {
  try {
    const job = (await loadJobs(storage)).find((j) => j.kind === 'study');
    if (job && job.next > Date.now() + next + 5000) await setNext(storage, job.id, Date.now() + next);
  } catch {
    /* no jobs here (a test's storage): nothing to bring forward */
  }
}

async function fileDigest(lib: Library, domain: string, dname: string, topic: string, url: string, note: string): Promise<void> {
  const docId = digestDoc(domain);
  if (!lib.doc(docId)) lib.createDoc({ id: docId, title: `Study notes: ${dname}`, source: 'written by Ghosty', kind: 'digest' });
  lib.removeSection(docId, topic.slice(0, 180));
  const text = `${topic}${url ? `\nSource: ${url}` : ''}\n\n${note.trim()}`.slice(0, 3900);
  await lib.addPassages(docId, [{ text, heading: topic.slice(0, 180) }]);
  lib.finish(docId);
}

/** Pieces a minute at the measured pace (the latest sessions that read, within the last two hours), or null while it is not known. */
export function paceOf(st: StudyState, now = Date.now()): number | null {
  const p = st.pace.filter(([at]) => now - at < 2 * HOUR);
  if (p.length < 2) return null;
  const span = p[p.length - 1]![0] - p[0]![0];
  const read = p.slice(1).reduce((n, [, r]) => n + r, 0);
  return span > 0 && read > 0 ? (read / span) * 60_000 : null;
}

/** "about 40 minutes", "about 3 hours", "about 2 days". */
export function timeLeftText(minutes: number): string {
  if (minutes < 1.5) return 'about a minute';
  if (minutes < 90) return `about ${Math.round(minutes)} minutes`;
  if (minutes < 36 * 60) return `about ${Math.round(minutes / 60)} hours`;
  return `about ${Math.round(minutes / 1440)} days`;
}

type FieldRow = { id: string; name: string; topics: number; read: number; digested: number; focus: boolean; finished: boolean; grown: number };

/** A summary for the Library tab: the queue and its honest status line, progress by field, the day's counts, drill accuracy. */
export function studySummary(st: StudyState, now = Date.now()): {
  topics: number;
  read: number;
  digested: number;
  domains: FieldRow[];
  /** Per level across every field's own curriculum: how many topics there are and how many are read ("beginner 40% · intermediate 12% · advanced 0%"). */
  levels: { level: Level; topics: number; read: number }[];
  today: StudyState['today'];
  drills: { asked: number; right: number; skills: { skill: string; n: number; right: number }[] };
  pending: number;
  /** The field being read now and the ones after it (the first is the current one). */
  queue: FieldRow[];
  current: (FieldRow & { minutesLeft: number | null }) | null;
  /** One honest line: "Reading Algebra & number theory · 212 of 480 · about 40 minutes left at this pace". */
  status: string;
  all: boolean;
  finished: number;
  /** Topics the fields' Wikipedia outlines added, in all and in their latest looks. */
  grown: { topics: number; latest: number };
  /** Link-only topics passed over for their licence (OpenStax). */
  licenceSkipped: number;
} {
  const domains: FieldRow[] = DOMAINS.map((d) => {
    const grown = st.grown[d.id]?.n ?? 0;
    const topics = d.topics.length + grown;
    return { id: d.id, name: d.name, topics, read: Math.max(0, Math.min(topics, st.cursor[d.id] ?? 0) - (st.held?.[d.id]?.length ?? 0) - (st.licence?.skipped[d.id] ?? 0)), digested: st.domains[d.id]?.digested ?? 0, focus: st.focus.includes(d.id), finished: !!st.finished[d.id], grown };
  });
  const levels = LEVELS.map((level) => ({ level, topics: 0, read: 0 }));
  for (const d of DOMAINS) {
    const read = Math.min(d.topics.length, st.cursor[d.id] ?? 0);
    for (let i = 0; i < d.topics.length; i++) {
      const row = levels[LEVELS.indexOf(topicLevel(i, d.topics.length))]!;
      row.topics++;
      // (an OpenStax page passed over is link-only: not counted as read)
      if (i < read && d.topics[i]!.k !== 'openstax' && !st.held?.[d.id]?.some(([k]) => k === i)) row.read++;
    }
  }
  const skills = Object.entries(st.skills)
    .map(([skill, s]) => ({ skill, n: s.n, right: s.right }))
    .sort((a, b) => a.right / Math.max(1, a.n) - b.right / Math.max(1, b.n));
  const queue = st.queue.map((id) => domains.find((d) => d.id === id)).filter((d): d is FieldRow => !!d);
  const head = queue[0];
  const pace = paceOf(st, now);
  const current = head ? { ...head, minutesLeft: pace ? (head.topics - head.read) / pace : null } : null;
  const finished = domains.filter((d) => d.finished).length;
  const status = !st.on
    ? 'Self-study is switched off'
    : current
      ? `Reading ${current.name} · ${current.read} of ${current.topics} · ${current.minutesLeft === null ? 'working out the pace' : `${timeLeftText(current.minutesLeft)} left at this pace`}`
      : finished === domains.length
        ? `Every field is read: ${finished} of ${domains.length}`
        : st.all
          ? 'Choosing the next field'
          : 'Nothing queued · pick a field and press STUDY';
  // [school] What is locked and why ("Level 2 topics unlock at A-level"), whenever SCHOOL keeps him to his stage.
  const lockNote = st.on && st.lock ? st.lock.line : '';
  const skipped = Object.values(st.licence?.skipped ?? {}).reduce((a, n) => a + n, 0);
  const licenceNote = skipped ? `${skipped} OpenStax page${skipped === 1 ? '' : 's'} skipped for licence (linked in LEARN)` : '';
  const grownAll = domains.reduce((n, d) => n + d.grown, 0);
  return {
    topics: TOPIC_COUNT + grownAll,
    read: domains.reduce((n, d) => n + d.read, 0),
    digested: domains.reduce((n, d) => n + d.digested, 0),
    domains,
    levels,
    today: st.today,
    drills: { asked: st.drills, right: st.right, skills },
    pending: st.pending.length,
    queue: queue.slice(0, 8),
    current,
    status: [!lockNote ? status : (st.lock && ![1, 2, 3].some((l) => topicUnlocked(st.lock!.stage, l as 1 | 2 | 3)) && !head?.focus) || !current ? lockNote : `${status} · ${lockNote}`, licenceNote].filter(Boolean).join(' · '),
    licenceSkipped: skipped,
    all: st.all,
    finished,
    grown: { topics: grownAll, latest: Object.values(st.grown).reduce((n, g) => n + (g.added ?? 0), 0) },
  };
}

/**
 * Domains matching the owner's words ("focus on physics and finance"): ids, best match first.
 * Whole words only, scored against the domain's id first (its short name), then its full name,
 * so "data structures" is algorithms, not databases.
 */
export function matchDomains(words: string): string[] {
  // A list of exact field ids, in order ("algebra-number-theory, physics-classical-modern": the Library
  // tab's STUDY), may carry the STUDY ALL switch ("study all off"): kept in the focus until loadStudy
  // turns it into the setting, because the Library route stores only on, now and focus.
  const parts = words.split(',').map((p) => p.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
  if (parts.length && parts.every((p) => domainById(p) || p === ALL_ON || p === ALL_OFF)) return [...new Set(parts)];
  const q = new Set(words.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w)));
  if (!q.size) return [];
  const hits = DOMAINS.map((d) => {
    const own = new Set([...d.id.split('-'), ...d.name.toLowerCase().split(/[^a-z0-9]+/)].filter((w) => w.length >= 2 && !STOP.has(w)));
    const matched = [...own].filter((w) => q.has(w)).length;
    return { id: d.id, matched, frac: matched / own.size };
  }).filter((x) => x.matched > 0);
  // The domains that match the most of the owner's words — all of them when they tie ("physics and
  // finance" is two), none of the weaker ones ("data structures" is algorithms, not databases too).
  const best = Math.max(0, ...hits.map((x) => x.matched));
  return hits.filter((x) => x.matched === best).sort((a, b) => b.frac - a.frac).map((x) => x.id);
}
const STOP = new Set(['the', 'and', 'or', 'of', 'on', 'in', 'to', 'for', 'with', 'about', 'a', 'an', 'at', 'by', 'from', 'focus', 'please', 'put', 'first', 'me', 'my', 'study', 'learn', 'more', 'also', 'then', 'its', 'it']);
