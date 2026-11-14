/** Records from an import laid over what he had, and the top list over any span: small enough for the page itself. */
import type { Rec } from './input';

/**
 * Old and new records together. 'merge' keeps what he had and lays the new file over it (the same _key is replaced,
 * never doubled); 'replace' keeps only the new file. Records he added by hand (no _key) are always kept.
 */
export function mergeRecords(old: Rec[], incoming: Rec[], mode: 'merge' | 'replace' = 'merge'): Rec[] {
  const m = new Map<string, Rec>();
  const loose: Rec[] = [];
  for (const r of old) {
    if (typeof r._key !== 'string') loose.push(r);
    else if (mode === 'merge') m.set(r._key, r);
  }
  for (const r of incoming) m.set(String(r._key), r);
  return [...m.values(), ...loose];
}

/** The top values of a field over records dated from..to (inclusive, YYYY-MM-DD; '' for no bound), weighted by `by`. */
export function topList(recs: Rec[], field: string, opts: { by?: string; from?: string; to?: string; dateField?: string; n?: number } = {}): { name: string; value: number }[] {
  const df = opts.dateField ?? 'date';
  const m = new Map<string, number>();
  for (const r of recs) {
    const d = String(r[df] ?? '');
    if (opts.from && (!d || d < opts.from)) continue;
    if (opts.to && (!d || d > opts.to)) continue;
    const k = String(r[field] ?? '').trim();
    if (!k) continue;
    const w = opts.by ? Number(r[opts.by]) || 0 : 1;
    m.set(k, (m.get(k) ?? 0) + w);
  }
  return [...m].map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, opts.n ?? 5);
}
