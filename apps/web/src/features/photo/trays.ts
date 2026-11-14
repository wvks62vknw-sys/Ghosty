/**
 * THE PHOTO EDITOR'S TRAYS (BRIEF-EDITOR-PHOTO): what each tool opens above the pills. LOOKS · LIGHT · COLOUR · CURVES · DETAIL · CROP ·
 * MASKS · HEAL · ERASE · LAYER · EFFECTS · BRAIN. Each slider is 44 pt tall with its value said and a double tap to reset (slider.ts).
 */
import { h } from '../../core/dom';
import { sayError } from '../../ui/hisWords';
import { button, modal, toast } from '../../ui/components';
import { ui } from '../../state/app';
import { fitCrop, applyPreset, BLENDS, HSL_NAMES, LOOKS, MAX_MASKS, newMask, newRecipe, presetOf, ratioOf, type Mask, type MaskKind, type Preset, type Recipe } from '../../photo/recipe';
import { putAlpha } from '../../photo/alpha';
import { keepLayer, listMyLooks, removeLayer, removeMyLook, saveMyLook } from '../../photo/store';
import { openPhoto } from '../../photo/load';
import { cutSubject, depthState, refineWithDepth, SUBJECT_LINE, subjectState } from '../../photo/subject';
import { CUT_FROM_DEPTH, CUT_FROM_MODEL } from '../../photo/matting';
import { packHere, packSize } from '../../photo/packget';
import { OFFER, packOffer } from './packui';
import { alphaSizeFor, blankAlpha, coverage, getAlpha } from '../../photo/alpha';
import { peState, type Ed } from './editor';
import { curvesUi } from './curves';
import { signed, slider, thousands } from './slider';

export type Tool = 'looks' | 'light' | 'color' | 'curves' | 'detail' | 'crop' | 'masks' | 'heal' | 'erase' | 'layer' | 'effects' | 'brain';
export const TOOLS: [Tool, string][] = [
  ['looks', 'LOOKS'],
  ['light', 'LIGHT'],
  ['color', 'COLOUR'],
  ['curves', 'CURVES'],
  ['detail', 'DETAIL'],
  ['crop', 'CROP'],
  ['masks', 'MASKS'],
  ['heal', 'HEAL'],
  ['erase', 'ERASE'],
  ['layer', 'LAYER'],
  ['effects', 'EFFECTS'],
  ['brain', 'BRAIN'],
];

const chips = (label: string, items: [string, string][], on: () => string, pick: (id: string) => void, cls = ''): HTMLElement => {
  const row = h(`div.perow.pechips${cls ? `.${cls}` : ''}`, { role: 'group', 'aria-label': label });
  const bs = new Map<string, HTMLButtonElement>();
  const paint = () => {
    for (const [k, b] of bs) {
      b.classList.toggle('on', k === on());
      b.setAttribute('aria-pressed', String(k === on()));
    }
  };
  for (const [id, name] of items) {
    const b = button(name, () => {
      pick(id);
      paint();
    });
    bs.set(id, b);
    row.append(b);
  }
  paint();
  return row;
};

/** A slider over one number of the recipe. */
function numberSlider(ed: Ed, o: { id: string; label: string; min: number; max: number; step: number; rest: number; get: (r: Recipe) => number; set: (r: Recipe, v: number) => void; say: (v: number) => string; after?: (v: number) => void }): HTMLElement {
  return slider({
    id: o.id,
    label: o.label,
    min: o.min,
    max: o.max,
    step: o.step,
    rest: o.rest,
    value: o.get(ed.r),
    say: o.say,
    live: (v) => {
      ed.live((r) => o.set(r, v));
      o.after?.(v);
    },
    keep: (_v, label) => ed.keep(label),
  }).el;
}

const plain = (v: number) => signed(v);

export function buildTray(tool: Tool, ed: Ed): HTMLElement {
  switch (tool) {
    case 'looks':
      return looks(ed);
    case 'light':
      return light(ed);
    case 'color':
      return colour(ed);
    case 'curves':
      return curves(ed);
    case 'detail':
      return detail(ed);
    case 'crop':
      return crop(ed);
    case 'masks':
      return masks(ed, false);
    case 'heal':
      return heal(ed);
    case 'erase':
      return erase(ed);
    case 'layer':
      return layer(ed);
    case 'effects':
      return effects(ed);
    default:
      return brain(ed);
  }
}

// ---------------------------------------------------------------- LOOKS
function looks(ed: Ed): HTMLElement {
  const strip = h('div.pelooks', { role: 'list', 'aria-label': 'Looks, each shown on this photo' });
  const state = h('p.g-truth.pelookline');
  const mk = (p: Preset | null, name: string, line: string): HTMLElement => {
    const cv = h('canvas.pelookthumb', { 'aria-hidden': 'true' });
    const b = button(h('span.pelookface', cv, h('b', name)), () => {
      const base = p ? applyPreset(ed.r, p) : { ...ed.r, ...(() => {
        const n = newRecipe();
        return { light: n.light, wb: n.wb, curves: n.curves, color: n.color, detail: n.detail, effects: { ...n.effects, seed: ed.r.effects.seed } };
      })() };
      ed.live((r) => {
        r.light = base.light;
        r.wb = base.wb;
        r.curves = base.curves;
        r.color = base.color;
        r.detail = base.detail;
        r.effects = base.effects;
      });
      ed.keep(p ? `Look: ${name}` : 'Look taken off');
      state.textContent = p ? `${name}: ${line}` : 'The photo as it was shot (your crop, masks and heals stay).';
    }, 'pelook');
    b.setAttribute('role', 'listitem');
    b.setAttribute('aria-label', `${name}. ${line}`);
    // the thumbnail is drawn on this photo, a little after the tray is up
    window.setTimeout(() => {
      try {
        const src = p ? applyPreset(ed.r, p) : { ...ed.r, ...(() => {
          const n = newRecipe();
          return { light: n.light, wb: n.wb, curves: n.curves, color: n.color, detail: n.detail, effects: { ...n.effects, seed: ed.r.effects.seed } };
        })() };
        const t = ed.thumb(src, 112);
        cv.width = t.width;
        cv.height = t.height;
        cv.getContext('2d')!.drawImage(t, 0, 0);
      } catch {
        /* a look with no picture still works */
      }
    }, 0);
    return b;
  };
  strip.append(mk(null, 'ORIGINAL', 'the photo as it was shot'));
  for (const l of LOOKS) strip.append(mk(l, l.name, l.line));
  void listMyLooks().then((mine) => {
    for (const l of mine) {
      const tile = h('div.pelookmine', mk(l, l.name, 'a look of yours'), button('✕', () => {
        void removeMyLook(l.name).then(() => {
          peState.looks = peState.looks.filter((x) => x !== l.name);
          ed.refreshTray();
        });
      }, 'pelookdel'));
      (tile.querySelector('.pelookdel') as HTMLElement).setAttribute('aria-label', `Delete your look ${l.name}`);
      strip.append(tile);
    }
  });
  const save = button('SAVE THIS AS A LOOK', () => {
    const input = h('input.peinput', { type: 'text', maxLength: 28, placeholder: 'A name for it', 'aria-label': 'A name for this look' }) as HTMLInputElement;
    const err = h('p.g-truth');
    const m = modal('SAVE A LOOK', h('div.pesave',
      h('p.pnote', 'A look keeps how this photo feels: the light, the colour, the curves, the detail and the effects. Not its crop, its masks or its heals, so it fits any photo.'),
      input,
      err,
      h('div.perow', button('SAVE', () => {
        const name = input.value.trim().replace(/\s+/g, ' ').toUpperCase();
        if (!name) return void (err.textContent = 'Give it a name first.');
        if (LOOKS.some((l) => l.name === name)) return void (err.textContent = 'That is one of my eight: pick another name.');
        void saveMyLook(presetOf(ed.r, name, 'a look of yours')).then(() => {
          peState.looks = [...new Set([...peState.looks, name])];
          m.close();
          toast(`Saved the look ${name}`, 'ok');
          ed.refreshTray();
        });
      }, 'on'), button('CANCEL', () => m.close())),
    ));
    window.setTimeout(() => input.focus(), 60);
  }, 'on');
  return h('div.petrayin', h('p.g-truth.peintro', 'EIGHT LOOKS, EACH SHOWN ON THIS PHOTO'), strip, state, h('div.perow', save), copyPaste(ed, state));
}

// ---------------------------------------------------------------- COPY EDITS / PASTE EDITS
/** Where the copied edits wait (on this phone only): the look of one photo, ready to lay on another. */
export const COPIED_KEY = 'ghosty.photo.copiedEdits';
interface Copied { from: string; name: string; at: number; look: Preset['look'] }
const readCopied = (): Copied | null => {
  try {
    const c = JSON.parse(localStorage.getItem(COPIED_KEY) ?? 'null') as Copied | null;
    return c && c.look && c.look.light ? c : null;
  } catch {
    return null;
  }
};

/** COPY EDITS keeps this photo's light, colour, curves, detail and effects; PASTE EDITS lays them on the photo open now, as one step UNDO
 * takes back. The crop, the masks, the heals and the layer belong to each photo and are never carried across. */
function copyPaste(ed: Ed, state: HTMLElement): HTMLElement {
  const copyB = button('COPY EDITS', () => {
    const p = presetOf(ed.r, 'copied');
    const c: Copied = { from: peState.id, name: peState.name || 'this photo', at: Date.now(), look: p.look };
    try {
      localStorage.setItem(COPIED_KEY, JSON.stringify(c));
    } catch {
      return void (state.textContent = 'This phone would not let me keep the copy: its storage is full or switched off.');
    }
    peState.copied = c.name;
    state.textContent = `Copied the light, colour, curves, detail and effects of ${c.name}. Open another photo and press PASTE EDITS.`;
    paint();
  }, 'pecopy');
  const pasteB = button('PASTE EDITS', () => {
    const c = readCopied();
    if (!c) return void (state.textContent = 'Nothing copied yet: press COPY EDITS on the photo whose look you want.');
    const next = applyPreset(ed.r, { name: 'pasted', line: '', look: c.look });
    ed.live((r) => {
      r.light = next.light;
      r.wb = next.wb;
      r.curves = next.curves;
      r.color = next.color;
      r.detail = next.detail;
      r.effects = next.effects;
    });
    ed.keep(`Edits pasted from ${c.name}`);
    state.textContent = c.from === peState.id
      ? 'Pasted this photo’s own copied edits back. UNDO takes them off.'
      : `Pasted the edits of ${c.name}. Your crop, masks and heals stay as they were; UNDO takes the paste off.`;
  }, 'pepaste');
  const paint = () => {
    const c = readCopied();
    pasteB.disabled = !c;
    pasteB.setAttribute('aria-label', c ? `Paste edits from ${c.name}` : 'Paste edits: nothing copied yet');
  };
  paint();
  return h('div.perow.pecopyrow', { role: 'group', 'aria-label': 'Copy and paste edits between photos' }, copyB, pasteB);
}

// ---------------------------------------------------------------- LIGHT
function light(ed: Ed): HTMLElement {
  const L = (id: string, label: string, key: keyof Recipe['light'], min: number, max: number, step: number, say: (v: number) => string) =>
    numberSlider(ed, { id, label, min, max, step, rest: 0, get: (r) => r.light[key], set: (r, v) => (r.light[key] = v), say });
  return h('div.petrayin',
    L('exposure', 'Exposure', 'exposure', -5, 5, 0.05, (v) => `${signed(v, 1)} stops`),
    L('contrast', 'Contrast', 'contrast', -100, 100, 1, plain),
    L('highlights', 'Highlights', 'highlights', -100, 100, 1, plain),
    L('shadows', 'Shadows', 'shadows', -100, 100, 1, plain),
    L('whites', 'Whites', 'whites', -100, 100, 1, plain),
    L('blacks', 'Blacks', 'blacks', -100, 100, 1, plain),
  );
}

// ---------------------------------------------------------------- COLOUR
let band = 0;
function colour(ed: Ed): HTMLElement {
  const bandRow = chips('Which colour', HSL_NAMES.map((n, i) => [String(i), n.charAt(0) + n.slice(1).toLowerCase()]), () => String(band), (i) => {
    band = Number(i);
    ed.refreshTray();
  }, 'pebands');
  const B = (key: 'h' | 's' | 'l', label: string) =>
    numberSlider(ed, { id: `band-${key}`, label, min: -100, max: 100, step: 1, rest: 0, get: (r) => r.color.hsl[band]![key], set: (r, v) => (r.color.hsl[band]![key] = v), say: plain });
  return h('div.petrayin',
    numberSlider(ed, { id: 'temp', label: 'Temperature', min: 2500, max: 10000, step: 50, rest: 6500, get: (r) => r.wb.temp, set: (r, v) => (r.wb.temp = v), say: (v) => `${thousands(v)} K` }),
    numberSlider(ed, { id: 'tint', label: 'Tint', min: -100, max: 100, step: 1, rest: 0, get: (r) => r.wb.tint, set: (r, v) => (r.wb.tint = v), say: (v) => (v === 0 ? '0' : v > 0 ? `${v} magenta` : `${-v} green`) }),
    numberSlider(ed, { id: 'vibrance', label: 'Vibrance', min: -100, max: 100, step: 1, rest: 0, get: (r) => r.color.vibrance, set: (r, v) => (r.color.vibrance = v), say: plain }),
    numberSlider(ed, { id: 'saturation', label: 'Colour', min: -100, max: 100, step: 1, rest: 0, get: (r) => r.color.saturation, set: (r, v) => (r.color.saturation = v), say: plain }),
    h('p.g-truth.peintro', 'EIGHT COLOURS, EACH ITS OWN'),
    bandRow,
    B('h', 'Hue'),
    B('s', 'Colour'),
    B('l', 'Light'),
  );
}

// ---------------------------------------------------------------- CURVES
function curves(ed: Ed): HTMLElement {
  const c = curvesUi(
    () => ed.r.curves,
    (cv) => ed.live((r) => (r.curves = cv)),
    (_cv, label) => ed.keep(label),
  );
  return h('div.petrayin', c.el);
}

// ---------------------------------------------------------------- DETAIL
function detail(ed: Ed): HTMLElement {
  const D = (id: string, label: string, key: keyof Recipe['detail'], min: number, max: number, step: number, rest: number, say: (v: number) => string) =>
    numberSlider(ed, { id, label, min, max, step, rest, get: (r) => r.detail[key], set: (r, v) => (r.detail[key] = v), say });
  return h('div.petrayin',
    D('amount', 'Sharpen', 'amount', 0, 100, 1, 0, (v) => `amount ${Math.round(v)}`),
    D('radius', 'Sharpen radius', 'radius', 0.5, 3, 0.1, 1, (v) => `radius ${v.toFixed(1)}`),
    D('threshold', 'Sharpen threshold', 'threshold', 0, 25, 1, 0, (v) => `threshold ${Math.round(v)}`),
    D('noise', 'Noise reduction', 'noise', 0, 100, 1, 0, (v) => `strength ${Math.round(v)}`),
    h('p.g-truth.peintro', 'SHARPENING KEEPS EDGES; NOISE REDUCTION KEEPS THEM TOO'),
  );
}

// ---------------------------------------------------------------- CROP
const RATIOS: [string, string][] = [['free', 'FREE'], ['1:1', '1:1'], ['4:5', '4:5'], ['3:2', '3:2'], ['16:9', '16:9'], ['9:16', '9:16']];
function crop(ed: Ed): HTMLElement {
  const grid = ed as Ed & { cropGrid?: (on: boolean) => void; resetView?: () => void };
  const ratioRow = chips('Crop shape', RATIOS, () => ed.r.crop.ratio, (id) => {
    ed.live((r) => {
      r.crop.ratio = id;
      const f = ed.cropFrame();
      if (id === 'free') return;
      const fit = fitCrop(f.w, f.h, r.crop.angle, ratioOf(id), { x: r.crop.x + r.crop.w / 2, y: r.crop.y + r.crop.h / 2 });
      Object.assign(r.crop, fit);
    });
    ed.keep(`Crop ${id === 'free' ? 'free' : id}`);
    ed.overlay();
  });
  const angle = slider({
    id: 'angle',
    label: 'Straighten',
    min: -45,
    max: 45,
    step: 0.1,
    rest: 0,
    value: ed.r.crop.angle,
    say: (v) => `${signed(v, 1)}°`,
    live: (v) => {
      ed.live((r) => {
        r.crop.angle = v;
        const f = ed.cropFrame();
        const c = r.crop;
        const fit = fitCrop(f.w, f.h, v, ratioOf(c.ratio) || (c.w * f.w) / (c.h * f.h), { x: c.x + c.w / 2, y: c.y + c.h / 2 });
        // never bigger than it was, never outside the turned picture
        if (fit.w < c.w - 1e-6 || fit.h < c.h - 1e-6) Object.assign(c, fit);
      });
      grid.cropGrid?.(true);
    },
    keep: (_v, label) => {
      grid.cropGrid?.(false);
      ed.keep(label);
    },
  });
  const turn = button('ROTATE', () => {
    ed.live((r) => {
      r.crop.quarter = (r.crop.quarter + 1) % 4;
      r.crop = { ...r.crop, x: 0, y: 0, w: 1, h: 1, ratio: 'free' };
      const f = ed.cropFrame();
      Object.assign(r.crop, fitCrop(f.w, f.h, r.crop.angle, 0));
    });
    ed.keep('Rotated a quarter turn');
    grid.resetView?.();
    ed.refreshTray();
  });
  const flip = button('FLIP', () => {
    ed.live((r) => (r.crop.flip = !r.crop.flip));
    ed.keep(ed.r.crop.flip ? 'Flipped' : 'Flipped back');
    ed.refreshTray();
  });
  flip.classList.toggle('on', ed.r.crop.flip);
  flip.setAttribute('aria-pressed', String(ed.r.crop.flip));
  const reset = button('RESET', () => {
    ed.live((r) => {
      r.crop = { x: 0, y: 0, w: 1, h: 1, angle: 0, quarter: 0, flip: false, ratio: 'free' };
      r.persp = [[0, 0], [0, 0], [0, 0], [0, 0]];
      r.lens = 0;
    });
    ed.keep('Crop reset');
    grid.resetView?.();
    ed.refreshTray();
  });
  reset.setAttribute('aria-label', 'Reset the crop, the angle, the perspective and the lens');
  // the keystone: two numbers (vertical, horizontal) pull the four corners, top left, top right, bottom right, bottom left
  const pull = (v: number, hz: number): [number, number][] => [[v / 400, hz / 400], [-v / 400, -hz / 400], [v / 400, hz / 400], [-v / 400, -hz / 400]];
  const vert = () => ed.r.persp[0]![0] * 400;
  const horz = () => ed.r.persp[0]![1] * 400;
  const keystone = (id: string, label: string, get: () => number, set: (r: Recipe, v: number) => void) =>
    slider({ id, label, min: -100, max: 100, step: 1, rest: 0, value: get(), say: plain, live: (v) => ed.live((r) => set(r, v)), keep: (_v, l) => ed.keep(l) }).el;
  return h('div.petrayin',
    h('p.g-truth.peintro', 'DRAG THE CORNERS OF THE FRAME ON THE PHOTO, OR PICK A SHAPE'),
    ratioRow,
    angle.el,
    h('div.perow.pekeys', turn, flip, reset),
    keystone('vertical', 'Vertical', vert, (r, v) => (r.persp = pull(v, r.persp[0]![1] * 400))),
    keystone('horizontal', 'Horizontal', horz, (r, v) => (r.persp = pull(r.persp[0]![0] * 400, v))),
    numberSlider(ed, { id: 'lens', label: 'Lens', min: -100, max: 100, step: 1, rest: 0, get: (r) => r.lens, set: (r, v) => (r.lens = v), say: (v) => (v === 0 ? '0' : v > 0 ? `${Math.round(v)} barrel` : `${Math.round(-v)} pincushion`) }),
  );
}

// ---------------------------------------------------------------- EFFECTS
function effects(ed: Ed): HTMLElement {
  const E = (id: string, label: string, key: 'vignette' | 'grain' | 'grainSize' | 'fade', min: number, max: number, rest: number, scale: number, say: (v: number) => string) =>
    numberSlider(ed, { id, label, min, max, step: 1, rest, get: (r) => r.effects[key] * scale, set: (r, v) => (r.effects[key] = v / scale), say });
  return h('div.petrayin',
    E('vignette', 'Vignette', 'vignette', -100, 100, 0, 100, (v) => (v === 0 ? '0' : v > 0 ? `${Math.round(v)} dark` : `${Math.round(-v)} light`)),
    E('grain', 'Grain', 'grain', 0, 100, 0, 100, (v) => `amount ${Math.round(v)}`),
    numberSlider(ed, { id: 'grainSize', label: 'Grain size', min: 1, max: 100, step: 1, rest: 30, get: (r) => r.effects.grainSize, set: (r, v) => (r.effects.grainSize = v), say: (v) => `size ${Math.round(v)}` }),
    E('fade', 'Fade', 'fade', 0, 100, 0, 100, (v) => `${Math.round(v)}`),
    h('div.perow', button('NEW GRAIN', () => {
      ed.live((r) => (r.effects.seed = (r.effects.seed % 99991) + 7));
      ed.keep('New grain');
    }), h('span.g-truth', 'THE SAME GRAIN ON THE SCREEN AND IN THE FILE')),
  );
}

// ---------------------------------------------------------------- MASKS (and the layer's own)
let adding = false;
function masks(ed: Ed, forLayer: boolean): HTMLElement {
  const list = forLayer ? [] : ed.r.masks;
  const m = forLayer ? ed.r.layer?.mask ?? null : ed.r.masks.find((x) => x.id === ed.sel.mask) ?? null;
  if (!forLayer && !m && list.length) ed.sel.mask = list[0]!.id;
  const rows = h('div.pemasks', { role: 'list', 'aria-label': 'Masks' });
  if (!forLayer) {
    list.forEach((x) => {
      const b = button(h('span', h('b', x.name), h('em', x.kind === 'linear' ? 'gradient' : x.kind === 'radial' ? 'circle' : x.kind)), () => {
        ed.sel.mask = x.id;
        ed.sel.brush = x.kind === 'brush' || x.kind === 'subject';
        ed.refreshTray();
        ed.overlay();
      }, 'pemask');
      b.classList.toggle('on', x.id === m?.id);
      b.setAttribute('role', 'listitem');
      rows.append(b);
    });
  }
  const addMask = (kind: MaskKind) => {
    if (ed.r.masks.length >= MAX_MASKS) return void ed.say(`Four masks is the most I keep on one photo. Take one away first.`);
    const nm = newMask(kind, ed.r.masks.length + 1);
    nm.adj = { ...nm.adj, exposure: kind === 'linear' ? -30 : 0 };
    ed.live((r) => {
      r.masks.push(placed(ed, nm));
    });
    ed.sel.mask = nm.id;
    ed.sel.brush = kind === 'brush' || kind === 'subject';
    ed.keep(`${nm.name} added`);
    ed.refreshTray();
    ed.overlay();
    if (kind === 'subject') void subject(ed, nm);
  };
  const addRow = h('div.perow.pekeys', { role: 'group', 'aria-label': 'Add a mask' },
    button('GRADIENT', () => addMask('linear')),
    button('CIRCLE', () => addMask('radial')),
    button('BRUSH', () => addMask('brush')),
    button('SUBJECT', () => addMask('subject')));
  if (!m) {
    return h('div.petrayin',
      h('p.pnote.pemaskintro', forLayer ? 'The layer shows through the whole photo. Give it a mask to show it in part.' : 'A mask changes only part of the photo. Pick the shape.'),
      forLayer ? null : addRow,
      forLayer ? null : h('p.g-truth.pesubject', `SUBJECT: ${SUBJECT_LINE.toUpperCase()}`),
    );
  }
  const sub = m.kind === 'subject';
  const G = (id: string, label: string, key: keyof Mask['adj'], say: (v: number) => string) =>
    numberSlider(ed, { id: `m-${id}`, label, min: -100, max: 100, step: 1, rest: 0, get: () => m.adj[key], set: (_r, v) => (m.adj[key] = v), say });
  const invert = button('INVERT', () => {
    ed.live(() => (m.invert = !m.invert));
    ed.keep(m.invert ? 'Mask inverted' : 'Mask turned back');
    ed.refreshTray();
    ed.overlay();
  });
  invert.classList.toggle('on', m.invert);
  invert.setAttribute('aria-pressed', String(m.invert));
  const show = button('SHOW THE MASK', () => {
    ed.sel.showMask = !ed.sel.showMask;
    peState.showMask = ed.sel.showMask;
    ed.refreshTray();
    ed.overlay();
  });
  show.classList.toggle('on', ed.sel.showMask);
  show.setAttribute('aria-pressed', String(ed.sel.showMask));
  const del = button(forLayer ? 'TAKE THE MASK OFF' : 'DELETE THE MASK', () => {
    if (forLayer) ed.live((r) => r.layer && (r.layer.mask = null));
    else ed.live((r) => (r.masks = r.masks.filter((x) => x.id !== m.id)));
    if (!forLayer) ed.sel.mask = ed.r.masks[0]?.id ?? '';
    ed.sel.brush = false;
    ed.sel.showMask = false;
    ed.keep('Mask taken away');
    ed.refreshTray();
    ed.overlay();
  });
  const brushOn = button(ed.sel.brush ? 'PAINTING' : 'PAINT', () => {
    ed.sel.brush = !ed.sel.brush;
    ed.refreshTray();
    ed.overlay();
  });
  brushOn.classList.toggle('on', ed.sel.brush);
  brushOn.setAttribute('aria-pressed', String(ed.sel.brush));
  const brushKind = m.kind === 'brush' || sub;
  const painter = brushKind
    ? h('div.petrayin.pebrush',
        h('div.perow.pekeys', brushOn, button('ADD', () => ((ed.sel.erase = false), (ed.sel.brush = true), ed.refreshTray()), ed.sel.erase ? '' : 'on'), button('ERASE', () => ((ed.sel.erase = true), (ed.sel.brush = true), ed.refreshTray()), ed.sel.erase ? 'on' : ''), button('CLEAR', () => {
          ed.live(() => (m.alpha = putAlpha({ w: 2, h: 2, data: new Uint8Array(4) })));
          ed.keep('Brush cleared');
          ed.overlay();
        })),
        slider({ id: 'brushsize', label: 'Brush size', min: 0.005, max: 0.15, step: 0.005, rest: 0.04, value: ed.sel.size, say: (v) => `size ${Math.round(v * 200)}`, live: (v) => (ed.sel.size = v), keep: () => undefined }).el,
        h('p.g-truth', ed.sel.brush ? 'DRAW ON THE PHOTO. HOLD TO SEE THE ORIGINAL' : 'TAP PAINT, THEN DRAW ON THE PHOTO'))
    : null;
  const cutLine = m.cut === 'model' ? CUT_FROM_MODEL : m.cut === 'depth' ? CUT_FROM_DEPTH : SUBJECT_LINE;
  const offerSlot = sub ? h('div.pecutoffer') : null;
  const subjectBox = sub
    ? h('div.pesubjectbox',
        h('p.g-truth.pesubject', { dataset: { cut: m.cut ?? 'none' } }, cutLine.toUpperCase()),
        h('p.pnote.pesubjectline', { id: 'pe-subject-line' }),
        h('div.perow.pekeys', button('MAKE THE CUT', () => void subject(ed, m), 'on'), m.cut === 'model' ? button('REFINE WITH DEPTH', () => void refine(ed, m)) : null),
        offerSlot)
    : null;
  if (sub) {
    void subjectState().then((s) => ((document.getElementById('pe-subject-line') as HTMLElement | null)?.replaceChildren(s.words)));
    // the cut-out model, not kept: the size and GET (the first cut stays until it is here)
    void packHere('cutout').then((here) => {
      if (!here) offerSlot?.append(packOffer('cutout', () => ed.refreshTray(), 'Until then the first cut stays, and the brush fixes either.'));
    });
  }
  const feather = m.kind === 'radial' ? numberSlider(ed, { id: 'm-feather', label: 'Soft edge', min: 2, max: 100, step: 1, rest: 60, get: () => Math.round(m.feather * 100), set: (_r, v) => (m.feather = v / 100), say: (v) => `${Math.round(v)}` }) : null;
  return h('div.petrayin',
    forLayer ? null : rows,
    forLayer ? null : addRow,
    h('div.perow.pekeys', invert, show, del),
    subjectBox,
    painter,
    feather,
    forLayer ? null : G('exposure', 'Exposure', 'exposure', (v) => `${signed(v / 50, 1)} stops`),
    forLayer ? null : G('contrast', 'Contrast', 'contrast', plain),
    forLayer ? null : G('highlights', 'Highlights', 'highlights', plain),
    forLayer ? null : G('shadows', 'Shadows', 'shadows', plain),
    forLayer ? null : G('temp', 'Temperature', 'temp', (v) => `${signed(v * 30)} K`),
    forLayer ? null : G('tint', 'Tint', 'tint', plain),
    forLayer ? null : G('saturation', 'Colour', 'saturation', plain),
    forLayer ? null : G('vibrance', 'Vibrance', 'vibrance', plain),
  );
}

/** A new mask placed where he sees: a gradient from the top of the picture on screen, a circle in its middle. */
function placed(ed: Ed, m: Mask): Mask {
  if (m.kind === 'linear') {
    m.a = ed.screenToSrc(0.5, 0.06);
    m.b = ed.screenToSrc(0.5, 0.5);
  } else if (m.kind === 'radial') {
    m.c = ed.screenToSrc(0.5, 0.5);
  }
  return m;
}

let saidCutoutOffer = false;
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

let cutting = false;
async function subject(ed: Ed, m: Mask): Promise<void> {
  // one cut at a time: a second tap while the first runs is the same wish
  if (cutting) return;
  cutting = true;
  try {
    await subjectNow(ed, m);
  } finally {
    cutting = false;
  }
}

async function subjectNow(ed: Ed, m: Mask): Promise<void> {
  const line = (): HTMLElement | null => document.getElementById('pe-subject-line');
  const tell = (w: string): void => {
    ed.say(w);
    const l = line();
    if (l) l.textContent = w;
  };
  const orig = ed.orig;
  if (!orig) return;
  const [here, st] = await Promise.all([packHere('cutout'), subjectState()]);
  let why = '';
  if (here) {
    try {
      const { cutWithModel } = await import('../../photo/matting');
      const { alpha, ms } = await cutWithModel(orig, (w) => tell(cap(w)));
      ed.live(() => {
        m.alpha = putAlpha(alpha);
        m.cut = 'model';
      });
      ed.keep('Subject cut');
      ed.sel.brush = false;
      ed.sel.showMask = true;
      peState.cutFrom = 'model';
      peState.cutMs = Math.round(ms);
      ed.refreshTray();
      ed.overlay();
      ed.say(`${CUT_FROM_MODEL} It took ${(ms / 1000).toFixed(1)} s.`);
      return;
    } catch (e) {
      // never a silent fallback: its line, and the first cut that is used instead
      why = sayError(e, 'run the cut-out model');
      peState.cutFail = why;
    }
  } else if (!saidCutoutOffer) {
    saidCutoutOffer = true;
    ed.say(OFFER.cutout(packSize('cutout')));
  }
  if (!st.ready) {
    const l = line();
    const lead = why ? `${why} ` : '';
    if (l) l.textContent = `${lead}${st.words}`;
    ed.say(`${lead}The first cut needs two things kept on this phone; paint it by hand until then.`);
    return;
  }
  try {
    const { alpha, box } = await cutSubject(orig, (w) => tell(w));
    ed.live(() => {
      m.alpha = putAlpha(alpha);
      m.cut = 'depth';
    });
    ed.keep('Subject cut');
    ed.sel.brush = false;
    ed.sel.showMask = true;
    peState.cutFrom = 'depth';
    ed.refreshTray();
    ed.overlay();
    const lead = why ? `The cut-out model would not run (${why}), so I used the first cut. ` : '';
    ed.say(`${lead}${CUT_FROM_DEPTH}${box ? '' : ' I found no one thing, so I took the middle.'}`);
  } catch (e) {
    ed.say(`${sayError(e, 'make the cut')} Paint it by hand with the brush.`);
  }
}

/** The cut-out model's mask, kept where it is as near as the subject (MEASURE'S DISTANCE). */
async function refine(ed: Ed, m: Mask): Promise<void> {
  const l = document.getElementById('pe-subject-line');
  const orig = ed.orig;
  const a = m.alpha ? getAlpha(m.alpha) : null;
  if (!orig || !a) return;
  const st = await depthState();
  if (!st.ready) {
    if (l) l.textContent = st.words;
    ed.say(st.words);
    return;
  }
  try {
    const out = await refineWithDepth(orig, a, (w) => {
      ed.say(w);
      if (l) l.textContent = w;
    });
    ed.live(() => {
      m.alpha = putAlpha(out);
    });
    ed.keep('Cut refined with depth');
    ed.sel.showMask = true;
    ed.refreshTray();
    ed.overlay();
    ed.say('Refined with how far things are: what lies clearly behind the subject is out of the cut. Paint to fix it.');
  } catch (e) {
    ed.say(`${sayError(e, 'refine it with depth')} The cut stays as it was.`);
  }
}

// ---------------------------------------------------------------- HEAL
function heal(ed: Ed): HTMLElement {
  const hl = ed.r.heals[ed.sel.healSel] ?? null;
  const size = slider({
    id: 'healsize',
    label: 'Size',
    min: 0.004,
    max: 0.08,
    step: 0.002,
    rest: 0.02,
    value: hl ? hl.r : ed.sel.healSize,
    say: (v) => `size ${Math.round(v * 1000)}`,
    live: (v) => {
      ed.sel.healSize = v;
      if (hl) ed.live(() => (hl.r = v));
      else ed.overlay();
    },
    keep: (_v, label) => (hl ? ed.keep(label) : undefined),
  });
  const n = ed.r.heals.length;
  return h('div.petrayin',
    h('p.pnote.pehealline', n ? `${n} spot${n === 1 ? '' : 's'} healed. Tap another, or drag the dashed circle to change where the clean part comes from.` : 'Tap a blemish. I take the clean part from beside it; drag the dashed circle to change where.'),
    size.el,
    h('div.perow.pekeys',
      button('DELETE THIS HEAL', () => {
        if (!hl) return;
        ed.live((r) => r.heals.splice(ed.sel.healSel, 1));
        ed.sel.healSel = ed.r.heals.length - 1;
        ed.keep('Heal taken away');
        ed.refreshTray();
      }),
      button('CLEAR ALL', () => {
        if (!n) return;
        ed.live((r) => (r.heals = []));
        ed.sel.healSel = -1;
        ed.keep('Heals cleared');
        ed.refreshTray();
      })),
    h('p.g-truth', 'THE APP’S OWN CLONE HEAL, FEATHERED. NO MODEL, NOTHING SENT'),
  );
}

// ---------------------------------------------------------------- ERASE
/** The brain's ERASE (the PHOTO TOOLS, as before), kept in this tray as BRAIN ERASE: the fallback with no erase model. */
function brainErase(ed: Ed, line: HTMLElement): HTMLButtonElement {
  const off = ui.get().connected === false;
  const b = button(h('span', h('b', 'BRAIN ERASE'), h('em', off ? 'needs the brain' : 'by your brain')), () => {
    if (ui.get().connected === false) return void (line.textContent = 'BRAIN ERASE NEEDS THE BRAIN; ERASE ON THIS PHONE DOES NOT');
    void (async () => {
      line.textContent = 'GETTING THE PHOTO READY…';
      const still = await ed.snapshot(1024);
      const { openPhotoTools } = await import('../lens/photo');
      openPhotoTools({ still, job: 'erase' });
      peState.erasedBy = 'brain';
      line.textContent = 'ERASE BY YOUR BRAIN: THE PHOTO TOOLS ARE OPEN. THE PHOTO GOES TO THE BRAIN ONLY WHEN YOU PRESS THEIR BUTTON';
    })();
  }, 'pebrain');
  b.dataset.job = 'erase';
  b.dataset.act = 'brain-erase';
  b.disabled = off;
  return b;
}

function erase(ed: Ed): HTMLElement {
  const root = h('div.petrayin', h('p.g-truth.peeraseline', { role: 'status' }, 'CHECKING THIS PHONE…'));
  const line = (): HTMLElement => root.querySelector<HTMLElement>('.peeraseline')!;
  void packHere('erase').then((here) => {
    const status = h('p.g-truth.peeraseline', { role: 'status', 'aria-live': 'polite' }, peState.erasedBy === 'phone' ? `ERASED ON THIS PHONE${peState.eraseMs ? ` IN ${(peState.eraseMs / 1000).toFixed(1)} S` : ''}. UNDO TAKES IT BACK` : peState.erasedBy === 'brain' ? 'ERASE BY YOUR BRAIN: THE PHOTO TOOLS ARE OPEN' : here ? 'PAINT OVER WHAT TO TAKE AWAY, THEN ERASE. I FILL IT ON THIS PHONE: THE PHOTO NEVER LEAVES IT' : OFFER.erase(packSize('erase')).toUpperCase());
    root.replaceChildren();
    if (!here) {
      root.append(status, packOffer('erase', () => ed.refreshTray(), 'Until then BRAIN ERASE does it by your brain (the photo goes to it only when you press its button).'), brainErase(ed, status));
      if (!erasedOffered) {
        erasedOffered = true;
        ed.say(OFFER.erase(packSize('erase')));
      }
      return;
    }
    const has = ed.holeCoverage() > 0;
    const subjectMask = ed.r.masks.find((m) => m.kind === 'subject' && m.alpha);
    const go = button(ed.erasing() ? 'ERASING…' : 'ERASE', () => void ed.erase(), 'on');
    go.dataset.act = 'erase';
    go.disabled = !has || ed.erasing();
    const use = button('USE THE SUBJECT MASK', () => {
      if (subjectMask) ed.useSubjectAsHole(subjectMask);
    });
    use.dataset.act = 'use-subject';
    use.disabled = !subjectMask || ed.erasing();
    root.append(
      status,
      h('div.perow.pekeys', { role: 'group', 'aria-label': 'The brush' },
        button('ADD', () => ((ed.sel.erase = false), (ed.sel.brush = true), ed.refreshTray()), ed.sel.erase ? '' : 'on'),
        button('RUB OUT', () => ((ed.sel.erase = true), (ed.sel.brush = true), ed.refreshTray()), ed.sel.erase ? 'on' : ''),
        button('CLEAR', () => ed.clearHole())),
      slider({ id: 'erasesize', label: 'Brush size', min: 0.005, max: 0.15, step: 0.005, rest: 0.04, value: ed.sel.size, say: (v) => `size ${Math.round(v * 200)}`, live: (v) => (ed.sel.size = v), keep: () => undefined }).el,
      h('div.perow.pekeys', use, go),
      h('p.pnote', has ? 'Painted. A big hole is filled in parts, one after another.' : 'Draw on the photo over a mark, a wire, a bin. Or use what SUBJECT cut out.'),
      brainErase(ed, line()),
    );
  });
  return root;
}
let erasedOffered = false;

// ---------------------------------------------------------------- LAYER
function layer(ed: Ed): HTMLElement {
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Pick a second photo for the layer' }) as HTMLInputElement;
  const pick = button(ed.r.layer ? 'CHANGE THE PHOTO' : 'PICK A SECOND PHOTO', () => input.click(), ed.r.layer ? '' : 'on');
  const status = h('p.g-truth.pelayerline', { 'aria-live': 'polite' });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    status.textContent = 'OPENING THE SECOND PHOTO…';
    try {
      const opened = await openPhoto(f, f.name);
      const lid = await keepLayer(ed.photoId(), f);
      const prev = ed.r.layer?.photo;
      ed.setLayer(opened.canvas);
      ed.live((r) => (r.layer = { photo: lid, name: f.name, blend: r.layer?.blend ?? 'normal', opacity: r.layer?.opacity ?? 60, mask: r.layer?.mask ?? null }));
      ed.keep('Layer added');
      if (prev && prev !== lid) void removeLayer(prev);
      ed.refreshTray();
    } catch (e) {
      status.textContent = sayError(e, 'do that').toUpperCase();
    }
  });
  const l = ed.r.layer;
  if (!l) return h('div.petrayin', h('p.pnote', 'A second photo laid over this one: multiply it to darken, screen to lighten, overlay or soft light to blend. Then its opacity, and a mask to show it in part.'), h('div.perow', pick, input), status);
  const maskRow = chips('The layer’s mask', [['none', 'NONE'], ['linear', 'GRADIENT'], ['radial', 'CIRCLE'], ['brush', 'BRUSH']], () => (ed.r.layer?.mask ? ed.r.layer.mask.kind : 'none'), (k) => {
    ed.live((r) => {
      if (!r.layer) return;
      r.layer.mask = k === 'none' ? null : placed(ed, newMask(k as MaskKind, 1));
    });
    ed.sel.brush = k === 'brush';
    ed.keep(k === 'none' ? 'Layer mask off' : 'Layer mask on');
    ed.refreshTray();
    ed.overlay();
  });
  return h('div.petrayin',
    h('p.pnote.pelayername', `Layer: ${l.name}`),
    chips('How it blends', BLENDS.map((b) => [b, b === 'softlight' ? 'SOFT LIGHT' : b.toUpperCase()] as [string, string]), () => ed.r.layer?.blend ?? 'normal', (b) => {
      ed.live((r) => r.layer && (r.layer.blend = b as typeof l.blend));
      ed.keep(`Layer: ${b}`);
    }),
    numberSlider(ed, { id: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, rest: 100, get: (r) => r.layer?.opacity ?? 0, set: (r, v) => r.layer && (r.layer.opacity = v), say: (v) => `${Math.round(v)} %` }),
    maskRow,
    ed.r.layer?.mask ? masks(ed, true) : null,
    h('div.perow.pekeys', pick, input, button('REMOVE THE LAYER', () => {
      const id = ed.r.layer?.photo;
      ed.live((r) => (r.layer = null));
      ed.setLayer(null);
      ed.sel.brush = false;
      ed.keep('Layer removed');
      if (id) void removeLayer(id);
      ed.refreshTray();
    })),
    status,
  );
}

// ---------------------------------------------------------------- BRAIN
function brain(ed: Ed): HTMLElement {
  const off = ui.get().connected === false;
  const line = h('p.g-truth.pebrainline', { role: 'status' }, off ? 'NEEDS THE BRAIN; EVERYTHING ELSE HERE WORKS WITHOUT IT' : 'THESE THREE SEND THE PHOTO TO THE BRAIN, AND ON TO A FREE SPACE AT HUGGING FACE. THE REST NEVER LEAVES THE PHONE');
  const key = (job: string, label: string, what: string) => {
    const b = button(h('span', h('b', label), h('em', what)), () => {
      if (ui.get().connected === false) return void (line.textContent = 'NEEDS THE BRAIN; EVERYTHING ELSE HERE WORKS WITHOUT IT');
      void (async () => {
        line.textContent = 'GETTING THE PHOTO READY…';
        const still = await ed.snapshot(1024);
        const { openPhotoTools } = await import('../lens/photo');
        openPhotoTools({ still, job });
        line.textContent = 'THE PHOTO TOOLS ARE OPEN. THE PHOTO GOES TO THE BRAIN ONLY WHEN YOU PRESS THEIR BUTTON';
      })();
    }, 'pebrain');
    b.dataset.job = job;
    b.disabled = off;
    return b;
  };
  // the cut-out model, not kept: its size and GET (PHOTO TOOLS sends him here when the free online tools cannot take the background out)
  const offerSlot = h('div.pecutoffer');
  void packHere('cutout').then((here) => {
    if (!here) offerSlot.append(packOffer('cutout', () => ed.refreshTray(), 'With it kept here, PHOTO TOOLS can take the background out on this phone when the free online tools are asleep: nothing leaves it.'));
  });
  return h('div.petrayin',
    h('div.pebrainkeys', key('background', 'BACKGROUND', 'takes it out'), key('sharper', 'SHARPER', 'twice the size'), key('erase', 'ERASE', 'draw over a thing')),
    line,
    off ? h('p.pnote', 'No signal to the brain right now. These three wait; LIGHT, COLOUR, CURVES, CROP, MASKS, HEAL and the rest work as they are.') : h('p.pnote', 'Each one says who does it and asks for your tap before anything is sent. A face is never looked for and never changed.'),
    offerSlot,
  );
}

