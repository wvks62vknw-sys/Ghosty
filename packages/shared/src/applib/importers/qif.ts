/** A money program's QIF export: transactions with their categories, spending and money in apart. */
import { guessOrder, num, parseDay, round, type Rec } from './input';

export function qifRecords(text: string): Rec[] {
  const items: Record<string, string>[] = [];
  let cur: Record<string, string> = {};
  let skip = false;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line[0] === '!') { skip = !/^!Type:(Bank|Cash|CCard|Oth A|Oth L)/i.test(line); continue; }
    if (line[0] === '^') { if (!skip && cur.D) items.push(cur); cur = {}; continue; }
    const code = line[0]!;
    if (!(code in cur)) cur[code] = line.slice(1).trim();
  }
  const order = guessOrder(items.map((i) => (i.D ?? '').replace("'", '/')));
  const out: Rec[] = [];
  const seen = new Map<string, number>();
  for (const it of items) {
    const date = parseDay((it.D ?? '').replace("'", '/').replace(/\s/g, ''), order);
    const amt = num(it.T ?? it.U);
    if (!date || !Number.isFinite(amt)) continue;
    const payee = it.P || it.M || 'Transaction';
    const base = `${date}|${amt}|${payee}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const r: Rec = { _key: n > 1 ? `${base}|${n}` : base, date, payee };
    if (amt < 0) r.spent = round(-amt, 2); else r.received = round(amt, 2);
    if (it.L) r.category = it.L.replace(/^\[|\]$/g, '').split(':')[0] ?? '';
    if (it.M && it.M !== payee) r.memo = it.M;
    out.push(r);
  }
  return out;
}
