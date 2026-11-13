/**
 * THE VIDEO PROJECT (BRIEF-EDITOR-VIDEO): a project is a list of tracks over a timeline in milliseconds. One main track of clips
 * laid end to end (a transition into the next clip overlaps the two by its length), up to two overlay tracks (a picture in
 * picture or a title), audio (the clips' own sound, music, a voice-over), a subtitle track, and a history sixty deep. The
 * originals are never touched: a clip is a source id, an in and an out point, and what is done to it. Pure: no DOM, so the
 * brain test proves it on numbers.
 */

export type Aspect = 'project' | '9:16' | '1:1' | '4:5' | '16:9';
export type TransitionKind = 'cut' | 'crossfade' | 'dip' | 'wipe' | 'slide';
export type Channel = 'x' | 'y' | 'scale' | 'rot' | 'opacity';
/** A keyframe: `t` is milliseconds from the clip's start on the timeline; `ease` smooths the stretch that starts here. */
export interface Key {
  t: number;
  v: number;
  ease?: boolean;
}
export interface Transform {
  /** Position of the centre, in fractions of the picture's width and height from the middle (-0.5 to 0.5 is on screen). */
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rot: number;
  opacity: number;
  keys: Partial<Record<Channel, Key[]>>;
}
export interface Grade {
  /** Stops (-3 to 3). */
  exposure: number;
  /** -1 to 1 each. */
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  /** -1 (cooler) to 1 (warmer), and the green-magenta tint. */
  temp: number;
  tint: number;
  vibrance: number;
  saturation: number;
  /** A luminance curve: up to six points in 0..1. */
  curve: [number, number][];
}
export interface Mask {
  kind: 'rect' | 'ellipse';
  /** Centre and size in fractions of the clip's picture. */
  x: number;
  y: number;
  w: number;
  h: number;
  feather: number;
  invert: boolean;
}
export interface Chroma {
  /** The colour taken out, 0..1 each. */
  color: [number, number, number];
  tol: number;
  soft: number;
}
export interface Transition {
  kind: TransitionKind;
  /** Milliseconds. */
  len: number;
}
export interface Clip {
  id: string;
  src: string;
  /** Source in and out, in milliseconds. */
  in: number;
  out: number;
  /** 0.25 to 4, held for the whole clip. */
  speed: number;
  volume: number;
  tr: Transform;
  grade: Grade;
  /** A LUT kept with the project: its id. */
  lut?: string;
  crop: { x: number; y: number; w: number; h: number };
  fit: 'fit' | 'fill';
  mask?: Mask;
  chroma?: Chroma;
  /** The transition into the NEXT clip (the main track only). */
  next: Transition;
}
export interface Title {
  text: string;
  /** 'top' | 'middle' | 'bottom'. */
  pos: 'top' | 'middle' | 'bottom';
  appear: 'none' | 'fade' | 'rise';
  leave: 'none' | 'fade' | 'rise';
}
/** Something on an overlay track: a picture-in-picture clip, or a title. */
export interface Overlay {
  id: string;
  track: 0 | 1;
  /** Timeline start and length in milliseconds. */
  start: number;
  len: number;
  clip?: Clip;
  title?: Title;
  corner?: 'tl' | 'tr' | 'bl' | 'br';
  size?: number;
}
export interface AudioItem {
  id: string;
  src: string;
  /** Timeline start, source in and length, in milliseconds. */
  start: number;
  in: number;
  len: number;
  gain: number;
  fadeIn: number;
  fadeOut: number;
}
export interface Cue {
  start: number;
  end: number;
  text: string;
  pos: 'top' | 'bottom';
}
export interface Source {
  id: string;
  name: string;
  kind: 'video' | 'audio';
  size: number;
  dur: number;
  w: number;
  h: number;
  fps: number;
  hasAudio: boolean;
  /** The proxy's size in bytes when one was made for a long clip. */
  proxy?: number;
}
export interface Project {
  id: string;
  name: string;
  at: number;
  aspect: Aspect;
  /** The project's own shape: the first clip's. */
  w: number;
  h: number;
  fps: number;
  sources: Record<string, Source>;
  main: Clip[];
  overlays: Overlay[];
  music: AudioItem[];
  voice: AudioItem[];
  /** How far the music drops under the voice, in decibels (0 is off). */
  duck: number;
  subs: Cue[];
  luts: Record<string, { name: string; size: number; data: number[] }>;
  playhead: number;
}

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;
export const HISTORY_DEPTH = 60;
export const ASPECTS: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: 'project', label: 'Its own', ratio: null },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

export const uid = (): string => Math.random().toString(36).slice(2, 10);
export const flatGrade = (): Grade => ({ exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temp: 0, tint: 0, vibrance: 0, saturation: 0, curve: [[0, 0], [1, 1]] });
export const flatTransform = (): Transform => ({ x: 0, y: 0, scale: 1, rot: 0, opacity: 1, keys: {} });
export const isFlat = (g: Grade): boolean => JSON.stringify(g) === JSON.stringify(flatGrade());

export function newProject(name = 'My video'): Project {
  return { id: uid(), name, at: Date.now(), aspect: 'project', w: 1280, h: 720, fps: 30, sources: {}, main: [], overlays: [], music: [], voice: [], duck: 12, subs: [], luts: {}, playhead: 0 };
}

export function newClip(src: Source): Clip {
  return {
    id: uid(), src: src.id, in: 0, out: Math.max(100, Math.round(src.dur)), speed: 1, volume: 1, tr: flatTransform(), grade: flatGrade(),
    crop: { x: 0, y: 0, w: 1, h: 1 }, fit: 'fit', next: { kind: 'cut', len: 0 },
  };
}

/** How long a clip lasts on the timeline: its stretch of the source divided by its speed. A clip at 2× over 10 s is 5 s. */
export const clipLen = (c: Pick<Clip, 'in' | 'out' | 'speed'>): number => (c.out - c.in) / c.speed;

/** The source time (ms) shown at `t` ms into the clip: in + t × speed. */
export const sourceTime = (c: Pick<Clip, 'in' | 'speed'>, tIn: number): number => c.in + tIn * c.speed;

/** A transition's length cannot be longer than half of either clip it joins. */
export function transitionCap(a: Clip, b: Clip | undefined): number {
  if (!b) return 0;
  return Math.max(0, Math.floor(Math.min(clipLen(a), clipLen(b)) / 2));
}

export interface Placed {
  clip: Clip;
  index: number;
  start: number;
  len: number;
  /** The transition that brings this clip in (from the one before it), with its start on the timeline. */
  tin: { kind: TransitionKind; len: number } | null;
}
/** Where each main clip sits on the timeline: end to end, each transition overlapping the next clip with the one before. */
export function place(main: Clip[]): Placed[] {
  const out: Placed[] = [];
  let at = 0;
  main.forEach((clip, i) => {
    const prev = main[i - 1];
    const tl = prev && prev.next.kind !== 'cut' ? Math.min(prev.next.len, transitionCap(prev, clip)) : 0;
    const start = Math.max(0, at - tl);
    const len = clipLen(clip);
    out.push({ clip, index: i, start, len, tin: tl > 0 && prev ? { kind: prev.next.kind, len: tl } : null });
    at = start + len;
  });
  return out;
}

export function duration(p: Project): number {
  const pl = place(p.main);
  const last = pl[pl.length - 1];
  return last ? Math.round(last.start + last.len) : 0;
}

/** The clips showing at timeline time `t`: one, or two while a transition runs (the one going out first). */
export function activeMain(p: Project, t: number): Placed[] {
  const pl = place(p.main);
  if (!pl.length) return [];
  const end = duration(p);
  const tt = Math.min(Math.max(0, t), Math.max(0, end - 1));
  const here = pl.filter((x) => tt >= x.start && tt < x.start + x.len);
  return here.length ? here : [pl[pl.length - 1]!];
}

/** A project's shape (width, height): the aspect picked, else the first clip's own, with the long side at most `long`. */
export function shape(p: Pick<Project, 'aspect' | 'w' | 'h'>, long = 1920): { w: number; h: number } {
  const a = ASPECTS.find((x) => x.id === p.aspect)?.ratio ?? p.w / p.h;
  const w = a >= 1 ? long : Math.round(long * a);
  const h = a >= 1 ? Math.round(long / a) : long;
  return { w: w - (w % 2), h: h - (h % 2) };
}

// ---------------------------------------------------------------- editing: each returns a changed copy
const clone = <T,>(x: T): T => structuredClone(x);

/** Split the main clip at timeline time `t` into two (nothing when it falls within 100 ms of an edge). */
export function splitAt(p: Project, t: number): Project | null {
  const pl = place(p.main);
  const x = pl.find((q) => t > q.start + 100 && t < q.start + q.len - 100 && (!q.tin || t > q.start + q.tin.len));
  if (!x) return null;
  const q = clone(p);
  const c = q.main[x.index]!;
  const cut = Math.round(sourceTime(c, t - x.start));
  const second: Clip = { ...clone(c), id: uid(), in: cut };
  second.tr = flatTransform();
  c.out = cut;
  const nextT = c.next;
  c.next = { kind: 'cut', len: 0 };
  second.next = nextT;
  q.main.splice(x.index + 1, 0, second);
  return q;
}

export function trimClip(p: Project, id: string, inMs: number, outMs: number): Project | null {
  const q = clone(p);
  const c = q.main.find((x) => x.id === id);
  const src = c && q.sources[c.src];
  if (!c || !src) return null;
  const a = Math.max(0, Math.min(inMs, outMs - 100));
  const z = Math.min(src.dur, Math.max(outMs, a + 100));
  c.in = Math.round(a);
  c.out = Math.round(z);
  c.next.len = Math.min(c.next.len, transitionCap(c, q.main[q.main.indexOf(c) + 1]));
  return q;
}

export function setSpeed(p: Project, id: string, speed: number): Project | null {
  const q = clone(p);
  const c = q.main.find((x) => x.id === id);
  if (!c) return null;
  c.speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(speed * 100) / 100));
  c.next.len = Math.min(c.next.len, transitionCap(c, q.main[q.main.indexOf(c) + 1]));
  return q;
}

export function moveClip(p: Project, from: number, to: number): Project | null {
  if (from === to || from < 0 || to < 0 || from >= p.main.length || to >= p.main.length) return null;
  const q = clone(p);
  const [c] = q.main.splice(from, 1);
  q.main.splice(to, 0, c!);
  for (const x of q.main) x.next.len = Math.min(x.next.len, transitionCap(x, q.main[q.main.indexOf(x) + 1]));
  q.main[q.main.length - 1]!.next = { kind: 'cut', len: 0 };
  return q;
}

export function setTransition(p: Project, index: number, kind: TransitionKind, len: number): Project | null {
  const q = clone(p);
  const c = q.main[index];
  if (!c || !q.main[index + 1]) return null;
  c.next = kind === 'cut' ? { kind: 'cut', len: 0 } : { kind, len: Math.max(100, Math.min(len, transitionCap(c, q.main[index + 1]))) };
  return q;
}

export function removeClip(p: Project, id: string): Project | null {
  const i = p.main.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const q = clone(p);
  q.main.splice(i, 1);
  if (q.main.length) q.main[q.main.length - 1]!.next = { kind: 'cut', len: 0 };
  return q;
}

/** What a project's sources are still used by (a source nobody uses can be let go). */
export function usedSources(p: Project): Set<string> {
  const s = new Set<string>();
  for (const c of p.main) s.add(c.src);
  for (const o of p.overlays) if (o.clip) s.add(o.clip.src);
  for (const a of [...p.music, ...p.voice]) s.add(a.src);
  return s;
}

// ---------------------------------------------------------------- the history, sixty deep
export class History {
  private past: Project[] = [];
  private future: Project[] = [];
  constructor(public now: Project) {}
  /** Make `next` the project; the one before it can be undone to. */
  push(next: Project): Project {
    this.past.push(this.now);
    if (this.past.length > HISTORY_DEPTH) this.past.shift();
    this.future = [];
    this.now = next;
    return next;
  }
  get depth(): number {
    return this.past.length;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  undo(): Project | null {
    const p = this.past.pop();
    if (!p) return null;
    this.future.push(this.now);
    this.now = p;
    return p;
  }
  redo(): Project | null {
    const p = this.future.pop();
    if (!p) return null;
    this.past.push(this.now);
    this.now = p;
    return p;
  }
}

// ---------------------------------------------------------------- words
/** "1:05.3", "0:12": a time as a person reads it on a clock. */
export function clock(ms: number, tenths = false): string {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${tenths ? r.toFixed(1).padStart(4, '0') : String(Math.floor(r)).padStart(2, '0')}`;
}
/** "12.3 s" or "1 min 05 s". */
export function lengthWords(ms: number): string {
  const s = ms / 1000;
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${Math.round(s * 10) / 10} s`;
}
