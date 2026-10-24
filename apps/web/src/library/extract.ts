/**
 * Reading documents in the browser, with no libraries and no AI, so Ghosty's library costs
 * nothing to fill: PDF (text-based), Word (.docx), e-books (.epub), web pages, Markdown,
 * plain text, CSV/JSON and source code. Scanned PDFs (pictures of pages) have no text to
 * read; the Library tab then asks the brain to convert them (Workers AI, no key). The PDF reader itself is
 * shared with the brain (packages/shared/src/pdf.ts: the brain reads gadget manuals with it).
 */
import { extractPdf, inflateAll } from '../../../../packages/shared/src/pdf';

export { extractPdf };

export interface Extracted {
  title: string;
  /** Text per page (PDF) or chapter (e-book); one entry for everything else. */
  pages: string[];
  kind: string;
  code?: boolean;
  /** Something the owner should know (e.g. "looks scanned"). */
  warning?: string;
}

const CODE_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|py|rs|go|c|h|cc|cpp|hpp|java|kt|swift|rb|php|cs|scala|lua|sh|bash|sql|r|m|dart|zig|ex|exs|hs|ml|clj|vue|svelte)$/i;
const TEXT_EXT = /\.(txt|md|markdown|mdx|rst|csv|tsv|json|jsonl|yaml|yml|toml|ini|log|xml|tex|org|adoc)$/i;

export const ACCEPT = 'image/*,.heic,.pdf,.docx,.epub,.html,.htm,.txt,.md,.markdown,.mdx,.rst,.csv,.tsv,.json,.jsonl,.yaml,.yml,.toml,.xml,.tex,.log,.ini,.org,.adoc,.js,.mjs,.ts,.tsx,.jsx,.py,.rs,.go,.c,.h,.cc,.cpp,.hpp,.java,.kt,.swift,.rb,.php,.cs,.scala,.lua,.sh,.sql,.r,.dart,.zig,.vue,.svelte';

const stem = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || name;

export async function extractFile(file: File): Promise<Extracted> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') return extractPdf(new Uint8Array(await file.arrayBuffer()), stem(name));
  if (lower.endsWith('.docx')) return extractDocx(new Uint8Array(await file.arrayBuffer()), stem(name));
  if (lower.endsWith('.epub')) return extractEpub(new Uint8Array(await file.arrayBuffer()), stem(name));
  if (/\.html?$/.test(lower) || file.type === 'text/html') return extractHtml(await file.text(), stem(name));
  if (CODE_EXT.test(lower)) return { title: name, pages: [await file.text()], kind: 'code', code: true };
  if (TEXT_EXT.test(lower) || file.type.startsWith('text/') || !file.type) return { title: stem(name), pages: [await file.text()], kind: lower.endsWith('.md') ? 'notes' : 'text' };
  throw new Error(`can't read ${name} — supported: PDF, Word (.docx), e-books (.epub), web pages, text, Markdown, CSV/JSON and code`);
}

// ---------------------------------------------------------------- HTML

export function extractHtml(html: string, fallbackTitle: string): Extracted {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return { title: doc.title.trim() || fallbackTitle, pages: [domText(doc.body)], kind: 'web' };
}

/** Text of an element with paragraphs and headings kept (headings become "# …" lines). */
function domText(root: Element | null): string {
  if (!root) return '';
  root.querySelectorAll('script,style,noscript,svg,nav,footer,form,iframe').forEach((e) => e.remove());
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out.push(n.textContent ?? '');
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (n as Element).tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) {
      out.push(`\n\n# ${(n.textContent ?? '').replace(/\s+/g, ' ').trim()}\n\n`);
      return;
    }
    if (tag === 'br') out.push('\n');
    if (tag === 'pre') {
      out.push(`\n\n${n.textContent ?? ''}\n\n`);
      return;
    }
    n.childNodes.forEach(walk);
    if (/^(p|div|li|tr|section|article|blockquote|dd|dt|table|ul|ol|figure|figcaption|header|main|aside)$/.test(tag)) out.push('\n\n');
    else if (/^(td|th)$/.test(tag)) out.push(' | ');
  };
  walk(root);
  return out.join('').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- ZIP (docx, epub)

/** Minimal ZIP reader: file name → bytes (stored or deflated entries). */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_558); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a valid zip-based file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (local + 30 > bytes.length || dv.getUint32(local, true) !== 0x04034b50) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + csize);
    const data = method === 0 ? raw : method === 8 ? await inflateAll(raw, 'deflate-raw') : null;
    if (data) out.set(name, data);
  }
  return out;
}

const xmlText = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

export async function extractDocx(bytes: Uint8Array, fallbackTitle: string): Promise<Extracted> {
  const files = await unzip(bytes);
  const main = files.get('word/document.xml');
  if (!main) throw new Error('this Word file has no document text');
  const xml = new TextDecoder().decode(main);
  const title = xmlText(new TextDecoder().decode(files.get('docProps/core.xml') ?? new Uint8Array()).match(/<dc:title>([\s\S]*?)<\/dc:title>/)?.[1] ?? '').trim();
  const paras = xml.split(/<\/w:p>/).map((p) => {
    const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br)\/>/g)].map((m) => (m[2] === 'tab' ? '\t' : m[2] === 'br' ? '\n' : xmlText(m[1] ?? ''))).join('');
    const heading = /<w:pStyle w:val="(Heading|Title)\d*"/i.test(p);
    return heading && text.trim() ? `# ${text.trim()}` : text;
  });
  return { title: title || fallbackTitle, pages: [paras.join('\n\n')], kind: 'document' };
}

export async function extractEpub(bytes: Uint8Array, fallbackTitle: string): Promise<Extracted> {
  const files = await unzip(bytes);
  const dec = new TextDecoder();
  const container = dec.decode(files.get('META-INF/container.xml') ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1] ?? [...files.keys()].find((k) => k.endsWith('.opf'));
  if (!opfPath || !files.get(opfPath)) throw new Error('this e-book has no table of contents (OPF)');
  const opf = dec.decode(files.get(opfPath)!);
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = xmlText(opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/)?.[1] ?? '').trim();
  const items = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) items.set(id, decodeURIComponent(href));
  }
  const order = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => items.get(m[1]!)).filter((x): x is string => !!x);
  const pages: string[] = [];
  for (const href of order) {
    const data = files.get(base + href) ?? files.get(href);
    if (!data) continue;
    const doc = new DOMParser().parseFromString(dec.decode(data), 'text/html');
    const t = domText(doc.body);
    if (t.trim()) pages.push(t);
  }
  if (!pages.length) throw new Error('found no readable chapters in this e-book');
  return { title: title || fallbackTitle, pages, kind: 'book' };
}
