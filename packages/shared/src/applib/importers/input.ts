/**
 * The one way a parser reads his file: plain, zipped or gzipped, as text chunks or as whole bytes, with progress in
 * bytes read and a cancel signal. Works on a File in a Web Worker on the phone, and on a Blob in the brain tests.
 */
import { isZip, zipEntries, zipStream, type BlobLike } from './zip';

export type Rec = Record<string, string | number | boolean>;
export interface ReadCtx {
  /** Called with the fraction read so far (0 to 1). */
  progress?: (f: number) => void;
  signal?: AbortSignal;
}
export interface FileIn extends BlobLike {
  name: string;
}
/** One part of his export: the file itself, or one entry of the zip it came in. */
export interface Part {
  name: string;
  size: number;
  stream(): Promise<ReadableStream<Uint8Array>>;
}

export class Cancelled extends Error {
  constructor() { super('cancelled'); }
}

/** The parts of a file: the entries of a zip that `accept` takes, or the file itself (gunzipped if it is .gz). */
export async function parts(file: FileIn, accept: (name: string) => boolean): Promise<Part[]> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (isZip(head)) {
    const all = await zipEntries(file);
    return all
      .filter((e) => !/(^|\/)(__MACOSX|\.)/.test(e.name) && accept(e.name.toLowerCase()))
      .map((e) => ({ name: e.name, size: e.compSize, stream: () => zipStream(file, e) }));
  }
  if (head[0] === 0x1f && head[1] === 0x8b) {
    return [{ name: file.name.replace(/\.gz$/i, ''), size: file.size, stream: async () => file.stream().pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>) }];
  }
  return [{ name: file.name, size: file.size, stream: async () => file.stream() }];
}

/**
 * Reads the parts one after another, chunk by chunk, calling `each` with every chunk of bytes. Progress is the share
 * of the parts' stored sizes read (compressed bytes are not counted exactly, so a zipped part moves in steps).
 */
export async function readParts(ps: Part[], ctx: ReadCtx, each: (chunk: Uint8Array, part: Part) => void, partEnd?: (part: Part) => void): Promise<void> {
  const total = ps.reduce((n, p) => n + p.size, 0) || 1;
  let before = 0;
  for (const p of ps) {
    const reader = (await p.stream()).getReader();
    let got = 0;
    for (;;) {
      if (ctx.signal?.aborted) { void reader.cancel(); throw new Cancelled(); }
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      each(value, p);
      ctx.progress?.(Math.min(1, (before + Math.min(got, p.size)) / total));
    }
    before += p.size;
    partEnd?.(p);
  }
  ctx.progress?.(1);
}

/** Reads the parts as text, chunk by chunk (UTF-8, split characters carried across chunks). */
export async function readText(ps: Part[], ctx: ReadCtx, each: (text: string, part: Part) => void, partEnd?: (part: Part) => void): Promise<void> {
  let dec = new TextDecoder();
  let first = true;
  await readParts(ps, ctx, (chunk, p) => {
    let t = dec.decode(chunk, { stream: true });
    if (first) { if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); first = false; }
    if (t) each(t, p);
  }, (p) => {
    const t = dec.decode();
    if (t) each(t, p);
    dec = new TextDecoder();
    first = true;
    partEnd?.(p);
  });
}

/** Each part's whole text (for exports that are small: a reading list, a highlights file, a history file). */
export async function wholeTexts(ps: Part[], ctx: ReadCtx): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = [];
  let cur: string[] = [];
  await readText(ps, ctx, (t) => cur.push(t), (p) => { out.push({ name: p.name, text: cur.join('') }); cur = []; });
  return out;
}

/** Each part's whole bytes (for binary files that are small, such as one activity file). */
export async function wholeBytes(ps: Part[], ctx: ReadCtx): Promise<{ name: string; bytes: Uint8Array }[]> {
  const out: { name: string; bytes: Uint8Array }[] = [];
  let cur: Uint8Array[] = [];
  await readParts(ps, ctx, (c) => cur.push(c), (p) => {
    const n = cur.reduce((a, c) => a + c.length, 0);
    const b = new Uint8Array(n);
    let o = 0;
    for (const c of cur) { b.set(c, o); o += c.length; }
    out.push({ name: p.name, bytes: b });
    cur = [];
  });
  return out;
}

// ── dates and numbers, shared by the parsers ───────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
/** A Date as his local day (YYYY-MM-DD). */
export const localDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** A Date as his local time of day (HH:MM). */
export const localTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** A day moved on by n days (YYYY-MM-DD in, YYYY-MM-DD out). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** A number to this many decimal places. */
export const round = (x: number, dp = 0): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
/** A number from export text ("1,234.5", "£12.50", "-3"), or NaN. */
export function num(s: string | undefined): number {
  if (s == null) return NaN;
  const t = String(s).replace(/[£$€\s,]/g, '');
  return t === '' ? NaN : Number(t);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/**
 * A day from the many ways exports write dates: 2026-11-14, 2026/11/14, 14/11/2026, 11/14/26 (`order` says which comes
 * first when both could be the month), "14 November 2026", "Nov 14, 2026". Returns YYYY-MM-DD or ''.
 */
export function parseDay(s: string, order: 'dmy' | 'mdy' = 'dmy'): string {
  const t = s.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (m) return `${m[1]!}-${pad(+m[2]!)}-${pad(+m[3]!)}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(t);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    let day = order === 'mdy' ? +m[2]! : +m[1]!;
    let mon = order === 'mdy' ? +m[1]! : +m[2]!;
    if (mon > 12 && day <= 12) [day, mon] = [mon, day];
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return '';
    return `${y}-${pad(mon)}-${pad(day)}`;
  }
  m = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/.exec(t);
  if (m && MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) >= 0) return `${m[3]!}-${pad(MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1)}-${pad(+m[1]!)}`;
  m = /([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(t);
  if (m && MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) >= 0) return `${m[3]!}-${pad(MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1)}-${pad(+m[2]!)}`;
  return '';
}
/** The first HH:MM (24-hour, with AM/PM read) in the text, or ''. */
export function parseClock(s: string): string {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp]\.?[Mm]\.?)?/.exec(s);
  if (!m) return '';
  let h = +m[1]!;
  const ap = m[3]?.[0]?.toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return h < 24 ? `${pad(h)}:${m[2]}` : '';
}

/** Whether a set of n/n/n dates is written day first or month first (a part over 12 settles it; British if none does). */
export function guessOrder(dates: string[]): 'dmy' | 'mdy' {
  for (const s of dates) {
    const m = /^(\d{1,2})[-/.'](\d{1,2})[-/.']/.exec(s.trim());
    if (!m) continue;
    if (+m[1]! > 12) return 'dmy';
    if (+m[2]! > 12) return 'mdy';
  }
  return 'dmy';
}

/** Long lines folded the iCalendar and vCard way (a line starting with a space or tab continues the one before). */
export const unfold = (text: string): string[] => text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
/** A property line split into its name, parameters and value ("DTSTART;TZID=Europe/London:20261114T090000"). */
export function propLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const c = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (c < 0) return null;
  const [head = '', ...ps] = line.slice(0, c).split(';');
  const params: Record<string, string> = {};
  for (const p of ps) { const [k = '', v = ''] = p.split('='); params[k.toUpperCase()] = v.replace(/^"|"$/g, ''); }
  return { name: head.toUpperCase().replace(/^ITEM\d+\./, ''), params, value: line.slice(c + 1) };
}
/** iCalendar and vCard text escapes undone. */
export const unescapeText = (s: string): string => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
