/**
 * SHAPES: the 2-D BLUEPRINT (BRIEF-REST-C part 2) — the plan his hands made, drawn as a blueprint: the walls as thick
 * lines, each wall's length beside it, each room's name and area in its middle, doors with their swing and windows as
 * thin double lines in the walls, furniture as dashed blocks, a scale bar, the north arrow he set, and the honest line
 * along the foot. Drawn on a canvas (the panel's, or a bigger one for EXPORT PNG).
 */
import { openingSpan } from '../../../../packages/shared/src/design';
import { HONEST, type BuiltPlan } from './plan';

const INK = '#e8f4ff';
const FAINT = 'rgba(232, 244, 255, .5)';
const PAPER = '#0b2340';
const GRID = 'rgba(160, 205, 255, .09)';
const GRID_M = 'rgba(160, 205, 255, .2)';
const FONT = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

/** Draw the blueprint into a w × h area of `g` (CSS pixels); returns the cm → px factor used. */
export function drawBlueprint(g: CanvasRenderingContext2D, built: BuiltPlan, w: number, h: number, opts: { title?: string; guessed: boolean }): number {
  const plan = built.room;
  g.save();
  g.fillStyle = PAPER;
  g.fillRect(0, 0, w, h);
  const pad = Math.max(34, Math.min(w, h) * 0.1);
  const foot = 22;
  const k = Math.min((w - pad * 2) / Math.max(50, plan.room.w), (h - pad * 2 - foot) / Math.max(50, plan.room.d));
  const ox = (w - plan.room.w * k) / 2;
  const oy = (h - foot - plan.room.d * k) / 2;
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy + y * k;
  // the grid: every 50 cm faint, every metre stronger, across the whole sheet
  for (let cm = 0, i = 0; X(cm) <= w || Y(cm) <= h; cm += 50, i++) {
    g.strokeStyle = i % 2 ? GRID : GRID_M;
    g.lineWidth = 1;
    for (const s of [1, -1]) {
      const x = X(s * cm);
      const y = Y(s * cm);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    if (cm > 100000) break;
  }
  const wallPx = Math.max(3, plan.wall * k);
  g.lineJoin = 'miter';
  g.lineCap = 'square';
  g.font = `600 ${Math.max(10, Math.min(13, w / 34))}px ${FONT}`;
  // rooms: floor, walls, the length of each wall outside it, the name and area in the middle
  for (const r of plan.rooms) {
    g.beginPath();
    r.poly.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.closePath();
    g.fillStyle = 'rgba(232, 244, 255, .05)';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = wallPx;
    g.stroke();
  }
  // openings: the wall cut back to paper, a door's leaf and swing, a window's two thin lines
  for (const op of plan.openings) {
    const room = plan.rooms.find((r) => r.id === op.room);
    if (!room) continue;
    const { p0, p1, edge } = openingSpan(room, op);
    g.strokeStyle = PAPER;
    g.lineWidth = wallPx + 2;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(X(p0[0]), Y(p0[1]));
    g.lineTo(X(p1[0]), Y(p1[1]));
    g.stroke();
    g.lineCap = 'square';
    g.lineWidth = 1.2;
    g.strokeStyle = INK;
    if (op.type === 'window') {
      for (const s of [-1, 1]) {
        const nx = (-edge.uy * s * wallPx) / 4;
        const ny = (edge.ux * s * wallPx) / 4;
        g.beginPath();
        g.moveTo(X(p0[0]) + nx, Y(p0[1]) + ny);
        g.lineTo(X(p1[0]) + nx, Y(p1[1]) + ny);
        g.stroke();
      }
    } else {
      // the leaf stands open into the room from the hinge; the arc is its swing
      const cx = X(p0[0]);
      const cy = Y(p0[1]);
      const a0 = Math.atan2(edge.uy, edge.ux);
      const inside = room.poly.reduce((s, p) => s + (p[0] - p0[0]) * -edge.uy + (p[1] - p0[1]) * edge.ux, 0) > 0 ? 1 : -1;
      const a1 = a0 + (inside * Math.PI) / 2;
      const r = op.w * k;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
      g.stroke();
      g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1));
      g.stroke();
      g.setLineDash([]);
    }
  }
  // the lengths, outside each wall, and each room's name and area
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  plan.rooms.forEach((r, ri) => {
    const cx = r.poly.reduce((s, p) => s + p[0], 0) / r.poly.length;
    const cy = r.poly.reduce((s, p) => s + p[1], 0) / r.poly.length;
    const built1 = built.rooms[ri];
    r.poly.forEach((a, i) => {
      const b = r.poly[(i + 1) % r.poly.length]!;
      const len = built1?.walls[i];
      if (!len || len * 100 * k < 26) return;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let nx = -(b[1] - a[1]) / L;
      let ny = (b[0] - a[0]) / L;
      if ((mx - cx) * nx + (my - cy) * ny < 0) [nx, ny] = [-nx, -ny];
      g.fillText(`${len.toFixed(2)} m`, X(mx) + nx * (wallPx / 2 + 11), Y(my) + ny * (wallPx / 2 + 11));
    });
    if (built1) {
      g.fillText(built1.name.toUpperCase(), X(cx), Y(cy) - 8);
      g.fillStyle = FAINT;
      g.fillText(`${built1.area.toFixed(1)} m²`, X(cx), Y(cy) + 8);
      g.fillStyle = INK;
    }
  });
  // furniture and the walls on their own (both are blocks; a wall is drawn solid)
  for (const it of plan.items) {
    const cx = X(it.x + it.w / 2);
    const cy = Y(it.y + it.d / 2);
    g.save();
    g.translate(cx, cy);
    g.rotate((it.rot * Math.PI) / 180);
    if (it.name === 'Wall') {
      g.fillStyle = INK;
      g.fillRect((-it.w * k) / 2, -wallPx / 2, it.w * k, wallPx);
      g.fillText(`${(it.w / 100).toFixed(2)} m`, 0, -wallPx / 2 - 10);
    } else {
      g.strokeStyle = FAINT;
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.strokeRect((-it.w * k) / 2, (-it.d * k) / 2, it.w * k, it.d * k);
      g.setLineDash([]);
      g.fillStyle = FAINT;
      g.fillText(it.name.split(',')[0]!.toUpperCase(), 0, 0);
      g.fillStyle = INK;
    }
    g.restore();
  }
  // the scale bar: a round number of metres about a fifth of the sheet, in black and white halves
  const want = (w * 0.22) / k;
  const bar = [50, 100, 200, 500, 1000, 2000, 5000].find((c) => c >= want * 0.6) ?? 5000;
  const bx = 14;
  const by = h - foot - 6;
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? PAPER : INK;
    g.fillRect(bx + (i * bar * k) / 4, by, (bar * k) / 4, 5);
  }
  g.strokeStyle = INK;
  g.strokeRect(bx, by, bar * k, 5);
  g.textAlign = 'left';
  g.fillStyle = INK;
  g.fillText(`${bar >= 100 ? `${bar / 100} m` : `${bar} cm`}${opts.guessed ? ' · SCALE GUESSED' : ''}`, bx, by - 9);
  // the north arrow he set: the plan's top edge faces `north`°, so north is that much round the other way
  const nx = w - 26;
  const ny = 30;
  const a = (-plan.north * Math.PI) / 180;
  g.save();
  g.translate(nx, ny);
  g.rotate(a);
  g.beginPath();
  g.moveTo(0, -15);
  g.lineTo(7, 9);
  g.lineTo(0, 4);
  g.lineTo(-7, 9);
  g.closePath();
  g.fillStyle = INK;
  g.fill();
  g.textAlign = 'center';
  g.fillText('N', 0, -24);
  g.restore();
  // the foot: the honest line (and the title on an export)
  g.textAlign = 'left';
  g.fillStyle = FAINT;
  g.font = `500 ${Math.max(9, Math.min(11, w / 40))}px ${FONT}`;
  g.fillText(opts.title ? `${opts.title} · ${HONEST}` : HONEST, 14, h - 10);
  g.restore();
  return k;
}
