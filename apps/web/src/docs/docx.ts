/**
 * OUR OWN WORD WRITER (BRIEF-REST-E parts 1 and 2): a document as a .docx — a zip of the few XML parts Word needs
 * (the content types, the relationships, the document, its styles, the numbering of its lists, its title), headings as
 * Word's own Heading styles, bullets and numbered lists as real lists (each numbered list counting from 1), bold and
 * italic, line breaks, a letter's right-hand lines, A4 with 2.5 cm margins, right to left for Urdu or Arabic. Pure.
 */
import { zipStore } from '../convert/zip';
import type { Doc, Run } from './model';

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function runs(rs: Run[], rtl: boolean): string {
  return rs
    .map((r) => {
      const props = `${r.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${rtl ? '<w:rtl/>' : ''}`;
      const pr = props ? `<w:rPr>${props}</w:rPr>` : '';
      return r.text
        .split('\n')
        .map((line, k) => `<w:r>${pr}${k ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`)
        .join('');
    })
    .join('');
}

/** The document as a Word file. */
export function docxFrom(d: Doc, author = ''): Uint8Array {
  const rtl = !!d.rtl;
  const bidi = rtl ? '<w:bidi/>' : '';
  const paras: string[] = [`<w:p><w:pPr><w:pStyle w:val="Title"/>${bidi}</w:pPr>${runs([{ text: d.title }], rtl)}</w:p>`];
  // each numbered list its own numbering, so each counts from 1
  const nums: number[] = [];
  let numId = 1;
  d.blocks.forEach((b, k) => {
    let ppr = '';
    if (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') ppr = `<w:pStyle w:val="Heading${b.t[1]}"/>`;
    else if (b.t === 'quote') ppr = '<w:pStyle w:val="Quote"/>';
    else if (b.t === 'right') ppr = `<w:jc w:val="${rtl ? 'left' : 'right'}"/>`;
    else if (b.t === 'ul') ppr = '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    else if (b.t === 'ol') {
      if (d.blocks[k - 1]?.t !== 'ol') {
        numId = 2 + nums.length;
        nums.push(numId);
      }
      ppr = `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`;
    }
    paras.push(`<w:p><w:pPr>${ppr}${bidi}</w:pPr>${runs(b.runs, rtl)}</w:p>`);
  });
  const document = `${XML}<w:document ${W}><w:body>${paras.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const style = (id: string, name: string, body: string, next = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${next ? `<w:next w:val="${next}"/>` : ''}<w:qFormat/>${body}</w:style>`;
  const heading = (n: number, size: number) => style(`Heading${n}`, `heading ${n}`, `<w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`, 'Normal');
  const styles = `${XML}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Arial"/><w:sz w:val="23"/><w:szCs w:val="23"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${style('Title', 'Title', '<w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>', 'Normal')}${heading(1, 32)}${heading(2, 27)}${heading(3, 24)}${style('Quote', 'Quote', '<w:pPr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/><w:color w:val="444444"/></w:rPr>')}${style('ListParagraph', 'List Paragraph', '<w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr>')}</w:styles>`;
  const level = (fmt: string, text: string) => `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>`;
  const numbering = `${XML}<w:numbering ${W}><w:abstractNum w:abstractNumId="0">${level('bullet', '•')}</w:abstractNum><w:abstractNum w:abstractNumId="1">${level('decimal', '%1.')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums.map((n) => `<w:num w:numId="${n}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')}</w:numbering>`;
  const now = new Date(d.at || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(d.title)}</dc:title>${author ? `<dc:creator>${x(author)}</dc:creator>` : ''}<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipStore([
    {
      name: '[Content_Types].xml',
      data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    },
    { name: '_rels/.rels', data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/></Relationships>` },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/numbering.xml', data: numbering },
    { name: 'docProps/core.xml', data: core },
  ]);
}
