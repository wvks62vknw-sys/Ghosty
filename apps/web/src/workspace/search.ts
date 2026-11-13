/**
 * SEARCH (BRIEF-EDITOR-WORKSPACE): every page's title and words, the phone's own index, results grouped by page with the matching line;
 * nothing is sent. Pure.
 */
import { live, trail, wText, type Page, type Workspace } from './model';

export interface Hit {
  page: Page;
  /** Where it was found: the title, or a block (its id). */
  where: 'title' | 'block' | 'value';
  block?: string;
  /** The matching line, cut around the match. */
  before: string;
  match: string;
  after: string;
  /** The pages it sits under, for "Project › Notes". */
  path: string;
}
const around = (line: string, at: number, len: number): { before: string; match: string; after: string } => {
  const from = Math.max(0, at - 36);
  const to = Math.min(line.length, at + len + 48);
  return { before: (from ? '…' : '') + line.slice(from, at), match: line.slice(at, at + len), after: line.slice(at + len, to) + (to < line.length ? '…' : '') };
};
/** Pages with every word of the question in their title or blocks (a page once, with its first matching line; more lines after it). */
export function searchWs(ws: Workspace, q: string, docTitle?: (id: string) => string, limit = 50): { page: Page; hits: Hit[] }[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: { page: Page; hits: Hit[] }[] = [];
  for (const page of live(ws)) {
    const path = trail(ws, page.id).slice(0, -1).map((p) => p.title.trim() || 'Untitled').join(' › ');
    const lines: { text: string; where: Hit['where']; block?: string }[] = [{ text: page.title, where: 'title' }];
    for (const b of page.blocks) for (const l of wText(b, ws, docTitle).split('\n')) if (l.trim()) lines.push({ text: l, where: 'block', block: b.id });
    for (const v of Object.values(page.vals ?? {})) if (typeof v === 'string' && v) lines.push({ text: v, where: 'value' });
    const whole = lines.map((l) => l.text).join('\n').toLowerCase();
    if (!words.every((w) => whole.includes(w))) continue;
    const hits: Hit[] = [];
    for (const l of lines) {
      const low = l.text.toLowerCase();
      const w = words.find((x) => low.includes(x));
      if (!w) continue;
      hits.push({ page, where: l.where, ...(l.block ? { block: l.block } : {}), ...around(l.text, low.indexOf(w), w.length), path });
      if (hits.length >= 3) break;
    }
    if (hits.length) out.push({ page, hits });
    if (out.length >= limit) break;
  }
  // titles that match first, then the newest
  return out.sort((a, b) => Number(b.hits[0]!.where === 'title') - Number(a.hits[0]!.where === 'title') || b.page.at - a.page.at);
}
