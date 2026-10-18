/**
 * Putting a backup back without wiping what the phone has now (features/system/backup.ts).
 * Pure functions, no browser: tested in apps/edge/test/offline.test.mjs.
 *
 * Lists of things with an id (flashcards, courses, quizzes, unsent changes, widgets…) are joined
 * by id, and where both copies have the same thing the newer one wins (its updated / last-reviewed
 * / at time). Objects are joined key by key. Anything else stays as it is on the phone, unless the
 * phone has nothing there.
 */

type J = unknown;
const isObj = (v: J): v is Record<string, J> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasId = (v: J): v is Record<string, J> & { id: string | number } => isObj(v) && (typeof v.id === 'string' || typeof v.id === 'number');
const num = (v: J) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** How new a thing is: when it was last changed, reviewed or made. */
export function stamp(v: J): number {
  if (!isObj(v)) return 0;
  return num(v.updated) ?? num(v.updatedAt) ?? num(v.last) ?? num(v.at) ?? num(v.added) ?? num(v.created) ?? 0;
}

const empty = (v: J) => v === undefined || v === null || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length);

export function mergeValue(cur: J, bak: J): J {
  if (empty(cur)) return bak === undefined ? cur : bak;
  if (bak === undefined || bak === null) return cur;
  if (Array.isArray(cur) && Array.isArray(bak)) {
    if ([...cur, ...bak].every(hasId)) {
      const out = cur.map((c) => {
        const b = (bak as Record<string, J>[]).find((x) => (x as { id: J }).id === (c as { id: J }).id);
        if (b === undefined) return c;
        return stamp(b) > stamp(c) ? b : isObj(c) && isObj(b) ? mergeValue(c, b) : c;
      });
      for (const b of bak) if (!cur.some((c) => (c as { id: J }).id === (b as { id: J }).id)) out.push(b);
      return out;
    }
    // No ids: the same entries once each, in time order when every one has a time; otherwise the phone's.
    if ([...cur, ...bak].every((x) => isObj(x) && num(x.at) !== null)) {
      const seen = new Set<string>();
      return [...cur, ...bak].filter((x) => {
        const k = JSON.stringify(x);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).sort((a, b) => stamp(a) - stamp(b));
    }
    return cur;
  }
  if (isObj(cur) && isObj(bak)) {
    const out: Record<string, J> = { ...cur };
    for (const [k, v] of Object.entries(bak)) out[k] = k in cur ? mergeValue(cur[k], v) : v;
    return out;
  }
  return cur;
}

export type MergeResult = 'restored' | 'merged' | 'same';

/**
 * One localStorage entry: the phone's text (null when it has none) and the backup's. `whole`: an
 * entry that only makes sense as one piece (a room plan, the settings) — the phone's stays if it has one.
 */
export function mergeEntry(cur: string | null, bak: string, whole = false): { text: string; result: MergeResult } {
  if (cur === null || cur === '' || cur === 'null') return { text: bak, result: 'restored' };
  if (cur === bak || whole) return { text: cur, result: 'same' };
  let c: J;
  let b: J;
  try {
    c = JSON.parse(cur);
    b = JSON.parse(bak);
  } catch {
    return { text: cur, result: 'same' }; // plain text (a language, a client id): the phone's stays
  }
  const text = JSON.stringify(mergeValue(c, b));
  return text === JSON.stringify(c) ? { text: cur, result: 'same' } : { text, result: 'merged' };
}
