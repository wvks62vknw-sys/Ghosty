/**
 * REAL CBR COMICS (NEXT ROUND, half done → done; comic.u14): a CBR is a RAR file of page pictures, a closed format no browser
 * opens by itself. The free RAR reader (libarchive compiled to WebAssembly, vendored on this site: public/vendor/libarchive,
 * 1.1 MB) unpacks it on the phone, in its own worker. It is fetched only on his tap, with its size said, and never on mobile
 * data; the browser keeps it after that. Nothing is sent anywhere.
 */
import { inHisWords, rawText } from '../../ui/hisWords';
import { onMobileData } from './library';

/** The reader's size, as fetched (the wrapper, the worker and the WebAssembly). */
export const RAR_BYTES = 1_073_335;
const KEPT = 'ghosty.comic.rarReader';
export const rarKept = (): boolean => {
  try {
    return localStorage.getItem(KEPT) === '1';
  } catch {
    return false;
  }
};

/** An error that means "the RAR reader is needed": the shelf offers GET THE RAR READER with its size. */
export const rarNeeded = (what: 'rar' | '7z' | 'tar' = 'rar'): Error => Object.assign(inHisWords(`This is ${what === 'rar' ? 'a CBR file, packed with RAR' : what === '7z' ? 'a CB7 file, packed with 7-Zip' : 'a CBT file (a tar archive)'}. To open it, I need the free archive reader (1.1 MB, once; your browser keeps it). Tap GET THE RAR READER, on Wi-Fi.`), { rar: true });
export const isRarNeeded = (e: unknown): boolean => !!(e && typeof e === 'object' && (e as { rar?: boolean }).rar);

type Tree = { [name: string]: Blob | Tree };
interface LibArchive {
  Archive: {
    init(o: { workerUrl: string }): unknown;
    open(f: File | Blob): Promise<{ extractFiles(cb?: (e: { file: File; path: string }) => void): Promise<Tree>; close?(): Promise<void> }>;
  };
}
let lib: Promise<LibArchive> | null = null;
function load(): Promise<LibArchive> {
  lib ??= (async () => {
    const url: string = '/vendor/libarchive/libarchive.js';
    const m = (await import(/* @vite-ignore */ url)) as LibArchive;
    m.Archive.init({ workerUrl: '/vendor/libarchive/worker-bundle.js' });
    return m;
  })().catch((e: unknown) => {
    lib = null;
    throw e;
  });
  return lib;
}

/** The RAR reader fetched (his tap has been made): refused on mobile data, said in words. */
export async function getRarReader(): Promise<void> {
  if (onMobileData()) throw inHisWords('You are on mobile data, and the RAR reader is 1.1 MB: it waits for Wi-Fi. Join Wi-Fi and tap GET THE RAR READER again.');
  await load();
  try {
    localStorage.setItem(KEPT, '1');
  } catch {
    /* (kept by the browser all the same) */
  }
}

/** Every file in a RAR, by its path. */
export async function unrar(f: File | Blob, say: (w: string) => void): Promise<{ name: string; data: Blob }[]> {
  const m = await load();
  const archive = await m.Archive.open(f);
  try {
    let n = 0;
    const tree = await archive.extractFiles(() => {
      n++;
      if (n % 5 === 0) say(`Unpacking… ${n} files so far`);
    });
    // (the archive's folders, flattened to paths)
    const out: { name: string; data: Blob }[] = [];
    const walk = (t: Tree, at: string) => {
      for (const [k, v] of Object.entries(t)) {
        if (v instanceof Blob) out.push({ name: `${at}${k}`, data: v });
        else if (v && typeof v === 'object') walk(v, `${at}${k}/`);
      }
    };
    walk(tree, '');
    return out;
  } catch (e) {
    if (/password|encrypt/i.test(rawText(e))) throw inHisWords('This CBR is locked with a password, so I can’t open it.');
    throw e;
  } finally {
    await archive.close?.().catch(() => undefined);
  }
}
