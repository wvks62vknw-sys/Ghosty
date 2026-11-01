/**
 * The parts of three.js the car uses beyond what the 3D STUDIO already types (studio/three.ts): the physical material for
 * paint with a clear coat, canvas textures for the plates, the tread and the panel gaps, lathe and tube geometry for tyres,
 * hoses and the exhaust, sprites for the glow — and BufferGeometryUtils, to merge many small pieces into one draw call.
 * The same vendored library (public/vendor/three), loaded once, never bundled.
 */
import { loadThree, type StudioLib, type TBufferGeometry, type TCamera, type TColor, type TMaterial, type TMesh, type TObject3D, type ThreeNS, type TVector2, type TVector3 } from '../studio/three';

export type { TBufferGeometry, TCamera, TColor, TMaterial, TMesh, TObject3D, TVector2, TVector3 };

type Ctor<A extends unknown[], T> = new (...a: A) => T;

export interface TTex {
  colorSpace: string;
  wrapS: number;
  wrapT: number;
  repeat: TVector2;
  offset: TVector2;
  anisotropy: number;
  needsUpdate: boolean;
  dispose(): void;
}
export interface TCurve {
  getPoint(t: number): TVector3;
}
export interface TSprite extends TObject3D {
  material: TMaterial;
}
export interface TQuat {
  setFromAxisAngle(axis: TVector3, angle: number): TQuat;
}
/** What the car's objects carry beyond the Studio's types. */
export type O3 = TObject3D & { quaternion?: TQuat; frustumCulled?: boolean };

export interface CarNS extends Omit<ThreeNS, 'CylinderGeometry'> {
  CylinderGeometry: Ctor<[number, number, number, number?, number?, boolean?, number?, number?], TBufferGeometry>;
  MeshPhysicalMaterial: Ctor<[Record<string, unknown>?], TMaterial>;
  CanvasTexture: Ctor<[HTMLCanvasElement], TTex>;
  LatheGeometry: Ctor<[TVector2[], number?], TBufferGeometry>;
  TubeGeometry: Ctor<[TCurve, number?, number?, number?, boolean?], TBufferGeometry>;
  CatmullRomCurve3: Ctor<[TVector3[], boolean?], TCurve>;
  CircleGeometry: Ctor<[number, number?], TBufferGeometry>;
  Sprite: Ctor<[TMaterial], TSprite>;
  SpriteMaterial: Ctor<[Record<string, unknown>?], TMaterial>;
  Fog: Ctor<[number, number, number], unknown>;
  Float32BufferAttribute: Ctor<[ArrayLike<number>, number], import('../studio/three').TBufferAttribute>;
  BackSide: number;
  FrontSide: number;
  RepeatWrapping: number;
  ClampToEdgeWrapping: number;
}

export interface GeoUtils {
  mergeGeometries(list: TBufferGeometry[], groups?: boolean): TBufferGeometry | null;
}

export interface CarLib extends StudioLib {
  T: CarNS;
  U: GeoUtils;
}

let lib: Promise<CarLib> | null = null;
/** three.js (the Studio's load), its BufferGeometryUtils, typed for the car. */
export function loadCarThree(): Promise<CarLib> {
  lib ??= (async () => {
    const base = await loadThree();
    // a plain string, so neither the bundler nor the type checker follows it
    const url: string = '/vendor/three/addons/utils/BufferGeometryUtils.js';
    const U = (await import(url)) as GeoUtils;
    return { ...base, T: base.THREE as unknown as CarNS, U };
  })();
  lib.catch(() => {
    lib = null;
  });
  return lib;
}
