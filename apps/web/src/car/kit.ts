/**
 * The car's materials and textures, made once per car: metallic or solid paint under a clear coat, dark glass, gloss-black
 * trim, chrome, rubber with its tread, alloy wheels, lamps that light, the plates drawn as the law has them (white at the
 * front, yellow at the back, the UK band) and the panel gaps drawn onto the paint. Canvas textures, no downloads.
 */
import type { CarSpec } from './spec';
import type { CarLib, O3, TBufferGeometry, TMaterial, TMesh, TObject3D, TTex } from './three';

export interface Mats {
  paint: TMaterial;
  /** The bonnet: the same paint, seen from underneath too when it is up. */
  bonnet: TMaterial;
  glass: TMaterial;
  trim: TMaterial;
  plastic: TMaterial;
  chrome: TMaterial;
  rubber: TMaterial;
  tyre: TMaterial;
  alloy: TMaterial;
  steel: TMaterial;
  caliper: TMaterial;
  head: TMaterial;
  drl: TMaterial;
  tail: TMaterial;
  amber: TMaterial;
  plateFront: TMaterial;
  plateRear: TMaterial;
  grille: TMaterial;
  alu: TMaterial;
  block: TMaterial;
  hose: TMaterial;
  pot: TMaterial;
  pink: TMaterial;
  yellow: TMaterial;
  blue: TMaterial;
  red: TMaterial;
  floor: TMaterial;
  orange: TMaterial;
  rust: TMaterial;
}

const canvas = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });

function tex(L: CarLib, c: HTMLCanvasElement, srgb = true): TTex {
  const t = new L.T.CanvasTexture(c);
  if (srgb) t.colorSpace = L.T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A UK plate: black characters on white (front) or yellow (back), the blue UK band on the left. */
export function plateTex(L: CarLib, text: string, rear: boolean): TTex {
  const c = canvas(1040, 224);
  const g = c.getContext('2d')!;
  g.fillStyle = rear ? '#f4c400' : '#f6f6f2';
  g.beginPath();
  g.roundRect(0, 0, 1040, 224, 22);
  g.fill();
  g.fillStyle = '#0a3d9e';
  g.fillRect(10, 10, 100, 204);
  g.fillStyle = '#fff';
  g.font = 'bold 54px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.fillText('UK', 60, 186);
  g.fillStyle = '#111';
  g.textBaseline = 'middle';
  g.save();
  g.translate(575, 116);
  // the plate's font is tall and narrow: a bold face squeezed
  g.scale(0.78, 1);
  g.font = 'bold 172px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  g.fillText(text || '', 0, 0);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(3, 3, 1034, 218, 20);
  g.stroke();
  return tex(L, c);
}

/** The tread, as a bump map: three grooves round the tyre, sipes across, and the 1.6 mm wear bars in the grooves. */
export function treadTex(L: CarLib): TTex {
  const c = canvas(128, 256);
  const g = c.getContext('2d')!;
  // v runs across the tyre (the sidewalls at the ends, the tread in the middle); u runs round it
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 70, 128, 116);
  g.fillStyle = '#1a1a1a';
  for (const y of [92, 126, 160]) g.fillRect(0, y - 5, 128, 10);
  g.strokeStyle = '#3a3a3a';
  g.lineWidth = 3;
  for (let x = 0; x < 128; x += 16) {
    g.beginPath();
    g.moveTo(x, 72);
    g.lineTo(x + 10, 86);
    g.moveTo(x + 8, 100);
    g.lineTo(x + 18, 120);
    g.moveTo(x + 4, 134);
    g.lineTo(x + 14, 154);
    g.moveTo(x + 10, 168);
    g.lineTo(x + 20, 184);
    g.stroke();
  }
  // the wear bars: raised blocks across each groove at intervals
  g.fillStyle = '#7d7d7d';
  for (const y of [92, 126, 160]) g.fillRect(56, y - 5, 12, 10);
  const t = tex(L, c, false);
  t.wrapS = L.T.RepeatWrapping;
  t.repeat.set(28, 1);
  return t;
}

/** The tread as colour too: the grooves dark, the wear bars lighter (seen close in the WHEEL view). */
export function treadColourTex(L: CarLib): TTex {
  const c = canvas(128, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = '#262626';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#2e2e2e';
  g.fillRect(0, 70, 128, 116);
  g.fillStyle = '#0b0b0b';
  for (const y of [92, 126, 160]) g.fillRect(0, y - 5, 128, 10);
  g.fillStyle = '#4a4a4a';
  for (const y of [92, 126, 160]) g.fillRect(56, y - 5, 12, 10);
  const t = tex(L, c);
  t.wrapS = L.T.RepeatWrapping;
  t.repeat.set(28, 1);
  return t;
}

/** Soft round light: the glow round a lit part, the pools of the headlamps at night. */
export function glowTex(L: CarLib, rgb = '255,180,60'): TTex {
  const c = canvas(128, 128);
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, `rgba(${rgb},1)`);
  r.addColorStop(0.35, `rgba(${rgb},.55)`);
  r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return tex(L, c);
}

/** The car's soft shadow on the ground: its footprint blurred, darker under each tyre. The canvas runs along the car (x, the
 *  front to the right) and across it (z, +z lower down), as the ground plane under it maps it. `l`, `w` in metres. */
export function shadowTex(L: CarLib, l: number, w: number, wheels: [number, number][]): TTex {
  const W = 512;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d')!;
  const sx = (x: number) => W / 2 + (x / (l + 0.8)) * W;
  const sy = (z: number) => H / 2 + (z / (w + 0.8)) * H;
  // the shadow trick: draw the shape off the canvas and let only its blurred shadow land on it
  g.shadowColor = 'rgba(0,0,0,.8)';
  g.shadowBlur = 24;
  g.shadowOffsetX = 2000;
  g.fillStyle = '#000';
  g.beginPath();
  g.roundRect(sx(-l / 2 + 0.06) - 2000, sy(-w / 2 + 0.05), sx(l / 2 - 0.06) - sx(-l / 2 + 0.06), sy(w / 2 - 0.05) - sy(-w / 2 + 0.05), 36);
  g.fill();
  g.shadowBlur = 9;
  g.shadowColor = 'rgba(0,0,0,.95)';
  for (const [x, z] of wheels) {
    g.beginPath();
    g.ellipse(sx(x) - 2000, sy(z), 30, 13, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tex(L, c);
}

/** The floor: a soft studio floor, lighter where the car stands. */
export function floorTex(L: CarLib): TTex {
  const c = canvas(512, 512);
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(256, 256, 10, 256, 256, 256);
  r.addColorStop(0, '#d9dcdf');
  r.addColorStop(0.55, '#b4b9be');
  r.addColorStop(1, '#8e959c');
  g.fillStyle = r;
  g.fillRect(0, 0, 512, 512);
  // a little grain, so it reads as a surface
  const img = g.getImageData(0, 0, 512, 512);
  let s = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const n = ((s % 21) - 10) * 0.9;
    img.data[i] = img.data[i]! + n;
    img.data[i + 1] = img.data[i + 1]! + n;
    img.data[i + 2] = img.data[i + 2]! + n;
  }
  g.putImageData(img, 0, 0);
  return tex(L, c);
}

/** A honeycomb grille. */
export function grilleTex(L: CarLib): TTex {
  const c = canvas(256, 128);
  const g = c.getContext('2d')!;
  g.fillStyle = '#050505';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#3c3f43';
  g.lineWidth = 3;
  for (let y = 0; y < 140; y += 18) {
    for (let x = (y / 18) % 2 ? 11 : 0; x < 270; x += 22) {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const px = x + Math.cos(a) * 9;
        const py = y + Math.sin(a) * 9;
        if (k) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
      g.stroke();
    }
  }
  const t = tex(L, c);
  t.wrapS = L.T.RepeatWrapping;
  t.wrapT = L.T.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/** The panel gaps on the paint: lines in u (along the car, 0 at the front) and v (round the body; the right side 0–0.5, the left 0.5–1). */
export function gapsTex(L: CarLib, lines: { u0: number; u1: number; v0: number; v1: number }[]): TTex {
  const W = 2048;
  const H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1c1c1c';
  for (const l of lines) {
    const x0 = Math.min(l.u0, l.u1) * W;
    const x1 = Math.max(l.u0, l.u1) * W;
    const y0 = (1 - Math.max(l.v0, l.v1)) * H;
    const y1 = (1 - Math.min(l.v0, l.v1)) * H;
    g.fillRect(x0 - 1.2, y0 - 1.2, Math.max(2.4, x1 - x0 + 2.4), Math.max(2.4, y1 - y0 + 2.4));
  }
  return tex(L, c);
}

/** Every material, for this car's paint. */
export function makeMats(L: CarLib, spec: CarSpec): Mats {
  const T = L.T;
  const P = (o: Record<string, unknown>) => new T.MeshPhysicalMaterial(o);
  const S = (o: Record<string, unknown>) => new T.MeshStandardMaterial(o);
  const m = spec.paint.metallic;
  const paint = P({ color: spec.paint.hex, metalness: m ? 0.55 : 0.02, roughness: m ? 0.3 : 0.36, clearcoat: 1, clearcoatRoughness: 0.035, side: T.DoubleSide });
  const plate = (rear: boolean) => S({ map: plateTex(L, spec.plate, rear), roughness: 0.32, metalness: 0, emissive: 0x000000, emissiveMap: null });
  return {
    paint,
    bonnet: paint,
    glass: P({ color: 0x0b1016, metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02 }),
    trim: P({ color: 0x060708, metalness: 0.2, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
    plastic: S({ color: 0x17191c, roughness: 0.78, metalness: 0 }),
    chrome: S({ color: 0xf2f4f6, metalness: 1, roughness: 0.08 }),
    rubber: S({ color: 0x151515, roughness: 0.9, metalness: 0 }),
    tyre: S({ color: 0xffffff, map: treadColourTex(L), bumpMap: treadTex(L), bumpScale: 2.2, roughness: 0.88, metalness: 0 }),
    alloy: S({ color: 0xc9cdd2, metalness: 1, roughness: 0.28 }),
    steel: S({ color: 0x8e9196, metalness: 0.85, roughness: 0.38 }),
    caliper: S({ color: spec.silhouette === 'coupe' ? 0xb3141a : 0x2a2d31, metalness: 0.3, roughness: 0.42 }),
    head: P({ color: 0xd9e0e7, metalness: 0.92, roughness: 0.06, clearcoat: 1, emissive: 0xfff3dc, emissiveIntensity: 0 }),
    drl: S({ color: 0xffffff, emissive: 0xeef6ff, emissiveIntensity: 1.6, roughness: 0.2 }),
    tail: P({ color: 0x4e0307, metalness: 0.2, roughness: 0.12, clearcoat: 1, emissive: 0xff1208, emissiveIntensity: 0.12 }),
    amber: P({ color: 0x7a4300, metalness: 0.3, roughness: 0.15, clearcoat: 1, emissive: 0xff8a00, emissiveIntensity: 0 }),
    plateFront: plate(false),
    plateRear: plate(true),
    grille: S({ color: 0xffffff, map: grilleTex(L), metalness: 0.4, roughness: 0.45 }),
    alu: S({ color: 0xa7acb2, metalness: 0.85, roughness: 0.42 }),
    block: S({ color: 0x3d4146, metalness: 0.55, roughness: 0.55 }),
    hose: S({ color: 0x101010, roughness: 0.55, metalness: 0 }),
    pot: P({ color: 0xe8e4d8, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.82 }),
    pink: S({ color: 0xff4fa3, roughness: 0.3, emissive: 0x401028, emissiveIntensity: 0.4 }),
    yellow: S({ color: 0xffc400, roughness: 0.4 }),
    blue: S({ color: 0x1660d8, roughness: 0.4 }),
    red: S({ color: 0xd11a1a, roughness: 0.45 }),
    floor: S({ color: 0x1b1d20, roughness: 0.85 }),
    orange: S({ color: 0xff7a00, roughness: 0.5 }),
    rust: S({ color: 0x5b4636, roughness: 0.9, metalness: 0.2 }),
  };
}

/** A part's id on an object (what a tap names, what lights up). */
export function tag<T extends TObject3D>(o: T, part: string): T {
  o.traverse((x) => (x.userData.part = part));
  return o;
}

/** A mesh, named for the part it belongs to. */
export function mesh(L: CarLib, g: TBufferGeometry, m: TMaterial, part = '', at?: [number, number, number]): TMesh {
  const x = new L.T.Mesh(g, m) as TMesh;
  if (part) x.userData.part = part;
  if (at) x.position.set(at[0], at[1], at[2]);
  return x;
}

type Movable = TBufferGeometry & { applyMatrix4(m: unknown): TBufferGeometry; toNonIndexed(): TBufferGeometry };

/** Several geometries, placed, as one: one draw call. */
export function merge(L: CarLib, parts: { g: TBufferGeometry; at?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] }[]): TBufferGeometry {
  const T = L.T;
  const out: TBufferGeometry[] = [];
  for (const p of parts) {
    const o = new T.Object3D() as O3;
    if (p.at) o.position.set(p.at[0], p.at[1], p.at[2]);
    if (p.rot) o.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
    if (p.scale) o.scale.set(p.scale[0], p.scale[1], p.scale[2]);
    o.updateMatrixWorld(true);
    const g = p.g as Movable;
    g.applyMatrix4(o.matrixWorld);
    // mergeGeometries wants every one indexed or none: none (three's built-ins all carry position, normal and uv)
    out.push(g.index ? g.toNonIndexed() : g);
  }
  return L.U.mergeGeometries(out) ?? out[0]!;
}
