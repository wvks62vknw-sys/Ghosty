/**
 * FREE-FORM SLIDES, THE PURE PART (APPS ROUND, editors: the pro edition): any number of text boxes, pictures and shapes laid freely on the
 * 1,280 × 720 slide, over its layout. Dragging snaps to the slide's centre and edges and to the other items' edges and centres (the guides
 * it snapped to are given back for the screen to draw); ALIGN left, centre, right, top, middle, bottom; DISTRIBUTE across or down; GROUP and
 * UNGROUP (a group moves, aligns and layers as one); BRING FORWARD and SEND BACK (the list's order is the order they are drawn). Every
 * change makes a new slide, so UNDO takes it back. Pure: apps/edge/test/slides.test.mjs.
 */
import { H, W, type ShapeKind, type Slide } from './model';

export interface FreeItem {
  id: string;
  kind: 'text' | 'pic' | 'shape';
  x: number;
  y: number;
  w: number;
  h: number;
  /** A text box's words. */
  text?: string;
  /** A picture: its key in the documents' picture store, its words for a screen reader, its own size. */
  img?: string;
  alt?: string;
  /** A shape's kind, and which colour of the theme's sequence fills it (a text box's colour too). */
  shape?: ShapeKind;
  fill?: number;
  /** Items that share a group id move, align and layer as one. */
  group?: string;
}
export interface Guide {
  axis: 'x' | 'y';
  at: number;
}
type Box = { x: number; y: number; w: number; h: number };

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;
const free = (s: Slide): FreeItem[] => s.free ?? [];
const withFree = (s: Slide, list: FreeItem[]): Slide => ({ ...s, free: list });

/** A new item in the middle of the slide (each new one a little lower and to the right, so none hides another). */
export function addFree(s: Slide, kind: FreeItem['kind'], over: Partial<FreeItem> = {}): { slide: Slide; id: string } {
  const n = free(s).length;
  const size = kind === 'text' ? { w: 520, h: 120 } : kind === 'pic' ? { w: 480, h: 320 } : { w: 280, h: 200 };
  const item: FreeItem = {
    id: uid('f'),
    kind,
    x: Math.round((W - size.w) / 2 + (n % 6) * 24),
    y: Math.round((H - size.h) / 2 + (n % 6) * 24),
    ...size,
    ...(kind === 'text' ? { text: 'Your words here', fill: 0 } : {}),
    ...(kind === 'shape' ? { shape: 'round' as ShapeKind, fill: n % 5 } : {}),
    ...over,
  };
  return { slide: withFree(s, [...free(s), item]), id: item.id };
}
/** The ids that move with an item (its group, or itself). */
export function together(s: Slide, ids: string[]): string[] {
  const groups = new Set(free(s).filter((i) => ids.includes(i.id) && i.group).map((i) => i.group));
  return free(s).filter((i) => ids.includes(i.id) || (i.group && groups.has(i.group))).map((i) => i.id);
}
export const bounds = (items: Box[]): Box => {
  const x = Math.min(...items.map((i) => i.x));
  const y = Math.min(...items.map((i) => i.y));
  return { x, y, w: Math.max(...items.map((i) => i.x + i.w)) - x, h: Math.max(...items.map((i) => i.y + i.h)) - y };
};

/**
 * Where a box dragged to (x, y) lands: within 10 px of the slide's centre or edges (first), or another item's edges or centre, it snaps
 * there, and the guides it snapped to come back with it.
 */
export function snap(box: Box, others: Box[], tol = 10): { x: number; y: number; guides: Guide[] } {
  const xo = others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w]);
  const yo = others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h]);
  const best = (pos: number, size: number, lines: number[]) => {
    let pick: { d: number; to: number; at: number } | null = null;
    for (const at of lines)
      for (const off of [0, size / 2, size]) {
        const d = Math.abs(pos + off - at);
        if (d <= tol && (!pick || d < pick.d)) pick = { d, to: at - off, at };
      }
    return pick;
  };
  // the slide's own middle and edges win over another item's (as Keynote's centre guides do)
  const bx = best(box.x, box.w, [0, W / 2, W]) ?? best(box.x, box.w, xo);
  const by = best(box.y, box.h, [0, H / 2, H]) ?? best(box.y, box.h, yo);
  const guides: Guide[] = [];
  if (bx) guides.push({ axis: 'x', at: bx.at });
  if (by) guides.push({ axis: 'y', at: by.at });
  return { x: Math.round(bx ? bx.to : box.x), y: Math.round(by ? by.to : box.y), guides };
}

/** The chosen items (and their groups) moved by dx, dy, kept on the slide. */
export function moveFree(s: Slide, ids: string[], dx: number, dy: number): Slide {
  const move = new Set(together(s, ids));
  if (!move.size) return s;
  const b = bounds(free(s).filter((i) => move.has(i.id)));
  const ddx = Math.max(-b.x, Math.min(W - b.x - b.w, dx));
  const ddy = Math.max(-b.y, Math.min(H - b.y - b.h, dy));
  return withFree(s, free(s).map((i) => (move.has(i.id) ? { ...i, x: Math.round(i.x + ddx), y: Math.round(i.y + ddy) } : i)));
}
/** An item's box changed (its size, its words, its colour). */
export function changeFree(s: Slide, id: string, patch: Partial<FreeItem>): Slide {
  return withFree(s, free(s).map((i) => (i.id === id ? { ...i, ...patch } : i)));
}
export function removeFree(s: Slide, ids: string[]): Slide {
  const gone = new Set(together(s, ids));
  return withFree(s, free(s).filter((i) => !gone.has(i.id)));
}

export type AlignHow = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
/**
 * The chosen items lined up: with two or more units (a group is one unit), on the edge or middle of all of them together; with one, on the
 * slide's own edge or middle.
 */
export function alignFree(s: Slide, ids: string[], how: AlignHow): Slide {
  const units = unitsOf(s, ids);
  if (!units.length) return s;
  const all = units.length > 1 ? bounds(units.map((u) => u.box)) : { x: 0, y: 0, w: W, h: H };
  let list = free(s);
  for (const u of units) {
    const b = u.box;
    const to =
      how === 'left' ? { x: all.x } : how === 'centre' ? { x: all.x + (all.w - b.w) / 2 } : how === 'right' ? { x: all.x + all.w - b.w }
      : how === 'top' ? { y: all.y } : how === 'middle' ? { y: all.y + (all.h - b.h) / 2 } : { y: all.y + all.h - b.h };
    const dx = to.x === undefined ? 0 : Math.round(to.x - b.x);
    const dy = to.y === undefined ? 0 : Math.round(to.y - b.y);
    list = list.map((i) => (u.ids.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
  }
  return withFree(s, list);
}
/** Three or more units spaced evenly across (or down) between the first and the last. Null with fewer. */
export function distributeFree(s: Slide, ids: string[], axis: 'x' | 'y'): Slide | null {
  const units = unitsOf(s, ids);
  if (units.length < 3) return null;
  const k = axis === 'x' ? 'x' : 'y';
  const size = axis === 'x' ? 'w' : 'h';
  units.sort((a, b) => a.box[k] - b.box[k]);
  const first = units[0]!.box;
  const last = units[units.length - 1]!.box;
  const span = last[k] + last[size] - first[k];
  const used = units.reduce((t, u) => t + u.box[size], 0);
  const gap = (span - used) / (units.length - 1);
  let at = first[k];
  let list = free(s);
  for (const u of units) {
    const d = Math.round(at - u.box[k]);
    list = list.map((i) => (u.ids.includes(i.id) ? { ...i, [k]: i[k] + d } : i));
    at += u.box[size] + gap;
  }
  return withFree(s, list);
}
/** Each chosen thing as a unit: a whole group, or a lone item, with its box. */
function unitsOf(s: Slide, ids: string[]): { ids: string[]; box: Box }[] {
  const seen = new Set<string>();
  const out: { ids: string[]; box: Box }[] = [];
  for (const id of together(s, ids)) {
    const it = free(s).find((i) => i.id === id)!;
    const key = it.group ?? it.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const members = it.group ? free(s).filter((i) => i.group === it.group) : [it];
    out.push({ ids: members.map((m) => m.id), box: bounds(members) });
  }
  return out;
}
/** Two or more items made one group (any group they were in is left). Null with fewer than two. */
export function groupFree(s: Slide, ids: string[]): { slide: Slide; group: string } | null {
  const all = together(s, ids);
  if (all.length < 2) return null;
  const g = uid('g');
  return { slide: withFree(s, free(s).map((i) => (all.includes(i.id) ? { ...i, group: g } : i))), group: g };
}
/** The chosen items' groups undone; how many items were in them. */
export function ungroupFree(s: Slide, ids: string[]): { slide: Slide; n: number } {
  const all = new Set(together(s, ids));
  let n = 0;
  const list = free(s).map((i) => {
    if (!all.has(i.id) || !i.group) return i;
    n++;
    const { group: _g, ...rest } = i;
    void _g;
    return rest;
  });
  return { slide: withFree(s, list), n };
}
/** The chosen items (with their groups) one step up or down the drawing order, or to the very front or back. */
export function layerFree(s: Slide, ids: string[], how: 'forward' | 'back' | 'front' | 'rear'): Slide {
  const move = new Set(together(s, ids));
  const list = free(s);
  const mine = list.filter((i) => move.has(i.id));
  const rest = list.filter((i) => !move.has(i.id));
  if (!mine.length || !rest.length) return s;
  if (how === 'front') return withFree(s, [...rest, ...mine]);
  if (how === 'rear') return withFree(s, [...mine, ...rest]);
  // one step: past the next item that is not chosen, above (forward) or below (back)
  const idx = list.findIndex((i) => move.has(i.id));
  const lastIdx = list.length - 1 - [...list].reverse().findIndex((i) => move.has(i.id));
  if (how === 'forward') {
    const next = list.slice(lastIdx + 1).find((i) => !move.has(i.id));
    if (!next) return s;
    const at = rest.indexOf(next);
    return withFree(s, [...rest.slice(0, at + 1), ...mine, ...rest.slice(at + 1)]);
  }
  const prev = [...list.slice(0, idx)].reverse().find((i) => !move.has(i.id));
  if (!prev) return s;
  const at = rest.indexOf(prev);
  return withFree(s, [...rest.slice(0, at), ...mine, ...rest.slice(at)]);
}
/** An item in his words, for a screen reader and for what he hears. */
export function freeWords(i: FreeItem): string {
  return i.kind === 'text' ? `A text box: ${i.text?.trim() || 'empty'}` : i.kind === 'pic' ? `A picture${i.alt ? `: ${i.alt}` : ''}` : (i.shape === 'ellipse' || i.shape === 'arrow' ? 'An ' : 'A ') + `${i.shape === 'round' ? 'rounded' : (i.shape ?? 'rect') === 'rect' ? 'rectangle' : i.shape} shape`;
}
