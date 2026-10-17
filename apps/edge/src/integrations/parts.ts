/**
 * Replacement parts: a part (and the gadget it belongs to) → a web search with UK shops in mind
 * → up to five shop pages read → title, price, stock and part numbers taken from each page's own
 * product data (schema.org JSON-LD, the shop's embedded offer, meta tags, then the visible "£…"
 * as a last resort) → ranked by how well they match (the part number above all), then by price.
 *
 * Nothing is made up: a price is only ever one read off the page just now, a page that could not
 * be read is listed as a search result with no price, and when nothing matches the answer says so.
 * The parsing here is pure and unit-tested on real pages (apps/edge/test/parts.test.mjs).
 */
import { htmlToText, readCapped } from '../tools/web';

/** UK shops and marketplaces for parts, as people know them. `note` is said with every listing from it. */
export const RETAILERS: { host: RegExp; name: string; note?: string }[] = [
  { host: /(^|\.)ebay\.co\.uk$/, name: 'eBay UK', note: 'marketplace: check the seller' },
  { host: /(^|\.)ebay\.com$/, name: 'eBay', note: 'may ship from abroad' },
  { host: /(^|\.)amazon\.co\.uk$/, name: 'Amazon UK' },
  { host: /(^|\.)rs-online\.com$/, name: 'RS Components' },
  { host: /(^|\.)cpc\.farnell\.com$/, name: 'CPC' },
  { host: /(^|\.)(uk\.)?farnell\.com$/, name: 'Farnell' },
  { host: /(^|\.)aliexpress\.(com|us)$/, name: 'AliExpress', note: 'cheap but slow shipping from China (often 1–3 weeks)' },
  { host: /(^|\.)espares\.co\.uk$/, name: 'eSpares' },
  { host: /(^|\.)screwfix\.com$/, name: 'Screwfix' },
  { host: /(^|\.)toolstation\.com$/, name: 'Toolstation' },
  { host: /(^|\.)partmaster\.co\.uk$/, name: 'Partmaster' },
  { host: /(^|\.)ransomspares\.co\.uk$/, name: 'Ransom Spares' },
  { host: /(^|\.)argos\.co\.uk$/, name: 'Argos' },
  { host: /(^|\.)currys\.co\.uk$/, name: 'Currys' },
  { host: /(^|\.)mouser\.co\.uk$/, name: 'Mouser' },
  { host: /(^|\.)digikey\.co\.uk$/, name: 'DigiKey' },
];

export interface PartQuery {
  description: string;
  partNumber?: string;
  device?: string;
}

export interface Listing {
  url: string;
  shop: string;
  note?: string;
  title: string;
  /** Read off the page; absent when the page gave none (never guessed). */
  price?: number;
  currency?: string;
  /** Where the price came from: the shop's product data, or the visible page text. */
  priceFrom?: 'product data' | 'page text';
  availability?: 'in stock' | 'out of stock' | 'pre-order' | 'limited';
  partNumbers: string[];
  brand?: string;
  /** From the search only: the page was not read (or could not be). */
  unread?: boolean;
  snippet?: string;
  score: number;
  /** The part number asked for appears on the page. */
  exact: boolean;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function retailerOf(url: string): { name: string; note?: string; known: boolean } {
  const host = hostOf(url);
  const r = RETAILERS.find((x) => x.host.test(host));
  return r ? { name: r.name, note: r.note, known: true } : { name: host || 'a website', known: false };
}

const decode = (t: string) =>
  t
    .replace(/&pound;|&#163;|&#xa3;/gi, '£')
    .replace(/&euro;|&#8364;/gi, '€')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');

const AVAIL: [RegExp, Listing['availability']][] = [
  [/OutOfStock|SoldOut|Discontinued/i, 'out of stock'],
  [/PreOrder|BackOrder/i, 'pre-order'],
  [/LimitedAvailability/i, 'limited'],
  [/InStock|OnlineOnly|InStoreOnly/i, 'in stock'],
];
const availOf = (v: unknown): Listing['availability'] => {
  const s = String(v ?? '');
  return AVAIL.find(([re]) => re.test(s))?.[1];
};

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[,£$€\s]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1e6 ? n : undefined;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const typeIs = (o: Obj, t: string) => [o['@type']].flat().some((x) => String(x).toLowerCase() === t.toLowerCase());

/** Every object in a JSON-LD value (top level, arrays, @graph). */
function* objects(v: unknown, depth = 0): Generator<Obj> {
  if (depth > 4) return;
  if (Array.isArray(v)) for (const x of v) yield* objects(x, depth + 1);
  else if (isObj(v)) {
    yield v;
    if (v['@graph']) yield* objects(v['@graph'], depth + 1);
  }
}

/** The first offer's price, currency and availability (Offer, AggregateOffer or a list of them). */
function offerOf(offers: unknown): { price?: number; currency?: string; availability?: Listing['availability'] } {
  for (const o of objects(offers)) {
    const price = num(o.price) ?? num(o.lowPrice) ?? num(isObj(o.priceSpecification) ? o.priceSpecification.price : undefined);
    if (price) return { price, currency: String(o.priceCurrency ?? (isObj(o.priceSpecification) ? o.priceSpecification.priceCurrency : '') ?? '').toUpperCase() || undefined, availability: availOf(o.availability) };
  }
  return {};
}

const brandOf = (b: unknown): string | undefined => {
  const s = isObj(b) ? b.name : b;
  return typeof s === 'string' && s.trim() ? s.trim().slice(0, 60) : undefined;
};

const PART_RE = /\b(?:manufacturer'?s? part (?:number|no\.?)|part (?:number|no\.?|#)|mpn|product code|model (?:number|no\.?))\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/.]{2,24}[A-Z0-9])/gi;

/** Part numbers the page itself states ("Part Number GSK615", "Product code: AG420", sku/mpn). */
export function partNumbersIn(text: string, extra: unknown[] = []): string[] {
  const out = new Set<string>();
  for (const v of extra) if (typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9\-/.]{2,30}$/.test(v.trim())) out.add(v.trim().toUpperCase());
  for (const m of text.matchAll(PART_RE)) if (/\d/.test(m[1]!)) out.add(m[1]!.toUpperCase());
  return [...out].slice(0, 6);
}

const cleanTitle = (t: string) => decode(t).replace(/\s+/g, ' ').replace(/\s+[|–—-]\s+[^|–—]{2,40}$/, '').trim().slice(0, 160);

/**
 * One shop page → what it sells: title, price, stock, part numbers. Structured data first (it is
 * what the shop tells search engines, so it is the shop's own price), the visible "£12.34" only
 * when the page carries none.
 */
export function parseProduct(html: string, url: string): Omit<Listing, 'score' | 'exact' | 'shop' | 'note'> {
  const out: Omit<Listing, 'score' | 'exact' | 'shop' | 'note'> = { url, title: '', partNumbers: [] };
  const ids: unknown[] = [];
  // 1. JSON-LD Product
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    for (const o of objects(data)) {
      if (!typeIs(o, 'Product') && !typeIs(o, 'ProductGroup')) continue;
      if (!out.title && typeof o.name === 'string') out.title = cleanTitle(o.name);
      ids.push(o.sku, o.mpn, o.gtin13);
      out.brand ??= brandOf(o.brand);
      const offer = offerOf(o.offers);
      if (offer.price && out.price === undefined) Object.assign(out, offer, { priceFrom: 'product data' as const });
      if (out.price !== undefined) break;
    }
  }
  // 2. A schema.org offer embedded in the shop's own scripts (review widgets, data layers)
  if (out.price === undefined) {
    const m = html.match(/"offers"\s*:\s*\{([^{}]*"price"\s*:\s*"?[\d.]+"?[^{}]*)\}/);
    if (m) {
      const body = m[1]!;
      const price = num(body.match(/"price"\s*:\s*"?([\d.]+)/)?.[1]);
      if (price) {
        out.price = price;
        out.currency = body.match(/"priceCurrency"\s*:\s*"([A-Za-z]{3})"/)?.[1]?.toUpperCase();
        out.availability = availOf(body.match(/"availability"\s*:\s*"([^"]+)"/)?.[1]);
        out.priceFrom = 'product data';
      }
    }
  }
  // 3. Meta tags (Open Graph product, microdata)
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${name}["']`, 'i'))?.[1];
  if (out.price === undefined) {
    const price = num(meta('product:price:amount') ?? meta('og:price:amount') ?? meta('price') ?? html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i)?.[1]);
    if (price) {
      out.price = price;
      out.currency = (meta('product:price:currency') ?? meta('og:price:currency') ?? meta('priceCurrency'))?.toUpperCase();
      out.priceFrom = 'product data';
    }
  }
  if (!out.availability) out.availability = availOf(meta('product:availability') ?? meta('og:availability') ?? html.match(/itemprop=["']availability["'][^>]*(?:href|content)=["']([^"']+)/i)?.[1]);
  const title = meta('og:title') ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  if (!out.title) out.title = cleanTitle(title);
  // 4. The visible text: the first "£12.34" (a price people see, but not necessarily this item's)
  const text = decode(htmlToText(html).text);
  if (out.price === undefined) {
    const m = text.match(/£\s?(\d{1,5}(?:,\d{3})*(?:\.\d{2}))/);
    const price = num(m?.[1]);
    if (price) {
      out.price = price;
      out.currency = 'GBP';
      out.priceFrom = 'page text';
    }
  }
  if (!out.availability) {
    const head = text.slice(0, 6000);
    if (/\b(out of stock|sold out|currently unavailable|no longer available)\b/i.test(head)) out.availability = 'out of stock';
    else if (/\b(in stock|available for immediate despatch|available to buy)\b/i.test(head)) out.availability = 'in stock';
  }
  out.partNumbers = partNumbersIn(`${decode(title)}\n${text.slice(0, 20000)}`, ids);
  return out;
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const WORD_STOP = new Set('a an and for the of to with in on replacement spare part parts new genuine compatible uk buy my this that'.split(' '));
const wordsOf = (s: string) => [...new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !WORD_STOP.has(w)))];

/** How well a listing fits: the asked part number on the page counts most, then the description's words, then the device's. */
export function matchScore(l: Pick<Listing, 'title' | 'partNumbers' | 'snippet'>, q: PartQuery, pageText = ''): { score: number; exact: boolean } {
  const hay = `${l.title} ${l.snippet ?? ''} ${pageText.slice(0, 20000)}`;
  const hayNorm = norm(`${hay} ${l.partNumbers.join(' ')}`);
  const pn = norm(q.partNumber ?? '');
  const exact = pn.length >= 4 && hayNorm.includes(pn);
  const title = l.title.toLowerCase();
  const dw = wordsOf(q.description);
  const inTitle = dw.filter((w) => title.includes(w)).length;
  const inPage = dw.filter((w) => hay.toLowerCase().includes(w)).length;
  const devw = wordsOf(q.device ?? '');
  const dev = devw.filter((w) => hay.toLowerCase().includes(w)).length;
  const score = (exact ? 10 : 0) + (dw.length ? (3 * inTitle + inPage) / dw.length : 0) + (devw.length ? (1.5 * dev) / devw.length : 0);
  return { score: Math.round(score * 100) / 100, exact };
}

/** Best first: the asked part number found, then match, then in stock, then cheapest; unread pages last within their tier. */
export function rankListings(list: Listing[]): Listing[] {
  const tier = (l: Listing) => (l.exact ? 2 : l.score >= 2 ? 1 : 0);
  const stock = (l: Listing) => (l.availability === 'out of stock' ? 1 : 0);
  return [...list].sort((a, b) => tier(b) - tier(a) || stock(a) - stock(b) || (a.price === undefined ? 1 : 0) - (b.price === undefined ? 1 : 0) || (a.price ?? 0) - (b.price ?? 0) || b.score - a.score);
}

/** A search result list ("1. title\nurl\nsnippet", the web search helper's text) → hits. */
export function parseHitList(text: string): { title: string; url: string; text: string }[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const [first = '', url = '', ...rest] = block.trim().split('\n');
      return { title: first.replace(/^\d+\.\s*/, '').slice(0, 160), url: /^https?:\/\//.test(url.trim()) ? url.trim() : '', text: rest.join(' ').slice(0, 300) };
    })
    .filter((h) => h.title && h.url);
}

/** Pages that look like one product (not a search, a category or a help page). */
export const looksLikeProduct = (url: string): boolean => /\/(itm|dp|gp\/product|product|products|p)\/|product\.pl|\/p[A-Z0-9]{3,}$|\/p\d{3,}|\.html?$|-p-\d+|\/item\//i.test(url) && !/\/(search|sch|s)\b|[?&](q|k|_nkw|search|st)=/i.test(url);

const money = (l: Listing) => (l.price === undefined ? 'price not shown' : `${l.currency && l.currency !== 'GBP' ? `${l.currency} ` : '£'}${l.price.toFixed(2)}${l.priceFrom === 'page text' ? ' (from the page text)' : ''}`);

/** The listings for the model to read (and quote to the owner). */
export function renderParts(q: PartQuery, list: Listing[], extra: string[] = []): string {
  const what = [q.partNumber, q.description, q.device ? `for ${q.device}` : ''].filter(Boolean).join(' ');
  if (!list.length) return `No shop listing found for ${what}. Do not guess a price or a shop: say nothing was found, and suggest the number printed on the part itself, or the model number on the appliance's rating plate, to search again.${extra.length ? `\n${extra.join('\n')}` : ''}`;
  const lines = [`Replacement part search: ${what}. Prices and stock were read from the shops' pages just now (check before buying).`];
  list.forEach((l, i) => {
    const bits = [money(l), l.availability, l.partNumbers.length ? `part no. ${l.partNumbers.slice(0, 3).join(', ')}` : '', l.exact ? 'matches the part number' : '', l.note].filter(Boolean);
    lines.push(`${i + 1}. ${l.title || '(no title)'} — ${l.shop}${l.unread ? ' (search result, page not read)' : ''}: ${bits.join('; ')}\n   ${l.url}`);
  });
  if (q.partNumber && !list.some((l) => l.exact)) lines.push(`None of these pages mention the part number ${q.partNumber}: say so, and that they may not fit.`);
  lines.push(...extra);
  return lines.join('\n');
}

export interface PartsDeps {
  search: (query: string) => Promise<string>;
  fetch?: typeof fetch;
  progress?: (label: string, done?: number, total?: number) => void;
  /** Pages to read at most (5). */
  maxPages?: number;
}

const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal assistant)';

/** Read one page (≤ 400 KB, 8 s), or null. */
async function readPage(f: typeof fetch, url: string): Promise<string | null> {
  try {
    const r = await f(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'en-GB,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (!r.ok || !/html|xml/i.test(r.headers.get('content-type') ?? 'text/html')) return null;
    return await readCapped(r, 400_000);
  } catch {
    return null;
  }
}

/** The whole errand: search, read up to five shop pages, rank. */
export async function findParts(q: PartQuery, deps: PartsDeps): Promise<{ listings: Listing[]; text: string }> {
  const f = deps.fetch ?? fetch;
  const max = Math.min(5, deps.maxPages ?? 5);
  const base = [q.partNumber, q.description, q.device].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!base) throw new Error('say what the part is (a description or its part number)');
  const queries = [`${base} buy UK`, `${q.partNumber ? `${q.partNumber} ` : ''}${q.description}${q.device ? ` ${q.device}` : ''} spare part eSpares eBay UK`];
  const hits: { title: string; url: string; text: string }[] = [];
  for (const [i, query] of queries.entries()) {
    // the second search only when the first found too few shops (each search is several requests)
    if (i > 0 && hits.filter((h) => retailerOf(h.url).known).length >= 3) break;
    deps.progress?.(i ? 'searching the spare-parts shops…' : 'searching UK shops…');
    const found = await deps.search(query).then(parseHitList).catch(() => []);
    for (const h of found) if (!hits.some((x) => x.url === h.url)) hits.push(h);
  }
  // shops first, product pages first among them
  const order = (h: { url: string }) => (retailerOf(h.url).known ? 0 : 2) + (looksLikeProduct(h.url) ? 0 : 1);
  const candidates = hits.filter((h) => /^https:\/\//.test(h.url) && !/\.(pdf|jpe?g|png)$/i.test(h.url)).sort((a, b) => order(a) - order(b));
  const toRead = candidates.filter((h) => retailerOf(h.url).known || looksLikeProduct(h.url)).slice(0, max);
  const listings: Listing[] = [];
  let done = 0;
  await Promise.all(
    toRead.map(async (h) => {
      const html = await readPage(f, h.url);
      deps.progress?.(`reading ${hostOf(h.url)}…`, ++done, toRead.length);
      const shop = retailerOf(h.url);
      if (!html) {
        listings.push({ url: h.url, shop: shop.name, note: shop.note, title: h.title, partNumbers: partNumbersIn(`${h.title} ${h.text}`), unread: true, snippet: h.text, ...matchScore({ title: h.title, partNumbers: [], snippet: h.text }, q) });
        return;
      }
      const p = parseProduct(html, h.url);
      const title = p.title || h.title;
      const m = matchScore({ title, partNumbers: p.partNumbers, snippet: h.text }, q, htmlToText(html).text);
      listings.push({ ...p, title, shop: shop.name, note: shop.note, snippet: h.text, ...m });
    }),
  );
  // shops in the results that were not read (over the page budget) are still worth naming
  for (const h of candidates.filter((c) => !toRead.includes(c) && retailerOf(c.url).known).slice(0, 3)) {
    const shop = retailerOf(h.url);
    listings.push({ url: h.url, shop: shop.name, note: shop.note, title: h.title, partNumbers: partNumbersIn(`${h.title} ${h.text}`), unread: true, snippet: h.text, ...matchScore({ title: h.title, partNumbers: [], snippet: h.text }, q) });
  }
  // a page that matches nothing asked is not a listing for this part
  const ranked = rankListings(listings.filter((l) => l.exact || l.score >= 1));
  return { listings: ranked, text: renderParts(q, ranked) };
}
