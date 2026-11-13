/**
 * THE STUDIO'S DRAWING (BRIEF-EDITOR-GAME-STUDIO): every tile and sprite here is drawn by us, in the kit's colours (the worlds
 * of arcade/games/platform/levels.ts and the pixel editor's sixteen inks), and what he draws is his. One file draws a game
 * for the room editor, the thumbnails, the arcade's engine and the exported page, so a game looks the same everywhere.
 * No page state: everything is handed in.
 */
import { type Anim, BLANK, frameAt, frameOf, type Frame, type Game, INKS, isCustom, type Room, themeOf, TS, thingIcon } from './model';
import type { Theme } from '../arcade/games/platform/levels';
import { type Play, questLine } from './play';

const sprites = new Map<string, HTMLCanvasElement>();
/** A 16 × 16 picture as a canvas (kept by its pixels). */
export function frameCanvas(f: Frame): HTMLCanvasElement {
  let c = sprites.get(f);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = frameAt(f, x, y);
      const hex = INKS[i]?.hex;
      if (hex) {
        g.fillStyle = hex;
        g.fillRect(x, y, 1, 1);
      }
    }
  if (sprites.size > 600) sprites.clear();
  sprites.set(f, c);
  return c;
}

const tiles = new Map<string, HTMLCanvasElement>();
const hexMix = (a: string, b: string, k: number): string => {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k).toString(16).padStart(2, '0')).join('')}`;
};
const WHITE = INKS[2]!.hex;
const BLACK = INKS[1]!.hex;

/** One built-in tile drawn for a world: a 16 × 16 canvas, by letter. */
function paint(g: CanvasRenderingContext2D, ch: string, th: Theme): void {
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  const dark = hexMix(th.ground, BLACK, 0.3);
  const light = hexMix(th.ground, WHITE, 0.18);
  if (ch === '#') {
    px(0, 0, 16, 16, th.ground);
    for (let i = 0; i < 9; i++) px((i * 7 + 3) % 15, 3 + ((i * 5) % 12), 2, 1, i % 2 ? dark : light);
    px(0, 0, 16, 4, th.top);
    px(0, 4, 16, 1, hexMix(th.top, BLACK, 0.25));
    for (let x = 0; x < 16; x += 4) px(x + 1, 3, 2, 2, hexMix(th.top, BLACK, 0.2));
  } else if (ch === 'W') {
    px(0, 0, 16, 16, hexMix(th.ledge, BLACK, 0.25));
    for (let r = 0; r < 4; r++) {
      px(0, r * 4 + 3, 16, 1, dark);
      const o = r % 2 ? 4 : 0;
      for (let x = o; x < 16; x += 8) px(x, r * 4, 1, 4, dark);
      for (let x = o; x < 16; x += 8) px(x + 1, r * 4, 6, 1, hexMix(th.ledge, WHITE, 0.25));
    }
  } else if (ch === 'B') {
    px(0, 0, 16, 16, th.ledge);
    px(0, 0, 16, 2, hexMix(th.ledge, WHITE, 0.3));
    px(0, 14, 16, 2, dark);
    px(0, 0, 2, 16, hexMix(th.ledge, WHITE, 0.15));
    px(14, 0, 2, 16, dark);
    for (let i = 2; i < 14; i++) px(i, i, 1, 1, dark), px(15 - i, i, 1, 1, dark);
  } else if (ch === 'p') {
    px(0, 0, 16, 5, th.ledge);
    px(0, 0, 16, 1, hexMix(th.ledge, WHITE, 0.35));
    px(0, 5, 16, 1, dark);
    for (let x = 3; x < 16; x += 6) px(x, 1, 1, 4, dark);
  } else if (ch === '~') {
    px(0, 0, 16, 16, hexMix(th.far, INKS[10]!.hex, 0.5));
    for (let x = 0; x < 16; x += 4) px(x, 2 + ((x / 4) % 2) * 2, 3, 1, hexMix(th.far, WHITE, 0.55));
    px(0, 0, 16, 1, hexMix(th.far, WHITE, 0.7));
  } else if (ch === '^') {
    for (let i = 0; i < 2; i++) {
      for (let y = 0; y < 8; y++) px(i * 8 + 4 - Math.floor(y / 2), 8 + y, 1 + Math.floor(y / 2) * 2, 1, y < 2 ? WHITE : hexMix(INKS[14]!.hex, BLACK, y / 16));
    }
    px(0, 15, 16, 1, dark);
  } else if (ch === 'u') {
    px(1, 13, 14, 3, dark);
    for (let y = 5; y < 13; y += 2) px(3, y, 10, 1, y % 4 === 1 ? INKS[15]!.hex : INKS[13]!.hex);
    px(1, 3, 14, 3, INKS[7]!.hex);
    px(1, 3, 14, 1, INKS[12]!.hex);
  } else if (ch === 'D') {
    px(1, 0, 14, 16, dark);
    px(3, 2, 10, 14, hexMix(th.ledge, BLACK, 0.4));
    px(4, 3, 8, 13, th.ledge);
    px(7, 3, 1, 13, dark);
    px(10, 9, 2, 2, INKS[8]!.hex);
    px(3, 1, 10, 1, light);
  } else if (ch === 'c') {
    px(2, 6, 12, 9, INKS[3]!.hex);
    px(2, 4, 12, 3, INKS[5]!.hex);
    px(2, 9, 12, 1, hexMix(INKS[3]!.hex, BLACK, 0.4));
    px(7, 8, 2, 3, INKS[8]!.hex);
    px(2, 4, 12, 1, hexMix(INKS[5]!.hex, WHITE, 0.3));
  } else if (ch === 'i') {
    px(7, 7, 2, 9, hexMix(INKS[3]!.hex, BLACK, 0.2));
    px(2, 2, 12, 7, INKS[5]!.hex);
    px(2, 2, 12, 1, hexMix(INKS[5]!.hex, WHITE, 0.35));
    px(4, 4, 8, 1, hexMix(INKS[3]!.hex, BLACK, 0.4));
    px(4, 6, 6, 1, hexMix(INKS[3]!.hex, BLACK, 0.4));
  } else if (ch === 'V') {
    px(7, 1, 2, 3, INKS[13]!.hex);
    px(4, 4, 8, 9, INKS[8]!.hex);
    px(5, 5, 6, 7, hexMix(INKS[8]!.hex, WHITE, 0.7));
    px(6, 6, 4, 5, INKS[8]!.hex);
    px(3, 13, 10, 2, hexMix(INKS[13]!.hex, BLACK, 0.3));
    px(3, 3, 10, 1, hexMix(INKS[13]!.hex, BLACK, 0.3));
  } else if (ch === 'F') {
    px(3, 1, 2, 15, INKS[14]!.hex);
    px(5, 2, 9, 6, INKS[7]!.hex);
    px(5, 2, 9, 1, INKS[12]!.hex);
    px(2, 15, 4, 1, dark);
  } else if (ch === 'P') {
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(4, 3, 8, 11);
    px(6, 5, 1, 1, BLACK);
    px(9, 5, 1, 1, BLACK);
  } else if (ch === 'N' || ch === 'T') {
    px(3, 3, 10, 10, hexMix(th.near, WHITE, 0.4));
  }
}
/** A letter's tile: built in (drawn for the world) or one of his own. */
export function tileCanvas(game: Game, ch: string, th: Theme = themeOf(game.palette)): HTMLCanvasElement | null {
  const mine = isCustom(ch) ? game.tiles.find((t) => t.id === ch) : undefined;
  if (isCustom(ch)) return mine ? frameCanvas(mine.px) : null;
  if (ch === '.' || ch === ' ') return null;
  const key = `${th.id}:${ch}`;
  let c = tiles.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 16;
    paint(c.getContext('2d')!, ch, th);
    tiles.set(key, c);
  }
  return c;
}

const still = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** The sky and the far hills of a world (or a floor for a top-down game), behind a room. */
export function backdrop(g: CanvasRenderingContext2D, th: Theme, w: number, h: number, camX: number, camY: number, topdown: boolean, calm = still()): void {
  if (topdown) {
    g.fillStyle = hexMix(th.near, th.ground, 0.35);
    g.fillRect(0, 0, w, h);
    g.fillStyle = hexMix(th.near, BLACK, 0.12);
    const s = TS * 2;
    for (let y = -((camY % s) + s) % s; y < h; y += s) for (let x = -((camX % s) + s) % s; x < w; x += s) if (((Math.round((x + camX) / s) + Math.round((y + camY) / s)) & 1) === 0) g.fillRect(x, y, s, s);
    return;
  }
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, th.sky[0]);
  gr.addColorStop(1, th.sky[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  const par = calm ? 0 : 1;
  for (const [col, k, amp, base] of [[th.far, 0.2, 38, 0.72], [th.near, 0.45, 26, 0.84]] as const) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * base - Math.abs(Math.sin(((x + camX * k * par) / 70) * (k < 0.3 ? 1 : 1.7))) * amp);
    g.lineTo(w, h);
    g.fill();
  }
}

/** A room's tiles into a rectangle at `cell` pixels a tile, from tile (tx0, ty0): the room editor, the thumbnails and the game all use it. */
export function drawTiles(g: CanvasRenderingContext2D, game: Game, room: Room, o: { cell: number; ox: number; oy: number; tx0?: number; ty0?: number; tx1?: number; ty1?: number; t?: number; gone?: ReadonlySet<string>; chests?: ReadonlySet<string>; markers?: boolean }): void {
  const th = themeOf(room.bg || game.palette);
  g.imageSmoothingEnabled = false;
  const { cell } = o;
  const x0 = Math.max(0, o.tx0 ?? 0);
  const y0 = Math.max(0, o.ty0 ?? 0);
  const x1 = Math.min(room.w - 1, o.tx1 ?? room.w - 1);
  const y1 = Math.min(room.h - 1, o.ty1 ?? room.h - 1);
  const coin = frameCanvas(thingIcon('coin'));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const ch = room.rows[y]![x]!;
      const key = `${room.id}:${x},${y}`;
      const dx = o.ox + x * cell;
      const dy = o.oy + y * cell;
      if (ch === '.' || ch === ' ') continue;
      if (o.gone?.has(key) && (ch === 'o' || ch === 'T' || ch === 'B' || ch === 'w' || ch === 'h' || ch === 'f' || ch === 's' || ch === 'x')) continue;
      if (ch === 'o') {
        const bob = o.t !== undefined && !still() ? Math.round(Math.sin(o.t * 4 + x) * cell * 0.06) : 0;
        g.drawImage(coin, dx, dy + bob, cell, cell);
        continue;
      }
      if (ch === 'P' && !o.markers) continue;
      if (ch === 'N' || ch === 'T' || 'whfsx'.includes(ch)) {
        if (!o.markers) continue;
        const sp = game.sprites.find((s) => s.id === (ch === 'N' ? game.npcs.find((n) => n.id === room.marks[`${x},${y}`])?.sprite : ch === 'T' ? game.things.find((t) => t.id === room.marks[`${x},${y}`])?.sprite : game.enemySprites[{ w: 'walker', h: 'hopper', f: 'flyer', s: 'shell', x: 'chaser' }[ch]!]));
        if (sp) {
          g.drawImage(frameCanvas(frameOf(sp, 'idle', 0)), dx, dy, cell, cell);
          continue;
        }
      }
      let c = tileCanvas(game, ch, th);
      if (ch === 'c' && o.chests?.has(key)) c = tileCanvas(game, 'p', th);
      if (c) g.drawImage(c, dx, dy, cell, cell);
    }
}

/** A small picture of a game: its first room, as the shelf shows it. */
export function thumbnail(game: Game, w = 96, h = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const room = game.rooms.find((r) => r.id === game.start) ?? game.rooms[0];
  const th = themeOf(room?.bg ?? game.palette);
  backdrop(g, th, w, h, 0, 0, game.kind === 'topdown', true);
  if (!room) return c;
  const cell = Math.max(2, Math.floor(Math.min(w / room.w, h / Math.min(room.h, 16)) * 2) / 2);
  const winW = Math.floor(w / cell);
  const winH = Math.floor(h / cell);
  let tx0 = 0;
  let ty0 = Math.max(0, room.h - winH);
  for (let y = 0; y < room.h; y++) {
    const x = room.rows[y]!.indexOf('P');
    if (x >= 0) {
      tx0 = Math.max(0, Math.min(room.w - winW, x - 3));
      ty0 = Math.max(0, Math.min(room.h - winH, y - Math.floor(winH * 0.6)));
    }
  }
  drawTiles(g, game, room, { cell, ox: -tx0 * cell, oy: -ty0 * cell, tx0, ty0, tx1: tx0 + winW, ty1: ty0 + winH, markers: true });
  return c;
}

export interface View {
  w: number;
  h: number;
  t: number;
  /** The bottom of the screen the pad covers (px), so the player is never under a thumb. */
  reserve?: number;
}

const heart = (): HTMLCanvasElement => frameCanvas(thingIcon('heart'));
/** The game itself: the world, its people and foes, the player, and the hearts, coins and quest line over it. */
export function drawPlay(g: CanvasRenderingContext2D, p: Play, v: View): void {
  const game = p.game;
  const room = p.room;
  const th = themeOf(room.bg || game.palette);
  const top = game.kind === 'topdown';
  const calm = still();
  const base = g.getTransform();
  // fit about fourteen tiles across, or the whole room when it is smaller
  const scale = Math.max(1, v.w / (TS * Math.min(14, Math.max(8, room.w))));
  const viewW = v.w / scale;
  const viewH = (v.h - (v.reserve ?? 0)) / scale;
  const px = p.b.x + p.b.w / 2;
  const py = p.b.y + p.b.h / 2;
  const roomW = room.w * TS;
  const roomH = room.h * TS;
  let camX = roomW <= viewW ? -(viewW - roomW) / 2 : Math.max(0, Math.min(roomW - viewW, px - viewW / 2));
  let camY = roomH <= viewH ? (top ? -(viewH - roomH) / 2 : roomH - viewH) : Math.max(0, Math.min(roomH - viewH, py - viewH * (top ? 0.5 : 0.62)));
  if (roomH <= viewH && !top) camY = roomH - viewH;
  camX = Math.round(camX * scale) / scale;
  camY = Math.round(camY * scale) / scale;
  g.save();
  g.setTransform(base);
  backdrop(g, th, v.w, v.h, camX * scale, camY * scale, top, calm);
  g.scale(scale, scale);
  g.imageSmoothingEnabled = false;
  g.translate(-camX, -camY);
  drawTiles(g, game, room, { cell: TS, ox: 0, oy: 0, tx0: Math.floor(camX / TS) - 1, ty0: Math.floor(camY / TS) - 1, tx1: Math.ceil((camX + viewW) / TS) + 1, ty1: Math.ceil((camY + viewH) / TS) + 1, t: v.t, gone: p.gone, chests: p.chests });
  // people
  for (const s of p.npcs.get(p.rid) ?? []) {
    const n = game.npcs.find((x) => x.id === s.id);
    const sp = game.sprites.find((x) => x.id === n?.sprite);
    const talking = p.dialog?.npc === s.id;
    const f = frameOf(sp, talking ? 'talk' : Math.abs(s.b.vx) > 1 || Math.abs(s.b.vy) > 1 ? 'walk' : 'idle', v.t);
    blit(g, f, s.b.x - 2, s.b.y - (top ? 2 : 2), s.dir < 0);
  }
  for (const e of p.enemies.get(p.rid) ?? []) {
    if (!e.alive) continue;
    const sp = game.sprites.find((x) => x.id === game.enemySprites[e.kind]);
    blit(g, frameOf(sp, 'walk', e.t, 5), e.b.x - 2, e.b.y - 4 + (e.kind === 'flyer' ? 0 : 2), e.dir > 0);
  }
  // the player
  const hero = game.sprites.find((s) => s.id === game.player.sprite);
  if (!(p.invuln > 0 && Math.floor(p.t * 12) % 2 === 0 && !p.over)) {
    const anim: Anim = p.dialog ? 'talk' : p.anim;
    blit(g, frameOf(hero, anim, p.t, 8), p.b.x - (16 - p.b.w) / 2, p.b.y - (16 - p.b.h) + (top ? 0 : 0), p.face < 0);
  }
  g.restore();
  // the hearts, coins and the quest line
  g.save();
  g.setTransform(base);
  g.imageSmoothingEnabled = false;
  const ui = game.ui;
  const safe = 8;
  g.font = '600 15px -apple-system, system-ui, sans-serif';
  g.textBaseline = 'middle';
  const shadowText = (t: string, x: number, y: number, align: CanvasTextAlign = 'left', size?: string) => {
    if (size) g.font = size;
    g.textAlign = align;
    g.fillStyle = 'rgba(0,0,0,.75)';
    g.fillText(t, x + 1, y + 1);
    g.fillStyle = WHITE;
    g.fillText(t, x, y);
  };
  if (ui.hearts) for (let i = 0; i < game.player.hearts; i++) (g.globalAlpha = i < p.hearts ? 1 : 0.28), g.drawImage(heart(), safe + i * 24, safe + 22, 22, 22);
  g.globalAlpha = 1;
  if (ui.coins) {
    g.drawImage(frameCanvas(thingIcon('coin')), safe, safe + 46, 20, 20);
    shadowText(String(p.coins), safe + 24, safe + 56);
  }
  if (game.rules.timer > 0) shadowText(`${Math.floor(p.timeLeft / 60)}:${String(Math.floor(p.timeLeft % 60)).padStart(2, '0')}`, v.w - safe, safe + 56, 'right');
  if (ui.quest) {
    const q = questLine(p);
    if (q) shadowText(q, safe, safe + 8, 'left', '500 14px -apple-system, system-ui, sans-serif');
  }
  if (ui.sign && p.sign) {
    g.font = '500 15px -apple-system, system-ui, sans-serif';
    const lines = wrap(g, p.sign, v.w - 48);
    const bh = lines.length * 20 + 16;
    const by = (v.h - (v.reserve ?? 0)) * 0.3 - bh / 2;
    g.fillStyle = 'rgba(0,0,0,.78)';
    g.fillRect(16, by, v.w - 32, bh);
    lines.forEach((l, i) => shadowText(l, v.w / 2, by + 18 + i * 20, 'center'));
  }
  if (p.saidT > 0 && p.said) {
    const a = Math.min(1, p.saidT * 2);
    g.globalAlpha = a;
    g.font = '600 15px -apple-system, system-ui, sans-serif';
    const lines = wrap(g, p.said, v.w - 48);
    const by = (v.h - (v.reserve ?? 0)) * 0.46;
    lines.forEach((l, i) => shadowText(l, v.w / 2, by + i * 20, 'center'));
    g.globalAlpha = 1;
  }
  g.restore();
  void BLANK;
}
function blit(g: CanvasRenderingContext2D, f: Frame, x: number, y: number, flip: boolean): void {
  const c = frameCanvas(f);
  if (!flip) return g.drawImage(c, Math.round(x), Math.round(y));
  g.save();
  g.translate(Math.round(x) + 16, Math.round(y));
  g.scale(-1, 1);
  g.drawImage(c, 0, 0);
  g.restore();
}
export function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > max && line) (out.push(line), (line = word));
    else line = t;
  }
  if (line) out.push(line);
  return out.slice(0, 4);
}
