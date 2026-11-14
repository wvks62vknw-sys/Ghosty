/**
 * THE CLASSICS SHOP (learn.u6): free public-domain books for his shelf, from public sources only and never a paid catalogue.
 *   - Project Gutenberg through Gutendex (gutendex.com: keyless, free): search by title or author, or the most read.
 *   - Standard Ebooks' open new-releases feed (standardebooks.org/feeds/rss/new-releases: the 15 newest, free). Its full
 *     catalogue feeds need a paid login, so they are never used. A new release is shown with its free Gutenberg edition
 *     where Gutendex has one, and a link to read it on Standard Ebooks' own site.
 * Nothing is fetched until he taps: the book's size is looked up first (one header-only request to gutenberg.org) and said
 * on the key, and the phone asks for it only on Wi-Fi (or on his second tap where the phone cannot tell). The book itself is
 * read in by the library's own Gutenberg importer, a part at a time (importers.ts).
 *
 *   GET  /library/classics?q=<words>&page=<n>  → { books: Classic[], next: number|null, from: 'gutendex' }
 *   GET  /library/classics/new                  → { books: Fresh[], from: 'standardebooks' }
 *   GET  /library/classics/size?id=<n>          → { id, bytes }  (bytes 0: the site did not say)
 *   POST /library/classics/add { id, offset }   → { doc, passages, next, note }  (next null: the whole book is in)
 */
import type { Library } from './store';
import { importSource } from './importers';

export interface Classic {
  id: number;
  title: string;
  authors: string[];
  /** How often it was downloaded on Gutenberg in the last month (the list's order when nothing is searched). */
  downloads: number;
  subjects: string[];
  languages: string[];
}

export interface Fresh {
  title: string;
  author: string;
  /** Its page on Standard Ebooks (read there for free). */
  link: string;
  line: string;
  /** Its free Gutenberg edition, when Gutendex finds one by the same title and author. */
  gutenberg?: number;
}

const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal library)';
const GUTENDEX = 'https://gutendex.com/books/';
const SE_FEED = 'https://standardebooks.org/feeds/rss/new-releases';
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const bad = (error: string, status = 400) => json({ error }, status);

/** "Austen, Jane" → "Jane Austen". */
export const personName = (n: string): string => {
  const m = String(n ?? '').match(/^([^,]+),\s*(.+)$/);
  return (m ? `${m[2]} ${m[1]}` : String(n ?? '')).replace(/\s+/g, ' ').trim();
};

/** One Gutendex result, kept to what the shelf shows (and only books with a plain-text edition the importer reads). */
export function classicOf(b: Record<string, unknown>): Classic | null {
  const id = Number(b.id);
  const formats = (b.formats ?? {}) as Record<string, string>;
  if (!Number.isInteger(id) || id <= 0 || !Object.keys(formats).some((k) => k.startsWith('text/plain'))) return null;
  return {
    id,
    title: String(b.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || `Gutenberg ${id}`,
    authors: (Array.isArray(b.authors) ? b.authors : []).map((a) => personName(String((a as { name?: unknown })?.name ?? ''))).filter(Boolean).slice(0, 3),
    downloads: Number(b.download_count) || 0,
    subjects: (Array.isArray(b.subjects) ? b.subjects : []).map(String).slice(0, 4),
    languages: (Array.isArray(b.languages) ? b.languages : []).map(String).slice(0, 3),
  };
}

/** Standard Ebooks' RSS new releases, read without a parser (title, author, link, a line). */
export function freshOf(xml: string): Fresh[] {
  const text = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, '’').replace(/\s+/g, ' ').trim();
  const out: Fresh[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1]!;
    const tag = (t: string) => text(it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? '');
    const link = tag('link') || tag('guid');
    if (!/^https:\/\/standardebooks\.org\/ebooks\//.test(link)) continue;
    const whole = tag('title');
    // "Pride and Prejudice, by Jane Austen" (the feed's own form); the author is also in <dc:creator> or <author>
    const by = whole.match(/^(.*?),\s+by\s+(.+)$/i);
    out.push({ title: (by?.[1] ?? whole).slice(0, 200), author: (tag('dc:creator') || by?.[2] || '').slice(0, 120), link, line: tag('description').slice(0, 240) });
    if (out.length >= 15) break;
  }
  return out;
}

export interface ClassicsDeps {
  lib: Library;
  /** How the brain reaches the public sources (tests pass a stand-in). */
  fetcher?: typeof fetch;
}

const get = (d: ClassicsDeps, url: string, init?: RequestInit) => (d.fetcher ?? fetch)(url, { ...init, headers: { 'User-Agent': UA, ...(init?.headers ?? {}) }, redirect: 'follow' });

/** A Gutenberg book's free edition for a title and author (Gutendex), or undefined. */
async function gutenbergFor(d: ClassicsDeps, title: string, author: string): Promise<number | undefined> {
  const r = await get(d, `${GUTENDEX}?search=${encodeURIComponent(`${title} ${author.split(' ').at(-1) ?? ''}`.trim())}&mime_type=text%2Fplain`).catch(() => null);
  const j = (r?.ok ? await r.json().catch(() => null) : null) as { results?: Record<string, unknown>[] } | null;
  const want = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hit = (j?.results ?? []).map(classicOf).find((c) => c && c.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().startsWith(want));
  return hit?.id;
}

export async function classicsRoute(req: Request, path: string, method: string, d: ClassicsDeps): Promise<Response> {
  const q = new URL(req.url).searchParams;
  try {
    if (path === '/library/classics' && method === 'GET') {
      const words = (q.get('q') ?? '').trim().slice(0, 100);
      const page = Math.max(1, Math.min(50, Number(q.get('page')) || 1));
      const r = await get(d, `${GUTENDEX}?${words ? `search=${encodeURIComponent(words)}&` : ''}languages=en&mime_type=text%2Fplain&page=${page}`);
      if (!r.ok) return bad('The free classics list (Gutendex) did not answer just now. Try again in a moment.', 502);
      const j = (await r.json()) as { results?: Record<string, unknown>[]; next?: string | null };
      const books = (j.results ?? []).map(classicOf).filter((x): x is Classic => !!x);
      return json({ books, next: j.next ? page + 1 : null, from: 'gutendex' });
    }
    if (path === '/library/classics/new' && method === 'GET') {
      const r = await get(d, SE_FEED, { headers: { Accept: 'application/rss+xml, application/xml' } });
      if (!r.ok) return bad('Standard Ebooks’ new releases did not answer just now. Try again in a moment.', 502);
      const books = freshOf(await r.text());
      // (each one's free Gutenberg edition, looked up a few at a time; one that is not found keeps only its link)
      for (let i = 0; i < books.length; i += 5) await Promise.all(books.slice(i, i + 5).map(async (b) => (b.gutenberg = await gutenbergFor(d, b.title, b.author).catch(() => undefined))));
      return json({ books, from: 'standardebooks' });
    }
    if (path === '/library/classics/size' && method === 'GET') {
      const id = Number(q.get('id'));
      if (!Number.isInteger(id) || id <= 0 || id > 999_999) return bad('Which book?');
      const r = await get(d, `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, { method: 'HEAD' });
      if (!r.ok) return bad('Gutenberg did not have that book’s text just now.', 502);
      return json({ id, bytes: Number(r.headers.get('content-length')) || 0 });
    }
    if (path === '/library/classics/add' && method === 'POST') {
      const b = (await req.json().catch(() => ({}))) as { id?: unknown; offset?: unknown };
      const id = Number(b.id);
      if (!Number.isInteger(id) || id <= 0 || id > 999_999) return bad('Which book?');
      const r = await importSource(d.lib, `gutenberg ${id}`, { offset: Math.max(0, Number(b.offset) || 0) });
      return json({ doc: r.doc, passages: r.passages, next: r.next ?? null, note: r.note });
    }
  } catch {
    return bad('I couldn’t reach the free classics just now. Try again in a moment.', 502);
  }
  return bad('not found', 404);
}
