/**
 * The boot cinematic (docs/build-plan/BRIEF-BOOT.md, BRIEF-BOOT2.md; OWNER-ISSUES 43 and 45, his words: "really cinematic
 * and cool", "forget giving facts", "it's not an arc reactor anymore", then "on every boot up and just a bit cooler").
 * MIND waking up, a vast quiet intelligence, about 3.9 s, on every cold open (a launch from the Home Screen, a fresh tab):
 *   1. true black; one point of light, far away, breathing once                                         0 – 450 ms
 *   2. it splits into a drift of particles that gather into the constellation, each leaving a faint trail
 *      that fades; links light as they settle; the camera pushes in slowly through three depths of light
 *      (far dust, the constellation, a few near motes streaming past), so the push feels three-dimensional;
 *      one thin sweep of light passes down through it and refracts as it crosses the equator          450 – 1,500 ms
 *   3. the sphere resolves from the inside out: the haze, then the meridians catching the light one after
 *      another, the latitudes, the rim last; it turns a few degrees; the equator scale lights round   1,500 – 2,400 ms
 *   4. G H O S T Y assembles from particles, a little wide, then one last tightening; a single thin line
 *      draws itself under it, from the middle out (the instruments' light: svg.inst .fl)            2,400 – 3,050 ms
 *   5. one line, his, with a breath of bloom: "Good evening, <name>." (the name from Settings)       3,050 – 3,500 ms
 *   6. the sphere eases up into Home's hero, where it lives from then on (the same Mind, never a copy); a beat
 *      after it lands, the HUD slides in (the ribbon, the tab bar, Home's cards)                      3,500 – 3,900 ms
 * No readouts, no numbers, no status line. It never delays the app: main.ts keeps booting underneath and calls
 * bootReady(); the cinematic lands when both are done, and its own part is over 3.9 s after its first frame (if the app
 * is still starting then, Mind keeps turning quietly, with no words, until it is). A tap skips it, at any moment.
 * Every frame is held to a budget (a long frame: over 12 ms at 120 Hz, over 20 ms at 60): long frames are counted in
 * __bootState.budget, and a phone that cannot keep up gets less: the short version (no drift, no push-in) when even the
 * point of light stutters or one draw of Mind overruns a frame, or, mid-flight, the lean cut (the depths, the trails and
 * the refraction dropped, the rest quickened) once a quarter of the recent frames ran long. With no 3-D at all: the point
 * of light, the name and the greeting. Reduce Motion: the frames fade, nothing moves, 1.2 s.
 * Coming back to a running app (a tab switch, the app resumed in the same page life, a page restored from the back-forward
 * cache) and a deep link (a notification, Spotify's way back): no cinematic; Mind's light breathes out once (400 ms;
 * 150 ms with Reduce Motion). "reboot" (said or typed) and SYSTEM → REBOOT HIM play it again.
 * Sound: a low hum rising to a soft chord, made here with WebAudio (no file), quiet, only with the voice setting on,
 * only where the phone allows sound (never on a resume). The greeting is spoken in his voice with the voice setting on:
 * at once if the phone allows it, else on the first tap (iOS keeps a cold open silent until a tap); once.
 * Automated checks see none of it (it would slow every check that opens the app) unless one asks: tests/boot.spec.mjs.
 */
import { h, svgEl } from '../core/dom';
import { BOOT_DONE, currentMind, mindFor, webglWorks, type BootLook, type Mind } from '../features/core/mind';
import { settings, ui } from '../state/app';
import { ensureDefs } from '../ui/instruments';

type Kind = 'full' | 'short' | 'still' | 'flat' | 'warm' | 'quiet';
type Phase = 'point' | 'gather' | 'sphere' | 'name' | 'greeting' | 'land' | 'done';
type Timeline = Record<Exclude<Phase, 'done'> | 'end', number>;

/** When each moment starts, in ms from the first frame: the storyboard's timing (BRIEF-BOOT.md, the richer cut). */
const FULL: Timeline = { point: 0, gather: 450, sphere: 1500, name: 2400, greeting: 3050, land: 3500, end: 3900 };
/** A slow phone or a late Mind: no drift and no push-in; the whole Mind fades in, and it lands sooner. */
const SHORT: Timeline = { point: 0, gather: 400, sphere: 400, name: 900, greeting: 1500, land: 1900, end: 2200 };
/** Reduce Motion: the frames fade, nothing moves. */
const STILL: Timeline = { point: 0, gather: 200, sphere: 200, name: 500, greeting: 800, land: 1000, end: 1200 };
/** No 3-D here: the point of light, the name from its particles, the greeting, then Home's own hero. */
const FLAT: Timeline = { point: 0, gather: 400, sphere: 400, name: 400, greeting: 1000, land: 1400, end: 1700 };
const LINES: Record<'full' | 'short' | 'still' | 'flat', Timeline> = { full: FULL, short: SHORT, still: STILL, flat: FLAT };
const PHASES: Exclude<Phase, 'done'>[] = ['point', 'gather', 'sphere', 'name', 'greeting', 'land'];
/** The cinematic's own part is over this long after its first frame, whatever happens. */
const CAP = FULL.end;
/** A beat between Mind landing in the hero and the HUD sliding in round it, ms. */
const BEAT = 110;
/** A long frame, ms: over 12 at 120 Hz, over 20 at 60 (the frame and a half that the eye reads as a stutter). */
const LONG_120 = 12;
const LONG_60 = 20;
/** Mid-flight: this many long frames among the last WINDOW, and the full cut leans (its extras go, the rest quickens). */
const WINDOW = 24;
const LEAN_AT = 6;
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
  /**
   * The frame budget: the display's rate as its frames show it (120 or 60; 0 before three gaps), what a long frame is
   * here (ms), how many came, the gaps themselves (ms, the first 600), the most and the mean one frame's own work took
   * (ms: Mind's draw, the particles and the depths, not the app booting underneath), and where the full cut leaned because the
   * phone could not keep up ('' if it never did).
   */
  budget: { hz: 0, ms: LONG_60, long: 0, gaps: [] as number[], work: 0, avg: 0, lean: '' as Phase | '' },
  /** The cut that played (when each phase starts, ms), and the pace it ran at from the gathering on (1: real time;
   *  more after Mind was waited for, or once it leaned), for the timings the check compares against. */
  timeline: null as Timeline | null,
  pace: 1,
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
  /** How many times the greeting was handed to his voice (once at most). */
  said: 0,
  /** When the HUD began to slide in, ms after the first frame (a beat after Mind landed; -1: not yet). */
  hudAt: -1,
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
type Flags = { __ghostyBoot?: boolean; __ghostyBootKind?: Kind; __ghostyBootLean?: boolean; __ghostyBootManual?: boolean; __bootSeek?: (ms: number) => void; __bootState?: typeof bootState; __ghosty?: Record<string, unknown> };
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
  document.body.classList.remove('booting', 'bootland', 'bootwait');
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
  lp.frequency.linearRampToValueAtTime(900, t + FULL.name / 1000);
  lp.connect(out).connect(a.destination);
  // the hum: two low tones a hair apart (a slow beat between them), rising a little as Mind wakes
  for (const [f, v] of [[55, 0.05], [55.6, 0.04], [110, 0.018]] as const) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.19, t + FULL.name / 1000);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + FULL.sphere / 1000);
    g.gain.setValueAtTime(v, t + FULL.name / 1000 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + FULL.end / 1000 - 0.1);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + FULL.end / 1000);
  }
  // the chord as the name assembles: A, E, A, C sharp, soft attack, a long fall
  [220, 329.63, 440, 554.37].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    const at = t + FULL.name / 1000 - 0.05 + i * 0.04;
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
  setTimeout(() => void a.close().catch(() => undefined), FULL.end + 1000);
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
  const say = () => {
    bootState.said++;
    void import('../assistant/voice').then((v) => v.speak(text)).catch(() => undefined);
  };
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
/** A mote of light in one of the depths round Mind: where it lives (in sphere radii, z towards the camera), its size
 *  (px at the sphere's distance), its brightness and a seed for its drift and shimmer. */
interface Mote {
  x: number;
  y: number;
  z: number;
  s: number;
  a: number;
  v: number;
}
/** The depths round Mind (seeded: the same sky every open): far dust well behind it, a few near motes in front of it. */
function depthMotes(): { far: Mote[]; near: Mote[] } {
  let seed = 7;
  const r = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const far = Array.from({ length: 170 }, () => ({ x: (r() * 2 - 1) * 5.5, y: (r() * 2 - 1) * 9.5, z: -3.5 - r() * 6, s: 1.3 + r() * 2.2, a: 0.25 + r() * 0.6, v: r() }));
  const near = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3;
    const d = 1.3 + r() * 1.1;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 1.6, z: 1.4 + r() * 2.2, s: 5 + r() * 6, a: 0.12 + r() * 0.2, v: r() };
  });
  return { far, near };
}
/** Mind's camera (mind.ts size(): a 30° view that fills 74 % of a square box with the sphere), so the depths drawn here
 *  move with the same push as the constellation drawn there. */
const TAN15 = Math.tan((15 * Math.PI) / 180);
const CAMZ = 1 / (TAN15 * 0.74);

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
  bootState.said = 0;
  bootState.hudAt = -1;
  bootState.pace = 1;
  bootState.budget = { hz: 0, ms: LONG_60, long: 0, gaps: [], work: 0, avg: 0, lean: '' };
  const B = bootState.budget;
  if (rebooting) appIsReady = true;
  let kind = first as 'full' | 'short' | 'still' | 'flat';
  let tl = LINES[kind];
  bootState.timeline = tl;
  const vw = innerWidth;
  const vh = innerHeight;
  // the stage: Mind in a square box a little above the middle, the name, its line and the greeting under it
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
  const wordTop = box.y + side + Math.round(side * 0.1);
  word.style.top = `${wordTop}px`;
  greet.style.top = `${wordTop + 66}px`;
  // the greeting's breath of bloom: a soft light behind the line
  const bloom = h('i.bbloom');
  bloom.style.top = `${wordTop + 81}px`;
  el.append(dust, word, bloom, greet);
  // the single thin line under the name, in the instruments' own light (svg.inst .fl, its glow; .ln end stops). A bar
  // of light, not a stroked path: a filter on a box with no height (a level line) would draw nothing at all
  ensureDefs();
  const lw = Math.round(Math.min(vw - 64, word.getBoundingClientRect().width * 0.84));
  const rule = svgEl('rect', { class: 'fl', x: 0, y: 3.4, width: lw, height: 1.2, rx: 0.6 });
  const stops = svgEl('path', { class: 'ln', d: `M0.5 0.5V7.5M${lw - 0.5} 0.5V7.5` });
  const line = svgEl('svg', { class: 'inst bline', viewBox: `0 0 ${lw} 8`, width: lw, height: 8, 'aria-hidden': 'true', focusable: 'false' });
  line.append(rule, stops);
  line.style.top = `${wordTop + 42}px`;
  el.append(line);
  el.classList.add('playing');
  document.body.classList.add('booting');
  const cs0 = getComputedStyle(document.documentElement);
  const accent = cs0.getPropertyValue('--c').trim() || '#64d2ff';
  const cr = cs0.getPropertyValue('--cr').trim() || '100, 210, 255';

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
  /** The word's middle, and each letter's middle from it (px): the last tightening draws them in towards it. */
  let wcx = cx;
  let offs: number[] = [];
  const sample = () => {
    const pts: Particle[] = [];
    const cs = getComputedStyle(word);
    const off = document.createElement('canvas');
    off.width = Math.ceil(vw);
    off.height = 120;
    const g = off.getContext('2d', { willReadFrequently: true });
    if (!g) return pts;
    const wr = word.getBoundingClientRect();
    wcx = wr.left + wr.width / 2;
    offs = letters.map((s) => {
      const r = s.getBoundingClientRect();
      return r.left + r.width / 2 - wcx;
    });
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

  // ---- the depths (the full cut only): a soft round mote in his colour, drawn many times
  const motes = depthMotes();
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  {
    const g = sprite.getContext('2d');
    if (g) {
      const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.25, `rgba(${cr}, .7)`);
      grd.addColorStop(0.6, `rgba(${cr}, .12)`);
      grd.addColorStop(1, `rgba(${cr}, 0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, 32, 32);
    }
  }

  // ---- the clock: timeline ms (T) runs with real time, held while Mind loads (the point keeps breathing) and before the
  // landing until the app is up; after a hold it runs faster so its own part still ends 3.9 s after the first frame.
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
  /** The frame budget: gaps quicker than a 60 Hz frame (two say the display runs at 120), the last WINDOW frames' long
   *  ones (counted from the moment Mind takes the stage), the work each frame took. */
  let quick = 0;
  let recent: number[] = [];
  let workSum = 0;
  /** The lean cut: the phone could not keep up mid-flight, so the depths, the trails and the refraction go. */
  let lean = false;
  // a check may pick the version (software WebGL is too slow for the full one to choose itself); then the cut holds
  // steady too, unless the check asks to see it lean
  const forced = () => !!flags().__ghostyBootKind;
  const steady = () => forced() && !flags().__ghostyBootLean;
  const elapsed = (now: number) => now - t0;
  const enter = (p: Phase, at: number) => {
    if (bootState.marks[p] !== undefined) return;
    // a skip jumps to the landing: what it skipped never happened
    if (bootState.skipped && p !== 'land' && p !== 'done' && p !== 'point') return;
    bootState.marks[p] = Math.round(at);
    bootState.phase = p;
    // the HUD waits out of sight while Mind flies; it slides in a beat after Mind lands (finish)
    if (p === 'land') document.body.classList.add('bootwait');
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
    // even the point of light stuttered (its frames came over a 60 Hz frame and a third apart, on average)
    const slow = gaps >= 4 && gapSum / gaps > 22;
    if (mindState === 'ready') {
      if (kind === 'full' && (slow || e > FULL_BY || bootState.firstFrame > 2500) && !forced()) kind = e > SHORT_BY ? 'flat' : 'short';
      else if (kind === 'full' && mind) {
        // one draw to warm it up (its shaders), one to time: a phone that cannot draw MIND inside one of its frames
        // gets the short version (no drift, no push-in) rather than a cinematic that stutters
        takeMind();
        mind.bootFrame(e / 1000, BOOT_DONE);
        const t1 = performance.now();
        mind.bootFrame(e / 1000, BOOT_DONE);
        bootState.drawMs = Math.round((performance.now() - t1) * 10) / 10;
        if (bootState.drawMs > (B.hz === 120 ? 1000 / 120 : 1000 / 60) && !forced()) kind = 'short';
      }
    } else if (mindState === 'none' || (e > SHORT_BY && !forced())) kind = 'flat';
    else return false;
    tl = LINES[kind];
    bootState.timeline = tl;
    bootState.kind = kind;
    el.classList.remove('full', 'short', 'still', 'flat');
    el.classList.add(kind);
    if (kind !== 'flat') takeMind();
    // whatever was waited, its own part still ends by 3.9 s
    const left = tl.end - tl.gather;
    rate = Math.max(1, left / Math.max(300, CAP - e - 1));
    paceE = e;
    paceT = tl.gather;
    bootState.pace = Math.round(rate * 1000) / 1000;
    decided = true;
    // from here the budget judges the cinematic's own frames (not the point's, which share the phone with the app starting)
    recent = [];
    return true;
  };

  /** The HUD (the ribbon, the tab bar, Home's cards) slides in, a beat after Mind has landed. */
  const hudIn = () => {
    document.body.classList.remove('bootwait');
    document.body.classList.add('bootland');
    bootState.hudAt = Math.round(elapsed(performance.now()));
    setTimeout(() => document.body.classList.remove('bootland'), 900);
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
    if (document.body.classList.contains('bootwait')) setTimeout(hudIn, kind === 'still' ? 0 : BEAT);
    watchReturns();
  };

  // a tap skips it, at any moment: straight to the landing when the app is up (quickly), else to a quiet wait for it
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

  /** The far dust and the near motes, projected through Mind's camera at this push: the push moves each depth at its
   *  own speed (the near ones stream out past the edges, the far ones barely move), which is what makes it 3-D. */
  const depths = (g: CanvasRenderingContext2D, push: number, seg: (a: number, b: number) => number) => {
    const farOn = seg(tl.gather, tl.gather + 700) * (1 - 0.35 * seg(tl.name, tl.greeting)) * (1 - seg(tl.land, tl.land + 300));
    const nearOn = seg(tl.gather + 50, tl.gather + 450) * (1 - seg(tl.sphere + 300, tl.name + 100));
    if (farOn <= 0 && nearOn <= 0) return;
    const D = CAMZ * push;
    const k = side / 2 / TAN15;
    const s = T / 1000;
    const draw = (m: Mote, on: number, x: number, y: number, near: boolean) => {
      const dz = D - m.z;
      if (dz < 0.6) return;
      const px = cx + (k * x) / dz;
      const py = cy - (k * y) / dz;
      const r = Math.min(48, (m.s * CAMZ) / dz);
      if (px < -r || px > vw + r || py < -r || py > vh + r) return;
      // far: a slow shimmer; near: out of focus, so the bigger it comes the fainter
      g.globalAlpha = on * m.a * (near ? Math.min(1, 14 / r) : 0.75 + 0.25 * Math.sin(s * 1.3 + m.v * 20));
      g.drawImage(sprite, px - r, py - r, 2 * r, 2 * r);
    };
    if (farOn > 0) for (const m of motes.far) draw(m, farOn, m.x + s * 0.05 * (0.4 + m.v), m.y, false);
    if (nearOn > 0) for (const m of motes.near) draw(m, nearOn, m.x, m.y + s * 0.1 * (0.5 + m.v), true);
    g.globalAlpha = 1;
  };

  const render = (now: number) => {
    const e = elapsed(now);
    // Reduce Motion: nothing moves (with or without 3-D)
    const calm = kind === 'still' || (kind === 'flat' && reduced());
    const seg = (a: number, b: number) => clamp((T - a) / (b - a));
    // 1. the point of light: breathes once, then gives way to Mind's own nucleus (or, with no 3-D, to the name)
    const held = !decided && T >= tl.gather - 1;
    const breathe = held ? 1 + 0.12 * Math.sin(((e - tl.gather) / 1600) * Math.PI * 2) : 1 + 0.55 * Math.sin(Math.PI * clamp(T / tl.gather));
    const dotOn = kind === 'flat' ? 1 - seg(tl.name + 60, tl.name + 260) : 1 - seg(tl.gather, tl.gather + 160);
    dot.style.opacity = String(Math.min(1, 0.25 + 0.75 * clamp(T / 180)) * dotOn * (1 - seg(tl.land, tl.land + 150)));
    dot.style.transform = `translate(-50%, -50%) scale(${(calm ? 1 : breathe).toFixed(3)})`;
    // 2–3. Mind
    const push = kind === 'full' ? 1 + 0.45 * (1 - easeInOut(seg(tl.gather, tl.name))) : 1;
    if (mindIn && mind) {
      let look: BootLook = BOOT_DONE;
      let fade = 1;
      if (kind === 'full') {
        look = {
          gather: seg(tl.gather, tl.sphere),
          links: seg(tl.gather + 600, tl.sphere + 50),
          // from the inside out: the haze, the meridians one after another, the latitudes and the tilted ring, the rim
          haze: easeOut(seg(tl.sphere - 150, tl.sphere + 250)),
          mer: seg(tl.sphere + 80, tl.sphere + 640),
          sphere: easeInOut(seg(tl.sphere + 250, tl.sphere + 650)),
          rim: easeInOut(seg(tl.sphere + 420, tl.sphere + 820)),
          scale: seg(tl.sphere + 300, tl.name),
          core: 1,
          turn: -0.35 * (1 - easeInOut(seg(tl.sphere, tl.name))),
          push,
          // the sweep: down through the gathering constellation once, crossing the equator half-way
          sweep: T >= tl.gather + 450 && T <= tl.gather + 1000 ? 1.1 - 2.2 * seg(tl.gather + 450, tl.gather + 1000) : NaN,
          trails: lean ? 0 : 1,
          refract: lean ? 0 : 1,
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
      // (stepped by hand, a check's photographs follow the cut's own clock, not the time the photographs take)
      mind.bootFrame((flags().__ghostyBootManual ? T : e) / 1000, look);
    }
    // 4. the name: particles fly from the sphere into the letters, a little wide of them; the letters come up crisp; one
    // last tightening draws them all in; the particles go; the line draws itself under it from the middle out
    const N = tl.name;
    if (T >= N && !parts.length && !calm) parts = sample();
    const tight = calm || !parts.length ? 1 : 1 + 0.09 * (1 - easeInOut(seg(N + 420, N + 580)));
    letters.forEach((s, i) => (s.style.transform = tight === 1 ? '' : `translateX(${((offs[i] ?? 0) * (tight - 1)).toFixed(2)}px)`));
    const wordOn = calm ? seg(N, N + 300) : seg(N + 350, N + 600);
    const textsOut = (1 - seg(tl.land, tl.land + 150)) * (quietHold ? 0 : 1);
    word.style.opacity = (wordOn * textsOut).toFixed(3);
    const drawn = calm ? 1 : easeInOut(seg(N + 500, N + 650));
    line.style.transform = `translateX(-50%) scaleX(${drawn.toFixed(4)})`;
    line.style.opacity = ((calm ? seg(N + 150, N + 450) : drawn > 0 ? 1 : 0) * textsOut).toFixed(3);
    stops.style.opacity = (calm ? 1 : seg(N + 620, N + 720)).toFixed(3);
    if (dctx) {
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.clearRect(0, 0, dust.width, dust.height);
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctx.globalCompositeOperation = 'lighter';
      if (kind === 'full' && !lean && mindIn) depths(dctx, push, seg);
      const fadeDust = 1 - seg(N + 450, N + 700);
      if (parts.length && fadeDust > 0 && T >= N) {
        dctx.fillStyle = accent;
        for (const p of parts) {
          const k = easeOut((T - N - p.d) / 330);
          if (k <= 0) continue;
          // a slight curve on the way, as if drawn out of the sphere
          const bend = Math.sin(k * Math.PI) * (p.c - 0.5) * 30;
          const x1 = wcx + (p.x1 - wcx) * tight;
          const x = p.x0 + (x1 - p.x0) * k + bend;
          const y = p.y0 + (p.y1 - p.y0) * k;
          dctx.globalAlpha = Math.min(1, 0.35 + k) * fadeDust * (0.55 + 0.45 * p.c);
          const sz = k > 0.98 ? 1.6 : 1.2 + p.c;
          dctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
        dctx.globalAlpha = 1;
      }
    }
    // 5. the greeting, with a breath of bloom (in, then most of it out again)
    const G = tl.greeting;
    const gOn = seg(G, G + 300);
    greet.style.opacity = (gOn * textsOut).toFixed(3);
    greet.style.transform = `translate(-50%, ${calm ? 0 : ((1 - easeOut(gOn)) * 8).toFixed(2)}px)`;
    const breath = calm ? 0 : easeOut(seg(G, G + 170)) * (1 - 0.8 * easeInOut(seg(G + 170, G + 560)));
    bloom.style.opacity = (breath * textsOut).toFixed(3);
    greet.style.textShadow = breath > 0 ? `0 0 ${(6 + 20 * breath).toFixed(1)}px rgba(${cr}, ${(0.2 + 0.55 * breath).toFixed(3)})` : '';
    // 6. the black goes and Home is there
    veil.style.opacity = (1 - easeInOut(seg(tl.land, tl.end))).toFixed(3);
  };

  /** Each frame against the budget: the gap since the last one (long: over 12 ms at 120 Hz, over 20 at 60). */
  const budget = (gap: number) => {
    if (B.gaps.length < 600) B.gaps.push(Math.round(gap * 10) / 10);
    if (gap < 11.5) quick++;
    const hz = B.gaps.length < 3 ? 0 : quick >= 2 ? 120 : 60;
    if (hz !== B.hz) {
      B.hz = hz;
      B.ms = hz === 120 ? LONG_120 : LONG_60;
      B.long = B.gaps.filter((g) => g > B.ms).length;
    } else if (gap > B.ms) B.long++;
    recent.push(gap > B.ms ? 1 : 0);
    if (recent.length > WINDOW) recent.shift();
  };
  /** Mid-flight, the full cut on a phone that cannot keep up: it leans (no depths, trails or refraction) and quickens. */
  const strain = (now: number) => {
    if (lean || kind !== 'full' || !decided || steady() || bootState.skipped || T < tl.gather || T >= tl.land) return;
    if (recent.reduce((a, b) => a + b, 0) < LEAN_AT) return;
    lean = true;
    B.lean = bootState.phase as Phase;
    paceE = elapsed(now);
    paceT = T;
    rate *= 1.5;
    bootState.pace = Math.round(rate * 1000) / 1000;
  };

  /** A frame that throws (a driver quirk, a shader that will not compile) must never keep the app behind the black
   *  (it plays on every cold open now): the cinematic bails straight to Home, Mind handed to the hero if it can be. */
  const bail = (err: unknown) => {
    if (done) return;
    done = true;
    console.warn('boot cinematic stopped early:', err);
    try {
      stopSound?.();
    } catch {
      /* the sound is already gone */
    }
    try {
      if (mindIn && mind) mind.bootEnd();
    } catch {
      /* Home wakes its own Mind */
    }
    el.remove();
    document.body.classList.remove('booting', 'bootland', 'bootwait');
    bootState.phase = 'done';
    bootState.ended = Math.round(elapsed(performance.now()));
    watchReturns();
  };
  const step = (now: number) => {
    try {
      frame(now);
    } catch (err) {
      bail(err);
    }
  };
  const frame = (now: number) => {
    if (done || faulted) return;
    const w0 = performance.now();
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
      budget(gap);
      if (T < tl.gather) {
        gaps++;
        gapSum += now - last;
      }
    }
    last = now;
    bootState.frames++;
    if (!flags().__ghostyBootManual) {
      strain(now);
      advance(now, dt, gap);
    }
    render(now);
    const work = performance.now() - w0;
    workSum += work;
    B.work = Math.max(B.work, Math.round(work * 10) / 10);
    B.avg = Math.round((workSum / bootState.frames) * 10) / 10;
    if (T >= tl.end) return finish();
    requestAnimationFrame(step);
  };

  const advance = (now: number, dt: number, gap: number) => {
    const e = elapsed(now);
    let next = Math.max(T + dt * rate, paceT + (e - paceE) * rate);
    // the point of light holds until Mind is drawing (or it is clear it won't be in time)
    if (!decided && next >= tl.gather && !decide(now)) next = tl.gather - 1;
    // the landing waits for the app underneath and for Home's hero; after 3.9 s the words go and Mind turns quietly
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
      // the last photograph: it lands for real (Home's hero takes Mind; the HUD comes in a beat later)
      if (T >= tl.end) finish();
    };

  requestAnimationFrame(step);
}
