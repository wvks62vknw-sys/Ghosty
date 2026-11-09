/**
 * A number said in the chat (BRIEF-SHELL-2: "SAY A NUMBER: “OPEN TWO”"; the voice and the typed line alike): "open two" is the second
 * thing of the room he is in, or the second of his starred and recent screens anywhere else; "open learn five" the fifth thing in
 * Learn. It acts here, with no model; when the number means nothing where he is, the next table and then the brain take the words.
 */
import { thingForNumber } from '../shell/inventory';
import { openThing } from '../shell/house';
import { thingName } from '../shell/rooms';
import { ui } from '../state/app';

type Answer = (text: string, reply: string, extra: { kind: 'pack' }, opts: never) => boolean | Promise<boolean>;

export async function roomNumberTurn(text: string, opts: unknown, answer: Answer): Promise<boolean> {
  const t = thingForNumber(text, ui.get().tab);
  if (!t) return false;
  openThing({ id: t.id, name: thingName(t.id), screen: t.screen, n: 0 });
  return answer(text, `Opening ${thingName(t.id)}.`, { kind: 'pack' }, opts as never);
}
