/**
 * OUR OWN POWERPOINT READER (BRIEF-EDITOR-PRESENTATIONS): a .pptx is a zip of XML; this reads the parts that make a deck and keeps
 * what the editor can edit: the slides in the order presentation.xml lists them, each one's title and text (paragraphs, bullets or
 * counted lists, bold, italic, underline, links that are real addresses), a picture (kept in the phone's picture store, with its
 * description), a table (its rows, a header row) or a chart written as its numbers, up to two plain shapes, the speaker notes, the
 * layout where the file names ours (else the one its placeholders suggest) and the colours of its theme. What it cannot keep it says,
 * never silently: a video or sound, a chart part, a SmartArt, an embedded object, a drawing it has no shape for, a second picture or
 * table on one slide, animations, transitions, comments, nested bullets (flattened), the colours and fonts of single words, a slide
 * shape that is not 16:9. The file never leaves the phone; the XML is read by xml.ts, so this runs in node as well.
 */
import { unzipSync } from '../convert/zip';
import { block, blockId, tidyRuns, type Block, type Run } from '../docs/model';
import { attr, find, findAll, first, has, kids, parseXml, type XEl } from './xml';
import { H, W, newDeck, newSlide, type ChartData, type Deck, type Layout, type Media, type Shape, type ShapeKind, type Slide } from './model';
import { paletteFrom, type Palette } from './themes';
import { PPT_LAYOUT } from './pptx';

export type KeepImage = (bytes: Uint8Array, mime: string) => Promise<{ id: string; iw: number; ih: number } | null>;
export interface PptxRead {
  deck: Deck;
  /** What could not be kept, each a plain phrase ("a video on slide 4"). */
  lost: string[];
}

const dec = new TextDecoder();
const text = (files: Map<string, Uint8Array>, name: string): string | null => {
  const b = files.get(name);
  return b ? dec.decode(b) : null;
};
const norm = (p: string): string => {
  const out: string[] = [];
  for (const s of p.split('/')) s === '..' ? out.pop() : s && s !== '.' && out.push(s);
  return out.join('/');
};
const dirOf = (p: string): string => p.slice(0, p.lastIndexOf('/') + 1);
const relsOf = (path: string): string => `${dirOf(path)}_rels/${path.slice(path.lastIndexOf('/') + 1)}.rels`;
interface Rel {
  type: string;
  target: string;
  external: boolean;
}
function readRels(files: Map<string, Uint8Array>, part: string): Map<string, Rel> {
  const out = new Map<string, Rel>();
  const xml = text(files, relsOf(part));
  if (!xml) return out;
  try {
    for (const r of kids(parseXml(xml), 'Relationship')) {
      const ext = attr(r, 'TargetMode') === 'External';
      const t = attr(r, 'Target');
      out.set(attr(r, 'Id'), { type: attr(r, 'Type').split('/').pop() ?? '', target: ext ? t : t.startsWith('/') ? norm(t) : norm(dirOf(part) + t), external: ext });
    }
  } catch {
    /* a damaged rels part: nothing is linked */
  }
  return out;
}
const safeHref = (u: string) => (/^(?:https?:|mailto:|tel:)/i.test(u.trim()) ? u.trim() : '');
const MIMES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
const on = (v: string): boolean => v === '1' || v === 'true';

/** The colours of a file's theme: its ground, ink and sequence, by its colour map. */
function palette(files: Map<string, Uint8Array>, master: string | null, themePart: string | null, name: string): Palette | null {
  const tx = themePart ? text(files, themePart) : null;
  if (!tx) return null;
  try {
    const t = parseXml(tx);
    const scheme = find(t, 'clrScheme');
    const col = (key: string): string => {
      const el = first(scheme, key);
      const c = el?.k[0];
      return c ? (attr(c, 'val') && c.n === 'srgbClr' ? attr(c, 'val') : attr(c, 'lastClr')) : '';
    };
    const map = master ? find(parseXml(text(files, master) ?? '<x/>'), 'clrMap') : null;
    const pick = (k: string, dflt: string): string => col(attr(map, k) || dflt);
    const ground = pick('bg1', 'lt1');
    const ink = pick('tx1', 'dk1');
    const more = ['accent2', 'accent3', 'accent4', 'accent5'].map(col).filter(Boolean);
    return paletteFrom(name, ground, ink, col('accent1') || ink, more);
  } catch {
    return null;
  }
}

interface Ctx {
  files: Map<string, Uint8Array>;
  rels: Map<string, Rel>;
  keep: KeepImage;
  n: number;
  lost: Set<string>;
  sx: number;
  sy: number;
  fonts: { v: boolean };
  nested: { v: boolean };
}
const lose = (c: Ctx, what: string, perSlide = true): void => void c.lost.add(perSlide ? `${what} on slide ${c.n}` : what);

interface TextPart {
  blocks: Block[];
  ph: string;
  x: number;
  y: number;
}

/** A txBody's paragraphs as blocks. `listy`: a body placeholder, whose paragraphs are bullets unless they say otherwise. */
function paras(tx: XEl | null, c: Ctx, listy: boolean): Block[] {
  const out: Block[] = [];
  let numbered = 0;
  for (const p of kids(tx, 'p')) {
    const runs: Run[] = [];
    for (const k of p.k) {
      if (k.n === 'r' || k.n === 'fld') {
        const rp = first(k, 'rPr');
        const t = first(k, 't')?.t ?? '';
        if (!t) continue;
        if (rp && (has(rp, 'srgbClr') || kids(rp, 'latin').some((l) => !/^(?:\+|Arial$)/.test(attr(l, 'typeface'))))) c.fonts.v = true;
        const link = first(rp, 'hlinkClick');
        const rel = link ? c.rels.get(attr(link, 'id')) : undefined;
        const href = rel?.external ? safeHref(rel.target) : '';
        runs.push({ text: t, ...(on(attr(rp, 'b')) ? { b: true } : {}), ...(on(attr(rp, 'i')) ? { i: true } : {}), ...(attr(rp, 'u') && attr(rp, 'u') !== 'none' && !href ? { u: true } : {}), ...(href ? { href } : {}) });
      } else if (k.n === 'br') runs.push({ text: '\n' });
    }
    const ppr = first(p, 'pPr');
    if (Number(attr(ppr, 'lvl') || 0) > 0) c.nested.v = true;
    const tidy = tidyRuns(runs);
    if (!tidy.length || !tidy.some((r) => r.text.trim())) continue;
    const kind = has(ppr, 'buNone') ? 'p' : has(ppr, 'buAutoNum') ? 'ol' : has(ppr, 'buChar') || has(ppr, 'buBlip') ? 'ul' : listy ? 'ul' : 'p';
    numbered = kind === 'ol' ? numbered + 1 : 0;
    out.push({ ...block(kind, tidy), id: blockId() });
  }
  return out;
}

const PRST: Record<string, ShapeKind> = { rect: 'rect', roundRect: 'round', round2SameRect: 'round', ellipse: 'ellipse', rightArrow: 'arrow', line: 'line', straightConnector1: 'line' };

function xfrmOf(sp: XEl, c: Ctx): { x: number; y: number; w: number; h: number } | null {
  const xf = find(first(sp, 'spPr') ?? first(sp, 'xfrm') ?? sp, 'xfrm') ?? first(sp, 'xfrm');
  const off = first(xf, 'off');
  const ext = first(xf, 'ext');
  if (!off || !ext) return null;
  return { x: Number(attr(off, 'x')) * c.sx, y: Number(attr(off, 'y')) * c.sy, w: Number(attr(ext, 'cx')) * c.sx, h: Number(attr(ext, 'cy')) * c.sy };
}

interface Found {
  title: Block | null;
  texts: TextPart[];
  media: Media | null;
  shapes: Shape[];
  numbers: boolean;
}

async function walk(tree: XEl, c: Ctx, f: Found): Promise<void> {
  for (const el of tree.k) {
    if (el.n === 'grpSp') await walk(el, c, f);
    else if (el.n === 'AlternateContent') {
      const ch = first(el, 'Choice') ?? first(el, 'Fallback');
      if (ch) await walk(ch, c, f);
    } else if (el.n === 'sp') {
      const nv = first(el, 'nvSpPr');
      const ph = find(nv, 'ph');
      const type = attr(ph, 'type');
      const tx = first(el, 'txBody');
      if (['sldNum', 'dt', 'ftr', 'hdr'].includes(type)) {
        if (type === 'sldNum') f.numbers = true;
        continue;
      }
      const isTitle = type === 'title' || type === 'ctrTitle';
      const blocks = paras(tx, c, !!ph && !isTitle && type !== 'subTitle');
      if (blocks.length) {
        const xf = xfrmOf(el, c);
        if (isTitle) {
          const runs = tidyRuns(blocks.flatMap((b, i) => [...(i ? [{ text: ' ' }] : []), ...b.runs.map((r) => ({ ...r, text: r.text.replace(/\n/g, ' ') }))]));
          f.title ??= block('h1', runs);
        } else f.texts.push({ blocks, ph: type || (ph ? 'body' : ''), x: xf?.x ?? 0, y: xf?.y ?? 0 });
      } else if (!ph) {
        const prst = attr(find(first(el, 'spPr'), 'prstGeom'), 'prst');
        const xf = xfrmOf(el, c);
        const kind = PRST[prst];
        if (kind && xf && f.shapes.length < 2) f.shapes.push({ id: blockId(), kind, x: xf.x, y: xf.y, w: xf.w, h: kind === 'line' ? 0 : xf.h, fill: f.shapes.length });
        else if (!kind || f.shapes.length >= 2) lose(c, 'a drawing');
      }
    } else if (el.n === 'cxnSp') {
      const xf = xfrmOf(el, c);
      if (xf && f.shapes.length < 2) f.shapes.push({ id: blockId(), kind: 'line', x: xf.x, y: xf.y, w: Math.max(24, xf.w), h: 0, fill: f.shapes.length });
      else lose(c, 'a line');
    } else if (el.n === 'pic') {
      const nvPr = find(first(el, 'nvPicPr'), 'nvPr');
      if (has(nvPr, 'videoFile') || has(nvPr, 'wavAudioFile') || has(nvPr, 'audioFile')) {
        lose(c, has(nvPr, 'videoFile') ? 'a video' : 'a sound');
        continue;
      }
      const rid = attr(find(el, 'blip'), 'embed');
      const rel = c.rels.get(rid);
      const bytes = rel && !rel.external ? c.files.get(rel.target) : undefined;
      if (!bytes) {
        lose(c, 'a picture that is not in the file');
        continue;
      }
      if (f.media) {
        lose(c, 'a second picture');
        continue;
      }
      const ext = rel!.target.split('.').pop()!.toLowerCase();
      const mime = MIMES[ext];
      if (!mime) {
        lose(c, `a picture in a format I cannot draw (${ext.toUpperCase()})`);
        continue;
      }
      const kept = await c.keep(bytes, mime);
      if (!kept) lose(c, 'a picture that would not open');
      else f.media = { k: 'img', img: kept.id, alt: attr(first(first(el, 'nvPicPr'), 'cNvPr'), 'descr'), iw: kept.iw, ih: kept.ih };
    } else if (el.n === 'graphicFrame') {
      const gd = find(el, 'graphicData');
      const uri = attr(gd, 'uri');
      const descr = attr(find(first(el, 'nvGraphicFramePr'), 'cNvPr'), 'descr');
      if (/\/table$/.test(uri) && find(gd, 'tbl')) {
        if (f.media) {
          lose(c, 'a second table');
          continue;
        }
        const tbl = find(gd, 'tbl')!;
        const head = on(attr(first(tbl, 'tblPr'), 'firstRow'));
        const rows: Run[][][] = kids(tbl, 'tr').map((tr) => kids(tr, 'tc').map((tc) => {
          const bs = paras(first(tc, 'txBody'), c, false);
          const runs: Run[] = [];
          bs.forEach((b, i) => runs.push(...(i ? [{ text: '\n' }] : []), ...b.runs));
          return tidyRuns(runs);
        }));
        const chart = descr.startsWith('ghosty-chart|') ? chartOf(descr, rows) : null;
        f.media = chart ? { k: 'chart', chart } : { k: 'table', table: { id: blockId(), t: 'table', runs: [], head, rows } };
      } else if (/chart$/.test(uri)) lose(c, 'a chart');
      else if (/diagram$/.test(uri)) lose(c, 'a SmartArt');
      else lose(c, 'an embedded object');
    } else if (el.n === 'contentPart' || el.n === 'oleObj') lose(c, 'an embedded object');
  }
}

/** A chart this app wrote as a table: its numbers read back exactly. */
function chartOf(descr: string, rows: Run[][][]): ChartData | null {
  const [, kind, unit, before] = descr.split('|');
  const points: ChartData['points'] = [];
  for (const r of rows) {
    const label = (r[0] ?? []).map((x) => x.text).join('');
    const raw = (r[1] ?? []).map((x) => x.text).join('').trim();
    const num = Number((unit ? raw.replace(unit, '') : raw).replace(/,/g, '').trim());
    if (!label || !Number.isFinite(num)) return null;
    points.push({ label, value: num });
  }
  return points.length ? { kind: kind === 'line' ? 'line' : 'bars', points, unit: unit ?? '', before: before === '1' } : null;
}

function layoutOf(f: Found, hint: { type: string; name: string }, index: number, body: Block[], body2: Block[]): Layout {
  const ours = (Object.entries(PPT_LAYOUT) as [Layout, { name: string }][]).find(([, v]) => v.name === hint.name)?.[0];
  if (ours) return ours;
  const m = f.media;
  if (m) {
    const k: Layout = m.k === 'img' ? 'picture' : m.k;
    return body.length <= 1 && !body2.length ? k : 'bullets';
  }
  if (body2.length) return 'two';
  const hasBody = body.length > 0;
  if (!hasBody) {
    if (hint.type === 'blank' && !f.title) return 'blank';
    return f.title ? (index === 0 || hint.type === 'title' ? 'title' : 'section') : 'blank';
  }
  if (hint.type === 'title' && body.length <= 2) return 'title';
  if (hint.type === 'secHead') return 'section';
  return 'bullets';
}

/** A deck read from a .pptx's bytes, with what was left out said; null when it is not a presentation (a damaged file, or an old .ppt). */
export async function readPptx(bytes: Uint8Array, name: string, keep: KeepImage): Promise<PptxRead | null> {
  let files: Map<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return null;
  }
  const norms = new Map<string, Uint8Array>();
  for (const [k, v] of files) norms.set(k.replace(/^\/+/, ''), v);
  files = norms;
  const pxml = text(files, 'ppt/presentation.xml');
  if (!pxml) return null;
  let pres: XEl;
  try {
    pres = parseXml(pxml);
  } catch {
    return null;
  }
  const prels = readRels(files, 'ppt/presentation.xml');
  const sz = find(pres, 'sldSz');
  const cx = Number(attr(sz, 'cx')) || W * 9525;
  const cy = Number(attr(sz, 'cy')) || H * 9525;
  const lost = new Set<string>();
  if (Math.abs(cx / cy - 16 / 9) > 0.02) lost.add('its slide shape (I set the slides in 16:9)');
  const order: Rel[] = [];
  for (const s of kids(first(pres, 'sldIdLst'), 'sldId')) {
    const rid = s.a['r:id'] ?? Object.entries(s.a).find(([k]) => k.endsWith(':id'))?.[1] ?? '';
    const r = prels.get(rid);
    if (r && r.type === 'slide') order.push(r);
  }
  if (!order.length) return null;

  const master = [...prels.values()].find((r) => r.type === 'slideMaster')?.target ?? null;
  const themePart = master ? ([...readRels(files, master).values()].find((r) => r.type === 'theme')?.target ?? null) : null;
  const title0 = ((): string => {
    const core = text(files, 'docProps/core.xml');
    try {
      return core ? (find(parseXml(core), 'title')?.t ?? '').trim() : '';
    } catch {
      return '';
    }
  })();

  const slides: Slide[] = [];
  const fonts = { v: false };
  const nested = { v: false };
  let anyNumber = false;
  for (let i = 0; i < order.length; i++) {
    const part = order[i]!.target;
    const xml = text(files, part);
    let root: XEl | null = null;
    try {
      root = xml ? parseXml(xml) : null;
    } catch {
      root = null;
    }
    if (!root) {
      lost.add(`slide ${i + 1} (damaged: I kept it empty)`);
      slides.push(newSlide('blank'));
      continue;
    }
    const rels = readRels(files, part);
    const c: Ctx = { files, rels, keep, n: i + 1, lost, sx: W / cx, sy: H / cy, fonts, nested };
    const f: Found = { title: null, texts: [], media: null, shapes: [], numbers: false };
    const tree = find(root, 'spTree');
    if (tree) await walk(tree, c, f);
    if (f.numbers) anyNumber = true;
    if (has(root, 'timing')) lose(c, 'animations');
    if (has(root, 'transition')) lose(c, 'its transition');
    if ([...rels.values()].some((r) => r.type === 'comments' || r.type === 'commentAuthors')) lose(c, 'comments');
    // the layout the file names
    const lrel = [...rels.values()].find((r) => r.type === 'slideLayout');
    let hint = { type: '', name: '' };
    if (lrel) {
      try {
        const lx = parseXml(text(files, lrel.target) ?? '<x/>');
        hint = { type: attr(lx, 'type'), name: attr(first(lx, 'cSld'), 'name') };
      } catch {
        /* no hint */
      }
    }
    // text boxes: reading order is top to bottom; two side by side are two columns, the rest join the first
    const texts = [...f.texts].sort((a, b) => a.y - b.y || a.x - b.x);
    let body: Block[] = [];
    let body2: Block[] = [];
    if (texts.length >= 2 && Math.abs(texts[0]!.x - texts[1]!.x) > W * 0.2 && Math.abs(texts[0]!.y - texts[1]!.y) < H * 0.25) {
      const [l, r] = texts[0]!.x <= texts[1]!.x ? [texts[0]!, texts[1]!] : [texts[1]!, texts[0]!];
      body = l.blocks;
      body2 = r.blocks;
      for (const t of texts.slice(2)) body = [...body, ...t.blocks];
    } else body = texts.flatMap((t) => t.blocks);
    const layout = layoutOf(f, hint, i, body, body2);
    // a title with a quote layout: ours puts the attribution in the title
    const notesRel = [...rels.values()].find((r) => r.type === 'notesSlide');
    let notes = '';
    if (notesRel) {
      try {
        const nx = parseXml(text(files, notesRel.target) ?? '<x/>');
        for (const sp of findAll(nx, 'sp')) {
          if (attr(find(sp, 'ph'), 'type') !== 'body') continue;
          notes = kids(first(sp, 'txBody'), 'p').map((p) => findAll(p, 't').map((t) => t.t).join('')).join('\n').trim();
        }
      } catch {
        /* notes left out */
      }
    }
    slides.push(newSlide(layout, { title: f.title ?? block('h1', ''), body, body2, ...(f.media ? { media: f.media } : {}), shapes: f.shapes, notes }));
  }
  if (fonts.v) lost.add('the colours and fonts of single words (the theme sets them)');
  if (nested.v) lost.add('nested bullets (each is a bullet of its own now)');
  const stem = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const title = title0 || slides.map((s) => s.title.runs.map((r) => r.text).join('')).find((t) => t.trim()) || stem || 'Imported deck';
  const deck = newDeck(title, slides, name);
  deck.master = { align: 'left', footer: false, numbers: anyNumber };
  const pal = palette(files, master, themePart, title);
  if (pal) deck.palette = pal;
  return { deck, lost: [...lost] };
}

/** What was left out, as one plain sentence ("" when nothing was). */
export function lostWords(lost: string[]): string {
  if (!lost.length) return '';
  const list = lost.length > 6 ? [...lost.slice(0, 6), `and ${lost.length - 6} more`] : lost;
  return `I couldn’t keep: ${list.join('; ')}.`;
}
