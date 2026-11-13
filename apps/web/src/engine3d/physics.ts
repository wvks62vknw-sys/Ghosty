/**
 * PHYSICS FOR THE 3-D ENGINE (BRIEF-KERNEL-2 item 3): gravity and collision for the things in a room. Off by default: nothing moves until
 * he turns PHYSICS ON, and even then a thing falls only when he taps DROP IT on it. It then falls from where it is (lifted a half metre
 * above what is under it when it stands on it) and lands on the floor or on the thing under it; the walls, the other things and the floor
 * are solid. Rapier (Apache-2.0, WebAssembly: @dimforge/rapier3d-compat 0.21.0, vendored under public/vendor/rapier like three.js) runs
 * it, and it is loaded only when PHYSICS is turned on: never on the first screen's path, never when the pane opens. It is typed here by
 * hand for exactly what the engine calls (as three is in studio/three.ts). Every number is a first estimate, never certified.
 */
import { clamp, type Obj, type Scene } from './scene';
import { primsOf, turnRad } from './shapes';

/** Where the vendored package is served from, and the bytes the phone is asked for when PHYSICS is first turned on (its one file). */
export const RAPIER_URL = '/vendor/rapier/rapier.mjs';
export const RAPIER_BYTES = 4_340_292;
/** "Loading physics, 4.3 MB": the size said once in the pane's line, the true number of the file. */
export const physicsSize = (bytes = RAPIER_BYTES): string => (bytes < 1_000_000 ? `${Math.round(bytes / 1000)} kB` : `${(bytes / 1_000_000).toFixed(1)} MB`);

interface V3 {
  x: number;
  y: number;
  z: number;
}
interface RBody {
  translation(): V3;
  rotation(): { x: number; y: number; z: number; w: number };
  linvel(): V3;
  setTranslation(v: V3, wake: boolean): void;
  sleep(): void;
}
interface RBodyDesc {
  setTranslation(x: number, y: number, z: number): RBodyDesc;
  setRotation(q: { x: number; y: number; z: number; w: number }): RBodyDesc;
  enabledRotations(x: boolean, y: boolean, z: boolean): RBodyDesc;
  setCcdEnabled(on: boolean): RBodyDesc;
}
interface RColliderDesc {
  setTranslation(x: number, y: number, z: number): RColliderDesc;
  setFriction(f: number): RColliderDesc;
  setRestitution(r: number): RColliderDesc;
}
interface RWorld {
  timestep: number;
  step(): void;
  createRigidBody(d: RBodyDesc): RBody;
  createCollider(d: RColliderDesc, body?: RBody): unknown;
  free(): void;
}
interface Rapier {
  init(): Promise<void>;
  World: new (gravity: V3) => RWorld;
  RigidBodyDesc: { dynamic(): RBodyDesc; fixed(): RBodyDesc };
  ColliderDesc: { cuboid(hx: number, hy: number, hz: number): RColliderDesc; ball(r: number): RColliderDesc; cylinder(halfHeight: number, r: number): RColliderDesc };
}

let loading: Promise<Rapier> | null = null;
/** The package, fetched and started once (the only place its file is asked for). */
export function loadRapier(): Promise<Rapier> {
  loading ??= (async () => {
    const mod = (await import(/* @vite-ignore */ RAPIER_URL)) as { default?: Rapier } & Rapier;
    const R = mod.default ?? mod;
    await R.init();
    return R;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}
export const rapierLoaded = (): boolean => loading !== null;

/** Fixed step (and up to half a second of them per frame, for a phone drawing slowly): a thin top (a table's is 4 cm) is not skipped at a half metre's fall. */
const STEP = 1 / 120;
const MAX_STEPS = 60;
/** A thing standing on something is lifted this far above it before it is dropped (cm). */
export const LIFT = 50;
/** Slower than this (m/s) for REST seconds, and a thing is at rest. */
const STILL = 0.02;
const REST = 0.25;
/** Lower than this (m) and it fell off the ground: put back where it was. */
const OFF = -1.5;

/** Does `a`'s footprint overlap `b`'s (their rotated rectangles, by the separating axes)? */
export function overlaps(a: Obj, b: Obj): boolean {
  const corners = (o: Obj) => {
    const t = turnRad(o.rot);
    const c = Math.cos(t);
    const s = Math.sin(t);
    return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]) => {
      const px = (sx * o.w) / 2;
      const pz = (sz * o.d) / 2;
      return [o.x + px * c + pz * s, o.z - px * s + pz * c] as const;
    });
  };
  const axes = (o: Obj) => {
    const t = turnRad(o.rot);
    return [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]] as const;
  };
  const ca = corners(a);
  const cb = corners(b);
  for (const [ax, az] of [...axes(a), ...axes(b)]) {
    const pa = ca.map(([x, z]) => x * ax + z * az);
    const pb = cb.map(([x, z]) => x * ax + z * az);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
  }
  return true;
}

/** The height (cm) of the highest thing under `o`'s footprint, or 0 (the floor). */
export function surfaceUnder(s: Scene, o: Obj): number {
  let top = 0;
  for (const x of s.objects) if (x.id !== o.id && x.kind !== 'plane' && overlaps(o, x)) top = Math.max(top, x.y + x.h);
  return top;
}

/** The height (cm) a drop starts from: where it already hangs above what is under it, else a half metre above that. */
export function dropFrom(s: Scene, o: Obj): number {
  const top = surfaceUnder(s, o);
  return o.y > top + 1 ? o.y : top + LIFT;
}

export interface Settled {
  id: string;
  x: number;
  y: number;
  z: number;
  rot: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const yawOf = (q: { x: number; y: number; z: number; w: number }) => 2 * Math.atan2(q.y, q.w);

/** The physical world of one scene: its floor, every thing solid, and the ones he dropped moving. */
export class Physics {
  private world: RWorld;
  private bodies = new Map<string, RBody>();
  private calm = new Map<string, number>();
  private carry = 0;
  steps = 0;

  private constructor(private R: Rapier) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
  }

  static async create(): Promise<Physics> {
    return new Physics(await loadRapier());
  }

  free(): void {
    this.world.free();
  }

  private shapes(o: Obj): RColliderDesc[] {
    const C = this.R.ColliderDesc;
    return primsOf(o).map((p) => {
      const d = p.t === 'box' ? C.cuboid(p.s[0] / 2, p.s[1] / 2, p.s[2] / 2) : p.t === 'cyl' ? C.cylinder(p.s[1] / 2, Math.min(p.s[0], p.s[2]) / 2) : C.ball(Math.min(p.s[0], p.s[1], p.s[2]) / 2);
      return d.setTranslation(p.c[0], p.c[1], p.c[2]).setFriction(0.8).setRestitution(0);
    });
  }

  private add(o: Obj, moving: boolean): void {
    const R = this.R;
    const t = turnRad(o.rot);
    const desc = (moving ? R.RigidBodyDesc.dynamic().enabledRotations(false, true, false).setCcdEnabled(true) : R.RigidBodyDesc.fixed())
      .setTranslation(o.x / 100, o.y / 100, o.z / 100)
      .setRotation({ x: 0, y: Math.sin(t / 2), z: 0, w: Math.cos(t / 2) });
    const body = this.world.createRigidBody(desc);
    for (const c of this.shapes(o)) this.world.createCollider(c, body);
    this.bodies.set(o.id, body);
  }

  /** The world for `s`: a floor under the ground (and a hand's breadth round it), the things in `moving` free to fall, the rest fixed. */
  build(s: Scene, moving: Set<string>): void {
    for (const id of [...this.bodies.keys()]) this.bodies.delete(id);
    this.world.free();
    this.world = new this.R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.calm.clear();
    const gw = clamp(s.ground.w, 100, 2000) / 100 + 2;
    const gd = clamp(s.ground.d, 100, 2000) / 100 + 2;
    const floor = this.world.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));
    this.world.createCollider(this.R.ColliderDesc.cuboid(gw / 2, 0.1, gd / 2).setFriction(0.8).setRestitution(0), floor);
    for (const o of s.objects) this.add(o, moving.has(o.id));
  }

  /** Advance by `ms` of real time; the moving things' new places, and which of them have come to rest (for good: they are then fixed in the scene). */
  advance(ms: number, moving: Set<string>): { places: Settled[]; rested: string[]; fell: string[] } {
    this.carry += Math.min(ms, MAX_STEPS * STEP * 1000) / 1000;
    let n = 0;
    while (this.carry >= STEP && n < MAX_STEPS) {
      this.world.step();
      this.carry -= STEP;
      n++;
      this.steps++;
    }
    const places: Settled[] = [];
    const rested: string[] = [];
    const fell: string[] = [];
    for (const id of moving) {
      const b = this.bodies.get(id);
      if (!b) continue;
      const p = b.translation();
      const v = b.linvel();
      if (p.y < OFF) {
        fell.push(id);
        continue;
      }
      places.push({ id, x: r1(p.x * 100), y: Math.max(0, r1(p.y * 100)), z: r1(p.z * 100), rot: r1(((((-yawOf(b.rotation()) * 180) / Math.PI) % 360) + 360) % 360) });
      const still = Math.hypot(v.x, v.y, v.z) < STILL;
      const calm = still ? (this.calm.get(id) ?? 0) + n * STEP : 0;
      this.calm.set(id, calm);
      if (calm >= REST) rested.push(id);
    }
    return { places, rested, fell };
  }
}
