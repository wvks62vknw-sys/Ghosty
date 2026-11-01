/**
 * The car on show (BRIEF-CAR): which car the Studio's CAR pane draws, what is wrong with it and what is lit, and the
 * vehicle records read this session to draw it. A record is the public one for a plate he named or typed, held in memory
 * while Ghosty is open and never stored (no localStorage, no IndexedDB): the CAR card shows it once, the car is drawn
 * from it. What he said is wrong with a car is held the same way, by its card.
 */
import { createStore } from '../core/store';
import { normalisePlate, type VehicleAnswer } from '../../../../packages/shared/src/plates';
import type { FaultPick } from './faults';
import { motLinesOf } from './motlines';
import type { MotLine, View } from './parts';
import { factsFrom, specFrom, type CarSpec } from './spec';

export interface CarNow {
  spec: CarSpec | null;
  /** Whose car it is, as he calls them ("Dad"; "me"; '' for a car he only typed the plate of). */
  whose: string;
  view: View;
  /** What he said is wrong, and its suspects (the FIX IT list). */
  fault: FaultPick | null;
  /** The card this car came from ("car:AB12CDE", "car:standin"). */
  card: string;
}

export const carNow = createStore<CarNow>({ spec: null, whose: '', view: 'car', fault: null, card: '' });

const records = new Map<string, VehicleAnswer>();

/** Hold a plate's record for this session (memory only, at most a few; a missing key or a failure is asked again next time). */
export function keepRecord(plate: string, answer: VehicleAnswer): void {
  if (!answer.ok) return;
  const p = normalisePlate(plate);
  records.delete(p);
  records.set(p, answer);
  while (records.size > 6) records.delete(records.keys().next().value!);
}

export function recordOf(plate: string): VehicleAnswer | null {
  return plate ? (records.get(normalisePlate(plate)) ?? null) : null;
}

/** The car for a plate, from its record when there is one; a stand-in with the plate when there is not. */
export function specOf(plate: string): CarSpec {
  return specFrom(factsFrom(recordOf(plate), plate), plate);
}

/** The MOT history's defects for a plate held this session, newest test first. */
export function motOf(plate: string): MotLine[] {
  return motLinesOf(recordOf(plate));
}

/** What he said is wrong, by the card it is about (memory only). */
export interface CardFault {
  text: string;
  pick: FaultPick | null;
}
const faults = new Map<string, CardFault>();
/** The words typed in a card's box but not sent yet, so a repaint of the chat keeps them. */
export const drafts = new Map<string, string>();

export function setFault(cardId: string, f: CardFault): void {
  faults.set(cardId, f);
  while (faults.size > 12) faults.delete(faults.keys().next().value!);
  const now = carNow.get();
  if (now.card === cardId) carNow.set({ fault: f.pick, ...(f.pick ? { view: f.pick.view } : {}) });
}
export const faultOf = (cardId: string): CardFault | null => faults.get(cardId) ?? null;

/** The card id for a plate (as the CAR card has it), or the stand-in's. */
export const cardIdOf = (plate: string) => (plate ? `car:${normalisePlate(plate)}` : 'car:standin');
