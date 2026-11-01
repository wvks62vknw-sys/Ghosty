/**
 * THE ARENA on screen: a soft-glow 2.5-D plane seen from a tilted camera — a dark floor with a faint grid and a
 * glowing rim, pellets like little lit gems, cells as jelly domes with a glossy shine and a soft halo (a bigger cell
 * sits higher, so it is drawn over a smaller one it covers), spiky viruses turning slowly, ejected blobs, bursts of
 * bits where something is eaten, and Ghosty's best mass as a faint ring round your cell. One instanced mesh a kind;
 * the camera rises as you grow and as your cells spread.
 */
import { Bits, type Cam, flatMaterial, Geo, type Geom, hex3, type IMesh, type Light, makeSky, type Mat, type Mesh, type Obj3, project, setLight, setSky, type ThreeNS } from '../kit';
import { type Arena, centre, COLOURS, PELLETS, radius, SIZE } from './sim';

export interface ArenaScene {
  scene: Obj3;
  camera: Cam;
  update(a: Arena, dt: number, o: { title: boolean; ghostyBest: number | null }): void;
  burst(x: number, z: number, hex: number, n: number, big?: boolean): void;
  /** Where a point on the floor is on the screen (CSS px), or null off it. */
  toScreen(x: number, y: number, z: number, w: number, h: number): { x: number; y: number } | null;
  setAspect(a: number): void;
  dispose(): void;
}

function floorGeo(): { solid: Geo; glow: Geo } {
  const g = new Geo(), glow = new Geo();
  const S = SIZE + 30;
  for (let x = -S; x < S; x += 20) for (let z = -S; z < S; z += 20) {
    const inside = Math.abs(x + 10) < SIZE && Math.abs(z + 10) < SIZE;
    g.quad4([[x, 0, z], [x + 20, 0, z], [x + 20, 0, z + 20], [x, 0, z + 20]], [0, 1, 0], inside ? 0x141a2e : 0x0b0f1c);
  }
  for (let k = -SIZE; k <= SIZE; k += 10) {
    const major = k % 50 === 0;
    g.box(k, 0.02, 0, major ? 0.22 : 0.1, 0.02, SIZE * 2, major ? 0x2c3a66 : 0x1f2846, major ? 90 : 40);
    g.box(0, 0.02, k, SIZE * 2, 0.02, major ? 0.22 : 0.1, major ? 0x2c3a66 : 0x1f2846, major ? 90 : 40);
  }
  for (const [x, z, sx, sz] of [[0, -SIZE, SIZE * 2 + 1.2, 1.2], [0, SIZE, SIZE * 2 + 1.2, 1.2], [-SIZE, 0, 1.2, SIZE * 2], [SIZE, 0, 1.2, SIZE * 2]] as const) {
    g.box(x, 0.4, z, sx, 0.8, sz, 0x6ae0ff, 230);
    glow.box(x, 0.6, z, sx + 3, 1.6, sz + 3, 0x3fa8ff, 255);
  }
  return { solid: g, glow };
}

function virusGeo(): Geo {
  const g = new Geo();
  g.ball(0, 0, 0, 1, 0x3fcf7a, 16, 70, 0.6);
  const n = 22;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const x = Math.sin(a), z = Math.cos(a);
    g.beam(x * 0.92, 0.04, z * 0.92, x * 1.22, 0.06, z * 1.22, 0.1, 0x9dffc0, 200);
  }
  g.ball(0, 0.28, 0, 0.5, 0x8dffb4, 10, 140, 0.5);
  return g;
}

export function makeArenaScene(T: ThreeNS, accent: number): ArenaScene {
  const geos: Geom[] = [];
  const mats: Mat[] = [];
  const keep = (g: Geom) => (geos.push(g), g);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(48, 0.5, 2, 900);
  const sky = makeSky(T);
  sky.scale.set(400, 400, 400);
  scene.add(sky);
  const solid = flatMaterial(T), glowMat = flatMaterial(T, { alpha: 0.3, additive: true }), ringMat = flatMaterial(T, { alpha: 0.55, additive: true }), jelly = flatMaterial(T, { alpha: 0.9 });
  mats.push(solid, glowMat, ringMat, jelly);
  const f = floorGeo();
  const floor = new T.Mesh(keep(f.solid.build(T)), solid);
  floor.frustumCulled = false;
  const rim = new T.Mesh(keep(f.glow.build(T)), glowMat);
  rim.frustumCulled = false;
  scene.add(floor, rim);
  const inst = (g: Geo, n: number, m: Mat): IMesh => {
    const im = new T.InstancedMesh(keep(g.build(T)), m, n) as IMesh;
    im.frustumCulled = false;
    im.setColorAt(0, new T.Color(0xffffff));
    im.count = 0;
    scene.add(im);
    return im;
  };
  const pellets = inst(new Geo().ball(0, 0, 0, 0.42, 0xffffff, 5, 220, 0.8), PELLETS, solid);
  const halos = inst(new Geo().cyl(0, 0.04, 0, 1.22, 0.02, 0xffffff, 28, 255), 120, glowMat);
  const cells = inst(new Geo().ball(0, 0, 0, 1, 0xffffff, 18, 40, 0.55), 120, jelly);
  const cores = inst(new Geo().ball(0, 0, 0, 0.62, 0xffffff, 14, 110, 0.5), 120, solid);
  const shines = inst(new Geo().ball(0, 0, 0, 0.2, 0xffffff, 8, 255, 0.6), 120, solid);
  const blobs = inst(new Geo().ball(0, 0, 0, 1, 0xffffff, 10, 90, 0.6), 80, solid);
  const viruses = inst(virusGeo(), 16, solid);
  const ringGeo = new Geo();
  const N = 72;
  for (let k = 0; k < N; k++) {
    if (k % 3 === 2) continue;
    const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
    const p = (a: number, r: number) => [Math.sin(a) * r, 0.06, Math.cos(a) * r];
    ringGeo.quad4([p(a0, 0.97), p(a1, 0.97), p(a1, 1.03), p(a0, 1.03)], [0, 1, 0], accent, 255);
  }
  const ring: Mesh = new T.Mesh(keep(ringGeo.build(T)), ringMat);
  ring.visible = false;
  scene.add(ring);
  const bits = new Bits(T, 200, keep(new Geo().ball(0, 0, 0, 0.3, 0xffffff, 5, 220).build(T)), glowMat);
  scene.add(bits.mesh);

  const dummy = new T.Object3D();
  const col = new T.Color();
  const light: Light = { sun: [-0.35, 0.85, 0.4], tint: [1, 1, 1.04], fog: hex3(0x070a14), fogNear: 120, fogFar: 320, fill: [0.4, 0.5, 0.75] };
  for (const m of mats) setLight(m, light);
  setSky(sky, { top: hex3(0x05070f), horizon: hex3(0x0b1022), bottom: hex3(0x05070f), sunCol: [0, 0, 0], sunDir: [0, -1, 0], moonDir: [0, -1, 0], stars: 0.6 });
  const put = (im: IMesh, i: number, x: number, y: number, z: number, s = 1, ry = 0, sy = s) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(s, sy, s);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  };
  const tint = (im: IMesh, i: number, hex: number, k = 1) => {
    const c = hex3(hex);
    im.setColorAt(i, col.setRGB(c[0] * k, c[1] * k, c[2] * k));
  };
  for (let i = 0; i < PELLETS; i++) tint(pellets, i, COLOURS[i % COLOURS.length]!);
  let aspect = 0.5, camX = 0, camZ = 0, camH = 60, clock = 0, first = true;
  const eye = [0, 0, 0], look = [0, 0, 0];

  const update: ArenaScene['update'] = (a, dt, o) => {
    clock += dt;
    // pellets: all on the first frame, then only those that moved (eaten and grown again elsewhere)
    if (first) {
      for (let i = 0; i < PELLETS; i++) put(pellets, i, a.pellets[i * 2]!, 0.3, a.pellets[i * 2 + 1]!, 1, i);
      first = false;
    } else for (const i of a.moved) put(pellets, i, a.pellets[i * 2]!, 0.3, a.pellets[i * 2 + 1]!, 1, i);
    for (const i of a.moved) tint(pellets, i, COLOURS[a.pcol[i]! % COLOURS.length]!);
    pellets.count = PELLETS;
    if (a.moved.length || clock < 0.5) pellets.instanceMatrix.needsUpdate = true;
    if (pellets.instanceColor && a.moved.length) pellets.instanceColor.needsUpdate = true;
    // cells: domes that sit higher the bigger they are; a halo, a core and a shine each
    let n = 0;
    for (const p of a.players) {
      if (!p.alive) continue;
      for (const c of p.cells) {
        if (n >= 120) break;
        const r = radius(c.m);
        const wob = 1 + Math.sin(clock * 3 + c.id) * 0.015;
        const y = 0.2 + r * 0.06;
        put(cells, n, c.x, y, c.z, r * wob, 0, r * wob);
        tint(cells, n, p.colour);
        put(cores, n, c.x, y + r * 0.05, c.z, r, 0, r);
        tint(cores, n, p.colour, 0.72);
        put(halos, n, c.x, 0.03, c.z, r);
        tint(halos, n, p.colour);
        put(shines, n, c.x - r * 0.38, y + r * 0.36, c.z - r * 0.32, r);
        tint(shines, n, 0xffffff);
        n++;
      }
    }
    cells.count = cores.count = halos.count = shines.count = n;
    let bn = 0;
    for (const b of a.blobs) {
      if (bn >= 80) break;
      put(blobs, bn, b.x, 0.3, b.z, radius(b.m));
      tint(blobs, bn++, a.players[b.owner]?.colour ?? 0xffffff);
    }
    blobs.count = bn;
    let vn = 0;
    for (const v of a.viruses) {
      if (v.back > 0 || vn >= 16) continue;
      put(viruses, vn, v.x, 0.4, v.z, radius(v.m), clock * 0.4 + vn);
      tint(viruses, vn++, 0xffffff);
    }
    viruses.count = vn;
    for (const im of [cells, cores, halos, shines, blobs, viruses]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    bits.update(dt, 0, 2.2);
    // the camera: tilted over your cells, higher as you grow and as they spread
    const you = a.players[0]!;
    let cx = 0, cz = 0, spread = 0, big = 0;
    if (o.title || !you.alive || !you.cells.length) {
      cx = Math.sin(clock * 0.07) * 40;
      cz = Math.cos(clock * 0.05) * 30;
      big = 160;
    } else {
      const c = centre(you);
      cx = c.x;
      cz = c.z;
      for (const q of you.cells) (spread = Math.max(spread, Math.hypot(q.x - c.x, q.z - c.z) + radius(q.m))), (big += q.m);
    }
    const want = 60 + Math.sqrt(big) * 2.6 + spread * 1.2;
    camH += (want - camH) * Math.min(1, dt * 1.5);
    camX += (cx - camX) * Math.min(1, dt * 6);
    camZ += (cz - camZ) * Math.min(1, dt * 6);
    const portrait = aspect < 1;
    const h = camH * (portrait ? 1.25 : 1);
    eye[0] = camX;
    eye[1] = h;
    eye[2] = camZ + h * 0.42;
    look[0] = camX;
    look[2] = camZ - h * 0.04;
    camera.position.set(eye[0]!, eye[1]!, eye[2]!);
    camera.lookAt(look[0]!, 0, look[2]!);
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);
    // Ghosty's best, as a faint ring the size his heaviest bot grew to
    ring.visible = !!o.ghostyBest && !o.title && you.alive;
    if (o.ghostyBest && you.alive) {
      const c = centre(you);
      const rr = radius(o.ghostyBest) * (1 + Math.sin(clock * 2.2) * 0.02);
      ring.position.set(c.x, 0, c.z);
      ring.scale.set(rr, 1, rr);
      ring.rotation.set(0, clock * 0.15, 0);
    }
  };

  return {
    scene,
    camera,
    update,
    burst(x, z, hex, k, bigOne) {
      for (let q = 0; q < k; q++) {
        const a = Math.random() * Math.PI * 2, sp = (bigOne ? 10 : 5) + Math.random() * (bigOne ? 16 : 8);
        bits.emit(x, 0.6, z, Math.sin(a) * sp, 1 + Math.random() * 3, Math.cos(a) * sp, 0.5 + Math.random() * 0.3, bigOne ? 2.4 : 1.4, hex);
      }
    },
    toScreen(x, y, z, w, h) {
      const q = project(eye, [look[0]!, 0, look[2]!], camera.fov, w, h, [x, y, z]);
      return q ? { x: q.x, y: q.y } : null;
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
