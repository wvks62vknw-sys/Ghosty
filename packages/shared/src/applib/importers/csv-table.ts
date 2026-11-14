/**
 * Any CSV he exported (a fitness app, a spreadsheet, a reading tracker): each row becomes a record with its first text
 * column as the title, every other column on the line below, its first date column and its first number column.
 */
import { parseCsv } from './csv';
import { guessOrder, num, parseDay, type Rec } from './input';

export function tableRecords(text: string): Rec[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0]!.map((h, i) => h.trim() || `Column ${i + 1}`);
  const body = rows.slice(1);
  const sample = body.slice(0, 50);
  const isDate = (i: number) => sample.filter((r) => r[i]!).every((r) => !!parseDay(r[i]!) && !/^-?\d+(\.\d+)?$/.test(r[i]!.trim())) && sample.some((r) => r[i]!);
  const isNum = (i: number) => sample.filter((r) => r[i]?.trim()).every((r) => Number.isFinite(num(r[i]))) && sample.some((r) => r[i]?.trim());
  const dateCol = head.findIndex((_, i) => isDate(i));
  const numCol = head.findIndex((_, i) => i !== dateCol && isNum(i));
  let titleCol = head.findIndex((_, i) => i !== dateCol && i !== numCol);
  if (titleCol < 0) titleCol = 0;
  const order = dateCol >= 0 ? guessOrder(body.map((r) => r[dateCol] ?? '')) : 'dmy';
  return body.map((r, n) => {
    const rec: Rec = { _key: r.join('\u0001') || String(n), title: (r[titleCol] ?? '').trim() || `Row ${n + 1}` };
    const rest = head.map((h, i) => (i === titleCol || !r[i]?.trim() ? '' : `${h}: ${r[i].trim()}`)).filter(Boolean).join(' · ');
    if (rest) rec.details = rest;
    if (dateCol >= 0) { const d = parseDay(r[dateCol] ?? '', order); if (d) rec.date = d; }
    if (numCol >= 0) { const v = num(r[numCol]); if (Number.isFinite(v)) rec.value = v; }
    return rec;
  });
}
