/**
 * SPACE tab — the SPACE PLANNER: a room drawn to scale (its width × depth typed, or a wall's width
 * from the Lens's MEASURE) — or several rooms, L-shapes too, with walls of a real thickness, doors
 * (their swing drawn) and windows tapped onto the walls and slid along them, each wall's length and
 * each room's area (m² and ft²) on the plan — furniture from a catalogue of common UK sizes dragged about with a
 * finger (snapping to the walls and to each other, turned with ROTATE), gaps under the 70 cm
 * walkway marked in red, overlaps in red, WILL IT FIT? for something you are thinking of buying,
 * MAKE SPACE (up to three layouts that leave the most open floor, tap one to try it, UNDO to go
 * back), and EXPORT as a picture (PNG) or a file (JSON) — IMPORT reads one back. Everything stays
 * on this phone (space/store.ts); what is on screen goes along with a chat message as context
 * (describe()). DESIGN REVIEW sends the plan to Ghosty with the owner's goal; the changes Ghosty
 * suggests come back as whole plans (the `design_changes` command), checked here, shown BEFORE and
 * AFTER and applied only on APPLY. SEE IN 3-D builds the plan in the 3D STUDIO. The pure parts are
 * in space/plan.ts, space/rooms.ts and packages/shared/src/design.ts. The state a test reads is at
 * window.__ghosty.space.
 */
import { areaText, changeProblem, doorSwing, edgeOf, inSwing, openingSpan, pointInPoly, polyArea, polyPerimeter, roomAt, triangulate, type Corner, type Opening, type Pt, type RoomShape } from '../../../../../packages/shared/src/design';
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { bothText, cmText, describeMeasurements, parseLength } from '../../measure/geom';
import { go, type TabDef } from '../../shell/tabs';
import { button, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { roomToPlan, planToRoom } from '../../space/roomjson';
import { CATALOGUE, clashes, describePlan, footprint, GRID, largestOpen, layoutOf, makeSpace, readPlan, roomsOf, snapItem, tightGaps, WALKWAY, willItFit, type Arrangement, type Item, type Plan, type Rect } from '../../space/plan';
import { addOpening, addRoom, removeOpening, removeRoom, renameRoom, reshapeRoom, shapeOf, slideOpening, updateOpening } from '../../space/rooms';
import { space } from '../../space/store';
import { wallRuns } from '../../studio/room';

/** What the planner shows, for tests and the console (window.__ghosty.space). */
export interface SpaceState {
  room: { w: number; d: number };
  items: Item[];
  selected: string;
  gaps: { a: string; b: string; cm: number }[];
  clashes: string[];
  open: Rect & { area: number };
  options: { name: string; open: number; moved: number }[];
  fit: string;
  exported: { png: number; json: number };
  /** The architecture: each room's area (m²) and walls (cm), the doors and windows, pieces where a door swings. */
  rooms: { id: string; name: string; m2: number; ft2: number; perimeter: number; corners: number }[];
  openings: Opening[];
  area: string;
  swing: string[];
  /** DESIGN REVIEW: the changes Ghosty sent, which is showing, and whether the AFTER view is on. */
  review: { goal: string; options: string[]; rejected: number; view: 'before' | 'after'; chosen: number; applied: number };
  /** The canvas: its padding and pixels per cm (CSS px), for a test to find a point on the plan. */
  view: { pad: number; k: number };
}

export const spaceState: SpaceState = { room: { w: 0, d: 0 }, items: [], selected: '', gaps: [], clashes: [], open: { x: 0, y: 0, w: 0, h: 0, area: 0 }, options: [], fit: '', exported: { png: 0, json: 0 }, rooms: [], openings: [], area: '', swing: [], review: { goal: '', options: [], rejected: 0, view: 'before', chosen: -1, applied: 0 }, view: { pad: 34, k: 1 } };

/** A change Ghosty suggested: a whole plan, checked against the owner's. */
interface DesignOption {
  title: string;
  why: string;
  plan: Plan;
}
let review: { goal: string; options: DesignOption[]; rejected: number } | null = null;
const reviewListeners = new Set<() => void>();

/**
 * The `design_changes` command: Ghosty's suggestions, each kept only if it applies cleanly to the
 * plan on this phone now (same rooms, no new clash), then SPACE opens on them.
 */
export function receiveDesignChanges(args: Record<string, unknown> | undefined): void {
  const list = Array.isArray(args?.options) ? (args!.options as unknown[]).slice(0, 3) : [];
  const now = planToRoom(space.get().plan);
  const options: DesignOption[] = [];
  let rejected = 0;
  for (const raw of list) {
    const o = (raw ?? {}) as { title?: unknown; why?: unknown; plan?: unknown };
    const plan = o.plan && typeof o.plan === 'object' && !changeProblem(now, o.plan) ? roomToPlan(o.plan) : null;
    if (!plan) {
      rejected++;
      continue;
    }
    options.push({ title: String(o.title ?? 'A change').slice(0, 90), why: String(o.why ?? '').slice(0, 300), plan });
  }
  review = { goal: String(args?.goal ?? '').slice(0, 200), options, rejected };
  for (const f of reviewListeners) f();
  if (options.length) {
    toast(`${options.length} design change${options.length > 1 ? 's' : ''} ready: tap one in SPACE to see AFTER`, 'ok');
    go('space');
  } else if (rejected) toast('Ghosty’s suggested changes no longer fit your plan (it changed since)', 'warn');
}

/** On the console/test handle; main.ts makes __ghosty after the first tab opens (a reload landing here), so this retries. */
function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.space = spaceState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

const COLORS = { line: '#62e4ff', item: 'rgba(98, 228, 255, .16)', sel: '#ffb23e', bad: '#ff4d6a', ok: '#52f2b5', text: '#d8f6ff', mute: 'rgba(216, 246, 255, .45)' };

/** A point well inside a room for its label: the middle of its box, or of its biggest triangle (an L). */
function labelPoint(r: RoomShape): Pt {
  const xs = r.poly.map((p) => p[0]);
  const ys = r.poly.map((p) => p[1]);
  const c: Pt = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  if (pointInPoly(c, r.poly, 0)) return c;
  const t = triangulate(r.poly);
  let best: Pt = c;
  let area = -1;
  for (let i = 0; i + 2 < t.length; i += 3) {
    const [a, b, d] = [r.poly[t[i]!]!, r.poly[t[i + 1]!]!, r.poly[t[i + 2]!]!];
    const ar = Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]));
    if (ar > area) {
      area = ar;
      best = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3];
    }
  }
  return best;
}

/** Pieces standing where a door swings. */
function inDoorways(plan: Plan): string[] {
  const lay = layoutOf(plan);
  return plan.items.filter((it) => lay.openings.some((o) => {
    const r = lay.rooms.find((x) => x.id === o.room);
    return !!r && inSwing(r, o, footprint(it));
  })).map((it) => it.id);
}

/**
 * The rooms: floors, the 50 cm grid on them, walls as thick as they are with gaps for doors and
 * windows, each door's leaf and swing, each window's glass, every wall's length, each room's
 * name and area. `sel` lights up the chosen room, wall or opening.
 */
function drawArch(g: CanvasRenderingContext2D, plan: Plan, k: number, pad: number, sel: string): void {
  const lay = layoutOf(plan);
  const X = (cm: number) => pad + cm * k;
  const path = (poly: Pt[]) => {
    poly.forEach(([x, y], i) => (i ? g.lineTo(X(x), X(y)) : g.moveTo(X(x), X(y))));
    g.closePath();
  };
  g.fillStyle = 'rgba(98, 228, 255, .05)';
  g.beginPath();
  for (const r of lay.rooms) path(r.poly);
  g.fill();
  // floor grid every 50 cm, on the floors only
  g.save();
  g.beginPath();
  for (const r of lay.rooms) path(r.poly);
  g.clip();
  g.strokeStyle = 'rgba(98, 228, 255, .08)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 50; x < plan.room.w; x += 50) {
    g.moveTo(X(x), X(0));
    g.lineTo(X(x), X(plan.room.d));
  }
  for (let y = 50; y < plan.room.d; y += 50) {
    g.moveTo(X(0), X(y));
    g.lineTo(X(plan.room.w), X(y));
  }
  g.stroke();
  g.restore();
  // the chosen room
  const selRoom = sel.startsWith('room:') ? lay.rooms.find((r) => `room:${r.id}` === sel) : null;
  if (selRoom) {
    g.fillStyle = 'rgba(255, 178, 62, .07)';
    g.beginPath();
    path(selRoom.poly);
    g.fill();
  }
  // walls, as thick as they are, broken where the doors and windows are
  const t = lay.wall;
  g.lineCap = 'butt';
  g.strokeStyle = COLORS.line;
  g.lineWidth = Math.max(2, t * k);
  g.beginPath();
  for (const run of wallRuns(lay)) {
    const pt = (s: number): [number, number] => [X(run.a[0] + run.ux * s + run.nx * run.off), X(run.a[1] + run.uy * s + run.ny * run.off)];
    const seg = (s0: number, s1: number) => {
      if (s1 - s0 < 0.5) return;
      g.moveTo(...pt(s0));
      g.lineTo(...pt(s1));
    };
    let s = run.from;
    for (const c of run.cuts) {
      seg(s, c.s0);
      s = Math.max(s, c.s1);
    }
    seg(s, run.to);
  }
  g.stroke();
  // the chosen wall
  if (sel.startsWith('wall:')) {
    const [, rid, wi] = sel.split(':');
    const r = lay.rooms.find((x) => x.id === rid);
    if (r) {
      const e = edgeOf(r.poly, Number(wi));
      g.strokeStyle = COLORS.sel;
      g.lineWidth = Math.max(3, t * k * 0.6);
      g.beginPath();
      g.moveTo(X(e.a[0]), X(e.a[1]));
      g.lineTo(X(e.b[0]), X(e.b[1]));
      g.stroke();
    }
  }
  // doors and windows
  for (const op of lay.openings) {
    const r = lay.rooms.find((x) => x.id === op.room);
    if (!r) continue;
    const { p0, p1, mid, edge } = openingSpan(r, op);
    const shared = !!roomAt(lay.rooms.filter((x) => x.id !== r.id), [mid[0] + edge.nx * (t / 2 + 1), mid[1] + edge.ny * (t / 2 + 1)]);
    const off = shared ? 0 : t / 2;
    const on = sel === `op:${op.id}`;
    g.strokeStyle = on ? COLORS.sel : COLORS.text;
    if (op.type === 'window') {
      g.lineWidth = 1.5;
      g.beginPath();
      for (const d of [-0.3, 0.3]) {
        g.moveTo(X(p0[0] + edge.nx * (off + d * t)), X(p0[1] + edge.ny * (off + d * t)));
        g.lineTo(X(p1[0] + edge.nx * (off + d * t)), X(p1[1] + edge.ny * (off + d * t)));
      }
      g.stroke();
      g.fillStyle = on ? 'rgba(255, 178, 62, .3)' : 'rgba(191, 246, 255, .25)';
      g.beginPath();
      g.moveTo(X(p0[0] + edge.nx * (off - 0.3 * t)), X(p0[1] + edge.ny * (off - 0.3 * t)));
      g.lineTo(X(p1[0] + edge.nx * (off - 0.3 * t)), X(p1[1] + edge.ny * (off - 0.3 * t)));
      g.lineTo(X(p1[0] + edge.nx * (off + 0.3 * t)), X(p1[1] + edge.ny * (off + 0.3 * t)));
      g.lineTo(X(p0[0] + edge.nx * (off + 0.3 * t)), X(p0[1] + edge.ny * (off + 0.3 * t)));
      g.closePath();
      g.fill();
    } else {
      const sw = doorSwing(r, op)!;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(X(sw.hinge[0]), X(sw.hinge[1]));
      g.lineTo(X(sw.open[0]), X(sw.open[1]));
      g.stroke();
      const a0 = Math.atan2(sw.shut[1] - sw.hinge[1], sw.shut[0] - sw.hinge[0]);
      const a1 = Math.atan2(sw.open[1] - sw.hinge[1], sw.open[0] - sw.hinge[0]);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d <= -Math.PI) d += 2 * Math.PI;
      g.setLineDash([4, 3]);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(X(sw.hinge[0]), X(sw.hinge[1]), op.w * k, a0, a0 + d, d < 0);
      g.stroke();
      g.setLineDash([]);
    }
    if (op.w * k > 26) {
      g.fillStyle = on ? COLORS.sel : COLORS.mute;
      g.textAlign = 'center';
      g.fillText(op.id.toUpperCase(), X(mid[0] - edge.nx * 12), X(mid[1] - edge.ny * 12));
    }
  }
  // every wall's length, outside it (inside for a wall two rooms share)
  g.font = `400 ${Math.max(8, Math.min(11, 10 * (k / 1.2)))}px "IBM Plex Mono", ui-monospace, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const r of lay.rooms) {
    for (let i = 0; i < r.poly.length; i++) {
      const e = edgeOf(r.poly, i);
      if (e.len * k < 34) continue;
      const mx = (e.a[0] + e.b[0]) / 2;
      const my = (e.a[1] + e.b[1]) / 2;
      const outside = !roomAt(lay.rooms.filter((x) => x.id !== r.id), [mx + e.nx * (t / 2 + 1), my + e.ny * (t / 2 + 1)]);
      const d = (outside ? 1 : -1) * (t * k + 8);
      g.fillStyle = sel === `wall:${r.id}:${i}` ? COLORS.sel : COLORS.line;
      // along the wall, never upside down
      let a = Math.atan2(e.uy, e.ux);
      if (a > Math.PI / 2 + 0.01 || a < -Math.PI / 2 - 0.01) a += Math.PI;
      g.save();
      g.translate(X(mx) + e.nx * d, X(my) + e.ny * d);
      g.rotate(a);
      g.fillText(`${Math.round(e.len)}`, 0, 0);
      g.restore();
    }
  }
  // each room's name and area (m² and ft²) — a single plain room has them in the header already
  for (const r of lay.rooms.length > 1 || lay.rooms[0]?.name !== 'Room' ? lay.rooms : []) {
    const [lx, ly] = labelPoint(r);
    g.fillStyle = r === selRoom ? COLORS.sel : 'rgba(216, 246, 255, .55)';
    g.fillText(r.name.toUpperCase(), X(lx), X(ly) - 7);
    g.fillStyle = 'rgba(216, 246, 255, .4)';
    g.fillText(areaText(polyArea(r.poly)), X(lx), X(ly) + 7);
  }
}

/** The plan drawn on a 2-D canvas at `k` pixels per cm, offset by `pad` px (shared by the screen and the PNG export). */
function drawPlan(g: CanvasRenderingContext2D, plan: Plan, k: number, pad: number, opts: { selected?: string; preview?: Rect | null; title?: string } = {}): void {
  const { room, items } = plan;
  const X = (cm: number) => pad + cm * k;
  const Y = (cm: number) => pad + cm * k;
  g.save();
  g.font = `500 ${Math.max(9, Math.min(13, 11 * (k / 1.2)))}px "IBM Plex Mono", ui-monospace, monospace`;
  g.textBaseline = 'middle';
  drawArch(g, plan, k, pad, opts.selected ?? '');
  // the open floor MAKE SPACE is showing
  if (opts.preview) {
    g.setLineDash([6, 4]);
    g.strokeStyle = COLORS.ok;
    g.lineWidth = 1.5;
    g.strokeRect(X(opts.preview.x) + 2, Y(opts.preview.y) + 2, opts.preview.w * k - 4, opts.preview.h * k - 4);
    g.setLineDash([]);
  }
  // gaps under a walkway
  const gaps = tightGaps(items);
  for (const gp of gaps) {
    g.fillStyle = 'rgba(255, 77, 106, .22)';
    g.fillRect(X(gp.rect.x), Y(gp.rect.y), gp.rect.w * k, gp.rect.h * k);
  }
  const bad = new Set([...clashes(room, items, roomsOf(plan)), ...inDoorways(plan)]);
  g.font = `500 ${Math.max(9, Math.min(13, 11 * (k / 1.2)))}px "IBM Plex Mono", ui-monospace, monospace`;
  g.textBaseline = 'middle';
  for (const it of items) {
    const f = footprint(it);
    const sel = it.id === opts.selected;
    g.fillStyle = bad.has(it.id) ? 'rgba(255, 77, 106, .25)' : sel ? 'rgba(255, 178, 62, .2)' : COLORS.item;
    g.fillRect(X(f.x), Y(f.y), f.w * k, f.h * k);
    g.strokeStyle = bad.has(it.id) ? COLORS.bad : sel ? COLORS.sel : COLORS.line;
    g.lineWidth = sel ? 2 : 1.2;
    g.strokeRect(X(f.x) + 0.5, Y(f.y) + 0.5, f.w * k - 1, f.h * k - 1);
    // its back: a thick edge on the wall side
    g.lineWidth = 4;
    g.beginPath();
    const [x0, y0, x1, y1] = it.rot === 0 ? [f.x, f.y, f.x + f.w, f.y] : it.rot === 1 ? [f.x + f.w, f.y, f.x + f.w, f.y + f.h] : it.rot === 2 ? [f.x, f.y + f.h, f.x + f.w, f.y + f.h] : [f.x, f.y, f.x, f.y + f.h];
    g.moveTo(X(x0), Y(y0));
    g.lineTo(X(x1), Y(y1));
    g.stroke();
    // its name and size, when there is room for them
    const cx = X(f.x + f.w / 2);
    const cy = Y(f.y + f.h / 2);
    const name = it.label.replace(/^(Sofa|Bed|Dining table|Wardrobe), /, '');
    g.fillStyle = COLORS.text;
    g.textAlign = 'center';
    if (f.w * k > 34 && f.h * k > 22) {
      g.fillText(name.length * 6.5 > f.w * k ? name.slice(0, Math.max(3, Math.floor((f.w * k) / 7))) : name, cx, cy - (f.h * k > 36 ? 7 : 0));
      if (f.h * k > 36) {
        g.fillStyle = COLORS.mute;
        g.fillText(`${it.w}×${it.d}`, cx, cy + 8);
      }
    }
  }
  // gap labels on top
  for (const gp of gaps) {
    g.fillStyle = COLORS.bad;
    g.textAlign = 'center';
    g.fillText(`${gp.cm} cm`, X(gp.rect.x + gp.rect.w / 2), Y(gp.rect.y + gp.rect.h / 2));
  }
  if (opts.title) {
    g.textAlign = 'left';
    g.fillStyle = COLORS.mute;
    g.fillText(opts.title, pad, Y(room.d) + pad - 6);
  }
  g.restore();
}

/** Save a file the owner asked for: the share sheet where the phone has one for files, else a download. */
async function saveFile(blob: Blob, name: string): Promise<'share' | 'download'> {
  const f = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [f] }) && /iPhone|iPad|Android/i.test(navigator.userAgent) && nav.share) {
    try {
      await nav.share({ files: [f], title: name });
      return 'share';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'share';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'download';
}

/** Open the planner, with a room size when one is known (the `open_space` command). */
export function openSpace(widthCm?: number, depthCm?: number): void {
  const w = Number(widthCm);
  const d = Number(depthCm);
  try {
    if (w >= 50 && w <= 5000 && d >= 50 && d <= 5000) space.setRoom({ w, d });
  } catch (e) {
    toast(String((e as Error)?.message ?? e), 'warn');
  }
  go('space');
}

export const spaceTab: TabDef = {
  id: 'space',
  title: 'SPACE',
  icon: '<path d="M3 4h18v16H3z"/><path d="M3 12h7v8M14 4v5h7"/><path d="M6 15h2M16 6h2"/>',
  scene: 'backdrop',
  blurb: 'plan a room · fit · make space',
  mount(root) {
    const P = page(root, { tag: 'SPACE PLANNER', sub: 'your room in real sizes · kept on this phone', leftLabel: 'PLAN', rightLabel: 'TOOLS', stack: true });
    let selected = '';
    let undoItems: Item[] | null = null;
    let preview: Rect | null = null;
    let options: Arrangement[] = [];
    // DESIGN REVIEW: which suggested change is chosen, whether AFTER is showing, the plan before the last APPLY.
    let view: 'before' | 'after' = 'before';
    let chosen = -1;
    let undoPlan: Plan | null = null;
    let applied = 0;
    const shownPlan = (): Plan => (view === 'after' && review?.options[chosen]?.plan) || space.get().plan;
    /** The room the owner is working on: the chosen room (or the room of the chosen wall or opening), else the first. */
    const selRoomId = (): string | undefined => {
      const plan = space.get().plan;
      if (selected.startsWith('room:') || selected.startsWith('wall:')) return selected.split(':')[1];
      if (selected.startsWith('op:')) return plan.openings?.find((o) => `op:${o.id}` === selected)?.room;
      return plan.rooms?.[0]?.id;
    };
    const selRoom = (): RoomShape => {
      const lay = layoutOf(space.get().plan);
      return lay.rooms.find((r) => r.id === selRoomId()) ?? lay.rooms[0]!;
    };
    const dropNote = (dropped: string[]) => dropped.length && toast(dropped.join('; '), 'warn');

    // ======================= THE PLAN
    const pp = panel('ROOM PLAN', { cls: 'spaceplan' });
    const wIn = h('input', { inputmode: 'decimal', 'aria-label': 'Room width in cm', placeholder: 'width' });
    const dIn = h('input', { inputmode: 'decimal', 'aria-label': 'Room depth in cm', placeholder: 'depth' });
    const setRoom = () => {
      const w = parseLength(wIn.value, 'auto');
      const d = parseLength(dIn.value, 'auto');
      if (!w || !d) return void toast('Type the room’s width and depth (cm, or e.g. 4.2 m)', 'warn');
      if (w < 500 || d < 500 || w > 50000 || d > 50000) return void toast('A room between 0.5 m and 50 m each way', 'warn');
      const name = space.get().plan.rooms?.length ? `${selRoom().name}: ` : 'Room ';
      try {
        dropNote(space.setRoom({ w: w / 10, d: d / 10 }, selRoomId()));
      } catch (e) {
        return void toast(String((e as Error)?.message ?? e), 'warn');
      }
      toast(`${name}${Math.round(w / 10)} × ${Math.round(d / 10)} cm`, 'ok');
    };
    for (const i of [wIn, dIn]) i.addEventListener('keydown', (e) => e.key === 'Enter' && setRoom());
    const roomRow = h('div.keyrow.spaceroom', h('span.lab', 'ROOM'), wIn, h('span.x', '×'), dIn, h('span.lab', 'CM'), button('SET', () => setRoom()));
    const canvas = h('canvas.spacecanvas', { 'aria-label': 'The room plan: drag a piece to move it, tap it to choose it' });
    const wrap = h('div.spacewrap', canvas);
    const selName = h('span.spacesel', 'Tap a piece to choose it');
    const rotBtn = button('ROTATE', () => rotate());
    const delBtn = button('REMOVE', () => removeSel());
    const selRow = h('div.row.wrap.spacebar', selName, rotBtn, delBtn);
    // What a tapped wall, door or window can do (filled by paintSel).
    const archRow = h('div.row.wrap.spacebar.spacearch');
    const info = h('div.note.spaceinfo');
    pp.body.append(roomRow, wrap, selRow, archRow, info);

    // ======================= ROOMS · WALLS
    const rp = panel('ROOMS · WALLS', { status: 'doors · windows', cls: 'spacerooms' });
    const roomChips = h('div.lenschips.spaceroomchips');
    const rName = h('input', { placeholder: 'room name', 'aria-label': 'Room name', maxlength: '30' });
    const nw = h('input', { inputmode: 'decimal', placeholder: 'notch W', 'aria-label': 'Notch width (cm)' });
    const nd = h('input', { inputmode: 'decimal', placeholder: 'notch D', 'aria-label': 'Notch depth (cm)' });
    const CORNERS: Corner[] = ['tr', 'br', 'bl', 'tl'];
    const CORNER_NAMES: Record<Corner, string> = { tr: 'TOP RIGHT', br: 'BOTTOM RIGHT', bl: 'BOTTOM LEFT', tl: 'TOP LEFT' };
    let corner: Corner = 'tr';
    const cornerBtn = button('NOTCH: TOP RIGHT', () => {
      corner = CORNERS[(CORNERS.indexOf(corner) + 1) % 4]!;
      cornerBtn.textContent = `NOTCH: ${CORNER_NAMES[corner]}`;
      if (shapeOf(selRoom()).kind === 'l') makeL();
    });
    const wallIn = h('input', { inputmode: 'decimal', placeholder: 'wall cm', 'aria-label': 'Wall thickness (cm)' });
    const ceilIn = h('input', { inputmode: 'decimal', placeholder: 'ceiling cm', 'aria-label': 'Ceiling height (cm)' });
    const northBtn = button('NORTH: UP', () => {
      const plan = space.get().plan;
      const n = ((plan.north ?? 0) + 90) % 360;
      space.setPlan({ ...ensureArch(plan), north: n });
    });
    const roomNote = h('div.note.spaceroomnote');
    const readPlanOr = (plan: Plan): Plan => readPlan(plan) ?? plan;
    const ensureArch = (plan: Plan): Plan => (plan.rooms?.length ? plan : { ...plan, v: 2, ...layoutOf(plan) });
    const pickRoom = (id: string) => {
      selected = `room:${id}`;
      paint();
    };
    const makeL = () => {
      const w = parseLength(nw.value);
      const d = parseLength(nd.value);
      const got = reshapeRoom(space.get().plan, selRoom().id, 'l', { nw: w ? w / 10 : undefined, nd: d ? d / 10 : undefined, corner });
      dropNote(got.dropped);
      space.setPlan(got.plan);
    };
    const setArch = () => {
      const plan = ensureArch(space.get().plan);
      const t = parseLength(wallIn.value);
      const c = parseLength(ceilIn.value);
      const next = { ...plan, ...(t && t >= 20 && t <= 600 ? { wall: Math.round(t / 10) } : {}), ...(c && c >= 1800 && c <= 6000 ? { h: Math.round(c / 10) } : {}) };
      space.setPlan(readPlanOr(next));
    };
    for (const i of [wallIn, ceilIn]) i.addEventListener('keydown', (e) => e.key === 'Enter' && setArch());
    rName.addEventListener('keydown', (e) => e.key === 'Enter' && space.setPlan(renameRoom(space.get().plan, selRoom().id, rName.value)));
    rp.body.append(
      roomChips,
      h('div.keyrow.spaceroomname', rName, button('RENAME', () => space.setPlan(renameRoom(space.get().plan, selRoom().id, rName.value)))),
      h('div.row.wrap', button('BOX', () => {
        const got = reshapeRoom(space.get().plan, selRoom().id, 'box');
        dropNote(got.dropped);
        space.setPlan(got.plan);
      }), button('L-SHAPE', () => makeL()), cornerBtn),
      h('div.keyrow.spacenotch', h('span.lab', 'NOTCH'), nw, h('span.x', '×'), nd, h('span.lab', 'CM')),
      h('div.row.wrap', button('+ ROOM RIGHT', () => {
        const got = addRoom(space.get().plan, 'right');
        space.setPlan(got.plan);
        pickRoom(got.id);
      }), button('+ ROOM BELOW', () => {
        const got = addRoom(space.get().plan, 'below');
        space.setPlan(got.plan);
        pickRoom(got.id);
      }), button('REMOVE ROOM', () => {
        const next = removeRoom(space.get().plan, selRoom().id);
        if (!next) return void toast('The plan needs at least one room', 'warn');
        selected = '';
        space.setPlan(next);
      })),
      h('div.keyrow.spacewalls', h('span.lab', 'WALLS'), wallIn, h('span.lab', 'CEILING'), ceilIn, button('SET', () => setArch())),
      h('div.row.wrap', northBtn),
      h('div.note', 'Tap a wall on the plan, then ADD DOOR or ADD WINDOW; tap a door or window to change it, or drag it along its wall. Lengths are inside, in cm.'),
      roomNote,
    );

    // ======================= DESIGN REVIEW
    const dp = panel('DESIGN REVIEW', { status: 'UK guidance', cls: 'spacereview' });
    const goalIn = h('input', { placeholder: 'your goal, e.g. make it feel bigger', 'aria-label': 'What you want from the room', maxlength: '200' });
    const goalChips = h('div.lenschips.spacegoals');
    for (const gl of ['Make it feel bigger', 'A home office', 'More light', 'Safer and easier to get around']) goalChips.append(button(gl.toUpperCase(), () => (goalIn.value = gl)));
    const reviewBtn = button('REVIEW MY PLAN', () => void askReview(), 'on');
    const viewRow = h('div.row.wrap.spacebeforeafter');
    const changeList = h('div.stackf.spacechanges');
    const reviewNote = h('div.note.spacereviewnote');
    const askReview = async () => {
      const goal = goalIn.value.trim() || 'make it work better';
      reviewBtn.disabled = true;
      try {
        // The plan goes first, on its own (kept in the brain's memory for this question only).
        const r = await fetch('/api/design/plan', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ plan: planToRoom(space.get().plan) }), credentials: 'same-origin' });
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `the brain answered ${r.status}`);
      } catch (e) {
        reviewBtn.disabled = false;
        return void toast(`Could not send the plan: ${String((e as Error)?.message ?? e).slice(0, 120)}`, 'bad');
      }
      reviewBtn.disabled = false;
      go('core');
      const { send } = await import('../../assistant/session');
      void send(`Design review of my room plan — goal: ${goal}`);
    };
    goalIn.addEventListener('keydown', (e) => e.key === 'Enter' && void askReview());
    const choose = (i: number) => {
      chosen = i;
      view = i >= 0 ? 'after' : 'before';
      paint();
    };
    const applyChange = () => {
      const o = review?.options[chosen];
      if (!o) return;
      const why = changeProblem(planToRoom(space.get().plan), planToRoom(o.plan));
      if (why) return void toast(`Not applied: ${why}`, 'bad');
      undoPlan = space.get().plan;
      review!.options.splice(chosen, 1);
      chosen = -1;
      view = 'before';
      applied++;
      resetMake();
      space.setPlan(o.plan);
      toast(`Applied: ${o.title}`, 'ok');
    };
    const undoChange = () => {
      if (!undoPlan) return;
      space.setPlan(undoPlan);
      undoPlan = null;
      paint();
    };
    dp.body.append(
      goalChips,
      h('div.keyrow.spacegoal', goalIn, reviewBtn),
      viewRow,
      changeList,
      reviewNote,
      h('div.note', 'Ghosty measures the plan against UK guidance — walkways, door swings, light and ventilation, escape windows, Approved Documents B, F, K and M — and suggests up to three changes you can see BEFORE and AFTER. Advice, not approval: anything structural needs Building Control.'),
    );
    const paintReview = () => {
      const opts = review?.options ?? [];
      clear(changeList);
      clear(viewRow);
      opts.forEach((o, i) => changeList.append(button(h('span', h('b', `${i + 1} · ${o.title.toUpperCase()}`), h('small', o.why)), () => choose(chosen === i ? -1 : i), `spaceopt${chosen === i ? ' on' : ''}`)));
      if (opts.length) {
        viewRow.append(
          button('BEFORE', () => ((view = 'before'), paint()), view === 'before' ? 'on' : ''),
          button('AFTER', () => (chosen < 0 ? choose(0) : ((view = 'after'), paint())), view === 'after' ? 'on' : ''),
          button('APPLY', () => applyChange(), chosen >= 0 ? 'warn' : ''),
        );
      }
      if (undoPlan) viewRow.append(button('UNDO CHANGE', () => undoChange()));
      reviewNote.textContent = review ? (opts.length ? `For “${review.goal}”: tap a change to see AFTER on the plan, then APPLY.` : applied ? 'All applied. REVIEW again for more.' : 'No changes to show.') + (review.rejected ? ` ${review.rejected} suggestion${review.rejected > 1 ? 's' : ''} no longer fitted your plan.` : '') : '';
      Object.assign(spaceState.review, { goal: review?.goal ?? '', options: opts.map((o) => o.title), rejected: review?.rejected ?? 0, view, chosen, applied });
    };
    reviewListeners.add(() => {
      chosen = -1;
      view = 'before';
      paint();
    });

    // ======================= ADD FURNITURE
    const ap = panel('ADD FURNITURE', { status: 'UK sizes', cls: 'spaceadd' });
    const chips = h('div.lenschips.spacecat');
    for (const c of CATALOGUE) {
      const b = button(c.label, () => addItem(c.kind, c.label, c.w, c.d));
      b.title = `${c.w} × ${c.d} cm`;
      chips.append(b);
    }
    const cw = h('input', { inputmode: 'decimal', placeholder: 'W cm', 'aria-label': 'Width of your own piece (cm)' });
    const cd = h('input', { inputmode: 'decimal', placeholder: 'D cm', 'aria-label': 'Depth of your own piece (cm)' });
    const cn = h('input', { placeholder: 'name', 'aria-label': 'Name of your own piece' });
    const addOwn = () => {
      const w = parseLength(cw.value);
      const d = parseLength(cd.value);
      if (!w || !d) return void toast('Type its width and depth in cm', 'warn');
      addItem('custom', cn.value.trim().slice(0, 30) || 'Item', Math.round(w / 10), Math.round(d / 10));
    };
    ap.body.append(chips, h('div.keyrow.wrapit.spaceown', cn, cw, cd, button('ADD', () => addOwn())));

    // ======================= WILL IT FIT?
    const fp = panel('WILL IT FIT?', { cls: 'spacefit' });
    const fw = h('input', { inputmode: 'decimal', placeholder: 'W cm', 'aria-label': 'Width of the thing (cm)' });
    const fd = h('input', { inputmode: 'decimal', placeholder: 'D cm', 'aria-label': 'Depth of the thing (cm)' });
    const fitOut = h('div.note.spacefitout');
    const placeBtn = button('PUT IT IN', () => void 0, 'on');
    placeBtn.hidden = true;
    const findBtn = button('FIND ONE THAT FITS', () => void findOne(), 'warn');
    const check = () => {
      const w = parseLength(fw.value);
      const d = parseLength(fd.value);
      if (!w || !d) return void toast('Type its width and depth in cm', 'warn');
      const { room, items } = space.get().plan;
      const r = willItFit(room, items, Math.round(w / 10), Math.round(d / 10), roomsOf(space.get().plan));
      spaceState.fit = r.text;
      fitOut.textContent = r.text;
      fitOut.className = `note spacefitout ${r.fits ? 'good' : 'bad'}`;
      placeBtn.hidden = !r.spot;
      placeBtn.onclick = () => {
        if (!r.spot) return;
        const it: Item = { id: `i${Date.now().toString(36)}`, kind: 'custom', label: 'New piece', w: Math.round(w / 10), d: Math.round(d / 10), x: r.spot.x, y: r.spot.y, rot: r.spot.rot };
        space.setItems([...space.get().plan.items, it]);
        selected = it.id;
        placeBtn.hidden = true;
      };
    };
    const findOne = async () => {
      const { room } = space.get().plan;
      const w = parseLength(fw.value);
      const d = parseLength(fd.value);
      const open = largestOpen(room, space.get().plan.items, GRID, roomsOf(space.get().plan));
      const ww = w ? Math.round(w / 10) : open.w;
      const dd = d ? Math.round(d / 10) : open.h;
      go('core');
      const { send } = await import('../../assistant/session');
      void send(`Find me furniture for this room that fits within ${ww} cm wide and ${dd} cm deep (room ${room.w} × ${room.d} cm).`);
    };
    fp.body.append(h('div.keyrow.spacefitin', fw, h('span.x', '×'), fd, button('CHECK', () => check())), fitOut, h('div.row.wrap', placeBtn, findBtn));

    // ======================= MAKE SPACE
    const mp = panel('MAKE SPACE', { cls: 'spacemake' });
    const optList = h('div.stackf.spaceopts');
    const undoBtn = button('UNDO', () => {
      if (!undoItems) return;
      preview = null;
      space.setItems(undoItems);
      undoItems = null;
      undoBtn.hidden = true;
    });
    undoBtn.hidden = true;
    const run = () => {
      const { room, items } = space.get().plan;
      if (!items.length) return void toast('Add some furniture first', 'warn');
      const r = makeSpace(room, items, 3, roomsOf(space.get().plan));
      options = r.options;
      spaceState.options = options.map((o) => ({ name: o.name, open: o.open.area, moved: o.moved }));
      clear(optList);
      if (!options.length) {
        optList.append(h('div.note', `This is already about as open as it gets: ${(r.now.w / 100).toFixed(1)} × ${(r.now.h / 100).toFixed(1)} m of open floor.`));
        return;
      }
      options.forEach((o, i) => {
        const gain = Math.round(((o.open.area - r.now.area) / 10000) * 10) / 10;
        const b = button(h('span', h('b', `${i + 1} · ${o.name.toUpperCase()}`), h('small', `${(o.open.w / 100).toFixed(1)} × ${(o.open.h / 100).toFixed(1)} m open (+${gain} m²) · ${o.moved} moved${o.gaps ? ` · ${o.gaps} tight gap${o.gaps > 1 ? 's' : ''}` : ''}`)), () => apply(i), 'spaceopt');
        optList.append(b);
      });
    };
    // MAKE SPACE's layouts, UNDO and open-floor preview belong to the room they were made for:
    // a new room (SET, MEASURED, IMPORT) drops them, or UNDO would put the old room's pieces back.
    const resetMake = () => {
      options = [];
      undoItems = null;
      preview = null;
      spaceState.options = [];
      undoBtn.hidden = true;
      clear(optList);
    };
    const apply = (i: number) => {
      const o = options[i];
      if (!o) return;
      undoItems ??= space.get().plan.items;
      preview = o.open;
      space.setItems(o.items);
      undoBtn.hidden = false;
      for (const [k, b] of [...optList.querySelectorAll('button')].entries()) b.classList.toggle('on', k === i);
      toast(`Layout ${i + 1}: ${o.name}`, 'ok');
    };
    mp.body.append(h('div.note', `Up to three layouts that push the furniture to the walls and leave the biggest open floor, with ${WALKWAY} cm walkways kept where they can be.`), h('div.row', button('MAKE SPACE', () => run(), 'on'), undoBtn), optList);

    // ======================= MEASURED
    const msp = panel('MEASURED', { status: 'from the Lens', cls: 'spacemeas' });
    const mList = h('div.stackf');
    msp.body.append(mList, h('div.row.wrap', button('MEASURE A WALL', async () => {
      const { openLens } = await import('../lens');
      openLens('measure', undefined, true);
    }, 'on'), button('CLEAR', () => space.clearMeasurements())));

    // ======================= EXPORT
    const xp = panel('EXPORT', { cls: 'spaceexport' });
    const importIn = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Import a plan file' });
    importIn.hidden = true;
    importIn.addEventListener('change', async () => {
      const f = importIn.files?.[0];
      importIn.value = '';
      if (!f) return;
      try {
        const plan = roomToPlan(JSON.parse(await f.text()));
        if (!plan) throw new Error('That file is not a room plan');
        resetMake();
        selected = '';
        space.setPlan(plan);
        toast('Plan imported', 'ok');
      } catch (e) {
        toast(String((e as Error)?.message ?? e), 'bad');
      }
    });
    const exportPng = async () => {
      const plan = space.get().plan;
      const k = Math.min(3, 1600 / Math.max(plan.room.w, plan.room.d));
      const pad = 40;
      const c = h('canvas');
      c.width = Math.round(plan.room.w * k + pad * 2);
      c.height = Math.round(plan.room.d * k + pad * 2);
      const g = c.getContext('2d');
      if (!g) return;
      g.fillStyle = '#02070d';
      g.fillRect(0, 0, c.width, c.height);
      drawPlan(g, plan, k, pad, { title: `GHOSTY · SPACE PLANNER · ${plan.room.w} × ${plan.room.d} cm` });
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
      if (!blob) return void toast('Could not make the picture', 'bad');
      spaceState.exported.png = blob.size;
      await saveFile(blob, `room-plan-${plan.room.w}x${plan.room.d}.png`);
    };
    const exportJson = async () => {
      const plan = space.get().plan;
      // Room JSON (MAP.md), so the 3D STUDIO's ROOM pane builds exactly this plan.
      const blob = new Blob([JSON.stringify(planToRoom(plan), null, 1)], { type: 'application/json' });
      spaceState.exported.json = blob.size;
      await saveFile(blob, `room-plan-${plan.room.w}x${plan.room.d}.json`);
    };
    const see3d = async () => {
      const { openStudio } = await import('../studio');
      openStudio({ room: planToRoom(space.get().plan) });
    };
    xp.body.append(h('div.row.wrap', button('PNG', () => void exportPng(), 'on'), button('JSON', () => void exportJson()), button('IMPORT', () => importIn.click()), button('SEE IN 3-D', () => void see3d(), 'warn')), importIn, h('div.note', 'The plan is kept on this phone only. PNG is a picture to share; JSON can be imported again here or on another phone.'));

    P.left.append(pp.el);
    P.right.append(rp.el, dp.el, ap.el, fp.el, mp.el, msp.el, xp.el);

    // ======================= drawing and dragging
    let scale = 1;
    // Room for the wall thickness and each wall's length outside it.
    const PAD = 34;
    const fit = () => {
      const { room } = shownPlan();
      const avail = Math.max(200, wrap.clientWidth || 320);
      const maxH = Math.max(220, Math.min(window.innerHeight * 0.55, 620));
      scale = Math.min((avail - PAD * 2) / room.w, (maxH - PAD * 2) / room.d);
      const cssW = Math.round(room.w * scale + PAD * 2);
      const cssH = Math.round(room.d * scale + PAD * 2);
      const k = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * k);
      canvas.height = Math.round(cssH * k);
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, cssW, cssH);
      spaceState.view = { pad: PAD, k: scale };
      const after = view === 'after' && review?.options[chosen];
      drawPlan(g, shownPlan(), scale, PAD, { selected: after ? '' : selected, preview: after ? null : preview, title: after ? `AFTER · ${after.title}` : undefined });
    };
    /** The row under the plan for a chosen wall, door or window. */
    const paintSel = () => {
      const plan = space.get().plan;
      const lay = layoutOf(plan);
      clear(archRow);
      archRow.hidden = true;
      if (view === 'after') return;
      if (selected.startsWith('wall:')) {
        const [, rid, wi] = selected.split(':');
        const r = lay.rooms.find((x) => x.id === rid);
        if (!r) return;
        const e = edgeOf(r.poly, Number(wi));
        const add = (type: 'door' | 'window') => {
          try {
            const got = addOpening(plan, r.id, Number(wi), type);
            selected = `op:${got.id}`;
            space.setPlan(got.plan);
          } catch (err) {
            toast(String((err as Error)?.message ?? err), 'warn');
          }
        };
        archRow.append(h('span.spacesel', `${r.name} · wall ${Number(wi) + 1} · ${Math.round(e.len)} cm`), button('ADD DOOR', () => add('door'), 'on'), button('ADD WINDOW', () => add('window'), 'on'));
        archRow.hidden = false;
        return;
      }
      if (selected.startsWith('op:')) {
        const op = lay.openings.find((o) => `op:${o.id}` === selected);
        if (!op) return;
        const r = lay.rooms.find((x) => x.id === op.room);
        const wIn2 = h('input', { inputmode: 'decimal', value: String(op.w), 'aria-label': `${op.type} width (cm)` });
        const sIn = h('input', { inputmode: 'decimal', value: String(op.sill), 'aria-label': 'Window sill height (cm)' });
        const change = (patch: Partial<Opening>) => {
          try {
            space.setPlan(updateOpening(space.get().plan, op.id, patch));
          } catch (err) {
            toast(String((err as Error)?.message ?? err), 'warn');
          }
        };
        const setSize = () => {
          const w = parseLength(wIn2.value);
          const sl = sIn.value.trim() === '0' ? 0 : parseLength(sIn.value, 'cm');
          change({ ...(w ? { w: Math.round(w / 10) } : {}), ...(op.type === 'window' && sl !== null && sl >= 0 ? { sill: Math.round(sl / 10) } : {}) });
        };
        for (const i of [wIn2, sIn]) i.addEventListener('keydown', (e) => e.key === 'Enter' && setSize());
        archRow.append(
          h('span.spacesel', `${op.type === 'door' ? 'Door' : 'Window'} ${op.id.toUpperCase()} · ${op.w} cm${op.type === 'window' ? ` · sill ${op.sill} cm` : ''}${r ? ` · ${r.name}` : ''}`),
          h('div.keyrow.spaceopsize', h('span.lab', 'W'), wIn2, ...(op.type === 'window' ? [h('span.lab', 'SILL'), sIn] : []), button('SET', () => setSize())),
          ...(op.type === 'door' ? [button('FLIP HINGE', () => change({ hinge: op.hinge === 'start' ? 'end' : 'start' })), button(op.swing === 'in' ? 'SWING: IN' : 'SWING: OUT', () => change({ swing: op.swing === 'in' ? 'out' : 'in' }))] : []),
          button('REMOVE', () => {
            selected = '';
            space.setPlan(removeOpening(space.get().plan, op.id));
          }),
        );
        archRow.hidden = false;
      }
    };

    let roomKey = '';
    const paint = () => {
      const { plan, measures } = space.get();
      const key = `${plan.room.w}x${plan.room.d}`;
      if (roomKey && key !== roomKey) resetMake();
      roomKey = key;
      const gaps = tightGaps(plan.items);
      const bad = clashes(plan.room, plan.items, roomsOf(plan));
      // Only floor counts as open: not an L's notch, nor the gap beside a smaller room.
      const open = largestOpen(plan.room, plan.items, GRID, roomsOf(plan));
      const lay = layoutOf(plan);
      const floor = lay.rooms.reduce((s, r) => s + polyArea(r.poly), 0);
      const swing = inDoorways(plan);
      Object.assign(spaceState, {
        room: { ...plan.room },
        items: plan.items.map((i) => ({ ...i })),
        selected,
        gaps: gaps.map(({ a, b, cm }) => ({ a, b, cm })),
        clashes: bad,
        open,
        rooms: lay.rooms.map((r) => ({ id: r.id, name: r.name, m2: Math.round(polyArea(r.poly) / 1000) / 10, ft2: Math.round((polyArea(r.poly) / 10000) * 10.7639), perimeter: Math.round(polyPerimeter(r.poly)), corners: r.poly.length })),
        openings: lay.openings.map((o) => ({ ...o })),
        area: areaText(floor),
        swing,
      });
      const cur = lay.rooms.find((r) => r.id === selRoomId()) ?? lay.rooms[0]!;
      const cs = shapeOf(cur);
      if (document.activeElement !== wIn) wIn.value = String(Math.round(plan.rooms?.length ? cs.w : plan.room.w));
      if (document.activeElement !== dIn) dIn.value = String(Math.round(plan.rooms?.length ? cs.d : plan.room.d));
      P.big.textContent = `${plan.room.w} × ${plan.room.d} CM`;
      P.sub.textContent = lay.rooms.length > 1 || cs.kind !== 'box' ? `${lay.rooms.length} room${lay.rooms.length > 1 ? 's' : ''} · ${areaText(floor)}` : `${areaText(floor)} · ${bothText(plan.room.w * 10)} × ${bothText(plan.room.d * 10)}`;
      // ROOMS · WALLS
      clear(roomChips, ...lay.rooms.map((r) => button(`${r.name} · ${(polyArea(r.poly) / 10000).toFixed(1)} m²`, () => pickRoom(r.id), r.id === cur.id ? 'on' : '')));
      if (document.activeElement !== rName) rName.value = cur.name;
      if (document.activeElement !== nw) nw.value = cs.kind === 'l' ? String(Math.round(cs.nw)) : '';
      if (document.activeElement !== nd) nd.value = cs.kind === 'l' ? String(Math.round(cs.nd)) : '';
      if (cs.kind === 'l' && corner !== cs.corner) {
        corner = cs.corner;
        cornerBtn.textContent = `NOTCH: ${CORNER_NAMES[corner]}`;
      }
      if (document.activeElement !== wallIn) wallIn.value = String(lay.wall);
      if (document.activeElement !== ceilIn) ceilIn.value = String(lay.h);
      northBtn.textContent = `NORTH: ${['UP', 'RIGHT', 'DOWN', 'LEFT'][Math.round(lay.north / 90) % 4]}`;
      const doors = lay.openings.filter((o) => o.type === 'door').length;
      roomNote.textContent = `${cur.name}: ${areaText(polyArea(cur.poly))}, walls ${(polyPerimeter(cur.poly) / 100).toFixed(2)} m${cs.kind === 'l' ? ' (L-shaped)' : ''}. Plan: ${areaText(floor)}, ${doors} door${doors === 1 ? '' : 's'}, ${lay.openings.length - doors} window${lay.openings.length - doors === 1 ? '' : 's'}.`;
      paintSel();
      paintReview();
      const used = plan.items.reduce((s, it) => s + it.w * it.d, 0) / Math.max(1, floor);
      P.dials([
        ['PIECES', Math.min(1, plan.items.length / 12), String(plan.items.length)],
        ['FLOOR USED', Math.min(1, used), `${Math.round(used * 100)}%`],
        ['OPEN', open.area / Math.max(1, floor), `${(open.w / 100).toFixed(1)}×${(open.h / 100).toFixed(1)}`, '#52f2b5'],
      ]);
      const sel = plan.items.find((i) => i.id === selected);
      selName.textContent = sel ? `${sel.label} · ${sel.w} × ${sel.d} cm` : 'Tap a piece to choose it, drag to move it';
      rotBtn.disabled = delBtn.disabled = !sel;
      info.textContent = [
        `Open floor: ${cmText(open.w * 10)} × ${cmText(open.h * 10)}.`,
        gaps.length ? `${gaps.length} gap${gaps.length > 1 ? 's' : ''} under ${WALKWAY} cm (red).` : `Walkways clear (≥ ${WALKWAY} cm).`,
        bad.length ? `${bad.length} piece${bad.length > 1 ? 's' : ''} overlapping or outside the room.` : '',
        swing.length ? `${swing.length} piece${swing.length > 1 ? 's' : ''} where a door swings.` : '',
      ].filter(Boolean).join(' ');
      pp.setStatus(bad.length ? 'CLASH' : gaps.length ? 'TIGHT' : 'CLEAR', bad.length ? 'off' : gaps.length ? 'mid' : 'ok');
      clear(mList);
      if (!measures.length) mList.append(h('div.note', 'Nothing measured yet. MEASURE A WALL opens the Lens: hold a bank card to the wall, tap its corners, then the wall’s.'));
      else {
        measures.slice(-6).forEach((m) => {
          const text = m.kind === 'rect' ? `${cmText(m.w)} × ${cmText(m.h ?? 0)}` : cmText(m.w);
          const use = (k: 'w' | 'd') => button(k === 'w' ? 'AS WIDTH' : 'AS DEPTH', () => {
            const r = space.get().plan.room;
            try {
              dropNote(space.setRoom(k === 'w' ? { w: m.w / 10, d: r.d } : { w: r.w, d: m.w / 10 }));
            } catch (e) {
              toast(String((e as Error)?.message ?? e), 'warn');
            }
          });
          mList.append(h('div.row.wrap.spacemrow', h('span', h('b', text), h('small', ` ${m.kind === 'rect' ? 'wall' : 'length'} · ${m.confidence} · ${m.via}`)), use('w'), use('d')));
        });
      }
      fit();
    };

    let drag: { id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null = null;
    let dragged: Item[] | null = null;
    let opDrag: { id: string; sx: number; sy: number; moved: boolean } | null = null;
    let opDragged: Plan | null = null;
    const toCm = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left - PAD) / scale, y: (e.clientY - r.top - PAD) / scale };
    };
    const segDist = (p: Pt, a: Pt, b: Pt) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    canvas.addEventListener('pointerdown', (e) => {
      // AFTER is a preview: nothing on it moves until it is applied.
      if (view === 'after') return;
      const p = toCm(e);
      const plan = space.get().plan;
      const items = plan.items;
      const hit = [...items].reverse().find((it) => {
        const f = footprint(it);
        return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
      });
      selected = hit?.id ?? '';
      if (hit) {
        drag = { id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y, sx: e.clientX, sy: e.clientY, moved: false };
        canvas.setPointerCapture(e.pointerId);
      } else {
        // a door or window (drag it along its wall), else a wall, else a room
        const lay = layoutOf(plan);
        const P0: Pt = [p.x, p.y];
        const reach = Math.max(14 / scale, lay.wall);
        const op = lay.openings.find((o) => {
          const r = lay.rooms.find((x) => x.id === o.room);
          if (!r) return false;
          const { p0, p1 } = openingSpan(r, o);
          return segDist(P0, p0, p1) <= reach;
        });
        if (op) {
          selected = `op:${op.id}`;
          opDrag = { id: op.id, sx: e.clientX, sy: e.clientY, moved: false };
          canvas.setPointerCapture(e.pointerId);
        } else {
          let best: { d: number; key: string } | null = null;
          for (const r of lay.rooms) {
            for (let i = 0; i < r.poly.length; i++) {
              const ed = edgeOf(r.poly, i);
              const d = segDist(P0, ed.a, ed.b);
              if (d <= reach && (!best || d < best.d)) best = { d, key: `wall:${r.id}:${i}` };
            }
          }
          const room = best ? null : roomAt(lay.rooms, P0);
          selected = best?.key ?? (room && lay.rooms.length > 1 ? `room:${room.id}` : '');
        }
      }
      paint();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (opDrag) {
        if (!opDrag.moved && Math.hypot(e.clientX - opDrag.sx, e.clientY - opDrag.sy) < 4) return;
        opDrag.moved = true;
        const p = toCm(e);
        const next = slideOpening(space.get().plan, opDrag.id, [p.x, p.y]);
        if (!next) return;
        opDragged = next;
        const g = canvas.getContext('2d');
        if (!g) return;
        const k = Math.min(2, window.devicePixelRatio || 1);
        g.setTransform(k, 0, 0, k, 0, 0);
        g.clearRect(0, 0, canvas.width, canvas.height);
        drawPlan(g, next, scale, PAD, { selected });
        return;
      }
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const p = toCm(e);
      const { plan } = space.get();
      const items = plan.items.map((it) => (it.id === drag!.id ? { ...it, x: p.x - drag!.dx, y: p.y - drag!.dy } : it));
      // while dragging, drawn where the finger is; snapped and saved when let go
      const g = canvas.getContext('2d');
      if (!g) return;
      const k = Math.min(2, window.devicePixelRatio || 1);
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      drawPlan(g, { ...plan, items }, scale, PAD, { selected });
      dragged = items;
    });
    const drop = () => {
      if (opDrag && opDragged) space.setPlan(opDragged);
      opDrag = null;
      opDragged = null;
      if (drag && dragged) {
        const it = dragged.find((i) => i.id === drag!.id);
        if (it) {
          const s = snapItem(space.get().plan.room, it, dragged);
          preview = null;
          space.setItems(dragged.map((i) => (i.id === it.id ? { ...i, ...s } : i)));
        }
      }
      drag = null;
      dragged = null;
    };
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);

    const addItem = (kind: string, label: string, w: number, d: number) => {
      const { room, items } = space.get().plan;
      const r = willItFit(room, items, w, d, roomsOf(space.get().plan));
      const spot = r.spot ?? { x: 0, y: 0, rot: 0 as const };
      const it: Item = { id: `${kind}${Date.now().toString(36).slice(-5)}`, kind, label, w, d, x: spot.x, y: spot.y, rot: spot.rot };
      space.setItems([...items, it]);
      selected = it.id;
      preview = null;
      if (!r.spot) toast(`${label} does not fit anywhere as things stand — try MAKE SPACE`, 'warn');
      paint();
    };
    const rotate = () => {
      const { room, items } = space.get().plan;
      const next = items.map((it) => {
        if (it.id !== selected) return it;
        const turned = { ...it, rot: ((it.rot + 1) % 4) as Item['rot'] };
        const f = footprint(turned);
        return { ...turned, x: Math.max(0, Math.min(turned.x, room.w - f.w)), y: Math.max(0, Math.min(turned.y, room.d - f.h)) };
      });
      preview = null;
      space.setItems(next);
    };
    const removeSel = () => {
      space.setItems(space.get().plan.items.filter((i) => i.id !== selected));
      selected = '';
    };

    space.subscribe(paint);
    new ResizeObserver(() => fit()).observe(wrap);
    expose();
    paint();
    return {
      enter() {
        expose();
        paint();
      },
      describe: () => {
        const { plan, measures } = space.get();
        const m = measures.length ? ` Measured with the Lens: ${describeMeasurements(measures.slice(-6)).replace(/\n/g, '; ')}.` : '';
        return `Space planner: ${describePlan(plan)}.${m}`;
      },
    };
  },
};
