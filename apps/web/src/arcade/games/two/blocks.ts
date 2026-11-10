/**
 * BLOCKS, as an Engine: Tetris mechanics against Ghosty (blocks-sim.ts holds the rules). Your well is the big one; his is
 * beside it, small, played by his bot. Touch: ◀ ▶ hold and slide the piece, ⟳ turns it, ▼ drops it faster, HOLD swaps it
 * with the one set aside, DROP sends it down at once; or swipe on the well: left and right move it a column a cell's
 * width, a tap turns it, a long swipe down drops it. A pad: the d-pad moves, up or X turns, B turns back, A drops, a bumper
 * holds. A keyboard: the arrows, space, Z, X, C. Your level (skill.ts) sets the gravity, how fast Ghosty places, how rarely
 * he slips and how many lines the duel is to; there is no top one.
 */
import { clamp } from '../kit';
import { type ControlApi, type Evt, makeEngine, type Pointer, type Rules, STEP, type View } from './shell';
import { type Action, blocksLearnable, type BlocksObs, CELLS, type Duel, GARBAGE, H, HIDDEN, landingY, newDuel, SIGMA, step, targetOf, THETA0, W, botStep, cellsOf, type Well } from './blocks-sim';
import { BLOCKS_ID, BLOCKS_GHOSTY_ID, GAMES4 } from './shelf4';

const COLOURS = ['#4fd8e6', '#f2d24b', '#b278e6', '#6fcf6f', '#ec6a6a', '#5b86e6', '#f09a4a', '#8a93a3'];
const lines = (n: number) => `${Math.round(n).toLocaleString('en-GB')} line${Math.round(n) === 1 ? '' : 's'}`;

function cell(g: CanvasRenderingContext2D, x: number, y: number, s: number, kind: number, a = 1): void {
  g.globalAlpha = a;
  g.fillStyle = COLOURS[kind] ?? COLOURS[7]!;
  g.fillRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (s >= 12) {
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.fillRect(x + 1, y + 1, s - 2, Math.max(2, s * 0.14));
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(x + 1, y + s - 1 - Math.max(2, s * 0.14), s - 2, Math.max(2, s * 0.14));
  }
  g.globalAlpha = 1;
}
function well(g: CanvasRenderingContext2D, w: Well, x: number, y: number, s: number, ghost: boolean, t: number): void {
  g.fillStyle = 'rgba(8,12,20,.82)';
  g.fillRect(x - 3, y - 3, W * s + 6, (H - HIDDEN) * s + 6);
  g.strokeStyle = 'rgba(255,255,255,.1)';
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < W; i++) (g.moveTo(x + i * s + 0.5, y), g.lineTo(x + i * s + 0.5, y + (H - HIDDEN) * s));
  for (let j = 1; j < H - HIDDEN; j++) (g.moveTo(x, y + j * s + 0.5), g.lineTo(x + W * s, y + j * s + 0.5));
  g.stroke();
  for (let r = HIDDEN; r < H; r++) for (let c = 0; c < W; c++) {
    const v = w.cells[r * W + c]!;
    if (v) cell(g, x + c * s, y + (r - HIDDEN) * s, s, v === GARBAGE ? 7 : v - 1);
  }
  const p = w.piece;
  if (p) {
    if (ghost) {
      const ly = landingY(w);
      for (const [cx, cy] of cellsOf({ ...p, y: ly })) if (cy >= HIDDEN) cell(g, x + cx * s, y + (cy - HIDDEN) * s, s, p.k, 0.25);
    }
    for (const [cx, cy] of cellsOf(p)) if (cy >= HIDDEN) cell(g, x + cx * s, y + (cy - HIDDEN) * s, s, p.k);
  }
  if (w.flash && w.flash.t < 0.25) {
    g.fillStyle = `rgba(255,255,255,${0.7 * (1 - w.flash.t / 0.25)})`;
    for (const r of w.flash.rows) if (r >= HIDDEN) g.fillRect(x, y + (r - HIDDEN) * s, W * s, s);
  }
  if (w.incoming > 0) {
    const n = Math.min(w.incoming, H - HIDDEN);
    g.fillStyle = Math.floor(t * 4) % 2 ? '#ec6a6a' : '#f09a4a';
    g.fillRect(x - 7, y + (H - HIDDEN - n) * s, 3, n * s);
  }
  if (w.dead) {
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(x, y, W * s, (H - HIDDEN) * s);
  }
}
function mini(g: CanvasRenderingContext2D, k: number, x: number, y: number, s: number): void {
  if (k < 0) return;
  for (const [cx, cy] of CELLS[k]![0]!) cell(g, x + cx * s, y + cy * s, s, k);
}

let sx = 0, sy = 0, lastCol = 0, sid = -1, st = 0, moved = false, dropped = false, cellW = 26;

const rules: Rules<Duel> = {
  id: BLOCKS_ID,
  engine: 'blocks',
  title: 'Blocks',
  line: 'Tetris against me.',
  how: [
    'Drop the falling pieces so they make full rows. A full row goes. Two, three or four at once send rows of garbage to the other well, and rows on their way to you are cancelled first.',
    'Left and right slide the piece, the turn button spins it, DROP sends it down at once and HOLD sets it aside for later (once a piece). Or swipe on the well: sideways to move, a tap to turn, a long swipe down to drop.',
    'My well is the small one. Whoever tops out first loses, and the duel ends when either of us reaches the lines at the pass mark.',
  ],
  ghostyId: BLOCKS_GHOSTY_ID,
  words: lines,
  target: targetOf,
  reserve: 84,
  start: (o) => {
    const d = newDuel(o.seed, o.level, o.theta);
    d.calm = !!o.args?.includes('calm');
    return d;
  },
  step: (d, dt, inp) => step(d, dt, inp),
  drain: (d) => d.events.splice(0) as unknown as Evt[],
  score: (d) => d.a.lines,
  over: (d) => d.winner !== 0,
  passed: (d) => d.winner === 1,
  ends: (d) => (d.winner === 1 ? { title: 'You win', tip: d.b.dead ? 'Your rows buried mine.' : 'You got there first.' } : { title: 'Ghosty wins', tip: d.a.dead ? 'Keep the stack low and leave a well for the long piece.' : 'He was quicker to the lines. Send him garbage while he builds.' }),
  bot: (d, theta, dt) => botStep(d, 1, theta, dt, undefined, 0),
  practice: {
    id: BLOCKS_ID,
    theta0: THETA0,
    sigma: SIGMA,
    play: (theta, level, seed) => {
      const d = newDuel(seed, level, THETA0);
      const none = { held: new Set<string>(), pressed: new Set<string>() };
      for (let i = 0; i < 60 * 600 && !d.winner; i++) step(d, STEP, none, theta);
      return { score: d.a.lines, target: d.target, passed: d.winner === 1 };
    },
  },
  controls: (api: ControlApi) => [
    api.button({ label: '◀', aria: 'Move left', name: 'left', hold: true, cls: 'g4dir' }),
    api.button({ label: '▶', aria: 'Move right', name: 'right', hold: true, cls: 'g4dir' }),
    api.button({ label: '⟳', aria: 'Turn the piece', name: 'up', cls: 'g4act' }),
    api.button({ label: '▼', aria: 'Fall faster', name: 'down', hold: true, cls: 'g4dir' }),
    api.button({ label: 'HOLD', aria: 'Hold: set this piece aside', name: 'c', cls: 'g4act g4small' }),
    api.button({ label: 'DROP', aria: 'Drop the piece at once', name: 'a', cls: 'g4act g4small' }),
  ],
  pointer: (d, p: Pointer, api) => {
    if (p.kind === 'down') {
      sx = p.x; sy = p.y; lastCol = 0; sid = p.id; st = performance.now(); moved = false; dropped = false;
      return;
    }
    if (p.id !== sid || !d) return;
    if (p.kind === 'move') {
      const col = Math.trunc((p.x - sx) / (cellW * 1.1));
      while (lastCol < col) (api.press('right'), lastCol++, (moved = true));
      while (lastCol > col) (api.press('left'), lastCol--, (moved = true));
      if (!dropped && p.y - sy > cellW * 3 && Math.abs(p.x - sx) < p.y - sy) (api.press('a'), (dropped = true), (moved = true));
    } else {
      sid = -1;
      if (!moved && performance.now() - st < 350) api.press('up');
    }
  },
  sound: (s, e) => {
    const ev = e as unknown as { type: string; who: number; n?: number };
    const mine = ev.who === 1;
    const vol = mine ? 1 : 0.35;
    switch (ev.type) {
      case 'move': s.tone({ f: 330, dur: 0.02, type: 'square', vol: 0.03 }); break;
      case 'rotate': s.tone({ f: 520, to: 640, dur: 0.04, type: 'square', vol: 0.05 }); break;
      case 'hold': s.tone({ f: 400, to: 300, dur: 0.07, type: 'triangle', vol: 0.07 }); break;
      case 'lock': s.noise({ dur: 0.05, f: 220, q: 1, vol: 0.14 * vol }); break;
      case 'land': s.tone({ f: 180, to: 90, dur: 0.1, type: 'triangle', vol: 0.12 }); break;
      case 'clear': {
        const n = ev.n ?? 1;
        [523, 659, 784, 1047].slice(0, Math.min(4, n + 1)).forEach((f, i) => s.tone({ f, dur: 0.12, type: 'triangle', vol: 0.09 * vol, at: i * 0.05 }));
        break;
      }
      case 'garbage': s.noise({ dur: 0.3, f: 160, to: 80, q: 0.8, vol: 0.22 * vol }); break;
      case 'perfect': [784, 988, 1175, 1568].forEach((f, i) => s.tone({ f, dur: 0.14, type: 'triangle', vol: 0.1, at: i * 0.06 })); break;
      case 'dead': s.tone({ f: 300, to: 70, dur: 0.7, type: 'sawtooth', vol: 0.12 }); break;
    }
  },
  haptic: (e) => {
    const ev = e as unknown as { type: string; who: number; n?: number };
    if (ev.who !== 1) return null;
    if (ev.type === 'garbage' || ev.type === 'dead') return 'hit';
    if (ev.type === 'clear' && (ev.n ?? 0) >= 2) return 'tick';
    return null;
  },
  say: (e) => {
    const ev = e as unknown as { type: string; who: number; n?: number };
    if (ev.who === 1 && ev.type === 'clear' && ev.n === 4) return 'Four lines!';
    if (ev.who === 1 && ev.type === 'perfect') return 'A clean board.';
    if (ev.who === 2 && ev.type === 'clear' && (ev.n ?? 0) >= 3) return 'Look out, rows are coming.';
    return null;
  },
  music: { spec: { chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], scale: [0, 3, 5, 7, 10, 12], root: -9, bpm: [100, 140], kick: true, hats: true, bass: [0, 6, 8, 14], bassWave: 'triangle', arpWave: 'square', leadWave: 'triangle', level: 0.2, seed: 5 }, pace: (d) => clamp(d.level / 30 + (d.a.lines + d.b.lines) / 80, 0, 1) },
  peek: (d) => ({ lines: d.a.lines, theirLines: d.b.lines, incoming: d.a.incoming, theirIncoming: d.b.incoming, dead: d.a.dead, theirDead: d.b.dead, winner: d.winner, piece: d.a.piece ? { ...d.a.piece } : null, pieces: d.a.pieces, hold: d.a.hold, target: d.target, theirPieces: d.b.pieces, cells: d.a.cells.reduce((n, v) => n + (v ? 1 : 0), 0) }),
  draw: (g, d, v: View) => {
    const bg = g.createLinearGradient(0, 0, 0, v.h);
    bg.addColorStop(0, '#0b1020');
    bg.addColorStop(1, '#06080f');
    g.fillStyle = bg;
    g.fillRect(0, 0, v.w, v.h);
    const top = 60;
    const availH = v.h - v.reserve - top - 8;
    const c = Math.floor(Math.max(10, Math.min((v.w - 36) / 15.5, (availH - 64) / 20)));
    cellW = c;
    const wx = 14;
    const wy = top + 64 + Math.max(0, (availH - 64 - 20 * c) / 2);
    // hold and the next pieces, above the well
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.font = '600 10px system-ui, sans-serif';
    g.textBaseline = 'top';
    g.fillText('HOLD', wx, wy - 62);
    g.fillText('NEXT', wx + 70, wy - 62);
    const ms = Math.max(8, Math.floor(c * 0.55));
    mini(g, d.a.hold, wx, wy - 48, ms);
    d.a.queue.slice(0, 3).forEach((k, i) => mini(g, k, wx + 70 + i * (ms * 4 + 8), wy - 48, ms));
    well(g, d.a, wx, wy, c, true, v.t);
    // Ghosty's well
    const oc = Math.max(6, Math.floor(c * 0.55));
    const ox = wx + W * c + 18;
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillText('GHOSTY', ox, wy - 62);
    g.fillStyle = v.accent;
    g.fillText(lines(d.b.lines), ox, wy - 48);
    well(g, d.b, ox, wy, oc, false, v.t);
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.font = '600 11px system-ui, sans-serif';
    g.fillText(`${lines(d.a.lines)} of ${d.target}`, ox, wy + 20 * oc + 12);
    if (d.a.incoming) (g.fillStyle = '#f09a4a'), g.fillText(`${d.a.incoming} row${d.a.incoming === 1 ? '' : 's'} coming`, ox, wy + 20 * oc + 28);
    if (v.demo) (g.fillStyle = 'rgba(255,255,255,.5)'), g.fillText('Ghosty playing both wells', ox, wy + 20 * oc + 44);
  },
};

export const blocksEngine = makeEngine(rules, GAMES4.find((g) => g.id === BLOCKS_ID)!);
export { rules as blocksRules, blocksLearnable };
export type { Action, BlocksObs };
