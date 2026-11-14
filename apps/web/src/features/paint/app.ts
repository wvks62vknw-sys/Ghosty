/**
 * PAINT (APPS ROUND, lane COMIC; MAKE): Ghosty's drawing app. Three pages:
 *  - GALLERY: every painting on this phone, newest first, with search, NEW, OPEN, TIME-LAPSE, DUPLICATE and DELETE (to
 *    Recently deleted, kept 30 days). The first visit makes a sample painting, so the gallery is never empty, with a three-step
 *    tour.
 *  - COLOURING: open line art drawn by this app, or his own photo turned into outlines, ready for the bucket.
 *  - SETTINGS: the pressure curve, finger smoothing and stabiliser, palm rejection, QuickShape, two-finger taps, the sound cue,
 *    and a short help.
 * The studio itself (features/paint/studio.ts) opens full screen over the page.
 */
import { clear, h } from '../../core/dom';
import { button } from '../../ui/components';
import { sayError, trail } from '../../ui/hisWords';
import { emptyState, stateLine } from '../lifeui';
import { brushOf } from './brushes';
import { mk, Painting, layerId, pack, type Op } from './engine';
import { bodyOf, openBody, thumbOf, versionOf } from './io';
import { blobOf, PAGES, pageLines, photoLines, type PageKind } from './pages';
import { paintState } from './state';
import { artOf, bodyOf as savedBody, forget, gallery, galleryInfo, keep, keepArt, keepVersion, restore, toBin, versionsOf, type Art } from './store';
import { openStudio, prefs, PREF_DEFAULTS, setPrefs } from './studio';
import { askBrain } from '../../docs/ask';
import type { Pt } from './stroke';

export const SIZES: { id: string; name: string; w: number; h: number }[] = [
  { id: 'portrait', name: 'Portrait 1200 × 1600', w: 1200, h: 1600 },
  { id: 'square', name: 'Square 1500 × 1500', w: 1500, h: 1500 },
  { id: 'landscape', name: 'Landscape 1600 × 1200', w: 1600, h: 1200 },
  { id: 'wallpaper', name: 'Phone wallpaper 1080 × 1920', w: 1080, h: 1920 },
  { id: 'comic', name: 'Comic page 1200 × 1800', w: 1200, h: 1800 },
];

const key = (label: string, fn: () => void, aria?: string, cls = ''): HTMLButtonElement => {
  const b = button(label, () => fn(), `g-key pxkey${cls ? ` ${cls}` : ''}`);
  b.dataset.g = 'key';
  b.dataset.case = 'keep';
  delete b.dataset.label;
  if (aria) b.setAttribute('aria-label', aria);
  return b;
};
const newId = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const when = (t: number): string => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let host: HTMLElement | null = null;
let studio: { stop(): void } | null = null;
const listeners = new Set<() => void>();
const refresh = (): void => { for (const f of listeners) f(); };

export async function countGallery(): Promise<void> {
  const g = await gallery();
  paintState.count = g.live.length;
  paintState.bin = g.bin.length;
}

/** The palette Ghosty suggests for a mood: six colours as codes, read from his reply. */
export async function askPalette(mood: string): Promise<string[]> {
  const r = await askBrain(`PAINT PALETTE: suggest six colours that paint "${mood.slice(0, 80)}". Reply with six hex colour codes only, like #1d6fd8, one on each row.`, () => undefined, 'paint');
  return [...new Set((r.text.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toLowerCase()))].slice(0, 8);
}

// ---------------------------------------------------------------- a painting's life: new, open, keep, close
async function create(title: string, w: number, h: number, from: string, setup: (p: Painting) => Promise<void> | void): Promise<string> {
  const p = new Painting(w, h);
  p.addLayer('Background', 0);
  await setup(p);
  if (p.layers.length === 1) p.addLayer('Layer 1');
  const id = newId();
  const art: Art = { id, title, w, h, paper: p.paper, created: Date.now(), edited: Date.now(), strokes: 0, secs: 0, from, thumb: await thumbOf(p) };
  await keep(art, await bodyOf(p));
  return id;
}

export async function openPainting(id: string): Promise<void> {
  if (!host) return;
  const art = await artOf(id);
  const body = await savedBody(id);
  if (!art || !body) { paintState.error = 'That painting is no longer on this phone.'; return; }
  studio?.stop();
  let p = await openBody(art.w, art.h, art.paper, body.layers, body.log, body.cur);
  let a = art;
  const opened = Date.now();
  const startStrokes = p.log.length;
  Object.assign(paintState, { id, title: art.title, error: '' });
  const save = async (): Promise<void> => {
    a = { ...a, paper: p.paper, edited: Date.now(), strokes: p.log.filter((o) => o.k === 'stroke' || o.k === 'fill').length, secs: a.secs + Math.round((Date.now() - opened) / 1000), thumb: await thumbOf(p) };
    await keep(a, await bodyOf(p));
  };
  const s = openStudio(host, {
    p, title: art.title,
    save,
    ask: askPalette,
    versions: () => versionsOf(id),
    restoreVersion: async (i) => {
      const v = (await versionsOf(id))[i];
      if (!v) return;
      await keepVersion(id, await versionOf(p));
      const back = await openBody(a.w, a.h, p.paper, v.layers, p.log, 0);
      // going back is itself a step in the time-lapse: each layer's pixels as they were
      for (const L of back.layers) p.log.push({ k: 'pixels', L: L.id, png: await blobOf(L.c), x: 0, y: 0, w: a.w, h: a.h });
      back.log = p.log;
      p = back;
      await save();
      await openPainting(id);
    },
    close: () => {
      void (async () => {
        try {
          await save();
          if (p.log.length > startStrokes) await keepVersion(id, await versionOf(p));
        } catch (e) { trail(e, 'paint close'); }
        studio?.stop(); studio = null;
        Object.assign(paintState, { open: false, id: '', title: '' });
        await countGallery();
        refresh();
      })();
    },
  });
  studio = s;
}

/** The first visit: a sample painting drawn stroke by stroke, so its time-lapse plays too. */
async function sample(): Promise<string> {
  return create('Sample: sunset over the hills', 1200, 1600, 'sample', (p) => {
    const L0 = p.layers[0]!.id;
    const P = (x: number, y: number, pr = 0.8): Pt => ({ x, y, p: pr, alt: Math.PI / 2, az: 0, t: 0 });
    const line = (pts: Pt[], brush: string, col: string, size: number, opacity = 1, L = p.layer.id, flow?: number): void => {
      const b = { ...brushOf(brush), size, opacity, ...(flow ? { flow } : {}) };
      p.cur = p.indexOf(L);
      p.begin('brush', b, false, null);
      p.end({ k: 'stroke', L, tool: 'brush', b, col, sym: 'off', cx: 600, cy: 800, seed: pts.length * 7 + size, pts: pack(pts), onMask: false, sel: null });
    };
    // the sky: airbrush bands from deep blue to orange
    const bands: [number, string][] = [[120, '#2b1d3a'], [320, '#5b2a5e'], [520, '#a63a50'], [700, '#e86a4a'], [860, '#f6a95b']];
    for (const [y, c] of bands) line(Array.from({ length: 14 }, (_, i) => P(-60 + i * 100, y + Math.sin(i) * 20, 0.9)), 'airbrush', c, 420, 1, L0, 0.5);
    line(Array.from({ length: 14 }, (_, i) => P(-60 + i * 100, 1000, 0.9)), 'airbrush', '#fbe3a1', 300, 1, L0, 0.5);
    // the sun, a clean circle
    p.addLayer('Sun', 1);
    const sun = p.layer.id;
    line(Array.from({ length: 50 }, (_, i) => { const a = (i / 49) * Math.PI * 2; return P(780 + Math.cos(a) * 120, 900 + Math.sin(a) * 120); }), 'ink', '#fbe3a1', 14, 1, sun);
    p.fill(sun, 780, 900, '#fbe3a1', 24, false, null);
    // three hills, filled
    p.addLayer('Hills', 2);
    const hills = p.layer.id;
    const hill = (y: number, amp: number, phase: number, col: string): void => {
      const pts = Array.from({ length: 30 }, (_, i) => P(-20 + i * 43, y - Math.sin(i / 4 + phase) * amp));
      line([...pts, P(1240, 1640), P(-40, 1640), pts[0]!], 'ink', col, 10, 1, hills);
      p.fill(hills, 600, Math.min(1590, y + amp + 60), col, 30, false, null);
    };
    hill(1050, 70, 0.3, '#4f2a4e');
    hill(1220, 90, 2.1, '#2e1d36');
    hill(1400, 60, 4.0, '#1b1424');
    // birds in ink
    p.addLayer('Ink', 3);
    const ink = p.layer.id;
    for (const [x, y, s] of [[320, 520, 1], [400, 470, 0.8], [470, 560, 0.7]] as const) {
      line([P(x - 30 * s, y - 10 * s, 0.3), P(x - 12 * s, y - 18 * s, 0.9), P(x, y, 0.7), P(x + 14 * s, y - 20 * s, 0.9), P(x + 32 * s, y - 8 * s, 0.3)], 'ink', '#1b1424', 7, 1, ink);
    }
    p.setProp(sun, 'blend', 'screen');
  });
}

async function fromPage(kind: PageKind | 'photo', file?: File): Promise<string> {
  const w = 1200, hgt = 1600;
  const lines = kind === 'photo' ? await photoLines(file!, w, hgt, 0.55) : pageLines(kind, w, hgt);
  const png = await blobOf(lines);
  const title = kind === 'photo' ? `Colouring page from ${file?.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'my photo'}` : `Colouring: ${PAGES.find((x) => x.id === kind)?.name ?? 'page'}`;
  return create(title, w, hgt, kind === 'photo' ? 'photo' : 'page', async (p) => {
    p.addLayer('Colour', 1);
    p.addLayer('Lines', 2);
    const lid = p.layer.id;
    await p.placeAsync(lid, png);
    p.setProp(lid, 'reference', true);
    p.setProp(lid, 'alphaLock', true);
    p.cur = p.indexOf(p.layers.find((L) => L.name === 'Colour')!.id);
  });
}

// ---------------------------------------------------------------- the pages
function bindHost(_el: HTMLElement): void {
  // the studio opens full screen over everything, as the comic reader does
  host = document.body;
}

export function galleryPart(): { el: HTMLElement; stop(): void } {
  const list = h('div.pxgallery');
  const binList = h('div.pxgallery');
  const note = h('p.pxnote', { role: 'status' });
  const find = h('input', { type: 'search', placeholder: 'Find a painting', 'aria-label': 'Find a painting by its title' }) as HTMLInputElement;
  const size = h('select', { 'aria-label': 'Canvas size' }, ...SIZES.map((s) => h('option', { value: s.id }, s.name))) as HTMLSelectElement;
  const tour = h('ol.pxtour',
    h('li', 'Tap NEW PAINTING, or open the sample below.'),
    h('li', 'Draw with a finger or an Apple Pencil. Pinch to zoom; a two-finger tap undoes.'),
    h('li', 'Open MORE in the studio to play the time-lapse or save a layered PSD.'));
  const el = h('div.px.pxcol',
    h('div.pxrow', h('label.pxfield', h('span.pxlab', 'Canvas'), size), key('NEW PAINTING', () => void startNew(), 'Start a new painting')),
    note, h('label.pxfield', h('span.pxlab', 'Search'), find), list,
    h('details.pxbin', h('summary', 'Recently deleted'), h('p.pxsmall', 'Deleted paintings wait here for 30 days, then go for good.'), binList),
    tour);
  bindHost(el);
  const startNew = async (): Promise<void> => {
    const s = SIZES.find((x) => x.id === size.value) ?? SIZES[0]!;
    try {
      const n = paintState.count + 1;
      const id = await create(`Painting ${n}`, s.w, s.h, 'blank', () => undefined);
      await countGallery();
      await openPainting(id);
    } catch (e) { note.textContent = sayError(e, 'start a painting'); }
  };
  let all: Art[] = [];
  const urls: string[] = [];
  const card = (a: Art, inBin: boolean): HTMLElement => {
    const img = a.thumb ? (() => { const u = URL.createObjectURL(a.thumb); urls.push(u); return h('img.pxcover', { src: u, alt: `${a.title}, a painting` }); })() : h('div.pxcover.none', '✎');
    const keys = inBin
      ? [key('RESTORE', async () => { await restore(a.id); await countGallery(); void paint(); }, `Restore ${a.title}`), key('DELETE FOREVER', async () => { await forget(a.id); await countGallery(); void paint(); }, `Delete ${a.title} for good`)]
      : [key('OPEN', () => void openPainting(a.id), `Open ${a.title}`),
        key('DUPLICATE', async () => { const b = await savedBody(a.id); if (!b) return; const id = newId(); await keep({ ...a, id, title: `${a.title} copy`, created: Date.now(), edited: Date.now() }, b); await countGallery(); void paint(); }, `Duplicate ${a.title}`),
        key('RENAME', async () => { const t = prompt('Painting name', a.title); if (t && t.trim()) { await keepArt({ ...a, title: t.trim().slice(0, 60) }); void paint(); } }, `Rename ${a.title}`),
        key('DELETE', async () => { await toBin(a.id); await countGallery(); note.textContent = `${a.title} is in Recently deleted for 30 days.`; void paint(); }, `Delete ${a.title}`)];
    return h('div.pxcard', { dataset: { id: a.id } }, img, h('div.pxcardwords', h('p.pxcardtitle', a.title), h('p.pxsmall', `${a.w} × ${a.h} · ${a.strokes} ${a.strokes === 1 ? 'step' : 'steps'} · ${when(a.edited)}`), h('div.pxrow', ...keys)));
  };
  const show = (): void => {
    clear(list);
    const q = find.value.trim().toLowerCase();
    const shown = q ? all.filter((a) => a.title.toLowerCase().includes(q)) : all;
    paintState.gallery.titles = shown.map((a) => a.title);
    if (!all.length) list.append(emptyState('No paintings yet', 'Tap NEW PAINTING to start one.'));
    else if (!shown.length) list.append(emptyState('Nothing by that name', `No painting’s title has “${q}” in it.`));
    else list.append(...shown.map((a) => card(a, false)));
  };
  find.addEventListener('input', show);
  const paint = async (): Promise<void> => {
    paintState.gallery.state = 'loading';
    clear(list); list.append(stateLine('loading', 'Opening your gallery…'));
    try {
      let g = await gallery();
      if (!g.live.length && !g.bin.length && !localStorage.getItem('ghosty.paint.sampled')) {
        try { localStorage.setItem('ghosty.paint.sampled', '1'); } catch { /* the sample is made once per visit then */ }
        await sample();
        g = await gallery();
      }
      all = g.live;
      paintState.count = g.live.length; paintState.bin = g.bin.length;
      show();
      clear(binList);
      if (g.bin.length) binList.append(...g.bin.map((a) => card(a, true))); else binList.append(h('p.pxsmall', 'Nothing deleted.'));
      if (!galleryInfo.lasting) note.textContent = 'This browser keeps no files, so your paintings last for this visit only. Save a PNG or PSD to keep one.';
      tour.hidden = g.live.length > 2;
      paintState.gallery.state = all.length ? 'ready' : 'empty';
    } catch (e) { paintState.gallery.state = 'error'; clear(list); list.append(stateLine('error', sayError(e, 'open your gallery'))); }
  };
  listeners.add(paint);
  void paint();
  return { el, stop: () => { listeners.delete(paint); for (const u of urls) URL.revokeObjectURL(u); studio?.stop(); studio = null; } };
}

export function colouringPart(): { el: HTMLElement; stop(): void } {
  const note = h('p.pxnote', { role: 'status' });
  const pick = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
  const go = async (kind: PageKind | 'photo', file?: File): Promise<void> => {
    note.textContent = kind === 'photo' ? 'Finding the outlines in your photo…' : 'Drawing the page…';
    try {
      const id = await fromPage(kind, file);
      note.textContent = '';
      await countGallery();
      await openPainting(id);
    } catch (e) { note.textContent = sayError(e, 'make the colouring page'); }
  };
  pick.addEventListener('change', () => { const f = pick.files?.[0]; pick.value = ''; if (f) void go('photo', f); });
  const cards = PAGES.map((pg) => {
    const c = pageLines(pg.id, 300, 400);
    const prev = mk(150, 200);
    const g = prev.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, 150, 200); g.drawImage(c, 0, 0, 150, 200);
    prev.className = 'pxcover';
    prev.setAttribute('role', 'img'); prev.setAttribute('aria-label', `${pg.name}: ${pg.says}`);
    return h('div.pxcard', prev, h('div.pxcardwords', h('p.pxcardtitle', pg.name), h('p.pxsmall', pg.says), key('COLOUR THIS', () => void go(pg.id), `Colour the ${pg.name}`)));
  });
  const el = h('div.px.pxcol',
    h('p.pxsmall', 'The lines sit on a locked reference layer, so the FILL bucket stops at them and your colour goes on the layer under them.'),
    key('FROM MY PHOTO', () => pick.click(), 'Turn one of your photos into a colouring page'),
    h('p.pxsmall', 'Your photo is turned into outlines on this phone. It is never sent anywhere.'),
    note, pick, h('div.pxgallery', ...cards));
  bindHost(el);
  return { el, stop: () => undefined };
}

export function settingsPart(): { el: HTMLElement; stop(): void } {
  const pf = prefs();
  const sel = (label: string, value: string, opts: [string, string][], on: (v: string) => void): HTMLElement => {
    const s = h('select', { 'aria-label': label }, ...opts.map(([v, n]) => h('option', { value: v, selected: v === value }, n))) as HTMLSelectElement;
    s.addEventListener('change', () => on(s.value));
    return h('label.pxfield', h('span.pxlab', label), s);
  };
  const check = (label: string, on: boolean, set: (v: boolean) => void): HTMLElement => h('label.pxcheck', h('input', { type: 'checkbox', checked: on, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), label);
  const el = h('div.px.pxcol',
    sel('Apple Pencil pressure', pf.curve, [['soft', 'Soft: full ink with a light touch'], ['even', 'Even'], ['firm', 'Firm: press harder for full ink']], (v) => setPrefs({ curve: v as typeof pf.curve })),
    sel('Finger smoothing', String(pf.smooth), [['0', 'Off'], ['0.2', 'A little'], ['0.35', 'Some'], ['0.6', 'Smooth'], ['0.85', 'Very smooth']], (v) => setPrefs({ smooth: Number(v) })),
    sel('Stabiliser (the line trails your finger on a string)', String(pf.lazy), [['0', 'Off'], ['6', 'Short'], ['14', 'Medium'], ['28', 'Long']], (v) => setPrefs({ lazy: Number(v) })),
    check('Only the Apple Pencil draws once it has touched the glass (your palm never does)', pf.pencilOnly, (v) => setPrefs({ pencilOnly: v })),
    check('QuickShape: hold still at the end of a stroke to snap a line, circle, oval or box', pf.quick, (v) => setPrefs({ quick: v })),
    check('Two-finger tap undoes, three-finger tap redoes', pf.taps, (v) => setPrefs({ taps: v })),
    check('A soft click on undo, redo and snaps', pf.cue, (v) => setPrefs({ cue: v })),
    key('PUT THE DEFAULTS BACK', () => { setPrefs(PREF_DEFAULTS); clear(el.parentElement ?? el); }, 'Put every Paint setting back to its default'),
    h('p.pxcardtitle', 'Help'),
    h('ul.pxhelp',
      h('li', 'Six brushes: pencil (tilt to shade), ink, marker, watercolour, oils and airbrush. Size and opacity sit above the tools.'),
      h('li', 'Layers have blend modes, opacity, alpha lock, a mask and a reference flag. Up to 12 layers.'),
      h('li', 'SELECT draws round a part; brushes and fills then stay inside it, and MOVE moves just that part.'),
      h('li', 'MORE has symmetry guides, the time-lapse (play it or save it as a video), and PNG, JPEG, layered PSD and OpenRaster files.'),
      h('li', 'Everything is kept on this phone as you go. Each time you leave a painting you changed, a version is kept.')));
  return { el, stop: () => undefined };
}

export const paintLogOps = (log: Op[]): number => log.filter((o) => o.k === 'stroke').length;
export { layerId };
