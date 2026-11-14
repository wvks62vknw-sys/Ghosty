/**
 * THE MONEY APP'S WORDS (FINAL ROUND, the money lane), pure: the plain things he says that open one of its pages, each in more than
 * one wording. Narrow on purpose: a question about his money ("how much did I spend on fuel?") stays the brain's (tools/money.ts);
 * only the words that name a page open it here, with no model.
 */
export type MoneyAsk = 'month' | 'budgets' | 'bills' | 'trends';

const LEAD = String.raw`^(?:(?:ok(?:ay)?|please|hey ghosty)[, ]+)?(?:(?:show|open|give|take)(?: me)?(?: to)? |let me see |see |go to )?(?:my |the )?`;
const TAIL = String.raw`(?: page| screen| please)?[.!?]*$`;
const ASKS: [MoneyAsk, RegExp][] = [
  ['budgets', new RegExp(`${LEAD}(?:budgets?|monthly budgets?|budget page)${TAIL}`, 'i')],
  ['bills', new RegExp(`${LEAD}(?:subscriptions?|bills and subscriptions|subscriptions and bills|direct debits|regular payments)${TAIL}`, 'i')],
  ['trends', new RegExp(`${LEAD}(?:spending trends|money trends|spending over time|spending by month)${TAIL}`, 'i')],
  ['month', new RegExp(`${LEAD}(?:spending|money|money app|month(?:['’]s)? (?:spending|money)|spending this month|money this month)${TAIL}`, 'i')],
];

/** The page his words name, or null. */
export function moneyAsked(text: string): MoneyAsk | null {
  const t = text.trim();
  if (!t || t.length > 60) return null;
  for (const [page, re] of ASKS) if (re.test(t)) return page;
  return null;
}

/** What I say as the page opens. */
export const MONEY_OPENS: Record<MoneyAsk, string> = {
  month: 'Your month: money out, money in, what is left over, and every payment. All from the statements you gave me.',
  budgets: 'Your budgets: what is left in each, and what that is a day. Set one or take one away there.',
  bills: 'Your bills and subscriptions, in the order they are due, with what they come to a month and a year.',
  trends: 'Your last six months side by side, with the average, the dearest and the cheapest.',
};
