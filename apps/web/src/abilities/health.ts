/**
 * A HEALTH MARK ON EVERY ABILITY (BRIEF-RELIABILITY 1): WORKING, DEGRADED, NEEDS KEY or OFFLINE, computed here and never written by
 * hand, from the brain's own account (GET /guardian/health: apps/edge/src/health.ts, one request, kept ten minutes, never on the first
 * screen's path) joined with the phone's own (whether it can be reached, the feeds the phone reads itself, a fallback in use). The one
 * rule is packages/shared/src/health.ts `markOf`; this file only gathers what it is given.
 *
 * Self-healing: a mark is computed afresh from the latest account every time, so a DEGRADED one clears the moment the next run
 * succeeds or the feed returns, and says "back since 14:02" for an hour after. RETRY runs the ability's own check (the read of the
 * list it keeps, or the feed's own refresh), and a check that goes right counts as the next run.
 */
import type { Ability } from '../../../../packages/shared/src/abilities';
import { BACK_FOR, clockOf, groupState, KIND_WORDS, markOf, stale, STALE_MS, topLine, type BrainHealth, type FailKind, type Mark } from '../../../../packages/shared/src/health';
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import { coins } from '../data/markets';
import { news } from '../data/news';
import { weather } from '../data/weather';
import { trail } from '../ui/hisWords';
import { allAbilities, go, screenName } from './registry';

/** How long the brain's account is kept on the phone before it is asked again. */
export const KEEP_MS = 10 * 60_000;

export const healthState = createStore(
  {
    /** The brain's last account, and when it came. */
    brain: null as BrainHealth | null,
    at: 0,
    /** The brain answered the last time it was asked. */
    reach: true,
    /** A check the phone ran itself that went right (group → when): counted as the next run. */
    local: {} as Record<string, number>,
    /** A fallback that was in use (kind → when it last was). */
    fallback: {} as Record<string, number>,
  },
  { persist: 'ghosty.health' },
);

// ---------------------------------------------------------------- the phone's own account

/** The screens that read a live feed: the feeds each reads (the phone's own Feeds, by the name STALE_MS knows them by). */
const SCREEN_FEEDS: Record<string, { name: string; feed: { at: number; status: string } }[]> = {
  brief: [{ name: 'weather', feed: weather }, { name: 'news', feed: news }],
  markets: [{ name: 'markets', feed: coins }],
};
/** The screens that need a signal to show anything live (the rest work on the phone alone). */
const NEEDS_SIGNAL = new Set(['brief', 'markets', 'threats', 'radio', 'eye', 'outside', 'social', 'links', 'house']);

/** The tool groups whose own list route is their check (RETRY), and the feeds each reads on the brain. */
const CHECKS: Record<string, () => Promise<unknown>> = {
  agenda: () => brain.agenda(),
  memory: () => brain.memory(),
  sites: () => brain.sites(),
  library: () => brain.library(),
  social: () => brain.social(),
  places: () => brain.places(),
  spending: () => brain.spending(),
  guardian: () => brain.guardianCheck(),
};
const GROUP_FEEDS: Record<string, string[]> = { guardian: ['flood', 'weather', 'crime'], crime: ['crime'] };

const signal = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

/** The group an ability id names: 'g:agenda' → agenda, 'g:extra:tool' → extra, 'g:evolve:learn' → evolve. */
export const groupOf = (a: Pick<Ability, 'id'>): string => a.id.split(':')[1] ?? '';

/** A fallback was used (the offline brain answering for the cloud, the offline map for the online one): DEGRADED for ten minutes. */
export function noteFallback(kind: 'brain' | 'map'): void {
  healthState.set((s) => ({ fallback: { ...s.fallback, [kind]: Date.now() } }));
}
const FALLBACK_FOR_MS = 10 * 60_000;
const fallingBack = (kind: string, now: number) => now - (healthState.get().fallback[kind] ?? 0) < FALLBACK_FOR_MS;

// ---------------------------------------------------------------- the mark of one ability

export interface Marked {
  mark: Mark;
  /** One reason, in his words ('' when WORKING and nothing is worth saying). */
  why: string;
  /** "back since 14:02": it was failing and has gone right in the last hour. */
  back?: number;
  /** The one thing to put it right. */
  fix?: 'key' | 'offline' | 'retry';
  /** The feed it is stale on, when that is the reason. */
  feed?: string;
}

const ago = (t: number, now: number): string => {
  const m = Math.max(1, Math.round((now - t) / 60_000));
  return m < 90 ? `${m} minutes` : m < 36 * 60 ? `${Math.round(m / 60)} hours` : `${Math.round(m / 1440)} days`;
};

/** The key an ability's `off` line names ("needs a key: SYSTEM → KEYS → GitHub token" → "GitHub token"). */
export const keyOf = (off: string): string => (/→\s*([^→]+?)\s*$/.exec(off)?.[1] ?? 'a key').replace(/^KEYS$/, 'a key');

export function markFor(a: Ability, now = Date.now()): Marked {
  const st = healthState.get();
  const h = st.brain;
  if (a.from === 'brain') {
    const key = !!a.off;
    const reach = st.reach && signal();
    const g = groupOf(a);
    const gh = h?.groups[g];
    const lastOk = Math.max(gh?.ok ?? 0, st.local[g] ?? 0);
    const state = groupState(gh ? { ...gh, ...(lastOk ? { ok: lastOk } : {}) } : undefined, now);
    const feedNames = GROUP_FEEDS[g] ?? [];
    const old = (h?.feeds ?? []).filter((f) => feedNames.includes(f.id) && (stale(f.id, f.at, now) || !!f.failed));
    const mark = markOf({ key, reach, failure: state.failing, stale: old.length > 0 });
    if (mark === 'NEEDS KEY') return { mark, why: `Needs a key: ${keyOf(a.off ?? '')}.`, fix: 'key' };
    if (mark === 'OFFLINE') return { mark, why: signal() ? 'I cannot reach my brain right now.' : 'There is no signal, and this one needs my brain.', fix: 'offline' };
    if (mark === 'DEGRADED') {
      const f = old[0];
      const why = state.failing ? `The last time I tried, ${KIND_WORDS[state.kind ?? 'rest']}.` : f ? `${f.name[0]!.toUpperCase()}${f.name.slice(1)}: ${f.at ? `last good read ${ago(f.at, now)} ago` : 'not read yet'}${f.failed ? `, ${KIND_WORDS[f.failed]}` : ''}.` : 'Something is off.';
      return { mark, why, fix: 'retry', ...(f && !state.failing ? { feed: f.id } : {}) };
    }
    return { mark, why: state.back ? `Back since ${clockOf(state.back)}.` : '', ...(state.back ? { back: state.back } : {}) };
  }
  // the app's own: they work on the phone alone, but for the ones that read a live feed
  const screen = a.id.startsWith('s:') ? a.id.slice(2) : '';
  const feeds = SCREEN_FEEDS[screen] ?? [];
  const noSignal = NEEDS_SIGNAL.has(screen) && !signal();
  const dead = feeds.filter((f) => f.feed.status === 'NO FEED');
  const old = feeds.filter((f) => f.feed.status === 'STALE' || stale(f.name, f.feed.at, now));
  const fallback = (screen === 'core' && fallingBack('brain', now)) || ((screen === 'space' || screen === 'eye') && fallingBack('map', now));
  const mark = markOf({ key: false, reach: !noSignal && !dead.length, failure: false, stale: old.length > 0, fallback });
  if (mark === 'OFFLINE') return { mark, why: noSignal ? 'This reads live feeds, and there is no signal.' : `${dead[0]!.name[0]!.toUpperCase()}${dead[0]!.name.slice(1)} cannot be reached right now.`, fix: 'offline' };
  if (mark === 'DEGRADED') {
    const f = old[0];
    const why = f ? `${f.name[0]!.toUpperCase()}${f.name.slice(1)} is ${f.feed.at ? ago(f.feed.at, now) : 'a while'} old${STALE_MS[f.name] ? ` (it should be under ${ago(0, STALE_MS[f.name]!)})` : ''}.` : screen === 'core' ? 'My brain on this phone is answering for the cloud.' : 'The offline map is standing in for the online one.';
    return { mark, why, fix: 'retry', ...(f ? { feed: f.name } : {}) };
  }
  return { mark, why: '' };
}

/** Every ability with its mark (the brain's as it last told this phone, and the app's own). */
export function allMarked(now = Date.now()): { a: Ability; m: Marked }[] {
  return allAbilities().map((a) => ({ a, m: markFor(a, now) }));
}
/** The brain cannot be reached, or the phone has no signal: the count then says what still works. */
export const isOffline = (): boolean => !healthState.get().reach || !signal();
export const countLine = (now = Date.now()): string => topLine(allMarked(now).map((x) => x.m.mark), isOffline());

/** The mark of the ability behind a screen (the deck's YOU CAN lines are the screen's). */
export const markOfScreen = (id: string, now = Date.now()): Mark => {
  const a = allAbilities().find((x) => x.id === `s:${id}`);
  return a ? markFor(a, now).mark : 'WORKING';
};

// ---------------------------------------------------------------- the account

let loading: Promise<BrainHealth | null> | null = null;
/**
 * The brain's account: kept ten minutes (one request, never on the first screen's path: this is called when a page that shows it
 * opens). `force`: ask now. A brain that cannot be reached leaves the kept account and says so (`reach`).
 */
export function loadHealth(force = false): Promise<BrainHealth | null> {
  const st = healthState.get();
  if (!force && st.brain && Date.now() - st.at < KEEP_MS && st.reach) return Promise.resolve(st.brain);
  loading ??= brain
    .brainHealth()
    .then((b) => {
      healthState.set({ brain: b, at: Date.now(), reach: true });
      return b;
    })
    .catch((e: unknown) => {
      trail(e, 'read my health');
      healthState.set({ reach: false });
      return null;
    })
    .finally(() => (loading = null));
  return loading;
}

/** RETRY: the ability's own check (the read of the list it keeps, or its feed's own refresh), then the account again. */
export async function retry(a: Ability): Promise<Marked> {
  const g = groupOf(a);
  const m = markFor(a);
  try {
    if (a.from === 'brain' && CHECKS[g]) {
      await CHECKS[g]!();
      healthState.set((s) => ({ local: { ...s.local, [g]: Date.now() } }));
    }
    if (m.feed === 'weather') await weather.refresh(true);
    if (m.feed === 'news') await news.refresh(true);
    if (m.feed === 'markets') await coins.refresh(true);
  } catch (e) {
    trail(e, `check ${a.id}`);
  }
  await loadHealth(true);
  return markFor(a);
}

/** Where the fix goes: the key's row, the offline brain's page, or the check. */
export function fixIt(a: Ability, m: Marked): void {
  if (m.fix === 'key') {
    go(a);
    // the row of that key, brought into view (the panel is drawn a moment after it opens)
    const want = keyOf(a.off ?? '').toLowerCase();
    let tries = 0;
    const find = () => {
      const row = [...document.querySelectorAll<HTMLElement>('.keyblock')].find((b) => (b.querySelector('.lab')?.textContent ?? '').toLowerCase().includes(want));
      if (row) return void row.scrollIntoView({ block: 'center' });
      if (++tries < 12) setTimeout(find, 200);
    };
    setTimeout(find, 250);
  }
}

/** For the checks (window.__ghosty.health). */
export const healthCheck = () => ({ marks: allMarked().map((x) => ({ id: x.a.id, mark: x.m.mark })), line: countLine(), at: healthState.get().at, reach: healthState.get().reach });
export { screenName, BACK_FOR };
export type { FailKind };
