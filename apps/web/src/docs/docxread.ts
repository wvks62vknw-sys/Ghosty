/**
 * OUR OWN WORD READER (BRIEF-EDITOR-DOCUMENTS): a .docx is a zip of XML; this reads the parts that make a document and keeps
 * what the editor can edit: headings (by Word's own styles, whatever the file calls them), the title, paragraphs, lists by their
 * numbering (bullet or counted), bold, italic, underline, links (real hyperlinks only: https, mailto, tel), alignment, tables
 * (their rows and cells, a header row, merged cells padded so the grid holds), pictures (inline or floating, shrunk and kept in the
 * phone's picture store, with their description and their share of the page), page breaks, the page's size, margins and
 * direction, the header and footer lines and whether the footer numbers the pages. Left out, said by `lost`: tracked deletions
 * (insertions are kept), comments, footnotes, text boxes, columns, shapes, fonts and colours, nested lists' depth, a table inside
 * a table. Runs in the browser (DOMParser); the file never leaves the phone. Mammoth stays as the fall-back for a file this finds no words in.
 */
import { unzipSync } from '../convert/zip';
import { addImageBytes } from './images';
import { block, blockId, newDoc, textOf, tidyRuns, titled, type Align, type Block, type Doc, type PageSetup, type Run } from './model';
import { commentId, fromWordParas, type Comment } from './comments';

const dec = new TextDecoder();
const text = (files: Map<string, Uint8Array>, name: string): string | null => {
  const b = files.get(name);
  return b ? dec.decode(b) : null;
};
const parse = (xml: string): Document | null => {
  const d = new DOMParser().parseFromString(xml, 'application/xml');
  return d.getElementsByTagName('parsererror').length ? null : d;
};
const kids = (el: Element | null | undefined, local?: string): Element[] => (el ? [...el.children].filter((c) => !local || c.localName === local) : []);
const first = (el: Element | null | undefined, local: string): Element | null => kids(el, local)[0] ?? null;
const attr = (el: Element | null | undefined, local: string): string => {
  if (!el) return '';
  for (const a of el.attributes) if (a.localName === local) return a.value;
  return '';
};
const MIMES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
const on = (el: Element | null): boolean => !!el && !/^(?:0|false|off|none)$/i.test(attr(el, 'val'));
const norm = (p: string): string => {
  const out: string[] = [];
  for (const s of p.split('/')) s === '..' ? out.pop() : s && s !== '.' && out.push(s);
  return out.join('/');
};
const safeHref = (u: string) => (/^(?:https?:|mailto:|tel:)/i.test(u.trim()) ? u.trim() : '');

interface Style {
  name: string;
  basedOn: string;
  num: string;
}

/** A document read, with what was left out said in `lost` (a list of plain words). */
export interface DocxRead {
  doc: Doc;
  lost: string[];
}

export async function readDocx(bytes: Uint8Array, name: string): Promise<DocxRead | null> {
  let files: Map<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return null;
  }
  const main = text(files, 'word/document.xml');
  const dom = main ? parse(main) : null;
  if (!dom) return null;
  const body = dom.getElementsByTagName('*')[0] ? [...dom.getElementsByTagName('*')].find((e) => e.localName === 'body') : null;
  if (!body) return null;
  const lost = new Set<string>();

  // styles: which paragraph style is a heading, the title, a quotation, a list
  const styles = new Map<string, Style>();
  const sdom = parse(text(files, 'word/styles.xml') ?? '');
  for (const s of sdom ? [...sdom.getElementsByTagName('*')].filter((e) => e.localName === 'style') : []) {
    styles.set(attr(s, 'styleId'), { name: attr(first(s, 'name'), 'val').toLowerCase(), basedOn: attr(first(s, 'basedOn'), 'val'), num: attr(first(first(first(s, 'pPr'), 'numPr'), 'numId'), 'val') });
  }
  const styleKind = (id: string): string => {
    for (let k = 0, s = styles.get(id), cur = id; s && k < 6; k++, cur = s.basedOn, s = styles.get(cur)) {
      const n = s.name;
      const h = /^heading (\d)$/.exec(n) ?? /^heading(\d)$/i.exec(cur);
      if (h) return `h${Math.min(3, Number(h[1]))}`;
      if (n === 'title') return 'title';
      if (n === 'quote' || n === 'intense quote') return 'quote';
      if (/^list bullet/.test(n)) return 'ul';
      if (/^list number/.test(n)) return 'ol';
      if (/^subtitle$/.test(n)) return 'h2';
    }
    return '';
  };
  const styleNum = (id: string): string => {
    for (let k = 0, s = styles.get(id); s && k < 6; k++, s = styles.get(s.basedOn)) if (s.num) return s.num;
    return '';
  };

  // numbering: a list is a bullet or counted by its first level's format
  const numKind = new Map<string, 'ul' | 'ol'>();
  const ndom = parse(text(files, 'word/numbering.xml') ?? '');
  if (ndom) {
    const abs = new Map<string, 'ul' | 'ol'>();
    for (const a of [...ndom.getElementsByTagName('*')].filter((e) => e.localName === 'abstractNum')) {
      const lvl = kids(a, 'lvl').find((l) => attr(l, 'ilvl') === '0') ?? first(a, 'lvl');
      abs.set(attr(a, 'abstractNumId'), /^(?:bullet|none)$/.test(attr(first(lvl, 'numFmt'), 'val')) ? 'ul' : 'ol');
    }
    for (const n of [...ndom.getElementsByTagName('*')].filter((e) => e.localName === 'num')) {
      const k = abs.get(attr(first(n, 'abstractNumId'), 'val'));
      if (k) numKind.set(attr(n, 'numId'), k);
    }
  }

  // relationships: links, pictures, header and footer
  const rels = new Map<string, { type: string; target: string; external: boolean }>();
  const rdom = parse(text(files, 'word/_rels/document.xml.rels') ?? '');
  for (const r of rdom ? [...rdom.getElementsByTagName('*')].filter((e) => e.localName === 'Relationship') : []) {
    rels.set(r.getAttribute('Id') ?? '', { type: (r.getAttribute('Type') ?? '').split('/').pop() ?? '', target: r.getAttribute('Target') ?? '', external: r.getAttribute('TargetMode') === 'External' });
  }

  // the page
  const sects = [...dom.getElementsByTagName('*')].filter((e) => e.localName === 'sectPr');
  const sect = sects[sects.length - 1] ?? null;
  const page: PageSetup = { size: 'a4', margin: 'normal', numbers: false };
  let textW = 11906 - 2 * 1418;
  if (sect) {
    const sz = first(sect, 'pgSz');
    const w = Number(attr(sz, 'w')) || 11906;
    const h = Number(attr(sz, 'h')) || 16838;
    if (Math.max(w, h) > 15200 && Math.max(w, h) < 16300) page.size = 'letter';
    if (attr(sz, 'orient') === 'landscape' || w > h) page.landscape = true;
    const m = Number(attr(first(sect, 'pgMar'), 'left')) || 1418;
    page.margin = m < 1100 ? 'narrow' : m > 1900 ? 'wide' : 'normal';
    textW = Math.max(2000, w - 2 * m);
    for (const ref of kids(sect).filter((e) => e.localName === 'headerReference' || e.localName === 'footerReference')) {
      if (attr(ref, 'type') !== 'default') continue;
      const rel = rels.get(attr(ref, 'id'));
      const part = rel ? text(files, norm(`word/${rel.target}`)) : null;
      const pd = part ? parse(part) : null;
      if (!pd) continue;
      let plain = '';
      let hasField = false;
      let inField = 0;
      for (const e of [...pd.getElementsByTagName('*')]) {
        if (e.localName === 'fldChar') {
          const t = attr(e, 'fldCharType');
          if (t === 'begin') (inField++, (hasField = true));
          else if (t === 'end') inField = Math.max(0, inField - 1);
        } else if (e.localName === 'fldSimple') hasField = true;
        else if (e.localName === 't' && !inField && !e.closest?.('fldSimple')) plain += e.textContent ?? '';
      }
      const words = plain.replace(/\s+/g, ' ').replace(/\s*(?:·\s*)?(?:of\s*)?$/i, hasField ? '' : '$&').trim();
      if (ref.localName === 'headerReference') {
        if (words) page.header = words;
      } else {
        if (words) page.footer = words;
        if (hasField) page.numbers = true;
      }
    }
  }

  // paragraphs
  const blocks: Block[] = [];
  let title = '';
  const runsOf = (p: Element, imgs: Element[]): Run[] => {
    const out: Run[] = [];
    const walk = (el: Element, link = '') => {
      for (const c of kids(el)) {
        const ln = c.localName;
        if (ln === 'r') {
          const rp = first(c, 'rPr');
          const hlv = attr(first(rp, 'highlight'), 'val');
          const run = { b: on(first(rp, 'b')), i: on(first(rp, 'i')), u: on(first(rp, 'u')), s: on(first(rp, 'strike')) || on(first(rp, 'dstrike')), hl: !!hlv && hlv !== 'none' };
          for (const k of kids(c)) {
            if (k.localName === 't') out.push({ text: k.textContent ?? '', ...(run.b ? { b: true } : {}), ...(run.i ? { i: true } : {}), ...(run.u && !link ? { u: true } : {}), ...(run.s ? { s: true } : {}), ...(run.hl ? { hl: true } : {}), ...(link ? { href: link } : {}) });
            else if (k.localName === 'tab') out.push({ text: '    ' });
            else if (k.localName === 'br') out.push({ text: attr(k, 'type') === 'page' ? '\f' : '\n' });
            else if (k.localName === 'noBreakHyphen') out.push({ text: '-' });
            else if (k.localName === 'drawing' || k.localName === 'pict') imgs.push(k);
            else if (k.localName === 'footnoteReference' || k.localName === 'endnoteReference') lost.add('footnotes');
          }
        } else if (ln === 'hyperlink') {
          const rel = rels.get(attr(c, 'id'));
          walk(c, rel?.external ? safeHref(rel.target) : '');
        } else if (ln === 'ins' || ln === 'smartTag' || ln === 'fldSimple' || ln === 'sdt' || ln === 'sdtContent') walk(c, link);
        else if (ln === 'del') lost.add('tracked deletions');
      }
    };
    walk(p);
    return tidyRuns(out);
  };
  const pictureOf = async (d: Element): Promise<Block | null> => {
    const blip = [...d.getElementsByTagName('*')].find((e) => e.localName === 'blip');
    const rel = blip ? rels.get(attr(blip, 'embed')) : null;
    const bytesOf = rel && !rel.external ? files.get(norm(`word/${rel.target}`)) : null;
    if (!bytesOf || !rel) return null;
    const ext = rel.target.split('.').pop()?.toLowerCase() ?? '';
    const kept = await addImageBytes(bytesOf, MIMES[ext] ?? 'image/png');
    if (!kept) return (lost.add('a picture this phone could not open'), null);
    const cx = Number(attr([...d.getElementsByTagName('*')].find((e) => e.localName === 'extent') ?? null, 'cx')) || 0;
    const w = cx ? Math.max(10, Math.min(100, Math.round((cx / 635 / textW) * 100))) : 60;
    const alt = attr([...d.getElementsByTagName('*')].find((e) => e.localName === 'docPr') ?? null, 'descr');
    return { id: blockId(), t: 'img', runs: [], img: kept.id, iw: kept.iw, ih: kept.ih, w, ...(alt ? { alt } : {}) };
  };
  const alignOf = (ppr: Element | null): Align | undefined => {
    const j = attr(first(ppr, 'jc'), 'val');
    return j === 'center' ? 'center' : j === 'right' || j === 'end' ? 'right' : j === 'both' || j === 'distribute' ? 'justify' : undefined;
  };
  const paragraph = async (p: Element): Promise<void> => {
    const ppr = first(p, 'pPr');
    const sid = attr(first(ppr, 'pStyle'), 'val');
    const kind = styleKind(sid);
    const imgs: Element[] = [];
    let runs = runsOf(p, imgs);
    // a page break in the words splits the paragraph
    const pieces: Run[][] = [[]];
    for (const r of runs) {
      const parts = r.text.split('\f');
      parts.forEach((t, k) => {
        if (k) pieces.push([]);
        if (t) pieces[pieces.length - 1]!.push({ ...r, text: t });
      });
    }
    const numId = attr(first(first(ppr, 'numPr'), 'numId'), 'val') || styleNum(sid);
    const listKind = numId && numId !== '0' ? numKind.get(numId) ?? 'ul' : kind === 'ul' || kind === 'ol' ? kind : '';
    const align = alignOf(ppr);
    for (const [k, piece] of pieces.entries()) {
      if (k) blocks.push({ id: blockId(), t: 'pb', runs: [] });
      runs = tidyRuns(piece);
      if (!runs.some((r) => r.text.trim())) continue;
      if (kind === 'title' && !title) {
        title = runs.map((r) => r.text).join('').trim();
        continue;
      }
      const t = kind === 'title' ? 'h1' : kind.startsWith('h') ? kind : kind === 'quote' ? 'quote' : listKind || 'p';
      // a line that starts with a box (☐ / ☑) is a checklist item
      const box = /^\s*([☐☑☒])\s?/.exec(runs[0]?.text ?? '');
      if (box && !kind.startsWith('h')) {
        const rest = tidyRuns([{ ...runs[0]!, text: runs[0]!.text.slice(box[0].length) }, ...runs.slice(1)]);
        blocks.push({ ...block('todo', rest), ...(box[1] !== '☐' ? { ticked: true } : {}), ...(align ? { align } : {}) });
        continue;
      }
      blocks.push({ ...block(t as Block['t'], runs), ...(align ? { align } : {}) });
    }
    for (const d of imgs) {
      const b = await pictureOf(d);
      if (b) blocks.push(align ? { ...b, align } : b);
    }
  };
  const tableOf = (tbl: Element): Block => {
    const rows: Run[][][] = [];
    let head = false;
    for (const [ri, tr] of kids(tbl, 'tr').entries()) {
      if (ri === 0 && first(first(tr, 'trPr'), 'tblHeader')) head = true;
      const cells: Run[][] = [];
      for (const tc of kids(tr, 'tc')) {
        const runs: Run[] = [];
        for (const p of kids(tc, 'p')) {
          if (runs.length) runs.push({ text: '\n' });
          runs.push(...runsOf(p, []));
        }
        if (kids(tc, 'tbl').length) lost.add('a table inside a table');
        const span = Number(attr(first(first(tc, 'tcPr'), 'gridSpan'), 'val')) || 1;
        cells.push(tidyRuns(runs));
        for (let s = 1; s < span; s++) cells.push([]);
      }
      rows.push(cells);
    }
    const cols = Math.max(1, ...rows.map((r) => r.length));
    // (a header row is bold by being the header: its words keep no bold of their own)
    const plain = (cell: Run[]): Run[] => tidyRuns(cell.map(({ b: _bold, ...r }) => r));
    return { id: blockId(), t: 'table', runs: [], head, rows: rows.map((r, ri) => Array.from({ length: cols }, (_, c) => (head && ri === 0 ? plain(r[c] ?? []) : r[c] ?? []))) };
  };
  const section = async (el: Element): Promise<void> => {
    for (const c of kids(el)) {
      if (c.localName === 'p') await paragraph(c);
      else if (c.localName === 'tbl') blocks.push(tableOf(c));
      else if (c.localName === 'sdt') await section(first(c, 'sdtContent') ?? c);
      else if (c.localName === 'ins') await section(c);
    }
  };
  await section(body);
  // [editors.u1] Word comments read back as comments on the same words (their quote found in the page), replies and resolved kept
  const comments: Comment[] = [];
  const cdom = parse(text(files, 'word/comments.xml') ?? '');
  if (cdom) {
    const said = new Map<string, { author: string; at: number; paras: string[] }>();
    for (const c of [...cdom.getElementsByTagName('*')].filter((e) => e.localName === 'comment')) {
      const paras = [...c.getElementsByTagName('*')].filter((e) => e.localName === 'p').map((p) => [...p.getElementsByTagName('*')].filter((e) => e.localName === 't').map((t) => t.textContent ?? '').join('')).filter((t) => t.trim());
      said.set(attr(c, 'id'), { author: attr(c, 'author'), at: Date.parse(attr(c, 'date')) || Date.now(), paras });
    }
    const open = new Map<string, string>();
    const quotes: { id: string; quote: string }[] = [];
    for (const e of [...dom.getElementsByTagName('*')]) {
      if (e.localName === 'commentRangeStart') open.set(attr(e, 'id'), '');
      else if (e.localName === 'commentRangeEnd') {
        const id = attr(e, 'id');
        if (open.has(id)) quotes.push({ id, quote: open.get(id)! });
        open.delete(id);
      } else if (e.localName === 't' && open.size) for (const [k, v] of open) open.set(k, v + (e.textContent ?? ''));
    }
    const taken = new Map<string, number>();
    for (const q of quotes) {
      const s = said.get(q.id);
      if (!s || !q.quote.trim()) continue;
      const hit = blocks.map((b) => ({ b, i: textOf(b).indexOf(q.quote, taken.get(`${q.quote}`) ?? 0) })).find((x) => x.i >= 0) ?? blocks.map((b) => ({ b, i: textOf(b).indexOf(q.quote) })).find((x) => x.i >= 0);
      if (!hit) continue;
      const w = fromWordParas(s.paras);
      comments.push({ id: commentId(), block: hit.b.id, start: hit.i, end: hit.i + q.quote.length, quote: q.quote, text: w.text, at: s.at, replies: w.replies, ...(w.resolved ? { resolved: true } : {}), ...(s.author && s.author !== 'Me' ? { author: s.author } : {}) });
    }
    if (quotes.length > comments.length) lost.add(`${quotes.length - comments.length} comment${quotes.length - comments.length === 1 ? '' : 's'} on words I could not find`);
  } else if ([...dom.getElementsByTagName('*')].some((e) => e.localName === 'commentReference')) lost.add('comments');
  if ([...dom.getElementsByTagName('*')].some((e) => e.localName === 'txbxContent')) lost.add('text boxes');
  if (sect && Number(attr(first(sect, 'cols'), 'num')) > 1) lost.add('columns');
  if (!blocks.some((b) => b.t === 'table' || b.t === 'img' || b.t === 'pb' || b.runs.some((r) => r.text.trim())) && !title) return null;
  const stem = name.replace(/\.[^./]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Document';
  const t = title ? { title, blocks } : titled(blocks, stem);
  const doc = newDoc(t.title, t.blocks, 'document', name);
  doc.page = page;
  if (comments.length) doc.comments = comments;
  return { doc, lost: [...lost] };
}
