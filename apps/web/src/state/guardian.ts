/**
 * THE GUARDIAN as the phone last heard it from the brain (GET /api/guardian; apps/edge/src/guardian.ts): the places watched
 * and what is active near them, when each feed was last read, the named person, the panic phrase's scrambled copy and a
 * walk under way. THREATS → NEAR HOME and Settings → GUARDIAN paint from it; the walk home and the panic phrase
 * (assistant/guard.ts) follow it. Fetched once the app is up and again whenever it comes back to the front.
 */
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import type { GuardianInfo } from '../../../../packages/shared/src/guardian';

export const guardian = createStore<{ info: GuardianInfo | null; at: number }>({ info: null, at: 0 });

/** Keep what the brain said: everything that shows it follows. */
export function setGuardian(info: GuardianInfo | null): void {
  if (info) guardian.set({ info, at: Date.now() });
}

export async function loadGuardian(): Promise<GuardianInfo | null> {
  try {
    const info = await brain.guardian();
    setGuardian(info);
    return info;
  } catch {
    return guardian.get().info;
  }
}

if (typeof document !== 'undefined') {
  setTimeout(() => {
    void loadGuardian();
    // for the specs: what the phone knows of the guardian, and a look now (window.__ghosty.guardian)
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.guardian = { get: () => guardian.get(), load: loadGuardian };
  }, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void loadGuardian();
  });
}
