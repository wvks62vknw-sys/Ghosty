/**
 * The map pack's arithmetic (BRIEF-OFFLINE-1), pure: his area, the tiles that cover it at each zoom, their count, and the size said
 * before the tap. No imports, so tests/offlinemaps.spec.mjs bundles and checks it on its own.
 */

/**
 * His area: the West Midlands county (Wolverhampton and the Black Country to the west, Sutton Coldfield to the north, Solihull and
 * the airport to the east, Coventry to the south-east), with a margin of the countryside around it.
 */
export const AREA = { name: 'the West Midlands', west: -2.25, south: 52.33, east: -1.4, north: 52.7 } as const;
export const MAX_ZOOM = 14;

const lonToX = (lon: number, z: number): number => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat: number, z: number): number => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** The tiles that cover the area at one zoom: columns x0..x1, rows y0..y1. */
export function tileBox(z: number): { x0: number; x1: number; y0: number; y1: number } {
  const max = 2 ** z - 1;
  return {
    x0: Math.max(0, lonToX(AREA.west, z)),
    x1: Math.min(max, lonToX(AREA.east, z)),
    y0: Math.max(0, latToY(AREA.north, z)),
    y1: Math.min(max, latToY(AREA.south, z)),
  };
}
export function tileCount(z: number): number {
  const b = tileBox(z);
  return (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
}
/** All the tiles of zooms 0..maxZ. */
export const tilesTotal = (maxZ: number = MAX_ZOOM): number => Array.from({ length: maxZ + 1 }, (_, z) => tileCount(z)).reduce((a, b) => a + b, 0);

/**
 * What a vector tile weighs at each zoom, in bytes as the phone keeps them, measured on 10 Nov 2026 (twelve tiles a zoom, taken
 * across the area; the first zooms are one tile, and a low-zoom tile is the biggest: it holds a whole country's coastline).
 */
export const TILE_BYTES = [83_533, 202_078, 1_300_711, 880_984, 317_712, 286_579, 195_639, 318_403, 267_752, 282_773, 176_489, 88_374, 41_900, 38_081, 42_613] as const;
/** The style's sheet, its sprites, three ranges of letters and the shaded relief of the first zooms, together. */
export const EXTRAS_BYTES = 1_200_000;
/** The size said before the tap: the tiles at their measured weight, and the rest; "about" because a tile's size is the server's. */
export function estimate(maxZ: number = MAX_ZOOM): number {
  return Math.round(Array.from({ length: maxZ + 1 }, (_, z) => tileCount(z) * TILE_BYTES[z]!).reduce((a, b) => a + b, EXTRAS_BYTES));
}

/** Whether a place is inside the map on this phone. */
export const inArea = (lat: number, lon: number): boolean => lat >= AREA.south && lat <= AREA.north && lon >= AREA.west && lon <= AREA.east;

