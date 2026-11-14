/**
 * CHESS, an app of its own (the APPS ROUND, the learn lane's flagship), built on the App Kit (ui/appkit.ts): one header, one
 * scroll area, the keys at the bottom, undo and Recently deleted, CSV and JSON export, all seven looks.
 *  - THE LIBRARY (the kit's list): every puzzle he has tried, solved or missed, with its theme, its rating and the day, newest
 *    first. A tap tries it again; search finds a theme ("fork", "mate in 2"); export gives the list as CSV or JSON.
 *  - PUZZLES: the trainer (features/gym/chesspuzzles.ts) in a sheet: Lichess's open CC0 puzzles kept on this phone, SOLVE,
 *    PUZZLE RUSH and TODAY'S PUZZLE (each fetched only on his tap, the size said).
 *  - PLAY: rated chess against Stockfish on this phone, in the GYM.
 * Kept on the phone at ghosty.app.chess (the kit's place); never a player looked up, nothing predicted about anyone.
 */
import { clear, h } from '../../core/dom';
import { app, type KitApp, type KitItem } from '../../ui/appkit';
import { modal } from '../../ui/components';
import type { Puzzle } from '../../gym/chesspuzzle';
import { themeWords } from '../../gym/chesspuzzle';
import type { PuzzleResult } from '../gym/chesspuzzles';

import { CHESS_GLYPH } from './glyph';
export { CHESS_GLYPH };
const ID = 'chess';
const KEY = `ghosty.app.${ID}`;
export const chessAppState = { open: false, sheet: '' as '' | 'puzzles', rows: 0 };
let live: KitApp | null = null;

/** The example rows of the first run: two real (made for the example) puzzles, each one tap from being tried. */
const SAMPLE: KitItem[] = [
  { id: 'sample-mate', title: 'Mate in 1 · example', sub: 'Tap to try it: White to move', meta: '900', puzzle: { id: 'sample-mate', rating: 900, themes: ['mateIn1'], moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'], solution: ['h5f7'] } },
  { id: 'sample-open', title: 'Opening · example', sub: 'Tap to try it: develop with a threat', meta: '1200', puzzle: { id: 'sample-open', rating: 1200, themes: ['opening'], moves: ['e4', 'e5'], solution: ['g1f3', 'b8c6', 'f1c4'] } },
];

/** One row of the library for a puzzle he finished. Pure. */
export function rowOf(r: PuzzleResult, now = Date.now()): KitItem {
  const theme = r.z.themes.find((t) => !/^(short|long|oneMove|veryLong)$/.test(t)) ?? r.z.themes[0] ?? 'puzzle';
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }).format(now);
  const name = themeWords(theme);
  return { id: `${r.z.id}-${now}`, title: `${name.charAt(0).toUpperCase()}${name.slice(1)}`, sub: `${r.solved ? 'Solved' : 'Missed'}${r.rush ? ' in a rush' : ''} · ${day} · your rating about ${r.rating}`, meta: String(r.z.rating), puzzle: r.z, solved: r.solved };
}

/** A finished puzzle into the library: live when the app is open, else straight into its place on the phone. */
export function logPuzzle(r: PuzzleResult): void {
  const row = rowOf(r);
  if (live && live.el.isConnected) return live.add(row);
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { items: KitItem[]; bin: unknown[]; seen: boolean; settings: Record<string, boolean> } | null;
    const v = kept ?? { items: SAMPLE.map((x) => ({ ...x })), bin: [], seen: false, settings: {} };
    v.items = [row, ...v.items].slice(0, 500);
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* blocked storage: the trainer still kept its own count */
  }
}

/** The trainer in a sheet over the app (a puzzle to start with, from the library, or the next from the pack). */
async function openTrainer(start?: Puzzle): Promise<void> {
  const [{ puzzlesSection }, { renderFrame }] = await Promise.all([import('../gym/chesspuzzles'), import('../gym/index')]);
  const box = h('div.chesssheet');
  chessAppState.sheet = 'puzzles';
  modal('PUZZLES', box, () => (chessAppState.sheet = ''));
  clear(box, puzzlesSection({ renderFrame, onResult: logPuzzle, ...(start ? { start } : {}) }));
}

/** Open CHESS, full screen. */
export function openChess(): KitApp {
  const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (g) g.chessApp = chessAppState;
  const root = h('div.chessapp', { dataset: { case: 'keep' } });
  chessAppState.open = true;
  const m = modal('CHESS', root, () => {
    chessAppState.open = false;
    live = null;
  });
  live = app(root, {
    id: ID,
    name: 'Chess',
    glyph: CHESS_GLYPH,
    noun: ['puzzle', 'puzzles'],
    sample: SAMPLE,
    tour: ['Every puzzle you try lands here: tap one to try it again.', 'PUZZLES fetches real puzzles from Lichess’s free database, on your tap, and keeps them on this phone.', 'PLAY is rated chess against Stockfish, on this phone.'],
    actions: [
      { word: 'Puzzles', run: () => void openTrainer() },
      // (rated chess lives in the GYM, with its board and Stockfish: CHESS closes and the GYM opens on chess)
      { word: 'Play', run: () => (m.close(), void import('../gym/index').then((x) => x.openGym('chess'))) },
    ],
    open: (item) => {
      const z = item.puzzle as Puzzle | undefined;
      if (z) void openTrainer(z);
    },
  });
  chessAppState.rows = live.items().length;
  return live;
}
