/**
 * THE GUARDIAN's kept state, and what it adds to the one shared mind (guardian.ts does the watching). Apart so that
 * mind.ts reads it without pulling in the feeds: only the database and his places.
 */
import { clockIn, FEED_NAMES, type FeedId, type GuardWarning, type PlaceWatch } from '../../../packages/shared/src/guardian';
import type { DayLine } from '../../../packages/shared/src/mind';
import type { Env } from './env';
import type { PlaceArea } from './integrations/warnings';
import type { Vault } from './kernel/vault';
import { loadPlaces } from './places';
import type { ClientContext } from './prompt';
import { safeTz } from './time';

export const WATCH_KEY = 'guardian:watch';

export interface PlaceState {
  active: GuardWarning[];
  crime?: PlaceWatch['crime'];
  crimeAt?: number;
  area?: PlaceArea | null;
  areaAt?: number;
}

/** A warning he was told about: kept so it is never told twice, and so its all-clear is said once when it goes. */
export interface Told {
  at: number;
  place: string;
  feed: 'flood' | 'weather';
  /** How it is named in the all-clear ("flood alert", "yellow wind warning"). */
  what: string;
  until?: number;
  /** The all-clear was said (or a worse level of it was told instead). */
  clear?: number;
}

export interface WatchState {
  places: Record<string, PlaceState>;
  /** Warnings told, by "place|id@level". */
  told: Record<string, Told>;
  checked: Partial<Record<FeedId, number>>;
  failed: Partial<Record<FeedId, string>>;
}

export interface GuardDeps {
  env: Env;
  storage: DurableObjectStorage;
  vault: Pick<Vault, 'get'>;
  /** The owner's notification: the inbox, his phone and his Telegram (agent.ts notify). */
  notify(item: { kind: 'reminder' | 'task' | 'error'; title: string; text: string }): Promise<unknown>;
  now?: () => number;
}

export const nowOf = (d: GuardDeps) => (d.now ? d.now() : Date.now());

/** His time zone, as his phone last said. */
export async function zoneOf(storage: DurableObjectStorage): Promise<string> {
  return safeTz(((await storage.get<ClientContext>('owner:ctx').catch(() => undefined)) ?? {}).tz);
}

export async function loadWatch(storage: DurableObjectStorage): Promise<WatchState> {
  const v = await storage.get<WatchState>(WATCH_KEY);
  return { places: v?.places ?? {}, told: v?.told ?? {}, checked: v?.checked ?? {}, failed: v?.failed ?? {} };
}

/** A warning as it is named in a line: "flood alert", "yellow wind warning". */
export const levelWord = (w: GuardWarning) => (w.feed === 'flood' ? w.title.split(':')[0]!.toLowerCase() : w.title.toLowerCase().replace(/^(red|amber|yellow) warning of (.*)$/, '$1 $2 warning'));

/** What the guardian adds to the one shared mind (mind.ts): what is active near his places (and a warning that starts later). */
export async function guardianMind(storage: DurableObjectStorage, now: number, zone: string): Promise<{ doing: string[]; ahead: DayLine[] }> {
  const doing: string[] = [];
  const ahead: DayLine[] = [];
  const [places, st] = await Promise.all([loadPlaces(storage), loadWatch(storage)]);
  for (const p of places) {
    for (const x of st.places[p.id]?.active ?? []) {
      if (x.until && x.until <= now) continue;
      if (x.since > now) ahead.push({ at: x.since, when: clockIn(x.since, zone), title: `${x.title} near ${p.label} (${FEED_NAMES[x.feed].source})`, kind: 'reminder' });
      else doing.push(`a ${levelWord(x)} is active near ${p.label} (${FEED_NAMES[x.feed].source}, since ${clockIn(x.since, zone)})`);
    }
  }
  return { doing: doing.slice(0, 3), ahead };
}
