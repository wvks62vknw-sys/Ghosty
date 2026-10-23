/**
 * Quality gates for a generated site, the kind of checks an agency runs before launch, done on the HTML
 * itself (no browser needed, so they run in a Worker and on the phone):
 *  - accessibility: one h1 per page, no skipped heading levels, alt text, labelled form fields, named
 *    buttons and links, frame titles, the theme's colour contrast (WCAG AA), the language
 *  - search and sharing: title and description lengths, canonical, Open Graph, valid JSON-LD
 *  - budgets: page weight, number of pictures, font families, picture sizes declared (no layout jump)
 *  - links: every #/page and #anchor exists; mail, phone and https links are well formed
 *  - layout at 390 / 768 / 1280 px: words too long for a phone at the headline sizes, fixed widths wider
 *    than a phone, wide tables without a scroll box (an analysis of the markup and CSS, not a rendering)
 *  - words: placeholder text and the stock phrases that make a site read like a template
 *  - honesty and licences: reviews and team only from the owner's facts; every photo credited
 * The same report feeds the self-critique and the fixer; `score` is 100 minus the weight of what failed.
 */
import { contrastProblems } from './tokens';
import type { Brief, Plan } from './types';

export interface GateFinding {
  gate: 'a11y' | 'seo' | 'budget' | 'links' | 'layout' | 'words' | 'honesty';
  level: 'error' | 'warning';
  page?: string;
  text: string;
}
export interface GateReport {
  findings: GateFinding[];
  errors: number;
  warnings: number;
  score: number;
  stats: { kb: number; images: number; pages: number; fonts: number; words: number };
}

/** Phrases that mark copy as filler (checked case-insensitively). */
export const CLICHES = [
  'welcome to our website', 'look no further', 'nestled in the heart', 'we pride ourselves', 'second to none', 'one-stop shop', 'state-of-the-art', 'cutting-edge', 'elevate your', 'unleash', 'in today\'s fast-paced', 'tailored solutions', 'your satisfaction is our', 'passionate about', 'take it to the next level', 'world-class', 'unparalleled', 'seamless experience', 'delve', 'embark on a journey', 'look forward to welcoming you', 'we strive to', 'top-notch', 'game-changer', 'lorem ipsum',
];
/**
 * Claims a visitor takes as fact (trust, rank, accreditation, scale, policies): only ever in the owner's own
 * words. Each is a name and the words that make it; a claim counts as the owner's when the same pattern is
 * found in what they gave (the writers' facts, or the text being replaced).
 */
export const CLAIMS: [string, RegExp][] = [
  ['registered', /\bregist(?:ered|ration)\b/i],
  ['insured', /\binsur(?:ed|ance|er)\b/i],
  ['accredited', /\baccredit(?:ed|ation)\b/i],
  ['award', /\baward(?:s|ed|-winning)?\b/i],
  ['rated', /\b(?:top[- ])?rated\b/i],
  ['stars', /\bstars?\b/i],
  ['verified', /\bverified\b/i],
  ['certified', /\bcertified\b/i],
  ['approved', /\bapproved\b/i],
  ['guarantee', /\bguarantee(?:d|s)?\b/i],
  ['qualified', /\bqualified\b/i],
  ['licensed', /\blicensed\b/i],
  ['NHS', /\bNHS\b/i],
  ['Which?', /\bWhich\?/],
  ['review site', /\b(?:checkatrade|trustpilot|trustatrader|rated people|mybuilder)\b/i],
  ['trade scheme', /\b(?:gas safe|niceic|napit|fensa|cp12|trustmark|safecontractor)\b/i],
  ['best', /\b(?:the|voted|rated|our)\s+best\b|\bbest[- ](?:in|rated|reviewed)\b/i],
  ['leading', /\b(?:leading|number one|no\.? ?1)\b|#1\b/i],
  ['trusted', /\btrusted\b/i],
  ['experience', /\byears['’]? (?:of )?experience\b|\bexperienced\b/i],
  ['big number', /\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|dozens)\b/i],
  ['walk-ins', /\bwalk[- ]?ins?\b/i],
  ['refunds', /\brefund(?:s|ed|able)?\b/i],
  ['encrypted', /\bencrypt(?:ed|ion)\b/i],
];
/** The claims in a text (their names). */
export const claimsIn = (text: string): string[] => CLAIMS.filter(([, re]) => re.test(text)).map(([k]) => k);
/** The claims in `text` that `support` (the owner's facts, the text being replaced) does not make. */
export const unsupportedClaims = (text: string, support: string): string[] => {
  const ok = new Set(claimsIn(support));
  return claimsIn(text).filter((k) => !ok.has(k));
};

const PLACEHOLDER = /lorem ipsum|\bTODO\b|\{\{|\}\}|\[(?:your|business|insert|name|phone|email)[^\]]*\]|xxx+|placeholder/i;

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, k: string) => ENT[k]!).replace(/&[a-z#0-9]+;/gi, ' ');
const strip = (h: string) => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1];

/** Average glyph width (in em) of a display face at its weight: how many letters fit on a line. */
const GLYPH_EM: Record<string, number> = { condensed: 0.47, luxe: 0.5, classic: 0.56, editorial: 0.58, refined: 0.55, tech: 0.6, friendly: 0.6, geometric: 0.58, system: 0.58 };
/** The smallest (phone) size of each heading, in px (tokens.ts clamp minimums × 16). */
const MIN_PX: Record<string, number> = { h1: 39.8, h2: 33.1, h3: 23 };

/**
 * `facts` is what the owner actually gave (the brief before typical hours, prices and services were filled
 * in); claims on the page are checked against it. Without it, the brief stands in.
 */
export function runGates(html: string, plan: Plan, brief: Brief, facts: Brief = brief): GateReport {
  const f: GateFinding[] = [];
  const add = (gate: GateFinding['gate'], level: GateFinding['level'], text: string, page?: string) => f.push({ gate, level, text, ...(page !== undefined ? { page } : {}) });
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? '';
  const body = (html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html).replace(/<script[\s\S]*?<\/script>/gi, '');
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!).join('\n');

  // ── accessibility ──
  if (!/<html[^>]*\slang="[a-z]{2}/i.test(html)) add('a11y', 'error', 'the page has no language (lang on <html>)');
  for (const p of contrastProblems(plan.theme)) add('a11y', 'error', `colour contrast too low: ${p}`);
  const pages = [...body.matchAll(/<div class="page[^"]*" id="([^"]+)" data-page="([^"]*)"[^>]*>/g)];
  pages.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = pages[i + 1]?.index ?? body.indexOf('</main>');
    const part = body.slice(start, end > start ? end : undefined);
    const slug = m[2] || 'home';
    const h1 = (part.match(/<h1\b/gi) ?? []).length;
    if (h1 !== 1) add('a11y', 'error', h1 ? `${h1} main headings (h1) — a page needs exactly one` : 'no main heading (h1)', slug);
    let last = 1;
    for (const h of part.matchAll(/<h([1-6])\b/gi)) {
      const n = Number(h[1]);
      if (n > last + 1) {
        add('a11y', 'warning', `heading level jumps from h${last} to h${n}`, slug);
        break;
      }
      last = n;
    }
    if (strip(part).split(' ').length < 40) add('words', 'warning', 'very little text on this page', slug);
  });
  const ids = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const labels = new Set([...body.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]!));
  for (const m of body.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const id = attr(m[0], 'id');
    const type = attr(m[0], 'type') ?? '';
    if (/hidden|submit|button/.test(type)) continue;
    if (!attr(m[0], 'aria-label') && !(id && labels.has(id))) add('a11y', 'error', `a form field (${attr(m[0], 'name') ?? m[1]}) has no label`);
  }
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    if (attr(m[0], 'alt') === undefined) add('a11y', 'error', `a picture has no alt text (${(attr(m[0], 'src') ?? '').slice(0, 60)})`);
    if (!attr(m[0], 'width') && !/class="logo"/.test(m[0])) add('budget', 'warning', `a picture has no width/height, so the page jumps as it loads (${(attr(m[0], 'src') ?? '').slice(0, 60)})`);
  }
  for (const m of body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) if (!strip(m[2]!) && !/aria-label="[^"]+"/.test(m[1]!)) add('a11y', 'error', 'a button has no name (no text or aria-label)');
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) if (!strip(m[2]!) && !/aria-label="[^"]+"/.test(m[1]!) && !/role="img" aria-label/.test(m[2]!)) add('a11y', 'error', `a link has no text (${(attr(m[0], 'href') ?? '').slice(0, 50)})`);
  for (const m of body.matchAll(/<iframe\b[^>]*>/gi)) if (!attr(m[0], 'title')) add('a11y', 'error', 'a frame (map or video) has no title');
  if (!/class="skip"/.test(body)) add('a11y', 'warning', 'no "skip to content" link');

  // ── search and sharing ──
  const title = decode(head.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  if (title.length < 10 || title.length > 65) add('seo', 'warning', `the title is ${title.length} characters (aim for 10–65): "${title}"`);
  const desc = attr(head.match(/<meta name="description"[^>]*>/)?.[0] ?? '', 'content') ?? '';
  if (desc.length < 50 || desc.length > 160) add('seo', desc ? 'warning' : 'error', `the description is ${desc.length} characters (aim for 50–160)`);
  for (const p of ['og:title', 'og:description', 'og:image']) if (!new RegExp(`property="${p}"`).test(head)) add('seo', p === 'og:image' ? 'warning' : 'error', `no ${p} (the link preview in WhatsApp and social apps)`);
  if (plan.url && !/rel="canonical"/.test(head)) add('seo', 'warning', 'no canonical address');
  for (const m of head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]!);
    } catch {
      add('seo', 'error', 'the business data (JSON-LD) is not valid JSON');
    }
  }
  for (const p of plan.pages) if (!p.description || p.description.length < 30) add('seo', 'warning', 'the page has no proper description', p.slug || 'home');

  // ── budgets ──
  const kb = Math.round(html.length / 1024);
  if (kb > 350) add('budget', 'error', `the page is ${kb} KB (350 KB max)`);
  else if (kb > 200) add('budget', 'warning', `the page is ${kb} KB (aim under 200 KB)`);
  const images = (body.match(/<img\b/gi) ?? []).length;
  if (images > 40) add('budget', 'warning', `${images} pictures — consider fewer`);
  const families = [...new Set([...head.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]))];
  if (families.length > 2) add('budget', 'warning', `${families.length} font families (two is plenty)`);
  const eager = (body.match(/<img\b(?![^>]*loading="lazy")[^>]*>/gi) ?? []).length;
  if (eager > 4) add('budget', 'warning', `${eager} pictures load before they are needed (only the first screen's should)`);

  // ── links ──
  const routes = new Set(plan.pages.map((p) => p.slug));
  for (const m of body.matchAll(/\shref="([^"]*)"/g)) {
    const h = m[1]!.replace(/&amp;/g, '&');
    if (h.startsWith('#/')) {
      if (!routes.has(h.slice(2).replace(/\/$/, ''))) add('links', 'error', `a link goes to a page that does not exist: ${h}`);
    } else if (h.startsWith('#i-')) continue;
    else if (h.startsWith('#')) {
      if (h.length > 1 && !ids.has(h.slice(1))) add('links', 'error', `a link points at a missing part of the page: ${h}`);
    } else if (h.startsWith('tel:')) {
      if (h.replace(/\D/g, '').length < 10) add('links', 'error', `a phone link looks wrong: ${h}`);
    } else if (h.startsWith('mailto:')) {
      // one address, then only a subject and a body (never cc/bcc or a second address)
      if (!/^mailto:([\w.+%-]+@[\w-]+(?:\.[\w-]+)+)?(?:\?(?:subject|body)=[^&=]*(?:&(?:subject|body)=[^&=]*)?)?$/i.test(h)) add('links', 'error', `an email link looks wrong: ${h.slice(0, 60)}`);
    } else if (/^https:\/\/fonts\.g/.test(h) || /^data:image\//.test(h)) continue;
    else if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(h)) add('links', 'error', `a link is not a full https address: ${h.slice(0, 60)}`);
  }

  // ── layout (390 / 768 / 1280) ──
  const glyph = GLYPH_EM[plan.theme.fonts] ?? 0.58;
  for (const m of body.matchAll(/<(h1|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = m[1]!.toLowerCase();
    const text = strip(m[2]!);
    const longest = text.split(/\s+/).reduce((a, w) => (w.length > a.length ? w : a), '');
    const px = MIN_PX[tag]! * (tag === 'h1' && /hero-editorial/.test(body.slice(Math.max(0, (m.index ?? 0) - 1200), m.index)) ? 1.08 : 1);
    const width = 390 - 32;
    if (longest.length * glyph * px > width) add('layout', 'error', `"${longest}" is too long to fit across a phone (390 px) at ${tag} size — it would break mid-word or run off the side`);
    const lines = Math.ceil((text.length * glyph * px) / width);
    if (tag === 'h1' && lines > 5) add('layout', 'warning', `the headline "${text.slice(0, 50)}…" runs to about ${lines} lines on a phone — shorten it`);
  }
  for (const line of css.split('\n')) {
    // (a table's min-width is fine inside its sideways-scroll box, which the table check below looks for)
    if (line.startsWith('@media') || /table\s*\{/.test(line)) continue;
    for (const w of line.matchAll(/(?:^|[;{])\s*(?:width|min-width):\s*(\d{3,})px/g)) if (Number(w[1]) > 390) add('layout', 'error', `a fixed width of ${w[1]}px is wider than a phone (390 px): ${line.slice(0, 80)}`);
  }
  for (const m of body.matchAll(/<table\b[^>]*>/gi)) {
    const before = body.slice(Math.max(0, (m.index ?? 0) - 200), m.index);
    if (!/class="hours"/.test(m[0]) && !/class="scroll"/.test(before)) add('layout', 'warning', 'a wide table without a sideways-scroll box will overflow on a phone');
  }
  if (!/name="viewport"[^>]*width=device-width/.test(head)) add('layout', 'error', 'no mobile viewport');

  // ── words ──
  const text = strip(body);
  const words = text.split(' ').length;
  const lower = text.toLowerCase();
  for (const c of CLICHES) if (lower.includes(c)) add('words', 'warning', `stock phrase "${c}" — say something specific instead`);
  const ph = text.match(PLACEHOLDER);
  if (ph) add('words', 'error', `placeholder text left in: "${ph[0]}"`);
  if (brief.name && !text.includes(brief.name)) add('words', 'warning', 'the business name does not appear in the page text');

  // ── honesty and licences ──
  const usedBlocks = new Set(plan.pages.flatMap((p) => p.sections.map((s) => s.block)));
  if ((usedBlocks.has('testimonials-grid') || usedBlocks.has('testimonial-feature')) && !brief.reviews?.length) add('honesty', 'error', 'reviews are shown but the owner gave none — never invent reviews');
  if (usedBlocks.has('team') && !brief.team?.length) add('honesty', 'error', 'a team is shown but the owner named nobody');
  if (usedBlocks.has('logos') && !brief.accreditations?.length) add('honesty', 'error', 'accreditations are shown that the owner did not name');
  const quoted = brief.reviews?.map((r) => r.quote.slice(0, 40)) ?? [];
  for (const m of body.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)) {
    const q = strip(m[1]!).replace(/^[“"]/, '');
    if (!quoted.some((x) => q.startsWith(x.replace(/^[“"]/, '').slice(0, 30)))) add('honesty', 'error', `a quoted review is not one the owner gave: "${q.slice(0, 50)}"`);
  }
  // Trust claims (insured, registered, award-winning, rated, thousands of customers…) only from the owner.
  const said = JSON.stringify(facts);
  for (const k of unsupportedClaims(strip(body.replace(/<details class="credits"[\s\S]*?<\/details>/gi, ' ')), said)) add('honesty', 'error', `a claim the owner did not make (${k}) — say it only if they did`);
  for (const m of body.matchAll(/<img\b[^>]*\ssrc="(https:[^"]+)"/gi)) {
    const src = m[1]!.replace(/&amp;/g, '&');
    if (/wikimedia|staticflickr|openverse|unsplash|pexels/.test(src) && !/id="credits"/.test(body)) {
      add('honesty', 'error', 'photos from free libraries are used but there is no credits list');
      break;
    }
  }

  const errors = f.filter((x) => x.level === 'error').length;
  const warnings = f.length - errors;
  return { findings: f, errors, warnings, score: Math.max(0, 100 - errors * 12 - warnings * 3), stats: { kb, images, pages: pages.length, fonts: families.length, words } };
}

/** The report in plain lines, worst first. */
export function formatGates(r: GateReport): string {
  const line = (x: GateFinding) => `${x.level === 'error' ? 'FIX' : 'worth fixing'} · ${x.gate}${x.page ? ` · ${x.page}` : ''}: ${x.text}`;
  const sorted = [...r.findings].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  return `Quality score ${r.score}/100 · ${r.errors} to fix, ${r.warnings} worth fixing · ${r.stats.kb} KB, ${r.stats.pages} pages, ${r.stats.images} pictures\n${sorted.map(line).join('\n')}`.trim();
}
