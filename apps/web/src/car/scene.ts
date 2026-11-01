/**
 * THE CAR'S STAGE (BRIEF-CAR item 1): the car from its CarSpec on a soft studio floor under a sky, lit like a showroom —
 * studio reflections in the clear coat, a key light and a fill, its soft shadow on the ground — at night the sky darkens
 * and the headlamps, tail lamps and plate lamp light, with pools of light on the ground. Orbit by drag, pinch to zoom, tap
 * a part to name it. Its own three.js renderer (the Studio's lab bench is holographic; a car has to look real), drawn
 * only while it is on screen. A test reads it through `state()` and finds a part on screen with `screenOf()`.
 *
 * THE VIEWS (item 2): BONNET UP opens the bonnet on its hinge over the engine bay (car/bay.ts); WHEEL OFF pulls the
 * nearside front wheel away to show the brake and the suspension behind it (car/wheel.ts); UNDERNEATH lifts the car and
 * looks up at it (car/under.ts). A part can be LIT: it glows and pulses, numbered in the order the fault table ranks it.
 */
import { PARTS, isPart, viewOf, type PartId, type View } from './parts';
import { buildBay } from './bay';
import { buildBody, type Body } from './body';
import { buildUnder } from './under';
import { floorTex, glowTex, makeMats, shadowTex, type Mats } from './kit';
import { shapeWords, type CarSpec } from './spec';
import { loadCarThree, type CarLib, type TMaterial, type TMesh, type TObject3D, type TSprite, type TVector3 } from './three';
import { buildCorner, buildWheel } from './wheel';
import type { TCamera, TControls, TRenderer, TScene } from '../studio/three';

type Controls = TControls & { enablePan: boolean; minPolarAngle: number; maxPolarAngle: number; rotateSpeed: number };

/** Names for what a tap can hit that is not a part with a sheet. */
const LABELS: Record<string, string> = {
  bodywork: 'Bodywork', glass: 'Glass', grille: 'Grille', badge: 'Badge', plate: 'Number plate', handle: 'Door handle', 'roof rail': 'Roof rails', bonnet: 'Bonnet',
  suspension: 'Suspension', brakes: 'Brakes', 'battery pack': 'High-voltage battery',
};

/** Where things stand in a view: the bonnet's angle, how far the wheel is off (0–1), how high the car is lifted (m). */
interface Pose {
  bonnet: number;
  off: number;
  lift: number;
}
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** How high UNDERNEATH lifts the car. */
const LIFT = 1.45;

export function labelOf(id: string, spec?: CarSpec): string {
  if (isPart(id)) return PARTS[id].name;
  if (id === 'bodywork' && spec) return `Bodywork: ${spec.paint.name}`;
  if (id === 'engine_cover' && spec?.electric) return 'Motor (under its cover)';
  return LABELS[id] ?? id;
}

export interface SceneState {
  ready: boolean;
  title: string;
  night: boolean;
  frames: number;
  /** Milliseconds between frames, and to draw one, averaged over the last second or so. */
  frameMs: number;
  drawMs: number;
  picked: string;
  parts: string[];
  error: string;
  view: View;
  /** The lit parts, in their order. */
  lit: string[];
  pose: Pose;
  moving: boolean;
}

export class CarScene {
  readonly host: HTMLElement;
  lib: CarLib | null = null;
  renderer: TRenderer | null = null;
  scene: TScene | null = null;
  camera: TCamera | null = null;
  controls: Controls | null = null;
  spec: CarSpec | null = null;
  error = '';
  night = false;
  /** A part was tapped: its id (or a label's key) and its name. */
  onPick: (id: string, name: string) => void = () => undefined;

  car: TObject3D | null = null;
  body: Body | null = null;
  mats: Mats | null = null;
  private world: TObject3D | null = null;
  private sky: TMesh | null = null;
  private floor: TMesh | null = null;
  private shadow: TMesh | null = null;
  private pools: TObject3D | null = null;
  private lights: { hemi: TObject3D & { intensity: number }; key: TObject3D & { intensity: number }; fill: TObject3D & { intensity: number } } | null = null;
  private raf = 0;
  private running = false;
  private ro: ResizeObserver | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private last = 0;
  private dts: number[] = [];
  private draws: number[] = [];
  private frames = 0;
  private picked = '';
  private tagEl: HTMLElement;
  private initP: Promise<boolean> | null = null;
  view: View = 'car';
  private pose: Pose = { bonnet: 0, off: 0, lift: 0 };
  private move: { from: Pose; to: Pose; cam0: number[]; cam1: number[]; tg0: number[]; tg1: number[]; t0: number; ms: number } | null = null;
  private bay: TObject3D | null = null;
  private under: TObject3D | null = null;
  /** The nearside front wheel, which WHEEL OFF pulls away. */
  private offWheel: TObject3D | null = null;
  private lit: { id: string; swaps: { m: TMesh; orig: TMaterial | TMaterial[]; mat: TMaterial }[]; halo: TSprite | null; pin: HTMLElement; at: TVector3 | null }[] = [];
  private haloTex: unknown = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.tagEl = document.createElement('div');
    this.tagEl.className = 'cartag';
    this.tagEl.hidden = true;
    this.tagEl.setAttribute('aria-live', 'polite');
    host.append(this.tagEl);
  }

  /** three.js and the empty stage. False (with `error`) when this phone cannot draw 3-D. */
  init(): Promise<boolean> {
    if (this.renderer) return Promise.resolve(true);
    this.initP ??= this.build().then((ok) => {
      if (!ok) this.initP = null;
      return ok;
    });
    return this.initP;
  }

  private async build(): Promise<boolean> {
    try {
      this.lib = await loadCarThree();
    } catch (e) {
      this.error = `The 3-D engine did not load: ${(e as Error).message}`;
      return false;
    }
    const L = this.lib;
    const T = L.T;
    let renderer: TRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
    } catch {
      this.error = 'This phone cannot draw 3-D just now (WebGL is off or busy).';
      return false;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.className = 'carcanvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'The car in 3-D');
    this.host.prepend(renderer.domElement);
    this.renderer = renderer;

    const scene = new T.Scene();
    this.scene = scene;
    // showroom reflections for the clear coat, the glass and the chrome
    try {
      const pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new L.RoomEnvironment(), 0.04).texture;
      pm.dispose();
    } catch {
      /* the lights alone */
    }
    scene.fog = new T.Fog(0xdfe6ec, 16, 40);
    const hemi = new T.HemisphereLight(0xe8f1ff, 0x4a443d, 1.1) as TObject3D & { intensity: number };
    const key = new T.DirectionalLight(0xfff6ea, 2.4) as TObject3D & { intensity: number };
    key.position.set(5, 9, 4);
    const fill = new T.DirectionalLight(0xc4d8ff, 0.7) as TObject3D & { intensity: number };
    fill.position.set(-6, 3, -5);
    scene.add(hemi, key, fill);
    this.lights = { hemi, key, fill };

    // the sky: a dome shaded from the horizon up
    const skyG = new T.SphereGeometry(80, 32, 16);
    skyG.setAttribute('color', new T.Float32BufferAttribute(new Array(skyG.getAttribute('position')!.count * 3).fill(1), 3));
    this.sky = new T.Mesh(skyG, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })) as TMesh;
    this.floor = new T.Mesh(new T.CircleGeometry(16, 72), new T.MeshStandardMaterial({ map: floorTex(L), roughness: 0.9, metalness: 0 })) as TMesh;
    this.floor.rotation.x = -Math.PI / 2;
    scene.add(this.sky, this.floor);
    this.world = new T.Group();
    scene.add(this.world);

    const camera = new T.PerspectiveCamera(32, 1, 0.05, 200);
    this.camera = camera;
    const controls = new L.OrbitControls(camera, renderer.domElement) as Controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.3;
    controls.maxDistance = 11;
    controls.maxPolarAngle = 1.5;
    controls.rotateSpeed = 0.8;
    this.controls = controls;

    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    el.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
      this.tap(e.clientX, e.clientY);
    });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.resize();
    this.paintSky();
    return true;
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ the car

  /** Build this car (the one before is freed). */
  async show(spec: CarSpec): Promise<void> {
    if (!(await this.init())) throw new Error(this.error);
    const L = this.lib!;
    const T = L.T;
    this.clearCar();
    this.spec = spec;
    const M = makeMats(L, spec);
    this.mats = M;
    const car = new T.Group();
    car.name = 'car';
    const body = buildBody(L, spec, M);
    this.body = body;
    car.add(body.group);
    for (const w of body.wheels) {
      // each corner's frame: +z outward (mirrored on the nearside), x along the car
      const corner = new T.Group();
      corner.position.set(w.x, spec.dims.tyreR, w.z);
      corner.scale.z = w.side;
      const named = w.front && w.side < 0;
      corner.add(buildCorner(L, spec, M, w.front, named));
      const wheel = buildWheel(L, spec, M);
      corner.add(wheel);
      if (named) this.offWheel = wheel;
      car.add(corner);
    }
    this.bay = buildBay(L, spec, M, body);
    this.under = buildUnder(L, spec, M, body);
    car.add(this.bay, this.under);
    this.world!.add(car);
    this.car = car;
    // its soft shadow, and the pools of light the lamps throw at night
    const d = spec.dims;
    const sh = new T.Mesh(new T.PlaneGeometry(d.length + 0.8, d.width + 0.8), new T.MeshBasicMaterial({ map: shadowTex(L, d.length, d.width, body.wheels.map((w) => [w.x, w.z])), transparent: true, depthWrite: false })) as TMesh;
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.004;
    this.world!.add(sh);
    this.shadow = sh;
    const pools = new T.Group();
    const warm = new T.MeshBasicMaterial({ map: glowTex(L, '255,236,200'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.85 });
    const red = new T.MeshBasicMaterial({ map: glowTex(L, '255,40,30'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.45 });
    for (const z of [0.55, -0.55]) {
      const p = new T.Mesh(new T.PlaneGeometry(3.6, 1.7), warm);
      p.rotation.x = -Math.PI / 2;
      p.position.set(d.length / 2 + 1.7, 0.006, z * d.width * 0.55);
      pools.add(p);
    }
    const back = new T.Mesh(new T.PlaneGeometry(1.2, d.width * 1.1), red);
    back.rotation.x = -Math.PI / 2;
    back.position.set(-d.length / 2 - 0.45, 0.006, 0);
    pools.add(back);
    this.world!.add(pools);
    this.pools = pools;
    this.renderer!.domElement.setAttribute('aria-label', `The car in 3-D: ${spec.title}, a ${shapeWords(spec)}${spec.plate ? `, plate ${spec.plate}` : ''}. Drag to turn it, pinch to zoom, tap a part to name it.`);
    this.setNight(this.night);
    this.view = 'car';
    this.pose = { bonnet: 0, off: 0, lift: 0 };
    this.move = null;
    this.applyPose();
    this.frameCar(true);
    this.limits();
  }

  private clearCar(): void {
    for (const o of [this.car, this.shadow, this.pools]) {
      if (!o) continue;
      o.parent?.remove(o);
      o.traverse((x) => {
        const m = x as TMesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          for (const v of Object.values(mat)) if (v && typeof v === 'object' && 'isTexture' in (v as object)) (v as { dispose(): void }).dispose();
          mat.dispose();
        }
      });
    }
    this.unlight();
    this.car = this.shadow = this.pools = null;
    this.body = null;
    this.bay = this.under = this.offWheel = null;
    this.picked = '';
    this.tagEl.hidden = true;
  }

  // ------------------------------------------------------------------ the views

  /** The pose and the camera for a view: [pose, camera position, the point it looks at]. */
  private shot(v: View): [Pose, number[], number[]] {
    const s = this.spec!;
    const d = s.dims;
    const b = this.body!.bay;
    if (v === 'bay') {
      const tx = (b.front + b.rear) / 2;
      const k = Math.max(1, (b.halfW * 2) / 1.4);
      return [{ bonnet: 1.12, off: 0, lift: 0 }, [tx + 1.45 * k, b.top + 1.25 * k, 0.95 * k], [tx - 0.05, b.floor + (b.top - b.floor) * 0.5, -0.02]];
    }
    if (v === 'wheel') {
      const w = this.body!.wheels.find((x) => x.front && x.side < 0)!;
      // the hub and the wheel off beside it, both in the picture
      return [{ bonnet: 0, off: 1, lift: 0 }, [w.x - 0.5, d.tyreR + 0.72, w.z - 2.15], [w.x + 0.42, d.tyreR - 0.02, w.z - 0.22]];
    }
    if (v === 'under') {
      const dist = this.fitDistance(Math.hypot(d.length / 2, d.width / 2)) * 0.62;
      return [{ bonnet: 0, off: 0, lift: LIFT }, [dist * 0.42, 0.3, dist * 0.42], [0.2, LIFT + d.clearance, 0]];
    }
    const dist = this.fitDistance(Math.hypot(d.length / 2, d.height / 2, d.width / 2)) * 0.9;
    const dir = [0.62, 0.24, 0.75];
    const n = Math.hypot(dir[0]!, dir[1]!, dir[2]!);
    return [{ bonnet: 0, off: 0, lift: 0 }, [(dir[0]! / n) * dist, d.height * 0.4 + (dir[1]! / n) * dist, (dir[2]! / n) * dist], [0, d.height * 0.4, 0]];
  }

  /** Go to a view: the bonnet opens, the wheel comes off or the car rises while the camera moves round. */
  setView(v: View, now = false): void {
    if (!this.spec || !this.camera || !this.controls) return;
    this.view = v;
    const [to, cam, tg] = this.shot(v);
    const c = this.camera.position;
    const t = this.controls.target;
    this.move = { from: { ...this.pose }, to, cam0: [c.x, c.y, c.z], cam1: cam, tg0: [t.x, t.y, t.z], tg1: tg, t0: performance.now(), ms: now ? 0 : 1300 };
    this.controls.enabled = false;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    if (now) this.tick(performance.now());
  }

  /** How far round and down the camera may go in this view. */
  private limits(): void {
    const c = this.controls;
    if (!c) return;
    c.minPolarAngle = this.view === 'under' ? 1.62 : 0.05;
    c.maxPolarAngle = this.view === 'under' ? 2.95 : 1.5;
    c.minDistance = this.view === 'car' || this.view === 'under' ? 1.3 : 0.7;
  }

  /** Put the bonnet, the wheel and the lift where the pose says; show only what can be seen. */
  private applyPose(): void {
    const p = this.pose;
    if (this.body) this.body.bonnet.rotation.z = p.bonnet;
    if (this.offWheel) {
      // out from the hub, forward along the car and turned so its tread faces the camera
      this.offWheel.position.set(0.95 * p.off, -0.01 * p.off, 0.42 * p.off);
      this.offWheel.rotation.y = -1.15 * p.off;
    }
    if (this.car) this.car.position.y = p.lift;
    if (this.bay) this.bay.visible = p.bonnet > 0.01 || this.view === 'bay';
    if (this.under) this.under.visible = p.lift > 0.01 || this.view === 'under';
    if (this.shadow) (this.shadow.material as TMaterial).opacity = Math.max(0.15, 1 - p.lift / LIFT);
  }

  /** How far away the camera must be for a sphere of radius r to fill the view. */
  fitDistance(r: number): number {
    const c = this.camera!;
    const v = ((c.fov / 2) * Math.PI) / 180;
    const hz = Math.atan(Math.tan(v) * c.aspect);
    return r / Math.sin(Math.min(v, hz));
  }

  /** The three-quarter view from the front, the driver's side, the whole car in the picture. */
  frameCar(now = false): void {
    if (!this.spec || !this.camera || !this.controls) return;
    const d = this.spec.dims;
    const dist = this.fitDistance(Math.hypot(d.length / 2, d.height / 2, d.width / 2)) * 0.9;
    const dir = [0.62, 0.24, 0.75];
    const n = Math.hypot(dir[0]!, dir[1]!, dir[2]!);
    this.controls.target.set(0, d.height * 0.4, 0);
    this.camera.position.set((dir[0]! / n) * dist, d.height * 0.4 + (dir[1]! / n) * dist, (dir[2]! / n) * dist);
    if (now) this.controls.update();
  }

  /** Swing the camera round the car about its middle. */
  turn(deg: number): void {
    if (!this.camera || !this.controls) return;
    const t = this.controls.target;
    const dx = this.camera.position.x - t.x;
    const dz = this.camera.position.z - t.z;
    const a = (deg * Math.PI) / 180;
    this.camera.position.set(t.x + dx * Math.cos(a) - dz * Math.sin(a), this.camera.position.y, t.z + dx * Math.sin(a) + dz * Math.cos(a));
    this.controls.update();
  }

  // ------------------------------------------------------------------ day and night

  setNight(on: boolean): void {
    this.night = on;
    if (!this.scene || !this.lights) return;
    const sc = this.scene as TScene & { environmentIntensity: number; fog: { color: { setHex(h: number): void } } | null };
    sc.environmentIntensity = on ? 0.22 : 1;
    this.lights.hemi.intensity = on ? 0.18 : 1.1;
    this.lights.key.intensity = on ? 0.25 : 2.4;
    this.lights.fill.intensity = on ? 0.35 : 0.7;
    sc.fog?.color.setHex(on ? 0x0d121b : 0xdfe6ec);
    (this.floor?.material as TMaterial | undefined)?.color?.setHex(on ? 0x4a4f57 : 0xffffff);
    if (this.pools) this.pools.visible = on;
    const b = this.body;
    if (b) {
      b.lights.head.emissiveIntensity = on ? 2.4 : 0;
      b.lights.tail.emissiveIntensity = on ? 1.5 : 0.12;
      b.lights.brake.emissiveIntensity = on ? 1.2 : 0.12;
      b.lights.plate.emissiveIntensity = on ? 1.4 : 0;
    }
    this.paintSky();
  }

  private paintSky(): void {
    const g = this.sky?.geometry;
    if (!g) return;
    const pos = g.getAttribute('position')!;
    const col = g.getAttribute('color')! as unknown as { array: Float32Array; needsUpdate: boolean };
    // linear colours; the horizon is the fog's, so the floor's edge melts into it
    const [top, mid, low] = this.night ? [[0.003, 0.005, 0.012], [0.006, 0.008, 0.016], [0.004, 0.006, 0.011]] : [[0.3, 0.5, 0.8], [0.6, 0.72, 0.86], [0.737, 0.791, 0.831]];
    for (let i = 0; i < pos.count; i++) {
      const hgt = pos.getY(i) / 80;
      const [a, b, t] = hgt <= 0 ? [low!, low!, 0] : hgt < 0.25 ? [low!, mid!, hgt / 0.25] : [mid!, top!, Math.min(1, (hgt - 0.25) / 0.5)];
      for (let c = 0; c < 3; c++) col.array[i * 3 + c] = a[c]! + (b[c]! - a[c]!) * t;
    }
    col.needsUpdate = true;
  }

  // ------------------------------------------------------------------ drawing

  start(): void {
    if (this.running || !this.renderer) return;
    this.running = true;
    this.last = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      this.step(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Each frame: the tweens, the glow, the labels, then the picture. */
  protected step(now: number): void {
    if (this.last) {
      this.dts.push(now - this.last);
      if (this.dts.length > 60) this.dts.shift();
    }
    this.last = now;
    this.tick(now);
    this.controls?.update();
    const t0 = performance.now();
    this.renderer!.render(this.scene!, this.camera!);
    this.draws.push(performance.now() - t0);
    if (this.draws.length > 60) this.draws.shift();
    this.frames++;
    this.placeTag();
  }

  /** What moves on its own each frame: the view's move, the glow's pulse. */
  protected tick(now: number): void {
    const m = this.move;
    if (m && this.camera && this.controls) {
      const k = m.ms ? Math.min(1, (now - m.t0) / m.ms) : 1;
      const e = ease(k);
      const mix = (a: number, b: number) => a + (b - a) * e;
      this.pose = { bonnet: mix(m.from.bonnet, m.to.bonnet), off: mix(m.from.off, m.to.off), lift: mix(m.from.lift, m.to.lift) };
      this.camera.position.set(mix(m.cam0[0]!, m.cam1[0]!), mix(m.cam0[1]!, m.cam1[1]!), mix(m.cam0[2]!, m.cam1[2]!));
      this.controls.target.set(mix(m.tg0[0]!, m.tg1[0]!), mix(m.tg0[1]!, m.tg1[1]!), mix(m.tg0[2]!, m.tg1[2]!));
      this.applyPose();
      if (k >= 1) {
        this.move = null;
        this.controls.enabled = true;
        this.limits();
        // the parts lit before the view changed sit somewhere new
        for (const l of this.lit) l.at = this.centreOf(l.id);
      }
    }
    if (this.lit.length) {
      const k = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2 * 0.9);
      for (const l of this.lit) {
        for (const s of l.swaps) s.mat.emissiveIntensity = 0.35 + 1.1 * k;
        if (l.halo) l.halo.material.opacity = 0.18 + 0.4 * k;
      }
    }
  }

  // ------------------------------------------------------------------ the lit parts

  /** Light these parts, in order (the most likely first): each glows and pulses, a numbered pin on it. */
  light(ids: string[]): void {
    this.unlight();
    if (!this.car || !this.lib) return;
    const T = this.lib.T;
    const glow = 0xff8a1a;
    this.haloTex ??= (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,170,60,1)');
      r.addColorStop(1, 'rgba(255,140,30,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
      return new T.CanvasTexture(c);
    })();
    ids.forEach((id, i) => {
      const swaps: { m: TMesh; orig: TMaterial | TMaterial[]; mat: TMaterial }[] = [];
      this.car!.traverse((o) => {
        const m = o as TMesh;
        if (!m.isMesh || o.userData.part !== id) return;
        const base = Array.isArray(m.material) ? m.material[0]! : m.material;
        const mat = base.clone();
        mat.emissive?.setHex(glow);
        mat.emissiveIntensity = 1;
        if ('emissiveMap' in mat) (mat as TMaterial & { emissiveMap: unknown }).emissiveMap = null;
        swaps.push({ m, orig: m.material, mat });
        m.material = mat;
      });
      // the plugs are under the engine's cover: it turns see-through
      if (id === 'coils') {
        this.car!.traverse((o) => {
          if (!o.userData.cover || !(o as TMesh).isMesh) return;
          const m = o as TMesh;
          const mat = (Array.isArray(m.material) ? m.material[0]! : m.material).clone();
          mat.transparent = true;
          mat.opacity = 0.22;
          swaps.push({ m, orig: m.material, mat });
          m.material = mat;
        });
      }
      const at = this.centreOf(id);
      let halo: TSprite | null = null;
      if (at) {
        halo = new T.Sprite(new T.SpriteMaterial({ map: this.haloTex, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, opacity: 0.4 }));
        halo.scale.set(0.34, 0.34, 0.34);
        this.world!.attach(halo);
        halo.position.copy(at);
        halo.renderOrder = 10;
      }
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'carpin';
      pin.textContent = String(i + 1);
      pin.setAttribute('aria-label', `${i + 1}: ${labelOf(id, this.spec ?? undefined)}`);
      pin.addEventListener('click', () => this.pick(id));
      this.host.append(pin);
      this.lit.push({ id, swaps, halo, pin, at });
    });
  }

  unlight(): void {
    for (const l of this.lit) {
      for (const s of l.swaps) {
        s.m.material = s.orig;
        s.mat.dispose();
      }
      l.halo?.parent?.remove(l.halo);
      l.halo?.material.dispose();
      l.pin.remove();
    }
    this.lit = [];
  }

  /** Draw one frame now (a test's snapshot, the Lens guide's picture). */
  drawNow(): void {
    if (this.renderer && this.scene && this.camera) {
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ------------------------------------------------------------------ tapping a part

  private hitAt(cx: number, cy: number): { id: string; point: TVector3 } | null {
    if (!this.lib || !this.camera || !this.car) return null;
    const T = this.lib.T;
    const r = this.renderer!.domElement.getBoundingClientRect();
    const v = new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster();
    ray.setFromCamera(v, this.camera);
    for (const hit of ray.intersectObjects([this.car], true)) {
      let o: TObject3D | null = hit.object;
      if (!visibleUp(o)) continue;
      while (o && !o.userData.part) o = o.parent;
      if (o) return { id: String(o.userData.part), point: hit.point };
    }
    return null;
  }

  private tagAt: TVector3 | null = null;

  private tap(cx: number, cy: number): void {
    const hit = this.hitAt(cx, cy);
    if (!hit) {
      this.picked = '';
      this.tagEl.hidden = true;
      return;
    }
    this.pick(hit.id, hit.point);
  }

  /** Name a part (a tap, or the list): its tag on the car, and whoever listens hears it. */
  pick(id: string, at?: TVector3): void {
    this.picked = id;
    const name = labelOf(id, this.spec ?? undefined);
    this.tagEl.textContent = name;
    this.tagEl.hidden = false;
    this.tagAt = at ?? this.centreOf(id);
    this.onPick(id, name);
  }

  private placeTag(): void {
    const placed: { x: number; y: number }[] = [];
    for (const l of this.lit) {
      // follow the part while it moves with the view
      if (this.move || this.pose.lift) l.at = this.centreOf(l.id) ?? l.at;
      if (l.halo && l.at) l.halo.position.copy(l.at);
      const p = l.at ? this.project(l.at) : null;
      l.pin.hidden = !p;
      if (!p) continue;
      // parts close together (the pads inside the caliper): their pins step aside, so each can be tapped
      let tries = 0;
      while (tries++ < 6 && placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 34)) p.x += 34;
      placed.push(p);
      l.pin.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%)`;
    }
    if (this.tagEl.hidden || !this.tagAt) return;
    const p = this.project(this.tagAt);
    if (!p) return;
    this.tagEl.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -130%)`;
  }

  /** Where a world point is on the canvas (CSS pixels from its top left), or null behind the camera. */
  project(v: TVector3): { x: number; y: number } | null {
    if (!this.camera || !this.renderer) return null;
    const q = v.clone() as TVector3 & { project(c: TCamera): TVector3 };
    q.project(this.camera);
    if (q.z > 1) return null;
    const r = this.renderer.domElement;
    return { x: ((q.x + 1) / 2) * r.clientWidth, y: ((1 - q.y) / 2) * r.clientHeight };
  }

  /** The middle of a part's visible objects, in the world. */
  centreOf(id: string): TVector3 | null {
    if (!this.lib || !this.car) return null;
    const T = this.lib.T;
    const box = new T.Box3();
    let found = false;
    this.car.updateMatrixWorld(true);
    this.car.traverse((o) => {
      if (o.userData.part !== id || !(o as TMesh).isMesh || !visibleUp(o)) return;
      const b = new T.Box3().setFromObject(o);
      if (!b.isEmpty()) {
        box.union(b);
        found = true;
      }
    });
    return found ? box.getCenter(new T.Vector3()) : null;
  }

  /** A part's place on screen, in page coordinates (a test taps it there). */
  screenOf(id: string): { x: number; y: number } | null {
    const c = this.centreOf(id);
    if (!c || !this.renderer) return null;
    this.drawNow();
    const p = this.project(c);
    if (!p) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }

  /** Every part id the car carries (what a tap can name). */
  partIds(): string[] {
    const out = new Set<string>();
    this.car?.traverse((o) => o.userData.part && out.add(String(o.userData.part)));
    return [...out].sort();
  }

  state(): SceneState {
    const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    return {
      ready: !!this.car,
      title: this.spec?.title ?? '',
      night: this.night,
      frames: this.frames,
      frameMs: +avg(this.dts).toFixed(1),
      drawMs: +avg(this.draws).toFixed(1),
      picked: this.picked,
      parts: this.partIds(),
      error: this.error,
      view: this.view,
      lit: this.lit.map((l) => l.id),
      pose: { ...this.pose },
      moving: !!this.move,
    };
  }

  dispose(): void {
    this.stop();
    this.clearCar();
    this.ro?.disconnect();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.initP = null;
  }
}

/** Shown, and every parent shown. */
function visibleUp(o: TObject3D | null): boolean {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

export type { PartId };
