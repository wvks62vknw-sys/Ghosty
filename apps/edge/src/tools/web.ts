/**
 * Reading the web: fetch a page as text, and search. With a Brave or Tavily key (vault or
 * Cloudflare secret) those are used; without any key Ghosty still searches: DuckDuckGo's page,
 * and — since DuckDuckGo shows data-centre addresses like Cloudflare's a robot check — free,
 * keyless APIs together (DuckDuckGo answers, Wikipedia, Stack Overflow, Hacker News, GitHub).
 */
import { asData } from '../kernel/permissions';
import { arg, clip, type Tool, type ToolContext } from './types';

export const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal assistant)';
const MAX_BYTES = 350_000;

export async function readCapped(r: Response, max = MAX_BYTES): Promise<string> {
  if (!r.body) return '';
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(size, max));
  let o = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.max(0, all.length - o));
    all.set(part, o);
    o += part.length;
  }
  return new TextDecoder().decode(all);
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  return { title, text };
}

/** One line of text: a snippet's own line breaks must not start what looks like another result. */
const oneLine = (t: string) => t.replace(/\s*\n\s*/g, ' ').trim();

/** Search results as text for the model: "n. title", the address, the snippet; one blank line between. */
export function formatSearch(hits: Hit[]): string {
  return hits.map((h, i) => `${i + 1}. ${oneLine(h.title)}\n${h.url}\n${oneLine(h.text)}`.trim()).join('\n\n');
}

export async function search(query: string, ctx: Pick<ToolContext, 'vault'>): Promise<string> {
  return formatSearch(await searchHits(query, ctx));
}

/**
 * A short memory of identical searches and page reads (10 minutes, newest 60 of each): a project
 * step or a cited answer that asks the same thing twice reuses the first answer, which saves the
 * search allowance and keeps the request the model reads the same. In memory only; never errors.
 */
const REUSE_MS = 10 * 60_000;
const REUSE_MAX = 60;
class Reuse<T> {
  private m = new Map<string, { at: number; v: T }>();
  get(k: string): T | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (Date.now() - e.at > REUSE_MS) return void this.m.delete(k);
    return e.v;
  }
  set(k: string, v: T): void {
    this.m.delete(k);
    this.m.set(k, { at: Date.now(), v });
    while (this.m.size > REUSE_MAX) this.m.delete(this.m.keys().next().value!);
  }
  clear(): void {
    this.m.clear();
  }
}
const searches = new Reuse<Hit[]>();
const pages = new Reuse<{ json: boolean; title: string; text: string }>();
/** Forget the reused searches and pages (tests). */
export function forgetReuse(): void {
  searches.clear();
  pages.clear();
}

/** The search itself, as results (title, address, snippet); an identical search in the last 10 minutes is reused. */
export async function searchHits(query: string, ctx: Pick<ToolContext, 'vault'>): Promise<Hit[]> {
  const k = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const had = searches.get(k);
  if (had) return had;
  const hits = await searchFresh(query, ctx);
  searches.set(k, hits);
  return hits;
}

async function searchFresh(query: string, ctx: Pick<ToolContext, 'vault'>): Promise<Hit[]> {
  // .catch: with the database paused, fall through to the keyless search.
  const brave = await ctx.vault.get('brave').catch(() => null);
  if (brave) {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=6&q=${encodeURIComponent(query)}`, {
      headers: { 'X-Subscription-Token': brave, Accept: 'application/json' },
    });
    if (r.ok) {
      const j = (await r.json()) as { web?: { results?: { title: string; url: string; description?: string }[] } };
      return (j.web?.results ?? []).map((x) => ({ title: x.title, url: x.url, text: htmlToText(x.description ?? '').text }));
    }
  }
  const tavily = await ctx.vault.get('tavily').catch(() => null);
  if (tavily) {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavily, query, max_results: 6 }),
    });
    if (r.ok) {
      const j = (await r.json()) as { results?: { title: string; url: string; content?: string }[] };
      return (j.results ?? []).map((x) => ({ title: x.title, url: x.url, text: (x.content ?? '').slice(0, 400) }));
    }
  }
  const out: Hit[] = [];
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    const html = r.ok ? await readCapped(r, 200_000) : '';
    for (const m of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)) {
      let url = m[1]!;
      const u = url.match(/uddg=([^&]+)/);
      if (u) url = decodeURIComponent(u[1]!);
      out.push({ title: htmlToText(m[2]!).text, url, text: htmlToText(m[3]!).text });
      if (out.length >= 6) break;
    }
  } catch {
    /* blocked or slow: the keyless sources below */
  }
  if (out.length < 3) out.push(...(await keylessSearch(query)));
  // These sources want every word to match: a long question often finds nothing, so try its key words.
  const short = keyWords(query);
  if (out.length < 3 && short && short !== query.toLowerCase()) out.push(...(await keylessSearch(short)));
  const seen = new Set<string>();
  const list = out.filter((h) => h.url && !seen.has(h.url) && seen.add(h.url)).slice(0, 8);
  if (!list.length) throw new Error('Search found nothing for that. Try other words, or web_fetch a page you know.');
  return list;
}

export interface Hit {
  title: string;
  url: string;
  text: string;
}

/** The host of a web address, for progress lines ("fetching example.com…"); the address itself when it won't parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 60);
  }
}

const entities = (t: string) => htmlToText(t).text;

const STOP = new Set('a an and are as at be best by can do does for from game get how i in is it make me my of on or simple the to what when where which who why with you your short'.split(' '));
/** The three most telling words of a query ("make me a short simple block merge game" → "block merge game"). */
export function keyWords(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 3)
    .join(' ');
}

/** Free search sources that need no key and don't block data-centre addresses, asked together. */
export async function keylessSearch(query: string): Promise<Hit[]> {
  const q = encodeURIComponent(query);
  const get = async <T>(url: string): Promise<T> => {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as T;
  };
  const sources: Promise<Hit[]>[] = [
    // DuckDuckGo instant answers (Wikipedia-backed summaries and related topics)
    get<{ Heading?: string; AbstractText?: string; AbstractURL?: string; RelatedTopics?: { Text?: string; FirstURL?: string }[] }>(`https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=${q}`).then((j) => [
      ...(j.AbstractText && j.AbstractURL ? [{ title: j.Heading || query, url: j.AbstractURL, text: j.AbstractText }] : []),
      ...(j.RelatedTopics ?? []).filter((t) => t.Text && t.FirstURL).slice(0, 3).map((t) => ({ title: t.Text!.split(' - ')[0]!, url: t.FirstURL!, text: t.Text! })),
    ]),
    // Wikipedia
    get<[string, string[], string[], string[]]>(`https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=3&search=${q}`).then((j) => (j[1] ?? []).map((t, i) => ({ title: t, url: j[3]?.[i] ?? '', text: j[2]?.[i] || 'Wikipedia article' }))),
    // Stack Overflow (coding questions)
    get<{ items?: { title: string; link: string; tags?: string[]; is_answered?: boolean }[] }>(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&site=stackoverflow&pagesize=3&q=${q}`).then((j) => (j.items ?? []).map((x) => ({ title: entities(x.title), url: x.link, text: `Stack Overflow${x.is_answered ? ' (answered)' : ''} · ${(x.tags ?? []).join(', ')}` }))),
    // Hacker News (tech news, launches, write-ups)
    get<{ hits?: { title?: string; url?: string; objectID: string; points?: number }[] }>(`https://hn.algolia.com/api/v1/search?hitsPerPage=3&query=${q}`).then((j) => (j.hits ?? []).filter((h) => h.title).map((h) => ({ title: h.title!, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, text: `Hacker News · ${h.points ?? 0} points` }))),
    // GitHub (projects and code)
    get<{ items?: { full_name: string; html_url: string; description?: string | null; stargazers_count?: number }[] }>(`https://api.github.com/search/repositories?per_page=3&q=${q}`).then((j) => (j.items ?? []).map((x) => ({ title: x.full_name, url: x.html_url, text: `${x.description ?? ''} · ★${x.stargazers_count ?? 0}` }))),
  ];
  const settled = await Promise.allSettled(sources);
  // Interleave so each source gets a look-in near the top.
  const lists = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));
  const out: Hit[] = [];
  for (let i = 0; i < 4; i++) for (const l of lists) if (l[i]) out.push(l[i]!);
  return out;
}

export const webTools: Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web. Use for anything current or that you are unsure about. Returns titles, links and snippets.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const q = arg.str(a, 'query');
      const hits = await searchHits(q, ctx);
      const text = clip(formatSearch(hits), 6000);
      // Only the results the model gets to read count as looked up.
      for (const h of hits) if (text.includes(h.url)) ctx.found?.({ kind: 'web', title: oneLine(h.title) || hostOf(h.url), url: h.url, text: oneLine(h.text) });
      return asData('web search', text);
    },
  },
  {
    name: 'web_fetch',
    description: 'Read a web page (or JSON/text URL) and return its text. Use after web_search to read a result.',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const url = arg.str(a, 'url');
      if (!/^https?:\/\//i.test(url)) throw new Error('url must start with http:// or https://');
      // (?. — tests call tools with a bare context)
      let page = pages.get(url);
      if (!page) {
        ctx.progress?.(`fetching ${hostOf(url)}…`);
        const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5' }, redirect: 'follow' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const type = r.headers.get('content-type') ?? '';
        ctx.progress?.('reading…');
        const raw = await readCapped(r);
        page = /json|text\/plain|csv|xml/.test(type) ? { json: true, title: '', text: raw } : { json: false, ...htmlToText(raw) };
        pages.set(url, page); // read again within 10 minutes: this copy
      }
      if (page.json) {
        const text = clip(page.text, 9000);
        ctx.found?.({ kind: 'web', title: hostOf(url).replace(/^www\./, ''), url, text });
        return asData(url, text);
      }
      const { title, text } = page;
      const read = clip(`${title}\n\n${text}`, 9000);
      ctx.found?.({ kind: 'web', title: oneLine(title).slice(0, 200) || hostOf(url).replace(/^www\./, ''), url, text: read.slice(title.length).trim() });
      return asData(url, read);
    },
  },
];
