/**
 * The engines the arcade's player can start, by the shelf entry's `engine` field. The shelf shows only the games an
 * engine here plays today; a game whose engine is not here yet keeps its registry row for when it comes.
 */
import { dosFiles } from '../dos';
import type { EngineId, ShelfEntry } from '../shelf';
import { dosEngine } from './dos';
import type { Engine, EngineFiles } from './types';

export const ENGINES: Partial<Record<EngineId, Engine>> = { dos: dosEngine };

export const engineFor = (e: ShelfEntry): Engine | null => ENGINES[e.engine] ?? null;

/** It plays today (its engine is here). */
export const playsToday = (e: ShelfEntry): boolean => !!ENGINES[e.engine];

/** What the player hands the engine: the kept files, plus what the entry adds for its engine (a DOS game's set-up). */
export const filesFor = (e: ShelfEntry, kept: EngineFiles): EngineFiles => (e.dos ? { ...kept, ...dosFiles(e.dos) } : kept);
