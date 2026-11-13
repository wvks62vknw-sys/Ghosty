/**
 * THE SHELF (BRIEF-EDITOR-PHOTO): his edited photos as thumbnails, newest first; OPEN A PHOTO; BATCH (pick several, one look, EXPORT ALL with
 * the total size said). Every state in his voice: the empty shelf (one line and OPEN A PHOTO), a photo that would not open (the converter's
 * own line), a RAW, the store full (the oldest named before it goes), a batch mid-way with its count. State for specs at
 * window.__ghosty.photoedit.shelf.
 */
import { clear, h } from '../../core/dom';
import { rawText, sayError } from '../../ui/hisWords';
import { button, modal, toast } from '../../ui/components';
import { sizeWords } from '../../convert/bytes';
import { saveBlob, shareBlob, zipOf, type Output } from '../../convert/run';
import { exportCanvas, PhotoGL, srcOf } from '../../photo/gpu';
import { openPhoto, RAW_LINE } from '../../photo/load';
import { applyPreset, LOOKS, type Preset } from '../../photo/recipe';
import { getLayer, getOriginal, getRecipe, getMeta, keepPhoto, listMyLooks, listPhotos, removePhoto, roomFor, saveRecipe, storeState, type PhotoMeta } from '../../photo/store';
import { MAX_BYTES, MAX_PHOTOS, megabytes } from '../../photo/room';
import { thousands } from './slider';
import { peState } from './editor';

export const shelfState = {
  photos: 0,
  words: '',
  batch: false,
  picked: [] as string[],
  run: { phase: 'idle' as 'idle' | 'running' | 'done' | 'cancelled', done: 0, of: 0, bytes: 0, words: '', files: [] as { name: string; bytes: number; w: number; h: number }[] },
  empty: '',
};

const when = (ms: number): string => {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export interface Shelf {
  el: HTMLElement;
  show(): Promise<void>;
  /** Photos from outside (a file shared in): kept and the first opened. */
  take(files: File[]): Promise<void>;
}

export function shelf(open: (id: string) => void): Shelf {
  const w = window as unknown as { __ghosty?: { photoedit?: Record<string, unknown> } };
  const grid = h('div.peshelfgrid', { role: 'list', 'aria-label': 'My photos' });
  const msg = h('p.peshelfmsg', { role: 'status', 'aria-live': 'polite' });
  const empty = h('div.peempty', { hidden: true },
    h('b', 'No photos yet'),
    h('p', 'Open one from your camera roll. I keep it here untouched, with every edit beside it, and you can come back to any of them.'));
  const room = h('p.g-truth.peroom');
  const input = h('input', { type: 'file', accept: 'image/*,.heic,.heif,.dng', multiple: true, hidden: true, 'aria-label': 'Open a photo' }) as HTMLInputElement;
  const openB = button('OPEN A PHOTO', () => input.click(), 'on peopen');
  const batchB = button('BATCH', () => setBatch(!shelfState.batch), 'pebatchb');
  const bar = h('div.pebatchbar', { hidden: true, role: 'toolbar', 'aria-label': 'Batch' });
  const head = h('header.peshelfhead',
    h('h2.pehero', 'My photos'),
    h('p.pesub', 'A photo editor on this phone: light, colour, curves, masks, healing, crops and looks, and your original never touched.'),
    h('div.perow.pekeys', openB, batchB, input),
  );
  const el = h('div.peshelf', { dataset: { view: 'shelf' } }, head, msg, empty, grid, room, bar);
  let items: PhotoMeta[] = [];
  const urls: string[] = [];

  function setBatch(on: boolean): void {
    shelfState.batch = on;
    shelfState.picked = [];
    batchB.classList.toggle('on', on);
    batchB.textContent = on ? 'DONE' : 'BATCH';
    batchB.setAttribute('aria-pressed', String(on));
    paint();
  }

  function paint(): void {
    for (const u of urls.splice(0)) URL.revokeObjectURL(u);
    clear(grid);
    empty.hidden = items.length > 0;
    shelfState.empty = items.length ? '' : 'No photos yet';
    shelfState.photos = items.length;
    batchB.hidden = items.length === 0;
    room.textContent = items.length ? usedWords(items) : '';
    for (const p of items) {
      const picked = shelfState.picked.includes(p.id);
      const img = h('img.pethumb', { alt: '', loading: 'lazy' });
      if (p.thumb) {
        const u = URL.createObjectURL(p.thumb);
        urls.push(u);
        img.src = u;
      }
      const b = button(h('span.petile', img, h('span.petileinfo', h('b', p.name), h('em', `${p.edited ? 'Edited' : 'Not edited yet'} · ${when(p.at)} · ${sizeWords(p.bytes)}`)), picked ? h('i.petick', { 'aria-hidden': 'true' }, '✓') : null), () => {
        if (shelfState.batch) {
          const i = shelfState.picked.indexOf(p.id);
          if (i >= 0) shelfState.picked.splice(i, 1);
          else shelfState.picked.push(p.id);
          paint();
        } else open(p.id);
      }, `peshot${picked ? ' on' : ''}`);
      b.setAttribute('role', 'listitem');
      b.setAttribute('aria-label', `${p.name}, ${p.edited ? 'edited' : 'not edited yet'}, ${when(p.at)}`);
      if (shelfState.batch) b.setAttribute('aria-pressed', String(picked));
      grid.append(b);
    }
    paintBar();
  }
  const usedWords = (list: PhotoMeta[]): string => `${list.length} of ${MAX_PHOTOS} places · ${megabytes(list.reduce((n, k) => n + k.bytes, 0))} of ${megabytes(MAX_BYTES)}${storeState.persistent ? '' : ' · KEPT ONLY WHILE THIS PAGE IS OPEN'}`.toUpperCase();

  function paintBar(): void {
    bar.hidden = !shelfState.batch;
    if (!shelfState.batch) return;
    const n = shelfState.picked.length;
    clear(bar,
      h('p.g-truth.pebatchsay', n ? `${n} PICKED · ${megabytes(items.filter((i) => shelfState.picked.includes(i.id)).reduce((a, i) => a + i.bytes, 0))}` : 'TAP THE PHOTOS TO PICK, THEN CHOOSE A LOOK'),
      h('div.perow.pekeys',
        button(n === items.length ? 'NONE' : 'ALL', () => {
          shelfState.picked = n === items.length ? [] : items.map((i) => i.id);
          paint();
        }),
        (() => {
          const b = button('LOOK AND EXPORT ALL', () => void batchSheet([...shelfState.picked]), 'on');
          b.disabled = n === 0;
          return b;
        })(),
        (() => {
          const b = button('DELETE', () => deleteSheet([...shelfState.picked]));
          b.disabled = n === 0;
          return b;
        })()));
  }

  function deleteSheet(ids: string[]): void {
    const m = modal('DELETE', h('div.pesave',
      h('p.pnote', `${ids.length === 1 ? 'This photo and its edits go' : `These ${ids.length} photos and their edits go`} from here. Your camera roll keeps the originals; I only lose my copy and the recipe beside it.`),
      h('div.perow', button('DELETE', async () => {
        for (const id of ids) await removePhoto(id);
        m.close();
        setBatch(false);
        await show();
        say(`${ids.length} photo${ids.length === 1 ? '' : 's'} deleted.`);
      }, 'on'), button('KEEP THEM', () => m.close()))));
  }

  function say(words: string): void {
    msg.textContent = words;
    shelfState.words = words;
  }

  async function show(): Promise<void> {
    items = await listPhotos();
    if (w.__ghosty && !w.__ghosty.photoedit) (w.__ghosty as Record<string, unknown>).photoedit = peState;
    const ws = w.__ghosty?.photoedit;
    if (ws) ws.shelf = shelfState;
    paint();
  }

  /** The store full: say who goes, before it goes. */
  async function makeRoom(bytes: number): Promise<boolean> {
    const r = await roomFor(bytes);
    if (r.tooBig) {
      say(r.words);
      toast(r.words, 'bad');
      return false;
    }
    if (r.fits) return true;
    return await new Promise<boolean>((ok) => {
      let done = false;
      const m = modal('I AM FULL', h('div.pesave',
        h('p.pnote', r.words),
        h('div.perow', button('LET THEM GO AND KEEP THIS ONE', () => ((done = true), m.close(), ok(true)), 'on'), button('NOT NOW', () => m.close()))), () => {
        if (!done) ok(false);
      });
    });
  }

  async function take(files: File[]): Promise<void> {
    let first = '';
    let n = 0;
    for (const f of files) {
      say(`Opening ${f.name}…`);
      try {
        const o = await openPhoto(f, f.name);
        if (!(await makeRoom(f.size))) continue;
        const kept = await keepPhoto(f, f.name, { w: o.w, h: o.h });
        n++;
        if (!first) first = kept.meta.id;
      } catch (e) {
        const words = rawText(e);
        // (a sentence of our own, in his words, is said whole; anything else goes through the one error voice)
        say(words.startsWith('I can') || words.startsWith('That') ? words : sayError(e, `open ${f.name}`));
        toast(msg.textContent ?? '', words === RAW_LINE ? 'warn' : 'bad');
      }
    }
    if (first) {
      say('');
      open(first);
    } else if (!n && !msg.textContent) say('Nothing opened.');
    await show();
  }
  input.addEventListener('change', () => {
    const fs = [...(input.files ?? [])];
    input.value = '';
    if (fs.length) void take(fs);
  });
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const fs = [...(e.dataTransfer?.files ?? [])];
    if (fs.length) void take(fs);
  });

  // ---------------------------------------------------------------- BATCH
  async function batchSheet(ids: string[]): Promise<void> {
    const mine = await listMyLooks();
    const all: Preset[] = [...LOOKS, ...mine];
    let look = all[0]!;
    let quality = 90;
    const looks = h('div.perow.pechips.pebatchlooks', { role: 'group', 'aria-label': 'The look for all of them' });
    const lb = new Map<string, HTMLButtonElement>();
    for (const p of all) {
      const b = button(p.name, () => {
        look = p;
        for (const [k, x] of lb) {
          x.classList.toggle('on', k === p.name);
          x.setAttribute('aria-pressed', String(k === p.name));
        }
      });
      lb.set(p.name, b);
      looks.append(b);
    }
    lb.get(look.name)!.classList.add('on');
    const status = h('p.peexstatus', { role: 'status', 'aria-live': 'polite' });
    const bar2 = h('progress.peexbar', { max: 1, value: 0, hidden: true }) as HTMLProgressElement;
    const total = h('p.peexsize', { 'aria-live': 'polite' });
    const note = h('p.g-truth.peexnote');
    const metas = (await Promise.all(ids.map((i) => getMeta(i)))).filter((x): x is PhotoMeta => !!x);
    const was = metas.reduce((n, p) => n + p.bytes, 0);
    note.textContent = `${metas.length} PHOTOS, ${megabytes(was).toUpperCase()} AS THEY CAME. THE LOOK KEEPS EACH PHOTO’S OWN CROP, MASKS AND HEALS`;
    const outs: Output[] = [];
    let cancelled = false;
    const go = button('APPLY AND EXPORT ALL', () => void run(), 'on');
    const cancel = button('STOP', () => (cancelled = true));
    cancel.hidden = true;
    const saveAll = button('SAVE ALL', () => {
      for (const o of outs) saveBlob(o.blob, o.name);
      toast(`Saved ${outs.length} files. On an iPhone, open them from Downloads and choose Save to Photos`, 'ok');
    });
    const shareAll = button('SHARE ALL', async () => {
      const files = outs.map((o) => new File([o.blob], o.name, { type: o.blob.type }));
      const nav = navigator as Navigator & { canShare?(d: { files: File[] }): boolean };
      try {
        if (nav.share && nav.canShare?.({ files })) await nav.share({ files, title: 'Photos from Ghosty' });
        else {
          saveBlob(await zipOf(outs), 'ghosty-photos.zip');
          toast('This phone has no share sheet here, so I saved a zip instead', 'warn');
        }
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') toast('I could not share them', 'bad');
      }
    });
    const zip = button('SAVE AS A ZIP', async () => saveBlob(await zipOf(outs), 'ghosty-photos.zip'));
    const after = h('div.perow.pekeys', { hidden: true }, shareAll, saveAll, zip);
    const q = h('input', { type: 'range', min: '50', max: '100', step: '1', value: '90', 'aria-label': 'Quality' }) as HTMLInputElement;
    const qv = h('span.peval', 'quality 90');
    q.addEventListener('input', () => {
      quality = Number(q.value);
      qv.textContent = `quality ${quality}`;
    });
    const m = modal('BATCH', h('div.peexport',
      h('p.pnote', `One look onto ${metas.length} photo${metas.length === 1 ? '' : 's'}, then every one exported at its full size.`),
      looks,
      h('div.perow', h('label.pelabel', 'Quality'), qv),
      q,
      bar2,
      status,
      total,
      note,
      h('div.perow.pekeys', go, cancel),
      after,
    ), () => {
      cancelled = true;
    });
    void m;

    async function run(): Promise<void> {
      const R = shelfState.run;
      Object.assign(R, { phase: 'running', done: 0, of: metas.length, bytes: 0, words: '', files: [] });
      go.hidden = true;
      cancel.hidden = false;
      bar2.hidden = false;
      looks.hidden = true;
      q.hidden = true;
      outs.length = 0;
      const gl = PhotoGL.make(document.createElement('canvas'));
      for (let i = 0; i < metas.length && !cancelled; i++) {
        const p = metas[i]!;
        R.words = `Photo ${i + 1} of ${metas.length}: ${p.name}`;
        status.textContent = `${R.words}… ${i} done, ${sizeWords(R.bytes)} so far`;
        bar2.value = i / metas.length;
        try {
          const blob = await getOriginal(p.id);
          if (!blob) throw new Error('the original is gone');
          const opened = await openPhoto(blob, p.name);
          const rec0 = (await getRecipe(p.id)) ?? undefined;
          if (!rec0) throw new Error('its recipe is gone');
          const rec = applyPreset(rec0, look);
          let layer: HTMLCanvasElement | null = null;
          if (rec.layer) {
            const lblob = await getLayer(rec.layer.photo);
            if (lblob) layer = (await openPhoto(lblob, 'layer')).canvas;
            else rec.layer = null;
          }
          await saveRecipe(p.id, rec);
          if (gl) {
            gl.setSource(opened.canvas);
            gl.setLayer(layer);
          }
          const drawn = await exportCanvas(gl, () => srcOf(opened.canvas), rec, { w: opened.w, h: opened.h }, layer ? () => srcOf(layer!) : null, (d, of) => {
            status.textContent = `${R.words}: drawing ${d} of ${of}… ${i} done, ${sizeWords(R.bytes)} so far`;
          });
          const out = await new Promise<Blob | null>((ok) => drawn.canvas.toBlob(ok, 'image/jpeg', quality / 100));
          if (!out) throw new Error('this phone could not make the file');
          const name = `${p.name.replace(/\.[A-Za-z0-9]{2,5}$/, '')}-${look.name.toLowerCase().replace(/\s+/g, '-')}.jpg`;
          outs.push({ name, blob: out });
          R.bytes += out.size;
          R.files.push({ name, bytes: out.size, w: drawn.w, h: drawn.h });
          R.done = i + 1;
        } catch (e) {
          status.textContent = `Photo ${i + 1} (${p.name}) did not work. ${sayError(e, 'do that one')} I carried on with the rest.`;
        }
      }
      cancel.hidden = true;
      bar2.hidden = true;
      R.phase = cancelled ? 'cancelled' : 'done';
      if (outs.length) {
        total.textContent = `${outs.length} photo${outs.length === 1 ? '' : 's'} · ${look.name.toLowerCase()} · ${sizeWords(R.bytes)} in all${cancelled ? ` (stopped after ${outs.length} of ${metas.length})` : ''}`;
        status.textContent = cancelled ? 'Stopped. What is done is below; the look is on those photos.' : 'Done. The look is on every one of them, and they are exported at full size.';
        after.hidden = false;
        R.words = total.textContent;
      } else status.textContent = 'Nothing was exported.';
      setBatch(false);
      void show();
    }
  }

  return {
    el,
    show,
    take,
  };
}

export { thousands };
