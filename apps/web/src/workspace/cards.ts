/**
 * FLASHCARDS FROM HIS OWN NOTES (editors.c3): a Workspace page (or one of MY DOCUMENTS) read for cards with no model, the way he wrote it:
 *  - "Term: what it means" or "Term — what it means" on a line or a list item: the term on the front, the meaning on the back;
 *  - a toggle: its line on the front, the lines inside it on the back (how Notion users write flashcards);
 *  - a heading with words under it: the heading on the front, the first lines under it on the back;
 *  - a table of two or more columns: each row's first cell on the front, the rest on the back (the header row left out).
 * The cards go into LEARN's own revision (features/learn/store.ts addCard), where SM-2 brings each back just before he would forget it.
 * Pure: apps/edge/test/workspace.test.mjs.
 */
import type { WBlock } from './model';

export interface NoteCard {
  front: string;
  back: string;
}
const words = (b: { runs?: { text: string }[] }): string => (b.runs ?? []).map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
const TEXTY = new Set(['p', 'ul', 'ol', 'todo', 'quote', 'callout', 'right']);
const PAIR = /^(.{2,80}?)(?:\s*[:=]|\s+[—–-])\s+(.{2,})$/;

/** The cards a page's blocks make, in page order, each front once. */
export function cardsFrom(blocks: WBlock[], max = 60): NoteCard[] {
  const out: NoteCard[] = [];
  const used = new Set<string>();
  const used2 = new Set<string>();
  const push = (front: string, back: string, ids: string[] = []): void => {
    const f = front.replace(/[:\s]+$/, '').trim().slice(0, 400);
    const b = back.trim().slice(0, 300);
    if (f.length < 3 || !b || used.has(f.toLowerCase()) || out.length >= max) return;
    used.add(f.toLowerCase());
    for (const id of ids) used2.add(id);
    out.push({ front: f, back: b });
  };
  blocks.forEach((b, i) => {
    if (used2.has(b.id)) return;
    if (b.t === 'toggle') {
      const inside = blocks.filter((x) => x.under === b.id).map(words).filter(Boolean);
      if (inside.length) push(words(b), inside.join('\n'), blocks.filter((x) => x.under === b.id).map((x) => x.id));
      return;
    }
    if (b.t === 'table') {
      const rows = (b.rows ?? []).map((r) => r.map((c) => c.map((x) => x.text).join('').trim()));
      for (const r of rows.slice(b.head ? 1 : 0)) if (r.length >= 2 && r[0] && r.slice(1).some(Boolean)) push(r[0], r.slice(1).filter(Boolean).join(' · '));
      return;
    }
    if (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') {
      const under: string[] = [];
      const ids: string[] = [];
      for (const x of blocks.slice(i + 1)) {
        if (x.t === 'h1' || x.t === 'h2' || x.t === 'h3' || under.length >= 3) break;
        if (!TEXTY.has(x.t) || PAIR.test(words(x))) break;
        const w = words(x);
        if (w) {
          under.push(w);
          ids.push(x.id);
        }
      }
      if (under.length) push(words(b), under.join('\n'), ids);
      return;
    }
    if (TEXTY.has(b.t)) {
      const m = PAIR.exec(words(b));
      if (m && !/^https?$/i.test(m[1]!)) push(m[1]!, m[2]!);
    }
  });
  return out;
}

/** "12 cards from Kitchen" · "No cards in this page yet: write “Term: what it means” lines, or put the answers inside a toggle." */
export function cardsWords(n: number, title: string): string {
  return n ? `${n} card${n === 1 ? '' : 's'} from “${title}”: each word stays yours, and Learn brings each back just before you would forget it.` : 'No cards in this page yet: write lines like “Term: what it means”, put the answer inside a toggle, or write a heading with the answer under it.';
}
