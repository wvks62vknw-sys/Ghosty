/**
 * Rebuilt websites: Ghosty studies a page (study_site: structure, text, images, colours, fonts,
 * scripts and how heavy it is), writes a faster, cleaner, phone-first version itself, and
 * publishes it (publish_site) at a free, public, clickable link on Ghosty's own address:
 * https://<ghosty>/s/<name>. No account or setup.
 *
 * Safety (enforced by the browser, not by inspecting the HTML): the link opens a page Ghosty
 * writes, with a bar the rebuilt page can't touch naming the original ("not the official site");
 * the rebuilt page runs below it in a locked frame with its own opaque origin (no access to
 * Ghosty's data or keys), can't submit forms, can't make network requests (nothing typed can be
 * sent anywhere), can't load scripts from elsewhere, and can't be opened outside that frame.
 * It is not indexed by search engines, and password fields are refused before publishing, so it
 * can't pass for a real login or payment page.
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

/**
 * The backend a page implies, worked out from its repeated components and forms (study
 * "ui to backend"): each is a table with typed fields, so the rebuild keeps its content as data
 * shaped like those tables, and the owner can be handed the real schema and routes.
 */
export function dataModels(html: string): string[] {
  const low = html.toLowerCase();
  const n = (re: RegExp) => (html.match(re) ?? []).length;
  const prices = n(/(?:£|\$|€|&pound;|&euro;)\s?\d[\d,]*(?:\.\d{2})?/g);
  const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map((m) => (attr(m[0], 'type') || 'text').toLowerCase());
  const out: string[] = [];
  const shop = /add[ -]to[ -](?:cart|basket|bag)|shopping[ -]?(?:cart|basket)|checkout/.test(low);
  if (/\/mo\b|per month|a month|pricing|per year/.test(low) && prices >= 2 && !shop) out.push('plans(name TEXT, price_monthly NUMERIC(10,2), price_yearly NUMERIC(10,2), features TEXT[], highlighted BOOLEAN) — pricing table');
  else if (/\bmenu\b/.test(low) && /starters?|mains?|desserts?|vegan|gluten/.test(low) && prices >= 3) out.push('menu_items(section TEXT, name TEXT, description TEXT, price NUMERIC(10,2), dietary TEXT[], available BOOLEAN) — food menu');
  else if (prices >= 3 || shop) out.push(`products(title TEXT, slug TEXT UNIQUE, price NUMERIC(10,2), compare_at_price NUMERIC(10,2) NULL, currency CHAR(3), images TEXT[], rating NUMERIC(2,1), review_count INTEGER, in_stock BOOLEAN, category_id → categories) — ${prices} price tags`);
  if (shop) out.push('carts + cart_items(cart_id, product_id, quantity INTEGER); orders + order_items(unit_price copied at purchase) — basket/checkout');
  if (n(/<article\b/gi) >= 2 || n(/<time\b/gi) >= 2 || /\b(?:blog|news|latest posts|read more)\b/.test(low)) out.push('posts(title TEXT, slug TEXT UNIQUE, excerpt TEXT, body TEXT, cover_url TEXT, published_at TIMESTAMPTZ, author_id → authors) + tags/post_tags — articles');
  if (/testimonial|reviews?\b|★|rating/.test(low)) out.push('reviews(author_name TEXT, rating SMALLINT CHECK 1–5, body TEXT, product_id NULL, approved BOOLEAN, created_at) — reviews/testimonials');
  if (/\b(?:our team|meet the team|our people|staff)\b/.test(low)) out.push('people(name TEXT, role TEXT, photo_url TEXT, bio TEXT, position INTEGER) — team');
  if (/\b(?:events?|tickets?|book now|what's on)\b/.test(low) && n(/<time\b|\b\d{1,2}(?:st|nd|rd|th)? (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi) >= 2) out.push('events(title TEXT, starts_at TIMESTAMPTZ, venue TEXT, price NUMERIC(10,2), capacity INTEGER, tickets_left INTEGER) + bookings — events');
  if (/\bfaq|frequently asked/.test(low) || n(/<details\b/gi) >= 3) out.push('faqs(question TEXT, answer TEXT, position INTEGER) — FAQ');
  if (inputs.includes('password')) out.push('users(email TEXT UNIQUE, password_hash TEXT) + sessions — sign-in (study "auth"; never rebuilt as a working form)');
  if (inputs.includes('email') && /<textarea\b/i.test(html)) out.push('contact_messages(name TEXT, email TEXT, message TEXT, created_at, handled BOOLEAN) + POST /api/contact — contact form');
  else if (inputs.includes('email') && /subscribe|newsletter|sign up/.test(low)) out.push('subscribers(email TEXT UNIQUE, confirmed_at NULL) + POST /api/subscribe — newsletter');
  if (inputs.includes('search')) out.push('GET /api/search?q= over the main table (full-text index) — search box');
  return out;
}

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
  const models = dataModels(html);
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
    models.length ? `DATA MODELS IT IMPLIES (backend tables behind the repeated parts):\n${models.map((m) => `- ${m}`).join('\n')}` : '',
    links.length ? `OTHER LINKS: ${links.filter((l) => !nav.some((n) => n.includes(l.href))).slice(0, 12).map((l) => `${l.text} → ${l.href}`).join(' | ')}` : '',
    `TEXT CONTENT:\n${clip(text, 7000)}`,
  ];
  return lines.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------------------

/** The original site's host, for the bar ("" when unknown). */
const hostOf = (source: string) => {
  try {
    return new URL(source).hostname;
  } catch {
    return '';
  }
};
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Character references decoded, so checks see what a browser would (&#119; is "w"). */
const decodeRefs = (s: string) =>
  s.replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, n: string) => {
    const code = n[0] === 'x' || n[0] === 'X' ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
  });

/**
 * Check and finish a rebuilt page before it goes live: no password fields, no form targets,
 * a mobile viewport, lazy images, not indexed. (These are tidy-ups: what the page can actually
 * do is enforced by the browser — see siteFrameResponse.)
 */
export function prepareSite(htmlIn: string, _source: string): { html: string; notes: string[] } {
  let html = htmlIn.trim();
  const notes: string[] = [];
  if (html.length > MAX_HTML) throw new Error(`the page is too large (${Math.round(html.length / 1024)} KB; 400 KB max) — use image URLs instead of embedded images and keep it lean`);
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) throw new Error('send ONE complete HTML document (<!doctype html><html>…<body>…</body></html>)');
  if (/type\s*=\s*["']?\s*password|["'`]password["'`]/i.test(decodeRefs(html))) throw new Error("rebuilt pages can't contain password fields (they could pass for a real login page). Leave sign-in out, or show it as a plain button");
  // (attributes inside form, button and input tags only: never text or script code like `action = …`)
  const targets = /(<(?:form|button|input)\b[^>]*?)\s(?:form)?action\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
  if (targets.test(html)) {
    html = html.replace(targets, '$1');
    notes.push('form targets removed (forms on rebuilt pages are visual only)');
  }
  // Links to other sites leave Ghosty's frame when tapped (inside it, other sites can't load).
  html = html.replace(/<a\b(?![^>]*\starget\s*=)([^>]*\shref\s*=\s*["']?https?:)/gi, '<a target="_top"$1');
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
  return { html, notes };
}

const notFound = () => new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>Not found</title><p style="font:16px system-ui;padding:24px">This page doesn\'t exist (any more).</p>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
const common = { 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer', 'cache-control': 'public, max-age=60', 'x-content-type-options': 'nosniff' };

/** What the rebuilt page may do: run its own scripts, open links in new tabs, leave the frame when tapped. Not: forms, Ghosty's origin. */
const FRAME_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation';

/**
 * What a visitor opens (/s/<name>): a page Ghosty writes, with a bar the rebuilt page can't
 * touch saying where it came from, and the rebuilt page in a locked frame below it.
 */
export function siteResponse(site: Site | undefined): Response {
  if (!site) return notFound();
  const host = hostOf(site.source);
  const label = host ? `Rebuilt by Ghosty from ${esc(host)} · not the official site` : 'Built by Ghosty';
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#02070d"><title>${esc(site.title)}</title>
<style>html,body{margin:0;height:100%;background:#02070d;overflow:hidden}#bar{position:fixed;top:0;left:0;right:0;z-index:2;box-sizing:border-box;height:calc(28px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 12px 0;display:flex;align-items:center;justify-content:center;gap:6px;font:600 11px/1 -apple-system,system-ui,sans-serif;letter-spacing:.02em;color:#cfefff;background:#02070d;border-bottom:1px solid rgba(92,225,255,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#bar i{width:6px;height:6px;border-radius:50%;background:#5ce1ff;flex:none}iframe{position:fixed;left:0;right:0;bottom:0;top:calc(28px + env(safe-area-inset-top));width:100%;height:calc(100% - 28px - env(safe-area-inset-top));border:0;background:#fff}</style></head>
<body><div id="bar" role="note"><i></i>${label}</div><iframe src="/s/${esc(site.name)}/page" title="${esc(site.title)}" sandbox="${FRAME_SANDBOX}"></iframe></body></html>`;
  return new Response(page, {
    headers: {
      ...common,
      'content-type': 'text/html; charset=utf-8',
      // No scripts of its own; it may only frame the page below.
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

/**
 * The rebuilt page itself (/s/<name>/page), only inside the frame above. The browser enforces:
 * its own opaque origin (no access to Ghosty's storage, keys or API), no form submission, no
 * network requests from scripts (nothing typed can be sent anywhere), only its own inline
 * scripts (nothing loaded from elsewhere), and it can't be shown outside Ghosty's frame.
 */
export const PAGE_CSP =
  `sandbox ${FRAME_SANDBOX}; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src https: data: blob:; media-src https: data: blob:; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`;
export function siteFrameResponse(site: Site | undefined, dest: string | null): Response {
  if (!site) return notFound();
  // Anything but a load into Ghosty's frame (including browsers that don't say): go to the page with the bar.
  if (dest !== 'iframe') return new Response(null, { status: 302, headers: { location: `/s/${site.name}`, 'cache-control': 'no-store', vary: 'Sec-Fetch-Dest' } });
  // Never reused for a direct visit: the answer depends on how it is loaded.
  return new Response(site.html, { headers: { ...common, 'cache-control': 'no-store', vary: 'Sec-Fetch-Dest', 'content-type': 'text/html; charset=utf-8', 'content-security-policy': PAGE_CSP } });
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
        '\n\nNEXT: write ONE complete, self-contained HTML document that recreates this site — same sections in the same order, same text, navigation, images (their URLs above), colours and fonts — and rebuild its interactive parts (menu, carousel, modals, tabs…) in small vanilla JS, without the trackers or heavy libraries. Make it clearly better: mobile-first for an iPhone (390×844: viewport-fit=cover, env(safe-area-inset-*), 100dvh not 100vh, fluid type with clamp(), 16px+ text, 44px tap targets, no sideways scrolling, sticky compact header with a working menu, container queries for cards, scroll-snap carousels), semantic HTML, smooth and fast (animate only transform/opacity, content-visibility:auto on long sections, passive listeners, width/height on images, lazy images, no frameworks, system or Google fonts with display=swap, prefers-reduced-motion respected), accessible (alt text, contrast, focus states), and a more polished, modern look. Keep it cleanly layered inside the one file: the content of repeated parts (cards, posts, reviews, menu items…) as a JS data array shaped like the DATA MODELS above, small render functions that build the elements from it, and event handlers separate from both (study "ui to backend", "mobile 390"). It runs locked down: only your own inline <script> and <style> (no script files from elsewhere, no fetch/XHR — put everything it needs in the page), images from any https URL, Google Fonts and YouTube/Vimeo embeds allowed; forms are visual only and password fields are refused. Then call publish_site with it. When you give the owner the link, also offer the backend for it (the tables above as SQL plus the API routes) in case they want it working for real.'
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
