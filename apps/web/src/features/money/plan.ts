/**
 * MONEY AND PAPERS HANDLED FOR YOU (THE NEXT ROUND, the money lane): the MONEY screen's new pages, drawn from his own records and
 * plain sums (packages/shared/src/moneyplan.ts, run by the brain's tools/moneyapp.ts through POST /packs/do; no model, no bank):
 *
 *   SAFE TO SPEND   at the top of YOUR MONTH: what is left until payday after the bills still due, a day at a time
 *   CALENDAR        the month as a grid, every bill, subscription and payday on its day, the heavy days marked
 *   GOALS           savings goals with a bar, a date and what that is a month
 *   SHARED BILLS    the household's shared bills: who owes whom, settled on a tap (nothing is paid or sent)
 *   YOUR YEAR       a year looked back on: totals, the dearest months, where it went, subscriptions started and stopped; printable
 *   SORTING RULES   his rules ("every TESCO is groceries") with the count each files; change one or take it away
 *
 * The state sits on window.__ghosty.moneyplan for the specs.
 */
import { CATEGORIES, gbp, monthName, type Category } from '../../../../../packages/shared/src/spending';
import type { CalDay, DueItem, Goal, Safe, SharedBill } from '../../../../../packages/shared/src/moneyplan';
import { brain } from '../../api/brain';
import { h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { isoDay } from '../brief/day';
import { emptyState, lacksSignal, phrases, stateIn, stateLine, waitFor } from '../lifeui';

export type PlanPage = 'calendar' | 'goals' | 'shared' | 'year';
export const PLAN_TITLES: Record<PlanPage, string> = { calendar: 'MONEY CALENDAR', goals: 'SAVINGS GOALS', shared: 'SHARED BILLS', year: 'YOUR YEAR IN MONEY' };

/** What a spec reads: window.__ghosty.moneyplan. */
export const moneyPlan = {
  safe: null as number | null,
  safeDue: [] as string[],
  calendar: [] as string[],
  heavy: [] as string[],
  goals: [] as string[],
  owes: [] as string[],
  year: '',
  rules: [] as string[],
  state: {} as Record<string, string>,
};
const expose = () => {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.moneyplan = moneyPlan;
};

const p2 = (n: number) => gbp(n, true);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dow = (d: string) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay();
/** "Friday 28 November". */
const dayWords = (d: string) => `${DAYS[dow(d)]} ${+d.slice(8, 10)} ${monthName(d.slice(0, 7))}`;
const today = () => isoDay(new Date());
const label = (b: HTMLButtonElement, l: string) => (b.setAttribute('aria-label', l), b);
/** A figure (the safe block's carry their own class, so YOUR MONTH's three stay its own three). */
const figure = (name: string, value: string, how: string, tone = '', cls: 'div.mnfig' | 'div.mnsfig' = 'div.mnfig') => h(cls, { dataset: { tone } }, h('span.mnname', name), h('b.mnval', value), h('small.mnhow', how));
function meter(name: string, value: string, frac: number, tone = '', how = ''): HTMLElement {
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  return h('div.mnmeter', { dataset: { tone } }, h('div.mnline', h('b', name), h('span', value)), h('div.mnbar', { role: 'img', 'aria-label': `${name}: ${value}` }, h('i', { style: { width: `${Math.round(f * 100)}%` } })), how ? h('small.mnhow', how) : null);
}
const KIND_WORDS: Record<string, string> = { sub: 'from your statements', bill: 'a bill you showed HOME', listed: 'a subscription you told me', payday: 'payday' };

/** One money action on the brain; throws in his words. */
async function act<T>(action: string, args: Record<string, unknown> = {}): Promise<{ text: string; data: T }> {
  const r = await brain.packDo('money', action, { today: today(), ...args });
  return { text: r.text, data: r.data as T };
}

/** A page's read with its states said where it stands: null when it could not be read (the slot then says why, with Try again). */
async function read<T>(el: HTMLElement, slot: HTMLElement, page: string, action: string, args: Record<string, unknown>, again: () => void, waiting: string): Promise<{ text: string; data: T } | null> {
  if (lacksSignal()) {
    moneyPlan.state[page] = 'offline';
    /* state: money.calendar offline */
    /* state: money.goals offline */
    /* state: money.shared offline */
    /* state: money.year offline */
    slot.replaceChildren(stateLine('offline', 'No signal. This comes back when the phone is online again.'));
    return null;
  }
  /* state: money.calendar loading */
  /* state: money.goals loading */
  /* state: money.shared loading */
  /* state: money.year loading */
  const done = waitFor(el, waiting);
  try {
    return await act<T>(action, args);
  } catch (e) {
    moneyPlan.state[page] = 'error';
    /* state: money.calendar error */
    /* state: money.goals error */
    /* state: money.shared error */
    /* state: money.year error */
    slot.replaceChildren(stateLine('error', sayError(e, 'read that')), h('div.pkrow', label(button('Try again', again), 'Try reading it again')));
    return null;
  } finally {
    done();
  }
}

// ---------------------------------------------------------------- SAFE TO SPEND (on YOUR MONTH)

/** SAFE TO SPEND UNTIL PAYDAY: the block at the top of YOUR MONTH. It draws itself; a failure is one quiet line, never the month's. */
export function safeBlock(): HTMLElement {
  expose();
  const box = h('div.pkcol.mnsafe', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const payInput = h('input.mnamount', { type: 'text', placeholder: 'the 28th, or last Friday', 'aria-label': 'When is payday', enterKeyHint: 'done' }) as HTMLInputElement;
  const keepPay = async () => {
    const w = payInput.value.trim();
    if (!w) return void stateIn(status, '', 'Type your payday first, like “the 28th”.');
    if (lacksSignal()) return void stateIn(status, 'offline', 'No signal. Keep it again when the phone is back online.');
    try {
      const r = await brain.packDo('money', 'payday', { words: w });
      stateIn(status, /^Payday kept/.test(r.text) ? '' : 'error', r.text);
      if (/^Payday kept/.test(r.text)) {
        payInput.value = '';
        await load();
      }
    } catch (e) {
      stateIn(status, 'error', sayError(e, 'keep your payday'));
    }
  };
  payInput.addEventListener('keydown', (e) => e.key === 'Enter' && void keepPay());
  const payForm = (lead: string) =>
    h('div.pkcol.mnform', h('p.pknote', { dataset: { case: 'keep' } }, lead), h('div.pkrow', payInput, label(button('Keep payday', () => void keepPay(), 'on'), 'Keep this payday')));
  let all = false;
  const load = async () => {
    if (lacksSignal()) {
      moneyPlan.state.safe = 'offline';
      box.replaceChildren(h('div.lab', 'SAFE TO SPEND'), stateLine('offline', 'No signal: safe to spend comes back when the phone is online.'));
      return;
    }
    try {
      const { data } = await act<(Safe & { rowsSince: number; rows: number }) | { payday: null; rows: number }>('safe');
      if (!data || data.payday === null) {
        moneyPlan.safe = null;
        moneyPlan.state.safe = 'nopayday';
        box.replaceChildren(h('div.lab', 'SAFE TO SPEND UNTIL PAYDAY'), payForm('Tell me when you are paid and I show what is safe to spend until then, after the bills still due.'));
        return;
      }
      const s = data as Safe & { rowsSince: number; rows: number };
      moneyPlan.safe = s.safe;
      moneyPlan.safeDue = s.due.map((d) => `${d.on} ${d.name} ${p2(d.amount)}`);
      moneyPlan.state.safe = 'ready';
      const how =
        s.base === 'balance'
          ? `Your balance of ${p2(s.balance!)} on ${dayWords(s.balanceOn!)}, less ${p2(s.dueSum)} still due before payday${s.aside ? `, less ${p2(s.aside)} for your goals` : ''}.`
          : `${p2(s.in)} in less ${p2(s.out)} out since payday on ${dayWords(s.last)}, less ${p2(s.dueSum)} still due before payday${s.aside ? `, less ${p2(s.aside)} for your goals` : ''}.`;
      const nothing = s.base === 'since' && !s.rowsSince;
      const shown = all ? s.due : s.due.slice(0, 5);
      box.replaceChildren(
        h('div.lab', 'SAFE TO SPEND UNTIL PAYDAY'),
        ...(nothing
          ? [h('p.pknote.mnwarn', { dataset: { case: 'keep' } }, `Your statements hold nothing since your last payday on ${dayWords(s.last)}. Add a newer statement and this number is real.`)]
          : [
              h('div.mnfigs',
                figure('Safe to spend', s.safe < 0 ? `−${p2(-s.safe)}` : p2(s.safe), how, s.safe < 0 ? 'over' : 'ok', 'div.mnsfig'),
                figure('A day', s.perDay < 0 ? `−${p2(-s.perDay)}` : p2(s.perDay), `Shared over the ${plural(s.days, 'day')} to payday on ${dayWords(s.payday)}.`, '', 'div.mnsfig')),
              ...(s.stale >= 3 ? [h('p.pknote.mnwarn', { dataset: { case: 'keep' } }, `Your newest statement line is from ${dayWords(s.newest)}: anything you paid since is not in this number. Add a newer statement to bring it up to date.`)] : []),
            ]),
        ...(s.due.length
          ? [
              h('div.lab', `STILL DUE BEFORE PAYDAY · ${p2(s.dueSum)}`),
              ...shown.map((d) => dueRow(d)),
              ...(s.due.length > shown.length ? [h('div.pkrow', label(button(`Show all ${s.due.length}`, () => ((all = true), void load())), `Show all ${s.due.length} payments still due`))] : []),
            ]
          : [h('p.pknote', { dataset: { case: 'keep' } }, 'Nothing else is due before payday that I know of.')]),
        h('details.mnmore', h('summary', 'Change payday'), payForm('Paid on a new day? Type it and I work it out again.')),
        h('p.pknote.mnwhy', { dataset: { case: 'keep' } }, 'Plain sums from your own statements, the bills you showed HOME and the subscriptions you told me. Not a forecast.'),
      );
    } catch (e) {
      moneyPlan.state.safe = 'error';
      box.replaceChildren(h('div.lab', 'SAFE TO SPEND'), stateLine('error', sayError(e, 'work out safe to spend')), h('div.pkrow', label(button('Work it out again', () => void load()), 'Work out safe to spend again')));
    }
  };
  void load();
  return h('div.pkcol', box, status);
}

function dueRow(d: DueItem | { on: string; name: string; amount: number; kind: string }): HTMLElement {
  return h('div.mndue', { dataset: { kind: d.kind, on: d.on, case: 'keep' }, role: 'group', 'aria-label': `${d.name}${d.amount ? `, ${p2(d.amount)}` : ''}, ${dayWords(d.on)}` },
    h('div.mnline', h('b', d.name), h('span', d.amount ? p2(d.amount) : '')),
    h('small.mnhow', `${dayWords(d.on)} · ${KIND_WORDS[d.kind] ?? ''}`));
}

// ---------------------------------------------------------------- SORTING RULES (from YOUR MONTH)

/** His sorting rules, each with how many payments it files; change one's category or take it away. */
export function openRules(after: () => void): void {
  expose();
  const body = h('div.pkcol.mnapp', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const paint = (rules: { k: string; c: Category; n: number }[]) => {
    moneyPlan.rules = rules.map((r) => `${r.k} ${r.c} ${r.n}`);
    body.replaceChildren(
      ...(rules.length
        ? rules.map((r) => {
            const pick = h('select.mnselect', { 'aria-label': `Where every ${r.k} goes` }, ...CATEGORIES.map((c) => h('option', { value: c, selected: c === r.c }, cap(c)))) as HTMLSelectElement;
            pick.addEventListener('change', () => void run('change', r.k, pick.value));
            return h('div.mnmeter', { dataset: { rule: r.k } },
              h('div.mnline', h('b', `Every ${r.k}`), h('span', cap(r.c))),
              h('small.mnhow', `${plural(r.n, 'payment')} in your statements.`),
              h('div.pkrow', pick, label(button('Take it away', () => void run('remove', r.k)), `Take away the rule for ${r.k}`)));
          })
        /* state: money.rules empty */
        : [emptyState('No rules of your own yet', 'Tap a payment on YOUR MONTH and file it: every payment to that name follows, and the rule shows here.')]),
    );
  };
  const run = async (op: string, k?: string, c?: string) => {
    if (lacksSignal()) return void stateIn(status, 'offline', 'No signal. Try again when the phone is back online.');
    try {
      const r = await act<{ rules: { k: string; c: Category; n: number }[] }>('rules', op ? { op, k, c } : {});
      if (op) stateIn(status, '', r.text);
      paint(r.data.rules);
      if (op) after();
    } catch (e) {
      stateIn(status, 'error', sayError(e, 'change that rule'));
    }
  };
  modal('YOUR SORTING RULES', h('div.pk', { dataset: { pack: 'money', screen: 'rules' } }, h('div.pkcol', body, status)));
  void run('');
}

// ---------------------------------------------------------------- CALENDAR

function calendarPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const el = h('div.pkcol.mnapp', slot, phrases(['money calendar', 'when are my bills due']));
  let month = today().slice(0, 7);
  let pick = '';
  const shift = (m: string, n: number) => {
    const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  };
  const load = async () => {
    const got = await read<{ days: CalDay[]; total: number; heavy: string[]; payday: boolean; rows: number }>(el, slot, 'calendar', 'calendar', { month }, () => void load(), 'Laying out your month…');
    if (!got) return;
    const c = got.data;
    moneyPlan.calendar = c.days.filter((d) => d.items.length).map((d) => `${d.day} ${d.items.map((x) => x.name).join(', ')}`);
    moneyPlan.heavy = c.heavy;
    moneyPlan.state.calendar = 'ready';
    const now = today();
    const prev = label(button('‹', () => ((month = shift(month, -1)), (pick = ''), void load())), 'The month before');
    const next = label(button('›', () => ((month = shift(month, 1)), (pick = ''), void load())), 'The month after');
    const nav = h('div.mnnav', prev, h('b', `${monthName(month)} ${month.slice(0, 4)}`), next);
    const lead = (dow(`${month}-01`) + 6) % 7;
    const grid = h('div.mncal', { role: 'grid', 'aria-label': `${monthName(month)} ${month.slice(0, 4)}` },
      ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => h('span.mncalhd', { 'aria-hidden': 'true', dataset: { i: String(i) } }, x)),
      ...Array.from({ length: lead }, () => h('span.mncalgap', { 'aria-hidden': 'true' })),
      ...c.days.map((d) => {
        const n = +d.day.slice(8, 10);
        const pay = d.items.some((x) => x.kind === 'payday');
        const b = h('button.mncalday', {
          type: 'button',
          dataset: { day: d.day, heavy: c.heavy.includes(d.day) ? '1' : '', pay: pay ? '1' : '', has: d.items.length ? '1' : '', today: d.day === now ? '1' : '', on: d.day === pick ? '1' : '' },
          'aria-label': `${dayWords(d.day)}${d.items.length ? `: ${d.items.map((x) => (x.amount ? `${x.name} ${p2(x.amount)}` : x.name)).join(', ')}` : ': nothing due'}`,
        }, h('b', String(n)), d.items.length ? h('i', { 'aria-hidden': 'true' }) : null) as HTMLButtonElement;
        b.addEventListener('click', () => ((pick = d.day), void paintDay()));
        return b;
      }));
    const detail = h('div.pkcol.mncaldetail', { 'aria-live': 'polite' });
    const paintDay = () => {
      for (const x of grid.querySelectorAll<HTMLElement>('.mncalday')) x.dataset.on = x.dataset.day === pick ? '1' : '';
      const d = c.days.find((x) => x.day === pick);
      detail.replaceChildren(...(d ? [h('div.lab', dayWords(d.day).toUpperCase()), ...(d.items.length ? d.items.map((x) => dueRow(x)) : [h('p.pknote', { dataset: { case: 'keep' } }, 'Nothing due that day.')])] : []));
    };
    const busy = c.days.filter((d) => d.items.some((x) => x.amount > 0));
    slot.replaceChildren(
      nav,
      h('div.mnfigs',
        figure('Due this month', p2(c.total), `${plural(busy.length, 'day')} with something due, from your statements, HOME’s bills and the subscriptions you told me.`),
        figure('Heaviest day', c.heavy.length ? `${+c.heavy[0]!.slice(8, 10)} ${monthName(month)}` : 'None', c.heavy.length ? `${p2(c.days.find((d) => d.day === c.heavy[0])!.sum)} due that day.` : 'Nothing piles up on one day.', c.heavy.length ? 'over' : 'ok')),
      ...(c.payday ? [] : [h('p.pknote', { dataset: { case: 'keep' } }, 'Tell me your payday on YOUR MONTH and it shows here too.')]),
      grid,
      h('p.pknote.mnkey', { dataset: { case: 'keep' } }, 'A dot: something is due. Ringed: a heavy day. Filled: payday. Tap a day for what falls on it.'),
      detail,
      ...(busy.length
        ? [h('div.lab', 'IN DATE ORDER'), ...c.days.flatMap((d) => d.items.filter((x) => x.kind !== 'payday').map((x) => dueRow(x)))]
        /* state: money.calendar empty */
        : [emptyState('Nothing due this month that I know of', 'Bills you show HOME, subscriptions in your statements and ones you tell me land on their days here.')]),
    );
    if (pick) paintDay();
  };
  void load();
  return el;
}

// ---------------------------------------------------------------- GOALS

type GoalRow = Goal & { frac: number; left: number; months: number; monthly: number; late: boolean; done: boolean };

function goalsPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const name = h('input.mngoalin', { type: 'text', placeholder: 'Holiday', 'aria-label': 'What the goal is for', enterKeyHint: 'next' }) as HTMLInputElement;
  const target = h('input.mngoalin', { type: 'text', inputMode: 'decimal', placeholder: '£800', 'aria-label': 'How much', enterKeyHint: 'next' }) as HTMLInputElement;
  const by = h('input.mngoalin', { type: 'date', 'aria-label': 'By when (you can leave it empty)' }) as HTMLInputElement;
  const money = (s: string) => Number(s.replace(/[£,\s]/g, ''));
  const run = async (args: Record<string, unknown>) => {
    if (lacksSignal()) return void stateIn(status, 'offline', 'No signal. Try again when the phone is back online.');
    try {
      const r = await act<{ goals: GoalRow[] }>('goals', args);
      stateIn(status, '', r.text);
      paint(r.data.goals);
      return true;
    } catch (e) {
      stateIn(status, 'error', sayError(e, 'keep that goal'));
      return false;
    }
  };
  const add = async () => {
    const t = money(target.value);
    if (!name.value.trim()) return void stateIn(status, '', 'Say what the goal is for first, like “holiday”.');
    if (!Number.isFinite(t) || t <= 0) return void stateIn(status, '', 'Type how much, like 800.');
    if (await run({ op: 'add', name: name.value.trim(), target: t, by: by.value })) {
      name.value = '';
      target.value = '';
      by.value = '';
    }
  };
  const form = h('div.pkcol.mnform', h('div.lab', 'A NEW GOAL'), h('div.pkrow', name, target), h('div.pkrow', by, label(button('Keep goal', () => void add(), 'on'), 'Keep this goal')));
  const el = h('div.pkcol.mnapp', slot, form, status, phrases(['my savings goals', 'saving for a holiday']));
  const paint = (goals: GoalRow[]) => {
    moneyPlan.goals = goals.map((g) => `${g.name} ${p2(g.saved)} of ${p2(g.target)}${g.monthly ? ` ${p2(g.monthly)} a month` : ''}`);
    moneyPlan.state.goals = 'ready';
    const total = goals.reduce((k, g) => k + g.monthly, 0);
    slot.replaceChildren(
      ...(goals.length
        ? [
            figure('Put aside a month', p2(total), `What your ${plural(goals.length, 'goal')} need a month to land on their dates. Safe to spend on YOUR MONTH keeps this aside.`),
            ...goals.map((g) => {
              const how = g.done ? 'Reached. Well done.' : g.by ? (g.late ? `Its date, ${dayWords(g.by)}, has gone: ${p2(g.left)} still to go.` : `${p2(g.left)} to go by ${dayWords(g.by)}: about ${p2(g.monthly)} a month for ${plural(g.months, 'month')}.`) : `${p2(g.left)} to go, no date set.`;
              const m = meter(g.name, `${p2(g.saved)} of ${p2(g.target)}`, g.frac, g.done ? 'ok' : g.late ? 'over' : 'ok', how);
              m.dataset.goal = g.id;
              const amt = h('input.mngoalin', { type: 'text', inputMode: 'decimal', placeholder: '£50', 'aria-label': `An amount for ${g.name}` }) as HTMLInputElement;
              const go = (op: 'put' | 'take') => {
                const n = money(amt.value);
                if (!Number.isFinite(n) || n <= 0) return void stateIn(status, '', 'Type an amount first, like 50.');
                void run({ op, id: g.id, amount: n });
              };
              m.append(h('div.pkrow', amt, label(button('Put in', () => go('put'), 'on'), `Put this into ${g.name}`), label(button('Take out', () => go('take')), `Take this out of ${g.name}`)),
                h('div.pkrow', label(button('Take it away', () => void run({ op: 'remove', id: g.id })), `Take away the ${g.name} goal`)));
              return m;
            }),
            h('p.pknote.mnwhy', { dataset: { case: 'keep' } }, 'What you put in is your word: nothing moves in your bank. A month here counts this month and each one to the date.'),
          ]
        /* state: money.goals empty */
        : [emptyState('No goals yet', 'Name one below, like “holiday, £800, by June”, and I show its bar and what that is a month.')]),
    );
  };
  const load = async () => {
    const got = await read<{ goals: GoalRow[] }>(el, slot, 'goals', 'goals', {}, () => void load(), 'Opening your goals…');
    form.hidden = !got;
    if (got) paint(got.data.goals);
  };
  void load();
  return el;
}

// ---------------------------------------------------------------- SHARED BILLS

function sharedPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const what = h('input.mnamount', { type: 'text', placeholder: 'Electric', 'aria-label': 'What the bill was', enterKeyHint: 'next' }) as HTMLInputElement;
  const amount = h('input.mnamount', { type: 'text', inputMode: 'decimal', placeholder: '£96', 'aria-label': 'How much', enterKeyHint: 'next' }) as HTMLInputElement;
  const paidBy = h('input.mnamount', { type: 'text', placeholder: 'you', 'aria-label': 'Who paid it', enterKeyHint: 'next' }) as HTMLInputElement;
  const shares = h('input.mnsearch', { type: 'text', placeholder: 'you, Sam and Jo', 'aria-label': 'Who shares it', enterKeyHint: 'done' }) as HTMLInputElement;
  const run = async (args: Record<string, unknown>) => {
    if (lacksSignal()) return void stateIn(status, 'offline', 'No signal. Try again when the phone is back online.');
    try {
      const r = await act<{ bills: SharedBill[]; pay: { from: string; to: string; amount: number }[]; balances: { name: string; net: number }[] }>('household', args);
      stateIn(status, '', r.text);
      paint(r.data);
      return true;
    } catch (e) {
      stateIn(status, 'error', sayError(e, 'keep that bill'));
      return false;
    }
  };
  const add = async () => {
    const n = Number(amount.value.replace(/[£,\s]/g, ''));
    if (!what.value.trim()) return void stateIn(status, '', 'Say what the bill was first, like “electric”.');
    if (!Number.isFinite(n) || n <= 0) return void stateIn(status, '', 'Type how much, like 96.');
    if (await run({ op: 'add', what: what.value.trim(), amount: n, paidBy: paidBy.value.trim() || 'you', shares: shares.value })) {
      what.value = '';
      amount.value = '';
    }
  };
  const form = h('div.pkcol.mnform', h('div.lab', 'ADD A SHARED BILL'), h('div.pkrow', what, amount), h('div.pkrow', paidBy), shares, h('div.pkrow', label(button('Add it', () => void add(), 'on'), 'Add this shared bill')));
  const el = h('div.pkcol.mnapp', slot, form, status, phrases(['who owes who', 'split the household bills']));
  const paint = (x: { bills: SharedBill[]; pay: { from: string; to: string; amount: number }[] }) => {
    moneyPlan.owes = x.pay.map((p) => `${p.from} owes ${p.to} ${p2(p.amount)}`);
    moneyPlan.state.shared = 'ready';
    const open = x.bills.filter((b) => !b.settled);
    slot.replaceChildren(
      ...(x.bills.length
        ? [
            h('div.lab', 'WHO OWES WHOM'),
            ...(x.pay.length ? x.pay.map((p) => h('div.mnline.mnowe', { dataset: { case: 'keep' } }, h('b', `${p.from} owes ${p.to}`), h('span', p2(p.amount)))) : [h('p.pknote', { dataset: { case: 'keep' } }, 'All square.')]),
            ...(open.length ? [h('div.pkrow', label(button('Mark all settled', () => void run({ op: 'settle' }), 'on'), 'Mark every shared bill settled'))] : []),
            h('div.lab', 'THE BILLS'),
            ...x.bills.slice(0, 30).map((b) =>
              h('div.mndue', { dataset: { case: 'keep', settled: b.settled ? '1' : '' }, role: 'group', 'aria-label': `${b.what}, ${p2(b.amount)}, paid by ${b.paidBy}` },
                h('div.mnline', h('b', b.what), h('span', p2(b.amount))),
                h('small.mnhow', `Paid by ${b.paidBy} on ${dayWords(b.on)}, shared by ${b.shares.join(', ')}${b.settled ? ` · settled ${dayWords(b.settled)}` : ''}.`),
                h('div.pkrow', label(button('Forget', () => void run({ op: 'remove', id: b.id })), `Forget the shared ${b.what} bill`)))),
            h('p.pknote.mnwhy', { dataset: { case: 'keep' } }, 'Equal shares to the penny; the odd pennies go to the first names. Nothing is paid and nobody is messaged: settled is your word.'),
          ]
        /* state: money.shared empty */
        : [emptyState('No shared bills yet', 'Add one below, like “electric £96, paid by you, shared by you, Sam and Jo”, and I show who owes whom.')]),
    );
  };
  const load = async () => {
    const got = await read<{ bills: SharedBill[]; pay: { from: string; to: string; amount: number }[] }>(el, slot, 'shared', 'household', {}, () => void load(), 'Opening your shared bills…');
    form.hidden = !got;
    if (got) paint(got.data);
  };
  void load();
  return el;
}

// ---------------------------------------------------------------- YOUR YEAR

interface YearData {
  year: string;
  years: string[];
  out: number;
  in: number;
  months: { month: string; out: number; in: number }[];
  dearest: string;
  cheapest: string;
  categories: { c: Category; spent: number }[];
  places: { k: string; out: number; n: number }[];
  started: string[];
  stopped: string[];
  rows: number;
}

function yearPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const el = h('div.pkcol.mnapp', slot, phrases(['my year in money', 'money year in review']));
  let year = '';
  const load = async () => {
    const got = await read<YearData>(el, slot, 'year', 'year', year ? { year } : {}, () => void load(), 'Adding up your year…');
    if (!got) return;
    const y = got.data;
    year = y.year;
    moneyPlan.year = `${y.year} ${p2(y.out)} ${p2(y.in)}`;
    moneyPlan.state.year = 'ready';
    if (!y.rows) {
      /* state: money.year empty */
      slot.replaceChildren(emptyState('No year to look back on yet', 'Add statements on the Statement page and your year is added up here.'));
      return;
    }
    const i = y.years.indexOf(y.year);
    const prev = label(button('‹', () => ((year = y.years[i - 1]!), void load())), i <= 0 ? 'Earlier year. This is the earliest year I hold.' : 'Earlier year');
    const next = label(button('›', () => ((year = y.years[i + 1]!), void load())), i >= y.years.length - 1 ? 'Later year. This is the latest year I hold.' : 'Later year');
    prev.disabled = i <= 0;
    next.disabled = i >= y.years.length - 1;
    const most = Math.max(1, ...y.months.map((m) => m.out));
    const catMost = Math.max(1, ...y.categories.map((c) => c.spent));
    const left = Math.round((y.in - y.out) * 100) / 100;
    slot.replaceChildren(
      h('div.mnnav', prev, h('b', y.year), next),
      h('div.mnfigs',
        figure('Out', p2(y.out), `Across ${plural(y.months.length, 'month')} you gave me a statement for.`),
        figure('In', p2(y.in), 'Money paid in and filed as income.'),
        figure(left >= 0 ? 'Left over' : 'Over by', p2(Math.abs(left)), 'Money in less money out.', left >= 0 ? 'ok' : 'over')),
      ...(y.dearest ? [h('p.pknote', { dataset: { case: 'keep' } }, `Dearest month: ${monthName(y.dearest)}. Cheapest: ${monthName(y.cheapest)}.`)] : []),
      h('div.lab', 'MONTH BY MONTH'),
      ...y.months.map((m) => meter(monthName(m.month), p2(m.out), m.out / most, m.month === y.dearest ? 'over' : m.month === y.cheapest ? 'ok' : 'soft')),
      h('div.lab', 'WHERE IT WENT'),
      ...y.categories.map((c) => meter(cap(c.c), p2(c.spent), c.spent / catMost, 'soft', y.out > 0 ? `${Math.round((c.spent / y.out) * 100)}% of the year’s money out.` : '')),
      ...(y.places.length ? [h('div.lab', 'THE PLACES YOU PAID MOST'), ...y.places.map((p) => h('div.mnline.mnplace', { dataset: { case: 'keep' } }, h('b', cap(p.k.toLowerCase())), h('span', `${p2(p.out)} · ${plural(p.n, 'payment')}`)))] : []),
      h('div.lab', 'SUBSCRIPTIONS'),
      h('p.pknote', { dataset: { case: 'keep' } }, y.started.length ? `Started in ${y.year}: ${y.started.join(', ')}.` : `None started in ${y.year} that your statements show.`),
      h('p.pknote', { dataset: { case: 'keep' } }, y.stopped.length ? `Stopped in ${y.year}: ${y.stopped.join(', ')}.` : `None stopped in ${y.year} that your statements show.`),
      h('div.pkrow', label(button('Print it', () => window.print()), `Print your ${y.year} in money`)),
      h('p.pknote.mnwhy', { dataset: { case: 'keep' } }, 'Only the months you gave me a statement for are counted. Sums, not a forecast.'),
    );
  };
  void load();
  return el;
}

/** One of the new pages, made by its own function (the MONEY screen's panels: features/money/index.ts). */
export function planPage(page: PlanPage): { el: HTMLElement; stop(): void } {
  expose();
  const el = page === 'calendar' ? calendarPage() : page === 'goals' ? goalsPage() : page === 'shared' ? sharedPage() : yearPage();
  return { el, stop: () => undefined };
}
