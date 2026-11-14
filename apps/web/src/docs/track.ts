/**
 * HIS OWN TRACKED CHANGES (APPS ROUND, documents pro): with TRACK CHANGES on, the words he types are kept marked as put in and the
 * words he deletes stay in the page struck through, each with its time, until he ACCEPTs or REJECTs them (one by one, or ALL).
 * Words he put in and then deletes again simply go. Written to Word as w:ins and w:del and read back as the same marks. Ghosty's
 * own suggestions are a separate thing (model.ts Suggestion) and are untouched by this. Pure: apps/edge/test/document.test.mjs.
 */
import { tidyRuns, type Block, type Doc, type Run } from './model';

const plain = (runs: Run[]): string => runs.map((r) => r.text).join('');
function cut(runs: Run[], at: number): [Run[], Run[]] {
  const a: Run[] = [];
  const z: Run[] = [];
  let n = 0;
  for (const r of runs) {
    if (n + r.text.length <= at) a.push(r);
    else if (n >= at) z.push(r);
    else {
      a.push({ ...r, text: r.text.slice(0, at - n) });
      z.push({ ...r, text: r.text.slice(at - n) });
    }
    n += r.text.length;
  }
  return [a, z];
}
const deleted = (r: Run, at: number): Run[] => (r.tc === 'ins' ? [] : r.tc === 'del' ? [r] : [{ ...r, tc: 'del', tat: at }]);

/**
 * One edit of a paragraph while tracking: `was` is the paragraph as kept, `now` what the page shows after his key (its words and
 * marks as typed). What went is struck (or simply goes, when it was his own insertion), what came is marked as put in at `at`.
 * A delete that only touched words already struck strikes the letter before them instead (a backspace keeps walking back).
 * `caret` is where his caret belongs afterwards, in letters.
 */
export function trackEdit(was: Run[], now: Run[], at: number): { runs: Run[]; caret: number; changed: boolean } {
  const a = plain(was);
  const b = plain(now);
  if (a === b) return { runs: was, caret: -1, changed: false };
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const goneEnd = a.length - s;
  const cameText = b.slice(p, b.length - s);
  const [head, rest] = cut(was, p);
  const [gone, tail] = cut(rest, goneEnd - p);
  // the inserted words keep the marks they were typed with (bold stays bold), and are his
  const [, nowRest] = cut(now, p);
  const [came] = cut(nowRest, cameText.length);
  const ins: Run[] = came.map(({ tc: _t, tat: _a, ...r }) => ({ ...r, tc: 'ins' as const, tat: at }));
  if (!cameText && gone.length && gone.every((r) => r.tc === 'del')) {
    // a backspace over words already struck: the letter before them is struck instead
    let k = p - 1;
    const flat = was.flatMap((r) => [...r.text].map(() => r.tc ?? ''));
    while (k >= 0 && flat[k] === 'del') k--;
    if (k < 0) return { runs: was, caret: p, changed: false };
    const [h2, r2] = cut(was, k);
    const [one, t2] = cut(r2, 1);
    const runs = tidyRuns([...h2, ...one.flatMap((r) => deleted(r, at)), ...t2]);
    return { runs, caret: k, changed: true };
  }
  const struck = gone.flatMap((r) => deleted(r, at));
  const runs = tidyRuns([...head, ...struck, ...ins, ...tail]);
  const caret = p + plain(struck).length + cameText.length;
  return { runs, caret: cameText ? caret : p, changed: true };
}

export interface Change {
  id: string;
  block: string;
  kind: 'ins' | 'del';
  text: string;
  at: number;
}
/** Every tracked change in the document, in reading order (table cells are not tracked). */
export function changesOf(d: Doc): Change[] {
  const out: Change[] = [];
  for (const b of d.blocks) b.runs.forEach((r, k) => r.tc && out.push({ id: `${b.id}:${k}`, block: b.id, kind: r.tc, text: r.text, at: r.tat ?? 0 }));
  return out;
}
const settleRun = (r: Run, accept: boolean): Run[] => {
  if (!r.tc) return [r];
  const keepIt = (r.tc === 'ins') === accept;
  if (!keepIt) return [];
  const { tc: _t, tat: _a, ...rest } = r;
  return [rest];
};
const settleBlock = (b: Block, accept: boolean, only?: number): Block => ({ ...b, runs: tidyRuns(b.runs.flatMap((r, k) => (only === undefined || k === only ? settleRun(r, accept) : [r]))) });
/** One change accepted (its words become plain) or rejected (put back as they were); null when it is not there any more. */
export function settle(d: Doc, id: string, accept: boolean): Doc | null {
  const [block, k] = [id.slice(0, id.lastIndexOf(':')), Number(id.slice(id.lastIndexOf(':') + 1))];
  const b = d.blocks.find((x) => x.id === block);
  if (!b || !b.runs[k]?.tc) return null;
  return { ...d, blocks: d.blocks.map((x) => (x.id === block ? settleBlock(x, accept, k) : x)) };
}
/** ACCEPT ALL or REJECT ALL. */
export const settleAll = (d: Doc, accept: boolean): Doc => ({ ...d, blocks: d.blocks.map((b) => (b.runs.some((r) => r.tc) ? settleBlock(b, accept) : b)) });
/** The document as it reads with every change accepted (what the PDF, Markdown and plain text give). */
export const finalDoc = (d: Doc): Doc => (d.blocks.some((b) => b.runs.some((r) => r.tc)) ? settleAll(d, true) : d);
/** A change in his words: “Put in “the” · 14:05”. */
export const changeWords = (c: Change): string => `${c.kind === 'ins' ? 'Put in' : 'Deleted'} “${c.text.length > 60 ? `${c.text.slice(0, 57)}…` : c.text.replace(/\n/g, ' ')}”${c.at ? ` · ${new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}`;
export const hasChanges = (d: Doc): boolean => d.blocks.some((b) => b.runs.some((r) => r.tc));
