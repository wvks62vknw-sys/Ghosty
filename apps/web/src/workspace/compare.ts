/**
 * COMPARE TWO VERSIONS (editors.u10; the workspace's HISTORY → COMPARE WITH NOW): a version beside the page as it is now, block by block
 * (blocks keep their ids through edits, so a changed line is matched to itself), each change coloured: words gone, words come, a block
 * gone, a block added. Any one part can be brought back alone (a changed line's old words, a gone block in its old place) or an added one
 * taken out, as a change like any other (so UNDO takes it back). The word-by-word diff is the documents' own (docs/model.ts wordDiff). Pure.
 */
import { wordDiff } from '../docs/model';
import { wText, type WBlock } from './model';

export type Part = { id: string; kind: 'same' | 'changed' | 'gone' | 'came'; then?: WBlock; now?: WBlock; words?: { same?: string; gone?: string; came?: string }[] };

const sameBlock = (a: WBlock, b: WBlock): boolean => a.t === b.t && JSON.stringify(a.runs) === JSON.stringify(b.runs) && JSON.stringify(a.rows ?? null) === JSON.stringify(b.rows ?? null) && !!a.done === !!b.done && JSON.stringify(a.mind ?? null) === JSON.stringify(b.mind ?? null) && (a.tone ?? '') === (b.tone ?? '');

/** The version and now, in the page's order (now's, with a gone block where it stood). */
export function comparePage(then: WBlock[], now: WBlock[]): Part[] {
  const old = new Map(then.map((b) => [b.id, b]));
  const cur = new Set(now.map((b) => b.id));
  const out: Part[] = [];
  const goneBefore = (id: string | undefined): void => {
    // the gone blocks that stood before this one in the version
    const at = id ? then.findIndex((b) => b.id === id) : then.length;
    for (let i = 0; i < at; i++) {
      const b = then[i]!;
      if (!cur.has(b.id) && !out.some((p) => p.id === b.id)) out.push({ id: b.id, kind: 'gone', then: b });
    }
  };
  for (const b of now) {
    const o = old.get(b.id);
    if (o) goneBefore(b.id);
    if (!o) out.push({ id: b.id, kind: 'came', now: b });
    else if (sameBlock(o, b)) out.push({ id: b.id, kind: 'same', then: o, now: b });
    else out.push({ id: b.id, kind: 'changed', then: o, now: b, words: wordDiff(wText(o), wText(b)) });
  }
  goneBefore(undefined);
  return out;
}
/** "3 changes: 1 line changed, 1 gone, 1 added" · "No changes: this version is the page as it is now." */
export function changeWords(parts: Part[]): string {
  const c = parts.filter((p) => p.kind === 'changed').length;
  const g = parts.filter((p) => p.kind === 'gone').length;
  const a = parts.filter((p) => p.kind === 'came').length;
  const n = c + g + a;
  if (!n) return 'No changes: this version is the page as it is now.';
  return `${n} change${n === 1 ? '' : 's'}: ${[c ? `${c} changed` : '', g ? `${g} gone` : '', a ? `${a} added` : ''].filter(Boolean).join(', ')}.`;
}
/** One part brought back: a changed block's old self, a gone block in its old place (after the nearest block before it that is still here), an added block taken out. */
export function restorePart(then: WBlock[], now: WBlock[], id: string): WBlock[] {
  const o = then.find((b) => b.id === id);
  const i = now.findIndex((b) => b.id === id);
  if (i >= 0 && o) return now.map((b) => (b.id === id ? o : b));
  if (i >= 0) return now.filter((b) => b.id !== id);
  if (!o) return now;
  const k = then.indexOf(o);
  for (let j = k - 1; j >= 0; j--) {
    const at = now.findIndex((b) => b.id === then[j]!.id);
    if (at >= 0) return [...now.slice(0, at + 1), o, ...now.slice(at + 1)];
  }
  return [o, ...now];
}
