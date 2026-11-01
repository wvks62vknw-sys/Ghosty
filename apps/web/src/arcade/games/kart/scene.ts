/**
 * THE KART RACER on screen: the track built once into two meshes (everything lit, and everything that glows), so a whole
 * lap of road, kerbs, walls and scenery costs two draw calls; the four karts (each one mesh: a little kart of our own
 * with its driver, Ghosty a round white figure with two eyes); the item boxes, slicks and orbs as instanced meshes;
 * sparks, flames, dust and confetti as bits; and a chase camera that swings into the drifts and widens in a boost.
 * Our own look: SALTWIND BAY on a sunny afternoon by the sea, CLOUDTOP PASS in a crisp morning among pines and snow,
 * NEON HARBOUR at night under neon.
 */
import { Bits, type Cam, clamp, flatMaterial, Geo, type Geom, hex3, type IMesh, type Light, makeSky, type Mat, type Obj3, seeded, setLight, setSky, type SkyColours, type ThreeNS } from '../kit';
import { BOOST_TOP, type Kart, type Race, speedOf, TOP } from './sim';
import type { Track, TrackId } from './tracks';

interface Theme {
  road: [number, number];
  dash: number;
  dashGlow: number;
  kerb: [number, number];
  kerbGlow: number;
  verge: number;
  high?: number;
  wall: [number, number];
  wallGlow: number;
  ground: number;
  sky: SkyColours;
  fog: [number, number, number];
  near: number;
  far: number;
  tint: [number, number, number];
  sun: [number, number, number];
}

const THEMES: Record<TrackId, Theme> = {
  seaside: {
    road: [0x5f6372, 0x5a5e6d], dash: 0xf6f2e4, dashGlow: 0, kerb: [0xe24a3c, 0xf7f3ea], kerbGlow: 0, verge: 0xe8d29e, wall: [0x2f9fd8, 0xf7f3ea], wallGlow: 0, ground: 0xe4cb92,
    sky: { top: hex3(0x2f72c9), horizon: hex3(0xbfe3f2), bottom: hex3(0x2d8fc4), sunCol: [1, 0.9, 0.7], sunDir: [0.5, 0.42, 0.75], moonDir: [0, -1, 0], stars: 0 },
    fog: hex3(0xc9e6f2), near: 90, far: 420, tint: [1.06, 1.02, 0.97], sun: [0.45, 0.75, 0.48],
  },
  pass: {
    road: [0x55585f, 0x51545b], dash: 0xf1f1ec, dashGlow: 0, kerb: [0xd84c3a, 0xf3f3f3], kerbGlow: 0, verge: 0x6aa851, high: 0xeef3f8, wall: [0xc3c8d1, 0x9ca3af], wallGlow: 0, ground: 0x5d9a49,
    sky: { top: hex3(0x2a64b8), horizon: hex3(0xd5e8f7), bottom: hex3(0x6f8f68), sunCol: [1, 0.92, 0.78], sunDir: [-0.55, 0.3, 0.78], moonDir: [0, -1, 0], stars: 0 },
    fog: hex3(0xd2e4f2), near: 110, far: 520, tint: [1.03, 1.03, 1.05], sun: [-0.55, 0.62, 0.55],
  },
  city: {
    road: [0x262a37, 0x232734], dash: 0xd8f6ff, dashGlow: 150, kerb: [0xff3fae, 0x2fe6ff], kerbGlow: 190, verge: 0x323849, wall: [0x2d3246, 0x282d40], wallGlow: 0, ground: 0x161a27,
    sky: { top: hex3(0x060918), horizon: hex3(0x33235a), bottom: hex3(0x0b0d18), sunCol: [0.5, 0.35, 0.8], sunDir: [0, -1, 0], moonDir: [0.35, 0.55, -0.76], stars: 1 },
    fog: hex3(0x1b1838), near: 70, far: 330, tint: [0.78, 0.8, 0.98], sun: [0.3, 0.8, -0.5],
  },
};
const NEON = [0xff3fae, 0x2fe6ff, 0xb46bff, 0x8dff6a, 0xffb43c];

// ---------------------------------------------------------------- the karts

function kartGeo(body: number, trim: number, ghost: boolean): Geo {
  const g = new Geo();
  g.box(0, 0.3, 0, 1.24, 0.12, 2.0, 0x2a2e39);
  g.box(0, 0.47, 0.12, 1.02, 0.22, 1.45, body);
  g.box(0, 0.42, 0.92, 1.14, 0.15, 0.36, body);
  g.box(0, 0.35, 1.12, 1.34, 0.07, 0.2, trim);
  for (const s of [-1, 1]) g.box(s * 0.6, 0.43, -0.02, 0.22, 0.2, 0.86, body);
  g.box(0, 0.56, -0.72, 0.68, 0.3, 0.44, 0x3a3f4c);
  for (const s of [-1, 1]) g.cyl(s * 0.2, 0.56, -1.0, 0.075, 0.24, 0xa4aab6, 6, 0, 'z');
  g.box(0, 0.96, -0.96, 1.2, 0.06, 0.28, trim);
  for (const s of [-1, 1]) g.box(s * 0.44, 0.78, -0.96, 0.05, 0.3, 0.14, 0x2a2e39);
  for (const [x, z, r] of [[-0.67, 0.72, 0.27], [0.67, 0.72, 0.27], [-0.7, -0.68, 0.33], [0.7, -0.68, 0.33]] as const) {
    g.cyl(x, r, z, r, 0.3, 0x1c1f26, 10, 0, 'x');
    g.cyl(x + Math.sign(x) * 0.16, r, z, r * 0.45, 0.02, 0xd9dde5, 8, 0, 'x');
  }
  g.cyl(0, 0.76, 0.4, 0.14, 0.04, 0x1c1f26, 8, 0, 'z');
  g.box(0, 0.78, -0.14, 0.52, 0.42, 0.42, ghost ? 0xe9eef8 : 0x2b3550);
  if (ghost) {
    // Ghosty at the wheel: a round white head with two dark eyes and a glow about him
    g.ball(0, 1.22, -0.1, 0.36, 0xf3f7ff, 12, 60);
    for (const s of [-1, 1]) g.box(s * 0.13, 1.27, 0.24, 0.08, 0.14, 0.04, 0x0f1320);
  } else {
    g.ball(0, 1.17, -0.1, 0.3, trim, 10);
    g.box(0, 1.19, 0.17, 0.42, 0.11, 0.06, 0x9fe8ff, 170);
  }
  return g;
}

// ---------------------------------------------------------------- the track

type R = () => number;
const right = (t: Track, i: number): [number, number] => [-t.tz[i]!, t.tx[i]!];
/** A point `lat` to the right of sample i, at height dy above the road. */
const at = (t: Track, i: number, lat: number, dy = 0): number[] => {
  const [rx, rz] = right(t, i);
  return [t.x[i]! + rx * lat, t.y[i]! + dy, t.z[i]! + rz * lat];
};
/** A strip along the road between two offsets (lat0 < lat1), from sample i to j, facing up. */
function strip(g: Geo, t: Track, i: number, j: number, lat0: number, lat1: number, dy: number, hex: number, glow = 0): void {
  g.quad4([at(t, i, lat1, dy), at(t, j, lat1, dy), at(t, j, lat0, dy), at(t, i, lat0, dy)], [0, 1, 0], hex, glow);
}
/** An upright face along the road at `lat`, from dy0 to dy1 above it, facing the side `face` (+1 right, −1 left). */
function wallFace(g: Geo, t: Track, i: number, j: number, lat: number, dy0: number, dy1: number, face: number, hex: number, glow = 0): void {
  const [rx, rz] = right(t, i);
  g.quad4([at(t, i, lat, dy0), at(t, j, lat, dy0), at(t, j, lat, dy1), at(t, i, lat, dy1)], [rx * face, 0, rz * face], hex, glow);
}

/** Is (x, z) clear of the road (more than `room` metres from every part of it)? */
function clear(t: Track, x: number, z: number, room: number): boolean {
  for (let i = 0; i < t.n; i += 3) if ((t.x[i]! - x) ** 2 + (t.z[i]! - z) ** 2 < (room + t.wall[i]!) ** 2) return false;
  return true;
}

/** Flat ground in tiles (fog is worked out at the corners, so a ground of one huge quad would be all fog). */
function ground(g: Geo, cx: number, cz: number, size: number, tile: number, y: number, hex: number, glow = 0): void {
  const n = Math.ceil(size / tile), x0 = cx - (n * tile) / 2, z0 = cz - (n * tile) / 2;
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const x = x0 + a * tile, z = z0 + b * tile;
      g.quad4([[x, y, z], [x + tile, y, z], [x + tile, y, z + tile], [x, y, z + tile]], [0, 1, 0], hex, glow);
    }
  }
}

function palm(g: Geo, x: number, y: number, z: number, r: R): void {
  const lean = (r() - 0.5) * 1.6, lz = (r() - 0.5) * 1.6, hgt = 6 + r() * 3;
  let px = x, py = y, pz = z;
  for (let k = 1; k <= 4; k++) {
    const f = k / 4;
    const nx = x + lean * f * f, ny = y + hgt * f, nz = z + lz * f * f;
    g.beam(px, py, pz, nx, ny, nz, 0.36 - f * 0.1, k % 2 ? 0x9a7650 : 0x8a6846);
    (px = nx), (py = ny), (pz = nz);
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + r();
    const ex = px + Math.sin(a) * 3.2, ez = pz + Math.cos(a) * 3.2;
    g.beam(px, py, pz, (px + ex) / 2, py + 0.6, (pz + ez) / 2, 0.5, 0x3f9e4c);
    g.beam((px + ex) / 2, py + 0.6, (pz + ez) / 2, ex, py - 1.1, ez, 0.42, 0x4bb058);
  }
  g.ball(px, py - 0.3, pz, 0.32, 0x7a5a32, 6);
}

function pine(g: Geo, x: number, y: number, z: number, r: R, snow: boolean): void {
  const s = 0.8 + r() * 0.7;
  g.box(x, y + 0.9 * s, z, 0.4 * s, 1.8 * s, 0.4 * s, 0x6b4a32);
  const greens = [0x2f6b3c, 0x3a7d45, 0x2a5f37];
  for (let k = 0; k < 3; k++) g.cone(x, y + (1.4 + k * 1.5) * s, z, (2.4 - k * 0.6) * s, 2.6 * s, snow && k === 2 ? 0xeef3f8 : greens[k]!, 7);
}

function building(g: Geo, glow: Geo, x: number, z: number, w: number, d: number, hgt: number, ry: number, r: R): void {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const shell = [0x262b3c, 0x2d2843, 0x1f2a39, 0x2a3040][Math.floor(r() * 4)]!;
  // a box turned by ry: four faces and a roof, then a band of windows a floor
  const corner = (u: number, v: number, y: number) => [x + u * cs + v * sn, y, z - u * sn + v * cs];
  const faces: [number, number, number, number, [number, number, number]][] = [
    [w / 2, -d / 2, w / 2, d / 2, [cs, 0, -sn]],
    [-w / 2, d / 2, -w / 2, -d / 2, [-cs, 0, sn]],
    [-w / 2, d / 2, w / 2, d / 2, [sn, 0, cs]],
    [w / 2, -d / 2, -w / 2, -d / 2, [-sn, 0, -cs]],
  ];
  for (const [u0, v0, u1, v1, n] of faces) {
    g.quad4([corner(u0, v0, -0.5), corner(u1, v1, -0.5), corner(u1, v1, hgt), corner(u0, v0, hgt)], n, shell);
    const warm = r() < 0.5;
    for (let y = 3; y < hgt - 2; y += 3.4) {
      if (r() < 0.22) continue;
      const lit = r() < 0.7;
      const o = 0.06;
      const p0 = corner(u0 + (u1 - u0) * 0.08, v0 + (v1 - v0) * 0.08, y);
      const p1 = corner(u0 + (u1 - u0) * 0.92, v0 + (v1 - v0) * 0.92, y);
      const lift = (p: number[], dy: number) => [p[0]! + n[0] * o, p[1]! + dy, p[2]! + n[2] * o];
      g.quad4([lift(p0, 0), lift(p1, 0), lift(p1, 1.3), lift(p0, 1.3)], n, lit ? (warm ? 0xffcf8a : 0x9fdcff) : 0x3a4258, lit ? 150 + Math.floor(r() * 80) : 0);
    }
  }
  g.quad4([corner(-w / 2, -d / 2, hgt), corner(w / 2, -d / 2, hgt), corner(w / 2, d / 2, hgt), corner(-w / 2, d / 2, hgt)], [0, 1, 0], 0x1c2030);
  // a neon sign on some
  if (r() < 0.55) {
    const col = NEON[Math.floor(r() * NEON.length)]!;
    const [u0, v0, , , n] = faces[Math.floor(r() * 4)]!;
    const p = corner(u0 * 0.2, v0 * 1.0, hgt * (0.45 + r() * 0.3));
    const px = p[0]! + n[0] * 0.4, pz = p[2]! + n[2] * 0.4;
    const tall = 5 + r() * 7;
    g.box(px, p[1]!, pz, 1.1, tall, 1.1, col, 255);
    glow.box(px, p[1]!, pz, 2.6, tall + 1.6, 2.6, col, 255);
  }
}

/** The whole track as two geometries: what is lit and what glows (drawn added, softly). */
export function trackGeo(t: Track, id: TrackId, seed = 7): { solid: Geo; glow: Geo } {
  const th = THEMES[id];
  const g = new Geo(), glow = new Geo();
  const r = seeded(seed);
  const half = t.def.half;
  for (let i = 0; i < t.n; i++) {
    const j = (i + 1) % t.n;
    const tun = !!t.tunnel[i];
    const bend = Math.abs(t.k[i]!) > 1 / 70;
    const W = t.wall[i]!;
    strip(g, t, i, j, -half, half, 0, th.road[Math.floor(i / 3) % 2]!);
    if (i % 5 < 2) strip(g, t, i, j, -0.12, 0.12, 0.012, th.dash, th.dashGlow);
    // kerbs on the bends, a painted edge on the straights
    for (const s of [-1, 1]) {
      const a = s < 0 ? -half - 0.8 : half, b = s < 0 ? -half : half + 0.8;
      if (bend && !tun) strip(g, t, i, j, a, b, 0.04, th.kerb[i % 2]!, th.kerbGlow);
      else strip(g, t, i, j, s < 0 ? -half : half - 0.22, s < 0 ? -half + 0.22 : half, 0.01, th.dash, th.dashGlow);
      if (!tun) {
        const v0 = s < 0 ? -W : bend ? half + 0.8 : half, v1 = s < 0 ? (bend ? -half - 0.8 : -half) : W;
        const hi = th.high && t.y[i]! > 24 ? th.high : th.verge;
        strip(g, t, i, j, v0, v1, -0.01, hi);
      }
      // the wall: an upright face towards the road and a top
      const wallTop = tun ? 6 : id === 'city' ? 1.1 : 0.9;
      const col = th.wall[Math.floor(i / 2) % 2]!;
      wallFace(g, t, i, j, s * W, -0.2, wallTop, -s, col);
      strip(g, t, i, j, s < 0 ? -W - 0.45 : W, s < 0 ? -W : W + 0.45, wallTop, tun ? 0x3b3f4a : col);
      wallFace(g, t, i, j, s * (W + 0.45), -0.2, wallTop, s, col);
      if (id === 'city' && !tun) strip(g, t, i, j, s < 0 ? -W - 0.4 : W + 0.05, s < 0 ? -W - 0.05 : W + 0.4, wallTop + 0.06, NEON[(Math.floor(i / 40) + (s > 0 ? 1 : 3)) % NEON.length]!, 230);
      // what lies beyond the wall: the beach, the mountainside, the pavement
      if (!tun) {
        if (id === 'pass') {
          const hgt = t.y[i]! + 0.5, out = 4 + hgt * 1.25;
          const col2 = hgt > 9 ? 0x8b8f98 : th.ground;
          const [rx, rz] = right(t, i), [qx, qz] = right(t, j);
          const p = (k: number, lat: number, y: number) => [t.x[k]! + (k === i ? rx : qx) * lat, y, t.z[k]! + (k === i ? rz : qz) * lat];
          const L0 = s * (W + 0.45), L1 = s * (W + 0.45 + out);
          g.quad4([p(i, L0, t.y[i]! - 0.2), p(j, L0, t.y[j]! - 0.2), p(j, L1, -1.2), p(i, L1, -1.2)], [rx * s * 0.6, 0.8, rz * s * 0.6], col2);
        } else {
          const out = id === 'city' ? 7 : 24;
          strip(g, t, i, j, s < 0 ? -W - 0.45 - out : W + 0.45, s < 0 ? -W - 0.45 : W + 0.45 + out, -0.05, id === 'city' ? 0x2b3040 : th.ground);
        }
      }
    }
    if (tun) {
      // the tunnel: a ceiling, warm lamps along it, rock above
      strip(g, t, j, i, -W, W, 6, 0x34373f);
      if (i % 4 === 0) {
        const p = at(t, i, 0, 5.9);
        g.box(p[0]!, p[1]!, p[2]!, 1.6, 0.12, 0.6, 0xffe2a8, 255);
        glow.box(p[0]!, p[1]! - 0.3, p[2]!, 3.2, 0.6, 1.6, 0xffc970, 255);
      }
      if (i % 3 === 0) {
        const p = at(t, i, (r() - 0.5) * 6, 6);
        g.cone(p[0]!, p[1]!, p[2]!, 11 + r() * 5, 9 + r() * 8, r() < 0.5 ? 0x7d828c : 0x8d9199, 7, 0, 2);
        g.cone(p[0]!, p[1]! + 12, p[2]!, 5, 7, 0xf1f5fa, 6);
      }
    }
  }
  // the tunnel's mouths
  for (const [a, b] of t.def.tunnel) {
    for (const f of [a, b]) {
      const i = Math.round(f * t.n) % t.n;
      const p = at(t, i, 0, 0), [rx, rz] = right(t, i);
      for (const s of [-1, 1]) g.box(p[0]! + rx * s * (t.wall[i]! + 1.4), p[1]! + 3.4, p[2]! + rz * s * (t.wall[i]! + 1.4), 2.4, 7, 2.4, 0x6f6a62);
      g.beam(p[0]! - rx * (t.wall[i]! + 2.6), p[1]! + 7.2, p[2]! - rz * (t.wall[i]! + 2.6), p[0]! + rx * (t.wall[i]! + 2.6), p[1]! + 7.2, p[2]! + rz * (t.wall[i]! + 2.6), 1.6, 0x6f6a62);
      g.beam(p[0]! - rx * 3, p[1]! + 6.5, p[2]! - rz * 3, p[0]! + rx * 3, p[1]! + 6.5, p[2]! + rz * 3, 0.2, 0xffd27a, 255);
    }
  }
  // the start: a chequered line and a gantry with its lights
  {
    const i = 0, j = 1;
    for (let c = 0; c < 12; c++) {
      const a = -half + (c * 2 * half) / 12, b = -half + ((c + 1) * 2 * half) / 12;
      for (let row = 0; row < 2; row++) {
        const [ii, jj] = row === 0 ? [i, j] : [j, (j + 1) % t.n];
        strip(g, t, ii, jj, a, b, 0.02, (c + row) % 2 ? 0x16181e : 0xf4f4f4);
      }
    }
    const W = t.wall[0]!;
    for (const s of [-1, 1]) {
      const p = at(t, 0, s * (W + 0.8), 0);
      g.box(p[0]!, p[1]! + 3.2, p[2]!, 0.7, 6.4, 0.7, 0x343a4a);
    }
    const l = at(t, 0, -W - 0.8, 6.4), rr = at(t, 0, W + 0.8, 6.4);
    g.beam(l[0]!, l[1]!, l[2]!, rr[0]!, rr[1]!, rr[2]!, 1.1, 0x2a2f3c);
    for (let c = -3; c <= 3; c++) {
      const p = at(t, 0, c * 1.6, 6.4);
      g.box(p[0]!, p[1]!, p[2]!, 0.5, 0.5, 1.2, c % 2 ? 0xff5a5a : 0x5aff9a, 220);
    }
  }
  // the scenery of each place
  if (id === 'seaside') {
    ground(g, 100, 40, 1500, 60, -0.8, 0x2b8ac2);
    for (let i = 0; i < 260; i++) {
      const x = (r() - 0.5) * 900 + 100, z = (r() - 0.5) * 900;
      g.box(x, -0.78, z, 2 + r() * 5, 0.02, 0.18, 0xd8f3ff, 140);
    }
    for (let i = 0; i < t.n; i += 7) {
      for (const s of [-1, 1]) {
        if (r() < 0.45) continue;
        const d = t.wall[i]! + 4 + r() * 12;
        const [rx, rz] = right(t, i);
        const x = t.x[i]! + rx * s * d, z = t.z[i]! + rz * s * d;
        if (clear(t, x, z, 3)) palm(g, x, 0, z, r);
      }
    }
    // beach huts along the first straight
    for (let i = 8; i < 44; i += 4) {
      const [rx, rz] = right(t, i);
      const d = t.wall[i]! + 7;
      const x = t.x[i]! - rx * d, z = t.z[i]! - rz * d;
      const col = [0xf28fa0, 0x7fc8f0, 0xf5d36a, 0x9fe0b4][(i / 4) % 4]!;
      g.box(x, 1.3, z, 3, 2.6, 3, col);
      g.box(x, 2.9, z, 3.6, 0.5, 3.6, 0xf7f3ea);
      g.box(x - rx * 1.52, 1.0, z - rz * 1.52, 1, 2, 0.1, 0x5b4b3c);
    }
    // the lighthouse on the headland, the harbour's boats, islands far out
    {
      const i = Math.round(t.n * 0.36), [rx, rz] = right(t, i);
      const d = t.wall[i]! + 16;
      const x = t.x[i]! + rx * d, z = t.z[i]! + rz * d;
      for (let k = 0; k < 6; k++) g.cyl(x, 1.6 + k * 3.2, z, 2.4 - k * 0.18, 3.2, k % 2 ? 0xf7f3ea : 0xd8463c, 12);
      g.cyl(x, 21, z, 1.5, 2, 0xfff4c2, 10, 255);
      glow.ball(x, 21, z, 4.5, 0xfff0b0, 10, 255);
      g.cone(x, 22, z, 1.9, 2, 0x2c3140, 10);
    }
    for (let k = 0; k < 9; k++) {
      const x = 230 + r() * 120, z = -60 - r() * 160;
      g.box(x, -0.4, z, 2.4, 1, 6, 0xf4f1ea);
      g.beam(x, 0, z, x, 8, z, 0.15, 0x6b5a48);
      g.quad4([[x, 1.2, z - 2], [x, 1.2, z + 1.5], [x, 7.5, z], [x, 7.5, z]], [1, 0, 0], k % 2 ? 0xf7f3ea : 0xffa25a);
    }
    for (const [x, z, w] of [[-260, 160, 90], [420, 260, 120], [-120, -380, 140], [520, -260, 80]] as const) g.cone(x, -1, z, w, 26, 0x5f9d5a, 9, 0, w * 0.35);
  }
  if (id !== 'city') {
    // clouds: soft white heaps far off, lit by the sun
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2 + r() * 0.2, d = 260 + r() * 160;
      const x = 100 + Math.sin(a) * d, z = 40 + Math.cos(a) * d, y = 55 + r() * 45;
      for (let q = 0; q < 4; q++) g.ball(x + (q - 1.5) * (9 + r() * 4), y + r() * 4, z + (r() - 0.5) * 8, 7 + r() * 6, 0xffffff, 7, 70, 0.55);
    }
  }
  if (id === 'pass') {
    ground(g, 130, 70, 1500, 60, -0.6, th.ground);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + r() * 0.3, d = 520 + r() * 200;
      const x = 130 + Math.sin(a) * d, z = 70 + Math.cos(a) * d, w = 140 + r() * 120, hgt = 120 + r() * 140;
      g.cone(x, -1, z, w, hgt, r() < 0.5 ? 0x7a8494 : 0x6c7686, 8);
      g.cone(x, -1 + hgt * 0.62, z, w * 0.38 + 0.5, hgt * 0.38, 0xf3f6fa, 8);
    }
    for (let k = 0; k < 170; k++) {
      const i = Math.floor(r() * t.n);
      if (t.tunnel[i]) continue;
      const s = r() < 0.5 ? -1 : 1, [rx, rz] = right(t, i);
      const d = t.wall[i]! + 6 + (t.y[i]! + 0.5) * 1.25 + r() * 40;
      const x = t.x[i]! + rx * s * d, z = t.z[i]! + rz * s * d;
      if (clear(t, x, z, 4 + 1.3 * 30)) pine(g, x, -0.6, z, r, false);
      else if (clear(t, x, z, 6)) pine(g, x, -0.6, z, r, false);
    }
    for (let k = 0; k < 50; k++) {
      const x = (r() - 0.3) * 700, z = (r() - 0.4) * 700;
      if (clear(t, x, z, 30)) g.ball(x, 0, z, 1.5 + r() * 3, 0x8d9199, 6, 0, 0.7);
    }
  } else if (id === 'city') {
    ground(g, 90, 60, 1300, 50, -0.5, th.ground);
    // the water by the chicane
    for (let x = -60; x < 340; x += 40) g.quad4([[x, -0.42, -230], [x + 40, -0.42, -230], [x + 40, -0.42, -110], [x, -0.42, -110]], [0, 1, 0], 0x0f2440);
    for (let k = 0; k < 120; k++) g.box(140 + (r() - 0.5) * 400, -0.38, -170 + (r() - 0.5) * 110, 3 + r() * 6, 0.02, 0.2, NEON[k % NEON.length]!, 120);
    // lamps along the pavement
    for (let i = 0; i < t.n; i += 12) {
      for (const s of [-1, 1]) {
        const p = at(t, i, s * (t.wall[i]! + 3), 0);
        g.box(p[0]!, 2.6, p[2]!, 0.2, 5.2, 0.2, 0x3a4052);
        g.box(p[0]!, 5.3, p[2]!, 0.7, 0.25, 0.7, 0xe8f6ff, 255);
        glow.box(p[0]!, 5.2, p[2]!, 2, 0.8, 2, 0x9fe3ff, 255);
      }
    }
    // the neon arches over the road
    for (const f of [0.08, 0.3, 0.55, 0.85]) {
      const i = Math.round(f * t.n) % t.n, W = t.wall[i]!;
      const col = NEON[Math.round(f * 10) % NEON.length]!;
      const a = at(t, i, -W - 0.5, 0), b = at(t, i, W + 0.5, 0);
      for (const p of [a, b]) g.box(p[0]!, 4, p[2]!, 0.5, 8, 0.5, 0x2a2f40);
      for (const dy of [7.6, 8.4]) g.beam(a[0]!, dy, a[2]!, b[0]!, dy, b[2]!, 0.22, col, 255);
      glow.beam(a[0]!, 8, a[2]!, b[0]!, 8, b[2]!, 1.6, col, 255);
    }
    // the buildings round the loop
    for (let k = 0; k < 140; k++) {
      const i = Math.floor(r() * t.n), s = r() < 0.5 ? -1 : 1, [rx, rz] = right(t, i);
      const w = 12 + r() * 18, d = 12 + r() * 18, hgt = 14 + r() * (r() < 0.2 ? 70 : 34);
      const dist = t.wall[i]! + 9 + Math.max(w, d) / 2 + r() * 30;
      const x = t.x[i]! + rx * s * dist, z = t.z[i]! + rz * s * dist;
      if (!clear(t, x, z, 8 + Math.hypot(w, d) / 2)) continue;
      building(g, glow, x, z, w, d, hgt, Math.atan2(t.tx[i]!, t.tz[i]!), r);
    }
  }
  return { solid: g, glow };
}

// ---------------------------------------------------------------- the scene

export interface KartScene {
  scene: Obj3;
  camera: Cam;
  update(race: Race, dt: number, t: number, o: { title: boolean; shake: number; you: number; finish: number }): void;
  setAspect(a: number): void;
  /** A burst of bits where something happened. */
  burst(kind: 'wall' | 'bump' | 'box' | 'shield' | 'boost', x: number, y: number, z: number): void;
  dispose(): void;
  /** The track's outline for the minimap: x, z every 4 m. */
  outline: number[];
}

export function makeKartScene(T: ThreeNS, track: Track, id: TrackId, accent: number): KartScene {
  const th = THEMES[id];
  const geos: Geom[] = [];
  const mats: Mat[] = [];
  const keep = (g: Geom) => (geos.push(g), g);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(70, 0.5, 0.5, 1400);
  const sky = makeSky(T);
  sky.scale.set(600, 600, 600);
  scene.add(sky);
  const solid = flatMaterial(T), glowMat = flatMaterial(T, { alpha: 0.22, additive: true }), smokeMat = flatMaterial(T, { alpha: 0.38 }), sparkMat = flatMaterial(T, { alpha: 0.9, additive: true }), blobMat = flatMaterial(T, { alpha: 0.3 });
  mats.push(solid, glowMat, smokeMat, sparkMat, blobMat);
  const built = trackGeo(track, id);
  const trackMesh = new T.Mesh(keep(built.solid.build(T)), solid);
  trackMesh.frustumCulled = false;
  const glowMesh = new T.Mesh(keep(built.glow.build(T)), glowMat);
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 2;
  scene.add(trackMesh, glowMesh);

  const colours = [0xff6a3d, accent, 0xffc83d, 0x6ad38a];
  const trims = [0xffe2a8, 0xffffff, 0x2b3550, 0x203a2c];
  const karts = colours.map((c, i) => {
    const m = new T.Mesh(keep(kartGeo(c, trims[i]!, i === 1).build(T)), solid);
    scene.add(m);
    return m;
  });
  const inst = (g: Geo, n: number, m: Mat): IMesh => {
    const im = new T.InstancedMesh(keep(g.build(T)), m, n) as IMesh;
    im.frustumCulled = false;
    im.setColorAt(0, new T.Color(0xffffff));
    im.count = 0;
    scene.add(im);
    return im;
  };
  const blobs = inst(new Geo().cyl(0, 0, 0, 1.15, 0.01, 0x000000, 14), 4, blobMat);
  const shields = inst(new Geo().ball(0, 0, 0, 1.6, 0x7fdcff, 12, 230), 4, glowMat);
  // a flame: a little pyramid pointing back (−z), stretched by its boost
  const flameGeo = new Geo();
  const tip = [0, 0, -0.9], sq = [[-0.17, -0.17], [0.17, -0.17], [0.17, 0.17], [-0.17, 0.17]] as const;
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = sq[e]!, [bx, by] = sq[(e + 1) % 4]!;
    flameGeo.quad4([[ax, ay, 0], [bx, by, 0], tip, tip], [(ax + bx) / 2, (ay + by) / 2, -0.4], 0xffffff, 255);
  }
  const flames = inst(flameGeo, 8, sparkMat);
  const boxGeo = new Geo();
  boxGeo.box(0, 0, 0, 0.9, 0.9, 0.9, 0xffffff, 240);
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    boxGeo.box(x * 0.55, y * 0.55, 0, 0.16, 0.16, 1.26, 0x2f3350);
    boxGeo.box(x * 0.55, 0, y * 0.55, 0.16, 1.26, 0.16, 0x2f3350);
    boxGeo.box(0, x * 0.55, y * 0.55, 1.26, 0.16, 0.16, 0x2f3350);
  }
  const boxes = inst(boxGeo, 16, solid);
  const halos = inst(new Geo().ball(0, 0, 0, 1.4, 0xffffff, 8, 255), 16, glowMat);
  const slickGeo = new Geo().cyl(0, 0.03, 0, 1.45, 0.02, 0x14161c, 16).cyl(0.3, 0.05, 0.2, 0.7, 0.02, 0x3a2f5e, 10, 120).cyl(-0.4, 0.05, -0.3, 0.5, 0.02, 0x245a5a, 10, 120);
  const slicks = inst(slickGeo, 8, solid);
  const orbs = inst(new Geo().ball(0, 0, 0, 0.5, 0xffe066, 10, 255), 6, solid);
  const orbHalos = inst(new Geo().ball(0, 0, 0, 1.3, 0xff9a3c, 8, 255), 6, glowMat);
  const sparks = new Bits(T, 240, keep(new Geo().box(0, 0, 0, 0.12, 0.12, 0.12, 0xffffff, 255).build(T)), sparkMat);
  const smoke = new Bits(T, 120, keep(new Geo().ball(0, 0, 0, 0.5, 0xffffff, 6, 110).build(T)), smokeMat);
  scene.add(sparks.mesh, smoke.mesh);
  const BOX_COLS = [0xff6ad5, 0x6ae0ff, 0xffd36a, 0x8dff8a];

  const dummy = new T.Object3D();
  const col = new T.Color();
  const light: Light = { sun: th.sun, tint: th.tint, fog: th.fog, fogNear: th.near, fogFar: th.far, fill: [-0.3, 0.5, -0.8] };
  for (const m of mats) setLight(m, light);
  setSky(sky, th.sky);
  const put = (im: IMesh, i: number, x: number, y: number, z: number, ry = 0, s = 1, rx = 0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  };
  const tint = (im: IMesh, i: number, hex: number) => {
    const c = hex3(hex);
    im.setColorAt(i, col.setRGB(c[0], c[1], c[2]));
  };
  const outline: number[] = [];
  for (let i = 0; i < track.n; i += 2) outline.push(track.x[i]!, track.z[i]!);

  let aspect = 0.5, camYaw = 0, camX = 0, camY = 5, camZ = 0, camInit = false, spinA = [0, 0, 0, 0], fovNow = 70;
  const SPARK_COLS = [0xfff1c4, 0x58b9ff, 0xff9a2e, 0xd36bff];
  const local = (k: Kart, lx: number, ly: number, lz: number): [number, number, number] => {
    const s = Math.sin(k.h), c = Math.cos(k.h);
    return [k.x + lx * c + lz * s, k.y + ly, k.z - lx * s + lz * c];
  };

  const update: KartScene['update'] = (race, dt, t, o) => {
    // the karts: heading, a hop, a lean into the turn, a wobble after a bump, a whirl when spun
    let flameN = 0, shieldN = 0;
    race.karts.forEach((k, i) => {
      const m = karts[i]!;
      const v = speedOf(k);
      const hop = k.hopT > 0 ? Math.sin((1 - k.hopT / 0.24) * Math.PI) * 0.35 : 0;
      spinA[i] = k.spinT > 0 ? spinA[i]! + dt * 13 : spinA[i]! * Math.max(0, 1 - dt * 10);
      const slide = k.drift ? k.drift * 0.32 : 0;
      m.position.set(k.x, k.y + hop + Math.sin(t * 30 + i) * Math.min(0.02, v * 0.001), k.z);
      m.rotation.set(-clamp(v / TOP, 0, 1.3) * 0.02 + (k.boostT > 0 ? -0.04 : 0), k.h - slide + spinA[i]! + Math.sin(t * 40) * k.wobble * 0.08, k.steer * clamp(v / TOP, 0, 1) * 0.07 + (k.drift ? -k.drift * 0.08 : 0));
      put(blobs, i, k.x, k.y + 0.03, k.z, k.h, 1 - hop * 0.6);
      if (k.shieldT > 0 && (k.shieldT > 1.5 || Math.sin(t * 24) > 0)) put(shields, shieldN++, k.x, k.y + 0.8, k.z, t, 1 + Math.sin(t * 6) * 0.03);
      if (k.boostT > 0) {
        for (const sx of [-0.2, 0.2]) {
          const p = local(k, sx, 0.56, -1.25);
          dummy.position.set(p[0], p[1], p[2]);
          dummy.rotation.set(0, k.h, 0);
          const s = 0.85 + Math.random() * 0.35;
          dummy.scale.set(s, s, s * (1 + 0.6 * Math.min(1, k.boostT)));
          dummy.updateMatrix();
          flames.setMatrixAt(flameN, dummy.matrix);
          tint(flames, flameN++, Math.random() < 0.5 ? 0xffb648 : 0xff7a3a);
          if (Math.random() < 0.7) sparks.emit(p[0], p[1], p[2], -Math.sin(k.h) * 8 + (Math.random() - 0.5) * 2, Math.random() * 2, -Math.cos(k.h) * 8 + (Math.random() - 0.5) * 2, 0.25, 0.9, Math.random() < 0.5 ? 0xffd27a : 0xff8a3a);
        }
      }
      // drift sparks from the back wheels, their colour the boost they would give
      if (k.drift && v > 6) {
        for (const sx of [-0.72, 0.72]) {
          const p = local(k, sx, 0.08, -0.7);
          const c = SPARK_COLS[k.clean ? k.level : 0]!;
          sparks.emit(p[0], p[1], p[2], (Math.random() - 0.5) * 4 - Math.sin(k.h) * 3, 1 + Math.random() * 3, (Math.random() - 0.5) * 4 - Math.cos(k.h) * 3, 0.32, k.level ? 1.3 : 0.8, c);
        }
      }
      if (k.offroad && v > 6 && Math.random() < 0.6) {
        const p = local(k, (Math.random() - 0.5) * 1.4, 0.2, -0.8);
        smoke.emit(p[0], p[1], p[2], (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 0.6, 0.75, id === 'seaside' ? 0xf0e2b8 : id === 'pass' ? 0xb8a888 : 0x8a90a8);
      }
      if (k.spinT > 0 && Math.random() < 0.5) sparks.emit(k.x, k.y + 1.6, k.z, Math.cos(t * 9 + i) * 2, 1.5, Math.sin(t * 9 + i) * 2, 0.4, 1.1, 0xffe066);
    });
    blobs.count = race.karts.length;
    shields.count = shieldN;
    flames.count = flameN;
    // the boxes spin and come back; the slicks; the orbs with their halos
    let bn = 0;
    race.boxes.forEach((b, i) => {
      const grow = b.t > 0 ? clamp(1 - b.t / 0.6, 0, 1) * (b.t < 0.6 ? 1 : 0) : 1;
      if (grow <= 0.01) return;
      put(boxes, bn, b.x, b.y + 1.15 + Math.sin(t * 2.4 + i) * 0.12, b.z, t * 1.4 + i, grow, t * 0.7);
      tint(boxes, bn, BOX_COLS[i % 4]!);
      put(halos, bn, b.x, b.y + 1.15, b.z, 0, grow * (1 + Math.sin(t * 4 + i) * 0.06));
      tint(halos, bn++, BOX_COLS[i % 4]!);
    });
    boxes.count = halos.count = bn;
    race.slicks.forEach((s, i) => put(slicks, i, s.x, s.y, s.z, i * 1.7, Math.min(1, s.age * 4)));
    slicks.count = race.slicks.length;
    race.orbs.forEach((b, i) => {
      put(orbs, i, b.x, b.y + 0.8 + Math.sin(t * 12) * 0.08, b.z, t * 6);
      put(orbHalos, i, b.x, b.y + 0.8, b.z, 0, 1 + Math.sin(t * 20) * 0.15);
      if (Math.random() < 0.8) sparks.emit(b.x, b.y + 0.8, b.z, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.35, 0.7, 0xffd060);
    });
    orbs.count = orbHalos.count = race.orbs.length;
    sparks.update(dt, 9, 1.5);
    smoke.update(dt, -0.6, 1.2);
    for (const im of [blobs, shields, flames, boxes, halos, slicks, orbs, orbHalos]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    // the camera: on the title it circles the grid; in the race it rides behind your kart, swings into a drift and
    // pulls wide in a boost; after the finish it turns slowly round you
    const k = race.karts[o.you] ?? race.karts[0]!;
    const portrait = aspect < 1;
    if (o.title) {
      const a = t * 0.12;
      const c = race.karts[1]!;
      camera.position.set(c.x + Math.sin(a) * 15, c.y + 5.5, c.z + Math.cos(a) * 15);
      camera.lookAt(c.x, c.y + 0.8, c.z);
      camInit = false;
    } else if (o.finish > 0) {
      const a = k.h + Math.PI + o.finish * 0.35;
      camera.position.set(k.x + Math.sin(a) * 8, k.y + 3.2, k.z + Math.cos(a) * 8);
      camera.lookAt(k.x, k.y + 0.9, k.z);
    } else {
      const v = speedOf(k);
      const want = k.h - (k.drift ? k.drift * 0.22 : 0);
      if (!camInit) (camYaw = want), (camInit = true);
      let d = want - camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      camYaw += d * Math.min(1, dt * (k.spinT > 0 ? 1.5 : 5.5));
      const back = (portrait ? 7 : 6.2) + clamp(v / TOP, 0, 1.4) * 0.8, up = portrait ? 4.1 : 2.6;
      const tx = k.x - Math.sin(camYaw) * back, tz = k.z - Math.cos(camYaw) * back, ty = k.y + up;
      const kk = Math.min(1, dt * 9);
      camX += (tx - camX) * kk;
      camZ += (tz - camZ) * kk;
      camY += (ty - camY) * Math.min(1, dt * 6);
      if (Math.hypot(tx - camX, tz - camZ) > 12) (camX = tx), (camZ = tz), (camY = ty);
      const sh = o.shake;
      camera.position.set(camX + (Math.random() - 0.5) * sh, camY + (Math.random() - 0.5) * sh, camZ + (Math.random() - 0.5) * sh);
      const ahead = portrait ? 11 : 6;
      camera.lookAt(k.x + Math.sin(camYaw) * ahead, k.y + (portrait ? 0.4 : 1.2), k.z + Math.cos(camYaw) * ahead);
    }
    // the view: about 80° across in landscape, as wide as sense allows upright; a boost widens it
    const v = speedOf(k);
    const boostK = clamp((v - TOP) / (BOOST_TOP - TOP), 0, 1);
    const hfov = 78 + boostK * 10;
    const want = clamp((2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI, 56, portrait ? 88 : 80) + boostK * 4;
    fovNow += (want - fovNow) * Math.min(1, dt * 4);
    if (Math.abs(fovNow - camera.fov) > 0.05) (camera.fov = fovNow), camera.updateProjectionMatrix();
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);
  };

  const burst: KartScene['burst'] = (kind, x, y, z) => {
    const n = kind === 'box' ? 18 : kind === 'wall' ? 12 : 9;
    for (let q = 0; q < n; q++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * (kind === 'box' ? 6 : 5);
      const c = kind === 'box' ? BOX_COLS[q % 4]! : kind === 'shield' ? 0x7fdcff : kind === 'boost' ? (q % 2 ? 0xffb648 : 0xffe08a) : q % 3 ? 0xfff1c4 : 0xffb648;
      sparks.emit(x, y + 0.6, z, Math.cos(a) * sp, 1.5 + Math.random() * 4, Math.sin(a) * sp, 0.35 + Math.random() * 0.3, kind === 'box' ? 1.6 : 1, c);
    }
    if (kind === 'wall') for (let q = 0; q < 3; q++) smoke.emit(x, y + 0.5, z, (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2, 0.8, 1, 0xd8dce4);
  };

  return {
    scene,
    camera,
    update,
    burst,
    outline,
    setAspect(a: number) {
      aspect = a;
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
    },
  };
}
