/**
 * THE FIRST CHECK OF A PUBLISHED BRAIN, from the phone's side (BRIEF-KERNEL-2 item 4). The brain the weekly training just offered
 * is the one in use here; what the phone sees of it first is told to the brain, which decides (packages/shared/src/selftrain.ts
 * firstCheckVerdict: a load failure, or a score below the brain before it by more than the training's own margin, rolls back to the
 * previous brain, once, and says so). Two things are reported, both things the phone already does: a load that failed (offline/brain.ts)
 * and the REPORT CARD, the phone's own fixed check, when it has been run on the new brain beside one run on the brain before it.
 * Quiet when the brain cannot be reached; the brain ignores a report it has no use for (not the brain in use, a late one, a repeat).
 */
import type { FirstCheck } from '../../../../packages/shared/src/selftrain';
import { brain } from '../api/brain';
import { toast } from '../ui/components';
import type { Run } from './bench';

const rightOf = (r: Run): [number, number] => [r.items.filter((x) => x.plain).length, r.items.length];

/**
 * The report for a finished REPORT CARD run of the brain `commit`: it loaded and answered (the run says so), and, when an earlier
 * complete run of ANOTHER brain is kept, its score beside that one's (plain answers, right over asked). Null for a run that did not finish.
 */
export function checkOf(history: Run[], run: Run, commit: string): FirstCheck | null {
  if (!run.complete || !run.items.length) return null;
  const before = [...history].reverse().find((x) => x.complete && x.items.length && x.model !== run.model);
  const [right, asked] = rightOf(run);
  const base: FirstCheck = { commit, loaded: true, answered: true };
  if (!before) return base;
  const [pr, pa] = rightOf(before);
  return { ...base, score: right / asked, previous: pr / pa, asked: Math.min(asked, pa) };
}

/** Tell the brain; when it rolled itself back, say so on the phone too (the brain tells him in his notifications as well). */
export async function reportFirstCheck(c: FirstCheck): Promise<void> {
  try {
    const r = await brain.selftrain.firstCheck(c);
    if (r.result === 'rolled-back') toast('The new brain failed its first check on this phone, so I rolled back to the one before it.', 'warn');
  } catch {
    /* not reachable (or an older brain): the brain keeps what it had */
  }
}
