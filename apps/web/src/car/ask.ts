/**
 * His words about a car, answered on the phone with no model (BRIEF-CAR item 4; the phrases registry, assistant/phrases.ts
 * `carfault` and `carview`):
 *  - "my dad's car makes a grinding noise when I brake": the fault table picks the suspects for that car (Dad's, as he
 *    named it; else the car on show or the last CAR card; else the one car he named; else a stand-in) and its CAR card
 *    comes to the end of the conversation saying, first and once, the safety line, then the top suspect with its check
 *    and a first-estimate cost, and SHOW ME. Read aloud in that order when he asked by voice;
 *  - "open the bonnet", "show me the engine", "show me the brakes", "what's under it": the 3D STUDIO on that car in that
 *    view. With no car in mind only the bonnet opens (on a stand-in); the rest go to the brain as ever.
 * A car's record is the public one for its plate (the vehicle check, as it is), held while Ghosty is open, never stored.
 */
import { RELATIONS, card, carCard, type Card, type NamedCar } from '../../../../packages/shared/src/cards';
import { normalisePlate, type VehicleAnswer } from '../../../../packages/shared/src/plates';
import { headers } from '../api/brain';
import { run } from '../commands/registry';
import { chat, notePlate, type Entry } from '../assistant/session';
import { speak } from '../assistant/voice';
import { cars, loadCars } from '../features/core/cards';
import { ui } from '../state/app';
import { faultFor, faultLine, symptomOf, viewAsked, whoseIn } from './faults';
import type { View } from './parts';
import { specFrom } from './spec';
import { cardIdOf, carNow, faultOf, keepRecord, motOf, recordOf, setFault, specOf } from './state';

type Opts = { voice?: boolean; private?: boolean };
interface CarInMind {
  plate: string;
  whose: string;
  named?: NamedCar;
}

let lastStamp = 0;
/** A time for a new entry: now, and always after the conversation's last one. */
const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1, ((chat.get().entries.at(-1) as { at?: number } | undefined)?.at ?? 0) + 1));
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** The car his words are about. */
async function carInMind(text: string): Promise<CarInMind | null> {
  const list = cars.get().at ? cars.get().list : await Promise.race([loadCars(), new Promise<NamedCar[]>((r) => setTimeout(() => r([]), 2500))]);
  const who = whoseIn(text);
  if (who) {
    const named = list.find((c) => (who === 'me' ? c.whose === 'me' : c.whose.toLowerCase() === who));
    if (named) return { plate: named.plate, whose: named.whose, named };
    // a car of someone he has not introduced is only "the car": nothing is looked up, kept or named for them
    const introduced = who === 'me' || RELATIONS.includes(who) || new RegExp(`\\bmy\\s+(?:[a-z]+\\s+)?${who}'s?\\b`).test(text.toLowerCase().replace(/[‘’]/g, "'"));
    return { plate: '', whose: introduced ? (who === 'me' ? 'me' : cap(who)) : '' };
  }
  // the car on show in the Studio, then the last CAR card in the conversation (within the hour), then the one he named
  const now = carNow.get();
  if (now.spec && ui.get().tab === 'studio') return { plate: now.spec.plate, whose: now.whose };
  const es = chat.get().entries;
  for (let i = es.length - 1; i >= 0; i--) {
    const e = es[i]!;
    if (e.kind === 'card' && e.card.kind === 'car' && e.card.car && Date.now() - e.at < 3_600_000) {
      const plate = e.card.car.plate;
      const named = plate ? list.find((c) => normalisePlate(c.plate) === normalisePlate(plate)) : undefined;
      return { plate, whose: e.card.car.whose ?? named?.whose ?? '', ...(named ? { named } : {}) };
    }
  }
  if (now.spec) return { plate: now.spec.plate, whose: now.whose };
  if (list.length === 1) return { plate: list[0]!.plate, whose: list[0]!.whose, named: list[0]! };
  return null;
}

/** The public record for a plate: the one held this session, else asked of the brain now (never kept). */
async function recordFor(plate: string): Promise<VehicleAnswer | null> {
  if (!plate) return null;
  const held = recordOf(plate);
  if (held) return held;
  try {
    const r = await fetch('/api/vehicle', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ plate: normalisePlate(plate) }), credentials: 'same-origin', cache: 'no-store' });
    const a = (await r.json()) as VehicleAnswer;
    keepRecord(plate, a);
    return a;
  } catch {
    return null;
  }
}

/** The CAR card for the car in mind (its record's card, or a stand-in's), at the end of the conversation. */
function cardFor(m: CarInMind, answer: VehicleAnswer | null): Card {
  if (m.plate && answer) return carCard(answer, m.plate, m.named);
  const title = m.whose ? `${m.whose === 'me' ? 'Your' : `${m.whose}'s`} car` : 'The car';
  return card({ id: cardIdOf(m.plate), kind: 'car', title, line: m.plate ? m.plate : 'A stand-in car', once: true, car: { plate: m.plate, ...(m.whose ? { whose: m.whose } : {}) } });
}

function toEnd(c: Card): void {
  chat.set((s) => ({ entries: [...s.entries.filter((e) => !(e.kind === 'card' && e.card.id === c.id)), { kind: 'card' as const, card: c, at: stamp(), once: true }].slice(-120) }));
}

function said(text: string, opts: Opts): void {
  chat.set((s) => ({ entries: [...s.entries, { kind: 'user' as const, text, at: stamp(), ...(opts.private ? { private: true } : {}) } as Entry].slice(-120) }));
}

/** "my dad's car makes a grinding noise when I brake": the suspects, on that car's card. */
export async function carFaultTurn(text: string, opts: Opts = {}): Promise<boolean> {
  const symptom = symptomOf(text);
  if (!symptom) return false;
  const m = (await carInMind(text)) ?? { plate: '', whose: '' };
  if (m.plate) notePlate(m.plate);
  said(text, opts);
  const answer = await recordFor(m.plate);
  const spec = m.plate ? specOf(m.plate) : specFrom(null);
  const pick = faultFor(symptom, { lines: motOf(m.plate), electric: spec.electric });
  const c = cardFor(m, answer);
  setFault(c.id, { text, pick });
  toEnd(c);
  // the car on show is this one: the FIX IT list follows
  if (carNow.get().card === c.id) carNow.set({ fault: pick, view: pick.view });
  const words = [pick.safety ?? '', faultLine(pick)].filter(Boolean).join(' ');
  chat.set({ live: words });
  if (opts.voice) void speak(words).catch(() => undefined);
  return true;
}

/** What the reply says for each view, round the car's name. */
const VIEW_WORDS: Record<View, (car: string) => string> = { bay: (c) => `Bonnet up on ${c}.`, wheel: (c) => `The front wheel is off ${c}.`, under: (c) => `Underneath ${c}.`, car: (c) => `Here is ${c}.` };

/** "open the bonnet", "show me the brakes", "what's under it": the Studio on the car in mind, in that view. */
export async function carViewTurn(text: string, opts: Opts, answer: (text: string, reply: string, local: { kind: 'car'; go?: { id: string; ask: number; label: string; run?: string; args?: Record<string, unknown> }[] }, opts: Opts) => true): Promise<boolean> {
  const v = viewAsked(text);
  if (!v) return false;
  const m = await carInMind(text);
  // only the bonnet opens with no car in mind (on a stand-in); "what's under it" about nothing is the brain's
  if (!m && v !== 'bay') return false;
  const plate = m?.plate ?? '';
  if (plate) await recordFor(plate);
  const id = cardIdOf(plate);
  const spec = plate ? specOf(plate) : specFrom(null);
  const now = carNow.get();
  const same = now.card === id && now.spec?.plate === spec.plate;
  carNow.set({ spec: same ? now.spec : spec, whose: m?.whose ?? '', view: v, fault: faultOf(id)?.pick ?? null, card: id });
  void run('open_studio', { sample: 'car' });
  // (the reply is kept with the conversation: it names whose car it is, never the record's make, model or plate)
  const name = m?.whose ? `${m.whose === 'me' ? 'your' : `${m.whose}'s`} car` : m ? 'the car' : 'a stand-in car';
  return answer(text, VIEW_WORDS[v](name), { kind: 'car', go: [{ id: 'studio:sample:car', ask: -1, label: 'OPEN THE CAR', run: 'open_studio', args: { sample: 'car' } }] }, opts);
}
