/**
 * What THE PLATFORMER and THE CAVE share: a body that moves through a grid of 16-pixel tiles one axis at a time, so a
 * jump, a wall and a ledge behave the same in both. No drawing in here, nothing that asks the page for anything.
 */

export const TS = 16;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Body extends Box {
  vx: number;
  vy: number;
  onGround: boolean;
  /** −1 or 1 when a wall stopped it this step (0 none). */
  wall: number;
  /** The tiles its head struck this step, as [tx, ty]. */
  bumped: [number, number][];
}

export const body = (x: number, y: number, w: number, h: number): Body => ({ x, y, w, h, vx: 0, vy: 0, onGround: false, wall: 0, bumped: [] });

export type Solid = (tx: number, ty: number) => boolean;

export const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Move a body by its velocity: across, then down or up. A wall, a floor or a ceiling stops it (and says so). */
export function moveBody(b: Body, dt: number, solid: Solid): void {
  b.wall = 0;
  b.bumped.length = 0;
  b.onGround = false;
  const EPS = 1e-3;
  b.x += b.vx * dt;
  let x0 = Math.floor(b.x / TS);
  let x1 = Math.floor((b.x + b.w - EPS) / TS);
  let y0 = Math.floor(b.y / TS);
  let y1 = Math.floor((b.y + b.h - EPS) / TS);
  if (b.vx !== 0) {
    const dir = b.vx > 0 ? 1 : -1;
    const col = dir > 0 ? x1 : x0;
    for (let ty = y0; ty <= y1; ty++) {
      if (solid(col, ty)) {
        b.x = dir > 0 ? col * TS - b.w : (col + 1) * TS;
        b.vx = 0;
        b.wall = dir;
        break;
      }
    }
  }
  b.y += b.vy * dt;
  x0 = Math.floor(b.x / TS);
  x1 = Math.floor((b.x + b.w - EPS) / TS);
  y0 = Math.floor(b.y / TS);
  y1 = Math.floor((b.y + b.h - EPS) / TS);
  if (b.vy !== 0) {
    const dir = b.vy > 0 ? 1 : -1;
    const row = dir > 0 ? y1 : y0;
    let hit = false;
    for (let tx = x0; tx <= x1; tx++) {
      if (solid(tx, row)) {
        hit = true;
        if (dir < 0) b.bumped.push([tx, row]);
      }
    }
    if (hit) {
      b.y = dir > 0 ? row * TS - b.h : (row + 1) * TS;
      if (dir > 0) b.onGround = true;
      b.vy = 0;
    }
  } else {
    // standing still on something: stay "on the ground" while a tile is just under the feet
    const row = Math.floor((b.y + b.h + 0.5) / TS);
    for (let tx = x0; tx <= x1; tx++) if (solid(tx, row)) b.onGround = true;
  }
}

/** Approach a speed with an acceleration (never past it). */
export const toward = (v: number, target: number, a: number): number => (v < target ? Math.min(target, v + a) : Math.max(target, v - a));

/** What a jump is made of: the numbers every part of the feel hangs on. */
export const FEEL = {
  gravity: 950,
  jump: 340,
  /** The share of the rise kept when the jump button is let go early. */
  cut: 0.45,
  fall: 430,
  walk: 88,
  run: 142,
  accelGround: 14,
  accelAir: 9,
  coyote: 0.08,
  buffer: 0.1,
};
