# The library searched by meaning on the phone, for the offline brain (OWNER-ISSUES 9; PLAN idea 8)

The owner's vision: "the library is literally intended for his offline brain." Today the phone keeps a copy of the
library (`apps/web/src/library/local.ts`: IndexedDB, `searchLocal` by keywords, `passagesFor`, `shelf()` stats) and
the offline brain reads the best passages before it answers (`offline/prompt.ts` `buildOfflinePrompt`, `offline/brain.ts`
`searchLocal`). Keywords miss meaning ("how do plants make food" never finds "photosynthesis"). Read BRIEF-W0.md, MAP.md,
those files, `offline/models.ts` (how WebLLM and its models are loaded, pinned revisions, download asked for, Wi-Fi), the
Library tab (`features/library/index.ts`), `tests/library.spec.mjs` and `tests/offlinebrain.spec.mjs`.

## Build
1. **An embedding model on the phone, no new package**: WebLLM ships embedding models in its prebuilt list
   (`snowflake-arctic-embed-s-q0f32-MLC-b4`, about 70 MB; the `-m` is about 130 MB); verify in the pinned WebLLM
   build the app loads that `engine.embeddings.create` (or the equivalent) exists there, and pick the small one. It
   is downloaded like the brain: asked for once, Wi-Fi only, with the size said, kept in the browser's cache, with a
   plain line in Settings → Offline brain ("Search by meaning: 70 MB, on this phone"). If the pinned build cannot
   embed, say so and stop: do not add a package.
2. **The index**: every passage of the phone's library copy gets a vector, computed in the background when the phone is
   idle and the model is loaded (batches, yielding to the screen; paused when the app is hidden; resumed where it
   stopped; the count shown: "4,120 of 8,556 passages indexed"); stored in IndexedDB beside the passages as Float32
   arrays (or int8 with a scale, if the size matters: say the bytes per passage); new passages indexed as they arrive;
   removed documents dropped. Nothing is ever sent anywhere.
3. **Search by meaning**: `searchLocal` and `passagesFor` rank by cosine similarity when the question's vector is there,
   blended with the keyword score (so exact names still win), falling back to keywords alone when the model is not
   loaded or the index is incomplete; pure ranking in a shared function with tests. The LIBRARY tab's "Ask the
   library" shows "by meaning" or "by keywords" in its small print, honestly.
4. **The offline brain reads the right passages**: `buildOfflinePrompt` takes the top passages by meaning (same budget
   as today), so offline answers come from the owner's books even when his words differ from the book's. The report
   card's LIBRARY area already measures library answers: nothing to change there, but say in your report what you
   expect to move.
5. **Honest limits**: the index is per phone; a reinstall rebuilds it; the small model is English-first; the words say so.

## Tests (each must fail on the old code)
Pure: the blended ranking (meaning beats a keyword miss; an exact title still wins; the fallback), int8 round-trip if
used, the idle scheduler's batches and pauses (fake clock). Spec `tests/meaning.spec.mjs` at 440 × 956 with a tiny fake
embedder injected for the test (deterministic vectors): the index fills and shows its count, "how do plants make food"
finds the photosynthesis passage by meaning, the small print says "by meaning", the fallback says "by keywords" with
the model off, the offline brain's prompt carries the passage (read it from `window.__ghosty`). Keep library,
offlinebrain, selftrain and thinkharder specs passing. `npm run check`; the full edge `npm test` once if you touch the
brain (you should not need to).

## Finish
Commit per step (do not push, do not merge). Report: whether the pinned WebLLM can embed and which model; bytes per
passage and the whole index's size for 8,556 passages; the ranking function; screenshots; every check's exact result;
the CI-loop line for `meaning`.
