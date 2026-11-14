/**
 * THE EXPORT SHEET (BRIEF-EDITOR-PHOTO): the whole picture drawn at its own full size (in tiles, stitched), then JPEG at a quality dial or
 * PNG, or THE ORIGINAL back out unchanged; the size said before anything is saved or shared. The location a camera wrote in the photo
 * is not carried into an edited file (the canvas keeps pixels only) and the sheet says so; the original goes back out as it came.
 */
import { clear, h } from '../../core/dom';
import { sayError } from '../../ui/hisWords';
import { button, modal, toast } from '../../ui/components';
import { sizeWords } from '../../convert/bytes';
import { saveBlob, shareBlob } from '../../convert/run';
import type { exportCanvas } from '../../photo/gpu';
import type { Recipe } from '../../photo/recipe';
import { slider, thousands } from './slider';
import { peState } from './editor';
import { cannotGrow, enlarge, enlargedSize } from '../../photo/enlarge';

export interface ExportCtx {
  name: string;
  original: Blob;
  recipe: () => Recipe;
  srcSize: { w: number; h: number };
  run: (onTile: (done: number, of: number) => void) => ReturnType<typeof exportCanvas>;
  caps: { tile: number; maxTexture: number; frameMs: number; renderer: string; slow: boolean };
}

/** What the sheet shows, for the specs (window.__ghosty.photoedit.export). */
export const exportState = { open: false, format: 'jpeg' as 'jpeg' | 'png' | 'original', quality: 90, phase: 'idle' as 'idle' | 'drawing' | 'ready' | 'failed', words: '', w: 0, h: 0, bytes: 0, tiles: 0, drawMs: 0, saved: '', capped: false, slow: false, posted: '', scale: 1 as 1 | 2 };

const extOf = (name: string) => /\.([A-Za-z0-9]{2,5})$/.exec(name)?.[1] ?? '';
const baseOf = (name: string) => name.replace(/\.[A-Za-z0-9]{2,5}$/, '');

export function openExport(c: ExportCtx): void {
  const w = window as unknown as { __ghosty?: { photoedit?: Record<string, unknown> } };
  if (w.__ghosty?.photoedit) w.__ghosty.photoedit.export = exportState;
  Object.assign(exportState, { open: true, format: 'jpeg', quality: 90, phase: 'drawing', words: '', w: 0, h: 0, bytes: 0, tiles: 0, saved: '', capped: false, slow: c.caps.slow, posted: '', scale: 1 });
  let drawn: Awaited<ReturnType<ExportCtx['run']>> | null = null;
  let blob: Blob | null = null;
  let token = 0;
  const status = h('p.peexstatus', { role: 'status', 'aria-live': 'polite' });
  const size = h('p.peexsize', { 'aria-live': 'polite' });
  const note = h('p.g-truth.peexnote');
  const bar = h('progress.peexbar', { max: 1, value: 0, 'aria-label': 'Drawing the picture' }) as HTMLProgressElement;
  const saveB = button('SAVE', () => void out('save'), 'on');
  const shareB = button('SHARE', () => void out('share'));
  // editors.c6: the picture into SOCIAL's WRITE A POST, as a draft he finishes there; it goes out only when he taps APPROVE
  const postB = button('DRAFT A POST', () => void toPost(), 'pepost');
  postB.setAttribute('aria-label', 'Draft a post with this picture: it goes out only when you tap APPROVE');
  saveB.disabled = shareB.disabled = postB.disabled = true;
  const fmts: [string, string][] = [['jpeg', 'JPEG'], ['png', 'PNG'], ['original', 'THE ORIGINAL']];
  const fmtRow = h('div.perow.pechips', { role: 'group', 'aria-label': 'Format' });
  const fb = new Map<string, HTMLButtonElement>();
  for (const [id, label] of fmts) {
    const b = button(label, () => {
      exportState.format = id as typeof exportState.format;
      paint();
      void encode();
    });
    fb.set(id, b);
    fmtRow.append(b);
  }
  // ENLARGE (editors.u14, with no model): the finished picture twice as wide and tall, stepped up smoothly and sharpened on the phone
  let big: { canvas: HTMLCanvasElement; w: number; h: number; capped: boolean } | null = null;
  const sizes: [1 | 2, string][] = [[1, 'AS IT IS'], [2, '2× BIGGER']];
  const sizeRow = h('div.perow.pechips.pescale', { role: 'group', 'aria-label': 'Size' });
  const sb = new Map<1 | 2, HTMLButtonElement>();
  for (const [k, label] of sizes) {
    const b = button(label, () => {
      exportState.scale = k;
      paint();
      void encode();
    });
    sb.set(k, b);
    sizeRow.append(b);
  }
  const scaleNote = h('p.pnote.pescalenote');
  /** The picture the file is made from: as drawn, or enlarged (made once, the first time he picks it). */
  const source = async (): Promise<{ canvas: HTMLCanvasElement; w: number; h: number } | null> => {
    if (!drawn) return null;
    if (exportState.scale === 1) return drawn;
    if (!big) {
      status.textContent = 'Making it twice the size…';
      big = await enlarge(drawn.canvas, 2, (w) => (status.textContent = w));
    }
    return big;
  };
  const q = slider({ id: 'quality', label: 'Quality', min: 50, max: 100, step: 1, rest: 90, value: 90, say: (v) => `quality ${Math.round(v)}`, live: (v) => ((exportState.quality = v), paintSize(true)), keep: () => void encode() });
  const facts = h('p.g-truth.peexfacts');
  const nameOf = (): string => (exportState.format === 'original' ? c.name : `${baseOf(c.name)}-edit${exportState.scale === 2 ? "-2x" : ""}.${exportState.format === "png" ? "png" : "jpg"}`);

  function paint(): void {
    for (const [k, b] of fb) {
      b.classList.toggle('on', k === exportState.format);
      b.setAttribute('aria-pressed', String(k === exportState.format));
    }
    q.el.hidden = exportState.format !== 'jpeg';
    for (const [k, b] of sb) {
      b.classList.toggle('on', k === exportState.scale);
      b.setAttribute('aria-pressed', String(k === exportState.scale));
    }
    sizeRow.hidden = exportState.format === 'original';
    const at2 = drawn ? enlargedSize(drawn.w, drawn.h, 2) : null;
    scaleNote.hidden = exportState.format === 'original';
    scaleNote.textContent = exportState.scale === 2 && drawn && cannotGrow(drawn.w, drawn.h)
      ? '2× BIGGER: this picture is already as big as a phone can make it (16.7 megapixels), so it goes out at its own size, unchanged.'
      : exportState.scale === 2
      ? `2× BIGGER: ${at2 ? `${thousands(at2.w)} × ${thousands(at2.h)}, ` : ''}drawn up smoothly and sharpened on this phone${at2?.capped ? ' (held to the 16.7 megapixels a phone’s canvas takes)' : ''}. It adds no detail that was not there; no model is offered for that.`
      : '2× BIGGER makes the picture twice as wide and tall on this phone, for a small photo you want to print or crop.';
    bar.hidden = exportState.phase !== 'drawing' || exportState.format === 'original';
  }
  function paintSize(stale = false): void {
    if (exportState.format === 'original') {
      const dims = `${thousands(c.srcSize.w)} × ${thousands(c.srcSize.h)}`;
      size.textContent = `The original, exactly as it came: ${sizeWords(c.original.size)}${c.original.type ? ` · ${c.original.type.replace('image/', '').toUpperCase()}` : ''} · ${dims}`;
      note.textContent = 'NOT RE-DRAWN, NOT RE-COMPRESSED. THE FILE’S OWN BYTES';
      saveB.disabled = shareB.disabled = postB.disabled = false;
      return;
    }
    if (exportState.phase !== 'ready' || !drawn) {
      size.textContent = '';
      return;
    }
    const d = exportState.scale === 2 && big ? big : drawn;
    size.textContent = stale ? `${thousands(d.w)} × ${thousands(d.h)} · about ${sizeWords(exportState.bytes)} at the last quality…` : `${thousands(d.w)} × ${thousands(d.h)} · ${(d.w * d.h / 1e6).toFixed(1)} megapixels · ${sizeWords(exportState.bytes)}`;
    note.textContent = 'THE PLACE THE PHOTO WAS TAKEN IS NOT CARRIED INTO AN EDITED FILE';
  }
  async function encode(): Promise<void> {
    paint();
    if (exportState.format === 'original') {
      // (a JPEG or PNG still being made from before the tap must not land over the original's bytes when it finishes: the token moves on)
      ++token;
      status.textContent = '';
      blob = c.original;
      exportState.bytes = c.original.size;
      exportState.w = c.srcSize.w;
      exportState.h = c.srcSize.h;
      paintSize();
      return;
    }
    if (!drawn) return;
    const mine = ++token;
    saveB.disabled = shareB.disabled = postB.disabled = true;
    let from: { canvas: HTMLCanvasElement; w: number; h: number } | null;
    try {
      from = await source();
    } catch (e) {
      if (mine !== token) return;
      exportState.phase = 'failed';
      status.textContent = sayError(e, 'make it twice the size');
      return;
    }
    if (mine !== token || !from) return;
    status.textContent = exportState.format === 'png' ? 'Making the PNG…' : `Making the JPEG at quality ${Math.round(exportState.quality)}…`;
    const b = await new Promise<Blob | null>((ok) => from!.canvas.toBlob(ok, exportState.format === 'png' ? 'image/png' : 'image/jpeg', exportState.quality / 100));
    if (mine !== token) return;
    status.textContent = '';
    if (!b) {
      exportState.phase = 'failed';
      status.textContent = 'This phone could not make that file. Try a lower quality, or the original.';
      return;
    }
    blob = b;
    exportState.bytes = b.size;
    exportState.w = from.w;
    exportState.h = from.h;
    exportState.phase = 'ready';
    saveB.disabled = shareB.disabled = postB.disabled = false;
    paintSize();
  }
  async function toPost(): Promise<void> {
    if (exportState.format === 'original') blob = c.original;
    if (!blob) return;
    const b = blob;
    status.textContent = 'Putting the picture in a new post…';
    try {
      const [{ prefillPost }, { go }] = await Promise.all([import('../social/queue'), import('../../shell/tabs')]);
      await prefillPost({ blob: b, alt: '' });
      exportState.posted = nameOf();
      m.close();
      go('social');
      toast('The picture is in WRITE A POST on SOCIAL. Choose the accounts, say what is in it and make the draft: it goes out only when you tap APPROVE.', 'ok');
    } catch (e) {
      status.textContent = sayError(e, 'put the picture in a post');
    }
  }
  async function out(how: 'save' | 'share'): Promise<void> {
    // THE ORIGINAL is always the file's own bytes, whatever a late encode left in `blob`
    if (exportState.format === 'original') blob = c.original;
    if (!blob) return;
    const name = nameOf();
    if (how === 'save') {
      saveBlob(blob, name);
      exportState.saved = name;
      toast(`Saved ${name}. On an iPhone, open it from Downloads and choose Save to Photos`, 'ok');
    } else {
      const shared = await shareBlob(blob, name);
      if (shared) exportState.saved = name;
      else {
        saveBlob(blob, name);
        exportState.saved = name;
        toast('This phone has no share sheet here, so I saved it instead', 'warn');
      }
    }
  }
  const m = modal('EXPORT', h('div.peexport',
    h('p.pnote', 'The whole picture, at its own size. Your original is never touched.'),
    fmtRow,
    sizeRow,
    scaleNote,
    q.el,
    bar,
    status,
    size,
    note,
    h('div.perow.pekeys', saveB, shareB),
    h('div.perow.pekeys', postB),
    h('p.pnote.pepostnote', 'DRAFT A POST puts the picture in a new post on SOCIAL. Nothing goes out until you tap APPROVE there.'),
    facts,
  ), () => {
    exportState.open = false;
    token++;
  });
  facts.textContent = `${c.caps.slow ? 'Drawn the slow way here' : 'Drawn with WebGL2'} · ${c.caps.frameMs ? `${c.caps.frameMs} ms a frame · ` : ''}${c.caps.tile ? `tiles of ${thousands(c.caps.tile)} px · ` : ''}${c.caps.maxTexture ? `this phone’s texture limit ${thousands(c.caps.maxTexture)} px` : 'no texture limit read'}`.toUpperCase();
  paint();
  void (async () => {
    try {
      const t0 = performance.now();
      status.textContent = c.caps.slow ? 'Drawing the whole picture the slow way… this takes a while on a large photo.' : 'Drawing the whole picture…';
      drawn = await c.run((done, of) => {
        bar.value = done / of;
        exportState.tiles = of;
        status.textContent = `${c.caps.slow ? 'Drawing the whole picture the slow way' : 'Drawing the whole picture'}… ${done} of ${of}`;
      });
      exportState.drawMs = Math.round(performance.now() - t0);
      exportState.capped = drawn.capped;
      if (drawn.capped) note.textContent = `A phone’s canvas holds about 16.7 megapixels at most, so this one is ${thousands(drawn.w)} × ${thousands(drawn.h)}, not ${thousands(drawn.wanted.w)} × ${thousands(drawn.wanted.h)}. The original goes out whole.`.toUpperCase();
      exportState.phase = 'ready';
      status.textContent = '';
      await encode();
    } catch (e) {
      exportState.phase = 'failed';
      status.textContent = sayError(e, 'draw the whole picture');
      clear(note);
    }
  })();
  void m;
}
