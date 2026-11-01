/**
 * The arcade's game data on this phone: GET fetches a free package from its mirrors (only on his tap, on Wi-Fi, its
 * size said first), checks its exact size and SHA-256, takes the game's files out of it here on the phone and keeps
 * them in the browser's Cache API (the way offline/brain.ts keeps the brain's files), where one tap deletes them again.
 * A package comes from the Archive directly, or through Ghosty's own site when the phone cannot reach the Archive (a
 * network that blocks it, which Safari reports as "Load failed"): only after every public mirror has failed, the same
 * address under /api/arcade/ on this site, where the Worker streams the Archive's file through and keeps nothing
 * (apps/edge/src/arcade.ts), asked with the owner's sign-in. The games run entirely on the phone: the brain never sees a
 * byte of a package, and nothing that bills is ever asked.
 */
import type { GameData, Take } from './shelf';
import { concat, findEntry, zipEntries, zipRead, zipStore } from './zip';

export const ARCADE_CACHE = 'ghosty-arcade-v1';

/** Something GET can fetch: a shelf game or a level pack (its id names where its files are kept). */
export interface Getting {
  id: string;
  data: GameData;
}

export interface Progress {
  phase: 'download' | 'check' | 'unpack' | 'keep';
  /** Bytes so far, of `total` (the package's size while downloading). */
  got: number;
  total: number;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface GetOptions {
  /** The fetch to use (the tests give a stand-in; the phone uses its own). */
  fetch?: Fetch;
  signal?: AbortSignal;
  /**
   * What Ghosty's own copy is asked with besides the cookie: the owner's key (api/brain.ts `headers()`), because the Worker
   * lets only the owner through. Sent to this site's address alone, never to a public mirror.
   */
  ownHeaders?: () => Record<string, string>;
}

/** The address a kept file is stored under (made up: nothing is ever fetched from it). */
export const keyOf = (id: string, name: string): string => `https://arcade.ghosty.invalid/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;

/** The phone says it is on mobile data (only where the browser says so: Safari does not, so the words ask for Wi-Fi). */
export function onMobileData(): boolean {
  const c = (globalThis.navigator as unknown as { connection?: { type?: string; saveData?: boolean } } | undefined)?.connection;
  return c?.type === 'cellular' || c?.saveData === true;
}

/** Resolves once the phone is off mobile data (at once when it is not on it; never when the signal aborts first). */
export function offMobileData(signal?: AbortSignal): Promise<void> {
  if (!onMobileData()) return Promise.resolve();
  const c = (globalThis.navigator as unknown as { connection?: EventTarget }).connection;
  return new Promise((resolve) => {
    const check = () => {
      if (onMobileData()) return;
      c?.removeEventListener('change', check);
      resolve();
    };
    c?.addEventListener('change', check);
    signal?.addEventListener('abort', () => c?.removeEventListener('change', check), { once: true });
  });
}

/** "24 MB", "926 KB": a size as he reads it. */
export function sizeWords(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One mirror's bytes, read as they arrive (for the progress bar), never more than the package's size. `sameSite`: Ghosty's
 * own copy (this site's address), asked with the owner's sign-in; a public mirror is given nothing of his.
 */
async function download(url: string, data: GameData, onProgress: ((p: Progress) => void) | undefined, o: GetOptions, sameSite = false): Promise<Uint8Array> {
  const res = await (o.fetch ?? fetch)(url, {
    mode: 'cors',
    credentials: sameSite ? 'same-origin' : 'omit',
    ...(sameSite && o.ownHeaders ? { headers: o.ownHeaders() } : {}),
    cache: 'no-store',
    signal: o.signal,
  });
  if (!res.ok) throw new Error(`answered ${res.status}`);
  const out = new Uint8Array(data.bytes);
  let got = 0;
  const reader = res.body?.getReader();
  if (!reader) {
    const all = new Uint8Array(await res.arrayBuffer());
    if (all.length !== data.bytes) throw new Error(`sent ${all.length} bytes, not ${data.bytes}`);
    return all;
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > out.length) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`sent more than ${data.bytes} bytes`);
    }
    out.set(value, got);
    got += value.length;
    onProgress?.({ phase: 'download', got, total: data.bytes });
  }
  if (got !== data.bytes) throw new Error(`sent ${got} bytes, not ${data.bytes}`);
  return out;
}

/**
 * Ghosty's own copy of each Archive address: the same path under /api/arcade/ on this site (apps/edge/src/arcade.ts), for a
 * phone whose network will not let it reach the Archive. None where the page has no origin (the tests, a sandboxed frame).
 */
function ownCopies(urls: string[]): string[] {
  const origin = globalThis.location?.origin;
  const out: string[] = [];
  for (const u of urls) {
    try {
      const url = new URL(u);
      if (origin && url.host === 'archive.org' && url.pathname.startsWith('/cors/')) out.push(new URL(url.pathname.replace(/^\/cors\//, '/api/arcade/'), origin).href);
    } catch {
      /* not an address we can make a copy of */
    }
  }
  return out;
}

/**
 * The package from the first mirror whose bytes have the right size and SHA-256; mirrors are tried in order, the public ones
 * first, and Ghosty's own copy of each Archive address only when every one of them failed.
 */
export async function fetchPackage(data: GameData, onProgress?: (p: Progress) => void, o: GetOptions = {}): Promise<Uint8Array> {
  const why: string[] = [];
  const tries = [...data.url.map((url) => ({ url, sameSite: false })), ...ownCopies(data.url).map((url) => ({ url, sameSite: true }))];
  for (const { url, sameSite } of tries) {
    if (o.signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    try {
      const bytes = await download(url, data, onProgress, o, sameSite);
      onProgress?.({ phase: 'check', got: bytes.length, total: data.bytes });
      if ((await sha256Hex(bytes)) !== data.sha256) throw new Error('its checksum is not the one this game is known by');
      return bytes;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      why.push(`${sameSite ? 'this site' : new URL(url).host}: ${(e as Error)?.message ?? e}`);
    }
  }
  throw new Error(`No mirror gave the right file (${why.join('; ')}).`);
}

/** Take the game's files out of the package, each checked against its own checksum when it carries one. */
export async function unpack(pkg: Uint8Array, take: Take[]): Promise<Map<string, Uint8Array>> {
  const entries = zipEntries(pkg);
  const out = new Map<string, Uint8Array>();
  for (const t of take) {
    if (t.bundle) {
      out.set(t.name, await bundleOf(pkg, entries, t));
      continue;
    }
    const parts: Uint8Array[] = [];
    for (const name of t.from) {
      const e = findEntry(entries, name);
      if (!e) throw new Error(`the package has no ${name}`);
      parts.push(await zipRead(pkg, e));
    }
    let file = parts.length === 1 ? parts[0]! : concat(parts);
    if (t.inner) {
      const inner = zipEntries(file);
      const e = findEntry(inner, t.inner);
      if (!e) throw new Error(`the package has no ${t.inner} inside ${t.from.join(' + ')}`);
      file = await zipRead(file, e);
    }
    if (t.sha256 && (await sha256Hex(file)) !== t.sha256) throw new Error(`${t.name} came out different from the known file`);
    out.set(t.name, file);
  }
  return out;
}

/** A bundle take: the package as it came, or the archive its `from` members join, rewritten as a plain ZIP. */
async function bundleOf(pkg: Uint8Array, entries: ReturnType<typeof zipEntries>, t: Take): Promise<Uint8Array> {
  if (!t.from.length) return pkg;
  const parts: Uint8Array[] = [];
  for (const name of t.from) {
    const e = findEntry(entries, name);
    if (!e) throw new Error(`the package has no ${name}`);
    parts.push(await zipRead(pkg, e));
  }
  const arc = parts.length === 1 ? parts[0]! : concat(parts);
  const files: [string, Uint8Array][] = [];
  for (const e of zipEntries(arc)) if (!e.name.endsWith('/')) files.push([e.name.replace(/\\/g, '/'), await zipRead(arc, e)]);
  return zipStore(files);
}

const cacheOrThrow = async (): Promise<Cache> => {
  if (typeof caches === 'undefined') throw new Error('This browser cannot keep a download (no Cache storage).');
  return caches.open(ARCADE_CACHE);
};

/** GET: download, check, unpack and keep a game's files on this phone. */
export async function getFiles(g: Getting, onProgress?: (p: Progress) => void, o: GetOptions = {}): Promise<void> {
  const cache = await cacheOrThrow();
  const pkg = await fetchPackage(g.data, onProgress, o);
  onProgress?.({ phase: 'unpack', got: 0, total: g.data.take.length });
  const files = await unpack(pkg, g.data.take);
  let n = 0;
  for (const [name, bytes] of files) {
    await cache.put(new Request(keyOf(g.id, name)), new Response(bytes as BodyInit, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) } }));
    onProgress?.({ phase: 'keep', got: ++n, total: files.size });
  }
}

/** Every file of it is on this phone. */
export async function isHere(g: Getting): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(ARCADE_CACHE);
    for (const t of g.data.take) if (!(await cache.match(new Request(keyOf(g.id, t.name))))) return false;
    return true;
  } catch {
    return false;
  }
}

/** One kept file's bytes (null when it is not on this phone). */
export async function readKept(id: string, name: string): Promise<Uint8Array | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const r = await (await caches.open(ARCADE_CACHE)).match(new Request(keyOf(id, name)));
    return r ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** What its kept files take on this phone, in bytes. */
export async function bytesKept(g: Getting): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  let n = 0;
  try {
    const cache = await caches.open(ARCADE_CACHE);
    for (const t of g.data.take) {
      const r = await cache.match(new Request(keyOf(g.id, t.name)));
      if (r) n += Number(r.headers.get('content-length')) || (await r.clone().arrayBuffer()).byteLength;
    }
  } catch {
    /* no cache storage */
  }
  return n;
}

/** Delete its files from this phone (one tap; GET brings them back). */
export async function removeFiles(g: Getting): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(ARCADE_CACHE);
    for (const t of g.data.take) await cache.delete(new Request(keyOf(g.id, t.name)));
  } catch {
    /* no cache storage */
  }
}
