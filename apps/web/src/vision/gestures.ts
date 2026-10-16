/**
 * Hand gestures acting on the Lens (pure, no DOM). The recogniser answers every frame; this
 * turns that stream into one action per deliberate gesture: a gesture must be held for about
 * 600 ms, then it acts once, then nothing counts for 1.5 s, and the same gesture does not act
 * again until the hand lets go of it. A missed frame or two in the middle of a hold is forgiven.
 */
export type GestureAction = 'save' | 'freeze' | 'flip' | 'read' | 'stop';

/** MediaPipe's gesture names and what each does in the Lens. */
export const GESTURE_ACTIONS: Readonly<Record<string, GestureAction>> = {
  Thumb_Up: 'save',
  Open_Palm: 'freeze',
  Victory: 'flip',
  Pointing_Up: 'read',
  Closed_Fist: 'stop',
};

/** The HOW row: plain words for each gesture. */
export const GESTURE_HELP: readonly { gesture: string; sign: string; does: string }[] = [
  { gesture: 'Thumb_Up', sign: 'THUMBS UP', does: 'capture and save a SEE note to the library' },
  { gesture: 'Open_Palm', sign: 'OPEN PALM', does: 'freeze the picture, or unfreeze it' },
  { gesture: 'Victory', sign: 'TWO FINGERS', does: 'flip between the rear and front camera' },
  { gesture: 'Pointing_Up', sign: 'POINT UP', does: 'switch to READ and capture the text' },
  { gesture: 'Closed_Fist', sign: 'CLOSED FIST', does: 'stop the camera' },
];

/** The gesture name in plain words ("Thumb_Up" → "thumbs up"). */
export function gestureWords(name: string | null | undefined): string {
  if (!name || name === 'None') return 'no gesture';
  const help = GESTURE_HELP.find((g) => g.gesture === name);
  if (help) return help.sign.toLowerCase();
  return name.replace(/_/g, ' ').toLowerCase();
}

export interface GestureEvent {
  action: GestureAction;
  gesture: string;
}

export interface DebounceOptions {
  /** How long a gesture must be held before it acts (ms). */
  hold?: number;
  /** Quiet time after an action (ms). */
  cooldown?: number;
  /** Recogniser scores below this are ignored. */
  minScore?: number;
  /** A gap in sight of at most this long does not restart the hold (ms). */
  grace?: number;
}

export class GestureDebouncer {
  readonly hold: number;
  readonly cooldown: number;
  readonly minScore: number;
  readonly grace: number;
  private current: string | null = null;
  private since = 0;
  private lastSeen = 0;
  private firedAt = -Infinity;
  /** The gesture that acted and has not been let go of yet. */
  private locked: string | null = null;

  constructor(opts: DebounceOptions = {}) {
    this.hold = opts.hold ?? 600;
    this.cooldown = opts.cooldown ?? 1500;
    this.minScore = opts.minScore ?? 0.6;
    this.grace = opts.grace ?? 150;
  }

  /** Feed one recogniser answer at time `t` (ms); the action to take, or null. */
  feed(gesture: string | null | undefined, score: number, t: number): GestureEvent | null {
    const name = gesture && score >= this.minScore && GESTURE_ACTIONS[gesture] ? gesture : null;
    if (name) {
      if (name !== this.current) {
        this.current = name;
        this.since = t;
      }
      this.lastSeen = t;
    } else if (this.current && t - this.lastSeen > this.grace) {
      this.current = null;
    }
    if (this.locked && this.current !== this.locked) this.locked = null;
    if (!name || !this.current) return null;
    if (t - this.firedAt < this.cooldown) return null;
    if (this.locked === name) return null;
    if (t - this.since < this.hold) return null;
    this.firedAt = t;
    this.locked = name;
    return { action: GESTURE_ACTIONS[name]!, gesture: name };
  }

  /** The gesture being held right now (after a feed), if any. */
  get held(): string | null {
    return this.current;
  }

  /** True during the quiet time after an action. */
  coolingDown(t: number): boolean {
    return t - this.firedAt < this.cooldown;
  }

  /** How far the held gesture is through its hold, 0..1 (for the little bar on screen). */
  progress(t: number): number {
    if (!this.current || this.locked === this.current || this.coolingDown(t)) return 0;
    return Math.max(0, Math.min(1, (t - this.since) / this.hold));
  }

  reset(): void {
    this.current = null;
    this.locked = null;
    this.since = 0;
    this.lastSeen = 0;
    this.firedAt = -Infinity;
  }
}

/** MediaPipe's 21 hand landmarks, joined the way the hand is (for drawing). */
export const HAND_CONNECTIONS: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

/**
 * MediaPipe decides left/right as if the picture were a mirror (a selfie flipped horizontally).
 * The Lens feeds it the camera's raw frames, which are not flipped, so the names are swapped.
 */
export function handSide(name: string | null | undefined): string {
  if (name === 'Left') return 'right hand';
  if (name === 'Right') return 'left hand';
  return name ? name.toLowerCase() : '';
}
