/**
 * The four boards, drawn in the Machine's marks (a dark plate, hairline rules in the accent, flat discs, one ring for what is
 * picked, one dot for where it may go) and read back from a tap: every square is 44 points or more (backgammon's twelve points
 * run down two columns so each is a row 44 or more tall). Page only: the Worker never loads this file.
 */
import { cellOfSq, ckFrom } from '../../../gym/ckboard';
import { ROWS } from '../../../gym/c4board';
import { type BgState, BAR, OFF, pips } from './backgammon';
import type { C4State } from './connect4';
import type { DraughtsState } from './draughts';
import { count, type OthelloState } from './othello';
import type { Side } from './kit';

export interface Lay {
  x: number;
  y: number;
  cell: number;
  w: number;
  h: number;
  flip: boolean;
  /** Backgammon: the top strip (dice), the bar and the tray. */
  top: number;
  bar: number;
  tray: number;
}
export interface BView {
  w: number;
  h: number;
  t: number;
  accent: string;
  sel: number;
  targets: number[];
  origins: number[];
  last: number[];
  hint: [number, number] | null;
  cursor: number;
  human: Side;
  turnHuman: boolean;
  thinking: boolean;
  still: boolean;
  over: boolean;
}
export interface BoardUI<S> {
  layout(w: number, h: number, reserve: number, human: Side, top: number): Lay;
  draw(g: CanvasRenderingContext2D, s: S, v: BView, lay: Lay): void;
  centre(lay: Lay, cell: number): { x: number; y: number };
  hit(lay: Lay, x: number, y: number): number;
  rules: string[];
  status(s: S, human: Side, thinking: boolean): string;
  info(s: S, human: Side): string;
}

/** Where the board's region begins below the head and the status line (the safe area is added to it). */
const TOP = 112;
const PLATE = '#0d1118';
const INK = 'rgba(255,255,255,.82)';
const ghosty = '#ffcf5c';

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, rad: number) => {
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + hh, rad);
  g.arcTo(x + w, y + hh, x, y + hh, rad);
  g.arcTo(x, y + hh, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
};
const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ring?: string) => {
  g.beginPath();
  g.arc(x, y, r, 0, 6.3);
  g.fillStyle = fill;
  g.fill();
  if (ring) {
    g.lineWidth = 2;
    g.strokeStyle = ring;
    g.stroke();
  }
};
const ringAt = (g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, w = 3) => {
  g.beginPath();
  g.arc(x, y, r, 0, 6.3);
  g.lineWidth = w;
  g.strokeStyle = col;
  g.stroke();
};
const pulse = (v: BView): number => (v.still ? 1 : 0.65 + 0.35 * Math.sin(v.t * 5));

function plate(g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, accent: string): void {
  g.fillStyle = PLATE;
  rr(g, x - 6, y - 6, w + 12, hh + 12, 10);
  g.fill();
  g.strokeStyle = accent;
  g.globalAlpha = 0.45;
  g.lineWidth = 1;
  rr(g, x - 6, y - 6, w + 12, hh + 12, 10);
  g.stroke();
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------- the grid games

function gridLayout(w: number, h: number, reserve: number, human: Side, flipFor: Side, safe: number): Lay {
  const t = TOP + safe;
  const cell = Math.floor(Math.min((w - 28) / 8, (h - t - reserve) / 8));
  const x = Math.round((w - cell * 8) / 2);
  const y = Math.round(t + (h - t - reserve - cell * 8) / 2);
  return { x, y, cell, w: cell * 8, h: cell * 8, flip: human === flipFor, top: 0, bar: 0, tray: 0 };
}
const gridCentre = (lay: Lay, cell: number): { x: number; y: number } => {
  let r = cell >> 3;
  let c = cell & 7;
  if (lay.flip) (r = 7 - r), (c = 7 - c);
  return { x: lay.x + c * lay.cell + lay.cell / 2, y: lay.y + r * lay.cell + lay.cell / 2 };
};
const gridHit = (lay: Lay, x: number, y: number): number => {
  let c = Math.floor((x - lay.x) / lay.cell);
  let r = Math.floor((y - lay.y) / lay.cell);
  if (c < 0 || c > 7 || r < 0 || r > 7) return -1;
  if (lay.flip) (r = 7 - r), (c = 7 - c);
  return r * 8 + c;
};
/** Marks common to the grids: the last move, what is picked, where it may go, the hint, the cursor. */
function gridMarks(g: CanvasRenderingContext2D, v: BView, lay: Lay, dots: boolean): void {
  const R = lay.cell;
  for (const c of v.last) {
    const p = gridCentre(lay, c);
    g.fillStyle = 'rgba(255,255,255,.1)';
    g.fillRect(p.x - R / 2, p.y - R / 2, R, R);
  }
  if (v.sel >= 0) {
    const p = gridCentre(lay, v.sel);
    ringAt(g, p.x, p.y, R * 0.42, v.accent, 3);
  }
  if (dots)
    for (const c of v.targets) {
      const p = gridCentre(lay, c);
      g.globalAlpha = pulse(v);
      disc(g, p.x, p.y, R * 0.15, v.accent);
      g.globalAlpha = 1;
    }
  if (v.hint) {
    for (const [i, c] of v.hint.entries()) {
      if (c < 0) continue;
      const p = gridCentre(lay, c);
      ringAt(g, p.x, p.y, R * (i ? 0.3 : 0.44), ghosty, 3);
    }
  }
  if (v.cursor >= 0 && v.turnHuman) {
    const p = gridCentre(lay, v.cursor);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.setLineDash([4, 4]);
    g.strokeRect(p.x - R / 2 + 2, p.y - R / 2 + 2, R - 4, R - 4);
    g.setLineDash([]);
  }
}
function coords(g: CanvasRenderingContext2D, lay: Lay): void {
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.font = '600 10px ui-monospace, SFMono-Regular, monospace';
  g.textAlign = 'center';
  for (let i = 0; i < 8; i++) {
    const c = lay.flip ? 7 - i : i;
    g.fillText('abcdefgh'[c]!, lay.x + i * lay.cell + lay.cell / 2, lay.y + lay.h + 16);
  }
  g.textAlign = 'left';
}

export const draughtsUI: BoardUI<DraughtsState> = {
  layout: (w, h, reserve, human, safe) => gridLayout(w, h, reserve, human, 1, safe),
  centre: gridCentre,
  hit: gridHit,
  rules: [
    'Pieces step one square forward on the diagonal, onto an empty dark square. Black starts at the top and comes down; White starts at the bottom and goes up.',
    'A capture is compulsory: if you can jump an opposing piece (by hopping over it onto the empty square just beyond) you must, and if the same piece can jump again it must. A piece that reaches the far row is crowned a king, and a crowned piece stops there. A king moves and jumps both ways.',
    'You win when the other side has no piece or no move. Forty moves each with no capture and no man moved is a draw. Tap a piece to see where it may go, tap the dot to move.',
  ],
  status: (s, human, thinking) => (thinking ? 'Ghosty is thinking' : (s.side === 1 ? 1 : 2) === human ? 'Your move' : 'Ghosty to move'),
  info: (s, human) => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 32; i++) if (s.b[i]) (Math.sign(s.b[i]!) === (human === 1 ? 1 : -1) ? a++ : b++);
    return `You ${a} · Ghosty ${b}`;
  },
  draw: (g, s, v, lay) => {
    const R = lay.cell;
    plate(g, lay.x, lay.y, lay.w, lay.h, v.accent);
    const ck = ckFrom([...s.b, s.side, s.quiet]);
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const dr = lay.flip ? 7 - r : r;
        const dc = lay.flip ? 7 - c : c;
        const dark = (r + c) % 2 === 1;
        g.fillStyle = dark ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.015)';
        g.fillRect(lay.x + dc * R, lay.y + dr * R, R, R);
      }
    g.strokeStyle = 'rgba(255,255,255,.12)';
    g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(lay.x + i * R, lay.y);
      g.lineTo(lay.x + i * R, lay.y + lay.h);
      g.moveTo(lay.x, lay.y + i * R);
      g.lineTo(lay.x + lay.w, lay.y + i * R);
      g.stroke();
    }
    coords(g, lay);
    gridMarks(g, v, lay, true);
    for (let i = 0; i < 32; i++) {
      const pc = ck.b[i]!;
      if (!pc) continue;
      const p = gridCentre(lay, cellOfSq(i));
      const mine = Math.sign(pc) === (v.human === 1 ? 1 : -1);
      const col = mine ? v.accent : '#e9edf3';
      disc(g, p.x, p.y + 2, R * 0.37, 'rgba(0,0,0,.45)');
      disc(g, p.x, p.y, R * 0.37, col, mine ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.35)');
      g.beginPath();
      g.arc(p.x, p.y, R * 0.24, 0, 6.3);
      g.strokeStyle = mine ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.18)';
      g.lineWidth = 1.5;
      g.stroke();
      if (Math.abs(pc) === 2) {
        g.fillStyle = mine ? '#04121a' : '#222a36';
        g.font = `800 ${Math.round(R * 0.36)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('K', p.x, p.y + 1);
        g.textBaseline = 'alphabetic';
        g.textAlign = 'left';
      }
    }
  },
};

export const othelloUI: BoardUI<OthelloState> = {
  layout: (w, h, reserve, human, safe) => gridLayout(w, h, reserve, human, 2, safe),
  centre: gridCentre,
  hit: gridHit,
  rules: [
    'Black moves first. On your turn put a disc on an empty square so that it closes in a straight line of the other side\'s discs between your new disc and one of yours (across, down or on a diagonal). Every disc you closed in turns to your colour.',
    'The squares where you may play are marked with a dot. If you have none you pass, and if neither side can move the game is over. The side with more discs wins.',
    'The corners can never be flipped, and the squares next to an empty corner often give it away. Ghosty knows that, and so do you now.',
  ],
  status: (s, human, thinking) => (thinking ? 'Ghosty is thinking' : s.side === human ? 'Your move' : 'Ghosty to move'),
  info: (s, human) => `You ${count(s.b, human)} · Ghosty ${count(s.b, human === 1 ? 2 : 1)}`,
  draw: (g, s, v, lay) => {
    const R = lay.cell;
    plate(g, lay.x, lay.y, lay.w, lay.h, v.accent);
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        g.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.025)';
        g.fillRect(lay.x + c * R, lay.y + r * R, R, R);
      }
    g.strokeStyle = 'rgba(255,255,255,.12)';
    g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(lay.x + i * R, lay.y);
      g.lineTo(lay.x + i * R, lay.y + lay.h);
      g.moveTo(lay.x, lay.y + i * R);
      g.lineTo(lay.x + lay.w, lay.y + i * R);
      g.stroke();
    }
    coords(g, lay);
    gridMarks(g, v, lay, false);
    for (let i = 0; i < 64; i++) {
      const sd = s.b[i]!;
      if (!sd) continue;
      const p = gridCentre(lay, i);
      disc(g, p.x, p.y + 2, R * 0.38, 'rgba(0,0,0,.45)');
      disc(g, p.x, p.y, R * 0.38, sd === 1 ? '#161b24' : '#f1f4f9', sd === 1 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)');
    }
    // where he may play: dots, shown on his turn
    if (v.turnHuman && !v.over)
      for (const c of v.targets) {
        const p = gridCentre(lay, c);
        g.globalAlpha = pulse(v);
        disc(g, p.x, p.y, R * 0.14, v.accent);
        g.globalAlpha = 1;
      }
  },
};

// ---------------------------------------------------------------- Connect 4

export const connect4UI: BoardUI<C4State> = {
  layout: (w, h, reserve, human, safe) => {
    const t = TOP + safe;
    const cell = Math.floor(Math.min((w - 28) / 7, (h - t - reserve - 56) / 6));
    const x = Math.round((w - cell * 7) / 2);
    const y = Math.round(t + 44 + (h - t - reserve - 44 - cell * 6) / 2);
    return { x, y, cell, w: cell * 7, h: cell * 6, flip: human === 2, top: 0, bar: 0, tray: 0 };
  },
  centre: (lay, col) => ({ x: lay.x + col * lay.cell + lay.cell / 2, y: lay.y - 20 }),
  hit: (lay, x, y) => {
    const c = Math.floor((x - lay.x) / lay.cell);
    return c < 0 || c > 6 || y < lay.y - 56 || y > lay.y + lay.h ? -1 : c;
  },
  rules: [
    'Take turns dropping a disc into one of the seven columns: it falls to the lowest empty slot. Tap a column to drop yours.',
    'The first to make four of their own in a row, across, down or on a diagonal, wins. If the board fills with no four, it is a draw.',
    'Watch for a row of three with an open end: that is a threat, and two threats at once cannot both be blocked.',
  ],
  status: (s, human, thinking) => (s.w ? '' : thinking ? 'Ghosty is thinking' : (s.n % 2 === 0 ? 1 : 2) === human ? 'Your move' : 'Ghosty to move'),
  info: (s) => `${s.n} disc${s.n === 1 ? '' : 's'} played`,
  draw: (g, s, v, lay) => {
    const R = lay.cell;
    plate(g, lay.x, lay.y, lay.w, lay.h, v.accent);
    g.fillStyle = 'rgba(255,255,255,.04)';
    g.fillRect(lay.x, lay.y, lay.w, lay.h);
    for (let c = 0; c < 7; c++) {
      const cx = lay.x + c * R + R / 2;
      if (v.targets.includes(c) && v.turnHuman && !v.over) {
        g.globalAlpha = pulse(v);
        g.fillStyle = v.accent;
        g.beginPath();
        g.moveTo(cx - 8, lay.y - 26);
        g.lineTo(cx + 8, lay.y - 26);
        g.lineTo(cx, lay.y - 14);
        g.fill();
        g.globalAlpha = 1;
      }
      if (v.cursor === c && v.turnHuman) ringAt(g, cx, lay.y - 20, 14, INK, 2);
      if (v.hint && v.hint[1] === c) ringAt(g, cx, lay.y - 20, 18, ghosty, 3);
      for (let r = 0; r < 6; r++) {
        const cy = lay.y + (5 - r) * R + R / 2;
        const val = s.b[c * ROWS + r]!;
        disc(g, cx, cy, R * 0.4, val ? 'rgba(0,0,0,.4)' : 'rgba(0,0,0,.55)');
        if (val) {
          const mine = val === v.human;
          disc(g, cx, cy, R * 0.36, mine ? v.accent : ghosty, 'rgba(255,255,255,.35)');
          if (v.last[0] === c && s.h[c] === r + 1) ringAt(g, cx, cy, R * 0.44, '#ffffff', 2);
        }
      }
    }
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.font = '600 10px ui-monospace, monospace';
    g.textAlign = 'center';
    for (let c = 0; c < 7; c++) g.fillText(String(c + 1), lay.x + c * R + R / 2, lay.y + lay.h + 18);
    g.textAlign = 'left';
  },
};

// ---------------------------------------------------------------- Backgammon

const bgLay = (w: number, h: number, reserve: number, human: Side, safe: number): Lay => {
  const topH = 56;
  const trayH = 46;
  const avail = h - TOP - safe - reserve - topH - trayH - 8;
  const cell = Math.floor(Math.min(avail / 12, 56));
  const bar = 44;
  const colW = Math.floor((w - 28 - bar) / 2);
  const x = Math.round((w - (colW * 2 + bar)) / 2);
  return { x, y: TOP + safe + topH, cell, w: colW, h: cell * 12, flip: human === 2, top: topH, bar, tray: trayH };
};
/** A point's row (0…11) and column (0 left, 1 right), as drawn for this player. */
const bgSlot = (lay: Lay, idx: number): { row: number; col: number } => {
  const i = lay.flip ? 23 - idx : idx;
  return i >= 12 ? { row: i - 12, col: 0 } : { row: 11 - i, col: 1 };
};
const bgCentre = (lay: Lay, cell: number): { x: number; y: number } => {
  if (cell === BAR) return { x: lay.x + lay.w + lay.bar / 2, y: lay.y + lay.h / 2 };
  if (cell === OFF) return { x: lay.x + lay.w / 2, y: lay.y + lay.h + lay.tray / 2 + 4 };
  const { row, col } = bgSlot(lay, cell);
  const cx = col === 0 ? lay.x + lay.w / 2 : lay.x + lay.w + lay.bar + lay.w / 2;
  return { x: cx, y: lay.y + row * lay.cell + lay.cell / 2 };
};
const bgHit = (lay: Lay, x: number, y: number): number => {
  if (y >= lay.y + lay.h && y <= lay.y + lay.h + lay.tray + 8 && x >= lay.x && x <= lay.x + lay.w) return OFF;
  if (y < lay.y || y > lay.y + lay.h) return -1;
  if (x > lay.x + lay.w && x < lay.x + lay.w + lay.bar) return BAR;
  const col = x < lay.x + lay.w ? 0 : x > lay.x + lay.w + lay.bar ? 1 : -1;
  if (col < 0) return -1;
  const row = Math.floor((y - lay.y) / lay.cell);
  if (row < 0 || row > 11) return -1;
  const i = col === 0 ? 12 + row : 11 - row;
  return lay.flip ? 23 - i : i;
};
const die = (g: CanvasRenderingContext2D, x: number, y: number, s: number, n: number, on: boolean, col: string) => {
  g.globalAlpha = on ? 1 : 0.28;
  g.fillStyle = '#f1f4f9';
  rr(g, x, y, s, s, 7);
  g.fill();
  g.fillStyle = '#161b24';
  const pos: Record<number, [number, number][]> = { 1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]], 4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]], 5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]], 6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]] };
  for (const [a, b] of pos[n] ?? []) {
    g.beginPath();
    g.arc(x + a * s, y + b * s, s * 0.075, 0, 6.3);
    g.fill();
  }
  if (!on) {
    g.strokeStyle = col;
    g.lineWidth = 1;
  }
  g.globalAlpha = 1;
};

export const backgammonUI: BoardUI<BgState> = {
  layout: bgLay,
  centre: bgCentre,
  hit: bgHit,
  rules: [
    'Fifteen checkers each. White goes round the board one way and Black the other: you start bottom right, up the right side, over the top, down the left side, and your home board is the six points at the bottom left. Tap a checker, then where it goes.',
    'The two dice are rolled for you and shown; each die moves one checker that many points. A point with two or more of the other side\'s checkers is blocked. Land on a single checker (a blot) and it is hit: it goes to the bar in the middle, and its owner must bring it back in before moving anything else. Doubles play four times. You must play both dice if you can, or the larger if you can play only one.',
    'When all your checkers are in your home board you may bear them off (tap Bear off). The first to bear off all fifteen wins. The dice are rolled fairly by the game and shown, never by Ghosty. This one has no doubling cube.',
  ],
  status: (s, human, thinking) => (s.w ? '' : thinking ? 'Ghosty is thinking' : s.side === human ? 'Your move' : 'Ghosty to move'),
  info: (s, human) => {
    const o = human === 1 ? 2 : 1;
    return `Pips: you ${pips(s, human)} · Ghosty ${pips(s, o)} · off ${s.off[human]} / ${s.off[o]}`;
  },
  draw: (g, s, v, lay) => {
    const R = lay.cell;
    const total = lay.w * 2 + lay.bar;
    plate(g, lay.x, lay.y, total, lay.h + lay.tray + 8, v.accent);
    // the dice, shown, with whose roll it is
    const dsz = 40;
    const roll = s.roll;
    const left = s.dice.slice();
    g.fillStyle = INK;
    g.font = '600 12px system-ui, sans-serif';
    g.fillText(s.w ? 'Game over' : s.side === v.human ? 'Your roll' : 'Ghosty rolled', lay.x, lay.y - 36);
    roll.forEach((d, i) => {
      const on = left.includes(d);
      if (on) left.splice(left.indexOf(d), 1);
      const same = roll[0] === roll[1];
      if (same && i > 0) return;
      die(g, lay.x + i * (dsz + 8) + (same ? 0 : 0), lay.y - 50 + 14, dsz, d, on || (same && s.dice.length > 0), v.accent);
    });
    if (roll[0] === roll[1]) {
      g.fillStyle = INK;
      g.font = '700 13px system-ui, sans-serif';
      g.fillText(`× ${s.dice.length} left`, lay.x + dsz + 12, lay.y - 50 + 14 + 26);
    }
    // the points
    for (let idx = 0; idx < 24; idx++) {
      const { row, col } = bgSlot(lay, idx);
      const y0 = lay.y + row * R;
      const x0 = col === 0 ? lay.x : lay.x + lay.w + lay.bar;
      const dark = (idx + (lay.flip ? 1 : 0)) % 2 === 0;
      g.fillStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)';
      g.beginPath();
      if (col === 0) {
        g.moveTo(x0, y0 + 2);
        g.lineTo(x0 + lay.w, y0 + R / 2);
        g.lineTo(x0, y0 + R - 2);
      } else {
        g.moveTo(x0 + lay.w, y0 + 2);
        g.lineTo(x0, y0 + R / 2);
        g.lineTo(x0 + lay.w, y0 + R - 2);
      }
      g.closePath();
      g.fill();
      if (v.last.includes(idx)) {
        g.fillStyle = 'rgba(255,255,255,.07)';
        g.fillRect(x0, y0, lay.w, R);
      }
      if (v.targets.includes(idx) && v.turnHuman) {
        g.globalAlpha = 0.18 + 0.12 * pulse(v);
        g.fillStyle = v.accent;
        g.fillRect(x0, y0, lay.w, R);
        g.globalAlpha = 1;
        const p = bgCentre(lay, idx);
        disc(g, col === 0 ? x0 + lay.w - 18 : x0 + 18, p.y, 6, v.accent);
      }
      // the checkers, from the base inward
      const n = s.p[idx]!;
      const cnt = Math.abs(n);
      if (cnt) {
        const mine = Math.sign(n) === (v.human === 1 ? 1 : -1);
        const shown = Math.min(cnt, 5);
        const r = Math.min(R * 0.4, 16);
        for (let k = 0; k < shown; k++) {
          const cx = col === 0 ? x0 + r + 6 + k * (r * 1.9) : x0 + lay.w - r - 6 - k * (r * 1.9);
          const cy = y0 + R / 2;
          disc(g, cx, cy + 1.5, r, 'rgba(0,0,0,.45)');
          disc(g, cx, cy, r, mine ? v.accent : '#e9edf3', mine ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.3)');
        }
        if (cnt > 5) {
          g.fillStyle = mine ? '#04121a' : '#161b24';
          g.font = '800 12px system-ui, sans-serif';
          g.textAlign = 'center';
          const cx = col === 0 ? x0 + r + 6 + 4 * (r * 1.9) : x0 + lay.w - r - 6 - 4 * (r * 1.9);
          g.fillText(String(cnt), cx, y0 + R / 2 + 4);
          g.textAlign = 'left';
        }
      }
      if (v.sel === idx) {
        g.strokeStyle = v.accent;
        g.lineWidth = 2.5;
        g.strokeRect(x0 + 1.5, y0 + 1.5, lay.w - 3, R - 3);
      }
      if (v.cursor === idx && v.turnHuman) {
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.setLineDash([4, 4]);
        g.strokeRect(x0 + 3, y0 + 3, lay.w - 6, R - 6);
        g.setLineDash([]);
      }
      if (v.hint && (v.hint[0] === idx || v.hint[1] === idx)) {
        g.strokeStyle = ghosty;
        g.lineWidth = 3;
        g.strokeRect(x0 + 1.5, y0 + 1.5, lay.w - 3, R - 3);
      }
    }
    // the bar, with what waits on it
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.fillRect(lay.x + lay.w, lay.y, lay.bar, lay.h);
    const barCell = (side: Side, y: number) => {
      const cnt = s.bar[side]!;
      if (!cnt) return;
      const mine = side === v.human;
      disc(g, lay.x + lay.w + lay.bar / 2, y, 14, mine ? v.accent : '#e9edf3', 'rgba(255,255,255,.4)');
      if (cnt > 1) {
        g.fillStyle = mine ? '#04121a' : '#161b24';
        g.font = '800 12px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(String(cnt), lay.x + lay.w + lay.bar / 2, y + 4);
        g.textAlign = 'left';
      }
    };
    barCell(v.human, lay.y + lay.h * 0.6);
    barCell(v.human === 1 ? 2 : 1, lay.y + lay.h * 0.4);
    if (v.sel === BAR || (v.cursor === BAR && v.turnHuman)) {
      g.strokeStyle = v.sel === BAR ? v.accent : INK;
      g.lineWidth = 2.5;
      g.strokeRect(lay.x + lay.w + 1.5, lay.y + 1.5, lay.bar - 3, lay.h - 3);
    }
    // the tray: bearing off
    const ty = lay.y + lay.h + 4;
    const can = v.targets.includes(OFF) && v.turnHuman;
    g.fillStyle = can ? v.accent : 'rgba(255,255,255,.07)';
    g.globalAlpha = can ? 0.25 + 0.15 * pulse(v) : 1;
    rr(g, lay.x, ty, lay.w, lay.tray - 2, 8);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = can ? '#ffffff' : 'rgba(255,255,255,.55)';
    g.font = '700 13px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`Bear off · ${s.off[v.human]} home`, lay.x + lay.w / 2, ty + lay.tray / 2 + 3);
    g.textAlign = 'left';
    if (v.cursor === OFF && v.turnHuman) {
      g.strokeStyle = INK;
      g.setLineDash([4, 4]);
      g.lineWidth = 2;
      rr(g, lay.x + 2, ty + 2, lay.w - 4, lay.tray - 6, 7);
      g.stroke();
      g.setLineDash([]);
    }
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.font = '600 12px system-ui, sans-serif';
    g.textAlign = 'right';
    g.fillText(`Ghosty home ${s.off[v.human === 1 ? 2 : 1]}`, lay.x + total, ty + lay.tray / 2 + 3);
    g.textAlign = 'left';
  },
};
