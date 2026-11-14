/**
 * LOCK-SCREEN NUDGES THROUGH MY BRAIN'S PUSH (NEXT ROUND, BODY AND KITCHEN lane: water nudges and tablet reminders, body.u1 and
 * body.s1). An iPhone suspends a hidden web app, so a nudge that must reach a locked phone is a reminder on my brain's clock,
 * which arrives as a Web Push. What goes to the brain is only WHEN to nudge and a plain line ("Time for a glass of water."):
 * never an amount drunk, never a tablet's name unless he turns that on. Each set of times replaces the one before it, so the
 * brain holds only the next nudges. With no signal the change waits in the phone's queue (api/brain.ts) and goes when it can.
 */
import { brain } from '../../api/brain';

export interface LockTime {
  at: number;
  title: string;
  text: string;
  repeat: 'none' | 'daily';
}

/** What the specs read: each set's ids and the times sent (window.__ghosty.lockpush). */
export const lockState = { sent: [] as { key: string; at: number; title: string; text: string; repeat: string }[], gone: [] as string[], dropped: [] as string[], error: '' };

/** Takes back the old reminders and sets the new ones; returns the new ids (any that failed are left out). */
export async function replaceLock(key: string, old: string[], times: LockTime[]): Promise<string[]> {
  expose();
  for (const id of old) {
    try {
      await brain.deleteJob(id);
      lockState.gone.push(id);
    } catch {
      /* already gone: the brain removes a one-off once it has fired */
    }
  }
  const ids: string[] = [];
  for (const t of times) {
    try {
      const r = await brain.addJob({ kind: 'reminder', title: t.title, text: t.text, at: t.at, repeat: t.repeat });
      const id = (r as { job?: { id?: string } }).job?.id;
      if (id && id.startsWith('local-')) {
        // (no signal: a queued add would reach the brain under an id this phone never learns, so it could never be taken back;
        // the queued add is dropped and the next sync sends the times again)
        await brain.deleteJob(id).catch(() => undefined);
        lockState.error = 'No signal, so the lock-screen reminder waits: it’s sent the next time you’re online and change something.';
        lockState.dropped.push(id);
        continue;
      }
      if (id) ids.push(id);
      lockState.sent.push({ key, ...t });
      lockState.error = '';
    } catch {
      lockState.error = 'My brain didn’t take the lock-screen nudge just now. It’s tried again the next time you log.';
    }
  }
  return ids;
}

/** The next time a clock time ("08:00") comes round, from now (today if it is still ahead, else tomorrow). */
export function nextAt(hhmm: string, now: number): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= now + 30_000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.lockpush = lockState;
}
