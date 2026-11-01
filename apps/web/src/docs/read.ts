/**
 * READING A DOCUMENT on the phone (BRIEF-REST-E part 2): PDF (pdf.js: its words, a bigger line taken as a heading, a
 * bullet or a number as a list), Word (mammoth's HTML, its headings and lists), EPUB (a zip of HTML chapters, in the
 * book's own order), HTML, Markdown and plain text — each as the document model, its title from the file. And a
 * document in any script as a PDF: set in the standard fonts when its letters allow (docs/layout.ts), else each page
 * drawn by the phone's own fonts on a canvas (Urdu and Arabic shaped right to left) and the pages put in a PDF.
 */
import { sniff, textOf as bytesText, type Kind } from '../convert/bytes';
import { jpegImage, writePdf, type PdfPage } from '../convert/pdfwrite';
import { unzipSync } from '../convert/zip';
import { mammoth, openPdf } from '../convert/vendor';
import { A4 } from '../convert/pdfwrite';
import { canSetAsText, layoutPages, MARGIN } from './layout';
import { block, entities, fromHtml, fromMarkdown, fromText, htmlTitle, newDoc, textOf, titled, type Block, type Doc } from './model';

const stemOf = (name: string) => name.replace(/\.[^./]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Document';

/** A file's bytes as a document. */
export async function readDocBytes(bytes: Uint8Array, name: string, kind: Kind = sniff(bytes.subarray(0, 96), name)): Promise<Doc> {
  const stem = stemOf(name);
  const made = (title: string, blocks: Block[]) => {
    if (!blocks.some((b) => textOf(b).trim())) throw new Error(`I found no words in ${name}`);
    return newDoc(title, blocks, 'read', name);
  };
  if (kind === 'pdf') return pdfDoc(bytes, name);
  if (kind === 'docx') {
    const m = await mammoth();
    const html = (await m.convertToHtml({ arrayBuffer: bytes.slice().buffer })).value;
    const t = titled(fromHtml(html), stem);
    return made(t.title, t.blocks);
  }
  if (kind === 'epub') return epubDoc(bytes, name);
  if (kind === 'html' || kind === 'xml') {
    const html = bytesText(bytes);
    const blocks = fromHtml(html);
    const own = htmlTitle(html);
    const t = own ? { title: own, blocks } : titled(blocks, stem);
    return made(t.title, t.blocks);
  }
  if (kind === 'md') {
    const t = titled(fromMarkdown(bytesText(bytes)), stem);
    return made(t.title, t.blocks);
  }
  if (kind === 'txt' || kind === 'csv' || kind === 'tsv' || kind === 'json') return made(stem, fromText(bytesText(bytes)));
  throw new Error(`I can read PDF, Word, EPUB, web pages, Markdown and text documents (this is ${kind === 'unknown' ? 'a kind I don’t know' : kind.toUpperCase()})`);
}

/** A PDF's words with their shape: lines by where they sit, a gap or a bigger size starting a new block. */
async function pdfDoc(bytes: Uint8Array, name: string): Promise<Doc> {
  const { doc, done } = await openPdf(bytes);
  try {
    type Line = { text: string; size: number; y: number; page: number };
    const lines: Line[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, 400); n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      let cur: Line | null = null;
      for (const it of tc.items) {
        const size = Math.abs(it.transform[3] ?? 0) || it.height || 10;
        const y = it.transform[5] ?? 0;
        if (cur && Math.abs(cur.y - y) > size * 0.6 && it.str.trim()) {
          lines.push(cur);
          cur = null;
        }
        cur ??= { text: '', size, y, page: n };
        cur.text += it.str;
        cur.size = Math.max(cur.size, it.str.trim() ? size : 0);
        if (it.hasEOL) {
          lines.push(cur);
          cur = null;
        }
      }
      if (cur) lines.push(cur);
    }
    const sizes = lines.filter((l) => l.text.trim()).map((l) => Math.round(l.size * 2) / 2).sort((a, b) => a - b);
    if (!sizes.length) throw new Error('this PDF has no words in it: it is pictures of pages (a scan). The Lens’s READ reads a photo of a page');
    const body = sizes[Math.floor(sizes.length / 2)]!;
    const blocks: Block[] = [];
    let para: Line[] = [];
    const flush = () => {
      if (para.length) blocks.push(block('p', para.map((l) => l.text.trim()).join(' ').replace(/(\w)- (\w)/g, '$1$2')));
      para = [];
    };
    let prev: Line | null = null;
    for (const l of lines) {
      const t = l.text.replace(/\s+/g, ' ').trim();
      if (!t) {
        flush();
        prev = null;
        continue;
      }
      const big = l.size >= body * 1.25 && t.length < 140;
      const bullet = /^[•●▪◦‣\-–*]\s+(.*)$/.exec(t);
      const numbered = /^(\d{1,3})[.)]\s+(.*)$/.exec(t);
      const gap = prev && (prev.page !== l.page || Math.abs(prev.y - l.y) > body * 1.9);
      if (big) {
        flush();
        blocks.push(block(l.size >= body * 1.6 ? 'h1' : 'h2', t));
      } else if (bullet) {
        flush();
        blocks.push(block('ul', bullet[1]!));
      } else if (numbered && t.length < 400) {
        flush();
        blocks.push(block('ol', numbered[2]!));
      } else {
        if (gap) flush();
        para.push({ ...l, text: t });
      }
      prev = l;
    }
    flush();
    const own = (await doc.getMetadata().catch(() => null))?.info?.Title?.trim();
    const t = own && own.length < 140 ? { title: own, blocks } : titled(blocks, stemOf(name));
    return newDoc(t.title, t.blocks, 'read', name);
  } finally {
    await done();
  }
}

/** An e-book's chapters in its own order (its OPF spine), each chapter's HTML as blocks. */
function epubDoc(bytes: Uint8Array, name: string): Doc {
  const files = unzipSync(bytes);
  const dec = (p: string) => bytesText(files.get(p) ?? new Uint8Array());
  const opfPath = /full-path="([^"]+)"/.exec(dec('META-INF/container.xml'))?.[1] ?? [...files.keys()].find((k) => k.endsWith('.opf'));
  if (!opfPath || !files.has(opfPath)) throw new Error('this e-book has no table of contents (OPF)');
  const opf = dec(opfPath);
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const items = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[0])?.[1];
    const href = /\bhref="([^"]+)"/.exec(m[0])?.[1];
    if (id && href) items.set(id, decodeURIComponent(href));
  }
  const blocks: Block[] = [];
  for (const m of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)) {
    const href = items.get(m[1]!);
    if (!href) continue;
    const html = dec(base + href) || dec(href);
    blocks.push(...fromHtml(html));
  }
  const title = entities(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/.exec(opf)?.[1] ?? '').trim() || stemOf(name);
  if (!blocks.length) throw new Error('found no readable chapters in this e-book');
  return newDoc(title, blocks, 'read', name);
}

// ---------------------------------------------------------------- a PDF in any script, drawn by the phone
const SCALE = 2;

/** One A4 page of words drawn on a canvas: the same layout as the PDF of words, in the phone's own fonts. */
function drawPages(d: Doc): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = [];
  const W = Math.round(A4.w * SCALE);
  const H = Math.round(A4.h * SCALE);
  const m = MARGIN * SCALE;
  const width = W - 2 * m;
  let c: HTMLCanvasElement;
  let g: CanvasRenderingContext2D;
  let y = 0;
  const page = () => {
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#111';
    g.textBaseline = 'alphabetic';
    g.direction = d.rtl ? 'rtl' : 'ltr';
    g.textAlign = d.rtl ? 'right' : 'left';
    pages.push(c);
    y = m;
  };
  page();
  const serif = 'ui-serif, "New York", Georgia, "Noto Naskh Arabic", "Noto Nastaliq Urdu", serif';
  const sans = '-apple-system, system-ui, "Helvetica Neue", Arial, sans-serif';
  const items: { t: Block['t'] | 'title'; text: string }[] = [{ t: 'title', text: d.title }, ...d.blocks.map((b) => ({ t: b.t, text: textOf(b) }))];
  let n = 0;
  items.forEach((it, k) => {
    n = it.t === 'ol' ? (items[k - 1]?.t === 'ol' ? n + 1 : 1) : 0;
    const size = (it.t === 'title' ? 21 : it.t === 'h1' ? 16 : it.t === 'h2' ? 13.5 : it.t === 'h3' ? 12 : 11.5) * SCALE;
    const heading = it.t === 'title' || it.t === 'h1' || it.t === 'h2' || it.t === 'h3';
    g.font = `${heading ? '700 ' : it.t === 'quote' ? 'italic ' : ''}${size}px ${heading ? sans : serif}`;
    const indent = it.t === 'ul' || it.t === 'ol' || it.t === 'quote' ? 20 * SCALE : 0;
    const lh = size * 1.5;
    const lines: string[] = [];
    for (const para of it.text.split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && g.measureText(next).width > width - indent) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    y += heading && k ? 10 * SCALE : 0;
    if (heading && y + lh * 3 > H - m) page();
    lines.forEach((line, i) => {
      if (y + lh > H - m) {
        page();
        g.font = `${heading ? '700 ' : it.t === 'quote' ? 'italic ' : ''}${size}px ${heading ? sans : serif}`;
      }
      y += lh;
      const right = it.t === 'right' ? !d.rtl : d.rtl;
      g.textAlign = right ? 'right' : 'left';
      const x = right ? W - m - (d.rtl ? indent : 0) : m + (d.rtl ? 0 : indent);
      if (i === 0 && (it.t === 'ul' || it.t === 'ol')) {
        const mark = it.t === 'ul' ? '•' : `${n}.`;
        g.fillText(mark, d.rtl ? W - m : m, y);
      }
      g.fillText(line, x, y);
    });
    y += (it.t === 'ul' || it.t === 'ol' ? 3 : 8) * SCALE;
  });
  pages.forEach((p, i) => {
    const gg = p.getContext('2d')!;
    gg.font = `${8.5 * SCALE}px ${sans}`;
    gg.fillStyle = '#777';
    gg.textAlign = 'center';
    gg.direction = 'ltr';
    gg.fillText(`${i + 1} of ${pages.length}`, W / 2, H - m / 2);
  });
  return pages;
}

/** The document as a PDF, whatever its script: words set in the PDF's own fonts when they can be, else drawn pages. */
export async function pdfOfDocAnyScript(d: Doc, progress: (w: string, f?: number) => void = () => undefined): Promise<Uint8Array> {
  if (canSetAsText(d)) return writePdf(layoutPages(d), { title: d.title });
  progress('drawing its pages with this phone’s own letters…');
  const pages: PdfPage[] = [];
  for (const c of drawPages(d)) {
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const img = blob && jpegImage(new Uint8Array(await blob.arrayBuffer()));
    if (!img) throw new Error('this phone couldn’t draw the page');
    pages.push({ w: A4.w, h: A4.h, images: [{ img, x: 0, y: 0, w: A4.w, h: A4.h }] });
  }
  return writePdf(pages, { title: d.title });
}
