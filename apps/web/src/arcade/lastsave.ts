/**
 * CONTINUE, for DOOM and Quake (APPS ROUND): which saved game each wrote last, noted as the engine writes it, so CONTINUE
 * PLAYING starts the engine on that save (DOOM's -loadgame, Quake's +load) instead of its title. Kept on the phone.
 */
import type { SaveStore } from './engines/saves';
import type { ShelfEntry } from './shelf';

/** Which saved game each native game wrote last ('doomsav2.dsg', 'id1/s0.sav'), kept on the phone, so CONTINUE loads it. */
export const LASTSAVE_KEY = 'ghosty.arcade.lastsave';
const lastSaves = (): Record<string, string> => {
  try {
    const v = JSON.parse(localStorage.getItem(LASTSAVE_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};
/** The game's saves, noting which saved game it writes (its settings files are not a saved game). */
export const lastSaveKept = (id: string, s: SaveStore): SaveStore => ({
  ...s,
  put: async (name, data) => {
    await s.put(name, data);
    if (/doomsav\d\.dsg$|(^|\/)s\d+\.sav$/i.test(name)) {
      try {
        localStorage.setItem(LASTSAVE_KEY, JSON.stringify({ ...lastSaves(), [id]: name }));
      } catch {
        /* this visit only */
      }
    }
  },
});
/** What CONTINUE gives DOOM's or Quake's engine to load the game saved last, or null (no save yet, or another engine). */
export function continueArgs(e: Pick<ShelfEntry, 'id' | 'engine'>, last: Record<string, string> = lastSaves()): string[] | null {
  const name = last[e.id] ?? '';
  const doom = /doomsav(\d)\.dsg$/i.exec(name);
  if (e.engine === 'doom' && doom) return ['-loadgame', doom[1]!];
  const quake = /(?:^|\/)(s\d+)\.sav$/i.exec(name);
  if (e.engine === 'quake' && quake) return ['+load', quake[1]!];
  return null;
}
