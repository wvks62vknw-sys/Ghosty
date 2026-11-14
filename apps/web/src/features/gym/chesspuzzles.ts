/**
 * CHESS PUZZLES AND PUZZLE RUSH (the APPS ROUND, the learn lane's chess, at Lichess's level): real puzzles from Lichess's open
 * database (CC0), fetched by my brain only when he taps GET PUZZLES, with the size said first and on Wi-Fi (on mobile data, or
 * a phone that can't tell, a second tap is his yes). The pack is kept on this phone, so he solves them with no signal.
 *  - SOLVE: one at a time, nearest his puzzle rating first; tap a piece, then where it goes; the reply is played for him. A
 *    wrong move is said, with SHOW ME; his puzzle rating moves after each one ("about 1240").
 *  - RUSH: three minutes, three lives, easiest first; the count and his best are kept.
 * Nothing about any player or account is asked for or kept: only the puzzles. State for the specs: window.__ghosty.chessPuzzles.
 */
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { onMobileData } from '../../wiki/store';
import { netUnknown, secondTap, unknownNet } from '../learn/wifi';
import { cellOf, chessFrame, inCheck, legal, make, mFrom, mPromo, mTo, type Pos, sq64, sqOfCell } from '../../gym/chessboard';
import { judge, moveOfUci, puzzleRating, puzzleStart, themeWords, type Puzzle } from '../../gym/chesspuzzle';
import type { Frame } from '../../gym/core';

const KEY = 'ghosty.chess.puzzles';
const PACK = 20;
/** About how big a pack is (each puzzle a few hundred bytes), said before he taps. */
export const PACK_SIZE = '20 puzzles, about 12 KB';
const RUSH_MS = 180_000;

interface Book { pack: Puzzle[]; done: Record<string, 1 | 0>; rating: number; solved: number; tried: number; rushBest: number }
const fresh = (): Book => ({ pack: [], done: {}, rating: 1500, solved: 0, tried: 0, rushBest: 0 });
const load = (): Book => {
  try {
    return { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Book>) };
  } catch {
    return fresh();
  }
};
const save = (b: Book) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* blocked storage: this visit only */
  }
};

export const puzzlesState = { left: 0, rating: 1500, solved: 0, tried: 0, id: '', step: 0, said: '', last: '' as '' | 'right' | 'wrong' | 'solved', mode: 'idle' as 'idle' | 'solve' | 'rush', rush: { solved: 0, lives: 3, best: 0, over: false }, fetching: false };

export interface PuzzleResult { z: Puzzle; solved: boolean; rating: number; rush: boolean }
export function puzzlesSection(io: { renderFrame(f: Frame | null, onCell?: (i: number) => void): HTMLElement; onResult?: (r: PuzzleResult) => void; start?: Puzzle }): HTMLElement {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.chessPuzzles = puzzlesState;
  let book = load();
  const line = h('span.gymrateline.cpline', { 'aria-live': 'polite' });
  const actions = h('div.row.wrap.cpactions');
  const board = h('div.gymboard.cpboard');
  const say = h('p.note.cpsay', { 'aria-live': 'polite' });
  const after = h('div.row.wrap.cpafter');
  const el = h('div.gymidea.chesspuzzles', h('b', 'Puzzles'), line, actions, board, say, after, h('small.cpfine', 'Real puzzles from Lichess’s open puzzle database (public domain, CC0), kept on this phone.'));

  let z: Puzzle | null = null;
  let p: Pos | null = null;
  let k = 0;
  let sel = -1;
  let last: number[] = [];
  let missed = false;
  let rushEnds = 0;
  let rushTimer = 0;
  const left = () => book.pack.filter((x) => !(x.id in book.done));

  const paintLine = () => {
    Object.assign(puzzlesState, { left: left().length, rating: book.rating, solved: book.solved, tried: book.tried });
    puzzlesState.rush.best = book.rushBest;
    line.textContent = book.tried ? `Puzzle rating about ${book.rating} · ${book.solved} of ${book.tried} solved · ${left().length} waiting${book.rushBest ? ` · rush best ${book.rushBest}` : ''}` : book.pack.length ? `${left().length} puzzles waiting on this phone.` : 'No puzzles on this phone yet.';
  };
  const caption = (t: string) => {
    say.textContent = t;
    puzzlesState.said = t;
  };
  const paintBoard = () => {
    if (!p) return clear(board);
    const marks: Record<number, string> = {};
    for (const s of last) marks[cellOf(s)] = 'new';
    if (inCheck(p)) marks[cellOf(sq64(p.kings[p.side > 0 ? 0 : 1]))] = 'chk';
    if (sel >= 0) {
      marks[cellOf(sel)] = 'sel';
      for (const m of legal(p)) if (sq64(mFrom(m)) === sel) marks[cellOf(sq64(mTo(m)))] = 'tgt';
    }
    clear(board, io.renderFrame(chessFrame(p, puzzlesState.said, marks), z && k % 2 === 0 ? (i) => tap(i) : undefined));
  };
  const keys = () => {
    const busy = puzzlesState.fetching;
    const live = puzzlesState.mode !== 'idle';
    clear(actions,
      ...(live ? [button('STOP', () => end(), '')] : [
        ...(left().length ? [button('SOLVE', () => next('solve'), 'on'), button('PUZZLE RUSH', () => rush(), '')] : []),
        button(book.pack.length ? `GET ${PACK} MORE · ABOUT 12 KB` : `GET PUZZLES · ABOUT 12 KB`, () => void getPack()),
        button('TODAY’S PUZZLE · ABOUT 1 KB', () => void getDaily()),
      ]));
    for (const b of actions.querySelectorAll('button')) (b as HTMLButtonElement).disabled = busy;
  };

  const getPack = async () => {
    if ((onMobileData() || netUnknown()) && !secondTap('chess:puzzles')) return caption(onMobileData() ? `You’re on mobile data: tap again to fetch ${PACK_SIZE} now, or wait for Wi-Fi.` : unknownNet(PACK_SIZE));
    puzzlesState.fetching = true;
    keys();
    caption(`Fetching ${PACK_SIZE} from Lichess…`);
    try {
      const r = await fetch(`/api/chess/puzzles?n=${PACK}`, { headers: headers(), credentials: 'same-origin' }).catch(() => {
        throw new Error('I can’t reach my brain right now (no connection?), so no puzzles can be fetched.');
      });
      const j = (await r.json().catch(() => ({}))) as { puzzles?: Puzzle[]; error?: string };
      if (!r.ok || !j.puzzles) throw new Error(j.error || `my brain answered ${r.status}`);
      const known = new Set(book.pack.map((x) => x.id));
      const fit = j.puzzles.filter((x) => !known.has(x.id) && puzzleStart(x));
      book = { ...book, pack: [...book.pack.filter((x) => !(x.id in book.done)), ...fit].slice(-200) };
      save(book);
      caption(`${fit.length} puzzles kept on this phone: they work with no signal.`);
    } catch (e) {
      caption(sayError(e, 'fetch the puzzles'));
    } finally {
      puzzlesState.fetching = false;
      paintLine();
      keys();
    }
  };

  /** Lichess's puzzle of the day (about 1 KB, on his tap): kept with the pack and set up at once. */
  const getDaily = async () => {
    if ((onMobileData() || netUnknown()) && !secondTap('chess:daily')) return caption(onMobileData() ? 'You’re on mobile data: tap again to fetch today’s puzzle now (about 1 KB), or wait for Wi-Fi.' : unknownNet('about 1 KB'));
    puzzlesState.fetching = true;
    keys();
    caption('Fetching today’s puzzle from Lichess…');
    try {
      const r = await fetch('/api/chess/puzzles/daily', { headers: headers(), credentials: 'same-origin' }).catch(() => {
        throw new Error('I can’t reach my brain right now (no connection?), so today’s puzzle can’t be fetched.');
      });
      const j = (await r.json().catch(() => ({}))) as { puzzle?: Puzzle; error?: string };
      if (!r.ok || !j.puzzle || !puzzleStart(j.puzzle)) throw new Error(j.error || `my brain answered ${r.status}`);
      const d = j.puzzle;
      if (d.id in book.done) {
        puzzlesState.fetching = false;
        keys();
        return caption(`You’ve done today’s puzzle already${book.done[d.id] ? ', and solved it' : ''}. Another one comes tomorrow.`);
      }
      book = { ...book, pack: [d, ...book.pack.filter((x) => x.id !== d.id)] };
      save(book);
      puzzlesState.fetching = false;
      paintLine();
      daily = d.id;
      next('solve');
    } catch (e) {
      puzzlesState.fetching = false;
      caption(sayError(e, 'fetch today’s puzzle'));
      keys();
    }
  };
  let daily = '';

  /** The next puzzle: nearest his rating (solve), or the easiest left (rush); today's puzzle first when he just fetched it. */
  const next = (mode: 'solve' | 'rush') => {
    puzzlesState.mode = mode;
    clear(after);
    const pool = left().sort((a, b) => (mode === 'rush' ? a.rating - b.rating : Math.abs(a.rating - book.rating) - Math.abs(b.rating - book.rating)));
    z = (daily && pool.find((x) => x.id === daily)) || pool[0] || null;
    daily = '';
    p = z ? puzzleStart(z) : null;
    if (!z || !p) {
      z = null;
      p = null;
      if (mode === 'rush') return endRush('No puzzles left on this phone.');
      puzzlesState.mode = 'idle';
      paintLine();
      keys();
      paintBoard();
      return caption('That was the last puzzle on this phone: GET MORE for another pack.');
    }
    k = 0;
    sel = -1;
    last = [];
    missed = false;
    Object.assign(puzzlesState, { id: z.id, step: 0, last: '' });
    caption(`${p.side > 0 ? 'White' : 'Black'} to move: find the best move. Rated about ${z.rating}${z.themes.length ? ` · ${themeWords(z.themes.find((t) => t !== 'short' && t !== 'long' && t !== 'oneMove') ?? z.themes[0]!)}` : ''}.`);
    keys();
    paintBoard();
  };

  const tap = (cell: number) => {
    if (!z || !p || k % 2) return;
    const sq = sqOfCell(cell);
    const moves = legal(p);
    if (sel >= 0) {
      const to = moves.filter((m) => sq64(mFrom(m)) === sel && sq64(mTo(m)) === sq);
      // (a promotion: the solution's piece if it is one of them, else a queen)
      const m = to.find((x) => moveOfUci(p!, z!.solution[k] ?? '') === x) ?? to.find((x) => mPromo(x) === 5) ?? to[0];
      if (m !== undefined) return play(m);
    }
    sel = moves.some((m) => sq64(mFrom(m)) === sq) ? sq : -1;
    paintBoard();
  };

  const play = (m: number) => {
    if (!z || !p) return;
    const v = judge(p, z, k, m);
    sel = -1;
    puzzlesState.last = v;
    if (v === 'wrong') {
      if (!missed) mark(false);
      missed = true;
      if (puzzlesState.mode === 'rush') {
        puzzlesState.rush.lives--;
        if (puzzlesState.rush.lives <= 0) return endRush('Three misses: the rush is over.');
        caption(`Not that one: ${puzzlesState.rush.lives} ${puzzlesState.rush.lives === 1 ? 'life' : 'lives'} left.`);
        return next('rush');
      }
      caption('Not that one. Try again, or SHOW ME.');
      clear(after, button('SHOW ME', () => showMe()), button('NEXT PUZZLE', () => next('solve')));
      return paintBoard();
    }
    make(p, m);
    last = [sq64(mFrom(m)), sq64(mTo(m))];
    k++;
    if (v === 'solved') return solved();
    // his move was right: the reply is played for him
    const reply = moveOfUci(p, z.solution[k] ?? '');
    caption('Right. Keep going.');
    paintBoard();
    window.setTimeout(() => {
      if (!z || !p || reply < 0) return;
      make(p, reply);
      last = [sq64(mFrom(reply)), sq64(mTo(reply))];
      k++;
      puzzlesState.step = k;
      caption('Your move.');
      paintBoard();
    }, 450);
  };

  const mark = (ok: boolean) => {
    if (!z) return;
    book = { ...book, done: { ...book.done, [z.id]: ok ? 1 : 0 }, rating: puzzleRating(book.rating, z.rating, ok, book.tried), solved: book.solved + (ok ? 1 : 0), tried: book.tried + 1 };
    save(book);
    paintLine();
    io.onResult?.({ z, solved: ok, rating: book.rating, rush: puzzlesState.mode === 'rush' });
  };
  const solved = () => {
    if (!missed) mark(true);
    puzzlesState.last = 'solved';
    if (puzzlesState.mode === 'rush') {
      puzzlesState.rush.solved++;
      caption(`Solved: ${puzzlesState.rush.solved} in this rush.`);
      paintBoard();
      return void window.setTimeout(() => puzzlesState.mode === 'rush' && next('rush'), 400);
    }
    caption(missed ? 'Solved, after a miss: it counts as a miss for your rating.' : `Solved. Your puzzle rating is about ${book.rating}.`);
    clear(after, button('NEXT PUZZLE', () => next('solve'), 'on'));
    z = null;
    puzzlesState.mode = 'idle';
    keys();
    paintBoard();
  };
  const showMe = () => {
    if (!z || !p) return;
    clear(after, button('NEXT PUZZLE', () => next('solve'), 'on'));
    while (k < z.solution.length) {
      const m = moveOfUci(p, z.solution[k]!);
      if (m < 0) break;
      make(p, m);
      last = [sq64(mFrom(m)), sq64(mTo(m))];
      k++;
    }
    caption(`The answer: ${z.solution.join(' ')}.`);
    z = null;
    // (the puzzle is over: SOLVE, PUZZLE RUSH and GET MORE come back)
    puzzlesState.mode = 'idle';
    keys();
    paintBoard();
  };

  const rush = () => {
    puzzlesState.rush = { solved: 0, lives: 3, best: book.rushBest, over: false };
    rushEnds = Date.now() + RUSH_MS;
    window.clearInterval(rushTimer);
    rushTimer = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((rushEnds - Date.now()) / 1000));
      line.textContent = `RUSH · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${puzzlesState.rush.solved} solved · ${'♥'.repeat(Math.max(0, puzzlesState.rush.lives))}`;
      if (s <= 0) endRush('Time.');
    }, 250);
    next('rush');
  };
  const endRush = (why: string) => {
    window.clearInterval(rushTimer);
    const n = puzzlesState.rush.solved;
    const best = n > book.rushBest;
    if (best) {
      book = { ...book, rushBest: n };
      save(book);
    }
    Object.assign(puzzlesState.rush, { over: true, best: book.rushBest });
    puzzlesState.mode = 'idle';
    z = null;
    caption(`${why} ${n} solved${best ? ': a new best!' : `. Your best is ${book.rushBest}.`}`);
    paintLine();
    keys();
    paintBoard();
  };
  const end = () => {
    if (puzzlesState.mode === 'rush') return endRush('Stopped.');
    puzzlesState.mode = 'idle';
    z = null;
    p = null;
    clear(after);
    caption('');
    paintLine();
    keys();
    paintBoard();
  };

  paintLine();
  keys();
  // (a puzzle to try again, from the CHESS app's library: set up at once, even one done before)
  if (io.start && puzzleStart(io.start)) {
    const again = io.start;
    const { [again.id]: _was, ...rest } = book.done;
    book = { ...book, done: rest, pack: [again, ...book.pack.filter((x) => x.id !== again.id)] };
    daily = again.id;
    next('solve');
  }
  return el;
}
