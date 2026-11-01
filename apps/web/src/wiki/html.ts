/**
 * An article from a ZIM file made safe to show, and the words in it (WIKIPEDIA, OFFLINE: wiki/view.ts, wiki/ask.ts).
 * Pure string work with no DOM, so the tests run it in Node on the fixture's articles.
 *
 * The article is shown in a sandboxed frame that runs no script at all (`sandbox="allow-same-origin"`, its document given
 * as srcdoc, so it sits inside the page's own security policy unchanged). Its links are rewritten, not listened to (a
 * frame that runs no script cannot be relied on to report a tap): a link to another article becomes
 * `about:blank#zim=<path>`, one to the web `about:blank#ext=<address>`, and a tap simply moves the frame there; the page
 * sees the frame's new address on the frame's own `load` and opens that article in its place. A link within the page
 * (a footnote) does nothing. Scripts, frames, forms, embedded media, `on…` attributes, style sheets from elsewhere and
 * every address that would load something from the network are taken out on the way, so nothing in a ZIM file can run
 * or reach anywhere; its pictures are named by their entry in the ZIM (`data-zim-src`) and filled in by the page from the
 * file itself.
 */

export interface Rewritten {
  /** The whole document, for the frame's srcdoc. */
  doc: string;
  /** The pictures it names, by the number put on each <img> (data-i), with their entries in the ZIM. */
  images: { i: number; path: string }[];
  /** The articles it links to, by entry path, in order. */
  links: string[];
  title: string;
}

/** Colours of the frame's page, from the screen around it (a frame does not inherit them). */
export interface FrameLook {
  fg: string;
  bg: string;
  link: string;
  muted: string;
}

const DARK: FrameLook = { fg: '#e9edf2', bg: '#0b0f14', link: '#7cc4ff', muted: '#9aa4b1' };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ORIGIN = 'https://zim.invalid';

/**
 * The entry a link or a picture in the article at `from` points to ("C/Ray_Charles" + "A_Fool_for_You" →
 * "C/A_Fool_for_You"; "./_assets_/x/Home%252C.JPG" → "C/_assets_/x/Home%2C.JPG"), or null when it points off the file
 * (another site, a page anchor, a mail address).
 */
export function resolvePath(from: string, href: string): string | null {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('//') || SCHEME.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw, `${ORIGIN}/${from.split('/').map(encodeURIComponent).join('/')}`);
  } catch {
    return null;
  }
  if (u.origin !== ORIGIN) return null;
  const p = u.pathname.slice(1);
  if (!p) return null;
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“',
  rdquo: '”', minus: '−', times: '×', deg: '°', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', shy: '', zwj: '', zwnj: '', thinsp: ' ',
  ensp: ' ', emsp: ' ', prime: '′', Prime: '″', frac12: '½', frac14: '¼', frac34: '¾', plusmn: '±', micro: 'µ', para: '¶', sect: '§',
};

/** HTML character references to the characters they stand for. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[e] ?? m;
  });
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The part inside <body>, or everything when there is none. */
export function bodyOf(html: string): string {
  const open = /<body\b[^>]*>/i.exec(html);
  if (!open) return html;
  const from = open.index + open[0].length;
  const close = html.toLowerCase().lastIndexOf('</body');
  return html.slice(from, close > from ? close : undefined);
}

/** The article's own title: its <title>, else its first heading. */
export function titleOf(html: string): string {
  const t = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html) ?? /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(html);
  return t ? clean(decodeEntities(t[1]!.replace(/<[^>]*>/g, ''))) : '';
}

/** Elements taken out whole, with everything in them. */
const DROP_BLOCKS = /<(script|noscript|template|iframe|object|embed|frameset|applet|audio|video|form|button|select|textarea|style)\b[\s\S]*?<\/\1\s*>/gi;
/** …and on their own (no closing tag, or one left over). */
const DROP_TAGS = /<\/?(?:script|noscript|template|iframe|object|embed|frame|frameset|applet|audio|video|source|track|form|input|button|select|textarea|base|meta|link|param|portal)\b[^>]*>/gi;
/** An address in a style that would load something from elsewhere. */
const STYLE_URL = /url\(\s*(['"]?)[^)]*\1\s*\)|@import[^;]*;?|expression\s*\(/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** One start tag, its attributes kept only where safe; `a` and `img` are rewritten as the file comment above says. */
function rewriteTag(tag: string, name: string, attrs: string, ctx: { from: string; images: Rewritten['images']; links: string[] }): string {
  const out: string[] = [];
  const kept: [string, string][] = [];
  for (const m of attrs.matchAll(ATTR)) {
    const k = m[1]!.toLowerCase();
    const v = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
    if (k.startsWith('on') || k.startsWith('data-mw') || k.startsWith('data-parsoid') || k === 'srcset' || k === 'srcdoc' || k === 'formaction' || k === 'action' || k === 'ping' || k === 'target' || k === 'download' || k === 'poster' || k === 'background' || k === 'data' || k === 'http-equiv' || k === 'xmlns:xlink') continue;
    if (k === 'href' || k === 'xlink:href' || k === 'src') {
      if (name === 'a' && k === 'href') {
        const path = resolvePath(ctx.from, v);
        if (path) {
          ctx.links.push(path);
          kept.push(['href', `about:blank#zim=${encodeURIComponent(path)}`], ['data-zim', path]);
        } else if (/^https?:\/\//i.test(v.trim())) {
          kept.push(['href', `about:blank#ext=${encodeURIComponent(v.trim())}`], ['class', 'ext'], ['rel', 'noreferrer']);
        }
      } else if (name === 'img' && k === 'src') {
        const path = resolvePath(ctx.from, v);
        if (path) {
          const i = ctx.images.length;
          ctx.images.push({ i, path });
          kept.push(['data-zim-src', path], ['data-i', String(i)]);
        }
      }
      continue;
    }
    if (k === 'style') {
      const s = v.replace(STYLE_URL, 'none');
      if (s.trim()) kept.push(['style', s]);
      continue;
    }
    kept.push([k, v]);
  }
  // one class attribute (a rewritten link adds its own)
  const classes = kept.filter(([k]) => k === 'class').map(([, v]) => v).join(' ').trim();
  for (const [k, v] of kept) if (k !== 'class') out.push(m2(k, v));
  if (classes) out.push(m2('class', classes));
  return `<${name}${out.length ? ' ' + out.join(' ') : ''}${/\/\s*>$/.test(tag) ? ' /' : ''}>`;
}
const m2 = (k: string, v: string) => `${k}="${escAttr(v)}"`;

/**
 * The article at `path`, ready for the frame: its body made safe (see the file comment), in a page of our own look.
 */
export function rewriteArticle(html: string, path: string, look: FrameLook = DARK): Rewritten {
  const title = titleOf(html);
  const ctx = { from: path, images: [] as Rewritten['images'], links: [] as string[] };
  // Wikipedia's own template styles are kept (they lay out its tables), with any address in them taken out
  const styles: string[] = [];
  let body = bodyOf(html).replace(/<!--[\s\S]*?-->/g, '');
  body = body.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_m, css: string) => {
    styles.push(css.replace(STYLE_URL, 'none').replace(/<\/?style/gi, ''));
    return '';
  });
  body = body.replace(DROP_BLOCKS, '').replace(DROP_TAGS, '');
  // (a quoted value may hold a ">": Parsoid's JSON in data-mw does)
  body = body.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (tag, name: string, attrs: string) => rewriteTag(tag, name.toLowerCase(), attrs, ctx));
  const css = frameCss(look);
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escText(title)}</title><style>${styles.join('\n')}</style><style>${css}</style></head><body><article class="wiki">${body}</article></body></html>`;
  return { doc, images: ctx.images, links: ctx.links, title };
}

/** The frame's look: the screen's colours, readable on a phone, Wikipedia's editing and navigation bits hidden. */
export function frameCss(l: FrameLook): string {
  return [
    `:root{color-scheme:light dark}`,
    `html{-webkit-text-size-adjust:100%;background:${l.bg}}`,
    `body{margin:0;padding:12px 16px 28px;background:${l.bg};color:${l.fg};font:17px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;overflow-wrap:anywhere}`,
    `a{color:${l.link};text-decoration:none}a.ext::after{content:" \\2197";font-size:.8em}`,
    `h1{font-size:1.45em;line-height:1.2;margin:.2em 0 .5em}h2{font-size:1.2em;margin:1.4em 0 .4em}h3{font-size:1.05em}`,
    `img{max-width:100%;height:auto}figure{margin:12px 0}figcaption,.thumbcaption{font-size:.85em;color:${l.muted}}`,
    `table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;font-size:.88em;color:${l.fg};background:transparent}`,
    `td,th{padding:4px 6px;vertical-align:top;border-color:${l.muted}55}`,
    `.infobox,.sidebar,.thumb,.tright,.floatright,.floatleft{float:none!important;width:auto!important;max-width:100%!important;margin:0 0 12px!important;background:transparent!important;color:${l.fg}!important}`,
    `.mw-editsection,.noprint,.mw-empty-elt,#mw-content-subtitle,.mw-jump-link,.mw-ref,sup.reference,.navbox,.metadata,.ambox{display:none!important}`,
    `pre,code{white-space:pre-wrap;font-size:.9em}blockquote{margin:0 0 0 12px;padding-left:10px;border-left:2px solid ${l.muted}}`,
    `footer,.mw-footer,#footer{font-size:.8em;color:${l.muted};margin-top:24px}`,
  ].join('');
}

/** Everything between <table …> and its own </table>, nested tables and all (an infobox, a navigation box). */
export function dropTables(html: string): string {
  const re = /<table\b|<\/table\s*>/gi;
  let depth = 0;
  let start = 0;
  let out = '';
  let last = 0;
  for (const m of html.matchAll(re)) {
    if (m[0][1] !== '/') {
      if (depth === 0) start = m.index!;
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0) {
        out += html.slice(last, start);
        last = m.index! + m[0].length;
      }
    }
  }
  return depth > 0 ? out + html.slice(last, start) : out + html.slice(last);
}

/** The lead: section 0 when the file marks its sections, else everything before the first second-level heading. */
function leadOf(body: string): string {
  const s0 = /<section\b[^>]*data-mw-section-id="0"[^>]*>/i.exec(body);
  if (s0) {
    const from = s0.index + s0[0].length;
    const next = body.slice(from).search(/<section\b/i);
    return next >= 0 ? body.slice(from, from + next) : body.slice(from);
  }
  const h2 = body.search(/<h2\b/i);
  return h2 > 0 ? body.slice(0, h2) : body;
}

/** Plain words from a piece of an article: no styles, no footnote marks, entities read, spaces made single. */
function textOf(html: string): string {
  return clean(
    decodeEntities(
      html
        .replace(/<(style|script|sup)\b[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, ''),
    ).replace(/\[(?:\d+|[a-z]|note \d+|citation needed|clarification needed)\]/gi, ''),
  );
}
const clean = (s: string) => s.replace(/[\s ]+/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/\(\s+/g, '(').trim();

/** Ends a long text at a sentence (or a word), with an ellipsis. */
function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const part = s.slice(0, max);
  const stop = Math.max(part.lastIndexOf('. '), part.lastIndexOf('? '), part.lastIndexOf('! '));
  return stop > max * 0.5 ? part.slice(0, stop + 1) : `${part.replace(/\s+\S*$/, '')}…`;
}

/** The article's first real paragraph (not an infobox's, not an empty one), as plain words: what the chat's card says. */
export function firstParagraph(html: string, max = 900): string {
  const body = bodyOf(html);
  for (const part of [leadOf(body), body]) {
    const lead = dropTables(part.replace(/<!--[\s\S]*?-->/g, ''));
    for (const m of lead.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)) {
      const t = textOf(m[1]!);
      if (t.length >= 25 && !/^coordinates\b/i.test(t)) return cut(t, max);
    }
  }
  return '';
}

/** Headings where the article itself ends and its lists of sources begin: READ IT TO ME stops there. */
const ENDS = /^(references|notes|sources|citations|footnotes|bibliography|further reading|other websites|external links|related pages|see also)$/i;

/** The article as he would hear it (READ IT TO ME): its title, then its paragraphs and headings in order, up to its sources. */
export function articleText(html: string, max = 8000): string {
  let body = dropTables(bodyOf(html).replace(/<!--[\s\S]*?-->/g, ''));
  body = body.replace(/<(style|script|figure|figcaption|sup)\b[\s\S]*?<\/\1\s*>/gi, '');
  const parts: string[] = [];
  const title = titleOf(html);
  if (title) parts.push(`${title}.`);
  for (const m of body.matchAll(/<(h[1-6]|p|li|dd)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    const tag = m[1]!.toLowerCase();
    const t = textOf(m[2]!);
    if (!t) continue;
    if (tag[0] === 'h') {
      if (tag === 'h1') continue;
      if (ENDS.test(t)) break;
      parts.push(`${t.replace(/[.:]$/, '')}.`);
    } else parts.push(t);
  }
  return cut(parts.join('\n'), max);
}
