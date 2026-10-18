/**
 * Putting a backup back without wiping what the phone has now, and when the daily backup runs
 * (features/system/backup.ts).
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

/**
 * What a backup must never put back, and what it is called in the restore report. Both are the
 * brain's to keep, so a copy from days ago could only do harm:
 *  - 'ghosty.offline': changes waiting to be sent (its outbox) may have been sent since the backup —
 *    putting them back would send them again (a reminder twice, a memory twice) and ring old
 *    reminders at once; the memory, agenda and inbox copies in it come back from the brain by themselves;
 *  - 'ghosty.chat': the conversation is kept by the brain and loaded from it every time Ghosty starts.
 * Backups made from now on leave them out; older ones may still carry them.
 */
export const NOT_RESTORED: Record<string, string> = {
  'ghosty.offline': 'memory and agenda (your brain keeps them)',
  'ghosty.chat': 'chat history (your brain keeps it)',
};

/**
 * One entry of a backup going back on this phone: null when it is never put back (NOT_RESTORED —
 * the phone's own entry, with its outbox of changes not sent yet, stays exactly as it is), otherwise
 * joined with the phone's (mergeEntry).
 */
export function restoreEntry(key: string, cur: string | null, bak: string, whole = false): { text: string; result: MergeResult } | null {
  if (Object.prototype.hasOwnProperty.call(NOT_RESTORED, key)) return null;
  return mergeEntry(cur, bak, whole);
}

// ---------------------------------------------------------------------------------------
// When the daily backup runs (features/system/backup.ts autoBackup).
// ---------------------------------------------------------------------------------------

/** What this phone remembers about its last backup (never itself backed up). */
export interface LastBackup {
  at: number;
  ok: boolean;
  size?: number;
  error?: string;
  /** A backup worked here, or one was restored here: what this phone holds is its owner's real data. */
  known?: boolean;
  /** Something changed since (waiting changes went to the brain): the next daily backup should not wait a day. */
  due?: boolean;
}

/**
 * Does this phone trust its own contents enough to back them up over the brain's copies? Only once a
 * backup worked here or one was restored. A failed try proves nothing: a wiped phone whose first
 * BACK UP NOW failed is still a wiped phone.
 */
export const backupTrusted = (last: LastBackup | null): boolean => !!last && (last.ok || !!last.known);

/** The record after a try: a failure keeps what was known before. */
export function afterTry(prev: LastBackup | null, now: number, r: { ok: true; size: number } | { ok: false; error: string }): LastBackup {
  return r.ok ? { at: now, ok: true, size: r.size, known: true } : { at: now, ok: false, error: r.error, ...(backupTrusted(prev) ? { known: true } : {}) };
}

/**
 * Should the daily backup run now? A good one waits 20 hours (about a day, whenever Ghosty is
 * opened) unless marked due; a failed try waits 3 hours. Never while the phone has no trusted record
 * but the brain has copies (`brainHasCopies`, asked only then): that is a wiped or new phone, and
 * backing up would put an empty phone over the good copies.
 */
export async function backupDue(last: LastBackup | null, now: number, brainHasCopies: () => Promise<boolean>): Promise<boolean> {
  if (last && !last.due && now - last.at < (last.ok ? 20 : 3) * 3_600_000) return false;
  if (!backupTrusted(last) && (await brainHasCopies())) return false;
  return true;
}

/** The record once waiting changes reached the brain: the next daily backup runs without waiting the day out. */
export const markDue = (last: LastBackup | null): LastBackup | null => (last ? { ...last, due: true } : last);
