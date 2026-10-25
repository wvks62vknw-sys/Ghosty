/**
 * The boot cinematic (docs/build-plan/BRIEF-BOOT.md; OWNER-ISSUES 43 and 45, his words: "really cinematic and cool",
 * "forget giving facts", "it's not an arc reactor anymore"; then "i want the cinematic to be on every boot up"). MIND
 * waking up, about 3.5 s, on every cold open (a launch from the Home Screen, a fresh tab, a reload):
 *   1. black; one point of light, far away, breathing once                      0 – 400 ms
 *   2. it splits into a drift of particles that settle into the constellation (links light as they settle), the camera
 *      pushes in slowly, a thin sweep of light passes down through it once        400 – 1,400 ms
 *   3. the sphere resolves round it and turns a few degrees; the equator scale lights   1,400 – 2,200 ms
 *   4. G H O S T Y assembles from particles, letter-spaced, and holds             2,200 – 2,800 ms
 *   5. one line, his: "Good evening, <name>." (the name from Settings)            2,800 – 3,200 ms
 *   6. the sphere eases up into Home's hero, where it lives from then on (the same Mind, never a copy), and the HUD
 *      assembles round it (the ribbon, the tab bar, the cards slide into place)   3,200 – 3,500 ms
 * No readouts, no numbers, no status line. It never delays the app: main.ts keeps booting underneath and calls
 * bootReady(); the cinematic lands when both are done, and its own part is over 3.5 s after its first frame (if the app
 * is still starting then, Mind keeps turning quietly, with no words, until it is). A tap skips it.
 * Reduce Motion: the frames fade, nothing moves, 1.2 s. A phone whose first frames come late, or whose Mind is late,
 * gets the short version (no drift, no push-in); with no 3-D at all, the point of light, the name and the greeting.
 * A resume (coming back to the app while its page is still alive: a tab switch, the app brought back from the
 * background, a page restored from the back-forward cache) and a deep link (a notification, Spotify's way back): no
 * cinematic, Mind's light breathes out once (400 ms; 150 ms with Reduce Motion). "reboot" (said or typed) and
 * SYSTEM → REBOOT HIM play it again.
 * Sound: a low hum rising to a soft chord, made here with WebAudio (no file), quiet, only with the voice setting on,
 * only where the phone allows sound (never on a resume). The greeting is spoken in his voice with the voice
 * setting on: at once if the phone allows it, else on the first tap (iOS keeps a cold open silent until a tap).
 * Automated checks see none of it (it would slow every check that opens the app) unless one asks: tests/boot.spec.mjs.
 */
import { h } from '../core/dom';
import { BOOT_DONE, currentMind, mindFor, webglWorks, type BootLook, type Mind } from '../features/core/mind';
import { settings, ui } from '../state/app';

type Kind = 'full' | 'short' | 'still' | 'flat' | 'warm' | 'quiet';
type Phase = 'point' | 'gather' | 'sphere' | 'name' | 'greeting' | 'land' | 'done';
type Timeline = Record<Exclude<Phase, 'done'> | 'end', number>;

/** When each moment starts, in ms from the first frame: the storyboard's timing (mockups/boot/contact.png). */
const FULL: Timeline = { point: 0, gather: 400, sphere: 1400, name: 2200, greeting: 2800, land: 3200, end: 3500 };
/** A slow phone or a late Mind: no drift and no push-in; the whole Mind fades in, and it lands sooner. */
const SHORT: Timeline = { point: 0, gather: 400, sphere: 400, name: 900, greeting: 1500, land: 1900, end: 2200 };
/** Reduce Motion: the frames fade, nothing moves. */
const STILL: Timeline = { point: 0, gather: 200, sphere: 200, name: 500, greeting: 800, land: 1000, end: 1200 };
/** No 3-D here: the point of light, the name from its particles, the greeting, then Home's own hero. */
const FLAT: Timeline = { point: 0, gather: 400, sphere: 400, name: 400, greeting: 1000, land: 1400, end: 1700 };
const LINES: Record<'full' | 'short' | 'still' | 'flat', Timeline> = { full: FULL, short: SHORT, still: STILL, flat: FLAT };
const PHASES: Exclude<Phase, 'done'>[] = ['point', 'gather', 'sphere', 'name', 'greeting', 'land'];
/** The cinematic's own part is over this long after its first frame, whatever happens. */
const CAP = 3500;
/** Mind (three.js) must be drawing by then for the full version, and by SHORT_BY for the short one. */
const FULL_BY = 900;
const SHORT_BY = 1700;

/** What happened, for tests/boot.spec.mjs and the console (window.__bootState; __ghosty.boot once that exists). */
export const bootState = {
  kind: '' as Kind | '',
  phase: '' as Phase | '',
  /** When each phase began, in ms after the first frame. */
  marks: {} as Record<string, number>,
  /** From the page starting to the cinematic's first frame, ms. */
  firstFrame: 0,
  /** When the app underneath was ready, and when the cinematic ended, in ms after its first frame (-1: not yet). */
  appReady: -1,
  ended: -1,
  skipped: false,
  frames: 0,
  /** The longest gap between two of its frames, ms. */
  worstGap: 0,
  /** What one full draw of Mind cost when it decided which version to play, ms (after a first draw that warms it up). */
  drawMs: -1,
  /** How long it held before landing, waiting for the app underneath and Home's hero, ms. */
  held: 0,
  /** Whether Mind (three.js) drew it. */
  mind: false,
  /** Whether the hum played (the voice setting on and the phone allowing sound). */
  sound: false,
  greeting: '',
  /** How the greeting was spoken: at once, on the first tap, or not (voice off, or no tap came). */
  spoken: '' as '' | 'now' | 'tap' | 'waiting' | 'off',
  /** Where the sphere was on its last frame in the air, and Home's hero box, as [x, y, width, height]. */
  landed: null as null | { flight: number[]; hero: number[] },
  /** Resumes (and deep links) answered with a breath of Mind's light. */
  warm: 0,
  /** How many times it has played since the page opened (a reboot adds one). */
  plays: 0,
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k);
const easeOut = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const easeInOut = (k: number) => {
  const x = clamp(k);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
type Flags = { __ghostyBoot?: boolean; __ghostyBootKind?: Kind; __ghostyBootManual?: boolean; __bootSeek?: (ms: number) => void; __bootState?: typeof bootState; __ghosty?: Record<string, unknown> };
const flags = () => window as unknown as Flags;

/** "Good evening, Boss." from the clock and the name in Settings (Boss when there is none). */
export function greetingLine(d = new Date()): string {
  const hr = d.getHours();
  const part = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${settings.get().name.trim() || 'Boss'}.`;
}

// ---------------------------------------------------------------- the app underneath
let appIsReady = false;
let started = 0;
/** The app could not start: the cinematic stops where it is and the fault's words stay. */
let faulted = false;

/** main.ts: the app is up underneath (the first screen is open and the frame loop runs). */
export function bootReady(): void {
  appIsReady = true;
  if (started) bootState.appReady = Math.round(performance.now() - started);
  // a plain open: the black layer goes as soon as the app is there
  const el = document.getElementById('boot');
  if (el && (bootState.kind === 'quiet' || bootState.kind === 'warm' || !bootState.kind)) {
    el.classList.add('out');
    setTimeout(() => el.remove(), bootState.kind === 'warm' ? 200 : 300);
    if (bootState.kind === 'warm') breatheWhenReady();
    watchReturns();
  }
}

/** main.ts: the app could not start. Plain words and a way out; nothing technical, no numbers. */
export function bootFault(): void {
  faulted = true;
  document.body.classList.remove('booting', 'bootland');
  const el = document.getElementById('boot') ?? document.body.appendChild(h('div#boot'));
  el.classList.remove('out');
  el.classList.add('fault');
  el.replaceChildren(h('div.bfault', h('p', 'Ghosty couldn’t start this time.'), h('button.on', { type: 'button', onclick: () => location.reload() }, 'TRY AGAIN')));
}

/** The very start of main.ts's boot: decide what this open shows, and start it. */
export function startBoot(): void {
  const f = flags();
  f.__bootState = bootState;
  const el = document.getElementById('boot') ?? document.body.appendChild(h('div#boot'));
  const automated = navigator.webdriver && !f.__ghostyBoot;
  const hash = location.hash.slice(1);
  // never over a notification he tapped, a deep link or the way back from Spotify's sign-in: those open their screen
  const toHome = (!hash || hash === 'core') && !/[?&]code=/.test(location.search);
  // every cold open plays it (the page is new: nothing of the app was running); a resume never reaches here
  let kind: Kind = automated ? 'quiet' : !toHome ? 'warm' : reduced() ? 'still' : 'full';
  // a check may pick which version plays (software WebGL is too slow for the full one to choose itself)
  if (f.__ghostyBoot && f.__ghostyBootKind && kind !== 'quiet' && kind !== 'warm') kind = f.__ghostyBootKind;
  bootState.kind = kind;
  el.classList.add(kind);
  if (kind === 'quiet' || kind === 'warm') return;
  play(el, kind, false);
}

/** "reboot" and SYSTEM → REBOOT HIM: Home, then the whole cinematic again over it. */
export async function reboot(): Promise<void> {
  if (document.getElementById('boot')) return;
  const { go } = await import('./tabs');
  go('core');
  // let Home lay out first, so the landing has its hero to land on
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = document.body.appendChild(h('div#boot'));
  const kind: Kind = reduced() ? 'still' : 'full';
  bootState.kind = kind;
  el.classList.add(kind);
  play(el, kind, true);
}

// ---------------------------------------------------------------- the resume
let watching = false;
function watchReturns(): void {
  if (watching) return;
  watching = true;
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 3000 && !document.getElementById('boot')) breatheWhenReady();
  });
  // a page the browser kept whole and showed again (the back-forward cache): the same page life, so a resume
  addEventListener('pageshow', (e) => {
    if (e.persisted && !document.getElementById('boot')) breatheWhenReady();
  });
}
/** Mind's light breathes out once behind whatever is on screen (when Mind is there to breathe). */
function breatheWhenReady(): void {
  let n = 0;
  const tryIt = () => {
    const m = currentMind();
    if (m?.active && !m.booting) {
      m.breathe(reduced() ? 0.15 : 0.4);
      bootState.warm++;
    } else if (++n < 40) setTimeout(tryIt, 150);
  };
  tryIt();
}

// ---------------------------------------------------------------- sound: a low hum rising to a soft chord
function hum(): (() => void) | null {
  if (!settings.get().speak) return null;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  // a cold open has had no tap: the phone would refuse (and Safari says so); nothing is queued for later
  if (ua && !ua.hasBeenActive) return null;
  let a: AudioContext;
  try {
    a = new AudioContext();
  } catch {
    return null;
  }
  void a.resume().catch(() => undefined);
  const t = a.currentTime + 0.05;
  const out = a.createGain();
  out.gain.value = 0.5;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.linearRampToValueAtTime(900, t + 2.2);
  lp.connect(out).connect(a.destination);
  // the hum: two low tones a hair apart (a slow beat between them), rising a little as Mind wakes
  for (const [f, v] of [[55, 0.05], [55.6, 0.04], [110, 0.018]] as const) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.19, t + 2.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 1.4);
    g.gain.setValueAtTime(v, t + 2.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + 3.5);
  }
  // the chord as the name assembles: A, E, A, C sharp, soft attack, a long fall
  [220, 329.63, 440, 554.37].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    const at = t + 2.15 + i * 0.04;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.014, at + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.9);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 2);
  });
  bootState.sound = true;
  setTimeout(() => void a.close().catch(() => undefined), 4500);
  // skipped: the sound goes with it
  return () => {
    try {
      out.gain.setTargetAtTime(0, a.currentTime, 0.05);
    } catch {
      /* closed already */
    }
  };
}

// ---------------------------------------------------------------- the greeting, in his voice
function sayGreeting(text: string, cold: boolean): void {
  if (!settings.get().speak) {
    bootState.spoken = 'off';
    return;
  }
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  const say = () => void import('../assistant/voice').then((v) => v.speak(text)).catch(() => undefined);
  if (!cold || !ua || ua.hasBeenActive) {
    bootState.spoken = 'now';
    say();
    return;
  }
  // iOS keeps a cold open silent until a tap: the first tap says it (within the gesture, so the phone allows it),
  // unless that tap was on a control (he is doing something) or the sign-in form, or it comes much later
  bootState.spoken = 'waiting';
  const until = Date.now() + 30_000;
  const onTap = (e: PointerEvent) => {
    removeEventListener('pointerup', onTap, true);
    const tgt = e.target as Element | null;
    const busy = !!tgt?.closest?.('button, input, textarea, select, a, [role="button"], #pairform') && !tgt?.closest?.('#boot');
    if (Date.now() > until || busy || ui.get().voice !== 'idle') {
      bootState.spoken = 'off';
      return;
    }
    bootState.spoken = 'tap';
    say();
  };
  addEventListener('pointerup', onTap, true);
}

// ---------------------------------------------------------------- the cinematic
interface Particle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  d: number;
  c: number;
}

function play(el: HTMLElement, first: Kind, rebooting: boolean): void {
  bootState.plays++;
  bootState.marks = {};
  bootState.phase = '';
  bootState.ended = -1;
  bootState.skipped = false;
  bootState.landed = null;
  bootState.frames = 0;
  bootState.worstGap = 0;
  bootState.held = 0;
  if (rebooting) appIsReady = true;
  let kind = first as 'full' | 'short' | 'still' | 'flat';
  let tl = LINES[kind];
  const vw = innerWidth;
  const vh = innerHeight;
  // the stage: Mind in a square box a little above the middle, the name and the greeting under it
  const side = Math.round(Math.min(vw * 0.8, vh * 0.42, 380));
  const box = { x: Math.round((vw - side) / 2), y: Math.round(vh * 0.4 - side / 2), w: side, h: side };
  const cx = box.x + side / 2;
  const cy = box.y + side / 2;
  const dot = el.querySelector<HTMLElement>('.bdot') ?? el.appendChild(h('i.bdot'));
  dot.style.left = `${cx}px`;
  dot.style.top = `${cy}px`;
  const veil = h('div.bveil');
  el.prepend(veil);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const dust = h('canvas.bdust', { width: Math.round(vw * dpr), height: Math.round(vh * dpr), 'aria-hidden': 'true' });
  const letters = [...'GHOSTY'].map((c) => h('span', c));
  const word = h('h1.bword', { 'aria-label': 'Ghosty' }, ...letters);
  const greet = h('p.bgreet', greetingLine());
  bootState.greeting = greet.textContent ?? '';
  word.style.top = `${box.y + side + Math.round(side * 0.1)}px`;
  greet.style.top = `${box.y + side + Math.round(side * 0.1) + 58}px`;
  el.append(dust, word, greet);
  el.classList.add('playing');
  document.body.classList.add('booting');

  // Mind: the one the hero will use (woken here, or taken from the hero on a reboot)
  let mind: Mind | null = null;
  let mindState: 'wait' | 'ready' | 'none' = 'none';
  if (kind !== 'flat' && webglWorks()) {
    mind = mindFor(null);
    mindState = mind.active ? 'ready' : 'wait';
    if (!mind.active)
      void mind.start().then((ok) => {
        if (mindState === 'wait') mindState = ok ? 'ready' : 'none';
      });
  }
  if (!mind) kind = 'flat';
  let mindIn = false;
  const takeMind = () => {
    if (!mind || mindIn) return;
    mindIn = true;
    bootState.mind = true;
    mind.bootBegin(el, side, side);
    const c = mind.canvas;
    Object.assign(c.style, { position: 'fixed', left: `${box.x}px`, top: `${box.y}px`, transformOrigin: '0 0', opacity: '0', zIndex: '1' });
  };

  const stopSound = hum();
  let said = false;

  // ---- the name's particles: each letter drawn where the real word sits, sampled into points of light
  let parts: Particle[] = [];
  const sample = () => {
    const pts: Particle[] = [];
    const cs = getComputedStyle(word);
    const off = document.createElement('canvas');
    off.width = Math.ceil(vw);
    off.height = 120;
    const g = off.getContext('2d', { willReadFrequently: true });
    if (!g) return pts;
    const wr = word.getBoundingClientRect();
    g.fillStyle = '#fff';
    g.textBaseline = 'alphabetic';
    g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const base = 20;
    // each letter's baseline where the page puts it: its box's top plus the font's ascent
    const m = g.measureText('G');
    const asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.9;
    for (const s of letters) {
      const r = s.getBoundingClientRect();
      g.fillText(s.textContent ?? '', r.left, base + (r.top - wr.top) + asc);
    }
    const img = g.getImageData(0, 0, off.width, off.height).data;
    const step = 3;
    for (let y = 0; y < off.height; y += step)
      for (let x = 0; x < off.width; x += step) {
        if (img[(y * off.width + x) * 4 + 3]! < 128) continue;
        const r1 = Math.random();
        const r2 = Math.random();
        // from the sphere (its constellation lends them), or from the point of light with no 3-D
        const a = r1 * Math.PI * 2;
        const rad = kind === 'flat' ? 6 * r2 : side * 0.32 * Math.sqrt(r2);
        pts.push({ x0: cx + Math.cos(a) * rad, y0: cy + Math.sin(a) * rad, x1: x, y1: wr.top - base + y, d: Math.random() * 140, c: Math.random() });
      }
    return pts.length > 900 ? pts.filter((_, i) => i % Math.ceil(pts.length / 900) === 0) : pts;
  };
  const dctx = dust.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--c').trim() || '#64d2ff';

  // ---- the clock: timeline ms (T) runs with real time, held while Mind loads (the point keeps breathing) and before the
  // landing until the app is up; after a hold it runs faster so its own part still ends 3.5 s after the first frame.
  // It never falls behind the wall clock: on a phone whose frames come late it skips ahead (shorter, never slower).
  let t0 = 0;
  let last = 0;
  let T = 0;
  let rate = 1;
  /** Where the pace was last set: from this moment (ms after the first frame) T runs from paceT at `rate`. */
  let paceE = 0;
  let paceT = 0;
  let decided = kind === 'flat';
  let gaps = 0;
  let gapSum = 0;
  let heroWait = 0;
  let quietHold = false;
  let done = false;
  const elapsed = (now: number) => now - t0;
  const enter = (p: Phase, at: number) => {
    if (bootState.marks[p] !== undefined) return;
    // a skip jumps to the landing: what it skipped never happened
    if (bootState.skipped && p !== 'land' && p !== 'done' && p !== 'point') return;
    bootState.marks[p] = Math.round(at);
    bootState.phase = p;
    if (p === 'land') document.body.classList.add('bootland');
    if (p === 'greeting' && !said) {
      said = true;
      // skipped before it showed: he wants Home, not a greeting
      if (bootState.skipped) bootState.spoken = 'off';
      else sayGreeting(greet.textContent ?? '', !rebooting);
    }
  };
  // Home's hero, once its reactor canvas has taken this Mind (the first frame of Home's loop)
  const heroRect = (): DOMRect | null => {
    if (!mind || ui.get().tab !== 'core') return null;
    const a = mind.hero;
    const r = a?.isConnected ? a.getBoundingClientRect() : null;
    return r && r.width > 20 && r.height > 20 ? r : null;
  };
  const decide = (now: number) => {
    // where Mind stands decides the version; the late phone gets the short one, no 3-D gets the flat one
    const e = elapsed(now);
    const slow = gaps >= 4 && gapSum / gaps > 22;
    const forced = !!flags().__ghostyBootKind;
    if (mindState === 'ready') {
      if (kind === 'full' && (slow || e > FULL_BY || bootState.firstFrame > 2500) && !forced) kind = e > SHORT_BY ? 'flat' : 'short';
      else if (kind === 'full' && mind) {
        // one draw to warm it up (its shaders), one to time: a phone that cannot draw MIND inside a 60 Hz frame gets
        // the short version (no drift, no push-in) rather than a cinematic that stutters
        takeMind();
        mind.bootFrame(e / 1000, BOOT_DONE);
        const t1 = performance.now();
        mind.bootFrame(e / 1000, BOOT_DONE);
        bootState.drawMs = Math.round((performance.now() - t1) * 10) / 10;
        if (bootState.drawMs > 16 && !forced) kind = 'short';
      }
    } else if (mindState === 'none' || e > SHORT_BY) kind = 'flat';
    else return false;
    tl = LINES[kind];
    bootState.kind = kind;
    el.classList.remove('full', 'short', 'still', 'flat');
    el.classList.add(kind);
    if (kind !== 'flat') takeMind();
    // whatever was waited, its own part still ends by 3.5 s
    const left = tl.end - tl.gather;
    rate = Math.max(1, left / Math.max(300, CAP - e - 1));
    paceE = e;
    paceT = tl.gather;
    decided = true;
    return true;
  };

  const finish = () => {
    if (done) return;
    done = true;
    const now = performance.now();
    enter('done', elapsed(now));
    bootState.ended = Math.round(elapsed(now));
    stopSound?.();
    if (mindIn && mind) {
      const flight = mind.canvas.getBoundingClientRect();
      const hr = heroRect();
      bootState.landed = { flight: [flight.x, flight.y, flight.width, flight.height].map((v) => Math.round(v * 10) / 10), hero: hr ? [hr.x, hr.y, hr.width, hr.height].map((v) => Math.round(v * 10) / 10) : [] };
      mind.bootEnd();
      if (kind === 'still' && mind.canvas.isConnected) mind.canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      document.body.classList.remove('booting');
    }, 40);
    setTimeout(() => document.body.classList.remove('bootland'), 900);
    watchReturns();
  };

  // a tap skips it: straight to the landing when the app is up (quickly), else to a quiet wait for it
  const skip = (e: Event) => {
    e.preventDefault();
    if (done || bootState.skipped) return;
    bootState.skipped = true;
    // no more words; if the app is not up yet, Mind turns quietly until it is
    quietHold = true;
    if (!said) bootState.spoken = 'off';
    said = true;
    stopSound?.();
    const now = performance.now();
    if (!decided) {
      // Mind still loading: it is not waited for (Home shows it when it is ready)
      if (mindState !== 'ready') mindState = 'none';
      decide(now);
    }
    if (T < tl.land) {
      T = tl.land - 1;
      rate = 2;
      paceE = elapsed(now);
      paceT = T;
    }
  };
  el.addEventListener('pointerdown', skip);

  const render = (now: number) => {
    const e = elapsed(now);
    // Reduce Motion: nothing moves (with or without 3-D)
    const calm = kind === 'still' || (kind === 'flat' && reduced());
    const seg = (a: number, b: number) => clamp((T - a) / (b - a));
    // 1. the point of light: breathes once, then gives way to Mind's own nucleus (or, with no 3-D, to the name)
    const held = !decided && T >= tl.gather - 1;
    const breathe = held ? 1 + 0.12 * Math.sin(((e - tl.gather) / 1600) * Math.PI * 2) : 1 + 0.55 * Math.sin(Math.PI * clamp(T / 400));
    const dotOn = kind === 'flat' ? 1 - seg(tl.name + 60, tl.name + 260) : 1 - seg(tl.gather, tl.gather + 160);
    dot.style.opacity = String(Math.min(1, 0.25 + 0.75 * clamp(T / 180)) * dotOn * (1 - seg(tl.land, tl.land + 150)));
    dot.style.transform = `translate(-50%, -50%) scale(${(calm ? 1 : breathe).toFixed(3)})`;
    // 2–3. Mind
    if (mindIn && mind) {
      let look: BootLook = BOOT_DONE;
      let fade = 1;
      if (kind === 'full') {
        look = {
          gather: seg(tl.gather, tl.sphere),
          links: seg(tl.gather + 600, tl.sphere + 50),
          sphere: easeInOut(seg(tl.sphere, tl.sphere + 500)),
          scale: seg(tl.sphere + 300, tl.name),
          core: 1,
          turn: -0.35 * (1 - easeInOut(seg(tl.sphere, tl.name))),
          push: 1 + 0.4 * (1 - easeInOut(seg(tl.gather, tl.name))),
          sweep: T >= tl.gather + 400 && T <= tl.gather + 900 ? 1.1 - 2.2 * seg(tl.gather + 400, tl.gather + 900) : NaN,
        };
        fade = seg(tl.gather, tl.gather + 120);
      } else fade = easeOut(seg(tl.sphere, tl.sphere + (kind === 'still' ? 300 : 450)));
      const c = mind.canvas;
      // 6. the flight: from the stage up into the hero's box (the same canvas; it is Home's from the landing on)
      const hr = T >= tl.land ? heroRect() : null;
      if (hr && kind !== 'still') {
        const k = easeInOut(seg(tl.land, tl.end));
        const s = 1 + (hr.width / side - 1) * k;
        c.style.transform = `translate(${((hr.left - box.x) * k).toFixed(2)}px, ${((hr.top - box.y) * k).toFixed(2)}px) scale(${s.toFixed(4)})`;
      } else if (kind === 'still') fade *= 1 - seg(tl.land, tl.end);
      c.style.opacity = fade.toFixed(3);
      mind.bootFrame(e / 1000, look);
    }
    // 4. the name: particles fly from the sphere into the letters, the letters come up crisp, the particles go
    const N = tl.name;
    if (T >= N && !parts.length && !calm) parts = sample();
    const wordOn = calm ? seg(N, N + 300) : seg(N + 350, N + 600);
    const textsOut = (1 - seg(tl.land, tl.land + 150)) * (quietHold ? 0 : 1);
    word.style.opacity = (wordOn * textsOut).toFixed(3);
    if (dctx) {
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.clearRect(0, 0, dust.width, dust.height);
      const fadeDust = 1 - seg(N + 400, N + 650);
      if (parts.length && fadeDust > 0 && T >= N) {
        dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dctx.globalCompositeOperation = 'lighter';
        dctx.fillStyle = accent;
        for (const p of parts) {
          const k = easeOut((T - N - p.d) / 330);
          if (k <= 0) continue;
          // a slight curve on the way, as if drawn out of the sphere
          const bend = Math.sin(k * Math.PI) * (p.c - 0.5) * 30;
          const x = p.x0 + (p.x1 - p.x0) * k + bend;
          const y = p.y0 + (p.y1 - p.y0) * k;
          dctx.globalAlpha = Math.min(1, 0.35 + k) * fadeDust * (0.55 + 0.45 * p.c);
          const sz = k > 0.98 ? 1.6 : 1.2 + p.c;
          dctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
        dctx.globalAlpha = 1;
      }
    }
    // 5. the greeting
    const gOn = seg(tl.greeting, tl.greeting + 300);
    greet.style.opacity = (gOn * textsOut).toFixed(3);
    greet.style.transform = `translate(-50%, ${calm ? 0 : ((1 - easeOut(gOn)) * 8).toFixed(2)}px)`;
    // 6. the black goes and Home is there
    veil.style.opacity = (1 - easeInOut(seg(tl.land, tl.end))).toFixed(3);
  };

  const step = (now: number) => {
    if (done || faulted) return;
    if (!t0) {
      t0 = now;
      last = now;
      started = performance.now();
      bootState.firstFrame = Math.round(performance.now());
      if (appIsReady && bootState.appReady < 0) bootState.appReady = 0;
      enter('point', 0);
    }
    // a long gap is not made up in one jump (no stutter), but the end still comes on time (the rate after a hold)
    const gap = now - last;
    const dt = Math.min(250, gap);
    if (now > last) {
      bootState.worstGap = Math.max(bootState.worstGap, Math.round(now - last));
      if (T < tl.gather) {
        gaps++;
        gapSum += now - last;
      }
    }
    last = now;
    bootState.frames++;
    if (!flags().__ghostyBootManual) advance(now, dt, gap);
    render(now);
    if (T >= tl.end) return finish();
    requestAnimationFrame(step);
  };

  const advance = (now: number, dt: number, gap: number) => {
    const e = elapsed(now);
    let next = Math.max(T + dt * rate, paceT + (e - paceE) * rate);
    // the point of light holds until Mind is drawing (or it is clear it won't be in time)
    if (!decided && next >= tl.gather && !decide(now)) next = tl.gather - 1;
    // the landing waits for the app underneath and for Home's hero; after 3.5 s the words go and Mind turns quietly
    if (next >= tl.land && T < tl.land + 1) {
      const ready = appIsReady && (!mindIn || !!heroRect() || heroWait > 1500);
      if (!ready) {
        if (appIsReady) heroWait += gap;
        bootState.held += Math.round(gap);
        next = tl.land - 1;
        if (e > CAP) quietHold = true;
        // the landing then runs from the moment the app is there
        paceE = e;
        paceT = next;
        if (!bootState.skipped) rate = 1;
      }
    }
    for (const p of PHASES) if (next >= tl[p]) enter(p, e);
    T = next;
  };

  // a test steps the cinematic by hand to photograph each moment (tests/boot.spec.mjs)
  if (flags().__ghostyBootManual)
    flags().__bootSeek = (ms: number) => {
      const now = performance.now();
      if (!t0) step(now);
      if (!decided) decide(now);
      T = Math.min(ms, tl.end);
      for (const p of PHASES) if (T >= tl[p]) enter(p, T);
      render(now);
    };

  requestAnimationFrame(step);
}
