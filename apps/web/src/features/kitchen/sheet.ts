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
import { book, fillWeek, foodNotes, kcalOf, pantryScreen, recipeFor, recipesScreen, toShopping, weekShopping } from './larder';
import { addMinute, onTimers, startTimers, startedWords, stopTimer, stopTimers, timersNow } from './timers';
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

/** THE STOPWATCH (APPS ROUND): start, stop, lap and reset, kept on this phone (\`ghosty:stopwatch\`) so a reload carries on. */
function stopwatch(): { el: HTMLElement; stop(): void } {
  type SW = { start: number | null; acc: number; laps: number[] };
  const load = (): SW => {
    try {
      const v = JSON.parse(localStorage.getItem('ghosty:stopwatch') ?? 'null') as SW | null;
      return v && Array.isArray(v.laps) ? { start: typeof v.start === 'number' ? v.start : null, acc: Number(v.acc) || 0, laps: v.laps.filter((x) => typeof x === 'number').slice(-50) } : { start: null, acc: 0, laps: [] };
    } catch {
      return { start: null, acc: 0, laps: [] };
    }
  };
  let sw = load();
  const keepSw = () => {
    try {
      localStorage.setItem('ghosty:stopwatch', JSON.stringify(sw));
    } catch {
      /* it still runs */
    }
  };
  const nowMs = () => Date.now() + (navigator.webdriver ? Number((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset) || 0 : 0);
  const total = () => sw.acc + (sw.start != null ? nowMs() - sw.start : 0);
  const show = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  const face = h('b.kt-swface', { role: 'timer', 'aria-label': 'Stopwatch' }, show(total()));
  const laps = h('ol.pklist.kt-laps', { 'aria-label': 'Laps' });
  const go = button('Start', () => {
    if (sw.start == null) sw.start = nowMs();
    else {
      sw.acc = total();
      sw.start = null;
    }
    keepSw();
    paint();
  }, 'on');
  const lap = button('Lap', () => {
    if (sw.start == null) return;
    sw.laps.push(total());
    keepSw();
    paint();
  });
  const reset = button('Reset', () => {
    sw = { start: null, acc: 0, laps: [] };
    keepSw();
    paint();
  });
  const paint = () => {
    face.textContent = show(total());
    go.textContent = sw.start == null ? (total() ? 'Carry on' : 'Start') : 'Stop';
    go.setAttribute('aria-label', sw.start == null ? 'Start the stopwatch' : 'Stop the stopwatch');
    lap.disabled = sw.start == null;
    laps.replaceChildren(...sw.laps.map((t, i) => h('li', { dataset: { lap: String(i + 1) } }, `Lap ${i + 1}: ${show(t - (i ? sw.laps[i - 1]! : 0))} (${show(t)})`)).reverse());
    stopwatchState.ms = total();
    stopwatchState.laps = sw.laps.length;
  };
  lap.setAttribute('aria-label', 'Mark a lap');
  reset.setAttribute('aria-label', 'Reset the stopwatch');
  const tick = window.setInterval(() => sw.start != null && (face.textContent = show(total())), 100);
  paint();
  return { el: h('section.kt-sw', { 'aria-label': 'Stopwatch' }, h('h3.kl-h', 'Stopwatch'), face, h('div.pkrow', go, lap, reset), laps), stop: () => window.clearInterval(tick) };
}
export const stopwatchState = { ms: 0, laps: 0 };

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
            const more = t.ringing ? null : button('+1 min', () => addMinute(t.id));
            more?.setAttribute('aria-label', `One more minute on the ${t.name} timer`);
            const card = h(`div.pktimer${t.ringing ? '.ringing' : ''}` as 'div', { role: 'timer', 'aria-label': `${t.name}: ${t.ringing ? 'ringing, tap to stop' : `${mmss(t.left)} left`}` }, clock, h('span', t.ringing ? `${t.name} is done. Tap anywhere to stop.` : t.name), ...(more ? [more] : []), stop);
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
  // PRESETS: the common ones, one tap each
  const presets = h('div.pkrow.kt-presets', { role: 'group', 'aria-label': 'Quick timers' }, ...([['Soft egg', 6], ['Pasta', 10], ['Rice', 12], ['Tea', 4], ['Roast', 60]] as const).map(([name, min]) => {
    const b = button(`${name} ${min >= 60 ? `${min / 60} h` : `${min} min`}`, () => void startTimers([{ secs: min * 60, name: name.toLowerCase() }]));
    b.setAttribute('aria-label', `A ${min >= 60 ? `${min / 60} hour` : `${min} minute`} timer for the ${name.toLowerCase()}`);
    return b;
  }));
  const set = button('Set', add, 'on');
  set.setAttribute('aria-label', 'Set the timer');
  const all = button('Stop all', () => stopTimers(''));
  const off = onTimers(paint);
  paint();
  /* state: kitchen.timers offline */
  const net = lacksSignal() ? [stateLine('offline', 'No signal needed: timers run on this phone.')] : [];
  const sw = stopwatch();
  const el = h('div.pkcol', rows, h('div.pkadd', input, set), presets, msg, h('p.pknote', 'They ring here, and one of a minute or more on your lock screen too, through my push (only its end time and name go there).'), h('div.pkrow', all), ...net, phrases(['shopping list', 'timer 8 minutes for the pasta']));
  el.append(sw.el);
  return { el, stop: () => {
    off();
    sw.stop();
  } };
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
  // THE GROCERIES BUDGET (body.c1, with MONEY): what is left of his own groceries budget, from his statements, said on the list;
  // nothing at all when he has set no groceries budget (statements give shop totals, never item prices, so nothing is costed)
  const budget = h('p.pknote', { dataset: { budget: '' } });
  void (async () => {
    if (lacksSignal()) return;
    try {
      const sum = await brain.spending();
      const g = sum.budgets.find((b) => b.category === 'groceries');
      if (!g) return;
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const weeks = Math.max(1, Math.ceil((end - now.getDate() + 1) / 7));
      budget.dataset.budget = String(Math.round(g.left));
      budget.textContent = `Groceries budget: ${g.line}${g.left > 0 ? `, about £${Math.floor(g.left / weeks)} a week for the rest of the month` : ''}. From your own statements on MONEY.`;
    } catch {
      /* no line when the statements can't be read */
    }
  })();
  const el = h('div.pkcol', h('div.pkadd', input, addBtn), budget, slot, items, h('div.pkrow', share, clear), status);
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
  // ROUGH CALORIES (body.s7): each planned dinner's, a serving, from the recipe book
  const kcal = h('p.pknote', { dataset: { plankcal: '' } });
  const sums = () => {
    const all = book();
    const per = inputs.map((i, k) => {
      const r = i.value.trim() ? recipeFor(i.value, all) : null;
      return r ? { day: DAYS[k], e: kcalOf(r) } : null;
    }).filter((x): x is { day: (typeof DAYS)[number]; e: ReturnType<typeof kcalOf> } => !!x && x.e.known > 0);
    kcal.dataset.plankcal = String(per.length);
    kcal.textContent = per.length ? `Rough calories a serving: ${per.map((x) => `${x.day} ${x.e.kcal.toLocaleString('en-GB')}`).join(', ')}. About ${Math.round(per.reduce((a, x) => a + x.e.kcal, 0) / per.length / 10) * 10} on average, first estimates from my food table.` : '';
  };
  inputs.forEach((i) => i.addEventListener('change', sums));
  const fill = (days: string[]) => {
    kitchenState.plan = days.slice();
    inputs.forEach((i, k) => (i.value = days[k] ?? ''));
    sums();
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
  // WHO'S EATING (body.c6): the people he introduced, their food likes and can't-eats read from his own notes about them
  let eaters: { name: string; notes: string[] }[] = [];
  const picked = new Set<string>();
  const whoNote = h('p.pknote', { dataset: { eaters: '' } });
  const whoRow = h('div.pkrow', { role: 'group', 'aria-label': 'Who’s eating' });
  const whoBox = h('details.pkmore.kp-who', h('summary', 'Who’s eating'), whoRow, whoNote) as HTMLDetailsElement;
  const drawWho = () => {
    const f = foodNotes(eaters.filter((e) => picked.has(e.name)).flatMap((e) => e.notes));
    whoNote.dataset.eaters = [...picked].join(',');
    whoNote.textContent = !eaters.length ? 'Tell me about the people you cook for (“Sam likes chicken”, “Mia can’t eat nuts”) and pick them here.' : picked.size ? `For ${[...picked].join(' and ')}: ${f.avoid.length ? `leaving out ${f.avoid.slice(0, 6).join(', ')}` : 'nothing to leave out'}${f.like.length ? `; leaning to ${f.like.slice(0, 4).join(', ')}` : ''}. From your own notes. One shared shopping list.` : 'Pick who’s eating and FILL THE EMPTY DAYS plans round them.';
    whoRow.replaceChildren(...eaters.map((e) => {
      const b = button(e.name, () => {
        if (picked.has(e.name)) picked.delete(e.name);
        else picked.add(e.name);
        drawWho();
      }, picked.has(e.name) ? 'on' : '');
      b.setAttribute('aria-pressed', String(picked.has(e.name)));
      return b;
    }));
  };
  whoBox.addEventListener('toggle', () => {
    if (!whoBox.open || eaters.length || lacksSignal()) return drawWho();
    void brain.packDo('people', 'who', {}).then((r) => {
      eaters = ((r.data as { people?: { name: string; notes?: string[] }[] } | undefined)?.people ?? []).slice(0, 12).map((p) => ({ name: p.name, notes: p.notes ?? [] }));
      drawWho();
    }).catch(() => drawWho());
  });
  drawWho();
  const auto = button('Fill the empty days', async () => {
    const days = fillWeek(inputs.map((i) => i.value.trim()), foodNotes(eaters.filter((e) => picked.has(e.name)).flatMap((e) => e.notes)));
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
  const el = h('div.pkcol', names, ...DAYS.map((d, k) => h('div.pkitem', h('label', { style: 'flex:0 0 3.2em' }, d), inputs[k]!)), h('div.pkrow', save, auto), whoBox, kcal, h('div.pkrow', shop), shopNote, status,
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
  w.__ghosty.stopwatch = stopwatchState;
}
const expose = exposeKitchen;
