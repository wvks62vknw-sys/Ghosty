/**
 * SPENDING's words, pure (the spec imports this file): every amount to the penny with its currency, a month with nothing said as
 * that with the next thing, the statement's import in one sentence, and the names the month arrows are read by.
 */
import { gbp, monthName } from '../../../../../packages/shared/src/spending';

/** An amount as he writes it: pounds and pence, with the currency: "£1,234.56". */
export const pounds = (n: number): string => gbp(n, true);

/** The month's total: "£1,234.56 out · £2,000.00 in". */
export const totalWords = (out: number, into: number): { out: string; into: string } => ({ out: `${pounds(out)} out`, into: ` · ${pounds(into)} in` });

/** A month with nothing in it: what it is, and the next thing (an earlier month, or a newer statement). */
export function emptyMonthWords(month: string, hasEarlier: boolean): { head: string; next: string } {
  const name = monthName(month);
  return { head: `Nothing spent in ${name}.`, next: hasEarlier ? 'Tap ‹ for an earlier month, or add a newer statement.' : 'Add a newer statement from your bank and I will sort it.' };
}

/** The month arrows, named for VoiceOver, and why one cannot be pressed. */
export const NAV = { earlier: 'Earlier month', later: 'Later month', first: 'This is the earliest month I hold.', last: 'This is the latest month I hold.' };

/** What a statement's import did, in one sentence of at most about twenty words. */
export function importWords(x: { added: number; duplicates?: number; bank?: string | null; asked?: number; unplaced?: number }): string {
  const rows = `Added ${x.added} row${x.added === 1 ? '' : 's'}${x.bank ? ` from ${x.bank}` : ''}.`;
  const parts = [rows];
  if (x.duplicates) parts.push(`${x.duplicates} ${x.duplicates === 1 ? 'was' : 'were'} here already.`);
  if (x.asked) parts.push(`${x.asked} sorted by the free AI.`);
  if (x.unplaced) parts.push(`${x.unplaced} to file: tap ${x.unplaced === 1 ? 'it' : 'one'}.`);
  return parts.join(' ');
}

export const READING = 'Reading your statement…';
export const READ_FAILED = 'I could not read that statement. Check it is a CSV from your bank, then try again.';
