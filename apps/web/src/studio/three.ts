/**
 * The parts of three.js that the 3D STUDIO uses. The library is vendored under
 * public/vendor/three (three.module.min.js and a few addons whose `import 'three'` was rewritten
 * to a relative path, since the security policy allows no import map) and imported at runtime
 * when the tab opens — never bundled — so these are hand-written types for exactly what the
 * studio calls, like ui/maplibre.ts for the 3D map.
 */
export interface TVector3 {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): TVector3;
  copy(v: TVector3): TVector3;
  clone(): TVector3;
  add(v: TVector3): TVector3;
  sub(v: TVector3): TVector3;
  multiplyScalar(s: number): TVector3;
  length(): number;
  distanceTo(v: TVector3): number;
  applyMatrix4(m: unknown): TVector3;
  lerpVectors(a: TVector3, b: TVector3, t: number): TVector3;
}
export interface TVector2 {
  x: number;
  y: number;
  set(x: number, y: number): TVector2;
}
export interface TColor {
  setHex(hex: number): TColor;
  getHex(): number;
}
export interface TEuler {
  x: number;
  y: number;
  z: number;
  order: string;
  set(x: number, y: number, z: number, order?: string): TEuler;
}
export interface TObject3D {
  name: string;
  type: string;
  visible: boolean;
  position: TVector3;
  rotation: TEuler;
  scale: TVector3 & { setScalar(s: number): TVector3 };
  parent: TObject3D | null;
  children: TObject3D[];
  userData: Record<string, unknown>;
  matrixWorld: unknown;
  renderOrder: number;
  add(...o: TObject3D[]): TObject3D;
  remove(...o: TObject3D[]): TObject3D;
  attach(o: TObject3D): TObject3D;
  traverse(fn: (o: TObject3D) => void): void;
  updateMatrixWorld(force?: boolean): void;
  getWorldPosition(v: TVector3): TVector3;
  worldToLocal(v: TVector3): TVector3;
  lookAt(x: number | TVector3, y?: number, z?: number): void;
}
export interface TBufferAttribute {
  count: number;
  itemSize: number;
  normalized: boolean;
  array: ArrayLike<number>;
  getX(i: number): number;
  getY(i: number): number;
  getZ(i: number): number;
  getW(i: number): number;
}
export interface TBufferGeometry {
  index: TBufferAttribute | null;
  attributes: Record<string, TBufferAttribute>;
  morphAttributes: Record<string, unknown[]>;
  boundingBox: TBox3 | null;
  setAttribute(name: string, a: TBufferAttribute): TBufferGeometry;
  setIndex(a: TBufferAttribute | number[]): TBufferGeometry;
  getAttribute(name: string): TBufferAttribute | undefined;
  setFromPoints(p: TVector3[]): TBufferGeometry;
  computeBoundingBox(): void;
  computeVertexNormals(): void;
  dispose(): void;
}
export interface TMaterial {
  transparent: boolean;
  opacity: number;
  side: number;
  depthWrite: boolean;
  blending: number;
  clippingPlanes: TPlane[] | null;
  clipShadows: boolean;
  needsUpdate: boolean;
  dispose(): void;
  clone(): TMaterial;
  color?: TColor;
  emissive?: TColor;
  emissiveIntensity?: number;
  [k: string]: unknown;
}
export interface TMesh extends TObject3D {
  isMesh: true;
  isSkinnedMesh?: boolean;
  geometry: TBufferGeometry;
  material: TMaterial | TMaterial[];
}
export interface TBox3 {
  min: TVector3;
  max: TVector3;
  setFromObject(o: TObject3D, precise?: boolean): TBox3;
  getCenter(v: TVector3): TVector3;
  getSize(v: TVector3): TVector3;
  isEmpty(): boolean;
  union(b: TBox3): TBox3;
}
export interface TPlane {
  normal: TVector3;
  constant: number;
  set(normal: TVector3, constant: number): TPlane;
}
export interface TCamera extends TObject3D {
  aspect: number;
  near: number;
  far: number;
  fov: number;
  updateProjectionMatrix(): void;
}
export interface TScene extends TObject3D {
  background: TColor | null;
  environment: unknown;
  fog: unknown;
}
export interface TRenderer {
  domElement: HTMLCanvasElement;
  localClippingEnabled: boolean;
  outputColorSpace: string;
  toneMapping: number;
  toneMappingExposure: number;
  setPixelRatio(r: number): void;
  setSize(w: number, h: number, updateStyle?: boolean): void;
  setClearColor(c: number, a?: number): void;
  render(s: TScene, c: TCamera): void;
  dispose(): void;
  forceContextLoss(): void;
}
export interface TIntersection {
  point: TVector3;
  object: TObject3D;
  distance: number;
}
export interface TRaycaster {
  setFromCamera(v: TVector2, c: TCamera): void;
  intersectObjects(list: TObject3D[], recursive?: boolean): TIntersection[];
}
export interface TControls {
  target: TVector3;
  enableDamping: boolean;
  dampingFactor: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  minDistance: number;
  maxDistance: number;
  enabled: boolean;
  update(): boolean;
  dispose(): void;
}
export interface TGltf {
  scene: TObject3D;
}
export interface TGltfParser {
  textureLoader: unknown;
  options: { manager: unknown };
}
export interface TGltfLoader {
  parseAsync(data: ArrayBuffer, path: string): Promise<TGltf>;
  register(plugin: (parser: TGltfParser) => { name: string }): TGltfLoader;
}
export interface TTexture {
  dispose(): void;
}
export interface TPMREM {
  fromScene(scene: TObject3D, sigma?: number): { texture: TTexture };
  dispose(): void;
}

type Ctor<A extends unknown[], T> = new (...a: A) => T;

/** The namespace as the studio uses it. */
export interface ThreeNS {
  WebGLRenderer: Ctor<[{ canvas?: HTMLCanvasElement; antialias?: boolean; alpha?: boolean; powerPreference?: string; failIfMajorPerformanceCaveat?: boolean }], TRenderer>;
  Scene: Ctor<[], TScene>;
  PerspectiveCamera: Ctor<[number, number, number, number], TCamera>;
  Group: Ctor<[], TObject3D>;
  Object3D: Ctor<[], TObject3D>;
  Mesh: Ctor<[TBufferGeometry, TMaterial | TMaterial[]], TMesh>;
  LineSegments: Ctor<[TBufferGeometry, TMaterial], TObject3D & { geometry: TBufferGeometry; material: TMaterial }>;
  Line: Ctor<[TBufferGeometry, TMaterial], TObject3D & { geometry: TBufferGeometry; material: TMaterial }>;
  Vector3: Ctor<[number?, number?, number?], TVector3>;
  Vector2: Ctor<[number?, number?], TVector2>;
  Color: Ctor<[number], TColor>;
  Box3: Ctor<[], TBox3>;
  Plane: Ctor<[TVector3, number], TPlane>;
  Raycaster: Ctor<[], TRaycaster>;
  BufferGeometry: Ctor<[], TBufferGeometry>;
  BufferAttribute: Ctor<[ArrayLike<number> & ArrayBufferView, number, boolean?], TBufferAttribute>;
  EdgesGeometry: Ctor<[TBufferGeometry, number?], TBufferGeometry>;
  BoxGeometry: Ctor<[number, number, number], TBufferGeometry>;
  CylinderGeometry: Ctor<[number, number, number, number?, number?, boolean?], TBufferGeometry>;
  TorusGeometry: Ctor<[number, number, number?, number?, number?], TBufferGeometry>;
  SphereGeometry: Ctor<[number, number?, number?], TBufferGeometry>;
  RingGeometry: Ctor<[number, number, number?], TBufferGeometry>;
  PlaneGeometry: Ctor<[number, number], TBufferGeometry>;
  GridHelper: Ctor<[number, number, number, number], TObject3D & { material: TMaterial }>;
  MeshStandardMaterial: Ctor<[Record<string, unknown>?], TMaterial>;
  MeshBasicMaterial: Ctor<[Record<string, unknown>?], TMaterial>;
  LineBasicMaterial: Ctor<[Record<string, unknown>?], TMaterial>;
  AmbientLight: Ctor<[number, number?], TObject3D>;
  HemisphereLight: Ctor<[number, number, number?], TObject3D>;
  DirectionalLight: Ctor<[number, number?], TObject3D>;
  PointLight: Ctor<[number, number?, number?], TObject3D>;
  FogExp2: Ctor<[number, number?], unknown>;
  PMREMGenerator: Ctor<[TRenderer], TPMREM>;
  TextureLoader: Ctor<[unknown?], unknown>;
  DoubleSide: number;
  AdditiveBlending: number;
  ACESFilmicToneMapping: number;
  SRGBColorSpace: string;
  REVISION: string;
}

export interface StudioLib {
  THREE: ThreeNS;
  GLTFLoader: Ctor<[], TGltfLoader>;
  OrbitControls: Ctor<[TCamera, HTMLElement], TControls>;
  RoomEnvironment: Ctor<[], TObject3D>;
}

let lib: Promise<StudioLib> | null = null;
/** three.js and its addons, loaded once from this site (public/vendor/three) the first time the studio opens. */
export function loadThree(): Promise<StudioLib> {
  lib ??= (async () => {
    // Plain strings, so neither the bundler nor the type checker follows them (types are above).
    const urls: string[] = ['three.module.min.js', 'addons/loaders/GLTFLoader.js', 'addons/controls/OrbitControls.js', 'addons/environments/RoomEnvironment.js'].map((f) => `/vendor/three/${f}`);
    const [THREE, gl, oc, re] = (await Promise.all(urls.map((u) => import(u)))) as [ThreeNS, { GLTFLoader: StudioLib['GLTFLoader'] }, { OrbitControls: StudioLib['OrbitControls'] }, { RoomEnvironment: StudioLib['RoomEnvironment'] }];
    if (typeof THREE.WebGLRenderer !== 'function') throw new Error('three.js did not load');
    return { THREE, GLTFLoader: gl.GLTFLoader, OrbitControls: oc.OrbitControls, RoomEnvironment: re.RoomEnvironment };
  })();
  lib.catch(() => {
    lib = null;
  });
  return lib;
}
