/**
 * THE SCAN'S HOME: THE WHOLE OF IT with ROOM+ inside it (BRIEF-HUD-SCAN-1 1–5, 8; his words, OWNER-ISSUES 158–160; the design
 * fixed by docs/build-plan/mockups/hud/2026-11-08-3/world.png and room-plus.png). One frame from the sky to his desk, drawn in
 * Home's one WebGL context (mind.ts, staged full-screen; the orb drawn after the world into its own viewport, never a copy):
 * the aircraft, the city at 1:6, the street, his house with the roof lifted, the room lit inside it, the lamp and the book lit
 * on the desk; the orb over it with its line of sight dropping to the one thing the Machine is looking at.
 *
 * WHERE HOME LANDS (3): the world frame at the boot (the film lands there) and after an absence of twenty minutes or more; the
 * room when he has just been in it (left under twenty minutes ago) or came from a thing in the room. The camera moves between
 * the altitudes (the room, the street, the city, the whole) on the tokens' curve (--g-dur-bring, quintic in-out): a pinch out
 * goes up, a pinch in goes down, a tap on a place goes there (the house, the station), and the house along the bottom and
 * the orb are always a way back. Under Reduce Motion the altitudes are stills that cross-fade.
 *
 * THE FINDING RULE (4): from the world frame tonight's thing is one tap (the lit book or its callout), the shelf and the aircraft
 * one tap; the Brief, the Lens, the Gym and Courses two (into the room, then the thing) or one typed word; the seven rooms one tap
 * along the bottom. In the world frame the room's small things are NOT marked (they would stack; the book's box is held to 44 pt);
 * in the room all eight are, each with its tag (and the one true line where it has one).
 *
 * HOME BY PLACE (5; place.ts): AT HOME is the world landed on the room or the house; OUT is the same world landed on the city by
 * day, him ringed on the walk, the nearest saved place locked; ON THE WAY is the city turned to the line, the train a lit point
 * with its trail. Each is said in one mono line under the stamp, decided on the phone, sent nowhere.
 *
 * THE RUBRIC (8): nothing moves without a reason; every move on a named curve from the tokens; nothing arrives without settling
 * (from 108 %, +4 px); ambient life slower than a breath on two periods that never repeat together (the camera 12.6 s and 17 s,
 * the points' drift), never moving the type; the type floor; the Machine's lines mono, whole segments, the dot at each end.
 * The checks read it at window.__ghosty.scan (scanState).
 */
import { h, svgEl } from '../../../core/dom';
import { navTo, greeting } from '../../../shell/areas';
import { settings } from '../../../state/app';
import { themeEvents } from '../../../state/theme';
import { places } from '../../../library/place';
import { dur, tag, truthLine } from '../../../ui/machine';
import { currentMind, type Mind } from '../mind';
import { Scan, lerpPose, type CamPose, type V3 } from './scene';
import { ALTITUDES, CAMERAS, FOG, MARKS, ORB_AT, ORB_FILL, marksAt, worldDesc, type Altitude, type Mark } from './world';
import { decide, placeLine, placeNow, startSense, youAre, type PlaceNow } from './place';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>';

/** An absence this long (ms) lands Home on the world frame again; shorter, on the room he just left. */
export const ABSENCE_MS = 20 * 60_000;
const LEFT_KEY = 'ghosty.scan.left';

const clamp = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const inOutQuint = (k: number) => {
  const x = clamp(k);
  return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
};
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'calm';
/** The frame is the phone's (styles.css draws it under 900 px); at a desk today's three-column Home stays as it is. */
const phone = () => innerWidth < 900;

/** How Home landed where it did: the boot's film, an absence, a return within twenty minutes, a thing in the room, or the place. */
export type Landed = '' | 'boot' | 'absence' | 'recent' | 'thing' | 'place';

/** What the boot tells Home (shell/boot.ts): the film has landed on the world frame. */
export const scanHooks = { landed: (): boolean => false };

/** The one scene on this phone (built once; the room's points and the city's are the same buffers at every altitude). */
let theScan: Scan | null = null;
let litBuilt = '';
let leanBuilt = false;
export function scanScene(): Scan {
  theScan ??= new Scan();
  return theScan;
}

/** What Home is doing, for the checks and the console (window.__ghosty.scan). */
export const scanState = {
  on: false,
  alt: 'whole' as Altitude,
  /** Where the camera is going (while it moves) and how far along, 0..1. */
  moving: false,
  k: 1,
  landed: '' as Landed,
  place: 'home' as PlaceNow['kind'],
  line: '',
  lit: 'alice',
  /** The marks on screen: id, name, where its box is (CSS px) and the screen a tap opens. */
  marks: [] as { id: string; name: string; rect: number[]; to: string }[],
  orb: null as number[] | null,
  scene: { points: 0, lines: 0, occluders: 0, buildMs: 0, lean: false },
  /** The frames Home drew in the last second and the ms each took on the phone (the honest number: read from the preview on his phone). */
  fps: 0,
  frameMs: 0,
  /** A check's clock for the landing rules (ms since the epoch), else the phone's. */
  clock: null as null | (() => number),
  /** A check's hands: go to an altitude, pinch (scale > 1 goes up), tap a mark. */
  goAlt: (_alt: Altitude) => undefined as void,
  pinch: (_scale: number) => undefined as void,
  tap: (_id: string) => false as boolean,
  /** The stage's canvas is the one context (true when Mind draws the world here). */
  staged: false,
  moves: 0,
  /** Decide the place again now (a check's stand-in sense changed) and land where the rules say. */
  reland: () => undefined as void,
};
const now = () => scanState.clock?.() ?? Date.now();

/** The lit thing by the hour: tonight's book from five in the afternoon, this morning's Brief before it. */
export const litByHour = (d = new Date(now())) => (d.getHours() >= 17 || d.getHours() < 5 ? 'r-alice' : 'r-brief');

/** The book he is in (his reading places, newest first): its name, how far, when; null when none is on the go. */
function bookNow(): { doc: string; pct: number; at: number } | null {
  const all = Object.entries(places.get().map).filter(([, p]) => !p.done);
  if (!all.length) return null;
  const [doc, p] = all.sort((a, b) => b[1].at - a[1].at)[0]!;
  return { doc, pct: p.pct, at: p.at };
}
const whenWord = (at: number): string => {
  const d = (now() - at) / 86_400_000;
  return d < 1 ? 'today' : d < 2 ? 'yesterday' : `${Math.round(d)} days ago`;
};
const bookName = (doc: string) => doc.replace(/[-_]+/g, ' ').replace(/\.(pdf|epub|txt|md)$/i, '').replace(/^\w/, (c) => c.toUpperCase());

export interface ScanHome {
  el: HTMLElement;
  /** Home came on screen: land by the rules, start the frame loop. */
  enter(): void;
  leave(): void;
  /** The film has landed on the world frame: Home takes the stage from it. */
  landedFromBoot(): void;
  /** The place word for the context line ("at home", "out, near X", "on the way"). */
  placeWords(): string;
  /** Home's second line, in my voice (what Now is). */
  say2(): string;
}

/**
 * Build Home (once, at Core's mount). `orbWrap`: the hero's wrap holding the 2-D reactor canvas, which the orb is drawn over
 * (Mind's anchor): it is moved here and placed where the camera puts the orb each frame. `stamp`: Home's stamp line (one source,
 * shell/awareness.ts); `caption`: the latest reply's line; `ask`: the ask line (#cbar), re-homed under the house.
 */
export function scanHome(o: { orbWrap: HTMLElement; stamp: HTMLElement; caption: HTMLElement; ask: HTMLElement; onBack: () => void }): ScanHome {
  const scan = scanScene();
  const stage = h('div.scanstage', { 'aria-hidden': 'true' }, h('i.scansky'), h('i.scanlamp'), h('i.scanroomlight'));
  const marks = h('div.scanmarks');
  const leads = svgEl('svg', { class: 'scanleads', 'aria-hidden': 'true' });
  const sight = svgEl('path', { class: 'scansight' });
  const sightDot = svgEl('circle', { class: 'scansightdot', r: 2.5 });
  const lead = svgEl('path', { class: 'scanlead' });
  const leadDot = svgEl('circle', { class: 'scanleaddot', r: 2 });
  leads.append(sight, sightDot, lead, leadDot);
  const orbHost = h('div.scanorb');
  const where = h('p.g-truth.where.scanwhere', { dataset: { g: 'truth', case: 'keep' }, role: 'status' });
  const say = h('p.scansay', { dataset: { case: 'keep' } });
  const say2 = h('p.scansay2', { dataset: { case: 'keep' } });
  const top = h('div.scantop', where, say, say2);
  // the altitudes as the Machine's own keys: one line each, the one he is on lit; a tap goes there (a way up and down without a pinch)
  // (at 390 the four keys drop their "The" so they stay one row: styles.css)
  const altKeys = ALTITUDES.map((a) => h('button.scanalt', { type: 'button', dataset: { alt: a, case: 'keep' }, 'aria-label': `Go to the ${a === 'whole' ? 'whole of it' : a}` }, h('span.g-truth', h('span.the', 'The '), a)));
  const alts = h('div.scanalts', { role: 'group', 'aria-label': 'Altitude' }, ...altKeys);
  // NOW: the callout at the screen's edge, its leader running to the thing in the world
  const coTag = h('span.coTag');
  const coBig = h('span.big');
  const coTruth = h('span.cotruth');
  const callout = h('button.scanco', { type: 'button', dataset: { case: 'keep' } }, coTag, coBig, coTruth);
  const kickL = h('span.g-truth', 'The house · 7 rooms');
  const kickR = h('span.g-truth', 'You are home');
  const kick = h('div.scankick', { dataset: { case: 'keep' } }, kickL, kickR);
  const askHost = h('div.scanask');
  const el = h('div.scanframe', stage, orbHost, marks, leads, callout, top, alts, askHost, kick);
  // the parts of today's Home this frame takes (and gives back when the look is another): where each came from
  const taken: { el: HTMLElement; into: HTMLElement; first: boolean; parent: HTMLElement | null; next: Node | null }[] = [
    { el: o.stamp, into: top, first: true, parent: null, next: null },
    { el: o.caption, into: top, first: false, parent: null, next: null },
    { el: o.orbWrap, into: orbHost, first: false, parent: null, next: null },
    { el: o.ask, into: askHost, first: false, parent: null, next: null },
  ];
  const take = () => {
    for (const t of taken) {
      if (t.el.parentElement === t.into) continue;
      t.parent = t.el.parentElement;
      t.next = t.el.nextSibling;
      if (t.first) t.into.prepend(t.el);
      else t.into.append(t.el);
    }
  };
  const giveBack = () => {
    for (const t of taken) if (t.parent && t.el.parentElement === t.into) t.parent.insertBefore(t.el, t.next && t.next.parentElement === t.parent ? t.next : null);
  };
  // the seventh room along the bottom: ME, in the house while this Home is on (the tab bar has six areas and his initial)
  const meRoom = h('button.scanme', { type: 'button', role: 'tab', dataset: { area: 'me', case: 'keep' }, title: 'Me' }, h('span', 'Me'));
  meRoom.addEventListener('click', () => void import('../../../commands/registry').then((r) => r.run('open_me')));
  const house = (on: boolean) => {
    const cap = document.querySelector('#dock .tabcap');
    const ask = cap?.querySelector<HTMLElement>('button[data-area="ask"] span');
    if (on) {
      if (cap && meRoom.parentElement !== cap) cap.append(meRoom);
      if (ask) ask.textContent = 'Home';
    } else {
      meRoom.remove();
      if (ask) ask.textContent = 'Ask';
    }
  };

  // ---------------------------------------------------------------- the marks
  const retEls = new Map<string, HTMLButtonElement>();
  const makeRet = (m: Mark): HTMLButtonElement => {
    const b = h('button.scanret', { type: 'button', dataset: { id: m.id, case: 'keep', side: m.side ?? '' }, 'aria-label': m.name }, h('span.g-ret-frame', { 'aria-hidden': 'true' }));
    if (m.name && m.id !== 'r-house' && m.id !== 'r-alice') b.append(tag(m.name, { glyph: m.glyph === 'clock' ? CLOCK : m.glyph === 'star' ? STAR : undefined, count: m.count }));
    b.addEventListener('click', () => tapMark(m));
    retEls.set(m.id, b);
    return b;
  };
  for (const m of MARKS) marks.append(makeRet(m));

  // ---------------------------------------------------------------- the camera
  let alt: Altitude = 'whole';
  let from: CamPose = CAMERAS.whole;
  let to: CamPose = CAMERAS.whole;
  let moveAt = 0;
  let moveMs = 900;
  let pose: CamPose = CAMERAS.whole;
  let fogFrom = FOG.whole;
  let fogTo = FOG.whole;
  let W = 440;
  let H = 956;
  let loop = 0;
  let last = 0;
  let cameFromThing = false;
  let fade = 0;
  const place = () => placeNow.get();

  const camFor = (a: Altitude): CamPose => CAMERAS[a];
  const goAlt = (a: Altitude, why: Landed = '') => {
    if (a === alt && !scanState.moving) return;
    scanState.moves++;
    if (why) scanState.landed = why;
    const calm = still();
    from = pose;
    to = camFor(a);
    fogFrom = FOG[alt];
    fogTo = FOG[a];
    alt = a;
    scanState.alt = a;
    moveMs = calm ? 0 : dur('bring') || 900;
    moveAt = performance.now();
    scanState.moving = moveMs > 0;
    scanState.k = moveMs > 0 ? 0 : 1;
    if (calm) {
      // Reduce Motion: the altitudes are stills that cross-fade (the stage dips to the ground and comes back on the new frame)
      clearTimeout(fade);
      el.classList.add('scanfade');
      fade = window.setTimeout(() => el.classList.remove('scanfade'), 260);
      pose = to;
    }
    currentMind()?.nudge();
    paintAlts();
    paintMarks(true);
  };
  const paintAlts = () => {
    for (const b of altKeys) b.classList.toggle('on', b.dataset.alt === (alt === 'line' || alt === 'out' ? 'city' : alt));
    el.dataset.alt = alt;
    for (const m of MARKS) retEls.get(m.id)!.hidden = !m.where.includes(alt);
    callout.hidden = false;
  };

  // a tap on a mark: a thing opens its screen (the room remembers he came from it); a place goes there
  const tapMark = (m: Mark): boolean => {
    if (m.to.startsWith('alt:')) {
      goAlt(m.to.slice(4) as Altitude, 'place');
      return true;
    }
    if (m.where.includes('room')) cameFromThing = true;
    navTo(m.to, 'push');
    return true;
  };
  scanState.goAlt = (a) => goAlt(a, 'place');
  scanState.tap = (id) => {
    const m = MARKS.find((x) => x.id === id);
    return m && m.where.includes(alt) ? tapMark(m) : false;
  };
  // a pinch out goes up, a pinch in goes down (scale > 1: the fingers parted)
  const pinch = (scale: number) => {
    const i = ALTITUDES.indexOf(alt === 'line' || alt === 'out' ? 'city' : alt);
    if (scale > 1.18 && i < ALTITUDES.length - 1) goAlt(ALTITUDES[i + 1]!, 'place');
    else if (scale < 0.85 && i > 0) goAlt(ALTITUDES[i - 1]!, 'place');
  };
  scanState.pinch = pinch;
  for (const b of altKeys) b.addEventListener('click', () => goAlt(b.dataset.alt as Altitude, 'place'));
  // the fingers: two pointers on the marks' layer, their distance when they land and when they lift
  const fingers = new Map<number, { x: number; y: number }>();
  let pinchStart = 0;
  const dist = () => {
    const [a, b] = [...fingers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  el.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) pinchStart = dist();
  });
  el.addEventListener('pointermove', (e) => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const lift = (e: PointerEvent) => {
    if (fingers.size === 2 && pinchStart > 0) {
      const scale = dist() / pinchStart;
      pinchStart = 0;
      pinch(scale);
    }
    fingers.delete(e.pointerId);
  };
  el.addEventListener('pointerup', lift);
  el.addEventListener('pointercancel', lift);
  // a trackpad's pinch (ctrl + wheel) on a desktop
  el.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    pinch(e.deltaY < 0 ? 1.3 : 0.7);
  }, { passive: false });
  // the orb: a tap on it is a way back to the world frame (and a poke)
  orbHost.addEventListener('click', () => {
    currentMind()?.poke();
    if (alt !== 'whole') goAlt('whole', 'place');
    else o.onBack();
  });
  // the callout: the thing of the hour, one tap
  callout.addEventListener('click', () => {
    const m = MARKS.find((x) => x.id === scanState.lit);
    const p = place();
    if (p.kind === 'out') return navTo('agenda', 'push');
    if (p.kind === 'way') return navTo('agenda', 'push');
    if (m) tapMark(m);
  });

  // ---------------------------------------------------------------- the words: the place line, the greeting, Now
  const paintWords = () => {
    const p = decide(now());
    scanState.place = p.kind;
    const line = placeLine(p);
    where.replaceChildren(...truthLine(line).childNodes);
    where.setAttribute('aria-label', line.join(', '));
    scanState.line = where.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    say.textContent = `${greeting(new Date(now()))}.`;
    say2.textContent = sayTwo(p);
    kickR.textContent = youAre(p);
    kickL.textContent = 'The house · 7 rooms';
    // NOW: by place, then by the hour
    const lit = litByHour();
    scanState.lit = lit;
    const book = bookNow();
    if (p.kind === 'out') {
      coTag.replaceChildren(tag('Now · the way home', { tone: 'on' }));
      coBig.textContent = p.name;
      coTruth.replaceChildren(truthLine(['Your saved place', 'tap to plan the way']));
    } else if (p.kind === 'way') {
      coTag.replaceChildren(tag('Now · on the way', { tone: 'on' }));
      coBig.textContent = `${p.mph} mph`;
      coTruth.replaceChildren(truthLine(['This phone’s reading', 'never sent', 'tap for the agenda']));
    } else if (lit === 'r-alice') {
      coTag.replaceChildren(tag('Now · tonight’s book', { tone: 'on' }));
      coBig.textContent = book ? bookName(book.doc) : 'Your shelf';
      coTruth.replaceChildren(truthLine(book ? [`${Math.round(book.pct * 100)} % read`, whenWord(book.at), 'tap to carry on'] : ['Nothing on the go', 'tap to pick a book']));
    } else {
      coTag.replaceChildren(tag('Now · this morning’s brief', { tone: 'on' }));
      coBig.textContent = 'The Brief';
      coTruth.replaceChildren(truthLine(['Tap to read it']));
    }
    callout.setAttribute('aria-label', `Now: ${coBig.textContent}`);
    for (const m of MARKS) retEls.get(m.id)!.classList.toggle('on', m.id === lit);
    const stageEl = stage;
    stageEl.dataset.place = p.kind;
    stageEl.dataset.hour = new Date(now()).getHours() >= 17 || new Date(now()).getHours() < 6 ? 'night' : 'day';
  };
  const sayTwo = (p: PlaceNow): string => {
    const hr = new Date(now()).getHours();
    if (p.kind === 'out') return 'Shall I plan the way back?';
    if (p.kind === 'way') return 'Shall we read till you get there?';
    if (hr >= 17 || hr < 5) return bookNow() ? 'Nothing needs you tonight. Shall we read?' : 'Nothing needs you tonight.';
    if (hr < 12) return 'Shall I brief you?';
    return 'Nothing needs you right now.';
  };

  // ---------------------------------------------------------------- each frame: the camera, the orb, the marks, the leads
  const orbRect = (): { x: number; y: number; w: number; h: number } => {
    const sx = (ORB_AT.x / 440) * W;
    const sy = (ORB_AT.y / 956) * H;
    const rp = ORB_AT.r * Math.min(W / 440, H / 956);
    const side = (2 * rp) / ORB_FILL;
    return { x: sx - side / 2, y: sy - side / 2, w: side, h: side };
  };
  const paintMarks = (force = false) => {
    void force;
    const cam = scan.cam;
    cam.set(pose, W, H);
    const out: typeof scanState.marks = [];
    // (the thing of the hour is marked in every frame: tonight's book, or this morning's Brief where the book would be)
    const frameTop = el.getBoundingClientRect().top || 0;
    const topBottom = top.getBoundingClientRect().bottom - frameTop;
    // the band at the bottom (the altitude keys, the ask line, the house) takes the tap too: a key stays above it
    const altsTop = alts.getBoundingClientRect().top;
    const bottomTop = (altsTop > 0 ? altsTop : H) - frameTop;
    const list = marksAt(alt).concat(MARKS.filter((m) => m.id === scanState.lit && !m.where.includes(alt) && alt !== 'line' && alt !== 'out'));
    // what the eye looks at: the thing of the hour at home; out and on the way, the place locked (the station)
    const lookId = alt === 'line' || alt === 'out' ? 'r-station' : scanState.lit;
    let nowBox: { left: number; top: number; right: number; bottom: number } | null = null;
    for (const m of MARKS) {
      const b = retEls.get(m.id)!;
      if (!list.includes(m)) continue;
      const box = cam.box(m.box, m.pad, 44);
      if (!box || box.right < 0 || box.left > W || box.bottom < 0 || box.top > H) {
        b.hidden = true;
        continue;
      }
      // a key never sits under the words at the top (the stamp, the where-line, the greeting take the tap): a box that would
      // start inside them is moved down to just below them, the way a box at the frame's edge stays on the screen; one that
      // would then leave the frame is not shown at this altitude (the safari spec found God's eye and the station under the
      // greeting on a short screen)
      if (box.top < topBottom + 4) {
        const dy = topBottom + 4 - box.top;
        box.top += dy;
        box.bottom += dy;
      }
      if (box.bottom > bottomTop - 4) {
        const dy = box.bottom - (bottomTop - 4);
        box.top -= dy;
        box.bottom -= dy;
      }
      if (box.top < topBottom + 4 || box.bottom > H - 2) {
        b.hidden = true;
        continue;
      }
      b.hidden = false;
      Object.assign(b.style, { left: `${Math.round(box.left)}px`, top: `${Math.round(box.top)}px`, width: `${Math.round(box.right - box.left)}px`, height: `${Math.round(box.bottom - box.top)}px` });
      // a tag never sits on the words at the top: a box whose top is under them wears its tag below instead (never on top of another's)
      const under = box.top < topBottom + 22 && !(m.side ?? '').includes('below');
      b.dataset.side = under ? `${m.side ?? ''} below`.trim() : m.side ?? '';
      out.push({ id: m.id, name: m.name, rect: [Math.round(box.left), Math.round(box.top), Math.round(box.right - box.left), Math.round(box.bottom - box.top)], to: m.to });
      if (m.id === lookId) nowBox = box;
    }
    scanState.marks = out;
    // the orb where the camera puts it
    const q = orbRect();
    Object.assign(orbHost.style, { left: `${q.x.toFixed(1)}px`, top: `${q.y.toFixed(1)}px`, width: `${q.w.toFixed(1)}px`, height: `${q.h.toFixed(1)}px` });
    scanState.orb = [Math.round(q.x), Math.round(q.y), Math.round(q.w), Math.round(q.h)];
    const m = currentMind();
    if (m && !m.booting) m.stageRect = q;
    // the callout at the screen's right edge, a third down, its leader to the thing; the line of sight from the orb's rim
    leads.setAttribute('width', String(W));
    leads.setAttribute('height', String(H));
    leads.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const cx = q.x + q.w / 2;
    const cy = q.y + q.h / 2;
    const rr = (q.w * ORB_FILL) / 2;
    if (nowBox) {
      const nb = nowBox as { left: number; top: number; right: number; bottom: number };
      const tx = Math.max(nb.left, Math.min(nb.right, cx));
      const ty = Math.max(nb.top, Math.min(nb.bottom, cy));
      const ang = Math.atan2(ty - cy, tx - cx);
      sight.setAttribute('d', `M${(cx + rr * Math.cos(ang)).toFixed(1)} ${(cy + rr * Math.sin(ang)).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}`);
      sightDot.setAttribute('cx', tx.toFixed(1));
      sightDot.setAttribute('cy', ty.toFixed(1));
      sight.style.opacity = '1';
      sightDot.style.opacity = '1';
      // the callout: its box, then the leader from its nearest edge to the thing's nearest edge. A callout never sits on the
      // thing it points at (its leader would have no length and the thing's own key would be under it): where its resting
      // place overlaps the thing's box it steps above the box, or below it when there is no room above the words
      callout.style.top = '';
      let cr = callout.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      let cb = { left: cr.left - er.left, top: cr.top - er.top, right: cr.right - er.left, bottom: cr.bottom - er.top };
      if (cb.left < nb.right && cb.right > nb.left && cb.top < nb.bottom && cb.bottom > nb.top) {
        const ch = cb.bottom - cb.top;
        const above = nb.top - 12 - ch;
        const below = nb.bottom + 12;
        const y = above > topBottom + 8 ? above : below + ch < bottomTop - 8 ? below : above;
        callout.style.top = `${Math.round(y)}px`;
        cr = callout.getBoundingClientRect();
        cb = { left: cr.left - er.left, top: cr.top - er.top, right: cr.right - er.left, bottom: cr.bottom - er.top };
      }
      const ax = Math.max(cb.left, Math.min(cb.right, (nb.left + nb.right) / 2));
      const ay = Math.max(cb.top, Math.min(cb.bottom, (nb.top + nb.bottom) / 2));
      const bx = Math.max(nb.left, Math.min(nb.right, ax));
      const by = Math.max(nb.top, Math.min(nb.bottom, ay));
      lead.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`);
      leadDot.setAttribute('cx', bx.toFixed(1));
      leadDot.setAttribute('cy', by.toFixed(1));
      lead.style.opacity = '1';
      leadDot.style.opacity = '1';
    } else {
      sight.style.opacity = '0';
      sightDot.style.opacity = '0';
      lead.style.opacity = '0';
      leadDot.style.opacity = '0';
    }
  };

  /** The world drawn into the one context (Mind's stage callback), with this frame's pose and light. */
  const draw = (T: Any, renderer: Any, t: number, w: number, hh: number, dpr: number) => {
    const p = place();
    const day = stage.dataset.hour === 'day';
    const calm = still();
    const k = scanState.k;
    scan.render(T, renderer, pose, w, hh, dpr, {
      uBuild: 1, uEdge: 1, uTime: calm ? 12.5 : t, uDrift: calm ? 0 : 1, uSparkle: calm ? 0 : 0.6, uPing: -9, uPingA: 0, uOrbLit: 1, uFade: 1,
      uFog: fogFrom + (fogTo - fogFrom) * k,
      uShow: p.kind === 'out' ? 1 : p.kind === 'way' ? 2 : 0,
      uSky: p.kind === 'out' ? 0.9 : p.kind === 'way' ? 0.5 : day ? 0.35 : 0,
      uWarmA: day || p.kind !== 'home' ? 0.35 : 1,
      uCoolA: 1,
    });
  };

  const breath = (t: number): CamPose => {
    if (still()) return pose;
    // six millimetres over 12.6 s and four over 17 s, scaled by how far the camera stands from what it looks at (invisible from the sky otherwise)
    const u = t / 1000;
    const d = Math.hypot(pose.pos[0] - pose.tgt[0], pose.pos[1] - pose.tgt[1], pose.pos[2] - pose.tgt[2]) / 3;
    const bx = 0.006 * d * Math.sin((u * 2 * Math.PI) / 12.6);
    const by = 0.004 * d * Math.sin((u * 2 * Math.PI) / 17 + 1);
    return { pos: [pose.pos[0] + bx, pose.pos[1] + by, pose.pos[2]], tgt: [pose.tgt[0] + bx * 0.6, pose.tgt[1], pose.tgt[2]], fov: pose.fov };
  };

  let fpsN = 0;
  let fpsAt = 0;
  let dockH = 0;
  const frame = (t: number) => {
    loop = 0;
    if (!scanState.on) return;
    const w0 = performance.now();
    const r = el.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width || innerWidth));
    H = Math.max(1, Math.round(r.height || innerHeight));
    const dock = document.getElementById('dock');
    const dh = dock ? dock.offsetHeight : 64;
    if (dh !== dockH) {
      dockH = dh;
      el.style.setProperty('--scan-dock', `${dh}px`);
    }
    const m = currentMind();
    // the stage: Mind's one context draws the world here (taken from the boot's film, or staged now); the scene built once
    if (m?.active && !m.booting && !m.lentOut) {
      ensureBuilt(m);
      if (!m.stagedIn(stage)) m.stage(stage, draw);
      scanState.staged = m.stagedIn(stage);
    } else scanState.staged = false;
    // the camera: the move on its curve, then the breath
    if (scanState.moving) {
      const k = inOutQuint(seg(t, moveAt, moveAt + moveMs));
      scanState.k = k;
      pose = lerpPose(from, to, k);
      if (k >= 1) {
        scanState.moving = false;
        pose = to;
      }
      m?.nudge();
    }
    const shown = breath(t);
    scan.cam.set(shown, W, H);
    const kept = pose;
    pose = shown;
    paintMarks();
    pose = kept;
    if (!still()) m?.nudge();
    fpsN++;
    if (t - fpsAt > 1000) {
      scanState.fps = fpsN;
      fpsN = 0;
      fpsAt = t;
    }
    scanState.frameMs = Math.round((performance.now() - w0) * 10) / 10;
    loop = requestAnimationFrame(frame);
  };
  const ensureBuilt = (m: Mind) => {
    void m;
    const lit = scanState.lit === 'r-alice' ? 'alice' : 'brief';
    const lean = (window as unknown as { __ghostyScanLean?: boolean }).__ghostyScanLean === true || scan.lean;
    // (the boot built it already, with the hour's lit thing: kept as it is; built here on an open with no film)
    if (scan.count.points && (litBuilt === lit || !litBuilt) && leanBuilt === lean) {
      litBuilt = lit;
      scanState.scene = { ...scan.count, lean: scan.lean };
      return;
    }
    if (litBuilt === lit && leanBuilt === lean && scan.count.points) return;
    scan.build(worldDesc(lit, lean));
    litBuilt = lit;
    leanBuilt = lean;
    scanState.scene = { ...scan.count, lean };
  };

  // ---------------------------------------------------------------- landing
  const landing = (): [Altitude, Landed] => {
    const p = decide(now());
    if (p.kind === 'out') return ['out', 'place'];
    if (p.kind === 'way') return ['line', 'place'];
    if (cameFromThing) return ['room', 'thing'];
    let left = 0;
    try {
      left = Number(localStorage.getItem(LEFT_KEY) ?? 0);
    } catch {
      left = 0;
    }
    if (left && now() - left < ABSENCE_MS) return ['room', 'recent'];
    return ['whole', left ? 'absence' : 'boot'];
  };
  const markLeft = () => {
    try {
      localStorage.setItem(LEFT_KEY, String(now()));
    } catch {
      /* no storage: the next open lands on the world */
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && scanState.on) markLeft();
  });
  /** The place decided again (the switch, his saved place, the phone's sense): the words, and the frame it lands on if the place moved it. */
  const reland = () => {
    const was = scanState.place;
    paintWords();
    if (!scanState.on) return;
    const [a, why] = landing();
    if (scanState.place !== was && a !== alt) goAlt(a, why);
  };
  scanState.reland = reland;
  settings.subscribe((s, p) => {
    if (s.placeSense !== p.placeSense || s.home !== p.home || s.name !== p.name) reland();
  });
  places.subscribe(() => scanState.on && paintWords());
  themeEvents.on('change', () => scan.readTokens());
  let minute = 0;
  /** Home wants the frame (it is the tab in The Scan); whether it shows follows the width. */
  let wanted = false;
  addEventListener('resize', () => {
    if (wanted && phone() && !scanState.on) api.enter();
    else if (scanState.on && !phone()) {
      api.leave();
      wanted = true;
    }
  });

  const api: ScanHome = {
    el,
    enter() {
      wanted = true;
      if (!phone()) return;
      scanState.on = true;
      document.body.classList.add('scanhome');
      take();
      house(true);
      const field = o.ask.querySelector('input');
      if (field && field.placeholder === 'Talk to me') field.placeholder = 'Ask, or say where to go';
      startSense();
      paintWords();
      const [a, why] = landing();
      cameFromThing = false;
      if (a !== alt) {
        // (a landing is a cut, not a move: Home lands where the rules say, then breathes)
        alt = a;
        pose = from = to = camFor(a);
        fogFrom = fogTo = FOG[a];
        scanState.alt = a;
        scanState.moving = false;
        scanState.k = 1;
      }
      scanState.landed = why;
      paintAlts();
      paintMarks(true);
      clearInterval(minute);
      minute = window.setInterval(paintWords, 60_000);
      if (!loop) loop = requestAnimationFrame(frame);
    },
    leave() {
      wanted = false;
      if (!scanState.on) return;
      scanState.on = false;
      document.body.classList.remove('scanhome');
      giveBack();
      house(false);
      const field = o.ask.querySelector('input');
      if (field && field.placeholder === 'Ask, or say where to go') field.placeholder = 'Talk to me';
      markLeft();
      clearInterval(minute);
      cancelAnimationFrame(loop);
      loop = 0;
    },
    landedFromBoot() {
      alt = 'whole';
      pose = from = to = CAMERAS.whole;
      fogFrom = fogTo = FOG.whole;
      scanState.alt = 'whole';
      scanState.moving = false;
      scanState.k = 1;
      scanState.landed = 'boot';
      try {
        localStorage.removeItem(LEFT_KEY);
      } catch {
        /* nothing kept */
      }
      paintAlts();
      paintMarks(true);
    },
    placeWords() {
      const p = place();
      return p.how === 'off' ? '' : p.kind === 'way' ? 'on the way' : p.kind === 'out' ? `out, near ${p.name}` : 'at home';
    },
    say2: () => say2.textContent ?? '',
  };
  // what the checks read
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.scan = scanState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  scanHooks.landed = () => {
    api.landedFromBoot();
    return scanState.on;
  };
  return api;
}

/** The world's camera for a frame of the film (shell/boot.ts, film.ts): the whole of it. */
export const WORLD_POSE: CamPose = CAMERAS.whole;
export type { V3 };
