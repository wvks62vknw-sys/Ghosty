/**
 * THE WORKSHOP'S WORDS (BRIEF-QUALITY-MAKE): the lines the Workshop says in his voice, in one place and with no DOM, so the spec reads the
 * very words the page is built from. A website's draft card, WHAT'S NEW, and a project as it goes.
 */
import { agoWords } from '../threats/words';

/** The draft card's states: the page being opened, one that would not come, no signal, nothing made yet. */
export const DRAFT = {
  opening: 'Opening the website…',
  failed: 'I can’t show this website just now. Tap RETRY and I’ll try again.',
  offline: 'No signal, so I can’t open the website. Tap RETRY when you have one.',
  nothing: 'No draft yet. It shows here as soon as I have made it.',
  retry: 'RETRY',
};

/** WHAT'S NEW with nothing newer than the week. */
export const NOTHING_NEW = 'Nothing new since you last looked.';

/** What counts as this week. */
export const WEEK = 7 * 86_400_000;

/** The list split into this week's and the earlier (the day is a plain YYYY-MM-DD; today's whole day is this week). */
export function splitWeek<T extends { day: string }>(list: T[], now = Date.now()): { week: T[]; earlier: T[] } {
  const week: T[] = [];
  const earlier: T[] = [];
  for (const n of list) (now - Date.parse(`${n.day}T23:59:59Z`) <= WEEK ? week : earlier).push(n);
  return { week, earlier };
}

/** The panel's count, said as it is: "3 THIS WEEK", "NOTHING NEW". */
export const newCount = (n: number): string => (n ? `${n} THIS WEEK` : 'NOTHING NEW');

/** The button that opens the rest, said with its number. */
export const earlierWords = (n: number, open: boolean): string => (open ? 'Show fewer' : `Show ${n} earlier`);

/** A project and its steps in plain words (the brain's own names are active / paused / done / cancelled). */
export const PROJECT_WORD = { active: 'RUNNING', paused: 'PAUSED', done: 'FINISHED', cancelled: 'CANCELLED' } as const;

/** A project as it goes, in one line: its state word, where it has got to, the pace, and when it last moved. */
export function projectWords(p: { status: 'active' | 'paused' | 'done' | 'cancelled'; kind?: string; pace?: string; updated: number; steps: { status: string }[] }, now = Date.now()): string {
  const total = p.steps.length;
  const done = p.steps.filter((s) => s.status === 'done').length;
  const failed = p.steps.some((s) => s.status === 'failed');
  const pace = p.kind === 'app' ? 'built in one go' : p.pace === 'fast' ? 'a step every 3 minutes' : 'a step every 20 minutes';
  const when = agoWords(p.updated, now);
  const where = p.status === 'active' ? `step ${Math.min(total, done + 1)} of ${total}` : p.status === 'paused' && failed ? `step ${Math.min(total, done + 1)} didn’t work` : `${done} of ${total} done`;
  return `${PROJECT_WORD[p.status]} · ${where}${p.status === 'active' || p.status === 'paused' ? ` · ${pace}` : ''} · ${when}`;
}

/** PROJECTS with none: the one next thing is the box above it. */
export const PROJECTS_NONE = {
  head: 'Nothing being made.',
  line: 'Ask for something that takes days and I’ll work on it a step at a time.',
  key: 'ASK FOR ONE',
};

/** No signal: the lists are what the phone kept, and when that was. */
export const offlineWords = (at: number): string => `No signal; this is from ${at ? new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'before the phone lost it'}.`;
