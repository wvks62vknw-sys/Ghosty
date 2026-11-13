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

export interface ExportCtx {
  name: string;
  original: Blob;
  recipe: () => Recipe;
  srcSize: { w: number; h: number };
  run: (onTile: (done: number, of: number) => void) => ReturnType<typeof exportCanvas>;
  caps: { tile: number; maxTexture: number; frameMs: number; renderer: string; slow: boolean };
}

/** What the sheet shows, for the specs (window.__ghosty.photoedit.export). */
export const exportState = { open: false, format: 'jpeg' as 'jpeg' | 'png' | 'original', quality: 90, phase: 'idle' as 'idle' | 'drawing' | 'ready' | 'failed', words: '', w: 0, h: 0, bytes: 0, tiles: 0, drawMs: 0, saved: '', capped: false, slow: false };

const extOf = (name: string) => /\.([A-Za-z0-9]{2,5})$/.exec(name)?.[1] ?? '';
const baseOf = (name: string) => name.replace(/\.[A-Za-z0-9]{2,5}$/, '');

export function openExport(c: ExportCtx): void {
  const w = window as unknown as { __ghosty?: { photoedit?: Record<string, unknown> } };
  if (w.__ghosty?.photoedit) w.__ghosty.photoedit.export = exportState;
  Object.assign(exportState, { open: true, format: 'jpeg', quality: 90, phase: 'drawing', words: '', w: 0, h: 0, bytes: 0, tiles: 0, saved: '', capped: false, slow: c.caps.slow });
  let drawn: Awaited<ReturnType<ExportCtx['run']>> | null = null;
  let blob: Blob | null = null;
  let token = 0;
  const status = h('p.peexstatus', { role: 'status', 'aria-live': 'polite' });
  const size = h('p.peexsize', { 'aria-live': 'polite' });
  const note = h('p.g-truth.peexnote');
  const bar = h('progress.peexbar', { max: 1, value: 0, 'aria-label': 'Drawing the picture' }) as HTMLProgressElement;
  const saveB = button('SAVE', () => void out('save'), 'on');
  const shareB = button('SHARE', () => void out('share'));
  saveB.disabled = shareB.disabled = true;
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
  const q = slider({ id: 'quality', label: 'Quality', min: 50, max: 100, step: 1, rest: 90, value: 90, say: (v) => `quality ${Math.round(v)}`, live: (v) => ((exportState.quality = v), paintSize(true)), keep: () => void encode() });
  const facts = h('p.g-truth.peexfacts');
  const nameOf = (): string => (exportState.format === 'original' ? c.name : `${baseOf(c.name)}-edit.${exportState.format === 'png' ? 'png' : 'jpg'}`);

  function paint(): void {
    for (const [k, b] of fb) {
      b.classList.toggle('on', k === exportState.format);
      b.setAttribute('aria-pressed', String(k === exportState.format));
    }
    q.el.hidden = exportState.format !== 'jpeg';
    bar.hidden = exportState.phase !== 'drawing' || exportState.format === 'original';
  }
  function paintSize(stale = false): void {
    if (exportState.format === 'original') {
      const dims = `${thousands(c.srcSize.w)} × ${thousands(c.srcSize.h)}`;
      size.textContent = `The original, exactly as it came: ${sizeWords(c.original.size)}${c.original.type ? ` · ${c.original.type.replace('image/', '').toUpperCase()}` : ''} · ${dims}`;
      note.textContent = 'NOT RE-DRAWN, NOT RE-COMPRESSED. THE FILE’S OWN BYTES';
      saveB.disabled = shareB.disabled = false;
      return;
    }
    if (exportState.phase !== 'ready' || !drawn) {
      size.textContent = '';
      return;
    }
    size.textContent = stale ? `${thousands(drawn.w)} × ${thousands(drawn.h)} · about ${sizeWords(exportState.bytes)} at the last quality…` : `${thousands(drawn.w)} × ${thousands(drawn.h)} · ${(drawn.w * drawn.h / 1e6).toFixed(1)} megapixels · ${sizeWords(exportState.bytes)}`;
    note.textContent = 'THE PLACE THE PHOTO WAS TAKEN IS NOT CARRIED INTO AN EDITED FILE';
  }
  async function encode(): Promise<void> {
    paint();
    if (exportState.format === 'original') {
      blob = c.original;
      exportState.bytes = c.original.size;
      exportState.w = c.srcSize.w;
      exportState.h = c.srcSize.h;
      paintSize();
      return;
    }
    if (!drawn) return;
    const mine = ++token;
    saveB.disabled = shareB.disabled = true;
    status.textContent = exportState.format === 'png' ? 'Making the PNG…' : `Making the JPEG at quality ${Math.round(exportState.quality)}…`;
    const b = await new Promise<Blob | null>((ok) => drawn!.canvas.toBlob(ok, exportState.format === 'png' ? 'image/png' : 'image/jpeg', exportState.quality / 100));
    if (mine !== token) return;
    status.textContent = '';
    if (!b) {
      exportState.phase = 'failed';
      status.textContent = 'This phone could not make that file. Try a lower quality, or the original.';
      return;
    }
    blob = b;
    exportState.bytes = b.size;
    exportState.w = drawn.w;
    exportState.h = drawn.h;
    exportState.phase = 'ready';
    saveB.disabled = shareB.disabled = false;
    paintSize();
  }
  async function out(how: 'save' | 'share'): Promise<void> {
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
    q.el,
    bar,
    status,
    size,
    note,
    h('div.perow.pekeys', saveB, shareB),
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
