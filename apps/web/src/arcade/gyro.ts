/**
 * GYRO AIM (APPS ROUND): in DOOM and Quake, turning the phone turns the view, added to the drag and the right stick. Off until
 * he turns it on in PAUSE (an iPhone asks him first, in that tap). Pure: the phone's turning rate in, the look out.
 * The rate's sign and how it maps to the screen's turn are a first estimate from the web's motion events, tuned on a phone.
 */

/** How much of the phone's turn the view takes (1: one degree of turn, one degree of view). */
export const GYRO_GAIN = 1.2;
/** Below this many degrees a second the hand's tremor is ignored. */
export const GYRO_DEADZONE = 3;
export const GYRO_KEY = 'ghosty.arcade.gyro';

export interface Rate {
  /** Degrees a second around the axis out of the screen, across it (left to right) and along it (bottom to top). */
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

const dz = (v: number) => (Math.abs(v) < GYRO_DEADZONE ? 0 : v);

/**
 * The look this frame from the phone's turning rate. Held upright, turning about its long side (gamma) turns the view and
 * tipping it (beta) looks up and down; on its side (the screen turned 90 or 270 degrees) the two swap.
 */
export function gyroLook(r: Rate, screenAngle: number, dtSeconds: number, gain = GYRO_GAIN): { lookX: number; lookY: number } {
  const a = ((Math.round(screenAngle / 90) * 90) % 360 + 360) % 360;
  const beta = dz(r.beta ?? 0);
  const gamma = dz(r.gamma ?? 0);
  const k = gain * dtSeconds;
  if (a === 90) return { lookX: -beta * k, lookY: -gamma * k };
  if (a === 270) return { lookX: beta * k, lookY: gamma * k };
  if (a === 180) return { lookX: gamma * k, lookY: -beta * k };
  return { lookX: -gamma * k, lookY: beta * k };
}

export const gyroOn = (): boolean => {
  try {
    return localStorage.getItem(GYRO_KEY) === 'on';
  } catch {
    return false;
  }
};
export const setGyro = (on: boolean): void => {
  try {
    localStorage.setItem(GYRO_KEY, on ? 'on' : 'off');
  } catch {
    /* this visit only */
  }
};
