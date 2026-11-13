/**
 * OUR OWN POWERPOINT WRITER (BRIEF-EDITOR-PRESENTATIONS): a deck as a .pptx, a zip of XML parts written here over convert/zip.ts, no
 * library: [Content_Types].xml, the relationships, the presentation (its slide list and size), one slide master with the deck's theme
 * (theme1.xml: its ground, ink, accent and sequence as the colour scheme, Arial as the fonts), one slide layout for each layout the
 * deck uses, a slide for each slide with its title, text, picture (JPEG, in media), table, shapes and a picture or table in its own
 * box, a notes slide for each slide that has notes (with the notes master PowerPoint wants), and the document's title and dates.
 * A chart is not written as a chart part: its numbers are a table on the slide (marked, so this app's own reader makes the chart
 * again), and it lives in the PDF as a picture; animations and transitions are not carried: the export sheet says so once.
 * Read back by pptxread.ts and, in the tests, by a parser that is not ours.
 */
import { textOf, type Block, type Run } from '../docs/model';
import { zipStore } from '../convert/zip';
import { boxes, setText, styleOf, approx, type Measure, type Rect } from './layout';
import { H, W, SLOTS, type Deck, type Layout, type Shape, type Slide } from './model';
import { paletteOf } from './render';
import { rgb, type Palette } from './themes';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
};
const NSD = `xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`;
const REL = NS.r;
const RELP = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument.presentationml';
export const EMU = 9525;
// eslint-disable-next-line no-control-regex
const x = (s: string): string => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const e = (px: number): number => Math.round(px * EMU);
const xfrm = (r: Rect, tag = 'a:xfrm'): string => `<${tag}><a:off x="${e(r.x)}" y="${e(r.y)}"/><a:ext cx="${e(r.w)}" cy="${e(r.h)}"/></${tag}>`;
const safeHref = (u: string) => (/^(?:https?:|mailto:|tel:)/i.test(u.trim()) ? u.trim() : '');

/** The layout names and types a slide layout is written as. The name carries our own layout's name so this app reads it back exactly. */
export const PPT_LAYOUT: Record<Layout, { type: string; name: string }> = {
  title: { type: 'title', name: 'Ghosty title' },
  section: { type: 'secHead', name: 'Ghosty section' },
  bullets: { type: 'obj', name: 'Ghosty bullets' },
  two: { type: 'twoObj', name: 'Ghosty two' },
  picture: { type: 'picTx', name: 'Ghosty picture' },
  chart: { type: 'titleOnly', name: 'Ghosty chart' },
  table: { type: 'tbl', name: 'Ghosty table' },
  quote: { type: 'obj', name: 'Ghosty quote' },
  blank: { type: 'blank', name: 'Ghosty blank' },
};

const blend = (a: string, b: string, k: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0').toUpperCase();
};
const lum = (c: string): number => {
  const n = parseInt(c.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

/** The theme part: the deck's ground, ink, plate, accent and sequence as Office's colour scheme, Arial for fonts. */
export function themeXml(pal: Palette, name: string): string {
  const darkFirst = lum(pal.ground) <= lum(pal.ink);
  const dk1 = darkFirst ? pal.ground : pal.ink;
  const lt1 = darkFirst ? pal.ink : pal.ground;
  const dk2 = pal.dark ? pal.plate : pal.ink2;
  const lt2 = pal.dark ? pal.ink2 : pal.plate;
  const c = (tag: string, v: string) => `<a:${tag}><a:srgbClr val="${rgb(v)}"/></a:${tag}>`;
  const fill3 = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3);
  const ln3 = '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3);
  const font = '<a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/>';
  return `${XML}<a:theme xmlns:a="${NS.a}" name="${x(name)}"><a:themeElements><a:clrScheme name="${x(name)}">${c('dk1', dk1)}${c('lt1', lt1)}${c('dk2', dk2)}${c('lt2', lt2)}${pal.seq.map((v, i) => c(`accent${i + 1}`, v)).join('')}${c('accent6', pal.ink2)}${c('hlink', pal.accent)}${c('folHlink', pal.ink2)}</a:clrScheme><a:fontScheme name="${x(name)}"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme><a:fmtScheme name="Ghosty"><a:fillStyleLst>${fill3}</a:fillStyleLst><a:lnStyleLst>${ln3}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill3}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
}
/** Which of bg1, tx1 (and the second pair) are the dark colour of the scheme above. */
const clrMap = (pal: Palette): string => {
  const darkFirst = lum(pal.ground) <= lum(pal.ink);
  return `<p:clrMap bg1="${darkFirst ? 'dk1' : 'lt1'}" tx1="${darkFirst ? 'lt1' : 'dk1'}" bg2="${pal.dark ? 'dk2' : 'lt2'}" tx2="${pal.dark ? 'lt2' : 'dk2'}" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`;
};

const grp = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

interface Ctx {
  rels: string[];
  rid: number;
  links: Map<string, string>;
  next: number;
  media: { name: string; data: Uint8Array }[];
  mediaOf: Map<string, string>;
  pal: Palette;
}
const relId = (c: Ctx, type: string, target: string, external = false): string => {
  const id = `rId${++c.rid}`;
  c.rels.push(`<Relationship Id="${id}" Type="${REL}/${type}" Target="${x(target)}"${external ? ' TargetMode="External"' : ''}/>`);
  return id;
};

const rPr = (size: number, r: Run, c: Ctx, o: { bold?: boolean; italic?: boolean; accent?: boolean; tag?: string } = {}): string => {
  const href = r.href ? safeHref(r.href) : '';
  let id = '';
  if (href) {
    id = c.links.get(href) ?? '';
    if (!id) {
      id = relId(c, 'hyperlink', href, true);
      c.links.set(href, id);
    }
  }
  const fill = href ? '' : `<a:solidFill><a:schemeClr val="${o.accent ? 'accent1' : 'tx1'}"/></a:solidFill>`;
  return `<a:${o.tag ?? 'rPr'} lang="en-GB" sz="${Math.round(size * 75)}"${r.b || o.bold ? ' b="1"' : ''}${r.i || o.italic ? ' i="1"' : ''}${r.u && !href ? ' u="sng"' : ''} dirty="0">${fill}<a:latin typeface="Arial"/><a:cs typeface="Arial"/>${id ? `<a:hlinkClick r:id="${id}"/>` : ''}</a:${o.tag ?? 'rPr'}>`;
};

/** The paragraphs of some blocks, as a txBody's content, set at the size the layout fits them to. */
function paragraphs(blocks: Block[], size: number, align: 'left' | 'center', c: Ctx, o: { bold?: boolean; italic?: boolean; accent?: boolean }): string {
  const live = blocks.filter((b) => textOf(b).trim());
  if (!live.length) return `<a:p><a:endParaRPr lang="en-GB" sz="${Math.round(size * 75)}"/></a:p>`;
  let n = 0;
  return live
    .map((b, i) => {
      const list = b.t === 'ul' || b.t === 'ol';
      const ind = e(size * 0.95);
      n = b.t === 'ol' ? (live[i - 1]?.t === 'ol' ? n + 1 : 1) : 0;
      const al = b.t === 'right' ? 'r' : align === 'center' ? 'ctr' : 'l';
      const bu =
        b.t === 'ul'
          ? `<a:buClr><a:schemeClr val="accent1"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>`
          : b.t === 'ol'
            ? `<a:buClr><a:schemeClr val="accent1"/></a:buClr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"${n === 1 ? '' : ` startAt="${n}"`}/>`
            : '<a:buNone/>';
      const head = b.t === 'h1' || b.t === 'h2' || b.t === 'h3';
      const opts = { ...o, bold: o.bold || head, italic: o.italic || b.t === 'quote' };
      const runs = b.runs
        .filter((r) => r.text)
        .map((r) =>
          r.text
            .split('\n')
            .map((line, k) => `${k ? `<a:br>${rPr(size, r, c, { ...opts, tag: 'rPr' })}</a:br>` : ''}${line ? `<a:r>${rPr(size, r, c, opts)}<a:t>${x(line)}</a:t></a:r>` : ''}`)
            .join(''),
        )
        .join('');
      return `<a:p><a:pPr marL="${list ? ind : 0}" indent="${list ? -ind : 0}" algn="${al}">${i ? '<a:spcBef><a:spcPts val="600"/></a:spcBef>' : ''}${bu}</a:pPr>${runs}</a:p>`;
    })
    .join('');
}

const anchorOf = (a: 't' | 'm' | 'b') => (a === 'm' ? 'ctr' : a);

function textSp(c: Ctx, name: string, ph: string, box: Rect, blocks: Block[], layout: Layout, key: 'title' | 'body' | 'body2', deck: Deck, measure: Measure): string {
  const st = styleOf(layout, key, deck);
  const size = Math.round(setText(blocks, box, st, measure).size);
  const id = ++c.next;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${x(name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${xfrm(box)}</p:spPr><p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchorOf(st.anchor)}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs(blocks, size, st.align, c, { bold: st.bold, italic: st.italic, accent: st.accent && key === 'title' })}</p:txBody></p:sp>`;
}

const cellXml = (runs: Run[], size: number, head: boolean, fill: string | null, c: Ctx): string => {
  const live = runs.filter((r) => r.text);
  const body = live.length
    ? `<a:p><a:pPr algn="l"><a:buNone/></a:pPr>${live.map((r) => `<a:r>${rPr(size, r, c, { bold: head })}<a:t>${x(r.text.replace(/\n/g, ' '))}</a:t></a:r>`).join('')}</a:p>`
    : `<a:p><a:endParaRPr lang="en-GB" sz="${Math.round(size * 75)}"/></a:p>`;
  const lnB = `<a:lnB w="12700"><a:solidFill><a:schemeClr val="tx1"><a:alpha val="30000"/></a:schemeClr></a:solidFill></a:lnB>`;
  return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${body}</a:txBody><a:tcPr marL="${e(12)}" marR="${e(12)}" marT="${e(4)}" marB="${e(4)}" anchor="ctr"><a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="0"><a:noFill/></a:lnT>${lnB}${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}</a:tcPr></a:tc>`;
};

function tableFrame(c: Ctx, name: string, descr: string, box: Rect, rows: Run[][][], head: boolean): string {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const cw = Math.floor(e(box.w) / cols);
  const rh = Math.min(76, box.h / Math.max(1, rows.length));
  const size = Math.max(15, Math.min(26, rh * 0.42, box.w / cols / 7));
  const headFill = blend(c.pal.ground, c.pal.accent, 0.28);
  const id = ++c.next;
  const trs = rows
    .map((r, ri) => `<a:tr h="${e(rh)}">${Array.from({ length: cols }, (_, ci) => cellXml(r[ci] ?? [], Math.round(size), head && ri === 0, head && ri === 0 ? headFill : null, c)).join('')}</a:tr>`)
    .join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${x(name)}" descr="${x(descr)}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>${xfrm({ ...box, h: rh * rows.length }, 'p:xfrm')}<a:graphic><a:graphicData uri="${NS.a}/table"><a:tbl><a:tblPr${head ? ' firstRow="1"' : ''}/><a:tblGrid>${Array.from({ length: cols }, () => `<a:gridCol w="${cw}"/>`).join('')}</a:tblGrid>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

const SHAPE_PRST: Record<Shape['kind'], string> = { rect: 'rect', round: 'roundRect', ellipse: 'ellipse', arrow: 'rightArrow', line: 'line' };
function shapeSp(c: Ctx, sh: Shape, n: number): string {
  const id = ++c.next;
  const acc = `accent${(sh.fill % 5) + 1}`;
  const geom = `<a:prstGeom prst="${SHAPE_PRST[sh.kind]}"><a:avLst/></a:prstGeom>`;
  const body = sh.kind === 'line' ? `<a:ln w="${e(6)}" cap="rnd"><a:solidFill><a:schemeClr val="${acc}"/></a:solidFill></a:ln>` : `<a:solidFill><a:schemeClr val="${acc}"/></a:solidFill><a:ln><a:noFill/></a:ln>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${n}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(sh)}${geom}${body}</p:spPr></p:sp>`;
}

/** The chart's numbers as the rows of a table, each value written plain so it reads back exactly. */
export function chartRows(ch: { points: { label: string; value: number }[]; unit: string; before: boolean }): Run[][][] {
  return ch.points.map((p) => [[{ text: p.label }], [{ text: ch.before ? `${ch.unit}${p.value}` : ch.unit ? `${p.value}${/^[%°]/.test(ch.unit) ? '' : ' '}${ch.unit}` : String(p.value) }]]);
}
export const chartTag = (ch: { kind: string; unit: string; before: boolean }): string => `ghosty-chart|${ch.kind}|${ch.unit}|${ch.before ? 1 : 0}`;

function slideXml(deck: Deck, s: Slide, c: Ctx, measure: Measure, image: (id: string) => Uint8Array | null): string {
  const bx = boxes(s);
  const L = s.layout;
  const shapes: string[] = [];
  const slots = SLOTS[L];
  if (slots.title && bx.title) shapes.push(textSp(c, 'Title', `<p:ph type="${L === 'title' ? 'ctrTitle' : 'title'}"/>`, bx.title, [s.title], L, 'title', deck, measure));
  if (slots.body && bx.body) shapes.push(textSp(c, L === 'title' ? 'Subtitle' : 'Text', `<p:ph ${L === 'title' ? 'type="subTitle" ' : ''}idx="1"/>`, bx.body, s.body, L, 'body', deck, measure));
  if (slots.body2 && bx.body2) shapes.push(textSp(c, 'Right column', '<p:ph idx="2"/>', bx.body2, s.body2, L, 'body2', deck, measure));
  const md = s.media;
  if (md && bx.media) {
    const b = bx.media;
    if (md.k === 'img') {
      const bytes = image(md.img);
      if (bytes) {
        let name = c.mediaOf.get(md.img);
        if (!name) {
          name = `image${c.mediaOf.size + 1}.jpeg`;
          c.mediaOf.set(md.img, name);
          c.media.push({ name, data: bytes });
        }
        const rid = relId(c, 'image', `../media/${name}`);
        const k = Math.min(b.w / md.iw, b.h / md.ih);
        const w = md.iw * k;
        const h = md.ih * k;
        const id = ++c.next;
        shapes.push(`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}" descr="${x(md.alt)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm({ x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h })}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
      }
    } else if (md.k === 'table') shapes.push(tableFrame(c, 'Table', '', b, md.table.rows ?? [], !!md.table.head));
    else if (md.chart.points.length) shapes.push(tableFrame(c, 'Chart numbers', chartTag(md.chart), b, chartRows(md.chart), false));
  }
  s.shapes.forEach((sh, i) => shapes.push(shapeSp(c, sh, i + 1)));
  return `${XML}<p:sld ${NSD}><p:cSld><p:spTree>${grp}${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

/** A layout part: its placeholders in the places the layout puts them. */
function layoutXml(L: Layout, deck: Deck): string {
  const t = PPT_LAYOUT[L];
  const probe: Slide = { id: 'p', layout: L, title: { id: 't', t: 'h1', runs: [] }, body: [], body2: [], shapes: [], notes: '', transition: 'none', builds: [] };
  const bx = boxes(probe);
  const slots = SLOTS[L];
  let n = 1;
  const ph = (name: string, spec: string, r: Rect) => `<p:sp><p:nvSpPr><p:cNvPr id="${++n}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph ${spec}/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(r)}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody></p:sp>`;
  const sp: string[] = [];
  if (slots.title && bx.title) sp.push(ph('Title', `type="${L === 'title' ? 'ctrTitle' : 'title'}"`, bx.title));
  if (slots.body && bx.body) sp.push(ph(L === 'title' ? 'Subtitle' : 'Text', `${L === 'title' ? 'type="subTitle" ' : ''}idx="1"`, bx.body));
  if (slots.body2 && bx.body2) sp.push(ph('Right column', 'idx="2"', bx.body2));
  void deck;
  return `${XML}<p:sldLayout ${NSD} type="${t.type}" preserve="1"><p:cSld name="${t.name}"><p:spTree>${grp}${sp.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function masterXml(pal: Palette, layoutIds: number[]): string {
  const title: Rect = { x: 72, y: 40, w: W - 144, h: 104 };
  const body: Rect = { x: 72, y: 168, w: W - 144, h: 492 };
  const sp = (id: number, name: string, ph: string, r: Rect) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph ${ph}/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(r)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody></p:sp>`;
  const lvl = (n: number, bu: string, sz: number) => `<a:lvl${n}pPr marL="${342900 * n}" indent="-342900" algn="l"><a:buClr><a:schemeClr val="accent1"/></a:buClr><a:buFont typeface="Arial"/>${bu}<a:defRPr sz="${sz}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl${n}pPr>`;
  return `${XML}<p:sldMaster ${NSD}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${grp}${sp(2, 'Title', 'type="title"', title)}${sp(3, 'Text', 'type="body" idx="1"', body)}</p:spTree></p:cSld>${clrMap(pal)}<p:sldLayoutIdLst>${layoutIds.map((id, i) => `<p:sldLayoutId id="${id}" r:id="rId${i + 1}"/>`).join('')}</p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3300" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle>${lvl(1, '<a:buChar char="•"/>', 2400)}${lvl(2, '<a:buChar char="–"/>', 2000)}</p:bodyStyle><p:otherStyle><a:lvl1pPr algn="l"><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
}

const notesMasterXml = (pal: Palette): string =>
  `${XML}<p:notesMaster ${NSD}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${grp}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:srgbClr val="${rgb(pal.ink2)}"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>`;

const notesXml = (text: string): string => {
  const paras = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => (l ? `<a:p><a:r><a:rPr lang="en-GB" dirty="0"/><a:t>${x(l)}</a:t></a:r></a:p>` : '<a:p><a:endParaRPr lang="en-GB"/></a:p>'))
    .join('');
  return `${XML}<p:notes ${NSD}><p:cSld><p:spTree>${grp}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
};

export interface PptxOpts {
  author?: string;
  /** A picture's JPEG bytes by its id. */
  image?: (id: string) => Uint8Array | null;
  /** The width of text (the phone's canvas); a plain estimate when left out. */
  measure?: Measure;
}

/** The deck as a .pptx file's bytes. */
export function writePptx(deck: Deck, o: PptxOpts = {}): Uint8Array {
  const pal = paletteOf(deck);
  const measure = o.measure ?? approx;
  const image = o.image ?? (() => null);
  const files: { name: string; data: string | Uint8Array }[] = [];
  const over: [string, string][] = [];
  const used: Layout[] = [];
  for (const s of deck.slides) if (!used.includes(s.layout)) used.push(s.layout);
  if (!used.length) used.push('blank');
  const layoutNo = (L: Layout) => used.indexOf(L) + 1;
  const media: { name: string; data: Uint8Array }[] = [];
  const mediaOf = new Map<string, string>();
  const notesFor: number[] = [];

  deck.slides.forEach((s, i) => {
    const c: Ctx = { rels: [], rid: 0, links: new Map(), next: 1, media, mediaOf, pal };
    relId(c, 'slideLayout', `../slideLayouts/slideLayout${layoutNo(s.layout)}.xml`);
    const xml = slideXml(deck, s, c, measure, image);
    if (s.notes.trim()) {
      relId(c, 'notesSlide', `../notesSlides/notesSlide${i + 1}.xml`);
      notesFor.push(i + 1);
      files.push({ name: `ppt/notesSlides/notesSlide${i + 1}.xml`, data: notesXml(s.notes) });
      files.push({ name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, data: `${XML}<Relationships xmlns="${RELP}"><Relationship Id="rId1" Type="${REL}/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="${REL}/slide" Target="../slides/slide${i + 1}.xml"/></Relationships>` });
      over.push([`/ppt/notesSlides/notesSlide${i + 1}.xml`, `${CT}.notesSlide+xml`]);
    }
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: xml });
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: `${XML}<Relationships xmlns="${RELP}">${c.rels.join('')}</Relationships>` });
    over.push([`/ppt/slides/slide${i + 1}.xml`, `${CT}.slide+xml`]);
  });

  used.forEach((L, i) => {
    files.push({ name: `ppt/slideLayouts/slideLayout${i + 1}.xml`, data: layoutXml(L, deck) });
    files.push({ name: `ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, data: `${XML}<Relationships xmlns="${RELP}"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` });
    over.push([`/ppt/slideLayouts/slideLayout${i + 1}.xml`, `${CT}.slideLayout+xml`]);
  });
  const layoutIds = used.map((_, i) => 2147483649 + i);
  files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: masterXml(pal, layoutIds) });
  files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: `${XML}<Relationships xmlns="${RELP}">${used.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${i + 1}.xml"/>`).join('')}<Relationship Id="rId${used.length + 1}" Type="${REL}/theme" Target="../theme/theme1.xml"/></Relationships>` });
  over.push(['/ppt/slideMasters/slideMaster1.xml', `${CT}.slideMaster+xml`]);
  files.push({ name: 'ppt/theme/theme1.xml', data: themeXml(pal, deck.title || 'Ghosty') });
  over.push(['/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml']);
  if (notesFor.length) {
    files.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: notesMasterXml(pal) });
    files.push({ name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: `${XML}<Relationships xmlns="${RELP}"><Relationship Id="rId1" Type="${REL}/theme" Target="../theme/theme2.xml"/></Relationships>` });
    files.push({ name: 'ppt/theme/theme2.xml', data: themeXml({ ...pal, ground: '#ffffff', ink: '#000000', dark: false }, 'Notes') });
    over.push(['/ppt/notesMasters/notesMaster1.xml', `${CT}.notesMaster+xml`], ['/ppt/theme/theme2.xml', 'application/vnd.openxmlformats-officedocument.theme+xml']);
  }

  // the presentation
  const n = deck.slides.length;
  const rels: string[] = [`<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`];
  deck.slides.forEach((_, i) => rels.push(`<Relationship Id="rId${i + 2}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`));
  let r = n + 2;
  const notesRid = notesFor.length ? `rId${r++}` : '';
  if (notesRid) rels.push(`<Relationship Id="${notesRid}" Type="${REL}/notesMaster" Target="notesMasters/notesMaster1.xml"/>`);
  rels.push(`<Relationship Id="rId${r++}" Type="${REL}/presProps" Target="presProps.xml"/>`, `<Relationship Id="rId${r++}" Type="${REL}/viewProps" Target="viewProps.xml"/>`, `<Relationship Id="rId${r++}" Type="${REL}/theme" Target="theme/theme1.xml"/>`, `<Relationship Id="rId${r++}" Type="${REL}/tableStyles" Target="tableStyles.xml"/>`);
  const presentation = `${XML}<p:presentation ${NSD} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>${notesRid ? `<p:notesMasterIdLst><p:notesMasterId r:id="${notesRid}"/></p:notesMasterIdLst>` : ''}<p:sldIdLst>${deck.slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${W * EMU}" cy="${H * EMU}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  over.push(['/ppt/presentation.xml', `${CT}.presentation.main+xml`], ['/ppt/presProps.xml', `${CT}.presProps+xml`], ['/ppt/viewProps.xml', `${CT}.viewProps+xml`], ['/ppt/tableStyles.xml', `${CT}.tableStyles+xml`]);

  const when = new Date(deck.at || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(deck.title)}</dc:title>${o.author ? `<dc:creator>${x(o.author)}</dc:creator>` : ''}<dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified></cp:coreProperties>`;
  over.push(['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml']);

  const types = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/>${over.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('')}</Types>`;
  return zipStore([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: `${XML}<Relationships xmlns="${RELP}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="${RELP}/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: core },
    { name: 'ppt/presentation.xml', data: presentation },
    { name: 'ppt/_rels/presentation.xml.rels', data: `${XML}<Relationships xmlns="${RELP}">${rels.join('')}</Relationships>` },
    { name: 'ppt/presProps.xml', data: `${XML}<p:presentationPr ${NSD}/>` },
    { name: 'ppt/viewProps.xml', data: `${XML}<p:viewPr ${NSD}/>` },
    { name: 'ppt/tableStyles.xml', data: `${XML}<a:tblStyleLst xmlns:a="${NS.a}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` },
    ...files,
    ...media.map((m) => ({ name: `ppt/media/${m.name}`, data: m.data })),
  ]);
}
