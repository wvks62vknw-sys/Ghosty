/**
 * THE HOME PACK (BRIEF-PACKS-3; OWNER-ISSUES 92 ④): ONE tool, `home`, its abilities an `action` enum — described in full only
 * when his words turn the group on (named "homeadmin" in tools/index.ts, because a group called "home" is the furniture
 * finder), "home pack" otherwise. The admin of a house from HIS papers and words, and public sources only: a bill read from the
 * text of a photo (supplier, amount, day, period), warranties, the maker's own manual page as a link, the family cars' renewals
 * (read from the car batch, nothing re-fetched), bin days (alternating weeks, moves, bank holidays), planning applications near
 * home (planning.data.gov.uk where it covers him, else his council said plainly), meter readings, the rent or mortgage day,
 * what repeats on his statements, a room's things as CSV, the house's address book, his council tax band and his own
 * registration, a boiler or smoke-alarm service. Nothing about any person; nothing bills; every write waits for him.
 * The pure parts: packages/shared/src/homeadmin.ts.
 */
import { card, carName } from '../../../../packages/shared/src/cards';
import {
  BAND_RATIOS,
  bandWords,
  billLine,
  billTotal,
  binDays,
  BIN_WORDS,
  circleWkt,
  constraintsAt,
  COUNCIL_TAX_LOOKUP,
  councilOf,
  datesIn,
  emptyBins,
  entryLine,
  FIND_COUNCIL,
  insuranceNext,
  inventoryCsv,
  meterUsage,
  needsAnchor,
  parseBand,
  parseBinDates,
  parseBins,
  parseEntry,
  parseMove,
  parsePlanning,
  parseRent,
  parseService,
  parseThings,
  radiusFrom,
  readBill,
  readMeter,
  readReceipt,
  REGISTER_TO_VOTE,
  rentNext,
  subLines,
  type Application,
  type Bill,
  type BinBook,
  type Entry,
  type Insurance,
  type Reading,
  type Rent,
  type Service,
  type Thing,
} from '../../../../packages/shared/src/homeadmin';
import { parseWarranty, warrantyEnd } from '../../../../packages/shared/src/money';
import { addDays, addMonths, daysBetween, pounds, prettyDay, shortId } from '../../../../packages/shared/src/packs';
import { formatPlate, normalisePlate } from '../../../../packages/shared/src/plates';
import { platesIn } from '../../../../packages/shared/src/cards';
import { deviceName, MAKERS, parseDevice, pickManual } from '../integrations/manuals';
import { parseHitList } from '../integrations/parts';
import { listCars } from '../cars';
import { notSavedYet, savedPlace } from '../places';
import { addJob, loadJobs, removeJob } from '../schedule';
import { spendingSummary } from '../spending';
import { fromZoned, zoned } from '../time';
import { load, packTool, save, todayOf, UA, wordsOf, type ActionFn, type PackDeps } from '../packs/base';
import { MONEY_KEYS } from './money';
import { search } from './web';
import { arg, type Tool } from './types';

export const HOME_KEYS = {
  bills: 'home:bills', warranties: 'home:warranties', manuals: 'home:manuals', insurance: 'home:insurance', carsArmed: 'home:cars:armed', bins: 'home:bins', planning: 'home:planning',
  meters: 'home:meters', rent: 'home:rent', things: 'home:things', book: 'home:book', council: 'home:council', services: 'home:services',
} as const;

/** When the group is described in full: his words about the house's admin. */
export const HOME_WHEN = new RegExp(
  "\\b(?:(?:gas|electric(?:ity)?|water|energy|phone|broadband|council tax|utility|internet) bills?|(?:my|the|a|this|that|next|latest|these) bills?\\b|bills? (?:due|by|photo|from)|amount due|meter reading|warrant(?:y|ies)|guarantee|(?:user )?manual for|instruction manual|bin(?:s| day| collection| night)|recycling (?:day|week)|which bin|rubbish day|council tax|electoral (?:roll|register)|register to vote|planning (?:applications?|permission)|rent is|rent due|mortgage (?:is|date|payment)|boiler service|smoke alarms?|gas safety|home inventory|insurance renew\\w*|renews? on|(?:mot|tax) (?:is )?due|my (?:plumber|electrician|landlord)|the (?:plumber|electrician|landlord)(?:'s| is)|what am i paying|what(?:'s| is) due at home|home admin)\\b",
  'i',
);
export const HOME_ABOUT =
  'You can run his home admin (home: bill, bills, paid, warranty, manual, renewals, bins, planning, meter, rent, subs, inventory, book, council, service, due): his entries and public sources only; nothing bills.';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const sheet = (what: string) => ({ name: 'open_homeadmin', args: { what } });
const forgetWords = /^(?:forget|clear|delete|remove|reset|cancel|stop)\b/i;
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (n: number): string => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const monthName = (ym: string) => `${MONTHS_LONG[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;

// ---------------------------------------------------------------- reminders (9am, his zone)

async function armDay(d: PackDeps, title: string, ymd: string, text: string): Promise<boolean> {
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
async function disarm(d: PackDeps, title: string): Promise<void> {
  for (const j of (await loadJobs(d.storage)).filter((x) => x.kind === 'reminder' && x.title === title)) await removeJob(d.storage, j.id);
}
/** The follow job also looks at the planning watch (packs/index.ts): exactly one such job, whichever pack needs it. */
async function ensureWatchJob(d: PackDeps): Promise<void> {
  if ((await loadJobs(d.storage)).some((j) => j.kind === 'follow')) return;
  await addJob(d.storage, { kind: 'follow', title: 'Watches', text: 'The pages and applications you asked me to watch: I look twice a day and tell you what is new or cheaper (money and home packs).', next: d.now() + 12 * 3_600_000, tz: d.tz }, d.now());
}

// ---------------------------------------------------------------- bills

const billsOf = (d: PackDeps) => load<Bill[]>(d, HOME_KEYS.bills, []);
const billTitle = (b: Bill) => `Bill: ${b.supplier} ${b.due}`;

const bill: ActionFn = async (a, d) => {
  const text = (arg.str(a, 'text', false) || wordsOf(a)).slice(0, 6000);
  const today = todayOf(d);
  if (clean(text).length < 12) return { text: 'Photograph the bill, the page with the amount and the date, and I read it on your phone; or paste its text. I keep the supplier, the amount, the day it is due and the period it covers.', open: sheet('bills') };
  const r = readBill(text, today);
  if (r.amount === null && !r.due) return { text: 'I couldn’t find an amount or a due date in that text. Try a flatter, brighter photo of the page with “Amount due” on it, or tell me: “British Gas £84.20 due 14 November”.' };
  const list = await billsOf(d);
  const b: Bill = { id: shortId(), supplier: r.supplier, kind: r.kind, amount: r.credit ? 0 : r.amount ?? 0, due: r.due, from: r.from, to: r.to, at: today, ...(r.credit ? { credit: r.amount ?? 0 } : {}) };
  const dup = list.find((x) => x.supplier === b.supplier && x.due === b.due && b.due && Math.abs(x.amount - b.amount) < 0.005);
  if (dup) return { text: `That one is kept already: ${billLine(dup, today)}.`, data: { bill: dup } };
  await save(d, HOME_KEYS.bills, [...list, b].slice(-150));
  let armed = false;
  if (b.due && b.amount > 0) armed = await armDay(d, billTitle(b), daysBetween(today, b.due) >= 2 ? addDays(b.due, -2) : b.due, `${b.supplier} ${pounds(b.amount)} is due ${prettyDay(b.due)}.`);
  const period = b.from && b.to ? `, for ${prettyDay(b.from)} to ${prettyDay(b.to)}` : '';
  return {
    text: `Kept: ${b.supplier} (${b.kind}) ${r.credit ? `in credit by ${pounds(b.credit ?? 0)}` : pounds(b.amount)}${b.due ? `, due ${prettyDay(b.due, today.slice(0, 4))}` : ', no due date found'}${period}. ${armed ? 'I’ll remind you two days before (it’s in your Agenda). ' : ''}I read this from the text of a photo or a paste, so check it: ${r.notes.length ? r.notes.join('; ') : 'it read cleanly'}.`,
    cards: [card({ id: `home:bill:${b.id}`, kind: 'brief', at: d.now(), title: `${b.supplier} ${pounds(b.amount)}`, line: b.due ? `Due ${prettyDay(b.due, today.slice(0, 4))}${period ? ` ${period.slice(1)}` : ''}` : 'No due date found', brief: { icon: 'reminder' }, acts: [{ label: 'PAID', run: { name: 'packs_do', args: { pack: 'homeadmin', action: 'paid', args: { id: b.id } } } }, { label: 'UNDO', run: { name: 'packs_do', args: { pack: 'homeadmin', action: 'paid', args: { id: b.id, remove: true } } } }] })],
    data: { bill: b, notes: r.notes },
  };
};

const bills: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const list = await billsOf(d);
  if (!list.length) return { text: 'No bills kept yet. Photograph one in the HOME sheet (or paste its text) and I keep the supplier, the amount and the day it is due.', open: sheet('bills') };
  if (/\bhow much\b|\btotal\b|\bspent\b|\bcost\b/i.test(words)) {
    const t = billTotal(list, words, arg.str(a, 'year', false) || today.slice(0, 4));
    if (!t) return { text: `I have no bills like that for ${today.slice(0, 4)}. I only know the ones you showed me (${list.length} kept).` };
    return { text: `${cap(t.label)} this year: ${pounds(t.total)} over ${t.list.length} bill${t.list.length === 1 ? '' : 's'} I have.\n${t.list.map((b) => `- ${b.supplier} ${pounds(b.amount)}${b.to ? ` to ${prettyDay(b.to, today.slice(0, 4))}` : b.due ? `, due ${prettyDay(b.due, today.slice(0, 4))}` : ''}`).join('\n')}\nOnly the bills you showed me: if one is missing, so is its amount.` };
  }
  const open = list.filter((b) => !b.paid && !b.credit).sort((x, y) => (x.due || '9').localeCompare(y.due || '9'));
  if (!open.length) return { text: list.length === 1 ? 'Nothing unpaid: the one bill I have is marked paid.' : `Nothing unpaid: all ${list.length} bills I have are marked paid.` };
  const soon = open.filter((b) => b.due && daysBetween(today, b.due) <= 30);
  return {
    text: `Bills still to pay (${open.length}):\n${open.slice(0, 8).map((b) => `- ${billLine(b, today)}`).join('\n')}${soon.length ? `\nIn the next 30 days: ${pounds(soon.reduce((s, b) => s + b.amount, 0))}.` : ''}`,
    cards: [card({ id: 'home:bills', kind: 'brief', at: d.now(), title: `${open.length} bills to pay`, line: billLine(open[0]!, today), brief: { icon: 'reminder' }, acts: [{ label: 'OPEN', run: sheet('bills') }] })],
    data: { bills: open },
  };
};

const paid: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const list = await billsOf(d);
  const id = arg.str(a, 'id', false);
  // (forgetting can name a bill that is already paid; marking paid only looks at the ones still to pay)
  const removing = a.remove === true || a.remove === 'true' || forgetWords.test(words);
  const named = (b: Bill) => !!words && new RegExp(`\\b${b.supplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(words);
  const hit = id ? list.find((b) => b.id === id) : [...list].reverse().find((b) => (removing || !b.paid) && named(b)) ?? (/\b(?:the |that |my )?(?:last|latest|bill)\b/i.test(words) ? [...list].reverse().find((b) => removing || !b.paid) : undefined);
  if (!hit) return { text: list.length ? 'Which bill? Say its supplier, like “paid British Gas”.' : 'No bills are kept yet.' };
  if (removing) {
    await save(d, HOME_KEYS.bills, list.filter((b) => b.id !== hit.id));
    await disarm(d, billTitle(hit));
    return { text: `Forgot the ${hit.supplier} bill, and its reminder.` };
  }
  hit.paid = todayOf(d);
  await save(d, HOME_KEYS.bills, list);
  await disarm(d, billTitle(hit));
  return { text: `Marked paid: ${hit.supplier} ${pounds(hit.amount)}. Its reminder is cleared. (I don’t see your bank: this is only your word.)` };
};

// ---------------------------------------------------------------- warranties

interface Warr {
  id: string;
  thing: string;
  bought: string;
  months: number;
  ends: string;
  defaulted: boolean;
  store?: string;
  manual?: string;
}
const warranty: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const text = arg.str(a, 'text', false);
  const today = todayOf(d);
  const mine = await load<Warr[]>(d, HOME_KEYS.warranties, []);
  const money = await load<{ thing: string; ends: string }[]>(d, MONEY_KEYS.warranties, []);
  if ((!words && !text) || (!text && /^(?:what|which|list|show|when|how|do i|are|is)\b|\?$/i.test(words))) {
    const all = [...mine.map((w) => ({ thing: w.thing, ends: w.ends, from: '' })), ...money.map((w) => ({ thing: w.thing, ends: w.ends, from: ' (from the money pack)' }))].sort((x, y) => x.ends.localeCompare(y.ends));
    return { text: all.length ? `Warranties:\n${all.map((w) => `- ${cap(w.thing)}: ${w.ends < today ? `ended ${prettyDay(w.ends, today.slice(0, 4))}` : `until ${prettyDay(w.ends, today.slice(0, 4))}`}${w.from}`).join('\n')}` : 'No warranties kept. Photograph a receipt, or say “washing machine bought 3 March 2025, 2 year warranty”.' };
  }
  if (forgetWords.test(words)) {
    const key = clean(words.replace(forgetWords, '').replace(/\b(?:the|my|warranty|for)\b/gi, ''));
    const hit = mine.find((w) => key && w.thing.toLowerCase().includes(key.toLowerCase()));
    if (!hit) return { text: 'Which one? Say “forget the washing machine’s warranty”.' };
    await save(d, HOME_KEYS.warranties, mine.filter((w) => w.id !== hit.id));
    await disarm(d, `Warranty ends: ${hit.thing}`);
    return { text: `Forgot the ${hit.thing} warranty, and its reminder.` };
  }
  const rc = text ? readReceipt(text, today) : null;
  const p = parseWarranty(words, today);
  const bare = !p && words && words.length <= 40 && !/^(?:what|which|list|show|when|how|do i|are|is)\b|\?$/i.test(words) && !/^(?:it|this|that|something|anything|one|stuff|things?)$/i.test(words) ? clean(words.replace(/^(?:the|my|a|an)\s+/i, '')) : '';
  const thing = clean(arg.str(a, 'item', false) || p?.thing || bare || rc?.item || '');
  if (!thing || thing === 'it') return { text: 'What is it? Say “the TV, bought 3 March 2025, 2 year warranty”, or photograph the receipt and tell me the item.' };
  const bought = p?.bought && datesIn(words, today).length ? p.bought : rc?.date || p?.bought || today;
  const months = p?.months ?? 12;
  const ends = warrantyEnd(bought, months);
  const w: Warr = { id: shortId(), thing: thing.slice(0, 40), bought, months, ends, defaulted: !p, ...(rc?.store ? { store: rc.store } : {}), ...(arg.str(a, 'url', false) ? { manual: arg.str(a, 'url', false) } : {}) };
  await save(d, HOME_KEYS.warranties, [...mine.filter((x) => x.thing.toLowerCase() !== w.thing.toLowerCase()), w].slice(-80));
  const nice = (x: string) => prettyDay(x, today.slice(0, 4));
  if (ends < today) return { text: `The ${w.thing}’s warranty ended ${nice(ends)} (bought ${nice(bought)}, ${months} months${w.defaulted ? ', a default' : ''}). Kept on your list anyway.` };
  const remind = addMonths(ends, -1) > today ? addMonths(ends, -1) : addDays(today, 1);
  const armed = await armDay(d, `Warranty ends: ${w.thing}`, remind, `The ${w.thing}’s warranty ends ${nice(ends)} (bought ${nice(bought)}, ${months} months): anything wrong with it, claim now.`);
  return {
    text: `Kept: the ${w.thing}${rc?.store ? ` from ${rc.store}` : ''}, bought ${nice(bought)}, ${months}-month warranty${w.defaulted ? ' — 12 months is a plain default (most shops give a year), so check your receipt or the box' : ''}: it ends ${nice(ends)}. ${armed ? `I’ll remind you on ${nice(remind)} at 9am, a month before it ends.` : ''}${rc && !p ? ' I read the receipt from a photo, so check the item and the date.' : ''}`,
    cards: [card({ id: `home:warranty:${w.id}`, kind: 'brief', at: d.now(), title: `${cap(w.thing)} warranty`, line: `Until ${nice(ends)}${w.defaulted ? ' (a default of 12 months)' : ''}`, brief: { icon: 'reminder' }, acts: [{ label: 'UNDO', run: { name: 'packs_do', args: { pack: 'homeadmin', action: 'warranty', args: { words: `forget ${w.thing}` } } } }] })],
    data: { warranty: w },
  };
};

// ---------------------------------------------------------------- manuals: the maker's own page, as a link

interface Manual {
  id: string;
  name: string;
  model: string;
  url: string;
  title: string;
  host: string;
  at: number;
}
/** The web search for a manual (a seam for the tests): keyless, through the brain's own search. */
export const homeHooks = {
  search: async (q: string): Promise<{ title: string; url: string }[]> => parseHitList(await search(q, { vault: { get: async () => null } as never })).map((h) => ({ title: h.title, url: h.url })),
};
const manual: ActionFn = async (a, d) => {
  const words = `${arg.str(a, 'maker', false)} ${arg.str(a, 'model', false)} ${wordsOf(a)} ${arg.str(a, 'text', false)}`.trim();
  const saved = await load<Manual[]>(d, HOME_KEYS.manuals, []);
  const dev = parseDevice(words);
  if (forgetWords.test(wordsOf(a))) {
    const left = saved.filter((m) => !(dev.model && m.model === dev.model));
    await save(d, HOME_KEYS.manuals, left);
    return { text: left.length < saved.length ? 'Forgot that manual link.' : 'Which model? Say “forget the manual for SMS24AW01G”.' };
  }
  if (!dev.model) {
    return { text: saved.length ? `Manuals you saved (links to the maker’s own pages):\n${saved.map((m) => `- ${m.name}: ${m.url}`).join('\n')}` : 'I need the model number: it is on the rating plate (inside the door, on the back or underneath, after “Model”, “Type” or “E-Nr”). Photograph it in the HOME sheet or say it, like “manual for Bosch dishwasher SMS24AW01G”. I save the maker’s own page as a link, never a copy.' };
  }
  const have = saved.find((m) => m.model === dev.model);
  if (have) return { text: `Saved already: ${have.name} — “${have.title}” on ${have.host}: ${have.url}`, data: { manual: have } };
  const hits: { title: string; url: string }[] = [];
  try {
    const qs = [`${dev.make} ${dev.model} ${dev.kind} user manual`.replace(/\s+/g, ' ').trim(), `${dev.model} manual${dev.maker ? ` site:${MAKERS[dev.maker]!.hosts[0]}` : ''}`];
    for (const q of qs) for (const h of await homeHooks.search(q).catch(() => [])) if (!hits.some((x) => x.url === h.url)) hits.push(h);
  } catch {
    /* no search just now */
  }
  const { picks, skipped } = pickManual(hits, dev);
  const mine = picks.find((p) => p.source.from === 'maker');
  const name = deviceName(dev);
  if (!mine) {
    return { text: `I couldn’t find ${dev.make ? `${dev.make}’s` : 'the maker’s'} own page for ${name}${hits.length ? ` (${hits.length} results, none from the maker’s own site${skipped.length ? `; ${skipped.length} skipped as not theirs` : ''})` : ' (the web search gave nothing just now)'}. I only save the maker’s own page, never a copy from elsewhere. If you have the link, say “save this manual for ${dev.model}: …”.` };
  }
  const m: Manual = { id: shortId(), name, model: dev.model, url: mine.url, title: mine.title.slice(0, 100), host: mine.source.name, at: d.now() };
  await save(d, HOME_KEYS.manuals, [...saved.filter((x) => x.model !== m.model), m].slice(-60));
  return { text: `Found for ${name}: “${m.title}” — ${m.url} (${m.host}). Saved as a link in your home book; I haven’t downloaded or copied the manual, it is the maker’s: open the link to read it.`, data: { manual: m } };
};

// ---------------------------------------------------------------- the family cars' renewals (from the car batch's facts)

const insuranceOf = (d: PackDeps) => load<Insurance[]>(d, HOME_KEYS.insurance, []);
async function armCars(d: PackDeps, today: string): Promise<number> {
  let n = 0;
  const cars = await listCars(d.storage).catch(() => []);
  for (const c of cars) {
    for (const [what, ym] of [['MOT', c.mot], ['Tax', c.tax]] as const) {
      if (!ym) continue;
      const first = `${ym}-01`;
      const t = `${what}: ${carName(c)}`;
      const line = `${carName(c)} (${formatPlate(c.plate)}): ${what === 'MOT' ? 'the MOT' : 'the tax'} falls due in ${monthName(ym)} (I only know the month, so I count from the 1st).`;
      if (await armDay(d, t, addMonths(first, -1), line)) n++;
      if (await armDay(d, t, addDays(first, -7), line)) n++;
    }
  }
  for (const i of await insuranceOf(d)) {
    const next = insuranceNext(i, today);
    const t = `Insurance: ${i.whose}`;
    if (await armDay(d, t, addDays(next, -30), `${i.whose} insurance renews ${prettyDay(next)}: time to compare.`)) n++;
    if (await armDay(d, t, addDays(next, -7), `${i.whose} insurance renews ${prettyDay(next)} in a week.`)) n++;
  }
  return n;
}
const renewals: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const cars = await listCars(d.storage).catch(() => []);
  let ins = await insuranceOf(d);
  const told = /\binsur\w*|\bcover\b|\brenews?\b/i.test(words) ? datesIn(words, today)[0]?.ymd ?? '' : '';
  let extra = '';
  if (told) {
    const plates = platesIn(words).map(normalisePlate);
    const car = cars.find((c) => plates.includes(normalisePlate(c.plate))) ?? cars.find((c) => c.whose !== 'me' && new RegExp(`\\b${c.whose}(?:'s|’s)?\\b`, 'i').test(words)) ?? (/\bmy\b/i.test(words) ? cars.find((c) => c.whose === 'me') : undefined);
    const wm = /\b(?:my|(\w+)['’]s)\s+(car|van|bike|house|home|flat)\b/i.exec(words);
    const whose = (arg.str(a, 'whose', false) || (car ? carName(car) : wm ? (wm[1] ? `${cap(wm[1])}’s ${wm[2]}` : `Your ${wm[2]}`) : 'Your insurance')).slice(0, 40);
    ins = [...ins.filter((i) => i.whose.toLowerCase() !== whose.toLowerCase()), { id: shortId(), whose, ...(car ? { plate: car.plate } : {}), on: told }];
    await save(d, HOME_KEYS.insurance, ins);
    await save(d, HOME_KEYS.carsArmed, true);
    const n = await armCars(d, today);
    extra = `Kept: ${whose} insurance renews ${prettyDay(insuranceNext(ins[ins.length - 1]!, today), today.slice(0, 4))}. I’ll remind you a month before and a week before, at 9am (${n} reminders are set for your cars and insurance).\n`;
  } else if (/\b(?:remind|arm|set reminders?)\b/i.test(words) || a.arm === true || a.arm === 'true') {
    await save(d, HOME_KEYS.carsArmed, true);
    const n = await armCars(d, today);
    return { text: n ? `Set: reminders a month and a week before each MOT, tax and insurance date I know (${n} in your Agenda). For a MOT or tax I only know the month, so I count from the 1st. The Brief keeps them set as cars and dates change.` : 'No dates to remind about yet: name a car (“my dad’s car is AB12 CDE”), look at its card once so I learn its MOT and tax months, and tell me insurance dates (“Dad’s car insurance renews on 3 March”).' };
  }
  const lines = [
    ...cars.map((c) => ({ on: c.mot ? `${c.mot}-01` : c.tax ? `${c.tax}-01` : '9', text: `${carName(c)} (${formatPlate(c.plate)}): MOT ${c.mot ? `due ${monthName(c.mot)}` : 'not known yet'}; tax ${c.tax ? `due ${monthName(c.tax)}` : 'not known yet'}${(() => { const i = ins.find((x) => x.plate && normalisePlate(x.plate) === normalisePlate(c.plate)); return i ? `; insurance renews ${prettyDay(insuranceNext(i, today), today.slice(0, 4))}` : ''; })()}` })),
    ...ins.filter((i) => !i.plate || !cars.some((c) => normalisePlate(c.plate) === normalisePlate(i.plate!))).map((i) => ({ on: insuranceNext(i, today), text: `${i.whose}: insurance renews ${prettyDay(insuranceNext(i, today), today.slice(0, 4))}` })),
  ].sort((x, y) => x.on.localeCompare(y.on));
  if (!lines.length) return { text: `${extra}No cars named yet. Say “my dad’s car is AB12 CDE”, open its card once so I learn its MOT and tax months, and tell me insurance dates (“Dad’s car insurance renews on 3 March”).` };
  return { text: `${extra}Your cars’ renewals (MOT and tax from the car records you opened; insurance as you told me):\n${lines.map((l) => `- ${l.text}`).join('\n')}\nSay “remind me about the cars’ renewals” for a reminder a month and a week before each.`, data: { cars: lines.map((l) => l.text) } };
};

// ---------------------------------------------------------------- bin days

const binsOf = (d: PackDeps) => load<BinBook>(d, HOME_KEYS.bins, emptyBins());
function binLines(book: BinBook, from: string): string[] {
  const when = (x: string) => `${prettyDay(x, from.slice(0, 4))}${daysBetween(from, x) === 0 ? ' (today)' : daysBetween(from, x) === 1 ? ' (tomorrow)' : ''}`;
  return book.bins.map((b) => {
    const days = binDays(b, book, from, 2);
    return `${cap(b.name)}: ${days.length ? days.map(when).join(', then ') : needsAnchor(b) ? 'I need one day it is collected (“next recycling is 10 November”)' : 'no dates left'}`;
  });
}
const bins: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const text = arg.str(a, 'text', false);
  const today = todayOf(d);
  let book = await binsOf(d);
  if (forgetWords.test(words) && /\bbins?\b|\brecycl|\brubbish|\bcollection/i.test(words)) {
    await d.storage.delete(HOME_KEYS.bins);
    return { text: 'Forgot your bin days.' };
  }
  let said = '';
  const fromPage = text.length > 20 && datesIn(text, today).length >= 2 ? parseBinDates(text, today) : [];
  if (fromPage.length) {
    book = { ...book, bins: [...book.bins.filter((b) => !fromPage.some((p) => p.name === b.name)), ...fromPage] };
    said = `Kept the days from your council’s page: ${fromPage.map((b) => `${b.name} (${b.dates!.length} dates)`).join(', ')}.\n`;
  }
  const isMove = book.bins.length > 0 && !/\bevery\b|\bbank holidays?\b/i.test(words) && /\b(?:mov(?:e|ed|es|ing)|shift(?:ed|s)?|put back|brought forward|a day late)\b/i.test(words);
  const parsed = words && !isMove ? parseBins(words, today) : [];
  if (parsed.length) {
    book = { ...book, bins: [...book.bins.filter((b) => !parsed.some((p) => p.name === b.name)), ...parsed] };
    said += `Kept: ${parsed.map((b) => BIN_WORDS(b)).join('; ')}.\n`;
  }
  if (/\bbank holidays?\b/i.test(words) && /\b(?:late|later|slip|a day (?:after|behind)|one day)\b/i.test(words)) {
    book = { ...book, slip: !/\b(?:not|no longer|don'?t|doesn'?t|never)\b/i.test(words) };
    said += book.slip ? 'Noted your rule: after a bank holiday in the week, collections run a day late.\n' : 'Dropped the bank-holiday rule.\n';
  }
  if (isMove) {
    const moves = book.bins.map((b) => parseMove(words, b, today)).filter((m): m is { from: string; to: string } => !!m);
    if (moves.length) {
      book = { ...book, moves: [...book.moves.filter((m) => !moves.some((x) => x.from === m.from)), ...moves].filter((m) => m.from >= addDays(today, -14)) };
      said += `Noted: ${moves.map((m) => `${prettyDay(m.from)} moves to ${prettyDay(m.to)}`).join('; ')}.\n`;
    }
  }
  if (said) await save(d, HOME_KEYS.bins, book);
  if (!book.bins.length) return { text: 'I don’t know your bin days yet. Tell me once: “bins are Tuesday, recycling every other Tuesday, next recycling is 10 November”, or paste your council’s page. I’ll say the night before.', open: sheet('bins') };
  const tomorrow = book.bins.filter((b) => binDays(b, book, addDays(today, 1), 1)[0] === addDays(today, 1));
  const tonight = tomorrow.length ? `Bins out tonight: ${tomorrow.map((b) => b.name).join(' and ')} (collected tomorrow).\n` : '';
  return {
    text: `${said}${tonight}${binLines(book, today).join('\n')}${book.slip ? '\n(Collections run a day late after a bank holiday, as you told me.)' : ''}\nI only know what you told me or your council printed; a collection that moved is a thing to tell me: “bins move to Wednesday this week”.`,
    cards: [card({ id: 'home:bins', kind: 'brief', at: d.now(), title: tomorrow.length ? 'Bins out tonight' : 'Bin days', line: tomorrow.length ? tomorrow.map((b) => b.name).join(' and ') : binLines(book, today)[0]!.slice(0, 100), brief: { icon: 'reminder' }, acts: [{ label: 'OPEN', run: sheet('bins') }] })],
    data: { lines: binLines(book, today), tonight: tomorrow.map((b) => b.name) },
  };
};

// ---------------------------------------------------------------- planning applications near home

interface PlanWatch {
  on: boolean;
  radius: number;
  seen: string[];
  checked: number;
}
const planWatch = (d: PackDeps) => load<PlanWatch>(d, HOME_KEYS.planning, { on: false, radius: 500, seen: [], checked: 0 });
async function getJ(d: PackDeps, url: string): Promise<unknown> {
  const r = await d.fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`answered ${r.status}`);
  return r.json();
}
async function planningLook(d: PackDeps, home: { lat: number; lon: number }, radius: number) {
  const dataset = await getJ(d, 'https://www.planning.data.gov.uk/dataset/planning-application.json').catch(() => null);
  const count = Number((dataset as { 'entity-count'?: unknown } | null)?.['entity-count'] ?? 0);
  const [apps, cons, council] = await Promise.all([
    count > 0 ? getJ(d, `https://www.planning.data.gov.uk/entity.json?dataset=planning-application&geometry=${encodeURIComponent(circleWkt(home.lat, home.lon, radius))}&geometry_relation=intersects&limit=40`).then(parsePlanning).catch(() => null) : Promise.resolve([] as Application[]),
    getJ(d, `https://www.planning.data.gov.uk/entity.json?dataset=conservation-area&dataset=article-4-direction-area&dataset=tree-preservation-zone&latitude=${home.lat.toFixed(5)}&longitude=${home.lon.toFixed(5)}`).then(constraintsAt).catch(() => [] as string[]),
    getJ(d, `https://api.postcodes.io/postcodes?lon=${home.lon.toFixed(5)}&lat=${home.lat.toFixed(5)}&limit=1`).then(councilOf).catch(() => null),
  ]);
  return { covered: count > 0, down: dataset === null, apps: apps ?? [], appsFailed: apps === null, cons, council };
}
const planning: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const home = await savedPlace(d.storage, 'home');
  if (!home) return { text: notSavedYet('home') ?? 'Save your home first, so I know where to look.' };
  const w = await planWatch(d);
  if (/^(?:stop|forget|cancel|clear|turn off)\b/i.test(words)) {
    await save(d, HOME_KEYS.planning, { ...w, on: false });
    return { text: 'Stopped watching for planning applications near home.' };
  }
  const radius = arg.num(a, 'radius', 0) || (/\d|half|quarter|mile|km/i.test(words) ? radiusFrom(words) : w.radius);
  const watching = /\b(?:tell me|watch|alert|keep (?:an eye|me posted)|let me know|new|notify)\b/i.test(words);
  const r = await planningLook(d, home, radius);
  const where = `${radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} of home`;
  const council = r.council ? `${r.council.name}` : 'your council';
  const lines: string[] = [];
  if (r.cons.length) lines.push(`At your home the national planning data lists: ${r.cons.join('; ')}.`);
  if (r.covered && r.appsFailed) lines.push('The national planning data didn’t answer for applications just now. I won’t guess.');
  else if (r.covered) {
    lines.push(r.apps.length ? `Planning applications within ${where}:\n${r.apps.slice(0, 8).map((x) => `- ${x.ref}: ${x.text}${x.status ? ` (${x.status})` : ''}${x.url ? ` ${x.url}` : ''}`).join('\n')}` : `No planning applications within ${where} on the national platform, which only some councils feed so far: ${council}’s own planning pages are the full list.`);
  } else if (r.down) {
    lines.push('The national planning data (planning.data.gov.uk) isn’t answering just now, so I can’t list applications. I won’t guess.');
  } else {
    lines.push(`I can’t list planning applications near you: the national platform (planning.data.gov.uk) has begun a planning-application dataset but holds none yet. ${council} is your council: its own planning pages hold them, and I can’t search those from here. To find its site, enter your postcode at ${FIND_COUNCIL}.`);
  }
  if (watching && !/^(?:stop)/i.test(words)) {
    await save(d, HOME_KEYS.planning, { on: true, radius, seen: r.apps.map((x) => x.id).slice(0, 200), checked: d.now() });
    await ensureWatchJob(d);
    lines.push(r.covered ? `Watching: I look twice a day and tell you once about each new application within ${where}.` : `Noted that you want to hear about new applications within ${where}. There is nothing for me to watch yet; I’ll tell you if the national platform starts listing yours.`);
  }
  return { text: lines.join('\n'), data: { apps: r.apps, covered: r.covered, council: r.council } };
};
/** The follow job's look at the planning watch (packs/index.ts): applications not told before, once each. Returns the next look. */
export async function planningTick(d: PackDeps, tell: (title: string, text: string, c: ReturnType<typeof card>) => Promise<unknown>): Promise<number> {
  const w = await planWatch(d);
  const home = w.on ? await savedPlace(d.storage, 'home') : null;
  if (w.on && home) {
    try {
      const r = await planningLook(d, home, w.radius);
      const fresh = r.apps.filter((x) => !w.seen.includes(x.id));
      for (const x of fresh.slice(0, 3)) await tell('New planning application', `${x.ref}: ${x.text}${x.status ? ` (${x.status})` : ''} — within ${w.radius} m of home.${x.url ? ` ${x.url}` : ''}`, card({ id: `home:plan:${x.id}`, kind: 'brief', at: d.now(), title: 'New planning application', line: `${x.ref}: ${x.text}`, brief: { icon: 'warning' } }));
      await save(d, HOME_KEYS.planning, { ...w, seen: [...w.seen, ...fresh.map((x) => x.id)].slice(-200), checked: d.now() });
    } catch {
      /* the next look */
    }
  }
  return d.now() + 12 * 3_600_000;
}

// ---------------------------------------------------------------- meters

type Meters = Record<string, Reading[]>;
const meter: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const text = arg.str(a, 'text', false) || words;
  const today = todayOf(d);
  const all = await load<Meters>(d, HOME_KEYS.meters, {});
  if (forgetWords.test(words)) {
    const which = /\belectric/i.test(words) ? 'electricity' : /\bgas\b/i.test(words) ? 'gas' : /\bwater\b/i.test(words) ? 'water' : '';
    if (which && !all[which]) return { text: `I have no ${which} readings to forget.` };
    if (which) delete all[which];
    await (which && Object.keys(all).length ? save(d, HOME_KEYS.meters, all) : d.storage.delete(HOME_KEYS.meters));
    return { text: which ? `Forgot the ${which} readings.` : 'Forgot all your meter readings.' };
  }
  const say = (kind: string) => {
    const u = meterUsage(all[kind] ?? []);
    const last = all[kind]?.[all[kind]!.length - 1];
    if (!last) return '';
    return `${cap(kind)}: ${last.value.toLocaleString('en-GB')} on ${prettyDay(last.on, today.slice(0, 4))}${u === null ? ' (the first reading: I need a second to tell you the usage)' : u === 'lower' ? ' (lower than the one before: the dial may have gone round or been misread, so no usage)' : `. Since ${prettyDay(u.since, today.slice(0, 4))} (${u.days} days): ${u.units.toLocaleString('en-GB')} units, about ${u.perDay} a day`}.`;
  };
  if (!text.trim() || !/\d{3}/.test(text.replace(/\s/g, ''))) {
    const kinds = Object.keys(all);
    return { text: kinds.length ? kinds.map(say).join('\n') : 'No readings kept. Photograph the meter in the HOME sheet and I read the dial; I keep the reading and the day, and tell you the usage between readings.', open: kinds.length ? undefined : sheet('meter') };
  }
  const r = readMeter(text);
  if (!r) return { text: 'I couldn’t read a number off that. Try a closer, straighter photo of the dial, or type the reading.' };
  const kind = arg.str(a, 'kind', false).toLowerCase() || r.kind || (/\belectric/.test(words) ? 'electricity' : /\bgas\b/.test(words) ? 'gas' : /\bwater\b/.test(words) ? 'water' : '');
  if (!kind) return { text: `I read ${r.value.toLocaleString('en-GB')}: is that the electricity, gas or water meter? Say which and I keep it.` };
  const on = datesIn(words, today)[0]?.ymd || today;
  const list = [...(all[kind] ?? []).filter((x) => x.on !== on), { on, value: r.value }].sort((x, y) => x.on.localeCompare(y.on)).slice(-60);
  all[kind] = list;
  await save(d, HOME_KEYS.meters, all);
  const rate = arg.num(a, 'pence', 0);
  const u = meterUsage(list);
  const cost = rate > 0 && u && u !== 'lower' ? ` At ${rate}p a unit that is about ${pounds(Math.round(u.units * rate) / 100)} (an estimate: standing charges and your tariff's tiers are not in it).` : '';
  return { text: `Kept: ${say(kind)}${cost}\nI took ${r.note}.`, cards: [card({ id: `home:meter:${kind}`, kind: 'brief', at: d.now(), title: `${cap(kind)} meter`, line: `${r.value.toLocaleString('en-GB')} on ${prettyDay(on, today.slice(0, 4))}`, brief: { icon: 'diary' } })], data: { kind, reads: list } };
};

// ---------------------------------------------------------------- rent or a mortgage

/** The next rent day; today's does not count once its 9am reminder has gone. */
const rentOn = (r: Rent, d: PackDeps): string => {
  const today = todayOf(d);
  const n = rentNext(r, today);
  return n === today && zoned(d.now(), d.tz).h >= 9 ? rentNext(r, addDays(today, 1)) : n;
};
const rent: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const kept = await load<(Rent & { job?: string }) | null>(d, HOME_KEYS.rent, null);
  if (forgetWords.test(words)) {
    if (kept?.job) await removeJob(d.storage, kept.job).catch(() => undefined);
    await d.storage.delete(HOME_KEYS.rent);
    return { text: 'Forgot the rent date, and its reminder.' };
  }
  const p = parseRent(words);
  if (!p) {
    if (!kept) return { text: 'Tell me once: “rent is due on the 1st, £750” or “mortgage £1,150 on the 28th”, and I remind you at 9am on the day each month.' };
    const next = rentOn(kept, d);
    return { text: `Your ${kept.kind}${kept.amount ? ` (${pounds(kept.amount)})` : ''} is due on the ${ordinal(kept.day)} of each month — next ${prettyDay(next, today.slice(0, 4))} (${daysBetween(today, next)} days).` };
  }
  if (kept?.job) await removeJob(d.storage, kept.job).catch(() => undefined);
  const next = rentOn(p, d);
  let job = '';
  try {
    const at = fromZoned(+next.slice(0, 4), +next.slice(5, 7), +next.slice(8, 10), 9, 0, d.tz);
    job = (await addJob(d.storage, { kind: 'reminder', title: `${cap(p.kind)} due today${p.amount ? ` (${pounds(p.amount)})` : ''}`, text: `Your ${p.kind} is due today${p.amount ? `: ${pounds(p.amount)}` : ''}.`, next: at, repeat: 'monthly', tz: d.tz }, d.now())).id;
  } catch {
    /* the reminder is the extra: the date is kept */
  }
  await save(d, HOME_KEYS.rent, { ...p, ...(job ? { job } : {}) });
  return { text: `Kept: your ${p.kind}${p.amount ? ` (${pounds(p.amount)})` : ''} is due on day ${p.day} of each month — next ${prettyDay(next, today.slice(0, 4))}. ${job ? 'I’ll remind you at 9am that day, every month (it’s in your Agenda), and the Brief says it the day before.' : ''}`, data: { rent: p, next } };
};

// ---------------------------------------------------------------- what repeats on his statements

const subs: ActionFn = async (_a, d) => {
  const listed = await load<{ name: string; amount: number; every: 'week' | 'month' | 'year' }[]>(d, MONEY_KEYS.subs, []);
  const found = await spendingSummary(d.storage).then((s) => s.subscriptions.map((x) => ({ name: x.name, amount: x.amount, cadence: x.cadence }))).catch(() => []);
  const { lines, monthly } = subLines(listed, found);
  if (!lines.length) return { text: 'Nothing repeating that I can see: no subscriptions on your money pack’s list, and none found on the statements you added (Agenda → SPENDING). Add a statement, or tell me “Netflix £10.99 a month”.' };
  return {
    text: `What you pay on repeat — about ${pounds(monthly)} a month (${pounds(Math.round(monthly * 12))} a year):\n${lines.slice(0, 12).map((l) => `- ${l.name}: ${pounds(Math.round(l.monthly * 100) / 100)} a month (${l.every}, from ${l.src})`).join('\n')}\nAn estimate: the same amount to the same name on a regular beat on your statements, plus the list you gave the money pack. A price rise or a missing statement shows up late.`,
    cards: [card({ id: 'home:subs', kind: 'brief', at: d.now(), title: `${pounds(monthly)} a month`, line: `${lines.length} things repeat`, brief: { icon: 'diary' } })],
    data: { lines, monthly },
  };
};

// ---------------------------------------------------------------- a room's things

const things: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const all = await load<Thing[]>(d, HOME_KEYS.things, []);
  const room = clean(arg.str(a, 'room', false) || /\b(?:in|for) (?:the |my )?([a-z ]{3,20}?)(?:\s*[:,.]|$)/i.exec(words)?.[1] || '');
  const wantsCsv = a.export === true || a.export === 'csv' || /\b(?:csv|export|spreadsheet|for (?:my )?insur\w+)\b/i.test(words);
  if (forgetWords.test(words)) {
    const key = clean(words.replace(forgetWords, '').replace(/\b(?:the|my|from|in|room)\b/gi, '')).toLowerCase();
    const left = all.filter((t) => !(key && (t.name.toLowerCase().includes(key) || t.room.toLowerCase() === key)));
    await save(d, HOME_KEYS.things, left);
    return { text: left.length < all.length ? `Forgot ${all.length - left.length} thing${all.length - left.length === 1 ? '' : 's'}.` : 'Which one? Say “forget the lamp” or “forget the kitchen”.' };
  }
  const given = Array.isArray(a.items) ? (a.items as unknown[]).map((x) => (typeof x === 'string' ? parseThings(x)[0] : x && typeof x === 'object' ? { name: String((x as { name?: unknown }).name ?? ''), qty: Number((x as { qty?: unknown }).qty) || 1, ...(Number((x as { value?: unknown }).value) ? { value: Number((x as { value?: unknown }).value) } : {}) } : undefined)).filter((x): x is { name: string; qty: number; value?: number } => !!x && !!x.name) : [];
  const fresh = given.length ? given : room && words && !wantsCsv ? parseThings(words.replace(/\b(?:add|put|in|to|for)?\s*(?:the |my )?\b(?:living room|kitchen|bedroom|bathroom|hall|hallway|study|office|garage|loft|dining room|lounge|conservatory|shed)\b[:,]?/i, ' ')) : [];
  let said = '';
  if (fresh.length) {
    if (!room) return { text: 'Which room? Say “in the living room: a 55 inch TV worth £400, 2 armchairs, a laptop £900”.', open: sheet('things') };
    const add: Thing[] = fresh.map((t) => ({ id: shortId(), room: cap(room), name: t.name, qty: t.qty, ...(t.value ? { value: t.value } : {}) }));
    await save(d, HOME_KEYS.things, [...all, ...add].slice(-600));
    all.push(...add);
    said = `Kept in the ${room}: ${add.map((t) => `${t.qty > 1 ? `${t.qty} ` : ''}${t.name}${t.value ? ` (${pounds(t.value)})` : ''}`).join(', ')}.\n`;
  }
  const rooms = [...new Set(all.map((t) => t.room))];
  const total = all.reduce((s, t) => s + (t.value ?? 0) * t.qty, 0);
  if (!all.length) return { text: 'Nothing kept yet. Say “in the living room: a 55 inch TV worth £400, 2 armchairs”, or photograph a room in the HOME sheet and confirm what I see.', open: sheet('things') };
  const csv = inventoryCsv(all);
  return {
    text: `${said}${rooms.map((r) => `${r}: ${all.filter((t) => t.room === r).map((t) => `${t.qty > 1 ? `${t.qty} ` : ''}${t.name}`).join(', ')}`).join('\n')}\n${all.length} things in ${rooms.length} room${rooms.length === 1 ? '' : 's'}; ${total ? `${pounds(total)} where you gave a value` : 'no values given yet (an insurer wants them)'}.${wantsCsv ? ' The CSV is ready to copy or download in the HOME sheet.' : ' Say “export it for my insurer” for a CSV.'}`,
    data: { things: all, csv },
  };
};

// ---------------------------------------------------------------- the house's address book

const book: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const list = await load<Entry[]>(d, HOME_KEYS.book, []);
  if (forgetWords.test(words)) {
    const key = clean(words.replace(forgetWords, '').replace(/\b(?:the|my|our|from|number|details)\b/gi, '')).toLowerCase();
    const left = list.filter((e) => !(key && (e.role.toLowerCase().includes(key) || e.name.toLowerCase().includes(key))));
    await save(d, HOME_KEYS.book, left);
    return { text: left.length < list.length ? 'Forgot that entry.' : 'Which one? Say “forget the plumber”.' };
  }
  const e = parseEntry(words);
  if (e) {
    const entry: Entry = { id: shortId(), ...e, ...(arg.str(a, 'note', false) ? { note: arg.str(a, 'note', false) } : {}) };
    await save(d, HOME_KEYS.book, [...list.filter((x) => !(x.role === entry.role && x.name.toLowerCase() === entry.name.toLowerCase())), entry].slice(-60));
    return { text: `Kept in the house’s book: ${entryLine(entry)}. Only your entry, in your brain; ask “who’s my ${entry.role}?” any time.` };
  }
  const q = list.filter((x) => words && new RegExp(`\\b${x.role}\\b`, 'i').test(words));
  if (q.length) return { text: q.map(entryLine).join('\n') };
  return { text: list.length ? `The house’s book:\n${list.map((x) => `- ${entryLine(x)}`).join('\n')}` : 'Nothing in the house’s book yet. Say “the plumber is Dave on 07700 900123” or “the council’s number is 0121 303 1111”: your entries only, nothing looked up.' };
};

// ---------------------------------------------------------------- the council tax band and his own registration

interface CouncilRec {
  band?: string;
  registered?: string;
}
const council: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const rec = await load<CouncilRec>(d, HOME_KEYS.council, {});
  const band = arg.str(a, 'band', false).toUpperCase() || parseBand(words);
  const reg = /\b(?:registered|on the (?:electoral )?(?:roll|register))\b/i.test(words) && !/\bnot\b/i.test(words) ? datesIn(words, today)[0]?.ymd || today : '';
  let said = '';
  if (band && BAND_RATIOS[band]) {
    rec.band = band;
    said += `Kept: your council tax band is ${band}. ${bandWords(band)}.\n`;
  }
  if (reg) {
    rec.registered = reg;
    said += `Kept: you registered to vote on ${prettyDay(reg, today.slice(0, 4))}. That is only your own note.\n`;
  }
  if (said) await save(d, HOME_KEYS.council, rec);
  const home = await savedPlace(d.storage, 'home');
  const c = home ? await getJ(d, `https://api.postcodes.io/postcodes?lon=${home.lon.toFixed(5)}&lat=${home.lat.toFixed(5)}&limit=1`).then(councilOf).catch(() => null) : null;
  const lines = [
    rec.band ? `Council tax band: ${rec.band} (as you told me). ${bandWords(rec.band)}.` : `Council tax band: not kept. The band of a home is public: GOV.UK’s “find your council tax band” takes your postcode (${COUNCIL_TAX_LOOKUP}); I can’t fill that form for you. Tell me the band and I keep it.`,
    rec.registered ? `Electoral register: you told me you registered on ${prettyDay(rec.registered, today.slice(0, 4))}. The register isn’t searchable online, so I can’t check it${c ? `: ask ${c.name} council’s electoral services` : ''}, or register again in five minutes at ${REGISTER_TO_VOTE}.` : `Electoral register: I don’t know if you are on it. It isn’t searchable online; ${c ? `${c.name} council’s electoral services can tell you` : 'your council’s electoral services can tell you'}, and you can register (or re-register) at ${REGISTER_TO_VOTE}. I only ever note your own registration, never anyone else’s.`,
  ];
  return { text: `${said}${lines.join('\n')}${c ? `\nYour council, from your home's postcode: ${c.name}.` : ''}`, data: { band: rec.band ?? '', registered: rec.registered ?? '' } };
};

// ---------------------------------------------------------------- a boiler or smoke-alarm service

const services = (d: PackDeps) => load<Service[]>(d, HOME_KEYS.services, []);
const service: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const list = await services(d);
  if (forgetWords.test(words)) {
    const key = clean(words.replace(forgetWords, '').replace(/\b(?:the|my|service|reminders?)\b/gi, '')).toLowerCase();
    const hit = list.find((s) => key && s.what.toLowerCase().includes(key));
    if (!hit) return { text: 'Which one? Say “forget the boiler service”.' };
    await save(d, HOME_KEYS.services, list.filter((s) => s.id !== hit.id));
    await disarm(d, `Service: ${hit.what}`);
    return { text: `Forgot ${hit.what}, and its reminders.` };
  }
  const p = words ? parseService(words, today) : null;
  if (!p) {
    if (!words || !list.length) return { text: list.length ? '' : 'Tell me a date: “boiler service is due 14 March” or “smoke alarms tested on 1 October” (the next one is a year on). I remind you a month before and on the day.' };
    return { text: 'Which service, and when? Say “boiler service is due 14 March”.' };
  }
  let next = p.next;
  if (next < today && p.every) while (next < today) next = addMonths(next, p.every);
  const s: Service = { id: shortId(), what: p.what, next, every: p.every, ...(p.last ? { last: p.last } : {}) };
  await save(d, HOME_KEYS.services, [...list.filter((x) => x.what !== s.what), s].slice(-30));
  const t = `Service: ${s.what}`;
  const a1 = await armDay(d, t, addDays(next, -30) > today ? addDays(next, -30) : addDays(today, 1), `${s.what} is due ${prettyDay(next)}: book it.`);
  const a2 = await armDay(d, t, next, `${s.what} is due today.`);
  return { text: `Kept: ${s.what}, next due ${prettyDay(next, today.slice(0, 4))}${p.last ? ` (done ${prettyDay(p.last, today.slice(0, 4))}, every ${s.every === 12 ? 'year' : s.every % 12 === 0 ? `${s.every / 12} years` : `${s.every} months`})` : ''}. ${a1 || a2 ? `I’ll remind you a month before and on the day, at 9am (in your Agenda).` : 'That day is too close for the month-before reminder.'}`, data: { service: s } };
};

// ---------------------------------------------------------------- what is due, all together

interface DueLine {
  on: string;
  text: string;
}
async function dueLines(d: PackDeps, days = 30): Promise<DueLine[]> {
  const today = todayOf(d);
  const end = addDays(today, days);
  const out: DueLine[] = [];
  for (const b of await billsOf(d)) if (!b.paid && b.due && b.due <= end) out.push({ on: b.due, text: billLine(b, today) });
  const bk = await binsOf(d);
  for (const b of bk.bins) for (const x of binDays(b, bk, today, 3)) if (x <= end) out.push({ on: x, text: `${cap(b.name)} bin collected` });
  for (const c of await listCars(d.storage).catch(() => [])) for (const [what, ym] of [['MOT', c.mot], ['tax', c.tax]] as const) if (ym && ym >= today.slice(0, 7) && `${ym}-01` <= end) out.push({ on: `${ym}-01` > today ? `${ym}-01` : today, text: `${carName(c)}: ${what} due ${monthName(ym)}` });
  for (const i of await insuranceOf(d)) {
    const n = insuranceNext(i, today);
    if (n <= end) out.push({ on: n, text: `${i.whose} insurance renews` });
  }
  for (const s of await services(d)) if (s.next <= end) out.push({ on: s.next, text: `${s.what} due` });
  const r = await load<Rent | null>(d, HOME_KEYS.rent, null);
  if (r) {
    const n = rentOn(r, d);
    if (n <= end) out.push({ on: n, text: `${cap(r.kind)} due${r.amount ? ` (${pounds(r.amount)})` : ''}` });
  }
  for (const w of await load<Warr[]>(d, HOME_KEYS.warranties, [])) if (w.ends >= today && w.ends <= end) out.push({ on: w.ends, text: `${cap(w.thing)} warranty ends` });
  return out.sort((x, y) => x.on.localeCompare(y.on));
}
const due: ActionFn = async (a, d) => {
  const days = Math.min(120, Math.max(1, Math.floor(arg.num(a, 'days', 30))));
  const today = todayOf(d);
  const lines = await dueLines(d, days);
  if (!lines.length) return { text: `Nothing due at home in the next ${days} days that I know of. Tell me bills, bin days, renewals and services and I keep the dates.`, open: sheet('due') };
  return {
    text: `Due at home in the next ${days} days:\n${lines.slice(0, 14).map((x) => `- ${prettyDay(x.on, today.slice(0, 4))}: ${x.text}`).join('\n')}`,
    cards: [card({ id: 'home:due', kind: 'brief', at: d.now(), title: `${lines.length} due at home`, line: `${prettyDay(lines[0]!.on, today.slice(0, 4))}: ${lines[0]!.text}`.slice(0, 110), brief: { icon: 'reminder' }, acts: [{ label: 'OPEN', run: sheet('due') }] })],
    data: { lines },
  };
};

export const HOME: Record<string, ActionFn> = { bill, bills, paid, warranty, manual, renewals, bins, planning, meter, rent, subs, inventory: things, book, council, service, due };
export const HOME_ACTIONS = Object.keys(HOME);

export const homeAdminTools: Tool[] = [
  packTool({
    name: 'home',
    description:
      'His home pack: house admin from his own papers and words and public sources; nothing about any person; nothing bills. bill: keep one from a photo\'s text (text). bills: what is due, or "how much was the gas this year?" (words). paid: mark paid or remove (id, remove). warranty: keep or list (words, text of a receipt, item). manual: the maker\'s own manual page as a link (model, maker). renewals: the family cars\' MOT, tax and insurance dates (words, arm). bins: his bin days (words), a council page (text), a move. planning: applications near home from the national data, else his council said plainly (words, radius). meter: a reading (text, kind). rent: the rent or mortgage day (words). subs: what repeats monthly. inventory: a room\'s things as CSV (room, items, export). book: the house\'s address book (words). council: his council tax band and own registration (band, words). service: a boiler or smoke-alarm date (words). due: all due in days.',
    actions: HOME,
    properties: {
      words: { type: 'string', description: 'his words for it, as he said them' },
      text: { type: 'string', description: 'bill, bins, meter, warranty: the text read off his photo or pasted (a council page, a receipt)' },
      id: { type: 'string', description: 'paid: the bill\'s id' },
      remove: { type: 'boolean', description: 'paid: forget the bill instead of marking it paid' },
      item: { type: 'string', description: 'warranty: what it is' },
      model: { type: 'string', description: 'manual: the model number' },
      maker: { type: 'string', description: 'manual: the make' },
      kind: { type: 'string', enum: ['electricity', 'gas', 'water'], description: 'meter' },
      pence: { type: 'number', description: 'meter: his price per unit in pence, for an estimate' },
      radius: { type: 'number', description: 'planning: metres from home (default 500)' },
      room: { type: 'string', description: 'inventory: which room' },
      items: { type: 'array', items: { type: 'string' }, description: 'inventory: things he confirmed, "a laptop £900"' },
      export: { type: 'boolean', description: 'inventory: give the CSV' },
      band: { type: 'string', description: 'council: his council tax band, A to H' },
      whose: { type: 'string', description: 'renewals: whose insurance' },
      arm: { type: 'boolean', description: 'renewals: set the reminders' },
      days: { type: 'number', description: 'due: how many days ahead (default 30)' },
    },
    reads: ['bills', 'subs', 'due'],
  }),
];

/** The Brief's home lines (mind.ts): bin night, a bill within the week, a service or the rent tomorrow. Also keeps the cars' reminders set. */
export async function homeLines(d: PackDeps): Promise<string[]> {
  const today = todayOf(d);
  const out: string[] = [];
  const bk = await binsOf(d);
  const tomorrow = bk.bins.filter((b) => binDays(b, bk, addDays(today, 1), 1)[0] === addDays(today, 1)).map((b) => b.name);
  const todayBins = bk.bins.filter((b) => binDays(b, bk, today, 1)[0] === today).map((b) => b.name);
  if (tomorrow.length) out.push(`Bins out tonight: ${tomorrow.join(' and ')}`);
  else if (todayBins.length && zoned(d.now(), d.tz).h < 12) out.push(`Bin day today: ${todayBins.join(' and ')}`);
  const next = (await billsOf(d)).filter((b) => !b.paid && b.due && daysBetween(today, b.due) <= 7).sort((x, y) => x.due.localeCompare(y.due))[0];
  if (next) out.push(billLine(next, today));
  for (const s of await services(d)) if (daysBetween(today, s.next) >= 0 && daysBetween(today, s.next) <= 1) out.push(`${s.what} ${daysBetween(today, s.next) === 0 ? 'is due today' : 'is due tomorrow'}`);
  const r = await load<Rent | null>(d, HOME_KEYS.rent, null);
  if (r && daysBetween(today, rentNext(r, today)) === 1) out.push(`${cap(r.kind)} is due tomorrow${r.amount ? ` (${pounds(r.amount)})` : ''}`);
  for (const i of await insuranceOf(d)) if (daysBetween(today, insuranceNext(i, today)) <= 7) out.push(`${i.whose} insurance renews ${prettyDay(insuranceNext(i, today))}`);
  if (await load<boolean>(d, HOME_KEYS.carsArmed, false)) await armCars(d, today).catch(() => 0);
  const w = await planWatch(d);
  if (w.on) await ensureWatchJob(d).catch(() => undefined);
  return out.slice(0, 3);
}
