/**
 * ROOMS (BRIEF-EDITOR-GAME-STUDIO): the grid at the phone's width. One finger paints the picked tile, two fingers pan and pinch to
 * zoom; PAINT, ERASE, FILL and PICK at 44 pt; a tray of tiles with his own at the end and DRAW A TILE; the room's size and name;
 * doors made by tapping a door tile and then the room it goes to; PLAY FROM HERE.
 */
import { clear, h } from '../core/dom';
import { undo } from '../ui/components';
import { backdrop, drawTiles, frameCanvas, tileCanvas } from './draw';
import { attempt, btn, chips, type Ctx, field, note, numberField, section, select, text, toggle } from './ed-core';
import { fillTiles, frameOf, isCustom, LETTER_NAMES, linkDoor, markKey, MAX_ROOMS, newDoor, newRoom, newTile, type Room, resizeRoom, setTile, themeOf, tileAt, TS, PALETTES } from './model';

const MARK_LETTERS = 'DNTci';
const TRAY = '#WBp~DDu^ocViFPNTwhfsx'.replace('DD', 'D').split('').filter((c, i, a) => a.indexOf(c) === i);
const TOOLS: { id: 'paint' | 'erase' | 'fill' | 'pick'; label: string; aria: string }[] = [
  { id: 'paint', label: 'Paint', aria: 'Paint: one finger paints the picked tile' },
  { id: 'erase', label: 'Erase', aria: 'Erase: one finger clears tiles' },
  { id: 'fill', label: 'Fill', aria: 'Fill: fills the connected tiles with the picked one' },
  { id: 'pick', label: 'Pick', aria: 'Pick: taps a tile to paint with it' },
];

/** What the tray shows for a letter. */
function iconFor(ctx: Ctx, ch: string): HTMLCanvasElement {
  const g = ctx.game();
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  const th = themeOf(ctx.room().bg);
  const sprite = (id: string | undefined) => g.sprites.find((s) => s.id === id);
  let src: HTMLCanvasElement | null = null;
  if (ch === 'N') src = frameCanvas(frameOf(sprite(g.npcs[0]?.sprite ?? 'villager'), 'idle', 0));
  else if (ch === 'T') src = frameCanvas(frameOf(sprite(g.things[0]?.sprite ?? 'icon-coin'), 'idle', 0));
  else if ('whfsx'.includes(ch)) src = frameCanvas(frameOf(sprite(g.enemySprites[{ w: 'walker', h: 'hopper', f: 'flyer', s: 'shell', x: 'chaser' }[ch]!]), 'idle', 0));
  else if (ch === 'P') src = frameCanvas(frameOf(sprite(g.player.sprite), 'idle', 0));
  else if (ch === 'o') src = frameCanvas(frameOf(sprite('icon-coin'), 'idle', 0));
  else src = tileCanvas(g, ch, th);
  if (src) x.drawImage(src, 0, 0, 32, 32);
  return c;
}
export const nameOf = (ctx: Ctx, ch: string): string => (isCustom(ch) ? (ctx.game().tiles.find((t) => t.id === ch)?.name ?? 'Tile') : (LETTER_NAMES[ch] ?? ch));

export function roomsPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const st = ctx.state;
  const root = h('div.stPill');
  if (!g.rooms.length) {
    root.append(note('The game has no rooms yet.'), btn('Add a room', () => attempt(ctx, (x) => x.rooms.push(newRoom(x, 'First room'))), 'pri'));
    return root;
  }
  let room: Room = ctx.room();

  // ---- the rooms, and this room's settings
  const rooms = h('div.stChips', { role: 'group', 'aria-label': 'Rooms' },
    ...g.rooms.map((r) => h('button.stChip', { type: 'button', 'aria-pressed': String(r.id === room.id), 'aria-label': `Room ${r.name}`, onclick: () => ((st.roomId = r.id), (st.sel = null), (st.panX = 0), (st.panY = 0), ctx.refresh()) }, r.name)),
    btn('+ Room', () => {
      if (g.rooms.length >= MAX_ROOMS) return ctx.say(`A game keeps ${MAX_ROOMS} rooms at most.`);
      attempt(ctx, (x) => {
        const r = newRoom(x, `Room ${x.rooms.length + 1}`);
        x.rooms.push(r);
        st.roomId = r.id;
      });
    }, 'stChip stAdd', 'Add a room'),
  );
  const settings = h('details.stDet', h('summary', `This room: ${room.name} · ${room.w} × ${room.h}`),
    field('Name', text(room.name, (v) => attempt(ctx, () => (room.name = v.trim().slice(0, 40) || room.name)), { aria: 'Room name', max: 40 })),
    h('div.stTwo',
      field('Width', numberField(room.w, 8, 64, (v) => attempt(ctx, () => resizeRoom(room, v, room.h)), 'Room width in tiles'), 'tiles, 8 to 64'),
      field('Height', numberField(room.h, 6, 32, (v) => attempt(ctx, () => resizeRoom(room, room.w, v)), 'Room height in tiles'), 'tiles, 6 to 32')),
    field('World behind it', select(PALETTES.map((p) => [p.id, p.name]), room.bg, (v) => attempt(ctx, () => (room.bg = v)), 'World behind the room')),
    field('Shut until a quest is done', select([['', 'Open from the start'], ...g.quests.map((q): [string, string] => [q.id, q.name])], room.lock.quest, (v) => attempt(ctx, () => (room.lock.quest = v)), 'Quest that opens this room')),
    btn('Delete this room', () => {
      if (g.rooms.length <= 1) return ctx.say('A game keeps at least one room.');
      const name = room.name;
      attempt(ctx, (x) => {
        x.rooms = x.rooms.filter((r) => r.id !== room.id);
        for (const r of x.rooms) for (const d of r.doors) if (d.room === room.id) (d.room = ''), (d.door = '');
        if (x.start === room.id) x.start = x.rooms[0]!.id;
        st.roomId = x.rooms[0]!.id;
      });
      undo(`Deleted the room “${name}”.`, () => ctx.undo());
    }, 'warn', `Delete the room ${room.name}`),
  );

  // ---- the tools and the tray
  const tools = h('div.stTools', { role: 'group', 'aria-label': 'Tools' },
    ...TOOLS.map((t) => h('button.stChip.stTool', { type: 'button', 'aria-pressed': String(st.tool === t.id), 'aria-label': t.aria, dataset: { tool: t.id }, onclick: () => ((st.tool = t.id), ctx.refresh()) }, t.label)),
    btn('−', () => zoomBy(0.8), 'stZoom', 'Zoom out'),
    btn('+', () => zoomBy(1.25), 'stZoom', 'Zoom in'),
  );
  const tray = h('div.stTray', { role: 'group', 'aria-label': 'Tiles' });
  const letters = [...TRAY, ...g.tiles.map((t) => t.id)];
  for (const ch of letters) {
    const b = h('button.stTile', { type: 'button', 'aria-pressed': String(st.letter === ch), 'aria-label': nameOf(ctx, ch), title: nameOf(ctx, ch), dataset: { letter: ch }, onclick: () => ((st.letter = ch), (st.tool = st.tool === 'erase' || st.tool === 'pick' ? 'paint' : st.tool), ctx.refresh()) }, iconFor(ctx, ch));
    tray.append(b);
  }
  tray.append(btn('Draw a tile', () => {
    if (g.tiles.length >= 8) return ctx.say('A game has 8 tiles of its own at most.');
    attempt(ctx, (x) => {
      const t = newTile(x, `Tile ${x.tiles.length + 1}`);
      x.tiles.push(t);
      st.tile = t.id;
      st.letter = t.id;
    });
    ctx.go('sprites');
  }, 'stTile stDraw', 'Draw a tile of your own'));

  // ---- the canvas
  const box = h('div.stCanvasBox');
  const canvas = h('canvas.stCanvas', { role: 'img', 'aria-label': `The room ${room.name}, ${room.w} by ${room.h} tiles. One finger paints, two fingers pan, pinch to zoom.` });
  box.append(canvas);
  const ctx2 = canvas.getContext('2d')!;
  const view = { w: 0, h: 0 };
  const cell = () => 24 * st.zoom;
  const clampPan = () => {
    const c = cell();
    const rw = room.w * c;
    const rh = room.h * c;
    st.panX = rw <= view.w ? (view.w - rw) / 2 : Math.max(view.w - rw - 16, Math.min(16, st.panX));
    st.panY = rh <= view.h ? (view.h - rh) / 2 : Math.max(view.h - rh - 16, Math.min(16, st.panY));
  };
  const draw = () => {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = box.clientWidth || 320;
    const hh = Math.min(340, Math.max(220, Math.round(w * 0.9)));
    box.style.height = `${hh}px`;
    if (view.w !== w || view.h !== hh || canvas.width !== Math.round(w * dpr)) {
      view.w = w;
      view.h = hh;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
      if (!st.panX && !st.panY) clampPan();
    }
    clampPan();
    const c = cell();
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.imageSmoothingEnabled = false;
    backdrop(ctx2, themeOf(room.bg), w, hh, -st.panX, -st.panY, g.kind === 'topdown', true);
    drawTiles(ctx2, g, room, { cell: c, ox: st.panX, oy: st.panY, markers: true });
    // the grid, and the room's edge
    ctx2.strokeStyle = 'rgba(255,255,255,.14)';
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    for (let x = 0; x <= room.w; x++) (ctx2.moveTo(st.panX + x * c + 0.5, st.panY), ctx2.lineTo(st.panX + x * c + 0.5, st.panY + room.h * c));
    for (let y = 0; y <= room.h; y++) (ctx2.moveTo(st.panX, st.panY + y * c + 0.5), ctx2.lineTo(st.panX + room.w * c, st.panY + y * c + 0.5));
    ctx2.stroke();
    ctx2.strokeStyle = 'rgba(255,255,255,.7)';
    ctx2.strokeRect(st.panX + 0.5, st.panY + 0.5, room.w * c, room.h * c);
    if (st.sel) {
      ctx2.strokeStyle = 'rgba(255,214,10,1)';
      ctx2.lineWidth = 3;
      ctx2.strokeRect(st.panX + st.sel.x * c + 1.5, st.panY + st.sel.y * c + 1.5, c - 3, c - 3);
    }
  };
  const zoomBy = (k: number, cx = view.w / 2, cy = view.h / 2) => {
    const old = cell();
    st.zoom = Math.max(0.5, Math.min(3, st.zoom * k));
    const f = cell() / old;
    st.panX = cx - (cx - st.panX) * f;
    st.panY = cy - (cy - st.panY) * f;
    draw();
  };
  const tileOf = (px: number, py: number): [number, number] => [Math.floor((px - st.panX) / cell()), Math.floor((py - st.panY) / cell())];
  const markDefault = (ch: string, x: number, y: number) => {
    const gg = ctx.game();
    const key = markKey(x, y);
    if (ch === 'D') {
      if (!room.doors.some((d) => d.x === x && d.y === y)) newDoor(gg, room, x, y);
    } else if (ch === 'N') room.marks[key] = gg.npcs[0]?.id ?? '';
    else if (ch === 'T') room.marks[key] = gg.things[0]?.id ?? '';
    else if (ch === 'c') room.marks[key] = gg.things[0]?.id ?? '';
    else if (ch === 'i') room.marks[key] = 'Hello there.';
  };
  /** One tile touched by the tool. Returns whether something changed. */
  const apply = (x: number, y: number, first: boolean): boolean => {
    if (x < 0 || y < 0 || x >= room.w || y >= room.h) return false;
    const here = tileAt(room, x, y);
    if (st.tool === 'pick') {
      if (here !== ' ') (st.letter = here === '.' ? st.letter : here), (st.tool = 'paint');
      if (MARK_LETTERS.includes(here)) st.sel = { x, y };
      return false;
    }
    if (st.tool === 'fill') {
      if (MARK_LETTERS.includes(st.letter) || 'PNTwhfsx'.includes(st.letter)) {
        ctx.say('Fill paints ground, walls, water and the like. Place people, things and foes one at a time.');
        return false;
      }
      return fillTiles(room, x, y, st.letter) > 0;
    }
    const ch = st.tool === 'erase' ? '.' : st.letter;
    if (st.tool === 'paint' && MARK_LETTERS.includes(ch) && here === ch) {
      st.sel = { x, y };
      return false;
    }
    if (st.tool === 'paint' && ch === 'P') {
      room.rows = room.rows.map((r) => r.replace(/P/g, '.'));
      ctx.game().start = ctx.game().start || room.id;
    }
    const did = setTile(room, x, y, ch);
    if (did && MARK_LETTERS.includes(ch) && st.tool === 'paint') {
      markDefault(ch, x, y);
      if (first) st.sel = { x, y };
    }
    return did;
  };

  // pointers: one paints, two pan and pinch
  const ptrs = new Map<number, { x: number; y: number }>();
  let stroke: { t0: number; n: number; last: [number, number] } | null = null;
  let gesture: { d: number; mx: number; my: number } | null = null;
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mid = () => {
    const [a, b] = [...ptrs.values()];
    return { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2 };
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* a touch that is already gone */
    }
    ptrs.set(e.pointerId, local(e));
    if (ptrs.size === 1) {
      const p = local(e);
      const [tx, ty] = tileOf(p.x, p.y);
      ctx.push();
      stroke = { t0: performance.now(), n: 0, last: [tx, ty] };
      if (apply(tx, ty, true)) stroke.n++;
      draw();
    } else if (ptrs.size === 2) {
      // the second finger: a stroke of one tile begun a moment ago was a pan beginning: it is taken back
      if (stroke && performance.now() - stroke.t0 < 220 && stroke.n <= 1 && ctx.hist.canUndo) {
        ctx.hist.undo();
        room = ctx.room();
      }
      stroke = null;
      gesture = mid();
      draw();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, local(e));
    if (ptrs.size >= 2 && gesture) {
      const m = mid();
      st.panX += m.mx - gesture.mx;
      st.panY += m.my - gesture.my;
      if (gesture.d > 8) zoomBy(m.d / gesture.d, m.mx, m.my);
      gesture = m;
      draw();
    } else if (stroke && (st.tool === 'paint' || st.tool === 'erase')) {
      const p = local(e);
      const [tx, ty] = tileOf(p.x, p.y);
      if (tx === stroke.last[0] && ty === stroke.last[1]) return;
      // every tile between the last and this one (a fast finger skips none)
      let [x, y] = stroke.last;
      const n = Math.max(Math.abs(tx - x), Math.abs(ty - y));
      for (let i = 1; i <= n; i++) {
        x = Math.round(stroke.last[0] + ((tx - stroke.last[0]) * i) / n);
        y = Math.round(stroke.last[1] + ((ty - stroke.last[1]) * i) / n);
        if (apply(x, y, false)) stroke.n++;
      }
      stroke.last = [tx, ty];
      draw();
    }
  });
  const up = (e: PointerEvent) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) gesture = null;
    if (ptrs.size === 0 && stroke) {
      const n = stroke.n;
      stroke = null;
      if (n > 0) {
        ctx.touch();
        ctx.refresh();
      } else {
        // a touch that changed nothing is not a step to undo
        ctx.hist.drop();
        paintInspector();
        draw();
      }
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e as unknown as PointerEvent);
    zoomBy(e.deltaY < 0 ? 1.1 : 0.9, p.x, p.y);
  }, { passive: false });

  // ---- the inspector for a door, a person, a thing, a chest or a sign
  const inspector = h('div.stInspect', { 'aria-live': 'polite' });
  const paintInspector = () => {
    const sel = st.sel;
    if (!sel || sel.x >= room.w || sel.y >= room.h) return clear(inspector);
    const ch = tileAt(room, sel.x, sel.y);
    const key = markKey(sel.x, sel.y);
    const where = `${sel.x + 1}, ${sel.y + 1}`;
    const close = btn('Done', () => ((st.sel = null), ctx.refresh()), '', 'Close this');
    const remove = btn('Remove', () => (attempt(ctx, () => setTile(room, sel.x, sel.y, '.')), (st.sel = null), ctx.refresh()), 'warn', 'Remove this tile');
    if (ch === 'D') {
      const d = room.doors.find((x) => x.x === sel.x && x.y === sel.y) ?? newDoor(ctx.game(), room, sel.x, sel.y);
      const to = ctx.game().rooms.find((r) => r.id === d.room);
      clear(inspector, section(`Door at ${where}`,
        note(d.room ? `It opens into ${to?.name ?? 'a room that is gone'}.` : 'Pick the room this door opens into.'),
        field('Opens into', select([['', 'Choose a room'], ...ctx.game().rooms.filter((r) => r.id !== room.id).map((r): [string, string] => [r.id, r.name]), [room.id, `${room.name} (this room)`]], d.room, (v) => v && attempt(ctx, (gg) => linkDoor(gg, room, d, v)), 'The room this door opens into')),
        to && to.doors.length ? field('Arrives at', select(to.doors.map((x): [string, string] => [x.id, `Door at ${x.x + 1}, ${x.y + 1}`]), d.door, (v) => attempt(ctx, () => (d.door = v)), 'The door it arrives at')) : null,
        toggle('Locked', d.locked, (v) => attempt(ctx, () => (d.locked = v))),
        d.locked ? note('A key thing for this door opens it, or a quest’s reward. Make the key in THINGS and choose this door for it.') : null,
        h('div.stRow', remove, close)));
    } else if (ch === 'N') {
      const gg = ctx.game();
      clear(inspector, section(`Character at ${where}`,
        gg.npcs.length ? field('Who stands here', select(gg.npcs.map((n): [string, string] => [n.id, n.name]), room.marks[key] ?? '', (v) => attempt(ctx, () => (room.marks[key] = v)), 'Which character stands here')) : note('No characters yet. Add one in CHARACTERS, then choose it here.'),
        h('div.stRow', btn('Characters', () => ctx.go('characters'), '', 'Open characters'), remove, close)));
    } else if (ch === 'T' || ch === 'c') {
      const gg = ctx.game();
      const opts: [string, string][] = [['', 'Nothing'], ...gg.things.map((t): [string, string] => [t.id, t.name]), ...(ch === 'c' ? gg.quests.map((q): [string, string] => [`q:${q.id}`, `Reward of “${q.name}”`]) : [])];
      clear(inspector, section(`${ch === 'T' ? 'Thing' : 'Chest'} at ${where}`,
        field(ch === 'T' ? 'Which thing lies here' : 'What is in the chest', select(opts, room.marks[key] ?? '', (v) => attempt(ctx, () => (room.marks[key] = v)), ch === 'T' ? 'Which thing lies here' : 'What the chest holds')),
        h('div.stRow', remove, close)));
    } else if (ch === 'i') {
      clear(inspector, section(`Sign at ${where}`, field('What it says', text(room.marks[key] ?? '', (v) => attempt(ctx, () => (room.marks[key] = v.slice(0, 200))), { aria: 'What the sign says', multiline: true, max: 200 }), 'shown while the player stands on it'), h('div.stRow', remove, close)));
    } else clear(inspector);
  };
  paintInspector();

  // ---- Ghosty sketches a room (a chat turn: the game's own words, a first draft to paint over)
  const wish = text('', () => undefined, { aria: 'Describe a room for Ghosty to sketch', placeholder: 'a cave with two ledges and a chest at the end', max: 120 }) as HTMLInputElement;
  const sketchRow = section('Sketch a room with Ghosty',
    h('div.stAsk', wish, btn('Sketch it', (b) => {
      const v = wish.value.trim();
      if (!v) return ctx.say('Say what the room is like first.');
      b.disabled = true;
      b.textContent = 'Sketching…';
      ctx.sketch(v);
    }, 'pri', 'Ask Ghosty to sketch this room')),
    note('It replaces this room with a first draft in the same tiles. Undo puts yours back.'));

  // ---- what the player starts from
  const bar = h('div.stRow.stBar',
    btn('Play from here', () => {
      const sel = st.sel ?? findStart(room);
      st.at = { room: room.id, x: sel.x, y: sel.y };
      ctx.go('play');
    }, 'pri', 'Play from the selected tile, or from the start'),
    btn(room.id === g.start ? 'This is the first room' : 'Make this the first room', () => attempt(ctx, (x) => (x.start = room.id)), '', 'The game begins in this room'));

  // ---- his problems with this room
  const probs = ctx.game().rooms.length > 1 && !room.doors.length ? note(`“${room.name}” has no way out: tap the Door tile, put it in the room and choose where it goes.`, 'stWarn') : null;

  root.append(rooms, settings, tools, tray, h('div.stCanvasWrap', box, h('p.stCap', `${LETTER_NAMES[st.letter] ?? nameOf(ctx, st.letter)} is picked. One finger paints, two fingers pan, pinch to zoom.`)), inspector, bar, sketchRow, ...(probs ? [probs] : []));
  requestAnimationFrame(draw);
  new ResizeObserver(draw).observe(box);
  return root;
}
function findStart(room: Room): { x: number; y: number } {
  for (let y = 0; y < room.h; y++) {
    const x = room.rows[y]!.indexOf('P');
    if (x >= 0) return { x, y };
  }
  return { x: 1, y: 1 };
}
void TS;
void chips;
