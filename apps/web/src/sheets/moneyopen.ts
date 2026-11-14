/**
 * OPEN MY MONEY AS A SPREADSHEET (NEXT ROUND, editors.c1 with money.c4): reads MONEY's own figures (the brain's spending sums of the
 * statements he gave it, read-only: GET /api/profile/spending, the last twelve months he holds) and makes a fresh budget workbook of them
 * (money.ts), each time he asks. Nothing in MONEY changes; the copy is his to play with. Every state in his words.
 */
import { brain } from '../api/brain';
import { sayError } from '../ui/hisWords';
import { isoDay } from '../features/brief/day';
import { moneyBook, type MoneyMonth } from './money';
import type { Book } from './model';

export type MoneySheet = { book: Book; said: string } | { book: null; said: string };

/** The workbook of his spending, or why there is none, in his words. */
export async function moneySheet(): Promise<MoneySheet> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { book: null, said: 'No signal: your money is read from your brain, so the budget sheet waits until the phone is online again.' };
  const today = isoDay(new Date());
  try {
    const s = await brain.spending(undefined, today);
    if (typeof s?.kept !== 'number' || !Array.isArray(s.months)) throw new Error('no spending on this brain yet');
    if (!s.kept || !s.months.length) return { book: null, said: 'Nothing kept in MONEY yet: add a statement there first, and your spending becomes a budget sheet here.' };
    const months = s.months.slice(-12);
    const views = await Promise.all(months.map(async (m): Promise<MoneyMonth | null> => {
      const v = m === s.month && s.view ? s.view : (await brain.spending(m, today)).view;
      return v ? { month: v.month, out: v.out, in: v.in, categories: v.categories.map((x) => ({ c: x.c, spent: x.spent })) } : null;
    }));
    const live = views.filter((v): v is MoneyMonth => !!v);
    const book = moneyBook(live, s.budgets.map((b) => ({ category: b.category, monthly: b.monthly, spent: b.spent })), today);
    const cats = Math.max(0, Object.keys(book.sheets[0]!.cells).filter((k) => /^[A-Z]+1$/.test(k)).length - 4);
    return { book, said: `Your spending as a budget sheet: ${live.length} month${live.length === 1 ? '' : 's'} by ${cats} categor${cats === 1 ? 'y' : 'ies'}, the totals as formulas, your budgets and a chart. It is a fresh copy: changing it never changes MONEY.` };
  } catch (e) {
    return { book: null, said: sayError(e, 'read your money for the budget sheet') };
  }
}
