/**
 * THE KEYBOARD LAYER (APPS ROUND): a hardware keyboard (an iPad's, a Bluetooth one, a computer's) plays DOOM and Quake as the
 * touch and controller layers do, filling the same Intent. The games made here and the DOS classics read keys themselves, so
 * this layer is only for the two native engines. Pure: the keys held in, the Intent out.
 */
import { type Action, idle, type Intent } from './input';

/** Turning speed with the arrow keys, degrees a second. */
export const TURN_DEG_S = 150;

/** Which key does what, by the key's place on the board (event.code), so it works on any layout. */
export const KEY_ACTIONS: Record<string, Action> = {
  Space: 'fire',
  ControlLeft: 'fire',
  ControlRight: 'fire',
  KeyF: 'fire',
  KeyE: 'use',
  Enter: 'use',
  KeyQ: 'weapon',
  KeyR: 'weaponPrev',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Tab: 'map',
  KeyM: 'map',
  KeyC: 'jump',
  Escape: 'pause',
};

/** The keys that move and turn. */
export const KEY_MOVES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** Every key the layer takes (so the page does not also scroll or move focus with them). */
export const takes = (code: string): boolean => code in KEY_ACTIONS || KEY_MOVES.includes(code);

/** The Intent the keys held make this frame: W/S or ↑/↓ walk, A/D strafe, ←/→ turn, and the action keys. */
export function keysIntent(down: ReadonlySet<string>, dtSeconds: number): Intent {
  const out = idle();
  const on = (c: string) => down.has(c);
  out.moveY = (on('KeyW') || on('ArrowUp') ? 1 : 0) - (on('KeyS') || on('ArrowDown') ? 1 : 0);
  out.moveX = (on('KeyD') ? 1 : 0) - (on('KeyA') ? 1 : 0);
  out.lookX = ((on('ArrowRight') ? 1 : 0) - (on('ArrowLeft') ? 1 : 0)) * TURN_DEG_S * dtSeconds;
  for (const c of down) {
    const a = KEY_ACTIONS[c];
    if (a) out.held.add(a);
  }
  return out;
}

/** The keyboard's lines for a game page and the CONTROLS sheet. */
export const KEY_LINES = [
  'W A S D or the arrow keys walk; ← and → turn.',
  'Space, F or Ctrl fires · E or Enter uses · Q next weapon · R the one before.',
  'Shift runs · Tab or M the map · C jumps · Esc the game’s menu.',
];
