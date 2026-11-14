/**
 * NAMED STYLES (APPS ROUND, documents pro): Title, Heading 1 to 3, Body, Quote and Caption, each with its font family (serif, sans,
 * rounded or mono: families every phone has), size, colour (by name: the page's ink, grey, red, blue, green, orange), weight,
 * slant, line spacing and the room before and after. A document keeps only what he changed (`Doc.styles`); a paragraph may carry
 * its own format on top (`Block.fmt`), and REDEFINE FROM THIS PARAGRAPH makes that the style. Written to Word as real w:style
 * entries in styles.xml and read back from them (ours or anyone's, through basedOn and the document defaults). Pure:
 * apps/edge/test/document.test.mjs.
 */
import { TEXT_COLOURS, type Block, type BlockType, type Doc, type TextColour } from './model';

export type StyleId = 'title' | 'h1' | 'h2' | 'h3' | 'p' | 'quote' | 'caption';
export type FontFamily = 'serif' | 'sans' | 'rounded' | 'mono';
export type StyleColour = 'ink' | 'grey' | TextColour;
export interface ParaStyle {
  font: FontFamily;
  /** Points. */
  size: number;
  colour: StyleColour;
  bold: boolean;
  italic: boolean;
  /** Line spacing: 1 single, 1.15, 1.5, 2 double. */
  line: number;
  /** Room before and after, in points. */
  before: number;
  after: number;
}
export type ParaFormat = Partial<ParaStyle>;

export const STYLE_IDS: StyleId[] = ['title', 'h1', 'h2', 'h3', 'p', 'quote', 'caption'];
export const STYLE_NAMES: Record<StyleId, string> = { title: 'Title', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', p: 'Body', quote: 'Quote', caption: 'Caption' };
export const FONT_NAMES: Record<FontFamily, string> = { serif: 'Serif', sans: 'Sans', rounded: 'Rounded', mono: 'Mono' };
export const COLOUR_NAMES: Record<StyleColour, string> = { ink: 'Ink', grey: 'Grey', red: 'Red', blue: 'Blue', green: 'Green', orange: 'Orange' };
export const LINES: { v: number; name: string }[] = [{ v: 1, name: 'Single' }, { v: 1.15, name: '1.15' }, { v: 1.5, name: '1.5' }, { v: 2, name: 'Double' }];
export const ROOMS = [0, 3, 6, 9, 12, 18, 24, 36];
export const SIZE_MIN = 8;
export const SIZE_MAX = 48;

const body: ParaStyle = { font: 'serif', size: 11.5, colour: 'ink', bold: false, italic: false, line: 1.15, before: 0, after: 8 };
export const DEFAULT_STYLES: Record<StyleId, ParaStyle> = {
  title: { ...body, font: 'sans', size: 20, bold: true, line: 1, after: 12 },
  h1: { ...body, font: 'sans', size: 16, bold: true, line: 1, before: 18, after: 6 },
  h2: { ...body, font: 'sans', size: 13.5, bold: true, line: 1, before: 12, after: 6 },
  h3: { ...body, font: 'sans', size: 12, bold: true, line: 1, before: 12, after: 3 },
  p: body,
  quote: { ...body, italic: true, colour: 'grey', before: 3, after: 9 },
  caption: { ...body, font: 'sans', size: 9, colour: 'grey', italic: true, after: 9 },
};

/** The style a block is set in: headings, quote and caption their own; a paragraph, a list item or a line on the right, Body. */
export const styleIdOf = (t: BlockType): StyleId => (t === 'h1' || t === 'h2' || t === 'h3' || t === 'quote' || t === 'caption' ? t : 'p');
export const styleOf = (d: Pick<Doc, 'styles'>, id: StyleId): ParaStyle => ({ ...DEFAULT_STYLES[id], ...(d.styles?.[id] ?? {}) });
/** A paragraph as it is drawn: its style, with its own format on top. */
export const effective = (d: Pick<Doc, 'styles'>, b: Pick<Block, 't' | 'fmt'>): ParaStyle => ({ ...styleOf(d, styleIdOf(b.t)), ...(b.fmt ?? {}) });

/** Only what differs from the default (what a document keeps). */
export function diffStyle(id: StyleId, s: ParaStyle): ParaFormat {
  const out: ParaFormat = {};
  for (const k of Object.keys(s) as (keyof ParaStyle)[]) if (s[k] !== DEFAULT_STYLES[id][k]) (out as Record<string, unknown>)[k] = s[k];
  return out;
}
/** A style changed (a patch) in the document: every paragraph of that style follows. */
export function setStyle(d: Doc, id: StyleId, patch: ParaFormat): Doc {
  const next = clampStyle({ ...styleOf(d, id), ...patch });
  const kept = diffStyle(id, next);
  const styles = { ...(d.styles ?? {}) };
  if (Object.keys(kept).length) styles[id] = kept;
  else delete styles[id];
  return { ...d, styles: Object.keys(styles).length ? styles : undefined };
}
/** REDEFINE FROM THIS PARAGRAPH: the paragraph's look becomes its style's, and it carries no format of its own any more. */
export function redefineFrom(d: Doc, blockId: string): Doc | string {
  const b = d.blocks.find((x) => x.id === blockId);
  if (!b) return 'Tap a paragraph first.';
  if (!b.fmt || !Object.keys(b.fmt).length) return `This paragraph is already just ${STYLE_NAMES[styleIdOf(b.t)]}: change its look in THIS PARAGRAPH first, then redefine.`;
  const id = styleIdOf(b.t);
  const next = setStyle(d, id, effective(d, b));
  return { ...next, blocks: next.blocks.map((x) => (x.id === blockId ? withoutFmt(x) : x)) };
}
export const withoutFmt = (b: Block): Block => {
  const { fmt: _f, ...rest } = b;
  return rest;
};
/** A paragraph's own format changed (a value equal to its style's is not kept). */
export function setFormat(d: Doc, blockId: string, patch: ParaFormat): Doc {
  return {
    ...d,
    blocks: d.blocks.map((b) => {
      if (b.id !== blockId) return b;
      const st = styleOf(d, styleIdOf(b.t));
      const all = clampStyle({ ...st, ...(b.fmt ?? {}), ...patch });
      const fmt: ParaFormat = {};
      for (const k of Object.keys(all) as (keyof ParaStyle)[]) if (all[k] !== st[k]) (fmt as Record<string, unknown>)[k] = all[k];
      return Object.keys(fmt).length ? { ...b, fmt } : withoutFmt(b);
    }),
  };
}
export function clampStyle(s: ParaStyle): ParaStyle {
  return {
    font: s.font in FONT_NAMES ? s.font : 'serif',
    size: Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(s.size * 2) / 2)),
    colour: s.colour in COLOUR_NAMES ? s.colour : 'ink',
    bold: !!s.bold,
    italic: !!s.italic,
    line: Math.max(0.8, Math.min(3, Math.round(s.line * 100) / 100)),
    before: Math.max(0, Math.min(72, Math.round(s.before))),
    after: Math.max(0, Math.min(72, Math.round(s.after))),
  };
}
/** In his words: "Rounded 18 pt, bold, blue, 1.5 lines, 12 pt before, 6 after". */
export function styleWords(s: ParaStyle): string {
  return `${FONT_NAMES[s.font]} ${s.size} pt${s.bold ? ', bold' : ''}${s.italic ? ', italic' : ''}${s.colour !== 'ink' ? `, ${s.colour}` : ''}, ${LINES.find((l) => l.v === s.line)?.name.toLowerCase() ?? s.line} line spacing, ${s.before} pt before, ${s.after} after`;
}

// ---------------------------------------------------------------- Word

/** Word's own style ids and names for ours. */
export const WORD_STYLE: Record<StyleId, { id: string; name: string }> = {
  title: { id: 'Title', name: 'Title' },
  h1: { id: 'Heading1', name: 'heading 1' },
  h2: { id: 'Heading2', name: 'heading 2' },
  h3: { id: 'Heading3', name: 'heading 3' },
  p: { id: 'Normal', name: 'Normal' },
  quote: { id: 'Quote', name: 'Quote' },
  caption: { id: 'Caption', name: 'caption' },
};
export const WORD_FONT: Record<FontFamily, string> = { serif: 'Georgia', sans: 'Arial', rounded: 'Arial Rounded MT Bold', mono: 'Courier New' };
const GREY = '595959';
export const wordColour = (c: StyleColour): string => (c === 'ink' ? '' : c === 'grey' ? GREY : TEXT_COLOURS[c].word);
export function fontFromWord(name: string): FontFamily | undefined {
  const n = name.toLowerCase();
  if (!n) return undefined;
  if (/mono|courier|consolas|menlo|code|typewriter/.test(n)) return 'mono';
  if (/rounded|nunito|varela|quicksand|comfortaa|arial rounded/.test(n)) return 'rounded';
  if (/georgia|times|serif(?!.*sans)|cambria|garamond|book|baskerville|palatino|minion|charter|new york/.test(n) && !/sans/.test(n)) return 'serif';
  return 'sans';
}
export function colourFromWord(hex: string): StyleColour {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'ink';
  const u = hex.toUpperCase();
  if (u === GREY) return 'grey';
  for (const [k, v] of Object.entries(TEXT_COLOURS) as [TextColour, { word: string }][]) if (v.word === u) return k;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(u.slice(i, i + 2), 16) / 255) as [number, number, number];
  if (Math.max(r, g, b) - Math.min(r, g, b) < 0.2) return Math.max(r, g, b) < 0.2 ? 'ink' : 'grey';
  let best: StyleColour = 'ink';
  let bestD = 0.6;
  for (const [k, v] of Object.entries(TEXT_COLOURS) as [TextColour, { rgb: [number, number, number] }][]) {
    const dd = Math.hypot(v.rgb[0] - r, v.rgb[1] - g, v.rgb[2] - b);
    if (dd < bestD) (bestD = dd), (best = k);
  }
  return best;
}
const half = (n: number) => Math.round(n * 2);

/** The paragraph properties of a style or a paragraph's own format (spacing), in the schema's place. */
export function spacingXml(f: ParaFormat): string {
  if (f.before === undefined && f.after === undefined && f.line === undefined) return '';
  return `<w:spacing${f.before !== undefined ? ` w:before="${Math.round(f.before * 20)}"` : ''}${f.after !== undefined ? ` w:after="${Math.round(f.after * 20)}"` : ''}${f.line !== undefined ? ` w:line="${Math.round(f.line * 240)}" w:lineRule="auto"` : ''}/>`;
}
/** The run properties of a style or format: font, bold, italic, colour, size (each in the schema's order). */
export function rprParts(f: ParaFormat): { fonts: string; b: string; i: string; color: string; sz: string } {
  const c = f.colour !== undefined ? wordColour(f.colour) : '';
  return {
    fonts: f.font ? `<w:rFonts w:ascii="${WORD_FONT[f.font]}" w:hAnsi="${WORD_FONT[f.font]}" w:cs="${WORD_FONT[f.font]}"/>` : '',
    b: f.bold === undefined ? '' : f.bold ? '<w:b/>' : '<w:b w:val="0"/>',
    i: f.italic === undefined ? '' : f.italic ? '<w:i/>' : '<w:i w:val="0"/>',
    color: f.colour === undefined ? '' : `<w:color w:val="${c || 'auto'}"/>`,
    sz: f.size !== undefined ? `<w:sz w:val="${half(f.size)}"/><w:szCs w:val="${half(f.size)}"/>` : '',
  };
}
export const rprXml = (f: ParaFormat): string => {
  const p = rprParts(f);
  const inner = `${p.fonts}${p.b}${p.i}${p.color}${p.sz}`;
  return inner ? `<w:rPr>${inner}</w:rPr>` : '';
};

/** Our seven styles as Word's w:style entries (every value written out, so any reader sees the same look). */
export function stylesXml(d: Pick<Doc, 'styles'>): string {
  return STYLE_IDS.map((id) => {
    const s = styleOf(d, id);
    const w = WORD_STYLE[id];
    const head = id === 'h1' || id === 'h2' || id === 'h3';
    const ppr = `<w:pPr>${head ? '<w:keepNext/>' : ''}${spacingXml(s)}${id === 'quote' ? '<w:ind w:left="567"/>' : ''}${head ? `<w:outlineLvl w:val="${Number(id[1]) - 1}"/>` : ''}</w:pPr>`;
    return `<w:style w:type="paragraph"${id === 'p' ? ' w:default="1"' : ''} w:styleId="${w.id}"><w:name w:val="${w.name}"/>${id === 'p' ? '' : '<w:basedOn w:val="Normal"/>'}${head || id === 'title' ? '<w:next w:val="Normal"/>' : ''}<w:qFormat/>${ppr}${rprXml(s)}</w:style>`;
  }).join('');
}

interface RawProps {
  font?: string;
  size?: number;
  colour?: string;
  bold?: boolean;
  italic?: boolean;
  line?: number;
  before?: number;
  after?: number;
}
const attrOf = (tag: string, name: string): string | undefined => new RegExp(`\\bw:${name}="([^"]*)"`).exec(tag)?.[1];
const onVal = (tag: string): boolean => !/w:val="(?:0|false|off|none)"/.test(tag);
/** The look one w:pPr / w:rPr pair says (any of its values left out). */
export function propsOf(xml: string): RawProps {
  const out: RawProps = {};
  const rpr = /<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/.exec(xml)?.[1] ?? '';
  const ppr = /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/.exec(xml.replace(/<w:rPr\b[\s\S]*?<\/w:rPr>/g, ''))?.[1] ?? '';
  const fonts = /<w:rFonts\b[^>]*>/.exec(rpr)?.[0];
  if (fonts) {
    const f = attrOf(fonts, 'ascii') ?? attrOf(fonts, 'hAnsi');
    if (f) out.font = f;
  }
  const sz = /<w:sz\b[^>]*>/.exec(rpr)?.[0];
  if (sz && attrOf(sz, 'val')) out.size = Number(attrOf(sz, 'val')) / 2;
  const col = /<w:color\b[^>]*>/.exec(rpr)?.[0];
  if (col && attrOf(col, 'val')) out.colour = attrOf(col, 'val');
  const b = /<w:b(?:\s[^>]*)?\/?>/.exec(rpr)?.[0];
  if (b) out.bold = onVal(b);
  const i = /<w:i(?:\s[^>]*)?\/?>/.exec(rpr)?.[0];
  if (i) out.italic = onVal(i);
  const sp = /<w:spacing\b[^>]*>/.exec(ppr)?.[0];
  if (sp) {
    const be = attrOf(sp, 'before');
    const af = attrOf(sp, 'after');
    const ln = attrOf(sp, 'line');
    if (be !== undefined) out.before = Number(be) / 20;
    if (af !== undefined) out.after = Number(af) / 20;
    if (ln !== undefined && (attrOf(sp, 'lineRule') ?? 'auto') === 'auto') out.line = Math.round((Number(ln) / 240) * 100) / 100;
  }
  return out;
}
/** Raw Word values as our format (only what is said). */
export function formatOf(p: RawProps): ParaFormat {
  const out: ParaFormat = {};
  if (p.font) out.font = fontFromWord(p.font);
  if (p.size && Number.isFinite(p.size)) out.size = p.size;
  if (p.colour !== undefined) out.colour = p.colour === 'auto' ? 'ink' : colourFromWord(p.colour);
  if (p.bold !== undefined) out.bold = p.bold;
  if (p.italic !== undefined) out.italic = p.italic;
  if (p.line && Number.isFinite(p.line)) out.line = p.line;
  if (p.before !== undefined && Number.isFinite(p.before)) out.before = p.before;
  if (p.after !== undefined && Number.isFinite(p.after)) out.after = p.after;
  return out;
}

/** Which of ours a Word style is, by its id or its name ("heading 1", "Title", "Caption", "Quote"). */
export function ourStyle(id: string, name: string): StyleId | null {
  const n = name.toLowerCase();
  if (id === 'Normal' || n === 'normal') return 'p';
  if (id === 'Title' || n === 'title') return 'title';
  const h = /^heading ?(\d)$/i.exec(n) ?? /^heading(\d)$/i.exec(id);
  if (h && Number(h[1]) <= 3) return `h${h[1]}` as StyleId;
  if (n === 'quote' || id === 'Quote') return 'quote';
  if (n === 'caption' || id === 'Caption') return 'caption';
  return null;
}

/**
 * The document's styles as a styles.xml says them (ours or anyone's: a style's values come through its basedOn chain and the
 * document defaults); only what differs from our defaults is kept.
 */
export function stylesFromXml(xml: string): Partial<Record<StyleId, ParaFormat>> {
  const defs = /<w:docDefaults\b[\s\S]*?<\/w:docDefaults>/.exec(xml)?.[0] ?? '';
  const defaults: RawProps = { ...propsOf(/<w:rPrDefault\b[\s\S]*?<\/w:rPrDefault>/.exec(defs)?.[0] ?? ''), ...propsOf((/<w:pPrDefault\b[\s\S]*?<\/w:pPrDefault>/.exec(defs)?.[0] ?? '').replace(/<w:pPrDefault>/, '')) };
  const all = new Map<string, { name: string; basedOn: string; own: RawProps }>();
  for (const m of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    if (!/w:type="paragraph"/.test(m[1]!)) continue;
    const id = attrOf(m[1]!, 'styleId') ?? '';
    const name = attrOf(/<w:name\b[^>]*>/.exec(m[2]!)?.[0] ?? '', 'val') ?? '';
    const basedOn = attrOf(/<w:basedOn\b[^>]*>/.exec(m[2]!)?.[0] ?? '', 'val') ?? '';
    all.set(id, { name, basedOn, own: propsOf(m[2]!) });
  }
  const resolved = (id: string, depth = 0): RawProps => {
    const s = all.get(id);
    if (!s || depth > 8) return { ...defaults };
    return { ...resolved(s.basedOn, depth + 1), ...s.own };
  };
  const out: Partial<Record<StyleId, ParaFormat>> = {};
  for (const [id, s] of all) {
    const ours = ourStyle(id, s.name);
    if (!ours || out[ours]) continue;
    const look = clampStyle({ ...DEFAULT_STYLES[ours], ...formatOf(resolved(id)) });
    const kept = diffStyle(ours, look);
    if (Object.keys(kept).length) out[ours] = kept;
  }
  return out;
}
