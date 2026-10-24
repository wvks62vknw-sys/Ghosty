/**
 * WHAT'S IN IT: the foods the Lens's model saw on a plate, matched to figures for a rough total.
 *
 * SOURCE of the table below: energy (kcal), protein, carbohydrate and fat per 100 g, rounded from
 * USDA FoodData Central (SR Legacy and its survey foods, fdc.nal.usda.gov) — a work of the US
 * Government, in the public domain (CC0 1.0). The names are the everyday UK ones; a cooked dish
 * (a pie, a curry, a sandwich) is a typical recipe's figure, so it is rough by nature. About 185
 * foods. Packaged foods (a brand named on the packet) are looked up by name in Open Food Facts
 * (free, no key, ODbL, credited on the card); a food the table does not know is tried there too.
 * Nothing is stored. Never a medical or diet claim: only "about N kcal", rough, and why.
 */
import { checkMeal, forPortion, mealTotals, type Macros, type MealItem, type MealTotal, type SeenFood } from '../../../../packages/shared/src/living';

/** [names (the first is shown, the rest are other ways to say it), kcal, protein g, carbs g, fat g] per 100 g. */
type Row = [string, number, number, number, number];

// prettier-ignore
const ROWS: Row[] = [
  // bread, cereals, grains (cooked weights for rice, pasta and grains)
  ['white bread|bread|toast|sliced bread', 266, 7.6, 50.6, 3.3],
  ['wholemeal bread|brown bread|whole wheat bread|granary bread', 252, 12.4, 42.7, 3.5],
  ['bread roll|roll|bap|bun|barm', 290, 9.5, 50, 5],
  ['baguette|french bread', 272, 10.8, 51.9, 2.4],
  ['croissant', 406, 8.2, 45.8, 21],
  ['bagel', 257, 10, 50.5, 1.6],
  ['crumpet|english muffin', 227, 8.9, 44, 1.8],
  ['naan|naan bread', 290, 9, 50, 6],
  ['pitta|pita|pitta bread', 275, 9.1, 55.7, 1.2],
  ['tortilla wrap|wrap|flour tortilla', 310, 8.3, 51, 8],
  ['garlic bread', 350, 8, 42, 17],
  ['porridge|oatmeal', 71, 2.5, 12, 1.5],
  ['oats|porridge oats|rolled oats', 379, 13.2, 67.7, 6.5],
  ['cornflakes|corn flakes', 357, 7.5, 84, 0.4],
  ['muesli', 340, 9.7, 66, 5],
  ['wheat biscuit cereal|weetabix|shredded wheat|wheat biscuits', 350, 11, 72, 2],
  ['granola|granola bar|cereal bar|flapjack', 471, 10, 64, 20],
  ['cereal|breakfast cereal', 380, 8, 80, 3],
  ['rice|white rice|boiled rice|steamed rice|basmati rice', 130, 2.7, 28.2, 0.3],
  ['brown rice', 112, 2.3, 23.5, 0.8],
  ['fried rice|egg fried rice|pilau rice|pilau|pilaf', 170, 4, 27, 5],
  ['pasta|spaghetti|penne|fusilli|macaroni|tagliatelle', 158, 5.8, 30.9, 0.9],
  ['noodles|egg noodles|ramen noodles', 138, 4.5, 25, 2.1],
  ['couscous', 112, 3.8, 23.2, 0.2],
  ['quinoa', 120, 4.4, 21.3, 1.9],
  ['rice cake|rice cakes', 387, 8, 81, 2.8],
  ['crackers|cream crackers|cracker', 440, 9.5, 68, 14],
  // potatoes
  ['chips|fries|french fries|oven chips|chunky chips', 312, 3.4, 41.4, 14.7],
  ['jacket potato|baked potato', 93, 2.5, 21.2, 0.1],
  ['boiled potatoes|new potatoes|potatoes|potato', 87, 1.9, 20.1, 0.1],
  ['mashed potato|mash|mashed potatoes', 113, 1.9, 16.8, 4.2],
  ['roast potatoes|roasted potatoes|roast potato', 150, 2.6, 24, 5],
  ['sweet potato|sweet potatoes', 90, 2, 20.7, 0.2],
  ['hash brown|hash browns', 265, 2.6, 35, 12.5],
  ['potato wedges|wedges', 200, 3, 28, 9],
  ['crisps|potato crisps|potato chips', 536, 7, 53, 34.6],
  ['tortilla chips|nachos', 489, 7, 63, 23.4],
  ['popcorn', 500, 9, 57, 28],
  // meat, fish, eggs, beans
  ['chicken breast|chicken|grilled chicken|chicken fillet', 165, 31, 0, 3.6],
  ['roast chicken|chicken thigh|chicken leg|chicken drumstick', 239, 27.3, 0, 13.6],
  ['chicken nuggets|nuggets|chicken goujons', 296, 15, 16, 19],
  ['fried chicken|chicken wings|wings', 268, 21, 8.5, 16.5],
  ['chicken curry|chicken tikka masala|tikka masala|korma|butter chicken|curry', 150, 12, 6, 9],
  ['vegetable curry|veg curry|chickpea curry', 100, 2.5, 10, 5.5],
  ['minced beef|beef mince|mince', 254, 25.7, 0, 16],
  ['steak|beef steak|sirloin|rump steak', 250, 27, 0, 15.5],
  ['roast beef|beef', 180, 28, 0, 7.5],
  ['burger|hamburger|beef burger in a bun', 254, 13, 25, 11.5],
  ['cheeseburger', 263, 14, 22, 13],
  ['burger patty|beef patty|beef burger', 270, 25, 0, 18],
  ['sausage|sausages|pork sausage|bangers', 325, 18.5, 1.5, 27],
  ['bacon|back bacon|bacon rashers', 290, 23, 0, 22],
  ['ham|sliced ham', 145, 21, 1.5, 6],
  ['pork chop|pork|roast pork', 230, 26, 0, 14],
  ['lamb|lamb chop|roast lamb', 294, 25, 0, 21],
  ['doner kebab|kebab meat|gyro|shawarma', 230, 16, 5, 16],
  ['salmon|salmon fillet|smoked salmon', 206, 22, 0, 12.4],
  ['tuna|tinned tuna', 116, 25.5, 0, 0.8],
  ['cod|haddock|white fish|baked fish', 105, 22.8, 0, 0.9],
  ['fish in batter|battered fish|fried fish|battered cod|battered haddock', 230, 15, 15, 12],
  ['fish fingers|fish sticks|fish finger', 277, 11, 23, 15.5],
  ['prawns|shrimp|king prawns', 99, 24, 0.2, 0.3],
  ['egg|eggs|boiled egg|poached egg', 155, 12.6, 1.1, 10.6],
  ['fried egg', 196, 13.6, 0.8, 15],
  ['scrambled egg|scrambled eggs', 148, 10, 1.6, 11],
  ['omelette|omelet', 154, 10.6, 0.6, 11.7],
  ['tofu', 76, 8, 1.9, 4.8],
  ['falafel', 333, 13.3, 31.8, 17.8],
  ['baked beans', 94, 4.8, 21, 0.4],
  ['chickpeas|chick peas', 164, 8.9, 27.4, 2.6],
  ['lentils|dal|dhal|daal', 116, 9, 20, 0.4],
  ['kidney beans|beans', 127, 8.7, 22.8, 0.5],
  ['hummus|houmous', 166, 7.9, 14.3, 9.6],
  // dairy
  ['milk|semi skimmed milk|semi-skimmed milk', 50, 3.3, 4.8, 2],
  ['whole milk|full fat milk', 61, 3.2, 4.8, 3.3],
  ['skimmed milk', 34, 3.4, 5, 0.1],
  ['cheese|cheddar|cheddar cheese|grated cheese', 403, 25, 1.3, 33],
  ['mozzarella', 300, 22, 2.2, 22],
  ['cream cheese', 342, 6, 4, 34],
  ['feta', 264, 14, 4, 21],
  ['halloumi', 320, 21, 2, 25],
  ['paneer', 320, 21, 3.6, 25],
  ['yoghurt|yogurt|natural yoghurt|plain yoghurt', 61, 3.5, 4.7, 3.3],
  ['greek yoghurt|greek yogurt', 97, 9, 4, 5],
  ['fruit yoghurt|fruit yogurt|flavoured yoghurt', 99, 4, 19, 1.1],
  ['butter', 717, 0.9, 0.1, 81],
  ['cream|double cream|whipped cream', 340, 2.8, 2.8, 36],
  ['ice cream', 207, 3.5, 23.6, 11],
  ['custard', 122, 3.5, 20, 3.5],
  // vegetables
  ['salad|lettuce|mixed salad|side salad|salad leaves|leaves', 15, 1.4, 2.9, 0.2],
  ['tomato|tomatoes|cherry tomatoes', 18, 0.9, 3.9, 0.2],
  ['cucumber', 15, 0.7, 3.6, 0.1],
  ['carrot|carrots', 41, 0.9, 9.6, 0.2],
  ['peas|garden peas|mushy peas|petits pois', 81, 5.4, 14.5, 0.4],
  ['broccoli', 34, 2.8, 6.6, 0.4],
  ['cauliflower', 25, 1.9, 5, 0.3],
  ['cabbage|red cabbage', 25, 1.3, 5.8, 0.1],
  ['sweetcorn|corn|corn on the cob', 86, 3.3, 19, 1.4],
  ['green beans|runner beans|fine beans', 31, 1.8, 7, 0.2],
  ['onion|onions|red onion', 40, 1.1, 9.3, 0.1],
  ['mushrooms|mushroom', 22, 3.1, 3.3, 0.3],
  ['spinach', 23, 2.9, 3.6, 0.4],
  ['pepper|peppers|bell pepper|red pepper', 31, 1, 6, 0.3],
  ['courgette|zucchini', 17, 1.2, 3.1, 0.3],
  ['avocado', 160, 2, 8.5, 14.7],
  ['coleslaw', 150, 1, 13, 10.5],
  ['olives', 115, 0.8, 6.3, 10.7],
  ['mixed vegetables|vegetables|veg', 65, 2.6, 13, 0.2],
  ['stir fry|stir fried vegetables|stir-fry', 80, 3, 9, 3.5],
  // fruit and juice
  ['apple|apples', 52, 0.3, 13.8, 0.2],
  ['banana|bananas', 89, 1.1, 22.8, 0.3],
  ['orange|oranges|satsuma|clementine|tangerine', 47, 0.9, 11.8, 0.1],
  ['grapes', 69, 0.7, 18, 0.2],
  ['strawberries|strawberry', 32, 0.7, 7.7, 0.3],
  ['blueberries', 57, 0.7, 14.5, 0.3],
  ['raspberries', 52, 1.2, 11.9, 0.7],
  ['pear|pears', 57, 0.4, 15.2, 0.1],
  ['mango', 60, 0.8, 15, 0.4],
  ['pineapple', 50, 0.5, 13.1, 0.1],
  ['melon|watermelon|cantaloupe', 30, 0.6, 7.6, 0.2],
  ['kiwi|kiwi fruit', 61, 1.1, 14.7, 0.5],
  ['raisins|sultanas|dried fruit', 299, 3.1, 79, 0.5],
  ['peach|nectarine', 39, 0.9, 9.5, 0.3],
  ['plum|plums', 46, 0.7, 11.4, 0.3],
  ['cherries', 63, 1.1, 16, 0.2],
  ['orange juice|juice|fruit juice', 45, 0.7, 10.4, 0.2],
  ['apple juice', 46, 0.1, 11.3, 0.1],
  ['smoothie', 60, 0.6, 14, 0.2],
  // sweet things and snacks
  ['chocolate|milk chocolate|chocolate bar', 535, 7.7, 59.4, 29.7],
  ['dark chocolate', 598, 7.8, 45.9, 42.6],
  ['biscuit|biscuits|digestive|digestives', 480, 6.5, 66, 21],
  ['cookie|cookies|chocolate chip cookie', 488, 5, 65, 24],
  ['cake|sponge cake|victoria sponge', 370, 4.5, 55, 15],
  ['chocolate cake|brownie', 371, 5.4, 53, 16.4],
  ['doughnut|donut', 421, 4.9, 49, 23],
  ['muffin|blueberry muffin', 377, 4.4, 53, 16],
  ['scone', 360, 7, 52, 13],
  ['pancake|pancakes', 227, 6.4, 28.3, 9.7],
  ['waffle|waffles', 291, 7.9, 33, 14],
  ['apple crumble|crumble', 220, 2, 33, 9],
  ['sweets|jelly sweets|gummy sweets|gummies', 340, 6.9, 77, 0],
  ['nuts|mixed nuts|peanuts|cashews', 600, 20, 21, 52],
  ['almonds', 579, 21, 21.6, 50],
  ['peanut butter', 588, 25, 20, 50],
  ['jam', 278, 0.4, 69, 0.1],
  ['honey', 304, 0.3, 82.4, 0],
  ['sugar', 387, 0, 100, 0],
  // dishes
  ['pizza|cheese pizza|margherita|margherita pizza', 266, 11.4, 33, 10],
  ['pepperoni pizza', 298, 12.5, 33, 13],
  ['lasagne|lasagna', 150, 8.5, 14, 6.5],
  ['spaghetti bolognese|bolognese|spag bol', 130, 6, 17, 4],
  ["shepherd's pie|shepherds pie|cottage pie", 110, 6, 10, 5],
  ['chilli con carne|chilli|chili', 110, 7, 10, 4.7],
  ['stew|beef stew|casserole', 95, 7, 7, 4.3],
  ['soup|tomato soup|vegetable soup', 35, 0.9, 7, 0.4],
  ['sandwich|ham sandwich|chicken sandwich', 240, 12, 30, 8],
  ['cheese sandwich|toastie|cheese toastie', 280, 12, 28, 13],
  ['sushi|sushi roll|maki', 140, 5, 28, 1],
  ['pie|meat pie|steak pie|pork pie|chicken pie', 270, 8, 25, 15],
  ['sausage roll', 330, 9, 25, 22],
  ['quiche', 250, 10, 15, 17],
  ['pasty|cornish pasty', 260, 7, 26, 14],
  ['burrito', 200, 8, 26, 7],
  ['taco|tacos', 226, 9, 20, 12],
  ['hot dog', 247, 10, 18, 15],
  ['macaroni cheese|mac and cheese|macaroni and cheese', 164, 7, 16, 8],
  ['risotto', 140, 3.5, 20, 5],
  ['spring roll|spring rolls', 250, 5.5, 26, 14],
  ['samosa|samosas', 260, 5, 26, 15],
  ['onion bhaji|bhaji|bhajis', 290, 6, 25, 18],
  ['yorkshire pudding|yorkshire puddings', 230, 8, 26, 10],
  ['gravy', 50, 2, 5, 2.5],
  ['ketchup|tomato ketchup|tomato sauce', 101, 1, 27, 0.1],
  ['mayonnaise|mayo', 680, 1, 0.6, 75],
  ['salad dressing|dressing|vinaigrette', 300, 0.5, 10, 28],
  ['olive oil|oil|vegetable oil', 884, 0, 0, 100],
  // drinks
  ['tea|cup of tea|black tea', 1, 0, 0.3, 0],
  ['coffee|black coffee|espresso|americano', 1, 0.1, 0, 0],
  ['latte|cappuccino|flat white|white coffee', 55, 3, 4.5, 2.8],
  ['hot chocolate', 77, 3.5, 11, 2.3],
  ['milkshake', 112, 3.9, 18, 3],
  ['cola|coke|fizzy drink|soft drink|lemonade', 42, 0, 10.6, 0],
  ['diet cola|diet coke|coke zero|diet drink|sugar free drink', 1, 0, 0, 0],
  ['beer|lager|ale|pint|bitter', 43, 0.5, 3.6, 0],
  ['wine|red wine|white wine|rose wine', 83, 0.1, 2.6, 0],
  ['water|sparkling water', 0, 0, 0, 0],
];

/** One food of the table. */
export interface FoodRow {
  name: string;
  names: string[];
  per100: Macros;
}

export const FOODS: FoodRow[] = ROWS.map(([names, kcal, protein, carbs, fat]) => {
  const all = names.split('|');
  return { name: all[0]!, names: all, per100: { kcal, protein, carbs, fat } };
});

/** Words that say how it is served, not what it is. */
const FILLER = new Set(['a', 'an', 'the', 'some', 'of', 'with', 'and', 'on', 'side', 'slice', 'slices', 'piece', 'pieces', 'portion', 'bowl', 'plate', 'cup', 'glass', 'serving', 'small', 'large', 'big', 'little', 'half', 'whole', 'fresh', 'homemade', 'home', 'made']);
/** "Sausages" and "sausage", "chips" and "chip" are the same word here. */
const stem = (w: string): string => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export function foodWords(s: string): string[] {
  return String(s ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .map(stem);
}

const INDEX = FOODS.flatMap((row) => row.names.map((n) => ({ row, words: foodWords(n), chars: n.length })));

/**
 * The table's food for a name the model gave: the longest of the table's names whose every word is
 * in it ("diet coke" over "coke", "fried egg" over "egg"), else the shortest table name that holds
 * all of the name's words ("pizza slice" → pizza). Null when nothing fits: never a guess.
 */
export function matchFood(name: string): FoodRow | null {
  const words = foodWords(name);
  if (!words.length) return null;
  const have = new Set(words);
  let best: { row: FoodRow; n: number; chars: number } | null = null;
  for (const e of INDEX) {
    if (!e.words.length || !e.words.every((w) => have.has(w))) continue;
    if (!best || e.words.length > best.n || (e.words.length === best.n && e.chars > best.chars)) best = { row: e.row, n: e.words.length, chars: e.chars };
  }
  if (best) return best.row;
  let wide: { row: FoodRow; n: number } | null = null;
  for (const e of INDEX) {
    const set = new Set(e.words);
    if (words.every((w) => set.has(w)) && (!wide || e.words.length < wide.n)) wide = { row: e.row, n: e.words.length };
  }
  return wide?.row ?? null;
}

const UA = 'Ghosty/2.0 (personal assistant; single user)';
export const OFF_CREDIT = 'Packaged foods: Open Food Facts (ODbL)';
/** At most this many Open Food Facts searches for one meal. */
const MAX_SEARCHES = 4;

/** A packaged food by name in Open Food Facts → its per-100 g figures (energy needed), or null. */
export async function searchOff(name: string, f: typeof fetch = fetch): Promise<{ title: string; per100: Macros } | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?${new URLSearchParams({ search_terms: name, search_simple: '1', action: 'process', json: '1', page_size: '5', fields: 'product_name,brands,nutriments' })}`;
  const r = await f(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { products?: { product_name?: unknown; brands?: unknown; nutriments?: Record<string, unknown> }[] } | null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
  for (const p of j?.products ?? []) {
    const n = p.nutriments ?? {};
    const kcal = num(n['energy-kcal_100g']);
    const title = [p.product_name, p.brands].filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim().split(',')[0]).join(', ').slice(0, 80);
    if (kcal == null || !title) continue;
    return { title, per100: { kcal, protein: num(n.proteins_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0, fat: num(n.fat_100g) ?? 0 } };
  }
  return null;
}

/**
 * The meal: each food matched (a packaged one in Open Food Facts first, everything else in the
 * table first, then the other), its portion's figures, and the rough total with its honesty line.
 * A food nothing matches is listed as not counted.
 */
export async function lookupMeal(foods: SeenFood[], deps: { fetch?: typeof fetch } = {}): Promise<MealTotal & { credit?: string }> {
  let searches = 0;
  let usedOff = false;
  const off = async (name: string) => {
    if (searches >= MAX_SEARCHES) return null;
    searches++;
    return searchOff(name, deps.fetch ?? fetch).catch(() => null);
  };
  const items: MealItem[] = [];
  for (const f of foods.slice(0, 12)) {
    const table = matchFood(f.name);
    const fromOff = f.packaged || !table ? await off(f.name) : null;
    if (fromOff && (f.packaged || !table)) {
      usedOff = true;
      items.push({ ...f, match: fromOff.title, from: 'Open Food Facts', macros: forPortion(fromOff.per100, f.grams) });
    } else if (table) items.push({ ...f, match: table.name, from: 'table', macros: forPortion(table.per100, f.grams) });
    else items.push({ ...f, match: '', from: 'none' });
  }
  const t = mealTotals(items);
  return usedOff ? { ...t, credit: OFF_CREDIT } : t;
}

/** The meal a request sent (POST /api/lookup/barcode {meal}), checked the same way as the model's reply. */
export const mealFromBody = (meal: unknown): SeenFood[] => checkMeal(JSON.stringify({ foods: Array.isArray(meal) ? meal : [] }))?.foods ?? [];
