/**
 * OUR OWN WORD WRITER (BRIEF-REST-E parts 1 and 2, BRIEF-EDITOR-DOCUMENTS): a document as a .docx — a zip of the XML parts Word
 * needs (the content types, the relationships, the document, its styles, the numbering of its lists, its title, a header and a
 * footer), headings as Word's own Heading styles, bullets and numbered lists as real lists (each numbered list counting from 1),
 * bold, italic, underline, links as real hyperlinks, alignment, tables with their rules and a header row, pictures inline with
 * their description, page breaks, the page's size, margins and direction, a footer with "n of N" as Word's own fields, right to
 * left for Urdu or Arabic. Pure: the pictures' bytes come in as a function. Read back by docxread.ts and, in the spec, by a parser
 * that is not ours.
 */
import { zipStore } from '../convert/zip';
import { isColour, pageOf, TEXT_COLOURS, type Align, type Block, type Doc, type Run } from './model';
import { anchorOf, wordParas, type Comment } from './comments';

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
};
const W = `xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"`;
const REL = NS.r;
const RELP = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Page sizes and margins in twentieths of a point (Word's own unit). */
export const PAGE_TWIPS = { a4: { w: 11906, h: 16838 }, letter: { w: 12240, h: 15840 } } as const;
export const MARGIN_TWIPS = { normal: 1418, narrow: 737, wide: 2155 } as const;

const safeHref = (u: string) => (/^(?:https?:|mailto:|tel:)/i.test(u.trim()) ? u.trim() : '');
const JC: Record<Align, string> = { left: 'left', center: 'center', right: 'right', justify: 'both' };

/** The document as a Word file. `imageBytes` gives a picture's JPEG by its id. */
export function docxFrom(d: Doc, author = '', imageBytes: (id: string) => Uint8Array | null = () => null): Uint8Array {
  const rtl = !!d.rtl;
  const bidi = rtl ? '<w:bidi/>' : '';
  const pg = pageOf(d);
  const size = PAGE_TWIPS[pg.size];
  const pw = pg.landscape ? size.h : size.w;
  const ph = pg.landscape ? size.w : size.h;
  const mar = MARGIN_TWIPS[pg.margin];
  const textW = pw - 2 * mar;
  // relationships of document.xml: styles, numbering, then links, pictures, header and footer as they are met
  const rels: string[] = [`<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>`, `<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>`];
  let rid = 2;
  const links = new Map<string, string>();
  const linkId = (href: string) => {
    let id = links.get(href);
    if (!id) {
      id = `rId${++rid}`;
      links.set(href, id);
      rels.push(`<Relationship Id="${id}" Type="${REL}/hyperlink" Target="${x(href)}" TargetMode="External"/>`);
    }
    return id;
  };
  const media: { name: string; data: Uint8Array }[] = [];
  const mediaOf = new Map<string, string>();
  let drawing = 0;

  // (w:rPr's children in the schema's own order, strike before highlight before u, or a strict reader calls the file unreadable)
  const runXml = (r: Run, header = false): string => {
    const href = r.href ? safeHref(r.href) : '';
    const props = `${href ? '<w:rStyle w:val="Hyperlink"/>' : ''}${r.b || header ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${r.s ? '<w:strike/>' : ''}${isColour(r.c) && !href ? `<w:color w:val="${TEXT_COLOURS[r.c].word}"/>` : ''}${r.hl ? '<w:highlight w:val="yellow"/>' : ''}${r.u && !href ? '<w:u w:val="single"/>' : ''}${rtl ? '<w:rtl/>' : ''}`;
    const pr = props ? `<w:rPr>${props}</w:rPr>` : '';
    const body = r.text
      .split('\n')
      .map((line, k) => `<w:r>${pr}${k ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`)
      .join('');
    return href ? `<w:hyperlink r:id="${linkId(href)}" w:history="1">${body}</w:hyperlink>` : body;
  };
  const runs = (rs: Run[], header = false) => rs.map((r) => runXml(r, header)).join('');
  const jc = (a?: Align) => (a && a !== 'left' ? `<w:jc w:val="${JC[a]}"/>` : '');

  const picture = (b: Block): string => {
    const bytes = b.img ? imageBytes(b.img) : null;
    if (!bytes || !b.img) return '';
    let name = mediaOf.get(b.img);
    if (!name) {
      name = `image${mediaOf.size + 1}.jpeg`;
      mediaOf.set(b.img, name);
      media.push({ name, data: bytes });
    }
    const id = `rId${++rid}`;
    rels.push(`<Relationship Id="${id}" Type="${REL}/image" Target="media/${name}"/>`);
    const cx = Math.round(textW * 635 * Math.min(100, Math.max(10, b.w ?? 100)) / 100);
    const cy = Math.round((cx * (b.ih ?? 3)) / (b.iw ?? 4));
    const n = ++drawing;
    return `<w:p><w:pPr>${bidi}${jc(b.align ?? 'center')}</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${x(b.alt ?? '')}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}" descr="${x(b.alt ?? '')}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };

  const table = (b: Block): string => {
    const rows = b.rows ?? [];
    const cols = Math.max(1, ...rows.map((r) => r.length));
    const cw = Math.floor(textW / cols);
    const edge = (n: string) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;
    const trs = rows.map((r, k) => {
      const head = !!b.head && k === 0;
      const cells = Array.from({ length: cols }, (_, c) => r[c] ?? []);
      return `<w:tr>${head ? '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cells
        .map((c) => `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E7E6E6"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:after="40"/>${bidi}</w:pPr>${runs(c, head)}</w:p></w:tc>`)
        .join('')}</w:tr>`;
    });
    return `<w:tbl><w:tblPr><w:tblW w:w="${cw * cols}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(edge).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid>${trs.join('')}</w:tbl><w:p/>`;
  };

  // [editors.u1] comments on words: each paragraph's runs split where a comment starts and ends, marked as Word comments
  const cmts = (d.comments ?? []).map((c) => ({ c, at: anchorOf(d, c) })).filter((x): x is { c: Comment; at: NonNullable<ReturnType<typeof anchorOf>> } => !!x.at);
  const cmtsIn = new Map<string, { n: number; start: number; end: number }[]>();
  cmts.forEach(({ at }, n) => cmtsIn.set(at.block, [...(cmtsIn.get(at.block) ?? []), { n, start: at.start, end: at.end }]));
  const runsMarked = (rs: Run[], list: { n: number; start: number; end: number }[]): string => {
    const cuts = [...new Set(list.flatMap((m) => [m.start, m.end]))].sort((a, b) => a - b);
    const out: string[] = [];
    let pos = 0;
    const marks = (p: number) => {
      for (const m of list) if (m.end === p && m.end > m.start) out.push(`<w:commentRangeEnd w:id="${m.n}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${m.n}"/></w:r>`);
      for (const m of list) if (m.start === p) out.push(`<w:commentRangeStart w:id="${m.n}"/>`);
    };
    marks(0);
    for (const r of rs) {
      let t = r.text;
      let at = pos;
      for (const c of cuts) {
        if (c <= at || c >= pos + r.text.length) continue;
        out.push(runXml({ ...r, text: t.slice(0, c - at) }));
        t = t.slice(c - at);
        at = c;
        marks(c);
      }
      if (t) out.push(runXml({ ...r, text: t }));
      pos += r.text.length;
      if (cuts.includes(pos)) marks(pos);
    }
    return out.join('');
  };
  const paras: string[] = [`<w:p><w:pPr><w:pStyle w:val="Title"/>${bidi}</w:pPr>${runs([{ text: d.title }])}</w:p>`];
  // each numbered list its own numbering, so each counts from 1
  const nums: number[] = [];
  let numId = 1;
  d.blocks.forEach((b, k) => {
    if (b.t === 'pb') return void paras.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    if (b.t === 'img') return void paras.push(picture(b));
    if (b.t === 'table') return void paras.push(table(b));
    let ppr = '';
    if (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') ppr = `<w:pStyle w:val="Heading${b.t[1]}"/>`;
    else if (b.t === 'quote') ppr = '<w:pStyle w:val="Quote"/>';
    else if (b.t === 'ul') ppr = '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    else if (b.t === 'ol') {
      if (d.blocks[k - 1]?.t !== 'ol') {
        numId = 2 + nums.length;
        nums.push(numId);
      }
      ppr = `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`;
    }
    const align = b.t === 'right' ? `<w:jc w:val="${rtl ? 'left' : 'right'}"/>` : jc(b.align);
    // a checklist item: its box drawn as the letter Word and Pages read back (☐ / ☑)
    const box = b.t === 'todo' ? `<w:r><w:t xml:space="preserve">${b.ticked ? '☑' : '☐'} </w:t></w:r>` : '';
    const here = cmtsIn.get(b.id);
    paras.push(`<w:p><w:pPr>${ppr}${bidi}${align}</w:pPr>${box}${here ? runsMarked(b.runs, here) : runs(b.runs)}</w:p>`);
  });

  // the head and the foot of the page
  const parts: { name: string; type: string; data: string }[] = [];
  const field = (code: string) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const small = '<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
  const text = (t: string) => `<w:r>${small}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  let sect = '';
  if (pg.header?.trim()) {
    rels.push(`<Relationship Id="rIdHead" Type="${REL}/header" Target="header1.xml"/>`);
    parts.push({ name: 'word/header1.xml', type: 'header', data: `${XML}<w:hdr ${W}><w:p><w:pPr><w:pStyle w:val="Header"/><w:jc w:val="center"/></w:pPr>${text(pg.header.trim())}</w:p></w:hdr>` });
    sect += '<w:headerReference w:type="default" r:id="rIdHead"/>';
  }
  if (pg.footer?.trim() || pg.numbers) {
    rels.push(`<Relationship Id="rIdFoot" Type="${REL}/footer" Target="footer1.xml"/>`);
    const body = `${pg.footer?.trim() ? text(pg.footer.trim()) : ''}${pg.footer?.trim() && pg.numbers ? text('  ·  ') : ''}${pg.numbers ? `${field('PAGE')}${text(' of ')}${field('NUMPAGES')}` : ''}`;
    parts.push({ name: 'word/footer1.xml', type: 'footer', data: `${XML}<w:ftr ${W}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>${body}</w:p></w:ftr>` });
    sect += '<w:footerReference w:type="default" r:id="rIdFoot"/>';
  }
  if (cmts.length) {
    const who = x(author || 'Me');
    const initials = x((author || 'Me').split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 3).toUpperCase());
    const when = (ms: number) => new Date(ms || d.at || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');
    rels.push(`<Relationship Id="rIdComments" Type="${REL}/comments" Target="comments.xml"/>`);
    parts.push({ name: 'word/comments.xml', type: 'comments', data: `${XML}<w:comments ${W}>${cmts.map(({ c }, n) => `<w:comment w:id="${n}" w:author="${c.author ? x(c.author) : who}" w:date="${when(c.at)}" w:initials="${initials}">${wordParas(c, author || 'Me').map((t, k) => `<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>${k ? '' : '<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>'}<w:r><w:t xml:space="preserve">${x(t)}</w:t></w:r></w:p>`).join('')}</w:comment>`).join('')}</w:comments>` });
  }
  const document = `${XML}<w:document ${W}><w:body>${paras.join('')}<w:sectPr>${sect}<w:pgSz w:w="${pw}" w:h="${ph}"${pg.landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${mar}" w:right="${mar}" w:bottom="${mar}" w:left="${mar}" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const style = (id: string, name: string, body: string, next = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${next ? `<w:next w:val="${next}"/>` : ''}<w:qFormat/>${body}</w:style>`;
  const heading = (n: number, size: number) => style(`Heading${n}`, `heading ${n}`, `<w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`, 'Normal');
  const styles = `${XML}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Arial"/><w:sz w:val="23"/><w:szCs w:val="23"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>${style('Title', 'Title', '<w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>', 'Normal')}${heading(1, 32)}${heading(2, 27)}${heading(3, 24)}${style('Quote', 'Quote', '<w:pPr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/><w:color w:val="444444"/></w:rPr>')}${style('ListParagraph', 'List Paragraph', '<w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr>')}${style('Header', 'header', '<w:pPr><w:spacing w:after="0"/></w:pPr>')}${style('CommentText', 'annotation text', '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>')}<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>${style('Footer', 'footer', '<w:pPr><w:spacing w:after="0"/></w:pPr>')}</w:styles>`;
  const level = (fmt: string, text: string) => `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>`;
  const numbering = `${XML}<w:numbering ${W}><w:abstractNum w:abstractNumId="0">${level('bullet', '•')}</w:abstractNum><w:abstractNum w:abstractNumId="1">${level('decimal', '%1.')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums.map((n) => `<w:num w:numId="${n}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')}</w:numbering>`;
  const now = new Date(d.at || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(d.title)}</dc:title>${author ? `<dc:creator>${x(author)}</dc:creator>` : ''}<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const ct = (name: string, type: string) => `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`;
  return zipStore([
    {
      name: '[Content_Types].xml',
      data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${media.length ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ''}${ct('word/document.xml', 'document.main')}${ct('word/styles.xml', 'styles')}${ct('word/numbering.xml', 'numbering')}${parts.map((p) => ct(p.name, p.type)).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    },
    { name: '_rels/.rels', data: `${XML}<Relationships xmlns="${RELP}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="${RELP}/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `${XML}<Relationships xmlns="${RELP}">${rels.join('')}</Relationships>` },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/numbering.xml', data: numbering },
    ...parts.map((p) => ({ name: p.name, data: p.data })),
    ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.data })),
    { name: 'docProps/core.xml', data: core },
  ]);
}
