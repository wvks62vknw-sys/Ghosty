/**
 * THE 3-D of a build (BRIEF-REST-D 1b): the design's boxes (kits.ts) as solid timber, board, block and glass on the ground,
 * with a person 1.75 m tall beside it for scale. Turn it by dragging, pinch to zoom; tap a part and its group is lit and
 * named (the pane lights its lines in the list); EXPLODE moves the cladding, the roof and the door out to show the frame;
 * ROOF lifts the roof (a room's ceiling, a PC's lid and glass) off. Its own three.js renderer from the Studio's vendored
 * library, drawn only while it is on screen. A test reads it through `state()` and finds a part with `screenOf()`.
 */
import { loadThree, type StudioLib, type TBufferGeometry, type TCamera, type TControls, type TMaterial, type TMesh, type TObject3D, type TRenderer, type TScene, type TVector3 } from '../studio/three';
import { BUILDINGS, type Box, type Design } from './kits';

/** The groups ROOF takes off. */
const LIDS = new Set(['roof', 'ceiling', 'lid']);
const FIGURE = 'figure';

export interface BuildSceneState {
  ready: boolean;
  title: string;
  groups: string[];
  lit: string;
  picked: string;
  exploded: boolean;
  roof: boolean;
  meshes: number;
  frames: number;
  error: string;
}

export class BuildScene {
  readonly host: HTMLElement;
  lib: StudioLib | null = null;
  renderer: TRenderer | null = null;
  scene: TScene | null = null;
  camera: TCamera | null = null;
  controls: TControls | null = null;
  error = '';
  /** A part was tapped: its group and its name. */
  onPick: (group: string, label: string) => void = () => undefined;
  private world: TObject3D | null = null;
  private ground: TMesh | null = null;
  private meshes: TMesh[] = [];
  private mats = new Map<string, TMaterial>();
  private litMats = new Map<string, TMaterial>();
  private design: Design | null = null;
  private initP: Promise<boolean> | null = null;
  private raf = 0;
  private running = false;
  private ro: ResizeObserver | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private tween: { from: number; to: number; t0: number } | null = null;
  private k = 0;
  private frames = 0;
  private tag: HTMLElement;
  private tagAt: TVector3 | null = null;
  exploded = false;
  roof = true;
  lit = '';
  picked = '';

  constructor(host: HTMLElement) {
    this.host = host;
    this.tag = document.createElement('div');
    this.tag.className = 'buildtag';
    this.tag.hidden = true;
    this.tag.setAttribute('aria-live', 'polite');
    host.append(this.tag);
  }

  init(): Promise<boolean> {
    if (this.renderer) return Promise.resolve(true);
    this.initP ??= this.make().then((ok) => {
      if (!ok) this.initP = null;
      return ok;
    });
    return this.initP;
  }

  private async make(): Promise<boolean> {
    try {
      this.lib = await loadThree();
    } catch (e) {
      this.error = `The 3-D engine did not load: ${(e as Error).message}`;
      return false;
    }
    const T = this.lib.THREE;
    let r: TRenderer;
    try {
      r = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
    } catch {
      this.error = 'This phone cannot draw 3-D just now (WebGL is off or busy).';
      return false;
    }
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.setClearColor(0xcfe3f2, 1);
    r.domElement.className = 'buildcanvas';
    r.domElement.setAttribute('role', 'img');
    r.domElement.setAttribute('aria-label', 'The build in 3-D');
    this.host.prepend(r.domElement);
    this.renderer = r;
    const scene = new T.Scene();
    scene.background = new T.Color(0xcfe3f2);
    this.scene = scene;
    const hemi = new T.HemisphereLight(0xeaf4ff, 0x5b6b4a, 1.25);
    const sun = new T.DirectionalLight(0xfff3e0, 2.0);
    sun.position.set(6, 10, 7);
    const fill = new T.DirectionalLight(0xc8dcff, 0.6);
    fill.position.set(-7, 4, -5);
    scene.add(hemi, sun, fill);
    this.ground = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x7fa36a, roughness: 1 })) as TMesh;
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.002;
    scene.add(this.ground);
    this.world = new T.Group();
    scene.add(this.world);
    const cam = new T.PerspectiveCamera(40, 1, 0.02, 200);
    this.camera = cam;
    const c = new this.lib.OrbitControls(cam, r.domElement) as TControls & { enablePan: boolean; maxPolarAngle: number };
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.maxPolarAngle = 1.52;
    this.controls = c;
    const el = r.domElement;
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

  private mat(color: number, glass: boolean, lit: boolean): TMaterial {
    const key = `${color}:${glass ? 1 : 0}`;
    const store = lit ? this.litMats : this.mats;
    let m = store.get(key);
    if (!m) {
      const T = this.lib!.THREE;
      m = new T.MeshStandardMaterial({ color, roughness: glass ? 0.1 : 0.78, metalness: color === 0x8d949c ? 0.5 : 0, ...(glass ? { transparent: true, opacity: 0.38, depthWrite: false } : {}), ...(lit ? { emissive: 0xffa21a, emissiveIntensity: 0.55 } : {}) });
      store.set(key, m);
    }
    return m;
  }

  /** A wedge's geometry: a triangular prism in a box's own frame, high at +x (1) or −x (−1). */
  private wedge(b: Box): TBufferGeometry {
    const T = this.lib!.THREE;
    const x = b.w / 2;
    const y = b.h / 2;
    const z = b.d / 2;
    const hx = b.wedge === 1 ? x : -x;
    const lx = -hx;
    // the triangle (low end, high end bottom, high end top) at both faces
    const f = [lx, -y, z, hx, -y, z, hx, y, z, lx, -y, -z, hx, y, -z, hx, -y, -z];
    const idx = [0, 1, 2, 3, 4, 5, 0, 3, 5, 0, 5, 1, 1, 5, 4, 1, 4, 2, 0, 2, 4, 0, 4, 3];
    const pos: number[] = [];
    for (const i of idx) pos.push(f[i * 3]!, f[i * 3 + 1]!, f[i * 3 + 2]!);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    g.computeVertexNormals();
    return g;
  }

  /** Build this design (the one before is freed). Concepts draw nothing. */
  async show(d: Design): Promise<void> {
    if (!(await this.init())) throw new Error(this.error);
    const T = this.lib!.THREE;
    this.clear();
    this.design = d;
    this.exploded = false;
    this.roof = true;
    this.k = 0;
    this.lit = '';
    this.picked = '';
    this.tag.hidden = true;
    const outdoor = BUILDINGS.includes(d.kind) && d.kind !== 'room';
    (this.ground!.material as TMaterial).color?.setHex(outdoor ? 0x7fa36a : d.kind === 'room' ? 0x9a9fa6 : 0xb7bcc2);
    for (const b of d.boxes) {
      const geo = b.wedge ? this.wedge(b) : new T.BoxGeometry(b.w, b.h, b.d);
      const mesh = new T.Mesh(geo, this.mat(b.color, !!b.glass, false)) as TMesh;
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(b.rx ?? 0, b.ry ?? 0, b.rz ?? 0, 'YXZ');
      mesh.position.set(b.x, b.y, b.z);
      mesh.userData = { part: b.group, label: b.label, id: b.id, home: [b.x, b.y, b.z], out: b.out, color: b.color, glass: !!b.glass };
      this.world!.add(mesh);
      this.meshes.push(mesh);
    }
    if (d.boxes.length && d.kind !== 'pc') this.addFigure(d);
    this.renderer!.domElement.setAttribute('aria-label', d.concept ? `${d.title}: a concept, nothing drawn` : `${d.title} in 3-D, with a person 1.75 metres tall beside it for scale. Drag to turn it, pinch to zoom, tap a part to light its lines in the list.`);
    this.frame();
  }

  /** A person 1.75 m tall standing by the front corner. */
  private addFigure(d: Design): void {
    const T = this.lib!.THREE;
    const xs = d.boxes.map((b) => Math.abs(b.x) + b.w / 2);
    const zs = d.boxes.map((b) => Math.abs(b.z) + b.d / 2);
    const x = Math.max(...xs) + 0.55;
    const z = Math.max(...zs) * 0.6;
    const m = this.mat(0x5c6f8a, false, false);
    const parts: [TBufferGeometry, number][] = [
      [new T.CylinderGeometry(0.17, 0.15, 0.62, 16), 1.2],
      [new T.SphereGeometry(0.11, 16, 12), 1.64],
      [new T.CylinderGeometry(0.075, 0.065, 0.85, 12), 0.425],
    ];
    for (const [i, [geo, y]] of parts.entries()) {
      const legs = i === 2;
      for (const off of legs ? [-0.08, 0.08] : [0]) {
        const mesh = new T.Mesh(geo, m) as TMesh;
        mesh.position.set(x + off, y, z);
        mesh.userData = { part: FIGURE, label: 'A person 1.75 m tall, for scale', home: [x + off, y, z], out: [0, 0, 0] };
        this.world!.add(mesh);
        this.meshes.push(mesh);
      }
    }
  }

  private clear(): void {
    for (const m of this.meshes) {
      m.parent?.remove(m);
      m.geometry.dispose();
    }
    this.meshes = [];
  }

  /** The camera to see the whole build from the front corner. */
  frame(): void {
    if (!this.camera || !this.controls || !this.lib || !this.meshes.length) return;
    const T = this.lib.THREE;
    const box = new T.Box3();
    for (const m of this.meshes) box.union(new T.Box3().setFromObject(m));
    const c = box.getCenter(new T.Vector3());
    const s = box.getSize(new T.Vector3());
    const r = Math.max(0.4, s.length() / 2);
    const dist = r / Math.sin((this.camera.fov * Math.PI) / 360) * 1.05;
    this.camera.position.set(c.x + dist * 0.62, c.y + dist * 0.42, c.z + dist * 0.68);
    this.controls.target.copy(c);
    this.controls.minDistance = r * 0.4;
    this.controls.maxDistance = dist * 3;
    this.camera.near = Math.max(0.01, dist / 200);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /** EXPLODE: the cladding, the roof and the door out, to show the frame (and back). */
  setExplode(on: boolean): void {
    this.exploded = on;
    this.tween = { from: this.k, to: on ? 1 : 0, t0: performance.now() };
    if (!this.running) this.place(on ? 1 : 0);
  }

  /** ROOF: the roof (a ceiling, a PC's lid) on or off. */
  setRoof(on: boolean): void {
    this.roof = on;
    for (const m of this.meshes) {
      const part = String(m.userData.part);
      if (LIDS.has(part) || String(m.userData.id).startsWith('ins-roof')) m.visible = on;
    }
  }

  /** Light a part group (its meshes glow); '' for none. */
  light(group: string): void {
    this.lit = group;
    for (const m of this.meshes) {
      const u = m.userData as { part: string; color?: number; glass?: boolean };
      if (u.part === FIGURE || u.color === undefined) continue;
      m.material = this.mat(u.color, !!u.glass, u.part === group);
    }
  }

  private place(k: number): void {
    this.k = k;
    for (const m of this.meshes) {
      const u = m.userData as { home: number[]; out: number[] };
      m.position.set(u.home[0]! + u.out[0]! * k, u.home[1]! + u.out[1]! * k, u.home[2]! + u.out[2]! * k);
    }
  }

  private tap(cx: number, cy: number): void {
    const hit = this.hitAt(cx, cy);
    if (!hit) {
      this.tag.hidden = true;
      return;
    }
    this.pick(hit.part, hit.label, hit.point);
  }

  private hitAt(cx: number, cy: number): { part: string; label: string; point: TVector3 } | null {
    if (!this.lib || !this.camera || !this.renderer) return null;
    const T = this.lib.THREE;
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster();
    ray.setFromCamera(v, this.camera);
    for (const h of ray.intersectObjects(this.meshes.filter((m) => m.visible), false)) {
      const u = h.object.userData as { part?: string; label?: string };
      if (u.part) return { part: u.part, label: u.label ?? u.part, point: h.point };
    }
    return null;
  }

  /** Name and light a part group (a tap, or the list). */
  pick(part: string, label?: string, at?: TVector3): void {
    this.picked = part;
    const name = label ?? this.design?.groups.find((g) => g.id === part)?.name ?? part;
    const group = this.design?.groups.find((g) => g.id === part)?.name;
    this.tag.textContent = group && group !== name ? `${name} · ${group}` : name;
    this.tag.hidden = false;
    this.tagAt = at ?? this.centreOf(part);
    if (part !== FIGURE) this.light(part);
    this.onPick(part, name);
  }

  centreOf(part: string): TVector3 | null {
    if (!this.lib) return null;
    const T = this.lib.THREE;
    const box = new T.Box3();
    let any = false;
    for (const m of this.meshes) {
      if (m.userData.part !== part || !m.visible) continue;
      box.union(new T.Box3().setFromObject(m));
      any = true;
    }
    return any ? box.getCenter(new T.Vector3()) : null;
  }

  private project(v: TVector3): { x: number; y: number } | null {
    if (!this.camera || !this.renderer) return null;
    const q = v.clone() as TVector3 & { project(c: TCamera): TVector3 };
    q.project(this.camera);
    if (q.z > 1) return null;
    const el = this.renderer.domElement;
    return { x: ((q.x + 1) / 2) * el.clientWidth, y: ((1 - q.y) / 2) * el.clientHeight };
  }

  /** A part group's middle on screen, in page coordinates (a test taps it there). */
  screenOf(part: string): { x: number; y: number } | null {
    const c = this.centreOf(part);
    if (!c || !this.renderer) return null;
    this.draw();
    const p = this.project(c);
    if (!p) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }

  start(): void {
    if (this.running || !this.renderer) return;
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (this.tween) {
        const t = Math.min(1, (now - this.tween.t0) / 600);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.place(this.tween.from + (this.tween.to - this.tween.from) * e);
        if (t >= 1) this.tween = null;
      }
      this.controls?.update();
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private draw(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (!this.tag.hidden && this.tagAt) {
      const p = this.project(this.tagAt);
      if (p) this.tag.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -130%)`;
    }
  }

  state(): BuildSceneState {
    return {
      ready: !!this.meshes.length,
      title: this.design?.title ?? '',
      groups: [...new Set(this.meshes.map((m) => String(m.userData.part)))],
      lit: this.lit,
      picked: this.picked,
      exploded: this.exploded,
      roof: this.roof,
      meshes: this.meshes.length,
      frames: this.frames,
      error: this.error,
    };
  }
}

export type { TObject3D, TScene, TControls };
