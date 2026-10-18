/**
 * The 3D STUDIO's lab bench: a three.js scene in Stark's holographic style (dark, a cyan grid
 * and pad under the model, a cyan rim light, glowing edges on every part — no post-processing)
 * with the model taken apart into PARTS that can be exploded, isolated, hidden, sectioned and
 * measured. The maths lives in explode.ts / split.ts / room.ts (plain numbers, unit-tested); this
 * file only drives three.js, which is vendored and loaded the first time the studio opens.
 *
 * Every part is moved under one `model` group (keeping where it was in the world), so taking
 * apart is just moving each part's position from `home` along its `offset`.
 */
import { explodeOffsets, ease, fmtLength, thinnestAxis, type V3 } from './explode';
import { triangulate } from '../../../../packages/shared/src/design';
import type { StandInPart } from '../../../../packages/shared/src/models3d';
import { roomBoxes, type RoomPlan } from './room';
import { EYE, lookBy, resumeWalk, walkStep, type WalkState } from './walk';
import { splitPieces, subsetIndex } from './split';
import { loadThree, type StudioLib, type TBufferGeometry, type TCamera, type TControls, type TMaterial, type TMesh, type TObject3D, type TPlane, type TRenderer, type TScene, type TVector3 } from './three';

export interface StudioPart {
  id: number;
  name: string;
  obj: TObject3D;
  meshes: TMesh[];
  home: TVector3;
  offset: V3;
  hidden: boolean;
  tris: number;
}

export type ModelSource =
  | { kind: 'glb'; data: ArrayBuffer; title: string; metres: boolean; credit?: string; split?: boolean }
  | { kind: 'reactor' }
  | { kind: 'room'; plan: RoomPlan; ceiling?: boolean }
  /** A stand-in built from simple shapes (models3d.ts `standIn`), in metres. */
  | { kind: 'parts'; parts: StandInPart[]; title: string; credit: string };

export interface ModelInfo {
  title: string;
  credit: string;
  metres: boolean;
  triangles: number;
  size: V3;
  room: boolean;
  warnings: string[];
}

export type Axis = 'x' | 'y' | 'z';

/** How a room is looked at: orbiting it, standing in it at eye height (WALK), or from above (AERIAL). */
export type ViewMode = 'orbit' | 'walk' | 'aerial';

const CYAN = 0x38e8ff;
const GLOW = 0x00e5ff;
/** Pieces are only looked for in models this small (welding is linear but not free on a phone). */
const SPLIT_MAX_TRIS = 300_000;
/** Glowing edges only on parts this small (finding edges costs memory too). */
const EDGE_MAX_TRIS = 80_000;

const triCount = (g: TBufferGeometry) => Math.floor((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3);
const mats = (m: TMesh): TMaterial[] => (Array.isArray(m.material) ? m.material : [m.material]);

export class Viewer {
  readonly host: HTMLElement;
  lib: StudioLib | null = null;
  renderer: TRenderer | null = null;
  scene: TScene | null = null;
  camera: TCamera | null = null;
  controls: TControls | null = null;
  /** The model's parts live directly under this. */
  model: TObject3D | null = null;
  parts: StudioPart[] = [];
  info: ModelInfo = { title: '', credit: '', metres: true, triangles: 0, size: [0, 0, 0], room: false, warnings: [] };
  explode = 0;
  selected: number | null = null;
  isolated = false;
  section: { axis: Axis; frac: number } | null = null;
  measuring = false;
  measure: { points: TVector3[]; distance: number | null } = { points: [], distance: null };
  error = '';
  mode: ViewMode = 'orbit';
  /** WALK: where one stands and looks; the joystick's push (−1…1 forward and to the right). */
  walk: WalkState | null = null;
  walkInput = { fwd: 0, side: 0 };
  /** The room plan on show (cm), for WALK's walls and doors. */
  roomPlan: RoomPlan | null = null;
  /** Called whenever something the panels show changed (parts, selection, measure…). */
  onChange: () => void = () => undefined;

  private plane: TPlane | null = null;
  private stage: TObject3D | null = null;
  private marks: TObject3D | null = null;
  private orig = new Map<TMesh, TMaterial | TMaterial[]>();
  private tween: { from: number; to: number; t0: number; ms: number; done: () => void } | null = null;
  private raf = 0;
  private running = false;
  private ro: ResizeObserver | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private loadGen = 0;
  private lastStep = 0;
  private look: { x: number; y: number; id: number } | null = null;
  private initP: Promise<boolean> | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
  }

  /** Load three.js and build the empty lab. False (with `error` set) when this device has no WebGL. */
  init(): Promise<boolean> {
    // One build however many callers arrive while three.js is still loading (the tab's enter() and
    // an open_studio load race on a first visit): two would stack two canvases, one never drawn.
    if (this.renderer) return Promise.resolve(true);
    this.initP ??= this.build().then((ok) => {
      if (!ok) this.initP = null;
      return ok;
    });
    return this.initP;
  }

  private async build(): Promise<boolean> {
    try {
      this.lib = await loadThree();
    } catch (e) {
      this.error = `The 3-D engine did not load: ${(e as Error).message}`;
      return false;
    }
    if (this.renderer) return true;
    const { THREE, OrbitControls, RoomEnvironment } = this.lib;
    let renderer: TRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
    } catch {
      this.error = 'This device cannot draw 3-D (WebGL is off or unavailable).';
      return false;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0x02070d, 1);
    renderer.domElement.className = 'studiocanvas';
    this.host.prepend(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02070d, 0.02);
    // Soft studio reflections so real materials (metal, glass, velvet) read properly.
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    } catch {
      // the lights below are enough on their own
    }
    scene.add(new THREE.HemisphereLight(0xbfefff, 0x05121c, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight(CYAN, 2.2);
    rim.position.set(-4, 2.5, -5);
    scene.add(key, rim);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    camera.position.set(2.2, 1.6, 2.8);
    this.camera = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 1.2;
    this.controls = controls;

    this.stage = new THREE.Group();
    this.marks = new THREE.Group();
    scene.add(this.stage, this.marks);

    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      // WALK: a drag on the scene turns the head.
      if (this.mode === 'walk') this.look = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    el.addEventListener('pointermove', (e) => {
      const l = this.look;
      if (!l || l.id !== e.pointerId || this.mode !== 'walk' || !this.walk) return;
      this.walk = lookBy(this.walk, e.clientX - l.x, e.clientY - l.y);
      this.look = { x: e.clientX, y: e.clientY, id: e.pointerId };
      this.placeWalker();
    });
    const endLook = () => (this.look = null);
    el.addEventListener('pointercancel', endLook);
    el.addEventListener('pointerleave', endLook);
    el.addEventListener('pointerup', (e) => {
      this.look = null;
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

  start(): void {
    if (this.running || !this.renderer) return;
    this.running = true;
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

  private step(now: number): void {
    const dt = this.lastStep ? (now - this.lastStep) / 1000 : 0;
    this.lastStep = now;
    if (this.mode === 'walk' && this.walk && this.roomPlan && (this.walkInput.fwd || this.walkInput.side)) {
      this.walk = walkStep(this.roomPlan, this.walk, this.walkInput, dt);
      this.placeWalker();
    }
    const tw = this.tween;
    if (tw) {
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      this.setExplode(tw.from + (tw.to - tw.from) * ease(k), true);
      if (k >= 1) {
        this.tween = null;
        tw.done();
      }
    }
    if (this.mode !== 'walk') this.controls?.update();
    this.renderer!.render(this.scene!, this.camera!);
  }

  // ------------------------------------------------------------------ loading

  /** Swap in a model (the old one is freed). */
  async load(src: ModelSource): Promise<void> {
    if (!(await this.init())) throw new Error(this.error);
    const gen = ++this.loadGen;
    const { THREE, GLTFLoader } = this.lib!;
    let root: TObject3D;
    let info: Omit<ModelInfo, 'triangles' | 'size'>;
    let split = false;
    if (src.kind === 'glb') {
      // Pictures inside a GLB are read through <img> (allowed for blob: addresses by the security
      // policy) instead of fetch(), which the policy keeps to this site and Hugging Face.
      const loader = new GLTFLoader().register((parser) => {
        parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
        return { name: 'ghosty_img_textures' };
      });
      const gltf = await loader.parseAsync(src.data, '');
      root = gltf.scene;
      info = { title: src.title, credit: src.credit ?? '', metres: src.metres, room: false, warnings: [] };
      split = src.split !== false;
    } else if (src.kind === 'reactor') {
      root = this.reactor();
      info = { title: 'Arc reactor (built in)', credit: 'Made for Ghosty from simple shapes', metres: true, room: false, warnings: [] };
    } else if (src.kind === 'parts') {
      root = this.standIn(src.parts);
      info = { title: src.title, credit: src.credit, metres: true, room: false, warnings: [] };
    } else {
      const r = this.room(src.plan, !!src.ceiling);
      root = r.root;
      info = { title: `Room ${src.plan.room.w} × ${src.plan.room.d} cm`, credit: 'Built from your measurements', metres: true, room: true, warnings: r.warnings };
    }
    if (gen !== this.loadGen) return;
    this.clear();
    this.roomPlan = src.kind === 'room' ? src.plan : null;

    const model = new THREE.Group();
    model.name = 'model';
    this.stage!.add(model);
    root.updateMatrixWorld(true);
    // Every mesh becomes a part directly under `model`, where it was in the world.
    const meshes: TMesh[] = [];
    root.traverse((o) => {
      if ((o as TMesh).isMesh) meshes.push(o as TMesh);
    });
    // One mesh or a handful: look for the pieces each is really made of, so it still comes apart.
    const pieces = split && meshes.length <= 3 ? meshes.flatMap((m) => this.pieces(m)) : meshes;
    const parts: StudioPart[] = [];
    const names = new Map<string, number>();
    for (const m of pieces) {
      let name = (m.name || m.parent?.name || 'Part').replace(/[_]+/g, ' ').trim() || 'Part';
      model.attach(m);
      const n = (names.get(name) ?? 0) + 1;
      names.set(name, n);
      if (n > 1) name = `${name} ${n}`;
      parts.push({ id: parts.length, name, obj: m, meshes: [m], home: m.position.clone(), offset: [0, 0, 0], hidden: false, tris: triCount(m.geometry) });
    }
    // Lights a file carries (KHR_lights_punctual) come along too.
    root.traverse((o) => {
      if (/Light$/.test(o.type) && o !== root) model.attach(o);
    });
    // Duplicate names "Part 1"… for the first of a repeated name too.
    for (const [name, n] of names) if (n > 1) parts.find((p) => p.name === name)!.name = `${name} 1`;

    // Stand it on the pad, centred.
    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    model.updateMatrixWorld(true);
    this.model = model;
    this.parts = parts;
    let triangles = 0;
    for (const p of parts) {
      triangles += p.tris;
      if (!info.room && p.tris <= EDGE_MAX_TRIS) this.edges(p.obj as TMesh);
    }
    this.info = { ...info, triangles, size: [sz.x, sz.y, sz.z] };
    this.computeOffsets();
    this.pad(Math.max(sz.x, sz.z, sz.y * 0.5));
    this.frame();
    this.onChange();
  }

  /** A mesh's connected pieces as separate meshes (sharing its material), or the mesh itself. */
  private pieces(m: TMesh): TMesh[] {
    const { THREE } = this.lib!;
    const g = m.geometry;
    const pos = g.attributes.position;
    if (!pos || m.isSkinnedMesh || Object.keys(g.morphAttributes ?? {}).length || triCount(g) > SPLIT_MAX_TRIS) return [m];
    const xyz = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      xyz[i * 3] = pos.getX(i);
      xyz[i * 3 + 1] = pos.getY(i);
      xyz[i * 3 + 2] = pos.getZ(i);
    }
    const idx = g.index ? g.index.array : null;
    const groups = splitPieces(xyz, idx);
    if (groups.length < 2) return [m];
    const out: TMesh[] = [];
    groups.forEach((tris, gi) => {
      const sub = subsetIndex(idx, tris);
      const ng = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g.attributes)) {
        const k = a.itemSize;
        const arr = new Float32Array(sub.vertices.length * k);
        sub.vertices.forEach((v, i) => {
          arr[i * k] = a.getX(v);
          if (k > 1) arr[i * k + 1] = a.getY(v);
          if (k > 2) arr[i * k + 2] = a.getZ(v);
          if (k > 3) arr[i * k + 3] = a.getW(v);
        });
        ng.setAttribute(name, new THREE.BufferAttribute(arr, k));
      }
      ng.setIndex(new THREE.BufferAttribute(sub.index, 1));
      const piece = new THREE.Mesh(ng, m.material);
      piece.name = `${m.name || 'Piece'} ${gi + 1}`;
      m.parent?.add(piece);
      piece.position.copy(m.position);
      piece.rotation.x = m.rotation.x;
      piece.rotation.y = m.rotation.y;
      piece.rotation.z = m.rotation.z;
      piece.scale.copy(m.scale);
      out.push(piece);
    });
    m.parent?.remove(m);
    g.dispose();
    out.forEach((p) => p.updateMatrixWorld(true));
    return out;
  }

  /** Thin glowing lines on a part's hard edges: the holographic look, no post-processing. */
  private edges(m: TMesh): void {
    const { THREE } = this.lib!;
    try {
      const eg = new THREE.EdgesGeometry(m.geometry, 35);
      const lines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: GLOW, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
      lines.name = '__edges';
      lines.userData.edges = true;
      m.add(lines);
    } catch {
      // a part without edges still works
    }
  }

  /** The cyan grid and the glowing pad under the model, sized to it. */
  private pad(size: number): void {
    const { THREE } = this.lib!;
    const s = Math.max(size, 0.05);
    const old = this.stage!.children.filter((o) => o.userData.pad);
    for (const o of old) this.disposeTree(o), this.stage!.remove(o);
    const grid = new THREE.GridHelper(s * 6, 30, CYAN, 0x0b3d52);
    const gm = grid.material;
    gm.transparent = true;
    gm.opacity = 0.35;
    grid.userData.pad = true;
    const rings = new THREE.Group();
    rings.userData.pad = true;
    for (const [r, o] of [[0.62, 0.55], [0.72, 0.25], [1.05, 0.12]] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(s * r, s * r + s * 0.012, 96), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.001 * s;
      rings.add(ring);
    }
    this.stage!.add(grid, rings);
    if (this.scene) (this.scene.fog as { density: number }).density = 0.12 / s;
  }

  /** Where each part goes at 100 %, from the parts' centres at rest. */
  private computeOffsets(): void {
    const { THREE } = this.lib!;
    if (!this.model) return;
    const t = this.explode;
    this.setExplode(0, true);
    const all = new THREE.Box3().setFromObject(this.model);
    const c = all.getCenter(new THREE.Vector3());
    const s = all.getSize(new THREE.Vector3());
    const centres: V3[] = this.parts.map((p) => {
      const b = new THREE.Box3().setFromObject(p.obj);
      const v = b.isEmpty() ? p.obj.getWorldPosition(new THREE.Vector3()) : b.getCenter(new THREE.Vector3());
      return [v.x, v.y, v.z];
    });
    // Offsets are worked out in the world and applied inside `model`, which only moves (never turns or scales).
    const off = explodeOffsets([c.x, c.y, c.z], centres, Math.max(s.x, s.y, s.z), 1, this.info.room ? [0, 1, 0] : thinnestAxis([s.x, s.y, s.z]));
    this.parts.forEach((p, i) => (p.offset = off[i]!));
    this.setExplode(t, true);
  }

  // ------------------------------------------------------------------ take apart

  setExplode(t: number, quiet = false): void {
    this.explode = Math.min(1, Math.max(0, t));
    for (const p of this.parts) p.obj.position.set(p.home.x + p.offset[0] * this.explode, p.home.y + p.offset[1] * this.explode, p.home.z + p.offset[2] * this.explode);
    if (!quiet) this.onChange();
  }

  /** Animate to a fraction apart (1 = TAKE APART, 0 = REASSEMBLE). */
  animateTo(to: number, ms = 1100): Promise<void> {
    return new Promise((done) => {
      if (!this.running) {
        this.setExplode(to);
        return done();
      }
      this.tween?.done();
      this.tween = { from: this.explode, to, t0: performance.now(), ms, done: () => (this.onChange(), done()) };
    });
  }

  // ------------------------------------------------------------------ parts

  select(id: number | null): void {
    const { THREE } = this.lib ?? {};
    for (const [m, mat] of this.orig) {
      for (const x of mats(m)) x.dispose();
      m.material = mat;
      for (const x of mats(m)) this.clip(x, true);
    }
    this.orig.clear();
    this.selected = id;
    const p = id === null ? null : this.parts[id];
    if (p && THREE) {
      for (const m of p.meshes) {
        this.orig.set(m, m.material);
        const hl = mats(m).map((x) => {
          const c = x.clone();
          if (c.emissive) {
            c.emissive.setHex(GLOW);
            c.emissiveIntensity = 0.55;
          }
          this.clip(c, true);
          return c;
        });
        m.material = Array.isArray(m.material) ? hl : hl[0]!;
      }
    }
    this.applyVisibility();
    this.onChange();
  }

  setIsolate(on: boolean): void {
    this.isolated = on;
    this.applyVisibility();
    this.onChange();
  }

  toggleHidden(id: number): void {
    const p = this.parts[id];
    if (!p) return;
    p.hidden = !p.hidden;
    this.applyVisibility();
    this.onChange();
  }

  showAll(): void {
    for (const p of this.parts) p.hidden = false;
    this.isolated = false;
    this.applyVisibility();
    this.onChange();
  }

  private applyVisibility(): void {
    for (const p of this.parts) p.obj.visible = !p.hidden && (!this.isolated || this.selected === null || p.id === this.selected);
  }

  // ------------------------------------------------------------------ section

  /** A cut through the model along an axis at a fraction of its size (null: no cut). */
  setSection(axis: Axis | null, frac = 0.5): void {
    const { THREE } = this.lib!;
    if (!this.model) return;
    this.section = axis ? { axis, frac: Math.min(1, Math.max(0, frac)) } : null;
    if (axis) {
      const t = this.explode;
      this.setExplode(0, true);
      const b = new THREE.Box3().setFromObject(this.model);
      this.setExplode(t, true);
      const i = axis === 'x' ? 'x' : axis === 'y' ? 'y' : 'z';
      const at = b.min[i] + (b.max[i] - b.min[i]) * this.section!.frac;
      // Keep what is on the near side of the cut: everything below `at` along the axis.
      const n = new THREE.Vector3(axis === 'x' ? -1 : 0, axis === 'y' ? -1 : 0, axis === 'z' ? -1 : 0);
      if (!this.plane) this.plane = new THREE.Plane(n, at);
      else this.plane.set(n, at);
    } else this.plane = null;
    for (const p of this.parts)
      p.obj.traverse((o) => {
        const m = o as TMesh;
        if (!m.material) return;
        for (const x of mats(m)) this.clip(x, !!m.isMesh);
      });
    // The materials waiting under a highlight get the same cut.
    for (const mat of this.orig.values()) for (const x of Array.isArray(mat) ? mat : [mat]) this.clip(x, true);
    this.onChange();
  }

  /** Give a material the current cut (or none); a cut solid shows its inside faces. */
  private clip(x: TMaterial, solid: boolean): void {
    const { THREE } = this.lib!;
    x.clippingPlanes = this.plane ? [this.plane] : null;
    const ud = x.userData as { side?: number } | undefined;
    if (solid && ud) {
      if (this.plane) {
        ud.side ??= x.side;
        x.side = THREE.DoubleSide;
      } else if (ud.side !== undefined) {
        x.side = ud.side;
        delete ud.side;
      }
    }
    x.needsUpdate = true;
  }

  // ------------------------------------------------------------------ measure

  setMeasuring(on: boolean): void {
    this.measuring = on;
    if (!on) this.clearMeasure();
    this.onChange();
  }

  clearMeasure(): void {
    this.measure = { points: [], distance: null };
    if (this.marks) for (const o of [...this.marks.children]) this.disposeTree(o), this.marks.remove(o);
    this.onChange();
  }

  measureText(): string {
    const d = this.measure.distance;
    return d === null ? '' : fmtLength(d, this.info.metres);
  }

  /** A tap on the model: a measuring point, or picks the part under the finger. */
  private tap(cx: number, cy: number): void {
    const { THREE } = this.lib!;
    if (!this.camera || !this.model) return;
    const r = this.renderer!.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(v, this.camera);
    const targets = this.parts.filter((p) => p.obj.visible).map((p) => p.obj);
    const hit = ray.intersectObjects(targets, false).find((x) => !this.plane || this.plane.normal.x * x.point.x + this.plane.normal.y * x.point.y + this.plane.normal.z * x.point.z + this.plane.constant >= 0);
    if (this.measuring) {
      if (hit) this.addMeasurePoint(hit.point);
      return;
    }
    const id = hit ? this.parts.findIndex((p) => p.obj === hit.object) : -1;
    this.select(id >= 0 && id !== this.selected ? id : null);
  }

  addMeasurePoint(p: TVector3): void {
    const { THREE } = this.lib!;
    if (this.measure.points.length >= 2) this.clearMeasure();
    const pts = [...this.measure.points, p.clone()];
    const s = Math.max(...this.info.size, 0.05);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(s * 0.012, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd24d, depthTest: false }));
    dot.position.copy(p);
    dot.renderOrder = 10;
    this.marks!.add(dot);
    let distance: number | null = null;
    if (pts.length === 2) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffd24d, depthTest: false }));
      line.renderOrder = 10;
      this.marks!.add(line);
      distance = pts[0]!.distanceTo(pts[1]!);
    }
    this.measure = { points: pts, distance };
    this.onChange();
  }

  // ------------------------------------------------------------------ camera, turntable, picture

  setTurntable(on: boolean): void {
    if (this.controls) this.controls.autoRotate = on;
    this.onChange();
  }

  /** Point the camera at the whole model. */
  frame(): void {
    const { THREE } = this.lib!;
    if (!this.model || !this.camera || !this.controls) return;
    const b = new THREE.Box3().setFromObject(this.model);
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y, s.z, 0.05);
    const dist = (r / Math.tan(((this.camera.fov / 2) * Math.PI) / 180)) * (this.info.room ? 0.95 : 1.15);
    this.camera.near = r / 200;
    this.camera.far = r * 200;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.camera.position.set(c.x + dist * 0.62, c.y + dist * 0.48, c.z + dist * 0.75);
    this.controls.minDistance = r * 0.05;
    this.controls.maxDistance = r * 12;
    this.controls.update();
  }

  /**
   * How to look at a room: ORBIT round it, WALK through it (eye height 1.6 m; drag to look, the
   * joystick or arrow keys to move; walls stop you, doors let you through) or AERIAL (straight
   * down from above). Anything that is not a room is always orbited. `keep`: where a walker stood
   * before the room was rebuilt, to stand there again.
   */
  setMode(mode: ViewMode, keep: WalkState | null = null): void {
    if (!this.camera || !this.controls) return;
    const m: ViewMode = this.roomPlan ? mode : 'orbit';
    this.mode = m;
    this.walkInput = { fwd: 0, side: 0 };
    this.controls.enabled = m !== 'walk';
    if (m === 'walk' && this.roomPlan) {
      // Walls stay where they are while walking (taken apart they would float overhead).
      if (this.explode) this.setExplode(0, true);
      this.setTurntable(false);
      this.walk = resumeWalk(this.roomPlan, keep);
      this.camera.near = 0.05;
      this.camera.far = 200;
      this.camera.updateProjectionMatrix();
      this.placeWalker();
    } else {
      this.walk = null;
      this.camera.rotation.set(0, 0, 0, 'XYZ');
      if (m === 'aerial') this.aerial();
      else this.frame();
    }
    this.onChange();
  }

  /** The camera where the walker stands, looking where they look. */
  private placeWalker(): void {
    if (!this.camera || !this.walk) return;
    // Rooms are built about the plan's centre, then the whole model is moved to stand centred on the pad.
    const off = this.model?.position;
    this.camera.position.set(this.walk.x + (off?.x ?? 0), EYE + (off?.y ?? 0), this.walk.z + (off?.z ?? 0));
    this.camera.rotation.set(this.walk.pitch, this.walk.yaw, 0, 'YXZ');
  }

  /** Straight down onto the plan from above, top wall at the top. */
  private aerial(): void {
    const { THREE } = this.lib!;
    if (!this.model || !this.camera || !this.controls) return;
    const b = new THREE.Box3().setFromObject(this.model);
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.z, 1);
    const h = (r / 2 / Math.tan(((this.camera.fov / 2) * Math.PI) / 180)) * 1.25 + s.y;
    this.camera.near = r / 200;
    this.camera.far = r * 200;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.camera.position.set(c.x, c.y + h, c.z + h * 0.02);
    this.controls.update();
  }

  /** A room seen from inside, at eye height, from one corner. */
  insideView(): void {
    if (!this.info.room || !this.camera || !this.controls) return;
    const [w, h, d] = this.info.size;
    this.camera.position.set(-w / 2 + 0.4, Math.min(1.6, h * 0.66), d / 2 - 0.4);
    this.controls.target.set(w / 4, Math.min(1.0, h * 0.4), -d / 4);
    this.controls.minDistance = 0.05;
    this.controls.update();
  }

  /** The current view as a PNG. */
  screenshot(): Promise<Blob | null> {
    if (!this.renderer || !this.scene || !this.camera) return Promise.resolve(null);
    // Drawn now and read straight away, so the buffer need not be kept between frames.
    this.renderer.render(this.scene, this.camera);
    return new Promise((res) => this.renderer!.domElement.toBlob((b) => res(b), 'image/png'));
  }

  // ------------------------------------------------------------------ built-in models

  /** An arc reactor from simple shapes: many parts, loads at once, takes apart beautifully. */
  private reactor(): TObject3D {
    const { THREE } = this.lib!;
    const g = new THREE.Group();
    const metal = (color: number, rough = 0.35) => new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: rough });
    const glow = new THREE.MeshStandardMaterial({ color: 0xbff6ff, emissive: GLOW, emissiveIntensity: 2.2, roughness: 0.2 });
    const add = (name: string, geo: TBufferGeometry, mat: TMaterial, z: number, rx = Math.PI / 2) => {
      const m = new THREE.Mesh(geo, mat);
      m.name = name;
      m.rotation.x = rx;
      m.position.z = z;
      g.add(m);
      return m;
    };
    add('Back plate', new THREE.CylinderGeometry(0.06, 0.06, 0.006, 64), metal(0x3a4450, 0.5), -0.014);
    add('Casing', new THREE.CylinderGeometry(0.058, 0.062, 0.018, 64, 1, true), metal(0x9aa6b2), 0);
    add('Outer ring', new THREE.TorusGeometry(0.052, 0.005, 16, 96), metal(0xc9d3dc, 0.2), 0.006, 0);
    add('Inner ring', new THREE.TorusGeometry(0.03, 0.004, 16, 96), metal(0xc9d3dc, 0.2), 0.008, 0);
    add('Core', new THREE.SphereGeometry(0.016, 32, 24), glow, 0.004, 0);
    add('Lens', new THREE.CylinderGeometry(0.022, 0.022, 0.003, 48), new THREE.MeshStandardMaterial({ color: 0x9feeff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0 }), 0.016);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const coil = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.01), new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.3, emissive: 0x05303a, emissiveIntensity: 0.6 }));
      coil.name = `Coil ${i + 1}`;
      coil.position.set(Math.cos(a) * 0.041, Math.sin(a) * 0.041, 0.006);
      coil.rotation.z = a + Math.PI / 2;
      g.add(coil);
    }
    // Stand it up facing the camera's side of the pad.
    const stand = new THREE.Group();
    g.position.y = 0.065;
    stand.add(g);
    return stand;
  }

  /** A stand-in from its parts: boxes, cylinders, cones, spheres and rings, each a part that comes apart. */
  private standIn(parts: StandInPart[]): TObject3D {
    const { THREE } = this.lib!;
    const g = new THREE.Group();
    for (const p of parts.slice(0, 80)) {
      const [a, b, c] = p.size;
      const geo =
        p.shape === 'box'
          ? new THREE.BoxGeometry(a, b, c)
          : p.shape === 'cyl' || p.shape === 'cone'
            ? new THREE.CylinderGeometry(a / 2, c / 2, b, 32)
            : p.shape === 'torus'
              ? new THREE.TorusGeometry(a / 2, Math.max(0.002, b), 12, 48)
              : new THREE.SphereGeometry(0.5, 32, 16);
      const see = p.opacity !== undefined && p.opacity < 1;
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: p.color, metalness: p.metal ?? 0.05, roughness: p.rough ?? 0.6, ...(see ? { transparent: true, opacity: p.opacity } : {}) }));
      m.name = p.name;
      if (p.shape === 'sphere') m.scale.set(a, b, c);
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      if (p.rot) m.rotation.set(p.rot[0], p.rot[1], p.rot[2], 'XYZ');
      g.add(m);
    }
    return g;
  }

  /** A room from measurements: floors, glass walls cut round doors and windows, and every item as a box. */
  private room(plan: RoomPlan, ceiling: boolean): { root: TObject3D; warnings: string[] } {
    const { THREE } = this.lib!;
    const { boxes, warnings } = roomBoxes(plan, { ceiling });
    const root = new THREE.Group();
    const hue = (s: string) => {
      let x = 0;
      for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
      return [0x4fb3d9, 0x6fd3a8, 0xd9a54f, 0xc77dd8, 0x7f9cf5, 0xe07a7a, 0x9fd36f][x % 7]!;
    };
    for (const b of boxes) {
      const mat =
        b.kind === 'floor'
          ? new THREE.MeshStandardMaterial({ color: 0x0c2230, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide })
          : b.kind === 'ceiling'
            ? new THREE.MeshStandardMaterial({ color: 0x9fdcef, transparent: true, opacity: 0.12, roughness: 0.6, metalness: 0, depthWrite: false, side: THREE.DoubleSide })
            : b.kind === 'wall'
              ? new THREE.MeshStandardMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide })
              : b.kind === 'glass'
                ? new THREE.MeshStandardMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide, emissive: 0x0a3a48, emissiveIntensity: 0.6 })
                : b.kind === 'door'
                  ? new THREE.MeshStandardMaterial({ color: 0xd9a54f, roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.85 })
                  : new THREE.MeshStandardMaterial({ color: hue(b.name), roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.9 });
      const m = new THREE.Mesh(b.poly ? this.slab(b.poly, b.pos[1] + b.size[1] / 2) : new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]), mat);
      m.name = b.name;
      if (!b.poly) m.position.set(b.pos[0], b.pos[1], b.pos[2]);
      m.rotation.y = b.rotY;
      const edgy = b.kind === 'item' || b.kind === 'door';
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: edgy ? 0xffffff : GLOW, transparent: true, opacity: edgy ? 0.5 : b.kind === 'ceiling' ? 0.25 : 0.6, depthWrite: false }));
      e.userData.edges = true;
      m.add(e);
      root.add(m);
    }
    return { root, warnings };
  }

  /** A flat floor (or ceiling) the shape of a room at height y: its corners, triangulated. */
  private slab(poly: [number, number][], y: number): TBufferGeometry {
    const { THREE } = this.lib!;
    const pos = new Float32Array(poly.length * 3);
    poly.forEach(([x, z], i) => pos.set([x, y, z], i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(triangulate(poly));
    g.computeVertexNormals();
    return g;
  }

  // ------------------------------------------------------------------ freeing

  private disposeTree(o: TObject3D): void {
    o.traverse((x) => {
      const m = x as TMesh;
      if (m.geometry) m.geometry.dispose();
      const list = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mat of list) {
        for (const v of Object.values(mat)) if (v && typeof v === 'object' && 'isTexture' in v) (v as unknown as { dispose(): void }).dispose();
        mat.dispose();
      }
    });
  }

  /** Remove the model and everything about it. */
  clear(): void {
    this.tween = null;
    if (this.mode !== 'orbit') {
      this.mode = 'orbit';
      this.walk = null;
      if (this.controls) this.controls.enabled = true;
      this.camera?.rotation.set(0, 0, 0, 'XYZ');
    }
    this.roomPlan = null;
    this.select(null);
    this.orig.clear();
    this.plane = null;
    this.section = null;
    this.clearMeasure();
    if (this.model) {
      this.disposeTree(this.model);
      this.stage?.remove(this.model);
    }
    this.model = null;
    this.parts = [];
    this.explode = 0;
    this.isolated = false;
  }

  /** Free everything, the drawing context included (leaving the tab for good). */
  dispose(): void {
    this.stop();
    this.clear();
    this.ro?.disconnect();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.initP = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
  }
}

