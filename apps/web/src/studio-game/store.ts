/**
 * THE GAMES ON THIS PHONE (BRIEF-EDITOR-GAME-STUDIO): his games in the phone's own database (IndexedDB, the documents' shape),
 * saved 200 ms after a change, each with a small picture of its first room. About a hundred games or 200 MB; past that the
 * oldest is let go first and `room()` says so. Where the browser has no database (a private window) the games live in memory
 * for this visit and the store says it keeps nothing. Nothing here leaves the phone.
 */
import { clone, type Game, gameBytes, readGame } from './model';

export const DB = 'ghosty-studio-game';
const STORE = 'games';
const PAGES = 'pages';
export const MAX_GAMES = 100;
export const MAX_BYTES = 200_000_000;

export interface Meta {
  id: string;
  name: string;
  kind: string;
  at: number;
  bytes: number;
  rooms: number;
  /** A small picture of the first room (a PNG data address). */
  thumb: string;
  maker: string;
}
interface Row extends Meta {
  json: string;
}

const memory = new Map<string, Row>();
let opened: Promise<IDBDatabase> | null = null;
let blocked = false;
const db = (): Promise<IDBDatabase> | null => {
  if (blocked || typeof indexedDB === 'undefined') return null;
  return (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' });
      if (!r.result.objectStoreNames.contains(PAGES)) r.result.createObjectStore(PAGES, { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('the database would not open'));
  }).catch((e) => {
    opened = null;
    blocked = true;
    throw e;
  }));
};
const tx = async <T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> => {
  const d = await db();
  if (!d) throw new Error('no database');
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = op(t.objectStore(store));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error ?? req.error);
    t.onabort = () => reject(t.error ?? new Error('the database gave up'));
  });
};
/** Whether this visit's games are kept on the phone (false in a private window: they last until the page closes). */
export const keeps = (): boolean => !blocked && typeof indexedDB !== 'undefined';

const rowsAll = async (): Promise<Row[]> => {
  try {
    const rows = (await tx('readonly', (s) => s.getAll())) as Row[];
    return rows.filter((r) => r && typeof r.id === 'string' && typeof r.json === 'string');
  } catch {
    return [...memory.values()];
  }
};
export async function listGames(): Promise<Meta[]> {
  return (await rowsAll())
    .map(({ json: _j, ...m }) => m as Meta)
    .sort((a, b) => b.at - a.at);
}
export async function getGame(id: string): Promise<Game | null> {
  let row: Row | undefined;
  try {
    row = (await tx('readonly', (s) => s.get(id))) as Row | undefined;
  } catch {
    row = undefined;
  }
  row ??= memory.get(id);
  if (!row) return null;
  try {
    return readGame(JSON.parse(row.json))?.game ?? null;
  } catch {
    return null;
  }
}
export interface Kept {
  kept: boolean;
  /** Games let go to make room, said by `room()`. */
  gone: string[];
}
/** Keep a game (or keep it again). The picture is made by the caller (a canvas), or left as it was. */
export async function putGame(g: Game, thumb = ''): Promise<Kept> {
  const old = memory.get(g.id);
  const json = JSON.stringify(g);
  const row: Row = { id: g.id, name: g.name, kind: g.kind, at: Date.now(), bytes: json.length, rooms: g.rooms.length, thumb: thumb || old?.thumb || '', maker: g.maker, json };
  memory.set(g.id, row);
  let kept = false;
  try {
    await tx('readwrite', (s) => s.put(row));
    kept = true;
  } catch {
    kept = false;
  }
  const gone = await trim(g.id);
  return { kept, gone };
}
export async function removeGame(id: string): Promise<void> {
  memory.delete(id);
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* nothing kept to remove */
  }
}
/** Past 100 games or 200 MB the oldest go, never the one just kept. */
async function trim(except: string): Promise<string[]> {
  const rows = (await rowsAll()).sort((a, b) => a.at - b.at);
  let bytes = rows.reduce((n, r) => n + r.bytes + r.thumb.length, 0);
  const gone: string[] = [];
  let count = rows.length;
  for (const r of rows) {
    if (count <= MAX_GAMES && bytes <= MAX_BYTES) break;
    if (r.id === except) continue;
    await removeGame(r.id);
    gone.push(r.name);
    count--;
    bytes -= r.bytes + r.thumb.length;
  }
  return gone;
}
/** How much room is used, said as he would: "3 games, 120 KB of about 200 MB". */
export async function room(): Promise<{ games: number; bytes: number; said: string }> {
  const rows = await rowsAll();
  const bytes = rows.reduce((n, r) => n + r.bytes + r.thumb.length, 0);
  const kb = bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
  return { games: rows.length, bytes, said: `${rows.length} game${rows.length === 1 ? '' : 's'}, ${kb} of about 200 MB (${MAX_GAMES} games at most; past that the oldest is let go first).` };
}

/**
 * Saved 200 ms after the last change: `touch()` after each edit, `flush()` before leaving. `onSaved` says how it went
 * (so "Saved" can fade in once).
 */
export function autosave(get: () => Game, thumb: () => string, onSaved: (k: Kept) => void): { touch(): void; flush(): Promise<void> } {
  let timer = 0;
  let dirty = false;
  const go = async () => {
    timer = 0;
    if (!dirty) return;
    dirty = false;
    const g = clone(get());
    g.at = Date.now();
    onSaved(await putGame(g, thumb()));
  };
  return {
    touch() {
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => void go(), 200);
    },
    async flush() {
      if (timer) clearTimeout(timer);
      await go();
    },
  };
}
export { gameBytes };

// ---------------------------------------------------------------- the pages exported AS AN APP, kept in the library
export interface PageMeta {
  id: string;
  name: string;
  bytes: number;
  at: number;
}
interface PageRow extends PageMeta {
  html: string;
}
const pagesMem = new Map<string, PageRow>();
/** Keep an exported page (one for each game; exporting again replaces it). */
export async function keepPage(id: string, name: string, html: string): Promise<PageMeta> {
  const row: PageRow = { id, name, bytes: html.length, at: Date.now(), html };
  pagesMem.set(id, row);
  try {
    await tx('readwrite', (s) => s.put(row), PAGES);
  } catch {
    /* kept for this visit */
  }
  const { html: _h, ...meta } = row;
  return meta;
}
export async function listPages(): Promise<PageMeta[]> {
  let rows: PageRow[] = [];
  try {
    rows = (await tx('readonly', (s) => s.getAll(), PAGES)) as PageRow[];
  } catch {
    rows = [...pagesMem.values()];
  }
  return rows.map(({ html: _h, ...m }) => m as PageMeta).sort((a, b) => b.at - a.at);
}
export async function getPage(id: string): Promise<string | null> {
  try {
    const r = (await tx('readonly', (s) => s.get(id), PAGES)) as PageRow | undefined;
    if (r) return r.html;
  } catch {
    /* fall through */
  }
  return pagesMem.get(id)?.html ?? null;
}
export async function removePage(id: string): Promise<void> {
  pagesMem.delete(id);
  try {
    await tx('readwrite', (s) => s.delete(id), PAGES);
  } catch {
    /* nothing kept */
  }
}
