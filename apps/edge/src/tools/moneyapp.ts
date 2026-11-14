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
import { meterSpans, spanCost, type MeterRead, type Tariff } from '../../../../packages/shared/src/moneyplan';
import { dueBetween, goalPlan, goalsAside, householdOwes, monthCalendar, safeToSpend, yearInMoney, type Goal, type HomeBillLike, type SharedBill } from '../../../../packages/shared/src/moneyplan';
import { addDays, addMonths, pounds, shortId } from '../../../../packages/shared/src/packs';
import { warrantyEnd } from '../../../../packages/shared/src/money';
import { addJob, loadJobs, removeJob } from '../schedule';
import { fromZoned } from '../time';
import { findSubscriptions, isCategory, type Category, type SpendRow } from '../../../../packages/shared/src/spending';
import { load, save, todayOf, type ActionFn, type PackDeps } from '../packs/base';
import { fileMerchant } from '../spending';
import { arg } from './types';

/** His own keys in the brain: the money pack's (tools/money.ts) and the home pack's bills (tools/homeadmin.ts), read here. */
const KEYS = { payday: 'money:payday', subs: 'money:subs', bills: 'home:bills', goals: 'money:goals', household: 'money:household', spend: 'spend', warranties: 'home:warranties', moneyWarranties: 'money:warranties', papers: 'home:papers', meters: 'home:meters', tariff: 'home:tariff' } as const;
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

const NUDGE = 'Add last month’s statement';
/** money.u8: a reminder on the 2nd of each month at 9am to add last month's statement, only when he turns it on (the brain's Web Push). */
const nudge: ActionFn = async (a, d) => {
  const op = arg.str(a, 'op', false);
  const today = dayOf(a, d);
  const mine = async () => (await loadJobs(d.storage)).filter((j) => j.kind === 'reminder' && j.title === NUDGE);
  if (op === 'off') for (const j of await mine()) await removeJob(d.storage, j.id);
  if (op === 'on' && !(await mine()).length) {
    const y = +today.slice(0, 4);
    const m = +today.slice(5, 7);
    const second = +today.slice(8, 10) < 2 ? `${today.slice(0, 7)}-02` : `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-02`;
    await addJob(d.storage, { kind: 'reminder', title: NUDGE, text: 'A new month: add last month’s statement on MONEY → Statement and every money page is up to date.', next: fromZoned(+second.slice(0, 4), +second.slice(5, 7), 2, 9, 0, d.tz), repeat: 'monthly', tz: d.tz }, d.now());
  }
  const jobs = await mine();
  const on = jobs.length > 0;
  return { text: op === 'on' ? 'I’ll remind you on the 2nd of each month at 9am to add last month’s statement.' : op === 'off' ? 'No more statement reminders.' : on ? 'The statement reminder is on.' : 'The statement reminder is off.', data: { on, next: on ? jobs[0]!.next : null } };
};

/** What is due in the next `days` days (the Brief's and the statement nudge's use; read only). */
export async function dueSoon(d: PackDeps, days = 7): Promise<{ on: string; name: string; amount: number }[]> {
  const today = todayOf(d);
  const [rows, bills, listed] = await Promise.all([rowsOf(d), load<HomeBillLike[]>(d, KEYS.bills, []), load<Sub[]>(d, KEYS.subs, [])]);
  return dueBetween(findSubscriptions(rows), bills, listed, today, addDays(today, days), today);
}

/** The money screen's own actions, joined to the money pack's for POST /packs/do (packs/index.ts); never in the tool's enum. */
export const MONEY_APP: Record<string, ActionFn> = { safe, calendar, goals, household, year, rules, nudge };

// ---------------------------------------------------------------- HOUSEHOLD → PAPERS: warranties and household papers (money.s1, money.s12)

interface Warr {
  id: string;
  thing: string;
  bought: string;
  months: number;
  ends: string;
  defaulted: boolean;
  store?: string;
  price?: number;
}
/** A household paper with a renewal date: a tenancy, an insurance, council tax, a licence, a contract. */
export interface Paper {
  id: string;
  what: string;
  kind: string;
  renews: string;
  note?: string;
  at: string;
}
export const PAPER_KINDS = ['tenancy', 'home insurance', 'car insurance', 'council tax', 'tv licence', 'passport', 'driving licence', 'boiler cover', 'phone contract', 'broadband contract', 'mortgage deal', 'other'] as const;
const MAX_PAPERS = 60;
const ymdOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** A 9am reminder on a day in his zone (the brain's Web Push sends it with the phone locked); false when the day has gone. */
async function remindOn(d: PackDeps, title: string, ymd: string, text: string): Promise<boolean> {
  const at = fromZoned(+ymd.slice(0, 4), +ymd.slice(5, 7), +ymd.slice(8, 10), 9, 0, d.tz);
  if (at < d.now() - 60_000) return false;
  if ((await loadJobs(d.storage)).some((j) => j.kind === 'reminder' && j.title === title && j.next === at)) return true;
  try {
    await addJob(d.storage, { kind: 'reminder', title, text, next: at, tz: d.tz }, d.now());
    return true;
  } catch {
    return false;
  }
}
async function unremind(d: PackDeps, title: string): Promise<void> {
  for (const j of (await loadJobs(d.storage)).filter((x) => x.kind === 'reminder' && x.title === title)) await removeJob(d.storage, j.id);
}

const papers: ActionFn = async (a, d) => {
  const today = dayOf(a, d);
  const op = arg.str(a, 'op', false);
  let warr = await load<Warr[]>(d, KEYS.warranties, []);
  let list = await load<Paper[]>(d, KEYS.papers, []);
  let said = '';
  if (op === 'warranty') {
    const thing = arg.str(a, 'thing', false).trim().slice(0, 40);
    const bought = arg.str(a, 'bought', false) || today;
    const months = Math.round(Number(a.months));
    const price = Number(a.price);
    if (!thing) throw new Error('say what it is, like “washing machine”');
    if (!ymdOk(bought) || bought > today) throw new Error('pick the day you bought it, today or before');
    if (!Number.isFinite(months) || months < 1 || months > 240) throw new Error('say how many months the warranty runs, like 24');
    const ends = warrantyEnd(bought, months);
    const store = arg.str(a, 'store', false).trim().slice(0, 40);
    const w: Warr = { id: shortId(), thing, bought, months, ends, defaulted: false, ...(store ? { store } : {}), ...(Number.isFinite(price) && price > 0 ? { price: Math.round(price * 100) / 100 } : {}) };
    warr = [...warr.filter((x) => x.thing.toLowerCase() !== thing.toLowerCase()), w].slice(-80);
    await save(d, KEYS.warranties, warr);
    const remind = addMonths(ends, -1) > today ? addMonths(ends, -1) : addDays(today, 1);
    const armed = ends >= today && (await remindOn(d, `Warranty ends: ${thing}`, remind, `The ${thing}’s warranty ends ${ends}: anything wrong with it, claim now.`));
    said = ends < today ? `Kept: the ${thing}. Its warranty ended on ${ends}.` : `Kept: the ${thing}, warranty to ${ends}.${armed ? ` I’ll remind you on ${remind} at 9am.` : ''}`;
    a = { ...a, id: w.id };
  } else if (op === 'forgetWarranty') {
    const w = warr.find((x) => x.id === arg.str(a, 'id', false));
    if (!w) throw new Error('that warranty is not kept any more');
    warr = warr.filter((x) => x.id !== w.id);
    await save(d, KEYS.warranties, warr);
    await unremind(d, `Warranty ends: ${w.thing}`);
    said = `Forgot the ${w.thing} warranty, and its reminder.`;
  } else if (op === 'paper') {
    const what = arg.str(a, 'what', false).trim().slice(0, 50);
    const kind = (PAPER_KINDS as readonly string[]).includes(arg.str(a, 'kind', false)) ? arg.str(a, 'kind', false) : 'other';
    const renews = arg.str(a, 'renews', false);
    if (!what) throw new Error('say what the paper is, like “house insurance with Aviva”');
    if (!ymdOk(renews)) throw new Error('pick the day it renews or ends');
    if (list.length >= MAX_PAPERS) throw new Error(`you keep ${MAX_PAPERS} papers: forget one first`);
    const p: Paper = { id: shortId(), what, kind, renews, at: today, ...(arg.str(a, 'note', false).trim() ? { note: arg.str(a, 'note', false).trim().slice(0, 200) } : {}) };
    list = [...list, p];
    await save(d, KEYS.papers, list);
    let n = 0;
    for (const [days, when] of [[30, 'in a month'], [7, 'in a week']] as const) {
      const on = addDays(renews, -days);
      if (on > today && (await remindOn(d, `Renews: ${what}`, on, `${what} renews or ends ${when}, on ${renews}: time to check it and compare.`))) n++;
    }
    said = `Kept: ${what}, renews ${renews}.${n ? ` I’ll remind you ${n === 2 ? 'a month and a week' : 'a week'} before, at 9am.` : ''}`;
  } else if (op === 'forgetPaper') {
    const p = list.find((x) => x.id === arg.str(a, 'id', false));
    if (!p) throw new Error('that paper is not kept any more');
    list = list.filter((x) => x.id !== p.id);
    await save(d, KEYS.papers, list);
    await unremind(d, `Renews: ${p.what}`);
    said = `Forgot ${p.what}, and its reminders.`;
  }
  const money = await load<{ id?: string; thing: string; bought: string; months: number; ends: string }[]>(d, KEYS.moneyWarranties, []);
  const all = [...warr.map((w) => ({ ...w, from: 'home' })), ...money.map((w, i) => ({ id: w.id ?? `m${i}`, thing: w.thing, bought: w.bought, months: w.months, ends: w.ends, defaulted: false, from: 'chat' }))].sort((x, y) => x.ends.localeCompare(y.ends));
  return { text: said || `${all.length} warrant${all.length === 1 ? 'y' : 'ies'}, ${list.length} paper${list.length === 1 ? '' : 's'}.`, data: { warranties: all, papers: [...list].sort((x, y) => x.renews.localeCompare(y.renews)), kinds: PAPER_KINDS, id: a.id ?? null } };
};

/** money.u12: the use between his meter readings and a first estimate of its cost on the tariff he gave; set the tariff (op tariff). */
const energy: ActionFn = async (a, d) => {
  const op = arg.str(a, 'op', false);
  const tariffs = await load<Record<string, Tariff>>(d, KEYS.tariff, {});
  let said = '';
  if (op === 'tariff') {
    const kind = arg.str(a, 'kind', false);
    const unit = Number(a.unit);
    const standing = Number(a.standing ?? 0);
    if (!['electricity', 'gas', 'water'].includes(kind)) throw new Error('pick the meter');
    if (!Number.isFinite(unit) || unit <= 0 || unit > 500) throw new Error('type the price of a unit in pence, like 24.5');
    if (!Number.isFinite(standing) || standing < 0 || standing > 500) throw new Error('type the standing charge in pence a day, like 60, or 0');
    tariffs[kind] = { unit: Math.round(unit * 100) / 100, standing: Math.round(standing * 100) / 100 };
    await save(d, KEYS.tariff, tariffs);
    said = `Tariff kept for ${kind}: ${tariffs[kind]!.unit}p a unit and ${tariffs[kind]!.standing}p a day.`;
  }
  const meters = await load<Record<string, MeterRead[]>>(d, KEYS.meters, {});
  const kinds = Object.fromEntries(Object.entries(meters).map(([kind, reads]) => {
    const spans = meterSpans(reads);
    const t = tariffs[kind];
    return [kind, { reads: reads.length, last: reads[reads.length - 1] ?? null, tariff: t ?? null, spans: spans.map((x) => ({ ...x, ...(t ? { cost: spanCost(x, t) } : {}) })) }];
  }));
  return { text: said || `${Object.keys(kinds).length} meter${Object.keys(kinds).length === 1 ? '' : 's'}.`, data: { kinds, tariffs } };
};

/** The HOUSEHOLD screen's own keys, joined to the home pack's for POST /packs/do (packs/index.ts); never in the tool's enum. */
export const HOME_APP: Record<string, ActionFn> = { papers, energy };

// ---------------------------------------------------------------- WORK → JOBS: his job applications (money.s8)

export const JOB_STAGES = ['applied', 'interview', 'offer', 'rejected', 'withdrawn'] as const;
interface JobApp {
  id: string;
  role: string;
  where: string;
  applied: string;
  stage: (typeof JOB_STAGES)[number];
  follow?: string;
  note?: string;
  at: string;
}
const JOBS = 'work:jobs';
/** Each job he applied for: the role, where, the day, its stage, and a 9am reminder to follow up on the day he picks. */
const jobs: ActionFn = async (a, d) => {
  const today = dayOf(a, d);
  const op = arg.str(a, 'op', false);
  let list = await load<JobApp[]>(d, JOBS, []);
  let said = '';
  const title = (j: JobApp) => `Follow up: ${j.role}${j.where ? ` at ${j.where}` : ''}`;
  const arm = async (j: JobApp) => {
    await unremind(d, title(j));
    return j.follow && j.follow >= today && !['rejected', 'withdrawn', 'offer'].includes(j.stage) ? remindOn(d, title(j), j.follow, `Follow up on ${j.role}${j.where ? ` at ${j.where}` : ''}: applied ${j.applied}, at the ${j.stage} stage.`) : false;
  };
  if (op === 'add') {
    const role = arg.str(a, 'role', false).trim().slice(0, 60);
    const where = arg.str(a, 'where', false).trim().slice(0, 60);
    const applied = arg.str(a, 'applied', false) || today;
    const follow = arg.str(a, 'follow', false);
    if (!role) throw new Error('say the role first, like “warehouse supervisor”');
    if (!ymdOk(applied) || applied > today) throw new Error('pick the day you applied, today or before');
    if (follow && (!ymdOk(follow) || follow < today)) throw new Error('pick a follow-up day from today on');
    const j: JobApp = { id: shortId(), role, where, applied, stage: 'applied', at: today, ...(follow ? { follow } : {}) };
    list = [j, ...list].slice(0, 120);
    const armed = await arm(j);
    said = `Kept: ${role}${where ? ` at ${where}` : ''}, applied ${applied}.${armed ? ` I’ll remind you to follow up on ${follow} at 9am.` : ''}`;
  } else if (op === 'stage' || op === 'follow' || op === 'remove') {
    const j = list.find((x) => x.id === arg.str(a, 'id', false));
    if (!j) throw new Error('that application is not kept any more');
    if (op === 'remove') {
      list = list.filter((x) => x !== j);
      await unremind(d, title(j));
      said = `Forgot ${j.role}.`;
    } else if (op === 'stage') {
      const st = arg.str(a, 'stage', false);
      if (!(JOB_STAGES as readonly string[]).includes(st)) throw new Error('pick a stage');
      j.stage = st as JobApp['stage'];
      await arm(j);
      said = `${j.role}: ${st}.`;
    } else {
      const f = arg.str(a, 'follow', false);
      if (!ymdOk(f) || f < today) throw new Error('pick a follow-up day from today on');
      j.follow = f;
      said = (await arm(j)) ? `I’ll remind you to follow up on ${j.role} on ${f} at 9am.` : `Follow-up day kept: ${f}.`;
    }
  }
  if (op) await save(d, JOBS, list);
  const open = list.filter((j) => !['rejected', 'withdrawn'].includes(j.stage));
  return { text: said || `${list.length} application${list.length === 1 ? '' : 's'}, ${open.length} still open.`, data: { jobs: list, stages: JOB_STAGES } };
};

/** The WORK screen's own keys, joined to the work pack's for POST /packs/do (packs/index.ts); never in the tool's enum. */
export const WORK_APP: Record<string, ActionFn> = { jobs };
