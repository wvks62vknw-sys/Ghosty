/**
 * AWARENESS (BRIEF-AWARENESS PR A): what every screen says about itself, in one place.
 *
 * A screen publishes `TabInstance.context()` (what is open, what is selected); a screen that has not got one is described from
 * its TabDef (its name, and its older `describe()` line when it has one), so every tab says at least `{screen, title, line}`.
 * An overlay (the deck of every screen) publishes on top of the tab underneath while it is open (`setOverlay`).
 * The turn carries it (`clientContext`: `screen`, and `screenLine`, the one line `contextWords` makes of it, which the brain
 * puts on his message as data), and the stamp line's LOOKING AT and the Core card's "Looking at" read the same context, so the
 * phone has one source for what is on screen.
 *
 * The boundary: nothing goes in a context that was not already on the screen, plus the selection's label and detail. The Lens
 * says counts and never who (features/lens/index.ts). Never live GPS: the saved place is the brain's Location line already.
 */
import { cleanScreen, contextWords, oneLineOf, type ClientContext, type ScreenContext } from '../../../../packages/shared/src/awareness';
import { home, settings, timeZone, ui } from '../state/app';
import { currentTab } from './tabs';

/**
 * A screen that sits over the tabs (the deck of every screen, the DESIGN A BUILD sheet): its context while it is open, else null.
 * The first one registered that is open speaks (the deck is built first and sits highest).
 */
type Overlay = () => ScreenContext | null;
const overlays = new Map<string, Overlay>();
export function setOverlay(name: string, fn: Overlay): void {
  overlays.set(name, fn);
}

/** What an overlay can do on "that one" (assistant/thatone.ts): the deck opens the card he has open. */
export const screenActs: { openCard?: (id: string) => boolean } = {};

/** A tab's title as he says it: "SPACE" → "Space". */
const nice = (t: string) => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);

/** The context of the tab on screen, from itself or, failing that, from its TabDef. */
export function tabContext(now = Date.now()): ScreenContext {
  const cur = currentTab();
  const id = ui.get().tab;
  if (!cur) return { screen: id, title: nice(id), line: `the ${id} screen`, at: now };
  const { def, inst } = cur;
  try {
    const own = cleanScreen(inst.context?.());
    if (own) return own;
  } catch (e) {
    console.warn('context', def.id, e);
  }
  let said = '';
  try {
    said = inst.describe?.() ?? '';
  } catch {
    said = '';
  }
  const title = nice(def.title);
  const line = oneLineOf(said, 160) || `the ${title.toLowerCase()} screen${def.blurb ? `, ${def.blurb}` : ''}`;
  return { screen: def.id, title, line: oneLineOf(line, 160), at: now };
}

/** What is on screen now: the overlay's while one is open, else the tab's. Always something (never null, never throws). */
export function screenContext(): ScreenContext {
  const now = Date.now();
  for (const [name, fn] of overlays) {
    try {
      const c = cleanScreen(fn());
      if (c) return c;
    } catch (e) {
      console.warn('overlay context', name, e);
    }
  }
  return tabContext(now);
}

/**
 * A question typed in the jump bar, or said to the deck, takes him to Home to be answered (the conversation lives there): the
 * screen he asked FROM is what he means by "this", so it is remembered for the turn that follows (8 seconds, used once). A
 * message he types on Home itself, or sends after any other wait, carries Home's own.
 */
let asked: { ctx: ScreenContext; at: number } | null = null;
export function askFromHere(): void {
  const c = screenContext();
  asked = c.screen === 'core' ? null : { ctx: c, at: Date.now() };
}
function askedScreen(): ScreenContext | null {
  const a = asked;
  asked = null;
  return a && Date.now() - a.at < 8000 && ui.get().tab === 'core' ? a.ctx : null;
}

/** What a stamp line says it is looking at, from the same context: its short form when the screen gave one, else its line, short enough for the stamp. */
export const STAMP_LOOK_MAX = 80;
export const lookingAt = (c: ScreenContext): string => oneLineOf(c.looking || c.line, STAMP_LOOK_MAX);

/** The last turn's context: what went with it ('' when it carried none), and the screen it left. The Core card's mark reads it. */
const lastTurn: { at: number; line: string; screen: string; had: boolean } = { at: 0, line: '', screen: '', had: false };

/**
 * What the phone sends with every turn to the brain (the one function: the chat and the Lens's questions both use it): his time,
 * his name, his saved place (never live GPS), the screen (`ScreenContext`) and its one line for the brain to paste.
 */
export function clientContext(spoken = false, who?: 'owner' | 'unknown' | { name: string }): ClientContext {
  const now = new Date();
  const screen = askedScreen() ?? screenContext();
  const screenLine = contextWords(screen);
  Object.assign(lastTurn, { at: now.getTime(), line: screen.line, screen: screen.screen, had: !!screen.line });
  return {
    now: now.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    tz: timeZone,
    tab: ui.get().tab,
    name: settings.get().name,
    location: home(),
    screen,
    screenLine,
    // Said into the microphone: the brain answers in its spoken style (persona.ts SPOKEN). `who`: the voice, as a label, when the
    // phone knew voices and scored this one (assistant/voiceknown.ts: owner, unknown, or the name of a person he introduced).
    ...(spoken ? { voice: who ?? true } : {}),
  };
}

/**
 * The mark on the Core card (STANDARD, the second habit): WORKING while the last turn carried a context (or no turn has gone
 * yet and this screen publishes one), DEGRADED when the last turn went without one, with the screen that published none.
 */
export function awarenessMark(): { state: 'working' | 'degraded'; looking: string; words: string } {
  // (the screen under the deck, not the deck: the Core card is found in it)
  const now = tabContext();
  const looking = now.line;
  if (lastTurn.at && !lastTurn.had) return { state: 'degraded', looking, words: `No screen context (screen ${lastTurn.screen || ui.get().tab} publishes none)` };
  return { state: 'working', looking, words: `Looking at: ${looking}` };
}

/** For the checks and the console (window.__ghosty.awareness, set in main.ts): the line a turn would carry now, and what the last turn carried. */
export const wordsNow = (): string => contextWords(screenContext());
export const lastSent = () => ({ ...lastTurn });
