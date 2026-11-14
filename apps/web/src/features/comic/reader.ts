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
  panels(n: number, rtl?: boolean): Promise<[number, number, number, number][]>;
}

// ---- bookmarks, the night tint and the reading log, kept on this phone (small, so in localStorage; a private window keeps them for the visit)
const read = <T>(k: string, d: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? 'null') as T | null;
    return v ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* (for this visit only) */
  }
};
export const marksOf = (id: string): number[] => (read<Record<string, number[]>>('ghosty.comic.marks', {})[id] ?? []).filter((n) => Number.isInteger(n));
const keepMarks = (id: string, l: number[]) => write('ghosty.comic.marks', { ...read<Record<string, number[]>>('ghosty.comic.marks', {}), [id]: l });
const nightOn = (): boolean => read<boolean>('ghosty.comic.night', false) === true;
const keepNight = (on: boolean) => write('ghosty.comic.night', on);
export interface ReadingLog {
  /** by day (YYYY-MM-DD, local): pages turned and minutes read */
  days: Record<string, { pages: number; ms: number }>;
  /** by comic: pages seen at most, and whether he reached its end */
  books: Record<string, { pages: number; done: boolean; last: number }>;
}
export const readingLog = (): ReadingLog => {
  const l = read<ReadingLog>('ghosty.comic.log', { days: {}, books: {} });
  return { days: l.days ?? {}, books: l.books ?? {} };
};
function logReading(id: string, pages: number, ms: number, done: boolean): void {
  if (!pages) return;
  const l = readingLog();
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const t = l.days[day] ?? { pages: 0, ms: 0 };
  l.days[day] = { pages: t.pages + pages, ms: t.ms + Math.min(ms, 6 * 3_600_000) };
  const b = l.books[id] ?? { pages: 0, done: false, last: 0 };
  l.books[id] = { pages: Math.max(b.pages, pages), done: b.done || done, last: Date.now() };
  // (only the last 400 days are kept)
  const keys = Object.keys(l.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete l.days[k];
  write('ghosty.comic.log', l);
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
  let rtl = saved?.rtl ?? false;
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
  const manga = button('Right to left', () => {
    rtl = !rtl;
    panelsCache.clear();
    if (guided) panel = 0;
    void paint();
  }, 'g-key cxrkey');
  manga.setAttribute('aria-label', 'Read right to left, as manga is');
  const slider = h('input.cxrslide', { type: 'range', min: '1', max: String(src.count), value: String(page + 1), 'aria-label': 'Go to page' }) as HTMLInputElement;
  slider.addEventListener('change', () => go(Number(slider.value) - 1, -1));
  // ---- the thumbnail strip, bookmarks, the night tint and turning by itself (comic.u9)
  let marks = marksOf(src.id);
  const strip = h('div.cxrthumbs', { hidden: true, role: 'list', 'aria-label': 'Pages' });
  const thumbUrls: string[] = [];
  const paintStrip = () => {
    if (strip.hidden) return;
    if (!strip.childElementCount) {
      const seen = new IntersectionObserver((list) => {
        for (const x of list) {
          if (!x.isIntersecting) continue;
          const b = x.target as HTMLButtonElement;
          seen.unobserve(b);
          const n = Number(b.dataset.n);
          void src.page(n).then((blob) => {
            const u = URL.createObjectURL(blob);
            thumbUrls.push(u);
            b.prepend(h('img', { src: u, alt: '', loading: 'lazy', decoding: 'async' }));
          }).catch(() => undefined);
        }
      }, { root: strip, rootMargin: '200px' });
      for (let n = 0; n < src.count; n++) {
        const b = button(h('span.cxrthumbn', String(n + 1)), () => go(n, -1), 'cxrthumb');
        b.dataset.n = String(n);
        b.setAttribute('aria-label', `Page ${n + 1}`);
        b.setAttribute('role', 'listitem');
        strip.append(b);
        seen.observe(b);
      }
    }
    for (const b of strip.querySelectorAll<HTMLButtonElement>('.cxrthumb')) {
      const n = Number(b.dataset.n);
      b.classList.toggle('on', shown().includes(n));
      b.classList.toggle('marked', marks.includes(n));
      b.setAttribute('aria-current', String(shown().includes(n)));
    }
    strip.querySelector<HTMLElement>('.cxrthumb.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  };
  const pagesKey = button('Pages', () => {
    strip.hidden = !strip.hidden;
    pagesKey.setAttribute('aria-pressed', String(!strip.hidden));
    paintStrip();
    void paint();
  }, 'g-key cxrkey');
  pagesKey.setAttribute('aria-label', 'Show every page as a strip of small pictures');
  const markKey = button('Bookmark', () => {
    marks = marks.includes(page) ? marks.filter((x) => x !== page) : [...marks, page].sort((a, b) => a - b);
    keepMarks(src.id, marks);
    paintMarks();
    paintStrip();
  }, 'g-key cxrkey');
  const paintMarks = () => {
    const on = marks.includes(page);
    markKey.textContent = on ? 'Bookmarked' : 'Bookmark';
    markKey.setAttribute('aria-pressed', String(on));
    markKey.setAttribute('aria-label', on ? `Take the bookmark off page ${page + 1}` : `Bookmark page ${page + 1}`);
    comicState.reader.marks = [...marks];
  };
  let night = nightOn();
  const nightKey = button('Night', () => {
    night = !night;
    keepNight(night);
    root.classList.toggle('night', night);
    nightKey.setAttribute('aria-pressed', String(night));
    comicState.reader.night = night;
  }, 'g-key cxrkey');
  nightKey.setAttribute('aria-label', 'Night reading: a warmer, dimmer page');
  nightKey.setAttribute('aria-pressed', String(night));
  let every = 0;
  let timer = 0;
  const autoKey = button('Auto', () => {
    every = every === 0 ? 8 : every === 8 ? 15 : 0;
    clearInterval(timer);
    if (every) timer = window.setInterval(() => {
      const last = guided ? false : shown().includes(src.count - 1);
      if (last) {
        every = 0;
        clearInterval(timer);
        paintAuto();
        return;
      }
      void step(1);
    }, every * 1000);
    paintAuto();
  }, 'g-key cxrkey');
  const paintAuto = () => {
    autoKey.textContent = every ? `Auto · ${every} s` : 'Auto';
    autoKey.setAttribute('aria-pressed', String(!!every));
    autoKey.setAttribute('aria-label', every ? `Turning every ${every} seconds; tap for ${every === 8 ? '15 seconds' : 'off'}` : 'Turn the pages by themselves');
    comicState.reader.auto = every;
  };
  paintAuto();
  const root = h('div.cxread', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `Reading ${src.title}` },
    h('div.cxrtop', close, title, where),
    stage,
    note,
    strip,
    h('div.cxrbar', prev, guide, zout, zin, two, manga, next),
    h('div.cxrbar', pagesKey, markKey, nightKey, autoKey),
    slider,
  );
  root.classList.toggle('night', night);
  // ---- the reading log (comic.s7): pages turned and time spent, kept on this phone
  const opened = Date.now();
  const seenPages = new Set<number>();
  document.body.append(root);
  comicState.reader = { open: true, id: src.id, page, panel, guided, rtl, zoom, spread: false, pages: src.count, shown: [], marks: [...marks], night, auto: 0, turned: 0 };

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
      p = await src.panels(n, rtl);
      panelsCache.set(n, p);
    }
    return p;
  };
  const record = () => {
    for (const n of shown()) seenPages.add(n);
    paintMarks();
    paintStrip();
    Object.assign(comicState.reader, { page, panel, guided, rtl, zoom, spread: shown().length === 2, shown: shown() });
    void keepPlace(src.id, { page, panel: guided ? panel : -1, at: Date.now(), rtl }).catch(() => undefined);
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
      clear(sheet, ...(rtl ? [...imgs].reverse() : imgs));
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
      manga.setAttribute('aria-pressed', String(rtl));
      slider.style.direction = rtl ? 'rtl' : '';
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
    const to = Math.max(0, Math.min(src.count - 1, n));
    if (to !== page && !guided) {
      // a page turn, the way it is going (no motion when he asks for calm)
      sheet.classList.remove('turnnext', 'turnback');
      void sheet.offsetWidth;
      sheet.classList.add((to > page) !== rtl ? 'turnnext' : 'turnback');
      comicState.reader.turned++;
    }
    page = to;
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
    if ((zoom === 1 || guided) && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) void step((dx < 0) !== rtl ? 1 : -1);
    else if (quick && Math.hypot(dx, dy) < 12) {
      const now = Date.now();
      if (now - lastTap < 300) setZoom(zoom > 1 ? 1 : 2.2);
      else if (zoom === 1 || guided) {
        const r = stage.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width;
        if (fx < 0.3) void step(rtl ? 1 : -1);
        else if (fx > 0.7) void step(rtl ? -1 : 1);
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
    if (e.key === 'PageDown' || e.key === ' ') void step(1);
    else if (e.key === 'PageUp') void step(-1);
    else if (e.key === 'ArrowRight') void step(rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') void step(rtl ? 1 : -1);
    else if (e.key === 'Escape') shut();
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', key);
  const ro = new ResizeObserver(() => void paint());
  ro.observe(stage);
  const shut = () => {
    clearInterval(timer);
    for (const u of thumbUrls) URL.revokeObjectURL(u);
    logReading(src.id, seenPages.size, Date.now() - opened, Math.max(...seenPages, 0) >= src.count - 1);
    dispatchEvent(new Event('ghosty:comic-read'));
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
