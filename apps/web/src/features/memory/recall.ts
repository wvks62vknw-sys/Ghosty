/**
 * RECALL AND FIND ON THE PHONE (BRIEF-DEPTH-MEMORY 2 and 4): one index of his own things, kept on this phone in IndexedDB and
 * never sent anywhere: every turn of the chat (his words and the first sentence of what I answered; the brain's /history fills
 * the gaps after a reinstall), his documents, workspace pages, decks, spreadsheets' cell text and scanned pages, by title and
 * paragraph. Photos' pixels never: only text the app already read from them.
 *
 *  - "what did I ask you about trains?" (shared/recall.ts recallAsked) is answered here with no model and no network: the RECALL
 *    card, the best three first, each a tap into the log (MEMORY's quote when the turn is gone from it);
 *  - FIND (MEMORY → FIND, "find garden in my things") answers the same way over everything: the best eight, kind, title, line;
 *  - the meaning model, when he downloaded it (SETTINGS → OFFLINE BRAIN → Search by meaning), adds its 384 numbers per item at
 *    idle; without it the words do the work;
 *  - the build runs only at idle, after Home is up, on power or above half charge, a few items a second, and stops when he touches
 *    the screen (library/idle.ts's rule: runIndex with canRun);
 *  - a turn he forgets (RECALL → FORGET) leaves the index at once and the brain's gists too, with UNDO.
 * Nothing here imports the camera, faces or the speaker.
 */
import { dayWord, daysAgo, matchGists, recallSaid, daysFor, stampOf, type Gist } from '../../../../../packages/shared/src/recall';
import { cosine, normalise, wordMatcher } from '../../../../../packages/shared/src/meaning';
import { chat } from '../../assistant/session';
import { brain } from '../../api/brain';
import { runIndex } from '../../library/idle';
import { embedState, embedTexts } from '../../offline/embed';
import { timeZone } from '../../state/app';

export type ThingKind = 'turn' | 'doc' | 'page' | 'deck' | 'sheet' | 'scan';
/** One indexed thing: a turn, or a paragraph of one of his things. */
export interface Thing {
  key: string;
  kind: ThingKind;
  /** The thing's id in its own store (a turn: its time). */
  id: string;
  title: string;
  text: string;
  at: number;
  via?: string;
  /** A turn: what I answered, its first sentence. */
  a?: string;
  /** The meaning model's numbers, once worked out at idle. */
  v?: number[];
  /** A paragraph of a document or a workspace page: its block's id, so a tap lands on the line. */
  bid?: string;
}

const DB = 'ghosty-recall';
/** The most turns the index keeps (about 1 MB of text at most). */
const MAX_TURNS = 3000;
/** What the stores looked like at the last build: a minute's look at idle rebuilds only when it changed. */
let lastSig = '';
const signature = (): string => {
  const es = chat.get().entries;
  let n = `${es.length}:${es[es.length - 1] && 'at' in es[es.length - 1]! ? (es[es.length - 1] as { at: number }).at : 0}`;
  for (const k of ['ghosty.docs', 'ghosty.workspace', 'ghosty.slides', 'ghosty.sheets']) {
    try {
      n += `:${localStorage.getItem(k)?.length ?? 0}`;
    } catch {
      /* nothing kept */
    }
  }
  return n;
};
const STORE = 'things';
const GONE = 'ghosty.recall.gone';

/** What a spec reads (window.__ghosty.found): the last thing a FIND tap opened, and whether it landed on its line. */
export const foundState = { kind: '', id: '', bid: '', landed: false };
/** What a spec and SYSTEM → STORAGE read: window.__ghosty.recall. */
export const recallState = { state: 'cold' as 'cold' | 'building' | 'warm', items: 0, vectors: 0, bytes: 0, builtAt: 0, ms: 0, lastQueryMs: 0 };

let db: Promise<IDBDatabase | null> | null = null;
const open = (): Promise<IDBDatabase | null> =>
  (db ??= new Promise((ok) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  }));

let cache: Thing[] | null = null;
async function all(): Promise<Thing[]> {
  if (cache) return cache;
  const d = await open();
  if (!d) return [];
  cache = await new Promise<Thing[]>((ok) => {
    const r = d.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess = () => ok((r.result as Thing[]) ?? []);
    r.onerror = () => ok([]);
  });
  measure(cache);
  return cache;
}

function measure(list: Thing[]): void {
  recallState.items = list.length;
  recallState.vectors = list.filter((x) => x.v).length;
  recallState.bytes = list.reduce((n, x) => n + x.text.length + x.title.length + (x.a?.length ?? 0) + (x.v ? x.v.length * 4 : 0) + 40, 0);
  if (list.length && recallState.state === 'cold') recallState.state = 'warm';
}

async function put(items: Thing[], drop: string[] = []): Promise<void> {
  const d = await open();
  if (!d) return;
  await new Promise<void>((ok) => {
    const tx = d.transaction(STORE, 'readwrite');
    const s = tx.objectStore(STORE);
    for (const k of drop) s.delete(k);
    for (const x of items) s.put(x);
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
  });
}

const gone = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(GONE) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};
const keepGone = (s: Set<string>) => {
  try {
    localStorage.setItem(GONE, JSON.stringify([...s].slice(-500)));
  } catch {
    /* the phone keeps nothing: the forget still holds for this session */
  }
};

// ---------------------------------------------------------------- the sources (his own things, on this phone)

const runsText = (runs: { text?: string }[] | undefined): string => (runs ?? []).map((r) => r.text ?? '').join('');
const paras = (text: string): string[] => text.split(/\n+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length > 2);
const readJson = <T,>(key: string, or: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? or;
  } catch {
    return or;
  }
};

/** Every turn the log holds: his words with the first sentence of my answer after it. */
function turnsFromLog(): Thing[] {
  const es = chat.get().entries;
  const out: Thing[] = [];
  for (let i = 0; i < es.length; i++) {
    const e = es[i]!;
    if (e.kind !== 'user' || !e.text.trim()) continue;
    const r = es.slice(i + 1, i + 6).find((x) => x.kind === 'assistant' || x.kind === 'user');
    const a = r && r.kind === 'assistant' ? firstLine(r.text) : '';
    out.push({ key: `t:${e.at}`, kind: 'turn', id: String(e.at), title: '', text: e.text.replace(/\s+/g, ' ').trim().slice(0, 400), at: e.at, via: 'app', ...(a ? { a } : {}) });
  }
  return out;
}
const firstLine = (t: string): string => {
  const s = t.replace(/[*_`#>|]/g, '').replace(/\s+/g, ' ').trim();
  const f = /^(.+?[.!?])(?:\s|$)/.exec(s)?.[1] ?? s;
  return f.length > 120 ? `${f.slice(0, 119)}…` : f;
};

/** His documents, workspace pages, decks, spreadsheets and scanned pages: a thing per paragraph (at most 40 each). */
function thingsFromStores(): Thing[] {
  const out: Thing[] = [];
  // (a line is its text and, for a document's or a page's paragraph, its block's id)
  const add = (kind: ThingKind, id: string, title: string, at: number, lines: (string | [string, string])[]) =>
    lines.slice(0, 40).forEach((l, i) => {
      const [text, bid] = typeof l === 'string' ? [l, ''] : l;
      out.push({ key: `${kind}:${id}:${i}`, kind, id, title: title || 'Untitled', text: text.slice(0, 400), at, ...(bid ? { bid } : {}) });
    });
  type B = { id?: string; runs?: { text?: string }[]; rows?: { text?: string }[][][] };
  const blockLines = (bs: B[]): [string, string][] => bs.flatMap((b) => [runsText(b.runs), ...(b.rows ?? []).map((row) => row.map((c) => runsText(c)).join(' · '))].flatMap(paras).map((t): [string, string] => [t, b.id ?? '']));
  for (const d of readJson<{ id: string; title: string; at: number; blocks: B[] }[]>('ghosty.docs', [])) {
    if (!d?.id || !Array.isArray(d.blocks)) continue;
    add('doc', d.id, d.title, d.at, blockLines(d.blocks));
  }
  const ws = readJson<{ pages?: Record<string, { id: string; title: string; at: number; blocks?: B[] }> }>('ghosty.workspace', {});
  for (const p of Object.values(ws.pages ?? {})) if (p?.id) add('page', p.id, p.title, p.at, [...paras(p.title), ...blockLines(p.blocks ?? [])]);
  for (const [key, kind] of [['ghosty.slides', 'deck'], ['ghosty.sheets', 'sheet'], ['ghosty.scan.pages', 'scan']] as const) {
    const v = readJson<unknown>(key, null);
    const list = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { list?: unknown }).list) ? (v as { list: unknown[] }).list : [];
    for (const x of list as Record<string, unknown>[]) {
      if (!x || typeof x !== 'object') continue;
      const id = String(x.id ?? x.at ?? '');
      if (!id) continue;
      add(kind, id, String(x.title ?? x.name ?? ''), Number(x.at ?? 0) || 0, paras(textOf(x)).slice(0, 40));
    }
  }
  return out;
}
/** Every string inside a kept thing (a deck's slides, a sheet's cells, a page's read text), but not ids, pictures or styles. */
function textOf(v: unknown, depth = 0): string {
  if (depth > 6 || v == null) return '';
  if (typeof v === 'string') return /^(data:|blob:|#|rgb|[0-9a-f-]{16,}$)/i.test(v) || v.length < 2 ? '' : v;
  if (Array.isArray(v)) return v.map((x) => textOf(x, depth + 1)).filter(Boolean).join('\n');
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).filter(([k]) => !/^(id|img|src|style|color|fill|font|theme|at|key|v)$/i.test(k)).map(([, x]) => textOf(x, depth + 1)).filter(Boolean).join('\n');
  return '';
}

// ---------------------------------------------------------------- the build, at idle

let building: Promise<void> | null = null;
let touched = 0;
let battery: { level: number; charging: boolean } | null = null;

/** May the index work now: Ghosty in front, the screen not touched for two seconds, on power or above half charge. */
const canRun = (): boolean => document.visibilityState === 'visible' && Date.now() - touched > 2000 && (!battery || battery.charging || battery.level > 0.5);

/** Build (or bring up to date) the index: the sources now, then the meaning numbers at idle when the model is there. */
export function buildIndex(o: { history?: boolean } = {}): Promise<void> {
  return (building ??= (async () => {
    const t0 = performance.now();
    recallState.state = recallState.items ? 'warm' : 'building';
    const old = await all();
    const dead = gone();
    let turns = turnsFromLog();
    // after a reinstall the log is short: the brain's history fills the gaps (it already holds them)
    if (o.history !== false && turns.length < 20 && navigator.onLine) {
      const h = await Promise.race([brain.history().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
      for (let i = 0; i < (h?.turns.length ?? 0); i++) {
        const t = h!.turns[i]!;
        const said = t.text.replace(/\s+/g, ' ').trim().slice(0, 400);
        if (t.role !== 'user' || !said || turns.some((x) => Math.abs(x.at - t.at) < 120_000 && x.text === said)) continue;
        const r = h!.turns[i + 1];
        turns.push({ key: `t:${t.at}`, kind: 'turn', id: String(t.at), title: '', text: said, at: t.at, via: (t as { via?: string }).via === 'telegram' ? 'telegram' : 'app', ...(r?.role === 'assistant' ? { a: firstLine(r.text) } : {}) });
      }
    }
    turns = turns.filter((x) => !dead.has(x.key));
    lastSig = signature();
    const fresh = [...turns, ...thingsFromStores()];
    const byKey = new Map(old.map((x) => [x.key, x]));
    const keep = new Set(fresh.map((x) => x.key));
    const changed = fresh.filter((x) => {
      const was = byKey.get(x.key);
      if (was && was.text === x.text && was.title === x.title && was.a === x.a && was.bid === x.bid) return false;
      return true;
    });
    // (a turn the log dropped stays: the index is where last month's turns are found; a thing deleted from its store goes)
    // (the same message under two times — this phone's stamp and the brain's, after the log is read back from it — is one turn)
    const twin = (x: Thing) => x.kind === 'turn' && turns.some((t) => t.key !== x.key && t.text === x.text && Math.abs(t.at - x.at) < 120_000);
    const drop = old.filter((x) => !keep.has(x.key) && (x.kind !== 'turn' || dead.has(x.key) || twin(x))).map((x) => x.key);
    // (the index keeps at most MAX_TURNS turns: the oldest go first)
    const allTurns = [...old.filter((x) => x.kind === 'turn' && !drop.includes(x.key) && !keep.has(x.key)), ...turns].sort((a, b) => b.at - a.at);
    for (const x of allTurns.slice(MAX_TURNS)) if (!drop.includes(x.key)) drop.push(x.key);
    const out = new Set(drop);
    const write = changed.filter((x) => !out.has(x.key));
    if (write.length || drop.length) await put(write, drop);
    const wrote = new Set(write.map((x) => x.key));
    cache = [...old.filter((x) => !out.has(x.key) && !wrote.has(x.key)), ...write];
    measure(cache);
    recallState.state = 'warm';
    recallState.builtAt = Date.now();
    recallState.ms = Math.round(performance.now() - t0);
    if (embedState.get().downloaded) void addMeaning();
  })().finally(() => (building = null)));
}

/** The meaning numbers for what has none yet, a few at a time, only while canRun (runIndex rests and waits). */
async function addMeaning(): Promise<void> {
  const list = (await all()).filter((x) => !x.v);
  let i = 0;
  await runIndex<number, { key: number; text: string; t: Thing }>({
    next: async (_after, n) => {
      const items = list.slice(i, i + n).map((t, k) => ({ key: i + k, text: `${t.title} ${t.text}`.trim(), t }));
      i += items.length;
      return { items, last: i };
    },
    embed: (texts) => embedTexts(texts, 'passage'),
    save: async (items, vs) => {
      items.forEach((x, k) => (x.t.v = Array.from(normalise(vs[k]!), (n) => Math.round(n * 1000) / 1000)));
      await put(items.map((x) => x.t));
      measure(cache ?? []);
      return items.length;
    },
    canRun,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
    batch: 4,
  }).catch(() => undefined);
}

/** Start the index once Home is up: at idle, never before the first screen. */
export function startRecallIndex(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) Object.assign(w.__ghosty, { recall: recallState, found: foundState });
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => (touched = Date.now()), { passive: true, capture: true });
  void (navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> }).getBattery?.().then((b) => (battery = b)).catch(() => undefined);
  const go = () => void buildIndex().catch(() => undefined);
  const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  setTimeout(() => (idle ? idle(go, { timeout: 4000 }) : go()), 2500);
  // what he adds later is read in when the phone next sits idle
  setInterval(() => canRun() && signature() !== lastSig && go(), 60_000);
}

/** SYSTEM → STORAGE's CLEAR: the index goes; it rebuilds at idle. */
export async function clearIndex(): Promise<void> {
  const d = await open();
  if (d) await new Promise<void>((ok) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
  });
  cache = [];
  measure(cache);
  recallState.state = 'cold';
  setTimeout(() => void buildIndex().catch(() => undefined), 5000);
}

// ---------------------------------------------------------------- asking it

export interface Found {
  key: string;
  bid?: string;
  kind: ThingKind;
  id: string;
  title: string;
  line: string;
  at: number;
  via?: string;
  a?: string;
  /** "today", "on Tuesday" (a turn). */
  day: string;
  /** "Tue 10 Nov · App". */
  stamp: string;
}

/** Ready to answer: the index has been built (or read back) at least once. */
export const recallWarm = async (): Promise<boolean> => (await all()).length > 0 && recallState.state !== 'building';

let qvec: { q: string; v: Float32Array } | null = null;
/** The best matches for his words: turns only (`turns`) or everything; meaning added when the model is warm and the items have numbers. */
export async function findLocal(q: string, o: { turns?: boolean; k?: number } = {}): Promise<Found[]> {
  const t0 = performance.now();
  const list = (await all()).filter((x) => (o.turns ? x.kind === 'turn' : true) && !gone().has(x.key));
  const tz = timeZone;
  const now = Date.now();
  // words: the shared matcher (the same as the brain's recall)
  const hits = matchGists(q, list.map((x) => ({ at: x.at, via: x.via ?? '', q: `${x.title} ${x.text}`, ...(x.a ? { a: x.a } : {}), key: x.key }) as Gist & { key: string }), { now, tz, k: 40 });
  const score = new Map<string, number>(hits.map((h) => [(h as unknown as { key: string }).key, h.score]));
  // meaning: only when the model is already in memory (asking never waits on a load) and the items carry numbers
  if (embedState.get().loaded && list.some((x) => x.v)) {
    try {
      if (qvec?.q !== q) qvec = { q, v: normalise((await embedTexts([q], 'query'))[0]!) };
      for (const x of list) if (x.v) {
        const c = cosine(qvec.v, x.v);
        if (c >= 0.5) score.set(x.key, Math.max(score.get(x.key) ?? 0, (c - 0.4) * 2));
      }
    } catch {
      /* the words stand alone */
    }
  }
  const m = wordMatcher(q);
  const out = list
    .filter((x) => score.has(x.key))
    .sort((a, b) => score.get(b.key)! - score.get(a.key)! || b.at - a.at)
    .slice(0, o.k ?? (o.turns ? 6 : 8))
    .map((x): Found => ({ key: x.key, ...(x.bid ? { bid: x.bid } : {}), kind: x.kind, id: x.id, title: x.title, line: x.kind === 'turn' ? x.text : bestLine(x.text, m), at: x.at, ...(x.via ? { via: x.via } : {}), ...(x.a ? { a: x.a } : {}), day: x.at ? dayWord(x.at, now, tz) : '', stamp: x.kind === 'turn' ? stampOf(x.at, x.via ?? 'app', tz) : KIND_WORD[x.kind] }));
  recallState.lastQueryMs = Math.round(performance.now() - t0);
  return out;
}
const bestLine = (text: string, m: ReturnType<typeof wordMatcher>): string => (text.length > 160 && m ? (text.split(/(?<=[.!?])\s+/).find((s) => m(s.toLowerCase()).words > 0) ?? text).slice(0, 160) : text.slice(0, 160));

export const KIND_WORD: Record<ThingKind, string> = { turn: 'Chat', doc: 'Document', page: 'Workspace page', deck: 'Deck', sheet: 'Spreadsheet', scan: 'Scanned page' };

/** RECALL → FORGET on a turn: out of the index now, and out of the brain's gists (UNDO within the day brings both back). */
export async function forgetTurn(f: Pick<Found, 'key' | 'at'>): Promise<void> {
  const g = gone();
  g.add(f.key);
  keepGone(g);
  if (cache) {
    cache = cache.filter((x) => x.key !== f.key);
    measure(cache);
  }
  await put([], [f.key]);
  await brain.memoryChange(`t:${f.at}`, 'forget').catch(() => undefined);
}
/** UNDO of that forget: back in the index (rebuilt from the log) and in the brain's gists. */
export async function undoForgetTurn(f: Pick<Found, 'key' | 'at'>): Promise<void> {
  const g = gone();
  g.delete(f.key);
  keepGone(g);
  await brain.memoryChange(`t:${f.at}`, 'restore').catch(() => undefined);
  await buildIndex({ history: false });
}

/**
 * A reply that says "like you said on Tuesday": the turn it most likely means (that day, best matching his question), for the
 * RECALL chip. Null when the day word is not there or nothing on that day matches.
 */
const chipMemo = new Map<string, Promise<Found | null>>();
export function turnFor(reply: string, question: string): Promise<Found | null> {
  const said = recallSaid(reply);
  if (!said) return Promise.resolve(null);
  const k = `${said}|${question}`;
  if (!chipMemo.has(k)) {
    if (chipMemo.size > 50) chipMemo.clear();
    chipMemo.set(k, findTurn(reply, question));
  }
  return chipMemo.get(k)!;
}
async function findTurn(reply: string, question: string): Promise<Found | null> {
  const said = recallSaid(reply);
  if (!said) return null;
  const tz = timeZone;
  const now = Date.now();
  const days = new Set(daysFor(said, now, tz));
  const hits = await findLocal(question, { turns: true, k: 20 });
  const onDay = hits.filter((h) => days.has(daysAgoOf(h.at, now, tz)));
  if (onDay[0]) return onDay[0];
  const list = (await all()).filter((x) => x.kind === 'turn' && days.has(daysAgoOf(x.at, now, tz)));
  const x = list.sort((a, b) => b.at - a.at)[0];
  return x ? { key: x.key, kind: 'turn', id: x.id, title: '', line: x.text, at: x.at, day: dayWord(x.at, now, tz), stamp: stampOf(x.at, x.via ?? 'app', tz) } : null;
}
const daysAgoOf = daysAgo;

/** CLEAR CONVERSATION (assistant/session.ts): the turns leave the index with it, as they leave the brain's gists. */
export async function clearTurns(): Promise<void> {
  const list = await all();
  const turns = list.filter((x) => x.kind === 'turn').map((x) => x.key);
  if (cache) cache = cache.filter((x) => x.kind !== 'turn');
  measure(cache ?? []);
  await put([], turns);
  lastSig = '';
}
