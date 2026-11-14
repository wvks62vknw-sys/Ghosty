/**
 * NAMED SAVE SLOTS (APPS ROUND, the console-class Arcade): a game's saved files kept under a name he gives ("before the
 * boss"), so one game can hold several places to come back to, whatever its engine. KEEP copies every file the game has
 * saved into the slot; LOAD puts a slot's files back as the game's own (what was there is kept first as "Before loading",
 * so a LOAD can be undone); DELETE removes the slot. Every file stays on this phone, in the same store as the game's saves.
 */
import { type SaveStore, saveStore } from './engines/saves';

export const SLOTS_KEY = 'ghosty.arcade.slots';
/** The most slots one game keeps. */
export const SLOTS_EACH = 8;
/** The slot a LOAD keeps first, so it can be undone. */
export const BEFORE = 'Before loading';

export interface Slot {
  name: string;
  at: number;
  files: number;
}

/** Where a slot's files are kept: its own corner of the saves store. */
const slotStore = (game: string, name: string, make: (id: string) => SaveStore) => make(`${game}@slot:${name}`);

const readAll = (): Record<string, Slot[]> => {
  try {
    const v = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};
const writeAll = (v: Record<string, Slot[]>) => {
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(v));
  } catch {
    /* this visit only */
  }
};

export const slotsOf = (game: string): Slot[] => {
  const v = readAll()[game];
  return Array.isArray(v) ? v.filter((s) => s && typeof s.name === 'string').sort((a, b) => b.at - a.at) : [];
};

/** A slot's name as kept: trimmed, one line, at most 30 characters; empty when nothing usable was typed. */
export const cleanName = (raw: string): string => raw.replace(/[\u0000-\u001f\u007f/@]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30).trim();

async function copy(from: SaveStore, to: SaveStore): Promise<number> {
  for (const old of await to.list()) await to.remove(old);
  const names = await from.list();
  for (const n of names) {
    const b = await from.get(n);
    if (b) await to.put(n, b);
  }
  return names.length;
}

/** Keep the game's saved files now, under a name (an existing slot of that name is replaced). */
export async function keepSlot(game: string, raw: string, make: (id: string) => SaveStore = saveStore, now = Date.now()): Promise<Slot> {
  const name = cleanName(raw);
  if (!name) throw new Error('Give the slot a name first');
  const own = make(game);
  if (!(await own.list()).length) throw new Error('Nothing is saved in this game yet: save in the game first, then keep it here');
  const all = readAll();
  const list = (all[game] ?? []).filter((s) => s.name !== name);
  if (list.length >= SLOTS_EACH) throw new Error(`This game already keeps ${SLOTS_EACH} slots: delete one first`);
  const files = await copy(own, slotStore(game, name, make));
  const slot = { name, at: now, files };
  all[game] = [slot, ...list];
  writeAll(all);
  return slot;
}

/** Put a slot's files back as the game's own; what the game had is kept first as "Before loading". */
export async function loadSlot(game: string, name: string, make: (id: string) => SaveStore = saveStore, now = Date.now()): Promise<void> {
  const own = make(game);
  const from = slotStore(game, name, make);
  if (!(await from.list()).length) throw new Error('That slot has nothing in it any more');
  if (name !== BEFORE && (await own.list()).length) {
    const files = await copy(own, slotStore(game, BEFORE, make));
    const all = readAll();
    all[game] = [{ name: BEFORE, at: now, files }, ...(all[game] ?? []).filter((s) => s.name !== BEFORE)];
    writeAll(all);
  }
  await copy(from, own);
}

export async function deleteSlot(game: string, name: string, make: (id: string) => SaveStore = saveStore): Promise<void> {
  const s = slotStore(game, name, make);
  for (const n of await s.list()) await s.remove(n);
  const all = readAll();
  all[game] = (all[game] ?? []).filter((x) => x.name !== name);
  writeAll(all);
}

/** Whether the game has saved anything yet. */
export const hasSaves = async (game: string, make: (id: string) => SaveStore = saveStore): Promise<boolean> => (await make(game).list()).length > 0;
