/**
 * THE NIGHTLY SELF-CHECK in the Brief (security.u7, built small into PLAN's Brief): when the Brief opens, the locks are checked
 * (the same rules as Settings → Security) and a lock that slipped since he was last told is said once, as one SECURITY row that
 * opens the screen. It stays for the rest of that day, then stays quiet until something changes again. Kept on the phone.
 */
import { brain, ownerKey } from '../../api/brain';
import { row } from '../../ui/components';
import { go } from '../../shell/tabs';
import { lastBackup } from '../system/backup';
import { approvalsDigest, locksOf, slipped, slippedLine, type ApprovalEntry, type Level } from './locks';
import { chat } from '../../assistant/session';

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

/** The Brief's rows from the security lane: the self-check told once, and the approvals (security.u7, security.c1). */
export async function securityRows(today: string, now = Date.now()): Promise<HTMLElement[]> {
  const sec = await Promise.race([brain.security().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  const rows: HTMLElement[] = [];
  const s = await securityRow(today, now, sec);
  if (s) rows.push(s);
  const a = approvalsRow(sec?.approvals ?? null, now);
  if (a) rows.push(a);
  return rows;
}

/** APPROVALS: yesterday's answers and anything still waiting (the waiting ones from the chat on this phone). */
function approvalsRow(list: ApprovalEntry[] | null, now: number): HTMLElement | null {
  const waiting = chat.get().entries.filter((e) => e.kind === 'approval' && e.state === 'waiting').length;
  const line = approvalsDigest(list ?? [], waiting, now);
  if (!line) return null;
  const r = row('APPROVALS', line, '›', { wrap: true, onClick: () => go(waiting ? 'core' : 'security') });
  r.classList.add('brapprovals');
  return r;
}

/** The SECURITY row for today, or null (nothing slipped, or the brain can't be asked: a check that can't run is not news). */
async function securityRow(today: string, now: number, sec: Awaited<ReturnType<typeof brain.security>> | null): Promise<HTMLElement | null> {
  const told = read();
  let line = told.day === today ? (told.line ?? '') : '';
  if (!line) {
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
