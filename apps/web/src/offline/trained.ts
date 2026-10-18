/**
 * The phone keeps up with the weekly self-training without the owner opening its panel: at start and every few
 * hours it asks the brain for the trained brains (`/api/training`), hands the list, the recommended one and the
 * weight address to the offline brain (`setTrainedModels`), and says so when the brain's choice changed the
 * phone's (a ROLLBACK). Quiet when the brain is not reachable: the phone keeps the list it had.
 */
import { brain } from '../api/brain';
import { toast } from '../ui/components';
import { setTrainedModels } from './brain';

export async function syncTrained(): Promise<void> {
  try {
    const s = await brain.selftrain.status();
    const note = setTrainedModels(s.models, s.active, s.weights);
    if (note) toast(note, 'warn');
  } catch {
    /* not reachable (or an older brain): next time */
  }
}
