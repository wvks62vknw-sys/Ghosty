/**
 * The chat's words for THE GAME STUDIO, read with no model: "make a game", "my games", "sketch a cave room with two ledges".
 * The sketch itself is a chat turn the studio makes with the game's own words (studio-game/ed-ask.ts). Pure.
 */
export interface GameAsk {
  what: 'list' | 'new' | 'sketch';
  wish?: string;
}
export function gameAsked(text: string): GameAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  if (/^(?:open |show )?(?:me )?(?:my )?(?:games? studio|the game studio|my games|games i(?:'|’)?ve made)$/i.test(t)) return { what: 'list' };
  if (/^(?:make|build|start|create)(?: me)?(?: a| my)?(?: new)? (?:2-?d )?game$/i.test(t) || /^new game$/i.test(t)) return { what: 'new' };
  const m = /^sketch (?:me )?(?:a |an |the )?(.{3,120}?) room(?: with (.{3,100}))?$/i.exec(t) ?? /^sketch (?:me )?(?:a |an )?room(?: of| with| for)? (.{3,120})$/i.exec(t);
  if (m) return { what: 'sketch', wish: t.replace(/^sketch (?:me )?/i, '') };
  return null;
}
