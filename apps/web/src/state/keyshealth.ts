/**
 * A HEADS-UP BEFORE ALLOWANCES RUN OUT (NEXT ROUND, polish3.s9): from the status the brain already sends, the phone tells him once
 * when a free allowance is nearly used up, a provider is out for the day, or a key starts failing, each with what to do. Said once
 * per thing per day (a toast), and kept as a line at the top of SYSTEM → AI ROOM while it stands. Nothing is fetched for it.
 */
import type { BrainStatus } from '../../../../packages/shared/src/protocol';

export interface HeadsUp {
  /** Once per thing per day. */
  id: string;
  /** What is happening, in his words. */
  text: string;
  /** What to do about it. */
  fix: string;
  tone: 'warn' | 'bad';
}

/** How full counts as nearly used up. */
export const NEARLY = 0.85;

const clock = (at: number | null | undefined): string => (at ? new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'midnight');
const nice = (p: string): string => (p ? p[0]!.toUpperCase() + p.slice(1) : p);

/** Every heads-up the status calls for now. Pure. */
export function headsUps(st: BrainStatus | null, now = Date.now()): HeadsUp[] {
  if (!st) return [];
  const day = new Date(now).toISOString().slice(0, 10);
  const out: HeadsUp[] = [];
  for (const m of st.models ?? []) {
    if (m.state === 'dead') out.push({ id: `dead:${m.provider}:${day}`, text: `${nice(m.provider)}’s key has stopped working${m.info ? `: ${m.info.replace(/\.$/, '')}` : ''}.`, fix: 'System, Keys: paste a fresh key; HOW TO GET IT has the steps.', tone: 'bad' });
  }
  for (const p of st.capacity?.providers ?? []) {
    if (p.state === 'out') out.push({ id: `out:${p.provider}:${day}`, text: `${nice(p.provider)} has no free room left today; it comes back at ${clock(p.backAt ?? p.resetAt)}.`, fix: 'Nothing to do: I use the other free brains until then.', tone: 'warn' });
    else if (p.perDay && p.usedToday / p.perDay >= NEARLY) out.push({ id: `near:${p.provider}:${day}`, text: `${nice(p.provider)} has used ${p.usedToday} of its ${p.perDay} free calls today; it resets at ${clock(p.resetAt)}.`, fix: 'Nothing to do: I move to the other free brains if it runs out.', tone: 'warn' });
  }
  const meter = st.meter;
  if (meter && meter.level >= NEARLY && meter.level < 1) out.push({ id: `db:${meter.day}`, text: `My free database allowance is ${Math.round(meter.level * 100)}% used today; it resets at ${clock(meter.resetAt)}.`, fix: 'Nothing to do: if it runs out, memory pauses and everything else keeps working.', tone: 'warn' });
  return out;
}

const TOLD = 'ghosty.headsup.told';
/** The ones not yet told (and marks them told): kept for the day they name, so the list never grows. */
export function untold(list: HeadsUp[], now = Date.now()): HeadsUp[] {
  let told: string[] = [];
  try {
    told = JSON.parse(localStorage.getItem(TOLD) ?? '[]') as string[];
  } catch {
    told = [];
  }
  const fresh = list.filter((x) => !told.includes(x.id));
  if (fresh.length) {
    const day = new Date(now).toISOString().slice(0, 10);
    const keep = [...told.filter((id) => id.endsWith(day)), ...fresh.map((x) => x.id)];
    try {
      localStorage.setItem(TOLD, JSON.stringify(keep.slice(-40)));
    } catch {
      /* not kept: it may be told again next time, which is the safe side */
    }
  }
  return fresh;
}
