/**
 * The arcade's engines behind one small adapter: the player starts every game through `Engine.start` and nothing
 * else, so another engine (a DOOM or a Quake source port) plugs into the same player without touching it. The DOS
 * engine (engines/dos.ts) is the first; engines/index.ts is the registry the player looks an entry's engine up in.
 *
 * The shared input: the player owns one `Intent` (input.ts) for the whole game and keeps it current from the touch
 * layer and the gamepad layer. `moveX`/`moveY` and `held` say what is held NOW (the engine reads them every frame);
 * `lookX`/`lookY` ADD UP the degrees turned since the engine last looked, and the engine sets them back to 0 once it
 * has used them (so a drag is never lost or counted twice, whichever of the two runs first in a frame).
 */
import type { Intent } from '../input';
import type { SaveStore } from './saves';

export type { SaveStore } from './saves';

export interface EngineFiles { [path: string]: Uint8Array } // what the store unpacked for this game
export interface EngineHandle { pause(): void; resume(): void; quit(): Promise<void>; setSound(on: boolean): void }
export interface EngineEvents { onLevelDone?(score: number, words: string): void; onHit?(): void; onError?(e: Error): void }
export interface Engine {
  id: 'doom' | 'quake' | 'dos';
  start(canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean }): Promise<EngineHandle>;
}
