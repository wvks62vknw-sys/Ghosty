/**
 * GIFTS (APPS ROUND, MEMORY lane; like Giftster or Santa's Bag, his own list only): every gift for everyone in one place, from an idea
 * to bought, wrapped and given, with what each cost against a budget per occasion; and the gifts he RECEIVED, each with its thank-you
 * to send. A page of PEOPLE built from the App Kit's parts (listRow, stateCard). Kept on this phone in `ghosty.gifts` (and the
 * encrypted backup). Prices are what he types: nothing is looked up, bought or sent.
 */
import { clear, h } from '../../core/dom';
import { button, undo } from '../../ui/components';
import { listRow, stateCard } from '../../ui/appkit';

export type GiftStage = 'idea' | 'bought' | 'wrapped' | 'given';
export interface Gift {
  id: string;
  /** Who it is for (to him: who it came from, for a received one). */
  who: string;
  what: string;
  /** The occasion: "Christmas", "Jo's birthday". */
  occasion: string;
  /** What it cost, in pounds, as he typed it (0 for none). */
  cost: number;
  stage: GiftStage;
  /** A gift he received; `thanked` when his thank-you went. */
  received?: boolean;
  thanked?: boolean;
  at: number;
}
export interface GiftData {
  gifts: Gift[];
  /** A budget per occasion, in pounds. */
  budgets: Record<string, number>;
}

export const GIFTS_KEY = 'ghosty.gifts';
export const STAGES: GiftStage[] = ['idea', 'bought', 'wrapped', 'given'];
const STAGE_WORD: Record<GiftStage, string> = { idea: 'Idea', bought: 'Bought', wrapped: 'Wrapped', given: 'Given' };

export const G = {
  WHO: 'Who for',
  WHAT: 'The gift',
  OCCASION: 'Occasion, like Christmas',
  COST: '£',
  ADD: 'ADD GIFT',
  GOT: 'I WAS GIVEN THIS',
  EMPTY: 'No gifts yet. Add an idea for someone, or one you were given so you remember to say thank you.',
  NEXT: (g: Gift) => (g.received ? (g.thanked ? 'Thanked' : 'Say thank you') : g.stage === 'given' ? 'Given' : `Next: ${STAGE_WORD[STAGES[STAGES.indexOf(g.stage) + 1]!]}`),
  MOVED: (g: Gift) => (g.received ? `Thank-you to ${g.who} marked sent.` : `${g.what} for ${g.who}: ${STAGE_WORD[g.stage].toLowerCase()}.`),
  GONE: (g: Gift) => `${g.what} is off the list.`,
  BUDGET: (o: string, spent: number, budget: number) => (budget ? `${o}: £${spent.toFixed(2)} of £${budget.toFixed(2)}${spent > budget ? ', over budget' : ''}` : `${o}: £${spent.toFixed(2)} spent`),
  SET_BUDGET: 'SET BUDGET',
  NOTE: 'Only what you type. Prices are yours; nothing is looked up, bought or sent.',
};

export function loadGifts(): GiftData {
  try {
    const v = JSON.parse(localStorage.getItem(GIFTS_KEY) ?? 'null') as Partial<GiftData> | null;
    return { gifts: Array.isArray(v?.gifts) ? v!.gifts.filter((g) => g && typeof g.id === 'string') : [], budgets: v?.budgets && typeof v.budgets === 'object' ? v.budgets : {} };
  } catch {
    return { gifts: [], budgets: {} };
  }
}
const saveGifts = (d: GiftData) => {
  try {
    localStorage.setItem(GIFTS_KEY, JSON.stringify(d));
  } catch {
    /* no room: what is open stays */
  }
};

/** A gift one step on: idea → bought → wrapped → given; a received one's thank-you marked sent. */
export function advance(g: Gift): Gift {
  if (g.received) return { ...g, thanked: true };
  const i = STAGES.indexOf(g.stage);
  return { ...g, stage: STAGES[Math.min(STAGES.length - 1, i + 1)]! };
}
/** Spent per occasion (what was bought, wrapped or given; ideas cost nothing yet). */
export function spent(d: GiftData): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of d.gifts) if (!g.received && g.occasion) m.set(g.occasion, (m.get(g.occasion) ?? 0) + (g.stage === 'idea' ? 0 : g.cost || 0));
  for (const o of Object.keys(d.budgets)) if (!m.has(o)) m.set(o, 0);
  return m;
}
/** What still needs doing first: thank-yous owed, then gifts not given (ideas last), then the done ones. */
export function giftOrder(gs: Gift[]): Gift[] {
  const rank = (g: Gift) => (g.received ? (g.thanked ? 9 : 0) : g.stage === 'given' ? 8 : 3 - STAGES.indexOf(g.stage));
  return [...gs].sort((a, b) => rank(a) - rank(b) || b.at - a.at);
}
/** A pound amount from his words: "£24.99", "24", "24,50". */
export const pounds = (s: string): number => {
  const n = Number(s.replace(/[£\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/** What a spec reads: window.__ghosty.gifts. */
export const giftsState = { gifts: 0, owed: 0, state: 'idle' as 'idle' | 'empty' | 'shown' };

export function giftsSheet(names: () => string[] = () => []): HTMLElement {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.gifts = giftsState;
  const field = (ph: string, label: string, list?: string) => {
    const i = h('input', { type: 'text', placeholder: ph, 'aria-label': label, maxlength: 60 }) as HTMLInputElement;
    if (list) i.setAttribute('list', list);
    return i;
  };
  const who = field(G.WHO, 'Who it is for', 'gfnames');
  const what = field(G.WHAT, 'The gift');
  const occasion = field(G.OCCASION, 'The occasion', 'gfoccasions');
  const cost = h('input', { type: 'text', inputmode: 'decimal', placeholder: G.COST, 'aria-label': 'What it costs, in pounds' }) as HTMLInputElement;
  const namesList = h('datalist#gfnames');
  const occList = h('datalist#gfoccasions');
  const budgets = h('div.gfbudgets', { dataset: { case: 'keep' } });
  const list = h('div.gflist', { role: 'list', dataset: { case: 'keep' } });

  const paint = () => {
    const d = loadGifts();
    clear(namesList, ...names().map((n) => h('option', { value: n })));
    clear(occList, ...[...new Set([...d.gifts.map((g) => g.occasion).filter(Boolean), ...Object.keys(d.budgets)])].map((o) => h('option', { value: o })));
    giftsState.gifts = d.gifts.length;
    giftsState.owed = d.gifts.filter((g) => g.received && !g.thanked).length;
    giftsState.state = d.gifts.length ? 'shown' : 'empty';
    clear(budgets, ...[...spent(d)].map(([o, s]) => {
      const b = d.budgets[o] ?? 0;
      const line = h('p.gfbudget', { dataset: { over: String(!!b && s > b) } }, G.BUDGET(o, s, b));
      const amount = h('input', { type: 'text', inputmode: 'decimal', placeholder: '£', value: b ? String(b) : '', 'aria-label': `A budget for ${o}, in pounds` }) as HTMLInputElement;
      const set = button(G.SET_BUDGET, () => {
        const v = pounds(amount.value);
        const now = loadGifts();
        if (v) now.budgets[o] = v;
        else delete now.budgets[o];
        saveGifts(now);
        paint();
      });
      set.setAttribute('aria-label', `Set a budget for ${o}`);
      return h('div.gfbrow', line, h('div.row.wrap', amount, set));
    }));
    if (!d.gifts.length) {
      /* state: people.gifts empty */
      clear(list, stateCard('empty', G.EMPTY));
      return;
    }
    clear(list, ...giftOrder(d.gifts).map((g) => {
      const sub = g.received ? `from ${g.who}${g.occasion ? ` · ${g.occasion}` : ''}` : `for ${g.who}${g.occasion ? ` · ${g.occasion}` : ''}${g.cost ? ` · £${g.cost.toFixed(2)}` : ''} · ${STAGE_WORD[g.stage]}`;
      const done = g.received ? !!g.thanked : g.stage === 'given';
      const row = listRow({ id: g.id, title: g.what, sub, meta: G.NEXT(g) }, { onTap: done ? undefined : () => move(g.id), onDelete: () => drop(g.id) });
      row.classList.toggle('gfowed', !!g.received && !g.thanked);
      row.classList.toggle('gfdone', done);
      row.querySelector('.ak-rowmain')?.setAttribute('aria-label', `${g.what}, ${sub}. ${done ? 'Done.' : `Tap: ${G.NEXT(g)}.`}`);
      return row;
    }));
  };
  const move = (id: string) => {
    const d = loadGifts();
    const i = d.gifts.findIndex((g) => g.id === id);
    if (i < 0) return;
    const before = d.gifts[i]!;
    d.gifts[i] = advance(before);
    saveGifts(d);
    paint();
    undo(G.MOVED(d.gifts[i]!), () => {
      const now = loadGifts();
      const j = now.gifts.findIndex((g) => g.id === id);
      if (j >= 0) now.gifts[j] = before;
      saveGifts(now);
      paint();
    });
  };
  const drop = (id: string) => {
    const d = loadGifts();
    const g = d.gifts.find((x) => x.id === id);
    if (!g) return;
    saveGifts({ ...d, gifts: d.gifts.filter((x) => x.id !== id) });
    paint();
    undo(G.GONE(g), () => {
      const now = loadGifts();
      saveGifts({ ...now, gifts: [...now.gifts, g] });
      paint();
    });
  };
  const add = (received: boolean) => () => {
    const t = (x: HTMLInputElement) => x.value.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!t(who)) return who.focus();
    if (!t(what)) return what.focus();
    const d = loadGifts();
    d.gifts.push({ id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, who: t(who), what: t(what), occasion: t(occasion), cost: received ? 0 : pounds(cost.value), stage: received ? 'given' : 'idea', ...(received ? { received: true, thanked: false } : {}), at: Date.now() });
    saveGifts(d);
    what.value = '';
    cost.value = '';
    paint();
  };
  paint();
  return h('div.gfsheet', { dataset: { case: 'keep' } },
    h('div.gfform', who, namesList, what, h('div.row.wrap.gfpair', occasion, occList, cost), h('div.row.wrap', button(G.ADD, add(false), 'on'), button(G.GOT, add(true)))),
    budgets, list, h('p.note', G.NOTE));
}
