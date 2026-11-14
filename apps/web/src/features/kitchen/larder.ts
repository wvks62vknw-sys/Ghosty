/**
 * THE PANTRY AND THE RECIPE BOOK (FINAL ROUND, BODY AND KITCHEN lane), kept on this phone only (`ghosty.kitchen.larder`):
 *  - PANTRY: what is in the fridge, the freezer and the cupboard, each with its use-by day; what to use soon at the top; USED UP
 *    takes it off and can put it on the shopping list (that list is kept in my brain, so that one step needs a signal);
 *  - RECIPES: his own recipes beside Ghosty's own list, ordered by how much of each he has in the pantry; a recipe scales to any
 *    number of people, cooks step by step with a timer for any step that says its minutes, adds what is missing to the
 *    shopping list and goes on tonight's meal plan.
 * Nothing here is sent anywhere but those two lists, and only on his tap. The state is on window.__ghosty.larder for the specs.
 */
import { haveOf, minutesInSteps, OWN_DISHES, scaleLines, secondsIn, type Dish } from '../../../../../packages/shared/src/kitchen';
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { brain } from '../../api/brain';
import { LARDER_ADD, LARDER_LIST } from './larderwords';
import { emptyState, lacksSignal, phrases, stateIn, stateLine } from '../lifeui';

export type Place = 'fridge' | 'freezer' | 'cupboard';
export const PLACES: { id: Place; label: string }[] = [{ id: 'fridge', label: 'Fridge' }, { id: 'freezer', label: 'Freezer' }, { id: 'cupboard', label: 'Cupboard' }];
export interface Item {
  id: string;
  name: string;
  where: Place;
  /** Use by, YYYY-MM-DD ('' when none). */
  useBy: string;
  added: number;
}
export interface Recipe {
  id: string;
  name: string;
  serves: number;
  /** One line each: "200 g pasta". */
  ingredients: string[];
  steps: string[];
}
interface Larder {
  v: 1;
  items: Item[];
  recipes: Recipe[];
}

const KEY = 'ghosty.kitchen.larder';
let cache: Larder | null = null;
let failed = '';
const listeners = new Set<() => void>();
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function load(): Larder {
  if (cache) return cache;
  let raw: Partial<Larder> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  const str = (x: unknown, n: number) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
  cache = {
    v: 1,
    items: (Array.isArray(raw.items) ? raw.items : []).filter((i) => i && str(i.name, 60)).map((i) => ({ id: str(i.id, 40) || rid(), name: str(i.name, 60), where: PLACES.some((p) => p.id === i.where) ? i.where : 'cupboard', useBy: DAY_RE.test(String(i.useBy)) ? String(i.useBy) : '', added: Number(i.added) || 0 })).slice(0, 400),
    recipes: (Array.isArray(raw.recipes) ? raw.recipes : []).filter((r) => r && str(r.name, 80)).map((r) => ({ id: str(r.id, 40) || rid(), name: str(r.name, 80), serves: Math.max(1, Math.min(24, Math.round(Number(r.serves) || 2))), ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 40), steps: (Array.isArray(r.steps) ? r.steps : []).map((x) => str(x, 400)).filter(Boolean).slice(0, 30) })).slice(0, 200),
  };
  return cache;
}
function save(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
    failed = '';
  } catch {
    failed = 'I couldn’t keep that on this phone: its storage is full or switched off.';
  }
  for (const f of listeners) f();
  return !failed;
}
const rid = () => Math.random().toString(36).slice(2, 10);
const today = () => {
  const d = new Date(Date.now() + ((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset ?? 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysLeft = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today().split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 864e5);
};
/** "use by today", "use by tomorrow", "use in 3 days", "2 days past its date". */
export function useWords(ymd: string): string {
  if (!ymd) return '';
  const n = daysLeft(ymd);
  return n === 0 ? 'use today' : n === 1 ? 'use by tomorrow' : n > 1 ? `use in ${n} days` : n === -1 ? '1 day past its date' : `${-n} days past its date`;
}

/** Things to add, from his words: "milk, eggs and 2 peppers". */
export const itemsIn = (words: string): string[] => words.split(/,|\band\b|\n/i).map((s) => s.trim().replace(/^(?:some|a|an)\s+/i, '')).filter((s) => s && s.length <= 60).slice(0, 20);

export function addItems(words: string, where: Place, useBy = ''): string {
  const names = itemsIn(words);
  if (!names.length) return 'Type what to add, like “milk, eggs, chicken”.';
  const data = load();
  for (const name of names) data.items.push({ id: rid(), name, where, useBy: DAY_RE.test(useBy) ? useBy : '', added: Date.now() });
  return save() ? `In the ${where}: ${names.join(', ')}.` : failed;
}
export function haveNames(): string[] {
  return load().items.map((i) => i.name.toLowerCase());
}
/** Every recipe in the book: his own first, then Ghosty's own list, each with what he has. */
export function book(): { d: Dish; mine: Recipe | null; got: number; need: string[] }[] {
  const have = haveNames();
  const mine = load().recipes.map((r) => ({ d: dishOf(r), mine: r }));
  const own = OWN_DISHES.map((d) => ({ d, mine: null as Recipe | null }));
  return [...mine, ...own].map((x) => ({ ...x, ...haveOf(x.d, have) })).sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.got / Math.max(1, b.d.ingredients.length) - a.got / Math.max(1, a.d.ingredients.length));
}
const dishOf = (r: Recipe): Dish => {
  const mins = minutesInSteps(r.steps.join(' '));
  return { id: `mine:${r.id}`, name: r.name, from: 'your own', ingredients: r.ingredients.map((l) => ({ name: l.replace(/^[\d½¼¾⅓⅔./\s]+(?:g|kg|ml|l|tsp|tbsp|cups?|oz|lb|grams?|tins?|cans?|cloves?|pinch|handful)?\s*(?:of\s+)?/i, '').trim() || l, measure: l })), steps: r.steps, mins: mins ? mins + 10 : null };
};

/** The recipe in the book a planned dinner names ("chilli" finds Chilli con carne; "Mum's lasagne" his own), or null. */
export function recipeFor(dish: string, all = book()): ReturnType<typeof book>[number] | null {
  const w = dish.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  if (w.length < 3) return null;
  return all.find((x) => x.d.name.toLowerCase() === w)
    ?? all.find((x) => w.includes(x.d.name.toLowerCase()))
    ?? all.find((x) => x.d.name.toLowerCase().includes(w) && w.length >= 4)
    ?? all.find((x) => x.d.name.toLowerCase().split(/\s+/).filter((p) => p.length >= 4 && !/^(?:with|and)$/.test(p)).some((p) => new RegExp(`\\b${p.replace(/[^a-z']/g, '')}\\b`).test(w)))
    ?? null;
}
/**
 * The week's shopping from the planned dinners (body.u10): every thing the week's recipes need that isn't in the pantry,
 * each once, with how many dinners want it; what the pantry already has; and the dinners with no recipe in the book.
 */
export function weekShopping(days: string[]): { add: string[]; count: Record<string, number>; have: string[]; unknown: string[]; dishes: string[] } {
  const all = book();
  const have = haveNames();
  const count: Record<string, number> = {};
  const got = new Set<string>();
  const unknown: string[] = [];
  const dishes: string[] = [];
  for (const day of days) {
    const dish = day.trim();
    if (!dish) continue;
    const r = recipeFor(dish, all);
    if (!r) {
      unknown.push(dish);
      continue;
    }
    dishes.push(r.d.name);
    const h2 = haveOf(r.d, have);
    for (const n of h2.need) count[n] = (count[n] ?? 0) + 1;
    for (const i of r.d.ingredients) if (!h2.need.includes(i.name.toLowerCase())) got.add(i.name.toLowerCase());
  }
  return { add: Object.keys(count), count, have: [...got].filter((x) => !(x in count)), unknown, dishes };
}
/**
 * Fills the week's empty days from the recipe book: the ones the pantry covers most first, and those using something that must
 * be used soon before those; never the same dinner twice in a week. The days he already planned stay as they are.
 */
export function fillWeek(days: string[]): string[] {
  const all = book();
  const soon = load().items.filter((i) => i.useBy && daysLeft(i.useBy) <= 3).map((i) => i.name.toLowerCase());
  const taken = new Set(days.map((d) => recipeFor(d, all)?.d.id).filter(Boolean));
  const score = (x: (typeof all)[number]) => x.got / Math.max(1, x.d.ingredients.length) + (soon.length && haveOf(x.d, soon).got ? 1 : 0) + (x.mine ? 0.3 : 0);
  const pick = all.filter((x) => !taken.has(x.d.id)).sort((a, b) => score(b) - score(a));
  return Array.from({ length: 7 }, (_, k) => (days[k]?.trim() ? days[k]!.trim() : (pick.shift()?.d.name ?? '')));
}

/** Puts things on the shopping list in my brain (the one step that needs a signal). */
export async function toShopping(names: string[], status: HTMLElement): Promise<void> {
  if (!names.length) return;
  if (lacksSignal()) {
    /* state: kitchen.recipes offline */
    stateIn(status, 'offline', `No signal, so ${names.join(', ')} isn’t on the shopping list yet: it’s kept in my brain. Try again when you’re back online.`);
    return;
  }
  try {
    await brain.packDo('kitchen', 'shop', { words: `add ${names.join(', ')}` });
    stateIn(status, '', `On the shopping list: ${names.join(', ')}.`);
  } catch {
    stateIn(status, 'error', 'My brain didn’t answer, so the shopping list didn’t change. Try again in a moment.');
  }
}

// ---------------------------------------------------------------- PANTRY

export function pantryScreen(): { el: HTMLElement; stop(): void } {
  expose();
  const el = h('div.pkcol.kl', { dataset: { larder: 'pantry' } });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const name = h('input', { type: 'text', placeholder: 'milk, eggs, chicken', 'aria-label': 'What to add to the pantry', enterKeyHint: 'done' }) as HTMLInputElement;
  const where = h('select', { 'aria-label': 'Where it goes' }, ...PLACES.map((p) => h('option', { value: p.id }, p.label))) as HTMLSelectElement;
  const by = h('input', { type: 'date', 'aria-label': 'Use by (if it has a date)' }) as HTMLInputElement;
  const add = () => {
    const said = addItems(name.value, where.value as Place, by.value);
    if (!/^In the/.test(said)) {
      /* state: kitchen.pantry error */
      return stateIn(status, 'error', said);
    }
    name.value = '';
    by.value = '';
    stateIn(status, '', said);
  };
  name.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  const addBtn = button('Add', add, 'on');
  addBtn.setAttribute('aria-label', 'Add to the pantry');
  const form = h('div.pkcol', h('div.pkadd', name, addBtn), h('div.kl-grid2', h('div.pkfield', h('label', 'Where'), where), h('div.pkfield', h('label', 'Use by'), by)));
  const list = h('div.pkcol');
  const draw = () => {
    const data = load();
    const kids: HTMLElement[] = [];
    if (!data.items.length) {
      /* state: kitchen.pantry empty */
      kids.push(emptyState('Nothing in the pantry yet', 'Add what’s in your fridge, freezer and cupboard, with its use-by date, and I show what to use first and what you can cook.'));
    }
    if (failed) kids.push(stateLine('error', failed));
    const soon = data.items.filter((i) => i.useBy && daysLeft(i.useBy) <= 2).sort((a, b) => a.useBy.localeCompare(b.useBy));
    if (soon.length) kids.push(h('section.kl-soon', { 'aria-label': 'Use soon' }, h('h3.kl-h', 'Use soon'), h('ul.pkitems', ...soon.map((i) => row(i)))));
    for (const p of PLACES) {
      const its = data.items.filter((i) => i.where === p.id && !soon.includes(i)).sort((a, b) => (a.useBy || '9').localeCompare(b.useBy || '9') || a.name.localeCompare(b.name));
      if (its.length) kids.push(h('section', { 'aria-label': p.label }, h('h3.kl-h', `${p.label} · ${its.length}`), h('ul.pkitems', ...its.map((i) => row(i)))));
    }
    if (data.items.length) {
      const cook = book().filter((x) => x.got >= 2).slice(0, 3);
      kids.push(h('p.pknote', { dataset: { cook: String(cook.length) } }, cook.length ? `You could cook: ${cook.map((x) => `${x.d.name} (${x.got} of ${x.d.ingredients.length})`).join(', ')}. The Recipes pill has them.` : 'Nothing in the recipe book matches two of your things yet.'));
    }
    list.replaceChildren(...kids);
  };
  const row = (i: Item) => {
    const used = button('Used up', () => {
      const data = load();
      data.items = data.items.filter((x) => x.id !== i.id);
      save();
      stateIn(status, '', `${i.name}: used up.`);
      const again = button(`Add ${i.name} to shopping`, () => void toShopping([i.name], status));
      status.append(' ', again);
    });
    used.setAttribute('aria-label', `${i.name}: used up`);
    const when = useWords(i.useBy);
    return h(`li.pkitem${i.useBy && daysLeft(i.useBy) < 0 ? '.kl-past' : ''}` as 'li', { dataset: { item: i.name } }, h('span.kl-name', h('b', i.name), when ? h('small', ` · ${when}`) : null), used);
  };
  listeners.add(draw);
  draw();
  /* state: kitchen.pantry offline */
  const net = lacksSignal() ? [stateLine('offline', 'No signal needed: the pantry is kept on this phone. Only adding to the shopping list waits for a signal.')] : [];
  el.append(form, list, status, ...net, phrases(['add milk to the pantry', 'what’s in my pantry?']), h('p.pknote', 'Kept on this phone only.'));
  return { el, stop: () => void listeners.delete(draw) };
}

// ---------------------------------------------------------------- RECIPES

export function recipesScreen(): { el: HTMLElement; stop(): void } {
  expose();
  const el = h('div.pkcol.kl', { dataset: { larder: 'recipes' } });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  let openId = '';
  let serves = 0;
  let step = -1;
  let hands: { say(text: string): Promise<void>; stop(): void } | null = null;
  const handsOff = () => {
    hands?.stop();
    hands = null;
  };
  const draw = () => {
    const all = book();
    const cur = all.find((x) => x.d.id === openId);
    if (cur) return drawOne(cur);
    const kids: HTMLElement[] = [];
    if (!load().items.length) kids.push(h('p.pknote', 'Add what you have on the Pantry pill and the book puts what you can cook first.'));
    if (failed) {
      /* state: kitchen.recipes error */
      kids.push(stateLine('error', failed));
    }
    /* state: kitchen.recipes empty */
    if (!load().recipes.length) kids.push(emptyState('None of your own recipes yet', 'Ghosty’s own list is below. Add yours with ADD A RECIPE: its things one a line, its steps one a line.'));
    kids.push(h('ul.pkitems.kl-book', ...all.map((x) => {
      const b = button(h('span.kl-name', h('b', x.d.name), h('small', ` · ${x.d.mins ? `about ${x.d.mins} min` : 'no time given'} · ${x.mine ? 'yours' : 'Ghosty’s list'}${haveNames().length ? ` · you have ${x.got} of ${x.d.ingredients.length}` : ''}`)), () => {
        openId = x.d.id;
        serves = x.mine?.serves ?? 2;
        step = -1;
        draw();
      });
      b.setAttribute('aria-label', `Open ${x.d.name}`);
      return h('li.pkitem', b);
    })));
    kids.push(addForm());
    el.replaceChildren(...kids, status, phrases(['open my recipes', 'what can I cook?']), h('p.pknote', 'Your recipes are kept on this phone only. Times are a first estimate from the steps.'));
  };
  const drawOne = (x: ReturnType<typeof book>[number]) => {
    const d = x.d;
    const base = x.mine?.serves ?? 2;
    const back = button('All recipes', () => {
      openId = '';
      handsOff();
      draw();
    });
    back.setAttribute('aria-label', 'Back to all recipes');
    const minus = button('−', () => {
      serves = Math.max(1, serves - 1);
      draw();
    });
    minus.setAttribute('aria-label', 'Fewer people');
    const plus = button('+', () => {
      serves = Math.min(24, serves + 1);
      draw();
    });
    plus.setAttribute('aria-label', 'More people');
    const lines = x.mine ? scaleLines(x.mine.ingredients.join('\n'), base, serves) : { lines: d.ingredients.map((i) => i.name), rounded: false };
    const have = haveNames();
    const ing = h('ul.pkitems', ...lines.lines.map((l, k) => {
      const got = haveOf({ ...d, ingredients: [d.ingredients[k] ?? { name: l, measure: '' }] }, have).got > 0;
      return h(`li.pkitem${got ? '.kl-got' : ''}` as 'li', h('span.kl-name', l, got ? h('small', ' · in the pantry') : null));
    }));
    const missing = button(x.need.length ? `Add ${x.need.length} missing to shopping` : 'You have everything', () => void toShopping(x.need, status));
    missing.disabled = !x.need.length;
    const tonight = button('Put on tonight', async () => {
      if (lacksSignal()) return stateIn(status, 'offline', 'No signal: the meal plan is kept in my brain. Try again when you’re back online.');
      try {
        await brain.packDo('kitchen', 'plan', { words: `${d.name} tonight` });
        stateIn(status, '', `${d.name} is on tonight’s meal plan.`);
      } catch {
        stateIn(status, 'error', 'My brain didn’t answer, so the meal plan didn’t change. Try again in a moment.');
      }
    });
    // cook mode: one step at a time, a timer for a step that says its minutes; HANDS-FREE reads each step and hears next/back
    const timerFor = async (secs: number) => {
      const m = await import('./timers');
      m.startTimers([{ secs, name: d.name.toLowerCase() }]);
      stateIn(status, '', `A ${Math.round(secs / 60)}-minute timer for the ${d.name.toLowerCase()} is running: the Timers pill has it.`);
    };
    const goStep = (n: number) => {
      if (n >= d.steps.length) {
        step = -1;
        handsOff();
        stateIn(status, '', `${d.name}: done. Enjoy it.`);
      } else step = Math.max(0, n);
      draw();
      if (hands && step >= 0) readStep();
    };
    const readStep = () => {
      const s = d.steps[step] ?? '';
      const secs = secondsIn(s);
      void hands?.say(`Step ${step + 1}. ${s}${secs ? ' I’ve started the timer.' : ''}`);
      if (secs) void timerFor(secs);
    };
    const cook: HTMLElement[] = [];
    const handsKey = button(hands ? 'Hands-free: on' : 'Hands-free', async () => {
      if (hands) {
        handsOff();
        stateIn(status, '', 'Hands-free off: tap the keys to move on.');
        return draw();
      }
      const m = await import('./handsfree');
      hands = m.handsFree((w) => {
        if (w === 'next') goStep(step + 1);
        else if (w === 'back') goStep(step - 1);
        else if (w === 'repeat') readStep();
        else if (w === 'timer') {
          const secs = secondsIn(d.steps[step] ?? '');
          if (secs) void timerFor(secs);
          else void hands?.say('This step has no time in it.');
        } else {
          handsOff();
          draw();
        }
      }, (why) => stateIn(status, '', why));
      if (step < 0) step = 0;
      stateIn(status, '', 'Hands-free: I read each step. Say “next”, “back”, “repeat” or “timer”.');
      draw();
      readStep();
    }, hands ? 'on' : '');
    handsKey.setAttribute('aria-pressed', String(!!hands));
    handsKey.setAttribute('aria-label', 'Cook hands-free: each step read out, say next or back');
    if (step < 0) {
      const go = button('Cook it, step by step', () => goStep(0), 'on');
      cook.push(h('div.pkrow', go, handsKey), h('ol.pklist', ...d.steps.map((s) => h('li', s))));
    } else {
      const s = d.steps[step] ?? '';
      const secs = secondsIn(s);
      const prev = button('Back a step', () => goStep(step - 1));
      const next = button(step + 1 < d.steps.length ? 'Next step' : 'Done', () => goStep(step + 1), 'on');
      const row = h('div.pkrow', prev, next);
      if (secs) {
        const t = button(`Timer ${Math.round(secs / 60)} min`, () => void timerFor(secs));
        t.setAttribute('aria-label', `Start a ${Math.round(secs / 60)} minute timer`);
        row.append(t);
      }
      cook.push(h('p.kl-step', { dataset: { step: String(step + 1) } }, h('small', `Step ${step + 1} of ${d.steps.length}`), h('span', s)), row, h('div.pkrow', handsKey));
    }
    const kids: (HTMLElement | null)[] = [
      h('div.pkrow', back),
      h('h3.kl-title', d.name),
      h('p.pknote', `${d.mins ? `About ${d.mins} min, a first estimate from its steps. ` : ''}${x.mine ? 'Your own recipe.' : 'From Ghosty’s own list.'}`),
      x.mine ? h('div.pkrow.kl-serves', { role: 'group', 'aria-label': 'How many people' }, minus, h('b', { dataset: { serves: String(serves) } }, `Serves ${serves}`), plus) : null,
      lines.rounded ? h('p.pknote', 'Some amounts are rounded to the nearest half.') : null,
      h('h3.kl-h', 'You need'), ing, h('div.pkrow', missing, tonight),
      h('h3.kl-h', 'Method'), ...cook,
    ];
    if (x.mine) {
      const del = button('Delete this recipe', () => {
        const data = load();
        data.recipes = data.recipes.filter((r) => r.id !== x.mine!.id);
        openId = '';
        save();
        stateIn(status, '', `${d.name}: deleted.`);
      });
      kids.push(h('div.pkrow', del));
    }
    el.replaceChildren(...kids.filter((k): k is HTMLElement => !!k), status);
  };
  const addForm = () => {
    const nm = h('input', { type: 'text', placeholder: 'Name', 'aria-label': 'The recipe’s name' }) as HTMLInputElement;
    const sv = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '24', value: '2', 'aria-label': 'How many it serves' }) as HTMLInputElement;
    const ing = h('textarea', { rows: 4, placeholder: '200 g pasta\n1 onion', 'aria-label': 'Its things, one a line' }) as HTMLTextAreaElement;
    const st = h('textarea', { rows: 4, placeholder: 'Boil the pasta 10 minutes.\nFry the onion 5 minutes.', 'aria-label': 'Its steps, one a line' }) as HTMLTextAreaElement;
    const keep = button('Keep the recipe', () => {
      const r: Recipe = { id: rid(), name: nm.value.trim().slice(0, 80), serves: Math.max(1, Math.min(24, Math.round(Number(sv.value) || 2))), ingredients: ing.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 40), steps: st.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30) };
      if (!r.name || !r.ingredients.length || !r.steps.length) return stateIn(status, 'error', 'Give it a name, at least one thing and at least one step.');
      load().recipes.push(r);
      if (save()) stateIn(status, '', `${r.name}: kept in your book.`);
    }, 'on');
    return h('details.pkmore.kl-add', h('summary', 'Add a recipe'), h('div.pkfield', h('label', 'Name'), nm), h('div.pkfield', h('label', 'Serves'), sv), h('div.pkfield', h('label', 'Its things, one a line'), ing), h('div.pkfield', h('label', 'Its steps, one a line'), st), h('div.pkrow', keep));
  };
  listeners.add(draw);
  draw();
  return { el, stop: () => {
    handsOff();
    listeners.delete(draw);
  } };
}

// ---------------------------------------------------------------- the chat

const ADD = LARDER_ADD;
const LIST = LARDER_LIST;
export function larderTurn(text: string): { reply: string; open: 'pantry' | 'recipes' } | null {
  const t = text.trim().replace(/[.!]+$/, '').replace(/’/g, "'");
  const a = ADD.exec(t);
  if (a) {
    const where: Place = /freezer/i.test(a[2]!) ? 'freezer' : /fridge/i.test(a[2]!) ? 'fridge' : 'cupboard';
    return { reply: addItems(a[1]!, where), open: 'pantry' };
  }
  const l = LIST.exec(t);
  if (!l) return null;
  const w = (l[1] ?? l[2] ?? '').toLowerCase();
  if (/recipe/.test(w)) {
    const top = book().slice(0, 3).map((x) => x.d.name);
    return { reply: `Your recipe book is open: ${load().recipes.length} of your own, and Ghosty’s list. ${haveNames().length ? `Most of the things for ${top.join(', ')} are in your pantry.` : ''}`.trim(), open: 'recipes' };
  }
  const items = load().items.filter((i) => w === 'pantry' || i.where === w);
  if (!items.length) return { reply: `Nothing kept in the ${w} yet. Say “add milk to the ${w === 'pantry' ? 'fridge' : w}”.`, open: 'pantry' };
  const soon = items.filter((i) => i.useBy && daysLeft(i.useBy) <= 2);
  return { reply: `In the ${w}: ${items.map((i) => i.name).join(', ')}.${soon.length ? ` Use soon: ${soon.map((i) => `${i.name} (${useWords(i.useBy)})`).join(', ')}.` : ''}`, open: 'pantry' };
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.larder = { data: () => load(), reset: () => void (cache = null) };
}
