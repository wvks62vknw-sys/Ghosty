/**
 * Ratings for the four board games, the way the GYM's chess has them: Glicko-2 (gym/chessrate.ts, Glickman's 2013 paper, in
 * code), one for you and one for Ghosty in each game, both starting at 1200 with a deviation of 350. Each game you play is a
 * game for both, against the other's rating of the moment, so a win moves yours up and his down. Kept on this phone
 * (`ghosty.arcade.board.rating`); a damaged record reads as new. The numbers are shown to the nearest ten, because that is all
 * a handful of games can honestly say.
 */
import { type Glicko, glicko2, NEW_PLAYER } from '../../../gym/chessrate';
import type { BoardId } from '../shelf5';

export const RATING_KEY = 'ghosty.arcade.board.rating';

export interface Rated extends Glicko {
  games: number;
}
export interface BoardBook {
  you: Rated;
  me: Rated;
  wins: number;
  losses: number;
  draws: number;
  /** His last games: when, how it went for him (1, ½, 0) and the level he played at. */
  log: { at: number; score: number; level: number }[];
}
const blank = (): Rated => ({ ...NEW_PLAYER, games: 0 });
export const newBook = (): BoardBook => ({ you: blank(), me: blank(), wins: 0, losses: 0, draws: 0, log: [] });

const store = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const good = (r: unknown): r is Rated => {
  const v = r as Rated | null;
  return !!v && [v.r, v.rd, v.vol, v.games].every(Number.isFinite) && v.rd > 0 && v.vol > 0 && v.games >= 0;
};
export function allBooks(): Record<string, BoardBook> {
  try {
    const raw = JSON.parse(store()?.getItem(RATING_KEY) ?? '{}') as Record<string, Partial<BoardBook>>;
    const out: Record<string, BoardBook> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw))
      for (const [k, v] of Object.entries(raw)) if (good(v?.you) && good(v?.me)) out[k] = { you: v.you, me: v.me, wins: Number(v.wins) || 0, losses: Number(v.losses) || 0, draws: Number(v.draws) || 0, log: Array.isArray(v.log) ? v.log.slice(-40) : [] };
    return out;
  } catch {
    return {};
  }
}
export const bookOf = (id: string): BoardBook => allBooks()[id] ?? newBook();
export function saveBook(id: string, b: BoardBook): void {
  const all = allBooks();
  all[id] = b;
  try {
    store()?.setItem(RATING_KEY, JSON.stringify(all));
  } catch {
    /* full or blocked: the rating lives for this visit only */
  }
}

/** The book after one game (pure): `youScore` is 1 for your win, ½ a draw, 0 your loss; both ratings move against the other's rating before the game. */
export function afterGame(b: BoardBook, youScore: number, level: number, at: number): BoardBook {
  const y = glicko2(b.you, [{ r: b.me.r, rd: b.me.rd, s: youScore }]);
  const m = glicko2(b.me, [{ r: b.you.r, rd: b.you.rd, s: 1 - youScore }]);
  return {
    you: { ...y, games: b.you.games + 1 },
    me: { ...m, games: b.me.games + 1 },
    wins: b.wins + (youScore === 1 ? 1 : 0),
    losses: b.losses + (youScore === 0 ? 1 : 0),
    draws: b.draws + (youScore === 0.5 ? 1 : 0),
    log: [...b.log, { at, score: 1 - youScore, level }].slice(-40),
  };
}
export const near10 = (x: number): number => Math.round(x / 10) * 10;
export const rateOf = (x: Rated): string => near10(x.r).toLocaleString('en-GB');
/** "You: 1180 · Ghosty: 1420" (the starting 1200 for both before a first game). */
export const ratingTail = (id: string): string => {
  const b = bookOf(id);
  return `You: ${rateOf(b.you)} · Ghosty: ${rateOf(b.me)}`;
};
/** The same for the GYM's report card, with how many games stand behind it and how unsure it is. */
export function reportLine(id: string): string {
  const b = bookOf(id);
  if (!b.you.games) return `${ratingTail(id)} · not rated yet`;
  return `${ratingTail(id)} · ±${Math.max(10, near10(Math.max(b.you.rd, b.me.rd)))} · ${b.you.games} game${b.you.games === 1 ? '' : 's'}: ${b.wins} won, ${b.draws} drawn, ${b.losses} lost`;
}
export const BOARD_NAMES: Record<BoardId, string> = { draughts: 'Draughts', othello: 'Othello', backgammon: 'Backgammon', connect4: 'Connect 4' };
