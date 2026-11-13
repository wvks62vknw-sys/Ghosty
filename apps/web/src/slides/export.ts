/**
 * A DECK OUT AS PICTURES (BRIEF-EDITOR-PRESENTATIONS): one slide as a PNG for a share, and the deck as a PDF, landscape, one slide a
 * page, with the speaker notes on pages of their own after the slides when he asks. A slide is drawn once (render.ts) and rasterised
 * on the phone's canvas, so every script it can show, the PDF can show; each page is that picture, so the words in a PDF are not
 * selectable (the export sheet says so). The PDF writer is the app's own (convert/pdfwrite.ts). Browser only.
 */
import { jpegImage, writePdf, type PdfPage } from '../convert/pdfwrite';
import { type Deck, type Slide, slideName } from './model';
import { canvasMeasure, FONT, slideSvg } from './render';

export interface DrawKit {
  /** A picture's data address by its id. */
  image: (id: string) => string | null;
}

async function svgImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // (the picture is decoded: the address can go once it has drawn; kept a moment for engines that read it lazily)
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
const toBlob = (c: HTMLCanvasElement, type: string, q?: number): Promise<Blob> => new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('the picture could not be made'))), type, q));

/** One slide drawn on a canvas of this width (16:9). */
export async function slideCanvas(deck: Deck, i: number, kit: DrawKit, width = 1920): Promise<HTMLCanvasElement> {
  const s = deck.slides[i]!;
  const svg = slideSvg(deck, s, { n: i + 1, of: deck.slides.length, image: kit.image, measure: canvasMeasure() });
  const img = await svgImage(svg);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round((width * 9) / 16);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
/** One slide as a PNG. */
export async function slidePng(deck: Deck, i: number, kit: DrawKit): Promise<Blob> {
  return toBlob(await slideCanvas(deck, i, kit), 'image/png');
}

const wrap = (g: CanvasRenderingContext2D, text: string, width: number): string[] => {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push('');
      continue;
    }
    let line = '';
    for (const w of para.split(/(\s+)/)) {
      if (g.measureText(line + w).width > width && line.trim()) {
        out.push(line.trimEnd());
        line = w.trimStart();
      } else line += w;
    }
    out.push(line.trimEnd());
  }
  return out;
};

/** A notes page: the slide small at the top, its words underneath (A4, upright), as a picture. Long notes carry over to further pages. */
async function notesPages(deck: Deck, i: number, s: Slide, kit: DrawKit): Promise<HTMLCanvasElement[]> {
  const W = 1240;
  const H = 1754;
  const slide = await slideCanvas(deck, i, kit, 1000);
  const pages: HTMLCanvasElement[] = [];
  const page = (): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#111111';
    pages.push(c);
    return { c, g };
  };
  let { g } = page();
  g.drawImage(slide, 120, 110, 1000, 562);
  g.strokeStyle = '#555555';
  g.lineWidth = 2;
  g.strokeRect(120, 110, 1000, 562);
  g.font = `600 30px ${FONT}`;
  g.fillText(`Slide ${i + 1} of ${deck.slides.length}: ${slideName(s, i + 1)}`.slice(0, 70), 120, 730);
  g.font = `400 32px ${FONT}`;
  let y = 800;
  for (const line of wrap(g, s.notes.trim(), W - 240)) {
    if (y > H - 120) {
      ({ g } = page());
      g.font = `400 32px ${FONT}`;
      y = 140;
    }
    g.fillText(line, 120, y);
    y += 46;
  }
  return pages;
}

/** The deck as a PDF: landscape slides, one a page; notes pages after them when asked (only the slides that have notes). */
export async function deckPdf(deck: Deck, kit: DrawKit, o: { notes?: boolean; progress?: (done: number, of: number) => void } = {}): Promise<Uint8Array> {
  const pages: PdfPage[] = [];
  const total = deck.slides.length;
  const jpeg = async (c: HTMLCanvasElement) => jpegImage(new Uint8Array(await (await toBlob(c, 'image/jpeg', 0.86)).arrayBuffer()));
  for (let i = 0; i < total; i++) {
    const c = await slideCanvas(deck, i, kit, 1600);
    const img = await jpeg(c);
    if (!img) throw new Error('a slide could not be made into a picture');
    pages.push({ w: 960, h: 540, images: [{ img, x: 0, y: 0, w: 960, h: 540 }] });
    o.progress?.(i + 1, total);
  }
  if (o.notes) {
    for (let i = 0; i < total; i++) {
      const s = deck.slides[i]!;
      if (!s.notes.trim()) continue;
      for (const c of await notesPages(deck, i, s, kit)) {
        const img = await jpeg(c);
        if (img) pages.push({ w: 595.28, h: 841.89, images: [{ img, x: 0, y: 0, w: 595.28, h: 841.89 }] });
      }
    }
  }
  return writePdf(pages, { title: deck.title });
}
