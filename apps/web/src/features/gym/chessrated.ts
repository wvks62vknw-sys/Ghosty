/**
 * RATED CHESS in the GYM (BRIEF-REST-B part 1): he plays a real engine (Stockfish, on this phone, gym/chessengine.ts) at a level
 * of known Elo, and a Glicko-2 rating follows from the results (gym/chessrate.ts); Ghosty's own chess (his learned evaluator in
 * the GYM's worker) plays the same levels, so he has a rating too. Under the chess game, in the section the GYM page keeps for
 * ideas: both ratings with their uncertainty ("You: about 1180 · Me: about 1420 · ±80"), the trend and the next level to try;
 * RATED GAME (you are White; a resign counts as a loss; a game played with a hint is not rated), HINT, the CHECK after a game in
 * plain words ("move 23 lost a rook"), and RATE ME (Ghosty plays the engine, one game with each colour).
 * Nothing about other people, nothing online: the engine runs here. State for the specs at window.__ghosty.chessRated.
 */
import { clear, h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { chessEngine, closeChessEngine } from '../../gym/chessengine';
import { cellOf, chessFrame, fromFen, fromPageMove, inCheck, legal, make, mFrom, mPromo, mTo, type Pos, posState, san, sq64, sqOfCell, START, status, STATUS_WORDS, toFen, uci } from '../../gym/chessboard';
import type { Frame } from '../../gym/core';
import { hintWords, reviewGame, reviewWords, type Score, standingWords } from '../../gym/chessreview';
import { LEVELS, levelById, levelWords, loadBook, nextWords, ratingWords, recordGame, saveBook, suggestLevel, trendWords, type RateBook, type Who } from '../../gym/chessrate';

/** What the rated chess is doing, for the specs (window.__ghosty.chessRated). */
export const ratedState = {
  mode: 'idle' as 'idle' | 'you' | 'me',
  level: 2,
  plies: 0,
  sans: [] as string[],
  over: '',
  thinking: false,
  hinted: false,
  hint: '',
  review: [] as string[],
  summary: '',
  words: '',
  next: '',
  engine: '' as '' | 'asked' | 'error',
  error: '',
  games: { you: 0, me: 0 },
};

/** The card's line for the chess game in the list ('' before any rated game). */
export function ratedCardLine(): string {
  const b = loadBook();
  return b.you.games || b.me.games ? ratingWords(b) : '';
}

export interface RatedIO {
  renderFrame(f: Frame | null, onCell?: (i: number) => void): HTMLElement;
  /** The GYM worker's move for a board (page codes), at Ghosty's own level. */
  ask(m: Record<string, unknown>): Promise<{ move?: number | null; error?: string }>;
  /** The ratings changed: repaint the card. */
  changed(): void;
}

interface Live {
  p: Pos;
  sans: string[];
  fens: string[];
  sel: number;
  last: number[];
  level: number;
  hinted: boolean;
  over: string;
  choices: number[] | null;
}

export function ratedSection(io: RatedIO): { el: HTMLElement; line(): string; afterLevelUp(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.chessRated = ratedState;
  let book: RateBook = loadBook();
  let level = suggestLevel(book).id;
  let g: Live | null = null;
  /** Bumped to stop a game or a run that is under way when another starts or the page is left. */
  let token = 0;
  let busy = false;

  const title = h('b', 'Rated chess');
  const ratings = h('span.gymrateline.crline', { 'aria-live': 'polite' });
  const next = h('small.crnext');
  const levelLine = h('span.crlevel', { 'aria-live': 'polite' });
  const lessBtn = button('−', () => pick(level - 1));
  lessBtn.setAttribute('aria-label', 'An easier level');
  const moreBtn = button('+', () => pick(level + 1));
  moreBtn.setAttribute('aria-label', 'A harder level');
  const board = h('div.gymboard.crboard');
  const say = h('p.note.crsay', { 'aria-live': 'polite' });
  const extra = h('div.row.wrap.crextra');
  const review = h('div.crreview', { 'aria-live': 'polite' });
  const actions = h('div.row.wrap.cractions');
  const fine = h('small.crfine', 'Stockfish runs on this phone; its Elo labels are approximate, and so is the rating. A game with a hint is not rated.');
  const el = h('div.gymidea.chessrate', { dataset: { rated: '1' } }, title, ratings, next, h('div.row.crpick', lessBtn, levelLine, moreBtn), actions, board, say, extra, review, fine);

  const paintCard = (notify = true) => {
    ratedState.words = ratingWords(book);
    ratedState.next = nextWords(book, Date.now());
    ratedState.games = { you: book.you.games, me: book.me.games };
    ratings.textContent = ratedState.words;
    const t = book.you.games ? trendWords(book.you, Date.now()) : '';
    next.textContent = `${t ? `${t[0]!.toUpperCase()}${t.slice(1)}. ` : ''}${book.you.games ? '' : 'Play a rated game to get your first rating. '}Next to try: ${levelWords(suggestLevel(book))}.`;
    levelLine.textContent = levelWords(levelById(level));
    ratedState.level = level;
    lessBtn.disabled = level <= 1 || !!g;
    moreBtn.disabled = level >= LEVELS.length || !!g;
    if (notify) io.changed();
  };
  const pick = (id: number) => {
    level = levelById(id).id;
    paintCard();
  };

  const stop = () => {
    token++;
    busy = false;
    ratedState.thinking = false;
  };
  const caption = (t: string) => {
    say.textContent = t;
  };

  // ---------------------------------------------------------------------------------------------------- the board
  const paintBoard = (cap: string) => {
    if (!g) return;
    const marks: Record<number, string> = {};
    for (const s of g.last) marks[cellOf(s)] = 'new';
    if (inCheck(g.p)) marks[cellOf(sq64(g.p.kings[g.p.side > 0 ? 0 : 1]))] = 'chk';
    if (g.sel >= 0) {
      marks[cellOf(g.sel)] = 'sel';
      for (const m of legal(g.p)) if (sq64(mFrom(m)) === g.sel) marks[cellOf(sq64(mTo(m)))] = 'tgt';
    }
    const mine = !g.over && !ratedState.thinking && g.p.side > 0 && ratedState.mode === 'you';
    const promo = g.choices && mine ? h('div.row.wrap', ...g.choices.map((m) => button(['', '', 'KNIGHT', 'BISHOP', 'ROOK', 'QUEEN'][mPromo(m)]!, () => play(m), 'on')).reverse()) : null;
    clear(board, io.renderFrame(chessFrame(g.p, cap, marks), mine ? (i) => tap(i) : undefined), promo);
    caption(cap);
    ratedState.plies = g.sans.length;
    ratedState.sans = g.sans.slice();
    ratedState.over = g.over;
  };

  const buttons = () => {
    const live = !!g && !g.over && ratedState.mode === 'you';
    const done = !!g && !!g.over && ratedState.mode === 'you';
    clear(
      actions,
      ...(live ? [button('HINT', () => void hint()), button('RESIGN', () => finish(0, 'You resigned.'))] : [button('RATED GAME', () => void start(), 'on'), button('RATE ME', () => void rateMe(), '')]),
      ...(done ? [button('CHECK MY GAME', () => void check())] : []),
    );
    for (const b of actions.querySelectorAll('button')) (b as HTMLButtonElement).disabled = busy && b.textContent !== 'RESIGN' && b.textContent !== 'HINT';
    lessBtn.disabled = level <= 1 || live;
    moreBtn.disabled = level >= LEVELS.length || live;
  };

  // ---------------------------------------------------------------------------------------------------- his game
  const start = async () => {
    stop();
    g = { p: fromFen(START), sans: [], fens: [START], sel: -1, last: [], level, hinted: false, over: '', choices: null };
    Object.assign(ratedState, { mode: 'you', hinted: false, hint: '', review: [], summary: '', error: '', over: '', sans: [], plies: 0 });
    clear(review);
    clear(extra);
    // the engine starts now, while he reads: it is a 1.9 MB download once, then kept by the browser
    ratedState.engine = 'asked';
    void chessEngine().best(START, 10).catch((e: unknown) => failEngine(e));
    buttons();
    paintBoard(`${levelWords(levelById(level))}. You are White: tap a piece, then where it goes.`);
  };
  const failEngine = (e: unknown) => {
    ratedState.engine = 'error';
    ratedState.error = (e as Error)?.message ?? 'the engine did not start';
    caption(`The chess engine could not start (${ratedState.error}). Try again in a moment.`);
    closeChessEngine();
    clear(extra, button('TRY AGAIN', () => {
      clear(extra);
      if (g && !g.over && g.p.side < 0) void reply();
      else void start();
    }));
  };

  const tap = (cell: number) => {
    if (!g || g.over || ratedState.thinking || g.p.side < 0) return;
    const sq = sqOfCell(cell);
    const moves = legal(g.p);
    const from = g.sel;
    if (from >= 0) {
      const to = moves.filter((m) => sq64(mFrom(m)) === from && sq64(mTo(m)) === sq);
      if (to.length > 1) {
        g.choices = to;
        return paintBoard('Your pawn is promoted: pick a piece.');
      }
      if (to.length === 1) return play(to[0]!);
    }
    g.choices = null;
    if (moves.some((m) => sq64(mFrom(m)) === sq)) {
      g.sel = sq;
      return paintBoard('Tap where it goes.');
    }
    g.sel = -1;
    paintBoard(inCheck(g.p) ? 'You are in check: pick a move that gets out of it.' : 'Pick one of your pieces that can move.');
  };

  const apply = (m: number) => {
    const live = g!;
    live.sans.push(san(live.p, m));
    live.last = [sq64(mFrom(m)), sq64(mTo(m))];
    make(live.p, m);
    live.fens.push(toFen(live.p));
    live.sel = -1;
    live.choices = null;
    const st = status(live.p);
    if (st) live.over = st;
  };

  const play = (m: number) => {
    if (!g || g.over) return;
    apply(m);
    if (g.over) return ended();
    void reply();
  };

  /** The engine's answer. */
  const reply = async () => {
    const live = g!;
    const mine = token;
    ratedState.thinking = true;
    buttons();
    paintBoard(`${live.sans.at(-1)}. Thinking…`);
    try {
      const r = await chessEngine().play(toFen(live.p), levelById(live.level));
      if (mine !== token || g !== live) return;
      const m = (r && legal(live.p).find((x) => uci(x) === r.move)) ?? legal(live.p)[0]!;
      ratedState.thinking = false;
      apply(m);
      if (live.over) return ended();
      buttons();
      paintBoard(`I played ${live.sans.at(-1)}. Your move.`);
    } catch (e) {
      if (mine !== token) return;
      ratedState.thinking = false;
      failEngine(e);
      buttons();
    }
  };

  /** The game is over by the rules: whose win, or a draw. */
  const ended = () => {
    const live = g!;
    const st = live.over;
    if (st === 'mate') return finish(live.p.side < 0 ? 1 : 0, `Checkmate: ${live.p.side < 0 ? 'you win' : 'I win'}.`);
    finish(0.5, `${STATUS_WORDS[st]![0]!.toUpperCase()}${STATUS_WORDS[st]!.slice(1)}.`);
  };

  /** Record the result (unless a hint was used) and show the card. */
  const finish = (score: number, why: string) => {
    if (!g) return;
    const live = g;
    if (!live.over) live.over = score === 0 ? 'resigned' : 'over';
    stop();
    const rated = !live.hinted;
    if (rated) {
      book = recordGame(book, 'you', live.level, score, Date.now(), live.sans.length);
      saveBook(book);
    }
    buttons();
    paintBoard(`${why} ${rated ? `Rating now: ${ratingWords(book)}.` : 'You used a hint, so this game is not rated.'}`);
    paintCard();
    buttons();
  };

  const hint = async () => {
    if (!g || g.over || ratedState.thinking || g.p.side < 0) return;
    const live = g;
    live.hinted = true;
    ratedState.hinted = true;
    ratedState.thinking = true;
    paintBoard('Looking for a good move…');
    try {
      const r = await chessEngine().best(toFen(live.p), 500);
      ratedState.thinking = false;
      if (g !== live) return;
      const m = r.move ? legal(live.p).find((x) => uci(x) === r.move) : undefined;
      ratedState.hint = m ? `${hintWords(san(live.p, m), r.score)} (This game is no longer rated.)` : 'There is no move to suggest.';
      if (m) live.last = [sq64(mFrom(m)), sq64(mTo(m))];
      paintBoard(ratedState.hint);
    } catch (e) {
      ratedState.thinking = false;
      failEngine(e);
    }
  };

  /** The check after a game: the engine looks at every position for a moment, and the moves that cost him something are named. */
  const check = async () => {
    if (!g || !g.over) return;
    const live = g;
    const mine = token;
    busy = true;
    buttons();
    const scores: Score[] = [];
    try {
      const fens = live.fens.slice(0, 121);
      for (let i = 0; i < fens.length; i++) {
        if (mine !== token) return;
        caption(`Checking your game: move ${Math.floor(i / 2) + 1} of ${Math.ceil((fens.length - 1) / 2)}…`);
        // the last position of a mate has no move: the side to move has lost
        scores.push(i === fens.length - 1 && live.over === 'mate' ? { mate: 0 } : (await chessEngine().best(fens[i]!, 200)).score);
      }
      const moments = reviewGame(live.sans.slice(0, fens.length - 1), scores);
      const r = reviewWords(moments, true);
      ratedState.review = r.lines;
      ratedState.summary = r.summary;
      const last = scores.at(-1);
      clear(review, h('b', 'Your game, checked'), h('p', r.summary), ...(r.lines.length ? [h('ul', ...r.lines.map((l) => h('li', l)))] : []), h('small', last && live.over !== 'mate' ? `At the end, ${standingWords(last)}.` : 'The engine looked at each position for a fifth of a second.'));
      caption('Here is what the engine saw.');
    } catch (e) {
      failEngine(e);
    } finally {
      busy = false;
      buttons();
    }
  };

  // ---------------------------------------------------------------------------------------------------- Ghosty's game
  /** One game of Ghosty's own chess against the engine at `lv`; his score (1, ½, 0). */
  const ghostyGame = async (white: boolean, lv: number, mine: number): Promise<number | null> => {
    const p = fromFen(START);
    let plies = 0;
    while (plies < 150) {
      if (mine !== token) return null;
      const st = status(p);
      if (st) return st === 'mate' ? ((p.side > 0) === white ? 0 : 1) : 0.5;
      let m = -1;
      if ((p.side > 0) === white) {
        const r = await io.ask({ gym: 'move', id: 'chess', board: posState(p) });
        if (r.error || r.move == null) return null;
        m = fromPageMove(p, r.move);
        if (m < 0) m = legal(p)[0]!;
      } else {
        const r = await chessEngine().play(toFen(p), levelById(lv));
        m = (r && legal(p).find((x) => uci(x) === r.move)) ?? legal(p)[0]!;
      }
      make(p, m);
      plies++;
    }
    // a game that goes on and on is judged by the engine, as engine testers do
    const e = await chessEngine().best(toFen(p), 200);
    const cp = typeof e.score.mate === 'number' ? Math.sign(e.score.mate) * 3000 : (e.score.cp ?? 0);
    const mover = (p.side > 0) === white ? cp : -cp;
    return mover >= 300 ? 1 : mover <= -300 ? 0 : 0.5;
  };

  /** RATE ME: Ghosty plays the engine, once with each colour, at the level his rating suggests. */
  const rateMe = async (games = 2) => {
    if (busy) return;
    stop();
    const mine = ++token;
    busy = true;
    g = null;
    ratedState.mode = 'me';
    clear(board);
    clear(review);
    buttons();
    const lv = suggestLevel(book, 'me').id;
    try {
      for (let k = 0; k < games; k++) {
        caption(`I am playing the engine at ${levelWords(levelById(lv))}: game ${k + 1} of ${games}…`);
        const s = await ghostyGame(k % 2 === 0, lv, mine);
        if (s == null || mine !== token) return;
        const who: Who = 'me';
        book = recordGame(book, who, lv, s, Date.now());
        saveBook(book);
        paintCard();
      }
      caption(`I played ${games} games against the engine. ${ratingWords(book)}.`);
      toast(`Rated against the engine: ${ratingWords(book)}`, 'ok');
    } catch (e) {
      failEngine(e);
    } finally {
      if (mine === token) {
        busy = false;
        ratedState.mode = 'idle';
        buttons();
      }
    }
  };

  paintCard(false);
  buttons();
  caption('Play a rated game against a real engine, or let me play it.');
  return {
    el,
    line: () => ratedCardLine(),
    // a level passed in the GYM: one game against the engine, quietly, so the rating keeps up with the training
    afterLevelUp: () => {
      if (!busy && !g) void rateMe(1);
    },
  };
}

/** Let go of the engine when the GYM is left. */
export function leaveRated(): void {
  closeChessEngine();
}
