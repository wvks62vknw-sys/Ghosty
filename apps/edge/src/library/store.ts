/**
 * Ghosty's library: everything the owner gives it to read (books, PDFs, notes, web pages,
 * papers, code) plus a built-in starter library, kept forever in the brain's own SQLite
 * database and searched without any AI:
 *
 *   - FTS5 full-text search with stemming and BM25 ranking finds candidate passages.
 *   - If Workers AI is connected (no key needed), passages also get embeddings (meaning
 *     vectors, bge-small) when they are added, and candidates are re-ranked by meaning.
 *
 * Only the few best passages ever reach the model, so a huge library costs almost nothing
 * per question. Cloudflare's free plan counts every database row read (5 million a day), so
 * nothing here may scan the whole library: `lib_pass` is a plain indexed table that mirrors
 * each passage's row id, document and section, and is what lookups and deletes go through
 * (FTS5's `doc` column is unindexed — `WHERE doc = ?` on lib_fts reads every row). Heavy work (reading files, cutting text into passages) happens in the
 * owner's browser; the brain only stores and searches (Cloudflare's free plan allows
 * ~10 ms of CPU per request).
 */
import type { Env } from '../env';
import { chunkText, joinPassages, type Passage } from '../../../../packages/shared/src/chunk';

export { chunkText, joinPassages } from '../../../../packages/shared/src/chunk';
import type { LibraryDoc, LibraryHit } from '../../../../packages/shared/src/protocol';
import { STARTER, type StarterDoc } from './starter';
import { rareTerms } from '../../../../packages/shared/src/meaning';
import { cost, neurons } from '../neurons';

export type { LibraryDoc, LibraryHit };

const EMBED_MODEL = '@cf/baai/bge-small-en-v1.5';
const MAX_PASSAGES_PER_CALL = 40;
const MAX_PASSAGE_CHARS = 4000;

const STOP = new Set(
  'a an and are as at be been but by can could did do does for from had has have how i if in into is it its me my no not of on or our so than that the their them then there these they this to was we were what when where which who why will with would you your about also any just like more most only other some such very use using want need make get show tell give please ghosty'.split(' '),
);

/** Meaningful words of a query (lower case, no stop words, at most 12). */
export function queryTerms(q: string): string[] {
  const seen = new Set<string>();
  for (const w of q.toLowerCase().match(/[a-z0-9][a-z0-9_+#.-]*[a-z0-9+#]|[a-z0-9]/g) ?? []) {
    const t = w.replace(/^[.-]+|[.-]+$/g, '');
    if (t.length < 2 || STOP.has(t) || seen.has(t)) continue;
    seen.add(t);
    if (seen.size >= 12) break;
  }
  return [...seen];
}

const bytesOf = (v: unknown): Uint8Array | null => (v instanceof ArrayBuffer ? new Uint8Array(v) : v instanceof Uint8Array ? v : null);
const vecOf = (v: unknown): Float32Array | null => {
  const b = bytesOf(v);
  return b && b.byteLength % 4 === 0 ? new Float32Array(b.slice().buffer) : null;
};
function cosine(a: Float32Array, b: Float32Array): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    d += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

/** The seeding pass in flight for each brain's storage (see seedStarter). */
const seeding = new WeakMap<object, Promise<boolean>>();

export class Library {
  private ready = false;

  constructor(
    private storage: DurableObjectStorage,
    private env: Env,
  ) {}

  /** False only where SQLite isn't available (some tests). */
  get available(): boolean {
    return !!this.storage.sql;
  }

  private get db(): SqlStorage {
    const s = this.storage.sql;
    if (!s) throw new Error('the library needs SQLite storage, which is not available here');
    if (!this.ready) {
      s.exec(`CREATE TABLE IF NOT EXISTS lib_docs (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT, kind TEXT, pages INTEGER DEFAULT 0, passages INTEGER DEFAULT 0, chars INTEGER DEFAULT 0, status TEXT DEFAULT 'adding', builtin INTEGER DEFAULT 0, at INTEGER)`);
      s.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS lib_fts USING fts5(text, heading, doc UNINDEXED, page UNINDEXED, tokenize = 'porter unicode61')`);
      s.exec(`CREATE TABLE IF NOT EXISTS lib_vec (rid INTEGER PRIMARY KEY, doc TEXT, v BLOB)`);
      s.exec(`CREATE INDEX IF NOT EXISTS lib_vec_doc ON lib_vec (doc)`);
      s.exec(`CREATE TABLE IF NOT EXISTS lib_pass (rid INTEGER PRIMARY KEY, doc TEXT NOT NULL, heading TEXT, chars INTEGER DEFAULT 0, h TEXT)`);
      s.exec(`CREATE INDEX IF NOT EXISTS lib_pass_doc ON lib_pass (doc, heading)`);
      s.exec(`CREATE INDEX IF NOT EXISTS lib_pass_h ON lib_pass (h)`);
      s.exec(`CREATE INDEX IF NOT EXISTS lib_pass_doc_rid ON lib_pass (doc, rid)`);
      s.exec(`CREATE TABLE IF NOT EXISTS lib_meta (k TEXT PRIMARY KEY, v TEXT)`);
      // One-time: libraries from before lib_pass existed get it filled from lib_fts (a single scan).
      const done = s.exec<{ v: string }>(`SELECT v FROM lib_meta WHERE k = 'pass_index'`).toArray()[0];
      if (!done) {
        s.exec(`INSERT OR IGNORE INTO lib_pass (rid, doc, heading, chars, h) SELECT rowid, doc, heading, length(text), length(text) || ':' || substr(text, 1, 160) FROM lib_fts`);
        s.exec(`INSERT OR REPLACE INTO lib_meta (k, v) VALUES ('pass_index', '1')`);
      }
      this.ready = true;
    }
    return s;
  }

  createDoc(d: { title: string; source?: string; kind?: string; pages?: number; builtin?: boolean; id?: string }): LibraryDoc {
    const id = d.id ?? `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const title = d.title.replace(/\s+/g, ' ').trim().slice(0, 200) || 'Untitled';
    this.db.exec(
      `INSERT OR REPLACE INTO lib_docs (id, title, source, kind, pages, passages, chars, status, builtin, at) VALUES (?, ?, ?, ?, ?, 0, 0, 'adding', ?, ?)`,
      id, title, (d.source ?? '').slice(0, 500), (d.kind ?? 'text').slice(0, 20), Math.max(0, Math.floor(d.pages ?? 0)), d.builtin ? 1 : 0, Date.now(),
    );
    return this.doc(id)!;
  }

  doc(id: string): LibraryDoc | null {
    const r = this.db.exec<Record<string, SqlStorageValue>>(`SELECT * FROM lib_docs WHERE id = ?`, id).toArray()[0];
    return r ? toDoc(r) : null;
  }

  /** Store passages of a document (at most 40 per call) and, if Workers AI is there, their meaning vectors. */
  async addPassages(id: string, passages: Passage[]): Promise<number> {
    const doc = this.doc(id);
    if (!doc) throw new Error('no such document');
    const list = passages
      .filter((p) => p && typeof p.text === 'string' && p.text.trim())
      .slice(0, MAX_PASSAGES_PER_CALL)
      .map((p) => ({ text: p.text.trim().slice(0, MAX_PASSAGE_CHARS), heading: String(p.heading ?? '').slice(0, 200), page: Number.isFinite(p.page) ? Math.floor(p.page!) : null }));
    if (!list.length) return 0;
    const db = this.db;
    let next = Number(db.exec<{ m: number | null }>(`SELECT max(rid) AS m FROM lib_pass`).one().m ?? 0) + 1;
    const rids: number[] = [];
    let chars = 0;
    for (const p of list) {
      db.exec(`INSERT INTO lib_fts (rowid, text, heading, doc, page) VALUES (?, ?, ?, ?, ?)`, next, p.text, p.heading, id, p.page);
      db.exec(`INSERT OR REPLACE INTO lib_pass (rid, doc, heading, chars, h) VALUES (?, ?, ?, ?, ?)`, next, id, p.heading, p.text.length, dedupeKey(p.text));
      rids.push(next++);
      chars += p.text.length;
    }
    db.exec(`UPDATE lib_docs SET passages = passages + ?, chars = chars + ? WHERE id = ?`, list.length, chars, id);
    const vecs = await this.embed(list.map((p) => `${p.heading ? `${p.heading}\n` : ''}${p.text}`));
    if (vecs) vecs.forEach((v, i) => db.exec(`INSERT OR REPLACE INTO lib_vec (rid, doc, v) VALUES (?, ?, ?)`, rids[i], id, new Uint8Array(v.buffer)));
    return list.length;
  }

  /**
   * Add one of Ghosty's own notes to a running notebook document (created on first use).
   * Skips a note whose text is already there.
   */
  async note(docId: string, title: string, kind: string, passage: Passage): Promise<boolean> {
    if (!this.doc(docId)) this.createDoc({ id: docId, title, source: 'written by Ghosty', kind });
    const text = passage.text.trim();
    if (!text) return false;
    const dup = this.db.exec<{ rid: number }>(`SELECT rid FROM lib_pass WHERE h = ? AND doc = ? LIMIT 1`, dedupeKey(text.slice(0, MAX_PASSAGE_CHARS)), docId).toArray();
    if (dup.length) return false;
    await this.addPassages(docId, [passage]);
    this.finish(docId);
    return true;
  }

  /** Remove the passages of one section of a document (e.g. one source file, before re-reading it). */
  removeSection(docId: string, heading: string): number {
    const db = this.db;
    const rows = db.exec<{ rid: number; chars: number }>(`SELECT rid, chars FROM lib_pass WHERE doc = ? AND heading = ?`, docId, heading).toArray();
    if (!rows.length) return 0;
    const ids = rows.map((r) => Number(r.rid));
    this.dropRows(ids);
    db.exec(`UPDATE lib_docs SET passages = max(0, passages - ?), chars = max(0, chars - ?) WHERE id = ?`, rows.length, rows.reduce((n, r) => n + Number(r.chars), 0), docId);
    return rows.length;
  }

  /** The text of one section of a document (one heading), up to `max` characters, in order, with the passages' overlaps removed. Index lookups only. */
  sectionText(docId: string, heading: string, max = 7000): string {
    const db = this.db;
    const rids = db.exec<{ rid: number }>(`SELECT rid FROM lib_pass WHERE doc = ? AND heading = ? ORDER BY rid LIMIT 40`, docId, heading).toArray().map((r) => Number(r.rid));
    if (!rids.length) return '';
    const rows = db.exec<{ rid: number; text: string }>(`SELECT rowid AS rid, text FROM lib_fts WHERE rowid IN (${rids.map(() => '?').join(',')})`, ...rids).toArray();
    const byRid = new Map(rows.map((r) => [Number(r.rid), String(r.text)]));
    // passages overlap by design (each carries the tail of the one before); joined, the text reads once
    const joined = joinPassages(rids.flatMap((rid) => byRid.get(rid) ?? []));
    return joined.length > max ? joined.slice(0, max) : joined;
  }

  /**
   * A document's passages in order, a page at a time (for the copy on the owner's device).
   * Index lookups only: the rows of this page, never the whole library.
   */
  passagesOf(docId: string, after = 0, limit = 300): { passages: { rid: number; text: string; heading: string; page: number | null }[]; next: number | null } {
    const db = this.db;
    const n = Math.max(1, Math.min(400, Math.floor(limit)));
    const rids = db.exec<{ rid: number }>(`SELECT rid FROM lib_pass WHERE doc = ? AND rid > ? ORDER BY rid LIMIT ?`, docId, Math.max(0, Math.floor(after)), n).toArray().map((r) => Number(r.rid));
    if (!rids.length) return { passages: [], next: null };
    const rows = db.exec<{ rid: number; text: string; heading: string | null; page: number | null }>(`SELECT rowid AS rid, text, heading, page FROM lib_fts WHERE rowid IN (${rids.map(() => '?').join(',')})`, ...rids).toArray();
    const byRid = new Map(rows.map((r) => [Number(r.rid), r]));
    const passages = rids.flatMap((rid) => {
      const r = byRid.get(rid);
      return r ? [{ rid, text: String(r.text), heading: String(r.heading ?? ''), page: r.page === null || r.page === undefined ? null : Number(r.page) }] : [];
    });
    return { passages, next: rids.length === n ? rids[rids.length - 1]! : null };
  }

  finish(id: string): LibraryDoc | null {
    this.db.exec(`UPDATE lib_docs SET status = 'ready' WHERE id = ?`, id);
    return this.doc(id);
  }

  list(): LibraryDoc[] {
    return this.db.exec<Record<string, SqlStorageValue>>(`SELECT * FROM lib_docs ORDER BY builtin ASC, at DESC`).toArray().map(toDoc);
  }

  remove(id: string): boolean {
    const db = this.db;
    const had = !!this.doc(id);
    this.dropRows(db.exec<{ rid: number }>(`SELECT rid FROM lib_pass WHERE doc = ?`, id).toArray().map((r) => Number(r.rid)));
    db.exec(`DELETE FROM lib_docs WHERE id = ?`, id);
    return had;
  }

  /** Delete passages by row id (FTS rowid lookups and lib_vec/lib_pass are by primary key: no scans). */
  private dropRows(ids: number[]): void {
    const db = this.db;
    for (let i = 0; i < ids.length; i += 200) {
      const part = ids.slice(i, i + 200);
      const q = part.map(() => '?').join(',');
      db.exec(`DELETE FROM lib_fts WHERE rowid IN (${q})`, ...part);
      db.exec(`DELETE FROM lib_vec WHERE rid IN (${q})`, ...part);
      db.exec(`DELETE FROM lib_pass WHERE rid IN (${q})`, ...part);
    }
  }

  stats(): { docs: number; passages: number; chars: number; bytes: number; vectors: number } {
    const db = this.db;
    // lib_docs only (a few dozen rows): counting lib_vec here read every vector on every call.
    const r = db.exec<{ d: number; p: number | null; c: number | null }>(`SELECT count(*) AS d, sum(passages) AS p, sum(chars) AS c FROM lib_docs`).one();
    return { docs: Number(r.d), passages: Number(r.p ?? 0), chars: Number(r.c ?? 0), bytes: db.databaseSize, vectors: this.env.AI ? Number(r.p ?? 0) : 0 };
  }

  /**
   * The best passages for a question. `relevant` is true when a passage really matches
   * (most of the question's words, or — with meaning vectors — a close match in meaning).
   */
  async search(query: string, k = 6): Promise<LibraryHit[]> {
    const terms = queryTerms(query);
    if (!terms.length) return [];
    const db = this.db;
    const match = terms.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
    let rows: { rowid: number; text: string; heading: string; doc: string; page: number | null; score: number }[];
    try {
      rows = db.exec<{ rowid: number; text: string; heading: string; doc: string; page: number | null; score: number }>(
        `SELECT rowid, text, heading, doc, page, bm25(lib_fts, 1.0, 0.5) AS score FROM lib_fts WHERE lib_fts MATCH ? ORDER BY score LIMIT 40`,
        match,
      ).toArray();
    } catch {
      return [];
    }
    if (!rows.length) return [];
    const best = Math.min(...rows.map((r) => Number(r.score))) || -1;
    // meaning re-rank (optional)
    let qv: Float32Array | null = null;
    const vecs = new Map<number, Float32Array>();
    if (this.env.AI) {
      const ids = rows.map((r) => Number(r.rowid));
      const found = db.exec<{ rid: number; v: unknown }>(`SELECT rid, v FROM lib_vec WHERE rid IN (${ids.map(() => '?').join(',')})`, ...ids).toArray();
      for (const f of found) {
        const v = vecOf(f.v);
        if (v) vecs.set(Number(f.rid), v);
      }
      if (vecs.size) qv = (await this.embed([query]))?.[0] ?? null;
    }
    const titles = new Map(this.list().map((d) => [d.id, d.title]));
    // a term "covers" a passage when a word in it starts with the term's stem (whole words, so "hi" ≠ "this")
    const stemOf = (t: string) => new RegExp(`(^|[^a-z0-9])${t.slice(0, Math.max(3, Math.min(t.length, 5))).replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')}`);
    const stems = terms.map(stemOf);
    // what makes a passage a match: the words that say what is asked ("mitosis" in "what happens during mitosis"),
    // not the everyday ones a passage on anything may share with the question (shared/meaning.ts COMMON)
    const rare = rareTerms(terms).map(stemOf);
    const enough = terms.length >= 2 || terms[0]!.length >= 5; // one short word is never enough to bring a passage up by itself
    const hits = rows.map((r) => {
      const low = `${r.heading} ${r.text}`.toLowerCase();
      const cover = stems.filter((s) => s.test(low)).length / stems.length;
      const rareCover = rare.filter((s) => s.test(low)).length / rare.length;
      const kw = Number(r.score) / best; // 1 for the best keyword match
      const v = qv ? vecs.get(Number(r.rowid)) : undefined;
      const sem = v && qv ? cosine(qv, v) : null;
      const score = sem === null ? 0.7 * kw + 0.3 * cover : 0.35 * kw + 0.2 * cover + 0.45 * Math.max(0, (sem - 0.5) * 2);
      const relevant = enough && (rareCover >= (rare.length >= 3 ? 0.6 : 0.99) || (sem !== null && sem >= 0.72));
      return { doc: r.doc, title: titles.get(r.doc) ?? r.doc, heading: r.heading || '', page: r.page === null || r.page === undefined ? null : Number(r.page), text: r.text, score: Math.round(score * 1000) / 1000, relevant };
    });
    hits.sort((a, b) => b.score - a.score);
    // at most two passages from the same document section, for variety
    const out: LibraryHit[] = [];
    const per = new Map<string, number>();
    for (const h of hits) {
      const key = `${h.doc}|${h.heading}`;
      if ((per.get(key) ?? 0) >= 2) continue;
      per.set(key, (per.get(key) ?? 0) + 1);
      out.push(h);
      if (out.length >= k) break;
    }
    return out;
  }

  /** Meaning vectors through Workers AI (free, no key). Null when unavailable — search then uses keywords only. */
  private async embed(texts: string[]): Promise<Float32Array[] | null> {
    if (!this.env.AI || !texts.length) return null;
    // Optional: skipped when the day's shared Workers AI allowance runs low (neurons.ts); search then uses keywords.
    const n = cost.embed(texts.reduce((k, t) => k + Math.min(1800, t.length), 0));
    if (!(await neurons().room('embed', n))) return null;
    await neurons().charge('embed', n);
    try {
      const r = (await this.env.AI.run(EMBED_MODEL, { text: texts.map((t) => t.slice(0, 1800)), pooling: 'cls' })) as { data?: number[][] };
      if (!Array.isArray(r?.data) || r.data.length !== texts.length) return null;
      return r.data.map((v) => Float32Array.from(v));
    } catch {
      return null;
    }
  }

  /** Once the starter library is known to be complete, no call in this brain's lifetime touches the database for it again. */
  private starterReady = false;

  /**
   * Put the built-in starter library in (and keep it up to date), a little at a time: at
   * most `budget` passages per call, so no single request does too much work. Each document
   * is tracked by its own fingerprint, so editing or adding one starter document re-seeds
   * ONLY that document — never the whole library. (Rewriting everything on any change used
   * to burn through Cloudflare's free daily write allowance in one go and pause the brain.)
   * `docs` is for tests; it is always the real starter library otherwise.
   */
  seedStarter(budget = 40, docs: StarterDoc[] = STARTER): Promise<boolean> {
    // One seeding pass at a time per brain: tools that run side by side (and the chat loop) share it.
    const running = seeding.get(this.storage);
    if (running) return running;
    const p = this.seedOnce(budget, docs).finally(() => {
      if (seeding.get(this.storage) === p) seeding.delete(this.storage);
    });
    seeding.set(this.storage, p);
    return p;
  }

  private async seedOnce(budget: number, docs: StarterDoc[]): Promise<boolean> {
    const real = docs === STARTER;
    if (real && this.starterReady) return true;
    const want = new Map(docs.map((d) => [`starter_${d.id}`, { d, h: starterHash(d) }]));
    const version = [...want.values()].map((x) => x.h).join(',');
    type State = { v: 2; version: string; done: Record<string, string>; cur: { id: string; at: number; h: string } | null };
    const raw = await this.storage.get<Partial<State>>('lib:starter');
    let state: State;
    if (raw?.v === 2 && raw.done) state = { v: 2, version: raw.version ?? '', done: raw.done, cur: raw.cur?.h ? raw.cur : null };
    else {
      // Older bookkeeping (or none): documents already in the library whose size matches the
      // text they should hold are accepted as they are — an upgrade rewrites nothing.
      state = { v: 2, version: '', done: {}, cur: null };
      for (const doc of this.list().filter((x) => x.builtin && x.status === 'ready')) {
        const w = want.get(doc.id);
        if (w && doc.chars === starterChars(w.d)) state.done[doc.id] = w.h;
      }
    }
    if (state.version === version) {
      if (real) this.starterReady = true;
      return true;
    }
    // Half way through a document whose text has since changed, or which is gone: start it over.
    if (state.cur && want.get(state.cur.id)?.h !== state.cur.h) {
      this.remove(state.cur.id);
      delete state.done[state.cur.id];
      state.cur = null;
    }
    // Only documents that were removed from the starter library, or whose text changed, go.
    for (const doc of this.list().filter((x) => x.builtin)) {
      const w = want.get(doc.id);
      if (w && state.done[doc.id] === w.h) continue;
      if (state.cur?.id === doc.id) continue; // half way through adding it: carry on below
      this.remove(doc.id);
      delete state.done[doc.id];
    }
    let left = budget;
    for (;;) {
      const next = state.cur ? want.get(state.cur.id) : [...want.entries()].find(([id, w]) => state.done[id] !== w.h)?.[1];
      if (!next || left <= 0) break;
      const id = `starter_${next.d.id}`;
      if (state.cur?.id !== id) {
        this.createDoc({ id, title: next.d.title, source: 'Ghosty starter library', kind: 'starter', builtin: true });
        state.cur = { id, at: 0, h: next.h };
      }
      const passages = chunkText(next.d.text);
      const part = passages.slice(state.cur.at, state.cur.at + Math.min(left, MAX_PASSAGES_PER_CALL));
      await this.addPassages(id, part);
      state.cur.at += part.length;
      left -= part.length;
      if (state.cur.at >= passages.length) {
        this.finish(id);
        state.done[id] = next.h;
        state.cur = null;
      }
    }
    const complete = [...want.entries()].every(([id, w]) => state.done[id] === w.h);
    state.version = complete ? version : ''; // only ever the set that is wholly in: a half-done round never short-circuits later
    await this.storage.put('lib:starter', state);
    if (complete && real) this.starterReady = true;
    return complete;
  }
}

/** Fingerprint of a starter document (FNV-1a over title and text). */
function starterHash(d: StarterDoc): string {
  let h = 0x811c9dc5;
  for (const ch of `${d.title}\n${d.text}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${d.text.length}:${h.toString(16)}`;
}

/** The characters a starter document occupies once cut into passages (what lib_docs.chars holds). */
function starterChars(d: StarterDoc): number {
  return chunkText(d.text).reduce((n, p) => n + p.text.trim().slice(0, MAX_PASSAGE_CHARS).length, 0);
}

/** Key for spotting a note that is already filed (length + start of the text; indexed). */
const dedupeKey = (text: string) => `${text.length}:${text.slice(0, 160)}`;

function toDoc(r: Record<string, SqlStorageValue>): LibraryDoc {
  return {
    id: String(r.id),
    title: String(r.title),
    source: String(r.source ?? ''),
    kind: String(r.kind ?? 'text'),
    pages: Number(r.pages ?? 0),
    passages: Number(r.passages ?? 0),
    chars: Number(r.chars ?? 0),
    status: r.status === 'ready' ? 'ready' : 'adding',
    builtin: Number(r.builtin ?? 0) === 1,
    at: Number(r.at ?? 0),
  };
}

/** Passages formatted for the model, with where each came from. */
export function formatHits(hits: LibraryHit[], max = 6000): string {
  let out = '';
  for (const h of hits) {
    const where = [h.title, h.heading && h.heading !== h.title ? h.heading : '', h.page ? `p. ${h.page}` : ''].filter(Boolean).join(' · ');
    const block = `[${where}]\n${h.text}\n\n`;
    if (out.length + block.length > max) break;
    out += block;
  }
  return out.trim();
}

let starterChunks: { title: string; heading: string; text: string; low: string }[] | null = null;
/**
 * Search the built-in starter library straight from the code, without the database: the
 * last resort when storage is unavailable (e.g. the free plan's daily allowance is used up),
 * so Ghosty can still answer from what it knows.
 */
export function searchStarterInMemory(query: string, k = 3): LibraryHit[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  starterChunks ??= STARTER.flatMap((d) => chunkText(d.text).map((p) => ({ title: d.title, heading: p.heading ?? '', text: p.text, low: `${p.heading ?? ''} ${p.text}`.toLowerCase() })));
  const stems = terms.map((t) => t.slice(0, Math.max(3, Math.min(t.length, 5))));
  const scored = starterChunks
    .map((c) => ({ c, score: stems.filter((s) => c.low.includes(s)).length / stems.length }))
    .filter((x) => x.score >= (terms.length >= 3 ? 0.5 : 0.99))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return scored.map(({ c, score }) => ({ doc: 'starter', title: c.title, heading: c.heading, page: null, text: c.text, score, relevant: true }));
}
