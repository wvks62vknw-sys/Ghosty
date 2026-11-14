/**
 * TABLETS AND SUPPLEMENTS (NEXT ROUND, BODY AND KITCHEN lane, body.s1), kept on this phone only (`ghosty.body.meds`):
 *  - each tablet with its dose, its times of day, how many in the packet and how many a dose takes;
 *  - today's doses in time order, each ticked TAKEN or SKIPPED, with the week's ticks as a plain count;
 *  - a refill countdown: the days the packet lasts at his own times, and the day it runs out, with REFILLED;
 *  - lock-screen reminders: an iPhone suspends a hidden web app, so each time of day is a daily reminder on my brain's clock,
 *    which arrives as a Web Push. The brain gets the time and a plain line ("Time for your tablets."), never the tablet's name
 *    unless he turns that on, and never what he took or skipped.
 * Every count here is his own record, never medical advice: what to take and when is his doctor's or pharmacist's word.
 * The state is on window.__ghosty.meds for the specs.
 */
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { emptyState, lacksSignal, phrases, stateIn, stateLine } from '../lifeui';
import { dayOf, shift } from './trackcore';
import { nextAt, replaceLock } from './lockpush';

export interface Med {
  id: string;
  name: string;
  /** "1 tablet", "500 mg": his words. */
  dose: string;
  /** Times of day, "08:00". */
  times: string[];
  /** How many are left in the packet (null: not counted). */
  stock: number | null;
  /** How many one dose takes. */
  per: number;
  /** The brain's daily reminders, one a time. */
  jobs: string[];
  /** The day it was added (the week's count starts there). */
  since: string;
}
export interface Tick {
  med: string;
  d: string;
  time: string;
  took: boolean;
  t: number;
}
interface MedData {
  v: 1;
  meds: Med[];
  log: Tick[];
  /** Lock-screen reminders on; the tablet's name in them (off: "Time for your tablets."). */
  lock: boolean;
  named: boolean;
}

const KEY = 'ghosty.body.meds';
let cache: MedData | null = null;
let failed = '';
const listeners = new Set<() => void>();
const TIME = /^([01]?\d|2[0-3])[:.]?([0-5]\d)?\s*(am|pm)?$/i;
const rid = () => Math.random().toString(36).slice(2, 10);
const now = (): number => Date.now() + ((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset ?? 0);
const today = () => dayOf(now());

export function loadMeds(): MedData {
  if (cache) return cache;
  let raw: Partial<MedData> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  const str = (x: unknown, n: number) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
  cache = {
    v: 1,
    meds: (Array.isArray(raw.meds) ? raw.meds : []).filter((m) => m && str(m.name, 40)).map((m) => ({
      id: str(m.id, 20) || rid(), name: str(m.name, 40), dose: str(m.dose, 40),
      times: (Array.isArray(m.times) ? m.times : []).map((x) => timeOf(String(x))).filter((x): x is string => !!x).slice(0, 6),
      stock: typeof m.stock === 'number' && m.stock >= 0 && m.stock <= 2000 ? Math.round(m.stock) : null,
      per: typeof m.per === 'number' && m.per > 0 && m.per <= 20 ? m.per : 1,
      jobs: (Array.isArray(m.jobs) ? m.jobs : []).filter((x): x is string => typeof x === 'string').slice(0, 6),
      since: /^\d{4}-\d{2}-\d{2}$/.test(String(m.since)) ? String(m.since) : '',
    })).slice(0, 20),
    log: (Array.isArray(raw.log) ? raw.log : []).filter((x) => x && typeof x.med === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(x.d))).slice(-2000),
    lock: raw.lock !== false,
    named: raw.named === true,
  };
  return cache;
}
function save(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadMeds()));
    failed = '';
  } catch {
    failed = 'I couldn’t keep that on this phone: its storage is full or switched off.';
  }
  for (const f of listeners) f();
  return !failed;
}

/** "8", "8am", "20:00", "8.30pm" → "08:00" / "20:30" (null: not a time). */
export function timeOf(s: string): string | null {
  const m = TIME.exec(s.trim());
  if (!m) return null;
  let hr = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3]) {
    if (hr > 12 || hr === 0) return null;
    hr = (hr % 12) + (/pm/i.test(m[3]) ? 12 : 0);
  }
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
/** The times he typed: "8am, 8pm" or "08:00 20:00". */
export const timesIn = (s: string): string[] => [...new Set(s.replace(/(\d)\s+(am|pm)\b/gi, '$1$2').split(/[,;\s]+|\band\b/).map((x) => timeOf(x)).filter((x): x is string => !!x))].sort().slice(0, 6);

/** How long the packet lasts at his own times, and the day it runs out (null: not counted, or no times). */
export function refillOf(m: Med, day = today()): { days: number; by: string } | null {
  if (m.stock == null || !m.times.length) return null;
  const days = Math.floor(m.stock / (m.per * m.times.length));
  return { days, by: shift(day, days) };
}

/** Today's doses, in time order, each with its tick (none yet: null). */
export function dosesToday(data = loadMeds(), day = today()): { med: Med; time: string; tick: Tick | null }[] {
  const out: { med: Med; time: string; tick: Tick | null }[] = [];
  for (const med of data.meds) for (const time of med.times) out.push({ med, time, tick: data.log.find((x) => x.med === med.id && x.d === day && x.time === time) ?? null });
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name));
}

/** Ticks one dose taken or skipped (taking one takes it from the packet's count; a change of mind puts it back). */
export function tick(medId: string, time: string, took: boolean): string {
  const data = loadMeds();
  const med = data.meds.find((m) => m.id === medId);
  if (!med) return 'That tablet isn’t in your list any more.';
  const d = today();
  const was = data.log.find((x) => x.med === medId && x.d === d && x.time === time);
  if (was?.took && med.stock != null) med.stock += med.per;
  data.log = data.log.filter((x) => x !== was);
  data.log.push({ med: medId, d, time, took, t: now() });
  if (took && med.stock != null) med.stock = Math.max(0, med.stock - med.per);
  if (!save()) return failed;
  const r = refillOf(med);
  return `${med.name} at ${time}: ${took ? 'taken' : 'skipped'}.${r && r.days <= 7 ? ` About ${r.days} day${r.days === 1 ? '' : 's'} left in the packet.` : ''}`;
}

/** The week's ticks: taken of the doses due, over the last 7 days (today only up to now). */
export function weekOf(data = loadMeds()): { taken: number; skipped: number; due: number } {
  const d = today();
  const nowHm = new Date(now()).toTimeString().slice(0, 5);
  let due = 0;
  let taken = 0;
  let skipped = 0;
  for (let k = 0; k < 7; k++) {
    const day = shift(d, -k);
    for (const m of data.meds) for (const t of m.times) {
      if ((k === 0 && t > nowHm) || (m.since && day < m.since)) continue;
      due++;
      const x = data.log.find((y) => y.med === m.id && y.d === day && y.time === t);
      if (x?.took) taken++;
      else if (x) skipped++;
    }
  }
  return { taken, skipped, due };
}

/** The brain's daily reminders for every tablet: the old ones taken back, one a time of day set (only the times and a plain line). */
let medBusy: Promise<void> = Promise.resolve();
/** Every change to the brain's tablet reminders, one at a time (a double tap or Remove mid-sync never leaves one untracked). */
function medChain(run: () => Promise<void>): Promise<void> {
  return (medBusy = medBusy.then(run, run));
}
export function syncMedLock(): Promise<void> {
  return medChain(runMedSync);
}
async function runMedSync(): Promise<void> {
  const data = loadMeds();
  const t = now();
  for (const m of data.meds) {
    const old = m.jobs.slice();
    m.jobs = [];
    m.jobs = await replaceLock(`meds:${m.id}`, old, data.lock ? m.times.map((hm) => ({ at: nextAt(hm, t), title: 'Tablets', text: data.named ? `Time for your ${m.name}${m.dose ? `, ${m.dose}` : ''}.` : 'Time for your tablets. Open Ghosty to tick them.', repeat: 'daily' as const })) : []);
  }
  save();
}

export function addMed(name: string, dose: string, times: string[], stock: number | null, per = 1): string {
  const n = name.trim().slice(0, 40);
  if (!n) return 'Give it a name, like “Vitamin D”.';
  if (!times.length) return 'Give it at least one time of day, like 8am or 20:00.';
  const data = loadMeds();
  if (data.meds.length >= 20) return 'That’s twenty already: take one off first.';
  data.meds.push({ id: rid(), name: n, dose: dose.trim().slice(0, 40), times, stock: stock != null && stock >= 0 ? Math.round(stock) : null, per: per > 0 ? per : 1, jobs: [], since: today() });
  if (!save()) return failed;
  void syncMedLock();
  return `${n} kept, at ${times.join(' and ')}.${data.lock ? ' I remind you on your lock screen at those times.' : ''}`;
}

// ---------------------------------------------------------------- the screen

export function medsScreen(): { el: HTMLElement; stop(): void } {
  expose();
  const el = h('div.pkcol.bt', { dataset: { track: 'meds' } });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const say = (w: string) => (status.textContent = w);
  const draw = () => {
    const data = loadMeds();
    const kids: HTMLElement[] = [];
    const doses = dosesToday(data);
    if (!data.meds.length) {
      /* state: body.meds empty */
      kids.push(emptyState('No tablets kept yet', 'Add a tablet or supplement with its times, and I remind you, tick each dose and count down to a refill.'));
    }
    if (failed) {
      /* state: body.meds error */
      kids.push(stateLine('error', failed));
    }
    if (doses.length) {
      const left = doses.filter((x) => !x.tick).length;
      kids.push(h('p.bt-line', { dataset: { line: 'meds' } }, left ? `${left} dose${left === 1 ? '' : 's'} still to tick today.` : 'Every dose ticked today.'));
      kids.push(h('section', { 'aria-label': 'Today' }, h('h3.bt-h', 'Today'), h('ul.pkitems', ...doses.map((x) => {
        const took = button('Taken', () => say(tick(x.med.id, x.time, true)), x.tick?.took ? 'on' : '');
        took.setAttribute('aria-pressed', String(!!x.tick?.took));
        took.setAttribute('aria-label', `${x.med.name} at ${x.time}: taken`);
        const skip = button('Skipped', () => say(tick(x.med.id, x.time, false)));
        skip.setAttribute('aria-pressed', String(x.tick ? !x.tick.took : false));
        skip.setAttribute('aria-label', `${x.med.name} at ${x.time}: skipped`);
        return h('li.pkitem.bm-dose', { dataset: { dose: `${x.med.name}@${x.time}`, tick: x.tick ? (x.tick.took ? 'taken' : 'skipped') : '' } }, h('span.bt-entry', h('b', `${x.time} · ${x.med.name}`), x.med.dose ? h('small', ` · ${x.med.dose}`) : null), h('span.pkrow', took, skip));
      }))));
      const w = weekOf(data);
      kids.push(h('p.pknote', { dataset: { week: `${w.taken}/${w.due}` } }, w.due ? `The last 7 days: ${w.taken} of ${w.due} doses ticked taken${w.skipped ? `, ${w.skipped} skipped` : ''}.` : 'The week’s count starts with your first dose.'));
    }
    // each tablet: its refill countdown, REFILLED and REMOVE
    for (const m of data.meds) {
      const r = refillOf(m);
      const refill = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '1000', placeholder: 'How many', 'aria-label': `How many ${m.name} you got` }) as HTMLInputElement;
      const got = button('Refilled', () => {
        const n = Math.round(Number(refill.value));
        if (!(n >= 1 && n <= 1000)) return say('Type how many came in the new packet.');
        m.stock = (m.stock ?? 0) + n;
        save();
        const r2 = refillOf(m);
        say(`${m.name}: ${m.stock} now${r2 ? `, about ${r2.days} days` : ''}.`);
      });
      got.setAttribute('aria-label', `${m.name}: refilled`);
      const del = button('Remove', () => {
        const data2 = loadMeds();
        const gone = m.jobs.slice();
        void medChain(async () => void (await replaceLock(`meds:${m.id}`, gone, [])));
        data2.meds = data2.meds.filter((x) => x.id !== m.id);
        save();
        say(`${m.name} taken off your list, and its reminders with it.`);
      });
      del.setAttribute('aria-label', `Remove ${m.name}`);
      kids.push(h('details.pkmore.bm-med', { dataset: { med: m.name, days: r ? String(r.days) : '' } },
        h('summary', `${m.name}${r ? ` · ${r.days <= 7 ? 'refill soon, ' : ''}about ${r.days} day${r.days === 1 ? '' : 's'} left` : ''}`),
        h('p.pknote', `${m.dose ? `${m.dose}, ` : ''}at ${m.times.join(' and ')}.${m.stock != null ? ` ${m.stock} in the packet, ${m.per} a dose.` : ' Not counted: add how many you have to see when to refill.'}${r ? ` At your times it lasts until about ${new Date(`${r.by}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}.` : ''}`),
        h('div.pkadd', refill, got), h('div.pkrow', del)));
    }
    kids.push(addForm(), lockBox(data));
    if (lacksSignal()) {
      /* state: body.meds offline */
      kids.push(stateLine('offline', 'No signal: ticking works on the phone. A change to the lock-screen reminders goes to my brain when you’re back online.'));
    }
    kids.push(status, phrases(['I took my tablets', 'did I take my tablets?', 'open my tablets']), h('p.pknote', 'Kept on this phone only. Your own record, never medical advice: what to take and when is your doctor’s or pharmacist’s word.'));
    const open = new Set([...el.querySelectorAll('details[open]')].map((x) => (x as HTMLElement).dataset.med ?? x.className));
    el.replaceChildren(...kids);
    el.querySelectorAll('details').forEach((x) => open.has((x as HTMLElement).dataset.med ?? x.className) && ((x as HTMLDetailsElement).open = true));
  };
  const addForm = () => {
    const nm = h('input', { type: 'text', placeholder: 'Vitamin D', maxlength: '40', 'aria-label': 'The tablet’s name' }) as HTMLInputElement;
    const ds = h('input', { type: 'text', placeholder: '1 tablet', maxlength: '40', 'aria-label': 'The dose' }) as HTMLInputElement;
    const tm = h('input', { type: 'text', placeholder: '8am, 8pm', 'aria-label': 'Its times of day' }) as HTMLInputElement;
    const st = h('input', { type: 'number', inputmode: 'numeric', min: '0', max: '2000', placeholder: 'How many you have', 'aria-label': 'How many you have' }) as HTMLInputElement;
    const keep = button('Keep it', () => {
      const words = addMed(nm.value, ds.value, timesIn(tm.value), st.value === '' ? null : Number(st.value));
      if (/ kept, at /.test(words)) nm.value = ds.value = tm.value = st.value = '';
      say(words);
    }, 'on');
    keep.setAttribute('aria-label', 'Keep this tablet');
    return h('details.pkmore.bm-add', h('summary', 'Add a tablet or supplement'), h('div.pkfield', h('label', 'Name'), nm), h('div.pkfield', h('label', 'Dose'), ds), h('div.pkfield', h('label', 'Times of day'), tm), h('div.pkfield', h('label', 'How many you have'), st), h('div.pkrow', keep));
  };
  const lockBox = (data: MedData) => {
    const on = button(data.lock ? 'Lock screen: on' : 'Lock screen: off', () => {
      data.lock = !data.lock;
      save();
      void syncMedLock();
      say(data.lock ? 'I remind you at each time on your lock screen, through my brain’s push.' : 'No lock-screen reminders: tick them here when you take them.');
    });
    on.setAttribute('aria-pressed', String(data.lock));
    on.setAttribute('aria-label', 'Reminders on the lock screen');
    const named = button(data.named ? 'Name in the reminder: on' : 'Name in the reminder: off', () => {
      data.named = !data.named;
      save();
      void syncMedLock();
      say(data.named ? 'The reminder names the tablet. My brain then keeps its name.' : 'The reminder just says “Time for your tablets”. My brain never learns the name.');
    });
    named.setAttribute('aria-pressed', String(data.named));
    named.setAttribute('aria-label', 'The tablet’s name in the reminder');
    return h('details.pkmore.bm-lock', h('summary', `Reminders: ${data.lock ? 'on the lock screen' : 'off'}`), h('div.pkrow', on, named),
      h('p.pknote', 'An iPhone pauses Ghosty when it’s hidden, so each reminder is kept on my brain’s clock and comes as a notification (Settings, Notifications). My brain gets only the time and a plain line, never what you took.'));
  };
  listeners.add(draw);
  draw();
  return { el, stop: () => void listeners.delete(draw) };
}

// ---------------------------------------------------------------- the chat

/** "I took my tablets", "took my vitamin d", "skipped my evening tablet", "did I take my tablets?", "open my tablets". */
export function medsTurn(text: string): { reply: string } | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/’/g, "'");
  const data = loadMeds();
  if (/^(?:open|show(?: me)?)\s+(?:my\s+)?(?:tablets|pills|medication|meds|medicines?|supplements)$/.test(t)) {
    const left = dosesToday(data).filter((x) => !x.tick).length;
    return { reply: data.meds.length ? `Your tablets are open: ${left ? `${left} dose${left === 1 ? '' : 's'} still to tick today` : 'every dose ticked today'}.` : 'Your tablets are open. Add one with its times and I remind you.' };
  }
  if (/^(?:did i|have i)\s+(?:take|taken|had)\s+(?:my\s+)?(?:tablets?|pills?|medication|meds|medicines?|supplements?)(?:\s+today)?$/.test(t)) {
    const doses = dosesToday(data);
    if (!doses.length) return { reply: 'No tablets kept yet. Add one on BODY, then Health.' };
    return { reply: doses.map((x) => `${x.time} ${x.med.name}: ${x.tick ? (x.tick.took ? 'taken' : 'skipped') : 'not ticked'}`).join('; ') + '.' };
  }
  const m = /^(?:i\s+)?(took|have taken|had|skipped|missed)\s+(?:my\s+)?(morning|evening|night|lunchtime)?\s*(.*?)\s*$/.exec(t);
  if (!m || !/tablet|pill|medication|meds|medicine|supplement|vitamin/.test(m[3]!) && !data.meds.some((x) => m[3]!.includes(x.name.toLowerCase()))) return null;
  const took = !/skipped|missed/.test(m[1]!);
  const doses = dosesToday(data).filter((x) => /^(?:tablets?|pills?|medication|meds|medicines?|supplements?)$/.test(m[3]!) || m[3]!.includes(x.med.name.toLowerCase()));
  const part = m[2];
  const inPart = (hm: string) => !part || (part === 'morning' ? hm < '12:00' : part === 'lunchtime' ? hm >= '11:00' && hm < '15:00' : hm >= '17:00');
  // the doses not yet ticked, the nearest to now first (none due yet: the next one)
  const nowHm = new Date(now()).toTimeString().slice(0, 5);
  const open = doses.filter((x) => !x.tick && inPart(x.time));
  if (!open.length) return { reply: doses.length ? 'Every one of those is ticked today already.' : 'I don’t have that tablet. Add it on BODY, then Health, with its times.' };
  const due = open.filter((x) => x.time <= nowHm);
  const pick = due.length ? due : [open[0]!];
  // "my tablets" ticks every dose due now; a named one ticks its own
  const words = pick.map((x) => tick(x.med.id, x.time, took));
  return { reply: words.join(' ') };
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.meds = { data: () => loadMeds(), reset: () => void (cache = null), sync: () => syncMedLock(), timesIn };
}
