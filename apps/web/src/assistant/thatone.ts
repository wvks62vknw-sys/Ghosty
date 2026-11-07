/**
 * "THAT ONE" (BRIEF-AWARENESS item 4): the words that point at what is selected on the screen ("make that wall longer", "add a
 * wardrobe there", "a door in that wall", "find me a replacement", "read that one", "open that one") act on the selection
 * the screen publishes (shell/awareness.ts), on the phone, with no model, where the act is local. When nothing of the right
 * kind is selected the words go on to the brain, whose message carries what is on screen.
 *
 * The matchers are pure (the phrases registry reads `thatOne`); `thatOneTurn` is the handler (assistant/local.ts, in the table's
 * order). Each reply says in one line what it did with the selection ("The north wall: 3.2 m, how long?").
 */
import { ESTIMATE, money, PARTS, isPart } from '../car/parts';
import { screenActs, screenContext } from '../shell/awareness';
import { spaceHooks } from '../space/hooks';
import type { Selected } from '../../../../packages/shared/src/awareness';
import { thatOne } from './thatwords';
export { thatOne, type That } from './thatwords';

type Opts = { voice?: boolean; private?: boolean };
type Go = { id: string; ask: number; label: string; words?: string };
type Answer = (text: string, reply: string, local: { kind: 'pack'; go?: Go[] }, opts: Opts) => true;

/** The thing selected on the screen that is up (the deck's while it is open): its screen and the selection. */
export function selectionNow(): { screen: string; sel: Selected | undefined } {
  const c = screenContext();
  return { screen: c.screen, sel: c.selected };
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export async function thatOneTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const that = thatOne(text);
  if (!that) return false;
  const { screen, sel } = selectionNow();
  if (!sel) return false;
  if (that.act === 'longer' && screen === 'space' && sel.kind === 'wall') {
    const said = spaceHooks.lengthSheet?.();
    return said ? answer(text, said, { kind: 'pack' }, opts) : false;
  }
  if (that.act === 'opening' && screen === 'space' && sel.kind === 'wall') {
    const said = spaceHooks.openingOn?.(that.type);
    return said ? answer(text, said, { kind: 'pack' }, opts) : false;
  }
  if (that.act === 'add' && screen === 'space' && (sel.kind === 'wall' || sel.kind === 'room' || sel.kind === 'item' || sel.kind === 'opening')) {
    const said = spaceHooks.addAt?.(that.what);
    return said ? answer(text, said, { kind: 'pack' }, opts) : false;
  }
  if (that.act === 'replace' && screen === 'studio' && sel.kind === 'part' && isPart(sel.id)) {
    // What the phone holds for a part is its sheet: what it is, who fits it, a rough cost. The shop search is my brain's (find_part).
    const p = PARTS[sel.id];
    const who = p.diy === 'DIY' ? 'a job you can do yourself' : p.diy === 'GARAGE' ? 'a garage job' : 'a job for you or a garage';
    const reply = `${cap(p.name.toLowerCase())}: ${who}, ${money(p.cost)} for ${p.covers} (${ESTIMATE}). Its sheet is open under the car. I can look in UK shops for one, with prices read off their pages.`;
    return answer(text, reply, { kind: 'pack', go: [{ id: 'phrase:thatone', ask: -1, label: 'FIND ONE IN SHOPS', words: `Find me a replacement ${p.name.toLowerCase()} in UK shops` }] }, opts);
  }
  if (that.act === 'open' && screen === 'deck' && sel.kind === 'card') {
    const ok = screenActs.openCard?.(sel.id);
    return ok ? answer(text, `Opening ${sel.label}.`, { kind: 'pack' }, opts) : false;
  }
  return false;
}
