/** Reading the web: fetch a page as text, and search (Brave or Tavily key, DuckDuckGo fallback). */
import { asData } from '../kernel/permissions';
import { arg, clip, type Tool, type ToolContext } from './types';

const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal assistant)';
const MAX_BYTES = 350_000;

async function readCapped(r: Response, max = MAX_BYTES): Promise<string> {
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

async function search(query: string, ctx: ToolContext): Promise<string> {
  const brave = await ctx.vault.get('brave');
  if (brave) {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=6&q=${encodeURIComponent(query)}`, {
      headers: { 'X-Subscription-Token': brave, Accept: 'application/json' },
    });
    if (r.ok) {
      const j = (await r.json()) as { web?: { results?: { title: string; url: string; description?: string }[] } };
      return (j.web?.results ?? []).map((x, i) => `${i + 1}. ${x.title}\n${x.url}\n${htmlToText(x.description ?? '').text}`).join('\n\n');
    }
  }
  const tavily = await ctx.vault.get('tavily');
  if (tavily) {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavily, query, max_results: 6 }),
    });
    if (r.ok) {
      const j = (await r.json()) as { results?: { title: string; url: string; content?: string }[] };
      return (j.results ?? []).map((x, i) => `${i + 1}. ${x.title}\n${x.url}\n${(x.content ?? '').slice(0, 400)}`).join('\n\n');
    }
  }
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('Search is unavailable. Add a free Brave Search or Tavily key in the System tab.');
  const html = await readCapped(r, 200_000);
  const out: string[] = [];
  for (const m of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)) {
    let url = m[1]!;
    const u = url.match(/uddg=([^&]+)/);
    if (u) url = decodeURIComponent(u[1]!);
    out.push(`${out.length + 1}. ${htmlToText(m[2]!).text}\n${url}\n${htmlToText(m[3]!).text}`);
    if (out.length >= 6) break;
  }
  if (!out.length) throw new Error('Search returned nothing (the free fallback may be blocked). Add a Brave Search or Tavily key in the System tab.');
  return out.join('\n\n');
}

export const webTools: Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web. Use for anything current or that you are unsure about. Returns titles, links and snippets.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    risk: 'auto',
    async run(a, ctx) {
      const q = arg.str(a, 'query');
      return asData('web search', clip(await search(q, ctx), 6000));
    },
  },
  {
    name: 'web_fetch',
    description: 'Read a web page (or JSON/text URL) and return its text. Use after web_search to read a result.',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    risk: 'auto',
    async run(a) {
      const url = arg.str(a, 'url');
      if (!/^https?:\/\//i.test(url)) throw new Error('url must start with http:// or https://');
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5' }, redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const type = r.headers.get('content-type') ?? '';
      const raw = await readCapped(r);
      if (/json|text\/plain|csv|xml/.test(type)) return asData(url, clip(raw, 9000));
      const { title, text } = htmlToText(raw);
      return asData(url, clip(`${title}\n\n${text}`, 9000));
    },
  },
];
