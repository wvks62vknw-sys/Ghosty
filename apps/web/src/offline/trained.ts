/**
 * The phone keeps up with the weekly self-training without the owner opening its panel: at start and every few
 * hours it asks the brain for the trained brains (`/api/training`), hands the list, the recommended one and the
 * weight address to the offline brain (`setTrainedModels`), and says so when the brain's choice changed the
 * phone's (a ROLLBACK). Quiet when the brain is not reachable: the phone keeps the list it had.
 */
import type { BaseId } from '../../../../packages/shared/src/selftrain';
import { brain } from '../api/brain';
import { toast } from '../ui/components';
import { offlineBrain, setTrainedModels } from './brain';

export async function syncTrained(): Promise<void> {
  try {
    // A base chosen here while the brain could not be reached goes first (the training follows the phone's choice).
    const pending = offlineBrain.get().pendingBase;
    const s = pending ? await brain.selftrain.base(pending) : await brain.selftrain.status();
    if (pending) offlineBrain.set({ pendingBase: null });
    const note = setTrainedModels(s.models, s.active, s.weights, s.base);
    if (note) toast(note, 'warn');
  } catch {
    /* not reachable (or an older brain): next time */
  }
}

/**
 * The owner chose a brain of another base in SETTINGS → OFFLINE BRAIN (and it is on the phone): the weekly training
 * follows it (a fresh chain from that base's stock build; the brain keeps the old chain for ROLLBACK). Not reachable:
 * kept as `pendingBase` and sent with the next sync. Never sent for a fallback the phone made by itself.
 */
export async function followBase(base: BaseId): Promise<void> {
  // (always sent: the brain answers the same base with no change, and another phone may have moved it meanwhile)
  offlineBrain.set({ pendingBase: base });
  try {
    const s = await brain.selftrain.base(base);
    offlineBrain.set({ pendingBase: null });
    setTrainedModels(s.models, s.active, s.weights, s.base);
  } catch {
    /* not reachable: syncTrained sends it next time */
  }
}
