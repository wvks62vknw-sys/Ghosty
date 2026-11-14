/**
 * GOODNIGHT's words (planlane2, plan.c6 with boot.s1's wind-down): which of his words start it, the day ahead it reads, and every line
 * it says, one per step. Pure (no DOM, no storage, no brain): the routine (goodnight.ts), the chat and the spec all read this.
 * Never take words another table owns: "run goodnight" / "activate the goodnight scene" are the house's (a scene of his), "night mode"
 * the look's, and nothing here is in the VOICE lane's meanings (packages/shared/src/meanings.ts).
 */

/**
 * "goodnight", "good night", "night night", "nighty night", "time for bed", "bedtime": the whole message, dressed or not. The bed and
 * sleep forms ("I'm off to bed", "going to bed", "going to sleep") are the body lane's (features/body/trackcore.ts trackAsked: GOING TO
 * BED), so one wording never does two different things to his house.
 */
const ASK = new RegExp(
  '^(?:(?:ok(?:ay)?|right|well|anyway|alright|ghosty)[, ]+)?' +
    '(?:good ?night|night night|nighty[ -]?night|nite nite|time for bed|bed ?time|time to sleep)' +
    '(?:[, ]+(?:ghosty|then|now|everyone|all|mate|love))*$',
);
export function goodnightAsked(text: string): boolean {
  const t = String(text ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?…]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length <= 48 && ASK.test(t);
}

/** The GOODNIGHT key shows from six in the evening till five in the morning (the Brief's own evening, and the night after midnight). */
export const nightKeyAt = (d: Date): boolean => d.getHours() >= 18 || d.getHours() < 5;

/**
 * The day ahead of him, on the phone's own clock (his midnight, never UTC's): before five in the morning it is the rest of today
 * ("Later today"), otherwise tomorrow. `day` is that day's midnight (all-day events start there), `from`..`to` the hours read.
 */
export function dayAhead(now: number): { day: number; from: number; to: number; label: 'Tomorrow' | 'Later today' } {
  const d = new Date(now);
  if (d.getHours() < 5) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { day, from: now, to: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(), label: 'Later today' };
  }
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return { day, from: day, to: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2).getTime(), label: 'Tomorrow' };
}

/** "9:30", "14:05": the clock as he says it (no leading zero on the hour). */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "A", "A and B", "A, B and C", and past four "A, B, C and 3 more". */
export function listed(names: string[], max = 4): string {
  if (names.length > max) return `${names.slice(0, max - 1).join(', ')} and ${names.length - (max - 1)} more`;
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** The first line: what is happening. */
export const openLine = (name: string): string => `Goodnight${name ? `, ${name}` : ''}. Winding everything down:`;
/** The last line: the night look, and nothing sent. */
export const closeLine = (look: 'on' | 'already'): string => `${look === 'on' ? 'The night look is on' : 'The night look was already on'}. Nothing was sent or posted. Sleep well.`;

// ---------------------------------------------------------------- the house

export type HouseState = 'out' | 'unlinked' | 'down' | 'ok';
/** The lights: turned off, none on, or why they were left. */
export function lightsLine(state: HouseState, done: string[] = [], failed: string[] = []): string {
  /* state: core.goodnight offline */
  if (state === 'out') return 'Lights: I can’t reach my brain right now, so I left your lights as they are.';
  if (state === 'unlinked') return 'Lights: your house isn’t linked yet, so I left them. Link your Home Assistant in LINKS.';
  /* state: core.goodnight error */
  if (state === 'down') return 'Lights: your house didn’t answer, so I left them as they are.';
  /* state: core.goodnight empty */
  if (!done.length && !failed.length) return 'Lights: none were on.';
  const off = done.length ? `Lights off: ${listed(done)}.` : 'Lights:';
  const stuck = failed.length ? ` ${listed(failed)} didn’t answer, so ${failed.length > 1 ? 'they’re' : 'it’s'} still on.` : '';
  return `${off}${stuck}`;
}

/** One guarded thing left open tonight: never touched by goodnight, only offered as a LOCK UP key. */
export interface OpenGuard {
  id: string;
  name: string;
  domain: string;
  /** what it is now, in his words: "unlocked", "open", "off" */
  now: string;
  /** what LOCK UP would do, on his tap and his confirm */
  service: string;
}
/** A guarded thing not in a confirmed safe state: open, moving, or not answering (null only when it is locked, closed or armed). */
export function openGuard(e: { id: string; name: string; domain: string; state: string }): OpenGuard | null {
  const s = String(e.state ?? '').toLowerCase();
  const o = { id: e.id, name: e.name, domain: e.domain };
  // safe only in a known safe state: a lock locked, a cover closed, an alarm armed
  if (e.domain === 'lock' && s === 'locked') return null;
  if (e.domain === 'cover' && s === 'closed') return null;
  if (e.domain === 'alarm_control_panel' && s.startsWith('armed_')) return null;
  // not answering (a flat battery, the box can't see it): said, never claimed locked; no key (nothing would answer it)
  if (s === 'unavailable' || s === 'unknown' || !s) return { ...o, now: `not answering, so I can’t say it’s ${e.domain === 'lock' ? 'locked' : e.domain === 'cover' ? 'closed' : 'set'}`, service: '' };
  if (e.domain === 'lock') return { ...o, now: s === 'jammed' ? 'jammed' : s === 'locking' ? 'still locking' : s === 'open' || s === 'opening' ? 'open' : 'unlocked', service: s === 'locking' ? '' : 'lock' };
  if (e.domain === 'cover') return { ...o, now: s === 'closing' ? 'still closing' : 'open', service: s === 'closing' ? '' : 'close_cover' };
  if (e.domain === 'alarm_control_panel') return { ...o, now: s === 'triggered' ? 'sounding' : s === 'arming' || s === 'pending' ? 'still setting' : 'off', service: s === 'disarmed' ? 'alarm_arm_home' : '' };
  return null;
}
/** The guarded set tonight: all locked up, or each one not confirmed with what LOCK UP asks of him (null: he has none). */
export function lockLine(open: OpenGuard[], guardedCount: number): string | null {
  if (!guardedCount) return null;
  if (!open.length) return 'Locks and doors: all locked and closed.';
  const each = open.map((o) => `the ${o.name} is ${o.now}`);
  return `Locks and doors: ${listed(each, 6)}. I never touch those from words${open.some((o) => o.service) ? ': LOCK UP needs your own tap and a confirm, every time' : ''}.`;
}
/** The LOCK UP key's label for one of them. */
export const lockKey = (o: OpenGuard): string => `LOCK UP: ${o.name.toUpperCase()}`;

// ---------------------------------------------------------------- the radio, sleep, the day ahead

/** The radio: its sleep timer set, kept, or why there is none. */
export function radioLine(o: { kind: 'set' | 'sooner' | 'paused' | 'nothing'; name?: string; at?: number; min?: number }): string {
  if (o.kind === 'set') return `Radio: ${o.name} stops in ${o.min ?? 30} minutes, at ${clock(o.at ?? 0)}.`;
  if (o.kind === 'sooner') return `Radio: ${o.name} already stops at ${clock(o.at ?? 0)}, sooner than that, so I kept its timer.`;
  if (o.kind === 'paused') return `Radio: ${o.name} is paused, so it needs no timer.`;
  return 'Radio: nothing is playing, so there’s no timer to set.';
}

/** Sleep tracking: started now, already going, or not on this phone. */
export function sleepLine(o: { kind: 'started' | 'already' | 'none' | 'unkept'; since?: number }): string {
  if (o.kind === 'unkept') return 'Sleep: I couldn’t keep that on this phone (its storage is full or off), so tap GOING TO BED in BODY, SLEEP.';
  if (o.kind === 'started') return 'Sleep: tracking from now. Say “I’m up now” when you wake.';
  if (o.kind === 'already') return `Sleep: already tracking since ${clock(o.since ?? 0)}. Say “I’m up now” when you wake.`;
  return 'Sleep: I couldn’t start tracking just now. Tap GOING TO BED in BODY, SLEEP to start it.';
}

export interface DayEvent {
  title: string;
  start: number;
  allDay?: boolean;
}
/** The day ahead's first event ("Tomorrow: Dentist at 9:30."), that it is clear, or why I can't say. */
export function aheadLine(events: DayEvent[] | null, now: number, o: { calendarsDown?: boolean; copy?: boolean } = {}): string {
  const a = dayAhead(now);
  if (!events) return `${a.label}: I can’t reach my brain right now, so I can’t read your diary.`;
  // the brain out of reach: the phone's own copy may be old, so it is said as the copy and never read as "clear"
  const from = o.copy ? ' (from the copy on this phone: my brain is out of reach)' : '';
  const timed = events.filter((e) => !e.allDay && e.start >= a.from && e.start < a.to).sort((x, y) => x.start - y.start);
  const allDay = events.filter((e) => e.allDay && e.start >= a.day && e.start < a.to);
  if (timed.length) {
    const first = timed[0]!;
    const more = timed.length - 1;
    return `${a.label}: ${first.title} at ${clock(first.start)}${more ? `, then ${more} more` : ''}${allDay.length ? ` (and ${allDay[0]!.title}, all day)` : ''}${from}.`;
  }
  if (allDay.length) return `${a.label}: ${listed(allDay.map((e) => e.title))}, all day; nothing at a set time${from}.`;
  if (o.copy) return `${a.label}: my brain is out of reach and the copy on this phone shows nothing, so I can’t say it’s clear.`;
  const clear = a.label === 'Tomorrow' ? 'Tomorrow is clear: nothing in your diary.' : 'The rest of today is clear: nothing in your diary.';
  return o.calendarsDown ? `${clear.slice(0, -1)}, though one of your calendars didn’t answer.` : clear;
}
