/**
 * SPREADSHEETS AND THE BRAIN (BRIEF-EDITOR-SPREADSHEETS): explain a cell, write a formula for what he wants, tidy a column: each an ordinary chat turn
 * with the chosen cells as the turn's data (docs/ask.ts's askBrain; no tool, nothing new in the prompt). The reply is read here: a sentence to show, a
 * formula to offer with USE IT, tidied words to accept; nothing changes until he says.
 */
import { addr, cellInput, usedCols, usedRows, type Book, type Cell } from './model';
import type { Engine } from './formula';
import { colName, parseRange, type Rect } from './tokens';
import { FUNCTION_NAMES } from './formula';

const clip = (t: string, n = 60): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** The chosen cells as plain lines the brain can read: the sheet, the header row, and each cell's address, formula and what it shows. */
export function contextOf(b: Book, eng: Engine, sheet: string, g: Rect, activeAddr: string): string {
  const s = b.sheets.find((x) => x.name === sheet);
  if (!s) return '';
  const lines = [`Sheet: ${sheet} (${usedRows(s)} rows by ${usedCols(s)} columns). Selected: ${activeAddr}${g.r1 !== g.r2 || g.c1 !== g.c2 ? ` (a range ${colName(g.c1)}${g.r1 + 1}:${colName(g.c2)}${g.r2 + 1})` : ''}.`];
  const head: string[] = [];
  for (let c = 0; c < Math.min(usedCols(s), 12); c++) head.push(eng.text(sheet, addr(0, c)));
  lines.push(`First row: ${head.map((t) => clip(t, 24)).join(' | ')}`);
  let n = 0;
  for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 13); r++)
    for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 7); c++) {
      const a = addr(r, c);
      const cell: Cell | undefined = s.cells[a];
      if (!cell || (cell.v === undefined && cell.f === undefined)) continue;
      lines.push(`${a}: ${clip(cellInput(cell))}${cell.f !== undefined ? ` (shows ${clip(eng.text(sheet, a), 30)})` : ''}`);
      if (++n > 60) return lines.join('\n');
    }
  return lines.join('\n');
}
export const explainMessage = (ctx: string): string => `SHEET EXPLAIN\n${ctx}\nIn one or two plain sentences, say what the selected cell is for and, if it has a formula, how it is worked out. No tables, no lists.`;
export const formulaMessage = (what: string, ctx: string): string =>
  `SHEET FORMULA\nWhat he wants: ${what.trim() || 'a formula for the selected cells'}\n${ctx}\nReply with one Excel formula that does it, starting with =, on a line of its own, then one plain sentence saying what it does. Use only common Excel functions (${FUNCTION_NAMES.slice(0, 24).join(', ')} and the like).`;
export const cleanMessage = (words: string[]): string => `SHEET CLEAN\nTidy these words: fix spacing, capital letters and obvious typos, change nothing else, keep each on its own numbered line.\n${words.map((w, i) => `[${i + 1}] ${w}`).join('\n')}`;

/** The first formula in a reply (on a line of its own, or in backticks), without its chatter. */
export function formulaFrom(reply: string): string | null {
  const tick = /`(=[^`\n]+)`/.exec(reply);
  if (tick) return tick[1]!.trim();
  const line = /^\s*(=[^\n]+)$/m.exec(reply);
  return line ? line[1]!.trim().replace(/[.;]$/, '') : null;
}
/** The sentence of a reply that is not the formula. */
export const sentenceFrom = (reply: string): string => reply.replace(/```[a-z]*\n?|```/g, '').split('\n').map((l) => l.trim()).filter((l) => l && !/^=/.test(l) && !/^`=/.test(l) && !/^(?:sure|here|okay|of course)[^.]*:$/i.test(l)).join(' ').replace(/\s+/g, ' ').trim();
/** The numbered lines of a reply as the words they hold, by number. */
export function numberedFrom(reply: string, count: number): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: count }, () => null);
  for (const m of reply.matchAll(/^\[(\d+)\] ?(.*)$/gm)) {
    const i = Number(m[1]) - 1;
    if (i >= 0 && i < count) out[i] = m[2]!.trim();
  }
  return out;
}
export { parseRange };
