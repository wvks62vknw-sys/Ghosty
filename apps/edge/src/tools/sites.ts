/**
 * Rebuilt websites: Ghosty studies a page (study_site: structure, text, images, colours, fonts,
 * scripts and how heavy it is), writes a faster, cleaner, phone-first version itself, and
 * publishes it (publish_site) at a free, public, clickable link on Ghosty's own address:
 * https://<ghosty>/s/<name>. No account or setup.
 *
 * Safety: a rebuilt page is served in a sandbox (its own opaque origin — it can't read Ghosty's
 * data or keys), is not indexed by search engines, carries a small "rebuilt by Ghosty" badge
 * naming the original, and may not contain password fields or forms that send data anywhere,
 * so it can't be used to impersonate a real login or payment page.
 */
import { asData } from '../kernel/permissions';
import { arg, clip, type Tool } from './types';
import { readCapped, UA } from './web';

const PREFIX = 'site:';
const MAX_HTML = 400_000;

export interface Site {
  name: string;
  title: string;
  html: string;
  source: string;
  at: number;
}

export const siteSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

export async function loadSite(storage: DurableObjectStorage, name: string): Promise<Site | undefined> {
  return storage.get<Site>(PREFIX + siteSlug(name));
}

// ---------------------------------------------------------------------------------------
// Studying a site
// ---------------------------------------------------------------------------------------

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const strip = (html: string) => decode(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((x) => x !== undefined) ?? '';
const abs = (u: string, base: string) => {
  try {
    return new URL(decode(u), base).toString();
  } catch {
    return '';
  }
};
const top = <T>(list: T[], n: number) => {
  const count = new Map<T, number>();
  for (const x of list) count.set(x, (count.get(x) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, n).map(([x]) => x);
};

/** What a page is made of, for rebuilding it (pure: the fetched HTML and CSS in, a blueprint out). */
export function blueprint(url: string, html: string, css: string[]): string {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? '';
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (k: string) => attr(metas.find((m) => new RegExp(`(name|property)\\s*=\\s*["']?${k}["']?`, 'i').test(m)) ?? '', 'content');
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: abs(attr(m[1]!, 'href'), url), text: strip(m[2]!).slice(0, 60) })).filter((l) => l.text && l.href.startsWith('http'));
  const navHtml = html.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? '';
  const nav = [...navHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => `${strip(m[2]!).slice(0, 40)} → ${abs(attr(m[1]!, 'href'), url)}`).filter((x) => !x.startsWith(' →')).slice(0, 15);
  const headings = [...html.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => `${'  '.repeat(Number(m[1]) - 1)}h${m[1]} ${strip(m[2]!).slice(0, 120)}`).filter((x) => x.trim().length > 3).slice(0, 40);
  const blocks = [...html.matchAll(/<(header|nav|main|section|article|aside|footer)\b([^>]*)>/gi)].map((m) => `${m[1]!.toLowerCase()}${attr(m[2]!, 'id') ? `#${attr(m[2]!, 'id')}` : ''}${attr(m[2]!, 'class') ? `.${attr(m[2]!, 'class').split(/\s+/).slice(0, 2).join('.')}` : ''}`).slice(0, 30);
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({ src: abs(attr(m[0], 'src') || attr(m[0], 'data-src') || attr(m[0], 'srcset').split(/[\s,]+/)[0] || '', url), alt: decode(attr(m[0], 'alt')).slice(0, 80) })).filter((i) => i.src.startsWith('http')).slice(0, 30);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const external = scripts.map((m) => abs(attr(m[1]!, 'src'), url)).filter(Boolean);
  const allJs = scripts.map((m) => m[2]!).join('\n') + external.join(' ');
  const libs = ['react', 'next', 'vue', 'nuxt', 'angular', 'svelte', 'jquery', 'gsap', 'three', 'swiper', 'slick', 'bootstrap', 'tailwind', 'alpine', 'lottie', 'aos', 'wordpress', 'wp-content', 'shopify', 'wix', 'squarespace', 'webflow', 'google-analytics', 'gtag', 'googletagmanager', 'facebook', 'hotjar', 'intercom'].filter((k) => allJs.toLowerCase().includes(k) || html.toLowerCase().includes(`/${k}`));
  const behaviours = [
    [/carousel|slider|swiper|slick/i, 'image/content carousel'],
    [/menu-toggle|hamburger|navbar-toggler|aria-expanded/i, 'mobile menu toggle'],
    [/modal|dialog|lightbox/i, 'modal / lightbox'],
    [/accordion|<details/i, 'accordion / expandable sections'],
    [/tab-pane|role="tab"|role='tab'/i, 'tabs'],
    [/scroll|IntersectionObserver|aos-/i, 'scroll animations / reveal on scroll'],
    [/countdown/i, 'countdown timer'],
    [/<video|youtube\.com\/embed|vimeo/i, 'video'],
    [/<form/i, 'forms (rebuilt pages keep them visual only)'],
    [/cookie/i, 'cookie banner'],
  ]
    .filter(([re]) => (re as RegExp).test(html))
    .map(([, d]) => d as string);
  const allCss = [...css, ...[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!), ...[...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]!)].join('\n');
  const colours = top((allCss.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]+\)/gi) ?? []).map((c) => c.toLowerCase().replace(/\s+/g, '')), 12);
  const fonts = top((allCss.match(/font-family\s*:\s*([^;}{]+)/gi) ?? []).map((f) => f.replace(/font-family\s*:\s*/i, '').split(',')[0]!.replace(/["']/g, '').trim()).filter((f) => f && !/inherit|var\(/i.test(f)), 6);
  const googleFonts = [...html.matchAll(/https:\/\/fonts\.googleapis\.com\/[^"'\s>]+/gi)].map((m) => decode(m[0]));
  const forms = [...html.matchAll(/<input\b[^>]*>/gi)].map((m) => attr(m[0], 'type') || 'text');
  const text = strip(html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html);
  const cssCount = (html.match(/<link\b[^>]*rel\s*=\s*["']?stylesheet/gi) ?? []).length;
  const lines = [
    `URL: ${url}`,
    `TITLE: ${title}`,
    meta('description') ? `DESCRIPTION: ${decode(meta('description'))}` : '',
    meta('theme-color') ? `THEME COLOUR: ${meta('theme-color')}` : '',
    `LANGUAGE: ${attr(html.match(/<html\b[^>]*>/i)?.[0] ?? '', 'lang') || 'unknown'}`,
    `WEIGHT (original): ${Math.round(html.length / 1024)} KB of HTML, ${external.length} script files + ${scripts.length - external.length} inline scripts, ${cssCount} stylesheets, ${images.length} images${/<meta[^>]+name\s*=\s*["']?viewport/i.test(head) ? '' : ', NO mobile viewport tag'}`,
    libs.length ? `BUILT WITH / LOADS: ${libs.join(', ')}` : '',
    behaviours.length ? `INTERACTIVE PARTS: ${behaviours.join('; ')}` : '',
    blocks.length ? `PAGE STRUCTURE (in order): ${blocks.join(' > ')}` : '',
    nav.length ? `NAVIGATION:\n${nav.map((n) => `- ${n}`).join('\n')}` : '',
    headings.length ? `HEADINGS:\n${headings.join('\n')}` : '',
    colours.length ? `COLOURS (most used first): ${colours.join(' ')}` : '',
    fonts.length ? `FONTS: ${fonts.join(', ')}${googleFonts.length ? ` (Google Fonts: ${googleFonts[0]})` : ''}` : '',
    images.length ? `IMAGES (use these URLs):\n${images.map((i) => `- ${i.src}${i.alt ? ` — "${i.alt}"` : ''}`).join('\n')}` : '',
    forms.length ? `FORM FIELDS: ${top(forms, 8).join(', ')}` : '',
    links.length ? `OTHER LINKS: ${links.filter((l) => !nav.some((n) => n.includes(l.href))).slice(0, 12).map((l) => `${l.text} → ${l.href}`).join(' | ')}` : '',
    `TEXT CONTENT:\n${clip(text, 7000)}`,
  ];
  return lines.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------------------

const BADGE = (source: string) => {
  let host = source;
  try {
    host = new URL(source).hostname;
  } catch {
    /* not a URL */
  }
  const label = host ? `Rebuilt by Ghosty from ${host.replace(/[<>&"']/g, '')} · not the official site` : 'Built by Ghosty';
  return `<div id="ghosty-badge" style="position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));z-index:2147483647;font:500 11px/1.2 -apple-system,system-ui,sans-serif;background:rgba(2,7,13,.82);color:#cfefff;padding:6px 10px;border-radius:999px;border:1px solid rgba(92,225,255,.4);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:none;white-space:nowrap">${label}</div>`;
};

/**
 * Check and finish a rebuilt page before it goes live: no password fields or forms that send
 * data anywhere, a mobile viewport, lazy images, not indexed, and the badge naming the original.
 */
export function prepareSite(htmlIn: string, source: string): { html: string; notes: string[] } {
  let html = htmlIn.trim();
  const notes: string[] = [];
  if (html.length > MAX_HTML) throw new Error(`the page is too large (${Math.round(html.length / 1024)} KB; 400 KB max) — use image URLs instead of embedded images and keep it lean`);
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) throw new Error('send ONE complete HTML document (<!doctype html><html>…<body>…</body></html>)');
  if (/<input\b[^>]*type\s*=\s*["']?password/i.test(html)) throw new Error("rebuilt pages can't contain password fields (they could pass for a real login page). Leave sign-in out, or show it as a plain button");
  if (/<form\b[^>]*\saction\s*=/i.test(html)) {
    html = html.replace(/(<form\b[^>]*?)\saction\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1');
    notes.push('form actions removed (forms on rebuilt pages are visual only)');
  }
  if (!/<meta\b[^>]*name\s*=\s*["']?viewport/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">');
    notes.push('mobile viewport added');
  }
  let lazy = 0;
  html = html.replace(/<img\b(?![^>]*\bloading=)/gi, () => {
    lazy++;
    return '<img loading="lazy" decoding="async"';
  });
  if (lazy) notes.push(`${lazy} image${lazy === 1 ? '' : 's'} set to load lazily`);
  html = html.replace(/<head([^>]*)>/i, '<head$1><meta name="robots" content="noindex,nofollow">');
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${BADGE(source)}</body>`) : html + BADGE(source);
  return { html, notes };
}

/** The response for a published page: sandboxed (opaque origin), not indexed, short cache. */
export function siteResponse(site: Site | undefined): Response {
  if (!site) return new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>Not found</title><p style="font:16px system-ui;padding:24px">This page doesn\'t exist (any more).</p>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response(site.html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Its own opaque origin: scripts run, but can't touch Ghosty's storage, keys or API.
      'content-security-policy': 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'cache-control': 'public, max-age=60',
    },
  });
}

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

export const siteTools: Tool[] = [
  {
    name: 'study_site',
    description:
      "Study a website so you can rebuild it: fetches the page and its stylesheets and returns its structure (sections, navigation, headings), text, images, colours, fonts, the scripts/libraries it loads and what they do (menus, carousels, modals…), and how heavy it is. Step 1 of rebuilding a site; then write the improved page and call publish_site. For the owner's own sites, sites they may remake, or as a clearly labelled redesign concept — never to impersonate a real login or payment page.",
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'https://…' } }, required: ['url'] },
    risk: 'auto',
    async run(a) {
      let url = arg.str(a, 'url').trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5' }, redirect: 'follow' });
      if (!r.ok) throw new Error(`the site answered HTTP ${r.status}`);
      const html = await readCapped(r, 1_500_000);
      const final = r.url || url;
      const sheets = [...html.matchAll(/<link\b[^>]*rel\s*=\s*["']?stylesheet[^>]*>/gi)].map((m) => abs(attr(m[0], 'href'), final)).filter(Boolean).slice(0, 4);
      const css = await Promise.all(sheets.map((s) => fetch(s, { headers: { 'User-Agent': UA } }).then((x) => (x.ok ? readCapped(x, 250_000) : '')).catch(() => '')));
      // Sites that build their page with JavaScript send almost no text: read it rendered (free reader, no key).
      let rendered = '';
      if (strip(html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html).length < 400) {
        rendered = await fetch(`https://r.jina.ai/${final}`, { headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' } })
          .then((x) => (x.ok ? readCapped(x, 200_000) : ''))
          .catch(() => '');
      }
      return (
        asData(`the website ${final}`, blueprint(final, html, css) + (rendered ? `\n\nRENDERED CONTENT (the page builds itself with JavaScript; this is what visitors see):\n${clip(rendered, 9000)}` : '')) +
        '\n\nNEXT: write ONE complete, self-contained HTML document that recreates this site — same sections in the same order, same text, navigation, images (their URLs above), colours and fonts — and rebuild its interactive parts (menu, carousel, modals, tabs…) in small vanilla JS, without the trackers or heavy libraries. Make it clearly better: mobile-first for an iPhone (390×844: viewport-fit=cover, env(safe-area-inset-*), 16px+ text, 44px tap targets, no sideways scrolling, sticky compact header with a working menu), semantic HTML, fast (no frameworks, system or Google fonts with display=swap, lazy images, CSS animations that respect prefers-reduced-motion), accessible (alt text, contrast, focus states), and a more polished, modern look. No password fields or real form submission. Then call publish_site with it.'
      );
    },
  },
  {
    name: 'publish_site',
    description:
      "Publish a page you built (usually a rebuilt website after study_site) at a free public link on Ghosty's own address — live as soon as the owner taps APPROVE, no account or setup. Send ONE complete HTML document. The link works on any phone; give it to the owner exactly as returned. Publishing again with the same name updates it.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'short name for the link, e.g. "acme-bakery"' },
        title: { type: 'string' },
        html: { type: 'string', description: 'the complete HTML document' },
        source_url: { type: 'string', description: 'the original site it was rebuilt from (if any)' },
      },
      required: ['name', 'html'],
    },
    risk: 'confirm', // it goes on the public internet: the owner taps APPROVE (the kernel would insist anyway)
    /** Check the page first (so problems show before asking), and say exactly what goes live where. */
    async approval(a, ctx) {
      const name = siteSlug(arg.str(a, 'name'));
      if (!name) throw new Error('name must contain letters or numbers');
      const source = arg.str(a, 'source_url', false);
      const { html } = prepareSite(arg.str(a, 'html'), source);
      const title = (arg.str(a, 'title', false) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || name).trim().slice(0, 120);
      let from = '';
      try {
        from = source ? ` (rebuilt from ${new URL(source).hostname})` : '';
      } catch {
        /* not a URL */
      }
      return { args: a, reason: `Publish "${title}"${from} as a public page at ${ctx.origin ?? ''}/s/${name}? (${kb(html.length)}; anyone with the link can open it)` };
    },
    async run(a, ctx) {
      const name = siteSlug(arg.str(a, 'name'));
      if (!name) throw new Error('name must contain letters or numbers');
      const source = arg.str(a, 'source_url', false);
      const { html, notes } = prepareSite(arg.str(a, 'html'), source);
      const title = (arg.str(a, 'title', false) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || name).trim().slice(0, 120);
      await ctx.storage.put(PREFIX + name, { name, title, html, source, at: Date.now() } satisfies Site);
      const link = `${ctx.origin ?? ''}/s/${name}`;
      ctx.emit({ t: 'client', name: 'show_link', args: { url: link, title } });
      const requests = 1 + (html.match(/<script\b[^>]*\ssrc=/gi) ?? []).length + (html.match(/<link\b[^>]*stylesheet/gi) ?? []).length + (html.match(/<img\b/gi) ?? []).length;
      return `Published "${title}" — live now at ${link} (${kb(html.length)}, about ${requests} requests${notes.length ? `; ${notes.join('; ')}` : ''}). Give the owner this exact link.`;
    },
  },
];
