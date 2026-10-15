/**
 * Widgets kept on this device: every widget Ghosty builds is stored here too, so it is never
 * lost while the brain's database is paused. The Workshop shows them alongside the brain's
 * own and saves any the brain doesn't have yet as soon as it can (syncLocalWidgets).
 */
import type { Widget } from '../../../../packages/shared/src/protocol';
import { createStore } from '../core/store';

export interface LocalWidget extends Widget {
  /** True once the brain has it. */
  synced: boolean;
}

export const localWidgets = createStore({ list: [] as LocalWidget[] }, { persist: 'ghosty.widgets.local' });

export function keepWidget(w: Widget, synced: boolean): void {
  localWidgets.set((s) => ({ list: [{ ...w, synced }, ...s.list.filter((x) => x.name !== w.name)].slice(0, 20) }));
}

export function forgetWidget(name: string): void {
  localWidgets.set((s) => ({ list: s.list.filter((x) => x.name !== name) }));
}

/** Save widgets the brain doesn't have yet. Returns how many were saved. */
export async function syncLocalWidgets(brainList: Widget[], save: (w: Widget) => Promise<unknown>): Promise<number> {
  const have = new Set(brainList.map((w) => w.name));
  let n = 0;
  for (const w of localWidgets.get().list) {
    if (have.has(w.name)) {
      if (!w.synced) localWidgets.set((s) => ({ list: s.list.map((x) => (x.name === w.name ? { ...x, synced: true } : x)) }));
      continue;
    }
    if (w.synced) continue; // deleted in the brain on purpose
    try {
      await save({ name: w.name, title: w.title, html: w.html, at: w.at });
      localWidgets.set((s) => ({ list: s.list.map((x) => (x.name === w.name ? { ...x, synced: true } : x)) }));
      n++;
    } catch {
      break; // still paused: try next time
    }
  }
  return n;
}
