/**
 * Widgets kept on this device: every widget Ghosty builds is stored here too, so it is never
 * lost while the brain's database is paused. The Workshop shows them alongside the brain's
 * own and, when the brain is reachable, saves new or changed ones and carries out deletions
 * made while it wasn't (syncLocalWidgets).
 */
import type { Widget } from '../../../../packages/shared/src/protocol';
import { createStore } from '../core/store';

export interface LocalWidget extends Widget {
  /** True once the brain has this exact version. */
  synced: boolean;
}

export const localWidgets = createStore({ list: [] as LocalWidget[], deleted: [] as string[] }, { persist: 'ghosty.widgets.local' });

const mark = (name: string, synced: boolean) => localWidgets.set((s) => ({ list: s.list.map((x) => (x.name === name ? { ...x, synced } : x)) }));

export function keepWidget(w: Widget, synced: boolean): void {
  localWidgets.set((s) => ({ list: [{ ...w, synced }, ...s.list.filter((x) => x.name !== w.name)].slice(0, 20), deleted: (s.deleted ?? []).filter((n) => n !== w.name) }));
}

/** Forget a widget here and remember to delete it in the brain if that can't happen now. */
export function forgetWidget(name: string, pendingInBrain: boolean): void {
  localWidgets.set((s) => ({ list: s.list.filter((x) => x.name !== name), deleted: pendingInBrain ? [...new Set([...(s.deleted ?? []), name])] : (s.deleted ?? []).filter((n) => n !== name) }));
}

/** The Workshop list: unsynced local versions win over the brain's, pending deletions are hidden. */
export function mergeWidgets(brainList: Widget[]): Widget[] {
  const { list, deleted = [] } = localWidgets.get();
  const local = list.filter((x) => !x.synced);
  const names = new Set(local.map((x) => x.name));
  return [...local, ...brainList.filter((w) => !names.has(w.name))].filter((w) => !deleted.includes(w.name));
}

/**
 * Bring the brain up to date: carry out deletions made while it was unreachable, and save any
 * widget whose local version it doesn't have (new, or changed while paused). Stops at the first
 * failure (still paused) and tries again next time. Returns how many widgets were saved.
 */
export async function syncLocalWidgets(brainList: Widget[], api: { save: (w: Widget) => Promise<unknown>; remove: (name: string) => Promise<unknown> }): Promise<number> {
  for (const name of localWidgets.get().deleted ?? []) {
    try {
      await api.remove(name);
      localWidgets.set((s) => ({ deleted: (s.deleted ?? []).filter((n) => n !== name) }));
    } catch {
      return 0;
    }
  }
  const have = new Map(brainList.map((w) => [w.name, w]));
  let n = 0;
  for (const w of localWidgets.get().list) {
    if (w.synced) continue; // the brain had this version (if it's gone there, it was deleted on purpose)
    const b = have.get(w.name);
    if (b && b.html === w.html) {
      mark(w.name, true);
      continue;
    }
    try {
      await api.save({ name: w.name, title: w.title, html: w.html, at: w.at });
      mark(w.name, true);
      n++;
    } catch {
      break; // still paused: try next time
    }
  }
  return n;
}
