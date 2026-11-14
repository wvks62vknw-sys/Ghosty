/**
 * ROUGH CALORIES AND PROTEIN PER MEAL (NEXT ROUND, BODY AND KITCHEN lane, body.s7): from a recipe's own ingredient lines and a
 * small built-in table of common foods (typical UK values per 100 g, rounded), worked out on the phone. Always a first estimate:
 * brands, cuts and portions vary, and a line the table doesn't know is left out and named. Never advice.
 */

/** kcal and protein (g) per 100 g, the weight of one "unit" (an egg, an onion, a tin), and a typical amount in a dish for two (g). */
const FOODS: [RegExp, number, number, number, number][] = [
  [/stock cube/, 250, 10, 10, 10],
  [/spring onion/, 32, 2, 15, 30],
  [/baked beans/, 90, 5, 415, 415],
  [/soy sauce/, 60, 8, 0, 15],
  [/curry paste/, 200, 3, 0, 30],
  [/chilli powder|paprika|cumin|spice/, 300, 12, 0, 5],
  [/spaghetti|pasta|penne|fusilli|macaroni|noodles?/, 355, 12, 0, 180],
  [/rice/, 350, 7, 0, 150],
  [/bread|toast/, 250, 9, 40, 80],
  [/potato/, 77, 2, 200, 400],
  [/mince|beef/, 250, 26, 0, 400],
  [/chicken/, 165, 31, 150, 300],
  [/sausage/, 260, 13, 60, 360],
  [/bacon/, 215, 16, 25, 100],
  [/salmon/, 208, 20, 120, 240],
  [/tuna/, 116, 26, 145, 145],
  [/egg/, 143, 13, 55, 165],
  [/cheese|cheddar|parmesan|mozzarella/, 400, 25, 0, 60],
  [/butter/, 740, 1, 0, 15],
  [/milk/, 50, 3.4, 0, 100],
  [/cream/, 340, 2, 0, 100],
  [/yoghurt|yogurt/, 60, 5, 0, 150],
  [/(?:olive |vegetable |sunflower )?oil/, 880, 0, 0, 15],
  [/onion/, 40, 1, 150, 150],
  [/garlic/, 150, 6, 5, 10],
  [/pepper(?!corn)/, 30, 1, 160, 160],
  [/carrot/, 41, 1, 80, 160],
  [/leek/, 61, 1.5, 150, 150],
  [/peas/, 80, 5, 0, 100],
  [/sweetcorn|corn/, 86, 3, 0, 160],
  [/mushroom/, 22, 3, 20, 150],
  [/spinach/, 23, 3, 0, 100],
  [/broccoli/, 34, 3, 300, 300],
  [/chopped tomatoes|tinned tomatoes|passata/, 32, 1.5, 400, 400],
  [/tomato/, 18, 1, 100, 200],
  [/kidney beans|chickpeas|lentils|beans/, 115, 8, 240, 240],
  [/flour/, 360, 10, 0, 50],
  [/sugar/, 400, 0, 0, 20],
  [/oats/, 380, 13, 0, 80],
  [/banana/, 89, 1, 120, 120],
  [/apple/, 52, 0.3, 150, 150],
  [/tofu/, 120, 13, 0, 200],
  [/lamb/, 280, 25, 0, 400],
  [/pork/, 240, 27, 0, 400],
  [/prawns?/, 100, 24, 0, 200],
  [/honey/, 300, 0, 0, 20],
];
const UNIT_G: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 200, cups: 200, oz: 28, lb: 454, tin: 400, tins: 400, can: 400, cans: 400, clove: 5, cloves: 5, pinch: 1, handful: 30, slice: 35, slices: 35, rasher: 25, rashers: 25 };
/** A number with no unit and no unit weight for the food: grams each. */
const DEFAULT_G = 120;

/** One line's grams, and the food it is (null: not in the table). */
function lineOf(line: string): { g: number; kcal: number; p: number } | null {
  const l = line.toLowerCase().replace(/½/g, '.5').replace(/¼/g, '.25').replace(/¾/g, '.75');
  const food = FOODS.find(([re]) => re.test(l));
  if (!food) return null;
  const m = /(\d+(?:\.\d+)?)\s*(kg|grams?|g|ml|l|tsp|tbsp|cups?|oz|lb|tins?|cans?|cloves?|pinch|handful|slices?|rashers?)?\b/.exec(l);
  let g = DEFAULT_G;
  if (m) {
    const n = Number(m[1]);
    g = m[2] ? n * (UNIT_G[m[2]] ?? 1) : n * (food[3] || DEFAULT_G);
  } else g = food[4];
  return { g, kcal: (food[1] * g) / 100, p: (food[2] * g) / 100 };
}

/** A whole recipe's rough calories and protein per serving, with the lines the table didn't know. */
export function estimate(lines: string[], serves: number): { kcal: number; protein: number; unknown: string[]; known: number } {
  let kcal = 0;
  let p = 0;
  const unknown: string[] = [];
  let known = 0;
  for (const line of lines) {
    if (/^(?:[\d.\s]*(?:g|tsp|pinch)?\s*)?(?:salt|black pepper|pepper to taste|water|salt and pepper)$/i.test(line.trim())) continue;
    const x = lineOf(line);
    if (!x) unknown.push(line);
    else {
      known++;
      kcal += x.kcal;
      p += x.p;
    }
  }
  const s = Math.max(1, serves);
  return { kcal: Math.round(kcal / s / 10) * 10, protein: Math.round(p / s), unknown, known };
}

/** "About 620 kcal and 38 g protein a serving, a rough estimate (left out: saffron)." */
export function estimateWords(e: ReturnType<typeof estimate>): string {
  if (!e.known) return 'No rough calories: none of its things are in my food table.';
  return `About ${e.kcal.toLocaleString('en-GB')} kcal and ${e.protein} g protein a serving, a rough estimate${e.unknown.length ? ` (left out: ${e.unknown.slice(0, 3).join(', ')}${e.unknown.length > 3 ? '…' : ''})` : ''}.`;
}
