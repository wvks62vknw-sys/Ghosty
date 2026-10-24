/**
 * SEARCH BY MEANING on the phone: the index and the question's vector. Once the meaning model is on this phone
 * (offline/embed.ts; SETTINGS → OFFLINE BRAIN), every passage of the library copy (library/local.ts) is given its
 * vector in the background — a few at a time while Ghosty is open and nothing else needs the graphics chip, waiting
 * while it is in the background or the offline brain is busy, carrying on where it stopped (library/idle.ts) —
 * and kept beside the passage. New passages are done as they arrive; a removed document's go with it. The count
 * shows in SETTINGS and the LIBRARY tab ("4,120 of 8,556 passages indexed").
 *
 * Searches (local.ts searchLocalHow) then rank by meaning blended with the wording, once nearly every passage has
 * its vector (the newest few, still waiting, are found by their words meanwhile): until then, and whenever the
 * model is not here, by keywords — and the small print says which, and how many are still waiting.
 * Nothing is sent anywhere. The index belongs to this phone: another phone, or this one after Ghosty is
 * reinstalled (or its website data cleared), builds its own. The model reads English best.
 */
import { createStore } from '../core/store';
import { lastPrompt, offlineBrain, modelJob } from '../offline/brain';
import { embedReady, embedState, embedTexts, embedderWarm } from '../offline/embed';
import { meaningCovers } from '../../../../packages/shared/src/meaning';
import { runIndex } from './idle';
import { indexCounts, onLibraryChange, saveVectors, setQueryEmbedder, unindexed, type PassageKey } from './local';

/** The index's state: `indexed` of `total` passages have their vector; `how` the last search's ranking. */
export const meaningIndex = createStore({ indexed: 0, total: 0, running: false, waiting: false, error: '', how: '' as '' | 'meaning' | 'keywords' });

/** The model is here and the index covers the library (all but the newest few): a search would be by meaning. */
export const meaningComplete = (): boolean => {
  const s = meaningIndex.get();
  return embedState.get().downloaded && meaningCovers(s.indexed, s.total);
};

/** The model is needed elsewhere, or Ghosty is out of sight: the index waits. */
const mustWait = (): boolean =>
  (typeof document !== 'undefined' && document.visibilityState === 'hidden') || !!modelJob.get().job || !!offlineBrain.get().busy || offlineBrain.get().loaded;

let after: PassageKey | null = null;
let running: Promise<void> | null = null;
let again = false;
let stop: AbortController | null = null;

async function counts(): Promise<void> {
  const c = await indexCounts().catch(() => null);
  if (c) meaningIndex.set(c);
}

/** Give every passage that has none its vector (one run at a time; asked again while running, it runs once more). */
export function fillIndex(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await counts();
        if (!(await embedReady())) return;
        const { indexed, total } = meaningIndex.get();
        if (indexed >= total) {
          after = null;
          continue;
        }
        stop = new AbortController();
        meaningIndex.set({ running: true, error: '' });
        const base = indexed;
        const r = await runIndex({
          next: (from: PassageKey | null, n: number) => unindexed(from, n),
          embed: (texts: string[]) => embedTexts(texts, 'passage'),
          save: (items, vectors) => saveVectors(items, vectors),
          canRun: () => {
            const wait = mustWait();
            if (wait !== meaningIndex.get().waiting) meaningIndex.set({ waiting: wait });
            return !wait;
          },
          sleep: (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)),
          now: () => performance.now(),
          signal: stop.signal,
          after,
          onProgress: (kept: number, at: PassageKey | null) => {
            after = at;
            meaningIndex.set({ indexed: Math.min(meaningIndex.get().total, base + kept) });
          },
        });
        after = r.done ? null : r.after;
        await counts();
        // Reached the end with some still missing (they arrived before where it started): once more from the top.
        if (r.done && meaningIndex.get().indexed < meaningIndex.get().total && r.kept > 0) again = true;
      } while (again);
    } catch (e) {
      meaningIndex.set({ error: String((e as Error)?.message ?? e).slice(0, 160) });
    } finally {
      meaningIndex.set({ running: false, waiting: false });
      stop = null;
      running = null;
    }
  })();
  return running;
}

/** Stop the index after the batch in hand (the model was removed); it carries on from there next time. */
export function stopIndex(): void {
  stop?.abort();
}

let soon: ReturnType<typeof setTimeout> | undefined;
/** Catch the index up a little later (documents keep arriving while the library is copied). */
export function indexSoon(ms = 3000): void {
  clearTimeout(soon);
  soon = setTimeout(() => void fillIndex(), ms);
}

let started = false;
/**
 * At start-up: searches may ask for a question's vector, and the index keeps up with the library copy. Nothing
 * loads or downloads here: the index fills only once the owner has added the model.
 */
export function startMeaning(): void {
  if (started) return;
  started = true;
  setQueryEmbedder({
    ready: meaningComplete,
    async vector(q: string, load: boolean) {
      // No point loading the model for a search that could not use it (the index is not whole yet).
      if (!meaningComplete() || !(await embedReady())) return null;
      if (!load && !embedderWarm()) return null;
      return (await embedTexts([q], 'query'))[0] ?? null;
    },
  });
  onLibraryChange(() => indexSoon());
  embedState.subscribe((s, prev) => {
    if (s.downloaded && !prev.downloaded) void fillIndex();
    if (!s.downloaded && prev.downloaded) stopIndex();
  });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && indexSoon(1000));
  // The test handle (window.__ghosty, made by main.ts once the first tab is open): the index's state, the
  // model's, and the last prompt the offline brain was given (how its passages were found, their titles).
  const w = globalThis as unknown as { __ghosty?: Record<string, unknown> };
  const hook = () => {
    if (!w.__ghosty) return false;
    w.__ghosty.meaning = { index: () => meaningIndex.get(), model: () => embedState.get(), prompt: () => lastPrompt.get() };
    return true;
  };
  if (!hook()) {
    const t = setInterval(() => hook() && clearInterval(t), 500);
  }
  void counts().then(() => indexSoon(1500));
}
