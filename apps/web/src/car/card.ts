/**
 * The CAR card's new line and button (BRIEF-CAR item 4; SHOW ME, DON'T TELL ME): a CAR card with a car's record gains
 * WHAT'S WRONG? (one line, in his words) and SHOW ME. Once he says what is wrong — in the box or in the chat
 * (car/ask.ts) — the fault table (car/faults.ts, no model) picks the suspects and the card says, first and once, the
 * SAFETY line where there is one, then the top suspect in one line with its check and its cost (a first estimate). SHOW
 * ME opens the 3D STUDIO on the car in the right view (the wheel for the brakes, the bay for the battery) with the
 * suspects lit. features/core/cards.ts draws these into the card; nothing here asks a model anything.
 */
import type { Card } from '../../../../packages/shared/src/cards';
import { chat } from '../assistant/session';
import { run } from '../commands/registry';
import { h } from '../core/dom';
import { button } from '../ui/components';
import { faultFor, faultLine, symptomOf } from './faults';
import { specFrom } from './spec';
import { carNow, drafts, faultOf, motOf, setFault, specOf } from './state';

export interface CarExtra {
  /** The safety line, said first. */
  safe: HTMLElement | null;
  /** The card's line in place of its own: the top suspect. */
  line: string | null;
  /** WHAT'S WRONG? */
  box: HTMLElement | null;
  showMe: HTMLButtonElement;
  fault: boolean;
}

/** Paint the chat again (its cards read what was said from car/state.ts). */
const repaint = () => chat.set((s) => ({ entries: [...s.entries] }));

/** What he said is wrong with this card's car: the suspects from the table, held with the card. */
export function sayWrong(c: Pick<Card, 'id' | 'car'>, text: string): void {
  const plate = c.car?.plate ?? '';
  const spec = plate ? specOf(plate) : specFrom(null);
  const symptom = symptomOf(text, true);
  setFault(c.id, { text, pick: symptom ? faultFor(symptom, { lines: motOf(plate), electric: spec.electric }) : null });
}

/** SHOW ME: the Studio on this card's car, in the view the fault points to, its suspects lit. */
export function showMe(c: Pick<Card, 'id' | 'car'>): void {
  const plate = c.car?.plate ?? '';
  const f = faultOf(c.id);
  carNow.set({ spec: plate ? specOf(plate) : specFrom(null), whose: c.car?.whose ?? '', view: f?.pick?.view ?? 'car', fault: f?.pick ?? null, card: c.id });
  void run('open_studio', { sample: 'car' });
}

/** The extra a CAR card carries: a record's card, or any car something was said to be wrong with. Null for the rest. */
export function carExtra(c: Card): CarExtra | null {
  if (c.kind !== 'car' || !c.car) return null;
  const record = !!c.acts?.some((a) => a.run?.name === 'vehicle_check');
  const f = faultOf(c.id);
  if (!record && !f) return null;
  const showBtn = button('SHOW ME', () => showMe(c), 'on');
  showBtn.setAttribute('aria-label', f?.pick ? `Show me: ${f.pick.symptom.title.toLowerCase()}, on the car in 3-D` : 'Show me the car in 3-D');
  const pick = f?.pick ?? null;
  let box: HTMLElement | null = null;
  if (!pick) {
    const input = h('input.ccfixin', { type: 'text', placeholder: 'What’s wrong?', 'aria-label': 'What’s wrong with the car? In your own words', enterKeyHint: 'go', autocomplete: 'off', maxLength: 200 });
    input.value = drafts.get(c.id) ?? '';
    input.addEventListener('input', () => drafts.set(c.id, input.value));
    box = h('form.ccfix', { onsubmit: (e: Event) => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      drafts.delete(c.id);
      sayWrong(c, t);
      repaint();
    } }, input);
  }
  return {
    safe: pick?.safety ? h('b.ccsafe', pick.safety) : null,
    line: pick ? faultLine(pick) : f ? `I don’t know that one yet: try “grinding when I brake” or “won’t start, just clicks”.` : null,
    box,
    showMe: showBtn,
    fault: !!pick,
  };
}
