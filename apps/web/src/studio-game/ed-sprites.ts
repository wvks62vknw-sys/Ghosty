/**
 * SPRITES (BRIEF-EDITOR-GAME-STUDIO): the 16 × 16 pixel editor. The palette (the kit's sixteen inks), PEN, ERASER, FILL, MIRROR,
 * frames with an onion skin, PLAY the animation, DUPLICATE; each cell 22 pt so a finger lands, the whole grid 352 pt at 390
 * upright. The same editor draws his own tiles (one frame, solid or not), which then sit at the end of the room's tray.
 */
import { clear, h } from '../core/dom';
import { undo } from '../ui/components';
import { frameCanvas } from './draw';
import { attempt, btn, chips, type Ctx, field, note, section, text, toggle } from './ed-core';
import { addFrame, ANIMS, BLANK, fillPixels, type Frame, frameAt, INKS, mirrorFrame, newSprite, newTile, removeFrame, setPixel, type Sprite } from './model';

const CELL = 22;
const SIZE = CELL * 16;

export function spritesPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const st = ctx.state;
  const root = h('div.stPill');
  const tileMode = !!st.tile && g.tiles.some((t) => t.id === st.tile);
  if (!tileMode) st.tile = '';
  const tile = tileMode ? g.tiles.find((t) => t.id === st.tile)! : null;
  if (!g.sprites.some((s) => s.id === st.spriteId)) st.spriteId = g.sprites[0]?.id ?? '';
  const sprite: Sprite | undefined = g.sprites.find((s) => s.id === st.spriteId);

  // ---- what is being drawn
  root.append(h('div.stChips', { role: 'group', 'aria-label': 'What to draw' },
    ...g.sprites.map((s) => h('button.stChip', { type: 'button', 'aria-pressed': String(!tileMode && s.id === st.spriteId), 'aria-label': `Sprite ${s.name}`, onclick: () => ((st.tile = ''), (st.spriteId = s.id), (st.frame = 0), ctx.refresh()) }, s.name)),
    btn('+ Sprite', () => attempt(ctx, (x) => {
      const s = newSprite(x, `Sprite ${x.sprites.length + 1}`);
      x.sprites.push(s);
      st.tile = '';
      st.spriteId = s.id;
      st.frame = 0;
      st.anim = 'idle';
    }), 'stChip stAdd', 'Add a sprite'),
  ), h('div.stChips', { role: 'group', 'aria-label': 'Your tiles' },
    ...g.tiles.map((t) => h('button.stChip', { type: 'button', 'aria-pressed': String(tileMode && t.id === st.tile), 'aria-label': `Tile ${t.name}`, onclick: () => ((st.tile = t.id), ctx.refresh()) }, `Tile: ${t.name}`)),
    btn('+ Tile', () => attempt(ctx, (x) => {
      const t = newTile(x, `Tile ${x.tiles.length + 1}`);
      x.tiles.push(t);
      st.tile = t.id;
    }), 'stChip stAdd', 'Add a tile of your own'),
  ));
  if (!sprite && !tile) {
    root.append(note('Nothing to draw yet. Add a sprite or a tile.'));
    return root;
  }

  // ---- the frame being drawn
  const anims = ANIMS;
  if (sprite && !(anims as readonly string[]).includes(st.anim)) st.anim = 'idle';
  const list = (): Frame[] => (sprite ? (sprite.anims[st.anim] ??= []) : []);
  if (sprite && !list().length) list().push(BLANK);
  if (sprite && st.frame >= list().length) st.frame = list().length - 1;
  const cur = (): Frame => (tile ? tile.px : (list()[st.frame] ?? BLANK));
  const setCur = (f: Frame) => {
    if (tile) tile.px = f;
    else list()[st.frame] = f;
  };

  const canvas = h('canvas.stPix', { role: 'img', 'aria-label': `${tile ? tile.name : sprite!.name}: 16 by 16 pixels. Touch to draw.` });
  const c2 = canvas.getContext('2d')!;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width = `${SIZE}px`;
  canvas.style.height = `${SIZE}px`;
  const paint = () => {
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.imageSmoothingEnabled = false;
    const f = cur();
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        c2.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.13)';
        c2.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    if (st.onion && sprite && st.frame > 0) {
      c2.globalAlpha = 0.35;
      c2.drawImage(frameCanvas(list()[st.frame - 1] ?? BLANK), 0, 0, SIZE, SIZE);
      c2.globalAlpha = 1;
    }
    c2.drawImage(frameCanvas(f), 0, 0, SIZE, SIZE);
    c2.strokeStyle = 'rgba(255,255,255,.18)';
    c2.lineWidth = 1;
    c2.beginPath();
    for (let i = 0; i <= 16; i++) {
      c2.moveTo(i * CELL + 0.5, 0);
      c2.lineTo(i * CELL + 0.5, SIZE);
      c2.moveTo(0, i * CELL + 0.5);
      c2.lineTo(SIZE, i * CELL + 0.5);
    }
    c2.stroke();
  };
  const cellOf = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * 16), Math.floor(((e.clientY - r.top) / r.height) * 16)];
  };
  let down = false;
  let lastCell: [number, number] | null = null;
  const dab = (x: number, y: number, first: boolean) => {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const ink = st.pen === 'erase' ? 0 : st.ink;
    if (st.pen === 'fill') {
      if (first) setCur(fillPixels(cur(), x, y, ink));
    } else setCur(setPixel(cur(), x, y, ink));
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* a touch that is already gone */
    }
    down = true;
    ctx.push();
    const [x, y] = cellOf(e);
    lastCell = [x, y];
    dab(x, y, true);
    paint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down || st.pen === 'fill') return;
    const [x, y] = cellOf(e);
    if (lastCell && x === lastCell[0] && y === lastCell[1]) return;
    // each cell between the last and this one
    const [lx, ly] = lastCell ?? [x, y];
    const n = Math.max(Math.abs(x - lx), Math.abs(y - ly));
    for (let i = 1; i <= n; i++) dab(Math.round(lx + ((x - lx) * i) / n), Math.round(ly + ((y - ly) * i) / n), false);
    lastCell = [x, y];
    paint();
  });
  const end = () => {
    if (!down) return;
    down = false;
    ctx.touch();
    ctx.refresh();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // ---- the tools, the palette
  const tools = h('div.stTools', { role: 'group', 'aria-label': 'Drawing tools' },
    ...([['pen', 'Pen', 'Pen: draws the picked ink'], ['erase', 'Eraser', 'Eraser: clears pixels'], ['fill', 'Fill', 'Fill: fills the connected pixels with the picked ink']] as const).map(([id, label, aria]) => h('button.stChip.stTool', { type: 'button', 'aria-pressed': String(st.pen === id), 'aria-label': aria, dataset: { pen: id }, onclick: () => ((st.pen = id), ctx.refresh()) }, label)),
    btn('Mirror', () => attempt(ctx, () => setCur(mirrorFrame(cur()))), 'stChip', 'Mirror: flips the frame left to right'),
  );
  const palette = h('div.stPalette', { role: 'group', 'aria-label': 'Inks' },
    ...INKS.map((ink, i) => {
      const b = h('button.stInk', { type: 'button', 'aria-pressed': String(st.ink === i && st.pen !== 'erase'), 'aria-label': ink.name, title: ink.name, dataset: { ink: String(i) }, onclick: () => ((st.ink = i), st.pen === 'erase' && (st.pen = 'pen'), ctx.refresh()) });
      if (ink.hex) b.style.background = ink.hex;
      else b.classList.add('clear');
      return b;
    }),
  );

  root.append(h('div.stPixWrap', canvas), tools, palette);

  // ---- tiles: name, solid, use
  if (tile) {
    root.append(section('This tile',
      field('Name', text(tile.name, (v) => attempt(ctx, () => (tile.name = v.trim().slice(0, 24) || tile.name)), { aria: 'Tile name', max: 24 })),
      toggle('Solid', tile.solid, (v) => attempt(ctx, () => (tile.solid = v))),
      note(tile.solid ? 'Bodies stop at it, as at a wall.' : 'Bodies pass through it, as through air.'),
      h('div.stRow',
        btn('Use in a room', () => ((st.letter = tile.id), (st.tool = 'paint'), ctx.go('rooms')), 'pri', `Paint with ${tile.name} in the room`),
        btn('Delete tile', () => {
          const name = tile.name;
          const id = tile.id;
          attempt(ctx, (x) => {
            x.tiles = x.tiles.filter((t) => t.id !== id);
            for (const r of x.rooms) r.rows = r.rows.map((row) => row.split(id).join('.'));
          });
          st.tile = '';
          st.letter = '#';
          undo(`Deleted the tile “${name}”.`, () => ctx.undo());
        }, 'warn'))));
    paint();
    return root;
  }

  // ---- sprites: animation, frames, onion, play, name
  const sp = sprite!;
  const frames = h('div.stFrames', { role: 'group', 'aria-label': 'Frames' },
    ...list().map((f, i) => {
      const t = document.createElement('canvas');
      t.width = t.height = 16;
      t.getContext('2d')!.drawImage(frameCanvas(f), 0, 0);
      return h('button.stFrame', { type: 'button', 'aria-pressed': String(i === st.frame), 'aria-label': `Frame ${i + 1} of ${list().length}`, onclick: () => ((st.frame = i), ctx.refresh()) }, t);
    }),
  );
  const count = list().length;
  const preview = h('canvas.stPreview', { width: 64, height: 64, role: 'img', 'aria-label': `The ${st.anim} animation` });
  const live = h('p.stNote', { 'aria-live': 'off' });
  let playing = false;
  let timer = 0;
  const showPreview = (k: number) => {
    const p2 = preview.getContext('2d')!;
    p2.imageSmoothingEnabled = false;
    p2.clearRect(0, 0, 64, 64);
    p2.drawImage(frameCanvas(list()[k % Math.max(1, list().length)] ?? BLANK), 0, 0, 64, 64);
    live.textContent = playing ? `Playing ${st.anim}: frame ${(k % count) + 1} of ${count}.` : `${st.anim}: ${count} frame${count === 1 ? '' : 's'}. Press Play to see it move.`;
  };
  const playBtn = btn('Play', () => {
    playing = !playing;
    playBtn.textContent = playing ? 'Stop' : 'Play';
    playBtn.setAttribute('aria-pressed', String(playing));
    clearInterval(timer);
    let k = 0;
    showPreview(k);
    if (playing) timer = window.setInterval(() => (root.isConnected ? showPreview(++k) : clearInterval(timer)), 1000 / 6);
  }, 'pri', 'Play the animation');
  playBtn.setAttribute('aria-pressed', 'false');
  showPreview(0);

  root.append(
    chips(anims.map((a) => ({ id: a, label: a[0]!.toUpperCase() + a.slice(1) })), st.anim, (a) => ((st.anim = a), (st.frame = 0), ctx.refresh())),
    section(`Frames of ${st.anim}`, note(`Frame ${st.frame + 1} of ${count}. An animation holds up to 8 frames.`), frames,
      h('div.stRow',
        btn('Add frame', () => attempt(ctx, () => (st.frame = addFrame(sp, st.anim, BLANK))), '', 'Add a blank frame'),
        btn('Duplicate', () => attempt(ctx, () => (st.frame = addFrame(sp, st.anim, cur()))), '', 'Duplicate this frame'),
        btn('Delete frame', () => attempt(ctx, () => (removeFrame(sp, st.anim, st.frame), (st.frame = Math.max(0, st.frame - 1)))), 'warn', 'Delete this frame')),
      h('div.stRow', toggle('Onion skin', st.onion, (v) => ((st.onion = v), ctx.refresh())), playBtn),
      h('div.stPrev', preview, live)),
    section('This sprite', field('Name', text(sp.name, (v) => attempt(ctx, () => (sp.name = v.trim().slice(0, 30) || sp.name)), { aria: 'Sprite name', max: 30 })),
      btn('Delete sprite', () => {
        const used = g.player.sprite === sp.id || g.npcs.some((n) => n.sprite === sp.id) || g.things.some((t) => t.sprite === sp.id) || Object.values(g.enemySprites).includes(sp.id);
        if (used) return ctx.say(`“${sp.name}” is in use: change who wears it first.`);
        if (g.sprites.length <= 1) return ctx.say('A game keeps at least one sprite.');
        const name = sp.name;
        attempt(ctx, (x) => (x.sprites = x.sprites.filter((s) => s.id !== sp.id)));
        undo(`Deleted the sprite “${name}”.`, () => ctx.undo());
      }, 'warn')),
  );
  paint();
  void frameAt;
  void clear;
  return root;
}
