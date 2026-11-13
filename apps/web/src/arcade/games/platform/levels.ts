/**
 * THE PLATFORMER's eight levels, of our own. Each is a theme and a run of hand-made pieces (a piece is a few rows of tiles
 * written in the little language below), a start, a checkpoint flag in the middle and a flag at the end. Every piece begins
 * and ends on the same ground, so any two of them join and every level can be crossed from the start.
 *
 * The tile letters: # ground · p ledge · B crate · P crate with a glow fruit in it · o coin · ^ spring · w walker · h hopper ·
 * f flyer · s shell · F falling block · M moving platform · . air. The ground's top is row 10 of 12.
 */

export const ROWS = 12;
export const GROUND = 10;

export interface Theme {
  id: string;
  name: string;
  /** Sky from top to bottom, the ground, its top edge, the ledges, the far hills, the near hills. */
  sky: [string, string];
  ground: string;
  top: string;
  ledge: string;
  far: string;
  near: string;
  /** What drifts in the air: 'none', 'flakes', 'bubbles', 'embers', 'clouds'. */
  air: 'none' | 'flakes' | 'bubbles' | 'embers' | 'motes';
  /** The shapes of the two parallax layers. */
  shapes: 'hills' | 'caves' | 'roofs' | 'factory' | 'clouds' | 'ship' | 'snow' | 'tower';
}

export const THEMES: Theme[] = [
  { id: 'hills', name: 'Green Hills', sky: ['#5fb4ff', '#d9f2ff'], ground: '#6b4a2f', top: '#59c25a', ledge: '#b9824a', far: '#8fd4a0', near: '#5ab26a', air: 'motes', shapes: 'hills' },
  { id: 'caves', name: 'Glowstone Caves', sky: ['#1a1030', '#3b2a5c'], ground: '#4a3a66', top: '#7a62b0', ledge: '#6a5890', far: '#2c2048', near: '#3a2b5e', air: 'motes', shapes: 'caves' },
  { id: 'roofs', name: 'Rooftops at Dusk', sky: ['#ff8a5c', '#ffd9a0'], ground: '#4b3b52', top: '#8a6a8f', ledge: '#6d567a', far: '#b3647a', near: '#7f4a6e', air: 'none', shapes: 'roofs' },
  { id: 'factory', name: 'The Old Factory', sky: ['#2a2f38', '#4a525e'], ground: '#59606b', top: '#e0a030', ledge: '#78808c', far: '#3a414c', near: '#454d59', air: 'embers', shapes: 'factory' },
  { id: 'clouds', name: 'Cloud Garden', sky: ['#7ac8ff', '#f2fbff'], ground: '#e6f2ff', top: '#ffffff', ledge: '#cfe6ff', far: '#c8e4ff', near: '#e4f2ff', air: 'motes', shapes: 'clouds' },
  { id: 'ship', name: 'The Sunken Ship', sky: ['#07304a', '#0f6a88'], ground: '#3d4a4a', top: '#4fa89a', ledge: '#7a5a3a', far: '#0b4a66', near: '#0d5873', air: 'bubbles', shapes: 'ship' },
  { id: 'snow', name: 'Snowfield', sky: ['#9ab8d8', '#eef6ff'], ground: '#cfdcea', top: '#ffffff', ledge: '#a9bdd4', far: '#c4d4e6', near: '#dbe6f2', air: 'flakes', shapes: 'snow' },
  { id: 'tower', name: 'The Tower', sky: ['#120c26', '#3a1f55'], ground: '#5a4a78', top: '#f0c040', ledge: '#7a64a0', far: '#2a1a46', near: '#3c2662', air: 'embers', shapes: 'tower' },
];

type Cmd = [string, ...number[]];
const parse = (spec: string): Cmd[] => spec.split(';').map((s) => s.trim().split(/\s+/)).filter((p) => p[0]).map(([c, ...n]) => [c!, ...n.map(Number)] as Cmd);

/** Build a piece: `w` columns, twelve rows, from its commands. */
export function piece(w: number, spec: string): string[] {
  const g: string[][] = Array.from({ length: ROWS }, (_, y) => Array.from({ length: w }, () => (y >= GROUND ? '#' : '.')));
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < w && y >= 0 && y < ROWS) g[y]![x] = c;
  };
  for (const [c, a = 0, b = 0, d = 0, e = 0] of parse(spec)) {
    if (c === 'pit') for (let x = a; x < a + b; x++) for (let y = GROUND; y < ROWS; y++) put(x, y, '.');
    else if (c === 'blk') for (let x = a; x < a + d; x++) for (let y = b; y < b + e; y++) put(x, y, '#');
    else if (c === 'plat') for (let x = a; x < a + d; x++) put(x, b, 'p');
    else if (c === 'crate') for (let x = a; x < a + d; x++) put(x, b, 'B');
    else if (c === 'fruit') put(a, b, 'P');
    else if (c === 'coin') for (let x = a; x < a + d; x++) put(x, b, 'o');
    else if (c === 'arc') for (let i = 0; i < d; i++) put(a + i, b - Math.round(Math.sin((i / Math.max(1, d - 1)) * Math.PI) * 2), 'o');
    else if (c === 'spring') put(a, 9, '^');
    else if (c === 'walker') put(a, b || 9, 'w');
    else if (c === 'hopper') put(a, b || 9, 'h');
    else if (c === 'shell') put(a, b || 9, 's');
    else if (c === 'flyer') put(a, b, 'f');
    else if (c === 'fall') for (let x = a; x < a + d; x++) put(x, b, 'F');
    else if (c === 'mover') put(a, b, 'M');
  }
  return g.map((r) => r.join(''));
}

/** The pieces, by name: width and commands. */
export const PIECES: Record<string, [number, string]> = {
  start: [10, 'coin 5 8 3'],
  goal: [12, 'coin 2 8 3'],
  flat: [14, 'coin 3 8 4; coin 9 8 3'],
  pit3: [14, 'pit 5 3; arc 4 8 6'],
  pit4: [14, 'pit 5 4; arc 3 8 8'],
  pit5: [16, 'pit 5 5; arc 3 8 10'],
  walk1: [14, 'walker 8; coin 2 9 3'],
  walk2: [16, 'walker 6; walker 11; coin 3 7 2'],
  stairs: [16, 'blk 3 9 10 1; blk 5 8 6 1; blk 7 7 2 1; coin 7 5 2'],
  crates: [14, 'crate 5 6 1; fruit 6 6; crate 7 6 1; coin 4 4 5'],
  hop1: [16, 'hopper 9; coin 3 8 3'],
  hop2: [16, 'hopper 6; pit 9 2; hopper 13'],
  sky: [16, 'flyer 6 7; flyer 11 6; plat 4 7 3; plat 9 7 3; coin 4 6 3; coin 9 6 3'],
  shells: [16, 'shell 6; shell 12; coin 4 8 2'],
  spring: [14, 'spring 4; plat 7 4 5; coin 7 3 5'],
  bridge: [16, 'pit 3 8; fall 4 10 6; coin 4 8 6'],
  mover: [16, 'pit 4 5; mover 5 10; coin 5 7 3'],
  gaunt1: [18, 'walker 5; pit 8 3; hopper 13; coin 3 8 3'],
  gaunt2: [18, 'shell 5; pit 9 4; walker 14; crate 12 6 1'],
  ledges: [16, 'plat 3 7 3; plat 7 5 3; plat 11 7 3; coin 3 6 3; coin 7 4 3'],
  gaunt3: [18, 'walker 4; walker 8; hopper 13; pit 10 2'],
  snow: [16, 'pit 4 3; walker 9; shell 13'],
  roofs: [18, 'pit 3 3; pit 10 4; flyer 14 6; coin 12 7 2'],
};

export interface LevelDef {
  name: string;
  theme: Theme;
  pieces: string[];
}
const T = (i: number): Theme => THEMES[i]!;
export const LEVELS: LevelDef[] = [
  { name: 'Green Hills', theme: T(0), pieces: ['start', 'flat', 'walk1', 'pit3', 'stairs', 'crates', 'hop1', 'pit3', 'walk2', 'flat', 'goal'] },
  { name: 'Glowstone Caves', theme: T(1), pieces: ['start', 'walk1', 'pit4', 'hop1', 'spring', 'walk2', 'crates', 'pit3', 'hop2', 'shells', 'goal'] },
  { name: 'Rooftops at Dusk', theme: T(2), pieces: ['start', 'flat', 'roofs', 'pit4', 'sky', 'walk1', 'roofs', 'bridge', 'ledges', 'gaunt1', 'goal'] },
  { name: 'The Old Factory', theme: T(3), pieces: ['start', 'walk2', 'mover', 'crates', 'gaunt2', 'pit4', 'shells', 'stairs', 'gaunt1', 'bridge', 'goal'] },
  { name: 'Cloud Garden', theme: T(4), pieces: ['start', 'sky', 'pit5', 'spring', 'hop2', 'mover', 'ledges', 'sky', 'pit4', 'gaunt3', 'goal'] },
  { name: 'The Sunken Ship', theme: T(5), pieces: ['start', 'hop1', 'pit4', 'shells', 'bridge', 'walk2', 'gaunt2', 'mover', 'crates', 'gaunt3', 'goal'] },
  { name: 'Snowfield', theme: T(6), pieces: ['start', 'snow', 'pit4', 'shells', 'hop2', 'snow', 'bridge', 'gaunt2', 'pit5', 'gaunt3', 'snow', 'goal'] },
  { name: 'The Tower', theme: T(7), pieces: ['start', 'gaunt1', 'pit5', 'sky', 'gaunt2', 'mover', 'gaunt3', 'bridge', 'hop2', 'shells', 'pit5', 'gaunt3', 'goal'] },
];

/** A level's rows joined: the whole tile map, and where each piece began (the checkpoint stands at the middle one). */
export function build(def: LevelDef): { rows: string[]; starts: number[]; width: number } {
  const parts = def.pieces.map((n) => piece(...PIECES[n]!));
  const starts: number[] = [];
  let x = 0;
  for (const p of parts) {
    starts.push(x);
    x += p[0]!.length;
  }
  return { rows: Array.from({ length: ROWS }, (_, y) => parts.map((p) => p[y]).join('')), starts, width: x };
}
