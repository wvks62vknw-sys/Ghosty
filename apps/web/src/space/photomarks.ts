/**
 * FROM PHOTO, finished (NEXT ROUND, MAKE lane): doors and windows tapped on the room the photos found, and sizes kept ROUGH until
 * one real measurement. Room photos give a width and a depth with a doubt (± cm) but cannot see doors and windows, so after the
 * photos the room is drawn as an outline over the picture and he taps where each door or window is on it. USE THIS PLAN puts
 * them in the plan at those places. The sizes stay marked rough (on this phone, `ghosty.space.rough`) until he types one wall's
 * real length or saves a MEASURE: then they are measured. Pure apart from that one key.
 */
import type { Plan } from './plan';
import { addOpening, ensureV2, updateOpening } from './rooms';

export type MarkType = 'door' | 'window';
/** A tap on the outline: which wall (0 top, 1 right, 2 bottom, 3 left, as the plan's box room has them) and how far along it (0–1). */
export interface Mark {
  type: MarkType;
  wall: number;
  frac: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The wall a tap at (x, y) is on, within `tol` px of the outline, and how far along it (clockwise from the top-left). */
export function edgeHit(x: number, y: number, b: Box, tol = 22): { wall: number; frac: number } | null {
  const inX = x >= b.x - tol && x <= b.x + b.w + tol;
  const inY = y >= b.y - tol && y <= b.y + b.h + tol;
  if (!inX || !inY) return null;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const d = [Math.abs(y - b.y), Math.abs(x - (b.x + b.w)), Math.abs(y - (b.y + b.h)), Math.abs(x - b.x)];
  const wall = d.indexOf(Math.min(...d));
  if (d[wall]! > tol) return null;
  // along each wall in the direction the plan's polygon runs: top left→right, right top→bottom, bottom right→left, left bottom→top
  const frac = wall === 0 ? (x - b.x) / b.w : wall === 1 ? (y - b.y) / b.h : wall === 2 ? (b.x + b.w - x) / b.w : (b.y + b.h - y) / b.h;
  return { wall, frac: clamp(frac) };
}

/** Where a mark sits on the outline (its point in px), for drawing it. */
export function markPoint(m: Mark, b: Box): [number, number] {
  if (m.wall === 0) return [b.x + m.frac * b.w, b.y];
  if (m.wall === 1) return [b.x + b.w, b.y + m.frac * b.h];
  if (m.wall === 2) return [b.x + b.w - m.frac * b.w, b.y + b.h];
  return [b.x, b.y + b.h - m.frac * b.h];
}

/** The marks with a tap added, or the mark under the tap taken away (a second tap on it). */
export function tapMarks(marks: Mark[], hit: { wall: number; frac: number }, type: MarkType, b: Box, near = 18): Mark[] {
  const [x, y] = markPoint({ type, ...hit }, b);
  const i = marks.findIndex((m) => {
    const [mx, my] = markPoint(m, b);
    return Math.hypot(mx - x, my - y) <= near;
  });
  if (i >= 0) return marks.filter((_, j) => j !== i);
  return [...marks, { type, ...hit }].slice(0, 12);
}

/**
 * The plan with each mark put in room `roomId` as a door or window, centred where it was tapped (moved along its wall to the
 * nearest place it fits). `missed`: the ones with no room on their wall.
 */
export function placeMarks(plan: Plan, roomId: string, marks: Mark[]): { plan: Plan; placed: number; missed: number } {
  let p = ensureV2(plan) as Plan;
  let placed = 0;
  let missed = 0;
  for (const m of marks) {
    try {
      const got = addOpening(p, roomId, m.wall, m.type);
      p = got.plan;
      const v2 = ensureV2(p);
      const op = v2.openings.find((o) => o.id === got.id)!;
      const room = v2.rooms.find((r) => r.id === roomId)!;
      const a = room.poly[m.wall]!;
      const b = room.poly[(m.wall + 1) % room.poly.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const want = Math.max(0, Math.min(len - op.w, m.frac * len - op.w / 2));
      try {
        p = updateOpening(p, got.id, { at: want });
      } catch {
        /* where he tapped is taken (another door there): it stays where addOpening found room, nearest the middle */
      }
      placed++;
    } catch {
      missed++;
    }
  }
  return { plan: p, placed, missed };
}

// ---------------------------------------------------------------- ROUGH until one real measurement

export const ROUGH_KEY = 'ghosty.space.rough';
export interface Rough {
  /** The room the photos sized. */
  room: string;
  /** Its doubt each way, cm. */
  wSd: number;
  dSd: number;
  at: number;
}

export function readRough(): Rough | null {
  try {
    const v = JSON.parse(localStorage.getItem(ROUGH_KEY) ?? 'null') as Rough | null;
    return v && typeof v.room === 'string' && Number.isFinite(v.wSd) && Number.isFinite(v.dSd) ? v : null;
  } catch {
    return null;
  }
}
export function setRough(r: Rough | null): void {
  try {
    if (r) localStorage.setItem(ROUGH_KEY, JSON.stringify(r));
    else localStorage.removeItem(ROUGH_KEY);
  } catch {
    /* storage refused: the mark lasts this visit only */
  }
}

/** The line MATERIALS and the plan show while the sizes are rough. */
export const roughWords = (r: Rough) =>
  `ROUGH SIZES: from photos, give or take ${Math.max(r.wSd, r.dSd)} cm. Tap one wall and type its real length (or save a MEASURE) to make them measured.`;
/** Said when one real measurement turns rough into measured. */
export const MEASURED_NOW = 'Measured: the sizes now come from your own measurement, not the photos.';
