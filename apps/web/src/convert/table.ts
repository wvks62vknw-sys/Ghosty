/**
 * TABLES (BRIEF-REST-E part 1): CSV, JSON and Excel each way with the header row kept, JSON made pretty or small, and a
 * table pasted from a web page or a spreadsheet made into a CSV. Pure: Excel goes through SheetJS (vendor/sheetjs,
 * Apache-2.0), handed in, so the tests give it the same library the phone loads.
 */

export type Rows = string[][];

/** The separator a CSV most likely uses: the one that splits its first lines into the same number of cells. */
export function guessDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  let best = ',';
  let score = -1;
  for (const d of [',', ';', '\t', '|']) {
    const counts = lines.map((l) => splitLine(l, d).length);
    const same = counts.every((c) => c === counts[0]);
    const s = (counts[0] ?? 0) > 1 ? (same ? 100 : 0) + (counts[0] ?? 0) : -1;
    if (s > score) {
      score = s;
      best = d;
    }
  }
  return best;
}
const splitLine = (l: string, d: string) => parseCsv(l, d)[0] ?? [];

/** CSV as rows (RFC 4180: quoted cells may hold the separator, quotes doubled and line breaks). */
export function parseCsv(text: string, delim = guessDelimiter(text)): Rows {
  const rows: Rows = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const s = text.replace(/^﻿/, '');
  while (i < s.length) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else cell += c;
      i++;
      continue;
    }
    if (c === '"' && cell === '') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (c === '\r' && s[i + 1] === '\n') i++;
    } else cell += c;
    i++;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x !== ''));
}

/** Rows as CSV: a cell with the separator, a quote or a line break is quoted. */
export function toCsv(rows: Rows, delim = ','): string {
  const q = (v: string) => (/["\r\n]/.test(v) || v.includes(delim) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map((v) => q(String(v ?? ''))).join(delim)).join('\r\n') + '\r\n';
}

/** Rows (the first is the header) as a list of objects: each header a key, in its order; a blank header gets its column's letter. */
export function rowsToObjects(rows: Rows): Record<string, string | number>[] {
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h, i) => h.trim() || `column ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`);
  return body.map((r) => {
    const o: Record<string, string | number> = {};
    keys.forEach((k, i) => {
      const v = r[i] ?? '';
      // a plain number stays a number (no leading zeros: a phone number or a code stays words)
      o[k] = /^-?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(v) ? Number(v) : v;
    });
    return o;
  });
}

/** JSON (a list of objects, a list of lists, or one object) as rows with a header: the keys in the order first seen. */
export function jsonToRows(json: unknown): Rows {
  const list = Array.isArray(json) ? json : json && typeof json === 'object' ? (Object.values(json).find(Array.isArray) as unknown[] | undefined) ?? [json] : [json];
  if (list.every(Array.isArray)) return (list as unknown[][]).map((r) => r.map(cellText));
  const keys: string[] = [];
  for (const o of list) if (o && typeof o === 'object') for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);
  if (!keys.length) return [['value'], ...list.map((v) => [cellText(v)])];
  return [keys, ...list.map((o) => keys.map((k) => cellText(o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined)))];
}
const cellText = (v: unknown): string => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** JSON pretty (two spaces) or as small as it goes; a mistake is said with its line and column. */
export function reformatJson(text: string, pretty: boolean): string {
  try {
    return JSON.stringify(JSON.parse(text), null, pretty ? 2 : undefined) + (pretty ? '\n' : '');
  } catch (e) {
    const at = /position (\d+)/.exec(String((e as Error).message));
    if (!at) throw new Error(`that isn’t valid JSON (${(e as Error).message})`);
    const before = text.slice(0, Number(at[1]));
    const line = before.split('\n').length;
    throw new Error(`that isn’t valid JSON: something is wrong on line ${line}, column ${before.length - before.lastIndexOf('\n')}`);
  }
}

/**
 * A table pasted from a web page or a spreadsheet, as rows: the page's own HTML table when the paste carried it, else the
 * tabs a spreadsheet copies, else a Markdown table, else columns lined up with two or more spaces.
 */
export function pastedTable(text: string, html = ''): Rows {
  if (/<table[\s>]/i.test(html)) {
    const t = html.slice(html.search(/<table[\s>]/i));
    const rows: Rows = [];
    for (const tr of t.split(/<\/tr>/i)) {
      const cells = [...tr.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)(?=<t[hd]\b|<\/t[hd]>|$)/gi)].map((m) => decodeEntities(m[1]!.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
      if (cells.some(Boolean)) rows.push(cells);
      if (/<\/table>/i.test(tr)) break;
    }
    if (rows.length) return rows;
  }
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.some((l) => l.includes('\t'))) return lines.map((l) => l.split('\t').map((c) => c.trim()));
  if (lines.length > 1 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l))) {
    return lines.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  }
  if (lines.some((l) => / {2,}/.test(l.trim()))) return lines.map((l) => l.trim().split(/ {2,}/));
  return parseCsv(text);
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/** What the converter needs of SheetJS (its `XLSX` object). */
export interface SheetJs {
  utils: {
    aoa_to_sheet(rows: unknown[][]): unknown;
    book_new(): unknown;
    book_append_sheet(book: unknown, sheet: unknown, name: string): void;
    sheet_to_json<T>(sheet: unknown, opts: { header: 1; raw: boolean; defval: string; blankrows: boolean }): T[];
  };
  write(book: unknown, opts: { type: 'array'; bookType: 'xlsx'; compression?: boolean }): ArrayBuffer | Uint8Array;
  read(data: Uint8Array, opts: { type: 'array'; dense?: boolean }): { SheetNames: string[]; Sheets: Record<string, unknown> };
}

/** Rows as an Excel workbook (one sheet), the header row first; numbers stay numbers. */
export function rowsToXlsx(X: SheetJs, rows: Rows, sheet = 'Sheet1'): Uint8Array {
  const cells = rows.map((r, i) => r.map((v) => (i > 0 && /^-?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(v) ? Number(v) : v)));
  const book = X.utils.book_new();
  X.utils.book_append_sheet(book, X.utils.aoa_to_sheet(cells), sheet.slice(0, 31) || 'Sheet1');
  const out = X.write(book, { type: 'array', bookType: 'xlsx', compression: true });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

/** A workbook's sheets as rows (formatted as Excel shows them), by name. */
export function xlsxToRows(X: SheetJs, bytes: Uint8Array): { name: string; rows: Rows }[] {
  const book = X.read(bytes, { type: 'array' });
  return book.SheetNames.map((name) => ({ name, rows: Array.from(X.utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false }), (r) => Array.from(r, String)) }));
}
