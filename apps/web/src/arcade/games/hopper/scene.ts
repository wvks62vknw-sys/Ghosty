/**
 * THE HOPPER on screen, in a blocky look of our own: every row a slab (grass in two greens, roads with their dashes,
 * water that glints with the current, railways on gravel), trees and rocks, cars and lorries in bright paints, logs and
 * lily pads, trains with a signal that flashes before they come, coins that spin, the fog rolling in behind as layers of
 * mist, Ghosty's best as a glowing line across the road, and the hopper himself — a frog, a hen, a robot or Ghosty's own
 * figure — with a squash on landing and a stretch in the air. Everything that repeats is an instanced mesh (one draw
 * call a kind); the camera looks down from behind and to the side and follows him up the board.
 */
import { Bits, type Cam, clamp, flatMaterial, Geo, type Geom, hex3, type IMesh, type Light, makeSky, type Mat, type Obj3, project, setLight, setSky, type ThreeNS } from '../kit';
import { COLS, type Face, hopperAt, moverX, type Row, rowAt, type Run, trainAt } from './sim';

export type HopperKind = 'frog' | 'hen' | 'robot' | 'ghost';
export const HOPPERS: { kind: HopperKind; name: string; cost: number }[] = [
  { kind: 'frog', name: 'Frog', cost: 0 },
  { kind: 'hen', name: 'Hen', cost: 40 },
  { kind: 'robot', name: 'Robot', cost: 100 },
  { kind: 'ghost', name: 'Ghosty', cost: 200 },
];
const PAINT = [0xe8483d, 0xf5c542, 0x3f8fe8, 0xf4f4f0, 0x5cc06a, 0xa26be0, 0xff8a3d, 0x39c6c0];
const FACE_A: Record<Face, number> = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

// ---------------------------------------------------------------- the hoppers, facing −z, feet at the origin

function hopperGeo(kind: HopperKind, accent: number): Geo {
  const g = new Geo();
  if (kind === 'frog') {
    g.box(0, 0.24, 0, 0.62, 0.36, 0.66, 0x5cc85c);
    g.box(0, 0.1, -0.02, 0.5, 0.1, 0.6, 0xc8eb8a);
    for (const s of [-1, 1]) {
      g.box(s * 0.17, 0.5, -0.17, 0.2, 0.18, 0.2, 0xffffff);
      g.box(s * 0.17, 0.52, -0.28, 0.09, 0.09, 0.02, 0x14171f);
      g.box(s * 0.36, 0.12, 0.16, 0.16, 0.16, 0.36, 0x4fb24f);
      g.box(s * 0.3, 0.06, -0.26, 0.12, 0.12, 0.14, 0x4fb24f);
    }
    g.box(0, 0.24, -0.34, 0.36, 0.04, 0.02, 0x2d6b2d);
  } else if (kind === 'hen') {
    g.box(0, 0.32, 0.04, 0.56, 0.48, 0.6, 0xf3e6c8);
    for (const s of [-1, 1]) g.box(s * 0.3, 0.34, 0.08, 0.06, 0.3, 0.38, 0xb07a4a);
    g.box(0, 0.36, 0.38, 0.32, 0.3, 0.12, 0xb07a4a);
    g.box(0, 0.68, -0.16, 0.36, 0.34, 0.34, 0xfaf3e2);
    g.box(0, 0.9, -0.16, 0.12, 0.14, 0.24, 0xe23b3b);
    g.box(0, 0.66, -0.38, 0.14, 0.1, 0.14, 0xf2a23a);
    g.box(0, 0.56, -0.36, 0.08, 0.1, 0.06, 0xe23b3b);
    g.box(0, 0.52, -0.12, 0.42, 0.1, 0.4, 0x2fb6a8);
    for (const s of [-1, 1]) {
      g.box(s * 0.12, 0.74, -0.34, 0.06, 0.08, 0.02, 0x14171f);
      g.box(s * 0.12, 0.05, 0, 0.06, 0.12, 0.06, 0xf2a23a);
    }
  } else if (kind === 'robot') {
    g.box(0, 0.38, 0, 0.56, 0.52, 0.5, 0x9aa4b4);
    g.box(0, 0.4, -0.26, 0.22, 0.14, 0.02, 0x7dffb0, 220);
    g.box(0, 0.84, 0, 0.44, 0.38, 0.42, 0x6f7a8c);
    g.box(0, 0.86, -0.22, 0.34, 0.1, 0.02, 0x6ae4ff, 240);
    g.beam(0, 1.03, 0, 0.06, 1.3, 0.04, 0.04, 0xc3cad6);
    g.box(0.06, 1.32, 0.04, 0.1, 0.1, 0.1, 0xff5a5a, 255);
    for (const s of [-1, 1]) {
      g.box(s * 0.36, 0.4, 0, 0.1, 0.36, 0.16, 0x7a8496);
      g.box(s * 0.16, 0.07, 0, 0.18, 0.14, 0.36, 0x3a404c);
    }
  } else {
    // Ghosty's own figure: round and white, two dark eyes, a little wave at the hem, his colour about him
    g.ball(0, 0.5, 0, 0.36, 0xf6f9ff, 12, 70, 1.1);
    for (const [x, z] of [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18], [0, 0.26], [0, -0.26]] as const) g.box(x, 0.12, z, 0.16, 0.18, 0.16, 0xf0f4fc, 50);
    for (const s of [-1, 1]) g.box(s * 0.12, 0.58, -0.33, 0.09, 0.15, 0.03, 0x10131c);
    g.box(0, 0.38, -0.34, 0.12, 0.05, 0.02, accent, 200);
  }
  return g;
}

function carGeo(): Geo {
  const g = new Geo();
  g.box(0, 0.32, 0, 1.36, 0.36, 0.78, 0xffffff);
  g.box(-0.08, 0.66, 0, 0.74, 0.34, 0.68, 0xffffff);
  g.box(-0.08, 0.68, 0, 0.78, 0.22, 0.7, 0x2a3550);
  g.box(0.69, 0.32, 0.25, 0.03, 0.1, 0.14, 0xfff2b0, 255);
  g.box(0.69, 0.32, -0.25, 0.03, 0.1, 0.14, 0xfff2b0, 255);
  g.box(-0.69, 0.34, 0.25, 0.03, 0.08, 0.14, 0xff4a4a, 230);
  g.box(-0.69, 0.34, -0.25, 0.03, 0.08, 0.14, 0xff4a4a, 230);
  for (const x of [-0.42, 0.42]) for (const z of [-0.38, 0.38]) g.box(x, 0.13, z, 0.3, 0.26, 0.1, 0x1c1f26);
  return g;
}
function lorryGeo(): Geo {
  const g = new Geo();
  g.box(0.9, 0.5, 0, 0.8, 0.74, 0.82, 0xffffff);
  g.box(1.12, 0.66, 0, 0.36, 0.3, 0.84, 0x2a3550);
  g.box(-0.42, 0.62, 0, 1.86, 0.98, 0.86, 0xf2f2ee);
  g.box(-0.42, 0.62, 0.435, 1.7, 0.18, 0.01, 0xffffff);
  g.box(1.31, 0.36, 0.26, 0.03, 0.12, 0.16, 0xfff2b0, 255);
  g.box(1.31, 0.36, -0.26, 0.03, 0.12, 0.16, 0xfff2b0, 255);
  for (const x of [-1, -0.6, 0.85]) for (const z of [-0.4, 0.4]) g.box(x, 0.15, z, 0.34, 0.3, 0.1, 0x1c1f26);
  return g;
}
function trainGeo(engine: boolean): Geo {
  const g = new Geo();
  if (engine) {
    g.box(0, 0.75, 0, 2.9, 1.2, 0.9, 0xd8463c);
    g.box(-0.6, 1.5, 0, 1.4, 0.4, 0.86, 0x2a3550);
    g.box(1.46, 0.9, 0, 0.04, 0.24, 0.5, 0xfff2b0, 255);
    g.box(0, 1.38, 0, 2.94, 0.06, 0.94, 0xf5c542);
  } else {
    g.box(0, 0.78, 0, 2.3, 1.18, 0.88, 0x3f6fb8);
    for (const x of [-0.7, 0, 0.7]) g.box(x, 0.98, 0.45, 0.42, 0.34, 0.01, 0xfff0c8, 120), g.box(x, 0.98, -0.45, 0.42, 0.34, 0.01, 0xfff0c8, 120);
  }
  for (const x of [-0.9, 0.9]) for (const z of [-0.36, 0.36]) g.box(x, 0.16, z, 0.36, 0.3, 0.1, 0x1c1f26);
  return g;
}

// ---------------------------------------------------------------- the scene

export interface HopperScene {
  scene: Obj3;
  camera: Cam;
  update(run: Run, dt: number, o: { title: boolean; ghostyBest: number | null; shake: number }): void;
  setHopper(kind: HopperKind): void;
  burst(kind: 'coin' | 'splash' | 'squash' | 'fog', x: number, r: number): void;
  /** Start the camera afresh at the start (a new run). */
  reset(): void;
  /** Where the fog's front is on the screen (CSS px from the top), for the mist drawn over the page. */
  fogY(fog: number, w: number, h: number): number;
  setAspect(a: number): void;
  dispose(): void;
}

export function makeHopperScene(T: ThreeNS, accent: number): HopperScene {
  const geos: Geom[] = [];
  const mats: Mat[] = [];
  const keep = (g: Geom) => (geos.push(g), g);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 0.5, 2, 240);
  const eye = [0, 0, 0], look = [0, 0, 0];
  const sky = makeSky(T);
  sky.scale.set(90, 90, 90);
  scene.add(sky);
  const solid = flatMaterial(T), mist = flatMaterial(T, { alpha: 0.42 }), glowMat = flatMaterial(T, { alpha: 0.4, additive: true }), blobMat = flatMaterial(T, { alpha: 0.26 });
  mats.push(solid, mist, glowMat, blobMat);
  const inst = (g: Geo, n: number, m: Mat = solid): IMesh => {
    const im = new T.InstancedMesh(keep(g.build(T)), m, n) as IMesh;
    im.frustumCulled = false;
    im.setColorAt(0, new T.Color(0xffffff));
    im.count = 0;
    scene.add(im);
    return im;
  };
  const W = 26;
  const grass = inst(new Geo().box(0, -0.2, 0, W, 0.4, 1, 0xffffff), 40);
  const road = inst(new Geo().box(0, -0.24, 0, W, 0.32, 1, 0x4a4f5e).box(0, -0.075, 0.47, W, 0.015, 0.05, 0x5a5f6e), 40);
  const dashGeo = new Geo();
  for (let x = -12; x <= 12; x += 1.6) dashGeo.box(x, -0.07, -0.5, 0.8, 0.02, 0.07, 0xf2f2e6);
  const dashes = inst(dashGeo, 40);
  const water = inst(new Geo().box(0, -0.45, 0, W, 0.3, 1, 0x3fa6e0).box(0, -0.29, 0.47, W, 0.02, 0.06, 0x7fcbf0, 60), 40);
  const railGeo = new Geo().box(0, -0.22, 0, W, 0.36, 1, 0x8a7f74);
  for (let x = -12.6; x <= 12.6; x += 0.7) railGeo.box(x, -0.02, 0, 0.26, 0.06, 0.8, 0x6b4a32);
  for (const z of [-0.24, 0.24]) railGeo.box(0, 0.05, z, W, 0.08, 0.07, 0xc3c8d1);
  const rails = inst(railGeo, 20);
  const glints = inst(new Geo().box(0, -0.28, 0, 0.9, 0.02, 0.08, 0xd8f3ff, 160), 120);
  const treeGeo = new Geo().box(0, 0.25, 0, 0.28, 0.5, 0.28, 0x7a5236).box(0, 0.86, 0, 0.82, 0.72, 0.82, 0x3f9e4c).box(0, 1.36, 0, 0.56, 0.4, 0.56, 0x4fb85a);
  const trees = inst(treeGeo, 320);
  const rocks = inst(new Geo().box(0, 0.2, 0, 0.72, 0.42, 0.62, 0x9aa0aa).box(0.06, 0.44, 0.04, 0.46, 0.12, 0.4, 0xb4bac4), 120);
  const decor = inst(new Geo().box(0, 0.06, 0, 0.14, 0.12, 0.14, 0xffffff), 200);
  const cars = inst(carGeo(), 120);
  const lorries = inst(lorryGeo(), 60);
  const logs = inst(new Geo().box(0, -0.16, 0, 1, 0.34, 0.74, 0x8a5a3a).box(0, 0.02, 0, 1, 0.04, 0.5, 0x9c6a46), 120);
  const pads = inst(new Geo().cyl(0, -0.26, 0, 0.4, 0.06, 0x4caf50, 10).box(0.12, -0.21, -0.1, 0.12, 0.08, 0.12, 0xff9ad0, 80), 60);
  const engines = inst(trainGeo(true), 6);
  const wagons = inst(trainGeo(false), 40);
  const posts = inst(new Geo().box(0, 0.6, 0, 0.12, 1.2, 0.12, 0x3a404c).box(0, 1.25, 0, 0.5, 0.28, 0.16, 0x2a2f3a), 20);
  const lamps = inst(new Geo().box(0, 0, 0, 0.18, 0.18, 0.04, 0xff3b3b, 255), 40);
  const halos = inst(new Geo().ball(0, 0, 0, 0.5, 0xff4a4a, 8, 255), 40, glowMat);
  const coins = inst(new Geo().cyl(0, 0, 0, 0.26, 0.07, 0xffcf3a, 12, 120, 'z').cyl(0, 0, 0, 0.15, 0.08, 0xffe58a, 12, 170, 'z'), 30);
  const puffs = new Bits(T, 90, keep(new Geo().ball(0, 0, 0, 0.5, 0xffffff, 6, 160).build(T)), mist);
  scene.add(puffs.mesh);
  const lineGeo = new Geo().box(0, 0.02, 0, W, 0.04, 0.16, accent, 255);
  for (let x = -12; x <= 12; x += 2) lineGeo.box(x, 0.03, 0, 0.6, 0.05, 0.22, 0xffffff, 255);
  lineGeo.box(COLS + 1.4, 0.8, 0, 0.08, 1.6, 0.08, 0xd8dce4).box(COLS + 1.7, 1.42, 0, 0.6, 0.36, 0.04, accent, 200);
  const ghostLine = new T.Mesh(keep(lineGeo.build(T)), solid);
  ghostLine.visible = false;
  scene.add(ghostLine);
  const blob = new T.Mesh(keep(new Geo().cyl(0, 0.02, 0, 0.36, 0.01, 0x000000, 12).build(T)), blobMat);
  scene.add(blob);
  const crumbs = new Bits(T, 160, keep(new Geo().box(0, 0, 0, 0.14, 0.14, 0.14, 0xffffff).build(T)), solid);
  const sparks = new Bits(T, 80, keep(new Geo().box(0, 0, 0, 0.12, 0.12, 0.12, 0xffffff, 255).build(T)), glowMat);
  scene.add(crumbs.mesh, sparks.mesh);
  const hopGeos = new Map<HopperKind, Geom>();
  const hopper = new T.Mesh(keep(hopperGeo('frog', accent).build(T)), solid);
  hopGeos.set('frog', hopper.geometry);
  const halo = new T.Mesh(keep(new Geo().ball(0, 0.5, 0, 0.7, accent, 10, 255).build(T)), glowMat);
  halo.visible = false;
  scene.add(hopper, halo);
  let kindNow: HopperKind = 'frog';

  const dummy = new T.Object3D();
  const col = new T.Color();
  const light: Light = { sun: [-0.45, 0.8, 0.4], tint: [1.05, 1.02, 0.98], fog: hex3(0xdfe8f2), fogNear: 40, fogFar: 72, fill: [0.4, 0.4, 0.8] };
  for (const m of mats) setLight(m, light);
  setSky(sky, { top: hex3(0x8fc6f0), horizon: hex3(0xdfe8f2), bottom: hex3(0xdfe8f2), sunCol: [0, 0, 0], sunDir: [0, -1, 0], moonDir: [0, -1, 0], stars: 0 });
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
  let aspect = 0.5, camRow = 0, camX = 0, clock = 0, face = 0, squash = 0, lastHop = 0;

  const update: HopperScene['update'] = (run, dt, o) => {
    clock += dt;
    const t = run.t;
    const p = run.p;
    const at = hopperAt(run);
    // the camera: behind, above and to one side, easing after him up the board
    const wantRow = o.title ? 1.5 + Math.sin(clock * 0.3) * 0.6 : at.z;
    camRow += (wantRow - camRow) * Math.min(1, dt * 3.2);
    camX += (clamp(at.x, -2.2, 2.2) * 0.65 - camX) * Math.min(1, dt * 3);
    const portrait = aspect < 1;
    const sh = o.shake;
    // far off and narrow, so the board keeps its blocks square (as near as a perspective gets to a plan)
    eye[0] = camX + 5 + (Math.random() - 0.5) * sh;
    eye[1] = (portrait ? 24 : 19) + (Math.random() - 0.5) * sh;
    eye[2] = -camRow + (portrait ? 15 : 12.5);
    look[0] = camX + 0.4;
    look[2] = -camRow - (portrait ? 3 : 2);
    camera.position.set(eye[0]!, eye[1]!, eye[2]!);
    camera.lookAt(look[0]!, 0, look[2]!);
    const fov = portrait ? clamp(2 * Math.atan(Math.tan((22 * Math.PI) / 360) / aspect) * (180 / Math.PI), 30, 46) : 30;
    if (Math.abs(fov - camera.fov) > 0.05) (camera.fov = fov), camera.updateProjectionMatrix();
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);

    // the rows in view
    const r0 = Math.floor(camRow) - 7, r1 = Math.floor(camRow) + 19;
    const n = { grass: 0, road: 0, dashes: 0, water: 0, rails: 0, glints: 0, trees: 0, rocks: 0, decor: 0, cars: 0, lorries: 0, logs: 0, pads: 0, engines: 0, wagons: 0, posts: 0, lamps: 0, coins: 0 };
    for (let r = r0; r <= r1; r++) {
      const row: Row = rowAt(run, r);
      const z = -r;
      if (row.kind === 'grass') {
        put(grass, n.grass, 0, 0, z);
        tint(grass, n.grass++, r & 1 ? 0x8fd16a : 0x84c862);
        for (const c of row.block) {
          if (Math.abs(c) > 8) continue;
          const h = ((c * 73856093) ^ (r * 19349663)) >>> 0;
          if (h % 5 === 0 && n.rocks < 120) put(rocks, n.rocks++, c, 0, z, (h % 7) * 0.4);
          else if (n.trees < 320) {
            const tall = 0.85 + ((h >> 3) % 5) * 0.1;
            put(trees, n.trees, c, 0, z, 0, 1, tall, 1);
            tint(trees, n.trees++, h % 3 ? 0xffffff : 0xe4f0c8);
          }
        }
        for (let k = 0; k < 3; k++) {
          const h = ((row.deco + k * 7919) * 2654435761) >>> 0;
          const c = (h % 17) - 8;
          if (row.block.includes(c) || n.decor >= 200) continue;
          put(decor, n.decor, c + ((h >> 8) % 7) * 0.1 - 0.3, 0, z + ((h >> 12) % 7) * 0.1 - 0.3, h % 3);
          tint(decor, n.decor++, [0xffffff, 0xffe066, 0xff8ab0, 0xb48cff, 0x6fbf5a][h % 5]!);
        }
      } else if (row.kind === 'road') {
        put(road, n.road++, 0, 0, z);
        const ahead = rowAt(run, r + 1);
        if (ahead.kind === 'road') put(dashes, n.dashes++, 0, 0, z);
        for (const m of row.movers) {
          const x = moverX(row, m, t);
          if (Math.abs(x) > 9.5) continue;
          const im = m.kind === 'lorry' ? lorries : cars;
          const k = m.kind === 'lorry' ? n.lorries : n.cars;
          if (k >= (m.kind === 'lorry' ? 60 : 120)) continue;
          put(im, k, x, Math.abs(Math.sin(t * 9 + m.x0)) * 0.02, z, row.dir > 0 ? 0 : Math.PI);
          tint(im, k, PAINT[m.c % PAINT.length]!);
          if (m.kind === 'lorry') n.lorries++;
          else n.cars++;
        }
      } else if (row.kind === 'river') {
        put(water, n.water++, 0, 0, z);
        for (let k = 0; k < 5 && n.glints < 120; k++) {
          const x = (((k * 4.3 + row.r * 1.7 + row.dir * (row.speed || 0.4) * 0.6 * t) % 26) + 26) % 26 - 13;
          put(glints, n.glints++, x, 0, z + ((k * 37) % 7) * 0.1 - 0.3);
        }
        for (const m of row.movers) {
          const x = moverX(row, m, t);
          if (Math.abs(x) > 9.5 + m.len / 2 || n.logs >= 120) continue;
          put(logs, n.logs++, x, Math.sin(t * 2.2 + m.x0) * 0.025, z, 0, m.len - 0.08, 1, 1);
        }
        for (const c of row.pads) if (n.pads < 60) put(pads, n.pads++, c, Math.sin(t * 1.6 + c) * 0.02, z, c * 1.3);
      } else {
        put(rails, n.rails++, 0, 0, z);
        const tr = trainAt(row, t);
        if (n.posts < 20) put(posts, n.posts++, COLS + 1.3, 0, z + 0.42);
        if (tr?.light && Math.sin(t * 14) > -0.2) {
          for (const dx of [-0.13, 0.13]) {
            if (n.lamps >= 40) break;
            const on = (dx < 0) === Math.sin(t * 7) > 0;
            if (!on) continue;
            put(lamps, n.lamps, COLS + 1.3 + dx, 1.25, z + 0.33);
            put(halos, n.lamps++, COLS + 1.3 + dx, 1.25, z + 0.3);
          }
        }
        if (tr && tr.a < 12) {
          const len = row.train!.len;
          const head = row.dir > 0 ? tr.b : tr.a;
          // the engine at the front, wagons behind it
          const cars2 = Math.max(1, Math.round((len - 3) / 2.5));
          if (n.engines < 6) put(engines, n.engines++, head - row.dir * 1.5, 0, z, row.dir > 0 ? 0 : Math.PI);
          for (let k = 0; k < cars2 && n.wagons < 40; k++) put(wagons, n.wagons++, head - row.dir * (3 + 1.25 + k * 2.5), 0, z, 0);
        }
      }
      if (row.coin !== null && !run.taken.has(r * 100 + row.coin) && n.coins < 30) put(coins, n.coins++, row.coin, 0.45 + Math.sin(clock * 3 + r) * 0.06, z, clock * 2.4 + r);
    }
    const counts: [IMesh, number][] = [[grass, n.grass], [road, n.road], [dashes, n.dashes], [water, n.water], [rails, n.rails], [glints, n.glints], [trees, n.trees], [rocks, n.rocks], [decor, n.decor], [cars, n.cars], [lorries, n.lorries], [logs, n.logs], [pads, n.pads], [engines, n.engines], [wagons, n.wagons], [posts, n.posts], [lamps, n.lamps], [halos, n.lamps], [coins, n.coins]];
    for (const [im, k] of counts) {
      im.count = k;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    // the fog's front: puffs of mist curling up off it (the mist itself is drawn over the page, fogY)
    if (!o.title && Math.random() < 0.85) {
      const x = camX + (Math.random() - 0.5) * 14;
      puffs.emit(x, 0.2, -run.fog + 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.6, -0.3 - Math.random() * 0.3, 2.2, 1.6 + Math.random() * 1.4, 0xf2f6fb);
    }
    puffs.update(dt, -0.05, 0.2);
    // Ghosty's best: a line across his row
    ghostLine.visible = o.ghostyBest !== null && o.ghostyBest > 0;
    if (o.ghostyBest) ghostLine.position.set(0, 0, -o.ghostyBest - 0.5);
    // the hopper: an arc in the air, a stretch going up and a squash landing; a run's end shows how it ended
    if (p.hopT > 0 && lastHop <= 0) squash = 0;
    if (p.hopT <= 0 && lastHop > 0) squash = 0.12;
    lastHop = p.hopT;
    squash = Math.max(0, squash - dt);
    let d = FACE_A[p.face] - face;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    face += d * Math.min(1, dt * 22);
    let sx = 1, sy = 1 + Math.sin(clock * 4) * 0.025, y = at.y, ry = face;
    if (p.hopT > 0) sy = 1.12, (sx = 0.92);
    if (squash > 0) (sy = 0.78), (sx = 1.14);
    if (!p.alive) {
      const how = p.death;
      if (how === 'car' || how === 'lorry') (sy = 0.14), (sx = 1.5), (y = 0.01);
      else if (how === 'train') (y = Math.min(6, p.deadT * 9)), (ry += p.deadT * 14);
      else if (how === 'water' || how === 'edge') (y = -Math.min(1, p.deadT * 1.6)), (ry += p.deadT * 3);
      else if (how === 'fog') (sx = sy = Math.max(0.05, 1 - p.deadT * 0.9)), (y = p.deadT * 0.8);
    }
    hopper.position.set(at.x, y, -at.z);
    hopper.rotation.set(0, ry, 0);
    hopper.scale.set(sx * 1.18, sy * 1.18, sx * 1.18);
    halo.visible = kindNow === 'ghost';
    halo.position.set(at.x, y, -at.z);
    blob.visible = p.alive;
    blob.position.set(at.x, row0(run, Math.round(at.z)) === 'river' ? -0.22 : 0, -at.z);
    blob.scale.set(1 - at.y * 0.6, 1, 1 - at.y * 0.6);
    crumbs.update(dt, 14, 0.5, -0.3);
    sparks.update(dt, 4, 1.5);
  };
  const row0 = (run: Run, r: number) => rowAt(run, r).kind;

  const burst: HopperScene['burst'] = (kind, x, r) => {
    const z = -r;
    if (kind === 'coin') for (let k = 0; k < 10; k++) sparks.emit(x, 0.5, z, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.45, 0.9, k % 2 ? 0xffe066 : 0xffffff);
    else if (kind === 'splash') for (let k = 0; k < 22; k++) crumbs.emit(x, 0, z, (Math.random() - 0.5) * 3, 3 + Math.random() * 4, (Math.random() - 0.5) * 3, 0.8, 0.9, k % 3 ? 0x7fcbf0 : 0xffffff);
    else if (kind === 'squash') {
      const cols = kindNow === 'frog' ? [0x5cc85c, 0xc8eb8a] : kindNow === 'hen' ? [0xf3e6c8, 0xb07a4a] : kindNow === 'robot' ? [0x9aa4b4, 0x6ae4ff] : [0xf6f9ff, accent];
      for (let k = 0; k < 18; k++) crumbs.emit(x, 0.3, z, (Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5, 0.9, 1, cols[k % 2]!);
    } else for (let k = 0; k < 14; k++) sparks.emit(x, 0.4, z, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 1, 1.4, 0xe9eef6);
  };

  return {
    scene,
    camera,
    update,
    burst,
    setHopper(kind: HopperKind) {
      kindNow = kind;
      let g = hopGeos.get(kind);
      if (!g) hopGeos.set(kind, (g = keep(hopperGeo(kind, accent).build(T))));
      hopper.geometry = g;
    },
    reset() {
      camRow = 0;
      camX = 0;
      face = 0;
      crumbs.clear();
      sparks.clear();
    },
    fogY(fog: number, w: number, h: number) {
      const q = project(eye, [look[0]!, 0, look[2]!], camera.fov, w, h, [camX, 0.3, -fog]);
      return q ? q.y : h * 2;
    },
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
