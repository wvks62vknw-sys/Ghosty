/**
 * THE CONVERTER at work, in the browser (BRIEF-REST-E part 1): each conversion of convert/list.ts done on this phone —
 * the pictures on a canvas, the PDFs with our own writer and pdf.js (vendor/pdfjs), the tables with SheetJS
 * (vendor/sheetjs), Word with mammoth (vendor/mammoth), MP3 with LAME (vendor/lamejs), sound with the phone's own
 * decoder, codes with the scanner's reader. The vendored libraries load on first use, from this site only. Nothing is
 * uploaded anywhere: the files never leave the phone.
 */
import { IMAGE_KINDS, MIME, renamed, sizeWords, sniff, textOf, type Kind } from './bytes';
import { decodeWav, encodeMp3, encodeWav, lengthWords, rangeOf, trimSound, type Sound } from './audio';
import { stripLocation } from './exif';
import { forKinds } from './list';
import { jpegImage, jpegInfo, picturePage, pngImage, rgbaImage, writePdf, type PdfImage } from './pdfwrite';
import { lame, openPdf, phoneDeflate, sheetJs } from './vendor';
import { joinPdfs, pageList, pdfPageCount, splitPdf } from './pdfpages';
import { jsonToRows, parseCsv, reformatJson, rowsToObjects, rowsToXlsx, toCsv, xlsxToRows } from './table';
import { zipStore } from './zip';
import { docxFrom } from '../docs/docx';
import { fromHtml, toHtml, toMarkdown, toText, newDoc, titled, type Doc } from '../docs/model';
import { pdfOfDocAnyScript, readDocBytes } from '../docs/read';

export interface Picked {
  file: File;
  kind: Kind;
}
export interface Output {
  name: string;
  blob: Blob;
  /** What to say about it ("2 pages", "the GPS position taken out"). */
  note?: string;
  /** A document to open in DOCUMENTS (open-doc). */
  doc?: Doc;
}
export type Progress = (words: string, frac?: number) => void;
export type Opts = Record<string, string | number | boolean | undefined>;

// ---------------------------------------------------------------- pictures
export const bytesOf = async (b: Blob): Promise<Uint8Array> => new Uint8Array(await b.arrayBuffer());

/** A picture decoded on this phone (its way up applied); a HEIC this browser cannot open is said in plain words. */
export async function decodePicture(file: Blob, kind: Kind): Promise<{ img: CanvasImageSource; w: number; h: number; close(): void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const im = new Image();
      im.decoding = 'async';
      im.src = url;
      await im.decode();
      return { img: im, w: im.naturalWidth, h: im.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(kind === 'heic' ? 'this browser can’t open HEIC photos (Safari on an iPhone or a Mac can). On the iPhone, share the photo from Photos as JPG, or set Settings → Camera → Formats → Most Compatible' : 'this picture would not open on this phone');
    }
  }
}

/** A canvas of the picture, drawn at w × h, from the part of it `crop` names. */
export function drawn(src: { img: CanvasImageSource; w: number; h: number }, w: number, h: number, crop?: { x: number; y: number; w: number; h: number }, white = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d')!;
  if (white) {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
  }
  g.imageSmoothingQuality = 'high';
  const r = crop ?? { x: 0, y: 0, w: src.w, h: src.h };
  g.drawImage(src.img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

/** The canvas as a file of this type; null when the phone cannot write that type (Safari writes no WebP). */
export async function encodeCanvas(c: HTMLCanvasElement, type: string, quality = 0.9): Promise<Blob | null> {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, type, quality));
  return blob && blob.type === type ? blob : null;
}

/** The centre of a picture cut to a shape ("4:3"): the biggest box of that shape that fits. Pure. */
export function cropBox(w: number, h: number, ratio: string): { x: number; y: number; w: number; h: number } {
  const [a, b] = ratio.split(':').map(Number);
  const r = a && b ? a / b : 1;
  const cw = Math.min(w, h * r);
  const ch = cw / r;
  return { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: Math.round(cw), h: Math.round(ch) };
}

/**
 * The best JPEG under a size: the quality found by halving (eight tries at most), and when even the lowest is too big,
 * the picture made smaller by a fifth at a time. `encode` makes one try at a quality and a scale.
 */
export async function underSize(encode: (q: number, scale: number) => Promise<Blob>, target: number): Promise<{ blob: Blob; quality: number; scale: number }> {
  let scale = 1;
  for (let round = 0; round < 12; round++) {
    let lo = 0.3;
    let hi = 0.95;
    let best: { blob: Blob; quality: number } | null = null;
    const top = await encode(hi, scale);
    if (top.size <= target) return { blob: top, quality: hi, scale };
    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2;
      const b = await encode(q, scale);
      if (b.size <= target) {
        best = { blob: b, quality: q };
        lo = q;
      } else hi = q;
    }
    if (best) return { ...best, scale };
    const low = await encode(lo, scale);
    if (low.size <= target) return { blob: low, quality: lo, scale };
    scale *= 0.8;
  }
  throw new Error('it won’t go that small');
}

/** A picture for the PDF: a JPEG as it is (unless the camera turned it), a PNG as a Flate stream, anything else drawn. */
async function pdfPicture(f: Picked): Promise<PdfImage> {
  const bytes = await bytesOf(f.file);
  if (f.kind === 'jpg' && (jpegInfo(bytes)?.orientation ?? 1) === 1) {
    const j = jpegImage(bytes);
    if (j) return j;
  }
  if (f.kind === 'png') {
    const p = await pngImage(bytes, phoneDeflate);
    if (p) return p;
  }
  const pic = await decodePicture(f.file, f.kind);
  try {
    const c = drawn(pic, pic.w, pic.h);
    if (f.kind === 'jpg' || f.kind === 'heic') {
      const blob = await encodeCanvas(c, 'image/jpeg', 0.92);
      const j = blob && jpegImage(await bytesOf(blob));
      if (j) return j;
    }
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    return rgbaImage(d.data, c.width, c.height, phoneDeflate);
  } finally {
    pic.close();
  }
}

// ---------------------------------------------------------------- sound
/** A recording decoded by this phone's own player (what it can read depends on the phone). */
export async function decodeSound(file: Blob, kind: Kind): Promise<Sound> {
  const bytes = await bytesOf(file);
  if (kind === 'wav') {
    const w = decodeWav(bytes);
    if (w) return w;
  }
  const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error('this phone has no sound decoder in its browser');
  const ac = new Ctx();
  try {
    const buf = await ac.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return { rate: buf.sampleRate, channels: Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i).slice()) };
  } catch {
    throw new Error(`this phone’s player can’t read ${kind.toUpperCase()} files`);
  } finally {
    void ac.close();
  }
}

/** The formats this phone's recorder writes, best first (said per device). */
export function phoneAudioTypes(): string[] {
  const R = (window as unknown as { MediaRecorder?: { isTypeSupported(t: string): boolean } }).MediaRecorder;
  if (!R) return [];
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].filter((t) => R.isTypeSupported(t));
}

/** A sound written in the phone's own format by playing it once, in real time, into its recorder. */
async function soundToPhone(s: Sound, progress: Progress): Promise<{ blob: Blob; ext: string }> {
  const type = phoneAudioTypes()[0];
  if (!type) throw new Error('this phone’s browser has no sound recorder to write with');
  const ac = new AudioContext({ sampleRate: s.rate });
  try {
    const buf = ac.createBuffer(s.channels.length, s.channels[0]!.length, s.rate);
    s.channels.forEach((c, i) => buf.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    const dest = ac.createMediaStreamDestination();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: type });
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const done = new Promise<void>((ok) => (rec.onstop = () => ok()));
    rec.start(250);
    src.start();
    const secs = buf.duration;
    const t0 = performance.now();
    const tick = setInterval(() => progress(`playing it into the recorder: ${Math.round((performance.now() - t0) / 1000)} of ${Math.round(secs)} s`, Math.min(1, (performance.now() - t0) / 1000 / secs)), 500);
    await new Promise<void>((ok) => (src.onended = () => ok()));
    clearInterval(tick);
    rec.stop();
    await done;
    return { blob: new Blob(parts, { type: type.split(';')[0] }), ext: type.startsWith('audio/mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm' };
  } finally {
    void ac.close();
  }
}

// ---------------------------------------------------------------- the conversions
const stem = (name: string) => name.replace(/\.[^./]+$/, '') || 'file';
const textBlob = (t: string, ext: string) => new Blob([t], { type: `${MIME[ext] ?? 'text/plain'};charset=utf-8` });

/** A file read as a document (any readable kind): its words with their headings and lists. */
async function asDoc(p: Picked, progress: Progress): Promise<Doc> {
  progress(`reading ${p.file.name}…`);
  return readDocBytes(await bytesOf(p.file), p.file.name, p.kind);
}

/** Run one conversion on these files: what it made, each with its name. */
export async function runConversion(id: string, picked: Picked[], opts: Opts, progress: Progress): Promise<Output[]> {
  const conv = forKinds(picked.map((p) => p.kind)).find((c) => c.id === id) ?? null;
  if (!conv && picked.length) throw new Error('that conversion doesn’t take these files');
  const out: Output[] = [];
  const each = async (fn: (p: Picked, i: number) => Promise<Output | Output[]>) => {
    for (const [i, p] of picked.entries()) {
      progress(picked.length > 1 ? `${i + 1} of ${picked.length}: ${p.file.name}` : p.file.name, i / picked.length);
      const r = await fn(p, i);
      out.push(...(Array.isArray(r) ? r : [r]));
    }
  };
  switch (id) {
    case 'img-jpg':
    case 'img-png':
    case 'img-webp': {
      const type = id === 'img-jpg' ? 'image/jpeg' : id === 'img-png' ? 'image/png' : 'image/webp';
      const ext = id.slice(4);
      await each(async (p) => {
        const pic = await decodePicture(p.file, p.kind);
        try {
          const blob = await encodeCanvas(drawn(pic, pic.w, pic.h, undefined, type === 'image/jpeg'), type, Number(opts.quality ?? 0.9));
          if (!blob) throw new Error(`this phone can’t write ${ext.toUpperCase()} pictures (Safari writes JPG and PNG)`);
          return { name: renamed(p.file.name, ext), blob };
        } finally {
          pic.close();
        }
      });
      break;
    }
    case 'img-resize': {
      await each(async (p) => {
        const pic = await decodePicture(p.file, p.kind);
        try {
          const width = Number(opts.width) || Math.round((pic.w * (Number(opts.percent) || 50)) / 100);
          const height = Math.round((pic.h * width) / pic.w);
          const type = p.kind === 'png' ? 'image/png' : p.kind === 'webp' ? 'image/webp' : 'image/jpeg';
          const blob = (await encodeCanvas(drawn(pic, width, height, undefined, type === 'image/jpeg'), type, 0.9)) ?? (await encodeCanvas(drawn(pic, width, height, undefined, true), 'image/jpeg', 0.9))!;
          return { name: renamed(p.file.name, blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg', `${width}x${height}`), blob, note: `${pic.w} × ${pic.h} → ${width} × ${height}` };
        } finally {
          pic.close();
        }
      });
      break;
    }
    case 'img-compress': {
      const target = Math.max(5, Number(opts.kb) || 500) * 1000;
      await each(async (p) => {
        const pic = await decodePicture(p.file, p.kind);
        try {
          const r = await underSize(async (q, scale) => (await encodeCanvas(drawn(pic, pic.w * scale, pic.h * scale, undefined, true), 'image/jpeg', q))!, target);
          return { name: renamed(p.file.name, 'jpg', 'smaller'), blob: r.blob, note: `${sizeWords(p.file.size)} → ${sizeWords(r.blob.size)}${r.scale < 1 ? `, made ${Math.round(r.scale * 100)}% of its size` : ''}` };
        } finally {
          pic.close();
        }
      });
      break;
    }
    case 'img-crop': {
      const ratio = String(opts.ratio ?? '1:1');
      await each(async (p) => {
        const pic = await decodePicture(p.file, p.kind);
        try {
          const box = cropBox(pic.w, pic.h, ratio);
          const type = p.kind === 'png' ? 'image/png' : 'image/jpeg';
          const blob = (await encodeCanvas(drawn(pic, box.w, box.h, box, type === 'image/jpeg'), type, 0.92))!;
          return { name: renamed(p.file.name, type === 'image/png' ? 'png' : 'jpg', ratio.replace(':', 'x')), blob, note: `cut to ${ratio}: ${box.w} × ${box.h}` };
        } finally {
          pic.close();
        }
      });
      break;
    }
    case 'img-strip':
      await each(async (p) => {
        const s = stripLocation(await bytesOf(p.file));
        return { name: renamed(p.file.name, p.kind === 'jpg' ? 'jpg' : p.kind, 'no location'), blob: new Blob([s.bytes as BlobPart], { type: p.file.type || MIME[p.kind] || '' }), note: s.removed.length ? `Taken out: ${s.removed.join('; ')}.` : 'There was no location in it: nothing to take out.' };
      });
      break;
    case 'images-pdf': {
      const pages = [];
      for (const [i, p] of picked.entries()) {
        progress(`picture ${i + 1} of ${picked.length}`, i / picked.length);
        pages.push(picturePage(await pdfPicture(p), opts.size === 'fit' ? 'fit' : 'a4'));
      }
      const pdf = writePdf(pages, { title: stem(picked[0]!.file.name) });
      out.push({ name: `${stem(picked[0]!.file.name)}${picked.length > 1 ? ` and ${picked.length - 1} more` : ''}.pdf`, blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }), note: `${pages.length} page${pages.length === 1 ? '' : 's'}, ${opts.size === 'fit' ? 'each the picture’s own shape' : 'A4'}` });
      break;
    }
    case 'pdf-png': {
      const { doc, done } = await openPdf(await bytesOf(picked[0]!.file));
      try {
        const want = opts.pages ? pageList(String(opts.pages), doc.numPages) : Array.from({ length: Math.min(doc.numPages, 50) }, (_, i) => i + 1);
        for (const [i, n] of want.entries()) {
          progress(`page ${n} of ${doc.numPages}`, i / want.length);
          const page = await doc.getPage(n);
          const vp = page.getViewport({ scale: Number(opts.scale) || 2 });
          const c = document.createElement('canvas');
          c.width = Math.ceil(vp.width);
          c.height = Math.ceil(vp.height);
          const g = c.getContext('2d')!;
          g.fillStyle = '#fff';
          g.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: g, viewport: vp, canvas: c }).promise;
          page.cleanup();
          out.push({ name: `${stem(picked[0]!.file.name)} page ${n}.png`, blob: (await encodeCanvas(c, 'image/png'))! });
        }
      } finally {
        await done();
      }
      break;
    }
    case 'pdf-split': {
      const bytes = await bytesOf(picked[0]!.file);
      const count = pdfPageCount(bytes);
      const want = pageList(String(opts.pages ?? ''), count);
      if (!want.length) throw new Error(`say which pages, from 1 to ${count} (for example "1-3, 5")`);
      const pdf = splitPdf(bytes, want);
      out.push({ name: `${stem(picked[0]!.file.name)} pages ${String(opts.pages).replace(/\s+/g, '')}.pdf`, blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }), note: `${want.length} of its ${count} pages` });
      break;
    }
    case 'pdf-join': {
      const list = await Promise.all(picked.map((p) => bytesOf(p.file)));
      const pdf = joinPdfs(list);
      out.push({ name: `${stem(picked[0]!.file.name)} joined.pdf`, blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }), note: `${picked.length} PDFs, ${pdfPageCount(pdf)} pages` });
      break;
    }
    case 'pdf-text': {
      const { doc, done } = await openPdf(await bytesOf(picked[0]!.file));
      try {
        const pages: string[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          progress(`page ${n} of ${doc.numPages}`, n / doc.numPages);
          const tc = await (await doc.getPage(n)).getTextContent();
          pages.push(tc.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('').replace(/[ \t]+\n/g, '\n').trim());
        }
        const text = pages.join('\n\n\f');
        if (!text.replace(/\f/g, '').trim()) throw new Error('this PDF has no words in it to take out: it is pictures of pages (a scan). The Lens’s READ reads a photo of a page');
        out.push({ name: renamed(picked[0]!.file.name, 'txt'), blob: textBlob(text, 'txt'), note: `${doc.numPages} page${doc.numPages === 1 ? '' : 's'} of words` });
      } finally {
        await done();
      }
      break;
    }
    case 'txt-md':
    case 'md-html':
    case 'html-md':
    case 'html-txt':
    case 'docx-txt':
    case 'docx-html':
    case 'to-docx':
    case 'to-pdf':
    case 'open-doc': {
      await each(async (p) => {
        const doc = await asDoc(p, progress);
        const ext = id === 'txt-md' || id === 'html-md' ? 'md' : id === 'md-html' || id === 'docx-html' ? 'html' : id === 'html-txt' || id === 'docx-txt' ? 'txt' : id === 'to-docx' ? 'docx' : id === 'to-pdf' ? 'pdf' : 'doc';
        if (ext === 'doc') return { name: doc.title, blob: new Blob([toText(doc)], { type: 'text/plain' }), doc };
        if (ext === 'md') return { name: renamed(p.file.name, 'md'), blob: textBlob(toMarkdown(doc), 'md') };
        if (ext === 'html') return { name: renamed(p.file.name, 'html'), blob: textBlob(toHtml(doc, true), 'html') };
        if (ext === 'txt') return { name: renamed(p.file.name, 'txt'), blob: textBlob(toText(doc), 'txt') };
        if (ext === 'docx') return { name: renamed(p.file.name, 'docx'), blob: new Blob([docxFrom(doc) as BlobPart], { type: MIME.docx }) };
        const pdf = await pdfOfDocAnyScript(doc, progress);
        return { name: renamed(p.file.name, 'pdf'), blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }) };
      });
      break;
    }
    case 'csv-json':
    case 'csv-xlsx':
    case 'json-csv':
    case 'json-xlsx':
    case 'xlsx-csv':
    case 'xlsx-json': {
      await each(async (p) => {
        const bytes = await bytesOf(p.file);
        let sheets: { name: string; rows: string[][] }[];
        if (p.kind === 'xlsx' || p.kind === 'ods') sheets = xlsxToRows(await sheetJs(), bytes);
        else if (p.kind === 'json') sheets = [{ name: stem(p.file.name), rows: jsonToRows(JSON.parse(textOf(bytes))) }];
        else sheets = [{ name: stem(p.file.name), rows: parseCsv(textOf(bytes), p.kind === 'tsv' ? '\t' : undefined) }];
        const to = id.split('-')[1]!;
        if (to === 'xlsx') return { name: renamed(p.file.name, 'xlsx'), blob: new Blob([rowsToXlsx(await sheetJs(), sheets[0]!.rows, stem(p.file.name)) as BlobPart], { type: MIME.xlsx }), note: `${sheets[0]!.rows.length - 1} rows under a header row` };
        return sheets.map((s) => ({
          name: renamed(sheets.length > 1 ? `${stem(p.file.name)} ${s.name}.x` : p.file.name, to),
          blob: to === 'json' ? textBlob(JSON.stringify(rowsToObjects(s.rows), null, 2) + '\n', 'json') : textBlob(toCsv(s.rows), 'csv'),
          note: `${Math.max(0, s.rows.length - 1)} rows${sheets.length > 1 ? `, the sheet “${s.name}”` : ''}`,
        }));
      });
      break;
    }
    case 'json-pretty':
    case 'json-small':
      await each(async (p) => ({ name: renamed(p.file.name, 'json', id === 'json-pretty' ? 'tidy' : 'small'), blob: textBlob(reformatJson(textOf(await bytesOf(p.file)), id === 'json-pretty'), 'json') }));
      break;
    case 'audio-wav':
    case 'audio-mp3':
    case 'audio-trim':
    case 'audio-phone': {
      await each(async (p) => {
        progress(`decoding ${p.file.name} with this phone’s player…`);
        let s = await decodeSound(p.file, p.kind);
        if (id === 'audio-trim') {
          const r = rangeOf(String(opts.range ?? ''));
          if (!r) throw new Error('say the stretch to keep, like "0:05 to 0:20"');
          s = trimSound(s, r.from, r.to);
        }
        if (id === 'audio-mp3') {
          progress('making the MP3 on this phone…');
          const mp3 = encodeMp3(await lame(), s, Number(opts.kbps) || 128);
          return { name: renamed(p.file.name, 'mp3'), blob: new Blob([mp3 as BlobPart], { type: 'audio/mpeg' }), note: `${lengthWords(s)} at ${Number(opts.kbps) || 128} kbps` };
        }
        if (id === 'audio-phone') {
          const r = await soundToPhone(s, progress);
          return { name: renamed(p.file.name, r.ext), blob: r.blob, note: `${lengthWords(s)}, as this phone writes it (${r.blob.type})` };
        }
        return { name: renamed(p.file.name, 'wav', id === 'audio-trim' ? 'cut' : ''), blob: new Blob([encodeWav(s) as BlobPart], { type: 'audio/wav' }), note: `${lengthWords(s)}, ${s.channels.length === 1 ? 'mono' : 'stereo'}, ${s.rate.toLocaleString('en-GB')} Hz` };
      });
      break;
    }
    case 'code-read': {
      const { readCodes } = await import('../scan/barcode');
      await each(async (p) => {
        const pic = await decodePicture(p.file, p.kind);
        try {
          const k = Math.min(1, 1600 / Math.max(pic.w, pic.h));
          const found = await readCodes(drawn(pic, pic.w * k, pic.h * k, undefined, true), true);
          if (!found.length) throw new Error(`no QR code or barcode found in ${p.file.name}: try a closer, sharper picture`);
          const text = found.map((f) => f.text).join('\n');
          return { name: renamed(p.file.name, 'txt', 'code'), blob: textBlob(text + '\n', 'txt'), note: found.map((f) => `${f.format}: ${f.text}`).join(' · ') };
        } finally {
          pic.close();
        }
      });
      break;
    }
    default:
      throw new Error('that conversion is done with its own box on the sheet');
  }
  return out;
}

/** Several outputs as one zip (SAVE ALL). */
export async function zipOf(outs: Output[]): Promise<Blob> {
  const files = await Promise.all(outs.map(async (o) => ({ name: o.name, data: await bytesOf(o.blob) })));
  return new Blob([zipStore(files) as BlobPart], { type: 'application/zip' });
}

/** A picked file, with its kind from its first bytes. */
export async function pick(file: File): Promise<Picked> {
  return { file, kind: sniff(new Uint8Array(await file.slice(0, 96).arrayBuffer()), file.name, file.type) };
}
export const isPictureKind = (k: Kind): boolean => IMAGE_KINDS.includes(k);

/** SAVE: the phone's download (Files on an iPhone). */
export function saveBlob(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

/** SHARE: the phone's share sheet (an iPhone's: Messages, Mail, Save to Files); false where there is none. */
export async function shareBlob(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  const nav = navigator as Navigator & { canShare?(d: { files: File[] }): boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try {
    await nav.share({ files: [file], title: name });
    return true;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return true;
    return false;
  }
}

export { fromHtml, newDoc, titled };
