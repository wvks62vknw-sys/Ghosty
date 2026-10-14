/**
 * Live aircraft from ADS-B (adsb.lol, airplanes.live fallback). Positions are dead-reckoned
 * between updates so planes move smoothly. Refreshes only while the globe is on screen.
 */
import { fetchJson } from '../../api/feed';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { LineSet, PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import { RAD, clamp, lerp, type Mat4, type Vec3 } from '../math';

export interface Aircraft {
  hex: string;
  call: string;
  reg: string;
  type: string;
  lat: number;
  lon: number;
  /** altitude km */
  alt: number;
  altft: number;
  gs: number;
  trk: number;
  vr: number;
  squawk: string;
  t: number;
  gnd: boolean;
  mil: boolean;
  emergency: string;
  hist: Vec3[];
  histAt: number;
}

const MIL_HINT = /^(RCH|REACH|QID|FORTE|HOMER|DUKE|NATO|PAT|CNV|JAKE|TOPCAT|MMF|RRR|HAF|BAF|GAF|IAM|LAGR|KING|NCHO|SPAR|SAM)\d*/i;
const HUBS: [number, number][] = [[40.64, -73.78], [51.47, -0.45], [25.25, 55.36], [1.36, 103.99], [33.94, -118.4], [50.03, 8.57], [35.55, 139.78], [-33.94, 151.17], [19.43, -99.07], [28.55, 77.1], [-23.43, -46.47], [41.98, -87.9]];

interface AdsbAc {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  squawk?: string;
  seen_pos?: number;
  seen?: number;
  dbFlags?: number;
}

export class AirLayer implements GlobeLayer {
  id = 'air' as const;
  list = new Map<string, Aircraft>();
  status: 'IDLE' | 'LIVE' | 'STALE' | 'NO FEED' = 'IDLE';
  source = '';
  selected: Aircraft | null = null;
  onEmergency: ((a: Aircraft) => void) | null = null;
  private busy = false;
  private seenEmergency = new Set<string>();
  private pts = new PointSet(8000);
  private trail = new LineSet(600);

  pos(a: Aircraft, now = Date.now()): { lat: number; lon: number; alt: number } {
    const dt = Math.min(120, Math.max(0, (now - a.t) / 1000));
    if (!a.gnd && a.gs > 20 && dt > 0.5) {
      const q = GEO.dest(a.lat, a.lon, a.trk, a.gs * 0.000514444 * dt);
      return { lat: q.lat, lon: q.lon, alt: a.alt + a.vr * 0.0000051 * dt };
    }
    return { lat: a.lat, lon: a.lon, alt: a.alt };
  }

  private ingest(list: AdsbAc[] | undefined, now: number): number {
    let n = 0;
    for (const o of list ?? []) {
      if (o.lat == null || o.lon == null || !o.hex) continue;
      const gnd = o.alt_baro === 'ground';
      const altft = gnd ? 0 : typeof o.alt_baro === 'number' ? o.alt_baro : o.alt_geom ?? 0;
      const old = this.list.get(o.hex);
      const sq = o.squawk ?? '';
      const a: Aircraft = {
        hex: o.hex,
        call: (o.flight ?? '').trim(),
        reg: o.r ?? old?.reg ?? '',
        type: o.t ?? old?.type ?? '',
        lat: o.lat,
        lon: o.lon,
        alt: altft * 0.0003048,
        altft,
        gs: o.gs ?? 0,
        trk: o.track ?? o.true_heading ?? 0,
        vr: (o.baro_rate ?? 0) * 0.3048,
        squawk: sq,
        t: now - (o.seen_pos ?? o.seen ?? 0) * 1000,
        gnd,
        mil: !!((o.dbFlags ?? 0) & 1) || MIL_HINT.test(o.flight ?? ''),
        emergency: sq === '7500' || sq === '7600' || sq === '7700' ? sq : '',
        hist: old?.hist ?? [],
        histAt: old?.histAt ?? 0,
      };
      this.list.set(o.hex, a);
      if (this.selected?.hex === a.hex) this.selected = a;
      n++;
    }
    return n;
  }

  private async point(lat: number, lon: number, nm: number): Promise<{ ac?: AdsbAc[] }> {
    const q = `${lat.toFixed(3)}/${lon.toFixed(3)}/${Math.round(Math.min(250, nm))}`;
    try {
      return await fetchJson(`https://api.adsb.lol/v2/point/${q}`, 4, 12000);
    } catch {
      return fetchJson(`https://api.airplanes.live/v2/point/${q}`, 4, 12000);
    }
  }

  /** Fetch aircraft around the camera (or around major hubs when zoomed out). */
  async refresh(lat: number, lon: number, rangeKm: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const t0 = Date.now();
    try {
      let n = 0;
      const jobs: Promise<{ ac?: AdsbAc[] }>[] = [];
      if (rangeKm < 2400) {
        jobs.push(this.point(lat, lon, clamp((rangeKm / 1.852) * 0.9, 25, 250)));
        if (rangeKm > 700) for (const b of [0, 90, 180, 270]) {
          const q = GEO.dest(lat, lon, b, rangeKm * 0.8);
          jobs.push(this.point(q.lat, q.lon, 250));
        }
        this.source = 'adsb.lol';
      } else {
        for (const [a, b] of HUBS) jobs.push(this.point(a, b, 250));
        jobs.push(fetchJson('https://api.adsb.lol/v2/mil', 60, 12000));
        this.source = 'adsb.lol hubs';
      }
      for (const r of await Promise.allSettled(jobs)) if (r.status === 'fulfilled') n += this.ingest(r.value.ac, t0);
      const cut = Date.now() - 150_000;
      for (const [k, a] of this.list) if (a.t < cut && a !== this.selected) this.list.delete(k);
      if (!n) throw new Error('no data');
      this.status = 'LIVE';
      for (const a of this.list.values()) {
        if (a.emergency && !this.seenEmergency.has(a.hex)) {
          this.seenEmergency.add(a.hex);
          this.onEmergency?.(a);
        }
      }
    } catch {
      this.status = this.list.size ? 'STALE' : 'NO FEED';
    } finally {
      this.busy = false;
    }
  }

  find(q: string): Aircraft | null {
    const s = q.toLowerCase().trim();
    for (const a of this.list.values()) if (a.call.toLowerCase() === s || a.hex === s || a.reg.toLowerCase() === s) return a;
    for (const a of this.list.values()) if (a.call.toLowerCase().startsWith(s)) return a;
    return null;
  }

  nearby(lat: number, lon: number, km: number): Aircraft[] {
    const now = Date.now();
    return [...this.list.values()].filter((a) => {
      const p = this.pos(a, now);
      return GEO.hav(lat, lon, p.lat, p.lon) <= km;
    });
  }

  color(a: Aircraft): [number, number, number, number] {
    if (a.emergency) return [1, 0.15, 0.2, 1];
    if (a.mil) return [1, 0.35, 0.35, 1];
    if (a.gnd) return [0.5, 0.7, 0.75, 0.6];
    const k = clamp(a.alt / 12, 0, 1);
    return [lerp(1, 0.4, k), lerp(0.7, 0.95, k), lerp(0.2, 1, k), 1];
  }

  world(a: Aircraft, now: number): Vec3 {
    const p = this.pos(a, now);
    return GEO.ecef(p.lat, p.lon, p.alt + 0.2);
  }

  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number, now: number): void {
    const P = this.pts.clear();
    const t = performance.now() / 1000;
    for (const a of this.list.values()) {
      const w = this.world(a, now);
      P.add(w, this.color(a), (a.mil ? 15 : 13) * sizeMul * (a.gnd ? 0.7 : 1), 3, a.trk * RAD);
      if (a.emergency) P.add(w, [1, 0.2, 0.25, 0.6 + 0.4 * Math.sin(t * 8)], 40, 1);
    }
    P.draw(rel, { ...oc, px: 1 });
    const s = this.selected;
    if (s) {
      const w = this.world(s, now);
      if (now - s.histAt > 1500) {
        s.hist.push(w);
        if (s.hist.length > 240) s.hist.shift();
        s.histAt = now;
      }
      const c = this.color(s);
      const L = this.trail.clear();
      for (let i = 1; i < s.hist.length; i++) L.add(s.hist[i - 1]!, s.hist[i]!, [c[0], c[1], c[2], 0.15 + (0.85 * i) / s.hist.length], 2);
      L.draw(rel, { ...oc, px: 1 });
    }
  }

  *pickables(now: number): Iterable<Pickable> {
    for (const a of this.list.values()) yield { kind: 'air', ref: a, w: this.world(a, now) };
  }
}

export const air = new AirLayer();
