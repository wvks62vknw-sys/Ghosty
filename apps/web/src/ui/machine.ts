/**
 * THE MACHINE'S MARKS (BRIEF-DESIGN-SYSTEM 2; his reference, OWNER-ISSUES 137; his words in 139: "we're missing couple crucial
 * 'the machine' feeling benchmarks"). The calm, certain eye of a machine that sees his world — his places, feeds, devices,
 * never a person — drawn the way Ghosty's Machine view already draws a thing (features/eye/machine.ts: thin boxes, square
 * corners, one true line each), grown into components every screen uses:
 *
 *   stampLine()   its point of view at the top of a screen: date · time · place · what it watches · what it looks at
 *   reticle()     one hairline box with corner marks round a thing; a full box in the accent when it attends to it
 *   tag()         mono capitals above a thing: what it is, and its count
 *   truthLine()   one mono line below a thing: what it knows now
 *   plate()       what a tag, a key or a page sits on, one step up from the canvas
 *   key()         a square button, 44 pt or more, its word in capitals
 *   lineOfSight() a thin line from the eye to the attended thing, drawn as it turns
 *   typedLine()   text that arrives as the brain writes it, with a block cursor
 *   recognise()   the moment of recognition: the box snaps onto a thing with one short tone (his sound setting honoured)
 *   search()      ADDED (the reference's own hallmark the list lacked): before the lock, the box checks each candidate in
 *                 turn and says which, then recognises the one it found
 *   index()       ADDED (W1's inventory, 01 · 02 · 03): a thing's number in the Machine's list, so a list can be read and
 *                 said by number ("open three")
 *   eyeGlyph()    the orb drawn small, as the line of sight's origin where the real eye is not on screen
 *
 * Every colour, size and duration comes from the design system's tokens (src/design/tokens.css), through the `.g-*` rules in
 * styles.css's own section ("THE SYSTEM"); nothing here names a colour. Every control has a name for VoiceOver and is 44 pt or
 * more. Reduce Motion: nothing travels — the box appears where it lands, the line is there at once, the typed-out line shows
 * whole; the tone (a sound, not a motion) still plays once if his sounds are on.
 */
import { h, icon, svgEl } from '../core/dom';
import { sfx, sfxAllowed } from '../assistant/sfx';

/** Nothing travels: Reduce Motion (it always wins), or MOTION set to calm (BRIEF-THEMES-2: state/theme.ts writes data-motion). */
const still = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'calm');
/** A token's duration in ms (0 with Reduce Motion: tokens.css sets the durations to nothing). */
export function dur(name: 'lock' | 'turn' | 'bring'): number {
  if (still()) return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--g-dur-${name}`).trim();
  const ms = parseFloat(v);
  return Number.isFinite(ms) ? (v.endsWith('ms') ? ms : ms * 1000) : { lock: 160, turn: 420, bring: 900 }[name];
}
/** A token's curve, for the Web Animations the marks run. */
const ease = (name: 'lock' | 'bring') => getComputedStyle(document.documentElement).getPropertyValue(`--g-ease-${name}`).trim() || 'ease-out';

/** What the marks have done, for the checks (window.__ghosty.marks). */
export const marksState = { locks: 0, lastLock: '', typed: 0, sights: 0, searches: 0, lastSound: '' as '' | 'tone' | 'click' | 'off' };

// ---------------------------------------------------------------- the words of each mark, and when it is used

export interface MarkDef {
  id: string;
  name: string;
  /** When it is used, in one or two sentences, in Ghosty's voice. */
  rule: string;
}

/** Each mark with its rule: THE LOOK shows them so, and every screen built in the system follows them. */
export const MARKS: MarkDef[] = [
  { id: 'stamp', name: 'The stamp line', rule: 'At the top of a screen: the day, the time, where I am, what I’m watching and what I’m looking at. Always true, never decoration.' },
  { id: 'reticle', name: 'The reticle', rule: 'Round a thing I can see: four corners while I watch it, a full box in your colour when I attend to it, amber when it needs a look. Never colour alone.' },
  { id: 'tag', name: 'The tag', rule: 'Above a thing: what it is, in capitals, with its count. One or two words.' },
  { id: 'truth', name: 'The truth line', rule: 'Below a thing: one line of what I know now. Nothing I’d have to guess.' },
  { id: 'plate', name: 'The plate', rule: 'Under every word that sits over the room, so it reads on anything. One step lighter than the room.' },
  { id: 'key', name: 'The key', rule: 'Every action: square, at least 44 points, its word in capitals. One filled key on a screen at most.' },
  { id: 'sight', name: 'The line of sight', rule: 'From my eye to the one thing I’m attending to, drawn as I turn to it. One at a time.' },
  { id: 'typed', name: 'The typed-out line', rule: 'My narration and my status as I write them, with a block cursor while I’m still writing. It goes when I finish.' },
  { id: 'recognise', name: 'The moment of recognition', rule: 'When I find what you asked for, the box snaps onto it with one short tone. Once for each thing.' },
  { id: 'search', name: 'The search', rule: 'While I look, the box checks each place in turn and says which; then it locks on the one I found.' },
  { id: 'index', name: 'The index', rule: 'Every thing in one of my lists has its number, 01, 02, 03, so you can find it again and say it: “open three”.' },
];

/** A thing's number in a list, two digits ("03"); `on` when it is the attended one. VoiceOver hears "number 3". */
export function index(n: number, o: { on?: boolean } = {}): HTMLElement {
  return h(`span.g-index${o.on ? '.on' : ''}` as 'span', { dataset: { g: 'index', case: 'keep' }, 'aria-label': `number ${n}` }, String(n).padStart(2, '0'));
}

// ---------------------------------------------------------------- the small marks

/** Mono capitals above a thing ("LIBRARY · 4"). Tone: on (the accent: attended), warn (amber), off (switched off). */
export function tag(text: string, o: { count?: string | number; tone?: 'on' | 'warn' | 'off'; glyph?: string } = {}): HTMLElement {
  return h(`span.g-tag${o.tone ? `.${o.tone}` : ''}` as 'span', { dataset: { g: 'tag', case: 'keep' } },
    o.glyph ? icon(o.glyph, 'g-glyph') : null,
    h('span', text),
    o.count != null && o.count !== '' ? h('span.g-count', `· ${o.count}`) : null);
}

/** A segment of a truth line: plain, `strong` (ink 2) or `on` (the accent: live). */
export type TruthPart = string | { text: string; tone: 'strong' | 'on' | 'warn' };

/**
 * The segments of a truth line or a stamp line: each one kept whole where it fits (it moves to the next line rather than
 * breaking inside), its separator at its end, so a wrapped line ends on the dot and never starts with one.
 */
function segments(el: HTMLElement, list: { text: string; tone?: string }[]): void {
  list.forEach((p, i) => {
    const seg = h(`span.g-seg${p.tone ? `.${p.tone}` : ''}` as 'span', p.text);
    if (i < list.length - 1) seg.append(h('span.g-sep', { 'aria-hidden': 'true' }, '\u00a0·'));
    el.append(seg, i < list.length - 1 ? ' ' : '');
  });
}

/** One mono line below a thing: what is known now ("PAGE 42 OF 112 · YESTERDAY"). */
export function truthLine(parts: TruthPart | TruthPart[]): HTMLElement {
  const list = Array.isArray(parts) ? parts : [parts];
  const el = h('p.g-truth', { dataset: { g: 'truth', case: 'keep' } });
  segments(el, list.map((p) => (typeof p === 'string' ? { text: p } : p)));
  return el;
}

/** What a tag, a key or a page sits on: one step up from the canvas (`strong`: two, for a page brought to the front). */
export function plate(o: { strong?: boolean; label?: string } = {}, ...kids: (Node | string | null)[]): HTMLElement {
  return h(`div.g-plate${o.strong ? '.strong' : ''}` as 'div', { dataset: { g: 'plate' }, ...(o.label ? { role: 'group', 'aria-label': o.label } : {}) }, ...kids);
}

/** A square button, 44 pt or more, its word in capitals. `fill`: the one primary key (bone); `ghost`: no plate behind it. */
export function key(word: string, onPress: (b: HTMLButtonElement) => void, o: { kind?: 'line' | 'fill' | 'ghost'; label?: string; glyph?: string } = {}): HTMLButtonElement {
  const b = h(`button.g-key${o.kind && o.kind !== 'line' ? `.${o.kind}` : ''}` as 'button',
    { type: 'button', dataset: { g: 'key', case: 'keep' }, 'aria-label': o.label ?? word },
    o.glyph ? icon(o.glyph, 'g-glyph') : null,
    word ? h('span', word) : null);
  b.addEventListener('click', () => onPress(b));
  return b;
}

// ---------------------------------------------------------------- the reticle

export type ReticleState = 'watch' | 'attend' | 'warn';

export interface Reticle {
  el: HTMLElement;
  state(): ReticleState;
  set(s: ReticleState): void;
}

/**
 * A hairline box with corner marks round a thing: four corners while it watches (line), a full box in the accent when it
 * attends (and the words say so: never colour alone), a full amber box when it needs a look. `tag` sits above it and `truth`
 * below. With `onTap` it is a button (44 pt at least) that VoiceOver names with its state.
 */
export function reticle(o: { name: string; tag?: HTMLElement; truth?: HTMLElement; body?: Node; state?: ReticleState; onTap?: (r: Reticle) => void }): Reticle {
  const said: Record<ReticleState, string> = { watch: 'watching', attend: 'attending', warn: 'needs a look' };
  const el = o.onTap
    ? h('button.g-ret', { type: 'button', dataset: { g: 'reticle', case: 'keep' } })
    : h('div.g-ret', { dataset: { g: 'reticle' }, role: 'img' });
  // the tag above the box, the thing inside it, the truth line below (the box's frame is drawn round the thing only)
  if (o.tag) el.append(h('span.g-ret-tag', o.tag));
  el.append(h('span.g-ret-box', h('span.g-ret-frame', { 'aria-hidden': 'true' }), o.body ? h('span.g-ret-body', o.body) : null));
  if (o.truth) el.append(h('span.g-ret-truth', o.truth));
  let st: ReticleState = o.state ?? 'watch';
  const r: Reticle = {
    el,
    state: () => st,
    set(s) {
      st = s;
      el.dataset.state = s;
      el.setAttribute('aria-label', `${o.name}: ${said[s]}`);
      if (o.onTap) el.setAttribute('aria-pressed', String(s === 'attend'));
    },
  };
  r.set(st);
  if (o.onTap) el.addEventListener('click', () => o.onTap!(r));
  return r;
}

// ---------------------------------------------------------------- the stamp line

export interface StampFacts {
  /** His saved home, or the last place ("Birmingham"). */
  place: string;
  /** How many of his feeds it is watching now; null while it is still finding out. */
  watching: number | null;
  /** The thing in focus ("the look", "Library"). */
  looking: string;
  /** No signal: the feeds cannot be read, and the line says so. */
  offline?: boolean;
}

/** "Fri 6 Nov · 21:08 · Birmingham · Watching 3 feeds · Looking at the look" (shown in mono capitals). */
export function stampWords(f: StampFacts, now = new Date()): string[] {
  const day = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const w = f.offline ? 'Offline, feeds paused' : f.watching == null ? 'Checking feeds' : f.watching === 0 ? 'No feeds yet' : `Watching ${f.watching} ${f.watching === 1 ? 'feed' : 'feeds'}`;
  return [day, time, f.place || 'Here', w, `Looking at ${f.looking}`];
}

/**
 * The Machine's point of view at the top of a screen, from real state (`facts()`: the clock, his home, the feeds watched, the
 * thing in focus). It keeps time on the minute while it is on the page; `look(thing)` says what it is looking at now.
 */
export function stampLine(facts: () => StampFacts): { el: HTMLElement; refresh(): void; look(thing: string): void } {
  const el = h('p.g-stamp', { dataset: { g: 'stamp', case: 'keep' } });
  let focus = '';
  let timer = 0;
  const paint = () => {
    const f = facts();
    const words = stampWords(focus ? { ...f, looking: focus } : f);
    el.replaceChildren();
    // (what it is looking at, last, in the accent: the thing in focus)
    segments(el, words.map((w, i) => ({ text: w, tone: i === words.length - 1 ? 'on' : undefined })));
    el.setAttribute('aria-label', words.join(', '));
  };
  const tick = () => {
    clearTimeout(timer);
    if (!el.isConnected && timer) return;
    paint();
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  };
  tick();
  return {
    el,
    refresh: paint,
    look(thing) {
      focus = thing;
      paint();
    },
  };
}

// ---------------------------------------------------------------- the eye, drawn small

/**
 * The orb drawn flat (the line of sight's origin where the real eye is not on screen, a swatch's mark, and the eye itself on a
 * browser with no 3-D): its edge, rings of points, the core. Drawn for its size: small, three rings of points; large, seven
 * finer ones, so it reads as a sphere of points at 240 px as it does at 30; the edge stays one hairline at any size.
 */
export function eyeGlyph(size = 40): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 40 40', width: size, height: size, class: 'g-eye', 'aria-hidden': 'true' });
  const unit = size / 40;
  const big = size >= 120;
  s.append(svgEl('circle', { cx: 20, cy: 20, r: 18.5, class: 'g-eye-edge', 'vector-effect': 'non-scaling-stroke' }));
  const radii = big ? [17, 15, 13, 11, 9, 7, 5] : [15, 10.5, 6];
  const step = big ? 1.9 : 4.3;
  // a point about 1.4 px across its radius when large; the small glyph's own 0.75 units below that
  const dot = Math.min(0.75, 1.4 / unit);
  radii.forEach((r, ring) => {
    const n = Math.max(6, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.4;
      s.append(svgEl('circle', { cx: (20 + Math.cos(a) * r).toFixed(2), cy: (20 + Math.sin(a) * r * 0.62).toFixed(2), r: dot.toFixed(3), class: 'g-eye-pt' }));
    }
  });
  s.append(svgEl('circle', { cx: 20, cy: 20, r: big ? 2.2 : 3.4, class: 'g-eye-core' }), svgEl('circle', { cx: 20, cy: 20, r: big ? 0.9 : 1.3, class: 'g-eye-mid' }));
  return s;
}

// ---------------------------------------------------------------- the line of sight

/**
 * A thin line from the eye to the one thing it attends to, over `host` (positioned): `aim(eye, thing)` draws it from the
 * eye's edge to the thing's nearest edge, as the eye turns (the turn's duration; at once with Reduce Motion); `aim(eye, null)`
 * takes it away. A dot where it lands.
 */
export function lineOfSight(host: HTMLElement): { el: SVGSVGElement; aim(eye: Element, thing: Element | null): void } {
  const svg = svgEl('svg', { class: 'g-sight', 'aria-hidden': 'true' });
  const line = svgEl('line', { class: 'g-sight-line' });
  const dot = svgEl('circle', { class: 'g-sight-dot', r: 2.5 });
  svg.append(line, dot);
  host.append(svg);
  return {
    el: svg,
    aim(eye, thing) {
      svg.classList.toggle('on', !!thing);
      if (!thing) return;
      // (inside the host's border: a positioned child's 0,0 is its padding box)
      const r0 = host.getBoundingClientRect();
      const hb = { left: r0.left + host.clientLeft, top: r0.top + host.clientTop, width: host.clientWidth, height: host.clientHeight };
      const e = eye.getBoundingClientRect();
      const t = thing.getBoundingClientRect();
      svg.setAttribute('width', String(hb.width));
      svg.setAttribute('height', String(hb.height));
      svg.setAttribute('viewBox', `0 0 ${hb.width} ${hb.height}`);
      const ex = e.left + e.width / 2 - hb.left;
      const ey = e.top + e.height / 2 - hb.top;
      // the thing's nearest edge point to the eye, then the eye's edge towards it
      const tx = Math.max(t.left, Math.min(t.right, e.left + e.width / 2)) - hb.left;
      const ty = Math.max(t.top, Math.min(t.bottom, e.top + e.height / 2)) - hb.top;
      const len = Math.hypot(tx - ex, ty - ey) || 1;
      const rad = e.width / 2;
      const sx = ex + ((tx - ex) / len) * rad;
      const sy = ey + ((ty - ey) / len) * rad;
      for (const [k, v] of Object.entries({ x1: sx, y1: sy, x2: tx, y2: ty })) line.setAttribute(k, v.toFixed(1));
      dot.setAttribute('cx', tx.toFixed(1));
      dot.setAttribute('cy', ty.toFixed(1));
      marksState.sights++;
      const ms = dur('turn');
      const run = Math.max(0, len - rad);
      line.getAnimations().forEach((a) => a.cancel());
      if (ms) line.animate([{ strokeDasharray: `0 ${run}` }, { strokeDasharray: `${run} 0` }], { duration: ms, easing: ease('bring') });
      dot.getAnimations().forEach((a) => a.cancel());
      if (ms) dot.animate([{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], { duration: ms });
    },
  };
}

// ---------------------------------------------------------------- the typed-out line

export interface TypedLine {
  el: HTMLElement;
  /** Add words as the brain writes them (the cursor stays until done). */
  write(chunk: string): void;
  /** The writing is finished: the cursor goes, VoiceOver hears the whole line once. */
  done(): void;
  /** Type `text` out at the pace the brain streams (about 30 characters a second); whole at once with Reduce Motion. */
  type(text: string): Promise<void>;
  /** Replace the words at once. */
  set(text: string): void;
}

/** About as fast as the brain's words arrive on the phone: 30 characters a second. */
const TYPE_MS = 33;

/** Text that arrives as the brain writes it, with a block cursor while it is still writing (narration, the status line). */
export function typedLine(o: { label?: string } = {}): TypedLine {
  const words = h('span.g-typed-words');
  const cursor = h('i.g-cursor', { 'aria-hidden': 'true' });
  const el = h('p.g-typed', { dataset: { g: 'typed', case: 'keep' }, 'aria-live': 'polite', ...(o.label ? { 'aria-label': o.label } : {}) }, words, cursor);
  let run = 0;
  const writing = (on: boolean) => {
    el.classList.toggle('writing', on);
    el.setAttribute('aria-busy', String(on));
  };
  const t: TypedLine = {
    el,
    write(chunk) {
      writing(true);
      words.textContent += chunk;
    },
    done() {
      writing(false);
    },
    set(text) {
      run++;
      words.textContent = text;
      writing(false);
    },
    async type(text) {
      const me = ++run;
      words.textContent = '';
      writing(true);
      marksState.typed++;
      if (still()) {
        words.textContent = text;
        writing(false);
        return;
      }
      for (let i = 0; i < text.length; i++) {
        if (me !== run) return;
        words.textContent = text.slice(0, i + 1);
        await new Promise((r) => setTimeout(r, TYPE_MS));
      }
      if (me === run) writing(false);
    },
  };
  return t;
}

// ---------------------------------------------------------------- the moment of recognition, and the search before it

/** Where an element sits inside its positioned host, in CSS px. */
function boxIn(host: HTMLElement, el: Element): { left: number; top: number; width: number; height: number } {
  const hb = host.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // (inside the host's border: a positioned child's 0,0 is its padding box)
  return { left: r.left - hb.left - host.clientLeft, top: r.top - hb.top - host.clientTop, width: r.width, height: r.height };
}
const px = (b: { left: number; top: number; width: number; height: number }) => ({ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });

/** The box that does the recognising: one per host, laid over it (a reticle with no words of its own). */
export function lockBox(host: HTMLElement): HTMLElement {
  const box = h('span.g-lock', { 'aria-hidden': 'true', dataset: { g: 'lock' } }, h('span.g-ret-frame'));
  box.hidden = true;
  host.append(box);
  return box;
}

const lastLocked = new WeakMap<HTMLElement, Element>();

/**
 * The box snaps onto `thing` with one short tone: from a little wider and faint, it closes on the thing's edges over the
 * lock's duration (the lock curve) and lights in the accent. Once for each thing: asked again for the thing it already holds,
 * it stays and makes no sound (`again` makes it lock afresh). The tone follows his sound setting (assistant/sfx.ts). Resolves
 * when the box has landed.
 */
export async function recognise(box: HTMLElement, thing: Element, o: { name?: string; again?: boolean; onLock?: (fresh: boolean) => void } = {}): Promise<boolean> {
  const host = box.parentElement as HTMLElement;
  const to = boxIn(host, thing);
  if (!o.again && lastLocked.get(box) === thing && !box.hidden) {
    Object.assign(box.style, px(to));
    o.onLock?.(false);
    return false;
  }
  lastLocked.set(box, thing);
  // (what the lock is, said at once: `onLock` hears it as the box starts to close, the promise when it has landed)
  o.onLock?.(true);
  const pad = 14;
  const from = { left: to.left - pad, top: to.top - pad, width: to.width + pad * 2, height: to.height + pad * 2 };
  box.hidden = false;
  box.dataset.state = 'attend';
  Object.assign(box.style, px(to));
  const ms = dur('lock');
  marksState.locks++;
  marksState.lastLock = o.name ?? thing.getAttribute('aria-label') ?? '';
  // THE SOUND (BRIEF-THEMES-2): one short level tone, one small click, or the lock in silence; always on top of his sound setting.
  // Scheduled on the audio clock for the moment the box lands, so a busy page never makes it late.
  const sound = (document.documentElement.dataset.sound ?? 'tone') as 'tone' | 'click' | 'off';
  marksState.lastSound = sound;
  if (sound === 'tone') {
    if (ms) sfx('lock', ms);
    else sfx('lock');
  } else if (sound === 'click') sfx('click', ms);
  if (ms) {
    const a = box.animate([{ ...px(from), opacity: 0.35 }, { ...px(to), opacity: 1 }], { duration: ms, easing: ease('lock') });
    await a.finished.catch(() => undefined);
  }
  return true;
}

/**
 * The search before the lock: the box visits each candidate in turn (the lock's duration on each), `say` hears which one
 * ("Checking 2 of 3"), then it recognises `found`. With Reduce Motion it goes straight to the lock.
 */
export async function search(box: HTMLElement, candidates: Element[], found: Element, say: (words: string) => void): Promise<void> {
  const host = box.parentElement as HTMLElement;
  marksState.searches++;
  lastLocked.delete(box);
  if (!still()) {
    box.hidden = false;
    box.dataset.state = 'watch';
    for (const [i, c] of candidates.entries()) {
      say(`Checking ${i + 1} of ${candidates.length}`);
      const to = px(boxIn(host, c));
      const from = { left: box.style.left || to.left, top: box.style.top || to.top, width: box.style.width || to.width, height: box.style.height || to.height };
      Object.assign(box.style, to);
      await box.animate([from, to], { duration: dur('lock'), easing: ease('lock') }).finished.catch(() => undefined);
      await new Promise((r) => setTimeout(r, dur('lock')));
    }
  }
  say(`Found it: ${found.getAttribute('aria-label') ?? 'there'}`);
  await recognise(box, found, { again: true });
}

/** Take the box away (the thing is no longer attended). */
export function release(box: HTMLElement): void {
  box.hidden = true;
  lastLocked.delete(box);
}

/** Whether a recognition would be heard now (his sounds on, the phone tapped once): THE LOOK says so when it would not. */
export const toneHeard = (): boolean => sfxAllowed();
