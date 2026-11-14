/**
 * THE APP LIBRARY's renderer registry (docs/build-plan/APPLIB.md, ENGINE 2): one renderer per archetype, each drawing an AppDef
 * into the kit app the engine has already built (its header, one scroll area, keys, notices, undo, Recently deleted, export).
 * The engine registers log, checklist, calc, timer, deck, counter, guide and screen (features/applib/renderers/*); the PLAY &
 * MAKE lane registers game from features/applib/games/**, and the DATA lane registers importer from features/applib/importer.ts.
 *
 * A renderer:
 *   - draws into `root` (the kit's one scroll area, `k.body`), and changes his things only through k.add, k.update and k.remove;
 *   - speaks only through k.notice (never a mid-screen toast);
 *   - keeps every colour a token and every class `ak-` (kit parts) or `al-` (Library parts);
 *   - returns a stop function if it holds a timer, a listener or a frame loop, so leaving the app stops it.
 */
import type { AppDef, Archetype } from '../../../../../packages/shared/src/applib/types';
import type { KitApp } from '../../ui/appkit';

export type Renderer = (root: HTMLElement, def: AppDef, k: KitApp) => void | (() => void);

const renderers = new Map<Archetype, Renderer>();

/** Register (or replace) the renderer for one archetype. */
export function registerRenderer(archetype: Archetype, fn: Renderer): void {
  renderers.set(archetype, fn);
}

/** The renderer for an archetype, if one is registered. */
export function rendererFor(archetype: Archetype): Renderer | undefined {
  return renderers.get(archetype);
}

/** The archetypes that can be drawn now. */
export const registeredArchetypes = (): Archetype[] => [...renderers.keys()];

/**
 * Draw after the kit draws: the kit redraws its list on every change (add, update, remove, undo, redo, search), so a renderer
 * that draws its own view hands `draw` here and it runs after each of the kit's own renders (which keeps the tour and the state
 * the kit tracks). Returns a function that puts the kit's own render back.
 */
export function redraw(k: KitApp, draw: () => void): () => void {
  const own = k.render;
  k.render = () => {
    own();
    draw();
  };
  k.render();
  return () => {
    k.render = own;
  };
}

/** Put one of the app's own keys along the bottom, before Undo and Redo (44 pt, the kit's key). */
export function toolKey(k: KitApp, el: HTMLElement): HTMLElement {
  const tools = k.el.querySelector('.ak-tools');
  tools?.insertBefore(el, tools.firstChild);
  return el;
}

/**
 * App Maker (the PLAY & MAKE lane, features/applib/maker.ts) registers itself here: the Library's MAKE MY OWN opens it, from
 * nothing or from a Library app to change. Its saved apps are listed in the Library through `registerAppSource`.
 */
export type Maker = (root: HTMLElement, from?: AppDef) => void | (() => void);
let maker: Maker | null = null;
export const registerMaker = (fn: Maker): void => void (maker = fn);
export const makerFn = (): Maker | null => maker;

/** More apps for the Library beyond LIBRARY (the ones he made in App Maker, kept on the phone). */
const sources: (() => AppDef[])[] = [];
export const registerAppSource = (fn: () => AppDef[]): void => void sources.push(fn);
export const extraApps = (): AppDef[] => sources.flatMap((fn) => { try { return fn(); } catch { return []; } });

/**
 * The lanes' own files, loaded by name when the Library opens (so no lane edits another's): features/applib/importer.ts (DATA),
 * features/applib/maker.ts and features/applib/games/index.ts (PLAY & MAKE). Each registers itself on import; one not there yet
 * is simply skipped.
 */
export const LANE_FILES = ['importer', 'maker', 'games/index'];
export async function loadLaneFiles(): Promise<void> {
  // (async, so a file not in the bundle is a refusal here, never a throw)
  await Promise.allSettled(LANE_FILES.map(async (n) => import(`./${n}.ts`)));
}
