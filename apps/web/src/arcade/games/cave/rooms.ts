/**
 * THE CAVE's twelve rooms, of our own: one connected cave of dark rock, bioluminescent moss, water that slows and drops that
 * fall. A room is 28 tiles wide and 16 high, written in a small language of commands (below), with its exits and the
 * way a walker would cross it (`route`, the cells Ghosty's bot heads for in turn). Three tools are found in order and each one
 * opens the cave further: the boots (a second jump) open the Shaft, the blaster opens the Rubble Run, the lamp shows the
 * hidden steps over the Glow Garden's chasm. Every word the dwellers say is ours.
 *
 * Tile letters: # rock · x rubble (the blaster breaks it) · v a hidden step (there once the lamp is) · G a gate (open once the
 * boss is gone) · ~ water · . air. Everything else (items, creatures, lanterns) is a spawn.
 */

export const RW = 28;
export const RH = 16;

export type Tool = 'boots' | 'blaster' | 'lamp';
export type CreatureKind = 'crawler' | 'flutter' | 'slug' | 'frog' | 'spike' | 'fish';
export interface Spawn {
  kind: string;
  x: number;
  y: number;
  /** An item's or a dweller's id. */
  id?: string;
}
export interface Exit {
  to: string;
  /** Where he arrives (a cell), for the ways up and down (the sides arrive at the opposite door). */
  ax?: number;
  ay?: number;
  needs?: Tool;
}
export interface RoomDef {
  id: string;
  n: number;
  name: string;
  dark: boolean;
  /** Where it sits on the map, in squares. */
  gx: number;
  gy: number;
  rows: string[];
  spawns: Spawn[];
  exits: { L?: Exit; R?: Exit; U?: Exit; D?: Exit };
  /** The cells a walker heads for in turn, as [x, y] of the cell its feet stand in; a y under 0 is the way up. */
  route: [number, number][];
  /** The pale colour of its moss. */
  glow: string;
}

const CREATURES = new Set(['crawler', 'flutter', 'slug', 'frog', 'spike', 'fish', 'boss1', 'boss2']);
interface Def {
  name: string;
  gx: number;
  gy: number;
  dark?: boolean;
  glow: string;
  cmds: string;
  exits: RoomDef['exits'];
  route: [number, number][];
}

function make(id: string, n: number, d: Def): RoomDef {
  const g: string[][] = Array.from({ length: RH }, (_, y) => Array.from({ length: RW }, (_, x) => (y === 0 || y === RH - 1 || x === 0 || x === RW - 1 ? '#' : '.')));
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < RW && y >= 0 && y < RH) g[y]![x] = c;
  };
  const spawns: Spawn[] = [];
  for (const raw of d.cmds.split(';')) {
    const p = raw.trim().split(/\s+/);
    const c = p[0];
    if (!c) continue;
    const a = Number(p[1]);
    const b = Number(p[2]);
    const w = Number(p[3]);
    const hh = Number(p[4]);
    if (c === 'fill') for (let x = a; x < a + w; x++) for (let y = b; y < b + hh; y++) put(x, y, '#');
    else if (c === 'plat') for (let x = a; x < a + w; x++) put(x, b, '#');
    else if (c === 'water') for (let x = a; x < a + w; x++) for (let y = b; y < b + hh; y++) put(x, y, '~');
    else if (c === 'rubble') for (let x = a; x < a + w; x++) for (let y = b; y < b + hh; y++) put(x, y, 'x');
    else if (c === 'hidden') for (let x = a; x < a + w; x++) put(x, b, 'v');
    else if (c === 'gate') for (let x = a; x < a + w; x++) for (let y = b; y < b + hh; y++) put(x, y, 'G');
    else if (c === 'hole') for (let x = a; x < a + w; x++) put(x, b, '.');
    else if (c === 'door') for (let y = b; y < b + w; y++) put(a, y, '.');
    else if (c === 'crystal') for (let i = 0; i < (w || 1); i++) spawns.push({ kind: 'crystal', x: a + i, y: b, id: `${id}:${a + i}:${b}` });
    else if (CREATURES.has(c) || c === 'lantern' || c === 'drip' || c === 'boots' || c === 'blaster' || c === 'lamp' || c === 'npc' || c === 'end') spawns.push({ kind: c, x: a, y: b, id: c === 'npc' ? String(p[3]) : c === 'boots' || c === 'blaster' || c === 'lamp' ? c : undefined });
  }
  return { id, n, name: d.name, dark: !!d.dark, gx: d.gx, gy: d.gy, rows: g.map((r) => r.join('')), spawns, exits: d.exits, route: d.route, glow: d.glow };
}

export const ROOMS: RoomDef[] = [
  make('landing', 1, { name: 'Lantern Landing', gx: 0, gy: 1, glow: '#7dffd0', cmds: 'door 27 12 3; lantern 13 14; npc 19 14 mo; plat 4 12 5', exits: { R: { to: 'moss' } }, route: [[26, 14]] }),
  make('moss', 2, { name: 'Moss Hall', gx: 1, gy: 1, glow: '#9dff8a', cmds: 'door 0 12 3; door 27 12 3; crawler 11 14; crawler 20 14; plat 7 12 4; plat 14 9 4; crystal 15 8 2; crystal 8 11 1; drip 23 1', exits: { L: { to: 'landing' }, R: { to: 'drip' } }, route: [[26, 14]] }),
  make('drip', 3, { name: 'Drip Tunnel', gx: 2, gy: 1, glow: '#7ad8ff', cmds: 'door 0 12 3; door 27 12 3; lantern 3 14; water 9 12 10 3; fish 12 13; fish 16 13; slug 22 1; drip 6 1; drip 25 1; plat 20 12 4; crystal 21 11 2', exits: { L: { to: 'moss' }, R: { to: 'nook' } }, route: [[26, 14]] }),
  make('nook', 4, { name: 'Crystal Nook', gx: 3, gy: 1, glow: '#d890ff', cmds: 'door 0 12 3; door 27 12 3; frog 25 14; plat 5 12 3; plat 9 9 3; plat 13 12 3; plat 17 9 4; boots 19 8; crystal 10 8 2; crystal 14 11 1; npc 3 14 pip', exits: { L: { to: 'drip' }, R: { to: 'shaft' } }, route: [[6, 11], [10, 8], [14, 11], [19, 8], [26, 14]] }),
  make('shaft', 5, { name: 'The Shaft', gx: 4, gy: 1, glow: '#ffd27a', cmds: 'door 0 12 3; hole 13 0 4; plat 3 10 7; plat 11 5 7; flutter 8 5; flutter 20 8; crystal 14 4 2', exits: { L: { to: 'nook' }, U: { to: 'gallery', ax: 18, ay: 14, needs: 'boots' } }, route: [[5, 9], [14, 4], [14, -2]] }),
  make('gallery', 6, { name: 'Upper Gallery', gx: 4, gy: 0, glow: '#ffb27a', cmds: 'door 27 12 3; hole 13 15 4; lantern 20 14; crawler 6 14; frog 9 14; plat 23 13 4; blaster 25 12; crystal 24 12 1; npc 22 14 vee', exits: { D: { to: 'shaft', ax: 14, ay: 1 }, R: { to: 'rubble' } }, route: [[18, 14], [25, 12], [26, 14]] }),
  make('rubble', 7, { name: 'Rubble Run', gx: 5, gy: 0, glow: '#ff9a9a', cmds: 'door 0 12 3; door 27 12 3; crawler 7 14; spike 12 14; crawler 16 14; rubble 20 1 3 14; plat 5 12 4; crystal 6 11 2', exits: { L: { to: 'gallery' }, R: { to: 'warren', needs: 'blaster' } }, route: [[26, 14]] }),
  make('warren', 8, { name: 'The Warren', gx: 6, gy: 0, dark: true, glow: '#ffe07a', cmds: 'door 0 12 3; door 27 12 3; lantern 3 14; slug 10 1; frog 13 14; spike 17 14; crawler 21 14; plat 22 12 4; lamp 24 11; crystal 12 11 1; plat 9 12 3', exits: { L: { to: 'rubble' }, R: { to: 'glow' } }, route: [[24, 11], [26, 14]] }),
  make('glow', 9, { name: 'Glow Garden', gx: 7, gy: 0, dark: true, glow: '#7dffb0', cmds: 'door 0 12 3; door 27 12 3; hole 7 15 14; hidden 8 13 2; hidden 12 12 2; hidden 16 13 2; flutter 12 8; flutter 16 7; crystal 10 11 1; crystal 14 10 2; crystal 18 11 1; npc 3 14 wren', exits: { L: { to: 'warren' }, R: { to: 'hollow', needs: 'lamp' } }, route: [[6, 14], [8, 12], [12, 11], [16, 12], [22, 14], [26, 14]] }),
  make('hollow', 10, { name: 'The Hollow', gx: 8, gy: 0, glow: '#ff7ad0', cmds: 'door 0 12 3; door 27 12 3; gate 26 12 1 3; lantern 3 14; boss1 21 13', exits: { L: { to: 'glow' }, R: { to: 'deep' } }, route: [[25, 14]] }),
  make('deep', 11, { name: 'Deep Water', gx: 9, gy: 0, glow: '#6ab8ff', cmds: 'door 0 12 3; door 27 12 3; water 5 9 17 6; fish 8 12; fish 14 13; fish 19 11; lantern 24 14; plat 8 7 3; plat 16 6 4; crystal 17 5 2; slug 12 1', exits: { L: { to: 'hollow' }, R: { to: 'heart' } }, route: [[26, 14]] }),
  make('heart', 12, { name: 'The Heart', gx: 10, gy: 0, glow: '#ff9ae0', cmds: 'door 0 12 3; lantern 3 14; boss2 19 9; crystal 8 13 1; crystal 20 13 1; end 26 14', exits: { L: { to: 'deep' } }, route: [[25, 14]] }),
];

export const ROOM_BY_ID: Record<string, RoomDef> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
export const roomOf = (id: string): RoomDef => ROOM_BY_ID[id] ?? ROOMS[0]!;

/** Which rooms can be reached holding these tools, by the doors alone and the gates the tools open (the order the tools come in). */
export function reachable(tools: readonly Tool[], from = 'landing'): string[] {
  const seen = new Set<string>([from]);
  const q = [from];
  while (q.length) {
    const r = ROOM_BY_ID[q.shift()!]!;
    for (const e of Object.values(r.exits)) {
      if (!e || seen.has(e.to) || (e.needs && !tools.includes(e.needs))) continue;
      seen.add(e.to);
      q.push(e.to);
    }
  }
  return [...seen];
}
/** What a tool is found in, and what it opens. */
export const TOOL_FOUND: Record<Tool, { room: string; opens: string; card: string[] }> = {
  boots: { room: 'nook', opens: 'shaft', card: ['The Spring Boots. Press jump again in the air and they will give you a second.', 'Some ledges in this cave are a little too far apart for one jump.'] },
  blaster: { room: 'gallery', opens: 'rubble', card: ['The Blaster. FIRE shoots where you face, or upward with up held.', 'It grows stronger on crystals, and a hit takes a little of that back. Rubble does not like it.'] },
  lamp: { room: 'warren', opens: 'glow', card: ['The Lamp. It lights the dark rooms a good way further, and it shows the steps that were always there.', 'Some of the garden is only there for a lit lamp.'] },
};
/** The dwellers' words (ours, short). */
export const TALK: Record<string, { name: string; lines: string[] }> = {
  mo: { name: 'Mo', lines: ['You are awake. Good. The lantern here will keep your place, and mend you, whenever you press USE by it.', 'The way out is far down the cave. I have never been. I only keep the moss.'] },
  pip: { name: 'Pip', lines: ['Something shiny at the far end of the ledges. Boots, I think. I could never make the jump, or the second one.'] },
  vee: { name: 'Vee', lines: ['The rubble ahead is old. A blaster would clear it, and there is one on the ledge past me. Shoot it before it shoots the rubble first.'] },
  wren: { name: 'Wren', lines: ['The garden has a chasm. You will not see the way across until you carry a light, so they say.', 'Past it, the Brood Mother sleeps. Sleeps lightly.'] },
};
