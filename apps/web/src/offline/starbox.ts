/**
 * The training records checked work makes (offline/star.ts), waiting on this phone until the brain takes them
 * (POST /api/training/star). Kept in localStorage `ghosty.star`; sent straight away when the brain is there, and
 * again whenever SYSTEM → OFFLINE BRAIN TRAINING or the LOOPS card opens. What the brain took is noted, for the
 * LOOPS card's numbers. State for specs at window.__ghosty.star.
 */
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import { newStarBox, queueStar, sentStars, type StarBox, type StarRecord } from './star';

export const starBox = createStore<StarBox>(newStarBox(), { persist: 'ghosty.star' });

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.star = starBox.get();
}

let sending: Promise<number> | null = null;

/** Send what is waiting; returns how many the brain took (0 when it is not reachable: they keep waiting). */
export function flushStars(): Promise<number> {
  sending ??= (async () => {
    const b = starBox.get();
    if (!b.queue.length) return 0;
    const batch = b.queue.slice(0, 40);
    try {
      const r = await brain.selftrain.star(batch);
      // Whatever the brain did not keep (its own day's cap, already waiting, refused) is not sent again.
      starBox.set((s) => sentStars(s, batch.length, Date.now()));
      expose();
      return r.kept;
    } catch {
      return 0;
    }
  })().finally(() => (sending = null));
  return sending;
}

/** A record from checked work: kept (today's cap allowing) and sent when the brain is there. True when kept. */
export function addStar(rec: StarRecord | null): boolean {
  const r = queueStar(starBox.get(), rec, Date.now());
  starBox.set(r.box);
  expose();
  if (r.added) void flushStars();
  return r.added;
}
