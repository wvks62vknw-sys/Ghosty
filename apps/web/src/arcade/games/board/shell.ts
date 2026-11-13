/**
 * The frame of the four board games, as an Engine in the arcade: the kit's overlay for the menus (Play · Continue · How to
 * play · Sound · Quit), the board on a canvas (draw.ts), HINT, TAKE BACK and RULES under the thumb, Ghosty's search in a Worker
 * so the board never freezes (a sliced search on the page if a Worker will not start), "thinking" said with a dot, our own
 * synthesised sound and a haptic on a capture, a game kept in the arcade's save store after each move (CONTINUE), a rating for
 * you and for him through rating.ts, and a level (skill.ts, no top) that rises when you win and eases back when you lose, which
 * sets how long he thinks (kit.ts). Ghosty is search alone until the GYM trains him: the card says so, and no learning runs here.
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles, EngineHandle } from '../../engines/types';
import type { Intent } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { Synth } from '../audio';
import { accentHex, cssSize, fitCanvas, type GameEngine, type GameStats, haptic, hapticIfNoVibrate, hudButton, Loop, Overlay, Resolution } from '../kit';
import type { SaveStore } from '../../engines/saves';
import { type BoardId } from '../shelf5';
import { bookOf as skillBook, finishRun, levelOf, levelWords } from '../two/skill';
import { backgammon } from './backgammon';
import { DAMAGED_SAVE, pushUndo, readSave, turnKey, type Undo } from './keep';
import { type BoardUI, type BView, type Lay } from './draw';
import { type AskMsg, type Decision, decide, GAME } from './engine';
import { type BoardGame, loadWeights, rngAt, rngOf, Search, secondsWords, type Side, thinkMs } from './kit';
import { afterGame, bookOf as ratingBook, near10, ratingTail, rateOf, saveBook } from './rating';

export interface BoardStats extends GameStats {
  level: number;
  state: Record<string, unknown>;
  rating: number;
  ghostyRating: number;
  [k: string]: unknown;
}
export interface BoardHandle extends EngineHandle {
  peek(): BoardStats;
  resetStats(): void;
}

const arg = (args: readonly string[] | undefined, k: string): string | null => {
  const hit = (args ?? []).find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : null;
};
const MIN_THINK_MS = 520;
const TAKEBACKS = 3;
const reduced = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

interface Saved {
  seed: number;
  level: number;
  human: Side;
  moves: unknown[];
  hint: boolean;
  tb: number;
  played: number;
}

export function makeBoardEngine(id: BoardId, ui: BoardUI<any>, entry: { ghosty: string }): GameEngine<never> & { id: string } {
  return {
    id,
    start: (canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }) => startBoard(id, ui, entry, canvas, intent, ev, opts),
  } as never;
}

async function startBoard(id: BoardId, ui: BoardUI<any>, entry: { ghosty: string }, canvas: HTMLCanvasElement, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }): Promise<BoardHandle> {
  const game = GAME[id] as BoardGame<any, any>;
  const t0 = performance.now();
  fitCanvas(canvas);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This browser cannot draw the game.');
  const res = new Resolution();
  const accent = `#${accentHex(0x64d2ff).toString(16).padStart(6, '0')}`;
  const synth = new Synth(opts.sound);
  const title = game.name;
  const saveName = `board.${id}.json`;
  const argLevel = arg(opts.args, 'level');
  const argSeed = arg(opts.args, 'seed');
  const argHuman = arg(opts.args, 'human');
  const fast = (opts.args ?? []).includes('fast');
  const weights = loadWeights(id);

  // ---------------------------------------------------------------- state
  const read = readSave<Saved>(await opts.saves.get(saveName).catch(() => null), (x) => {
    const s = x as Saved | null;
    return !!s && typeof s === 'object' && Number.isFinite(s.seed) && Array.isArray(s.moves) && (s.human === 1 || s.human === 2) && Number.isFinite(s.level);
  });
  let saved: Saved | null = read.saved;
  /** A save that would not read: said on the title card, and cleared. */
  let damaged = read.damaged;
  if (damaged) void opts.saves.remove(saveName).catch(() => undefined);
  type Mode = 'title' | 'play' | 'paused' | 'over' | 'gone';
  let mode: Mode = 'title';
  let state: unknown = game.start(1);
  let seed = 1;
  let level = 1;
  let human: Side = 1;
  let moves: unknown[] = [];
  let undos: Undo[] = [];
  let hintUsed = false;
  let hint: [number, number] | null = null;
  let tbLeft = TAKEBACKS;
  let sel = -1;
  let cursorIdx = 0;
  let thinking = false;
  let hinting = false;
  let ticket = 0;
  let last: number[] = [];
  let prevMover: Side | 0 = 0;
  let pendingGhost: unknown = null;
  let lastLine = '';
  let result: 0 | 1 | 2 | 3 = 0;
  let outcome = '';
  let played = ratingBook(id).you.games;
  let lastThink = { ms: 0, iters: 0, depth: 0, value: 0.5 };
  let firstFrameMs: number | null = null;
  let clock = 0;
  let size = { w: 0, h: 0, s: 0 };
  let safeTop = 0;
  let lay: Lay = ui.layout(390, 844, 130, 1, 0);
  const myLevel = () => (argLevel ? Math.max(1, Math.floor(Number(argLevel)) || 1) : levelOf(skillBook(id).you.r));

  // ---------------------------------------------------------------- the overlay
  const overlay = new Overlay(canvas, `g4.g4board.g5${id}`, title);
  const statusText = h('span.g5st', '');
  const dot = h('i.g5dot', { 'aria-hidden': 'true' });
  const status = h('div.g5status', { 'aria-hidden': 'true' }, statusText, dot);
  const head = h('div.g5head', { 'aria-hidden': 'true' }, h('b.g5title', title), h('span.g5lvl', ''), h('span.g5info', ''));
  const pad = h('div.g4pad', { role: 'application', 'aria-label': `${title}: the board` });
  const mk = (label: string, aria: string, name: string, cls = '') => {
    const b = h(`button.g4btn.g4act.g4small${cls ? `.${cls}` : ''}` as 'button', { type: 'button', 'aria-label': aria, dataset: { act: name } }, label);
    const go = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      synth.wake();
      if (name === 'hint') askHint();
      else if (name === 'back') takeBack();
      else if (name === 'rules') openRules(() => closeToPlay());
      haptic(6);
    };
    b.addEventListener('pointerdown', go);
    b.addEventListener('click', (e) => e.detail === 0 && go(e));
    return b;
  };
  const hintBtn = mk('HINT', 'Hint: one a game, and it costs your rating nothing', 'hint');
  const backBtn = mk('TAKE BACK', `Take back your last ${id === 'backgammon' ? 'turn' : 'move'} and his reply, ${TAKEBACKS} a game`, 'back');
  const rulesBtn = mk('RULES', 'The rules of this game', 'rules');
  const ctl = h('div.g4ctl.g5ctl', hintBtn, backBtn, rulesBtn);
  const pauseBtn = hudButton('g2pause.g4pause', '', 'Pause', () => openPause());
  overlay.layer.append(pad, head, status, pauseBtn, ctl);
  try {
    // the notch: the head and the status line sit below it, so the board does too
    const probe = h('div', { style: 'position:absolute;visibility:hidden;padding-top:var(--g-safe-top,0px)' });
    overlay.root.append(probe);
    safeTop = Math.round(parseFloat(getComputedStyle(probe).paddingTop) || 0);
    probe.remove();
  } catch {
    safeTop = 0;
  }
  overlay.root.dataset.mode = mode;
  const setMode = (m: Mode) => {
    mode = m;
    overlay.root.dataset.mode = m;
  };

  // ---------------------------------------------------------------- what he can do
  const sideOf = (): Side => game.side(state);
  const humanTurn = (): boolean => mode === 'play' && !result && sideOf() === human && !thinking;
  const legal = (): any[] => (result ? [] : game.legal(state));
  const direct = (): boolean => legal().every((m) => game.from(m) < 0);
  const origins = (): number[] => (direct() ? [] : [...new Set(legal().map((m) => game.from(m)))].sort((a, b) => a - b));
  const targetsOf = (from: number): number[] => [...new Set(legal().filter((m) => game.from(m) === from).map((m) => game.to(m)))].sort((a, b) => a - b);
  const targets = (): number[] => (!humanTurn() ? [] : direct() ? [...new Set(legal().map((m) => game.to(m)))].sort((a, b) => a - b) : sel >= 0 ? targetsOf(sel) : []);
  /** What a pad or a keyboard can step through: the pieces to pick, then the places they may go. */
  const selectables = (): number[] => (!humanTurn() ? [] : direct() ? targets() : sel >= 0 ? targetsOf(sel) : origins());

  const paintTexts = () => {
    const lvl = head.querySelector('.g5lvl');
    if (lvl) lvl.textContent = `Level ${level}`;
    const info = head.querySelector('.g5info');
    if (info) info.textContent = result ? '' : ui.info(state, human);
    statusText.textContent = result ? outcome : ui.status(state, human, thinking || hinting).replace('Ghosty is thinking', 'Ghosty is thinking…') || '';
    if (hinting) statusText.textContent = 'Looking for a move…';
    status.classList.toggle('busy', thinking || hinting);
    overlay.root.classList.toggle('g5thinking', thinking || hinting);
    hintBtn.disabled = hintUsed || !humanTurn();
    hintBtn.setAttribute('aria-disabled', String(hintBtn.disabled));
    hintBtn.textContent = hintUsed ? 'HINT USED' : 'HINT';
    backBtn.disabled = tbLeft <= 0 || !undos.length || thinking;
    backBtn.setAttribute('aria-disabled', String(backBtn.disabled));
    backBtn.textContent = tbLeft > 0 ? `TAKE BACK ${tbLeft}` : 'NO TAKE-BACKS';
    pad.classList.toggle('wait', !humanTurn());
  };

  // ---------------------------------------------------------------- sound and feel
  const sfx = (kind: string) => {
    if (kind === 'move') (synth.tone({ f: 330, to: 250, dur: 0.06, type: 'triangle', vol: 0.09 }), synth.noise({ dur: 0.03, f: 1800, q: 0.7, vol: 0.05 }));
    else if (kind === 'select') synth.tone({ f: 620, dur: 0.04, type: 'sine', vol: 0.05 });
    else if (kind === 'capture') (synth.tone({ f: 200, to: 90, dur: 0.14, type: 'triangle', vol: 0.12 }), synth.noise({ dur: 0.09, f: 900, q: 0.6, vol: 0.12 }));
    else if (kind === 'dice') [0, 0.06, 0.12, 0.2].forEach((at) => synth.noise({ dur: 0.04, f: 1500 + at * 4000, q: 0.9, vol: 0.07, at }));
    else if (kind === 'hint') [784, 1175].forEach((f, i) => synth.tone({ f, dur: 0.1, type: 'sine', vol: 0.08, at: i * 0.07 }));
    else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => synth.tone({ f, dur: 0.16, type: 'triangle', vol: 0.11, at: i * 0.1 }));
    else if (kind === 'lose') [392, 330, 262, 196].forEach((f, i) => synth.tone({ f, dur: 0.2, type: 'triangle', vol: 0.1, at: i * 0.13 }));
    else if (kind === 'draw') [440, 440].forEach((f, i) => synth.tone({ f, dur: 0.18, type: 'sine', vol: 0.08, at: i * 0.18 }));
    else if (kind === 'nope') synth.tone({ f: 160, dur: 0.08, type: 'square', vol: 0.05 });
  };
  /** Whether a move took something (a capture, a hit, a good many flips): the sound and the haptic's harder kind. */
  const impact = (prev: any, m: any, next: any): boolean => {
    if (id === 'draughts') return (m.caps?.length ?? 0) > 0;
    if (id === 'othello') {
      let d = 0;
      for (let i = 0; i < 64; i++) if (prev.b[i] !== next.b[i] && prev.b[i]) d++;
      return d >= 3;
    }
    if (id === 'backgammon') return next.bar[1] + next.bar[2] > prev.bar[1] + prev.bar[2];
    return false;
  };

  // ---------------------------------------------------------------- Ghosty's search, in a Worker
  let worker: Worker | null = null;
  let workerBad = false;
  const waiting = new Map<number, (d: Decision) => void>();
  let reqId = 0;
  const startWorker = (): Worker | null => {
    if (worker || workerBad) return worker;
    try {
      worker = new Worker('/board.worker.js');
      worker.onmessage = (e: MessageEvent<Decision & { id: number; error?: string }>) => {
        const f = waiting.get(e.data.id);
        waiting.delete(e.data.id);
        if (f) f(e.data);
      };
      worker.onerror = () => {
        workerBad = true;
        worker = null;
        for (const [k, f] of waiting) (f(decide(lastAsk!)), waiting.delete(k));
      };
    } catch {
      workerBad = true;
      worker = null;
    }
    return worker;
  };
  let lastAsk: Omit<AskMsg, 'id'> | null = null;
  const ask = (state0: unknown, lvl: number, ms: number, sd: number): Promise<Decision> => {
    const msg: Omit<AskMsg, 'id'> = { game: id, state: state0, level: lvl, seed: sd, ms, weights };
    lastAsk = msg;
    const w = startWorker();
    if (w) {
      return new Promise((ok) => {
        const k = ++reqId;
        waiting.set(k, ok);
        w.postMessage({ id: k, ...msg });
      });
    }
    // no Worker: the same search on the page, a slice at a time so the board still answers
    return new Promise((ok) => {
      const se = new Search(game, state0, { seed: sd, level: lvl, weights, tactical: id !== 'backgammon' });
      const end = Date.now() + ms;
      const slice = () => {
        se.step(24);
        if (Date.now() >= end) {
          const p = se.best();
          ok({ move: p.move, iters: p.iters, value: p.value, depth: 0 });
        } else setTimeout(slice, 0);
      };
      slice();
    });
  };

  // ---------------------------------------------------------------- the game
  const persist = () => {
    if (result) {
      void opts.saves.remove(saveName).catch(() => undefined);
      saved = null;
      return;
    }
    const s: Saved = { seed, level, human, moves, hint: hintUsed, tb: tbLeft, played };
    saved = s;
    void opts.saves.put(saveName, new TextEncoder().encode(JSON.stringify(s))).catch(() => undefined);
  };
  const replay = (sd: number, ms0: unknown[]): unknown => {
    let s = game.start(sd);
    ms0.forEach((m, i) => (s = game.apply(s, m, rngAt(sd, i))));
    return s;
  };
  const cellsOf = (m: any): number[] => [game.from(m), game.to(m)].filter((c) => c >= 0);
  const refresh = () => {
    paintTexts();
    const list = selectables();
    if (cursorIdx >= list.length) cursorIdx = 0;
  };
  const begin = (resume: Saved | null) => {
    synth.wake();
    ticket++;
    thinking = false;
    hinting = false;
    sel = -1;
    hint = null;
    result = 0;
    outcome = '';
    undos = [];
    if (resume) {
      seed = resume.seed;
      level = resume.level;
      human = resume.human;
      moves = resume.moves.slice();
      hintUsed = resume.hint;
      tbLeft = resume.tb;
      played = resume.played;
      try {
        state = replay(seed, moves);
      } catch {
        // the moves do not play: the save is damaged after all
        damaged = true;
        void opts.saves.remove(saveName).catch(() => undefined);
        saved = null;
        begin(null);
        overlay.say(DAMAGED_SAVE, 4200);
        return;
      }
      last = moves.length ? cellsOf(moves[moves.length - 1]) : [];
    } else {
      seed = argSeed ? Number(argSeed) || 1 : (Math.random() * 2 ** 31) | 0;
      level = myLevel();
      human = argHuman === '2' ? 2 : argHuman === '1' ? 1 : ratingBook(id).you.games % 2 === 0 ? 1 : 2;
      damaged = false;
      moves = [];
      hintUsed = false;
      tbLeft = TAKEBACKS;
      state = game.start(seed);
      last = [];
      played = ratingBook(id).you.games;
    }
    lay = ui.layout(size.w || 390, size.h || 844, reserve(), human, safeTop);
    overlay.closeMenu();
    setMode('play');
    const r = game.result(state);
    if (r) return finish(r);
    refresh();
    persist();
    loop.start();
    if (sideOf() !== human) void ghostMove();
  };
  const reserve = () => 132;
  const apply = (m: any, by: 'you' | 'ghosty') => {
    const prev = state;
    prevMover = game.side(prev);
    if (by === 'you') pushUndo(undos, prev, moves.length, turnKey(id, prev, moves.length));
    const next = game.apply(prev, m, rngAt(seed, moves.length));
    moves.push(m);
    state = next;
    last = cellsOf(m);
    hint = null;
    sel = -1;
    const hard = impact(prev, m, next);
    sfx(hard ? 'capture' : 'move');
    if (id === 'backgammon' && (next as { ply: number }).ply !== (prev as { ply: number }).ply) setTimeout(() => sfx('dice'), 120);
    if (hard) (ev.onHit?.(), hapticIfNoVibrate());
    else if (by === 'you') haptic(5);
    const r = game.result(next);
    if (r) return finish(r);
    persist();
    refresh();
    if (sideOf() !== human) void ghostMove();
  };
  const ghostMove = async () => {
    if (mode !== 'play' || result) return;
    const my = ++ticket;
    thinking = true;
    refresh();
    const first = prevMover !== sideOf();
    const ms = fast ? 160 : Math.max(120, Math.round(thinkMs(level) / (id === 'backgammon' && !first ? 3 : 1)));
    const t1 = performance.now();
    const d = await ask(state, level, ms, seed + moves.length * 7919);
    const wait = Math.max(0, MIN_THINK_MS - (performance.now() - t1));
    if (wait) await new Promise((r) => setTimeout(r, fast ? 0 : wait));
    if (my !== ticket || (mode as Mode) === 'gone') return;
    lastThink = { ms: Math.round(performance.now() - t1), iters: d.iters, depth: d.depth, value: d.value };
    thinking = false;
    if (mode !== 'play') {
      // the page was paused while he thought: he moves when it resumes
      pendingGhost = d.move;
      return;
    }
    if (d.move !== null && d.move !== undefined) apply(d.move, 'ghosty');
  };

  const tap = (cell: number) => {
    if (!humanTurn() || cell < 0) return;
    const ms = legal();
    if (direct()) {
      const at = ms.findIndex((q) => game.to(q) === cell);
      if (at >= 0) apply(ms[at], 'you');
      else sfx('nope');
      return;
    }
    if (sel >= 0) {
      const cand = ms.filter((q) => game.from(q) === sel && game.to(q) === cell).sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
      if (cand.length) return apply(cand[0], 'you');
    }
    if (ms.some((q) => game.from(q) === cell)) {
      sel = sel === cell ? -1 : cell;
      sfx('select');
      haptic(4);
    } else sel = -1;
    hint = null;
    cursorIdx = Math.max(0, selectables().indexOf(cell));
    refresh();
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    synth.wake();
    const r = pad.getBoundingClientRect();
    const cell = ui.hit(lay, e.clientX - r.left, e.clientY - r.top);
    if (mode === 'play') {
      if (!humanTurn() && cell >= 0) overlay.say(result ? 'The game is over.' : 'Ghosty is still thinking.', 1400);
      tap(cell);
    }
  });

  const takeBack = () => {
    if (mode !== 'play' || tbLeft <= 0 || !undos.length || thinking) return;
    const u = undos.pop()!;
    ticket++;
    state = u.s;
    moves.length = u.n;
    tbLeft--;
    sel = -1;
    hint = null;
    result = 0;
    last = moves.length ? cellsOf(moves[moves.length - 1]) : [];
    sfx('select');
    overlay.say(`Taken back. ${tbLeft} left this game. It costs your rating nothing.`, 2400);
    persist();
    refresh();
    if (sideOf() !== human) void ghostMove();
  };
  const askHint = async () => {
    if (!humanTurn() || hintUsed || hinting) return;
    hintUsed = true;
    hinting = true;
    refresh();
    const my = ticket;
    const d = await ask(state, Math.max(level, 3), fast ? 160 : 700, seed ^ 0x5bd1e995);
    hinting = false;
    if (my !== ticket || (mode as Mode) === 'gone') return;
    if (d.move !== null && d.move !== undefined) {
      hint = [game.from(d.move), game.to(d.move)];
      sfx('hint');
      overlay.say('I would play the gold one. A hint costs your rating nothing, and there is only one a game.', 3600);
    }
    persist();
    refresh();
  };

  const finish = (r: 1 | 2 | 3) => {
    result = r;
    thinking = false;
    ticket++;
    const youScore = r === human ? 1 : r === 3 ? 0.5 : 0;
    const before = ratingBook(id);
    const after = afterGame(before, youScore, level, Date.now());
    saveBook(id, after);
    played = after.you.games;
    let levelLine = '';
    if (youScore !== 0.5) {
      const o = finishRun(id, 'you', youScore === 1, 1, 1);
      levelLine = o.levelAfter > o.levelBefore ? `Level ${o.levelBefore} beaten. On to Level ${o.levelAfter}: he will think for about ${secondsWords(thinkMs(o.levelAfter))}.` : o.levelAfter < o.levelBefore ? `Back to Level ${o.levelAfter}: he will think for about ${secondsWords(thinkMs(o.levelAfter))}.` : `Level ${o.levelAfter} again.`;
      if (youScore === 1) recordScore(id, level);
    } else levelLine = 'A draw: your level stays where it is.';
    const d = (a: number, b: number) => (near10(a) === near10(b) ? 'no change' : `${near10(a).toLocaleString('en-GB')} to ${near10(b).toLocaleString('en-GB')}`);
    lastLine = `Your rating ${d(before.you.r, after.you.r)} · Ghosty's ${d(before.me.r, after.me.r)}`;
    outcome = youScore === 1 ? 'You won' : youScore === 0 ? 'Ghosty won' : 'A draw';
    sfx(youScore === 1 ? 'win' : youScore === 0 ? 'lose' : 'draw');
    persist();
    refresh();
    setTimeout(() => mode === 'play' && showOver(levelLine), fast ? 200 : 900);
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `Sound: ${synth.on ? 'on' : 'off'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const honest = () => (weights ? 'Ghosty is using the weights the GYM trained, plus search.' : 'Ghosty is search alone until the GYM trains him: no learning runs on this phone.');
  const openTitle = () => {
    reopen = openTitle;
    setMode('title');
    loop.start();
    overlay.menu({
      title,
      line: entry.ghosty,
      notes: [`Level ${myLevel()} · he thinks for about ${secondsWords(thinkMs(myLevel()))}`, ratingTail(id), honest(), ...(damaged ? [DAMAGED_SAVE] : [])],
      buttons: [
        ...(saved && !result ? [{ label: 'Continue', aria: `Continue your ${title} game`, primary: true, act: () => begin(saved) }] : []),
        { label: saved && !result ? 'New game' : 'Play', aria: `${saved ? 'Start a new game of' : 'Play'} ${title}`, primary: !saved, act: () => begin(null) },
        { label: 'How to play', act: () => openRules(openTitle) },
        soundBtn(openTitle),
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
    });
    draw();
  };
  const openRules = (back: () => void) => {
    reopen = () => openRules(back);
    const was = mode;
    if (mode === 'play') {
      setMode('paused');
      loop.stop();
    }
    const how = h('div.g2how', ...ui.rules.map((p) => h('p', p)), h('p', `Take-backs (${TAKEBACKS} a game) and the hint (one a game) cost your rating nothing. Ghosty thinks for as long as the level says, and the level rises when you win and eases back when you lose. There is no top level. A controller: the d-pad steps between squares, A picks, B takes back, X hints, START pauses. A keyboard: the arrow keys, Enter, Z, H.`), h('p', honest()));
    overlay.menu({ title: 'How to play', extra: how, buttons: [{ label: was === 'play' ? 'Back to the game' : 'Back', act: back }], kind: 'how' });
  };
  const closeToPlay = () => {
    overlay.closeMenu();
    if (!result) {
      setMode('play');
      loop.start();
      if (pendingGhost !== null && !thinking) {
        const m = pendingGhost;
        pendingGhost = null;
        apply(m, 'ghosty');
      } else if (sideOf() !== human && !thinking) void ghostMove();
    } else setMode('over');
    refresh();
  };
  const openPause = () => {
    if (mode !== 'play') return;
    reopen = openPause;
    setMode('paused');
    loop.stop();
    overlay.menu({
      title: 'Paused',
      line: `${ui.info(state, human)}. ${result ? '' : sideOf() === human ? 'Your move.' : 'Ghosty to move.'}`,
      buttons: [
        { label: 'Resume', primary: true, act: () => closeToPlay() },
        { label: 'How to play', act: () => openRules(openPause) },
        soundBtn(openPause),
        { label: 'Give up', aria: 'Give up this game: it counts as a loss', act: () => (setMode('play'), overlay.closeMenu(), finish(human === 1 ? 2 : 1)) },
        { label: 'Quit', aria: 'Quit to the arcade; the game is kept', act: () => void leave() },
      ],
      kind: 'pause',
    });
    draw();
  };
  const showOver = (levelLine: string) => {
    setMode('over');
    loop.stop();
    reopen = overMenu;
    function overMenu() {
      overlay.menu({
        title: outcome,
        line: result === human ? 'Well played.' : result === 3 ? 'Neither of us could break it.' : 'Again? He does not tire, but you learn.',
        notes: [lastLine, levelLine, ratingTail(id), honest()],
        buttons: [
          { label: 'Play again', primary: true, act: () => begin(null) },
          { label: 'Menu', act: () => (result = 0, openTitle()) },
          soundBtn(overMenu),
          { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    overMenu();
    overlay.announce(`${outcome}. ${lastLine}. ${levelLine}`);
    draw();
  };

  // ---------------------------------------------------------------- the frame
  const keys = new Set<string>();
  const KEYS: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'a', ' ': 'a', z: 'b', Backspace: 'b', h: 'x' };
  const press: string[] = [];
  const onKey = (e: KeyboardEvent) => {
    if (e.type !== 'keydown') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape' || k === 'p') {
      if (mode === 'play') openPause();
      return;
    }
    const n = KEYS[k];
    if (!n || mode !== 'play' || overlay.menuOpen) return;
    e.preventDefault();
    press.push(n);
  };
  window.addEventListener('keydown', onKey);
  let prevHeld = new Set<string>();
  let prevDir = 0;
  const control = (name: string) => {
    if (name === 'b') takeBack();
    else if (name === 'x') void askHint();
    else if (name === 'a') {
      const list = selectables();
      if (list.length) tap(list[Math.min(cursorIdx, list.length - 1)]!);
    } else {
      const list = selectables();
      if (!list.length) return;
      cursorIdx = (cursorIdx + (name === 'left' || name === 'up' ? -1 : 1) + list.length) % list.length;
      sfx('select');
    }
  };
  const fit = () => {
    const { w, h: hh } = cssSize(canvas);
    if (w === size.w && hh === size.h && res.scale === size.s) return;
    size = { w, h: hh, s: res.scale };
    canvas.width = Math.round(w * res.scale);
    canvas.height = Math.round(hh * res.scale);
    lay = ui.layout(w, hh, reserve(), human, safeTop);
  };
  const view = (): BView => {
    const list = selectables();
    return { w: size.w, h: size.h, t: clock, accent, sel, targets: targets(), origins: origins(), last, hint, cursor: list.length && (overlay.menuOpen ? false : true) ? (list[Math.min(cursorIdx, list.length - 1)] ?? -1) : -1, human, turnHuman: humanTurn(), thinking, still: reduced(), over: !!result };
  };
  // [ci] The board is drawn again only when its picture changes: a move, a touch, the size, or the gold pulse on what he may touch
  // (that one ten times a second: it takes a second and a quarter to swell and fade). Drawing the same board sixty times a second kept a
  // software GPU so far behind that the page itself stalled for seconds, Ghosty's answer waiting behind it (FINAL-CI 4).
  let drawnKey = '';
  let drawnState: unknown = null;
  let drawnClock = -1;
  const draw = () => {
    fit();
    const v = view();
    const key = JSON.stringify([size, accent, { ...v, t: 0 }]);
    const pulsing = !v.still && !v.over && v.targets.length > 0; // (only the places he may play pulse: none while Ghosty thinks)
    if (key === drawnKey && state === drawnState && (!pulsing || clock - drawnClock < 0.1)) return;
    drawnKey = key;
    drawnState = state;
    drawnClock = clock;
    g.setTransform(res.scale, 0, 0, res.scale, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, size.h);
    bg.addColorStop(0, '#080b11');
    bg.addColorStop(1, '#10151e');
    g.fillStyle = bg;
    g.fillRect(0, 0, size.w, size.h);
    ui.draw(g, state, v, lay);
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };
  const frame = (dt: number) => {
    clock += dt;
    if (overlay.menuOpen) overlay.menuPad(intent);
    // a controller: the d-pad steps, A picks, B takes back, X hints, START pauses
    const dir = intent.moveX > 0.6 || intent.moveY < -0.6 ? 1 : intent.moveX < -0.6 || intent.moveY > 0.6 ? -1 : 0;
    if (mode === 'play' && !overlay.menuOpen) {
      if (dir && dir !== prevDir) control(dir > 0 ? 'right' : 'left');
      for (const [a, n] of [['jump', 'a'], ['use', 'b'], ['fire', 'x']] as const) if (intent.held.has(a) && !prevHeld.has(a)) control(n);
      if (intent.held.has('pause') && !prevHeld.has('pause')) openPause();
      while (press.length) control(press.shift()!);
    }
    prevDir = dir;
    prevHeld = new Set(intent.held);
    intent.lookX = 0;
    intent.lookY = 0;
    draw();
    res.check(loop.stats);
  };
  const loop = new Loop(frame);
  let hostPaused = false;
  const onHidden = () => {
    if (document.hidden && mode === 'play') openPause();
  };
  document.addEventListener('visibilitychange', onHidden);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (size.w = 0)) : null;
  ro?.observe(canvas);
  let finished: Promise<void> | null = null;
  const done = (): Promise<void> =>
    (finished ??= (async () => {
      loop.stop();
      ticket++;
      worker?.terminate();
      worker = null;
      if (mode === 'play' || mode === 'paused') persist();
      setMode('gone');
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      ro?.disconnect();
      canvas.width = 0;
      canvas.height = 0;
      synth.close();
      overlay.destroy();
    })());
  const leave = async () => {
    await done();
    ev.onQuit?.();
  };

  // a spec's way in: a position by its moves, played at once (the same replay a saved game uses)
  const argMoves = arg(opts.args, 'moves');
  if (argMoves && !saved) {
    try {
      saved = { seed: Number(argSeed) || 1, level: myLevel(), human: argHuman === '2' ? 2 : 1, moves: JSON.parse(argMoves) as unknown[], hint: false, tb: TAKEBACKS, played: 0 };
    } catch {
      /* ignored */
    }
  }
  openTitle();
  paintTexts();
  void rngOf;
  void backgammon;

  return {
    pause() {
      hostPaused = true;
      loop.stop();
    },
    resume() {
      hostPaused = false;
      if (mode === 'play') loop.start();
    },
    quit: done,
    setSound(on: boolean) {
      synth.setOn(on);
      if (overlay.menuOpen) reopen();
    },
    resetStats: () => loop.stats.reset(),
    peek: (): BoardStats => {
      const o = origins();
      const t = targets();
      const at = (c: number) => ({ ...ui.centre(lay, c), cell: c });
      const rb = ratingBook(id);
      return {
        frames: loop.stats.frames,
        firstFrameMs,
        p50: loop.stats.interval(0.5),
        p95: loop.stats.interval(0.95),
        workP95: loop.stats.workMs(0.95),
        scale: res.scale,
        width: canvas.width,
        height: canvas.height,
        calls: 0,
        triangles: 0,
        paused: !loop.running || hostPaused,
        mode,
        level,
        rating: rb.you.r,
        ghostyRating: rb.me.r,
        state: {
          human,
          turn: sideOf(),
          humanTurn: humanTurn(),
          thinking,
          hinting,
          status: statusText.textContent,
          origins: o.map(at),
          targets: t.map(at),
          selected: sel,
          hint,
          hintUsed,
          tbLeft,
          undos: undos.length,
          plies: moves.length,
          result,
          outcome,
          thinkMs: thinkMs(level),
          last: lastThink,
          lastCells: last,
          reduced: reduced(),
          workerBad,
          weights: !!weights,
          saved: !!saved,
          best: scoreOf(id)?.best ?? 0,
          board: JSON.stringify(Array.from(((state as { b?: ArrayLike<number> }).b ?? (state as { p?: ArrayLike<number> }).p ?? []) as ArrayLike<number>)),
          dice: (state as { dice?: number[] }).dice ?? [],
          roll: (state as { roll?: number[] }).roll ?? [],
          moves: legal().length,
        },
      };
    },
  };
}
export { ratingTail, rateOf };
