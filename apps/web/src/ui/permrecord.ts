/**
 * The phone's own record of the last grant or refusal of each thing the browser can be asked for (BRIEF-RELIABILITY 3), kept where
 * the browser's own answer is not there (Safari answers the Permissions API for some and not others). Tiny and free of everything
 * else, so the one error voice (hisWords.ts) can note a refusal and SETTINGS → PERMISSIONS can read it. Said as "last time:
 * allowed", never guessed: a row with no record says it was not asked yet.
 */
export type PermRow = 'camera' | 'microphone' | 'location' | 'notifications' | 'motion' | 'clipboard';
export interface PermLast {
  state: 'allowed' | 'refused';
  at: number;
  /** For a refusal: what he was doing ("open the camera"). */
  doing?: string;
}

const KEY = 'ghosty.perm';

const readAll = (): Partial<Record<PermRow, PermLast>> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Partial<Record<PermRow, PermLast>>) : {};
  } catch {
    return {};
  }
};

/** Which thing a refusal was about, from what he was doing and the error's own words (decided here, never shown). */
export function permRowOf(what: string, raw = ''): PermRow | null {
  const t = `${what} ${raw}`.toLowerCase();
  if (/camera|photo|scan|lens|picture|video|see /.test(t)) return 'camera';
  if (/microphone|\bmic\b|listen|record|hear|voice|dictat|speak to/.test(t)) return 'microphone';
  if (/location|gps|geolocation|position|where am i/.test(t)) return 'location';
  if (/notification|alert|push/.test(t)) return 'notifications';
  if (/motion|tilt|orientation|shake/.test(t)) return 'motion';
  if (/clipboard|paste|copy/.test(t)) return 'clipboard';
  return null;
}

export function notePerm(row: PermRow, state: PermLast['state'], doing?: string): void {
  try {
    const all = readAll();
    all[row] = { state, at: Date.now(), ...(doing ? { doing } : {}) };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: no record */
  }
}

export const lastPerm = (row: PermRow): PermLast | undefined => readAll()[row];

/** The newest refusal on record, with the thing it was about. */
export function lastRefusal(): { row: PermRow; at: number; doing: string } | undefined {
  const all = readAll();
  const hits = (Object.entries(all) as [PermRow, PermLast][]).filter(([, v]) => v?.state === 'refused').sort((a, b) => b[1].at - a[1].at);
  const top = hits[0];
  return top ? { row: top[0], at: top[1].at, doing: top[1].doing ?? '' } : undefined;
}

// ---------------------------------------------------------------- A LOG OF CAMERA, MIC AND LOCATION USE (NEXT ROUND, polish3.u9)
/** One time the camera, the microphone or the position was actually used, and on which screen; kept on this phone only. */
export interface PermUse {
  what: 'camera' | 'microphone' | 'location';
  /** The screen it was used on (its id, as the address has it). */
  screen: string;
  at: number;
}
const USE_KEY = 'ghosty.perm.used';
export const USE_MAX = 60;

export function usesKept(): PermUse[] {
  try {
    const v = JSON.parse(localStorage.getItem(USE_KEY) ?? '[]') as PermUse[];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.at === 'number' && typeof x.what === 'string') : [];
  } catch {
    return [];
  }
}

/** One use noted (the same thing on the same screen within a minute is one use, so a watch of the position is not a flood). */
export function noteUse(what: PermUse['what'], now = Date.now()): void {
  try {
    const screen = (typeof document !== 'undefined' && document.body?.dataset.tab) || 'core';
    const all = usesKept();
    const last = all[all.length - 1];
    if (last && last.what === what && last.screen === screen && now - last.at < 60_000) return;
    all.push({ what, screen, at: now });
    localStorage.setItem(USE_KEY, JSON.stringify(all.slice(-USE_MAX)));
  } catch {
    /* storage unavailable: nothing kept */
  }
}

export function clearUses(): void {
  try {
    localStorage.removeItem(USE_KEY);
  } catch {
    /* nothing kept */
  }
}
