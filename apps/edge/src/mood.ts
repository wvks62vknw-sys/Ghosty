/**
 * His mood, kept by the brain (OWNER-ISSUES 70b, 63, 69d; the state and its rules are packages/shared/src/mood.ts). One key,
 * written only by what the owner did: his words and his stop (agent.ts, telegram.ts), a GYM win (selftrain/cycle.ts), a
 * paper being sat (school/routes.ts), a long job (agent.ts). Read into every prompt as one line and into the status.
 */
import { moodAfter, moodNow, type Mood, type MoodEvent } from '../../../packages/shared/src/mood';

export const MOOD_KEY = 'mood';

/** His mood now (calm once it has faded). */
export async function loadMood(storage: DurableObjectStorage, now = Date.now()): Promise<Mood> {
  return moodNow(await storage.get<Mood>(MOOD_KEY), now);
}

/** What happened, felt: the mood after it, kept. */
export async function feel(storage: DurableObjectStorage, ev: MoodEvent, now = Date.now()): Promise<Mood> {
  const next = moodAfter(await storage.get<Mood>(MOOD_KEY), ev, now);
  await storage.put(MOOD_KEY, next);
  return next;
}
