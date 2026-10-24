// The shared kit of the nav and boot mock-ups: the SVG instruments, the GYM's line art, the status bar and the tab bar,
// ported line for line from ../iron/build.mjs (A's drawings, not redrawn), plus the few new drawings these sheets need
// (marked NEW). Data: DATA below, the same figures on both sheets (see each sheet's legend for what is a sample).

const D = Math.PI / 180;
const f = (n) => +n.toFixed(2);
const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

export const DATA = {
  name: 'Boss', city: 'Birmingham', temp: '14°', sky: 'Light rain',
  gym: { mastered: 3, games: 22, rating: '1,240', up: 35 },
  lib: { passages: '1,685', studied: '642', frac: 642 / 1685 },
  memory: '212',
  school: { stage: 'Nursery', passed: 2, papers: 4 },
};
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
  // NEW (from features/core/home.ts: RAIN, CAR)
  road: '<path d="M5 16.5V12l1.8-4.6A2 2 0 018.7 6h6.6a2 2 0 011.9 1.4L19 12v4.5"/><path d="M4 12h16v4.5H4z"/><circle cx="7.5" cy="14.3" r=".9"/><circle cx="16.5" cy="14.3" r=".9"/><path d="M6 16.5V19M18 16.5V19"/>',
  rain: '<path d="M7 14.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 6.2 4.2 4.2 0 007 14.5z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
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
<radialGradient id="coreHalo"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".18" style="stop-color:var(--c2);stop-opacity:.55"/><stop offset=".5" style="stop-color:var(--c);stop-opacity:.14"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0"/></radialGradient>
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
const statusBar = (time = '20:47') => `<div class="sb" aria-hidden="true"><span class="sb-time">${time}</span><span class="island"></span><span class="sb-right">
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
const topHub = (title) => `<div class="top"><h1 class="navtitle">${title}</h1><span class="round cmd">${ic('search')}</span><span class="round av you">${DATA.name[0]}</span></div>`;
const cmdbar = `<div class="cmdbar">${ic('search')}<span class="ph">Ask or jump anywhere</span><span class="mic">${ic('mic')}</span></div>`;
const rd = (label, value, live = false) => `<span class="rd${live ? ' lv' : ''}"><em>${label}</em><b class="tnum">${value}</b></span>`;

/* ============================== NEW: the two boards the first GYM page adds, in the same hand ============================== */
ART.checkers = () => {
  const P = persp(0, 0, 10, 80, 92, 150), N = 8;
  let g = '', sq = '';
  for (let i = 0; i <= N; i++) { const [a, b] = P(i / N, 0), [c, d] = P(i / N, 1); g += `M${f(a)} ${f(b)}L${f(c)} ${f(d)}`; const [e, h] = P(0, i / N), [k, l] = P(1, i / N); g += `M${f(e)} ${f(h)}L${f(k)} ${f(l)}`; }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) { const q = [P(i / N, j / N), P((i + 1) / N, j / N), P((i + 1) / N, (j + 1) / N), P(i / N, (j + 1) / N)]; sq += `M${q.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`; }
  const at = (i, j) => P((i + 0.5) / N, (j + 0.5) / N);
  const man = (i, j, cls, king = false) => { const [x, y] = at(i, j), s = 0.6 + (j / N) * 0.6; return `<ellipse class="${cls}" cx="${f(x)}" cy="${f(y)}" rx="${f(4.6 * s)}" ry="${f(2.9 * s)}"/>${king ? `<ellipse class="${cls}" cx="${f(x)}" cy="${f(y - 2.4 * s)}" rx="${f(4.6 * s)}" ry="${f(2.9 * s)}"/>` : ''}`; };
  let men = '';
  for (const [i, j] of [[1, 0], [3, 0], [0, 1], [4, 1], [6, 1], [5, 2], [2, 3]]) men += man(i, j, 'stone opp');
  for (const [i, j] of [[1, 6], [3, 6], [6, 5], [0, 7], [2, 7], [4, 5]]) men += man(i, j, 'stone his');
  men += man(5, 6, 'stone his', true);
  const [ax, ay] = at(4, 5), [bx, by] = at(2, 3), [cx2, cy2] = at(3, 4);
  return `<path class="fl2" d="${sq}"/><path class="ln2" d="${g}"/>${men}<path class="mv" d="M${f(ax)} ${f(ay - 4)}Q${f(cx2)} ${f(cy2 - 16)} ${f(bx)} ${f(by - 3)}"/><circle class="tgt" cx="${f(cx2)}" cy="${f(cy2)}" r="3"/>`;
};
ART.tictactoe = () => {
  const s = 22, x0 = 80 - 1.5 * s, y0 = 9;
  const X = (i, j, cls) => { const x = x0 + (i + 0.5) * s, y = y0 + (j + 0.5) * s, r = 6; return `<path class="${cls}" d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}"/>`; };
  const O = (i, j) => `<circle class="ln" cx="${x0 + (i + 0.5) * s}" cy="${y0 + (j + 0.5) * s}" r="6.5" fill="none"/>`;
  return `<path class="ln" d="M${x0 + s} ${y0 + 2}v${3 * s - 4}M${x0 + 2 * s} ${y0 + 2}v${3 * s - 4}M${x0 + 2} ${y0 + s}h${3 * s - 4}M${x0 + 2} ${y0 + 2 * s}h${3 * s - 4}"/>`
    + X(0, 0, 'xmark') + X(1, 1, 'xmark') + O(2, 0) + O(1, 0) + O(0, 2) + X(2, 2, 'xmark next')
    + `<path class="win" stroke-dasharray="2 2.5" d="M${x0 + 4} ${y0 + 4}L${x0 + 3 * s - 4} ${y0 + 3 * s - 4}"/>`;
};
/* ============================== NEW: Learn's other instruments ============================== */
/** Revise: the forgetting curve, reset by each review; the cards due now sit on the line where he would forget. */
export function reviseCurve(w = 160, h = 80, due = 14) {
  const x0 = 14, x1 = w - 10, yT = 10, yB = h - 10, th = yT + (yB - yT) * 0.62;
  const spans = [18, 28, 40, 0];
  let d = '', lifts = '', x = x0;
  spans.forEach((L, k) => {
    const span = L || x1 - x, tau = 8 + k * 9, pts = [];
    for (let t = 0; t <= span; t += 1.5) pts.push(`${f(x + t)} ${f(yT + (th - yT) * (1 - Math.exp(-t / tau)) / (1 - Math.exp(-span / tau)))}`);
    d += `M${pts.join('L')}`;
    x += span;
    if (L) lifts += `M${f(x)} ${f(th)}V${yT}`;
  });
  const r = rng(3);
  let dots = '';
  for (let i = 0; i < due; i++) dots += `<circle class="${i < 4 ? 'fl' : 'dueDot'}" cx="${f(x1 - r() * 16)}" cy="${f(th + (r() - 0.5) * 7)}" r="${i < 4 ? 1.5 : 1.1}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><path class="ln2" d="M${x0} ${yT - 2}V${yB}H${x1 + 4}"/><path class="ln2" stroke-dasharray="2 3" d="M${x0} ${f(th)}H${x1 + 4}"/><path class="ln" stroke-dasharray="1.5 2" d="${lifts}"/><path class="lit" d="${d}"/>${dots}</svg>`;
}
/** Videos (the chat's YouTube summary): the frame, its length, and the moments he marked along it. */
export function videoLine(w = 160, h = 80, moments = [0.06, 0.19, 0.31, 0.47, 0.58, 0.74, 0.9]) {
  const fx = w / 2 - 34, fy = 6;
  const tx0 = 12, tx1 = w - 12, ty = 64;
  const ticks = moments.map((m, i) => `<path class="${i === 3 ? 'lit' : 'ln'}" d="M${f(tx0 + m * (tx1 - tx0))} ${ty - (i === 3 ? 7 : 5)}v${i === 3 ? 14 : 10}"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><rect class="ln" x="${fx}" y="${fy}" width="68" height="40" rx="5" fill="none"/><rect class="fl2" x="${fx}" y="${fy}" width="68" height="40" rx="5"/>
<path class="fl" d="M${fx + 29} ${fy + 12}v16l13-8z"/><path class="ln2" d="M${tx0} ${ty}H${tx1}"/><path class="lit" d="M${tx0} ${ty}H${f(tx0 + 0.47 * (tx1 - tx0))}"/>${ticks}</svg>`;
}
/** Courses as a ring: one segment a part, the read ones lit, the next one live. */
export function courseRing(w = 100, h = 100, parts = 6, done = 2) {
  const cx = w / 2, cy = h / 2, R = 34;
  let s = '';
  for (let k = 0; k < parts; k++) s += `<path class="${k < done ? 'sg on' : k === done ? 'sg live' : 'sg'}" d="${arc(cx, cy, R, (k * 360) / parts + 5, ((k + 1) * 360) / parts - 5)}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><g class="g-ring"><path class="ln2" d="${ringTicks(cx, cy, R + 7, 60, 1.5, 10, 2.4)}"/></g><g class="gr-seg">${s}</g></svg>`;
}
/** Exams: the timer ring (minutes left of the sitting); a waiting exam shows its full ring, unlit. */
export function examRing(w = 100, h = 100, frac = 0.62) {
  const cx = w / 2, cy = h / 2, R = 34;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><circle class="ln2" cx="${cx}" cy="${cy}" r="${R}"/><path class="ln" d="${ringTicks(cx, cy, R + 3, 60, 2, 5, 2)}"/><path class="lit" d="${arc(cx, cy, R, 0, 360 * frac)}"/><circle class="fl" cx="${f(cx + R * Math.cos((360 * frac - 90) * D))}" cy="${f(cy + R * Math.sin((360 * frac - 90) * D))}" r="2.4"/></svg>`;
}
/** Quizzes: the last quiz, a lamp a question (lit right, hollow wrong). */
export function quizRing(w = 100, h = 100, n = 10, right = 8) {
  const cx = w / 2, cy = h / 2, R = 34;
  let s = '';
  for (let k = 0; k < n; k++) { const t = (k / n) * 2 * Math.PI - Math.PI / 2; s += `<circle class="${k < right ? 'fl' : 'ln'}" cx="${f(cx + R * Math.cos(t))}" cy="${f(cy + R * Math.sin(t))}" r="${k < right ? 3.2 : 3}"${k < right ? '' : ' fill="none"'}/>`; }
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><circle class="ln2" cx="${cx}" cy="${cy}" r="${R}" stroke-dasharray="1 3"/>${s}</svg>`;
}
/** A plain dial for the switcher: a tick ring the size of the others, for a centre figure or glyph. */
export function dial(w = 100, h = 100) {
  const cx = w / 2, cy = h / 2, R = 34;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><circle class="ln2" cx="${cx}" cy="${cy}" r="${R}"/><path class="ln" d="${ringTicks(cx, cy, R + 3, 48, 2, 4, 2)}"/><path class="lit" d="${arc(cx, cy, R, 300, 352)}"/></svg>`;
}

/* ============================== NEW: the reactor, for the boot ============================== */
/**
 * Ghosty's reactor in the boot, in one hand with MIND: the core, the coil ring (ten segments), the tick scale, the
 * outer arcs and the dashed orbit. `ph` is the frame: 'ignite' (the core and one ring drawing itself), 'spin' (all rings,
 * the arcs smeared by their spin), 'rest' (all rings still), 'pulse' (rest, brighter, one ring flaring out).
 */
export function reactor(ph = 'rest', size = 300) {
  const c = size / 2, s = size / 300;
  const R = (r) => f(r * s);
  let coil = '';
  for (let k = 0; k < 10; k++) coil += `<path class="coil" d="${arc(c, c, R(46), k * 36 + 4, (k + 1) * 36 - 4)}" stroke-width="${R(9)}"/>`;
  const ticks = `<path class="${ph === 'ignite' ? 'ln2' : 'ln'}" d="${ringTicks(c, c, R(66), 120, R(3), 10, 2.2)}"/>`;
  const outerArcs = [[300, 30], [60, 150], [170, 260]].map(([a, b]) => `<path class="lit" d="${arc(c, c, R(86), a, a < b ? b : b + 360)}"/>`).join('');
  const trails = ph === 'spin' ? [[300, 30], [60, 150], [170, 260]].map(([a]) => [1, 2, 3].map((k) => `<path class="trail t${k}" d="${arc(c, c, R(86), a - k * 9, a - (k - 1) * 9 - 1)}"/>`).join('')).join('')
    + [0, 1, 2, 3, 4].map((k) => `<path class="trail t${(k % 3) + 1}" d="${arc(c, c, R(46), k * 72 - 14, k * 72 - 3)}" stroke-width="${R(9)}"/>`).join('') : '';
  const orbit = `<circle class="ln2" cx="${c}" cy="${c}" r="${R(108)}" stroke-dasharray="${R(1.5)} ${R(5)}"/>` + [0, 90, 180, 270].map((a) => `<path class="ln" d="${arc(c, c, R(108), a - 4, a + 4)}"/>`).join('');
  const core = `<circle class="halo" cx="${c}" cy="${c}" r="${R(ph === 'ignite' ? 70 : 54)}"/><circle class="core" cx="${c}" cy="${c}" r="${R(ph === 'ignite' ? 9 : 12)}"/><circle class="corering" cx="${c}" cy="${c}" r="${R(24)}"/>`;
  if (ph === 'ignite') {
    return `<svg class="reactor ignite" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${core}<path class="lit draw" d="${arc(c, c, R(46), 200, 330)}"/><path class="ln2" d="${arc(c, c, R(46), 330, 559)}" stroke-dasharray="${R(1)} ${R(4)}"/>${ticks}</svg>`;
  }
  return `<svg class="reactor ${ph}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${ph === 'pulse' ? `<circle class="flare" cx="${c}" cy="${c}" r="${R(124)}"/>` : ''}${orbit}${trails}${outerArcs}<circle class="ln2" cx="${c}" cy="${c}" r="${R(86)}"/>${ticks}${coil}<circle class="ln" cx="${c}" cy="${c}" r="${R(34)}"/>${core}</svg>`;
}

export { D, f, rng, I, ic, DEFS, sphere, visPath, ellTicks, ringTicks, arc, globe, viewfinder, mind, gymRing, schoolRing, wave, draft, countdown, glyph, ART, gameArt, statusBar, dock, topHub, cmdbar, rd };
