/** CSV as exports write it (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes), read into rows. */
export function parseCsv(text: string, sep?: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const d = sep ?? guessSep(s);
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"' && f === '') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

function guessSep(s: string): string {
  const line = s.slice(0, s.indexOf('\n') >= 0 ? s.indexOf('\n') : s.length);
  const count = (ch: string) => line.split(ch).length - 1;
  const best = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  return best && count(best) ? best : ',';
}

/** Rows as objects keyed by the header row (headers trimmed). */
export function csvObjects(text: string, sep?: string): Record<string, string>[] {
  const rows = parseCsv(text, sep);
  if (!rows.length) return [];
  const head = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** The first header present, compared without case or spaces. */
export function col(row: Record<string, string>, ...names: string[]): string {
  const keys = Object.keys(row);
  for (const n of names) {
    const want = n.toLowerCase().replace(/[\s_]/g, '');
    const k = keys.find((x) => x.toLowerCase().replace(/[\s_]/g, '') === want);
    if (k !== undefined && row[k] !== '') return row[k]!;
  }
  return '';
}
