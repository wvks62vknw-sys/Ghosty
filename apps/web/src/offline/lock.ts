/**
 * One job on the phone's model at a time (offline/brain.ts re-exports these): ordinary offline replies,
 * the settings TEST, THINK HARDER and the report card take turns. A STOP or a deadline interrupts whatever
 * the model is writing, so with turns it can only ever cut short its own job. Pure apart from the store, so
 * apps/edge/test/thinkharder.test.mjs tests it in node.
 */
import { createStore } from '../core/store';

export type ModelJob = 'chat' | 'test' | 'think' | 'bench';
/** What the model on the phone is doing now ('' = nothing). */
export const modelJob = createStore({ job: '' as '' | ModelJob });
let chain: Promise<unknown> = Promise.resolve();
let queued = 0;
const BUSY: Record<ModelJob, string> = {
  chat: 'The offline brain is answering a message right now: try again in a moment.',
  test: 'The offline brain is running its TEST: try again in a moment.',
  think: 'The offline brain is thinking hard about something: wait, or say "stop".',
  bench: 'The report card is using the offline brain right now: wait for it, or STOP it.',
};

/**
 * Run a job on the model with nothing else on it: ordinary replies, TEST, THINK HARDER and the report card
 * take turns, so one's STOP or deadline (which interrupts whatever the model is writing) can never cut
 * another's reply short. `wait: false` refuses at once, in words, when the model is taken (THINK HARDER and
 * the report card); an ordinary reply waits its turn.
 */
export function withModel<T>(job: ModelJob, fn: () => Promise<T>, opts: { wait?: boolean } = {}): Promise<T> {
  if (opts.wait === false && queued > 0) return Promise.reject(new Error(BUSY[modelJob.get().job || 'chat']));
  queued++;
  const run = chain.then(async () => {
    modelJob.set({ job });
    try {
      return await fn();
    } finally {
      queued--;
      modelJob.set({ job: '' });
    }
  });
  chain = run.catch(() => undefined);
  return run;
}
