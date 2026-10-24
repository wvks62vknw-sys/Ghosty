/**
 * SCHOOL in the brain: the offline brain (the model on the owner's phone) goes to school, from nursery to the whole
 * library, strictly in order (packages/shared/src/school.ts has the stages and the marking rules both halves share).
 * This file is what the kernel calls (two lines in agent.ts, marked `[school]`):
 *   - `schoolRoute` for /school and /school/* (school/routes.ts);
 *   - `schoolDaily` from the daily job path: pending marks tried again and the nightly school report.
 * The rest: state.ts (the record), papers.ts (the papers Ghosty writes), mark.ts (exact and model marking),
 * banks.ts (the checked question banks for Key Stage 3 to university), official.ts (the official papers, kept
 * private) and mock.ts (their stand-in model, only with the scripted test model).
 */
import type { Env } from '../env';
import { textOf } from '../llm/content';
import type { Router } from '../llm/router';
import { pushIfWanted } from '../notifyprefs';
import type { Ask } from './mark';
import { schoolMock } from './mock';
import { dailyReport, handleSchool, type SchoolDeps } from './routes';

/** What the brain hands SCHOOL: its storage (and KV), the model router and the owner's contact for pushes. Tests pass `ask`/`push` instead. */
export interface SchoolHost {
  env?: Pick<Env, 'SITES' | 'MOCK_LLM'>;
  storage: DurableObjectStorage;
  router?: Pick<Router, 'complete'>;
  contact?: string;
  ask?: Ask;
  /** The bank writer and checker, and the official papers' reader (tests pass one). */
  write?: Ask;
  fetcher?: typeof fetch;
  push?: SchoolDeps['push'];
  now?: () => number;
  random?: () => number;
}

/**
 * The marker: a stronger model than the one sitting the paper, from the router's background lane (only room above
 * the owner's chat), the cheap fast tier, and never waiting for room — with none free, the answer waits as pending.
 */
const routerAsk = (router: Pick<Router, 'complete'>, tier: 'small' | 'big' = 'small'): Ask => async (system, user) =>
  textOf((await router.complete([{ role: 'system', content: system }, { role: 'user', content: user }], [], undefined, { tier, priority: 'background', maxWaitMs: 0 })).message.content);

/** MARK MY WORK's marker: the owner is waiting on it, so the cheap tier in the chat's lane, waiting at most 8 s for room. */
const routerAskNow = (router: Pick<Router, 'complete'>): Ask => async (system, user) =>
  textOf((await router.complete([{ role: 'system', content: system }, { role: 'user', content: user }], [], undefined, { tier: 'small', maxWaitMs: 8000 })).message.content);

export function schoolDeps(h: SchoolHost): SchoolDeps {
  return {
    storage: h.storage,
    env: h.env,
    ask: h.ask ?? (h.router ? routerAsk(h.router) : undefined),
    askNow: h.ask ?? (h.router ? routerAskNow(h.router) : undefined),
    // Writing and checking banks, and reading official papers: the best model there is room for (the 'big' tier),
    // background lane, never waiting. With the scripted test model, SCHOOL's own stand-in (mock.ts).
    write: h.write ?? (h.env?.MOCK_LLM === '1' ? schoolMock : h.router ? routerAsk(h.router, 'big') : undefined),
    fetcher: h.fetcher,
    // The nightly report is a kind of its own (the SCHOOL tab's switch), so it is not one of LINKS' switches.
    push: h.push ?? ((msg) => pushIfWanted(h.storage, null, msg, h.contact)),
    now: h.now,
    random: h.random,
  };
}

/** /school and /school/* (owner-only). */
export const schoolRoute = (req: Request, path: string, method: string, host: SchoolHost): Promise<Response> => handleSchool(req, path, method, schoolDeps(host));

/** Once a day: pending marks tried again, then the school report when something happened (never throws). */
export const schoolDaily = (host: SchoolHost) => dailyReport(schoolDeps(host));

export { STATE_KEY, loadState } from './state';
