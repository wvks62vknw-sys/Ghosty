/**
 * Cleaning what the reader (Tesseract) returns, pure: hyphenated line breaks joined, junk lines
 * dropped by confidence, a title from the first line, word boxes turned into regions to draw.
 */
import type { Box } from './boxes';

export interface OcrLine {
  text: string;
  confidence: number;
}
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
export interface OcrResult {
  text: string;
  /** 0..100, the reader's own confidence in the whole page. */
  confidence: number;
  lines?: OcrLine[];
  words?: OcrWord[];
}
export interface Region {
  text: string;
  confidence: number;
  box: Box;
}

/** A line the reader made up out of noise: no letters or digits to speak of, or too little confidence. */
export function isJunkLine(text: string, confidence?: number, minConf = 40): boolean {
  const t = text.trim();
  if (!t) return true;
  if (confidence != null && Number.isFinite(confidence) && confidence < minConf) return true;
  const letters = (t.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (letters === 0) return true;
  // mostly symbols ("~ -- | . ,") with a letter or two in them
  const compact = t.replace(/\s/g, '').length;
  return letters / compact < 0.4 && t.length > 2;
}

/** "exam-\nple" → "example"; a hyphen at a line end joins the word on the next line. */
export function joinHyphens(text: string): string {
  return text.replace(/(\p{L}{2,})-\n(?=\p{Ll})/gu, '$1');
}

/** The reader's text, cleaned for the owner: junk lines out, hyphenation joined, spacing tidy. */
export function cleanOcr(r: OcrResult | string, minConf = 40): string {
  // blank lines are paragraph breaks and stay (collapsed below); junk lines go
  const keep = (text: string, confidence?: number) => !text.trim() || !isJunkLine(text, confidence, minConf);
  let lines: string[];
  if (typeof r === 'string') lines = r.split('\n').filter((l) => keep(l));
  else if (r.lines?.length) lines = r.lines.filter((l) => keep(l.text, l.confidence)).map((l) => l.text.replace(/\n$/, ''));
  else lines = (r.text ?? '').split('\n').filter((l) => keep(l));
  const joined = joinHyphens(lines.map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n'));
  return joined
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A title from the first line that says something (at most 80 characters), or the fallback. */
export function titleFrom(text: string, fallback = 'Scanned text'): string {
  const line = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .find((l) => (l.match(/\p{L}/gu) ?? []).length >= 3);
  if (!line) return fallback;
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

/** Word boxes worth drawing: real words with enough confidence, as regions in picture pixels. */
export function wordRegions(words: OcrWord[] | undefined, minConf = 40): Region[] {
  const out: Region[] = [];
  for (const w of words ?? []) {
    const text = (w.text ?? '').trim();
    if (!text || isJunkLine(text, w.confidence, minConf)) continue;
    const b = w.bbox;
    if (!b || !(b.x1 > b.x0) || !(b.y1 > b.y0)) continue;
    out.push({ text, confidence: w.confidence, box: { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 } });
  }
  return out;
}

/** "312 words · 86% sure", or "no text found". */
export function ocrSummary(text: string, confidence: number): string {
  const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  if (!words) return 'no text found';
  const c = Math.round(Math.max(0, Math.min(100, confidence)));
  return `${words} word${words === 1 ? '' : 's'} · ${c}% sure`;
}
