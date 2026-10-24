/**
 * SPENDING in a chat (spending.ts): "how much did I spend on eating out?", "what changed since last month?",
 * "what subscriptions do I have?" (spending_summary) and "£200 a month on eating out" (set_budget). Statements
 * come in only through the Agenda tab's SPENDING card: no bank access of any kind. Not in `extraTools`: its own
 * keyword group in tools/index.ts.
 */
import { gbp, monthName, PRIVACY } from '../../../../packages/shared/src/spending';
import { setBudget, spendingSummary } from '../spending';
import { arg, type Tool } from './types';

export const spendingTools: Tool[] = [
  {
    name: 'spending_summary',
    description:
      "The owner's spending from the bank statements he added (Agenda → SPENDING; no bank access): a month's categories and budgets, the year, what changed since last month, subscriptions with yearly totals.",
    parameters: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM (default: the latest on a statement)' } } },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const s = await spendingSummary(ctx.storage, arg.str(a, 'month', false) || null);
      if (!s.kept || !s.view) return `No statement added yet. ${PRIVACY} The SPENDING card is under the Agenda tab.`;
      const v = s.view;
      return [
        `${monthName(s.month)} ${s.month.slice(0, 4)}: ${gbp(v.out)} out, ${gbp(v.in)} in. ${v.categories.map((c) => `${c.c} ${gbp(c.spent)}`).join(', ')}.`,
        s.budgets.length ? `Budgets: ${s.budgets.map((b) => `${b.category} ${gbp(b.spent)} of ${gbp(b.monthly)} — ${b.line}`).join('; ')}.` : 'No budgets set.',
        `Since last month: ${s.changes.join(' ')}`,
        s.subscriptions.length
          ? `Subscriptions: ${s.subscriptions.map((x) => `${x.name} ${gbp(x.amount, true)} ${x.cadence} (${gbp(x.yearly)} a year${x.was !== undefined ? `; was ${gbp(x.was, true)} until ${x.changed}` : ''})`).join('; ')}.`
          : 'No subscriptions found.',
        `${s.year!.year} so far: ${gbp(s.year!.out)} out.`,
        `(${s.kept} rows kept, up to ${s.cap}.)`,
      ].join('\n');
    },
  },
  {
    name: 'set_budget',
    description: 'Set a monthly spending budget from the owner\'s words, e.g. "£200 a month on eating out" (a week or a year is turned into a month; £0 removes it).',
    parameters: { type: 'object', properties: { words: { type: 'string' } }, required: ['words'] },
    risk: 'auto',
    async run(a, ctx) {
      const b = await setBudget(ctx.storage, { words: arg.str(a, 'words') });
      if (!b.monthly) return `Took away the ${b.category} budget.`;
      const s = await spendingSummary(ctx.storage);
      const st = s.budgets.find((x) => x.category === b.category);
      return `Budget set: ${gbp(b.monthly)} a month on ${b.category}.${st && s.kept ? ` ${monthName(s.month)}: ${gbp(st.spent)} spent, ${st.line}.` : ''} It shows as a bar in Agenda → SPENDING.`;
    },
  },
];
