/**
 * THE MAP AND THE COUNTRY (POLISH 2): the Stage's picture of a place, fitted to the place. A street or a saved place shows its
 * block (zoom 16); a town fills the Stage (zoom 12); a country shows its outline, drawn from the world pack on this phone, with
 * the place lit in it and the small globe beside it for where it is. The pin is the system's mark with the name beside it, never
 * over it. A waiting line says what the wait is for until the first paint, which is the first tile or, when the online map cannot
 * load, the offline drawing from this phone (said once: "offline map").
 */
import { World } from '../engine/world';
import { h, svgEl } from '../core/dom';

const TILE = 256;
const merc = (lat: number, lon: number, z: number): [number, number] => {
  const n = 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
};

/** The zoom that fits a place by what it is: his own place or a street is a block; a town fills the Stage. */
export const zoomFor = (kind: 'saved' | 'town' | 'street'): number => (kind === 'town' ? 12 : 16);

function pinOf(label: string): HTMLElement[] {
  const pin = svgEl('svg', { viewBox: '-20 -20 40 40', class: 'stgpin', 'aria-hidden': 'true' });
  pin.append(svgEl('rect', { x: -14, y: -14, width: 28, height: 28, class: 'stg-box' }), svgEl('circle', { cx: 0, cy: 0, r: 4, class: 'stg-core' }));
  return [pin as unknown as HTMLElement, h('span.stgname', label)];
}

/** What the offline drawing says it is, once. */
export const OFFLINE_WORDS = 'OFFLINE MAP · THE COASTS ON THIS PHONE';
export const OFFLINE_WORDS_STREET = 'OFFLINE MAP · NO STREETS KEPT FOR HERE';

/** The coast and borders of the world pack around a place, flat, at the zoom the tiles would have had. */
async function offlineDrawing(lat: number, lon: number, z: number): Promise<{ svg: SVGSVGElement; coast: number }> {
  if (!World.ready) await World.load();
  const [cx, cy] = merc(lat, lon, z);
  const at = (la: number, lo: number): [number, number] => {
    const [x, y] = merc(la, lo, z);
    return [(x - cx) * TILE, (y - cy) * TILE];
  };
  const svg = svgEl('svg', { viewBox: '-210 -180 420 360', class: 'stgoffmap', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid slice' });
  const run = (rings: Float32Array[], cls: string): number => {
    let d = '';
    let any = 0;
    for (const ring of rings) {
      let pen = false;
      let drew = false;
      let seen = false;
      const step = Math.max(1, Math.round(ring.length / 2 / 4000));
      for (let i = 0; i < ring.length / 2; i += step) {
        const [x, y] = at(ring[i * 2 + 1]!, ring[i * 2]!);
        if (Math.abs(x) > 320 || Math.abs(y) > 280) pen = false;
        else {
          d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
          pen = true;
          drew = true;
          if (Math.abs(x) <= 210 && Math.abs(y) <= 180) seen = true;
        }
      }
      // (only a ring with a point in the part of the plate that shows counts as a coast: the words say what is there)
      if (drew && seen) any++;
    }
    if (d) svg.append(svgEl('path', { d, class: cls }));
    return any;
  };
  // (a street's block holds no coast: the plate is a grid of the tiles it would have had, and says so)
  for (let k = -1; k <= 1; k++) {
    svg.append(svgEl('line', { x1: -210, y1: k * TILE, x2: 210, y2: k * TILE, class: 'stg-grat' }), svgEl('line', { x1: k * TILE, y1: -180, x2: k * TILE, y2: 180, class: 'stg-grat' }));
  }
  if (World.ready) run(World.borders, 'stg-border');
  const coast = World.ready ? run(World.land.map((poly) => poly[0]!).filter(Boolean), 'stg-land') : 0;
  return { svg, coast };
}

/** The MAP: OpenStreetMap's own tiles (the card kit's source) under the place's pin and name; the offline drawing when they cannot load. */
export function mapPic(lat: number, lon: number, z: number, label: string, o: { painted: () => void; count: (n: Record<string, number>) => void; offlineSaid: () => void }): HTMLElement {
  const [wx, wy] = merc(lat, lon, z);
  const n = 2 ** z;
  const cx = Math.floor(wx);
  const cy = Math.floor(wy);
  const layer = h('div.stgtiles');
  const wait = h('span.stgwait', { role: 'status' }, 'Finding it on the map…');
  const frame = h('div.stgmap', { role: 'img', 'aria-label': `Map of ${label}` }, layer, ...pinOf(label), wait, h('span.stgattr', '© OpenStreetMap'));
  let tiles = 0;
  let loaded = 0;
  let failed = 0;
  let done = false;
  const paint = () => {
    if (done) return;
    done = true;
    wait.remove();
    o.painted();
  };
  const offline = async () => {
    if (done || frame.dataset.offline) return;
    frame.dataset.offline = '1';
    let drawn: { svg: SVGSVGElement; coast: number } | null = null;
    try {
      drawn = await offlineDrawing(lat, lon, z);
    } catch {
      drawn = null;
    }
    if (drawn) frame.insertBefore(drawn.svg, layer);
    // the words, once: offline map
    const words = drawn && drawn.coast > 0 ? OFFLINE_WORDS : OFFLINE_WORDS_STREET;
    frame.append(h('span.stgoff', words));
    frame.setAttribute('aria-label', `Offline map of ${label}`);
    o.offlineSaid();
    o.count({ offline: 1, coast: drawn?.coast ?? 0 });
    paint();
  };
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ty = cy + dy;
      if (ty < 0 || ty >= n) continue;
      const tx = (((cx + dx) % n) + n) % n;
      const img = h('img', { alt: '', decoding: 'async', draggable: false, src: `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png` });
      img.style.left = `${Math.round((cx + dx - wx) * TILE)}px`;
      img.style.top = `${Math.round((cy + dy - wy) * TILE)}px`;
      img.addEventListener('load', () => {
        loaded++;
        paint();
      });
      img.addEventListener('error', () => {
        failed++;
        img.remove();
        if (failed >= tiles && !loaded) void offline();
      });
      layer.append(img);
      tiles++;
    }
  }
  o.count({ tiles });
  // no signal at all: the offline drawing at once; a signal that gives nothing: after a few seconds
  if (typeof navigator !== 'undefined' && navigator.onLine === false) queueMicrotask(() => void offline());
  else setTimeout(() => !loaded && void offline(), 6000);
  return frame;
}

/** The pull of a country on the picture: the half-angle (degrees) that holds its cities, from the world pack. */
function countryHalf(code: string, lat: number, lon: number): { box: { s: number; n: number; w: number; e: number }; half: number } {
  // the country's cities within reach of the place (a far island group is not the country's outline here: the picture is the stretch he asked about)
  const own = World.cities.filter((c) => c.country === code && Math.hypot(c.lat - lat, (c.lon - lon) * Math.cos((lat * Math.PI) / 180)) <= 12);
  let s = lat;
  let n = lat;
  let w = lon;
  let e = lon;
  for (const c of own) {
    s = Math.min(s, c.lat);
    n = Math.max(n, c.lat);
    w = Math.min(w, c.lon);
    e = Math.max(e, c.lon);
  }
  // a little room round the cities, and never tighter than a small country
  const padLat = Math.max(1.2, (n - s) * 0.2);
  const padLon = Math.max(1.2, (e - w) * 0.2);
  s -= padLat;
  n += padLat;
  w -= padLon;
  e += padLon;
  const half = Math.min(40, Math.max(2.5, Math.hypot(Math.max(n - lat, lat - s), (Math.max(e - lon, lon - w)) * Math.cos((lat * Math.PI) / 180)) * 1.1));
  return { box: { s, n, w, e }, half };
}

const ortho = (lat: number, lon: number, lat0: number, lon0: number): [number, number, number] => {
  const r = Math.PI / 180;
  const dl = (lon - lon0) * r;
  const cl = Math.cos(lat * r);
  return [cl * Math.sin(dl), Math.cos(lat0 * r) * Math.sin(lat * r) - Math.sin(lat0 * r) * cl * Math.cos(dl), Math.sin(lat0 * r) * Math.sin(lat * r) + Math.cos(lat0 * r) * cl * Math.cos(dl)];
};

/**
 * A COUNTRY: its outline (the coast and the borders of the world pack inside the country's own cities' reach, in the accent), the
 * land round it faint, the city lit with its name beside the mark, and a small globe in the corner for where in the world it is.
 */
export function countryPic(lat0: number, lon0: number, label: string, code: string, count: (n: Record<string, number>) => void): SVGSVGElement {
  const W = 360;
  const H = 300;
  const { box, half } = countryHalf(code, lat0, lon0);
  // one orthographic scale for the whole picture: the country's reach fills about 38 % of the width either side
  const R = Math.min(2400, Math.max(132, 138 / Math.sin((half * Math.PI) / 180)));
  const svg = svgEl('svg', { viewBox: `${-W / 2} ${-H / 2} ${W} ${H}`, class: 'stg-svg eye country', role: 'img', 'aria-label': `${label} and its country, outlined` });
  const at = (la: number, lo: number): [number, number, number] => {
    const [x, y, z] = ortho(la, lo, lat0, lon0);
    return [x * R, -y * R, z];
  };
  const inWin = (x: number, y: number) => Math.abs(x) < W / 2 - 2 && Math.abs(y) < H / 2 - 2;
  const inCountry = (la: number, lo: number) => la >= box.s && la <= box.n && lo >= box.w && lo <= box.e;
  // the land in sight: the country's own stretch of coast in the accent, the rest faint
  const own = { d: '', n: 0 };
  const rest = { d: '', n: 0 };
  const edge = { d: '' };
  let rings = 0;
  for (const poly of World.land) {
    const ring = poly[0];
    if (!ring) continue;
    let penA = false;
    let penB = false;
    let drew = false;
    const step = Math.max(1, Math.round(ring.length / 2 / 5000));
    for (let i = 0; i < ring.length / 2; i += step) {
      const la = ring[i * 2 + 1]!;
      const lo = ring[i * 2]!;
      const [x, y, z] = at(la, lo);
      if (z <= 0 || !inWin(x, y)) {
        penA = false;
        penB = false;
        continue;
      }
      drew = true;
      if (inCountry(la, lo)) {
        own.d += `${penA ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        own.n++;
        penA = true;
        penB = false;
      } else {
        rest.d += `${penB ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        rest.n++;
        penB = true;
        penA = false;
      }
    }
    if (drew) rings++;
  }
  for (const b of World.borders) {
    let pen = false;
    for (let i = 0; i < b.length / 2; i++) {
      const [x, y, z] = at(b[i * 2 + 1]!, b[i * 2]!);
      if (z <= 0 || !inWin(x, y)) pen = false;
      else {
        edge.d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        pen = true;
      }
    }
  }
  svg.append(svgEl('path', { d: edge.d, class: 'stg-border' }), svgEl('path', { d: rest.d, class: 'stg-land' }), svgEl('path', { d: own.d, class: 'stg-country', 'data-country': String(own.n) }));
  // the cities of the country in sight, small, and the place lit with its name beside the mark
  let cities = 0;
  for (const c of World.cities.filter((x) => x.country === code).sort((a, b) => b.pop - a.pop).slice(0, 12)) {
    const [x, y, z] = at(c.lat, c.lon);
    if (z > 0 && inWin(x, y) && Math.hypot(x, y) > 12) {
      svg.append(svgEl('circle', { cx: x, cy: y, r: 1.8, class: 'stg-city' }));
      cities++;
    }
  }
  const g = svgEl('g', { class: 'stg-mark', 'data-centre': '1' });
  g.append(svgEl('rect', { x: -14, y: -14, width: 28, height: 28, class: 'stg-box' }), svgEl('circle', { cx: 0, cy: 0, r: 3, class: 'stg-core' }));
  const name = svgEl('text', { x: 20, y: 4, class: 'stg-t cap name', 'text-anchor': 'start' });
  name.textContent = label.toUpperCase();
  svg.append(g, name);
  // the small globe for where in the world it is (the whole land, thinned), its centre lit
  const gr = 34;
  const gx = W / 2 - gr - 8;
  const gy = H / 2 - gr - 8;
  const globe = svgEl('g', { class: 'stg-globe', transform: `translate(${gx} ${gy})` });
  globe.append(svgEl('circle', { cx: 0, cy: 0, r: gr, class: 'stg-disc' }));
  let land = '';
  let pts = 0;
  const total = World.land.reduce((a, poly) => a + (poly[0]?.length ?? 0) / 2, 0);
  const gstep = Math.max(1, Math.round(total / 1800));
  let globeRings = 0;
  for (const poly of World.land) {
    const ring = poly[0];
    if (!ring) continue;
    let pen = false;
    let any = false;
    for (let i = 0; i < ring.length / 2; i += gstep) {
      const [x, y, z] = ortho(ring[i * 2 + 1]!, ring[i * 2]!, lat0, lon0);
      if (z <= 0) pen = false;
      else {
        land += `${pen ? 'L' : 'M'}${(x * gr).toFixed(1)} ${(-y * gr).toFixed(1)}`;
        pen = true;
        any = true;
        pts++;
      }
    }
    if (any) globeRings++;
  }
  globe.append(svgEl('path', { d: land, class: 'stg-land' }), svgEl('circle', { cx: 0, cy: 0, r: gr, class: 'stg-rim' }), svgEl('circle', { cx: 0, cy: 0, r: 2.5, class: 'stg-core' }));
  svg.append(globe);
  count({ land: globeRings, points: pts, cities, country: own.n, rings });
  return svg;
}
