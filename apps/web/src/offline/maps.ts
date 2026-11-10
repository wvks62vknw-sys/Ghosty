/**
 * THE MAP FOR HIS AREA, OFFLINE (BRIEF-OFFLINE-1, AUDIT-8-NOV item 6): OpenFreeMap's vector tiles of the West Midlands, every zoom
 * from 0 to 14 (14 is the most the source has; the map draws further in from it), with the DARK style's own sheet, its sprites, the
 * letters its labels use and the shaded relief it lays under the first zooms, kept on the phone by the pack rule (offline/pack.ts):
 * his tap, on Wi-Fi, its size said first, into the Cache API under `ghosty-maps-v1`, deleted in one tap.
 *
 * The source is the very one the 3D map (ui/map3d.ts) already draws from: tiles.openfreemap.org, free, no key, no cost. The data is
 * OpenStreetMap's (ODbL, © OpenStreetMap contributors); the vector schema is OpenMapTiles' and the style OpenFreeMap's, credited
 * on the map as they are online.
 *
 * Reading: with no signal, the 3D map and the flat view draw from the pack through a protocol of MapLibre's own (`ghostymap://`):
 * every address the style, its sources, sprites and letters name is the source's own with its host swapped for this protocol, and
 * the protocol answers from the cache and from nowhere else. His position never leaves the phone: no address here carries it
 * (a tile is named by its place on the grid, and the grid is the same for everyone).
 */
import type { MapLibreNS } from '../ui/maplibre';
import { EMPTY, fromPack, getPack, isHere, keptAll, offline, packHook, type PackDef, type PackFile } from './pack';

/** The pack's cache (the service worker clears only `ghosty-shell-` and `ghosty-vendor-` caches). */
export const MAPS_CACHE = 'ghosty-maps-v1';
export const OFM = 'https://tiles.openfreemap.org';
/** The one style the pack carries: the 3D map's own default, DARK. */
export const PACK_STYLE = `${OFM}/styles/dark`;
export const PROTOCOL = 'ghostymap';
/** The pack's style, as MapLibre is given it with no signal. */
export const OFFLINE_STYLE = `${PROTOCOL}://ofm/styles/dark`;

export { AREA, EXTRAS_BYTES, MAX_ZOOM, estimate, inArea, tileBox, tileCount, TILE_BYTES, tilesTotal } from './mapmath';
import { AREA, estimate, MAX_ZOOM, tileBox } from './mapmath';

interface StyleLike {
  sprite?: string;
  glyphs?: string;
  sources?: Record<string, { url?: string; tiles?: string[]; maxzoom?: number }>;
  layers?: { layout?: { 'text-font'?: string[] } }[];
}
interface TileJson {
  tiles?: string[];
}

/** The letter ranges the pack keeps for each typeface the style names: Latin, its accents, and the dashes and quotes. */
const RANGES = ['0-255', '256-511', '8192-8447'];
const fill = (tpl: string, z: number, x: number, y: number): string => tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

/**
 * What the pack holds, read from the source itself when GET starts: the DARK sheet; the sprites and letters it names; the tile list
 * the source's TileJSON names (its own version of the planet, which changes every week or so); the relief tiles; and the vector
 * tiles of the area. The sheet and the TileJSON are kept too, so the map starts with no signal exactly as it does with one.
 */
export async function plan(signal?: AbortSignal): Promise<PackFile[]> {
  const get = async (url: string): Promise<string> => {
    const r = await fetch(url, { cache: 'no-store', credentials: 'omit', signal });
    if (!r.ok) throw new Error(`${url} answered ${r.status}`);
    return r.text();
  };
  const styleText = await get(PACK_STYLE);
  const style = JSON.parse(styleText) as StyleLike;
  const vector = style.sources?.openmaptiles;
  const tilejsonUrl = vector?.url;
  if (!tilejsonUrl) throw new Error('the style names no vector source');
  const tj = JSON.parse(await get(tilejsonUrl)) as TileJson;
  const tpl = tj.tiles?.[0];
  if (!tpl) throw new Error('the source names no tiles');
  const maxZ = Math.min(MAX_ZOOM, packHook().maxZoom ?? MAX_ZOOM);
  const out: PackFile[] = [{ url: PACK_STYLE }, { url: tilejsonUrl }];
  if (style.sprite) for (const s of ['.json', '.png', '@2x.json', '@2x.png']) out.push({ url: `${style.sprite}${s}` });
  if (style.glyphs) {
    const fonts = new Set<string>();
    for (const l of style.layers ?? []) for (const f of l.layout?.['text-font'] ?? []) fonts.add(f);
    for (const f of fonts) for (const r of RANGES) out.push({ url: style.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', r), mayBeMissing: true });
  }
  const relief = style.sources?.ne2_shaded?.tiles?.[0];
  for (let z = 0; z <= maxZ; z++) {
    const b = tileBox(z);
    for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) {
      out.push({ url: fill(tpl, z, x, y), mayBeMissing: true });
      if (relief && z <= (style.sources?.ne2_shaded?.maxzoom ?? 6)) out.push({ url: fill(relief, z, x, y), mayBeMissing: true });
    }
  }
  return out;
}

export const MAP_PACK: PackDef = {
  id: 'map-west-midlands',
  cache: MAPS_CACHE,
  name: 'The West Midlands map',
  what: 'Streets, buildings, water, parks and place names for the whole of the West Midlands, every zoom to street level: the 3D map and the journey draw from it with no signal.',
  licence: 'Map data © OpenStreetMap contributors (ODbL); OpenFreeMap and OpenMapTiles',
  month: 'November 2026',
  bytes: estimate(),
  about: true,
  parallel: 4,
  note: 'The dark style only. An address, a route and live traffic still need a signal, and say so.',
  plan,
};

/** The pack as it is sized for this run (a spec may ask for a smaller one: packHook). */
export const mapPack = (): PackDef => (packHook().maxZoom != null ? { ...MAP_PACK, bytes: estimate(Math.min(MAX_ZOOM, packHook().maxZoom!)) } : MAP_PACK);

export const getMap = (onProgress?: Parameters<typeof getPack>[1], signal?: AbortSignal): Promise<void> => getPack(mapPack(), onProgress, signal);

// ---------------------------------------------------------------- reading

/** Whether the map pack is here and whole (kept as a record, its sheet still in the cache). */
export async function mapHere(): Promise<boolean> {
  if (!keptAll()[MAP_PACK.id]) return false;
  return !!(await fromPack(MAPS_CACHE, PACK_STYLE)) && (await isHere(MAP_PACK));
}

const realUrl = (url: string): string => {
  const u = new URL(url);
  return `${OFM}${u.pathname}${u.search}`;
};
const rewrite = (text: string): string => text.split(OFM).join(`${PROTOCOL}://ofm`);

let registered = false;
/**
 * Teach MapLibre `ghostymap://ofm/<path>`: the answer is the pack's copy of the source's `<path>`, and nothing from the network.
 * The sheet and the TileJSON have their addresses swapped for this protocol, so the sprites, the letters, the tiles and the relief
 * come through it too. A tile the pack does not have (outside the area, or in the sea) is a 404, which MapLibre draws as empty.
 */
export function registerMapProtocol(ML: MapLibreNS): void {
  if (registered || typeof ML.addProtocol !== 'function') return;
  registered = true;
  ML.addProtocol(PROTOCOL, async (params) => {
    const res = await fromPack(MAPS_CACHE, realUrl(params.url));
    const miss = () => Object.assign(new Error('Not found in the map on this phone'), { status: 404 });
    if (!res || res.headers.get(EMPTY)) throw miss();
    if (params.type === 'json' || /\.json$/.test(new URL(params.url).pathname) || /\/(styles|planet)\/?[^/]*$/.test(new URL(params.url).pathname)) {
      const text = rewrite(await res.text());
      return { data: params.type === 'json' ? JSON.parse(text) : new TextEncoder().encode(text).buffer };
    }
    return { data: await res.arrayBuffer() };
  });
}

/** What the map says, quietly, when it is drawn from the pack (and when it cannot be). */
export const WORDS = {
  drawn: 'Offline: drawn from the West Midlands map on this phone.',
  outside: 'Outside the map on this phone: the West Midlands only.',
  none: 'No signal, and the map is not on this phone: Settings, OFFLINE MAPS, on Wi-Fi.',
  style: 'Offline: the dark style, the one on this phone.',
  address: 'The address needs a signal.',
} as const;

/** Whether this phone draws the map from the pack now: it has no signal, and the pack is here. */
export async function drawsFromPack(): Promise<boolean> {
  return offline() && (await mapHere());
}
