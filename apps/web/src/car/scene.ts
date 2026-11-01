/**
 * THE CAR'S STAGE (BRIEF-CAR item 1): the car from its CarSpec on a soft studio floor under a sky, lit like a showroom —
 * studio reflections in the clear coat, a key light and a fill, its soft shadow on the ground — at night the sky darkens
 * and the headlamps, tail lamps and plate lamp light, with pools of light on the ground. Orbit by drag, pinch to zoom, tap
 * a part to name it. Its own three.js renderer (the Studio's lab bench is holographic; a car has to look real), drawn
 * only while it is on screen. A test reads it through `state()` and finds a part on screen with `screenOf()`.
 */
import { PARTS, isPart, type PartId } from './parts';
import { buildBody, type Body } from './body';
import { floorTex, glowTex, makeMats, shadowTex, type Mats } from './kit';
import { shapeWords, type CarSpec } from './spec';
import { loadCarThree, type CarLib, type TMaterial, type TMesh, type TObject3D, type TVector3 } from './three';
import { buildWheel } from './wheel';
import type { TCamera, TControls, TRenderer, TScene } from '../studio/three';

type Controls = TControls & { enablePan: boolean; minPolarAngle: number; maxPolarAngle: number; rotateSpeed: number };

/** Names for what a tap can hit that is not a part with a sheet. */
const LABELS: Record<string, string> = {
  bodywork: 'Bodywork', glass: 'Glass', grille: 'Grille', badge: 'Badge', plate: 'Number plate', handle: 'Door handle', 'roof rail': 'Roof rails', bonnet: 'Bonnet',
};

export function labelOf(id: string, spec?: CarSpec): string {
  if (isPart(id)) return PARTS[id].name;
  if (id === 'bodywork' && spec) return `Bodywork: ${spec.paint.name}`;
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
      const corner = new T.Group();
      corner.position.set(w.x, spec.dims.tyreR, w.z);
      if (w.side < 0) corner.rotation.y = Math.PI;
      const wheel = buildWheel(L, spec, M);
      corner.add(wheel);
      corner.userData.corner = `${w.front ? 'front' : 'rear'}${w.side > 0 ? 'R' : 'L'}`;
      car.add(corner);
    }
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
    this.frameCar(true);
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
    this.car = this.shadow = this.pools = null;
    this.body = null;
    this.picked = '';
    this.tagEl.hidden = true;
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

  /** What moves on its own each frame (the views and the glow add to this). */
  protected tick(_now: number): void {
    /* nothing yet */
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
