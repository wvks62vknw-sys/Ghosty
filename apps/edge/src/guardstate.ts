/**
 * THE GUARDIAN's kept state, and what it adds to the one shared mind (guardian.ts does the watching, walk.ts the walking).
 * Apart so that mind.ts reads it without pulling in Telegram, email and the feeds: only the database and his places.
 */
import { clockIn, FEED_NAMES, type FeedId, type GuardWarning, type PanicSecret, type PlaceWatch, type WalkInfo } from '../../../packages/shared/src/guardian';
import type { DayLine } from '../../../packages/shared/src/mind';
import type { Env } from './env';
import type { PlaceArea } from './integrations/warnings';
import type { Vault } from './kernel/vault';
import { loadPlaces } from './places';
import type { ClientContext } from './prompt';
import { safeTz } from './time';

export const CONFIG_KEY = 'guardian:config';
export const WATCH_KEY = 'guardian:watch';
export const WALK_KEY = 'guardian:walk';

export interface Person {
  name: string;
  telegram?: string;
  email?: string;
  sharePos: boolean;
  /** Their Telegram chat, once they opened the bot with his invite. */
  chatId?: number;
  invite?: { code: string; at: number };
}

export interface GuardConfig {
  person?: Person;
  /** What the named person knows him as. */
  ownerName?: string;
  panic?: PanicSecret;
  lastPanic?: number;
}

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

export interface WalkState extends WalkInfo {
  via: 'app' | 'telegram';
  /** The last known position, only while the walk is under way (dropped when it ends). */
  pos?: { lat: number; lon: number; at: number };
  askedAt?: number;
  asked2At?: number;
  /** How the named person was reached, and whether the all-clear went to them. */
  alertVia?: 'telegram' | 'email';
  safeSent?: number;
  /** Sending to the named person failed this many times (tried again a minute later, three times at most). */
  tries?: number;
}

export interface GuardDeps {
  env: Env;
  storage: DurableObjectStorage;
  vault: Pick<Vault, 'get'>;
  /** The owner's notification: the inbox, his phone and his Telegram (agent.ts notify). */
  notify(item: { kind: 'reminder' | 'task' | 'error'; title: string; text: string }): Promise<unknown>;
  contact?: string;
  now?: () => number;
  /** For the tests: what would go out, instead of Telegram, email and the push service. */
  send?: {
    telegram?(chatId: number, text: string, button?: { label: string; id: string }): Promise<void>;
    email?(to: string, subject: string, body: string): Promise<void>;
    push?(msg: { title: string; body: string; tag?: string; url?: string }): Promise<number>;
  };
  /** The walking route's time (tests stand it in); minutes, or null. */
  route?(from: { lat: number; lon: number }, to: { lat: number; lon: number }): Promise<number | null>;
}

export const nowOf = (d: GuardDeps) => (d.now ? d.now() : Date.now());

export const saveConfig = (s: DurableObjectStorage, c: GuardConfig) => s.put(CONFIG_KEY, c);

/** His time zone, as his phone last said. */
export async function zoneOf(storage: DurableObjectStorage): Promise<string> {
  return safeTz(((await storage.get<ClientContext>('owner:ctx').catch(() => undefined)) ?? {}).tz);
}

/** How a message would go to the named person now ('' when it could not go at all). */
export async function personRoute(d: Pick<GuardDeps, 'vault' | 'send'>, p: Person | undefined): Promise<'telegram' | 'email' | ''> {
  if (!p) return '';
  if (p.chatId && (d.send?.telegram || (await d.vault.get('telegram').catch(() => null)))) return 'telegram';
  if (p.email && (d.send?.email || (await d.vault.get('email').catch(() => null)))) return 'email';
  return '';
}

export async function loadConfig(storage: DurableObjectStorage): Promise<GuardConfig> {
  const v = await storage.get<GuardConfig>(CONFIG_KEY);
  return v && typeof v === 'object' ? v : {};
}

export async function loadWatch(storage: DurableObjectStorage): Promise<WatchState> {
  const v = await storage.get<WatchState>(WATCH_KEY);
  return { places: v?.places ?? {}, told: v?.told ?? {}, checked: v?.checked ?? {}, failed: v?.failed ?? {} };
}

export async function loadWalk(storage: DurableObjectStorage): Promise<WalkState | null> {
  const v = await storage.get<WalkState>(WALK_KEY);
  return v && typeof v === 'object' && typeof v.eta === 'number' ? v : null;
}

/** A warning as it is named in a line: "flood alert", "yellow wind warning". */
export const levelWord = (w: GuardWarning) => (w.feed === 'flood' ? w.title.split(':')[0]!.toLowerCase() : w.title.toLowerCase().replace(/^(red|amber|yellow) warning of (.*)$/, '$1 $2 warning'));

/** What the guardian adds to the one shared mind (mind.ts): what is active near his places, a walk under way, and its "Home?". */
export async function guardianMind(storage: DurableObjectStorage, now: number, zone: string): Promise<{ doing: string[]; ahead: DayLine[] }> {
  const doing: string[] = [];
  const ahead: DayLine[] = [];
  const [places, st, w] = await Promise.all([loadPlaces(storage), loadWatch(storage), loadWalk(storage)]);
  for (const p of places) {
    for (const x of st.places[p.id]?.active ?? []) {
      if (x.until && x.until <= now) continue;
      if (x.since > now) ahead.push({ at: x.since, when: clockIn(x.since, zone), title: `${x.title} near ${p.label} (${FEED_NAMES[x.feed].source})`, kind: 'reminder' });
      else doing.push(`a ${levelWord(x)} is active near ${p.label} (${FEED_NAMES[x.feed].source}, since ${clockIn(x.since, zone)})`);
    }
  }
  if (w && w.stage !== 'done') {
    doing.push(w.stage === 'walking' ? `walking home, due ${clockIn(w.eta, zone)}` : w.stage === 'alerted' ? 'walking home: he did not answer, the named person was messaged' : `walking home: asked "Home?" at ${clockIn(w.askedAt ?? w.eta, zone)}, no answer yet`);
    if (w.stage === 'walking') ahead.push({ at: w.eta, when: clockIn(w.eta, zone), title: 'Home? (the walk home check-in)', kind: 'reminder' });
  }
  return { doing: doing.slice(0, 3), ahead };
}
