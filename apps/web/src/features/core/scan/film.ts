/**
 * THE BOOT AS THE FILM, WITH THE DESCENT (BRIEF-HUD-SCAN-1 6; round two's cut, docs/build-plan/mockups/hud/2026-11-08-2/cut.json and
 * its README's shot list; his words, OWNER-ISSUES 157: "straight out of a high production hollywood movie", 158: "could even be a
 * bit longer … a little bit of pizzazz", 159/160: the dolly becomes the descent). The picture of the boot when THE LOOK's world is
 * The Scan; shell/boot.ts stays the conductor (the phases, the stamp typing itself, the feeds answering, the recognition, the
 * greeting, the skip, the frame budget, `__bootSeek`): this file draws what each moment looks like, as one pure function of
 * the cut's millisecond `T`, in Home's one context (mind.ts, staged: the world, then the orb into its viewport).
 *
 *   1 THE EYE OPENS       0        one point of light in the lit graphite; the camera far up in the sky over the city
 *   2 THE SCAN            500      a sphere of light grows out of the eye (over his desk) and samples the world as it passes: the
 *                                  room first, the street, then the city lighting up block by block as the front reaches it; the
 *                                  front a step brighter than what it leaves settled behind; the camera begins THE DESCENT
 *   3 THE EDGES, THINGS   900      the hairline edges draw 400 ms behind the front; each thing the world frame marks locks into its
 *                                  reticle with its tag the moment the front reaches it (tags at 72 % while the camera is far)
 *   4 THE ORB FORMS       2000     his library's points gather out of the eye (mind.ts: the gather, the trails, the sweep refracting
 *                                  at the equator, the sphere from the inside out); the world's light dips 45 % and comes back
 *   5 THE STAMP           3100     the Machine's point of view types itself (boot.ts)
 *   6 THE FEEDS ANSWER    4000     one truth line each (boot.ts); the city's windows light up over 900 ms as they do
 *   7 THE RECOGNITION     4900     the box snaps onto the orb (boot.ts); a wave of his colour passes once through every point from
 *                                  the eye outward and is gone in 700 ms; the screen lifts 7 % for one frame
 *   8 THE GREETING, NOW   5400     his line (boot.ts); at 5800 the search: the box checks the shelf, the desk, and locks on tonight's
 *                                  thing (this morning's Brief by the hour); the line of sight draws itself from the orb's rim
 *   9 THE LANDING         6500     the words go; the camera is at rest on THE WHOLE OF IT; the house and the ask line slide up a beat
 *                                  later (boot.ts); Home is usable at 7,000 and breathes (home.ts takes the stage)
 * The short cut (a phone that cannot keep up, by the budget boot.ts keeps): the same shots at about five seconds, the lean world
 * (fewer city blocks lit, the aircraft three points), no trails, no refraction. Reduce Motion: two stills, the world frame whole as
 * still A. The lean cut mid-flight drops the trails and the refraction (boot.ts).
 */
import { h } from '../../../core/dom';
import { tag } from '../../../ui/machine';
import type { Mind } from '../mind';
import type { CamPose, V3 } from './scene';
import { CAMERAS, MARKS, ORB_AT, ORB_FILL, marksAt, worldDesc, type Mark } from './world';
import { scanScene } from './home';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/** The cut, ms from the first frame (round two's numbers; Home usable at 7,000). */
export interface FilmCut {
  ground: number;
  scan: number;
  scanEnd: number;
  edges: number;
  orb: number;
  camLand: number;
  stamp: number;
  feeds: number;
  recognise: number;
  greeting: number;
  now: number;
  land: number;
  home: number;
  end: number;
}
export const FILM: FilmCut = { ground: 0, scan: 500, scanEnd: 2500, edges: 900, orb: 2000, camLand: 3900, stamp: 3100, feeds: 4000, recognise: 4900, greeting: 5400, now: 5800, land: 6500, home: 7000, end: 7000 };
/** The short cut: about five seconds, the same shots closer together (a slow phone, a late Mind, a television). */
export const FILM_SHORT: FilmCut = { ground: 0, scan: 300, scanEnd: 1500, edges: 600, orb: 1200, camLand: 2600, stamp: 1900, feeds: 2500, recognise: 3200, greeting: 3600, now: 3900, land: 4400, home: 4800, end: 4800 };

const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>';
const clamp = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const out = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const inOutQuint = (k: number) => {
  const x = clamp(k);
  return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
};
const lock = (k: number) => {
  const x = clamp(k);
  return x * x * (3 - 2 * x);
};
const LOCK = 160;

/** The descent's path: the sky over the city (the far end of the world frame), down over the street, to rest on THE WHOLE OF IT. */
const SKY: CamPose = { pos: [14, 62, -36], tgt: [10, 0, -70], fov: 56 };
const STREET: CamPose = { pos: [3, 14, 16], tgt: [1.5, 1.8, -12], fov: 60 };
const bez = (a: V3, b: V3, c: V3, k: number): V3 => {
  const u = 1 - k;
  return [u * u * a[0] + 2 * u * k * b[0] + k * k * c[0], u * u * a[1] + 2 * u * k * b[1] + k * k * c[1], u * u * a[2] + 2 * u * k * b[2] + k * k * c[2]];
};
/** The camera at `k` (0..1) of the descent: a smooth curve through the street's pose, quintic in-out. */
export function descent(k: number): CamPose {
  const q = inOutQuint(k);
  const rest = CAMERAS.whole;
  return { pos: bez(SKY.pos, STREET.pos, rest.pos, q), tgt: bez(SKY.tgt, STREET.tgt, rest.tgt, q), fov: SKY.fov + (rest.fov - SKY.fov) * q };
}

/** What the check reads of the film (window.__bootState.scan). */
export interface FilmState {
  /** The sampling front, 0..1, and the edges behind it. */
  build: number;
  edge: number;
  /** How far the descent has come, 0..1 (1: at rest on the world frame). */
  descent: number;
  /** When each thing the frame marks is found (ms of the cut), and which have locked in so far. */
  things: Record<string, number>;
  locked: string[];
  /** The orb's viewport on the stage, [x, y, w, h]. */
  orb: number[] | null;
  /** The world the film drew: 'lean' on a phone that cannot keep up, else 'full'. */
  world: 'full' | 'lean' | '';
  frames: number;
}

/**
 * The film's own picture: the world drawn on Mind's stage by the cut's clock, the things' reticles in the boot's layer, the orb's
 * viewport. `frame(T, look)` is called by boot.ts each frame with the cut's millisecond; `landed()` at the end.
 */
export class Film {
  readonly state: FilmState = { build: 0, edge: 0, descent: 0, things: {}, locked: [], orb: null, world: '', frames: 0 };
  private marks: { m: Mark; el: HTMLElement; at: number }[] = [];
  private host: HTMLElement;
  private layer: HTMLElement;
  private sight: SVGSVGElement;
  private sightLine: SVGPathElement;
  private sightDot: SVGCircleElement;
  private flash: HTMLElement;
  private T = 0;
  private calm = false;
  private windowLit = 0;
  private lit: string;
  private W = 440;
  private H = 956;

  constructor(host: HTMLElement, private cut: FilmCut, private mind: Mind, lit: string, lean: boolean) {
    this.host = host;
    this.lit = lit;
    const scan = scanScene();
    // (the world is built by boot.ts the moment Mind is in; built here only if it has not been)
    if (!scan.count.points) scan.build(worldDesc(lit === 'r-alice' ? 'alice' : 'brief', lean));
    this.state.world = lean ? 'lean' : 'full';
    // the things the world frame marks, each found when the sampling front reaches it (its distance from the eye)
    const eye = scan.orb.c;
    const buildMs = cut.scanEnd - cut.scan;
    this.layer = h('div.bfilm', { 'aria-hidden': 'true' });
    for (const m of marksAt('whole').concat(MARKS.filter((x) => x.id === lit && !x.where.includes('whole')))) {
      const c: V3 = [(m.box[0]! + m.box[3]!) / 2, (m.box[1]! + m.box[4]!) / 2, (m.box[2]! + m.box[5]!) / 2];
      const order = scan.orderOf(c, eye);
      // the front is at build × 1.2 where build grows as k^.9 (a soft landing): solve for the moment it arrives
      const k = Math.min(1, order / 1.2);
      const at = Math.round(cut.scan + Math.pow(k, 1 / 0.9) * buildMs + 60);
      const el = h('span.scanret.bret', { dataset: { id: m.id, side: m.side ?? '' } }, h('span.g-ret-frame'));
      if (m.id !== 'r-alice' && m.id !== 'r-house') el.append(tag(m.name, { glyph: m.glyph === 'clock' ? CLOCK : m.glyph === 'star' ? STAR : undefined }));
      if (m.id === lit) el.classList.add('on');
      el.style.opacity = '0';
      this.layer.append(el);
      this.marks.push({ m, el, at });
      this.state.things[m.id] = at;
    }
    this.sight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.sight.setAttribute('class', 'scanleads bsight');
    this.sightLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.sightLine.setAttribute('class', 'scansight');
    this.sightDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.sightDot.setAttribute('class', 'scansightdot');
    this.sightDot.setAttribute('r', '2.5');
    this.sight.append(this.sightLine, this.sightDot);
    this.flash = h('i.bflash', { 'aria-hidden': 'true' });
    this.layer.append(this.sight, this.flash);
    host.append(this.layer);
  }

  /** The short cut chosen after the film began (boot.ts decide): the shots move closer together; each thing's moment follows. */
  setCut(cut: FilmCut): void {
    this.cut = cut;
    const scan = scanScene();
    const buildMs = cut.scanEnd - cut.scan;
    for (const x of this.marks) {
      const c: V3 = [(x.m.box[0]! + x.m.box[3]!) / 2, (x.m.box[1]! + x.m.box[4]!) / 2, (x.m.box[2]! + x.m.box[5]!) / 2];
      const k = Math.min(1, scan.orderOf(c) / 1.2);
      x.at = Math.round(cut.scan + Math.pow(k, 1 / 0.9) * buildMs + 60);
      this.state.things[x.m.id] = x.at;
    }
  }

  /** The reticle of a thing on the layer (the search box visits them: boot.ts). */
  markEl(id: string): HTMLElement | null {
    return this.marks.find((x) => x.m.id === id)?.el ?? null;
  }

  /** The orb's viewport for the whole of it (where Home puts it: the same screen place at the same depth). */
  orbRect(W = this.W, H = this.H): { x: number; y: number; w: number; h: number } {
    const sx = (ORB_AT.x / 440) * W;
    const sy = (ORB_AT.y / 956) * H;
    const rp = ORB_AT.r * Math.min(W / 440, H / 956);
    const side = (2 * rp) / ORB_FILL;
    return { x: sx - side / 2, y: sy - side / 2, w: side, h: side };
  }

  /** The pose at `T`: the descent from the sky (shots 2–4), then at rest on the whole of it; the still version is the rest. */
  pose(T: number): CamPose {
    if (this.calm) return CAMERAS.whole;
    const k = seg(T, this.cut.scan, this.cut.camLand);
    return k >= 1 ? CAMERAS.whole : descent(k);
  }

  /** Mind's stage callback: the world at this moment, in this one context. */
  readonly draw = (T: Any, renderer: Any, _t: number, W: number, H: number, dpr: number): void => {
    const C = this.cut;
    const Tm = this.T;
    const scan = scanScene();
    const calm = this.calm;
    const build = calm ? 1 : Math.pow(seg(Tm, C.scan, C.scanEnd), 0.9);
    const edge = calm ? 1 : Math.pow(seg(Tm, C.edges, C.edges + (C.scanEnd - C.scan)), 0.9);
    const ping = !calm && Tm >= C.recognise ? seg(Tm, C.recognise, C.recognise + 700) : 0;
    const pingA = !calm && Tm >= C.recognise ? 2.6 * (1 - out(seg(Tm, C.recognise, C.recognise + 700))) : 0;
    // the world's light draws into the eye as the orb forms, then comes back with the sphere
    const dip = calm ? 1 : 1 - 0.45 * Math.sin(Math.PI * seg(Tm, C.orb, C.orb + 1300));
    const orbLit = calm ? 1 : 0.1 + 1.1 * out(seg(Tm, C.orb, C.orb + 900));
    this.windowLit = calm ? 1 : out(seg(Tm, C.feeds, C.feeds + 900));
    this.state.build = build;
    this.state.edge = edge;
    this.state.frames++;
    const pose = this.pose(Tm);
    scan.render(T, renderer, pose, W, H, dpr, {
      uBuild: build,
      uEdge: edge,
      // the wave of his colour from the eye outward: across the street and the near city in 700 ms
      uPing: ping * 48,
      uPingA: pingA,
      uOrbLit: orbLit,
      uAmbient: 0.66 * dip,
      uTime: calm ? 12.5 : Tm / 1000,
      uDrift: calm ? 0 : out(seg(Tm, C.home, C.home + 800)),
      uFreshA: 1,
      uSparkle: calm ? 0 : 0.6 * out(seg(Tm, C.home, C.home + 800)),
      uFog: 0.012,
      uShow: 0,
      uSky: 0,
      // the city's windows come up as the feeds answer (the far tint is what they are drawn in)
      uWarmA: 1,
      uCoolA: 1,
      uFade: 1,
      far: this.windowLit,
    });
  };

  /**
   * One frame of the film at the cut's millisecond `T`: the camera, the things locking in as the front reaches them (their tags
   * at 72 % while the camera is far), the orb's viewport, the line of sight at the search's lock, the lift at the recognition.
   * `nowLocked`: the search has locked on the thing (boot.ts says when). Returns the orb's viewport for the box to land on.
   */
  frame(T: number, o: { calm: boolean; nowLocked: boolean; textsOut: number; lean: boolean }): { x: number; y: number; w: number; h: number } {
    this.T = T;
    this.calm = o.calm;
    const C = this.cut;
    const scan = scanScene();
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width || innerWidth));
    this.H = Math.max(1, Math.round(r.height || innerHeight));
    const pose = this.pose(T);
    this.state.descent = o.calm ? 1 : seg(T, C.scan, C.camLand);
    scan.cam.set(pose, this.W, this.H);
    // the things found: each snaps on when the front reaches it (the lock curve, from 108 %); the tags scale with the camera
    const near = o.calm ? 1 : inOutQuint(seg(T, C.scan, C.camLand));
    const locked: string[] = [];
    for (const x of this.marks) {
      const k = o.calm ? (T >= C.orb ? 1 : 0) : lock(seg(T, x.at, x.at + LOCK));
      const box = scan.cam.box(x.m.box, x.m.pad, 44);
      if (!box || k <= 0) {
        x.el.style.opacity = '0';
        continue;
      }
      locked.push(x.m.id);
      Object.assign(x.el.style, { left: `${Math.round(box.left)}px`, top: `${Math.round(box.top)}px`, width: `${Math.round(box.right - box.left)}px`, height: `${Math.round(box.bottom - box.top)}px`, opacity: (k * o.textsOut).toFixed(3), transform: `scale(${(1.08 - 0.08 * k).toFixed(3)})` });
      const tg = x.el.querySelector<HTMLElement>('.g-tag');
      if (tg) tg.style.transform = `scale(${(0.72 + 0.28 * near).toFixed(3)})`;
    }
    this.state.locked = locked;
    // the orb's viewport: where Home will have it (the eye's screen place), so the landing is no cut
    const q = this.orbRect();
    this.mind.stageRect = q;
    this.state.orb = [Math.round(q.x), Math.round(q.y), Math.round(q.w), Math.round(q.h)];
    // the line of sight from the orb's rim to the thing the search locked on, drawing itself over 300 ms
    const nowAt = C.now + 320;
    const drawn = o.calm ? (o.nowLocked ? 1 : 0) : out(seg(T, nowAt + 120, nowAt + 420));
    const lit = this.marks.find((x) => x.m.id === this.lit);
    const box = lit ? scan.cam.box(lit.m.box, lit.m.pad, 44) : null;
    if (box && drawn > 0 && o.nowLocked) {
      const cx = q.x + q.w / 2;
      const cy = q.y + q.h / 2;
      const rr = (q.w * ORB_FILL) / 2;
      const tx = Math.max(box.left, Math.min(box.right, cx));
      const ty = Math.max(box.top, Math.min(box.bottom, cy));
      const ang = Math.atan2(ty - cy, tx - cx);
      const sx = cx + rr * Math.cos(ang);
      const sy = cy + rr * Math.sin(ang);
      const ex = sx + (tx - sx) * drawn;
      const ey = sy + (ty - sy) * drawn;
      this.sight.setAttribute('width', String(this.W));
      this.sight.setAttribute('height', String(this.H));
      this.sight.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
      this.sightLine.setAttribute('d', `M${sx.toFixed(1)} ${sy.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
      this.sightDot.setAttribute('cx', tx.toFixed(1));
      this.sightDot.setAttribute('cy', ty.toFixed(1));
      this.sightDot.style.opacity = drawn >= 0.999 ? '1' : '0';
      this.sight.style.opacity = String(o.textsOut);
    } else this.sight.style.opacity = '0';
    // the recognition: the screen lifts 7 % for one frame (a flash in the ink, screened over the frame)
    this.flash.style.opacity = o.calm ? '0' : (0.07 * Math.sin(Math.PI * seg(T, C.recognise + 40, C.recognise + 260))).toFixed(3);
    return q;
  }

  /** The film is over (or skipped): its marks go; Home's own take their places at the same projection. */
  end(): void {
    this.layer.remove();
  }
}
