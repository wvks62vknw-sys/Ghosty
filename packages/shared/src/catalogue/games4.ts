/**
 * The catalogue's words for the five games of pass 4 in the ARCADE (BRIEF-GAMES-4), keyed as the arcade's registry items,
 * `arcade:<shelf id>`: Blocks, Blast, the Flap, the Climb and the Beat. Every one has a level for you and one for Ghosty
 * with no top.
 */
import type { CatValue } from '../catalogue';

const base = { scene: ['playing' as const], cat: 'play' as const, go: { open: 'arcade' }, since: '2026-11-10' };

export const GAMES4_WORDS: Record<string, CatValue> = {
  'arcade:blocks': {
    name: 'Play falling blocks against me',
    line: 'You can play falling blocks against me: two wells, and every double, triple or four-line clear sends garbage rows to the other.',
    more: 'Slide, turn, hold and drop the pieces by buttons or by swiping on the well. I play the small well, and the weights I choose pieces with are the ones I tune in practice. Your level rises when you win and eases back when you lose, and there is no top level.',
    say: ['Play blocks against me', 'Falling blocks against you'],
    ...base,
  },
  'arcade:blast': {
    name: 'Fit blocks onto a grid',
    line: 'You can drag three pieces at a time onto an eight-by-eight grid, clearing rows and columns, for combos.',
    more: 'A pale copy shows where a piece will land and what it will clear, and the run ends when no piece left in the tray fits. I play it too, and my best is on the title. Each level starts with more junk on the grid and has awkward pieces, and there is no top level.',
    say: ['Play the grid game', 'Fit the blocks'],
    ...base,
  },
  'arcade:flap': {
    name: 'Flap a ghost through the pillars',
    line: 'You can tap to flap a ghost through the gaps in glowing pillars.',
    more: 'Each level is faster with a narrower gap; from level 4 the gaps slide and from level 8 a wind gusts. Pass the pass mark and the next level is harder, miss it and it eases back one. I practise on the real rules and have my own level.',
    say: ['Play the pillar game', 'Flap through the pillars'],
    ...base,
  },
  'arcade:climb': {
    name: 'Bounce up the tower',
    line: 'You can bounce up an endless tower of platforms by steering with a finger.',
    more: 'Platforms slide and crumble, springs throw you high and a jet lifts you, and the screen wraps at the edges. Height is your score, and the dotted line is my best. The levels have no top.',
    say: ['Play the climbing game', 'Bounce up the tower'],
    ...base,
  },
  'arcade:beat': {
    name: 'Run to the beat',
    line: 'You can run through a song where every note is an obstacle that reaches you on its beat.',
    more: 'A high note is a gap to jump, a low note a bar to duck, a chord a wall to dash through, and the song is made on your phone from the notes you meet. Press a touch early: the closer to the middle of your move, the better the grade. Three tracks, a tempo that rises with your level, and no top level.',
    say: ['Play the rhythm game', 'Run to the beat'],
    ...base,
  },
};
