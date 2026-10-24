/**
 * The background indexer's timetable (library/meaning.ts runs it; pure, so apps/edge/test/meaning.test.mjs runs it
 * on a fake clock). It works through the passages that have no meaning vector yet, a small batch at a time: after
 * at most `sliceMs` of work it rests `restMs` so the screen stays smooth; while `canRun()` is false (Ghosty is in
 * the background, or the offline brain is busy) it waits and asks again every `pauseMs`; a stop (`signal`) ends
 * it after the batch in hand. It carries on from the last passage it read (`after`), and the next run, given that
 * point back, starts there: nothing is ever worked out twice.
 */

export interface IndexItem<K> {
  key: K;
  text: string;
}

export interface IndexDeps<K, I extends IndexItem<K>> {
  /** Up to `n` passages with no vector, after `after` (null: from the start); `last` is the last one read. */
  next(after: K | null, n: number): Promise<{ items: I[]; last: K | null }>;
  /** Their vectors, in order. */
  embed(texts: string[]): Promise<ArrayLike<number>[]>;
  /** Keep them; returns how many were kept (a passage changed meanwhile is not). */
  save(items: I[], vectors: ArrayLike<number>[]): Promise<number>;
  /** False while the indexer must wait (hidden, or the model is needed for something else). */
  canRun(): boolean;
  sleep(ms: number): Promise<void>;
  now(): number;
  signal?: AbortSignal;
  /** Where to start: where the last run stopped. */
  after?: K | null;
  /** After each batch: how many were kept so far in this run, and where it has got to. */
  onProgress?(kept: number, after: K | null): void;
  batch?: number;
  sliceMs?: number;
  restMs?: number;
  pauseMs?: number;
}

export interface IndexRun<K> {
  kept: number;
  batches: number;
  /** Rests taken to give the screen a turn. */
  rests: number;
  /** Waits while it could not run. */
  pauses: number;
  /** Where it stopped (give it back as `after` to carry on). */
  after: K | null;
  /** True when it reached the end, false when it was stopped. */
  done: boolean;
}

export async function runIndex<K, I extends IndexItem<K>>(d: IndexDeps<K, I>): Promise<IndexRun<K>> {
  const batch = d.batch ?? 8;
  const sliceMs = d.sliceMs ?? 250;
  const restMs = d.restMs ?? 120;
  const pauseMs = d.pauseMs ?? 2000;
  const run: IndexRun<K> = { kept: 0, batches: 0, rests: 0, pauses: 0, after: d.after ?? null, done: false };
  let sliceStart = d.now();
  for (;;) {
    if (d.signal?.aborted) return run;
    if (!d.canRun()) {
      run.pauses++;
      await d.sleep(pauseMs);
      sliceStart = d.now();
      continue;
    }
    const { items, last } = await d.next(run.after, batch);
    if (!items.length) {
      run.after = last ?? run.after;
      run.done = true;
      return run;
    }
    const vectors = await d.embed(items.map((x) => x.text));
    run.kept += await d.save(items, vectors);
    run.batches++;
    run.after = last;
    d.onProgress?.(run.kept, run.after);
    if (d.now() - sliceStart >= sliceMs) {
      run.rests++;
      await d.sleep(restMs);
      sliceStart = d.now();
    }
  }
}
