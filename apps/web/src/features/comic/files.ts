/**
 * THE COMIC's files (FINAL ROUND, lane COMIC): his own comics read in on this phone, and his made ones written out.
 *  - CBZ (a zip of pictures, the usual comic file): read here, its pictures in name order.
 *  - CBR (a RAR of pictures): RAR is a closed format no browser can unpack, so it is said in words, with what to do (save it
 *    as CBZ). A file named .cbr that is really a zip (common) is read as one.
 *  - CB7 and CBT likewise said; a PDF is drawn page by page by pdf.js (vendored, on this site); pictures, or a folder of them,
 *    become pages in name order.
 *  - Out: a CBZ (the pages as PNG pictures with a ComicInfo.xml) and a PDF (one page per picture), made here, saved by his tap.
 * The guided view's panels are found here too, on any page: the page shrunk, its gutters (rows and columns of paper colour)
 * found, the panels between them, in reading order. Nothing is uploaded.
 */
import { unzipSync, zipStore } from '../../convert/zip';
import { jpegImage, writePdf } from '../../convert/pdfwrite';
import { inHisWords } from '../../ui/hisWords';
import { newId } from './model';
import type { Book } from './store';

/** The most pages a PDF is drawn into (each page is a picture kept on the phone). */
export const PDF_MAX = 400;
const PIC = /\.(?:jpe?g|png|webp|gif|avif|bmp)$/i;
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const mimeOf = (name: string): string => (/\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : /\.gif$/i.test(name) ? 'image/gif' : /\.avif$/i.test(name) ? 'image/avif' : /\.bmp$/i.test(name) ? 'image/bmp' : 'image/jpeg');
const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'A comic';

export interface Imported {
  book: Book;
  pages: Blob[];
}
export type Progress = (words: string) => void;

/** What a file is, read from its first bytes (a name can lie). */
export function sniff(b: Uint8Array): 'zip' | 'rar' | '7z' | 'pdf' | 'tar' | 'pic' | '' {
  if (b[0] === 0x50 && b[1] === 0x4b) return 'zip';
  if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) return 'rar';
  if (b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf) return '7z';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  if (b.length > 262 && String.fromCharCode(...b.subarray(257, 262)) === 'ustar') return 'tar';
  if ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) || (b[0] === 0x47 && b[1] === 0x49)) return 'pic';
  return '';
}
export const CBR_WORDS = 'This is a CBR file, packed with RAR. RAR is a closed format that no phone browser can open, so I can’t read it here. Save it as a CBZ (any comic app or 7-Zip does it in one step) and import that.';

/** A small cover for the shelf (a JPEG data address, 160 wide). */
export async function thumbOf(b: Blob): Promise<string> {
  try {
    const bm = await createImageBitmap(b);
    const w = 160;
    const h = Math.round((bm.height / bm.width) * w) || 240;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.min(h, 320);
    c.getContext('2d')!.drawImage(bm, 0, 0, w, h);
    bm.close();
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  }
}

/** The pictures of a zip, in reading order. */
function zipPages(bytes: Uint8Array): Blob[] {
  const files = unzipSync(bytes);
  const names = [...files.keys()].filter((n) => PIC.test(n) && !/(^|\/)(__MACOSX|\.)/.test(n)).sort(natural.compare);
  return names.map((n) => new Blob([files.get(n)! as BlobPart], { type: mimeOf(n) }));
}

/** A PDF's pages drawn as pictures (each as tall as a phone needs, about 1,600 pixels). */
async function pdfPages(bytes: Uint8Array, say: Progress): Promise<Blob[]> {
  const { openPdf } = await import('../../convert/vendor');
  const { doc, done } = await openPdf(bytes);
  const out: Blob[] = [];
  try {
    const last = Math.min(doc.numPages, PDF_MAX);
    for (let i = 1; i <= last; i++) {
      say(`Reading page ${i} of ${last}${doc.numPages > last ? ` (the first ${PDF_MAX} of ${doc.numPages})` : ''}…`);
      const pg = await doc.getPage(i);
      const v0 = pg.getViewport({ scale: 1 });
      const scale = Math.min(3, 1600 / Math.max(v0.height, 1));
      const v = pg.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.round(v.width);
      c.height = Math.round(v.height);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: v, canvas: c }).promise;
      pg.cleanup();
      out.push(await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(inHisWords('I couldn’t draw a page of that PDF.'))), 'image/jpeg', 0.86)));
    }
  } finally {
    await done().catch(() => undefined);
  }
  return out;
}

/** His files, read into one comic: a CBZ, a PDF, or a set of pictures (a folder of them). */
export async function importFiles(files: File[], say: Progress, from: Book['from'] = 'file', credit?: string): Promise<Imported> {
  if (!files.length) throw inHisWords('No file was picked.');
  const pics = files.filter((f) => PIC.test(f.name) || f.type.startsWith('image/')).sort((a, b) => natural.compare(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));
  let pages: Blob[] = [];
  let kind = '';
  let title = '';
  const bytesIn = files.reduce((n, f) => n + f.size, 0);
  const packed: File[] = [];
  for (const f of files) {
    if (pics.includes(f)) continue;
    const head = new Uint8Array(await f.slice(0, 300).arrayBuffer());
    if (['zip', 'rar', '7z', 'pdf', 'tar'].includes(sniff(head))) packed.push(f);
  }
  if (pics.length && !packed.length) {
    pages = pics;
    kind = pics.length === 1 ? 'a picture' : `${pics.length} pictures`;
    const dir = (pics[0]!.webkitRelativePath || '').split('/')[0];
    title = dir || titleOf(pics[0]!.name);
  } else {
    const f = packed[0] ?? files.find((x) => !PIC.test(x.name)) ?? files[0]!;
    title = titleOf(f.name);
    say(`Opening ${f.name}…`);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const what = sniff(bytes);
    if (what === 'rar') throw inHisWords(CBR_WORDS);
    if (what === '7z') throw inHisWords('This is a CB7 file, packed with 7-Zip, which a phone browser can’t open. Save it as a CBZ and import that.');
    if (what === 'tar') throw inHisWords('This is a CBT file (a tar archive), which I don’t read yet. Save it as a CBZ and import that.');
    if (what === 'zip') {
      pages = zipPages(bytes);
      kind = /\.cbr$/i.test(f.name) ? 'a CBR file (really a zip inside)' : /\.zip$/i.test(f.name) ? 'a zip of pictures' : 'a CBZ file';
      if (!pages.length) throw inHisWords('That file has no pictures in it, so there are no pages to read.');
    } else if (what === 'pdf') {
      pages = await pdfPages(bytes, say);
      kind = pages.length >= PDF_MAX ? `a PDF (its first ${PDF_MAX} pages; the rest were left out to keep the phone’s room)` : 'a PDF';
      if (!pages.length) throw inHisWords('That PDF has no pages.');
    } else if (what === 'pic') {
      pages = [new Blob([bytes as BlobPart], { type: f.type || mimeOf(f.name) })];
      kind = 'a picture';
    } else throw inHisWords(`I can’t read “${f.name}” as a comic. I read CBZ, PDF, pictures and folders of pictures.`);
  }
  say('Putting it on your shelf…');
  const book: Book = { id: newId('k'), title: title.slice(0, 120), from, pages: pages.length, bytes: bytesIn, added: Date.now(), kind, ...(credit ? { credit } : {}), thumb: await thumbOf(pages[0]!) };
  return { book, pages };
}

// ---------------------------------------------------------------- out: CBZ and PDF
export async function cbzOf(title: string, pages: Blob[], about: { writer?: string; summary?: string } = {}): Promise<Uint8Array> {
  const pad = String(pages.length).length;
  const files: { name: string; data: Uint8Array | string }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const ext = pages[i]!.type === 'image/png' ? 'png' : 'jpg';
    files.push({ name: `${String(i + 1).padStart(Math.max(3, pad), '0')}.${ext}`, data: new Uint8Array(await pages[i]!.arrayBuffer()) });
  }
  const x = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
  files.push({ name: 'ComicInfo.xml', data: `<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n  <Title>${x(title)}</Title>\n  <Writer>${x(about.writer ?? 'Me')}</Writer>\n  <Summary>${x(about.summary ?? '')}</Summary>\n  <PageCount>${pages.length}</PageCount>\n  <Manga>No</Manga>\n</ComicInfo>\n` });
  return zipStore(files);
}
/** The pages as a PDF, each page the picture's own shape. */
export async function pdfOf(title: string, pages: Blob[]): Promise<Uint8Array> {
  const out = [];
  for (const p of pages) {
    let jpg = p;
    if (p.type !== 'image/jpeg') {
      const bm = await createImageBitmap(p);
      const c = document.createElement('canvas');
      c.width = bm.width;
      c.height = bm.height;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bm, 0, 0);
      bm.close();
      jpg = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(inHisWords('I couldn’t make a page picture.'))), 'image/jpeg', 0.9));
    }
    const img = jpegImage(new Uint8Array(await jpg.arrayBuffer()));
    if (!img) throw inHisWords('A page could not go into the PDF.');
    const w = 595.28;
    const h = (img.h / img.w) * w;
    out.push({ w, h, images: [{ img, x: 0, y: 0, w, h }] });
  }
  return writePdf(out, { title, author: 'Ghosty Comics' });
}

// ---------------------------------------------------------------- the guided view's panels, found on any page
/** The panels on a page picture, as [x, y, w, h] fractions in reading order (left to right, top to bottom; right to left for manga). */
export function findPanels(data: ImageData, rtl = false): [number, number, number, number][] {
  const { width: W, height: H, data: px } = data;
  const lum = (i: number) => (px[i * 4]! * 0.3 + px[i * 4 + 1]! * 0.59 + px[i * 4 + 2]! * 0.11);
  // the paper's colour: the corners
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map(lum);
  const paper = corners.reduce((a, b) => a + b, 0) / 4;
  const isPaper = (i: number) => Math.abs(lum(i) - paper) < 38;
  const rowClear = (y: number, x0: number, x1: number) => {
    let n = 0;
    for (let x = x0; x < x1; x++) if (isPaper(y * W + x)) n++;
    return n >= (x1 - x0) * 0.97;
  };
  const colClear = (x: number, y0: number, y1: number) => {
    let n = 0;
    for (let y = y0; y < y1; y++) if (isPaper(y * W + x)) n++;
    return n >= (y1 - y0) * 0.97;
  };
  const runs = (n: number, clear: (i: number) => boolean, min: number): [number, number][] => {
    const out: [number, number][] = [];
    let s = -1;
    for (let i = 0; i <= n; i++) {
      const c = i < n && !clear(i);
      if (c && s < 0) s = i;
      if (!c && s >= 0) {
        if (i - s >= min) out.push([s, i]);
        s = -1;
      }
    }
    return out;
  };
  const panels: [number, number, number, number][] = [];
  for (const [y0, y1] of runs(H, (y) => rowClear(y, 0, W), H * 0.06)) {
    const cols = runs(W, (x) => colClear(x, y0, y1), W * 0.08);
    const ordered = rtl ? [...cols].reverse() : cols;
    for (const [x0, x1] of ordered) {
      // a column's own rows (a tall panel beside two short ones)
      const sub = runs(y1 - y0, (y) => rowClear(y0 + y, x0, x1), H * 0.06);
      for (const [a, b] of sub.length > 1 ? sub : [[0, y1 - y0] as [number, number]]) panels.push([x0 / W, (y0 + a) / H, (x1 - x0) / W, (b - a) / H]);
    }
  }
  const real = panels.filter(([, , w, h]) => w * h > 0.015);
  return real.length >= 2 ? real : [[0, 0, 1, 1]];
}
/** The panels of a page picture (shrunk to 240 wide to look). */
export async function panelsOf(b: Blob): Promise<[number, number, number, number][]> {
  try {
    const bm = await createImageBitmap(b);
    const w = 240;
    const h = Math.max(1, Math.round((bm.height / bm.width) * w));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bm, 0, 0, w, h);
    bm.close();
    return findPanels(ctx.getImageData(0, 0, w, h));
  } catch {
    return [[0, 0, 1, 1]];
  }
}
