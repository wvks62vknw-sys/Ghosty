/**
 * THE BODY TRACKERS on the phone (FINAL ROUND, BODY lane): WATER, SLEEP, STEPS, WEIGHT and MOOD, each a whole app of its own
 * on the BODY screen and as a sheet over the chat. Everything is kept in this phone's storage only (`ghosty.body.track`):
 * nothing is sent to my brain or anywhere else. Every goal and number is a first estimate, never medical advice.
 *
 * Each has: today's ring with the goal, quick keys, the week and the month as a chart with the goal's line, the streak and
 * the best streak, the goal said with how it was worked out, today's entries to take back one by one, and its chat words.
 * WATER also has his own cup sizes and the nudges (only inside his nudge hours, never in his quiet hours, never once he is on
 * track). The pure parts are in ./trackcore.ts; the state is on window.__ghosty.track for the specs.
 */
import { h, svgEl } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { emptyState, lacksSignal, phrases, stateLine } from '../lifeui';
import {
  average, bmi, CUPS, nudgeTimes, dayOf, dayValue, empty, FIRST_ESTIMATE, hours, latest, mend, ml, moodWord, MOODS, nudgeDue, series, shift, sleepGoal, stepsGoal, stone, streak, trackAsked, waterGoal, weekdayOf,
  type Entry, type Goal, type Metric, type TrackAsk, type TrackData,
} from './trackcore';

const KEY = 'ghosty.body.track';
let cache: TrackData | null = null;
const listeners = new Set<() => void>();
/** The last storage failure (the screen says it in his words). */
let failed = '';

export function load(): TrackData {
  if (cache) return cache;
  try {
    cache = mend(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    cache = empty();
  }
  return cache;
}
function save(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
    failed = '';
  } catch {
    failed = 'I couldn’t keep that on this phone: its storage is full or switched off. It’s here until you close Ghosty.';
  }
  for (const f of listeners) f();
  lockSoon();
  return !failed;
}
const now = (): number => Date.now() + ((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset ?? 0);
const today = (): string => dayOf(now());

/** The day's highest temperature, when the phone has read the weather (no read is made here for it). */
let maxC: number | null = null;
async function readHeat(): Promise<void> {
  try {
    const w = await import('../../data/weather');
    const d = w.weather.data ?? (lacksSignal() ? null : await w.weather.refresh());
    const t = d?.daily?.temperature_2m_max?.[0];
    maxC = typeof t === 'number' && Number.isFinite(t) ? t : null;
  } catch {
    maxC = null;
  }
}
/** A spec's stand-in for the day's highest temperature (window.__ghostyHeat). */
const heat = (): number | null => {
  const s = (window as unknown as { __ghostyHeat?: number | null }).__ghostyHeat;
  return s !== undefined ? s : maxC;
};

export function goalOf(m: Metric, data = load()): Goal {
  if (m === 'water') return waterGoal(data, today(), heat());
  if (m === 'sleep') return sleepGoal(data);
  if (m === 'steps') return stepsGoal(data);
  if (m === 'weight') return { v: data.set.weightGoal ?? 0, own: !!data.set.weightGoal, why: data.set.weightGoal ? [`The weight you aim for: ${data.set.weightGoal} kg.`] : ['No weight to aim for set: the chart shows the trend.'] };
  return { v: 3, own: false, why: ['A day you log your mood counts towards the streak.'] };
}

/** Keeps one entry, and says it back in his words. */
export function add(m: Metric, v: number, from: Entry['from'] = 'tap', note?: string): string {
  const data = load();
  const t = now();
  const d = dayOf(t);
  // sleep, weight and mood keep one a day: the newest replaces the day's last
  if (m !== 'water' && m !== 'steps') data.log[m] = data.log[m].filter((e) => e.d !== d);
  data.log[m].push({ d, t, v, from, ...(note ? { note } : {}) });
  data.log[m] = data.log[m].slice(-3000);
  const ok = save();
  return ok ? said(m, v) : failed;
}
/** Takes back today's last entry of a tracker. */
export function undo(m: Metric): string {
  const data = load();
  const d = today();
  const list = data.log[m];
  const i = list.map((e) => e.d).lastIndexOf(d);
  if (i < 0) return `Nothing kept for ${m} today, so nothing to take back.`;
  const [gone] = list.splice(i, 1);
  save();
  return `Taken back: ${m === 'water' ? ml(gone!.v) : m === 'sleep' ? hours(gone!.v) : m === 'steps' ? `${gone!.v.toLocaleString('en-GB')} steps` : m === 'weight' ? `${gone!.v} kg` : moodWord(gone!.v)}. ${line(m)}`;
}
function removeEntry(m: Metric, t: number): void {
  const data = load();
  data.log[m] = data.log[m].filter((e) => e.t !== t);
  save();
}

/** What a tracker says after a log: the amount, today's total against the goal, and the next thing. */
function said(m: Metric, v: number): string {
  if (m === 'water') return `${ml(v)} kept. ${line('water')}`;
  if (m === 'sleep') return `${hours(v)} of sleep kept. ${line('sleep')}`;
  if (m === 'steps') return `${v.toLocaleString('en-GB')} steps kept. ${line('steps')}`;
  if (m === 'weight') return `${v} kg (${stone(v)}) kept. ${line('weight')}`;
  return `Mood kept: ${moodWord(v)}. ${line('mood')}`;
}

/** Today's line for a tracker, as the screen's top, the chat and the Home card say it. */
export function line(m: Metric): string {
  const data = load();
  const d = today();
  const g = goalOf(m, data);
  const v = dayValue(data, m, d);
  if (m === 'water') {
    const drunk = v ?? 0;
    const s = streak(data, 'water', d, g.v).now;
    if (drunk >= g.v) return `${ml(drunk)} today: that’s your ${ml(g.v)} goal met${s > 1 ? `, ${s} days in a row` : ''}.`;
    return `${ml(drunk)} of ${ml(g.v)} today, ${ml(g.v - drunk)} to go.`;
  }
  if (m === 'sleep') {
    if (v == null) return `No sleep kept for last night. Your goal is ${hours(g.v)}.`;
    return v >= g.v ? `${hours(v)} last night: your ${hours(g.v)} goal met.` : `${hours(v)} last night, ${hours(g.v - v)} under your ${hours(g.v)} goal.`;
  }
  if (m === 'steps') {
    const s = v ?? 0;
    return s >= g.v ? `${s.toLocaleString('en-GB')} steps today: your ${g.v.toLocaleString('en-GB')} goal met.` : `${s.toLocaleString('en-GB')} of ${g.v.toLocaleString('en-GB')} steps today.`;
  }
  if (m === 'weight') {
    const kg = latest(data, 'weight');
    if (kg == null) return 'No weight kept yet.';
    const wk = average(data, 'weight', d, 7);
    const before = (() => {
      const v2 = series(data, 'weight', shift(d, -14), 7).map((x) => x.v).filter((x): x is number => x != null);
      return v2.length ? v2.reduce((a, b) => a + b, 0) / v2.length : null;
    })();
    const trend = wk != null && before != null ? (Math.abs(wk - before) < 0.2 ? ' About the same as two weeks before.' : ` ${Math.abs(Math.round((wk - before) * 10) / 10)} kg ${wk < before ? 'less' : 'more'} than two weeks before, on average.`) : '';
    return `${kg} kg (${stone(kg)}) last kept.${trend}`;
  }
  if (v == null) return 'No mood kept today.';
  return `Today: ${moodWord(v)}.`;
}

/** A tracker's answer to "how much …?" over today, the week or the month. */
export function answer(m: Metric, span: 'today' | 'week' | 'month'): string {
  if (span === 'today' || m === 'weight') return `${line(m)}${m === 'weight' ? ` ${FIRST_ESTIMATE}` : ''}`;
  const data = load();
  const d = today();
  const n = span === 'week' ? 7 : 30;
  const a = average(data, m, d, n);
  const kept = series(data, m, d, n).filter((x) => x.v != null).length;
  if (a == null) return `Nothing kept for ${m} in the last ${n} days.`;
  const g = goalOf(m, data);
  const met = series(data, m, d, n).filter((x) => x.v != null && (m === 'mood' || x.v >= g.v)).length;
  const avg = m === 'water' ? ml(a) : m === 'sleep' ? hours(a) : m === 'steps' ? `${Math.round(a).toLocaleString('en-GB')} steps` : moodWord(a);
  if (m === 'mood') return `Over the last ${n} days your mood was ${avg.toLowerCase()} on average, on the ${kept} day${kept === 1 ? '' : 's'} you kept it.`;
  return `Over the last ${n} days: ${avg} a day on average (the ${kept} day${kept === 1 ? '' : 's'} kept), the goal met on ${met}. ${FIRST_ESTIMATE}`;
}

// ---------------------------------------------------------------- drawing

const TITLE: Record<Metric, string> = { water: 'Water', sleep: 'Sleep', steps: 'Steps', weight: 'Weight', mood: 'Mood' };
const SAYS: Record<Metric, string[]> = {
  water: ['I drank a pint', 'log a glass of water', 'how much have I drunk?'],
  sleep: ['I slept 7 and a half hours', 'going to bed', 'how did I sleep this week?'],
  steps: ['walked 6,000 steps', 'how many steps today?'],
  weight: ['I weigh 82.5 kg', 'what do I weigh?'],
  mood: ['my mood is good', 'how has my mood been?'],
};

/** Today's ring: the share of the goal, its value in the middle. */
function ring(frac: number, big: string, small: string): HTMLElement {
  const r = 52;
  const c = 2 * Math.PI * r;
  const svg = svgEl('svg', { viewBox: '0 0 120 120', class: 'bt-ring', 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { cx: 60, cy: 60, r, class: 'bt-track' }), svgEl('circle', { cx: 60, cy: 60, r, class: frac >= 1 ? 'bt-fill met' : 'bt-fill', 'stroke-dasharray': `${(Math.max(0, Math.min(1, frac)) * c).toFixed(1)} ${c.toFixed(1)}`, transform: 'rotate(-90 60 60)' }));
  return h('div.bt-ringbox', svg, h('div.bt-ringmid', h('b.bt-ringbig', big), h('span.bt-ringsmall', small)));
}

/** The week's or month's chart: a bar a day, the goal's line, the days under it. */
function chart(m: Metric, span: 7 | 30, goal: number): HTMLElement {
  const data = load();
  const s = series(data, m, today(), span);
  const vals = s.map((x) => x.v).filter((x): x is number => x != null);
  let lo = 0;
  let hi = Math.max(goal || 1, ...vals, 1);
  if (m === 'weight' && vals.length) {
    lo = Math.floor(Math.min(...vals, goal || Infinity) - 2);
    hi = Math.ceil(Math.max(...vals, goal || 0) + 1);
  }
  if (m === 'mood') hi = 5;
  const W = span * 10;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} 100`, preserveAspectRatio: 'none', class: 'bt-chart', role: 'img', 'aria-label': `${TITLE[m]}, the last ${span} days: ${s.filter((x) => x.v != null).length} kept` });
  const y = (v: number) => 100 - ((v - lo) / Math.max(1e-6, hi - lo)) * 96;
  s.forEach((x, i) => {
    if (x.v == null) return;
    const top = y(x.v);
    const ok = m === 'weight' || m === 'mood' ? true : x.v >= goal;
    svg.append(svgEl('rect', { x: i * 10 + 1.5, y: top, width: 7, height: Math.max(1, 100 - top), class: ok ? 'bt-bar met' : 'bt-bar', 'data-d': x.d }));
  });
  if (goal && m !== 'mood') svg.append(svgEl('line', { x1: 0, x2: W, y1: y(goal), y2: y(goal), class: 'bt-goal' }));
  const labels = h('div.bt-days', { style: `grid-template-columns:repeat(${span},minmax(0,1fr))`, 'aria-hidden': 'true' }, ...s.map((x, i) => h('small', span === 7 ? weekdayOf(x.d).slice(0, 1) : i % 7 === 6 || i === 0 ? String(Number(x.d.slice(8))) : '')));
  return h('div.bt-chartbox', svg, labels);
}

/** One tracker's whole screen. */
export function trackScreen(m: Metric): { el: HTMLElement; stop(): void } {
  expose();
  const el = h('div.pkcol.bt', { dataset: { track: m } });
  let span: 7 | 30 = 7;
  let alive = true;
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const draw = () => {
    if (!alive) return;
    // (a fold he opened stays open through a redraw)
    const wasOpen = new Set([...el.querySelectorAll('details[open]')].map((x) => x.className));
    const data = load();
    const d = today();
    const g = goalOf(m, data);
    const v = dayValue(data, m, d);
    const st = streak(data, m, d, g.v);
    const kids: (HTMLElement | null)[] = [];
    // the ring and today's line
    const big = m === 'water' ? ml(v ?? 0) : m === 'sleep' ? (v == null ? '—' : hours(v)) : m === 'steps' ? (v ?? 0).toLocaleString('en-GB') : m === 'weight' ? (latest(data, 'weight') == null ? '—' : `${latest(data, 'weight')} kg`) : v == null ? '—' : moodWord(v);
    const small = m === 'water' ? `of ${ml(g.v)}` : m === 'sleep' ? `of ${hours(g.v)}` : m === 'steps' ? `of ${g.v.toLocaleString('en-GB')}` : m === 'weight' ? (latest(data, 'weight') != null ? stone(latest(data, 'weight')!) : 'not kept yet') : 'today';
    const frac = m === 'weight' ? (latest(data, 'weight') != null ? 1 : 0) : m === 'mood' ? (v ?? 0) / 5 : (v ?? 0) / Math.max(1, g.v);
    kids.push(h('div.bt-hero', ring(frac, big, small), h('div.bt-herotext', h('p.bt-line', { dataset: { line: m } }, line(m)), h('p.pknote.bt-streak', st.now ? `${st.now} day${st.now === 1 ? '' : 's'} in a row${st.best > st.now ? ` (best ${st.best})` : st.now > 1 ? ', your best' : ''}.` : st.best ? `No run going. Your best: ${st.best} day${st.best === 1 ? '' : 's'} in a row.` : 'Your streak starts the first day you meet the goal.'))));
    /* state: body.water empty */
    if (m === 'water' && !data.log.water.some((e) => e.d === d)) kids.push(emptyState('Nothing drunk yet today', 'Tap a glass, a mug, a bottle or a pint each time you have one.'));
    /* state: body.sleep empty */
    if (m === 'sleep' && !data.log.sleep.length && !data.set.bedAt) kids.push(emptyState('No sleep kept yet', 'Tap GOING TO BED tonight and I’M UP in the morning, or tap last night’s hours.'));
    /* state: body.steps empty */
    if (m === 'steps' && !data.log.steps.length) kids.push(emptyState('No steps kept yet', 'Add today’s steps from your phone or watch, or read your Health export on the Health pill.'));
    /* state: body.weight empty */
    if (m === 'weight' && !data.log.weight.length) kids.push(emptyState('No weight kept yet', 'Type it below in kilos or stone. Once a week is plenty for the trend.'));
    /* state: body.mood empty */
    if (m === 'mood' && !data.log.mood.length) kids.push(emptyState('No mood kept yet', 'Tap how today feels. One tap a day shows you the shape of your weeks.'));
    if (failed) {
      /* state: body.water error */
      /* state: body.sleep error */
      /* state: body.steps error */
      /* state: body.weight error */
      /* state: body.mood error */
      kids.push(stateLine('error', failed));
    }
    kids.push(...keys(m, data));
    // the chart
    const toggle = h('div.pkrow', { role: 'group', 'aria-label': 'Show the week or the month' },
      ...([7, 30] as const).map((n) => {
        const b = button(n === 7 ? 'Week' : 'Month', () => {
          span = n;
          draw();
        });
        b.setAttribute('aria-pressed', String(span === n));
        return b;
      }));
    const avg = average(data, m, d, span);
    const avgWords = avg == null ? `Nothing kept in the last ${span} days.` : `${span === 7 ? 'This week' : 'The last 30 days'}: ${m === 'water' ? ml(avg) : m === 'sleep' ? hours(avg) : m === 'steps' ? `${Math.round(avg).toLocaleString('en-GB')} steps` : m === 'weight' ? `${Math.round(avg * 10) / 10} kg` : moodWord(avg).toLowerCase()} ${m === 'weight' || m === 'mood' ? 'on average' : 'a day on average'}.`;
    kids.push(h('section.bt-hist', { 'aria-label': 'History' }, h('h3.bt-h', 'History'), toggle, chart(m, span, g.v), h('p.pknote', { dataset: { avg: m } }, avgWords)));
    // today's entries, each to take back
    const todays = data.log[m].filter((e) => e.d === d).sort((a, b) => b.t - a.t);
    if (todays.length && (m === 'water' || m === 'steps')) {
      kids.push(h('section', { 'aria-label': 'Today' }, h('h3.bt-h', 'Today'), h('ul.pkitems', ...todays.slice(0, 12).map((e) => {
        const at = new Date(e.t);
        const what = m === 'water' ? `${ml(e.v)}${e.note ? `, ${e.note.toLowerCase()}` : ''}` : `${e.v.toLocaleString('en-GB')} steps`;
        const x = button('Take back', () => {
          removeEntry(m, e.t);
          status.textContent = `Taken back: ${what}.`;
        });
        x.setAttribute('aria-label', `Take back ${what} at ${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`);
        return h('li.pkitem', h('span.bt-entry', `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')} · ${what}`), x);
      }))));
    }
    kids.push(goalBox(m, data, g));
    if (m === 'water') kids.push(nudgeBox(data));
    if (m === 'water' && lacksSignal() && heat() == null) {
      /* state: body.water offline */
      kids.push(stateLine('offline', 'No signal: everything here works on the phone. The goal adds for a hot day once the weather can be read.'));
    }
    kids.push(status, phrases(SAYS[m]), h('p.pknote', `Kept on this phone only. ${FIRST_ESTIMATE}`));
    el.replaceChildren(...kids.filter((k): k is HTMLElement => !!k));
    el.querySelectorAll('details').forEach((x) => wasOpen.has(x.className) && ((x as HTMLDetailsElement).open = true));
  };
  const say = (words: string) => {
    status.textContent = words;
  };
  /** The keys for each tracker. */
  function keys(mm: Metric, data: TrackData): HTMLElement[] {
    if (mm === 'water') {
      const cups = [...CUPS, ...data.set.cups];
      const row = h('div.pkrow.bt-cups', ...cups.map((c) => {
        const b = button(h('span.bt-cup', h('b', c.name), h('small', ml(c.ml))), () => say(add('water', c.ml, 'tap', c.name)));
        b.setAttribute('aria-label', `Add a ${c.name.toLowerCase()}, ${ml(c.ml)}`);
        return b;
      }));
      const amt = h('input', { type: 'number', inputmode: 'numeric', min: '10', max: '3000', placeholder: 'ml', 'aria-label': 'Another amount, in ml' }) as HTMLInputElement;
      const addAmt = button('Add', () => {
        const v = Math.round(Number(amt.value));
        if (!(v >= 10 && v <= 3000)) return say('Type an amount between 10 and 3,000 ml.');
        amt.value = '';
        say(add('water', v, 'tap'));
      });
      addAmt.setAttribute('aria-label', 'Add that amount');
      const un = button('Undo', () => say(undo('water')));
      un.setAttribute('aria-label', 'Take back the last drink');
      return [row, h('div.pkadd', amt, addAmt, un)];
    }
    if (mm === 'sleep') {
      const bed = data.set.bedAt;
      const night = button(bed ? 'I’m up' : 'Going to bed', () => say(bed ? up() : toBed()), 'on');
      night.setAttribute('aria-label', bed ? 'I’m up: keep the night' : 'Going to bed: start the night');
      const quick = h('div.pkrow', ...[6, 7, 7.5, 8, 9].map((x) => {
        const b = button(hours(x), () => say(add('sleep', x, 'tap')));
        b.setAttribute('aria-label', `Last night: ${hours(x)}`);
        return b;
      }));
      return [h('div.pkrow', night), bed ? h('p.pknote', { dataset: { bed: '1' } }, `In bed since ${new Date(bed).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Tap I’M UP when you wake.`) : h('p.pknote', 'Or tap last night’s hours:'), quick];
    }
    if (mm === 'steps') {
      const row = h('div.pkrow', ...[1000, 2500, 5000].map((x) => {
        const b = button(`+${x.toLocaleString('en-GB')}`, () => say(add('steps', x, 'tap')));
        b.setAttribute('aria-label', `Add ${x.toLocaleString('en-GB')} steps`);
        return b;
      }));
      const amt = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '100000', placeholder: 'Steps', 'aria-label': 'Steps to add' }) as HTMLInputElement;
      const b = button('Add', () => {
        const v = Math.round(Number(amt.value));
        if (!(v >= 1 && v <= 100000)) return say('Type a number of steps, up to 100,000.');
        amt.value = '';
        say(add('steps', v, 'tap'));
      });
      b.setAttribute('aria-label', 'Add those steps');
      const un = button('Undo', () => say(undo('steps')));
      un.setAttribute('aria-label', 'Take back the last steps');
      return [row, h('div.pkadd', amt, b, un), shortcutBox()];
    }
    if (mm === 'weight') {
      const amt = h('input', { type: 'text', inputmode: 'decimal', placeholder: '82.5 kg or 13 st 4', 'aria-label': 'Your weight, in kilos or stone' }) as HTMLInputElement;
      const b = button('Keep', () => {
        const ask = trackAsked(`i weigh ${amt.value}`);
        if (!ask || ask.kind !== 'log') return say('Type it like 82.5 kg, 13 st 4 or 182 lb.');
        amt.value = '';
        say(add('weight', ask.v, 'tap'));
      }, 'on');
      b.setAttribute('aria-label', 'Keep this weight');
      const kg = latest(data, 'weight');
      const info: HTMLElement[] = [];
      if (kg != null && data.set.heightCm) {
        const b2 = bmi(kg, data.set.heightCm);
        info.push(h('p.pknote', { dataset: { bmi: String(b2.v) } }, `BMI about ${b2.v}, ${b2.band}. BMI doesn’t see muscle or build. ${FIRST_ESTIMATE}`));
      }
      return [h('div.pkadd', amt, b), ...info];
    }
    const row = h('div.pkrow.bt-moods', { role: 'group', 'aria-label': 'How today feels' }, ...MOODS.map((w, i) => {
      const b = button(w, () => say(add('mood', i + 1, 'tap')));
      b.setAttribute('aria-pressed', String(dayValue(data, 'mood', today()) === i + 1));
      return b;
    }));
    const tags = h('div.pkcol');
    void import('./moodtags').then((t) => tags.replaceChildren(t.tagBox(today(), (d) => dayValue(load(), 'mood', d), say))).catch(() => undefined);
    return [row, tags];
  }
  /** Steps from Health each evening: the Shortcut to make once, in four steps, and its link (the number lands here). */
  function shortcutBox(): HTMLElement {
    const link = `${location.origin}/#body?steps=`;
    const copy = button('Copy the link', async () => {
      try {
        await navigator.clipboard.writeText(link);
        say('Copied. Paste it in the Shortcut’s Open URLs step, with the step count after the = sign.');
      } catch {
        say(`The link: ${link}`);
      }
    });
    copy.setAttribute('aria-label', 'Copy the Shortcut’s link');
    return h('details.pkmore.bt-shortcut', h('summary', 'Steps from Health, each evening'),
      h('p.pknote', 'Make this once in Apple’s Shortcuts app and today’s steps arrive here every evening, read on your phone:'),
      h('ol.pklist',
        h('li', 'Shortcuts, then Automation, then New Automation: Time of Day, 21:00, Daily, Run Immediately.'),
        h('li', 'Add Find Health Samples: Type is Steps, Start Date is Today.'),
        h('li', 'Add Calculate Statistics: Sum of the samples, then Round Number.'),
        h('li', h('span', 'Add Open URLs with this link, the rounded number after the = sign: '), h('code.bt-link', link))),
      h('div.pkrow', copy),
      h('p.pknote', 'The number replaces the one the Shortcut sent earlier that day, and never adds to steps you typed yourself. It stays on this phone.'));
  }
  function goalBox(mm: Metric, data: TrackData, g: Goal): HTMLElement {
    const box = h('details.pkmore.bt-goalbox', h('summary', mm === 'mood' ? 'About the streak' : mm === 'weight' ? 'Your height and aim' : `Your goal: ${mm === 'water' ? ml(g.v) : mm === 'sleep' ? hours(g.v) : `${g.v.toLocaleString('en-GB')} steps`}`), ...g.why.map((w) => h('p.pknote', w)), ...(g.own || mm === 'mood' || mm === 'weight' ? [] : [h('p.pknote', FIRST_ESTIMATE)]));
    if (mm === 'mood') return box;
    const field = (label: string, value: string, unit: string, keep: (v: number) => string | null) => {
      const inp = h('input', { type: 'number', inputmode: 'decimal', value, placeholder: unit, 'aria-label': label }) as HTMLInputElement;
      const b = button('Set', () => {
        const err = keep(Number(inp.value));
        say(err ?? `${label}: set.`);
        if (!err) draw();
      });
      b.setAttribute('aria-label', `Set ${label.toLowerCase()}`);
      return h('div.pkfield', h('label', label), h('div.pkadd', inp, b));
    };
    if (mm === 'water') {
      box.append(field('Your own goal, in ml', data.set.waterGoal ? String(data.set.waterGoal) : '', 'ml', (v) => {
        if (!(v >= 500 && v <= 6000)) return 'A goal between 500 and 6,000 ml.';
        data.set.waterGoal = Math.round(v);
        save();
        return null;
      }));
      if (data.set.waterGoal) box.append(h('div.pkrow', button('Use the estimate', () => {
        data.set.waterGoal = null;
        save();
      })));
      // his own cup
      const name = h('input', { type: 'text', placeholder: 'Name', maxlength: '24', 'aria-label': 'Your cup’s name' }) as HTMLInputElement;
      const size = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'ml', 'aria-label': 'Your cup’s size, in ml' }) as HTMLInputElement;
      const b = button('Add cup', () => {
        const v = Math.round(Number(size.value));
        if (!name.value.trim() || !(v >= 30 && v <= 3000)) return say('Give your cup a name and a size between 30 and 3,000 ml.');
        data.set.cups = [...data.set.cups.filter((c) => c.name.toLowerCase() !== name.value.trim().toLowerCase()), { name: name.value.trim().slice(0, 24), ml: v }].slice(-6);
        save();
        say(`${name.value.trim()} (${ml(v)}) is a key now. Say “I drank a ${name.value.trim().toLowerCase()}” too.`);
      });
      b.setAttribute('aria-label', 'Add your own cup');
      box.append(h('div.pkfield', h('label', 'Your own cups'), h('div.pkadd', name, size, b)), ...data.set.cups.map((c) => {
        const x = button('Remove', () => {
          data.set.cups = data.set.cups.filter((y) => y !== c);
          save();
        });
        x.setAttribute('aria-label', `Remove your ${c.name}`);
        return h('div.pkitem', h('span.bt-entry', `${c.name}, ${ml(c.ml)}`), x);
      }));
    }
    if (mm === 'sleep') box.append(field('Hours a night', String(data.set.sleepGoal), 'hours', (v) => {
      if (!(v >= 4 && v <= 12)) return 'A goal between 4 and 12 hours.';
      data.set.sleepGoal = Math.round(v * 4) / 4;
      save();
      return null;
    }));
    if (mm === 'steps') box.append(field('Steps a day', String(data.set.stepsGoal), 'steps', (v) => {
      if (!(v >= 1000 && v <= 40000)) return 'A goal between 1,000 and 40,000 steps.';
      data.set.stepsGoal = Math.round(v);
      save();
      return null;
    }));
    if (mm === 'weight') {
      box.append(field('Your height, in cm', data.set.heightCm ? String(data.set.heightCm) : '', 'cm', (v) => {
        if (!(v >= 100 && v <= 250)) return 'A height between 100 and 250 cm.';
        data.set.heightCm = Math.round(v);
        save();
        return null;
      }), field('The weight you aim for, in kg', data.set.weightGoal ? String(data.set.weightGoal) : '', 'kg', (v) => {
        if (!(v >= 25 && v <= 350)) return 'A weight between 25 and 350 kg.';
        data.set.weightGoal = Math.round(v * 10) / 10;
        save();
        return null;
      }));
    }
    return box;
  }
  function nudgeBox(data: TrackData): HTMLElement {
    const r = data.set.remind;
    const hourSel = (label: string, v: number, set: (x: number) => void, max = 23) => {
      const s = h('select', { 'aria-label': label }, ...Array.from({ length: max + 1 }, (_, i) => h('option', { value: String(i), ...(i === v ? { selected: true } : {}) }, `${String(i % 24).padStart(2, '0')}:00`))) as HTMLSelectElement;
      s.addEventListener('change', () => {
        set(Number(s.value));
        save();
      });
      return h('div.pkfield', h('label', label), s);
    };
    const onoff = button(r.on ? 'Nudges on' : 'Nudges off', () => {
      r.on = !r.on;
      save();
      say(r.on ? `I nudge you between ${String(r.from).padStart(2, '0')}:00 and ${String(r.to).padStart(2, '0')}:00 when you fall behind, never in your quiet hours, and stop once you’re on track.` : 'No more water nudges.');
    });
    onoff.setAttribute('aria-pressed', String(r.on));
    const every = h('select', { 'aria-label': 'At most every' }, ...[30, 60, 90, 120, 180].map((x) => h('option', { value: String(x), ...(x === r.every ? { selected: true } : {}) }, EVERY[x] ?? `${x} min`))) as HTMLSelectElement;
    every.addEventListener('change', () => {
      r.every = Number(every.value);
      save();
    });
    const due = nudgeDue(data, now(), goalOf('water', data).v);
    const why = !r.on ? 'Off. Turn them on and I nudge you only when you fall behind.' : due.why === 'quiet' ? 'Quiet hours now: no nudges.' : due.why === 'met' ? 'Goal met today: no more nudges.' : due.why === 'on track' ? 'You’re on track: no nudge needed.' : due.why === 'outside' ? 'Outside your nudge hours.' : due.why === 'soon' ? 'Next nudge only if you’re still behind.' : 'Behind for the time of day: a nudge is due.';
    return h('details.pkmore.bt-nudges', h('summary', `Nudges: ${r.on ? 'on' : 'off'}`), h('div.pkrow', onoff), h('p.pknote', { dataset: { nudge: due.why } }, why),
      h('div.bt-grid2', hourSel('From', r.from, (x) => (r.from = x)), hourSel('Until', r.to, (x) => (r.to = Math.max(x, r.from + 1)), 24), hourSel('Quiet from', r.quietFrom, (x) => (r.quietFrom = x)), hourSel('Quiet until', r.quietTo, (x) => (r.quietTo = x))),
      h('div.pkfield', h('label', 'At most every'), every), lockRow());
  }
  /** On the lock screen too: my brain's push gets only the next nudge times, never how much he drank. */
  function lockRow(): HTMLElement {
    const r = load().set.remind;
    const b = button(r.lock ? 'Lock screen: on' : 'Lock screen: off', () => {
      r.lock = !r.lock;
      save();
      say(r.lock ? 'Nudges reach your lock screen too, through my brain’s push. It gets only the times to nudge, never how much you drink.' : 'Nudges only while Ghosty is open now.');
    });
    // (a switch, so it is told apart from the nudges' own on/off key)
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(r.lock));
    b.setAttribute('aria-label', 'Nudges on the lock screen');
    const n = nudgeState.lock.length;
    return h('div.pkcol', h('div.pkrow', b), h('p.pknote', { dataset: { lock: r.on && r.lock ? String(n) : 'off' } }, !r.on ? 'Turn nudges on first.' : !r.lock ? 'Off: nudges come only while Ghosty is open.' : n ? `The next ${n === 1 ? 'nudge' : `${n} nudges`} today ${n === 1 ? 'is' : 'are'} with my brain, from ${new Date(nudgeState.lock[0]!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}: only the times, never your amounts. They need notifications on (Settings, Notifications).` : 'No nudge needed for the rest of today at this pace.'));
  }
  listeners.add(draw);
  if (m === 'water' && heat() == null) {
    /* state: body.water loading */
    const wait = stateLine('loading', 'Reading today’s weather for your goal…');
    draw();
    el.insertBefore(wait, el.children[1] ?? null);
    void readHeat().then(() => {
      wait.remove();
      draw();
    });
  } else draw();
  return { el, stop: () => {
    alive = false;
    listeners.delete(draw);
  } };
}

/** GOING TO BED: the night starts now. */
export function toBed(): string {
  const data = load();
  data.set.bedAt = now();
  save();
  return `Goodnight. I keep the time; tap I’M UP or say “I’m up now” when you wake.`;
}
/** I'M UP: the night kept, from bed to now. */
export function up(): string {
  const data = load();
  const bed = data.set.bedAt;
  if (!bed) return 'I don’t have a bedtime for last night. Tap last night’s hours instead.';
  const hrs = Math.round(((now() - bed) / 3_600_000) * 4) / 4;
  data.set.bedAt = null;
  if (hrs < 1 || hrs > 16) {
    save();
    return `That was ${hours(Math.max(0, hrs))}, which doesn’t look like a night, so I didn’t keep it. Tap last night’s hours instead.`;
  }
  const words = add('sleep', hrs, 'tap', 'bed');
  void syncWind();
  return words;
}

// ---------------------------------------------------------------- nudges

const EVERY: Record<number, string> = { 30: '30 min', 60: '1 h', 90: '1 h 30 min', 120: '2 h', 180: '3 h' };
let ticking = 0;
/** The water nudges: checked every minute while Ghosty is open; a toast, and a system notification when the app is hidden. */
export function startNudges(): void {
  if (ticking) return;
  const tick = () => {
    const data = load();
    if (!data.set.remind.on) return;
    const g = goalOf('water', data).v;
    const due = nudgeDue(data, now(), g);
    nudgeState.last = due.why;
    if (!due.due) return;
    data.nudged = now();
    save();
    const words = `Time for some water: ${line('water')}`;
    nudgeState.said.push(words);
    toast(words, '', { title: 'WATER' });
    try {
      // (with the lock-screen nudges on, my brain's push already says it: no second notification)
      if (!(data.set.remind.lock && data.set.remind.jobs.length) && document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Water', { body: words, tag: 'ghosty-water' });
    } catch {
      /* the toast has it */
    }
  };
  ticking = window.setInterval(tick, 60_000);
  // a new day's times (or a phone that was closed): sent again once, a little after it opens
  if (load().set.remind.on) window.setTimeout(lockSoon, 4000);
  nudgeState.tick = tick;
}
export const nudgeState = { last: '', said: [] as string[], tick: () => undefined as void, lock: [] as number[], sync: () => syncLock() };

// ---------------------------------------------------------------- the lock screen (body.u1)

let lockTimer = 0;
let lockSig = '';
let lockBusy: Promise<void> = Promise.resolve();
/** After a change, the next nudge times go to my brain (only the times, never an amount): debounced, one change at a time. */
function lockSoon(): void {
  window.clearTimeout(lockTimer);
  lockTimer = window.setTimeout(() => void (lockBusy = lockBusy.then(syncLock, syncLock)), 1200);
}
export async function syncLock(): Promise<void> {
  const data = load();
  const r = data.set.remind;
  const times = r.on && r.lock ? nudgeTimes(data, now(), goalOf('water', data).v) : [];
  const sig = times.map((t) => Math.round(t / 60_000)).join(',');
  if (sig === lockSig && (times.length > 0) === (r.jobs.length > 0)) return;
  if (!times.length && !r.jobs.length) {
    lockSig = sig;
    return;
  }
  lockSig = sig;
  const { replaceLock } = await import('./lockpush');
  const old = r.jobs.slice();
  r.jobs = [];
  r.jobs = await replaceLock('water', old, times.map((at) => ({ at, title: 'Water', text: 'Time for a glass of water.', repeat: 'none' as const })));
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* the screen says a storage failure on the next save */
  }
  nudgeState.lock = times.slice();
  for (const f of listeners) f();
}

// ---------------------------------------------------------------- for the week's room (./week.ts)

export const todayKey = (): string => today();
export const failedNow = (): string => failed;
export const saveNow = (): boolean => save();
/** Redraws on any change; returns what stops it. */
export function onChange(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}
/** The wind-down nudge: a daily reminder half an hour before his usual bedtime (only the time goes to my brain), sent again when it moves 10 minutes. */
export async function syncWind(): Promise<void> {
  const data = load();
  const w = data.set.wind;
  const { usualBed } = await import('./week');
  const usual = w.on ? usualBed(data, today()) : null;
  if (usual != null && w.jobs.length && w.at != null && Math.abs(usual - w.at) < 10) return;
  if (usual == null && !w.jobs.length) return;
  const { replaceLock, nextAt } = await import('./lockpush');
  const { clockOf } = await import('./week');
  const old = w.jobs.slice();
  w.jobs = [];
  w.jobs = await replaceLock('wind', old, usual == null ? [] : [{ at: nextAt(clockOf(usual - 30), now()), title: 'Wind down', text: 'Half an hour to your usual bedtime: time to wind down.', repeat: 'daily' }]);
  w.at = usual;
  save();
}

// ---------------------------------------------------------------- the chat

/** His words, for the trackers: kept or answered here, no model. null: not the trackers'. */
export function trackTurn(text: string): { reply: string; open?: Metric } | null {
  const ask: TrackAsk | null = trackAsked(text, load().set.cups);
  if (!ask) return null;
  if (ask.kind === 'log') return { reply: add(ask.m, ask.v, 'words'), open: ask.m };
  if (ask.kind === 'ask') return { reply: answer(ask.m, ask.span), open: ask.m };
  if (ask.kind === 'open') return { reply: `${TITLE[ask.m]} is open. ${line(ask.m)}`, open: ask.m };
  if (ask.kind === 'undo') return { reply: undo(ask.m), open: ask.m };
  if (ask.kind === 'bed') return { reply: toBed(), open: 'sleep' };
  if (ask.kind === 'up') return { reply: up(), open: 'sleep' };
  const data = load();
  data.set.remind.on = ask.on;
  save();
  startNudges();
  const r = data.set.remind;
  return { reply: ask.on ? `Water nudges on: between ${String(r.from).padStart(2, '0')}:00 and ${String(r.to).padStart(2, '0')}:00, only when you’re behind, never in your quiet hours (${String(r.quietFrom).padStart(2, '0')}:00 to ${String(r.quietTo).padStart(2, '0')}:00), and none once you’re on track.` : 'No more water nudges.', open: 'water' };
}
export const trackWords = (text: string): boolean => trackAsked(text, load().set.cups) !== null;

/** The Health export's days, kept as steps and sleep (only days the phone has nothing of his own for). */
export function fromHealth(days: { d: string; steps: number | null; sleep: number | null }[]): number {
  const data = load();
  let n = 0;
  for (const x of days) {
    for (const m of ['steps', 'sleep'] as const) {
      const v = x[m];
      if (v == null || !(v > 0)) continue;
      if (data.log[m].some((e) => e.d === x.d && e.from !== 'health')) continue;
      data.log[m] = data.log[m].filter((e) => !(e.d === x.d && e.from === 'health'));
      data.log[m].push({ d: x.d, t: new Date(`${x.d}T12:00:00`).getTime(), v: m === 'sleep' ? Math.round(v * 100) / 100 : Math.round(v), from: 'health' });
      n++;
    }
  }
  if (n) save();
  return n;
}

/**
 * Today's steps from the Health Shortcut ("#body?steps=8421"): kept as the day's number from Health, replacing an earlier one
 * the Shortcut sent today, beside anything he tapped himself (the higher of the two counts is never doubled: his taps stand).
 */
export function fromShortcut(n: number): string {
  if (!(n >= 0 && n <= 200_000)) return 'That step count doesn’t look right, so I left it.';
  const data = load();
  const d = today();
  data.log.steps = data.log.steps.filter((e) => !(e.d === d && e.from === 'health'));
  const mine = data.log.steps.filter((e) => e.d === d).reduce((a, e) => a + e.v, 0);
  if (n > mine) data.log.steps.push({ d, t: now(), v: n - mine, from: 'health', note: 'Health Shortcut' });
  const ok = save();
  const words = ok ? `Steps from Health: ${n.toLocaleString('en-GB')} today. ${line('steps')}` : failed;
  toast(words, ok ? 'ok' : 'warn', { title: 'STEPS' });
  return words;
}

/** The Home card's line: today's water and the last sleep, from the phone ('' when nothing is kept). */
export function homeLine(): string {
  const data = load();
  const d = today();
  const w = dayValue(data, 'water', d);
  const s = dayValue(data, 'sleep', d);
  const parts = [w != null ? `water ${ml(w)} of ${ml(goalOf('water', data).v)}` : '', s != null ? `slept ${hours(s)}` : ''].filter(Boolean);
  return parts.length ? `${parts.join(', ').replace(/^./, (c) => c.toUpperCase())}` : '';
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.track = { data: () => load(), reset: () => { cache = null; }, nudge: nudgeState, goal: (m: Metric) => goalOf(m), line, asked: (t: string) => trackAsked(t, load().set.cups) };
}
