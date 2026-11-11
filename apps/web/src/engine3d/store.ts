/**
 * WHAT THE ENGINE KEEPS ON THIS PHONE (BRIEF-ENGINE-3D-1): the scene in front of him (saved as he works and brought back where he
 * left it) and the scenes he has named. localStorage `ghosty.engine3d`, through the app's store (the 200 ms save). Every scene read
 * back is validated (scene.ts `readScene`), so a damaged entry is dropped, never drawn.
 */
import { createStore } from '../core/store';
import { newScene, readScene, rename, type Scene } from './scene';

export interface SavedScene {
  id: string;
  name: string;
  at: number;
  scene: Scene;
}
interface EngineKept {
  current: Scene | null;
  saved: SavedScene[];
}

export const MAX_SAVED = 30;
export const engineStore = createStore<EngineKept>({ current: null, saved: [] }, { persist: 'ghosty.engine3d' });

/** The scene to open on: the one he left, else an empty one. */
export function currentScene(): Scene {
  return readScene(engineStore.get().current) ?? newScene();
}
export const setCurrent = (s: Scene): void => engineStore.set({ current: s });

/** His saved scenes, newest first, each validated. */
export function savedScenes(): SavedScene[] {
  return engineStore
    .get()
    .saved.flatMap((e) => {
      const scene = readScene(e?.scene);
      return scene && typeof e.id === 'string' ? [{ id: e.id, name: String(e.name ?? scene.name).slice(0, 40), at: Number(e.at) || 0, scene }] : [];
    })
    .sort((a, b) => b.at - a.at);
}

/** Name the scene and keep it; saving under a name already there replaces that one. */
export function saveAs(name: string, s: Scene, now = Date.now()): SavedScene {
  const scene = rename(s, name);
  const all = savedScenes();
  const same = all.find((e) => e.name.toLowerCase() === scene.name.toLowerCase());
  const entry: SavedScene = { id: same?.id ?? `s${now.toString(36)}`, name: scene.name, at: now, scene };
  engineStore.set({ saved: [entry, ...all.filter((e) => e.id !== entry.id)].slice(0, MAX_SAVED) });
  return entry;
}

export function forgetScene(id: string): SavedScene | null {
  const all = savedScenes();
  const gone = all.find((e) => e.id === id) ?? null;
  if (gone) engineStore.set({ saved: all.filter((e) => e.id !== id) });
  return gone;
}
export const restoreScene = (e: SavedScene): void => engineStore.set({ saved: [e, ...savedScenes().filter((x) => x.id !== e.id)].slice(0, MAX_SAVED) });
