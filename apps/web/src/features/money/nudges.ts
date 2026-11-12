/**
 * MONEY NUDGES on the phone (BRIEF-OCT-IDEAS-2 4): the statements he added, read for three things worth a line (packages/shared
 * src/spending.ts `nudges`: a renewal this week, a price that went up, the month running hot). They stand at the top of the
 * Agenda's SPENDING sheet while they are true, and the Brief's money line says each fact once: the day it first came up, and
 * never on a later day. Nothing connects to a bank and nothing leaves the phone beyond the brain that already keeps the rows.
 */
import { monthName, type Nudge } from '../../../../../packages/shared/src/spending';

const SAID = 'ghosty.nudges.said';

/** The facts the Brief has said, each with the day it first did (kept to the last 60). */
function said(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(SAID) ?? '{}') as Record<string, string>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/**
 * What the Brief's money line says today: a fact new today (marked as said, today), or one said earlier today (still on the page
 * as the day goes on); a fact said on an earlier day is not said again.
 */
export function briefNudges(list: Nudge[], today: string): Nudge[] {
  const was = said();
  const out: Nudge[] = [];
  let changed = false;
  for (const n of list) {
    const day = was[n.id];
    if (!day) {
      was[n.id] = today;
      changed = true;
      out.push(n);
    } else if (day === today) out.push(n);
  }
  if (changed) {
    try {
      const keep = Object.entries(was).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, 60);
      localStorage.setItem(SAID, JSON.stringify(Object.fromEntries(keep)));
    } catch {
      /* no storage: said again next time */
    }
  }
  return out;
}

/** What the SPENDING sheet says when there is nothing to nudge about: honest about how old the newest statement is. */
export function quietLine(newestMonth: string, today: string): string {
  const behind = (+today.slice(0, 4) - +newestMonth.slice(0, 4)) * 12 + (+today.slice(5, 7) - +newestMonth.slice(5, 7));
  if (behind >= 2) return `Your newest statement is from ${monthName(newestMonth)}: add this month’s and I’ll tell you what’s coming up.`;
  return 'Nothing to nudge you about today: nothing renews this week, no price went up and the month is on track.';
}
