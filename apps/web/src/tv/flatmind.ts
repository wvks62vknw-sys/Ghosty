/**
 * MIND, FLAT (BRIEF-REST-C part 3): Home's centrepiece where the 3-D one cannot run — no WebGL, or three.js refused
 * (the PS5's hidden browser showed the old arc reactor there: OWNER-ISSUES 97 (b)). The same idea drawn in 2-D on the
 * hero's own canvas: a sphere of light in the theme's accent, its meridians turning, a constellation of points on it
 * turning with them (the near side bright, the far side faint, near neighbours linked), light running along a few
 * links, quicker while he is answered. A few hundred strokes a frame; no WebGL, no WebGPU, nothing loaded.
 * features/core/reactor.ts draws this instead of the arc reactor when MIND says why it could not run (heroState.reason);
 * a check passing through Home keeps the old stand-in unless it asks for the hero.
 */
import type { VoiceState } from '../state/app';

type P3 = [number, number, number];
const TAU = Math.PI * 2;

/** The constellation: points on a sphere (seeded, so it keeps its shape) and the links between near ones. */
function constellation(n = 140): { pts: P3[]; links: [number, number][] } {
  let s = 20261101;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pts: P3[] = [];
  // clustered like the library's fields: a few centres, points round each
  const centres: P3[] = Array.from({ length: 7 }, () => {
    const u = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const r = Math.sqrt(1 - u * u);
    return [r * Math.cos(a), u, r * Math.sin(a)];
  });
  for (let i = 0; i < n; i++) {
    const c = centres[i % centres.length]!;
    const p: P3 = [c[0] + (rnd() - 0.5) * 0.7, c[1] + (rnd() - 0.5) * 0.7, c[2] + (rnd() - 0.5) * 0.7];
    const l = Math.hypot(...p) || 1;
    const k = 0.62 + rnd() * 0.3;
    pts.push([(p[0] / l) * k, (p[1] / l) * k, (p[2] / l) * k]);
  }
  const links: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const near = pts.map((q, j) => [j, Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1], q[2] - pts[i]![2])] as [number, number]).filter(([j]) => j > i).sort((a, b) => a[1] - b[1]).slice(0, 2);
    for (const [j, d] of near) if (d < 0.32) links.push([i, j]);
  }
  return { pts, links };
}

const C = constellation();

/** The theme's accent as r, g, b (state/theme.ts writes it as --c). */
function accent(): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--c').trim();
  const m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const hex = /^#?([0-9a-f]{6})$/i.exec(v);
  if (hex) return [parseInt(hex[1]!.slice(0, 2), 16), parseInt(hex[1]!.slice(2, 4), 16), parseInt(hex[1]!.slice(4, 6), 16)];
  return [98, 228, 255];
}

/** One frame of the flat Mind on `el` (its own 2-D context), `t` seconds in. */
export function drawFlatMind(el: HTMLCanvasElement, g: CanvasRenderingContext2D, t: number, state: VoiceState, level: number): void {
  const r0 = el.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.max(1, Math.round(r0.width * dpr));
  const H = Math.max(1, Math.round(r0.height * dpr));
  if (el.width !== W || el.height !== H) {
    el.width = W;
    el.height = H;
  }
  el.dataset.look = 'flatmind';
  const [cr, cg, cb] = accent();
  const col = (a: number) => `rgba(${cr},${cg},${cb},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const busy = state === 'thinking' ? 1 : state === 'speaking' ? 0.7 : state === 'listening' ? 0.4 : 0;
  const R = Math.min(W, H) * 0.34;
  const cx = W / 2;
  const cy = H / 2;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  // the glow and the haze inside
  const glow = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.45);
  glow.addColorStop(0, col(0.16 + level * 0.25 + busy * 0.08));
  glow.addColorStop(0.68, col(0.05));
  glow.addColorStop(1, col(0));
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  const spin = t * (0.16 + busy * 0.35);
  const tilt = 0.32;
  const project = ([x, y, z]: P3): [number, number, number] => {
    const xr = x * Math.cos(spin) + z * Math.sin(spin);
    const zr = -x * Math.sin(spin) + z * Math.cos(spin);
    const yr = y * Math.cos(tilt) - zr * Math.sin(tilt);
    const zt = y * Math.sin(tilt) + zr * Math.cos(tilt);
    return [cx + xr * R, cy + yr * R, zt];
  };
  // meridians turning, and three latitudes
  g.lineWidth = Math.max(1, dpr * 0.8);
  for (let k = 0; k < 6; k++) {
    const a = spin + (k * Math.PI) / 6;
    g.strokeStyle = col(0.1 + 0.12 * Math.abs(Math.cos(a)));
    g.beginPath();
    g.ellipse(cx, cy, Math.abs(Math.cos(a)) * R, R, 0, 0, TAU);
    g.stroke();
  }
  for (const lat of [-0.5, 0, 0.5]) {
    g.strokeStyle = col(lat === 0 ? 0.3 : 0.14);
    g.beginPath();
    g.ellipse(cx, cy + lat * R * Math.cos(tilt), R * Math.sqrt(1 - lat * lat), R * Math.sqrt(1 - lat * lat) * Math.sin(tilt), 0, 0, TAU);
    g.stroke();
  }
  // the constellation: links, light along a few, then the points
  const p2 = C.pts.map(project);
  for (const [i, j] of C.links) {
    const a = p2[i]!;
    const b = p2[j]!;
    g.strokeStyle = col(0.08 + 0.22 * ((a[2] + b[2]) / 2 + 1) / 2);
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }
  const pulses = 4 + Math.round(busy * 10);
  for (let k = 0; k < pulses; k++) {
    const link = C.links[(k * 37 + Math.floor(t * 0.5)) % C.links.length];
    if (!link) continue;
    const u = (t * (0.6 + busy) + k * 0.37) % 1;
    const a = p2[link[0]]!;
    const b = p2[link[1]]!;
    g.fillStyle = col(0.9);
    g.beginPath();
    g.arc(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 1.8 * dpr, 0, TAU);
    g.fill();
  }
  for (const [x, y, z] of p2) {
    const near = (z + 1) / 2;
    g.fillStyle = col(0.25 + 0.7 * near);
    g.beginPath();
    g.arc(x, y, (0.8 + 1.6 * near) * dpr, 0, TAU);
    g.fill();
  }
  // the rim
  g.strokeStyle = col(0.55 + level * 0.4);
  g.lineWidth = Math.max(1.2, dpr * 1.3);
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.stroke();
}
