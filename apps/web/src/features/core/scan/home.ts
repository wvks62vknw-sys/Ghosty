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
import { missed } from '../missed';
import { Scan, lerpPose, type CamPose, type V3 } from './scene';
import { ALTITUDES, CAMERAS, FOG, MARKS, ORB_AT, ORB_FILL, marksAt, worldDesc, type Altitude, type Mark } from './world';
import { decide, placeLine, placeNow, startSense, youAre, type PlaceNow } from './place';
import { ribbon } from '../ribbon';
import { orbFx } from '../orbfx';
import { tilt, tiltState } from '../tilt';
import { startDay } from '../day';

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

/** Home's second line, in my voice (what Now is): THE SCAN's and ONE INK's, one source. */
export function sayTwo(p: PlaceNow, hr = new Date(now()).getHours()): string {
  if (p.kind === 'out') return 'Shall I plan the way back?';
  if (p.kind === 'way') return 'Shall we read till you get there?';
  if (hr >= 17 || hr < 5) return bookNow() ? 'Nothing needs you tonight. Shall we read?' : 'Nothing needs you tonight.';
  if (hr < 12) return 'Shall I brief you?';
  return 'Nothing needs you right now.';
}

/** The book he is in (his reading places, newest first): its name, how far, when; null when none is on the go. */
export function bookNow(): { doc: string; pct: number; at: number; page: number | null } | null {
  const all = Object.entries(places.get().map).filter(([, p]) => !p.done);
  if (!all.length) return null;
  const [doc, p] = all.sort((a, b) => b[1].at - a[1].at)[0]!;
  return { doc, pct: p.pct, at: p.at, page: p.page ?? null };
}
export const whenWord = (at: number): string => {
  const d = (now() - at) / 86_400_000;
  return d < 1 ? 'today' : d < 2 ? 'yesterday' : `${Math.round(d)} days ago`;
};
export const bookName = (doc: string) => doc.replace(/[-_]+/g, ' ').replace(/\.(pdf|epub|txt|md)$/i, '').replace(/^\w/, (c) => c.toUpperCase());

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
  /** A source of the readout ribbon changed (the next event arrived). */
  refresh(): void;
}

/**
 * Build Home (once, at Core's mount). `orbWrap`: the hero's wrap holding the 2-D reactor canvas, which the orb is drawn over
 * (Mind's anchor): it is moved here and placed where the camera puts the orb each frame. `stamp`: Home's stamp line (one source,
 * shell/awareness.ts); `caption`: the latest reply's line; `ask`: the ask line (#cbar), re-homed under the house.
 */
export function scanHome(o: { orbWrap: HTMLElement; stamp: HTMLElement; caption: HTMLElement; ask: HTMLElement; onBack: () => void; next?: () => string | null }): ScanHome {
  const scan = scanScene();
  startDay();
  const stage = h('div.scanstage', { 'aria-hidden': 'true' }, h('i.scansky'), h('i.scanlamp'), h('i.scanroomlight'));
  const marks = h('div.scanmarks');
  const leads = svgEl('svg', { class: 'scanleads', 'aria-hidden': 'true' });
  const sight = svgEl('path', { class: 'scansight' });
  const sightDot = svgEl('circle', { class: 'scansightdot', r: 2.5 });
  const lead = svgEl('path', { class: 'scanlead' });
  const leadDot = svgEl('circle', { class: 'scanleaddot', r: 2 });
  leads.append(sight, sightDot, lead, leadDot);
  const orbHost = h('div.scanorb');
  // (the orb reacting, drawn over its box in 2-D: the pulse, the ring, and the plan's thread: orbfx.ts)
  const fx = orbFx();
  orbHost.append(fx.el);
  const where = h('p.g-truth.where.scanwhere', { dataset: { g: 'truth', case: 'keep' }, role: 'status' });
  const say = h('p.scansay', { dataset: { case: 'keep' } });
  const say2 = h('p.scansay2', { dataset: { case: 'keep' } });
  // THE DAY's key (the weather, Today, Roads, the Gym, the readings, the chips: Home's standing cards) sits in the top block, above the marks
  const dayKey = h('button.g-key.scandaykey', { type: 'button', 'aria-expanded': 'false', dataset: { case: 'keep' } }, 'The day');
  const dayRow = h('div.scanday', dayKey);
  const top = h('div.scantop', where, say, say2, dayRow);
  // the altitudes as the Machine's own keys: one line each, the one he is on lit; a tap goes there (a way up and down without a pinch)
  // (at 390 the four keys drop their "The" so they stay one row: styles.css)
  const altKeys = ALTITUDES.map((a) => h('button.scanalt', { type: 'button', dataset: { alt: a, case: 'keep' }, 'aria-label': `Go to the ${a === 'whole' ? 'whole of it' : a}` }, h('span.g-truth', h('span.the', 'The '), a)));
  const alts = h('div.scanalts', { role: 'group', 'aria-label': 'Altitude' }, ...altKeys);
  // NOW: the callout at the screen's edge, its leader running to the thing in the world
  const coTag = h('span.coTag');
  const coBig = h('span.big');
  const coTruth = h('span.cotruth');
  const callout = h('button.scanco', { type: 'button', dataset: { case: 'keep' } }, coTag, coBig, coTruth);
  // THE HOUSE's words are its key: a tap unfolds the plan of every room (shell/house.ts), as on every other screen
  const kickL = h('button.scankickkey', { type: 'button', 'aria-label': 'The house: seven rooms. Open the plan' }, h('span.g-truth', 'The house · 7 rooms'));
  kickL.addEventListener('click', () => void import('../../../shell/house').then((m) => m.housePlan()?.toggle()));
  const kickR = h('span.g-truth', 'You are home');
  const kick = h('div.scankick', { dataset: { case: 'keep' } }, kickL, kickR);
  const askHost = h('div.scanask');
  // the column over the world, under the greeting: what today's Home shows besides the world (the wall, the task at work, whose
  // voice, the readings), taken as they are; empty, it is nothing and the world is clear. Home's standing cards are one key away
  const col = h('div.scancol', { role: 'region', 'aria-label': 'On Home', dataset: { day: 'shut' } });
  dayKey.addEventListener('click', () => {
    const open = col.dataset.day !== 'open';
    col.dataset.day = open ? 'open' : 'shut';
    dayKey.setAttribute('aria-expanded', String(open));
  });
  // THE LIGHT FOLLOWING THE TOUCH (BRIEF-OCT-IDEAS-1 2): one soft radial of the accent's pale tint over the plate the finger is on, only while he has permitted the tilt
  const sweep = h('i.scansweep', { 'aria-hidden': 'true', dataset: { on: 'false' } });
  const el = h('div.scanframe', stage, orbHost, col, sweep, marks, leads, callout, top, alts, askHost, kick);
  // THE READOUT RIBBON (BRIEF-OCT-IDEAS-1 1): under the stamp line, drawn after the hand-over, never on the first frame (armRibbon, below)
  const rib = ribbon('scan', o.next ?? (() => null));
  // the parts of today's Home this frame takes (and gives back when the look is another): where each came from
  const taken: { el: HTMLElement; into: HTMLElement; first: boolean; before?: HTMLElement; parent: HTMLElement | null; next: Node | null }[] = [
    { el: o.stamp, into: top, first: true, parent: null, next: null },
    { el: o.caption, into: top, first: false, before: dayRow, parent: null, next: null },
    { el: o.orbWrap, into: orbHost, first: false, parent: null, next: null },
    { el: o.ask, into: askHost, first: false, parent: null, next: null },
  ];
  // Home's own centre column: its parts go into the column in this order (the news, then the standing cards, the voice last)
  const centre = o.ask.parentElement;
  const pick = (sel: string): HTMLElement | null => centre?.querySelector<HTMLElement>(sel) ?? null;
  for (const sel of ['#cstate', '.hudlayer .hudtask', '.rcbelow > section.wall', '#suggest', '.rcwx', '.rcbelow', '.rchero', '#voicetag']) {
    const e = pick(sel);
    if (e) taken.push({ el: e, into: col, first: false, parent: null, next: null });
  }
  const wallHead = pick('.rcbelow > section.wall .wallhead');
  // In The Scan the wall's cards are one key away, like THE DAY's: the head (NOW · ALL SCREENS) stays on Home and a tap on NOW
  // opens the cards over the world; shut, the world and its marks are clear (the finding rule holds at two taps)
  col.dataset.wall = 'shut';
  const nowKey = wallHead?.querySelector('b');
  if (wallHead && nowKey) {
    nowKey.setAttribute('role', 'button');
    nowKey.setAttribute('tabindex', '0');
    nowKey.setAttribute('aria-expanded', 'false');
    nowKey.classList.add('scannowkey');
    const toggle = () => {
      const open = col.dataset.wall !== 'open';
      col.dataset.wall = open ? 'open' : 'shut';
      nowKey.setAttribute('aria-expanded', String(open));
    };
    nowKey.addEventListener('click', toggle);
    nowKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }
  // [lifeeasier] a day or more away: WHAT DID I MISS? (features/core/missed.ts) opens the wall by itself, so its card is on Home the moment it
  // lands and not one key away; GOT IT puts the wall back as it was (a wall he opened himself stays open)
  let openedForMissed = false;
  missed.subscribe((s) => {
    if (s.card && col.dataset.wall !== 'open') {
      openedForMissed = true;
      col.dataset.wall = 'open';
      nowKey?.setAttribute('aria-expanded', 'true');
    } else if (!s.card && openedForMissed) {
      openedForMissed = false;
      col.dataset.wall = 'shut';
      nowKey?.setAttribute('aria-expanded', 'false');
    }
  });
  const voiceEl = pick('#voicetag');
  const take = () => {
    for (const t of taken) {
      if (t.el.parentElement === t.into) continue;
      t.parent = t.el.parentElement;
      t.next = t.el.nextSibling;
      if (t.first) t.into.prepend(t.el);
      else if (t.before) t.into.insertBefore(t.el, t.before);
      else t.into.append(t.el);
    }
  };
  const giveBack = () => {
    for (const t of taken) if (t.parent && t.el.parentElement === t.into) t.parent.insertBefore(t.el, t.next && t.next.parentElement === t.parent ? t.next : null);
  };
  // (the house along the bottom is the shared one, shell/house.ts: its seventh room, ME, and THE HOUSE's tap that unfolds the plan, on every screen)

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
    rib.paint();
  };

  // ---------------------------------------------------------------- each frame: the camera, the orb, the marks, the leads
  const orbRect = (): { x: number; y: number; w: number; h: number } => {
    const sx = (ORB_AT.x / 440) * W;
    const sy = (ORB_AT.y / 956) * H;
    const rp = ORB_AT.r * Math.min(W / 440, H / 956);
    const side = (2 * rp) / ORB_FILL;
    return { x: sx - side / 2, y: sy - side / 2, w: side, h: side };
  };
  /** The orb's viewport inside the stage's canvas: the stage moves with the world under a tilt, so the orb's own (smaller) shift is the difference. */
  const stageRectNow = (q: { x: number; y: number; w: number; h: number }) => ({ x: q.x + tiltState.orb[0]! - tiltState.world[0]!, y: q.y + tiltState.orb[1]! - tiltState.world[1]!, w: q.w, h: q.h });
  const paintMarks = (force = false) => {
    void force;
    const cam = scan.cam;
    cam.set(pose, W, H);
    const out: typeof scanState.marks = [];
    // (the thing of the hour is marked in every frame: tonight's book, or this morning's Brief where the book would be)
    const frameTop = el.getBoundingClientRect().top || 0;
    // (the wall's head and the voice's keys, when they show, are above the marks too: the marks step off them)
    const headRect = wallHead && wallHead.offsetParent ? wallHead.getBoundingClientRect() : null;
    const topBottom = Math.max(top.getBoundingClientRect().bottom, headRect ? headRect.bottom + 4 : 0) - frameTop;
    // the band at the bottom (the altitude keys, the ask line, the house) takes the tap too: a key stays above it
    const altsTop = alts.getBoundingClientRect().top;
    const voiceRect = voiceEl && !voiceEl.hidden && voiceEl.offsetParent ? voiceEl.getBoundingClientRect() : null;
    const bottomTop = Math.min(altsTop > 0 ? altsTop : H, voiceRect ? voiceRect.top - 4 : H) - frameTop;
    // the plates on Home (the wall, a reply, whose voice, the task at work): a mark or a callout never crosses one. While a
    // plate is there the world is the ground under it and the marks it covers wait; they come back when the column empties.
    const frameLeft = el.getBoundingClientRect().left || 0;
    const plates: { left: number; top: number; right: number; bottom: number }[] = [];
    for (const n of col.querySelectorAll<HTMLElement>(':scope > *')) {
      if (n.hidden || !n.offsetHeight) continue;
      const pr = n.getBoundingClientRect();
      if (pr.width < 2 || pr.height < 2) continue;
      plates.push({ left: pr.left - frameLeft, top: pr.top - frameTop, right: pr.right - frameLeft, bottom: pr.bottom - frameTop });
    }
    // the callout (the thing of the hour, at the right edge) is a plate too: a mark that the readout ribbon pushed down on a short screen would sit
    // under it, so it waits there (the safari spec: God's eye and the station under "Now · tonight's book" at 440 × 763)
    if (callout.offsetParent) {
      const cr = callout.getBoundingClientRect();
      if (cr.width > 2 && cr.height > 2) plates.push({ left: cr.left - frameLeft, top: cr.top - frameTop, right: cr.right - frameLeft, bottom: cr.bottom - frameTop });
    }
    const onPlate = (bx: { left: number; top: number; right: number; bottom: number }) => plates.some((pl) => bx.left < pl.right && bx.right > pl.left && bx.top < pl.bottom && bx.bottom > pl.top);
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
      // a box too tall for the band between the words above and the keys below (the shelf, with the readout ribbon taking its line at the top)
      // is shortened to the band, never dropped, so long as it stays a 44 pt target
      if (box.top < topBottom + 4 && box.bottom - (topBottom + 4) >= 44) box.top = topBottom + 4;
      if (box.top < topBottom + 4 || box.bottom > H - 2 || onPlate(box)) {
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
    if (m && !m.booting) m.stageRect = stageRectNow(q);
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
      callout.style.visibility = '';
      let cr = callout.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      let cb = { left: cr.left - er.left, top: cr.top - er.top, right: cr.right - er.left, bottom: cr.bottom - er.top };
      if (onPlate(cb)) {
        const above = nb.top - 12 - (cb.bottom - cb.top);
        callout.style.top = `${Math.round(above)}px`;
        cr = callout.getBoundingClientRect();
        cb = { left: cr.left - er.left, top: cr.top - er.top, right: cr.right - er.left, bottom: cr.bottom - er.top };
        // no clear place: the plates say what is now; the callout waits until the column empties
        if (onPlate(cb) || cb.top < topBottom + 4) callout.style.visibility = 'hidden';
      }
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

  let tiltAt = 0;
  const tl = tilt({ world: [stage, marks, leads], plates: [col], orb: [orbHost] }, () => undefined);
  let fpsN = 0;
  let fpsAt = 0;
  let dockH = 0;
  let colTop = -1;
  let colBot = -1;
  const frame = (t: number) => {
    loop = 0;
    if (!scanState.on) return;
    // a sheet over the world (the deck, the jump bar, the chat log) gets the whole frame: the world is not drawn under it (the jump bar's
    // 300 ms budget on a two-core runner, and the battery on his phone), and it picks up where it was when the sheet goes
    // (the house's height is read first, so the ask line follows the house even while the world waits; a hidden house (the
    // chat open, the keyboard up) keeps the last height, since the stylesheet drops the floor to the home indicator in the
    // same frame the house goes, and the ask line never sits a frame under the house coming back)
    const dock = document.getElementById('dock');
    const dh = dock ? dock.offsetHeight : 64;
    if (dh > 0 && dh !== dockH) {
      dockH = dh;
      (el.closest<HTMLElement>('.hud') ?? el).style.setProperty('--scan-dock', `${dh}px`);
    }
    if (document.getElementById('deck')?.classList.contains('on') || document.getElementById('palette')?.classList.contains('on') || el.closest('.hud')?.classList.contains('logopen')) {
      loop = requestAnimationFrame(frame);
      return;
    }
    const w0 = performance.now();
    // the tilt eases on the display's own frame, the orb's pulse and ring are drawn (both are nothing at rest)
    const dtS = tiltAt ? Math.min(0.1, (t - tiltAt) / 1000) : 0.016;
    tiltAt = t;
    tl.frame(dtS, still());
    if (tl.moving()) {
      const mm = currentMind();
      if (mm && !mm.booting && scanState.orb) {
        const [ox, oy, ow, oh] = scanState.orb as [number, number, number, number];
        mm.stageRect = stageRectNow({ x: ox, y: oy, w: ow, h: oh });
        mm.nudge();
      }
    }
    fx.frame(t, still(), scanState.orb?.[2] ?? 0);
    const r = el.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width || innerWidth));
    H = Math.max(1, Math.round(r.height || innerHeight));
    // the column's room: from under the greeting to above the altitude keys (it never covers the keys, the ask line or the house)
    const fr = r.top || 0;
    const colT = Math.round(Math.max(0, top.getBoundingClientRect().bottom - fr) + 8);
    const colB = Math.round(Math.max(0, H - (alts.getBoundingClientRect().top - fr)) + 8);
    if (colT !== colTop || colB !== colBot) {
      colTop = colT;
      colBot = colB;
      el.style.setProperty('--scan-colt', `${colT}px`);
      el.style.setProperty('--scan-colb', `${colB}px`);
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
    // the breath alone (six millimetres over twelve seconds) is drawn on every other frame: a move draws every frame, and so does a
    // calm screen's first frame; the world at rest costs half as much (a two-core runner's software WebGL, and his battery)
    // (and a screen that cannot keep up (under 24 frames a second measured over the last second: a two-core runner's software
    // WebGL, an old phone) draws the breath on every fourth frame and a move on every other, so the rest of the page keeps its
    // budgets: the jump bar's 300 ms, the first word of a reply)
    const breathing = !scanState.moving && !still();
    const slow = scanState.fps > 0 && scanState.fps < 24;
    const every = breathing ? (slow ? 4 : 2) : slow ? 2 : 1;
    if (fpsN % every === 0) {
      const shown = breath(t);
      scan.cam.set(shown, W, H);
      const kept = pose;
      pose = shown;
      paintMarks();
      pose = kept;
      if (!still()) m?.nudge();
    }
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

  // THE READOUT RIBBON comes after the hand-over: once the boot's veil is gone it waits a beat (700 ms), then takes its place under the stamp
  let ribTimer = 0;
  let boneAt = 0;
  const armRibbon = () => {
    if (rib.el.isConnected || ribTimer) return;
    const show = () => {
      ribTimer = 0;
      if (!scanState.on) return;
      if (document.getElementById('boot')) {
        ribTimer = window.setTimeout(show, 150);
        return;
      }
      if (!boneAt) {
        boneAt = performance.now();
        ribTimer = window.setTimeout(show, 500);
        return;
      }
      rib.mount(top, where);
    };
    ribTimer = window.setTimeout(show, 600);
  };
  // the light follows the touch across a plate, while the tilt is permitted (and never under Reduce Motion)
  const sweepAt = (e: PointerEvent) => {
    if (!settings.get().hudTilt || still()) {
      sweep.dataset.on = 'false';
      return;
    }
    const plate = (e.target as Element | null)?.closest?.('.scancol > *') as HTMLElement | null;
    if (!plate) {
      sweep.dataset.on = 'false';
      return;
    }
    const pr = plate.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    Object.assign(sweep.style, { left: `${pr.left - er.left}px`, top: `${pr.top - er.top}px`, width: `${pr.width}px`, height: `${pr.height}px` });
    sweep.style.setProperty('--sx', `${Math.round(e.clientX - pr.left)}px`);
    sweep.style.setProperty('--sy', `${Math.round(e.clientY - pr.top)}px`);
    sweep.dataset.on = 'true';
  };
  col.addEventListener('pointerdown', sweepAt);
  col.addEventListener('pointermove', sweepAt);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) col.addEventListener(ev, () => (sweep.dataset.on = 'false'));
  // the plan opened or folded: the thread from the orb to the room in use
  let planned = false;
  new MutationObserver(() => {
    const now2 = document.body.classList.contains('planned');
    if (now2 === planned) return;
    planned = now2;
    fx.plan(planned && scanState.on, orbHost, still());
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const api: ScanHome = {
    el,
    enter() {
      wanted = true;
      if (!phone()) return;
      scanState.on = true;
      armRibbon();
      document.body.classList.add('scanhome');
      take();
      // (the field keeps 'Talk to me': his principle that it invites talk, not a query (OWNER-ISSUES 63, 64; the character spec); the mock's words were the designer's)
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
      markLeft();
      clearInterval(minute);
      clearTimeout(ribTimer);
      ribTimer = 0;
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
      armRibbon();
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
    refresh: () => rib.paint(),
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
