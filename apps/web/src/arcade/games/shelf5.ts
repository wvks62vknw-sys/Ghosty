/**
 * The six games of pass 5 (BRIEF-GAMES-5) as shelf entries, merged into arcade/shelf.ts SHELF after THE BEAT: no data to
 * fetch (`data: null`, `madeByUs: true`), so each card says PLAY at once. Our own look, names, rules and sounds only.
 * THE PLATFORMER and THE CAVE keep a level for you and one for Ghosty (games/two/skill.ts, no top); the four board games
 * keep a rating for each of you (games/board/rating.ts).
 */
import type { Control, ShelfEntry } from '../shelf';

export type Game5Id = 'platform' | 'cave' | 'draughts' | 'othello' | 'backgammon' | 'connect4';
export const BOARD_IDS = ['draughts', 'othello', 'backgammon', 'connect4'] as const;
export type BoardId = (typeof BOARD_IDS)[number];

export interface MadeByUs5Entry extends Omit<ShelfEntry, 'engine' | 'data'> {
  engine: Game5Id;
  data: null;
  madeByUs: true;
}

export const PLATFORM_ID = 'platform';
export const CAVE_ID = 'cave';
/** Ghosty's own best of each, through scores.ts (his practice writes it; the card shows it). */
export const PLATFORM_GHOSTY_ID = 'platform.ghosty';
export const CAVE_GHOSTY_ID = 'cave.ghosty';

export const GAMES5: MadeByUs5Entry[] = [
  {
    id: PLATFORM_ID,
    title: 'THE PLATFORMER',
    line: 'Run and jump through eight worlds of our own, to the flag. A dotted ghost runs beside you: Ghosty\'s best time.',
    engine: 'platform',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: false,
    since: '2026-11-11',
    ghosty: 'Jump a touch late and you still get a jump. Land on a walker, kick a shell, and keep the flag in sight. The dotted ghost is my best time.',
    done: 'Flag or no flag, your level is kept, and so is mine.',
  },
  {
    id: CAVE_ID,
    title: 'THE CAVE',
    line: 'One cave of twelve rooms: find the boots, the blaster and the lamp, light the lanterns, find your way out.',
    engine: 'cave',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump', 'fire', 'use', 'map'] satisfies Control[],
    saves: true,
    since: '2026-11-11',
    ghosty: 'Lanterns save your place. Pinch for the map. Crystals make the blaster stronger. My level holds: it does not fall until I lose three sessions running.',
    done: 'Saved at the last lantern. CONTINUE puts you back where you were.',
  },
  {
    id: 'draughts',
    title: 'DRAUGHTS',
    line: 'Draughts against Ghosty, who thinks as long as his level says. Captures are compulsory.',
    engine: 'draughts',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: true,
    since: '2026-11-11',
    ghosty: 'I search on this phone, as long as my level lets me. Take a move back, ask for a hint, and see how far your rating goes.',
    done: 'Game over. Your rating and mine are kept.',
  },
  {
    id: 'othello',
    title: 'OTHELLO',
    line: 'Flip his discs by outflanking them. Corners are worth more than they look.',
    engine: 'othello',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: true,
    since: '2026-11-11',
    ghosty: 'Legal moves glow. I like corners and I hate giving them away. When neither of us can move, the game is over.',
    done: 'Game over. Your rating and mine are kept.',
  },
  {
    id: 'backgammon',
    title: 'BACKGAMMON',
    line: 'Race your checkers home against Ghosty, with the dice rolled fair and shown.',
    engine: 'backgammon',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: true,
    since: '2026-11-11',
    ghosty: 'The dice are rolled by the game, never by me. Hit a lone checker and it goes to the bar; bear off to win.',
    done: 'Game over. Your rating and mine are kept.',
  },
  {
    id: 'connect4',
    title: 'CONNECT 4',
    line: 'Four in a row against a Ghosty who is much harder than the one in the GYM.',
    engine: 'connect4',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: true,
    since: '2026-11-11',
    ghosty: 'I search every column as deep as my level allows. The old trick may still work at level 1. It will not at level 12.',
    done: 'Game over. Your rating and mine are kept.',
  },
];
