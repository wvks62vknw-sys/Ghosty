/**
 * The arcade's engines, as the player sees them: start one on a canvas with the files GET kept for the game, the
 * player's Intent and the game's SaveStore; get back a handle to pause, resume, quit and mute it. DOOM (doom.ts) and
 * Quake (quake.ts) implement it; the DOS engine will too.
 *
 * THE INTENT, SHARED: an engine keeps the one Intent object it was given and reads it on each of its own frames, so the
 * player updates that object in place (Object.assign) rather than handing over new ones. moveX/moveY and `held` are
 * states. lookX/lookY are AMOUNTS: the touch and pad layers add their degrees to them, and an engine sets both back to 0
 * once it has turned the player by them, so no drag is lost or turned twice whatever the two frame rates are.
 * The `pause` action opens the game's OWN menu (new game and its skill, save, load, options); the player's PAUSE sheet
 * calls pause() instead.
 */
import type { Intent } from '../input';
import type { SaveStore } from './saves';

export type { Intent, SaveStore };

/** What the store unpacked for this game: file name → bytes ('doom1.wad', 'pak0.pak'). */
export interface EngineFiles {
  [path: string]: Uint8Array;
}

export interface EngineHandle {
  pause(): void;
  resume(): void;
  /** Stop for good: the engine's settings and saves are written first, and the canvas's pixels are let go. */
  quit(): Promise<void>;
  setSound(on: boolean): void;
  /** What the engine is doing now (the harness reads it; a player may show the fps). */
  probe?(): EngineProbe;
}

export interface EngineEvents {
  /** A level finished: the engine's own tally as a score (bigger is better) and in words. */
  onLevelDone?(score: number, words: string): void;
  /** The player was hurt (a haptic tap). */
  onHit?(): void;
  /** The engine stopped on an error; the handle is finished. */
  onError?(e: Error): void;
  /** He chose QUIT in the game's own menu and said yes: back to the shelf (the handle is finished). */
  onQuit?(): void;
}

export interface StartOptions {
  saves: SaveStore;
  sound: boolean;
  /** Extra words for the engine's command line (DOOM: '-warp', '1', '1', '-skill', '3'; Quake: '+map', 'e1m1'). */
  args?: string[];
}

/** start() takes a canvas no engine has drawn on: a canvas keeps the kind of drawing it began with (DOOM draws in
 *  2-D, Quake in WebGL), so the player makes a fresh one for each game it starts. */
export interface Engine {
  id: 'doom' | 'quake' | 'dos';
  start(canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: StartOptions): Promise<EngineHandle>;
}

export interface EngineProbe {
  /** Frames drawn in the last whole second. */
  fps: number;
  /** Frames drawn since the start. */
  frames: number;
  /** Milliseconds from start() to the first frame of a level being played (null until then). */
  loadMs: number | null;
  /** The level being played ('E1M1', 'MAP01', 'e1m1'); null on a title, a demo, an intermission or a menu screen. */
  level: string | null;
  /** The player's position in map units (null outside a level). */
  pos: [number, number, number] | null;
  /** Which way the player faces, in degrees (null outside a level). */
  angle: number | null;
  /** The game's own menu is open. */
  menu: boolean;
  paused: boolean;
  /** Sound effects started since the start. */
  sounds: number;
}

/** An engine takes the look amounts: they are returned (in degrees) and set back to 0 in the Intent. */
export function takeLook(intent: Intent): { x: number; y: number } {
  const x = Number.isFinite(intent.lookX) ? intent.lookX : 0;
  const y = Number.isFinite(intent.lookY) ? intent.lookY : 0;
  intent.lookX = 0;
  intent.lookY = 0;
  return { x, y };
}

/** A command-line word list with `word` in it (an engine adds its own defaults only when the caller did not). */
export const hasArg = (args: readonly string[] | undefined, word: string): boolean => (args ?? []).some((a) => a.toLowerCase() === word);
