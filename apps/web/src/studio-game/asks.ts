/**
 * The chat's words for THE GAME STUDIO, read with no model: "make a game", "my games", "sketch a cave room with two ledges".
 * The sketch itself is a chat turn the studio makes with the game's own words (studio-game/ed-ask.ts). Pure.
 */
export interface GameAsk {
  what: 'list' | 'new' | 'sketch' | 'three';
  wish?: string;
}
export function gameAsked(text: string): GameAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  // (APPS ROUND) GAME STUDIO 3D: "make a 3d game", "my 3d games", "make a 3d platformer with 10 coins" (the rest is a draft to accept or reject)
  if (/^(?:open |show )?(?:me )?(?:my )?3-?d games?(?: studio)?$/i.test(t)) return { what: 'three' };
  const three = /^(?:make|build|start|create)(?: me)?(?: a| an| my)?(?: new)? 3-?d (game|platformer|explorer|maze|kart|race|racing game|racer|puzzle|marble game|shooter)\b(.*)$/i.exec(t);
  if (three) return { what: 'three', ...(three[1]!.toLowerCase() !== 'game' || three[2]!.trim() ? { wish: `${three[1]}${three[2]}`.trim() } : {}) };
  if (/^(?:open |show )?(?:me )?(?:my )?(?:games? studio|the game studio|my games|games i(?:'|’)?ve made)$/i.test(t)) return { what: 'list' };
  if (/^(?:make|build|start|create)(?: me)?(?: a| my)?(?: new)? (?:2-?d )?game$/i.test(t) || /^new game$/i.test(t)) return { what: 'new' };
  const m = /^sketch (?:me )?(?:a |an |the )?(.{3,120}?) room(?: with (.{3,100}))?$/i.exec(t) ?? /^sketch (?:me )?(?:a |an )?room(?: of| with| for)? (.{3,120})$/i.exec(t);
  if (m) return { what: 'sketch', wish: t.replace(/^sketch (?:me )?/i, '') };
  return null;
}
