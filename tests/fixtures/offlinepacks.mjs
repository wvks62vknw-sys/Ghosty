// Stand-ins for the map source's answers (tests/offlinemaps.spec.mjs): the DARK style's sheet, the planet's TileJSON, a vector tile
// with a stretch of water, a road and a place, a glyph range, the sprites and a relief tile. Never a real download: every address is
// answered by a route in the spec. A vector tile is hand-encoded (a protobuf of layers, features and packed geometry commands).
export const OFM = 'https://tiles.openfreemap.org';
export const VERSION = '20261101_000000_pt';

const varint = (n) => {
  const out = [];
  let v = BigInt(n);
  while (v > 127n) {
    out.push(Number(v & 127n) | 128);
    v >>= 7n;
  }
  out.push(Number(v));
  return out;
};
const key = (field, wire) => varint((field << 3) | wire);
const lenField = (field, bytes) => [...key(field, 2), ...varint(bytes.length), ...bytes];
const strField = (field, s) => lenField(field, [...Buffer.from(s)]);
const uintField = (field, n) => [...key(field, 0), ...varint(n)];
const zz = (n) => (n << 1) ^ (n >> 31);
const packed = (field, nums) => lenField(field, nums.flatMap((n) => varint(n)));

const feature = (type, geometry, tags = []) => [...(tags.length ? packed(2, tags) : []), ...uintField(3, type), ...packed(4, geometry)];
const layer = (name, features, keys = [], values = []) => [
  ...uintField(15, 2),
  ...strField(1, name),
  ...features.flatMap((f) => lenField(2, f)),
  ...keys.flatMap((k) => strField(3, k)),
  ...values.flatMap((v) => lenField(4, strField(1, v))),
  ...uintField(5, 4096),
];

/** A tile: the top half is water, a road runs across the bottom, a place sits between them. */
export function vectorTile(z, x, y) {
  const water = feature(3, [9, zz(0), zz(0), 26, zz(4096), zz(0), zz(0), zz(2048), zz(-4096), zz(0), 15]);
  const road = feature(2, [9, zz(0), zz(3000), 10, zz(4096), zz(0)]);
  const place = feature(1, [9, zz(2048), zz(2800)], [0, 0, 1, 1]);
  return Buffer.from([
    ...lenField(3, layer('water', [water])),
    ...lenField(3, layer('transportation', [road])),
    ...lenField(3, layer('place', [place], ['name', 'class'], [`Tile ${z}/${x}/${y}`, 'city'])),
  ]);
}

export const dark = () => ({
  version: 8,
  name: 'Dark (stand-in)',
  sources: {
    ne2_shaded: { maxzoom: 6, tileSize: 256, tiles: [`${OFM}/natural_earth/ne2sr/{z}/{x}/{y}.png`], type: 'raster' },
    openmaptiles: { type: 'vector', url: `${OFM}/planet` },
  },
  sprite: `${OFM}/sprites/ofm_f384/ofm`,
  glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': 'rgb(27,60,90)' } },
    { id: 'road', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': 'rgb(200,200,200)', 'line-width': 2 } },
    { id: 'place', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 14 }, paint: { 'text-color': 'rgb(240,240,240)' } },
  ],
});
export const tileJson = () => ({ tilejson: '3.0.0', tiles: [`${OFM}/planet/${VERSION}/{z}/{x}/{y}.pbf`], minzoom: 0, maxzoom: 14, vector_layers: [{ id: 'water' }, { id: 'transportation' }, { id: 'place' }] });
/** A glyph range with its name and no glyphs: valid, and enough for the labels to ask for it. */
export const glyphs = (range) => Buffer.from(lenField(1, [...strField(1, 'Noto Sans Regular'), ...strField(2, range)]));
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
