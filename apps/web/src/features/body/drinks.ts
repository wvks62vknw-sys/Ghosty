/**
 * DRINKS BEYOND WATER (NEXT ROUND, BODY AND KITCHEN lane, body.u2), kept on this phone only (`ghosty.body.drinks`):
 *  - coffee, tea and juice count towards the day's water (their ml go on Water, marked with the drink's name);
 *  - caffeine is added up as a rough estimate (a mug of coffee about 95 mg, of tea about 45 mg), and one after his own set hour
 *    (15:00 to start) gets a gentle flag, never a telling-off;
 *  - beer, wine and spirits never count as water: their UK units add up across the last seven days, a rough estimate, beside the
 *    UK's public low-risk guide of 14 units a week (said as the guide, never as advice for him).
 * Every number here is a rough estimate.
 */
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { dayOf, shift } from './trackcore';

export interface Drink {
  id: string;
  label: string;
  ml: number;
  /** mg of caffeine, a rough estimate. */
  caf: number;
  /** UK units of alcohol, a rough estimate. */
  units: number;
  /** Counts towards water. */
  water: boolean;
}
export const DRINKS: Drink[] = [
  { id: 'coffee', label: 'Coffee', ml: 350, caf: 95, units: 0, water: true },
  { id: 'espresso', label: 'Espresso', ml: 30, caf: 65, units: 0, water: false },
  { id: 'tea', label: 'Tea', ml: 350, caf: 45, units: 0, water: true },
  { id: 'juice', label: 'Juice', ml: 250, caf: 0, units: 0, water: true },
  { id: 'cola', label: 'Cola', ml: 330, caf: 32, units: 0, water: true },
  { id: 'beer', label: 'Pint of beer', ml: 568, caf: 0, units: 2.3, water: false },
  { id: 'wine', label: 'Glass of wine', ml: 175, caf: 0, units: 2.1, water: false },
  { id: 'spirit', label: 'Single spirit', ml: 25, caf: 0, units: 1, water: false },
];
interface Kept {
  d: string;
  t: number;
  id: string;
}
interface DrinkData {
  v: 1;
  log: Kept[];
  /** Caffeine after this hour gets a gentle flag. */
  lateHour: number;
}
const KEY = 'ghosty.body.drinks';
let drinksOpen = false;
let cache: DrinkData | null = null;
const now = (): number => Date.now() + ((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset ?? 0);

export function loadDrinks(): DrinkData {
  if (cache) return cache;
  let raw: Partial<DrinkData> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  cache = {
    v: 1,
    log: (Array.isArray(raw.log) ? raw.log : []).filter((x) => x && DRINKS.some((d) => d.id === x.id) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.d)) && Number.isFinite(x.t)).slice(-3000),
    lateHour: typeof raw.lateHour === 'number' && raw.lateHour >= 10 && raw.lateHour <= 22 ? raw.lateHour : 15,
  };
  return cache;
}
function save(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadDrinks()));
    return true;
  } catch {
    return false;
  }
}
const of = (id: string) => DRINKS.find((d) => d.id === id)!;

/** Today's caffeine (mg) and whether one came after his late hour; the last seven days' units. */
export function drinkTotals(day = dayOf(now())): { caf: number; late: boolean; units: number; todayUnits: number } {
  const data = loadDrinks();
  const todays = data.log.filter((x) => x.d === day);
  const from = shift(day, -6);
  return {
    caf: todays.reduce((a, x) => a + of(x.id).caf, 0),
    late: todays.some((x) => of(x.id).caf > 0 && new Date(x.t).getHours() >= data.lateHour),
    units: Math.round(data.log.filter((x) => x.d >= from && x.d <= day).reduce((a, x) => a + of(x.id).units, 0) * 10) / 10,
    todayUnits: Math.round(todays.reduce((a, x) => a + of(x.id).units, 0) * 10) / 10,
  };
}

/** Keeps one drink; one that counts as water goes on Water too (through `addWater`). Says it back. */
export function addDrink(id: string, addWater: (ml: number, name: string) => void): string {
  const d = of(id);
  if (!d) return 'I don’t know that drink.';
  const data = loadDrinks();
  const t = now();
  data.log.push({ d: dayOf(t), t, id });
  if (!save()) return 'I couldn’t keep that on this phone: its storage is full or switched off.';
  if (d.water) addWater(d.ml, d.label);
  const tot = drinkTotals();
  const late = d.caf > 0 && new Date(t).getHours() >= data.lateHour;
  if (d.units) return `${d.label} kept: about ${d.units} units. About ${tot.units} units in the last 7 days; the UK’s low-risk guide is 14 a week. Rough estimates.`;
  return `${d.label} kept${d.water ? `, ${d.ml} ml towards your water` : ''}.${d.caf ? ` About ${tot.caf} mg of caffeine today${late ? `; that one’s after ${String(data.lateHour).padStart(2, '0')}:00, which can sit with sleep for some people` : ''}.` : ''} Rough estimates.`;
}
/** Takes back today's last drink (and its water). */
export function undoDrink(removeWater: (name: string) => void): string {
  const data = loadDrinks();
  const day = dayOf(now());
  const i = data.log.map((x) => x.d).lastIndexOf(day);
  if (i < 0) return 'No drink kept today, so nothing to take back.';
  const [x] = data.log.splice(i, 1);
  save();
  if (of(x!.id).water) removeWater(of(x!.id).label);
  return `Taken back: ${of(x!.id).label.toLowerCase()}.`;
}

/** The drinks keys and today's line, for the Water screen. */
export function drinksBox(say: (w: string) => void, addWater: (ml: number, name: string) => void, removeWater: (name: string) => void): HTMLElement {
  const box = h('details.pkmore.bd-drinks') as HTMLDetailsElement;
  // (open stays open through the Water screen's redraws)
  box.open = drinksOpen;
  box.addEventListener('toggle', () => (drinksOpen = box.open));
  const draw = () => {
    const t = drinkTotals();
    const data = loadDrinks();
    const keys = h('div.pkrow.bt-cups', ...DRINKS.map((d) => {
      const b = button(h('span.bt-cup', h('b', d.label), h('small', d.units ? `${d.units} units` : d.caf ? `${d.caf} mg caffeine` : `${d.ml} ml`)), () => {
        say(addDrink(d.id, addWater));
        draw();
      });
      b.setAttribute('aria-label', `Add a ${d.label.toLowerCase()}`);
      return b;
    }));
    const undo = button('Undo the last drink', () => {
      say(undoDrink(removeWater));
      draw();
    });
    const late = h('select', { 'aria-label': 'Flag caffeine after' }, ...Array.from({ length: 13 }, (_, i) => i + 10).map((hr) => h('option', { value: String(hr), ...(hr === data.lateHour ? { selected: true } : {}) }, `${String(hr).padStart(2, '0')}:00`))) as HTMLSelectElement;
    late.addEventListener('change', () => {
      data.lateHour = Number(late.value);
      save();
      draw();
    });
    box.replaceChildren(h('summary', `Coffee, tea and more · ${t.caf ? `${t.caf} mg caffeine today` : 'no caffeine today'}${t.units ? ` · ${t.units} units this week` : ''}`),
      h('p.pknote', { dataset: { drinks: `${t.caf}|${t.units}|${t.late ? 1 : 0}` } }, `Coffee, tea, juice and cola count towards your water; beer, wine and spirits don’t. Today: about ${t.caf} mg of caffeine${t.late ? `, some after ${String(data.lateHour).padStart(2, '0')}:00` : ''}. The last 7 days: about ${t.units} units of alcohol, beside the UK’s low-risk guide of 14 a week.`),
      keys, h('div.pkrow', undo), h('div.pkfield', h('label', 'Flag caffeine after'), late), h('p.pknote', 'Rough estimates: cups and brews vary. Never advice.'));
  };
  draw();
  return box;
}

