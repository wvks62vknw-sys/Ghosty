/**
 * DRAFTED JOBS under the Workshop's ideas (BRIEF-OCT-IDEAS-3 item 3): what he drafted for himself when the owner said YES to "Not yet.
 * Want me to learn it?" (further/selfdraft.ts). Each card is a one-paragraph plan in his words, the files he would touch and the test he
 * would add. SHIP IT is the owner's tap: it puts the plan in the chat as the request, where the self-edit's own review and checks come
 * first; DROP IT takes the draft off with UNDO. Nothing is sent or shipped until SHIP IT.
 */
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { button, empty, panel, undo, type Panel } from '../../ui/components';
import { loadDrafts, onDrafts, requestOf, saveDrafts, type SelfDraft } from '../../further/selfdraft';

/** The panel (made by the Workshop, shown in its Ideas section) and a function that repaints it from what is kept. */
export function draftedPanel(): { pn: Panel; paint(): void } {
  const pn = panel('DRAFTED JOBS', { grow: false, status: '' });
  let going = new Set<string>();
  const paint = () => {
    const list = loadDrafts().filter((d) => !going.has(d.id));
    clear(pn.body);
    pn.setStatus(list.length ? `${list.length}` : 'NONE', list.length ? 'ok' : 'off');
    if (!list.length) {
      pn.body.append(empty('NONE', 'When I can’t do something you ask and you say YES to learning it, I draft the change here: the plan in your words, the files I would touch and the test I would add. Nothing goes live until you tap SHIP IT.'));
      return;
    }
    for (const d of [...list].reverse()) pn.body.append(card(d));
  };
  const card = (d: SelfDraft): HTMLElement => {
    const ship = button('SHIP IT', () => {
      const all = loadDrafts();
      saveDrafts(all.map((x) => (x.id === d.id ? { ...x, state: 'sent' as const } : x)));
      go('core');
      void send(requestOf(d));
    }, 'on');
    ship.dataset.act = 'ship';
    ship.dataset.case = 'keep';
    ship.disabled = d.state === 'sent';
    if (d.state === 'sent') ship.textContent = 'SENT';
    const drop = button('DROP IT', () => {
      going = new Set([...going, d.id]);
      paint();
      undo(
        `Dropped the draft: ${d.ask.length > 50 ? `${d.ask.slice(0, 50)}…` : d.ask}`,
        () => {
          going.delete(d.id);
          paint();
        },
        () => {
          saveDrafts(loadDrafts().filter((x) => x.id !== d.id));
          going.delete(d.id);
          paint();
        },
      );
    }, 'warn');
    drop.dataset.act = 'drop';
    drop.dataset.case = 'keep';
    return h('div.selfdraft', { dataset: { id: d.id, state: d.state } },
      h('small.sdfrom', { dataset: { case: 'keep' } }, d.state === 'sent' ? 'SENT TO THE CHAT · YOU ASKED' : 'DRAFT · YOU ASKED'),
      h('b.sdwhat', d.ask),
      h('p.sdplan', d.plan),
      h('div.sdlab', 'FILES I WOULD TOUCH · FIRST GUESS'),
      h('p.sdfiles', d.files.join(' · ')),
      h('div.sdlab', 'THE TEST I WOULD ADD'),
      h('p.sdtest', d.test),
      h('div.row.wrap', ship, drop),
      h('small.note', 'SHIP IT starts the change in the chat. It goes live only after its checks pass and you ship it from PROPOSED CHANGES.'));
  };
  onDrafts(paint);
  paint();
  return { pn, paint };
}
