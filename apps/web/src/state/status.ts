/**
 * Route C's readings of the brain's status (`/api/status`), shared by Home's FREE AI instrument and the
 * Me sheet's Status card: what is left of today's free AI (the quota engine's capacity) and how much of
 * the database's free daily allowance is used (the meter). Pure: given the status, the words and the share.
 */
import type { AiCapacity, DatabaseMeter } from '../../../../packages/shared/src/protocol';

export type Tone = 'live' | 'warn' | 'idle';

/** What is left of today's free AI (frac null: nothing measured). */
export function freeAiToday(cap: AiCapacity | undefined | null): { frac: number | null; value: string; unit: string; sub: string; tone: Tone; ready: string } {
  if (!cap) return { frac: null, value: '—', unit: '', sub: 'not measured yet', tone: 'idle', ready: '' };
  const chat = cap.providers.filter((p) => !p.smallOnly);
  const readyList = chat.filter((p) => p.state === 'ready' || p.state === 'busy').map((p) => p.provider);
  const ready = readyList.length ? `${readyList.slice(0, 2).join(', ')}${readyList.length > 2 ? ` +${readyList.length - 2}` : ''} ready` : 'none ready now';
  if (!chat.length) return { frac: 0, value: 'None', unit: '', sub: 'add an AI key', tone: 'warn', ready: 'no AI key yet' };
  const capped = chat.filter((p) => p.perDay);
  if (!capped.length) return { frac: readyList.length ? 1 : 0, value: readyList.length ? 'Open' : 'Full', unit: '', sub: readyList.length ? 'no daily cap' : 'room comes back soon', tone: readyList.length ? 'live' : 'warn', ready };
  const all = capped.reduce((t, p) => t + p.perDay!, 0);
  const left = capped.reduce((t, p) => t + Math.max(0, p.perDay! - p.usedToday), 0);
  const frac = all ? left / all : 0;
  return { frac, value: String(Math.round(frac * 100)), unit: '%', sub: 'left today', tone: frac < 0.15 ? 'warn' : 'live', ready };
}

/** Today's use of the database's free allowance: the larger of reads and writes, and when it resets. */
export function databaseToday(m: DatabaseMeter | undefined | null): { frac: number | null; value: string; unit: string; sub: string; tone: Tone } {
  if (!m) return { frac: null, value: '—', unit: '', sub: 'not counted yet', tone: 'idle' };
  const resets = new Date(m.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const used = Math.max(0, m.level);
  return { frac: Math.min(1, used), value: used >= 1 ? 'Full' : String(Math.round(used * 100)), unit: used >= 1 ? '' : '%', sub: used >= 1 ? `paused till ${resets}` : `Resets ${resets}`, tone: used >= 1 ? 'warn' : used > 0.7 ? 'warn' : 'live' };
}
