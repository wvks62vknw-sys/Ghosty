/**
 * YOUR WEEK (NEXT ROUND, BODY AND KITCHEN lane): the coach's own room on BODY, from his own numbers on this phone only.
 *  - THE SUNDAY REVIEW (body.u4): the last seven days of water, sleep, steps, weight, mood and tablets side by side, with the best
 *    day picked out (the most goals met). On a Sunday it says so.
 *  - PATTERNS (body.u5): what went with what in his own history ("on the 6 days you walked 8,000 steps or more, you slept 40 min
 *    longer that night"), told as what happened, never as advice and never as a forecast. Only when each side has 3 days or more.
 *  - THE SLEEP SCORE (body.u3): one rough number from how long and how regularly he slept and the week's sleep debt, each part
 *    shown; and a WIND-DOWN NUDGE half an hour before his own usual bedtime, a daily reminder on my brain's clock with only the time.
 * Every number is a rough estimate from what the phone knows, never medical advice.
 */
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { emptyState, phrases, stateLine } from '../lifeui';
import { dayValue, hours, ml, moodWord, shift, weekdayOf, type TrackData } from './trackcore';

const DAY_NAMES: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
export const ROUGH = 'Rough estimates from your own numbers, never medical advice.';
export const WHAT_HAPPENED = 'What happened in your own numbers, not advice or a forecast.';

// ---------------------------------------------------------------- the sleep score

/** His bedtimes from GOING TO BED … I'M UP (the night's wake time less its hours), in minutes after 18:00, the last `n` days. */
export function bedtimes(data: TrackData, today: string, n = 14): number[] {
  const from = shift(today, -n + 1);
  return data.log.sleep.filter((e) => e.note === 'bed' && e.d >= from && e.d <= today).map((e) => {
    const bed = new Date(e.t - e.v * 3_600_000);
    return (((bed.getHours() - 18 + 24) % 24) * 60) + bed.getMinutes();
  });
}
const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
/** "22:45" from minutes after 18:00. */
export const clockOf = (mins: number): string => {
  const t = (Math.round(mins) + 18 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
/** His usual bedtime (the average of the last fortnight's, 3 nights at least), in minutes after 18:00. */
export function usualBed(data: TrackData, today: string): number | null {
  const b = bedtimes(data, today);
  return b.length >= 3 ? b.reduce((a, x) => a + x, 0) / b.length : null;
}

export interface SleepScore {
  score: number;
  duration: number;
  regularity: number;
  debt: number;
  /** Hours under the goal across the week's nights. */
  debtHours: number;
  avg: number;
  nights: number;
  /** How regularity was judged: his bedtimes, or (without them) how much his nights' lengths vary. */
  by: 'bedtimes' | 'lengths';
}
/** One rough score out of 100: half from how long (the week's average against his goal), 30% from how regular, 20% from the debt. */
export function sleepScore(data: TrackData, today: string): SleepScore | null {
  const goal = data.set.sleepGoal;
  const week = Array.from({ length: 7 }, (_, i) => dayValue(data, 'sleep', shift(today, -i))).filter((v): v is number => v != null);
  if (week.length < 3) return null;
  const avg = week.reduce((a, b) => a + b, 0) / week.length;
  const duration = Math.round(Math.min(1, avg / goal) * 100);
  const beds = bedtimes(data, today);
  const by = beds.length >= 3 ? 'bedtimes' : 'lengths';
  const regularity = Math.round(Math.max(0, 1 - (by === 'bedtimes' ? sd(beds) / 90 : sd(week) / 1.5)) * 100);
  const debtHours = Math.round(week.reduce((a, v) => a + Math.max(0, goal - v), 0) * 4) / 4;
  const debt = Math.round(Math.max(0, 1 - debtHours / 7) * 100);
  return { score: Math.round(duration * 0.5 + regularity * 0.3 + debt * 0.2), duration, regularity, debt, debtHours, avg, nights: week.length, by };
}

// ---------------------------------------------------------------- patterns

export interface Pattern {
  id: string;
  words: string;
}
const avgOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const mins = (h2: number) => `${Math.round(Math.abs(h2) * 60)} min`;
/**
 * What went with what in his own last 60 days, each said as what happened (past tense, his numbers, no "should", no "will").
 * A pair is said only when each side has 3 days or more and the gap is worth saying (15 minutes of sleep, half a mood step).
 */
export function patterns(data: TrackData, today: string, extra: { tags?: { d: string; tags: string[] }[] } = {}): Pattern[] {
  const out: Pattern[] = [];
  const days = Array.from({ length: 60 }, (_, i) => shift(today, -i));
  const stepsGoal = data.set.stepsGoal;
  const sleepGoal = data.set.sleepGoal;
  const val = (m: 'water' | 'sleep' | 'steps' | 'mood', d: string) => dayValue(data, m, d);
  const split = (on: (d: string) => boolean | null, measure: (d: string) => number | null) => {
    const yes: number[] = [];
    const no: number[] = [];
    for (const d of days) {
      const g = on(d);
      const v = measure(d);
      if (g == null || v == null) continue;
      (g ? yes : no).push(v);
    }
    return yes.length >= 3 && no.length >= 3 ? { yes, no, gap: avgOf(yes) - avgOf(no) } : null;
  };
  const sk = stepsGoal.toLocaleString('en-GB');
  // steps that day → sleep that night (the night is kept on the day he woke)
  const a = split((d) => (val('steps', d) == null ? null : val('steps', d)! >= stepsGoal), (d) => val('sleep', shift(d, 1)));
  if (a && Math.abs(a.gap) >= 0.25) out.push({ id: 'steps-sleep', words: `On the ${a.yes.length} days you walked ${sk} steps or more, you slept ${mins(a.gap)} ${a.gap > 0 ? 'longer' : 'less'} that night on average than on the ${a.no.length} days you walked less.` });
  // sleep the night before → mood that day
  const b = split((d) => (val('sleep', d) == null ? null : val('sleep', d)! >= sleepGoal), (d) => val('mood', d));
  if (b && Math.abs(b.gap) >= 0.5) out.push({ id: 'sleep-mood', words: `After the ${b.yes.length} nights you slept ${hours(sleepGoal)} or more, your mood was ${moodWord(avgOf(b.yes)).toLowerCase()} on average; after the ${b.no.length} shorter nights, ${moodWord(avgOf(b.no)).toLowerCase()}.` });
  // steps → mood that day
  const c = split((d) => (val('steps', d) == null ? null : val('steps', d)! >= stepsGoal), (d) => val('mood', d));
  if (c && Math.abs(c.gap) >= 0.5) out.push({ id: 'steps-mood', words: `On the ${c.yes.length} days you walked ${sk} steps or more your mood was ${moodWord(avgOf(c.yes)).toLowerCase()} on average, and ${moodWord(avgOf(c.no)).toLowerCase()} on the ${c.no.length} other days.` });
  // water → mood
  const w = split((d) => (val('water', d) == null ? null : val('water', d)! >= 2000), (d) => val('mood', d));
  if (w && Math.abs(w.gap) >= 0.5) out.push({ id: 'water-mood', words: `On the ${w.yes.length} days you drank 2 litres or more your mood was ${moodWord(avgOf(w.yes)).toLowerCase()} on average, and ${moodWord(avgOf(w.no)).toLowerCase()} on the ${w.no.length} days you drank less.` });
  // his mood's tags → the tags that came with good days (body.u13)
  const tagged = (extra.tags ?? []).filter((t) => t.tags.length && days.includes(t.d));
  if (tagged.length >= 5) {
    const count = new Map<string, { good: number; all: number }>();
    for (const t of tagged) {
      const good = (val('mood', t.d) ?? 0) >= 4;
      for (const g of new Set(t.tags)) {
        const c2 = count.get(g) ?? { good: 0, all: 0 };
        c2.all++;
        if (good) c2.good++;
        count.set(g, c2);
      }
    }
    const top = [...count.entries()].filter(([, c2]) => c2.all >= 3).sort((x, y) => y[1].good / y[1].all - x[1].good / x[1].all);
    if (top.length) {
      const [g, c2] = top[0]!;
      out.push({ id: 'tags', words: `“${g}” came with ${c2.good} of the ${c2.all} days you tagged it as good or great.` });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the week side by side

export interface WeekCell {
  m: string;
  label: string;
  value: string;
  sub: string;
}
/** The last seven days of each tracker, side by side, and the best day (the most goals met; a better mood breaks a tie). */
export function weekReview(data: TrackData, today: string, goals: { water: number; sleep: number; steps: number }, meds?: { taken: number; due: number }): { cells: WeekCell[]; best: { d: string; words: string } | null; kept: number } {
  const days = Array.from({ length: 7 }, (_, i) => shift(today, i - 6));
  const vals = (m: 'water' | 'sleep' | 'steps' | 'weight' | 'mood') => days.map((d) => dayValue(data, m, d)).filter((v): v is number => v != null);
  const met = (m: 'water' | 'sleep' | 'steps') => days.filter((d) => (dayValue(data, m, d) ?? -1) >= goals[m]).length;
  const cells: WeekCell[] = [];
  const w = vals('water');
  cells.push({ m: 'water', label: 'Water', value: w.length ? `${ml(avgOf(w))} a day` : 'none kept', sub: w.length ? `goal met ${met('water')} of 7 days` : 'tap a glass on Water' });
  const s = vals('sleep');
  cells.push({ m: 'sleep', label: 'Sleep', value: s.length ? `${hours(avgOf(s))} a night` : 'none kept', sub: s.length ? `goal met ${met('sleep')} of ${s.length} nights` : 'GOING TO BED keeps it' });
  const st = vals('steps');
  cells.push({ m: 'steps', label: 'Steps', value: st.length ? `${Math.round(avgOf(st)).toLocaleString('en-GB')} a day` : 'none kept', sub: st.length ? `goal met ${met('steps')} of 7 days` : 'add today’s on Move' });
  const kg = days.map((d) => dayValue(data, 'weight', d)).filter((v): v is number => v != null);
  cells.push({ m: 'weight', label: 'Weight', value: kg.length ? `${kg[kg.length - 1]} kg` : 'none kept', sub: kg.length >= 2 ? (Math.abs(kg[kg.length - 1]! - kg[0]!) < 0.2 ? 'about the same all week' : `${Math.round(Math.abs(kg[kg.length - 1]! - kg[0]!) * 10) / 10} kg ${kg[kg.length - 1]! < kg[0]! ? 'down' : 'up'} on the week`) : kg.length ? 'one weigh-in this week' : 'once a week is plenty' });
  const md = vals('mood');
  cells.push({ m: 'mood', label: 'Mood', value: md.length ? moodWord(avgOf(md)) : 'none kept', sub: md.length ? `on the ${md.length} day${md.length === 1 ? '' : 's'} you kept it` : 'one tap a day on Mood' });
  if (meds && meds.due) cells.push({ m: 'meds', label: 'Tablets', value: `${meds.taken} of ${meds.due}`, sub: 'doses ticked taken' });
  const score = (d: string) => (['water', 'sleep', 'steps'] as const).filter((m) => (dayValue(data, m, d) ?? -1) >= goals[m]).length;
  const ranked = days.filter((d) => score(d) > 0).sort((a, b) => score(b) - score(a) || (dayValue(data, 'mood', b) ?? 0) - (dayValue(data, 'mood', a) ?? 0) || b.localeCompare(a));
  const kept = days.filter((d) => (['water', 'sleep', 'steps', 'mood', 'weight'] as const).some((m) => dayValue(data, m, d) != null)).length;
  const top = ranked[0];
  let best: { d: string; words: string } | null = null;
  if (top) {
    const which = (['water', 'sleep', 'steps'] as const).filter((m) => (dayValue(data, m, top) ?? -1) >= goals[m]);
    const mood = dayValue(data, 'mood', top);
    best = { d: top, words: `${top === today ? 'Today' : DAY_NAMES[weekdayOf(top)]}: ${which.length === 1 ? `your ${which[0]} goal` : `your ${which.slice(0, -1).join(', ')} and ${which[which.length - 1]} goals`} met${mood != null ? `, mood ${moodWord(mood).toLowerCase()}` : ''}.` };
  }
  return { cells, best, kept };
}

// ---------------------------------------------------------------- the screen

export async function weekScreen(): Promise<{ el: HTMLElement; stop(): void }> {
  const t = await import('./track');
  const meds = await import('./meds').catch(() => null);
  const moodTags = await import('./moodtags').catch(() => null);
  const el = h('div.pkcol.bt', { dataset: { track: 'week' } });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const draw = () => {
    const data = t.load();
    const today = t.todayKey();
    const kids: HTMLElement[] = [];
    const goals = { water: t.goalOf('water', data).v, sleep: t.goalOf('sleep', data).v, steps: t.goalOf('steps', data).v };
    const r = weekReview(data, today, goals, meds && meds.loadMeds().meds.length ? meds.weekOf() : undefined);
    const sunday = weekdayOf(today) === 'Sun';
    kids.push(h('h3.bt-h', sunday ? 'Your Sunday review' : 'The last 7 days'));
    if (!r.kept) {
      /* state: body.week empty */
      kids.push(emptyState('Nothing kept this week yet', 'Log water, sleep, steps or your mood and the week fills in here, side by side, with your best day.'));
    } else {
      kids.push(h('div.bc-grid', { dataset: { review: String(r.cells.length) } }, ...r.cells.map((c) => h('div.bc-cell', { dataset: { cell: c.m } }, h('small', c.label), h('b', c.value), h('small', c.sub)))));
      kids.push(h('p.bc-pattern', { dataset: { best: r.best?.d ?? '' } }, r.best ? `Best day: ${r.best.words}` : 'No goal met yet this week: your best day shows once one is.'));
    }
    // the sleep score
    const sc = sleepScore(data, today);
    kids.push(h('h3.bt-h', 'Sleep score'));
    if (!sc) kids.push(h('p.pknote', { dataset: { score: '' } }, 'Three nights kept in the last week and your sleep score shows here: how long, how regular, and the week’s sleep debt.'));
    else {
      kids.push(h('p.bc-score', { dataset: { score: String(sc.score) } }, h('b', String(sc.score)), h('span', `out of 100 from your last ${sc.nights} nights, a rough score.`)));
      kids.push(h('div.bc-grid', h('div.bc-cell', h('small', 'How long'), h('b', `${sc.duration}`), h('small', `${hours(sc.avg)} a night against your ${hours(data.set.sleepGoal)}`)), h('div.bc-cell', h('small', 'How regular'), h('b', `${sc.regularity}`), h('small', sc.by === 'bedtimes' ? 'from your bedtimes' : 'from how much your nights vary')), h('div.bc-cell', h('small', 'Sleep debt'), h('b', `${sc.debt}`), h('small', sc.debtHours ? `${hours(sc.debtHours)} under your goal this week` : 'none this week'))));
    }
    kids.push(windBox(data, today));
    // patterns
    kids.push(h('h3.bt-h', 'Patterns'));
    const ps = patterns(data, today, { tags: moodTags?.tagDays() ?? [] });
    if (!ps.length) kids.push(h('p.pknote', { dataset: { patterns: '0' } }, 'A pattern shows once your own numbers have at least three days on each side of it, like days you walked more and the sleep that followed.'));
    else kids.push(h('div.pkcol', { dataset: { patterns: String(ps.length) } }, ...ps.map((p) => h('p.bc-pattern', { dataset: { pattern: p.id } }, p.words)), h('p.pknote', WHAT_HAPPENED)));
    if (t.failedNow()) {
      /* state: body.week error */
      kids.push(stateLine('error', t.failedNow()));
    }
    kids.push(status, phrases(['how was my week?', 'my sleep score', 'any patterns?']), h('p.pknote', `Kept on this phone only. ${ROUGH}`));
    const open = new Set([...el.querySelectorAll('details[open]')].map((x) => x.className));
    el.replaceChildren(...kids);
    el.querySelectorAll('details').forEach((x) => open.has(x.className) && ((x as HTMLDetailsElement).open = true));
  };
  const windBox = (data: TrackData, today: string) => {
    const usual = usualBed(data, today);
    const on = data.set.wind.on;
    const b = button(on ? 'Wind-down nudge: on' : 'Wind-down nudge: off', () => {
      data.set.wind.on = !data.set.wind.on;
      t.saveNow();
      void t.syncWind();
      status.textContent = data.set.wind.on ? (usual == null ? 'On. It starts once three nights are kept with GOING TO BED.' : `On: a nudge at ${clockOf(usual - 30)} each evening, half an hour before your usual bedtime. My brain gets only that time.`) : 'No wind-down nudge.';
    });
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(on));
    b.setAttribute('aria-label', 'A wind-down nudge before my usual bedtime');
    return h('details.pkmore.bc-wind', h('summary', `Wind-down nudge: ${on ? (usual == null ? 'on, waiting for 3 nights' : `on, at ${clockOf(usual - 30)}`) : 'off'}`), h('div.pkrow', b),
      h('p.pknote', { dataset: { usual: usual == null ? '' : clockOf(usual) } }, usual == null ? 'Your usual bedtime shows once three nights are kept with GOING TO BED and I’M UP.' : `Your usual bedtime over the last fortnight: about ${clockOf(usual)}. The nudge comes half an hour before, on your lock screen, through my brain’s push, which gets only the time.`));
  };
  const off = t.onChange(draw);
  draw();
  return { el, stop: off };
}
