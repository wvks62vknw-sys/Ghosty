/**
 * LOOKS THAT CHANGE BY THE CLOCK (NEXT ROUND, polish3.u7): one world by day and another by night (from his home's sunrise and sunset,
 * never his live position; 08:00 to 18:00 with no home saved), and calm motion from an hour he sets until 07:00. It changes the
 * look only when the day turns over or the calm hour comes, so anything he changes by hand in between stays until the next turn.
 * Kept on this phone.
 */
import { daylight, type WorldKey } from '../../../../packages/shared/src/themes';
import { createStore } from '../core/store';
import { applyRecipe, recipe, savedHome } from './theme';

export interface LookClock {
  on: boolean;
  day: WorldKey;
  night: WorldKey;
  /** The hour calm motion starts (until 07:00), or null for never. */
  calmFrom: number | null;
}
export const lookClock = createStore<LookClock & { last: string }>({ on: false, day: 'glass', night: 'scan', calmFrom: null, last: '' }, { persist: 'ghosty.lookclock' });

export const CALM_UNTIL = 7;

/** Calm at this hour? From `calmFrom` until 07:00, across midnight. Pure. */
export function calmAt(hour: number, calmFrom: number | null): boolean {
  if (calmFrom === null) return false;
  return calmFrom > CALM_UNTIL ? hour >= calmFrom || hour < CALM_UNTIL : hour >= calmFrom && hour < CALM_UNTIL;
}

/** What the clock calls for now: the world and whether motion is calm. Pure but for the sun's times, which come in. */
export function clockLook(c: LookClock, isDay: boolean, hour: number): { world: WorldKey; calm: boolean; key: string } {
  const world = isDay ? c.day : c.night;
  const calm = calmAt(hour, c.calmFrom);
  return { world, calm, key: `${world}:${calm ? 'calm' : 'alive'}` };
}

/** Look now: when the clock's call has changed since the last time, the look follows it (and is kept). */
export function lookByClock(now = Date.now()): boolean {
  const c = lookClock.get();
  if (!c.on) return false;
  const want = clockLook(c, daylight(now, savedHome()).day, new Date(now).getHours());
  if (want.key === c.last) return false;
  lookClock.set({ last: want.key });
  const r = recipe();
  if (r.world === want.world && (r.switches.motion === 'calm') === want.calm) return false;
  applyRecipe({ ...r, world: want.world, switches: { ...r.switches, motion: want.calm ? 'calm' : 'alive' } }, { save: true });
  return true;
}

let timer = 0;
/** Looked at once a minute while Ghosty is open, and at once when it starts or is switched on. */
export function startLookClock(): void {
  if (timer || typeof window === 'undefined') return;
  lookByClock();
  timer = window.setInterval(() => lookByClock(), 60_000);
  lookClock.subscribe((s, prev) => {
    if (s.on && (!prev.on || s.day !== prev.day || s.night !== prev.night || s.calmFrom !== prev.calmFrom)) {
      lookClock.set({ last: '' });
      lookByClock();
    }
  });
}
