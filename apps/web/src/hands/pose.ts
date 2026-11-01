/**
 * SHAPES: the four hand shapes, read from the hand tracker's 21 points (MediaPipe's hand landmarks: 0 the wrist, 4 the
 * thumb's tip, 8 the index finger's, 12 the middle's, 16 the ring's, 20 the little finger's; 6, 10, 14, 18 their middle
 * joints; 9 the middle finger's knuckle). Pure (unit-tested in restc.test.mjs). From the points rather than the
 * recogniser's names, so a finger pointing sideways or down still draws.
 *   POINT  the index finger out, the others curled — the pen is down, the fingertip draws
 *   PINCH  the thumb's tip on the index finger's — place: finish the shape, put a piece down, pick a wall
 *   TWO    the index and middle fingers out — held half a second on a wall: cut a door (or a window)
 *   OPEN   the whole hand open — the pen lifts (move without drawing)
 */
export interface HandPoint {
  x: number;
  y: number;
}
export type Pose = 'point' | 'pinch' | 'two' | 'open' | 'fist' | 'none';

const d = (a: HandPoint, b: HandPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** The pose of one hand; 'none' when it is none of them (or the hand is not whole). */
export function poseOf(lm: readonly HandPoint[] | undefined): Pose {
  if (!lm || lm.length < 21) return 'none';
  const wrist = lm[0]!;
  const palm = d(wrist, lm[9]!) || 1e-6;
  // a finger is out when its tip is well beyond its middle joint, seen from the wrist
  const out = (tip: number, pip: number) => d(lm[tip]!, wrist) > d(lm[pip]!, wrist) * 1.12;
  if (d(lm[4]!, lm[8]!) / palm < 0.32) return 'pinch';
  const [index, middle, ring, little] = [out(8, 6), out(12, 10), out(16, 14), out(20, 18)];
  if (index && middle && !ring && !little) return 'two';
  if (index && !middle && !ring && !little) return 'point';
  if (index && middle && ring && little) return 'open';
  if (!index && !middle && !ring && !little) return 'fist';
  return 'none';
}

/** The four, for the first-open lesson and VoiceOver. */
export const LESSON: { pose: Pose; name: string; does: string }[] = [
  { pose: 'point', name: 'POINT', does: 'One finger out: draw a wall in the air' },
  { pose: 'pinch', name: 'PINCH', does: 'Thumb to finger: finish the shape, or put a piece down' },
  { pose: 'two', name: 'TWO FINGERS', does: 'Hold them on a wall: cut a door there (say “window” for a window)' },
  { pose: 'open', name: 'OPEN HAND', does: 'Lift the pen: move without drawing' },
];
