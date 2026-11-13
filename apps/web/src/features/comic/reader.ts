/**
 * THE COMIC READER (FINAL ROUND, lane COMIC): a comic read full screen, as the best comic readers do it.
 *  - Page turns: the keys at the foot, a swipe, a tap on the left or right third, the arrow keys, the page slider.
 *  - GUIDED: panel by panel, each panel filling the screen in reading order (the panels found on the page, or a made comic's
 *    own grid), and on to the next page's first.
 *  - Zoom: + and −, a pinch, a double tap; drag to look around when zoomed.
 *  - Two pages side by side on a wide screen (the cover alone, then pairs), and one at a time on the phone.
 *  - Where he stopped (page and panel) is kept on this phone and comes back when he opens it again.
 * ✕ or Escape closes it and gives the screen back.
 */
import { clear, h } from '../../core/dom';
import { button } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { keepPlace, placeOf } from './store';
import { comicState } from './state';

export interface ReadSource {
  id: string;
  title: string;
  count: number;
  page(n: number): Promise<Blob>;
  panels(n: number): Promise<[number, number, number, number][]>;
}

let open: { close(): void } | null = null;
let opening = 0;
export const readerOpen = (): boolean => !!open;
export function closeReader(): void {
  open?.close();
}

export async function openReader(src: ReadSource, at?: number): Promise<void> {
  open?.close();
  const ticket = ++opening;
  const saved = await placeOf(src.id).catch(() => undefined);
  // (a second tap while this one was reading its place: the newer one opens, this one stops here)
  if (ticket !== opening) return;
  open?.close();
  let page = Math.max(0, Math.min(src.count - 1, at ?? saved?.page ?? 0));
  let panel = at == null ? saved?.panel ?? -1 : -1;
  let guided = panel >= 0;
  let zoom = 1;
  let tx = 0;
  let ty = 0;
  let ox = 0;
  let oy = 0;
  let spreadOn = true;
  const urls = new Map<number, string>();
  const panelsCache = new Map<number, [number, number, number, number][]>();

  const title = h('div.cxrtitle', src.title);
  const where = h('div.cxrwhere', { 'aria-live': 'polite' });
  const close = button('✕', () => shut(), 'g-key cxrkey');
  close.setAttribute('aria-label', 'Close the comic');
  const sheet = h('div.cxrsheet');
  const stage = h('div.cxrstage', { role: 'img', 'aria-label': src.title, tabindex: '0' }, sheet);
  const note = h('p.cxrnote', { 'aria-live': 'polite', dataset: { state: 'loading' } }, 'Opening the comic…');
  const prev = button('‹ Back', () => step(-1), 'g-key cxrkey');
  prev.setAttribute('aria-label', 'Previous page');
  const next = button('Next ›', () => step(1), 'g-key cxrkey');
  next.setAttribute('aria-label', 'Next page');
  const guide = button('Guided', () => setGuided(!guided), 'g-key cxrkey');
  guide.setAttribute('aria-label', 'Guided view: one panel at a time');
  const zin = button('+', () => setZoom(zoom * 1.5), 'g-key cxrkey');
  zin.setAttribute('aria-label', 'Zoom in');
  const zout = button('−', () => setZoom(zoom / 1.5), 'g-key cxrkey');
  zout.setAttribute('aria-label', 'Zoom out');
  const two = button('Two pages', () => {
    spreadOn = !spreadOn;
    void paint();
  }, 'g-key cxrkey');
  two.setAttribute('aria-label', 'Two pages side by side');
  const slider = h('input.cxrslide', { type: 'range', min: '1', max: String(src.count), value: String(page + 1), 'aria-label': 'Go to page' }) as HTMLInputElement;
  slider.addEventListener('change', () => go(Number(slider.value) - 1, -1));
  const root = h('div.cxread', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `Reading ${src.title}` },
    h('div.cxrtop', close, title, where),
    stage,
    note,
    h('div.cxrbar', prev, guide, zout, zin, two, next),
    slider,
  );
  document.body.append(root);
  comicState.reader = { open: true, id: src.id, page, panel, guided, zoom, spread: false, pages: src.count, shown: [] };

  const wide = () => stage.clientWidth > stage.clientHeight * 1.05 && innerWidth >= 700;
  /** The pages on screen now: the cover alone, then pairs when two fit. */
  const shown = (): number[] => {
    if (guided || !spreadOn || !wide() || page === 0) return [page];
    const first = page % 2 === 1 ? page : page - 1;
    return first + 1 < src.count ? [first, first + 1] : [first];
  };
  const urlOf = async (n: number) => {
    let u = urls.get(n);
    if (!u) {
      u = URL.createObjectURL(await src.page(n));
      urls.set(n, u);
    }
    return u;
  };
  const panelsAt = async (n: number) => {
    let p = panelsCache.get(n);
    if (!p) {
      p = await src.panels(n);
      panelsCache.set(n, p);
    }
    return p;
  };
  const record = () => {
    Object.assign(comicState.reader, { page, panel, guided, zoom, spread: shown().length === 2, shown: shown() });
    void keepPlace(src.id, { page, panel: guided ? panel : -1, at: Date.now() }).catch(() => undefined);
  };
  const apply = () => {
    sheet.style.transform = `translate(${ox + tx}px, ${oy + ty}px) scale(${zoom})`;
  };
  let painting = 0;
  const paint = async () => {
    const ticket = ++painting;
    const list = shown();
    try {
      const imgs = await Promise.all(list.map(async (n) => {
        const img = h('img.cxrpage', { alt: `Page ${n + 1}`, src: await urlOf(n), draggable: false }) as HTMLImageElement;
        await img.decode().catch(() => undefined);
        return img;
      }));
      if (ticket !== painting) return;
      clear(sheet, ...imgs);
      // (only the pages near this one stay held: a 400-page book never fills the phone's memory)
      for (const [n, u] of urls) if (Math.abs(n - page) > 3) {
        URL.revokeObjectURL(u);
        urls.delete(n);
      }
      /* state: comic.reader loading */
      note.hidden = true;
      // fit the pages to the stage
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const ratio = imgs.reduce((a, i) => a + (i.naturalWidth || 2) / (i.naturalHeight || 3), 0);
      const hh = Math.min(sh, sw / ratio);
      for (const i of imgs) i.style.height = `${hh}px`;
      sheet.style.width = `${hh * ratio}px`;
      sheet.style.height = `${hh}px`;
      ox = (sw - hh * ratio) / 2;
      oy = (sh - hh) / 2;
      if (guided) {
        const ps = await panelsAt(page);
        if (panel < 0 || panel >= ps.length) panel = panel < 0 ? 0 : ps.length - 1;
        const [fx, fy, fw, fh] = ps[panel]!;
        const W = hh * ratio;
        zoom = Math.min(8, Math.min(sw / (fw * W), sh / (fh * hh)) * 0.98);
        tx = sw / 2 - ox - (fx + fw / 2) * W * zoom;
        ty = sh / 2 - oy - (fy + fh / 2) * hh * zoom;
      } else if (zoom === 1) {
        tx = 0;
        ty = 0;
      }
      apply();
      where.textContent = list.length === 2 ? `Pages ${list[0]! + 1}–${list[1]! + 1} of ${src.count}` : `Page ${page + 1} of ${src.count}${guided ? `, panel ${panel + 1} of ${(await panelsAt(page)).length}` : ''}`;
      slider.value = String(page + 1);
      guide.setAttribute('aria-pressed', String(guided));
      two.hidden = !wide() || guided;
      two.setAttribute('aria-pressed', String(spreadOn));
      prev.disabled = page === 0 && (!guided || panel <= 0);
      next.disabled = page >= src.count - 1 && (!guided || panel >= (await panelsAt(page)).length - 1);
      record();
    } catch (e) {
      if (ticket !== painting) return;
      /* state: comic.reader error */
      note.hidden = false;
      note.dataset.state = 'error';
      note.textContent = sayError(e, 'show this page');
    }
  };
  const go = (n: number, pn: number) => {
    page = Math.max(0, Math.min(src.count - 1, n));
    panel = pn;
    zoom = 1;
    tx = ty = 0;
    void paint();
  };
  const step = async (d: 1 | -1) => {
    if (guided) {
      const ps = await panelsAt(page);
      const np = panel + d;
      if (np >= 0 && np < ps.length) return go(page, np);
      if (d > 0 && page < src.count - 1) return go(page + 1, 0);
      if (d < 0 && page > 0) return go(page - 1, (await panelsAt(page - 1)).length - 1);
      return;
    }
    const list = shown();
    if (d > 0) go(list[list.length - 1]! + 1, -1);
    else go(list[0]! - 1, -1);
  };
  const setGuided = (on: boolean) => {
    guided = on;
    panel = on ? 0 : -1;
    zoom = 1;
    tx = ty = 0;
    void paint();
  };
  /** Guided ends when he zooms or pinches himself: the keys and the line say so at once. */
  const leaveGuided = () => {
    if (!guided) return;
    guided = false;
    panel = -1;
    guide.setAttribute('aria-pressed', 'false');
    two.hidden = !wide();
    where.textContent = `Page ${page + 1} of ${src.count}`;
  };
  const setZoom = (z: number) => {
    leaveGuided();
    const nz = Math.max(1, Math.min(5, z));
    const cx = stage.clientWidth / 2 - ox;
    const cy = stage.clientHeight / 2 - oy;
    tx = cx - ((cx - tx) * nz) / zoom;
    ty = cy - ((cy - ty) * nz) / zoom;
    zoom = nz;
    if (zoom === 1) tx = ty = 0;
    apply();
    record();
  };

  // touch: a swipe turns, a tap on a side turns, a double tap zooms, two fingers pinch, a drag pans when zoomed
  const pts = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number; t: number; tx: number; ty: number; d: number; z: number } | null = null;
  let lastTap = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pts.values()];
    start = { x: e.clientX, y: e.clientY, t: Date.now(), tx, ty, d: b ? Math.hypot(a!.x - b.x, a!.y - b.y) : 0, z: zoom };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pts.values()];
    if (b && start.d) {
      zoom = Math.max(1, Math.min(5, (start.z * Math.hypot(a!.x - b.x, a!.y - b.y)) / start.d));
      leaveGuided();
      apply();
    } else if (zoom > 1 && !guided) {
      tx = start.tx + e.clientX - start.x;
      ty = start.ty + e.clientY - start.y;
      apply();
    }
  });
  const up = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (!start || pts.size) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const quick = Date.now() - start.t < 350;
    if ((zoom === 1 || guided) && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) void step(dx < 0 ? 1 : -1);
    else if (quick && Math.hypot(dx, dy) < 12) {
      const now = Date.now();
      if (now - lastTap < 300) setZoom(zoom > 1 ? 1 : 2.2);
      else if (zoom === 1 || guided) {
        const r = stage.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width;
        if (fx < 0.3) void step(-1);
        else if (fx > 0.7) void step(1);
      }
      lastTap = now;
    } else if (!guided && wide() && spreadOn && shown().length !== comicState.reader.shown.length) void paint();
    else record();
    start = null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9));
  }, { passive: false });
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') void step(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') void step(-1);
    else if (e.key === 'Escape') shut();
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', key);
  const ro = new ResizeObserver(() => void paint());
  ro.observe(stage);
  const shut = () => {
    removeEventListener('keydown', key);
    ro.disconnect();
    for (const u of urls.values()) URL.revokeObjectURL(u);
    root.remove();
    open = null;
    comicState.reader.open = false;
  };
  open = { close: shut };
  close.focus();
  await paint();
}
