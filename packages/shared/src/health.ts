/**
 * HEALTH (BRIEF-RELIABILITY): a mark on every ability, computed and never written by hand, and the shapes the brain's health route
 * (apps/edge/src/health.ts, GET /guardian/health) and the phone (apps/web/src/abilities/health.ts) share.
 *
 * Four marks, said as words (never a colour alone):
 *   NEEDS KEY  a key the brain does not have (the group's own `off` line; the key is named by its name only, never its value)
 *   OFFLINE    the brain cannot be reached, or the ability needs a feed the phone cannot reach right now
 *   DEGRADED   the last run of one of its tools failed, a feed it reads is older than its own staleness, or a fallback is in use
 *   WORKING    otherwise
 * A DEGRADED mark clears itself when the next run succeeds or the feed returns, and says "back since 14:02" for an hour after.
 *
 * Pure: no DOM, no storage, no network. Tested in apps/edge/test/health.test.mjs.
 */
import type { Trail } from './abilities';

export type Mark = 'WORKING' | 'DEGRADED' | 'NEEDS KEY' | 'OFFLINE';
export const MARKS: Mark[] = ['WORKING', 'DEGRADED', 'NEEDS KEY', 'OFFLINE'];

/** What the mark is computed from. */
export interface Signals {
  /** The key the ability needs is missing. */
  key: boolean;
  /** The brain (or the feed) can be reached now. */
  reach: boolean;
  /** The last run of one of its tools failed. */
  failure: boolean;
  /** A feed it reads is older than its own staleness. */
  stale: boolean;
  /** A fallback is in use (the offline brain answering for the cloud, the offline map for the online one). */
  fallback?: boolean;
}

/**
 * The one rule. A missing key first (it needs him, online or not, and what the brain last said about it is still true); then no
 * reach; then anything that makes it worse than it should be; else working.
 */
export function markOf(s: Signals): Mark {
  if (s.key) return 'NEEDS KEY';
  if (!s.reach) return 'OFFLINE';
  if (s.failure || s.stale || s.fallback) return 'DEGRADED';
  return 'WORKING';
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** How old each feed's last good read may be before the ability that reads it is DEGRADED. */
export const STALE_MS: Record<string, number> = {
  weather: 3 * HOUR,
  news: 6 * HOUR,
  markets: DAY,
  mot: 30 * DAY,
  // the guardian's three public feeds (the hourly watch): the weather warnings go with the weather, the flood warnings are as quick,
  // and the street crime is read once a day and published monthly
  flood: 3 * HOUR,
  crime: 2 * DAY,
};
export const stale = (feed: string, at: number | undefined, now: number): boolean => {
  const limit = STALE_MS[feed];
  return limit !== undefined && !!at && now - at > limit;
};

/** How long "back since 14:02" is said after a mark clears. */
export const BACK_FOR = HOUR;

// ---------------------------------------------------------------- the kinds of failure (never a raw text)

export type FailKind = 'key' | 'timeout' | 'network' | 'limit' | 'notfound' | 'rest';

/** A failure's kind from its text (the text itself is never kept or sent: only the kind). */
export function failKind(text: string | undefined): FailKind {
  const t = text ?? '';
  if (/\b40[13]\b|unauthori[sz]ed|forbidden|invalid (?:api )?key|no key|needs? a key|missing key|not linked|not configured|api key/i.test(t)) return 'key';
  if (/\b429\b|rate.?limit|quota|too many requests|no room|cooling|allowance/i.test(t)) return 'limit';
  if (/time(?:d)? ?out|took too long|deadline|\b504\b/i.test(t)) return 'timeout';
  if (/\b404\b|not found|no such|does not exist|nothing (?:is )?published/i.test(t)) return 'notfound';
  if (/fetch failed|failed to fetch|network|econn|enotfound|socket|unreachable|\b5\d\d\b|offline|down|connection/i.test(t)) return 'network';
  return 'rest';
}

/** A failure's kind in his words, as the reason a mark gives. */
export const KIND_WORDS: Record<FailKind, string> = {
  key: 'the key was refused',
  timeout: 'it took too long',
  network: 'the feed was down',
  limit: 'it hit its free allowance',
  notfound: 'it could not find what it needed',
  rest: 'something went wrong',
};

// ---------------------------------------------------------------- what the brain says

/** One tool group's last success and last failure, from the trail the agent already writes (time and kind, never the text). */
export interface GroupHealth {
  ok?: number;
  fail?: { at: number; kind: FailKind };
}

/** One feed's last good read. */
export interface FeedHealth {
  id: string;
  /** His name for it. */
  name: string;
  /** Its last good read (ms), or 0 when it has never been read. */
  at: number;
  /** The kind of its last failed read, while it is failing. */
  failed?: FailKind;
}

/** One kind of job on the brain's clock, with its last run. */
export interface JobHealth {
  kind: string;
  title: string;
  lastRun?: number;
  /** false: the last run failed. */
  ok?: boolean;
  kindOf?: FailKind;
  next?: number;
}

/** A key by its name only: whether the brain has it. */
export interface KeyHealth {
  name: string;
  label: string;
  set: boolean;
}

/** GET /guardian/health. One small object; no value of any key, no raw error text. */
export interface BrainHealth {
  at: number;
  groups: Record<string, GroupHealth>;
  keys: KeyHealth[];
  feeds: FeedHealth[];
  jobs: JobHealth[];
  /** The GPU job's last week: the Kaggle quota it had and when the week was. */
  gpu?: { left: number; total: number; at?: number; phase?: string };
  /** Moments he marked "that felt off": how many this week, and the screen with the most. */
  felt: { week: number; total: number; top?: string };
}

/** A "that felt off" moment: what he was doing and what was on the screen, as words. Never a picture, a face or the camera. */
export interface FeltMoment {
  id: string;
  at: number;
  screen: string;
  /** The last three things he did, in words (the awareness line). */
  did: string[];
  /** What was on the screen: the visible text, trimmed to 600 characters. */
  text: string;
  /** The health marks at that moment: ability id → mark. */
  marks: Record<string, Mark>;
  /** The hour he tapped it (0 to 23, his own). */
  hour: number;
  /** His own words, if he added any. */
  words?: string;
  /** The reply it was tapped on (its first words), when it was a reply. */
  reply?: string;
}

export const FELT_MAX = 300;
export const FELT_TEXT = 600;

/** What `GET /guardian/feltoff` lists. */
export interface FeltList {
  moments: FeltMoment[];
  week: number;
  top?: { screen: string; n: number };
}

// ---------------------------------------------------------------- the trail → the groups

/**
 * Each tool group's last success and last failure, from the agent's own trails (why.ts, read here and never changed): a step that
 * went ok is a success at its turn's time, one that failed is a failure of that kind. A step still waiting counts for neither.
 */
export function groupsFromTrails(trails: Trail[], groupOf: (tool: string) => string | undefined): Record<string, GroupHealth> {
  const out: Record<string, GroupHealth> = {};
  for (const t of [...trails].sort((a, b) => a.at - b.at)) {
    for (const s of t.steps) {
      const g = s.tool ? groupOf(s.tool) : undefined;
      if (!g || s.ok === null) continue;
      const h = (out[g] ??= {});
      if (s.ok) h.ok = Math.max(h.ok ?? 0, t.at);
      else if (!h.fail || t.at >= h.fail.at) h.fail = { at: t.at, kind: failKind(s.note) };
    }
  }
  return out;
}

/**
 * A group is failing when its last failure is newer than its last success; it was failing and is back when a success came after a
 * failure (`back`, for BACK_FOR after).
 */
export function groupState(h: GroupHealth | undefined, now: number): { failing: boolean; kind?: FailKind; back?: number } {
  if (!h?.fail) return { failing: false };
  if (!h.ok || h.ok < h.fail.at) return { failing: true, kind: h.fail.kind };
  return now - h.ok <= BACK_FOR ? { failing: false, back: h.ok } : { failing: false };
}

// ---------------------------------------------------------------- words

export const clockOf = (t: number, tz?: string): string => {
  try {
    return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) });
  } catch {
    return new Date(t).toISOString().slice(11, 16);
  }
};

/** "ran at 06:00, fine" / "failed at 06:00: the feed was down" / "has not run yet". */
export function jobLine(j: JobHealth, tz?: string): string {
  if (!j.lastRun) return 'has not run yet';
  const at = clockOf(j.lastRun, tz);
  return j.ok === false ? `failed at ${at}: ${KIND_WORDS[j.kindOf ?? 'rest']}` : `ran at ${at}, fine`;
}

/**
 * The count line at the top of HEALTH. `offline`: the brain cannot be reached or the phone has no signal, so the line says how many
 * things still work; otherwise anything that is not working (a dead feed counts) is a thing that needs him.
 */
export function topLine(marks: Mark[], offline = false): string {
  const n = (m: Mark) => marks.filter((x) => x === m).length;
  if (offline) return `Offline: ${marks.length - n('OFFLINE')} of ${marks.length} things still work.`;
  const need = n('DEGRADED') + n('NEEDS KEY') + n('OFFLINE');
  if (!need) return 'Everything is working.';
  return `${need} thing${need === 1 ? '' : 's'} need${need === 1 ? 's' : ''} you.`;
}

/** The Brief's first line: the same count when anything needs him, and nothing otherwise (offline, only what no signal explains is left out). */
export function briefLine(marks: Mark[], offline = false): string {
  const need = marks.filter((m) => m === 'DEGRADED' || m === 'NEEDS KEY' || (!offline && m === 'OFFLINE')).length;
  return need ? `${need} thing${need === 1 ? '' : 's'} need${need === 1 ? 's' : ''} you.` : '';
}
