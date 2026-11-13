/**
 * THE WORKING ENGINE, DRAWN (BRIEF-WORKING-ENGINE): car/engine.ts's pieces as three.js meshes in the car's own materials
 * (car/kit.ts's palette: no new colour), each piece one group posed from the crank angle every frame — the pistons by the rod
 * geometry, the valves by the cam profile, the belt's pulleys at their ratios — and the four things the view does with it: LIFT THE
 * COVER (the cover goes up and the casing turns see-through), TAKE APART (the parts fly out in layers: head and manifolds first, then
 * valves and cams, then pistons and rods, the block last), SECTION (a plane along the cylinders cuts the casing away) and a tap
 * that lights one part by its name ("Piston 2"). Nothing here touches the page. The motion is kinematic: no physics (KERNEL 2's).
 */
import { engineModel, factsOf, flown, numbersFor, placeInBay, poseOf, powerCylinders, strokeAt, toCar, valveLift, cycleAt, type BayBox, type EngineModel, type Piece, type Placement, type V3 } from './engine';
import { merge, mesh, type Mats } from './kit';
import type { PartId } from './parts';
import type { CarSpec } from './spec';
import type { TPlane } from '../studio/three';
import type { CarLib, TBufferGeometry, TMaterial, TMesh, TObject3D } from './three';

interface Node {
  piece: Piece;
  group: TObject3D;
  meshes: TMesh[];
}

/** The shells go this see-through when the cover is lifted. */
const GHOST = 0.2;
const COVER_MS = 650;

export class WorkingEngine {
  readonly model: EngineModel;
  readonly place: Placement;
  /** The crank angle in degrees, 0 to 720 (one whole cycle); cylinder one is at the top of its power stroke at 0. */
  theta = 0;
  /** Total degrees turned since it began (a test reads that it advances). */
  turned = 0;
  rpm = 800;
  paused = false;
  /** 0 the cover on, 1 off (it animates between). */
  cover = 0;
  private coverTo = 0;
  private coverFrom = 0;
  private coverAt = 0;
  /** TAKE APART, 0 to 1. */
  explode = 0;
  section = false;
  selected = '';
  private nodes: Node[] = [];
  private wrappers = new Map<PartId, TObject3D>();
  private shellMats: TMaterial[] = [];
  private glowMats: TMaterial[] = [];
  /** The see-through materials SECTION does not cut. */
  private ghostOnly: TMaterial[] = [];
  /** The glow in each cylinder hangs from this (the bay adds it beside the parts). */
  readonly glowRoot: TObject3D;
  private glows: { cyl: number; mat: TMaterial; node: TObject3D }[] = [];
  private plane: TPlane | null = null;
  private picks: { m: TMesh; orig: TMaterial | TMaterial[]; mat: TMaterial }[] = [];
  private lastPoseKey = '';

  constructor(private readonly L: CarLib, readonly spec: CarSpec, private readonly M: Mats, bay: BayBox) {
    this.model = engineModel(factsOf(spec));
    this.place = placeInBay(this.model, bay);
    this.glowRoot = new L.T.Group();
    this.build();
  }

  /** Slowed 20×: the drawn speed is a twentieth of the real one, so the eye can follow. */
  static SLOW = 20;

  private build(): void {
    const { L, M, model } = this;
    const T = L.T;
    const shellOf = (key: string, ghost: boolean): TMaterial => {
      const m = (M as unknown as Record<string, TMaterial>)[key]!.clone();
      this.shellMats.push(m);
      if (ghost) this.ghostOnly.push(m);
      return m;
    };
    const shells = new Map<string, TMaterial>();
    for (const piece of model.pieces) {
      const g = new T.Group();
      g.name = piece.inst;
      g.userData.part = piece.id;
      g.userData.inst = piece.inst;
      const parts = piece.prims.map((p) => {
        const geo: TBufferGeometry = p.t === 'box' ? new T.BoxGeometry(p.s[0], p.s[1], p.s[2]) : p.t === 'cyl' ? new T.CylinderGeometry(p.s[0] / 2, p.s[0] / 2, p.s[1], 22) : new T.SphereGeometry(p.s[0] / 2, 16, 10);
        return { g: geo, at: p.c, ...(p.r ? { rot: p.r } : {}) };
      });
      let mat: TMaterial;
      if (piece.shell || piece.ghost) {
        // the casing shares one material by colour (SECTION cuts these); the see-through manifolds have their own (it does not)
        const k = `${piece.shell ? 'shell' : 'ghost'}:${piece.mat}`;
        if (!shells.has(k)) shells.set(k, shellOf(piece.mat, !piece.shell));
        mat = shells.get(k)!;
      } else mat = (M as unknown as Record<string, TMaterial>)[piece.mat]!;
      const me = mesh(L, merge(L, parts), mat, piece.id);
      me.userData.inst = piece.inst;
      me.userData.cyl = piece.cyl;
      if (piece.shell) me.userData.shell = true;
      if (piece.ghost) me.userData.ghost = true;
      if (piece.inner) me.userData.inner = true;
      if (piece.cover) me.userData.cover = true;
      g.add(me);
      if (piece.passage) g.visible = false;
      g.position.set(piece.home[0], piece.home[1], piece.home[2]);
      g.rotation.x = piece.rx0;
      this.nodes.push({ piece, group: g, meshes: [me] });
      let w = this.wrappers.get(piece.id);
      if (!w) {
        w = new T.Group();
        w.name = piece.id;
        w.position.set(this.place.at[0], this.place.at[1], this.place.at[2]);
        w.rotation.y = this.place.turnY;
        w.scale.setScalar(this.place.scale);
        this.wrappers.set(piece.id, w);
      }
      w.add(g);
    }
    // the burning fuel: a glow in each cylinder that fades through its power stroke (part of no part: a tap goes through it)
    if (!model.electric) {
      // a root of its own, placed like the engine and named for no part (a tap goes through it; it is not any part's middle)
      const host = this.glowRoot;
      host.name = 'burning';
      host.position.set(this.place.at[0], this.place.at[1], this.place.at[2]);
      host.rotation.y = this.place.turnY;
      host.scale.setScalar(this.place.scale);
      for (let i = 0; i < model.cyl; i++) {
        const mat = (M.orange as TMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0;
        mat.depthWrite = false;
        mat.blending = T.AdditiveBlending;
        mat.emissive?.setHex(mat.color?.getHex() ?? 0);
        mat.emissiveIntensity = 1.6;
        this.glowMats.push(mat);
        const ball = new T.Mesh(new T.SphereGeometry(model.bore * 0.4, 14, 10), mat) as TMesh;
        (ball as unknown as { raycast: () => void }).raycast = () => undefined;
        ball.position.set(0, model.deck - model.bore * 0.14, 0);
        const g = new T.Group();
        g.name = `Burn ${i + 1}`;
        g.position.set(model.cylX[i]!, 0, 0);
        g.rotation.x = model.beta[i]!;
        g.add(ball);
        host.add(g);
        this.glows.push({ cyl: i, mat, node: g });
      }
    }
    this.setTheta(0);
  }

  /** The group for a part id (every instance of it), or null: the bay's build table takes these. */
  take(id: PartId): TObject3D | null {
    return this.wrappers.get(id) ?? null;
  }

  /** The middle of a part's first piece, in the car's frame (where a hose runs to). */
  anchor(id: PartId): V3 | null {
    const n = this.nodes.find((x) => x.piece.id === id);
    if (!n) return null;
    const p = n.piece.prims[0];
    if (!p) return null;
    return toCar([n.piece.home[0] + p.c[0], n.piece.home[1] + p.c[1], n.piece.home[2] + p.c[2]], this.place);
  }

  // ------------------------------------------------------------------ the crank

  setTheta(deg: number): void {
    this.theta = ((deg % 720) + 720) % 720;
    this.pose();
  }

  /** Turn the crank by `deg` (STEP: a quarter turn is 90). */
  step(deg: number): void {
    this.turned += deg;
    this.setTheta(this.theta + deg);
  }

  /** The drawn turn: real revs a minute slowed 20×, in degrees a second. */
  degPerSecond(): number {
    return ((this.rpm / WorkingEngine.SLOW) * 360) / 60;
  }

  /** Advance by dt seconds (unless paused). */
  tick(dt: number, now: number, reduced: boolean): void {
    if (this.cover !== this.coverTo) {
      const k = this.coverAt ? Math.min(1, (now - this.coverAt) / COVER_MS) : 1;
      this.cover = reduced || k >= 1 ? this.coverTo : this.coverFrom + (this.coverTo - this.coverFrom) * k;
      this.applyCover();
    }
    if (!this.paused && !reduced && dt > 0) {
      const d = this.degPerSecond() * Math.min(dt, 0.25);
      this.turned += d;
      this.theta = (this.theta + d) % 720;
    }
    this.pose();
    if (this.selected) this.pulse(now);
    if (this.section) this.clip();
  }

  // ------------------------------------------------------------------ the cover, the casing, take apart, section

  /** LIFT THE COVER (true) or put it back (false). */
  setCover(on: boolean, now = performance.now(), instant = false): void {
    this.coverFrom = this.cover;
    this.coverTo = on ? 1 : 0;
    this.coverAt = now;
    if (instant) {
      this.cover = this.coverTo;
      this.applyCover();
    }
  }

  private applyCover(): void {
    // the casing turns see-through as the cover goes; a cover that is off stays off the engine
    for (const m of this.shellMats) {
      m.transparent = this.cover > 0.001;
      m.opacity = 1 - (1 - GHOST) * this.cover;
      m.depthWrite = this.cover < 0.5;
    }
    this.lastPoseKey = '';
    this.pose();
  }

  setExplode(t: number): void {
    this.explode = Math.max(0, Math.min(1, t));
    this.lastPoseKey = '';
    this.pose();
  }

  /** SECTION on or off: the casing (block, head, sump) is cut along the cylinders and the channels show. */
  setSection(on: boolean, renderer?: { localClippingEnabled: boolean }): void {
    this.section = on;
    if (renderer) renderer.localClippingEnabled = on;
    const T = this.L.T;
    if (on && !this.plane) this.plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
    for (const m of this.shellMats) {
      if (this.ghostOnly.includes(m)) continue;
      m.clippingPlanes = on ? [this.plane!] : null;
      m.needsUpdate = true;
    }
    for (const n of this.nodes) if (n.piece.passage) n.group.visible = on;
    // the cut seen from inside needs both faces
    for (const m of this.shellMats) m.side = this.L.T.DoubleSide;
    if (on) this.clip();
  }

  /** The cut parts, by id (what SECTION cuts through). */
  cutParts(): PartId[] {
    return this.section ? [...new Set(this.nodes.filter((n) => n.piece.shell).map((n) => n.piece.id))] : [];
  }

  /** The plane through the cylinders' middle (the engine's z = 0), in the world, keeping the far half. */
  private clip(): void {
    if (!this.plane) return;
    const w = [...this.wrappers.values()][0];
    if (!w) return;
    const T = this.L.T;
    w.updateMatrixWorld(true);
    const o = w.getWorldPosition(new T.Vector3());
    const a = this.place.turnY;
    const n = new T.Vector3(Math.sin(a), 0, Math.cos(a));
    const c = -(n.x * o.x + n.y * o.y + n.z * o.z);
    this.plane.set(n, c);
  }

  // ------------------------------------------------------------------ the pose, each frame

  private pose(): void {
    const key = `${this.theta.toFixed(3)}|${this.explode}|${this.cover}`;
    if (key === this.lastPoseKey) return;
    this.lastPoseKey = key;
    const m = this.model;
    for (const n of this.nodes) {
      const p = poseOf(m, n.piece, this.theta);
      // the cover goes with the lift; everything else with TAKE APART
      const k = n.piece.cover ? Math.max(flown(n.piece, this.explode), this.cover >= 1 ? 1 : this.cover) : flown(n.piece, this.explode);
      n.group.position.set(p.pos[0] + n.piece.ex[0] * k, p.pos[1] + n.piece.ex[1] * k, p.pos[2] + n.piece.ex[2] * k);
      n.group.rotation.x = p.rx;
      if (n.piece.cover) n.group.visible = this.cover < 1 || this.explode > 0.01;
    }
    for (const g of this.glows) {
      const c = cycleAt(m, g.cyl, this.theta);
      // each glow grows and dies away through the first 150° of its cylinder's power stroke
      const s = c < 150 ? 1 - c / 150 : 0;
      g.node.visible = s > 0.01;
      g.node.scale.setScalar(0.4 + 0.9 * s);
      g.mat.opacity = 0.85 * s;
    }
  }

  // ------------------------------------------------------------------ one part lit by its name

  /** Light every mesh of one instance ("Piston 2"); '' clears. */
  select(inst: string): void {
    for (const s of this.picks) {
      s.m.material = s.orig;
      s.mat.dispose();
    }
    this.picks = [];
    this.selected = inst;
    if (!inst) return;
    const hex = (this.M.orange as TMaterial).color?.getHex() ?? 0;
    for (const n of this.nodes) {
      if (n.piece.inst !== inst) continue;
      for (const me of n.meshes) {
        const base = Array.isArray(me.material) ? me.material[0]! : me.material;
        const mat = base.clone();
        mat.emissive?.setHex(hex);
        mat.emissiveIntensity = 1;
        if (n.piece.shell) {
          mat.transparent = true;
          mat.opacity = Math.max(0.55, base.opacity ?? 1);
        }
        this.picks.push({ m: me, orig: me.material, mat });
        me.material = mat;
      }
    }
  }

  private pulse(now: number): void {
    const k = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2 * 0.9);
    for (const s of this.picks) s.mat.emissiveIntensity = 0.5 + 1.1 * k;
  }

  // ------------------------------------------------------------------ what a test or the pane reads

  /** The instances, with where each one's own origin stands (the car's frame, metres), how far it has flown (0 to 1) and its layer. */
  instances(): { inst: string; id: PartId; cyl: number; origin: V3; fly: number; layer: number }[] {
    const m = this.model;
    return this.nodes.map((n) => {
      const p = poseOf(m, n.piece, this.theta);
      const k = flown(n.piece, this.explode);
      return { inst: n.piece.inst, id: n.piece.id, cyl: n.piece.cyl, origin: toCar([p.pos[0] + n.piece.ex[0] * k, p.pos[1] + n.piece.ex[1] * k, p.pos[2] + n.piece.ex[2] * k], this.place), fly: k, layer: n.piece.layer };
    });
  }

  /** Cylinder 1's stroke, the cylinders on their power stroke, the valves' lifts: the line the pane says. */
  reading(): { stroke: string; power: number[]; lifts: number[]; piston: number[] } {
    const m = this.model;
    return {
      stroke: m.electric ? '' : strokeAt(m, 0, this.theta),
      power: m.electric ? [] : powerCylinders(m, this.theta),
      lifts: m.electric ? [] : m.cylX.flatMap((_, i) => [valveLift(true, cycleAt(m, i, this.theta)), valveLift(false, cycleAt(m, i, this.theta))]),
      piston: m.electric ? [] : m.cylX.map((_, i) => poseOf(m, this.nodes.find((n) => n.piece.motion.k === 'piston' && (n.piece.motion as { i: number }).i === i)!.piece, this.theta).pos[1]),
    };
  }

  /** The numbers of a part of this engine (each with its word). */
  numbers(id: PartId): string[] {
    return numbersFor(this.model, id);
  }

  dispose(): void {
    this.select('');
    for (const n of this.nodes) for (const me of n.meshes) me.geometry.dispose();
    for (const m of [...this.shellMats, ...this.glowMats]) m.dispose();
  }
}
