/**
 * THE KITCHEN PACK, the pure parts (BRIEF-PACKS-1 item 3): timers in his words ("timer 8 minutes for the pasta", several
 * at once), dishes from what he has (TheMealDB's free open tier, read by the brain's tools/kitchen.ts, or the list below
 * that is Ghosty's own), each with its time and steps, a dish's time worked out from the times in its steps, portions,
 * unit conversions, the oven line, the shopping list shared as text, the week's meal plan, a use-it-up list and leftovers.
 * No storage, no network here. Every number says what it assumed.
 */
import { card, type Card } from './cards';
import { addDays, dayWords, listWords, weekdayOf } from './packs';

// ---------------------------------------------------------------- timers

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90 };
const n = (s: string): number => (NUM[s.toLowerCase()] ?? Number(s));
const UNIT = '(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)';
const DUR = new RegExp(`(?:(half an?|\\d+(?:\\.\\d+)?|${Object.keys(NUM).join('|')})\\s*${UNIT}\\b(?:\\s*(?:and\\s*)?(?:(a half)|(\\d+)\\s*(?:minutes?|mins?|m|seconds?|secs?|s)?\\b))?)`, 'gi');

/** Seconds in a span of words ("8 minutes", "1 hour 20", "an hour and a half", "half an hour", "90 seconds", "1h20"). */
export function secondsIn(words: string): number | null {
  const w = words.toLowerCase().replace(/(\d)h(\d)/g, '$1 h $2');
  let total = 0;
  let any = false;
  for (const m of w.matchAll(DUR)) {
    const head = m[1]!;
    const unit = m[2]!;
    const per = /^h/.test(unit) ? 3600 : /^m/.test(unit) ? 60 : 1;
    total += (head.startsWith('half') ? 0.5 : n(head)) * per;
    if (m[3]) total += per / 2;
    else if (m[4]) total += Number(m[4]) * (per === 3600 ? 60 : per === 60 ? 1 : 0);
    any = true;
  }
  return any && total > 0 ? Math.round(total) : null;
}

export type TimerAsk = { start: { secs: number; name: string }[] } | { stop: string } | { list: true };
/**
 * Timer words: "timer 8 minutes for the pasta", "set a 10 minute timer", "egg timer 4 mins", "timers: pasta 8 minutes,
 * rice 12 minutes", "stop the pasta timer", "cancel all timers", "how long left on the timers?". Null when it is not a timer.
 */
export function timerAsked(text: string): TimerAsk | null {
  const t = text.trim();
  if (!/\btimers?\b/i.test(t) || t.length > 160) return null;
  const stop = /^(?:stop|cancel|kill|end|clear|turn off)\s+(?:the\s+|my\s+)?(.*?)\s*timers?[.!]?$/i.exec(t) ?? /^(?:stop|cancel)\s+(?:the\s+|my\s+)?timers?\s+(?:for\s+(?:the\s+)?)?(.*?)[.!]?$/i.exec(t);
  if (stop) return { stop: /^all$/i.test(stop[1]!.trim()) ? '' : stop[1]!.trim().toLowerCase() };
  if (/^(?:how long|how much time)\b.*\btimers?\b|^(?:my |the )?timers\??$|^show (?:me )?(?:the |my )?timers?[.!?]?$/i.test(t)) return { list: true };
  const parts = t.replace(/^(?:set|start|put on|make)\s+(?:a|an|the|me a)?\s*/i, '').split(/,|;|\band\b(?=\s+(?:\d|a\s(?!half)|an\s|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty))|\band\s+(?=\w+\s+\d)/i);
  const out: { secs: number; name: string }[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    const secs = secondsIn(p);
    if (!secs) continue;
    const name =
      /\bfor (?:the |my |a |an |some )?([a-z][a-z' -]{0,30}?)\s*(?:timer)?[.!]?$/i.exec(p)?.[1] ??
      /^([a-z][a-z' -]{0,30}?)\s+(?:timer\s+)?(?:\d|a\s|an\s|half|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty)/i.exec(p.replace(/^timers?:?\s*/i, ''))?.[1] ??
      '';
    const clean = name.replace(/\b(?:timer|minutes?|mins?|hours?|seconds?|the|a|an|egg timer)\b/gi, '').trim().replace(/^(?:for|in|of|at|to|on|set|start)$/i, '');
    out.push({ secs: Math.min(secs, 24 * 3600), name: clean || (/\begg\b/i.test(p) ? 'eggs' : '') });
  }
  if (!out.length) return null;
  return { start: out.map((x, i) => ({ ...x, name: x.name || (out.length > 1 ? `timer ${i + 1}` : 'timer') })) };
}
/** "shopping list", "show me my shopping list": the phone opens it, no model. */
export const shoppingAsked = (t: string): boolean => /^(?:(?:show|open|see)(?: me)? )?(?:the |my )?(?:shopping|grocery) list[?.!]?$/i.test(t.trim());
/** "fan 180 in conventional?", "what's gas mark 4?": the oven line, answered on the phone (null when it is not that). */
export const ovenAsked = (t: string): string | null => (t.length <= 80 && /\b(?:fan|gas mark|conventional)\b/i.test(t) && /\b(?:what|in|to|convert|is)\b|\?/i.test(t) ? ovenWords(t) : null);

/** "8:00", "1:20:00". */
export function mmss(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
/** "8 minutes", "1 hour 20 minutes", "45 seconds". */
export function spanWords(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h ? `${h} hour${h === 1 ? '' : 's'}` : '', m ? `${m} minute${m === 1 ? '' : 's'}` : '', s && !h ? `${s} second${s === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ') || '0 seconds';
}

// ---------------------------------------------------------------- dishes

export interface Dish {
  id: string;
  name: string;
  /** Where it is from ("TheMealDB" or "Ghosty’s own list"), with the link when there is one. */
  from: string;
  url?: string;
  ingredients: { name: string; measure: string }[];
  steps: string[];
  /** Minutes, from the times in its steps plus 10 to prepare; null when it gives none. */
  mins: number | null;
}

/** The minutes a recipe's own words give ("simmer for 20 minutes", "bake 25-30 mins", "1 hour"), the top of each range. */
export function minutesInSteps(text: string): number {
  let total = 0;
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|minutes?|mins?)\b/gi)) {
    const v = Number(m[2] ?? m[1]);
    total += /^h/i.test(m[3]!) ? v * 60 : v;
  }
  return Math.min(240, Math.round(total));
}

/** One TheMealDB meal (lookup.php) → a dish: its ingredients with their measures, its steps, its time. */
export function mealDish(meal: Record<string, unknown>): Dish {
  const ingredients: Dish['ingredients'] = [];
  for (let i = 1; i <= 20; i++) {
    const name = String(meal[`strIngredient${i}`] ?? '').trim();
    if (name) ingredients.push({ name, measure: String(meal[`strMeasure${i}`] ?? '').trim() });
  }
  const text = String(meal.strInstructions ?? '');
  const steps = text
    .split(/\r?\n+|(?=\bSTEP \d+\b)/i)
    .map((s) => s.replace(/^\s*(?:STEP\s*)?\d+[.):]?\s*/i, '').trim())
    .filter((s) => s.length > 3)
    .slice(0, 14)
    .map((s) => s.slice(0, 320));
  const inSteps = minutesInSteps(text);
  return { id: `mealdb:${String(meal.idMeal ?? '')}`, name: String(meal.strMeal ?? 'A dish').trim(), from: 'TheMealDB', url: `https://www.themealdb.com/meal/${String(meal.idMeal ?? '')}`, ingredients, steps, mins: inSteps ? inSteps + 10 : null };
}

/** His words → ingredient names as TheMealDB writes them in its filter ("chicken breast" → "chicken_breast"). */
export function haveList(words: string): string[] {
  return listWords(words.replace(/^(?:i(?:'ve| have)? got|i have|we have|there(?:'s| is)|what can i make with|what can i cook with|make (?:something|dinner) (?:with|from))\s*/i, ''))
    .map((s) => s.toLowerCase().replace(/\b(?:some|a few|leftover|half a|a bit of|bits of|packet of|tin of|tins of|bag of)\b/g, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s && s.length <= 30)
    .slice(0, 12);
}
const stem = (s: string) => s.toLowerCase().replace(/(?:es|s)$/, '').replace(/\s+/g, ' ').trim();
/** How many of a dish's ingredients he has (a loose match: "peppers" is "red pepper"), and what he would need. */
export function haveOf(d: Dish, have: string[]): { got: number; need: string[] } {
  const hs = have.map(stem);
  const PANTRY = /^(salt|pepper|black pepper|water|oil|olive oil|vegetable oil|sunflower oil)$/i;
  let got = 0;
  const need: string[] = [];
  for (const i of d.ingredients) {
    const name = stem(i.name);
    if (hs.some((h) => name.includes(h) || h.includes(name))) got++;
    else if (!PANTRY.test(i.name.trim())) need.push(i.name.toLowerCase());
  }
  return { got, need };
}

/** Ghosty's own list: simple UK dinners for when the free source is down or has nothing that fits. */
export const OWN_DISHES: Dish[] = [
  own('Spaghetti bolognese', 40, ['mince', 'onion', 'garlic', 'chopped tomatoes', 'spaghetti', 'olive oil'], ['Fry the chopped onion and garlic in a little oil for 5 minutes.', 'Add the mince and brown it, breaking it up, 8 minutes.', 'Add the tomatoes, season, and simmer 20 minutes.', 'Cook the spaghetti as the packet says and serve with the sauce.']),
  own('Chicken stir-fry', 25, ['chicken', 'peppers', 'onion', 'garlic', 'soy sauce', 'rice'], ['Put the rice on as the packet says.', 'Slice the chicken thin and fry it hot for 6 minutes until cooked through.', 'Add the sliced peppers, onion and garlic for 4 minutes.', 'Splash in soy sauce, toss, and serve on the rice.']),
  own('Cheese omelette', 10, ['eggs', 'cheese', 'butter'], ['Beat 3 eggs with a pinch of salt.', 'Melt butter in a pan on a medium heat, pour the eggs in, stir gently 1 minute.', 'Scatter the grated cheese over, fold, and slide it out.']),
  own('Chilli con carne', 45, ['mince', 'kidney beans', 'chopped tomatoes', 'onion', 'chilli powder', 'rice'], ['Fry the onion 5 minutes, add the mince and brown it.', 'Stir in chilli powder, then the tomatoes and drained beans.', 'Simmer 25 minutes, stirring now and then.', 'Serve with rice.']),
  own('Egg fried rice', 20, ['rice', 'eggs', 'peas', 'soy sauce', 'spring onions'], ['Use cooked, cold rice (yesterday’s is best).', 'Scramble 2 eggs in a hot pan with oil, then push them aside.', 'Add the rice and peas, fry 5 minutes, add soy sauce and the spring onions.']),
  own('Chicken curry', 40, ['chicken', 'onion', 'curry paste', 'chopped tomatoes', 'rice'], ['Fry the onion 5 minutes, add 2 tablespoons of curry paste for 1 minute.', 'Add the diced chicken and brown it.', 'Add the tomatoes and simmer 20 minutes until the chicken is cooked through.', 'Serve with rice.']),
  own('Sausage and mash', 35, ['sausages', 'potatoes', 'butter', 'milk', 'onion'], ['Grill or bake the sausages 20 to 25 minutes, turning, until cooked through.', 'Boil the peeled potatoes 20 minutes, drain, mash with butter and a splash of milk.', 'Fry a sliced onion slowly for gravy if you like.']),
  own('Tuna pasta bake', 35, ['pasta', 'tuna', 'sweetcorn', 'chopped tomatoes', 'cheese'], ['Cook the pasta 2 minutes less than the packet says.', 'Mix with the tuna, sweetcorn and tomatoes in an oven dish.', 'Top with grated cheese and bake at fan 180 for 20 minutes.']),
  own('Cheese toastie', 10, ['bread', 'cheese', 'butter'], ['Butter the outsides of two slices.', 'Fill with grated cheese.', 'Fry in a pan 3 minutes a side, pressing down, until golden.']),
  own('Vegetable soup', 40, ['onion', 'carrots', 'potatoes', 'stock cube', 'leek'], ['Fry the chopped onion and leek 5 minutes.', 'Add the diced carrots and potatoes and a litre of stock.', 'Simmer 25 minutes, then blend or mash.']),
  own('Shakshuka', 25, ['eggs', 'peppers', 'onion', 'chopped tomatoes', 'garlic'], ['Fry the onion, peppers and garlic 8 minutes.', 'Add the tomatoes and simmer 10 minutes.', 'Make hollows, crack in the eggs, cover and cook 5 minutes.']),
  own('Jacket potato with beans', 15, ['potatoes', 'baked beans', 'cheese', 'butter'], ['Prick the potatoes and microwave 8 to 10 minutes until soft (or bake an hour at fan 200).', 'Heat the beans.', 'Split, butter, fill with beans and grated cheese.']),
];
function own(name: string, mins: number, ingredients: string[], steps: string[]): Dish {
  return { id: `own:${name.toLowerCase().replace(/[^a-z]+/g, '-')}`, name, from: 'Ghosty’s own list', ingredients: ingredients.map((x) => ({ name: x, measure: '' })), steps, mins };
}
/** Ghosty's own dishes he has most of, best first (at least two of its things). */
export function ownFor(have: string[], n = 3): Dish[] {
  return OWN_DISHES.map((d) => ({ d, h: haveOf(d, have) }))
    .filter((x) => x.h.got >= 2)
    .sort((a, b) => b.h.got - a.h.got || a.h.need.length - b.h.need.length)
    .slice(0, n)
    .map((x) => x.d);
}

export function dishWords(d: Dish, have: string[]): string {
  const h = haveOf(d, have);
  return `${d.name} (${d.mins ? `about ${d.mins} min` : 'no time given'}${have.length ? `; you have ${h.got} of its ${d.ingredients.length} things${h.need.length ? `, you'd need ${h.need.slice(0, 5).join(', ')}` : ''}` : ''})`;
}
export function dishesCard(dishes: Dish[], at = Date.now()): Card {
  return card({
    id: `kitchen:dishes:${dishes.map((d) => d.id).join(',')}`, kind: 'brief', at, title: 'Dinner ideas for tonight',
    line: dishes.map((d) => `${d.name}${d.mins ? ` ${d.mins} min` : ''}`).join(' · '), brief: { icon: 'diary' },
    acts: [{ label: 'HOW DO I MAKE IT?', ask: `How do I make ${dishes[0]?.name ?? 'it'}?` }, { label: 'ADD TO PLAN', ask: `Put ${dishes[0]?.name ?? 'it'} on tonight's meal plan` }],
  });
}

// ---------------------------------------------------------------- portions, conversions, the oven

const FRACS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
/** A recipe's amounts scaled from `from` to `to` people: grams to the nearest 5 over 50, counts to a half (said when rounded). */
export function scaleLines(text: string, from: number, to: number): { lines: string[]; rounded: boolean } {
  const k = to / from;
  let rounded = false;
  const lines = text
    .split(/\r?\n|,(?![^(]*\))/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l.replace(/(\d+)\s*([½¼¾⅓⅔])|(\d+)\/(\d+)|(\d+(?:\.\d+)?)|([½¼¾⅓⅔])/g, (all, w, f, a, b, num, lone, at: number, src: string) => {
        const v = w ? Number(w) + FRACS[f]! : a ? Number(a) / Number(b) : num ? Number(num) : FRACS[lone]!;
        const unit = src.slice(at + all.length).trimStart();
        const grams = /^(?:g|grams?|ml|millilit)/i.test(unit);
        let out = v * k;
        if (grams && out >= 50) out = Math.round(out / 5) * 5;
        else if (!/^(?:kg|l|litres?|tsp|tbsp|teaspoons?|tablespoons?|cups?|oz|lb)/i.test(unit) && !grams) {
          const half = Math.round(out * 2) / 2;
          if (Math.abs(half - out) > 0.01) rounded = true;
          out = half;
        } else out = Math.round(out * 100) / 100;
        return String(Number(out.toFixed(2)));
      }),
    );
  return { lines, rounded };
}

/** Grams in a US cup (237 ml) of the things recipes measure in cups. */
export const CUP_GRAMS: Record<string, number> = { flour: 125, 'plain flour': 125, 'self-raising flour': 125, sugar: 200, 'caster sugar': 200, 'brown sugar': 220, 'icing sugar': 120, butter: 227, rice: 185, oats: 90, 'cocoa': 85, honey: 340, 'grated cheese': 100, cheese: 100, milk: 245, water: 237, 'chocolate chips': 170, raisins: 150, nuts: 140 };
const VOL_ML: Record<string, number> = { cup: 236.6, cups: 236.6, tbsp: 15, tablespoon: 15, tablespoons: 15, tsp: 5, teaspoon: 5, teaspoons: 5, 'fl oz': 28.41, 'fluid ounce': 28.41, 'fluid ounces': 28.41, pint: 568.3, pints: 568.3, ml: 1, l: 1000, litre: 1000, litres: 1000 };
const MASS_G: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, oz: 28.35, ounce: 28.35, ounces: 28.35, lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6 };
/**
 * "200 g of flour in cups", "1 cup of sugar in grams", "350 f in c", "2 oz in grams", "1 pint in ml", "3 tbsp in ml": the
 * answer and what it assumed (a US cup, a UK pint, the thing's own weight a cup). Null when the words are not a conversion.
 */
export function convertWords(words: string): string | null {
  const w = words.toLowerCase().replace(/fluid ounces?/g, 'fl oz').replace(/°/g, ' ');
  const temp = /(-?\d+(?:\.\d+)?)\s*(c|f|celsius|fahrenheit)\b.*\b(?:in|to|into)\s+(c|f|celsius|fahrenheit)\b/.exec(w);
  if (temp) {
    const v = Number(temp[1]);
    const toF = /^c/.test(temp[2]!) && /^f/.test(temp[3]!);
    const toC = /^f/.test(temp[2]!) && /^c/.test(temp[3]!);
    if (toF) return `${v} °C is ${Math.round((v * 9) / 5 + 32)} °F.`;
    if (toC) return `${v} °F is ${Math.round(((v - 32) * 5) / 9)} °C.`;
  }
  const m = /(\d+(?:\.\d+)?|[½¼¾])\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|fl oz|pints?|ml|l|litres?|g|grams?|kg|oz|ounces?|lbs?|pounds?)\b(?:\s+of)?\s*([a-z -]*?)\s+(?:in|to|into)\s+(cups?|tbsp|tablespoons?|tsp|teaspoons?|fl oz|pints?|ml|l|litres?|g|grams?|kg|oz|ounces?|lbs?|pounds?)\b/.exec(w);
  if (!m) return null;
  const v = FRACS[m[1]!] ?? Number(m[1]);
  const [from, thing, to] = [m[2]!, m[3]!.trim(), m[4]!];
  const nice = (x: number) => (x >= 100 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));
  if (VOL_ML[from] && VOL_ML[to]) return `${m[1]} ${from} is ${nice((v * VOL_ML[from]!) / VOL_ML[to]!)} ${to}. Assumed: a US cup (237 ml), a UK pint (568 ml), UK fluid ounces.`;
  if (MASS_G[from] && MASS_G[to]) return `${m[1]} ${from} is ${nice((v * MASS_G[from]!) / MASS_G[to]!)} ${to}.`;
  const per = CUP_GRAMS[thing] ?? CUP_GRAMS[thing.replace(/s$/, '')];
  if (!per) return `To turn ${from} into ${to} I need what it is (flour, sugar, butter, rice…): a cup of flour and a cup of sugar weigh different amounts.`;
  const gPerMl = per / 236.6;
  if (VOL_ML[from] && MASS_G[to]) return `${m[1]} ${from} of ${thing} is about ${nice((v * VOL_ML[from]! * gPerMl) / MASS_G[to]!)} ${to}. Assumed: a US cup of ${thing} weighs ${per} g, spooned and levelled.`;
  if (MASS_G[from] && VOL_ML[to]) return `${m[1]} ${from} of ${thing} is about ${nice((v * MASS_G[from]!) / gPerMl / VOL_ML[to]!)} ${to}. Assumed: a US cup of ${thing} weighs ${per} g, spooned and levelled.`;
  return null;
}

/** The gas marks: °C conventional, °F. Fan is 20 °C below conventional. */
export const GAS: [number, number, number][] = [[1, 140, 275], [2, 150, 300], [3, 170, 325], [4, 180, 350], [5, 190, 375], [6, 200, 400], [7, 220, 425], [8, 230, 450], [9, 240, 475]];
/** "fan 180", "gas mark 4", "200 conventional", "350 f" → the same heat on every kind of oven. Null when it names no heat. */
export function ovenWords(words: string): string | null {
  const w = words.toLowerCase();
  let conv: number | null = null;
  const gas = /gas(?: mark)?\s*(\d)\b/.exec(w);
  const f = /(\d{3})\s*(?:°\s*)?(?:f|fahrenheit)\b/.exec(w);
  const fan = /\bfan\s*(?:oven\s*)?(?:at\s*)?(\d{2,3})|(\d{2,3})\s*(?:°\s*)?c?\s*fan\b/.exec(w);
  const c = /(\d{2,3})\s*(?:°\s*)?(?:c\b|celsius|degrees)|(?:conventional|electric)\s*(?:oven\s*)?(?:at\s*)?(\d{2,3})|(\d{2,3})\s*(?:°\s*)?c?\s*(?:conventional|electric)/.exec(w);
  if (gas) conv = GAS.find((g) => g[0] === Number(gas[1]))?.[1] ?? null;
  // °F: the gas table's own row when it is one (350 °F is gas 4, 180 °C), else worked out to the nearest 5
  else if (f) conv = GAS.find((g) => Math.abs(g[2] - Number(f[1])) <= 5)?.[1] ?? Math.round(((Number(f[1]) - 32) * 5) / 9 / 5) * 5;
  else if (fan) conv = Number(fan[1] ?? fan[2]) + 20;
  else if (c) conv = Number(c[1] ?? c[2] ?? c[3]);
  if (conv === null || conv < 50 || conv > 300) return null;
  const g = [...GAS].sort((a, b) => Math.abs(a[1] - conv!) - Math.abs(b[1] - conv!))[0]!;
  const fahr = g[1] === conv ? g[2] : Math.round(((conv * 9) / 5 + 32) / 5) * 5;
  return `${conv} °C conventional = fan ${conv - 20} °C = gas mark ${g[0]}${Math.abs(g[1] - conv) > 5 ? ' (nearest)' : ''} = ${fahr} °F. Assumed: a fan oven runs 20 °C hotter than its dial.`;
}

// ---------------------------------------------------------------- the shopping list, the plan, use-it-up, leftovers

export interface ShopItem {
  id: string;
  text: string;
  done: boolean;
  at: number;
}
/** The list as text to send to someone: what is left, then (struck) what is got. */
export function shopText(list: ShopItem[]): string {
  const left = list.filter((x) => !x.done);
  const got = list.filter((x) => x.done);
  return ['Shopping list', ...left.map((x) => `• ${x.text}`), ...(got.length ? ['', `Got: ${got.map((x) => x.text).join(', ')}`] : [])].join('\n');
}
/** "add milk, eggs and bread to the list" → the things; "tick milk", "remove the eggs" → which. */
export const shopWords = (words: string): string[] =>
  listWords(words.replace(/^(?:please\s+)?(?:add|put|get|buy|need|we need|i need|tick(?: off)?|cross off|got|remove|take off|delete)\s+/i, '').replace(/\s+(?:to|on|from|off)\s+(?:the|my)\s+(?:shopping\s+)?list\b.*$/i, ''));

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_RE: [RegExp, number][] = [[/\bmon(?:day)?\b/i, 0], [/\btue(?:s|sday)?\b/i, 1], [/\bwed(?:nesday)?\b/i, 2], [/\bthu(?:r|rs|rsday)?\b/i, 3], [/\bfri(?:day)?\b/i, 4], [/\bsat(?:urday)?\b/i, 5], [/\bsun(?:day)?\b/i, 6]];
/** "pasta bake on Tuesday", "Monday: chilli, Friday: fish and chips", "tonight: curry" → day index (Monday 0) → dish. */
export function planWords(words: string, today: string): Record<number, string> {
  const out: Record<number, string> = {};
  const todayIdx = (weekdayOf(today) + 6) % 7;
  // each part names its day; a part with none ("fish, chips") belongs to the part before it
  const parts: string[] = [];
  for (const raw of words.split(/[;,\n]/)) {
    const p = raw.trim();
    if (!p) continue;
    if (parts.length && !DAY_RE.some(([re]) => re.test(p)) && !/\b(?:tonight|today|tomorrow)\b/i.test(p)) parts[parts.length - 1] += `, ${p}`;
    else parts.push(p);
  }
  for (const p of parts) {
    let idx = /\btonight|today\b/i.test(p) ? todayIdx : /\btomorrow\b/i.test(p) ? (todayIdx + 1) % 7 : -1;
    for (const [re, i] of DAY_RE) if (idx < 0 && re.test(p)) idx = i;
    if (idx < 0) continue;
    const dish = p
      .replace(/\b(?:on|for)\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*:?|\btonight'?s?\b|\btoday'?s?\b|\btomorrow'?s?\b|\b(?:put|plan|have|having|we'?re having|dinner|tea|is|meal plan|on the|on|for)\b|:/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (dish) out[idx] = dish.slice(0, 60);
  }
  return out;
}
export function planCard(week: string, days: string[], at = Date.now()): Card {
  const set = days.map((d, i) => (d ? `${DAYS[i]} ${d}` : '')).filter(Boolean);
  return card({ id: `kitchen:plan:${week}`, kind: 'brief', at, title: 'This week’s dinners', line: set.join(' · ') || 'Nothing planned yet', brief: { icon: 'diary' }, acts: [{ label: 'EDIT THE PLAN', run: { name: 'open_kitchen', args: { what: 'plan' } } }] });
}

export interface UseUp {
  name: string;
  by: string;
}
/** "the spinach is going off in 2 days", "chicken use by Thursday", "milk goes off tomorrow" → what and by when. */
export function useUpWords(words: string, today: string): UseUp[] {
  const w = words.toLowerCase();
  const inDays = /\bin (\d+|a|one|two|three|four|five) days?\b/.exec(w);
  const dayName = DAY_RE.find(([re]) => re.test(w));
  let by = inDays ? addDays(today, n(inDays[1]!)) : dayWords(w, today);
  if (!by && dayName) {
    const want = (dayName[1] + 1) % 7;
    let d = addDays(today, 1);
    while (weekdayOf(d) !== want) d = addDays(d, 1);
    by = d;
  }
  if (!by) by = addDays(today, 2);
  const names = listWords(w.replace(/\b(?:the|my|is|are|going|goes|go|off|use|used|by|before|in \S+ days?|today|tomorrow|this|next|mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/g, ' '));
  return names.map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x && !/^\d+$/.test(x)).map((name) => ({ name: name.slice(0, 40), by }));
}

/** Leftovers: eaten within two days (rice within one), the Food Standards Agency's rule; the day to eat them by. */
export function leftoversBy(what: string, today: string): { by: string; days: number } {
  const days = /\brice\b/i.test(what) ? 1 : 2;
  return { by: addDays(today, days), days };
}
