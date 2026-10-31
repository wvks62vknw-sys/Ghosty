/**
 * THE GUARDIAN (OWNER-ISSUES 55, 58: "protection as the first duty"), the parts the brain and the phone share: what the
 * watch over his places looks like, in his voice.
 *
 * The lines that hold here: only public warnings and public counts, shown as published and never extrapolated. Pure: no
 * storage, no network.
 */

/** The three public feeds the watch reads. */
export type FeedId = 'flood' | 'weather' | 'crime';

export const FEED_NAMES: Record<FeedId, { name: string; source: string }> = {
  flood: { name: 'flood warnings', source: 'Environment Agency' },
  weather: { name: 'weather warnings', source: 'Met Office' },
  crime: { name: 'street crime', source: 'police.uk' },
};

/** One public warning that touches a saved place, as its feed published it. */
export interface GuardWarning {
  /** The feed's own id ("ea:122WAF942", "mo:fb133494-…"). */
  id: string;
  feed: 'flood' | 'weather';
  /** "Flood alert: River Cole at Kings Heath", "Yellow warning of fog". */
  title: string;
  /** 1 the most severe … 3 the least (the Environment Agency's own levels; the Met Office: red 1, amber 2, yellow 3). */
  level: 1 | 2 | 3;
  /** When the feed says it began, or begins (ms). */
  since: number;
  /** When it ends, when the feed says (ms): it is gone from then on. */
  until?: number;
  /** The feed's own words about where, cut short. */
  detail?: string;
  link?: string;
}

/** A month of street crime around a place: the public count and its categories, nothing else. */
export interface CrimeMonth {
  /** "2026-08". */
  month: string;
  total: number;
  /** The biggest categories, in police.uk's words, biggest first. */
  top: [string, number][];
}

/** One saved place under watch. */
export interface PlaceWatch {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** What is active there now, worst first. */
  active: GuardWarning[];
  crime?: CrimeMonth;
  /** The Met Office region it is read for ("West Midlands"); '' outside the feeds' reach. */
  region?: string;
}

/** GET /api/guardian: everything THREATS → NEAR HOME shows. */
export interface GuardianInfo {
  places: PlaceWatch[];
  /** When each feed was last read (ms). */
  checked: Partial<Record<FeedId, number>>;
  /** A feed that could not be read last time, in plain words. */
  failed: Partial<Record<FeedId, string>>;
  tz: string;
}

// ---------------------------------------------------------------- the watch, in his voice

const andList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** NEAR HOME's line (THREATS): "I'm watching Home and Work. Nothing active. Last look 14:05." */
export function watchLine(info: Pick<GuardianInfo, 'places' | 'checked' | 'tz'>): string {
  if (!info.places.length) return "I'm not watching any places yet: save home in Memory → ME → PLACES.";
  const active = info.places.reduce((n, p) => n + p.active.length, 0);
  const last = Math.max(info.checked.flood ?? 0, info.checked.weather ?? 0);
  return `I'm watching ${andList(info.places.map((p) => p.label))}. ${active ? `${active} warning${active === 1 ? '' : 's'} active.` : 'Nothing active.'}${last ? ` Last look ${clockIn(last, info.tz)}.` : ''}`;
}

// ---------------------------------------------------------------- the words that go out

/** "22:10" in his zone. */
export function clockIn(t: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'Europe/London' }).format(t);
  } catch {
    return new Date(t).toISOString().slice(11, 16);
  }
}
