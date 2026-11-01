/**
 * The arcade's inputs: the touch layer (a left virtual stick, drag-to-look on the right half, buttons under the thumbs)
 * and the gamepad layer (the Gamepad API's standard mapping) both fill the same Intent, which each engine turns into its
 * own keys and motions. Pure arithmetic here, so the node test can hold it to the numbers.
 */
import type { Control, EngineId } from './shelf';

/** What a button does in a game. */
export type Action = 'fire' | 'use' | 'weapon' | 'weaponPrev' | 'jump' | 'map' | 'run' | 'pause';

/** What the player is doing this frame. */
export interface Intent {
  /** Strafe: + right, − left (−1…1). */
  moveX: number;
  /** Walk: + forward, − back (−1…1). */
  moveY: number;
  /** Turn this frame in degrees: + right. */
  lookX: number;
  /** Look up (+) or down (−) this frame in degrees (engines without free look ignore it). */
  lookY: number;
  /** Buttons held now. */
  held: Set<Action>;
}

export const idle = (): Intent => ({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, held: new Set() });

/** A stick inside this much of its travel counts as centred. */
export const DEADZONE = 0.15;

/**
 * A stick's raw position (x right, y down, as both a thumb's offset and the Gamepad API give it) → a vector no longer
 * than 1, zero inside the dead zone, then rising smoothly from zero so a small push walks slowly.
 */
export function stick(x: number, y: number, dead = DEADZONE): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (!(len > dead)) return { x: 0, y: 0 };
  const m = Math.min(1, (len - dead) / (1 - dead));
  return { x: (x / len) * m, y: (y / len) * m };
}

/** The touch stick: the thumb's offset (px) from where it landed, over the stick's radius → move (screen y is down; forward is up). */
export function touchMove(dxPx: number, dyPx: number, radiusPx: number): { moveX: number; moveY: number } {
  const s = stick(dxPx / radiusPx, dyPx / radiusPx);
  return { moveX: s.x, moveY: s.y === 0 ? 0 : -s.y };
}

/** Degrees turned per pixel dragged at sensitivity 1 (a swipe across a 440-point screen turns about 100°). */
export const DEG_PER_PX = 0.23;

/** Drag-to-look: the finger's motion since the last frame (px) → degrees (dragging up looks up). */
export function touchLook(dxPx: number, dyPx: number, sensitivity = 1): { lookX: number; lookY: number } {
  return { lookX: dxPx * DEG_PER_PX * sensitivity, lookY: dyPx === 0 ? 0 : -dyPx * DEG_PER_PX * sensitivity };
}

/** Degrees per second the right stick turns at full tilt, at sensitivity 1. */
export const PAD_TURN_RATE = 200;

/** The right stick → degrees this frame: squared for fine aim near the centre, full rate at the edge. */
export function padLook(ax: number, ay: number, dtSeconds: number, sensitivity = 1): { lookX: number; lookY: number } {
  const s = stick(ax, ay);
  const curve = (v: number) => Math.sign(v) * v * v;
  const k = PAD_TURN_RATE * dtSeconds * sensitivity;
  return { lookX: curve(s.x) * k, lookY: s.y === 0 ? 0 : -curve(s.y) * k };
}

/** The standard mapping's button indices (W3C Gamepad, "Remapping"). */
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
/** The standard mapping's axes: left stick x/y, right stick x/y. */
export const AXIS = { MOVE_X: 0, MOVE_Y: 1, LOOK_X: 2, LOOK_Y: 3 } as const;

/** Each engine's buttons on a standard pad (the d-pad always walks and strafes; the sticks always move and look). */
export const PAD_BUTTONS: Record<EngineId, Partial<Record<number, Action>>> = {
  doom: { [BTN.RT]: 'fire', [BTN.A]: 'use', [BTN.X]: 'use', [BTN.B]: 'weapon', [BTN.RB]: 'weapon', [BTN.LB]: 'weaponPrev', [BTN.Y]: 'map', [BTN.SELECT]: 'map', [BTN.LT]: 'run', [BTN.START]: 'pause' },
  quake: { [BTN.RT]: 'fire', [BTN.A]: 'jump', [BTN.LT]: 'jump', [BTN.B]: 'weapon', [BTN.RB]: 'weapon', [BTN.LB]: 'weaponPrev', [BTN.X]: 'run', [BTN.START]: 'pause' },
};

/** The parts of a Gamepad this reads (so the tests can hand it a plain object). */
export interface PadLike {
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** A pad's state this frame → an Intent for this engine (null when the pad has no standard mapping: we do not guess). */
export function readPad(pad: PadLike, engine: EngineId, dtSeconds: number, sensitivity = 1): Intent | null {
  if (pad.mapping !== 'standard') return null;
  const ax = (i: number) => pad.axes[i] ?? 0;
  const on = (i: number) => {
    const b = pad.buttons[i];
    return !!b && (b.pressed || b.value > 0.5);
  };
  const m = stick(ax(AXIS.MOVE_X), ax(AXIS.MOVE_Y));
  let moveX = m.x;
  let moveY = m.y === 0 ? 0 : -m.y;
  if (on(BTN.UP)) moveY = 1;
  if (on(BTN.DOWN)) moveY = -1;
  if (on(BTN.LEFT)) moveX = -1;
  if (on(BTN.RIGHT)) moveX = 1;
  const held = new Set<Action>();
  for (const [i, a] of Object.entries(PAD_BUTTONS[engine])) if (a && on(Number(i))) held.add(a);
  return { moveX, moveY, ...padLook(ax(AXIS.LOOK_X), ax(AXIS.LOOK_Y), dtSeconds, sensitivity), held };
}

/** Both layers at once: moves add (clamped), looks add, buttons are held when either holds them. */
export function merge(a: Intent, b: Intent | null): Intent {
  if (!b) return a;
  const c = (v: number) => Math.max(-1, Math.min(1, v));
  return { moveX: c(a.moveX + b.moveX), moveY: c(a.moveY + b.moveY), lookX: a.lookX + b.lookX, lookY: a.lookY + b.lookY, held: new Set([...a.held, ...b.held]) };
}

/** What changed since the last frame: the buttons pressed and released (an engine turns these into key downs and ups). */
export function edges(prev: ReadonlySet<Action>, now: ReadonlySet<Action>): { down: Action[]; up: Action[] } {
  return { down: [...now].filter((a) => !prev.has(a)), up: [...prev].filter((a) => !now.has(a)) };
}

/** The touch buttons a game shows, in thumb order (the right thumb's main button first). */
export function touchButtons(controls: readonly Control[]): Action[] {
  const order: Action[] = ['fire', 'jump', 'use', 'weapon', 'map'];
  return order.filter((a) => (controls as readonly string[]).includes(a));
}
