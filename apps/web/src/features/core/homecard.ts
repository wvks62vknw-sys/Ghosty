/**
 * A plan drawn from the owner's words in the chat log (the brain's design_home, tools/homeplan.ts): a card
 * under the reply — "Your plan: 6 rooms, 55.8 m²", the number of floors for a house, OPEN IN SPACE and
 * SEE IN 3-D. Drawn from the plan the phone was handed (the `home_plan` command, kept by
 * features/space/home.ts), not from the model's words, so its numbers are the plan's own. Route C's
 * reply-card classes, no new colours; the buttons take a 44 pt finger.
 */
import type { Entry } from '../../assistant/session';
import { h } from '../../core/dom';
import { settings } from '../../state/app';
import { button } from '../../ui/components';
import { cardLine } from '../../space/homeplan';

export { homeAfterReply } from '../../space/homeplan';

type HomeEntry = Extract<Entry, { kind: 'home' }>;

/** Route C's wording for a button (labels show in sentence case; "3-D" and SPACE keep theirs). */
const named = (b: HTMLButtonElement, label: string) => ((b.dataset.label = label), b);

export function homeCard(e: HomeEntry): HTMLElement {
  const unit = settings.get().units === 'imperial' ? 'imperial' : 'metric';
  const open = async () => (await import('../space/home')).openHome(e.id);
  const see = async () => (await import('../space/home')).seeHome3d(e.id);
  return h(
    'div.homecard',
    { dataset: { id: e.id } },
    h('small', { dataset: { case: 'keep' } }, 'Floor plan · from your words'),
    h('b', cardLine(e.rooms, e.m2, unit)),
    e.storeys > 1 ? h('span', `${e.storeys} floors · the floor switch is in SPACE`) : null,
    h('div.row.homecardacts', named(button('OPEN IN SPACE', () => void open(), 'on'), 'Open in SPACE'), named(button('SEE IN 3-D', () => void see()), 'See in 3-D')),
  );
}
