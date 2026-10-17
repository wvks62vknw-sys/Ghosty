/**
 * FIT FINDER: `find_furniture` looks for a piece of furniture at UK shops and keeps the ones
 * that fit the owner's space, best fit and cheapest first, with links. The searching is the
 * web search everyone uses (tools/web.ts); the reading of each page is integrations/products.ts
 * (no AI: prices only as the page states them, never guessed). At most 8 pages are read, so a
 * call stays well under the free plan's 50 outbound requests (two searches take ≤ 22).
 */
import { asData } from '../kernel/permissions';
import { formatResults, hitsFrom, knownShop, looksLikeProduct, parseListing, parseProduct, pickPages, rankProducts, searchQueries, type Hit, type Limits, type Product } from '../integrations/products';
import { arg, type Tool } from './types';
import { search, UA } from './web';

/** Pages read per call (product pages, plus shop list pages to find product pages in). */
export const MAX_PAGES = 8;
/** A page is read up to this size: the size and price data sit deep in big shop pages (IKEA's ~1.1 MB in). */
const MAX_PAGE_BYTES = 2_000_000;

async function readPage(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'en-GB,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!r.body) return '';
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_PAGE_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => undefined);
  const all = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return new TextDecoder().decode(all);
}

/** Product pages linked from a shop's list page (same shop only), for when a search finds only lists. */
export function productLinks(listUrl: string, html: string, max = 6): string[] {
  const out: string[] = [];
  let host = '';
  try {
    host = new URL(listUrl).hostname;
  } catch {
    return out;
  }
  for (const m of html.matchAll(/href=["']([^"'#\s]{2,300})["']/gi)) {
    let u: URL;
    try {
      u = new URL(m[1]!.replace(/&amp;/g, '&'), listUrl);
    } catch {
      continue;
    }
    if (u.hostname !== host) continue;
    const s = `${u.origin}${u.pathname}`;
    if (looksLikeProduct(s) && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const optNum = (a: Record<string, unknown>, k: string): number | undefined => {
  const n = arg.num(a, k, NaN);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export const homeTools: Tool[] = [
  {
    name: 'find_furniture',
    description:
      'Find a piece of furniture at UK shops (IKEA, Argos, Dunelm, John Lewis, Wayfair, DFS, Habitat, B&Q, eBay) that fits a space: reads the shops\' own pages for the price and the size (W × D × H), keeps what fits, best fit then cheapest first, with links. Prices are only ever as the page states them. Sizes in cm (convert feet/inches first).',
    parameters: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'what to find, e.g. "3 seater sofa", "double wardrobe", "desk"' },
        max_width_cm: { type: 'number', description: 'the most width the space allows (cm)' },
        max_depth_cm: { type: 'number', description: 'the most depth (front to back) the space allows (cm)' },
        max_height_cm: { type: 'number', description: 'the most height (cm)' },
        budget_gbp: { type: 'number', description: 'the most it may cost (£)' },
        style: { type: 'string', description: 'colour, material or style words, e.g. "cream leather", "oak", "mid-century"' },
      },
      required: ['item'],
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const item = arg.str(a, 'item').slice(0, 80);
      const style = arg.str(a, 'style', false).slice(0, 60);
      const lim: Limits = { w: optNum(a, 'max_width_cm'), d: optNum(a, 'max_depth_cm'), h: optNum(a, 'max_height_cm'), budget: optNum(a, 'budget_gbp') };
      ctx.progress?.('searching UK shops…');
      const hits: Hit[] = [];
      for (const q of searchQueries(item, { style, w: lim.w })) {
        try {
          hits.push(...hitsFrom(await search(q, ctx)));
        } catch {
          /* nothing for these words: the other search may still find some */
        }
      }
      if (!hits.length) return 'The web search found no shops for that just now. Try other words, or ask again in a minute.';
      let pages = pickPages(hits, 5);
      let budget = MAX_PAGES;
      // Searches often find a shop's list page rather than its products: read up to two lists for product links.
      if (pages.length < 3) {
        const lists = hits.filter((h) => knownShop(h.url) && !looksLikeProduct(h.url)).slice(0, 2);
        for (const l of lists) {
          budget--;
          try {
            const links = productLinks(l.url, await readPage(l.url), 4);
            pages = [...pages, ...links.filter((u) => !pages.some((p) => p.url === u)).map((url) => ({ title: '', url, text: '' }))];
          } catch {
            /* a shop that turns robots away: its listing lines are still used below */
          }
        }
        pages = pages.slice(0, Math.min(5, budget));
      }
      const found: Product[] = [];
      let done = 0;
      const results = await Promise.allSettled(
        pages.map(async (h) => {
          try {
            const p = parseProduct(h.url, await readPage(h.url));
            return p;
          } finally {
            ctx.progress?.('reading shop pages…', ++done, pages.length);
          }
        }),
      );
      results.forEach((r, i) => {
        const h = pages[i]!;
        if (r.status === 'fulfilled') {
          const p = r.value;
          if (p.price != null || Object.keys(p.dims).length) found.push(p);
        } else if (h.title) {
          // the shop turned the reader away: the search listing's own words may still give the size (never a price)
          const p = parseListing(h.url, h.title, h.text);
          if (Object.keys(p.dims).length) found.push(p);
        }
      });
      const read = results.filter((r) => r.status === 'fulfilled').length;
      const text = formatResults(rankProducts(found, lim), lim);
      return asData('shop pages', `${text}\n(${read} of ${pages.length} shop pages read.)`);
    },
  },
];
