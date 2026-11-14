/**
 * THE NIGHTLY SELF-CHECK in the Brief (security.u7, built small into PLAN's Brief): when the Brief opens, the locks are checked
 * (the same rules as Settings → Security) and a lock that slipped since he was last told is said once, as one SECURITY row that
 * opens the screen. It stays for the rest of that day, then stays quiet until something changes again. Kept on the phone.
 */
import { brain, ownerKey } from '../../api/brain';
import { row } from '../../ui/components';
import { go } from '../../shell/tabs';
import { lastBackup } from '../system/backup';
import { locksOf, slipped, slippedLine, type Level } from './locks';

const TOLD = 'ghosty.security.told';
const DOORS = 'ghosty.security.doorsRule';

interface Told {
  levels: Record<string, Level>;
  /** The day a line was said, and the line, so a repaint that day says it again. */
  day?: string;
  line?: string;
}
const read = (): Told => {
  try {
    return (JSON.parse(localStorage.getItem(TOLD) ?? 'null') as Told | null) ?? { levels: {} };
  } catch {
    return { levels: {} };
  }
};
const write = (t: Told): void => {
  try {
    localStorage.setItem(TOLD, JSON.stringify(t));
  } catch {
    /* storage refused: said again next time, never lost */
  }
};

/** The Brief's SECURITY row for today, or null (nothing slipped, or the brain can't be asked: a check that can't run is not news). */
export async function securityRow(today: string, now = Date.now()): Promise<HTMLElement | null> {
  const told = read();
  let line = told.day === today ? (told.line ?? '') : '';
  if (!line) {
    const sec = await Promise.race([brain.security().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
    if (!sec) return null;
    const key = ownerKey.get();
    const lb = lastBackup.get();
    let doorsRule = false;
    try {
      doorsRule = localStorage.getItem(DOORS) === '1';
    } catch {
      /* not marked */
    }
    const locks = locksOf({ keyLength: key ? key.length : null, lastBackup: lb ? { at: lb.at, ok: lb.ok } : null, faces: null, telegram: null, brain: sec.locks, approvals: sec.approvals, doorsRule, now });
    const { news, next } = slipped(locks, told.levels, new Set(['telegram', 'faces']));
    line = slippedLine(news);
    write({ levels: next, ...(line ? { day: today, line } : {}) });
    if (!line) return null;
  }
  const r = row('SECURITY', line, '›', { wrap: true, onClick: () => go('security') });
  r.classList.add('brsecurity');
  return r;
}
