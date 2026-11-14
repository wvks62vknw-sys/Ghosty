/**
 * MOVE WHOLE SECTIONS BY HEADING (NEXT ROUND, editors.u13; the document's CONTENTS, as Word's navigation pane): a section is its heading
 * and everything under it up to the next heading of the same level or higher, its own smaller headings with it. UP and DOWN swap it with
 * the section of the same level before or after it, inside the same bigger section. Pure; one change, so one UNDO.
 */
import { isHeading, textOf, type Doc } from './model';

const level = (t: string): number => (t === 'h1' ? 1 : t === 'h2' ? 2 : t === 'h3' ? 3 : 9);

/** The blocks a section covers: [from, to) — its heading, and everything up to the next heading of its level or higher. */
export function sectionRange(d: Doc, id: string): [number, number] | null {
  const k = d.blocks.findIndex((b) => b.id === id);
  if (k < 0 || !isHeading(d.blocks[k]!.t)) return null;
  const L = level(d.blocks[k]!.t);
  let end = k + 1;
  while (end < d.blocks.length && !(isHeading(d.blocks[end]!.t) && level(d.blocks[end]!.t) <= L)) end++;
  return [k, end];
}

/** The section moved up or down past its neighbour of the same level; a sentence when it cannot go (first, last, or its bigger section's edge). */
export function moveSection(d: Doc, id: string, dir: -1 | 1): { doc: Doc; said: string } | string {
  const r = sectionRange(d, id);
  if (!r) return 'Tap a heading in CONTENTS: a section moves with its heading.';
  const [a, z] = r;
  const L = level(d.blocks[a]!.t);
  const name = textOf(d.blocks[a]!).trim() || 'This section';
  if (dir < 0) {
    let p = a - 1;
    while (p >= 0 && !isHeading(d.blocks[p]!.t)) p--;
    if (p < 0) return `“${name}” is already the first section.`;
    if (level(d.blocks[p]!.t) < L) return `“${name}” is already the first section under “${textOf(d.blocks[p]!).trim()}”.`;
    // the section before, of the same level: from its heading (its own smaller headings in it) to this one
    let q = p;
    while (q >= 0 && !(isHeading(d.blocks[q]!.t) && level(d.blocks[q]!.t) <= L)) q--;
    if (q < 0) return `“${name}” is already the first section.`;
    if (level(d.blocks[q]!.t) < L) return `“${name}” is already the first section under “${textOf(d.blocks[q]!).trim()}”.`;
    const blocks = [...d.blocks.slice(0, q), ...d.blocks.slice(a, z), ...d.blocks.slice(q, a), ...d.blocks.slice(z)];
    return { doc: { ...d, blocks }, said: `“${name}” moved up, above “${textOf(d.blocks[q]!).trim()}”, with everything under it. UNDO puts it back.` };
  }
  if (z >= d.blocks.length) return `“${name}” is already the last section.`;
  const next = d.blocks[z]!;
  if (level(next.t) < L) return `“${name}” is already the last section under its heading; “${textOf(next).trim()}” starts a bigger one.`;
  const r2 = sectionRange(d, next.id)!;
  const blocks = [...d.blocks.slice(0, a), ...d.blocks.slice(r2[0], r2[1]), ...d.blocks.slice(a, z), ...d.blocks.slice(r2[1])];
  return { doc: { ...d, blocks }, said: `“${name}” moved down, below “${textOf(next).trim()}”, with everything under it. UNDO puts it back.` };
}
