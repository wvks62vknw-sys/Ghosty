/**
 * PHYSICS ON / OFF AND DROP IT (BRIEF-KERNEL-2 item 3): what turns the physics (physics.ts) into something he does. Off by default: the
 * package is not even fetched, and nothing moves. Turning it ON fetches it once (the size said once, in the pane's line) and builds the
 * world from the scene, still not moving anything. DROP IT on a thing lets that thing fall from where it is (a half metre above what it
 * stands on, when it stands on it) and land on the floor or on what is under it; the walls and the rest of the scene are solid. The
 * scene follows the fall live and the landing is ONE undo step (UNDO puts the thing back where it was). Turning it OFF leaves
 * everything where it is. The engine's frame loop (view.ts `tick`) calls `tick` while something is falling and not at all after.
 */
import { sayError } from '../ui/hisWords';
import type { Engine } from './engine';
import { onMobileData } from './library';
import { dropFrom, Physics, physicsSize, rapierLoaded } from './physics';
import { patch, type Scene } from './scene';

export class Drops {
  on = false;
  loading = false;
  /** What the last turn of the switch or drop did, for the pane's line and the test. */
  last = '';
  /** The package was asked for (once, ever, per page). */
  fetched = 0;
  landed = 0;
  /** Turned on while on mobile data: nothing was fetched. */
  waited = 0;
  /** The things falling now. */
  moving = new Set<string>();
  private phys: Physics | null = null;
  private base: Scene | null = null;
  private written: Scene | null = null;
  /** Said to the pane's line. */
  say: (t: string) => void = () => undefined;

  constructor(private engine: Engine) {}

  /** PHYSICS ON: fetch the package the first time (saying what it weighs), build the world; nothing moves. */
  async turnOn(): Promise<boolean> {
    if (this.on || this.loading) return this.on;
    // a download only on his tap on Wi-Fi, with the size said: on mobile data nothing is fetched and the switch stays off (the engine's FREE MODELS shelf says the same)
    if (!rapierLoaded() && onMobileData()) {
      this.waited++;
      this.last = 'waited';
      this.say(`You’re on mobile data, so I’ll wait for Wi-Fi, then fetch ${physicsSize()}.`);
      return false;
    }
    this.loading = true;
    this.engine.onChange();
    try {
      if (!rapierLoaded()) {
        this.fetched++;
        this.say(`Loading physics, ${physicsSize()}…`);
      }
      this.phys ??= await Physics.create();
      this.phys.build(this.engine.scene, this.moving);
      this.written = this.engine.scene;
      this.on = true;
      this.last = 'on';
      this.say('Physics is on. Nothing moves until you select a thing and tap DROP IT.');
      this.engine.onChange();
      return true;
    } catch (e) {
      this.last = 'failed';
      this.say(`${sayError(e, 'start physics')} Everything stays where it is.`);
      return false;
    } finally {
      this.loading = false;
      this.engine.onChange();
    }
  }

  /** PHYSICS OFF: whatever was falling stops where it is; the scene is as it stands. */
  turnOff(): void {
    if (!this.on) return;
    this.settle();
    this.on = false;
    this.last = 'off';
    this.say('Physics is off: nothing moves.');
    this.engine.onChange();
  }

  /** DROP IT: the thing falls. False when physics is off or there is no such thing. */
  drop(id: string): boolean {
    const e = this.engine;
    const o = e.scene.objects.find((x) => x.id === id);
    if (!this.on || !this.phys || !o) return false;
    if (!this.moving.size) this.base = e.scene;
    const from = dropFrom(e.scene, o);
    this.moving.add(id);
    e.setLive(patch(e.scene, id, { y: from }));
    this.written = e.scene;
    this.phys.build(e.scene, this.moving);
    this.last = `dropping ${o.name}`;
    return true;
  }

  /** The frame loop's call while this wants frames: step by `ms`, move the scene, end the fall at rest. True while something still moves. */
  tick(ms: number, force = false): boolean {
    const e = this.engine;
    if (!this.on || !this.phys) return false;
    if (!this.moving.size) {
      // (only the bench asks for a step with nothing falling: the cost of a world of resting things)
      if (force) this.phys.advance(ms, this.moving);
      return false;
    }
    // something was changed by hand (a typed number, a drag, UNDO): the world is rebuilt from the scene as it now is
    if (e.scene !== this.written) {
      for (const id of [...this.moving]) if (!e.scene.objects.some((o) => o.id === id)) this.moving.delete(id);
      this.phys.build(e.scene, this.moving);
      this.written = e.scene;
      if (!this.moving.size) return false;
    }
    const r = this.phys.advance(ms, this.moving);
    let next = e.scene;
    for (const p of r.places) next = patch(next, p.id, { x: p.x, y: p.y, z: p.z, rot: p.rot });
    for (const id of r.fell) {
      const was = this.base?.objects.find((o) => o.id === id);
      if (was) next = patch(next, id, { x: was.x, y: was.y, z: was.z, rot: was.rot });
      this.moving.delete(id);
      this.last = 'fell off the ground: put back';
      this.say('It fell off the edge of the ground, so it is back where it was.');
    }
    if (next !== e.scene) {
      e.setLive(next);
      this.written = e.scene;
    }
    for (const id of r.rested) this.moving.delete(id);
    if (!this.moving.size) {
      this.finish();
      return false;
    }
    return true;
  }

  /** Everything has come to rest: the whole fall is one undo step. */
  private finish(): void {
    const e = this.engine;
    const before = this.base;
    this.base = null;
    this.landed++;
    this.last = 'landed';
    if (before && before !== e.scene) {
      const now = e.scene;
      e.commit(now, before);
      this.written = e.scene;
    }
    this.say('It has landed. UNDO puts it back where it was.');
  }

  /** Stop whatever is falling where it stands (switched off, or the pane left). */
  private settle(): void {
    if (this.moving.size) {
      this.moving.clear();
      this.finish();
    }
  }

  leave(): void {
    this.settle();
  }

  state() {
    return { on: this.on, loading: this.loading, last: this.last, fetched: this.fetched, waited: this.waited, landed: this.landed, moving: this.moving.size, loaded: rapierLoaded(), steps: this.phys?.steps ?? 0 };
  }
}
