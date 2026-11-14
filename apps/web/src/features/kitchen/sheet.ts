/**
 * THE KITCHEN PACK on the phone (BRIEF-PACKS-1 item 3): the sheets that need the phone — TIMERS (several at once, named,
 * ringing with a sound and a buzz: ./timers.ts), the SHOPPING LIST kept in my brain (tick off, add, share as text) and the
 * week's MEAL PLAN he edits. Opened by the open_kitchen command (the brain's kitchen tool, a card's button, the chat's
 * "shopping list"); kitchen_timer sets or stops timers. The state sits on window.__ghosty.kitchen for the specs.
 */
import type { ShopItem } from '../../../../../packages/shared/src/kitchen';
import { DAYS, mmss, timerAsked } from '../../../../../packages/shared/src/kitchen';
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { brain } from '../../api/brain';
import { book, fillWeek, pantryScreen, recipesScreen, toShopping, weekShopping } from './larder';
import { onTimers, startTimers, startedWords, stopTimer, stopTimers, timersNow } from './timers';
import { sayError } from '../../ui/hisWords';
import { emptyState, lacksSignal, phrases, stateIn, stateLine, waitFor } from '../lifeui';

export type KitchenWhat = 'timers' | 'shopping' | 'plan' | 'pantry' | 'recipes';
/** Each sheet's name, as its title and as its panel on the KITCHEN screen (features/kitchen/index.ts). */
export const KITCHEN_TITLES: Record<KitchenWhat, string> = { timers: 'TIMERS', shopping: 'SHOPPING LIST', plan: 'MEAL PLAN', pantry: 'PANTRY', recipes: 'RECIPES' };
const TITLES = KITCHEN_TITLES;

export const kitchenState = {
  open: '' as '' | KitchenWhat,
  timers: [] as { id: string; name: string; left: number; ringing: boolean }[],
  list: [] as { text: string; done: boolean }[],
  plan: [] as string[],
  weekShop: null as null | { add: string[]; have: string[]; unknown: string[] },
  shared: '',
};

let open: { close(): void } | null = null;
let stopNow: (() => void) | null = null;

export async function openKitchen(what: string): Promise<void> {
  const w = (Object.keys(TITLES) as KitchenWhat[]).includes(what as KitchenWhat) ? (what as KitchenWhat) : 'timers';
  open?.close();
  const s = kitchenScreen(w);
  kitchenState.open = w;
  stopNow = s.stop;
  open = modal(TITLES[w], h('div.pk', { dataset: { pack: 'kitchen', screen: w } }, s.el), () => {
    stopNow?.();
    stopNow = null;
    open = null;
    kitchenState.open = '';
  });
}

/** One sheet's page, made by its own function (the sheet's, and the KITCHEN screen's panels). */
export function kitchenScreen(w: KitchenWhat): { el: HTMLElement; stop(): void } {
  expose();
  return w === 'timers' ? timersSheet() : w === 'shopping' ? shoppingSheet() : w === 'pantry' ? pantryScreen() : w === 'recipes' ? recipesScreen() : planSheet();
}

/** kitchen_timer: the brain's timers (or a stop) for this phone. */
export function timerCommand(a: Record<string, unknown>): void {
  expose();
  if (typeof a.stop === 'string') {
    const n = stopTimers(a.stop);
    toast(n ? `Stopped ${n} timer${n === 1 ? '' : 's'}.` : 'No timer by that name.', n ? 'ok' : 'warn');
    return;
  }
  const list = (Array.isArray(a.timers) ? a.timers : []).map((t) => ({ secs: Number((t as { secs?: unknown }).secs), name: String((t as { name?: unknown }).name ?? 'timer'), ...(typeof (t as { say?: unknown }).say === 'string' ? { say: String((t as { say: string }).say).slice(0, 120) } : {}) })).filter((t) => t.secs > 0 && t.secs <= 86_400);
  if (list.length) toast(`Timer${list.length === 1 ? '' : 's'}: ${startedWords(startTimers(list))}.`, 'ok');
}

function timersSheet(): { el: HTMLElement; stop(): void } {
  const rows = h('div.pkcol', { 'aria-live': 'polite' });
  // the cards stand as they are between ticks (a card rebuilt each quarter second loses the tap that is on its way): the
  // set is drawn again only when a timer comes, goes or starts to ring; between those only the time on each is changed
  let shape = '\u0000';
  const clocks = new Map<string, HTMLElement>();
  const paint = () => {
    const now = timersNow();
    kitchenState.timers = now;
    all.hidden = !now.length;
    const sig = now.map((t) => `${t.id}:${t.ringing ? 1 : 0}`).join(',');
    if (sig === shape) {
      for (const t of now) if (!t.ringing) {
        const c = clocks.get(t.id);
        const words = mmss(t.left);
        if (c && c.textContent !== words) {
          c.textContent = words;
          c.parentElement?.setAttribute('aria-label', `${t.name}: ${words} left`);
        }
      }
      return;
    }
    shape = sig;
    clocks.clear();
    rows.replaceChildren(
      ...(now.length
        ? now.map((t) => {
            const stop = button(t.ringing ? 'Stop' : 'Cancel', () => stopTimer(t.id), t.ringing ? 'on' : '');
            stop.setAttribute('aria-label', `${t.ringing ? 'Stop' : 'Cancel'} the ${t.name} timer`);
            const clock = h('b', t.ringing ? 'Up' : mmss(t.left));
            if (!t.ringing) clocks.set(t.id, clock);
            const card = h(`div.pktimer${t.ringing ? '.ringing' : ''}` as 'div', { role: 'timer', 'aria-label': `${t.name}: ${t.ringing ? 'ringing, tap to stop' : `${mmss(t.left)} left`}` }, clock, h('span', t.ringing ? `${t.name} is done. Tap anywhere to stop.` : t.name), stop);
            // a ringing one stops on one tap anywhere on its card
            if (t.ringing) card.addEventListener('click', () => stopTimer(t.id));
            return card;
          })
        /* state: kitchen.timers empty */
        : [emptyState('No timers running', 'Say “timer 8 minutes for the pasta”, or type it below.')]),
    );
  };
  const input = h('input', { type: 'text', placeholder: '8 minutes for the pasta', 'aria-label': 'A new timer: how long and what for', enterKeyHint: 'go' }) as HTMLInputElement;
  const msg = h('p.pknote', { 'aria-live': 'polite' });
  const add = () => {
    const ask = timerAsked(/\btimers?\b/i.test(input.value) ? input.value : `timer ${input.value}`);
    if (ask && 'start' in ask) {
      startTimers(ask.start);
      input.value = '';
      stateIn(msg, '', '');
    } else {
      /* state: kitchen.timers error */
      stateIn(msg, 'error', 'Say how long and what for, like “8 minutes for the pasta”.');
    }
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  const set = button('Set', add, 'on');
  set.setAttribute('aria-label', 'Set the timer');
  const all = button('Stop all', () => stopTimers(''));
  const off = onTimers(paint);
  paint();
  /* state: kitchen.timers offline */
  const net = lacksSignal() ? [stateLine('offline', 'No signal needed: timers run on this phone.')] : [];
  const el = h('div.pkcol', rows, h('div.pkadd', input, set), msg, h('p.pknote', 'They ring while Ghosty is open. For a locked phone, ask me for a reminder.'), h('div.pkrow', all), ...net, phrases(['shopping list', 'timer 8 minutes for the pasta']));
  return { el, stop: off };
}

function shoppingSheet(): { el: HTMLElement; stop(): void } {
  const items = h('ul.pkitems', { 'aria-label': 'Shopping list' });
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Kept in my brain. Add by voice too: “add milk to the list”.');
  let list: ShopItem[] = [];
  let loaded = false;
  const clear = button('Clear ticked', () => void act({ words: 'clear ticked' }));
  const paint = () => {
    kitchenState.list = list.map((x) => ({ text: x.text, done: x.done }));
    clear.hidden = !list.some((x) => x.done);
    /* state: kitchen.shopping empty */
    slot.replaceChildren(...(loaded && !list.length ? [emptyState('Nothing on the list', 'Type milk, eggs, bread below.')] : []));
    items.replaceChildren(
      ...[...list.filter((x) => !x.done), ...list.filter((x) => x.done)].map((x) => {
        const box = h('input', { type: 'checkbox', checked: x.done, 'aria-label': `${x.text}${x.done ? ', got' : ''}` }) as HTMLInputElement;
        box.addEventListener('change', () => void act({ id: x.id, op: box.checked ? 'tick' : 'untick' }));
        return h(`li.pkitem${x.done ? '.done' : ''}` as 'li', h('label', box, x.text));
      }),
    );
  };
  const act = async (args: Record<string, unknown>) => {
    if (lacksSignal()) {
      /* state: kitchen.shopping offline */
      slot.replaceChildren(stateLine('offline', 'No signal. The list is kept in my brain, so it opens when the phone is back online.'));
      return '';
    }
    try {
      const r = await brain.packDo('kitchen', 'shop', args);
      list = ((r.data as { list?: ShopItem[] } | undefined)?.list ?? list).slice();
      loaded = true;
      paint();
      return r.text;
    } catch (e) {
      /* state: kitchen.shopping error */
      if (!loaded) slot.replaceChildren(stateLine('error', 'I can’t reach my brain, so I can’t open your list just now. Try again in a moment.'));
      else stateIn(status, 'error', sayError(e, 'get an answer from my brain'));
      return '';
    }
  };
  const input = h('input', { type: 'text', placeholder: 'milk, eggs, bread', 'aria-label': 'Add to the list', enterKeyHint: 'done' }) as HTMLInputElement;
  const add = async () => {
    if (!input.value.trim()) return;
    const words = `add ${input.value}`;
    input.value = '';
    await act({ words });
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && void add());
  const addBtn = button('Add', () => void add(), 'on');
  addBtn.setAttribute('aria-label', 'Add to the list');
  const share = button('Share as text', async () => {
    const text = (await act({ words: 'share' })).replace(/^Here it is as text, ready to send:\n/, '');
    kitchenState.shared = text;
    if (!text) return;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        status.textContent = 'Copied: paste it in a message.';
      }
    } catch {
      status.textContent = text;
    }
  });
  clear.hidden = true;
  const el = h('div.pkcol', h('div.pkadd', input, addBtn), slot, items, h('div.pkrow', share, clear), status);
  /* state: kitchen.shopping loading */
  const done = waitFor(el, 'Opening your list…');
  void act({ words: '' }).finally(done);
  return { el, stop: () => undefined };
}

function planSheet(): { el: HTMLElement; stop(): void } {
  // the recipe book's names as each day's suggestions, so a dinner he picks is one the shopping list can be made from
  const names = h('datalist', { id: 'kp-recipes' }, ...book().map((x) => h('option', { value: x.d.name })));
  const inputs = DAYS.map((d) => {
    const i = h('input', { type: 'text', placeholder: '—', 'aria-label': `${d}’s dinner` }) as HTMLInputElement;
    i.setAttribute('list', 'kp-recipes');
    return i;
  });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'This week’s dinners, kept in my brain. Tonight’s shows in the Brief.');
  const shopNote = h('div.pkcol', { 'aria-live': 'polite', dataset: { weekshop: '' } });
  const fill = (days: string[]) => {
    kitchenState.plan = days.slice();
    inputs.forEach((i, k) => (i.value = days[k] ?? ''));
  };
  const act = async (args: Record<string, unknown>) => {
    if (lacksSignal()) {
      /* state: kitchen.plan offline */
      stateIn(status, 'offline', 'No signal. The week is kept in my brain, so it saves when the phone is back online.');
      return '';
    }
    try {
      const r = await brain.packDo('kitchen', 'plan', args);
      fill((r.data as { plan?: { days?: string[] } } | undefined)?.plan?.days ?? []);
      return r.text;
    } catch (e) {
      /* state: kitchen.plan error */
      stateIn(status, 'error', `${sayError(e, 'get an answer from my brain')} What you typed is still here.`);
      return '';
    }
  };
  const keep = async (days: string[], what: string) => {
    const done = waitFor(el, what);
    const t = await act({ days }).finally(done);
    const n = days.filter(Boolean).length;
    if (t) stateIn(status, '', `Saved: ${n} dinner${n === 1 ? '' : 's'} kept.`);
    return !!t;
  };
  const save = button('Save the week', () => void keep(inputs.map((i) => i.value.trim()), 'Saving the week…'), 'on');
  // PLAN IT FOR ME: the empty days filled from the book, what the pantry covers first
  const auto = button('Fill the empty days', async () => {
    const days = fillWeek(inputs.map((i) => i.value.trim()));
    const added = days.filter((d, k) => d && !inputs[k]!.value.trim()).length;
    if (!added) return stateIn(status, '', 'Every day already has a dinner.');
    fill(days);
    if (await keep(days, 'Planning the week…')) stateIn(status, '', `${added} empty day${added === 1 ? '' : 's'} filled from your recipe book, the ones your pantry covers first, and saved. Change any you like.`);
  });
  auto.setAttribute('aria-label', 'Fill the empty days from my recipe book');
  // THE WEEK'S SHOPPING (body.u10): one tap puts what the week's dinners need, less the pantry, on the list
  const shop = button('Shopping for the week', async () => {
    const w = weekShopping(inputs.map((i) => i.value.trim()));
    kitchenState.weekShop = { add: w.add.slice(), have: w.have.slice(), unknown: w.unknown.slice() };
    const lines: HTMLElement[] = [];
    if (!w.dishes.length && !w.unknown.length) {
      /* state: kitchen.plan empty */
      shopNote.replaceChildren(emptyState('No dinners planned yet', 'Type a dinner on any day, or tap FILL THE EMPTY DAYS, then this puts what you need on the list.'));
      return;
    }
    if (w.have.length) lines.push(h('p.pknote', { dataset: { have: String(w.have.length) } }, `Already in your pantry: ${w.have.join(', ')}.`));
    if (w.unknown.length) lines.push(h('p.pknote', { dataset: { unknown: String(w.unknown.length) } }, `Not in your recipe book, so add their things yourself: ${w.unknown.join(', ')}.`));
    if (!w.add.length) {
      shopNote.replaceChildren(h('p.pknote', { dataset: { added: '0' } }, w.dishes.length ? 'Your pantry has everything the week’s recipes need.' : 'Nothing to add from the recipe book.'), ...lines);
      return;
    }
    const note = h('p.pknote', { dataset: { added: String(w.add.length) } });
    shopNote.replaceChildren(note, ...lines);
    await toShopping(w.add, note);
    if (!/^On the shopping list/.test(note.textContent ?? '')) return;
    note.textContent = `On the shopping list for ${w.dishes.length} dinner${w.dishes.length === 1 ? '' : 's'}: ${w.add.map((n) => (w.count[n]! > 1 ? `${n} (×${w.count[n]})` : n)).join(', ')}.`;
  }, 'on');
  shop.setAttribute('aria-label', 'Put what the week needs on the shopping list');
  const el = h('div.pkcol', names, ...DAYS.map((d, k) => h('div.pkitem', h('label', { style: 'flex:0 0 3.2em' }, d), inputs[k]!)), h('div.pkrow', save, auto), h('div.pkrow', shop), shopNote, status,
    h('p.pknote', 'Pick from your recipe book as you type. The week’s shopping leaves out what your pantry already has.'), phrases(['plan my week', 'shopping for the week']));
  /* state: kitchen.plan loading */
  const done0 = waitFor(el, 'Opening this week…');
  void act({ words: '' }).finally(done0);
  return { el, stop: () => undefined };
}

/** The kitchen's state and the timers as they are now, on window.__ghosty for the specs. */
export function exposeKitchen(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (!w.__ghosty) return;
  w.__ghosty.kitchen = kitchenState;
  w.__ghosty.timers = () => timersNow();
}
const expose = exposeKitchen;
