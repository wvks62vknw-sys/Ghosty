/**
 * FUEL STATIONS AND CAR CHARGERS (NEXT ROUND, see.s7): from OpenStreetMap through the public Overpass service, free and keyless, for
 * the map's view (never his position: the view is what is on screen). Pure: the query, the parsing and the words, so the spec reads them.
 */
export interface FuelPlace {
  id: string;
  kind: 'fuel' | 'charger';
  name: string;
  lat: number;
  lon: number;
  /** "Shell", "Tesla Supercharger" … when OSM has it. */
  brand: string;
  /** Chargers: how many can charge at once, when mapped. */
  sockets: number | null;
  /** "24 hours", or the opening hours as mapped. */
  hours: string;
}
export const FUEL_MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
/** The query for a view [south, west, north, east]. */
export const fuelQuery = ([south, west, north, east]: [number, number, number, number]): string => {
  const box = `${south},${west},${north},${east}`;
  return `[out:json][timeout:20];(node["amenity"~"^(fuel|charging_station)$"](${box});way["amenity"~"^(fuel|charging_station)$"](${box}););out center 400;`;
};
export function parseFuel(j: unknown): FuelPlace[] {
  const els = (j as { elements?: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] })?.elements ?? [];
  const out: FuelPlace[] = [];
  for (const el of els) {
    const t = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const kind = t.amenity === 'charging_station' ? 'charger' : 'fuel';
    const sockets = Number(t.capacity ?? t['socket:type2'] ?? t['socket:type2_combo'] ?? NaN);
    out.push({ id: `${el.type}/${el.id}`, kind, name: t.name || t.brand || t.operator || (kind === 'fuel' ? 'Fuel station' : 'Car charger'), lat, lon, brand: t.brand || t.operator || '', sockets: Number.isFinite(sockets) ? sockets : null, hours: t.opening_hours === '24/7' ? '24 hours' : t.opening_hours || '' });
  }
  return out;
}
/** One line for a place's card: "Shell · fuel · 24 hours", "Tesla · car charger · 8 at once". */
export const fuelLine = (p: FuelPlace): string => [p.brand && p.brand !== p.name ? p.brand : '', p.kind === 'fuel' ? 'fuel' : 'car charger', p.sockets ? `${p.sockets} at once` : '', p.hours].filter(Boolean).join(' · ');
/* state: map.fuel empty */
export const FUEL_ZOOM = 'Zoom in to a town to see its fuel stations and car chargers.';
/* state: map.fuel error */
export const FUEL_DOWN = 'The fuel and charger map (OpenStreetMap) didn’t answer. Try again in a minute.';
