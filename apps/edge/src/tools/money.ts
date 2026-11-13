/**
 * THE MONEY PACK (BRIEF-PACKS-1 item 1; OWNER-ISSUES 92 ④): ONE tool, `money`, its abilities an `action` enum —
 * described in full only when his words turn the group on, named "money pack" otherwise (tools/index.ts). Kept in his
 * brain only: what he says he spent, his price watches, the subscriptions he lists, his payday, his warranties. Read in
 * code: his statements (spending.ts; a statement pasted in the chat is read on the phone's way in, never by a model),
 * the fuel retailers' own open price feeds near ONE of his saved places (never where he is), a page's price. No bank,
 * no account, nothing that bills. The pure parts: packages/shared/src/money.ts.
 */
import { card } from '../../../../packages/shared/src/cards';
import {
  advance,
  cheapestNear,
  dropped,
  FUEL_FEEDS,
  FUEL_NAMES,
  fuelCard,
  fuelOf,
  fuelWords,
  monthCard,
  monthlyOf,
  monthWords,
  nextPayday,
  pageLabel,
  parsePayday,
  parseSpent,
  parseSub,
  parseWarranty,
  paydayLine,
  paydayRuleWords,
  priceOf,
  readFuelFeed,
  roundUps,
  splitBill,
  subsWords,
  tripCost,
  warrantyEnd,
  watchCard,
  weekOf,
  weekWords,
  whatIf,
  whatIfWords,
  type Payday,
  type Spent,
  type Station,
  type Sub,
  type Watch,
} from '../../../../packages/shared/src/money';
import { addDays, daysBetween, listWords, moneyIn, pounds, prettyDay, shortId } from '../../../../packages/shared/src/packs';
import { monthName } from '../../../../packages/shared/src/spending';
import { getJson, getText, load, packTool, save, todayOf, wordsOf, type ActionFn, type PackDeps } from '../packs/base';
import { notSavedYet, savedPlace } from '../places';
import { addJob, loadJobs, removeJob } from '../schedule';
import { monthMoves, spendingSummary } from '../spending';
import { fromZoned } from '../time';
import { arg, type Tool } from './types';

export const MONEY_KEYS = { spent: 'money:spent', watches: 'money:watches', subs: 'money:subs', payday: 'money:payday', warranties: 'money:warranties' } as const;
const MAX_SPENT = 500;
const MAX_WATCHES = 20;

/** When the group is described in full: his words about money. */
export const MONEY_WHEN =
  /\b(budgets?|spent|spend|spending|money|fuel|petrol|diesel|unleaded|prices?|cheaper|price (?:drop|watch)|watch (?:the |this |that )?price|subscriptions?|renews?|renewal|split|round ?ups?|pay ?day|paid on the|what if i (?:save|put)|save \d|savings?|warrant(?:y|ies)|guarantee|statements?|mpg|trip cost|cost to drive)\b/i;
export const MONEY_ABOUT =
  'You can keep his money (money: month, spent, week, fuel, trip, watch, unwatch, subs, split, roundup, payday, whatif, warranty): fuel near a SAVED place only; no bank, nothing billed.';

// ---------------------------------------------------------------- the actions

const month: ActionFn = async (a, d) => {
  const s = await spendingSummary(d.storage, arg.str(a, 'month', false) || null);
  if (!s.kept || !s.view) return { text: 'No statement yet. Paste one in the chat (its CSV, or the text copied out of the PDF) or add it in Agenda → SPENDING: I read it in code and keep it in your brain only.' };
  const { moves, hadBefore } = await monthMoves(d.storage, s.month);
  const budgets = s.budgets.length ? ` Budgets: ${s.budgets.map((b) => `${b.category} ${b.line}`).join('; ')}.` : '';
  return { text: `${monthWords(s.view, moves, hadBefore)}${budgets} From the statements you added; no bank access.`, cards: [monthCard(s.view, moves, d.now())] };
};

const spent: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const list = await load<Spent[]>(d, MONEY_KEYS.spent, []);
  if (/^(undo|take (?:that|it) back|remove (?:that|the last)|scrap that|not that)\b/i.test(words)) {
    const gone = list.pop();
    if (!gone) return { text: 'Nothing to take back: you haven’t told me anything you spent.' };
    await save(d, MONEY_KEYS.spent, list);
    return { text: `Taken back: ${pounds(gone.a)} on ${gone.what}. ${weekWords(weekOf(list, today))}` };
  }
  const s = parseSpent(words, today);
  if (!s) return { text: 'Say how much and on what, like "spent 12 on lunch".' };
  list.push({ at: d.now(), ...s });
  await save(d, MONEY_KEYS.spent, list.slice(-MAX_SPENT));
  const w = weekOf(list, today);
  return {
    text: `Kept: ${pounds(s.a)} on ${s.what} (${s.c}${s.d !== today ? `, ${prettyDay(s.d)}` : ''}). This week so far: ${pounds(w.total)}. Say "undo that" to take it back.`,
    cards: [card({ id: `money:spent:${w.from}`, kind: 'brief', at: d.now(), title: `This week ${pounds(w.total)}`, line: `${pounds(s.a)} on ${s.what} kept · ${w.n} thing${w.n === 1 ? '' : 's'} since Monday`, brief: { icon: 'diary' }, acts: [{ label: 'UNDO', run: { name: 'packs_do', args: { pack: 'money', action: 'spent', args: { words: 'undo' } } } }] })],
  };
};

const week: ActionFn = async (_a, d) => {
  const w = weekOf(await load<Spent[]>(d, MONEY_KEYS.spent, []), todayOf(d));
  return {
    text: weekWords(w),
    cards: w.n ? [card({ id: `money:week:${w.from}`, kind: 'brief', at: d.now(), title: `This week ${pounds(w.total)}`, line: w.cats.slice(0, 4).map((x) => `${x.c} ${pounds(x.a)}`).join(' · '), brief: { icon: 'diary' } })] : [],
  };
};

/** Every retailer's feed, read once per half hour in this brain (they change a few times a day). */
let feedCache: { at: number; stations: Station[]; answered: number } | null = null;
async function allStations(d: PackDeps): Promise<{ stations: Station[]; answered: number }> {
  if (feedCache && d.now() - feedCache.at < 30 * 60_000) return feedCache;
  const got = await Promise.allSettled(FUEL_FEEDS.map(async (f) => readFuelFeed(await getJson(d, f.url, 4_000_000, 9000), f.brand)));
  const stations = got.flatMap((g) => (g.status === 'fulfilled' ? g.value : []));
  const answered = got.filter((g) => g.status === 'fulfilled' && g.value.length).length;
  feedCache = answered ? { at: d.now(), stations, answered } : null;
  return { stations, answered };
}
/** The tests read the feeds afresh each time. */
export const forgetFuel = (): void => void (feedCache = null);

const fuel: ActionFn = async (a, d) => {
  const words = `${arg.str(a, 'place', false)} ${wordsOf(a)}`.trim();
  const placeWords = arg.str(a, 'place', false) || words.replace(/\b(cheapest|cheap|fuel|petrol|diesel|unleaded|super|prices?|near|nearest|by|at|around|to|the|my|in|where'?s|what'?s|is|for)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const place = placeWords ? await savedPlace(d.storage, placeWords) : null;
  if (!place) return { text: `${(placeWords && notSavedYet(placeWords)) || `I only look near a place you've saved${placeWords ? ` — "${placeWords}" isn't one yet` : ''}. Save it first (say "Dad's address is …"); I never use where you are.`}` };
  const f = fuelOf(words);
  const { stations, answered } = await allStations(d);
  if (!answered) return { text: 'None of the fuel retailers’ price feeds answered just now. Try again in a few minutes.' };
  const r = cheapestNear(stations, place, f, todayOf(d));
  const c = fuelCard(place.label, f, r, d.now());
  return { text: fuelWords(place.label, f, r, answered, FUEL_FEEDS.length), cards: c ? [c] : [] };
};

const trip: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const miles = Number(/(\d+(?:\.\d+)?)\s*(?:miles?|mi)\b/i.exec(words)?.[1] ?? NaN);
  const km = Number(/(\d+(?:\.\d+)?)\s*(?:km|kilomet(?:re|er)s?)\b/i.exec(words)?.[1] ?? NaN);
  const dist = Number.isFinite(miles) ? miles : Number.isFinite(km) ? km / 1.609344 : NaN;
  const mpg = Number(/(\d+(?:\.\d+)?)\s*mpg\b/i.exec(words)?.[1] ?? NaN);
  if (!Number.isFinite(dist) || !Number.isFinite(mpg) || mpg <= 0) return { text: 'Say the miles and the car’s miles per gallon, like "120 miles at 45 mpg" (and the price a litre if you know it).' };
  const f = fuelOf(words);
  let pence = Number(/(\d{2,3}(?:\.\d)?)\s*p\b/i.exec(words)?.[1] ?? NaN);
  let from = 'the price you gave';
  if (!Number.isFinite(pence)) {
    const { stations, answered } = await allStations(d);
    const today = todayOf(d);
    const fresh = stations.filter((s) => s.prices[f] !== undefined && !(s.updated && daysBetween(s.updated, today) > 7)).map((s) => s.prices[f]!);
    if (!answered || !fresh.length) return { text: 'I couldn’t read today’s fuel prices just now: tell me the price a litre ("at 150p") and I’ll work it out.' };
    pence = Math.round((fresh.reduce((k, p) => k + p, 0) / fresh.length) * 10) / 10;
    from = `the average of ${fresh.length} stations’ ${FUEL_NAMES[f]} prices in the retailers’ feeds today`;
  }
  const t = tripCost(dist, mpg, pence);
  return { text: `${Math.round(dist)} miles at ${mpg} mpg is about ${t.litres} litres: ${pounds(t.cost)} at ${pence}p a litre (${from}). Assumed: UK gallons (4.546 litres), the car’s mpg as you said it, one way.` };
};

async function ensureFollowJob(d: PackDeps): Promise<void> {
  if ((await loadJobs(d.storage)).some((j) => j.kind === 'follow')) return;
  await addJob(d.storage, { kind: 'follow', title: 'Price watch', text: 'The pages you asked me to watch: I look twice a day and tell you when a price drops (money pack).', next: d.now() + 12 * 3_600_000, tz: d.tz }, d.now());
}

const watch: ActionFn = async (a, d) => {
  const url = arg.str(a, 'url', false).trim() || (/https?:\/\/\S+/.exec(wordsOf(a))?.[0] ?? '');
  const list = await load<Watch[]>(d, MONEY_KEYS.watches, []);
  if (!url) return { text: list.length ? `Watching ${list.length}: ${list.map((w) => `${w.label} ${pounds(w.last)} (from ${pounds(w.first)})`).join('; ')}.` : 'Not watching any prices. Send me a product page and say "watch the price".' };
  if (!/^https:\/\//i.test(url)) return { text: 'Send the page’s full https:// address and I’ll watch it.' };
  if (list.length >= MAX_WATCHES) return { text: `I’m watching ${MAX_WATCHES} pages already: stop one first.` };
  let html: string;
  try {
    html = await getText(d, url);
  } catch (e) {
    return { text: `I couldn’t read that page (${(e as Error).message}). Some shops block readers like me; try the product’s own page.` };
  }
  const p = priceOf(html);
  if (!p) return { text: 'I couldn’t find a price on that page, so there is nothing to watch. Try the product’s own page.' };
  const w: Watch = { id: shortId(), url, label: pageLabel(html, url), first: p.price, last: p.price, told: p.price, how: p.how, at: d.now(), checked: d.now() };
  await save(d, MONEY_KEYS.watches, [...list.filter((x) => x.url !== url), w]);
  await ensureFollowJob(d);
  return { text: `Watching ${w.label}: ${pounds(w.last)} now (read from ${p.how}). I look twice a day and tell you when it drops. UNDO stops it.`, cards: [watchCard(w, 'set', d.now())] };
};

const unwatch: ActionFn = async (a, d) => {
  const id = arg.str(a, 'id', false);
  const words = wordsOf(a).toLowerCase();
  const list = await load<Watch[]>(d, MONEY_KEYS.watches, []);
  const w = list.find((x) => x.id === id) ?? list.find((x) => words && (x.label.toLowerCase().includes(words) || words.includes(x.label.toLowerCase().split(' ')[0]!))) ?? (list.length === 1 ? list[0] : undefined);
  if (!w) return { text: list.length ? `Which one? ${list.map((x) => x.label).join('; ')}.` : 'Not watching any prices.' };
  const left = list.filter((x) => x.id !== w.id);
  await save(d, MONEY_KEYS.watches, left);
  if (!left.length) for (const j of (await loadJobs(d.storage)).filter((j) => j.kind === 'follow')) await removeJob(d.storage, j.id);
  return { text: `Stopped watching ${w.label} (it was ${pounds(w.last)}).` };
};

/** The follow job's look (agent.ts): each watched page read again; a drop told once, with its card. Returns the next look. */
export async function followTick(d: PackDeps, tell: (title: string, text: string, c: ReturnType<typeof watchCard>) => Promise<unknown>): Promise<number> {
  const list = await load<Watch[]>(d, MONEY_KEYS.watches, []);
  for (const w of list) {
    try {
      const p = priceOf(await getText(d, w.url));
      w.checked = d.now();
      if (!p) continue;
      w.last = p.price;
      if (dropped(w, p.price)) {
        await tell('Price dropped', `${w.label} is ${pounds(p.price)} now, down from ${pounds(w.told)}: ${w.url}`, watchCard(w, 'drop', d.now()));
        w.told = p.price;
      } else if (p.price > w.told) w.told = Math.max(w.told, Math.min(p.price, w.first));
    } catch {
      /* a page that did not answer: next time */
    }
  }
  await save(d, MONEY_KEYS.watches, list);
  return d.now() + 12 * 3_600_000;
}

const subs: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  let list = await load<Sub[]>(d, MONEY_KEYS.subs, []);
  const drop = /^(?:drop|cancel(?:led)?|remove|stop|delete|no more)\s+(.+)$/i.exec(words);
  if (drop) {
    const name = drop[1]!.replace(/\b(my|the|subscription|sub)\b/gi, '').trim().toLowerCase();
    const gone = list.find((s) => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase()));
    if (!gone) return { text: `No subscription called "${name}" on your list.` };
    list = list.filter((s) => s.id !== gone.id);
    await save(d, MONEY_KEYS.subs, list);
    return { text: `Taken off: ${gone.name}. ${subsWords(list, today)} (Cancel it with the company itself: I never touch your accounts.)` };
  }
  if (words && moneyIn(words) !== null) {
    const s = parseSub(words, today);
    if (!s) return { text: 'Say the name, the price and how often, like "Netflix £10.99 a month on the 14th".' };
    list = [...list.filter((x) => x.name.toLowerCase() !== s.name.toLowerCase()), { id: shortId(), ...s }];
    await save(d, MONEY_KEYS.subs, list);
  }
  const total = list.reduce((k, s) => k + monthlyOf(s), 0);
  const next = [...list].map((s) => ({ ...s, next: rollOn(s, today) })).sort((x, y) => (x.next < y.next ? -1 : 1))[0];
  return {
    text: subsWords(list, today),
    cards: list.length ? [card({ id: 'money:subs', kind: 'brief', at: d.now(), title: `Subscriptions ${pounds(Math.round(total * 100) / 100)} a month`, line: next ? `Next: ${next.name} ${pounds(next.amount)} on ${prettyDay(next.next)} · ${list.length} listed` : `${list.length} listed`, brief: { icon: 'diary' } })] : [],
  };
};
const rollOn = (s: Sub, today: string) => {
  let n = s.next;
  while (n < today) n = advance({ every: s.every, next: n });
  return n;
};

const split: ActionFn = async (a, d) => {
  void d;
  const words = wordsOf(a);
  const total = moneyIn(words.replace(/\d+(?:\.\d+)?\s?%/g, ' '));
  const tip = Number(/(\d+(?:\.\d+)?)\s?%/.exec(words)?.[1] ?? 0);
  const who = /\b(?:between|with|among|amongst)\s+(.+?)(?:\s+(?:with|plus|and a|inc(?:luding)?)\s+(?:a\s+)?\d+(?:\.\d+)?\s?%.*)?$/i.exec(words)?.[1] ?? '';
  let names = listWords(who.replace(/\b(?:us|of us)\b/gi, '')).filter((n) => !/^\d+$/.test(n));
  const count = /\b(\d+|two|three|four|five|six|seven|eight)\s+(?:ways?|people|of us)\b/i.exec(words)?.[1];
  if (!names.length && count) names = Array.from({ length: Number(count) || ['two', 'three', 'four', 'five', 'six', 'seven', 'eight'].indexOf(count.toLowerCase()) + 2 }, (_, i) => `person ${i + 1}`);
  if (/\bwith\b/i.test(words) && names.length && !names.some((n) => /^(me|i|myself)$/i.test(n))) names = ['you', ...names];
  if (total === null || names.length < 2) return { text: 'Say the bill and the names, like "split £84 between me, Ali and Sam with a 10% tip".' };
  const parts = splitBill(total, names.map((n) => (/^(me|i|myself)$/i.test(n) ? 'you' : n)), tip);
  const sum = parts.reduce((k, p) => k + p.owes, 0);
  return { text: `${pounds(total)}${tip ? ` with a ${tip}% tip is ${pounds(Math.round(sum * 100) / 100)}` : ''}: ${parts.map((p) => `${p.name} ${pounds(p.owes)}`).join(', ')}. To the penny${parts.some((p, i) => i && p.owes !== parts[0]!.owes) ? ': the odd pennies go to the first names' : ''}.` };
};

const roundup: ActionFn = async (a, d) => {
  const s = await spendingSummary(d.storage, arg.str(a, 'month', false) || null);
  if (!s.kept || !s.view) return { text: 'Round-ups come from your statements: paste one in the chat or add it in Agenda → SPENDING first.' };
  const r = roundUps(s.rows, s.month);
  return { text: `Rounding every payment up to the next pound in ${monthName(s.month)} would have put aside ${pounds(r.total)} (from ${r.n} payments) — about ${pounds(Math.round(r.total * 12))} a year at that rate. Assumed: every payment out that wasn’t a whole pound. Only a suggestion: nothing moves anywhere; your bank’s own round-up or a standing order would do it.` };
};

const payday: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  if (/^(?:forget|remove|clear|stop)\b/i.test(words)) {
    await d.storage.delete(MONEY_KEYS.payday);
    return { text: 'Payday forgotten: the Brief stops showing it.' };
  }
  if (words) {
    const rule = parsePayday(words);
    if (!rule) return { text: 'Say the day, like "the 28th" or "the last Friday of the month".' };
    await save(d, MONEY_KEYS.payday, rule);
    return { text: `Payday kept: ${paydayRuleWords(rule)}. Next: ${prettyDay(nextPayday(rule, today))}. It shows in the Brief.` };
  }
  const rule = await load<Payday | null>(d, MONEY_KEYS.payday, null);
  return { text: rule ? `${paydayLine(rule, today)}. (${paydayRuleWords(rule)})` : 'No payday set. Say "payday is the 28th" and the Brief counts down to it.' };
};

const whatif: ActionFn = async (a) => {
  const w = whatIf(wordsOf(a));
  return { text: w ? whatIfWords(w) : 'Say the amount and how often, like "if I save £50 a week" (and a rate, "at 4%", if it earns interest).' };
};

interface Warranty {
  id: string;
  thing: string;
  bought: string;
  months: number;
  ends: string;
}
const warranty: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const list = await load<Warranty[]>(d, MONEY_KEYS.warranties, []);
  if (!words) return { text: list.length ? `Warranties: ${list.map((w) => `${w.thing} until ${prettyDay(w.ends, today.slice(0, 4))}`).join('; ')}.` : 'No warranties kept. Say "washing machine bought 3 March 2025 with a 2 year warranty".' };
  const p = parseWarranty(words, today);
  if (!p) return { text: 'Say what it is, when you bought it and how long the warranty is, like "TV bought 3 March 2025, 2 years".' };
  const ends = warrantyEnd(p.bought, p.months);
  const w: Warranty = { id: shortId(), ...p, ends };
  await save(d, MONEY_KEYS.warranties, [...list.filter((x) => x.thing.toLowerCase() !== w.thing.toLowerCase()), w].slice(-60));
  if (ends < today) return { text: `The ${w.thing}’s warranty ended ${prettyDay(ends, today.slice(0, 4))} (bought ${prettyDay(p.bought, today.slice(0, 4))}, ${p.months} months). Kept on your list anyway.` };
  const remind = addDays(ends, -14) > today ? addDays(ends, -14) : addDays(today, 1);
  const at = fromZoned(+remind.slice(0, 4), +remind.slice(5, 7), +remind.slice(8, 10), 9, 0, d.tz);
  await addJob(d.storage, { kind: 'reminder', title: `Warranty: ${w.thing}`, text: `The ${w.thing}’s warranty ends ${prettyDay(ends, remind.slice(0, 4))} (bought ${prettyDay(p.bought)}, ${p.months} months): anything wrong with it, claim now.`, next: at, tz: d.tz }, d.now());
  return { text: `Kept: the ${w.thing}, bought ${prettyDay(p.bought, today.slice(0, 4))}, ${p.months}-month warranty — it ends ${prettyDay(ends, today.slice(0, 4))}. I’ll remind you on ${prettyDay(remind, today.slice(0, 4))} at 9am (it’s in your Agenda). Assumed: it ends the day before the same date ${p.months} months on.` };
};

export const MONEY: Record<string, ActionFn> = { month, spent, week, fuel, trip, watch, unwatch, subs, split, roundup, payday, whatif, warranty };
export const MONEY_ACTIONS = Object.keys(MONEY);

export const moneyTools: Tool[] = [
  packTool({
    name: 'money',
    description:
      "His money pack (no bank, nothing billed). month: the month's picture from his statements (top five, what changed). spent: keep what he says he spent (words; \"undo\" takes the last back). week: this week's, from what he told. fuel: the cheapest three near a SAVED place (place; words may say diesel). trip: a drive's fuel cost (words: miles, mpg). watch: follow a page's price (url), told when it drops; no url lists them; unwatch (id or words). subs: list, add (\"Netflix 10.99 a month on the 14th\"), \"drop Netflix\". split: a bill between names (words). roundup: from the statements. payday: set (words) or say the next. whatif: savings (words). warranty: thing, date bought, months → a reminder.",
    actions: MONEY,
    properties: {
      words: { type: 'string', description: 'his words for it, as he said them' },
      place: { type: 'string', description: 'fuel: a saved place ("dad", "home")' },
      url: { type: 'string', description: 'watch: the product page' },
      id: { type: 'string', description: 'unwatch: which watch' },
      month: { type: 'string', description: 'month, roundup: YYYY-MM (default the latest)' },
    },
    reads: ['month', 'week', 'fuel', 'trip', 'split', 'roundup', 'whatif'],
  }),
];

/** The Brief's money lines (mind.ts): payday, a subscription renewing tomorrow, a warranty ending within the fortnight. */
export async function moneyLines(d: PackDeps): Promise<string[]> {
  const today = todayOf(d);
  const out: string[] = [];
  const rule = await load<Payday | null>(d, MONEY_KEYS.payday, null);
  if (rule) out.push(paydayLine(rule, today));
  for (const s of await load<Sub[]>(d, MONEY_KEYS.subs, [])) if (rollOn(s, today) === addDays(today, 1)) out.push(`${s.name} renews tomorrow (${pounds(s.amount)})`);
  for (const w of await load<Warranty[]>(d, MONEY_KEYS.warranties, [])) {
    const n = daysBetween(today, w.ends);
    if (n >= 0 && n <= 14) out.push(`The ${w.thing}’s warranty ends ${n === 0 ? 'today' : `in ${n} day${n === 1 ? '' : 's'}`}`);
  }
  return out;
}
