/**
 * THE MONEY APP (FINAL ROUND, the money lane): the MONEY screen as a budgeting app of its own, drawn from the statements he
 * gave me and nothing else (no bank access, no prediction, nothing that costs money). Four pages beside PASTE A STATEMENT:
 *
 *   MONTH     the month's money out, money in and what is left over; the pace (pounds a day so far); each category with its
 *             share and its move since the month before; the places the money went most; every row, searchable, a tap re-files
 *             it (and the rule is remembered for the next statement).
 *   BUDGETS   each budget's bar, what is left and what that is a day for the days to go, set or taken away here in two taps.
 *   BILLS     what is due next, in date order: the subscriptions found in his statements (the same amount to the same name every
 *             month or year) and the bills he showed the HOME screen; what they come to a month and a year; a price that went up.
 *   TRENDS    the last six months side by side (out, in, left over), the average, the dearest and the cheapest month, and one
 *             category across them.
 *
 * Every number says how it was worked out, in one line under it. The sums are packages/shared/src/spending.ts (the brain's own);
 * this file only reads GET /api/profile/spending and draws. The state sits on window.__ghosty.moneyapp for the specs.
 */
import { CATEGORIES, gbp, monthName, prevMonth, type Category, type SpendingSummary, type SpendRow, type Subscription } from '../../../../../packages/shared/src/spending';
import { brain } from '../../api/brain';
import { h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { isoDay } from '../brief/day';
import { daysTo, emptyState, inWords, lacksSignal, phrases, stateIn, stateLine, waitFor } from '../lifeui';
import { openRules, safeBlock } from './plan';

export type MoneyPage = 'month' | 'budgets' | 'bills' | 'trends';
/** Each page's name: its panel's title on the MONEY screen. */
export const MONEY_TITLES: Record<MoneyPage, string> = { month: 'YOUR MONTH', budgets: 'BUDGETS', bills: 'BILLS AND SUBSCRIPTIONS', trends: 'TRENDS' };

/** What a spec reads: window.__ghosty.moneyapp. */
export const moneyApp = {
  month: '',
  out: 0,
  in: 0,
  left: 0,
  categories: [] as string[],
  budgets: [] as string[],
  due: [] as string[],
  trend: [] as string[],
  shown: 0,
  refiled: 0,
  split: 0,
  cancel: [] as string[],
  state: {} as Record<string, string>,
};
const expose = () => {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.moneyapp = moneyApp;
};

const SPEND: Category[] = CATEGORIES.filter((c) => c !== 'income');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Pounds and pence, as his statement writes them. */
const p2 = (n: number) => gbp(n, true);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const daysIn = (month: string) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Friday 14 November". */
const dayWords = (d: string) => `${DAYS[new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay()]} ${+d.slice(8, 10)} ${monthName(d.slice(0, 7))}`;
const today = () => isoDay(new Date());

/** A meter of his own: a label and a value on one line that wraps (never cut), the bar under them, and a how-line. */
function meter(label: string, value: string, frac: number, tone: '' | 'over' | 'ok' | 'soft' = '', how = ''): HTMLElement {
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  return h(
    'div.mnmeter',
    { dataset: { tone } },
    h('div.mnline', h('b', label), h('span', value)),
    h('div.mnbar', { role: 'img', 'aria-label': `${label}: ${value}` }, h('i', { style: { width: `${Math.round(f * 100)}%` } })),
    how ? h('small.mnhow', how) : null,
  );
}
/** A figure at size with its name and how it was worked out. */
const figure = (name: string, value: string, how: string, tone = '') => h('div.mnfig', { dataset: { tone } }, h('span.mnname', name), h('b.mnval', value), h('small.mnhow', how));
const label = (b: HTMLButtonElement, l: string) => (b.setAttribute('aria-label', l), b);

/** The brain's summary for a month (the latest when none), with the state said where the page is: null when it could not be read. */
async function read(el: HTMLElement, slot: HTMLElement, page: MoneyPage, month?: string, again?: () => void): Promise<SpendingSummary | null> {
  if (lacksSignal()) {
    moneyApp.state[page] = 'offline';
    /* state: money.month offline */
    /* state: money.budgets offline */
    /* state: money.bills offline */
    /* state: money.trends offline */
    slot.replaceChildren(stateLine('offline', 'No signal. Your money comes back here when the phone is online again.'));
    return null;
  }
  /* state: money.month loading */
  /* state: money.budgets loading */
  /* state: money.bills loading */
  /* state: money.trends loading */
  const done = waitFor(el, 'Opening your money…');
  try {
    const s = await brain.spending(month, today());
    if (typeof s?.kept !== 'number' || !Array.isArray(s.months)) throw new Error('no spending on this brain yet');
    if (!s.kept) {
      moneyApp.state[page] = 'empty';
      const add = label(button('Add a statement', () => (location.hash = 'money?statement'), 'on'), 'Go to Paste a statement');
      /* state: money.month empty */
      /* state: money.budgets empty */
      /* state: money.bills empty */
      /* state: money.trends empty */
      slot.replaceChildren(emptyState('Nothing kept yet', 'Add a statement from your bank and your month is here.'), h('div.pkrow', add));
      return null;
    }
    return s;
  } catch (e) {
    moneyApp.state[page] = 'error';
    const retry = label(button('Try again', () => again?.()), 'Try reading your money again');
    /* state: money.month error */
    /* state: money.budgets error */
    /* state: money.bills error */
    /* state: money.trends error */
    slot.replaceChildren(stateLine('error', sayError(e, 'read your money')), h('div.pkrow', retry));
    return null;
  } finally {
    done();
  }
}

/** One of the four pages, made by its own function (the MONEY screen's panels: features/money/index.ts). */
export function moneyPage(page: MoneyPage): { el: HTMLElement; stop(): void } {
  expose();
  const el = page === 'month' ? monthPage() : page === 'budgets' ? budgetsPage() : page === 'bills' ? billsPage() : trendsPage();
  return { el, stop: () => undefined };
}

// ---------------------------------------------------------------- MONTH

function monthPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  // [moneynext] safe to spend until payday stands at the top once the month is read (features/money/plan.ts)
  const top = h('div.pkcol');
  const el = h('div.pkcol.mnapp', top, slot, status, phrases(['my spending', 'spending this month', 'safe to spend']));
  let cat: Category | '' = '';
  let find = '';
  let all = false;
  let s: SpendingSummary | null = null;
  /** Each read and each filing takes a ticket: an answer for a month he has already left is dropped. */
  let ticket = 0;
  // the search box is made once and never redrawn while he types (a phone's keyboard loses its letters when its box is replaced)
  const search = h('input.mnsearch', { type: 'search', placeholder: 'Find a payment: Tesco, rent, 12.99', 'aria-label': 'Find a payment', enterKeyHint: 'search' }) as HTMLInputElement;
  const listBox = h('div.pkcol.mnlist');
  search.addEventListener('input', () => {
    find = search.value;
    all = false;
    paintList();
  });
  const paintList = () => {
    if (!s) return;
    const q = find.trim().toLowerCase();
    const rows = s.rows.filter((r) => (!cat || r.c === cat) && (!q || r.t.toLowerCase().includes(q) || r.c.includes(q)));
    const shown = all ? rows : rows.slice(0, 25);
    moneyApp.shown = shown.length;
    const list = shown.map((r) => {
      const b = h('button.mntxn', { type: 'button', dataset: { k: r.k, c: r.c, by: r.by }, 'aria-label': `${r.t}, ${p2(r.a)} on ${dayWords(r.d)}, filed as ${r.c}. Tap to file it somewhere else.` },
        h('span.mnwhat', h('b', r.t), h('small', `${dayWords(r.d)} · ${r.c}${r.sp ? ' (part of a split)' : ''}${r.by === 'you' && !r.sp ? ' (you filed it)' : r.by === 'model' ? ' (sorted by the free AI)' : r.by === 'none' ? ' — tap to file it' : ''}`)),
        h('span.mnamt', { dataset: { tone: r.a > 0 ? 'in' : '' } }, r.a > 0 ? `+${p2(r.a)}` : p2(-r.a)));
      b.addEventListener('click', () => refile(r));
      return b;
    });
    const more = rows.length > shown.length ? [label(button(`Show all ${rows.length}`, () => ((all = true), paintList())), `Show all ${rows.length} payments`)] : [];
    listBox.replaceChildren(
      ...(list.length ? list : [h('p.pknote', { dataset: { case: 'keep' } }, q ? `No payment this month matches “${find.trim()}”.` : 'No payments here.')]),
      ...(more.length ? [h('div.pkrow', ...more)] : []),
    );
  };

  const refile = (r: SpendRow) => {
    // [moneynext] money.u4: or split this one payment across two categories, to the penny (a split one can be put back whole)
    const whole = Math.abs(r.sp ? r.sp.of : r.a);
    const partAmt = h('input.mnsplitin', { type: 'text', inputMode: 'decimal', placeholder: `£${(whole / 2).toFixed(2)}`, 'aria-label': 'How much of it goes to the first category' }) as HTMLInputElement;
    const first = h('select.mnsplitsel', { 'aria-label': 'The first category' }, ...CATEGORIES.map((c) => h('option', { value: c, selected: c === r.c }, cap(c)))) as HTMLSelectElement;
    const second = h('select.mnsplitsel', { 'aria-label': 'Where the rest goes' }, ...CATEGORIES.map((c) => h('option', { value: c, selected: c === 'shopping' && r.c !== 'shopping' }, cap(c)))) as HTMLSelectElement;
    const splitSay = h('p.pknote', { 'aria-live': 'polite' });
    const doSplit = async (parts: { c: Category; a: number }[]) => {
      const mine = ++ticket;
      try {
        const x = await brain.spendingSplit({ d: r.d, t: r.t, a: r.sp ? r.sp.of : r.a }, parts, s?.month ?? '');
        m.close();
        moneyApp.split++;
        stateIn(status, '', parts.length ? `Split “${r.t}”: ${parts.map((p, i) => `${p2(i === parts.length - 1 ? whole - parts.slice(0, -1).reduce((k, q) => k + q.a, 0) : p.a)} ${p.c}`).join(', ')}.` : `“${r.t}” is whole again.`);
        if (mine !== ticket) return;
        s = x;
        paint();
      } catch (e) {
        stateIn(splitSay, 'error', sayError(e, 'split it'));
      }
    };
    const goSplit = () => {
      const n = Number(partAmt.value.replace(/[£,\s]/g, ''));
      if (!Number.isFinite(n) || n <= 0 || n >= whole) return void stateIn(splitSay, '', `Type how much goes to the first category, under ${p2(whole)}.`);
      if (first.value === second.value) return void stateIn(splitSay, '', 'Pick two different categories.');
      void doSplit([{ c: first.value as Category, a: n }, { c: second.value as Category, a: whole - n }]);
    };
    const splitBox = h('details.mnmore', h('summary', r.sp ? 'Split across categories (it is split now)' : 'Split it across categories'),
      h('div.pkcol', h('div.pkrow', partAmt, first), h('div.pkrow', h('span.pklab', 'and the rest to'), second),
        h('div.pkrow', label(button('Split it', goSplit, 'on'), 'Split this payment'), ...(r.sp ? [label(button('Put it back whole', () => void doSplit([])), 'Put this payment back whole')] : [])),
        splitSay));
    const m = modal(`File “${r.t}” as…`, h(
      'div.pkcol',
      splitBox,
      h('p.pknote', `Every payment to ${cap(r.k.toLowerCase())} goes there, and the next statement remembers it.`),
      h('div.pkrow.mnchips', ...CATEGORIES.map((c) => label(button(cap(c), async () => {
        m.close();
        const mine = ++ticket;
        try {
          const x = await brain.spendingFile(r.k, c, s?.month ?? '');
          moneyApp.refiled += x.filed;
          stateIn(status, '', `Filed ${plural(x.filed, 'payment')} as ${c}; the next statement remembers it.`);
          if (mine !== ticket) return;
          s = x;
          paint();
        } catch (e) {
          stateIn(status, 'error', sayError(e, 'file it'));
        }
      }, c === r.c ? 'on' : ''), `File it as ${c}`))),
    ));
  };

  const paint = () => {
    if (!s?.view) return;
    const v = s.view;
    const i = s.months.indexOf(s.month);
    const left = Math.round((v.in - v.out) * 100) / 100;
    Object.assign(moneyApp, { month: s.month, out: v.out, in: v.in, left, categories: v.categories.map((c) => `${c.c} ${p2(c.spent)}`) });
    // the months, with arrows that say why one cannot be pressed
    const prev = label(button('‹', () => void load(s!.months[i - 1])), i <= 0 ? 'Earlier month. This is the earliest month I hold.' : 'Earlier month');
    const next = label(button('›', () => void load(s!.months[i + 1])), i >= s.months.length - 1 ? 'Later month. This is the latest month I hold.' : 'Later month');
    prev.disabled = i <= 0;
    next.disabled = i >= s.months.length - 1;
    const nav = h('div.mnnav', prev, h('b', `${monthName(s.month)} ${s.month.slice(0, 4)}`), next);
    // the three figures
    const figs = h(
      'div.mnfigs',
      figure('Out', p2(v.out), 'Every payment this month, less refunds; money in is not counted.'),
      figure('In', p2(v.in), 'Money paid in and filed as income.'),
      figure(left >= 0 ? 'Left over' : 'Over by', p2(Math.abs(left)), 'Money in less money out.', left >= 0 ? 'ok' : 'over'),
    );
    // the pace: this month so far, or a whole month gone by (sums, not guesses)
    const now = today();
    const isNow = s.month === now.slice(0, 7);
    const days = isNow ? +now.slice(8, 10) : daysIn(s.month);
    const pace = h('p.pknote.mnpace', { dataset: { case: 'keep' } }, isNow ? `Day ${days} of ${daysIn(s.month)}: ${p2(v.out)} out so far, about ${p2(v.out / days)} a day.` : `About ${p2(v.out / days)} a day over the ${days} days of ${monthName(s.month)}.`);
    // the categories: share and move
    const moves = new Map((s.moves ?? []).map((m) => [m.c, m.diff]));
    const had = s.months.includes(prevMonth(s.month));
    const most = Math.max(1, ...v.categories.map((c) => c.spent));
    const cats = v.categories.map((c) => {
      const share = v.out > 0 ? Math.round((c.spent / v.out) * 100) : 0;
      const d = moves.get(c.c) ?? 0;
      const move = !had ? '' : Math.abs(d) < 1 ? ' · about the same as last month' : ` · ${p2(Math.abs(d))} ${d > 0 ? 'more' : 'less'} than last month`;
      const m = meter(cap(c.c), `${p2(c.spent)} · ${share}%`, c.spent / most, c.c === cat ? 'ok' : '', `${share}% of the month’s money out${move}.`);
      const pick = label(button(cat === c.c ? 'Show every payment' : `Show ${c.c}`, () => {
        cat = cat === c.c ? '' : c.c;
        all = false;
        paint();
      }), cat === c.c ? 'Show every payment again' : `Show only the ${c.c} payments`);
      m.append(h('div.pkrow', pick));
      return m;
    });
    // where the money went most: the names paid most, by money out
    const by = new Map<string, { n: number; out: number; t: string }>();
    for (const r of s.rows) if (r.a < 0 && r.c !== 'income') {
      const x = by.get(r.k) ?? { n: 0, out: 0, t: r.k };
      x.n++;
      x.out += -r.a;
      by.set(r.k, x);
    }
    const top = [...by.values()].sort((a, b) => b.out - a.out).slice(0, 5);
    const topMost = Math.max(1, ...top.map((t) => t.out));
    slot.replaceChildren(
      nav,
      figs,
      pace,
      v.categories.length ? h('div.lab', 'BY CATEGORY') : h('p.pknote', { dataset: { case: 'keep' } }, `Nothing spent in ${monthName(s.month)}. ${i > 0 ? 'Tap ‹ for an earlier month.' : 'Add a newer statement and I sort it.'}`),
      ...cats,
      ...(top.length ? [h('div.lab', 'WHERE IT WENT MOST'), ...top.map((t) => meter(cap(t.t.toLowerCase()), p2(t.out), t.out / topMost, 'soft', `${plural(t.n, 'payment')} this month.`))] : []),
      h('div.lab', cat ? `${cat.toUpperCase()} · TAP ONE TO FILE IT` : 'EVERY PAYMENT · TAP ONE TO FILE IT'),
      h('div.pkrow', label(button('Your sorting rules', () => openRules(() => void load(s?.month))), 'See and change your sorting rules')),
      search,
      listBox,
    );
    paintList();
  };
  const load = async (month?: string) => {
    const mine = ++ticket;
    const got = await read(el, slot, 'month', month, () => void load(month));
    if (mine !== ticket || !got) return;
    if (!top.childElementCount) top.append(safeBlock());
    s = got;
    cat = '';
    all = false;
    paint();
    moneyApp.state.month = 'ready';
  };
  void load();
  return el;
}

// ---------------------------------------------------------------- BUDGETS

function budgetsPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const pick = h('select.mnselect', { 'aria-label': 'What the budget is for' }, ...SPEND.map((c) => h('option', { value: c }, cap(c)))) as HTMLSelectElement;
  const amount = h('input.mnamount', { type: 'text', inputMode: 'decimal', placeholder: '£200', 'aria-label': 'How much a month', enterKeyHint: 'done' }) as HTMLInputElement;
  const set = label(button('Set budget', () => void keep(), 'on'), 'Set this budget');
  const form = h('div.pkcol.mnform', h('div.lab', 'SET A BUDGET'), h('div.pkrow', pick, amount), h('div.pkrow', set));
  const el = h('div.pkcol.mnapp', slot, form, status, phrases(['my budgets', 'show me my budgets']));
  let s: SpendingSummary | null = null;
  const send = async (words: string, said: (x: SpendingSummary & { set: { category: Category; monthly: number } }) => string) => {
    if (lacksSignal()) return void stateIn(status, 'offline', 'No signal. Set it again when the phone is back online.');
    try {
      const x = await brain.spendingBudget(words, s?.month ?? '');
      s = x;
      stateIn(status, '', said(x));
      paint();
    } catch (e) {
      stateIn(status, 'error', sayError(e, 'set that budget'));
    }
  };
  const keep = async () => {
    const n = Number(amount.value.replace(/[£,\s]/g, ''));
    if (!amount.value.trim() || !Number.isFinite(n) || n <= 0) return void stateIn(status, '', 'Type how much a month first, like 200.');
    await send(`£${n} a month on ${pick.value}`, (x) => `Budget kept: ${p2(x.set.monthly)} a month on ${x.set.category}.`);
    amount.value = '';
  };
  amount.addEventListener('keydown', (e) => e.key === 'Enter' && void keep());
  const paint = () => {
    if (!s) return;
    const now = today();
    const isNow = s.month === now.slice(0, 7);
    const total = daysIn(s.month);
    const day = isNow ? +now.slice(8, 10) : total;
    // (today is still to spend: on day 13 of 30 what is left is shared over 18 days, and on the last day over that day)
    const togo = total - day + 1;
    const gone = day / total;
    moneyApp.budgets = s.budgets.map((b) => `${b.category}: ${b.line}`);
    const cards = s.budgets.map((b) => {
      const over = b.left < 0;
      const ahead = !over && isNow && b.frac > gone + 0.1;
      const word = over ? 'Over budget' : ahead ? 'Going faster than the month' : 'On track';
      const daily = !over && isNow && togo > 0 ? ` That is about ${p2(b.left / togo)} a day for the ${plural(togo, 'day')} left.` : '';
      const m = meter(cap(b.category), `${p2(b.spent)} of ${p2(b.monthly)}`, b.frac, over ? 'over' : ahead ? 'soft' : 'ok', `${word}: ${b.line}.${daily}${isNow ? ` ${Math.round(gone * 100)}% of ${monthName(s!.month)} has gone.` : ''}`);
      m.dataset.category = b.category;
      const drop = label(button('Take it away', () => void send(`£0 a month on ${b.category}`, () => `No budget on ${b.category} now.`)), `Take away the ${b.category} budget`);
      const edit = label(button('Change it', () => {
        pick.value = b.category;
        amount.value = String(b.monthly);
        amount.focus();
      }), `Change the ${b.category} budget`);
      m.append(h('div.pkrow', edit, drop));
      return m;
    });
    const budgeted = new Set(s.budgets.map((b) => b.category));
    const loose = (s.view?.categories ?? []).filter((c) => !budgeted.has(c.c));
    const sum = s.budgets.reduce((k, b) => k + b.monthly, 0);
    const spent = s.budgets.reduce((k, b) => k + b.spent, 0);
    slot.replaceChildren(
      h('div.mnnav.mnhead', h('b', `${monthName(s.month)} ${s.month.slice(0, 4)}`)),
      ...(s.budgets.length
        ? [figure('Budgeted', p2(sum), `${plural(s.budgets.length, 'budget')} a month; ${p2(spent)} of it spent in ${monthName(s.month)}.`, spent > sum ? 'over' : 'ok'), ...cards]
        /* state: money.budgets empty */
        : [emptyState('No budgets yet', 'Pick what it is for and how much a month, below.')]),
      ...(loose.length ? [h('div.lab', 'NOT BUDGETED'), ...loose.map((c) => h('p.pknote.mnloose', { dataset: { case: 'keep' } }, `${cap(c.c)}: ${p2(c.spent)} in ${monthName(s!.month)}.`))] : []),
    );
  };
  const load = async () => {
    const got = await read(el, slot, 'budgets', undefined, () => void load());
    form.hidden = !got;
    if (!got) return;
    s = got;
    paint();
    moneyApp.state.budgets = 'ready';
  };
  void load();
  return el;
}

// ---------------------------------------------------------------- BILLS

interface HomeBill {
  id: string;
  supplier: string;
  kind: string;
  amount: number;
  due: string;
  paid?: string;
}
interface Due {
  on: string;
  name: string;
  amount: number;
  how: string;
  kind: 'sub' | 'bill';
}

/** What is due next: the subscriptions found in his statements and the bills he showed the HOME screen, in date order. */
export function dueList(subs: Subscription[], bills: HomeBill[], now: string): Due[] {
  const out: Due[] = [];
  for (const x of subs) out.push({ on: x.next, name: x.name, amount: x.amount, kind: 'sub', how: `Found in your statements: ${plural(x.count, 'payment')}, ${x.cadence === 'monthly' ? 'every month' : 'every year'}, last on ${dayWords(x.last)}.` });
  for (const b of bills) if (!b.paid && /^\d{4}-\d{2}-\d{2}$/.test(b.due)) out.push({ on: b.due, name: b.supplier, amount: b.amount, kind: 'bill', how: `From the ${b.kind && !/\bbill$/i.test(b.kind) ? `${b.kind} bill` : b.kind || 'bill'} you showed me on the HOME screen.` });
  return out.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0)).map((d) => (d.on < now && d.kind === 'sub' ? { ...d, how: `${d.how} Your statements stop before then, so check it is still running.` } : d));
}

function billsPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const el = h('div.pkcol.mnapp', slot, phrases(['my subscriptions', 'direct debits']));
  const load = async () => {
    const s = await read(el, slot, 'bills', undefined, () => void load());
    if (!s) return;
    let bills: HomeBill[] = [];
    let homeSaid = '';
    try {
      const r = await brain.packDo('homeadmin', 'bills', {});
      bills = ((r.data as { bills?: HomeBill[] } | undefined)?.bills ?? []).slice();
    } catch {
      homeSaid = 'The bills on your HOME screen could not be read just now; these are your statements’ alone.';
    }
    const now = today();
    // a subscription whose next payment is more than a whole cycle gone looks stopped: not counted in what he pays, said apart
    const gone = (x: Subscription) => {
      const n = daysTo(x.next);
      return n !== null && n < -(x.cadence === 'monthly' ? 31 : 366);
    };
    const stopped = s.subscriptions.filter(gone);
    const due = dueList(s.subscriptions.filter((x) => !gone(x)), bills, now);
    moneyApp.due = due.map((d) => `${d.on} ${d.name} ${p2(d.amount)}`);
    const subs = s.subscriptions.filter((x) => !gone(x));
    const month = subs.reduce((k, x) => k + (x.cadence === 'monthly' ? x.amount : x.amount / 12), 0);
    const year = subs.reduce((k, x) => k + x.yearly, 0);
    // the next 30 days, and a bill already late (still to pay); a subscription's past date is only a guess, so it is not counted
    const soon = due.filter((d) => {
      const n = daysTo(d.on);
      return n !== null && n <= 30 && (n >= 0 || d.kind === 'bill');
    });
    const late = soon.filter((d) => (daysTo(d.on) ?? 0) < 0).length;
    const soonSum = soon.reduce((k, d) => k + d.amount, 0);
    const ups = subs.filter((x) => x.was !== undefined && x.amount > x.was!);
    const row = (d: Due) => {
      const n = daysTo(d.on);
      const when = n === null ? '' : n < 0 ? `was due around ${dayWords(d.on)}` : `${inWords(d.on)} · ${dayWords(d.on)}`;
      // [moneynext] money.u7: a subscription's own public cancel page and the plain steps, found on his tap (nothing is cancelled for him)
      const how = h('div.pkcol.mncancel', { 'aria-live': 'polite' });
      const ask = d.kind === 'sub' ? label(button('How to cancel', async () => {
        if (lacksSignal()) return void how.replaceChildren(stateLine('offline', 'No signal. Try again when the phone is back online.'));
        const done = waitFor(how, `Finding ${d.name}’s own cancel page…`);
        try {
          const r = await brain.packDo('money', 'cancel', { name: d.name });
          const x = r.data as { links: { title: string; url: string }[]; steps: string };
          moneyApp.cancel = x.links.map((l) => l.url);
          how.replaceChildren(
            ...x.links.map((l) => h('div.pkrow', label(button(`Open: ${l.title.slice(0, 60)}`, () => void window.open(l.url, '_blank', 'noopener,noreferrer')), `Open ${l.title}`))),
            h('small.mnhow', x.links.length ? `${x.steps} From ${new URL(x.links[0]!.url).hostname.replace(/^www\./, '')}, the company’s own site.` : x.steps),
          );
        } catch (e) {
          how.replaceChildren(stateLine('error', sayError(e, 'find its cancel page')));
        } finally {
          done();
        }
      }), `How to cancel ${d.name}`) : null;
      const el = h('div.mndue', { dataset: { kind: d.kind, on: d.on, case: 'keep' }, role: 'group', 'aria-label': `${d.name}, ${p2(d.amount)}, ${when}` },
        h('div.mnline', h('b', d.name), h('span', p2(d.amount))),
        h('span.pklab', when),
        h('small.mnhow', d.how),
        ...(ask ? [h('div.pkrow', ask), how] : []));
      // [recall] memory.c3 (memory lane, additive): what he asked me about this bill before, from his own chats on this phone, one tap away
      void askedAbout(d.name).then((b) => b && el.append(b));
      return el;
    };
    slot.replaceChildren(
      ...(subs.length || due.length
        ? [
            h('div.mnfigs',
              figure('Next 30 days', p2(soonSum), `${plural(soon.length, 'payment')} due${late ? `, ${late} of them late` : ''}, from the list below.`),
              figure('Subscriptions a month', p2(month), 'Each monthly one, and each yearly one shared over twelve months.'),
              figure('A year', p2(year), `${plural(subs.length, 'subscription')} at today’s prices.`)),
            ...(ups.length ? [h('div.lab', 'PRICES THAT WENT UP'), ...ups.map((x) => h('p.pknote.mnup', { dataset: { case: 'keep' } }, `${x.name}: ${p2(x.amount)}, up from ${p2(x.was!)} on ${dayWords(x.changed!)}.`))] : []),
            h('div.lab', 'DUE NEXT'),
            ...due.map(row),
            ...(stopped.length ? [h('div.lab', 'LOOKS STOPPED'), ...stopped.map((x) => h('p.pknote.mnstopped', { dataset: { case: 'keep' } }, `${x.name}: ${p2(x.amount)} ${x.cadence === 'monthly' ? 'a month' : 'a year'}, last paid ${dayWords(x.last)}. Not counted above.`))] : []),
          ]
        /* state: money.bills empty */
        : [emptyState('Nothing repeating found yet', 'A subscription shows here once your statements hold two payments of it. Bills you photograph on the HOME screen show too.')]),
      ...(homeSaid ? [stateLine('error', homeSaid)] : []),
      h('p.pknote.mnwhy', { dataset: { case: 'keep' } }, 'A subscription is the same amount to the same name every month or every year; its next date is the last one plus a month or a year.'),
    );
    moneyApp.state.bills = 'ready';
  };
  void load();
  return el;
}

// ---------------------------------------------------------------- TRENDS

function trendsPage(): HTMLElement {
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const el = h('div.pkcol.mnapp', slot, phrases(['spending trends', 'spending by month']));
  let cat: Category | '' = '';
  let views: SpendingSummary[] = [];
  const paint = () => {
    const ms = views.filter((x) => x.view).map((x) => x.view!);
    if (!ms.length) return;
    const nowM = today().slice(0, 7);
    const whole = ms.length > 1 ? ms.filter((m) => m.month !== nowM) : ms;
    const outs = whole.map((m) => m.out);
    const avg = outs.reduce((k, n) => k + n, 0) / whole.length;
    const hi = whole.reduce((a, b) => (b.out > a.out ? b : a));
    const lo = whole.reduce((a, b) => (b.out < a.out ? b : a));
    const most = Math.max(1, ...ms.map((m) => m.out), ...ms.map((m) => m.in));
    moneyApp.trend = ms.map((m) => `${m.month} ${p2(m.out)}`);
    const seen = SPEND.filter((c) => ms.some((m) => m.categories.some((x) => x.c === c)));
    const chips = h('div.pkrow.mnchips', { role: 'group', 'aria-label': 'One category across the months' },
      ...[['', 'Everything'] as const, ...seen.map((c) => [c, cap(c)] as const)].map(([c, t]) => {
        const b = label(button(t, () => ((cat = c), paint()), cat === c ? 'on' : ''), c ? `Show ${c} across the months` : 'Show all the money out across the months');
        b.setAttribute('aria-pressed', String(cat === c));
        return b;
      }));
    const val = (m: (typeof ms)[number]) => (cat ? (m.categories.find((x) => x.c === cat)?.spent ?? 0) : m.out);
    const catMost = Math.max(1, ...ms.map(val));
    const catAvg = ms.reduce((k, m) => k + val(m), 0) / ms.length;
    slot.replaceChildren(
      h('div.mnfigs',
        figure('A month on average', p2(avg), `Money out over ${plural(whole.length, 'whole month')} you gave me, added and shared${whole.length < ms.length ? '; this month is still going, so it is left out' : ''}.`),
        figure('Dearest month', `${monthName(hi.month)} · ${p2(hi.out)}`, 'The month with the most money out.', 'over'),
        figure('Cheapest month', `${monthName(lo.month)} · ${p2(lo.out)}`, 'The month with the least money out.', 'ok')),
      h('div.lab', 'MONTH BY MONTH'),
      ...ms.map((m) => {
        const left = Math.round((m.in - m.out) * 100) / 100;
        return meter(`${monthName(m.month)} ${m.month.slice(0, 4)}${m.month === nowM ? ' so far' : ''}`, `${p2(m.out)} out`, m.out / most, m.out > avg ? 'soft' : '', `${p2(m.in)} in · ${left >= 0 ? `${p2(left)} left over` : `${p2(-left)} over`}.`);
      }),
      h('div.lab', 'ONE CATEGORY'),
      chips,
      ...ms.map((m) => meter(`${monthName(m.month)}`, p2(val(m)), val(m) / catMost, cat ? 'ok' : 'soft')),
      h('p.pknote.mnwhy', { dataset: { case: 'keep' } }, `${cat ? cap(cat) : 'Money out'}: ${p2(catAvg)} a month on average across these months. Only months you gave me a statement for are counted.`),
    );
  };
  const load = async () => {
    const s = await read(el, slot, 'trends', undefined, () => void load());
    if (!s) return;
    const last = s.months.slice(-6);
    const done = waitFor(el, 'Adding up your months…');
    let trouble = '';
    try {
      views = await Promise.all(last.map((m) => (m === s.month ? Promise.resolve(s) : brain.spending(m, today()))));
    } catch (e) {
      views = [s];
      trouble = sayError(e, 'read your earlier months');
    } finally {
      done();
    }
    paint();
    if (trouble) slot.append(stateLine('error', `${trouble} This is the newest month alone.`));
    moneyApp.state.trends = 'ready';
  };
  void load();
  return el;
}

/** [recall] memory.c3: "You asked me about Octopus on Tue 10 Nov ›" under a bill, when his own chats on this phone hold it; null when they don't. */
async function askedAbout(name: string): Promise<HTMLElement | null> {
  const R = await import('../memory/recall');
  if (!(await R.recallWarm())) return null;
  const word = name.toLowerCase().replace(/\b(?:ltd|limited|plc|uk|the)\b/g, '').trim();
  if (word.length < 3) return null;
  const hits = (await R.findLocal(name, { turns: true, k: 6 })).filter((f) => f.line.toLowerCase().includes(word.split(/\s+/)[0]!));
  if (!hits.length) return null;
  const f = hits.sort((a, b) => b.at - a.at)[0]!;
  const { openFound } = await import('../memory/recallcard');
  const b = h('button.mnasked', { type: 'button', dataset: { case: 'keep' }, 'aria-label': `What you asked me about ${name}` }, `You asked me about this ${f.day}${hits.length > 1 ? ` (and ${hits.length - 1} more)` : ''} ›`);
  b.addEventListener('click', () => void openFound(f));
  return b;
}
