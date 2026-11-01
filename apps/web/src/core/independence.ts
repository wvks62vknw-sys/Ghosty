/**
 * THE INDEPENDENCE METER on this phone (OWNER-ISSUES 78; the rules in packages/shared/src/independence.ts): every answered
 * turn counted by where it was answered, from the line each answer already carries (assistant/session.ts calls `noteAnswer`
 * when an answer is complete), kept here day by day like the stopwatch keeps its samples. And SOVEREIGN MODE's list: what
 * stopped for want of the cloud while a task was kept on the phone (`noteStopped`: the "Nothing of it left the phone"
 * answers), kept here only. The brain is given the days as counts (`brainDays`), never a kept task's. (Specs read the
 * kept copy: localStorage `ghosty.independence`.)
 */
import { addAnswer, dropAnswer, forBrain, type MeterDay } from '../../../../packages/shared/src/independence';
import { createStore } from './store';

/** A task kept on the phone that stopped: the question (it never left the phone) and why, for SOVEREIGN MODE's list. */
export interface Stopped {
  at: number;
  q: string;
  why: string;
}

const DAY = 86_400_000;
export const meter = createStore({ days: [] as MeterDay[], stopped: [] as Stopped[], postedAt: 0 }, { persist: 'ghosty.independence' });

const pad = (n: number) => String(n).padStart(2, '0');
/** This phone's day, "2026-10-31". */
export const phoneDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * One answer, complete: where it came from (its model line), whether it was kept on the phone, a tool's run, its length,
 * and the kind of ask it was (offline/trust.ts `categorise`).
 */
export function noteAnswer(model: string | undefined, o: { kept?: boolean; tool?: boolean; length?: number; cat?: string } = {}): void {
  meter.set((s) => ({ days: addAnswer(s.days, phoneDay(), model, o) }));
}

/** An answer taken back (ASK THE CLOUD under one the phone gave first): off the count of the day it was given. */
export function unnoteAnswer(model: string | undefined, at: number, o: { kept?: boolean; cat?: string } = {}): void {
  meter.set((s) => ({ days: dropAnswer(s.days, phoneDay(new Date(at)), model, o) }));
}

/** A kept task that stopped for want of the cloud (two weeks, thirty at most). */
export function noteStopped(q: string, why: string, now = Date.now()): void {
  meter.set((s) => ({ stopped: [...s.stopped.filter((x) => now - x.at < 14 * DAY), { at: now, q: q.slice(0, 200), why }].slice(-30) }));
}

/** The days for the brain, at most once an hour: counts only, the kept tasks taken out (null: not due). */
export function brainDays(now = Date.now()): MeterDay[] | null {
  const s = meter.get();
  if (!s.days.length || now - s.postedAt < 3600_000) return null;
  meter.set({ postedAt: now });
  return forBrain(s.days);
}
