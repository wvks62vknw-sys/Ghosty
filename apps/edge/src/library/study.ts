/**
 * Self-study: Ghosty keeps learning on its own, around the clock, within the free plan.
 *
 * Every session (a background job; every 15 minutes while there is room, hourly otherwise):
 *   1. READ — the next topics of the curriculum (curriculum/), round-robin across its domains
 *      (the owner's focus domains first, and questions the library couldn't answer before
 *      anything), each fetched from a free source (Wikipedia, Wikibooks, Wikiversity, MDN,
 *      arXiv, the Swift book, OpenStax) and filed, without any AI, in that domain's reading
 *      notebook (one document per domain, one heading per topic: the library stays small).
 *   2. DIGEST — with a model (the cheap tier: keyless or small), a study note on what it just
 *      read: summary, key facts, a worked example or pitfall, self-test questions. Filed in
 *      the domain's digest notebook — the part that also goes to the owner's phone.
 *   3. DRILL — a question it sets itself (drills.ts: maths, computing, logic, facts; endless,
 *      checked without AI), answered by the model and graded. Right and wrong go in the quiz
 *      log with the correct answer; the per-skill scores show where it is reliable.
 * Caps per session and per day keep the brain's database allowance (meter.ts) and the free
 * model allowances safe; above 70% of the day's database allowance it waits for the reset.
 * Never throws: a failed source is logged and the next session carries on.
 */
import { chunkText } from '../../../../packages/shared/src/chunk';
import { mentionsPlate } from '../../../../packages/shared/src/plates';
import { gutenbergText, gutenbergTextUrl } from './importers';
import { htmlToText } from '../tools/web';
import { DOMAINS, TOPIC_COUNT, domainById, type SourceKind, type Topic } from './curriculum';
import { grade, makeDrill, SKILLS, type Drill } from './drills';
import type { Library } from './store';

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
  today: { reads: number; digests: number; drills: number; ai: number };
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
}
const MAX_GAP_FAILS = 3;

export const STUDY_KEY = 'study:state';
const UA = 'Ghosty/2.0 (personal assistant; https://github.com/wvks62vknw-sys/Ghosty)';
/** Characters of a source kept per topic (the gist, not the whole book). */
const MAX_READ = 30_000;
const MAX_BYTES = 600_000;
const MAX_PENDING = 60;

/** The first domain's topics as [title, kind] pairs (the shape older code and tests know). */
export const CURRICULUM: [string, SourceKind][] = (DOMAINS[0]?.topics ?? []).map((t) => [t.t, t.k]);
export { DOMAINS, TOPIC_COUNT };

export interface StudyOptions {
  /** Ask a model (the cheap tier) and get its reply; absent or failing: reading only. */
  ai?: (system: string, user: string) => Promise<string>;
  /** Room left in the day's database allowance (meter.spare()); false: nothing is written this session. */
  spare?: boolean;
  /** Caps for this session and for the day. */
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
  const base: StudyState = { on: true, i: 0, gaps: [], sessions: 0, cursor: {}, domains: {}, day: '', today: { reads: 0, digests: 0, drills: 0, ai: 0 }, skills: {}, drills: 0, right: 0, focus: [], pending: [], gapFails: {} };
  const st: StudyState = { ...base, ...raw } as StudyState;
  st.today = { ...base.today, ...(raw.today ?? {}) };
  return st;
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
  if (kind === 'openstax') return `https://openstax.org${topic.startsWith('/') ? topic : `/${topic}`}`;
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

/** The next topic to read: the owner's focus domains first, then every domain in turn. */
function nextTopic(st: StudyState): { domain: string; topic: Topic; index: number } | null {
  const order = [...st.focus.filter((f) => domainById(f)), ...DOMAINS.map((d) => d.id).filter((id) => !st.focus.includes(id))];
  if (!order.length) return null;
  // Round-robin by what has been read least (focus domains count double).
  let best: { domain: string; topic: Topic; index: number; score: number } | null = null;
  for (const id of order) {
    const d = domainById(id);
    if (!d) continue;
    const i = st.cursor[id] ?? 0;
    if (i >= d.topics.length) continue;
    const score = i / d.topics.length - (st.focus.includes(id) ? 1 : 0);
    if (!best || score < best.score) best = { domain: id, topic: d.topics[i]!, index: i, score };
  }
  return best;
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
    st.today = { reads: 0, digests: 0, drills: 0, ai: 0 };
  }
  const spare = opts.spare !== false;
  const caps = { reads: opts.reads ?? 3, ai: opts.aiCalls ?? 2, dailyReads: opts.dailyReads ?? 120, dailyAi: opts.dailyAi ?? 100 };
  if (!spare) {
    // The day's database allowance is nearly used up: nothing is written until the reset.
    st.last = { at: now, topic: 'waiting', error: "most of today's database allowance is used; studying again after midnight UTC", kind: 'read' };
    await storage.put(STUDY_KEY, st).catch(() => undefined);
    return { state: st, did, next: Math.max(HOUR, untilMidnight(now) + 5 * 60_000) };
  }
  st.sessions++;
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

  // ---------- 1. READ ----------
  // A question whose source fails is held aside until the session ends (tried once a session, so
  // the curriculum still moves), and given up after a few sessions.
  const retry: string[] = [];
  for (let n = 0; n < caps.reads && st.today.reads < caps.dailyReads; n++) {
    const gap = st.gaps.shift();
    const pickd = gap ? null : nextTopic(st);
    if (!gap && !pickd) break; // the whole curriculum is read: digests and drills carry on
    const topic = gap ?? pickd!.topic.t;
    const kind: SourceKind = gap ? (/\b(js|javascript|css|html|dom|browser|web api|canvas|webgl)\b/i.test(gap) ? 'mdn' : 'wiki') : pickd!.topic.k;
    const domain = gap ? 'questions' : pickd!.domain;
    if (pickd) st.cursor[pickd.domain] = pickd.index + 1;
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
  if (opts.ai && aiLeft > 0 && st.today.ai < caps.dailyAi) {
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

  await storage.put(STUDY_KEY, st).catch(() => undefined);
  // Cadence: a quarter of an hour while there is work and room; otherwise an hour; the day's caps reached: the reset.
  const workLeft = !!nextTopic(st) || st.gaps.length > 0 || st.pending.length > 0 || !!opts.ai;
  const capped = st.today.reads >= caps.dailyReads && (!opts.ai || st.today.ai >= caps.dailyAi);
  const next = capped ? Math.max(HOUR, untilMidnight(now) + 5 * 60_000) : workLeft && (did.reads || did.digests || did.drills) ? QUARTER : HOUR;
  return { state: st, did, next };
}

async function fileDigest(lib: Library, domain: string, dname: string, topic: string, url: string, note: string): Promise<void> {
  const docId = digestDoc(domain);
  if (!lib.doc(docId)) lib.createDoc({ id: docId, title: `Study notes: ${dname}`, source: 'written by Ghosty', kind: 'digest' });
  lib.removeSection(docId, topic.slice(0, 180));
  const text = `${topic}${url ? `\nSource: ${url}` : ''}\n\n${note.trim()}`.slice(0, 3900);
  await lib.addPassages(docId, [{ text, heading: topic.slice(0, 180) }]);
  lib.finish(docId);
}

/** A summary for the Library tab: progress by domain, the day's counts, drill accuracy. */
export function studySummary(st: StudyState): {
  topics: number;
  read: number;
  digested: number;
  domains: { id: string; name: string; topics: number; read: number; digested: number; focus: boolean }[];
  /** Per level across every field: how many topics there are and how many are read ("beginner 40% · intermediate 12% · advanced 0%"). */
  levels: { level: Level; topics: number; read: number }[];
  today: StudyState['today'];
  drills: { asked: number; right: number; skills: { skill: string; n: number; right: number }[] };
  pending: number;
} {
  const domains = DOMAINS.map((d) => ({ id: d.id, name: d.name, topics: d.topics.length, read: Math.min(d.topics.length, st.cursor[d.id] ?? 0), digested: st.domains[d.id]?.digested ?? 0, focus: st.focus.includes(d.id) }));
  const levels = LEVELS.map((level) => ({ level, topics: 0, read: 0 }));
  for (const d of domains) {
    for (let i = 0; i < d.topics; i++) {
      const row = levels[LEVELS.indexOf(topicLevel(i, d.topics))]!;
      row.topics++;
      if (i < d.read) row.read++;
    }
  }
  const skills = Object.entries(st.skills)
    .map(([skill, s]) => ({ skill, n: s.n, right: s.right }))
    .sort((a, b) => a.right / Math.max(1, a.n) - b.right / Math.max(1, b.n));
  return { topics: TOPIC_COUNT, read: domains.reduce((n, d) => n + d.read, 0), digested: domains.reduce((n, d) => n + d.digested, 0), domains, levels, today: st.today, drills: { asked: st.drills, right: st.right, skills }, pending: st.pending.length };
}

/**
 * Domains matching the owner's words ("focus on physics and finance"): ids, best match first.
 * Whole words only, scored against the domain's id first (its short name), then its full name,
 * so "data structures" is algorithms, not databases.
 */
export function matchDomains(words: string): string[] {
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
