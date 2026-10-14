/**
 * Globe camera: orbits a target point at a range (km), with heading and tilt.
 * Smooth fly-to along a great circle with a zoom-out "hump", plus picking/projection.
 */
import { GEO, R_EARTH } from './geo';
import { gfx } from './gfx';
import { M4, RAD, V3, clamp, lerp, type Mat4, type Vec3 } from './math';

export interface CamPose {
  lat: number;
  lon: number;
  range: number;
  hd: number;
  tilt: number;
}

export interface CamState {
  V: Mat4;
  P: Mat4;
  pos: Vec3;
  near: number;
  far: number;
  f: Vec3;
  r: Vec3;
  u: Vec3;
  alt: number;
}

interface Fly {
  from: CamPose;
  to: CamPose;
  t: number;
  dur: number;
  hump: number;
}

export class GeoCam {
  lat = 25;
  lon = 10;
  range = 16000;
  hd = 0;
  tilt = 0;
  fov = 50;
  /** Where the camera is heading; the camera eases towards it every frame. */
  target: CamPose = { lat: 25, lon: 10, range: 16000, hd: 0, tilt: 0 };
  fly: Fly | null = null;
  autoSpin = false;
  dragging = false;
  cs: CamState | null = null;
  /** Optional per-frame override of the target (e.g. following an aircraft). */
  follow: (() => { lat: number; lon: number } | null) | null = null;

  flyTo(p: Partial<CamPose>, dur?: number): void {
    this.follow = null;
    const to: CamPose = {
      lat: p.lat ?? this.lat,
      lon: p.lon ?? this.lon,
      range: p.range ?? this.range,
      hd: p.hd ?? this.hd,
      tilt: p.tilt ?? this.tilt,
    };
    const from: CamPose = { lat: this.lat, lon: this.lon, range: this.range, hd: this.hd, tilt: this.tilt };
    to.hd = from.hd + ((((to.hd - from.hd + 540) % 360) + 360) % 360) - 180;
    const dist = GEO.hav(from.lat, from.lon, to.lat, to.lon);
    this.fly = {
      from,
      to,
      t: 0,
      dur: dur ?? clamp(1.4 + Math.log10(1 + dist / 50) * 1.1, 1.4, 6),
      hump: Math.max(0, Math.log(Math.max(1, Math.min(dist * 0.45, 16000) / Math.max(from.range, to.range)))),
    };
    this.target = { ...to };
  }

  /** Multiply range by f, optionally zooming towards a screen point. */
  zoom(f: number, px?: number, py?: number): void {
    this.fly = null;
    this.follow = null;
    const T = this.target;
    const old = T.range;
    T.range = clamp(old * f, 0.3, 60000);
    if (px != null && py != null && f < 1 && old > 1.2) {
      const g = this.pick(px, py);
      if (g) {
        const k = (1 - f) * 0.75;
        T.lat = clamp(T.lat + (g.lat - T.lat) * k, -84, 84);
        T.lon += ((((g.lon - T.lon + 540) % 360) + 360) % 360 - 180) * k;
      }
    }
  }

  kmPerPx(): number {
    return (2 * this.range * Math.tan((this.fov * RAD) / 2)) / Math.max(300, innerHeight);
  }

  update(dt: number): void {
    const T = this.target;
    if (this.fly) {
      const f = this.fly;
      f.t += dt / f.dur;
      const k = Math.min(1, f.t);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const a = V3.norm(GEO.ecef(f.from.lat, f.from.lon));
      const b = V3.norm(GEO.ecef(f.to.lat, f.to.lon));
      const om = Math.acos(clamp(V3.dot(a, b), -1, 1));
      const p = om < 1e-6 ? b : V3.add(V3.mul(a, Math.sin((1 - e) * om) / Math.sin(om)), V3.mul(b, Math.sin(e * om) / Math.sin(om)));
      const ll = GEO.ll(V3.mul(p, R_EARTH));
      this.lat = ll.lat;
      this.lon = ll.lon;
      this.range = Math.exp(lerp(Math.log(f.from.range), Math.log(f.to.range), e) + f.hump * Math.sin(Math.PI * k));
      this.hd = lerp(f.from.hd, f.to.hd, e);
      this.tilt = lerp(f.from.tilt, f.to.tilt, e);
      if (k >= 1) {
        this.fly = null;
        Object.assign(this, { lat: T.lat, lon: T.lon, range: T.range, hd: T.hd, tilt: T.tilt });
      }
    } else {
      const fol = this.follow?.();
      if (fol) {
        T.lat = fol.lat;
        T.lon = fol.lon;
      }
      const k = 1 - Math.pow(0.0009, dt);
      const dl = ((((T.lon - this.lon + 540) % 360) + 360) % 360) - 180;
      this.lat += (T.lat - this.lat) * k;
      this.lon += dl * k;
      this.range = Math.exp(Math.log(this.range) + (Math.log(T.range) - Math.log(this.range)) * k);
      this.hd += (((((T.hd - this.hd + 540) % 360) + 360) % 360) - 180) * k;
      this.tilt += (T.tilt - this.tilt) * k;
      if (this.autoSpin && this.range > 9000 && !this.dragging) T.lon += dt * 3;
    }
    this.lon = ((((this.lon + 540) % 360) + 360) % 360) - 180;
    this.lat = clamp(this.lat, -85, 85);
    this.tilt = clamp(this.tilt, 0, 86);
    this.range = clamp(this.range, 0.3, 60000);
    T.lat = clamp(T.lat, -85, 85);
    T.tilt = clamp(T.tilt, 0, 86);
    T.range = clamp(T.range, 0.3, 60000);
  }

  /** Compute view/projection for this frame (camera-relative: the camera sits at the origin). */
  state(): CamState {
    const T = GEO.ecef(this.lat, this.lon, 0);
    const en = GEO.enu(this.lat, this.lon);
    const h = this.hd * RAD;
    const t = this.tilt * RAD;
    const hv = V3.add(V3.mul(en.e, Math.sin(h)), V3.mul(en.n, Math.cos(h)));
    const off = V3.add(V3.mul(hv, -Math.sin(t) * this.range), V3.mul(en.u, Math.cos(t) * this.range));
    const pos = V3.add(T, off);
    const f = V3.add(V3.mul(hv, Math.sin(t)), V3.mul(en.u, -Math.cos(t)));
    const up = V3.add(V3.mul(hv, Math.cos(t)), V3.mul(en.u, Math.sin(t)));
    let r = V3.norm(V3.cross(f, up));
    if (!Number.isFinite(r[0])) r = [1, 0, 0];
    const u = V3.cross(r, f);
    const d = V3.len(pos);
    const alt = Math.max(0.0005, d - R_EARTH);
    const near = clamp(alt * 0.08, 0.0002, 3000);
    const far = Math.sqrt(Math.max(0, d * d - R_EARTH * R_EARTH)) + Math.max(R_EARTH * 0.6, 4000);
    const V = M4.basis(r, u, [-f[0], -f[1], -f[2]]);
    const P = M4.persp(this.fov * RAD, gfx.w / gfx.h, near, far);
    return (this.cs = { V, P, pos, near, far, f, r, u, alt });
  }

  /** World point → CSS pixel position [x, y, depth], or null if behind the camera. */
  project(w: Vec3): [number, number, number] | null {
    const c = this.cs;
    if (!c) return null;
    const v: Vec3 = [w[0] - c.pos[0], w[1] - c.pos[1], w[2] - c.pos[2]];
    const x = V3.dot(v, c.r);
    const y = V3.dot(v, c.u);
    const z = V3.dot(v, c.f);
    if (z <= c.near) return null;
    const t = Math.tan((this.fov * RAD) / 2);
    const asp = gfx.w / gfx.h;
    const cw = gfx.cv.clientWidth;
    const ch = gfx.cv.clientHeight;
    return [((x / (z * t * asp)) * 0.5 + 0.5) * cw, (1 - ((y / (z * t)) * 0.5 + 0.5)) * ch, z];
  }

  /** True if a world point is not hidden behind the Earth. */
  visible(w: Vec3): boolean {
    const p = this.cs?.pos ?? [0, 0, 0];
    const d = V3.sub(w, p);
    const L = V3.len(d);
    const n = V3.mul(d, 1 / L);
    const t = clamp(-V3.dot(p, n), 0, L);
    return V3.len(V3.add(p, V3.mul(n, t))) > R_EARTH * 0.9985;
  }

  /** CSS pixel → lat/lon on the Earth's surface, or null if it misses the globe. */
  pick(px: number, py: number): { lat: number; lon: number } | null {
    const c = this.cs;
    if (!c) return null;
    const t = Math.tan((this.fov * RAD) / 2);
    const asp = gfx.w / gfx.h;
    const nx = ((px / gfx.cv.clientWidth) * 2 - 1) * t * asp;
    const ny = (1 - (py / gfx.cv.clientHeight) * 2) * t;
    const d = V3.norm(V3.add(V3.add(c.f, V3.mul(c.r, nx)), V3.mul(c.u, ny)));
    const b = V3.dot(c.pos, d);
    const cc = V3.dot(c.pos, c.pos) - R_EARTH * R_EARTH;
    const disc = b * b - cc;
    if (disc < 0) return null;
    const tt = -b - Math.sqrt(disc);
    if (tt < 0) return null;
    return GEO.ll(V3.add(c.pos, V3.mul(d, tt)));
  }
}
