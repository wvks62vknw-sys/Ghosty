/**
 * FILL IN AND SIGN A PDF (NEXT ROUND, editors.s12): a PDF form's boxes read with pdf.js (vendored, on the phone): its text boxes, tick
 * boxes and drop-down lists, each with its name and what is in it; what cannot be filled here (a choice of round buttons, a box that
 * wants a digital signature, a form made with XFA) said by name. Filling writes the values into the form itself and the signature he
 * drew with a finger as a pen drawing (an ink mark) on the page where he put it, then pdf.js saves the PDF with the changes added at
 * its end, so it opens filled in any PDF reader. Nothing leaves the phone.
 */
import { openPdf, type PdfJsDoc, type PdfJsPage } from '../convert/vendor';

export interface FormField {
  /** pdf.js's id of the box (its object), what the value is kept under. */
  id: string;
  name: string;
  /** The box's own description when it has one ("Your surname"), else its name tidied. */
  label: string;
  kind: 'text' | 'check' | 'choice';
  value: string | boolean;
  /** 0-based. */
  page: number;
  /** In the page's own points: x1, y1, x2, y2 from the bottom left. */
  rect: [number, number, number, number];
  multi?: boolean;
  options?: { value: string; label: string }[];
}
export interface Unfillable {
  name: string;
  why: string;
}
export interface FormRead {
  pages: number;
  sizes: { w: number; h: number }[];
  fields: FormField[];
  cannot: Unfillable[];
  title: string;
}
/** A signature: strokes of points, each 0..1 across and down the pad, and where it goes on which page (points, from the bottom left). */
export interface Signature {
  strokes: number[][];
  /** Width over height of the pad it was drawn on. */
  aspect: number;
}
export interface Placed {
  page: number;
  /** The signature's box on the page: x1, y1, x2, y2 in points from the bottom left. */
  rect: [number, number, number, number];
}

interface Widget {
  id: string;
  fieldName?: string;
  alternativeText?: string;
  fieldType?: string;
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  fieldValue?: unknown;
  exportValue?: string;
  options?: { exportValue: string; displayValue: string }[];
  multiLine?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  rect: number[];
  subtype?: string;
}
type FormPage = PdfJsPage & { getAnnotations(o?: { intent?: string }): Promise<Widget[]> };
type FormDoc = PdfJsDoc & {
  annotationStorage: { setValue(key: string, value: Record<string, unknown>): void };
  saveDocument(): Promise<Uint8Array>;
  getFieldObjects?(): Promise<Record<string, unknown> | null>;
  allXfa?: unknown;
  isPureXfa?: boolean;
};

const tidy = (n: string): string => {
  const last = n.split('.').pop() ?? n;
  const words = last.replace(/\[\d+\]$/, '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : 'A box';
};

/** The form in a PDF: its boxes he can fill, the ones he cannot (by name, with why), its pages' sizes. */
export async function readForm(bytes: Uint8Array): Promise<FormRead> {
  const { doc, done } = await openPdf(bytes);
  try {
    const d = doc as FormDoc;
    const fields: FormField[] = [];
    const cannot: Unfillable[] = [];
    const sizes: { w: number; h: number }[] = [];
    const radios = new Set<string>();
    for (let p = 0; p < d.numPages; p++) {
      const page = (await d.getPage(p + 1)) as FormPage;
      const vp = page.getViewport({ scale: 1 });
      sizes.push({ w: vp.width, h: vp.height });
      for (const a of await page.getAnnotations({ intent: 'display' })) {
        if (a.subtype !== 'Widget' || a.hidden) continue;
        const name = a.fieldName ?? '';
        const label = (a.alternativeText ?? '').trim() || tidy(name);
        const rect = [a.rect[0], a.rect[1], a.rect[2], a.rect[3]] as [number, number, number, number];
        if (a.readOnly) continue;
        if (a.fieldType === 'Tx') fields.push({ id: a.id, name, label, kind: 'text', value: typeof a.fieldValue === 'string' ? a.fieldValue : '', page: p, rect, multi: !!a.multiLine });
        else if (a.fieldType === 'Btn' && a.checkBox) fields.push({ id: a.id, name, label, kind: 'check', value: !!a.fieldValue && a.fieldValue !== 'Off', page: p, rect });
        else if (a.fieldType === 'Ch' && a.options?.length) fields.push({ id: a.id, name, label, kind: 'choice', value: Array.isArray(a.fieldValue) ? String(a.fieldValue[0] ?? '') : String(a.fieldValue ?? ''), page: p, rect, options: a.options.map((o) => ({ value: o.exportValue, label: o.displayValue || o.exportValue })) });
        else if (a.fieldType === 'Btn' && a.radioButton) {
          if (!radios.has(name)) cannot.push({ name: label, why: 'a choice of round buttons' });
          radios.add(name);
        } else if (a.fieldType === 'Sig') cannot.push({ name: label, why: 'a box for a digital signature (SIGN puts your drawn signature on the page instead)' });
        else if (a.fieldType === 'Btn' && a.pushButton) continue;
        else cannot.push({ name: label, why: 'a kind of box I cannot fill here' });
      }
      page.cleanup();
    }
    if (d.isPureXfa) cannot.push({ name: 'The whole form', why: 'made with XFA, which only Adobe’s own reader fills' });
    const title = (await d.getMetadata().catch(() => ({ info: {} as { Title?: string } }))).info.Title?.trim() ?? '';
    return { pages: d.numPages, sizes, fields, cannot, title };
  } finally {
    await done();
  }
}

/** The page drawn as a picture `width` pixels across (for the screen), with its scale (pixels per point). */
export async function drawPage(bytes: Uint8Array, page: number, width: number): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const { doc, done } = await openPdf(bytes);
  try {
    const pg = await doc.getPage(page + 1);
    const base = pg.getViewport({ scale: 1 });
    const scale = width / base.width;
    const vp = pg.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const g = canvas.getContext('2d')!;
    await pg.render({ canvasContext: g, viewport: vp, canvas }).promise;
    pg.cleanup();
    return { canvas, scale };
  } finally {
    await done();
  }
}

/** A signature's strokes as the ink mark's lines and points, in the page's points inside `rect` (the pad's top is the box's top). */
export function inkOf(sig: Signature, rect: [number, number, number, number]): { lines: Float32Array[]; points: number[][] } {
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;
  const lines: Float32Array[] = [];
  const points: number[][] = [];
  for (const s of sig.strokes) {
    if (s.length < 2) continue;
    const pts: number[] = [];
    for (let k = 0; k + 1 < s.length; k += 2) pts.push(x1 + s[k]! * w, y2 - s[k + 1]! * h);
    // a dot (one point) is drawn as a very short line
    if (pts.length === 2) pts.push(pts[0]! + 0.5, pts[1]!);
    const line: number[] = [NaN, NaN, NaN, NaN, pts[0]!, pts[1]!];
    for (let k = 2; k < pts.length; k += 2) line.push(NaN, NaN, NaN, NaN, pts[k]!, pts[k + 1]!);
    lines.push(Float32Array.from(line));
    points.push(pts);
  }
  void y1;
  return { lines, points };
}

/** The filled PDF: each value written into its box, the signature drawn where it was put, saved by pdf.js with the changes added at the end. */
export async function fillForm(bytes: Uint8Array, values: Map<string, string | boolean>, sig: Signature | null, placed: Placed | null): Promise<Uint8Array> {
  const { doc, done } = await openPdf(bytes);
  try {
    const d = doc as FormDoc;
    for (const [id, v] of values) d.annotationStorage.setValue(id, { value: v });
    if (sig && placed && sig.strokes.length) {
      const ink = inkOf(sig, placed.rect);
      // the ink mark, as pdf.js's own pen tool keeps one (AnnotationEditorType.INK = 15)
      d.annotationStorage.setValue('pdfjs_internal_editor_ghosty_sig', {
        annotationType: 15, color: [17, 17, 40], thickness: 1.6, opacity: 1, paths: ink, outlines: null, boxes: null,
        pageIndex: placed.page, rect: placed.rect, rotation: 0, structTreeParentId: null,
      });
    }
    return await d.saveDocument();
  } finally {
    await done();
  }
}

// ---------------------------------------------------------------- the signature kept for reuse, only when he says KEEP

const SIG_KEY = 'ghosty.signature';
export function keptSignature(): Signature | null {
  try {
    const s = JSON.parse(localStorage.getItem(SIG_KEY) ?? 'null') as Signature | null;
    return s && Array.isArray(s.strokes) && s.strokes.length ? s : null;
  } catch {
    return null;
  }
}
export function keepSignature(s: Signature | null): boolean {
  try {
    if (s) localStorage.setItem(SIG_KEY, JSON.stringify({ strokes: s.strokes.map((x) => x.map((n) => Math.round(n * 1000) / 1000)), aspect: s.aspect }));
    else localStorage.removeItem(SIG_KEY);
    return true;
  } catch {
    return false;
  }
}
