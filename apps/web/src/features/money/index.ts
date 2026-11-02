/**
 * MONEY (BRIEF-TABS 2; LIFE): the money pack's own screen. Its page is the sheet's (features/money/sheet.ts): PASTE A STATEMENT,
 * read in code on its way to my brain's SPENDING and sorted by a table of rules, no model and no bank access. The chat's
 * "paste a statement" still opens the same sheet; everything else the pack does is asked in the chat (tools/money.ts).
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const moneyTab: TabDef = {
  id: 'money',
  title: 'MONEY',
  icon: '<rect x="3" y="6.5" width="18" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  scene: 'backdrop',
  blurb: 'a statement read by rules · spending by month · no bank access',
  now: () => cardNow('money'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'money',
      tag: 'LIFE // MONEY',
      sub: 'Paste a statement: I read it in code, sort it by rules and keep the month in your brain. No bank access, ever.',
      big: () => cardBig('money'),
      load: () => cardLoad('money'),
      sections: async () => {
        const m = await import('./sheet');
        return [{ id: 'statement', label: 'Statement', parts: [{ title: m.STATEMENT_TITLE, pack: 'money', screen: 'statement', build: m.statementScreen }] }];
      },
    }),
};
