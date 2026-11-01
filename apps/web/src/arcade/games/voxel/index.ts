/**
 * THE BLOCK WORLD, as an Engine: a world of our own blocks drawn with three.js from greedy-meshed chunks, streamed in
 * round the player within a view distance of five chunks (80 blocks: about 80 chunks and 150,000 triangles on screen,
 * an easy load for a phone's GPU at 60 fps; fog closes the edge; the drawing resolution steps down before a frame is
 * missed, and the distance drops to four chunks if even that is not enough). Day turns to night (eight minutes a
 * day). The left thumb walks, the right drags to look, a tap digs or places at the reticle, JUMP jumps (and flies, by
 * the pause menu's FLY), BUILD opens one line for Ghosty to build what is said. Three saved worlds through the
 * SaveStore (name, seed, every changed block, where he stood), autosaved. A pad plays it all through the Intent.
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles, EngineHandle } from '../../engines/types';
import type { SaveStore } from '../../engines/saves';
import { type Action, edges, type Intent, touchMove } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { Synth } from '../audio';
import {
  clamp, cssSize, disposeAll, fitCanvas, flatMaterial, type GameEngine, type GameStats, Geo, haptic, hex3, hudButton, type IMesh, type Light,
  Loop, loadThree, makeRenderer, makeSky, type Mat, type Mesh, mix3, num, Overlay, Resolution, setLight, setSky, type ThreeNS,
} from '../kit';
import { BLOCK_WORLD_ID } from '../shelf';
import { doneLine, parseBuild, plan, type Plan, SAY, startLine, STRUCTURES, VOCABULARY_LINE } from './builds';
import { meshChunk, padChunk, type Part } from './mesh';
import {
  AIR, BRICK, chunkKey, COLOURS, CX, CY, decodeSave, DIRT, encodeSave, GLASS, GOLD, GRASS, KIND_NAMES, LEAVES, LOG, PLANKS, SAND, SNOW,
  mulberry32, SOLID, STONE, WATER, World, type WorldSave,
} from './world';

/** What the harness reads (with the frame numbers). */
export interface VoxelStats extends GameStats {
  placed: number;
  dug: number;
  edits: number;
  chunks: number;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  target: [number, number, number] | null;
  slot: string;
  fly: boolean;
  building: number;
  world: string;
  view: number;
}
export interface VoxelHandle extends EngineHandle {
  peek(): VoxelStats;
  /** Measure afresh from now (the harness). */
  resetStats(): void;
}

const SLOTS = [0, GRASS, DIRT, STONE, SAND, PLANKS, BRICK, GLASS, GOLD, LOG, LEAVES, SNOW] as const;
const WORLD_FILES = ['world-1.json', 'world-2.json', 'world-3.json'];
const DAY_SECONDS = 480;
const REACH = 6;
const HALF = 0.3, TALL = 1.8, EYE = 1.62;

const VOXEL_V = `
attribute vec4 aCol;
varying vec3 vCol;
varying vec3 vPos;
varying vec3 vN;
varying float vDist;
varying float vGlass;
void main() {
  float a = floor(aCol.a * 255.0 + 0.5);
  vGlass = a >= 8.0 ? 1.0 : 0.0;
  float d = a - vGlass * 8.0;
  vN = d < 0.5 ? vec3(1.0, 0.0, 0.0) : d < 1.5 ? vec3(-1.0, 0.0, 0.0) : d < 2.5 ? vec3(0.0, 1.0, 0.0) : d < 3.5 ? vec3(0.0, -1.0, 0.0) : d < 4.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 0.0, -1.0);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vCol = aCol.rgb;
  vec4 mv = viewMatrix * wp;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const VOXEL_F = `
uniform vec3 uLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform float uClear;
varying vec3 vCol;
varying vec3 vPos;
varying vec3 vN;
varying float vDist;
varying float vGlass;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 cell = floor(vPos - vN * 0.5);
  vec2 uv = abs(vN.x) > 0.5 ? vPos.zy : (abs(vN.y) > 0.5 ? vPos.xz : vPos.xy);
  vec2 f = fract(uv);
  vec2 m = min(f, 1.0 - f);
  float e = min(m.x, m.y);
  float line = 1.0 - smoothstep(0.0, 0.03 + fwidth(e) * 1.5, e);
  float near = 1.0 - smoothstep(14.0, 36.0, vDist);
  vec3 c = vCol * (0.96 + hash(cell) * 0.08);
  float alpha = 1.0;
  if (uClear > 0.5) {
    if (vGlass > 0.5) {
      alpha = 0.3 + line * 0.6;
      c = mix(c, vec3(1.0), 0.12);
      line *= 1.6;
    } else {
      float r = sin(uTime * 1.9 + vPos.x * 1.1 + sin(vPos.z * 0.8 + uTime * 0.7) * 1.5) * 0.5 + 0.5;
      c *= 0.9 + 0.16 * r;
      alpha = 0.8;
      line = 0.0;
    }
  }
  c *= 1.0 - 0.14 * line * near;
  c *= uLight;
  c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, vDist));
  gl_FragColor = vec4(c, alpha);
}`;

function voxelMaterial(T: ThreeNS, clear: boolean): Mat {
  return new T.ShaderMaterial({
    vertexShader: VOXEL_V,
    fragmentShader: VOXEL_F,
    uniforms: {
      uLight: { value: [1, 1, 1] },
      uFogColor: { value: [0.7, 0.8, 0.9] },
      uFogNear: { value: 40 },
      uFogFar: { value: 76 },
      uTime: { value: 0 },
      uClear: { value: clear ? 1 : 0 },
    },
    transparent: clear,
    depthWrite: !clear,
  });
}

interface ChunkMesh {
  cx: number;
  cz: number;
  opaque: Mesh | null;
  clear: Mesh | null;
}

interface Particle {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; c: [number, number, number];
}

type Mode = 'title' | 'worlds' | 'howto' | 'play' | 'paused' | 'build' | 'gone';

export const voxelEngine: GameEngine = {
  id: 'voxel',
  start: (canvas, files, intent, ev, opts) => startVoxel(canvas, files, intent, ev, opts),
};

async function startVoxel(canvas: HTMLCanvasElement, _files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean }): Promise<VoxelHandle> {
  const t0 = performance.now();
  const T = await loadThree();
  fitCanvas(canvas);
  const renderer = makeRenderer(T, canvas);
  const res = new Resolution();
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(75, 1, 0.08, 500);
  const sky = makeSky(T);
  scene.add(sky);
  const opaqueMat = voxelMaterial(T, false);
  const clearMat = voxelMaterial(T, true);
  const synth = new Synth(opts.sound);
  const saves = opts.saves;

  // ---------------------------------------------------------------- the world and its meshes
  let world = new World(2026);
  let slot = -1; // which saved world is open (−1: the title's view)
  let save: WorldSave | null = null;
  let view = 5;
  const meshes = new Map<string, ChunkMesh>();
  const dirty = new Set<string>();
  let centre = '';
  let complete = false;
  const geomOf = (p: Part) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p.pos, 3));
    g.setAttribute('aCol', new T.BufferAttribute(p.col, 4, true));
    g.setIndex(new T.BufferAttribute(p.idx, 1));
    g.computeBoundingSphere();
    return g;
  };
  const dropMesh = (m: ChunkMesh) => {
    for (const part of [m.opaque, m.clear]) if (part) scene.remove(part), part.geometry.dispose();
  };
  const buildMesh = (cx: number, cz: number) => {
    const key = chunkKey(cx, cz);
    const old = meshes.get(key);
    if (old) dropMesh(old);
    const md = meshChunk(padChunk(world.chunk(cx, cz), world.chunk(cx - 1, cz), world.chunk(cx + 1, cz), world.chunk(cx, cz - 1), world.chunk(cx, cz + 1)));
    const make = (p: Part, mat: Mat): Mesh | null => {
      if (!p.quads) return null;
      const mesh = new T.Mesh(geomOf(p), mat);
      mesh.position.set(cx * CX, 0, cz * CX);
      scene.add(mesh);
      return mesh;
    };
    meshes.set(key, { cx, cz, opaque: make(md.opaque, opaqueMat), clear: make(md.clear, clearMat) });
  };
  const clearMeshes = () => {
    for (const m of meshes.values()) dropMesh(m);
    meshes.clear();
    dirty.clear();
    centre = '';
  };
  /** Bring the meshes round (px, pz) up to date within `budget` ms: edited chunks first, then the nearest missing. */
  const stream = (px: number, pz: number, budget: number) => {
    const t = performance.now();
    const pcx = Math.floor(px / CX), pcz = Math.floor(pz / CX);
    for (const key of dirty) {
      const [cx, cz] = key.split(',').map(Number) as [number, number];
      dirty.delete(key);
      if (meshes.has(key)) buildMesh(cx, cz);
      if (performance.now() - t > budget) return;
    }
    const here = `${pcx},${pcz},${view}`;
    if (here !== centre) {
      centre = here;
      complete = false;
      for (const [key, m] of meshes) {
        if ((m.cx - pcx) ** 2 + (m.cz - pcz) ** 2 > (view + 1.5) ** 2) {
          dropMesh(m);
          meshes.delete(key);
        }
      }
      for (const key of world.chunks.keys()) {
        const [cx, cz] = key.split(',').map(Number) as [number, number];
        if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (view + 3) ** 2) world.drop(cx, cz);
      }
    }
    if (complete) return;
    const want: [number, number, number][] = [];
    for (let dz = -view; dz <= view; dz++) {
      for (let dx = -view; dx <= view; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 <= view * view && !meshes.has(chunkKey(pcx + dx, pcz + dz))) want.push([d2, pcx + dx, pcz + dz]);
      }
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of want) {
      buildMesh(cx, cz);
      if (performance.now() - t > budget) return;
    }
    complete = true;
  };
  const setBlock = (x: number, y: number, z: number, k: number) => {
    for (const key of world.set(x, y, z, k)) dirty.add(key);
  };

  // ---------------------------------------------------------------- the player
  const P = { x: 8.5, y: 40, z: 8.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.5, ground: false, fly: false, water: false };
  let placed = 0, dug = 0, stepT = 0, savedEdits = 0, autosaveT = 0, time = 0.08;
  let tool = 3; // the hotbar slot (0: DIG)
  const spawn = () => {
    // the nearest dry land to the middle of the world
    for (let r = 0; r < 96; r += 4) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(8 + Math.cos((a / 8) * Math.PI * 2) * r), z = Math.round(8 + Math.sin((a / 8) * Math.PI * 2) * r);
        const y = world.surface(x, z);
        if (world.get(x, y, z) !== WATER && y < CY - 3) return { x: x + 0.5, y: y + 1, z: z + 0.5 };
        if (r === 0) break;
      }
    }
    return { x: 8.5, y: world.surface(8, 8) + 1, z: 8.5 };
  };
  const hits = (x: number, y: number, z: number) => {
    for (let by = Math.floor(y); by <= Math.floor(y + TALL - 1e-3); by++)
      for (let bz = Math.floor(z - HALF); bz <= Math.floor(z + HALF - 1e-3); bz++)
        for (let bx = Math.floor(x - HALF); bx <= Math.floor(x + HALF - 1e-3); bx++) if (SOLID[world.get(bx, by, bz)]) return true;
    return false;
  };
  /** Move along one axis as far as nothing solid is in the way; says whether something stopped it. */
  const slide = (axis: 'x' | 'y' | 'z', d: number): boolean => {
    if (!d) return false;
    const steps = Math.ceil(Math.abs(d) / 0.25);
    const s = d / steps;
    for (let i = 0; i < steps; i++) {
      P[axis] += s;
      if (hits(P.x, P.y, P.z)) {
        // stop flush against the block it ran into
        if (axis === 'y') P.y = s < 0 ? Math.floor(P.y) + 1 : Math.floor(P.y + TALL) - TALL - 1e-3;
        else P[axis] = s > 0 ? Math.floor(P[axis] + HALF) - HALF - 1e-3 : Math.floor(P[axis] - HALF) + 1 + HALF + 1e-3;
        return true;
      }
    }
    return false;
  };
  const eye = () => [P.x, P.y + EYE, P.z] as const;
  const lookDir = (): [number, number, number] => [-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)];

  // ---------------------------------------------------------------- the scene's extras: the outline, the dust
  const outlineGeo = new T.BufferGeometry();
  {
    const e = [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1];
    outlineGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(e.map((v) => (v ? 1.004 : -0.004))), 3));
  }
  const outline = new T.LineSegments(outlineGeo, new T.LineBasicMaterial({ color: 0x0b0f14, transparent: true, opacity: 0.6 }));
  outline.visible = false;
  scene.add(outline);
  const dustMat = flatMaterial(T);
  const dust = new T.InstancedMesh(new Geo().box(0, 0, 0, 1, 1, 1, 0xffffff).build(T), dustMat, 48) as IMesh;
  dust.frustumCulled = false;
  dust.setColorAt(0, new T.Color(0xffffff)); // the instance colours exist from the first frame (no shader rebuild on the first dig)
  dust.count = 0;
  scene.add(dust);
  // clouds: a tile of soft blocks high up, the same tile over and over (each cell's chance repeats with it, so no
  // seam), four copies round him, drifting with the wind
  const CLOUD_TILE = 384, CELL = 12, CN = CLOUD_TILE / CELL, CLOUD_Y = 58;
  const cloudGeo = (() => {
    const r = mulberry32(31337);
    const v = Float32Array.from({ length: CN * CN }, () => r());
    const at = (i: number, j: number) => v[(((j % CN) + CN) % CN) * CN + (((i % CN) + CN) % CN)]!;
    const on = (i: number, j: number) => (at(i, j) * 4 + at(i + 1, j) + at(i - 1, j) + at(i, j + 1) + at(i, j - 1)) / 8 > 0.56;
    const g = new Geo();
    for (let j = 0; j < CN; j++) {
      for (let i = 0; i < CN; i++) {
        if (!on(i, j)) continue;
        // the sides between two cloud cells are left out (a cloud is one soft mass)
        const skip = (on(i + 1, j) ? 1 : 0) | (on(i - 1, j) ? 2 : 0) | (on(i, j + 1) ? 16 : 0) | (on(i, j - 1) ? 32 : 0);
        g.box(i * CELL + CELL / 2, 0, j * CELL + CELL / 2, CELL, 3, CELL, 0xffffff, 40, skip);
      }
    }
    return g.build(T);
  })();
  const clouds = [0, 1, 2, 3].map(() => {
    const m = new T.Mesh(cloudGeo, dustMat);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  let drift = 0;
  const placeClouds = (cx: number, cz: number, dt: number) => {
    drift = (drift + dt * 1.2) % CLOUD_TILE;
    const ox = Math.floor((cx - drift) / CLOUD_TILE) * CLOUD_TILE + drift, oz = Math.floor(cz / CLOUD_TILE) * CLOUD_TILE;
    const ox2 = ox + (cx - ox > CLOUD_TILE / 2 ? CLOUD_TILE : -CLOUD_TILE), oz2 = oz + (cz - oz > CLOUD_TILE / 2 ? CLOUD_TILE : -CLOUD_TILE);
    [[ox, oz], [ox2, oz], [ox, oz2], [ox2, oz2]].forEach(([x, z], i) => clouds[i]!.position.set(x!, CLOUD_Y, z!));
  };
  const dummy = new T.Object3D();
  const tint = new T.Color();
  const parts: Particle[] = [];
  const burst = (x: number, y: number, z: number, k: number) => {
    const c = hex3(COLOURS[k]![1]!);
    for (let i = 0; i < 10; i++) {
      if (parts.length >= 48) parts.shift();
      parts.push({ x: x + 0.2 + Math.random() * 0.6, y: y + 0.2 + Math.random() * 0.6, z: z + 0.2 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.5 + Math.random() * 0.3, c });
    }
  };

  // ---------------------------------------------------------------- sound
  const blockSound = (k: number, place: boolean) => {
    const hard = k === STONE || k === BRICK || k === GOLD || k === GLASS;
    const wood = k === PLANKS || k === LOG;
    if (k === GLASS && !place) {
      synth.noise({ dur: 0.25, f: 5200, to: 2600, q: 2, vol: 0.22 });
      synth.tone({ f: 2400, to: 1800, dur: 0.12, type: 'triangle', vol: 0.05 });
    } else if (hard) synth.noise({ dur: place ? 0.07 : 0.14, f: place ? 1500 : 2300, to: 900, q: 1.4, vol: 0.3 });
    else if (wood) synth.tone({ f: place ? 260 : 210, to: 140, dur: 0.09, type: 'triangle', vol: 0.32 });
    else synth.noise({ dur: place ? 0.08 : 0.16, f: place ? 600 : 420, to: 220, q: 0.9, vol: 0.32 });
    if (place) synth.tone({ f: 120, to: 70, dur: 0.07, vol: 0.22 });
  };

  // ---------------------------------------------------------------- the overlay
  const ui = new Overlay(canvas, 'g2vox', 'The block world');
  const say = (line: string, ms?: number) => ui.say(line, ms);
  const reticle = h('div.g2ret', { 'aria-hidden': 'true' });
  const under = h('div.g2under', { 'aria-hidden': 'true' });
  const touch = h('div.g2touch', { role: 'application', 'aria-label': 'Left thumb: walk. Right thumb: drag to look, tap to dig or place where the cross points.' });
  const base = h('div.g2base', { 'aria-hidden': 'true' }, h('i.g2knob'));
  const slotBtns = SLOTS.map((k, i) => {
    const b = hudButton(`g2slot${k === 0 ? '.dig' : ''}`, k === 0 ? 'DIG' : '', k === 0 ? 'Dig: a tap breaks the block the cross points at' : `Place ${KIND_NAMES[k]}: a tap puts it where the cross points`, () => pick(i));
    // the swatch: a block's side colour (grass and snow by their tops, as he sees them on the ground)
    if (k) b.style.setProperty('--sw', `#${COLOURS[k]![k === GRASS || k === SNOW ? 0 : 1]!.toString(16).padStart(6, '0')}`);
    b.dataset.slot = String(i);
    return b;
  });
  const bar = h('div.g2bar', { role: 'toolbar', 'aria-label': 'Blocks' }, ...slotBtns);
  const jumpBtn = hudButton('g2jump', 'JUMP', 'Jump (in flight: up)', () => (held.jump = true));
  const downBtn = hudButton('g2down', 'DOWN', 'Fly down', () => (held.down = true));
  for (const [b, k] of [[jumpBtn, 'jump'], [downBtn, 'down']] as const) {
    const off = () => (held[k] = false);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
  }
  const buildBtn = hudButton('g2buildbtn', 'BUILD', 'Build: tell Ghosty what to build', () => openBuild());
  const pauseBtn = hudButton('g2pause', '', 'Pause', () => openPause());
  ui.layer.append(touch, base, reticle, under, bar, buildBtn, jumpBtn, downBtn, pauseBtn);
  const held = { jump: false, down: false };
  const setMode = (m: Mode) => {
    mode = m;
    ui.root.dataset.mode = m;
    ui.root.classList.toggle('flying', P.fly);
  };
  let mode: Mode = 'title';
  const pick = (i: number) => {
    tool = (i + SLOTS.length) % SLOTS.length;
    slotBtns.forEach((b, j) => b.classList.toggle('sel', j === tool)); // (not "on": the app gives every button.on its accent)
    const b = slotBtns[tool]!;
    if (b.offsetLeft < bar.scrollLeft) bar.scrollLeft = b.offsetLeft - 8;
    else if (b.offsetLeft + b.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = b.offsetLeft + b.offsetWidth - bar.clientWidth + 8;
    ui.announce(tool === 0 ? 'Dig' : `Placing ${KIND_NAMES[SLOTS[tool]!]}`);
  };
  pick(tool);

  // the touch layer: left thumb walks (the stick appears where it lands), right thumb looks, a tap acts
  let stickId = -1, lookId = -1;
  let sx0 = 0, sy0 = 0, lx = 0, ly = 0, lMoved = 0, lT = 0;
  const stickV = { x: 0, y: 0 };
  touch.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    synth.wake();
    try {
      touch.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    const r = touch.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.45 && stickId < 0) {
      stickId = e.pointerId;
      sx0 = e.clientX;
      sy0 = e.clientY;
      base.style.transform = `translate(${sx0 - r.left}px, ${sy0 - r.top}px)`;
      base.classList.add('on');
    } else if (lookId < 0) {
      lookId = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      lMoved = 0;
      lT = performance.now();
    }
  });
  touch.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      const dx = e.clientX - sx0, dy = e.clientY - sy0;
      const m = touchMove(dx, dy, 56);
      stickV.x = m.moveX;
      stickV.y = m.moveY;
      const len = Math.hypot(dx, dy), k = len > 56 ? 56 / len : 1;
      (base.firstChild as HTMLElement).style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    } else if (e.pointerId === lookId) {
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      lMoved += Math.abs(dx) + Math.abs(dy);
      if (mode === 'play') turn(dx * 0.32, -dy * 0.32);
    }
  });
  const lift = (e: PointerEvent) => {
    if (e.pointerId === stickId) {
      stickId = -1;
      stickV.x = stickV.y = 0;
      base.classList.remove('on');
      (base.firstChild as HTMLElement).style.transform = '';
    } else if (e.pointerId === lookId) {
      lookId = -1;
      if (e.type === 'pointerup' && lMoved < 12 && performance.now() - lT < 350 && mode === 'play') act(tool === 0 ? 'dig' : 'place');
    }
  };
  touch.addEventListener('pointerup', lift);
  touch.addEventListener('pointercancel', lift);
  const turn = (degX: number, degY: number) => {
    P.yaw -= (degX * Math.PI) / 180;
    P.pitch = clamp(P.pitch + (degY * Math.PI) / 180, -1.55, 1.55);
  };

  // the keyboard (a computer, and the tests)
  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    if (mode === 'build' || (e.target as HTMLElement | null)?.tagName === 'INPUT') return;
    const down = e.type === 'keydown';
    const k = e.key.toLowerCase();
    if (down) keys.add(k);
    else keys.delete(k);
    if (!down) return;
    if (k === 'escape' || k === 'p') mode === 'play' ? openPause() : mode === 'paused' && resumeGame();
    if (mode !== 'play') return;
    if (k === 'b') openBuild();
    if (k === 'e' || k === 'enter') act('place');
    if (k === 'q' || k === 'backspace') act('dig');
    if (/^[1-9]$/.test(k)) pick(Number(k) - 1);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // ---------------------------------------------------------------- digging and placing
  let target: { x: number; y: number; z: number; nx: number; ny: number; nz: number; kind: number } | null = null;
  const act = (what: 'dig' | 'place') => {
    synth.wake();
    if (!target) return;
    if (what === 'dig') {
      const k = target.kind;
      setBlock(target.x, target.y, target.z, AIR);
      dug++;
      burst(target.x, target.y, target.z, k);
      blockSound(k, false);
      haptic(12);
    } else {
      const k = SLOTS[tool] || STONE;
      const x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz;
      const here = world.get(x, y, z);
      if (y < 0 || y >= CY || (here !== AIR && here !== WATER)) return;
      // not inside himself
      if (SOLID[k] && x + 1 > P.x - HALF && x < P.x + HALF && z + 1 > P.z - HALF && z < P.z + HALF && y + 1 > P.y && y < P.y + TALL) return;
      setBlock(x, y, z, k);
      placed++;
      blockSound(k, true);
      haptic(6);
    }
  };

  // ---------------------------------------------------------------- BUILD: what he says, block by block
  let building: { plan: Plan; i: number; per: number; blocks: { x: number; y: number; z: number; k: number; fill: boolean }[]; placed: number } | null = null;
  const buildInput = h('input.g2buildin', { type: 'text', enterKeyHint: 'go', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, placeholder: 'a big stone castle', 'aria-label': 'What should Ghosty build?' });
  const chips = h('div.g2chips', ...STRUCTURES.map((s) => h('button.g2chip', { type: 'button', 'aria-label': `Build ${SAY[s]}`, onclick: () => doBuild(SAY[s]) }, SAY[s])));
  const buildForm = h('form.g2buildbox', { role: 'dialog', 'aria-label': 'Build', onsubmit: (e: Event) => (e.preventDefault(), doBuild(buildInput.value)) },
    h('p.g2line', 'What shall I build? Say a size and a material too.'),
    h('div.g2buildrow', buildInput, h('button.g2btn.pri', { type: 'submit', 'aria-label': 'Build it' }, 'BUILD')),
    chips,
    h('button.g2btn', { type: 'button', 'aria-label': 'Close', onclick: () => closeBuild() }, 'CLOSE'),
  );
  const openBuild = () => {
    if (mode !== 'play') return;
    setMode('build');
    ui.layer.append(buildForm);
    buildInput.value = '';
    setTimeout(() => buildInput.focus(), 30);
  };
  const closeBuild = () => {
    buildForm.remove();
    if (mode === 'build') setMode('play');
  };
  const doBuild = (line: string) => {
    const ask = parseBuild(line);
    if (!ask) {
      say(VOCABULARY_LINE, 8000);
      return;
    }
    if (building) {
      say(`Still on the ${SAY[building.plan.ask.what]}. One thing at a time.`);
      closeBuild();
      return;
    }
    closeBuild();
    const p = plan(ask, (Math.random() * 2 ** 31) | 0);
    // facing: the nearest of the four ways he looks
    const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    const f = Math.abs(s) > Math.abs(c) ? [-Math.sign(s), 0] : [0, -Math.sign(c)];
    const rx = -f[1]!, rz = f[0]!;
    const ox = Math.floor(P.x) + f[0]! * 2, oz = Math.floor(P.z) + f[1]! * 2;
    const by = world.surface(ox + f[0]! * 3, oz + f[1]! * 3) + 1 - p.sink;
    const blocks = p.blocks.map((b) => ({ x: ox + b.x * rx + b.z * f[0]!, y: by + b.y, z: oz + b.x * rz + b.z * f[1]!, k: b.k, fill: !!b.fill }));
    const solid = blocks.filter((b) => b.k !== AIR).length;
    const seconds = clamp(solid / 300, 1.6, 6);
    building = { plan: p, i: 0, per: Math.max(1, Math.ceil(solid / (seconds * 60))), blocks, placed: 0 };
    say(startLine(p), 4000);
  };
  const stepBuild = () => {
    if (!building) return;
    const b = building;
    let n = 0;
    while (b.i < b.blocks.length && n < b.per) {
      const q = b.blocks[b.i++]!;
      if (q.y < 0 || q.y >= CY) continue;
      if (q.k === AIR) {
        if (world.get(q.x, q.y, q.z) !== AIR) setBlock(q.x, q.y, q.z, AIR);
        continue;
      }
      if (q.fill && world.get(q.x, q.y, q.z) !== AIR && world.get(q.x, q.y, q.z) !== WATER) continue;
      // never close a block over him
      if (SOLID[q.k] && q.x + 1 > P.x - HALF && q.x < P.x + HALF && q.z + 1 > P.z - HALF && q.z < P.z + HALF && q.y + 1 > P.y && q.y < P.y + TALL) continue;
      setBlock(q.x, q.y, q.z, q.k);
      b.placed++;
      n++;
      if (b.placed % 6 === 0) synth.tone({ f: 330 + (b.placed % 48) * 9, dur: 0.07, type: 'triangle', vol: 0.06 });
    }
    if (b.i >= b.blocks.length) {
      say(doneLine(b.plan, b.placed), 4200);
      synth.tone({ f: 523, dur: 0.12, type: 'triangle', vol: 0.12 });
      synth.tone({ f: 784, dur: 0.2, type: 'triangle', vol: 0.12, at: 0.1 });
      building = null;
    }
  };

  // ---------------------------------------------------------------- saves
  const listWorlds = async (): Promise<(WorldSave | null)[]> => Promise.all(WORLD_FILES.map(async (f) => decodeSave(await saves.get(f).catch(() => null))));
  const writeWorld = async () => {
    if (slot < 0 || !save) return;
    save.edits = world.editList();
    save.player = { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, fly: P.fly };
    save.time = time;
    save.played = new Date().toISOString();
    save.placed = (save.placed ?? 0) + placed - savedPlaced;
    save.dug = (save.dug ?? 0) + dug - savedDug;
    savedPlaced = placed;
    savedDug = dug;
    savedEdits = world.edits.size;
    await saves.put(WORLD_FILES[slot]!, encodeSave(save)).catch(() => undefined);
  };
  let savedPlaced = 0, savedDug = 0;
  const loadWorld = (s: WorldSave, i: number) => {
    clearMeshes();
    world = new World(s.seed, s.edits);
    save = s;
    slot = i;
    time = Number.isFinite(s.time) ? s.time : 0.08;
    const sp = s.player && Number.isFinite(s.player.x) ? s.player : { ...spawn(), yaw: 0, pitch: -0.5, fly: false };
    Object.assign(P, { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw, pitch: sp.pitch, fly: !!sp.fly, vx: 0, vy: 0, vz: 0 });
    savedEdits = world.edits.size;
    stream(P.x, P.z, 40);
  };
  const NAMES = ['Meadow', 'Highland', 'Lakeside', 'Pinewood', 'Cliffs', 'Dunes', 'Hollow', 'Brook'];
  const newWorld = (i: number): WorldSave => {
    const seed = (Math.random() * 2 ** 31) | 0;
    const now = new Date().toISOString();
    return { v: 1, name: `World ${i + 1}: ${NAMES[seed % NAMES.length]}`, seed, created: now, played: now, time: 0.08, player: { x: NaN, y: 0, z: 0, yaw: 0, pitch: -0.5, fly: false }, edits: [], placed: 0, dug: 0 };
  };

  // ---------------------------------------------------------------- menus
  const best = () => scoreOf(BLOCK_WORLD_ID)?.best ?? 0;
  const soundBtn = () => ({ label: `SOUND: ${synth.on ? 'ON' : 'OFF'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), reopen()) });
  let reopen = () => openTitle();
  const openTitle = () => {
    reopen = openTitle;
    setMode('title');
    ui.menu({
      title: 'THE BLOCK WORLD',
      line: 'Pick a world and walk it. Say BUILD and a thing, and I will put it up beside you, block by block.',
      notes: best() ? [`Your best: ${num(best())} blocks changed in one visit.`] : [],
      buttons: [
        { label: 'PLAY', aria: 'Play: pick one of your three worlds', primary: true, act: () => void openWorlds() },
        { label: 'HOW TO PLAY', act: () => openHow(openTitle) },
        soundBtn(),
        { label: 'QUIT', aria: 'Quit to the arcade', act: () => void leave() },
      ],
    });
  };
  const openHow = (back: () => void) => {
    reopen = () => openHow(back);
    const how = h('div.g2how',
      h('p', 'Left thumb: put it down anywhere on the left and slide to walk. Right thumb: drag to look around.'),
      h('p', 'Tap with your right thumb to dig the block the cross points at, or pick a block along the top and tap to place it.'),
      h('p', 'JUMP jumps. Walk into a single step and you climb it. Turn on FLY in the pause menu to fly: JUMP goes up, DOWN goes down.'),
      h('p', `BUILD: tell me a thing, a size and a material. ${VOCABULARY_LINE.replace('I can build these: ', 'I build: ')}`),
      h('p', 'A controller: left stick walks, right stick looks, A jumps, RT digs, LT places, the bumpers pick a block, Y is BUILD.'),
      h('p', 'Day turns to night every eight minutes. Your world saves itself as you play.'),
    );
    ui.menu({ title: 'HOW TO PLAY', extra: how, buttons: [{ label: 'BACK', act: back }], kind: 'how' });
  };
  const openWorlds = async () => {
    reopen = () => void openWorlds();
    setMode('worlds');
    const list = await listWorlds();
    if (mode !== 'worlds') return;
    const rows = h('div.g2worlds', ...list.map((s, i) => {
      const playBtn = h('button.g2btn.g2world', {
        type: 'button',
        'aria-label': s ? `Play ${s.name}, ${num(s.edits.length / 4)} blocks changed` : `Make a new world in slot ${i + 1}`,
        dataset: { id: `world-${i + 1}` },
        onclick: () => play(i, s),
      }, h('b', s ? s.name : `EMPTY SLOT ${i + 1}`), h('span', s ? `${num(s.edits.length / 4)} blocks changed · ${new Date(s.played).toLocaleDateString('en-GB')}` : 'A new world from a new seed'));
      if (!s) return h('div.g2wrow', playBtn);
      let armed = false;
      const del = h('button.g2btn.g2del', {
        type: 'button',
        'aria-label': `Delete ${s.name}`,
        onclick: async () => {
          if (!armed) {
            armed = true;
            del.textContent = 'SURE?';
            return;
          }
          await saves.put(WORLD_FILES[i]!, new Uint8Array(0)).catch(() => undefined);
          void openWorlds();
        },
      }, 'DELETE');
      return h('div.g2wrow', playBtn, del);
    }));
    ui.menu({ title: 'YOUR WORLDS', line: 'Three worlds, kept on this phone.', extra: rows, buttons: [{ label: 'BACK', act: openTitle }], kind: 'worlds' });
  };
  const play = (i: number, s: WorldSave | null) => {
    synth.wake();
    const sv = s ?? newWorld(i);
    loadWorld(sv, i);
    placed = dug = savedPlaced = savedDug = 0;
    ui.closeMenu();
    setMode('play');
    say(s ? `Back in ${sv.name.replace(/^World \d+: /, '')}. Everything is where you left it.` : `A new world: ${sv.name.replace(/^World \d+: /, '')}. Try BUILD and "a house".`);
    if (!s) void writeWorld();
  };
  const openPause = () => {
    if (mode !== 'play' && mode !== 'build') return;
    buildForm.remove();
    reopen = openPause;
    setMode('paused');
    void writeWorld();
    ui.menu({
      title: 'PAUSED',
      line: save ? `${save.name}. ${num(world.edits.size)} blocks changed, saved.` : undefined,
      buttons: [
        { label: 'RESUME', primary: true, act: () => resumeGame() },
        { label: `FLY: ${P.fly ? 'ON' : 'OFF'}`, aria: `Flying is ${P.fly ? 'on' : 'off'}: tap to turn it ${P.fly ? 'off' : 'on'}`, act: () => ((P.fly = !P.fly), (P.vy = 0), openPause()) },
        { label: 'HOW TO PLAY', act: () => openHow(openPause) },
        soundBtn(),
        { label: 'SAVE AND LEAVE', aria: 'Save this world and go back to the worlds', act: () => void endVisit().then(openTitle) },
        { label: 'QUIT', aria: 'Save and quit to the arcade', act: () => void leave() },
      ],
      kind: 'pause',
    });
    loop.stop();
    draw();
  };
  const resumeGame = () => {
    ui.closeMenu();
    setMode('play');
    if (!hostPaused) loop.start();
  };
  /** The end of a visit to a world: saved, its score kept. */
  const endVisit = async () => {
    if (slot < 0) return;
    await writeWorld();
    const n = placed + dug;
    if (n > 0) {
      const r = recordScore(BLOCK_WORLD_ID, n);
      say(`Saved. ${num(n)} blocks changed this time${r.isBest ? ', your best yet' : ''}.`);
    }
    placed = dug = savedPlaced = savedDug = 0;
    building = null;
    slot = -1;
    save = null;
  };

  // ---------------------------------------------------------------- light, sky, the frame
  const light: Light = { sun: [0.4, 0.8, 0.3], tint: [1, 1, 1], fog: [0.7, 0.8, 0.9], fogNear: 40, fogFar: 76 };
  const NIGHT_TOP = hex3(0x0a1230), DAY_TOP = hex3(0x3b82d6), NIGHT_HOR = hex3(0x1b2747), DAY_HOR = hex3(0xb2dcf5), DAWN = hex3(0xf2a46c);
  const sunLight = () => {
    const th = time * Math.PI * 2;
    const sun: [number, number, number] = [Math.cos(th) * 0.9, Math.sin(th), 0.35];
    const l = Math.hypot(...sun);
    sun[0] /= l; sun[1] /= l; sun[2] /= l;
    const day = clamp((sun[1] + 0.12) / 0.37, 0, 1);
    const dd = day * day * (3 - 2 * day);
    const dawn = Math.exp(-((sun[1] / 0.2) ** 2)) * 0.85;
    const top = mix3(NIGHT_TOP, DAY_TOP, dd);
    const hor = mix3(mix3(NIGHT_HOR, DAY_HOR, dd), DAWN, dawn * (0.3 + 0.7 * dd));
    const t = mix3([0.3, 0.34, 0.52], [1, 1, 1], dd);
    const warm = mix3([1, 1, 1], [1.08, 0.9, 0.78], dawn * 0.7);
    light.tint = [t[0] * warm[0], t[1] * warm[1], t[2] * warm[2]];
    light.sun = sun[1] > 0 ? sun : [-sun[0], -sun[1], -sun[2]];
    light.fog = hor;
    light.fogFar = view * CX - 4;
    light.fogNear = light.fogFar * 0.55;
    // under the horizon the sky is the fog's own colour: past the last chunk the world melts into the haze, no seam
    setSky(sky, { top, horizon: hor, bottom: hor, sunCol: mix3([1, 0.62, 0.35], [1, 0.95, 0.8], dd), sunDir: sun, moonDir: [-sun[0], -sun[1], -sun[2]], stars: 1 - dd });
  };
  const applyLight = (t: number) => {
    const [ex, ey, ez] = eye();
    const wet = world.get(Math.floor(ex), Math.floor(ey), Math.floor(ez)) === WATER;
    under.classList.toggle('on', wet && (mode === 'play' || mode === 'paused'));
    const fog = wet ? ([0.08, 0.26, 0.42] as [number, number, number]) : light.fog;
    for (const m of [opaqueMat, clearMat]) {
      const u = m.uniforms;
      u.uLight!.value = light.tint;
      u.uFogColor!.value = fog;
      u.uFogNear!.value = wet ? 1 : light.fogNear;
      u.uFogFar!.value = wet ? 16 : light.fogFar;
      u.uTime!.value = t;
    }
    setLight(dustMat, light);
  };

  let firstFrameMs: number | null = null;
  let size = { w: 0, h: 0, s: 0 };
  const fit = () => {
    const { w, h: hh } = cssSize(canvas);
    if (w === size.w && hh === size.h && res.scale === size.s) return;
    size = { w, h: hh, s: res.scale };
    renderer.setPixelRatio(res.scale);
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.fov = w < hh ? 78 : 70;
    camera.updateProjectionMatrix();
  };
  const draw = () => {
    fit();
    const [ex, ey, ez] = eye();
    if (mode === 'play' || mode === 'paused' || mode === 'build') {
      camera.position.set(ex, ey, ez);
      const d = lookDir();
      camera.lookAt(ex + d[0], ey + d[1], ez + d[2]);
    }
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);
    renderer.render(scene, camera);
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };

  let clock = 0, orbit = 0;
  let prevHeld = new Set<Action>();
  let starve = 0;
  const frame = (dt: number) => {
    clock += dt;
    // a controller in a menu moves through it
    if (ui.menuOpen) ui.menuPad(intent);
    const e = edges(prevHeld, intent.held);
    prevHeld = new Set(intent.held);
    if (mode === 'play') {
      if (e.down.includes('pause')) openPause();
      if (e.down.includes('fire')) act('dig');
      if (e.down.includes('use')) act('place');
      if (e.down.includes('weapon')) pick(tool + 1);
      if (e.down.includes('weaponPrev')) pick(tool - 1);
      if (e.down.includes('map')) openBuild();
    }
    if (mode === 'play' || mode === 'build') {
      // looking: the right stick's (and any drag layer's) degrees, used once
      const lx2 = Number.isFinite(intent.lookX) ? intent.lookX : 0, ly2 = Number.isFinite(intent.lookY) ? intent.lookY : 0;
      intent.lookX = 0;
      intent.lookY = 0;
      if (mode === 'play') turn(lx2, ly2);
      time = (time + dt / DAY_SECONDS) % 1;
      // the body moves in steps of a 45th of a second at most, however long the frame took
      const n = Math.max(1, Math.ceil(dt * 45));
      for (let i = 0; i < n; i++) walk(mode === 'play' ? dt / n : 0, dt / n);
      stepBuild();
      const [ex, ey, ez] = eye();
      const d = lookDir();
      target = world.ray(ex, ey, ez, d[0], d[1], d[2], REACH);
      outline.visible = !!target;
      if (target) outline.position.set(target.x, target.y, target.z);
      autosaveT += dt;
      if (autosaveT > 20 && world.edits.size !== savedEdits) (autosaveT = 0), void writeWorld();
    } else if (mode !== 'paused') {
      // the title: a slow turn high over the world
      orbit += dt * 0.05;
      time = (time + dt / 120) % 1;
      const sy = world.surface(8, 8);
      camera.position.set(8 + Math.cos(orbit) * 30, Math.max(sy, 24) + 16, 8 + Math.sin(orbit) * 30);
      camera.lookAt(8, Math.max(sy, 22), 8);
      outline.visible = false;
    }
    sunLight();
    applyLight(clock);
    placeClouds(camera.position.x, camera.position.z, dt);
    // the dust
    let alive = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(0.16, 0.16, 0.16);
      dummy.updateMatrix();
      dust.setMatrixAt(alive, dummy.matrix);
      dust.setColorAt(alive, tint.setRGB(p.c[0], p.c[1], p.c[2]));
      alive++;
    }
    dust.count = alive;
    dust.instanceMatrix.needsUpdate = true;
    if (dust.instanceColor) dust.instanceColor.needsUpdate = true;
    // the chunks: a bigger budget before the first frames are full, then what the frame can spare
    const fx = mode === 'play' || mode === 'paused' || mode === 'build' ? P.x : 8, fz = mode === 'play' || mode === 'paused' || mode === 'build' ? P.z : 8;
    stream(fx, fz, meshes.size < 9 ? 30 : mode === 'play' ? 3 : 6);
    draw();
    // a new resolution takes effect at the next frame's draw (resizing now would clear the frame just drawn)
    if (res.check(loop.stats)) {
      /* fit() at the next draw */
    } else if (res.scale <= res.min && loop.stats.count >= 90 && loop.stats.interval(0.9, 90) > 24 && view > 4 && ++starve > 180) {
      // at the lowest resolution and still slow: see a chunk less far
      view = 4;
      starve = 0;
    }
  };

  const walk = (dt: number, realDt: number) => {
    const inWater = world.get(Math.floor(P.x), Math.floor(P.y + 0.4), Math.floor(P.z)) === WATER;
    if (inWater && !P.water && P.vy < -3) synth.noise({ dur: 0.35, f: 700, to: 250, q: 0.7, vol: 0.3 });
    P.water = inWater;
    // where he wants to go: the stick, the pad, the keys
    let mx = stickV.x + (Number.isFinite(intent.moveX) ? intent.moveX : 0), my = stickV.y + (Number.isFinite(intent.moveY) ? intent.moveY : 0);
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my += 1;
    if (keys.has('s') || keys.has('arrowdown')) my -= 1;
    const len = Math.hypot(mx, my);
    if (len > 1) (mx /= len), (my /= len);
    const jump = held.jump || intent.held.has('jump') || keys.has(' ');
    const down = held.down || keys.has('shift');
    const speed = P.fly ? 9 : inWater ? 2.6 : 4.6;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const tx = (fx * my + Math.cos(P.yaw) * mx) * speed, tz = (fz * my - Math.sin(P.yaw) * mx) * speed;
    const acc = P.ground || P.fly ? 14 : 5;
    P.vx += (tx - P.vx) * Math.min(1, acc * dt);
    P.vz += (tz - P.vz) * Math.min(1, acc * dt);
    if (P.fly) {
      const ty = (jump ? 7 : 0) - (down ? 7 : 0);
      P.vy += (ty - P.vy) * Math.min(1, 10 * dt);
    } else if (inWater) {
      P.vy -= 9 * dt;
      if (jump) P.vy = Math.min(P.vy + 30 * dt, 3.6);
      P.vy = Math.max(P.vy, -4);
    } else {
      P.vy -= 26 * dt;
      if (jump && P.ground) {
        P.vy = 8.2;
        synth.tone({ f: 220, to: 330, dur: 0.08, type: 'sine', vol: 0.1 });
      }
      P.vy = Math.max(P.vy, -40);
    }
    const wasGround = P.ground;
    const bx = slide('x', P.vx * dt), bz = slide('z', P.vz * dt);
    // walk into a single step: climb it (no jump needed on a phone)
    if ((bx || bz) && P.ground && !P.fly && len > 0.2) {
      const ax = Math.floor(P.x + Math.sign(P.vx) * (HALF + 0.3)), az = Math.floor(P.z + Math.sign(P.vz) * (HALF + 0.3)), fy = Math.floor(P.y);
      if ((SOLID[world.get(ax, fy, Math.floor(P.z))] || SOLID[world.get(Math.floor(P.x), fy, az)]) && !hits(P.x, P.y + 1.05, P.z)) P.vy = 7.2;
    }
    const hitY = slide('y', P.vy * dt);
    P.ground = hitY && P.vy < 0;
    if (hitY) {
      if (P.vy < -14) haptic(18);
      P.vy = 0;
    }
    if (P.ground && !wasGround) synth.noise({ dur: 0.06, f: 500, to: 300, q: 1, vol: 0.12 });
    // footsteps
    if (P.ground && Math.hypot(P.vx, P.vz) > 1.2) {
      stepT -= realDt;
      if (stepT <= 0) {
        stepT = 0.4;
        const ground = world.get(Math.floor(P.x), Math.floor(P.y - 0.5), Math.floor(P.z));
        synth.noise({ dur: 0.05, f: ground === STONE || ground === BRICK ? 1400 : 500, to: 260, q: 1, vol: 0.07 });
      }
    }
    if (P.y < -20) Object.assign(P, spawn(), { vy: 0 });
  };

  const loop = new Loop(frame);

  // ---------------------------------------------------------------- pausing, the tab, quitting
  let hostPaused = false;
  const onHidden = () => {
    if (document.hidden && (mode === 'play' || mode === 'build')) openPause();
    if (document.hidden) void writeWorld();
  };
  document.addEventListener('visibilitychange', onHidden);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (size.w = 0)) : null;
  ro?.observe(canvas);
  let finished: Promise<void> | null = null;
  const finish = (): Promise<void> =>
    (finished ??= (async () => {
      loop.stop();
      setMode('gone');
      await endVisit().catch(() => undefined);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      ro?.disconnect();
      clearMeshes();
      disposeAll(scene);
      opaqueMat.dispose();
      clearMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.width = 0;
      canvas.height = 0;
      synth.close();
      ui.destroy();
    })());
  const leave = async () => {
    await finish();
    (ev as EngineEvents & { onQuit?(): void }).onQuit?.();
  };

  // the first frame: the title over the world's middle, the nearest chunks made at once
  const last = (await listWorlds().catch(() => [] as (WorldSave | null)[])).filter((s): s is WorldSave => !!s).sort((a, b) => b.played.localeCompare(a.played))[0];
  if (last) world = new World(last.seed, last.edits);
  stream(8, 8, 60);
  openTitle();
  loop.start();
  draw();

  const handle: VoxelHandle = {
    pause() {
      hostPaused = true;
      loop.stop();
      void writeWorld();
    },
    resume() {
      hostPaused = false;
      if (mode !== 'paused' && mode !== 'gone') loop.start();
    },
    quit: finish,
    setSound(on: boolean) {
      synth.setOn(on);
      if (ui.menuOpen && mode !== 'worlds') reopen();
    },
    resetStats: () => loop.stats.reset(),
    peek: (): VoxelStats => ({
      frames: loop.stats.frames,
      firstFrameMs,
      p50: loop.stats.interval(0.5),
      p95: loop.stats.interval(0.95),
      workP95: loop.stats.workMs(0.95),
      scale: res.scale,
      width: canvas.width,
      height: canvas.height,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      paused: !loop.running,
      mode,
      placed,
      dug,
      edits: world.edits.size,
      chunks: meshes.size,
      pos: [P.x, P.y, P.z],
      yaw: P.yaw,
      pitch: P.pitch,
      target: target ? [target.x, target.y, target.z] : null,
      slot: tool === 0 ? 'dig' : KIND_NAMES[SLOTS[tool]!]!,
      fly: P.fly,
      building: building ? building.blocks.length - building.i : 0,
      world: save?.name ?? '',
      view,
    }),
  };
  return handle;
}
