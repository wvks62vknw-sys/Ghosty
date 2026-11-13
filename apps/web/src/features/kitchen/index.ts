/**
 * KITCHEN (BRIEF-TABS 2; LIFE): the kitchen pack's own screen, its sheet's three pages (features/kitchen/sheet.ts): the timers on
 * this phone (several at once, named, ringing with a sound and a buzz), the shopping list and the week's meal plan kept in my
 * brain, and the pantry and the recipe book kept on this phone (features/kitchen/larder.ts). "timer 8 minutes for the pasta" and "shopping list" still open the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const kitchenTab: TabDef = {
  id: 'kitchen',
  title: 'KITCHEN',
  icon: '<path d="M4.5 10.5h15v5a4 4 0 01-4 4h-7a4 4 0 01-4-4z"/><path d="M2.5 10.5h19M9.5 7c0-1.4 1-1.9 1-3.3M13.5 7c0-1.4 1-1.9 1-3.3"/>',
  scene: 'backdrop',
  blurb: 'timers · shopping list · meal plan · pantry · recipes',
  now: () => cardNow('kitchen'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'kitchen',
      tag: 'LIFE // KITCHEN',
      sub: 'Timers, the shopping list, the week’s dinners, your pantry and your recipe book.',
      big: () => cardBig('kitchen'),
      load: () => cardLoad('kitchen'),
      sections: async () => {
        const m = await import('./sheet');
        const part = (what: import('./sheet').KitchenWhat) => ({ title: m.KITCHEN_TITLES[what], pack: 'kitchen', screen: what, build: () => m.kitchenScreen(what) });
        return [
          { id: 'timers', label: 'Timers', parts: [part('timers')] },
          { id: 'shopping', label: 'Shopping', parts: [part('shopping')] },
          { id: 'plan', label: 'Meal plan', parts: [part('plan')] },
          { id: 'pantry', label: 'Pantry', parts: [part('pantry')] },
          { id: 'recipes', label: 'Recipes', parts: [part('recipes')] },
        ];
      },
    }),
};
