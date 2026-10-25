// Iron Man inside route C: builds the three contact sheets (a/contact.html, b/contact.html, c/contact.html).
//   node docs/build-plan/mockups/iron/build.mjs
// Every sheet shows the same content (the same five things, the same readouts); only the direction's look changes,
// through its own style.css. The instruments and the GYM's pictures are drawn here by hand as SVG (no assets).
// Each SVG carries the parts every direction might use (A's reactor rings, B's metal bezels); a direction's CSS
// shows only its own. Data: see DATA below (what is the app's own, and what is a sample his phone would fill).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const D = Math.PI / 180;
const f = (n) => +n.toFixed(2);
const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

/* ============================== data ============================== */
// Real, from the app's code: the tools and their words (shell/areas.ts, features/*/index.ts), the Lens's 4,624
// everyday names (features/lens/name.ts), 10 Lens modes (lens blurb), 22 games and levels 1-10 (gym/index.ts,
// gym/meta.ts), each level's pass mark (meta.ts bar()), the league's base rating 1,000 and 8 versions kept
// (gym/rating.ts), the tab bar's five areas and icons, the badge 11 (his own screenshot, 24 Oct).
// Sample (his phone and the live feeds fill these; the same figures as the earlier rounds where they exist):
// God's eye counts (the example line in features/eye/index.ts), the library 4,186 / 1,312 (hero round), GYM levels,
// mastery and ratings, School's stage, the course, the latency, the agenda, the chat.
const DATA = {
  eye: { aircraft: '2,117', sats: '867', cams: '4,433', quakes: '68' },
  lens: { names: '4,624', modes: '10' },
  gym: { mastered: 3, games: 22, rating: '1,240', up: 35 },
  lib: { passages: '4,186', studied: '1,312', frac: 1312 / 4186 },
};
const GAMES = [
  // name, art, level, mastery, pass mark for this level (meta.ts bar(level)), rating (board games' league), change
  { id: 'chess', name: 'Chess', lv: 6, m: 0.52, bar: 0.7, rating: '1,240', d: '+35', live: true },
  { id: 'maze', name: 'Maze', lv: 10, m: 1, bar: 0.95, done: true },
  { id: 'sudoku', name: 'Sudoku', lv: 6, m: 0.66, bar: 0.9 },
  { id: 'connect4', name: 'Connect 4', lv: 8, m: 0.38, bar: 0.42, rating: '1,105', d: '+12' },
  { id: 'go', name: 'Go 9×9', lv: 3, m: 0.44, bar: 0.65, rating: '1,060', d: '±0' },
  { id: 'sokoban', name: 'Sokoban', lv: 7, m: 0.54, bar: 0.6, edge: true },
];

/* ============================== icons (the repo's own set) ============================== */
const I = {
  ask: '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17H4.5A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/><path d="M12 8.5v5M9.5 11h5"/>',
  see: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>',
  make: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
  learn: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2M21.5 9.5v5"/>',
  plan: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  eye: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  lens: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  gym: '<path d="M2 9v6M5 7v10M19 7v10M22 9v6"/><path d="M5 12h14"/>',
  course: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"/><path d="M22 8v6"/>',
  school: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2"/><path d="M12 14v6.5"/>',
  library: '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
  core: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  workshop: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h3M13.5 13h3M7.5 16.5h3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  back: '<path d="M15 4.5L7.5 12l7.5 7.5"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M7 10v10M7 10l4-6.5c1.2 0 2 1 1.8 2.2L12.3 9H18a2 2 0 012 2.3l-1.2 6.5A2 2 0 0116.8 20H7"/><path d="M3 10h4v10H3z"/>',
  down: '<path d="M17 14V4M17 14l-4 6.5c-1.2 0-2-1-1.8-2.2l.5-3.3H6a2 2 0 01-2-2.3l1.2-6.5A2 2 0 017.2 4H17"/><path d="M21 14h-4V4h4z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5"/>',
  listen: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
  spark: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
};
const ic = (k, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

/* ============================== instruments ============================== */
// The shared glow filter (referenced from CSS as url(#glow) / url(#glow2)) lives once per page, in the head.
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="glow2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b6358"/><stop offset=".35" stop-color="#2a2621"/><stop offset=".55" stop-color="#4d463d"/><stop offset="1" stop-color="#15130f"/></linearGradient>
<linearGradient id="metal2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a352e"/><stop offset="1" stop-color="#0f0e0c"/></linearGradient>
<radialGradient id="sph" cx=".42" cy=".36" r=".7"><stop offset="0" style="stop-color:var(--c);stop-opacity:.26"/><stop offset=".7" style="stop-color:var(--c);stop-opacity:.07"/><stop offset="1" style="stop-color:var(--c);stop-opacity:.16"/></radialGradient>
<radialGradient id="sphw" cx=".42" cy=".36" r=".7"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".16"/><stop offset=".7" stop-color="#ffb35a" stop-opacity=".04"/><stop offset="1" stop-color="#ffb35a" stop-opacity=".1"/></radialGradient>
<linearGradient id="scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c);stop-opacity:0"/><stop offset="1" style="stop-color:var(--c);stop-opacity:.3"/></linearGradient>
<radialGradient id="glass" cx=".35" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs></svg>`;

/** Orthographic projection on a tilted sphere. */
function sphere(cx, cy, R, lat0, lon0) {
  return (lat, lon) => {
    const p = lat * D, l = (lon - lon0) * D, p0 = lat0 * D;
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    return [cx + R * Math.cos(p) * Math.sin(l), cy - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), cosc];
  };
}
/** A path through projected points, broken where it goes round the back. */
function visPath(pts) {
  let d = '', pen = false;
  for (const [x, y, c] of pts) {
    if (c > 0) { d += `${pen ? 'L' : 'M'}${f(x)} ${f(y)}`; pen = true; } else pen = false;
  }
  return d;
}
/** A tick scale round an ellipse (MIND's equator ring). */
function ellTicks(cx, cy, rx, ry, n, len, every = 0) {
  let d = '';
  for (let k = 0; k < n; k++) {
    const t = (k / n) * 2 * Math.PI, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t);
    const L = every && k % every === 0 ? len * 2 : len;
    const nx = Math.cos(t) * L, ny = Math.sin(t) * L * (ry / rx) + (Math.sin(t) > 0 ? L * 0.35 : -L * 0.35);
    d += `M${f(x)} ${f(y)}l${f(nx)} ${f(ny)}`;
  }
  return d;
}
/** Ticks round a circle. */
function ringTicks(cx, cy, r, n, len, every = 0, long = 2) {
  let d = '';
  for (let k = 0; k < n; k++) {
    const t = (k / n) * 2 * Math.PI - Math.PI / 2, L = every && k % every === 0 ? len * long : len;
    d += `M${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}L${f(cx + (r + L) * Math.cos(t))} ${f(cy + (r + L) * Math.sin(t))}`;
  }
  return d;
}
const arc = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + r * Math.cos((a - 90) * D), cy + r * Math.sin((a - 90) * D)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
};

/** A metal bezel (Stark workshop): a turned ring with engraved ticks and a glass highlight. */
function bezel(cx, cy, r, w = 9, n = 60) {
  return `<g class="bz"><circle cx="${cx}" cy="${cy}" r="${r + w / 2}" fill="none" stroke="url(#metal)" stroke-width="${w}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r + w}" fill="none" class="bzrim"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" class="bzrim2"/>`
    + `<path class="bztick" d="${ringTicks(cx, cy, r + 1.5, n, 2.4, 5, 2)}"/></g>`;
}

/** God's eye: the planet, live. Meridians and parallels, the aircraft, two satellites on an orbit, "you" on Birmingham. */
function globe() {
  const cx = 60, cy = 60, R = 40, P = sphere(cx, cy, R, 30, -14);
  let mer = '', par = '';
  for (let lon = -180; lon < 180; lon += 30) { const pts = []; for (let lat = -90; lat <= 90; lat += 3) pts.push(P(lat, lon)); mer += visPath(pts); }
  for (const lat of [-60, -30, 30, 60]) { const pts = []; for (let lon = -180; lon <= 180; lon += 3) pts.push(P(lat, lon)); par += visPath(pts); }
  const eqp = []; for (let lon = -180; lon <= 180; lon += 3) eqp.push(P(0, lon));
  const r = rng(7);
  let dots = '';
  const put = (lat, lon, cls = 'g-dot') => { const [x, y, c] = P(lat, lon); if (c > 0.08) dots += `<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${cls === 'g-dot' ? 0.7 : 1.2}"/>`; };
  for (let i = 0; i < 70; i++) put(43 + r() * 16, -9 + r() * 30); // Europe
  for (let i = 0; i < 26; i++) { const t = r(); put(50 + Math.sin(t * Math.PI) * 8 + r() * 3, -55 + t * 45); } // the North Atlantic tracks
  for (let i = 0; i < 22; i++) put(30 + r() * 15, -88 + r() * 18); // the US east
  for (let i = 0; i < 18; i++) put(22 + r() * 18, 28 + r() * 30); // the Gulf and Asia's edge
  const [bx, by] = P(52.48, -1.9);
  const tilt = -24;
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
${bezel(cx, cy, R + 8, 8, 72)}
<g class="g-ring"><circle cx="${cx}" cy="${cy}" r="${R + 11}" class="ln2"/><path class="ln2" d="${ringTicks(cx, cy, R + 11, 72, 2, 6, 2.2)}"/>
<path class="lit" d="${arc(cx, cy, R + 16, 300, 352)}"/><path class="ln" d="${arc(cx, cy, R + 16, 20, 74)}"/><path class="ln2" d="${arc(cx, cy, R + 16, 110, 250)}" stroke-dasharray="1 3"/></g>
<circle class="g-sph" cx="${cx}" cy="${cy}" r="${R}"/>
<path class="g-mer" d="${mer}${par}"/>
<path class="g-eq" d="${visPath(eqp)}"/>
<g class="g-orbit" transform="rotate(${tilt} ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="${R + 9}" ry="11"/><path d="${ellTicks(cx, cy, R + 9, 11, 64, 1.3, 8)}"/></g>
<g class="g-dots">${dots}</g>
<g transform="rotate(${tilt} ${cx} ${cy})"><circle class="g-sat" cx="${f(cx + (R + 9) * Math.cos(1.0))}" cy="${f(cy + 11 * Math.sin(1.0))}" r="1.8"/><circle class="g-sat" cx="${f(cx + (R + 9) * Math.cos(3.6))}" cy="${f(cy + 11 * Math.sin(3.6))}" r="1.5"/></g>
<circle class="g-rim" cx="${cx}" cy="${cy}" r="${R}"/>
<g class="g-you"><circle cx="${f(bx)}" cy="${f(by)}" r="4.2"/><circle cx="${f(bx)}" cy="${f(by)}" r="1.4" class="fl"/></g>
<ellipse class="gl" cx="${cx - 12}" cy="${cy - 18}" rx="22" ry="12" fill="url(#glass)"/>
</svg>`;
}

/** Lens: the viewfinder at rest (the camera is off until he taps): brackets, a reticle, the scan line; B: a lens barrel. */
function viewfinder() {
  const cx = 62, cy = 60;
  let grid = '';
  for (let x = 14; x <= 110; x += 12) for (let y = 14; y <= 106; y += 12) grid += `<circle cx="${x}" cy="${y}" r=".55"/>`;
  const br = (x, y, sx, sy) => `M${x} ${y + sy * 14}V${y}H${x + sx * 14}`;
  const hex = Array.from({ length: 6 }, (_, k) => { const t = (k * 60 + 15) * D; return `${f(cx + 15 * Math.cos(t))},${f(cy + 15 * Math.sin(t))}`; }).join(' ');
  const blades = Array.from({ length: 6 }, (_, k) => { const t = (k * 60 + 15) * D, u = ((k + 1) * 60 + 15) * D; return `M${f(cx + 15 * Math.cos(t))} ${f(cy + 15 * Math.sin(t))}L${f(cx + 30 * Math.cos(u - 0.5))} ${f(cy + 30 * Math.sin(u - 0.5))}`; }).join('');
  const nums = [['∞', -40], ['5', -14], ['2', 12], ['1', 36], ['.5', 58]].map(([t, a]) => `<text x="${f(cx + 39 * Math.cos((a - 90) * D))}" y="${f(cy + 39 * Math.sin((a - 90) * D) + 2)}">${t}</text>`).join('');
  return `<svg viewBox="0 0 124 124" aria-hidden="true">
<g class="vf-grid">${grid}</g>
<g class="vf-lens"><circle cx="${cx}" cy="${cy}" r="49" fill="none" stroke="url(#metal)" stroke-width="10"/><circle cx="${cx}" cy="${cy}" r="54" class="bzrim"/><circle cx="${cx}" cy="${cy}" r="44" class="bzrim2"/>
<path class="bztick" d="${ringTicks(cx, cy, 44.5, 90, 2.2, 10, 1.8)}"/><g class="vf-num">${nums}</g>
<circle cx="${cx}" cy="${cy}" r="33" class="ln2"/><circle cx="${cx}" cy="${cy}" r="30" class="lens-glass"/><path class="ln2" d="${blades}"/><polygon class="ln" points="${hex}"/></g>
<path class="vf-brk" d="${br(8, 8, 1, 1)}${br(116, 8, -1, 1)}${br(8, 116, 1, -1)}${br(116, 116, -1, -1)}"/>
<g class="vf-scan"><rect x="8" y="30" width="108" height="22" fill="url(#scan)"/><path class="lit" d="M8 52H116"/></g>
<g class="vf-ret"><circle cx="${cx}" cy="${cy}" r="12" class="ln"/><path class="ln" d="M${cx} ${cy - 20}v6M${cx} ${cy + 14}v6M${cx - 20} ${cy}h6M${cx + 14} ${cy}h6"/><circle cx="${cx}" cy="${cy}" r="1.6" class="fl"/></g>
<ellipse class="gl" cx="${cx - 12}" cy="${cy - 20}" rx="20" ry="11" fill="url(#glass)"/>
</svg>`;
}

/** The library as MIND: a sphere of light, its constellation one node per ~70 passages here (a miniature), lit as read. */
function mind(w = 120, h = 92, R = 38, n = 60) {
  const cx = w / 2, cy = h / 2, r = rng(11), pts = [];
  // clusters (fields) on the sphere's inside
  const centres = [[-0.4, -0.3, 0.2], [0.45, -0.1, -0.1], [0.05, 0.45, 0.25], [-0.2, 0.15, -0.5], [0.3, -0.45, 0.4]];
  for (let i = 0; i < n; i++) {
    const c = centres[i % centres.length];
    let x = c[0] + (r() - 0.5) * 0.55, y = c[1] + (r() - 0.5) * 0.55, z = c[2] + (r() - 0.5) * 0.55;
    const L = Math.hypot(x, y, z); if (L > 0.92) { x *= 0.92 / L; y *= 0.92 / L; z *= 0.92 / L; }
    pts.push({ x: cx + x * R, y: cy + y * R * 0.96 + z * 4, z, f: i % centres.length });
  }
  const lit = Math.round(n * DATA.lib.frac);
  let links = '', nodes = '';
  pts.forEach((p, i) => {
    const near = pts.map((q, j) => [Math.hypot(p.x - q.x, p.y - q.y), j]).filter(([d, j]) => j !== i && pts[j].f === p.f).sort((a, b) => a[0] - b[0]).slice(0, 2);
    for (const [, j] of near) if (j > i) links += `<path class="${i < lit && j < lit ? 'm-l lit' : 'm-l'}" d="M${f(p.x)} ${f(p.y)}L${f(pts[j].x)} ${f(pts[j].y)}"/>`;
  });
  pts.forEach((p, i) => { nodes += `<circle class="${i < lit ? 'm-n on' : 'm-n'}" cx="${f(p.x)}" cy="${f(p.y)}" r="${i < lit ? 1.25 : 0.85}"/>`; });
  let mer = '';
  for (const k of [0.25, 0.55, 0.85]) mer += `<ellipse cx="${cx}" cy="${cy}" rx="${f(R * k)}" ry="${R}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
${bezel(cx, cy, R + 4, 6, 60)}
<g class="g-ring"><path class="ln2" d="${ringTicks(cx, cy, R + 6, 60, 1.6, 5, 2.2)}"/><path class="lit" d="${arc(cx, cy, R + 9, 0, Math.round(360 * DATA.lib.frac))}"/><path class="ln2" d="${arc(cx, cy, R + 9, Math.round(360 * DATA.lib.frac) + 6, 354)}"/></g>
<circle class="g-sph" cx="${cx}" cy="${cy}" r="${R}"/>
<g class="g-mer m-mer">${mer}</g>
<g class="g-orbit"><ellipse cx="${cx}" cy="${cy}" rx="${R + 6}" ry="8"/><path d="${ellTicks(cx, cy, R + 6, 8, 56, 1.1, 7)}"/></g>
${links}${nodes}
<circle class="m-core" cx="${cx}" cy="${cy + 1}" r="2.6"/>
<circle class="g-rim" cx="${cx}" cy="${cy}" r="${R}"/>
<ellipse class="gl" cx="${cx - 10}" cy="${cy - 16}" rx="18" ry="10" fill="url(#glass)"/>
</svg>`;
}

/** GYM: 22 games round a ring (mastered lit, the one training live); B: a dial with his rating on a needle. */
function gymRing(w = 160, h = 92) {
  const cx = w / 2, cy = h / 2, R = 38, n = DATA.gym.games;
  let segs = '', lamps = '';
  for (let k = 0; k < n; k++) {
    const a0 = (k * 360) / n + 2.2, a1 = ((k + 1) * 360) / n - 2.2;
    const cls = k < DATA.gym.mastered ? 'sg on' : k === DATA.gym.mastered ? 'sg live' : 'sg';
    segs += `<path class="${cls}" d="${arc(cx, cy, R, a0, a1)}"/>`;
    const t = ((k + 0.5) * 360 / n - 90) * D;
    lamps += `<circle class="${cls.replace('sg', 'lp')}" cx="${f(cx + (R + 1) * Math.cos(t))}" cy="${f(cy + (R + 1) * Math.sin(t))}" r="2.1"/>`;
  }
  // the dial: 800-1,600 over 240 degrees, the needle at his rating
  const a = (v) => -120 + ((v - 800) / 800) * 240;
  let scale = '';
  for (let v = 800; v <= 1600; v += 50) { const t = (a(v) - 90) * D, L = v % 200 === 0 ? 5 : 2.5; scale += `M${f(cx + 25 * Math.cos(t))} ${f(cy + 25 * Math.sin(t))}L${f(cx + (25 - L) * Math.cos(t))} ${f(cy + (25 - L) * Math.sin(t))}`; }
  const tn = (a(1240) - 90) * D;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
<g class="g-ring"><circle cx="${cx}" cy="${cy}" r="${R + 6}" class="ln2"/><path class="ln2" d="${ringTicks(cx, cy, R + 6, 88, 1.4, 4, 2)}"/></g>
<g class="gr-seg">${segs}</g>
<g class="gr-dial"><circle cx="${cx}" cy="${cy}" r="${R + 5}" fill="none" stroke="url(#metal)" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${R - 4}" fill="url(#metal2)" class="dialface"/>${lamps}
<path class="bztick" d="${scale}"/><path class="needle" d="M${f(cx - 6 * Math.cos(tn))} ${f(cy - 6 * Math.sin(tn))}L${f(cx + 24 * Math.cos(tn))} ${f(cy + 24 * Math.sin(tn))}"/><circle cx="${cx}" cy="${cy}" r="2.6" class="hub"/></g>
</svg>`;
}

/** School: four papers at this stage, two passed. */
function schoolRing(w = 160, h = 92) {
  const cx = w / 2, cy = h / 2, R = 34;
  let s = '';
  for (let k = 0; k < 4; k++) s += `<path class="${k < 2 ? 'sg on' : k === 2 ? 'sg live' : 'sg'}" d="${arc(cx, cy, R, k * 90 + 5, (k + 1) * 90 - 5)}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${bezel(cx, cy, R + 5, 6, 40)}
<g class="g-ring"><path class="ln2" d="${ringTicks(cx, cy, R + 6, 48, 1.5, 12, 2.4)}"/><circle cx="${cx}" cy="${cy}" r="${R - 7}" class="ln2" stroke-dasharray="1 2.5"/></g>
<g class="gr-seg">${s}</g></svg>`;
}

/** Ask: the uplink, a small trace of the last replies' time (ms). */
function wave() {
  const v = [120, 96, 104, 88, 140, 92, 86, 110, 93, 90, 101, 93];
  const pts = v.map((y, i) => `${f(2 + i * 6.7)},${f(26 - (y - 70) / 4)}`).join(' ');
  return `<svg viewBox="0 0 78 28" width="58" height="22" aria-hidden="true"><path class="ln2" d="M0 27H78"/><polyline class="lit" fill="none" points="${pts}"/><circle class="fl" cx="${f(2 + 11 * 6.7)}" cy="${f(26 - 23 / 4)}" r="1.8"/></svg>`;
}
/** Make: the website draft, as line art of the page. */
function draft() {
  return `<svg viewBox="0 0 40 30" width="40" height="30" aria-hidden="true"><rect class="ln" x=".5" y=".5" width="39" height="29" rx="3" fill="none"/><path class="ln2" d="M.5 6H39.5"/><circle class="fl" cx="4" cy="3.3" r=".9"/><rect class="lit" x="5" y="10" width="17" height="3" rx="1" fill="none"/><path class="ln2" d="M5 17h30M5 20.5h24M5 24h27"/><rect class="ln" x="26" y="9" width="9" height="5" rx="1" fill="none"/></svg>`;
}
/** Plan: the countdown to the next thing in the agenda. */
function countdown(frac = 0.5) {
  return `<svg viewBox="0 0 34 34" width="32" height="32" aria-hidden="true"><circle class="ln2" cx="17" cy="17" r="14" fill="none"/><path class="lit" d="${arc(17, 17, 14, 0, 360 * frac)}"/><path class="ln2" d="${ringTicks(17, 17, 14, 12, -2.5)}"/></svg>`;
}
/** The reply's claims: three found, three asked. */
function claims() {
  let s = '';
  for (let k = 0; k < 3; k++) s += `<path class="sg on" d="${arc(15, 15, 11, k * 120 + 8, (k + 1) * 120 - 8)}"/>`;
  return `<svg viewBox="0 0 30 30" aria-hidden="true"><g class="gr-seg">${s}</g><text x="15" y="18.5" class="ctx">3</text><g class="lamps"><circle class="lp on" cx="6" cy="15" r="3"/><circle class="lp on" cx="15" cy="15" r="3"/><circle class="lp on" cx="24" cy="15" r="3"/></g></svg>`;
}
/** Ghosty's glyph in the reply card (the hologram of MIND in small: a sphere, its ring, a bright core). */
function glyph() {
  return `<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true"><g class="gy-bz"><circle cx="10" cy="10" r="8.6" fill="none" stroke="url(#metal)" stroke-width="2.6"/></g><circle class="gy-rim" cx="10" cy="10" r="7"/><ellipse class="gy-eq" cx="10" cy="10" rx="9.5" ry="2.6"/><circle class="gy-core" cx="10" cy="10" r="2.4"/></svg>`;
}

/* ---------- the GYM's pictures: holographic line-art (160 x 84) ---------- */
function persp(x0, x1, yT, yB, wT, wB) {
  // a board seen from in front: u, v in 0..1 to the screen
  return (u, v) => { const vv = Math.pow(v, 0.85), w = wT + (wB - wT) * vv; return [80 + (u - 0.5) * w, yT + (yB - yT) * vv]; };
}
const ART = {
  chess() {
    const P = persp(0, 0, 10, 80, 92, 150), N = 8;
    let g = '', sq = '';
    for (let i = 0; i <= N; i++) { const [a, b] = P(i / N, 0), [c, d] = P(i / N, 1); g += `M${f(a)} ${f(b)}L${f(c)} ${f(d)}`; const [e, h] = P(0, i / N), [k, l] = P(1, i / N); g += `M${f(e)} ${f(h)}L${f(k)} ${f(l)}`; }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) { const q = [P(i / N, j / N), P((i + 1) / N, j / N), P((i + 1) / N, (j + 1) / N), P(i / N, (j + 1) / N)]; sq += `M${q.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`; }
    const at = (i, j) => P((i + 0.5) / N, (j + 0.72) / N);
    const pc = (i, j, kind, cls) => {
      const [x, y] = at(i, j), s = 0.55 + (j / N) * 0.6, H = 15 * s, W = 4.2 * s;
      let d = `M${f(x - W)} ${f(y)}h${f(2 * W)}M${f(x - W * 0.7)} ${f(y)}L${f(x - W * 0.45)} ${f(y - H * 0.55)}M${f(x + W * 0.7)} ${f(y)}L${f(x + W * 0.45)} ${f(y - H * 0.55)}`;
      if (kind === 'p') d += `M${f(x - W * 0.45)} ${f(y - H * 0.55)}h${f(W * 0.9)}`;
      const head = kind === 'p' ? `<circle class="${cls}" cx="${f(x)}" cy="${f(y - H * 0.72)}" r="${f(2.1 * s)}"/>`
        : kind === 'r' ? `<path class="${cls}" d="M${f(x - W * 0.6)} ${f(y - H * 0.55)}v${f(-H * 0.4)}h${f(W * 0.35)}v${f(H * 0.15)}h${f(W * 0.5)}v${f(-H * 0.15)}h${f(W * 0.35)}v${f(H * 0.4)}"/>`
          : `<path class="${cls}" d="M${f(x - W * 0.5)} ${f(y - H * 0.55)}L${f(x)} ${f(y - H * 0.95)}L${f(x + W * 0.5)} ${f(y - H * 0.55)}M${f(x)} ${f(y - H * 0.95)}v${f(-H * 0.3)}M${f(x - W * 0.3)} ${f(y - H * 1.1)}h${f(W * 0.6)}"/>`;
      return `<path class="${cls}" d="${d}"/>${head}`;
    };
    const [ax, ay] = at(2, 6), [bx, by] = at(4, 3);
    return `<path class="fl2" d="${sq}"/><path class="ln2" d="${g}"/>`
      + pc(5, 1, 'k', 'ln') + pc(3, 2, 'p', 'ln') + pc(6, 2, 'p', 'ln') + pc(1, 3, 'r', 'ln')
      + pc(2, 6, 'r', 'lit') + pc(4, 5, 'p', 'lit') + pc(5, 6, 'k', 'lit') + pc(6, 5, 'p', 'lit')
      + `<path class="mv" d="M${f(ax)} ${f(ay - 10)}Q${f((ax + bx) / 2)} ${f(Math.min(ay, by) - 26)} ${f(bx)} ${f(by - 6)}"/><circle class="tgt" cx="${f(bx)}" cy="${f(by - 2)}" r="3.6"/>`;
  },
  maze() {
    const C = 12, R = 6, s = 12, x0 = 80 - (C * s) / 2, y0 = 6;
    const r = rng(5), seen = new Set(), walls = new Set();
    for (let i = 0; i < C; i++) for (let j = 0; j < R; j++) { walls.add(`h${i},${j}`); walls.add(`v${i},${j}`); }
    const st = [[0, 0]]; seen.add('0,0');
    const par = {};
    while (st.length) {
      const [i, j] = st[st.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < C && b < R && !seen.has(`${a},${b}`));
      if (!nb.length) { st.pop(); continue; }
      const [a, b] = nb[Math.floor(r() * nb.length)];
      if (a !== i) walls.delete(`v${Math.max(a, i)},${j}`); else walls.delete(`h${i},${Math.max(b, j)}`);
      seen.add(`${a},${b}`); par[`${a},${b}`] = [i, j]; st.push([a, b]);
    }
    let d = `M${x0} ${y0}H${x0 + C * s}V${y0 + R * s}H${x0}Z`;
    for (const w of walls) { const [i, j] = w.slice(1).split(',').map(Number); if (w[0] === 'v' && i > 0) d += `M${x0 + i * s} ${y0 + j * s}v${s}`; if (w[0] === 'h' && j > 0) d += `M${x0 + i * s} ${y0 + j * s}h${s}`; }
    const path = []; let cur = [C - 1, R - 1]; while (cur) { path.push(cur); cur = par[`${cur[0]},${cur[1]}`]; }
    const pts = path.reverse().map(([i, j]) => `${x0 + (i + 0.5) * s},${y0 + (j + 0.5) * s}`).join(' ');
    const gx = x0 + (C - 0.5) * s, gy = y0 + (R - 0.5) * s;
    let mud = ''; for (const [i, j] of [[3, 1], [4, 1], [7, 4], [8, 4], [8, 3]]) for (let k = 1; k < 4; k++) mud += `M${x0 + i * s + k * 3} ${y0 + j * s + 1}l-3 ${s - 2}`;
    return `<path class="ln2" d="${mud}"/><path class="ln" d="${d}"/><polyline class="path" fill="none" points="${pts}"/>`
      + `<circle class="fl" cx="${x0 + 0.5 * s}" cy="${y0 + 0.5 * s}" r="2.4"/><path class="gold" d="M${gx} ${gy - 4.5}l4 4.5-4 4.5-4-4.5z"/>`;
  },
  sudoku() {
    const s = 8.6, n = 9, x0 = 80 - (s * n) / 2, y0 = 3;
    let thin = '', thick = '';
    for (let k = 0; k <= n; k++) { const L = `M${f(x0 + k * s)} ${y0}v${f(n * s)}M${x0} ${f(y0 + k * s)}h${f(n * s)}`; if (k % 3) thin += L; else thick += L; }
    const giv = '5..7....3.8.1...9..4..3.6..2..9.4...7...5...3.6..8..1..5.2..8..9...6.4.1....3..2'.replace(/\./g, '0');
    const his = new Set([2, 11, 19, 30, 41, 47, 58, 66, 74]);
    const sol = '519746823683125497247839615125694378978213564364578912431962758892357146756481239';
    let tx = '';
    for (let i = 0; i < 81; i++) {
      const g = giv[i] !== '0', h2 = his.has(i);
      if (!g && !h2) continue;
      tx += `<text class="${g ? 'dg' : 'dg his'}" x="${f(x0 + (i % 9 + 0.5) * s)}" y="${f(y0 + (Math.floor(i / 9) + 0.5) * s + 2.5)}">${sol[i]}</text>`;
    }
    const ci = 49, cxx = x0 + (ci % 9) * s, cyy = y0 + Math.floor(ci / 9) * s;
    return `<rect class="hl" x="${f(x0)}" y="${f(cyy)}" width="${f(n * s)}" height="${s}"/><rect class="hl" x="${f(cxx)}" y="${y0}" width="${s}" height="${f(n * s)}"/>`
      + `<path class="ln2" d="${thin}"/><path class="ln" d="${thick}"/>${tx}<rect class="cur" x="${f(cxx)}" y="${f(cyy)}" width="${s}" height="${s}"/>`;
  },
  connect4() {
    const s = 11.5, x0 = 80 - 3.5 * s, y0 = 13;
    const B = ['.......', '.......', '...o...', '..xx...', '.oxox..', 'oxxoox.'];
    let c = '';
    for (let j = 0; j < 6; j++) for (let i = 0; i < 7; i++) { const ch = B[j][i], x = x0 + (i + 0.5) * s, y = y0 + (j + 0.5) * s; c += `<circle class="${ch === 'x' ? 'disc his' : ch === 'o' ? 'disc opp' : 'hole'}" cx="${f(x)}" cy="${f(y)}" r="4.3"/>`; }
    const dx = x0 + 4.5 * s;
    return `<rect class="ln" x="${f(x0 - 3)}" y="${f(y0 - 3)}" width="${f(7 * s + 6)}" height="${f(6 * s + 6)}" rx="4" fill="none"/>${c}`
      + `<path class="ln2" d="M${f(x0 - 8)} ${f(y0 + 6 * s + 3)}h${f(7 * s + 16)}"/><path class="trail" d="M${f(dx)} ${y0 - 12}v-6"/>`
      + `<circle class="disc his drop" cx="${f(dx)}" cy="${y0 - 6}" r="4.3"/><path class="win" d="M${f(x0 + 1.5 * s)} ${f(y0 + 5.5 * s)}L${f(x0 + 4.5 * s)} ${f(y0 + 2.5 * s)}" stroke-dasharray="2 2.5"/>`;
  },
  go() {
    const P = persp(0, 0, 10, 80, 96, 150), N = 9;
    let g = '';
    for (let i = 0; i < N; i++) { const t = (i + 0.5) / N; const [a, b] = P(t, 0.5 / N), [c, d] = P(t, 1 - 0.5 / N); g += `M${f(a)} ${f(b)}L${f(c)} ${f(d)}`; const [e, h] = P(0.5 / N, t), [k, l] = P(1 - 0.5 / N, t); g += `M${f(e)} ${f(h)}L${f(k)} ${f(l)}`; }
    const st = (i, j, cls) => { const [x, y] = P((i + 0.5) / N, (j + 0.5) / N), s = 0.6 + ((j + 0.5) / N) * 0.6; return `<ellipse class="${cls}" cx="${f(x)}" cy="${f(y)}" rx="${f(4.2 * s)}" ry="${f(3 * s)}"/>`; };
    let stones = '', star = '';
    for (const [i, j] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]]) { const [x, y] = P((i + 0.5) / N, (j + 0.5) / N); star += `<circle class="fl" cx="${f(x)}" cy="${f(y)}" r=".9"/>`; }
    for (const [i, j] of [[3, 2], [4, 3], [5, 3], [3, 4], [5, 5], [2, 5], [6, 4]]) stones += st(i, j, 'stone his');
    for (const [i, j] of [[4, 2], [5, 2], [6, 3], [4, 5], [3, 6], [6, 5]]) stones += st(i, j, 'stone opp');
    stones += st(4, 6, 'stone next');
    return `<path class="ln2" d="${g}"/>${star}${stones}`;
  },
  sokoban() {
    const s = 11, M = ['##########', '#..#.....#', '#..b..##.#', '#.t#.b..t#', '#....p...#', '##########'], C = 10, x0 = 80 - (C * s) / 2, y0 = 9;
    let wall = '', hatch = '', etc = '';
    M.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = x0 + i * s, y = y0 + j * s;
      if (ch === '#') { wall += `M${x} ${y}h${s}v${s}h${-s}Z`; hatch += `M${x + 2} ${y + s}l${s - 2} ${-s + 2}M${x} ${y + s - 3}l${s - 4} ${-s + 4}`; }
      if (ch === 't') etc += `<path class="tgt2" d="M${x + s / 2} ${y + 2}l${s / 2 - 2} ${s / 2 - 2}-${s / 2 - 2} ${s / 2 - 2}-${s / 2 - 2}-${s / 2 - 2}z"/>`;
      if (ch === 'b') etc += `<path class="box" d="M${x + 1.5} ${y + 1.5}h${s - 3}v${s - 3}h${-(s - 3)}zM${x + 1.5} ${y + 1.5}l${s - 3} ${s - 3}M${x + s - 1.5} ${y + 1.5}l${-(s - 3)} ${s - 3}"/>`;
      if (ch === 'p') etc += `<circle class="fl" cx="${x + s / 2}" cy="${y + s / 2}" r="3"/>`;
    }));
    const px = x0 + 5.5 * s, py = y0 + 4.5 * s;
    return `<path class="ln2" d="${hatch}"/><path class="ln" d="${wall}"/>${etc}<path class="path" fill="none" d="M${px} ${py}H${x0 + 6.5 * s}V${y0 + 3.5 * s + 1}"/>`;
  },
};
const gameArt = (id) => `<svg class="gymdraw" viewBox="0 0 160 84" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${id}">${ART[id]()}</svg>`;

/* ============================== screens ============================== */
const statusBar = `<div class="sb" aria-hidden="true"><span class="sb-time">20:00</span><span class="island"></span><span class="sb-right">
<svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg viewBox="0 0 17 12" width="17" height="12"><path d="M8.5 2.2c2.5 0 4.8 1 6.5 2.6l1.2-1.3A11 11 0 008.5.4 11 11 0 00.8 3.5L2 4.8a9.3 9.3 0 016.5-2.6zM8.5 5.8c1.5 0 2.9.6 4 1.6l1.2-1.3a7.4 7.4 0 00-10.4 0l1.2 1.3c1.1-1 2.5-1.6 4-1.6zM8.5 9.2c.6 0 1.1.2 1.5.6L8.5 11.5 7 9.8c.4-.4.9-.6 1.5-.6z"/></svg>
<svg viewBox="0 0 28 13" width="28" height="13"><rect x=".5" y=".5" width="24" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".38"/><rect x="2" y="2" width="11" height="9" rx="2.2"/><path d="M26 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill-opacity=".45"/></svg>
</span></div>`;

function dock(lit, { live = 'learn', badge = 11, press = '' } = {}) {
  const tabs = [['ask', 'Ask'], ['see', 'See'], ['make', 'Make'], ['learn', 'Learn'], ['plan', 'Plan']];
  return `<nav class="dock"><div class="tabblur"></div><div class="tabcap" role="tablist">
${tabs.map(([id, t]) => `<button class="${id === lit ? 'on' : ''}${id === press ? ' press' : ''}" role="tab"><span class="gi"><i class="halo"></i>${ic(id)}${id === live ? '<i class="live"></i>' : ''}${id === 'plan' && badge ? `<span class="badge tnum">${badge}</span>` : ''}</span><span>${t}</span></button>`).join('')}
<i class="sweep"></i></div></nav>`;
}
const topHub = (title) => `<div class="top"><h1 class="navtitle">${title}</h1><span class="round cmd">${ic('search')}</span><span class="round av you">G</span></div>`;
const cmdbar = `<div class="cmdbar">${ic('search')}<span class="ph">Ask or jump anywhere</span><span class="mic">${ic('mic')}</span></div>`;
const rd = (label, value, live = false) => `<span class="rd${live ? ' lv' : ''}"><em>${label}</em><b class="tnum">${value}</b></span>`;

function seeScreen() {
  return `<div class="phone see">${statusBar}<div class="room"></div><div class="view">
${topHub('See')}
<p class="hubsub">The world live, and the camera that understands it.</p>
${cmdbar}
<section class="hubsec"><h2>Tools <small>2 · tap to open</small></h2><div class="hubstack">
<button class="hubtile wide inst eye"><span class="ins">${globe()}</span>
<span class="kick">${ic('eye')}God’s eye<em><i class="dot pulse"></i>Live</em></span>
<span class="t">The planet, live</span><span class="s">Every plane, ship and satellite, and the cameras</span>
<span class="reads">${rd('Aircraft', DATA.eye.aircraft, true)}${rd('Satellites', DATA.eye.sats, true)}${rd('Cameras', DATA.eye.cams)}${rd('Quakes · 24 h', DATA.eye.quakes, true)}</span></button>
<button class="hubtile wide inst lens touch"><span class="ins lensvf">${viewfinder()}<span class="vfcap">CAMERA OFF</span></span>
<span class="kick">${ic('lens')}Lens<em class="off"><i class="dot"></i>Ready</em></span>
<span class="t">Point it at anything</span><span class="s">and he tells you what it is, reads it or measures it</span>
<span class="reads">${rd('Names', DATA.lens.names + '<small>on phone</small>')}${rd('Ways to look', DATA.lens.modes)}</span></button>
</div></section>
<section class="hubsec try"><h2>Try this now</h2>
<button class="tryrow"><span><span class="tk">God’s eye</span><b>“Which planes are over me right now?”</b></span>${ic('chev')}</button>
<button class="tryrow"><span><span class="tk">Lens</span><b>Point it at tonight’s dinner and ask what’s in it</b></span>${ic('chev')}</button>
</section>
</div>${dock('see')}<i class="hi"></i></div>`;
}

function learnScreen() {
  return `<div class="phone learn">${statusBar}<div class="room"></div><div class="view">
${topHub('Learn')}
<p class="hubsub">Courses for you, games and a library for him.</p>
${cmdbar}
<section class="hubsec"><h2>Tools <small>4</small></h2><div class="hubgrid">
<button class="hubtile half inst gym"><span class="ins">${gymRing()}<span class="ctr"><span><b class="tnum">${DATA.gym.mastered}<span class="of">/${DATA.gym.games}</span></b><small>mastered</small></span></span></span>
<span class="kick">${ic('gym')}Gym<em><i class="dot pulse"></i>Training</em></span>
<span class="t">He teaches himself</span>
<span class="reads">${rd('Rating', `${DATA.gym.rating}<i class="up">↑${DATA.gym.up}</i>`, true)}${rd('Now', 'Lv 6', true)}</span></button>
<button class="hubtile half inst course"><span class="ins"><span class="coursemap"><span class="cmk">Your course</span><span class="cm">Algebra</span><span class="segs"><i class="on"></i><i class="on"></i><i class="live"></i><i></i><i></i><i></i></span></span></span>
<span class="kick">${ic('course')}Courses<em class="off">Part 3 of 6</em></span>
<span class="t">Learn anything</span>
<span class="reads">${rd('Next', 'Quiz')}${rd('Cards due', '14')}</span></button>
<button class="hubtile half inst school"><span class="ins">${schoolRing()}<span class="ctr"><span><b class="tnum">2<span class="of">/4</span></b><small>papers</small></span></span></span>
<span class="kick">${ic('school')}School<em class="off">Nursery</em></span>
<span class="t">He sits real papers</span>
<span class="reads">${rd('Passed', '2 of 4')}${rd('Next', 'Paper 3')}</span></button>
<button class="hubtile half inst library"><span class="ins">${mind()}</span>
<span class="kick">${ic('library')}Library<em class="off">Offline</em></span>
<span class="t">All he has read</span>
<span class="reads">${rd('Passages', DATA.lib.passages)}${rd('Studied', DATA.lib.studied)}</span></button>
</div></section>
<section class="hubsec"><h2>The same cards on every tab</h2><div class="hubrow">
<button class="hubtile mini inst"><span class="kick">${ic('core')}Ask</span><span class="mv"><b>Online</b>${wave()}</span><span class="s">Replies in <span class="tnum">93 ms</span></span></button>
<button class="hubtile mini inst"><span class="kick">${ic('workshop')}Make</span><span class="mv"><b>1 draft</b>${draft()}</span><span class="s">A website waits</span></button>
<button class="hubtile mini inst"><span class="kick">${ic('agenda')}Plan</span><span class="mv"><b class="tnum">30 min</b>${countdown()}</span><span class="s">Call Mum at 20:30</span></button>
</div></section>
</div>${dock('learn')}<i class="hi"></i></div>`;
}

function gymScreen() {
  const bars = [100, 100, 100, 62, 74, 55, 48, 66, 40, 38, 52, 30, 44, 28, 36, 22, 30, 18, 14, 10, 8, 6];
  return `<div class="phone gymp">${statusBar}<div class="room"></div><div class="view">
<div class="top"><span class="round back">${ic('back')}</span><span class="sp"></span><span class="round av you">G</span></div>
<h1 class="bigtitle">Gym</h1>
<p class="hubsub">Ghosty teaches himself by playing, on this phone.</p>
<div class="gymsum inst"><div class="row1"><span class="big"><b class="tnum">${DATA.gym.mastered} <span class="of">of ${DATA.gym.games}</span></b><small>games mastered</small></span>
<span class="bars">${bars.map((h, i) => `<i class="${h === 100 ? 'on' : i === 3 ? 'live' : ''}" style="height:${Math.max(8, h)}%"></i>`).join('')}</span>
<button class="go">${ic('play')}Train all</button></div>
<div class="now"><i class="dot pulse"></i><span>Training <b>Chess</b> · level 6 · <span class="tnum">52%</span>, needs <span class="tnum">70%</span> to pass</span></div></div>
<section class="hubsec"><h2>Games <small>6 of 22 shown</small></h2><div class="gymcards">
${GAMES.map((g) => `<button class="gymcard inst${g.live ? ' live' : ''}${g.done ? ' done' : ''}">${gameArt(g.id)}
<span class="nm"><b>${g.name}</b><span>${g.done ? 'ALL 10' : `LV ${g.lv}`}</span></span>
<span class="meter"><i style="width:${Math.round(g.m * 100)}%"></i><u style="left:${Math.round(g.bar * 100)}%"></u></span>
<span class="rl">${g.done ? '<span>Mastered</span><b>100%</b>' : g.rating ? `<span>Rating <b class="tnum">${g.rating}</b> <span class="${g.d.startsWith('+') ? 'up' : ''}">${g.d}</span></span><span class="tnum">${Math.round(g.m * 100)}% · ${Math.round(g.bar * 100)}</span>` : `<span>${g.edge ? 'Level 7½: his edge' : `Lv ${g.lv + 1} at ${Math.round(g.bar * 100)}%`}</span><b class="tnum">${Math.round(g.m * 100)}%</b>`}</span></button>`).join('')}
</div></section>
</div>${dock('learn')}<i class="hi"></i></div>`;
}

function chatScreen() {
  return `<div class="phone chat">${statusBar}<div class="room"></div><div class="view">
<div class="top"><span class="round back">${ic('back')}</span><span class="ctitle">Chat</span><span class="round av you">G</span></div>
<div class="log">
<div class="daysep">Today 19:31</div>
<div class="me"><span>What’s on tonight?</span></div>
<div class="msg plain"><div class="rcwho">${glyph()}<b>Ghosty</b><em>· Llama 4 Scout</em></div><p>Call Mum at half eight, then the bins go out at nine. Nothing else in the diary.</p></div>
<div class="me"><span>Is the M6 bad tonight, and will it rain on the way to Mum’s?</span></div>
<div class="steps">${ic('tick')}<b>3 steps</b> · web search, weather, 2 pages read</div>
<div class="msg cited inst">
<div class="rcwho">${glyph()}<b>Ghosty</b><em>· Gemini 2.5 Flash</em><span class="rccited">${ic('tick')}CITED</span></div>
<div class="meta"><span><b class="tnum">4.2 s</b></span><span><b>2</b> sources</span><span><b>3</b> claims</span></div>
<p>Not great. There’s a queue on the M6 northbound between junctions 6 and 7, adding about 12 minutes<span class="cite">1</span>, and it should clear by about 20:40<span class="cite">1</span>. Light rain until around ten<span class="cite">2</span>, so the roads will be wet. Leave after half eight and you’ll miss most of it.</p>
<div class="claims">${claims()}<span><b>3 of 3 claims</b> found in the sources</span></div>
<div class="srcs">
<div class="src"><span class="n">1</span><span><b>M6 northbound J6 to J7 · queue</b><small>nationalhighways.co.uk</small></span>${ic('chev')}</div>
<div class="src"><span class="n">2</span><span><b>Birmingham forecast, tonight</b><small>metoffice.gov.uk</small></span>${ic('chev')}</div>
</div>
<div class="acts"><span class="a">${ic('up')}</span><span class="a">${ic('down')}</span><span class="a">${ic('copy')}</span><span class="a">${ic('listen')}</span><span class="th">${ic('spark')}Think harder</span></div>
</div>
</div></div>
<div class="cfade"></div>
<div class="composer"><span class="plus">${ic('plus')}</span><span class="ph">Ask anything</span><span class="chip">${ic('tick')}CITED</span><span class="mic">${ic('mic')}</span></div>
<i class="hi"></i></div>`;
}

/* ============================== sheets ============================== */
const DIRS = {
  a: { name: 'A · Reactor HUD', line: 'The arc reactor’s blue-white light in every card: concentric rings, a thin scan line, readouts in an instrument face, and MIND’s hologram (the sphere, its equator scale, the constellation) carried out into the tools, the GYM and the reply.', press: 'make', pressWord: 'a tap lights the ring under the icon' },
  b: { name: 'B · Stark workshop', line: 'Tony’s workshop at night: warm brushed metal, bevelled glass and a lamp’s amber light falling across it; the instruments are physical dials with turned bezels and a needle; fewer lines, more material. The live light stays the reactor’s colour.', press: 'make', pressWord: 'a tap presses the key in, lit from below' },
  c: { name: 'C · Hologram minimal', line: 'The iPhone calm you like (space, large type, one glass) with a holographic layer: translucent cards lit from behind, the live numbers glowing, a sweep of light across what you touch; the least decoration, the most light.', press: 'make', pressWord: 'a tap sends a sweep of light across the bar' },
};

function sheet(key) {
  const d = DIRS[key];
  return `<!doctype html>
<html lang="en-GB" data-theme="reactor">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ghosty · Iron Man in route C · ${d.name}</title>
<link rel="stylesheet" href="../../fonts.css">
<link rel="stylesheet" href="../tokens.css">
<link rel="stylesheet" href="../sheet.css">
<link rel="stylesheet" href="style.css">
</head>
<body class="dir-${key}">
${DEFS}
<main class="sheet">
<header class="shead"><span class="k">Iron Man inside route C · for your pick · 24 Oct</span><h1>${d.name}</h1><p>${d.line}</p></header>
<div class="shots">
<figure class="shot"><figcaption class="cap"><b>1</b><span>See, top to bottom</span><small>title · ask bar · tools · tab bar</small></figcaption>${seeScreen()}</figure>
<figure class="shot"><figcaption class="cap"><b>2</b><span>Hub cards on every tab</span><small>Learn’s four, and Ask, Make, Plan</small></figcaption>${learnScreen()}</figure>
<figure class="shot"><figcaption class="cap"><b>3</b><span>The GYM’s pictures</span><small>line-art boards, rating and next level</small></figcaption>${gymScreen()}</figure>
<figure class="shot"><figcaption class="cap"><b>4</b><span>A reply in the chat</span><small>cited, with its sources</small></figcaption>${chatScreen()}</figure>
</div>
<section class="closewrap"><div class="cap"><b>5</b><span>The floating tab bar, close up</span><small>the lit tab · the live dot · the badge</small></div>
<div class="close">
<div><div class="bar">${dock('see', { live: 'learn' })}</div><div class="note"><span><b>See</b> lit: you are here</span><span><b>11</b> due today on Plan</span></div></div>
<div><div class="bar">${dock('learn', { live: 'learn' })}</div><div class="note"><span><b>Learn</b> lit</span><span>live dot: <b>the GYM is training</b></span></div></div>
<div><div class="bar touch">${dock('see', { live: 'learn', press: d.press })}</div><div class="note"><span><b>Touch</b>: ${d.pressWord}</span></div></div>
</div></section>
<aside class="legend"><p><b>What is real.</b> The tools and their words, the Lens’s 4,624 names and its 10 ways to look, the 22 games and levels 1 to 10, each level’s pass mark (Chess level 6 needs 70%), the league’s rating maths, the tab bar and the 11 on Plan (your screenshot) all come from the app.</p>
<p><b>What is a sample.</b> The live counts (aircraft, satellites, cameras, quakes), the library’s 4,186 / 1,312, the GYM’s levels and ratings, School, the course, the 93 ms, the agenda and the chat are examples of the right size; on your phone each comes from Ghosty’s own feeds and records.</p></aside>
</main>
</body>
</html>
`;
}

for (const k of Object.keys(DIRS)) writeFileSync(join(here, k, 'contact.html'), sheet(k));
console.log('built a, b, c');
