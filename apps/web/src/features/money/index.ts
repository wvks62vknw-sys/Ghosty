/**
 * MONEY (BRIEF-TABS 2; LIFE; FINAL ROUND, the money lane): the money pack's own screen, a budgeting app of its own (features/money
 * /app.ts): YOUR MONTH (out, in, left over, the pace, each category, where it went most, every payment), BUDGETS, BILLS AND
 * SUBSCRIPTIONS (what is due next, from his statements and the bills he showed HOME), TRENDS (the last six months), and PASTE A
 * STATEMENT (features/money/sheet.ts), read by plain rules on its way to my brain's SPENDING: no model and no bank access. The chat's
 * "paste a statement" still opens the same sheet; the rest of the money pack is asked in the chat too (tools/money.ts).
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const moneyTab: TabDef = {
  id: 'money',
  title: 'MONEY',
  icon: '<rect x="3" y="6.5" width="18" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  scene: 'backdrop',
  blurb: 'safe to spend · your month · budgets · goals · bills · calendar · your year · from a statement, no bank access',
  now: () => cardNow('money'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'money',
      tag: 'LIFE // MONEY',
      sub: 'Your month, budgets and bills, from statements you give me. No bank access.',
      big: () => cardBig('money'),
      load: () => cardLoad('money'),
      sections: async () => {
        const [a, m, n] = await Promise.all([import('./app'), import('./sheet'), import('./plan')]);
        const part = (p: 'month' | 'budgets' | 'bills' | 'trends') => ({ title: a.MONEY_TITLES[p], pack: 'money', screen: p, build: () => a.moneyPage(p) });
        // [moneynext] money and papers handled for you: the calendar, goals, shared bills and the year (features/money/plan.ts)
        const plan = (p: 'calendar' | 'goals' | 'shared' | 'year' | 'watches') => ({ title: n.PLAN_TITLES[p], pack: 'money', screen: p, build: () => n.planPage(p) });
        return [
          // (six pills at most, ui/sections.ts: goals stand with the budgets, shared bills with the bills, the year with the trends)
          { id: 'month', label: 'Month', parts: [part('month')] },
          { id: 'budgets', label: 'Budgets', parts: [part('budgets'), plan('goals')] },
          { id: 'bills', label: 'Bills', parts: [part('bills'), plan('shared')] },
          { id: 'calendar', label: 'Calendar', parts: [plan('calendar')] },
          { id: 'trends', label: 'Trends', parts: [part('trends'), plan('year'), plan('watches')] },
          { id: 'statement', label: 'Statement', parts: [{ title: m.STATEMENT_TITLE, pack: 'money', screen: 'statement', build: m.statementScreen }] },
        ];
      },
    }),
};
