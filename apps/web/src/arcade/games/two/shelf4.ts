/**
 * The games of pass 4 (BRIEF-GAMES-4) as shelf entries, merged into arcade/shelf.ts SHELF beside GAMES2 and GAMES3: no
 * data to fetch (`data: null`, `madeByUs: true`), so each card says PLAY at once. Our own look, names and sounds only.
 * Each game keeps a level for you and one for Ghosty (games/two/skill.ts) with no top.
 */
import type { Control, ShelfEntry } from '../../shelf';

export type Game4Id = 'blocks' | 'blast' | 'flap' | 'climb' | 'beat';

export interface MadeByUs4Entry extends Omit<ShelfEntry, 'engine' | 'data'> {
  engine: Game4Id;
  data: null;
  madeByUs: true;
}

export const BLOCKS_ID = 'blocks';
export const BLAST_ID = 'blast';
export const FLAP_ID = 'flap';
export const CLIMB_ID = 'climb';
export const BEAT_ID = 'beat';
/** Ghosty's own best of each, through scores.ts (his practice writes it; the card shows it). */
export const BLOCKS_GHOSTY_ID = 'blocks.ghosty';
export const BLAST_GHOSTY_ID = 'blast.ghosty';
export const FLAP_GHOSTY_ID = 'flap.ghosty';
export const CLIMB_GHOSTY_ID = 'climb.ghosty';
export const BEAT_GHOSTY_ID = 'beat.ghosty';

export const GAMES4: MadeByUs4Entry[] = [
  {
    id: BLOCKS_ID,
    title: 'BLOCKS',
    line: 'Falling blocks against Ghosty: clear rows, send him garbage, stay on top.',
    engine: 'blocks',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: false,
    since: '2026-11-10',
    ghosty: 'Two wells, one winner. Clear two rows or more at once and I get garbage. I keep learning where pieces go, so do not get comfortable.',
    done: 'Duel over. Your level is kept, and so is mine.',
  },
  {
    id: BLAST_ID,
    title: 'BLAST',
    line: 'Drag pieces onto an eight-by-eight grid, clear rows and columns, chain the combos.',
    engine: 'blast',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: false,
    since: '2026-11-10',
    ghosty: 'A pale copy shows where a piece will land and what it will clear. Keep a corner open. I play it too, and my best is on the title.',
    done: 'No room left. Your level is kept, and so is mine.',
  },
  {
    id: FLAP_ID,
    title: 'THE FLAP',
    line: 'Tap to flap a ghost through glowing pillars. Every level is faster.',
    engine: 'flap',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: false,
    since: '2026-11-10',
    ghosty: 'One tap, one flap. Aim for the middle of the gap. Past Level 4 the gaps slide, past 8 the wind comes up, and there is no last level.',
    done: 'Down. Your level is kept, and so is mine.',
  },
  {
    id: CLIMB_ID,
    title: 'THE CLIMB',
    line: 'Bounce up an endless tower, steering with a finger. Springs, jets, crumbling ground.',
    engine: 'climb',
    data: null,
    madeByUs: true,
    controls: ['move'] satisfies Control[],
    saves: false,
    since: '2026-11-10',
    ghosty: 'Slide a finger and I will steer towards it. The brown ones crumble. The dotted line is my best, and I am still climbing.',
    done: 'Fell. Your level is kept, and so is mine.',
  },
  {
    id: BEAT_ID,
    title: 'THE BEAT',
    line: 'A runner and a song: every note is an obstacle that reaches you on the beat.',
    engine: 'beat',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: false,
    since: '2026-11-10',
    ghosty: 'The music is the level. High note, jump. Low note, duck. A chord, dash through. Press a touch early and land it on the beat.',
    done: 'Out of beats. Your level is kept, and so is mine.',
  },
];
