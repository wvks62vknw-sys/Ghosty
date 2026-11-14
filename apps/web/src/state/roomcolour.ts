/**
 * A COLOUR FOR EACH ROOM (NEXT ROUND, voice.u8): "make the money screen green" keeps green for Money alone, still named plainly. The
 * screen shows its colour while it is open and his own colour everywhere else; his saved look is never changed by it (the room's
 * colour is applied unsaved, and his kept look comes back on leaving). Kept on this phone. "Money screen back to normal" lets it go.
 */
import { isColour, type ColourKey } from '../../../../packages/shared/src/themes';
import { settings, ui } from './app';
import { applyRecipe, keptRecipe, recipe } from './theme';

const KEY = 'ghosty.roomcolours';

const read = (): Record<string, ColourKey> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
    return Object.fromEntries(Object.entries(v).filter(([, c]) => isColour(c))) as Record<string, ColourKey>;
  } catch {
    return {};
  }
};
let rooms = read();
/** Is a room's colour showing now (so leaving puts his own back)? */
let showing = false;

/** The room's own colour, or null. */
export const roomColour = (tab: string): ColourKey | null => rooms[tab] ?? null;
export const roomColours = (): Record<string, ColourKey> => ({ ...rooms });

/** Keep a room's colour (null: back to his colour there), and show it now if he is in that room. */
export function setRoomColour(tab: string, colour: ColourKey | null): void {
  const next = { ...rooms };
  if (colour) next[tab] = colour;
  else delete next[tab];
  rooms = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(rooms));
  } catch {
    /* storage refused: kept for this visit */
  }
  if (ui.get().tab === tab) show(tab);
}

function show(tab: string): void {
  const c = rooms[tab];
  if (c) {
    if (recipe().colour !== c) applyRecipe({ ...recipe(), colour: c }, { save: false, remember: false });
    showing = true;
  } else if (showing) {
    // his own look, as kept, comes back
    applyRecipe(keptRecipe(settings.get().theme), { save: false, remember: false });
    showing = false;
  }
}

ui.subscribe((s, p) => {
  if (s.tab !== p.tab) show(s.tab);
});
// (the app opened straight onto a room with its own colour: shown at once)
if (rooms[ui.get().tab]) show(ui.get().tab);

// for the checks and the console (window.__ghosty.roomcolour, set in main.ts)
export const probe = { roomColour, roomColours, setRoomColour };
