/**
 * Street-level crime for England, Wales and Northern Ireland, from the Home Office's open
 * data (data.police.uk; Open Government Licence). Free, no key. Each record is one reported
 * crime in the latest published month, snapped by the police to a nearby point ("on or near
 * Roman Street") — nobody is identified and nothing is live; it is a monthly map of what
 * was reported where. Loaded for the area under the globe camera when zoomed in to a town.
 */
import { fetchJson } from '../api/feed';
import { Emitter } from '../core/store';

export interface Crime {
  id: string;
  category: string;
  lat: number;
  lon: number;
  street: string;
  month: string;
  outcome: string;
}

export const CRIME_LABEL: Record<string, string> = {
  'anti-social-behaviour': 'ANTI-SOCIAL BEHAVIOUR',
  'bicycle-theft': 'BICYCLE THEFT',
  burglary: 'BURGLARY',
  'criminal-damage-arson': 'CRIMINAL DAMAGE / ARSON',
  drugs: 'DRUGS',
  'other-theft': 'THEFT',
  'possession-of-weapons': 'WEAPONS',
  'public-order': 'PUBLIC ORDER',
  robbery: 'ROBBERY',
  shoplifting: 'SHOPLIFTING',
  'theft-from-the-person': 'THEFT FROM A PERSON',
  'vehicle-crime': 'VEHICLE CRIME',
  'violent-crime': 'VIOLENCE / SEXUAL OFFENCES',
  'other-crime': 'OTHER',
};

/** Four families, four colours: against people (red), property (gold), order (violet), other (grey-blue). */
export type CrimeFamily = 'person' | 'property' | 'order' | 'other';
export const CRIME_FAMILY: Record<string, CrimeFamily> = {
  'violent-crime': 'person',
  robbery: 'person',
  'possession-of-weapons': 'person',
  'theft-from-the-person': 'person',
  burglary: 'property',
  'vehicle-crime': 'property',
  'bicycle-theft': 'property',
  'other-theft': 'property',
  shoplifting: 'property',
  'criminal-damage-arson': 'property',
  'anti-social-behaviour': 'order',
  'public-order': 'order',
  drugs: 'order',
  'other-crime': 'other',
};
export const CRIME_COLORS: Record<CrimeFamily, [number, number, number]> = {
  person: [1, 0.3, 0.38],
  property: [1, 0.78, 0.3],
  order: [0.72, 0.56, 1],
  other: [0.55, 0.75, 0.9],
};
export const crimeLabel = (c: string) => CRIME_LABEL[c] ?? c.replace(/-/g, ' ').toUpperCase();
export const crimeFamily = (c: string): CrimeFamily => CRIME_FAMILY[c] ?? 'other';

interface ApiCrime {
  id: number;
  category: string;
  month: string;
  location?: { latitude: string; longitude: string; street?: { name?: string } };
  outcome_status?: { category: string; date: string } | null;
}

export function parseCrimes(j: unknown): Crime[] {
  const out: Crime[] = [];
  for (const c of Array.isArray(j) ? (j as ApiCrime[]) : []) {
    const lat = Number(c.location?.latitude);
    const lon = Number(c.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: String(c.id),
      category: c.category,
      lat,
      lon,
      street: (c.location?.street?.name ?? '').replace(/^On or near /i, ''),
      month: c.month,
      outcome: c.outcome_status?.category ?? '',
    });
  }
  return out;
}

/** Only England, Wales and Northern Ireland publish here (Scotland does not). */
export const inUK = (lat: number, lon: number) => lat > 49.8 && lat < 56 && lon > -8.7 && lon < 2;

// Cells of 0.03° × 0.05° (about 3.3 km × 3.4 km in the Midlands): one request each, a few
// hundred crimes at most, well under the API's 10,000-crime ceiling per area.
const DLAT = 0.03;
const DLON = 0.05;

export class CrimeFeed {
  list = new Map<string, Crime>();
  status: 'IDLE' | 'SYNC' | 'LIVE' | 'NO FEED' = 'IDLE';
  /** The month the data covers (YYYY-MM), once anything has loaded. */
  month = '';
  readonly events = new Emitter<{ change: void }>();
  private done = new Set<string>();
  private busy = false;

  counts(): Record<CrimeFamily, number> & { total: number } {
    const c = { person: 0, property: 0, order: 0, other: 0, total: 0 };
    for (const x of this.list.values()) {
      c[crimeFamily(x.category)]++;
      c.total++;
    }
    return c;
  }

  /** The crimes within `km` of a point, nearest first. */
  near(lat: number, lon: number, km: number): Crime[] {
    const ky = 111.2;
    const kx = 111.2 * Math.cos((lat * Math.PI) / 180);
    return [...this.list.values()]
      .map((c) => ({ c, d: Math.hypot((c.lat - lat) * ky, (c.lon - lon) * kx) }))
      .filter((o) => o.d <= km)
      .sort((a, b) => a.d - b.d)
      .map((o) => o.c);
  }

  /** Load the cells around the globe camera (only zoomed in to town level, only over the UK). */
  async refresh(lat: number, lon: number, rangeKm: number): Promise<void> {
    if (this.busy || rangeKm > 45 || !inUK(lat, lon)) return;
    const reach = Math.min(2, Math.max(1, Math.round(rangeKm / 12)));
    const cy = Math.floor(lat / DLAT);
    const cx = Math.floor(lon / DLON);
    const cells: [number, number][] = [];
    for (let a = cy - reach; a <= cy + reach; a++) for (let b = cx - reach; b <= cx + reach; b++) if (!this.done.has(`${a},${b}`)) cells.push([a, b]);
    if (!cells.length) return;
    // nearest cells first, a handful per pass (the next pass picks up the rest)
    cells.sort((p, q) => Math.hypot(p[0] - cy, p[1] - cx) - Math.hypot(q[0] - cy, q[1] - cx));
    this.busy = true;
    this.status = 'SYNC';
    this.events.emit('change', undefined);
    let failed = 0;
    try {
      await Promise.all(
        cells.slice(0, 5).map(async ([a, b]) => {
          const s = a * DLAT;
          const w = b * DLON;
          const poly = `${s.toFixed(4)},${w.toFixed(4)}:${s.toFixed(4)},${(w + DLON).toFixed(4)}:${(s + DLAT).toFixed(4)},${(w + DLON).toFixed(4)}:${(s + DLAT).toFixed(4)},${w.toFixed(4)}`;
          try {
            const j = await fetchJson<unknown>(`https://data.police.uk/api/crimes-street/all-crime?poly=${poly}`, 6 * 3600, 25000);
            for (const c of parseCrimes(j)) {
              this.list.set(c.id, c);
              if (c.month > this.month) this.month = c.month;
            }
            this.done.add(`${a},${b}`);
          } catch {
            failed++;
          }
        }),
      );
      this.status = failed && !this.list.size ? 'NO FEED' : 'LIVE';
      // keep memory bounded on long sessions
      if (this.list.size > 12000) {
        const drop = [...this.list.keys()].slice(0, this.list.size - 9000);
        for (const k of drop) this.list.delete(k);
        this.done.clear();
      }
    } finally {
      this.busy = false;
      this.events.emit('change', undefined);
    }
  }
}

export const crime = new CrimeFeed();
