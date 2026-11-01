/**
 * THE BILL OF MATERIALS as numbers and as files (BRIEF-REST-D 1c): the total from the price table, the lines he has priced
 * live (a shop page watched by the money pack: its price and the day it was read), the CSV and the plain text he exports.
 * Every export carries the estimate line and the table's date. Pure.
 */
import { CONCEPT_LINE } from './concept';
import { glossFor, type Design, type Line } from './kits';
import { cutWords, ESTIMATE, PRICE_LINE, pounds } from './prices';
import { PC_LINE } from './pc';

/** A line priced from a shop page he gave: the price read, when, and where. */
export interface Live {
  url: string;
  gbp: number;
  at: number;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The line's price as it stands: the live one for each when there is one (times how many), else the table's. */
export const lineTotal = (l: Line, live?: Live) => (live ? Math.round(live.gbp * (l.per === 'm' ? l.n : l.qty) * 100) / 100 : l.total);

export interface Totals {
  total: number;
  table: number;
  live: number;
  liveLines: number;
  byGroup: { group: string; name: string; total: number }[];
}

/** The bill's total, by group, with the live lines counted in at their real prices. */
export function totals(d: Design, live: Record<string, Live> = {}): Totals {
  const byGroup = d.groups.map((g) => ({ group: g.id, name: g.name, total: 0 }));
  let total = 0;
  let liveSum = 0;
  let liveLines = 0;
  for (const l of d.lines) {
    const v = lineTotal(l, live[l.id]);
    total += v;
    if (live[l.id]) {
      liveSum += v;
      liveLines++;
    }
    const g = byGroup.find((x) => x.group === l.group);
    if (g) g.total += v;
  }
  const r = (x: number) => Math.round(x * 100) / 100;
  return { total: r(total), table: r(total - liveSum), live: r(liveSum), liveLines, byGroup: byGroup.filter((g) => g.total > 0).map((g) => ({ ...g, total: r(g.total) })) };
}

const q = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The bill as CSV: a row a line (its cut list too), then the total and the honest lines. */
export function toCsv(d: Design, live: Record<string, Live> = {}): string {
  const head = ['Group', 'Part', 'Size', 'Material', 'Buy', 'Unit', 'Rate (£)', 'Per', 'Line (£)', 'Cut list', 'Live price (£)', 'Live price read', 'Shop page', 'Note'];
  const name = (g: string) => d.groups.find((x) => x.id === g)?.name ?? g;
  const rows = d.lines.map((l) => {
    const lv = live[l.id];
    return [name(l.group), l.name, l.size, l.material, l.n, l.unit, l.rate.toFixed(2), l.per, lineTotal(l, lv).toFixed(2), l.cut ? cutWords(l.cut) : '', lv ? lv.gbp.toFixed(2) : '', lv ? day(lv.at) : '', lv?.url ?? '', l.note ?? ''];
  });
  const t = totals(d, live);
  const tail = [
    [],
    ['Total', '', '', '', '', '', '', '', t.total.toFixed(2)],
    [d.kind === 'pc' ? PC_LINE : `${PRICE_LINE}${t.liveLines ? `; ${t.liveLines} ${t.liveLines === 1 ? 'line' : 'lines'} priced live from shop pages, dated` : ''}.`],
    [ESTIMATE],
  ];
  return [[d.title], [d.summary], [], head, ...rows, ...tail].map((r) => r.map(q).join(',')).join('\n') + '\n';
}

/** The whole design as plain text: the summary, the bill, the build, the law. */
export function toText(d: Design, live: Record<string, Live> = {}): string {
  const out: string[] = [d.title, d.summary, ESTIMATE, ''];
  if (d.concept) {
    out.push(CONCEPT_LINE, '', 'THE REAL PARTS');
    for (const p of d.parts ?? []) out.push(`- ${p.role}: ${p.name}. ${p.why} (typically ${p.typical}).`);
  } else {
    out.push('THE BILL OF MATERIALS');
    for (const g of d.groups) {
      const ls = d.lines.filter((l) => l.group === g.id);
      if (!ls.length) continue;
      out.push(`${g.name}:`);
      for (const l of ls) {
        const lv = live[l.id];
        out.push(`- ${l.name}${l.size ? `, ${l.size}` : ''}: ${l.n} ${l.unit}, ${pounds(lineTotal(l, lv))}${lv ? ` (live: ${pounds(lv.gbp)} read ${day(lv.at)})` : ''}${l.cut ? ` [cut: ${cutWords(l.cut)}]` : ''}${l.note ? `. ${l.note}` : ''}`);
      }
    }
    const t = totals(d, live);
    out.push('', `Total: ${pounds(t.total)} (${d.kind === 'pc' ? PC_LINE : `${PRICE_LINE}${t.liveLines ? `; ${t.liveLines} priced live` : ''}`})`);
    if (d.compat?.length) out.push('', 'DOES IT ALL FIT?', ...d.compat.map((c) => `${c.ok ? 'OK' : 'NO'}: ${c.text}`));
    if (d.load) out.push('', `LOAD: ${d.load}`);
    if (d.heat) out.push('', `HEAT: ${d.heat}`);
  }
  if (d.steps.length) out.push('', 'THE BUILD', ...d.steps.map((s, i) => `${i + 1}. ${s}`));
  if (d.tools.length) out.push('', `TOOLS: ${d.tools.join('; ')}`);
  if (d.hours) out.push(`TIME: about ${d.hours} hours for one person`);
  if (d.safety.length) out.push('', 'SAFETY', ...d.safety.map((s) => `- ${s}`));
  if (d.law.length) out.push('', 'THE RULES (rules of thumb; check with your council)', ...d.law.map((l) => `- ${l.title}: ${l.words} (${l.source})`));
  if (d.notes.length) out.push('', 'NOTES', ...d.notes.map((n) => `- ${n}`));
  const gloss = glossFor(d);
  if (gloss.length) out.push('', 'WHAT THE WORDS MEAN', ...gloss.map((g) => `- ${g.term}: ${g.gloss}`));
  out.push('', ESTIMATE);
  return out.join('\n');
}

/** "£12.99" read from the money pack's watch reply ("Watching X: £12.99 now …"), or null. */
export function priceFromWatch(text: string): number | null {
  const m = /£\s?(\d[\d,]*(?:\.\d{1,2})?)/.exec(text);
  return m ? Number(m[1]!.replace(/,/g, '')) : null;
}
