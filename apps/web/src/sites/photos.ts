/**
 * PHOTOS FOR YOUR SITES (NEXT ROUND, sites.u12): his own photos instead of free stock pictures. Each photo he picks is resized here,
 * on his phone (1600 px on its long side at most), and drawn afresh as a JPEG, which leaves its location, time, phone model and every
 * other detail behind; the brain strips any detail block once more before it keeps it (apps/edge/src/sitephotos.ts). The first photo
 * is the main picture of a site; a caption is what a screen reader says. "Build a website for my café with my photos" uses them.
 * Nothing here publishes: a photo is public only once a page he approved shows it.
 */
import { headers } from '../api/brain';
import { clear, h } from '../core/dom';
import { button, confirmSheet, empty, toast, type Panel } from '../ui/components';
import { inHisWords, sayError } from '../ui/hisWords';

export interface SitePhoto {
  id: string;
  src: string;
  caption: string;
  width: number;
  height: number;
  bytes: number;
  at: number;
}
export const LONG_SIDE = 1600;
const QUALITY = 0.84;
/** The sentence that says how they get on a site. */
export const PHOTOS_ASK = 'Ask me: “build a website for my café with my photos”. The first photo is the main picture.';

/** A photo drawn afresh at most LONG_SIDE on its long side, as a JPEG with nothing but the picture in it. */
export async function shrink(file: Blob): Promise<{ jpeg: Blob; width: number; height: number }> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      src = await new Promise<HTMLImageElement>((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => no(new Error('not a picture'));
        i.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height;
  if (!w0 || !h0) throw new Error('not a picture');
  const k = Math.min(1, LONG_SIDE / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * k));
  const height = Math.max(1, Math.round(h0 * k));
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  if (!g) throw new Error('no canvas');
  g.drawImage(src, 0, 0, width, height);
  if ('close' in src) src.close();
  const jpeg = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', QUALITY));
  if (!jpeg) throw new Error('could not make the JPEG');
  return { jpeg, width, height };
}

const b64 = async (b: Blob): Promise<string> => {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
/** A file name made into a caption he can keep or change ("IMG_2041.HEIC" says nothing: it becomes ""). */
export const captionOf = (name: string): string => {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim();
  return /^(img|dsc|pxl|photo|image|screenshot)?\s*\d[\d\s]*$/i.test(base) || !/[a-z]{3}/i.test(base) ? '' : base.slice(0, 120);
};

async function call<T>(method: string, body?: unknown, query = ''): Promise<T> {
  const r = await fetch(`/api/sites/photos${query}`, { method, credentials: 'same-origin', headers: headers(body ? { 'content-type': 'application/json' } : {}), ...(body ? { body: JSON.stringify(body) } : {}) });
  const j = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!r.ok || !j) throw typeof j?.error === 'string' ? inHisWords(j.error) : new Error(`the brain answered ${r.status}`);
  return j;
}

/** The panel, in the Workshop's MADE section. */
export function mountSitePhotos(p: Panel): { refresh(): void } {
  p.el.dataset.panel = 'sitephotos';
  let photos: SitePhoto[] = [];
  let max = 24;
  let known = false;
  let failed = '';
  let busy = '';
  const input = h('input.sphFile', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': 'Choose photos for your sites' }) as HTMLInputElement;
  input.hidden = true;
  const said = h('p.note.sphSaid', { 'aria-live': 'polite' });
  const paint = () => {
    clear(p.body);
    p.setStatus(photos.length ? `${photos.length} OF ${max}` : '', 'ok');
    const add = button(busy ? 'WORKING…' : 'ADD PHOTOS', () => {
      if (busy) return;
      if (navigator.onLine === false) return void toast('You are offline: adding photos waits for a connection.', 'warn');
      input.click();
    }, 'on');
    add.setAttribute('aria-label', 'Add photos for your sites');
    if (busy) add.disabled = true;
    const top = h('div.sphTop', h('p.note', 'Your own photos for the sites I build you, instead of stock pictures. Each is made smaller on this phone and its location is removed before it leaves.'), h('p.note.sphAsk', PHOTOS_ASK), h('div.keyrow', add), said, input);
    if (!known && !failed) return void p.body.append(top, empty('LOADING'));
    if (failed && !photos.length) return void p.body.append(top, empty('ERROR', failed, 'Your photos did not load'));
    if (!photos.length) return void p.body.append(top, empty('NONE', 'Add photos of your place, your work or your products. Only use photos you have the right to share.', 'No photos yet'));
    const grid = h('div.sphGrid');
    photos.forEach((ph, i) => {
      const img = h('img.sphImg', { src: ph.src, alt: ph.caption || `Photo ${i + 1}`, loading: 'lazy', decoding: 'async' }) as HTMLImageElement;
      const cap = h('input.sphCap', { type: 'text', value: ph.caption, maxlength: 120, placeholder: 'What it shows (for screen readers)', 'aria-label': `Caption for photo ${i + 1}` }) as HTMLInputElement;
      cap.addEventListener('change', async () => {
        try {
          const r = await call<{ photos: SitePhoto[] }>('PATCH', { id: ph.id, caption: cap.value });
          photos = r.photos;
          toast('Caption kept', 'ok');
        } catch (e) {
          toast(sayError(e, 'keep the caption'), 'warn');
        }
      });
      const main = button(i === 0 ? 'MAIN PICTURE' : 'MAKE MAIN', async () => {
        if (i === 0) return;
        try {
          photos = (await call<{ photos: SitePhoto[] }>('PATCH', { id: ph.id, main: true })).photos;
          paint();
          toast('That is the main picture now', 'ok');
        } catch (e) {
          toast(sayError(e, 'make it the main picture'), 'warn');
        }
      }, i === 0 ? 'sphMain' : '');
      main.setAttribute('aria-label', i === 0 ? `Photo ${i + 1} is the main picture` : `Make photo ${i + 1} the main picture`);
      const drop = button('REMOVE', async () => {
        if (!(await confirmSheet('Remove this photo?', 'It comes off your list for new sites. A page already published with it keeps its picture.', 'REMOVE IT'))) return;
        try {
          const r = await call<{ photos: SitePhoto[]; keptFor: string[] }>('DELETE', undefined, `?id=${encodeURIComponent(ph.id)}`);
          photos = r.photos;
          paint();
          toast(r.keptFor.length ? `Removed from your list. ${r.keptFor.join(', ')} still shows it.` : 'Removed', 'ok');
        } catch (e) {
          toast(sayError(e, 'remove the photo'), 'warn');
        }
      }, 'warn');
      drop.setAttribute('aria-label', `Remove photo ${i + 1}`);
      grid.append(h('figure.sphCard', { dataset: { photo: ph.id } }, img, h('figcaption', cap, h('small', `${ph.width} × ${ph.height} · ${Math.max(1, Math.round(ph.bytes / 1024))} KB · no location`), h('div.keyrow', main, drop))));
    });
    p.body.append(top, grid);
  };
  input.addEventListener('change', async () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    const room = max - photos.length;
    if (room <= 0) return void (said.textContent = `You have ${max} photos kept, the most I keep. Remove one first.`);
    const take = files.slice(0, room);
    let done = 0;
    const problems: string[] = [];
    for (const f of take) {
      busy = `Making photo ${done + problems.length + 1} of ${take.length} smaller…`;
      paint();
      said.textContent = busy;
      try {
        const s = await shrink(f);
        said.textContent = `Keeping photo ${done + problems.length + 1} of ${take.length}…`;
        const r = await call<{ photos: SitePhoto[] }>('POST', { data: await b64(s.jpeg), caption: captionOf(f.name), width: s.width, height: s.height });
        photos = r.photos;
        done++;
      } catch (e) {
        problems.push(sayError(e, 'keep that photo'));
      }
    }
    busy = '';
    paint();
    said.textContent = [done ? `${done} photo${done === 1 ? '' : 's'} kept, smaller and with no location.` : '', files.length > take.length ? `${files.length - take.length} left out: ${max} is the most I keep.` : '', problems[0] ?? ''].filter(Boolean).join(' ');
  });
  const refresh = async () => {
    try {
      const r = await call<{ photos: SitePhoto[]; max: number }>('GET');
      photos = r.photos;
      max = r.max;
      known = true;
      failed = '';
    } catch (e) {
      failed = navigator.onLine === false ? 'You are offline. Your photos show again when you are back online.' : sayError(e, 'load your photos');
    }
    if (!busy) paint();
  };
  paint();
  void refresh();
  return { refresh: () => void refresh() };
}
