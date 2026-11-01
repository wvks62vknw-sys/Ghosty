/**
 * A DOS game's set-up, as data, and the arithmetic of playing it with a thumb: which DOS keys the touch layer and the
 * gamepad hold this frame. Pure (no browser), so the node test holds it to the numbers; engines/dos.ts runs it.
 *
 * Each DOS entry on the shelf carries a `DosSetup`: the lines DOS runs (the game's folder and program), DOSBox's
 * speed and memory, the text files we write next to the game (its own set-up file, so it starts with Sound Blaster
 * sound and music and the keys our buttons press), and its CONTROLS block: what the stick presses (the arrows or
 * W A S D), what a drag does (the DOS mouse), and which key each button under the thumb is, with its label.
 */
import type { Action, Intent } from './input';

/** DOS keys by name → the emulator's key codes (the GLFW numbering js-dos uses). mouse1/mouse2 are the mouse buttons. */
export const KEYS: Readonly<Record<string, number>> = {
  ...Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map((c) => [c, c.toUpperCase().charCodeAt(0)])),
  ...Object.fromEntries([...'0123456789'].map((c) => [c, c.charCodeAt(0)])),
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i + 1}`, 290 + i])),
  space: 32, quote: 39, comma: 44, minus: 45, period: 46, slash: 47, semicolon: 59, equals: 61, lbracket: 91, backslash: 92, rbracket: 93,
  esc: 256, enter: 257, tab: 258, backspace: 259, insert: 260, delete: 261, right: 262, left: 263, down: 264, up: 265,
  pageup: 266, pagedown: 267, home: 268, end: 269, capslock: 280, kpenter: 335, shift: 340, ctrl: 341, alt: 342,
  rshift: 344, rctrl: 345, ralt: 346, mouse1: -1, mouse2: -2,
};

/** One button under the thumb: the slot it fills (the gamepad presses the same slot), the DOS key, its label. */
export interface DosButton {
  act: Action;
  key: string;
  label: string;
  /** A small key along the top edge (ESC, ENTER, a menu key) rather than a big one under the right thumb. */
  small?: boolean;
  /** Instead of `key`: each press presses the next of these (a WEAPON button walking through the number keys). */
  cycle?: string[];
}

export interface DosControls {
  /** What the stick (and the d-pad) presses: the arrow keys or W A S D. */
  stick: 'arrows' | 'wasd';
  /** Pushed nearly all the way, the stick holds this key too (DOOM's run). */
  run?: string;
  /** What a drag on the right half does: turn with the DOS mouse (sideways only, or both ways), or nothing. */
  drag: 'mouse-x' | 'mouse' | 'none';
  /** Mouse steps per degree dragged (each game's own feel). */
  mouseScale?: number;
  buttons: DosButton[];
}

export interface DosSetup {
  /** What DOS runs once the game is on drive C: ("cd KEEN4", "KEEN4E.EXE"). */
  run: string[];
  /** DOSBox's CPU speed: 'max' (as fast as this phone goes) or a fixed number of cycles (for games that race). */
  cycles: number | 'max';
  /** Memory in MB (16 unless a game asks more). */
  memsize?: number;
  /** Text files written next to the game before it starts (its own set-up: sound card, keys). */
  files?: Record<string, string>;
  controls: DosControls;
}

/** Where the set-up travels to the engine with the game's files (a bundle's own folder; DOSBox reads its conf there). */
export const CONF_PATH = '.jsdos/dosbox.conf';
export const CONTROLS_PATH = '.jsdos/ghosty-controls.json';

/** DOSBox's settings for a game: Sound Blaster 16 at 220/7/1 with its FM music, the S3 card, and its autoexec. */
export function dosConf(s: DosSetup): string {
  return [
    '[sdl]', 'autolock=false', '',
    '[dosbox]', 'machine=svga_s3', `memsize=${s.memsize ?? 16}`, '',
    '[render]', 'aspect=false', 'frameskip=0', '',
    '[cpu]', 'core=auto', 'cputype=auto', `cycles=${s.cycles === 'max' ? 'max' : `fixed ${s.cycles}`}`, '',
    '[mixer]', 'nosound=false', 'rate=44100', 'blocksize=1024', 'prebuffer=25', '',
    '[sblaster]', 'sbtype=sb16', 'sbbase=220', 'irq=7', 'dma=1', 'hdma=5', 'sbmixer=true', 'oplmode=auto', 'oplemu=default', 'oplrate=44100', '',
    '[gus]', 'gus=false', '',
    '[speaker]', 'pcspeaker=true', 'pcrate=44100', 'tandy=auto', 'disney=false', '',
    '[joystick]', 'joysticktype=none', '',
    '[dos]', 'xms=true', 'ems=true', 'umb=true', 'keyboardlayout=auto', '',
    '[ipx]', 'ipx=false', '',
    '[autoexec]', 'echo off', 'mount c .', 'c:', ...s.run, '',
  ].join('\n');
}

/** What the player adds to a DOS game's kept files: its DOSBox set-up, our text files, and its controls block. */
export function dosFiles(s: DosSetup): Record<string, Uint8Array> {
  const enc = new TextEncoder();
  const out: Record<string, Uint8Array> = {};
  // DOS text files end their lines with CR LF
  for (const [path, text] of Object.entries(s.files ?? {})) out[path] = enc.encode(text.replace(/\r?\n/g, '\r\n'));
  out[CONTROLS_PATH] = enc.encode(JSON.stringify(s.controls));
  out[CONF_PATH] = enc.encode(dosConf(s));
  return out;
}

/** What the thumbs held last frame: the stick's keys (held with a little stickiness so a thumb resting near a
 * threshold does not chatter), the buttons, and where each cycling button (WEAPON) has got to. */
export interface DosInputState {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  prev: Set<Action>;
  turn: Map<Action, number>;
}
export const freshInput = (): DosInputState => ({ x: 0, y: 0, prev: new Set(), turn: new Map() });
export const PRESS = 0.5;
export const RELEASE = 0.3;
export const RUN_AT = 0.92;

const axis = (v: number, was: -1 | 0 | 1): -1 | 0 | 1 => {
  if (v >= PRESS) return 1;
  if (v <= -PRESS) return -1;
  if (was === 1 && v > RELEASE) return 1;
  if (was === -1 && v < -RELEASE) return -1;
  return 0;
};

const STICKS = { arrows: { up: 'up', down: 'down', left: 'left', right: 'right' }, wasd: { up: 'w', down: 's', left: 'a', right: 'd' } } as const;

/** The DOS keys held this frame (key codes), from the shared Intent; moves the state on. */
export function keysHeld(intent: Intent, c: DosControls, st: DosInputState): Set<number> {
  st.x = axis(intent.moveX, st.x);
  st.y = axis(intent.moveY, st.y);
  const k = STICKS[c.stick];
  const out = new Set<number>();
  const add = (name: string | undefined) => {
    const code = name === undefined ? undefined : KEYS[name];
    if (code !== undefined) out.add(code);
  };
  if (st.y === 1) add(k.up);
  if (st.y === -1) add(k.down);
  if (st.x === -1) add(k.left);
  if (st.x === 1) add(k.right);
  if (c.run && Math.hypot(intent.moveX, intent.moveY) >= RUN_AT) add(c.run);
  for (const b of c.buttons) {
    if (!intent.held.has(b.act)) continue;
    if (b.cycle?.length) {
      // each new press moves on to the next key (DOOM's weapons: 2, 3, 4, 5, 1, …)
      if (!st.prev.has(b.act)) st.turn.set(b.act, ((st.turn.get(b.act) ?? -1) + 1) % b.cycle.length);
      add(b.cycle[st.turn.get(b.act) ?? 0]);
    } else add(b.key);
  }
  st.prev = new Set(intent.held);
  return out;
}

const CODES: Readonly<Record<string, string>> = {
  Escape: 'esc', Enter: 'enter', NumpadEnter: 'enter', Space: 'space', Tab: 'tab', Backspace: 'backspace', ArrowUp: 'up', ArrowDown: 'down',
  ArrowLeft: 'left', ArrowRight: 'right', ControlLeft: 'ctrl', ControlRight: 'rctrl', AltLeft: 'alt', AltRight: 'ralt', ShiftLeft: 'shift',
  ShiftRight: 'rshift', Comma: 'comma', Period: 'period', Minus: 'minus', Equal: 'equals', Slash: 'slash', Semicolon: 'semicolon', Quote: 'quote',
  BracketLeft: 'lbracket', BracketRight: 'rbracket', Backslash: 'backslash', PageUp: 'pageup', PageDown: 'pagedown', Home: 'home', End: 'end',
  Insert: 'insert', Delete: 'delete', CapsLock: 'capslock',
};
const CHARS: Readonly<Record<string, string>> = {
  ' ': 'space', ',': 'comma', '.': 'period', '-': 'minus', '=': 'equals', '/': 'slash', ';': 'semicolon', "'": 'quote', '[': 'lbracket',
  ']': 'rbracket', '\\': 'backslash', Enter: 'enter', Backspace: 'backspace', Escape: 'esc', Tab: 'tab', ArrowUp: 'up', ArrowDown: 'down',
  ArrowLeft: 'left', ArrowRight: 'right',
};

/** A keyboard's key (a real one, or the phone's own for a saved game's name or a cheat) → the DOS key, if it has one. */
export function keyOfEvent(code: string, key: string): number | undefined {
  const byCode = CODES[code] ?? /^Key([A-Z])$/.exec(code)?.[1]?.toLowerCase() ?? /^Digit(\d)$/.exec(code)?.[1] ?? (/^F([1-9]|1[0-2])$/.test(code) ? code.toLowerCase() : undefined);
  if (byCode) return KEYS[byCode];
  // a phone's on-screen keyboard often says only the character
  const byChar = CHARS[key] ?? (/^[a-z0-9]$/i.test(key) ? key.toLowerCase() : undefined);
  return byChar === undefined ? undefined : KEYS[byChar];
}

/** A drag's degrees → DOS mouse steps (sideways only for 'mouse-x'; dragging up moves the mouse up). */
export function mouseSteps(c: DosControls, lookX: number, lookY: number): { dx: number; dy: number } {
  if (c.drag === 'none') return { dx: 0, dy: 0 };
  const s = c.mouseScale ?? 4;
  return { dx: lookX * s, dy: c.drag === 'mouse' ? -lookY * s : 0 };
}
