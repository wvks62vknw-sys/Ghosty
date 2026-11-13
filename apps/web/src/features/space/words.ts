/**
 * SPACE'S WORDS (BRIEF-QUALITY-MAKE): the lines the planner says in his voice, in one place and with no DOM, so the spec reads the very
 * words the page is built from. Every size says its unit; a refusal says what to try.
 */

/** The least gap people walk through between two pieces, in cm (space/plan.ts WALKWAY says the same). */
export const WALK = 70;

/** A tight gap said with its number and the rule: "62 cm between the sofa and the TV unit: under the 70 cm a walkway needs (red)." */
export function gapWords(gaps: { a: string; b: string; cm: number }[], name: (id: string) => string, size: (cm: number) => string = (cm) => `${cm} cm`): string {
  if (!gaps.length) return `Walkways clear (${size(WALK)} or more).`;
  const tight = [...gaps].sort((x, y) => x.cm - y.cm)[0]!;
  const more = gaps.length > 1 ? ` ${gaps.length - 1} more ${gaps.length === 2 ? 'gap is' : 'gaps are'} tight too.` : '';
  return `${size(tight.cm)} between the ${name(tight.a)} and the ${name(tight.b)}: under the ${size(WALK)} a walkway needs (red).${more}`;
}

/** WILL IT FIT? with nothing typed: said beside the fields, never as a toast. */
export const FIT_EMPTY = 'Type its width and depth first, in cm (or like 1.2 m).';

/** WILL IT FIT? when the thing is bigger than the room: which side is the trouble. */
export function fitWhy(w: number, d: number, room: { w: number; d: number }): string {
  const long = Math.max(w, d);
  const short = Math.min(w, d);
  if (long > Math.max(room.w, room.d)) return `Its ${long} cm side is longer than the room’s longest, ${Math.max(room.w, room.d)} cm.`;
  if (short > Math.min(room.w, room.d)) return `Its ${short} cm side is wider than the room’s shortest, ${Math.min(room.w, room.d)} cm.`;
  return '';
}

/** DESIGN MY HOME with nothing written: one line, and where to write. */
export const DESIGN_EMPTY = 'Say a little about your home first: the rooms, and their sizes if you know them.';
/** The phone has no signal (the brain cannot be asked) and the brain itself is out of reach: two different things, said as two. */
export const DESIGN_OFFLINE = 'Drawing a plan from your words needs Ghosty’s brain, and this phone is offline. Your words stay here for when you are back.';
export const DESIGN_BRAIN_OUT = 'I can’t reach my brain just now, so I can’t draw from your words. They stay here; try again in a moment.';
export const DESIGN_KEY = { offline: 'NEEDS THE BRAIN · OFFLINE', out: 'NEEDS THE BRAIN · OUT OF REACH' };

/** A photo that gave no room: what was wrong, and what to try (the planner's own reasons, said in his voice). */
export function noRoomWords(raw: string): string | null {
  if (/No walls found/i.test(raw)) return 'I can’t see any walls in that. Try a drawn plan, photographed flat from above, with thick lines for the walls.';
  if (/no closed rooms/i.test(raw)) return 'I found walls but no closed room. Get the whole plan in the picture, with every wall joined up.';
  if (/No floor in view/i.test(raw)) return 'I can’t see the floor. Take it again with a strip of floor showing at the bottom.';
  if (/No walls in view/i.test(raw)) return 'I can’t see the walls. Stand back so the far wall and the side walls are in the picture.';
  if (/No walls could be measured/i.test(raw)) return 'I couldn’t measure a room from those. Try the opposite wall with a strip of floor, from chest height.';
  if (/could not be made into rooms/i.test(raw)) return 'I found a plan but couldn’t turn it into rooms. Try a clearer photo, taken flat.';
  return null;
}

/** A piece's name inside a sentence: "Sofa, 3-seater" is "sofa", "TV unit" stays "TV unit". */
export function pieceName(label: string): string {
  const t = label.replace(/,.*$/, '').trim() || 'piece';
  return /^[A-Z]{2}/.test(t) ? t : `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}
