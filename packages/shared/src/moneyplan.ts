/**
 * MONEY AND PAPERS HANDLED FOR YOU (THE NEXT ROUND, the money lane), the pure sums: his statements, the bills he showed HOME, the
 * subscriptions he listed and his payday, joined into one money picture. Plain sums from his own records, never a forecast:
 *
 *   safeToSpend     what is left until payday after the bills still due before it (money.u2)
 *   monthCalendar   a month as days, each with the bills, subscriptions and payday that fall on it (money.u1)
 *   supplierYears   what each supplier cost him this year and last, from the bills he marked paid (money.u13)
 *   goalPlan        a savings goal's bar and what it is a month to reach it by its date (money.u5)
 *   splitRow        one payment shared across categories, to the penny (money.u4)
 *   yearInMoney     a year looked back on: totals, the dearest months, subscriptions started and stopped (money.u6)
 *   householdOwes   who owes whom from shared bills, settled on a tap (money.s3)
 *
 * Nothing here reads a bank, the network or a clock: every day comes in as YYYY-MM-DD.
 */
import { nextPayday, paydayIn, type Payday, type Sub } from './money';
import { addDays, addMonths, daysBetween } from './packs';
import type { Category, SpendRow, Subscription } from './spending';

const r2 = (n: number) => Math.round(n * 100) / 100;
const ymd = /^\d{4}-\d{2}-\d{2}$/;

/** One thing due: a subscription found in his statements, a bill he showed HOME, a subscription he listed in the chat. */
export interface DueItem {
  on: string;
  name: string;
  amount: number;
  kind: 'sub' | 'bill' | 'listed';
}

/** A HOME bill as the brain keeps it (tools/homeadmin.ts). */
export interface HomeBillLike {
  id?: string;
  supplier: string;
  kind?: string;
  amount: number;
  due: string;
  paid?: string;
  credit?: number;
}

/** The payday either side of today: on payday itself the period runs from today to the next one. */
export function paydayPeriod(rule: Payday, today: string): { last: string; next: string } {
  let next = nextPayday(rule, today);
  if (next === today) next = nextPayday(rule, addDays(today, 1));
  const y = +next.slice(0, 4);
  const m = +next.slice(5, 7);
  const last = paydayIn(rule, m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
  return { last: last > today ? today : last, next };
}

const sameName = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const y = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

/** A listed subscription's dates from `from` to `to` (both kept), rolled on from its next renewal. */
function listedDates(s: Sub, from: string, to: string): string[] {
  const out: string[] = [];
  let n = s.next;
  const step = (d: string) => (s.every === 'week' ? addDays(d, 7) : s.every === 'year' ? addMonths(d, 12) : addMonths(d, 1));
  let guard = 0;
  while (n < from && guard++ < 600) n = step(n);
  while (n <= to && guard++ < 600) {
    out.push(n);
    n = step(n);
  }
  return out;
}
/** A subscription found in his statements: its dates from `from` to `to`, from its next date on (a month or a year at a time). */
function subDates(x: Subscription, from: string, to: string): string[] {
  const out: string[] = [];
  let n = x.next;
  let guard = 0;
  while (n < from && guard++ < 600) n = addMonths(n, x.cadence === 'monthly' ? 1 : 12);
  while (n <= to && guard++ < 600) {
    out.push(n);
    n = addMonths(n, x.cadence === 'monthly' ? 1 : 12);
  }
  return out;
}

/**
 * Everything due from `from` to `to` (both kept), in date order: the subscriptions in his statements (not one that looks stopped,
 * its last payment more than a whole cycle before `today`), the HOME bills not marked paid (one already late counts once, on its
 * own day), and the subscriptions he listed that his statements do not already show.
 */
export function dueBetween(subs: Subscription[], bills: HomeBillLike[], listed: Sub[], from: string, to: string, today: string): DueItem[] {
  const out: DueItem[] = [];
  const live = subs.filter((x) => daysBetween(x.next, today) <= (x.cadence === 'monthly' ? 31 : 366));
  for (const x of live) for (const on of subDates(x, from, to)) out.push({ on, name: x.name, amount: x.amount, kind: 'sub' });
  for (const b of bills) if (!b.paid && !b.credit && ymd.test(b.due) && b.due <= to && (b.due >= from || b.due < today) && b.amount > 0) out.push({ on: b.due, name: b.supplier, amount: b.amount, kind: 'bill' });
  for (const s of listed) if (!live.some((x) => sameName(x.name, s.name))) for (const on of listedDates(s, from, to)) out.push({ on, name: s.name, amount: s.amount, kind: 'listed' });
  return out.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.name.localeCompare(b.name)));
}

export interface Safe {
  /** The payday before (or today) and the next one. */
  last: string;
  payday: string;
  /** Days from today to payday (payday not counted): what the safe figure is shared over. */
  days: number;
  /** 'balance': from the newest balance his statement printed; 'since': money in less money out since his last payday. */
  base: 'balance' | 'since';
  balance?: number;
  balanceOn?: string;
  in: number;
  out: number;
  /** What is still due before payday, and its sum. */
  due: DueItem[];
  dueSum: number;
  /** Put aside for his goals before payday (what each goal is a month, shared over the days to payday). */
  aside: number;
  safe: number;
  perDay: number;
  /** His newest statement row, and how many days old it is: a payment since then is not counted. */
  newest: string;
  stale: number;
}

/**
 * Safe to spend until payday: what he has (the newest balance on his statement, else what came in less what went out since his
 * last payday), less every bill and subscription still due before payday, less what he puts aside for his goals. Sums only.
 */
export function safeToSpend(rows: SpendRow[], subs: Subscription[], bills: HomeBillLike[], listed: Sub[], rule: Payday, today: string, aside = 0): Safe {
  const { last, next } = paydayPeriod(rule, today);
  const sorted = [...rows].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const newest = sorted[sorted.length - 1]?.d ?? '';
  let withBal: SpendRow | undefined;
  for (let i = sorted.length - 1; i >= 0; i--) if (typeof sorted[i]!.b === 'number' && Number.isFinite(sorted[i]!.b)) {
    withBal = sorted[i];
    break;
  }
  const since = sorted.filter((r) => r.d >= last && r.d <= today);
  const inn = r2(since.filter((r) => r.a > 0).reduce((k, r) => k + r.a, 0));
  const out = r2(since.filter((r) => r.a < 0).reduce((k, r) => k - r.a, 0));
  const base: Safe['base'] = withBal && withBal.d >= last ? 'balance' : 'since';
  // what is due: after the newest row his statements hold (a payment on or before it is already in them), and before payday
  const from = newest ? addDays(newest, 1) : today;
  const due = dueBetween(subs, bills, listed, from < last ? last : from, addDays(next, -1), today);
  const dueSum = r2(due.reduce((k, d) => k + d.amount, 0));
  const have = base === 'balance' ? withBal!.b! : inn - out;
  const days = Math.max(1, daysBetween(today, next));
  const keep = r2(Math.max(0, aside));
  const safe = r2(have - dueSum - keep);
  return {
    last,
    payday: next,
    days,
    base,
    ...(base === 'balance' ? { balance: r2(withBal!.b!), balanceOn: withBal!.d } : {}),
    in: inn,
    out,
    due,
    dueSum,
    aside: keep,
    safe,
    perDay: r2(safe / days),
    newest,
    stale: newest ? Math.max(0, daysBetween(newest, today)) : 0,
  };
}

/** One day of the money calendar. */
export interface CalDay {
  day: string;
  items: (DueItem | { on: string; name: string; amount: 0; kind: 'payday' })[];
  sum: number;
}

/** A month (YYYY-MM) as its days, each with what is due on it and payday; `heavy` are the days whose sum is the month's biggest. */
export function monthCalendar(month: string, subs: Subscription[], bills: HomeBillLike[], listed: Sub[], rule: Payday | null, today: string): { days: CalDay[]; total: number; heavy: string[] } {
  const first = `${month}-01`;
  const end = addDays(addMonths(first, 1), -1);
  const due = dueBetween(subs, bills, listed, first, end, today).filter((d) => d.on >= first);
  const pay = rule ? paydayIn(rule, +month.slice(0, 4), +month.slice(5, 7)) : '';
  const days: CalDay[] = [];
  for (let d = first; d <= end; d = addDays(d, 1)) {
    const items: CalDay['items'] = due.filter((x) => x.on === d);
    if (d === pay) items.unshift({ on: d, name: 'Payday', amount: 0, kind: 'payday' });
    days.push({ day: d, items, sum: r2(items.reduce((k, x) => k + x.amount, 0)) });
  }
  const total = r2(due.reduce((k, x) => k + x.amount, 0));
  const top = Math.max(0, ...days.map((x) => x.sum));
  // a heavy day: at least a fifth of the month's bills land on it (and it is the biggest, or near it)
  const heavy = top > 0 ? days.filter((x) => x.sum >= Math.max(top * 0.6, total * 0.2)).map((x) => x.day) : [];
  return { days, total, heavy };
}

/** What each supplier cost him in a year and the one before, from the bills he marked paid (by the day each was paid, else due). */
export function supplierYears(bills: HomeBillLike[], year: string): { supplier: string; now: number; before: number; n: number }[] {
  const prev = String(+year - 1);
  const by = new Map<string, { supplier: string; now: number; before: number; n: number }>();
  for (const b of bills) {
    if (!b.paid) continue;
    const y = (b.paid || b.due).slice(0, 4);
    if (y !== year && y !== prev) continue;
    const x = by.get(b.supplier) ?? { supplier: b.supplier, now: 0, before: 0, n: 0 };
    if (y === year) {
      x.now = r2(x.now + b.amount);
      x.n++;
    } else x.before = r2(x.before + b.amount);
    by.set(b.supplier, x);
  }
  return [...by.values()].sort((a, b) => b.now - a.now || b.before - a.before);
}

/** A savings goal he set. */
export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** YYYY-MM-DD, or '' with no date. */
  by: string;
  at: string;
}

/** A goal's bar and what is left; with a date, the months to it (this one counted) and what that is a month. */
export function goalPlan(g: Goal, today: string): { frac: number; left: number; months: number; monthly: number; late: boolean; done: boolean } {
  const left = r2(Math.max(0, g.target - g.saved));
  const done = left <= 0;
  if (!g.by || !ymd.test(g.by)) return { frac: g.target > 0 ? Math.min(1, g.saved / g.target) : 0, left, months: 0, monthly: 0, late: false, done };
  const months = Math.max(0, (+g.by.slice(0, 4) - +today.slice(0, 4)) * 12 + (+g.by.slice(5, 7) - +today.slice(5, 7)) + 1);
  const late = g.by < today && !done;
  return { frac: g.target > 0 ? Math.min(1, g.saved / g.target) : 0, left, months, monthly: done ? 0 : months > 0 ? r2(Math.ceil((left / months) * 100) / 100) : left, late, done };
}

/** What all his goals together need put aside before a payday that is `days` away (a month taken as 30 days). */
export function goalsAside(goals: Goal[], today: string, days: number): number {
  const monthly = goals.reduce((k, g) => k + goalPlan(g, today).monthly, 0);
  return r2((monthly * Math.min(days, 30)) / 30);
}

/** One payment shared across categories: the parts he gave, the last part taking what is left, to the penny. */
export function splitRow(amount: number, parts: { c: Category; a: number }[]): { c: Category; a: number }[] | null {
  const total = Math.round(Math.abs(amount) * 100);
  const given = parts.map((p) => ({ c: p.c, p: Math.round(Math.abs(p.a) * 100) }));
  if (!given.length || given.some((p) => !Number.isFinite(p.p) || p.p <= 0)) return null;
  const head = given.slice(0, -1).reduce((k, p) => k + p.p, 0);
  if (head >= total) return null;
  given[given.length - 1]!.p = total - head;
  const sign = amount < 0 ? -1 : 1;
  return given.map((p) => ({ c: p.c, a: (sign * p.p) / 100 }));
}

/** A year (YYYY) looked back on, from the statement rows of that year. */
export function yearInMoney(rows: SpendRow[], subs: Subscription[], year: string): {
  out: number;
  in: number;
  months: { month: string; out: number; in: number }[];
  dearest: string;
  cheapest: string;
  categories: { c: Category; spent: number }[];
  places: { k: string; out: number; n: number }[];
  started: string[];
  stopped: string[];
} {
  const mine = rows.filter((r) => r.d.startsWith(year));
  const months = new Map<string, { month: string; out: number; in: number }>();
  const cats = new Map<Category, number>();
  const places = new Map<string, { k: string; out: number; n: number }>();
  let out = 0;
  let inn = 0;
  for (const r of mine) {
    const m = months.get(r.d.slice(0, 7)) ?? { month: r.d.slice(0, 7), out: 0, in: 0 };
    if (r.a > 0 && r.c === 'income') {
      m.in += r.a;
      inn += r.a;
    } else {
      m.out -= r.a;
      out -= r.a;
      cats.set(r.c, (cats.get(r.c) ?? 0) - r.a);
      if (r.a < 0) {
        const p = places.get(r.k) ?? { k: r.k, out: 0, n: 0 };
        p.out -= r.a;
        p.n++;
        places.set(r.k, p);
      }
    }
    months.set(m.month, m);
  }
  const ms = [...months.values()].map((m) => ({ month: m.month, out: r2(m.out), in: r2(m.in) })).sort((a, b) => (a.month < b.month ? -1 : 1));
  const dearest = ms.length ? ms.reduce((a, b) => (b.out > a.out ? b : a)).month : '';
  const cheapest = ms.length ? ms.reduce((a, b) => (b.out < a.out ? b : a)).month : '';
  // a subscription started this year: its first payment in his rows falls in it; stopped: its last payment does and it looks stopped
  const firstOf = new Map<string, string>();
  for (const r of rows) if (!firstOf.has(r.k) || r.d < firstOf.get(r.k)!) firstOf.set(r.k, r.d);
  const earliest = rows.reduce((k, r) => (!k || r.d < k ? r.d : k), '');
  const started = subs.filter((x) => (firstOf.get(x.k) ?? '').startsWith(year) && firstOf.get(x.k)! > earliest).map((x) => x.name);
  const lastDay = rows.reduce((k, r) => (r.d > k ? r.d : k), '');
  const stopped = subs.filter((x) => x.last.startsWith(year) && daysBetween(x.next, lastDay) > (x.cadence === 'monthly' ? 31 : 366)).map((x) => x.name);
  return {
    out: r2(out),
    in: r2(inn),
    months: ms,
    dearest,
    cheapest,
    categories: [...cats.entries()].map(([c, s]) => ({ c, spent: r2(s) })).filter((x) => x.spent > 0).sort((a, b) => b.spent - a.spent),
    places: [...places.values()].map((p) => ({ ...p, out: r2(p.out) })).sort((a, b) => b.out - a.out).slice(0, 10),
    started,
    stopped,
  };
}

/** A shared household bill: who paid it and who shares it (equal shares unless weights are given). */
export interface SharedBill {
  id: string;
  what: string;
  amount: number;
  paidBy: string;
  shares: string[];
  on: string;
  settled?: string;
}

/** Who owes whom from the shared bills not yet settled, in the fewest payments, to the penny. */
export function householdOwes(bills: SharedBill[]): { balances: { name: string; net: number }[]; pay: { from: string; to: string; amount: number }[] } {
  const net = new Map<string, number>();
  for (const b of bills) {
    if (b.settled || !b.shares.length) continue;
    const pence = Math.round(b.amount * 100);
    const each = Math.floor(pence / b.shares.length);
    let odd = pence - each * b.shares.length;
    net.set(b.paidBy, (net.get(b.paidBy) ?? 0) + pence);
    for (const s of b.shares) {
      const part = each + (odd-- > 0 ? 1 : 0);
      net.set(s, (net.get(s) ?? 0) - part);
    }
  }
  const balances = [...net.entries()].map(([name, p]) => ({ name, net: p / 100 })).sort((a, b) => b.net - a.net);
  const cred = [...net.entries()].filter(([, p]) => p > 0).map(([n, p]) => ({ n, p })).sort((a, b) => b.p - a.p);
  const debt = [...net.entries()].filter(([, p]) => p < 0).map(([n, p]) => ({ n, p: -p })).sort((a, b) => b.p - a.p);
  const pay: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const x = Math.min(debt[i]!.p, cred[j]!.p);
    if (x > 0) pay.push({ from: debt[i]!.n, to: cred[j]!.n, amount: x / 100 });
    debt[i]!.p -= x;
    cred[j]!.p -= x;
    if (!debt[i]!.p) i++;
    if (!cred[j]!.p) j++;
  }
  return { balances, pay };
}
