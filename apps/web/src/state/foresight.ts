/**
 * FORESIGHT as the phone last heard it from the brain (GET /api/foresight; apps/edge/src/foresight.ts): the predictions,
 * today's expectations, yesterday's line and the record per kind. Kept for 60 seconds, so the chat's no-model answers
 * ("what do you expect today?"), the Brief's FORESIGHT panel, the Report card and the Machine view's line ask once.
 */
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import type { ForesightInfo } from '../../../../packages/shared/src/foresight';

export const foresight = createStore<{ info: ForesightInfo | null; at: number }>({ info: null, at: 0 });

/** What the brain says now, or what it said in the last minute (`fresh`: ask again whatever). null: never heard. */
export async function loadForesight(fresh = false): Promise<ForesightInfo | null> {
  const s = foresight.get();
  if (!fresh && s.info && Date.now() - s.at < 60_000) return s.info;
  try {
    const info = await brain.foresight();
    foresight.set({ info, at: Date.now() });
    return info;
  } catch {
    return s.info;
  }
}

/** His word on one of his questions (RIGHT / WRONG / UNKNOWN): what the brain holds afterwards, kept. */
export async function resolveForesight(id: string, right: boolean | null): Promise<ForesightInfo & { said: string }> {
  const r = await brain.resolveForesight(id, right);
  foresight.set({ info: r, at: Date.now() });
  return r;
}
