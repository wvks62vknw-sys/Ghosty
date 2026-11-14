/**
 * THE MONEY APP'S OWN ACTIONS (THE NEXT ROUND, the money lane): what the MONEY screen's keys run through POST /packs/do with no
 * model, and never in the money tool's prompt (packs/index.ts joins them to the money pack's actions; the tool's enum is unchanged,
 * so not one prompt word is added). Each reads his own records only: the statements (spending.ts), the bills he showed HOME, the
 * subscriptions he listed, his payday and the goals and shared bills he keeps here. Plain sums (packages/shared/src/moneyplan.ts),
 * never a forecast; nothing pays, sends or reaches a bank.
 *
 *   safe       safe to spend until payday
 *   calendar   a month's days with what is due on each
 *   goals      his savings goals: list, add, put money in, take away
 *   household  shared bills: who owes whom, settle on a tap
 *   year       a year looked back on
 *   rules      his sorting rules with the count each files; change or take one away
 */
import type { Payday, Sub } from '../../../../packages/shared/src/money';
import { dueBetween, goalPlan, goalsAside, householdOwes, monthCalendar, safeToSpend, yearInMoney, type Goal, type HomeBillLike, type SharedBill } from '../../../../packages/shared/src/moneyplan';
import { addDays, pounds, shortId } from '../../../../packages/shared/src/packs';
import { findSubscriptions, isCategory, type Category, type SpendRow } from '../../../../packages/shared/src/spending';
import { load, save, todayOf, type ActionFn, type PackDeps } from '../packs/base';
import { fileMerchant } from '../spending';
import { arg } from './types';

/** His own keys in the brain: the money pack's (tools/money.ts) and the home pack's bills (tools/homeadmin.ts), read here. */
const KEYS = { payday: 'money:payday', subs: 'money:subs', bills: 'home:bills', goals: 'money:goals', household: 'money:household', spend: 'spend' } as const;
const MAX_GOALS = 24;
const MAX_SHARED = 300;

const dayOf = (a: Record<string, unknown>, d: PackDeps) => {
  const t = arg.str(a, 'today', false);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : todayOf(d);
};

async function rowsOf(d: PackDeps): Promise<SpendRow[]> {
  const idx = await load<{ months?: string[] }>(d, KEYS.spend, {});
  const months = idx.months ?? [];
  if (!months.length) return [];
  const got = await d.storage.get<SpendRow[]>(months.map((m) => `spend:m:${m}`));
  return months.flatMap((m) => got.get(`spend:m:${m}`) ?? []);
}

const safe: ActionFn = async (a, d) => {
  const today = dayOf(a, d);
  const [rule, rows, bills, listed, goals] = await Promise.all([load<Payday | null>(d, KEYS.payday, null), rowsOf(d), load<HomeBillLike[]>(d, KEYS.bills, []), load<Sub[]>(d, KEYS.subs, []), load<Goal[]>(d, KEYS.goals, [])]);
  if (!rule) return { text: 'Tell me your payday first, like “the 28th” or “the last Friday of the month”, and I work out what is safe to spend until then.', data: { payday: null, rows: rows.length } };
  const subs = findSubscriptions(rows);
  const first = safeToSpend(rows, subs, bills, listed, rule, today);
  const aside = goalsAside(goals, today, first.days);
  const s = aside ? safeToSpend(rows, subs, bills, listed, rule, today, aside) : first;
  const rowsSince = rows.filter((r) => r.d >= s.last && r.d <= today).length;
  return {
    text: `Safe to spend until payday (${s.payday}): ${pounds(s.safe)}, about ${pounds(s.perDay)} a day for ${s.days} day${s.days === 1 ? '' : 's'}. ${s.due.length} payment${s.due.length === 1 ? '' : 's'} still due before then: ${pounds(s.dueSum)}.`,
    data: { ...s, rowsSince, rows: rows.length },
  };
};

const calendar: ActionFn = async (a, d) => {
  const today = dayOf(a, d);
  const m = arg.str(a, 'month', false);
  const month = /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7);
  const [rule, rows, bills, listed] = await Promise.all([load<Payday | null>(d, KEYS.payday, null), rowsOf(d), load<HomeBillLike[]>(d, KEYS.bills, []), load<Sub[]>(d, KEYS.subs, [])]);
  const cal = monthCalendar(month, findSubscriptions(rows), bills, listed, rule, today);
  return { text: `${month}: ${pounds(cal.total)} due over ${cal.days.filter((x) => x.sum > 0).length} days.`, data: { month, ...cal, payday: !!rule, rows: rows.length } };
};

const goals: ActionFn = async (a, d) => {
  const today = dayOf(a, d);
  const op = arg.str(a, 'op', false);
  let list = await load<Goal[]>(d, KEYS.goals, []);
  let said = '';
  if (op === 'add') {
    const name = arg.str(a, 'name', false).trim().slice(0, 60);
    const target = Number(a.target);
    const by = arg.str(a, 'by', false);
    if (!name || !Number.isFinite(target) || target <= 0) throw new Error('give the goal a name and an amount, like “holiday” and 800');
    if (by && (!/^\d{4}-\d{2}-\d{2}$/.test(by) || by < today)) throw new Error('pick a date from today on');
    if (list.length >= MAX_GOALS) throw new Error(`you have ${MAX_GOALS} goals: finish or take one away first`);
    const g: Goal = { id: shortId(), name, target: Math.round(target * 100) / 100, saved: Math.max(0, Math.round((Number(a.saved) || 0) * 100) / 100), by, at: today };
    list = [...list, g];
    said = `Goal kept: ${g.name}, ${pounds(g.target)}${by ? ` by ${by}` : ''}.`;
  } else if (op === 'put' || op === 'take') {
    const g = list.find((x) => x.id === arg.str(a, 'id', false));
    const n = Number(a.amount);
    if (!g) throw new Error('that goal is not kept any more');
    if (!Number.isFinite(n) || n <= 0) throw new Error('type an amount, like 50');
    g.saved = Math.max(0, Math.round((g.saved + (op === 'put' ? n : -n)) * 100) / 100);
    said = `${g.name}: ${pounds(g.saved)} of ${pounds(g.target)} put aside.`;
  } else if (op === 'remove') {
    const g = list.find((x) => x.id === arg.str(a, 'id', false));
    if (!g) throw new Error('that goal is not kept any more');
    list = list.filter((x) => x.id !== g.id);
    said = `Goal taken away: ${g.name}.`;
  }
  if (op) await save(d, KEYS.goals, list);
  const plans = list.map((g) => ({ ...g, ...goalPlan(g, today) }));
  return { text: said || (list.length ? `${list.length} goal${list.length === 1 ? '' : 's'}.` : 'No goals yet.'), data: { goals: plans } };
};

const household: ActionFn = async (a, d) => {
  const today = dayOf(a, d);
  const op = arg.str(a, 'op', false);
  let list = await load<SharedBill[]>(d, KEYS.household, []);
  let said = '';
  const names = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split(/,|\band\b/)).map((x) => String(x).trim().slice(0, 30)).filter(Boolean);
  if (op === 'add') {
    const what = arg.str(a, 'what', false).trim().slice(0, 60);
    const amount = Number(a.amount);
    const paidBy = arg.str(a, 'paidBy', false).trim().slice(0, 30) || 'you';
    const shares = [...new Set(names(a.shares))];
    if (!what || !Number.isFinite(amount) || amount <= 0) throw new Error('say what the bill was and how much, like “electric” and 96');
    if (shares.length < 2) throw new Error('name at least two people sharing it, like “you, Sam and Jo”');
    if (!shares.includes(paidBy)) shares.unshift(paidBy);
    list = [...list, { id: shortId(), what, amount: Math.round(amount * 100) / 100, paidBy, shares, on: today }].slice(-MAX_SHARED);
    said = `Kept: ${what} ${pounds(amount)}, paid by ${paidBy}, shared by ${shares.join(', ')}.`;
  } else if (op === 'settle') {
    const open = list.filter((b) => !b.settled);
    for (const b of open) b.settled = today;
    said = open.length ? `Marked settled: ${open.length} shared bill${open.length === 1 ? '' : 's'}. Nothing was paid or sent: this is your word.` : 'Nothing left to settle.';
  } else if (op === 'remove') {
    const b = list.find((x) => x.id === arg.str(a, 'id', false));
    if (!b) throw new Error('that bill is not kept any more');
    list = list.filter((x) => x.id !== b.id);
    said = `Forgot the shared ${b.what} bill.`;
  }
  if (op) await save(d, KEYS.household, list);
  const owes = householdOwes(list);
  return { text: said || (owes.pay.length ? owes.pay.map((p) => `${p.from} owes ${p.to} ${pounds(p.amount)}`).join('; ') : 'All square.'), data: { bills: list.slice().reverse(), ...owes } };
};

const year: ActionFn = async (a, d) => {
  const today = dayOf(a, d);
  const rows = await rowsOf(d);
  const years = [...new Set(rows.map((r) => r.d.slice(0, 4)))].sort();
  const y = arg.str(a, 'year', false);
  const pick = /^\d{4}$/.test(y) && years.includes(y) ? y : years[years.length - 1] ?? today.slice(0, 4);
  const v = yearInMoney(rows, findSubscriptions(rows), pick);
  return { text: `${pick}: ${pounds(v.out)} out, ${pounds(v.in)} in.`, data: { year: pick, years, ...v, rows: rows.length } };
};

const rules: ActionFn = async (a, d) => {
  const op = arg.str(a, 'op', false);
  const k = arg.str(a, 'k', false);
  let said = '';
  if (op === 'change') {
    const c = arg.str(a, 'c', false);
    if (!k || !isCategory(c)) throw new Error('pick a category');
    const n = await fileMerchant(d.storage, k, c as Category);
    said = `Every ${k} goes to ${c} now: ${n} payment${n === 1 ? '' : 's'} filed.`;
  } else if (op === 'remove') {
    const idx = await load<{ rules?: Record<string, Category> }>(d, KEYS.spend, {});
    if (!idx.rules?.[k]) throw new Error('that rule is not kept any more');
    delete idx.rules[k];
    await save(d, KEYS.spend, idx);
    said = `Rule taken away: ${k}. The payments it filed stay where they are; the next statement sorts ${k} by the usual rules.`;
  }
  const idx = await load<{ rules?: Record<string, Category> }>(d, KEYS.spend, {});
  const rows = await rowsOf(d);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.k, (counts.get(r.k) ?? 0) + 1);
  const list = Object.entries(idx.rules ?? {}).map(([key, c]) => ({ k: key, c, n: counts.get(key) ?? 0 })).sort((x, y) => y.n - x.n || x.k.localeCompare(y.k));
  return { text: said || `${list.length} rule${list.length === 1 ? '' : 's'}.`, data: { rules: list } };
};

/** What is due in the next `days` days (the Brief's and the statement nudge's use; read only). */
export async function dueSoon(d: PackDeps, days = 7): Promise<{ on: string; name: string; amount: number }[]> {
  const today = todayOf(d);
  const [rows, bills, listed] = await Promise.all([rowsOf(d), load<HomeBillLike[]>(d, KEYS.bills, []), load<Sub[]>(d, KEYS.subs, [])]);
  return dueBetween(findSubscriptions(rows), bills, listed, today, addDays(today, days), today);
}

/** The money screen's own actions, joined to the money pack's for POST /packs/do (packs/index.ts); never in the tool's enum. */
export const MONEY_APP: Record<string, ActionFn> = { safe, calendar, goals, household, year, rules };
