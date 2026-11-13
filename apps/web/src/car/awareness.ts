/**
 * What the car pane says about itself (BRIEF-AWARENESS; shell/awareness.ts): the car (its make and model, never its plate), the
 * view, the fault he described and the part he tapped, said the way he would. Pure: the pane's state goes in, a ScreenContext
 * comes out.
 */
import type { ScreenContext, Selected } from '../../../../packages/shared/src/awareness';
import type { FaultPick } from './faults';
import { isPart, PARTS, type View } from './parts';
import type { CarSpec } from './spec';

const VIEW_WORDS: Record<View, string> = { car: 'the outside', bay: 'the engine bay, bonnet up', wheel: 'the wheel off', under: 'underneath' };
const lower = (s: string) => s.trim().toLowerCase();

/** The car as it is named on the screen ("Blue Volkswagen Golf"), without its plate: "The car AB12 CDE" is only a plate, so it is not named. */
export function carName(spec: CarSpec | null): string {
  const t = spec?.title ?? '';
  return !t || /^The car /i.test(t) || /^A car$/i.test(t) ? '' : t;
}

export function carContext(o: { spec: CarSpec | null; view: View; picked: string; fault: FaultPick | null; inst?: string }, now = Date.now()): ScreenContext {
  const f = o.fault;
  const name = carName(o.spec);
  const bits = [`the car${name ? `, ${name}` : ''}`, VIEW_WORDS[o.view]];
  if (f) bits.push(`fixing “${f.symptom.title.toLowerCase()}”`, `${f.lit.length} part${f.lit.length === 1 ? '' : 's'} lit`);
  let selected: Selected | undefined;
  if (o.picked && isPart(o.picked)) {
    const at = f ? f.lit.indexOf(o.picked) : -1;
    selected = { kind: 'part', id: o.picked, label: `the ${lower(o.inst || PARTS[o.picked].name)}`, detail: at >= 0 ? `suspect ${at + 1} of ${f!.lit.length} for “${f!.symptom.title.toLowerCase()}”` : f ? 'not one of the suspects' : 'tapped, with its quick check' };
  } else if (f) {
    selected = { kind: 'fault', id: f.symptom.id, label: `“${f.symptom.title.toLowerCase()}”`, detail: `${f.suspects.length} suspect${f.suspects.length === 1 ? '' : 's'}, most likely: ${lower(f.suspects[0]?.label ?? 'none')}` };
  }
  return { screen: 'studio', title: 'The car', line: bits.join(', '), ...(selected ? { selected } : {}), at: now };
}
