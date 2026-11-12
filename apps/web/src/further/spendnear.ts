/**
 * PLACES AND SPENDING TOGETHER (BRIEF-OCT-IDEAS-3 item 8): "you spent £62 near work this week", from the statements he added and the places
 * he saved, and nothing else. A statement row counts as near a saved place when the bank's own words for the shop name that place's
 * street or its name (BROAD ST in the row, Broad Street in the saved address). Nothing is looked up, no position is read and no live
 * GPS goes anywhere: it is two lists he already gave me, set side by side on the phone. The commute's cost is the saved drive's
 * distance at a stated fuel rate, said as an estimate.
 */
import type { SavedPlace } from '../../../../packages/shared/src/places';
import type { SpendRow } from '../../../../packages/shared/src/spending';

/** Words of an address that name no place by themselves. */
const GENERIC = new Set([
  'street', 'road', 'avenue', 'lane', 'drive', 'close', 'way', 'court', 'terrace', 'crescent', 'square', 'gardens', 'place', 'house', 'the', 'and', 'for', 'unit', 'floor', 'flat', 'building', 'centre', 'center', 'north', 'south', 'east', 'west', 'city', 'town', 'england', 'birmingham', 'bham', 'london', 'manchester', 'leeds', 'uk', 'united', 'kingdom', 'west', 'midlands', 'work', 'home', 'school', 'gym', 'parents',
]);
/** The bank's short forms of a street's name, said whole. */
const SHORT: Record<string, string> = { st: 'street', rd: 'road', ave: 'avenue', av: 'avenue', ln: 'lane', dr: 'drive', ct: 'court', ter: 'terrace', cres: 'crescent', sq: 'square', gdns: 'gardens', pl: 'place' };

const words = (s: string): string[] => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

/** The words of a saved place that tell it from every other (its street's name, its own name): none for a place with only generic ones. */
export function placeWords(p: Pick<SavedPlace, 'label' | 'address' | 'query'>): string[] {
  const out = new Set<string>();
  for (const w of [...words(p.address), ...words(p.query), ...words(p.label)]) {
    if (w.length >= 4 && !GENERIC.has(w) && !/^\d/.test(w) && !/^[a-z]{1,2}\d/.test(w)) out.add(w);
  }
  return [...out];
}

/** The words of a statement row's description, the bank's short forms said whole. */
export const rowWords = (t: string): Set<string> => new Set(words(t).map((w) => SHORT[w] ?? w));

export interface NearPlace {
  place: SavedPlace;
  /** Pounds out in the days counted, and how many rows. */
  total: number;
  rows: number;
  /** The rows' own descriptions that matched, so he can see why. */
  shops: string[];
}

const day = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Money out in the last `days` days (today counted) beside each saved place whose words appear in the rows' descriptions, biggest first. */
export function nearPlaces(rows: SpendRow[], places: SavedPlace[], now = Date.now(), days = 7): NearPlace[] {
  const from = day(now - (days - 1) * 86_400_000);
  const to = day(now);
  const mine = rows.filter((r) => r.a < 0 && r.c !== 'income' && r.d >= from && r.d <= to);
  const out: NearPlace[] = [];
  for (const p of places) {
    const pw = placeWords(p);
    if (!pw.length) continue;
    const hit = mine.filter((r) => {
      const rw = rowWords(r.t);
      return pw.some((w) => rw.has(w));
    });
    if (!hit.length) continue;
    out.push({ place: p, total: Math.round(hit.reduce((n, r) => n - r.a, 0) * 100) / 100, rows: hit.length, shops: [...new Set(hit.map((r) => r.t.replace(/\s+/g, ' ').trim()))].slice(0, 3) });
  }
  return out.sort((a, b) => b.total - a.total);
}

/** £62, or £62.50 when it is not whole pounds. */
export const pounds = (x: number): string => `£${Number.isInteger(x) ? x.toLocaleString('en-GB') : x.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "you spent £62 near Work this week" (the place as he saved it). */
export const nearLine = (n: NearPlace): string => `You spent ${pounds(n.total)} near ${n.place.label} this week`;
/** The shorter form for the Brief's sentence. */
export const nearShort = (n: NearPlace): string => `${pounds(n.total)} spent near ${n.place.label} this week`;
/** How it was worked out, said under the line. */
export const nearHow = (n: NearPlace): string => `${n.rows} ${n.rows === 1 ? 'row' : 'rows'} of your statements name ${n.place.label}’s street (${n.shops.join('; ')}). Matched by words alone: nothing looked up, no position used.`;

/** Fuel for a drive, a first estimate: about 10p a kilometre, a typical petrol car (his own car's economy is not known). */
export const FUEL_PER_KM = 0.1;
export function fuelEstimate(km: number): { each: number; both: number; line: string } | null {
  if (!Number.isFinite(km) || km <= 0) return null;
  const each = Math.round(km * FUEL_PER_KM * 10) / 10;
  const both = Math.round(km * FUEL_PER_KM * 2 * 10) / 10;
  const p = (x: number) => `£${x.toFixed(2)}`;
  return { each, both, line: `About ${p(both)} in fuel there and back (estimate: 10p a kilometre, a typical petrol car)` };
}
