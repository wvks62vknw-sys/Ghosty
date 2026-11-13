/**
 * WORDS in the arcade's frame (the rules, the list reader and Ghosty's play are words.ts; the Worker answers for him): the kit's
 * menus, a 15 × 15 board on a canvas with the bonuses named, a rack of seven tiles under the thumb (each tile 44 pt or more),
 * a word placed by dragging tiles to squares or by tapping a square and then a tile, the words and score said live (and "Not in my
 * list." at once for a word that is not), RECALL · SHUFFLE · SWAP · PASS · PLAY, HINT (one a game: the best placement by score),
 * the final count, and a rating that moves like the boards'. The board is shown zoomed so every square is 44 pt or more (drag the
 * board to move round it) and MAP shows all of it at once.
 *
 * THE LIST is a download on his tap, on Wi-Fi, its size said before the first move, kept on this phone and removable; it is
 * words only. Nothing is fetched until he taps GET.
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles } from '../../engines/types';
import type { SaveStore } from '../../engines/saves';
import type { Intent } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { Synth } from '../audio';
import { accentHex, cssSize, fitCanvas, type GameEngine, haptic, hudButton, Loop, Overlay, Resolution } from '../kit';
import { finishRun, levelOf, bookOf as skillBook } from '../two/skill';
import { Asker } from './ask';
import { decideWords } from './engine';
import { DAMAGED_SAVE, readSave } from './keep';
import { rngOf, secondsWords, thinkMs } from './kit';
import type { BoardHandle } from './shell';
import { afterGame, bookOf as ratingBook, near10, ratingTail, saveBook } from './rating';
import { apply, bestFor, BONUS_NAME, kbWords, LIST_BYTES, LIST_CACHE, LIST_SIZE_LINE, LIST_URL, checkPlay, type Checked, LAYOUT, Lex, letterOf, N, newGame, PTS, playWords, RACK, type Tile, type WChoice, type WMove, type WState } from './words';

const arg = (args: readonly string[] | undefined, k: string): string | null => {
  const hit = (args ?? []).find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : null;
};
const MIN_THINK_MS = 700;
const ZOOM = 46;
/** On mobile data, as far as the browser can tell (Safari cannot say: the words ask for Wi-Fi). */
const onMobileData = (): boolean => {
  const c = (globalThis.navigator as unknown as { connection?: { type?: string; saveData?: boolean } } | undefined)?.connection;
  return c?.type === 'cellular' || c?.saveData === true;
};
const reduced = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
const RULES = [
  'Place tiles in one row or one column to make a word that joins the words already on the board. The first word goes through the star in the middle. Every word you make has to be in my list: a made-up word is refused at once ("Not in my list."), so there is nothing to challenge.',
  'Drag a tile from your rack to a square, or tap a square and then a tile (tap the square again to turn across to down). Tap a tile on the board to take it back. PLAY puts the word down. RECALL takes your tiles back, SHUFFLE moves the rack about, SWAP changes tiles (there must be seven in the bag), PASS gives the turn up.',
  'Squares with 2L or 3L double or treble the letter on them; 2W or 3W double or treble the whole word. Using all seven tiles gives 40 more. The game ends when the bag is empty and a rack is out, or after six turns in a row that scored nothing; what is left on a rack comes off.',
  'There are one hundred tiles, and none of them is blank. Drag the board to move round it; MAP shows all of it.',
];

interface Saved {
  seed: number;
  level: number;
  first: 0 | 1;
  moves: WMove[];
  hint: boolean;
  /** A short game: the bag cut to this many tiles (a spec's way to reach the end). */
  bag?: number;
}
export type WordsEngine = GameEngine<never> & { id: string };
export function makeWordsEngine(entry: { ghosty: string }): WordsEngine {
  return { id: 'words', start: (canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }) => startWords(entry, canvas, intent, ev, opts) } as never;
}

// ---------------------------------------------------------------- the list on this phone

/** The kept list, if there is one and it reads. */
export async function keptList(): Promise<ArrayBuffer | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const c = await caches.open(LIST_CACHE);
    const r = await c.match(LIST_URL);
    if (!r) return null;
    const b = await r.arrayBuffer();
    new Lex(b);
    return b;
  } catch {
    return null;
  }
}
/** Fetch the list (his tap has been made, and Wi-Fi checked by the caller), saying how far it is; keep it. */
export async function getList(progress: (done: number, total: number) => void): Promise<ArrayBuffer> {
  const r = await fetch(LIST_URL, { cache: 'no-store' });
  if (!r.ok || !r.body) throw new Error('The list did not come.');
  const total = Number(r.headers.get('content-length')) || LIST_BYTES;
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    progress(got, total);
  }
  const all = new Uint8Array(got);
  let at = 0;
  for (const p of parts) (all.set(p, at), (at += p.length));
  new Lex(all);
  try {
    if (typeof caches !== 'undefined') {
      const c = await caches.open(LIST_CACHE);
      await c.put(LIST_URL, new Response(all.slice(), { headers: { 'content-type': 'application/octet-stream' } }));
    }
  } catch {
    /* it is used for this visit and asked for again next time */
  }
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength);
}
export async function removeList(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(LIST_CACHE);
  } catch {
    /* nothing kept */
  }
}

async function startWords(entry: { ghosty: string }, canvas: HTMLCanvasElement, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }): Promise<BoardHandle> {
  const id = 'words';
  const title = 'Words';
  const t0 = performance.now();
  fitCanvas(canvas);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This browser cannot draw the game.');
  const res = new Resolution();
  const accent = `#${accentHex(0x64d2ff).toString(16).padStart(6, '0')}`;
  const synth = new Synth(opts.sound);
  const saveName = 'board.words.json';
  const argLevel = arg(opts.args, 'level');
  const argSeed = arg(opts.args, 'seed');
  const argFirst = arg(opts.args, 'first');
  const argBag = arg(opts.args, 'bag');
  let bagCut: number | undefined = argBag ? Math.max(0, Math.floor(Number(argBag)) || 0) : undefined;
  const fast = (opts.args ?? []).includes('fast');

  // ---------------------------------------------------------------- state
  const read = readSave<Saved>(await opts.saves.get(saveName).catch(() => null), (x) => {
    const s = x as Saved | null;
    return !!s && typeof s === 'object' && Number.isFinite(s.seed) && Number.isFinite(s.level) && Array.isArray(s.moves) && (s.first === 0 || s.first === 1);
  });
  let saved: Saved | null = read.saved;
  let damaged = read.damaged;
  if (damaged) void opts.saves.remove(saveName).catch(() => undefined);
  type Mode = 'title' | 'play' | 'paused' | 'over' | 'gone';
  let mode: Mode = 'title';
  let lex: Lex | null = null;
  let listState: 'missing' | 'getting' | 'ready' = 'missing';
  let listNote: HTMLElement | null = null;
  let ws: WState = newGame(1, 0);
  let seed = 1;
  let level = 1;
  let first: 0 | 1 = 0;
  let moves: WMove[] = [];
  let placed: { cell: number; letter: number; idx: number }[] = [];
  let sel = -1;
  let dirDown = false;
  let picked = -1; // a rack tile chosen for a tap
  let thinking = false;
  let hintUsed = false;
  let ticket = 0;
  let lastLine = '';
  let outcome = '';
  let liveLine = '';
  let live: Checked | null = null;
  let hisLast = '';
  let lastCells: number[] = [];
  let lastThink = { ms: 0, count: 0, replies: 0, score: 0 };
  let pendingGhost: WMove | null = null;
  let firstFrameMs: number | null = null;
  let clock = 0;
  let size = { w: 0, h: 0, s: 0 };
  let safeTop = 0;
  let zoomed = true;
  let cam = { x: 7.5, y: 7.5 };
  let drag: { idx: number; x: number; y: number; moved: boolean; sx: number; sy: number } | null = null;
  let pan: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  const myLevel = () => (argLevel ? Math.max(1, Math.floor(Number(argLevel)) || 1) : levelOf(skillBook(id).you.r));
  const rackLetters = (): number[] => ws.racks[0];
  const usedIdx = (): Set<number> => new Set(placed.map((p) => p.idx));

  // ---------------------------------------------------------------- the overlay
  const overlay = new Overlay(canvas, 'g4.g4board.g6.g6words', title);
  const statusText = h('span.g5st', '');
  const dot = h('i.g5dot', { 'aria-hidden': 'true' });
  const status = h('div.g5status', { 'aria-hidden': 'true' }, statusText, dot);
  const head = h('div.g5head', { 'aria-hidden': 'true' }, h('b.g5title', title), h('span.g5lvl', ''), h('span.g5info', ''));
  const pad = h('div.g4pad', { role: 'application', 'aria-label': `${title}: the board` });
  const btn = (label: string, aria: string, name: string, cls = '') => {
    const b = h(`button.g4btn.g4act.g4small${cls ? `.${cls}` : ''}` as 'button', { type: 'button', 'aria-label': aria, dataset: { act: name } }, label);
    const go = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      synth.wake();
      press(name);
      haptic(6);
    };
    b.addEventListener('pointerdown', go);
    b.addEventListener('click', (e) => e.detail === 0 && go(e));
    return b;
  };
  const recallBtn = btn('RECALL', 'Take all your tiles back from the board', 'recall');
  const shuffleBtn = btn('SHUFFLE', 'Shuffle the tiles on your rack', 'shuffle');
  const swapBtn = btn('SWAP', 'Swap some of your tiles for new ones and give up the turn', 'swap');
  const passBtn = btn('PASS', 'Pass this turn', 'pass');
  const playBtn = btn('PLAY', 'Play the word you have placed', 'play', 'on');
  const rowA = h('div.g4ctl.g6rowa', recallBtn, shuffleBtn, swapBtn, passBtn, playBtn);
  const rackEl = h('div.g6rack', { role: 'group', 'aria-label': 'Your rack' });
  rackEl.style.bottom = 'calc(var(--g-safe-bottom) + var(--g-s-1) + 62px)';
  const mapBtn = btn('MAP', 'Show the whole board at once, or zoom back in', 'map');
  const hintBtn = btn('HINT', 'Hint: my best placement. One a game, and it costs your rating nothing', 'hint');
  const rulesBtn = btn('RULES', 'The rules of this game', 'rules');
  const rowC = h('div.g4ctl.g5ctl.g6rowc', mapBtn, hintBtn, rulesBtn);
  rowC.style.bottom = 'calc(var(--g-safe-bottom) + var(--g-s-1) + 126px)';
  const pauseBtn = hudButton('g2pause.g4pause', '', 'Pause', () => openPause());
  overlay.layer.append(pad, head, status, pauseBtn, rowC, rackEl, rowA);
  try {
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

  // ---------------------------------------------------------------- the board's geometry
  const RESERVE = 200;
  const region = () => {
    const top = 136 + safeTop;
    return { x: 0, y: top, w: size.w, h: Math.max(160, size.h - top - RESERVE) };
  };
  const geom = () => {
    const r = region();
    if (!zoomed) {
      const cell = Math.floor(Math.min((r.w - 16) / N, r.h / N));
      return { cell, ox: Math.round((r.w - cell * N) / 2), oy: Math.round(r.y + (r.h - cell * N) / 2), r };
    }
    const cell = ZOOM;
    const vw = r.w / cell;
    const vh = r.h / cell;
    const cx = vw >= N ? N / 2 : Math.max(vw / 2, Math.min(N - vw / 2, cam.x));
    const cy = vh >= N ? N / 2 : Math.max(vh / 2, Math.min(N - vh / 2, cam.y));
    return { cell, ox: Math.round(r.w / 2 - cx * cell), oy: Math.round(r.y + r.h / 2 - cy * cell), r };
  };
  const cellAtXY = (x: number, y: number): number => {
    const q = geom();
    if (y < q.r.y || y > q.r.y + q.r.h) return -1;
    const c = Math.floor((x - q.ox) / q.cell);
    const r = Math.floor((y - q.oy) / q.cell);
    return c < 0 || c >= N || r < 0 || r >= N ? -1 : r * N + c;
  };
  const centreOf = (cell: number): { x: number; y: number } => {
    const q = geom();
    return { x: q.ox + ((cell % N) + 0.5) * q.cell, y: q.oy + (Math.floor(cell / N) + 0.5) * q.cell };
  };
  const focus = (cell: number) => {
    cam = { x: (cell % N) + 0.5, y: Math.floor(cell / N) + 0.5 };
  };

  // ---------------------------------------------------------------- what he can do
  const humanTurn = (): boolean => mode === 'play' && !ws.over && ws.turn === 0 && !thinking && !!lex;
  const tiles = (): Tile[] => placed.map((p) => [Math.floor(p.cell / N), p.cell % N, p.letter]);
  const recheck = () => {
    if (!lex || !placed.length) {
      live = null;
      liveLine = '';
      return;
    }
    live = checkPlay(ws.board, tiles(), lex);
    liveLine = live.ok ? playWords(live) : live.reason ?? '';
  };

  const paintRack = () => {
    const used = usedIdx();
    const rack = rackLetters();
    while (rackEl.children.length < RACK) rackEl.append(makeTile(rackEl.children.length));
    for (let i = 0; i < RACK; i++) {
      const b = rackEl.children[i] as HTMLButtonElement;
      const l = rack[i];
      const here = l !== undefined && !used.has(i);
      b.dataset.letter = l === undefined ? '' : letterOf(l);
      b.replaceChildren(...(l === undefined ? [] : [h('b', letterOf(l)), h('i', String(PTS[l]!))]));
      b.classList.toggle('empty', !here);
      b.classList.toggle('on', here && picked === i);
      b.disabled = !humanTurn() || !here;
      b.setAttribute('aria-label', here ? `Tile ${letterOf(l!)}, ${PTS[l!]} point${PTS[l!] === 1 ? '' : 's'}${picked === i ? ', picked' : ''}` : 'Empty place on the rack');
      b.setAttribute('aria-disabled', String(b.disabled));
    }
  };
  const makeTile = (i: number): HTMLButtonElement => {
    const b = h('button.g6tile', { type: 'button', dataset: { i: String(i) } }) as HTMLButtonElement;
    b.addEventListener('pointerdown', (e) => {
      if (!humanTurn() || b.classList.contains('empty')) return;
      e.preventDefault();
      e.stopPropagation();
      synth.wake();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        /* fine */
      }
      drag = { idx: i, x: e.clientX, y: e.clientY, moved: false, sx: e.clientX, sy: e.clientY };
    });
    b.addEventListener('pointermove', (e) => {
      if (!drag || drag.idx !== i) return;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
    });
    const up = (e: PointerEvent) => {
      if (!drag || drag.idx !== i) return;
      const d = drag;
      drag = null;
      if (e.type === 'pointercancel') return;
      const rect = canvas.getBoundingClientRect();
      if (d.moved) {
        const cell = cellAtXY(e.clientX - rect.left, e.clientY - rect.top);
        if (cell >= 0) placeAt(cell, i);
        else sfx('select');
      } else tapTile(i);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    // VoiceOver and a keyboard press with a click, not a pointer
    b.addEventListener('click', (e) => e.detail === 0 && tapTile(i));
    return b;
  };

  const paintTexts = () => {
    const lvl = head.querySelector('.g5lvl');
    if (lvl) lvl.textContent = `Level ${level}`;
    const info = head.querySelector('.g5info');
    if (info) info.textContent = `You ${ws.scores[0]} · Ghosty ${ws.scores[1]} · bag ${ws.bag.length}`;
    if (mode === 'over') statusText.textContent = outcome;
    else if (thinking) statusText.textContent = 'Ghosty is thinking…';
    else if (placed.length && liveLine) statusText.textContent = liveLine;
    else if (humanTurn()) statusText.textContent = hisLast ? `${hisLast} Your move.` : ws.board[7 * N + 7]! < 0 ? 'Your move: the first word goes through the star.' : 'Your move.';
    else statusText.textContent = '';
    // a long line (the words and their bonuses) is set smaller so it keeps clear of the board
    statusText.style.fontSize = (statusText.textContent ?? '').length > 44 ? '15px' : '';
    statusText.style.lineHeight = (statusText.textContent ?? '').length > 44 ? '20px' : '';
    status.classList.toggle('busy', thinking);
    overlay.root.classList.toggle('g5thinking', thinking);
    paintRack();
    const turn = humanTurn();
    recallBtn.disabled = !turn || !placed.length;
    shuffleBtn.disabled = !turn;
    swapBtn.disabled = !turn || placed.length > 0 || ws.bag.length < RACK;
    passBtn.disabled = !turn || placed.length > 0;
    playBtn.disabled = !turn || !live?.ok;
    hintBtn.disabled = !turn || hintUsed;
    hintBtn.textContent = hintUsed ? 'HINT USED' : 'HINT';
    mapBtn.textContent = zoomed ? 'MAP' : 'ZOOM';
    for (const b of [recallBtn, shuffleBtn, swapBtn, passBtn, playBtn, hintBtn]) b.setAttribute('aria-disabled', String(b.disabled));
  };

  // ---------------------------------------------------------------- sound
  const sfx = (kind: string) => {
    if (kind === 'place') (synth.tone({ f: 420, to: 330, dur: 0.05, type: 'triangle', vol: 0.09 }), synth.noise({ dur: 0.025, f: 2200, q: 0.8, vol: 0.05 }));
    else if (kind === 'select') synth.tone({ f: 620, dur: 0.04, type: 'sine', vol: 0.05 });
    else if (kind === 'play') [523, 659, 784].forEach((f, i) => synth.tone({ f, dur: 0.09, type: 'triangle', vol: 0.09, at: i * 0.06 }));
    else if (kind === 'big') [523, 659, 784, 1047, 1319].forEach((f, i) => synth.tone({ f, dur: 0.12, type: 'triangle', vol: 0.1, at: i * 0.07 }));
    else if (kind === 'hint') [784, 1175].forEach((f, i) => synth.tone({ f, dur: 0.1, type: 'sine', vol: 0.08, at: i * 0.07 }));
    else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => synth.tone({ f, dur: 0.16, type: 'triangle', vol: 0.11, at: i * 0.1 }));
    else if (kind === 'lose') [392, 330, 262, 196].forEach((f, i) => synth.tone({ f, dur: 0.2, type: 'triangle', vol: 0.1, at: i * 0.13 }));
    else if (kind === 'nope') synth.tone({ f: 160, dur: 0.08, type: 'square', vol: 0.05 });
  };

  // ---------------------------------------------------------------- Ghosty, in the Worker
  const asker = new Asker((m) => decideWords({ ...(m as { state: WState; level: number; seed: number; ms: number; samples?: number; hint?: boolean }), ms: Math.min(Number((m as { ms: number }).ms) || 0, 900) }, lex));
  const ask = <T>(m: Record<string, unknown>) => asker.ask<T>({ kind: 'words', ...m });

  // ---------------------------------------------------------------- placing tiles
  const advance = (from: number): number => {
    // the next empty square along the direction, skipping tiles already there or placed
    const taken = new Set(placed.map((p) => p.cell));
    let r = Math.floor(from / N);
    let c = from % N;
    for (let k = 0; k < N; k++) {
      if (dirDown) r++;
      else c++;
      if (r >= N || c >= N) return from;
      const i = r * N + c;
      if (ws.board[i]! < 0 && !taken.has(i)) return i;
    }
    return from;
  };
  const placeAt = (cell: number, idx: number) => {
    if (!humanTurn()) return;
    const l = rackLetters()[idx];
    if (l === undefined || usedIdx().has(idx)) return;
    if (ws.board[cell]! >= 0 || placed.some((p) => p.cell === cell)) {
      sfx('nope');
      return overlay.say('That square is taken.', 1400);
    }
    placed.push({ cell, letter: l, idx });
    picked = -1;
    sel = advance(cell);
    if (sel === cell) sel = -1;
    sfx('place');
    haptic(5);
    recheck();
    paintTexts();
    persistNothing();
  };
  const persistNothing = () => undefined;
  const tapTile = (idx: number) => {
    if (!humanTurn() || usedIdx().has(idx)) return;
    if (sel >= 0 && ws.board[sel]! < 0 && !placed.some((p) => p.cell === sel)) return placeAt(sel, idx);
    picked = picked === idx ? -1 : idx;
    sfx('select');
    paintTexts();
  };
  const tapCell = (cell: number) => {
    if (cell < 0) return;
    const at = placed.findIndex((p) => p.cell === cell);
    if (at >= 0 && humanTurn()) {
      placed.splice(at, 1);
      sel = cell;
      sfx('select');
      recheck();
      return paintTexts();
    }
    if (!zoomed) {
      zoomed = true;
      focus(cell);
    }
    if (!humanTurn()) return overlay.say(ws.over ? 'The game is over.' : 'Ghosty is still thinking.', 1400);
    if (ws.board[cell]! >= 0) return;
    if (picked >= 0 && !usedIdx().has(picked)) return placeAt(cell, picked);
    if (sel === cell) dirDown = !dirDown;
    sel = cell;
    sfx('select');
    haptic(4);
    paintTexts();
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    synth.wake();
    pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
  });
  pad.addEventListener('pointermove', (e) => {
    if (!pan) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) > 9) pan.moved = true;
    if (pan.moved && zoomed) {
      cam = { x: pan.cx - dx / ZOOM, y: pan.cy - dy / ZOOM };
    }
  });
  const padUp = (e: PointerEvent) => {
    const p = pan;
    pan = null;
    if (!p || e.type === 'pointercancel' || p.moved) return;
    const r = pad.getBoundingClientRect();
    if (mode === 'play') tapCell(cellAtXY(e.clientX - r.left, e.clientY - r.top));
  };
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);

  // ---------------------------------------------------------------- the game
  const persist = () => {
    if (ws.over) {
      void opts.saves.remove(saveName).catch(() => undefined);
      saved = null;
      return;
    }
    const s: Saved = { seed, level, first, moves, hint: hintUsed, ...(bagCut !== undefined ? { bag: bagCut } : {}) };
    saved = s;
    void opts.saves.put(saveName, new TextEncoder().encode(JSON.stringify(s))).catch(() => undefined);
  };
  const replay = (s: Saved): WState => {
    let st = newGame(s.seed, s.first, s.bag);
    for (const m of s.moves) st = apply(st, m);
    return st;
  };
  const begin = (resume: Saved | null) => {
    synth.wake();
    ticket++;
    thinking = false;
    pendingGhost = null;
    placed = [];
    sel = -1;
    picked = -1;
    live = null;
    liveLine = '';
    hisLast = '';
    outcome = '';
    overlay.closeMenu();
    if (resume) {
      try {
        ws = replay(resume);
        seed = resume.seed;
        level = resume.level;
        first = resume.first;
        bagCut = resume.bag;
        moves = resume.moves.slice();
        hintUsed = resume.hint;
        lastCells = [];
        damaged = false;
        setMode('play');
        loop.start();
        focus(7 * N + 7);
        refresh();
        if (ws.over) return finish();
        if (ws.turn === 1) void ghostMove();
        return;
      } catch {
        damaged = true;
        saved = null;
        void opts.saves.remove(saveName).catch(() => undefined);
        overlay.say(DAMAGED_SAVE, 4200);
      }
    }
    damaged = false;
    seed = argSeed ? Number(argSeed) || 1 : (Math.random() * 2 ** 31) | 0;
    level = myLevel();
    first = argFirst === '1' ? 1 : argFirst === '0' ? 0 : ratingBook(id).you.games % 2 === 0 ? 0 : 1;
    bagCut = argBag ? Math.max(0, Math.floor(Number(argBag)) || 0) : undefined;
    ws = newGame(seed, first, bagCut);
    moves = [];
    hintUsed = false;
    lastCells = [];
    zoomed = true;
    focus(7 * N + 7);
    setMode('play');
    loop.start();
    refresh();
    persist();
    if (ws.turn === 1) void ghostMove();
  };
  const refresh = () => paintTexts();
  const commit = (m: WMove, by: 'you' | 'ghosty') => {
    const before = ws;
    ws = apply(ws, m);
    moves.push(m);
    placed = [];
    picked = -1;
    sel = -1;
    live = null;
    liveLine = '';
    if (m.t === 'play') {
      lastCells = m.tiles.map((t) => t[0] * N + t[1]);
      const c = checkPlay(before.board, m.tiles, lex!);
      const words = playWords(c);
      const line = by === 'you' ? `You: ${words}.` : `I play ${words}.`;
      // his play and yours are said on the status line (and to VoiceOver); the bubble is for what needs the eye
      hisLast = by === 'ghosty' ? line : '';
      overlay.announce(line);
      lastLine = line;
      sfx(c.bingo || c.score >= 40 ? 'big' : 'play');
      const cx = m.tiles.reduce((s, t) => s + t[1], 0) / m.tiles.length;
      const cy = m.tiles.reduce((s, t) => s + t[0], 0) / m.tiles.length;
      cam = { x: cx + 0.5, y: cy + 0.5 };
    } else {
      const line = m.t === 'swap' ? (by === 'you' ? `You swap ${m.letters.length} tile${m.letters.length === 1 ? '' : 's'}.` : `I swap ${m.letters.length} tile${m.letters.length === 1 ? '' : 's'}.`) : by === 'you' ? 'You pass.' : 'I pass.';
      hisLast = by === 'ghosty' ? line : '';
      lastLine = line;
      overlay.announce(line);
      sfx('select');
    }
    if (ws.over) return finish();
    persist();
    refresh();
    if (ws.turn === 1) void ghostMove();
  };
  const ghostMove = async () => {
    if (mode !== 'play' || ws.over || !lex) return;
    const my = ++ticket;
    thinking = true;
    refresh();
    const ms = fast ? 160 : Math.max(500, Math.round(thinkMs(level) * 0.8));
    const t1 = performance.now();
    const d = await ask<{ result?: WChoice; move?: WMove }>({ state: ws, level, seed: seed + ws.ply * 7919, ms });
    const r = (d.result ?? d) as WChoice;
    const wait = Math.max(0, MIN_THINK_MS - (performance.now() - t1));
    if (wait && !fast) await new Promise((x) => setTimeout(x, wait));
    if (my !== ticket || (mode as Mode) === 'gone') return;
    lastThink = { ms: Math.round(performance.now() - t1), count: r.count ?? 0, replies: r.replies ?? 0, score: r.score ?? 0 };
    thinking = false;
    if (mode !== 'play') {
      pendingGhost = r.move;
      return;
    }
    commit(r.move, 'ghosty');
  };
  const doPlay = () => {
    if (!humanTurn() || !lex) return;
    if (!placed.length) return overlay.say('Place a tile first.', 1600);
    recheck();
    if (!live?.ok) {
      sfx('nope');
      overlay.say(live?.reason ?? 'Not in my list.', 2600);
      return paintTexts();
    }
    commit({ t: 'play', tiles: tiles() }, 'you');
  };
  const press = (name: string) => {
    if (name === 'play') return doPlay();
    if (name === 'recall') {
      if (!humanTurn()) return;
      placed = [];
      picked = -1;
      sfx('select');
      recheck();
      return paintTexts();
    }
    if (name === 'shuffle') {
      if (!humanTurn()) return;
      if (placed.length) {
        placed = [];
        recheck();
      }
      const r = rngOf((Date.now() & 0xffff) + ws.ply);
      const rack = ws.racks[0];
      for (let i = rack.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [rack[i], rack[j]] = [rack[j]!, rack[i]!];
      }
      picked = -1;
      sfx('select');
      return paintTexts();
    }
    if (name === 'swap') return openSwap();
    if (name === 'pass') return openPass();
    if (name === 'map') {
      zoomed = !zoomed;
      sfx('select');
      return paintTexts();
    }
    if (name === 'hint') return void askHint();
    if (name === 'rules') return openRules(() => closeToPlay());
  };
  const askHint = async () => {
    if (!humanTurn() || hintUsed || !lex) return;
    hintUsed = true;
    const best = bestFor(ws, 0, lex);
    if (!best) {
      overlay.say('I cannot find a word on your rack: swap some tiles or pass.', 3600);
      return paintTexts();
    }
    // the placement is set down, ready to play
    placed = [];
    const rack = rackLetters();
    const used = new Set<number>();
    for (const [r, c, l] of best.tiles) {
      const i = rack.findIndex((x, k) => x === l && !used.has(k));
      used.add(i);
      placed.push({ cell: r * N + c, letter: l, idx: i });
    }
    recheck();
    sfx('hint');
    focus(best.tiles[0]![0] * N + best.tiles[0]![1]);
    overlay.say(`I would play ${live?.ok ? playWords(live) : `${best.score} points`}. It is on the board, PLAY puts it down. A hint costs your rating nothing, and there is only one a game.`, 5200);
    persist();
    paintTexts();
  };

  const finish = () => {
    ticket++;
    thinking = false;
    const youScore = ws.winner === 0 ? 1 : ws.winner === 2 ? 0.5 : 0;
    const before = ratingBook(id);
    const after = afterGame(before, youScore, level, Date.now());
    saveBook(id, after);
    let levelLine: string;
    if (youScore !== 0.5) {
      const o = finishRun(id, 'you', youScore === 1, 1, 1);
      levelLine = o.levelAfter > o.levelBefore ? `Level ${o.levelBefore} beaten. On to Level ${o.levelAfter}: he will think for about ${secondsWords(thinkMs(o.levelAfter) * 0.8)} a move.` : o.levelAfter < o.levelBefore ? `Back to Level ${o.levelAfter}: he will think for about ${secondsWords(thinkMs(o.levelAfter) * 0.8)} a move.` : `Level ${o.levelAfter} again.`;
      if (youScore === 1) recordScore(id, level);
    } else levelLine = 'A tie: your level stays where it is.';
    const d = (a: number, b: number) => (near10(a) === near10(b) ? 'no change' : `${near10(a).toLocaleString('en-GB')} to ${near10(b).toLocaleString('en-GB')}`);
    lastLine = `Your rating ${d(before.you.r, after.you.r)} · Ghosty's ${d(before.me.r, after.me.r)}`;
    outcome = youScore === 1 ? 'You won' : youScore === 0 ? 'Ghosty won' : 'A tie';
    sfx(youScore === 1 ? 'win' : youScore === 0 ? 'lose' : 'select');
    persist();
    refresh();
    setTimeout(() => mode === 'play' && showOver(levelLine), fast ? 200 : 900);
  };

  // ---------------------------------------------------------------- the list
  const loadList = (bytes: ArrayBuffer) => {
    lex = new Lex(bytes);
    listState = 'ready';
    asker.setLex(bytes);
  };
  const letList = async () => {
    const kept = await keptList();
    if (kept) loadList(kept);
  };
  const getIt = async () => {
    if (listState === 'getting') return;
    if (onMobileData()) {
      overlay.say(`You are on mobile data, and the word list is ${kbWords(LIST_BYTES)}: it waits for Wi-Fi. Join Wi-Fi and tap again.`, 5200);
      return;
    }
    listState = 'getting';
    openTitle();
    try {
      const bytes = await getList((done, total) => {
        if (listNote) listNote.textContent = `Getting the word list: ${Math.min(100, Math.round((done / total) * 100))}% of ${kbWords(LIST_BYTES)}…`;
      });
      loadList(bytes);
      overlay.say('The word list is on this phone now.', 2400);
    } catch {
      listState = 'missing';
      overlay.say('The word list did not come. Check the connection and tap again.', 4200);
    }
    if (mode === 'title') openTitle();
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `Sound: ${synth.on ? 'on' : 'off'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const honest = () => 'Ghosty plays on this phone: every placement from his rack through the list, scored, and from level 9 your best reply to his best few. No learning runs here.';
  const openTitle = () => {
    reopen = openTitle;
    setMode('title');
    loop.start();
    listNote = h('p.g2note.g6listnote', listState === 'ready' ? `The word list is on this phone: ${kbWords(LIST_BYTES)}, ${lex?.words.toLocaleString('en-GB') ?? ''} words.` : listState === 'getting' ? `Getting the word list: 0% of ${kbWords(LIST_BYTES)}…` : LIST_SIZE_LINE);
    overlay.menu({
      title,
      line: entry.ghosty,
      notes: [`Level ${myLevel()} · he thinks for about ${secondsWords(thinkMs(myLevel()) * 0.8)} a move`, ratingTail(id), honest(), ...(damaged ? [DAMAGED_SAVE] : [])],
      extra: listNote,
      buttons: [
        ...(listState === 'ready'
          ? [
              ...(saved ? [{ label: 'Continue', aria: 'Continue your Words game', primary: true, act: () => begin(saved) }] : []),
              { label: saved ? 'New game' : 'Play', aria: `${saved ? 'Start a new game of' : 'Play'} Words`, primary: !saved, act: () => begin(null) },
            ]
          : [{ label: listState === 'getting' ? 'Getting the list…' : `Get the word list (${kbWords(LIST_BYTES)})`, aria: `Download the word list, ${kbWords(LIST_BYTES)}, once, on Wi-Fi`, id: 'get-list', primary: true, act: () => void getIt() }]),
        { label: 'How to play', act: () => openRules(openTitle) },
        ...(listState === 'ready' ? [{ label: 'Remove the word list', aria: `Remove the word list from this phone and free ${kbWords(LIST_BYTES)}`, id: 'remove-list', act: () => void removeList().then(() => ((listState = 'missing'), (lex = null), openTitle())) }] : []),
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
    const how = h('div.g2how', ...RULES.map((p) => h('p', p)), h('p', `A hint (one a game) costs your rating nothing. Ghosty thinks for as long as the level says, and the level rises when you win and eases back when you lose. There is no top level. A keyboard: Enter plays.`), h('p', honest()));
    overlay.menu({ title: 'How to play', extra: how, buttons: [{ label: was === 'play' ? 'Back to the game' : 'Back', act: back }], kind: 'how' });
  };
  const openSwap = () => {
    if (!humanTurn()) return;
    if (ws.bag.length < RACK) return overlay.say('There have to be seven tiles in the bag to swap.', 2800);
    const chosen = new Set<number>();
    const rack = rackLetters();
    const grid = h('div.g6swap');
    const paint = () => {
      grid.replaceChildren(
        ...rack.map((l, i) => {
          const b = h('button.g6tile', { type: 'button', 'aria-label': `Tile ${letterOf(l)}${chosen.has(i) ? ', to swap' : ''}`, 'aria-pressed': String(chosen.has(i)), dataset: { i: String(i) } }, h('b', letterOf(l)), h('i', String(PTS[l]!))) as HTMLButtonElement;
          b.classList.toggle('on', chosen.has(i));
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (chosen.has(i)) chosen.delete(i);
            else chosen.add(i);
            paint();
            sw.disabled = !chosen.size;
            sw.textContent = chosen.size ? `Swap ${chosen.size}` : 'Pick tiles to swap';
          });
          return b;
        }),
      );
    };
    const sw = h('button.g2btn.pri', { type: 'button', disabled: true, dataset: { id: 'swap-go' } }, 'Pick tiles to swap') as HTMLButtonElement;
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!chosen.size) return;
      const letters = [...chosen].map((i) => rack[i]!);
      overlay.closeMenu();
      setMode('play');
      loop.start();
      commit({ t: 'swap', letters }, 'you');
    });
    setMode('paused');
    paint();
    overlay.menu({ title: 'Swap tiles', line: 'Pick the tiles to put back. You give up the turn.', extra: h('div', grid, h('div.g2btns', sw)), buttons: [{ label: 'Back to the game', act: () => closeToPlay() }], kind: 'how' });
  };
  const openPass = () => {
    if (!humanTurn()) return;
    setMode('paused');
    overlay.menu({
      title: 'Pass?',
      line: 'You give up this turn and score nothing. Six turns in a row that score nothing end the game.',
      buttons: [
        { label: 'Pass', primary: true, aria: 'Pass this turn', act: () => (overlay.closeMenu(), setMode('play'), loop.start(), commit({ t: 'pass' }, 'you')) },
        { label: 'Back to the game', act: () => closeToPlay() },
      ],
      kind: 'how',
    });
  };
  const closeToPlay = () => {
    overlay.closeMenu();
    if (ws.over) setMode('over');
    else {
      setMode('play');
      loop.start();
      if (pendingGhost && !thinking) {
        const m = pendingGhost;
        pendingGhost = null;
        commit(m, 'ghosty');
      } else if (ws.turn === 1 && !thinking) void ghostMove();
    }
    refresh();
  };
  const openPause = () => {
    if (mode !== 'play') return;
    reopen = openPause;
    setMode('paused');
    loop.stop();
    overlay.menu({
      title: 'Paused',
      line: `You ${ws.scores[0]} · Ghosty ${ws.scores[1]} · ${ws.bag.length} tiles in the bag. ${ws.turn === 0 ? 'Your move.' : 'Ghosty to move.'}`,
      buttons: [
        { label: 'Resume', primary: true, act: () => closeToPlay() },
        { label: 'How to play', act: () => openRules(openPause) },
        soundBtn(openPause),
        { label: 'Give up', aria: 'Give up this game: it counts as a loss', act: () => (setMode('play'), overlay.closeMenu(), giveUp()) },
        { label: 'Quit', aria: 'Quit to the arcade; the game is kept', act: () => void leave() },
      ],
      kind: 'pause',
    });
    draw();
  };
  const giveUp = () => {
    ws = { ...ws, over: true, winner: 1 };
    finish();
  };
  const showOver = (levelLine: string) => {
    setMode('over');
    loop.stop();
    reopen = overMenu;
    function overMenu() {
      overlay.menu({
        title: outcome,
        line: ws.winner === 0 ? 'Well played.' : ws.winner === 2 ? 'Not a point between us.' : 'Again? He does not tire, but you learn.',
        notes: [`You ${ws.scores[0]} · Ghosty ${ws.scores[1]}`, `Tiles left on the racks: yours ${ws.left[0]} points, his ${ws.left[1]}${ws.out >= 0 ? `. ${ws.out === 0 ? 'You' : 'He'} went out` : ''}.`, lastLine, levelLine, ratingTail(id)],
        buttons: [
          { label: 'Play again', primary: true, act: () => begin(null) },
          { label: 'Menu', act: () => openTitle() },
          soundBtn(overMenu),
          { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    overMenu();
    overlay.announce(`${outcome}. ${ws.scores[0]} to ${ws.scores[1]}. ${lastLine}`);
    draw();
  };

  // ---------------------------------------------------------------- drawing
  const onKey = (e: KeyboardEvent) => {
    if (e.type !== 'keydown') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape') {
      if (mode === 'play') openPause();
      return;
    }
    if (mode !== 'play' || overlay.menuOpen) return;
    if (k === 'Enter') {
      e.preventDefault();
      doPlay();
    }
  };
  window.addEventListener('keydown', onKey);
  const rr = (x: number, y: number, w: number, hh: number, rad: number) => {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + hh, rad);
    g.arcTo(x + w, y + hh, x, y + hh, rad);
    g.arcTo(x, y + hh, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  };
  const BONUS_FILL: Record<string, string> = { '': '#141a24', d: '#1d3a4a', t: '#1d4f7a', D: '#5a3340', T: '#7a2f2f' };
  const BONUS_TEXT: Record<string, string> = { d: '2L', t: '3L', D: '2W', T: '3W' };
  const tileAt = (x: number, y: number, c: number, cell: number, kind: 'board' | 'new' | 'last' | 'drag') => {
    const pad4 = Math.max(1, Math.round(cell * 0.06));
    rr(x + pad4, y + pad4, cell - 2 * pad4, cell - 2 * pad4, Math.max(3, cell * 0.14));
    g.fillStyle = kind === 'new' || kind === 'drag' ? '#f3e2ae' : '#e6d7a9';
    g.fill();
    g.lineWidth = kind === 'board' ? 1 : 2.5;
    g.strokeStyle = kind === 'new' || kind === 'drag' ? accent : kind === 'last' ? '#ffcf5c' : 'rgba(0,0,0,.35)';
    g.stroke();
    g.fillStyle = '#1a1d24';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(cell * 0.56)}px ui-sans-serif, system-ui, sans-serif`;
    g.fillText(letterOf(c), x + cell / 2 - cell * 0.02, y + cell / 2 + cell * 0.02);
    g.font = `600 ${Math.max(7, Math.round(cell * 0.24))}px ui-sans-serif, system-ui, sans-serif`;
    g.textAlign = 'right';
    g.fillText(String(PTS[c]), x + cell - pad4 - 2, y + cell - pad4 - Math.round(cell * 0.14));
  };
  const draw = () => {
    fit();
    g.setTransform(res.scale, 0, 0, res.scale, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, size.h);
    bg.addColorStop(0, '#080b11');
    bg.addColorStop(1, '#10151e');
    g.fillStyle = bg;
    g.fillRect(0, 0, size.w, size.h);
    const q = geom();
    g.save();
    g.beginPath();
    g.rect(0, q.r.y, size.w, q.r.h);
    g.clip();
    const label = Math.max(8, Math.round(q.cell * 0.3));
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const x = q.ox + c * q.cell;
        const y = q.oy + r * q.cell;
        if (x + q.cell < 0 || x > size.w || y + q.cell < q.r.y || y > q.r.y + q.r.h) continue;
        const i = r * N + c;
        const b = LAYOUT[i]!;
        const star = i === 7 * N + 7;
        g.fillStyle = BONUS_FILL[b]!;
        g.fillRect(x + 0.5, y + 0.5, q.cell - 1, q.cell - 1);
        const v = ws.board[i]!;
        const pl = placed.find((p) => p.cell === i);
        if (v >= 0) tileAt(x, y, v, q.cell, lastCells.includes(i) ? 'last' : 'board');
        else if (pl) tileAt(x, y, pl.letter, q.cell, 'new');
        else if (star || b) {
          g.fillStyle = 'rgba(255,255,255,.7)';
          g.font = `600 ${label}px ui-sans-serif, system-ui, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(star ? '★' : BONUS_TEXT[b]!, x + q.cell / 2, y + q.cell / 2);
        }
        if (i === sel && !v && !pl && humanTurn()) {
          g.strokeStyle = accent;
          g.lineWidth = 2.5;
          g.globalAlpha = reduced() ? 1 : 0.65 + 0.35 * Math.sin(clock * 5);
          g.strokeRect(x + 2, y + 2, q.cell - 4, q.cell - 4);
          g.globalAlpha = 1;
          g.fillStyle = accent;
          g.font = `700 ${Math.round(q.cell * 0.4)}px ui-sans-serif, system-ui, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(dirDown ? '↓' : '→', x + q.cell / 2, y + q.cell / 2);
        }
      }
    g.strokeStyle = 'rgba(255,255,255,.12)';
    g.lineWidth = 1;
    g.strokeRect(q.ox + 0.5, q.oy + 0.5, q.cell * N - 1, q.cell * N - 1);
    g.restore();
    // a tile on its way to a square follows the thumb, lifted so the finger does not cover the square
    if (drag?.moved) {
      const r0 = canvas.getBoundingClientRect();
      const l = rackLetters()[drag.idx];
      if (l !== undefined) {
        const s = ZOOM;
        tileAt(drag.x - r0.left - s / 2, drag.y - r0.top - s * 1.6, l, s, 'drag');
        const cell = cellAtXY(drag.x - r0.left, drag.y - r0.top - s * 1.6 + s / 2);
        void cell;
      }
    }
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };
  const fit = () => {
    const { w, h: hh } = cssSize(canvas);
    if (w === size.w && hh === size.h && res.scale === size.s) return;
    size = { w, h: hh, s: res.scale };
    canvas.width = Math.round(w * res.scale);
    canvas.height = Math.round(hh * res.scale);
  };
  let prevHeld = new Set<string>();
  const frame = (dt: number) => {
    clock += dt;
    if (overlay.menuOpen) overlay.menuPad(intent);
    if (mode === 'play' && !overlay.menuOpen) {
      if (intent.held.has('pause') && !prevHeld.has('pause')) openPause();
    }
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
      asker.terminate();
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
  await letList();
  openTitle();
  paintTexts();
  void BONUS_NAME;

  const snapshot = (): string => {
    let s = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = ws.board[r * N + c]!;
        s += v < 0 ? '.' : letterOf(v);
      }
      s += '/';
    }
    return s;
  };
  const handle = {
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
    /** A spec's ways round the board: the screen point of a square (moving the view to it first), and the rack's tiles. */
    cellXY(row: number, col: number) {
      focus(row * N + col);
      const c = centreOf(row * N + col);
      const r0 = canvas.getBoundingClientRect();
      return { x: c.x + r0.left, y: c.y + r0.top };
    },
    peek: () => {
      const rb = ratingBook(id);
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
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
          humanTurn: humanTurn(),
          thinking,
          turn: ws.turn,
          status: statusText.textContent,
          scores: [ws.scores[0], ws.scores[1]],
          bag: ws.bag.length,
          rack: rackLetters().map(letterOf),
          rackPos: [...rackEl.children].map((b) => ({ ...rect(b), letter: (b as HTMLElement).dataset.letter ?? '', empty: b.classList.contains('empty') })),
          placed: placed.length,
          live: live ? { ok: live.ok, reason: live.reason ?? '', score: live.score, words: live.words.map((w) => ({ word: w.word, pts: w.pts, bonus: w.bonus })) } : null,
          liveLine,
          hisLast,
          board: snapshot(),
          plies: ws.ply,
          over: ws.over,
          winner: ws.winner,
          outcome,
          last: lastThink,
          hintUsed,
          zoomed,
          selected: sel,
          down: dirDown,
          listState,
          listBytes: LIST_BYTES,
          listWords: lex?.words ?? 0,
          reduced: reduced(),
          workerBad: asker.bad,
          saved: !!saved,
          thinkMs: thinkMs(level),
          best: scoreOf(id)?.best ?? 0,
          first,
          seed,
        },
      };
    },
  };
  return handle as unknown as BoardHandle;
}
