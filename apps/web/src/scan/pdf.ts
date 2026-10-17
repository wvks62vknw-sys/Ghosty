/**
 * A minimal PDF writer for scanned pages: one JPEG per page, drawn to fill an A4 page (keeping
 * its shape, centred), nothing else. JPEG goes into a PDF as it is (/DCTDecode), so a page costs
 * its JPEG's bytes and no library is needed. Browsers make three-colour JPEGs (even of a grey
 * page), so every picture is declared RGB. The cross-reference table gives every object's exact
 * byte offset, as readers require.
 */

export interface PdfPage {
  /** The page picture as JPEG bytes. */
  jpeg: Uint8Array;
  /** Its size in pixels. */
  w: number;
  h: number;
}

/** A4 in PDF points (1/72 inch). */
export const A4 = { w: 595.28, h: 841.89 } as const;

const enc = new TextEncoder();
const num = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Where the picture sits on the page: as big as fits inside a margin, centred. */
export function placeOnPage(w: number, h: number, page: { w: number; h: number } = A4, margin = 0): { x: number; y: number; w: number; h: number } {
  const k = Math.min((page.w - 2 * margin) / w, (page.h - 2 * margin) / h);
  const dw = w * k;
  const dh = h * k;
  return { x: (page.w - dw) / 2, y: (page.h - dh) / 2, w: dw, h: dh };
}

/** The PDF file's bytes for these pages (at least one). */
export function makePdf(pages: PdfPage[], opts: { title?: string } = {}): Uint8Array {
  if (!pages.length) throw new Error('A PDF needs at least one page');
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (b: Uint8Array) => {
    parts.push(b);
    size += b.length;
  };
  const text = (s: string) => push(enc.encode(s));
  /** Object n starts here: its offset is noted for the cross-reference table. */
  const begin = (n: number) => {
    offsets[n] = size;
    text(`${n} 0 obj\n`);
  };

  // Objects: 1 catalog, 2 page tree, 3 info, then for page i: 4+3i page, 5+3i contents, 6+3i image.
  const pageObj = (i: number) => 4 + 3 * i;
  const count = 3 + 3 * pages.length;
  // The header, and a comment of high bytes so tools treat the file as binary.
  push(new Uint8Array([...enc.encode('%PDF-1.4\n%'), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  begin(1);
  text('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  begin(2);
  text(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`);
  begin(3);
  const title = (opts.title ?? 'Scan').replace(/[^\x20-\x7e]/g, '').replace(/[\\()]/g, (c) => `\\${c}`).slice(0, 120);
  text(`<< /Title (${title}) /Producer (Ghosty) >>\nendobj\n`);

  pages.forEach((p, i) => {
    // A landscape picture gets a landscape page.
    const sheet = p.w > p.h ? { w: A4.h, h: A4.w } : A4;
    const at = placeOnPage(p.w, p.h, sheet);
    const content = `q ${num(at.w)} 0 0 ${num(at.h)} ${num(at.x)} ${num(at.y)} cm /Im0 Do Q\n`;
    begin(pageObj(i));
    text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(sheet.w)} ${num(sheet.h)}] /Resources << /XObject << /Im0 ${pageObj(i) + 2} 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>\nendobj\n`);
    begin(pageObj(i) + 1);
    text(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
    begin(pageObj(i) + 2);
    text(`<< /Type /XObject /Subtype /Image /Width ${Math.round(p.w)} /Height ${Math.round(p.h)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    text('\nendstream\nendobj\n');
  });

  const xref = size;
  // Each entry is exactly 20 bytes: 10-digit offset, space, 5-digit generation, space, n/f, CR LF.
  let table = `xref\n0 ${count + 1}\n0000000000 65535 f\r\n`;
  for (let n = 1; n <= count; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n\r\n`;
  text(table);
  text(`trailer\n<< /Size ${count + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let o = 0;
  for (const b of parts) {
    out.set(b, o);
    o += b.length;
  }
  return out;
}
