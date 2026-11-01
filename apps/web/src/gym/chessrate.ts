/**
 * RATED CHESS (BRIEF-REST-B part 1): what a game against a real engine is worth. Pure and light (no engine, no page): the
 * ladder of levels, Glicko-2 (Glickman's 2013 paper, in code), and the words for his rating and Ghosty's own.
 *
 * THE ENGINE'S LEVELS. The engine is Stockfish (vendored, apps/web/public/vendor/stockfish; GPL, run in a Worker). Its
 * UCI_LimitStrength + UCI_Elo options play at a chosen strength, and the Elo it labels is PUBLISHED AS APPROXIMATE: Stockfish
 * calibrated it at a long time control (about a minute a game) and anchored it to the CCRL 40/4 list, so on a phone that
 * thinks for a fraction of a second a move it plays near its label, not exactly at it. Its lowest label is 1320; below that
 * the first level is Stockfish's own `Skill Level 0` with a one-move search, which is Ghosty's OWN ESTIMATE (about 900), not
 * a published number. The ratings below are therefore "about", with the uncertainty beside them.
 *
 * THE RATING. Glicko-2 for him and, separately, for Ghosty's own chess (his learned evaluator in the GYM's worker plays the
 * same levels): a rating, its deviation (RD, how unsure it is) and its volatility. A new player starts at 1200 with an RD of
 * 350; every game against a level of known Elo moves the rating and narrows the RD. The engine's Elo is approximate, so as an
 * opponent it carries an RD of 60.
 */

/** One rung of the ladder: the Elo it is labelled, and how the engine is told to play it. */
export interface ChessLevel {
  id: number;
  name: string;
  /** The label: Stockfish's UCI_Elo (published, approximate), or Ghosty's estimate for the starter. */
  elo: number;
  /** 'uci': UCI_LimitStrength + UCI_Elo; 'starter': Skill Level 0 and a one-move search (an estimate). */
  kind: 'uci' | 'starter';
  /** Stockfish's own Skill Level for this Elo (0–19). */
  skill: number;
  /** How long it thinks for a move, in ms; `depth` replaces it for the starter. */
  movetime: number;
  depth?: number;
}

/** Stockfish's published range for UCI_Elo (the engine reports its own at start; these are used until it does). */
export const UCI_MIN = 1320;
export const UCI_MAX = 3190;

/** Stockfish's own mapping from a UCI_Elo to its Skill Level (the cubic in its source), 0–19. */
export function skillFor(elo: number, lo = UCI_MIN, hi = UCI_MAX): number {
  const e = (Math.min(hi, Math.max(lo, elo)) - lo) / (hi - lo);
  const level = ((37.2473 * e - 40.8525) * e + 22.2943) * e - 0.311438;
  return Math.round(Math.min(19, Math.max(0, level)) * 10) / 10;
}

const rung = (id: number, name: string, elo: number, movetime: number): ChessLevel => ({ id, name, elo, kind: 'uci', skill: skillFor(elo), movetime });

/** The ladder, weakest first. */
export const LEVELS: ChessLevel[] = [
  { id: 1, name: 'Starter', elo: 900, kind: 'starter', skill: 0, movetime: 100, depth: 1 },
  rung(2, 'Easy', 1320, 150),
  rung(3, 'Casual', 1500, 200),
  rung(4, 'Club', 1700, 250),
  rung(5, 'Keen', 1900, 300),
  rung(6, 'Strong', 2100, 400),
  rung(7, 'Expert', 2300, 500),
  rung(8, 'Master', 2500, 700),
  rung(9, 'Grandmaster', 2800, 900),
  rung(10, 'Full strength', 3190, 1200),
];

export const levelById = (id: number): ChessLevel => LEVELS[Math.min(LEVELS.length, Math.max(1, Math.round(id))) - 1]!;

/** "Level 4 · Club · about 1700" (the starter's number is Ghosty's estimate, said so). */
export const levelWords = (l: ChessLevel): string => `Level ${l.id} · ${l.name} · about ${l.elo.toLocaleString('en-GB')}${l.kind === 'starter' ? ' (my estimate)' : ''}`;

// ---------------------------------------------------------------------------------------------------------------- Glicko-2

/** A rating, its deviation and its volatility (Glickman's r, RD and σ, on the familiar 1500-centred scale). */
export interface Glicko {
  r: number;
  rd: number;
  vol: number;
}

export const NEW_PLAYER: Glicko = { r: 1200, rd: 350, vol: 0.06 };
/** The system constant τ (how fast volatility may change): 0.5 is the middle of the paper's 0.3–1.2. */
export const TAU = 0.5;
/** An engine level's own uncertainty as an opponent: its Elo is approximate. */
export const ENGINE_RD = 60;
const SCALE = 173.7178;

const gOf = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const eOf = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-gOf(phij) * (mu - muj)));

/** One game: the opponent's rating and deviation, and the score (1 a win, ½ a draw, 0 a loss). */
export interface Game {
  r: number;
  rd: number;
  s: number;
}

/**
 * Glicko-2 over one rating period of `games` (Glickman, "Example of the Glicko-2 system", 2013): the player's new rating,
 * deviation and volatility. With no games only the deviation grows.
 */
export function glicko2(p: Glicko, games: Game[], tau = TAU): Glicko {
  const mu = (p.r - 1500) / SCALE;
  const phi = p.rd / SCALE;
  if (!games.length) return { r: p.r, rd: Math.min(350, Math.sqrt(phi * phi + p.vol * p.vol) * SCALE), vol: p.vol };
  let vInv = 0;
  let sum = 0;
  for (const g of games) {
    const muj = (g.r - 1500) / SCALE;
    const phij = g.rd / SCALE;
    const gj = gOf(phij);
    const e = eOf(mu, muj, phij);
    vInv += gj * gj * e * (1 - e);
    sum += gj * (g.s - e);
  }
  const v = 1 / vInv;
  const delta = v * sum;
  // the new volatility, by the Illinois method
  const a = Math.log(p.vol * p.vol);
  const f = (x: number) => (Math.exp(x) * (delta * delta - phi * phi - v - Math.exp(x))) / (2 * (phi * phi + v + Math.exp(x)) ** 2) - (x - a) / (tau * tau);
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0 && k < 100) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phi2 = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const mu2 = mu + phi2 * phi2 * sum;
  return { r: SCALE * mu2 + 1500, rd: SCALE * phi2, vol };
}

// ---------------------------------------------------------------------------------------------------------------- the book

/** One of the two players the book rates: him, or Ghosty's own chess. */
export type Who = 'you' | 'me';

export interface Side extends Glicko {
  games: number;
  /** The rating after each game, newest last (at most 60). */
  history: { at: number; r: number; rd: number }[];
}

export interface GameLog {
  at: number;
  who: Who;
  level: number;
  /** His score: 1 a win, ½ a draw, 0 a loss. */
  score: number;
  plies: number;
}

/** What is kept on the phone (localStorage `ghosty.chess.rating`): both ratings and the last forty games. */
export interface RateBook {
  v: 1;
  you: Side;
  me: Side;
  log: GameLog[];
}

const blank = (): Side => ({ ...NEW_PLAYER, games: 0, history: [] });
export const newBook = (): RateBook => ({ v: 1, you: blank(), me: blank(), log: [] });

/** The book after one game of `who` against `level` (pure: a new book). */
export function recordGame(book: RateBook, who: Who, levelId: number, score: number, at: number, plies = 0): RateBook {
  const lv = levelById(levelId);
  const s = book[who];
  const g = glicko2(s, [{ r: lv.elo, rd: ENGINE_RD, s: Math.min(1, Math.max(0, score)) }]);
  const next: Side = { r: g.r, rd: g.rd, vol: g.vol, games: s.games + 1, history: [...s.history, { at, r: Math.round(g.r), rd: Math.round(g.rd) }].slice(-60) };
  return { ...book, [who]: next, log: [...book.log, { at, who, level: lv.id, score, plies }].slice(-40) };
}

export const rated = (s: Side): boolean => s.games > 0;
const near10 = (x: number) => Math.round(x / 10) * 10;
export const aboutR = (s: Side): number => near10(s.r);

/** "You: about 1180 · Me: about 1420 · ±80": both ratings, and how unsure the less sure of them is (before any game, "Not rated yet"). */
export function ratingWords(book: RateBook): string {
  const bits: string[] = [];
  if (rated(book.you)) bits.push(`You: about ${aboutR(book.you).toLocaleString('en-GB')}`);
  if (rated(book.me)) bits.push(`Me: about ${aboutR(book.me).toLocaleString('en-GB')}`);
  if (!bits.length) return 'Not rated yet';
  const rd = Math.max(...[book.you, book.me].filter(rated).map((s) => s.rd));
  return `${bits.join(' · ')} · ±${Math.max(10, near10(rd))}`;
}

const WEEK = 7 * 86_400_000;

/** How the rating moved in the last week: "up 35 this week" ('' with fewer than two points). */
export function trendWords(s: Side, now: number): string {
  if (s.history.length < 2) return '';
  const then = [...s.history].reverse().find((p) => p.at <= now - WEEK) ?? s.history[0]!;
  const d = near10(s.history.at(-1)!.r) - near10(then.r);
  return d > 0 ? `up ${d} this week` : d < 0 ? `down ${-d} this week` : 'steady this week';
}

/** The level nearest a rating. */
export function nearestLevel(r: number): ChessLevel {
  return LEVELS.reduce((best, l) => (Math.abs(l.elo - r) < Math.abs(best.elo - r) ? l : best), LEVELS[0]!);
}

/**
 * The next level to try for a player: the one nearest his rating, a rung up after winning most of his last games at it, a rung
 * down after losing his last two. `who`'s own log decides.
 */
export function suggestLevel(book: RateBook, who: Who = 'you'): ChessLevel {
  const base = nearestLevel(book[who].r);
  const mine = book.log.filter((g) => g.who === who && g.level === base.id).slice(-3);
  const pts = mine.reduce((t, g) => t + g.score, 0);
  if (mine.length >= 2 && pts / mine.length >= 0.67) return levelById(base.id + 1);
  if (mine.length >= 2 && pts === 0) return levelById(base.id - 1);
  return base;
}

/** What the card says under the ratings: the trend and the next level to try. */
export function nextWords(book: RateBook, now: number): string {
  const t = rated(book.you) ? trendWords(book.you, now) : '';
  const l = suggestLevel(book);
  return `${t ? `${t[0]!.toUpperCase()}${t.slice(1)}. ` : ''}Next to try: ${levelWords(l)}.`;
}

/** The book as the phone keeps it, read back safely (anything else is a new book). */
export function parseBook(raw: unknown): RateBook {
  const b = raw as Partial<RateBook> | null;
  const ok = (s: unknown): s is Side => !!s && typeof (s as Side).r === 'number' && typeof (s as Side).rd === 'number' && typeof (s as Side).vol === 'number' && Array.isArray((s as Side).history);
  if (!b || b.v !== 1 || !ok(b.you) || !ok(b.me) || !Array.isArray(b.log)) return newBook();
  return b as RateBook;
}

const KEY = 'ghosty.chess.rating';
export function loadBook(): RateBook {
  try {
    return parseBook(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return newBook();
  }
}
export function saveBook(b: RateBook): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* no storage: the rating lasts until the page closes */
  }
}

/** "what's my chess rating?", "what is my elo", "rated chess", "how good are you at chess": the chat's words for the rating. */
export const ratingAsked = (t: string): boolean =>
  /\bchess\b.{0,24}\b(rating|elo|rated)\b|\b(rating|elo)\b.{0,24}\bchess\b|\brated (game of )?chess\b|^(?:what(?:'s| is| are) )?(?:my|your) (?:elo|chess rating)\b/i.test(t.trim());

/** What the chat says to it: both ratings in words (or how to get one), and the next level to try. */
export function ratingReply(book: RateBook, now: number): string {
  if (!rated(book.you) && !rated(book.me)) {
    return 'Neither of us has a chess rating yet. In the GYM, open CHESS and tap RATED GAME to play a real engine on this phone, or RATE ME to watch me play it; a few games give a rating, and it says how unsure it is. The engine\'s Elo labels are approximate, so the ratings are too.';
  }
  const bits = [rated(book.you) ? `yours is about ${aboutR(book.you).toLocaleString('en-GB')} after ${book.you.games} game${book.you.games === 1 ? '' : 's'}` : 'you have no rated game yet', rated(book.me) ? `mine is about ${aboutR(book.me).toLocaleString('en-GB')} after ${book.me.games}` : 'I have not played the engine yet'];
  return `Chess: ${bits.join(', and ')}. ${ratingWords(book)}. ${nextWords(book, now)} These are Glicko-2 ratings against Stockfish's approximate Elo levels, so read them as "about".`;
}
