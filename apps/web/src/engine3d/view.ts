/**
 * THE ENGINE'S VIEW (BRIEF-ENGINE-3D-1): the vendored three.js drawing what the Engine holds: the ground and its grid, each object as
 * the triangles shapes.ts makes (or the downloaded model's own), the selection's outline and its handles. It reads the world's own
 * colours from the page (`--g-canvas-rgb`, `--g-accent-rgb`, `--g-bone-rgb`) each time it draws, so a theme and a world recolour it
 * with no colour of its own. It draws only when something changed and only while it is on screen. The touch is the Engine's.
 */
import { loadThree, type StudioLib, type TBufferGeometry, type TCamera, type TMaterial, type TMesh, type TObject3D, type TRenderer, type TScene } from '../studio/three';
import { eye } from './camera';
import type { Engine } from './engine';
import { ringOf } from './edit';
import { materialOf, type Obj } from './scene';
import { primsOf, triangles, turnRad } from './shapes';
import type { RawMesh, RawModel } from './gltf';
import { sayError } from '../ui/hisWords';

const rgbVar = (name: string, fallback: [number, number, number]): number => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/.exec(v);
    if (m) return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
  } catch {
    /* no page styles: the fallback */
  }
  return (fallback[0] << 16) | (fallback[1] << 8) | fallback[2];
};
const mix = (a: number, b: number, t: number): number => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};

interface Drawn {
  key: string;
  root: TObject3D;
  mesh?: TMesh;
}

export class EngineView {
  lib: StudioLib | null = null;
  renderer: TRenderer | null = null;
  error = '';
  frames = 0;
  /** What is in the scene for the spec: meshes drawn, models loaded. */
  models = new Map<string, RawModel>();
  private three: TScene | null = null;
  private camera: TCamera | null = null;
  private world: TObject3D | null = null;
  private groundMesh: TMesh | null = null;
  private grid: (TObject3D & { material: TMaterial }) | null = null;
  private drawn = new Map<string, Drawn>();
  private groundKey = '';
  private overlay: TObject3D | null = null;
  private overlayKey = '';
  private groups = new Map<string, TObject3D>();
  private mats = new Map<string, TMaterial>();
  private initP: Promise<boolean> | null = null;
  private raf = 0;
  private dirty = true;
  private running = false;
  private ro: ResizeObserver | null = null;

  constructor(readonly host: HTMLElement, private readonly engine: Engine) {}

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
      this.error = sayError(e, 'draw the 3-D view');
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
    r.domElement.className = 'e3canvas';
    r.domElement.setAttribute('role', 'img');
    r.domElement.setAttribute('aria-label', 'The scene in 3-D. One finger turns it, two fingers pinch and slide it, a tap selects or places.');
    this.host.prepend(r.domElement);
    this.renderer = r;
    const scene = new T.Scene();
    this.three = scene;
    scene.add(new T.HemisphereLight(0xffffff, 0x6a7078, 1.5));
    const sun = new T.DirectionalLight(0xffffff, 1.7);
    sun.position.set(4, 8, 5);
    const fill = new T.DirectionalLight(0xdce6ff, 0.5);
    fill.position.set(-5, 3, -4);
    scene.add(sun, fill);
    this.world = new T.Group();
    scene.add(this.world);
    this.camera = new T.PerspectiveCamera(this.engine.cam.fov, 1, 0.05, 400);
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
    this.engine.resize(w, h);
    this.dirty = true;
  }

  /** The materials are shared by palette entry. */
  private mat(id: string, ghost = false): TMaterial {
    const key = `${id}:${ghost ? 1 : 0}`;
    let m = this.mats.get(key);
    if (!m) {
      const T = this.lib!.THREE;
      const p = materialOf(id);
      const alpha = ghost ? 0.3 : p.alpha;
      m = new T.MeshStandardMaterial({ color: p.hex, roughness: p.rough, metalness: p.metal, side: T.DoubleSide, transparent: alpha < 1, opacity: alpha, depthWrite: alpha >= 1 });
      this.mats.set(key, m);
    }
    return m;
  }

  private geometry(o: Obj): TBufferGeometry {
    const T = this.lib!.THREE;
    const t = triangles(primsOf(o));
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(t.positions), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(t.normals), 3));
    g.setIndex(t.indices);
    return g;
  }

  /** A downloaded model has arrived: parse it, draw it in the object's place, keep its shapes for the export. */
  async attachModel(id: string, glb: ArrayBuffer): Promise<{ size: [number, number, number] } | null> {
    if (!(await this.init()) || !this.lib) return null;
    const T = this.lib.THREE;
    const gltf = await new this.lib.GLTFLoader().parseAsync(glb.slice(0), '');
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root);
    if (box.isEmpty()) return null;
    const lo = box.min;
    const hi = box.max;
    const size: [number, number, number] = [Math.max(1e-3, hi.x - lo.x), Math.max(1e-3, hi.y - lo.y), Math.max(1e-3, hi.z - lo.z)];
    const origin: [number, number, number] = [(lo.x + hi.x) / 2, lo.y, (lo.z + hi.z) / 2];
    const meshes: RawMesh[] = [];
    root.traverse((n) => {
      const m = n as TMesh;
      if (!m.isMesh || !m.geometry.attributes.position) return;
      const e = (m.matrixWorld as { elements: number[] }).elements;
      const pa = m.geometry.attributes.position;
      const na = m.geometry.attributes.normal;
      const pos = new Float32Array(pa.count * 3);
      const nor = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i);
        const y = pa.getY(i);
        const z = pa.getZ(i);
        pos[i * 3] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
        pos[i * 3 + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
        pos[i * 3 + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
        if (na) {
          const nx = na.getX(i);
          const ny = na.getY(i);
          const nz = na.getZ(i);
          const ax = e[0]! * nx + e[4]! * ny + e[8]! * nz;
          const ay = e[1]! * nx + e[5]! * ny + e[9]! * nz;
          const az = e[2]! * nx + e[6]! * ny + e[10]! * nz;
          const l = Math.hypot(ax, ay, az) || 1;
          nor[i * 3] = ax / l;
          nor[i * 3 + 1] = ay / l;
          nor[i * 3 + 2] = az / l;
        } else nor[i * 3 + 1] = 1;
      }
      const ix = m.geometry.index;
      const idx = new Uint32Array(ix ? ix.count : pa.count);
      for (let i = 0; i < idx.length; i++) idx[i] = ix ? ix.getX(i) : i;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as TMaterial | undefined;
      const hex = mat?.color?.getHex() ?? 0xcccccc;
      const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      meshes.push({ positions: pos, normals: nor, indices: idx, colour: [lin(((hex >> 16) & 255) / 255), lin(((hex >> 8) & 255) / 255), lin((hex & 255) / 255), mat?.transparent ? mat.opacity : 1] });
    });
    if (!meshes.length) return null;
    this.models.set(id, { meshes, size, origin });
    this.groups.set(id, root);
    // every object of this model is drawn again with the model in it
    for (const o of this.engine.scene.objects) {
      const old = this.drawn.get(o.id);
      if (o.model?.id === id && old) {
        old.root.parent?.remove(old.root);
        this.drawn.delete(o.id);
      }
    }
    this.dirty = true;
    this.sync();
    return { size };
  }

  hasModel(id: string): boolean {
    return this.models.has(id);
  }

  /** Bring what is drawn in line with the Engine's scene: only what changed is rebuilt. */
  sync(): void {
    if (!this.lib || !this.world || !this.three) return;
    const T = this.lib.THREE;
    const sc = this.engine.scene;
    const gk = `${sc.ground.w}x${sc.ground.d}`;
    if (gk !== this.groundKey) {
      this.groundKey = gk;
      if (this.groundMesh) {
        this.world.remove(this.groundMesh);
        this.groundMesh.geometry.dispose();
      }
      if (this.grid) this.world.remove(this.grid);
      const g = new T.BoxGeometry(sc.ground.w / 100, 0.02, sc.ground.d / 100);
      const gm = new T.MeshStandardMaterial({ color: 0x888888, roughness: 1, metalness: 0 });
      this.groundMesh = new T.Mesh(g, gm);
      this.groundMesh.position.set(0, -0.01, 0);
      this.world.add(this.groundMesh);
      const span = Math.max(sc.ground.w, sc.ground.d) / 100;
      const div = Math.max(2, Math.round(span / 0.5));
      this.grid = new T.GridHelper(span, div, 0x888888, 0x888888);
      this.grid.position.y = 0.002;
      this.world.add(this.grid);
    }
    const live = new Set<string>();
    for (const o of sc.objects) {
      live.add(o.id);
      const mid = o.model?.id ?? '';
      const key = `${o.kind}|${o.w}|${o.d}|${o.h}|${o.mat}|${mid && this.models.has(mid) ? 'm' : ''}`;
      let d = this.drawn.get(o.id);
      if (!d || d.key !== key) {
        if (d) {
          d.root.parent?.remove(d.root);
          d.mesh?.geometry.dispose();
        }
        const root = new T.Group();
        let mesh: TMesh | undefined;
        const raw = mid ? this.models.get(mid) : undefined;
        const src = mid ? this.groups.get(mid) : undefined;
        if (o.kind === 'model' && raw && src) {
          const k: [number, number, number] = [o.w / 100 / raw.size[0], o.h / 100 / raw.size[1], o.d / 100 / raw.size[2]];
          const wrap = new T.Group();
          wrap.add((src as unknown as { clone(recursive?: boolean): TObject3D }).clone(true));
          wrap.scale.set(k[0], k[1], k[2]);
          wrap.position.set(-raw.origin[0] * k[0], -raw.origin[1] * k[1], -raw.origin[2] * k[2]);
          root.add(wrap);
        } else {
          mesh = new T.Mesh(this.geometry(o), this.mat(o.mat, o.kind === 'model'));
          root.add(mesh);
        }
        this.world.add(root);
        d = { key, root, mesh };
        this.drawn.set(o.id, d);
      }
      d.root.position.set(o.x / 100, o.y / 100, o.z / 100);
      d.root.rotation.set(0, turnRad(o.rot), 0);
    }
    for (const [id, d] of this.drawn) {
      if (live.has(id)) continue;
      d.root.parent?.remove(d.root);
      d.mesh?.geometry.dispose();
      this.drawn.delete(id);
    }
    this.dirty = true;
    this.request();
  }

  /** The selection's outline and handles, drawn afresh (their size follows the distance, so a finger can hit them). */
  private drawOverlay(): void {
    if (!this.lib || !this.three) return;
    const T = this.lib.THREE;
    const e = this.engine;
    const o = e.obj;
    const accent = rgbVar('--g-accent-rgb', [100, 210, 255]);
    const pos = eye(e.cam);
    const dist = Math.hypot(pos[0] - e.cam.tx, pos[1] - e.cam.ty, pos[2] - e.cam.tz);
    const key = o ? `${o.id}|${o.x}|${o.y}|${o.z}|${o.rot}|${o.w}|${o.d}|${o.h}|${e.tool}|${Math.round(dist * 20)}|${accent}` : `none|${accent}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    if (this.overlay) {
      this.overlay.traverse((n) => {
        const m = n as TMesh;
        if (m.geometry) m.geometry.dispose();
      });
      this.three.remove(this.overlay);
      this.overlay = null;
    }
    if (!o) return;
    const g = new T.Group();
    const line = new T.LineBasicMaterial({ color: accent, depthTest: false, transparent: true, opacity: 0.95 });
    const box = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(o.w / 100, o.h / 100, o.d / 100)), line);
    box.position.set(0, o.h / 200, 0);
    box.renderOrder = 9;
    const frame = new T.Group();
    frame.add(box);
    frame.position.set(o.x / 100, o.y / 100, o.z / 100);
    frame.rotation.set(0, turnRad(o.rot), 0);
    g.add(frame);
    if (e.tool === 'turn') {
      const r = ringOf(o);
      const ring = new T.BufferGeometry();
      const p: number[] = [];
      for (let i = 0; i <= 64; i++) p.push(o.x / 100 + r * Math.cos((i / 64) * Math.PI * 2), 0.02, o.z / 100 + r * Math.sin((i / 64) * Math.PI * 2));
      ring.setAttribute('position', new T.BufferAttribute(new Float32Array(p), 3));
      const ln = new T.Line(ring, line);
      ln.renderOrder = 9;
      g.add(ln);
    }
    const r = Math.max(0.03, dist * 0.022);
    const knob = new T.MeshBasicMaterial({ color: mix(accent, 0xffffff, 0.35), depthTest: false, transparent: true });
    for (const h of e.handles()) {
      const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), knob);
      m.position.set(h.at[0], h.at[1], h.at[2]);
      m.renderOrder = 10;
      g.add(m);
    }
    this.overlay = g;
    this.three.add(g);
  }

  private paint(): void {
    if (!this.renderer || !this.camera || !this.three || !this.lib) return;
    const e = this.engine;
    const c = e.cam;
    const p = eye(c);
    this.camera.fov = c.fov;
    this.camera.position.set(p[0], p[1], p[2]);
    this.camera.lookAt(c.tx, c.ty, c.tz);
    this.camera.near = Math.max(0.02, c.dist / 100);
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
    const canvas = rgbVar('--g-canvas-rgb', [16, 19, 23]);
    const bone = rgbVar('--g-bone-rgb', [236, 232, 223]);
    const light = ((canvas >> 16) & 255) * 0.3 + ((canvas >> 8) & 255) * 0.59 + (canvas & 255) * 0.11 > 140;
    this.renderer.setClearColor(canvas, 1);
    if (this.groundMesh) (this.groundMesh.material as TMaterial).color?.setHex(mix(canvas, bone, light ? 0.12 : 0.1));
    if (this.grid) (this.grid.material as TMaterial).color?.setHex(mix(canvas, bone, 0.32));
    this.drawOverlay();
    this.renderer.render(this.three, this.camera);
    this.frames++;
  }

  /** Ask for a frame (at most one is waiting). */
  request(): void {
    this.dirty = true;
    if (this.raf || !this.running) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.running && this.dirty) {
        this.dirty = false;
        this.paint();
      }
    });
  }

  start(): void {
    this.running = true;
    this.resize();
    this.sync();
    this.request();
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  state() {
    return { ready: !!this.renderer, error: this.error, frames: this.frames, drawn: this.drawn.size, models: [...this.models.keys()] };
  }
}
