/**
 * FREE-FORM SLIDES ON SCREEN (APPS ROUND, editors: the pro edition): the FREE panel of a slide. TEXT BOX, PICTURE and SHAPE add as many as he
 * likes; a tap on the slide (or on the list) chooses one, SELECT MORE chooses several; a drag moves the chosen ones and snaps them to the
 * slide's centre and edges and to the other items, the guides drawn while it snaps; ALIGN, DISTRIBUTE, GROUP and UNGROUP, BRING FORWARD and
 * SEND BACK, and DELETE. Each change is one step of the deck's history (UNDO takes it back) and is kept in the .pptx both ways.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { H, SHAPE_NAMES, W, type Deck, type ShapeKind, type Slide } from './model';
import { addFree, alignFree, changeFree, distributeFree, freeWords, groupFree, layerFree, moveFree, removeFree, snap, together, bounds, ungroupFree, type AlignHow, type Guide } from './free';

export interface FreeHost {
  deck(): Deck;
  slide(): Slide;
  /** The deck with this slide changed (one step of history). */
  put(next: Slide, then?: 'draw' | 'none'): void;
  say(words: string): void;
  /** The slide's drawing on screen (its box), drawn again with the chosen items, a slide not yet kept, and guides. */
  stage(): HTMLElement | null;
  draw(o: { sel: string[]; tmp?: Slide | null; guides?: Guide[] }): void;
  photo(): Promise<{ id: string; iw: number; ih: number } | null>;
}

const SHAPES: ShapeKind[] = ['rect', 'round', 'ellipse', 'arrow', 'line'];
const ALIGN: [AlignHow, string][] = [['left', 'LEFT'], ['centre', 'CENTRE'], ['right', 'RIGHT'], ['top', 'TOP'], ['middle', 'MIDDLE'], ['bottom', 'BOTTOM']];

export function freePanel(host: FreeHost): { el: HTMLElement; paint(): void; sel(): string[]; tap(id: string): void; bind(stage: HTMLElement): void } {
  let sel: string[] = [];
  let more = false;
  const key = (label: string, run: () => void, name = '', cls = '') => {
    const b = button(label, run, cls);
    if (name) b.setAttribute('aria-label', name);
    return b;
  };
  const list = h('div.slfreelist', { role: 'list', 'aria-label': 'What is on the slide, back to front' });
  const textIn = h('input', { type: 'text', 'aria-label': 'The words of the chosen text box', placeholder: 'The text box’s words', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
  const textRow = h('div.slrow', textIn);
  const moreKey = key('SELECT MORE', () => {
    more = !more;
    paint();
    host.say(more ? 'Tap more items to add them to the choice.' : 'A tap chooses one item again.');
  }, 'Choose several items');
  const items = () => host.slide().free ?? [];
  const live = () => sel.filter((id) => items().some((i) => i.id === id));
  const need = (n: number, words: string): boolean => {
    if (live().length >= n) return true;
    host.say(words);
    return false;
  };
  const added = (r: { slide: Slide; id: string }, words: string) => {
    sel = [r.id];
    host.put(r.slide);
    host.say(`${words} UNDO takes it off.`);
    paint();
  };
  textIn.addEventListener('change', () => {
    const one = items().find((i) => i.id === live()[0] && i.kind === 'text');
    if (!one) return;
    host.put(changeFree(host.slide(), one.id, { text: textIn.value }), 'draw');
    host.say('The text box’s words are changed.');
    paint();
  });
  const shapeKeys = SHAPES.map((k) => key(SHAPE_NAMES[k].toUpperCase(), () => {
    const one = items().find((i) => i.id === live()[0] && i.kind === 'shape');
    if (one) {
      host.put(changeFree(host.slide(), one.id, { shape: k, ...(k === 'line' ? {} : { h: Math.max(one.h, 80) }) }));
      host.say(`The shape is now ${SHAPE_NAMES[k].toLowerCase()}.`);
    } else added(addFree(host.slide(), 'shape', { shape: k }), `${k === 'ellipse' || k === 'arrow' ? 'An' : 'A'} ${SHAPE_NAMES[k].toLowerCase()} shape is on the slide.`);
    paint();
  }, `A ${SHAPE_NAMES[k].toLowerCase()} shape`));
  const el = h('div.slpanel.slfree-panel',
    h('small.slh', 'ADD'),
    h('div.slrow',
      key('TEXT BOX', () => added(addFree(host.slide(), 'text'), 'A text box is on the slide: type its words below, drag it where you want.'), 'Add a text box'),
      key('PICTURE', () => void host.photo().then((p) => {
        if (!p) return;
        const w = Math.min(560, W * 0.45);
        const hh = Math.min(H * 0.6, (w * p.ih) / Math.max(1, p.iw));
        added(addFree(host.slide(), 'pic', { img: p.id, alt: '', w: Math.round((hh * p.iw) / Math.max(1, p.ih)), h: Math.round(hh) }), 'A picture is on the slide, kept on this phone only.');
      }), 'Add a picture'),
    ),
    h('div.slrow', ...shapeKeys),
    h('small.slh', 'ON THE SLIDE'),
    list,
    textRow,
    h('div.slrow', moreKey, key('DELETE', () => {
      if (!need(1, 'Choose an item first: tap it on the slide or in the list.')) return;
      const n = together(host.slide(), live()).length;
      host.put(removeFree(host.slide(), live()));
      sel = [];
      host.say(`${n === 1 ? 'The item is' : `${n} items are`} off the slide. UNDO brings ${n === 1 ? 'it' : 'them'} back.`);
      paint();
    }, 'Delete the chosen items')),
    h('small.slh', 'ALIGN'),
    h('div.slrow', ...ALIGN.map(([how, label]) => key(label, () => {
      if (!need(1, 'Choose what to line up first.')) return;
      const units = new Set(together(host.slide(), live()).map((id) => items().find((i) => i.id === id)?.group ?? id)).size;
      host.put(alignFree(host.slide(), live(), how));
      host.say(units > 1 ? `Lined up on the ${how === 'centre' || how === 'middle' ? how : `${how} edge`}.` : `Put on the slide’s ${how === 'centre' || how === 'middle' ? how : `${how} edge`}.`);
    }, `Align ${how}`))),
    h('div.slrow', ...(['x', 'y'] as const).map((axis) => key(axis === 'x' ? 'SPREAD ACROSS' : 'SPREAD DOWN', () => {
      const next = distributeFree(host.slide(), live(), axis);
      if (!next) return host.say('Choose three or more items to spread them evenly.');
      host.put(next);
      host.say(`Spread evenly ${axis === 'x' ? 'across' : 'down'}.`);
    }, axis === 'x' ? 'Distribute across, evenly' : 'Distribute down, evenly'))),
    h('small.slh', 'GROUP AND LAYERS'),
    h('div.slrow', key('GROUP', () => {
      const r = groupFree(host.slide(), live());
      if (!r) return host.say('Choose two or more items to group (SELECT MORE).');
      host.put(r.slide);
      host.say('Grouped: they move, line up and layer as one. UNGROUP lets them go.');
      paint();
    }, 'Group the chosen items'), key('UNGROUP', () => {
      const r = ungroupFree(host.slide(), live());
      if (!r.n) return host.say('The chosen items are not in a group.');
      host.put(r.slide);
      host.say(`Ungrouped: ${r.n} items move on their own again.`);
      paint();
    }, 'Ungroup the chosen items')),
    h('div.slrow', ...(['forward', 'back', 'front', 'rear'] as const).map((how) => key(how === 'forward' ? 'FORWARD' : how === 'back' ? 'BACK' : how === 'front' ? 'TO FRONT' : 'TO BACK', () => {
      if (!need(1, 'Choose an item first.')) return;
      const next = layerFree(host.slide(), live(), how);
      if (next === host.slide()) return host.say(how === 'forward' || how === 'front' ? 'It is in front already.' : 'It is at the back already.');
      host.put(next);
      host.say(how === 'forward' ? 'Brought one step forward.' : how === 'back' ? 'Sent one step back.' : how === 'front' ? 'Brought to the front.' : 'Sent to the back.');
      paint();
    }, how === 'forward' ? 'Bring forward' : how === 'back' ? 'Send back' : how === 'front' ? 'Bring to the front' : 'Send to the back'))),
    h('p.slnote', 'Drag a chosen item on the slide: it snaps to the middle and the edges, and to the other items, with a guide line.'),
  );
  function tap(id: string): void {
    if (more) sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...live(), id];
    else sel = [id];
    const it = items().find((i) => i.id === id);
    if (it) host.say(`${freeWords(it)} is chosen${sel.length > 1 ? ` (${sel.length} chosen)` : ''}.`);
    paint();
  }
  function paint(): void {
    sel = live();
    clear(list, ...(items().length ? items().map((it, n) => {
      const b = key(`${n + 1}. ${freeWords(it)}${it.group ? ' · grouped' : ''}`, () => tap(it.id), `Choose item ${n + 1}: ${freeWords(it)}`, 'slfreeitem');
      b.setAttribute('aria-pressed', String(sel.includes(it.id)));
      b.dataset.free = it.id;
      return b;
    }) : [h('p.slnote', 'Nothing free on this slide yet. Add a text box, a picture or a shape.')]));
    const one = items().find((i) => i.id === sel[0]);
    textRow.hidden = !(one?.kind === 'text' && sel.length === 1);
    if (one?.kind === 'text') textIn.value = one.text ?? '';
    moreKey.setAttribute('aria-pressed', String(more));
    host.draw({ sel });
  }
  // a drag on the slide moves what is chosen (or what it starts on), snapping as it goes
  function bind(stage: HTMLElement): void {
    let drag: { id: number; x0: number; y0: number; ids: string[]; box: { x: number; y: number; w: number; h: number }; moved: boolean; dx: number; dy: number } | null = null;
    stage.addEventListener('pointerdown', (e) => {
      const g = (e.target as Element).closest<SVGElement>('[data-free]');
      if (!g || el.hidden) return;
      const id = g.dataset.free!;
      if (!sel.includes(id)) tap(id);
      const ids = together(host.slide(), sel);
      const box = bounds(items().filter((i) => ids.includes(i.id)));
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ids, box, moved: false, dx: 0, dy: 0 };
      stage.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const k = W / Math.max(1, stage.getBoundingClientRect().width);
      const rx = (e.clientX - drag.x0) * k;
      const ry = (e.clientY - drag.y0) * k;
      if (!drag.moved && Math.hypot(rx, ry) < 6) return;
      drag.moved = true;
      const others = items().filter((i) => !drag!.ids.includes(i.id));
      const sn = snap({ ...drag.box, x: drag.box.x + rx, y: drag.box.y + ry }, others);
      drag.dx = sn.x - drag.box.x;
      drag.dy = sn.y - drag.box.y;
      host.draw({ sel, tmp: moveFree(host.slide(), drag.ids, drag.dx, drag.dy), guides: sn.guides });
    });
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.moved) return host.draw({ sel });
      host.put(moveFree(host.slide(), d.ids, d.dx, d.dy), 'draw');
      host.say('Moved. UNDO puts it back.');
      paint();
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }
  return { el, paint, sel: () => live(), tap, bind };
}
