/**
 * THE GAME FRAME (PLAY & MAKE lane): what every game kind's board stands in, inside the kit app's one scroll area.
 *   - a bar along the top: the live score, the best kept on this phone, the run of wins (streak), PAUSE and NEW;
 *   - the stage, where the board draws itself (DOM grids, or a canvas for the real-time kinds, at the phone's frame rate);
 *   - the board's own keys under it, every one 44 pt;
 *   - PAUSE hides the board (no peeking) and the game is kept on the phone after every move, so a reload, a call or a
 *     locked phone comes back to the same game, paused, with RESUME;
 *   - the end card: won or not, the score, a new best said plainly, and PLAY AGAIN.
 * Kept under ghosty.app.<id>.play: { best, streak, bestStreak, played, won, save }. Every class is al-, every colour a token.
 */
import { h, clear } from '../../../core/dom';
import { key } from '../../../ui/machine';
import type { KitApp } from '../../../ui/appkit';
import { freshSeed, daySeed } from '../../../../../../packages/shared/src/applib/games/rng';

export type Opts = Record<string, number | string | boolean | string[]>;
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface PlayKey {
  word: string;
  run: () => void;
  label?: string;
  /** A key that is on (a mode, such as notes or flag). */
  on?: boolean;
}

export interface Play {
  /** The board's own area. */
  stage: HTMLElement;
  opts: Opts;
  id: string;
  /** The game kept from before a reload (null for a new game). */
  resume: unknown;
  /** Keep the game in progress on the phone (call after every move). */
  keep(state: unknown): void;
  /** The live score, and an optional line beside it ("12 mines left"). */
  score(n: number, line?: string): void;
  /** The game is over. lower: a smaller score is better (reaction times). */
  end(o: { won: boolean; score: number; words?: string; lower?: boolean }): void;
  notice(words: string, tone?: 'ok' | 'warn'): void;
  /** The board's keys under the stage. */
  keys(list: PlayKey[]): void;
  /** Seconds played (stops while paused). */
  secs(): number;
  paused(): boolean;
  /** Told when paused or resumed. */
  onPause(fn: (paused: boolean) => void): void;
  /** A seed: today's when daily, otherwise a fresh one. */
  seed(daily?: boolean): number;
  /** A world token's value, for a canvas ("--g-accent"). */
  token(name: string): string;
}

export type Board = (p: Play) => void | (() => void);

interface Kept {
  best?: number;
  streak: number;
  bestStreak: number;
  played: number;
  won: number;
  save?: { state: unknown; secs: number; seed?: number };
}

/** For the spec and the console: each game's live numbers. */
export const playState: Record<string, { kind: string; score: number; paused: boolean; over: boolean; best: number | null; streak: number; line: string }> = {};

const storeKey = (id: string) => `ghosty.app.${id}.play`;
function load(id: string): Kept {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(id)) ?? 'null') as Kept | null;
    if (v && typeof v === 'object') return { ...{ streak: 0, bestStreak: 0, played: 0, won: 0 }, ...v } as Kept;
  } catch {
    /* a private window: start fresh */
  }
  return { streak: 0, bestStreak: 0, played: 0, won: 0 };
}
function save(id: string, k: Kept): void {
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(k));
  } catch {
    /* a full phone: play goes on, only not kept */
  }
}

export const fmtNum = (n: number): string => Math.round(n).toLocaleString('en-GB');
export const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A swipe on an element (pointer events, so mouse and touch), with the arrow keys too while it is on screen. */
export function swipe(el: HTMLElement, fn: (d: Dir) => void): () => void {
  let x0 = 0;
  let y0 = 0;
  let down = false;
  el.style.touchAction = 'none';
  const start = (e: PointerEvent) => {
    down = true;
    x0 = e.clientX;
    y0 = e.clientY;
  };
  const up = (e: PointerEvent) => {
    if (!down) return;
    down = false;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };
  const keyd = (e: KeyboardEvent) => {
    const d = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, Dir>)[e.key];
    if (d && el.isConnected) {
      e.preventDefault();
      fn(d);
    }
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', up);
  window.addEventListener('keydown', keyd);
  return () => window.removeEventListener('keydown', keyd);
}

/** A grid of square cells that fills the stage's width (cells are buttons, so they are reachable and tappable). */
export function grid(cols: number, cls: string, cells: number, make: (i: number) => HTMLElement): HTMLElement {
  const g = h(`div.al-ggrid.${cls}` as 'div', { style: `grid-template-columns: repeat(${cols}, minmax(0, 1fr))`, role: 'grid' });
  for (let i = 0; i < cells; i++) g.append(make(i));
  return g;
}

/** Draw the frame into the kit app's scroll area and start the board. Returns the clean-up. */
export function frame(k: KitApp, id: string, kind: string, opts: Opts, board: Board): () => void {
  let kept = load(id);
  const st = (playState[id] = { kind, score: 0, paused: false as boolean, over: false as boolean, best: kept.best ?? null, streak: kept.streak, line: '' });
  const scoreEl = h('b.al-gnum', '0');
  const lineEl = h('small.al-gline', '');
  const bestEl = h('span.al-gstat', '');
  const pauseKey = key('Pause', () => setPaused(!st.paused), { label: 'Pause the game' });
  const newKey = key('New', () => restart(), { label: 'Start a new game' });
  const bar = h('div.al-gbar', h('div.al-gscore', h('span.al-glabel', 'Score'), scoreEl, lineEl), bestEl, h('span.ak-sp'), pauseKey, newKey);
  const stage = h('div.al-gstage');
  const keysEl = h('div.al-gkeys');
  const cover = h('div.al-gcover', { hidden: true });
  const wrap = h('div.al-game', { dataset: { kind } }, bar, h('div.al-gstagewrap', stage, cover), keysEl);
  clear(k.body, wrap);

  let elapsed = 0;
  let startedAt = performance.now();
  let pauseFns: ((p: boolean) => void)[] = [];
  let stop: void | (() => void);
  let seedNow = 0;

  const showBest = () => {
    const parts = [];
    if (kept.best != null) parts.push(`Best ${fmtNum(kept.best)}`);
    if (kept.streak > 0) parts.push(`Streak ${kept.streak}`);
    bestEl.textContent = parts.join(' · ');
  };
  const secs = () => (st.paused || st.over ? elapsed : elapsed + (performance.now() - startedAt) / 1000);

  function setPaused(p: boolean, words?: string): void {
    if (st.over || p === st.paused) return;
    if (p) {
      elapsed = secs();
      st.paused = true;
      clear(cover, h('p.al-gcovertext', words ?? 'Paused.'), key('Resume', () => setPaused(false), { kind: 'fill' }));
      cover.hidden = false;
      stage.classList.add('al-ghide');
    } else {
      startedAt = performance.now();
      st.paused = false;
      cover.hidden = true;
      stage.classList.remove('al-ghide');
    }
    pauseKey.querySelector('span')!.textContent = st.paused ? 'Resume' : 'Pause';
    pauseFns.forEach((f) => f(st.paused));
  }

  function begin(resume: unknown, resumeSecs: number): void {
    if (typeof stop === 'function') stop();
    pauseFns = [];
    st.over = false;
    st.paused = false;
    st.score = 0;
    cover.hidden = true;
    stage.classList.remove('al-ghide');
    clear(stage);
    clear(keysEl);
    keysEl.hidden = true;
    scoreEl.textContent = '0';
    lineEl.textContent = st.line = '';
    elapsed = resumeSecs;
    startedAt = performance.now();
    const play: Play = {
      stage,
      opts,
      id,
      resume,
      keep(state) {
        if (st.over) return;
        kept.save = { state, secs: Math.round(secs()), seed: seedNow };
        save(id, kept);
      },
      score(n, line) {
        if (n !== st.score || !scoreEl.textContent) scoreEl.textContent = fmtNum(n);
        st.score = n;
        if (line !== undefined && line !== st.line) lineEl.textContent = st.line = line;
      },
      end(o) {
        if (st.over) return;
        elapsed = secs();
        st.over = true;
        kept = load(id);
        delete kept.save;
        kept.played++;
        const better = o.lower ? kept.best == null || o.score < kept.best : kept.best == null || o.score > kept.best;
        const isBest = o.won && o.score > 0 && better;
        if (isBest) kept.best = o.score;
        if (o.won) {
          kept.won++;
          kept.streak++;
          kept.bestStreak = Math.max(kept.bestStreak, kept.streak);
        } else kept.streak = 0;
        save(id, kept);
        st.best = kept.best ?? null;
        st.streak = kept.streak;
        showBest();
        const head = o.words ?? (o.won ? 'Well played.' : 'Game over.');
        const tail = isBest ? `A new best: ${fmtNum(o.score)}.` : o.won ? `Score ${fmtNum(o.score)}.` : '';
        clear(cover, h('div.al-gend', h('b.al-gendhead', head), tail ? h('p.al-gcovertext', tail) : null), key('Play again', () => restart(), { kind: 'fill' }));
        cover.hidden = false;
        k.notice(isBest ? `A new best in ${kind === 'reaction' ? 'reaction time' : 'score'}.` : head, { tone: o.won ? 'ok' : undefined });
      },
      notice: (w, tone) => k.notice(w, { tone }),
      keys(list) {
        clear(keysEl, ...list.map((x) => {
          const b = key(x.word, () => x.run(), { label: x.label ?? x.word });
          if (x.on) b.setAttribute('aria-pressed', 'true');
          return b;
        }));
        keysEl.hidden = !list.length;
      },
      secs,
      paused: () => st.paused,
      onPause: (fn) => void pauseFns.push(fn),
      seed: (daily) => (seedNow = daily ? daySeed() : freshSeed()),
      token: (name) => getComputedStyle(stage).getPropertyValue(name).trim(),
    };
    stop = board(play);
  }

  function restart(): void {
    kept = load(id);
    delete kept.save;
    save(id, kept);
    begin(null, 0);
  }

  const onHide = () => document.visibilityState === 'hidden' && setPaused(true, 'Paused while away. Your game is kept.');
  document.addEventListener('visibilitychange', onHide);
  showBest();
  if (kept.save) {
    begin(kept.save.state, kept.save.secs);
    setPaused(true, 'Your game is kept, just as you left it.');
  } else begin(null, 0);

  return () => {
    document.removeEventListener('visibilitychange', onHide);
    if (typeof stop === 'function') stop();
  };
}
