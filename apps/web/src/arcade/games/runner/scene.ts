/**
 * THE RUNNER's world on screen: a track of tiles (gaps left out), a city of coloured blocks at dawn, then a tunnel,
 * a bridge over the sea, the rooftops, each in pieces of 20 m built once in a few variants and reused as the run goes
 * by (so the scenery loops with variation at no cost), the obstacles, coins and power-ups as instanced meshes (one
 * draw call a kind), the runner (a little figure of our own in Ghosty's colour, with a glowing antenna) and the shadow
 * behind him. The runner stays at z = 0 and the world comes to him (no precision lost on a long run).
 */
import {
  type Cam, clamp, flatMaterial, Geo, type Geom, hex3, type IMesh, type Light, type Mat, type Mesh, mix3, type Obj3, setLight, setSky, makeSky, type ThreeNS,
} from '../kit';
import { type Coin, LANE_W, type Power, POWERS, type Run, ROLL_SECONDS, type Section, sectionAt, type Up } from './sim';

const PIECE = 20;
const TILE = 2;
const AHEAD = 150;
const BEHIND = 14;
const PALETTE = [0xf2b4a0, 0xf6d8a8, 0xb9c5ea, 0x9fd6c9, 0xeaa8c2, 0xf1e2c9, 0xa9b9da, 0xf4c38f, 0xc7b3e6];

interface Look {
  top: [number, number, number];
  horizon: [number, number, number];
  fog: [number, number, number];
  tint: [number, number, number];
  near: number;
  far: number;
}
const LOOKS: Record<Section, Look> = {
  city: { top: hex3(0x2f3d7a), horizon: hex3(0xf6a47a), fog: hex3(0xeaa98e), tint: [1.04, 0.98, 0.95], near: 40, far: 150 },
  tunnel: { top: hex3(0x2f3d7a), horizon: hex3(0xf6a47a), fog: hex3(0x14161f), tint: [0.78, 0.76, 0.86], near: 12, far: 70 },
  bridge: { top: hex3(0x3a58a8), horizon: hex3(0xf8c095), fog: hex3(0xf1bc9c), tint: [1.06, 1.0, 0.96], near: 50, far: 160 },
  roof: { top: hex3(0x4a5fb0), horizon: hex3(0xfbd0a4), fog: hex3(0xf0c4a8), tint: [1.08, 1.03, 0.98], near: 45, far: 155 },
};
const TILE_COL: Record<Section, [number, number]> = { city: [0x4a4f66, 0x4d5269], tunnel: [0x3a3d4c, 0x3c3f4f], bridge: [0x9a6a45, 0x8c5f3d], roof: [0x7a7488, 0x777186] };
const DASH_COL: Record<Section, number> = { city: 0xf3efe2, tunnel: 0xf2b33d, bridge: 0xb48055, roof: 0xe9e6ef };

// ---------------------------------------------------------------- the pieces of scenery

function cityPiece(r: () => number): Geo {
  const g = new Geo();
  g.box(0, -0.06, -10, 80, 0.1, 20, 0x8d8aa0);
  for (const side of [-1, 1]) {
    g.box(side * 4.5, 0.08, -10, 2.4, 0.16, 20, 0xc9c2cf);
    let z = 0;
    while (z > -20) {
      const w = Math.min(-z + 20 > 4 ? 4.5 + r() * 5 : -z + 20, 20 + z);
      const hgt = 7 + r() * 24;
      const dep = 7 + r() * 6;
      const inner = 6.2;
      const x = side * (inner + dep / 2);
      const col = PALETTE[Math.floor(r() * PALETTE.length)]!;
      g.box(x, hgt / 2, z - w / 2, dep, hgt, w - 0.4, col);
      // windows on the face towards the track, some lit
      const skip = side < 0 ? 62 : 61;
      for (let y = 2.2; y < hgt - 1.2; y += 2.6) {
        for (let zz = z - 1.3; zz > z - w + 1; zz -= 1.8) {
          const lit = r() < 0.3;
          g.box(side * (inner - 0.03), y, zz, 0.02, 1.1, 0.9, lit ? 0xffd9a0 : 0x56607e, lit ? 190 : 0, skip);
        }
      }
      if (r() < 0.5) g.box(x + side * (r() - 0.5) * 2, hgt + 0.6, z - w / 2, 2, 1.2, 1.6, 0xb7bccb);
      z -= w;
    }
    for (const zz of [-5, -15]) {
      g.box(side * 3.9, 1.8, zz, 0.12, 3.6, 0.12, 0x3b3f52);
      g.box(side * 3.65, 3.6, zz, 0.6, 0.1, 0.12, 0x3b3f52);
      g.box(side * 3.4, 3.5, zz, 0.34, 0.12, 0.28, 0xfff2c8, 255);
    }
    if (r() < 0.6) {
      const zz = -2 - r() * 16;
      g.box(side * 4.9, 1, zz, 0.24, 2, 0.24, 0x6b4a32);
      g.ball(side * 4.9, 2.7, zz, 1.05, 0x5fae63, 8);
    }
  }
  return g;
}

function tunnelPiece(r: () => number, portal: boolean): Geo {
  const g = new Geo();
  const wall = r() < 0.5 ? 0x4b5062 : 0x535067;
  for (const side of [-1, 1]) {
    g.box(side * 3.75, 2.6, -10, 0.5, 5.2, 20, wall);
    g.box(side * 3.48, 1.25, -10, 0.04, 0.32, 20, 0xe7a33e, 70);
    g.box(side * 3.48, 0.2, -10, 0.06, 0.4, 20, 0x2b2e3a);
    g.cyl(side * 3.3, 4.5, -10, 0.12, 20, 0x8b8f9e, 8, 0, 'z');
    for (let z = -4; z > -20; z -= 8) g.box(side * 3.46, 2.6, z, 0.05, 0.5, 0.9, 0x9ee6ff, 230);
  }
  g.box(0, 5.35, -10, 8, 0.3, 20, 0x3c4050);
  for (const z of [-2.5, -7.5, -12.5, -17.5]) g.box(0, 5.18, z, 1.6, 0.05, 0.5, 0xfff3d6, 255);
  if (portal) {
    // the way in: a hill face over the mouth
    for (const side of [-1, 1]) g.box(side * 10, 8, 0.6, 12.5, 16, 1.2, 0x7b6f8e);
    g.box(0, 10.6, 0.6, 7.6, 10.8, 1.2, 0x7b6f8e);
    g.box(0, 5.5, 1.25, 7.8, 0.6, 0.2, 0xe7a33e, 80);
    g.box(0, 16.5, -6, 40, 1, 14, 0x6c8f5f);
  }
  return g;
}

function bridgePiece(r: () => number, tower: boolean): Geo {
  const g = new Geo();
  g.box(0, -16, -10, 400, 0.1, 20, 0x2f74a6);
  for (const side of [-1, 1]) {
    g.box(side * 3.45, -0.35, -10, 0.5, 0.9, 20, 0xc4553f);
    g.box(side * 3.4, 1.15, -10, 0.08, 0.08, 20, 0xeee8dd);
    for (let z = -1; z > -20; z -= 2) g.box(side * 3.4, 0.6, z, 0.09, 1.1, 0.09, 0xeee8dd);
    for (let z = 0; z > -20; z -= 5) g.beam(side * 3.2, -0.8, z, side * 3.2, -2.8, z - 5, 0.22, 0xa8452f);
    g.box(side * 3.2, -2.9, -10, 0.3, 0.3, 20, 0xa8452f);
  }
  if (tower) {
    for (const side of [-1, 1]) {
      g.box(side * 4.8, 10, -10, 1.3, 52, 1.3, 0xd2593f);
      for (let k = 1; k <= 4; k++) g.beam(side * 4.8, 33, -10, side * 3.5, 0.9, -10 + k * 4.5, 0.08, 0xf0e6dc), g.beam(side * 4.8, 33, -10, side * 3.5, 0.9, -10 - k * 4.5, 0.08, 0xf0e6dc);
    }
    g.box(0, 34.5, -10, 10.9, 1.4, 1.4, 0xd2593f);
    g.box(0, 22, -10, 10.9, 1, 1, 0xd2593f);
  }
  // islands far out in the haze
  if (r() < 0.35) {
    const x = (r() < 0.5 ? -1 : 1) * (60 + r() * 60);
    g.box(x, -12, -10, 30 + r() * 30, 10, 14, 0x6f8f88);
  }
  return g;
}

function roofPiece(r: () => number): Geo {
  const g = new Geo();
  g.box(0, -34, -10, 200, 0.2, 20, 0x2a2838);
  for (const side of [-1, 1]) {
    g.box(side * 3.55, 0.35, -10, 0.3, 0.7, 20, 0x9c94ab);
    g.box(side * 3.55, -15.5, -10, 0.3, 30, 20, 0x7d7590);
    for (let z = -2; z > -20; z -= 6 + r() * 4) {
      const x = side * (5 + r() * 3.5);
      const k = r();
      if (k < 0.4) g.box(x, 0.6, z, 1.4, 1.2, 1.8, 0xbcc3cf), g.box(x, 1.25, z, 1, 0.1, 1.2, 0x8f97a8);
      else if (k < 0.7) {
        for (const o of [-0.7, 0.7]) g.box(x + o, 1.4, z, 0.12, 2.8, 0.12, 0x5b4636);
        g.cyl(x, 3.6, z, 1.1, 2.2, 0x8a6a52, 10);
        g.cyl(x, 4.9, z, 1.15, 0.4, 0x6e5240, 10);
      } else g.box(x, 3, z, 0.1, 6, 0.1, 0xd7d9e0), g.box(x, 6, z, 0.18, 0.18, 0.18, 0xff6a5a, 255);
    }
    g.box(side * 6.5, -0.1, -10, 6, 0.2, 20, 0x8b849a);
    for (let z = 0; z > -20; z -= 8 + r() * 6) {
      const w = 7 + r() * 6, hgt = 20 + r() * 40, top = -6 + r() * 14;
      g.box(side * (14 + r() * 14), top - hgt / 2, z - w / 2, 8 + r() * 4, hgt, w, PALETTE[Math.floor(r() * PALETTE.length)]!);
    }
  }
  return g;
}

// ---------------------------------------------------------------- the things on the track

function barrierGeo(): Geo {
  const g = new Geo();
  for (const x of [-0.78, 0.78]) g.box(x, 0.48, 0, 0.12, 0.96, 0.3, 0xdedede);
  for (let i = 0; i < 6; i++) {
    const c = i % 2 ? 0xffffff : 0xe8453c;
    g.box(-0.72 + 0.24 * i + 0.12, 0.76, 0, 0.24, 0.38, 0.12, c);
    g.box(-0.72 + 0.24 * i + 0.12, 0.3, 0, 0.24, 0.2, 0.12, i % 2 ? 0xe8453c : 0xffffff);
  }
  return g;
}
function beamGeo(): Geo {
  const g = new Geo();
  for (const x of [-0.86, 0.86]) g.box(x, 1.05, 0, 0.14, 2.1, 0.14, 0x9aa0ad);
  for (let i = 0; i < 6; i++) g.box(-0.78 + 0.26 * i + 0.13, 1.56, 0, 0.26, 0.8, 0.18, i % 2 ? 0x23252d : 0xf2c230);
  g.box(0, 2.1, 0, 1.9, 0.12, 0.2, 0x9aa0ad);
  return g;
}
function pillarGeo(): Geo {
  const g = new Geo();
  g.box(0, 3, 0, 1.3, 6, 1.2, 0xc4bfcf);
  g.box(0, 1.7, 0, 1.36, 0.36, 1.26, 0xe8693f);
  g.box(0, 0.1, 0, 1.5, 0.2, 1.4, 0x8f8a9c);
  return g;
}
/** A long block along the lane (a parked tram, a stack of crates): one metre deep, stretched to its length. */
function longGeo(): Geo {
  const g = new Geo();
  g.box(0, 1.45, -0.5, 1.7, 2.6, 1, 0xffffff);
  g.box(0, 2.85, -0.5, 1.5, 0.2, 1, 0xdddddd);
  g.box(0, 0.08, -0.5, 1.75, 0.16, 1, 0x333333);
  for (const x of [-0.86, 0.86]) g.box(x, 1.9, -0.5, 0.02, 0.6, 1, 0x2c3550, 0, x < 0 ? 62 : 61);
  return g;
}
function hazardGeo(): Geo {
  const g = new Geo();
  for (let i = 0; i < 12; i++) g.box(-3.3 + i * 0.55 + 0.275, 0.02, 0, 0.55, 0.04, 0.5, i % 2 ? 0x222222 : 0xf2c230);
  return g;
}
const POWER_GEO: Record<Power, () => Geo> = {
  magnet: () => {
    const g = new Geo();
    for (const x of [-0.24, 0.24]) g.box(x, 0.06, 0, 0.17, 0.56, 0.17, 0xe8453c), g.box(x, 0.4, 0, 0.18, 0.14, 0.18, 0xf0f0f0, 120);
    return g.box(0, -0.24, 0, 0.65, 0.17, 0.17, 0xe8453c);
  },
  shield: () => new Geo().cyl(0, 0, 0, 0.4, 0.12, 0x5ad1ff, 6, 110, 'z').cyl(0, 0, 0, 0.24, 0.16, 0xffffff, 6, 200, 'z'),
  double: () => new Geo().ball(0, 0, 0, 0.4, 0xffd34d, 4, 150),
  boost: () => {
    const g = new Geo();
    [0.5, 0.4, 0.3].forEach((s, i) => g.box(0, -0.25 + i * 0.2, 0, s, 0.12, s, 0x58d36a, 90));
    return g.ball(0, 0.3, 0, 0.14, 0xffffff, 6, 220);
  },
};

// ---------------------------------------------------------------- the runner and the shadow

export interface Figure {
  root: Obj3;
  body: Obj3;
  armL: Obj3;
  armR: Obj3;
  legL: Obj3;
  legR: Obj3;
}

function figure(T: ThreeNS, mat: Mat, cols: { body: number; limb: number; leg: number; trim: number }, antenna: boolean, geos: Geom[]): Figure {
  const mesh = (g: Geo) => {
    const geom = g.build(T);
    geos.push(geom);
    return new T.Mesh(geom, mat);
  };
  const root = new T.Group();
  const body = new T.Group();
  body.position.set(0, 0.45, 0);
  root.add(body);
  const torso = mesh(new Geo().box(0, 0.64, 0, 0.52, 0.62, 0.34, cols.body).box(0, 0.78, 0.19, 0.3, 0.3, 0.06, cols.trim).box(0, 0.86, 0.3, 0.2, 0.07, 0.3, cols.trim).box(0, 0.8, 0.5, 0.16, 0.06, 0.22, cols.trim));
  const head = mesh(antenna
    ? new Geo().ball(0, 1.2, 0, 0.25, cols.body, 10).box(0, 1.22, -0.21, 0.32, 0.1, 0.06, 0x13202a).box(0, 1.5, 0, 0.04, 0.16, 0.04, cols.trim).ball(0, 1.6, 0, 0.065, 0xffffff, 6, 255)
    : new Geo().ball(0, 1.22, 0, 0.3, cols.body, 8));
  body.add(torso, head);
  const arm = () => {
    const a = new T.Group();
    a.add(mesh(new Geo().box(0, -0.25, 0, 0.14, 0.5, 0.14, cols.limb)));
    return a;
  };
  const leg = () => {
    const l = new T.Group();
    l.add(mesh(new Geo().box(0, -0.34, 0, 0.18, 0.66, 0.2, cols.leg).box(0, -0.7, -0.05, 0.2, 0.1, 0.32, cols.trim)));
    return l;
  };
  const armL = arm(), armR = arm(), legL = leg(), legR = leg();
  armL.position.set(-0.34, 0.9, 0);
  armR.position.set(0.34, 0.9, 0);
  legL.position.set(-0.13, 0.33, 0);
  legR.position.set(0.13, 0.33, 0);
  body.add(armL, armR, legL, legR);
  return { root, body, armL, armR, legL, legR };
}

/** Pose a figure: running (a phase), in the air, rolling (0…1 through the roll), leaning into a lane change. */
function pose(f: Figure, phase: number, air: boolean, roll: number, lean: number, wobble: number): void {
  const s = Math.sin(phase);
  if (roll > 0) {
    // tucked into a ball and tumbling forward round its own middle (0.62 m up the body), half a metre off the ground
    const th = -roll * Math.PI * 2, sy = 0.62, c = 0.62;
    f.body.rotation.set(th, 0, 0);
    f.body.scale.set(1, sy, 1);
    f.body.position.set(0, 0.5 - c * sy * Math.cos(th), -c * sy * Math.sin(th));
    f.legL.rotation.x = f.legR.rotation.x = -1.4;
    f.armL.rotation.x = f.armR.rotation.x = -1.2;
    return;
  } else {
    f.body.scale.set(1, 1, 1);
    f.body.rotation.set(-0.14, 0, lean + Math.sin(wobble * 30) * wobble * 0.5);
    if (air) {
      f.legL.rotation.x = -1.0;
      f.legR.rotation.x = 0.5;
      f.armL.rotation.x = -2.2;
      f.armR.rotation.x = -2.0;
    } else {
      f.legL.rotation.x = s * 0.95;
      f.legR.rotation.x = -s * 0.95;
      f.armL.rotation.x = -s * 0.85;
      f.armR.rotation.x = s * 0.85;
    }
  }
  f.body.position.set(0, 0.45 + (air ? 0 : Math.abs(s) * 0.06), 0);
}

// ---------------------------------------------------------------- the scene

export interface RunnerScene {
  scene: Obj3;
  camera: Cam;
  /** Draw the run as it is now (t: seconds on the clock; pace 0…1). */
  update(run: Run, dt: number, t: number, o: { title: boolean; marks: { d: number; ghosty: boolean }[]; shake: number }): void;
  setAspect(aspect: number): void;
  dispose(): void;
  /** Ghosty's colour as used (for the HUD). */
  accent: number;
}

export function makeRunnerScene(T: ThreeNS, seed: number, accent: number): RunnerScene {
  const geos: Geom[] = [];
  const mats: Mat[] = [];
  const keep = <G extends Geom>(g: G) => (geos.push(g), g);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(70, 0.5, 0.1, 500);
  const sky = makeSky(T);
  scene.add(sky);
  const solid = flatMaterial(T);
  const ghostly = flatMaterial(T, { alpha: 0.55 });
  const glowMat = flatMaterial(T, { alpha: 0.32, additive: true });
  const blobMat = flatMaterial(T, { alpha: 0.28 });
  mats.push(solid, ghostly, glowMat, blobMat);

  // scenery: a few variants of each section's piece, built now
  let s = seed >>> 0 || 1;
  const r = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const variants: Record<Section | 'portal' | 'tower', Geom[]> = {
    city: [0, 1, 2, 3, 4, 5].map(() => keep(cityPiece(r).build(T))),
    tunnel: [0, 1, 2].map(() => keep(tunnelPiece(r, false).build(T))),
    portal: [keep(tunnelPiece(r, true).build(T))],
    bridge: [0, 1, 2].map(() => keep(bridgePiece(r, false).build(T))),
    tower: [keep(bridgePiece(r, true).build(T))],
    roof: [0, 1, 2, 3].map(() => keep(roofPiece(r).build(T))),
  };
  const pieces: Mesh[] = [];
  for (let i = 0; i < Math.ceil((AHEAD + BEHIND) / PIECE) + 2; i++) {
    const m = new T.Mesh(variants.city[0]!, solid);
    m.frustumCulled = false;
    scene.add(m);
    pieces.push(m);
  }

  // the track: tiles and their lane marks, one instanced mesh each
  const nTiles = Math.ceil((AHEAD + BEHIND) / TILE) + 2;
  const tileGeo = keep(new Geo().box(0, -0.25, -TILE / 2, 6.6, 0.5, TILE, 0xdddddd).box(-3.2, 0.06, -TILE / 2, 0.22, 0.12, TILE, 0xffffff).box(3.2, 0.06, -TILE / 2, 0.22, 0.12, TILE, 0xffffff).build(T));
  const tiles = new T.InstancedMesh(tileGeo, solid, nTiles) as IMesh;
  const dashGeo = keep(new Geo().box(-LANE_W / 2, 0.012, -0.6, 0.1, 0.02, 1.0, 0xffffff).box(LANE_W / 2, 0.012, -0.6, 0.1, 0.02, 1.0, 0xffffff).build(T));
  const dashes = new T.InstancedMesh(dashGeo, solid, nTiles) as IMesh;
  const inst = (g: Geo, n: number, m: Mat = solid): IMesh => {
    const im = new T.InstancedMesh(keep(g.build(T)), m, n) as IMesh;
    im.frustumCulled = false;
    im.setColorAt(0, new T.Color(0xffffff));
    im.count = 0;
    scene.add(im);
    return im;
  };
  for (const im of [tiles, dashes]) (im.frustumCulled = false), im.setColorAt(0, new T.Color(0xffffff)), scene.add(im);
  const obMesh = { barrier: inst(barrierGeo(), 24), beam: inst(beamGeo(), 24), pillar: inst(pillarGeo(), 24), long: inst(longGeo(), 16), hazard: inst(hazardGeo(), 6) };
  const coins = inst(new Geo().cyl(0, 0, 0, 0.34, 0.09, 0xffcf3a, 14, 110, 'z').cyl(0, 0, 0, 0.2, 0.1, 0xffe58a, 14, 160, 'z'), 140);
  const ups = Object.fromEntries(POWERS.map((p) => [p, inst(POWER_GEO[p](), 4)])) as Record<Power, IMesh>;
  const halos = inst(new Geo().ball(0, 0, 0, 0.62, 0xffffff, 10, 255), 4, glowMat);
  const gate = (col: number) => {
    const g = new Geo();
    for (const x of [-3.5, 3.5]) g.box(x, 2.3, 0, 0.26, 4.6, 0.26, col, 120);
    g.box(0, 4.75, 0, 7.3, 0.7, 0.14, col, 210);
    const m = new T.Mesh(keep(g.build(T)), solid);
    m.visible = false;
    scene.add(m);
    return m;
  };
  const gateGhosty = gate(accent), gateYou = gate(0xffcf3a);

  // the runner, his blob of shadow, his shield, and the shadow that chases him
  const lighter = mix3(hex3(accent), [1, 1, 1], 0.35).map((v) => Math.round(v * 255)) as [number, number, number];
  const runner = figure(T, solid, { body: accent, limb: (lighter[0] << 16) | (lighter[1] << 8) | lighter[2], leg: 0x2b3550, trim: 0xffffff }, true, geos);
  scene.add(runner.root);
  const blob = new T.Mesh(keep(new Geo().cyl(0, 0.015, 0, 0.5, 0.01, 0x000000, 16).build(T)), blobMat);
  scene.add(blob);
  const bubble = new T.Mesh(keep(new Geo().ball(0, 0, 0, 1.15, 0x7fdcff, 12, 200).build(T)), glowMat);
  bubble.visible = false;
  scene.add(bubble);
  const chaser = figure(T, ghostly, { body: 0x0c0e18, limb: 0x10121e, leg: 0x0a0b14, trim: 0x1a1d2c }, false, geos);
  chaser.root.scale.set(1.08, 1.08, 1.08);
  scene.add(chaser.root);

  const dummy = new T.Object3D();
  const col = new T.Color();
  const light: Light = { sun: [0.52, 0.42, -0.74], tint: [1, 1, 1], fog: [0.9, 0.65, 0.55], fogNear: 40, fogFar: 150, fill: [-0.33, 0.42, 0.84] };
  let look: Look = { ...LOOKS.city };
  let phase = 0, shadowGap = 16, shadowX = 0, camX = 0, camY = 3.4, wob = 0, lastStumbles = 0, aspect = 0.5;
  const sunDir: [number, number, number] = [0.42, 0.2, -0.88];

  const put = (im: IMesh, i: number, x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  };
  const tint = (im: IMesh, i: number, hex: number) => {
    const c = hex3(hex);
    im.setColorAt(i, col.setRGB(c[0], c[1], c[2]));
  };
  const LONG_COLS = [0xd9534f, 0x4f8fd9, 0x5fb36a, 0xe6b33a, 0x9b6bd1, 0x3fb7b0];
  const PILLAR_COLS = [0xffffff, 0xf3d6c6, 0xd6e2f3];

  const update: RunnerScene['update'] = (run, dt, t, o) => {
    const z = (d: number) => run.d - d; // a distance along the run → z on screen (ahead is negative)
    // the light follows the section the camera is in
    const want = LOOKS[sectionAt(run, run.d - 4)];
    const k = Math.min(1, dt * 2.5);
    look = { top: mix3(look.top, want.top, k), horizon: mix3(look.horizon, want.horizon, k), fog: mix3(look.fog, want.fog, k), tint: mix3(look.tint, want.tint, k), near: look.near + (want.near - look.near) * k, far: look.far + (want.far - look.far) * k };
    light.tint = look.tint;
    light.fog = look.fog;
    light.fogNear = look.near;
    light.fogFar = look.far;
    for (const m of mats) setLight(m, light);
    setSky(sky, { top: look.top, horizon: look.horizon, bottom: mix3(look.horizon, [0.3, 0.25, 0.4], 0.5), sunCol: [1, 0.72, 0.46], sunDir, moonDir: [0, -1, 0], stars: 0 });

    // scenery pieces
    const p0 = Math.floor((run.d - BEHIND) / PIECE);
    pieces.forEach((m, i) => {
      const p = p0 + i;
      const start = p * PIECE;
      const sec = sectionAt(run, start + 1);
      const h = Math.abs(Math.sin(p * 91.7 + seed * 0.013) * 1e4) % 1;
      let geo: Geom;
      if (sec === 'tunnel' && sectionAt(run, start - PIECE + 1) !== 'tunnel') geo = variants.portal[0]!;
      else if (sec === 'bridge' && p % 3 === 0) geo = variants.tower[0]!;
      else {
        const list = variants[sec];
        geo = list[Math.floor(h * list.length)]!;
      }
      m.geometry = geo;
      m.position.set(0, 0, z(start));
    });

    // the track: a tile every 2 m, none over a gap
    const gaps = run.obs.filter((g) => g.kind === 'gap' && g.lane === 0);
    let n = 0;
    const t0 = Math.floor((run.d - BEHIND) / TILE);
    for (let i = 0; i < nTiles; i++) {
      const d = (t0 + i) * TILE;
      if (gaps.some((g) => d + TILE > g.d + 0.05 && d < g.d + g.len - 0.05)) continue;
      const sec = sectionAt(run, d + 1);
      put(tiles, n, 0, 0, z(d));
      tint(tiles, n, TILE_COL[sec][(t0 + i) & 1]!);
      put(dashes, n, 0, 0, z(d));
      tint(dashes, n, DASH_COL[sec]);
      n++;
    }
    tiles.count = dashes.count = n;

    // obstacles
    const counts = { barrier: 0, beam: 0, pillar: 0, long: 0, hazard: 0 };
    for (const ob of run.obs) {
      if (ob.d > run.d + AHEAD) break;
      if (ob.d + ob.len < run.d - BEHIND) continue;
      const x = ob.lane * LANE_W;
      const zz = z(ob.d + ob.len / 2);
      if (ob.kind === 'gap') {
        if (ob.lane === 0 && counts.hazard < 6) put(obMesh.hazard, counts.hazard++, 0, 0, z(ob.d) + 0.3);
      } else if (ob.kind === 'pillar' && ob.len > 2) {
        if (counts.long < 16) {
          put(obMesh.long, counts.long, x, 0, z(ob.d), 0, 1, 1, ob.len);
          tint(obMesh.long, counts.long++, LONG_COLS[ob.style % LONG_COLS.length]!);
        }
      } else {
        const im = obMesh[ob.kind as 'barrier' | 'beam' | 'pillar'];
        const c = counts[ob.kind as 'barrier' | 'beam' | 'pillar'];
        if (c >= 24) continue;
        // a hit one is knocked aside
        put(im, c, x + (ob.hit ? 0.12 : 0), 0, zz, ob.hit ? 0.16 : 0);
        tint(im, c, ob.kind === 'pillar' ? PILLAR_COLS[ob.style % 3]! : 0xffffff);
        counts[ob.kind as 'barrier' | 'beam' | 'pillar']++;
      }
    }
    for (const key of Object.keys(counts) as (keyof typeof counts)[]) obMesh[key].count = counts[key];

    // coins: spinning; a taken one flies up into him and is gone
    let c = 0;
    for (const cn of run.coinList as Coin[]) {
      if (cn.d > run.d + AHEAD) break;
      if (c >= 140) break;
      let x = cn.lane * LANE_W, y = cn.y, zz = z(cn.d), sc = 1;
      if (cn.taken) {
        const a = (run.t - cn.at) / 0.22;
        if (a >= 1 || a < 0) continue;
        x += (run.x - x) * a;
        y += (run.y + 1.2 - y) * a + a * 0.6;
        zz *= 1 - a;
        sc = 1 - a * 0.7;
      } else if (cn.d < run.d - 2) continue;
      put(coins, c, x, y, zz, t * 3.2 + cn.d * 0.4, sc, sc, sc);
      c++;
    }
    coins.count = c;

    // power-ups, bobbing in their halos
    const upCount: Record<Power, number> = { magnet: 0, shield: 0, double: 0, boost: 0 };
    let hc = 0;
    for (const u of run.ups as Up[]) {
      if (u.taken || u.d < run.d - 2 || u.d > run.d + AHEAD || upCount[u.kind] >= 4) continue;
      const y = 1.25 + Math.sin(t * 3 + u.d) * 0.15;
      put(ups[u.kind], upCount[u.kind]++, u.lane * LANE_W, y, z(u.d), t * 2);
      if (hc < 4) {
        put(halos, hc, u.lane * LANE_W, y, z(u.d));
        tint(halos, hc++, u.kind === 'magnet' ? 0xff7a6a : u.kind === 'shield' ? 0x6adcff : u.kind === 'double' ? 0xffd34d : 0x6ae07a);
      }
    }
    for (const p of POWERS) ups[p].count = upCount[p];
    halos.count = hc;

    // markers: Ghosty's best, his own
    gateGhosty.visible = gateYou.visible = false;
    for (const m of o.marks) {
      if (m.d < run.d - BEHIND || m.d > run.d + AHEAD) continue;
      const g = m.ghosty ? gateGhosty : gateYou;
      g.visible = true;
      g.position.set(0, 0, z(m.d));
    }

    // the runner
    if (run.stumbles !== lastStumbles) (wob = 0.5), (lastStumbles = run.stumbles);
    wob = Math.max(0, wob - dt);
    phase += (o.title ? 0 : run.speed) * dt * 0.95;
    const rolling = run.rollT > 0 ? 1 - run.rollT / ROLL_SECONDS : 0;
    runner.root.position.set(run.x, Math.max(run.y, -2), 0);
    pose(runner, o.title ? t * 2 : phase, run.air && run.y > 0.05, rolling, (run.x - run.lane * LANE_W) * 0.12, wob);
    if (o.title) (runner.legL.rotation.x = runner.legR.rotation.x = 0), (runner.armL.rotation.x = runner.armR.rotation.x = Math.sin(t * 2) * 0.08), (runner.body.position.y = 0.45 + Math.sin(t * 2) * 0.015);
    blob.position.set(run.x, 0, 0);
    blob.scale.set(1 - Math.min(0.6, run.y * 0.2), 1, 1 - Math.min(0.6, run.y * 0.2));
    blob.visible = !run.obs.some((g) => g.kind === 'gap' && run.d > g.d && run.d < g.d + g.len);
    bubble.visible = run.powers.shield > 0 && (run.powers.shield > 2 || Math.sin(t * 20) > 0);
    bubble.position.set(run.x, run.y + 0.95, 0);

    // the shadow: close behind after a stumble (a step to one side, so it never hides him), far back when he is clear;
    // when it catches him it leaps on
    const wantGap = run.over ? 0.2 : run.chase > 0 ? 2.7 : 18;
    shadowGap += (wantGap - shadowGap) * Math.min(1, dt * (run.over ? 6 : 2));
    const side = run.x > 0.5 ? -1 : 1;
    const wantX = run.over ? run.x : run.x + side * 1.05;
    shadowX += (wantX - shadowX) * Math.min(1, dt * 5);
    chaser.root.position.set(shadowX, run.over ? 0.3 : 0, shadowGap);
    chaser.root.visible = shadowGap < 14;
    pose(chaser, phase * 0.98 + 0.4, false, 0, 0, 0);
    if (run.over) chaser.body.rotation.x = -0.9;

    // the camera, behind and above, easing after him; a shake on a stumble
    camX += (run.x * 0.55 - camX) * Math.min(1, dt * 7);
    camY += (3.3 + Math.max(0, run.y) * 0.4 - camY) * Math.min(1, dt * 5);
    const sh = o.shake;
    camera.position.set(camX + (Math.random() - 0.5) * sh, camY + (Math.random() - 0.5) * sh, 6.1);
    camera.lookAt(run.x * 0.4, 0.85 + Math.max(0, run.y) * 0.25, -10);
    // keep the lanes in view whatever the screen's shape; a touch wider at speed
    const half = Math.atan(2.55 / 7.2);
    const fov = clamp((2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI, 56, 84) + clamp((run.speed - 10.5) / 11.5, 0, 1) * 5;
    if (Math.abs(fov - camera.fov) > 0.05) (camera.fov = fov), camera.updateProjectionMatrix();
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);

    for (const im of [tiles, dashes, coins, halos, ...Object.values(obMesh), ...Object.values(ups)]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  };

  return {
    scene,
    camera,
    accent,
    update,
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

