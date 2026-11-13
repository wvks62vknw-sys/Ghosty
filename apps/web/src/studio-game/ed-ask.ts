/**
 * GHOSTY HELPS, AS CHAT TURNS (BRIEF-EDITOR-GAME-STUDIO; IDEAS-ROUND-1 item 3): SKETCH A ROOM returns rows in the little language
 * that land in the room editor as a draft he can paint over; DIALOGUE FOR this person returns lines he can edit. Both are the
 * ordinary chat with the game's own words as the turn's data; no new prompt section, the prompt guard untouched. What comes back
 * is read as text and kept only if it is the language (letters it does not know become air and are counted).
 */
import { askBrain } from '../docs/ask';
import { sayError } from '../ui/hisWords';
import { type Game, LETTER_NAMES, linesFrom, type Npc, type Room, sketchFrom, TERRAIN } from './model';

const LEGEND = TERRAIN.split('').map((c) => `${c} ${LETTER_NAMES[c]?.toLowerCase()}`).join(', ');

export async function sketchRoom(game: Game, room: Room, wish: string): Promise<{ rows: string[]; w: number; h: number; dropped: number; where: string } | { error: string }> {
  const platform = game.kind === 'platformer';
  const msg = [
    `I am making a 2-D ${platform ? 'platformer' : 'top-down'} game called “${game.name}” in your game studio. Sketch one room for it: “${wish}”.`,
    `Reply with ONLY a code block of 12 to 20 rows, each exactly 24 to 40 characters wide, using only these letters: ${LEGEND}.`,
    platform ? 'The ground is # along the bottom two rows; ledges p float above; leave the top rows air.' : 'Walls W run round the edge; floor is . (air); keep every part of the room reachable.',
    `The room is called “${room.name}”. No words outside the code block except one short line.`,
  ].join(' ');
  try {
    const r = await askBrain(msg, () => undefined, 'game studio');
    const s = sketchFrom(r.text);
    return s ? { ...s, where: r.where } : { error: 'I could not read a room out of that answer. Ask again, or say it another way.' };
  } catch (e) {
    return { error: sayError(e, 'draw that room') };
  }
}

export async function dialogueFor(game: Game, npc: Npc): Promise<{ lines: string[]; where: string } | { error: string }> {
  const msg = [
    `I am making a game called “${game.name}” in your game studio. Write 3 short lines of speech for a character called ${npc.name}.`,
    npc.lines.length ? `They already say: ${npc.lines.map((l) => `“${l.text}”`).join(' ')}.` : '',
    npc.shop.length ? 'They also run a small shop.' : '',
    'Reply with the lines only, one on each row, under 90 characters each, in the voice of a friendly person in a game.',
  ].filter(Boolean).join(' ');
  try {
    const r = await askBrain(msg, () => undefined, 'game studio');
    const lines = linesFrom(r.text);
    return lines.length ? { lines, where: r.where } : { error: 'I could not read lines out of that answer. Ask again.' };
  } catch (e) {
    return { error: sayError(e, 'write their lines') };
  }
}
