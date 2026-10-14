/**
 * Earth data: Natural Earth coastlines, borders, regions, rivers, lakes, ice, urban areas,
 * cities, airports, ports and a satellite-element snapshot. Loaded from
 * /data/world.json (delta-encoded, 1/100 degree precision).
 */
import { GEO } from './geo';

export interface City {
  name: string;
  lat: number;
  lon: number;
  pop: number;
  country: string;
  cap: number;
}
export interface Airport {
  iata: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  rank: number;
}
export interface Port {
  name: string;
  lat: number;
  lon: number;
  rank: number;
}
/** [name, noradId, epochISO, meanMotion, ecc, incl, raan, argp, meanAnomaly] */
export type TleRow = [string, number, string, number, number, number, number, number, number];

export interface WorldPack {
  q: number;
  land: number[][][];
  borders: number[][];
  adm1: number[][];
  rivers: number[][];
  lakes: number[][][];
  ice: number[][][];
  urban: number[][];
  cities: [string, number, number, number, string, number][];
  airports: [string, string, number, number, string, number][];
  ports: [string, number, number, number][];
  tle: Record<string, TleRow[]>;
  built: string;
}

/** Decode one delta-encoded [lon,lat,…] ring into absolute degrees. */
export function decodeRing(a: number[], q: number): Float32Array {
  const n = a.length >> 1;
  const o = new Float32Array(n * 2);
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += a[i * 2]!;
    y += a[i * 2 + 1]!;
    o[i * 2] = x / q;
    o[i * 2 + 1] = y / q;
  }
  return o;
}

export const WORLD_URL = '/data/world.json';

class WorldData {
  ready = false;
  land: Float32Array[][] = [];
  lakes: Float32Array[][] = [];
  ice: Float32Array[][] = [];
  borders: Float32Array[] = [];
  adm1: Float32Array[] = [];
  rivers: Float32Array[] = [];
  urban: Float32Array[] = [];
  cities: City[] = [];
  airports: Airport[] = [];
  ports: Port[] = [];
  tle: Record<string, TleRow[]> = {};
  built = '';
  pack: WorldPack | null = null;

  async load(): Promise<boolean> {
    try {
      const r = await fetch(WORLD_URL);
      if (!r.ok) throw new Error(String(r.status));
      const P = (this.pack = (await r.json()) as WorldPack);
      const q = P.q;
      this.land = P.land.map((poly) => poly.map((ring) => decodeRing(ring, q)));
      this.lakes = P.lakes.map((poly) => poly.map((ring) => decodeRing(ring, q)));
      this.ice = P.ice.map((poly) => poly.map((ring) => decodeRing(ring, q)));
      this.borders = P.borders.map((r) => decodeRing(r, q));
      this.adm1 = P.adm1.map((r) => decodeRing(r, q));
      this.rivers = P.rivers.map((r) => decodeRing(r, q));
      this.urban = P.urban.map((r) => decodeRing(r, q));
      this.cities = P.cities.map((c) => ({ name: c[0], lat: c[1], lon: c[2], pop: c[3], country: c[4], cap: c[5] }));
      this.airports = P.airports.map((a) => ({ iata: a[0], name: a[1], lat: a[2], lon: a[3], type: a[4], rank: a[5] }));
      this.ports = P.ports.map((a) => ({ name: a[0], lat: a[1], lon: a[2], rank: a[3] }));
      this.tle = P.tle;
      this.built = P.built;
      this.ready = true;
      return true;
    } catch (e) {
      console.warn('world data failed to load', e);
      return false;
    }
  }

  /** Nearest city to a point (optionally above a minimum population). */
  near(lat: number, lon: number, minPop = 0): { city: City; km: number } | null {
    let best: City | null = null;
    let bd = Infinity;
    for (const c of this.cities) {
      if (c.pop < minPop) continue;
      const d = GEO.hav(lat, lon, c.lat, c.lon);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best ? { city: best, km: bd } : null;
  }

  find(query: string): City | null {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return (
      this.cities.find((c) => c.name.toLowerCase() === q) ??
      this.cities.find((c) => c.name.toLowerCase().startsWith(q)) ??
      this.cities.find((c) => `${c.name} ${c.country}`.toLowerCase().includes(q)) ??
      null
    );
  }

  findAirport(query: string): Airport | null {
    const q = query.toLowerCase().trim();
    return this.airports.find((a) => a.iata.toLowerCase() === q) ?? this.airports.find((a) => a.name.toLowerCase().includes(q)) ?? null;
  }
}

export const World = new WorldData();
