/**
 * The engines the arcade's player can start, by the shelf entry's `engine` field: DOSBox for the DOS classics, DOOM
 * and Quake natively (doomgeneric in WebAssembly, WebQuake on WebGL), and the two games made by us, each its own
 * engine (games/: the block world and the runner). The shelf shows only the games an engine here plays today.
 */
import { dosFiles } from '../dos';
import { runnerEngine } from '../games/runner/index';
import { voxelEngine } from '../games/voxel/index';
import { type EngineId, keptAs, type ShelfEntry } from '../shelf';
import { doom } from './doom';
import { dosEngine } from './dos';
import { quake } from './quake';
import type { Engine, EngineFiles } from './types';

export const ENGINES: Partial<Record<EngineId, Engine>> = { dos: dosEngine, doom, quake, voxel: voxelEngine, runner: runnerEngine };

export const engineFor = (e: ShelfEntry): Engine | null => ENGINES[e.engine] ?? null;

/** It plays today (its engine is here). */
export const playsToday = (e: ShelfEntry): boolean => !!ENGINES[e.engine];

/** The kept files PLAY reads for it, as [where they are kept, file name]: the ones it plays, from its own package or
 *  the one it shares (Freedoom's two phases: one download, each phase its own IWAD); none for a game made by us. */
export const readsFor = (e: ShelfEntry): [string, string][] => (e.plays ?? e.data?.take.map((t) => t.name) ?? []).map((name) => [keptAs(e), name]);

/** What the player hands the engine: the kept files, plus what the entry adds for its engine (a DOS game's set-up). */
export const filesFor = (e: ShelfEntry, kept: EngineFiles): EngineFiles => (e.dos ? { ...kept, ...dosFiles(e.dos) } : kept);
