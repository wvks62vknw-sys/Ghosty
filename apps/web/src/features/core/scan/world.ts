/**
 * THE WHOLE OF IT (BRIEF-HUD-SCAN-1 1–3; the numbers lifted from docs/build-plan/mockups/hud/2026-11-08-3/build.py and world.html):
 * one scene from the sky to his desk, built once, the same buffers at every altitude. His room with its eight things, the lamp
 * (a thing in the room that lights it), his chair pulled out, his mug by the book; his house round the room as hairlines (the
 * Machine has only been inside one room), the street with its lamps and the houses across the way, the city as hairline blocks
 * lit with windows on a street grid at 1:6 (the Machine draws what matters at the size it matters: the room and the street at
 * 1:1, the city behind them as its own miniature, not a map), the far towers round the station, three aircraft with their
 * trails; and what the two other places add (OUT: him ringed on the walk; ON THE WAY: the line through the city, the train a lit
 * point with its trail), shown only there (`show`).
 *
 * The altitudes are four cameras (the room, the street, the city, the whole), each a pose; the camera moves between them on
 * the tokens' curve (home.ts). The orb hangs where each camera puts it (the same screen place at the same depth), so it keeps
 * the middle of the frame as the camera climbs; its light on the points was baked from the room's (over the desk), which is
 * where it lights anything that can be seen lit. The LEAN world (the phone that cannot keep up: fewer city blocks lit, the far
 * towers alone with every window, the aircraft three points) is the same parts with `lean`.
 */
import type { CamPose, Part, SceneDesc, V3 } from './scene';
import { Scan } from './scene';

/** The room in metres: half-width, height, the back wall, the front; the window on the back wall. */
export const ROOM = { hw: 1.02, hgt: 2.38, zb: -2.4, zf: 1.5, win: [-0.5, 1.0, 0.5, 2.05] as [number, number, number, number] };

/** His eight things and the desk they sit on: centre, kind (how it is sampled), half-size. */
export const HOME: Record<string, { c: V3; k: number; h: V3 }> = {
  desk: { c: [0.0, 0.73, -1.58], k: 0, h: [0.85, 0.02, 0.28] },
  legl: { c: [-0.8, 0.355, -1.58], k: 0, h: [0.02, 0.355, 0.24] },
  legr: { c: [0.8, 0.355, -1.58], k: 0, h: [0.02, 0.355, 0.24] },
  brief: { c: [-0.62, 0.754, -1.62], k: 2, h: [0.12, 0.004, 0.085] },
  alice: { c: [-0.18, 0.758, -1.5], k: 1, h: [0.2, 0.008, 0.135] },
  gym: { c: [0.27, 0.76, -1.6], k: 5, h: [0.13, 0.012, 0.13] },
  courses: { c: [0.66, 0.757, -1.58], k: 3, h: [0.1, 0.007, 0.13] },
  shelf: { c: [-0.78, 1.0, -2.24], k: 7, h: [0.16, 1.0, 0.15] },
  lens: { c: [-0.78, 1.47, -2.12], k: 0, h: [0.07, 0.045, 0.04] },
  agenda: { c: [0.8, 1.5, -2.385], k: 6, h: [0.17, 0.24, 0.012] },
};
/** The window, as a thing to mark (God's eye): its box on the back wall. */
export const WINDOW = { c: [0, 1.525, -2.4] as V3, h: [0.5, 0.525, 0.0] as V3 };
export const LAMP_AT: V3 = [0.36, 0.73, -1.83];
const BULB: V3 = [LAMP_AT[0], LAMP_AT[1] + 0.61, LAMP_AT[2]];
/** The city at 1:6 behind the street; the tallest towers round the station; the dentist's building; the aircraft. */
export const K = 1 / 6;
export const STATION: V3 = [16.5, 0, -62];
export const DENTIST: V3 = [-7.5, 0, -38];
export const AIRCRAFT: [number, number, number, number, number][] = [[11, 3.4, -124, 0.85, 0.3], [-20, 3.1, -136, -0.9, 0.25], [-4, 2.2, -108, 0.5, -0.6]];
/** Him on the walk (OUT): on the pavement a few doors down; the line (ON THE WAY): from the station out past the far towers; the train on it. */
export const ME_OUT: V3 = [-5.0, 0.02, -6.6];
export const LINE: [V3, V3] = [[STATION[0], 0.05, STATION[2]], [62, 0.05, -128]];
export const TRAIN_AT = 0.42;

/** A world box [x0 y0 z0 x1 y1 z1] round a centre and half-size. */
export const boxOf = (c: V3, h: V3): number[] => [c[0] - h[0], c[1] - h[1], c[2] - h[2], c[0] + h[0], c[1] + h[1], c[2] + h[2]];

/** The altitudes, lowest first: the room (ROOM+'s shot), the street, the city, the whole of it; and the line (ON THE WAY). */
export type Altitude = 'room' | 'street' | 'city' | 'whole' | 'line' | 'out';
export const ALTITUDES: Altitude[] = ['room', 'street', 'city', 'whole'];
export const CAMERAS: Record<Altitude, CamPose> = {
  // ROOM+: the camera low and three-quarter from his side of the desk, the desk running away at an angle
  room: { pos: [0.5, 1.45, 1.15], tgt: [-0.08, 0.95, -2.0], fov: 66 },
  // the street: outside his house, the roof lifted, the lamps, the houses across the way
  street: { pos: [2.4, 3.4, 8.2], tgt: [0.2, 1.3, -2.6], fov: 60 },
  // the city: over the street looking into the miniature, the towers round the station
  city: { pos: [4.0, 14.0, 10.0], tgt: [8.0, 1.0, -44.0], fov: 58 },
  // THE WHOLE OF IT: world.png's frame, from the sky to the desk
  whole: { pos: [0.8, 5.0, 6.0], tgt: [0.9, 1.85, -5.0], fov: 62 },
  // ON THE WAY: the city turned to the line, looking along it
  line: { pos: [-6.0, 18.0, -30.0], tgt: [34.0, 0.5, -96.0], fov: 56 },
  // OUT: the world landed on the street and the city by day, him ringed on the walk a few doors down
  out: { pos: [-10.0, 7.0, 12.0], tgt: [6.0, 0.0, -40.0], fov: 62 },
};
/** Where the orb hangs in each frame: the screen place (of a 440 × 956 frame), its depth along the view, its radius in px. */
export const ORB_AT = { x: 220, y: 400, depth: 2.2, r: 82 };
/** The hologram's canvas: the sphere fills 0.9 × 0.74 of its half side (mind.ts size()). */
export const ORB_FILL = 0.9 * 0.74;
/** The room's reach from the eye (metres): the boot's sphere of light samples the room over the first part of the scan. */
export const ROOM_BUILD_R = 4.6;

/** The scan's light: the lamp (a warm cone down), the window (the city's cool through it), the room's ambient; the fog by altitude. */
export const LIGHT = {
  tint: [1.0, 0.985, 0.965] as V3,
  tintFar: [0.82, 0.9, 1.0] as V3,
  ambient: 0.66,
  sky: 0,
  window: { at: [0, 1.5, -2.4] as V3, strength: 0.26, cool: 0.55 },
  lamps: [{ at: BULB, strength: 2.6, warm: 1.0, cone: 0.15, fall: 1.6 }],
};
export const FOG: Record<Altitude, number> = { room: 0.08, street: 0.03, city: 0.014, whole: 0.012, line: 0.012, out: 0.016 };

const thing = (c: V3, h: V3, kind = 0, lit = 0, more: Partial<Extract<Part, { type: 'thing' }>> = {}): Part => ({ type: 'thing', c, h, kind, lit, ...more });

/** The room's things (the lit one is tonight's or this morning's), the lamp, the mug and his chair as he left it. */
export function roomParts(litName: string): Part[] {
  const parts: Part[] = [];
  for (const [n, t] of Object.entries(HOME)) parts.push(thing(t.c, t.h, t.k, n === litName ? 1 : 0));
  parts.push({ type: 'lamp', at: LAMP_AT, h: 0.64, shade: 0.17, shadeH: 0.18 });
  parts.push({ type: 'cyl', c: [0.08, 0.746, -1.4], r: 0.04, h: 0.095, handle: true });
  parts.push(thing([-0.6, 0.455, -0.96], [0.22, 0.015, 0.22], 10), thing([-0.6, 0.8, -0.745], [0.2, 0.2, 0.012], 12));
  for (const dx of [-0.19, 0.19]) for (const dz of [-0.19, 0.19]) parts.push(thing([-0.6 + dx, 0.22, -0.96 + dz], [0.012, 0.22, 0.012], 0, 0, { edges: false, occlude: false }));
  return parts;
}

/** The whole scene's description: the room (no ceiling, no front wall, the back wall open, so it is seen into from above), the house, the street, the city, the sky, the aircraft, and the two places' own parts. */
export function worldDesc(litName: string, lean = false): SceneDesc {
  const room: Part = { type: 'room', hw: ROOM.hw, hgt: ROOM.hgt, zb: ROOM.zb, zf: ROOM.zf, win: ROOM.win, ceiling: false, solid: false, back: false, wallS: 0.085, floorS: 0.07 };
  const parts: Part[] = [
    room,
    ...roomParts(litName),
    { type: 'house', hw: 2.6, depth: [-2.5, 3.0], hgt: 3.2, ridge: 4.4 },
    { type: 'street', z0: -5.0, z1: -9.5, x0: -40, x1: 40, lamps: 9, lampH: 4.2, hx: 24, hstep: 5.5, hw: 2.2, hz: 2.0, hgt: 3.2, roof: 1.0, win: [[-1.1, 1.0], [1.1, 1.0], [-1.1, 2.3], [1.1, 2.3]], winS: [0.3, 0.35], winSp: 0.12 },
    { type: 'town', z0: -22, z1: -130, x0: -90, x1: 90, pitch: 6, centre: STATION, lit: 0.4, k: K, tower: 34, edgeFade: 36, camZ: 6, every: lean ? 3 : 1 },
    { type: 'skyline', lit: 0.3, accentLit: 0.08, night: true, zOff: -130, rise: -25 },
    { type: 'aircraft', list: AIRCRAFT, step: lean ? 0 : 0.5 },
    // OUT: him ringed on the walk (show 1); ON THE WAY: the line and the train with its trail (show 2)
    { type: 'ring', c: ME_OUT, r: 1.1, lit: 1, a: 2.0, show: 1, n: 64 },
    { type: 'trail', from: LINE[0], to: LINE[1], step: 0.6, a: 1.1, lit: 1, show: 2, rad: 0.12 },
    { type: 'trail', from: [LINE[0][0] + (LINE[1][0] - LINE[0][0]) * (TRAIN_AT - 0.08), 0.06, LINE[0][2] + (LINE[1][2] - LINE[0][2]) * (TRAIN_AT - 0.08)], to: [LINE[0][0] + (LINE[1][0] - LINE[0][0]) * TRAIN_AT, 0.06, LINE[0][2] + (LINE[1][2] - LINE[0][2]) * TRAIN_AT], step: 0.2, a: 1.8, lit: 1, show: 2, head: true, rad: 0.25 },
  ];
  // the eye at build: over the desk (ROOM+'s orb), where it lights the desk from above
  const cam = new Scan().cam;
  cam.set(CAMERAS.room, 440, 956);
  const orb = cam.unproject(ORB_AT.x, ORB_AT.y, ORB_AT.depth, ORB_AT.r);
  // the scan's order from the eye outward (the film's sampling front): the room over the first third (the desk first, the shelf,
  // the far wall), then the street and the city block by block out to the far towers
  const buildAt = (p: V3): number => {
    const d = Math.hypot(p[0] - orb.c[0], p[1] - orb.c[1], p[2] - orb.c[2]);
    return d <= ROOM_BUILD_R ? (0.3 * d) / ROOM_BUILD_R : 0.3 + 0.7 * Math.min(1, (d - ROOM_BUILD_R) / 150);
  };
  return { bounds: [100, 100, -200, 10], light: { ...LIGHT, fog: FOG.whole }, orb, parts, buildAt, lean };
}


/** One thing the Machine marks: its id, its name, the screen it opens, the world box, the reticle's pad and whether it is marked at each altitude. */
export interface Mark {
  id: string;
  name: string;
  /** The screen a tap opens (shell/tabs go id), or an altitude to go to. */
  to: string;
  box: number[];
  pad: number;
  /** The glyph before the tag: clock (a recent), star (a favourite), or none. */
  glyph: 'clock' | 'star' | '';
  /** Where it is marked: the room's marks in the room; the world's in the street, the city and the whole. */
  where: Altitude[];
  /** The tag sits to the right / below the box. */
  side?: 'r' | 'below' | 'r below';
  count?: string;
}

/** The marks of each frame (the finding rule, round three's table): in the room all eight; in the whole of it the book, the shelf, the aircraft, the station and the dentist's building; never the room's small things from the sky (they would stack). */
export const MARKS: Mark[] = [
  { id: 'r-win', name: 'God’s eye', to: 'eye', box: boxOf(WINDOW.c, WINDOW.h), pad: 0, glyph: 'clock', where: ['room'], side: 'r' },
  { id: 'r-shelf', name: 'Library', to: 'library?shelf', box: boxOf(HOME.shelf!.c, HOME.shelf!.h), pad: 0, glyph: 'clock', where: ['room', 'street', 'whole'] },
  { id: 'r-lens', name: 'Lens', to: 'lens', box: boxOf(HOME.lens!.c, HOME.lens!.h), pad: 3, glyph: 'star', where: ['room'] },
  { id: 'r-agenda', name: 'Agenda', to: 'agenda', box: boxOf(HOME.agenda!.c, HOME.agenda!.h), pad: 2, glyph: 'star', where: ['room'], side: 'r' },
  { id: 'r-brief', name: 'Brief', to: 'brief', box: boxOf(HOME.brief!.c, HOME.brief!.h), pad: 4, glyph: 'clock', where: ['room'], side: 'below' },
  { id: 'r-alice', name: 'Tonight’s book', to: 'library?shelf', box: boxOf(HOME.alice!.c, HOME.alice!.h), pad: 4, glyph: '', where: ['room', 'street', 'whole'] },
  { id: 'r-gym', name: 'Gym', to: 'gym', box: boxOf(HOME.gym!.c, HOME.gym!.h), pad: 3, glyph: 'star', where: ['room'], side: 'below' },
  { id: 'r-courses', name: 'Courses', to: 'learn', box: boxOf(HOME.courses!.c, HOME.courses!.h), pad: 4, glyph: 'star', where: ['room'], side: 'r' },
  { id: 'r-air', name: 'God’s eye', to: 'eye', box: boxOf([AIRCRAFT[0]![0], AIRCRAFT[0]![1], AIRCRAFT[0]![2]], [2.5, 1.2, 2.5]), pad: 4, glyph: 'clock', where: ['street', 'city', 'whole', 'line', 'out'] },
  { id: 'r-station', name: 'The station', to: 'alt:city', box: boxOf([STATION[0], 4.5, STATION[2]], [1.6, 4.5, 1.6]), pad: 4, glyph: 'clock', where: ['street', 'city', 'whole', 'line', 'out'], side: 'r below' },
  { id: 'r-dentist', name: 'Agenda', to: 'agenda', box: boxOf([DENTIST[0], 1.2, DENTIST[2]], [1.2, 1.2, 1.2]), pad: 4, glyph: 'star', where: ['city', 'whole', 'out'] },
  // him on the walk (OUT): ringed, a tap is a way home (the room)
  { id: 'r-me', name: 'You', to: 'alt:room', box: boxOf(ME_OUT, [1.0, 0.4, 1.0]), pad: 4, glyph: '', where: ['out'] },
  // the house: a tap goes into the room (the place he can go to)
  { id: 'r-house', name: 'Your house', to: 'alt:room', box: [-2.6, 0, -2.5, 2.6, 4.4, 3.0], pad: 0, glyph: '', where: ['street', 'city', 'out'] },
];

/** The marks shown at an altitude. */
export const marksAt = (alt: Altitude): Mark[] => MARKS.filter((m) => m.where.includes(alt));

/** The thing in focus at `alt`: the lit book (or the Brief by the hour) in every frame where it is marked. */
export const nowMark = (alt: Altitude, litId: string): Mark | undefined => MARKS.find((m) => m.id === litId && m.where.includes(alt));
