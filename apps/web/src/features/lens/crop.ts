/**
 * The picture-search sheet: a crop over a still (drag a box, drag its corners, or USE WHOLE
 * PICTURE), then a link for the engines — the crop is shared through the brain as a JPEG
 * (≤ 1.5 MB) and is reachable by that link for 24 hours; FORGET NOW takes it down. Each engine is
 * named plainly and opens in a new tab: Google Lens, Bing Visual Search, Yandex Images, TinEye.
 */
import { clear, h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { clampBox, handleAt, handlePoints, moveRect, normalizeRect, resizeRect, wholeFrame, type Box, type Handle } from '../../vision/boxes';
import { cropCanvas, toJpegBlob } from '../../vision/camera';
import { engineUrls, expiresText, SHARE_MAX_BYTES, type ShareInfo } from '../../vision/engines';

export interface CropOptions {
  /** Start with this box (a detection's crop); else the whole picture. */
  rect?: Box;
  share(blob: Blob): Promise<ShareInfo>;
  forget(id: string): Promise<void>;
}

export function openCrop(still: HTMLCanvasElement, opts: CropOptions): { close(): void } {
  const frame = { w: still.width, h: still.height };
  let rect: Box = opts.rect ? clampBox(opts.rect, frame, 24) : wholeFrame(frame);
  let shared: ShareInfo | null = null;
  let sharing = false;
  /** CSS pixels per picture pixel. */
  let k = 1;

  const pic = h('canvas.cropic');
  pic.width = frame.w;
  pic.height = frame.h;
  pic.getContext('2d')?.drawImage(still, 0, 0);
  const ov = h('canvas.cropov', { 'aria-label': 'Crop box: drag to draw, drag a corner to resize' });
  const box = h('div.cropbox', pic, ov);
  const sizeNote = h('div.note');
  const status = h('div.note');
  const engines = h('div.stackf');
  const shareCard = h('div.cropshare');
  shareCard.hidden = true;

  const fit = () => {
    const availW = box.clientWidth || 300;
    const availH = Math.max(160, Math.min(window.innerHeight * 0.5, 520));
    k = Math.min(availW / frame.w, availH / frame.h);
    const w = Math.round(frame.w * k);
    const hh = Math.round(frame.h * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [pic, ov]) {
      c.style.width = `${w}px`;
      c.style.height = `${hh}px`;
    }
    ov.width = Math.round(w * dpr);
    ov.height = Math.round(hh * dpr);
    paint();
  };
  const paint = () => {
    const c = ov.getContext('2d');
    if (!c) return;
    const dpr = ov.width / Math.max(1, ov.clientWidth || frame.w * k);
    c.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    c.clearRect(0, 0, frame.w, frame.h);
    c.fillStyle = 'rgba(0, 0, 0, .5)';
    c.fillRect(0, 0, frame.w, rect.y);
    c.fillRect(0, rect.y + rect.h, frame.w, frame.h - rect.y - rect.h);
    c.fillRect(0, rect.y, rect.x, rect.h);
    c.fillRect(rect.x + rect.w, rect.y, frame.w - rect.x - rect.w, rect.h);
    c.lineWidth = 2 / k;
    c.strokeStyle = '#ffb23e';
    c.strokeRect(rect.x, rect.y, rect.w, rect.h);
    const s = 12 / k;
    c.fillStyle = '#ffb23e';
    for (const p of Object.values(handlePoints(rect))) c.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    sizeNote.textContent = `Crop: ${Math.round(rect.w)} × ${Math.round(rect.h)} px${rect.w >= frame.w - 1 && rect.h >= frame.h - 1 ? ' (the whole picture)' : ''}`;
  };
  new ResizeObserver(fit).observe(box);

  // ---- drag to draw, drag a corner to resize, drag inside to move (touch and mouse alike)
  let grab: Handle | 'inside' | 'new' | null = null;
  let start = { x: 0, y: 0 };
  let startRect = rect;
  const at = (e: PointerEvent) => {
    const r = ov.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  ov.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    start = at(e);
    startRect = rect;
    grab = handleAt(rect, start.x, start.y, 22 / k) ?? 'new';
    ov.setPointerCapture(e.pointerId);
    invalidateShare();
  });
  ov.addEventListener('pointermove', (e) => {
    if (!grab) return;
    const p = at(e);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (grab === 'new') rect = clampBox(normalizeRect(start.x, start.y, p.x, p.y), frame, 1);
    else if (grab === 'inside') rect = moveRect(startRect, dx, dy, frame);
    else rect = resizeRect(startRect, grab, dx, dy, frame, 24);
    paint();
  });
  const up = () => {
    if (grab === 'new' && (rect.w < 24 || rect.h < 24)) rect = startRect;
    grab = null;
    paint();
  };
  ov.addEventListener('pointerup', up);
  ov.addEventListener('pointercancel', up);

  const invalidateShare = () => {
    if (!shared) return;
    // a new crop needs a new link; the old one stays until it expires or FORGET NOW
    shared = null;
    paintShare();
  };

  const links = (): HTMLElement[] =>
    engineUrls(shared?.url ?? 'https://example.invalid/').map((e) => {
      const open = button('OPEN', () => {
        if (!shared) return void toast('Get a link for the engines first', 'warn');
        window.open(e.url, '_blank', 'noopener');
      });
      open.disabled = !shared;
      return h('div.rw', h('span.k', e.name), h('span.v', e.note), open);
    });
  const forgetBtn = button('FORGET NOW', async () => {
    if (!shared) return;
    const id = shared.id;
    try {
      await opts.forget(id);
      shared = null;
      status.textContent = 'Forgotten: the link no longer works.';
      paintShare();
    } catch (e) {
      toast(`Could not forget it: ${String((e as Error)?.message ?? e)}`, 'bad');
    }
  }, 'warn');
  const shareBtn = button('GET A LINK FOR THE ENGINES', () => void share(), 'warn');
  const paintShare = () => {
    clear(engines, ...links());
    shareBtn.hidden = !!shared;
    shareCard.hidden = !shared;
    if (shared) {
      clear(shareCard,
        h('b', `This crop is ${expiresText(shared.expires)}.`),
        h('span', 'Anyone with the link can see it; the engines fetch it from there. '),
        h('a', { href: shared.url, target: '_blank', rel: 'noopener' }, shared.url),
        h('div.row', forgetBtn),
      );
    }
  };
  const share = async () => {
    if (sharing) return;
    sharing = true;
    shareBtn.disabled = true;
    try {
      status.textContent = 'Making the crop…';
      const blob = await toJpegBlob(cropCanvas(still, rect), SHARE_MAX_BYTES, 1600);
      status.textContent = `Sharing ${Math.max(1, Math.round(blob.size / 1024))} KB through the brain…`;
      shared = await opts.share(blob);
      status.textContent = 'Link ready. Pick an engine; each opens in a new tab.';
      paintShare();
    } catch (e) {
      status.textContent = `Could not share it: ${String((e as Error)?.message ?? e)}`;
    } finally {
      sharing = false;
      shareBtn.disabled = false;
    }
  };

  const body = h('div.lenscrop',
    box,
    h('div.row.wrap',
      button('USE WHOLE PICTURE', () => {
        rect = wholeFrame(frame);
        invalidateShare();
        paint();
      }),
      sizeNote,
    ),
    h('div.note', 'Drag on the picture to draw a box, drag a corner to resize it, drag inside to move it.'),
    h('div.lab', 'SEARCH WITH…'),
    h('div.note', 'The engines need a link to the picture: the crop is shared through the brain, reachable by link for 24 hours, and FORGET NOW takes it down. The engines are named as they are; nothing is white-labelled.'),
    shareBtn,
    status,
    shareCard,
    engines,
  );
  paintShare();
  const m = modal('SEARCH BY PICTURE', body);
  setTimeout(fit, 0);
  return m;
}
