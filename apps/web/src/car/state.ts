/**
 * The car on show (BRIEF-CAR): which car the Studio's CAR pane draws, and the vehicle records read this session to draw
 * it. A record is the public one for a plate he named or typed, held in memory while Ghosty is open and never stored
 * (no localStorage, no IndexedDB): the CAR card shows it once, the car is drawn from it.
 */
import { createStore } from '../core/store';
import { normalisePlate, type VehicleAnswer } from '../../../../packages/shared/src/plates';
import type { View } from './parts';
import { factsFrom, specFrom, type CarSpec } from './spec';

export interface CarNow {
  spec: CarSpec | null;
  /** Whose car it is, as he calls them ("Dad"; "me"; '' for a car he only typed the plate of). */
  whose: string;
  view: View;
}

export const carNow = createStore<CarNow>({ spec: null, whose: '', view: 'car' });

const records = new Map<string, VehicleAnswer>();

/** Hold a plate's record for this session (memory only, at most a few). */
export function keepRecord(plate: string, answer: VehicleAnswer): void {
  const p = normalisePlate(plate);
  records.delete(p);
  records.set(p, answer);
  while (records.size > 6) records.delete(records.keys().next().value!);
}

export function recordOf(plate: string): VehicleAnswer | null {
  return records.get(normalisePlate(plate)) ?? null;
}

/** The car for a plate, from its record when there is one; a stand-in with the plate when there is not. */
export function specOf(plate: string): CarSpec {
  return specFrom(factsFrom(recordOf(plate), plate), plate);
}
