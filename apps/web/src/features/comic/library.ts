/**
 * THE COMIC's public-domain library (FINAL ROUND, lane COMIC): comics whose copyright has ended, listed from the Internet
 * Archive's open search (no key, nothing paid): the "comics" collection, only items whose licence is marked public domain.
 * A comic is fetched only on his tap: the first tap looks up its files and says the size of the one it would get (a CBZ if
 * there is one, else the PDF; a CBR is never fetched, since no browser can open RAR), the second fetches it, and not on mobile
 * data. It then sits on his shelf like his own, with where it came from said. The Digital Comic Museum has no open listing a
 * page can read (its downloads need an account), so it is not used.
 */
import { inHisWords } from '../../ui/hisWords';

export interface PdItem {
  id: string;
  title: string;
  year: string;
  creator: string;
}
export interface PdFile {
  name: string;
  bytes: number;
  kind: 'CBZ' | 'PDF';
  /** the PDF to fall back on when a CBZ turns out to be RAR inside (common on the Archive) */
  alt?: PdFile;
}

const SEARCH = 'https://archive.org/advancedsearch.php';
/** What the shelf shows with no words: the most read public-domain comics. */
export const PD_QUERY = 'collection:(comics) AND mediatype:(texts) AND licenseurl:(*publicdomain*)';

export function searchUrl(words: string, page = 1): string {
  const w = words.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().slice(0, 80);
  const q = w ? `${PD_QUERY} AND (title:(${w}) OR subject:(${w}))` : PD_QUERY;
  const p = new URLSearchParams({ q, rows: '24', page: String(page), output: 'json', 'sort[]': 'downloads desc' });
  for (const f of ['identifier', 'title', 'date', 'year', 'creator', 'licenseurl']) p.append('fl[]', f);
  return `${SEARCH}?${p}`;
}

export async function searchPd(words: string, signal?: AbortSignal): Promise<PdItem[]> {
  const r = await fetch(searchUrl(words), { signal });
  if (!r.ok) throw inHisWords(`The Internet Archive didn’t answer (it said ${r.status}). Try again in a minute.`);
  const j = (await r.json()) as { response?: { docs?: Record<string, unknown>[] } };
  const s = (v: unknown) => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v));
  return (j.response?.docs ?? [])
    .filter((d) => /publicdomain/i.test(s(d.licenseurl)) && /^[\w.-]+$/.test(s(d.identifier)))
    .map((d) => ({ id: s(d.identifier), title: s(d.title).slice(0, 140) || s(d.identifier), year: (s(d.year) || s(d.date)).slice(0, 4), creator: s(d.creator).slice(0, 80) }));
}

/** The file to fetch for an item: its CBZ, else its PDF (never a CBR), with its exact size. */
export async function fileOf(id: string, signal?: AbortSignal): Promise<PdFile> {
  const r = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}/files`, { signal });
  if (!r.ok) throw inHisWords(`The Internet Archive didn’t answer (it said ${r.status}). Try again in a minute.`);
  const j = (await r.json()) as { result?: { name?: string; format?: string; size?: string }[] };
  const files = (j.result ?? []).filter((f) => f.name && !/\//.test(f.name));
  const cbz = files.find((f) => /\.cbz$/i.test(f.name!) || /comic book zip/i.test(f.format ?? ''));
  const pdf = files.filter((f) => /\.pdf$/i.test(f.name!) && !/_text\.pdf$/i.test(f.name!)).sort((a, b) => Number(a.size) - Number(b.size))[0];
  const f = cbz ?? pdf;
  if (!f) throw inHisWords(files.some((x) => /\.cbr$/i.test(x.name!)) ? 'This one only comes as a CBR (RAR), which a phone browser can’t open, so I left it. Pick another.' : 'This one has no comic file I can read (no CBZ or PDF). Pick another.');
  const pdfFile: PdFile | undefined = pdf ? { name: pdf.name!, bytes: Number(pdf.size) || 0, kind: 'PDF' } : undefined;
  return f === cbz ? { name: f.name!, bytes: Number(f.size) || 0, kind: 'CBZ', ...(pdfFile ? { alt: pdfFile } : {}) } : pdfFile!;
}

/** The file itself, through the Archive's own CORS door, with how much has come said as it comes. */
export async function fetchPd(id: string, f: PdFile, say: (got: number) => void, signal?: AbortSignal): Promise<File> {
  const r = await fetch(`https://archive.org/cors/${encodeURIComponent(id)}/${encodeURIComponent(f.name)}`, { signal });
  if (!r.ok || !r.body) throw inHisWords(`The download didn’t start (the Internet Archive said ${r.status}). Try again in a minute.`);
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.byteLength;
    say(got);
  }
  return new File(parts as BlobPart[], f.name, { type: f.kind === 'PDF' ? 'application/pdf' : 'application/vnd.comicbook+zip' });
}

/** On mobile data, as far as the browser can tell (Safari cannot tell: the words then ask for Wi-Fi). */
export function onMobileData(): boolean {
  const c = (globalThis.navigator as unknown as { connection?: { type?: string; saveData?: boolean } } | undefined)?.connection;
  return c?.type === 'cellular' || c?.saveData === true;
}
export const creditOf = (it: PdItem): string => `Public domain, from the Internet Archive (archive.org/details/${it.id})${it.year ? `, first published ${it.year}` : ''}.`;
