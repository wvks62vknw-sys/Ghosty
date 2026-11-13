/**
 * The Lens's one view, its acts and its tools (BRIEF-LENS: READ, ASK, NAME, PEOPLE, SCAN, SEE are the acts under a tag; HANDS, AIM,
 * MEASURE, SOUND, SHAPES the tools under MORE) and the tiles it draws for them (features/lens/index.ts renders its tile row from this list). Pure, with
 * no camera and no DOM, so the ABILITIES catalogue reads the same list (apps/web/src/abilities/sources.ts) and its test can
 * too: a mode added here is listed there by itself, or the catalogue's test names it.
 */
export type LensMode = 'lens' | 'see' | 'read' | 'hands' | 'ask' | 'name' | 'people' | 'scan' | 'aim' | 'measure' | 'sound' | 'shapes';
export const LENS_MODES: readonly LensMode[] = ['lens', 'see', 'read', 'hands', 'ask', 'name', 'people', 'scan', 'aim', 'measure', 'sound', 'shapes'];

export const TILES: { id: LensMode; label: string; hint: string }[] = [
  // the one view (BRIEF-LENS): the camera with my marks over what I see; the rest are its acts and its tools, under MORE
  { id: 'lens', label: 'LENS', hint: 'point it, I tag what I see' },
  { id: 'see', label: 'SEE', hint: 'what is in view' },
  { id: 'read', label: 'READ', hint: 'text in a picture' },
  { id: 'hands', label: 'HANDS', hint: 'gestures drive it' },
  { id: 'ask', label: 'ASK', hint: 'a question + photo' },
  { id: 'name', label: 'NAME', hint: 'what it is called' },
  { id: 'people', label: 'PEOPLE', hint: 'you, and who you introduce' },
  { id: 'scan', label: 'SCAN', hint: 'codes · docs · translate' },
  { id: 'aim', label: 'AIM', hint: 'point at anything' },
  { id: 'measure', label: 'MEASURE', hint: 'sizes from a photo' },
  { id: 'sound', label: 'SOUND', hint: 'is it distorting?' },
  // [restc] SHAPES: a room drawn in the air with one finger, as a blueprint and in 3-D (apps/web/src/hands)
  { id: 'shapes', label: 'SHAPES', hint: 'draw a room in the air' },
];
