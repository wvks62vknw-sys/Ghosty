/**
 * FIT FINDER's brain side: what a shop's product page says a thing costs and measures, read
 * without AI, and which of the things found fit the owner's space.
 *
 * Prices come only from what the page itself states for the product: its schema.org Product
 * data (JSON-LD `offers`: price, or an AggregateOffer's lowPrice as "from"), or the page's own
 * price meta tags — in pounds only. A page that states no price gets none: Ghosty never guesses
 * one, and says "price not on the page" instead.
 *
 * Sizes come from the Product data (width/depth/height, QuantitativeValue or "207 cm"), IKEA's
 * measurement list ({"measure":"207 cm","name":"Width"}), or the page text: "W200 x D90 x
 * H85cm", "H82, W193, D91cm", "Width: 200cm", "200cm W", "200 x 90 x 85 cm" (order assumed W ×
 * D × H, and said so). Parts of the thing (seat depth, the space between the arms, a diagonal)
 * and the delivery box ("Package size …") are not its size and are skipped.
 *
 * Real pages from IKEA UK, Habitat and Dunelm (fetched 2026-10-17) are the fixtures in
 * test/products.fixture.json.
 */

/** Sizes in centimetres; a missing one is unknown. */
export interface Dims {
  w?: number;
  d?: number;
  h?: number;
}

export interface Product {
  url: string;
  /** The shop, by name where Ghosty knows it ("IKEA"), else the web address's host. */
  shop: string;
  title: string;
  /** Pounds, exactly as the page states it; null when the page states none. */
  price: number | null;
  /** The price is a "from" price (the cheapest of several options). */
  priceFrom: boolean;
  dims: Dims;
  /** Where the sizes came from. */
  dimsFrom: 'product data' | 'page text' | 'search listing' | 'none';
  /** The sizes had no W/D/H labels: their order was assumed (width × depth × height). */
  orderAssumed: boolean;
}

/** The limits of the space, in centimetres, and the budget in pounds; any may be missing. */
export interface Limits {
  w?: number;
  d?: number;
  h?: number;
  budget?: number;
}

export type FitStatus = 'fits' | 'tight' | 'unknown' | 'too big' | 'over budget';

export interface Ranked extends Product {
  fit: FitStatus;
  /** The smallest spare room on a limited side (cm), when every limited side is known. */
  margin: number | null;
  /** In plain words: "13 cm spare in width", "8 cm too wide". */
  why: string;
}

/** The shops the search looks at first, by host. */
export const SHOPS: [host: string, name: string][] = [
  ['ikea.com', 'IKEA'],
  ['argos.co.uk', 'Argos'],
  ['dunelm.com', 'Dunelm'],
  ['johnlewis.com', 'John Lewis'],
  ['wayfair.co.uk', 'Wayfair'],
  ['dfs.co.uk', 'DFS'],
  ['habitat.co.uk', 'Habitat'],
  ['diy.com', 'B&Q'],
  ['ebay.co.uk', 'eBay'],
  ['next.co.uk', 'Next'],
  ['furniturevillage.co.uk', 'Furniture Village'],
  ['therange.co.uk', 'The Range'],
  ['made.com', 'MADE'],
  ['very.co.uk', 'Very'],
  ['marksandspencer.com', 'M&S'],
  ['sofology.co.uk', 'Sofology'],
];

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** The shop's name for a web address ("https://www.ikea.com/gb/…" → "IKEA"). */
export function shopName(url: string): string {
  const host = hostOf(url);
  const known = SHOPS.find(([h]) => host === h || host.endsWith(`.${h}`));
  return known ? known[1] : host;
}

/** True for a page at one of the shops Ghosty knows. */
export const knownShop = (url: string): boolean => {
  const host = hostOf(url);
  return SHOPS.some(([h]) => host === h || host.endsWith(`.${h}`));
};

/** True for an address that looks like one product's page rather than a list or an advert. */
export function looksLikeProduct(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const host = hostOf(url);
  // search engines' own advert and redirect links are never a product page
  if (!host || /(^|\.)(duckduckgo\.com|bing\.com|google\.[a-z.]+|doubleclick\.net)$/.test(host)) return false;
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  return /\/(p|product|products|itm|pd|prd|item|sofa|sofas)\/|-p\d{4,}|\/\d{6,}|[a-z]\d{6,}\/?$|\.prd$|\/dp\//.test(path) && !/\/(browse|category|cat|c|search|sb\d)\//.test(path);
}

// ---------------------------------------------------------------- numbers and units

/** Centimetres from a number and its unit (cm, mm, m, in/inch/"); null for anything else. */
export function toCm(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = unit.toLowerCase().replace(/[.\s]/g, '');
  if (u === 'cm' || u === 'cmt' || u === 'centimetres' || u === 'centimeters' || u === 'centimetre' || u === 'centimeter') return round1(value);
  if (u === 'mm' || u === 'mmt' || u === 'millimetres' || u === 'millimeters') return round1(value / 10);
  if (u === 'm' || u === 'mtr' || u === 'metres' || u === 'meters' || u === 'metre' || u === 'meter') return round1(value * 100);
  if (u === 'in' || u === 'inch' || u === 'inches' || u === 'inh' || u === '"' || u === '″') return round1(value * 2.54);
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "207 cm", "2070mm", {value: 207, unitCode: 'CMT'} → 207 (cm); null when it is not a length. */
function lengthOf(v: unknown): number | null {
  if (typeof v === 'number') return v > 0 ? round1(v) : null; // a bare number in Product data: shops give centimetres
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d+(?:[.,]\d+)?)\s*(cm|mm|m|in|inch|inches|")?\.?$/i);
    if (!m) return null;
    return toCm(Number(m[1]!.replace(',', '.')), m[2] ?? 'cm');
  }
  if (v && typeof v === 'object') {
    const q = v as { value?: unknown; unitCode?: unknown; unitText?: unknown };
    const n = typeof q.value === 'number' ? q.value : typeof q.value === 'string' ? Number(q.value.replace(',', '.')) : NaN;
    const unit = String(q.unitCode ?? q.unitText ?? 'cm');
    return toCm(n, unit);
  }
  return null;
}

/** A price in pounds from a Product data value ("549", "700.00", 99, "£1,299.00"); null otherwise. */
function poundsOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[£,\s]/g, '')) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ---------------------------------------------------------------- the page's Product data

type Json = Record<string, unknown>;

/** Every JSON-LD block on the page, parsed (a block that does not parse is skipped). */
export function jsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1]!.trim()));
    } catch {
      /* a broken block: the rest still count */
    }
  }
  return out;
}

const isProduct = (o: Json): boolean => {
  const t = o['@type'];
  return t === 'Product' || (Array.isArray(t) && t.includes('Product')) || t === 'ProductGroup';
};

/** The first Product in the page's JSON-LD (inside @graph and arrays too). */
export function findProduct(blocks: unknown[]): Json | null {
  const stack = [...blocks];
  let seen = 0;
  while (stack.length && seen++ < 500) {
    const o = stack.shift();
    if (Array.isArray(o)) stack.push(...o);
    else if (o && typeof o === 'object') {
      const j = o as Json;
      if (isProduct(j)) return j;
      if (Array.isArray(j['@graph'])) stack.push(...(j['@graph'] as unknown[]));
    }
  }
  return null;
}

/** The price a Product's offers state in pounds: an Offer's price, or an AggregateOffer's lowPrice ("from"). */
export function offerPrice(p: Json): { price: number; from: boolean } | null {
  const offers = Array.isArray(p.offers) ? (p.offers as Json[]) : p.offers && typeof p.offers === 'object' ? [p.offers as Json] : [];
  let best: { price: number; from: boolean } | null = null;
  for (const o of offers) {
    const cur = String(o.priceCurrency ?? (o.priceSpecification as Json | undefined)?.priceCurrency ?? '').toUpperCase();
    // another currency is not a price in pounds; no currency at all on a UK shop's page is taken as pounds
    if (cur && cur !== 'GBP') continue;
    const low = poundsOf(o.lowPrice);
    const price = poundsOf(o.price ?? (o.priceSpecification as Json | undefined)?.price);
    const hit = low != null && (o['@type'] === 'AggregateOffer' || price == null) ? { price: low, from: true } : price != null ? { price, from: false } : null;
    if (hit && (!best || hit.price < best.price)) best = hit;
  }
  // several offers (sizes, colours): the cheapest is a "from" price
  return best && offers.length > 1 ? { ...best, from: true } : best;
}

/** A Product's width/depth/height from its own fields or its additionalProperty list. */
function productDims(p: Json): Dims {
  const d: Dims = {};
  const set = (k: keyof Dims, v: unknown) => {
    const n = lengthOf(v);
    if (n != null && d[k] == null) d[k] = n;
  };
  set('w', p.width);
  set('d', p.depth);
  set('h', p.height);
  const props = Array.isArray(p.additionalProperty) ? (p.additionalProperty as Json[]) : [];
  for (const prop of props) {
    const name = String(prop.name ?? '').trim().toLowerCase();
    const unit = String(prop.unitCode ?? prop.unitText ?? '');
    const val = unit ? { value: prop.value, unitCode: unit } : prop.value;
    if (/^(overall )?width$/.test(name)) set('w', val);
    else if (/^(overall )?depth$/.test(name)) set('d', val);
    else if (/^(overall )?height$/.test(name)) set('h', val);
  }
  return d;
}

// ---------------------------------------------------------------- sizes in the page text

/** Words before a label that make it a part's size, not the thing's ("seat depth", "diagonal depth"). */
const PART = /(seat|seating|diagonal|internal|inside|arm|armrest|leg|back|backrest|drawer|shelf|shelves|mattress|cushion|headboard|footboard|door|rail|opening|package|packaged|box|carton|frame)\s*$/i;

const clean = (html: string): string =>
  html
    .replace(/\\u003[cC]/g, '<')
    .replace(/\\u003[eE]/g, '>')
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\n/g, ' ')
    .replace(/<[^>]{0,400}>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&times;|&#215;/g, '×')
    .replace(/&quot;/g, '"')
    .replace(/[ \t\r\n]+/g, ' ');

/** The words just before a match (for the part and package checks). */
const before = (text: string, at: number, n = 28) => text.slice(Math.max(0, at - n), at);

/**
 * Sizes written in a page's text (or a search listing's line), best evidence first: W/D/H
 * tagged groups, then labelled single sizes, then three bare numbers in a row (W × D × H assumed).
 */
export function textDims(input: string, bed = bedLike(input.slice(0, 300))): { dims: Dims; orderAssumed: boolean } {
  const text = clean(input);
  const unitRe = '(cm|mm|in|inch|inches|")';
  // 1. tagged groups: "W200 x D90 x H85cm", "H82, W193, D91cm", "W 200cm x D 90cm x H 85cm", "200W x 90D x 85H cm"
  const tag = `(?:\\b([WDH])\\s*:?\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*([WDH])\\b)\\s*${unitRe}?`;
  const group = new RegExp(`${tag}(?:\\s*(?:x|×|,|/|\\*)\\s*${tag}){1,2}`, 'gi');
  for (const m of text.matchAll(group)) {
    if (/packag|box|carton/i.test(before(text, m.index ?? 0, 30))) continue;
    const parts = [...m[0].matchAll(new RegExp(tag, 'gi'))];
    const unit = (m[0].match(new RegExp(`${unitRe}\\s*$`, 'i'))?.[1] ?? parts.find((p) => p[5])?.[5] ?? '').toLowerCase();
    if (!unit) continue;
    const dims: Dims = {};
    for (const p of parts) {
      const letter = (p[1] ?? p[4] ?? '').toLowerCase() as keyof Dims;
      const n = toCm(Number(p[2] ?? p[3]), p[5] ?? unit);
      if (n != null && dims[letter] == null) dims[letter] = n;
    }
    if (Object.keys(dims).length >= 2) return { dims, orderAssumed: false };
  }
  // 2. labelled single sizes: "Width: 200cm", "Overall height 85 cm", "200cm W", "200 cm (W)"
  const dims: Dims = {};
  let length: number | undefined;
  const label = new RegExp(`\\b(width|depth|height|length)\\s*(?:\\(cm\\))?\\s*[:\\-–]?\\s*(\\d+(?:\\.\\d+)?)\\s*${unitRe}`, 'gi');
  for (const m of text.matchAll(label)) {
    if (PART.test(before(text, m.index ?? 0).replace(/\b(overall|total|external|max(?:imum)?)\s*$/i, ''))) continue;
    const word = m[1]!.toLowerCase();
    const n = toCm(Number(m[2]), m[3]!);
    if (n == null) continue;
    if (word === 'length') length ??= n;
    else {
      const k: keyof Dims = word === 'width' ? 'w' : word === 'depth' ? 'd' : 'h';
      if (dims[k] == null) dims[k] = n;
    }
  }
  withLength(dims, length, bed);
  const after = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitRe}\\s*\\(?\\s*([WDH])\\b(?!\\s*[x×]\\s*[WDH]\\b)\\)?`, 'g');
  for (const m of text.matchAll(after)) {
    if (/packag|box|carton/i.test(before(text, m.index ?? 0, 30))) continue;
    const k = m[3]!.toLowerCase() as keyof Dims;
    const n = toCm(Number(m[1]), m[2]!);
    if (n != null && dims[k] == null) dims[k] = n;
  }
  if (Object.keys(dims).length) return { dims, orderAssumed: false };
  // 3. three bare numbers with one unit: "200 x 90 x 85 cm" (W × D × H assumed, said so)
  const bare = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:cm)?\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*(?:cm)?\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*${unitRe}`, 'gi');
  for (const m of text.matchAll(bare)) {
    if (/packag|box|carton/i.test(before(text, m.index ?? 0, 30))) continue;
    const [w, d, h] = [m[1], m[2], m[3]].map((x) => toCm(Number(x), m[4]!));
    if (w != null && d != null && h != null) {
      // "(H x W x D)" written just after says the order
      const order = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 16).match(/\(?\s*([WDH])\s*x\s*([WDH])\s*x\s*([WDH])\s*\)?/i);
      if (order) {
        const out: Dims = {};
        [w, d, h].forEach((v, i) => (out[order[i + 1]!.toLowerCase() as keyof Dims] = v));
        return { dims: out, orderAssumed: false };
      }
      return { dims: { w, d, h }, orderAssumed: true };
    }
  }
  return { dims: {}, orderAssumed: false };
}

/**
 * "Length" with "Width" names the long and the short side: a bed's width is side to side and its
 * length is its depth; a table's or a desk's length runs along the wall (our width) and its
 * "width" is front to back (our depth). Length alone is the width.
 */
function withLength(d: Dims, length: number | undefined, bed: boolean): void {
  if (length == null || d.d != null) {
    if (length != null && d.w == null) d.w = length;
    return;
  }
  if (d.w == null) d.w = length;
  else if (bed) d.d = length;
  else {
    d.d = d.w;
    d.w = length;
  }
}

/** A bed (its length is its depth), from the product's name. */
const bedLike = (s: string) => /\b(beds?|bedstead|mattress|divan|bunk|cot|daybed)\b/i.test(s) && !/\bsofa[ -]?beds?\b/i.test(s);

/** IKEA's measurement list in its page data: {"measure":"207 cm","name":"Width"}. */
function ikeaDims(html: string, bed: boolean): { dims: Dims; hasLength: boolean } {
  const d: Dims = {};
  let length: number | undefined;
  for (const m of html.matchAll(/\{"measure":"([^"]{1,20})","name":"([^"]{1,60})"/g)) {
    const n = lengthOf(m[1]!);
    const name = m[2]!.toLowerCase();
    if (n == null) continue;
    if (name === 'width' && d.w == null) d.w = n;
    else if (name === 'depth' && d.d == null) d.d = n;
    else if ((name === 'height' || name === 'height including back cushions') && (d.h == null || name === 'height')) d.h = n;
    else if (name === 'length' && length == null) length = n;
  }
  withLength(d, length, bed);
  return { dims: d, hasLength: length != null };
}

/** The page's title: the Product's name, else the <title> without the shop's tail. */
function titleOf(html: string, p: Json | null): string {
  const name = typeof p?.name === 'string' ? p.name : '';
  if (name.trim()) return clean(name).trim().slice(0, 140);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  return clean(t).replace(/\s*[|\-–]\s*[^|\-–]{2,40}$/, '').trim().slice(0, 140);
}

/** A price in the page's meta tags (og/product price amount with a GBP currency, or itemprop="price" with GBP). */
function metaPrice(html: string): number | null {
  const meta = (prop: string) => html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`, 'i'))?.[1];
  const amount = meta('product:price:amount') ?? meta('og:price:amount');
  const cur = (meta('product:price:currency') ?? meta('og:price:currency') ?? '').toUpperCase();
  if (amount && cur === 'GBP') return poundsOf(amount);
  const ip = meta('price');
  const ipc = (meta('priceCurrency') ?? '').toUpperCase();
  if (ip && ipc === 'GBP') return poundsOf(ip);
  return null;
}

/** What one product page says: its name, its price in pounds (or none) and its size. */
export function parseProduct(url: string, html: string): Product {
  const p = findProduct(jsonLd(html));
  const offer = p ? offerPrice(p) : null;
  const price = offer?.price ?? metaPrice(html);
  let dims = p ? productDims(p) : {};
  let dimsFrom: Product['dimsFrom'] = Object.keys(dims).length ? 'product data' : 'none';
  let orderAssumed = false;
  const fill = (more: Dims, from: Product['dimsFrom'], assumed = false) => {
    let added = false;
    for (const k of ['w', 'd', 'h'] as const) {
      if (dims[k] == null && more[k] != null) {
        dims = { ...dims, [k]: more[k] };
        added = true;
      }
    }
    if (added && dimsFrom === 'none') {
      dimsFrom = from;
      orderAssumed = assumed;
    }
  };
  const title = titleOf(html, p);
  const bed = bedLike(title);
  const ikea = ikeaDims(html, bed);
  // a list with Length and Width says which side is which better than a Product's width/depth (IKEA's desks put the length in "depth")
  if (ikea.hasLength && ikea.dims.w != null && ikea.dims.d != null) dims = { ...dims, w: ikea.dims.w, d: ikea.dims.d };
  if (dims.w == null || dims.d == null || dims.h == null) fill(ikea.dims, 'product data');
  if (dims.w == null || dims.d == null || dims.h == null) {
    const t = textDims(html, bed);
    fill(t.dims, 'page text', t.orderAssumed);
  }
  return { url, shop: shopName(url), title: title || shopName(url), price, priceFrom: price != null && !!offer?.from, dims, dimsFrom, orderAssumed };
}

/** What a search listing's own line says (when the page itself could not be read): sizes only — a listing's price is never taken. */
export function parseListing(url: string, title: string, snippet: string): Product {
  const t = textDims(`${title} ${snippet}`);
  return { url, shop: shopName(url), title: clean(title).trim().slice(0, 140) || shopName(url), price: null, priceFrom: false, dims: t.dims, dimsFrom: Object.keys(t.dims).length ? 'search listing' : 'none', orderAssumed: t.orderAssumed };
}

// ---------------------------------------------------------------- fit and ranking

/** Under this much spare room on a side (cm), a fit is tight. */
export const TIGHT_CM = 5;

const SIDE: Record<keyof Dims, [string, string]> = { w: ['width', 'wide'], d: ['depth', 'deep'], h: ['height', 'tall'] };

/** Whether a product fits the limits (and the budget), with the smallest spare room and why. */
export function fitOf(p: Product, lim: Limits): { fit: FitStatus; margin: number | null; why: string } {
  if (lim.budget != null && p.price != null && p.price > lim.budget) return { fit: 'over budget', margin: null, why: `£${fmtPrice(p.price - lim.budget)} over the budget` };
  let margin: number | null = null;
  let tightSide = '';
  const missing: string[] = [];
  for (const k of ['w', 'd', 'h'] as const) {
    const max = lim[k];
    if (max == null) continue;
    const v = p.dims[k];
    if (v == null) {
      missing.push(SIDE[k][0]);
      continue;
    }
    const spare = round1(max - v);
    if (spare < 0) return { fit: 'too big', margin: spare, why: `${fmtCm(-spare)} too ${SIDE[k][1]}` };
    if (margin == null || spare < margin) {
      margin = spare;
      tightSide = SIDE[k][0];
    }
  }
  if (missing.length) return { fit: 'unknown', margin: null, why: `${missing.join(' and ')} not given on the page` };
  if (margin == null) return { fit: 'fits', margin: null, why: 'no size limit given' };
  return { fit: margin < TIGHT_CM ? 'tight' : 'fits', margin, why: `${fmtCm(margin)} spare in ${tightSide}` };
}

const ORDER: Record<FitStatus, number> = { fits: 0, tight: 1, unknown: 2, 'too big': 3, 'over budget': 4 };

/**
 * Best first: things that fit with room to spare, then tight fits, then ones whose size the page
 * does not give, then too big or over budget; within each, the cheapest first (no price last).
 */
export function rankProducts(list: Product[], lim: Limits): Ranked[] {
  const seen = new Set<string>();
  return list
    .filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)))
    .map((p) => ({ ...p, ...fitOf(p, lim) }))
    .sort((a, b) => ORDER[a.fit] - ORDER[b.fit] || (a.price ?? Infinity) - (b.price ?? Infinity) || (b.margin ?? -1) - (a.margin ?? -1));
}

export const fmtCm = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} cm`;
export const fmtPrice = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-GB') : n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** "W207 × D85 × H94 cm", with "?" for a side the page does not give. */
export function dimsLine(d: Dims): string {
  if (d.w == null && d.d == null && d.h == null) return 'size not given';
  const s = (n: number | undefined) => (n == null ? '?' : Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `W${s(d.w)} × D${s(d.d)} × H${s(d.h)} cm`;
}

/** The list the model reads: numbered, the shop named, the price as stated (or plainly absent), the fit. */
export function formatResults(ranked: Ranked[], lim: Limits, max = 6): string {
  if (!ranked.length) return 'No product pages with a price or size could be read for that. Try other words, a shop name, or a different size.';
  const want = [lim.w != null ? `W ≤ ${fmtCm(lim.w)}` : '', lim.d != null ? `D ≤ ${fmtCm(lim.d)}` : '', lim.h != null ? `H ≤ ${fmtCm(lim.h)}` : '', lim.budget != null ? `≤ £${fmtPrice(lim.budget)}` : ''].filter(Boolean).join(', ');
  const lines = ranked.slice(0, max).map((r, i) => {
    const price = r.price == null ? 'price not on the page' : `${r.priceFrom ? 'from ' : ''}£${fmtPrice(r.price)}`;
    const size = `${dimsLine(r.dims)}${r.orderAssumed ? ' (order assumed W×D×H)' : ''}${r.dimsFrom === 'search listing' ? ' (from the search listing)' : ''}`;
    const fit = r.fit === 'fits' || r.fit === 'tight' ? `FITS${r.fit === 'tight' ? ' (tight)' : ''}: ${r.why}` : r.fit === 'unknown' ? `fit unknown: ${r.why}` : `${r.fit.toUpperCase()}: ${r.why}`;
    return `${i + 1}. ${r.title} — ${r.shop} — ${price} — ${size} — ${fit}\n   ${r.url}`;
  });
  return `${want ? `Wanted: ${want}.\n` : ''}${lines.join('\n')}\nPrices and sizes are as each shop's page states them today; check the page before buying.`;
}

/** The searches for a thing: UK shops named, the size and style in the words. */
export function searchQueries(item: string, opts: { style?: string; w?: number } = {}): string[] {
  const what = [opts.style, item].filter(Boolean).join(' ').trim();
  const size = opts.w != null ? ` ${Math.round(opts.w)}cm` : '';
  return [`${what}${size} buy UK IKEA Argos Dunelm John Lewis`, `${what} UK Wayfair DFS Habitat B&Q eBay dimensions price`];
}

/** One search hit, from the web search's numbered text ("1. title\nurl\nsnippet"). */
export interface Hit {
  title: string;
  url: string;
  text: string;
}

/** The hits in the web search's text. */
export function hitsFrom(searchText: string): Hit[] {
  const out: Hit[] = [];
  for (const block of searchText.split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const title = (lines[0] ?? '').replace(/^\d+\.\s*/, '').trim();
    const url = (lines[1] ?? '').trim();
    if (/^https?:\/\//i.test(url)) out.push({ title, url, text: lines.slice(2).join(' ').trim() });
  }
  return out;
}

/** Which pages to read: product pages at known shops first, then other product-looking pages; ≤ `max`. */
export function pickPages(hits: Hit[], max = 5): Hit[] {
  const seen = new Set<string>();
  const uniq = hits.filter((h) => looksLikeProduct(h.url) && !seen.has(h.url) && seen.add(h.url));
  return [...uniq.filter((h) => knownShop(h.url)), ...uniq.filter((h) => !knownShop(h.url))].slice(0, max);
}
