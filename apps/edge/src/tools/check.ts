/**
 * The quality gate for the pages, apps and widgets Ghosty writes: one fast read of an HTML
 * document that finds what would break before the owner sees it — numbered, with line numbers,
 * so the model can fix each point and check again. Not a browser; it catches the mistakes free
 * models actually make:
 *  - no doctype, no viewport, no title (quirks mode; a desktop-sized page on the phone; "Untitled")
 *  - a tag that never closes, or closes the wrong thing (half the page swallowed by a <div>)
 *  - a bracket, quote or template string left open in an inline script (nothing runs at all)
 *  - what the published page's sandbox blocks (tools/sites.ts PAGE_CSP): scripts and stylesheets
 *    from elsewhere, any network call, frames, insecure or relative addresses, form targets
 *  - password fields (publishing refuses them), images without alt, console.log left in, 350 KB+
 * publish_site refuses a page with errors; create_widget refuses one whose tags or scripts are
 * broken (a widget may use the network, so those are warnings for it); check_html is the same
 * report on demand.
 */
import { bracketProblem, codeOnly } from '../selfcheck';
import { storageError } from '../kv';
import { siteStore } from './sites';
import { arg, type Tool } from './types';

export type CheckKind = 'page' | 'widget';
/** basics: doctype/viewport/title · structure: tags · script: inline code · blocked: the sandbox · quality: worth fixing */
export type FindingKind = 'basics' | 'structure' | 'script' | 'blocked' | 'quality';
export interface Finding {
  line: number;
  level: 'error' | 'warning';
  kind: FindingKind;
  text: string;
}
export interface CheckStats {
  bytes: number;
  lines: number;
  tags: number;
  scripts: number;
  styles: number;
  images: number;
  links: number;
}
export interface CheckReport {
  /** "line N: …" lines, worst first in document order. */
  errors: string[];
  warnings: string[];
  findings: Finding[];
  stats: CheckStats;
}

const MAX_ERRORS = 30;
const MAX_WARNINGS = 30;
const BIG = 350_000;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
/** The elements whose balance is checked: left open, they swallow the rest of the page. */
const STRUCTURAL = new Set([
  'html', 'head', 'body', 'div', 'section', 'main', 'header', 'footer', 'nav', 'article', 'aside', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'form', 'button', 'a', 'span', 'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'select', 'option', 'textarea', 'canvas', 'svg', 'script', 'style', 'template', 'dialog', 'details', 'summary', 'figure', 'figcaption', 'blockquote', 'pre', 'fieldset', 'dl', 'dt', 'dd',
]);
/** End tags the parser supplies itself: never reported unclosed, and closed by the start tags below. */
const OPTIONAL_END = new Set(['html', 'head', 'body', 'p', 'li', 'option', 'td', 'th', 'tr', 'thead', 'tbody', 'tfoot', 'dt', 'dd']);
/** What a start tag closes when it finds it open on top (the parser's implied end tags). */
const CLOSES: Record<string, string[]> = {
  li: ['li', 'p'],
  option: ['option'],
  tr: ['tr', 'td', 'th', 'p'],
  td: ['td', 'th', 'p'],
  th: ['td', 'th', 'p'],
  thead: ['tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'p'],
  tbody: ['tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'p'],
  tfoot: ['tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'p'],
  dt: ['dt', 'dd', 'p'],
  dd: ['dt', 'dd', 'p'],
};
for (const b of ['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']) {
  CLOSES[b] = [...(CLOSES[b] ?? []), 'p'];
}
/** Script types that are data, not code to run. */
const DATA_SCRIPT = /^(application\/(ld\+)?json|importmap|speculationrules|text\/(template|x-[\w-]+|plain|html))$/i;
/** Frames a published page may show (tools/sites.ts PAGE_CSP frame-src). */
const FRAME_HOSTS = ['www.youtube-nocookie.com', 'www.youtube.com', 'player.vimeo.com', 'www.openstreetmap.org'];
const FONT_CSS = 'https://fonts.googleapis.com/';
const FONT_FILES = 'https://fonts.gstatic.com/';

const attr = (attrs: string, name: string): string | null => {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>'"]+))`, 'i'));
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
};
const hasAttr = (attrs: string, name: string) => new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, 'i').test(attrs);
/** Character references decoded, so checks see what a browser would (&#119; is "w") — same as tools/sites.ts. */
const decodeRefs = (s: string) =>
  s.replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, n: string) => {
    const code = n[0] === 'x' || n[0] === 'X' ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
  });

/** Where an address points: the published page may use https:, data: and blob: and has no files of its own. */
type Where = 'https' | 'http' | 'data' | 'anchor' | 'relative' | 'rooted' | 'other';
function where(raw: string): Where {
  const u = raw.trim().replace(/^&quot;|&quot;$/g, '');
  if (!u) return 'other';
  if (u.startsWith('#')) return 'anchor';
  if (/^\/\//.test(u)) return 'https';
  if (/^https:/i.test(u)) return 'https';
  if (/^http:/i.test(u)) return 'http';
  if (/^(data|blob):/i.test(u)) return 'data';
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return 'other'; // mailto:, tel:, javascript:
  if (u.startsWith('/')) return 'rooted';
  return 'relative';
}
const hostOf = (u: string): string => {
  try {
    return new URL(u.trim().replace(/^\/\//, 'https://')).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/** Inline JavaScript with its comments, template text and string literals blanked (offsets kept), so words inside them don't count. */
const bare = (code: string) => codeOnly(code).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => `"${' '.repeat(Math.max(0, m.length - 2))}"`);

/**
 * Check one HTML document. `kind` 'page' (the default) judges it as a page to publish — nothing
 * from elsewhere but images, Google Fonts and video embeds, no network — and 'widget' as an
 * instant widget (its own sandbox allows the network, so those become warnings).
 */
export function checkHtml(html: string, opts: { kind?: CheckKind } = {}): CheckReport {
  const kind = opts.kind ?? 'page';
  const page = kind === 'page';
  const findings: Finding[] = [];
  const add = (line: number, level: Finding['level'], k: FindingKind, text: string) => findings.push({ line: Math.max(1, line), level, kind: k, text });
  const stats: CheckStats = { bytes: html.length, lines: 1, tags: 0, scripts: 0, styles: 0, images: 0, links: 0 };

  const nl: number[] = [];
  for (let k = html.indexOf('\n'); k >= 0; k = html.indexOf('\n', k + 1)) nl.push(k);
  stats.lines = nl.length + 1;
  const lineOf = (pos: number): number => {
    let lo = 0;
    let hi = nl.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (nl[mid]! < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  const low = html.toLowerCase();

  // ---- basics ----
  if (!/^﻿?\s*(?:<!--[\s\S]*?-->\s*)*<!doctype\s+html\b/i.test(html)) add(1, page ? 'error' : 'warning', 'basics', 'no <!doctype html> at the top — without it the browser uses quirks mode and layouts break; make it the first line');
  const headAt = low.indexOf('<head');
  const headLine = headAt >= 0 ? lineOf(headAt) : 1;
  // A widget lives in a frame the interface sizes and names: viewport, title, lang and charset are the host's.
  if (page) {
    const viewport = html.match(/<meta\b[^>]*\bname\s*=\s*["']?viewport["']?[^>]*>/i);
    if (!viewport) add(headLine, 'error', 'basics', 'no <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"> in <head> — the page would be shown desktop-sized and tiny on the phone');
    else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport[0])) add(lineOf(viewport.index ?? 0), 'warning', 'quality', 'the viewport forbids zooming (user-scalable=no / maximum-scale=1) — people who need to zoom can\'t; leave it out');
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (!title || !title[1]!.trim()) add(title ? lineOf(title.index ?? 0) : headLine, 'error', 'basics', title ? 'the <title> is empty — the tab and the link card would say "Untitled"' : 'no <title> — the tab and the link card would say "Untitled"');
    const htmlTag = html.match(/<html\b[^>]*>/i);
    if (htmlTag && !hasAttr(htmlTag[0].slice(5, -1), 'lang')) add(lineOf(htmlTag.index ?? 0), 'warning', 'quality', '<html> has no lang attribute (lang="en" helps screen readers and translation)');
    if (!/<meta\b[^>]*\bcharset\s*=/i.test(html) && !/<meta\b[^>]*content-type/i.test(html)) add(headLine, 'warning', 'quality', 'no <meta charset="utf-8"> — accents, symbols and emoji may show as �');
  }
  if (html.length > BIG) add(1, 'warning', 'quality', `the page is ${Math.round(html.length / 1024)} KB — over 350 KB it loads slowly on a phone; use image URLs instead of embedded images, drop unused CSS and code`);
  // Publishing refuses the quoted word too (a field a script makes, or a disguised one); <input type="password"> is reported by the tag walk below.
  const pw = decodeRefs(html).replace(/<input\b[^>]*>/gi, (m) => ' '.repeat(m.length)).match(/["'`]password["'`]/i);
  if (pw) add(lineOf(pw.index ?? 0), page ? 'error' : 'warning', 'blocked', page ? 'a password field made by a script (or the quoted word "password") — publishing refuses it because the page could pass for a real login page; leave sign-in out or show it as a plain button' : 'a password field in a widget: nothing it collects can be sent anywhere; leave sign-in out');

  // ---- walk the tags ----
  const stack: { name: string; line: number }[] = [];
  const ids = new Map<string, number>();
  const scripts: { code: string; line: number }[] = [];
  const styles: { css: string; line: number }[] = [];
  let structureErrors = 0;
  const structure = (line: number, text: string) => {
    if (structureErrors++ < 12) add(line, 'error', 'structure', text);
  };
  const resource = (line: number, level: Finding['level'], text: string) => add(line, level, 'blocked', text);
  /** An address an image, sound, video or stylesheet points at: insecure or nowhere, say so. */
  const checkSrc = (line: number, what: string, raw: string, opts2: { stylesheet?: boolean; frame?: boolean } = {}) => {
    const w = where(raw);
    const u = raw.trim();
    if (w === 'http') return resource(line, 'error', `${what} ${u.slice(0, 80)} is insecure (http:) — the browser blocks it on an https page; use an https:// address`);
    if (opts2.frame) {
      if (page && w !== 'anchor' && !FRAME_HOSTS.includes(hostOf(u))) resource(line, 'error', `${what} ${u.slice(0, 80)} won't show — a published page may only frame YouTube (www.youtube-nocookie.com), Vimeo (player.vimeo.com) and OpenStreetMap (www.openstreetmap.org) embeds; link to it instead`);
      return;
    }
    if (opts2.stylesheet) {
      if (page && !(w === 'https' && u.startsWith(FONT_CSS))) resource(line, 'error', `${what} ${u.slice(0, 80)} won't load — a published page may only use its own <style> and Google Fonts stylesheets; put the CSS in a <style> tag`);
      else if (!page && (w === 'relative' || w === 'rooted')) resource(line, 'warning', `${what} ${u.slice(0, 80)} is a relative address — a widget has no files of its own; use a full https:// address or inline it`);
      return;
    }
    if (w === 'relative' || w === 'rooted') {
      if (page) resource(line, 'error', `${what} ${u.slice(0, 80)} is a relative address — a published page has no files of its own, so it would be a broken link; use a full https:// address or a data: URL`);
      else if (w === 'relative') resource(line, 'warning', `${what} ${u.slice(0, 80)} is a relative address — a widget has no files of its own; use a full https:// address or a data: URL`);
    }
  };

  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end < 0) {
        structure(lineOf(lt), 'a comment opened with <!-- never closes (everything after it is hidden)');
        break;
      }
      i = end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    const head = /^<(\/?)([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 64));
    if (!head) {
      i = lt + 1; // a bare "<" in text
      continue;
    }
    const close = head[1] === '/';
    const name = head[2]!.toLowerCase();
    const tagLine = lineOf(lt);
    // the attributes, up to the closing ">" (quotes honoured)
    let j = lt + head[0].length;
    const attrStart = j;
    let q = '';
    let qAt = 0;
    let broken = false;
    while (j < n) {
      const c = html[j]!;
      if (q) {
        if (c === q) q = '';
        else if (c === '\n' && lineOf(j) > lineOf(qAt) + 2) {
          // a quote open across three lines: it was never closed; the tag ends at the next ">"
          broken = true;
          break;
        }
      } else if (c === '"' || c === "'") {
        q = c;
        qAt = j;
      } else if (c === '>') break;
      j++;
    }
    if (broken) {
      structure(lineOf(qAt), `an attribute quote in <${name}> is never closed — everything up to the next quote becomes part of it`);
      const gt = html.indexOf('>', qAt);
      j = gt < 0 ? n : gt;
    }
    if (j >= n) {
      structure(tagLine, `<${name} is never closed with ">"`);
      break;
    }
    let attrs = html.slice(attrStart, j);
    const selfClose = /\/\s*$/.test(attrs);
    attrs = attrs.replace(/\/\s*$/, '');
    i = j + 1;

    if (!close) {
      stats.tags++;
      const id = attr(attrs, 'id');
      if (id) {
        if (ids.has(id)) add(tagLine, 'warning', 'quality', `id "${id}" is used twice (the first use is on line ${ids.get(id)}; getElementById finds only that one)`);
        else ids.set(id, tagLine);
      }
      if (name === 'script') {
        const type = attr(attrs, 'type') ?? '';
        const src = attr(attrs, 'src');
        if (src !== null) {
          if (page) resource(tagLine, 'error', `<script src="${src.slice(0, 80)}"> won't load — a published page may only run its own inline <script>; put the code in the page`);
          else if (where(src) === 'http') resource(tagLine, 'error', `<script src="${src.slice(0, 80)}"> is insecure (http:) — the browser blocks it; use https://`);
          else if (where(src) === 'relative') resource(tagLine, 'warning', `<script src="${src.slice(0, 80)}"> is a relative address — a widget has no files of its own (the kit is /widget-kit.js); use a full https:// address`);
        }
        const end = low.indexOf('</script', i);
        const code = html.slice(i, end < 0 ? n : end);
        if (src === null && !DATA_SCRIPT.test(type.trim())) {
          stats.scripts++;
          scripts.push({ code, line: lineOf(i) });
        }
        if (end < 0) {
          structure(tagLine, '<script> never closes — add </script> (the rest of the page is read as code)');
          break;
        }
        stack.push({ name, line: tagLine });
        i = end;
        continue;
      }
      if (name === 'style') {
        const end = low.indexOf('</style', i);
        stats.styles++;
        styles.push({ css: html.slice(i, end < 0 ? n : end), line: lineOf(i) });
        if (end < 0) {
          structure(tagLine, '<style> never closes — add </style> (the rest of the page is read as CSS)');
          break;
        }
        stack.push({ name, line: tagLine });
        i = end;
        continue;
      }
      const style = attr(attrs, 'style');
      if (style) styles.push({ css: style, line: tagLine });
      if (name === 'img') {
        stats.images++;
        if (!hasAttr(attrs, 'alt')) add(tagLine, 'warning', 'quality', '<img> without alt — screen readers say nothing for it; describe it, or alt="" when it is decoration');
        const src = attr(attrs, 'src');
        if (src) checkSrc(tagLine, '<img src>', src);
        const srcset = attr(attrs, 'srcset');
        if (srcset) for (const c of srcset.split(',')) checkSrc(tagLine, '<img srcset>', c.trim().split(/\s+/)[0] ?? '');
      } else if (name === 'source' || name === 'video' || name === 'audio' || name === 'track' || name === 'embed' || name === 'object') {
        for (const a of ['src', 'srcset', 'poster', 'data']) {
          const v = attr(attrs, a);
          if (v) checkSrc(tagLine, `<${name} ${a}>`, a === 'srcset' ? (v.split(',')[0]?.trim().split(/\s+/)[0] ?? '') : v);
        }
      } else if (name === 'link') {
        const rel = (attr(attrs, 'rel') ?? '').toLowerCase();
        const href = attr(attrs, 'href') ?? '';
        if (/\bstylesheet\b/.test(rel) && href) checkSrc(tagLine, '<link rel="stylesheet" href>', href, { stylesheet: true });
        else if (/\b(modulepreload|preload)\b/.test(rel) && page && /\bas\s*=\s*["']?script/i.test(attrs)) resource(tagLine, 'error', `<link rel="${rel}"> for a script won't load — a published page runs only its own inline scripts`);
      } else if (name === 'iframe') {
        const src = attr(attrs, 'src');
        if (src) checkSrc(tagLine, '<iframe src>', src, { frame: true });
      } else if (name === 'form' || name === 'button' || name === 'input') {
        const action = attr(attrs, name === 'form' ? 'action' : 'formaction');
        if (action !== null) resource(tagLine, 'error', `<${name} ${name === 'form' ? 'action' : 'formaction'}="${action.slice(0, 60)}"> — the sandbox blocks form submission, so this form can never send anything; remove the target and handle the submit in script (e.preventDefault()), or keep the form visual`);
        if (name === 'input' && /^password$/i.test(decodeRefs(attr(attrs, 'type') ?? ''))) add(tagLine, page ? 'error' : 'warning', 'blocked', page ? '<input type="password"> — publishing refuses it because the page could pass for a real login page; leave sign-in out or show it as a plain button' : '<input type="password"> in a widget: nothing it collects can be sent anywhere; leave sign-in out');
      } else if (name === 'base') {
        if (page) resource(tagLine, 'error', '<base> is ignored on a published page (base-uri none) — remove it and use full addresses');
      } else if (name === 'a') {
        if (hasAttr(attrs, 'href')) stats.links++;
      }
      if (STRUCTURAL.has(name) && !VOID.has(name)) {
        if (selfClose) {
          structure(tagLine, `<${name}/> is not self-closing in HTML — the browser reads it as an opening <${name}> and everything after it ends up inside; write <${name}></${name}>`);
        }
        while (stack.length && (CLOSES[name] ?? []).includes(stack[stack.length - 1]!.name)) stack.pop();
        stack.push({ name, line: tagLine });
      }
      continue;
    }
    // an end tag
    if (VOID.has(name) || !STRUCTURAL.has(name)) continue;
    let at = -1;
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k]!.name === name) {
        at = k;
        break;
      }
    }
    if (at < 0) {
      if (!OPTIONAL_END.has(name)) structure(tagLine, `</${name}> has no matching <${name}> — remove it, or add the opening tag`);
      continue;
    }
    for (let k = stack.length - 1; k > at; k--) {
      const open = stack[k]!;
      if (!OPTIONAL_END.has(open.name)) structure(tagLine, `</${name}> closes <${name}> from line ${stack[at]!.line}, but <${open.name}> (line ${open.line}) is still open — add </${open.name}> before it`);
    }
    stack.length = at;
  }
  for (const open of stack) if (!OPTIONAL_END.has(open.name)) structure(open.line, `<${open.name}> is never closed — add </${open.name}> (everything after it is inside it)`);

  // ---- inline scripts ----
  const idUse = /(?:getElementById\s*\(\s*["']([\w:-]+)["']\s*\)|querySelector(?:All)?\s*\(\s*["']#([\w:-]+)["']\s*\))/g;
  for (const s of scripts) {
    const problem = bracketProblem(s.code);
    if (problem) add(s.line + (Number(problem.match(/line (\d+)/)?.[1] ?? 1) - 1), 'error', 'script', `in this <script>: ${problem.replace(/\bline (\d+)/g, (_, l: string) => `line ${s.line + Number(l) - 1}`)} — the browser runs none of the script`);
    const code = bare(s.code);
    // comments and template text blanked, string literals kept: the ids a script looks up are strings
    const plain = codeOnly(s.code);
    const lineIn = (idx: number) => s.line + (code.slice(0, idx).match(/\n/g)?.length ?? 0);
    const net = [
      [/\bfetch\s*\(/, 'fetch()'],
      [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
      [/\bnew\s+WebSocket\b/, 'WebSocket'],
      [/\bnew\s+EventSource\b/, 'EventSource'],
      [/\bsendBeacon\s*\(/, 'sendBeacon()'],
    ] as const;
    for (const [re, what] of net) {
      const m = code.match(re);
      if (!m) continue;
      if (page) resource(lineIn(m.index ?? 0), 'error', `${what} — a published page can't make network requests (its sandbox allows none), so this always fails; put the data in the page, or offer the working version as a self-edit`);
      else resource(lineIn(m.index ?? 0), 'warning', `${what} in a widget works only with APIs that allow any origin (CORS, e.g. api.open-meteo.com, api.frankfurter.app, api.coingecko.com) — show a loading state and an error message, never a blank widget`);
    }
    const imp = code.match(/\bimport\s*\(/);
    if (imp && page) resource(lineIn(imp.index ?? 0), 'error', 'import() — a published page runs only its own inline scripts, so a dynamic import always fails; put the code in the page');
    const wk = code.match(/\bnew\s+(?:Shared)?Worker\s*\(/);
    if (wk && page) resource(lineIn(wk.index ?? 0), 'error', 'new Worker() — the sandbox blocks workers on a published page; do the work on the main thread or in small steps with requestAnimationFrame');
    const store = code.match(/\b(localStorage|sessionStorage|indexedDB)\b/);
    if (store && page && !/\btry\b/.test(code)) add(lineIn(store.index ?? 0), 'warning', 'quality', `${store[1]} throws on a published page (sandboxed origin) — wrap it in try/catch with an in-memory fallback`);
    const log = code.match(/\bconsole\.log\s*\(/);
    if (log) add(lineIn(log.index ?? 0), 'warning', 'quality', 'console.log left in — remove debugging output');
    for (const m of plain.matchAll(idUse)) {
      const id = m[1] ?? m[2] ?? '';
      if (id && !ids.has(id)) add(lineIn(m.index ?? 0), 'warning', 'quality', `the script looks for id "${id}" but no element has it (unless it is created by the script) — a typo here means a dead button`);
    }
  }

  // ---- CSS ----
  let vhSaid = false;
  for (const st of styles) {
    const lineIn = (idx: number) => st.line + (st.css.slice(0, idx).match(/\n/g)?.length ?? 0);
    const fontBlocks = [...st.css.matchAll(/@font-face\s*\{[^}]*\}/gi)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as const);
    for (const m of st.css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
      const u = (m[2] ?? '').trim();
      const at = m.index ?? 0;
      const inFont = fontBlocks.some(([a, b]) => at >= a && at < b);
      const w = where(u);
      if (w === 'http') resource(lineIn(at), 'error', `url(${u.slice(0, 80)}) is insecure (http:) — the browser blocks it; use https://`);
      else if (w === 'relative' || w === 'rooted') {
        if (page) resource(lineIn(at), 'error', `url(${u.slice(0, 80)}) is a relative address — a published page has no files of its own; use a full https:// address or a data: URL`);
        else if (w === 'relative') resource(lineIn(at), 'warning', `url(${u.slice(0, 80)}) is a relative address — a widget has no files of its own; use a full https:// address or a data: URL`);
      } else if (inFont && page && w === 'https' && !u.startsWith(FONT_FILES)) resource(lineIn(at), 'error', `@font-face url(${u.slice(0, 80)}) won't load — a published page may use Google Fonts (fonts.gstatic.com) or fonts embedded as data:; or use the system font stack`);
    }
    for (const m of st.css.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)/gi)) {
      const u = m[1] ?? '';
      if (page && !u.startsWith(FONT_CSS)) resource(lineIn(m.index ?? 0), 'error', `@import ${u.slice(0, 80)} won't load — a published page may import only Google Fonts; put the CSS in the page`);
      else if (where(u) === 'http') resource(lineIn(m.index ?? 0), 'error', `@import ${u.slice(0, 80)} is insecure (http:) — use https://`);
    }
    const vh = st.css.match(/\b100vh\b/);
    if (vh && !vhSaid) {
      vhSaid = true;
      add(lineIn(vh.index ?? 0), 'warning', 'quality', '100vh hides content behind Safari\'s bars on an iPhone — use 100dvh (or 100svh)');
    }
  }

  const order = (a: Finding, b: Finding) => a.line - b.line;
  const errors = findings.filter((f) => f.level === 'error').sort(order);
  const warnings = findings.filter((f) => f.level === 'warning').sort(order);
  const text = (f: Finding) => `line ${f.line}: ${f.text}`;
  return {
    errors: [...errors.slice(0, MAX_ERRORS).map(text), ...(errors.length > MAX_ERRORS ? [`…and ${errors.length - MAX_ERRORS} more errors`] : [])],
    warnings: [...warnings.slice(0, MAX_WARNINGS).map(text), ...(warnings.length > MAX_WARNINGS ? [`…and ${warnings.length - MAX_WARNINGS} more warnings`] : [])],
    findings: [...errors, ...warnings],
    stats,
  };
}

const numbered = (lines: string[]) => lines.map((l, i) => `${i + 1}. ${l}`).join('\n');

/** The report as the model reads it: a verdict line, then numbered errors and warnings. */
export function formatCheck(r: CheckReport, label = ''): string {
  const s = r.stats;
  const head = `CHECK${label ? ` ${label}` : ''}: ${r.errors.length ? `${r.errors.length} error${r.errors.length === 1 ? '' : 's'}` : 'no errors'}, ${r.warnings.length ? `${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'}` : 'no warnings'} — ${Math.max(1, Math.round(s.bytes / 1024))} KB, ${s.lines} lines, ${s.tags} tags, ${s.scripts} inline script${s.scripts === 1 ? '' : 's'}, ${s.styles} style block${s.styles === 1 ? '' : 's'}, ${s.images} image${s.images === 1 ? '' : 's'}`;
  const parts = [head];
  if (r.errors.length) parts.push(`ERRORS — fix every one, then check again (publish_site refuses a page with errors):\n${numbered(r.errors)}`);
  if (r.warnings.length) parts.push(`WARNINGS — worth fixing before you hand over the link:\n${numbered(r.warnings)}`);
  if (!r.errors.length) parts.push(r.warnings.length ? 'No errors: it may be published. Fix the warnings if you can, then run the self-review checklist (study "quality loop").' : 'Clean. Run the self-review checklist (study "quality loop") and hand over the link.');
  return parts.join('\n');
}

/** What publish_site and create_widget say when they refuse a document. */
export const refusal = (what: string, errors: string[]) => `${what} — fix these first:\n${numbered(errors)}`;

export const checkTools: Tool[] = [
  {
    name: 'check_html',
    description:
      'Check a page, app or widget before you hand it over — the same check publish_site runs (it refuses a page with errors). Give ONE complete HTML document (html), a published page (site: its name) or the parts sent with draft_site (draft: true, site: the name). Reports, with line numbers: missing doctype/viewport/title, tags that never close or close the wrong thing, brackets or quotes left open in scripts, what the published page\'s sandbox blocks (scripts or stylesheets from elsewhere, fetch/XHR/WebSocket, frames, insecure or relative addresses, form targets), password fields, images without alt, console.log, oversize. Fix every error, check again, then publish. widget: true judges it as an instant widget (which may use the network).',
    parameters: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'the complete HTML document' },
        site: { type: 'string', description: 'the name of a published page (…/s/<name>) or of a draft' },
        draft: { type: 'boolean', description: 'true: check the draft sent with draft_site under that name (the newest draft when no name is given)' },
        widget: { type: 'boolean', description: 'true: judge it as an instant widget' },
      },
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const widget = arg.bool(a, 'widget');
      let html = arg.str(a, 'html', false);
      let label = '';
      const name = arg.str(a, 'site', false).trim();
      if (!html) {
        if (!name && !a.draft) throw new Error('give the html, a published page\'s name (site), or draft: true');
        const store = siteStore(ctx.env, ctx.storage);
        try {
          if (a.draft) {
            let slug = name;
            if (!slug) {
              // the newest draft, whatever its name
              const drafts = await ctx.storage.list<{ at: number }>({ prefix: 'site:draft:' });
              let best = 0;
              for (const [k, d] of drafts) if ((d?.at ?? 0) >= best) [best, slug] = [d?.at ?? 0, k.slice('site:draft:'.length)];
              if (!slug) throw new Error('there is no draft: send the parts with draft_site first');
            }
            const d = await store.draft(slug);
            if (!d?.parts.length) throw new Error(`no draft called "${slug}": send its parts with draft_site first`);
            html = d.parts.join('');
            label = `draft "${slug}" (${d.parts.length} part${d.parts.length === 1 ? '' : 's'})`;
          } else {
            const site = await store.get(name);
            if (!site) throw new Error(`nothing is published at /s/${name} (list_sites shows every page)`);
            html = site.html;
            label = `published page "${site.name}"`;
          }
        } catch (e) {
          throw new Error(storageError(e) ?? String((e as Error)?.message ?? e));
        }
      }
      return formatCheck(checkHtml(html, { kind: widget ? 'widget' : 'page' }), label);
    },
  },
];
