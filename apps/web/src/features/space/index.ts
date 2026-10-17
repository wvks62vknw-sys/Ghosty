/**
 * SPACE tab — the SPACE PLANNER: a room drawn to scale (its width × depth typed, or a wall's width
 * from the Lens's MEASURE), furniture from a catalogue of common UK sizes dragged about with a
 * finger (snapping to the walls and to each other, turned with ROTATE), gaps under the 70 cm
 * walkway marked in red, overlaps in red, WILL IT FIT? for something you are thinking of buying,
 * MAKE SPACE (up to three layouts that leave the most open floor, tap one to try it, UNDO to go
 * back), and EXPORT as a picture (PNG) or a file (JSON) — IMPORT reads one back. Everything stays
 * on this phone (space/store.ts); what is on screen goes along with a chat message as context
 * (describe()). The pure parts are in space/plan.ts. The state a test reads is at
 * window.__ghosty.space.
 */
import { clear, h } from '../../core/dom';
import { bothText, cmText, describeMeasurements, parseLength } from '../../measure/geom';
import { go, type TabDef } from '../../shell/tabs';
import { button, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { roomToPlan, planToRoom } from '../../space/roomjson';
import { CATALOGUE, clashes, describePlan, footprint, largestOpen, makeSpace, snapItem, tightGaps, WALKWAY, willItFit, type Arrangement, type Item, type Plan, type Rect } from '../../space/plan';
import { space } from '../../space/store';

/** What the planner shows, for tests and the console (window.__ghosty.space). */
export interface SpaceState {
  room: { w: number; d: number };
  items: Item[];
  selected: string;
  gaps: { a: string; b: string; cm: number }[];
  clashes: string[];
  open: Rect & { area: number };
  options: { name: string; open: number; moved: number }[];
  fit: string;
  exported: { png: number; json: number };
}

export const spaceState: SpaceState = { room: { w: 0, d: 0 }, items: [], selected: '', gaps: [], clashes: [], open: { x: 0, y: 0, w: 0, h: 0, area: 0 }, options: [], fit: '', exported: { png: 0, json: 0 } };

/** On the console/test handle; main.ts makes __ghosty after the first tab opens (a reload landing here), so this retries. */
function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.space = spaceState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

const COLORS = { line: '#62e4ff', item: 'rgba(98, 228, 255, .16)', sel: '#ffb23e', bad: '#ff4d6a', ok: '#52f2b5', text: '#d8f6ff', mute: 'rgba(216, 246, 255, .45)' };

/** The plan drawn on a 2-D canvas at `k` pixels per cm, offset by `pad` px (shared by the screen and the PNG export). */
function drawPlan(g: CanvasRenderingContext2D, plan: Plan, k: number, pad: number, opts: { selected?: string; preview?: Rect | null; title?: string } = {}): void {
  const { room, items } = plan;
  const X = (cm: number) => pad + cm * k;
  const Y = (cm: number) => pad + cm * k;
  g.save();
  // floor grid every 50 cm
  g.strokeStyle = 'rgba(98, 228, 255, .08)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 50; x < room.w; x += 50) {
    g.moveTo(X(x), Y(0));
    g.lineTo(X(x), Y(room.d));
  }
  for (let y = 50; y < room.d; y += 50) {
    g.moveTo(X(0), Y(y));
    g.lineTo(X(room.w), Y(y));
  }
  g.stroke();
  // the open floor MAKE SPACE is showing
  if (opts.preview) {
    g.setLineDash([6, 4]);
    g.strokeStyle = COLORS.ok;
    g.lineWidth = 1.5;
    g.strokeRect(X(opts.preview.x) + 2, Y(opts.preview.y) + 2, opts.preview.w * k - 4, opts.preview.h * k - 4);
    g.setLineDash([]);
  }
  // walls
  g.strokeStyle = COLORS.line;
  g.lineWidth = 3;
  g.strokeRect(X(0), Y(0), room.w * k, room.d * k);
  // gaps under a walkway
  const gaps = tightGaps(items);
  for (const gp of gaps) {
    g.fillStyle = 'rgba(255, 77, 106, .22)';
    g.fillRect(X(gp.rect.x), Y(gp.rect.y), gp.rect.w * k, gp.rect.h * k);
  }
  const bad = new Set(clashes(room, items));
  g.font = `500 ${Math.max(9, Math.min(13, 11 * (k / 1.2)))}px "IBM Plex Mono", ui-monospace, monospace`;
  g.textBaseline = 'middle';
  for (const it of items) {
    const f = footprint(it);
    const sel = it.id === opts.selected;
    g.fillStyle = bad.has(it.id) ? 'rgba(255, 77, 106, .25)' : sel ? 'rgba(255, 178, 62, .2)' : COLORS.item;
    g.fillRect(X(f.x), Y(f.y), f.w * k, f.h * k);
    g.strokeStyle = bad.has(it.id) ? COLORS.bad : sel ? COLORS.sel : COLORS.line;
    g.lineWidth = sel ? 2 : 1.2;
    g.strokeRect(X(f.x) + 0.5, Y(f.y) + 0.5, f.w * k - 1, f.h * k - 1);
    // its back: a thick edge on the wall side
    g.lineWidth = 4;
    g.beginPath();
    const [x0, y0, x1, y1] = it.rot === 0 ? [f.x, f.y, f.x + f.w, f.y] : it.rot === 1 ? [f.x + f.w, f.y, f.x + f.w, f.y + f.h] : it.rot === 2 ? [f.x, f.y + f.h, f.x + f.w, f.y + f.h] : [f.x, f.y, f.x, f.y + f.h];
    g.moveTo(X(x0), Y(y0));
    g.lineTo(X(x1), Y(y1));
    g.stroke();
    // its name and size, when there is room for them
    const cx = X(f.x + f.w / 2);
    const cy = Y(f.y + f.h / 2);
    const name = it.label.replace(/^(Sofa|Bed|Dining table|Wardrobe), /, '');
    g.fillStyle = COLORS.text;
    g.textAlign = 'center';
    if (f.w * k > 34 && f.h * k > 22) {
      g.fillText(name.length * 6.5 > f.w * k ? name.slice(0, Math.max(3, Math.floor((f.w * k) / 7))) : name, cx, cy - (f.h * k > 36 ? 7 : 0));
      if (f.h * k > 36) {
        g.fillStyle = COLORS.mute;
        g.fillText(`${it.w}×${it.d}`, cx, cy + 8);
      }
    }
  }
  // gap labels on top
  for (const gp of gaps) {
    g.fillStyle = COLORS.bad;
    g.textAlign = 'center';
    g.fillText(`${gp.cm} cm`, X(gp.rect.x + gp.rect.w / 2), Y(gp.rect.y + gp.rect.h / 2));
  }
  // the room's size along two walls
  g.fillStyle = COLORS.line;
  g.textAlign = 'center';
  g.fillText(`${room.w} cm`, X(room.w / 2), pad / 2);
  g.save();
  g.translate(pad / 2, Y(room.d / 2));
  g.rotate(-Math.PI / 2);
  g.fillText(`${room.d} cm`, 0, 0);
  g.restore();
  if (opts.title) {
    g.textAlign = 'left';
    g.fillStyle = COLORS.mute;
    g.fillText(opts.title, pad, Y(room.d) + pad / 2);
  }
  g.restore();
}

/** Save a file the owner asked for: the share sheet where the phone has one for files, else a download. */
async function saveFile(blob: Blob, name: string): Promise<'share' | 'download'> {
  const f = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [f] }) && /iPhone|iPad|Android/i.test(navigator.userAgent) && nav.share) {
    try {
      await nav.share({ files: [f], title: name });
      return 'share';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'share';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'download';
}

/** Open the planner, with a room size when one is known (the `open_space` command). */
export function openSpace(widthCm?: number, depthCm?: number): void {
  const w = Number(widthCm);
  const d = Number(depthCm);
  if (w >= 50 && w <= 5000 && d >= 50 && d <= 5000) space.setRoom({ w, d });
  go('space');
}

export const spaceTab: TabDef = {
  id: 'space',
  title: 'SPACE',
  icon: '<path d="M3 4h18v16H3z"/><path d="M3 12h7v8M14 4v5h7"/><path d="M6 15h2M16 6h2"/>',
  scene: 'backdrop',
  blurb: 'plan a room · fit · make space',
  mount(root) {
    const P = page(root, { tag: 'SPACE PLANNER', sub: 'your room in real sizes · kept on this phone', leftLabel: 'PLAN', rightLabel: 'TOOLS', stack: true });
    let selected = '';
    let undoItems: Item[] | null = null;
    let preview: Rect | null = null;
    let options: Arrangement[] = [];

    // ======================= THE PLAN
    const pp = panel('ROOM PLAN', { cls: 'spaceplan' });
    const wIn = h('input', { inputmode: 'decimal', 'aria-label': 'Room width in cm', placeholder: 'width' });
    const dIn = h('input', { inputmode: 'decimal', 'aria-label': 'Room depth in cm', placeholder: 'depth' });
    const setRoom = () => {
      const w = parseLength(wIn.value, 'auto');
      const d = parseLength(dIn.value, 'auto');
      if (!w || !d) return void toast('Type the room’s width and depth (cm, or e.g. 4.2 m)', 'warn');
      if (w < 500 || d < 500 || w > 50000 || d > 50000) return void toast('A room between 0.5 m and 50 m each way', 'warn');
      space.setRoom({ w: w / 10, d: d / 10 });
      toast(`Room ${Math.round(w / 10)} × ${Math.round(d / 10)} cm`, 'ok');
    };
    for (const i of [wIn, dIn]) i.addEventListener('keydown', (e) => e.key === 'Enter' && setRoom());
    const roomRow = h('div.keyrow.spaceroom', h('span.lab', 'ROOM'), wIn, h('span.x', '×'), dIn, h('span.lab', 'CM'), button('SET', () => setRoom()));
    const canvas = h('canvas.spacecanvas', { 'aria-label': 'The room plan: drag a piece to move it, tap it to choose it' });
    const wrap = h('div.spacewrap', canvas);
    const selName = h('span.spacesel', 'Tap a piece to choose it');
    const rotBtn = button('ROTATE', () => rotate());
    const delBtn = button('REMOVE', () => removeSel());
    const selRow = h('div.row.wrap.spacebar', selName, rotBtn, delBtn);
    const info = h('div.note.spaceinfo');
    pp.body.append(roomRow, wrap, selRow, info);

    // ======================= ADD FURNITURE
    const ap = panel('ADD FURNITURE', { status: 'UK sizes', cls: 'spaceadd' });
    const chips = h('div.lenschips.spacecat');
    for (const c of CATALOGUE) {
      const b = button(c.label, () => addItem(c.kind, c.label, c.w, c.d));
      b.title = `${c.w} × ${c.d} cm`;
      chips.append(b);
    }
    const cw = h('input', { inputmode: 'decimal', placeholder: 'W cm', 'aria-label': 'Width of your own piece (cm)' });
    const cd = h('input', { inputmode: 'decimal', placeholder: 'D cm', 'aria-label': 'Depth of your own piece (cm)' });
    const cn = h('input', { placeholder: 'name', 'aria-label': 'Name of your own piece' });
    const addOwn = () => {
      const w = parseLength(cw.value);
      const d = parseLength(cd.value);
      if (!w || !d) return void toast('Type its width and depth in cm', 'warn');
      addItem('custom', cn.value.trim().slice(0, 30) || 'Item', Math.round(w / 10), Math.round(d / 10));
    };
    ap.body.append(chips, h('div.keyrow.wrapit.spaceown', cn, cw, cd, button('ADD', () => addOwn())));

    // ======================= WILL IT FIT?
    const fp = panel('WILL IT FIT?', { cls: 'spacefit' });
    const fw = h('input', { inputmode: 'decimal', placeholder: 'W cm', 'aria-label': 'Width of the thing (cm)' });
    const fd = h('input', { inputmode: 'decimal', placeholder: 'D cm', 'aria-label': 'Depth of the thing (cm)' });
    const fitOut = h('div.note.spacefitout');
    const placeBtn = button('PUT IT IN', () => void 0, 'on');
    placeBtn.hidden = true;
    const findBtn = button('FIND ONE THAT FITS', () => void findOne(), 'warn');
    const check = () => {
      const w = parseLength(fw.value);
      const d = parseLength(fd.value);
      if (!w || !d) return void toast('Type its width and depth in cm', 'warn');
      const { room, items } = space.get().plan;
      const r = willItFit(room, items, Math.round(w / 10), Math.round(d / 10));
      spaceState.fit = r.text;
      fitOut.textContent = r.text;
      fitOut.className = `note spacefitout ${r.fits ? 'good' : 'bad'}`;
      placeBtn.hidden = !r.spot;
      placeBtn.onclick = () => {
        if (!r.spot) return;
        const it: Item = { id: `i${Date.now().toString(36)}`, kind: 'custom', label: 'New piece', w: Math.round(w / 10), d: Math.round(d / 10), x: r.spot.x, y: r.spot.y, rot: r.spot.rot };
        space.setItems([...space.get().plan.items, it]);
        selected = it.id;
        placeBtn.hidden = true;
      };
    };
    const findOne = async () => {
      const { room } = space.get().plan;
      const w = parseLength(fw.value);
      const d = parseLength(fd.value);
      const open = largestOpen(room, space.get().plan.items);
      const ww = w ? Math.round(w / 10) : open.w;
      const dd = d ? Math.round(d / 10) : open.h;
      go('core');
      const { send } = await import('../../assistant/session');
      void send(`Find me furniture for this room that fits within ${ww} cm wide and ${dd} cm deep (room ${room.w} × ${room.d} cm).`);
    };
    fp.body.append(h('div.keyrow.spacefitin', fw, h('span.x', '×'), fd, button('CHECK', () => check())), fitOut, h('div.row.wrap', placeBtn, findBtn));

    // ======================= MAKE SPACE
    const mp = panel('MAKE SPACE', { cls: 'spacemake' });
    const optList = h('div.stackf.spaceopts');
    const undoBtn = button('UNDO', () => {
      if (!undoItems) return;
      preview = null;
      space.setItems(undoItems);
      undoItems = null;
      undoBtn.hidden = true;
    });
    undoBtn.hidden = true;
    const run = () => {
      const { room, items } = space.get().plan;
      if (!items.length) return void toast('Add some furniture first', 'warn');
      const r = makeSpace(room, items);
      options = r.options;
      spaceState.options = options.map((o) => ({ name: o.name, open: o.open.area, moved: o.moved }));
      clear(optList);
      if (!options.length) {
        optList.append(h('div.note', `This is already about as open as it gets: ${(r.now.w / 100).toFixed(1)} × ${(r.now.h / 100).toFixed(1)} m of open floor.`));
        return;
      }
      options.forEach((o, i) => {
        const gain = Math.round(((o.open.area - r.now.area) / 10000) * 10) / 10;
        const b = button(h('span', h('b', `${i + 1} · ${o.name.toUpperCase()}`), h('small', `${(o.open.w / 100).toFixed(1)} × ${(o.open.h / 100).toFixed(1)} m open (+${gain} m²) · ${o.moved} moved${o.gaps ? ` · ${o.gaps} tight gap${o.gaps > 1 ? 's' : ''}` : ''}`)), () => apply(i), 'spaceopt');
        optList.append(b);
      });
    };
    // MAKE SPACE's layouts, UNDO and open-floor preview belong to the room they were made for:
    // a new room (SET, MEASURED, IMPORT) drops them, or UNDO would put the old room's pieces back.
    const resetMake = () => {
      options = [];
      undoItems = null;
      preview = null;
      spaceState.options = [];
      undoBtn.hidden = true;
      clear(optList);
    };
    const apply = (i: number) => {
      const o = options[i];
      if (!o) return;
      undoItems ??= space.get().plan.items;
      preview = o.open;
      space.setItems(o.items);
      undoBtn.hidden = false;
      for (const [k, b] of [...optList.querySelectorAll('button')].entries()) b.classList.toggle('on', k === i);
      toast(`Layout ${i + 1}: ${o.name}`, 'ok');
    };
    mp.body.append(h('div.note', `Up to three layouts that push the furniture to the walls and leave the biggest open floor, with ${WALKWAY} cm walkways kept where they can be.`), h('div.row', button('MAKE SPACE', () => run(), 'on'), undoBtn), optList);

    // ======================= MEASURED
    const msp = panel('MEASURED', { status: 'from the Lens', cls: 'spacemeas' });
    const mList = h('div.stackf');
    msp.body.append(mList, h('div.row.wrap', button('MEASURE A WALL', async () => {
      const { openLens } = await import('../lens');
      openLens('measure', undefined, true);
    }, 'on'), button('CLEAR', () => space.clearMeasurements())));

    // ======================= EXPORT
    const xp = panel('EXPORT', { cls: 'spaceexport' });
    const importIn = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Import a plan file' });
    importIn.hidden = true;
    importIn.addEventListener('change', async () => {
      const f = importIn.files?.[0];
      importIn.value = '';
      if (!f) return;
      try {
        const plan = roomToPlan(JSON.parse(await f.text()));
        if (!plan) throw new Error('That file is not a room plan');
        resetMake();
        selected = '';
        space.setPlan(plan);
        toast('Plan imported', 'ok');
      } catch (e) {
        toast(String((e as Error)?.message ?? e), 'bad');
      }
    });
    const exportPng = async () => {
      const plan = space.get().plan;
      const k = Math.min(3, 1600 / Math.max(plan.room.w, plan.room.d));
      const pad = 40;
      const c = h('canvas');
      c.width = Math.round(plan.room.w * k + pad * 2);
      c.height = Math.round(plan.room.d * k + pad * 2);
      const g = c.getContext('2d');
      if (!g) return;
      g.fillStyle = '#02070d';
      g.fillRect(0, 0, c.width, c.height);
      drawPlan(g, plan, k, pad, { title: `GHOSTY · SPACE PLANNER · ${plan.room.w} × ${plan.room.d} cm` });
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
      if (!blob) return void toast('Could not make the picture', 'bad');
      spaceState.exported.png = blob.size;
      await saveFile(blob, `room-plan-${plan.room.w}x${plan.room.d}.png`);
    };
    const exportJson = async () => {
      const plan = space.get().plan;
      // Room JSON (MAP.md), so the 3D STUDIO's ROOM pane builds exactly this plan.
      const blob = new Blob([JSON.stringify(planToRoom(plan), null, 1)], { type: 'application/json' });
      spaceState.exported.json = blob.size;
      await saveFile(blob, `room-plan-${plan.room.w}x${plan.room.d}.json`);
    };
    xp.body.append(h('div.row.wrap', button('PNG', () => void exportPng(), 'on'), button('JSON', () => void exportJson()), button('IMPORT', () => importIn.click())), importIn, h('div.note', 'The plan is kept on this phone only. PNG is a picture to share; JSON can be imported again here or on another phone.'));

    P.left.append(pp.el);
    P.right.append(ap.el, fp.el, mp.el, msp.el, xp.el);

    // ======================= drawing and dragging
    let scale = 1;
    const PAD = 22;
    const fit = () => {
      const { room } = space.get().plan;
      const avail = Math.max(200, wrap.clientWidth || 320);
      const maxH = Math.max(220, Math.min(window.innerHeight * 0.55, 620));
      scale = Math.min((avail - PAD * 2) / room.w, (maxH - PAD * 2) / room.d);
      const cssW = Math.round(room.w * scale + PAD * 2);
      const cssH = Math.round(room.d * scale + PAD * 2);
      const k = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * k);
      canvas.height = Math.round(cssH * k);
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, cssW, cssH);
      drawPlan(g, space.get().plan, scale, PAD, { selected, preview });
    };
    let roomKey = '';
    const paint = () => {
      const { plan, measures } = space.get();
      const key = `${plan.room.w}x${plan.room.d}`;
      if (roomKey && key !== roomKey) resetMake();
      roomKey = key;
      const gaps = tightGaps(plan.items);
      const bad = clashes(plan.room, plan.items);
      const open = largestOpen(plan.room, plan.items);
      Object.assign(spaceState, { room: { ...plan.room }, items: plan.items.map((i) => ({ ...i })), selected, gaps: gaps.map(({ a, b, cm }) => ({ a, b, cm })), clashes: bad, open });
      if (document.activeElement !== wIn) wIn.value = String(plan.room.w);
      if (document.activeElement !== dIn) dIn.value = String(plan.room.d);
      P.big.textContent = `${plan.room.w} × ${plan.room.d} CM`;
      P.sub.textContent = `${((plan.room.w * plan.room.d) / 10000).toFixed(1)} m² · ${bothText(plan.room.w * 10)} × ${bothText(plan.room.d * 10)}`;
      const used = plan.items.reduce((s, it) => s + it.w * it.d, 0) / (plan.room.w * plan.room.d);
      P.dials([
        ['PIECES', Math.min(1, plan.items.length / 12), String(plan.items.length)],
        ['FLOOR USED', Math.min(1, used), `${Math.round(used * 100)}%`],
        ['OPEN', open.area / (plan.room.w * plan.room.d), `${(open.w / 100).toFixed(1)}×${(open.h / 100).toFixed(1)}`, '#52f2b5'],
      ]);
      const sel = plan.items.find((i) => i.id === selected);
      selName.textContent = sel ? `${sel.label} · ${sel.w} × ${sel.d} cm` : 'Tap a piece to choose it, drag to move it';
      rotBtn.disabled = delBtn.disabled = !sel;
      info.textContent = [
        `Open floor: ${cmText(open.w * 10)} × ${cmText(open.h * 10)}.`,
        gaps.length ? `${gaps.length} gap${gaps.length > 1 ? 's' : ''} under ${WALKWAY} cm (red).` : `Walkways clear (≥ ${WALKWAY} cm).`,
        bad.length ? `${bad.length} piece${bad.length > 1 ? 's' : ''} overlapping or outside the room.` : '',
      ].filter(Boolean).join(' ');
      pp.setStatus(bad.length ? 'CLASH' : gaps.length ? 'TIGHT' : 'CLEAR', bad.length ? 'off' : gaps.length ? 'mid' : 'ok');
      clear(mList);
      if (!measures.length) mList.append(h('div.note', 'Nothing measured yet. MEASURE A WALL opens the Lens: hold a bank card to the wall, tap its corners, then the wall’s.'));
      else {
        measures.slice(-6).forEach((m) => {
          const text = m.kind === 'rect' ? `${cmText(m.w)} × ${cmText(m.h ?? 0)}` : cmText(m.w);
          const use = (k: 'w' | 'd') => button(k === 'w' ? 'AS WIDTH' : 'AS DEPTH', () => {
            const r = space.get().plan.room;
            space.setRoom(k === 'w' ? { w: m.w / 10, d: r.d } : { w: r.w, d: m.w / 10 });
          });
          mList.append(h('div.row.wrap.spacemrow', h('span', h('b', text), h('small', ` ${m.kind === 'rect' ? 'wall' : 'length'} · ${m.confidence} · ${m.via}`)), use('w'), use('d')));
        });
      }
      fit();
    };

    let drag: { id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null = null;
    let dragged: Item[] | null = null;
    const toCm = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left - PAD) / scale, y: (e.clientY - r.top - PAD) / scale };
    };
    canvas.addEventListener('pointerdown', (e) => {
      const p = toCm(e);
      const items = space.get().plan.items;
      const hit = [...items].reverse().find((it) => {
        const f = footprint(it);
        return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
      });
      selected = hit?.id ?? '';
      if (hit) {
        drag = { id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y, sx: e.clientX, sy: e.clientY, moved: false };
        canvas.setPointerCapture(e.pointerId);
      }
      paint();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const p = toCm(e);
      const { plan } = space.get();
      const items = plan.items.map((it) => (it.id === drag!.id ? { ...it, x: p.x - drag!.dx, y: p.y - drag!.dy } : it));
      // while dragging, drawn where the finger is; snapped and saved when let go
      const g = canvas.getContext('2d');
      if (!g) return;
      const k = Math.min(2, window.devicePixelRatio || 1);
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      drawPlan(g, { ...plan, items }, scale, PAD, { selected });
      dragged = items;
    });
    const drop = () => {
      if (drag && dragged) {
        const it = dragged.find((i) => i.id === drag!.id);
        if (it) {
          const s = snapItem(space.get().plan.room, it, dragged);
          preview = null;
          space.setItems(dragged.map((i) => (i.id === it.id ? { ...i, ...s } : i)));
        }
      }
      drag = null;
      dragged = null;
    };
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);

    const addItem = (kind: string, label: string, w: number, d: number) => {
      const { room, items } = space.get().plan;
      const r = willItFit(room, items, w, d);
      const spot = r.spot ?? { x: 0, y: 0, rot: 0 as const };
      const it: Item = { id: `${kind}${Date.now().toString(36).slice(-5)}`, kind, label, w, d, x: spot.x, y: spot.y, rot: spot.rot };
      space.setItems([...items, it]);
      selected = it.id;
      preview = null;
      if (!r.spot) toast(`${label} does not fit anywhere as things stand — try MAKE SPACE`, 'warn');
      paint();
    };
    const rotate = () => {
      const { room, items } = space.get().plan;
      const next = items.map((it) => {
        if (it.id !== selected) return it;
        const turned = { ...it, rot: ((it.rot + 1) % 4) as Item['rot'] };
        const f = footprint(turned);
        return { ...turned, x: Math.max(0, Math.min(turned.x, room.w - f.w)), y: Math.max(0, Math.min(turned.y, room.d - f.h)) };
      });
      preview = null;
      space.setItems(next);
    };
    const removeSel = () => {
      space.setItems(space.get().plan.items.filter((i) => i.id !== selected));
      selected = '';
    };

    space.subscribe(paint);
    new ResizeObserver(() => fit()).observe(wrap);
    expose();
    paint();
    return {
      enter() {
        expose();
        paint();
      },
      describe: () => {
        const { plan, measures } = space.get();
        const m = measures.length ? ` Measured with the Lens: ${describeMeasurements(measures.slice(-6)).replace(/\n/g, '; ')}.` : '';
        return `Space planner: ${describePlan(plan)}.${m}`;
      },
    };
  },
};
