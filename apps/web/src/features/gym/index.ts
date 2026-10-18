/**
 * GYM tab — Ghosty teaches himself by playing. GAMES: a card per game (level, mastery, a sparkline,
 * TRAINING / PAUSED / MASTERED). Tapping a card opens it in the GAME panel: what he is learning, the
 * status line, TRAIN (or PAUSE), WATCH (he plays, step by step), PLAY HIM (tic-tac-toe and Connect 4 on
 * the board; Code Breaker and Word Guess: you pick what he must find), RESET, the mastery graph (one line
 * per level, measured against ground truth) and a picture of what he knows.
 *
 * Training runs in a Web Worker (gym/worker.ts, inside an instance of the bundled textures worker), one
 * game at a time; it pauses while the app is hidden and its state is kept in IndexedDB (store.ts), so it
 * carries on next time. The page imports only the games' descriptions (gym/meta.ts) and the two board
 * files: the engines live in the worker's bundle. State for specs at window.__ghosty.gym.
 */
import { clear, h, svgEl } from '../../core/dom';
import { onFrame } from '../../engine/scheduler';
import { canPlay, frameOf as c4Frame, play as c4Play, posFromBoard, winnerOf } from '../../gym/c4board';
import type { Frame } from '../../gym/core';
import { type GameMeta, META as GAMES, metaById as gameById } from '../../gym/meta';
import { current, type GymRecord, statusLine } from '../../gym/session';
import { frameOf as tttFrame, winner as tttWinner } from '../../gym/tttboard';
import type { GymOut } from '../../gym/worker';
import { go, type TabDef } from '../../shell/tabs';
import { button, panel, spark, toast } from '../../ui/components';
import { page } from '../../ui/page';
import * as store from './store';

/** What the tab shows, for tests and the console (window.__ghosty.gym). */
export const gymState = {
  open: '',
  training: '' as string,
  cards: 0,
  saves: 0,
  progress: 0,
  watching: false,
  frames: 0,
  play: { game: '', board: [] as number[], over: '', thinking: false },
  recs: {} as Record<string, { level: number; mastery: number; units: number; mastered: boolean }>,
  error: '',
  /** The last few things the owner (or the app) did here, newest last — for specs reading what happened. */
  log: [] as string[],
};

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.gym = gymState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

/** Draw a game picture: a grid of cells, bars and lines, and its caption. `onCell` makes the grid tappable. */
export function renderFrame(f: Frame | null, onCell?: (i: number) => void): HTMLElement {
  const box = h('div.gymframe');
  if (!f) return box;
  if (f.grid) {
    // Small boards get big cells (finger-sized), big mazes fit the phone's width.
    const cell = f.grid.w <= 3 ? 80 : f.grid.w <= 7 ? 52 : 40;
    const g = h('div.gymgrid', { style: { gridTemplateColumns: `repeat(${f.grid.w}, minmax(0, 1fr))`, maxWidth: `${Math.min(360, f.grid.w * cell)}px` }, role: onCell ? 'grid' : 'img', 'aria-label': f.caption });
    if (f.grid.w > 9) g.classList.add('small');
    f.grid.cells.forEach((c, i) => {
      const el = h(onCell ? 'button' : 'div', { type: onCell ? 'button' : undefined, class: 'gymcell' }, c.t ?? '');
      if (c.c) {
        if (/^(hsl|#|rgb)/.test(c.c)) el.style.background = c.c;
        else for (const k of c.c.split(' ')) el.classList.add(k);
      }
      if (onCell) el.addEventListener('click', () => onCell(i));
      g.append(el);
    });
    box.append(g);
  }
  if (f.bars?.length) box.append(h('div.gymbars', ...f.bars.map(([k, frac, t]) => h('div.bar', h('span', k), h('div.gauge', h('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` } })), h('b', t)))));
  if (f.lines?.length) box.append(h('div.gymlines', ...f.lines.map((l) => h('div', l))));
  box.append(h('div.gymcap', f.caption));
  return box;
}

/** The mastery graph: one point per measurement, a dashed line where a level was passed, the bar to reach. */
function graph(rec: GymRecord | null, game: GameMeta): SVGSVGElement {
  const W = 300;
  const H = 96;
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gymgraph', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Mastery over time' });
  const y = (m: number) => H - 4 - m * (H - 10);
  s.append(svgEl('line', { x1: 0, x2: W, y1: y(1), y2: y(1), class: 'gymgrid100' }));
  const pts = rec?.history ?? [];
  if (rec) s.append(svgEl('line', { x1: 0, x2: W, y1: y(game.bar(rec.level)), y2: y(game.bar(rec.level)), class: 'gymgoal' }));
  if (pts.length >= 1) {
    const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W);
    pts.forEach((p, i) => {
      if (i && p.l !== pts[i - 1]!.l) s.append(svgEl('line', { x1: x(i), x2: x(i), y1: 0, y2: H, class: 'gymlevel' }));
    });
    s.append(svgEl('polyline', { points: pts.map((p, i) => `${x(i).toFixed(1)},${y(p.m).toFixed(1)}`).join(' '), class: 'gymline', 'vector-effect': 'non-scaling-stroke' }));
  }
  return s;
}

let opener: ((id?: string) => void) | null = null;
let waiting: string | null | undefined;

/** Open the GYM, optionally on one game (the `open_gym` command). */
export function openGym(id?: string): void {
  go('gym');
  if (opener) opener(id);
  else waiting = id ?? null;
}

export const gymTab: TabDef = {
  id: 'gym',
  title: 'GYM',
  icon: '<path d="M2 9v6M5 7v10M19 7v10M22 9v6"/><path d="M5 12h14"/>',
  scene: 'backdrop',
  blurb: 'he teaches himself · 10 games',
  mount(root) {
    const P = page(root, { tag: 'GYM', sub: 'Ghosty teaches himself by playing · on this phone', leftLabel: 'GAMES', rightLabel: 'GAME', stack: true });
    expose();
    const recs = new Map<string, GymRecord>();
    const views = new Map<string, Frame>();
    let open: GameMeta = GAMES[0]!;
    /** Bumped by RESET: worker messages about a game from before its reset are dropped. */
    const epochs: Record<string, number> = {};
    /** The game whose board shows a finished WATCH (kept until the owner does something else). */
    let held = '';
    let training: string | null = null;
    let resumeOnShow = '';
    let worker: Worker | null = null;
    let req = 0;
    const replies = new Map<number, (m: Extract<GymOut, { gym: 'reply' }>) => void>();

    // ======================= the worker
    const send = (m: unknown) => {
      if (!worker) {
        try {
          worker = new Worker('/textures.worker.js');
          worker.onmessage = (e: MessageEvent) => onWorker(e.data as GymOut);
          worker.onerror = (e) => {
            gymState.error = e.message || 'worker error';
            gymState.log.push(`worker error ${gymState.error}`);
            toast('The gym stopped: training could not run on this phone', 'bad');
            training = null;
            gymState.training = '';
            paint();
          };
        } catch (e) {
          gymState.error = String(e);
          toast('Training cannot run on this phone', 'bad');
          return;
        }
      }
      worker.postMessage(m);
    };
    const ask = (m: Record<string, unknown>) =>
      new Promise<Extract<GymOut, { gym: 'reply' }>>((resolve) => {
        const id = ++req;
        replies.set(id, resolve);
        send({ ...m, req: id, rec: recs.get(String(m.id)) ?? null, epoch: epochs[String(m.id)] ?? 0 });
      });
    const onWorker = (m: GymOut) => {
      if (m.gym === 'reply') {
        replies.get(m.req)?.(m);
        replies.delete(m.req);
        return;
      }
      // Anything about a game from before its RESET is stale.
      if (!current(epochs, m.gym === 'error' ? m.id : m.rec.id, m.epoch)) return;
      if (m.gym === 'error') {
        // Training itself failed in the worker (and stopped there).
        gymState.error = m.message || 'training failed';
        gymState.log.push(`training error ${m.id}: ${gymState.error}`);
        toast(`Training stopped: ${m.message}`, 'bad');
        if (training === m.id) training = null;
        paint();
        return;
      }
      const rec = m.rec;
      const prev = recs.get(rec.id);
      // Progress carries no learner state: keep the last saved one.
      recs.set(rec.id, m.gym === 'save' ? rec : { ...rec, saved: prev?.saved ?? null });
      if (m.gym === 'save') {
        gymState.saves++;
        void store.put(rec);
      } else {
        gymState.progress++;
        views.set(rec.id, m.view);
        if (!m.training && training === rec.id) {
          // The worker stopped (all levels mastered): the page follows.
          gymState.log.push(`stopped ${rec.id}${rec.mastered ? ' (mastered)' : ''}`);
          training = null;
        }
        if (m.event === 'level') toast(`${gameById(rec.id)?.title}: Level ${rec.level - 1} passed — on to Level ${rec.level}`, 'ok');
        if (m.event === 'mastered') toast(`${gameById(rec.id)?.title}: mastered all 10 levels!`, 'ok');
      }
      paint();
    };

    // ======================= GAMES: the cards (made once, updated in place so a tap is never lost to a repaint)
    const cardsP = panel('GAMES', { cls: 'gymgames' });
    const cards = h('div.gymcards');
    cardsP.body.append(cards);
    const cardParts = new Map<string, { b: HTMLButtonElement; small: HTMLElement; spark: HTMLElement; st: HTMLElement; sparkKey: string }>();
    for (const g of GAMES) {
      const small = h('small');
      const sp = h('span.gymspark');
      const st = h('i.gymst');
      const b = h('button.gymcard', { type: 'button', dataset: { game: g.id } }, h('span.gymname', g.title), small, sp, st);
      b.addEventListener('click', () => {
        select(g.id);
        if (matchMedia('(max-width: 899px)').matches) gameP.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      cards.append(b);
      cardParts.set(g.id, { b, small, spark: sp, st, sparkKey: '' });
    }

    // ======================= GAME: the open one
    const gameP = panel('GAME', { cls: 'gymgame' });
    const learns = h('div.gymlearns');
    const status = h('div.gymstatus', { role: 'status', 'aria-live': 'polite' });
    const trainBtn = button('TRAIN', () => toggleTrain(), 'on gymtrain');
    const watchBtn = button('WATCH', () => void watch());
    const playBtn = button('PLAY HIM', () => startPlay());
    let resetArmed = 0;
    const resetBtn = button('RESET', () => reset(), 'warn');
    const graphBox = h('div.gymgraphbox');
    const detail = h('div.note.gymdetail');
    const board = h('div.gymboard');
    const secretIn = h('input', { placeholder: '', 'aria-label': 'Your secret', maxlength: '8', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
    const secretGo = button('GO', () => void watch(secretIn.value.trim()), 'on');
    const secretRow = h('div.keyrow.gymsecret', secretIn, secretGo);
    secretRow.hidden = true;
    gameP.body.append(learns, status, h('div.gymactions', trainBtn, watchBtn, playBtn, resetBtn), graphBox, detail, secretRow, board);
    P.left.append(cardsP.el);
    P.right.append(gameP.el);

    // ======================= painting
    const paintHero = () => {
      const all = GAMES.map((g) => recs.get(g.id));
      const mastered = all.filter((r) => r?.mastered).length;
      const avg = all.reduce((t, r) => t + (r?.mastery ?? 0), 0) / GAMES.length;
      const levels = all.reduce((t, r) => t + (r ? r.level - 1 + (r.mastered ? 1 : 0) : 0), 0);
      P.big.textContent = `${mastered} / ${GAMES.length} MASTERED`;
      // A fixed line: text that changes length here would shift every button below it mid-tap.
      P.sub.textContent = 'Ghosty teaches himself by playing · on this phone';
      P.dials([
        ['MASTERY', avg, `${Math.round(avg * 100)}%`],
        ['LEVELS', levels / (GAMES.length * 10), `${levels}`],
        ['MASTERED', mastered / GAMES.length, `${mastered}`],
      ]);
    };
    const stateOf = (g: GameMeta, r: GymRecord | undefined) => (r?.mastered ? 'MASTERED' : training === g.id ? 'TRAINING' : r?.units ? 'PAUSED' : 'NEW');
    const paintCards = () => {
      for (const g of GAMES) {
        const c = cardParts.get(g.id)!;
        const r = recs.get(g.id);
        const st = stateOf(g, r);
        c.b.classList.toggle('on', g.id === open.id);
        c.b.setAttribute('aria-pressed', String(g.id === open.id));
        c.small.textContent = r ? `LEVEL ${r.level} · ${Math.round(r.mastery * 100)}%` : 'LEVEL 1 · --';
        c.st.textContent = st;
        c.st.className = `gymst ${st.toLowerCase()}`;
        const pts = r?.history.map((p) => p.m) ?? [];
        const key = pts.join(',');
        if (key !== c.sparkKey) {
          c.sparkKey = key;
          clear(c.spark, spark(pts, 70, 18));
        }
      }
      gymState.cards = GAMES.length;
    };
    const paintGame = () => {
      const r = recs.get(open.id) ?? null;
      gameP.title.textContent = open.title;
      gameP.setStatus(r ? `LEVEL ${r.level}${r.mastered ? ' · MASTERED' : ''}` : 'LEVEL 1', training === open.id ? 'ok' : r?.mastered ? 'ok' : 'mid');
      learns.textContent = open.learns;
      status.textContent = statusLine(r, open, training === open.id);
      trainBtn.textContent = training === open.id ? 'PAUSE' : r?.mastered ? 'MASTERED' : 'TRAIN';
      trainBtn.disabled = !!r?.mastered;
      playBtn.hidden = !open.play;
      clear(graphBox, graph(r, open));
      detail.textContent = r?.detail ? `${r.detail} Level ${r.level} needs ${Math.round(open.bar(r.level) * 100)}%.` : `Mastery is checked against ground truth, never his own say-so. Level 1 needs ${Math.round(open.bar(1) * 100)}%.`;
      secretRow.hidden = open.play !== 'secret' || gymState.play.game !== open.id;
      // The board shows what he knows — unless a WATCH is playing or just finished, or the owner is playing him.
      if (!gymState.watching && held !== open.id && gymState.play.game !== open.id) clear(board, renderFrame(views.get(open.id) ?? null));
    };
    const paint = () => {
      gymState.training = training ?? '';
      for (const [id, r] of recs) gymState.recs[id] = { level: r.level, mastery: r.mastery, units: r.units, mastered: r.mastered };
      paintHero();
      paintCards();
      paintGame();
    };

    // ======================= actions
    const note = (x: string) => {
      gymState.log.push(x);
      if (gymState.log.length > 30) gymState.log.shift();
    };
    const select = (id: string) => {
      note(`select ${id}`);
      const g = gameById(id);
      if (!g) return;
      stopWatch();
      held = '';
      disarmReset();
      if (gymState.play.game && gymState.play.game !== id) gymState.play = { game: '', board: [], over: '', thinking: false };
      open = g;
      gymState.open = id;
      paint();
      if (!views.has(id) && recs.has(id)) void ask({ gym: 'view', id }).then((m) => m.view && (views.set(id, m.view), paint()));
    };
    const toggleTrain = () => {
      note(training === open.id ? `pause ${open.id}` : `train ${open.id}`);
      if (training === open.id) {
        send({ gym: 'pause' });
        training = null;
      } else {
        stopWatch();
        held = '';
        training = open.id;
        send({ gym: 'train', id: open.id, rec: recs.get(open.id) ?? null, epoch: epochs[open.id] ?? 0 });
      }
      paint();
    };
    let disarmTimer = 0;
    const disarmReset = () => {
      resetArmed = 0;
      clearTimeout(disarmTimer);
      resetBtn.textContent = 'RESET';
    };
    const reset = () => {
      if (Date.now() - resetArmed > 3000) {
        resetArmed = Date.now();
        resetBtn.textContent = 'SURE? TAP AGAIN';
        clearTimeout(disarmTimer);
        disarmTimer = window.setTimeout(disarmReset, 3000);
        return;
      }
      disarmReset();
      gymState.log.push(`reset ${open.id}`);
      if (training === open.id) training = null;
      // A new epoch: whatever the worker still sends about the old game is dropped.
      epochs[open.id] = (epochs[open.id] ?? 0) + 1;
      held = '';
      gymState.play = { game: '', board: [], over: '', thinking: false };
      stopWatch();
      send({ gym: 'reset', id: open.id, epoch: epochs[open.id] });
      recs.delete(open.id);
      views.delete(open.id);
      delete gymState.recs[open.id];
      void store.remove(open.id);
      toast(`${open.title}: back to the start`, 'warn');
      paint();
    };

    /** On a phone the board is below the buttons: bring it into view. */
    const showBoard = () => {
      if (matchMedia('(max-width: 899px)').matches) board.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // WATCH: his frames, one every 0.45 s on the app's one animation loop.
    let stopAnim: (() => void) | null = null;
    const stopWatch = () => {
      stopAnim?.();
      stopAnim = null;
      gymState.watching = false;
    };
    const watch = async (secret?: string) => {
      note(`watch ${open.id}`);
      stopWatch();
      gymState.play = open.play === 'secret' && secret != null ? gymState.play : { game: '', board: [], over: '', thinking: false };
      const id = open.id;
      held = id;
      clear(board, h('div.note', 'He is getting ready…'));
      const m = await ask({ gym: 'watch', id, seed: Math.floor(Math.random() * 1e6), secret });
      if (m.error) {
        clear(board, h('div.note.bad', `He could not play that: ${m.error}`));
        return;
      }
      if (open.id !== id || held !== id || !m.frames?.length) return;
      const frames = m.frames;
      let i = 0;
      gymState.watching = true;
      gymState.frames = 0;
      const show = () => {
        clear(board, renderFrame(frames[i]!));
        gymState.frames = i + 1;
      };
      show();
      showBoard();
      stopAnim = onFrame(() => {
        if (++i >= frames.length) {
          stopWatch();
          return;
        }
        show();
      }, 0.45);
    };

    // PLAY HIM: on the board (tic-tac-toe, Connect 4) you move first; or you pick his secret.
    const startPlay = () => {
      stopWatch();
      held = '';
      if (open.play === 'secret') {
        gymState.play = { game: open.id, board: [], over: '', thinking: false };
        secretIn.value = '';
        secretIn.placeholder = open.id === 'words' ? 'a five-letter word, e.g. HOUSE' : 'a code, e.g. 1234';
        clear(board, h('div.note', open.id === 'words' ? 'Type a word from his list and tap GO — he will try to guess it.' : 'Type a code (digits from 1 up to the number of symbols at his level) and tap GO — he will try to crack it.'));
        paint();
        secretIn.focus();
        return;
      }
      gymState.play = { game: open.id, board: open.id === 'tictactoe' ? new Array(9).fill(0) : new Array(42).fill(0), over: '', thinking: false };
      paintPlay('Your move: you are X.');
      paint();
      showBoard();
    };
    const paintPlay = (caption: string) => {
      const b = gymState.play.board;
      const f = open.id === 'tictactoe' ? tttFrame(b, caption) : c4Frame(posFromBoard(b), caption);
      clear(board, renderFrame(f, gymState.play.over || gymState.play.thinking ? undefined : (i) => void humanMove(i)), h('div.row.wrap.gymagain', button('NEW GAME', () => startPlay())));
    };
    const outcome = (): string => {
      const b = gymState.play.board;
      const w = open.id === 'tictactoe' ? tttWinner(b) : winnerOf(posFromBoard(b));
      return w === 1 ? 'You win!' : w === 2 ? 'He wins.' : w === 3 ? 'A draw.' : '';
    };
    const humanMove = async (cell: number) => {
      const pl = gymState.play;
      if (pl.over || pl.thinking) return;
      if (open.id === 'tictactoe') {
        if (pl.board[cell]) return;
        pl.board[cell] = 1;
      } else {
        const p = posFromBoard(pl.board);
        const col = cell % 7;
        if (!canPlay(p, col)) return;
        c4Play(p, col);
        pl.board = Array.from(p.b);
      }
      pl.over = outcome();
      if (pl.over) return paintPlay(pl.over);
      pl.thinking = true;
      paintPlay('He is thinking…');
      const m = await ask({ gym: 'move', id: open.id, board: pl.board.slice() });
      pl.thinking = false;
      if (gymState.play !== pl) return;
      if (m.error || m.move == null || m.move < 0) return paintPlay(m.error ? `He could not move: ${m.error}` : 'Your move.');
      if (open.id === 'tictactoe') pl.board[m.move] = 2;
      else {
        const p = posFromBoard(pl.board);
        c4Play(p, m.move);
        pl.board = Array.from(p.b);
      }
      pl.over = outcome();
      paintPlay(pl.over || (open.id === 'tictactoe' ? `He took square ${m.move + 1}. Your move.` : `He dropped in column ${m.move + 1}. Your move.`));
    };
    secretIn.addEventListener('keydown', (e) => e.key === 'Enter' && void watch(secretIn.value.trim()));

    // ======================= hidden app → pause (and save); back → carry on
    const onVisible = () => {
      note(`visibility ${document.visibilityState}`);
      if (document.hidden && training) {
        resumeOnShow = training;
        send({ gym: 'pause' });
        training = null;
        paint();
      } else if (!document.hidden && resumeOnShow) {
        const id = resumeOnShow;
        resumeOnShow = '';
        training = id;
        send({ gym: 'train', id, rec: recs.get(id) ?? null });
        paint();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('pagehide', () => training && send({ gym: 'pause' }));

    opener = (id) => id && select(id);
    gymState.open = open.id;
    paint();
    void store.loadAll().then((all) => {
      for (const [id, r] of all) if (!recs.has(id)) recs.set(id, r);
      paint();
      if (waiting !== undefined) {
        const w = waiting;
        waiting = undefined;
        if (w) select(w);
      }
    });

    return {
      describe() {
        const r = recs.get(open.id);
        return `GYM tab: ${open.title} open (${statusLine(r ?? null, open, training === open.id)}). ${GAMES.filter((g) => recs.get(g.id)?.mastered).length} of ${GAMES.length} games mastered.`;
      },
    };
  },
};
