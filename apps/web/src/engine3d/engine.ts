/**
 * THE ENGINE'S HAND (BRIEF-ENGINE-3D-1): what a touch on the stage does. It owns the scene, the camera, what is selected, which tool
 * is up, what is armed to be placed, and the undo and redo lists; it turns pointer events into a turned view (one finger on empty
 * ground), a pinched and slid view (two fingers), a tap that selects or places, a drag that moves a thing and a drag on a handle.
 * Nothing here draws or touches the page: the view (view.ts) draws what it holds and the pane (pane.ts) shows its numbers.
 */
import { frame, groundAt, orbit, pan, rayAt, startCam, zoom, type Cam } from './camera';
import { drag, grabBody, handlesOf, pickHandle, type Grab, type Handle, type Tool } from './edit';
import { addObject, duplicate, newScene, patch, remove, snap, type Kind, type Obj, type Scene } from './scene';
import { rayHit } from './shapes';

export const UNDO_DEPTH = 60;
/** A tap is a touch that stays within this many pixels and lets go inside this many milliseconds. */
export const TAP = { px: 8, ms: 600 };

export interface Armed {
  kind: Kind;
  over?: Partial<Obj>;
  label: string;
}

type Pt = { x: number; y: number };

export class Engine {
  scene: Scene;
  cam: Cam = startCam();
  selected = '';
  tool: Tool = 'move';
  armed: Armed | null = null;
  undoList: Scene[] = [];
  redoList: Scene[] = [];
  size = { w: 400, h: 400 };
  /** What the last touch did, for the spec and the screen reader. */
  last = '';
  onChange: () => void = () => undefined;
  onSceneChange: (s: Scene) => void = () => undefined;
  /** A placement that needs more than the engine knows (a model with no file yet): the pane handles it. */
  onPlaced: (id: string) => void = () => undefined;

  private pts = new Map<number, Pt>();
  private mode: 'none' | 'view' | 'grab' | 'pinch' = 'none';
  private grab: Grab | null = null;
  private base: Scene | null = null;
  private down: (Pt & { t: number; id: string }) | null = null;
  private moved = false;
  private pinch: { d: number; c: Pt } | null = null;

  constructor(scene: Scene = newScene()) {
    this.scene = scene;
    this.cam = frame(this.cam, scene);
  }

  get obj(): Obj | undefined {
    return this.scene.objects.find((o) => o.id === this.selected);
  }

  private changed(): void {
    this.onSceneChange(this.scene);
    this.onChange();
  }

  /** The scene moved by something other than his hand (a falling thing): taken at once, with no undo step of its own (the fall's end makes one). */
  setLive(next: Scene): void {
    this.scene = next;
    this.changed();
  }

  /** Make `next` the scene, remembering the one before for undo (unless it is the same). */
  commit(next: Scene, before: Scene = this.scene): void {
    if (next === before) return;
    this.undoList.push(before);
    if (this.undoList.length > UNDO_DEPTH) this.undoList.shift();
    this.redoList = [];
    this.scene = next;
    this.changed();
  }

  /** A whole new scene (opened, new, from SHOW ME): not undoable into the one before, the camera frames it. */
  load(s: Scene, keepUndo = false): void {
    if (keepUndo) this.undoList.push(this.scene);
    else this.undoList = [];
    this.redoList = [];
    this.scene = s;
    this.selected = '';
    this.armed = null;
    this.cam = frame(this.cam, s);
    this.changed();
  }

  undo(): boolean {
    const was = this.undoList.pop();
    if (!was) return false;
    this.redoList.push(this.scene);
    this.scene = was;
    if (!was.objects.some((o) => o.id === this.selected)) this.selected = '';
    this.changed();
    return true;
  }

  redo(): boolean {
    const next = this.redoList.pop();
    if (!next) return false;
    this.undoList.push(this.scene);
    this.scene = next;
    if (!next.objects.some((o) => o.id === this.selected)) this.selected = '';
    this.changed();
    return true;
  }

  select(id: string): void {
    this.selected = this.scene.objects.some((o) => o.id === id) ? id : '';
    this.onChange();
  }

  setTool(t: Tool): void {
    this.tool = t;
    this.onChange();
  }

  arm(a: Armed | null): void {
    this.armed = a;
    this.last = a ? `armed ${a.label}` : 'disarmed';
    this.onChange();
  }

  /** Put a thing at (x, z) cm and select it. */
  place(kind: Kind, x: number, z: number, over: Partial<Obj> = {}): string {
    const r = addObject(this.scene, kind, { x: snap(x), z: snap(z) }, over);
    if (!r.id) return '';
    this.commit(r.scene);
    this.selected = r.id;
    this.last = `placed ${kind}`;
    this.onChange();
    this.onPlaced(r.id);
    return r.id;
  }

  /** A typed number, or any change to the selected thing: one undo step. */
  set(id: string, p: Partial<Omit<Obj, 'id' | 'kind'>>): void {
    this.commit(patch(this.scene, id, p));
  }

  removeSelected(): Obj | undefined {
    const o = this.obj;
    if (!o) return undefined;
    this.commit(remove(this.scene, o.id));
    this.selected = '';
    this.onChange();
    return o;
  }

  duplicateSelected(): string {
    if (!this.selected) return '';
    const r = duplicate(this.scene, this.selected);
    if (!r.id) return '';
    this.commit(r.scene);
    this.selected = r.id;
    this.onChange();
    return r.id;
  }

  frame(): void {
    this.cam = frame(this.cam, this.scene);
    this.onChange();
  }

  resize(w: number, h: number): void {
    this.size = { w: Math.max(1, w), h: Math.max(1, h) };
    this.onChange();
  }

  handles(): Handle[] {
    const o = this.obj;
    return o ? handlesOf(o, this.tool) : [];
  }

  /** The nearest thing a touch at (px, py) strikes. */
  hitObject(px: number, py: number): Obj | undefined {
    const r = rayAt(this.cam, px, py, this.size.w, this.size.h);
    let best: { o: Obj; t: number } | null = null;
    for (const o of this.scene.objects) {
      const t = rayHit(r, o);
      if (t !== null && (!best || t < best.t)) best = { o, t };
    }
    return best?.o;
  }

  // ---------------------------------------------------------------- the touch

  pointerDown(id: number, px: number, py: number, now = performance.now()): void {
    this.pts.set(id, { x: px, y: py });
    if (this.pts.size >= 2) {
      this.endGrab();
      this.mode = 'pinch';
      const [a, b] = [...this.pts.values()] as [Pt, Pt];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      this.down = null;
      return;
    }
    this.moved = false;
    const o = this.obj;
    this.down = { x: px, y: py, t: now, id: '' };
    if (o && this.tool !== 'move') {
      const hd = pickHandle(this.cam, o, this.tool, px, py, this.size.w, this.size.h);
      if (hd) {
        this.mode = 'grab';
        this.grab = { kind: hd.kind, dx: 0, dz: 0 };
        this.base = this.scene;
        this.last = `grabbed ${hd.kind}`;
        return;
      }
    }
    const hit = this.hitObject(px, py);
    this.down.id = hit?.id ?? '';
    if (o && this.tool === 'move' && hit?.id === o.id && !this.armed) {
      this.mode = 'grab';
      this.grab = grabBody(this.cam, o, px, py, this.size.w, this.size.h);
      this.base = this.scene;
      this.last = 'grabbed body';
      return;
    }
    this.mode = 'view';
  }

  pointerMove(id: number, px: number, py: number): void {
    const p = this.pts.get(id);
    if (!p) return;
    const dx = px - p.x;
    const dy = py - p.y;
    p.x = px;
    p.y = py;
    if (this.down && Math.hypot(px - this.down.x, py - this.down.y) > TAP.px) this.moved = true;
    if (this.mode === 'pinch' && this.pinch && this.pts.size >= 2) {
      const [a, b] = [...this.pts.values()] as [Pt, Pt];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.cam = pan(zoom(this.cam, d / this.pinch.d), c.x - this.pinch.c.x, c.y - this.pinch.c.y, this.size.h);
      this.pinch = { d, c };
      this.last = 'pinched';
      this.onChange();
    } else if (this.mode === 'grab' && this.grab) {
      const o = this.obj;
      // a handle answers from its first move (the finger took it on purpose); a body waits for a real drag, so a tap never nudges it
      if (!o || (!this.moved && this.grab.kind === 'move')) return;
      const next = drag(this.cam, o, this.grab, px, py, this.size.w, this.size.h);
      if (next !== o) {
        this.scene = { ...this.scene, objects: this.scene.objects.map((x) => (x.id === o.id ? next : x)) };
        this.changed();
      }
    } else if (this.mode === 'view' && this.moved) {
      this.cam = orbit(this.cam, dx, dy);
      this.last = 'turned';
      this.onChange();
    }
  }

  pointerUp(id: number, px: number, py: number, now = performance.now()): void {
    const had = this.pts.delete(id);
    if (!had) return;
    if (this.mode === 'pinch') {
      if (this.pts.size < 2) {
        this.mode = this.pts.size ? 'none' : 'none';
        this.pinch = null;
      }
      return;
    }
    if (this.mode === 'grab') {
      this.endGrab();
      this.mode = 'none';
      return;
    }
    const d = this.down;
    this.down = null;
    this.mode = 'none';
    if (!d || this.moved || now - d.t > TAP.ms) return;
    this.tap(px, py, d.id);
  }

  pointerCancel(id: number): void {
    this.pts.delete(id);
    this.endGrab(true);
    if (!this.pts.size) this.mode = 'none';
  }

  private endGrab(cancel = false): void {
    if (this.grab && this.base) {
      const was = this.base;
      const now = this.scene;
      if (cancel) this.scene = was;
      else if (now !== was) {
        // the drag changed the scene live; it is one undo step
        this.scene = was;
        this.commit(now, was);
      }
      this.changed();
    }
    this.grab = null;
    this.base = null;
  }

  wheel(deltaY: number): void {
    this.cam = zoom(this.cam, Math.exp(-deltaY * 0.0015));
    this.last = 'zoomed';
    this.onChange();
  }

  private tap(px: number, py: number, hitId: string): void {
    if (this.armed) {
      const g = groundAt(this.cam, px, py, this.size.w, this.size.h);
      if (!g) return;
      const a = this.armed;
      this.armed = null;
      this.place(a.kind, g.x, g.z, a.over ?? {});
      return;
    }
    this.selected = hitId;
    this.last = hitId ? `selected ${hitId}` : 'deselected';
    this.onChange();
  }
}
