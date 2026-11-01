/**
 * A ZIM file on this phone, read by Kiwix's own reader (kiwix-js, GPL-3: the ZIM format's header, directory, title index
 * and clusters, with the xz and zstd decoders it ships as WebAssembly), vendored under public/vendor/kiwix with its
 * licence and SOURCE.md (the commit, the files taken, our patches). The reader is loaded from there at the first search,
 * never bundled; its decoders start at the first article read. Nothing here touches the network: the file's pieces come
 * from wiki/store.ts (the Cache API), each read as a slice of its piece.
 *
 * What it gives the Library's section (wiki/view.ts) and the chat (wiki/ask.ts): the title search (a title prefix, in the
 * case he typed and the usual capitalisations, from the file's title index), an article by its entry path (redirects
 * followed), a picture's bytes, a random article, the file's own metadata (its title, date, language, article count).
 */

/** One piece of the file as the reader reads it: a name that sorts in order, its size, and slices of it. */
export interface PieceFile {
  name: string;
  size: number;
  slice(begin: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

export interface Hit {
  title: string;
  /** Its entry ("C/Black_hole"). */
  path: string;
}

export interface Article extends Hit {
  html: string;
}

export interface ZimMeta {
  title: string;
  date: string;
  language: string;
  description: string;
  /** Articles in the title index (redirects included, as the file counts them). */
  articles: number;
}

export interface Archive {
  meta: ZimMeta;
  search(prefix: string, max?: number): Promise<Hit[]>;
  /** The article whose title is exactly one of `titles` (the first found), redirects followed. */
  find(titles: string[]): Promise<Hit | null>;
  article(path: string): Promise<Article | null>;
  bytes(path: string): Promise<{ data: Uint8Array; mime: string } | null>;
  random(): Promise<Hit | null>;
}

// ---------------------------------------------------------------- the reader's own shapes (vendored JavaScript)

interface DirEntry {
  namespace: string;
  url: string;
  title: string;
  redirect: boolean;
  redirectTarget: number;
  getTitleOrUrl(): string;
  getMimetype(): string;
  isRedirect(): boolean;
  readData(): Promise<Uint8Array>;
}
interface ZimFileApi {
  minorVersion: number;
  entryCount: number;
  articleCount: number | null;
  mainPage: number;
  dirEntryByUrlIndex(i: number): Promise<DirEntry>;
  dirEntryByTitleIndex(i: number): Promise<DirEntry>;
  setListings(l: { path: string; ptrName: string; countName: string }[]): Promise<unknown>;
}
interface Reader {
  fromFileArray(files: PieceFile[]): Promise<ZimFileApi>;
}
interface Decoder {
  init(options?: { wasmBinary?: Uint8Array }): Promise<void>;
}

/** Where the vendored reader is served from (the tests give its folder on disk, and the decoders' WebAssembly bytes). */
let base = '/vendor/kiwix/';
let wasm: { xz?: Uint8Array; zstd?: Uint8Array } = {};
let reader: Promise<Reader> | null = null;

export function setReaderBase(url: string, bytes: { xz?: Uint8Array; zstd?: Uint8Array } = {}): void {
  base = url.endsWith('/') ? url : `${url}/`;
  wasm = bytes;
  reader = null;
}

function loadReader(): Promise<Reader> {
  if (!reader) {
    const at = base;
    reader = (async () => {
      const lib = (await import(/* @vite-ignore */ `${at}zimfile.js`)) as { default: Reader };
      // both decoders start now, while there may be a signal: their WebAssembly is then in the page (and in the service
      // worker's cache of /vendor), so an article read later with no signal still decodes
      const [xz, zstd] = (await Promise.all([import(/* @vite-ignore */ `${at}xzdec_wrapper.js`), import(/* @vite-ignore */ `${at}zstddec_wrapper.js`)])) as { default: Decoder }[];
      await Promise.all([xz!.default.init(wasm.xz ? { wasmBinary: wasm.xz } : {}), zstd!.default.init(wasm.zstd ? { wasmBinary: wasm.zstd } : {})]);
      return lib.default;
    })().catch((e) => {
      reader = null;
      throw e;
    });
  }
  return reader;
}

const utf8 = new TextDecoder();
/** Two entries in the order the file keeps its directory: namespace, then the rest. */
const before = (ns: string, s: string, ns2: string, s2: string) => (ns === ns2 ? s < s2 : ns < ns2);

/** Opens the file whose pieces these are (wiki/store.ts pieceFiles), reading its directory and title index. */
export async function openArchive(files: PieceFile[]): Promise<Archive> {
  const R = await loadReader();
  const zf = await R.fromFileArray([...files]);
  await zf.setListings([
    { path: 'X/listing/titleOrdered/v0', ptrName: 'titlePtrPos', countName: 'entryCount' },
    { path: 'X/listing/titleOrdered/v1', ptrName: 'articlePtrPos', countName: 'articleCount' },
  ]);
  // the content namespace: 'A' in the old layout, 'C' since (ZIM minor version 1)
  const cns = zf.minorVersion === 0 ? 'A' : 'C';
  const count = zf.articleCount || zf.entryCount;

  /** The entry at this path ("C/Cat", "M/Title"), or null: a binary search of the directory, which is in path order. */
  async function byPath(path: string): Promise<DirEntry | null> {
    const ns = path.slice(0, 1);
    const url = path.slice(2);
    let lo = 0;
    let hi = zf.entryCount;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const d = await zf.dirEntryByUrlIndex(mid);
      if (before(d.namespace, d.url, ns, url)) lo = mid + 1;
      else hi = mid;
    }
    if (lo >= zf.entryCount) return null;
    const d = await zf.dirEntryByUrlIndex(lo);
    return d.namespace === ns && d.url === url ? d : null;
  }
  /** Redirects followed (five at most: a loop in a broken file ends there). */
  async function final(d: DirEntry | null): Promise<DirEntry | null> {
    for (let n = 0; d && d.isRedirect() && n < 5; n++) d = await zf.dirEntryByUrlIndex(d.redirectTarget);
    return d && !d.isRedirect() ? d : null;
  }
  /** The first index in the title list whose title is not before `title` (articles only: the content namespace). */
  async function lowerBound(title: string): Promise<number> {
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const d = await zf.dirEntryByTitleIndex(mid);
      if (before(d.namespace, d.getTitleOrUrl(), cns, title)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  const hitOf = (d: DirEntry): Hit => ({ title: d.getTitleOrUrl(), path: `${d.namespace}/${d.url}` });
  async function text(path: string): Promise<string> {
    const d = await final(await byPath(path));
    return d ? utf8.decode(await d.readData()).trim() : '';
  }

  const meta: ZimMeta = {
    title: await text('M/Title'),
    date: await text('M/Date'),
    language: await text('M/Language'),
    description: await text('M/Description'),
    articles: count,
  };

  return {
    meta,
    async search(prefix, max = 20) {
      const said = prefix.replace(/\s+/g, ' ').trim();
      if (!said) return [];
      const first = said.charAt(0).toUpperCase() + said.slice(1);
      const variants = [...new Set([said, first, first.charAt(0) + said.slice(1).toLowerCase(), said.toLowerCase()])];
      const out: Hit[] = [];
      const seen = new Set<string>();
      for (const v of variants) {
        if (out.length >= max) break;
        for (let i = await lowerBound(v); i < count && out.length < max; i++) {
          const d = await zf.dirEntryByTitleIndex(i);
          const t = d.getTitleOrUrl();
          if (d.namespace !== cns || !t.startsWith(v)) break;
          const h = hitOf(d);
          if (!seen.has(h.path)) {
            seen.add(h.path);
            out.push(h);
          }
        }
      }
      return out;
    },
    async find(titles) {
      for (const t of titles) {
        const i = await lowerBound(t);
        if (i >= count) continue;
        const d = await zf.dirEntryByTitleIndex(i);
        if (d.namespace !== cns || d.getTitleOrUrl() !== t) continue;
        const end = await final(d);
        if (end && /html/.test(end.getMimetype() ?? '')) return { title: end.getTitleOrUrl(), path: `${end.namespace}/${end.url}` };
      }
      return null;
    },
    async article(path) {
      const d = await final(await byPath(path));
      if (!d || !/html/.test(d.getMimetype() ?? '')) return null;
      return { title: d.getTitleOrUrl(), path: `${d.namespace}/${d.url}`, html: utf8.decode(await d.readData()) };
    },
    async bytes(path) {
      const d = await final(await byPath(path));
      return d ? { data: await d.readData(), mime: d.getMimetype() ?? 'application/octet-stream' } : null;
    },
    async random() {
      for (let n = 0; n < 8; n++) {
        const d = await final(await zf.dirEntryByTitleIndex(Math.floor(Math.random() * count)));
        if (d && d.namespace === cns && /html/.test(d.getMimetype() ?? '')) return hitOf(d);
      }
      return null;
    },
  };
}
