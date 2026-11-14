/**
 * GAME STUDIO 3D, the runtime (APPS ROUND, MAKE): a game from model.ts drawn by the app's own three.js and moved by its vendored
 * Rapier physics (engine3d/physics.ts loads it, once, on the first PLAY). The player is a real rigid body: it runs, jumps, rolls
 * (the marble turns with the ground), drives or flies; crates are pushed and tip; platforms and enemies move on their paths;
 * ramps, bumpers, bounce and friction are each object's own. The rules (model.ts `react`) decide scoring, opening, winning and
 * losing. A ghost of the last run is drawn as it went.
 *
 * Responsive under software rendering (CI draws WebGL on the CPU): physics and rules step on a fixed clock, at most four steps a
 * frame; input is read from DOM events, never from the frame loop, so no tap is lost; and the frame-rate guard lowers the drawing
 * resolution, step by step, as soon as a frame takes longer than 40 ms, before frames are dropped. Nothing leaves the phone.
 */
import { loadThree, type TCamera, type TMesh, type TObject3D, type TRenderer, type TScene } from '../studio/three';
import { loadRapier } from '../engine3d/physics';
import { locked, PALETTE, PASS_THROUGH, react, startState, type Game3D, type GameEvent, type PlayState, type Thing } from './model';

interface V3 { x: number; y: number; z: number }
interface Body {
  translation(): V3;
  rotation(): { x: number; y: number; z: number; w: number };
  linvel(): V3;
  setLinvel(v: V3, wake: boolean): void;
  setTranslation(v: V3, wake: boolean): void;
  setNextKinematicTranslation(v: V3): void;
  setAngvel(v: V3, wake: boolean): void;
}
interface BodyDesc {
  setTranslation(x: number, y: number, z: number): BodyDesc;
  enabledRotations(x: boolean, y: boolean, z: boolean): BodyDesc;
  setCcdEnabled(on: boolean): BodyDesc;
  setLinearDamping(d: number): BodyDesc;
  setAngularDamping(d: number): BodyDesc;
}
interface ColDesc {
  setFriction(f: number): ColDesc;
  setRestitution(r: number): ColDesc;
  setRotation(q: { x: number; y: number; z: number; w: number }): ColDesc;
  setDensity(d: number): ColDesc;
}
interface World {
  timestep: number;
  step(): void;
  createRigidBody(d: BodyDesc): Body;
  createCollider(d: ColDesc, b?: Body): unknown;
  removeRigidBody(b: Body): void;
  free(): void;
}
interface Rap {
  World: new (g: V3) => World;
  RigidBodyDesc: { dynamic(): BodyDesc; fixed(): BodyDesc; kinematicPositionBased(): BodyDesc };
  ColliderDesc: { cuboid(x: number, y: number, z: number): ColDesc; ball(r: number): ColDesc };
}

export interface Input {
  /** The stick, -1..1 each way (y: forward). */
  sx: number;
  sy: number;
  jump: boolean;
  fire: boolean;
  /** Look turn (first person), radians to apply. */
  look: number;
}

/** What a run shows, for the screen and the specs (window.__ghosty.game3d.run). */
export interface RunInfo {
  mode: 'loading' | 'play' | 'stopped' | 'error';
  error: string;
  frames: number;
  steps: number;
  /** Frames a second, over the last second. */
  fps: number;
  /** The drawing resolution the guard settled on. */
  pixelRatio: number;
  player: V3;
  state: PlayState | null;
  ghost: number;
}

const STEP = 1 / 60;
const MAX_STEPS = 4;
const R_PLAYER = 0.4;

export class Run {
  info: RunInfo = { mode: 'loading', error: '', frames: 0, steps: 0, fps: 0, pixelRatio: 1, player: { x: 0, y: 0, z: 0 }, state: null, ghost: 0 };
  input: Input = { sx: 0, sy: 0, jump: false, fire: false, look: 0 };
  onChange: (s: PlayState) => void = () => undefined;
  private renderer: TRenderer | null = null;
  private scene: TScene | null = null;
  private camera: TCamera | null = null;
  private world: World | null = null;
  private R: Rap | null = null;
  private player: Body | null = null;
  private playerMesh: TObject3D | null = null;
  private ghostMesh: TObject3D | null = null;
  private meshes = new Map<string, TObject3D>();
  private bodies = new Map<string, Body>();
  private bullets: { m: TObject3D; x: number; z: number; dx: number; dz: number; life: number }[] = [];
  private raf = 0;
  private last = 0;
  private acc = 0;
  private t = 0;
  private heading = 0;
  private speed = 0;
  private grounded = 0;
  private jumpHeld = false;
  private fireCool = 0;
  private state: PlayState;
  private path: V3[] = [];
  private ghost: V3[];
  private ro: ResizeObserver | null = null;
  private fpsT = 0;
  private fpsN = 0;
  private slow = 0;
  private T: Awaited<ReturnType<typeof loadThree>>['THREE'] | null = null;

  constructor(private host: HTMLElement, private g: Game3D, ghost: V3[] = []) {
    this.state = startState(g);
    this.ghost = ghost;
  }

  /** The path the player took this run (sampled ten times a second), for the next run's ghost. */
  get trail(): V3[] {
    return this.path;
  }

  async start(): Promise<boolean> {
    try {
      const [lib, R] = await Promise.all([loadThree(), loadRapier() as unknown as Promise<Rap>]);
      this.T = lib.THREE;
      this.R = R;
    } catch {
      this.info.mode = 'error';
      this.info.error = 'I couldn’t load the 3-D engine just now. Try PLAY again.';
      return false;
    }
    const T = this.T!;
    let r: TRenderer;
    try {
      r = new T.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
    } catch {
      this.info.mode = 'error';
      this.info.error = 'This phone can’t draw 3-D just now (WebGL is off or busy). Close other apps and try PLAY again.';
      return false;
    }
    this.info.pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    r.setPixelRatio(this.info.pixelRatio);
    r.outputColorSpace = T.SRGBColorSpace;
    r.domElement.className = 'gs3canvas';
    r.domElement.setAttribute('role', 'img');
    r.domElement.setAttribute('aria-label', `${this.g.name}, playing in 3-D`);
    this.host.prepend(r.domElement);
    this.renderer = r;
    const scene = new T.Scene();
    scene.background = new T.Color(this.g.sky) as unknown as never;
    if (this.g.fog > 0) (scene as unknown as { fog: unknown }).fog = new T.FogExp2(this.g.sky, this.g.fog);
    scene.add(new T.HemisphereLight(0xffffff, 0x404850, 1.4));
    const sun = new T.DirectionalLight(0xffffff, Math.max(0.3, Math.min(2.5, this.g.light ?? 1.5)));
    sun.position.set(6, 12, 4);
    scene.add(sun);
    this.scene = scene;
    this.camera = new T.PerspectiveCamera(this.g.camera === 'first' ? 75 : 60, 1, 0.05, 300);
    this.build();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.resize();
    this.info.mode = 'play';
    this.event({ e: 'start' });
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    return true;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.world?.free();
    this.world = null;
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    if (this.info.mode !== 'error') this.info.mode = 'stopped';
  }

  /** For the specs and the editor's TEST FROM HERE: the player put at a point (or beside the first thing of a kind). */
  teleport(to: V3): void {
    this.player?.setTranslation(to, true);
    this.player?.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  private mat(c: number, over: Record<string, unknown> = {}) {
    return new this.T!.MeshStandardMaterial({ color: PALETTE[c] ?? PALETTE[7], roughness: 0.7, metalness: 0.05, ...over });
  }

  private build(): void {
    const T = this.T!;
    const R = this.R!;
    const world = new R.World({ x: 0, y: -this.g.gravity, z: 0 });
    world.timestep = STEP;
    this.world = world;
    for (const th of this.g.things) {
      const geo = th.kind === 'coin' ? new T.CylinderGeometry(th.w / 2, th.w / 2, 0.12, 16) : th.kind === 'gem' ? new T.SphereGeometry(th.w / 2, 8, 6) : th.kind === 'bumper' ? new T.CylinderGeometry(th.w / 2, th.w / 2, th.h, 16) : new T.BoxGeometry(th.w, th.h, th.d);
      const glow = th.kind === 'coin' || th.kind === 'gem' || th.kind === 'goal' || th.kind === 'pad' || th.kind === 'switch';
      const m = new T.Mesh(geo, this.mat(th.c, glow ? { emissive: PALETTE[th.c], emissiveIntensity: 0.45 } : th.kind === 'goal' ? { transparent: true, opacity: 0.6 } : {})) as TMesh;
      m.position.set(th.x, th.y, th.z);
      if (th.kind === 'coin') m.rotation.x = Math.PI / 2;
      if (th.tilt) m.rotation.x = (-th.tilt * Math.PI) / 180;
      this.scene!.add(m);
      this.meshes.set(th.id, m);
      if (PASS_THROUGH.has(th.kind)) continue;
      const desc = th.body === 'dynamic' ? R.RigidBodyDesc.dynamic() : th.body === 'moving' ? R.RigidBodyDesc.kinematicPositionBased() : R.RigidBodyDesc.fixed();
      desc.setTranslation(th.x, th.y, th.z);
      if (th.body === 'dynamic') desc.setLinearDamping(0.6).setAngularDamping(0.8);
      const b = world.createRigidBody(desc);
      const col = (th.kind === 'bumper' ? R.ColliderDesc.ball(th.w / 2) : R.ColliderDesc.cuboid(th.w / 2, th.h / 2, th.d / 2)).setFriction(th.friction).setRestitution(th.bounce);
      if (th.tilt) {
        const a = (-th.tilt * Math.PI) / 360;
        col.setRotation({ x: Math.sin(a), y: 0, z: 0, w: Math.cos(a) });
      }
      world.createCollider(col, b);
      this.bodies.set(th.id, b);
    }
    // the player: a ball for the marble (it rolls), an upright capsule-like ball for the rest, a low box for the kart
    const sp = this.g.spawn;
    const marble = this.g.kind === 'marble';
    const pd = R.RigidBodyDesc.dynamic().setTranslation(sp.x, sp.y, sp.z).setCcdEnabled(true).setLinearDamping(marble ? 0.2 : 0.05);
    if (!marble) pd.enabledRotations(false, false, false);
    this.player = world.createRigidBody(pd);
    world.createCollider(R.ColliderDesc.ball(R_PLAYER).setFriction(marble ? 1 : 0.2).setRestitution(marble ? 0.3 : 0).setDensity(1), this.player);
    const pm = this.g.kind === 'kart'
      ? new T.Mesh(new T.BoxGeometry(0.9, 0.45, 1.4), this.mat(3))
      : this.g.kind === 'shooter'
        ? new T.Mesh(new T.CylinderGeometry(0, 0.45, 1, 3), this.mat(0))
        : new T.Mesh(new T.SphereGeometry(R_PLAYER, 20, 14), this.mat(marble ? 6 : 0));
    if (this.g.camera !== 'first') this.scene!.add(pm);
    this.playerMesh = pm;
    if (this.ghost.length > 1) {
      const gm = new T.Mesh(new T.SphereGeometry(R_PLAYER, 12, 8), this.mat(6, { transparent: true, opacity: 0.3 }));
      this.scene!.add(gm);
      this.ghostMesh = gm;
      this.info.ghost = this.ghost.length;
    }
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private event(ev: GameEvent): void {
    const before = this.state;
    this.state = react(this.g, this.state, ev);
    this.info.state = this.state;
    if (this.state.respawn) {
      this.teleport(this.g.spawn);
      this.heading = 0;
      this.speed = 0;
    }
    for (const id of this.state.gone) {
      if (before.gone.has(id)) continue;
      const m = this.meshes.get(id);
      if (m) m.visible = false;
      const b = this.bodies.get(id);
      if (b && this.world) {
        this.world.removeRigidBody(b);
        this.bodies.delete(id);
      }
    }
    if (this.state !== before) this.onChange(this.state);
  }

  private frame(now: number): void {
    if (!this.renderer) return;
    const ms = Math.min(250, now - this.last);
    this.last = now;
    this.info.frames++;
    this.fpsN++;
    this.fpsT += ms;
    if (this.fpsT >= 1000) {
      this.info.fps = Math.round((this.fpsN * 1000) / this.fpsT);
      this.fpsN = 0;
      this.fpsT = 0;
    }
    // the frame-rate guard: two slow frames in a row lower the resolution a step (to a floor of 0.5) before frames are dropped
    this.slow = ms > 40 ? this.slow + 1 : 0;
    if (this.slow >= 2 && this.info.pixelRatio > 0.5) {
      this.info.pixelRatio = Math.max(0.5, Math.round((this.info.pixelRatio - 0.25) * 100) / 100);
      this.renderer.setPixelRatio(this.info.pixelRatio);
      this.resize();
      this.slow = 0;
    }
    this.acc += ms / 1000;
    let n = 0;
    while (this.acc >= STEP && n < MAX_STEPS) {
      this.step();
      this.acc -= STEP;
      n++;
    }
    if (n === MAX_STEPS) this.acc = 0;
    this.draw();
    if (this.info.mode === 'play') this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private step(): void {
    const w = this.world;
    const p = this.player;
    if (!w || !p) return;
    this.info.steps++;
    this.t += STEP;
    const over = !!this.state.over;
    const I = this.input;
    const v = p.linvel();
    const pos = p.translation();
    // moving platforms and enemies along their paths
    for (const th of this.g.things) {
      if (!th.move || this.state.gone.has(th.id)) continue;
      const off = Math.sin((this.t * th.move.speed) / Math.max(0.5, th.move.range)) * th.move.range;
      const at = { x: th.x + (th.move.axis === 'x' ? off : 0), y: th.y + (th.move.axis === 'y' ? off : 0), z: th.z + (th.move.axis === 'z' ? off : 0) };
      this.bodies.get(th.id)?.setNextKinematicTranslation(at);
    }
    if (!over) {
      const k = this.g.kind;
      if (k === 'kart') {
        this.heading -= I.sx * 2.2 * STEP * Math.min(1, Math.abs(this.speed) / 3 + 0.3);
        this.speed += (I.sy * 14 - this.speed * 0.9) * STEP;
        p.setLinvel({ x: Math.sin(this.heading) * this.speed, y: v.y, z: Math.cos(this.heading) * this.speed }, true);
      } else if (k === 'marble') {
        // the stick tips the marble: a push along the ground, and it rolls by its own friction
        p.setLinvel({ x: v.x + I.sx * 9 * STEP, y: v.y, z: v.z + I.sy * 9 * STEP }, true);
      } else {
        if (k === 'explorer') this.heading -= I.look;
        I.look = 0;
        const sp = k === 'shooter' ? 6 : 5;
        const fx = k === 'explorer' ? Math.sin(this.heading) * I.sy + Math.cos(this.heading) * -I.sx * -1 : I.sx;
        const fz = k === 'explorer' ? Math.cos(this.heading) * I.sy - Math.sin(this.heading) * I.sx : I.sy;
        if (k !== 'explorer' && (I.sx || I.sy)) this.heading = Math.atan2(I.sx, I.sy);
        let vy = v.y;
        // on the ground when it is barely moving up or down for a few steps
        this.grounded = Math.abs(v.y) < 0.08 ? this.grounded + 1 : 0;
        if (I.jump && !this.jumpHeld && this.grounded >= 2 && k !== 'shooter') vy = 6.2;
        this.jumpHeld = I.jump;
        p.setLinvel({ x: fx * sp, y: vy, z: fz * sp }, true);
      }
      if (k === 'shooter') {
        this.fireCool -= STEP;
        if (I.fire && this.fireCool <= 0) {
          this.fireCool = 0.25;
          const m = new this.T!.Mesh(new this.T!.SphereGeometry(0.15, 8, 6), this.mat(1, { emissive: PALETTE[1], emissiveIntensity: 1 }));
          this.scene!.add(m);
          this.bullets.push({ m, x: pos.x, z: pos.z, dx: Math.sin(this.heading) * 14, dz: Math.cos(this.heading) * 14, life: 1.2 });
        }
      }
    } else p.setLinvel({ x: 0, y: v.y, z: 0 }, true);
    w.step();
    const now = p.translation();
    this.info.player = { x: now.x, y: now.y, z: now.z };
    if (Math.round(this.t * 10) !== Math.round((this.t - STEP) * 10)) this.path.push({ x: now.x, y: now.y, z: now.z });
    if (this.state.over) return;
    // touches: the player's ball against each thing's box (a little give)
    for (const th of this.g.things) {
      if (this.state.gone.has(th.id)) continue;
      const tp = this.bodies.get(th.id)?.translation() ?? th;
      const hit = Math.abs(now.x - tp.x) <= th.w / 2 + R_PLAYER + 0.05 && Math.abs(now.y - tp.y) <= th.h / 2 + R_PLAYER + 0.05 && Math.abs(now.z - tp.z) <= th.d / 2 + R_PLAYER + 0.05;
      if (hit && (PASS_THROUGH.has(th.kind) || th.kind === 'enemy' || th.kind === 'door' || th.kind === 'bumper')) this.event({ e: 'touch', thing: th });
    }
    // a crate resting on a pad covers it
    for (const pad of this.g.things.filter((t) => t.kind === 'pad' && !this.state.gone.has(t.id))) {
      for (const cr of this.g.things.filter((t) => t.kind === 'crate')) {
        const c = this.bodies.get(cr.id)?.translation();
        if (c && Math.abs(c.x - pad.x) < pad.w / 2 && Math.abs(c.z - pad.z) < pad.d / 2 && c.y < pad.y + cr.h) this.event({ e: 'cover', thing: pad });
      }
    }
    // bullets
    for (const b of this.bullets) {
      b.x += b.dx * STEP;
      b.z += b.dz * STEP;
      b.life -= STEP;
      for (const th of this.g.things) {
        if (th.kind !== 'enemy' || this.state.gone.has(th.id)) continue;
        const tp = this.bodies.get(th.id)?.translation() ?? th;
        if (Math.hypot(b.x - tp.x, b.z - tp.z) < th.w / 2 + 0.2) {
          b.life = 0;
          this.event({ e: 'shot', thing: th });
        }
      }
    }
    for (const b of this.bullets.filter((x) => x.life <= 0)) this.scene?.remove(b.m);
    this.bullets = this.bullets.filter((x) => x.life > 0);
    if (now.y < -8) this.event({ e: 'fall' });
    if (Math.round(this.t * 4) !== Math.round((this.t - STEP) * 4)) this.event({ e: 'tick', dt: 0.25 });
  }

  private draw(): void {
    const r = this.renderer;
    const cam = this.camera;
    const p = this.player;
    if (!r || !cam || !p || !this.scene) return;
    const at = p.translation();
    const q = p.rotation();
    this.playerMesh?.position.set(at.x, at.y, at.z);
    if (this.g.kind === 'marble') (this.playerMesh as unknown as { quaternion: { set(x: number, y: number, z: number, w: number): void } }).quaternion.set(q.x, q.y, q.z, q.w);
    else if (this.playerMesh) this.playerMesh.rotation.y = this.heading;
    for (const th of this.g.things) {
      const m = this.meshes.get(th.id);
      if (!m) continue;
      const b = this.bodies.get(th.id);
      if (b && th.body !== 'fixed') {
        const t = b.translation();
        m.position.set(t.x, t.y, t.z);
        if (th.body === 'dynamic') {
          const rq = b.rotation();
          (m as unknown as { quaternion: { set(x: number, y: number, z: number, w: number): void } }).quaternion.set(rq.x, rq.y, rq.z, rq.w);
        }
      }
      if (th.kind === 'coin' || th.kind === 'gem') m.rotation.y = this.t * 2;
      // a locked goal is dim until a rule opens it
      if (th.kind === 'goal') m.visible = !locked(this.g, 'goal') || this.state.open.has('goal');
    }
    for (const b of this.bullets) b.m.position.set(b.x, 0.6, b.z);
    if (this.ghostMesh && this.ghost.length) {
      const g = this.ghost[Math.min(this.ghost.length - 1, Math.floor(this.t * 10))]!;
      this.ghostMesh.position.set(g.x, g.y, g.z);
    }
    const c = this.g.camera;
    if (c === 'first') {
      cam.position.set(at.x, at.y + 0.6, at.z);
      cam.lookAt(at.x + Math.sin(this.heading) * 5, at.y + 0.5, at.z + Math.cos(this.heading) * 5);
    } else if (c === 'top') {
      cam.position.set(at.x, at.y + 16, at.z - 6);
      cam.lookAt(at.x, at.y, at.z + 1);
    } else if (c === 'chase') {
      cam.position.set(at.x - Math.sin(this.heading) * 6, at.y + 3, at.z - Math.cos(this.heading) * 6);
      cam.lookAt(at.x, at.y + 0.5, at.z);
    } else {
      cam.position.set(at.x, at.y + 4.5, at.z - 7.5);
      cam.lookAt(at.x, at.y + 0.5, at.z + 2);
    }
    r.render(this.scene, cam);
  }
}
