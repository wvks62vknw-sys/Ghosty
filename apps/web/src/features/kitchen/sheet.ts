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
import { onTimers, startTimers, startedWords, stopTimer, stopTimers, timersNow } from './timers';

export type KitchenWhat = 'timers' | 'shopping' | 'plan';
const TITLES: Record<KitchenWhat, string> = { timers: 'TIMERS', shopping: 'SHOPPING LIST', plan: 'MEAL PLAN' };

export const kitchenState = {
  open: '' as '' | KitchenWhat,
  timers: [] as { id: string; name: string; left: number; ringing: boolean }[],
  list: [] as { text: string; done: boolean }[],
  plan: [] as string[],
  shared: '',
};

let open: { close(): void } | null = null;
let stopNow: (() => void) | null = null;

export async function openKitchen(what: string): Promise<void> {
  const w = (Object.keys(TITLES) as KitchenWhat[]).includes(what as KitchenWhat) ? (what as KitchenWhat) : 'timers';
  open?.close();
  expose();
  const s = w === 'timers' ? timersSheet() : w === 'shopping' ? shoppingSheet() : planSheet();
  kitchenState.open = w;
  stopNow = s.stop;
  open = modal(TITLES[w], h('div.pk', { dataset: { pack: 'kitchen', screen: w } }, s.el), () => {
    stopNow?.();
    stopNow = null;
    open = null;
    kitchenState.open = '';
  });
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
  const paint = () => {
    const now = timersNow();
    kitchenState.timers = now;
    rows.replaceChildren(
      ...(now.length
        ? now.map((t) => {
            const stop = button(t.ringing ? 'Stop' : 'Cancel', () => stopTimer(t.id), t.ringing ? 'on' : '');
            stop.setAttribute('aria-label', `${t.ringing ? 'Stop' : 'Cancel'} the ${t.name} timer`);
            return h(`div.pktimer${t.ringing ? '.ringing' : ''}` as 'div', { role: 'timer', 'aria-label': `${t.name}: ${t.ringing ? 'ringing' : `${mmss(t.left)} left`}` }, h('b', t.ringing ? '0:00' : mmss(t.left)), h('span', t.name), stop);
          })
        : [h('p.pknote', 'No timers. Say "timer 8 minutes for the pasta", or type it below.')]),
    );
  };
  const input = h('input', { type: 'text', placeholder: '8 minutes for the pasta', 'aria-label': 'A new timer: how long and what for', enterKeyHint: 'go' }) as HTMLInputElement;
  const add = () => {
    const ask = timerAsked(/\btimers?\b/i.test(input.value) ? input.value : `timer ${input.value}`);
    if (ask && 'start' in ask) {
      startTimers(ask.start);
      input.value = '';
    } else toast('Say how long and what for, like "8 minutes for the pasta".', 'warn');
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  const set = button('Set', add, 'on');
  set.setAttribute('aria-label', 'Set the timer');
  const off = onTimers(paint);
  paint();
  const el = h('div.pkcol', rows, h('div.pkadd', input, set), h('p.pknote', 'They ring with a sound and a buzz while Ghosty is open. For a locked phone, ask me for a reminder instead.'), h('div.pkrow', button('Stop all', () => stopTimers(''))));
  return { el, stop: off };
}

function shoppingSheet(): { el: HTMLElement; stop(): void } {
  const items = h('ul.pkitems', { 'aria-label': 'Shopping list' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Kept in my brain: add by voice in the chat too ("add milk to the list").');
  let list: ShopItem[] = [];
  const paint = () => {
    kitchenState.list = list.map((x) => ({ text: x.text, done: x.done }));
    items.replaceChildren(
      ...(list.length
        ? [...list.filter((x) => !x.done), ...list.filter((x) => x.done)].map((x) => {
            const box = h('input', { type: 'checkbox', checked: x.done, 'aria-label': `${x.text}${x.done ? ', got' : ''}` }) as HTMLInputElement;
            box.addEventListener('change', () => void act({ id: x.id, op: box.checked ? 'tick' : 'untick' }));
            return h(`li.pkitem${x.done ? '.done' : ''}` as 'li', h('label', box, x.text));
          })
        : [h('li.pknote', 'The list is empty.')]),
    );
  };
  const act = async (args: Record<string, unknown>) => {
    try {
      const r = await brain.packDo('kitchen', 'shop', args);
      list = ((r.data as { list?: ShopItem[] } | undefined)?.list ?? list).slice();
      paint();
      return r.text;
    } catch (e) {
      status.textContent = `My brain didn’t answer: ${(e as Error).message}`;
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
  const clear = button('Clear ticked', () => void act({ words: 'clear ticked' }));
  void act({ words: '' });
  const el = h('div.pkcol', h('div.pkadd', input, addBtn), items, h('div.pkrow', share, clear), status);
  return { el, stop: () => undefined };
}

function planSheet(): { el: HTMLElement; stop(): void } {
  const inputs = DAYS.map((d) => h('input', { type: 'text', placeholder: '—', 'aria-label': `${d}’s dinner` }) as HTMLInputElement);
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'This week’s dinners, kept in my brain; tonight’s shows in the Brief.');
  const fill = (days: string[]) => {
    kitchenState.plan = days.slice();
    inputs.forEach((i, k) => (i.value = days[k] ?? ''));
  };
  const act = async (args: Record<string, unknown>) => {
    try {
      const r = await brain.packDo('kitchen', 'plan', args);
      fill((r.data as { plan?: { days?: string[] } } | undefined)?.plan?.days ?? []);
      return r.text;
    } catch (e) {
      status.textContent = `My brain didn’t answer: ${(e as Error).message}`;
      return '';
    }
  };
  void act({ words: '' });
  const save = button('Save the week', async () => {
    const t = await act({ days: inputs.map((i) => i.value.trim()) });
    if (t) status.textContent = 'Saved.';
  }, 'on');
  const el = h('div.pkcol', ...DAYS.map((d, k) => h('div.pkitem', h('label', { style: 'flex:0 0 3.2em' }, d), inputs[k]!)), h('div.pkrow', save), status);
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
